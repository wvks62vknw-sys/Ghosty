// THE BLOCK WORLD and THE RUNNER (BRIEF-GAMES-2), each started in the harness page (tests/fixtures/games2: the player
// at its smallest, bundled here with esbuild and served on the preview's own origin under the production security
// policy, so three.js and the styles are the build's) on a 390 × 844 phone at 3 device pixels. Each game starts and
// draws (two snapshots differ), a touch changes the game (a placed and a dug block; a lane), the controller's Intent
// moves it, pause and resume (its own PAUSE and the handle's), quit lets the canvas go, the score is written; the
// block world builds what is said (and lists what it can for a word it does not know) and keeps a saved world over a
// reload; the runner ends with a catch and Ghosty's line. Nothing sideways; every control labelled. The frame times
// (p50, p95, our own work) and the time to the first frame are printed.
//   BASE=http://localhost:8800 node tests/games2.spec.mjs tests/.shots
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
const bundle = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games2/harness.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, external: ['/vendor/*'], logLevel: 'warning' });
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(root, 'tests/fixtures/games2/index.html'), 'utf8');
const csp = /Content-Security-Policy: (default-src 'self'[^\n]*)/.exec(readFileSync(join(root, 'apps/web/public/_headers'), 'utf8'))[1];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const numbers = [];

async function open(game) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...UK });
  await ctx.route(`${base}/__g2/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/__g2/harness.js') return route.fulfill({ body: js, contentType: 'text/javascript', headers: { 'content-security-policy': csp } });
    return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || /Refused to|Content Security Policy/.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/__g2/index.html?game=${game}`);
  await page.waitForFunction(() => window.__g2?.ready || window.__g2?.events?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__g2.events.error);
  check(!err, `${game}: it starts${err ? `: ${err}` : ''}`);
  await page.waitForFunction(() => window.__g2.handle.peek().frames > 3, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const peek = (page) => page.evaluate(() => window.__g2.handle.peek());
const shotOf = (page) => page.locator('#stage canvas').screenshot();
const frames = async (page) => (await peek(page)).frames;
async function stillThenMoving(page, what, resume) {
  const a = await frames(page);
  await page.waitForTimeout(600);
  const b = await frames(page);
  check(b - a <= 1, `${what}: paused, no frames drawn (${b - a} in 600 ms)`);
  await resume();
  await page.waitForTimeout(700);
  check((await frames(page)) > b + 2, `${what}: resumed, frames drawn again`);
}
async function sideways(page, game) {
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('.g2ui *')) {
      if (el.closest('.g2bar') && !el.classList.contains('g2bar')) continue; // the hotbar scrolls inside itself
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.left < -1 || b.right > W + 1) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.className} ${Math.round(b.left)}…${Math.round(b.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, W, out };
  });
  check(r.scroll <= r.W && r.out.length === 0, `${game}: nothing sideways at 390 × 844 (${r.out.slice(0, 3).join('; ') || 'all inside'})`);
}
async function labelled(page, game, where) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.g2ui button, .g2ui input')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className));
  const small = await page.evaluate(() => [...document.querySelectorAll('.g2ui .g2menu button, .g2ui .g2bar button, .g2ui .g2pause, .g2ui .g2jump, .g2ui .g2buildbtn')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().height)}`));
  check(bad.length === 0, `${game} ${where}: every control has a VoiceOver label${bad.length ? `: ${bad.join(', ')}` : ''}`);
  check(small.length === 0, `${game} ${where}: every button is 44 pt or more${small.length ? `: ${small.join(', ')}` : ''}`);
}
async function measure(page, game, ms = 4000) {
  await page.evaluate(() => window.__g2.handle.resetStats());
  await page.waitForTimeout(ms);
  const s = await peek(page);
  const line = `${game}: first frame ${Math.round(s.firstFrameMs)} ms after start(); frame interval p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms; our own work p95 ${s.workP95.toFixed(1)} ms; drawn at ${s.scale}× (${s.width} × ${s.height}); ${s.calls} draw calls, ${s.triangles} triangles`;
  numbers.push(line);
  console.log(`     ${line}`);
  return s;
}
async function quitFrees(page, game) {
  await page.evaluate(() => window.__g2.handle.quit());
  const after = await page.evaluate(() => {
    const c = window.__g2.canvas;
    const gl = c.getContext('webgl2');
    return { w: c.width, h: c.height, lost: !gl || gl.isContextLost(), ui: !!document.querySelector('.g2ui'), f: window.__g2.handle.peek().frames };
  });
  await page.waitForTimeout(500);
  const f2 = await frames(page);
  check(after.w === 0 && after.h === 0 && after.lost && !after.ui && f2 === after.f, `${game}: quit lets the canvas go (0 × 0, its context lost, the overlay gone, no more frames)`);
}
const scores = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}'));

// ================================================================ THE BLOCK WORLD
{
  const { ctx, page, errors } = await open('voxel');
  const a = await shotOf(page);
  await page.waitForTimeout(1200);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, 'voxel: two snapshots of the title differ (the world turns under it)');
  await page.screenshot({ path: `${out}/games2-voxel-title.png` });
  check(await page.locator('.g2menu .g2title', { hasText: 'THE BLOCK WORLD' }).isVisible(), 'voxel: the title menu');
  const menu = await page.locator('.g2menu .g2btns button').allTextContents();
  check(JSON.stringify(menu) === JSON.stringify(['PLAY', 'HOW TO PLAY', 'SOUND: ON', 'QUIT']), `voxel: PLAY · HOW TO PLAY · SOUND · QUIT (${menu.join(' · ')})`);
  await labelled(page, 'voxel', 'title');
  await page.locator('.g2btn[data-id="how-to-play"]').tap();
  check(await page.locator('.g2how', { hasText: 'statue of a cat' }).isVisible(), 'voxel: HOW TO PLAY names the BUILD words');
  await page.locator('.g2btn[data-id="back"]').tap();
  await page.locator('.g2btn[data-id="play"]').tap();
  await page.locator('[data-id="world-1"]').tap();
  await page.waitForFunction(() => window.__g2.handle.peek().mode === 'play' && window.__g2.handle.peek().chunks >= 30, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/games2-voxel-play.png` });
  await labelled(page, 'voxel', 'playing');
  await sideways(page, 'voxel');
  let s = await peek(page);
  check(!!s.target, `voxel: the cross points at a block in reach (${JSON.stringify(s.target)})`);
  // place a block with a tap where the cross points, then dig it
  await page.locator('.g2slot[data-slot="3"]').tap();
  await page.touchscreen.tap(300, 470);
  await page.waitForTimeout(150);
  s = await peek(page);
  check(s.placed === 1 && s.edits >= 1, `voxel: a tap places a stone block (placed ${s.placed}, edits ${s.edits})`);
  await page.locator('.g2slot[data-slot="0"]').tap();
  await page.touchscreen.tap(300, 470);
  await page.waitForTimeout(150);
  s = await peek(page);
  check(s.dug === 1, `voxel: a tap with DIG digs (dug ${s.dug})`);
  // drag to look, the stick to walk
  const yaw0 = s.yaw;
  await page.mouse.move(300, 420);
  await page.mouse.down();
  await page.mouse.move(220, 420, { steps: 6 });
  await page.mouse.up();
  s = await peek(page);
  check(Math.abs(s.yaw - yaw0) > 0.2, `voxel: a drag on the right turns him (${yaw0.toFixed(2)} → ${s.yaw.toFixed(2)})`);
  const p0 = s.pos;
  await page.mouse.move(90, 660);
  await page.mouse.down();
  await page.mouse.move(90, 600, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  s = await peek(page);
  const walked = Math.hypot(s.pos[0] - p0[0], s.pos[2] - p0[2]);
  check(walked > 0.8, `voxel: the left thumb walks (${walked.toFixed(2)} blocks)`);
  // a controller through the Intent: the left stick walks too
  const p1 = s.pos;
  await page.evaluate(() => (window.__g2.intent.moveY = 1));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window.__g2.intent.moveY = 0));
  s = await peek(page);
  check(Math.hypot(s.pos[0] - p1[0], s.pos[2] - p1[2]) > 0.5, 'voxel: a controller\'s stick (the Intent) walks');
  // BUILD: a word it does not know, then a small stone house
  await page.locator('.g2buildbtn').tap();
  await page.locator('.g2buildin').fill('spaceship');
  await page.locator('.g2buildbox button[type=submit]').tap();
  check(await page.locator('.g2say', { hasText: 'I can build these' }).isVisible(), 'voxel: an unknown word gets "I can build these:" and the list');
  const e0 = (await peek(page)).edits;
  await page.locator('.g2buildin').fill('a small stone house');
  await page.locator('.g2buildbox button[type=submit]').tap();
  check(await page.locator('.g2say', { hasText: 'coming up. Give me a moment.' }).isVisible(), 'voxel: Ghosty says the thing is coming up');
  await page.waitForTimeout(400);
  const mid = await peek(page);
  check(mid.building > 0, `voxel: it goes up block by block (${mid.building} still to place after 0.4 s)`);
  await page.waitForFunction(() => window.__g2.handle.peek().building === 0, null, { timeout: 30000 });
  s = await peek(page);
  check(s.edits - e0 > 40, `voxel: the house is built (${s.edits - e0} blocks changed)`);
  check(await page.locator('.g2say', { hasText: "There's your house" }).isVisible(), 'voxel: and Ghosty says it is done');
  // look up at it (a drag up looks up)
  const pitch0 = (await peek(page)).pitch;
  await page.mouse.move(300, 560);
  await page.mouse.down();
  await page.mouse.move(300, 470, { steps: 5 });
  await page.mouse.up();
  check((await peek(page)).pitch > pitch0 + 0.2, 'voxel: a drag up looks up');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/games2-voxel-build.png` });
  await measure(page, 'voxel');
  // pause: its own button, then the handle's
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused' && (await page.locator('.g2menu .g2title', { hasText: 'PAUSED' }).isVisible()), 'voxel: PAUSE opens the pause menu');
  check(await page.locator('.g2btn', { hasText: 'FLY: OFF' }).isVisible(), 'voxel: FLY is in the pause menu');
  await labelled(page, 'voxel', 'paused');
  await stillThenMoving(page, 'voxel PAUSE', () => page.locator('.g2btn[data-id="resume"]').tap());
  await page.evaluate(() => window.__g2.handle.pause());
  await stillThenMoving(page, 'voxel handle.pause()', () => page.evaluate(() => window.__g2.handle.resume()));
  await page.evaluate(() => window.__g2.handle.setSound(false));
  // quit: the canvas goes, the score is written, the world is saved
  await quitFrees(page, 'voxel');
  const sc = (await scores(page))['block-world'];
  check(sc && sc.last >= 2, `voxel: the score is written (${JSON.stringify(sc)})`);
  await page.reload();
  await page.waitForFunction(() => window.__g2?.ready, null, { timeout: 60000 });
  await page.locator('.g2btn[data-id="play"]').tap();
  const row = await page.locator('[data-id="world-1"]').textContent();
  check(/blocks changed/.test(row) && !/^0 blocks/.test(row.replace(/^.*?(\d)/, '$1')), `voxel: the saved world is there after a reload (${row})`);
  await page.locator('[data-id="world-1"]').tap();
  await page.waitForFunction(() => window.__g2.handle.peek().mode === 'play', null, { timeout: 20000 });
  check((await peek(page)).edits > 40, 'voxel: and every changed block came back with it');
  await page.evaluate(() => window.__g2.handle.quit());
  check(errors.length === 0, `voxel: no page errors or blocked loads${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

// ================================================================ THE RUNNER
{
  const { ctx, page, errors } = await open('runner');
  await page.screenshot({ path: `${out}/games2-runner-title.png` });
  const menu = await page.locator('.g2menu .g2btns button').allTextContents();
  check(JSON.stringify(menu) === JSON.stringify(['PLAY', 'HOW TO PLAY', 'SOUND: ON', 'QUIT']), `runner: PLAY · HOW TO PLAY · SOUND · QUIT (${menu.join(' · ')})`);
  check(await page.locator('.g2menu .g2line', { hasText: 'shadow' }).isVisible(), 'runner: Ghosty\'s line on the title');
  await labelled(page, 'runner', 'title');
  // the first things on the track are 45 m on: the moves are tried first, while the way is clear, and the game is
  // held (the handle's pause) while the slow checks look at it
  await page.locator('.g2btn[data-id="play"]').tap();
  await page.waitForTimeout(400);
  const a = await shotOf(page);
  await page.waitForTimeout(400);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, 'runner: two snapshots of the run differ');
  // swipes change the lane, jump
  await page.mouse.move(200, 520);
  await page.mouse.down();
  await page.mouse.move(110, 520, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__g2.handle.peek().lane === -1, null, { timeout: 1500 }).catch(() => undefined);
  let s = await peek(page);
  check(s.lane === -1, `runner: a swipe left moves a lane left (lane ${s.lane}, ${Math.round(s.d)} m)`);
  await page.mouse.move(150, 520);
  await page.mouse.down();
  await page.mouse.move(250, 520, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__g2.handle.peek().lane === 0, null, { timeout: 1500 }).catch(() => undefined);
  s = await peek(page);
  check(s.lane === 0, `runner: a swipe right moves back (lane ${s.lane})`);
  await page.mouse.move(200, 600);
  await page.mouse.down();
  await page.mouse.move(200, 520, { steps: 3 });
  await page.mouse.up();
  const rose = await page.waitForFunction(() => window.__g2.handle.peek().y > 0.1, null, { timeout: 1500 }).then(() => true, () => false);
  check(rose, 'runner: a swipe up jumps');
  // a controller's d-pad through the Intent
  await page.waitForFunction(() => window.__g2.handle.peek().y === 0, null, { timeout: 3000 }).catch(() => undefined);
  await page.evaluate(() => (window.__g2.intent.moveX = 1));
  await page.waitForFunction(() => window.__g2.handle.peek().lane === 1, null, { timeout: 1500 }).catch(() => undefined);
  await page.evaluate(() => (window.__g2.intent.moveX = 0));
  s = await peek(page);
  check(s.lane === 1, `runner: a controller's d-pad changes lane (lane ${s.lane}, ${Math.round(s.d)} m, ${s.stumbles} stumbles)`);
  await page.evaluate(() => window.__g2.handle.pause());
  await page.screenshot({ path: `${out}/games2-runner-play.png` });
  await labelled(page, 'runner', 'playing');
  await sideways(page, 'runner');
  await page.evaluate(() => window.__g2.handle.resume());
  // pause: its own button, then the handle's
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused', 'runner: PAUSE pauses the run');
  await labelled(page, 'runner', 'paused');
  await stillThenMoving(page, 'runner PAUSE', () => page.locator('.g2btn[data-id="resume"]').tap());
  await page.evaluate(() => window.__g2.handle.pause());
  await stillThenMoving(page, 'runner handle.pause()', () => page.evaluate(() => window.__g2.handle.resume()));
  await measure(page, 'runner', 3000);
  // left alone, he stumbles twice and the shadow catches him
  await page.waitForFunction(() => window.__g2.handle.peek().mode === 'over' && document.querySelector('.g2menu .g2title')?.textContent === 'CAUGHT', null, { timeout: 90000 });
  s = await peek(page);
  await page.screenshot({ path: `${out}/games2-runner-caught.png` });
  const line = await page.locator('.g2menu .g2line').textContent();
  check(s.over && s.stumbles >= 1 && line.length > 10, `runner: caught at ${Math.round(s.d)} m, with Ghosty's line ("${line}")`);
  const sc = (await scores(page)).runner;
  check(sc && sc.last > 0 && sc.best >= sc.last, `runner: the score is written (${JSON.stringify(sc)})`);
  const again = await page.locator('.g2menu .g2btns button').allTextContents();
  check(again[0] === 'RUN AGAIN', `runner: RUN AGAIN after a catch (${again.join(' · ')})`);
  await page.locator('.g2btn[data-id="run-again"]').tap();
  await page.waitForTimeout(400);
  check((await peek(page)).mode === 'play' && (await peek(page)).d < 30, 'runner: RUN AGAIN starts a fresh run');
  await quitFrees(page, 'runner');
  check(errors.length === 0, `runner: no page errors or blocked loads${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${numbers.join('\n')}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nall games2 checks passed');
