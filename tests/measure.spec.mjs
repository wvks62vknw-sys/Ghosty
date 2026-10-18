// Lens MEASURE on an iPhone 13. First AUTO, the default, with no settings: a photo with an iPhone
// 13's EXIF (drawn here: a room, a cabinet, a sheet of paper on the floor) is picked; the camera is
// read from the photo, the on-phone depth model runs (the real model from /vendor/depth, in its
// worker), the main thing is measured by itself with a likely range and the cues named, a THING tap
// and a LENGTH add more, UNDO takes one back, and nothing is fetched from anywhere but this site.
// Then the overrides: a photo of a wall with a bank card held flat on it (drawn here:
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
// ---- AUTO: a photo with an iPhone 13's EXIF, no settings ----
const offsite = [];
page.on('request', (r) => {
  const u = r.url();
  // (the app's own web fonts are not AUTO's doing)
  if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !/fonts\.(gstatic|googleapis)\.com/.test(u)) offsite.push(u);
});
const st0 = await ms();
if (st0?.ref !== 'auto' || st0?.tool !== 'thing') problems.push(`MEASURE does not start in AUTO with THING: ${st0?.ref} ${st0?.tool}`);
const roomJpeg = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1200;
  const g = c.getContext('2d');
  // the far wall, the floor in perspective (boards converging), a cabinet, a sheet of paper on the floor
  const wall = g.createLinearGradient(0, 0, 0, 640);
  wall.addColorStop(0, '#cfc7b8');
  wall.addColorStop(1, '#b9b09f');
  g.fillStyle = wall;
  g.fillRect(0, 0, 900, 640);
  const floor = g.createLinearGradient(0, 640, 0, 1200);
  floor.addColorStop(0, '#7a5a3a');
  floor.addColorStop(1, '#4a3320');
  g.fillStyle = floor;
  g.fillRect(0, 640, 900, 560);
  g.strokeStyle = 'rgba(30,20,10,.5)';
  for (let k = -12; k <= 12; k++) {
    g.beginPath();
    g.moveTo(450 + k * 40, 640);
    g.lineTo(450 + k * 160, 1200);
    g.stroke();
  }
  g.fillStyle = '#6b6f78';
  g.fillRect(300, 380, 300, 330);
  g.fillStyle = '#8a8f99';
  g.beginPath();
  g.moveTo(300, 380);
  g.lineTo(600, 380);
  g.lineTo(570, 350);
  g.lineTo(330, 350);
  g.closePath();
  g.fill();
  g.fillStyle = '#2d3036';
  g.fillRect(440, 420, 20, 60);
  g.fillStyle = '#f4f4f0';
  g.beginPath();
  g.moveTo(150, 900);
  g.lineTo(330, 905);
  g.lineTo(350, 1050);
  g.lineTo(120, 1040);
  g.closePath();
  g.fill();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
/** An APP1 EXIF block like an iPhone 13's main camera writes (Make, Model, FocalLength 5.1, FocalLengthIn35mmFilm 26). */
const exifApp1 = () => {
  const bytes = [];
  const u16 = (v) => bytes.push(v & 255, v >> 8);
  const u32 = (v) => bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24);
  const str = (t) => [...t].map((ch) => ch.charCodeAt(0));
  const make = [...str('Apple'), 0];
  const model = [...str('iPhone 13'), 0];
  const exifIfd = 8 + 2 + 3 * 12 + 4;
  const makeAt = exifIfd + 2 + 2 * 12 + 4;
  const modelAt = makeAt + make.length;
  const ratAt = modelAt + model.length;
  bytes.push(...str('II'));
  u16(42);
  u32(8);
  u16(3);
  u16(0x010f), u16(2), u32(make.length), u32(makeAt);
  u16(0x0110), u16(2), u32(model.length), u32(modelAt);
  u16(0x8769), u16(4), u32(1), u32(exifIfd);
  u32(0);
  u16(2);
  u16(0x920a), u16(5), u32(1), u32(ratAt);
  u16(0xa405), u16(3), u32(1), bytes.push(26, 0, 0, 0);
  u32(0);
  bytes.push(...make, ...model);
  u32(51);
  u32(10);
  const body = [...str('Exif'), 0, 0, ...bytes];
  return Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255, ...body]);
};
const jpg = Buffer.from(roomJpeg, 'base64');
const withExif = Buffer.concat([jpg.subarray(0, 2), exifApp1(), jpg.subarray(2)]);
await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'room.jpg', mimeType: 'image/jpeg', buffer: withExif });
await until(() => ['loading', 'working'].includes(window.__ghosty?.measure?.auto?.state), 15000, 'AUTO did not start on the picked photo');
const t0 = Date.now();
await until(() => window.__ghosty?.measure?.auto?.state === 'ready' || window.__ghosty?.measure?.auto?.state === 'failed', 240000, `AUTO did not finish: ${JSON.stringify((await ms())?.auto)}`);
const autoSecs = ((Date.now() - t0) / 1000).toFixed(1);
let sa = await ms();
if (sa?.auto?.state !== 'ready') problems.push(`AUTO failed: ${sa?.auto?.error}`);
if (!/Apple iPhone 13, 26 mm lens \(from the photo\)/.test(sa?.auto?.camera ?? '')) problems.push(`the camera was not read from the EXIF: "${sa?.auto?.camera}"`);
const main = sa?.results?.[0];
if (!main || main.kind !== 'object' || !(main.w > 0) || !(main.h > 0) || !(main.range > 0)) problems.push(`the main thing was not measured by itself: ${JSON.stringify(main)}`);
const autoNote = (await page.locator('#pg-lens .measauto').textContent().catch(() => '')) ?? '';
if (!/depth from the photo/.test(autoNote) || !/camera: Apple iPhone 13/.test(autoNote)) problems.push(`the cues line reads "${autoNote}"`);
const autoRow = (await page.locator('#pg-lens .measrow').first().textContent().catch(() => '')) ?? '';
if (!/W × H/.test(autoRow) || !/±\d+ %/.test(autoRow) || !/likely/.test(autoRow) || !/ft/.test(autoRow)) problems.push(`the AUTO result row reads "${autoRow}"`);
await page.screenshot({ path: `${out}/measure-auto.png` });
// THING: one tap on the sheet of paper; LENGTH: two taps along the floor
const padA = sa?.frame ? { x: (sa.frame.w - 900) / 2, y: (sa.frame.h - 1200) / 2 } : { x: 0, y: 0 };
await tapAt(235 + padA.x, 975 + padA.y);
await until(() => window.__ghosty.measure.results.length === 2, 5000, 'a THING tap measured nothing');
await page.locator('#pg-lens button', { hasText: 'LENGTH · 2 TAPS' }).click();
await tapAt(200 + padA.x, 1100 + padA.y);
await tapAt(700 + padA.x, 1100 + padA.y);
await until(() => window.__ghosty.measure.results.length === 3, 5000, 'an AUTO length was not measured');
sa = await ms();
if (sa?.results?.[2]?.kind !== 'length' || !(sa.results[2].w > 100) || !(sa.results[2].range > 0)) problems.push(`the AUTO length: ${JSON.stringify(sa?.results?.[2])}`);
await page.locator('#pg-lens button', { hasText: 'UNDO' }).click();
if ((await ms())?.results.length !== 2) problems.push('UNDO did not take the AUTO length back');
console.log(`AUTO: ready in ${autoSecs} s (model ${sa?.auto?.ms} ms); main thing ${main?.text} (±${Math.round((Math.exp(main?.range ?? 0) - 1) * 100)} %, ${main?.confidence}); cues ${JSON.stringify(sa?.auto?.cues)} ignored ${JSON.stringify(sa?.auto?.ignored)}; sheet tap ${sa?.results?.[1]?.text}`);
if (offsite.length) problems.push(`AUTO fetched from off the site: ${offsite.slice(0, 3).join(' ')}`);
await page.locator('#pg-lens button', { hasText: 'CLEAR' }).click();

// ---- the overrides: a picked photo of a wall, the scale from a bank card ----
await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
await page.locator('#pg-lens .measrefs button', { hasText: 'BANK CARD' }).click();
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
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'MEASURE run clean on an iPhone 13: AUTO read the camera from the EXIF, ran the depth model on the phone and measured the main thing with a likely range, a THING and a LENGTH added, UNDO, nothing fetched off the site; a picked photo was shown whole, a bank card set the scale, a 2.00 × 2.70 m wall and a 1 m length measured within 1.5 % with cm, ft/in and a confidence, UNDO worked, a door and a typed distance set the scale too, and SAVE opened the SPACE PLANNER with the wall as the room\'s width.');
process.exit(problems.length ? 1 : 0);
