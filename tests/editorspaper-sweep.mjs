// PAPER, part 7: the specialist sweep of DOCUMENTS against Pages and Word, end to end.
//  1. A word goal (PAGE → Word count goal → SET GOAL): the line under the title counts towards it, says when it is reached, is kept, UNDO.
//  2. Words chosen: the line says how many words are chosen, as Word's and Pages' counts do.
//  3. MAKE A COPY: the same words and comments under "(copy)", the first untouched.
//  4. MY DOCUMENTS' search, over titles and words, with its empty state in his words.
//  5. Text colour (WRITE → COLOUR): chosen words coloured, drawn so, UNDO; kept in the Word file (and back), the web page and the PDF.
import { goDocs, exported } from './editorspaperkit.mjs';

const mk = (id, title, words, at) => ({ id, title, kind: 'document', at, blocks: [{ id: `${id}1`, t: 'p', runs: [{ text: words }] }] });

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS } = h;
  const now = Date.now();
  const docs = [
    mk('dw1', 'Essay on rivers', 'Rivers carve valleys over thousands of years and carry silt to the sea.', now + 4000),
    mk('dw2', 'Shopping', 'Eggs, flour, butter and a lemon.', now + 3000),
    mk('dw3', 'Letter to the council', 'I am writing about the bins on Elm Road, which were missed again.', now + 2000),
    mk('dw4', 'Holiday plan', 'Ferry to Belfast on the ninth.', now + 1000),
  ];
  docs[0].comments = [{ id: 'cw1', block: 'dw11', start: 0, end: 6, quote: 'Rivers', text: 'Name one river.', at: now, replies: [] }];
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': docs } });
  const meta = () => page.locator('#pg-docs .dcmeta').textContent();
  await goDocs(page);

  // 4 first: the search on MY DOCUMENTS
  await page.waitForSelector('#pg-docs input[aria-label="Search my documents"]');
  await page.fill('#pg-docs input[aria-label="Search my documents"]', 'elm road');
  check(await until(page, () => document.querySelectorAll('#pg-docs .dcopen').length === 1 && /Letter to the council/.test(document.querySelector('#pg-docs .dcopen').textContent) && /1 of 4 documents with “elm road”/.test(document.querySelector('#pg-docs .dcview').textContent)), 'sweep: the search finds a document by its words');
  await page.fill('#pg-docs input[aria-label="Search my documents"]', 'zebra');
  check(await until(page, () => !document.querySelector('#pg-docs .dcopen') && /No document has “zebra” in it\./.test(document.querySelector('#pg-docs .dcview').textContent)), 'sweep: and says so when none has the words');
  await page.fill('#pg-docs input[aria-label="Search my documents"]', '');
  check(await until(page, () => document.querySelectorAll('#pg-docs .dcopen').length === 4), 'sweep: an empty search shows them all');
  await settle(page);
  // (the screen's entrance scales it in: measured once it has come to rest)
  await until(page, () => [...document.querySelectorAll('#pg-docs .dcbar button')].every((b) => b.getBoundingClientRect().height >= 43.5), null, 3000);
  await measure(page, '#pg-docs', 'sweep: MY DOCUMENTS with its search');

  // 1. a word goal
  await page.locator('.dcopen', { hasText: 'Essay on rivers' }).first().click();
  await until(page, () => window.__ghosty?.docs?.view === 'doc');
  await page.locator('#pg-docs .dcpill', { hasText: 'PAGE' }).click();
  await page.fill('#pg-docs input[aria-label="Word count goal"]', '20');
  await page.locator('#pg-docs button', { hasText: 'SET GOAL' }).click();
  check(await until(page, () => window.__ghosty.docs.goal === 20 && /goal 20: \d+%/.test(document.querySelector('#pg-docs .dcmeta').textContent)), `sweep: the goal is set and counted towards (${await meta()})`);
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.docs')).find((d) => d.id === 'dw1')?.goal === 20), 'sweep: the goal is kept with the document');
  await page.locator('#pg-docs .dcpage .dcb').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' The Severn is the longest river in Britain and floods most winters.');
  await page.locator('#pg-docs .dctitle').click();
  check(await until(page, () => /goal 20: reached/.test(document.querySelector('#pg-docs .dcmeta').textContent)), `sweep: past it, the line says the goal is reached (${await meta()})`);
  for (let k = 0; k < 5 && JSON.parse(await page.evaluate(() => window.__ghosty.docs.json)).blocks[0].runs[0].text.includes('Severn'); k++) await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => !/Severn/.test(window.__ghosty.docs.json) && JSON.parse(window.__ghosty.docs.json).goal === 20), 'sweep: UNDO takes the words back, the goal stays');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).goal && !/goal/.test(document.querySelector('#pg-docs .dcmeta').textContent)), 'sweep: one more UNDO takes the goal back');

  // 2. words chosen
  await page.evaluate(() => {
    const el = document.querySelector('#pg-docs .dcpage .dcb');
    el.focus();
    const t = el.firstChild;
    const r = document.createRange();
    r.setStart(t, 0);
    r.setEnd(t, 'Rivers carve valleys'.length);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  check(await until(page, () => window.__ghosty.docs.chosen === 3 && /^3 words chosen of \d+ words/.test(document.querySelector('#pg-docs .dcmeta').textContent)), `sweep: the line says how many words are chosen (${await meta()})`);
  await page.evaluate(() => getSelection().removeAllRanges());
  check(await until(page, () => window.__ghosty.docs.chosen === 0 && !/chosen/.test(document.querySelector('#pg-docs .dcmeta').textContent)), 'sweep: and stops when nothing is chosen');

  // 3. make a copy
  await page.locator('#pg-docs button', { hasText: 'MAKE A COPY' }).click();
  check(await until(page, () => window.__ghosty.docs.title === 'Essay on rivers (copy)' && JSON.parse(window.__ghosty.docs.json).comments?.length === 1), 'sweep: MAKE A COPY opens the copy, its comment with it');
  check(await until(page, () => { const all = JSON.parse(localStorage.getItem('ghosty.docs')); return all.length === 5 && all.some((d) => d.id === 'dw1' && d.title === 'Essay on rivers') && all.some((d) => d.title === 'Essay on rivers (copy)' && d.id !== 'dw1'); }), 'sweep: both are kept, the first as it was');
  await page.locator('#pg-docs .dcpage .dcb').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Copy only.');
  await page.locator('#pg-docs .dctitle').click();
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.docs')).find((d) => d.id === 'dw1').blocks[0].runs[0].text.endsWith('the sea.')), 'sweep: a change to the copy leaves the first alone');

  // 5. text colour
  await page.locator('#pg-docs .dcpill', { hasText: 'WRITE' }).click();
  await page.evaluate(() => {
    const el = document.querySelector('#pg-docs .dcpage .dcb');
    el.focus();
    const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes('valleys'));
    const i = t.textContent.indexOf('valleys');
    const r = document.createRange();
    r.setStart(t, i);
    r.setEnd(t, i + 'valleys'.length);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  await page.locator('#pg-docs button[aria-label="Text colour"]').click();
  await page.locator('#pg-docs button[aria-label="Blue text"]').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.c === 'blue' && r.text === 'valleys')), 'sweep: COLOUR → BLUE colours the chosen word, kept as its colour');
  check(await until(page, () => document.querySelector('#pg-docs .dcpage .dctc[data-tc="2"]')?.textContent === 'valleys'), 'sweep: and the page draws it blue');
  await settle(page);
  await measure(page, '#pg-docs .dcpanel:not([hidden])', 'sweep: WRITE with its colours');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.c)), 'sweep: UNDO takes the colour off');
  await page.locator('#pg-docs .dctools button', { hasText: /^REDO$/ }).click();
  await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.some((r) => r.c === 'blue'));
  const html = (await exported(page, 'HTML')).bytes.toString();
  check(/<span style="color:royalblue">valleys<\/span>/.test(html), 'sweep: the web page keeps the colour');
  const pdf = (await exported(page, 'PDF')).bytes.toString('latin1');
  check(/0\.12 0\.37 0\.75 rg/.test(pdf), 'sweep: the PDF draws it blue');
  const word = await exported(page, 'WORD');
  check(/w:color w:val="1F5FBF"/.test(word.bytes.toString('latin1')), 'sweep: the Word file carries the colour');
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Rivers back.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.runs.some((r) => r.c === 'blue' && r.text === 'valleys'))), 'sweep: and reading the Word file back keeps the word blue');
  await ctx.close();
}
