// DOCUMENTS PRO, part 2: his own TRACKED CHANGES, end to end on the phone.
//  1. REVIEW says there are none; TRACK CHANGES on is said and kept.
//  2. Typing at the end of a paragraph is marked as put in (underlined, with its time); backspacing over it takes it out for good;
//     a backspace over his original words strikes them (still in the page); REVIEW lists each.
//  3. ACCEPT one, REJECT one, UNDO; ACCEPT ALL and REJECT ALL; Ghosty's suggestions stay their own thing.
//  4. Word out and back in: w:ins and w:del in the file, and they come back as his tracked changes with TRACK CHANGES on.
import { docOf, exported, openDoc, pill, proDoc, reopen, said, tool } from './docspro-kit.mjs';

const runsOf = (page, k) => page.evaluate((i) => JSON.parse(window.__ghosty.docs.json).blocks[i].runs.map((r) => `${r.tc ?? '='}:${r.text}`).join('|'), k);

export default async function (h) {
  const { open, check, until, settle, measure, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [proDoc()] } });
  check(await openDoc(h, page, 'Boiler service'), 'track: the document opens');
  await pill(page, 'review');
  check(await until(page, () => /No tracked changes\. Turn TRACK CHANGES on/.test(document.querySelector('#pg-docs .dcreview')?.textContent ?? '')), 'track: REVIEW says there are none, and how to start');
  await page.locator('#pg-docs .dctrack').click();
  check(await until(page, () => window.__ghosty.docs.track === true && JSON.parse(window.__ghosty.docs.json).track === true && document.querySelector('#pg-docs .dctrack').getAttribute('aria-pressed') === 'true'), 'track: TRACK CHANGES on, kept with the document');
  check(/Track changes is on/.test(await said(page)), 'track: and said');

  // 2. typing and deleting, marked
  const para = page.locator('#pg-docs .dcpage [data-id="dpro3"]');
  await para.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' today');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].runs.some((r) => r.tc === 'ins' && r.text === ' today')), `track: what he types is marked as put in (${await runsOf(page, 2)})`);
  check(await page.locator('#pg-docs .dcpage [data-id="dpro3"] ins.dcins').count() === 1, 'track: drawn underlined in the page');
  check(await until(page, () => window.__ghosty.docs.changes === 1 && /Put in “ today”/.test(document.querySelector('#pg-docs .dcreview')?.textContent ?? '')), 'track: REVIEW lists it with its time');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].runs.map((r) => r.text).join('') === 'Please fix the tap soon.' && window.__ghosty.docs.changes === 0), `track: backspacing over his own words takes them out for good (${await runsOf(page, 2)})`);
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].runs.some((r) => r.tc === 'del' && r.text === 'soon.')), `track: backspacing over his original words strikes them (${await runsOf(page, 2)})`);
  check(await page.locator('#pg-docs .dcpage [data-id="dpro3"] del.dcdel').innerText() === 'soon.', 'track: still in the page, struck');
  await page.keyboard.type('now');
  check(await until(page, () => window.__ghosty.docs.changes === 2), `track: a new word typed in their place is a change of its own (${await runsOf(page, 2)})`);
  check(await runsOf(page, 2) === '=:Please fix the tap |ins:now|del:soon.', `track: in the right order (${await runsOf(page, 2)})`);
  await page.locator('#pg-docs .dcpage [data-id="dpro5"]').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Thanks');
  check(await until(page, () => window.__ghosty.docs.changes === 3), 'track: three changes listed');
  await settle(page);
  await measure(page, '#pg-docs .dcpanel[aria-label="Review"]', 'track: the REVIEW panel with its changes');

  // 3. accept, reject, undo, all
  await page.locator('#pg-docs .dcchg', { hasText: 'Deleted “soon.”' }).locator('button', { hasText: /^REJECT$/ }).click();
  check(await until(page, () => window.__ghosty.docs.changes === 2) && await runsOf(page, 2) === '=:Please fix the tap |ins:now|=:soon.', `track: REJECT puts the deleted words back (${await runsOf(page, 2)})`);
  check(/^Rejected: Deleted “soon\.”.*UNDO takes it back\.$/.test(await said(page)), `track: said (${await said(page)})`);
  await page.locator('#pg-docs .dcchg', { hasText: 'Put in “now”' }).locator('button', { hasText: /^ACCEPT$/ }).click();
  check(await until(page, () => window.__ghosty.docs.changes === 1) && await runsOf(page, 2) === '=:Please fix the tap nowsoon.', `track: ACCEPT makes his words plain (${await runsOf(page, 2)})`);
  await tool(page, 'UNDO');
  check(await until(page, () => window.__ghosty.docs.changes === 2), 'track: UNDO takes the accept back');
  await page.locator('#pg-docs .dcreview button', { hasText: /^ACCEPT ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.changes === 0 && /Thanks/.test(window.__ghosty.docs.text)), 'track: ACCEPT ALL settles every change');
  await tool(page, 'UNDO');
  check(await until(page, () => window.__ghosty.docs.changes === 2), 'track: UNDO brings them back');

  // 4. Word out and back in (two changes waiting)
  const word = await exported(page, 'WORD');
  const xml = word.bytes.toString('utf8');
  check(/<w:ins w:id="\d+" w:author="[^"]*" w:date="\d{4}-\d\d-\d\dT[^"]+">/.test(xml) && /<w:trackRevisions\/>/.test(xml), 'track: the Word file has them as Word’s own tracked changes, TRACK CHANGES on');
  check(await reopen(h, page, word.bytes, 'Boiler tracked.docx'), 'track: the Word file opens again');
  const back = await docOf(page);
  const changes = back.blocks.flatMap((b) => b.runs.filter((r) => r.tc).map((r) => `${r.tc}:${r.text}`));
  check(back.track === true && changes.join('|') === 'ins:now| Thanks'.replace('| Thanks', '|ins: Thanks'), `track: they come back as his tracked changes (${changes.join('|')}, track ${back.track})`);
  await pill(page, 'review');
  check(await until(page, () => window.__ghosty.docs.changes === 2 && document.querySelectorAll('#pg-docs .dcchg').length === 2), 'track: listed in REVIEW again');
  await page.locator('#pg-docs .dcreview button', { hasText: /^REJECT ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.changes === 0 && !/Thanks|now/.test(window.__ghosty.docs.text)), 'track: REJECT ALL takes all his changes out');
  await ctx.close();
}
