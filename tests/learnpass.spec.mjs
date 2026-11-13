// QUALITY PASS: LEARN (BRIEF-QUALITY-LEARN): COURSES, the Arcade, the GYM, SCHOOL, the Library (the shelf and the reader), LEARNING and the Coach
// measured and made right, nothing new added. One check for each fix, named for the rough spot it closes, grouped COURSES (C) · THE ARCADE (A) ·
// THE GYM (G) · SCHOOL (S) · THE LIBRARY (L) · LEARNING (LG) · THE COACH (CO), at 440 × 956 and 390 × 844, in THE SCAN, against the preview's real
// brain, with the things a state needs (an empty record, a brain out of reach, a refused microphone, a download refused) stood in by routes. The
// pure words (every line the seven screens say) are read from the very source files the page is built from.
// Stills (440 only), before and after a fix pass: LEARN_STILL=before|after names them tests/.shots/learnpass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8840 NO_GL_SHOTS=1 node tests/learnpass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.LEARN_STILL ?? 'after';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 300)}`);
  }
};
const on = (k) => !process.env.LP_ONLY || process.env.LP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|NotAllowed|getUserMedia|Permission denied|SyntaxError|ReferenceError|\bworker\b/i;
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
const nocomments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const live = [];
/** A section that may not run to its end (the old code lacks what it reaches for) says so as one red line instead of ending the spec. */
async function section(name, fn) {
  if (!on(name)) return;
  try {
    await fn();
  } catch (e) {
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 220)}`);
    for (const c of live.splice(0)) await c.close().catch(() => undefined);
  }
}

// ================================================================ the words, read from the source (once)
let LN, AR, GY, SC, LB, LG, CO;
try {
  LN = await pure('apps/web/src/features/learn/words.ts');
  AR = await pure('apps/web/src/features/arcade/words.ts');
  GY = await pure('apps/web/src/features/gym/words.ts');
  SC = await pure('apps/web/src/features/school/words.ts');
  LB = await pure('apps/web/src/features/library/words.ts');
  LG = await pure('apps/web/src/features/learning/words.ts');
  CO = await pure('apps/web/src/features/coach/words.ts');
} catch (e) {
  console.log(`  the words files could not be read: ${String(e?.message ?? e).split('\n')[0]}`);
  problems.push(`[words] the words files are not all there: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
}
const oneSentence = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean).length === 1;
await section('words', async () => {
  log('pure words');
  // C1 · planning said once, as a wait; an empty topic said beside the box
  check(LN.PLANNING === 'Planning your course…' && words(LN.TOPIC_EMPTY) <= 20 && words(LN.INTRO) <= 14, `[C1 planning] reads "${LN.PLANNING}" / "${LN.TOPIC_EMPTY}"`);
  const li = nocomments(src('features/learn/index.ts'));
  check(li.includes('said(np.body, PLANNING)') && !/startBtn\.textContent = 'PLANNING…'/.test(li) && !/toast\('Type what you want to learn'/.test(li), '[C1 planning] COURSES is not drawn from the words');
  // C2 · the brain out of reach mid-lesson: what still works
  const lo = LN.lessonOut(3);
  check(/without my brain/.test(lo.head) && /still work/.test(lo.line) && /3 flashcards/.test(lo.line) && !/lost the signal/.test(lo.head + lo.line) && !/flashcard/.test(LN.lessonOut(0).line), `[C2 lesson out] reads "${lo.head} ${lo.line}"`);
  check(li.includes('lessonOut(L.dueCards().length)') && li.includes('OFFLINE_KEYS.back'), '[C2 lesson out] COURSES does not say what still works');
  // C3 · a wrong answer said kindly with the right one
  check(LN.wrongAnswer('B', 'Oxygen', 'Splitting water releases it.') === 'Not quite. The answer is B) Oxygen. Splitting water releases it.' && /^I can’t mark that without my brain, so it isn’t counted\. The answer: 4\.$/.test(LN.cantMark('4')), `[C3 wrong answer] reads "${LN.wrongAnswer('B', 'Oxygen', '')}"`);
  check(li.includes('wrongAnswer(') && li.includes('cantMark(') && !/Not quite: \$\{/.test(li) && !/Can't mark it offline/.test(li), '[C3 wrong answer] COURSES is not drawn from the words');
  // A1 · mobile data; A2 · mid-way and failed; A3 · a game that will not start
  check(AR.mobileData('24 MB') === 'You’re on mobile data, so I’ll wait for Wi-Fi, then fetch 24 MB.' && AR.fetchStart('24 MB') === 'Fetching 24 MB from the Internet Archive…', `[A1 mobile data] reads "${AR.mobileData('24 MB')}"`);
  check(AR.fetchMid('12 MB', '24 MB', 50) === 'Fetching 12 MB of 24 MB (50%)…' && /RETRY/.test(AR.fetchFailed('I lost the signal halfway. Try again when you have one.')) && AR.retryKey('2.5 MB') === 'RETRY · 2.5 MB', `[A2 fetch] reads "${AR.fetchMid('12 MB', '24 MB', 50)}" / "${AR.fetchFailed('x')}"`);
  check(/^I couldn’t start DOOM\. Tap PLAY to try again/.test(AR.startFailed('DOOM')) && words(AR.startFailed('DOOM')) <= 24 && !/started its engine|engine/i.test(AR.startFailed('DOOM')), `[A3 will not start] reads "${AR.startFailed('DOOM')}"`);
  const ai = nocomments(src('features/arcade/index.ts'));
  check(ai.includes('mobileData(sizeWords(data.bytes))') && ai.includes('fetchMid(') && ai.includes('fetchFailed(sayError(') && ai.includes('startFailed(') && !/it waits for Wi-Fi before fetching/.test(ai) && !/status\.set\(r\.card, sayError/.test(ai), '[A1 A2 A3] the Arcade is not drawn from the words');
  // G1 · TRAIN's wait; G2 · no raw worker text; G3 · the rating with its word; G4 · a game said as that, with PLAY AGAIN
  check(/^Starting to train/.test(GY.TRAIN_WAIT) && !/worker/i.test(GY.TRAIN_STOPPED + GY.TRAIN_FAILED + GY.TRAIN_CANNOT + GY.MOVE_FAILED) && /TRAIN/.test(GY.TRAIN_FAILED), `[G1 G2 train] reads "${GY.TRAIN_WAIT}" / "${GY.TRAIN_STOPPED}"`);
  const gi = nocomments(src('features/gym/index.ts'));
  check(gi.includes('waitFor(gameP.body, TRAIN_WAIT)') && !/Training stopped: \$\{m\.message\}/.test(gi) && !/couldn’t move: \$\{m\.error\}/.test(gi) && !/The training worker stopped/.test(gi) && gi.includes("trail(raw, 'gym move')"), '[G1 G2] the GYM is not drawn from the words');
  check(GY.sideWords(1350) === 'about 1,350 (club level)' && GY.chessLine(1350, 1850, 70) === 'You: about 1,350 (club level) · Me: about 1,850 (strong club level) · give or take 70' && GY.strengthWord(1100) === 'a casual player' && GY.chessLine(null, null, 0) === 'Not rated yet' && GY.strengthWord(900) === 'a beginner', `[G3 rating] reads "${GY.chessLine(1350, 1850, 70)}"`);
  check(GY.overWords('You win.') === 'You beat me.' && GY.overWords('I win.') === 'I won this one.' && GY.overWords('A draw.') === 'A draw.' && GY.overWords('Game over: White by 4 (area, komi 7.5). I win.') === 'Game over: White by 4 (area, komi 7.5). I won this one.' && GY.AGAIN === 'PLAY AGAIN', `[G4 game over] reads "${GY.overWords('I win.')}"`);
  check(gi.includes('overWords(pl.over)') && gi.includes('AGAIN : NEW_GAME'), '[G4 game over] the GYM does not say a finished game with PLAY AGAIN');
  // S1 · the ladder in one line; S2 · the time left; S3 · what to read; the offline brain not kept
  check(words(SC.LADDER_LINE) <= 14 && SC.LADDER_MORE.length > SC.LADDER_LINE.length && /^How the ladder/.test(SC.LADDER_KEY), `[S1 ladder] reads "${SC.LADDER_LINE}"`);
  check(SC.timeLeft(7, 1, 20, 6 * 60_000) === 'about 14 min left' && SC.timeLeft(2, 1, 20, 60_000) === '' && SC.timeLeft(19, 1, 20, 18 * 20_000) === 'under a minute left' && SC.timeLeft(1, 1, 20, 0) === '', `[S2 time left] reads "${SC.timeLeft(7, 1, 20, 6 * 60_000)}"`);
  const topics = { fractions: { got: 1, max: 6 }, ratio: { got: 2, max: 4 }, algebra: { got: 5, max: 5 }, shape: { got: 3, max: 3 } };
  check(SC.whatToRead(topics) === 'Not top grades yet. Read up on fractions and ratio next.' && SC.whatToRead({ a: { got: 2, max: 2 } }) === '', `[S3 what to read] reads "${SC.whatToRead(topics)}"`);
  check(/^With no signal I sit papers on the offline brain, and it isn’t on this phone yet/.test(SC.notKept('520 MB')) && /520 MB/.test(SC.notKept('520 MB')) && /Wi-Fi/.test(SC.notKept('520 MB')), `[S offline brain] reads "${SC.notKept('520 MB')}"`);
  const si = nocomments(src('features/school/index.ts'));
  check(si.includes('LADDER_LINE') && si.includes('timeLeftNow(st)') && si.includes('whatToRead(r.topics)') && si.includes('notKept(sizeText(') && !/Strictly in order: a stage opens only/.test(si), '[S1 S2 S3] SCHOOL is not drawn from the words');
  // L1 · the empty shelf; L2 · a file it cannot read; L3 · no hit; L5 · a book it cannot open
  check(words(LB.SHELF_NONE.line) <= 20 && /^No books of yours yet/.test(LB.SHELF_NONE.head), `[L1 empty shelf] reads "${LB.SHELF_NONE.head}: ${LB.SHELF_NONE.line}"`);
  check(/^I can’t read “scan\.pdf”: it looks like pictures of pages\. Photos of the pages work/.test(LB.unreadable('scan.pdf', true)) && /^I can’t read “x\.xyz”\. PDFs, Word files, e-books, text and photos of pages all work\.$/.test(LB.unreadable('x.xyz', false)) && !/Workers AI|converter/i.test(LB.unreadable('x', true) + LB.unreadable('x', false)), `[L2 unreadable] reads "${LB.unreadable('x.xyz', false)}"`);
  check(LB.noHit('zzqx') === 'I can’t find “zzqx”. Try one plainer word, or fewer words.' && !/→/.test(LB.MEANING_TIP) && words(LB.MEANING_TIP) <= 16, `[L3 no hit] reads "${LB.noHit('zzqx')}"`);
  check(/^I couldn’t open “Dune”\. Tap TRY AGAIN/.test(LB.openFailed('Dune')) && LB.TRY_AGAIN === 'TRY AGAIN', `[L5 reader] reads "${LB.openFailed('Dune')}"`);
  const rd = nocomments(src('features/library/reader.ts'));
  check(rd.includes('openFailed(shortTitle(d.title))') && rd.includes('key(TRY_AGAIN'), '[L5 reader] the reader says nothing of a way on when a book will not open');
  // LG · the typing passage is plain; each helper is one sentence; the streak lines are said without blame
  check(!LG.plainProse('ALSO: uploads - check size and real type (magic bytes), store outside the web root with a random name; redirects - only.') && !LG.plainProse('REST SHAPE (one resource): GET /api/products?page=1&limit=20&q= → 200 { items, page, total } GET /api/products/:id → 200 item | 404 POST /api/products.') && LG.plainProse('The keeper climbed the iron stairs again and counted every step under his breath.') && !LG.plainProse('Too short to type.'), '[LG1 typing passage] plainProse lets a line of code through or a plain sentence out');
  check(nocomments(src('features/learning/library.ts')).includes('plainProse(p)'), '[LG1 typing passage] the library passage is not tested for plain sentences');
  const helpers = { WORDS_LINE: LG.WORDS_LINE, TYPING_LINE: LG.TYPING_LINE, MATHS_LINE: LG.MATHS_LINE, FIRSTAID_LINE: LG.FIRSTAID_LINE };
  check(Object.values(helpers).every((t) => oneSentence(t) && words(t) <= 16) && /starter set, typed in by hand/.test(LG.WORDS_LINE) && /NHS.*999/.test(LG.FIRSTAID_LINE) && /not a dictionary/.test(LG.WORDS_LINE), `[LG2 helpers] one of "${Object.values(helpers).join(' | ')}" is long or has lost its honest line`);
  check(/^Nothing logged yet\. Finish a drill, or say “done typing 52”/.test(LG.NO_STREAK) && !/sheet/i.test(LG.NO_STREAK) && LG.brokenRun(5) === 'Your run ended. Your best is 5 days: start a new one today.' && !/fail|lost|broke|missed/i.test(LG.brokenRun(3)), `[LG3 streak] reads "${LG.NO_STREAK}" / "${LG.brokenRun(5)}"`);
  // CO · the microphone refused as the Lens says it; the cents with their word; the tuner's helper
  check(/Settings, Ghosty, Microphone/.test(CO.MIC_REFUSED) && !/Safari|aA|Website/.test(CO.MIC_REFUSED), `[CO1 mic] reads "${CO.MIC_REFUSED}"`);
  check(CO.centsWords(-12, false) === '12 cents, a little flat' && CO.centsWords(22, false) === '22 cents, sharp' && CO.centsWords(48, false) === '48 cents, a lot sharp' && CO.centsWords(2, true) === 'in tune' && CO.centsWords(-1, false) === '1 cent, a little flat', `[CO2 cents] reads "${CO.centsWords(-12, false)}"`);
  check(oneSentence(CO.TUNER_LINE) && words(CO.TUNER_LINE) <= 16 && CO.TUNER_MORE.length > 40 && /no recording|nothing is recorded/.test(CO.TUNER_LINE), `[CO3 tuner line] reads "${CO.TUNER_LINE}"`);
  const cs = nocomments(src('coach/sheet.ts'));
  check(cs.includes('centsWords(t.off, t.inTune)') && cs.includes('TUNER_LINE') && !/On iPhone: Settings, Safari/.test(nocomments(src('coach/mic.ts'))), '[CO1 CO2 CO3] the Coach is not drawn from the words');
  // the chat phrases listed on a screen are answered on the phone (no phrase is invented)
  const LA = await pure('packages/shared/src/learning.ts');
  const CA = await pure('apps/web/src/coach/ask.ts');
  const RA = await pure('apps/web/src/gym/chessrate.ts');
  const IN = await pure('packages/shared/src/intent.ts');
  const notLocal = [...LG.PHRASES.filter((x) => !LA.learningAsked(x)), ...CO.PHRASES.filter((x) => !CA.coachAsked(x)), ...GY.PHRASES.filter((x) => !RA.ratingAsked(x)), ...LB.PHRASES.filter((x) => !IN.readingIntent(x))];
  check(!notLocal.length && LG.PHRASES.length >= 2 && CO.PHRASES.length >= 2 && GY.PHRASES.length >= 1 && LB.PHRASES.length >= 2, `[phrases] a listed phrase is not answered on the phone: ${notLocal.join(' | ')}`);
});

// ================================================================ the phone
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const j = (v, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(v) });

/** One phone in The Scan: every waiting line counted (window.__waits), outside hosts shut. `store`: localStorage to start with. `body`: the text size. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, refuseMic }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
    if (refuseMic) navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
  }, { key: KEY, body: o.body ?? 0, refuseMic: !!o.refuseMic });
  return { ctx, page, boot: async () => { await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }); await page.waitForTimeout(900); } };
}
const open = async (vp, o = {}) => {
  const p = await phone(vp, o);
  live.push(p.ctx);
  await o.before?.(p);
  await p.boot();
  return p;
};
const go = async (page, id, ms = 1800) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(ms);
};
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
const small = (page, sel) =>
  page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], [role=tab])`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .map((e) => {
        const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height };
        return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      })
      .filter(Boolean)
      .slice(0, 8),
  );
const sideways = (page, id) =>
  page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} *`)].some((e) => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }), id);
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const GL = process.env.NO_GL_SHOTS === '1';
const still = (page, name, vp) => (vp.width === 440 && !GL ? page.screenshot({ path: `${out}/learnpass-${name}-440-${STILL}.png`, timeout: 20000 }).catch(() => undefined) : vp.width === 440 ? page.screenshot({ path: `${out}/learnpass-${name}-440-${STILL}.png`, timeout: 20000 }).catch(() => undefined) : undefined);
const waits = (page) => page.evaluate(() => window.__waits.slice());

/** The bar every screen answers to: nothing sideways, every control 44 pt, no raw string on the page. */
async function bar(page, tag, id, root = `#pg-${id}`) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, root);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${root} .pn:not([hidden]) *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
const emptyLearn = { courses: [], cards: [], streak: { days: [], best: 0 }, tz: 'Europe/London' };

// ================================================================ COURSES
for (const vp of [PHONE, PHONE2]) {
  if (!on('learn')) break;
  const T = `[${vp.width}]`;
  await section('learn', async () => {
    log(`learn ${vp.width}`);
    let lessonDead = false;
    const { ctx, page } = await open(vp, {
      before: async ({ ctx }) => {
        await ctx.route('**/api/learn', (r) => (r.request().method() === 'GET' ? r.fulfill(j(emptyLearn)) : r.fallback()));
        await ctx.route('**/api/learn/course', async (r) => {
          if (r.request().method() !== 'POST') return r.fallback();
          await new Promise((x) => setTimeout(x, 1400));
          return r.fallback();
        });
        await ctx.route('**/api/learn/lesson', (r) => (lessonDead && r.request().method() === 'POST' ? r.abort() : r.fallback()));
      },
    });
    await go(page, 'learn', 2200);
    // C1 · nothing yet: the one line, the key's next thing, the detail behind a "?"
    const cold = await page.evaluate(() => ({ line: document.querySelector('#pg-learn .learncold[data-state="empty"]')?.textContent ?? '', has: document.querySelector('#pg-learn details.learnhas summary')?.textContent ?? '', none: document.querySelector('#pg-learn .learncourses .empty[data-state="empty"]')?.textContent ?? '' }));
    check(cold.line === 'Tell me what to teach and I make you a course.' && cold.has === LN.COURSE_HAS_KEY && /No courses yet/.test(cold.none) && words(cold.line) <= 20, `${T} [C1 empty] reads "${cold.line}" / "${cold.has}" / "${cold.none}"`);
    // an empty topic is said beside the box (no toast needed)
    await page.locator('#pg-learn .learnnew button.on', { hasText: /^start$/i }).click({ force: true });
    check(await until(page, (w) => document.querySelector('#pg-learn .learnsay')?.textContent === w && !document.querySelector('#pg-learn .learnsay').hidden, LN.TOPIC_EMPTY, 3000), `${T} [C1 empty topic] START with nothing typed said "${await txt(page, '#pg-learn .learnsay')}"`);
    await still(page, 'courses-cold', vp);
    // C1 · planning: said once as a waiting line, the key keeps its word
    await page.fill('#pg-learn .learntopic input', 'photosynthesis');
    await page.locator('#pg-learn .learnnew button.on', { hasText: /^start$/i }).click({ force: true });
    check(await until(page, (w) => !!document.querySelector(`#pg-learn [data-wait="${w}"]`), LN.PLANNING, 2500), `${T} [C1 planning] no waiting line "${LN.PLANNING}" while the course was planned: waits ${(await waits(page)).filter((x) => /course|Plan/i.test(x)).join(' | ')}`);
    check((await txt(page, '#pg-learn .learnnew .row.wrap button')) === 'START' && (await page.locator('#pg-learn [data-wait="Planning your course…"]').count()) === 1, `${T} [C1 planning] the key reads "${await txt(page, '#pg-learn .learnnew .row.wrap button')}" (the wait is said once)`);
    check(await until(page, () => !!document.querySelector('#pg-learn .learnmap'), null, 20000), `${T} [C1 planning] the course never landed`);
    check((await page.locator('#pg-learn [data-wait="Planning your course…"]').count()) === 0, `${T} [C1 planning] the planning line is still up once the course landed`);
    await still(page, 'courses-map', vp);
    await bar(page, `${T} [learn map]`, 'learn');
    // C3 · a lesson is written (said), a wrong answer says the right one kindly
    await page.locator('#pg-learn .learnlesson').first().click({ force: true });
    check(await until(page, (w) => (window.__waits ?? []).includes(w), LN.LESSON_WAIT, 3000), `${T} [C1 lesson wait] opening a lesson said nothing: ${(await waits(page)).filter((x) => /lesson/i.test(x)).join(' | ')}`);
    check(await until(page, () => !!document.querySelector('#pg-learn .learncheck button.learnchoice'), null, 20000), `${T} [C3] the lesson never drew its question`);
    const letter = await page.evaluate(() => { const bs = [...document.querySelectorAll('#pg-learn .learncheck button.learnchoice')]; return bs.length; });
    // the stand-in lesson's right answer is B (oxygen): pick A, the wrong one
    await page.locator('#pg-learn .learncheck button.learnchoice').first().click({ force: true });
    await page.waitForTimeout(500);
    const feed = await txt(page, '#pg-learn .learnfeed');
    check(letter >= 2 && /^Not quite\. The answer is [A-F]\) .+\./.test(feed) && !/Not quite:/.test(feed), `${T} [C3 wrong answer] says "${feed}"`);
    // C2 · the brain out of reach on a lesson not yet written: what still works
    lessonDead = true;
    await page.locator('#pg-learn .learnbar button', { hasText: /^back to course$/i }).first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('#pg-learn .learnlesson').nth(1).click({ force: true });
    check(await until(page, () => !!document.querySelector('#pg-learn .learnout'), null, 8000), `${T} [C2 lesson out] a lesson the brain could not write drew nothing but: "${await txt(page, '#pg-learn .learnstudy')}"`);
    const outT = await txt(page, '#pg-learn .learnout');
    check(outT.includes(LN.lessonOut(0).head) && /still work/.test(outT) && !RAW.test(outT) && (await page.locator('#pg-learn .learnout[data-state]').count()) === 1 && (await page.locator('#pg-learn .learnstudy button', { hasText: /^back to course$/i }).count()) === 1, `${T} [C2 lesson out] reads "${outT}"`);
    await still(page, 'courses-out', vp);
    // C4 · every control 44 pt (the level and minute chips and START were 36 to 40), nothing sideways
    await page.locator('#pg-learn .learnstudy button', { hasText: /^back to course$/i }).first().click({ force: true });
    await page.waitForTimeout(400);
    await bar(page, `${T} [C4 learn controls]`, 'learn');
    await ctx.close();
  });
}

// ================================================================ THE ARCADE
for (const vp of [PHONE, PHONE2]) {
  if (!on('arcade')) break;
  const T = `[${vp.width}]`;
  await section('arcade', async () => {
    log(`arcade ${vp.width}`);
    const { ctx, page } = await open(vp, { before: async ({ ctx }) => { await ctx.addInitScript(() => { window.__mobile = true; }); } });
    await go(page, 'arcade', 2200);
    await still(page, 'arcade-shelf', vp);
    const getKey = page.locator('#pg-arcade .arccard:not(.arcpack)[data-id="doom-shareware"] .arcact, #pg-arcade .arccard:not(.arcpack) .arcact.get').first();
    const id = await page.evaluate(() => document.querySelector('#pg-arcade .arccard:not(.arcpack) .arcact.get')?.closest('.arccard')?.dataset.id ?? '');
    const cardSel = `#pg-arcade .arccard[data-id="${id}"]`;
    const size = ((await txt(page, `${cardSel} .arcact`)).match(/GET · (.+)$/) ?? [])[1] ?? '';
    // A1 · on mobile data: said as I, with the size, and that I wait
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), { type: 'cellular' }), configurable: true }));
    await page.locator(`${cardSel} .arcact`).click({ force: true });
    check(await until(page, (s) => document.querySelector(s)?.dataset.state === 'offline', `${cardSel} .arcstatus`, 4000), `${T} [A1 mobile data] drew no offline state: "${await txt(page, `${cardSel} .arcstatus`)}"`);
    check((await txt(page, `${cardSel} .arcstatus`)) === AR.mobileData(size) && size.length > 0, `${T} [A1 mobile data] reads "${await txt(page, `${cardSel} .arcstatus`)}" (want "${AR.mobileData(size)}")`);
    await page.locator(`${cardSel} .arcact`).click({ force: true }); // STOP: nothing is fetched
    await page.waitForTimeout(400);
    // A2 · a fetch that fails: his words, nothing kept, RETRY with the size
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), { type: 'wifi' }), configurable: true }));
    await ctx.route(/archive\.org|\/api\/arcade/, (r) => r.abort());
    await page.locator(`${cardSel} .arcact`).click({ force: true });
    check(await until(page, (s) => document.querySelector(s)?.dataset.state === 'error', `${cardSel} .arcstatus`, 12000), `${T} [A2 fetch] a failed fetch drew no error state: "${await txt(page, `${cardSel} .arcstatus`)}"`);
    const fail = await txt(page, `${cardSel} .arcstatus`);
    check(/^I lost the signal halfway\. Try again when you have one\. Nothing was kept; tap RETRY and I’ll start again\.$/.test(fail) && !RAW.test(fail), `${T} [A2 fetch] a failed fetch reads "${fail}"`);
    check((await txt(page, `${cardSel} .arcact`)) === AR.retryKey(size), `${T} [A2 fetch] the key reads "${await txt(page, `${cardSel} .arcact`)}" (want "${AR.retryKey(size)}")`);
    await still(page, 'arcade-failed', vp);
    await bar(page, `${T} [arcade]`, 'arcade');
    await ctx.close();
  });
}

// ================================================================ THE GYM
for (const vp of [PHONE, PHONE2]) {
  if (!on('gym')) break;
  const T = `[${vp.width}]`;
  await section('gym', async () => {
    log(`gym ${vp.width}`);
    const { ctx, page } = await open(vp);
    await go(page, 'gym', 3000);
    await still(page, 'gym-cards', vp);
    const ph = await page.evaluate(() => document.querySelector('#pg-gym .pkphrases')?.dataset.says ?? '');
    check(GY.PHRASES.every((x) => ph.split('|').includes(x)), `${T} [G3 phrases] the GYM lists "${ph}"`);
    await page.locator('#pg-gym .gymcard[data-game="maze"]').click({ force: true });
    await page.waitForTimeout(600);
    // G1 · TRAIN's wait said at once, gone when the first results are in
    await page.locator('#pg-gym button.gymtrain').click({ force: true });
    check(await until(page, (w) => (window.__waits ?? []).includes(w), GY.TRAIN_WAIT, 3000), `${T} [G1 train] TRAIN said nothing while it started: waits ${(await waits(page)).filter((x) => /train/i.test(x)).join(' | ')}`);
    const tt0 = Date.now();
    check(await until(page, (w) => !document.querySelector(`#pg-gym [data-wait="${w}"]`) && (window.__ghosty?.gym?.progress ?? 0) > 0, GY.TRAIN_WAIT, 25000), `${T} [G1 train] the wait is still up (or no result came) after 25 s`);
    console.log(`  [${vp.width}] TRAIN's first results came ${Date.now() - tt0} ms after the wait line was seen`);
    await page.locator('#pg-gym button.gymtrain', { hasText: /^pause$/i }).click({ force: true }).catch(() => undefined);
    await bar(page, `${T} [G controls]`, 'gym');
    // G4 · a finished game said as that, with PLAY AGAIN
    await page.click('#top .navback').catch(() => undefined);
    await page.waitForTimeout(400);
    await page.locator('#pg-gym .gymcard[data-game="tictactoe"]').click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('#pg-gym button', { hasText: /^play him$/i }).click({ force: true });
    await page.waitForTimeout(600);
    let again = false;
    for (let i = 0; i < 14 && !again; i++) {
      again = (await page.locator('#pg-gym .gymagain button', { hasText: /^play again$/i }).count()) > 0;
      if (again) break;
      const cell = page.locator('#pg-gym .gymboard button.gymcell:not(:has-text("X")):not(:has-text("O"))').first();
      if (await cell.count()) await cell.click({ force: true, timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(1100);
    }
    check(again, `${T} [G4 game over] the finished game's key never read PLAY AGAIN: "${await txt(page, '#pg-gym .gymagain')}"`);
    const cap = await txt(page, '#pg-gym .gymboard');
    check(!/\b(You win|I win)\.?/.test(cap) && (/You beat me\.|I won this one\.|A draw\./.test(cap)), `${T} [G4 game over] the board says "${cap.slice(-120)}"`);
    await still(page, 'gym-over', vp);
    await bar(page, `${T} [gym game]`, 'gym');
    await ctx.close();
  });
}

// ================================================================ SCHOOL
for (const vp of [PHONE, PHONE2]) {
  if (!on('school')) break;
  const T = `[${vp.width}]`;
  await section('school', async () => {
    log(`school ${vp.width}`);
    // (a phone that can run the offline brain but has not got it: the one the school's words are for)
    // (and a record with nothing sat, stood in on the brain's own answer: the run's preview brain is shared, and a spec before this
    // one in the same run, sit, hands papers in; the record is otherwise the brain's)
    const { ctx, page } = await open(vp, {
      before: async ({ ctx, page }) => {
        // (13 Nov: with no signal for the brain's own model, the words for the phone's brain; online sitting is learnlane.spec's)
        await ctx.route('**/api/school/sit-online', (r) => r.abort('internetdisconnected'));
        await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']), limits: {} }) }), configurable: true }));
        await ctx.route(/\/api\/school(\?.*)?$/, async (r) => {
          if (r.request().method() !== 'GET') return r.fallback();
          const res = await r.fetch();
          const v = await res.json().catch(() => null);
          if (!v?.state) return r.fulfill({ response: res });
          return r.fulfill({ response: res, json: { ...v, state: { ...v.state, results: [] }, weak: [] } });
        });
      },
    });
    await go(page, 'school', 3500);
    // S1 · the ladder says what unlocks the next stage in one line; the rest is behind a key
    const ld = await page.evaluate(() => ({ line: document.querySelector('#pg-school .schnext')?.textContent ?? '', key: document.querySelector('#pg-school details.schmore summary')?.textContent ?? '', more: document.querySelector('#pg-school details.schmore p')?.textContent ?? '' }));
    check(ld.line === SC.LADDER_LINE && ld.key === SC.LADDER_KEY && ld.more === SC.LADDER_MORE, `${T} [S1 ladder] reads "${ld.line}" / "${ld.key}"`);
    await still(page, 'school-ladder', vp);
    // the offline brain not on this phone: said with its size before any tap
    const why = await page.evaluate(() => ({ t: document.querySelector('#pg-school .schwhy[data-state="offline"]')?.textContent ?? '' }));
    check(/^With no signal I sit papers on the offline brain, and it isn’t on this phone yet\. Get it in Settings, Offline brain: \d+(\.\d+)? ?(MB|GB), on Wi-Fi\.$/.test(why.t), `${T} [S offline brain] reads "${why.t}"`);
    const empty = await page.evaluate(() => document.querySelector('#pg-school .pn [data-state="empty"]')?.textContent ?? '');
    check(/^Nothing sat yet\. SIT THE EXAM above/.test(empty), `${T} [S1 results] with nothing sat the results say "${empty}"`);
    await bar(page, `${T} [school]`, 'school');
    await ctx.close();
  });
}

// ================================================================ THE LIBRARY
for (const vp of [PHONE, PHONE2]) {
  if (!on('library')) break;
  const T = `[${vp.width}]`;
  await section('library', async () => {
    log(`library ${vp.width}`);
    let dead = false;
    const { ctx, page } = await open(vp, {
      before: async ({ ctx }) => {
        await ctx.route('**/api/library', async (r) => {
          if (r.request().method() === 'GET' && dead) return r.abort();
          if (r.request().method() === 'GET') await new Promise((x) => setTimeout(x, 700));
          return r.fallback();
        });
      },
    });
    await go(page, 'library', 1500);
    // L4 · every control 44 pt, the pills too, nothing sideways
    await page.waitForTimeout(1500);
    // L3 · a search with no hit names what he typed and what to try
    const q = page.locator('#pg-library input[type=search][aria-label="Search the library"]');
    await q.fill('zzqxqzz');
    await page.keyboard.press('Enter');
    check(await until(page, () => !!document.querySelector('#pg-library .nohits[data-state="empty"]'), null, 8000), `${T} [L3 no hit] drew no empty state: "${await txt(page, '#pg-library .ask')}"`);
    const nh = await txt(page, '#pg-library .nohits p');
    check(nh.startsWith(LB.noHit('zzqxqzz')) && !/→/.test(nh), `${T} [L3 no hit] reads "${nh}"`);
    await bar(page, `${T} [L4 library controls]`, 'library');
    // L1 · his shelf with none of his books: the one line and the one next thing
    await page.locator('#pg-library .secpill[data-sec="shelf"]').click({ force: true });
    await page.waitForTimeout(500);
    const mine = await page.evaluate(() => ({ line: document.querySelector('#pg-library .shelfempty .empty')?.textContent ?? '', key: document.querySelector('#pg-library .shelfempty button')?.textContent ?? '', phrases: document.querySelector('#pg-library .pkphrases')?.dataset.says ?? '' }));
    console.log(`  [${vp.width}] L1 shelf: "${mine.line}" / key "${mine.key}"`);
    if (mine.line) check(mine.line.includes(LB.SHELF_NONE.line) && /add a book/i.test(mine.key), `${T} [L1 empty shelf] reads "${mine.line}" / "${mine.key}"`);
    check(LB.PHRASES.every((x) => mine.phrases.split('|').includes(x)), `${T} [L1 phrases] the Library lists "${mine.phrases}"`);
    await still(page, 'library-shelf', vp);
    // L2 · a file it cannot read says what works instead
    await page.locator('#pg-library .secpill[data-sec="add"]').click({ force: true });
    await page.waitForTimeout(400);
    await page.setInputFiles('#pg-library input[type=file]', { name: 'mystery.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 159, 146, 150, 1, 2, 200, 201, 202, 0, 0, 7, 8, 9, 255, 254, 253, 0, 31, 30]) });
    const seen = await until(page, () => !!document.querySelector('#pg-library .note.bad[data-state="error"]'), null, 15000);
    console.log(`  [${vp.width}] L2 file: "${(await txt(page, '#pg-library .note')).slice(0, 160)}"`);
    check(seen, `${T} [L2 unreadable] a file it could not read drew no error state: "${(await txt(page, '#pg-library .note')).slice(0, 160)}"`);
    check(/^✕ I can’t read “mystery\.xyz”\. PDFs, Word files, e-books, text and photos of pages all work\.$/.test(await txt(page, '#pg-library .note.bad[data-state="error"]')), `${T} [L2 unreadable] reads "${await txt(page, '#pg-library .note.bad[data-state="error"]')}"`);
    // L5 · a book the reader cannot open: his words and TRY AGAIN
    await page.locator('#pg-library .secpill[data-sec="shelf"]').click({ force: true });
    await page.waitForTimeout(400);
    await ctx.route(/\/api\/library\/docs\/[^/]+\/passages/, (r) => r.abort());
    await page.locator('#pg-library .shelffold').click({ force: true });
    await page.waitForTimeout(400);
    const book = page.locator('#pg-library .shelf .rw:has(.libtile)').first();
    check((await book.count()) > 0, `${T} [L5 reader] no built-in book on the shelf to open`);
    if (await book.count()) {
      await book.click({ force: true });
      const failed = await until(page, () => document.body.dataset.tab === 'reader' && !!document.querySelector('#pg-reader .grd-note[data-state]'), null, 15000);
      console.log(`  [${vp.width}] L5 reader failed state seen: ${failed}`);
      check(failed, `${T} [L5 reader] a book that would not open drew no state: "${await txt(page, '#pg-reader .grd-note')}"`);
      if (failed) {
        const rn = await txt(page, '#pg-reader .grd-note');
        check(/TRY AGAIN/i.test(rn) && /^(Couldn’t open it|Not on this phone)/.test(rn) && !RAW.test(rn), `${T} [L5 reader] a book that would not open reads "${rn}"`);
        await still(page, 'reader-failed', vp);
      }
    }
    await ctx.close();
  });
}

// ================================================================ LEARNING
for (const vp of [PHONE, PHONE2]) {
  if (!on('learning')) break;
  const T = `[${vp.width}]`;
  await section('learning', async () => {
    log(`learning ${vp.width}`);
    const { ctx, page } = await open(vp);
    await go(page, 'learning', 2500);
    // LG2 · each helper one sentence, never repeating the pill; the rest behind "How it works"
    const w = await page.evaluate(() => ({ line: document.querySelector('#pg-learning .sheetline')?.textContent ?? '', more: document.querySelector('#pg-learning details.pkmore summary')?.textContent ?? '', says: document.querySelector('#pg-learning .pkphrases')?.dataset.says ?? '' }));
    check(w.line === LG.WORDS_LINE && w.more === LG.MORE_KEY && LG.PHRASES.every((x) => w.says.split('|').includes(x)), `${T} [LG2 words] reads "${w.line}" / "${w.more}" / "${w.says}"`);
    await still(page, 'learning-words', vp);
    await bar(page, `${T} [learning words]`, 'learning');
    for (const [pill, sel, want, tag] of [['typing', '#pg-learning [data-view="typing"] > .pknote', LG.TYPING_LINE, 'LG2 typing'], ['drills', '#pg-learning [data-view="maths"] > .pknote', LG.MATHS_LINE, 'LG2 maths'], ['firstaid', '#pg-learning .sheetline', LG.FIRSTAID_LINE, 'LG2 first aid']]) {
      await page.locator(`#pg-learning .secpill[data-sec="${pill}"]`).click({ force: true });
      await page.waitForTimeout(1500);
      const got = await txt(page, sel);
      check(got.startsWith(want) && oneSentence(want), `${T} [${tag}] reads "${got.slice(0, 140)}"`);
      if (pill === 'typing') {
        // LG1 · the passage to type is plain sentences, never a line of code from the library
        // (twelve new passages: the library's own text is drawn from at random, so one is not enough to say none is a line of code)
        const seen = [];
        for (let k = 0; k < 12; k++) {
          seen.push(await page.evaluate(() => document.querySelector('#pg-learning [data-view="typing"] [aria-label^="Type this passage"]')?.textContent ?? ''));
          await page.locator('#pg-learning [data-view="typing"] button', { hasText: /^new passage$/i }).click({ force: true, timeout: 3000 }).catch(() => undefined);
          await page.waitForTimeout(350);
        }
        console.log(`  [${vp.width}] LG1 passages seen: ${new Set(seen).size} different, e.g. "${seen[0].slice(0, 90)}"`);
        const odd = seen.filter((x) => !x || /[\/{}()=→;|]|\bGET\b|\bALSO\b/.test(x));
        check(odd.length === 0 && new Set(seen).size >= 2, `${T} [LG1 typing passage] a passage to type is not plain sentences: "${odd[0] ?? ''}" (${new Set(seen).size} different of ${seen.length})`);
      }
      await bar(page, `${T} [learning ${pill}]`, 'learning');
    }
    // LG3 · nothing logged yet: the one next thing, without "sheet"
    await page.locator('#pg-learning .secpill[data-sec="plan"]').click({ force: true });
    check(await until(page, (t) => [...document.querySelectorAll('#pg-learning .pknote')].some((e) => e.textContent === t), LG.NO_STREAK, 12000) || await until(page, () => /day/.test(document.querySelector('#pg-learning [data-view="progress"]')?.textContent ?? ''), null, 500), `${T} [LG3 streak] reads "${(await txt(page, '#pg-learning [data-view="progress"]')).slice(0, 160)}"`);
    await ctx.close();
  });
}

// ================================================================ THE COACH
for (const vp of [PHONE, PHONE2]) {
  if (!on('coach')) break;
  const T = `[${vp.width}]`;
  await section('coach', async () => {
    log(`coach ${vp.width}`);
    const { ctx, page } = await open(vp, { refuseMic: true });
    await go(page, 'coach', 2500);
    const t = await page.evaluate(() => ({ state: document.querySelector('#pg-coach .cowords')?.dataset.state ?? '', line: [...document.querySelectorAll('#pg-coach .cotuner > p.pknote:not(.cowords)')].map((e) => e.textContent).join(' '), key: document.querySelector('#pg-coach details.pkmore summary')?.textContent ?? '', says: document.querySelector('#pg-coach .pkphrases')?.dataset.says ?? '' }));
    check(t.state === 'empty' && t.line === CO.TUNER_LINE && t.key === CO.TUNER_MORE_KEY && CO.PHRASES.every((x) => t.says.split('|').includes(x)), `${T} [CO3 tuner line] reads "${t.line}" / "${t.key}" / "${t.says}"`);
    await still(page, 'coach-tuner', vp);
    // CO1 · the microphone refused: his words, how to allow it; the microphone stays off
    await page.locator('#pg-coach button', { hasText: /^start$/i }).first().click({ force: true });
    check(await until(page, () => document.querySelector('#pg-coach .cowords')?.dataset.state === 'error', null, 6000), `${T} [CO1 mic] a refused microphone drew no error state: "${await txt(page, '#pg-coach .cowords')}"`);
    check((await txt(page, '#pg-coach .cowords')) === CO.MIC_REFUSED, `${T} [CO1 mic] reads "${await txt(page, '#pg-coach .cowords')}"`);
    check(await page.evaluate(() => window.__ghosty?.coach?.tuner?.on === false || window.__ghosty?.coach === undefined), `${T} [CO1 mic] the tuner says it is on though the microphone was refused`);
    await still(page, 'coach-mic', vp);
    await bar(page, `${T} [coach]`, 'coach');
    await ctx.close();
  });
}

// ================================================================ BODY 21 clips nothing (the biggest text, at 440)
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await open(PHONE, { body: 21 });
  for (const id of ['learn', 'arcade', 'gym', 'school', 'library', 'learning', 'coach']) {
    await page.evaluate((t) => (location.hash = t), id);
    await page.waitForTimeout(2200);
    check(!(await sideways(page, id)), `[440] [BODY 21] ${id}: sideways at the biggest text`);
    const cut = await page.$$eval(`#pg-${id} :is(.note, .empty b, .empty span, .learnsay, .learnout p, .arcstatus, .arcnone, .gymtrainerr, .schladder, .schread, .nohits p, .pknote, .cowords, .sheetline, .grd-state)`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]') && (e.scrollWidth > e.clientWidth + 2 || (getComputedStyle(e).overflow === 'hidden' && e.scrollHeight > e.clientHeight + 2))).map((e) => (e.textContent ?? '').trim().slice(0, 40)));
    check(!cut.length, `[440] [BODY 21] ${id}: text cut off: ${cut.join(' | ')}`);
  }
  await ctx.close();
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `LEARN pass run clean: ${checks} checks in ${secs} s: COURSES, the Arcade, the GYM, SCHOOL, the Library, LEARNING and the Coach say their states in his words, every control 44 pt, nothing sideways at 440 and 390.`);
process.exit(problems.length ? 1 : 0);
