// Renders round two (BRIEF-HUD-MOCKS-2) in headless Chromium with software WebGL, as round one did; a tiny static server serves the
// worktree so a page loads the tokens, the vendored three.js and the fonts as they are.
//   python3 -I -B docs/build-plan/mockups/hud/2026-11-08-2/build.py              writes the pages
//   node docs/build-plan/mockups/hud/2026-11-08-2/render.mjs still home-evening  one frame at t=0 (or `still boot 5200`)  →  <page>.png at 2×
//   node .../render.mjs stills                                                   every still the sheet needs
//   node .../render.mjs film                                                     the boot, frame by frame at 30 fps → boot.mp4 (+ film/shot-NN.png)
//   node .../render.mjs home                                                     the evening Home alive for 4 s → home.mp4
//   node .../render.mjs live                                                     the boot played live under Playwright's recordVideo, to measure
//   node .../render.mjs contact                                                  the sheet from the PNGs already made → contact.png
// A video is photographed at 2× through the same render(t) the live page plays, then scaled to 440 × 956 by ffmpeg (supersampled,
// so the hairlines and the mono hold), H.264 at 30 fps.
import { chromium } from 'playwright';
import { createReadStream, statSync, existsSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const rel = here.slice(root.length + 1);
const scratch = process.env.SCRATCH || join(tmpdir(), 'hud2-frames'); // the film's frames, outside the repo
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
const CUT = JSON.parse(readFileSync(join(here, 'cut.json'), 'utf8'));
const FPS = 30;

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
  for (const el of document.querySelectorAll('button, .g-key, .ret, [role="button"]')) {
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

/** Photograph a page frame by frame through its render(t), then stitch at 30 fps to an mp4 at 440 × 956. */
async function film(name, ms, outName, shots = null) {
  const dir = join(scratch, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { ctx, page, errors } = await open(name, { t: 0 });
  const n = Math.round((ms / 1000) * FPS);
  const t0 = Date.now();
  const shotAt = new Map((shots || []).map((s) => [Math.round(((s.still ?? s.at) / 1000) * FPS), s.n]));
  for (let i = 0; i <= n; i++) {
    const t = (i / FPS) * 1000;
    await page.evaluate((t) => window.__render(t), t);
    const f = join(dir, `f${String(i).padStart(4, '0')}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 94 });
    if (shotAt.has(i)) {
      mkdirSync(join(here, 'film'), { recursive: true });
      await page.screenshot({ path: join(here, 'film', `shot-${String(shotAt.get(i)).padStart(2, '0')}.png`) });
    }
    if (i % 30 === 0) console.log(`  ${name} frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  for (const e of errors.slice(0, 5)) console.log('   ! ' + e);
  await ctx.close();
  const out = join(here, outName);
  const r = spawnSync('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.jpg'), '-vf', 'scale=440:956:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) console.log(r.stderr);
  console.log(`${outName} ${Math.round(statSync(out).size / 1024)} KB, ${n + 1} frames, ${(ms / 1000).toFixed(2)} s, ${((Date.now() - t0) / 1000).toFixed(0)} s to make`);
}

/** The boot played live (requestAnimationFrame) under recordVideo, to say honestly what this machine's software GPU manages. */
async function live(name, ms) {
  const dir = join(scratch, `${name}-live`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { ctx, page } = await open(name, { t: null, dpr: 1, video: dir });
  const t0 = Date.now();
  await page.waitForTimeout(ms);
  const frames = await page.evaluate(() => window.__frames());
  const el = (Date.now() - t0) / 1000;
  const v = page.video();
  await ctx.close();
  const p = await v.path();
  console.log(`live: ${frames} frames in ${el.toFixed(1)} s = ${(frames / el).toFixed(1)} fps on this machine's software GPU; webm ${Math.round(statSync(p).size / 1024)} KB at ${p}`);
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
  else if (what === 'stills') for (const p of ['home-evening', 'home-town', 'home-way', 'theme', 'ink-home']) await still(p);
  else if (what === 'film') await film('boot', CUT.cut.end, 'boot.mp4', CUT.shots);
  else if (what === 'home') await film('home-evening', 4000, 'home.mp4');
  else if (what === 'live') await live('boot', CUT.cut.end + 600);
  else if (what === 'contact') await sheet();
  else console.log('render.mjs still <page> [t] | stills | film | home | live | contact');
} finally {
  await browser.close();
  server.close();
}
