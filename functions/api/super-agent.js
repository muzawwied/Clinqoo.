// Cloudflare Pages Function — /api/super-agent
// Backend-only Super Agent facade. Frontend is intentionally untouched.
// Reuses the existing /api/agent durable engine so auth, quota, retries,
// persistence and Cloudflare Worker/Workflow execution stay in one place.
//
// POST /api/super-agent
//   { action: 'start', goal, project_id?, budget_seconds? }
// GET /api/super-agent?task_id=...
// POST /api/super-agent { action: 'resume', task_id, budget_seconds? }

import { onRequestPost as agentPost, onRequestGet as agentGet } from './agent.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function buildSuperGoal(goal) {
  return [
    'SUPER AGENT MODE — ORKESTRASI MULTI-ROLE.',
    '',
    'Tujuan utama pengguna:',
    goal,
    '',
    'Kerjakan sebagai satu pipeline autonomous dengan lima peran berikut secara berurutan:',
    '1. STRATEGIST: pahami tujuan, constraint, acceptance criteria, risiko, dan rencana eksekusi.',
    '2. RESEARCHER: kumpulkan fakta/opsi yang relevan, cek dependensi, tandai informasi yang perlu verifikasi dan jangan mengarang sumber.',
    '3. BUILDER: hasilkan implementasi/deliverable konkret yang siap dipakai. Untuk software, sertakan arsitektur, struktur file, konfigurasi, dan kode lengkap yang diperlukan.',
    '4. REVIEWER: audit hasil terhadap acceptance criteria, cari bug, security issue, edge case, kontradiksi, dan lakukan perbaikan konkret.',
    '5. FINALIZER: satukan hasil terbaik menjadi deliverable final yang koheren, ringkas, dan siap digunakan.',
    '',
    'ATURAN ORKESTRASI:',
    '- Setiap fase harus menggunakan hasil fase sebelumnya.',
    '- Jangan berhenti hanya karena satu pendekatan gagal; cari alternatif yang masuk akal.',
    '- Jangan mengklaim tindakan eksternal sudah dilakukan jika memang belum dilakukan.',
    '- Jangan mengarang hasil tool, sumber, angka, atau file.',
    '- Jika pekerjaan membutuhkan tindakan yang tidak tersedia pada backend agent, keluarkan instruksi/artefak yang paling konkret dan tandai keterbatasannya.',
    '- Simpan konteks penting dari fase sebelumnya dalam transcript agar task dapat di-resume.',
    '- Jawaban final harus menyebutkan apa yang selesai, apa yang belum, dan verifikasi yang masih diperlukan.',
    '',
    'Jalankan pipeline ini secara autonomous; pengguna tidak perlu memberi instruksi per fase.'
  ].join('\n');
}

async function readJson(response) {
  try { return await response.clone().json(); } catch { return null; }
}

export async function onRequestPost({ env, request }) {
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Body JSON tidak valid' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }

  if (body?.action === 'start') {
    const goal = String(body.goal || '').trim();
    if (goal.length < 3) return new Response(JSON.stringify({ error: 'Tulis tujuan tugas (minimal 3 karakter).' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    if (goal.length > 12000) return new Response(JSON.stringify({ error: 'Tujuan terlalu panjang (maksimal 12.000 karakter).' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

    // Delegasikan ke engine agent yang sudah dipakai Clinqoo.
    // Ini sengaja tidak membuat tabel/kuota/worker kedua.
    const forwarded = new Request(request.url.replace('/api/super-agent', '/api/agent'), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        action: body.background === false ? 'start' : 'start_bg',
        goal: buildSuperGoal(goal),
        project_id: body.project_id || undefined,
        budget_seconds: body.budget_seconds || undefined,
        wa_number: body.wa_number || undefined
      })
    });
    return withCors(await agentPost({ env, request: forwarded }));
  }

  if (body?.action === 'resume' || body?.action === 'status') {
    return withCors(await agentPost({ env, request }));
  }

  return new Response(JSON.stringify({
    error: 'action harus start, resume, atau status'
  }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export async function onRequestGet({ env, request }) {
  // Status task Super Agent menggunakan task store /api/agent yang sama.
  return withCors(await agentGet({ env, request }));
}
