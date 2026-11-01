// THE KART RACER, THE HOPPER and THE ARENA (BRIEF-GAMES-3), each started in the harness page (tests/fixtures/games3: the
// player at its smallest, bundled here with esbuild and served on the preview's own origin under the production
// security policy, so three.js and the styles are the build's) on a 390 × 844 phone at 3 device pixels. Each game
// starts and draws (two snapshots differ), its menu reads Play · How to play · Sound · Quit, a touch changes the game
// (a steer, a hop, a split), the controller's Intent moves it, pause and resume (its own PAUSE and the handle's), quit
// lets the canvas go, and the score is written: the kart after a one-lap race its own code drives (the places, a lap
// record and Ghosty's line), the hopper when the fog or the traffic ends a run, the arena when a short round ends.
// Nothing sideways; every control labelled and 44 pt. The frame times (p50, p95, our own work), the draw calls, the
// triangles and the time to the first frame are printed.
//   BASE=http://localhost:8799 node tests/games3.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const root = new URL('..', import.meta.url).pathname;
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const bundle = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games3/harness.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, external: ['/vendor/*'], logLevel: 'warning' });
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(root, 'tests/fixtures/games3/index.html'), 'utf8');
const csp = /Content-Security-Policy: (default-src 'self'[^\n]*)/.exec(readFileSync(join(root, 'apps/web/public/_headers'), 'utf8'))[1];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const numbers = [];
const MENU = ['Play', 'How to play', 'Sound: on', 'Quit'];

async function open(game, args = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...UK });
  await ctx.route(`${base}/__g3/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/__g3/harness.js') return route.fulfill({ body: js, contentType: 'text/javascript', headers: { 'content-security-policy': csp } });
    return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || /Refused to|Content Security Policy/.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/__g3/index.html?game=${game}&args=${encodeURIComponent(args)}`);
  await page.waitForFunction(() => window.__g3?.ready || window.__g3?.events?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__g3.events.error);
  check(!err, `${game}: it starts${err ? `: ${err}` : ''}`);
  await page.waitForFunction(() => window.__g3.handle.peek().frames > 3, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const peek = (page) => page.evaluate(() => window.__g3.handle.peek());
const shotOf = (page) => page.locator('#stage > canvas').screenshot();
const frames = async (page) => (await peek(page)).frames;
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
/** A snapshot with the game held (the handle's pause) while it is taken: a busy machine is slow to take one. */
async function held(page) {
  await page.evaluate(() => window.__g3.handle.pause());
  const shot = await shotOf(page);
  await page.evaluate(() => window.__g3.handle.resume());
  return shot;
}
async function stillThenMoving(page, what, resume) {
  const a = await frames(page);
  await page.waitForTimeout(600);
  const b = await frames(page);
  check(b - a <= 1, `${what}: paused, no frames drawn (${b - a} in 600 ms)`);
  await resume();
  await page.waitForTimeout(900);
  check((await frames(page)) > b + 1, `${what}: resumed, frames drawn again`);
}
async function sideways(page, game) {
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('.g2ui *')) {
      if (el.closest('.g3tags, .g3base, .g3mist, .g3moves')) continue; // names on cells, the stick where a thumb lands, the fog: drawn over the scene
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.left < -1 || b.right > W + 1) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.className} ${Math.round(b.left)}…${Math.round(b.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, W, out };
  });
  check(r.scroll <= r.W && r.out.length === 0, `${game}: nothing sideways at 390 × 844 (${r.out.slice(0, 3).join('; ') || 'all inside'})`);
}
async function labelled(page, game, where) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.g2ui button, .g2ui input')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className));
  const small = await page.evaluate(() => [...document.querySelectorAll('.g2ui .g2menu button, .g2ui .g3pause, .g2ui .g3drift, .g2ui .g3item, .g2ui .g3gas, .g2ui .g3steer, .g2ui .g3split, .g2ui .g3eject')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().height)}`));
  check(bad.length === 0, `${game} ${where}: every control has a VoiceOver label${bad.length ? `: ${bad.join(', ')}` : ''}`);
  check(small.length === 0, `${game} ${where}: every button is 44 pt or more${small.length ? `: ${small.join(', ')}` : ''}`);
}
async function measure(page, game, ms = 4000) {
  await page.evaluate(() => window.__g3.handle.resetStats());
  await page.waitForTimeout(ms);
  const s = await peek(page);
  const line = `${game}: first frame ${Math.round(s.firstFrameMs)} ms after start(); frame interval p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms; our own work p95 ${s.workP95.toFixed(1)} ms; drawn at ${s.scale}× (${s.width} × ${s.height}); ${s.calls} draw calls, ${s.triangles} triangles`;
  numbers.push(line);
  console.log(`     ${line}`);
  return s;
}
async function quitFrees(page, game) {
  await page.evaluate(() => window.__g3.handle.quit());
  const after = await page.evaluate(() => {
    const c = window.__g3.canvas;
    const gl = c.getContext('webgl2');
    return { w: c.width, h: c.height, lost: !gl || gl.isContextLost(), ui: !!document.querySelector('.g2ui'), f: window.__g3.handle.peek().frames };
  });
  await page.waitForTimeout(500);
  const f2 = await frames(page);
  check(after.w === 0 && after.h === 0 && after.lost && !after.ui && f2 === after.f, `${game}: quit lets the canvas go (0 × 0, its context lost, the overlay gone, no more frames)`);
}
const scores = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}'));
const menuOf = (page) => page.locator('.g2menu .g2btns button').allTextContents();

// ================================================================ THE KART RACER
{
  const { ctx, page, errors } = await open('kart');
  const a = await shotOf(page);
  await page.waitForTimeout(1200);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, 'kart: two snapshots of the title differ (the camera turns round the grid)');
  await page.screenshot({ path: `${out}/games3-kart-title.png` });
  check(JSON.stringify(await menuOf(page)) === JSON.stringify(MENU), `kart: Play · How to play · Sound · Quit (${(await menuOf(page)).join(' · ')})`);
  check(await page.locator('.g2menu .g2line', { hasText: 'drift' }).isVisible(), 'kart: Ghosty\'s line on the title');
  check(await page.locator('.g2menu .g2note', { hasText: 'sideways' }).isVisible(), 'kart: upright, it says it plays best turned sideways');
  await labelled(page, 'kart', 'title');
  await page.locator('.g2btn[data-id="how-to-play"]').tap();
  check(await page.locator('.g2how', { hasText: 'Drift' }).isVisible(), 'kart: How to play explains the drift');
  await page.locator('.g2btn[data-id="back"]').tap();
  await page.locator('.g2btn[data-id="play"]').tap();
  check((await page.locator('.g3track').count()) === 3, 'kart: three tracks to choose');
  await labelled(page, 'kart', 'tracks');
  await page.locator('[data-id="track-seaside"]').tap();
  check((await peek(page)).mode === 'race', 'kart: a track starts a race');
  check(await until(page, () => window.__g3.handle.peek().lights >= 1, null, 10000), 'kart: the start light comes on');
  check(await until(page, () => window.__g3.handle.peek().t > 0.6, null, 20000), 'kart: and goes green');
  const s1 = await held(page);
  await page.waitForTimeout(500);
  const s2 = await held(page);
  check(Buffer.compare(s1, s2) !== 0, 'kart: two snapshots of the race differ');
  // the left thumb steers: dragged right, the kart turns right (its heading falls)
  let s = await peek(page);
  const h0 = s.heading;
  await page.mouse.move(90, 650);
  await page.mouse.down();
  await page.mouse.move(150, 650, { steps: 4 });
  await page.waitForTimeout(250);
  const steering = (await peek(page)).steer;
  await page.waitForTimeout(500);
  await page.mouse.up();
  s = await peek(page);
  check(steering > 0.5 && s.heading < h0 - 0.12, `kart: the stick steers right (steer ${steering.toFixed(2)}, heading ${h0.toFixed(2)} → ${s.heading.toFixed(2)}, ${s.speed.toFixed(1)} m/s)`);
  // a controller's stick through the Intent turns it back left
  const h1 = s.heading;
  await page.evaluate(() => (window.__g3.intent.moveX = -1));
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.__g3.intent.moveX = 0));
  s = await peek(page);
  check(s.heading > h1 + 0.12, `kart: a controller steers left (heading ${h1.toFixed(2)} → ${s.heading.toFixed(2)})`);
  await page.evaluate(() => window.__g3.handle.pause());
  await page.screenshot({ path: `${out}/games3-kart-race.png` });
  await labelled(page, 'kart', 'racing');
  await sideways(page, 'kart');
  await page.evaluate(() => window.__g3.handle.resume());
  await page.locator('.g3pause').tap();
  check((await peek(page)).mode === 'paused', 'kart: PAUSE pauses the race');
  check(JSON.stringify((await menuOf(page)).slice(0, 3)) === JSON.stringify(['Resume', 'How to play', 'Sound: on']), 'kart: the pause menu');
  await labelled(page, 'kart', 'paused');
  await stillThenMoving(page, 'kart PAUSE', () => page.locator('.g2btn[data-id="resume"]').tap());
  await page.evaluate(() => window.__g3.handle.pause());
  await stillThenMoving(page, 'kart handle.pause()', () => page.evaluate(() => window.__g3.handle.resume()));
  await measure(page, 'kart (Saltwind Bay, racing)', 4000);
  await quitFrees(page, 'kart');
  check(errors.length === 0, `kart: no page errors or blocked loads${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
{
  // a whole race, one lap at Neon Harbour, his kart driven by the bots' own code (the harness word "auto")
  const { ctx, page, errors } = await open('kart', 'laps=1,auto');
  await page.locator('.g2btn[data-id="play"]').tap();
  await page.locator('[data-id="track-city"]').tap();
  await until(page, () => window.__g3.handle.peek().t > 3, null, 30000);
  await measure(page, 'kart (Neon Harbour, racing)', 3000);
  const over = await until(page, () => window.__g3.handle.peek().mode === 'over', null, 180000);
  const s = await peek(page);
  check(over && s.done && s.place >= 1, `kart: the race finishes (${s.place}${['st', 'nd', 'rd', 'th'][Math.min(3, s.place - 1)]} of 4: ${s.places.join(', ')})`);
  await page.screenshot({ path: `${out}/games3-kart-finish.png` });
  const rows = await page.locator('.g3table li').count();
  const line = (await page.locator('.g2menu .g2line').textContent()) ?? '';
  check(rows === 4 && line.length > 10, `kart: the places, and Ghosty's line on his own ("${line}")`);
  const sc = await scores(page);
  check(sc['kart-racer'] && sc['kart-racer'].last >= 3, `kart: the race's points are written (${JSON.stringify(sc['kart-racer'])})`);
  check(!!sc['kart-racer.lap.city'] && !!sc['kart-racer.ghosty.city'], 'kart: and the lap records, his and Ghosty\'s');
  check((await menuOf(page))[0] === 'Race again', 'kart: Race again after the finish');
  await page.locator('.g2btn[data-id="race-again"]').tap();
  check((await peek(page)).mode === 'race' && (await peek(page)).t < 0, 'kart: Race again starts at the lights');
  await quitFrees(page, 'kart (after a race)');
  check(errors.length === 0, `kart race: no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

// ================================================================ THE HOPPER
{
  const { ctx, page, errors } = await open('hopper');
  const a = await shotOf(page);
  await page.waitForTimeout(1200);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, 'hopper: two snapshots of the title differ (the traffic goes on under it)');
  await page.screenshot({ path: `${out}/games3-hopper-title.png` });
  check(JSON.stringify(await menuOf(page)) === JSON.stringify(MENU), `hopper: Play · How to play · Sound · Quit (${(await menuOf(page)).join(' · ')})`);
  check((await page.locator('.g3hopper').count()) === 4, 'hopper: four hoppers to choose');
  check(!!(await scores(page))['hopper.ghosty'], 'hopper: Ghosty has practised a run of his own (his best is kept)');
  await labelled(page, 'hopper', 'title');
  await page.locator('[data-id="hopper-hen"]').tap();
  check((await peek(page)).hopper === 'frog' && /coins/.test((await page.locator('.g2say').textContent()) ?? ''), 'hopper: the hen waits for the coins it costs');
  await page.locator('.g2btn[data-id="play"]').tap();
  check((await peek(page)).mode === 'play', 'hopper: Play starts a run');
  await page.mouse.click(200, 520);
  check(await until(page, () => window.__g3.handle.peek().r >= 1, null, 4000), 'hopper: a tap hops forward');
  await page.mouse.move(150, 560);
  await page.mouse.down();
  await page.mouse.move(240, 560, { steps: 4 });
  await page.mouse.up();
  check(await until(page, () => window.__g3.handle.peek().x === 1, null, 4000), `hopper: a swipe right sidesteps (x ${(await peek(page)).x})`);
  await page.evaluate(() => (window.__g3.intent.moveX = -1));
  const padOk = await until(page, () => window.__g3.handle.peek().x === 0, null, 4000);
  await page.evaluate(() => (window.__g3.intent.moveX = 0));
  check(padOk, 'hopper: a controller\'s d-pad sidesteps back');
  const s1 = await held(page);
  await page.waitForTimeout(500);
  const s2 = await held(page);
  check(Buffer.compare(s1, s2) !== 0, 'hopper: two snapshots of a run differ');
  await page.evaluate(() => window.__g3.handle.pause());
  await page.screenshot({ path: `${out}/games3-hopper-play.png` });
  await labelled(page, 'hopper', 'playing');
  await sideways(page, 'hopper');
  await page.evaluate(() => window.__g3.handle.resume());
  await page.locator('.g3pause').tap();
  check((await peek(page)).mode === 'paused', 'hopper: PAUSE pauses the run');
  await labelled(page, 'hopper', 'paused');
  await stillThenMoving(page, 'hopper PAUSE', () => page.locator('.g2btn[data-id="resume"]').tap());
  await page.evaluate(() => window.__g3.handle.pause());
  await stillThenMoving(page, 'hopper handle.pause()', () => page.evaluate(() => window.__g3.handle.resume()));
  await measure(page, 'hopper', 3000);
  // left alone, the fog rolls in (or the traffic gets him first)
  const ended = await until(page, () => window.__g3.handle.peek().mode === 'over', null, 40000);
  const s = await peek(page);
  await page.screenshot({ path: `${out}/games3-hopper-over.png` });
  const title = (await page.locator('.g2menu .g2title').textContent()) ?? '';
  const line = (await page.locator('.g2menu .g2line').textContent()) ?? '';
  check(ended && !s.alive && ['Squashed', 'Flattened', 'Hit by the train', 'Splash', 'Swept away', 'Lost in the fog'].includes(title) && line.length > 10, `hopper: the run ends (${s.death}: "${title}"), with Ghosty's line ("${line}")`);
  const sc = (await scores(page)).hopper;
  check(sc && sc.last >= 1 && sc.best >= sc.last, `hopper: the score is written (${JSON.stringify(sc)})`);
  check((await menuOf(page))[0] === 'Hop again', 'hopper: Hop again');
  await page.locator('.g2btn[data-id="hop-again"]').tap();
  const again = await peek(page);
  check(again.mode === 'play' && again.alive && again.r === 0, 'hopper: and at once a fresh run');
  await quitFrees(page, 'hopper');
  check(errors.length === 0, `hopper: no page errors or blocked loads${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

// ================================================================ THE ARENA
{
  const { ctx, page, errors } = await open('arena', 'round=24,mass=60');
  const a = await shotOf(page);
  await page.waitForTimeout(1200);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, 'arena: two snapshots of the title differ (the bots play on under it)');
  await page.screenshot({ path: `${out}/games3-arena-title.png` });
  check(JSON.stringify(await menuOf(page)) === JSON.stringify(MENU), `arena: Play · How to play · Sound · Quit (${(await menuOf(page)).join(' · ')})`);
  await labelled(page, 'arena', 'title');
  await page.locator('.g2btn[data-id="play"]').tap();
  check((await peek(page)).mode === 'play', 'arena: Play starts a round');
  let s = await peek(page);
  const x0 = s.x;
  await page.mouse.move(160, 560);
  await page.mouse.down();
  await page.mouse.move(250, 560, { steps: 5 });
  await page.waitForTimeout(1200);
  s = await peek(page);
  await page.mouse.up();
  check(s.hx > 0.8 && s.x > x0 + 2, `arena: a drag steers the cell (heading ${s.hx.toFixed(2)}, ${s.z.toFixed(1)}; x ${x0.toFixed(1)} → ${s.x.toFixed(1)})`);
  await page.locator('.g3split').tap();
  check(await until(page, () => window.__g3.handle.peek().cells >= 2, null, 3000), 'arena: SPLIT splits the cell');
  await page.evaluate(() => (window.__g3.intent.moveY = 1));
  const up = await until(page, () => window.__g3.handle.peek().hz < -0.8, null, 3000);
  await page.evaluate(() => (window.__g3.intent.moveY = 0));
  check(up, 'arena: a controller\'s stick steers it up the arena');
  const s1 = await held(page);
  await page.waitForTimeout(500);
  const s2 = await held(page);
  check(Buffer.compare(s1, s2) !== 0, 'arena: two snapshots of a round differ');
  await page.evaluate(() => window.__g3.handle.pause());
  await page.screenshot({ path: `${out}/games3-arena-play.png` });
  await labelled(page, 'arena', 'playing');
  await sideways(page, 'arena');
  await page.evaluate(() => window.__g3.handle.resume());
  await page.locator('.g3pause').tap();
  check((await peek(page)).mode === 'paused', 'arena: PAUSE pauses the round');
  await labelled(page, 'arena', 'paused');
  await stillThenMoving(page, 'arena PAUSE', () => page.locator('.g2btn[data-id="resume"]').tap());
  await page.evaluate(() => window.__g3.handle.pause());
  await stillThenMoving(page, 'arena handle.pause()', () => page.evaluate(() => window.__g3.handle.resume()));
  await measure(page, 'arena', 3000);
  const ended = await until(page, () => window.__g3.handle.peek().mode === 'over', null, 60000);
  s = await peek(page);
  await page.screenshot({ path: `${out}/games3-arena-over.png` });
  const title = (await page.locator('.g2menu .g2title').textContent()) ?? '';
  const line = (await page.locator('.g2menu .g2line').textContent()) ?? '';
  check(ended && (title === 'Round over' || title.startsWith('Eaten by ')) && line.length > 10 && (await page.locator('.g3table li').count()) >= 3, `arena: the round ends ("${title}"), with the table and Ghosty's line ("${line}")`);
  const sc = await scores(page);
  check(sc.arena && sc.arena.best >= 60, `arena: your peak mass is written (${JSON.stringify(sc.arena)})`);
  check(sc['arena.ghosty'] && sc['arena.ghosty'].best > 18, `arena: and his bots' best, his ring (${JSON.stringify(sc['arena.ghosty'])})`);
  await quitFrees(page, 'arena');
  check(errors.length === 0, `arena: no page errors or blocked loads${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${numbers.join('\n')}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nall games3 checks passed');
