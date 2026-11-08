// Renders the HUD mocks (BRIEF-HUD-MOCKS) with real WebGL in headless Chromium (software WebGL, as the boot storyboard and the
// hero mock-ups were rendered). A tiny static server serves the worktree, so a page loads the design system's tokens.css, the
// app's vendored three.js (through the boot's orb.js) and W1's gl.js as they are.
//   python3 -I -B docs/build-plan/mockups/hud/2026-11-08/build.py          writes the pages
//   node docs/build-plan/mockups/hud/2026-11-08/render.mjs home-evening    one page   →  home-evening.png (440 × 956 at 2×)
//   node docs/build-plan/mockups/hud/2026-11-08/render.mjs all             every page that has no PNG yet (or `all force`)
//   node docs/build-plan/mockups/hud/2026-11-08/render.mjs contact         the sheet from the PNGs already made  →  contact.png
// Each run is one short step (a container restart loses nothing but the frame in hand).
import { chromium } from 'playwright';
import { createReadStream, statSync, existsSync, readdirSync } from 'node:fs';
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
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    return void res.writeHead(404).end();
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${rel}`;

const [what, flag] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function shoot(name, { sheet = false } = {}) {
  const out = join(here, `${name}.png`);
  const ctx = await browser.newContext({ viewport: sheet ? { width: 1230, height: 1000 } : { width: 440, height: 956 }, deviceScaleFactor: sheet ? 1.25 : 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(`${base}/${name}.html`);
  await page.evaluate(() => document.fonts.ready);
  if (!sheet) await page.waitForFunction(() => window.__frameReady === true, null, { timeout: 300000, polling: 250 });
  await page.waitForLoadState('networkidle');
  if (sheet) {
    const size = await page.evaluate(() => ({ width: Math.ceil(document.documentElement.scrollWidth), height: Math.ceil(document.documentElement.scrollHeight) }));
    await page.setViewportSize(size);
  }
  // a check the floor holds: nothing he can press under 44 × 44, no type under 12 px, nothing wider than the screen
  const report = sheet ? [] : await page.evaluate(() => {
    const out = [];
    const W = 440;
    for (const el of document.querySelectorAll('button, .g-key, .ret, [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44)) out.push(`target ${Math.round(r.width)}×${Math.round(r.height)}: ${el.className} "${(el.textContent || '').trim().slice(0, 24)}"`);
    }
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && (el.textContent || '').trim() && parseFloat(cs.fontSize) < 12 && cs.display !== 'none') out.push(`type ${cs.fontSize}: "${el.textContent.trim().slice(0, 24)}"`);
      const r = el.getBoundingClientRect();
      if (r.width && r.right > W + 1 && cs.position !== 'fixed' && !el.closest('.kb')) out.push(`sideways ${Math.round(r.right)}: ${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 24)}"`);
    }
    return out;
  });
  await page.screenshot({ path: out, fullPage: false });
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`${name}.png ${kb} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
  for (const e of errors.slice(0, 5)) console.log('   ! ' + e);
  for (const r of report.slice(0, 12)) console.log('   ? ' + r);
  await ctx.close();
}

try {
  if (what === 'contact') await shoot('contact', { sheet: true });
  else if (what === 'all') {
    const pages = readdirSync(here).filter((f) => f.endsWith('.html') && f !== 'contact.html').map((f) => f.slice(0, -5)).sort();
    for (const p of pages) if (flag === 'force' || !existsSync(join(here, `${p}.png`))) await shoot(p);
  } else if (what) await shoot(what);
  else console.log('render.mjs <page> | all [force] | contact');
} finally {
  await browser.close();
  server.close();
}
