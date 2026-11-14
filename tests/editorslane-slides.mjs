// THE EDITORS LANE, PRESENTATIONS (against Keynote): the tools this round added, end to end on the phone, with the real waits.
//  1. A deck of 100 slides opens to its film inside its budget.
//  2. FIND across every slide (titles, words, notes) says how many and on which slides, and each is a key to that slide; REPLACE ALL
//     changes every one; UNDO puts them all back and REDO again.
//  3. SKIP IN THE TALK: the film marks the slide SKIPPED, the talk steps over it (forward and back), and UNDO shows it again.
//  4. The round trip: the deck out as .pptx and IMPORTed back: the replaced words, the skipped slide and each slide's transition the same.
//  5. Every look at 440 × 956, The Scan at 390 × 844 and BODY 21: every key 44 pt, nothing sideways, no words cut.
import { readFileSync } from 'node:fs';

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const st = (page) => page.evaluate(() => ({ ...window.__ghosty.slides, json: undefined }));
  const sh = (page) => page.locator('.slsheet');
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const pill = (page, name) => sh(page).locator('.slpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  const card = (page, n) => sh(page).locator('.slcard').nth(n);
  const still = (page, sel) => until(page, (x) => {
    const el = document.querySelector(x);
    return !!el && el.offsetWidth > 0 && Math.abs(el.getBoundingClientRect().width - el.offsetWidth) < 0.25;
  }, sel, 10000);
  const toSlides = async (page) => {
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
  };

  // a deck of 100 slides, as he might have made: every tenth one about apples, slide 5's notes too; slide 3 pushes in, slide 4 fades
  let n = 0;
  const id = () => `seed${++n}`;
  const blk = (t, text) => ({ id: id(), t, runs: text ? [{ text }] : [] });
  const slides = Array.from({ length: 100 }, (_, i) => ({
    id: `s${i + 1}`, layout: 'bullets', title: blk('h1', i % 10 === 0 ? `Apples, part ${i / 10 + 1}` : `Slide ${i + 1}`),
    body: [blk('ul', `Point one of slide ${i + 1}`), blk('ul', 'Point two')], body2: [], shapes: [], notes: i === 4 ? 'Mention the apples here' : '',
    transition: i === 2 ? 'push' : i === 3 ? 'fade' : 'none', builds: [],
  }));
  const deck = { id: 'kbig', title: 'Orchard review', theme: 'ghosty', master: { align: 'left', footer: true, numbers: true }, slides, at: Date.now(), from: 'written with Ghosty' };

  // ---------------------------------------------------------------- 1 to 4. The Scan at 440
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.slides': [deck] } });
  await toSlides(page);
  await page.waitForSelector('.slsheet .slopen', { timeout: 15000 });
  let t = Date.now();
  await sh(page).locator('.slopen').first().click();
  const opened = await until(page, () => window.__ghosty.slides.view === 'deck' && document.querySelectorAll('.slsheet .slcard').length === 100);
  const openMs = Date.now() - t;
  check(opened, `slides 1: a deck of 100 slides opens to its film (${openMs} ms)`);
  check(openMs < 5000, `slides 1: inside its budget (${openMs} ms of 5000)`);

  // 2. FIND and REPLACE ALL
  await key(page, 'FIND').click();
  await page.waitForSelector('.slfindp', { timeout: 5000 });
  await page.fill('.slfindp input[type=search]', 'apples');
  await page.locator('.slfindp button', { hasText: /^FIND$/ }).click();
  check(await until(page, () => window.__ghosty.slides.found.slides.length === 11), `slides 2: FIND says it is on 11 slides (${JSON.stringify((await st(page)).found)})`);
  check(/Found 11 times, on 11 slides/.test((await st(page)).said), `slides 2: said in his words (${(await st(page)).said})`);
  check(await page.locator('.slhits button').count() === 11, 'slides 2: each slide it is on is a key');
  await page.locator('.slhits button', { hasText: /^SLIDE 5$/ }).click();
  check(await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 4), 'slides 2: and the key goes to that slide (its notes have it)');
  await key(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  if (!(await page.locator('.slfindp').count())) await key(page, 'FIND').click();
  await page.fill('.slfindp input[type=search]', 'apples');
  await page.fill('.slfindp input[type=text]', 'pears');
  await page.locator('.slfindp button', { hasText: /^REPLACE ALL$/ }).click();
  check(await until(page, () => window.__ghosty.slides.found.changed === 11 && window.__ghosty.slides.slides[0].title === 'Pears, part 1' && window.__ghosty.slides.slides[4].notes === 'Mention the pears here'), 'slides 2: REPLACE ALL changes all 11, titles and notes, keeping each one’s capitals (Apples → Pears, apples → pears)');
  await key(page, 'UNDO').click();
  check(await until(page, () => window.__ghosty.slides.slides[0].title === 'Apples, part 1' && window.__ghosty.slides.slides[4].notes === 'Mention the apples here'), 'slides 2: UNDO puts every one back');
  await key(page, 'REDO').click();
  check(await until(page, () => window.__ghosty.slides.slides[90].title === 'Pears, part 10'), 'slides 2: REDO changes them again');

  // 3. SKIP IN THE TALK
  await card(page, 1).click();
  await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 1);
  await pill(page, 'SLIDE');
  await key(page, 'SKIP IN THE TALK').click();
  check(await until(page, () => window.__ghosty.slides.slides[1].skip === true), 'slides 3: SKIP IN THE TALK marks slide 2 skipped');
  check(/skipped in the talk/.test((await st(page)).said), `slides 3: said in his words (${(await st(page)).said})`);
  check(await key(page, 'SHOW IN THE TALK').count() === 1, 'slides 3: the key now offers SHOW IN THE TALK');
  await key(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  check(await card(page, 1).locator('.slskipped').count() === 1 && await card(page, 0).locator('.slskipped').count() === 0, 'slides 3: the film marks it SKIPPED, and only it');
  await key(page, 'PRESENT').click();
  check(await until(page, () => window.__ghosty.slides.present.on && window.__ghosty.slides.present.i === 0), 'slides 3: the talk starts at slide 1');
  check(/NEXT: Slide 3/.test((await st(page)).present.next), `slides 3: it says the next is slide 3 (${(await st(page)).present.next})`);
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.i === 2), 'slides 3: NEXT steps over the skipped slide to slide 3');
  await page.locator('.slpkeys button', { hasText: /^BACK$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.i === 0), 'slides 3: BACK steps over it too, to slide 1');
  check(JSON.stringify((await st(page)).shown.slice(0, 2)) === '[1,3]', `slides 3: the talk showed slides 1 then 3 (${(await st(page)).shown})`);
  await page.locator('.slptop button', { hasText: /^EXIT$/ }).click();
  await until(page, () => !window.__ghosty.slides.present.on);
  await key(page, 'ALL SLIDES').click().catch(() => undefined);
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await key(page, 'UNDO').click();
  check(await until(page, () => !window.__ghosty.slides.slides[1].skip), 'slides 3: UNDO shows it in the talk again');
  await key(page, 'REDO').click();
  check(await until(page, () => window.__ghosty.slides.slides[1].skip === true), 'slides 3: REDO skips it again');

  // 4. the round trip through PowerPoint
  const before = (await st(page)).slides;
  await key(page, 'EXPORT').click();
  t = Date.now();
  await key(page, 'POWERPOINT \\(\\.PPTX\\)').click();
  check(await until(page, () => /\.pptx/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? ''), null, 30000), `slides 4: EXPORT makes the 100-slide PowerPoint file (${Date.now() - t} ms)`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), sh(page).locator('.slouts button', { hasText: 'SAVE' }).click()]);
  const bytes = readFileSync(await dl.path());
  check(bytes[0] === 0x50 && bytes[1] === 0x4b, `slides 4: saved (${bytes.length} bytes)`);
  await key(page, 'MY SLIDES').click();
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'Orchard review again.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: bytes });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.kept === 2 && window.__ghosty.slides.slides.length === 100, null, 30000), `slides 4: IMPORTed back as its own deck of 100 (${(await st(page)).title})`);
  const back = (await st(page)).slides;
  const differ = before.map((s, i) => (s.title !== back[i]?.title || s.notes !== back[i]?.notes || !!s.skip !== !!back[i]?.skip || s.transition !== back[i]?.transition ? i + 1 : 0)).filter(Boolean);
  check(!differ.length, `slides 4: every title, note, skipped slide and transition came back the same${differ.length ? ` (slides ${differ.slice(0, 5).join(', ')} differ)` : ''}`);
  check(back[1].skip === true && back[2].transition === 'push' && back[3].transition === 'fade', 'slides 4: slide 2 still skipped, slide 3 still pushes in, slide 4 still fades');
  check(!/transition/.test((await st(page)).lost.join(' ')), `slides 4: nothing said lost about a transition (${(await st(page)).lost.join('; ')})`);
  await ctx.close();

  // ---------------------------------------------------------------- 5. every look at 440; The Scan at 390 and BODY 21
  const runs = [...Object.entries(LOOKS).map(([name, look]) => ({ name, look, viewport: PHONE })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx: c, page: p } = await open({ look: r.look, viewport: r.viewport });
    await toSlides(p);
    check(await until(p, () => /No slides yet/.test(document.querySelector('#pg-slides')?.innerText ?? '')), `slides, ${r.name}: the empty list says so in his words (${(await p.locator('#pg-slides').innerText().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ')})`);
    await key(p, 'START BLANK').click();
    await until(p, () => window.__ghosty.slides.view === 'deck');
    await key(p, 'FIND').click();
    if (r.big) await body21(p);
    await settle(p);
    await still(p, '#pg-slides .slsheet');
    await measure(p, '#pg-slides', `slides, ${r.name}: the deck and FIND AND REPLACE`);
    await card(p, 1).click();
    await until(p, () => window.__ghosty.slides.view === 'slide');
    await pill(p, 'SLIDE');
    await settle(p);
    await measure(p, '#pg-slides', `slides, ${r.name}: a slide's SLIDE keys with SKIP IN THE TALK`);
    await c.close();
  }
}
