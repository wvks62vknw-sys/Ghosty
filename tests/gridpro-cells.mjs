// GRID PRO, SPREADSHEETS: input checks and cell formatting (APPS ROUND, editors: the pro edition), end to end on the phone, real waits:
//  1. CELLS → DROP-DOWN LIST on B2:B4 (Paid, Owed, Later): a checked cell shows its choices under the formula line and a tap puts one in;
//     typing a word that is not on the list is refused and said, the cell unchanged.
//  2. TICK BOXES on C2:C4: TICK ticks the box (TRUE), drawn as a ticked box; typing "maybe" is refused. DATES on D2:D4: SET THE DATE puts
//     the date picked; typing words is refused. NO CHECK takes a check off; UNDO puts it back.
//  3. Formatting: ALL LINES and LINE UNDER borders, MERGE and UNMERGE (UNDO between), WRAP, $ and TIME, MAKE IT A TABLE with a header row
//     and banded rows: each drawn on the grid and said.
//  4. The round trip: .xlsx out and IMPORTed back with every check, merge, border, wrap, format and table the same and nothing said lost.
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
  const typeIn = async (page, a, text) => {
    await go(page, a);
    const line = page.locator('.shline');
    await line.fill(text);
    await line.press('Enter');
  };
  const v = (page, a) => page.evaluate((x) => window.__ghosty.sheets.read('Sheet1', x).v, a);
  const sh = (page) => page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).sheets[0]);
  const cells = { A1: { v: 'Item' }, B1: { v: 'State' }, C1: { v: 'Done' }, D1: { v: 'When' }, A2: { v: 'Rent' }, A3: { v: 'Gas' }, A4: { v: 'Phone' }, E2: { v: 1250.5 }, E3: { v: 0.5 }, A6: { v: 'A long note that should wrap onto more lines' } };
  const book = { id: 'gpcells', title: 'Bills', at: Date.now(), sheets: [{ name: 'Sheet1', cells, widths: {}, heights: {}, frozen: false }], names: {}, charts: [], view: { sheet: 0, sel: 'A1' }, from: 'made here' };
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.sheets': [book] } });
  await page.evaluate(() => (location.hash = 'sheets'));
  await page.waitForSelector('#pg-sheets .shsheet .shopen', { timeout: 15000 });
  await page.locator('#pg-sheets .shopen').first().click();
  await until(page, () => window.__ghosty.sheets.view === 'book');

  // 1. a drop-down list
  await go(page, 'B2:B4');
  await pill(page, 'CELLS');
  await page.locator('.shpanel:not([hidden]) input[aria-label^="The choices of the list"]').fill('Paid, Owed, Later');
  await key(page, 'DROP-DOWN LIST').click();
  check(await until(page, () => /B2:B4 takes one of: Paid, Owed, Later/.test(window.__ghosty.sheets.said)), `checks 1: said (${await said(page)})`);
  check(await until(page, () => document.querySelector('.shc[data-a="B3"]')?.dataset.check === 'list'), 'checks 1: the cells show they hold a list');
  await go(page, 'B2');
  check(await until(page, () => !document.querySelector('.shvbox').hidden && /B2: CHOOSE ONE/.test(document.querySelector('.shvbox').textContent)), 'checks 1: a checked cell shows its choices under the formula line');
  await page.locator('.shvbox button', { hasText: /^Owed$/ }).click();
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'B2').v === 'Owed'), 'checks 1: a tap puts the choice in');
  await typeIn(page, 'B3', 'Maybe');
  check(await until(page, () => /B3 takes one of its list: Paid, Owed or Later\. Choose one under the formula line; nothing was changed/.test(window.__ghosty.sheets.said)), `checks 1: a word not on the list is refused and said (${await said(page)})`);
  check((await v(page, 'B3')) === null, 'checks 1: the cell is unchanged');
  await typeIn(page, 'B3', 'later');
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'B3').v === 'later'), 'checks 1: a word on the list (any case) goes in');

  // 2. tick boxes, dates, NO CHECK and UNDO
  await go(page, 'C2:C4');
  await pill(page, 'CELLS');
  await key(page, 'TICK BOXES').click();
  await go(page, 'C2');
  await page.locator('.shvbox button', { hasText: /^TICK$/ }).click();
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'C2').v === true && document.querySelector('.shc[data-a="C2"] .shtick')?.dataset.on === '1'), 'checks 2: TICK ticks the box, drawn ticked');
  check(/C2: a tick box, ticked/.test(await page.locator('.shc[data-a="C2"]').getAttribute('aria-label')), 'checks 2: a screen reader hears it ticked');
  await typeIn(page, 'C3', 'maybe');
  check(await until(page, () => /C3 is a tick box/.test(window.__ghosty.sheets.said)) && (await v(page, 'C3')) === null, `checks 2: words in a tick box are refused (${await said(page)})`);
  await go(page, 'D2:D4');
  await pill(page, 'CELLS');
  await key(page, 'DATES').click();
  await go(page, 'D2');
  await page.locator('.shvbox input[type=date]').fill('2026-12-25');
  await page.locator('.shvbox button', { hasText: /^SET THE DATE$/ }).click();
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'D2').text === '25 Dec 2026'), 'checks 2: SET THE DATE puts the date picked');
  await typeIn(page, 'D3', 'soon');
  check(await until(page, () => /D3 takes a date/.test(window.__ghosty.sheets.said)) && (await v(page, 'D3')) === null, `checks 2: words in a date cell are refused (${await said(page)})`);
  await go(page, 'D2:D4');
  await pill(page, 'CELLS');
  await key(page, 'NO CHECK').click();
  check(await until(page, () => !document.querySelector('.shc[data-a="D2"]')?.dataset.check), 'checks 2: NO CHECK takes it off');
  await tool(page, 'UNDO').click();
  check(await until(page, () => document.querySelector('.shc[data-a="D2"]')?.dataset.check === 'date'), 'checks 2: UNDO puts it back');

  // 3. formatting
  await go(page, 'A1:D4');
  await pill(page, 'CELLS');
  await key(page, 'ALL LINES').click();
  check(await until(page, () => document.querySelector('.shc[data-a="B3"]')?.dataset.bd === '15'), 'cells 3: ALL LINES draws every line');
  await key(page, 'MAKE IT A TABLE').click();
  check(await until(page, () => document.querySelector('.shc[data-a="A1"]')?.dataset.band === 'head' && document.querySelector('.shc[data-a="A3"]')?.dataset.band === 'odd'), 'cells 3: MAKE IT A TABLE: a header row and banded rows');
  check(/A1:D4 is a blue table with a header row and banded rows/.test(await said(page)), `cells 3: said (${await said(page)})`);
  await go(page, 'A6:D6');
  await pill(page, 'CELLS');
  await key(page, 'MERGE').click();
  check(await until(page, () => document.querySelector('.shc[data-a="A6"]')?.dataset.merge === '1' && document.querySelector('.shc[data-a="B6"]')?.dataset.hid === '1'), 'cells 3: MERGE shows A6 across A6:D6');
  await key(page, 'UNMERGE').click();
  check(await until(page, () => !document.querySelector('.shc[data-a="A6"]')?.dataset.merge), 'cells 3: UNMERGE undoes it');
  await tool(page, 'UNDO').click();
  check(await until(page, () => document.querySelector('.shc[data-a="A6"]')?.dataset.merge === '1'), 'cells 3: UNDO merges it again');
  await go(page, 'A6');
  await pill(page, 'CELLS');
  await key(page, 'WRAP').click();
  check(await until(page, () => document.querySelector('.shc[data-a="A6"]')?.dataset.wrap === '1'), 'cells 3: WRAP wraps the words');
  await go(page, 'E2');
  await pill(page, 'CELLS');
  await key(page, '$').click();
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'E2').text === '$1,250.50'), 'cells 3: $ shows dollars');
  await go(page, 'E3');
  await key(page, 'TIME').click();
  check(await until(page, () => window.__ghosty.sheets.read('Sheet1', 'E3').text === '12:00'), 'cells 3: TIME shows half a day as 12:00');
  await go(page, 'A4:D4');
  await key(page, 'LINE UNDER').click();
  await page.screenshot({ path: `${h.out}/gridpro-cells.png` });
  const before = await sh(page);

  // 4. the round trip
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.shexrow button', { hasText: /^XLSX$/ }).first().click()]);
  const bytes = readFileSync(await dl.path());
  check(bytes.includes(Buffer.from('xl/tables/table1.xml')), 'round trip 4: the .xlsx holds a real table');
  await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'checked.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && /checked/i.test(window.__ghosty.sheets.title)), 'round trip 4: IMPORTed back as its own workbook');
  const after = await sh(page);
  for (const k of ['checks', 'merges', 'tables']) check(JSON.stringify(after[k]) === JSON.stringify(before[k]), `round trip 4: the ${k} came back the same (${JSON.stringify(after[k])})`);
  const fx = (s) => JSON.stringify(['B3', 'A6', 'E2', 'E3', 'A4'].map((a) => s.cells[a]?.x ?? null));
  check(fx(after) === fx(before), `round trip 4: borders, wrap and formats the same (${fx(after)})`);
  check(!(await page.evaluate(() => window.__ghosty.sheets.lost)).some((l) => /merged|border|drop-down|check|table/.test(l)), 'round trip 4: nothing said lost about them');
  await ctx.close();
}
