// Renders the boot storyboard with real WebGL in headless Chromium (software WebGL, as docs/build-plan/mockups/hero/render.mjs
// and tests/studio.spec.mjs run it). A tiny static server serves the worktree, so frame.html loads the app's own vendored
// three.js and the design system's tokens.css as they are.
//   node docs/build-plan/mockups/boot/2026-11-07/render.mjs shot 1        one shot (1..8)  →  shot-1.png
//   node docs/build-plan/mockups/boot/2026-11-07/render.mjs extra map     the Map's frame   →  extra-map.png (or paper)
//   node docs/build-plan/mockups/boot/2026-11-07/render.mjs states        the five states   →  states.png
//   node docs/build-plan/mockups/boot/2026-11-07/render.mjs contact       the sheet from the PNGs already made  →  contact.png
// Each run is one short step (a container restart loses nothing but the frame in hand); the frames are 440 × 956 at 2×.
import { chromium } from 'playwright';
import { createReadStream, statSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUT, BEAT, HUD_MS, SHOTS, EXTRA, STATES } from './cut.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const rel = here.slice(root.length + 1);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
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

const [what, which] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shoot(url, out, { width, height, scale = 2, full = false, ready = '__frameReady' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  if (ready) await page.waitForFunction((k) => window[k] === true, ready, { timeout: 240000 });
  await page.waitForLoadState('networkidle');
  if (full) {
    const size = await page.evaluate(() => ({ width: Math.ceil(document.documentElement.scrollWidth), height: Math.ceil(document.documentElement.scrollHeight) }));
    await page.setViewportSize(size);
  }
  await page.screenshot({ path: out, fullPage: full });
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`${out.replace(root + '/', '')} ${kb} KB${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
  for (const e of errors.slice(0, 5)) console.log('   ! ' + e);
  await ctx.close();
}

const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2).replace(/0$/, '')} s` : `${v} ms`);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** The cut as a bar: each beat's share of the whole, the one the shot is in lit. */
function bar(at) {
  const keys = ['ground', 'floor', 'orb', 'stamp', 'feeds', 'recognise', 'greeting', 'land'];
  const ends = keys.map((k, i) => (i < keys.length - 1 ? CUT[keys[i + 1]] : CUT.end));
  const segs = keys.map((k, i) => `<i class="${at >= CUT[k] && at < ends[i] ? 'on' : ''}" style="flex:${ends[i] - CUT[k]}"></i>`).join('');
  const ticks = [0, 1000, 2000, CUT.end].map((t) => `<u style="left:${((t / CUT.end) * 100).toFixed(1)}%">${t === CUT.end ? 'HOME ' : ''}${ms(t)}</u>`).join('');
  return `<div class="bar">${segs}</div><div class="ticks">${ticks}</div>`;
}
function contactPage() {
  const fig = (png, n, name, at, what, truth) => `<figure><img src="${png}" alt=""><figcaption><span class="g-tag">${n} <span class="g-count">· ${ms(at)}</span></span><p class="g-truth">${esc(name)}</p><p class="what">${esc(what)}</p></figcaption></figure>`;
  const rows = [];
  rows.push(SHOTS.slice(0, 4).map((s) => fig(`shot-${s.n}.png`, `Shot ${s.n}`, s.name, s.at, s.what, s.truth)).join(''));
  rows.push(SHOTS.slice(4).map((s) => fig(`shot-${s.n}.png`, `Shot ${s.n}`, s.name, s.at, s.what, s.truth)).join(''));
  rows.push(EXTRA.map((e) => fig(`extra-${e.key}.png`, e.key === 'map' ? 'The Map' : 'Paper', e.name, e.at, e.what, e.truth)).join(''));
  return `<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head><meta charset="utf-8"><title>Ghosty · the boot · storyboard</title>
<link rel="stylesheet" href="../../fonts.css"><link rel="stylesheet" href="../../../../../apps/web/src/design/tokens.css"><link rel="stylesheet" href="boot.css">
<style>body { width: auto; height: auto; }</style></head>
<body class="sheet">
<h1>The boot, shot by shot</h1>
<p class="lede">Reactor · Graphite · The Scan, 440 × 956. The ground, the floor forming, the orb forming from his library’s points, the stamp line typing itself, the feeds answering, the recognition, the greeting, then Home: ${ms(CUT.end)} to a usable Home (the HUD settled at ${ms(CUT.end + BEAT + HUD_MS)}). A tap skips to Home at any moment. Every line on it is true of that moment; the README says where each truth comes from.</p>
${bar(-1)}
<div class="row">${rows[0]}</div>
<div class="row">${rows[1]}</div>
<p class="lede" style="margin-top:32px">The world and the ground in it: The Map’s floor forming, and Paper, which boots on the night ground.</p>
<div class="row">${rows[2]}</div>
</body></html>`;
}
function statesPage() {
  const figs = STATES.map((s) => `<figure><canvas data-state="${s.key}" width="400" height="400"></canvas><figcaption><span class="g-tag ${s.key === 'attending' ? 'on' : ''}">${s.name}</span><p class="what">${esc(s.line)}</p></figcaption></figure>`).join('');
  return `<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head><meta charset="utf-8"><title>Ghosty · the orb · five states</title>
<link rel="stylesheet" href="../../fonts.css"><link rel="stylesheet" href="../../../../../apps/web/src/design/tokens.css"><link rel="stylesheet" href="boot.css">
<style>body { width: auto; height: auto; } .states figure { position: relative; } .states .g-lock { left: 14px; top: 14px; width: 172px; height: 172px; }</style></head>
<body class="sheet states">
<h1>The orb’s five states</h1>
<p class="lede">The same live hologram (mind.ts) drawn five times from one WebGL context, each state one visible change; Reduce Motion holds each as a still. Attending is new: the reticle has landed on the thing (ui/machine.ts recognise), so the box in the accent is on it.</p>
<div class="row">${figs}</div>
<script type="module">
import { Orb } from './orb.js';
const gl = document.createElement('canvas'); gl.width = gl.height = 400;
const orb = new Orb(gl, { level: 0.5 }); orb.size(200, 200, 2);
for (const c of document.querySelectorAll('canvas[data-state]')) {
  const st = c.dataset.state;
  orb.draw(st === 'thinking' ? 12.9 : 12.5, st, null, 0);
  c.getContext('2d').drawImage(gl, 0, 0);
  if (st === 'attending') { const l = document.createElement('span'); l.className = 'g-lock'; l.dataset.state = 'attend'; l.innerHTML = '<span class="g-ret-frame"></span>'; c.parentElement.append(l); }
}
window.__frameReady = true;
</script>
</body></html>`;
}

try {
  if (what === 'shot') {
    const s = SHOTS.find((x) => x.n === +which);
    await shoot(`${base}/frame.html?shot=${s.n}`, join(here, `shot-${s.n}.png`), { width: 440, height: 956 });
  } else if (what === 'extra') {
    const e = EXTRA.find((x) => x.key === which);
    await shoot(`${base}/frame.html?extra=${e.key}&world=${e.world}&ground=${e.ground}&night=${e.night}`, join(here, `extra-${e.key}.png`), { width: 440, height: 956 });
  } else if (what === 'at') {
    // any moment, for looking: node render.mjs at 1800 [query]
    await shoot(`${base}/frame.html?t=${which}${process.argv[4] ? '&' + process.argv[4] : ''}`, join(here, `at-${which}.png`), { width: 440, height: 956 });
  } else if (what === 'states') {
    writeFileSync(join(here, 'states.html'), statesPage());
    await shoot(`${base}/states.html`, join(here, 'states.png'), { width: 1200, height: 420, full: true });
  } else if (what === 'contact') {
    writeFileSync(join(here, 'contact.html'), contactPage());
    const missing = [...SHOTS.map((s) => `shot-${s.n}.png`), ...EXTRA.map((e) => `extra-${e.key}.png`)].filter((f) => !existsSync(join(here, f)));
    if (missing.length) console.log('missing: ' + missing.join(' '));
    await shoot(`${base}/contact.html`, join(here, 'contact.png'), { width: 1230, height: 1000, scale: 1.6, full: true, ready: null });
  } else console.log('shot <1..8> | extra <map|paper> | at <ms> | states | contact');
} finally {
  await browser.close();
  server.close();
}
