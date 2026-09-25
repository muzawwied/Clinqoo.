// Cloudflare Pages Function — /api/fns "Backend Functions" (SELF-CONTAINED)
// Fitur ala platform builder: AI (dan user) bisa MEMBUAT backend function:
// tulis kode -> tersimpan -> langsung bisa dipanggil via URL /api/fn/<nama>.
//   POST /api/fns { action: 'create'|'update'|'delete'|'list'|'invoke',
//                   name?, description?, code?, args? }
//   GET  /api/fns  -> daftar function milik user
// Kontrak kode function: badan fungsi async dengan parameter `args` (objek),
// boleh memakai `fetch` dan `JSON`, WAJIB mengembalikan nilai dengan return.
// Contoh kode: "const r = await fetch(args.url); return { ok: r.status === 200, status: r.status };"
// Fungsi milik user (user_key) — private, hanya pemilik yang bisa memanggil.
// Tool chat AI: create/list/delete/call_backend_function (dieksekusi server di chat.js).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_CODE = 32 * 1024;
const MAX_RESULT = 20 * 1000; // karakter
const MAX_LIST = 200;

// ===== Kuota per paket langganan =====
const FN_QUOTAS = {
  Starter: { rows: 500,   bytes: 2_000_000,   invokes: 60 },
  Pro:     { rows: 5_000, bytes: 25_000_000,  invokes: 300 },
  Bisnis:  { rows: 50_000, bytes: 100_000_000, invokes: 1200 }
};
const DEFAULT_QUOTA = FN_QUOTAS.Starter;

async function getPlan(DB, userKey) {
  try {
    await DB.prepare('CREATE TABLE IF NOT EXISTS subscription (key TEXT PRIMARY KEY, value TEXT)').run();
    const row = await DB.prepare('SELECT value FROM subscription WHERE key = ?').bind(userKey + ':plan').first();
    const plan = String(row?.value || 'Starter');
    return FN_QUOTAS[plan] ? plan : 'Starter';
  } catch (e) { return 'Starter'; }
}

// ===== D1 =====
async function ensureTable(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS custom_functions (
    id TEXT PRIMARY KEY,
    user_key TEXT,
    name TEXT,
    description TEXT,
    code TEXT,
    is_public INTEGER DEFAULT 0,
    webhook_secret TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run();
  // migrasi kolom utk tabel lama
  await DB.prepare('ALTER TABLE custom_functions ADD COLUMN is_public INTEGER DEFAULT 0').run().catch(() => {});
  await DB.prepare('ALTER TABLE custom_functions ADD COLUMN webhook_secret TEXT').run().catch(() => {});
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_cf_user ON custom_functions (user_key, name)').run().catch(() => {});
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_cf_whk ON custom_functions (name, webhook_secret)').run().catch(() => {});
}

// ===== Database bawaan function (fn_data, per user, kuota per paket) =====
async function ensureDataTable(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS fn_data (
    user_key TEXT NOT NULL,
    k TEXT NOT NULL,
    v TEXT NOT NULL,
    updated_at TEXT,
    PRIMARY KEY (user_key, k)
  )`).run();
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_fndata_user ON fn_data (user_key)').run().catch(() => {});
}
async function dataUsage(DB, userKey) {
  const r = await DB.prepare('SELECT COUNT(*) AS rows, IFNULL(SUM(LENGTH(v)),0) AS bytes FROM fn_data WHERE user_key = ?').bind(userKey).first();
  return { rows: (r && r.rows) || 0, bytes: (r && r.bytes) || 0 };
}
function makeDb(DB, userKey, plan) {
  const quota = FN_QUOTAS[plan] || DEFAULT_QUOTA;
  const checkKey = (k) => {
    k = String(k === undefined || k === null ? '' : k);
    if (!k || k.length > 512) throw new Error('Kunci db tidak valid (wajib diisi, maks 512 karakter).');
    return k;
  };
  return {
    async get(k) {
      k = checkKey(k);
      await ensureDataTable(DB);
      const row = await DB.prepare('SELECT v FROM fn_data WHERE user_key = ? AND k = ?').bind(userKey, k).first();
      if (!row) return null;
      try { return JSON.parse(row.v); } catch (e) { return row.v; }
    },
    async set(k, v) {
      k = checkKey(k);
      let val = (typeof v === 'string') ? v : JSON.stringify(v);
      if (val.length > 100_000) throw new Error('Nilai db terlalu besar (maksimal 100KB per data).');
      await ensureDataTable(DB);
      const old = await DB.prepare('SELECT LENGTH(v) AS n FROM fn_data WHERE user_key = ? AND k = ?').bind(userKey, k).first();
      const usage = await dataUsage(DB, userKey);
      const newRows = (old ? usage.rows : usage.rows + 1);
      const newBytes = usage.bytes + val.length - ((old && old.n) || 0);
      if (newRows > quota.rows) throw new Error('Kuota data paket ' + plan + ' penuh (maks ' + quota.rows + ' baris). Upgrade paket untuk kapasitas lebih besar.');
      if (newBytes > quota.bytes) throw new Error('Kuota penyimpanan paket ' + plan + ' penuh (maks ' + Math.round(quota.bytes / 1000000) + ' MB). Upgrade paket untuk kapasitas lebih besar.');
      await DB.prepare('INSERT INTO fn_data (user_key, k, v, updated_at) VALUES (?,?,?,?) ON CONFLICT(user_key, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at')
        .bind(userKey, k, val, new Date().toISOString()).run();
      return true;
    },
    async del(k) {
      k = checkKey(k);
      await ensureDataTable(DB);
      await DB.prepare('DELETE FROM fn_data WHERE user_key = ? AND k = ?').bind(userKey, k).run();
      return true;
    },
    async list(prefix) {
      prefix = String(prefix || '');
      await ensureDataTable(DB);
      const { results } = await DB.prepare("SELECT k, v FROM fn_data WHERE user_key = ? AND k LIKE ? ORDER BY updated_at DESC LIMIT 200").bind(userKey, prefix.replace(/[%_]/g, c => '\\' + c) + '%').all();
      return (results || []).map(r => { let v; try { v = JSON.parse(r.v); } catch (e) { v = r.v; } return { k: r.k, v: v }; });
    },
    async count() {
      await ensureDataTable(DB);
      const u = await dataUsage(DB, userKey);
      return { rows: u.rows, bytes: u.bytes, limits: { rows: quota.rows, bytes: quota.bytes }, plan: plan };
    }
  };
}
async function getFn(DB, userKey, name) {
  return await DB.prepare('SELECT * FROM custom_functions WHERE user_key = ? AND name = ?').bind(userKey, name).first() || null;
}
function fnJson(row) {
  return { id: row.id, name: row.name, description: row.description || '', code_length: (row.code || '').length, url: '/api/fn/' + row.name, is_public: !!(row.is_public), created_at: row.created_at, updated_at: row.updated_at };
}

// ===== Pengaman eksekusi (perbaikan keamanan) =====
// 1) safeFetch: blokir fetch dari function user ke host internal Clincoo / IP
//    privat (anti-SSRF & anti-loop biaya). Semua host lain tetap diizinkan.
const BLOCKED_HOST_RE = /(^|\.)(clincoo\.buzz|clinqoo\.biz\.id|clincoo-be2\.pages\.dev|clinqoo\.pages\.dev)$/i;
const BLOCKED_IP_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
function safeFetch(input, init) {
  let urlStr;
  try {
    urlStr = (input instanceof Request) ? input.url : String(input);
    const u = new URL(urlStr);
    const host = u.hostname;
    if (BLOCKED_HOST_RE.test(host) || BLOCKED_IP_RE.test(host)) {
      return Promise.reject(new Error('fetch ke host internal tidak diizinkan: ' + host));
    }
  } catch (e) {
    return Promise.reject(new Error('URL fetch tidak valid.'));
  }
  return fetch(input, init);
}

// 2) Rate limit invoke (D1, tahan lintas-isolate): batas mengikuti paket langganan
//    (default 60 invoke / 5 menit utk Starter)
async function rateLimitInvoke(DB, rateKey, limit) {
  try {
    const window = Math.floor(Date.now() / (5 * 60 * 1000));
    await DB.prepare('CREATE TABLE IF NOT EXISTS rl_fn (k TEXT PRIMARY KEY, c INTEGER DEFAULT 0)').run();
    const row = await DB.prepare('SELECT c FROM rl_fn WHERE k = ?').bind(rateKey + '|' + window).first();
    const count = (row?.c || 0) + 1;
    if (!row) await DB.prepare('INSERT INTO rl_fn (k, c) VALUES (?, 1)').bind(rateKey + '|' + window).run();
    else await DB.prepare('UPDATE rl_fn SET c = ? WHERE k = ?').bind(count, rateKey + '|' + window).run();
    if (count === 1) { // bersihkan jendela lama sesekali
      try { await DB.prepare("DELETE FROM rl_fn WHERE k LIKE ?").bind(rateKey + '|' + (window - 1) + '%').run(); } catch (e) {}
    }
    return count <= (limit || 60);
  } catch (e) { return true; /* jangan blokir karena DB gangguan */ }
}

// ===== Eksekusi kode function user (timeout 15 detik) =====
async function runFunctionCode(DB, row, args) {
  const plan = await getPlan(DB, row.user_key);
  const db = makeDb(DB, row.user_key, plan);
  let fn;
  try {
    // badan fungsi async dengan parameter args; safeFetch, JSON, & db (database bawaan) tersedia
    fn = new Function('args', 'fetch', 'JSON', 'db', '"use strict"; return (async () => {' + row.code + '})();');
  } catch (e) {
    return { error: 'Kode function tidak valid: ' + e.message };
  }
  const safeArgs = (args && typeof args === 'object' && !Array.isArray(args)) ? args : {};
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Function melebihi 15 detik (timeout)')), 15_000));
  try {
    const value = await Promise.race([fn(safeArgs, safeFetch, JSON, db), timeout]);
    let out;
    try { out = JSON.stringify(value === undefined ? null : value); }
    catch (e) { out = JSON.stringify(String(value)); }
    if (out.length > MAX_RESULT) out = out.slice(0, MAX_RESULT) + '…(dipotong)';
    return { ok: true, function: row.name, result: JSON.parse(out) };
  } catch (e) {
    return { error: 'Function error: ' + (e && e.message) };
  }
}

export async function invokeFunction(DB, userKey, name, args) {
  await ensureTable(DB);
  const row = await getFn(DB, userKey, name);
  if (!row) return { error: `Function "${name}" tidak ditemukan. Buat dulu dengan create_backend_function.` };
  const plan = await getPlan(DB, userKey);
  const quota = FN_QUOTAS[plan] || DEFAULT_QUOTA;
  if (!(await rateLimitInvoke(DB, userKey, quota.invokes))) {
    return { error: 'Terlalu banyak pemanggilan function (batas paket ' + plan + ': ' + quota.invokes + ' per 5 menit). Coba lagi dalam beberapa menit.' };
  }
  return await runFunctionCode(DB, row, args);
}

// ===== Invoke WEBHOOK PUBLIK (tanpa login, khusus function is_public) =====
export async function invokePublicFunction(DB, name, secret, args, ip) {
  await ensureTable(DB);
  const row = await DB.prepare('SELECT * FROM custom_functions WHERE name = ? AND webhook_secret = ? AND is_public = 1')
    .bind(String(name || ''), String(secret || '')).first();
  if (!row) return { error: 'Function publik tidak ditemukan atau key webhook tidak valid.', status: 404 };
  // rate limit per IP+function (120/5 menit); pemakaian data mengikuti kuota pemilik
  if (!(await rateLimitInvoke(DB, 'whk|' + String(ip || '?') + '|' + row.user_key, 120))) {
    return { error: 'Terlalu banyak pemanggilan webhook. Coba lagi dalam beberapa menit.', status: 429 };
  }
  return await runFunctionCode(DB, row, args);
}

// ===== CRUD (dipakai endpoint ini & tool chat AI) =====
export async function createFunction(DB, userKey, name, description, code, opts) {
  opts = opts || {};
  const isPublic = !!opts.is_public;
  name = String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!NAME_RE.test(name)) return { error: 'Nama function tidak valid: huruf kecil/angka/garis tengah, 2-40 karakter. Contoh: "cek-stok".' };
  code = String(code || '');
  if (!code.trim()) return { error: 'Kode function kosong.' };
  if (code.length > MAX_CODE) return { error: 'Kode terlalu panjang (maksimal 32KB).' };
  await ensureTable(DB);
  const now = new Date().toISOString();
  const origin = String(opts.origin || '');
  const existing = await getFn(DB, userKey, name);
  if (existing) {
    let secret = existing.webhook_secret;
    let pub = existing.is_public;
    if (isPublic && !pub) {
      pub = 1;
      secret = (crypto.randomUUID() || '').replace(/-/g, '') + Date.now().toString(36);
    } else if (isPublic && pub && !secret) {
      secret = (crypto.randomUUID() || '').replace(/-/g, '') + Date.now().toString(36);
    }
    await DB.prepare('UPDATE custom_functions SET description=?, code=?, is_public=?, webhook_secret=?, updated_at=? WHERE id=?')
      .bind(String(description || ''), code, pub || 0, secret || null, now, existing.id).run();
    const res = { ok: true, updated: true, name, url: '/api/fn/' + name, is_public: !!pub };
    if (pub && secret) res.webhook_url = (origin ? origin.replace(/\/$/, '') : '') + '/api/fn/' + name + '?key=' + secret;
    return res;
  }
  let secret = null;
  if (isPublic) secret = (crypto.randomUUID() || '').replace(/-/g, '') + Date.now().toString(36);
  const id = 'fn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await DB.prepare('INSERT INTO custom_functions (id, user_key, name, description, code, is_public, webhook_secret, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, userKey, name, String(description || ''), code, isPublic ? 1 : 0, secret, now, now).run();
  const res = { ok: true, created: true, name, url: '/api/fn/' + name, is_public: isPublic };
  if (isPublic && secret) res.webhook_url = (origin ? origin.replace(/\/$/, '') : '') + '/api/fn/' + name + '?key=' + secret;
  return res;
}
export async function listFunctions(DB, userKey, origin) {
  await ensureTable(DB);
  const { results } = await DB.prepare('SELECT * FROM custom_functions WHERE user_key = ? ORDER BY updated_at DESC LIMIT ?').bind(userKey, MAX_LIST).all();
  const base = origin ? String(origin).replace(/\/$/, '') : '';
  return { ok: true, functions: (results || []).map(r => {
    const j = fnJson(r);
    if (j.is_public && r.webhook_secret) j.webhook_url = base + '/api/fn/' + r.name + '?key=' + r.webhook_secret;
    return j;
  }) };
}
export async function deleteFunction(DB, userKey, name) {
  await ensureTable(DB);
  const row = await getFn(DB, userKey, name);
  if (!row) return { error: `Function "${name}" tidak ditemukan.` };
  await DB.prepare('DELETE FROM custom_functions WHERE id = ?').bind(row.id).run();
  return { ok: true, deleted: name };
}

// ===== HTTP handler =====
async function resolveUser(env, request) {
  try {
    const { initTables, getUserByToken, getToken } = await import('./auth/shared.js');
    await initTables(env.DB);
    const token = getToken(request);
    if (!token) return null;
    const u = await getUserByToken(env.DB, token);
    if (u) return { key: 'u' + u.id };
  } catch (e) {}
  return null;
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export async function onRequestGet({ request, env }) {
  const user = await resolveUser(env, request);
  if (!user) return json({ error: 'Login diperlukan', need_login: true }, 401);
  try { return json(await listFunctions(env.DB, user.key, new URL(request.url).origin)); }
  catch (e) { return json({ error: 'Server error: ' + e.message }, 500); }
}

export async function onRequestPost({ request, env }) {
  const user = await resolveUser(env, request);
  if (!user) return json({ error: 'Login diperlukan', need_login: true }, 401);
  let body = null;
  try { body = await request.json(); } catch (e) { return json({ error: 'Body JSON tidak valid' }, 400); }
  const action = body?.action || '';
  try {
    if (action === 'create' || action === 'update') return json(await createFunction(env.DB, user.key, body.name, body.description, body.code, { is_public: !!body.is_public, origin: new URL(request.url).origin }));
    if (action === 'list') return json(await listFunctions(env.DB, user.key, new URL(request.url).origin));
    if (action === 'delete') return json(await deleteFunction(env.DB, user.key, body.name));
    if (action === 'invoke') return json(await invokeFunction(env.DB, user.key, body.name, body.args));
    return json({ error: 'Action tidak dikenal: create|update|list|delete|invoke' }, 400);
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
}
