// Local preview: serves apps/web/dist with the production security headers and runs the
// real brain bundle behind /api (in-memory Durable Object, scripted mock model).
//   node tests/preview-server.mjs [port]
// Owner key for the pairing screen: preview-owner-key-0123456789
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'apps/web/dist');
const port = Number(process.argv[2] ?? 8788);
const brainPath = process.env.BRAIN_BUNDLE ?? join(root, 'apps/edge/test/.build/brain.mjs');
const mod = await import(pathToFileURL(brainPath).href);

class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
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
globalThis.caches = { default: { match: async () => undefined, put: async () => undefined } };
const state = { storage: new MemStorage(), waitUntil: () => undefined };
const env = {
  // Same shape as production: only the password's hash is configured, and no VAULT_KEY
  // (the brain makes its own). OWNER_KEY stays here for the log line below only.
  OWNER_KEY_HASH: createHash('sha256').update('preview-owner-key-0123456789').digest('hex'),
  OWNER_EMAIL: 'owner@example.com',
  MOCK_LLM: '1',
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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith('/api/')) {
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
    if (!p || p.endsWith('/')) p += 'index.html';
    const file = await readFile(join(dist, p)).catch(() => null);
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', ...headersFor(`/${p === 'index.html' ? '' : p}`) });
    res.end(file);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(port, () => console.log(`Ghosty preview on http://localhost:${port}  (owner key: preview-owner-key-0123456789)`));
