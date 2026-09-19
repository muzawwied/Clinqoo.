// Cloudflare Pages Functions — Sinkronisasi Laporan User ke GitHub (real-time)
// POST /api/user-report-sync  {action:'sync'}  — wajib header x-cron-secret (CRON_SECRET)
//
// File tujuan: muzawwied/Clinqoo-Data/users-live.md (repo PRIVAT) — daftar user
// yang SELALU ter-update otomatis:
//   1. Real-time: hook di pendaftaran akun baru (register email + OAuth Google/GitHub)
//   2. Cron: functions/scheduled.js tiap 15 menit (menangkap perubahan lain:
//      upgrade paket, topup saldo, dsb.)
//   3. Manual: panggil endpoint ini dengan x-cron-secret
//
// Sengiku disimpan di env_vars D1: GITHUB_DATA_TOKEN (akses push repo Clinqoo-Data).

import { getSecret } from './notify-helpers.js';

const GH_REPO = 'muzawwied/Clinqoo-Data';
const GH_PATH = 'users-live.md';
const GH_BRANCH = 'main';

function b64utf8(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}

function rp(n) {
  const v = Number(n) || 0;
  return 'Rp' + v.toLocaleString('id-ID');
}

export async function syncUserReport(env, opts) {
  const db = env.DB;
  if (!db) return { ok: 0, error: 'D1 not bound' };
  const token = await getSecret(env, 'GITHUB_DATA_TOKEN');
  if (!token) return { ok: 0, error: 'GITHUB_DATA_TOKEN tidak tersedia di env_vars' };

  const timeoutMs = (opts && opts.timeoutMs) || 15000;
  const signal = AbortSignal.timeout(timeoutMs);

  const [usersR, oauthR, subsR, balR] = await Promise.all([
    db.prepare('SELECT id, name, email, password_hash, created_at FROM auth_users ORDER BY id').all(),
    db.prepare('SELECT user_id, provider FROM auth_oauth_accounts').all(),
    db.prepare("SELECT key, value FROM subscription WHERE key LIKE '%:plan'").all(),
    db.prepare("SELECT key, value FROM wallet_balance WHERE key LIKE '%:balance'").all()
  ]);
  const users = usersR.results || [];
  const provMap = {};
  (oauthR.results || []).forEach(o => {
    const k = String(o.user_id);
    (provMap[k] = provMap[k] || []).push(o.provider);
  });
  const planMap = {};
  (subsR.results || []).forEach(s => {
    const m = /^u(\d+):plan$/.exec(s.key || '');
    if (m) planMap[m[1]] = s.value;
  });
  const balMap = {};
  (balR.results || []).forEach(b => {
    const m = /^u(\d+):balance$/.exec(b.key || '');
    if (m) balMap[m[1]] = Number(b.value) || 0;
  });

  // ---- susun laporan markdown ----
  let oauthCount = 0, paidCount = 0, totalBal = 0;
  const rows = users.map(u => {
    const id = String(u.id);
    const provs = provMap[id] || [];
    const hasEmail = u.password_hash && u.password_hash !== '';
    const login = provs.length ? provs.join(', ') : 'email';
    if (provs.length) oauthCount++;
    const plan = planMap[id] || 'Gratis';
    if (planMap[id] && planMap[id] !== 'Gratis') paidCount++;
    const bal = balMap[id] || 0;
    totalBal += bal;
    const tgl = (u.created_at || '').slice(0, 10) || '-';
    return `| ${u.id} | ${(u.name || '-').replace(/\|/g, '/')} | ${(u.email || '-').replace(/\|/g, '/')} | ${login}${hasEmail && provs.length ? ' + email' : ''} | ${plan} | ${rp(bal)} | ${tgl} |`;
  });

  const now = new Date();
  const tglNow = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });
  let md = '# Data User Clincoo (Live)\n\n';
  md += `> Tersinkron otomatis dari database: langsung saat ada pendaftaran baru, plus tiap 15 menit (paket, saldo, dsb.).\n`;
  md += `> Terakhir diperbarui: ${tglNow}\n\n`;
  md += `**Total user: ${users.length}** | Login Google/GitHub: ${oauthCount} | Paket berbayar: ${paidCount} | Total saldo dompet: ${rp(totalBal)}\n\n`;
  md += '| ID | Nama | Email | Login | Paket | Saldo | Terdaftar |\n';
  md += '|----|------|-------|-------|-------|-------|-----------|\n';
  md += rows.join('\n') + '\n';

  // ---- push ke GitHub ----
  const ghHeaders = { 'Authorization': 'Bearer ' + token, 'User-Agent': 'clinqoo-sync', 'Accept': 'application/vnd.github+json' };
  const getRes = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_PATH + '?ref=' + GH_BRANCH, { headers: ghHeaders, signal });
  let sha = null;
  if (getRes.ok) {
    const j = await getRes.json();
    sha = j.sha || null;
  }
  const putBody = {
    message: 'sync: data user live (' + now.toISOString() + ')',
    content: b64utf8(md),
    branch: GH_BRANCH
  };
  if (sha) putBody.sha = sha;
  const putRes = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_PATH, {
    method: 'PUT', headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody), signal
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    return { ok: 0, error: 'GitHub ' + putRes.status + ': ' + t.slice(0, 200) };
  }
  return { ok: 1, users: users.length, sha: sha ? 'updated' : 'created' };
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = await getSecret(env, 'CRON_SECRET');
    if (!secret) return new Response(JSON.stringify({ error: 'cron not configured' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const provided = request.headers.get('x-cron-secret') || '';
    if (provided !== secret) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const r = await syncUserReport(env);
    return new Response(JSON.stringify(r), { status: r.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
