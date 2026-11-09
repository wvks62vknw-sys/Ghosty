// THE LIBRARY AS A LIBRARY, PART 1 OF 2 (parts 1–7 and 9–12; tests/reader2.spec.mjs has 8, both widths; the shared set-up is tests/readerlib.mjs) (BRIEF-LIBRARY-READER and its 7 Nov addendum; OWNER-ISSUES 125: "i insert books but he can't even read
// them to me and i can't pull up the library and read them myself"), on the preview with the scripted brain and the talk spec's
// stand-in voice (tests/talk.spec.mjs: one queue, an idle voice 120 ms to start, a queued sentence starting as the last ends,
// cancel dropping what was queued), on the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844. Every check fails on the
// code before the reader (a book opened in a pop-up, passage by passage with MORE; no place, no chapters, nothing read aloud):
//  1. A three-chapter book imported (a text with its pages: form feeds) and an e-book with a cover and an author: the Shelf shows
//     covers (the e-book's own picture, a drawn one for the text), authors, the sort (recent, progress, title) and progress on
//     every row; a tap opens THE READER at the book's start with page marks and chapter heads, the stamp line looking at it;
//     THE SPEED BUDGET: the reader opens (tap → its words at his place on the page) in under 1,000 ms.
//  2. The place is kept as he reads, on the phone and on the brain, across a reload: the Shelf row says the page, and the book
//     opens there again with the recognition tone, once.
//  3. CHAPTERS jumps; SEARCH finds inside the book and jumps to the passage, its words marked.
//  4. LISTEN reads from the place passage after passage with no gap (the stand-in's record: each piece handed to the voice before
//     the one before ended), the lit passage following and the place moving; in the phone's own voice by default (my voice can
//     speak, and is not asked); THE SPEED BUDGET: the first word within 1,000 ms of the tap.
//  5. Talking over him silences him within 150 ms and keeps the place; "go on" carries on from that sentence after the bridge,
//     never from the top; a question mid-read is answered and "go on" goes back to the book; "stop reading" ends it and says
//     the page; "that's all" signs off with the page.
//  6. "read me <book>" and "where were we" by words, with no model (the brain's chat is never called); a book he has not got is
//     said so, with the ADD button.
//  7. The Learn hub's library card: "Reading · <the book>" and "Page · N of 9".
//  8. Nothing sticks out sideways at 390 and 440, in every section and on the Shelf; every control has a name and is 44 pt; the
//     book's words 17 pt to start, never under 12; pages mode turns whole lines a screen at a time, by key and by swipe.
//  7. The Learn hub's library card: "Reading · <the book>" and "Page · N of 9".
//  9. Offline, a book kept on this phone (KEEP ON THIS PHONE, its size said) still opens and LISTEN reads it in the phone's voice.
// 10. HIS VOICE FOR BOOKS on: my own voice reads until its share runs out (the stand-in's), then the phone's voice says "My own
//     voice from here." and carries on, with no gap of its own.
// 11. Easy to find (the addendum's third rule): two taps from Learn (the Library's card opens the Shelf, then the book) and one
//     typed word from the jump bar ("read", or a word of its title).
// 12. "Just this chapter", typed while I read and after the next chapter's first words were already handed to the voice: I stop
//     at the end of the chapter he was hearing, say so and where, and none of the next chapter is heard.
//   (part 8, both widths, is in reader2.spec.mjs: it alone runs 290 s, so the spec was split on 8 Nov to keep each inside the smoke loop's 480 s;
//   every assertion kept.)
//   BASE=http://localhost:8788 node tests/reader.spec.mjs [outDir]   (ONLY=shelf,place,listen,talk,words,card,offline,voice,find,chapter)
import { PHONE, UK, openSection } from './nav.mjs';
import { webkitNoise } from './browser.mjs';
import { AUTHOR, CUT_BUDGET, FIRST_WORD_BUDGET, KEY, LH, NW, OPEN_BUDGET, PAGE_LINE, R, RUN, SMALL, api, base, chapterTitles, check, coverJpg, docByTitle, fakeTalk, fromTheSentence, heardLine, lighthouseTxt, measure, measured, ms, nightWalks, only, openFromShelf, out, pages, part, phone, pickSection, problems, seen, sentence, shelfRows, shelfWithBooks, speakFor, synthSince, topPassage, until, wav, zip } from './readerlib.mjs';
import { browser } from './readerlib.mjs';

// ================================================================ 1. the Shelf, and the reader at a book's start
if (part('shelf')) {
  const name = 'shelf';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  const rows = await shelfRows(page);
  const lh = rows.find((r) => r.title === LH);
  const nw = rows.find((r) => r.title === NW);
  check(lh && nw, `[${name}] the two books are not rows on the Shelf: ${JSON.stringify(rows.map((r) => r.title))}`);
  if (nw) {
    check(nw.pic, `[${name}] the e-book's own cover is not on its row (${JSON.stringify(nw)})`);
    check(nw.by === AUTHOR, `[${name}] the e-book's author "${nw.by}", want "${AUTHOR}"`);
  }
  if (lh) {
    check(lh.drawn && !lh.pic, `[${name}] the text with no picture has no drawn cover (${JSON.stringify(lh)})`);
    check(/not started/i.test(lh.truth) && lh.state === 'new', `[${name}] a book never opened does not say so: "${lh.truth}"`);
    check(/9 pages/i.test(lh.kind), `[${name}] the text's pages are not said on its row: "${lh.kind}"`);
  }
  const sorts = await page.$$eval('#pg-library .shelfsort .g-key', (b) => b.map((x) => ({ t: x.textContent, p: x.getAttribute('aria-pressed') })));
  check(sorts.map((s) => s.t?.toLowerCase()).join() === 'recent,progress,title' && sorts.filter((s) => s.p === 'true').length === 1, `[${name}] the sort keys: ${JSON.stringify(sorts)}`);
  await page.screenshot({ path: `${out}/reader-shelf-440.png` });
  // the reader at the book's start: page marks, chapter heads, the stamp line looking at it; the open within the budget
  const open = await openFromShelf(page, LH);
  measured.openMs = open?.ms;
  check(open && open.ms < OPEN_BUDGET, `[speed] the reader took ${ms(open?.ms)} to open the book (the budget is ${OPEN_BUDGET} ms)`);
  check(open && open.n === 0 && open.off === 0 && !open.kept, `[${name}] a book never read did not open at its start: ${JSON.stringify(open)}`);
  const look = await page.evaluate(() => ({
    marks: [...document.querySelectorAll('#pg-reader .grd-pg')].map((m) => m.textContent),
    heads: [...document.querySelectorAll('#pg-reader .grd-ch')].map((m) => m.textContent),
    stamp: document.querySelector('#pg-reader .g-stamp')?.getAttribute('aria-label') ?? '',
    title: document.querySelector('#pg-reader .grd-title')?.textContent ?? '',
    place: document.querySelector('#pg-reader .grd-place')?.textContent ?? '',
    first: document.querySelector('#pg-reader .grd-p .grd-tx')?.textContent ?? '',
    pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec ?? '',
    canvas: getComputedStyle(document.getElementById('pg-reader')).backgroundColor,
    page: getComputedStyle(document.querySelector('#pg-reader .grd-page')).backgroundColor,
  }));
  check(look.marks.length === 9 && look.marks[0] === 'Page 1' && look.marks[8] === 'Page 9', `[${name}] the page marks: ${JSON.stringify(look.marks)}`);
  check(look.heads.join(' | ') === chapterTitles.join(' | '), `[${name}] the chapter heads: ${JSON.stringify(look.heads)}`);
  check(new RegExp(`Looking at ${LH.split(' ').slice(0, 3).join(' ')}`, 'i').test(look.stamp), `[${name}] the stamp line does not look at the book: "${look.stamp}"`);
  check(look.title === LH && /page 1 of 9/i.test(look.place), `[${name}] the head: "${look.title}" · "${look.place}"`);
  check(/^On page 1 the keeper climbed/.test(look.first) && look.pill === 'read', `[${name}] it did not open on READ at the first words: "${look.first.slice(0, 60)}" (${look.pill})`);
  check(look.canvas === 'rgb(16, 19, 23)' && look.page === 'rgb(23, 27, 32)', `[${name}] not the tokens' canvas and plate (not so dark): ${look.canvas} / ${look.page}`);
  // the words carried from one passage to the next are not read twice (the old pop-up repeated them at every passage)
  const text = await page.evaluate(() => [...document.querySelectorAll('#pg-reader .grd-tx')].map((p) => p.textContent).join(' '));
  check((text.match(/listened to the sea breathing against the rocks/g) ?? []).length === 9, `[${name}] a sentence is shown more than once a page (the passages' overlap repeated)`);
  await page.screenshot({ path: `${out}/reader-open-440.png` });
  console.log(`[${name}] opened in ${ms(open?.ms)}; ${look.marks.length} page marks, ${look.heads.length} chapter heads; rows: ${rows.length}`);
  await ctx.close();
}

// ================================================================ 2. the place kept, across a reload; 3. CHAPTERS and SEARCH
if (part('place')) {
  const name = 'place';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  const doc = await docByTitle(LH);
  // CHAPTERS: three, the one he is in marked; a tap on the second jumps there
  await pickSection(page, 'chapters');
  const ch = await page.$$eval('#pg-reader .grd-chrow', (b) => b.map((x) => ({ t: x.querySelector('b')?.textContent ?? '', cur: x.getAttribute('aria-current') === 'true', label: x.getAttribute('aria-label') ?? '' })));
  check(ch.length === 3 && ch[0].cur && ch.map((c) => c.t).join(' | ') === chapterTitles.join(' | '), `[${name}] CHAPTERS lists ${JSON.stringify(ch)}`);
  await page.screenshot({ path: `${out}/reader-chapters-440.png` });
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(500);
  const at2 = await page.evaluate(() => ({ pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec, place: window.__ghosty.reader.place(window.__ghosty.reader.doc) }));
  check(at2.pill === 'read' && at2.place?.n === 3 && at2.place?.page === 4, `[${name}] CHAPTERS → Chapter Two did not jump there: ${JSON.stringify(at2)}`);
  check((await topPassage(page)) === 3, `[${name}] Chapter Two is not at the top of the page (passage ${await topPassage(page)})`);
  // SEARCH: "storm" is on page 5 only: a result, then a tap jumps there with the word marked
  await pickSection(page, 'search');
  await page.fill('#pg-reader input.grd-q', 'storm');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const hits = await page.$$eval('#pg-reader .grd-hit', (b) => b.map((x) => ({ n: Number(x.dataset.n), text: x.textContent ?? '', marks: [...x.querySelectorAll('mark')].map((m) => m.textContent) })));
  check(hits.length === 1 && hits[0].n === 4 && hits[0].marks.includes('storm') && /Page 5/i.test(hits[0].text), `[${name}] SEARCH "storm": ${JSON.stringify(hits)}`);
  await page.screenshot({ path: `${out}/reader-search-440.png` });
  if (hits.length) await page.click('#pg-reader .grd-hit');
  await page.waitForTimeout(600);
  const marked = await page.evaluate(() => ({ pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec, found: document.querySelector('#pg-reader .grd-p.found')?.dataset.n ?? null, marks: [...document.querySelectorAll('#pg-reader .grd-p.found mark')].map((m) => m.textContent), inView: (() => { const m = document.querySelector('#pg-reader .grd-p.found mark'); const r = m?.getBoundingClientRect(); return !!r && r.top > 0 && r.bottom < innerHeight; })(), box: !document.querySelector('#pg-reader .g-lock')?.hidden }));
  check(marked.pill === 'read' && marked.found === '4' && marked.marks.includes('storm') && marked.inView && marked.box, `[${name}] the search result did not open marked: ${JSON.stringify(marked)}`);
  // scrolled on by hand to page 6 (a real wheel over the page, as a finger is): the place follows; then the brain has it (another
  // device would open there)
  const by = await page.evaluate(() => {
    const el = document.querySelector('#pg-reader .grd-p[data-n="5"]');
    const pills = document.querySelector('#pg-reader .secpills').getBoundingClientRect();
    const pg = document.querySelector('#pg-reader .grd-page').getBoundingClientRect();
    return { dy: el.getBoundingClientRect().top - pills.bottom - 8 + 40, x: pg.left + pg.width / 2, y: pills.bottom + 120 };
  });
  await page.mouse.move(by.x, by.y);
  await page.mouse.wheel(0, by.dy);
  await page.waitForTimeout(2200);
  const kept = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(kept?.n === 5 && kept?.page === 6, `[${name}] scrolling to page 6 did not move the place: ${JSON.stringify(kept)}`);
  const onBrain = doc ? (await api(`/library/place?doc=${doc.id}`)).place : null;
  check(onBrain?.n === 5 && onBrain?.page === 6, `[${name}] the brain does not have the place: ${JSON.stringify(onBrain)}`);
  // a reload: the Shelf row says the page, and the book opens there with the recognition tone, once
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.evaluate(() => window.__ghosty.settings.set({ sounds: true }));
  await page.mouse.click(5, 300); // (sound needs one tap first, as on the phone)
  await shelfWithBooks(page);
  const row = (await shelfRows(page)).find((r) => r.title === LH);
  check(row && /page 6 of 9/i.test(row.truth) && /today/i.test(row.truth) && row.state === 'reading', `[${name}] after a reload the Shelf row says "${row?.truth}"`);
  await page.screenshot({ path: `${out}/reader-shelf-progress-440.png` });
  const tones = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'lock').length);
  const again = await openFromShelf(page, LH);
  check(again?.kept && again.n === 5, `[${name}] the book did not open at his place after a reload: ${JSON.stringify(again)}`);
  check((await topPassage(page)) === 5, `[${name}] page 6 is not at the top after the reopen (passage ${await topPassage(page)})`);
  await page.waitForTimeout(400);
  const toneNow = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'lock').length);
  check(toneNow === tones + 1 && again?.tone, `[${name}] the recognition tone played ${toneNow - tones} times as the book opened at his place (once)`);
  measured.reopenMs = again?.ms;
  check(again && again.ms < OPEN_BUDGET, `[speed] reopening at his place took ${ms(again?.ms)} (the budget is ${OPEN_BUDGET} ms)`);
  await page.screenshot({ path: `${out}/reader-reopen-440.png` });
  console.log(`[${name}] chapters ${ch.length}; search ${hits.length}; place kept on the phone and the brain at page 6; reopened in ${ms(again?.ms)} with ${toneNow - tones} tone`);
  await ctx.close();
}

// ================================================================ 4. LISTEN: passage after passage, no gap, the phone's voice
if (part('listen')) {
  const name = 'listen';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  // from the start of Chapter Two (passage 3): two passages' ends crossed while he listens
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(500);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, () => (window.__ghosty.reader.listen.pieces.at(-1)?.n ?? 0) >= 5, null, 30000, `[${name}] LISTEN never reached the third passage`);
  const said = (await synthSince(page, t0)).filter((s) => s.startAt !== null);
  const listenAt = await page.evaluate(() => window.__talk.listenAt);
  const first = said[0];
  measured.listenFirstWord = first ? first.startAt - listenAt : null;
  check(first && first.startAt - listenAt <= FIRST_WORD_BUDGET, `[speed] LISTEN's first word came ${ms(measured.listenFirstWord)} after the tap (budget ${FIRST_WORD_BUDGET} ms)`);
  check(first && /^Chapter Two: The Gale/.test(first.text), `[${name}] LISTEN did not start at his place (Chapter Two): "${first?.text}"`);
  // every piece handed to the voice before the one before it ended, and started as it ended (across the passages' ends too)
  const done = said.filter((s) => s.endAt !== null);
  const gaps = done.slice(1).map((s, i) => ({ handed: s.calledAt < done[i].endAt, gap: s.startAt - done[i].endAt, text: s.text.slice(0, 30) }));
  measured.listenGaps = gaps.map((g) => Math.round(g.gap));
  check(gaps.length >= 10, `[${name}] only ${gaps.length + 1} pieces said`);
  check(gaps.every((g) => g.handed), `[${name}] a piece was handed to the voice only after the one before it ended: ${JSON.stringify(gaps.filter((g) => !g.handed))}`);
  check(gaps.every((g) => g.gap <= 40), `[${name}] a gap between pieces: ${measured.listenGaps.join(', ')} ms`);
  // the phone's own voice by default: my voice could speak (the status says so), and none of the book went to it
  const tts = await page.evaluate(() => window.__talk.tts.map((x) => x.text));
  check(!tts.some((x) => /keeper|gulls|Chapter Two/.test(x)), `[${name}] the book went to my own voice by default: ${JSON.stringify(tts.slice(0, 3))}`);
  // the lit passage follows the voice, and the place moves with it
  const lit = await page.evaluate(() => ({ lit: document.querySelector('#pg-reader .grd-p.lit')?.dataset.n ?? null, frame: !!document.querySelector('#pg-reader .grd-p.lit > .grd-litframe'), current: document.querySelector('#pg-reader .grd-p[aria-current="true"]')?.dataset.n ?? null, reading: window.__ghosty.reader.reading, place: window.__ghosty.reader.place(window.__ghosty.reader.doc), bar: document.querySelector('#pg-reader .grd-barline')?.textContent ?? '' }));
  check(lit.lit === String(lit.reading.lit) && lit.frame && lit.current === lit.lit && Number(lit.lit) >= 5, `[${name}] the lit passage does not follow the voice: ${JSON.stringify(lit)}`);
  check(lit.place?.n >= 5 && lit.place.n === lit.reading.n, `[${name}] the place did not move with the voice: ${JSON.stringify(lit.place)} (reading ${lit.reading.n})`);
  check(/attending/i.test(lit.bar) && /phone/i.test(lit.bar), `[${name}] the bar does not say it is attending, in the phone's voice: "${lit.bar}"`);
  // (in view is between the held pills and the bar: the words under either are hidden; the page glides there, so a moment is given)
  const between = () => {
    const r = document.querySelector('#pg-reader .grd-p.lit')?.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-flow')).lineHeight);
    return !!r && r.top < document.querySelector('#pg-reader .grd-bar').getBoundingClientRect().top - lh && r.bottom > document.querySelector('#pg-reader .secpills').getBoundingClientRect().bottom + lh;
  };
  await page.waitForFunction(between, null, { timeout: 2000 }).catch(() => undefined);
  const litBox = await page.evaluate(() => {
    const r = document.querySelector('#pg-reader .grd-p.lit')?.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-flow')).lineHeight);
    return r ? { top: r.top, bottom: r.bottom, pills: document.querySelector('#pg-reader .secpills').getBoundingClientRect().bottom, bar: document.querySelector('#pg-reader .grd-bar').getBoundingClientRect().top, lh } : null;
  });
  check(litBox && litBox.top < litBox.bar - litBox.lh && litBox.bottom > litBox.pills + litBox.lh, `[${name}] the page did not follow the voice: the lit passage is not between the pills and the bar ${JSON.stringify(litBox)}`);
  // a chapter's end names the next chapter: Chapter Three's head is read as it comes
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => /^Chapter Three/.test(p.text)), null, 30000, `[${name}] the next chapter's name was not said at the chapter's end`);
  await page.waitForTimeout(900); // (the page glides to the new chapter: the picture once it is there)
  await page.screenshot({ path: `${out}/reader-listen-440.png` });
  // STOP: the reading ends and the page is said ("Page 7. I'll carry on from here.")
  const s0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await heardLine(page, s0, PAGE_LINE, 8000, `[${name}] STOP did not say the page`);
  console.log(`[${name}] first word ${ms(measured.listenFirstWord)} after the tap; ${said.length} pieces; gaps ${JSON.stringify(measured.listenGaps)}`);
  await ctx.close();
}

// ================================================================ 5. talking over him, "go on", a question, "stop reading", "that's all"
if (part('talk')) {
  const name = 'talk';
  const { ctx, page, io } = await phone(name, { tts: true, wordMs: 60 });
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  await page.click('#pg-reader .grd-bar .g-key.fill');
  // (the ear over his voice first learns the echo: barge.ts) a few sentences in, he talks over me
  await until(page, () => (window.__ghosty.reader.listen.pieces.length ?? 0) >= 4 && window.__ghosty.ui.get().voice === 'speaking', null, 20000, `[${name}] LISTEN did not get going`);
  await page.waitForTimeout(900);
  io.heard.push('go on');
  const cutPiece = await page.evaluate(() => window.__ghosty.reader.listen.pieces.at(-1));
  const silence = await page.evaluate(() => new Promise((resolve) => {
    const t = performance.now();
    window.__mic.set(0.3);
    const look = () => {
      const s = window.__talk.synth.find((x) => x.startAt && (x.pausedAt >= t || (x.cancelled && x.endAt >= t)));
      if (s) return resolve(Math.min(s.pausedAt ?? Infinity, s.cancelled ? s.endAt : Infinity) - t);
      if (performance.now() - t > 3000) return resolve(-1);
      setTimeout(look, 5);
    };
    look();
  }));
  measured.cutToSilence = silence;
  check(silence >= 0 && silence <= CUT_BUDGET, `[${name}] talking over him took ${ms(silence)} to silence him (budget ${CUT_BUDGET} ms)`);
  await page.waitForTimeout(500);
  const endAt = await page.evaluate(() => { window.__mic.set(0); return performance.now(); });
  const cut = await R(page);
  check(cut.reading.state === 'cut' && cut.reading.n === cutPiece.n && cut.reading.off === cutPiece.off, `[${name}] the place did not stay at the sentence he was in: ${JSON.stringify({ reading: cut.reading, cutPiece })}`);
  const keptAt = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(keptAt?.n === cutPiece.n && keptAt?.off === cutPiece.off, `[${name}] the kept place is not the cut sentence: ${JSON.stringify(keptAt)}`);
  // "go on": the bridge, then the sentence he was in — never the top
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && /^Back to The Lighthouse Keeper/.test(s.text) && s.startAt), endAt, 12000, `[${name}] "go on" did not carry on with the bridge: ${JSON.stringify((await synthSince(page, endAt)).map((s) => s.text).slice(0, 3))}`);
  const resumed = await synthSince(page, endAt);
  const bridge = resumed.findIndex((s) => /^Back to The Lighthouse Keeper/.test(s.text));
  measured.resumeMs = bridge >= 0 ? resumed[bridge].startAt - endAt : null;
  check(bridge >= 0 && resumed[bridge + 1] && (await fromTheSentence(page, resumed, bridge, cutPiece, endAt)), `[${name}] after the bridge came "${resumed[bridge + 1]?.text}", not the cut sentence "${cutPiece.text}"`);
  check(!resumed.some((s) => /^Chapter One: The Lamp/.test(s.text)), `[${name}] "go on" started again from the top`);
  check(!(await page.evaluate(() => document.body.innerText.includes('Mock reply to: go on'))), `[${name}] "go on" went to the brain`);
  // a question mid-read: answered (by the brain), then "go on" goes back to the book from the same sentence
  await until(page, () => window.__ghosty.reader.reading.state === 'reading' && window.__ghosty.reader.listen.pieces.length > 0, null, 8000);
  await page.waitForTimeout(1500);
  const q0 = await page.evaluate(() => window.__ghosty.reader.listen.pieces.at(-1));
  io.heard.push('what does that word mean?');
  await speakFor(page, 700);
  check(await seen(page, /Mock reply to: what does that word mean/, 15000), `[${name}] the question mid-read was not answered`);
  const qCut = await R(page);
  check(qCut.reading.state === 'cut' && qCut.reading.n === q0.n, `[${name}] the book's place did not wait at the sentence of the question: ${JSON.stringify(qCut.reading)} (was ${JSON.stringify(q0)})`);
  // the reply said, the ear opens again (the conversation): "go on"
  await until(page, () => window.__ghosty.ui.get().voice === 'listening', null, 20000, `[${name}] the ear did not open again after the answer`);
  await page.waitForTimeout(400);
  io.heard.push('go on');
  const g2 = await speakFor(page, 500);
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && /^Back to The Lighthouse Keeper/.test(s.text)), g2, 12000, `[${name}] "go on" after the answer did not go back to the book`);
  const back2 = await synthSince(page, g2);
  const b2 = back2.findIndex((s) => /^Back to The Lighthouse Keeper/.test(s.text));
  check(b2 >= 0 && back2[b2 + 1] && (await fromTheSentence(page, back2, b2, q0, g2)), `[${name}] after the answer the book carried on from "${back2[b2 + 1]?.text}", not the sentence of "${q0.text}"`);
  // "stop reading": it ends, and the page is said
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 8000);
  await page.waitForTimeout(1200);
  io.heard.push('stop reading');
  const st = await speakFor(page, 600);
  await heardLine(page, st, PAGE_LINE, 12000, `[${name}] "stop reading" did not end it with the page said`);
  check((await R(page)).reading.state === 'ended', `[${name}] after "stop reading" the reading is "${(await R(page)).reading.state}"`);
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg')].slice(-2).map((m) => m.textContent ?? '').join(' | ').match(/stop reading.*Page \d\. I['’]ll carry on from here/i) !== null), `[${name}] "stop reading" and the page are not in the conversation`);
  // "that's all" while I read: the conversation ends, signed off with the page, the microphone let go
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 8000);
  await page.waitForTimeout(1500);
  io.heard.push("that's all");
  const ta = await speakFor(page, 600);
  await heardLine(page, ta, PAGE_LINE, 12000, `[${name}] "that's all" did not sign off with the page`);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ mic: document.querySelector('#mic')?.classList.contains('on'), live: window.__mic.stream?.getTracks().some((t) => t.readyState === 'live'), voice: window.__ghosty.ui.get().voice, chat: window.__talk.chat }));
  check(!after.mic && after.voice !== 'listening', `[${name}] after "that's all" the microphone is still held: ${JSON.stringify(after)}`);
  check(!(await page.evaluate(() => document.body.innerText.includes("Mock reply to: that's all"))), `[${name}] "that's all" went to the brain`);
  await page.screenshot({ path: `${out}/reader-talk-440.png` });
  console.log(`[${name}] silent ${ms(silence)} after his voice began; "go on" carried on ${ms(measured.resumeMs)} after he stopped; a question answered and the book went on; "stop reading" and "that's all" said the page`);
  await ctx.close();
}

// ================================================================ 6. by words, with no model
if (part('words')) {
  const name = 'words';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  const chat0 = await page.evaluate(() => window.__talk.chat);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', `read me night walks`);
  await page.keyboard.press('Enter');
  await until(page, () => document.body.dataset.tab === 'reader' && window.__ghosty.reader.reading.state === 'reading', null, 15000, `[${name}] "read me night walks" did not open the reader and read`);
  const r1 = await R(page);
  const enter = await page.evaluate(() => window.__talk.key);
  // (handed to the voice is not yet heard: the first word is timed when it begins)
  await page.waitForFunction((t) => window.__talk.synth.some((s) => s.calledAt >= t && s.startAt), enter, { timeout: 8000 }).catch(() => undefined);
  const said1 = await synthSince(page, enter);
  measured.readMeFirstWord = said1[0]?.startAt ? said1[0].startAt - enter : null;
  check(said1[0] && /^Night Walks/.test(said1[0].text) && /from the start/.test(said1[0].text), `[${name}] "read me night walks" did not start with the book's name: "${said1[0]?.text}"`);
  check(measured.readMeFirstWord !== null && measured.readMeFirstWord <= FIRST_WORD_BUDGET, `[speed] "read me" said its first word ${ms(measured.readMeFirstWord)} after Enter (budget ${FIRST_WORD_BUDGET} ms)`);
  check(r1.reading.title === NW, `[${name}] it is reading "${r1.reading.title}"`);
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => /canal/.test(p.text)), null, 10000, `[${name}] Night Walks' own words were not read`);
  // stop, and "where were we" from Home: the place said, and on it reads
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await page.waitForTimeout(800);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', 'where were we?');
  await page.keyboard.press('Enter');
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 15000, `[${name}] "where were we" did not carry on reading`);
  const w0 = await page.evaluate(() => window.__talk.key);
  const said2 = await synthSince(page, w0);
  check(said2[0] && /^We were .* into Night Walks/.test(said2[0].text), `[${name}] "where were we" did not say where we were: "${said2[0]?.text}"`);
  // a book he has not got: said so, with ADD
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await page.waitForTimeout(600);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', 'read me the count of monte cristo');
  await page.keyboard.press('Enter');
  check(await seen(page, /I don’t have that one\. ADD it to the library and I’ll read it\./, 8000), `[${name}] a book he has not got was not said so`);
  const add = page.locator('#pg-core .log .msg .localgo', { hasText: /^ADD$/ }).last();
  check(await add.count(), `[${name}] no ADD button under "I don't have that one"`);
  await page.screenshot({ path: `${out}/reader-words-440.png` });
  if (await add.count()) {
    await add.click();
    await until(page, () => document.body.dataset.tab === 'library' && document.querySelector('#pg-library .secpill.on')?.dataset.sec === 'add', null, 8000, `[${name}] ADD did not open the Library on Add`);
  }
  const chat1 = await page.evaluate(() => window.__talk.chat);
  check(chat1 === chat0, `[${name}] the brain's chat was called ${chat1 - chat0} times for reading by words (no model)`);
  console.log(`[${name}] "read me": first word ${ms(measured.readMeFirstWord)} after Enter; "where were we" carried on; no model asked (${chat1 - chat0} calls)`);
  await ctx.close();
}

// ================================================================ 7. the Learn hub's library card
if (part('card')) {
  const name = 'card';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => (location.hash = 'area-learn'));
  await until(page, () => document.querySelector('#pg-area-learn .hubtile[data-id="library"] .reads'), null, 10000, `[${name}] no library card on Learn`);
  await page.waitForTimeout(1200);
  const reads = await page.$$eval('#pg-area-learn .hubtile[data-id="library"] .reads .rd', (ds) => ds.map((d) => `${d.querySelector('em')?.textContent?.trim()} · ${d.querySelector('b')?.textContent?.trim()}`));
  const want = [`Reading · ${LH.split(' ').slice(0, 8).join(' ')}`, 'Page · 4 of 9'];
  check(reads.join(' | ') === want.join(' | '), `[${name}] the library card reads ${JSON.stringify(reads)}, want ${JSON.stringify(want)}`);
  await page.screenshot({ path: `${out}/reader-card-440.png` });
  console.log(`[${name}] ${reads.join(' | ')}`);
  await ctx.close();
}

// ================================================================ 9. offline: a book kept on this phone reads, in the phone's voice
if (part('offline')) {
  const name = 'offline';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await openFromShelf(page, NW);
  await pickSection(page, 'about');
  const keep = page.locator('#pg-reader .grd-keepkey');
  const words = (await keep.textContent()) ?? '';
  check(/(Keep|Kept) on this phone · \d+ KB/i.test(words), `[${name}] KEEP ON THIS PHONE does not say its size: "${words}"`);
  if (!(await keep.isDisabled())) await keep.click();
  await until(page, () => /Kept on this phone/i.test(document.querySelector('#pg-reader .grd-keepkey')?.textContent ?? ''), null, 15000, `[${name}] KEEP ON THIS PHONE never finished`);
  await page.screenshot({ path: `${out}/reader-about-kept-440.png` });
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = 'library'));
  await page.waitForTimeout(800);
  await openSection(page, 'library', 'Shelf');
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-library .pn.shelf .bookrow .v')].some((v) => v.textContent === t), NW, { timeout: 15000 }).catch(() => problems.push(`[${name}] offline, the kept book is not on the Shelf`));
  await page.evaluate(() => { window.__talk.tts.length = 0; });
  const open = await openFromShelf(page, NW);
  check(open && (await page.evaluate(() => /moon sat in the water/.test(document.querySelector('#pg-reader .grd-flow')?.textContent ?? ''))), `[${name}] offline, the kept book does not read`);
  // how it is now (STANDARD, the second habit): reading works from this phone's copy, his place waits on this phone for the brain
  await pickSection(page, 'about');
  const marksOff = await page.$$eval('#pg-reader .grd-marks > .g-truth', (ls) => ls.map((l) => `${l.dataset.mark}: ${l.textContent}`));
  check(marksOff.length === 3 && /^working: Reading/.test(marksOff[0] ?? '') && /^offline: Your place/.test(marksOff[2] ?? ''), `[${name}] offline, ABOUT does not say how things are: ${JSON.stringify(marksOff)}`);
  // (from its first chapter, The Canal: the checks before left his place anywhere in it)
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && s.startAt && /canal|towpath|Canal/.test(s.text)), t0, 10000, `[${name}] offline, LISTEN did not read the kept book in the phone's voice`);
  check(!(await page.evaluate(() => window.__talk.tts.length)), `[${name}] offline, LISTEN asked for my own voice`);
  await page.click('#pg-reader .grd-bar .g-key.fill').catch(() => undefined);
  await page.screenshot({ path: `${out}/reader-offline-440.png` });
  await ctx.setOffline(false);
  await ctx.close();
}

// ================================================================ 10. HIS VOICE FOR BOOKS: my voice until the share runs out, then the phone's, said
if (part('voice')) {
  const name = 'voice';
  const { ctx, page } = await phone(name, { tts: true, shareAfter: 3 });
  await page.evaluate(() => localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: true })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(600);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && s.text === 'My own voice from here.' && s.startAt), t0, 30000, `[${name}] the share ran out and "My own voice from here." was not said`);
  await until(page, (t) => window.__talk.synth.filter((s) => s.calledAt > t && s.startAt).length >= 4, t0, 15000);
  const clips = await page.evaluate((t) => window.__talk.clips.filter((c) => c.at > t && c.dur > 0.3), t0);
  const played = clips.filter((c) => c.ev === 'ended');
  const said = await synthSince(page, t0);
  const sw = said.findIndex((s) => s.text === 'My own voice from here.');
  const lastClipEnd = played.at(-1)?.at ?? null;
  measured.voiceSwitchGap = sw >= 0 && lastClipEnd ? said[sw].startAt - lastClipEnd : null;
  check(played.length === 3, `[${name}] ${played.length} clips of my own voice played before the share ran out (3)`);
  check(sw === 0, `[${name}] the phone's voice said something before "My own voice from here.": ${JSON.stringify(said.slice(0, 2).map((s) => s.text))}`);
  check(measured.voiceSwitchGap !== null && measured.voiceSwitchGap <= 300, `[${name}] the switch left ${ms(measured.voiceSwitchGap)} of silence (the phone voice's own start is 120 ms: at most 300)`);
  // and carries on from the piece that was next, back to back
  const after = said.slice(sw + 1).filter((s) => s.endAt);
  check(after.length >= 2 && after.slice(1).every((s, i) => s.calledAt < after[i].endAt), `[${name}] after the switch the pieces were not handed back to back`);
  const tts = await page.evaluate((t) => window.__talk.tts.filter((x) => x.at > t).map((x) => x.text), t0);
  check(after[0] && tts[3] && after[0].text === tts[3], `[${name}] the phone's voice did not carry on from the piece my voice could not say ("${tts[3]}"): "${after[0]?.text}"`);
  const bar = await page.evaluate(() => document.querySelector('#pg-reader .grd-barline')?.textContent ?? '');
  check(/phone/i.test(bar), `[${name}] the bar does not say the phone's voice reads from here: "${bar}"`);
  await page.screenshot({ path: `${out}/reader-voice-440.png` });
  // ABOUT says LISTEN is degraded now (my own voice used up for today, the phone's reading), while I go on reading
  const listenMark = await page.$eval('#pg-reader .grd-marks > .g-truth:nth-child(2)', (l) => `${l.dataset.mark}: ${l.textContent}`).catch(() => '');
  check(/^degraded: Listen/.test(listenMark) && /phone/.test(listenMark), `[${name}] ABOUT does not say LISTEN is degraded after the switch: "${listenMark}"`);
  await page.click('#pg-reader .grd-bar .g-key.fill').catch(() => undefined);
  await page.evaluate(() => localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: false })));
  console.log(`[${name}] ${played.length} clips of my own voice, then "My own voice from here." ${ms(measured.voiceSwitchGap)} after the last ended, and on`);
  await ctx.close();
}

// ================================================================ 11. easy to find: two taps from Learn, one word from the jump bar
if (part('find')) {
  const name = 'find';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  // somewhere in the book already (Chapter Two), so the open is at his place
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(400);
  // the Library somewhere else than its Shelf, as he may have left it
  await page.evaluate(() => (location.hash = 'library'));
  await openSection(page, 'library', 'Ask');
  await page.evaluate(() => (location.hash = 'area-learn'));
  await until(page, () => !!document.querySelector('#pg-area-learn .hubtile[data-id="library"]'), null, 10000, `[${name}] no library card on Learn`);
  await page.waitForTimeout(600);
  const card = page.locator('#pg-area-learn .hubtile[data-id="library"]');
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await card.click(); // tap 1
  await until(page, () => document.body.dataset.tab === 'library' && document.querySelector('#pg-library .secpill.on')?.dataset.sec === 'shelf', null, 8000, `[${name}] the Library's card on Learn did not open the Shelf (${await page.evaluate(() => `${document.body.dataset.tab} / ${document.querySelector('#pg-library .secpill.on')?.dataset.sec}`)})`);
  const row = page.locator('#pg-library .pn.shelf .bookrow', { has: page.locator('.v', { hasText: LH }) }).first();
  await row.waitFor({ state: 'visible', timeout: 8000 }).catch(() => problems.push(`[${name}] the book is not in view on the Shelf after one tap`));
  const before = (await R(page))?.opens?.length ?? 0;
  await row.click(); // tap 2
  await until(page, (n) => document.body.dataset.tab === 'reader' && (window.__ghosty.reader?.opens?.length ?? 0) > n, before, 8000, `[${name}] two taps from Learn did not open the book`);
  const two = (await R(page))?.opens?.at(-1);
  check(two?.doc === (await docByTitle(LH))?.id && two?.kept && two?.n === 3, `[${name}] two taps from Learn did not open the book at his place: ${JSON.stringify(two)}`);
  await page.screenshot({ path: `${out}/reader-two-taps-440.png` });
  // one typed word: "read" finds the reader, a word of the title finds the book itself
  const jump = async (words, want) => {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette.on input', { timeout: 5000 }).catch(() => problems.push(`[${name}] the jump bar did not open`));
    await page.fill('#palette input', words);
    await page.waitForTimeout(300);
    // (THE SCAN's jump bar locks on its find in a plate whose OPEN takes it, the name set as a tag in capitals; Glass's palette lists the row)
    const found = page.locator('#palette .jplate', { has: page.locator('.jname', { hasText: new RegExp(want.source, 'i') }) }).first();
    const hit = (await found.count()) ? found.locator('[data-act="open"]') : page.locator('#palette .it', { has: page.locator('span', { hasText: want }) }).first();
    if (!(await hit.count())) {
      problems.push(`[${name}] "${words}" in the jump bar does not find ${want}: ${(await page.$$eval('#palette .it span, #palette .jplate .jname', (x) => x.map((e) => e.textContent))).join(' | ')}`);
      await page.keyboard.press('Escape');
      return null;
    }
    const n = (await R(page))?.opens?.length ?? 0;
    await hit.click();
    await until(page, (k) => document.body.dataset.tab === 'reader' && (window.__ghosty.reader?.opens?.length ?? 0) >= k, n, 8000, `[${name}] "${words}" → ${want} did not open the reader`);
    await page.waitForTimeout(400);
    return { tab: await page.evaluate(() => document.body.dataset.tab), doc: (await R(page))?.doc };
  };
  const byRead = await jump('read', /^Reader$/);
  check(byRead?.tab === 'reader' && byRead.doc === two?.doc, `[${name}] "read" in the jump bar did not open the reader on the book he was reading: ${JSON.stringify(byRead)}`);
  const byTitle = await jump('lighthouse', new RegExp(`^Read: ${LH}$`));
  check(byTitle?.tab === 'reader' && byTitle.doc === two?.doc, `[${name}] a word of the title in the jump bar did not open the book: ${JSON.stringify(byTitle)}`);
  console.log(`[${name}] two taps from Learn to the book at his place; "read" and "lighthouse" from the jump bar`);
  await ctx.close();
}

// ================================================================ 12. "just this chapter", typed mid-read, after the voice was handed the next chapter
if (part('chapter')) {
  const name = 'chapter';
  // (a slower stand-in voice: each sentence about two seconds, so the words are typed while the chapter's last sentences are said)
  const { ctx, page } = await phone(name, { tts: true, wordMs: 120 });
  await shelfWithBooks(page);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  const chat0 = await page.evaluate(() => window.__talk.chat);
  const type = async (words) => {
    if (await page.evaluate(() => document.body.dataset.tab !== 'core')) {
      await page.evaluate(() => (location.hash = 'core'));
      await page.waitForTimeout(400);
    }
    await page.click('.logbtn').catch(() => undefined);
    await page.fill('#cin', words);
    await page.keyboard.press('Enter');
  };
  // page 6 is the last page of Chapter Two: its six sentences, then Chapter Three
  await type(`read from page 6 of ${LH.toLowerCase()}`);
  await until(page, () => window.__ghosty.reader?.reading?.state === 'reading', null, 15000, `[${name}] "read from page 6" did not start reading`);
  // the fourth sentence of page 6 being said: the voice already holds the rest of the page and Chapter Three's head
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => p.n === 5 && /^Far out on the water/.test(p.text)), null, 30000, `[${name}] page 6's fourth sentence was never said`);
  const queued = await page.evaluate(() => window.__talk.synth.some((x) => /^Chapter Three/.test(x.text)));
  await type('just this chapter');
  const t0 = await page.evaluate(() => performance.now());
  await heardLine(page, t0, /That['’]s the end of Chapter Two: The Gale\. Page 7\. I['’]ll carry on from here\./, 20000, `[${name}] the end of the chapter was not said`);
  await page.waitForTimeout(800);
  const heard = await page.evaluate(() => window.__talk.synth.filter((x) => /^Chapter Three|^On page 7/.test(x.text)).map((x) => ({ text: x.text.slice(0, 30), startAt: x.startAt ?? null, endAt: x.endAt ?? null, cancelled: !!x.cancelled })));
  check(heard.every((x) => x.startAt === null || (x.cancelled && x.endAt - x.startAt <= 30)), `[${name}] the next chapter was heard after "just this chapter": ${JSON.stringify(heard)}`);
  const end = await R(page);
  check(end.reading.state === 'ended' && !end.reading.finished && end.listen.ends.at(-1) === 'chapter', `[${name}] the reading did not end at the chapter's end: ${JSON.stringify({ state: end.reading.state, finished: end.reading.finished, ends: end.listen.ends })}`);
  const place = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(place?.n === 6 && place?.off === 0 && place?.page === 7, `[${name}] the place did not move to Chapter Three's start: ${JSON.stringify(place)}`);
  check((await page.evaluate(() => window.__talk.chat)) === chat0, `[${name}] the brain's chat was called for reading by words`);
  await page.screenshot({ path: `${out}/reader-chapter-440.png` });
  console.log(`[${name}] "just this chapter" typed with Chapter Three ${queued ? 'already handed to the voice' : 'not yet handed over'}: stopped at the chapter's end, the place at page 7`);
  await ctx.close();
}
await browser.close();
console.log(`MEASURED ${JSON.stringify(measured)}`);
if (problems.length) {
  console.error(`FAIL reader:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: the reader (1 of 2) — the Shelf with covers, authors, progress and the sort; a book at its start with page marks and chapter heads in ${ms(measured.openMs)}; the place kept across a reload with one tone; chapters and search; LISTEN with no gap, the first word in ${ms(measured.listenFirstWord)}; talked over and silent in ${ms(measured.cutToSilence)}; "go on", a question, "stop reading", "that's all"; by words with no model; the card; offline; my voice to the phone's, said; easy to find; "just this chapter".`);
