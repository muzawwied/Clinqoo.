# Clinqoo MCP Server

MCP (Model Context Protocol) server untuk platform **Clinqoo**.

Dengan server ini, AI assistant (Cursor, Claude Desktop, Windsurf, dll.) bisa:

- Melihat info akun
- Daftar proyek
- Cek saldo & riwayat dompet
- Menjalankan **Agent Mode** di latar belakang
- Memantau progress agent task
- Membaca notifikasi

## Tools

| Tool | Deskripsi |
|------|-----------|
| `get_me` | Info akun yang login |
| `list_projects` | Daftar semua proyek |
| `get_wallet_balance` | Saldo dompet (termasuk ClinqooPay) |
| `list_wallet_transactions` | Riwayat transaksi |
| `start_agent_task` | Mulai tugas Agent Mode (background) |
| `get_agent_status` | Cek status + events agent task |
| `list_notifications` | Notifikasi terbaru |

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
npm run build
```

### 2. Ambil token Clinqoo

Login ke Clinqoo → buka DevTools → Application / Local Storage / Cookie, atau dari Network tab cari request yang punya header `Authorization: Bearer ...`.

Simpan token tersebut.

### 3. Jalankan (manual test)

```bash
CLINQOO_TOKEN="your_token_here" node build/index.js
```

### 4. Daftarkan di Cursor / Claude Desktop

**Cursor** (`~/.cursor/mcp.json` atau project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "clinqoo": {
      "command": "node",
      "args": ["/path/to/Clinqoo./mcp-server/build/index.js"],
      "env": {
        "CLINQOO_TOKEN": "your_token_here",
        "CLINQOO_BASE_URL": "https://muzawwied.github.io/Clinqoo."
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "clinqoo": {
      "command": "node",
      "args": ["/path/to/Clinqoo./mcp-server/build/index.js"],
      "env": {
        "CLINQOO_TOKEN": "your_token_here"
      }
    }
  }
}
```

Ganti `/path/to/Clinqoo.` dengan path absolut di komputer kamu.

## Environment Variables

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|------------|
| `CLINQOO_TOKEN` | Ya | — | Bearer token akun Clinqoo |
| `CLINQOO_BASE_URL` | Tidak | `https://muzawwied.github.io/Clinqoo.` | Base URL API |

## Catatan

- Token bersifat rahasia. Jangan commit ke git.
- Agent task yang dijalankan lewat `start_agent_task` berjalan di **background** (Cloudflare Workflows). Gunakan `get_agent_status` untuk memantau.
- Jika base URL berubah (custom domain), set `CLINQOO_BASE_URL`.

## License

Private — bagian dari proyek Clinqoo.
