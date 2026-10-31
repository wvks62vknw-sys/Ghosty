// THE WIND TUNNEL on the owner's phone (440 × 956; OWNER-ISSUES 61b, "the wind tunnel on his phone"): a 2-D lattice flow
// in the shared worker, drawn on the Workbench's first section. Software rendering is slow, so nothing here asserts a frame
// rate: it waits on the tunnel's own signals (window.__ghosty.tunnel: ready, steps, shapeSeq, messages), never on frames.
//  1. #workbench?tunnel opens it and the card shows numbers within 10 s of opening (the time printed): no NaN, the picture
//     drawn, the standing label FIRST ESTIMATE · NOT CERTIFIED — a 2-D, low-Reynolds lattice flow; a real wing is 3-D and
//     turbulent; it holds the phone's heavy mode while it runs;
//  2. PAUSE stops the step counter, RESUME carries it on;
//  3. switching to the circle changes Cd;
//  4. DRAW with three synthetic touches makes a mask ("your shape") and the card updates;
//  5. nothing scrolls sideways and its controls are 44 pt or more;
//  6. leaving the tab stops the loop: no worker messages after 2 s, heavy mode let go.
// It changes only this browser's own storage.
//   BASE=http://localhost:8788 node tests/tunnel.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const t0 = Date.now();

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await page.waitForFunction(() => !!window.__ghosty, null, { timeout: 15000 });
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const T = () => page.evaluate(() => ({ ...window.__ghosty.tunnel }));
const cardText = () => page.evaluate(() => (document.querySelector('#pg-workbench .pn.wb-tunnel .wbcard')?.innerText ?? '').replace(/\s+/g, ' ').trim());

// ---- 1. open it: numbers within 10 s
const opened = Date.now();
await page.evaluate(() => (location.hash = 'workbench?tunnel'));
const ready = await until(() => window.__ghosty.tunnel?.ready === true, null, 10000, 'the tunnel showed no numbers within 10 s of opening');
const firstMs = Date.now() - opened;
console.log(`(the first numbers ${firstMs} ms after opening; the tunnel's own count: ${(await T()).firstMs} ms)`);
let t = await T();
check(ready && t.running && t.steps > 0, `not running: ${JSON.stringify(t)}`);
check(await page.evaluate(() => document.querySelector('#pg-workbench .secpills')?.dataset.current === 'tunnel'), 'the wind tunnel section is not the one shown');
check(Number.isFinite(t.cd) && Number.isFinite(t.cl) && Number.isFinite(t.re) && t.re > 10 && !t.nan, `numbers: cd ${t.cd} cl ${t.cl} re ${t.re} nan ${t.nan}`);
let text = await cardText();
check(/FIRST ESTIMATE · NOT CERTIFIED/.test(text) && /a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent/.test(text), `the label: "${text.slice(0, 160)}"`);
check(!/NaN/.test(text), `NaN on the card: "${text}"`);
check(/Lift coefficient Cl \S+/.test(text) && /Drag coefficient Cd \S+/.test(text) && /Reynolds number/.test(text) && /Lift, scaled/.test(text), `the card's lines: "${text}"`);
check(t.heavy === true, 'it does not hold heavy mode while it runs');
// the picture is drawn (many colours, not one flat fill)
const colours = await page.evaluate(() => {
  const c = document.querySelector('#pg-workbench .tuncanvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 37) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
  return seen.size;
});
check(colours >= 6, `the picture has ${colours} colours`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/tunnel-naca.png` });

// ---- 2. PAUSE stops the counter, RESUME carries on
await page.click('#pg-workbench .tunpause');
await until(() => window.__ghosty.tunnel.paused === true, null, 5000, 'PAUSE did not pause');
await page.waitForTimeout(300);
const s1 = (await T()).steps;
await page.waitForTimeout(1200);
const s2 = (await T()).steps;
check(s1 === s2, `paused, the steps still moved: ${s1} → ${s2}`);
check((await T()).heavy === false, 'paused, it still holds heavy mode');
await page.click('#pg-workbench .tunpause');
await until((s) => window.__ghosty.tunnel.steps > s + 20, s2, 10000, 'RESUME did not carry on');

// ---- 3. the circle changes Cd
const settle = async (seq) => {
  await until((q) => window.__ghosty.tunnel.shapeSeq > q, seq, 8000, 'the new shape never reached the worker');
  const from = (await T()).steps;
  await until((s) => window.__ghosty.tunnel.steps > s + 400, from, 30000, 'the flow did not run 400 steps on the new shape');
  return T();
};
const aero = await T();
await page.selectOption('#tun-shape', 'circle');
const circ = await settle(aero.shapeSeq);
check(/circle/.test(circ.shapeName) && Number.isFinite(circ.cd), `the circle: ${JSON.stringify({ name: circ.shapeName, cd: circ.cd })}`);
check(Math.abs(circ.cd - aero.cd) > 0.2, `the circle's Cd ${circ.cd} is the aerofoil's ${aero.cd}`);
check(Math.abs(circ.cl) < 0.2, `a circle in a symmetric tunnel has lift ${circ.cl}`);
await page.screenshot({ path: `${out}/tunnel-circle.png` });

// ---- 4. DRAW: three synthetic touches make a shape
await page.click('#pg-workbench .tundrawbtn');
await until(() => window.__ghosty.tunnel.drawing === true, null, 3000, 'DRAW did not start drawing');
// (DRAW sits below the controls: bring the tunnel itself back into view before touching it)
await page.$eval('#pg-workbench .tuncanvas', (c) => c.scrollIntoView({ block: 'center', behavior: 'instant' }));
await page.waitForTimeout(300);
const box = await page.$eval('#pg-workbench .tuncanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const before = await T();
for (const [fx, fy] of [[0.24, 0.3], [0.46, 0.5], [0.24, 0.7]]) {
  await page.touchscreen.tap(box.x + box.w * fx, box.y + box.h * fy);
  await page.waitForTimeout(150);
}
check((await T()).points === 3, `three touches made ${(await T()).points} points`);
const drawn = await settle(before.shapeSeq);
check(drawn.shapeName === 'your shape' && drawn.cells > 100, `the drawn shape: ${JSON.stringify({ name: drawn.shapeName, cells: drawn.cells })}`);
check(Number.isFinite(drawn.cd) && drawn.cd !== circ.cd, `the card did not update for the drawn shape: cd ${drawn.cd}`);
text = await cardText();
check(/Wind tunnel: your shape/.test(text), `the card's title: "${text.slice(0, 120)}"`);
await page.screenshot({ path: `${out}/tunnel-drawn.png` });
await page.click('#pg-workbench .tundrawbtn');

// ---- 5. nothing sideways, 44 pt
const geo = await page.evaluate(() => {
  const vis = (e) => e.getClientRects().length > 0 && !e.closest('[hidden]');
  const rows = [...document.querySelectorAll('#pg-workbench .pn.wb-tunnel :is(.wbf, .wbline, .wblabel, .wbmodes button, .tunbtns button)')].filter(vis);
  return {
    wide: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#pg-workbench .pn.wb-tunnel *')].filter(vis).some((e) => e.getBoundingClientRect().right > innerWidth + 1),
    short: rows.map((r) => ({ c: r.className || r.tagName, h: r.getBoundingClientRect().height })).filter((r) => r.h < 43.5),
  };
});
check(!geo.wide, 'the tunnel sticks out sideways');
check(!geo.short.length, `tunnel rows under 44 pt: ${JSON.stringify(geo.short.slice(0, 4))}`);

// ---- 6. leaving the tab stops the loop
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(400);
const m1 = (await T()).messages;
await page.waitForTimeout(2000);
t = await T();
check(t.messages === m1, `worker messages after leaving: ${m1} → ${t.messages}`);
check(!t.running && !t.heavy, `after leaving: running ${t.running}, heavy ${t.heavy}`);
// back on the tab, it starts again
await page.evaluate(() => (location.hash = 'workbench?tunnel'));
await until((m) => window.__ghosty.tunnel.running && window.__ghosty.tunnel.messages > m, t.messages, 10000, 'coming back did not start it again');
await page.evaluate(() => (location.hash = 'core'));

await browser.close();
console.log(`(tunnel spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Tunnel run clean: numbers ${firstMs} ms after opening with no NaN and the label, PAUSE and RESUME, the circle's Cd, three touches drew a shape, nothing sideways, leaving stopped the worker.`);
