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

## Status Saat Ini (update terakhir: 2026-09-18 18:14 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` (GitHub MCP untuk semua agent) dan `/rpc` hidup dari `functions/{mcp.js,rpc.js}`.

**JANGAN deploy statis murni dari root repo** — itu MENGHAPUS endpoint `/mcp` (gejala: POST /mcp → 405) dan otomatis semua agent kehilangan akses GitHub.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (sumber: backup privat Superagent baru `mp/private/6aacd0a0bb8bbc27e96f6734/93bc6c134_mcp.js` — REPLICA 2026-09-18, perilaku identik dengan versi lama: 14 tools, key & format error sama; berisi KUNCI, JANGAN pernah commit ke repo publik; `rpc` tidak diperlukan: /rpc di produksi hanyalah 404 statis, bukan function)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (butuh Node 22; token akun Vylonium)
5. Jika error `D1 binding 'DB' ... not found`: AKAR MASALAH = `wrangler.toml` (binding D1 basi 49b6fed3) ikut ter-copy ke folder deploy dan menimpa konfigurasi project — pastikan wrangler.toml TERHAPUS dari folder deploy SEBELUM deploy. Jika binding basi sudah nempel di project: hapus via `PATCH /accounts/<acc>/pages/projects/clinqoo` body `{"deployment_configs":{"production":{"d1_databases":{"DB":null}},"preview":{"d1_databases":{"DB":null}}}}`, lalu deploy ulang. JANGAN pernah menambahkan binding D1 ke project ini (database 49b6fed3 bukan milik akun ini; akun tidak punya D1 sama sekali).
6. Verifikasi pasca-deploy: `POST https://clinqoo.pages.dev/mcp` (Bearer key) harus balas JSON-RPC `initialize`, bukan 405/404.

Untuk proyek lain: `clinqoo-editor` deploy manual dari repo Clinqoo-Editor; backend API (clincoo-be2) hanya lewat GitHub Actions deploy.yml — jangan pernah deploy statis ke sana.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | Diverifikasi ulang 18:14. Tidak disentuh commit baru. |
| Deploy user sites | Fix UX | HEAD `0fb459d6` — UI domain kustom tidak lagi paksa suffix `.clinqoo.biz.id` |
| Seed tabel proyek | Fix race | `b25ea866` — seed AUTOINCREMENT env_vars sekali per base |
| Galeri template | Update | Email review JPEG + fallback; UI hapus Masuk/Daftar/CTA |
| CCTV `security_events` | Minor bug | `logBlocked` CREATE TABLE tanpa `.run()` (belum ditutup) |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string di subscription.js |
| Schema D1 vs runtime | Gap | `template_submissions` ada; `security_events` belum di schema.sql |
| Editor full-stack | OK | Repo Editor HEAD `6e4d516`. App HEAD `0fb459d6` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy masih terbuka |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | REGRESI 405 | POST `/mcp` → 405 (connector Clinqoo gagal initialize) |
| Wallet / langganan | OK | Tidak ada regresi kritis |
| Middleware | OK + catatan | PUBLIC include template-submissions; CCTV lemah; ORIGIN_ALLOW belum `*.clinqoo.biz.id` |
| Hourly audit automation | OK | Audit 18:14: email perubahan penting ke gmail |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `078ce500` 18:06 WIB |
| Clinqoo-Data | OK | Sync `2b8d59a1` 18:00 WIB |
| Domain publik | P1 operasional | CNAME Zone DNS API; UI custom domain dipisah dari suffix otomatis |
| Debug folders | OK | tetap terhapus |
| CI probe workflow | Bersih | workflow probe token CF sudah dihapus |

Bukan All clear — commit baru deploy/UI/template + MCP 405. Email laporan dikirim.

---

## Log Interaksi Agent

### 2026-09-18 18:14 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit HEAD `0fb459d6` (sebelumnya audit 17:10 mengutip `01cc62a0`; SHA HEAD sekarang `0fb459d6` @ 10:53Z). STATUS PERUBAHAN PENTING (bukan All clear). OAuth `upsertOauthUser` TETAP FIXED di `functions/api/auth/shared.js` (emailNorm, INSERT auth_users, last_row_id jika email null); tidak disentuh commit baru. Commit baru sejak ~17:10 WIB: `0fb459d6` fix(deploy) domain kustom UI tidak lagi menampilkan subdomain otomatis `.clinqoo.biz.id`; `b25ea866` fix(_tables) seed env_vars autoincrement cuma sekali per proyek (cegah race UNIQUE saat deploy); `aef633e4` / `ef14d3b3` template-submissions ekstensi mime thumbnail + email review selalu terkirim (JPEG; fallback tanpa lampiran karena Brevo menolak webp); `3c487e28` / `85515e62` / `e66c61d9` UI galeri hapus Daftar, Masuk, CTA "Punya template sendiri?". Issue/PR open: 0. Editor `6e4d516` (tidak berubah). Data sync `2b8d59a1` @ 18:00 WIB. Blog `078ce500` @ 18:06 WIB (index cerita/SEO). Temuan terbuka (bukan regresi baru): POST `https://clinqoo.pages.dev/mcp` → 405 (connector MCP gagal initialize — redeploy WAJIB dengan `functions/mcp.js`, TANPA wrangler.toml / D1); `logBlocked` di `_middleware.js` CREATE TABLE `security_events` tanpa `.run()`; schema.sql belum punya `security_events`; ORIGIN_ALLOW belum mencakup `*.clinqoo.biz.id`; review GET+token / escape title masih catatan lama. Rekomendasi: redeploy project clinqoo dengan replica mcp.js (jangan commit kunci ke repo publik); tambah `.run()` pada CREATE TABLE di logBlocked + `security_events` ke schema.sql; pertimbangkan ORIGIN_ALLOW `*.clinqoo.biz.id`; jangan ubah OAuth tanpa tes email-null GitHub; email hanya muzawwied@gmail.com.
- Sumber: email/pesan laporan (subjek: [Clinqoo Hourly Audit] [2026-09-18-18:14], dari Devconium)
- Status: OAuth OK; HEAD `0fb459d6`; MCP connector 405; P1 CCTV/schema/ORIGIN_ALLOW/review masih terbuka

### 2026-09-18 18:14 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `0fb459d6`.
- Sejak audit 17:10: `0fb459d6` UI domain kustom; `b25ea866` seed env_vars sekali; `ef14d3b3`/`aef633e4` email review JPEG; UI galeri hapus Masuk/Daftar/CTA.
- `upsertOauthUser`: tetap FIXED (emailNorm + INSERT + last_row_id).
- Issue/PR open: 0. Editor `6e4d516`. Data `2b8d59a1`. Blog `078ce500`.
- Clinqoo MCP connector: HTTP 405 pada initialize.
- Email `[Clinqoo Hourly Audit] [2026-09-18-18:14]` ke muzawwied@gmail.com.

### 2026-09-18 17:10 WIB — Grok (xAI) laporan masuk
- HEAD dikutip `01cc62a0`. OAuth FIXED. MCP 405. Email `[Clinqoo Hourly Audit] [2026-09-18-17:10]`.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy project `clinqoo` DENGAN `functions/mcp.js` (jangan sertakan wrangler.toml / D1 binding) — POST `/mcp` saat ini 405.
2. Fix `logBlocked` di `functions/api/_middleware.js`: panggil `.run()` pada CREATE TABLE.
3. Tambah `security_events` ke schema.sql.
4. Review template: jangan mutasi status pada GET murni; escape HTML title di `review.js`.
5. Pertimbangkan ORIGIN_ALLOW untuk `*.clinqoo.biz.id`.
6. Email hanya ke **muzawwied@gmail.com**.
7. Folder `debug/` jangan dihidupkan lagi.
8. Backlog AI: dual-mode, SSOT kuota, maxOutputTokens 8192, Doctor Deploy.
9. OAuth tetap jangan diubah tanpa tes email-null GitHub.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
