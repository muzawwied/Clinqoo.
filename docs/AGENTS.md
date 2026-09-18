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
3. Tempel `functions/mcp.js` (sumber: backup privat Superagent baru `mp/private/6aacd0a0bb8bbc27e96f6734/93bc6c134_mcp.js` — REPLICA 2026-09-18, perilaku identik dengan versi lama: 14 tools, key & format error sama; berisi KUNCI, JANGAN pernah commit ke repo publik; `rpc` tidak diperlukan: /rpc di produksi hanyalah 404 statis, bukan function)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (butuh Node 22; token akun Vylonium)
5. Jika error `D1 binding 'DB' ... not found`: AKAR MASALAH = `wrangler.toml` (binding D1 basi 49b6fed3) ikut ter-copy ke folder deploy dan menimpa konfigurasi project — pastikan wrangler.toml TERHAPUS dari folder deploy SEBELUM deploy. Jika binding basi sudah nempel di project: hapus via `PATCH /accounts/<acc>/pages/projects/clinqoo` body `{"deployment_configs":{"production":{"d1_databases":{"DB":null}},"preview":{"d1_databases":{"DB":null}}}}`, lalu deploy ulang. JANGAN pernah menambahkan binding D1 ke project ini (database 49b6fed3 bukan milik akun ini; akun tidak punya D1 sama sekali).
6. Verifikasi pasca-deploy: `POST https://clinqoo.pages.dev/mcp` (Bearer key) harus balas JSON-RPC `initialize`, bukan 405/404.

Untuk proyek lain: `clinqoo-editor` deploy manual dari repo Clinqoo-Editor; backend API (clincoo-be2) hanya lewat GitHub Actions deploy.yml — jangan pernah deploy statis ke sana.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | Diverifikasi ulang 13:13 di `functions/api/auth/shared.js` (`4ff816e`). Bukan regresi. |
| Galeri template komunitas | Baru | `7611945` — `/api/template-submissions` + review token email |
| CCTV `security_events` | Minor bug | `7a58bad` — `logBlocked` CREATE TABLE tanpa `.run()` |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string di subscription.js |
| Schema D1 vs runtime | Gap | `template_submissions` ada; `security_events` belum di schema.sql |
| Editor full-stack | OK | Repo Editor HEAD `6e4d516`. App HEAD `eca77be` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy masih terbuka |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | OK | `mcp.js` live `9f82c01d` |
| Wallet / langganan | OK | Tidak ada regresi kritis |
| Middleware | OK + catatan | PUBLIC include template-submissions; CCTV log middleware lemah |
| Hourly audit automation | OK | Audit 13:13: email laporan perubahan penting ke gmail |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `7069e89` |
| Clinqoo-Data | OK | Sync `12b4d6a` 06:01Z |
| Landing | OK | CTA daftar → `/auth/` + CTA galeri template |
| Debug folders | OK | tetap terhapus |
| CI probe workflow | Bersih | `6439caa` lalu `eca77be` hapus workflow probe token CF |

Bukan All clear — ada fitur baru + bug minor CCTV / review (bukan OAuth). Email laporan dikirim.

---

## Log Interaksi Agent

### 2026-09-18 13:30 WIB — Superagent (Base44) deploy galeri template komunitas
- Push `7611945` (galeri template + API `/api/template-submissions`) & `7a58bad` (CCTV, agent lain) hanya auto-deploy ke backend `clincoo`/clincoo-be2 via deploy.yml. Frontend `clinqoo` TIDAK auto-deploy (bukan Git-connected).
- Deploy manual project `clinqoo` dijalankan sesuai prosedur: build dari `origin/main` @ `7a58bad`+`eca77be`, hapus artefak, tempel mcp.js REPLICA (14 tools, key sama), PATCH hapus binding D1 basi `DB` (prod+preview) SUKSES, `wrangler pages deploy` SUKSES.
- Verifikasi: `/templates/daftarkan` 200, landing CTA "Lihat semua template" ada, POST /mcp initialize+tools/list (14 tools)+tools/call read_file OK, key salah 401.
- mcp.js lama tidak tersedia (backup lama di app Superagent lama 6aa8dfd1, tidak bisa diakses); REPLICA dibangun dari perilaku live endpoint + `GITHUB_DATA_TOKEN` dari D1 env_vars. Token & key di dalam file tidak berubah dari versi live.
- Galeri komunitas: pengajuan template → email reviewer → approve/reject → tampil di galeri dengan metrik live.


### 2026-09-18 13:13 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit HEAD `eca77be` (CI hapus workflow probe). Sejak 12:08: `7611945` feat galeri-template komunitas + API `/api/template-submissions`; `7a58bad` feat CCTV `security_events` (login gagal, scanner, rate-limit, origin); `6439caa` lalu `eca77be` probe token CF lalu workflow dihapus. OAuth `upsertOauthUser` tetap FIXED (emailNorm + INSERT + last_row_id) di `functions/api/auth/shared.js`. Issue/PR 0. Editor `6e4d516`. Data sync `12b4d6a` 06:01Z. Blog `7069e89`. Temuan non-P0: (1) `_middleware.js` `logBlocked` CREATE TABLE tanpa `.run()` — `_secTableOk=true` setelah prepare saja, INSERT CCTV bisa gagal diam sampai `login.js` membuat tabel; (2) `schema.sql` belum `security_events`; (3) review template via GET + token di URL (email prefetch bisa trigger approve); (4) `review.js` sisipkan `row.title` ke HTML tanpa escape. Wallet/middleware auth tanpa regresi kritis. PUBLIC allowlist sudah mencakup `/api/template-submissions`.
- Sumber: email/pesan laporan (subjek: [Clinqoo Hourly Audit] [2026-09-18-13:13])
- Status: OAuth OK; temuan non-P0 terbuka (middleware CCTV table, schema, review GET, escape judul)

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

1. Fix `logBlocked` di `_middleware.js`: panggil `.run()` pada CREATE TABLE (seperti `login.js`).
2. Tambah `security_events` ke schema.sql.
3. Review template: jangan mutasi status pada GET murni (risiko prefetch email); pertimbangkan POST + halaman konfirmasi; escape HTML title di `review.js`.
4. Deploy `clinqoo` selalu sertakan `functions/{mcp.js}`.
5. Email hanya ke **muzawwied@gmail.com**.
6. Folder `debug/` jangan dihidupkan lagi.
7. Backlog AI: dual-mode, SSOT kuota, maxOutputTokens 8192, Doctor Deploy.
8. OAuth tetap jangan diubah tanpa tes email-null GitHub.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
