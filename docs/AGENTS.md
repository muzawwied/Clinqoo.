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

## Status Saat Ini (update terakhir: 2026-09-18 10:03 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` (GitHub MCP untuk semua agent) dan `/rpc` hidup dari `functions/{mcp.js,rpc.js}`.

**JANGAN deploy statis murni dari root repo** — itu MENGHAPUS endpoint `/mcp` (gejala: POST /mcp → 405) dan otomatis semua agent kehilangan akses GitHub.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (sumber: backup privat Superagent `mp/private/6aa8dfd1266e6380d43f3f8e/a7bd875d4_mcpjs.backup` — file berisi KUNCI, JANGAN pernah commit ke repo publik; `rpc` tidak diperlukan: /rpc di produksi hanyalah 404 statis, bukan function)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (butuh Node 22; token akun Vylonium)
5. Jika error `D1 binding 'DB' ... not found`: AKAR MASALAH = `wrangler.toml` (binding D1 basi 49b6fed3) ikut ter-copy ke folder deploy dan menimpa konfigurasi project — pastikan wrangler.toml TERHAPUS dari folder deploy SEBELUM deploy. Jika binding basi sudah nempel di project: hapus via `PATCH /accounts/<acc>/pages/projects/clinqoo` body `{"deployment_configs":{"production":{"d1_databases":{"DB":null}},"preview":{"d1_databases":{"DB":null}}}}`, lalu deploy ulang. JANGAN pernah menambahkan binding D1 ke project ini (database 49b6fed3 bukan milik akun ini; akun tidak punya D1 sama sekali).
6. Verifikasi pasca-deploy: `POST https://clinqoo.pages.dev/mcp` (Bearer key) harus balas JSON-RPC `initialize`, bukan 405/404.

Untuk proyek lain: `clinqoo-editor` deploy manual dari repo Clinqoo-Editor; backend API (clincoo-be2) hanya lewat GitHub Actions deploy.yml — jangan pernah deploy statis ke sana.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | INSERT + guard null + emailNorm + last_row_id (`4ff816e`). Diverifikasi ulang 10:03 di `functions/api/auth/shared.js`. |
| Halaman `/auth/` | OK (terverifikasi) | E2E smoke: redirect Google & GitHub ke gerbang OAuth OK |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string di subscription.js; runtime tidak terpengaruh |
| Schema D1 vs runtime | OK | |
| Editor full-stack | OK | Repo Editor HEAD `6e4d516`. App HEAD `4f079b1` — logo editor ikon kode `</>` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy masih terbuka. Bug `agent.js` `aiCall` tanpa `env` di ringkasan akhir SUDAH di-fix (`b537ca9`). |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | OK — live & terverifikasi | `mcp.js` di-rebuild dari nol 2026-09-18 (14 tools identik + fix UTF-8 TextDecoder), kunci baru, deployed `9f82c01d` produksi. |
| Audit keamanan 10 temuan (P0-P2) | OK — semua selesai & ter-push | |
| Wallet / langganan | OK — fix urutan tx | `5c7d317` |
| Middleware | OK | Clinqoo connector tools berfungsi |
| Hourly audit automation | OK | Audit 10:03: All clear (tidak kirim email) |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `116a8ab` — 5 artikel coding 18 Sep |
| Clinqoo-Data | OK | Sync rutin `159f2d2` 03:01Z |
| Landing | OK | HEAD `21d4481` |

**All clear (jam ini)** — OAuth tetap FIXED. Sejak 09:45: branding editor (`75e34b2` / `42c9b08` / `4f079b1`) + data sync. Bukan auth/wallet/schema. Issue/PR 0.

---

## Log Interaksi Agent

### 2026-09-18 10:03 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `4f079b1` (brand editor logo `</>`).
- Sejak audit 09:45: commit editor UX/brand (`92165de` param ?id=, `75e34b2` Clinqoo Code utama, `42c9b08` hapus arrow-left, `4f079b1` logo kode). Bukan OAuth/wallet/middleware.
- Data sync `159f2d2` 03:01Z (rutin). Blog `116a8ab`. Editor repo tetap `6e4d516`. Landing `21d4481`.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), kode di `functions/api/auth/shared.js` masih aman.
- Issue/PR open: 0.
- Status: **All clear**. Tidak kirim email.

### 2026-09-18 09:05 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.` sebelum update wiki: `9a0d087` (fix editor `/editor/` 301 + cache paket fail-open + fallback popup).
- Sejak audit 08:09: 1 commit kode UX editor (`9a0d087`, Superagent Base44). Bukan OAuth/wallet/middleware. Blog `86e47e5`. Data sync `0d9ea90` 02:01Z (rutin).
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), kode di `functions/api/auth/shared.js` masih aman.
- Bug `aiCall` tanpa `env` di panggilan ringkasan akhir `functions/api/agent.js` **masih ada** (sudah dilaporkan 19:23).
- Editor repo `6e4d516`. Landing `21d4481`. Issue/PR open: 0.
- Status: **All clear**. Tidak kirim email.

### 2026-09-18 08:09 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.` sebelum update wiki: `25b2c89` (docs hourly audit 07:19 All clear).
- Sejak audit 07:19: tidak ada commit kode di Clinqoo./Editor/Landing/Wallet. Data sync `d7261c6` / `2be0ee6` / `dd112ea` (rutin 00:31–01:01Z).
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`).
- Status: **All clear**. Tidak kirim email.

Log jam sebelumnya ada di commit `644adc8` — dipotong dari HEAD wiki agar file tetap ringan.

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
12. Setelah deploy Pages: pastikan `_redirects` `/editor` → `/proyek/workspace/editor/` ikut live (`9a0d087` / `75e34b2`).

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
