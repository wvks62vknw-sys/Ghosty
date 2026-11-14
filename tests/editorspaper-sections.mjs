// PAPER, part 5 (editors.u13): move whole sections by heading, end to end on the phone.
//  1. By voice ("show the outline of my document", "move a section in my document") the latest document opens on CONTENTS.
//  2. CONTENTS lists every heading with ▲ and ▼ (44 pt); ▼ on "Garden" moves it below "Kitchen" with its paragraphs and its own
//     smaller heading; ▲ brings it back; one UNDO step takes a move back, REDO puts it again.
//  3. The edges are said: the first section up, a sub-section past its bigger section.
//  4. The move is kept on this phone and in the Word file (round trip: the headings in their new order).
import { ask, goDocs, docOf, exported } from './editorspaperkit.mjs';

const houseDoc = () => ({
  id: 'dhouse', title: 'House jobs', kind: 'document', at: Date.now() + 3000,
  blocks: [
    { id: 's1', t: 'h1', runs: [{ text: 'Garden' }] },
    { id: 's2', t: 'p', runs: [{ text: 'Cut the hedge before May.' }] },
    { id: 's3', t: 'h2', runs: [{ text: 'Shed' }] },
    { id: 's4', t: 'p', runs: [{ text: 'Paint the shed door.' }] },
    { id: 's5', t: 'h1', runs: [{ text: 'Kitchen' }] },
    { id: 's6', t: 'p', runs: [{ text: 'Fix the dripping tap.' }] },
    { id: 's7', t: 'h1', runs: [{ text: 'Bathroom' }] },
    { id: 's8', t: 'p', runs: [{ text: 'Reseal the bath.' }] },
  ],
});

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [houseDoc()] } });
  const order = () => page.evaluate(() => JSON.parse(window.__ghosty.docs.json).blocks.map((b) => b.runs.map((r) => r.text).join('').split(' ')[0]).join(','));
  const mv = (name, dir) => page.locator(`#pg-docs button[aria-label="Move the section “${name}” ${dir}"]`).click();

  for (const words of ['show the outline of my document', 'move a section in my document']) {
    const r = await ask(page, words, /CONTENTS/);
    check(r.ok, `sections: “${words}” is answered`);
    check(await until(page, () => window.__ghosty?.docs?.title === 'House jobs' && document.querySelectorAll('.dccontents:not([hidden]) .dcsec').length === 4), `sections: “${words}” opens the latest document on its CONTENTS`);
    await page.keyboard.press('Escape');
  }

  await goDocs(page);
  await page.locator('.dcopen', { hasText: 'House jobs' }).first().click();
  await until(page, () => window.__ghosty?.docs?.view === 'doc');
  await page.locator('#pg-docs .dctools button', { hasText: 'CONTENTS' }).click();
  check(await until(page, () => document.querySelectorAll('#pg-docs .dccontents .dcsec').length === 4), 'sections: CONTENTS lists the four headings with their keys');
  await settle(page);
  await measure(page, '#pg-docs .dccontents', 'sections: CONTENTS');
  const start = 'Garden,Cut,Shed,Paint,Kitchen,Fix,Bathroom,Reseal';
  check(await order() === start, 'sections: the document as it was');

  await mv('Garden', 'down');
  check(await until(page, async () => true) && await order() === 'Kitchen,Fix,Garden,Cut,Shed,Paint,Bathroom,Reseal', `sections: ▼ moves Garden below Kitchen with its paragraph and its Shed (${await order()})`);
  check(/moved down, below “Kitchen”/.test(await page.evaluate(() => window.__ghosty.docs.said)), 'sections: and says so');
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-docs .dcpage .dcb')].map((e) => e.textContent.split(' ')[0]).join(',')) === 'Kitchen,Fix,Garden,Cut,Shed,Paint,Bathroom,Reseal', 'sections: the page is drawn in the new order');
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-docs .dccontents .dcsecgo')].map((e) => e.textContent).join(',')) === 'Kitchen,Garden,Shed,Bathroom', 'sections: CONTENTS follows');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs[0].text === 'Garden') && await order() === start, 'sections: one UNDO takes the whole move back');
  await page.locator('#pg-docs .dctools button', { hasText: /^REDO$/ }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs[0].text === 'Kitchen'), 'sections: REDO moves it again');
  check(await page.locator('#pg-docs .dccontents:not([hidden]) .dcsec').count() === 4, 'sections: CONTENTS stays open through UNDO and REDO');
  await mv('Garden', 'up');
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).blocks[0].runs[0].text === 'Garden') && await order() === start, 'sections: ▲ brings Garden back up, with all of it');

  // the edges
  await mv('Garden', 'up');
  check(await until(page, () => /“Garden” is already the first section\./.test(window.__ghosty.docs.said)), 'sections: the first section going up is said');
  await mv('Shed', 'down');
  check(await until(page, () => /“Shed” is already the last section under its heading/.test(window.__ghosty.docs.said)), 'sections: a sub-section past its bigger section is said');
  await mv('Bathroom', 'up');
  check(await order() === 'Garden,Cut,Shed,Paint,Bathroom,Reseal,Kitchen,Fix', `sections: ▲ on Bathroom moves it above Kitchen (${await order()})`);

  // kept, and in the Word file
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]').find((d) => d.id === 'dhouse')?.blocks.map((b) => b.runs[0].text.split(' ')[0]).join(',') === 'Garden,Cut,Shed,Paint,Bathroom,Reseal,Kitchen,Fix'), 'sections: the new order is kept on this phone');
  const word = await exported(page, 'WORD');
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'House back.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Bathroom/.test(window.__ghosty.docs.text) && window.__ghosty.docs.title !== 'House jobs' || /House/.test(window.__ghosty.docs.title)), 'sections: the Word file reads back in');
  const back = await docOf(page);
  const heads = back.blocks.filter((b) => /^h/.test(b.t)).map((b) => b.runs.map((r) => r.text).join('')).join(',');
  check(heads === 'Garden,Shed,Bathroom,Kitchen', `sections: with the headings in their new order (${heads})`);
  await ctx.close();
}
