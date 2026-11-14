// PAPER, part 6: the paper tools' new screens in all seven looks at 440 × 956, The Scan at 390 × 844 and at BODY 21 — every key 44 pt,
// nothing sideways, no words cut: DOCUMENTS with CONTENTS (▲ ▼), COMMENTS and MAIL MERGE open; FILL IN AND SIGN with a form read; the
// scanner's paper keys and the receipt card.
import { formPdf } from './editorspaper-pdf.mjs';
import { guestsBook } from './editorspaper-merge.mjs';
import { goDocs } from './editorspaperkit.mjs';

const lookDoc = () => ({
  id: 'dlooks', title: 'Moving house', kind: 'document', at: Date.now() + 5000,
  blocks: [
    { id: 'k1', t: 'h1', runs: [{ text: 'Before the van comes on Saturday morning' }] },
    { id: 'k2', t: 'p', runs: [{ text: 'Dear {{Name}}, the keys go to the agent at 4 Mill Lane, not the neighbour.' }] },
    { id: 'k3', t: 'h2', runs: [{ text: 'Meters' }] },
    { id: 'k4', t: 'p', runs: [{ text: 'Read the gas and electricity meters and photograph them.' }] },
  ],
  comments: [{ id: 'cl1', block: 'k2', start: 33, end: 42, quote: 'the agent', text: 'Which agent: the letting one or the estate agent?', at: Date.now(), replies: [{ text: 'The letting agent, on the high street.', at: Date.now(), who: 'ghosty' }] }],
});

export default async function (h) {
  const { open, check, until, measure, settle, body21, LOOKS, PHONE, SMALL } = h;
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed: { 'ghosty.docs': [lookDoc()], 'ghosty.sheets': [guestsBook()] } });
    if (r.big) await body21(page);
    await goDocs(page);
    await page.locator('.dcopen', { hasText: 'Moving house' }).first().click();
    await until(page, () => window.__ghosty?.docs?.view === 'doc');
    await page.locator('#pg-docs .dctools button', { hasText: 'CONTENTS' }).click();
    await page.locator('#pg-docs .dctools button', { hasText: 'COMMENTS' }).click();
    await page.locator('#pg-docs .dctools button', { hasText: 'MAIL MERGE' }).click();
    await page.waitForSelector('#pg-docs .dcmerge select');
    await page.selectOption('#pg-docs .dcmerge select', 'shguests');
    const ok = await until(page, () => document.querySelectorAll('#pg-docs .dcsec').length === 2 && !!document.querySelector('#pg-docs .dccmt') && window.__ghosty?.merge?.rows === 3);
    check(ok, `looks ${r.name}: DOCUMENTS with CONTENTS, COMMENTS and MAIL MERGE open`);
    await settle(page);
    await measure(page, '#pg-docs', `looks ${r.name}: documents with the paper tools`);
    // fill and sign, a form read (in three of the runs: its page is drawn by pdf.js, the slowest step here)
    if (['scan', 'scan at 390', 'scan at BODY 21'].includes(r.name)) {
    await page.locator('#pg-docs .dcbar button', { hasText: 'FILL AND SIGN A PDF' }).click();
    await page.setInputFiles('.pdfform input[type=file]', { name: 'Permit.pdf', mimeType: 'application/pdf', buffer: formPdf() });
    check(await until(page, () => window.__ghosty?.pdfform?.fields === 3 && !!document.querySelector('.pdfform canvas.pdfpage'), null, 20000), `looks ${r.name}: fill and sign reads the form`);
    await settle(page);
    await measure(page, '.pdfform', `looks ${r.name}: fill and sign`);
    await page.keyboard.press('Escape');
    }
    // the scanner's paper keys and the receipt card
    if (r.name === 'scan at 390' || r.big) {
      await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'document' }));
      await page.waitForSelector('#pg-lens button:has-text("CAPTURE PAGE")');
      await page.evaluate(() => {
        const t = document.querySelector('#pg-lens textarea.lensocr');
        t.hidden = false;
        t.value = 'CORNER SHOP\n12/11/2026\nTOTAL 5.40';
        t.dispatchEvent(new Event('input'));
      });
      await page.locator('#pg-lens button', { hasText: 'RECEIPT TO SPREADSHEET' }).click();
      check(await until(page, () => document.querySelector('.pprsheet input[aria-label^="The total"]')?.value === '5.40'), `looks ${r.name}: the receipt card`);
      await settle(page);
      await measure(page, '.pprsheet', `looks ${r.name}: the receipt card`);
      await measure(page, '#pg-lens .scanpaper', `looks ${r.name}: the scanner's paper keys`);
    }
    if (r.name === 'scan' || r.name === 'ink') await page.screenshot({ path: `${h.out}/paper-looks-${r.name}.png` });
    await ctx.close();
  }
}
