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
  const { pad, k } = (await sp()).view;
  return { x: box.x + pad + xcm * k, y: box.y + pad + ycm * k };
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

// ---- ARCHITECTURE: tap a wall → ADD DOOR; another → ADD WINDOW, dragged along its wall; the room an L; a second room ----
const closeLog = async () => {
  if (!(await page.locator('.logbtn').isVisible())) return;
  const covered = await page.evaluate(() => {
    const c = document.querySelector('#pg-space .spacecanvas');
    if (!c) return true;
    const r = c.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return !c.contains(el) && el !== c;
  });
  if (covered) await page.click('.logbtn');
};
await closeLog();
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
const tap = async (xcm, ycm) => {
  await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
  const p = await at(xcm, ycm);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
};
await tap(250, -6);
if (!/^wall:r1:0$/.test((await sp()).selected)) problems.push(`tapping the top wall chose "${(await sp()).selected}"`);
await page.locator('#pg-space .spacearch button', { hasText: 'ADD DOOR' }).click();
await tap(250, 406);
if (!/^wall:r1:2$/.test((await sp()).selected)) problems.push(`tapping the bottom wall chose "${(await sp()).selected}"`);
await page.locator('#pg-space .spacearch button', { hasText: 'ADD WINDOW' }).click();
s = await sp();
const door = s.openings.find((o) => o.type === 'door');
const win = s.openings.find((o) => o.type === 'window');
if (!door || door.wall !== 0 || door.w !== 80 || door.at !== 210) problems.push(`the door: ${JSON.stringify(door)} (want 80 cm in the middle of the top wall)`);
if (!win || win.wall !== 2 || win.w !== 100 || win.sill !== 90) problems.push(`the window: ${JSON.stringify(win)}`);
if (s.rooms[0]?.m2 !== 20 || s.rooms[0]?.ft2 !== 215 || s.area !== '20.0 m² (215 ft²)') problems.push(`the room's area: ${JSON.stringify(s.rooms)} ${s.area}`);
if (!(await page.locator('#pg-space .spaceroomnote', { hasText: 'm² (215 ft²)' }).count())) problems.push('the area in m² and ft² is not shown');
// the window, chosen, slides along its wall (wall 2 runs right to left: its middle follows the finger)
if (win) {
  const mid = 500 - win.at - win.w / 2;
  await drag([mid, 402], [mid - 120, 402]);
  const moved = (await sp()).openings.find((o) => o.id === win.id);
  if (!moved || moved.at !== win.at + 120) problems.push(`the window did not slide 120 cm along its wall: at ${moved?.at} (was ${win.at})`);
}
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/space-doors.png` });
// an L: the notch from the top right; the door and window stay where they are (on the renumbered walls)
await page.fill('#pg-space .spacenotch input >> nth=0', '150');
await page.fill('#pg-space .spacenotch input >> nth=1', '120');
await page.locator('#pg-space .spacerooms button', { hasText: 'L-SHAPE' }).click();
s = await sp();
if (s.rooms[0]?.corners !== 6 || s.rooms[0]?.m2 !== 18.2) problems.push(`L-SHAPE gave ${JSON.stringify(s.rooms[0])} (want 6 corners, 18.2 m²)`);
if (s.openings.length !== 2) problems.push(`the door and window did not stay on the L: ${JSON.stringify(s.openings)}`);
await page.locator('#pg-space .spacerooms button', { hasText: '+ ROOM RIGHT' }).click();
s = await sp();
if (s.rooms.length !== 2 || s.room.w !== 800) problems.push(`+ ROOM RIGHT: ${s.rooms.length} rooms, plan ${s.room.w} wide`);
// a door between the two rooms: tap the new room's left wall
await tap(500, 150);
if (!/^wall:/.test((await sp()).selected)) problems.push(`tapping the wall between the rooms chose "${(await sp()).selected}"`);
else await page.locator('#pg-space .spacearch button', { hasText: 'ADD DOOR' }).click();
s = await sp();
if (s.openings.filter((o) => o.type === 'door').length !== 2 || s.openings.length !== 3) problems.push(`doors and windows after the L and the new room: ${JSON.stringify(s.openings)}`);
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/space-rooms.png` });

// ---- DESIGN REVIEW: the plan goes to Ghosty with the goal; the changes come back as BEFORE / AFTER ----
await page.locator('#pg-space .spacegoals button', { hasText: 'A HOME OFFICE' }).click();
await page.locator('#pg-space .spacereview button', { hasText: 'REVIEW MY PLAN' }).click();
await until(() => (window.__ghosty?.space?.review?.options?.length ?? 0) > 0, 20000, 'no design changes came back from the review');
await until(() => window.__ghosty?.ui?.get?.().tab === 'space', 8000, 'SPACE did not open on the design changes');
await closeLog();
s = await sp();
if (s.review.goal.toLowerCase() !== 'a home office') problems.push(`the review's goal: ${s.review.goal}`);
const beforeItems = JSON.stringify(s.items);
const beforePlan = JSON.stringify({ items: s.items, openings: s.openings });
const clashedBefore = s.clashes;
await page.locator('#pg-space .spacechanges .spaceopt').first().click();
s = await sp();
if (s.review.view !== 'after' || s.review.chosen !== 0) problems.push(`tapping a change did not show AFTER: ${JSON.stringify(s.review)}`);
await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/space-after.png` });
await page.locator('#pg-space .spacebeforeafter button', { hasText: 'BEFORE' }).click();
if ((await sp()).review.view !== 'before') problems.push('BEFORE did not go back to the plan as it is');
await page.locator('#pg-space .spacebeforeafter button', { hasText: 'AFTER' }).click();
await page.locator('#pg-space .spacebeforeafter button', { hasText: 'APPLY' }).click();
s = await sp();
if (s.review.applied !== 1) problems.push(`APPLY did not apply: ${JSON.stringify(s.review)}`);
if (JSON.stringify({ items: s.items, openings: s.openings }) === beforePlan) problems.push('APPLY changed nothing on the plan');
if (s.clashes.some((c) => !clashedBefore.includes(c))) problems.push(`the applied change left new clashes: ${s.clashes} (before: ${clashedBefore})`);
await page.locator('#pg-space .spacebeforeafter button', { hasText: 'UNDO CHANGE' }).click();
if (JSON.stringify((await sp()).items) !== beforeItems) problems.push('UNDO CHANGE did not put the plan back');

// ---- SEE IN 3-D: the same rooms, doors and windows in the studio ----
await page.locator('#pg-space .spaceexport button', { hasText: 'SEE IN 3-D' }).click();
await until(() => window.__ghosty?.studio?.state?.().rooms === 2 && window.__ghosty.studio.state().openings === 3, 20000, 'SEE IN 3-D did not build the plan in the studio');
const st = await page.evaluate(() => { const x = window.__ghosty?.studio?.state?.(); return x && { rooms: x.rooms, openings: x.openings, title: x.title, error: x.error, tab: window.__ghosty.ui.get().tab, warnings: x.warnings }; });
if (!st || st.rooms !== 2 || st.openings !== 3) problems.push(`studio: ${JSON.stringify(st)} vs plan openings ${JSON.stringify((await sp()).openings.map((o) => o.id))}`);

const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('the planner is wider than the phone screen');
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.screenshot({ path: `${out}/space-final.png`, fullPage: false });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'SPACE PLANNER run clean on an iPhone 13: opened from the chat with a 420 × 360 cm room, a piece dragged and snapped to the wall, a sub-70 cm walkway flagged, a desk added and turned, WILL IT FIT? answered both ways, MAKE SPACE offered layouts with more open floor and UNDO restored the room, PNG and JSON exported, a plan imported and kept on the phone; a door and a window put on tapped walls (area in m² and ft²), the window slid along its wall, the room made an L, a second room added with a door between; DESIGN REVIEW sent the plan, the changes came back BEFORE / AFTER, one applied and undone; SEE IN 3-D built it in the studio.');
process.exit(problems.length ? 1 : 0);
