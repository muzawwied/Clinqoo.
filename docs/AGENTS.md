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

## Status Saat Ini (update terakhir: 2026-09-19 06:02 WIB)

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

**Rebrand UI (2026-09-18/19):** seluruh teks UI pengguna sekarang `Clincoo` / `ClincooPay` — LANDING (clinqoo-landing), situs utama (clinqoo), Wallet (clinqoo-wallet), Editor (clinqoo-editor, "Clincoo Code"), Blog (clinqoo-blog), Legal (clinqoo-legal). Yang TIDAK boleh ikut di-rename: domain/URL `clinqoo*`, nama repo & path GitHub (mis. `muzawwied.github.io/Clinqoo./`), identifier kode (ClinqooAPI, ClinqooAuth, dsb), dan kunci API. Gunakan rename kata utuh (`\bClinqooPay\b` dulu, baru `\bClinqoo\b`), JANGAN regex tanpa word-boundary.

Deploy proyek UI lain (semua manual, `wrangler pages deploy`):
- `clinqoo-wallet` (akun Vylonium a393): dari repo `Wallet`. Frontend saja — API dipanggil ke `wallet-muz.pages.dev`, `functions/api/wallet.js` lokal tidak terpakai. HAPUS `wrangler.toml` dari folder deploy (binding D1 `wallet-db` tidak berlaku untuk project ini).
- `clinqoo-editor` (akun Vylonium a393): dari repo `Clinqoo-Editor`, deploy seluruh isi repo.
- `clinqoo-blog` (akun 59db6147 "Clinqoo"): dari repo `Clinqoo-Blog`, deploy seluruh isi repo, gunakan token akun tersebut.
- `clinqoo-legal` (akun Vylonium a393): dari repo `Clinqoo-Legal`, deploy tanpa `build.py`/`README.md`. Halaman dilayani di root; pretty URL `/syarat-ketentuan`, `/kebijakan-privasi`, dst. Link internal harus ke root (`/xxx.html`), bukan `/legal/*` (fallback SPA menampilkan index).

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id di `functions/api/auth/shared.js`. Diverifikasi 06:02. |
| Deploy user sites | OK | Kode app `0fb459d6` + rebrand UI `c44e6c71` |
| Seed tabel proyek | OK | `b25ea866` |
| Galeri template | OK | Email review JPEG + fallback |
| CCTV `security_events` | Minor | `logBlocked` CREATE TABLE tanpa `.run()` (known) |
| Encoding karakter | Minor | Mojibake em-dash |
| Schema D1 vs runtime | Gap known | `security_events` belum di schema.sql |
| Editor full-stack | OK | HEAD `29d5033` (rebrand UI) |
| AI chat / Tim AI | Backlog | Dual-mode + loop/SSOT/maxOutputTokens/Doctor Deploy |
| Promo | OK | |
| Deploy MCP | OK — FIXED | Re-deploy sesuai prosedur; POST /mcp JSON-RPC initialize |
| Wallet / langganan | OK | HEAD `95a42372` rebrand ClincooPay |
| Middleware | OK + catatan | ORIGIN_ALLOW belum `*.clinqoo.biz.id` |
| Hourly audit automation | OK | Audit 06:02: All clear — tidak kirim email |
| Wiki / AGENTS.md | OK | Email resmi hanya gmail.com |
| Issue GitHub | OK | 0 open, 0 PR open |
| Blog | OK | HEAD `93d62bc3` rebrand + artikel template |
| Clinqoo-Data | OK | Sync rutin `85a16670` 22:45Z / 05:45 WIB |
| Landing | OK | Rebrand di repo utama `e8c31d64`; repo Landing tetap `280302d9` |
| Legal | OK | `5ad44340` fix path root + `8446b521` rebrand |

**All clear** — tidak ada bug kritis baru. Sejak audit 05:10: rebrand UI Clincoo di Clinqoo./Wallet/Editor/Blog/Legal (disengaja), cleanup email, sync Data, artikel blog. OAuth tetap FIXED. Tidak kirim email.

---

## Log Interaksi Agent

### 2026-09-19 06:02 WIB — Grok (xAI) hourly audit
- HEAD sebelumnya `8c4af590` (audit 05:10 All clear); HEAD sekarang `89dc645e` (docs rebrand + prosedur deploy).
- Sejak 05:10: rebrand UI `c44e6c71` + landing `e8c31d64` + cleanup email `f4ea447b` (Clinqoo.). Wallet `95a42372`. Editor `29d5033`. Blog `93d62bc3`. Legal `5ad44340`. Data `85a16670`.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (dibaca ulang 06:02, file tidak diubah oleh rebrand).
- Issue/PR open: 0.
- Rebrand disengaja, bukan regresi OAuth/wallet/middleware. Minor CCTV/schema tetap terbuka.
- Status: **All clear**. Tidak kirim email.

### 2026-09-19 05:10 WIB — Grok (xAI) hourly audit
- HEAD wiki sebelumnya `a30c2067` (audit 04:08 All clear).
- Kode produk terakhir tetap `0fb459d6` @ 10:53Z.
- Sejak 04:08: Clinqoo-Data sync rutin (`d8943366` 05:01 WIB). Blog `263cb982` (batch 5 artikel security ~04:23–04:25 WIB). Editor/Landing tidak berubah.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (dibaca ulang 05:10).
- Issue/PR open: 0. Editor `6e4d516`. Landing `280302d9`.
- MCP 405 known. Minor CCTV/schema tetap terbuka, bukan kritis baru.
- Status: **All clear**. Tidak kirim email.

### 2026-09-19 04:08 WIB — Grok (xAI) hourly audit
- HEAD wiki sebelumnya `72c31521` (audit 03:10 All clear).
- Kode produk terakhir tetap `0fb459d6` @ 10:53Z.
- Sejak 03:10: Clinqoo-Data sync rutin (`42e93ea6` 04:00 WIB). Blog `5a30abb7` (artikel security-audit / security-izin / security-form). Editor/Landing tidak berubah.
- `upsertOauthUser`: emailNorm + INSERT + last_row_id — **FIXED** (dibaca ulang 04:08).
- Issue/PR open: 0. Editor `6e4d516`. Landing `280302d9`.
- MCP 405 known. Minor CCTV/schema tetap terbuka, bukan kritis baru.
- Status: **All clear**. Tidak kirim email.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy project `clinqoo` DENGAN `functions/mcp.js` (jangan sertakan wrangler.toml / D1 binding) jika POST `/mcp` kembali 405.
2. Fix `logBlocked` di `functions/api/_middleware.js`: panggil `.run()` pada CREATE TABLE.
3. Tambah `security_events` ke schema.sql.
4. Pertimbangkan ORIGIN_ALLOW untuk `*.clinqoo.biz.id`.
5. Email hanya ke **muzawwied@gmail.com**.
6. Backlog AI: dual-mode, SSOT kuota, maxOutputTokens 8192, Doctor Deploy.
7. OAuth tetap jangan diubah tanpa tes email-null GitHub.
8. Rebrand Clincoo: jangan rename domain/repo/identifier kode.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
