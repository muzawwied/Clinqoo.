// Cloudflare Pages Function module — pencarian pengetahuan resmi Clincoo
// dari blog.clincoo.buzz (sumber kebenaran soal produk/perusahaan Clincoo:
// founder, fitur, kebijakan, cara pakai, dll).
//
// Cara kerja: blog.clincoo.buzz memuat artikelnya lewat loader.js -> puluhan
// file data_*.js yang tiap-tiap mengisi window.countryDataFiles[kategori] =
// { names, flag, articles: [{ id, langs: { id: {title, desc, content} , en:{...} } }] }.
// Modul ini mengambil loader.js (untuk tahu daftar file terbaru secara otomatis,
// jadi tidak perlu di-update manual kalau blog menambah kategori baru), lalu
// mengambil & mem-parse tiap file data (dengan sandbox Function(), bukan eval
// global — konten ini milik kita sendiri jadi risikonya setara memuat script
// sendiri), menggabungkan jadi satu indeks pencarian in-memory, di-cache di
// Cache API selama 6 jam supaya tidak fetch ulang ke-49 file tiap ada pertanyaan.

const BLOG_BASE = 'https://blog.clincoo.buzz';
const CACHE_KEY = 'https://internal.clincoo.cache/blog-kb-v1';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 jam

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCategoryFile(fileName) {
  const res = await fetch(`${BLOG_BASE}/${fileName}`, { cf: { cacheTtl: 3600 } });
  if (!res.ok) return null;
  const code = await res.text();
  try {
    // Sandbox ringan: sediakan objek `window` palsu, jalankan kode file data
    // (hanya melakukan window.countryDataFiles["x"] = {...}), lalu ambil hasilnya.
    const fn = new Function('window', code + '\n;return window.countryDataFiles;');
    const fakeWindow = {};
    const result = fn(fakeWindow);
    return result || null;
  } catch (e) {
    return null;
  }
}

async function buildIndex() {
  // 1) Ambil daftar file data terbaru dari loader.js (otomatis ikut kalau ada kategori baru)
  let files = [];
  try {
    const loaderRes = await fetch(`${BLOG_BASE}/loader.js`, { cf: { cacheTtl: 3600 } });
    const loaderCode = await loaderRes.text();
    const m = loaderCode.match(/var files\s*=\s*(\[[^\]]*\])/);
    if (m) files = JSON.parse(m[1]);
  } catch (e) { /* fallback di bawah */ }
  if (!files.length) return [];

  // 2) Ambil semua file data secara paralel, gabungkan
  const merged = {};
  const results = await Promise.all(files.map(f => fetchCategoryFile(f).catch(() => null)));
  for (const r of results) {
    if (!r) continue;
    for (const [catId, catData] of Object.entries(r)) {
      if (!merged[catId]) merged[catId] = catData;
    }
  }

  // 3) Ratakan jadi array artikel siap-cari
  const flat = [];
  for (const [catId, cat] of Object.entries(merged)) {
    const catName = (cat.names && (cat.names.id || cat.names.en)) || catId;
    (cat.articles || []).forEach(art => {
      const langData = (art.langs && (art.langs.id || art.langs.en)) || {};
      const title = langData.title || art.id;
      const desc = langData.desc || '';
      const contentText = stripHtml(langData.content || '');
      flat.push({
        id: art.id,
        cat: catId,
        catName,
        url: `${BLOG_BASE}/#/${catId}/${art.id}`,
        title,
        desc,
        contentText,
        haystack: (title + ' ' + desc + ' ' + contentText).toLowerCase()
      });
    });
  }
  return flat;
}

async function getIndex(env) {
  const cache = caches.default;
  const cacheReq = new Request(CACHE_KEY);
  try {
    const cached = await cache.match(cacheReq);
    if (cached) {
      const data = await cached.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch (e) { /* lanjut build baru */ }

  const flat = await buildIndex();
  if (flat.length) {
    try {
      const resp = new Response(JSON.stringify(flat), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_TTL_SECONDS}` }
      });
      await cache.put(cacheReq, resp);
    } catch (e) { /* cache put gagal tidak fatal */ }
  }
  return flat;
}

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F]+/i)
    .filter(t => t.length >= 2);
}

function excerptAround(text, tokens, radius) {
  radius = radius || 160;
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (pos === -1 || idx < pos)) pos = idx;
  }
  if (pos === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// Ekspor utama: dipanggil dari tool server chat.js
export async function searchClincooBlog(env, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return { error: 'Query pencarian kosong.' };

  const index = await getIndex(env);
  if (!index.length) {
    return { error: 'Gagal memuat pengetahuan Clincoo dari blog resmi (blog.clincoo.buzz sedang tidak bisa diakses). Jawab jujur bahwa info tidak tersedia saat ini, jangan mengarang.' };
  }

  const scored = index.map(art => {
    let score = 0;
    const titleLower = art.title.toLowerCase();
    const descLower = art.desc.toLowerCase();
    for (const t of tokens) {
      if (titleLower.includes(t)) score += 5;
      if (descLower.includes(t)) score += 3;
      if (art.haystack.includes(t)) score += 1;
    }
    // bonus frasa penuh
    const qLower = query.toLowerCase();
    if (titleLower.includes(qLower)) score += 8;
    return { art, score };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 4);

  if (!top.length) {
    return { found: false, message: 'Tidak ada artikel resmi Clincoo yang cocok dengan pertanyaan ini di blog.clincoo.buzz. Jangan mengarang jawaban — sampaikan jujur ke user bahwa infonya belum tersedia di sumber resmi.' };
  }

  return {
    found: true,
    results: top.map(({ art }) => ({
      judul: art.title,
      kategori: art.catName,
      url: art.url,
      ringkasan: art.desc,
      kutipan_relevan: excerptAround(art.contentText, tokens)
    }))
  };
}
