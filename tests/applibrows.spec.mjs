// THE PRO ROUND, lane LOG (apps/web/src/features/applib/renderers/log.ts): the log view as a specialist's app.
// - The hero: the first stat big with its trend against last week ("up 20% on last week", a limit going up is not good) and its ring.
// - Quick-add: plain words ("Coffee £3.20 fun today") read into the fields as chips while he types, then added in one press.
// - Rich rows: a swipe left deletes with Undo in the notice; a swipe right does the main action (the next column).
// - The item's own page: the fields as a clean sheet, Edit opens the form, Delete with Undo.
// - The money skin's day groups with their totals, the chart with today lit, the heatmap month, the masonry gallery, board drag.
// - The empty state (the app's art, one line, the quick-add bar), and everything fits at 440 with nothing sideways.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const day = (n = 0) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const T = ['These are sample entries.', 'Tap one to see it.', 'Swipe a row to delete it.'];
const SPEND = {
  id: 'spec-spend', name: 'Spec Spend', family: 'money', glyph: 'wallet', archetype: 'log', pitch: 'What you spend, day by day, against a weekly limit.', keywords: ['spec spend'], tour: T,
  log: {
    fields: [
      { id: 'name', label: 'What', type: 'text', required: true }, { id: 'amount', label: 'Amount', type: 'money' },
      { id: 'category', label: 'Category', type: 'choice', options: ['Food', 'Travel', 'Fun'] }, { id: 'date', label: 'Date', type: 'date', default: 'today' },
      { id: 'rating', label: 'Worth it', type: 'rating' }, { id: 'notes', label: 'Notes', type: 'long' },
    ],
    title: 'name', sub: 'category', meta: 'amount', date: 'date', group: 'category',
    stats: [{ label: 'This week', kind: 'sum', field: 'amount', period: 'week', goal: 200, dir: 'limit' }, { label: 'Entries', kind: 'count' }],
    chart: { field: 'amount', kind: 'bar', period: 'week' }, views: ['list', 'board', 'calendar', 'gallery'],
  },
  sample: [{ name: 'Lunch', amount: 12, category: 'Food', date: day(0), rating: 4 }, { name: 'Train', amount: 48, category: 'Travel', date: day(0) }, { name: 'Cinema', amount: 50, category: 'Fun', date: day(-7) }],
};
const SETS = {
  id: 'spec-sets', name: 'Spec Sets', family: 'body', glyph: 'dumbbell', archetype: 'log', pitch: 'Every set, its weight and its reps.', keywords: ['spec sets'], tour: T,
  log: { fields: [{ id: 'name', label: 'Exercise', type: 'text', required: true }, { id: 'weight', label: 'Weight', type: 'number', unit: 'kg' }, { id: 'reps', label: 'Reps', type: 'number' }, { id: 'pnl', label: 'Gain', type: 'money' }, { id: 'date', label: 'Date', type: 'date' }],
    title: 'name', sub: '{reps} at {weight} kg', meta: 'pnl', date: 'date', stats: [{ label: 'Sets', kind: 'count' }, { label: 'Heaviest', kind: 'max', field: 'weight' }, { label: 'Gain', kind: 'sum', field: 'pnl' }] },
  sample: [{ name: 'Squat', weight: 80, reps: 5, pnl: -640.35, date: day(0) }],
};
const YEAR = {
  id: 'spec-year', name: 'Spec Year', family: 'data', glyph: 'music', archetype: 'log', pitch: 'Your listening, told as a year in review.', keywords: ['spec year'], tour: T,
  log: { fields: [{ id: 'track', label: 'Track', type: 'text', required: true }, { id: 'artist', label: 'Artist', type: 'text' }, { id: 'mins', label: 'Listened', type: 'number', unit: 'min' }, { id: 'date', label: 'Date', type: 'date' }],
    title: 'track', sub: 'artist', meta: 'mins', date: 'date',
    stats: [{ label: 'Listening', kind: 'sum', field: 'mins' }, { label: 'Plays', kind: 'count' }, { label: 'Artists', kind: 'distinct', field: 'artist' }, { label: 'Longest', kind: 'max', field: 'mins' }] },
  sample: [{ track: 'Hope', artist: 'A', mins: 100.2, date: day(0) }, { track: 'Tide', artist: 'B', mins: 32.2, date: day(-1) }],
};
const EMPTY = { ...SPEND, id: 'spec-spend-empty', name: 'Spec Empty', sample: [] };

const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
await page.addInitScript(() => {
  localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
  if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } }));
});
await page.goto(`${base}/#apps`);
await page.waitForFunction(() => !!window.__ghosty?.applib, null, { timeout: 30000 });
const A = '.al-pro-frame .ak-app';
const wait = (ms) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms);
const tryApp = async (def) => {
  await page.evaluate((d) => window.__ghosty.applib.try(d), def);
  await page.waitForSelector(`.ak-app[data-app="${def.id}"]`, { timeout: 8000 });
  await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.ak-tour:not([hidden]) button')?.click(); });
  await wait(60);
};
const titles = () => page.$$eval(`${A} .al-row .ak-rowtitle`, (e) => e.map((x) => x.textContent));
/** Swipe a row's face by a share of its width (negative: left), with the finger's own moves. */
const swipe = async (title, share) => {
  const face = page.locator(`${A} .al-row:has(.ak-rowtitle:text-is("${title}")) .al-rowface`).first();
  await face.scrollIntoViewIfNeeded();
  const b = await face.boundingBox();
  const y = b.y + b.height / 2, x = b.x + b.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (b.width * share * i) / 8, y);
  await page.mouse.up();
  await wait(320);
};

// ── the hero and its trend, the money skin, the chart ─────────────────────────────────────────
await tryApp(SPEND);
check((await page.textContent(`${A} .al-lhero b`)).trim() === '£60', `[hero] the week's total: "${await page.textContent(`${A} .al-lhero b`)}"`);
check(/up 20% on last week/.test(await page.textContent(`${A} .al-lhero .al-trend`).catch(() => '')), `[hero] no trend against last week: "${await page.textContent(`${A} .al-lhero`).catch(() => '')}"`);
check(await page.locator(`${A} .al-lhero[data-trend="up"][data-good="false"]`).count() === 1, '[hero] a limit going up is not marked as not good');
check(await page.locator(`${A} .al-lhero .al-ring`).count() === 1 && await page.locator(`${A} .al-lhero .al-spark`).count() === 1, '[hero] the goal ring or the sparkline is missing');
check(await page.locator(`${A}[data-lskin="money"] .al-dayg`).count() === 2, '[money] the list is not grouped by day');
check(/Today/.test(await page.textContent(`${A} .al-dayg >> nth=0 >> .al-head`)) && /£60/.test(await page.textContent(`${A} .al-dayg >> nth=0 >> .al-head`)), '[money] the day head lacks Today and its total');
check(await page.locator(`${A} svg.al-chart rect.al-bar.al-today`).count() === 1 && await page.locator(`${A} svg.al-chart .al-ytick`).count() === 3, '[chart] today is not lit or the axis is not labelled');
check(await page.locator(`${A} .al-row .ak-rowdel`).count() === 0, '[rows] a cross on a row');
check(await page.locator(`${A} .al-row:has-text("Lunch") .al-rowstars`).count() === 1 && await page.locator(`${A} .al-row:has-text("Lunch") .al-thumb`).count() === 1, '[rows] the stars or the thumbnail are missing');
await page.screenshot({ path: `${out}/applibrows-hero.png` });

// ── quick-add ─────────────────────────────────────────────────────────────────────────────────
await page.fill(`${A} .al-quickin`, 'Coffee £3.20 fun today');
await wait(50);
const chips = await page.$$eval(`${A} .al-quickchip`, (e) => e.map((x) => `${x.dataset.field}=${x.textContent}`));
check(chips.some((c) => /^amount=Amount £3.20$/.test(c)) && chips.some((c) => /^category=Category Fun$/.test(c)) && chips.some((c) => /^name=What Coffee$/.test(c)), `[quick] the chips while typing: ${chips}`);
await page.screenshot({ path: `${out}/applibrows-quick.png` });
await page.press(`${A} .al-quickin`, 'Enter');
await wait(80);
check((await titles()).includes('Coffee') && (await page.textContent(`${A} .al-row:has-text("Coffee") .ak-rowmeta`)) === '£3.20', `[quick] Coffee was not added with its amount: ${await titles()}`);
check((await page.textContent(`${A} .al-lhero b`)).trim() === '£63.20', '[quick] the hero did not follow the add');
check(await page.inputValue(`${A} .al-quickin`) === '', '[quick] the bar did not clear');
await page.fill(`${A} .al-quickin`, '£9');
await page.press(`${A} .al-quickin`, 'Enter');
await wait(80);
check(await page.locator(`${A} .al-edit`).count() === 1 && await page.inputValue(`${A} .al-edit [data-field="amount"] input`) === '9', '[quick] a line without the needed name did not open the form with the amount filled');
await page.click(`${A} .al-edit button:has-text("Cancel")`);

// ── swipe left deletes, Undo in the notice; swipe right does the main action ────────────────
await swipe('Coffee', -0.75);
check(!(await titles()).includes('Coffee'), '[swipe] a swipe left did not delete Coffee');
check(/Recently deleted/.test(await page.textContent(`${A} .ak-notice`)) && await page.locator(`${A} .ak-notice .al-undo`).count() === 1, '[swipe] no Undo in the notice');
await page.click(`${A} .ak-notice .al-undo`);
await wait(60);
check((await titles()).includes('Coffee'), '[swipe] Undo did not bring Coffee back');
await swipe('Lunch', 0.75);
check(/Moved “Lunch” to Travel/.test(await page.textContent(`${A} .ak-notice`)) && /Travel/.test(await page.textContent(`${A} .al-row:has-text("Lunch") .ak-rowsub`)), '[swipe] a swipe right did not move Lunch on');
await swipe('Train', -0.25);
check(await page.locator(`${A} .al-row[data-swipe="left"]`).count() === 1 && (await titles()).includes('Train'), '[swipe] a short swipe did not leave Delete showing');
await page.click(`${A} .al-row:has-text("Train") .ak-rowmain`);
check(await page.locator(`${A} .al-row[data-swipe="left"]`).count() === 0 && await page.locator(`${A} .al-item`).count() === 0, '[swipe] a tap did not close the open row');

// ── the item's own page ───────────────────────────────────────────────────────────────────────
await page.click(`${A} .al-row:has-text("Lunch") .ak-rowmain`);
await page.waitForSelector(`${A} .al-item`);
check((await page.textContent(`${A} .al-item .al-itemtitle`)) === 'Lunch' && (await page.textContent(`${A} .al-item .al-itemrow[data-field="amount"] dd`)) === '£12', '[item] the page lacks the title or the amount');
check(await page.locator(`${A} .al-item .al-itemstars`).count() === 1 && await page.locator(`${A} .al-item .al-itemart`).count() === 1, '[item] the stars or the art are missing');
await page.screenshot({ path: `${out}/applibrows-item.png` });
await page.click(`${A} .al-item button[aria-label="Edit Lunch"]`);
await wait(220);
check(await page.locator(`${A} .al-edit`).count() === 1 && await page.inputValue(`${A} .al-edit [data-field="name"] input`) === 'Lunch', '[item] Edit did not open the form');
await page.click(`${A} .al-edit button:has-text("Cancel")`);
await page.click(`${A} .al-row:has-text("Coffee") .ak-rowmain`);
await page.click(`${A} .al-item button[aria-label="Delete Coffee"]`);
await wait(220);
check(!(await titles()).includes('Coffee') && await page.locator(`${A} .ak-notice .al-undo`).count() === 1, '[item] Delete did not delete with Undo');

// ── the board (drag), the heatmap, the gallery ───────────────────────────────────────────────
await page.click(`${A} .al-segkey:has-text("Board")`);
await page.locator(`${A} .al-col[data-col="Travel"] .al-bcard:has-text("Train")`).evaluate((e) => { const b = e.closest('.ak-body'); b.scrollTop += e.getBoundingClientRect().top - b.getBoundingClientRect().top - b.clientHeight / 2; });
const grip = await page.locator(`${A} .al-col[data-col="Travel"] .al-bcard:has-text("Train") .al-grip`).boundingBox();
const to = await page.locator(`${A} .al-col[data-col="Food"]`).boundingBox();
await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + ((to.y + 20 - grip.y) * i) / 10);
await page.mouse.up();
await wait(80);
check(await page.locator(`${A} .al-col[data-col="Food"] .al-bcard:has-text("Train")`).count() === 1 && /Moved “Train” to Food/.test(await page.textContent(`${A} .ak-notice`)), '[board] dragging Train to Food did not move it');
await page.click(`${A} .al-segkey:has-text("Calendar")`);
check(await page.locator(`${A} .al-day[data-level="4"]`).count() >= 1 && await page.locator(`${A} .al-heatkey`).count() === 1, '[calendar] no heat on the month');
await page.screenshot({ path: `${out}/applibrows-calendar.png` });
await page.click(`${A} .al-segkey:has-text("Gallery")`);
check(await page.$eval(`${A} .al-gallery`, (e) => getComputedStyle(e).columnCount) === '2', '[gallery] not a masonry of two columns');
await page.screenshot({ path: `${out}/applibrows-gallery.png` });
await page.click(`${A} .al-segkey:has-text("List")`);
const m = await page.evaluate((sel) => {
  const root = document.querySelector(sel);
  const keys = [...root.querySelectorAll('button, input:not([type=file])')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden');
  return { small: keys.filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => b.getAttribute('aria-label') || b.textContent).slice(0, 4), sideways: document.documentElement.scrollWidth > innerWidth };
}, A);
check(!m.small.length && !m.sideways, `[fit] ${JSON.stringify(m)}`);

// ── units said once, a true minus, minutes as time, tiles never alone, the data skin's stories ──────────
await tryApp(SETS);
check((await page.textContent(`${A} .al-row .ak-rowsub`)) === '5 at 80 kg', `[units] the line doubles its unit: "${await page.textContent(`${A} .al-row .ak-rowsub`)}"`);
check((await page.textContent(`${A} .al-row .ak-rowmeta`)) === '−£640.35', `[money] a loss reads "${await page.textContent(`${A} .al-row .ak-rowmeta`)}"`);
check(await page.$$eval(`${A} .al-stat:not(.al-lhero)`, (e) => e.map((x) => x.dataset.span).join()) === '3,3', '[tiles] two tiles are not side by side');
await tryApp(YEAR);
check(await page.locator(`${A} .al-stories .al-storycard`).count() === 1 && /2 h 12 min/.test(await page.textContent(`${A} .al-storycard b`)), `[data] no story card with its time: "${await page.textContent(`${A} .al-stories`).catch(() => '')}"`);
check(/Listening in all: 2 h 12 min\./.test(await page.textContent(`${A} .al-storyline`)), `[data] the story's sentence: "${await page.textContent(`${A} .al-storyline`).catch(() => '')}"`);
await page.click(`${A} .al-storynav button[aria-label="Next story"]`);
check(/^2$/.test((await page.textContent(`${A} .al-storycard b`)).trim()) && await page.getAttribute(`${A} .al-story`, 'data-at') === '1', '[data] Next did not show the second story');
const sc = await page.locator(`${A} .al-story`).boundingBox();
await page.mouse.move(sc.x + sc.width * 0.8, sc.y + sc.height / 2); await page.mouse.down(); await page.mouse.move(sc.x + sc.width * 0.2, sc.y + sc.height / 2, { steps: 6 }); await page.mouse.up();
check(await page.getAttribute(`${A} .al-story`, 'data-at') === '2', '[data] a swipe did not move to the next story');
check((await page.textContent(`${A} .al-row:has-text("Hope") .ak-rowmeta`)) === '1 h 40 min', '[data] minutes do not read as time in the row');
await page.screenshot({ path: `${out}/applibrows-data.png` });

// ── the empty state ──────────────────────────────────────────────────────────────────────────
await tryApp(EMPTY);
check(await page.locator(`${A} .al-empty .al-emptyart`).count() === 1 && await page.locator(`${A} .al-quickin`).count() === 1, '[empty] the empty state or the quick-add bar is missing');
await page.screenshot({ path: `${out}/applibrows-empty.png` });

await ctx.close();
await browser.close();
if (problems.length) { console.error(`applibrows: FAIL\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`applibrows: OK (the hero with its trend and ring, quick-add from plain words, swipe delete with Undo and the main action, the item page with Edit and Delete, the money day groups, today lit on the chart, board drag, the heatmap, the masonry gallery, the empty state; ${Math.round((Date.now() - T0) / 1000)} s)`);
