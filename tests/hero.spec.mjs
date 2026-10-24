// MIND, Home's 3-D centrepiece (features/core/mind.ts), on the iPhone 18 Pro Max's 440 × 956 with
// software WebGL (SwiftShader, as tests/studio.spec.mjs runs it). Home shows the Mind canvas once three.js has loaded
// from this site (/vendor/three, nothing from the network); its node count follows the brain's library counts (one
// node per 20 passages, shared across the fields by their topics, lit by what is read); listening and thinking change
// what is drawn (the exported state, and a pixel difference); it is drawn in the theme's accent and takes another
// theme's at once (Reactor's cyan, Graphite's steel); with "reduce motion" it draws one frame and runs no
// loop; with WebGL unavailable today's 2-D reactor stays. It also reports the frame time at idle and saves Home in
// each state.
//   BASE=http://localhost:8806 node tests/hero.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];

// The library the brain reports, stubbed so the counts are known: 4,186 passages over five fields.
const LIB = { docs: [], stats: { docs: 12, passages: 4186, chars: 0, bytes: 0, vectors: 0 }, starterReady: true, vectors: false };
const FIELDS = [
  { id: 'algorithms-data-structures', name: 'Algorithms', topics: 120, read: 60, digested: 0, focus: false },
  { id: 'calculus-analysis', name: 'Calculus', topics: 80, read: 20, digested: 0, focus: false },
  { id: 'world-history', name: 'World history', topics: 60, read: 0, digested: 0, focus: false },
  { id: 'chemistry', name: 'Chemistry', topics: 50, read: 50, digested: 0, focus: false },
  { id: 'psychology', name: 'Psychology', topics: 40, read: 10, digested: 0, focus: false },
];
const STUDY = { on: false, i: 0, gaps: [], sessions: 0, focus: [], summary: { topics: 350, read: 140, digested: 0, domains: FIELDS, levels: [], today: { reads: 0, digests: 0, drills: 0, ai: 0 }, drills: { asked: 0, right: 0, skills: [] }, pending: 0 } };
/** What the app should draw for those numbers (the same rule as mind.ts `plan`). */
function expected() {
  const total = Math.min(600, Math.round(LIB.stats.passages / 20));
  const all = FIELDS.reduce((n, f) => n + f.topics, 0);
  let left = total;
  let nodes = 0;
  let lit = 0;
  [...FIELDS].sort((a, b) => b.topics - a.topics).forEach((f, i, a) => {
    const share = i === a.length - 1 ? left : Math.max(1, Math.round((total * f.topics) / all));
    const n = Math.min(left, share);
    left -= n;
    nodes += n;
    lit += Math.min(n, Math.round((n * f.read) / f.topics));
  });
  return { nodes, lit, fields: FIELDS.length };
}

async function open({ reducedMotion = 'no-preference', noWebGL = false } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript((off) => {
    window.__ghostyHero = true; // this check wants Mind (every other check keeps the 2-D reactor: mind.ts)
    window.__csp = [];
    window.__threeLoads = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    if (off) {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/i.test(type) ? null : get.call(this, type, ...rest);
      };
    }
  }, noWebGL);
  await page.route('**/api/library', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIB) }) : r.continue()));
  await page.route('**/api/library/study', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDY) }) : r.continue()));
  const three = [];
  page.on('request', (r) => /three/.test(r.url()) && three.push(r.url()));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  // Home starts Mind and its four gauges during boot: on a loaded machine with software WebGL this takes a while.
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page, three };
}
const hero = (page) => page.evaluate(() => ({ ...(window.__ghosty?.hero ?? {}) }));
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const shot = async (page) => (await page.locator('canvas.mindhero').screenshot()).toString('base64');
const diff = (a, b) => a !== b;

// ---- 1. Home: Mind loads, its numbers follow the library
{
  const { ctx, page, three } = await open();
  await until(page, () => window.__ghosty?.hero?.mode === 'mind', 60000, `Mind never took over Home (hero: ${JSON.stringify(await hero(page))})`);
  await until(page, (n) => window.__ghosty?.hero?.nodes === n, 20000, 'the node count never followed the library', expected().nodes);
  const h = await hero(page);
  const want = expected();
  if (h.nodes !== want.nodes || h.lit !== want.lit || h.fields !== want.fields) problems.push(`nodes ${h.nodes}/${want.nodes}, lit ${h.lit}/${want.lit}, fields ${h.fields}/${want.fields}`);
  if (h.passages !== 4186) problems.push(`the hero read ${h.passages} passages, not 4,186`);
  if (!three.some((u) => new URL(u).origin === new URL(base).origin && /\/vendor\/three\/three\.module\.min\.js$/.test(u))) problems.push(`three.js was not loaded from this site: ${three.join(', ')}`);
  if (three.some((u) => new URL(u).origin !== new URL(base).origin)) problems.push(`three.js came from elsewhere: ${three.join(', ')}`);
  const dom = await page.evaluate(() => {
    const gl = document.querySelectorAll('canvas.mindhero');
    const r2 = document.querySelector('canvas.reactor');
    const a = gl[0]?.getBoundingClientRect();
    const b = r2?.getBoundingClientRect();
    return { count: gl.length, hidden2d: r2 ? getComputedStyle(r2).opacity : null, a: a && [a.x, a.y, a.width, a.height].map(Math.round), b: b && [b.x, b.y, b.width, b.height].map(Math.round), csp: window.__csp };
  });
  if (dom.count !== 1) problems.push(`${dom.count} Mind canvases on Home (want exactly 1)`);
  if (dom.hidden2d !== '0') problems.push(`the 2-D reactor still shows under Mind (opacity ${dom.hidden2d})`);
  if (JSON.stringify(dom.a) !== JSON.stringify(dom.b)) problems.push(`Mind is not laid over the reactor's box: ${dom.a} vs ${dom.b}`);
  if (dom.csp.length) problems.push(`security policy blocked: ${dom.csp.join(', ')}`);
  // frame time at idle (software WebGL), measured by the hero itself
  await page.waitForTimeout(4000);
  const idle = await hero(page);
  console.log(`idle: ${idle.frames} frames, ${idle.frameMs.toFixed(1)} ms per frame (Chromium, SwiftShader software WebGL, 440 × 956 at 2x)`);
  const f0 = idle.frames;
  await page.waitForTimeout(2000);
  const fps = ((await hero(page)).frames - f0) / 2;
  console.log(`idle: ${fps.toFixed(1)} frames a second drawn (the budget is 30)`);
  if (fps > 33) problems.push(`idle draws ${fps} frames a second (budget 30)`);
  await page.screenshot({ path: `${out}/hero-idle.png` });
  const a = await shot(page);

  // ---- 1b. the theme's accent (BRIEF-ONE-LOOK): Mind is drawn in Reactor's cyan, takes Graphite's steel at once, and back
  if (idle.accent !== '#64d2ff') problems.push(`Mind is drawn in "${idle.accent}", not Reactor's #64d2ff`);
  await page.evaluate(() => window.__ghosty.run('set_theme', { theme: 'graphite' }));
  await until(page, () => window.__ghosty.hero.accent === '#9db7cc', 8000, 'Mind did not take Graphite\'s accent');
  await page.waitForTimeout(1200);
  if (!diff(a, await shot(page))) problems.push('Mind looks the same in Graphite as in Reactor');
  await page.screenshot({ path: `${out}/hero-graphite.png` });
  await page.evaluate(() => window.__ghosty.run('set_theme', { theme: 'reactor' }));
  await until(page, () => window.__ghosty.hero.accent === '#64d2ff', 8000, 'Mind did not go back to Reactor\'s accent');
  await page.waitForTimeout(1200);

  // ---- 2. listening: the sphere opens, the rim brightens, the ear ring follows the mic
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'listening' }));
  await until(page, () => window.__ghosty.hero.state === 'listening', 8000, 'the hero never went to listening');
  await page.waitForTimeout(1200);
  const b = await shot(page);
  if (!diff(a, b)) problems.push('listening drew the same picture as idle');
  await page.screenshot({ path: `${out}/hero-listening.png` });

  // ---- 3. thinking: a reply in flight, pulses race along the links
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'idle', busy: true }));
  await until(page, () => window.__ghosty.hero.state === 'thinking', 8000, 'the hero never went to thinking while a reply was in flight');
  await page.waitForTimeout(1200);
  const c = await shot(page);
  if (!diff(b, c)) problems.push('thinking drew the same picture as listening');
  await page.screenshot({ path: `${out}/hero-thinking.png` });

  // ---- 4. offline: the rim and core go grey
  await page.evaluate(() => window.__ghosty.ui.set({ busy: false, connected: false }));
  await until(page, () => window.__ghosty.hero.state === 'offline', 8000, 'the hero never showed offline');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/hero-offline.png` });
  await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));

  // ---- 5. hidden: no frames while the page is hidden
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  });
  const h0 = (await hero(page)).frames;
  await page.waitForTimeout(1500);
  const h1 = (await hero(page)).frames;
  if (h1 !== h0) problems.push(`Mind drew ${h1 - h0} frames while the page was hidden`);
  await ctx.close();
}

// ---- 6. reduce motion: one still frame, no loop
{
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await until(page, () => window.__ghosty?.hero?.mode === 'mind', 60000, 'Mind never loaded with reduce motion');
  await page.waitForTimeout(2500);
  const h0 = await hero(page);
  await page.waitForTimeout(2500);
  const h1 = await hero(page);
  if (h0.loop !== false) problems.push('reduce motion: the hero still runs a loop');
  if (h1.frames !== h0.frames) problems.push(`reduce motion: ${h1.frames - h0.frames} frames drawn while nothing changed`);
  if (h1.frames < 1) problems.push('reduce motion: not even one frame was drawn');
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'listening' }));
  await page.waitForTimeout(800);
  const h2 = await hero(page);
  if (h2.frames - h1.frames < 1 || h2.frames - h1.frames > 3) problems.push(`reduce motion: a state change drew ${h2.frames - h1.frames} frames (want one still)`);
  await page.screenshot({ path: `${out}/hero-reduced.png` });
  await ctx.close();
}

// ---- 7. no WebGL: today's 2-D reactor stays
{
  const { ctx, page, three } = await open({ noWebGL: true });
  await until(page, () => window.__ghosty?.hero?.mode === '2d', 30000, `with no WebGL the hero did not fall back (hero: ${JSON.stringify(await hero(page))})`);
  await page.waitForTimeout(1500);
  const dom = await page.evaluate(() => ({ gl: document.querySelectorAll('canvas.mindhero').length, r2: document.querySelector('canvas.reactor'), op: getComputedStyle(document.querySelector('canvas.reactor')).opacity }));
  if (dom.gl) problems.push('with no WebGL a Mind canvas was still on the page');
  if (dom.op !== '1') problems.push(`with no WebGL the 2-D reactor is not showing (opacity ${dom.op})`);
  if (three.length) problems.push(`with no WebGL three.js was still downloaded: ${three.join(', ')}`);
  await page.screenshot({ path: `${out}/hero-2d-fallback.png` });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `MIND run clean at 440 × 956: three.js loaded from this site once Home showed, ${expected().nodes} nodes (${expected().lit} lit) in ${expected().fields} field clusters from the library's counts, it took Graphite's accent and went back to Reactor's, listening and thinking changed the picture, offline went grey, nothing drawn while hidden, reduce motion drew one still per change with no loop, and with no WebGL the 2-D reactor stayed.`);
process.exit(problems.length ? 1 : 0);
