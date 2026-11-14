// DOCUMENTS PRO, part 1: NAMED STYLES he can redefine, end to end on the phone.
//  1. STYLES sets the paragraph he is in in a style (Heading 2), said, and UNDO puts it back.
//  2. CHANGE A STYLE: Heading 1 in Rounded, larger, blue: every Heading 1 in the page follows at once; UNDO takes it back, REDO puts it again.
//  3. THIS PARAGRAPH: one paragraph double spaced with 18 pt after; REDEFINE FROM THIS PARAGRAPH makes Body so, every Body paragraph follows.
//  4. Word out and back in: the styles come back as his styles (real w:style entries), the web page carries them, the PDF is made.
import { docOf, exported, openDoc, pill, proDoc, reopen, said, tool } from './docspro-kit.mjs';

export default async function (h) {
  const { open, check, until, settle, measure, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [proDoc()] } });
  check(await openDoc(h, page, 'Boiler service'), 'styles: the document opens');
  await pill(page, 'styles');
  check(await until(page, () => window.__ghosty.docs.panel === 'styles' && document.querySelectorAll('#pg-docs .dcstylechip').length === 7), 'styles: STYLES shows the seven styles: Title, Heading 1 to 3, Body, Quote, Caption');
  await settle(page);
  await measure(page, '#pg-docs .dcpanel[aria-label="Styles"]', 'styles: the STYLES panel');

  // 1. a paragraph set in a style
  await page.locator('#pg-docs .dcpage [data-id="dpro3"]').click();
  await page.locator('#pg-docs .dcstylechip[data-style="h2"]').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].t === 'h2'), 'styles: Heading 2 sets the paragraph he is in');
  check(/Set in Heading 2\. UNDO puts it back\./.test(await said(page)), 'styles: and says so');
  await tool(page, 'UNDO');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[2].t === 'p'), 'styles: UNDO puts it back to Body');

  // 2. a style changed everywhere
  await page.selectOption('#pg-docs select[aria-label="The style to change"]', 'h1');
  await page.selectOption('#pg-docs select[aria-label="The style: font"]', 'rounded');
  check(await until(page, () => [...document.querySelectorAll('#pg-docs .dcpage [data-t="h1"]')].every((e) => e.dataset.sf === 'rounded') && document.querySelectorAll('#pg-docs .dcpage [data-t="h1"]').length === 2), 'styles: Heading 1 in Rounded: both headings follow at once');
  const before = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pg-docs .dcpage [data-t="h1"]')).fontSize));
  await page.locator('#pg-docs button[aria-label="The style: larger"]').click();
  await page.locator('#pg-docs button[aria-label="The style: larger"]').click();
  await page.selectOption('#pg-docs select[aria-label="The style: colour"]', 'blue');
  check(await until(page, (b) => [...document.querySelectorAll('#pg-docs .dcpage [data-t="h1"]')].every((e) => parseFloat(getComputedStyle(e).fontSize) > b && e.dataset.sc === 'blue'), before), 'styles: LARGER and blue reach every Heading 1');
  const st = (await docOf(page)).styles;
  check(st?.h1?.font === 'rounded' && st.h1.size === 18 && st.h1.colour === 'blue', `styles: kept as his Heading 1 (${JSON.stringify(st)})`);
  check(/^Heading 1 is now Rounded 18 pt, bold, blue/.test(await said(page)), `styles: said in his words (${await said(page)})`);
  await tool(page, 'UNDO');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).styles?.h1?.colour === undefined), 'styles: UNDO takes the colour back');
  await tool(page, 'REDO');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).styles?.h1?.colour === 'blue'), 'styles: REDO puts it again');

  // 3. this paragraph's own look, then REDEFINE
  await page.locator('#pg-docs .dcpage [data-id="dpro2"]').click();
  check(await until(page, () => document.querySelector('#pg-docs select[aria-label="The style to change"]').value === 'p'), 'styles: the style to change follows the paragraph he is in (Body)');
  await page.selectOption('#pg-docs select[aria-label="This paragraph: line spacing"]', '2');
  await page.selectOption('#pg-docs select[aria-label="This paragraph: room after"]', '18');
  check(await until(page, () => { const b = JSON.parse(window.__ghosty.docs.json).blocks[1]; return b.fmt?.line === 2 && b.fmt?.after === 18; }), 'styles: the paragraph keeps its own double spacing and 18 pt after');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#pg-docs .dcpage [data-id="dpro2"]')).lineHeight !== getComputedStyle(document.querySelector('#pg-docs .dcpage [data-id="dpro3"]')).lineHeight), 'styles: drawn double spaced, its neighbour not');
  await page.locator('#pg-docs .dcpage [data-id="dpro2"]').click();
  await page.locator('#pg-docs button', { hasText: 'REDEFINE FROM THIS PARAGRAPH' }).click();
  check(await until(page, () => { const d = JSON.parse(window.__ghosty.docs.json); return d.styles?.p?.line === 2 && d.styles.p.after === 18 && !d.blocks[1].fmt; }), 'styles: REDEFINE makes Body double spaced with 18 pt after');
  check(await page.evaluate(() => { const all = [...document.querySelectorAll('#pg-docs .dcpage [data-t="p"]')]; return all.length === 3 && all.every((e) => e.style.lineHeight === '2.7'); }), 'styles: every Body paragraph follows');
  check(/Body redefined from this paragraph: .*4 paragraphs in Body follow/.test(await said(page)), `styles: said (${await said(page)})`);
  await page.locator('#pg-docs button', { hasText: 'REDEFINE FROM THIS PARAGRAPH' }).click();
  check(await until(page, () => /already just Body/.test(window.__ghosty.docs.said)), 'styles: redefining again says the paragraph is already just its style');

  // 4. out and back
  const web = await exported(page, 'HTML');
  const html = web.bytes.toString('utf8');
  check(/h1:not\(\.title\)\{font-family:ui-rounded[^}]*color:royalblue/.test(html) && /p,li\{[^}]*line-height:2\.7/.test(html), 'styles: the web page carries his styles');
  const pdf = await exported(page, 'PDF');
  check(pdf.bytes.subarray(0, 5).toString() === '%PDF-' && pdf.bytes.length > 800, 'styles: the PDF is made with them');
  const word = await exported(page, 'WORD');
  const xml = word.bytes.toString('latin1');
  check(/w:styleId="Heading1"><w:name w:val="heading 1"\/>/.test(xml) && /Arial Rounded MT Bold/.test(xml), 'styles: the Word file has them as real Word styles');
  check(await reopen(h, page, word.bytes, 'Boiler back.docx'), 'styles: the Word file opens again');
  const back = await docOf(page);
  check(back.styles?.h1?.font === 'rounded' && back.styles.h1.size === 18 && back.styles.h1.colour === 'blue' && back.styles?.p?.line === 2 && back.styles.p.after === 18, `styles: and comes back with his styles (${JSON.stringify(back.styles)})`);
  check(await until(page, () => [...document.querySelectorAll('#pg-docs .dcpage [data-t="h1"]')].every((e) => e.dataset.sf === 'rounded')), 'styles: drawn in them');
  await ctx.close();
}
