// Renders the hero round with real WebGL in headless Chromium (software WebGL, as tests/studio.spec.mjs runs it).
//   node docs/build-plan/mockups/hero/render.mjs [option ...] [--only home|closeup|states|contact]
// A tiny static server serves the worktree, so the pages load the app's own vendored three.js as ES modules.
import { chromium } from 'playwright';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, p);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    return void res.writeHead(404).end();
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/docs/build-plan/mockups/hero`;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const opts = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
const OPTIONS = opts.length ? opts : ['core', 'mind', 'gyro'];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shoot(url, out, { width, height, scale = 2, full = false, gl = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  if (gl) await page.waitForFunction(() => window.__heroReady === true, null, { timeout: 240000 });
  await page.waitForLoadState('networkidle');
  if (full) {
    const size = await page.evaluate(() => ({ width: Math.ceil(document.body.scrollWidth), height: Math.ceil(document.body.scrollHeight) }));
    await page.setViewportSize(size);
  }
  await page.screenshot({ path: out, fullPage: full });
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`${out.replace(root + '/', '')} ${kb} KB${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
  for (const e of errors.slice(0, 5)) console.log('   ! ' + e);
  await ctx.close();
}
try {
  for (const o of OPTIONS) {
    if (!only || only === 'home') await shoot(`${base}/${o}/home.html`, join(here, o, 'home.png'), { width: 440, height: 956 });
    if (!only || only === 'closeup') await shoot(`${base}/${o}/closeup.html`, join(here, o, 'closeup.png'), { width: 400, height: 400, scale: 3 });
    if (!only || only === 'states') await shoot(`${base}/${o}/states.html`, join(here, o, 'states.png'), { width: 1000, height: 420, full: true });
  }
  if (!only || only === 'contact') await shoot(`${base}/contact.html`, join(here, 'contact.png'), { width: 1340, height: 1100, scale: 1.6, full: true, gl: false });
} finally {
  await browser.close();
  server.close();
}
