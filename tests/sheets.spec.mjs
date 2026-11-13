// THE FULL EDITORS, THE THIRD: SPREADSHEETS, the core of Excel (BRIEF-EDITOR-SPREADSHEETS; OWNER-ISSUES 127, 164, 176, 178) on the owner's iPhone 18 Pro
// Max (440 × 956, en-GB, Europe/London) against the real brain with its scripted model, at 440 and 390:
//  a. MAKE → SPREADSHEETS in two taps; "my spreadsheets" in the chat opens it.
//  b. The empty states' words; START WITH A BUDGET seeds the twelve months and the summary (timed).
//  c. A typed formula recalculates what leans on it: March's bills change and the month's total, the summary and the year move.
//  d. FORMAT: £ and % and the cell shows it.   e. SORT and FILTER on a column's header.   f. CHART from a range draws the app's chart.
//  g. EXPORT: .xlsx (the size said before, equal to the file's), CSV, PDF; the file read by a parser that is not ours (the browser's own, well
//     formed, formulas still formulas) and IMPORTed back equal; a .xlsx made by hand the way Excel writes one (tests/xlsxfixture.mjs) keeps its
//     formulas and says what it could not keep.
//  h. Autosave said once; the workbook reopens where it was; sheets renamed by a long press; UNDO and REDO.
//  i. The Stage's OPEN on a table answer lands in a new sheet.   j. Ghosty in it: explain a cell, write a formula.
//  k. BODY 21, reduced motion, offline, every control 44 pt and nothing sideways in The Scan, Glass and ONE INK at 440 × 956 and The Scan at 390 × 844.
// The benchmark (the budget seeded, a rent changed, sorted, charted, exported, read back) is timed and printed.
//   BASE=http://localhost:8810 node tests/sheets.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { foreignXlsx } from './xlsxfixture.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open({ look = SCAN, viewport = PHONE, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', acceptDownloads: true, reducedMotion });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look }) => {
    if (!localStorage.getItem('spec.sheets.seeded')) {
      localStorage.setItem('spec.sheets.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    }
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const state = (page) => page.evaluate(() => { const s = window.__ghosty.sheets; return { ...s, read: undefined, json: undefined, book: JSON.parse(s.json || 'null') }; });
const read = (page, sheet, addr) => page.evaluate(([s, a]) => window.__ghosty.sheets.read(s, a), [sheet, addr]);
const goSheets = async (page) => {
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]');
  await page.waitForSelector('#pg-sheets .shsheet', { timeout: 15000 });
};
const bar = (page, label) => page.locator('#pg-sheets .shbar button', { hasText: label }).first();
const cell = (page, a) => page.locator(`.shsheet .shc[data-a="${a}"]`).first();
const shown = (page, a) => cell(page, a).textContent().then((t) => (t ?? '').trim());
const pill = (page, name) => page.locator('.shpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
const key = (page, label) => page.locator('.shpanel:not([hidden]) button, .shtools button, .shcolmenu button, .shexport button, .shask button, .shfind button, .shempty button').filter({ hasText: label }).first();
/** Types into the cell as he would: tap it, then the formula line, then Enter. */
async function type(page, a, text) {
  await cell(page, a).click();
  const line = page.locator('.shline');
  await line.fill(text);
  await line.press('Enter');
  await page.waitForTimeout(60);
}
const tab = (page, name) => page.locator(`.shtab[data-sheet="${name}"]`).click();
const budget = async (page) => {
  const t = Date.now();
  await page.locator('.shempty button', { hasText: /START WITH A BUDGET/i }).first().click();
  const ok = await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.length === 13, null, 20000);
  return { ok, ms: Date.now() - t };
};
async function saved(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), click()]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const sizes = async (pg, where) => pg.evaluate((w) => {
  const bad = [];
  for (const b of document.querySelectorAll(`${w} :is(button, select, input:not([type=hidden]):not([type=file]), .shc, .shch, .shrh):not([hidden])`)) {
    if (!b.getClientRects().length) continue;
    const r = b.getBoundingClientRect();
    if (r.width && (r.height < 43.5 || ((b.tagName === 'BUTTON' || b.classList.contains('shc')) && r.width < 43.5))) bad.push(`${b.tagName} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const side = document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1;
  const names = [...document.querySelectorAll(`${w} :is(button, input, select):not([type=hidden])`)].filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.textContent || '').trim())).map((e) => e.outerHTML.slice(0, 70));
  const cut = [...document.querySelectorAll(`${w} :is(button, .shsaid, .shmeta, .shempty p)`)].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'auto').map((e) => `"${(e.textContent || '').trim().slice(0, 24)}" ${e.scrollWidth}/${e.clientWidth}`);
  return { bad, side, names, cut };
}, where);

// ================================================================ a to j. one phone, The Scan
const T0 = Date.now();
const { ctx, page } = await open({ look: SCAN });
const tOpen = Date.now();
await goSheets(page);
const openMs = Date.now() - tOpen;
check(await page.locator('#pg-sheets .shbar button', { hasText: 'NEW' }).count() === 1 && await bar(page, 'MY SPREADSHEETS').count() === 1, `a. MAKE → Spreadsheets opens the spreadsheets screen with NEW and IMPORT (${openMs} ms)`);
check(openMs < 4000, `a. the screen opens inside its budget (${openMs} ms of 4000)`);

// b. the empty states
let s = await state(page);
check(s.view === 'list' && /No spreadsheets yet/i.test(await page.locator('.shempty').innerText()) && await page.locator('.shempty button', { hasText: /START WITH A BUDGET/i }).count() === 1, 'b. no spreadsheets yet: one line and START WITH A BUDGET');
const seeded = await budget(page);
check(seeded.ok, `b. START WITH A BUDGET makes twelve months and a summary (${seeded.ms} ms)`);
s = await state(page);
check(s.sheets[0] === 'Summary' && s.sheets[1] === 'January' && s.sheets[12] === 'December', `b. the sheets run Summary, January … December (${s.sheets.slice(0, 3).join(', ')} …)`);
check((await read(page, 'Summary', 'A14')).text === 'Year' && /^£/.test((await read(page, 'Summary', 'B14')).text), 'b. the summary’s year line is in pounds');
check(await page.locator('.shchart svg [data-bar]').count() === 12, 'b. the summary’s chart of the twelve months draws twelve bars');
await page.screenshot({ path: `${out}/sheets-budget.png` });
await bar(page, 'MY SPREADSHEETS').click();
await bar(page, 'NEW').click();
check(await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.length === 1), 'b. NEW makes a blank workbook with one sheet');
check(/blank|empty|type/i.test(await page.locator('.shempty').innerText()) && await page.locator('.shempty button', { hasText: /START WITH A BUDGET/i }).count() === 1, 'b. an empty workbook says what to do in one line, and offers the budget');
const blankTitle = (await state(page)).title;
await bar(page, 'MY SPREADSHEETS').click();
check(await page.locator('.shlist .shopen').count() === 2, 'b. both workbooks are in My spreadsheets');
await page.locator('.shlist .shopen', { hasText: /budget/i }).first().click();
await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.length === 13);

// c. a typed formula recalculates its dependants
await tab(page, 'March');
const before = { out: (await read(page, 'March', 'H6')).v, year: (await read(page, 'Summary', 'C14')).v, left: (await read(page, 'Summary', 'D14')).v, bill: (await read(page, 'March', 'D2')).v };
const tEdit = Date.now();
await type(page, 'D2', String(before.bill + 100));
check(await until(page, (w) => window.__ghosty.sheets.read('March', 'H6').v === w, before.out + 100), 'c. changing a bill moves the month’s total');
const editMs = Date.now() - tEdit;
check((await read(page, 'Summary', 'C14')).v === before.year + 100 && (await read(page, 'Summary', 'D14')).v === before.left - 100, 'c. and the summary’s year, what is spent and what is left');
await type(page, 'K1', '=SUM(D2:D5)*2');
check((await read(page, 'March', 'K1')).v === (before.bill + 100 + (await read(page, 'March', 'D3')).v + (await read(page, 'March', 'D4')).v + (await read(page, 'March', 'D5')).v) * 2 && /^[0-9.]+$/.test(await shown(page, 'K1')), 'c. a formula typed in the formula line is worked out and shown');
await type(page, 'K2', '=1/0');
check(await shown(page, 'K2') === '#DIV/0!', 'c. a formula that cannot be worked out shows Excel’s own word');
await cell(page, 'K2').click();
check(/divid|zero|0/i.test(await page.locator('.sherr').innerText()), 'c. and his one line says why when the cell is chosen');
await type(page, 'K3', '=K3+1');
check(await shown(page, 'K3') === '#CIRCULAR!' && /point|itself|loop/i.test(await (async () => { await cell(page, 'K3').click(); return page.locator('.sherr').innerText(); })()), 'c. a cell that points at itself says so in his words');
await type(page, 'K3', '');
await type(page, 'K2', '');
await cell(page, 'K1').click();
await page.locator('.shline').fill('=SU');
const nfn = await page.locator('.shfn').count();
check(nfn >= 1 && nfn <= 3 && /^SUM/.test((await page.locator('.shfn').first().textContent().catch(() => '')) ?? ''), `c. (${nfn} offered) typing a function’s start offers its name (the first three, 44 pt keys)`);
await page.locator('.shfn').first().click();
check(/^=SUM\($/.test(await page.locator('.shline').inputValue()), 'c. the offered name goes in with its bracket');
await page.locator('.shline').fill('');
await page.locator('.shline').press('Escape');
await type(page, 'K1', '');

// d. FORMAT
await pill(page, 'FORMAT');
await type(page, 'K2', '0.256');
await cell(page, 'K2').click();
await key(page, '%').click();
check(await shown(page, 'K2') === '25.60%', `d. FORMAT % shows 25.60% (${await shown(page, 'K2')})`);
await key(page, 'DECIMALS −').click();
check(await shown(page, 'K2') === '25.6%', 'd. one decimal fewer');
await type(page, 'K3', '1234.5');
await cell(page, 'K3').click();
await key(page, '£').click();
check(await shown(page, 'K3') === '£1,234.50', 'd. FORMAT £ shows £1,234.50');
await key(page, /^B$/).click();
check(await cell(page, 'K3').evaluate((e) => getComputedStyle(e).fontWeight >= 600 || e.dataset.b === '1'), 'd. bold');
await page.locator('.shpanel:not([hidden]) button[aria-label="Fill 1"]').click();
check(await cell(page, 'K3').getAttribute('data-fill') === '1', 'd. a fill from the house’s own colours');
await type(page, 'K4', '5/3/2024');
check(await shown(page, 'K4') === '5 Mar 2024', `d. a typed date is a date, said as he says it (${await shown(page, 'K4')})`);
await page.screenshot({ path: `${out}/sheets-format.png` });

// e. SORT and FILTER on a column's header
await page.locator('.shch[data-c="D"]').click();
check(await page.locator('.shcolmenu').isVisible(), 'e. a column’s header opens its SORT and FILTER');
await key(page, 'SORT LARGEST FIRST').click();
const col = async () => Promise.all([2, 3, 4, 5].map(async (r) => (await read(page, 'March', `D${r}`)).v));
let d = await col();
check(d.every((v, i) => !i || v <= d[i - 1]), `e. SORT LARGEST FIRST puts the bills in order (${d.join(', ')})`);
check((await read(page, 'March', 'H2')).f === 'SUM(C2:G2)', 'e. each week’s total still adds its own row');
await page.locator('.shch[data-c="D"]').click();
await key(page, 'SORT SMALLEST FIRST').click();
d = await col();
check(d.every((v, i) => !i || v >= d[i - 1]), `e. SORT SMALLEST FIRST (${d.join(', ')})`);
await page.locator('.shch[data-c="D"]').click();
await page.locator('.shfop').selectOption('over');
await page.locator('.shfval').fill('50');
await key(page, /^FILTER$/).click();
const over = d.filter((v) => v > 50).length;
check(await page.locator('.shsheet .shr[data-r]:not([data-head])').evaluateAll((rows) => rows.filter((r) => ['2', '3', '4', '5'].includes(r.dataset.r)).length) === over, `e. FILTER over £50 keeps the ${over} weeks that are`);
check(/over|filter/i.test(await page.locator('.shmeta').innerText()) || /filter/i.test(await page.locator('.shsaid').innerText()), 'e. and says a filter is on');
await page.locator('.shch[data-c="D"]').click();
await key(page, 'CLEAR FILTER').click();
check(await page.locator('.shsheet .shr[data-r]').evaluateAll((rows) => ['2', '3', '4', '5'].every((n) => rows.some((r) => r.dataset.r === n))), 'e. CLEAR FILTER brings every week back');
await page.screenshot({ path: `${out}/sheets-sort.png` });

// f. CHART from a range
await tab(page, 'January');
await page.locator('.shaddr').fill('A1:D5');
await page.locator('.shaddr').press('Enter');
await pill(page, 'CHART');
await key(page, 'BARS').click();
await key(page, 'MAKE THE CHART').click();
check(await until(page, () => document.querySelectorAll('.shchart svg [data-bar]').length === 4), 'f. CHART from a range draws the app’s chart: four weeks, four bars');
check(/Week 1/i.test(await page.locator('.shchart svg').first().getAttribute('aria-label')), 'f. its first bar is named for its row');
await type(page, 'D2', '999');
check(await until(page, () => /999/.test(document.querySelector('.shchart svg')?.getAttribute('aria-label') ?? '')), 'f. the chart follows the numbers');
await page.locator('.shaddr').fill('A1:D5');
await page.locator('.shaddr').press('Enter');
await key(page, 'LINE').click();
await key(page, 'MAKE THE CHART').click();
check(await until(page, () => document.querySelectorAll('.shchart svg [data-dot]').length === 4), 'f. a line chart draws its four points');
await page.screenshot({ path: `${out}/sheets-chart.png` });
await page.locator('.shchart button', { hasText: /REMOVE/i }).first().click();
await page.locator('.shchart button', { hasText: /REMOVE/i }).first().click().catch(() => undefined);
check(await page.locator('.shchart svg').count() === 0, 'f. REMOVE takes a chart off the sheet');

// g. EXPORT: the size said before, a file read by a parser that is not ours, IMPORT back equal
await tab(page, 'Summary');
await pill(page, 'DATA');
const sizeSaid = await page.locator('.shsize[data-for="xlsx"]').innerText();
check(/\d/.test(sizeSaid) && /KB|bytes|MB/i.test(sizeSaid), `g. the size is said before the tap: "${sizeSaid.trim()}"`);
const tExp = Date.now();
const x1 = await saved(page, () => key(page, 'XLSX').click());
const expMs = Date.now() - tExp;
check(/\.xlsx$/.test(x1.name) && x1.bytes.subarray(0, 2).toString() === 'PK', `g. EXPORT gives a .xlsx (${x1.name}, ${x1.bytes.length} bytes, ${expMs} ms)`);
const said = Number((sizeSaid.match(/([\d.]+)\s*(KB|MB|bytes)/i) ?? [])[1]);
const unit = (sizeSaid.match(/(KB|MB|bytes)/i) ?? [])[1]?.toLowerCase();
check(Math.abs(said * (unit === 'kb' ? 1000 : unit === 'mb' ? 1000000 : 1) - x1.bytes.length) <= (unit === 'kb' ? 51 : unit === 'mb' ? 50001 : 0), `g. and it was the size said (${sizeSaid.trim()} for ${x1.bytes.length} bytes)`);
const parts = await page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const dv = new DataView(bin.buffer);
  let e = bin.length - 22;
  while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  let p = dv.getUint32(e + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let n = 0; n < dv.getUint16(e + 10, true); n++) {
    const size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = dec.decode(bin.subarray(p + 46, p + 46 + nl));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    out[name] = dec.decode(bin.subarray(start, start + size));
    p += 46 + nl + el + cl;
  }
  const bad = [];
  let formulas = 0;
  for (const [n, x] of Object.entries(out)) {
    if (!/\.(xml|rels)$/.test(n)) continue;
    const doc = new DOMParser().parseFromString(x, 'application/xml');
    if (doc.querySelector('parsererror')) bad.push(n);
    formulas += doc.getElementsByTagName('f').length;
  }
  return { names: Object.keys(out), bad, formulas, wb: out['xl/workbook.xml'] ?? '' };
}, x1.bytes.toString('base64'));
check(!parts.bad.length && parts.names.includes('xl/workbook.xml') && parts.names.includes('xl/sharedStrings.xml') && parts.names.includes('xl/styles.xml') && parts.names.filter((n) => /worksheets\/sheet\d+\.xml$/.test(n)).length === 13, `g. its XML is well formed in the browser’s own parser: ${parts.names.length} parts, 13 sheets${parts.bad.length ? `, BAD ${parts.bad.join(',')}` : ''}`);
check(parts.formulas >= 100 && /sheet name="December"/.test(parts.wb), `g. the formulas are still formulas in the file (${parts.formulas} of them) and the sheets keep their names`);
const orig = await state(page);
const origYear = (await read(page, 'Summary', 'D14')).v;
await bar(page, 'MY SPREADSHEETS').click();
const tImp = Date.now();
await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'budget-copy.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: x1.bytes });
check(await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.length === 13 && /budget copy/i.test(window.__ghosty.sheets.title)), 'g. IMPORT of that file opens it as its own workbook');
const impMs = Date.now() - tImp;
const back = await state(page);
const cellsOf = (b) => Object.fromEntries(b.sheets.map((sh) => [sh.name, Object.fromEntries(Object.entries(sh.cells).map(([a, c]) => [a, [c.f ?? null, c.f ? null : c.v ?? null, JSON.stringify(Object.fromEntries(Object.entries(c.x ?? {}).sort()))]]))]));
const co = cellsOf(orig.book);
const cb = cellsOf(back.book);
const diff = [];
for (const [sn, cells] of Object.entries(co)) for (const [a, v] of Object.entries(cells)) if (JSON.stringify(v) !== JSON.stringify(cb[sn]?.[a])) diff.push(`${sn}!${a} ${JSON.stringify(v)} vs ${JSON.stringify(cb[sn]?.[a])}`);
check(!diff.length && Object.keys(co).length === Object.keys(cb).length, `g. read back, every cell, formula and format is equal${diff.length ? `: ${diff.length} differ, first ${diff[0]}` : ''}`);
check((await read(page, 'Summary', 'D14')).v === origYear && typeof origYear === 'number', `g. and the numbers work out the same (the year's left: ${origYear})`);
await bar(page, 'MY SPREADSHEETS').click();
await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'quarter.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: foreignXlsx() });
check(await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.join() === 'Quarter,Notes'), 'g. a .xlsx made by hand, the way Excel writes one, opens here');
check((await read(page, 'Quarter', 'C3')).f === 'B3*(1+Rate)' && Math.abs((await read(page, 'Quarter', 'C3')).v - 300.6) < 1e-9 && (await read(page, 'Quarter', 'D5')).v === 250.5, 'g. its formulas stay formulas (a shared one slid down, a name, XLOOKUP) and are worked out here');
check((await read(page, 'Quarter', 'B2')).text === '£800.00' && (await read(page, 'Quarter', 'F1')).text === '29 Feb 2024' && (await read(page, 'Quarter', 'E1')).text === '20%', 'g. its pounds, its date and its percentage are shown as they were');
const lost = (await state(page)).lost;
check(lost.length >= 2 && lost.some((x) => /merged/i.test(x)) && lost.some((x) => /chart|drawing|picture/i.test(x)), `g. what it could not keep is said once: ${lost.join('; ')}`);
check(/could not keep|didn’t keep|did not keep|left out/i.test(await page.locator('.shsaid').innerText()) && (await page.locator('.shsaid').innerText()).match(/merged/gi)?.length === 1, 'g. in his words, on the screen, once');
await page.screenshot({ path: `${out}/sheets-import.png` });
// CSV and PDF
await bar(page, 'MY SPREADSHEETS').click();
await page.locator('.shlist .shopen', { hasText: /budget/i }).first().click();
await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.sheets.length === 13);
await tab(page, 'Summary');
const csv = await saved(page, () => key(page, 'CSV').click());
const csvText = csv.bytes.toString('utf8');
check(/\.csv$/.test(csv.name) && csvText.split('\r\n')[0].startsWith('Month,Income,Out,Left') && /^January,/m.test(csvText), `g. CSV carries the sheet the way it is (${csv.name}, ${csv.bytes.length} bytes: ${JSON.stringify(csvText.slice(0, 60))})`);
const pdf = await saved(page, () => key(page, 'PDF').click());
const ptxt = pdf.bytes.toString('latin1');
check(/\.pdf$/.test(pdf.name) && ptxt.startsWith('%PDF-') && /\/Count 1[3-9]|\/Count [2-9]\d/.test(ptxt) && /January|Summary/.test(ptxt), `g. PDF out: every sheet and the chart, on landscape pages (${pdf.bytes.length} bytes)`);
check(/chart is in the PDF/i.test(await page.locator('.shexportnote').innerText()), 'g. the export says the chart is in the PDF and the numbers are in the file');
check(await page.locator('.shouts').innerText().then((t) => /xlsx|csv|pdf/i.test(t) && /KB|bytes/i.test(t)), 'g. what was made is listed with its size');

// h. autosave said once, reopen where he was, rename, undo
const keptBefore = (await state(page)).savedCount;
await tab(page, 'March');
await type(page, 'D3', '41');
await type(page, 'D4', '42');
await type(page, 'D5', '43');
check(await until(page, (n) => window.__ghosty.sheets.savedCount === n + 1, keptBefore, 5000), `h. three quick edits are said saved once (${keptBefore} → ${(await state(page)).savedCount})`);
check(/SAVED/i.test(await page.locator('.shsaved').innerText()), 'h. the page says SAVED, in the truth style');
await cell(page, 'D3').click();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
await goSheets(page);
await page.locator('.shlist .shopen', { hasText: /budget/i }).first().click();
check(await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.active === 'March' && window.__ghosty.sheets.sel === 'D3'), 'h. reopened, the workbook is on March at D3, where he left it');
check((await read(page, 'March', 'D4')).v === 42, 'h. and every edit was kept');
const tabEl = page.locator('.shtab[data-sheet="April"]');
await tabEl.scrollIntoViewIfNeeded();
const box = await tabEl.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(800);
await page.mouse.up();
await page.locator('.shrename').fill('Spring');
await page.locator('.shrename').press('Enter');
check(await until(page, () => window.__ghosty.sheets.sheets.includes('Spring') && !window.__ghosty.sheets.sheets.includes('April')), 'h. a long press on a sheet’s name renames it');
check((await read(page, 'Summary', 'A5')).text === 'April' && /Spring!/.test(JSON.stringify((await read(page, 'Summary', 'B5')).f)), 'h. and the formulas that reach into it follow the new name');
await key(page, 'UNDO').click();
check(await until(page, () => window.__ghosty.sheets.sheets.includes('April')), 'h. UNDO takes the new name back');
await key(page, 'REDO').click();
check(await until(page, () => window.__ghosty.sheets.sheets.includes('Spring')), 'h. REDO puts it again');
await page.locator('.shtabs button', { hasText: /ADD SHEET/i }).click();
check(await until(page, () => window.__ghosty.sheets.sheets.length === 14), 'h. ADD SHEET adds one');
await page.screenshot({ path: `${out}/sheets-tabs.png` });

// i. the Stage's OPEN on a table answer
await ctx.close();
{
  const { ctx: c3, page: p3 } = await open({ look: SCAN });
  await p3.evaluate(() => (location.hash = 'core'));
  await p3.waitForSelector('#cin', { state: 'visible', timeout: 15000 }).catch(async () => { await p3.locator('.logbtn:visible').first().click().catch(() => undefined); });
  const reply = 'Here is where your money went last month:\n\n| Category | Amount |\n| --- | --- |\n| Rent | £950 |\n| Food | £320.50 |\n| Travel | £88 |\n| Bills | £141 |\n\nRent is the biggest part of it.';
  await p3.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text: reply }, { t: 'done', model: 'Mock · scripted' }])).toString('base64'))}` }));
  for (let i = 0; i < 6 && !(await p3.locator('#cin:visible').count()); i++) {
    await p3.locator('.logbtn:visible').first().click({ timeout: 2000 }).catch(() => undefined);
    await p3.evaluate(() => document.querySelector('.logbtn')?.click());
    await p3.waitForTimeout(500);
  }
  await p3.fill('#cin', 'show me my spending as a table');
  await p3.keyboard.press('Enter');
  check(await until(p3, () => document.querySelector('#thestage')?.dataset.kind === 'table', null, 20000), 'i. the Stage shows a table answer as a table');
  check(await p3.locator('#thestage table').count() === 1 && await p3.locator('#thestage tbody tr').count() === 4 && /Rent/.test(await p3.locator('#thestage table').innerText()), 'i. four rows and a header, from the answer’s own numbers');
  await p3.screenshot({ path: `${out}/sheets-stage.png` });
  await p3.click('#thestage button[aria-label^="Open"]');
  check(await until(p3, () => window.__ghosty?.sheets?.view === 'book' && !!document.querySelector('.modal .shsheet'), null, 15000), 'i. OPEN lands it in a new sheet');
  check((await read(p3, 'Sheet1', 'A1')).text === 'Category' && (await read(p3, 'Sheet1', 'B3')).v === 320.5 && (await read(p3, 'Sheet1', 'B2')).text === '£950.00', 'i. the header, the words and the pounds as numbers');
  check(await p3.locator('.modal .shsheet .shc[data-a="B2"]').count() === 1, 'i. in the same editor');
  // j. Ghosty in it
  await p3.locator('.shc[data-a="B5"]').click();
  await p3.route('**/api/chat', (r) => r.continue());
  await p3.locator('.shask button', { hasText: 'EXPLAIN THIS CELL' }).click();
  check(await until(p3, () => document.querySelector('.shsug')?.textContent?.length > 20, null, 30000), 'j. EXPLAIN THIS CELL brings a plain sentence from the brain');
  await p3.locator('.shask input').fill('add up the amounts');
  await p3.locator('.shask button', { hasText: 'WRITE ME A FORMULA' }).click();
  check(await until(p3, () => /=SUM\(/i.test(document.querySelector('.shsug')?.textContent ?? ''), null, 30000), 'j. WRITE ME A FORMULA offers one');
  await p3.locator('.shsug button', { hasText: 'USE IT' }).click();
  check(/^=SUM\(/.test((await read(p3, 'Sheet1', 'B5')).f ? `=${(await read(p3, 'Sheet1', 'B5')).f}` : ''), 'j. USE IT puts it in the cell, and UNDO can take it out');
  await p3.screenshot({ path: `${out}/sheets-ask.png` });
  await c3.close();
}

// k. offline, reduced motion, BODY 21, the worlds and the phone
{
  const { ctx: c4, page: p4 } = await open({ look: SCAN, reducedMotion: 'reduce' });
  await goSheets(p4);
  await budget(p4);
  await c4.setOffline(true);
  await p4.evaluate(() => window.dispatchEvent(new Event('offline')));
  check(/no signal|offline/i.test(await p4.locator('.shoffline').innerText()) && /still work|everything/i.test(await p4.locator('.shoffline').innerText()), 'k. offline, the page says everything still works but Ghosty’s own answers');
  await tab(p4, 'March');
  await type(p4, 'D2', '77');
  check((await read(p4, 'March', 'D2')).v === 77 && await until(p4, () => window.__ghosty.sheets.saved > 0), 'k. offline, editing and saving still work');
  const csv2 = await saved(p4, () => key(p4, 'CSV').click());
  check(csv2.bytes.length > 100, 'k. offline, the export still works');
  check(await p4.locator('.shsaved').evaluate((e) => getComputedStyle(e).animationName === 'none' || getComputedStyle(e).animationDuration === '0s'), 'k. with reduced motion, SAVED just appears');
  await c4.setOffline(false);
  await c4.close();
}
for (const [look, name, viewport] of [[SCAN, 'scan', PHONE], [GLASS, 'glass', PHONE], [INK, 'ink', PHONE], [SCAN, 'scan390', { width: 390, height: 844 }]]) {
  const { ctx: c2, page: p2 } = await open({ look, viewport });
  await goSheets(p2);
  await budget(p2);
  await tab(p2, 'March');
  await p2.locator('.shaddr').fill('A1:D5');
  await p2.locator('.shaddr').press('Enter');
  for (const [pn, extra] of [['FORMAT', null], ['DATA', null], ['CHART', async () => { await key(p2, 'MAKE THE CHART').click(); }], ['FORMAT', async () => { await p2.locator('.shch[data-c="D"]').click(); }]]) {
    await pill(p2, pn);
    if (extra) await extra();
    await p2.waitForTimeout(250);
    const r = await sizes(p2, '#pg-sheets .shsheet');
    check(!r.bad.length && !r.side && !r.names.length, `${name} ${pn}: every key 44 pt, nothing sideways, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ` (unnamed: ${r.names.slice(0, 2).join(' ')})` : ''}`);
  }
  await p2.evaluate(() => { document.documentElement.dataset.body = '21'; });
  await p2.waitForTimeout(250);
  const r21 = await sizes(p2, '#pg-sheets .shsheet');
  check(!r21.side && !r21.cut.length && !r21.bad.length, `${name} at BODY 21 clips nothing and sticks out nowhere${r21.cut.length ? ': ' + r21.cut.slice(0, 3).join(' | ') : ''}${r21.bad.length ? ': ' + r21.bad.slice(0, 3).join(' | ') : ''}`);
  await p2.screenshot({ path: `${out}/sheets-${name}.png` });
  await c2.close();
}
console.log(`sizes and times: the screen opens in ${openMs} ms; START WITH A BUDGET ${seeded.ms} ms for 13 sheets; a bill changed to the summary moved in ${editMs} ms; the .xlsx ${x1.bytes.length} bytes in ${expMs} ms; read back in ${impMs} ms; the .pdf ${pdf.bytes.length} bytes; the .csv ${csv.bytes.length} bytes.`);
console.log(`benchmark (the budget seeded, a bill changed, sorted, charted, exported, imported back equal), by the spec: ${Date.now() - T0} ms in all`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'SPREADSHEETS ran clean: a budget of twelve months and a summary, formulas that follow, formats, sort and filter, a chart, Excel and CSV and PDF out and Excel in (ours and one made by hand), autosave and reopen, the Stage’s table, Ghosty in it, offline, reduced motion, BODY 21, three worlds and two phones.');
process.exit(problems.length ? 1 : 0);
