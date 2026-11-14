// DOCUMENTS PRO, part 6: SPELLING AND GRAMMAR checked on the phone, with ACCEPT or IGNORE.
//  1. REVIEW → CHECK SPELLING AND GRAMMAR says it is checked here (nothing sent) and lists each finding with its fix.
//  2. ACCEPT puts one fix in (UNDO takes it back); IGNORE leaves his words and the finding does not come back; FIX ALL does the rest.
//  3. With TRACK CHANGES on, a fix is his tracked change (the old struck, the fix put in), and the Word file keeps it so.
//  4. A clean document is said to be clean.
import { docOf, exported, openDoc, pill, said, tool } from './docspro-kit.mjs';

const typos = () => ({
  id: 'dtypo', title: 'Repairs', kind: 'document', at: Date.now() + 4000,
  blocks: [
    { id: 'ty1', t: 'p', runs: [{ text: 'I recieve teh letter on Wendesday.' }] },
    { id: 'ty2', t: 'p', runs: [{ text: 'Please send the the engineer within a hour.' }] },
    { id: 'ty3', t: 'p', runs: [{ text: 'The colour of the organisation is grey.' }] },
  ],
});

export default async function (h) {
  const { open, check, until, settle, measure, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [typos()] } });
  check(await openDoc(h, page, 'Repairs'), 'proof: the document opens');
  await pill(page, 'review');
  check(await until(page, () => /checks the spelling and grammar here on this phone/i.test(document.querySelector('#pg-docs .dcproof')?.textContent ?? '') && window.__ghosty.docs.proof === -1), 'proof: REVIEW offers the check, said to stay on this phone');
  await page.locator('#pg-docs .dcproof button', { hasText: 'CHECK SPELLING AND GRAMMAR' }).click();
  check(await until(page, () => window.__ghosty.docs.proof === 5), `proof: five findings (${await page.evaluate(() => window.__ghosty.docs.proof)})`);
  const list = await page.evaluate(() => [...document.querySelectorAll('#pg-docs .dcissue .dcchggo')].map((b) => b.textContent).join(' | '));
  check(list === 'Spelling: “recieve” → “receive” | Spelling: “teh” → “the” | Spelling: “Wendesday” → “Wednesday” | The same word twice: “the the” → “the” | “an” before a vowel sound: “a hour” → “an hour”', `proof: each with its fix, in his words (${list})`);
  check(/5 things to look at, checked on this phone/.test(await said(page)), 'proof: said, checked on this phone');
  await settle(page);
  await measure(page, '#pg-docs .dcpanel[aria-label="Review"]', 'proof: the findings');

  await page.locator('#pg-docs .dcissue', { hasText: 'recieve' }).locator('button', { hasText: /^ACCEPT$/ }).click();
  check(await until(page, () => /I receive teh letter/.test(window.__ghosty.docs.text) && window.__ghosty.docs.proof === 4), 'proof: ACCEPT puts the fix in');
  check(/^Fixed: Spelling: “recieve” → “receive”\. UNDO puts it back\.$/.test(await said(page)), 'proof: and says so');
  await tool(page, 'UNDO');
  check(await until(page, () => /I recieve teh/.test(window.__ghosty.docs.text) && window.__ghosty.docs.proof === 5), 'proof: UNDO takes the fix back');
  await page.locator('#pg-docs .dcissue', { hasText: 'Wendesday' }).locator('button', { hasText: /^IGNORE$/ }).click();
  check(await until(page, () => window.__ghosty.docs.proof === 4 && !/Wendesday/.test(document.querySelector('#pg-docs .dcproof').textContent)), 'proof: IGNORE leaves his word and it does not come back');
  check(/Wendesday/.test(await page.evaluate(() => window.__ghosty.docs.text)), 'proof: his word as he wrote it');

  // 3. with TRACK CHANGES on
  await page.locator('#pg-docs .dctrack').click();
  await until(page, () => window.__ghosty.docs.track === true);
  await page.locator('#pg-docs .dcproof button', { hasText: /^FIX ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.proof === 0 && window.__ghosty.docs.changes === 8), `proof: FIX ALL, as tracked changes (${await page.evaluate(() => window.__ghosty.docs.changes)} changes)`);
  const runs = (await docOf(page)).blocks[1].runs.map((r) => `${r.tc ?? '='}:${r.text}`).join('|');
  check(runs === '=:Please send |del:the the|ins:the|=: engineer within |del:a hour|ins:an hour|=:.', `proof: the old struck, the fix put in (${runs})`);
  check(await until(page, () => /No spelling or grammar problems found\. Checked on this phone; nothing was sent\./.test(document.querySelector('#pg-docs .dcproof').textContent)), 'proof: then the document is said to be clean');
  const word = await exported(page, 'WORD');
  check(/<w:del [^>]*><w:r>(?:(?!<\/w:del>).)*a hour/.test(word.bytes.toString('utf8')), 'proof: the Word file keeps the fixes as tracked changes');
  await page.locator('#pg-docs .dcreview button', { hasText: /^ACCEPT ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.changes === 0 && /Please send the engineer within an hour\./.test(window.__ghosty.docs.text)), 'proof: ACCEPT ALL leaves the corrected words');
  await ctx.close();
}
