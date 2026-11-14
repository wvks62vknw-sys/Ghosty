// GRID PRO, SPREADSHEETS: the chart editor and in-cell sparklines (APPS ROUND, editors: the pro edition), end to end on the phone, real waits:
//  1. A shop table chosen, CHART → STACKED COLUMNS, a title and the words along the bottom, MAKE THE CHART: a stacked chart of three
//     series with its key, said in his words; a number changed and the chart follows; UNDO takes the chart away, REDO brings it back.
//  2. PIE and SCATTER from the same cells; EDIT the stacked chart: LINE + COLUMNS, KEY off, green, SAVE THE CHART: drawn again as columns
//     and a line, with no key.
//  3. SPARKLINE on a row of numbers: a line drawn in the cell after them; SPARK COLUMNS on another row; NO SPARKLINE takes one out; a
//     sparkline over a cell that holds something is refused and said.
//  4. The round trip: .xlsx out (real Excel charts and sparklines inside), IMPORTed back with every chart and sparkline the same.
import { readFileSync } from 'node:fs';

export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const said = (page) => page.evaluate(() => window.__ghosty.sheets.said);
  const key = (page, label) => page.locator('.shpanel:not([hidden]) button').filter({ hasText: new RegExp(`^${label.replace(/[+$]/g, '\\$&')}$`) }).first();
  const pill = (page, name) => page.locator('.shpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  const tool = (page, label) => page.locator('.shtools button, .shbar button').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const go = async (page, a) => {
    const box = page.locator('.shaddr');
    await box.fill(a);
    await box.press('Enter');
    await until(page, (x) => window.__ghosty.sheets.range === x || window.__ghosty.sheets.sel === x, a);
  };
  const type = async (page, a, text) => {
    await go(page, a);
    const line = page.locator('.shline');
    await line.fill(text);
    await line.press('Enter');
    await until(page, ([x, t]) => String(window.__ghosty.sheets.read(window.__ghosty.sheets.active, x).v) === t, [a, text], 5000);
  };
  const charts = (page) => page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).charts);
  const sparks = (page) => page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).sheets[0].sparks ?? []);
  const rows = [['Month', 'Food', 'Fuel', 'Fun'], ['Jan', 120, 60, 30], ['Feb', 140, 55, 45], ['Mar', 110, 70, 25], ['Apr', 150, 65, 50]];
  const cells = {};
  rows.forEach((r, i) => r.forEach((v, c) => (cells[`${'ABCD'[c]}${i + 1}`] = { v })));
  cells.F2 = { v: 'kept' };
  const book = { id: 'gpcharts', title: 'Shops', at: Date.now(), sheets: [{ name: 'Sheet1', cells, widths: {}, heights: {}, frozen: false }], names: {}, charts: [], view: { sheet: 0, sel: 'A1' }, from: 'made here' };
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.sheets': [book] } });
  await page.evaluate(() => (location.hash = 'sheets'));
  await page.waitForSelector('#pg-sheets .shsheet .shopen', { timeout: 15000 });
  await page.locator('#pg-sheets .shopen').first().click();
  await until(page, () => window.__ghosty.sheets.view === 'book');

  // 1. STACKED COLUMNS with a title and axis words
  await go(page, 'A1:D5');
  await pill(page, 'CHART');
  check(/the first column names each point/.test(await page.locator('.shpanel:not([hidden])').innerText()), 'charts 1: the panel says how to choose the cells');
  await key(page, 'STACKED COLUMNS').click();
  await page.locator('.shpanel:not([hidden]) input[aria-label="The chart’s title"]').fill('Spend by month');
  await page.locator('.shpanel:not([hidden]) input[aria-label="The words along the bottom"]').fill('Month');
  await key(page, 'MAKE THE CHART').click();
  check(await until(page, () => document.querySelectorAll('.shchart svg[data-kind="stackedcol"] [data-bar]').length === 12), 'charts 1: a stacked column chart: four months × three shops = twelve blocks');
  check(/A stacked column chart of B2:B5 and 2 more columns, under the sheet\. It follows the numbers/.test(await said(page)), `charts 1: said in his words (${await said(page)})`);
  check(await page.locator('.shchart svg .shlegend').count() === 3 && /Month/.test(await page.locator('.shchart svg .shxtitle').textContent()), 'charts 1: its key names the three shops, and the words along the bottom are there');
  check((await page.locator('.shchart figcaption').first().textContent()) === 'Spend by month', 'charts 1: titled as he typed');
  await type(page, 'C3', '999');
  check(await until(page, () => /999/.test(document.querySelector('.shchart svg')?.getAttribute('aria-label') ?? '')), 'charts 1: the chart follows the numbers');
  await tool(page, 'UNDO').click();
  await until(page, () => !/999/.test(document.querySelector('.shchart svg')?.getAttribute('aria-label') ?? 'x'));
  await tool(page, 'UNDO').click();
  check(await until(page, () => document.querySelectorAll('.shchart').length === 0), 'charts 1: UNDO takes the chart away');
  await tool(page, 'REDO').click();
  check(await until(page, () => document.querySelectorAll('.shchart svg[data-kind="stackedcol"]').length === 1), 'charts 1: REDO brings it back');

  // 2. PIE, SCATTER, then EDIT
  await go(page, 'A1:B5');
  await pill(page, 'CHART');
  await key(page, 'PIE').click();
  await key(page, 'MAKE THE CHART').click();
  check(await until(page, () => document.querySelectorAll('.shchart svg[data-kind="pie"] [data-slice]').length === 4), 'charts 2: a pie of four slices');
  await go(page, 'B1:C5');
  await pill(page, 'CHART');
  await key(page, 'SCATTER').click();
  await key(page, 'MAKE THE CHART').click();
  check(await until(page, () => document.querySelectorAll('.shchart svg[data-kind="scatter"] [data-dot]').length === 4), 'charts 2: a scatter of four points (food against fuel)');
  await page.locator('.shchart').first().locator('button', { hasText: /^EDIT$/ }).click();
  check(await until(page, () => /Editing “Spend by month”/.test(window.__ghosty.sheets.said)), `charts 2: EDIT opens the chart in the panel (${await said(page)})`);
  await key(page, 'LINE + COLUMNS').click();
  await key(page, 'KEY').click();
  await page.locator('.shpanel:not([hidden]) .shswrow button[aria-label="Colour: green"]').click();
  await key(page, 'SAVE THE CHART').click();
  check(await until(page, () => {
    const s = document.querySelector('.shchart svg[data-kind="combo"]');
    return !!s && s.querySelectorAll('[data-bar]').length === 4 && s.querySelectorAll('[data-line]').length === 2 && !s.querySelector('.shlegend') && s.querySelector('.shbarp')?.classList.contains('shk3');
  }), 'charts 2: SAVE THE CHART: columns for food, lines for fuel and fun, no key, green');
  check(/Saved: Spend by month, now a line and column chart/.test(await said(page)), `charts 2: said (${await said(page)})`);
  await page.locator('.shcharts').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${h.out}/gridpro-charts.png`, fullPage: false });
  const before = await charts(page);
  check(before.length === 3 && before[0].kind === 'combo' && before[0].legend === false && before[0].tone === 3, `charts 2: kept in the workbook (${before.map((c) => c.kind).join(', ')})`);

  // 3. SPARKLINES
  await go(page, 'B2:D2');
  await pill(page, 'CHART');
  await key(page, 'SPARKLINE').click();
  check(await until(page, () => document.querySelector('.shc[data-a="E2"] svg.shspark polyline') !== null), 'sparks 3: a line sparkline drawn in E2, after its numbers');
  check(/A line sparkline in E2, drawn from its numbers\. UNDO takes it out/.test(await said(page)), `sparks 3: said (${await said(page)})`);
  check(/sparkline of 3 numbers/.test(await page.locator('.shc[data-a="E2"]').getAttribute('aria-label')), 'sparks 3: a screen reader hears what the cell draws');
  await go(page, 'B3:D3');
  await key(page, 'SPARK COLUMNS').click();
  check(await until(page, () => document.querySelectorAll('.shc[data-a="E3"] svg.shspark rect').length === 3), 'sparks 3: SPARK COLUMNS draws three columns in E3');
  await go(page, 'E3');
  await key(page, 'NO SPARKLINE').click();
  check(await until(page, () => !document.querySelector('.shc[data-a="E3"] svg.shspark')), 'sparks 3: NO SPARKLINE takes it out');
  await tool(page, 'UNDO').click();
  check(await until(page, () => !!document.querySelector('.shc[data-a="E3"] svg.shspark')), 'sparks 3: UNDO brings it back');
  await go(page, 'B2:E2');
  await key(page, 'SPARKLINE').click();
  check(await until(page, () => /F2, where the sparkline would go, has something in it/.test(window.__ghosty.sheets.said)), `sparks 3: never over what he typed (${await said(page)})`);
  const sp = await sparks(page);
  check(sp.length === 2, `sparks 3: two sparklines kept (${JSON.stringify(sp)})`);

  // 4. the round trip
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.shexrow button', { hasText: /^XLSX$/ }).first().click()]);
  const bytes = readFileSync(await dl.path());
  check(bytes.includes(Buffer.from('xl/charts/chart3.xml')) && bytes.includes(Buffer.from('x14:sparklineGroup')), 'round trip 4: the .xlsx holds three real Excel charts and the sparklines');
  await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'charted.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && /charted/i.test(window.__ghosty.sheets.title)), 'round trip 4: IMPORTed back as its own workbook');
  const back = await charts(page);
  const same = (c) => ({ kind: c.kind, title: c.title, values: c.values, more: c.more ?? null, legend: c.legend !== false, tone: c.tone ?? 1, xTitle: c.kind === 'pie' ? null : (c.xTitle ?? null) });
  check(before[2].xTitle === 'Food' && before[2].yTitle === 'Fuel', `charts 2: a scatter's axes are named by its columns (${before[2].xTitle} / ${before[2].yTitle})`);
  check(JSON.stringify(back.map(same)) === JSON.stringify(before.map(same)), `round trip 4: every chart came back the same (${JSON.stringify(back.map(same))})`);
  const spk = (list) => JSON.stringify(list.map((k) => `${k.at} ${k.range} ${k.kind} ${k.tone ?? 1}`));
  check(spk(await sparks(page)) === spk(sp), `round trip 4: and the sparklines (${spk(await sparks(page))})`);
  check(await until(page, () => document.querySelectorAll('.shchart svg').length === 3 && !!document.querySelector('.shc[data-a="E2"] svg.shspark')), 'round trip 4: drawn again on the sheet');
  check(!(await page.evaluate(() => window.__ghosty.sheets.lost)).some((l) => /chart|sparkline/.test(l)), 'round trip 4: nothing said lost about them');
  await ctx.close();
}
