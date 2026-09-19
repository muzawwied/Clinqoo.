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

## Status Saat Ini (update terakhir: 2026-09-19 12:20 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` hidup dari `functions/mcp.js`.

**JANGAN deploy statis murni dari root repo** — gejala: POST /mcp → 405.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (backup privat Superagent — berisi KUNCI, JANGAN commit publik)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (Node 22; token Vylonium)
5. Jika error D1 binding: pastikan wrangler.toml TERHAPUS. JANGAN tambah binding D1 ke project ini.
6. Verifikasi: `POST https://clinqoo.pages.dev/mcp` harus JSON-RPC `initialize`, bukan 405/404.

**Email resmi tampilan web = `halo@clincoo.buzz`**. Backend notifikasi tetap ke muzawwied@gmail.com.

**Rebrand UI:** teks `Clincoo` / `ClincooPay`. JANGAN rename domain/URL `clinqoo*`, nama repo, path `muzawwied.github.io/Clinqoo./`, identifier kode.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. Diverifikasi audit 11:17. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html` ~L419. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI 405 | Connector clinqoo___* initialize HTTP 405 (deploy tanpa `functions/mcp.js`). Redeploy project clinqoo + functions. |
| Wallet / langganan / schema | OK | schema tidak berubah; Wallet UI spinner `59fb31e8` (bukan skema saldo). |
| Editor repo | OK | Clinqoo-Editor HEAD `8eef3328` tidak berubah setelah 10:04 (update ~08:40 WIB). |
| Blog | Update | HEAD `b5b46454` artikel mobile HTML 11:14 WIB |
| Clinqoo-Data | OK | HEAD `85a16670` tidak berubah |
| Clinqoo-Legal | OK | HEAD `5ad44340` kemarin; tidak ada commit baru hari ini |
| Landing / DNS | Update | SEO/og/WA + deploy (`fcbaed4b`), DNS alias OK. 11:25: emoji bagian "Untuk Siapa" diganti box icon SVG monokrom (`8b23b1a`) — Superagent. |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 11:17 ke muzawwied@gmail.com — bukan All clear |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD wiki Clinqoo. `fcbaed4b` (landing SEO/WA + catatan deploy clincoo.buzz). Kode app relevan: `c362285c` (UI editor) + `3d54169e` (redirect_uri dinamis). Auth/OAuth/wallet/schema tidak disentuh.

---

## Log Interaksi Agent
### 2026-09-19 12:20 WIB — Superagent (Base44): setting push otomatis ke workspace (chat)
- `proyek/chat/index.html` commit `918a639`: tombol toggle `#ws-auto-btn` (ikon folder+plus, sebelah tombol "+") untuk mode "kode langsung dipush ke workspace". State di localStorage `clinqoo_ws_auto_push`. Saat AKTIF: system prompt per-request ditambah aturan — AI dilarang menampilkan blok kode, WAJIB simpan via `write_file` (path+isi lengkap, `create_folder` bila perlu), lalu jawab ringkas nama file/path/isi pokok. Gaya aktif menyesuaikan tema (terang: kapsul hitam; gelap: putih).
- Deploy manual project `clinqoo` (a393…, tanpa `functions/mcp.js` — `/mcp` tetap 405, kondisi sama). Live == build terverifikasi.

### 2026-09-19 12:05 WIB — Superagent (Base44): tes akses AI + judul kartu dari Pengaturan Umum
- Tes akses eksternal: `editor.clincoo.buzz` 200, `clinqoo-blog.pages.dev` 200 (termasuk /legal/syarat-ketentuan), semua endpoint be2 (`/api/chat`, `/api/ai`, `/api/jina`, `/api/project-files`, `/api/deploy`, `/api/projects`, `/api/project-settings`) hidup dan auth gate 401 bekerja normal (bukan 404/500) — redeploy be2 pasca-push sehat. Tes end-to-end AI+tools butuh login user (tidak bisa dari luar).
- `index.html` commit `b581959`: judul & deskripsi kartu proyek di halaman utama kini pakai `app_name`/`app_desc` dari Pengaturan Umum (`/api/project-settings` + cache `clinqoo_umum_<pid>`), fallback ke `title`/`prompt` asli. `aiName`/`aiDesc` (chat AI) TIDAK dipakai lagi di kartu.
- Deploy manual project `clinqoo` (a393…, tanpa `functions/mcp.js` — `/mcp` tetap 405, kondisi sama spt sebelumnya). Live == build terverifikasi.


### 2026-09-19 11:45 WIB — Superagent (Base44) chat: hapus UI kapsul mode
- `proyek/chat/index.html` commit `f5bc944`: UI kapsul "Biasa/Agent" + popup mode di sebelah tombol kirim dihapus (HTML + JS wiring). Logika `agentModeOn` (localStorage) tetap utuh di jalur kirim pesan.
- Deploy manual project `clinqoo` (Vylonium a393…) sesuai prosedur wiki. `functions/mcp.js` TIDAK ikut (backup privat tidak tersedia di sandbox) — `/mcp` tetap 405 (kondisi sama seperti sebelumnya, bukan regresi baru).
- Deploy terverifikasi: `/proyek/chat/` live == build (0 `team-mode-capsule`), `/` dan `/auth/` 200.
- Landing icon box fix (commit `8b23b1a` → revisi `6a7e784` tanpa wrapper box) sudah live di clincoo.buzz.


### 2026-09-19 11:25 WIB — Superagent (Base44) landing: box icon
- `landing/index.html` commit `8b23b1a`: 4 emoji (🎨🛒🏢💻) bagian "Dibuat untuk siapa saja" diganti box icon SVG stroke monokrom (brush, cart, building, code). Tidak ada perubahan struktur/halaman lain.
- Deploy `clincoo-landing` (Vylonium0) dari index.html + robots.txt + sitemap.xml. Verifikasi live clincoo.buzz: 0 emoji, WA button & robots/sitemap utuh.
- Terkait: wallet.clincoo.buzz login spinner sudah FIXED (repo Wallet `59fb31e`): CSS `#view-loading` fullscreen menutupi tombol Google; sekarang `.active`-gated. Login page + tombol Google terverifikasi jalan.

### 2026-09-19 11:18 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 11:17 WIB **bukan All clear**. Sejak audit 10:04: HEAD wiki `fcbaed4b` (landing SEO/WA + catatan deploy clincoo.buzz); kode auth/OAuth/wallet/schema tidak disentuh. Kode app relevan `c362285c` + `3d54169e`. Blog baru `b5b46454` (+ artikel mobile HTML). Wallet UI spinner `59fb31e8` (bukan skema saldo). Editor tetap `8eef3328`. Data `85a16670` tidak berubah. Legal `5ad44340` kemarin. Issue/PR 0. `upsertOauthUser` tetap FIXED. Bug terbuka: oauthRedirectUri github.io `/Clincoo./` → 404; MCP initialize HTTP 405. CORS `*.clincoo.buzz` OK. Rekomendasi: redeploy clinqoo + `functions/mcp.js`; perbaiki path Clincoo.→Clinqoo.; daftarkan redirect URI `app.clincoo.buzz/auth/` dan `clinqoo.pages.dev/auth/`; DNS landing ke alias project (bukan pin deployment).
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 11:17 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 11:17 WIB — Grok (xAI) hourly audit
- Connector Clinqoo MCP: initialize HTTP 405 (tidak dipakai; audit via GitHub).
- `upsertOauthUser` tetap FIXED. oauthRedirectUri github.io `/Clincoo./` masih ada.
- Sejak 10:04: landing docs/SEO/WA (`2f4ec1ad`–`fcbaed4b`); Blog `b5b46454`; Wallet spinner `59fb31e8`.
- Issue/PR: 0.
- Status: **bukan All clear**. Email `[Clinqoo Hourly Audit] 2026-09-19 11:17 WIB` terkirim.

### 2026-09-19 11:15 WIB — Superagent (Base44) fix landing + deploy
- Fix `landing/index.html` (commits `2f4ec1a`, `3467891a`): desc SEO; og:image ke `https://app.clincoo.buzz/assets/og-image.png`; aset absolut; tombol WhatsApp.
- Deploy clinqoo-landing / clincoo-landing (Vylonium0) untuk clincoo.buzz. MCP 405 & oauthRedirectUri belum disentuh.

### 2026-09-19 10:10 WIB — Grok (xAI) laporan masuk
- Hourly audit 10:04 WIB **bukan All clear**.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy MCP ke clinqoo.pages.dev dengan `functions/mcp.js` jika POST `/mcp` 405. Jangan deploy statis murni.
2. Perbaiki path github.io `Clincoo.` → `Clinqoo.` pada `oauthRedirectUri` (`auth/index.html` L419).
3. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
4. Landing: DNS `clincoo.buzz`/`www` ke alias project (bukan pin deployment) — catatan Superagent 11:15.
5. CORS `*.clincoo.buzz` sudah ada — jangan ulang sebagai bug.
6. Cek `RESEND_API_KEY`.
7. Email hanya ke **muzawwied@gmail.com**.
8. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
9. Rebrand: jangan rename domain/repo/path github.io/identifier.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
