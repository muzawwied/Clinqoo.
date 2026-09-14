import { initTables, getUserByToken, getToken, publicUser, json, CORS } from './shared.js';

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  try {
    await initTables(db);
    const user = await getUserByToken(db, getToken(request));
    if (user && (user.status === 'suspended' || user.status === 'deleted')) {
      return json({ error: 'Akun dinonaktifkan', suspended: true }, 401);
    }
    const userObj = user ? { ...publicUser(user), role: user.role || 'user', status: user.status || 'active' } : null;
    return json({ authenticated: !!user, user: userObj });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
