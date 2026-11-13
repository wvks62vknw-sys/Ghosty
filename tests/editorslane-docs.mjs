// THE EDITORS LANE, DOCUMENTS (against Pages and Word): the new everyday tools, end to end on the phone.
//  1. STRIKE (S) and HIGHLIGHT (MARK) on chosen words, kept as marks in the document and drawn on the page; a second press takes it off.
//  2. CHECKLIST: a paragraph made a checklist item with its own 44 pt box; ticking it is kept; Enter on an empty item ends the list.
//  3. UNDO and REDO step the tick back and forth.
//  4. Round trips: Markdown out (~~struck~~, ==highlighted==, - [x] ticked) and back in; Word out (<w:strike/>, <w:highlight/>, the box) and
//     back in, with the same marks and the same ticks.
//  5. The editor with all of it in all seven looks at 440 × 956, The Scan at 390 × 844, and at BODY 21: every key 44 pt, nothing sideways.
import { readFileSync } from 'node:fs';

export default async function (h) {
  const { open, check, until, measure, body21, LOOKS, PHONE, SMALL } = h;
  const docs = (page) => page.evaluate(() => JSON.parse(window.__ghosty.docs.json || 'null'));
  const goDocs = async (page) => {
    // MAKE → EDITORS → DOCUMENTS where the look draws the pill; the screen's own address where it does not
    await page.evaluate(() => (location.hash = 'area-make'));
    const pill = '#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="docs"]';
    if (await page.waitForSelector(pill, { timeout: 6000 }).then(() => true, () => false)) await page.click(pill);
    else await page.evaluate(() => (location.hash = 'docs'));
    await page.waitForSelector('#pg-docs .dcsheet', { timeout: 15000 });
  };
  const aria = (page, label) => page.locator(`.dcsheet button[aria-label="${label}"]`).first();
  const tool = (page, label) => page.locator('.dctools button, .dcexport button').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const select = (page, text, word) => page.evaluate(([t, w]) => {
    const el = [...document.querySelectorAll('.dcpage .dcb')].find((e) => e.textContent.includes(t));
    if (!el) return false;
    el.focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent.indexOf(w);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + w.length);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      return true;
    }
    return false;
  }, [text, word]);
  const saved = async (page, label, file) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), (async () => {
      await page.locator('.dcexport button', { hasText: label }).click();
      await page.waitForSelector(`.dcouts .cvoutt b:text-is("${file}")`);
      await page.locator('.dcouts button', { hasText: 'SAVE' }).click();
    })()]);
    return readFileSync(await dl.path());
  };
  const marksOf = (d) => {
    const runs = d.blocks.flatMap((b) => b.runs ?? []);
    return {
      struck: runs.filter((r) => r.s).map((r) => r.text.trim()).join('|'),
      lit: runs.filter((r) => r.hl).map((r) => r.text.trim()).join('|'),
      todos: d.blocks.filter((b) => b.t === 'todo').map((b) => `${b.ticked ? 'x' : ' '}${b.runs.map((r) => r.text).join('')}`).join('|'),
    };
  };

  // ---------------------------------------------------------------- 1 to 4, one phone, The Scan
  {
    const { ctx, page } = await open({ look: LOOKS.scan });
    await goDocs(page);
    await page.locator('#pg-docs .dcbar button', { hasText: 'NEW' }).click();
    check(await until(page, () => window.__ghosty?.docs?.view === 'doc'), 'docs: NEW opens a blank page');
    await page.fill('.dctitle', 'Saturday');
    await page.press('.dctitle', 'Tab');
    await page.locator('.dcpage .dcb').first().click();
    await page.keyboard.type('Buy milk and bread today');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Call the plumber');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Pay the gas bill');
    await page.locator('.dcpage .dcb', { hasText: 'Buy milk' }).click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.map((b) => b.runs.map((r) => r.text).join('')).join('|') === 'Buy milk and bread today|Call the plumber|Pay the gas bill'), 'docs: three lines typed by the keyboard');

    // 1. strike and highlight
    check(await select(page, 'Buy milk', 'bread'), 'docs: the word “bread” is chosen');
    await aria(page, 'Strikethrough').click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.s && r.text === 'bread')), 'docs: S strikes through the chosen word, kept as a mark');
    check(await page.locator('.dcpage s', { hasText: 'bread' }).count() === 1, 'docs: the page draws it struck through');
    await select(page, 'Buy milk', 'today');
    await aria(page, 'Highlight').click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.hl && r.text === 'today')), 'docs: MARK highlights the chosen word');
    check(await page.locator('.dcpage mark.dchl', { hasText: 'today' }).count() === 1, 'docs: the page draws the highlight');
    await select(page, 'Buy milk', 'milk');
    await aria(page, 'Highlight').click();
    await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.hl && r.text === 'milk'));
    await select(page, 'Buy milk', 'milk');
    await aria(page, 'Highlight').click();
    check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.hl && r.text.includes('milk')) && JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.hl && r.text === 'today')), 'docs: MARK again on highlighted words takes the highlight off (the other stays)');
    await page.locator('.dcpage .dcb').first().evaluate((e) => e.blur());
    await page.evaluate(() => getSelection().removeAllRanges());
    await page.evaluate(() => { getSelection().removeAllRanges(); });
    // with nothing chosen, it says so in his words
    await page.evaluate(() => { const b = document.querySelector('.dcsheet button[aria-label="Strikethrough"]'); b.click(); });
    check(await until(page, () => /Choose the words first/.test(document.querySelector('#pg-docs')?.textContent ?? '')), 'docs: S with nothing chosen says “Choose the words first”');

    // 2. checklist
    await page.locator('.dcpage .dcb', { hasText: 'Call the plumber' }).click();
    await aria(page, 'Checklist').click();
    await page.locator('.dcpage .dcb', { hasText: 'Pay the gas bill' }).click();
    await aria(page, 'Checklist').click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.filter((b) => b.t === 'todo').length === 2), 'docs: CHECKLIST makes the two lines checklist items');
    check(await page.locator('.dcpage .dctodo .dcbox').count() === 2, 'docs: each item has its box');
    const box = await page.locator('.dcpage .dctodo .dcbox').first().boundingBox();
    check(box && box.width >= 43.5 && box.height >= 43.5, `docs: the box is 44 pt (${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'none'})`);
    await page.locator('.dcpage .dctodo .dcbox').first().click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.find((b) => b.t === 'todo')?.ticked === true), 'docs: tapping the box ticks it, kept');
    check(await until(page, () => document.querySelector('.dcpage .dctodo .dcbox')?.getAttribute('aria-checked') === 'true' && document.querySelector('.dcpage .dctodo')?.classList.contains('ticked')), 'docs: the ticked item is drawn done');
    check(await until(page, () => (JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]')[0]?.blocks ?? []).some((b) => b.t === 'todo' && b.ticked)), 'docs: the tick is kept on this phone');

    // 3. undo and redo
    await tool(page, 'UNDO').click();
    check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.ticked)), 'docs: UNDO takes the tick back');
    await tool(page, 'REDO').click();
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.t === 'todo' && b.ticked)), 'docs: REDO puts it back');

    // Enter on an empty checklist item ends the list
    const last = page.locator('.dcpage .dcb', { hasText: 'Pay the gas bill' });
    await last.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.filter((b) => b.t === 'todo').length === 3), 'docs: Enter on an item starts the next checklist item');
    await page.keyboard.press('Enter');
    check(await until(page, () => { const bs = JSON.parse(window.__ghosty.docs.json).blocks; return bs.filter((b) => b.t === 'todo').length === 2 && bs.at(-1).t === 'p'; }), 'docs: Enter on an empty item ends the list (a plain line, as Pages and Word do)');
    await page.keyboard.type('Back by six');
    await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.at(-1).runs.map((r) => r.text).join('') === 'Back by six', null, 3000);
    await page.locator('.dctitle').click();

    const before = marksOf(await docs(page));
    check(before.struck === 'bread' && before.lit === 'today' && before.todos === 'xCall the plumber| Pay the gas bill', `docs: the marks and ticks before the round trips (${JSON.stringify(before)})`);

    // 4. round trips: Markdown out and in
    const md = (await saved(page, 'MARKDOWN', 'Saturday.md')).toString();
    check(/~~bread~~/.test(md) && /==today==/.test(md) && /- \[x\] Call the plumber/.test(md) && /- \[ \] Pay the gas bill/.test(md), 'docs: Markdown writes ~~struck~~, ==highlighted== and the ticked and open items');
    await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).click();
    await page.setInputFiles('.dcsheet input[type=file][accept*=".md"]', { name: 'Saturday back.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
    check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Saturday/.test(JSON.parse(window.__ghosty.docs.json).title) && JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.t === 'todo')), 'docs: the Markdown is read back in');
    const mdBack = marksOf(await docs(page));
    check(JSON.stringify(mdBack) === JSON.stringify(before), `docs: Markdown out and in keeps the same marks and ticks (${JSON.stringify(mdBack)})`);
    check(await page.locator('.dcpage .dctodo .dcbox[aria-checked="true"]').count() === 1 && await page.locator('.dcpage s').count() === 1 && await page.locator('.dcpage mark.dchl').count() === 1, 'docs: and draws them');

    // Word out and in
    const word = await saved(page, 'WORD', `${(await docs(page)).title}.docx`);
    check(word.length > 1000 && word[0] === 0x50 && word[1] === 0x4b, `docs: WORD makes a .docx (${word.length} bytes)`);
    await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).click();
    await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Saturday word.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word });
    check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.t === 'todo')), 'docs: the Word file is read back in');
    const wordBack = marksOf(await docs(page));
    check(JSON.stringify(wordBack) === JSON.stringify(before), `docs: Word out and in keeps the same marks and ticks (${JSON.stringify(wordBack)})`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. every look, The Scan small, BODY 21
  const seedDoc = {
    id: 'dlane1', title: 'Moving day', kind: 'document', at: Date.now(),
    blocks: [
      { id: 'b1', t: 'h1', runs: [{ text: 'Before the van comes' }] },
      { id: 'b2', t: 'p', runs: [{ text: 'Keys go to ' }, { text: 'the agent', hl: true }, { text: ', not the ' }, { text: 'neighbour', s: true }, { text: '.' }] },
      { id: 'b3', t: 'todo', ticked: true, runs: [{ text: 'Book the van for nine in the morning' }] },
      { id: 'b4', t: 'todo', runs: [{ text: 'Read the gas and electricity meters and photograph them' }] },
    ],
  };
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed: { 'ghosty.docs': [seedDoc] } });
    await goDocs(page);
    await page.locator('.dcopen', { hasText: 'Moving day' }).first().click();
    const ok = await until(page, () => window.__ghosty?.docs?.view === 'doc' && document.querySelectorAll('.dcpage .dctodo').length === 2);
    check(ok, `docs ${r.name}: the document opens with its checklist`);
    if (r.big) await body21(page);
    await page.locator('.dcpage .dcb', { hasText: 'Keys go' }).click();
    await measure(page, '#pg-docs', `docs ${r.name}`);
    await ctx.close();
  }
}
