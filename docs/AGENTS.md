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

## Status Saat Ini (update terakhir: 2026-09-19 22:25 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` hidup dari `functions/mcp.js`.

**JANGAN deploy statis murni dari root repo** — gejala: POST /mcp → 405.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (backup privat Superagent — berisi KUNCI, JANGAN commit publik)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (Node 22; token Vylonium)
5. Jika error D1 binding: pastikan wrangler.toml TERHAPUS. JANGAN tambah binding D1 ke project ini.
6. Verifikasi: `POST https://clinqoo.pages.dev/mcp` harus JSON-RPC. Tanpa key → 401 Unauthorized (function hidup). Bukan 405/404.

**Email resmi tampilan web = `halo@clincoo.buzz`**. Backend notifikasi tetap ke muzawwied@gmail.com.

**Rebrand UI:** teks `Clincoo` / `ClincooPay`. JANGAN rename domain/URL `clinqoo*`, nama repo, path `muzawwied.github.io/Clinqoo./`, identifier kode. Pelajaran: `GH_REPO` sempat salah jadi Clincoo-Data — sync users-live mati sampai `100c2f50`.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. SHA file `6f6dff57`. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html`. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| Probe Gemini tanpa auth (`kbdiag.js`) | TERATASI | Dihapus di `e4ec785`. Temuan kritis audit 19:10 selesai. |
| Probe admin Gemini | Sementara | `functions/api/diag-gemini.js` masih di HEAD — gate `ADMIN_EMAILS` / `qa.*@clincoo.dev`, tidak tampilkan key mentah. Hapus setelah diagnosa. |
| Probe streaming (`streamtest.js`) | Sementara — hapus | HEAD `b0db70da`: `functions/api/auth/streamtest.js` (TransformStream, tanpa auth; GET “streamtest up”, POST NDJSON dummy). Risiko rendah (tidak pakai GEMINI_API_KEY) tapi endpoint publik sementara. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI — HTTP 405 | Live product: POST `https://clinqoo.pages.dev/mcp` dan POST `https://app.clincoo.buzz/mcp` = 405 body kosong. GET /mcp pages.dev = 404 HTML (redirect ke app.clincoo.buzz). Gejala: `functions/mcp.js` tidak ter-serve (deploy statis / tanpa function MCP). Redeploy project clinqoo BERSAMA functions/mcp.js. Jangan samakan connector-tool 405 dengan product 405. |
| CI deploy production | Update | `e08ff661` job deploy-production `app.clincoo.buzz` otomatis tiap push (akun Vylonium). |
| AI chat / streaming | Update | `ebf98718` backend Gemini utama + streaming progres NDJSON (`chat.js`); `16a36c55` UI progres real-time AI. |
| Wallet / langganan / schema | Update | Binding `WALLET_DB` + tabel wallet. Pastikan binding Pages production. |
| Sync users-live | OK — jalan | Clinqoo-Data: `81f10343` (14:30 UTC), `29912bd9` (14:45), `11eec137` (15:00), `a7d9851b` (15:15 UTC). |
| Blog | Update | Clinqoo-Blog: tidak ada commit baru setelah 21:29. |
| Editor / Legal / Landing | OK | Tidak ada commit baru setelah 21:29. |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 22:25 ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD Clinqoo. `dbc6ef55` (docs AGENTS.md ~21:30 WIB). Kode app/auth/wallet/schema/middleware tidak berubah sejak `b0db70da`. Bug kritis: product MCP live 405 (regresi deploy). Bug terbuka lama: oauthRedirectUri github.io `/Clincoo./`; `diag-gemini.js` dan `streamtest.js` masih sementara.

---

## Log Interaksi Agent
### 2026-09-19 22:25 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 22:25 WIB **bukan All clear**. Scope sejak audit 21:29 WIB. Connector Clinqoo MCP initialize gagal HTTP 405 (audit lewat GitHub). HEAD Clinqoo. `dbc6ef55` (docs: update AGENTS.md dari laporan 21:29 WIB). Kode app/auth/wallet/schema/middleware TIDAK berubah sejak `b0db70da`. `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Perubahan sejak 21:29: Clinqoo. hanya `dbc6ef55` docs AGENTS.md (21:30 UTC / ~21:30 WIB); Clinqoo-Data sync live `81f10343` (14:30 UTC), `29912bd9` (14:45), `11eec137` (15:00), `a7d9851b` (15:15 UTC); Clinqoo-Blog / Editor / Legal / Landing tidak ada commit baru; Issue/PR 0 open. Temuan live (bukan commit baru): POST `https://clinqoo.pages.dev/mcp` = HTTP 405 body kosong; POST `https://app.clincoo.buzz/mcp` = HTTP 405 body kosong; GET `https://clinqoo.pages.dev/mcp` = 404 HTML (redirect script ke app.clincoo.buzz). Regresi deploy tetap: `functions/mcp.js` tidak ter-serve. Redeploy project clinqoo BERSAMA functions/mcp.js. Bug terbuka lama (bukan regresi kode): (1) oauthRedirectUri github.io masih `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html`; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev; tidak tampilkan key mentah) — hapus setelah diagnosa. (3) `functions/api/auth/streamtest.js` probe sementara tanpa auth — hapus setelah tes streaming. Rekomendasi: PRIORITAS redeploy Pages project clinqoo dengan functions/mcp.js (verifikasi POST /mcp = JSON-RPC atau 401, bukan 405); hapus streamtest.js + diag-gemini.js; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 22:25 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405

### 2026-09-19 21:29 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 21:29 WIB **bukan All clear**. Scope sejak audit 20:21 WIB. Connector Clinqoo MCP initialize gagal HTTP 405 (audit lewat GitHub). HEAD Clinqoo. `5a87c14b` (docs: update AGENTS.md dari laporan 20:21 WIB). Kode app/auth/wallet/schema/middleware tidak berubah sejak `b0db70da`. `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Perubahan sejak 20:21: Clinqoo. hanya `5a87c14b` docs AGENTS.md (20:29 WIB); Clinqoo-Data sync live berlanjut `fdffbe04` (13:30 UTC), `80f1afbb` (13:45), `1bc709bd` (14:00), `dd842d55` (14:15 UTC); Clinqoo-Blog / Editor / Legal / Landing tidak ada commit baru; Issue/PR 0 open. Temuan baru (live, bukan commit repo): POST `https://clinqoo.pages.dev/mcp` dan POST `https://app.clincoo.buzz/mcp` sekarang HTTP 405 body kosong; GET /mcp di pages.dev 404 HTML (redirect script ke app.clincoo.buzz). Audit 20:21 masih mencatat live product MCP 401 tanpa key = function hidup. Ini regresi deploy: `functions/mcp.js` tidak ter-serve (gejala deploy statis / tanpa function MCP). Ikuti prosedur AGENTS.md: deploy project clinqoo BERSAMA functions/mcp.js; jangan treat connector-tool 405 sama dengan product 405 — product sekarang benar-benar 405. Bug terbuka (bukan regresi kode baru): (1) oauthRedirectUri github.io masih `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html`; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev; tidak tampilkan key mentah) — hapus setelah diagnosa. (3) `functions/api/auth/streamtest.js` probe sementara tanpa auth — hapus setelah tes streaming. Rekomendasi: redeploy Pages project clinqoo dengan functions/mcp.js (verifikasi POST /mcp = JSON-RPC atau 401, bukan 405); hapus streamtest.js + diag-gemini.js; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan redirect URI; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 21:29 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405

### 2026-09-19 20:21 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 20:21 WIB **bukan All clear**. Scope sejak audit 19:10 WIB. Connector Clinqoo MCP initialize gagal HTTP 405 (audit lewat GitHub). Live product MCP 401 tanpa key = function hidup. HEAD Clinqoo. `b0db70da` (probe TransformStream streaming, sementara). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Perubahan sejak 19:10: `e4ec785` chore hapus probe `kbdiag.js` (temuan kritis audit sebelumnya TERATASI); `e08ff661` ci job deploy-production `app.clincoo.buzz` otomatis tiap push (akun Vylonium); `ebf98718` feat backend kualitas AI Gemini utama + streaming progres NDJSON (`chat.js`); `16a36c55` feat UI progres real-time AI; `b0db70da` probe BARU `functions/api/auth/streamtest.js` (TransformStream, tanpa auth; GET “streamtest up”, POST NDJSON dummy — risiko rendah, tidak pakai GEMINI_API_KEY, tapi endpoint publik sementara). Clinqoo-Data sync live `3d67ee6d` (13:15 UTC). Clinqoo-Blog halaman SEO komunitas + 5 artikel (`80af8586` dll, 13:18 UTC). Editor/Legal/Landing: tidak ada commit baru. Issue/PR 0 open. Bug terbuka (bukan regresi baru): (1) oauthRedirectUri github.io masih `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html`; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev; tidak tampilkan key mentah) — hapus setelah diagnosa. (3) `streamtest.js` probe sementara tanpa auth — hapus setelah tes streaming. Rekomendasi: hapus `streamtest.js` + `diag-gemini.js`; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan redirect URI; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier; MCP 401 tanpa key = hidup, jangan treat sebagai 405.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 20:21 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 19:10 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 19:10 WIB **bukan All clear**. Scope sejak audit 18:25 WIB. HEAD Clinqoo. `babb02a3` (chore: probe v2 — replikasi payload penuh, sementara). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Temuan BARU: (1) Endpoint probe tanpa auth `functions/api/auth/kbdiag.js` (commit `babb02a` / `c50c2d0`) — POST `/api/auth/kbdiag` memakai `env.GEMINI_API_KEY` dan menembak Gemini dengan system prompt + tool decls lengkap, tanpa cek session/admin; risiko abuse kuota kunci Gemini. (2) Endpoint probe admin `functions/api/diag-gemini.js` — gate `ADMIN_EMAILS` / `qa.*@clincoo.dev`, tidak menampilkan key mentah (hanya keyLen + status); masih sementara. Probe KB lama sudah dihapus (`aa750a13`, `e51736c2`) tapi probe Gemini masih di HEAD. Bug lama: oauthRedirectUri github.io masih `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html`. Domain aktif: `location.origin + '/auth/'`. Perubahan sejak 18:25: feat KB `search_clinqoo_kb` + snapshot 68 artikel blog + blogsearch bundled + prompt frontend (`75a20746`…`71a342c1`…`fdcda3f1`); chore probe Gemini + kbdiag v2 (`c50c2d0`, `babb02a`); Clinqoo-Data sync live `61de113` (12:00 UTC). Editor/Legal/Landing: tidak ada commit baru. Issue/PR 0 open. Connector Clinqoo MCP initialize gagal HTTP 405 (audit lewat GitHub). Live product MCP 401 tanpa key = function hidup. Rekomendasi: HAPUS segera `kbdiag.js` dan `diag-gemini.js` setelah diagnosa; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan redirect URI app.clincoo.buzz/auth/ dan clinqoo.pages.dev/auth/; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 19:10 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 18:25 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 18:25 WIB **bukan All clear**. Scope sejak audit 17:03 WIB. HEAD Clinqoo. `7ccf324` (feat chat checkpoint + kartu progres). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Bug terbuka (bukan regresi baru): oauthRedirectUri github.io masih `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html`. Domain aktif memakai `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. Perubahan sejak 17:03: `bd1790c` ci skip deploy jika hanya .md/docs (kurangi putus chat); `3ac5140` fix(chat) retry 3x backoff untuk 502/503/504/jaringan di multi-hop; `7ccf324` feat(chat) checkpoint saat token habis di tengah tugas + kartu progres tertutup default; Clinqoo-Data sync live `cd8d859` (11:16 UTC) — sinkron jalan; Clinqoo-Blog komunitas pages `946564c` (baru). Wallet `59fb31e8`, Editor `8eef3328`, Legal `5ad44340`, Landing `280302d9`: tidak ada commit baru setelah 17:03. Issue/PR 0 open. CORS `*.clincoo.buzz` OK. Rekomendasi: perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan redirect URI app.clincoo.buzz/auth/ dan clinqoo.pages.dev/auth/; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB pastikan binding Pages production; MCP 401 tanpa key = function hidup, jangan treat sebagai 405; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 18:25 WIB` dari Devconium
- Status: **bukan All clear**

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. **PRIORITAS:** Redeploy Pages project `clinqoo` BERSAMA `functions/mcp.js`. Verifikasi POST `/mcp` = JSON-RPC atau 401, **bukan 405**. Product live saat ini 405 (regresi deploy).
2. Jangan samakan connector-tool 405 dengan product 405 — product sekarang benar-benar 405.
3. **Hapus** `functions/api/auth/streamtest.js` setelah tes streaming selesai (endpoint publik tanpa auth).
4. **Hapus** `functions/api/diag-gemini.js` setelah diagnosa selesai.
5. Perbaiki path github.io `Clincoo.` → `Clinqoo.` pada `oauthRedirectUri` (`auth/index.html`).
6. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
7. Landing: DNS ke alias project (bukan pin). Jangan hidupkan lagi deploy-landing.yml ke project mirror.
8. CORS `*.clincoo.buzz` sudah ada — jangan ulang sebagai bug.
9. Cek `RESEND_API_KEY`.
10. Email hanya ke **muzawwied@gmail.com**.
11. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
12. Rebrand: jangan rename domain/repo/path github.io/identifier (lihat incident GH_REPO Clincoo-Data).
13. WALLET_DB: pastikan binding Pages production; catch sudah ada jika missing.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
