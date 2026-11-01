// The arcade's engines (BRIEF-ENGINES) on the harness page (tests/fixtures/engines/harness.html), served on the
// preview's origin under the app's own security policy, at a phone's size held sideways (844 × 390 points, 3 device
// pixels a point), with the real free data fetched once by tests/fixtures/engines/fetch.sh (never committed; without
// it this spec skips with one line). For each engine: start → frames differ → a held stick moves the player and a
// look turns him → pause holds the frame, resume runs on → quit; the fps and the load time are printed.
// DOOM (doomgeneric in WebAssembly): the shareware's E1M1 loads in under ten seconds from unpacked files and runs at
// DOOM's 35 fps; a game saved through DOOM's own menu with the arcade's buttons alone comes back after a quit and a
// fresh start; the title → menu → NEW GAME path takes the buttons alone; Freedoom Phase 1's E1M1–E1M3 each load,
// draw and walk.
// QUAKE (WebQuake): the shareware's e1m1 from memory; walking, turning, looking up, jumping, FIRE's sound; the frame
// rate at the phone's size printed (this machine draws WebGL in software: the engine's own work a frame is what is
// held to a phone's budget); a game saved through Quake's own menu comes back after a quit and a fresh start; from the
// demos, the menu's NEW GAME with the buttons alone.
//   sh tests/fixtures/engines/fetch.sh && BASE=http://localhost:8811 node tests/engines.spec.mjs [outDir]
import { launch, webkitNoise, engine } from './browser.mjs';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] ?? 'tests/.shots';
const base = process.env.BASE ?? 'http://localhost:8788';
const DATA = join(root, 'tests/fixtures/engines/data');
const PACKAGES = ['doom19s.zip', 'freedoom-0.13.0.zip', 'msdos_Quake106_shareware.zip'];
const missing = PACKAGES.filter((f) => !existsSync(join(DATA, f)));
if (missing.length) {
  console.log(`ENGINES spec skipped: the free game data is not here (${missing.join(', ')}). Fetch it once with: sh tests/fixtures/engines/fetch.sh`);
  process.exit(0);
}
mkdirSync(out, { recursive: true });

// The harness's bundle: the engines' own modules (apps/web/src/arcade/engines) with store.ts's unpacking.
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const tmp = join(root, 'tests/.tmp/engines');
mkdirSync(tmp, { recursive: true });
esbuild.buildSync({ entryPoints: [join(root, 'tests/fixtures/engines/harness.ts')], bundle: true, format: 'esm', target: 'es2022', outfile: join(tmp, 'harness.js'), logLevel: 'warning' });
// The app's own security policy, as the preview serves it.
const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
if (!csp) throw new Error(`no security policy from ${base}/ (is the preview running?)`);

const problems = [];
const fail = (what) => problems.push(what);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: engine !== 'webkit' ? true : undefined, hasTouch: true });
await ctx.route(`${base}/__engines/**`, async (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice('/__engines/'.length));
  const files = { 'harness.html': [join(root, 'tests/fixtures/engines/harness.html'), 'text/html'], 'harness.js': [join(tmp, 'harness.js'), 'text/javascript'] };
  for (const p of PACKAGES) files[`data/${p}`] = [join(DATA, p), 'application/zip'];
  const f = files[rel];
  if (!f) return route.fulfill({ status: 404, body: 'not found' });
  await route.fulfill({ status: 200, headers: { 'content-type': f[1], 'content-security-policy': csp }, body: readFileSync(f[0]) });
});
// Each game gets a page of its own, as each gets its own canvas in the player (the headless software GPU slows
// down when one page draws several phone-sized canvases one after another; a page per game keeps the counts honest).
let page = null;
const cspBlocked = [];
async function open() {
  if (page) {
    cspBlocked.push(...(await page.evaluate(() => window.__csp).catch(() => [])));
    await page.close();
  }
  page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || fail(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) fail(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(`${base}/__engines/harness.html`);
  await page.waitForFunction(() => !!window.harness, null, { timeout: 15000 });
}

const wait = (ms) => page.waitForTimeout(ms);
const H = (fn, arg) => page.evaluate(fn, arg);
const probe = () => H(() => window.harness.probe());
const snap = () => H(() => window.harness.snap());
const seen = () => H(() => JSON.parse(JSON.stringify(window.harness.seen)));
const setIntent = (o) => H((x) => Object.assign(window.harness.intent, x), o);
const hold = (actions, ms = 120) => H(([a, m]) => window.harness.hold(a, m), [actions, ms]);
const level = async (name, ms) => {
  await page.waitForFunction((n) => window.harness.probe()?.level === n, name, { timeout: ms }).catch(() => undefined);
  return (await probe())?.level === name;
};
const until = async (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/** Until the engine has drawn `n` more frames (a press is held, and let go, for whole frames: a busy page cannot
 *  make it too short to see). */
const frames = async (n) => {
  const f0 = (await probe()).frames;
  await until(([f, k]) => window.harness.probe().frames >= f + k, [f0, n], 5000);
};
/** The stick pushed one way for a moment (one press in a menu). */
const nudge = async (y, x = 0) => {
  await setIntent({ moveY: y, moveX: x });
  await frames(1); // exactly one frame sees it (the wait polls after the engine's frame): one press, never a repeat
  await setIntent({ moveY: 0, moveX: 0 });
  await frames(5);
};
/** A button pressed and let go (one press). */
const press = async (action) => {
  await H((a) => window.harness.intent.held.add(a), action);
  await frames(3);
  await H((a) => window.harness.intent.held.delete(a), action);
  await frames(5);
};
/** Frames drawn per second, counted over `ms`. */
const fpsOver = async (ms) => {
  const a = await probe();
  await wait(ms);
  const b = await probe();
  return Math.round(((b.frames - a.frames) * 1000) / ms);
};
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);
const turned = (a0, a1) => ((((a0 - a1) % 360) + 540) % 360) - 180; // degrees turned right
const report = [];

/** The common round: the frame rate (counted first, before anything reads the canvas back), a held stick moves the
 *  player, a look turns him, frames differ, pause holds the frame and resume runs on. */
async function round(tag, o) {
  await wait(1000); // past DOOM's screen melt and a level's first moments
  let fps = await fpsOver(3000);
  if (fps < o.fps) fps = Math.max(fps, await fpsOver(3000)); // once more: other work on this machine only ever slows it
  const work = (await probe()).workMs;
  if (fps < o.fps) fail(`${tag}: ${fps} fps (want ${o.fps})`);
  if (o.workMs && !(work <= o.workMs)) fail(`${tag}: the engine's own work takes ${work} ms a frame (want at most ${o.workMs})`);
  const p0 = (await probe()).pos;
  await setIntent({ moveY: 1 });
  await wait(900);
  await setIntent({ moveY: 0 });
  await wait(250);
  const p1 = (await probe()).pos;
  const walked = dist(p0, p1);
  if (!(walked > o.walk)) fail(`${tag}: holding the stick forward for 0.9 s moved the player ${walked.toFixed(1)} units (want > ${o.walk})`);
  const a0 = (await probe()).angle;
  await H(() => (window.harness.intent.lookX += 90));
  await wait(400);
  const a1 = (await probe()).angle;
  const t = turned(a0, a1);
  if (Math.abs(t - 90) > 3) fail(`${tag}: a 90° look turned the player ${t.toFixed(1)}°`);
  const shots = new Set();
  for (let i = 0; i < 5; i++) {
    shots.add(await snap());
    await wait(400);
  }
  if (shots.size < 2) fail(`${tag}: five frames over two seconds were all the same`);
  await H(() => window.harness.pause());
  await wait(150);
  const f0 = (await probe()).frames;
  const s0 = await snap();
  await wait(700);
  const f1 = (await probe()).frames;
  const s1 = await snap();
  if (f1 !== f0 || s0 !== s1) fail(`${tag}: paused, it drew ${f1 - f0} frames${s0 === s1 ? '' : ' and the picture changed'}`);
  if (!(await probe()).paused) fail(`${tag}: the probe does not say paused`);
  await H(() => window.harness.resume());
  await wait(500);
  if (!((await probe()).frames > f1)) fail(`${tag}: resumed, it drew nothing`);
  if (o.shot) writeFileSync(join(out, `engines-${tag}.png`), Buffer.from((await H(() => window.harness.png())).split(',')[1], 'base64'));
  return { walked: Math.round(walked), turned: Math.round(t), fps, work };
}
async function quitClean(tag) {
  await H(() => window.harness.quit());
  const s = await seen();
  if (s.errors.length) fail(`${tag}: the engine said ${s.errors.join(' | ')}`);
}

// ---------------------------------------------------------------- DOOM, the shareware's E1M1
{
  await open();
  const tag = 'doom-e1m1';
  const r = await H(() => window.harness.start('doom-shareware', ['-warp', '1', '1', '-skill', '3'], { sound: true }));
  if (!(await level('E1M1', 15000))) fail(`${tag}: E1M1 never came up (${JSON.stringify(await probe())})`);
  const p = await probe();
  if (!(p.loadMs < 10000)) fail(`${tag}: E1M1 took ${p.loadMs} ms to load (want under 10 s)`);
  const res = await round(tag, { walk: 64, fps: 33, shot: true });
  await hold(['fire'], 400);
  await wait(300);
  const heard = (await probe()).sounds;
  if (!(heard > 0)) fail(`${tag}: FIRE made no sound`);
  report.push(`DOOM shareware E1M1: unpacked ${r.unpackMs} ms, loaded ${p.loadMs} ms, ${res.fps} fps (the engine's own work ${res.work} ms a frame), walked ${res.walked}, turned ${res.turned}°, FIRE played ${heard} sound(s)`);

  // SAVE through DOOM's own menu with the arcade's buttons: pause → (stick down ×3) SAVE GAME → FIRE (slot 1) → FIRE
  // (named for the level) → FIRE (saved); the game goes on.
  const here = (await probe()).pos;
  await press('pause');
  if (!(await until(() => window.harness.probe()?.menu === true, null, 3000))) fail(`${tag}: the pause button did not open DOOM's menu`);
  for (let i = 0; i < 3; i++) await nudge(-1);
  for (let i = 0; i < 3; i++) await press('fire');
  await until(() => window.harness.probe()?.menu === false, null, 3000);
  await wait(400);
  const kept = await H(() => window.harness.saves());
  if (!kept.some((n) => /doomsav0\.dsg$/.test(n))) fail(`${tag}: no saved game kept after SAVE GAME (${kept.join(', ') || 'nothing'})`);
  await setIntent({ moveY: 1 });
  await wait(600);
  await setIntent({ moveY: 0 });
  await quitClean(tag);
  // a fresh start with the same saves: LOAD GAME (stick down ×2) → FIRE → FIRE puts the player back where he saved
  await H(() => window.harness.start('doom-shareware', ['-warp', '1', '1', '-skill', '3'], { keepSaves: true }));
  await level('E1M1', 15000);
  await wait(1500); // past the screen melt
  await press('pause');
  await until(() => window.harness.probe()?.menu === true, null, 3000);
  for (let i = 0; i < 2; i++) await nudge(-1);
  for (let i = 0; i < 2; i++) await press('fire');
  await until(() => window.harness.probe()?.menu === false, null, 3000);
  await wait(800);
  const back = (await probe()).pos;
  if (!(dist(here, back) < 2)) fail(`${tag}: LOAD GAME put the player at ${JSON.stringify(back)}, saved at ${JSON.stringify(here)}`);
  report.push(`DOOM save → quit → start → load: back within ${dist(here, back).toFixed(2)} units of where he saved; kept ${kept.join(', ')}`);
  await quitClean(tag);
}

// ---------------------------------------------------------------- DOOM from its title, with the buttons alone
{
  await open();
  const tag = 'doom-title';
  await H(() => window.harness.start('doom-shareware'));
  await wait(1500);
  if ((await probe()).level !== null) fail(`${tag}: no title screen first`);
  for (let i = 0; i < 5 && (await probe()).level !== 'E1M1'; i++) {
    await press('fire');
    await wait(300);
  }
  if (!(await level('E1M1', 8000))) fail(`${tag}: FIRE from the title did not reach E1M1 through NEW GAME (${JSON.stringify(await probe())})`);
  else report.push('DOOM title → FIRE (menu) → FIRE (NEW GAME) → FIRE (episode) → FIRE (skill) → E1M1');
  await quitClean(tag);
}

// ---------------------------------------------------------------- Freedoom Phase 1, E1M1–E1M3
for (const m of [1, 2, 3]) {
  await open();
  const tag = `freedoom-e1m${m}`;
  const r = await H((mm) => window.harness.start('freedoom', ['-warp', '1', String(mm), '-skill', '3']), m);
  if (!(await level(`E1M${m}`, 15000))) {
    fail(`${tag}: E1M${m} never came up (${JSON.stringify(await probe())}, ${JSON.stringify(await seen())})`);
    await quitClean(tag);
    continue;
  }
  const p = await probe();
  const res = await round(tag, { walk: 32, fps: 33, shot: m === 2 });
  report.push(`Freedoom E1M${m}: unpacked ${r.unpackMs} ms, loaded ${p.loadMs} ms, ${res.fps} fps (work ${res.work} ms), walked ${res.walked}, turned ${res.turned}°`);
  await quitClean(tag);
}

// ---------------------------------------------------------------- QUAKE, the shareware's E1M1
// The frame rate here is the headless browser's software GPU drawing 1688 × 780 pixels (the cap: a pixel ratio of 2),
// not a phone's: it is printed, and what the engine itself spends a frame is held to a phone's budget instead.
{
  await open();
  const tag = 'quake-e1m1';
  const r = await H(() => window.harness.start('quake-shareware', ['+map', 'e1m1'], { sound: true }));
  if (!(await level('e1m1', 30000))) fail(`${tag}: e1m1 never came up (${JSON.stringify(await probe())}, ${JSON.stringify(await seen())})`);
  const p = await probe();
  if (!(p.loadMs < 10000)) fail(`${tag}: e1m1 took ${p.loadMs} ms to load (want under 10 s)`);
  const size = await H(() => [document.getElementById('screen').width, document.getElementById('screen').height]);
  const res = await round(tag, { walk: 64, fps: 0, workMs: 8, shot: true });
  // looking up, a jump, FIRE's sound
  const pitch0 = (await probe()).pitch;
  await H(() => (window.harness.intent.lookY += 30));
  await wait(500);
  const tilted = pitch0 - (await probe()).pitch;
  if (Math.abs(tilted - 30) > 2) fail(`${tag}: a 30° look up tilted the view ${tilted}°`);
  const z0 = (await probe()).pos[2];
  let rose = 0;
  await H(() => window.harness.intent.held.add('jump'));
  for (let i = 0; i < 12; i++) {
    await wait(60);
    rose = Math.max(rose, (await probe()).pos[2] - z0);
  }
  await H(() => window.harness.intent.held.delete('jump'));
  if (!(rose > 16)) fail(`${tag}: JUMP rose ${rose} units`);
  await wait(400);
  const s0 = (await probe()).sounds;
  await press('fire');
  await wait(400);
  const heard = (await probe()).sounds - s0;
  if (!(heard > 0)) fail(`${tag}: FIRE made no sound`);
  report.push(`QUAKE shareware e1m1: unpacked ${r.unpackMs} ms, loaded ${p.loadMs} ms, drawn at ${size.join(' × ')}: ${res.fps} fps on this machine's software GPU, the engine's own work ${res.work} ms a frame; walked ${res.walked}, turned ${res.turned}°, looked up ${Math.round(tilted)}°, jumped ${Math.round(rose)} units, FIRE played ${heard} sound(s)`);

  // SAVE through Quake's own menu with the arcade's buttons: pause → FIRE (SINGLE PLAYER) → stick down ×2 (SAVE) →
  // FIRE → FIRE (the first slot; Quake names a save for its level); the game goes on.
  await wait(1500);
  await press('pause');
  if (!(await until(() => window.harness.probe()?.menu === true, null, 3000))) fail(`${tag}: the pause button did not open Quake's menu`);
  const here = (await probe()).pos; // the world stands still while Quake's menu is open
  await press('fire');
  for (let i = 0; i < 2; i++) await nudge(-1);
  for (let i = 0; i < 2; i++) await press('fire');
  await until(() => window.harness.probe()?.menu === false, null, 3000);
  await wait(500);
  const kept = await H(() => window.harness.saves());
  if (!kept.includes('id1/s0.sav')) fail(`${tag}: no saved game kept after SAVE (${kept.join(', ') || 'nothing'})`);
  await setIntent({ moveY: 1 });
  await wait(700);
  await setIntent({ moveY: 0 });
  await quitClean(tag);
  const keptAfter = await H(() => window.harness.saves());
  if (!keptAfter.includes('id1/config.cfg')) fail(`${tag}: quitting kept no settings (${keptAfter.join(', ')})`);
  // a fresh start with the same saves: pause → FIRE → stick down (LOAD) → FIRE → FIRE puts him back
  await H(() => window.harness.start('quake-shareware', ['+map', 'e1m1'], { keepSaves: true }));
  await level('e1m1', 30000);
  await wait(1000);
  const spawn = (await probe()).pos;
  await press('pause');
  await until(() => window.harness.probe()?.menu === true, null, 3000);
  await press('fire');
  await nudge(-1);
  for (let i = 0; i < 2; i++) await press('fire');
  await until(() => window.harness.probe()?.level === 'e1m1', null, 8000);
  await wait(300);
  const back = (await probe()).pos;
  // A Quake save keeps the player's momentum too (here he was still moving when he saved), so
  // he comes back a little way on from the saved spot: near it, and far from where the level starts him.
  if (!(dist(here, back) < 48 && dist(spawn, back) > 100)) fail(`${tag}: LOAD put the player at ${JSON.stringify(back)}, saved at ${JSON.stringify(here)} (the level starts him at ${JSON.stringify(spawn)})`);
  report.push(`QUAKE save → quit → start → load: back within ${dist(here, back).toFixed(1)} units of where he saved (still moving then), ${dist(spawn, back).toFixed(0)} from the level's start; kept ${keptAfter.join(', ')}`);
  await quitClean(tag);
}

// ---------------------------------------------------------------- QUAKE from its demos, with the buttons alone
{
  await open();
  const tag = 'quake-title';
  await H(() => window.harness.start('quake-shareware'));
  await wait(3000);
  if ((await probe()).level !== null) fail(`${tag}: no demo first`);
  await press('pause');
  if (!(await until(() => window.harness.probe()?.menu === true, null, 3000))) fail(`${tag}: the pause button did not open Quake's menu over the demo`);
  await press('fire');
  await press('fire');
  if (!(await level('start', 30000))) fail(`${tag}: FIRE, FIRE did not start a NEW GAME (${JSON.stringify(await probe())})`);
  else report.push('QUAKE demo → pause (menu) → FIRE (SINGLE PLAYER) → FIRE (NEW GAME) → the start map');
  await quitClean(tag);
}

await open();
if (cspBlocked.length) fail(`security policy blocked: ${cspBlocked.join(' | ')}`);
await browser.close();
console.log(report.join('\n'));
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `ENGINES run clean in ${engine}.`);
process.exit(problems.length ? 1 : 0);
