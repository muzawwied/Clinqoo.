// PROBE SEMENTARA (dihapus setelah diagnosis) — tidak membocorkan nilai key penuh.
const CORS = { 'Access-Control-Allow-Origin': '*' };
export async function onRequestPost({ request, env }) {
  const out = { has_env_key: false, table_keys: [], results: [] };
  const keys = [];
  const seen = new Set();
  const add = v => { v = String(v || '').trim(); if (v && !seen.has(v)) { seen.add(v); keys.push(v); } };
  if (env.GEMINI_API_KEY) { out.has_env_key = true; add(env.GEMINI_API_KEY); }
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM env_vars WHERE key IN ('GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3')").all();
    out.table_keys = (rows.results || []).map(r => r.key);
    for (const r of rows.results || []) add(r.value);
  } catch (e) { out.table_err = String(e).slice(0, 80); }
  out.total_keys = keys.length;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const info = { idx: i, prefix: k.slice(0, 6), len: k.length };
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'jawab: ok' }] }] })
      });
      info.status = res.status;
      if (!res.ok) info.body = (await res.text().catch(() => '')).slice(0, 180);
    } catch (e) { info.fetch_err = String(e).slice(0, 100); }
    out.results.push(info);
  }
  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}
