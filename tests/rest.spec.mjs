// NEXT ci.u4, SCREENS THAT REST WHEN STILL: the room behind every non-globe screen (engine/backdrop.ts) is drawn about 30 times a
// second while nothing moves it, not at the display's full rate (60 or 120 frames, each with a glow pass), and at once, every frame,
// while the view moves (a pointer here; tilt on a phone). The canvas keeps its last picture between draws, and the room still moves.
// The board games' own rest (draw on change, the gold pulse ten times a second) is proved by games5.
//   BASE=http://localhost:8788 node tests/rest.spec.mjs [outDir]
import { launch } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};

/** The scene's counters over `ms`: frames drawn, frames rested, and the page's own frame count. */
const sample = (page, ms) =>
  page.evaluate((span) => new Promise((done) => {
    const s = window.__ghosty.stats;
    const d0 = s.drawn;
    const r0 = s.rested;
    let frames = 0;
    const t0 = performance.now();
    const f = () => {
      frames++;
      if (performance.now() - t0 < span) requestAnimationFrame(f);
      else done({ drawn: s.drawn - d0, rested: s.rested - r0, frames, secs: (performance.now() - t0) / 1000 });
    };
    requestAnimationFrame(f);
  }), ms);

for (const size of [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
  const tag = `[${size.width}]`;
  // (no touch: the pointer steers the view here, as tilt does on a phone)
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForFunction(() => document.body.dataset.scene === 'backdrop' && !!window.__ghosty?.stats, null, { timeout: 15000 });
  // the view settles where the pointer left it (it eases there over a moment), then the room is still
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.waitForFunction(() => new Promise((ok) => {
    const s = window.__ghosty.stats;
    const r0 = s.rested;
    setTimeout(() => ok(s.rested > r0), 400);
  }), null, { timeout: 15000, polling: 500 }).catch(() => undefined);
  const still = await sample(page, 2500);
  const perSec = still.drawn / still.secs;
  const fps = still.frames / still.secs;
  console.log(`${tag} still: drawn ${still.drawn}, rested ${still.rested}, of ${still.frames} frames in ${still.secs.toFixed(1)} s (${perSec.toFixed(1)} draws a second at ${fps.toFixed(0)} fps)`);
  check(perSec <= 33, `${tag} a still screen draws its room at most about 30 times a second: ${perSec.toFixed(1)}`);
  // (a runner that draws 30 frames a second or fewer has nothing to rest; anything faster rests the frames in between)
  check(fps <= 33 || still.rested > 0, `${tag} the frames in between are rested: ${still.rested} rested at ${fps.toFixed(0)} fps`);
  check(still.drawn >= Math.min(10, still.frames * 0.3), `${tag} the room still moves while it rests (drawn ${still.drawn} times in ${still.secs.toFixed(1)} s)`);
  // the pointer moves the view: every frame is drawn while it eases there
  const moving = page.evaluate(async (w) => {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: (i % 2 ? 0.1 : 0.9) * w, clientY: 200 + i * 5, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: (i % 2 ? 0.1 : 0.9) * w, clientY: 200 + i * 5 }));
    }
  }, size.width);
  const moved = await sample(page, 700);
  await moving;
  const share = moved.drawn / Math.max(1, moved.drawn + moved.rested);
  console.log(`${tag} moving: drawn ${moved.drawn}, rested ${moved.rested}, of ${moved.frames} frames`);
  check(share >= 0.85, `${tag} while the view moves, it is drawn every frame: ${moved.drawn} drawn, ${moved.rested} rested`);
  check(!errors.length, `${tag} no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await page.screenshot({ path: `${out}/rest-${size.width}.png` });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Rest run clean: a still screen draws its room about 30 times a second and rests the frames between, the room still moves, and a moving view is drawn every frame.');
process.exit(problems.length ? 1 : 0);
