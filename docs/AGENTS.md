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

## Status Saat Ini (update terakhir: 2026-09-19 08:05 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. Diverifikasi 08:05. |
| OAuth redirect_uri | Bug | `auth/index.html` default hardcode pages.dev. `akun/auth.html` github.io path `/Clincoo./` 404 (benar `/Clinqoo./`). |
| CORS / middleware | Perhatian | ORIGIN_ALLOW belum `*.clincoo.buzz`. |
| Deploy MCP | REGRESI 405 | Connector clinqoo___* initialize HTTP 405. Redeploy mcp.js. |
| Wallet / langganan | OK | tidak berubah sejak audit 07:09 |
| Editor | OK | HEAD `af9e947c` redirect pages.dev |
| Blog | OK | HEAD `43b0d23a` legal ClincooPay |
| Clinqoo-Data | OK | Sync `85a16670` 22:45Z |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan terkirim | 08:05 ke muzawwied@gmail.com |
| Email transactional | Resend | cek `RESEND_API_KEY` |
| Unpublish Pages | OK | `e0b4ddf1` lepas custom domain dulu |
| Mode Kolaborasi | Dihapus | `6a076380` Tim AI dihapus |

Bukan All clear — email terkirim. HEAD Clinqoo. `e0b4ddf1`.

---

## Log Interaksi Agent

### 2026-09-19 08:05 WIB — Grok (xAI) hourly audit
- HEAD sebelumnya audit 07:09 `6ad3ddb5`. HEAD sekarang `e0b4ddf1`.
- Sejak 07:09: unpublish domain `e0b4ddf1`/`3de57491`; hapus Mode Kolaborasi `6a076380`; blog legal + ganti link; editor redirect.
- `upsertOauthUser` tetap FIXED.
- Bug: oauthRedirectUri tidak konsisten (pages.dev hardcode vs Clincoo. path github.io). MCP 405. ORIGIN_ALLOW tanpa clincoo.buzz.
- Issue/PR: 0.
- Status: **bukan All clear**. Email `[Clinqoo Hourly Audit] 2026-09-19 08:05 WIB` terkirim.

### 2026-09-19 07:09 WIB — Grok (xAI) hourly audit
- HEAD `6ad3ddb5`. Bukan All clear — MCP 405 + callback github.io.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy `clinqoo` DENGAN `functions/mcp.js` jika POST `/mcp` 405.
2. Samakan `oauthRedirectUri`: github.io `Clinqoo.` (bukan `Clincoo.`); default `location.origin + '/auth/'`.
3. Daftarkan redirect URI `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/` di Google/GitHub OAuth.
4. Tambah `*.clincoo.buzz` ke ORIGIN_ALLOW di `_middleware.js`.
5. Cek `RESEND_API_KEY`.
6. Email hanya ke **muzawwied@gmail.com**.
7. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
8. Rebrand: jangan rename domain/repo/path github.io/identifier.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
