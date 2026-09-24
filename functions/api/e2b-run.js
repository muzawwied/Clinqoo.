// Cloudflare Pages Function — /api/e2b-run (PROXY eksekusi kode E2B di server)
// MENGGANTIKAN /api/e2b yang dulu mengembalikan E2B_API_KEY mentah ke browser
// (celah: key bisa dicopas user dan dipakai di luar platform).
// Alur: login wajib (middleware) → baca E2B_API_KEY dari D1 (tidak pernah
// dikirim ke klien) → buat sandbox via REST api.e2b.app → eksekusi lewat
// endpoint NDJSON /execute (X-Access-Token, token sesi sandbox) → hapus sandbox.
// Referensi protokol: e2b REST (create POST /sandboxes, execute di
// https://49999-<sandboxID>.<domain>/execute, delete DELETE /sandboxes/<id>).
//
// Bahasa: python dieksekusi langsung; javascript/java/c/cpp/php/ruby/go/rust
// dibungkus subprocess di dalam sandbox (tetap jalan, tanpa SDK klien).

import { initTables as initAuthTables, getUserByToken, getToken } from './auth/shared.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
const E2B_API_BASE = 'https://api.e2b.app';
const E2B_TEMPLATE = 'code-interpreter-v1';
const SANDBOX_TIMEOUT_S = 120;   // umur sandbox
const EXEC_TIMEOUT_S = 45;      // batas per eksekusi (subprocess)
const MAX_CODE_BYTES = 100_000; // 100 KB

const LANG_CMD = {
  javascript: { filename: 'main.js', run: 'node main.js' },
  js: { filename: 'main.js', run: 'node main.js' },
  java: { filename: 'Main.java', run: 'javac Main.java && java Main' },
  c: { filename: 'main.c', run: 'gcc main.c -o main && ./main' },
  cpp: { filename: 'main.cpp', run: 'g++ main.cpp -o main && ./main' },
  php: { filename: 'main.php', run: 'php main.php' },
  ruby: { filename: 'main.rb', run: 'ruby main.rb' },
  go: { filename: 'main.go', run: 'go run main.go' },
  rust: { filename: 'main.rs', run: 'rustc main.rs && ./main.rs' }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function resolveUser(env, request) {
  try {
    await initAuthTables(env.DB);
    const token = getToken(request);
    if (!token) return null;
    return await getUserByToken(env.DB, token);
  } catch (e) { return null; }
}

// Rate limit per user (D1, tahan lintas-isolate): 20 eksekusi / 5 menit
async function rateLimitUser(DB, userKey) {
  try {
    const window = Math.floor(Date.now() / (5 * 60 * 1000));
    await DB.prepare('CREATE TABLE IF NOT EXISTS rl_e2b (k TEXT PRIMARY KEY, c INTEGER DEFAULT 0)').run();
    const row = await DB.prepare('SELECT c FROM rl_e2b WHERE k = ?').bind(userKey + '|' + window).first();
    const count = (row?.c || 0) + 1;
    if (!row) await DB.prepare('INSERT INTO rl_e2b (k, c) VALUES (?, 1)').bind(userKey + '|' + window).run();
    else await DB.prepare('UPDATE rl_e2b SET c = ? WHERE k = ?').bind(count, userKey + '|' + window).run();
    if (count > 20) return false;
    if (count === 1) { // bersihkan jendela lama sesekali
      try { await DB.prepare("DELETE FROM rl_e2b WHERE k LIKE ?").bind(userKey + '|' + (window - 1) + '%').run(); } catch (e) {}
    }
  } catch (e) { /* jangan blokir karena DB gangguan */ }
  return true;
}

async function getE2bKey(DB) {
  try {
    const row = await DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('E2B_API_KEY').first();
    return row?.value || '';
  } catch (e) { return ''; }
}

// Baca seluruh NDJSON dan gabungkan stdout/stderr/error
function parseExecute(raw) {
  const out = { stdout: '', stderr: '', error: null, results: [] };
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let m; try { m = JSON.parse(t); } catch (e) { continue; }
    if (m.type === 'stdout') out.stdout += m.text || '';
    else if (m.type === 'stderr') out.stderr += m.text || '';
    else if (m.type === 'error') out.error = { name: m.name || 'Error', value: m.value || '', traceback: m.traceback || '' };
    else if (m.type === 'result') out.results.push({ text: m.text || '', data: m.data ? '<binary>' : undefined });
  }
  return out;
}

function wrapAsSubprocess(code, lang) {
  const info = LANG_CMD[lang] || { filename: 'main.txt', run: 'cat main.txt' };
  // kode user disandikan base64 supaya tidak bisa menyuntik skrip python pembungkus
  const b64 = btoa(unescape(encodeURIComponent(code)));
  return [
    "import base64, subprocess, sys",
    `code = base64.b64decode("${b64}").decode("utf-8")`,
    `open(${JSON.stringify(info.filename)}, "w").write(code)`,
    `p = subprocess.run(${JSON.stringify(info.run)}, shell=True, capture_output=True, text=True, timeout=${EXEC_TIMEOUT_S})`,
    "sys.stdout.write(p.stdout or '')",
    "sys.stderr.write(p.stderr or '')",
    "sys.exit(p.returncode)"
  ].join('\n');
}

function wrapCommand(cmd) {
  const b64 = btoa(unescape(encodeURIComponent(cmd)));
  return [
    "import base64, subprocess, sys",
    `cmd = base64.b64decode("${b64}").decode("utf-8")`,
    `p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=${EXEC_TIMEOUT_S})`,
    "sys.stdout.write(p.stdout or '')",
    "sys.stderr.write(p.stderr or '')",
    "sys.exit(p.returncode)"
  ].join('\n');
}

async function execInSandbox(apiKey, code) {
  // 1. Buat sandbox
  const createRes = await fetch(E2B_API_BASE + '/sandboxes', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateID: E2B_TEMPLATE, timeout: SANDBOX_TIMEOUT_S, secure: true, allow_internet_access: true })
  });
  if (!createRes.ok) {
    const t = await createRes.text().catch(() => '');
    return { error: 'Gagal membuat sandbox E2B (HTTP ' + createRes.status + '): ' + t.slice(0, 300) };
  }
  const sb = await createRes.json();
  const sandboxId = sb.sandboxID, domain = sb.domain || 'e2b.app';
  const accessToken = sb.envdAccessToken;
  const trafficToken = sb.trafficAccessToken;
  try {
    if (!sandboxId || !accessToken) return { error: 'Respons sandbox E2B tidak valid.' };
    // 2. Eksekusi (NDJSON)
    const execHeaders = { 'Content-Type': 'application/json', 'X-Access-Token': accessToken };
    if (trafficToken) execHeaders['E2B-Traffic-Access-Token'] = trafficToken;
    const execRes = await fetch(`https://49999-${sandboxId}.${domain}/execute`, {
      method: 'POST', headers: execHeaders,
      body: JSON.stringify({ code, context_id: null })
    });
    if (!execRes.ok) {
      const t = await execRes.text().catch(() => '');
      return { error: 'Eksekusi gagal (HTTP ' + execRes.status + '): ' + t.slice(0, 300) };
    }
    const parsed = parseExecute(await execRes.text());
    return parsed;
  } finally {
    // 3. Hapus sandbox (jangan biarkan berjalan = hemat biaya)
    try { await fetch(E2B_API_BASE + '/sandboxes/' + sandboxId, { method: 'DELETE', headers: { 'X-API-Key': apiKey } }); } catch (e) {}
  }
}

export async function onRequestPost({ request, env }) {
  const user = await resolveUser(env, request);
  if (!user) return json({ error: 'Login diperlukan', need_login: true }, 401);
  if (!env.DB) return json({ error: 'Database tidak tersedia' }, 500);

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const mode = String(body.mode || 'code');
  const language = String(body.language || 'python').toLowerCase();
  let code = String(body.code || '');

  if (mode === 'command') {
    const cmd = String(body.command || '');
    if (!cmd) return json({ error: 'Parameter command wajib.' }, 400);
    if (cmd.length > MAX_CODE_BYTES) return json({ error: 'Command terlalu panjang.' }, 400);
    code = wrapCommand(cmd);
  } else {
    if (!code) return json({ error: 'Parameter code wajib.' }, 400);
    if (code.length > MAX_CODE_BYTES) return json({ error: 'Kode terlalu panjang (maks 100KB).' }, 400);
    if (language !== 'python') code = wrapAsSubprocess(code, language);
  }

  if (!(await rateLimitUser(env.DB, 'u' + user.id))) {
    return json({ error: 'Terlalu banyak eksekusi. Coba lagi dalam beberapa menit.' }, 429);
  }

  const apiKey = await getE2bKey(env.DB);
  if (!apiKey) return json({ error: 'Eksekusi sandbox belum dikonfigurasi.' }, 503);

  // batas total waktu supaya request tidak menggantung
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Eksekusi melebihi 90 detik (timeout).')), 90_000));
  let result;
  try {
    result = await Promise.race([execInSandbox(apiKey, code), timeout]);
  } catch (e) {
    return json({ error: e && e.message ? e.message : 'Eksekusi gagal.' }, 504);
  }

  if (result.error && !('stdout' in result)) return json({ error: result.error }, 502);
  return json({
    ok: !result.error,
    stdout: String(result.stdout || '').slice(0, 50000),
    stderr: String(result.stderr || '').slice(0, 20000),
    error: result.error ? { name: result.error.name, value: String(result.error.value || '').slice(0, 2000) } : null,
    results: (result.results || []).slice(0, 5).map(r => ({ text: String(r.text || '').slice(0, 5000) }))
  });
}
