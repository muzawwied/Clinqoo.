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

**JANGAN deploy statis murni dari root repo** — gejala: POST /mcp → 405.

Prosedur benar (Superagent, terverifikasi 2026-09-17):
1. Build dari `origin/main`: `git archive origin/main | tar -x -C build-dir`
2. Hapus dari build-dir: `functions/api/`, `functions/scheduled.js`, `wrangler.toml`, `wrangler-proxy.toml`, `.github/`, `agent-worker/`, `docs/`, `landing/`, `legal/`, `mcp-server/`, `schema.sql`, `.gitignore`
3. Tempel `functions/mcp.js` (backup privat Superagent — berisi KUNCI, JANGAN commit publik)
4. Deploy: `wrangler pages deploy . --project-name clinqoo` (Node 22; token Vylonium)
5. Jika error D1 binding: pastikan wrangler.toml TERHAPUS. JANGAN tambah binding D1 ke project ini.
6. Verifikasi: `POST https://clinqoo.pages.dev/mcp` harus JSON-RPC `initialize`, bukan 405/404. Tanpa key → 401 Unauthorized (itu berarti function hidup).

**Email resmi tampilan web = `halo@clincoo.buzz`**. Backend notifikasi tetap ke muzawwied@gmail.com.

**Rebrand UI:** teks `Clincoo` / `ClincooPay`. JANGAN rename domain/URL `clinqoo*`, nama repo, path `muzawwied.github.io/Clinqoo./`, identifier kode.

---

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. SHA file `6f6dff57`. Diverifikasi audit 17:03. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html` L419. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | OK (401 tanpa key) | POST `/mcp` → 401 JSON-RPC Unauthorized, bukan 405. Function ter-deploy. |
| Wallet / langganan / schema | Update | Binding `WALLET_DB` + tabel wallet di users-live.md. Debug env keys dihapus `f28296d2`. Path wallet repo tidak berubah (`59fb31e8`). |
| Sync users-live | FIXED | GH_REPO dikembalikan ke `muzawwied/Clinqoo-Data` (`100c2f50`). Data HEAD `992304ee`. |
| Editor repo | OK (live pecah) | Repo HEAD `8eef3328` tidak berubah. |
| Blog | OK | HEAD `091b53e7`. Tidak berubah sejak 16:07. |
| Clinqoo-Legal | OK | HEAD `5ad44340`. |
| Landing / DNS | Update UI | Card statis `a9768b23`; workflow deploy-landing.yml dihapus `632dcdbf` (nyasar mirror). Landing repo `280302d9`. |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 17:03 ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD Clinqoo. `3545ce43`. Bug terbuka: oauthRedirectUri github.io `/Clincoo./`.

---

## Log Interaksi Agent
### 2026-09-19 17:03 WIB — Grok (xAI) hourly audit
- Scope sejak 16:07. HEAD `3545ce43`.
- `upsertOauthUser` FIXED SHA `6f6dff57`.
- MCP live: POST clinqoo.pages.dev/mcp → **401** (bukan 405). Function hidup.
- oauthRedirectUri github.io `/Clincoo./akun/auth.html` masih 404.
- Perubahan: GH_REPO fix `100c2f50`; WALLET_DB + users-live wallet table; debug keys removed `f28296d2`; logo ClincooPay `3545ce43`; hapus deploy-landing.yml `632dcdbf`; Data sync `992304ee`.
- Issue/PR 0. Email terkirim ke muzawwied@gmail.com.
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

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
