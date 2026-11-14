// PAPER, part 1 (editors.s3): scan paper into an editable document, and a receipt into a spreadsheet row, end to end on the phone.
//  1. By voice in two wordings: the scanner opens on DOCUMENT and says what to do.
//  2. DOCUMENTS → SCAN A PAGE opens the same scanner.
//  3. A photographed letter (a big heading, an address on the right, two paragraphs) → KEEP PAGE → READ ALL (the phone's own reader, a
//     real wait) → INTO A DOCUMENT: a document opens with a heading, the address kept to the right and the paragraphs, kept on this phone;
//     it is editable, UNDO works, and a Word file of it reads back with the same heading and paragraphs.
//  4. The read text edited by hand → INTO A DOCUMENT uses his words (blank lines part paragraphs, a short line over them is a heading).
//  5. A receipt → RECEIPT TO SPREADSHEET: date, shop and total read for him to check; ADD ROW adds row 2 of RECEIPTS; UNDO takes it out;
//     again, and OPEN THE SPREADSHEET shows the row. Empty and error states in his words.
import { ask, goDocs, docOf, exported } from './editorspaperkit.mjs';

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS, SMALL, body21 } = h;
  const pick = (page, name, b64) => page.locator('#pg-lens input[type=file]').first().setInputFiles({ name, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  const photo = (page, kind) => page.evaluate(async (kind) => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 1600;
    const g = c.getContext('2d');
    g.fillStyle = '#3a2d22';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f6f3ec';
    g.fillRect(150, 90, 900, 1420);
    g.fillStyle = '#111';
    if (kind === 'letter') {
      g.font = '30px sans-serif';
      for (const [k, t] of ['12 Elm Road', 'Birmingham', 'B15 2TT'].entries()) g.fillText(t, 760, 190 + k * 42);
      g.font = 'bold 66px sans-serif';
      g.fillText('Rent Review', 220, 420);
      g.font = '34px sans-serif';
      for (const [k, t] of ['Your rent will stay the same', 'until the end of next March.', 'Thank you for paying on time.'].entries()) g.fillText(t, 220, 540 + k * 48);
      for (const [k, t] of ['The boiler service is booked', 'for Tuesday morning at nine.'].entries()) g.fillText(t, 220, 800 + k * 48);
    } else {
      g.font = 'bold 54px sans-serif';
      g.fillText('CORNER SHOP', 300, 260);
      g.font = '40px monospace';
      g.fillText('12/11/2026  10:42', 260, 380);
      g.fillText('Milk 2L        1.65', 260, 500);
      g.fillText('Bread          1.40', 260, 560);
      g.fillText('Apples         2.35', 260, 620);
      g.font = 'bold 46px monospace';
      g.fillText('TOTAL  5.40', 260, 760);
      g.font = '36px monospace';
      g.fillText('Thank you', 260, 880);
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const b of buf) s += String.fromCharCode(b);
    return btoa(s);
  }, kind);
  const keepAndRead = async (page, b64, name) => {
    await pick(page, name, b64);
    check(await until(page, () => { const c = document.querySelector('#pg-lens canvas.scanedit'); return !!c && !c.closest('[hidden]') && c.width > 0; }), `scan: the corner editor opens for the ${name}`);
    await page.locator('#pg-lens button', { hasText: 'KEEP PAGE' }).click();
    await until(page, () => window.__ghosty?.scan?.pages >= 1, null, 20000);
    await page.locator('#pg-lens button', { hasText: 'READ ALL' }).click();
    return until(page, () => (document.querySelector('#pg-lens textarea.lensocr:not([hidden])')?.value ?? '').length > 10, null, 150000);
  };

  const { ctx, page } = await open({ look: LOOKS.scan });
  // 1. voice, two wordings
  for (const words of ['scan this letter into a document', 'turn this letter into a document I can edit']) {
    const r = await ask(page, words, /INTO A DOCUMENT/);
    check(r.ok, `scan: “${words}” is answered with the steps (${r.text.slice(0, 90)})`);
    check(await until(page, () => window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'document' && window.__ghosty?.paper?.want === 'doc'), `scan: “${words}” opens the scanner on DOCUMENT, waiting for a letter`);
  }
  const r2 = await ask(page, 'scan a receipt into my spreadsheet', /RECEIPT TO SPREADSHEET/);
  check(r2.ok && await until(page, () => window.__ghosty?.paper?.want === 'receipt'), 'scan: “scan a receipt into my spreadsheet” opens the scanner for a receipt');
  // 2. DOCUMENTS → SCAN A PAGE
  await goDocs(page);
  await page.locator('#pg-docs .dcbar button', { hasText: 'SCAN A PAGE' }).click();
  check(await until(page, () => location.hash.includes('lens') && window.__ghosty?.scan?.sub === 'document' && window.__ghosty?.paper?.want === 'doc'), 'scan: DOCUMENTS → SCAN A PAGE opens the scanner on DOCUMENT');

  // 3. a letter, read and made a document
  check(await page.locator('#pg-lens button', { hasText: 'INTO A DOCUMENT' }).isHidden(), 'scan: INTO A DOCUMENT waits until there are words');
  const t0 = Date.now();
  check(await keepAndRead(page, await photo(page, 'letter'), 'letter.jpg'), 'scan: READ ALL reads the letter on the phone');
  const read = await page.locator('#pg-lens textarea.lensocr').first().inputValue();
  console.log(`     read in ${Date.now() - t0} ms: ${JSON.stringify(read.slice(0, 160))}`);
  await page.locator('#pg-lens button', { hasText: 'INTO A DOCUMENT' }).click();
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /scanned on this phone/.test(JSON.parse(window.__ghosty.docs.json).from ?? '')), 'scan: INTO A DOCUMENT opens it in DOCUMENTS');
  let d = await docOf(page);
  const types = d.blocks.map((b) => b.t).join(',');
  const words = d.blocks.map((b) => b.runs.map((r) => r.text).join('')).join(' | ');
  console.log(`     ${d.title} :: ${types} :: ${words.slice(0, 200)}`);
  check(/rent review/i.test(d.title), `scan: the big heading is the document’s title (“${d.title}”)`);
  check(d.blocks[0]?.t === 'right' && !d.blocks.some((b) => /rent review/i.test(b.runs.map((r) => r.text).join(''))), `scan: the title is not said twice, the address first (${types})`);
  const right = d.blocks.find((b) => b.t === 'right');
  check(right && /Elm Road\s*\n\s*Birmingham\s*\n\s*B15/i.test(right.runs.map((r) => r.text).join('')), `scan: the address stays on the right with its line breaks (${types})`);
  const paras = d.blocks.filter((b) => b.t === 'p').map((b) => b.runs.map((r) => r.text).join(''));
  check(paras.length >= 2 && paras.some((p) => /stay the same until the end/i.test(p)) && paras.some((p) => /boiler.*nine/i.test(p)), `scan: the two paragraphs come as two paragraphs, their lines joined (${paras.length})`);
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]').some((x) => /scanned on this phone/.test(x.from ?? ''))), 'scan: the document is kept on this phone');
  // editable, with undo
  await page.locator('.dcpage .dcb', { hasText: 'boiler' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Ring first.');
  await page.locator('.dctitle').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.some((b) => /Ring first\./.test(b.runs.map((r) => r.text).join('')))), 'scan: the scanned words are his to edit');
  await page.locator('.dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).blocks.some((b) => /Ring first/.test(b.runs.map((r) => r.text).join('')))), 'scan: UNDO takes the edit back');
  // Word out and back in: the same heading and paragraphs
  const word = await exported(page, 'WORD');
  check(word.bytes[0] === 0x50 && word.bytes[1] === 0x4b, `scan: the scanned letter saves as a Word file (${word.bytes.length} bytes)`);
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Rent back.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Rent back|Rent Review/i.test(JSON.parse(window.__ghosty.docs.json).title)), 'scan: the Word file reads back in');
  const back = await docOf(page);
  const backParas = back.blocks.filter((b) => b.t === 'p').length;
  check(backParas >= 2 && back.blocks.some((b) => b.t === 'right' || b.align === 'right'), `scan: and keeps the paragraphs and the address on the right (${back.blocks.map((b) => b.t).join(',')})`);
  await page.keyboard.press('Escape');

  // 4. his own edits to the read text are what is used
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'document' }));
  await page.waitForSelector('#pg-lens textarea.lensocr:not([hidden])');
  await page.locator('#pg-lens textarea.lensocr').first().fill('SCHOOL TRIP\n\nThe coach leaves at eight\nfrom the front gate.\n\nBring a packed lunch.');
  await page.locator('#pg-lens button', { hasText: 'INTO A DOCUMENT' }).click();
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).title === 'SCHOOL TRIP'), 'scan: edited text becomes a document titled by its heading');
  d = await docOf(page);
  check(d.blocks.map((b) => b.t).join(',') === 'p,p' && /coach leaves at eight from the front gate/.test(d.blocks[0].runs[0].text), `scan: his blank lines part the paragraphs, his line breaks inside one are joined (${d.blocks.map((b) => b.t).join(',')})`);
  await page.keyboard.press('Escape');

  // 5. a receipt into a spreadsheet row
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'document' }));
  await page.locator('#pg-lens button', { hasText: 'CLEAR' }).click();
  check(await keepAndRead(page, await photo(page, 'receipt'), 'receipt.jpg'), 'scan: READ ALL reads the receipt');
  console.log(`     receipt read: ${JSON.stringify((await page.locator('#pg-lens textarea.lensocr').first().inputValue()).slice(0, 160))}`);
  await page.locator('#pg-lens button', { hasText: 'RECEIPT TO SPREADSHEET' }).click();
  await page.waitForSelector('.pprsheet');
  const got = await page.evaluate(() => ({ date: document.querySelector('.pprsheet input[type=date]').value, shop: document.querySelector('.pprsheet input[aria-label="The shop"]').value, total: document.querySelector('.pprsheet input[aria-label^="The total"]').value }));
  check(got.total === '5.40', `scan: the receipt’s total is read (${got.total})`);
  check(got.date === '2026-11-12', `scan: its date is read (${got.date})`);
  check(/corner shop/i.test(got.shop), `scan: its shop is read (${got.shop})`);
  // states: a total that is not a number is said
  await page.fill('.pprsheet input[aria-label^="The total"]', 'five');
  await page.locator('.pprsheet button', { hasText: 'ADD ROW' }).click();
  check(await until(page, () => /number of pounds/.test(document.querySelector('.pprsaid')?.textContent ?? '')), 'scan: a total that is not a number is said in his words');
  await page.fill('.pprsheet input[aria-label^="The total"]', '5.40');
  await page.fill('.pprsheet input[aria-label="The shop"]', 'Corner Shop');
  await settle(page); // (the tap's press and the card's entrance finish first, so the keys are measured at rest)
  await measure(page, '.pprsheet', 'scan: the receipt card');
  await page.locator('.pprsheet button', { hasText: 'ADD ROW' }).click();
  const rowOf = () => page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem('ghosty.sheets') ?? '[]').find((x) => x.title === 'Receipts');
    const c = b?.sheets[0].cells ?? {};
    return b ? { head: [c.A1?.v, c.B1?.v, c.C1?.v].join('|'), a2: c.A2?.v, b2: c.B2?.v, c2: c.C2?.v } : null;
  });
  check(await until(page, () => /as row 2/.test(document.querySelector('.pprsaid')?.textContent ?? '')), 'scan: ADD ROW says it went in as row 2');
  let row = await rowOf();
  check(row?.head === 'Date|Shop|Total' && row.b2 === 'Corner Shop' && row.c2 === 5.4 && typeof row.a2 === 'number', `scan: RECEIPTS has its header and the row, kept on this phone (${JSON.stringify(row)})`);
  await page.locator('.pprsheet button', { hasText: 'UNDO' }).click();
  check(await until(page, () => /taken out/.test(document.querySelector('.pprsaid')?.textContent ?? '')) && !(await rowOf()), 'scan: UNDO takes the row (and the new spreadsheet) out');
  await page.locator('.pprsheet button', { hasText: 'ADD ROW' }).click();
  await until(page, () => /as row 2/.test(document.querySelector('.pprsaid')?.textContent ?? ''));
  await page.locator('.pprsheet button', { hasText: 'OPEN THE SPREADSHEET' }).click();
  check(await until(page, () => window.__ghosty?.sheets?.view === 'book' || /Receipts/.test(document.querySelector('.modal')?.textContent ?? '')), 'scan: OPEN THE SPREADSHEET opens Receipts');
  await page.screenshot({ path: `${h.out}/paper-receipt.png` });
  await ctx.close();

  // the scanner's keys at 390 and at BODY 21
  for (const r of [{ name: 'scan at 390', viewport: SMALL, big: false }, { name: 'scan at BODY 21', viewport: h.PHONE, big: true }]) {
    const { ctx: c2, page: p2 } = await open({ look: LOOKS.scan, viewport: r.viewport });
    await p2.evaluate(() => window.__ghosty.run('open_lens', { mode: 'document' }));
    await p2.waitForSelector('#pg-lens button:has-text("CAPTURE PAGE")');
    if (r.big) await body21(p2);
    await p2.evaluate(() => {
      const t = document.querySelector('#pg-lens textarea.lensocr');
      t.hidden = false;
      t.value = 'Dear Sam,\n\nThe keys are with the agent.';
      t.dispatchEvent(new Event('input'));
    });
    await settle(p2);
    await measure(p2, '#pg-lens .scanpaper', `scan: the paper keys, ${r.name}`);
    await c2.close();
  }
}
