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

---

## Status Saat Ini (update terakhir: 2026-09-17 13:13 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — sudah diperbaiki | INSERT + guard null + emailNorm + last_row_id (`4ff816e`). Live di clincoo-be2. |
| Halaman `/auth/` | OK (terverifikasi) | E2E smoke: redirect Google & GitHub ke gerbang OAuth OK |
| Encoding karakter | Minor | Komentar shared.js masih mojibake em-dash; runtime tidak terpengaruh |
| Schema D1 vs runtime | OK | |
| Editor full-stack | OK | HEAD `6e4d516` |
| AI chat / Tim AI | OK | |
| Promo | OK | Tidak berubah jam ini |
| Deploy MCP | OK (docs) | Aturan functions/{mcp.js,rpc.js} |
| Wallet | OK | `164689f` set_balance admin-only, live |
| Middleware | OK | Clinqoo connector tools berfungsi |
| Hourly audit automation | OK | |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK (baru) | Clinqoo-Blog v1 + artikel promo; bukan auth/wallet |

**All clear** — tidak ada bug kritis. Sejak audit 12:18 hanya docs audit + sync Data + konten Blog (non-kritis).

---

## Log Interaksi Agent

### 2026-09-17 13:13 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `92f0499` (docs audit 12:18).
- Sejak audit 12:18: tidak ada commit kode di Clinqoo./Editor/Landing/Wallet. Sync Clinqoo-Data `12ee3ef` (06:01Z). Clinqoo-Blog: v1 + perf + artikel promo Pro (`d70b6a6`).
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), kode di `functions/api/auth/shared.js` masih aman.
- Editor `6e4d516`. Issue/PR open: 0. Deploy run 263 (`92f0499`) success.
- Status: **All clear**. Tidak kirim email.

### 2026-09-17 12:18 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `631368b` (docs audit 11:07).
- Sejak audit 11:07: tidak ada commit kode di Clinqoo./Editor/Landing/Wallet. Hanya sync Clinqoo-Data (`8813f8c` 05:15Z).
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), ter-deploy. Kode di `functions/api/auth/shared.js` masih aman.
- Editor `6e4d516`. Issue/PR open: 0. Deploy run 262 success.
- Status: **All clear**. Tidak kirim email.

### 2026-09-17 11:07 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `5e88f21` (docs verifikasi production Superagent).
- Sejak audit 10:13: hanya `5e88f21` docs; tidak ada commit kode.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (`4ff816e`), ter-deploy.
- Editor `6e4d516`. Data sync `1acbe93` 04:00Z. Issue/PR open: 0. Deploy run 261 success.
- Status: **All clear**. Tidak kirim email.

### 2026-09-17 10:13 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `d6231b7` (docs rekomendasi #5).
- Sejak audit 09:15: `4ff816e` fix upsertOauthUser tanpa email; `b424c6b` docs E2E /auth/; `d6231b7` docs.
- `upsertOauthUser`: INSERT + guard + emailNorm + last_row_id — **FIXED**.
- Editor `6e4d516`. Data sync `079e0bd`. Issue/PR open: 0.
- Email `[Clinqoo Hourly Audit] 2026-09-17 10:13 WIB` dikirim.

### 2026-09-17 09:15 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `164689f` (sec wallet set_balance admin-only).
- Sejak audit 08:13: docs `5650b78`, wallet `164689f`.
- `upsertOauthUser`: INSERT + guard null **masih ada**. Tidak diubah jam ini.
- Clinqoo-Data sync `057a273` 02:15Z. Editor `6e4d516`. Issue/PR open: 0.
- Email `[Clinqoo Hourly Audit] 2026-09-17 09:15 WIB` dikirim (perubahan penting, tidak kritis).

### 2026-09-17 08:13 WIB — Grok (xAI) hourly audit
- HEAD `muzawwied/Clinqoo.`: `237f161` (kartu Pro homepage promo Rp5.000).
- Sejak audit 07:01: atomic promo `41bc95e`, UI upgrade/home `084d945`/`a78022c`/`237f161`, docs deploy MCP `0cdd1a2`, auth copy `bb2acf6`.
- `upsertOauthUser`: INSERT + guard null **masih ada**.
- Email `[Clinqoo Hourly Audit] 2026-09-17 08:13 WIB` dikirim.

### 2026-09-17 — Superagent Clinqoo (ui(upgrade): styling label promo Pro, lanjutan log sebelumnya)
- `akun/langganan/upgrade/index.html` (SIMPAN SOLUSI): harga promo Rp5.000 kini `text-gray-900 dark:text-white` (putih di dark mode, bukan emerald), badge "Discount" bawah dihapus total, pita pojok kartu Pro `Paling Populer` → `Discount` (SEMENTARA selama promo — kembalikan jadi "Paling Populer" saat promo berakhir). Semua class emerald di halaman upgrade sudah nol. Sudah deploy ke clinqoo (Vylonium, direct-upload) & terverifikasi live di kedua domain. Commit `084d945..HEAD` cabang repo utama.

### 2026-09-17 — Superagent Clinqoo (UI label promo Pro + deploy clinqoo.pages.dev)
- **UI**: `akun/langganan/upgrade/index.html` — label harga promo "Rp5.000/bln" dipindah ke area harga utama kartu Pro (sejajar "49K", dicoret jadi Rp49.000), sebelumnya nongol aneh di bawah dekat tombol. Badge "Discount" hilangkan emoji. Commit `084d945`.
- Deploy manual ke project Pages `clinqoo` (akun Vylonium, direct-upload) sudah dijalankan & diverifikasi live di clinqoo.pages.dev dan clincoo-be2.pages.dev.

### 2026-09-17 — Superagent Clinqoo (perbaiki halaman auth + deploy clinqoo.pages.dev)
- **FIX KORUP**: `auth/index.html` kehilangan seluruh `<head>` + 4 div pembungkus sejak merge lama. Direkonstruksi dari `akun/auth.html`; logic OAuth tak diubah. Commit `0f20136`.
- **UI**: hapus baris "Belum punya akun? Daftar sekarang". Commit `bb2acf6`.
- **PENTING**: project Pages `clinqoo` ada di akun Cloudflare *Vylonium* — **direct-upload, TANPA koneksi git**.

### 2026-09-17 07:01 WIB — Grok (xAI) hourly audit
- HEAD saat itu `0f20136`. Email dikirim (perubahan penting).

### 2026-09-17 06:18 WIB — Grok (xAI) hourly audit
- HEAD saat itu `85f6f88`.

### 2026-09-16 — Grok (xAI) 19:23 WIB
- Konfirmasi: **muzawwied@gmaio.com adalah typo**. Alamat resmi hanya **muzawwied@gmail.com**.

---

## Verifikasi Deploy Production — Superagent 10:50 WIB 17-09
- `deploy.yml` auto-trigger tiap push ke main. Run untuk `d6231b7` (memuat `4ff816e` fix upsertOauthUser + `164689f` set_balance admin-only) = **success** (02:43Z). Run `4ff816e` "cancelled" hanya karena superseded push `d6231b7` (concurrency group), isinya tetap ter-deploy.
- Verifikasi live `https://clincoo-be2.pages.dev/api/wallet`: POST set_balance tanpa login → 401 `Login diperlukan` (kode baru aktif; guard 403 admin berlaku setelah login).
- Rekomendasi #1 & #3 audit 10:13 **SELESAI** — kedua fix sudah di production. #4 mojibake diverifikasi bersih.
- Run 261 (`5e88f21`) juga **success** (03:52Z). Run 262 (`631368b` docs audit 11:07) **success** (04:08Z). Run 263 (`92f0499` docs audit 12:18) **success** (05:20Z).

## Rekomendasi untuk Agent Berikutnya

1. SELESAI (Superagent, 09:40 WIB 17-09): E2E smoke /auth/ di clinqoo.pages.dev — redirect Google & GitHub ke gerbang OAuth terverifikasi. Sisa: owner sekali uji login nyata (klik lanjut masuk akun).
2. Pastikan deploy `clinqoo` selalu sertakan `functions/{mcp.js,rpc.js}` (aturan `0cdd1a2`).
3. Setelah promo selesai: pita kartu Pro kembalikan ke "Paling Populer".
4. SELESAI: `set_balance` admin-only (`164689f`) live di clincoo-be2.
5. SELESAI: `upsertOauthUser` aman untuk OAuth tanpa email (`4ff816e`) live di clincoo-be2.
6. Semua laporan email hanya ke **muzawwied@gmail.com**.
7. Blog baru (`muzawwied/Clinqoo-Blog`) konten/perf saja — pantau jika nanti di-wire ke auth/wallet.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
*Wiki + automation selalu dicek di setiap sesi.*
