// AWARENESS, PR A (BRIEF-AWARENESS; the owner's decision of 5 Nov, OWNER-ISSUES 131: "the context line rides in his message to the
// brain, never in the system prompt"), on the preview with the scripted brain, on the owner's iPhone 18 Pro Max (440 × 956) and at
// 390 × 844. Every screen says what is open and what is selected (shell/awareness.ts), and the words that point at it act on it
// with no model. Every check fails on the code before this pass (there was no `window.__ghosty.awareness`, no "that one", the
// screen went in the system prompt and the Core card said nothing of it):
//  1. THE ROOM PLAN: tap the top wall → the context says "the north wall (4.2 m)"; "make that wall longer" opens that wall's
//     real-length box and says "The north wall: 4.2 m, how long?"; "a door in that wall" puts a door on it; with an item
//     chosen "add a wardrobe there" adds one; the chat's brain is never called for any of it.
//  2. THE CAR: "grinding when I brake" → SHOW ME → a pin tapped → the context names the part and its suspect number; "find me a
//     replacement" says the part, who fits it and its rough cost, with the offer of the shops.
//  3. THE SHED (DESIGN A BUILD): "design me a shed 3 by 2" → the sheet says what it is, its size and the side; a part lit
//     from the bill says "the roof".
//  4. THE READER: a book opened → the context says the book and his place; "read that one" reads it from his place (the brain
//     is never called); the lit passage is the selection while it reads.
//  5. THE DECK: open → the context is the deck's, with the card opened as the selection; typed "open that one" opens it.
//  6. THE LENS on PEOPLE says only that it is open, never who (the line is exactly "the Lens on PEOPLE").
//  7. THE TURN: one message to the brain carries `screen` (with the selection) and `screenLine` (≤ 220 characters, the wrapped
//     words the brain pastes); the context is the same one the stamp line's LOOKING AT reads (the reader's, THE LOOK's).
//  8. THE CORE CARD in Every screen says "Looking at: …" for the screen under it, WORKING (and DEGRADED when no turn carried one).
//  9. THE SPEED BUDGET: reading a context costs under 2 ms a time over 200 selections.
// 10. Nothing sticks out sideways at 440 and 390 (the deck with its Core card, the reader's stamp line), every deck card 44 pt.
// 11. EVERY SCREEN'S OWN SENTENCE (BRIEF-SHELL pass 1, OWNER-ISSUES 150 d): 39 screens opened and read, each with a sentence of its own
//     (not the fallback), 160 characters at most, no key; eight held to their exact words, a sheet screen follows its pill.
//   BASE=http://localhost:8788 node tests/awareness.spec.mjs [outDir]   (ONLY=plan,car,shed,reader,deck,lens,turn,core,speed,fit,screens)
import { launch, webkitNoise } from './browser.mjs';
import { GLASS, PHONE, UK, openDeck, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
const part = (k) => !only.length || only.includes(k);
const problems = [];
const measured = {};
const check = (ok, what) => void (ok || problems.push(what));
const RUN = Date.now().toString(36).slice(-4);
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => r.json());

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

/** A voice of its own for the page (the reader's LISTEN needs one): each piece starts at once and ends in 60 ms a word. */
const fakeVoice = () => {
  const synth = window.speechSynthesis;
  const voices = [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true }];
  window.SpeechSynthesisUtterance = class { constructor(text) { Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 }); } };
  let cur = null;
  let timer = 0;
  synth.getVoices = () => voices;
  synth.speak = (u) => {
    cur = u;
    setTimeout(() => u.onstart?.({}), 15);
    timer = setTimeout(() => { cur = null; u.onend?.({}); }, Math.max(250, 60 * u.text.split(/\s+/).length));
  };
  synth.cancel = () => { clearTimeout(timer); const u = cur; cur = null; u?.onend?.({}); };
  synth.pause = () => undefined;
  synth.resume = () => undefined;
  Object.defineProperty(synth, 'speaking', { configurable: true, get: () => !!cur });
};

// (`world` 'glass': the deck's cards and their Core line are Glass's, held to their own checks unchanged; the default is The Scan)
async function open(size = PHONE, name = 'main', world = 'scan') {
  const ctx = await browser.newContext({ viewport: size, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'], userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(([k, look]) => {
    // this runs in every frame, the sandboxed widget frames included (no same-origin: their storage throws): only Ghosty's own page is seeded
    try {
      localStorage.setItem('ghosty.ownerKey', k);
      if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric', ...(look ? { look } : {}) }));
    } catch { /* a sandboxed frame */ }
  }, [KEY, world === 'glass' ? GLASS.look : null]);
  await ctx.addInitScript(fakeVoice);
  const page = await ctx.newPage();
  const bodies = [];
  await page.route('**/api/chat', (route) => {
    try { bodies.push(JSON.parse(route.request().postData() ?? '{}')); } catch { /* not json */ }
    return route.continue();
  });
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:|Failed to fetch|NotAllowed/.test(t)) problems.push(`[${name}] console: ${t.slice(0, 200)}`);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.tab === 'core' && window.__ghosty?.awareness, null, { timeout: 30000 }).catch(() => problems.push(`[${name}] Home did not open with awareness on it`));
  await page.waitForTimeout(1200);
  return { ctx, page, bodies };
}

const aware = (page) => page.evaluate(() => {
  const a = window.__ghosty?.awareness;
  if (!a) return null;
  const c = a.screenContext();
  return { ...c, words: a.wordsNow() };
});
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (why && problems.push(why), false));
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('#toasts .toast, .modal:not(.build)').forEach((t) => t.remove()));
const logOpen = (page) => page.evaluate(() => !!document.querySelector('.hud.core.logopen'));
/** Something said on the screen that is up (the chat's box is on Home only; the microphone says it anywhere, as this does). */
const say = (page, words) => page.evaluate((t) => window.__ghosty.send(t, false), words);
const closeLog = () => Promise.resolve();
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('.msg:not(.me)')].at(-1)?.textContent ?? '');
const replyMatching = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('.msg:not(.me)')].some((m) => new RegExp(src).test(m.textContent ?? '')), re.source, { timeout: 12000 }).then(() => true, () => false);
const chatCalls = (bodies) => bodies.length;
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);

// ---------------------------------------------------------------- 1. THE ROOM PLAN
if (part('plan') || part('turn') || part('speed')) {
  const { ctx, page, bodies } = await open(PHONE, 'plan');
  await page.evaluate(() => (location.hash = 'space'));
  await until(page, () => window.__ghosty?.space?.room?.w > 0 && window.__ghosty.ui.get().tab === 'space', null, 15000, '[plan] the planner did not open');
  await page.waitForTimeout(500);
  await clearToasts(page);
  await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
  const sp = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.space)));
  const at = async (xcm, ycm) => {
    const box = await page.locator('#pg-space .spacecanvas').boundingBox();
    const { pad, k } = (await sp()).view;
    return { x: box.x + pad + xcm * k, y: box.y + pad + ycm * k };
  };
  const tap = async (xcm, ycm) => {
    await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
    const p = await at(xcm, ycm);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(140);
  };
  const s0 = await sp();
  const a0 = await aware(page);
  check(a0?.screen === 'space' && /^the room plan, room \d\.\d × \d\.\d m, \d items?$/.test(a0.line) && !a0.selected, `[plan] the plan says: ${JSON.stringify(a0)}`);
  const wMetres = (s0.room.w / 100).toFixed(1);

  await tap(s0.room.w / 2, -6);
  let a = await aware(page);
  check(a?.selected?.kind === 'wall' && a.selected.label === 'the north wall' && a.selected.detail === `${wMetres} m`, `[plan] the top wall picked: ${JSON.stringify(a?.selected)} (want the north wall, ${wMetres} m)`);
  check(a?.words === `On screen: ${a.line}; selected: the north wall (${wMetres} m).` && a.words.length <= 220, `[plan] the words: ${a?.words}`);
  await page.screenshot({ path: `${out}/plan-wall.png` });

  // "make that wall longer": no model; the wall's length box, its answer says which wall
  const calls0 = chatCalls(bodies);
  await say(page, 'make that wall longer');
  check(await replyMatching(page, new RegExp(`The north wall: ${wMetres} m, how long\\?`)), `[plan] "make that wall longer" said: ${await lastReply(page)}`);
  const focus = await page.evaluate(() => ({ aria: document.activeElement?.getAttribute('aria-label') ?? '', has: !!document.querySelector('#pg-space .spacearch input[aria-label^="This wall"]'), hidden: document.querySelector('#pg-space .spacearch')?.hidden }));
  check(focus.has && focus.hidden === false, `[plan] the wall's length box is not up: ${JSON.stringify(focus)}`);
  check(chatCalls(bodies) === calls0, '[plan] "make that wall longer" went to the brain');
  await closeLog(page);
  const lenIn = page.locator('#pg-space .spacearch input[aria-label^="This wall"]');
  await page.waitForTimeout(900);
  const box = await lenIn.boundingBox();
  check(!!box && box.y >= 0 && box.y + box.height <= PHONE.height, `[plan] the length box is not on screen: ${JSON.stringify(box)}`);
  await page.screenshot({ path: `${out}/plan-length.png` });

  // "a door in that wall": a door on the north wall
  const doors0 = (await sp()).openings.length;
  await say(page, 'a door in that wall');
  await replyMatching(page, /A door in the north wall/);
  const s1 = await sp();
  check(s1.openings.length === doors0 + 1 && s1.openings.at(-1)?.type === 'door' && s1.openings.at(-1)?.wall === 0, `[plan] "a door in that wall": ${JSON.stringify(s1.openings)}`);
  a = await aware(page);
  check(a?.selected?.kind === 'opening' && /^the door$/.test(a.selected.label) && /cm wide in the north wall/.test(a.selected.detail ?? ''), `[plan] the door picked: ${JSON.stringify(a?.selected)}`);
  check(a.words.length <= 220, `[plan] words ${a.words.length}`);

  // an item chosen: "add a wardrobe there" puts one by it (or where it fits), and says which
  await closeLog(page);
  const sofa = s1.items[0];
  await tap(sofa.x + 10, sofa.y + 10);
  a = await aware(page);
  check(a?.selected?.kind === 'item' && /\d+ × \d+ cm/.test(a.selected.detail ?? ''), `[plan] an item picked: ${JSON.stringify(a?.selected)}`);
  const n0 = (await sp()).items.length;
  await say(page, 'add a wardrobe there');
  check(await replyMatching(page, /Wardrobe 100 × 60 cm/), `[plan] "add a wardrobe there" said: ${await lastReply(page)}`);
  check((await sp()).items.length === n0 + 1, `[plan] "add a wardrobe there" did not add one (${(await sp()).items.length} items)`);
  check(chatCalls(bodies) === calls0, '[plan] the plan\'s words went to the brain');
  // nothing selected: "that wall" has no meaning, so the words go to the brain, with the screen
  await closeLog(page);
  await tap(-30, -30);
  a = await aware(page);
  check(!a?.selected, `[plan] a tap off the plan left ${JSON.stringify(a?.selected)} picked`);
  await say(page, 'make that wall longer');
  await page.waitForFunction(() => window.__ghosty.awareness.lastSent().at > 0, null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  check(chatCalls(bodies) === calls0 + 1, `[plan] with nothing selected the words should go to the brain (${chatCalls(bodies) - calls0} calls)`);

  // the turn: the request body carries the screen, its selection and the line
  if (part('turn')) {
    await closeLog(page);
    await tap(s0.room.w / 2, s0.room.d + 6);
    a = await aware(page);
    check(a?.selected?.kind === 'wall' && a.selected.label === 'the south wall', `[turn] the bottom wall picked: ${JSON.stringify(a?.selected)}`);
    const before = bodies.length;
    await say(page, `what is on this wall ${RUN}`);
    await page.waitForFunction((n) => window.__ghosty.awareness.lastSent().at > 0, before, { timeout: 8000 }).catch(() => undefined);
    await until(page, (n) => true, before, 100);
    await page.waitForTimeout(1200);
    const body = bodies.at(before);
    check(!!body, '[turn] no message reached the brain');
    const c = body?.context ?? {};
    check(c.screen?.screen === 'space' && c.screen?.selected?.id === 'wall:r1:2' && c.screen?.selected?.label === 'the south wall' && typeof c.screen.line === 'string' && c.screen.line.length <= 160, `[turn] the context's screen: ${JSON.stringify(c.screen)}`);
    check(typeof c.screenLine === 'string' && c.screenLine.length <= 220 && c.screenLine.startsWith('On screen: the room plan') && /selected: the south wall \(/.test(c.screenLine), `[turn] screenLine: ${c.screenLine}`);
    check(c.tab === 'space' && c.name === 'Boss' && !('lat' in c) && c.location?.name === 'Birmingham', `[turn] the rest of the context: ${JSON.stringify({ tab: c.tab, name: c.name, location: c.location })}`);
    // the line is only what the screen said: nothing of the time or the place in it
    check(!/Birmingham|\d\d:\d\d|Europe\/London/.test(c.screenLine ?? ''), `[turn] the line carries the time or the place: ${c.screenLine}`);
    const last = await page.evaluate(() => window.__ghosty.awareness.lastSent());
    check(last.had === true && last.screen === 'space', `[turn] the last turn's mark: ${JSON.stringify(last)}`);
  }

  // THE SPEED BUDGET: a context read after each of 200 selections under 2 ms
  if (part('speed')) {
    await closeLog(page);
    // (walls tapped away from the door and the wardrobe; each tap is the planner's own touch path)
    const walls = [[30, -6], [s0.room.w + 6, 30], [30, s0.room.d + 6], [-6, 30]];
    const times = [];
    for (let i = 0; i < 200; i++) {
      const [x, y] = walls[i % 4];
      await tap(x, y);
      times.push(await page.evaluate(() => {
        const t0 = performance.now();
        const c = window.__ghosty.awareness.screenContext();
        window.__ghosty.awareness.wordsNow();
        return [performance.now() - t0, c.selected?.id ?? ''];
      }));
    }
    const ms = times.map((t) => t[0]);
    const mean = ms.reduce((s, x) => s + x, 0) / ms.length;
    const worst = Math.max(...ms);
    measured.contextMeanMs = +mean.toFixed(3);
    measured.contextWorstMs = +worst.toFixed(2);
    check(mean < 2, `[speed] reading a context after a selection costs ${mean.toFixed(2)} ms on average (budget 2 ms)`);
    check(new Set(times.map((t) => t[1])).size >= 4, `[speed] the 200 selections did not move: ${[...new Set(times.map((t) => t[1]))].join(', ')}`);
    console.log(`[speed] a context read after each of 200 selections: mean ${mean.toFixed(3)} ms, worst ${worst.toFixed(2)} ms`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 2. THE CAR
if (part('car')) {
  const { ctx, page, bodies } = await open(PHONE, 'car');
  await say(page, 'grinding when I brake');
  await until(page, () => [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].some((c) => /ccsafe|Brakes/.test(c.innerHTML)), null, 20000, '[car] no CAR card for "grinding when I brake"');
  if (!(await logOpen(page))) await page.click('.logbtn');
  await page.waitForTimeout(400);
  await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW ME' }).last().click();
  await until(page, () => { const s = window.__ghosty.car?.state(); return s?.ready && s.on && s.view === 'wheel' && !s.moving && s.lit.includes('pads'); }, null, 90000, '[car] SHOW ME did not bring up the wheel view with the pads lit');
  let a = await aware(page);
  check(a?.screen === 'studio' && /^the car, .*the wheel off, fixing “grinding when braking”, \d parts? lit$/.test(a.line), `[car] the car says: ${JSON.stringify(a)}`);
  check(a?.selected?.kind === 'fault' && /grinding when braking/.test(a.selected.label), `[car] before a part is tapped the fault is the selection: ${JSON.stringify(a?.selected)}`);
  check(!/(plate|[A-Z]{2}\d\d ?[A-Z]{3})/.test(a?.words ?? ''), `[car] a plate in the words: ${a?.words}`);
  await page.locator('#pg-studio .carpin', { hasText: '1' }).first().click();
  await until(page, () => window.__ghosty.car.state().picked === 'pads', null, 8000, '[car] the pin did not pick the pads');
  a = await aware(page);
  check(a?.selected?.kind === 'part' && a.selected.id === 'pads' && a.selected.label === 'the brake pads' && /^suspect 1 of \d for “grinding when braking”$/.test(a.selected.detail ?? ''), `[car] the pads picked: ${JSON.stringify(a?.selected)}`);
  check(a.words.length <= 220, `[car] words ${a.words.length}`);
  await page.screenshot({ path: `${out}/car-picked.png` });
  const calls0 = chatCalls(bodies);
  await say(page, 'find me a replacement');
  check(await replyMatching(page, /Brake pads: a garage job, £\d+–£\d+ for .*a first estimate, not a quote/), `[car] "find me a replacement" said: ${await lastReply(page)}`);
  const chip = await page.evaluate(() => [...document.querySelectorAll('.msg:not(.me)')].at(-1)?.parentElement?.innerText ?? '');
  check(/FIND ONE IN SHOPS/.test(chip), `[car] no FIND ONE IN SHOPS under the reply: ${chip.slice(-120)}`);
  check(chatCalls(bodies) === calls0, '[car] "find me a replacement" went to the brain');
  await ctx.close();
}

// ---------------------------------------------------------------- 3. THE SHED
if (part('shed')) {
  const { ctx, page, bodies } = await open(PHONE, 'shed');
  await say(page, 'design me a shed 3 by 2');
  await until(page, () => !!document.querySelector('.build'), null, 15000, '[shed] the build sheet did not open');
  await page.waitForTimeout(500);
  let a = await aware(page);
  check(a?.screen === 'build' && a.line === 'a garden shed 3 × 2 m, the plan' && !a.selected, `[shed] the sheet says: ${JSON.stringify(a)}`);
  await say(page, 'price the roof');
  await replyMatching(page, /The roof:/);
  await page.waitForTimeout(400);
  a = await aware(page);
  check(a?.line === 'a garden shed 3 × 2 m, the bill of materials' && a.selected?.kind === 'group' && a.selected.id === 'roof' && a.selected.label === 'the roof', `[shed] side and lit group: ${JSON.stringify(a)}`);
  check(a.words.length <= 220, `[shed] words ${a.words.length}`);
  await page.screenshot({ path: `${out}/shed-sheet.png` });
  check(chatCalls(bodies) === 0, '[shed] the brain was called');
  await ctx.close();
}

// ---------------------------------------------------------------- 4. THE READER
const BOOK = `The Lighthouse Keeper ${RUN}`;
if (part('reader') || part('core')) {
  const { ctx, page, bodies } = await open(PHONE, 'reader');
  const doc = async () => (await api('/library')).docs?.find((d) => d.title === BOOK) ?? null;
  const sentence = (p, i) => `On page ${p} the keeper climbed the iron stairs, ${['counted every step', 'polished the great lens', 'wrote the weather in the log', 'listened to the sea'][i]} and went on.`;
  const text = Array.from({ length: 6 }, (_, p) => Array.from({ length: 4 }, (_, i) => sentence(p + 1, i)).join(' ')).join('\f');
  if (!(await doc())) {
    await page.evaluate(() => (location.hash = 'library'));
    await until(page, () => /PASSAGES/.test(document.querySelector('#pg-library .bigv')?.textContent ?? ''), null, 20000, '[reader] the Library never loaded');
    await openSection(page, 'library', 'Add');
    await page.setInputFiles('#pg-library input[type=file]', [{ name: `${BOOK}.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) }]);
    await until(page, (t) => document.body.innerText.includes(t), BOOK, 30000, '[reader] the book was not added');
  }
  await openSection(page, 'library', 'Shelf');
  await page.waitForTimeout(600);
  // the Library: what he found by typing is "that one"
  const find = page.locator('#pg-library input.shelffind');
  if (await find.isVisible().catch(() => false)) {
    await find.fill(BOOK.slice(0, 12));
    await page.waitForTimeout(300);
    const l = await aware(page);
    check(l?.screen === 'library' && /^the library, \d+ of his books/.test(l.line), `[reader] the Library says: ${JSON.stringify(l)}`);
    await find.fill('');
  }
  await page.locator('#pg-library .bookrow', { hasText: BOOK }).first().click();
  await until(page, () => window.__ghosty.ui.get().tab === 'reader' && window.__ghosty.reader.doc, null, 20000, '[reader] the book did not open');
  await page.waitForTimeout(900);
  let a = await aware(page);
  check(a?.screen === 'reader' && a.line.startsWith(`the reader, “${BOOK}”`) && a.selected?.kind === 'book' && a.selected.label === `“${BOOK}”`, `[reader] the open book: ${JSON.stringify(a)}`);
  check(a.words.length <= 220 && a.words.includes(BOOK), `[reader] the words: ${a?.words}`);
  // the stamp line's LOOKING AT is the same context (one source)
  const stamp = await page.evaluate(() => document.querySelector('#pg-reader .g-stamp')?.textContent ?? '');
  const want = a.looking;
  check(!!want && BOOK.startsWith(want.slice(0, 20)) && stamp.endsWith(`Looking at ${want}`), `[reader] the stamp says "${stamp}", the context says "${want}"`);
  await page.screenshot({ path: `${out}/reader-open.png` });

  // "read that one": reads it, from his place, with no model
  const calls0 = chatCalls(bodies);
  await say(page, 'read that one');
  check(await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 15000, null), `[reader] "read that one" did not start the reading (${await page.evaluate(() => window.__ghosty.reader.reading.state)}): ${await lastReply(page)}`);
  check(chatCalls(bodies) === calls0, '[reader] "read that one" went to the brain');
  check(/\.$/.test(await lastReply(page)) && new RegExp(`${BOOK.split(' ').slice(0, 3).join(' ')}`).test(await lastReply(page)), `[reader] the reply: ${await lastReply(page)}`);
  await until(page, () => window.__ghosty.reader.reading.lit >= 0, null, 8000, '[reader] no lit passage');
  a = await aware(page);
  check(a?.selected?.kind === 'passage' && a.selected.label === 'the passage being read' && /^page \d$|^\d+%$/.test(a.selected.detail ?? '') && /reading it aloud/.test(a.line), `[reader] while it reads: ${JSON.stringify(a)}`);
  await page.screenshot({ path: `${out}/reader-reading.png` });
  check(!(await wide(page)), '[fit 440] the reader sticks out sideways while it reads');
  await page.evaluate(() => window.__ghosty.run('stop_audio', {}).catch?.(() => undefined));
  await ctx.close();
}
// the reader's stamp line and the Shelf at 390 × 844: nothing sideways, the long looking-at wraps inside the screen
if (part('fit') || part('reader')) {
  const { ctx, page } = await open(SMALL, 'reader390');
  await page.evaluate(() => (location.hash = 'library'));
  await until(page, () => /PASSAGES/.test(document.querySelector('#pg-library .bigv')?.textContent ?? ''), null, 20000, '[fit 390] the Library never loaded');
  await openSection(page, 'library', 'Shelf');
  await page.locator('#pg-library .bookrow', { hasText: BOOK }).first().click().catch(() => problems.push('[fit 390] the book is not on the shelf'));
  await until(page, () => window.__ghosty.ui.get().tab === 'reader' && window.__ghosty.reader.doc, null, 20000, '[fit 390] the book did not open');
  await page.waitForTimeout(900);
  check(!(await wide(page)), '[fit 390] the reader sticks out sideways');
  const r = await page.evaluate(() => { const e = document.querySelector('#pg-reader .g-stamp'); const b = e?.getBoundingClientRect(); return b ? { right: Math.round(b.right), h: Math.round(b.height) } : null; });
  check(!!r && r.right <= SMALL.width, `[fit 390] the stamp line: ${JSON.stringify(r)}`);
  await page.screenshot({ path: `${out}/reader-390.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- 5. THE DECK, 6. THE LENS, 8. THE CORE CARD
if (part('deck') || part('core') || part('lens') || part('fit')) {
  for (const size of [PHONE, SMALL]) {
    const tag = `${size.width}`;
    const { ctx, page, bodies } = await open(size, `deck${tag}`, 'glass');
    // a screen with nothing of its own to say: Settings is described from its TabDef
    await page.evaluate(() => (location.hash = 'settings'));
    await until(page, () => window.__ghosty.ui.get().tab === 'settings', null, 10000, `[deck ${tag}] Settings did not open`);
    await page.waitForTimeout(500);
    const st = await aware(page);
    check(st?.screen === 'settings' && !!st.line && st.line.length <= 160 && st.title, `[core ${tag}] a screen with no context of its own says: ${JSON.stringify(st)}`);
    await openDeck(page);
    await until(page, () => window.__ghosty.deck?.open, null, 5000, `[deck ${tag}] the deck did not open`);
    await page.waitForTimeout(700);
    let a = await aware(page);
    check(a?.screen === 'deck' && a.line === 'the deck of every screen' && !a.selected, `[deck ${tag}] open, the deck says: ${JSON.stringify(a)}`);
    // the Core card: what I am looking at, the screen under the deck, with its mark
    const core = await page.evaluate(() => ({ look: document.querySelector('#deck .dkcard[data-id="core"] .dklook')?.textContent ?? '', state: document.querySelector('#deck .dkcard[data-id="core"] .dklook')?.dataset.state ?? '', live: document.querySelector('#deck .dkcard[data-id="core"] .dklive')?.textContent ?? '' }));
    check(core.look === `Looking at: ${st.line}` && core.state === 'working', `[core ${tag}] the Core card says "${core.look}" (${core.state}); the screen under it says "${st.line}"`);
    check(/^(Online|Offline)/.test(core.live), `[core ${tag}] the reply time line is gone: "${core.live}"`);
    await page.locator('#deck .dkcard[data-id="core"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/deck-core-${tag}.png` });
    // every card 44 pt; nothing sideways
    const cards = await page.$$eval('#deck .dkcard', (els) => els.filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, h: Math.round(r.height), right: Math.round(r.right) }; }));
    check(cards.length >= 20 && cards.every((c) => c.h >= 44 && c.right <= size.width), `[fit ${tag}] deck cards: ${JSON.stringify(cards.filter((c) => c.h < 44 || c.right > size.width))}`);
    check(!(await wide(page)), `[fit ${tag}] the deck sticks out sideways`);
    // a card opened is the selection
    await page.locator('#deck .dkcard[data-id="gym"]').click();
    await page.waitForTimeout(500);
    a = await aware(page);
    check(a?.selected?.kind === 'card' && a.selected.id === 'gym' && !!a.selected.label, `[deck ${tag}] the opened card: ${JSON.stringify(a?.selected)}`);
    check(a?.words?.length <= 220 && /selected: /.test(a?.words ?? ''), `[deck ${tag}] words: ${a?.words}`);
    // "open that one" typed in the deck's pill: opens that card with no model
    const calls0 = chatCalls(bodies);
    await page.fill('#deck .dkin', 'open that one');
    await page.waitForTimeout(250);
    check(await page.evaluate(() => !!window.__ghosty.deck.expanded), `[deck ${tag}] typing "open that one" closed the card it points at`);
    await page.press('#deck .dkin', 'Enter');
    await until(page, () => window.__ghosty.ui.get().tab === 'gym' && !window.__ghosty.deck.open, null, 8000, `[deck ${tag}] "open that one" did not open the GYM (${await page.evaluate(() => window.__ghosty.ui.get().tab)})`);
    check(chatCalls(bodies) === calls0, `[deck ${tag}] "open that one" went to the brain`);
    // with the deck closed, the screen's own context again (the deck's is not left behind)
    a = await aware(page);
    check(a?.screen === 'gym' || a?.screen !== 'deck', `[deck ${tag}] the deck's context stayed after it closed: ${JSON.stringify(a)}`);
    if (size === PHONE && part('lens')) {
      await page.evaluate(() => (location.hash = 'lens'));
      await until(page, () => window.__ghosty.lens?.mode, null, 15000, '[lens] the Lens did not open');
      // the Lens opens on its one view (BRIEF-LENS): the old modes are the row behind MORE. The one view's enter() prepends its
      // mark row to the bar, so MORE is tapped only once that row is in place and the bar has settled (on a slow runner a tap
      // placed before the shift landed on the key beside it and the row never opened: PR #70's run).
      await until(page, () => window.__ghosty.lens.mode === 'lens' && !!document.querySelector('#pg-lens .lensmark'), null, 15000, '[lens] the one view did not settle');
      await page.waitForTimeout(400);
      await page.locator('#pg-lens .lensbar button', { hasText: 'MORE' }).click();
      await until(page, () => !document.querySelector('#pg-lens .lensmodes')?.hidden, null, 5000, '[lens] MORE did not open the row of tools');
      await page.locator('#pg-lens .lensmodes button', { hasText: 'PEOPLE' }).click();
      await until(page, () => window.__ghosty.lens.mode === 'people', null, 8000, '[lens] PEOPLE did not open');
      await page.waitForTimeout(600);
      a = await aware(page);
      check(a?.screen === 'lens' && a.line === 'the Lens on PEOPLE' && !a.selected && a.words === 'On screen: the Lens on PEOPLE.', `[lens] PEOPLE says: ${JSON.stringify(a)}`);
      const before = bodies.length;
      await say(page, `what's on screen ${RUN}`);
      await page.waitForTimeout(1500);
      const body = bodies.at(before);
      check(body?.context?.screenLine === 'On screen: the Lens on PEOPLE.' && body.context.screen?.line === 'the Lens on PEOPLE', `[lens] the turn carried: ${JSON.stringify(body?.context?.screenLine)}`);
      // the other modes say counts, never who
      await closeLog(page);
      await page.locator('#pg-lens .lensmodes button', { hasText: /^SEE/ }).click();
      await page.waitForTimeout(600);
      a = await aware(page);
      check(a?.screen === 'lens' && /^the Lens in SEE mode/.test(a.line) && !/name|who|face/i.test(a.line), `[lens] SEE says: ${JSON.stringify(a)}`);
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------- 5b. EVERY SCREEN IN THE SCAN (BRIEF-SHELL-2): the inventory speaks, a number opens with no model
if (part('deck') || part('core')) {
  const { ctx, page, bodies } = await open(PHONE, 'scandeck');
  await page.evaluate(() => (location.hash = 'settings'));
  await until(page, () => window.__ghosty.ui.get().tab === 'settings', null, 10000, '[scan deck] Settings did not open');
  await page.waitForTimeout(500);
  const st = await aware(page);
  await openDeck(page);
  await until(page, () => window.__ghosty.deck?.open && document.querySelector('#deck .invrow'), null, 5000, '[scan deck] Every screen did not open as the inventory');
  await page.waitForTimeout(600);
  let a = await aware(page);
  check(a?.screen === 'deck' && a.line === 'the deck of every screen' && a.looking === 'every screen' && !a.selected, `[scan deck] open, Every screen says: ${JSON.stringify(a)}`);
  const stampSaid = await page.evaluate(() => document.querySelector('#deck .headstamp, #deck .g-stamp')?.textContent ?? '');
  check(/Looking at every screen$/i.test(stampSaid), `[scan deck] its stamp line says "${stampSaid}"`);
  check(!!st?.line, `[scan deck] Settings said nothing of itself under it: ${JSON.stringify(st)}`);
  await page.fill('#deck .dkin', 'rad');
  await page.waitForTimeout(300);
  a = await aware(page);
  check(a?.line === "the deck of every screen, searching for 'rad'", `[scan deck] typing says: ${JSON.stringify(a?.line)}`);
  // a number said in the field opens that screen with no model: "plan 4" is Radio
  const calls0 = chatCalls(bodies);
  await page.fill('#deck .dkin', 'plan 4');
  await page.press('#deck .dkin', 'Enter');
  await until(page, () => window.__ghosty.ui.get().tab === 'radio' && !window.__ghosty.deck.open, null, 8000, `[scan deck] "plan 4" did not open Radio (${await page.evaluate(() => window.__ghosty.ui.get().tab)})`);
  check(chatCalls(bodies) === calls0, '[scan deck] "plan 4" went to the brain');
  a = await aware(page);
  check(a?.screen !== 'deck', `[scan deck] the deck's context stayed after it closed: ${JSON.stringify(a)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 7b. THE LOOK's stamp
if (part('turn') || part('deck')) {
  const { ctx, page, bodies } = await open(PHONE, 'look');
  await page.evaluate(() => (location.hash = 'look'));
  await until(page, () => window.__ghosty.ui.get().tab === 'look', null, 10000, '[look] THE LOOK did not open');
  await page.waitForTimeout(800);
  const a = await aware(page);
  const stamp = await page.evaluate(() => document.querySelector('#pg-look .g-stamp')?.textContent ?? '');
  check(a?.screen === 'look' && /^the look, /.test(a.line) && !!a.looking && stamp.endsWith(`Looking at ${a.looking}`), `[look] the stamp says "${stamp}", the context says "${a?.looking}"`);
  // a question asked from the deck's pill is answered on Home, but it was asked FROM here: the turn carries this screen
  const before = bodies.length;
  await openDeck(page);
  await until(page, () => window.__ghosty.deck?.open, null, 5000, '[look] the deck did not open');
  await page.fill('#deck .dkin', `tell me about this zzq${RUN}`);
  await page.press('#deck .dkin', 'Enter');
  await page.waitForTimeout(2500);
  const body = bodies.at(before);
  check(body?.context?.screen?.screen === 'look' && /^On screen: the look, /.test(body.context.screenLine ?? ''), `[look] asked from the deck, the turn carried: ${JSON.stringify(body?.context?.screenLine)} (the screen he asked from, not Home's)`);
  await page.waitForTimeout(300);
  const home = await aware(page);
  check(home?.screen === 'core', `[look] on Home afterwards, Home says: ${JSON.stringify(home?.screen)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 11. EVERY SCREEN'S OWN SENTENCE (BRIEF-SHELL pass 1; OWNER-ISSUES 150 d)
// The screens that used to say their name and their older description now say what is open and, where they have one, what is picked:
// plain and short, never a key, never a person seen by a camera, never a plate. Every screen of the bar, the hubs and the Me sheet is
// opened and read; eight are held to their exact words.
if (part('screens')) {
  const { ctx, page } = await open(PHONE, 'screens');
  const SCREENS = ['brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'workshop', 'learn', 'gym', 'school', 'reverse', 'workbench', 'links', 'settings', 'system', 'arcade',
    'money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin', 'learning', 'coach', 'social', 'convert', 'docs', 'sheets', 'slides', 'workspace', 'house',
    'area-ask', 'area-see', 'area-make', 'area-learn', 'area-plan', 'area-life', 'area-me'];
  const said = {};
  for (const id of SCREENS) {
    await page.evaluate((t) => (location.hash = t), id);
    await until(page, (t) => document.body.dataset.tab === t, id, 8000, `[screens] ${id} did not open`);
    await page.waitForTimeout(id === 'learn' || id === 'school' || id === 'arcade' ? 900 : 450);
    const c = await aware(page);
    said[id] = c;
    check(!!c?.looking, `[screens] ${id} has no sentence of its own (the fallback said: "${c?.line}")`);
    check(c && c.line.length > 0 && c.line.length <= 160, `[screens] ${id}: the sentence is ${c?.line?.length} characters`);
    check(c && c.words.length <= 220 && !/[A-Za-z0-9_\-+/=]{32,}/.test(c.words), `[screens] ${id}: the words ride too long or carry a key: ${c?.words}`);
    check(c && !/\b(?:undefined|null|NaN|\[object)/.test(c.words), `[screens] ${id}: a broken word in "${c?.words}"`);
  }
  const L = (id) => said[id]?.line ?? '';
  check(/^the agenda, on [a-z ]+, (next: .+, (today|tomorrow|[a-z0-9 ]+) \d\d:\d\d|nothing coming up)$/i.test(L('agenda')), `[screens] the agenda says "${L('agenda')}"`);
  check(/^the markets, /.test(L('markets')) && said.markets?.looking === 'the markets', `[screens] the markets say "${L('markets')}"`);
  check(/^memory, on [a-z ]+, \d+ things I remember$/.test(L('memory')), `[screens] memory says "${L('memory')}"`);
  check(/^the gym, on .+/.test(L('gym')) && said.gym?.selected?.kind === 'item', `[screens] the gym says "${L('gym')}" ${JSON.stringify(said.gym?.selected)}`);
  check(/^settings, on appearance$/.test(L('settings')) && said.settings?.selected?.label === 'Appearance', `[screens] settings say "${L('settings')}"`);
  check(/^links, on accounts$/.test(L('links')), `[screens] links say "${L('links')}"`);
  check(/^the money screen, open on statement$/.test(L('money')) && said.money?.selected?.kind === 'group', `[screens] money says "${L('money')}"`);
  check(/^the make hub, 8 things to open$/.test(L('area-make')) && /^the learn hub, 8 things to open$/.test(L('area-learn')), `[screens] the hubs say "${L('area-make')}" and "${L('area-learn')}"`);
  check(/^the body screen, open on reps/.test(L('body')), `[screens] body says "${L('body')}"`);
  // a sheet screen follows its pill, and says which one
  await page.evaluate(() => (location.hash = 'body'));
  await page.waitForTimeout(500);
  await openSection(page, 'body', 'Water');
  const water = await aware(page);
  check(/^the body screen, open on water/.test(water?.line ?? '') && water.selected?.label === 'Water', `[screens] body on its Water pill says "${water?.line}"`);
  // the people screen never says a name, the Lens never says who: counts and the open page only
  await page.evaluate(() => (location.hash = 'people'));
  await page.waitForTimeout(500);
  const ppl = await aware(page);
  check(/^the people screen, open on your people$/.test(ppl?.line ?? ''), `[screens] people says "${ppl?.line}"`);
  // Home says what it is looking at, in the one place the stamp line reads
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  const hc = await aware(page);
  check(hc?.looking === 'Home' && /^the home screen/.test(hc.line), `[screens] Home says ${JSON.stringify([hc?.looking, hc?.line])}`);
  await page.screenshot({ path: `${out}/awareness-screens.png` });
  measured.screens = Object.fromEntries(Object.entries(said).map(([k, v]) => [k, v?.line]));
  await ctx.close();
}

await browser.close();
console.log(`measured: ${JSON.stringify(measured)}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('awareness: ok');
