// Local preview: serves apps/web/dist with the production security headers and runs the
// real brain bundle behind /api (in-memory Durable Object, scripted mock model).
//   node tests/preview-server.mjs [port]
// Owner key for the pairing screen: preview-owner-key-0123456789
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { sqlStorage } from './sqlite-storage.mjs';
import { photoSpaces, setPhotoMode } from './fixtures/photo-spaces.mjs';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'apps/web/dist');
const port = Number(process.argv[2] ?? 8788);
const brainPath = process.env.BRAIN_BUNDLE ?? join(root, 'apps/edge/test/.build/brain.mjs');
const mod = await import(pathToFileURL(brainPath).href);

class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) {
    if (typeof k === 'string' && this.blips.delete(k)) throw new Error('storage blip');
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v));
  }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  // Test only (/__test/blip?key=…): the next write of that key fails once, as a database blip would.
  blips = new Set();
  // Durable Object alarm, emulated with a timer.
  alarmAt = null;
  timer = null;
  async setAlarm(t) {
    this.alarmAt = typeof t === 'number' ? t : t.getTime();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.alarmAt = null; agent?.alarm().catch((e) => console.error('alarm', e)); }, Math.max(0, this.alarmAt - Date.now()));
  }
  async getAlarm() { return this.alarmAt; }
}
// Test only: the cited-answers spec's web (tests/cited.spec.mjs). A DuckDuckGo search about the speed
// of light and pages on *.example.test hosts come from tests/fixtures/cited.json; everything else is the real fetch.
const citedWeb = JSON.parse(await readFile(join(root, 'tests/fixtures/cited.json'), 'utf8'));
// Test only: the gadget-manuals spec's web (tests/manuals.spec.mjs). A search naming the Bosch SMS24AW01G finds a
// ManualsLib page (forbidden: skipped), Bosch's own PDF and a blog; the PDF (12 pages, the fault codes on page 12) and
// Bosch's robots.txt are served here, never fetched from Bosch.
const MANUAL_PDF = 'https://media3.bosch-home.com/Documents/specsheet/en-GB/SMS24AW01G.pdf';
function manualPdf() {
  const pages = Array.from({ length: 12 }, (_, i) =>
    i === 0 ? ['Bosch Dishwasher SMS24AW01G', 'User manual'] : i === 11 ? ['Troubleshooting: fault codes', 'E24 The waste water cannot drain away.', '1. Switch off the appliance and unplug it.', '2. Clean the filters and the waste water pump.', '3. Check that the drain hose is not kinked or blocked.'] : [`Page ${i + 1}: loading, programmes and care.`, 'Use dishwasher salt and rinse aid. Clean the filters regularly.']);
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  pages.forEach((lines, i) => {
    const content = `BT /F1 11 Tf 50 800 Td ${lines.map((l, j) => `${j ? '0 -16 Td ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const ddg = (results) => `<html><body>${results.map(([url, title]) => `<div class="result"><a rel="nofollow" class="result__a" href="${url}">${title}</a><a class="result__snippet" href="${url}">${title}</a></div>`).join('')}</body></html>`;
function manualsWeb(u) {
  const q = u.hostname === 'html.duckduckgo.com' ? u.searchParams.get('q') ?? '' : '';
  if (/SMS24AW01G/i.test(q) && /E99/i.test(q)) return ddg([['https://www.fixit-forum.example/bosch-e99?utm_source=feed', 'Bosch dishwasher E99 error explained'], ['https://www.appliance-help.example/e99', 'What E99 means on a Bosch'], ['https://www.repair-notes.example/bosch', 'Bosch error codes list']]);
  if (/drain pump/i.test(q)) return ddg([['https://www.espares.co.uk/product/bosch-drain-pump?tag=someone-21&id=1', 'Bosch drain pump - eSpares'], ['https://www.amazon.co.uk/dp/B000123/ref=sr_1_1?tag=someone-21', 'Drain pump for Bosch dishwashers'], ['https://www.partmaster.co.uk/bosch-drain-pump', 'Bosch drain pump - Partmaster']]);
  if (/SMS24AW01G/i.test(q)) return ddg([['https://www.manualslib.com/manual/1234/Bosch-Sms24aw01g.html', 'Bosch SMS24AW01G manual - ManualsLib'], [MANUAL_PDF, 'Instructions for use SMS24AW01G'], ['https://some-appliance-blog.example/bosch-manual.pdf', 'Bosch manual mirror']]);
  return null;
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const manualSearch = manualsWeb(u);
  if (manualSearch) return new Response(manualSearch, { headers: { 'content-type': 'text/html' } });
  if (u.href === 'https://media3.bosch-home.com/robots.txt') return new Response('', { headers: { 'content-type': 'text/plain' } });
  if (u.href === MANUAL_PDF) return new Response(manualPdf(), { headers: { 'content-type': 'application/pdf' } });
  if (u.hostname.endsWith('manualslib.com')) return new Response('the manuals spec must never fetch ManualsLib', { status: 418 });
  if (u.hostname === 'html.duckduckgo.com' && /speed of light/i.test(u.searchParams.get('q') ?? '')) return new Response(citedWeb.search, { headers: { 'content-type': 'text/html' } });
  if (u.hostname.endsWith('.example.test')) {
    const page = citedWeb.pages[u.href];
    return page ? new Response(page, { headers: { 'content-type': 'text/html' } }) : new Response('not found', { status: 404 });
  }
  // Test only: the PHOTO TOOLS Spaces (tests/photo.spec.mjs), from their real answers.
  const photo = await photoSpaces(u, init);
  if (photo) return photo;
  return realFetch(input, init);
};
globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
const state = { storage: Object.assign(new MemStorage(), { sql: sqlStorage() }), waitUntil: () => undefined };
const env = {
  // Same shape as production: only the password's hash is configured, and no VAULT_KEY
  // (the brain makes its own). OWNER_KEY stays here for the log line below only.
  OWNER_KEY_HASH: createHash('sha256').update('preview-owner-key-0123456789').digest('hex'),
  OWNER_EMAIL: 'owner@example.com',
  MOCK_LLM: '1',
};
// The SITES KV namespace, in memory (published pages, shared pictures, 3-D models, the phone's backups).
const kvMem = new Map();
env.SITES = {
  async get(k, type) {
    if (!kvMem.has(k)) return null;
    const v = kvMem.get(k);
    if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.slice(0);
    if (type === 'json') return JSON.parse(typeof v === 'string' ? v : new TextDecoder().decode(v));
    return typeof v === 'string' ? v : new TextDecoder().decode(v);
  },
  async put(k, v) { kvMem.set(k, typeof v === 'string' ? v : v.slice(0)); },
  async delete(k) { kvMem.delete(k); },
};
// PREVIEW=1 behaves like a Worker Preview: no owner credential at all.
if (process.env.PREVIEW === '1') {
  delete env.OWNER_KEY_HASH;
  env.IS_PREVIEW = '1';
}
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };

// production headers from apps/web/public/_headers
const headersFile = await readFile(join(root, 'apps/web/public/_headers'), 'utf8');
const rules = [];
let cur = null;
for (const line of headersFile.split('\n')) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) rules.push((cur = { path: line.trim(), set: [], del: [] }));
  else if (line.trim().startsWith('!')) cur.del.push(line.trim().slice(1).trim().toLowerCase());
  else { const i = line.indexOf(':'); cur.set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
}
function headersFor(path) {
  const h = {};
  for (const r of rules) {
    const match = r.path.endsWith('*') ? path.startsWith(r.path.slice(0, -1)) : path === r.path;
    if (!match) continue;
    for (const d of r.del) for (const k of Object.keys(h)) if (k.toLowerCase() === d) delete h[k];
    for (const [k, v] of r.set) h[k] = v;
  }
  return h;
}

const TYPES = { '.onnx': 'application/octet-stream', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream', '.task': 'application/octet-stream', '.gz': 'application/gzip', '.traineddata': 'application/octet-stream' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    // Test only: an NDJSON stream of the given lines (base64) that stays open `hold` ms before ending —
    // a spec routes the chat's request here to look at the interface while a turn is still live.
    if (url.pathname === '/__test/stream') {
      const lines = Buffer.from(url.searchParams.get('lines') ?? '', 'base64').toString('utf8');
      const hold = Math.min(30_000, Number(url.searchParams.get('hold') ?? 0) || 0);
      for await (const c of req) void c;
      res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' });
      res.write(lines);
      setTimeout(() => res.end(), hold);
      return;
    }
    // Test only: the next write of one database key fails once (tests/apps.spec.mjs stops a mini-app's publish part-way).
    if (url.pathname === '/__test/blip') {
      state.storage.blips.add(url.searchParams.get('key') ?? '');
      res.writeHead(204);
      res.end();
      return;
    }
    // Test only: put a PHOTO TOOLS Space to sleep or over its limit (tests/fixtures/photo-spaces.mjs).
    if (url.pathname === '/__test/photo-mode') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(setPhotoMode(url.searchParams)));
      return;
    }
    // Like run_worker_first in wrangler.jsonc: the API, published pages (/s/…) and shared pictures (/i/…) go to the Worker.
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/') || url.pathname.startsWith('/i/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await mod.default.fetch(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body, duplex: 'half' }), env, { waitUntil: () => undefined });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      if (r.body) for await (const c of r.body) res.write(c);
      res.end();
      return;
    }
    let p = normalize(url.pathname).replace(/^\/+/, '');
    // Like Cloudflare's asset handling: /page.html redirects to /page, and /page serves page.html.
    // Headers follow the URL actually requested, as they do on Cloudflare.
    if (/[^/]\.html$/.test(p) && p !== 'index.html') {
      res.writeHead(307, { location: `/${p.slice(0, -5)}${url.search}`, ...headersFor(`/${p}`) });
      res.end();
      return;
    }
    const asked = `/${p}`;
    if (!p || p.endsWith('/')) p += 'index.html';
    else if (!extname(p)) p += '.html';
    const file = await readFile(join(dist, p)).catch(() => null);
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', ...headersFor(asked === '/index.html' ? '/' : asked) });
    res.end(file);
  } catch (e) {
    // A response that fails halfway (e.g. an upstream image stream breaking) has already sent its
    // headers: just end it. Writing headers again throws and would take the whole server down.
    if (!res.headersSent) res.writeHead(500);
    res.end(String(e));
  }
}).listen(port, () => console.log(`Ghosty preview on http://localhost:${port}  (owner key: preview-owner-key-0123456789)`));
