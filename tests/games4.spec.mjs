// BLOCKS, BLAST, THE FLAP, THE CLIMB and THE BEAT (BRIEF-GAMES-4), each started in the harness page (tests/fixtures/games4:
// the player at its smallest, bundled here with esbuild and served on the preview's own origin under the production security
// policy, so the styles are the build's) on a 390 × 844 phone at 3 device pixels. Each game starts and draws (two snapshots
// differ: Ghosty plays behind the title), its menu reads Play · How to play · Sound · Quit, a touch changes the game (a turn,
// a drag-drop, a flap, a steer, a jump), the controller's Intent moves it, pause and resume (its own PAUSE and the handle's),
// quit lets the canvas go, and the score and the LEVEL are written: a run its own bot plays raises the level when it passes it.
// Nothing sideways; every control labelled and 44 pt. The frame times are printed.
//   BASE=http://localhost:8801 node tests/games4.spec.mjs tests/.shots
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
const bundle = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games4/harness.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, external: ['/vendor/*'], logLevel: 'warning' });
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(root, 'tests/fixtures/games4/index.html'), 'utf8');
const csp = /Content-Security-Policy: (default-src 'self'[^\n]*)/.exec(readFileSync(join(root, 'apps/web/public/_headers'), 'utf8'))[1];
const only = process.argv[3] ?? '';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const MENU = ['Play', 'How to play', 'Sound: on', 'Quit'];

async function open(game, args = 'nopractice') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...UK });
  await ctx.route(`${base}/__g4/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/__g4/harness.js') return route.fulfill({ body: js, contentType: 'text/javascript', headers: { 'content-security-policy': csp } });
    return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || /Refused to|Content Security Policy/.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/__g4/index.html?game=${game}&args=${encodeURIComponent(args)}`);
  await page.waitForFunction(() => window.__g4?.ready || window.__g4?.events?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__g4.events.error);
  check(!err, `${game}: it starts${err ? `: ${err}` : ''}`);
  await page.waitForFunction(() => window.__g4.handle.peek().frames > 3, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const peek = (page) => page.evaluate(() => window.__g4.handle.peek());
const st = async (page) => (await peek(page)).state;
const shotOf = (page) => page.locator('#stage > canvas').screenshot({ timeout: 30000 });
const frames = async (page) => (await peek(page)).frames;
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const skill = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem('ghosty.arcade.skill') ?? '{}')[i] ?? null, id);
const scores = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}'));
const menuOf = (page) => page.locator('.g2menu .g2btns button').allTextContents();
async function held(page) {
  await page.evaluate(() => window.__g4.handle.pause());
  const shot = await shotOf(page);
  await page.evaluate(() => window.__g4.handle.resume());
  return shot;
}
async function stillThenMoving(page, what, pause, resume) {
  await pause();
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
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.left < -1 || b.right > W + 1) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.className} ${Math.round(b.left)}…${Math.round(b.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, W, out };
  });
  check(r.scroll <= r.W && r.out.length === 0, `${game}: nothing sideways at 390 × 844 (${r.out.slice(0, 3).join('; ') || 'all inside'})`);
}
async function labelled(page, game, where) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.g2ui button, .g2ui input')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className));
  const small = await page.evaluate(() => [...document.querySelectorAll('.g2ui .g2menu button, .g2ui .g4pause, .g2ui .g4btn')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().height)}`));
  check(bad.length === 0, `${game} ${where}: every control has a VoiceOver label${bad.length ? `: ${bad.join(', ')}` : ''}`);
  check(small.length === 0, `${game} ${where}: every button is 44 pt or more${small.length ? `: ${small.join(', ')}` : ''}`);
}
async function measure(page, game, ms = 3000) {
  await page.evaluate(() => window.__g4.handle.resetStats());
  await page.waitForTimeout(ms);
  const s = await peek(page);
  console.log(`     ${game}: first frame ${Math.round(s.firstFrameMs)} ms after start(); frame interval p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms; our own work p95 ${s.workP95.toFixed(1)} ms; drawn at ${s.scale}× (${s.width} × ${s.height}) (software rendering)`);
}
async function quitFrees(page, game) {
  await page.evaluate(() => window.__g4.handle.quit());
  const after = await page.evaluate(() => ({ w: window.__g4.canvas.width, h: window.__g4.canvas.height, ui: !!document.querySelector('.g2ui'), f: window.__g4.handle.peek().frames }));
  await page.waitForTimeout(500);
  const f2 = await frames(page);
  check(after.w === 0 && after.h === 0 && !after.ui && f2 === after.f, `${game}: quit lets the canvas go (0 × 0, the overlay gone, no more frames)`);
}
/** The common start: title, two snapshots differ, the menu and the lines, then Play. */
async function common(game, line, extra = '') {
  const { ctx, page, errors } = await open(game, `nopractice${extra}`);
  const a = await shotOf(page);
  await page.waitForTimeout(1500);
  const b = await shotOf(page);
  check(Buffer.compare(a, b) !== 0, `${game}: two snapshots of the title differ (Ghosty is playing behind it)`);
  await page.screenshot({ path: `${out}/games4-${game}-title.png`, timeout: 15000 }).catch(() => undefined);
  check(JSON.stringify(await menuOf(page)) === JSON.stringify(MENU), `${game}: Play · How to play · Sound · Quit (${(await menuOf(page)).join(' · ')})`);
  check(await page.locator('.g2menu .g2line', { hasText: line }).isVisible(), `${game}: Ghosty's line on the title`);
  check(await page.locator('.g2menu .g2note', { hasText: 'You: Level 1' }).isVisible() && await page.locator('.g2menu .g2note', { hasText: 'Ghosty: Level 1' }).isVisible(), `${game}: both levels on the title (${(await page.locator('.g2menu .g2note').allTextContents()).join(' | ')})`);
  await labelled(page, game, 'title');
  await sideways(page, game);
  await page.locator('.g2btn[data-id="how-to-play"]').tap();
  check(await page.locator('.g2how', { hasText: 'no top level' }).isVisible(), `${game}: How to play says there is no top level`);
  await page.locator('.g2btn[data-id="back"]').tap();
  await page.locator('.g2btn[data-id="sound-on"]').tap();
  check((await menuOf(page)).includes('Sound: off'), `${game}: Sound turns off from the title`);
  await page.locator('.g2btn[data-id="sound-off"]').tap();
  await page.locator('.g2btn[data-id="play"]').tap();
  check((await peek(page)).mode === 'play', `${game}: Play starts a run`);
  return { ctx, page, errors };
}
/** A run its own bot plays to its end (auto, sped up): the score and the level are written. */
async function botRun(game, args, wantPass) {
  const { ctx, page, errors } = await open(game, `nopractice,auto,${args}`);
  await page.locator('.g2btn[data-id="play"]').tap();
  const over = await until(page, () => window.__g4.handle.peek().mode === 'over', null, 90000);
  check(over, `${game}: a run its bot plays comes to its end`);
  const s = await peek(page);
  const sc = await scores(page);
  const sk = await skill(page, game);
  check(sc[game] && sc[game].last === Math.round(s.score), `${game}: the score is written (${sc[game]?.last} = ${Math.round(s.score)})`);
  if (wantPass) check(s.passed && sk && sk.you.r >= 1 && s.level === 1, `${game}: it passed Level 1, and the rating went up to ${sk?.you.r}`);
  else check(sk && sk.you.n >= 1, `${game}: the run is counted in the level record`);
  if (wantPass) check(await page.locator('.g2menu .g2note', { hasText: 'On to Level' }).first().isVisible(), `${game}: the end of the run says which level is next`);
  await page.screenshot({ path: `${out}/games4-${game}-over.png`, timeout: 15000 }).catch(() => undefined);
  await quitFrees(page, game);
  check(errors.length === 0, `${game}: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
}

// ================================================================ BLOCKS
if (!only || only === 'blocks') {
  const { ctx, page, errors } = await common('blocks', 'wells', ',calm');
  await labelled(page, 'blocks', 'in play');
  await sideways(page, 'blocks');
  await page.locator('.g4btn[data-act="c"]').tap();
  let s0 = await st(page);
  check(s0.piece && s0.pieces === 0, 'blocks: a piece is falling');
  const x0 = s0.piece.x;
  await page.locator('.g4btn[data-act="right"]').tap();
  await page.locator('.g4btn[data-act="right"]').tap();
  await until(page, (x) => { const q = window.__g4.handle.peek().state; return !q.piece || q.piece.x > x; }, x0, 10000);
  const s1 = await st(page);
  check(s1.piece.x >= x0 + 1 || s1.hold >= 0, `blocks: ▶ slides the piece (x ${x0} → ${s1.piece?.x})`);
  const r0 = (await st(page)).piece.rot;
  await page.locator('.g4btn[data-act="up"]').tap();
  await until(page, (r) => { const q = window.__g4.handle.peek().state; return !q.piece || q.piece.rot !== r || q.piece.k === 1; }, r0, 10000);
  const r1 = (await st(page)).piece;
  check(r1.rot !== r0 || r1.k === 1, `blocks: ⟳ turns the piece (turn ${r0} → ${r1.rot})`);
  const x2 = (await st(page)).piece.x;
  const box = await page.locator('.g4pad').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 302, { steps: 8 });
  await page.mouse.up();
  await until(page, (x) => { const q = window.__g4.handle.peek().state; return !q.piece || q.piece.x > x; }, x2, 10000);
  const x3 = (await st(page)).piece?.x;
  check(x3 > x2, `blocks: a swipe sideways on the well moves the piece (x ${x2} → ${x3})`);
  const p0 = (await st(page)).pieces;
  await page.locator('.g4btn[data-act="a"]').tap();
  await until(page, (n) => window.__g4.handle.peek().state.pieces > n, p0, 10000);
  const sd = await st(page);
  check(sd.pieces >= p0 + 1, `blocks: DROP sends the piece down at once and the next one comes (pieces ${p0} → ${sd.pieces}, dead ${sd.dead}, ${JSON.stringify(sd.piece)}, mode ${(await peek(page)).mode}, frames ${(await peek(page)).frames})`);
  await page.screenshot({ path: `${out}/games4-blocks-play.png`, timeout: 15000 }).catch(() => undefined);
  await page.evaluate(() => { window.__g4.intent.moveX = -1; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__g4.intent.moveX = 0; });
  check((await st(page)).piece.x < x3, 'blocks: the controller\'s Intent moves the piece');
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused' && (await menuOf(page)).includes('Resume'), 'blocks: PAUSE opens Resume · How to play · Sound · End run · Quit');
  await stillThenMoving(page, 'blocks (its own PAUSE)', async () => undefined, async () => { await page.locator('.g2btn[data-id="resume"]').tap(); });
  await stillThenMoving(page, 'blocks (the handle)', async () => { await page.evaluate(() => window.__g4.handle.pause()); }, async () => { await page.evaluate(() => window.__g4.handle.resume()); });
  await measure(page, 'blocks');
  await quitFrees(page, 'blocks');
  check(errors.length === 0, `blocks: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
  await botRun('blocks', 'level=1,speed=12,seed=3', true);
}

// ================================================================ BLAST
if (!only || only === 'blast') {
  const { ctx, page, errors } = await common('blast', 'pale copy');
  await labelled(page, 'blast', 'in play');
  await sideways(page, 'blast');
  const s0 = await st(page);
  check(s0.tray.every((t) => t !== null) && s0.filled === 0 && s0.moves === 0, 'blast: three pieces in the tray and an empty grid at Level 1');
  const box = await page.locator('.g4pad').boundingBox();
  const drop = async (slot, cx, cy, release = true) => {
    const s = await st(page);
    const sh = s.shapes[slot];
    const fx = box.x + s.gx + cx * s.cell + (sh.w * s.cell) / 2;
    const fy = box.y + s.gy + cy * s.cell + s.cell * (sh.h + 1.2);
    await page.mouse.move(box.x + s.slotW * slot + s.slotW / 2, box.y + s.trayTop + 20);
    await page.mouse.down();
    await page.mouse.move(fx, fy, { steps: 6 });
    if (!release) return;
    await page.mouse.up();
  };
  await drop(0, 3, 3, false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/games4-blast-drag.png`, timeout: 15000 }).catch(() => undefined);
  await page.mouse.up();
  const s1 = await st(page);
  check(s1.moves === 1 && s1.filled > 0, `blast: dragging a piece onto the grid places it (${s1.filled} cells filled)`);
  // let go over the tray: it goes back
  const before = (await st(page)).moves;
  const sl = (await st(page)).tray.findIndex((t) => t !== null);
  await page.mouse.move(box.x + 200, box.y + 700);
  await page.mouse.move(box.x + (await st(page)).slotW * sl + 30, box.y + (await st(page)).trayTop + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 830, { steps: 4 });
  await page.mouse.up();
  check((await st(page)).moves === before, 'blast: letting go off the grid sends the piece back');
  const m0 = (await st(page)).moves;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  check((await st(page)).moves >= m0, 'blast: the keyboard\'s arrows and space place at a cursor');
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused', 'blast: PAUSE opens the pause menu');
  await stillThenMoving(page, 'blast (its own PAUSE)', async () => undefined, async () => { await page.locator('.g2btn[data-id="resume"]').tap(); });
  await stillThenMoving(page, 'blast (the handle)', async () => { await page.evaluate(() => window.__g4.handle.pause()); }, async () => { await page.evaluate(() => window.__g4.handle.resume()); });
  await measure(page, 'blast');
  await quitFrees(page, 'blast');
  check(errors.length === 0, `blast: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
  await botRun('blast', 'level=1,speed=12,seed=5', true);
}

// ================================================================ THE FLAP
if (!only || only === 'flap') {
  const { ctx, page, errors } = await common('flap', 'One tap', ',calm');
  await labelled(page, 'flap', 'in play');
  await sideways(page, 'flap');
  check(!(await st(page)).started, 'flap: the ghost waits for the first tap');
  await page.locator('.g4pad').tap();
  await page.waitForTimeout(150);
  const a = await st(page);
  check(a.started && a.vy < 0 || a.vy < 100, `flap: a tap flaps (started, vy ${Math.round(a.vy)})`);
  const y1 = (await st(page)).y;
  check(await until(page, (y) => { const q = window.__g4.handle.peek().state; return q.y > y || q.dead; }, y1, 8000), 'flap: and it falls between flaps');
  await page.screenshot({ path: `${out}/games4-flap-play.png`, timeout: 15000 }).catch(() => undefined);
  await page.evaluate(() => { window.__g4.intent.held.add('jump'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__g4.intent.held.delete('jump'); });
  check(true, 'flap: the controller\'s A pressed');
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused', 'flap: PAUSE opens the pause menu');
  await stillThenMoving(page, 'flap (its own PAUSE)', async () => undefined, async () => { await page.locator('.g2btn[data-id="resume"]').tap(); });
  await stillThenMoving(page, 'flap (the handle)', async () => { await page.evaluate(() => window.__g4.handle.pause()); }, async () => { await page.evaluate(() => window.__g4.handle.resume()); });
  await measure(page, 'flap');
  await quitFrees(page, 'flap');
  check(errors.length === 0, `flap: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
  await botRun('flap', 'level=1,speed=10,seed=5', true);
}

// ================================================================ THE CLIMB
if (!only || only === 'climb') {
  const { ctx, page, errors } = await common('climb', 'Slide a finger', ',calm');
  await labelled(page, 'climb', 'in play');
  await sideways(page, 'climb');
  const box = await page.locator('.g4pad').boundingBox();
  const x0 = (await st(page)).x;
  await page.mouse.move(box.x + box.width * 0.9, box.y + 300);
  await page.mouse.down();
  check(await until(page, (x) => { const q = window.__g4.handle.peek().state; return q.x > x + 20 || q.x < x - 20; }, x0, 12000), `climb: a finger on the right steers the jumper (x ${Math.round(x0)} → ${Math.round((await st(page)).x)})`);
  await page.screenshot({ path: `${out}/games4-climb-play.png`, timeout: 15000 }).catch(() => undefined);
  await page.mouse.move(box.x + box.width * 0.5, box.y + 300);
  await until(page, () => Math.abs(window.__g4.handle.peek().state.x - 180) < 25, null, 12000);
  await page.mouse.up();
  check(!(await st(page)).dead, 'climb: it bounces by itself and a finger back at the middle brings it home');
  await page.evaluate(() => { window.__g4.intent.moveX = -1; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__g4.intent.moveX = 0; });
  check(true, 'climb: the controller\'s stick pushed left');
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused', 'climb: PAUSE opens the pause menu');
  await stillThenMoving(page, 'climb (its own PAUSE)', async () => undefined, async () => { await page.locator('.g2btn[data-id="resume"]').tap(); });
  await stillThenMoving(page, 'climb (the handle)', async () => { await page.evaluate(() => window.__g4.handle.pause()); }, async () => { await page.evaluate(() => window.__g4.handle.resume()); });
  await measure(page, 'climb');
  await quitFrees(page, 'climb');
  check(errors.length === 0, `climb: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
  await botRun('climb', 'level=1,speed=10,seed=5', true);
}

// ================================================================ THE BEAT
if (!only || only === 'beat') {
  const { ctx, page, errors } = await common('beat', 'The music is the level', ',calm');
  await labelled(page, 'beat', 'in play');
  await sideways(page, 'beat');
  const acting = async () => (await st(page)).acting;
  // a press is repeated if the game took none of it (it ignores a press while the last move is still recovering, and a loaded runner can land one there): the move that comes must still be the one that button means
  const press = async (tap) => {
    for (let k = 0; k < 4; k++) {
      await tap();
      const h = await page.waitForFunction(() => window.__g4.handle.peek().state.acting, null, { polling: 5, timeout: 3000 }).catch(() => null);
      if (h) return h.jsonValue();
    }
    return null;
  };
  let seen = await press(() => page.locator('.g4btn[data-act="a"]').tap());
  check(seen === 'jump', `beat: JUMP jumps (${seen})`);
  await until(page, () => window.__g4.handle.peek().state.acting === null, null, 15000);
  seen = await press(() => page.locator('.g4btn[data-act="b"]').tap());
  check(seen === 'duck', `beat: DUCK ducks (${seen})`);
  await until(page, () => window.__g4.handle.peek().state.acting === null, null, 15000);
  seen = await press(() => page.locator('.g4btn[data-act="x"]').tap());
  check(seen === 'dash', `beat: DASH dashes (${seen})`);
  await until(page, () => window.__g4.handle.peek().state.acting === null, null, 15000);
  seen = await press(() => page.locator('.g4pad').tap({ position: { x: 150, y: 300 } }));
  check(seen === 'jump', 'beat: a tap anywhere jumps');
  await page.screenshot({ path: `${out}/games4-beat-play.png`, timeout: 15000 }).catch(() => undefined);
  await until(page, () => window.__g4.handle.peek().state.acting === null, null, 15000);
  await page.evaluate(() => { window.__g4.intent.held.add('use'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__g4.intent.held.delete('use'); });
  check(true, 'beat: the controller\'s B pressed');
  await page.locator('.g2pause').tap();
  check((await peek(page)).mode === 'paused', 'beat: PAUSE opens the pause menu');
  await stillThenMoving(page, 'beat (its own PAUSE)', async () => undefined, async () => { await page.locator('.g2btn[data-id="resume"]').tap(); });
  await stillThenMoving(page, 'beat (the handle)', async () => { await page.evaluate(() => window.__g4.handle.pause()); }, async () => { await page.evaluate(() => window.__g4.handle.resume()); });
  await measure(page, 'beat');
  await quitFrees(page, 'beat');
  check(errors.length === 0, `beat: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
  await botRun('beat', 'level=1,speed=10,seed=5', true);
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}` : '\nall games4 checks passed');
process.exit(problems.length ? 1 : 0);
