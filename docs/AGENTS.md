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

## Status Saat Ini (update terakhir: 2026-09-19 10:10 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. Diverifikasi audit 10:04. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`). Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI 405 | Connector clinqoo___* initialize HTTP 405. Redeploy `functions/mcp.js` ke project clinqoo. |
| Wallet / langganan / schema | OK | tidak berubah |
| Editor repo | OK | Clinqoo-Editor HEAD `8eef3328` tidak berubah sejak 09:05 |
| Blog | Update | HEAD `87bf7e44` artikel mobile + sitemap 2026-09-19 |
| Clinqoo-Data | OK | HEAD `85a16670` tidak berubah (tidak ada sync baru setelah 05:45) |
| Clinqoo-Legal | OK | tidak ada commit baru hari ini |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 10:04 ke muzawwied@gmail.com — bukan All clear |
| Email transactional | Resend | cek `RESEND_API_KEY` |

Bukan All clear. HEAD wiki Clinqoo. `3f307535` (hanya docs); HEAD kode terakhir `c362285c`.

---

## Log Interaksi Agent

### 2026-09-19 10:10 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit Clinqoo 10:04 WIB **bukan All clear**. Tidak ada commit kode baru di Clinqoo. (HEAD wiki `3f307535`). Blog update artikel mobile + sitemap (`87bf7e44`). Editor/Data/Legal tidak berubah. `upsertOauthUser` tetap FIXED. Bug terbuka: MCP initialize HTTP 405; oauthRedirectUri github.io masih `/Clincoo./` (404). CORS/wallet/schema tidak berubah. Issue/PR 0. Rekomendasi: redeploy MCP, perbaiki path Clincoo.→Clinqoo., daftarkan `https://app.clincoo.buzz/auth/` di OAuth console.
- Sumber: email/pesan laporan — subjek `[Clinqoo Hourly Audit] 2026-09-19 10:04 WIB` dari Devconium
- Status: **bukan All clear**

### 2026-09-19 10:04 WIB — Grok (xAI) hourly audit
- HEAD kode sebelumnya audit 09:05 `c362285c`. Tidak ada commit kode baru; wiki `3f307535` lalu di-update audit ini.
- Blog baru: `87bf7e44` artikel mobile + sitemap.
- Editor/Data/Legal: tidak berubah sejak 09:05.
- `upsertOauthUser` tetap FIXED. MCP 405 + oauthRedirectUri github.io `/Clincoo./` masih ada.
- Issue/PR: 0.
- Status: **bukan All clear**. Email `[Clinqoo Hourly Audit] 2026-09-19 10:04 WIB` terkirim.

### 2026-09-19 09:06 WIB — Grok (xAI) laporan masuk
- Ringkasan laporan: Hourly audit **bukan All clear**. HEAD Clinqoo. `c362285c`.
- Status: **bukan All clear**

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy MCP ke clinqoo.pages.dev dengan `functions/mcp.js` jika POST `/mcp` 405.
2. Perbaiki path github.io `Clincoo.` → `Clinqoo.` pada `oauthRedirectUri` (`auth/index.html` L419).
3. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
4. CORS `*.clincoo.buzz` sudah ada — jangan ulang sebagai bug.
5. Cek `RESEND_API_KEY`.
6. Email hanya ke **muzawwied@gmail.com**.
7. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
8. Rebrand: jangan rename domain/repo/path github.io/identifier.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
