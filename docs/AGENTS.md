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

## Status Saat Ini (update terakhir: 2026-09-18 13:13 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | Diverifikasi ulang 13:13 di `functions/api/auth/shared.js` (`4ff816e`). |
| Galeri template komunitas | Baru | `7611945` — `/api/template-submissions` + review token email |
| CCTV `security_events` | Minor bug | `7a58bad` — `logBlocked` CREATE TABLE tanpa `.run()` |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string di subscription.js |
| Schema D1 vs runtime | Gap | `template_submissions` ada; `security_events` belum di schema.sql |
| Editor full-stack | OK | Repo Editor HEAD `6e4d516`. App HEAD `eca77be` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy masih terbuka |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | OK | `mcp.js` live `9f82c01d` |
| Wallet / langganan | OK | Tidak berubah jam ini |
| Middleware | OK + catatan | PUBLIC include template-submissions; CCTV log middleware lemah |
| Hourly audit automation | OK | Audit 13:13: email laporan perubahan penting ke gmail |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `7069e89` |
| Clinqoo-Data | OK | Sync `12b4d6a` 06:01Z |
| Landing | OK | CTA daftar → `/auth/` + CTA galeri template |
| Debug folders | OK | tetap terhapus |

Bukan All clear — ada fitur baru + bug minor CCTV (bukan OAuth). Email laporan dikirim.

---

## Log Interaksi Agent

### 2026-09-18 13:13 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `eca77be` (hapus workflow probe CF).
- Sejak audit 12:08: `7611945` galeri-template; `7a58bad` CCTV; `6439caa`+`eca77be` probe CI lalu dibersihkan.
- `upsertOauthUser`: tetap FIXED.
- Issue/PR open: 0.
- Temuan: `logBlocked` tanpa `.run()`; review GET+token; title review tidak di-escape.
- Status: perubahan penting. Email `[Clinqoo Hourly Audit] [2026-09-18-13:13]` ke muzawwied@gmail.com.

### 2026-09-18 12:08 WIB — Grok (xAI) hourly audit
- HEAD `e215d49`. Status saat itu: All clear. Tidak kirim email.

Log lebih lama dipotong agar wiki ringan (`883695b` / `c4892ef`).

---

## Rekomendasi untuk Agent Berikutnya

1. Fix `logBlocked` di `_middleware.js`: panggil `.run()` pada CREATE TABLE.
2. Tambah `security_events` ke schema.sql.
3. Review template: jangan mutasi status pada GET murni (risiko prefetch email); escape HTML title.
4. Deploy `clinqoo` selalu sertakan `functions/{mcp.js}`.
5. Email hanya ke **muzawwied@gmail.com**.
6. Folder `debug/` jangan dihidupkan lagi.
7. Backlog AI: dual-mode, SSOT kuota, maxOutputTokens 8192, Doctor Deploy.
8. OAuth tetap jangan diubah tanpa tes email-null GitHub.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
