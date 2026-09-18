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

## Status Saat Ini (update terakhir: 2026-09-19 02:15 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` (GitHub MCP untuk semua agent) dan `/rpc` hidup dari `functions/{mcp.js,rpc.js}`.

**JANGAN deploy statis murni dari root repo** — itu MENGHAPUS endpoint `/mcp` (gejala: POST /mcp → 405) dan otomatis semua agent kehilangan akses GitHub.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (sumber: backup privat Superagent — berisi KUNCI, JANGAN pernah commit ke repo publik; `rpc` tidak diperlukan: /rpc di produksi hanyalah 404 statis)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (butuh Node 22; token akun Vylonium)
5. Jika error `D1 binding 'DB' ... not found`: pastikan wrangler.toml TERHAPUS dari folder deploy. JANGAN menambahkan binding D1 ke project ini.
6. Verifikasi pasca-deploy: `POST https://clinqoo.pages.dev/mcp` (Bearer key) harus balas JSON-RPC `initialize`, bukan 405/404.

Untuk proyek lain: `clinqoo-editor` deploy manual dari repo Clinqoo-Editor; backend API (clincoo-be2) hanya lewat GitHub Actions deploy.yml — jangan pernah deploy statis ke sana.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id di `functions/api/auth/shared.js`. Diverifikasi 02:15. |
| Deploy user sites | OK | HEAD kode app `0fb459d6` |
| Seed tabel proyek | OK | `b25ea866` |
| Galeri template | OK | Email review JPEG + fallback |
| CCTV `security_events` | Minor | `logBlocked` CREATE TABLE tanpa `.run()` (known) |
| Encoding karakter | Minor | Mojibake em-dash |
| Schema D1 vs runtime | Gap known | `security_events` belum di schema.sql |
| Editor full-stack | OK | `6e4d516` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy |
| Promo | OK | |
| Deploy MCP | REGRESI 405 (known) | Bukan temuan baru |
| Wallet / langganan | OK | |
| Middleware | OK + catatan | ORIGIN_ALLOW belum `*.clinqoo.biz.id` |
| Hourly audit automation | OK | Audit 02:15: All clear — tidak kirim email |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `1562a0db` (5 artikel + sitemap ~02:14 WIB) |
| Clinqoo-Data | OK | Sync rutin `ba73e02c` 19:15Z / 02:15 WIB |
| Landing | OK | HEAD `280302d9` |

**All clear** — tidak ada commit kode app baru sejak `0fb459d6` / audit 01:03. Perubahan: data sync + konten blog. OAuth tetap FIXED. Tidak kirim email.

---

## Log Interaksi Agent

### 2026-09-19 02:15 WIB — Grok (xAI) hourly audit
- HEAD wiki sebelumnya `0ac17bb6` (audit 01:03 All clear).
- Kode produk terakhir tetap `0fb459d6` @ 10:53Z.
- Sejak 01:03: Clinqoo-Data sync (`ba73e02c` 02:15 WIB) + Blog `1562a0db` (5 artikel + sitemap ~02:14 WIB).
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (dibaca ulang 02:15).
- Issue/PR open: 0. Editor `6e4d516`. Landing `280302d9`.
- MCP 405 known. Minor CCTV/schema tetap terbuka, bukan kritis baru.
- Status: **All clear**. Tidak kirim email.

### 2026-09-19 01:03 WIB — Grok (xAI) hourly audit
- All clear. Kode produk `0fb459d6`. OAuth FIXED. MCP 405 known. Tidak kirim email.

### 2026-09-18 23:16 WIB — Grok (xAI) hourly audit
- All clear. Kode produk `0fb459d6`. OAuth FIXED. MCP 405 known. Tidak kirim email.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy project `clinqoo` DENGAN `functions/mcp.js` (jangan sertakan wrangler.toml / D1 binding) — POST `/mcp` saat ini 405.
2. Fix `logBlocked` di `functions/api/_middleware.js`: panggil `.run()` pada CREATE TABLE.
3. Tambah `security_events` ke schema.sql.
4. Pertimbangkan ORIGIN_ALLOW untuk `*.clinqoo.biz.id`.
5. Email hanya ke **muzawwied@gmail.com**.
6. Backlog AI: dual-mode, SSOT kuota, maxOutputTokens 8192, Doctor Deploy.
7. OAuth tetap jangan diubah tanpa tes email-null GitHub.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
