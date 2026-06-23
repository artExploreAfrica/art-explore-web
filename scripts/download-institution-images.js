/**
 * Downloads images for each institution by scraping OG/meta image tags
 * from their own websites. No API key required.
 *
 * Usage:  node scripts/download-institution-images.js
 * Input:  docs/institutions.csv
 * Output: institutions-with-images.csv
 *         public/uploads/institutions/<slug>/image-1.(jpg|png|webp)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const IMAGES_WANTED = 2;
const DELAY_MS = 1500;

const ROOT = path.join(__dirname, '..');
const INPUT_CSV = path.join(ROOT, 'docs', 'institutions.csv');
const OUTPUT_CSV = path.join(ROOT, 'institutions-with-images.csv');
const IMAGES_BASE = path.join(ROOT, 'public', 'uploads', 'institutions');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ── Helpers: slug ─────────────────────────────────────────────────────────────
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Helpers: CSV ──────────────────────────────────────────────────────────────
function parseCSVRow(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const headers = parseCSVRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVRow(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function serializeCSVRow(values) {
  return values
    .map((v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

// ── Helpers: HTTP ─────────────────────────────────────────────────────────────
function httpGetHTML(urlStr, timeout = 15_000, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error(`Bad URL: ${urlStr}`)); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: BROWSER_HEADERS, timeout },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, urlStr).href;
          return resolve(httpGetHTML(next, timeout, hops + 1));
        }
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ body, finalUrl: urlStr }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout fetching page')); });
  });
}

// Returns { contentType } on success, rejects on failure
function downloadImage(imageUrl, destPath, timeout = 20_000, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    let parsed;
    try { parsed = new URL(imageUrl); } catch { return reject(new Error(`Bad URL: ${imageUrl}`)); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: BROWSER_HEADERS, timeout },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, imageUrl).href;
          return resolve(downloadImage(next, destPath, timeout, hops + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (!ct.includes('image/')) {
          res.resume();
          return reject(new Error(`Not an image (content-type: ${ct || 'unknown'})`));
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve({ contentType: ct })));
        file.on('error', (err) => { try { fs.unlinkSync(destPath); } catch {} reject(err); });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout downloading image')); });
  });
}

// ── OG / meta image extraction ────────────────────────────────────────────────
function extractMetaImages(html, pageUrl) {
  const raw = [];

  // og:image — both attribute orderings
  for (const m of html.matchAll(
    /<meta\b[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']{4,})["'][^>]*>/gi
  )) raw.push(m[1]);
  for (const m of html.matchAll(
    /<meta\b[^>]+content=["']([^"']{4,})["'][^>]+property=["']og:image(?::url)?["'][^>]*>/gi
  )) raw.push(m[1]);

  // twitter:image — both attribute orderings
  for (const m of html.matchAll(
    /<meta\b[^>]+(?:name|property)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']{4,})["'][^>]*>/gi
  )) raw.push(m[1]);
  for (const m of html.matchAll(
    /<meta\b[^>]+content=["']([^"']{4,})["'][^>]+(?:name|property)=["']twitter:image(?::src)?["'][^>]*>/gi
  )) raw.push(m[1]);

  const seen = new Set();
  const result = [];
  for (const src of raw) {
    const trimmed = src.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    try {
      const abs = trimmed.startsWith('http') ? trimmed
        : trimmed.startsWith('//') ? 'https:' + trimmed
        : new URL(trimmed, pageUrl).href;
      result.push(abs);
    } catch { /* skip unparseable URLs */ }
  }
  return result;
}

function extFromContentType(ct) {
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/gif')) return '.gif';
  return '.jpg';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`CSV not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  const { headers, rows } = parseCSV(fs.readFileSync(INPUT_CSV, 'utf-8'));
  fs.mkdirSync(IMAGES_BASE, { recursive: true });

  const outputHeaders = [...headers, 'images'];
  const outputRows = [];
  const stats = { processed: 0, skipped: 0, noWebsite: 0, failed: 0 };

  for (const row of rows) {
    const name = (row['name'] || '').trim();
    const website = (row['website'] || '').trim();

    if (!name) { outputRows.push({ ...row, images: '[]' }); continue; }

    const slug = toSlug(name);
    const dir = path.join(IMAGES_BASE, slug);

    // ── Resume: already downloaded ────────────────────────────────────────────
    if (fs.existsSync(dir)) {
      const existing = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
      if (existing.length >= IMAGES_WANTED) {
        const paths = existing.sort().map(f => `public/uploads/institutions/${slug}/${f}`);
        console.log(`[SKIP] ${name}`);
        outputRows.push({ ...row, images: JSON.stringify(paths) });
        stats.skipped++;
        continue;
      }
    }

    // ── No website ────────────────────────────────────────────────────────────
    if (!website) {
      console.log(`[NO WEBSITE] ${name}`);
      outputRows.push({ ...row, images: '[]' });
      stats.noWebsite++;
      continue;
    }

    console.log(`\n[${++stats.processed}] ${name}`);
    console.log(`  ${website}`);

    // ── Fetch HTML and extract OG images ──────────────────────────────────────
    let imageUrls = [];
    try {
      const { body, finalUrl } = await httpGetHTML(website);
      imageUrls = extractMetaImages(body, finalUrl);
      console.log(`  Found ${imageUrls.length} meta image URL(s)`);
      if (imageUrls.length === 0) {
        console.warn(`  WARNING: No og:image / twitter:image tags found`);
      }
    } catch (err) {
      console.error(`  ERROR fetching site: ${err.message}`);
      outputRows.push({ ...row, images: '[]' });
      stats.failed++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // ── Download ──────────────────────────────────────────────────────────────
    if (imageUrls.length > 0) fs.mkdirSync(dir, { recursive: true });

    const downloadedPaths = [];
    let idx = 1;

    for (const imgUrl of imageUrls) {
      if (downloadedPaths.length >= IMAGES_WANTED) break;
      const tmpPath = path.join(dir, `_tmp_${idx}`);
      console.log(`  → ${imgUrl}`);
      try {
        const { contentType } = await downloadImage(imgUrl, tmpPath);
        const stat = fs.statSync(tmpPath);
        if (stat.size < 500) throw new Error('File too small, probably not a real image');

        const ext = extFromContentType(contentType);
        const fileName = `image-${idx}${ext}`;
        const destPath = path.join(dir, fileName);
        fs.renameSync(tmpPath, destPath);

        downloadedPaths.push(`public/uploads/institutions/${slug}/${fileName}`);
        console.log(`    ✓ ${fileName} (${Math.round(stat.size / 1024)} KB)`);
        idx++;
      } catch (err) {
        console.error(`    ✗ ${err.message}`);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }

    if (downloadedPaths.length === 0) {
      console.warn(`  WARNING: No images downloaded for "${name}"`);
      try { fs.rmdirSync(dir); } catch {}
      stats.failed++;
    } else if (downloadedPaths.length < IMAGES_WANTED) {
      console.warn(`  WARNING: Only ${downloadedPaths.length}/${IMAGES_WANTED} images for "${name}"`);
    }

    outputRows.push({ ...row, images: JSON.stringify(downloadedPaths) });
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // ── Write output CSV ──────────────────────────────────────────────────────
  const lines = [serializeCSVRow(outputHeaders)];
  for (const row of outputRows) {
    lines.push(serializeCSVRow(outputHeaders.map(h => row[h] ?? '')));
  }
  fs.writeFileSync(OUTPUT_CSV, lines.join('\n'), 'utf-8');

  console.log('\n────────────────────────────────────────────');
  console.log(`Processed : ${stats.processed}`);
  console.log(`Skipped   : ${stats.skipped}  (already had images)`);
  console.log(`No website: ${stats.noWebsite}`);
  console.log(`Failed    : ${stats.failed}`);
  console.log(`Output    : ${OUTPUT_CSV}`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
