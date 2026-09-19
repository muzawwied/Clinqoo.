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

## Status Saat Ini (update terakhir: 2026-09-19 12:32 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. SHA file `6f6dff57`. Diverifikasi audit 12:06. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html` ~L419. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI 405 | Connector initialize HTTP 405 (`functions/mcp.js` tidak ter-deploy). Redeploy project clinqoo + functions. |
| Wallet / langganan / schema | OK | schema tidak berubah; Wallet HEAD `59fb31e8` spinner UI (bukan skema saldo). |
| Editor repo | OK (live pecah) | Repo HEAD `8eef3328` tidak berubah. Live editor.clincoo.buzz dipecah Superagent (index/style/app.js), redirect pid dihapus, section fitur welcome dihapus — deploy manual. |
| Blog | OK | HEAD `b5b46454` tidak berubah sejak 11:17 |
| Clinqoo-Data | OK | HEAD `85a16670` tidak berubah |
| Clinqoo-Legal | OK | HEAD `5ad44340` kemarin |
| Landing / DNS | Update | icon SVG monokrom `8b23b1a` / `6a7e784`. DNS ke alias project (bukan pin). |
| Chat workspace | Update | push otomatis permanen `712c7bc`; kapsul mode UI dihapus `f5bc944`; kartu Pengaturan Umum `b581959` |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 12:06 ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD wiki Clinqoo. `7e18b759`. Kode auth/OAuth/wallet/schema/middleware tidak disentuh. Bug terbuka (bukan regresi baru): oauthRedirectUri github.io `/Clincoo./`; POST `/mcp` 405.

---

## Log Interaksi Agent
### 2026-09-19 12:32 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 12:06 WIB **bukan All clear**. Scope sejak 11:17. HEAD `7e18b759` (docs wiki welcome editor). Kode app: chat permanen push workspace `712c7bc` (toggle dihapus); kartu proyek dari Pengaturan Umum `b581959`; hapus UI kapsul mode `f5bc944`; landing icon SVG `8b23b1a` / `6a7e784`. Auth/OAuth/wallet schema/middleware tidak disentuh. MCP initialize HTTP 405 (`functions/mcp.js` tidak ter-deploy). `upsertOauthUser` tetap FIXED (SHA `6f6dff57`). Bug terbuka (bukan regresi baru): oauthRedirectUri github.io `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`); POST `/mcp` → 405. Wallet `59fb31e8`, Editor repo `8eef3328` (live pecah Superagent, tidak di repo), Blog `b5b46454`, Data `85a16670`, Legal `5ad44340` tidak berubah setelah 11:17. Issue/PR 0. CORS `*.clincoo.buzz` OK. Rekomendasi: redeploy MCP + `functions/mcp.js`; perbaiki Clincoo.→Clinqoo. di oauthRedirectUri github.io; daftarkan redirect URI `app.clincoo.buzz/auth/` dan `clinqoo.pages.dev/auth/`; DNS landing ke alias project; cek `RESEND_API_KEY`; jangan rename domain/repo/path github.io.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 12:06 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 12:06 WIB — Grok (xAI) hourly audit
- Connector Clinqoo MCP: initialize HTTP 405 (audit via GitHub).
- `upsertOauthUser` tetap FIXED. oauthRedirectUri github.io `/Clincoo./` masih ada.
- Sejak 11:17: chat push workspace permanen `712c7bc`, kartu Pengaturan Umum `b581959`, kapsul mode dihapus `f5bc944`, landing icon `6a7e784`, wiki editor pecah + hapus section fitur.
- Issue/PR: 0.
- Status: **bukan All clear**. Email `[Clinqoo Hourly Audit] 2026-09-19 12:06 WIB` terkirim.

### 2026-09-19 12:25 WIB — Superagent (Base44): hapus section fitur di welcome editor
- Owner minta hapus bagian "Fitur Standar Web Code Editor" dari welcome screen editor.clincoo.buzz.
- `build-editor/index.html`: div `.home-features` dihapus. Deploy manual `clinqoo-editor`.

### 2026-09-19 12:10 WIB — Superagent (Base44): editor.clincoo.buzz dipecah + halaman depan dihapus
- Project `clinqoo-editor` dipecah index.html + style.css + app.js. Redirect pid dihapus.

### 2026-09-19 11:55 WIB — Superagent (Base44): mode push workspace jadi permanen
- `proyek/chat/index.html` commit `712c7bc`: tombol toggle dihapus; aturan selalu aktif.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy MCP ke clinqoo.pages.dev dengan `functions/mcp.js` jika POST `/mcp` 405. Jangan deploy statis murni.
2. Perbaiki path github.io `Clincoo.` → `Clinqoo.` pada `oauthRedirectUri` (`auth/index.html` L419).
3. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
4. Landing: DNS `clincoo.buzz`/`www` ke alias project (bukan pin deployment).
5. CORS `*.clincoo.buzz` sudah ada — jangan ulang sebagai bug.
6. Cek `RESEND_API_KEY`.
7. Email hanya ke **muzawwied@gmail.com**.
8. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
9. Rebrand: jangan rename domain/repo/path github.io/identifier.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
