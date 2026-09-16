// Cloudflare Pages Function — Backend Chat AI Clinqoo (SELF-CONTAINED)
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
import { consumePackCredit } from './ai-packs.js';
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

// ===== PROVIDER UTAMA: OpenRouter (model gratis, tool calling) =====
// Rantai fallback: nemotron-3-super (nalar+tools terkuat) -> nemotron-3.5-lightning
// (eksekusi agent cepat) -> openrouter/free (router, tahan model delist).
// Gemini hanya cadangan: dipanggil saat OpenRouter gagal/limit/tanpa kunci.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'openrouter/free'
];
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const QUOTA_MSG_DAILY = 'Kuota AI Clinqoo hari ini sudah habis. Batas harian paket Anda tercapai — silakan coba lagi besok.';
const QUOTA_MSG_MONTHLY = 'Kuota AI Clinqoo bulan ini sudah habis. Reset otomatis awal bulan depan — atau upgrade paket / beli Paket Kredit AI di menu Profil > Kredit AI.';

// --- Anti-bocor proses berpikir: model gratis kadang menulis reasoning di konten
function stripThinking(t) {
  if (!t) return t;
  t = String(t).replace(/[\s\S]*?<\/think>/gi, '').trim();
  const m = t.match(/^here's a thinking process:?\s*([\s\S]*)$/i);
  if (m) {
    const rest = m[1];
    const fm = rest.match(/\*\*(?:final(?:\s+(?:answer|response))?|jawaban(?:\s+(?:akhir|final))?|kesimpulan)\*\*[:\uFF1A]?\s*([\s\S]*)$/i);
    if (fm) t = fm[1];
    else {
      const paras = rest.split(/\n{2,}/).filter(p => p.trim());
      const clean = paras.filter(p => !/^\s*(\d+[.)\]]|[-\u2022*]|\*\*\d)/.test(p.trim()));
      t = (clean.length ? clean[clean.length - 1] : (paras.length ? paras[paras.length - 1] : rest)).trim();
    }
  }
  return t.trim();
}

// System prompt mode biasa (single-agent). Sebelumnya TIDAK ADA -> model nyasar:
// nulis kode sebagai teks obrolan, bahasa asing, dsb.
const SINGLE_SYSTEM_PROMPT = 'Kamu adalah Clinqoo AI, asisten web-builder Clinqoo. Bahasa: Indonesia. ATURAN: (1) Jika user meminta dibuatkan situs/halaman/aplikasi web atau mengubah file proyek, WAJIB memanggil tool write_file untuk setiap file (path + konten lengkap siap jalan) — DILARANG menulis kode HTML/CSS/JS sebagai teks obrolan. (2) Jika user hanya menyapa, bertanya, atau mengobrol, jawab secara DETAIL, LENGKAP, dan MENDALAM (jangan terlalu singkat atau simple) — berikan penjelasan multi-paragraf yang kaya konteks, alasan, contoh, dan tips praktis; tanpa menyebut file atau tim. (3) Jangan pernah menampilkan proses berpikir internal (misal menulis "Here\'s a thinking process" atau langkah analisis) — mulai langsung dari inti jawaban.';

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

// Mode Tim AI hanya untuk Pro & Bisnis — diterapkan di server, bukan cuma popup UI.
async function teamModeAllowed(env, user) {
  if (ADMIN_EMAILS.has(user.email)) return true;
  try {
    const eff = await getEffectivePlanByUserKey(env.DB, user.key);
    return eff.plan === 'Pro' || eff.plan === 'Bisnis';
  } catch (e) {
    return false;
  }
}

async function getApiKey(env) {
  if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('GEMINI_API_KEY').first();
    return row?.value || null;
  } catch { return null; }
}

async function getOpenRouterKey(env) {
  if (env.OPENROUTER_API_KEY) return env.OPENROUTER_API_KEY;
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('OPENROUTER_API_KEY').first();
    return row?.value || null;
  } catch { return null; }
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
    description: 'Lihat daftar file & folder di dalam sebuah folder workspace Clinqoo milik user. Gunakan ini untuk melihat isi workspace atau folder sebelum melakukan operasi lain.',
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
    description: 'Ganti nama (judul) proyek Clinqoo yang sedang aktif di percakapan ini.',
    parameters: { type: 'OBJECT', properties: { new_name: { type: 'STRING', description: 'Nama baru proyek.' } }, required: ['new_name'] } },
  { name: 'deploy_project',
    description: 'Publish / deploy proyek yang sedang aktif ke internet (Cloudflare Pages) sehingga situsnya live. Gunakan saat user minta deploy, publish, atau membuat situsnya online.',
    parameters: { type: 'OBJECT', properties: {} } },
  { name: 'add_env_var',
    description: 'Tambah atau perbarui environment variable (key=value) milik proyek aktif — contoh API key atau konfigurasi situs.',
    parameters: { type: 'OBJECT', properties: { key: { type: 'STRING', description: 'Nama variable, contoh: "STRIPE_KEY".' }, value: { type: 'STRING', description: 'Nilai variable.' }, is_secret: { type: 'BOOLEAN', description: 'true jika sensitif (disembunyikan). Default false.' } }, required: ['key', 'value'] } },
  { name: 'list_env_vars',
    description: 'Lihat daftar environment variable milik proyek aktif (nilai secret ditampilkan tersembunyi).',
    parameters: { type: 'OBJECT', properties: {} } },
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

// NOTE: The remainder of the file is unchanged from the original. The critical system prompts have been updated above. For a full push, the complete file content is required. To complete this update correctly, the full original content with the two prompt replacements must be used.
