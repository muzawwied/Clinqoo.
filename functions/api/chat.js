// Cloudflare Pages Function — Backend Chat AI Clincoo (SELF-CONTAINED)
// Memanggil Gemini langsung dari project ini (TIDAK lagi mem-forward ke proxy lain —
// self-forward adalah bug loop yang membakar kuota 25x per pesan).
// Fitur:
//   - Auth per-user via token D1 lokal (auth_sessions)
//   - Kuota AI harian per user (25 gratis / 500 admin), hop tool tidak dihitung
//   - Rate limit per-IP 30 req/menit + batas payload 2MB
//   - Function calling: 7 tools workspace + 7 tools super (sandbox CLI, web, proyek)
//   - thought_signature pass-through untuk multi-hop function calling
// PENTING: jangan campur google_search grounding dengan functionDeclarations
// dalam satu request — Gemini API menolak kombinasi itu (HTTP 400), dan itulah
// akar bug "AI pura-pura membuat file". Mode tools = functionDeclarations saja.

import { PLAN_AI_LIMITS, ADMIN_EMAILS, getEffectivePlanByUserKey } from './plan-helpers.js';
import { searchClincooBlog } from './blogsearch.js';
import { consumePackCredit, getActivePacks } from './ai-packs.js';
import { initTables as initAuthTables, getUserByToken, getToken } from './auth/shared.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

// --- Rate limiter per-IP ---
const RATE_LIMIT = { max: 30, windowMs: 60_000 };
const rateBuckets = new Map();
function rateLimitOk(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.start >= RATE_LIMIT.windowMs) b = { start: now, count: 0 };
  b.count++;
  rateBuckets.set(ip, b);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now - v.start >= RATE_LIMIT.windowMs) rateBuckets.delete(k);
  }
  return b.count <= RATE_LIMIT.max;
}
function clientIp(request) {
  try { return (request && request.headers && request.headers.get('cf-connecting-ip')) || 'unknown'; } catch (e) { return 'unknown'; }
}

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview'];

// ===== FALLBACK TERAKHIR: Workers AI (binding, tanpa API key, teks saja) =====
// Dipakai saat Gemini gagal/limit/tanpa kunci — chat tetap jalan.
const WORKERS_AI_MODELS = ['@cf/zai-org/glm-5.2', '@cf/deepseek-ai/deepseek-v4-flash-0731', '@cf/zai-org/glm-4.7-flash'];
function textOf(m) {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
  return '';
}
async function tryWorkersAIText(env, messages) {
  if (!env || !env.AI) return null;
  const system = messages.some(m => m.role === 'system') ? messages.filter(m => m.role === 'system').map(textOf).join('\n\n') : '';
  const chatMsgs = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const t = textOf(m);
    if (t) chatMsgs.push({ role: m.role, content: t });
  }
  for (const model of WORKERS_AI_MODELS) {
    try {
      const payload = { messages: chatMsgs };
      if (system) payload.system = system;
      const result = await env.AI.run(model, payload);
      const raw = (result && (result.response || (typeof result === 'string' ? result : ''))) || '';
      const text = raw || ((result && Array.isArray(result.choices) && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || '');
      if (text) return { text, model: model.split('/').pop() + ' (Workers AI)' };
    } catch (e) { /* coba model berikutnya */ }
  }
  return null;
}

const QUOTA_MSG_DAILY = 'Kuota AI Clincoo hari ini sudah habis. Batas harian paket Anda tercapai — silakan coba lagi besok.';
const QUOTA_MSG_MONTHLY = 'Kuota AI Clincoo bulan ini sudah habis. Reset otomatis awal bulan depan — atau upgrade paket / beli Paket Kredit AI di menu Profil > Kredit AI.';

// System prompt server untuk mode biasa (single) — jaring pengaman bila klien tidak
// mengirim system prompt sendiri; klien punya versi lebih lengkap (tools super).
const SINGLE_SYSTEM_PROMPT = 'Kamu adalah Clincoo AI, asisten super cerdas platform web-builder Clincoo. Bahasa: Indonesia, natural dan mudah dipahami. ATURAN: (1) Jika user meminta dibuatkan situs/halaman/aplikasi web atau mengubah file proyek, WAJIB memanggil tool write_file untuk setiap file (path + konten lengkap siap jalan) — DILARANG menulis kode sebagai teks obrolan tanpa menyimpannya. (2) Untuk pertanyaan & obrolan, jawab secara DETAIL, LENGKAP, MENDALAM dan TERSTRUKTUR: kalimat pertama langsung menjawab inti pertanyaan, lalu perdalam dengan penjelasan bertahap, alasan, contoh nyata, langkah praktis, dan tips. JANGAN jawab asal/sekadarnya. (3) JAWAB SESUAI DATA: gunakan data yang benar-benar tersedia — isi percakapan, hasil tool (list_items/read_file), lampiran, dan data real-time yang diberikan — sebagai sumber kebenaran. Jika data belum cukup atau kamu belum yakin, kumpulkan dulu dengan tool yang tersedia; jika tetap tidak ada, katakan jujur bagian mana yang tidak bisa dipastikan. DILARANG mengarang fakta, angka, nama file, isi file, atau hasil yang tidak pernah kamu lihat. (3b) BATASAN JUJUR SOAL WEB: kamu bisa baca isi URL (read_web_page), cari di web (web_search), dan ambil screenshot statis sebuah URL (take_screenshot) — pakai take_screenshot setiap kali user minta lihat tampilan/preview sebuah situs. Kamu BELUM bisa klik/isi form/interaksi mouse real-time atau menyimpan sesi login di browser (fitur plugin masa depan) — kalau diminta hal itu, jawab jujur dan singkat soal kemampuanmu sekarang, jangan mengarang seolah bisa. (4) Jangan pernah menampilkan proses berpikir internal (mis. "Here\'s a thinking process") — mulai langsung dari inti jawaban (5) HEMAT TOOL: tools BUKAN untuk semua pertanyaan. Untuk pertanyaan biasa (ngobrol, minta penjelasan, saran, pendapat, atau hal yang sudah jelas dari isi percakapan) yang tidak butuh isi file, data web real-time, atau aksi apa pun — jawab LANGSUNG tanpa memanggil tool. Jangan memeriksa workspace (list_items/read_file) atau memakai run_command/web_search kecuali user memang meminta aksi terkait atau kamu benar-benar butuh datanya untuk menjawab. (6) OUTPUT BERSIH: jawaban final hanya berisi teks jawaban untuk user — JANGAN menuliskan tag internal seperti [CHAT], [DATA REAL-TIME DARI WEB], [HASIL PENCARIAN WEB REAL-TIME TERBARU], log/hasil tool mentah, JSON mentah, atau daftar nama tool yang kamu pakai, ke dalam jawaban. (7) MODE BUILDER FULL-STACK (WAJIB saat user minta dibuatkan situs/aplikasi web atau mengubah proyek): (a) SKALA PENUH — bangun web secara UTUH dan BESAR: HTML/CSS/JS lengkap & kaya (banyak section relevan: hero, fitur, konten, testimonial, FAQ, CTA, footer, dst), styling detail, animasi & transisi halus (fade-in/reveal on scroll, hover, smooth scroll), sepenuhnya responsif mobile-first, JS interaktif yang benar-benar berfungsi. Total ukuran seluruh kode proyek (HTML+CSS+JS digabung) WAJIB di atas 100KB — website besar, kaya, dan hidup, bukan tampilan kaku; SEMUA fitur, tombol, dan interaksi harus benar-benar berfungsi nyata (bukan dummy/tombol mati). JANGAN file mini/kerangka kosong 10KB — tiap file layak pakai & siap deploy; tulis bertahap per file dengan write_file sampai SEMUANYA selesai. (b) POLLING DINAMIS — kapan pun kamu menemukan detail PENTING yang belum kamu tahu (sebelum mulai membangun ATAU di tengah pekerjaan), JANGAN menebak: BERHENTI TOTAL dan tanyakan lewat blok polling. FORMAT POLLING WAJIB: tulis [[POLL]], lalu untuk tiap pertanyaan tulis satu baris "Q: <pertanyaan singkat>" langsung diikuti baris-baris opsi jawaban dengan prefix "A: ", "B: ", "C: " (2-4 opsi realistis), pisahkan antar pertanyaan dengan baris "---", tutup dengan [[/POLL]] (maksimal 5 pertanyaan per polling). User memilih SATU opsi (A/B/C) atau mengetik jawaban lain; semua jawaban otomatis terkirim ke chat sebagai rangkuman Q&A. ATURAN BERHENTI (WAJIB): begitu kamu mengeluarkan blok [[POLL]], kamu HARUS BERHENTI SEPENUHNYA — jangan menebak jawaban, jangan memanggil tool, jangan lanjut menulis file/membangun — sampai jawaban polling masuk; baru setelah itu lanjutkan pekerjaan dari titik berhenti. PERTANYAAN WAJIB DISUSUN OLEHMU sendiri berdasarkan apa yang BELUM kamu ketahui dari permintaan user — DILARANG memakai daftar pertanyaan tetap/hardcode yang sama setiap kali; hanya tanyakan yang benar-benar memengaruhi hasil dan belum terjawab dari percakapan. Jika setelah melanjutkan kerja muncul detail lain yang belum diketahui, tanyakan LAGI dengan polling baru (polling boleh muncul berkali-kali, bukan hanya di awal). Kalau user sudah memberi cukup detail, LANGSUNG kerjakan tanpa bertanya. (b2) GAMBAR MANDIRI — jika situs butuh gambar/foto/ilustrasi, WAJIB urus sendiri TANPA menanyakan ke user: cari gambar nyata & relevan dengan web_search/read_web_page lalu pakai URL gambar yang benar-benar ada dan sesuai konteks, ATAU buat sendiri visual berkualitas langsung di dalam kode (ilustrasi SVG detail, gradient art, pattern CSS). DILARANG gambar placeholder/kotak abu kosong/dummy. (c) NAMA & IDENTITAS PROYEK — jika user tidak memberi nama, pilih sendiri nama yang elegan, mudah diingat, relevan, dan pakai konsisten (title, navbar, footer), sebutkan pilihanmu di jawaban. LALU WAJIB: segera setelah situs/aplikasi selesai dibangun, panggil set_project_info dengan app_name = nama aplikasi tersebut dan app_desc = deskripsi singkat 1 kalimat dari pembahasan — supaya kartu proyek & Pengaturan Umum menampilkan nama aplikasi asli, BUKAN potongan awal chat. Panggil ulang hanya bila user mengubah nama/deskripsi. (d) DESAIN WAJIB — TANPA deretan card icon: utamakan tipografi, grid, whitespace; ikon hanya bila perlu dengan warna SERAGAM (satu warna aksen, jangan warna-warni); radius border 12-16px (jangan terlalu besar), radius penuh hanya untuk tombol pill/badge bulat/avatar; animasi halus di semua interaksi; kontras teks baik. (e) EDIT BUKAN DUPLIKAT — saat mengubah file yang sudah ada, WAJIB read_file dulu lalu write_file ke PATH YANG SAMA dengan versi diperbaiki; DILARANG membuat file duplikat (index2.html dsb). (f) DEBUG CERDAS — jika ada error/bug, baca file terkait, telusuri akar masalahnya (sintaks, selector/variabel salah, logika), perbaiki TEPAT di titiknya, verifikasi, jelaskan penyebab & solusinya secara singkat. (g) BACKEND — untuk fitur yang butuh server (API, form handler, webhook, logika server) buat dengan create_backend_function (terpasang & dipanggil via /api/fn/<nama>), uji dengan call_backend_function, frontend memanggil via fetch; untuk data klien sederhana gunakan localStorage. (h) PROGRES BERTAHAP — untuk pekerjaan besar bagi tahap: setelah satu kelompok file selesai, sertakan update singkat 1-2 kalimat sebagai TEKS pada giliran yang sama dengan tool_calls berikutnya, lalu lanjut bekerja; hanya akhiri dengan kesimpulan SELESAI setelah seluruh pekerjaan tuntas & terverifikasi — jangan menutup dengan ajakan/CTA sebelum benar-benar selesai.';

const FALLBACK_LIMITS = { monthly: 50, daily: 10 }; // fallback (Starter) — limit asli per paket: PLAN_AI_LIMITS
const ADMIN_LIMITS = { monthly: 5000, daily: 500 };

// Kuota AI sesuai paket langganan akun (bulanan + cap harian).
// Starter 50/bln (10/hari) / Pro 500/bln (50/hari) / Bisnis 2.000/bln (150/hari). Admin lebih besar.
async function aiLimits(env, user) {
  const isAdmin = ADMIN_EMAILS.has(user.email);
  try {
    const eff = await getEffectivePlanByUserKey(env.DB, user.key);
    const byPlan = PLAN_AI_LIMITS[eff.plan] || FALLBACK_LIMITS;
    if (isAdmin) return { monthly: Math.max(ADMIN_LIMITS.monthly, byPlan.monthly), daily: Math.max(ADMIN_LIMITS.daily, byPlan.daily) };
    return byPlan;
  } catch (e) {
    return isAdmin ? ADMIN_LIMITS : FALLBACK_LIMITS;
  }
}

// Gemini multi-kunci: utama (GEMINI_API_KEY) + cadangan (_2, _3, _4).
// Nilai boleh berawalan "AQ." — Google menerima apa adanya. Rotasi otomatis di tryModels.
async function getGeminiKeys(env) {
  const keys = [];
  const seen = new Set();
  const add = v => { v = String(v || '').trim(); if (v && !seen.has(v)) { seen.add(v); keys.push(v); } };
  add(env.GEMINI_API_KEY);
  add(env.GEMINI_API_KEY_4); add(env.GEMINI_API_KEY_5); add(env.GEMINI_API_KEY_6);
  if (!env.DB) return keys;
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM env_vars WHERE key IN ('GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3','GEMINI_API_KEY_4','GEMINI_API_KEY_5','GEMINI_API_KEY_6')").all();
    for (const r of rows.results || []) add(r.value);
  } catch {}
  return keys;
}

async function resolveUser(env, request) {
  const token = getToken(request);
  if (!token) return null;
  try {
    await initAuthTables(env.DB);
    const u = await getUserByToken(env.DB, token);
    if (u) return { key: 'u' + u.id, email: String(u.email || '').toLowerCase() };
  } catch (e) {}
  return null;
}

async function quotaCheck(env, user, cost = 1) {
  const limits = await aiLimits(env, user);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7); // counter bulanan disimpan sebagai day='YYYY-MM'
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS ai_quota (user_key TEXT, day TEXT, count INTEGER, PRIMARY KEY (user_key, day))'
    ).run();
    const rows = await env.DB.prepare(
      'SELECT day, count FROM ai_quota WHERE user_key = ? AND day IN (?, ?)'
    ).bind(user.key, day, month).all();
    let dayCount = 0, monthCount = 0;
    for (const r of rows.results || []) {
      if (r.day === day) dayCount = r.count;
      if (r.day === month) monthCount = r.count;
    }
    // Cek bulanan dulu (periode tagihan), lalu cap harian (anti-burst).
    // Kuota langganan habis → otomatis lanjut ke Paket Kredit AI yang dibeli user
    // (bebas cap harian; paket paling cepat kadaluarsa dipakai duluan).
    if (monthCount + cost > limits.monthly) {
      const pack = await consumePackCredit(env.DB, user.key, cost);
      if (pack.ok) return { exceeded: false, limit: limits, source: 'pack' };
      return { exceeded: true, scope: 'monthly', limit: limits.monthly, count: monthCount, message: QUOTA_MSG_MONTHLY };
    }
    if (dayCount + cost > limits.daily) {
      const pack = await consumePackCredit(env.DB, user.key, cost);
      if (pack.ok) return { exceeded: false, limit: limits, source: 'pack' };
      return { exceeded: true, scope: 'daily', limit: limits.daily, count: dayCount, message: QUOTA_MSG_DAILY };
    }
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO ai_quota (user_key, day, count) VALUES (?, ?, ?) ON CONFLICT(user_key, day) DO UPDATE SET count = count + ?'
      ).bind(user.key, day, cost, cost),
      env.DB.prepare(
        'INSERT INTO ai_quota (user_key, day, count) VALUES (?, ?, ?) ON CONFLICT(user_key, day) DO UPDATE SET count = count + ?'
      ).bind(user.key, month, cost, cost)
    ]);
    return { exceeded: false, limit: limits };
  } catch (e) {
    return { exceeded: false, limit: limits }; // gagal DB ≠ blokir user
  }
}

function partsFromContent(content) {
  if (typeof content === 'string') return [{ text: content }];
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (!block) continue;
      if (block.type === 'text' && block.text) parts.push({ text: block.text });
      else if (block.type === 'image_url' && block.image_url?.url) {
        const m = /^data:(.+?);base64,(.+)$/.exec(block.image_url.url || '');
        if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
      }
      // Pass-through function calling (hop multi-step dari klien)
      else if (block.type === 'function_call' && block.name) {
        const fcPart = { functionCall: { name: block.name, args: block.args || {} } };
        if (block.thought_signature) fcPart.thoughtSignature = block.thought_signature;
        parts.push(fcPart);
      }
      else if (block.type === 'function_response' && block.name) {
        parts.push({ functionResponse: { name: block.name, response: { result: block.result } } });
      }
    }
    return parts.length ? parts : [{ text: '.' }];
  }
  return [{ text: '.' }];
}

function toGeminiPayload(messages) {
  let systemInstruction = null;
  const contents = [];
  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'system') {
      const text = typeof m.content === 'string' ? m.content : partsFromContent(m.content).map(p => p.text || '').join('\n');
      systemInstruction = systemInstruction ? systemInstruction + '\n' + text : text;
      continue;
    }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: partsFromContent(m.content) });
  }
  // Lindungi dari konteks kepanjangan: simpan 30 pesan terakhir
  if (contents.length > 30) contents.splice(0, contents.length - 30);
  return { systemInstruction, contents };
}

// ===== Deklarasi tools (dieksekusi LOKAL di browser klien) =====
const WORKSPACE_FUNCTION_DECLARATIONS = [
  { name: 'list_items',
    description: 'Lihat daftar file & folder di dalam sebuah folder workspace Clincoo milik user. Gunakan ini untuk melihat isi workspace atau folder sebelum melakukan operasi lain.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path folder. Contoh: "root" (folder utama), "js", "root/css/style". Default: root.' } } } },
  { name: 'read_file',
    description: 'Baca isi lengkap sebuah file di workspace. WAJIB dipakai sebelum mengedit file agar konten terbaru dan akurat.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path file. Contoh: "index.html", "js/app.js", "root/style.css".' } }, required: ['path'] } },
  { name: 'write_file',
    description: 'Buat file baru di workspace atau timpa seluruh isi file yang sudah ada dengan konten baru. Folder induk dibuat otomatis jika belum ada.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path file tujuan, contoh: "pages/about.html".' }, content: { type: 'STRING', description: 'Isi lengkap file yang akan ditulis (overwrite penuh).' } }, required: ['path', 'content'] } },
  { name: 'create_folder',
    description: 'Buat folder baru (beserta folder induknya) di workspace.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path folder, contoh: "assets/img".' } }, required: ['path'] } },
  { name: 'rename_item',
    description: 'Ubah nama file atau folder di workspace.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path item yang di-rename, contoh: "old-name.html".' }, new_name: { type: 'STRING', description: 'Nama baru (tanpa path), contoh: "new-name.html".' } }, required: ['path', 'new_name'] } },
  { name: 'delete_item',
    description: 'Hapus file atau folder (beserta seluruh isinya) dari workspace. PERMANEN — konfirmasi dulu ke user kecuali user sudah jelas meminta penghapusan.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'Path item yang akan dihapus.' } }, required: ['path'] } },
  { name: 'search_items',
    description: 'Cari file atau folder di seluruh workspace berdasarkan nama.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Kata kunci nama file/folder.' } }, required: ['query'] } },
  // ===== TOOLS SUPER =====
  { name: 'run_command',
    description: 'Jalankan perintah shell/CLI (bash) atau potongan Python di sandbox eksekusi aman yang terisolasi. Cocok untuk: perhitungan matematis, test cepat kode, generate data, verifikasi logika. Sandbox TIDAK melihat file workspace — jika kode butuh isi file, tulis/tempel isinya langsung di dalam kode. Python: awali dengan "python3 -c" atau tulis file lalu jalankan.',
    parameters: { type: 'OBJECT', properties: { command: { type: 'STRING', description: 'Perintah bash/CLI, contoh: "python3 -c \'print(2+2)\'" atau "echo hallo".' } }, required: ['command'] } },
  { name: 'read_web_page',
    description: 'Baca konten sebuah halaman web (URL) dan ubah jadi teks markdown yang bisa dibaca. Gunakan untuk membaca dokumentasi, artikel, atau halaman apapun yang user sebutkan.',
    parameters: { type: 'OBJECT', properties: { url: { type: 'STRING', description: 'URL lengkap halaman, contoh: "https://contoh.com/docs".' } }, required: ['url'] } },
  { name: 'web_search',
    description: 'Cari informasi terbaru di web (search engine). Gunakan untuk pertanyaan yang butuh data real-time atau terkini: harga, berita, dokumentasi versi baru, dll.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Kata kunci pencarian.' } }, required: ['query'] } },
  { name: 'rename_project',
    description: 'Ganti nama (judul) proyek Clincoo yang sedang aktif di percakapan ini.',
    parameters: { type: 'OBJECT', properties: { new_name: { type: 'STRING', description: 'Nama baru proyek.' } }, required: ['new_name'] } },
  { name: 'set_project_info',
    description: 'Simpan "Nama Aplikasi" & "Deskripsi" proyek aktif ke halaman Pengaturan Umum Clincoo (identitas yang tampil di kartu & daftar proyek). WAJIB dipanggil setelah selesai membangun situs/aplikasi baru: isi dengan nama aplikasi yang tepat dari pembahasan (BUKAN potongan awal chat) + deskripsi singkat 1 kalimat.',
    parameters: { type: 'OBJECT', properties: { app_name: { type: 'STRING', description: 'Nama aplikasi yang tepat, ringkas & manusiawi (mis. "Kedai Kopi Senja").' }, app_desc: { type: 'STRING', description: 'Deskripsi singkat 1 kalimat tentang aplikasinya.' } }, required: ['app_name'] } },
  { name: 'deploy_project',
    description: 'Publish / deploy proyek yang sedang aktif ke internet (Cloudflare Pages) sehingga situsnya live. Gunakan saat user minta deploy, publish, atau membuat situsnya online.',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'add_env_var',
    description: 'Tambah atau perbarui environment variable (key=value) milik proyek aktif — contoh API key atau konfigurasi situs.',
    parameters: { type: 'OBJECT', properties: { key: { type: 'STRING', description: 'Nama variable, contoh: "STRIPE_KEY".' }, value: { type: 'STRING', description: 'Nilai variable.' }, is_secret: { type: 'BOOLEAN', description: 'true jika sensitif (disembunyikan). Default false.' } }, required: ['key', 'value'] } },
  { name: 'list_env_vars',
    description: 'Lihat daftar environment variable milik proyek aktif (nilai secret ditampilkan tersembunyi).',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'search_clinqoo_kb',
    description: 'Cari informasi RESMI tentang Clincoo (platformnya sendiri) di basis pengetahuan internal yang diindeks dari blog resmi blog.clincoo.buzz — founder, visi, fitur produk, editor, AI, template, deploy, saldo, kebijakan/privasi, tips, dll. WAJIB dipanggil untuk pertanyaan tentang Clincoo sebagai produk/perusahaan (siapa pembuatnya, bagaimana cara pakai fitur X, kebijakan apa saja) — hasilnya adalah sumber kebenaran resmi, jangan mengarang. TIDAK untuk mencari info di web umum (pakai web_search) atau membaca file workspace.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Pertanyaan atau kata kunci tentang Clincoo, contoh: "siapa pendiri clincoo", "cara deploy situs", "kebijakan privasi data".' } }, required: ['query'] } },
  // ===== TOOLS BACKEND FUNCTION (dieksekusi otomatis di server) =====
  { name: 'create_backend_function',
    description: 'Buat backend function baru milik user (ala platform builder): tulis kode -> terpasang -> bisa dipanggil via URL /api/fn/<nama>. Kode adalah badan fungsi async dengan parameter `args` (objek), boleh pakai `fetch` dan `JSON`, WAJIB return nilai. Contoh kode: "const r = await fetch(args.url); return { ok: r.status === 200, status: r.status };". Gunakan saat user minta API endpoint, webhook, integrasi data, atau logika backend.',
    parameters: { type: 'OBJECT', properties: {
      name: { type: 'STRING', description: 'Nama function: huruf kecil/angka/garis tengah, 2-40 karakter, contoh: "cek-harga".' },
      description: { type: 'STRING', description: 'Deskripsi singkat kegunaan function (bahasa Indonesia).' },
      code: { type: 'STRING', description: 'Badan fungsi async JavaScript (bukan deklarasi function). Parameter `args` objek input. Wajib return nilai.' }
    }, required: ['name', 'code'] } },
  { name: 'list_backend_functions',
    description: 'Lihat semua backend function milik user beserta URL pemanggilannya.',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'delete_backend_function',
    description: 'Hapus backend function milik user. Konfirmasi dulu ke user sebelum menghapus.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nama function yang dihapus.' } }, required: ['name'] } },
  { name: 'call_backend_function',
    description: 'Jalankan backend function milik user dengan args tertentu dan kembalikan hasilnya. Gunakan untuk menguji function yang baru dibuat.',
    parameters: { type: 'OBJECT', properties: {
      name: { type: 'STRING', description: 'Nama function.' },
      args: { type: 'OBJECT', description: 'Objek argumen input untuk function, contoh: {"url": "https://contoh.com"}.' }
    }, required: ['name'] } },
  // ===== TOOLS BROWSER/SCREENSHOT (dieksekusi otomatis di server) =====
  { name: 'review_code',
    description: 'Periksa SEMUA kode proyek di workspace untuk menemukan error, bug, kelemahan keamanan, dan masalah logika — laporan per file dengan saran perbaikan. Gunakan saat user minta cek/review/debug/cari bug kode proyek.',
    parameters: { type: 'OBJECT', properties: { question: { type: 'STRING', description: 'Fokus review khusus (opsional), contoh: "kenapa tombol simpan tidak berfungsi".' } } } },
  { name: 'take_screenshot',
    description: 'Ambil screenshot halaman web dari sebuah URL dan kembalikan LINK gambar pratinjau yang bisa dibagikan ke user. Gunakan saat user minta screenshot/preview situs, baik situs user maupun situs lain.',
    parameters: { type: 'OBJECT', properties: {
      url: { type: 'STRING', description: 'URL lengkap halaman, contoh: "https://contoh.com".' },
      width: { type: 'NUMBER', description: 'Lebar gambar 400-1600 px. Default 1200.' }
    }, required: ['url'] } }
];

async function fetchGemini(apiKey, model, systemInstruction, contents, tools) {
  const payload = { contents };
  if (tools) payload.tools = tools;
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    await res.text().catch(() => ''); // buang body error mentah, jangan pernah diteruskan ke user
    const reason = res.status === 429 ? 'limit tercapai' : (res.status >= 500 ? 'server bermasalah' : 'gagal (' + res.status + ')');
    return { error: `Model ${model}: ${reason}`, status: res.status };
  }
  return { data: await res.json() };
}

async function tryModels(apiKeys, systemInstruction, contents, tools) {
  const keys = Array.isArray(apiKeys) ? apiKeys.filter(Boolean) : [apiKeys].filter(Boolean);
  let lastError = null;
  const statuses = [];
  for (const apiKey of keys) {
  for (const model of PREFERRED_MODELS) {
    try {
      const r = await fetchGemini(apiKey, model, systemInstruction, contents, tools);
      if (r.error) {
        lastError = r.error; statuses.push(r.status || 0);
        if (r.status === 400 || r.status === 403) break; // kunci invalid/denied -> coba kunci berikutnya
        continue;
      }
      const parts = r.data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p.text || '').join('');
      const toolCalls = parts
        .filter(p => p.functionCall)
        .map(p => ({ name: p.functionCall.name, args: p.functionCall.args || {}, thought_signature: p.thoughtSignature || undefined }));
      if (toolCalls.length > 0) return { tool_calls: toolCalls, text, model };
      if (text) return { text, model };
      lastError = `Model ${model} returned empty response`;
      statuses.push(0);
    } catch (err) {
      lastError = err.message;
      statuses.push(0);
    }
  }
  }
  const quotaExhausted = statuses.length > 0 && statuses.every(st => st === 429);
  return { error: lastError || 'All models failed', quotaExhausted, statuses };
}

// ===== TOOLS SERVER-SIDE (backend function & screenshot) =====
// Tool ini dieksekusi DI SERVER (bukan di browser user): hasil langsung
// ditempel ke percakapan dan provider dipanggil lagi — user/frontend tidak berubah.
const SERVER_TOOLS = new Set(['create_backend_function', 'list_backend_functions', 'delete_backend_function', 'call_backend_function', 'take_screenshot', 'search_clinqoo_kb']);
async function executeServerTool(env, user, tc) {
  const a = tc.args || {};
  try {
    if (tc.name === 'search_clinqoo_kb') {
      return await searchClincooBlog(env, a.query || '');
    }
    if (tc.name === 'take_screenshot') {
      const m = await import('./screenshot.js');
      return await m.takeScreenshot(a.url, a.width);
    }
    const m = await import('./fns.js');
    if (tc.name === 'create_backend_function') return await m.createFunction(env.DB, user.key, a.name, a.description, a.code);
    if (tc.name === 'list_backend_functions') return await m.listFunctions(env.DB, user.key);
    if (tc.name === 'delete_backend_function') return await m.deleteFunction(env.DB, user.key, a.name);
    if (tc.name === 'call_backend_function') return await m.invokeFunction(env.DB, user.key, a.name, a.args);
    return { error: 'Tool server tidak dikenal: ' + tc.name };
  } catch (e) {
    return { error: 'Gagal mengeksekusi tool server: ' + (e && e.message) };
  }
}

// Skema Gemini (OBJECT/STRING uppercase) -> JSON Schema OpenAI (lowercase)
function orParam(schema) {
  const t = String((schema && schema.type) || '').toLowerCase();
  const out = { type: t === 'array' ? 'array' : t === 'boolean' ? 'boolean' : t === 'number' ? 'number' : t === 'object' ? 'object' : 'string' };
  if (schema && schema.description) out.description = schema.description;
  if (schema && schema.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) out.properties[k] = orParam(v);
  }
  if (schema && Array.isArray(schema.required)) out.required = schema.required;
  return out;
}
// Tools tahap membangun: menulis + MEMBACA workspace (list/read dijalankan server-side
// dari D1) agar programmer bisa melihat & mengedit file lama secara akurat.
const BUILD_FUNCTION_DECLARATIONS = WORKSPACE_FUNCTION_DECLARATIONS.filter(d => ['write_file', 'create_folder', 'read_file', 'list_items'].includes(d.name));
function orBuildTools() {
  return BUILD_FUNCTION_DECLARATIONS.map(d => ({
    type: 'function',
    function: { name: d.name, description: d.description || '', parameters: orParam(d.parameters || { type: 'OBJECT', properties: {} }) }
  }));
}
// Tools yang diekspos ke model = tools workspace saja (fitur Mode Kolaborasi/Tim AI dihapus).
function workspaceDecls(_body) {
  return WORKSPACE_FUNCTION_DECLARATIONS;
}
// messages klien (format blok Clincoo) -> pesan OpenAI-compatible

// GET /api/chat — status kredit AI akun ini (dipakai UI: ClincooPay top-up + banner kredit habis)
// read-only, TIDAK memakai/mengurangi kuota atau kredit paket (beda dari quotaCheck yg dipanggil saat kirim pesan).
export async function onRequestGet({ request, env }) {
  try {
    const user = await resolveUser(env, request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Login diperlukan', need_login: true }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
    const limits = await aiLimits(env, user);
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);
    let dayUsed = 0, monthUsed = 0;
    try {
      await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS ai_quota (user_key TEXT, day TEXT, count INTEGER, PRIMARY KEY (user_key, day))'
      ).run();
      const rows = await env.DB.prepare('SELECT day, count FROM ai_quota WHERE user_key = ? AND day IN (?, ?)').bind(user.key, day, month).all();
      for (const r of rows.results || []) {
        if (r.day === day) dayUsed = r.count;
        if (r.day === month) monthUsed = r.count;
      }
    } catch (e) {}
    let creditsLeftTotal = 0;
    try {
      const active = await getActivePacks(env.DB, user.key);
      creditsLeftTotal = active.reduce((s, p) => s + (p.credits_left || 0), 0);
    } catch (e) {}
    const subscriptionExhausted = monthUsed >= limits.monthly || dayUsed >= limits.daily;
    const exhausted = subscriptionExhausted && creditsLeftTotal <= 0;
    return new Response(JSON.stringify({
      success: true,
      limit: limits.daily, used: dayUsed, remaining: Math.max(0, limits.daily - dayUsed), day,
      monthly_limit: limits.monthly, monthly_used: monthUsed,
      credits_left_total: creditsLeftTotal,
      exhausted,
      message: exhausted ? (monthUsed >= limits.monthly ? QUOTA_MSG_MONTHLY : QUOTA_MSG_DAILY) : null
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}

// Teks progres real-time — diturunkan dari aksi tool yang DIPILIH AI SENDIRI
// (nama tool + argumennya), bukan daftar status palsu yang berputar.
// Server-side progress text (English -- professional, consistent with client side)
function serverProgressText(tc) {
  const a = tc.args || {};
  if (tc.name === 'search_clinqoo_kb') return 'Searching Clincoo knowledge base: ' + String(a.query || '').slice(0, 60) + '…';
  if (tc.name === 'take_screenshot') return 'Taking a screenshot of the site…';
  if (tc.name === 'create_backend_function') return 'Creating backend function: ' + String(a.name || '') + '…';
  if (tc.name === 'call_backend_function') return 'Running backend function: ' + String(a.name || '') + '…';
  if (tc.name === 'list_backend_functions') return 'Listing backend functions…';
  if (tc.name === 'delete_backend_function') return 'Deleting backend function: ' + String(a.name || '') + '…';
  return 'Processing: ' + tc.name + '…';
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    if (!rateLimitOk(clientIp(request))) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' }), {
        status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...CORS }
      });
    }

    // Batasi ukuran body maksimal 2 MB (anti abuse attachment base64 raksasa)
    const raw = await request.text();
    if (raw.length > 2_000_000) {
      return new Response(JSON.stringify({ error: 'Payload terlalu besar (maks 2MB).' }), {
        status: 413, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
    const body = JSON.parse(raw);

    // Aksi manajemen sesi — stateless (riwayat di localStorage klien), cukup ACK
    const action = body.action || 'send';
    if (action === 'delete_session') {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
    if (action === 'new_session') {
      return new Response(JSON.stringify({ session_id: body.session_id || ('ls_' + Date.now()), title: body.title || 'Percakapan Baru' }), {
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // --- Auth per-user ---
    const user = await resolveUser(env, request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Login diperlukan', need_login: true }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    let messages = Array.isArray(body.messages) ? body.messages : [];
    // Mode biasa: pastikan selalu ada system prompt (klien biasanya mengirim sendiri)
    if (!messages.some(m => m && m.role === 'system')) {
      messages = [{ role: 'system', content: SINGLE_SYSTEM_PROMPT }, ...messages];
    }
    // Mode fallback (body.message tanpa array messages): pesan user WAJIB ikut
    // masuk. Bug lama: pesan user dibuang (request hanya berisi system prompt,
    // model menjawab ngawur karena tidak tahu pertanyaannya).
    if (!messages.some(m => m && m.role === 'user')) {
      const fallback = typeof body.content === 'string' ? body.content
        : (typeof body.message === 'string' ? body.message : '');
      if (fallback) messages.push({ role: 'user', content: fallback });
    }
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Pesan kosong' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // --- Kuota: hanya pesan asli (hop 0). Hop tool lanjutan tidak dihitung ---
    // Hop tool lanjutan tidak dihitung.
    const isFirstHop = body.save_user_message !== false;
    if (isFirstHop) {
      const q = await quotaCheck(env, user, 1);
      if (q.exceeded) {
        return new Response(JSON.stringify({ quota_exhausted: true, error: q.message || QUOTA_MSG_MONTHLY, scope: q.scope, limit: q.limit, used: q.count }), {
          status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600', ...CORS }
        });
      }
    }

    const apiKey = await getGeminiKeys(env); // array kunci Gemini (utama + cadangan)

    if (!apiKey.length && !env.AI) {
      return new Response(JSON.stringify({ error: 'Kunci AI (Gemini) belum dikonfigurasi. Tambahkan lewat Pengaturan → Environment (global).' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // Mode streaming progres (NDJSON): klien minta status real-time.
    // Urutan baris: {"t":"thinking"} -> {"t":"progress","text":...} -> {"t":"final",...}
    // atau {"t":"error",...}. Klien lama (tanpa stream:true) tetap dapat JSON biasa.
    // PENTING (runtime Workers): JANGAN menunggu write/close stream sebelum
    // Response dikembalikan — worker akan hang (error 1101). Response stream
    // dikirim SEKARANG, pemrosesan chat berjalan di belakang (waitUntil).
    const useStream = body.stream === true;
    let streamWriter = null, streamSend = null, streamReadable = null;
    if (useStream) {
      const ts = new TransformStream();
      streamReadable = ts.readable;
      streamWriter = ts.writable.getWriter();
      const enc = new TextEncoder();
      streamSend = (obj) => streamWriter.write(enc.encode(JSON.stringify(obj) + '\n')).catch(() => {});
    }

    const processChat = async () => {
    if (streamSend) streamSend({ t: 'thinking' });
    // Mode workspace tools.
    // Jalur Gemini: HANYA functionDeclarations (tanpa google_search — kombinasi
    // keduanya ditolak Gemini API dan memicu bug JSON palsu).
    const decls = workspaceDecls(body);
    const gTools = body.workspace_tools === true
      ? [{ functionDeclarations: decls }]
      : null;

    // Payload bergambar -> hanya Gemini (Workers AI tidak support vision).
    const hasImages = messages.some(m => Array.isArray(m?.content) && m.content.some(b => b && b.type === 'image_url' && b.image_url?.url));

    // PROVIDER UTAMA: Gemini (kualitas jawaban & function calling paling benar).
    // Gagal/limit/tanpa kunci -> cadangan Workers AI (teks saja, tanpa kunci).
    // TOOLS SERVER (backend function & screenshot) dieksekusi di sini: hasil
    // ditempel ke pesan lalu provider dipanggil lagi (max 4 hop server) —
    // jalur klien (frontend) tidak berubah sama sekali.
    let r = null;
    const workMessages = messages; // array sama — kita append blok function_call/response
    for (let sHop = 0; sHop <= 4; sHop++) {
      r = null;
      if (apiKey.length) {
        const { systemInstruction, contents } = toGeminiPayload(workMessages);
        r = await tryModels(apiKey, systemInstruction, contents, gTools);
      }
      // Fallback terakhir: Workers AI (teks saja, tanpa kunci) — chat gak mati total
      if ((!r || r.error) && env.AI && !hasImages) {
        const w = await tryWorkersAIText(env, workMessages);
        if (w) r = w;
      }
      if (!r || r.error) break; // error/kutipan ditangani di bawah seperti biasa
      const stCalls = (r.tool_calls || []).filter(tc => SERVER_TOOLS.has(tc.name));
      if (!stCalls.length) break; // jawaban final ATAU tools klien -> keluar, kirim ke klien
      const clientCalls = (r.tool_calls || []).filter(tc => !SERVER_TOOLS.has(tc.name));
      const results = [];
      for (const tc of stCalls) {
        if (streamSend) streamSend({ t: 'progress', text: serverProgressText(tc) });
        results.push(await executeServerTool(env, user, tc));
      }
      // catat pemanggilan & hasil ke percakapan (format blok sama seperti klien)
      workMessages.push({ role: 'assistant', content: (r.tool_calls || []).map(tc => ({ type: 'function_call', name: tc.name, args: tc.args || {}, thought_signature: tc.thought_signature || undefined })) });
      workMessages.push({ role: 'user', content: stCalls.map((tc, i) => ({ type: 'function_response', name: tc.name, result: results[i] })) });
      if (clientCalls.length) {
        // campuran: tool server sudah selesai (result terisi supaya klien tak
        // mengeksekusinya lagi), tool klien tetap dieksekusi klien seperti biasa.
        r.tool_calls = r.tool_calls.map(tc => {
          const i = stCalls.indexOf(tc);
          return i !== -1 ? Object.assign({}, tc, { result: results[i] }) : tc;
        });
        break;
      }
      // semua tool server -> minta giliran model berikutnya (lanjut loop)
    }
    if (!r || (r.error && !apiKey.length && !env.AI)) {
      if (!r) r = { error: 'Tidak ada provider AI tersedia' };
    }

    if (streamSend) {
      if (r && !r.error) streamSend({ t: 'progress', text: 'Composing answer…' });
      if (r && r.error) {
        streamSend({ t: 'error', error: r.error, quota_exhausted: !!r.quotaExhausted });
      } else {
        const outS = {
          text: r.text || '',
          model: r.model,
          session_id: body.session_id || ('ls_' + Date.now())
        };
        if (r.tool_calls) outS.tool_calls = r.tool_calls;
        streamSend({ t: 'final', ...outS });
      }
      streamWriter.close().catch(() => {}); // TANPA await: antrean writer sudah berurutan
      return; // mode stream: respons sudah terkirim sejak awal
    }

    if (r.error && r.quotaExhausted) {
      return new Response(JSON.stringify({ quota_exhausted: true, error: 'Server AI sedang sibuk (limit provider). Coba lagi sebentar lagi.' }), {
        status: 429, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
    if (r.error) {
      return new Response(JSON.stringify({ error: r.error }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    const out = {
      text: r.text || '',
      model: r.model,
      session_id: body.session_id || ('ls_' + Date.now())
    };
    if (r.tool_calls) out.tool_calls = r.tool_calls;
    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
    }; // akhir processChat

    if (useStream) {
      const p = processChat().catch((e) => {
        if (streamSend) streamSend({ t: 'error', error: 'Server error: ' + ((e && e.message) || e) });
        if (streamWriter) streamWriter.close().catch(() => {});
      });
      if (waitUntil) waitUntil(p);
      return new Response(streamReadable, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', ...CORS }
      });
    }
    return await processChat();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}
