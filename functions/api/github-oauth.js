// Cloudflare Pages Functions - GitHub OAuth token exchange
// Reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET from D1 database.
// Exchanges an OAuth authorization code for an access token.
// Gate paket: impor repository GitHub = fitur Pro & Bisnis (sesuai klaim kartu paket).
import { currentUser } from './user-scope.js';
import { getEffectivePlan, ADMIN_EMAILS } from './plan-helpers.js';

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

async function getSecrets(env) {
  // 1) Cloudflare Pages environment variables (highest priority)
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    return { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }
  if (!env.DB) return { clientId: '', clientSecret: '' };
  try {
    let clientId = '';
    let clientSecret = '';
    // 2) Global env_vars table
    const idRow = await env.DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('GITHUB_CLIENT_ID').first();
    const secretRow = await env.DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('GITHUB_CLIENT_SECRET').first();
    if (idRow?.value) clientId = idRow.value;
    if (secretRow?.value) clientSecret = secretRow.value;
    // 3) Fallback: any per-project env_vars table (set via the app's Environment page)
    if (!clientId || !clientSecret) {
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'p\_%\_env\_vars'"
      ).all();
      for (const t of tables.results || []) {
        if (clientId && clientSecret) break;
        if (!clientId) {
          const r = await env.DB.prepare('SELECT value FROM ' + t.name + ' WHERE key = ?').bind('GITHUB_CLIENT_ID').first();
          if (r?.value) clientId = r.value;
        }
        if (!clientSecret) {
          const r = await env.DB.prepare('SELECT value FROM ' + t.name + ' WHERE key = ?').bind('GITHUB_CLIENT_SECRET').first();
          if (r?.value) clientSecret = r.value;
        }
      }
    }
    return { clientId, clientSecret };
  } catch {
    return { clientId: '', clientSecret: '' };
  }
}

export async function onRequestPost({ request, env }) {
  try {
    // Gate paket — harus login Clinqoo & minimal paket Pro (admin bypass)
    const user = await currentUser(env, request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Silakan login Clinqoo terlebih dahulu untuk menghubungkan GitHub.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    if (!ADMIN_EMAILS.has(String(user.email || '').toLowerCase())) {
      const eff = await getEffectivePlan(env.DB, user);
      if (eff.plan === 'Starter') {
        return new Response(JSON.stringify({
          error: 'Impor repository GitHub tersedia di paket Pro & Bisnis. Upgrade paket di halaman Langganan untuk mengaktifkan fitur ini.',
          upgrade_needed: true
        }), {
          status: 402,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    const { clientId, clientSecret } = await getSecrets(env);
    if (!clientId || !clientSecret) {
      const missing = !clientId && !clientSecret ? 'Client ID dan Client Secret'
        : (!clientId ? 'Client ID' : 'Client Secret');
      return new Response(JSON.stringify({ error: 'Kredensial GitHub OAuth belum lengkap: ' + missing + ' belum diatur' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const body = await request.json();
    const code = body.code;
    if (!code) {
      return new Response(JSON.stringify({ error: 'Authorization code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const redirectUri = body.redirect_uri || '';

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {})
      })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      return new Response(JSON.stringify({ error: tokenData.error || 'Failed to get access token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
