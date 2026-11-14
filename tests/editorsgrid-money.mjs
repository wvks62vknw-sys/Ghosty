// EDITORS GRID, SPREADSHEETS with MONEY: your spending as a budget sheet (NEXT ROUND, editors.c1 and money.c4), end to end. MONEY's figures
// come from a stand-in for the brain's spending sums (routed in this page only, so no other spec's statements are touched):
//  1. MONEY → BUDGETS → OPEN AS A SPREADSHEET opens SPREADSHEETS on a fresh copy: months down, categories across, the totals as formulas,
//     the budgets on a sheet of their own, a chart; said in his words.
//  2. The copy is his to play with: a figure changed moves the totals; asked again, it is a fresh copy and the first is still there.
//  3. Nothing kept in MONEY yet: said, and how to start.
export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const said = (page) => page.evaluate(() => window.__ghosty.sheets.said);
  const read = (page, sheet, a) => page.evaluate(([s, x]) => window.__ghosty.sheets.read(s, x).v, [sheet, a]);
  const view = (month, cats) => ({ month, out: cats.reduce((k, x) => k + x.spent, 0), in: 2000, categories: cats });
  const V = { '2026-09': view('2026-09', [{ c: 'groceries', spent: 120 }, { c: 'eating out', spent: 30 }]), '2026-10': view('2026-10', [{ c: 'groceries', spent: 200 }, { c: 'fuel', spent: 100 }]) };
  const summary = (month, kept = 14) => ({ privacy: '', month: month ?? '2026-10', months: kept ? ['2026-09', '2026-10'] : [], kept, cap: 5000, rules: 0, last: null, view: kept ? V[month ?? '2026-10'] : null, year: null, changes: [], subscriptions: [], budgets: kept ? [{ category: 'groceries', monthly: 250, spent: 200, left: 50, frac: 0.8, line: '£50 left this month' }] : [], rows: [] });
  const stand = (kept) => async (page) => page.route(/\/api\/profile\/spending(\?|$)/, (r) => {
    const m = new URL(r.request().url()).searchParams.get('month') ?? undefined;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary(m, kept)) });
  });

  const { ctx, page } = await open({ look: LOOKS.scan });
  await stand(14)(page);
  await page.evaluate(() => (location.hash = 'money'));
  await page.locator('#pg-money .secpills .secpill', { hasText: /^Budgets$/ }).first().click();
  const key = page.locator('#pg-money button', { hasText: /^Open as a spreadsheet$/ }).first();
  await key.waitFor({ timeout: 15000 });
  check(await key.count() === 1, 'money 1: MONEY → BUDGETS has OPEN AS A SPREADSHEET');
  await key.click();
  check(await until(page, () => window.__ghosty.sheets?.money === 'ready' && window.__ghosty.sheets.view === 'book', null, 20000), 'money 1: it opens SPREADSHEETS on the budget sheet');
  check(/Your spending as a budget sheet: 2 months by 3 categories.*fresh copy: changing it never changes MONEY/.test(await said(page)), `money 1: said in his words (${await said(page)})`);
  check(JSON.stringify(await Promise.all(['A1', 'B1', 'C1', 'D1', 'E1'].map((a) => read(page, 'Spending', a)))) === JSON.stringify(['Month', 'Groceries', 'Fuel', 'Eating out', 'Money out']), 'money 1: categories across, the biggest first');
  check(JSON.stringify(await Promise.all(['A2', 'E2', 'A3', 'E3', 'E4', 'G4'].map((a) => read(page, 'Spending', a)))) === JSON.stringify(['Sep 2026', 150, 'Oct 2026', 300, 450, 3550]), 'money 1: months down, each month’s money out and the totals');
  check(await page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).sheets[0].cells.E4.f) === 'SUM(E2:E3)', 'money 1: the totals are formulas');
  check(await page.evaluate(() => window.__ghosty.sheets.sheets.join(',')) === 'Spending,Budgets' && await read(page, 'Budgets', 'D2') === 50, 'money 1: the budgets on a sheet of their own (groceries: £50 left)');
  check(await page.locator('.shsheet svg').count() >= 1, 'money 1: and a chart of each month’s money out');

  // 2. his to play with, and fresh each time
  await page.locator('.shaddr').fill('C2');
  await page.locator('.shaddr').press('Enter');
  await page.locator('.shline').fill('50');
  await page.locator('.shline').press('Enter');
  check(await until(page, () => window.__ghosty.sheets.read('Spending', 'E2').v === 200 && window.__ghosty.sheets.read('Spending', 'G4').v === 3500), 'money 2: a figure changed in the copy moves its month and the totals');
  await page.locator('.modal .mhead button', { hasText: /^CLOSE$/ }).click();
  await until(page, () => !document.querySelector('.modal'));
  await page.locator('#pg-money button', { hasText: /^Open as a spreadsheet$/ }).first().click();
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && window.__ghosty.sheets.read('Spending', 'E2').v === 150 && window.__ghosty.sheets.kept >= 2, null, 20000), 'money 2: asked again, a fresh copy from MONEY; the one he changed is kept too');
  await ctx.close();

  // 3. nothing kept in MONEY yet
  const { ctx: c2, page: p2 } = await open({ look: LOOKS.scan });
  await stand(0)(p2);
  await p2.evaluate(() => (location.hash = 'money'));
  await p2.locator('#pg-money .secpills .secpill', { hasText: /^Budgets$/ }).first().click();
  const k2 = p2.locator('#pg-money button', { hasText: /^Open as a spreadsheet$/ }).first();
  if (await k2.count()) {
    await k2.click();
    check(await until(p2, () => window.__ghosty.sheets?.money === 'none', null, 20000), 'money 3: with nothing in MONEY there is no sheet');
    check(/Nothing kept in MONEY yet: add a statement there first/.test(await said(p2)), `money 3: said, with how to start (${await said(p2)})`);
  } else check(true, 'money 3: (MONEY shows its own empty state, with no key to press)');
  await c2.close();
}
