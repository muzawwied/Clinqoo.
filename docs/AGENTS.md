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

## Status Saat Ini (update terakhir: 2026-09-19 07:09 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. Diverifikasi 07:09. |
| OAuth redirect_uri | Perhatian | `3d54169e` dinamis `location.origin + '/auth/'`. github.io memakai `/Clincoo./` → 404; path benar `/Clinqoo./`. |
| CORS / middleware | OK + catatan | `5790e821` `*.clincoo.buzz`. Belum `*.clinqoo.biz.id`. `logBlocked` tanpa `.run()`. |
| Deploy MCP | REGRESI 405 | Connector clinqoo___* initialize HTTP 405. Redeploy mcp.js. |
| Wallet / langganan | OK | HEAD `95a42372` |
| Editor | OK | HEAD `58696cc` email halo@ |
| Blog | OK | HEAD `805e7e1a` artikel template |
| Clinqoo-Data | OK | Sync `85a16670` 22:45Z |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan terkirim | 07:09 ke muzawwied@gmail.com |

Bukan All clear — email terkirim.

---

## Log Interaksi Agent

### 2026-09-19 07:09 WIB — Grok (xAI) hourly audit
- HEAD sebelumnya audit 06:02 `89dc645e` / wiki `8d47edb8`. HEAD sekarang `6ad3ddb5`.
- Sejak 06:02: redirect hostname `6ad3ddb5`; OAuth redirect dinamis `3d54169e`; CORS `*.clincoo.buzz` `5790e821`; hapus forgot-password `db5e559e`; Brevo→Resend `2cdc2b1a`; email halo@.
- `upsertOauthUser` tetap FIXED.
- Bug: oauthRedirectUri github.io → `Clincoo.` 404 (harusnya `Clinqoo.`).
- MCP connector 405 lagi. Issue/PR: 0.
- Status: **bukan All clear**. Email `[Clinqoo Hourly Audit] 2026-09-19 07:09 WIB` terkirim.

### 2026-09-19 06:02 WIB — Grok (xAI) hourly audit
- Status saat itu: All clear. Tidak kirim email.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. Redeploy `clinqoo` DENGAN `functions/mcp.js` jika POST `/mcp` 405.
2. Fix path github.io `Clincoo.` → `Clinqoo.` di `auth/index.html` dan `akun/auth.html`.
3. Daftarkan redirect URI `https://app.clincoo.buzz/auth/` di Google/GitHub OAuth.
4. Cek `RESEND_API_KEY`.
5. Fix `logBlocked` `.run()`; tambah `security_events` ke schema.sql.
6. Email hanya ke **muzawwied@gmail.com**.
7. Jangan ubah `upsertOauthUser` tanpa tes email-null GitHub.
8. Rebrand: jangan rename domain/repo/path github.io/identifier.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
