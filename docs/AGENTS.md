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

## Status Saat Ini (update terakhir: 2026-09-21 06:55 WIB)

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
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html` SHA `c79d1748`. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| Probe Gemini tanpa auth (`kbdiag.js`) | TERATASI | Dihapus di `e4ec785`. Temuan kritis audit 19:10 selesai. |
| Probe admin Gemini | Sementara | `functions/api/diag-gemini.js` masih di HEAD — gate `ADMIN_EMAILS` / `qa.*@clincoo.dev`, tidak tampilkan key mentah. Hapus setelah diagnosa. |
| Probe streaming (`streamtest.js`) | TERATASI | Dihapus di `9b8f4564` — item probe streaming selesai. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI — HTTP 405 | Live product: POST `https://clinqoo.pages.dev/mcp` dan POST `https://app.clincoo.buzz/mcp` = 405 body kosong. Gejala: `functions/mcp.js` tidak ter-serve (deploy statis / tanpa function MCP). Redeploy project clinqoo BERSAMA functions/mcp.js. Jangan samakan connector-tool 405 dengan product 405. |
| CI deploy production | Update | `e08ff661` job deploy-production `app.clincoo.buzz` otomatis tiap push (akun Vylonium). |
| Editor / UI | Update | HEAD `57e484ca`: fix mobile auto-zoom Monaco 16px. Sejak 05:03: UI chat/progress + esc(); hapus AI dari editor Clincoo Code; hapus welcome; badge English; hapus drawer/CTA/settings popup; IIFE mati; inline code color + English task labels; hapus fullstack.js Database Lokal & API Tester. Bukan auth/wallet/schema. |
| Wallet / langganan / schema | Update | Binding `WALLET_DB` + tabel wallet. Pastikan binding Pages production. |
| Sync users-live | OK — jalan | Clinqoo-Data terbaru `1de2e8c8` (00:16 UTC). |
| Blog | OK | Clinqoo-Blog: artikel/sitemap akses & SEO (bukan kode app). |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 07:18 WIB ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD Clinqoo. `57e484ca` (2026-09-19T23:37:31Z). `upsertOauthUser` tetap FIXED. File `functions/api/auth/shared.js` SHA `6f6dff57` tidak disentuh. Regresi deploy MCP product 405. Bug terbuka lama: oauthRedirectUri github.io `/Clincoo./`; `diag-gemini.js` masih sementara. `streamtest.js` sudah dihapus.

---

### 2026-09-21 06:35 WIB — Superagent (Base44): SEO rebrand "bangun & publikasikan" + Google Analytics
- Arah Devconium: hapus klaim marketing "bikin situs dengan AI" (AI belum bisa bangun situs); semua judul/deskripsi SEO Clincoo diarahkan ke esensi "bangun dan publikasikan situs".
- Judul landing/index.html + landing/offline.html → "Clincoo — Bangun dan Publikasikan Situs, Tanpa Coding" (title, og:title, twitter:title, twitter:image:alt). Pola deskripsi "platform pembuatan website dengan AI: template profesional, generate AI, editor kode, dan deploy instan" → "platform untuk bangun dan publikasikan situs: template profesional, editor kode, dan deploy instan" di 95 file (meta + og + twitter desc). Judul proyek/workspace/editor → "Clincoo Code — Bangun dan Publikasikan Situs Langsung dari Browser".
- GA G-KMQ8WBZF6E ditambah ke 45 halaman yang belum punya (akun/*, auth/, demo/*, landing/, legal/*, proyek/*, templates/*). Favicon ditambah di akun/langganan/kredit/index.html + demo/portfolio/404.html.
- Commit 2b309f4 (merge 9ba6505), deploy-production success (run 35544425640/35544424751). Terverifikasi live: /landing/ judul baru, akun/Profile desc baru, GA aktif di semua yang dicek.
- Repo clincoo-domain-exp: GA G-KMQ8WBZF6E ke 8 halaman (e2a41e2, merge b446f09), live di GitHub Pages.
- BLOCKER deploy landing clincoo.buzz: project clincoo-landing ada di akun Vylonium0 (59db6147), CLOUDFLARE_TOKEN yang tersedia hanya akses akun a393 (clinqoo, clinqoo-landing, clinqoo-wallet, fn-fresh-test) — API 10000 auth error. File landing baru (judul+GA, base dari live terbaru) sudah siap di workspace Superagent, menunggu token akun Vylonium0.
- Catatan editor standalone: project clinqoo-editor tidak ada di akun a393 dan editor.clincoo.buzz tidak resolve; source build-editor di workspace sudah di-update judul/desc/GA tapi belum bisa dideploy.

### 2026-09-21 07:10 WIB — Superagent (Base44): judul + deskripsi final Clincoo (revisi Devconium)
- Judul utama → "Clincoo — Bangun & Publikasikan Situsmu dengan Mudah"; deskripsi → "Bangun situs profesional dengan bantuan AI dan Monaco Editor, lalu publikasikan ke internet hanya dengan satu klik. Tanpa setup, tanpa ribet." Diterapkan di: index.html root (title/og/twitter + desc), landing/index.html + offline.html, dan pola deskripsi 95 halaman (prefix halaman tetap, mis. "Profil — kelola langsung di Clincoo. Bangun situs profesional...").
- Commit 42b0cb9 (merge d29606c), deploy-production success (run 35545176038). Terverifikasi live: /, /landing/, /akun/Profile/.
- deploy-landing/ + deploy-landing2/ (clincoo.buzz): file sudah pakai judul/deskripsi baru + GA — masih menunggu token akun Vylonium0 untuk deploy (blocker sama seperti entri sebelumnya).

### 2026-09-21 06:55 WIB — Superagent (Base44): hapus path /landing/ dari app.clincoo.buzz
- Arah Devconium: path /landing/ dihapus dari app.clincoo.buzz (landing Clincoo dilayani clincoo.buzz, bukan app). Commit 716f90c menghapus folder landing/ dari repo; deploy-production success (run 35545424455).
- Verifikasi origin: /landing/index.html 404, /landing/assets/* 404, /landing tanpa slash 404, request cache-busted ke /landing/ 404 — origin bersih.
- CATATAN cache: /landing/ (dengan slash) masih menyajikan HTML basi dari cache tepi zona clincoo.buzz (cache-control s-maxage=604800, aturan cache HTML 7 hari). Token a393 tidak punya akses zona clincoo.buzz (list zones kosong) jadi tidak bisa purge via API — perlu purge manual di dashboard (akun Vylonium0) atau tunggu max 7 hari.

## Log Interaksi Agent
### 2026-09-20 10:20 WIB — Superagent (Base44): repo eksperimen clincoo-domain-exp — footer legal
- Repo `muzawwied/clincoo-domain-exp` (GitHub Pages: muzawwied.github.io/clincoo-domain-exp/), commit `6be151d` lalu disempurnakan `6d4515a`: footer lama "Eksperimen CRUD Domain" dihapus dari semua halaman. Halaman depan (index.html) kini pakai footer SIMPEL satu baris terpusat nempel paling bawah: © 2026 Clincoo · SK/TOS · Kebijakan Privasi (link ke https://clincoo.buzz/legal/...). Footer dipindah keluar `<main>` dengan `mt-auto` (body flex-col) — commit `99fe542` karena versi sebelumnya masih di dalam main (main bukan flex container, mt-auto mati, footer nempel di bawah table). Halaman `tambah/` dan `verifikasi/` tanpa footer. Terverifikasi live di browser.
- Commit `8eec80b`: hilangkan tap-highlight putih saat klik (CSS tap-highlight-color transparent) & card/circle hover di icon aksi titik tiga (jadi icon polos).
- Commit `341b929`: baris daftar domain — hover/tap tidak lagi jadi abu-abu; klik baris domain → muncul garis bawah di nama domain lalu buka situs domain (anchor target _blank via goDomain()).
- Commit `ab17884`: halaman verifikasi disederhanakan sesuai arah backend nanti: hanya metode TXT record (tab Nameserver dihapus, TXT dipilih karena paling gampang dicek backend via DNS-over-HTTPS lookup), label "Belum terverifikasi" + tombol "Periksa Status Verifikasi" + hint dihapus (verifikasi langsung oleh sistem), CTA bawah jadi "Konfirmasi" → domain ditandai aktif di daftar.
- Commit `26390ed`: hapus arrow kanan di CTA Konfirmasi.
- Commit `0aa3c97`: Konfirmasi di halaman verifikasi kini TIDAK menandai domain aktif — status tetap "Belum terverifikasi", verifikasi menyusul oleh sistem/backend (cek TXT via DNS lookup). Label "Aktif" di daftar domain tanpa dot. Item "Edit Catatan" (modal + fungsi openEdit/saveNote) dihapus dari pop-up aksi — menu kini hanya Verifikasi Domain (jika pending) dan Hapus Domain.
- Commit `2a96170`: halaman `tambah/` judulnya jadi "Hubungkan Domain" (semantik connect domain), blok info "verifikasi lewat record DNS atau nameserver" dihapus (sudah tidak akurat, tinggal TXT). Modal hapus domain disederhanakan: tanpa ikon card, judul + teks domain saja, CTA "Batal"/"Hapus" jadi teks polos rata kanan (tanpa card/border/fill), radius modal rounded-lg.
- Commit `54815fa` + `e98cf26` + `a58f2df`: tombol daftar domain jadi "Hubungkan Domain" tanpa ikon plus; CTA di empty state dihapus. Pop-up aksi domain ditambah menu pengelolaan: Kelola DNS, SSL/TLS, Cache, Pengaturan Zone (Verifikasi Domain jika pending; Hapus Domain danger) — arah pengembangan: semua pengelolaan domain via API Cloudflare pakai secret CF di backend. Halaman baru `kelola/index.html` (prototipe, state di localStorage per-domain, belum nyambung CF API): tab DNS (list/tambah/hapus record), SSL/TLS (mode enkripsi + Always HTTPS + min TLS), Cache (purge, dev mode, tingkat cache), Pengaturan (pause zone, nameservers, plan). Fix a58f2df: bug string onclick `&tab=` tidak tertutup — menu kelola sempat tidak bisa navigasi.
- Commit `210b73b` + `dbbfb57`: halaman `kelola/` dipecah jadi 4 halaman terpisah (tanpa tab, tanpa sticky bar — fix latar tab putih di dark mode): `kelola/dns/`, `kelola/ssl/`, `kelola/cache/`, `kelola/zone/`, masing-masing baca `?domain=` di URL, state localStorage per-domain tetap sama (data lama terbawa). `kelola/index.html` (versi tab) dihapus. Fix dbbfb57: helper `dloc` di pop-up aksi menghasilkan identifier `s` tak terdefinisi — diganti path eksplisit per menu. Catatan: selalu uji klik menu kelola live setelah mengubah generator onclick.


### 2026-09-20 07:18 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 07:18 WIB **bukan All clear**. Scope sejak audit 2026-09-20 05:03 WIB. HEAD Clinqoo. `57e484ca` (2026-09-19T23:37:31Z). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Live MCP: POST `https://clinqoo.pages.dev/mcp` = HTTP 405 body kosong; POST `https://app.clincoo.buzz/mcp` = HTTP 405 body kosong. Regresi deploy tetap: `functions/mcp.js` tidak ter-serve. Perubahan kode sejak 05:03 (editor/UI, bukan auth/wallet/schema): `d5841c11` docs AGENTS.md laporan 05:03; `93247b61`, `88444814`, `ed293e92`, `9556cc90` UI chat/progress + fix fullstack esc(); `87736d16`, `c7a27a8c` hapus AI dari editor Clincoo Code; `0a16c10d` hapus halaman welcome; `1348bd07`, `e4726554` badge selesai English; `fae8c8ce`, `4eb2bcea` hapus drawer/CTA/settings popup; `09ffbbed` chore IIFE mati; `ba04b62c` inline code color + English task labels; `8dcd31bd` hapus fullstack.js Database Lokal & API Tester; `57e484ca` fix mobile auto-zoom Monaco 16px. Clinqoo-Data sync live jalan (terbaru `1de2e8c8` 00:16 UTC). Clinqoo-Blog: artikel/sitemap akses & SEO (bukan kode app). Issue/PR: 0 open. Bug terbuka lama: (1) oauthRedirectUri github.io masih `/Clincoo./` (benar `/Clinqoo./`) di `auth/index.html` SHA `c79d1748`; (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev); (3) `streamtest.js` sudah dihapus (`9b8f4564`). Rekomendasi: PRIORITAS redeploy Pages project clinqoo BERSAMA functions/mcp.js (verifikasi POST /mcp = JSON-RPC atau 401, bukan 405); hapus diag-gemini.js setelah diagnosa; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-20 07:18 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405; UI/editor berubah; auth tetap FIXED

### 2026-09-20 05:03 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 05:03 WIB **bukan All clear**. Scope sejak audit 2026-09-20 04:09 WIB. Connector Clinqoo MCP initialize: HTTP 405 (audit lewat GitHub + curl live). HEAD Clinqoo. `ea49c002` — fix: pesan user (`body.message`) tidak dibuang saat fallback tanpa array messages (2026-09-19T21:54:25Z). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Perubahan sejak 04:09: Clinqoo. kode app `6fb39df1` docs AGENTS.md dari laporan 04:09 WIB; `b060dca2` fix streaming progres: proses di waitUntil (error 1101); `9b8f4564` chore: hapus probe streamtest; `b91e73f6` fix: event thinking tidak menonaktifkan timeout retry 120s; `ea49c002` fix: body.message dipertahankan pada fallback tanpa messages[]. Clinqoo-Data sync live: `a65c89fe` (21:15 UTC), `0e8c983a` (21:31), `f9fc4370` (21:46), `f56334d6` (22:01 UTC). Clinqoo-Blog / Editor / Landing / Legal: tidak ada commit baru. Issue/PR: 0 open. Temuan live: POST `https://clinqoo.pages.dev/mcp` = HTTP 405 body kosong; POST `https://app.clincoo.buzz/mcp` = HTTP 405 body kosong. Regresi deploy tetap: `functions/mcp.js` tidak ter-serve. Bug terbuka lama: (1) oauthRedirectUri github.io masih `/Clincoo./` (benar `/Clinqoo./`) di `auth/index.html` SHA `c79d1748`; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev). (3) `streamtest.js` SUDAH dihapus (`9b8f4564`) — item probe streaming selesai. Rekomendasi: PRIORITAS redeploy Pages project clinqoo BERSAMA functions/mcp.js (verifikasi POST /mcp = JSON-RPC atau 401, bukan 405); hapus diag-gemini.js setelah diagnosa; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-20 05:03 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405; streamtest.js sudah dihapus

### 2026-09-20 04:09 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 04:09 WIB **bukan All clear**. Scope sejak audit 2026-09-20 02:18 WIB. Connector Clinqoo MCP initialize: HTTP 405 (audit lewat GitHub + curl live). HEAD Clinqoo. `7fa510f7` (docs: update AGENTS.md dari laporan 02:18 WIB; author-date 2026-09-19T19:19:36Z). Kode app/auth/wallet/schema/middleware TIDAK berubah sejak `b0db70da`. `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57` — tidak disentuh. Perubahan sejak 02:18: Clinqoo. hanya `7fa510f7` docs AGENTS.md; Clinqoo-Data sync live `b015d415` (19:30 UTC), `242fda82` (19:45), `ccb888cb` (20:00), `56dcacfa` (20:15), `6c1c4a4a` (20:30), `7ef7ead0` (20:45), `f9b3798b` (21:00 UTC); Clinqoo-Blog commit SEO `289ae9db`, `055c0d94`, `3e3348f6`, `3acf6d6f`, `77871ac3` (~19:18–19:21 UTC) — artikel/sitemap, bukan kode app; Editor / Legal / Landing tidak ada commit baru; Issue/PR 0 open. Temuan live (bukan commit baru): POST `https://clinqoo.pages.dev/mcp` = HTTP 405 body kosong; POST `https://app.clincoo.buzz/mcp` = HTTP 405 body kosong. Regresi deploy tetap: `functions/mcp.js` tidak ter-serve. Bug terbuka lama (bukan regresi kode): (1) oauthRedirectUri github.io masih `/Clincoo./` (benar `/Clinqoo./`) di `auth/index.html` SHA `c79d1748`; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. (2) `functions/api/diag-gemini.js` masih di HEAD (gate ADMIN_EMAILS / qa.*@clincoo.dev). (3) `functions/api/auth/streamtest.js` probe sementara tanpa auth — hapus setelah tes streaming. Rekomendasi: PRIORITAS redeploy Pages project clinqoo BERSAMA functions/mcp.js (verifikasi POST /mcp = JSON-RPC atau 401, bukan 405); hapus streamtest.js + diag-gemini.js; perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; jangan ubah upsertOauthUser tanpa tes email-null GitHub; cek RESEND_API_KEY; WALLET_DB binding Pages production; rebrand jangan rename domain/repo/path github.io/identifier.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-20 04:09 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405

### 2026-09-20 02:18 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 02:18 WIB **bukan All clear**. Scope sejak audit 2026-09-20 00:03 WIB. Connector Clinqoo MCP initialize: HTTP 405 (audit lewat GitHub + curl live). HEAD Clinqoo. `a1c2a9a0` (docs: update AGENTS.md dari laporan 00:03 WIB). Kode app tidak berubah sejak `b0db70da`. Product MCP live 405. Bug lama: oauthRedirectUri `/Clincoo./`; diag-gemini.js; streamtest.js.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-20 02:18 WIB` dari Devconium
- Status: **bukan All clear** — regresi deploy MCP product 405

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. **PRIORITAS:** Redeploy Pages project `clinqoo` BERSAMA `functions/mcp.js`. Verifikasi POST `/mcp` = JSON-RPC atau 401, **bukan 405**. Product live saat ini 405 (regresi deploy).
2. Jangan samakan connector-tool 405 dengan product 405 — product sekarang benar-benar 405.
3. ~~Hapus `functions/api/auth/streamtest.js`~~ — **selesai** di `9b8f4564`.
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
