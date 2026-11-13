// THE FULL EDITORS, THE FOURTH: PRESENTATIONS, the core of PowerPoint (BRIEF-EDITOR-PRESENTATIONS; OWNER-ISSUES 127, 164, 176, 178) on the owner's
// iPhone 18 Pro Max (440 × 956, en-GB, Europe/London) and at 390 × 844, against the real brain with its scripted model:
//  (a) MAKE → PRESENTATIONS in two taps; "my slides" in the chat opens it;
//  (b) the empty state's words; START FROM A REPORT on a seeded report (six sections and a chart) makes the slides, the chart slide and the
//      sources slide last;
//  (c) a slide edited in the line above it, a bullet added by Enter, bold on a selection; the layout changed from the sheet of nine;
//  (d) INSERT a picture, a chart from a typed table, a table, a shape (a third is refused in words);
//  (e) the theme changed repaints every slide (the ground and the accent sampled on two slides equal to the theme's);
//  (f) REORDER by MOVE DOWN and by press-and-drag; DUPLICATE; DELETE and UNDO;
//  (g) NOTES typed; PRESENT shows the slide, the notes, the next title, NEXT and BACK; a build advances on a tap; the arrows work; a two-finger
//      tap goes back; reduced motion stills the transition (no transition class);
//  (h) EXPORT .pptx: the size said; its parts all well formed in the browser's own parser; it is read back by the app's reader equal in words,
//      notes and order; EXPORT PDF one slide a page (and the notes pages after, when asked); one slide as a PNG;
//  (i) IMPORT of a hand-built .pptx keeps its text and says what it could not keep; an old .ppt and a damaged file are told in words;
//  (j) autosave said once; the deck reopens where it was;
//  (k) the Stage's MAKE SLIDES OF IT on a document answer lands in a new deck;
//  (l) the three worlds (The Scan, Glass, ONE INK), BODY 21: clips nothing, every control 44 pt, nothing sideways, the slide upright at 16:9 in the width.
// The benchmark (a ten-slide deck from a report, themed, two slides moved, a picture, notes on three, presented, exported and read back) is timed
// and printed, with each step's time.
//   BASE=http://localhost:8825 node tests/slides.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { foreignPptx } from './pptxfixture.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const times = {};

const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
async function open({ viewport = PHONE, look = SCAN } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look }) => {
    if (!localStorage.getItem('spec.slides.seeded')) {
      localStorage.setItem('spec.slides.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    }
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    window.__ghostyHero = true;
    window.__ghostyShow = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const S = (page) => page.evaluate(() => ({ ...window.__ghosty.slides, json: undefined, deck: JSON.parse(window.__ghosty.slides.json || 'null') }));
/** Two taps: the MAKE key, then the card. Returns the page's own reading of the second tap to the screen's page drawn (the click event to the sheet's first node), so the spec's own waiting is not in it. */
const goSlides = async (page) => {
  await page.click('#dock .tabcap button[data-area="make"]');
  await page.waitForSelector('#pg-area-make .hubtile[data-id="slides"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__slT = {};
    document.addEventListener('click', () => (window.__slT.c ??= performance.now()), { capture: true, once: true });
    new MutationObserver((_, o) => {
      if (document.querySelector('#pg-slides .slsheet') && window.__slT.c) {
        window.__slT.s = performance.now();
        o.disconnect();
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
  await page.click('#pg-area-make .hubtile[data-id="slides"]');
  await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
  await page.waitForFunction(() => window.__slT?.s, null, { timeout: 5000 }).catch(() => undefined);
  const ms = await page.evaluate(() => Math.round((window.__slT.s ?? performance.now()) - (window.__slT.c ?? 0)));
  goSlides.lastTap = ms;
  return ms;
};
/** The page at rest: every animation that ends has ended (a page coming in is drawn a little smaller until it lands). */
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
const sh = (page) => page.locator('.slsheet');
const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
const pill = (page, name) => sh(page).locator('.slpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
const card = (page, n) => sh(page).locator('.slcard').nth(n);
const titles = async (page) => (await S(page)).slides.map((s) => s.title);
async function saved(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), click()]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}
const jpeg = (page) => page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 900;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1600, 900);
  grad.addColorStop(0, '#2b6cb0');
  grad.addColorStop(1, '#f6ad55');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#fff';
  g.font = '120px sans-serif';
  g.fillText('terraced street', 300, 480);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
}).then((b) => Buffer.from(b, 'base64'));
/** The entries of a zip the app wrote (stored): name → bytes. */
function unzipStored(b) {
  const o = {};
  let e = b.length - 22;
  while (e > 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let p = b.readUInt32LE(e + 16);
  for (let n = 0; n < b.readUInt16LE(e + 10); n++) {
    const size = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28);
    const el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    o[b.subarray(p + 46, p + 46 + nl).toString()] = b.subarray(start, start + size);
    p += 46 + nl + el + cl;
  }
  return o;
}
const REPORT = `# The state of renting in England

A short look at what has happened to rents, and why.

## Rents are rising
Rents rose in every region last year. London is the most expensive, the North East the cheapest. Many tenants say they have little choice.

## Monthly rent by region
- London: £1,850
- South East: £1,420
- East of England: £1,260
- West Midlands: £990
- North East: £780

## Why it is happening
Fewer homes are being built than are needed. Landlords selling up has cut the supply of homes to rent. Interest rates have pushed up what landlords pay.

## What tenants can do
- Check the deposit is protected within thirty days
- Ask for repairs in writing and keep a copy
- Know that a landlord needs a proper notice to end the tenancy

## What is being proposed
The government has said it will end no-fault evictions. A new ombudsman would hear complaints. Councils would get more power to inspect homes.

## What it means for the next year
Rents are expected to keep rising, though more slowly. The gap between regions is likely to stay.

## Sources
1. Office for National Statistics, private rental prices
2. Department for Levelling Up, English Housing Survey
3. Shelter, the cost of renting
`;
/** The numbers and the words as a deck's slide shows them: the app's own state. */
const words = (s) => [s.title, ...s.body, ...s.body2].filter((x) => x.trim());

const T0 = Date.now();
const { ctx, page } = await open();

// ======================================================================== (a) two taps in
{
  const ms = await goSlides(page);
  times.open = ms;
  check(ms < 1000, `MAKE → PRESENTATIONS in two taps, the page drawn ${ms} ms after the second (the page's own reading; the budget is 1,000 ms)`);
  const st = await S(page);
  check(st.view === 'list' && st.kept === 0, 'the first time it opens on MY SLIDES, nothing kept');
  // (b) the empty state
  check((await sh(page).locator('.slnote').first().textContent()) === 'No slides yet. Start from a report, or start blank.', 'the empty state is one line in his words');
  const labels = await sh(page).locator('.slstart button').allTextContents();
  check(labels.join('|').toLowerCase() === 'start from a report|start blank|open a .pptx', `the empty state’s keys: ${labels.join(' | ')}`);
  await page.screenshot({ path: `${out}/slides-empty.png` });
}

// ======================================================================== (b) a report becomes a deck
{
  const t = Date.now();
  await key(page, 'START FROM A REPORT').click();
  check(await until(page, () => !!document.querySelector('.slreport:not([hidden]) textarea')), 'START FROM A REPORT asks which report');
  const lastKey = await sh(page).locator('.slreport button', { hasText: 'THE LAST ANSWER WITH HEADINGS' }).count();
  check(lastKey === 1 || /no answer with headings/i.test(await sh(page).locator('.slreport .slnote').first().textContent()), `it offers the last answer with headings, or, with none in the chat, says so (${lastKey ? 'offered' : 'none'}); a report can always be pasted`);
  await page.fill('.slreport textarea', REPORT);
  await key(page, 'MAKE SLIDES OF THIS').click();
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.slides.length >= 10), 'MAKE SLIDES OF THIS makes the deck');
  times.report = Date.now() - t;
  const st = await S(page);
  const names = st.slides.map((s) => `${s.layout}:${s.title}`);
  check(names[0] === 'title:The state of renting in England' && names.at(-1) === 'bullets:Sources' && st.slides.length === 10, `ten slides, the title first and the sources last: ${names.join(' | ')}`);
  check(st.slides.some((s) => s.layout === 'chart' && s.media === 'chart'), 'a chart slide where the report has numbers');
  check(JSON.stringify(st.slides.at(-1).body) === JSON.stringify(['Office for National Statistics, private rental prices', 'Department for Levelling Up, English Housing Survey', 'Shelter, the cost of renting']), 'the sources slide holds the three citations');
  check((await sh(page).locator('.slcard').count()) === 10, 'the film shows ten slides');
  check(/^10 slides · /.test(await sh(page).locator('.slmeta').textContent()), 'the line under the name counts the slides');
  check(/10 slides made on this phone from a report/.test(await sh(page).locator('.slstatus').textContent()), 'the status says what was made, and from what');
  const ok = await sh(page).locator('.slcard svg text').count();
  check(ok > 20, `the slides are drawn with real text (${ok} text parts)`);
  await page.screenshot({ path: `${out}/slides-film.png` });
}

// ======================================================================== (e) the theme repaints every slide
{
  await key(page, 'THEME').click();
  await page.locator('.slswatch', { hasText: 'Paper' }).click();
  const st = await S(page);
  check(st.theme === 'paper', 'THEME: Paper');
  const sample = await page.evaluate(() => [...document.querySelectorAll('.slcard')].map((c) => {
    const rects = c.querySelectorAll('svg > rect');
    return [getComputedStyle(rects[0]).fill, rects[1] ? getComputedStyle(rects[1]).fill : ''];
  }));
  check(sample.length === 10 && sample.every((s) => s[0] === 'rgb(243, 239, 230)'), `every slide’s ground is Paper’s (rgb(243, 239, 230)): ${[...new Set(sample.map((s) => s[0]))].join(' ')}`);
  check(sample.slice(1, 4).every((s) => s[1] === 'rgb(53, 92, 107)'), `the accent rule on slides 2 to 4 is Paper’s ink-blue: ${sample.slice(1, 4).map((s) => s[1]).join(' ')}`);
  await page.screenshot({ path: `${out}/slides-paper.png` });
  await page.locator('.slswatch', { hasText: 'Ember' }).click();
  const after = await page.evaluate(() => [...document.querySelectorAll('.slcard')].map((c) => getComputedStyle(c.querySelector('svg > rect:nth-of-type(2)')).fill));
  check(after.slice(1, 4).every((x) => x === 'rgb(255, 122, 61)'), `Ember repaints them again (rgb(255, 122, 61)): ${after.slice(1, 4).join(' ')}`);
  await key(page, 'THEME').click();
}

// ======================================================================== (f) reorder, duplicate, delete and undo
{
  const before = await titles(page);
  await card(page, 2).click();
  check(await until(page, () => window.__ghosty.slides.view === 'slide' && window.__ghosty.slides.at === 2), 'a tap on a slide opens it');
  await pill(page, 'SLIDE');
  await key(page, 'MOVE DOWN').click();
  let now = await titles(page);
  check(now[3] === before[2] && now[2] === before[3], `MOVE DOWN swaps it with the next: ${now.slice(2, 4).join(' | ')}`);
  await key(page, 'MOVE UP').click();
  check(JSON.stringify(await titles(page)) === JSON.stringify(before), 'MOVE UP puts it back');
  await key(page, 'ALL SLIDES').click();
  // press and hold, then drag the second slide down one place; and the film scrolls when the finger holds near its foot
  await card(page, 1).scrollIntoViewIfNeeded();
  const b0 = await card(page, 1).boundingBox();
  const b2 = await card(page, 2).boundingBox();
  const hold = Math.min(b2.y + b2.height * 0.8, 850);
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  check(await sh(page).locator('.slcard.slgrab').count() === 1, 'a press and hold lifts the slide');
  const sc0 = await page.evaluate(() => { let e = document.querySelector('.slcard'); while (e) { const oy = getComputedStyle(e).overflowY; if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e.scrollTop; e = e.parentElement; } return document.scrollingElement.scrollTop; });
  await page.mouse.move(b0.x + b0.width / 2, 880, { steps: 4 });
  await page.waitForTimeout(500);
  const sc1 = await page.evaluate(() => { let e = document.querySelector('.slcard'); while (e) { const oy = getComputedStyle(e).overflowY; if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e.scrollTop; e = e.parentElement; } return document.scrollingElement.scrollTop; });
  check(sc1 > sc0 + 20, `the film scrolls while a slide is held near its foot (${Math.round(sc0)} → ${Math.round(sc1)})`);
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2, { steps: 4 });
  await card(page, 2).scrollIntoViewIfNeeded().catch(() => undefined);
  const nb2 = await card(page, 2).boundingBox();
  await page.mouse.move(nb2.x + nb2.width / 2, nb2.y + nb2.height * 0.8, { steps: 6 });
  await page.mouse.up();
  now = await titles(page);
  check(now[2] === before[1] && now[1] === before[2], `dragged down one place: ${now.slice(0, 4).join(' | ')}`);
  void hold;
  check(await key(page, 'UNDO').isVisible(), 'UNDO is there');
  await key(page, 'UNDO').click();
  check(JSON.stringify(await titles(page)) === JSON.stringify(before), 'UNDO puts the drag back');
  // a quick tap does not drag
  await card(page, 3).click();
  check((await S(page)).view === 'slide', 'a quick tap opens the slide; it does not drag it');
  await pill(page, 'SLIDE');
  await key(page, 'DUPLICATE').click();
  let st = await S(page);
  check(st.slides.length === 11 && st.slides[3].title === st.slides[4].title && st.at === 4, 'DUPLICATE puts a copy right after, and shows it');
  check(new Set(st.deck.slides.map((s) => s.id)).size === 11, 'the copy has an id of its own');
  await pill(page, 'SLIDE');
  await key(page, 'DELETE').click();
  st = await S(page);
  check(st.slides.length === 10, 'DELETE takes it away');
  check(/Slide 5 deleted\./.test(await sh(page).locator('.slstatus').textContent()) && await sh(page).locator('.slstatus button', { hasText: 'UNDO' }).count() === 1, 'and says so, with an UNDO in the line');
  await sh(page).locator('.slstatus button', { hasText: 'UNDO' }).click();
  st = await S(page);
  check(st.slides.length === 11, 'UNDO brings the slide back');
  await pill(page, 'SLIDE');
  await key(page, 'DELETE').click();
  check((await S(page)).slides.length === 10, 'deleted again, as the benchmark wants ten');
  await key(page, 'ALL SLIDES').click();
}

// ======================================================================== (c) the words, in the line above the slide
{
  await card(page, 2).click();
  await pill(page, 'WORDS');
  const titleLine = sh(page).locator('.slwords .slline').first();
  await titleLine.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Rents keep rising');
  await page.waitForTimeout(500);
  let st = await S(page);
  check(st.slides[2].title === 'Rents keep rising', `the title typed in the line above: ${st.slides[2].title}`);
  check((await sh(page).locator('.slbox svg').textContent()).includes('Rents keep rising'), 'the slide shows it as it is typed');
  check(await sh(page).locator('.slbox [contenteditable]').count() === 0, 'there is never a caret on the slide itself');
  await sh(page).locator('.slwords button', { hasText: /^TEXT$/ }).click();
  const lines = sh(page).locator('.slwords .slline');
  check(await lines.count() === 3, 'each bullet is a line of its own');
  await lines.nth(2).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A fourth point');
  await page.waitForTimeout(500);
  st = await S(page);
  check(st.slides[2].body.length === 4 && st.slides[2].body[3] === 'A fourth point', `Enter adds a bullet: ${JSON.stringify(st.slides[2].body)}`);
  check(st.deck.slides[2].body.every((b) => b.t === 'ul'), 'it is a bullet like the rest');
  // bold on a selection
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.slwords .slline')].find((e) => e.textContent.includes('most expensive'));
    el.focus();
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const n = w.nextNode();
    const i = n.textContent.indexOf('London');
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + 6);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  await page.waitForTimeout(150);
  await sh(page).locator('.slmarks button[aria-label="Bold"]').click();
  await page.waitForTimeout(500);
  st = await S(page);
  const runs = st.deck.slides[2].body[1].runs;
  check(runs.some((r) => r.b && r.text === 'London') && runs.some((r) => !r.b && /most expensive/.test(r.text)), `BOLD on the chosen word only: ${JSON.stringify(runs)}`);
  check(await sh(page).locator('.slbox svg tspan[font-weight="700"]').filter({ hasText: 'London' }).count() >= 1, 'and the slide shows it bold');
  // the layout, from the sheet of nine
  await pill(page, 'LAYOUT');
  check(await sh(page).locator('.sllayout').count() === 9, 'a sheet of nine layouts');
  await sh(page).locator('.sllayout', { hasText: 'Two columns' }).click();
  st = await S(page);
  check(st.slides[2].layout === 'two' && st.slides[2].body.length === 4, 'the layout changes and no word is lost');
  await pill(page, 'WORDS');
  await sh(page).locator('.slwords button', { hasText: /^RIGHT COLUMN$/ }).click();
  await sh(page).locator('.slwords .slline').first().click();
  await page.keyboard.type('Right side words');
  await page.waitForTimeout(500);
  check((await S(page)).slides[2].body2.join('') === 'Right side words', 'a second column takes its own words');
  await pill(page, 'LAYOUT');
  await sh(page).locator('.sllayout', { hasText: 'Bullets' }).click();
  st = await S(page);
  check(st.slides[2].layout === 'bullets' && st.slides[2].body.length === 5 && st.slides[2].body2.length === 0, 'back to bullets folds the right column in under the text');
  await page.screenshot({ path: `${out}/slides-words.png` });
}

// ======================================================================== (d) insert a picture, a chart, a table, a shape
{
  // a picture on a slide of its own
  await key(page, 'ALL SLIDES').click();
  await key(page, 'NEW SLIDE').click();
  await sh(page).locator('.sllayout', { hasText: 'Picture' }).click();
  check((await S(page)).slides.length === 11 && (await S(page)).slides[(await S(page)).at].layout === 'picture', 'NEW SLIDE adds a picture slide and opens it');
  await pill(page, 'INSERT');
  await key(page, 'PICTURE').click();
  const photo = await jpeg(page);
  const t = Date.now();
  await page.setInputFiles('.slsheet input[type=file][accept="image/*"]', { name: 'street.jpg', mimeType: 'image/jpeg', buffer: photo });
  check(await until(page, () => window.__ghosty.slides.slides.some((s) => s.media === 'img')), 'a photo goes on the slide');
  times.picture = Date.now() - t;
  const hasImg = await until(page, () => !!document.querySelector('.slbox svg image[href^="data:image/jpeg"]'));
  check(hasImg, `and is drawn there (${times.picture} ms)`);
  const iw = await page.evaluate(() => { const m = JSON.parse(window.__ghosty.slides.json).slides.find((s) => s.media?.k === 'img').media; return [m.iw, m.ih]; });
  check(iw[0] === 1280 && iw[1] === 720, `shrunk to 1,280 × 720: ${iw.join(' × ')}`);
  await sh(page).locator('.slsub input[aria-label="What the picture shows"]').fill('A terraced street');
  await sh(page).locator('.slsub input[aria-label="What the picture shows"]').blur();
  check(await page.evaluate(() => JSON.parse(window.__ghosty.slides.json).slides.find((s) => s.media?.k === 'img').media.alt) === 'A terraced street', 'the picture’s description is kept');
  await pill(page, 'WORDS');
  await sh(page).locator('.slwords .slline').first().click();
  await page.keyboard.type('A street of rented homes');
  await page.waitForTimeout(500);
  // a chart from a typed table
  await key(page, 'ALL SLIDES').click();
  await key(page, 'NEW SLIDE').click();
  await sh(page).locator('.sllayout', { hasText: 'Chart' }).click();
  await pill(page, 'INSERT');
  await key(page, 'CHART').click();
  await key(page, 'DRAW THE CHART').click();
  check(/at least two numbers/.test(await sh(page).locator('.slstatus').textContent()), 'a chart with no numbers is told in words');
  const rows = [['Jan', '120'], ['Feb', '95'], ['Mar', '143']];
  for (let i = 0; i < 3; i++) {
    await sh(page).locator(`input[aria-label="Label ${i + 1}"]`).fill(rows[i][0]);
    await sh(page).locator(`input[aria-label="Number ${i + 1}"]`).fill(rows[i][1]);
  }
  await sh(page).locator('.slsub input[placeholder^="A unit"]').fill('£');
  await key(page, 'DRAW THE CHART').click();
  let st = await S(page);
  const ch = st.deck.slides[st.at].media.chart;
  check(JSON.stringify(ch.points) === JSON.stringify([{ label: 'Jan', value: 120 }, { label: 'Feb', value: 95 }, { label: 'Mar', value: 143 }]) && ch.unit === '£' && ch.before, `a chart from the typed table: ${JSON.stringify(ch)}`);
  check(await sh(page).locator('.slbox svg rect[fill]').count() >= 6 && (await sh(page).locator('.slbox svg').textContent()).includes('£143'), 'the bars are drawn with their figures');
  // the Stage's last chart is offered when there is one (none yet in this session)
  await key(page, 'USE THE STAGE’S LAST CHART').click();
  check(await until(page, () => /no chart on the Stage yet/i.test(document.querySelector('.slstatus')?.textContent ?? '')), 'with no chart on the Stage it says so');
  // a table
  await key(page, 'ALL SLIDES').click();
  await key(page, 'NEW SLIDE').click();
  await sh(page).locator('.sllayout', { hasText: 'Table' }).click();
  await pill(page, 'INSERT');
  await key(page, 'TABLE').click();
  await key(page, 'ADD A TABLE').click();
  check(await sh(page).locator('.sltable input').count() === 9, 'a table of three by three');
  await sh(page).locator('.sltable input[aria-label="Row 1, column 1"]').fill('Scheme');
  await sh(page).locator('.sltable input[aria-label="Row 1, column 2"]').fill('Days');
  await sh(page).locator('.sltable input[aria-label="Row 2, column 1"]').fill('Any');
  await sh(page).locator('.sltable input[aria-label="Row 2, column 2"]').fill('30');
  await sh(page).locator('.sltable input[aria-label="Row 2, column 2"]').blur();
  await key(page, 'ADD A ROW').click();
  st = await S(page);
  const tb = st.deck.slides[st.at].media.table;
  check(tb.rows.length === 4 && tb.rows[1][1][0].text === '30' && tb.head, 'the typed cells are kept, a row added, the first row a header');
  check((await sh(page).locator('.slbox svg').textContent()).includes('Scheme'), 'the table is drawn on the slide');
  // a shape or two
  await pill(page, 'INSERT');
  await key(page, 'SHAPE').click();
  await key(page, 'ELLIPSE').click();
  await key(page, 'ARROW').click();
  check((await S(page)).slides[(await S(page)).at].shapes === 2 && await sh(page).locator('.slbox svg ellipse, .slbox svg polygon').count() === 2, 'an ellipse and an arrow are on the slide');
  await key(page, 'RECTANGLE').click();
  check(/two shapes at most/i.test(await sh(page).locator('.slstatus').textContent()) && (await S(page)).slides[(await S(page)).at].shapes === 2, 'a third is refused in words');
  const x0 = await page.evaluate(() => JSON.parse(window.__ghosty.slides.json).slides.flatMap((s) => s.shapes)[0].x);
  await sh(page).locator('.slshape').first().locator('button', { hasText: /^RIGHT$/ }).click();
  const x1 = await page.evaluate(() => JSON.parse(window.__ghosty.slides.json).slides.flatMap((s) => s.shapes)[0].x);
  check(x1 === x0 + 40, `a shape moves by its keys (${x0} → ${x1})`);
  await sh(page).locator('.slshape').first().locator('button', { hasText: /^NEXT COLOUR$/ }).click();
  check(await page.evaluate(() => JSON.parse(window.__ghosty.slides.json).slides.flatMap((s) => s.shapes)[0].fill) === 1, 'and takes the next colour of the theme’s sequence');
  await page.screenshot({ path: `${out}/slides-insert.png` });
  await key(page, 'ALL SLIDES').click();
  // move the picture slide up to where the benchmark has it
  const all = await titles(page);
  check(all.length === 13, `thirteen slides now: ${all.length}`);
}

// ======================================================================== (g) notes, then the talk
{
  const notes = { 1: 'Open with the rent figure, then pause.', 4: 'Keep this under two minutes.', 6: 'Ask the room who has rented.' };
  for (const [i, text] of Object.entries(notes)) {
    await card(page, Number(i)).click();
    await pill(page, 'NOTES');
    await sh(page).locator('textarea.slnotes').fill(text);
    await sh(page).locator('textarea.slnotes').blur();
    await page.waitForTimeout(200);
    await key(page, 'ALL SLIDES').click();
  }
  const st = await S(page);
  check(Object.entries(notes).every(([i, t]) => st.slides[i].notes === t), 'notes typed on three slides are kept');
  // a transition and a build on slide 2
  await card(page, 1).click();
  await pill(page, 'SLIDE');
  await key(page, 'FADE').click();
  await sh(page).locator('.slbuild', { hasText: 'The text' }).locator('button', { hasText: /^RISES IN$/ }).click();
  const s2 = (await S(page)).slides[1];
  check(s2.transition === 'fade' && s2.builds === 1, 'a fade between slides and a build on the text');
  await key(page, 'ALL SLIDES').click();
  // PRESENT from the start
  await key(page, 'PRESENT').click();
  check(await until(page, () => window.__ghosty.slides.present.on && window.__ghosty.slides.present.i === 0), 'PRESENT begins at the first slide');
  const tp = Date.now();
  check(await page.locator('.slpresent .slpbox svg').count() === 1 && /The state of renting/.test(await page.locator('.slpbox').textContent()), 'the slide is shown');
  check(/^NEXT: /.test(await page.locator('.slnext').textContent()), `the next slide’s title is shown: ${await page.locator('.slnext').textContent()}`);
  check(await page.locator('.slpnotes').textContent() === 'No notes on this slide.', 'a slide with no notes says so');
  const keysOk = await page.evaluate(() => [...document.querySelectorAll('.slpkeys button, .slptop button')].map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, r.width, r.height]; }));
  check(keysOk.length === 3 && keysOk.every((k) => k[1] >= 43.5 && k[2] >= 43.5), `NEXT, BACK and EXIT are 44 pt: ${JSON.stringify(keysOk)}`);
  await key(page, 'NEXT').click().catch(() => undefined);
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  let pr = (await S(page)).present;
  check(pr.i === 1 && pr.step === 0 && pr.notes === notes[1], 'NEXT goes to slide 2 and shows its notes');
  check(await page.locator('.slpnotes').textContent() === notes[1], 'the notes are in his hand');
  check(await page.locator('.slpbox.sltr-fade').count() === 1 && pr.transition === 'fade', 'the fade is on the transition');
  check(await page.locator('.slpbox [data-b="1"].slhid').count() === 1, 'the part that builds in is not there yet');
  await page.locator('.slpbox').click();
  pr = (await S(page)).present;
  check(pr.i === 1 && pr.step === 1 && await page.locator('.slpbox [data-b="1"].slhid').count() === 0 && await page.locator('.slpbox [data-b="1"].slin-rise').count() === 1, 'a tap on the slide brings the build in (it rises), and stays on the slide');
  await page.locator('.slpbox').click();
  check((await S(page)).present.i === 2, 'the next tap goes to the next slide');
  await page.locator('.slpkeys button', { hasText: /^BACK$/ }).click();
  pr = (await S(page)).present;
  check(pr.i === 1 && pr.step === 1, 'BACK returns to the slide with its build in');
  await page.keyboard.press('ArrowRight');
  check((await S(page)).present.i === 2, 'the right arrow goes on');
  await page.keyboard.press('ArrowLeft');
  check((await S(page)).present.i === 1, 'the left arrow goes back');
  // two fingers together and lifted: back
  await page.evaluate(() => {
    const el = document.querySelector('.slpbox');
    const mk = (id, x) => new Touch({ identifier: id, target: el, clientX: x, clientY: 200 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(1, 100), mk(2, 160)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  });
  pr = (await S(page)).present;
  check(pr.i === 1 && pr.step === 0, `a two-finger tap goes back (a step): slide ${pr.i + 1}, step ${pr.step}`);
  // reduced motion stills the transition
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  check(await page.locator('.slpbox[class*="sltr-"]').count() === 0 && (await S(page)).present.transition === '', 'with reduced motion there is no transition class');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check(await page.locator('.sltime').textContent() !== undefined, 'the time elapsed is shown');
  await page.waitForTimeout(1100);
  check((await S(page)).present.elapsed >= 1 && /^\d\d:\d\d$/.test(await page.locator('.sltime').textContent()), 'and counts');
  await page.screenshot({ path: `${out}/slides-present.png` });
  times.present = Date.now() - tp;
  await page.locator('.slptop button', { hasText: 'EXIT' }).click();
  check(await page.locator('.slpresent').count() === 0 && (await S(page)).present.on === false && (await S(page)).view === 'slide', 'EXIT leaves the talk on the slide he stopped at');
  await key(page, 'ALL SLIDES').click();
}

// ======================================================================== (h) export
let pptxBytes;
{
  await key(page, 'EXPORT').click();
  const t = Date.now();
  await key(page, 'POWERPOINT \\(\\.PPTX\\)').click();
  check(await until(page, () => /\.pptx/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? '')), 'EXPORT makes the PowerPoint file');
  times.pptx = Date.now() - t;
  const said = await sh(page).locator('.slouts .cvoutt small').textContent();
  check(/^\d+(\.\d)? (KB|MB)/.test(said), `the size is said before it is saved: ${said}`);
  const f = await saved(page, () => sh(page).locator('.slouts button', { hasText: 'SAVE' }).click());
  pptxBytes = f.bytes;
  check(f.name === 'The state of renting in England.pptx' && f.bytes.length > 20000 && f.bytes[0] === 0x50 && f.bytes[1] === 0x4b, `saved as ${f.name} (${f.bytes.length} bytes)`);
  const z = unzipStored(f.bytes);
  const names = Object.keys(z);
  check(names[0] === '[Content_Types].xml' && names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length === 13, `the package holds 13 slides and its content types first`);
  // every XML part parsed by the browser's own parser, not ours
  const parsed = await page.evaluate((parts) => parts.map(([n, x]) => { const d = new DOMParser().parseFromString(x, 'application/xml'); return [n, d.getElementsByTagName('parsererror').length === 0]; }), names.filter((n) => /\.(xml|rels)$/.test(n)).map((n) => [n, z[n].toString('utf8')]));
  check(parsed.length > 30 && parsed.every((p) => p[1]), `all ${parsed.length} XML parts are well formed in the browser's parser${parsed.filter((p) => !p[1]).map((p) => ` (${p[0]})`).join('')}`);
  check(names.includes('ppt/media/image1.jpeg') && names.some((n) => /notesSlide\d/.test(n)), 'the picture is in the media and the notes are in notes slides');
  check(z['ppt/theme/theme1.xml'].toString().toUpperCase().includes('FF7A3D'), 'the theme carries the deck’s accent');
  // it is read back by the app's own reader (IMPORT), equal in words, notes and order
  const original = await S(page);
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'The state of renting in England.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: f.bytes });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.slides.length === 13 && window.__ghosty.slides.kept === 2), 'IMPORT opens it as a deck of its own');
  const back = await S(page);
  const sameWords = original.slides.every((s, i) => JSON.stringify(words(s)) === JSON.stringify(words(back.slides[i])));
  const sameNotes = original.slides.every((s, i) => s.notes === back.slides[i].notes);
  const sameOrder = JSON.stringify(original.slides.map((s) => s.title)) === JSON.stringify(back.slides.map((s) => s.title));
  const sameLayout = original.slides.every((s, i) => s.layout === back.slides[i].layout && s.media === back.slides[i].media);
  check(sameWords && sameNotes && sameOrder && sameLayout, `read back by the app's own reader: every slide's words (${sameWords}), the notes (${sameNotes}), the order (${sameOrder}), the layouts and media (${sameLayout})`);
  check(back.lost.length === 0 && !/couldn’t keep/.test(await sh(page).locator('.slstatus').textContent()), 'and nothing is said to be lost from our own file');
  // back to the original deck for the rest
  await key(page, 'MY SLIDES').click();
  await sh(page).locator('.slopen', { hasText: 'The state of renting in England' }).nth(1).click().catch(() => undefined);
  await until(page, () => window.__ghosty.slides.view === 'deck');
  // PDF, one slide a page
  const original2 = await S(page);
  if (original2.slides.length !== 13) await sh(page).locator('.slopen').first().click();
  await key(page, 'EXPORT').click();
  const tpdf = Date.now();
  await key(page, 'PDF').click();
  check(await until(page, () => /\.pdf/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? ''), null, 120000), 'EXPORT makes the PDF');
  times.pdf = Date.now() - tpdf;
  const pdf = await saved(page, () => sh(page).locator('.slouts button', { hasText: 'SAVE' }).click());
  const pages = (pdf.bytes.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.bytes.toString('latin1'));
  check(pdf.bytes.subarray(0, 5).toString() === '%PDF-' && pages === 13, `the PDF is one slide a page: ${pages} pages, ${pdf.bytes.length} bytes`);
  check(box && Number(box[1]) === 960 && Number(box[2]) === 540, `landscape, 960 × 540 points: ${box?.slice(1, 3).join(' × ')}`);
  // with the notes pages after the slides
  await sh(page).locator('.slexport button[aria-pressed]').first().click();
  check(/ON$/.test(await sh(page).locator('.slexport button[aria-pressed]').first().textContent()), 'NOTES PAGES AFTER THE SLIDES turns on');
  await key(page, 'PDF').click();
  check(await until(page, () => /with the notes pages/.test(document.querySelector('.slouts .cvoutt small')?.textContent ?? ''), null, 120000), 'the PDF with notes pages is made');
  const pdf2 = await saved(page, () => sh(page).locator('.slouts button', { hasText: 'SAVE' }).click());
  const pages2 = (pdf2.bytes.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  const withNotes = (await S(page)).slides.filter((s) => s.notes.trim()).length;
  check(pages2 === 13 + withNotes && withNotes >= 3, `a page of notes follows the thirteen slides for each slide that has notes (${withNotes}): ${pages2} pages`);
  // one slide as a PNG
  await key(page, 'THIS SLIDE AS A PICTURE \\(\\.PNG\\)').click();
  check(await until(page, () => /\.png/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? ''), null, 30000), 'one slide as a picture is made');
  const png = await saved(page, () => sh(page).locator('.slouts button', { hasText: 'SAVE' }).click());
  check(png.bytes.subarray(1, 4).toString() === 'PNG' && png.bytes.readUInt32BE(16) === 1920 && png.bytes.readUInt32BE(20) === 1080, `a 1,920 × 1,080 PNG (${png.bytes.length} bytes)`);
  await page.screenshot({ path: `${out}/slides-export.png` });
}

// ======================================================================== (i) import a hand-built .pptx, an old one and a damaged one
{
  await key(page, 'MY SLIDES').click();
  const mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'quarterly_review.pptx', mimeType: mime, buffer: Buffer.from(foreignPptx()) });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.title === 'Quarterly review deck'), 'the hand-built .pptx opens');
  const st = await S(page);
  check(st.slides.length === 2 && st.slides[0].title === 'Quarterly review' && st.slides[0].notes === 'Welcome everyone' && JSON.stringify(st.slides[1].body) === JSON.stringify(['First point', 'Second point, a link']), 'its text and its notes are kept');
  check(st.slides[0].media === 'img' && st.slides[1].media === 'table', 'its picture and its table are kept');
  const said = await sh(page).locator('.slstatus').textContent();
  check(/I couldn’t keep:/.test(said) && /video/.test(said) && /chart/.test(said) && /animations/.test(said) && /transition/.test(said), `what it could not keep is said once: ${said}`);
  check(!/Error|undefined|\[object|at \w+\.\w+/.test(said), 'in plain words, no raw error');
  await page.screenshot({ path: `${out}/slides-import.png` });
  await key(page, 'MY SLIDES').click();
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'old.ppt', mimeType: 'application/vnd.ms-powerpoint', buffer: Buffer.from('not a deck') });
  check(/old PowerPoint file \(\.ppt\)/.test(await sh(page).locator('.slstatus').textContent()), 'an old .ppt is told what to do');
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'broken.pptx', mimeType: mime, buffer: Buffer.from('PK\u0003\u0004 this is not a zip at all') });
  check(await until(page, () => /could not open that file/.test(document.querySelector('.slstatus')?.textContent ?? '')), 'a damaged file is told in words');
  check(!/Error|undefined|\[object/.test(await sh(page).locator('.slstatus').textContent()), 'with no raw error text');
}

// ======================================================================== (j) autosave said once, and the deck reopens where it was
{
  if ((await S(page)).view !== 'list') await key(page, 'MY SLIDES').click();
  const kept = (await S(page)).kept;
  await key(page, 'START BLANK').click();
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.kept > 0), 'START BLANK makes a blank deck');
  check((await sh(page).locator('.slflash').textContent()) === 'SAVED' && (await S(page)).savedSaid >= 1, 'it says it is saved');
  const said0 = (await S(page)).savedSaid;
  await card(page, 1).click();
  await pill(page, 'WORDS');
  await sh(page).locator('.slwords .slline').first().click();
  await page.keyboard.type('Where I was');
  await page.waitForTimeout(600);
  const st = await S(page);
  check(st.savedSaid === said0 && st.kept === kept + 1, `after more changes the “saved” was not said again (${st.savedSaid})`);
  check(/^KEPT ON THIS PHONE · \d\d:\d\d:\d\d$/.test(await sh(page).locator('.slsaved').textContent()), `the line under the name stays true: ${await sh(page).locator('.slsaved').textContent()}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
  await goSlides(page);
  check(await until(page, () => window.__ghosty.slides.view === 'slide' && /Where I was/.test(window.__ghosty.slides.slides[window.__ghosty.slides.at]?.title ?? '')), 'after a reload it reopens on the deck and the slide he was on');
  const line = await sh(page).locator('.slline').first().textContent();
  check(line === 'Where I was', `with his words in it: ${line}`);
}

// ======================================================================== "my slides" in the chat, and (k) the Stage
{
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 }).catch(async () => { await page.locator('.logbtn:visible').first().click().catch(() => undefined); });
  for (let i = 0; i < 6 && !(await page.locator('#cin:visible').count()); i++) {
    await page.locator('.logbtn:visible').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(500);
  }
  await page.fill('#cin', 'my slides');
  await page.keyboard.press('Enter');
  check(await until(page, () => !!document.querySelector('.modal .slsheet') && window.__ghosty.slides.view === 'list', null, 20000), '"my slides" in the chat opens MY SLIDES');
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const reply = '# Why the bins are late\n\n## The lorry\nThe lorry broke down twice in October and the council has not replaced it yet.\n\n## The rota\nCrews were cut from five to four, so each round takes longer than it did.\n\n## What you can do\nReport a missed bin online and keep the reference; ask the ward councillor.';
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text: reply }, { t: 'done', model: 'Mock · scripted' }])).toString('base64'))}` }));
  await page.fill('#cin', 'write me a short report on why the bins are late');
  await page.keyboard.press('Enter');
  check(await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'document', null, 20000), 'the Stage shows the report answer');
  check(await page.locator('#thestage button[aria-label^="Make slides of"]').count() === 1 && /MAKE SLIDES OF IT/i.test(await page.locator('#thestage .stgkeys').textContent()), 'it offers MAKE SLIDES OF IT beside OPEN');
  await page.click('#thestage button[aria-label^="Make slides of"]');
  check(await until(page, () => !!document.querySelector('.modal .slsheet') && window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.slides.length >= 4, null, 15000), 'it lands in a new deck');
  const st = await S(page);
  check(st.title === 'Why the bins are late' && JSON.stringify(st.slides.map((s) => s.title)) === JSON.stringify(['Why the bins are late', 'The lorry', 'The rota', 'What you can do']), `a slide for each heading: ${st.slides.map((s) => s.title).join(' | ')}`);
  await page.screenshot({ path: `${out}/slides-stage.png` });
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
}
await ctx.close();
times.total = Date.now() - T0;

// ======================================================================== (l) the phone: both widths, BODY 21
const measure = async (pg, where) => {
  await settle(pg);
  await pg.waitForTimeout(120);
  return pg.evaluate((w) => {
  const bad = [];
  for (const b of document.querySelectorAll(`${w} :is(button, select, input:not([type=hidden]):not([type=file]), textarea):not([hidden])`)) {
    if (!b.getClientRects().length) continue;
    const r = b.getBoundingClientRect();
    if (r.width && (r.height < 43.5 || (b.tagName === 'BUTTON' && r.width < 43.5))) bad.push(`${b.tagName} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const side = document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1;
  const names = [...document.querySelectorAll(`${w} :is(button, input, select, textarea):not([type=hidden])`)].filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim())).map((e) => e.outerHTML.slice(0, 60));
  const cut = [...document.querySelectorAll(`${w} button`)].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (b.scrollWidth > b.clientWidth + 1 || r.right > innerWidth + 0.5 || r.left < -0.5); }).map((b) => `"${(b.textContent || '').trim().slice(0, 24)}" ${b.scrollWidth}/${b.clientWidth}`);
  const svg = document.querySelector(`${w} .slbox svg, ${w} .slthumb svg`);
  const r = svg?.getBoundingClientRect();
  return { bad, side, names, cut, ratio: r ? r.width / r.height : 0, inside: r ? r.left >= -0.5 && r.right <= innerWidth + 0.5 : true };
  }, where);
};
for (const [name, viewport, body21, look] of [['440', PHONE, false, SCAN], ['390', { width: 390, height: 844 }, false, SCAN], ['440-glass', PHONE, false, GLASS], ['440-ink', PHONE, false, INK], ['440-body21', PHONE, true, SCAN], ['390-body21', { width: 390, height: 844 }, true, SCAN]]) {
  const { ctx: c2, page: p2 } = await open({ viewport, look });
  await goSlides(p2);
  if (body21) await p2.evaluate(() => (document.documentElement.dataset.body = '21'));
  await key(p2, 'START FROM A REPORT').click();
  await p2.fill('.slreport textarea', REPORT);
  await key(p2, 'MAKE SLIDES OF THIS').click();
  await until(p2, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.slides.length >= 10);
  for (const [where, act] of [['the film', async () => {}], ['the theme sheet', async () => key(p2, 'THEME').click()], ['the export sheet', async () => { await key(p2, 'THEME').click(); await key(p2, 'EXPORT').click(); }], ['a slide and its words', async () => { await key(p2, 'EXPORT').click(); await card(p2, 2).click(); await pill(p2, 'WORDS'); }], ['the layouts', async () => pill(p2, 'LAYOUT')], ['insert, chart', async () => { await pill(p2, 'INSERT'); await key(p2, 'CHART').click(); }], ['insert, shape', async () => { await key(p2, 'SHAPE').click(); await key(p2, 'ELLIPSE').click(); }], ['the slide keys', async () => pill(p2, 'SLIDE')], ['the notes', async () => pill(p2, 'NOTES')]]) {
    await act();
    await p2.waitForTimeout(200);
    const r = await measure(p2, '#pg-slides .slsheet');
    check(!r.bad.length && !r.side && !r.names.length && !r.cut.length, `${name} ${where}: every key 44 pt, nothing sideways, nothing cut, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ': ' + r.names.join(' | ') : ''}${r.cut.length ? ': ' + r.cut.slice(0, 3).join(' | ') : ''}`);
    if (r.ratio) check(Math.abs(r.ratio - 16 / 9) < 0.02 && r.inside, `${name} ${where}: the slide is upright at 16:9 inside the width (${r.ratio.toFixed(3)})`);
  }
  await p2.screenshot({ path: `${out}/slides-${name}.png` });
  // the talk at this width
  await key(p2, 'ALL SLIDES').click();
  await key(p2, 'PRESENT').click();
  await until(p2, () => window.__ghosty.slides.present.on);
  const pm = await p2.evaluate(() => {
    const box = document.querySelector('.slpbox')?.getBoundingClientRect();
    const keys = [...document.querySelectorAll('.slpresent button')].map((b) => b.getBoundingClientRect());
    return { ratio: box ? box.width / box.height : 0, within: box ? box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight : false, keys: keys.every((k) => k.width >= 43.5 && k.height >= 43.5 && k.bottom <= innerHeight + 0.5), side: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  check(Math.abs(pm.ratio - 16 / 9) < 0.02 && pm.within && pm.keys && !pm.side, `${name} the talk: the slide 16:9 in the width, the keys 44 pt and on the screen`);
  await c2.close();
}
console.log(`times (ms): open ${times.open}, a report made into ten slides ${times.report}, a photo put on a slide ${times.picture}, the talk walked ${times.present}, the .pptx made ${times.pptx}, the PDF of thirteen made ${times.pdf}; the whole spec's first world ${times.total}`);
const bench = (times.report ?? 0) + (times.picture ?? 0) + (times.pptx ?? 0);
console.log(`benchmark (a report made into a deck of ten and more, themed, slides moved, a picture, notes on three, presented, exported, read back, by the spec): report ${times.report} ms + picture ${times.picture} ms + .pptx ${times.pptx} ms = ${bench} ms of the app's own work; ${times.total} ms with the spec's typing and waiting`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'PRESENTATIONS ran clean: MY SLIDES, a report made into a deck, the theme repainting every slide, reorder by key and by drag, duplicate, delete and undo, the words in the line above a slide, layouts, a picture, a chart, a table and shapes, notes, the talk (builds, transitions, arrows, two fingers, reduced motion), .pptx and PDF and PNG out, a hand-built .pptx in with what it could not keep said, autosave said once and reopened where it was, MAKE SLIDES OF IT from the Stage, the three worlds, both widths and BODY 21.');
process.exit(problems.length ? 1 : 0);
