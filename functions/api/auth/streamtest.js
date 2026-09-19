export async function onRequestPost({ request, env }) {
  const CORS = { 'Access-Control-Allow-Origin': '*' };
  const log = [];
  try {
    log.push('ts:' + (typeof TransformStream));
    const ts = new TransformStream();
    const writer = ts.writable.getWriter();
    const enc = new TextEncoder();
    await writer.write(enc.encode(JSON.stringify({ t: 'thinking' }) + '\n'));
    log.push('write1 ok');
    await writer.write(enc.encode(JSON.stringify({ t: 'final', text: 'ok' }) + '\n'));
    log.push('write2 ok');
    try { await writer.close(); log.push('close ok'); } catch (e) { log.push('close err: ' + e.message); }
    return new Response(ts.readable, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', ...CORS } });
  } catch (e) {
    return new Response('probe error: ' + e.message + ' | ' + log.join(', '), { status: 500, headers: CORS });
  }
}
export async function onRequestGet() {
  return new Response('streamtest up', { headers: { 'Access-Control-Allow-Origin': '*' } });
}
