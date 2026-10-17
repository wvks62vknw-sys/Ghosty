// The SPACE PLANNER on an iPhone 13. From the chat ("open the space planner 420 by 360": the
// brain's open_space) the planner opens with that room; a piece is dragged with a finger and
// snaps to the wall; one dragged too close to another shows a walkway gap under 70 cm; a piece
// is added from the catalogue and turned; WILL IT FIT? answers yes / no; MAKE SPACE offers up to
// three layouts with more open floor, one is tried and UNDO puts things back; EXPORT gives a real
// PNG and a JSON plan, and IMPORT reads a plan back. Nothing sticks out sideways; the security
// policy blocks nothing.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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

const sp = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.space ?? null)));
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const byId = (s, id) => s?.items.find((i) => i.id === id);

// ---- from the chat: the brain opens the planner with the room's size ----
await page.click('.logbtn');
await page.fill('#cin', 'open the space planner 420 by 360');
await page.keyboard.press('Enter');
await until(() => window.__ghosty?.ui?.get?.().tab === 'space', 15000, 'the brain\'s open_space did not open the planner');
await until(() => window.__ghosty?.space?.room?.w === 420 && window.__ghosty?.space?.room?.d === 360, 8000, `the room is ${JSON.stringify((await sp())?.room)} (want 420 × 360)`);
// the chat log is an overlay on phones: close it to reach the planner
if (await page.locator('.logbtn').isVisible()) {
  const covered = await page.evaluate(() => {
    const c = document.querySelector('#pg-space .spacecanvas');
    if (!c) return true;
    const r = c.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return !c.contains(el) && el !== c;
  });
  if (covered) await page.click('.logbtn');
}
await page.waitForTimeout(400);
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
let s = await sp();
if (!s || s.items.length !== 3) problems.push(`the planner starts with ${s?.items.length} pieces (want the 3 of the sample room)`);

/** Canvas pixels for a point in room centimetres. */
const at = async (xcm, ycm) => {
  const box = await page.locator('#pg-space .spacecanvas').boundingBox();
  const room = (await sp()).room;
  const k = (box.width - 44) / room.w;
  return { x: box.x + 22 + xcm * k, y: box.y + 22 + ycm * k };
};
const drag = async (from, to) => {
  const a = await at(...from);
  const b = await at(...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(150);
};

// ---- drag the armchair (85 × 85 at the left wall, y 140) across: it snaps flush to the right wall ----
await drag([42, 182], [372, 182]);
s = await sp();
const chair = byId(s, 'chair');
if (!chair || chair.x !== 335) problems.push(`the armchair rests at x=${chair?.x} (want 335: flush with the right wall)`);
if (s.selected !== 'chair') problems.push(`the dragged piece is not the chosen one (${s.selected})`);

// ---- drag the TV unit up close to the sofa: a walkway gap under 70 cm shows ----
const tv = byId(s, 'tv');
await drag([tv.x + 75, tv.y + 20], [tv.x + 75, 170]);
s = await sp();
const gap = s.gaps.find((g) => [g.a, g.b].includes('tv') && [g.a, g.b].includes('sofa'));
if (!gap || gap.cm < 40 || gap.cm >= 70) problems.push(`no tight gap between the sofa and the TV: ${JSON.stringify(s.gaps)} (TV at y=${byId(s, 'tv')?.y})`);
if (!(await page.locator('#pg-space .spaceinfo', { hasText: 'under 70 cm' }).count())) problems.push('the planner does not say a gap is under 70 cm');
await page.screenshot({ path: `${out}/space-gap.png` });

// ---- add a desk from the catalogue and turn it ----
await page.locator('#pg-space .spacecat button', { hasText: 'Desk' }).click();
s = await sp();
const desk = s.items.find((i) => i.kind === 'desk');
if (!desk) problems.push('the desk was not added');
else {
  await page.locator('#pg-space button', { hasText: 'ROTATE' }).click();
  s = await sp();
  if (byId(s, desk.id)?.rot !== 1) problems.push(`ROTATE left the desk at rot ${byId(s, desk.id)?.rot}`);
}
if (s.clashes.length) problems.push(`pieces clash after adding: ${s.clashes}`);

// ---- WILL IT FIT? ----
const fit = async (w, d) => {
  await page.fill('#pg-space .spacefitin input >> nth=0', String(w));
  await page.fill('#pg-space .spacefitin input >> nth=1', String(d));
  await page.locator('#pg-space .spacefitin button', { hasText: 'CHECK' }).click();
  return (await sp()).fit;
};
const small = await fit(85, 85);
if (!/^(Yes|Only just)/.test(small)) problems.push(`an armchair-sized thing: "${small}"`);
const huge = await fit(500, 100);
if (!/^No/.test(huge)) problems.push(`a 5 m thing in a 4.2 m room: "${huge}"`);

// ---- MAKE SPACE: up to three layouts, each with more open floor; try one, then UNDO ----
const before = await sp();
await page.locator('#pg-space button', { hasText: 'MAKE SPACE' }).first().click();
s = await sp();
if (!(s.options.length >= 1 && s.options.length <= 3)) problems.push(`MAKE SPACE offered ${s.options.length} layouts`);
if (s.options.some((o) => o.open <= before.open.area)) problems.push(`a layout frees no floor: ${JSON.stringify(s.options)} vs ${before.open.area}`);
const opts = page.locator('#pg-space .spaceopt');
if ((await opts.count()) !== s.options.length) problems.push('the layouts are not all listed');
await opts.first().click();
s = await sp();
if (s.open.area <= before.open.area) problems.push(`layout 1 left ${s.open.area} cm² open (was ${before.open.area})`);
if (s.clashes.length) problems.push(`layout 1 has clashes: ${s.clashes}`);
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/space-make.png` });
await page.locator('#pg-space .spacemake button', { hasText: 'UNDO' }).click();
s = await sp();
if (JSON.stringify(s.items) !== JSON.stringify(before.items)) problems.push('UNDO did not put the furniture back');
// a layout tried, then the room changes (SET): the old room's layouts and UNDO go
const undoBtn = page.locator('#pg-space .spacemake button', { hasText: 'UNDO' });
const makeAndTry = async () => {
  await page.locator('#pg-space button', { hasText: 'MAKE SPACE' }).first().click();
  if (await opts.count()) await opts.first().click();
  if (!(await undoBtn.isVisible())) problems.push(`no UNDO after trying a layout (${await opts.count()} layouts, ${JSON.stringify((await sp()).options)})`);
};
await makeAndTry();
await page.fill('#pg-space input[aria-label="Room width in cm"]', '430');
await page.locator('#pg-space .spaceroom button', { hasText: 'SET' }).click();
await until(() => window.__ghosty?.space?.room?.w === 430, 5000, 'SET did not change the room');
if (await undoBtn.isVisible()) problems.push('UNDO from the old room is still offered after SET');
if (await opts.count()) problems.push('the old room\'s layouts are still listed after SET');
// an older planner file (quarter turns, `label`) still imports: the room as it was before MAKE SPACE
await page.locator('#pg-space .spaceexport input[type=file]').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 1, room: { w: 420, d: 360 }, items: before.items })) });
await until(() => window.__ghosty?.space?.room?.w === 420, 5000, 'an older planner file did not import');
if (JSON.stringify((await sp()).items) !== JSON.stringify(before.items)) problems.push('an older planner file did not import its pieces as they were');
await makeAndTry();
const exportedItems = (await sp()).items;

// ---- EXPORT: a real PNG and a JSON plan; IMPORT reads one back ----
const [png] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('#pg-space .spaceexport button', { hasText: 'PNG' }).click()]);
if (!png) problems.push('PNG export gave no file');
else {
  const bytes = readFileSync(await png.path());
  if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) || bytes.length < 2000) problems.push(`the PNG is not a picture (${bytes.length} bytes)`);
  if (!/^room-plan-420x360\.png$/.test(png.suggestedFilename())) problems.push(`PNG named ${png.suggestedFilename()}`);
}
const [json] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('#pg-space .spaceexport button', { hasText: 'JSON' }).click()]);
let plan = null;
if (!json) problems.push('JSON export gave no file');
else {
  plan = JSON.parse(readFileSync(await json.path(), 'utf8'));
  if (plan.room?.w !== 420 || plan.items?.length !== 4) problems.push(`the JSON plan reads ${JSON.stringify(plan).slice(0, 200)}`);
  // Room JSON (what the 3D STUDIO reads): names, and turns in degrees
  if (!plan.items?.every((i) => typeof i.name === 'string' && [0, 90, 180, 270].includes(i.rot))) problems.push(`the JSON plan is not Room JSON: ${JSON.stringify(plan.items).slice(0, 300)}`);
}
if (plan) {
  plan.room = { w: 500, d: 400 };
  await page.locator('#pg-space .spaceexport input[type=file]').setInputFiles({ name: 'plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plan)) });
  await until(() => window.__ghosty?.space?.room?.w === 500, 5000, 'IMPORT did not read the plan back');
  const back = (await sp()).items;
  const key = (i) => [i.id, i.label, i.w, i.d, i.x, i.y, i.rot].join(',');
  if (back.map(key).join('|') !== exportedItems.map(key).join('|')) problems.push(`IMPORT did not give back the exported pieces: ${back.map(key).join('|')} vs ${exportedItems.map(key).join('|')}`);
  // the layouts, UNDO and preview were for the room before the import
  if (await undoBtn.isVisible()) problems.push('UNDO from the old plan is still offered after IMPORT');
  if (await opts.count()) problems.push('the old plan\'s layouts are still listed after IMPORT');
}

// ---- the planner remembers (this phone's storage) ----
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'space'));
await until(() => window.__ghosty?.space?.room?.w === 500 && window.__ghosty?.space?.items?.length === 4, 10000, 'the plan was not kept on the phone');

const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('the planner is wider than the phone screen');
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.screenshot({ path: `${out}/space-final.png`, fullPage: false });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'SPACE PLANNER run clean on an iPhone 13: opened from the chat with a 420 × 360 cm room, a piece dragged and snapped to the wall, a sub-70 cm walkway flagged, a desk added and turned, WILL IT FIT? answered both ways, MAKE SPACE offered layouts with more open floor and UNDO restored the room, PNG and JSON exported, a plan imported and kept on the phone.');
process.exit(problems.length ? 1 : 0);
