# Clinqoo Agent Wiki & Collaboration Board

Halaman ini berfungsi sebagai **wiki ringan** dan papan komunikasi antar agent (Grok, AI lain, human operator) yang bekerja di ekosistem Clinqoo.

> **Aturan**: Setiap agent **wajib** membaca file ini di awal sesi dan meng-update status setelah bekerja.

---

## Cara Interaksi Antar Agent

1. **Baca** file ini dulu sebelum mulai kerja.
2. **Tulis** status / temuan / rekomendasi di bagian yang sesuai.
3. Gunakan format tanggal + nama agent.
4. Jika ada bug kritis, sebutkan file + fungsi + impact.
5. Setelah fix, centang item dan catat commit SHA jika memungkinkan.

### Channel lain yang tersedia
- GitHub Issues di repo `muzawwied/Clinqoo.`
- Automation hourly audit (taskId: `d0562740-c5bd-4743-b98d-8c2d3dcf4077`)
- Email laporan: **muzawwied@gmail.com** (satu-satunya alamat resmi; gmaio.com adalah typo)
- MCP / Clinqoo connector tools (list_repos, read_file, write_file, dll)
- Automation Report to AGENTS.md (taskId: `db0bb063-107c-4fb5-92be-fdb29e0e5ba6`)
- Automation Tingkatkan Kualitas AI Clinqoo (setiap 60 menit WIB) — aktif `168d5135`; duplikat `850559af` di-pause

---

## Status Saat Ini (update terakhir: 2026-09-17 23:15 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` (GitHub MCP untuk semua agent) dan `/rpc` hidup dari `functions/{mcp.js,rpc.js}`.

**JANGAN deploy statis murni dari root repo** — itu MENGHAPUS endpoint `/mcp` (gejala: POST /mcp → 405) dan otomatis semua agent kehilangan akses GitHub.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/{mcp.js,rpc.js}` (sumber: snapshot deploy terakhir — JANGAN overwrite tanpa koordinasi)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (butuh Node 22; token akun Vylonium)
5. Jika error `D1 binding 'DB' ... not found`: binding basi muncul lagi — hapus via `PATCH /accounts/<acc>/pages/projects/clinqoo` body `{"deployment_configs":{"production":{"d1_databases":{"DB":null}}}}`, lalu deploy ulang. JANGAN pernah menambahkan binding D1 ke project ini (database 49b6fed3 bukan milik akun ini).
6. Verifikasi pasca-deploy: `POST https://clinqoo.pages.dev/mcp` (Bearer key) harus balas JSON-RPC `initialize`, bukan 405/404.

Untuk proyek lain: `clinqoo-editor` deploy manual dari repo Clinqoo-Editor; backend API (clincoo-be2) hanya lewat GitHub Actions deploy.yml — jangan pernah deploy statis ke sana.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | INSERT + guard null + emailNorm + last_row_id (`4ff816e`). Live di clincoo-be2. Diverifikasi ulang 23:15. |
| Halaman `/auth/` | OK (terverifikasi) | E2E smoke: redirect Google & GitHub ke gerbang OAuth OK |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string baru di subscription.js (`5c7d317`); runtime tidak terpengaruh |
| Schema D1 vs runtime | OK | |
| Editor full-stack | OK | HEAD `6e4d516` |
| AI chat / Tim AI | Backlog + 1 bug agent | Dual-mode (17:39) + loop/SSOT/maxOutputTokens/Doctor Deploy (18:05) masih terbuka. **19:23**: `write_file` overwrite-only; Workers AI fallback tanpa tools; **BUG** `agent.js` `aiCall(doneMsgs, …)` tanpa `env` — belum di-fix jam ini. |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | OK (docs) | Aturan functions/{mcp.js,rpc.js} |
| Wallet / langganan | OK — fix urutan tx | `5c7d317` catat wallet_transactions setelah potongan berhasil |
| Middleware | OK | Clinqoo connector tools berfungsi |
| Hourly audit automation | OK | Audit 23:15: All clear (tidak kirim email) |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | Tidak berubah jam ini |
| Clinqoo-Data | OK | Sync rutin `0fb49bd` 16:15Z |
| Landing | OK | HEAD `21d4481` — tidak berubah jam ini |

**All clear (jam ini)** — tidak ada commit kode baru di Clinqoo./Editor/Landing/Wallet sejak audit 22:06. Hanya docs `3dbb332` + sync Data. OAuth tetap FIXED. Bug `aiCall` di `agent.js` + backlog AI 17:39/18:05/19:23 **masih terbuka** (sudah dilaporkan; tidak diulang email). Issue/PR 0. Deploy run 280 (`3dbb332`) success.

---

## Log Interaksi Agent

### 2026-09-17 23:15 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `3dbb332` (docs hourly audit 22:06 All clear).
- Sejak audit 22:06: hanya docs di Clinqoo. Tidak ada commit kode auth/wallet/schema/middleware.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), kode di `functions/api/auth/shared.js` masih aman.
- Bug `aiCall` tanpa `env` di `functions/api/agent.js` **masih ada** (sudah dilaporkan 19:23).
- Editor `6e4d516`. Landing `21d4481`. Data sync `0fb49bd` 16:15Z. Issue/PR open: 0. Deploy run 280 success.
- Status: **All clear**. Tidak kirim email.

### 2026-09-17 22:06 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `9d1dd40` (docs hourly audit 21:21 All clear).
- Sejak audit 21:21: hanya docs di Clinqoo. Tidak ada commit kode auth/wallet/schema/middleware.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), kode di `functions/api/auth/shared.js` masih aman.
- Bug `aiCall` tanpa `env` di `functions/api/agent.js` **masih ada** (sudah dilaporkan 19:23).
- Editor `6e4d516`. Landing tidak berubah. Blog konten `e9ebb59`. Data sync `33e74cb` 15:00Z. Issue/PR open: 0. Deploy run 279 success.
- Status: **All clear**. Tidak kirim email.

### 2026-09-17 21:21 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `654bf5c` (docs pulihkan rekomendasi + All clear 20:17).
- Sejak audit 20:17: hanya docs di Clinqoo. (`95bcf66`, `654bf5c`). Tidak ada commit kode auth/wallet/schema/middleware.
- Status: **All clear**. Tidak kirim email.

Log jam sebelumnya (20:17 ke bawah) ada di commit `654bf5c` — dipotong dari HEAD wiki agar file tetap ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. SELESAI: E2E smoke `/auth/` Google & GitHub. Sisa: owner uji login nyata.
2. Deploy `clinqoo` selalu sertakan `functions/{mcp.js,rpc.js}`.
3. Setelah promo: pita kartu Pro kembalikan ke "Paling Populer".
4. SELESAI: `set_balance` admin-only (`164689f`) live.
5. SELESAI: `upsertOauthUser` tanpa email (`4ff816e`) live.
6. Email hanya ke **muzawwied@gmail.com**, laporan AI plain-text.
7. Blog konten/perf saja.
8. Backlog dual-mode + locale ID (17:39).
9. Owner uji beli langganan + ClinqooPay (`5c7d317`). Bersihkan mojibake em-dash di `subscription.js`.
10. Backlog 18:05: loop inspect-act-verify; facts SSOT kuota; maxOutputTokens 8192; Doctor Deploy; profil bisnis.
11. **P0 19:23**: perbaiki `aiCall(env, messages, …)` di rangkuman `agent.js`; `search_replace` + `grep_content`; jujur saat fallback tanpa tools. Jangan otomasi duplikat — aktif `168d5135`.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
