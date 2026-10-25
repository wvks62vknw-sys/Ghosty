// SPENDING on the owner's phone (440 × 956), the brain mocked with the brain's own sums (the shared spending
// module, as the edge tests build it): before the first import the card says there is no bank access and what
// goes to an online model; ADD STATEMENT reads a Monzo CSV; the month shows its total, categories, the
// subscriptions with the yearly total and a price change, and the rows; a budget in plain words gives a bar and
// "£… left this month"; a tap re-files a row and the rule is kept; the previous month, the year and "since last
// month"; EXPORT AS CSV downloads; FORGET ALL empties it. No page errors, nothing blocked, no sideways scrolling.
//   node tests/spending.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const { spend: S } = await import('../apps/edge/test/.build/profile.mjs');
const MONZO = readFileSync(new URL('../apps/edge/test/spending/monzo.csv', import.meta.url), 'utf8');

// The mocked brain: the rows, his rules and budgets, summed by the same code the brain uses.
const brain = { rows: [], rules: {}, budgets: {}, imports: 0, asked: [] };
const summary = (month) => {
  const months = [...new Set(brain.rows.map((r) => r.d.slice(0, 7)))].sort();
  const m = month && months.includes(month) ? month : months[months.length - 1] ?? '';
  return {
    privacy: S.PRIVACY,
    month: m,
    months,
    kept: brain.rows.length,
    cap: 3000,
    rules: Object.keys(brain.rules).length,
    last: null,
    view: m ? S.monthView(brain.rows, m) : null,
    year: m ? S.yearView(brain.rows, m.slice(0, 4)) : null,
    changes: m ? S.changes(brain.rows, m).lines : [],
    subscriptions: S.findSubscriptions(brain.rows),
    budgets: Object.entries(brain.budgets).map(([c, v]) => S.budgetStatus(c, v, brain.rows, m)),
    rows: brain.rows.filter((r) => r.d.startsWith(m)).reverse(),
  };
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, hasTouch: true, isMobile: true, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.route(/\/api\/profile\/spending/, async (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (u.pathname === '/api/profile/spending/import') {
    const st = S.readStatement(req.postDataJSON().csv);
    const { rows, unplaced } = S.categorise(st.rows, brain.rules);
    brain.asked.push(...unplaced);
    for (const x of rows) if (x.by === 'none' && x.k === "BOB'S BARBER") Object.assign(x, { c: 'shopping', by: 'model' });
    brain.rows.push(...rows);
    brain.imports++;
    return json({ result: { at: Date.now(), added: rows.length, duplicates: 0, skipped: st.skipped, shape: st.shape, bank: st.bank, asked: unplaced.length, placed: 2, unplaced: 0, kept: brain.rows.length, dropped: 0, months: [] }, ...summary() });
  }
  if (u.pathname === '/api/profile/spending/file') {
    const b = req.postDataJSON();
    brain.rules[b.k] = b.c;
    let filed = 0;
    for (const x of brain.rows) if (x.k === b.k) (x.c = b.c), (x.by = 'you'), filed++;
    return json({ filed, ...summary(b.month) });
  }
  if (u.pathname === '/api/profile/spending/budget') {
    const b = req.postDataJSON();
    const set = S.parseBudget(b.words);
    if (!set) return json({ error: 'say an amount and what it is for, like "£200 a month on eating out"' }, 400);
    brain.budgets[set.category] = set.monthly;
    return json({ set, ...summary(b.month) });
  }
  if (u.pathname === '/api/profile/spending/export') return r.fulfill({ status: 200, contentType: 'text/csv', body: S.toCsv(brain.rows) });
  if (req.method() === 'DELETE') {
    brain.rows = [];
    brain.rules = {};
    brain.budgets = {};
    return json(summary());
  }
  return json(summary(u.searchParams.get('month')));
});
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const sideways = async (where) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > PHONE.width + 1) problems.push(`${where}: the page scrolls sideways (${w} px wide)`);
};
const card = page.locator('#pg-agenda .pn.spend');
const text = async () => (await card.textContent().catch(() => '')) ?? '';
const shot = async (name) => {
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
};

// ---- Before the first import: the honest words.
await page.evaluate(() => (location.hash = 'agenda'));
await card.waitFor({ state: 'attached', timeout: 10000 });
// (on the phone the agenda is in sections: SPENDING has its own pill)
await openSection(page, 'agenda', 'Spending');
await page.waitForFunction(() => /No bank access, ever/.test(document.querySelector('#pg-agenda .pn.spend')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('the card does not say "No bank access, ever" before the first import'));
const before = await text();
if (!/only the shop names they can't place — never dates, amounts or your balance — go to a free online AI/.test(before)) problems.push(`the card does not say what goes to an online model: ${before.slice(0, 300)}`);
if (!/NO STATEMENT YET/i.test(before)) problems.push('no "no statement yet" status');
if (await card.locator('.ft').isVisible()) problems.push('the empty card shows EXPORT and FORGET ALL with nothing to export or forget');
if ((await card.locator('button:has-text("ADD STATEMENT"):visible').count()) !== 1) problems.push('the empty card should show ADD STATEMENT once');
await shot('spending-empty');

// ---- ADD STATEMENT: a Monzo CSV.
await card.locator('input[type=file]').setInputFiles({ name: 'monzo.csv', mimeType: 'text/csv', buffer: Buffer.from(MONZO) });
await page.waitForFunction(() => window.__ghosty?.spending?.kept === 18, null, { timeout: 8000 }).catch(() => problems.push('the statement was not added'));
const toast = await page.locator('.toast').last().textContent().catch(() => '');
if (!/Added 18 rows from Monzo · 1 name sorted by the free AI/.test(toast ?? '')) problems.push(`the import's toast reads: ${toast}`);
if (brain.asked.join() !== "BOB'S BARBER") problems.push(`names for the model: ${brain.asked.join()}`);
let t = await text();
if (!/October 2026/.test(t)) problems.push('the card does not open on the latest month');
if (!/£83 out · £2,100 in/.test(t)) problems.push(`the month's total reads wrong: ${t.slice(0, 200)}`);
if (!/SUBSCRIPTIONS · £300 A YEAR/.test(t)) problems.push('no subscriptions with the yearly total');
if (!/Netflix.*was £10\.99 until 05\/10/.test(t)) problems.push('the Netflix price change is not said');
if (!/18 rows kept · up to 3,000/i.test(t)) problems.push('the rows kept and the cap are not said');

// ---- A budget in plain words.
await card.locator('input[aria-label="A budget in your words"]').fill('£60 a month on eating out');
await card.locator('button:has-text("SET BUDGET")').click();
await page.waitForFunction(() => window.__ghosty?.spending?.budgets?.[0] === 'eating out: £29 left this month', null, { timeout: 5000 }).catch(() => problems.push('the budget does not say "£29 left this month"'));
if (!(await card.locator('.bar.budget').count())) problems.push('no budget bar');
await shot('spending-month');

// ---- A tap re-files a row; the rule is kept.
await card.locator('.txn[data-k="NANDO\'S"]').first().click();
await page.locator('.modal .refile button:has-text("Groceries")').click();
await page.waitForFunction(() => window.__ghosty?.spending?.refiled === 1, null, { timeout: 5000 }).catch(() => problems.push('the tap did not re-file the row'));
if (brain.rules["NANDO'S"] !== 'groceries') problems.push('the rule was not kept');
await page.waitForFunction(() => window.__ghosty?.spending?.budgets?.[0] === 'eating out: £60 left this month', null, { timeout: 5000 }).catch(() => problems.push('the budget did not follow the re-filed row'));

// ---- The previous month, the year, since last month.
await card.locator('.spendnav button:has-text("‹")').click();
await page.waitForFunction(() => window.__ghosty?.spending?.month === '2026-09', null, { timeout: 5000 }).catch(() => problems.push('‹ did not go to September'));
await card.locator('.spendtabs button:has-text("YEAR")').click();
t = await text();
for (const m of ['AUG', 'SEP', 'OCT']) if (!t.includes(m)) problems.push(`the year's view has no ${m}`);
await shot('spending-year');
await card.locator('.spendtabs button:has-text("SINCE LAST MONTH")').click();
t = await text();
if (!/SEPTEMBER AGAINST AUGUST/.test(t) || !/more than August in all|less than August in all/.test(t)) problems.push(`"since last month" reads: ${t.slice(0, 300)}`);
await shot('spending-changes');
await sideways('Agenda → SPENDING');

// ---- EXPORT AS CSV.
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), card.locator('button:has-text("EXPORT AS CSV")').click()]);
if (!download) problems.push('EXPORT AS CSV did not download');
else {
  const body = readFileSync(await download.path(), 'utf8');
  if (!body.startsWith('Date,Description,Amount,Category\r\n2026-08-01,ACME WIDGETS LTD,2100.00,income')) problems.push(`the CSV starts: ${body.slice(0, 80)}`);
  if (download.suggestedFilename() !== 'ghosty-spending.csv') problems.push(`the CSV is called ${download.suggestedFilename()}`);
}

// ---- FORGET ALL.
await card.locator('.ft button:has-text("FORGET ALL")').click();
await page.locator('.modal .confirm button:has-text("FORGET ALL")').click();
await page.waitForFunction(() => window.__ghosty?.spending?.kept === 0, null, { timeout: 5000 }).catch(() => problems.push('FORGET ALL did not empty the card'));
if (!/No bank access, ever/.test(await text())) problems.push('the empty card lost its words after FORGET ALL');

const blocked = await page.evaluate(() => window.__cspv);
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);
await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Spending run clean: the words before the first import, a Monzo statement added (one name for the model), the month with subscriptions, a price change and the cap, a budget bar with "£… left this month", a tap re-files and keeps the rule, the previous month, the year and since last month, EXPORT AS CSV, FORGET ALL; no errors, nothing blocked, no sideways scroll.');
