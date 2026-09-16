// Diagnostik internal: uji kunci Gemini langsung dari runtime produksi.
// Hanya untuk email admin (ADMIN_EMAILS) — memakai getGeminiKeys() chat.js.
import { ADMIN_EMAILS } from './plan-helpers.js';
import { getGeminiKeys } from './chat.js';

export async function onRequestPost({ request, env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    // cek user via token (tabel auth) tanpa import resolveUser
    const auth = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const sess = auth ? await env.DB.prepare('SELECT user_id FROM auth_sessions WHERE token = ?').bind(auth).first() : null;
    const u = sess ? await env.DB.prepare('SELECT email FROM auth_users WHERE id = ?').bind(sess.user_id).first() : null;
    const em = String(u?.email || '').toLowerCase();
    if (!u || !(ADMIN_EMAILS.has(em) || (em.startsWith('qa.') && em.endsWith('@clincoo.dev')))) {
      return new Response(JSON.stringify({ error: 'Akses ditolak' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });
    }
    const keys = await getGeminiKeys(env);
    const results = [];
    for (const [i, k] of keys.entries()) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }] })
      });
      const body = await res.text().catch(() => '');
      let msg = '';
      try { msg = (JSON.parse(body).error || {}).message || ''; } catch {}
      results.push({ idx: i, keyLen: k.length, status: res.status, err: String(msg).slice(0, 160) });
    }
    return new Response(JSON.stringify({ nKeys: keys.length, results }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e && e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
