// DOCUMENTS PRO, part 4: FOLDING a heading's section away in the page, on top of CONTENTS' ▲ ▼ moves.
//  1. CONTENTS has ▾ by each heading (44 pt). ▾ on “What happened” hides its two paragraphs in the page; one line says how many are
//     folded; the document itself is untouched (no UNDO step), and the move keys still work on the folded section.
//  2. The line's UNFOLD and ▸ bring it back; FOLD ALL and UNFOLD ALL do every section; a heading with nothing under it is said.
import { openDoc, proDoc, said, tool } from './docspro-kit.mjs';

export default async function (h) {
  const { open, check, until, settle, measure, LOOKS } = h;
  const d = proDoc();
  d.blocks.push({ id: 'dpro7', t: 'h1', runs: [{ text: 'Nothing under' }] });
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [d] } });
  check(await openDoc(h, page, 'Boiler service'), 'fold: the document opens');
  await tool(page, 'CONTENTS');
  check(await until(page, () => document.querySelectorAll('#pg-docs .dccontents .dcsecfold').length === 3), 'fold: CONTENTS has a fold key by each heading');
  await settle(page);
  await measure(page, '#pg-docs .dccontents', 'fold: CONTENTS with its fold keys');
  const json = await page.evaluate(() => window.__ghosty.docs.json);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#pg-docs .dcpage .dcb')].map((e) => e.dataset.id).join(','));

  await page.locator('#pg-docs button[aria-label="Fold the section “What happened”"]').click();
  check(await until(page, () => !document.querySelector('#pg-docs .dcpage [data-id="dpro2"]') && !!document.querySelector('#pg-docs .dcpage .dcfolded')), 'fold: ▾ folds the section away in the page');
  check(await shown() === 'dpro1,dpro4,dpro5,dpro6,dpro7', `fold: the heading stays, its paragraphs go (${await shown()})`);
  check(/▸ 2 blocks folded under “What happened” · UNFOLD/.test(await page.locator('#pg-docs .dcfolded').textContent()), 'fold: one line says how much is folded');
  check(/folded: 2 blocks under it hidden in the page\. Nothing is deleted/.test(await said(page)), 'fold: said, nothing deleted');
  check(await page.evaluate(() => window.__ghosty.docs.folded) === 2 && await page.evaluate(() => window.__ghosty.docs.json) === json, 'fold: the document itself is untouched');
  check(await page.locator('#pg-docs button[aria-label="Unfold the section “What happened”"]').getAttribute('aria-pressed') === 'true', 'fold: its key says it is folded');
  await page.locator('#pg-docs button[aria-label="Move the section “What happened” down"]').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks.map((b) => b.id).join(',') === 'dpro4,dpro5,dpro6,dpro1,dpro2,dpro3,dpro7'), 'fold: a folded section still moves whole with ▼');
  check(await shown() === 'dpro4,dpro5,dpro6,dpro1,dpro7', `fold: and stays folded where it went (${await shown()})`);
  await tool(page, 'UNDO');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].id === 'dpro1'), 'fold: UNDO takes the move back');

  await page.locator('#pg-docs .dcpage .dcfolded').click();
  check(await until(page, () => !!document.querySelector('#pg-docs .dcpage [data-id="dpro2"]') && !document.querySelector('#pg-docs .dcpage .dcfolded')), 'fold: UNFOLD in the page brings it back');
  await page.locator('#pg-docs .dccontents button', { hasText: /^FOLD ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.folded === 4 && document.querySelectorAll('#pg-docs .dcpage .dcfolded').length === 2), `fold: FOLD ALL folds every section to its heading`);
  await page.locator('#pg-docs .dccontents button', { hasText: /^UNFOLD ALL$/ }).click();
  check(await until(page, () => window.__ghosty.docs.folded === 0 && document.querySelectorAll('#pg-docs .dcpage .dcb').length === 7), 'fold: UNFOLD ALL shows everything again');
  await page.locator('#pg-docs button[aria-label="Fold the section “Nothing under”"]').click();
  check(await until(page, () => /“Nothing under” has nothing under it to fold\./.test(window.__ghosty.docs.said)), 'fold: a heading with nothing under it is said');
  await page.locator('#pg-docs button[aria-label="Fold the section “What I ask”"]').click();
  await page.locator('#pg-docs button[aria-label="Unfold the section “What I ask”"]').click();
  check(await until(page, () => window.__ghosty.docs.folded === 0 && /“What I ask” unfolded\./.test(window.__ghosty.docs.said)), 'fold: ▸ in CONTENTS unfolds it');
  await ctx.close();
}
