// DOCUMENTS PRO, part 5: the new screens in all seven looks at 440 × 956, The Scan at 390 × 844 and at BODY 21: every key 44 pt,
// nothing sideways, no words cut. STYLES with a paragraph chosen; REVIEW with a change of each kind; CONTENTS with its fold keys and a
// folded section in the page; the TEMPLATES gallery.
import { openDoc, pill, proDoc, tool } from './docspro-kit.mjs';

const tracked = () => {
  const d = proDoc('dlk', 'Moving day');
  d.track = true;
  d.blocks[2].runs = [{ text: 'Please fix the tap ' }, { text: 'soon', tc: 'del', tat: Date.now() - 60000 }, { text: 'this week, before the plumber’s other appointments fill up', tc: 'ins', tat: Date.now() }];
  d.styles = { h1: { font: 'rounded', colour: 'blue' } };
  return d;
};

export default async function (h) {
  const { open, check, until, measure, settle, body21, LOOKS, PHONE, SMALL } = h;
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed: { 'ghosty.docs': [tracked()] } });
    if (r.big) await body21(page);
    check(await openDoc(h, page, 'Moving day'), `looks ${r.name}: the document opens`);
    await page.locator('#pg-docs .dcpage [data-id="dlk2"]').click();
    await pill(page, 'styles');
    await settle(page);
    await measure(page, '#pg-docs', `looks ${r.name}: STYLES`);
    await pill(page, 'review');
    check(await until(page, () => document.querySelectorAll('#pg-docs .dcchg').length === 2), `looks ${r.name}: REVIEW lists the two changes`);
    await tool(page, 'CONTENTS');
    await page.locator('#pg-docs button[aria-label="Fold the section “What I ask”"]').click();
    check(await until(page, () => !!document.querySelector('#pg-docs .dcpage .dcfolded')), `looks ${r.name}: a section folded`);
    await settle(page);
    await measure(page, '#pg-docs', `looks ${r.name}: REVIEW, CONTENTS and a folded section`);
    if (r.name === 'scan' || r.name === 'ink') await page.screenshot({ path: `${h.out}/docspro-${r.name}.png` });
    await page.locator('#pg-docs .dcbar button', { hasText: 'TEMPLATES' }).click();
    await until(page, () => document.querySelectorAll('#pg-docs .dctplcard').length === 5);
    // (the screen's own scale-in after the hash change, measured once it has finished)
    await until(page, () => [...document.querySelectorAll('#pg-docs .dcbar button')].every((b) => b.getBoundingClientRect().height >= 43.5), null, 4000);
    await settle(page);
    await measure(page, '#pg-docs', `looks ${r.name}: the TEMPLATES gallery`);
    await ctx.close();
  }
}
