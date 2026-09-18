import { initTables, verifyPassword, publicUser, createSession, json, CORS } from './shared.js';

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }


// ---- CCTV: catat kejadian keamanan (login gagal / akun ditangguhkan) ----
async function logSecurity(db, type, email, ip, detail) {
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, ip TEXT, email TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')))");
    await db.prepare("INSERT INTO security_events (type, ip, email, detail) VALUES (?, ?, ?, ?)")
      .bind(type, ip || null, email || null, detail || null).run();
  } catch (e) { /* logging tidak boleh bikin login gagal */ }
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  try {
    await initTables(db);
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const user = await db.prepare('SELECT * FROM auth_users WHERE email = ?').bind(email).first();
    if (!user) { await logSecurity(db, 'login_failed', email, ip, 'Email tidak ditemukan'); return json({ error: 'Email atau kata sandi salah' }, 401); }
    if (user.status === 'suspended' || user.status === 'deleted') {
      await logSecurity(db, 'login_suspended', email, ip, 'Percobaan login ke akun ' + user.status);
      return json({ error: 'Akun dinonaktifkan', suspended: true }, 401);
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) { await logSecurity(db, 'login_failed', email, ip, 'Kata sandi salah'); return json({ error: 'Email atau kata sandi salah' }, 401); }
    const token = await createSession(db, user.id);
    try {
      await db.prepare('INSERT INTO activity_log (action, details, user_id) VALUES (?, ?, ?)')
        .bind('login', 'Login berhasil dari perangkat baru', user.id).run();
    } catch (e2) { /* aktivitas opsional */ }
    return json({
      success: true,
      token,
      user: { ...publicUser(user), role: user.role || 'user', status: user.status || 'active' }
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
