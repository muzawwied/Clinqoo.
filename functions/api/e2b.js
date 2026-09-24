// Cloudflare Pages Function — /api/e2b (DIPENSIUNKAN)
// Keamanan: endpoint ini dulu mengembalikan E2B_API_KEY mentah ke browser
// sehingga key bisa dicopas dan dipakai di luar platform. Eksekusi kode kini
// di-proxy di server lewat /api/e2b-run (key tidak pernah dikirim ke klien).
// Respons lama tetap berbentuk {apiKey} (nilai kosong) supaya klien versi
// lama yang masih memanggil jatuh mulus ke fallback Piston.

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function onRequestGet({ env }) {
  // catat percobaan akses untuk pemantauan (jika D1 tersedia)
  try {
    if (env && env.DB) {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, ip TEXT, email TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')))")
        .run();
      await env.DB.prepare('INSERT INTO security_events (type, detail) VALUES (?, ?)').bind('e2b_key_endpoint_deprecated', 'klien lama masih meminta /api/e2b').run();
    }
  } catch (e) { /* jangan ganggu respons */ }
  return new Response(JSON.stringify({ apiKey: '' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
