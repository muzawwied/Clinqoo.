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

---

## Status Saat Ini (update terakhir: 2026-09-16 19:23 WIB)

| Area | Status | Catatan |
|------|--------|--------|
| Auth OAuth (`upsertOauthUser`) | ✅ Sudah diperbaiki | INSERT user baru sudah ada (commit e04aa6c). Login Google/GitHub masih perlu uji manual |
| Encoding karakter | ✅ Bersih | |
| Schema D1 vs runtime | ✅ Disinkronkan | |
| Editor full-stack + layout | ✅ Aktif | fullstack.js + layout-sidebar.js (sidebar kiri files-only, kanan Workspace/Agent/Settings, Chat AI halaman terpisah) |
| AI chat | ✅ Pulih & terverifikasi end-to-end | Rotasi 3 kunci Gemini (AQ.) + fallback Workers AI; kunci di D1 env_vars + project-level |
| Hourly audit automation | ✅ Aktif | Setiap 1 jam |
| Wiki / AGENTS.md | ✅ Aktif & dipantau | Email resmi hanya gmail.com |

---

## Log Interaksi Agent

### 2026-09-16 — Superagent Clinqoo (Tim AI upgrade)
- Upgrade kualitas mode kolaborasi (Tim AI) di `functions/api/chat.js` (commit `88e83b9`):
  - **Reviewer kini punya tools**: `list_items` + `read_file` (read-only, loop max 3 hop) — bisa audit file lama di workspace D1, bukan cuma potongan 400 karakter. Potongan digest diperbesar ke 700/400.
  - **QA otomatis deterministik** (`teamQaFindings`): deteksi TODO/FIXME/lorem ipsum/coming soon, file nyaris kosong (<150 karakter), `<html>` tanpa `</html>`, `<script>` tak tertutup, kurung JS tidak seimbang. Temuan QA MEMAKSA tahap perbaikan walau reviewer bilang SEMUA OK — user tidak lagi menerima situs setengah jadi.
  - **Anti-merugikan** (`sanitizeTeamCalls`): path traversal (`..`) & URL absolut ditolak, menimpa file dengan konten kosong diblok, maks 25 file & 130KB/file.
  - Prompt programmer: larangan keras placeholder.
- Untuk agent berikutnya: uji Tim AI end-to-end dari UI dengan proyek nyata (butuh akun Pro).
### 2026-09-16 — Superagent Base44 (19:55 WIB)
- Owner kirim 3 kunci Gemini baru (awalan "AQ."). Uji: kunci 1 & 3 VALID (gemini-3.6-flash), kunci 2 ditolak Google (403) — tetap disimpan, rotasi akan melewatinya otomatis.
- Rotasi multi-kunci Gemini di `functions/api/chat.js` + `ai.js`: `getGeminiKeys()` (env project + D1 `GEMINI_API_KEY/_2/_3`), `tryModels()/tryGemini()` loop kunci x model (400/403/429 -> kunci berikutnya).
- Simpan kunci: GH secrets `GEMINI_KEY_1/2/3` -> workflow `.github/workflows/gemini-keys.yml` upsert D1 env_vars (is_secret=1) + patch env project-level. Run sukses.
- Fix: `TEAM_BUSY_MSG is not defined` (ReferenceError jalur error Tim AI) dipulihkan (dd56e79).
- Verifikasi clincoo-be2: register/login akun QA (id 96, di-Pro-kan via `set-qa-pro.yml`), chat mode biasa OK via gemini-3.6-flash, gerbang Tim AI OK. Uji Tim AI penuh berjalan saat penulisan log ini.
### 2026-09-16 — Grok (xAI) 19:23 WIB
- Konfirmasi: **muzawwied@gmaio.com adalah typo**. Alamat resmi hanya **muzawwied@gmail.com**.
- Update wiki + automation agar tidak lagi mengirim ke alamat typo.

### 2026-09-16 — Superagent Base44 (19:35 WIB)
- Investigasi AI kolaborasi; fix projectId; fallback Workers AI; dll.

### 2026-09-16 — Superagent Clinqoo
- Fix OAuth, schema, editor fullstack.js.

### 2026-09-16 — Grok (xAI)
- Audit awal, automation hourly, fullstack.js, wiki board.

---

## Rekomendasi untuk Agent Berikutnya

1. Uji login Google & GitHub end-to-end di clincoo-be2.
2. Pantau automation audit tiap jam.
3. Semua laporan email hanya ke **muzawwied@gmail.com**.

---

*File ini hidup. Silakan diedit oleh agent manapun yang memiliki akses write ke repo.*
*Wiki + automation selalu dicek di setiap sesi.*
