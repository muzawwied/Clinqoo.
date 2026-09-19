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

## Status Saat Ini (update terakhir: 2026-09-19 17:03 WIB)

## ATURAN WAJIB: Deploy ke Cloudflare Pages project `clinqoo` (clinqoo.pages.dev)

Project `clinqoo` (akun Vylonium a393, clinqoo.pages.dev) **WAJIB di-deploy BERSAMA functions MCP**. Endpoint `/mcp` hidup dari `functions/mcp.js`.

**JANGAN deploy statis murni dari root repo** — gejala lama: POST /mcp → 405.

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. SHA file `6f6dff57`. Diverifikasi audit 17:03. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html` L419. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | OK (401 tanpa key) | POST `/mcp` → 401 JSON-RPC Unauthorized, bukan 405. `functions/mcp.js` hidup. Jangan treat 401 sebagai 405. |
| Wallet / langganan / schema | Update | Binding `WALLET_DB` + tabel wallet di users-live.md (`a3b40fa9`, `7c6b06d4`, `fd698a28`). Debug env keys sementara `401da4a4` lalu dihapus `f28296d2`. Path wallet repo `59fb31e8`. Pastikan binding Pages production. |
| Sync users-live | FIXED | GH_REPO dikembalikan ke `muzawwied/Clinqoo-Data` (`100c2f50`). Data HEAD `992304ee` (10:01 UTC). |
| Editor repo | OK (live pecah) | Repo HEAD `8eef3328` tidak berubah setelah 16:07. |
| Blog | OK | HEAD `091b53e7`. Tidak berubah sejak 16:07. |
| Clinqoo-Legal | OK | HEAD `5ad44340`. |
| Landing / DNS | Update UI | Card statis `a9768b23`; workflow deploy-landing.yml dihapus `632dcdbf` (nyasar mirror). Landing repo `280302d9`. |
| Topup UI | Update | logo ClincooPay `3545ce43` |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 17:03 ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD Clinqoo. `3545ce43`. Bug terbuka: oauthRedirectUri github.io `/Clincoo./`.

---

## Log Interaksi Agent
### 2026-09-19 17:03 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 17:03 WIB **bukan All clear**. Scope sejak audit 16:07 WIB. HEAD Clinqoo. `3545ce43` (bukan lagi hanya docs). `upsertOauthUser` TETAP FIXED (emailNorm + INSERT + last_row_id). File `functions/api/auth/shared.js` SHA `6f6dff57`. Tidak disentuh. MCP live: POST `https://clinqoo.pages.dev/mcp` → 401 JSON-RPC Unauthorized (bukan 405). `functions/mcp.js` SUDAH hidup; butuh Bearer/?key. Regresi 405 dari audit sebelumnya teratasi. Bug terbuka (bukan regresi baru): oauthRedirectUri github.io `/Clincoo./akun/auth.html` → 404 (benar `/Clinqoo./`) di `auth/index.html` L419; domain aktif `location.origin + '/auth/'`; daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. Perubahan sejak 16:07: `100c2f50` fix GH_REPO Clincoo-Data → muzawwied/Clinqoo-Data (sync users-live mati sejak 05:50 WIB karena rebrand salah ubah konstanta); WALLET_DB binding + tabel wallet di users-live.md (`a3b40fa9`, `7c6b06d4`, `fd698a28`); debug env keys sementara `401da4a4` lalu dihapus `f28296d2`; `3545ce43` logo ClincooPay di topup; `632dcdbf` hapus deploy-landing.yml (nyasar project mirror); `a9768b23` landing card statis; Clinqoo-Data sync live `992304ee` (10:01 UTC) — sinkron jalan lagi. Wallet repo `59fb31e8`, Editor `8eef3328`, Legal `5ad44340`, Landing `280302d9`, Blog `091b53e7`: tidak ada commit baru setelah 16:07 kecuali Data sync. Issue/PR 0. CORS `*.clincoo.buzz` OK. Rekomendasi: perbaiki Clincoo.→Clinqoo. pada oauthRedirectUri github.io; daftarkan redirect URI app.clincoo.buzz/auth/ dan clinqoo.pages.dev/auth/; cek `RESEND_API_KEY`; jangan ubah `upsertOauthUser` tanpa tes email-null GitHub; rebrand jangan rename domain/repo/path github.io/identifier; WALLET_DB pastikan binding Pages production (catch sudah ada jika missing); MCP 401 expected tanpa key — jangan treat sebagai 405 lagi.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 17:03 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 16:07 WIB — Grok (xAI) laporan masuk
- Hourly audit 16:07 **bukan All clear**. MCP saat itu 405. upsertOauthUser FIXED. oauthRedirectUri `/Clincoo./` terbuka.
- Sumber: `[Clinqoo Hourly Audit] 2026-09-19 16:07 WIB`

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Perbaiki path github.io `Clincoo.` → `Clinqoo.` pada `oauthRedirectUri` (`auth/index.html` L419).
2. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
3. MCP 401 tanpa key = function hidup. Jangan laporkan 405 lagi kecuali benar-benar 405.
4. Landing: DNS ke alias project (bukan pin). Jangan hidupkan lagi deploy-landing.yml ke project mirror.
5. CORS `*.clincoo.buzz` sudah ada — jangan ulang sebagai bug.
6. Cek `RESEND_API_KEY`.
7. Email hanya ke **muzawwied@gmail.com**.
8. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
9. Rebrand: jangan rename domain/repo/path github.io/identifier (lihat incident GH_REPO Clincoo-Data).
10. WALLET_DB: pastikan binding Pages production; catch sudah ada jika missing.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
