// Cloudflare Pages Function — GET /api/promo
// Promo 100 User Pertama: 100 user pertama yang klaim dapat Paket Pro hanya Rp5.000/bulan
// (reguler Rp49.000, Bulanan saja). Kuota disimpan di tabel promo_early_pro
// (1 baris/user — PRIMARY KEY mencegah klaim ganda; counter = COUNT(*), max 100).
// Klaim slot dicatat SAAT checkout sukses (subscription.js) dengan cleanup bila pembayaran gagal.
import { currentUser } from './user-scope.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

export const PROMO_EARLY = { plan: 'Pro', billing: 'Bulanan', price: 5000, original: 49000, maxUsers: 100 };

export async function ensurePromoTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS promo_early_pro (user_key TEXT PRIMARY KEY, claimed_at TEXT)').run();
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export async function onRequestGet({ request, env }) {
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  try {
    await ensurePromoTable(db);
    const cnt = await db.prepare('SELECT COUNT(*) AS c FROM promo_early_pro').first();
    const claimed = (cnt && cnt.c) || 0;
    const remaining = Math.max(0, PROMO_EARLY.maxUsers - claimed);
    const user = await currentUser(env, request);
    const userKey = user ? ('u' + user.id) : null;
    let hasClaimed = false;
    if (userKey) {
      const row = await db.prepare('SELECT 1 FROM promo_early_pro WHERE user_key = ?').bind(userKey).first();
      hasClaimed = !!row;
    }
    return json({
      success: true,
      active: true,
      name: 'Promo 100 User Pertama',
      plan: PROMO_EARLY.plan,
      billing: PROMO_EARLY.billing,
      price: PROMO_EARLY.price,
      original: PROMO_EARLY.original,
      total: PROMO_EARLY.maxUsers,
      claimed,
      remaining,
      loggedIn: !!userKey,
      hasClaimed,
      eligible: !!(userKey && !hasClaimed && remaining > 0)
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
