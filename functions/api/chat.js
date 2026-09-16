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

// System prompt server untuk mode biasa (single) — jaring pengaman bila klien tidak
// mengirim system prompt sendiri; klien punya versi lebih lengkap (tools super).
const SINGLE_SYSTEM_PROMPT = 'Kamu adalah Clinqoo AI, asisten super cerdas platform web-builder Clinqoo. Bahasa: Indonesia, natural dan mudah dipahami. ATURAN: (1) Jika user meminta dibuatkan situs/halaman/aplikasi web atau mengubah file proyek, WAJIB memanggil tool write_file untuk setiap file (path + konten lengkap siap jalan) — DILARANG menulis kode sebagai teks obrolan tanpa menyimpannya. (2) Untuk pertanyaan & obrolan, jawab secara DETAIL, LENGKAP, MENDALAM dan TERSTRUKTUR: kalimat pertama langsung menjawab inti pertanyaan, lalu perdalam dengan penjelasan bertahap, alasan, contoh nyata, langkah praktis, dan tips. JANGAN jawab asal/sekadarnya. (3) JAWAB SESUAI DATA: gunakan data yang benar-benar tersedia — isi percakapan, hasil tool (list_items/read_file), lampiran, dan data real-time yang diberikan — sebagai sumber kebenaran. Jika data belum cukup atau kamu belum yakin, kumpulkan dulu dengan tool yang tersedia; jika tetap tidak ada, katakan jujur bagian mana yang tidak bisa dipastikan. DILARANG mengarang fakta, angka, nama file, isi file, atau hasil yang tidak pernah kamu lihat. (4) Jangan pernah menampilkan proses berpikir internal (mis. "Here\'s a thinking process") — mulai langsung dari inti jawaban.';

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
  { name: 'push_to_github',
    description: 'Kirim semua file proyek aktif ke repo GitHub yang terintegrasi dengan Clinqoo, lalu memicu deploy otomatis. Gunakan saat user meminta push/commit/simpan perubahan ke GitHub, atau mempublikasikan situs lewat GitHub.',
    parameters: { type: 'OBJECT', properties: { repo: { type: 'STRING', description: 'Repo target format owner/name, contoh "muzawwied/situs-ku". Opsional — kosongkan untuk memakai repo yang sudah terhubung di pengaturan proyek.' }, commit_message: { type: 'STRING', description: 'Pesan commit singkat dan deskriptif, contoh "Update halaman utama".' } }, required: ['commit_message'] }
  },
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

async function tryModels(apiKey, systemInstruction, contents, tools) {
  let lastError = null;
  const statuses = [];
  for (const model of PREFERRED_MODELS) {
    try {
      const r = await fetchGemini(apiKey, model, systemInstruction, contents, tools);
      if (r.error) { lastError = r.error; statuses.push(r.status || 0); continue; }
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
  const quotaExhausted = statuses.length > 0 && statuses.every(st => st === 429);
  return { error: lastError || 'All models failed', quotaExhausted };
}

// ===== OpenRouter: konversi format =====
// ===== TOOLS SERVER-SIDE (backend function & screenshot) =====
// Tool ini dieksekusi DI SERVER (bukan di browser user): hasil langsung
// ditempel ke percakapan dan provider dipanggil lagi — user/frontend tidak berubah.
const SERVER_TOOLS = new Set(['create_backend_function', 'list_backend_functions', 'delete_backend_function', 'call_backend_function', 'take_screenshot']);
async function executeServerTool(env, user, tc) {
  const a = tc.args || {};
  try {
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
function orTools() {
  return WORKSPACE_FUNCTION_DECLARATIONS.map(d => ({
    type: 'function',
    function: { name: d.name, description: d.description || '', parameters: orParam(d.parameters || { type: 'OBJECT', properties: {} }) }
  }));
}
// messages klien (format blok Clinqoo) -> pesan OpenAI-compatible
function orMessages(messages) {
  const out = [];
  const pushText = (role, text) => { if (text) out.push({ role, content: text }); };
  for (const m of messages) {
    if (!m) continue;
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
    if (typeof m.content === 'string') { pushText(role, m.content); continue; }
    const blocks = Array.isArray(m.content) ? m.content : [];
    let pendingText = '';
    for (const b of blocks) {
      if (!b) continue;
      if (b.type === 'text' && b.text) pendingText += (pendingText ? '\n' : '') + b.text;
      else if (b.type === 'function_call' && b.name) {
        pushText(role === 'assistant' ? 'assistant' : 'user', pendingText); pendingText = '';
        out.push({ role: 'assistant', content: null, tool_calls: [{ id: 'call_' + (b.call_id || b.name), type: 'function', function: { name: b.name, arguments: JSON.stringify(b.args || {}) } }] });
      } else if (b.type === 'function_response' && b.name) {
        pushText('user', pendingText); pendingText = '';
        out.push({ role: 'tool', tool_call_id: 'call_' + (b.call_id || b.name), content: JSON.stringify({ result: b.result }) });
      }
      // image_url dibiarkan (model gratis OR non-vision; payload bergambar diarahkan ke Gemini)
    }
    pushText(role, pendingText);
  }
  // konteks panjang: 30 pesan terakhir (sama seperti jalur Gemini)
  if (out.length > 30) out.splice(0, out.length - 30);
  return out;
}
async function tryOpenRouter(apiKey, messages, tools, models) {
  const statuses = [];
  let lastError = null;
  for (const model of (models || OPENROUTER_MODELS)) {
    try {
      const payload = { model, messages };
      if (tools) { payload.tools = tools; payload.tool_choice = 'auto'; }
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'HTTP-Referer': 'https://clincoo-be2.pages.dev', 'X-Title': 'Clincoo' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        await res.text().catch(() => ''); // buang body error mentah provider
        const reason = res.status === 429 ? 'limit tercapai' : (res.status >= 500 ? 'server bermasalah' : 'gagal (' + res.status + ')');
        lastError = `OpenRouter ${model}: ${reason}`; statuses.push(res.status); continue;
      }
      const d = await res.json();
      const m = d?.choices?.[0]?.message;
      const text = (typeof m?.content === 'string' ? m.content : '') || '';
      const rawToolCalls = m?.tool_calls || [];
      const toolCalls = rawToolCalls.map(tc => {
        let args = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch (e) {}
        return { name: tc.function?.name || '', args, id: tc.id };
      }).filter(tc => tc.name);
      if (toolCalls.length > 0) return { tool_calls: toolCalls, text, model, raw_tool_calls: rawToolCalls };
      if (text) return { text, model };
      lastError = `OpenRouter ${model} returned empty response`; statuses.push(0);
    } catch (err) { lastError = 'OpenRouter ' + err.message; statuses.push(0); }
  }
  const quotaExhausted = statuses.length > 0 && statuses.every(st => st === 429);
  return { error: lastError || 'Semua model OpenRouter gagal', statuses, quotaExhausted };
}

// ===== MODE TIM AI: beberapa model berdiskusi lalu membangun web =====
// Alur: Arsitek (rencana) -> Programmer (tulis file via tools) -> Reviewer (kritik)
// -> Perbaikan (programmer revisi). Hasil akhir = tool_calls write_file yang
// dieksekusi klien seperti biasa. Biaya kuota: 5 (tugas gede), lihat TEAM_COST.
const TEAM_COST = 5;
// Batas waktu total orkestrasi (ms) — harus di bawah timeout klien 300s.
// Tahap yang belum jalan saat deadline lewat dilewati (draft tetap dikirim).
const TEAM_DEADLINE_MS = 150_000;
const TEAM_STAGE_MODELS = {
  arsitek: ['nvidia/nemotron-3-super-120b-a12b:free', 'openrouter/free'],
  programmer: ['nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
  reviewer: ['cohere/north-mini-code:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
  perbaikan: ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3.5-lightning:free']
};
const TEAM_LABELS = {
  arsitek: 'Arsitek', programmer: 'Programmer', reviewer: 'Reviewer', perbaikan: 'Perbaikan'
};


// ===== KONTEKS MODE TIM AI: Tim melihat workspace & riwayat seperti mode biasa =====
// File proyek tersinkron di D1 (project_files) — bisa dibaca langsung server-side.
async function teamWorkspaceSnapshot(env, projectId) {
  try {
    if (!projectId || !env.DB) return '(workspace proyek tidak diketahui)';
    const rows = await env.DB.prepare('SELECT path, LENGTH(content) AS size FROM project_files WHERE project_id = ? ORDER BY path').bind(projectId).all();
    const files = (rows && rows.results) || [];
    if (!files.length) return '(workspace masih kosong — semua file akan dibuat baru)';
    return files.length + ' file:\n' + files.map(f => '- ' + f.path + ' (' + (f.size || 0) + ' karakter)').join('\n');
  } catch (e) { return '(workspace tidak bisa dibaca)'; }
}
async function teamReadFile(env, projectId, path) {
  try {
    if (!projectId || !env.DB || !path) return { success: false, error: 'Parameter path wajib.' };
    const p = String(path).replace(/^\/+/, '');
    const row = await env.DB.prepare('SELECT content FROM project_files WHERE project_id = ? AND path = ?').bind(projectId, p).first();
    if (!row) return { success: false, error: 'File tidak ditemukan di workspace: ' + p };
    return { success: true, path: p, content: String(row.content || '').slice(0, 12000) };
  } catch (e) { return { success: false, error: e.message }; }
}
// Riwayat percakapan (teks user & AI saja) supaya Tim AI punya konteks penuh.
function teamTranscript(messages) {
  const parts = [];
  for (const m of (messages || [])) {
    if (!m || m.role === 'system') continue;
    let text = '';
    if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.content)) text = m.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
    if (!text) continue;
    parts.push((m.role === 'user' ? 'USER' : 'CLINQOO') + ': ' + String(text).slice(0, 4000));
    if (parts.join('\n').length > 9000) break;
  }
  return parts.join('\n\n');
}

// satu panggilan model peran (OR dulu, Gemini cadangan) — tanpa loop, untuk tahap teks (arsitek/reviewer)
async function teamStage(env, orKey, apiKey, stage, systemPrompt, userText, tools) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText }
  ];
  let r = null;
  let orQuotaExhausted = false;
  if (orKey) { r = await tryOpenRouter(orKey, messages, tools || null, TEAM_STAGE_MODELS[stage]); orQuotaExhausted = !!(r && r.quotaExhausted); }
  if ((!r || r.error) && apiKey) {
    // cadangan Gemini (format konversi sederhana; tools Gemini pakai functionDeclarations)
    const { systemInstruction, contents } = toGeminiPayload(messages);
    const gTools = tools ? [{ functionDeclarations: WORKSPACE_FUNCTION_DECLARATIONS }] : null;
    r = await tryModels(apiKey, systemInstruction, contents, gTools);
    // limit provider hanya benar-benar "penuh" bila OpenRouter DAN Gemini cadangan sama-sama 429
    if (r) r.quotaExhausted = orQuotaExhausted && !!r.quotaExhausted;
  }
  return r || { error: 'Tidak ada provider AI tersedia' };
}

// Loop multi-hop buat tahap MEMBANGUN (programmer/perbaikan): model kecil biasanya
// cuma memanggil 1-2 tool per giliran, jadi harus diberi giliran berulang dengan
// balasan sintetis "sukses" agar dia lanjut menulis file berikutnya — sama seperti
// loop function-calling di sisi klien (MAX_TOOL_HOPS), tapi berjalan di server untuk
// tahap Tim AI. Berhenti saat model tidak lagi memanggil tool, atau maxHops tercapai.
async function teamBuildLoop(env, orKey, apiKey, stage, systemPrompt, userText, maxHops, deadline, projectId) {
  const messages = [
    { role: 'system', content: systemPrompt + '\n\nPENTING: panggil tool write_file untuk BEBERAPA file SEKALIGUS dalam satu giliran bila memungkinkan (paralel). Kalau konten terlalu panjang untuk satu giliran, lanjutkan file berikutnya di giliran sesudahnya sampai SEMUA file dari rencana selesai. Setelah semua file selesai, berhenti memanggil tool dan balas teks singkat "selesai".' },
    { role: 'user', content: userText }
  ];
  const collected = new Map(); // key: name+':'+path -> tool_call
  let usedModel = null;
  let lastText = '';
  let usedGeminiFallback = false;
  let orQuotaExhausted = false;
  let geminiQuotaExhausted = false;

  for (let hop = 0; hop < maxHops; hop++) {
    if (deadline && Date.now() > deadline) break; // jaga total waktu orkestrasi
    let r = null;
    if (orKey && !usedGeminiFallback) { r = await tryOpenRouter(orKey, messages, orBuildTools(), TEAM_STAGE_MODELS[stage]); if (r && r.error) orQuotaExhausted = !!r.quotaExhausted; }
    if ((!r || r.error) && apiKey) {
      // Gemini cadangan: satu kali percobaan non-loop (format tool berbeda), lalu hentikan loop
      const { systemInstruction, contents } = toGeminiPayload(messages.filter(m => m.role !== 'tool' && !(m.role === 'assistant' && !m.content)));
      const gTools = [{ functionDeclarations: BUILD_FUNCTION_DECLARATIONS }];
      const rg = await tryModels(apiKey, systemInstruction, contents, gTools);
      if (!rg.error) {
        usedModel = rg.model; lastText = rg.text || lastText;
        for (const tc of (rg.tool_calls || [])) if ((tc.name === 'write_file' || tc.name === 'create_folder') && tc.args && tc.args.path) collected.set(tc.name + ':' + tc.args.path, tc);
      } else {
        geminiQuotaExhausted = !!rg.quotaExhausted;
      }
      usedGeminiFallback = true;
      break; // Gemini fallback tidak diloop (format function_call beda skema)
    }
    if (!r || r.error) break;
    usedModel = r.model || usedModel;
    lastText = r.text || lastText;
    if (!r.tool_calls || !r.tool_calls.length) break; // model selesai, tidak ada tool call lagi

    const rawList = r.raw_tool_calls || r.tool_calls.map((tc, i) => ({ id: 'call_h' + hop + '_' + i, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) } }));
    messages.push({ role: 'assistant', content: r.text || null, tool_calls: rawList });
    for (let i = 0; i < r.tool_calls.length; i++) {
      const tc = r.tool_calls[i];
      if ((tc.name === 'write_file' || tc.name === 'create_folder') && tc.args && tc.args.path) collected.set(tc.name + ':' + tc.args.path, tc);
      const callId = (rawList[i] && rawList[i].id) || tc.id || ('call_h' + hop + '_' + i);
      // Tim AI bisa MEMBACA workspace: list/read dijalankan server-side dari D1
      let toolResult = { success: true };
      if (tc.name === 'read_file') toolResult = await teamReadFile(env, projectId, (tc.args || {}).path);
      else if (tc.name === 'list_items') toolResult = { success: true, listing: await teamWorkspaceSnapshot(env, projectId) };
      messages.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify(toolResult).slice(0, 13000) });
    }
  }
  // limit provider "penuh" hanya bila tidak ada file yang berhasil dibuat SAMA SEKALI
  // dan kedua provider (yang dicoba) memang kena 429
  const quotaExhausted = collected.size === 0 && (orQuotaExhausted || geminiQuotaExhausted);
  return { tool_calls: [...collected.values()], text: lastText, model: usedModel, quotaExhausted };
}

async function teamOrchestrate(env, orKey, apiKey, userPrompt, oTools, ctx) {
  const transcript = [];
  ctx = ctx || {};
  const ctxBlock =
    (ctx.workspace ? 'ISI WORKSPACE PROYEK SAAT INI:\n' + ctx.workspace + '\n\n' : '') +
    (ctx.transcript ? 'RIWAYAT PERCAKAPAN SEBELUMNYA (perhatikan bila relevan, jangan diulang):\n' + ctx.transcript + '\n\n' : '') +
    (ctx.systemPrompt ? 'IDENTITAS & KEMAMPUAN PLATFORM (untuk konteks saja):\n' + ctx.systemPrompt + '\n\n' : '');

  // Tahap 1: Arsitek menyusun rencana situs
  const r1 = await teamStage(env, orKey, apiKey, 'arsitek',
    'Kamu adalah ARSITEK WEB paling senior di Tim AI Clinqoo — teliti, analitis, dan tidak menebak. Baca permintaan user dengan saksama dan bangun rencana SEPENUHNYA dari data yang benar-benar ada di permintaan itu (tujuan, topik, nama, fitur, preferensi gaya, data/konten yang disebut user). Setiap keputusan desain & fitur harus BISA DITELUSURI ke permintaan user — jangan menambah fitur fiktif, jangan mengarang konten. Jika ada bagian permintaan yang ambigu, tulis asumsi masuk akal Anda secara eksplisit di bagian ASUMSI. Format rencana (maks 300 kata): 1) Tujuan & gaya visual (palet warna spesifik, nuansa, tipografi), 2) Daftar file yang harus dibuat — HANYA file inti yang benar-benar diperlukan, MAKSIMAL 8 file, boleh menggabung CSS/JS ke dalam HTML bila membuat situs tetap bagus (path + isi singkat + fitur penting tiap file), 3) Struktur navigasi antar halaman, 4) ASUMSI & catatan untuk programmer. Rencana ini akan dikerjakan oleh programmer, jadi harus sangat spesifik dan bisa langsung dieksekusi. JIKA workspace di konteks sudah berisi file, rencanakan EDIT/menimpa file itu (programmer bisa membacanya dengan tool read_file) alih-alih memaksakan semua file baru. JANGAN menulis kode HTML/CSS/JS di tahap ini.',
    ctxBlock + 'PERMINTAAN USER:\n' + userPrompt, null);
  if (r1.error) return { error: TEAM_BUSY_MSG, quotaExhausted: !!r1.quotaExhausted, stageFailed: 'arsitek' };
  transcript.push({ stage: 'arsitek', model: r1.model, text: (r1.text || '').slice(0, 1500) });

  // Tahap 2: Programmer membangun file web (loop multi-hop — 1 file per giliran)
  const startedAt = Date.now();
  const r2 = await teamBuildLoop(env, orKey, apiKey, 'programmer',
    'Kamu adalah PROGRAMMER WEB senior di Tim AI Clinqoo — standar kualitas produksi tinggi. Kerjakan rencana arsitek berikut SECARA PENUH dan SETIA pada rencana: setiap file yang disebut rencana wajib dibuat, konten harus sesuai data/asumsi yang tertulis di rencana (jangan mengarang konten baru yang bertentangan dengan rencana). Buat SEMUA file web memakai tool write_file dengan konten lengkap per file: HTML semantik yang rapi, CSS modern responsif (mobile-first, kontras baik, spacing konsisten), JS vanilla tanpa error, komentar seperlunya, SEO dasar (title, meta description, lang). Setiap halaman harus benar-benar siap jalan saat dibuka — bukan kerangka kosong. Sebelum menulis, baca ulang rencana dan pastikan tidak ada file yang terlewat. Tool list_items dan read_file tersedia untuk MEMBACA isi workspace yang sudah ada — WAJIB dipakai sebelum mengubah file lama supaya konten aslinya tidak hilang.',
    ctxBlock + 'RENCANA ARSITEK:\n' + (r1.text || ''), 6, startedAt + TEAM_DEADLINE_MS, projectId);
  if (r2.error) return { error: TEAM_BUSY_MSG, quotaExhausted: !!r2.quotaExhausted, transcript, stageFailed: 'programmer' };
  const draftCalls = (r2.tool_calls || []).filter(tc => tc.name === 'write_file' && tc.args && tc.args.path && tc.args.content);
  if (!draftCalls.length) {
    // programmer cuma ngobrol tanpa bikin file valid -> gagal tahap ini
    return { error: r2.quotaExhausted ? TEAM_BUSY_MSG : 'Programmer tidak menghasilkan file', quotaExhausted: !!r2.quotaExhausted, transcript, text: r2.text };
  }
  transcript.push({ stage: 'programmer', model: r2.model, text: draftCalls.map(tc => 'write_file: ' + tc.args.path).join(', ') });

  // Tahap 3: Reviewer mengaudit hasil
  const filesDigest = draftCalls.filter(tc => tc.name === 'write_file').map(tc => {
    const p = tc.args.path || '?';
    const c = String(tc.args.content || '');
    return 'FILE ' + p + ' (' + c.length + ' karakter)\nawal:\n' + c.slice(0, 400) + '\nakhir:\n' + c.slice(-300);
  }).join('\n\n');
  if (Date.now() - startedAt > TEAM_DEADLINE_MS - 40_000) {
    // waktu hampir habis — kirim draft apa adanya, lewati review
    transcript.push({ stage: 'reviewer', model: null, text: '(dilewati — batas waktu tercapai)' });
    return { transcript, tool_calls: draftCalls, text: '', fixModel: null };
  }
  const r3 = await teamStage(env, orKey, apiKey, 'reviewer',
    'Kamu adalah REVIEWER KODE paling ketat di Tim AI Clinqoo — audit berbasis bukti, bukan opini. Bandingkan file web berikut terhadap rencana arsitek, POTONGAN ISI FILE yang diberikan, dan data permintaan user. Periksa sistematis: (1) apakah semua file di rencana sudah dibuat, (2) link & navigasi antar file valid, (3) HTML tidak rusak (tag tidak tertutup, struktur rusak), (4) JS tidak ada error sintaks/logika yang jelas, (5) fitur inti rencana benar-benar ada, bukan cuma teks pengganti, (6) konten sesuai data/asumsi rencana — tidak ada konten yang jelas-jelas dikarang atau bertentangan. Laporkan HANYA masalah fatal/penting dengan menyebut bukti persisnya (nama file + kutipan singkat) — maks 180 kata. Format: daftar temuan bernomor dengan nama file; jika semuanya baik tulis hanya: SEMUA OK. Jangan minta perubahan kosmetik.',
    ctxBlock + 'RENCANA ARSITEK:\n' + (r1.text || '') + '\n\nFILE YANG DIBUAT:\n' + filesDigest, null);
  if (r3.error) return { error: TEAM_BUSY_MSG, quotaExhausted: !!r3.quotaExhausted, transcript, tool_calls: draftCalls, stageFailed: 'reviewer' };
  const reviewText = (r3.text || '').trim();
  transcript.push({ stage: 'reviewer', model: r3.model, text: reviewText.slice(0, 1000) });

  // Tahap 4: Perbaikan hanya jika reviewer menemukan masalah
  const needsFix = reviewText.length > 0 && !/^semua ok/i.test(reviewText);
  let finalCalls = draftCalls;
  let fixModel = null;
  if (needsFix) {
    const r4 = await teamBuildLoop(env, orKey, apiKey, 'perbaikan',
      'Kamu adalah PROGRAMMER WEB senior di Tim AI Clinqoo — presisi tinggi. Setiap temuan reviewer di bawah harus dibereskan SESUAI BUKTI yang ia sebutkan. Tulis ULANG HANYA file yang bermasalah/hilang dengan tool write_file (overwrite penuh, konten lengkap diperbaiki, tetap menjaga bagian file yang sudah benar). Jangan mengulang file yang sudah benar dan tidak disebut reviewer, jangan mengubah gaya/struktur yang tidak dikeluhkan. Baca ulang temuan reviewer satu per satu dan pastikan semuanya tertangani.',
      ctxBlock + 'RENCANA ARSITEK:\n' + (r1.text || '') + '\n\nFILE SAAT INI (draft, tulis ulang bila perlu):\n' + filesDigest + '\n\nTEMUAN REVIEWER:\n' + reviewText, 4, startedAt + TEAM_DEADLINE_MS, projectId);
    const fixCalls = (r4.tool_calls || []).filter(tc => tc.name === 'write_file' && tc.args && tc.args.path && tc.args.content);
    if (!r4.error && fixCalls.length) {
      // gabung: draft + revisi (revisi menimpa path sama)
      const byPath = new Map();
      for (const tc of draftCalls) byPath.set(tc.args.path, tc);
      for (const tc of fixCalls) byPath.set(tc.args.path, tc);
      finalCalls = [...byPath.values()];
      fixModel = r4.model;
      transcript.push({ stage: 'perbaikan', model: r4.model, text: fixCalls.map(tc => 'revisi: ' + tc.args.path).join(', ') });
    }
  }

  return { transcript, tool_calls: finalCalls, text: '', fixModel };
}

function teamTranscriptText(transcript) {
  const icons = { arsitek: '\u{1F9D1}\u200D\u{1F4BB}', reviewer: '\u{1F50D}', perbaikan: '\u{1F527}' };
  return transcript.map(t => {
    const label = (TEAM_LABELS[t.stage] || t.stage) + ' (' + (t.model || '?') + ')';
    const icon = icons[t.stage] || '';
    const body = (t.text || '').slice(0, 1200);
    return icon + ' [' + label + ']\n' + body;
  }).join('\n\n');
}

// GET /api/chat — sisa kredit AI harian akun ini (dipakai UI, mis. halaman hubungkan ClinqooPay)
export async function onRequestGet({ request, env }) {
  try {
    const user = await resolveUser(env, request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Login diperlukan', need_login: true }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
    const limit = await dailyAiLimit(env, user);
    const day = new Date().toISOString().slice(0, 10);
    let used = 0;
    try {
      await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS ai_quota (user_key TEXT, day TEXT, count INTEGER, PRIMARY KEY (user_key, day))'
      ).run();
      const row = await env.DB.prepare('SELECT count FROM ai_quota WHERE user_key = ? AND day = ?').bind(user.key, day).first();
      used = row ? row.count : 0;
    } catch (e) {}
    return new Response(JSON.stringify({ success: true, limit, used, remaining: Math.max(0, limit - used), day }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}

export async function onRequestPost({ request, env }) {
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
    if (body.team !== true && !messages.some(m => m && m.role === 'system')) {
      messages = [{ role: 'system', content: SINGLE_SYSTEM_PROMPT }, ...messages];
    }
    if (messages.length === 0) {
      const fallback = typeof body.content === 'string' ? body.content
        : (typeof body.message === 'string' ? body.message : '');
      if (fallback) messages = [{ role: 'user', content: fallback }];
    }
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Pesan kosong' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // --- Mode Tim AI: wajib paket Pro/Bisnis (enforcement server, bukan cuma UI) ---
    if (body.team === true) {
      const allowed = await teamModeAllowed(env, user);
      if (!allowed) {
        return new Response(JSON.stringify({ need_pro: true, error: 'Mode Tim AI hanya tersedia untuk Paket Pro dan Bisnis. Upgrade paketmu untuk mengaktifkannya.' }), {
          status: 402, headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }
    }

    // --- Kuota: hanya pesan asli (hop 0). Hop tool lanjutan tidak dihitung ---
    // Mode Tim AI = tugas gede: 1 pesan memakan TEAM_COST kuota.
    const isFirstHop = body.save_user_message !== false;
    if (isFirstHop) {
      const q = await quotaCheck(env, user, body.team === true ? TEAM_COST : 1);
      if (q.exceeded) {
        return new Response(JSON.stringify({ quota_exhausted: true, error: q.message || QUOTA_MSG_MONTHLY, scope: q.scope, limit: q.limit, used: q.count }), {
          status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600', ...CORS }
        });
      }
    }

    const orKey = await getOpenRouterKey(env);
    const apiKey = await getApiKey(env);

    // ===== MODE TIM AI: diskusi multi-model lalu bangun web =====
    if (body.team === true) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const userPrompt = (typeof lastUser?.content === 'string' ? lastUser.content : (Array.isArray(lastUser?.content) ? (lastUser.content.find(b => b && b.type === 'text') || {}).text : '')) || '';
      if (!userPrompt) {
        return new Response(JSON.stringify({ error: 'Pesan kosong' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
      // Konteks penuh Tim AI: workspace (D1) + riwayat percakapan + identitas platform
      const sysMsg = messages.find(m => m && m.role === 'system');
      const teamCtx = {
        workspace: await teamWorkspaceSnapshot(env, body.project_id || null),
        transcript: teamTranscript(messages),
        systemPrompt: sysMsg ? String(sysMsg.content || '').slice(0, 3000) : ''
      };
      const t = await teamOrchestrate(env, orKey, apiKey, userPrompt, body.workspace_tools === true ? orTools() : null, teamCtx);
      if (t.error && !t.tool_calls) {
        // limit/kuota provider penuh -> kunci komposer di klien (sama seperti kuota harian habis)
        if (t.quotaExhausted) {
          return new Response(JSON.stringify({ quota_exhausted: true, error: TEAM_BUSY_MSG }), {
            status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '120', ...CORS }
          });
        }
        // error lain: jangan pernah bocorkan detail mentah provider ke user
        return new Response(JSON.stringify({ error: TEAM_ERROR_MSG }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
      const out = {
        text: (t.tool_calls && t.tool_calls.length
          ? '\u{1F9E9} Tim AI selesai berdiskusi & membangun:\n' + teamTranscriptText(t.transcript || []) + '\n\n\u2705 Semua file sudah selesai dibuat \u2014 cek hasilnya di halaman Workspace, atau balas di sini kalau masih ada yang mau diubah.'
          : (t.text || 'Tim AI selesai.') + '\n' + teamTranscriptText(t.transcript || [])),
        model: 'Tim AI (' + String((t.transcript || []).length + (t.tool_calls ? 1 : 0)) + ' panggilan model)',
        session_id: body.session_id || ('ls_' + Date.now())
      };
      if (t.tool_calls && t.tool_calls.length) out.tool_calls = t.tool_calls;
      return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (!orKey && !apiKey) {
      return new Response(JSON.stringify({ error: 'Kunci AI (OpenRouter/Gemini) belum dikonfigurasi. Tambahkan lewat Pengaturan → Environment (global).' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // Mode workspace tools.
    // Jalur Gemini: HANYA functionDeclarations (tanpa google_search — kombinasi
    // keduanya ditolak Gemini API dan memicu bug JSON palsu).
    const gTools = body.workspace_tools === true
      ? [{ functionDeclarations: WORKSPACE_FUNCTION_DECLARATIONS }]
      : null;
    const oTools = body.workspace_tools === true ? orTools() : null;

    // Payload bergambar -> langsung Gemini (model gratis OpenRouter non-vision).
    const hasImages = messages.some(m => Array.isArray(m?.content) && m.content.some(b => b && b.type === 'image_url' && b.image_url?.url));

    // PROVIDER UTAMA: OpenRouter. Gagal/limit/tanpa kunci -> cadangan Gemini.
    // TOOLS SERVER (backend function & screenshot) dieksekusi di sini: hasil
    // ditempel ke pesan lalu provider dipanggil lagi (max 4 hop server) —
    // jalur klien (frontend) tidak berubah sama sekali.
    let r = null;
    const workMessages = messages; // array sama — kita append blok function_call/response
    for (let sHop = 0; sHop <= 4; sHop++) {
      r = null;
      if (orKey && !hasImages) {
        r = await tryOpenRouter(orKey, orMessages(workMessages), oTools);
      }
      if ((!r || r.error) && apiKey) {
        const { systemInstruction, contents } = toGeminiPayload(workMessages);
        r = await tryModels(apiKey, systemInstruction, contents, gTools);
      }
      if (!r || r.error) break; // error/kutipan ditangani di bawah seperti biasa
      const stCalls = (r.tool_calls || []).filter(tc => SERVER_TOOLS.has(tc.name));
      if (!stCalls.length) break; // jawaban final ATAU tools klien -> keluar, kirim ke klien
      const clientCalls = (r.tool_calls || []).filter(tc => !SERVER_TOOLS.has(tc.name));
      const results = [];
      for (const tc of stCalls) results.push(await executeServerTool(env, user, tc));
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
    if (!r || (r.error && !apiKey)) {
      if (!r) r = { error: 'Tidak ada provider AI tersedia' };
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
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
}
