// Renders round three (BRIEF-HUD-MOCKS-3): round two's render.mjs with this round's pages (no video this round). Headless Chromium
// with software WebGL; a tiny static server serves the worktree so a page loads the tokens, the vendored three.js and the fonts.
//   python3 -I -B docs/build-plan/mockups/hud/2026-11-08-3/build.py           writes the pages
//   node docs/build-plan/mockups/hud/2026-11-08-3/render.mjs still room-plus  one frame at t=0  →  <page>.png at 2×
//   node .../render.mjs stills                                                the three Homes
//   node .../render.mjs contact                                               the sheet from the PNGs already made → contact.png
import { chromium } from 'playwright';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const rel = here.slice(root.length + 1);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, p);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  try { if (!statSync(file).isFile()) throw new Error('not a file'); } catch { return void res.writeHead(404).end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${rel}`;

const [what, a1, a2] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(name, { t = 0, dpr = 2, video = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: dpr, colorScheme: 'dark', ...(video ? { recordVideo: { dir: video, size: { width: 440, height: 956 } } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/${name}.html${t === null ? '' : `?still=${t}`}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__frameReady === true, null, { timeout: 300000, polling: 200 });
  return { ctx, page, errors };
}

// a check the floor holds: nothing he can press under 44 × 44, no type under 12 px, nothing wider than the screen
const CHECK = () => {
  const out = [];
  const W = 440;
  for (const el of document.querySelectorAll('button, .g-key, .ret, .tile, [role="button"]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width && cs.opacity !== '0' && (r.width < 44 || r.height < 44)) out.push(`target ${Math.round(r.width)}×${Math.round(r.height)}: ${el.className} "${(el.textContent || '').trim().slice(0, 24)}"`);
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (el.children.length === 0 && (el.textContent || '').trim() && parseFloat(cs.fontSize) < 12 && cs.display !== 'none') out.push(`type ${cs.fontSize}: "${el.textContent.trim().slice(0, 24)}"`);
    const r = el.getBoundingClientRect();
    if (r.width && r.right > W + 1 && cs.position !== 'fixed' && !el.closest('.kb') && !el.closest('.orb')) out.push(`sideways ${Math.round(r.right)}: ${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 24)}"`);
  }
  return out;
};

async function still(name, t = 0, out = null) {
  const t0 = Date.now();
  const { ctx, page, errors } = await open(name, { t });
  const report = await page.evaluate(CHECK);
  const path = out || join(here, `${name}.png`);
  await page.screenshot({ path });
  const kb = Math.round(statSync(path).size / 1024);
  const count = await page.evaluate(() => window.__scanCount || null);
  console.log(`${path.replace(here + '/', '')} ${kb} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s${count ? `  points ${count.points} lines ${count.lines}` : ''}${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
  for (const e of errors.slice(0, 5)) console.log('   ! ' + e);
  for (const r of report.slice(0, 14)) console.log('   ? ' + r);
  await ctx.close();
}

async function sheet() {
  const ctx = await browser.newContext({ viewport: { width: 1230, height: 1000 }, deviceScaleFactor: 1.25, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(`${base}/contact.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const size = await page.evaluate(() => ({ width: Math.ceil(document.documentElement.scrollWidth), height: Math.ceil(document.documentElement.scrollHeight) }));
  await page.setViewportSize(size);
  const out = join(here, 'contact.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(`contact.png ${Math.round(statSync(out).size / 1024)} KB ${size.width}×${size.height}`);
  await ctx.close();
}

try {
  if (what === 'still') await still(a1, a2 === undefined ? 0 : +a2, a2 !== undefined ? join(here, `${a1}-${a2}.png`) : null);
  else if (what === 'stills') for (const p of ['room-plus', 'wall', 'world']) await still(p);
  else if (what === 'contact') await sheet();
  else console.log('render.mjs still <page> [t] | stills | contact');
} finally {
  await browser.close();
  server.close();
}
