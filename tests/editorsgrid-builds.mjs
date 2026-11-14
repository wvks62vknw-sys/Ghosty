// EDITORS GRID, PRESENTATIONS: builds and Magic Move carried in and out of PowerPoint (NEXT ROUND, editors.u4 and section 3), end to end:
//  1. A deck of three slides: builds chosen on slide 1 by their keys (THE TEXT FADES IN, THE TITLE APPEARS), UNDO takes the last one out, REDO
//     puts it back; slide 2 set to MAGIC MOVE by its key, said in his words.
//  2. PRESENT: the builds come in on taps; NEXT into slide 2 glides the title that is on both slides (Magic Move), said as the transition.
//  3. The round trip: EXPORT as PowerPoint, the file's slide 1 holds p:timing after p:transition with Appear and Fade, slide 2 Morph;
//     IMPORTed back, the same builds and MAGIC MOVE, and nothing said lost about animations or transitions.
//  4. A PowerPoint file not of ours (tests/pptxfixture.mjs): its fade and fly-in come in as builds, its emphasis said as left out.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { foreignPptx } from './pptxfixture.mjs';

/** One part of a zip by name (stored or deflated), as text. */
function zipPart(buf, name) {
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nlen = buf.readUInt16LE(i + 26);
    const xlen = buf.readUInt16LE(i + 28);
    const n = buf.toString('utf8', i + 30, i + 30 + nlen);
    const start = i + 30 + nlen + xlen;
    if (n === name) return (method === 8 ? inflateRawSync(buf.subarray(start, start + size)) : buf.subarray(start, start + size)).toString('utf8');
  }
  return '';
}

export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const st = (page) => page.evaluate(() => ({ ...window.__ghosty.slides, deck: JSON.parse(window.__ghosty.slides.json || '{}'), json: undefined }));
  const sh = (page) => page.locator('.slsheet');
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const pill = (page, name) => sh(page).locator('.slpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  const build = (page, row, label) => sh(page).locator('.slbuild', { hasText: row }).locator('button', { hasText: new RegExp(`^${label}$`) }).click();
  let n = 0;
  const blk = (t, text) => ({ id: `b${++n}`, t, runs: text ? [{ text }] : [] });
  const slide = (i, title, over = {}) => ({ id: `g${i}`, layout: 'bullets', title: blk('h1', title), body: [blk('ul', `First point ${i}`), blk('ul', 'Second point')], body2: [], shapes: [], notes: '', transition: 'none', builds: [], ...over });
  const deck = { id: 'kgrid', title: 'Builds talk', theme: 'ghosty', master: { align: 'left', footer: true, numbers: true }, slides: [slide(1, 'Our plan'), slide(2, 'Our plan, closer'), slide(3, 'Thank you')], at: Date.now(), from: 'written with Ghosty' };

  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.slides': [deck] } });
  await page.evaluate(() => (location.hash = 'slides'));
  await page.waitForSelector('.slsheet .slopen', { timeout: 15000 });
  await sh(page).locator('.slopen').first().click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await sh(page).locator('.slcard').nth(0).click();
  await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 0);
  await pill(page, 'SLIDE');
  check(/carries both: APPEARS, FADES IN and RISES IN become its Appear, Fade and Fly In/.test(await sh(page).innerText()), 'builds 1: the slide says the PowerPoint file carries the builds (no "not the builds" left)');
  await build(page, 'The text', 'FADES IN');
  check(await until(page, () => window.__ghosty.slides.slides[0].builds === 1), 'builds 1: THE TEXT FADES IN is a build on slide 1');
  check(/The text comes in on a tap in the talk/.test((await st(page)).said), `builds 1: said in his words (${(await st(page)).said})`);
  await build(page, 'The title', 'APPEARS');
  check(await until(page, () => window.__ghosty.slides.slides[0].builds === 2), 'builds 1: THE TITLE APPEARS as well');
  await key(page, 'UNDO').click();
  check(await until(page, () => window.__ghosty.slides.slides[0].builds === 1), 'builds 1: UNDO takes the last build out');
  await key(page, 'REDO').click();
  check(await until(page, () => window.__ghosty.slides.slides[0].builds === 2), 'builds 1: REDO puts it back');
  // slide 2 glides in with MAGIC MOVE
  await key(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await sh(page).locator('.slcard').nth(1).click();
  await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 1);
  await pill(page, 'SLIDE');
  await key(page, 'MAGIC MOVE').click();
  check(await until(page, () => window.__ghosty.slides.slides[1].transition === 'morph'), 'builds 1: MAGIC MOVE is slide 2’s transition');
  check(/Magic Move: .*glides.*Morph/.test((await st(page)).said), `builds 1: said in his words (${(await st(page)).said})`);
  check(await key(page, 'MAGIC MOVE').getAttribute('aria-pressed') === 'true', 'builds 1: and its key shows it chosen');

  // 2. the talk
  await key(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await sh(page).locator('.slcard').nth(0).click();
  await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 0);
  await key(page, 'PRESENT').click();
  check(await until(page, () => window.__ghosty.slides.present.on && window.__ghosty.slides.present.i === 0 && window.__ghosty.slides.present.builds === 2), 'builds 2: the talk starts on slide 1 with its two builds to come');
  check(await page.locator('.slpbox [data-b].slhid').count() === 2, 'builds 2: both parts wait for a tap');
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.step === 2 && !document.querySelector('.slpbox [data-b].slhid')), 'builds 2: two taps bring both in');
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.i === 1 && window.__ghosty.slides.present.transition === 'morph'), 'builds 2: NEXT goes to slide 2 by MAGIC MOVE');
  check(await until(page, () => Number(document.querySelector('.slpbox')?.dataset.moved ?? 0) >= 2), `builds 2: the title and the text that are on both slides glide to their places (${await page.evaluate(() => document.querySelector('.slpbox')?.dataset.moved)})`);
  await page.locator('.slptop button', { hasText: /^EXIT$/ }).click();
  await until(page, () => !window.__ghosty.slides.present.on);
  await key(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');

  // 3. the round trip through PowerPoint
  const before = (await st(page)).deck.slides.map((s) => ({ builds: s.builds, transition: s.transition }));
  await key(page, 'EXPORT').click();
  await key(page, 'POWERPOINT \\(\\.PPTX\\)').click();
  check(await until(page, () => /\.pptx/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? ''), null, 30000), 'builds 3: EXPORT makes the PowerPoint file');
  check(/transitions, builds and skipped slides go with it/.test(await sh(page).innerText()), 'builds 3: the export sheet says the builds go with it');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), sh(page).locator('.slouts button', { hasText: 'SAVE' }).click()]);
  const bytes = readFileSync(await dl.path());
  const s1 = zipPart(bytes, 'ppt/slides/slide1.xml');
  const s2 = zipPart(bytes, 'ppt/slides/slide2.xml');
  check(/<\/p:clrMapOvr><p:timing>/.test(s1) && s1.indexOf('<p:timing>') > 0, 'builds 3: the file’s slide 1 has its p:timing in the schema’s place');
  check(/presetID="1" presetClass="entr"/.test(s1) && /presetID="10" presetClass="entr"/.test(s1) && /filter="fade"/.test(s1), 'builds 3: written as PowerPoint’s Appear and Fade');
  check(/<p159:morph option="byObject"\/>/.test(s2) && /<mc:Fallback><p:transition spd="slow"><p:fade\/>/.test(s2), 'builds 3: slide 2 is PowerPoint’s Morph, with a fade for an older PowerPoint');
  await key(page, 'MY SLIDES').click();
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'Builds talk again.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: bytes });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.kept === 2 && window.__ghosty.slides.slides.length === 3, null, 30000), 'builds 3: IMPORTed back as its own deck');
  const back = (await st(page)).deck.slides.map((s) => ({ builds: s.builds, transition: s.transition }));
  check(JSON.stringify(back) === JSON.stringify(before), `builds 3: every build and MAGIC MOVE came back the same (${JSON.stringify(back)})`);
  check(!/animation|transition|build/.test((await st(page)).lost.join(' ')), `builds 3: nothing said lost about them (${(await st(page)).lost.join('; ')})`);

  // 4. a PowerPoint file not of ours
  await key(page, 'MY SLIDES').click();
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'quarterly.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(foreignPptx()) });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.kept === 3, null, 30000), 'builds 4: a PowerPoint file not of ours opens');
  const q = await st(page);
  check(JSON.stringify(q.deck.slides[1].builds) === JSON.stringify([{ el: 'title', how: 'fade' }, { el: 'body', how: 'rise' }]), `builds 4: its Fade and Fly In (inside mc:AlternateContent) are FADES IN and RISES IN (${JSON.stringify(q.deck.slides[1].builds)})`);
  check(/emphasis or exit animations on slide 2/.test(q.said), `builds 4: its spin is said as left out, in his words (${q.said})`);
  await ctx.close();
}
