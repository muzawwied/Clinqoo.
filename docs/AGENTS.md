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

## Status Saat Ini (update terakhir: 2026-09-21 19:15 WIB)

**INSIDEN SELESAI (21 Sep ~10.05 WIB):** app.clincoo.buzz sempat dialihkan ke project `clinqoo` (a393, D1 kosong 887e6ab6) sejak ~09.20 WIB → user tidak bisa login. Sudah dipulihkan: domain kembali ke project `clincoo` (akun Vylonium0, clincoo-be2.pages.dev, DB asli 49b6fed3). **JANGAN pasang domain app.clincoo.buzz ke project clinqoo** dan JANGAN tambahkan D1 binding ke project clinqoo. Job `deploy-production` di deploy.yml DIHAPUS (dialah yang men-deploy salinan app dengan D1 kosong 887e6ab6 ke project clinqoo tiap push).

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` hidup dari `functions/mcp.js`.

**JANGAN deploy statis murni dari root repo** — gejala: POST /mcp → 405.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (backup privat Superagent — berisi KUNCI, JANGAN commit publik)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (token Vylonium a393). **PENTING (pelajaran 2026-09-21): jalankan dari folder terisolasi DI LUAR repo** — wrangler menemukan `wrangler.toml` repo lewat parent directory, lalu menulis ulang binding D1 basi (DB 49b6fed3 + WALLET_DB 59e17832 lintas akun) ke config project dan deploy gagal "database not found". Salin build-dir ke folder terpisah (mis. workspace root) sebelum deploy.
5. Jika error D1 binding: bersihkan binding basi via API — `PATCH /pages/projects/clinqoo` dengan `deployment_configs.production.d1_databases = {"DB": null, "WALLET_DB": null}` (nilai `null` per-binding menghapus; `{}` atau config kosong TIDAK bisa). JANGAN tambah binding D1 ke project ini.
6. Verifikasi: `POST https://clinqoo.pages.dev/mcp` harus JSON-RPC. Tanpa key → 401 Unauthorized (function hidup). Bukan 405/404.

**Email resmi tampilan web = `halo@clincoo.buzz`**. Backend notifikasi tetap ke muzawwied@gmail.com.

**Rebrand UI:** teks `Clincoo` / `ClincooPay`. JANGAN rename domain/URL `clinqoo*`, nama repo, path `muzawwied.github.io/Clinqoo./`, identifier kode. Pelajaran: `GH_REPO` sempat salah jadi Clincoo-Data — sync users-live mati sampai `100c2f50`.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. File `functions/api/auth/shared.js` blob `ebf23dd5`. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html`. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| Probe Gemini tanpa auth (`kbdiag.js`) | TERATASI | Dihapus di `e4ec785`. |
| Probe admin Gemini | Sementara | `functions/api/diag-gemini.js` masih di HEAD — gate ADMIN_EMAILS / qa.*@clincoo.dev. Hapus setelah diagnosa. |
| Probe streaming (`streamtest.js`) | TERATASI | Dihapus di `9b8f4564`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI — HTTP 405 | POST clinqoo.pages.dev/mcp dan app.clincoo.buzz/mcp = 405 body kosong. Redeploy project clinqoo BERSAMA functions/mcp.js. |
| CI deploy production | Dihapus | job `deploy-production` dihapus di `76792d3b`. CI tersisa: deploy project `clincoo` + agent-worker. |
| Rantai AI | Update | `834bad05` hapus OpenRouter; Gemini multi-kunci (KEY..KEY_6) utama, Workers AI cadangan. Pastikan secret KEY_4..6 di production. |
| User report | Update | Gate x-cron-secret (POST tanpa secret = 403). Sync Clinqoo-Data `fd86ad5a`. |
| Wallet / langganan / schema | PATCHED | e638daf: resolveOwner fail-closed; kredit in hanya callback/ClincooPay; clear/DELETE admin-only. |
| Sync users-live | OK — jalan | Clinqoo-Data `fd86ad5a` (19:15 WIB / 12:15 UTC). |
| Blog | Update | Clinqoo-Blog `bc10c1df` restore data_ux.js + 5 artikel UX. |
| Komunitas | Update UI | Clinqoo-Komunitas `a93f3683` restore header (13:42 WIB). |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 19:15 WIB ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek RESEND_API_KEY |

Bukan All clear. HEAD Clinqoo. docs audit ini / app `834bad05`. `upsertOauthUser` tetap FIXED. Live MCP product 405. Tidak ada commit app baru sejak 13:26. Bug terbuka lama: oauthRedirectUri github.io `/Clincoo./`; diag-gemini.js.

---

### 2026-09-21 19:15 WIB — Grok (xAI) hourly audit
- Scope: sejak 18:06 WIB (HEAD docs `8c44d399` / app `834bad05`).
- Commit baru app: tidak ada.
- Live: app GET 200; auth 200; POST /mcp = 405; user-report-sync tanpa secret = 403.
- Related: Clinqoo-Data `fd86ad5a`; Clinqoo-Blog `bc10c1df`; Komunitas tidak berubah.
- Email: `[Clinqoo Hourly Audit] 2026-09-21 19:15 WIB` ke muzawwied@gmail.com.

### 2026-09-21 18:06 WIB — Grok (xAI) hourly audit
- Scope: sejak 17:14 WIB (HEAD docs `24b84a70` / app `834bad05`).
- Commit baru app: tidak ada.
- Live: app GET 200; auth 200; POST /mcp = 405; user-report-sync tanpa secret = 403.
- Related: Clinqoo-Data `28e9fc67`; Clinqoo-Blog `b0283845`; Komunitas tidak berubah.
- Email: `[Clinqoo Hourly Audit] 2026-09-21 18:06 WIB` ke muzawwied@gmail.com.

### 2026-09-21 17:14 WIB — Grok (xAI) hourly audit
- Scope: sejak 16:22 WIB (HEAD docs `c612175d` / app `834bad05`).
- Commit baru app: tidak ada.
- Live: app GET 200; auth 200; POST /mcp = 405; user-report-sync tanpa secret = 403.
- Related: Clinqoo-Data `999d82ca`; Clinqoo-Blog `22372ee7`; Komunitas tidak berubah.
- Email: `[Clinqoo Hourly Audit] 2026-09-21 17:14 WIB` ke muzawwied@gmail.com.

Log lebih lama dipotong agar wiki ringan.

---

### 2026-09-21 08:20 WIB — Superagent (Base44): PATCH KEAMANAN dompet
- Fix (commit e638daf): resolveOwner fail-closed; kredit 'in' tanpa callback token WAJIB ClincooPay; clear/DELETE admin-only.

## Log Interaksi Agent
### 2026-09-21 20:45 WIB — Superagent (Base44): AI otomatis isi Nama Aplikasi & Deskripsi proyek
- Fix (laporan Devconium): kartu proyek memakai potongan 4 kata awal chat karena Pengaturan Umum (app_name/app_desc) tidak pernah diisi AI.
- Tool klien baru `set_project_info` (proyek/chat/index.html): simpan app_name+app_desc ke /api/project-settings, sinkron judul proyek server+lokal. Deklarasi ditambah ke workspaceDecls (functions/api/chat.js).
- Prompt builder (server & klien) aturan (c) diperluas: WAJIB panggil set_project_info segera setelah situs selesai dibangun. Proyek lama: minta AI di chat proyek itu untuk rename.
- Commit 12c90d8, CI success, live terverifikasi di app.clincoo.buzz (set_project_info ada di halaman chat, site 200).

### 2026-09-21 19:15 WIB — Grok (xAI) hourly audit
- Status: **bukan All clear**. HEAD app `834bad05`. upsertOauthUser TETAP FIXED (blob ebf23dd5).
- MCP 405 masih. Sync Clinqoo-Data `fd86ad5a`. Blog `bc10c1df`.

### 2026-09-21 18:06 WIB — Grok (xAI) hourly audit
- Status: **bukan All clear**. HEAD app `834bad05`. upsertOauthUser TETAP FIXED (blob ebf23dd5).
- MCP 405 masih. Sync Clinqoo-Data `28e9fc67`. Blog `b0283845`.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. **PRIORITAS:** Redeploy Pages project `clinqoo` BERSAMA `functions/mcp.js` dari folder terisolasi. Verifikasi POST `/mcp` = JSON-RPC atau 401, **bukan 405**.
2. Jangan pasang `app.clincoo.buzz` ke project `clinqoo`. Jangan tambah D1 binding ke project itu.
3. Hapus `functions/api/diag-gemini.js` setelah diagnosa.
4. Perbaiki path github.io Clincoo. → Clinqoo. pada oauthRedirectUri.
5. Daftarkan https://app.clincoo.buzz/auth/ dan https://clinqoo.pages.dev/auth/.
6. Jangan ubah upsertOauthUser tanpa tes email-null GitHub.
7. Email hanya ke muzawwied@gmail.com.
8. WALLET_DB binding production (project clincoo).
9. Pastikan secret `GEMINI_API_KEY_4`–`GEMINI_API_KEY_6` terpasang setelah rotasi kunci.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
