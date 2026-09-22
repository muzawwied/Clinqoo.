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

// ---------- GET: OAuth redirect-dance untuk konektor di domain luar ----------
// Pola yang sama dengan exchange lama (base44), tapi pakai client ID/secret AKTIF
// Clincoo. GitHub -> GET /api/github-oauth?code=...&redirect_uri=<halaman konektor>
// -> tukar code jadi token -> 302 balik ke halaman konektor dengan ?gh_token=...
function ghAllowedRedirect(u) {
  try {
    const h = new URL(u).hostname;
    return h === 'muzawwied.github.io' || h.endsWith('.clincoo.buzz') ||
           h.endsWith('.pages.dev') || h === 'localhost' || h === '127.0.0.1';
  } catch { return false; }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const back = (params) => {
    if (!ghAllowedRedirect(redirectUri)) return new Response('redirect_uri tidak diizinkan', { status: 400 });
    const sep = redirectUri.includes('?') ? '&' : '?';
    return new Response(null, { status: 302, headers: { Location: redirectUri + sep + params } });
  };

  const oauthErr = url.searchParams.get('error');
  if (oauthErr) return back('error=' + encodeURIComponent(oauthErr) + '&description=' + encodeURIComponent(url.searchParams.get('error_description') || ''));

  const code = url.searchParams.get('code');
  if (!code || !redirectUri) return new Response('code dan redirect_uri wajib', { status: 400 });

  try {
    const { clientId, clientSecret } = await getSecrets(env);
    if (!clientId || !clientSecret) return back('error=config&description=' + encodeURIComponent('Kredensial GitHub OAuth belum diatur'));

    const exchangeRedirectUri = url.origin + url.pathname + '?redirect_uri=' + encodeURIComponent(redirectUri);
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: exchangeRedirectUri })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return back('error=exchange&description=' + encodeURIComponent(tokenData.error || 'gagal menukar code'));
    }
    const token = tokenData.access_token;
    let user = { login: 'github-user' };
    try {
      const u = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'clincoo-connector', Accept: 'application/vnd.github+json' } });
      const ud = await u.json();
      if (ud && ud.login) user = { login: ud.login, name: ud.name || ud.login, avatar_url: ud.avatar_url || '', public_repos: ud.public_repos || 0 };
    } catch (e) {}
    return back('gh_token=' + encodeURIComponent(token) + '&gh_user=' + encodeURIComponent(JSON.stringify(user)));
  } catch (err) {
    return back('error=server&description=' + encodeURIComponent(err.message || 'kesalahan server'));
  }
}

export async function onRequestPost({ request, env }) {
  try {
    // Gate paket — harus login Clincoo & minimal paket Pro (admin bypass)
    const user = await currentUser(env, request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Silakan login Clincoo terlebih dahulu untuk menghubungkan GitHub.' }), {
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
