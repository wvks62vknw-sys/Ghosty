// EDITORS GRID, SPREADSHEETS: colour cells by rules (NEXT ROUND, editors.u2), end to end on the phone with the real waits:
//  1. Numbers typed, the cells chosen, RULES → MORE THAN 100 → ADD THE RULE: the big ones turn green, said in his words; a number changed to
//     more than 100 turns green too (the rule follows the numbers).
//  2. EDIT the rule to 150 and SAVE THE RULE; DELETE it; UNDO brings it back; REDO takes it away again.
//  3. OVERDUE over dates: a date before London's today is red, one to come is not. DATA BARS draw a bar by size. A rule that needs a number
//     and has none says so.
//  4. The round trip: the workbook out as .xlsx and IMPORTed back, every rule the same and nothing said lost about them.
//  (and the sweep: quick sums of the chosen cells; AutoSum: Σ over cells whose row under is not empty writes nothing over it, and says which cell is in the way)
import { readFileSync } from 'node:fs';

export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const said = (page) => page.evaluate(() => window.__ghosty.sheets.said);
  const rules = (page) => page.evaluate(() => window.__ghosty.sheets.rules);
  const cf = (page, a) => page.evaluate((x) => document.querySelector(`.shsheet .shc[data-a="${x}"]`)?.dataset.cf ?? '', a);
  const key = (page, label) => page.locator('.shpanel:not([hidden]) button').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const pill = (page, name) => page.locator('.shpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  const go = async (page, a) => {
    const box = page.locator('.shaddr');
    await box.fill(a);
    await box.press('Enter');
    await until(page, (x) => window.__ghosty.sheets.sel === x || window.__ghosty.sheets.range.startsWith(x), a);
  };
  const type = async (page, a, text) => {
    await go(page, a);
    const line = page.locator('.shline');
    await line.fill(text);
    await line.press('Enter');
    await until(page, ([x, t]) => {
      const r = window.__ghosty.sheets.read(window.__ghosty.sheets.active, x);
      return (r.f !== undefined ? `=${r.f}` : r.text) === t || String(r.v) === t;
    }, [a, text], 5000);
  };
  // the numbers and two dates, kept on the phone as he would have typed them (1 Jan 2020 and 31 Dec 2099 as the dates Excel counts)
  const cells = { A1: { v: 5 }, A2: { v: 120 }, A3: { v: 60 }, A4: { v: 130 }, A5: { v: 30 }, C1: { v: 43831, x: { n: 'date' } }, C2: { v: 73050, x: { n: 'date' } } };
  const book = { id: 'grules', title: 'Rules', at: Date.now(), sheets: [{ name: 'Sheet1', cells, widths: {}, heights: {}, frozen: false }], names: {}, charts: [], view: { sheet: 0, sel: 'A1' }, from: 'made here' };
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.sheets': [book] } });
  await page.evaluate(() => (location.hash = 'sheets'));
  await page.waitForSelector('#pg-sheets .shsheet .shopen', { timeout: 15000 });
  await page.locator('#pg-sheets .shopen').first().click();
  await until(page, () => window.__ghosty.sheets.view === 'book');

  // (the sweep) QUICK SUMS: several cells chosen, their total, average, smallest and largest under the formula line
  await go(page, 'A1:A5');
  check(await until(page, () => window.__ghosty.sheets.quick === '5 numbers · total 345 · average 69 · smallest 5 · largest 130'), `sweep: quick sums of the chosen cells (${await page.evaluate(() => window.__ghosty.sheets.quick)})`);
  // (the sweep) Σ over cells whose row under is not empty writes nothing over his 30, and says so
  await go(page, 'A1:A4');
  await page.locator('.shtools button[aria-label^="AutoSum"]').click();
  check(await until(page, () => /The row under them is not empty \(A5 has 30\), so I wrote nothing/.test(window.__ghosty.sheets.said)) && (await page.evaluate(() => window.__ghosty.sheets.read('Sheet1', 'A5').v)) === 30, `sweep: Σ never writes over a full row; said (${await said(page)})`);

  // 1. MORE THAN 100
  await go(page, 'A1:A5');
  await pill(page, 'RULES');
  check(/No rules on this sheet yet/.test(await page.locator('.shpanel:not([hidden])').innerText()), 'rules 1: an empty list says so in his words');
  await key(page, 'MORE THAN').click();
  await page.locator('.shpanel:not([hidden]) input[aria-label="The number"]').fill('100');
  await key(page, 'ADD THE RULE').click();
  check(await until(page, () => window.__ghosty.sheets.rules.length === 1), 'rules 1: ADD THE RULE adds it to the sheet’s list');
  check(/Added: A1:A5: more than 100, green\. UNDO takes it back/.test(await said(page)), `rules 1: said in his words (${await said(page)})`);
  check(await until(page, () => ['A2', 'A4'].every((a) => document.querySelector(`.shc[data-a="${a}"]`)?.dataset.cf === '3') && !document.querySelector('.shc[data-a="A3"]')?.dataset.cf), 'rules 1: 120 and 130 turn green, 60 does not');
  await type(page, 'A5', '200');
  check(await until(page, () => document.querySelector('.shc[data-a="A5"]')?.dataset.cf === '3'), 'rules 1: 30 changed to 200 turns green: the rule follows the numbers');

  // 2. EDIT, DELETE, UNDO, REDO
  await pill(page, 'RULES');
  await key(page, 'EDIT').click();
  check(/Editing rule 1/.test(await said(page)), `rules 2: EDIT says what to do (${await said(page)})`);
  await page.locator('.shpanel:not([hidden]) input[aria-label="The number"]').fill('150');
  await key(page, 'SAVE THE RULE').click();
  check(await until(page, () => window.__ghosty.sheets.rules[0] === 'A1:A5: more than 150, green' && !document.querySelector('.shc[data-a="A2"]')?.dataset.cf && document.querySelector('.shc[data-a="A5"]')?.dataset.cf === '3'), `rules 2: SAVE THE RULE changes it: now only 200 is green (${await rules(page)})`);
  await key(page, 'DELETE').click();
  check(await until(page, () => window.__ghosty.sheets.rules.length === 0 && !document.querySelector('.shc[data-a="A5"]')?.dataset.cf), 'rules 2: DELETE takes the rule and its colour away');
  check(/Rule 1 deleted\. UNDO brings it back/.test(await said(page)), `rules 2: said (${await said(page)})`);
  await page.locator('.shtools button, .shpanel:not([hidden]) button, .shbar button').filter({ hasText: /^UNDO$/ }).first().click();
  check(await until(page, () => window.__ghosty.sheets.rules.length === 1 && document.querySelector('.shc[data-a="A5"]')?.dataset.cf === '3'), 'rules 2: UNDO brings it back, colour and all');
  await page.locator('.shtools button, .shpanel:not([hidden]) button, .shbar button').filter({ hasText: /^REDO$/ }).first().click();
  check(await until(page, () => window.__ghosty.sheets.rules.length === 0), 'rules 2: REDO takes it away again');
  await page.locator('.shtools button, .shpanel:not([hidden]) button, .shbar button').filter({ hasText: /^UNDO$/ }).first().click();
  await until(page, () => window.__ghosty.sheets.rules.length === 1);

  // 3. OVERDUE (London's today), DATA BARS, a rule with no number
  await go(page, 'C1:C2');
  await pill(page, 'RULES');
  await key(page, 'OVERDUE').click();
  await key(page, 'ADD THE RULE').click();
  check(await until(page, () => document.querySelector('.shc[data-a="C1"]')?.dataset.cf === '4' && !document.querySelector('.shc[data-a="C2"]')?.dataset.cf), 'rules 3: OVERDUE: 1 Jan 2020 is red, 31 Dec 2099 is not');
  check(/a date before today, red/.test(await said(page)), `rules 3: said (${await said(page)})`);
  await go(page, 'A1:A5');
  await pill(page, 'RULES');
  await key(page, 'DATA BARS').click();
  await key(page, 'ADD THE RULE').click();
  check(await until(page, () => document.querySelector('.shc[data-a="A5"]')?.dataset.bar === '1' && getComputedStyle(document.querySelector('.shc[data-a="A5"]')).getPropertyValue('--shbar').trim() === '1.000'), 'rules 3: DATA BARS: the biggest number has the whole bar');
  await key(page, 'LESS THAN').click();
  await page.locator('.shpanel:not([hidden]) input[aria-label="The number"]').fill('');
  await key(page, 'ADD THE RULE').click();
  check(/Type the number to compare with/.test(await said(page)), `rules 3: a rule with no number says so (${await said(page)})`);
  const before = await rules(page);
  check(before.length === 3, `rules 3: three rules listed (${before.join(' | ')})`);

  // 4. the round trip
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.shexrow button', { hasText: /^XLSX$/ }).first().click()]);
  const bytes = readFileSync(await dl.path());
  check(/<conditionalFormatting sqref="A1:A5"><cfRule type="cellIs"/.test(bytes.toString('latin1')) || bytes.subarray(0, 2).toString() === 'PK', 'rules 4: the workbook out as .xlsx');
  await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'ruled.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && /ruled/i.test(window.__ghosty.sheets.title)), 'rules 4: IMPORTed back as its own workbook');
  check(await until(page, (b) => JSON.stringify(window.__ghosty.sheets.rules) === b, JSON.stringify(before)), `rules 4: every rule came back the same (${await rules(page)})`);
  check(!/colour rules|conditional/.test((await page.evaluate(() => window.__ghosty.sheets.lost)).join(' ')), 'rules 4: nothing said lost about them');
  check(await cf(page, 'A5') === '3' && await cf(page, 'C1') === '4', 'rules 4: and they colour the same cells');
  await ctx.close();
}
