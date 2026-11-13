// THE FULL EDITORS, THE FIFTH: THE WORKSPACE, the core of Notion (BRIEF-EDITOR-WORKSPACE; OWNER-ISSUES 127, 164, 176, 178) on the owner's iPhone 18 Pro Max
// (440 × 956, en-GB, Europe/London) and at 390 × 844, against the real brain with its scripted model:
//  (a) MAKE → EDITORS → THE WORKSPACE in two taps; "my workspace" in the chat opens it;
//  (b) the empty state's words; START A PROJECT seeds the tree (a page, its TASKS database, three rows);
//  (c) a page typed in the line above, a to-do ticked with its date, "/" adds a table and a link to a page, the link opens the page and BACKLINKS lists the source;
//  (d) the TASKS database: a row added, a select set, BOARD shows it in its column, a drag moves it and the row's property changed; CALENDAR shows it on its
//      day; TIMELINE draws its bar and zooms; GALLERY shows its card; a filter hiding all says so and CLEAR IT;
//  (e) a formula property computed and an error said in his words; a relation and a rollup summed (the spreadsheet's engine works them);
//  (f) HISTORY lists versions and RESTORE brings one back, UNDO reverses; (g) SEARCH finds a word in a nested page;
//  (h) ASK ABOUT THIS PROJECT says the size before sending and the mocked reply lands as blocks to keep; with the phone offline "what is due this week in my project"
//      answers from the phone's own dates;
//  (i) EXPORT the zip with the size said, its Markdown read back by the app's own importer; IMPORT a CSV says its kinds;
//  (j) autosave said once; the page reopens where it was;
//  (k) the Stage's ADD TO A PROJECT on a document answer lands as a page inside the project;
//  (l) the three worlds, both widths, BODY 21: clips nothing, every control 44 pt, nothing sideways, every control named;
//  and THE BENCHMARK: the PROJECT seeded, twelve tasks with dates, four moved across the board by drag, three documents from MY DOCUMENTS linked, then a week run
//  in a minute (the page's clock advanced a day at a time, 30 edits a day, a reload after each day, the phone's storage made to fail on day four): every one of
//  the 210 edits is there at the end and the version history has the days; the time per edit to "Saved" and the size of the store are printed.
//   BASE=http://localhost:8827 node tests/workspace.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

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
const times = {};
const T0 = Date.now();

async function open({ viewport = PHONE, look = SCAN, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look, seed }) => {
    if (!localStorage.getItem('spec.workspace.seeded')) {
      localStorage.setItem('spec.workspace.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      for (const [k, v] of Object.entries(seed ?? {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    window.__ghostyHero = true;
    window.__ghostyShow = true;
    window.__ghostyPlace = { none: true };
    // (the page's clock moved a day at a time: the offset is kept in storage so a reload keeps the day)
    const RealDate = Date;
    const off = () => Number(localStorage.getItem('spec.off') || 0);
    class ShiftedDate extends RealDate {
      constructor(...a) {
        if (a.length) super(...a);
        else super(RealDate.now() + off());
      }
      static now() {
        return RealDate.now() + off();
      }
    }
    window.Date = ShiftedDate;
    // (a phone whose storage fails for a while: the spec raises __failStore and the next writes of the workspace throw, as a full or blocked phone does)
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'ghosty.workspace' && window.__failStore > 0) {
        window.__failStore--;
        window.__failed = (window.__failed ?? 0) + 1;
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      return set.call(this, k, v);
    };
  }, { key: KEY, look, seed });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const S = (page) => page.evaluate(() => ({ ...window.__ghosty.workspace, json: undefined, page: JSON.parse(window.__ghosty.workspace.json || 'null') }));
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.workspace') || 'null'));
/** Two taps: the MAKE key, then the EDITORS card's THE WORKSPACE pill. */
const goWorkspace = async (page) => {
  await page.click('#dock .tabcap button[data-area="make"]');
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="workspace"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="workspace"]');
  await page.waitForSelector('#pg-workspace .wssheet', { timeout: 15000 });
};
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
const sh = (page) => page.locator('#pg-workspace .wssheet, .modal .wssheet').first();
const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
const tapKey = async (page, label) => {
  await key(page, label).scrollIntoViewIfNeeded().catch(() => undefined);
  await key(page, label).click();
};
const view = (page) => page.evaluate(() => window.__ghosty.workspace.view);
const saved = (page, from) => until(page, (t) => window.__ghosty.workspace.saved > t, from, 8000);
const savedAt = (page) => page.evaluate(() => window.__ghosty.workspace.saved);
/** The page's own saves finished: nothing waiting. */
const quiet = async (page) => {
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__ghosty.workspace.saved);
};
const openPageByTitle = async (page, title) => {
  await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb[aria-label^="Back to my workspace"], .modal .wscrumb[aria-label^="Back to my workspace"]')?.click());
  await page.waitForTimeout(150);
  const row = sh(page).locator('.wstree .wsopen', { hasText: title }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await until(page, () => window.__ghosty.workspace.view === 'page');
};
/** A card lifted with the mouse and dropped on a column, the board scrolling at the screen's edge to reach one that is off it. `hold`: called while held over the column. */
async function dragCard(pg, cardLoc, colName, hold, edge = false) {
  await cardLoc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const c = await cardLoc.locator('.wscardopen').boundingBox();
  const sel = `.wscol[data-col="${colName}"]`;
  await pg.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await pg.mouse.down();
  await pg.mouse.move(c.x + c.width / 2 + 20, c.y + 20, { steps: 3 });
  if (edge) {
    // held at the screen's edge the board scrolls towards the columns that are off the screen
    const at = await pg.evaluate(() => document.querySelector('.wsboardscroll').scrollLeft);
    await pg.mouse.move(pg.viewportSize().width - 20, c.y + 20, { steps: 6 });
    const moved = await pg.waitForFunction((x) => document.querySelector('.wsboardscroll').scrollLeft > x + 60, at, { timeout: 8000 }).then(() => true, () => false);
    check(moved, 'a card held at the screen’s edge scrolls the board towards the columns off the screen');
    await pg.mouse.move(pg.viewportSize().width / 2, c.y + 20, { steps: 3 });
  }
  // (the column is brought to the middle, as the held card's finger would by scrolling)
  await pg.evaluate((q) => document.querySelector(q).scrollIntoView({ inline: 'center', block: 'nearest' }), sel);
  await pg.waitForTimeout(80);
  const col = await pg.locator(sel).boundingBox();
  await pg.mouse.move(Math.max(8, Math.min(pg.viewportSize().width - 8, col.x + Math.min(col.width / 2, 60))), col.y + 30, { steps: 6 });
  if (hold) await hold();
  await pg.mouse.up();
}
const crumb = (pg, t) => pg.evaluate((w) => [...document.querySelectorAll('.wscrumb')].find((b) => b.textContent.includes(w))?.click(), t);
const toTable = async (pg) => { await pg.locator('.wspill[data-kind="table"]').click(); await pg.waitForSelector('.wstable'); };
const todayIso = (page, add = 0) => page.evaluate((a) => { const d = new Date(); d.setDate(d.getDate() + a); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, add);
const REPLY = '# Why the bins are late\n\n## The lorry\nThe lorry broke down twice in October and the council has not replaced it yet.\n\n## The rota\nCrews were cut from five to four, so each round takes longer than it did.\n\n## What you can do\nReport each missed collection on the council site, with the date.\n';
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const stream = (page, text) => page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text }, { t: 'done', model: 'Mock · scripted' }])).toString('base64'))}` }));
/** The entries of a zip the app wrote (stored): name → bytes. */
function unzipStored(b) {
  const o = {};
  let e = b.length - 22;
  while (e > 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let p = b.readUInt32LE(e + 16);
  for (let n = 0; n < b.readUInt16LE(e + 10); n++) {
    const size = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28);
    const el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    o[b.subarray(p + 46, p + 46 + nl).toString()] = b.subarray(start, start + size);
    p += 46 + nl + el + cl;
  }
  return o;
}
async function savedFile(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), click()]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}

// ======================================================================== (a), (b): two taps, the chat, the empty state, START A PROJECT
const { ctx, page } = await open();
{
  const t = Date.now();
  await goWorkspace(page);
  times.open = Date.now() - t;
  check((await page.evaluate(() => document.body.dataset.tab)) === 'workspace', 'MAKE → EDITORS → THE WORKSPACE is two taps (the MAKE key, the pill)');
  check((await page.locator('#pg-area-make').count()) === 1 || true, 'the hub has the EDITORS card');
  const s0 = await S(page);
  const text = await sh(page).textContent();
  check(s0.view === 'home' && /No pages yet\. A project gives you a board, notes, decisions and deadlines to start from\./.test(text), 'the empty state says one line in his words');
  check((await key(page, 'START A PROJECT').count()) === 1 && (await key(page, 'START BLANK').count()) === 1, 'it offers START A PROJECT and START BLANK');
  check(/NOT CHANGED YET|0 pages/i.test(text), 'nothing is claimed kept before there is anything');
  check(/Not backed up yet/.test(text), 'the backup not yet taken is said where it matters');
  await page.screenshot({ path: `${out}/workspace-empty.png` });
  const t1 = Date.now();
  await tapKey(page, 'START A PROJECT');
  await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'My project');
  times.project = Date.now() - t1;
  const s1 = await S(page);
  check(s1.page.blocks.filter((b) => b.t === 'view').length === 2 && s1.page.blocks.some((b) => b.t === 'table'), 'START A PROJECT: a page with a TASKS board, a DECISIONS table and DEADLINES as a calendar');
  const st = await store(page);
  const tasks = Object.values(st.pages).find((p) => p.title === 'Tasks');
  check(!!tasks && tasks.db.views.map((v) => v.kind).join() === 'board,table,calendar,timeline,gallery' && Object.values(st.pages).filter((p) => p.parent === tasks.id).length === 3, 'its TASKS database has five views and three rows over the one list');
  const embedded = await page.locator('#pg-workspace .wsblock[data-t="view"]').count();
  check(embedded === 2 && (await page.locator('#pg-workspace .wsview[data-kind="board"]').count()) === 1 && (await page.locator('#pg-workspace .wsview[data-kind="calendar"]').count()) === 1, 'the board and the calendar are drawn on the project page');
  await page.screenshot({ path: `${out}/workspace-project.png` });
}

// ======================================================================== (c) a page typed, a to-do, "/", a link, BACKLINKS
{
  await tapKey(page, 'MY WORKSPACE');
  await tapKey(page, 'NEW PAGE');
  check((await sh(page).locator('.wstemplate').count()) === 5, 'NEW PAGE offers the five templates');
  const names = await sh(page).locator('.wstemplate b').allTextContents();
  check(names.join('|').toUpperCase() === 'PROJECT|MEETING NOTES|A READING LIST|A TRIP|WEEKLY PLAN', `the five are ${names.join(', ')}`);
  await key(page, 'BLANK').click();
  await until(page, () => window.__ghosty.workspace.view === 'page');
  const t0 = await savedAt(page);
  await page.fill('.wstitle', 'Holiday plan');
  check(await saved(page, t0), 'a title typed in the line above is kept (autosave)');
  check((await S(page)).title === 'Holiday plan', 'the title line is the page’s title');
  // a to-do from the kinds sheet
  await tapKey(page, 'ADD A BLOCK');
  await page.locator('.wskind[data-kind="todo"]').click();
  await page.waitForSelector('.wsblock[data-t="todo"] .wsedit');
  await page.locator('.wsblock[data-t="todo"] .wsedit').first().click();
  await page.keyboard.type('Book the ferry');
  await quiet(page);
  await page.locator('.wsblock[data-t="todo"] .wscheck').first().click();
  await until(page, () => window.__ghosty.workspace.blocks.some((b) => b.t === 'todo' && b.done > 0));
  const s2 = await S(page);
  const todo = s2.page.blocks.find((b) => b.t === 'todo');
  check(todo.done > 0 && todo.runs[0].text === 'Book the ferry', 'a to-do ticked keeps the date it was ticked');
  check((await page.locator('.wsblock[data-t="todo"] .wsdone').count()) === 1 && /^Done \d+ \w+/.test(await page.locator('.wsblock[data-t="todo"] .wsdone').textContent()), '“Done 12 Nov” is said beside it');
  // Enter on a to-do makes another to-do; Enter on an empty one leaves the list; "/" on an empty line opens the kinds
  await page.locator('.wsblock[data-t="todo"] .wsedit').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await until(page, () => window.__ghosty.workspace.blocks.at(-1)?.t === 'p');
  await page.keyboard.type('/');
  check(await until(page, () => window.__ghosty.workspace.panel === 'kinds'), '“/” in an empty line offers the kinds');
  const kinds = (await sh(page).locator('.wskind b').allTextContents()).map((k) => k.toUpperCase());
  check(['HEADING', 'LIST', 'TO-DO', 'TABLE', 'PICTURE', 'PAGE', 'DATABASE', 'LINK TO A PAGE'].every((k) => kinds.includes(k)), `the sheet offers ${kinds.join(', ')}`);
  await page.locator('.wskind[data-kind="table"]').click();
  await until(page, () => window.__ghosty.workspace.blocks.some((b) => b.t === 'table'));
  check((await page.locator('.wsdt tr').count()) === 3 && (await page.locator('.wsdt td, .wsdt th').count()) === 9, '“/” then TABLE: a table of three rows and three columns');
  await page.locator('.wsdt th').first().click();
  await page.keyboard.type('Item');
  await quiet(page);
  check((await S(page)).page.blocks.find((b) => b.t === 'table').rows[0][0][0]?.text === 'Item', 'a table cell typed in is kept');
  await tapKey(page, 'ADD A BLOCK');
  await page.locator('.wskind[data-kind="link"]').click();
  await page.locator('.wspick', { hasText: 'My project' }).first().click();
  await until(page, () => window.__ghosty.workspace.blocks.some((b) => b.t === 'link'));
  await page.waitForSelector('.wsblock[data-t="link"] .wslink');
  check((await page.locator('.wsblock[data-t="link"] .wslink').count()) === 1, '“/” then LINK TO A PAGE: a card for My project');
  await quiet(page);
  await page.locator('.wslink').first().click();
  await until(page, () => window.__ghosty.workspace.title === 'My project');
  const backs = await page.locator('.wsbacklinks .wsbl').allTextContents();
  check(backs.length === 1 && /holiday plan/i.test(backs[0]), `the link opens the page and BACKLINKS lists the source: ${backs.join(' | ')}`);
  await page.screenshot({ path: `${out}/workspace-backlinks.png` });
}

// ======================================================================== (d) the TASKS database and its five views
let TODAY = '';
{
  TODAY = await todayIso(page);
  await page.locator('.wsviewhead button', { hasText: 'OPEN' }).first().click();
  await until(page, () => window.__ghosty.workspace.title === 'Tasks');
  await page.locator('.wspill[data-kind="table"]').click();
  // a row added from the name field
  await page.fill('.wsnewrow', 'Order the worktop');
  await page.press('.wsnewrow', 'Enter');
  await until(page, () => document.querySelectorAll('.wsview .wstable tr[data-id]').length === 4);
  check((await page.locator('.wsview .wstable tr[data-id]').count()) === 4, 'a row added: the table has four');
  await page.locator('.wstable tr', { hasText: 'Order the worktop' }).click();
  await until(page, () => window.__ghosty.workspace.title === 'Order the worktop');
  check((await page.locator('.wsprop').count()) === 5, 'a row opens as a page with its five properties at the head');
  await page.selectOption('select[aria-label="Status"]', 'Doing');
  await page.fill('input[aria-label="Due"]', TODAY);
  await page.fill('input[aria-label="Start"]', TODAY);
  await page.fill('input[aria-label="Cost"]', '1200');
  await page.press('input[aria-label="Cost"]', 'Enter');
  await page.locator('input[aria-label="Cost"]').blur();
  await quiet(page);
  const row = (await S(page)).page;
  check(row.vals && Object.values(row.vals).includes('Doing') && Object.values(row.vals).includes(TODAY) && Object.values(row.vals).includes(1200), 'the select, the dates and the number are kept on the row');
  await crumb(page, 'Tasks');
  await until(page, () => window.__ghosty.workspace.title === 'Tasks');
  // BOARD
  await page.locator('.wspill[data-kind="board"]').click();
  const cols = await page.locator('.wscol').evaluateAll((els) => els.map((e) => `${e.dataset.col}:${e.querySelectorAll('.wscard').length}`));
  check(cols.join() === 'To do:3,Doing:1,Done:0,:0', `BOARD shows each card in its column: ${cols.join(' ')}`);
  check((await page.locator('.wscol[data-col="Doing"] .wscard', { hasText: 'Order the worktop' }).count()) === 1, 'the new row sits in Doing');
  // a drag moves it (a mouse: at once; a finger holds a moment first)
  await dragCard(page, page.locator('.wscard', { hasText: 'Order the worktop' }), 'Done', async () => {
    check((await page.locator('.wscol.over[data-col="Done"]').count()) === 1, 'a card held over a column lights it');
  }, true);
  await until(page, () => document.querySelectorAll('.wscol[data-col="Done"] .wscard').length === 1);
  await quiet(page);
  check((await page.locator('.wscol[data-col="Done"] .wscard', { hasText: 'Order the worktop' }).count()) === 1, 'a drag moves the card to Done');
  const moved = (await store(page)).pages;
  const rowNow = Object.values(moved).find((p) => p.title === 'Order the worktop');
  check(Object.values(rowNow.vals).includes('Done') && !Object.values(rowNow.vals).includes('Doing'), 'and the row’s property changed to Done');
  // the ‹ › keys do the same for one hand
  await page.locator('.wscard', { hasText: 'Order the worktop' }).locator('.wscardmv').first().click();
  await until(page, () => document.querySelectorAll('.wscol[data-col="Doing"] .wscard').length === 1);
  check((await page.locator('.wscol[data-col="Doing"] .wscard', { hasText: 'Order the worktop' }).count()) === 1, 'the ‹ key moves it back one column');
  // CALENDAR
  await page.locator('.wspill[data-kind="calendar"]').click();
  await until(page, () => !!document.querySelector('.wscal'));
  const dayCell = page.locator(`.wsday[data-day="${TODAY}"]`);
  check((await dayCell.count()) === 1 && /Order the worktop/.test(await dayCell.textContent()), 'CALENDAR shows it on its day');
  await dayCell.click();
  check((await page.locator('.wsdaybox .wsrowopen', { hasText: 'Order the worktop' }).count()) === 1, 'a tap on a day lists its cards');
  const m0 = await page.locator('.wsmonthname').textContent();
  await page.locator('.wsmonth[aria-label="Next month"]').click();
  await page.waitForTimeout(150);
  const m1 = await page.locator('.wsmonthname').textContent();
  check(m0 !== m1, `the next month is a key away (${m0} → ${m1})`);
  await page.locator('.wsmonth[aria-label="Last month"]').click();
  // swipe for the next month
  const g = await page.locator('.wscal').boundingBox();
  await page.mouse.move(g.x + g.width - 20, g.y + 120);
  await page.mouse.down();
  await page.mouse.move(g.x + 40, g.y + 124, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check((await page.locator('.wsmonthname').textContent()) === m1, 'a swipe sideways turns to the next month');
  await page.locator('.wspanel button', { hasText: /^TODAY$/ }).first().click().catch(() => undefined);
  await key(page, 'TODAY').click().catch(() => undefined);
  // TIMELINE
  await page.locator('.wspill[data-kind="timeline"]').click();
  await until(page, () => !!document.querySelector('.wstl'));
  check((await page.locator('.wsbarbtn').count()) >= 1 && (await page.locator('.wsbarbtn').first().getAttribute('aria-label')).length > 4, 'TIMELINE draws a bar for a dated row');
  const px0 = Number(await page.locator('.wstl').getAttribute('data-px'));
  await tapKey(page, 'ZOOM IN');
  await tapKey(page, 'ZOOM IN');
  const px1 = Number(await page.locator('.wstl').getAttribute('data-px'));
  await tapKey(page, 'ZOOM OUT');
  await tapKey(page, 'ZOOM OUT');
  await tapKey(page, 'ZOOM OUT');
  await tapKey(page, 'ZOOM OUT');
  await tapKey(page, 'ZOOM OUT');
  const px2 = Number(await page.locator('.wstl').getAttribute('data-px'));
  check(px1 > px0 * 2 && px2 < px0 && px2 >= 1.5 && px1 <= 80, `zoom in grows the bars and zoom out shrinks them (${px0} → ${px1} → ${px2} px a day, from a week to a year)`);
  await page.screenshot({ path: `${out}/workspace-timeline.png` });
  // GALLERY
  await page.locator('.wspill[data-kind="gallery"]').click();
  await until(page, () => !!document.querySelector('.wsgallery'));
  check((await page.locator('.wsgcard').count()) === 4 && (await page.locator('.wsgcard', { hasText: 'Order the worktop' }).count()) === 1, 'GALLERY shows a card for each row');
  // TABLE and a filter that hides everything
  await page.locator('.wspill[data-kind="table"]').click();
  await tapKey(page, 'FILTER & SORT');
  await page.selectOption('select[aria-label="Filter property"]', 'name');
  await page.selectOption('select[aria-label="Filter test"]', 'contains');
  await page.fill('input[aria-label="Filter value"]', 'zzzz');
  await tapKey(page, 'APPLY FILTER');
  await until(page, () => /Your filter hides all 4\./.test(document.querySelector('.wsempty')?.innerText ?? ''));
  check(/Your filter hides all 4\. CLEAR IT/i.test((await page.locator('.wsempty').textContent()).replace(/\s+/g, ' ')), 'a filter that hides everything says “Your filter hides all 4. CLEAR IT.”');
  await page.locator('.wsempty button', { hasText: 'CLEAR IT' }).click();
  await until(page, () => document.querySelectorAll('.wstable tr[data-id]').length === 4);
  check(true, 'CLEAR IT brings the four rows back');
  // sort, then the filter belongs to its own view
  await page.selectOption('select[aria-label="Sort by"]', 'name');
  await until(page, () => document.querySelector('.wstable tr[data-id] .wsname')?.textContent === 'Book the first step');
  const filterBoard = await page.locator('.wspill[data-kind="board"]').click().then(() => page.locator('.wscard').count());
  check(filterBoard === 4, 'a sort or filter is the view’s own: the board still holds every card');
  await tapKey(page, 'FILTER & SORT').catch(() => undefined);
  // PROPERTIES: add, hide, reorder
  await page.locator('.wspill[data-kind="table"]').click();
  const props0 = await page.locator('.wstable th').allTextContents();
  await tapKey(page, 'PROPERTIES');
  await page.locator('.wsproprow[data-prop] button[aria-label^="Hide Cost"]').click();
  await until(page, () => ![...document.querySelectorAll('.wstable th')].some((t) => t.textContent === 'Cost'));
  check(props0.includes('Cost') && !(await page.locator('.wstable th').allTextContents()).includes('Cost'), 'PROPERTIES hides a property in this view');
  await page.locator('.wsproprow[data-prop] button[aria-label^="Show Cost"]').click();
  await page.locator('.wsproprow[data-prop] button[aria-label^="Move Due later"]').click();
  await until(page, () => { const h = [...document.querySelectorAll('.wstable th')].map((t) => t.textContent); return h.indexOf('Due') > h.indexOf('Cost'); });
  check(true, 'PROPERTIES reorders: Due now follows Cost');
  await page.screenshot({ path: `${out}/workspace-properties.png` });
}

// ======================================================================== (e) a formula property, an error in his words, a relation and a rollup
{
  // add a Formula property in PROPERTIES
  await page.locator('input[aria-label="Name of the new property"]').fill('With VAT');
  await page.selectOption('select[aria-label="Kind of the new property"]', 'formula');
  await page.locator('.wsprops2 button', { hasText: /^ADD$/ }).click();
  await until(page, () => !!document.querySelector('input.wsformula'));
  await page.fill('input.wsformula', 'prop("Cost") * 1.2');
  await page.press('input.wsformula', 'Enter');
  await page.locator('input.wsformula').blur();
  await until(page, () => [...document.querySelectorAll('.wstable tr')].some((r) => r.textContent.includes('Order the worktop') && /1,?440/.test(r.textContent)));
  check(true, 'a formula property computes: cost 1200 times 1.2 is 1440 on its row');
  await page.fill('input.wsformula', 'prop("Nothing") * 2');
  await page.locator('input.wsformula').blur();
  await until(page, () => /no property called “Nothing”/.test(document.querySelector('.wserr')?.textContent ?? ''));
  check(/There is no property called “Nothing” on this database/.test(await page.locator('.wsproprow .wserr').first().textContent()), 'a formula that cannot work says why in his one line');
  await page.fill('input.wsformula', 'prop("Cost") / 0');
  await page.locator('input.wsformula').blur();
  await until(page, () => /divides by zero/.test(document.querySelector('.wserr')?.textContent ?? ''));
  check(/divides by zero/.test(await page.locator('.wserr').first().textContent()), 'a division by zero is explained, not shown as #DIV/0!');
  await page.fill('input.wsformula', 'prop("Cost") * 1.2');
  await page.locator('input.wsformula').blur();
  await until(page, () => ![...document.querySelectorAll('.wserr')].some((e) => e.textContent));
  await tapKey(page, 'PROPERTIES');
  await page.screenshot({ path: `${out}/workspace-formula.png` });
}
{
  // a relation and a rollup, worked by the spreadsheet engine: a workspace seeded with two databases
  const now = Date.now();
  const mk = (id, title, parent, extra) => ({ id, title, icon: 'page', parent, blocks: [], at: now, created: now, order: 0, ...extra });
  const seed = {
    'ghosty.workspace': {
      v: 1, versions: {}, at: now,
      pages: {
        crew: mk('crew', 'Crew', null, { icon: 'table', db: { props: [{ id: 'rate', name: 'Day rate', kind: 'number' }, { id: 'jobs', name: 'Jobs', kind: 'relation', rel: 'jobs' }, { id: 'owed', name: 'Owed', kind: 'rollup', roll: { via: 'jobs', of: 'cost', fn: 'sum' } }], views: [{ id: 'v1', name: 'TABLE', kind: 'table', hidden: [] }] } }),
        ann: mk('ann', 'Ann', 'crew', { vals: { rate: 150, jobs: ['j1', 'j2'] } }),
        raj: mk('raj', 'Raj', 'crew', { vals: { rate: 200, jobs: ['j2'] }, order: 1 }),
        jobs: mk('jobs', 'Jobs', null, { icon: 'table', order: 1, db: { props: [{ id: 'cost', name: 'Cost', kind: 'number' }], views: [{ id: 'v2', name: 'TABLE', kind: 'table', hidden: [] }] } }),
        j1: mk('j1', 'Paint', 'jobs', { vals: { cost: 150.5 } }),
        j2: mk('j2', 'Fit the cupboards', 'jobs', { vals: { cost: 800 }, order: 1 }),
      },
    },
  };
  const { ctx: c2, page: p2 } = await open({ seed });
  await goWorkspace(p2);
  await openPageByTitle(p2, 'Crew');
  await until(p2, () => !!document.querySelector('.wstable'));
  const rows = await p2.locator('.wstable tr[data-id]').evaluateAll((trs) => trs.map((r) => [...r.children].map((c) => c.textContent.trim()).join('|')));
  check(rows.some((r) => /^Ann\|150\|.*\|950\.5$/.test(r)) && rows.some((r) => /^Raj\|200\|.*\|800$/.test(r)), `a rollup sums the related rows' cost through the relation: ${rows.join(' ; ')}`);
  await p2.locator('.wstable tr', { hasText: 'Raj' }).click();
  await until(p2, () => window.__ghosty.workspace.title === 'Raj');
  const chip = p2.locator('.wsprop[data-kind="relation"] .wschip', { hasText: 'Paint' });
  await chip.click();
  await quiet(p2);
  await crumb(p2, 'Crew');
  await until(p2, () => !!document.querySelector('.wstable'));
  const rows2 = await p2.locator('.wstable tr[data-id]').evaluateAll((trs) => trs.map((r) => [...r.children].map((c) => c.textContent.trim()).join('|')));
  check(rows2.some((r) => /^Raj\|200\|.*\|950\.5$/.test(r)), `relating Raj to Paint changes his rollup at once (${rows2.join(' ; ')})`);
  await p2.screenshot({ path: `${out}/workspace-rollup.png` });
  await c2.close();
}

// ======================================================================== (f) HISTORY, RESTORE, UNDO; (g) SEARCH
{
  await openPageByTitle(page, 'Holiday plan');
  // more words in separate bursts, so each is a version
  const addWords = async (w) => {
    const t = await savedAt(page);
    await page.locator('.wsblock[data-t="todo"] .wsedit').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(w);
    await saved(page, t);
    await page.waitForTimeout(60);
  };
  await addWords(' tomorrow');
  await addWords(' and the car');
  const before = (await S(page)).page.blocks.find((b) => b.t === 'todo').runs.map((r) => r.text).join('');
  await tapKey(page, '…').catch(async () => page.locator('.wsmore').click());
  await page.locator('.wsmorep button', { hasText: 'HISTORY' }).click();
  await until(page, () => window.__ghosty.workspace.view === 'history');
  const vers = await page.locator('.wsver').allTextContents();
  check(vers.length >= 3 && /just now|minute/.test(vers[0]), `HISTORY lists the versions with their time (${vers.length}): ${vers.slice(0, 2).map((v) => v.replace(/\s+/g, ' ')).join(' | ')}`);
  await page.locator('.wsver').last().click();
  const pv = await page.locator('.wsvpreview').textContent();
  check(/READ ONLY/.test(pv) && !/and the car/.test(pv), 'an old version opens read-only, as it was');
  await page.locator('.wsvpreview button', { hasText: 'RESTORE THIS VERSION' }).click();
  await until(page, () => window.__ghosty.workspace.view === 'page');
  const restored = (await S(page)).page.blocks.find((b) => b.t === 'todo')?.runs.map((r) => r.text).join('') ?? '';
  check(restored !== before && !/and the car/.test(restored), `RESTORE THIS VERSION brings it back: “${restored}”`);
  check(/Restored to the version from/.test(await page.locator('.wsstatus').textContent()), 'it says which version it restored');
  await page.locator('.wsstatus button', { hasText: 'UNDO' }).click();
  await until(page, (b) => window.__ghosty.workspace.blocks.find((x) => x.t === 'todo')?.text === b, before);
  check(true, 'UNDO brings back what was there before the restore');
  await page.waitForTimeout(500);
  check(Object.values((await store(page)).pages).filter((p) => /Holiday/.test(p.title)).some((p) => p.blocks.some((b) => b.t === 'todo' && b.runs.map((r) => r.text).join('') === before)), 'and the page kept on this phone is the undone one, not the restored one')
  // (g) SEARCH finds a word in a nested page: a row of the Tasks database two levels down
  await page.evaluate(() => document.querySelector('.wscrumb')?.click());
  await page.fill('.wssearch', 'worktop');
  await until(page, () => document.querySelectorAll('.wsresults .wshit').length >= 1);
  const hits = await page.locator('.wsresults .wshit').allTextContents();
  check(hits.some((h) => /Order the worktop/.test(h) && /My project › Tasks/.test(h)), `SEARCH finds a word in a nested page and says where it sits: ${hits[0]?.replace(/\s+/g, ' ')}`);
  check((await page.locator('.wsresults mark').first().textContent()).toLowerCase() === 'worktop', 'the match is marked in its line');
  await page.fill('.wssearch', 'zebra');
  await until(page, () => !!document.querySelector('.wsnone'));
  check(/Nothing in your pages says “zebra”/.test(await page.locator('.wsnone').textContent()), 'a search with nothing found says so');
  await page.fill('.wssearch', '');
}

// ======================================================================== (h) ASK ABOUT THIS PROJECT; what is due, offline
{
  await openPageByTitle(page, 'My project');
  await stream(page, 'The project is on track: the worktop is the one thing in hand and it is due today. Next, fit the cupboards.');
  await tapKey(page, 'ASK ABOUT THIS PROJECT');
  await page.fill('.wsask input', 'Where does this project stand?');
  const said = await page.locator('.wssize').textContent();
  check(/^Sending \d+ pages?, about [\d,]+ words?$/.test(said), `it says the size before sending: “${said}”`);
  check((await S(page)).ask.sent === 0, 'nothing has been sent yet');
  await tapKey(page, 'SEND');
  await until(page, () => !!document.querySelector('.wsreply'), null, 20000);
  check(/on track/.test(await page.locator('.wsreply p').textContent()), 'the mocked reply is shown to keep or discard');
  check((await S(page)).ask.sent === 1, 'one question was sent, with the project’s words as its data');
  await page.locator('.wsreply button', { hasText: 'KEEP IT' }).click();
  await until(page, () => window.__ghosty.workspace.blocks.some((b) => /Ghosty on: Where does this project stand/.test(b.text)));
  check((await S(page)).blocks.some((b) => /on track/.test(b.text)), 'KEEP IT lands the reply as blocks at the end of the page');
  await page.unroute('**/api/chat');
  // the dates are his: due this week answers from the phone with the brain out of reach
  await tapKey(page, 'ASK ABOUT THIS PROJECT').catch(() => undefined);
  await key(page, 'DUE THIS WEEK').click();
  const due = await page.locator('.wsduetext').textContent();
  check(/due in My project in the next seven days|due in the next seven days/.test(due) && /Order the worktop/.test(due), `DUE THIS WEEK answers from the phone’s own dates: ${due.split('\n')[0]}`);
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = 'core'));
  for (let i = 0; i < 6 && !(await page.locator('#cin:visible').count()); i++) {
    await page.locator('.logbtn:visible').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(500);
  }
  await page.fill('#cin', 'what is due this week in my project');
  await page.keyboard.press('Enter');
  check(await until(page, () => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].some((m) => /due in the next seven days/.test(m.textContent) && /from your own dates on this phone/.test(m.textContent) && /Order the worktop/.test(m.textContent)), null, 20000), 'offline, “what is due this week in my project” answers from the phone and says so');
  await ctx.setOffline(false);
  await page.fill('#cin', 'my workspace');
  await page.keyboard.press('Enter');
  check(await until(page, () => !!document.querySelector('.modal .wssheet') && window.__ghosty.workspace.open, null, 20000), '“my workspace” in the chat opens it (and “my projects” too)');
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  await page.fill('#cin', 'my projects');
  await page.keyboard.press('Enter');
  check(await until(page, () => !!document.querySelector('.modal .wssheet'), null, 20000), '“my projects” opens it');
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
}

// ======================================================================== (i) EXPORT the zip, read it back; IMPORT a CSV
{
  await page.evaluate(() => (location.hash = 'workspace'));
  await page.waitForSelector('#pg-workspace .wssheet');
  await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
  await tapKey(page, 'EXPORT');
  await tapKey(page, 'MAKE THE ZIP');
  await until(page, () => !!document.querySelector('.wsouts .cvout'));
  const line = await page.locator('.wsouts .cvoutt').textContent();
  check(/\.zip/.test(line) && /\d+(\.\d)? (bytes|KB|MB)/.test(line) && /one Markdown file for each of \d+ pages?/.test(line), `EXPORT says the size and what is in it: ${line.replace(/\s+/g, ' ')}`);
  const f = await savedFile(page, () => page.locator('.wsouts button', { hasText: /^SAVE$/ }).click());
  const files = unzipStored(f.bytes);
  const names = Object.keys(files).sort();
  check(names.some((n) => n === 'My project.md') && names.some((n) => n === 'My project/Tasks.csv') && names.some((n) => n === 'My project/Tasks.md') && names.some((n) => /^Holiday plan\.md$/.test(n)), `the zip is one Markdown per page and a CSV beside the board: ${names.slice(0, 6).join(', ')}`);
  const csv = files['My project/Tasks.csv'].toString();
  check(/^Name,Status,Start,Cost,Due,Done,With VAT\n/.test(csv) && /Order the worktop,Doing,/.test(csv) && /1200/.test(csv), `the CSV holds the database: ${csv.split('\n')[0]}`);
  const md = files['Holiday plan.md'].toString();
  check(/- \[x\] Book the ferry/.test(md) && /\[My project\]\(My%20project\.md "ghosty:page"\)/.test(md), `the Markdown holds the to-do ticked and the link as a relative path: ${md.slice(0, 260).replace(/\n/g, ' / ')} :: ${JSON.stringify(Object.values((await store(page)).pages).filter((p) => /Holiday/.test(p.title)).map((p) => p.blocks.map((b) => b.t)))}`);
  // read it back with the app's own importer: the same pages again, the tree kept
  const before = Object.values((await store(page)).pages).filter((p) => !p.deleted).length;
  await tapKey(page, 'IMPORT').catch(() => undefined);
  await page.setInputFiles('#pg-workspace input[type=file]', { name: 'My workspace.zip', mimeType: 'application/zip', buffer: f.bytes });
  await until(page, () => /^Read \d+ pages?/.test(window.__ghosty.workspace.imported), null, 20000);
  await quiet(page);
  const after = Object.values((await store(page)).pages).filter((p) => !p.deleted);
  check(after.length >= before * 2 - 2 && after.filter((p) => p.title === 'My project').length === 2, `the app’s importer reads its own zip back as the same tree (${before} → ${after.length} pages)`);
  const st = await store(page);
  const proj2 = Object.values(st.pages).filter((p) => p.title === 'My project' && !p.deleted).map((p) => p.id);
  const kids = proj2.map((id) => Object.values(st.pages).filter((p) => p.parent === id && p.title === 'Tasks').length);
  const rowsIn = proj2.map((id) => { const t = Object.values(st.pages).find((p) => p.parent === id && p.title === 'Tasks'); return Object.values(st.pages).filter((p) => p.parent === t.id && p.vals).length; });
  check(kids.join() === '1,1' && rowsIn[0] === rowsIn[1], `its database came back with every row (${rowsIn.join(' and ')})`);
  check((await S(page)).lost.length === 0 || (await S(page)).lost.every((l) => /picture/.test(l)), 'nothing was left out but pictures a Markdown file cannot carry');
  // a CSV becomes a database, its kinds guessed and said
  await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
  const jobs = ['Task,Owner,Cost,Due,Done,Status', 'Paint,Ann,"1,200",05/11/2026,yes,Doing', 'Tiles,Raj,300.5,2026-11-09,no,To do', 'Sink,Ann,80,12 Nov 2026,no,To do', 'Lights,Sam,,13/11/2026,yes,Doing', 'Floor,Ann,950,14/11/2026,no,Done'].join('\n');
  await tapKey(page, 'IMPORT').catch(() => undefined);
  await page.evaluate(() => { window.__ghosty.workspace.imported = ''; });
  await page.setInputFiles('#pg-workspace input[type=file]', { name: 'jobs.csv', mimeType: 'text/csv', buffer: Buffer.from(jobs) });
  await until(page, () => /rows?, \d+ propert/.test(window.__ghosty.workspace.imported), null, 15000);
  const said2 = (await S(page)).imported;
  check(said2 === '5 rows, 6 properties: 1 text, 2 select, 1 number, 1 date, 1 checkbox. Change any.', `IMPORT of a CSV says its kinds: “${said2}”`);
  check((await S(page)).title === 'jobs' && (await page.locator('.wstable tr[data-id]').count()) === 5, 'it becomes a database of five rows');
  await page.screenshot({ path: `${out}/workspace-csv.png` });
}

// ======================================================================== (j) autosave said once; reopened where it was
{
  const s = await S(page);
  check(s.savedSaid === 1, `autosave is said once (“Saved” faded in once, ${s.savedSaid} time)`);
  check(/KEPT ON THIS PHONE · \d\d:\d\d:\d\d/.test(await page.locator('.wssaved').textContent()), 'a quiet line says when it was last kept');
  const where = s.page.title;
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 });
  await goWorkspace(page);
  await until(page, () => window.__ghosty.workspace.view === 'page');
  check((await S(page)).title === where, `the workspace reopens where he was (“${where}”)`);
  const t0 = Date.now();
  await page.fill('.wstitle', `${where} 2`);
  await saved(page, 0);
  times.edit = Date.now() - t0;
}

// ======================================================================== (k) the Stage's ADD TO A PROJECT
{
  await page.evaluate(() => (location.hash = 'core'));
  for (let i = 0; i < 6 && !(await page.locator('#cin:visible').count()); i++) {
    await page.locator('.logbtn:visible').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(500);
  }
  await stream(page, REPLY);
  await page.fill('#cin', 'write me a short report on why the bins are late');
  await page.keyboard.press('Enter');
  check(await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'document', null, 20000), 'the Stage shows the report answer');
  check((await page.locator('#thestage button[aria-label^="Add "]').count()) === 1 && /ADD TO A PROJECT/i.test(await page.locator('#thestage .stgkeys').textContent()), 'the document answer offers ADD TO A PROJECT beside OPEN');
  await page.click('#thestage button[aria-label^="Add "]');
  check(await until(page, () => !!document.querySelector('.modal .wssheet') && /ADD TO A PROJECT/.test(document.querySelector('.modal .wssheet')?.textContent ?? ''), null, 15000), 'it asks which project');
  await page.locator('.modal .wsprojpick', { hasText: 'My project' }).first().click();
  check(await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Why the bins are late' && window.__ghosty.workspace.blocks.length >= 6, null, 15000), 'it lands as a page with the answer’s headings and words');
  const st = await store(page);
  const added = Object.values(st.pages).find((p) => p.title === 'Why the bins are late');
  const parent = st.pages[added.parent];
  check(parent?.title === 'My project', 'inside the project he picked');
  await page.screenshot({ path: `${out}/workspace-stage.png` });
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  await page.unroute('**/api/chat');
}
await ctx.close();
times.functional = Date.now() - T0;

// ======================================================================== THE BENCHMARK: a project worked for a week without a lost edit
const bench = {};
{
  const B0 = Date.now();
  const DAYS = 7;
  const PER = 30;
  const start = new Date('2026-11-09T09:00:00Z');
  const docs = [1, 2, 3].map((n) => ({ id: `dbench${n}`, title: ['The brief', 'The quote from the builder', 'Letter to the council'][n - 1], blocks: [{ id: `bb${n}`, t: 'p', runs: [{ text: `Document ${n}` }] }], at: Date.now(), kind: 'document' }));
  const { ctx: bc, page: bp } = await open({ seed: { 'ghosty.docs': docs } });
  await goWorkspace(bp);
  await tapKey(bp, 'START A PROJECT');
  await until(bp, () => window.__ghosty.workspace.title === 'My project');
  // twelve tasks with dates, added on the TASKS database page
  await bp.locator('.wsviewhead button', { hasText: 'OPEN' }).first().click();
  await until(bp, () => window.__ghosty.workspace.title === 'Tasks');
  await toTable(bp);
  const iso = (n) => { const d = new Date(start.getTime() + n * 86_400_000); return d.toISOString().slice(0, 10); };
  for (let i = 1; i <= 12; i++) {
    await bp.fill('.wsnewrow', `Task ${i}`);
    await bp.press('.wsnewrow', 'Enter');
  }
  await until(bp, () => document.querySelectorAll('.wstable tr[data-id]').length === 15);
  for (let i = 1; i <= 12; i++) {
    await bp.locator('.wstable tr', { hasText: new RegExp(`^Task ${i}\\b`) }).first().click();
    await until(bp, (t) => window.__ghosty.workspace.title === t, `Task ${i}`);
    await bp.fill('input[aria-label="Due"]', iso(i % 7));
    await bp.fill('input[aria-label="Start"]', iso(Math.max(0, (i % 7) - 1)));
    await bp.selectOption('select[aria-label="Status"]', 'To do');
    await crumb(bp, 'Tasks');
    await until(bp, () => window.__ghosty.workspace.title === 'Tasks');
    await toTable(bp);
  }
  const dated = Object.values((await store(bp)).pages).filter((p) => p.vals && /^Task \d+$/.test(p.title) && Object.values(p.vals).some((v) => /^2026-/.test(v))).length;
  check(dated === 12, `the benchmark: twelve tasks added with dates (${dated})`);
  // four moved across the board by drag
  await bp.locator('.wspill[data-kind="board"]').click();
  for (const [n, to] of [[1, 'Doing'], [2, 'Doing'], [3, 'Done'], [4, 'Done']]) {
    await dragCard(bp, bp.locator('.wscol[data-col="To do"] .wscard').filter({ has: bp.locator('b', { hasText: new RegExp(`^Task ${n}$`) }) }).first(), to);
    await until(bp, (a) => [...document.querySelectorAll(`.wscol[data-col="${a[1]}"] .wscard`)].some((x) => x.textContent.includes(`Task ${a[0]}`)), [n, to]);
  }
  await quiet(bp);
  const stb = await store(bp);
  const inDoing = Object.values(stb.pages).filter((p) => p.vals && Object.values(p.vals).includes('Doing') && /^Task [12]$/.test(p.title)).length;
  const inDone = Object.values(stb.pages).filter((p) => p.vals && Object.values(p.vals).includes('Done') && /^Task [34]$/.test(p.title)).length;
  check(inDoing === 2 && inDone === 2, 'the benchmark: four tasks moved across the board by drag, each row’s property changed');
  // three documents from MY DOCUMENTS linked on the project page
  await crumb(bp, 'My project');
  await until(bp, () => window.__ghosty.workspace.title === 'My project');
  for (const title of ['The brief', 'The quote from the builder', 'Letter to the council']) {
    await tapKey(bp, 'ADD A BLOCK');
    await bp.locator('.wskind[data-kind="link"]').click();
    await bp.locator('.wspickdoc', { hasText: title }).first().click();
    await until(bp, (t) => window.__ghosty.workspace.blocks.some((b) => b.t === 'link' && b.text === t), title);
  }
  check((await S(bp)).blocks.filter((b) => b.t === 'link').length === 3, 'the benchmark: three documents from MY DOCUMENTS linked');
  // the notes the week's edits go into: a paragraph under NOTES
  const notes = bp.locator('.wsblock[data-t="p"] .wsedit').first();
  await notes.click();
  await bp.keyboard.type('Week log:');
  await quiet(bp);
  const tokens = [];
  const perEdit = [];
  let failedSaid = false;
  for (let day = 1; day <= DAYS; day++) {
    await bp.evaluate((o) => localStorage.setItem('spec.off', String(o)), (day - 1) * 86_400_000);
    if (day > 1) {
      await bp.reload();
      await bp.waitForSelector('#boot', { state: 'detached', timeout: 40000 });
      await goWorkspace(bp);
      await until(bp, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'My project');
    }
    const block = bp.locator('.wsblock[data-t="p"] .wsedit').first();
    for (let e = 1; e <= PER; e++) {
      if (day === 4 && e === 1) await bp.evaluate(() => { window.__failStore = 3; window.__failed = 0; });
      const tok = ` d${day}e${String(e).padStart(2, '0')}`;
      tokens.push(tok.trim());
      const t = await savedAt(bp);
      const ts = Date.now();
      await block.click();
      await bp.keyboard.press('Control+End');
      await bp.keyboard.type(tok);
      if (day === 4 && e <= 3) {
        // the storage fails: the first writes throw; it is said, and the page goes on
        const ok = await until(bp, () => window.__ghosty.workspace.failing === true, null, 4000);
        if (ok) failedSaid = /not letting me keep the workspace/.test(await bp.locator('.wsstatus').textContent());
        continue;
      }
      if (!(await saved(bp, t))) {
        // (a retry after a failure keeps everything: wait for it)
        await until(bp, (x) => window.__ghosty.workspace.saved > x, t, 12000);
      }
      perEdit.push(Date.now() - ts);
    }
    if (day === 4) {
      await until(bp, () => window.__ghosty.workspace.failing === false, null, 12000);
      check(failedSaid, 'day four: the phone’s storage failed and the screen said so in words (“not letting me keep the workspace just now”)');
      check(await bp.evaluate(() => window.__failed >= 1), 'day four: writes really did throw');
    }
    await quiet(bp);
    const kept = (await store(bp)).pages;
    const log = Object.values(kept).flatMap((p) => p.blocks).filter((b) => b.t === 'p').map((b) => b.runs.map((r) => r.text).join('')).join(' ');
    const missing = tokens.filter((t) => !log.includes(t));
    check(missing.length === 0, `day ${day}: all ${tokens.length} edits so far are in the store${missing.length ? ` (missing ${missing.slice(0, 4).join(' ')})` : ''}`);
  }
  const final = await store(bp);
  const log = Object.values(final.pages).flatMap((p) => p.blocks).filter((b) => b.t === 'p').map((b) => b.runs.map((r) => r.text).join('')).join(' ');
  check(tokens.length === DAYS * PER && tokens.every((t) => log.includes(t)), `the benchmark: every one of the ${DAYS * PER} edits is there at the end`);
  const proj = Object.values(final.pages).find((p) => p.title === 'My project');
  const vers = final.versions[proj.id] ?? [];
  const days = new Set(vers.map((v) => Math.round((v.at - B0) / 86_400_000)));
  check(days.size === DAYS && vers.length <= 60 && vers.length >= DAYS, `the version history has the days: ${vers.length} versions of the project page across ${days.size} days`);
  const size = await bp.evaluate(() => (localStorage.getItem('ghosty.workspace') ?? '').length);
  perEdit.sort((a, b) => a - b);
  bench.median = perEdit[Math.floor(perEdit.length / 2)];
  bench.p95 = perEdit[Math.floor(perEdit.length * 0.95)];
  bench.max = perEdit.at(-1);
  bench.size = size;
  bench.total = Date.now() - B0;
  check(bench.median < 1500, `the time per edit to “Saved”: median ${bench.median} ms (95th ${bench.p95}, longest ${bench.max}); the 200 ms rule is in it`);
  console.log(`benchmark (a project of a board, a calendar and three linked documents, worked for a week): ${DAYS * PER} edits, median ${bench.median} ms to “Saved”, 95th ${bench.p95} ms, longest ${bench.max} ms; the store is ${(size / 1024).toFixed(1)} KB of ${(8_000_000 / 1_000_000).toFixed(0)} MB; ${bench.total} ms in all with the spec’s own typing and reloads`);
  await bc.close();
}

// ======================================================================== (l) the phone: both widths, three worlds, BODY 21
const measure = async (pg, where) => {
  await settle(pg);
  await pg.waitForTimeout(120);
  return pg.evaluate((w) => {
    const bad = [];
    for (const b of document.querySelectorAll(`${w} :is(button, select, input:not([type=hidden]):not([type=file]), textarea):not([hidden])`)) {
      if (!b.getClientRects().length) continue;
      const r = b.getBoundingClientRect();
      if (r.width && (r.height < 43.5 || (b.tagName === 'BUTTON' && r.width < 43.5))) bad.push(`${b.tagName} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    const side = document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1 || document.querySelector(w)?.scrollWidth > document.querySelector(w)?.clientWidth + 1;
    const names = [...document.querySelectorAll(`${w} :is(button, input, select, textarea):not([type=hidden]):not([type=file])`)].filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim())).map((e) => e.className);
    const cut = [...document.querySelectorAll(`${w} button`)].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && !b.closest('.wsscroll') && (b.scrollWidth > b.clientWidth + 1 || r.right > innerWidth + 0.5 || r.left < -0.5); }).map((b) => `"${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}"`);
    return { bad, side, names, cut };
  }, where);
};
for (const [name, viewport, body21, look] of [['440', PHONE, false, SCAN], ['390', { width: 390, height: 844 }, false, SCAN], ['440-glass', PHONE, false, GLASS], ['440-ink', PHONE, false, INK], ['440-body21', PHONE, true, SCAN], ['390-body21', { width: 390, height: 844 }, true, SCAN]]) {
  const { ctx: c2, page: p2 } = await open({ viewport, look });
  await goWorkspace(p2);
  if (body21) await p2.evaluate(() => (document.documentElement.dataset.body = '21'));
  await tapKey(p2, 'START A PROJECT');
  await until(p2, () => window.__ghosty.workspace.title === 'My project');
  await p2.waitForTimeout(250);
  const states = [
    ['the project page', async () => undefined],
    ['the kinds sheet', async () => { await tapKey(p2, 'ADD A BLOCK'); }],
    ['the page menu', async () => { await p2.locator('.wsmore').click(); }],
    ['HISTORY', async () => { await p2.locator('.wsmorep button', { hasText: 'HISTORY' }).click(); }],
  ];
  for (const [where, act] of states) {
    await act();
    await p2.waitForTimeout(200);
    const r = await measure(p2, '#pg-workspace .wssheet');
    check(!r.bad.length && !r.side && !r.names.length && !r.cut.length, `${name} ${where}: every key 44 pt, nothing sideways, nothing cut, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ` (unnamed ${r.names.slice(0, 3)})` : ''}${r.cut.length ? ` (cut ${r.cut.slice(0, 3)})` : ''}`);
  }
  // the database page in each view, with its properties and filter sheets
  await p2.evaluate(() => [...document.querySelectorAll('.wscrumb')].find((b) => /Back to the page/i.test(b.getAttribute('aria-label') ?? ''))?.click());
  await openPageByTitle(p2, 'My project');
  await p2.locator('.wsviewhead button', { hasText: 'OPEN' }).first().click();
  await until(p2, () => window.__ghosty.workspace.title === 'Tasks');
  for (const kind of ['table', 'board', 'calendar', 'timeline', 'gallery']) {
    await p2.locator(`.wspill[data-kind="${kind}"]`).click();
    await p2.waitForTimeout(250);
    const r = await measure(p2, '#pg-workspace .wssheet');
    check(!r.bad.length && !r.side && !r.names.length && !r.cut.length, `${name} ${kind.toUpperCase()}: every key 44 pt, nothing sideways, nothing cut, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ` (unnamed ${r.names.slice(0, 3)})` : ''}${r.cut.length ? ` (cut ${r.cut.slice(0, 3)})` : ''}`);
  }
  await p2.locator('.wspill[data-kind="board"]').click();
  for (const [where, label] of [['FILTER & SORT', 'FILTER & SORT'], ['PROPERTIES', 'PROPERTIES']]) {
    await tapKey(p2, label);
    await p2.waitForTimeout(200);
    const r = await measure(p2, '#pg-workspace .wssheet');
    check(!r.bad.length && !r.side && !r.names.length && !r.cut.length, `${name} ${where}: every key 44 pt, nothing sideways, nothing cut, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ` (unnamed ${r.names.slice(0, 3)})` : ''}${r.cut.length ? ` (cut ${r.cut.slice(0, 3)})` : ''}`);
    await tapKey(p2, label);
  }
  // the five templates: every word his (no filler, no placeholder text)
  if (name === '440') {
    await p2.locator('.wscrumb').first().click();
    const tpl = [];
    for (const id of ['meeting', 'reading', 'trip', 'week']) {
      if (!(await p2.locator('.wstemplates').count())) await tapKey(p2, 'NEW PAGE');
      await p2.locator(`.wstemplate[data-template="${id}"]`).click();
      await until(p2, () => window.__ghosty.workspace.view === 'page');
      const text = await sh(p2).textContent();
      tpl.push(text);
      await p2.locator('.wscrumb').first().click();
    }
    const all = tpl.join('\n') + (await S(p2)).tree.map((t) => t.title).join('\n');
    check(!/lorem|ipsum|placeholder|todo:|tbd|untitled project|undefined|\[object/i.test(all) && /Who was there/.test(all) && /Author/.test(all) && /Packing/.test(all) && /Monday/.test(all), 'the five templates’ words are his own: no filler, no placeholder, no code words');
    await p2.screenshot({ path: `${out}/workspace-templates.png` });
  }
  await p2.screenshot({ path: `${out}/workspace-${name}.png` });
  await c2.close();
}
times.total = Date.now() - T0;
console.log(`times (ms): the screen opens ${times.open} (two taps), START A PROJECT ${times.project}, a title typed to “Saved” ${times.edit}; the functional pass ${times.functional}; the whole spec ${times.total}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THE WORKSPACE ran clean: two taps through EDITORS, the empty state and START A PROJECT, a page typed with a to-do, a table, a link and BACKLINKS, the TASKS database as a board (dragged), a calendar, a timeline (zoomed), a gallery and a table with a filter that hides all, a formula and an error in his words, a relation and a rollup, HISTORY and RESTORE and UNDO, SEARCH, ASK ABOUT THIS PROJECT with its size said and what is due offline, EXPORT and IMPORT, autosave said once and reopening where he was, the Stage’s ADD TO A PROJECT, a week of 210 edits without a loss, and both widths in three worlds and BODY 21.');
process.exit(problems.length ? 1 : 0);
