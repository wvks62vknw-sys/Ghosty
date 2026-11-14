// EDITORS GRID, SPREADSHEETS: one-tap table summaries (NEXT ROUND, editors.u3), end to end on the phone with the real waits:
//  1. A spending table (Date, Shop, Amount) typed; SUMMARY: the table read and said; DATE BY MONTH and AMOUNT and TOTAL are picked for him;
//     MAKE THE SUMMARY puts a sheet of its own, a row a month with the right totals, said in his words.
//  2. It follows the table: an amount changed moves its month's total; a row for a new month added under the table gives the summary a new row.
//  3. MAKE A CHART OF IT draws bars of it in one tap; UNDO takes the chart away, and UNDO again the summary itself.
//  4. By SHOP, COUNT: a row for each shop with how many times.
export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const said = (page) => page.evaluate(() => window.__ghosty.sheets.said);
  const read = (page, sheet, a) => page.evaluate(([s, x]) => window.__ghosty.sheets.read(s, x).v, [sheet, a]);
  const key = (page, label) => page.locator('.shpanel:not([hidden]) button').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const pill = (page, name) => page.locator('.shpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  const undoKey = (page) => page.locator('.shtools button, .shpanel:not([hidden]) button, .shbar button').filter({ hasText: /^UNDO$/ }).first();
  const go = async (page, a) => {
    const box = page.locator('.shaddr');
    await box.fill(a);
    await box.press('Enter');
    await until(page, (x) => window.__ghosty.sheets.sel === x || window.__ghosty.sheets.range.startsWith(x), a);
  };
  const tab = async (page, name) => {
    await page.locator('.shtabs button', { hasText: new RegExp(`^${name}$`) }).first().click();
    await until(page, (n) => window.__ghosty.sheets.active === n, name);
  };
  const type = async (page, a, text) => {
    await go(page, a);
    const line = page.locator('.shline');
    await line.fill(text);
    await line.press('Enter');
    await until(page, ([x, t]) => {
      const r = window.__ghosty.sheets.read(window.__ghosty.sheets.active, x);
      return r.text === t || String(r.v) === t || r.text.length > 0;
    }, [a, text], 5000);
  };
  // a spending table kept on the phone as he would have typed it (3 Jan, 20 Jan, 2 Feb and 1 Mar 2026 as the dates Excel counts; pounds)
  const D = (v) => ({ v, x: { n: 'date' } });
  const P = (v) => ({ v, x: { n: 'currency' } });
  const cells = { A1: { v: 'Date' }, B1: { v: 'Shop' }, C1: { v: 'Amount' }, A2: D(46025), B2: { v: 'Tesco' }, C2: P(12.5), A3: D(46042), B3: { v: 'Aldi' }, C3: P(8), A4: D(46055), B4: { v: 'Tesco' }, C4: P(30), A5: D(46082), B5: { v: 'Boots' }, C5: P(4) };
  const book = { id: 'gsum', title: 'Spending', at: Date.now(), sheets: [{ name: 'Sheet1', cells, widths: {}, heights: {}, frozen: false }], names: {}, charts: [], view: { sheet: 0, sel: 'A1' }, from: 'made here' };
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.sheets': [book] } });
  await page.evaluate(() => (location.hash = 'sheets'));
  await page.waitForSelector('#pg-sheets .shsheet .shopen', { timeout: 15000 });
  await page.locator('#pg-sheets .shopen').first().click();
  await until(page, () => window.__ghosty.sheets.view === 'book');

  // 1. the summary by month
  await go(page, 'A1:C5');
  await pill(page, 'SUMMARY');
  check(await until(page, () => /The table: 3 columns, Date, Shop, Amount/.test(document.querySelector('.shpanel:not([hidden])')?.textContent ?? '')), 'summary 1: the table is read and said: Date, Shop, Amount');
  const picked = await page.evaluate(() => [...document.querySelectorAll('.shpanel:not([hidden]) button[aria-pressed="true"]')].map((x) => x.textContent).join(', '));
  check(picked === 'DATE BY MONTH, AMOUNT, TOTAL', `summary 1: DATE BY MONTH, AMOUNT and TOTAL are picked for him (${picked})`);
  await key(page, 'MAKE THE SUMMARY').click();
  check(await until(page, () => window.__ghosty.sheets.active === 'Summary'), 'summary 1: MAKE THE SUMMARY opens a sheet of its own, Summary');
  check(/Total of Amount by month: 3 rows on the sheet Summary\. It follows the table/.test(await said(page)), `summary 1: said in his words (${await said(page)})`);
  check(JSON.stringify(await Promise.all(['A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'B5'].map((a) => read(page, 'Summary', a)))) === JSON.stringify(['Jan 2026', 20.5, 'Feb 2026', 30, 'Mar 2026', 4, 54.5]), 'summary 1: a row a month with the right totals, and the whole (54.5)');

  // 2. it follows the table
  await tab(page, 'Sheet1');
  await type(page, 'C3', '£18');
  check(await until(page, () => window.__ghosty.sheets.read('Summary', 'B2').v === 30.5), 'summary 2: Aldi’s £8 changed to £18: January’s total is £30.50');
  await type(page, 'A6', '9/4/2026');
  await type(page, 'B6', 'Aldi');
  await type(page, 'C6', '£10');
  check(await until(page, () => window.__ghosty.sheets.read('Summary', 'A5').v === 'Apr 2026' && window.__ghosty.sheets.read('Summary', 'B5').v === 10 && window.__ghosty.sheets.read('Summary', 'B6').v === 74.5), 'summary 2: a row for April added under the table: the summary gains April and its total grows');

  // 3. the chart in one tap, and UNDO
  await tab(page, 'Summary');
  await pill(page, 'SUMMARY');
  check(/This sheet is the summary: Total of Amount by month, from Sheet1/.test(await page.locator('.shpanel:not([hidden])').innerText()), 'summary 3: the summary’s own sheet says what it is');
  await key(page, 'MAKE A CHART OF IT').click();
  check(await until(page, () => JSON.parse(window.__ghosty.sheets.json).charts.some((c) => c.sheet === 'Summary' && c.values === 'B2:B5')), 'summary 3: MAKE A CHART OF IT draws bars of its four months');
  check(/A bar chart of the summary/.test(await said(page)), `summary 3: said (${await said(page)})`);
  await undoKey(page).click();
  check(await until(page, () => !JSON.parse(window.__ghosty.sheets.json).charts.length), 'summary 3: UNDO takes the chart away');

  // 4. by shop, count
  await tab(page, 'Sheet1');
  await go(page, 'B2');
  await pill(page, 'SUMMARY');
  await key(page, 'SHOP').click();
  await key(page, 'COUNT').click();
  await key(page, 'MAKE THE SUMMARY').click();
  check(await until(page, () => window.__ghosty.sheets.active === 'Summary 2'), 'summary 4: a second summary on Summary 2');
  check(JSON.stringify(await Promise.all(['A2', 'B2', 'A3', 'B3', 'A4', 'B4'].map((a) => read(page, 'Summary 2', a)))) === JSON.stringify(['Tesco', 2, 'Aldi', 2, 'Boots', 1]), 'summary 4: by SHOP, COUNT: Tesco 2, Aldi 2, Boots 1');
  await undoKey(page).click();
  check(await until(page, () => !window.__ghosty.sheets.sheets.includes('Summary 2')), 'summary 4: UNDO takes that summary away');
  await ctx.close();
}
