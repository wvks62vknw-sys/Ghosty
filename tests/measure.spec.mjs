// Lens MEASURE on an iPhone 13. A photo of a wall with a bank card held flat on it (drawn here:
// the wall 2.00 × 2.70 m, the card 85.6 × 54 mm, at 0.42 px per mm) is picked; the card's four
// corners are tapped (the scale), then the wall's four corners (WALL: width × height) and two
// points 1 m apart (LENGTH); the values show in cm and ft/in with a confidence; UNDO takes the
// last one back; SAVE → PLANNER opens the SPACE PLANNER with the wall's width as the room's.
// Also: the DOOR and DISTANCE references, nothing sticks out sideways, the security policy
// blocks nothing.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const ms = () => page.evaluate(() => {
  const s = window.__ghosty?.measure;
  return s ? JSON.parse(JSON.stringify({ ...s, at: undefined })) : null;
});
const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
/** A tap on the picture at its own pixel (x, y). */
const tapAt = async (x, y) => {
  // On a phone the Lens scrolls as one page: bring the picture back into view first, as a person would.
  await page.evaluate(() => document.querySelector('#pg-lens .lensview').scrollIntoView({ block: 'nearest' }));
  const p = await page.evaluate(([x, y]) => window.__ghosty.measure.at(x, y), [x, y]);
  if (!p) return void problems.push(`no place on screen for picture point ${x},${y}`);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(60);
};

// ---- the Lens in MEASURE mode (the tile is there) ----
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'measure' }));
await page.waitForTimeout(800);
const tile = page.locator('#pg-lens .lensmodes button', { hasText: 'MEASURE' });
if (!(await tile.count())) problems.push('no MEASURE tile in the Lens');
await tile.click();
await until(() => window.__ghosty?.lens?.mode === 'measure' && !!window.__ghosty?.measure, 10000, 'MEASURE did not open');

// ---- the photo: a wall 2000 × 2700 mm with a bank card on it, 0.42 px per mm, portrait 900 × 1200 ----
const K = 0.42;
const WALL = { x: 30, y: 40, w: 2000 * K, h: 2700 * K };
const CARD = { x: 400, y: 600, w: 85.6 * K, h: 54 * K };
const photo = await page.evaluate(async ([WALL, CARD]) => {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1200;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2622';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#d9d2c4';
  g.fillRect(WALL.x, WALL.y, WALL.w, WALL.h);
  g.fillStyle = '#1d4fa8';
  g.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  g.fillStyle = '#e8c35a';
  g.fillRect(CARD.x + 4, CARD.y + 7, 6, 5);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}, [WALL, CARD]);
await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
await until(() => !!window.__ghosty?.measure?.frame, 10000, 'the picked photo was not taken in');
const frame = (await ms())?.frame;
// the photo is shown whole: padded to the viewfinder's shape, never cropped
const pad = frame ? { x: (frame.w - 900) / 2, y: (frame.h - 1200) / 2 } : { x: 0, y: 0 };
if (frame && (frame.w < 900 || frame.h < 1200)) problems.push(`the photo was cropped: ${JSON.stringify(frame)}`);
const P = (x, y) => [x + pad.x, y + pad.y];

// ---- the scale: the card's four corners, tapped out of order ----
for (const [x, y] of [[CARD.x + CARD.w, CARD.y + CARD.h], [CARD.x, CARD.y], [CARD.x + CARD.w, CARD.y], [CARD.x, CARD.y + CARD.h]]) await tapAt(...P(x, y));
await until(() => window.__ghosty.measure.calibrated === true, 5000, `the card did not set the scale: ${JSON.stringify(await ms())}`);

// ---- WALL: four corners → width × height ----
await page.locator('#pg-lens button', { hasText: 'WALL · 4 CORNERS' }).click();
for (const [x, y] of [[WALL.x, WALL.y], [WALL.x + WALL.w, WALL.y], [WALL.x + WALL.w, WALL.y + WALL.h], [WALL.x, WALL.y + WALL.h]]) await tapAt(...P(x, y));
await until(() => window.__ghosty.measure.results.length === 1, 5000, 'the wall was not measured');
let st = await ms();
const wall = st?.results[0];
// a tap lands on a whole screen pixel (≈ 2.4 picture px ≈ 6 mm here): within 1.5 %
if (!wall || wall.kind !== 'rect' || Math.abs(wall.w - 2000) > 30 || Math.abs(wall.h - 2700) > 40) problems.push(`the wall measured ${JSON.stringify(wall)} (want 2000 × 2700 mm)`);
const rowText = (await page.locator('#pg-lens .measrow').first().textContent().catch(() => '')) ?? '';
if (!/cm × .*cm/.test(rowText) || !/ft .* in/.test(rowText)) problems.push(`the result row reads "${rowText}" (want cm and ft/in)`);
if (!/ROUGH|FAIR|GOOD/.test(rowText)) problems.push(`no confidence on the result: "${rowText}"`);
await page.screenshot({ path: `${out}/measure-wall.png` });

// ---- LENGTH: two points 1 m apart ----
await page.locator('#pg-lens button', { hasText: 'LENGTH · 2 TAPS' }).click();
await tapAt(...P(WALL.x + 200 * K, WALL.y + 1500 * K));
await tapAt(...P(WALL.x + 1200 * K, WALL.y + 1500 * K));
await until(() => window.__ghosty.measure.results.length === 2, 5000, 'the length was not measured');
st = await ms();
if (Math.abs((st?.results[1]?.w ?? 0) - 1000) > 20) problems.push(`1 m measured as ${st?.results[1]?.w} mm`);

// ---- UNDO takes the length back ----
await page.locator('#pg-lens button', { hasText: 'UNDO' }).click();
st = await ms();
if (st?.results.length !== 1) problems.push(`UNDO left ${st?.results.length} results`);

// ---- the layout on a phone ----
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('MEASURE is wider than the phone screen');

// ---- DOOR: the scale from a door's top and bottom (the wall's height as the "door" here: 2700 mm) ----
await page.locator('#pg-lens .measrefs button', { hasText: 'DOOR' }).click();
await page.fill('#pg-lens .measin input', '270');
await tapAt(...P(WALL.x + 100, WALL.y));
await tapAt(...P(WALL.x + 100, WALL.y + WALL.h));
await until(() => window.__ghosty.measure.calibrated === true && window.__ghosty.measure.ref === 'door', 5000, 'the door did not set the scale');
await tapAt(...P(WALL.x, WALL.y + 300));
await tapAt(...P(WALL.x + WALL.w, WALL.y + 300));
await until(() => window.__ghosty.measure.results.length === 2, 5000, 'nothing measured with the door scale');
st = await ms();
if (Math.abs((st?.results[1]?.w ?? 0) - 2000) > 30 || st?.results[1]?.confidence !== 'fair') problems.push(`with the door: ${JSON.stringify(st?.results[1])}`);

// ---- DISTANCE: typed, the 69° camera ----
await page.locator('#pg-lens .measrefs button', { hasText: 'DISTANCE' }).click();
await page.fill('#pg-lens .measin input[placeholder]', '2.5');
await page.locator('#pg-lens .measin button', { hasText: 'SET' }).click();
await until(() => window.__ghosty.measure.calibrated === true && window.__ghosty.measure.ref === 'distance', 5000, 'the distance did not set the scale');
// the field is in metres: a far wall typed as "12" is 12 m (1200 cm), not 12 cm
await page.fill('#pg-lens .measin input[placeholder]', '12');
await page.locator('#pg-lens .measin button', { hasText: 'SET' }).click();
await until(() => window.__ghosty.measure.status.includes('1200 cm'), 5000, 'a typed 12 (metres) was not read as 12 m');
await page.fill('#pg-lens .measin input[placeholder]', '2.5');
await page.locator('#pg-lens .measin button', { hasText: 'SET' }).click();
await until(() => window.__ghosty.measure.status.includes('250 cm'), 5000, 'the 2.5 m distance did not set the scale again');
await page.locator('#pg-lens button', { hasText: 'UNDO' }).click(); // the door's length goes; the wall stays
st = await ms();
if (st?.results.length !== 1) problems.push(`after the second UNDO: ${st?.results.length} results`);
await page.screenshot({ path: `${out}/measure-distance.png` });

// ---- SAVE → the SPACE PLANNER, the wall's width now the room's ----
await page.locator('#pg-lens button', { hasText: 'SAVE → PLANNER' }).click();
await until(() => window.__ghosty?.ui?.get?.().tab === 'space' || location.hash.includes('space'), 8000, 'SAVE did not open the planner');
await until(() => window.__ghosty?.space?.room?.w === 200, 8000, `the planner's room is ${JSON.stringify(await page.evaluate(() => window.__ghosty?.space?.room))} (want 200 wide)`);
if (!(await page.locator('#pg-space .spacemeas', { hasText: 'wall' }).count())) problems.push('the planner does not list the saved wall');
if (!(await page.locator('#pg-space .spacecanvas').isVisible())) problems.push('the planner shows no plan');
await page.screenshot({ path: `${out}/measure-planner.png` });

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'MEASURE run clean on an iPhone 13: a picked photo was shown whole, a bank card set the scale, a 2.00 × 2.70 m wall and a 1 m length measured within 1.5 % with cm, ft/in and a confidence, UNDO worked, a door and a typed distance set the scale too, and SAVE opened the SPACE PLANNER with the wall as the room\'s width.');
process.exit(problems.length ? 1 : 0);
