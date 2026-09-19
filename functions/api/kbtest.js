// PROBE SEMENTARA (hapus setelah verifikasi): tes apakah new Function jalan
// di runtime Cloudflare Pages milik Clinqoo.
export async function onRequestGet() {
  const out = { eval_ok: false, fetch_ok: false, articles: 0, error: null };
  try {
    const fn = new Function('window', 'window.countryDataFiles = { t: { articles: [{ id: "x" }] } }; return window.countryDataFiles;');
    const r = fn({});
    out.eval_ok = !!(r && r.t);
  } catch (e) { out.error = 'eval: ' + e.message; }
  try {
    const res = await fetch('https://blog.clincoo.buzz/loader.js');
    out.fetch_ok = res.ok;
  } catch (e) { out.error = (out.error ? out.error + ' | ' : '') + 'fetch: ' + e.message; }
  if (out.eval_ok && out.fetch_ok) {
    try {
      const m = await import('./blogsearch.js');
      const r = await m.searchClincooBlog({}, 'siapa pendiri clincoo');
      out.search_probe = r;
    } catch (e) { out.error = 'search: ' + e.message; }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
