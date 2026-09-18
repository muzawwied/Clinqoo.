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

## Status Saat Ini (update terakhir: 2026-09-18 20:31 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | Diverifikasi 20:31. emailNorm + INSERT + last_row_id. Tidak disentuh. |
| Deploy user sites | Fix UX | Kode app HEAD `0fb459d6` — UI domain kustom tidak paksa suffix |
| Seed tabel proyek | Fix race | `b25ea866` — seed AUTOINCREMENT env_vars sekali per base |
| Galeri template | Update | Email review JPEG + fallback; UI hapus Masuk/Daftar/CTA |
| CCTV `security_events` | Minor bug | `logBlocked` CREATE TABLE tanpa `.run()` (belum ditutup) |
| Encoding karakter | Minor | Mojibake em-dash di komentar shared.js + string di subscription.js |
| Schema D1 vs runtime | Gap | `template_submissions` ada; `security_events` belum di schema.sql |
| Editor full-stack | OK | Repo Editor HEAD `6e4d516`. App kode `0fb459d6` |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy masih terbuka |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | REGRESI 405 (known) | POST `/mcp` → 405 — sama seperti audit 18:14; bukan temuan baru |
| Wallet / langganan | OK | Tidak ada regresi kritis |
| Middleware | OK + catatan | PUBLIC include template-submissions; CCTV lemah; ORIGIN_ALLOW belum `*.clinqoo.biz.id` |
| Hourly audit automation | OK | Audit 20:31: All clear — tidak kirim email |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `54687ce9` 20:29 WIB — 5 artikel cerita (konten, bukan kode app) |
| Clinqoo-Data | OK | Sync rutin `8856db3b` 20:30 WIB |
| Domain publik | P1 operasional | CNAME Zone DNS API; UI custom domain dipisah dari suffix otomatis |
| Debug folders | OK | tetap terhapus |
| CI probe workflow | Bersih | workflow probe token CF sudah dihapus |

All clear — tidak ada commit kode app baru sejak `0fb459d6`; wiki-only + blog konten + data sync. MCP 405 known, sudah dilaporkan 18:14. Tidak kirim email.

---

## Log Interaksi Agent

### 2026-09-18 20:31 WIB — Grok (xAI) hourly audit
- All clear. Repo `Clinqoo.` wiki HEAD `dec95593` lalu update ini; kode produk terakhir `0fb459d6` @ 10:53Z.
- Sejak audit 18:14: hanya docs AGENTS.md (`168eb154`, `dec95593`). Tidak ada perubahan OAuth/wallet/middleware/schema.
- `upsertOauthUser` tetap FIXED.
- Issue/PR open: 0. Editor `6e4d516`. Data `8856db3b`. Blog `54687ce9` (artikel cerita).
- POST clinqoo.pages.dev/mcp tetap 405 (known).
- Tidak kirim email (bukan bug kritis / perubahan penting baru).

### 2026-09-18 18:14 WIB — Grok (xAI) hourly audit
- HEAD kode `0fb459d6`. OAuth FIXED. MCP 405. Email `[Clinqoo Hourly Audit] [2026-09-18-18:14]`.

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
