// THE EDITORS LANE, SPREADSHEETS (against Numbers and Excel): the tools this round added, end to end on the phone, with the real waits.
//  1. Σ (AutoSum) under a column of numbers writes =SUM of them and the total is right; UNDO takes it out, REDO puts it back.
//  2. ROW ABOVE puts a row in, and every formula that pointed past it follows its cells (the total's range grows, a formula elsewhere
//     points at the moved total); DELETE ROWS takes it out again; UNDO brings it back. COLUMN BEFORE and DELETE COLUMNS the same way, and a
//     formula pointing only into a column taken out says #REF!.
//  3. The round trip: the workbook out as .xlsx and IMPORTed back, the moved formulas still the same formulas with the same answers.
//  4. A CSV of 9,998 rows (the sheet holds 10,000) opens, Σ adds up all of it, and a row put in at the top moves every row and the total
//     inside its budget.
//  5. Every look at 440 × 956, The Scan at 390 × 844 and BODY 21: every key 44 pt, nothing sideways, no words cut.
import { readFileSync } from 'node:fs';

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  /** The editor drawn at its own size (no entrance scale still running), so a key is measured as he sees it. */
  const still = (page, sel) => until(page, (x) => {
    const el = document.querySelector(x);
    return !!el && el.offsetWidth > 0 && Math.abs(el.getBoundingClientRect().width - el.offsetWidth) < 0.25;
  }, sel, 10000);
  const read = (page, sheet, a) => page.evaluate(([s, x]) => window.__ghosty.sheets.read(s, x), [sheet, a]);
  const said = (page) => page.evaluate(() => window.__ghosty.sheets.said);
  const goSheets = async (page) => {
    await page.evaluate(() => (location.hash = 'area-make'));
    await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]', { timeout: 20000 });
    await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]');
    await page.waitForSelector('#pg-sheets .shsheet', { timeout: 15000 });
  };
  const fresh = async (page) => {
    await page.locator('#pg-sheets .shbar button', { hasText: 'NEW' }).first().click();
    return until(page, () => window.__ghosty.sheets.view === 'book');
  };
  const cell = (page, a) => page.locator(`.shsheet .shc[data-a="${a}"]`).first();
  const key = (page, label) => page.locator('.shpanel:not([hidden]) button, .shtools button, .shcolmenu:not([hidden]) button').filter({ hasText: new RegExp(`^${label}$`) }).first();
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
  const active = (page) => page.evaluate(() => window.__ghosty.sheets.active);

  // ---------------------------------------------------------------- 1 to 3. The Scan at 440
  const { ctx, page } = await open({ look: LOOKS.scan });
  await goSheets(page);
  check(await fresh(page), 'sheets: NEW opens a blank workbook');
  const S = await active(page);
  await type(page, 'B1', 'Cost');
  await type(page, 'B2', '10');
  await type(page, 'B3', '20');
  await type(page, 'B4', '30');
  await go(page, 'B5');
  await page.locator('.shtools button[aria-label^="AutoSum"]').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B5').v === 60, S), 'sheets 1: Σ under a column writes its total (60)');
  const b5 = await read(page, S, 'B5');
  check(b5.f === 'SUM(B2:B4)', `sheets 1: and it is a real formula, =SUM(B2:B4) (${b5.f})`);
  check(/SUM\(B2:B4\).*UNDO/i.test(await said(page)), `sheets 1: said in his words (${await said(page)})`);
  await key(page, 'UNDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B5').f === undefined, S), 'sheets 1: UNDO takes the total out');
  await key(page, 'REDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B5').v === 60, S), 'sheets 1: REDO puts it back');
  // a range chosen: a total under each column
  await type(page, 'C2', '1');
  await type(page, 'C3', '2');
  await type(page, 'C4', '3');
  await go(page, 'B2:C4');
  await page.locator('.shtools button[aria-label^="AutoSum"]').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'C5').v === 6 && window.__ghosty.sheets.read(s, 'B5').v === 60, S), 'sheets 1: two columns chosen, a total under each');
  await type(page, 'E1', '=B5*2');
  check((await read(page, S, 'E1')).v === 120, 'sheets 2: a formula elsewhere leans on the total (120)');

  // 2. rows
  await go(page, 'B3');
  await pill(page, 'DATA');
  await key(page, 'ROW ABOVE').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B6').f === 'SUM(B2:B5)' && window.__ghosty.sheets.read(s, 'B4').v === 20, S), 'sheets 2: ROW ABOVE puts a row in, the cells move down and the total’s range grows (=SUM(B2:B5))');
  check((await read(page, S, 'E1')).f === 'B6*2', `sheets 2: the formula that pointed at the total follows it (=${(await read(page, S, 'E1')).f})`);
  await type(page, 'B3', '5');
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B6').v === 65 && window.__ghosty.sheets.read(s, 'E1').v === 130, S), 'sheets 2: a number in the new row counts in the total (65, and 130)');
  await go(page, 'B3');
  await key(page, 'DELETE ROWS').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B5').f === 'SUM(B2:B4)' && window.__ghosty.sheets.read(s, 'B5').v === 60 && window.__ghosty.sheets.read(s, 'E1').f === 'B5*2', S), 'sheets 2: DELETE ROWS takes it out; the total and the formula come back to =SUM(B2:B4) and =B5*2');
  check(/Took out row 3/.test(await said(page)), `sheets 2: said (${await said(page)})`);
  await key(page, 'UNDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B6').v === 65 && window.__ghosty.sheets.read(s, 'B3').v === 5, S), 'sheets 2: UNDO brings the row back, its 5 in it');
  await key(page, 'REDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B5').v === 60, S), 'sheets 2: REDO takes it out again');
  // columns
  await type(page, 'G1', '=C5+1');
  await go(page, 'A1');
  await key(page, 'COLUMN BEFORE').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'C5').f === 'SUM(C2:C4)' && window.__ghosty.sheets.read(s, 'F1').f === 'C5*2' && window.__ghosty.sheets.read(s, 'H1').f === 'D5+1', S), 'sheets 2: COLUMN BEFORE moves every column right and every formula with it');
  await go(page, 'D1');
  await key(page, 'DELETE COLUMNS').click();
  check(await until(page, (s) => String(window.__ghosty.sheets.read(s, 'G1').text).includes('#REF!'), S), `sheets 2: a formula that pointed only into a column taken out says #REF! (${(await read(page, S, 'G1')).text})`);
  check((await read(page, S, 'E1')).f === 'C5*2' && (await read(page, S, 'E1')).v === 120, 'sheets 2: the others still work out (120)');
  await key(page, 'UNDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'H1').v === 7, S), 'sheets 2: UNDO brings the column back and its formula works again (7)');
  // a column's header: INSERT and DELETE there too
  check(await page.locator('.shcolmenu button', { hasText: 'INSERT A COLUMN BEFORE' }).count() === 1, 'sheets 2: a column’s header offers INSERT A COLUMN BEFORE and DELETE THIS COLUMN');

  // 3. the round trip: .xlsx out and back
  const before = await page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).sheets[0].cells);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.shexrow button', { hasText: /^XLSX$/ }).first().click()]);
  const bytes = readFileSync(await dl.path());
  check(bytes.subarray(0, 2).toString() === 'PK', `sheets 3: the workbook out as .xlsx (${bytes.length} bytes)`);
  await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'moved-lines.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && /moved lines/i.test(window.__ghosty.sheets.title)), 'sheets 3: IMPORTed back as its own workbook');
  const after = await page.evaluate(() => JSON.parse(window.__ghosty.sheets.json).sheets[0].cells);
  const differ = Object.keys(before).filter((k) => (before[k].f ?? before[k].v) !== (after[k]?.f ?? after[k]?.v));
  check(!differ.length, `sheets 3: every moved formula and number came back the same${differ.length ? ` (${differ.join(', ')} differ)` : ''}`);
  const S2 = await active(page);
  check((await read(page, S2, 'H1')).v === 7 && (await read(page, S2, 'C5')).v === 60, 'sheets 3: and works out the same answers');

  // 4. a big file: 10,000 rows
  const rows = ['Day,Amount,Note'];
  for (let i = 1; i <= 9997; i++) rows.push(`${i},${(i % 97) + 0.5},row ${i}`);
  const csv = Buffer.from(rows.join('\r\n'));
  const want = Array.from({ length: 9997 }, (_, i) => ((i + 1) % 97) + 0.5).reduce((a, b) => a + b, 0);
  let t = Date.now();
  await page.locator('#pg-sheets .shbar input[type=file]').setInputFiles({ name: 'ten-thousand.csv', mimeType: 'text/csv', buffer: csv });
  check(await until(page, () => window.__ghosty.sheets.view === 'book' && /ten thousand/i.test(window.__ghosty.sheets.title), null, 30000), `sheets 4: a 9,998-row CSV opens (${Date.now() - t} ms)`);
  const openMs = Date.now() - t;
  check(openMs < 8000, `sheets 4: inside its budget (${openMs} ms of 8000)`);
  const S3 = await active(page);
  await go(page, 'B9999');
  t = Date.now();
  await page.locator('.shtools button[aria-label^="AutoSum"]').click();
  check(await until(page, ([s, w]) => Math.abs(window.__ghosty.sheets.read(s, 'B9999').v - w) < 1e-6, [S3, want]), `sheets 4: Σ adds up 9,997 rows (${Date.now() - t} ms)`);
  await go(page, 'A2');
  t = Date.now();
  await key(page, 'ROW ABOVE').click();
  const okMove = await until(page, (s) => window.__ghosty.sheets.read(s, 'B10000').f === 'SUM(B3:B9999)', S3);
  const moveMs = Date.now() - t;
  check(okMove && (await read(page, S3, 'A3')).v === 1, `sheets 4: a row put in at the top moves every row and the total follows (=SUM(B3:B9999), ${moveMs} ms)`);
  check(moveMs < 2500, `sheets 4: inside its budget (${moveMs} ms of 2500)`);
  t = Date.now();
  await key(page, 'UNDO').click();
  check(await until(page, (s) => window.__ghosty.sheets.read(s, 'B9999').f === 'SUM(B2:B9998)', S3) && Date.now() - t < 2500, `sheets 4: UNDO of it is quick too (${Date.now() - t} ms)`);
  await ctx.close();

  // ---------------------------------------------------------------- 5. every look at 440; The Scan at 390 and BODY 21
  const shots = [...Object.entries(LOOKS).map(([name, look]) => ({ name, look, viewport: PHONE })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const s of shots) {
    const { ctx: c, page: p } = await open({ look: s.look, viewport: s.viewport });
    // every look reaches SPREADSHEETS by its own address (the MAKE pill is proved above on The Scan)
    await p.evaluate(() => (location.hash = 'sheets'));
    await p.waitForSelector('#pg-sheets .shsheet', { timeout: 15000 });
    check(/No spreadsheets yet/i.test(await p.locator('.shempty').innerText()), `sheets, ${s.name}: the empty list says so in his words`);
    await fresh(p);
    await pill(p, 'DATA');
    if (s.big) await body21(p);
    await settle(p);
    await still(p, '#pg-sheets .shsheet');
    await measure(p, '#pg-sheets', `sheets, ${s.name}: the DATA keys and Σ`);
    await c.close();
  }
}
