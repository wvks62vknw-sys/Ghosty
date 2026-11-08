// THE LIBRARY AS A LIBRARY, PART 2 OF 2 (BRIEF-LIBRARY-READER and its 7 Nov addendum; OWNER-ISSUES 125, 145, 146): part 8 of the reader spec,
// split off from tests/reader.spec.mjs on 8 Nov (it alone runs 290 s) so that each spec runs well inside the smoke loop's 480 s per spec; the
// shared set-up (the books, the stand-in voice, microphone and clock, the helpers) is tests/readerlib.mjs. On the preview with the scripted brain,
// on the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844:
//  8. Nothing sticks out sideways at 390 and 440, in every section and on the Shelf; every control has a name and is 44 pt; the
//     book's words 17 pt to start, never under 12; pages mode turns whole lines a screen at a time, by key and by swipe.
//   BASE=http://localhost:8788 node tests/reader2.spec.mjs [outDir]   (ONLY=fit)
import { PHONE, UK, openSection } from './nav.mjs';
import { webkitNoise } from './browser.mjs';
import { AUTHOR, CUT_BUDGET, FIRST_WORD_BUDGET, KEY, LH, NW, OPEN_BUDGET, PAGE_LINE, R, RUN, SMALL, api, base, chapterTitles, check, coverJpg, docByTitle, fakeTalk, fromTheSentence, heardLine, lighthouseTxt, measure, measured, ms, nightWalks, only, openFromShelf, out, pages, part, phone, pickSection, problems, seen, sentence, shelfRows, shelfWithBooks, speakFor, synthSince, topPassage, until, wav, zip } from './readerlib.mjs';
import { browser } from './readerlib.mjs';

// ================================================================ 8. both widths: nothing sideways, every control named, 44 pt; the type; pages mode
if (part('fit')) {
  for (const viewport of [PHONE, SMALL]) {
    const W = viewport.width;
    const name = `fit-${W}`;
    const { ctx, page } = await phone(name, { viewport });
    await shelfWithBooks(page);
    const sm = await measure(page, '#pg-library .pn.shelf', W);
    check(!sm.side?.length && sm.scroll <= W, `[${name}] the Shelf sticks out sideways: ${JSON.stringify(sm.side)} (${sm.scroll})`);
    check(!sm.unnamed?.length, `[${name}] a control on the Shelf has no name: ${sm.unnamed?.join(' | ')}`);
    check(!sm.small?.length, `[${name}] under 44 pt on the Shelf: ${sm.small?.join(' | ')}`);
    await page.screenshot({ path: `${out}/reader-shelf-${W}.png` });
    await openFromShelf(page, LH);
    for (const sec of ['read', 'chapters', 'search', 'about']) {
      await pickSection(page, sec);
      if (sec === 'search') {
        await page.fill('#pg-reader input.grd-q', 'keeper lens');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      }
      const m = await measure(page, '#pg-reader', W);
      check(!m.side.length && m.scroll <= W, `[${name} ${sec}] sticks out sideways: ${m.side.join(' | ')} (${m.scroll})`);
      check(!m.unnamed.length, `[${name} ${sec}] a control with no name: ${m.unnamed.join(' | ')}`);
      check(!m.small.length, `[${name} ${sec}] under 44 pt: ${m.small.join(' | ')}`);
      check(!m.tiny.length, `[${name} ${sec}] text under 12 pt: ${m.tiny.join(' | ')}`);
      await page.screenshot({ path: `${out}/reader-${sec}-${W}.png` });
    }
    // the book's words: 17 pt to start; the size keys step through the floor (12) and the top (28)
    await pickSection(page, 'read');
    const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-tx')).fontSize));
    check((await px()) === 17, `[${name}] the book's words are ${await px()} px to start (17)`);
    await page.click('#pg-reader .grd-bar .g-key[aria-label^="Text"]');
    await page.waitForTimeout(200);
    for (let i = 0; i < 6; i++) await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Smaller text"]').catch(() => undefined);
    check((await px()) === 12 && (await page.$eval('#pg-reader .grd-prefsbox .g-key[aria-label="Smaller text"]', (b) => b.disabled)), `[${name}] the smallest size is ${await px()} px (12, then no smaller)`);
    for (let i = 0; i < 3; i++) await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Bigger text"]');
    check((await px()) === 17, `[${name}] back up three steps the words are ${await px()} px`);
    // pages mode: a box of whole lines, turned a screen at a time by the keys and by a swipe
    await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Read a page at a time"]');
    await page.waitForTimeout(500);
    const pg = await page.evaluate(() => { const p = document.querySelector('#pg-reader .grd-page'); const lh = parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-flow')).lineHeight); return { pages: p.classList.contains('pages'), inner: p.clientHeight - 32, lh, screen: window.__ghosty.reader.screen, screens: window.__ghosty.reader.screens }; });
    check(pg.pages && pg.inner % pg.lh === 0 && pg.screens > 1, `[${name}] pages mode is not a box of whole lines: ${JSON.stringify(pg)}`);
    // the bar sits under the page, never held over its last lines
    const below = await page.evaluate(() => ({ page: document.querySelector('#pg-reader .grd-page').getBoundingClientRect().bottom, bar: document.querySelector('#pg-reader .grd-bar').getBoundingClientRect().top }));
    check(below.bar >= below.page - 0.5, `[${name}] in pages mode the bar covers the page's last lines: ${JSON.stringify(below)}`);
    await page.click('#pg-reader .grd-prefsbox .g-key[aria-label^="Text"]').catch(() => undefined);
    await page.click('#pg-reader .grd-bar .g-key[aria-label="Next page"]');
    await page.waitForTimeout(500);
    const s1 = (await R(page)).screen;
    const box = await page.locator('#pg-reader .grd-page').boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const s2 = (await R(page)).screen;
    check(s1 === pg.screen + 1 && s2 === s1 + 1, `[${name}] the page did not turn by key then by swipe: ${pg.screen} → ${s1} → ${s2}`);
    const mp = await measure(page, '#pg-reader', W);
    check(!mp.side.length && !mp.small.length && !mp.unnamed.length, `[${name} pages] ${JSON.stringify(mp)}`);
    await page.screenshot({ path: `${out}/reader-pages-${W}.png` });
    await page.evaluate(() => window.__ghosty && localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: false })));
    await ctx.close();
  }
}

await browser.close();
console.log(`MEASURED ${JSON.stringify(measured)}`);
if (problems.length) {
  console.error(`FAIL reader2:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: the reader (2 of 2) — both widths: nothing sideways in any section or on the Shelf, every control named and 44 pt, the book's type 17 pt to start and never under 12, pages mode turning whole lines by key and by swipe.`);
