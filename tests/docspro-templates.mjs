// DOCUMENTS PRO, part 3: the designed TEMPLATE GALLERY, end to end on the phone.
//  1. DOCUMENTS → TEMPLATES shows five designed cards (letter, CV, report, newsletter, invoice), each drawn in its own styles, and
//     says plainly that his name is not set (the phone's name is the default “Boss”); by voice-free command it opens the same.
//  2. A letter: his town (Settings' home) and today's date filled in, laid out in its styles, kept on this phone; typing works.
//  3. The CV and the invoice: their own styles and tables; the Word file of one comes back with those styles.
import { docOf, exported, goDocs, reopen } from './docspro-kit.mjs';

export default async function (h) {
  const { open, check, until, settle, measure, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan });
  await goDocs(page);
  await page.locator('#pg-docs .dcbar button', { hasText: 'TEMPLATES' }).click();
  check(await until(page, () => document.querySelectorAll('#pg-docs .dctplcard').length === 5), 'templates: TEMPLATES shows the five designed templates');
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-docs .dctplcard')].map((b) => b.dataset.template).join(',')) === 'letter,cv,report,newsletter,invoice', 'templates: letter, CV, report, newsletter, invoice');
  check(await page.evaluate(() => document.querySelector('#pg-docs .dctplcard[data-template="newsletter"] .dctplpage').dataset.sf === 'rounded'), 'templates: each card drawn in its own styles (the newsletter rounded)');
  check(/Your name isn’t set \(Settings → your name\)/.test(await page.evaluate(() => window.__ghosty.docs.said)), 'templates: says his name is not set, and where to set it');
  await settle(page);
  await measure(page, '#pg-docs .dcview', 'templates: the gallery');

  const today = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  await page.locator('#pg-docs .dctplcard[data-template="letter"]').click();
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).from === 'a template: letter'), 'templates: the letter opens as his new document');
  const letter = await docOf(page);
  const words = letter.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');
  check(words.includes('Birmingham') && words.includes(today) && words.includes('[Your name]'), `templates: his town and today's date filled in, his name left to fill (${words.slice(0, 80).replace(/\n/g, ' / ')})`);
  check(letter.kind === 'letter' && letter.styles?.title?.size === 14 && letter.blocks.filter((b) => b.t === 'right').length === 3, 'templates: laid out as a letter in its styles, the address and date on the right');
  check(await until(page, (id) => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]').some((d) => d.id === id), letter.id), 'templates: kept on this phone');
  await page.locator('#pg-docs .dcpage [data-t="p"]', { hasText: 'Dear [their name],' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' thank you');
  check(await until(page, () => /Dear \[their name\], thank you/.test(window.__ghosty.docs.text)), 'templates: he types into it as any document');

  await page.locator('#pg-docs .dcbar button', { hasText: 'TEMPLATES' }).click();
  await page.locator('#pg-docs .dctplcard[data-template="invoice"]').click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).from === 'a template: invoice'), 'templates: the invoice opens');
  const inv = await docOf(page);
  check(inv.blocks.some((b) => b.t === 'table' && b.rows[0].map((c) => c.map((r) => r.text).join('')).join(',') === 'Work,Hours or items,Rate,Amount') && inv.styles?.title?.colour === 'green', 'templates: the invoice has its table of work and its own colours');
  check(await page.locator('#pg-docs .dcpage .dctable').count() === 1 && await page.evaluate(() => document.querySelector('.dctitle').dataset.sc === 'green'), 'templates: drawn so, its title green');
  const word = await exported(page, 'WORD');
  check(await reopen(h, page, word.bytes, 'Invoice back.docx'), 'templates: its Word file opens again');
  const back = await docOf(page);
  check(back.styles?.title?.colour === 'green' && back.styles?.p?.font === 'sans' && back.blocks.some((b) => b.t === 'table'), `templates: with its styles and table (${JSON.stringify(back.styles)})`);

  // the gallery from a command, as the catalogue's TRY IT opens it
  await page.evaluate(() => window.__ghosty.run('open_docs', { what: 'templates' }));
  check(await until(page, () => document.querySelectorAll('.modal .dctplcard').length === 5), 'templates: open_docs with “templates” opens the gallery');
  await page.keyboard.press('Escape');
  await ctx.close();
}
