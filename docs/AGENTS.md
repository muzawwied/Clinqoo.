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

## Status Saat Ini (update terakhir: 2026-09-21 09:11 WIB)

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
| Auth OAuth (`upsertOauthUser`) | OK — FIXED | emailNorm + INSERT + last_row_id. File `functions/api/auth/shared.js` blob `ebf23dd5`. Tidak disentuh. |
| OAuth redirect_uri | Bug | github.io path `/Clincoo./` 404 (benar `/Clinqoo./`) di `auth/index.html`. Domain aktif: `location.origin + '/auth/'`. Daftarkan `https://app.clincoo.buzz/auth/` dan `https://clinqoo.pages.dev/auth/`. |
| Probe Gemini tanpa auth (`kbdiag.js`) | TERATASI | Dihapus di `e4ec785`. |
| Probe admin Gemini | Sementara | `functions/api/diag-gemini.js` masih di HEAD — gate ADMIN_EMAILS / qa.*@clincoo.dev. Hapus setelah diagnosa. |
| Probe streaming (`streamtest.js`) | TERATASI | Dihapus di `9b8f4564`. |
| CORS / middleware | OK | ORIGIN_ALLOW sudah `*.clincoo.buzz`. |
| Deploy MCP | REGRESI — HTTP 405 | POST clinqoo.pages.dev/mcp dan app.clincoo.buzz/mcp = 405 body kosong. Redeploy project clinqoo BERSAMA functions/mcp.js. |
| CI deploy production | Update | job deploy-production app.clincoo.buzz otomatis tiap push. |
| Editor / UI | Update | CodeMirror + polling stepper + prompt builder v2. Bukan auth/schema. |
| User report | Update | 9fd42a9 + 95924ea8 join situs publik (proj_ vs p_proj). Gate x-cron-secret. |
| Wallet / langganan / schema | PATCHED | e638daf: resolveOwner fail-closed; kredit in hanya callback/ClincooPay; clear/DELETE admin-only. |
| Sync users-live | OK — jalan | Clinqoo-Data `7f105d22` (02:03 UTC). |
| Blog | OK | Clinqoo-Blog artikel (bukan kode app). |
| Issue GitHub | OK | 0 open, 0 PR |
| Hourly audit | Laporan masuk | 09:11 WIB ke muzawwied@gmail.com — **bukan All clear** |
| Email transactional | Resend | cek RESEND_API_KEY |

Bukan All clear. HEAD Clinqoo. `95924ea8`. `upsertOauthUser` tetap FIXED. Live MCP product 405. Bug terbuka lama: oauthRedirectUri github.io `/Clincoo./`; diag-gemini.js.

---

### 2026-09-21 09:11 WIB — Grok (xAI) hourly audit
- Scope: sejak 08:20 WIB (HEAD `b6875700`).
- Commit baru: `9fd42a9` user-report kolom admin; `95924ea8` fix join owner situs publik. Bukan OAuth/wallet.
- Live: POST /mcp clinqoo.pages.dev dan app.clincoo.buzz = HTTP 405.
- Email: `[Clinqoo Hourly Audit] 2026-09-21 09:11 WIB` ke muzawwied@gmail.com.

### 2026-09-21 08:20 WIB — Superagent (Base44): PATCH KEAMANAN dompet (celah cetak saldo tanpa gateway)
- Fix (commit e638daf): resolveOwner fail-closed; kredit 'in' tanpa callback token WAJIB ClincooPay; clear/DELETE admin-only.
- Deployment aa102bf5 (08:16 WIB) success.

## Log Interaksi Agent
### 2026-09-21 09:11 WIB — Grok (xAI) hourly audit
- Status: **bukan All clear**. HEAD `95924ea8`. upsertOauthUser TETAP FIXED (blob ebf23dd5).
- Live MCP 405. User-report sync jalan (Clinqoo-Data `7f105d22`).

### 2026-09-21 08:20 WIB — Grok (xAI) hourly audit
- Status: **bukan All clear**. HEAD `b6875700`. Wallet e638daf diverifikasi. MCP 405.

Log lebih lama dipotong agar wiki ringan.

---

## Rekomendasi untuk Agent Berikutnya

1. **PRIORITAS:** Redeploy Pages project `clinqoo` BERSAMA `functions/mcp.js`. Verifikasi POST `/mcp` = JSON-RPC atau 401, **bukan 405**.
2. Hapus `functions/api/diag-gemini.js` setelah diagnosa.
3. Perbaiki path github.io Clincoo. → Clinqoo. pada oauthRedirectUri.
4. Daftarkan https://app.clincoo.buzz/auth/ dan https://clinqoo.pages.dev/auth/.
5. Jangan ubah upsertOauthUser tanpa tes email-null GitHub.
6. Email hanya ke muzawwied@gmail.com.
7. WALLET_DB binding production.
8. Token per-address untuk `/api/wallet-sync` jika mau dikunci.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
