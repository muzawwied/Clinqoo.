// Cloudflare Pages Functions - Web reader & search (Jina + fallback keyless)
// Kalau JINA_API_KEY ada di D1 -> pakai Jina (r.jina.ai / s.jina.ai).
// Kalau TIDAK ada -> fallback TANPA API key (tetap jalan, bukan error):
//   - read   : fetch langsung URL + ekstraksi teks sederhana (HTML -> text)
//   - search : DuckDuckGo HTML hasil di-parse jadi format yang sama dengan Jina
// Bentuk respons TIDAK berubah: { text } untuk read, { data: [...] } untuk search.

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

async function getApiKey(env) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT value FROM env_vars WHERE key = ?').bind('JINA_API_KEY').first();
    return row?.value || null;
  } catch {
    return null;
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function htmlToText(html) {
  let t = String(html || '');
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
       .replace(/<style[\s\S]*?<\/style>/gi, ' ')
       .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
       .replace(/<!--[\s\S]*?-->/g, ' ')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
       .replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
       .replace(/[ \t]+/g, ' ')
       .replace(/\n\s*\n\s*\n+/g, '\n\n')
       .trim();
  return t;
}

// Fallback read tanpa API key: fetch langsung + HTML -> teks
async function readDirect(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000)
  });
  if (!res.ok) throw new Error('Gagal membaca URL (HTTP ' + res.status + ')');
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const body = await res.text();
  if (ct.indexOf('html') !== -1 || /^\s*<(!doctype|html)/i.test(body)) {
    // ambil <title> kalau ada, lalu teks
    let title = '';
    const tm = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tm) title = htmlToText(tm[1]);
    const text = (title ? title + '\n\n' : '') + htmlToText(body);
    return text.slice(0, 60_000);
  }
  return body.slice(0, 60_000);
}

// Fallback search tanpa API key: DuckDuckGo HTML
async function searchDdg(query) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!res.ok) throw new Error('Pencarian gagal (HTTP ' + res.status + ')');
  const html = await res.text();
  const out = [];
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 8) {
    let href = m[1];
    try { href = decodeURIComponent(href); } catch (e) {}
    // DDG link redirect: //duckduckgo.com/l/?uddg=<url>&...
    let url = href;
    const um = href.match(/[?&]uddg=([^&]+)/);
    if (um) { try { url = decodeURIComponent(um[1]); } catch (e) {} }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
    out.push({ title: htmlToText(m[2]), url: url, content: '' });
  }
  // snippet hasil
  const sre = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let i = 0, sm;
  while ((sm = sre.exec(html)) && i < out.length) { out[i].content = htmlToText(sm[1]).slice(0, 400); i++; }
  return out;
}

export async function onRequestPost({ request, env }) {
  try {
    const JINA_API_KEY = await getApiKey(env);
    const body = await request.json();
    const mode = body.mode || 'read';
    const query = body.query || '';

    if (mode === 'read') {
      if (!/^https?:\/\//i.test(String(query))) {
        return new Response(JSON.stringify({ error: 'Parameter query wajib berupa URL http/https.' }), {
          status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      if (JINA_API_KEY) {
        try {
          const res = await fetch('https://r.jina.ai/' + query, {
            headers: { 'Authorization': 'Bearer ' + JINA_API_KEY, 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' },
            signal: AbortSignal.timeout(20_000)
          });
          if (res.ok) {
            const text = await res.text();
            return new Response(JSON.stringify({ text: text.slice(0, 60_000), via: 'jina' }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        } catch (e) { /* lanjut ke fallback */ }
      }
      // Fallback tanpa API key — bukan error lagi
      try {
        const text = await readDirect(query);
        return new Response(JSON.stringify({ text, via: 'direct' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Gagal membaca halaman: ' + (e.message || e) }), {
          status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    } else {
      if (!String(query).trim()) {
        return new Response(JSON.stringify({ error: 'Parameter query wajib.' }), {
          status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      if (JINA_API_KEY) {
        try {
          const res = await fetch('https://s.jina.ai/' + encodeURIComponent(query), {
            headers: { 'Authorization': 'Bearer ' + JINA_API_KEY, 'Accept': 'application/json', 'X-Respond-With': 'no-content' },
            signal: AbortSignal.timeout(20_000)
          });
          if (res.ok) {
            const data = await res.json();
            return new Response(JSON.stringify({ data: data, via: 'jina' }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        } catch (e) { /* lanjut ke fallback */ }
      }
      // Fallback DuckDuckGo tanpa API key — bukan error lagi
      try {
        const results = await searchDdg(query);
        return new Response(JSON.stringify({ data: results, via: 'duckduckgo' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Pencarian gagal: ' + (e.message || e) }), {
          status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
