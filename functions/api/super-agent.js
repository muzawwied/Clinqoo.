// Clinqoo Super Agent v2
// Orchestrates a durable multi-role pipeline on top of the existing agent_tasks/AGENT_FLOW.
// POST /api/super-agent { action:'start', goal, project_id?, budget_seconds? }
// GET  /api/super-agent?task_id=... -> status + events
//
// The endpoint intentionally reuses the existing durable Agent Worker instead of creating
// a second execution engine. This keeps retries/resume semantics in one place.

import { currentUser } from './user-scope.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const DAILY_LIMIT = 25;
const ADMIN_DAILY_LIMIT = 500;
const ADMIN_EMAILS = new Set(['muzawwied@gmail.com']);
const MAX_GOAL = 12000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function quotaSpend(db, user, cost = 1) {
  const day = new Date().toISOString().slice(0, 10);
  const limit = ADMIN_EMAILS.has(String(user.email || '').toLowerCase())
    ? ADMIN_DAILY_LIMIT : DAILY_LIMIT;
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_quota (
    user_key TEXT, day TEXT, count INTEGER,
    PRIMARY KEY (user_key, day)
  )`).run();
  const row = await db.prepare(
    'SELECT count FROM ai_quota WHERE user_key = ? AND day = ?'
  ).bind(user.key, day).first();
  const current = Number(row?.count || 0);
  if (current + cost > limit) return false;
  await db.prepare(`INSERT INTO ai_quota (user_key, day, count)
    VALUES (?, ?, ?)
    ON CONFLICT(user_key, day) DO UPDATE SET count = count + ?`
  ).bind(user.key, day, cost, cost).run();
  return true;
}

function superPlan(goal) {
  return [
    {
      title: 'Strategist — pahami tujuan dan definisikan acceptance criteria',
      detail: `Peran STRATEGIST. Uraikan tujuan pengguna menjadi masalah yang harus diselesaikan. Tetapkan output final yang konkret, asumsi yang dipakai, batasan, risiko, dan acceptance criteria. Tujuan asli: ${goal}`
    },
    {
      title: 'Researcher — kumpulkan fakta, opsi, dan pendekatan',
      detail: `Peran RESEARCHER. Gunakan pengetahuan model yang tersedia untuk mengumpulkan fakta relevan, alternatif solusi, dependensi, dan trade-off. Jangan mengarang sumber atau fakta terbaru. Tandai bagian yang perlu verifikasi eksternal. Tujuan asli: ${goal}`
    },
    {
      title: 'Builder — susun solusi yang dapat langsung dipakai',
      detail: `Peran BUILDER/CODER. Berdasarkan strategi dan hasil research sebelumnya, bangun solusi konkret. Jika berupa software, berikan arsitektur, struktur file, kode siap pakai, konfigurasi, dan langkah implementasi. Jika bukan software, hasilkan deliverable final yang sesuai. Hindari placeholder yang tidak perlu. Tujuan asli: ${goal}`
    },
    {
      title: 'Reviewer — audit hasil dan perbaiki kelemahan',
      detail: `Peran REVIEWER/CRITIC. Audit semua hasil sebelumnya terhadap acceptance criteria. Cari bug, asumsi lemah, kontradiksi, keamanan, edge case, dan bagian yang belum selesai. Lakukan perbaikan konkret; jangan hanya memberi kritik. Tujuan asli: ${goal}`
    },
    {
      title: 'Finalizer — satukan hasil menjadi deliverable final',
      detail: `Peran FINALIZER. Satukan hasil terbaik dari seluruh peran menjadi output final yang koheren. Pastikan acceptance criteria terpenuhi, beri instruksi penggunaan yang jelas, dan nyatakan apa yang masih memerlukan verifikasi manusia. Tujuan asli: ${goal}`
    }
  ];
}

function taskJson(t) {
  return {
    id: t.id,
    project_id: t.project_id,
    goal: t.goal,
    status: t.status,
    plan: typeof t.plan === 'string' ? JSON.parse(t.plan || '[]') : (t.plan || []),
    current_step: Number(t.current_step || 0),
    result: t.result || null,
    error: t.error || null,
    created_at: t.created_at,
    updated_at: t.updated_at
  };
}

async function loadTask(db, id, userKey) {
  return db.prepare(
    'SELECT * FROM agent_tasks WHERE id = ? AND user_key = ?'
  ).bind(id, userKey).first();
}

export async function onRequestGet({ env, request }) {
  const user = await currentUser(env, request);
  if (!user) return json({ error: 'Login diperlukan', need_login: true }, 401);
  const id = new URL(request.url).searchParams.get('task_id') || '';
  if (!id) return json({ error: 'task_id wajib' }, 400);
  try {
    const t = await loadTask(env.DB, id, 'u' + user.id);
    if (!t) return json({ error: 'Task tidak ditemukan' }, 404);
    const events = await env.DB.prepare(
      'SELECT kind, text, created_at FROM agent_events WHERE task_id = ? AND user_key = ? ORDER BY id ASC LIMIT 100'
    ).bind(id, 'u' + user.id).all();
    return json({ ok: true, task: taskJson(t), events: events.results || [] });
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const user0 = await currentUser(env, request);
  if (!user0) return json({ error: 'Login diperlukan', need_login: true }, 401);
  const user = { id: user0.id, key: 'u' + user0.id, email: user0.email };

  const body = await request.json().catch(() => null);
  if (!body || body.action !== 'start') {
    return json({ error: 'action harus start' }, 400);
  }

  const goal = String(body.goal || '').trim();
  if (goal.length < 3) return json({ error: 'Tujuan minimal 3 karakter.' }, 400);
  if (goal.length > MAX_GOAL) return json({ error: 'Tujuan terlalu panjang.' }, 400);

  if (!(await quotaSpend(env.DB, user, 1))) {
    return json({
      quota_exhausted: true,
      error: 'Kuota AI Clinqoo hari ini sudah habis.'
    }, 429);
  }

  const projectId = String(body.project_id || '').trim() || null;
  if (projectId) {
    const project = await env.DB.prepare(
      'SELECT id FROM user_projects WHERE id = ? AND user_id = ?'
    ).bind(projectId, user.id).first();
    if (!project) return json({ error: 'Proyek tidak ditemukan atau bukan milik Anda.' }, 403);
  }

  const now = new Date().toISOString();
  const id = 'sup_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const plan = superPlan(goal).map(x => ({ ...x, done: false }));

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY, user_key TEXT, project_id TEXT, goal TEXT,
    status TEXT, plan TEXT, transcript TEXT, current_step INTEGER DEFAULT 0,
    result TEXT, error TEXT, created_at TEXT, updated_at TEXT
  )`).run();

  await env.DB.prepare(`INSERT INTO agent_tasks
    (id,user_key,project_id,goal,status,plan,transcript,current_step,result,error,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, user.key, projectId, goal, 'queued', JSON.stringify(plan), '[]', 0,
    null, null, now, now
  ).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS agent_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT, user_key TEXT, kind TEXT, text TEXT, created_at TEXT
  )`).run();
  await env.DB.prepare(
    'INSERT INTO agent_events (task_id,user_key,kind,text,created_at) VALUES (?,?,?,?,?)'
  ).bind(id, user.key, 'super_queued', 'Super Agent v2 masuk antrean: Strategist → Researcher → Builder → Reviewer → Finalizer.', now).run();

  return json({
    ok: true,
    background: true,
    task: taskJson({
      id, project_id: projectId, goal, status: 'queued', plan,
      current_step: 0, result: null, error: null, created_at: now, updated_at: now
    }),
    message: 'Super Agent masuk antrean. Existing Agent Worker akan menjalankan pipeline secara durable.'
  });
}
