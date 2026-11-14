// PAPER, part 3 (editors.s2): mail merge, end to end on the phone.
//  1. By voice ("mail merge", "make this letter for everyone in my spreadsheet") it opens on his latest document's MAIL MERGE.
//  2. A letter and a spreadsheet of three guests (a formula among them): the column's key puts {{Name}} where the caret is; a typed
//     {{Town}} counts too; a field with no column ({{Phone}}) is said, and UNDO takes it out again.
//  3. The copies step one by one (1 of 3, NEXT, 2 of 3), each filled from its own row.
//  4. ONE WORD FILE (read back in: three copies, page breaks between), ONE PDF (three pages), SEPARATE FILES (a zip of three PDFs,
//     named by each guest). Empty states in his words.
import { readFileSync } from 'node:fs';
import { ask, goDocs, docOf } from './editorspaperkit.mjs';

export const guestsBook = () => ({
  id: 'shguests', title: 'Party guests', at: Date.now(), names: {}, charts: [], view: { sheet: 0, sel: 'A1' },
  sheets: [{ name: 'Sheet1', widths: {}, heights: {}, frozen: true, cells: {
    A1: { v: 'Name' }, B1: { v: 'Address' }, C1: { v: 'Town' }, D1: { v: 'Seats' },
    A2: { v: 'Sam Khan' }, B2: { v: '4 Mill Lane' }, C2: { v: 'Leeds' }, D2: { f: '1+1' },
    A3: { v: 'Ruth Ellis' }, B3: { v: '9 High Street' }, C3: { v: 'York' }, D3: { v: 1 },
    A4: { v: 'Omar Shah' }, B4: { v: '22 Park Road' }, C4: { v: 'Hull' }, D4: { v: 3 },
  } }],
});
export const letterDoc = () => ({
  id: 'dinvite', title: 'Invitation', kind: 'letter', at: Date.now() + 1000,
  blocks: [
    { id: 'm1', t: 'p', runs: [{ text: 'Dear ' }] },
    { id: 'm2', t: 'p', runs: [{ text: 'Please come to the party on Saturday. We have kept ' }, { text: 'seats', b: true }, { text: ' for you.' }] },
    { id: 'm3', t: 'p', runs: [{ text: 'Coming from ' }] },
  ],
});

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.sheets': [guestsBook()], 'ghosty.docs': [letterDoc()] } });
  const merge = () => page.evaluate(() => window.__ghosty?.merge ?? null);
  const caretAtEnd = (text) => page.evaluate((t) => {
    const el = [...document.querySelectorAll('.dcpage .dcb')].find((e) => e.textContent.startsWith(t));
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  }, text);
  const status = () => page.evaluate(() => window.__ghosty?.docs?.said ?? '');

  // 1. voice
  for (const words of ['mail merge', 'make this letter for everyone in my spreadsheet']) {
    const r = await ask(page, words, /choose the spreadsheet of names/);
    check(r.ok, `merge: “${words}” is answered (${r.text.slice(-70)})`);
    check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && window.__ghosty.docs.title === 'Invitation' && !!document.querySelector('.dcmergebox:not([hidden]) .dcmerge select')), `merge: “${words}” opens the latest letter with MAIL MERGE showing`);
    await page.keyboard.press('Escape');
  }

  // 2. fields into the letter
  await goDocs(page);
  await page.locator('.dcopen', { hasText: 'Invitation' }).first().click();
  await until(page, () => window.__ghosty?.docs?.view === 'doc');
  await page.locator('#pg-docs .dctools button', { hasText: 'MAIL MERGE' }).click();
  await page.waitForSelector('#pg-docs .dcmerge select');
  check(await until(page, () => /no fields yet/.test(document.querySelector('#pg-docs .dcmerge')?.textContent ?? '') || !window.__ghosty.merge.book), 'merge: before a spreadsheet is chosen nothing is made');
  await page.locator('#pg-docs .dcmerge button', { hasText: 'ONE PDF' }).click();
  check(await until(page, () => /Choose the spreadsheet of names first/.test(window.__ghosty.docs.said)), 'merge: ONE PDF with no spreadsheet says to choose one');
  await page.selectOption('#pg-docs .dcmerge select', 'shguests');
  check(await until(page, () => window.__ghosty.merge.rows === 3 && window.__ghosty.merge.columns.join('|') === 'Name|Address|Town|Seats'), 'merge: the spreadsheet’s columns and its three rows are read');
  check(/no fields yet/.test(await page.locator('#pg-docs .dcmerge').textContent()), 'merge: a letter with no fields says so in his words');
  await caretAtEnd('Dear');
  await page.locator('#pg-docs .dcmergecols button', { hasText: '{{Name}}' }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs.map((r) => r.text).join('') === 'Dear {{Name}}'), 'merge: the column’s key puts {{Name}} where the caret is');
  await caretAtEnd('Coming from');
  await page.keyboard.type('{{Town}}');
  await page.locator('.dctitle').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].runs.map((r) => r.text).join('') === 'Coming from {{Town}}'), 'merge: a {{Town}} typed by hand counts too');
  await caretAtEnd('Coming from');
  await page.keyboard.type(', ring {{Phone}}');
  await page.locator('.dctitle').click();
  await until(page, () => /Phone/.test(JSON.parse(window.__ghosty.docs.json).blocks[2].runs.map((r) => r.text).join('')));
  await page.locator('#pg-docs .dcmerge button', { hasText: 'NEXT ›' }).click();
  check(await until(page, () => /\{\{Phone\}\} is not a column/.test(document.querySelector('#pg-docs .dcmerge')?.textContent ?? '')), 'merge: a field with no column is said');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => !/Phone/.test(JSON.parse(window.__ghosty.docs.json).blocks[2].runs.map((r) => r.text).join(''))), 'merge: UNDO takes it out of the letter');

  // 3. stepping the copies
  await page.locator('#pg-docs .dctools button', { hasText: 'MAIL MERGE' }).click();
  await page.locator('#pg-docs .dctools button', { hasText: 'MAIL MERGE' }).click();
  await page.selectOption('#pg-docs .dcmerge select', 'shguests');
  check(await until(page, () => window.__ghosty.merge.at === 0 && /Dear Sam Khan/.test(window.__ghosty.merge.preview) && /Coming from Leeds/.test(window.__ghosty.merge.preview) && window.__ghosty.merge.missing.length === 0), 'merge: copy 1 is Sam’s, filled from his row');
  check(/1 of 3/.test(await page.locator('#pg-docs .dcmerge').textContent()), 'merge: it says 1 of 3');
  await page.locator('#pg-docs .dcmerge button', { hasText: 'NEXT ›' }).click();
  check(await until(page, () => window.__ghosty.merge.at === 1 && /Dear Ruth Ellis/.test(window.__ghosty.merge.preview) && /York/.test(window.__ghosty.merge.preview)), 'merge: NEXT shows copy 2, Ruth’s');
  check(await until(page, () => /3 copies, one for each row, 2 fields filled in each/.test(document.querySelector('#pg-docs .dcmerge')?.textContent ?? '')), 'merge: and says how many copies and fields');
  await settle(page);
  await measure(page, '#pg-docs .dcmerge', 'merge: the panel');

  // 4. the files
  const save = async (label) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), (async () => {
      await page.locator('#pg-docs .dcmerge .cvbtns button', { hasText: label }).click();
      await page.waitForFunction((l) => (document.querySelector('#pg-docs .dcmerge .dcouts .cvoutt b')?.textContent ?? '').includes(l), label === 'ONE PDF' ? '.pdf' : label === 'ONE WORD FILE' ? '.docx' : '.zip', { timeout: 60000 });
      await page.locator('#pg-docs .dcmerge .dcouts button', { hasText: 'SAVE' }).click();
    })()]);
    return { bytes: readFileSync(await dl.path()), name: dl.suggestedFilename() };
  };
  const word = await save('ONE WORD FILE');
  check(word.name === 'Invitation (3 copies).docx' && word.bytes[0] === 0x50, `merge: ONE WORD FILE makes “${word.name}”`);
  const pdf = await save('ONE PDF');
  const pdfText = pdf.bytes.toString('latin1');
  check(pdf.name === 'Invitation (3 copies).pdf' && pdfText.startsWith('%PDF') && /\/Count 3\b/.test(pdfText), `merge: ONE PDF makes three pages (${pdf.bytes.length} bytes)`);
  const zip = await save('SEPARATE FILES');
  const zipText = zip.bytes.toString('latin1');
  check(zip.name === 'Invitation (3 files).zip' && zip.bytes[0] === 0x50 && ['Sam Khan', 'Ruth Ellis', 'Omar Shah'].every((n) => zipText.includes(`Invitation – ${n}.pdf`) || zipText.includes(Buffer.from(`Invitation – ${n}.pdf`).toString('latin1'))), 'merge: SEPARATE FILES makes a zip of a PDF for each guest, named by them');
  check(/Nothing was sent anywhere/.test(await status()), 'merge: and says nothing was sent');
  // the Word file read back: three copies, two page breaks
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Invitation copies.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Dear Omar Shah/.test(window.__ghosty.docs.text)), 'merge: the Word file reads back in');
  const back = await docOf(page);
  const text = back.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');
  check(['Dear Sam Khan', 'Dear Ruth Ellis', 'Dear Omar Shah', 'Coming from Hull'].every((t) => text.includes(t)) && back.blocks.filter((b) => b.t === 'pb').length === 2 && !/\{\{/.test(text), `merge: with every copy filled and a page break between them (${back.blocks.filter((b) => b.t === 'pb').length} breaks)`);
  check(back.blocks.some((b) => b.runs.some((r) => r.b && r.text === 'seats')), 'merge: and the letter’s bold kept in each copy');
  await ctx.close();
}
