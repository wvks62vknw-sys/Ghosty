// QUALITY PASS: HOME (BRIEF-QUALITY-HOME): the first screen and the line that holds the house, measured and made right, nothing new
// added. One check for each fix, named for the rough spot it closes, grouped Home · THE BRIEF · the house line · the boot and the orb,
// at 440 × 956 and 390 × 844, in THE SCAN (the world he lives in), against the preview's real brain, with the brain's silence, its
// slowness and a failed send stood in by routes the checks put up. The pure words (the greeting, the spoken Brief's length, the pill,
// the nearest room, the rooms' lines) are read from the very source files the page is built from.
// Stills (440 only), before and after a fix pass: HOME_STILL=before|after names them tests/.shots/homepass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8829 NO_GL_SHOTS=1 node tests/homepass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.HOME_STILL ?? 'after';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 240)}`);
  }
};
const on = (k) => !process.env.HP_ONLY || process.env.HP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|PROBLEM/i;
const DASH = /^\s*[—–-]\s*$/;
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}

// ================================================================ the words, read from the source (once)
{
  log('pure words');
  const day = await pure('apps/web/src/features/brief/day.ts');
  const at = (h) => new Date(2026, 10, 12, h, 0, 0);
  // THE BRIEF · greeting true to the hour (6 am, noon, 11 pm, and the small hours)
  check(day.greeting(at(6)) === 'Good morning' && day.greeting(at(12)) === 'Good afternoon' && day.greeting(at(23)) === 'Good evening' && day.greeting(at(3)) === 'Good night',
    `[brief greeting] 6 am "${day.greeting(at(6))}", noon "${day.greeting(at(12))}", 11 pm "${day.greeting(at(23))}", 3 am "${day.greeting(at(3))}" (want morning, afternoon, evening, night: the boot says the same)`);
  // THE BRIEF · read in under a minute at the voice's pace (150 words a minute), measured from the words' length
  const long = Array.from({ length: 6 }, (_, i) => `Headline number ${i + 1} is rather a long one and it keeps going for quite a few words to test the limit`);
  const line = 'Light rain, 9 degrees, 4 to 11°C today, rain likely from 15:00. 3 things today, first Dentist at 09:30. 24 min to work, 6 min of it traffic.';
  const said = day.spoken(at(7), line, long);
  const secs = (words(said) / 150) * 60;
  check(secs <= 60 && /Dentist/.test(said) && /The headlines\./.test(said), `[brief length] read aloud it is ${words(said)} words, ${secs.toFixed(0)} s at 150 words a minute (want 60 s or under, the day kept, a headline or more)`);
  const none = day.spoken(at(7), 'Dry for the rest of today.', ['One short story.']);
  check((words(none) / 150) * 60 < 20, `[brief length] a short Brief takes ${words(none)} words`);
  // HOME · the pill cut at a word, never in the middle of one
  const pill = await pure('apps/web/src/features/core/pill.ts');
  const p1 = pill.pillWords('Waking the brain on this phone. Twenty seconds or so.');
  const whole = 'WAKING THE BRAIN ON THIS PHONE. TWENTY SECONDS OR SO.';
  check(p1.length <= 41 && p1.endsWith('…') && whole.startsWith(p1.slice(0, -1)) && /[A-Z]$/.test(p1.slice(0, -1)) && whole[p1.length - 1] === ' ', `[pill] a long status reads "${p1}" (want it cut between words, with an ellipsis, 40 letters at most)`);
  check(pill.pillWords('thinking…') === 'THINKING…', `[pill] a short status reads "${pill.pillWords('thinking…')}"`);
  // THE HOUSE LINE · the nearest room
  const near = await pure('apps/web/src/shell/near.ts');
  check(near.nearestRoom('gyn')?.screen === 'gym' && near.nearestRoom('radoi')?.screen === 'radio' && near.nearestRoom('gsdfg') === null, `[jump nearest] gyn → ${near.nearestRoom('gyn')?.screen}, radoi → ${near.nearestRoom('radoi')?.screen}, gsdfg → ${near.nearestRoom('gsdfg')?.screen ?? 'nothing (a wild guess is never offered)'}`);
  // THE HOUSE LINE · the seven rooms' lines, one sentence each
  const defs = await pure('apps/web/src/shell/areadefs.ts');
  const bad = defs.AREAS.filter((a) => /;|:/.test(a.sub) || (a.sub.match(/[.!?](\s|$)/g) ?? []).length !== 1 || words(a.sub) > 20).map((a) => a.id);
  check(defs.AREAS.length === 7 && !bad.length, `[rooms' lines] every room's line is one sentence of 20 words or fewer, no semicolon or colon: ${bad.join(', ') || 'all seven are'}`);
}

// THE BOOT'S FAULT and the Every screen deck's empty search: my voice, read from the files that draw them (neither can be made to happen on a healthy preview)
{
  const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
  // (BRIEF-QUALITY-BOOT-ORB moved the words to shell/bootwords.ts, with the next thing after them; the check reads them there and that boot.ts says them from there: stronger, it also asks for "Tap to try again.")
  check(src('shell/bootwords.ts').includes('I couldn’t start this time. Tap to try again.') && src('shell/boot.ts').includes('FAULT_WORDS') && !/Ghosty couldn’t start/.test(src('shell/boot.ts') + src('shell/bootwords.ts')), '[boot: the fault] the boot’s fault words are not in my voice ("I couldn’t start this time. Tap to try again.")');
  const rate = src('features/core/rate.ts');
  const site = src('features/core/sitecard.ts');
  check(!/Ghosty will learn|Couldn't send that rating/.test(rate) && rate.includes('I’ll learn a better answer to that in my weekly training.') && !/Not connected yet —/.test(site) && site.includes('I can’t reach my brain yet.'), '[home: reply cards’ words] the rating and PUBLISH toasts are not in my voice');
  check(src('shell/launcher.ts').includes('Press return and I’ll answer it.') && !/Ghosty will answer/.test(src('shell/launcher.ts')), '[deck: nothing found] the deck’s empty search is not in my voice');
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });

/** One phone. `dead`: the brain answers nothing. `slow`: every call to the brain takes this long. `hour`: the clock reads this hour. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: o.still ? 2 : 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, hour, offline }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (offline) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    if (hour !== undefined) {
      // the clock reads this hour today and keeps going (the page's own timers stay real)
      const Real = Date;
      const d = new Real();
      d.setHours(hour, 5, 0, 0);
      const off = d.getTime() - Real.now();
      globalThis.Date = class extends Real {
        constructor(...a) {
          super(...(a.length ? a : [Real.now() + off]));
        }
        static now() {
          return Real.now() + off;
        }
      };
    }
    // every waiting line, as it came (ui/wait.ts)
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
    // the phone's voice, heard as nothing: it holds the words until it is told to stop
    window.__said = [];
    window.__stopped = 0;
    if ('speechSynthesis' in window) {
      let cur = null;
      speechSynthesis.speak = (u) => (window.__said.push(u.text), (cur = u));
      speechSynthesis.cancel = () => { window.__stopped++; const u = cur; cur = null; setTimeout(() => u?.onend?.(new Event('end')), 5); };
    }
  }, { key: KEY, body: o.body ?? 0, hour: o.hour, offline: o.offline });
  if (o.dead) await page.route('**/api/**', (r) => r.abort('failed'));
  else if (o.slow) await page.route(/\/api\/(status|library|school|health|agenda|highways|mind)/, async (r) => { await new Promise((s) => setTimeout(s, o.slow)); r.continue().catch(() => undefined); });
  await page.route(/\/api\/tts$/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no voice here"}' }));
  // (a send that fails with no copy of the library on the phone to answer from: the error card is what he sees)
  if (o.chatDown) await page.route(/\/api\/library/, (r) => r.abort('failed'));
  if (o.chatDown) await page.route(/\/api\/chat$/, (r) => ((o.sent = (o.sent ?? 0) + 1), r.abort('failed')));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(o.settle ?? 1800);
  return { ctx, page, o };
}
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const small = (page, sel) => page.$$eval(sel, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => { const r = e.getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 22)}" ${Math.round(r.width)}×${Math.round(r.height)}`; })
  .filter(Boolean).slice(0, 5));
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const still = (page, name, vp) => (vp.width === 440 ? page.screenshot({ path: `${out}/homepass-${name}-440-${STILL}.png` }).catch(() => undefined) : undefined);
const openDay = async (page) => { if (await page.locator('.scandaykey').count()) await page.evaluate(() => { const k = document.querySelector('.scandaykey'); if (k?.getAttribute('aria-expanded') !== 'true') k.click(); }); await page.waitForTimeout(300); };

for (const vp of [PHONE, PHONE2]) {
  const W = vp.width;
  log(`${W}: Home, the brain live`);
  // ============================================================ HOME, the brain live
  if (on('live')) {
    const { ctx, page } = await phone(vp, { still: true });
    await openDay(page);
    await page.waitForTimeout(1200);
    const co = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.rcco')].map((e) => [e.className.split(' ')[1], { v: e.querySelector('.v')?.textContent ?? '', s: e.querySelector('.s')?.textContent ?? '', hidden: e.hidden }])));
    check(Object.values(co).every((c) => c.hidden || !DASH.test(c.v)), `[${W}] [home: never a dash] an instrument shows a dash: ${JSON.stringify(co)}`);
    const today = await txt(page, '.rctoday .rcevs');
    check(/^Nothing in your diary today\. Tell me one thing and I’ll keep it\.$/.test(today) && (await page.locator('.rctoday [data-state="empty"]').count()) === 1, `[${W}] [home: today's empty line] reads "${today}" (want the one next thing)`);
    check((await page.locator('.rcdead:not([hidden])').count()) === 0, `[${W}] [home: the dead-brain line] stands on Home with the brain live`);
    const ps = await page.evaluate(() => ({ t: document.querySelector('#cstate')?.textContent, s: document.querySelector('#cstate')?.dataset.state }));
    check(ps.t === 'ONLINE' && ps.s === 'ready', `[${W}] [home: the pill] one state, reads "${ps.t}" / ${ps.s} (want ONLINE / ready)`);
    // every Home line at most 20 words
    const longLines = await page.evaluate(() => [...document.querySelectorAll('.rcwx, .rctoday .nm, .rcdead, .scansay, .scansay2, .rcroad .rdwhy, .rcgym .rdclr, .rcco .s')].map((e) => (e.textContent ?? '').trim()).filter((t) => t.split(/\s+/).length > 20));
    check(!longLines.length, `[${W}] [home: words] a line is over 20 words: ${longLines[0]}`);
    // the controls on Home
    const sm = await small(page, '.scancol button, #suggest .sugg, .scanday button, #dock .housebtn, #dock .housefield, #dock .housemic, #dock .tabcap button, .scanalt, #cin, #mic');
    check(!sm.length, `[${W}] [home: 44 pt] under 44 pt: ${sm.join(', ')}`);
    check(!(await sideways(page)), `[${W}] [home: sideways]`);
    await still(page, 'home-noon', vp);
    await ctx.close();
  }
  // ============================================================ HOME, the brain silent
  if (on('silent')) {
    log(`${W}: Home, the brain silent`);
    const { ctx, page } = await phone(vp, { dead: true, settle: 2600 });
    await openDay(page);
    const t = await page.evaluate(() => ({
      dead: [...document.querySelectorAll('.rcdead:not([hidden])')].map((e) => e.textContent),
      subs: [...document.querySelectorAll('.rcco')].filter((e) => !e.hidden).map((e) => `${e.querySelector('.k')?.textContent}: ${e.querySelector('.v')?.textContent ?? ''} / ${e.querySelector('.s')?.textContent ?? ''}`),
      wx: document.querySelector('.rcwx')?.textContent, today: document.querySelector('.rctoday .rcevs')?.textContent, road: document.querySelector('.rcroad .rcbody')?.textContent,
      pill: [document.querySelector('#cstate')?.textContent, document.querySelector('#cstate')?.dataset.state],
    }));
    check(t.dead.length === 1 && /^My brain isn’t answering just now\. What I keep on this phone still shows\.$/.test(t.dead[0]), `[${W}] [home: the dead brain said once] ${JSON.stringify(t.dead)} (want one line)`);
    const brainWords = t.subs.filter((s) => /brain (offline|unreachable)|can’t be read|unavailable/i.test(s));
    check(!brainWords.length && !/brain/i.test(`${t.road} ${t.today}`), `[${W}] [home: not once per instrument] the instruments still say it: ${brainWords.join(' | ')} ${t.road} ${t.today}`);
    check(t.subs.every((s) => !/: — \//.test(s) && !/^\S+: — /.test(s)), `[${W}] [home: never a dash] ${t.subs.join(' | ')}`);
    check(t.subs.some((s) => /^Free AI: {1,2}\/ I haven’t asked my brain yet$/.test(s)), `[${W}] [home: no quota known] ${t.subs.join(' | ')} (want "I haven’t asked my brain yet")`);
    check(t.subs.some((s) => /^Uplink: Off\/? ?\/ (No signal|Not answering)$/.test(s) || /^Uplink: Off \/ (No signal|Not answering)$/.test(s)), `[${W}] [home: the uplink's words] ${t.subs.join(' | ')}`);
    check(/^I can’t get the weather just now\.$/.test(t.wx ?? ''), `[${W}] [home: the weather's words] "${t.wx}"`);
    check(/I can’t read your diary just now\./.test(t.today ?? '') && /I can’t reach the traffic feed\./.test(t.road ?? ''), `[${W}] [home: the diary's and the roads' words] "${t.today}" / "${t.road}"`);
    check(t.pill[0] === 'OFFLINE' && t.pill[1] === 'offline', `[${W}] [home: the pill, brain gone] ${t.pill.join(' / ')}`);
    check(!(await sideways(page)), `[${W}] [home: sideways, brain silent]`);
    await still(page, 'home-dead', vp);
    await ctx.close();
  }
  // ============================================================ HOME, no signal at all
  if (on('nosignal')) {
    const { ctx, page } = await phone(vp, { dead: true, offline: true, settle: 2600 });
    const dead = await txt(page, '.rcdead:not([hidden])');
    check(/^No signal\. What you type waits here until the phone is back online\.$/.test(dead), `[${W}] [home: no signal] reads "${dead}"`);
    await ctx.close();
  }
  // ============================================================ HOME, the brain slow: every wait said
  if (on('slow')) {
    const { ctx, page } = await phone(vp, { slow: 900, settle: 100 });
    await page.waitForTimeout(2600);
    const w = await page.evaluate(() => window.__waits);
    const want = ['Asking my brain how much free AI is left…', 'Counting what the library holds…', 'Looking up where you are at school…', 'Timing the line to my brain…', 'Reading what is left in your diary…', 'Looking for incidents near home…'];
    const missing = want.filter((x) => !w.includes(x));
    check(!missing.length, `[${W}] [home: every fetch waits in words] never said: ${missing.join(' | ')} (said: ${[...new Set(w)].join(' | ').slice(0, 200)})`);
    await ctx.close();
  }
  // ============================================================ HOME, a send that fails: his words and RETRY
  if (on('send')) {
    log(`${W}: the failed send`);
    const o = { chatDown: true };
    const { ctx, page } = await phone(vp, o);
    await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForSelector('#cin', { state: 'visible' }).catch(() => problems.push(`[${W}] the ask bar did not open`));
    await page.fill('#cin', 'hello there friend');
    await page.press('#cin', 'Enter');
    const shown = await until(page, () => !!document.querySelector('.msg.err button.retry'), null, 8000);
    if (!shown) console.log('  (log:', await page.evaluate(() => [...document.querySelectorAll('.log .msg')].map((m) => `${m.className}: ${m.textContent.slice(0, 120)}`)), ')');
    const err = await page.evaluate(() => ({ label: document.querySelector('.msg.err small')?.textContent, text: document.querySelector('.msg.err span')?.textContent, retry: document.querySelector('.msg.err button.retry')?.textContent, h: Math.round(document.querySelector('.msg.err button.retry')?.getBoundingClientRect().height ?? 0), w: Math.round(document.querySelector('.msg.err button.retry')?.getBoundingClientRect().width ?? 0), state: document.querySelector('.msg.err')?.dataset.state }));
    check(shown && /^RETRY$/i.test(err.retry ?? '') && err.h >= 44 && err.w >= 44 && err.label !== 'PROBLEM' && !RAW.test(`${err.label} ${err.text}`) && err.state === 'error', `[${W}] [home: the failed send] ${JSON.stringify(err)} (want his words, no PROBLEM, RETRY at 44 pt)`);
    const before = o.sent ?? 0;
    await page.locator('.msg.err button.retry').last().click().catch(() => undefined);
    await until(page, () => true, null, 100);
    await page.waitForTimeout(1200);
    check((o.sent ?? 0) > before, `[${W}] [home: RETRY] sends the same words again (${before} sends, then ${o.sent})`);
    await ctx.close();
  }
  // ============================================================ HOME at 6 am, noon and 11 pm: the greeting true to the hour
  for (const [hour, want] of on('hours') ? [[6, 'Good morning'], [12, 'Good afternoon'], [23, 'Good evening']] : []) {
    const { ctx, page } = await phone(vp, { hour, still: hour === 6 || hour === 23 });
    const say = await txt(page, '.scansay');
    check(say === `${want}, Tony.`, `[${W}] [home at ${hour}] the greeting reads "${say}" (want "${want}, Tony.")`);
    if (hour !== 12) await still(page, `home-${hour === 6 ? '6am' : '11pm'}`, vp);
    await ctx.close();
  }
}

// ================================================================ THE BRIEF
for (const vp of on('brief') ? [PHONE, PHONE2] : []) {
  const W = vp.width;
  log(`${W}: THE BRIEF`);
  const { ctx, page } = await phone(vp, { still: true });
  await page.evaluate(() => (location.hash = 'brief'));
  await until(page, () => document.body.dataset.tab === 'brief' && !!document.querySelector('.brdate')?.textContent, null, 12000);
  await page.waitForTimeout(2500);
  const b = await page.evaluate(() => ({ date: document.querySelector('.brdate')?.textContent, rain: [...document.querySelectorAll('#pg-brief .wx .rw')].map((r) => r.textContent).find((t) => /^(RAIN|TONIGHT)/i.test(t.trim())) ?? '', src: document.querySelector('#pg-brief .pn.wx h3')?.textContent ?? '', tabs: [...document.querySelectorAll('#pg-brief .pn.news .tabs button')].map((x) => `${x.textContent}:${Math.round(x.getBoundingClientRect().height)}`), hr: new Date().getHours() }));
  const want = b.hr < 5 ? 'Good night' : b.hr < 12 ? 'Good morning' : b.hr < 18 ? 'Good afternoon' : 'Good evening';
  check(b.date?.startsWith(`${want} ·`), `[${W}] [brief: greeting] reads "${b.date}" (want ${want})`);
  // (the rain line is RAIN by day, TONIGHT from 18:00; where it is from, with the time it was read, is the weather card's status)
  check(/^(RAIN|TONIGHT)\S/i.test(b.rain.trim()) && /OPEN-METEO · \d\d:\d\d/i.test(b.src), `[${W}] [brief: the rain line, and the card says where it is from and when] "${b.rain}" / "${b.src}"`);
  check(b.tabs.length === 5 && b.tabs.every((x) => Number(x.split(':')[1]) >= 44) && b.tabs[0].startsWith('TOP STORIES'), `[${W}] [brief: sections] ${b.tabs.join(', ')} (want 44 pt, the first "TOP STORIES")`);
  // READ IT TO ME: stopped with one tap, at 44 pt
  await page.evaluate(() => document.querySelector('#pg-brief .brread')?.scrollIntoView({ block: 'center' }));
  const r0 = await page.evaluate(() => { const r = document.querySelector('#pg-brief .brread').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  await page.click('#pg-brief .brread');
  await page.waitForTimeout(400);
  const r1 = await page.evaluate(() => ({ label: document.querySelector('#pg-brief .brread').textContent, aria: document.querySelector('#pg-brief .brread').getAttribute('aria-label'), said: window.__said.join(' ') }));
  await page.click('#pg-brief .brread');
  await page.waitForTimeout(500);
  const r2 = await page.evaluate(() => ({ label: document.querySelector('#pg-brief .brread').textContent, aria: document.querySelector('#pg-brief .brread').getAttribute('aria-label'), stopped: window.__stopped }));
  check(r0[0] >= 44 && r0[1] >= 44 && r1.label === 'STOP' && r1.aria === 'Stop reading' && r2.label === 'READ IT TO ME' && !r2.aria && r2.stopped >= 1 && words(r1.said) / 150 * 60 <= 60, `[${W}] [brief: read it to me] ${JSON.stringify({ r0, r1: { ...r1, said: words(r1.said) }, r2 })} (want STOP with one tap off, 44 pt, under a minute)`);
  const sm = await small(page, '#pg-brief button');
  check(!sm.length, `[${W}] [brief: 44 pt] under 44 pt: ${sm.join(', ')}`);
  check(!(await sideways(page)), `[${W}] [brief: sideways]`);
  await page.evaluate(() => document.querySelector('#pg-brief')?.scrollTo?.(0, 0));
  await still(page, 'brief', vp);
  await ctx.close();
  // the feeds gone: the line is never a blank
  const d = await phone(vp, { dead: true, settle: 800 });
  await d.page.evaluate(() => (location.hash = 'brief'));
  await until(d.page, () => document.body.dataset.tab === 'brief', null, 12000);
  await until(d.page, () => /I can’t reach the weather or your diary yet/.test(document.querySelector('.brsay')?.textContent ?? ''), null, 8000);
  const say = await txt(d.page, '.brsay');
  check(/^I can’t reach the weather or your diary yet\. This fills in when I can\.$/.test(say) && (await d.page.locator('.brsay[data-state="empty"]').count()) === 1, `[${W}] [brief: nothing to say yet] the line reads "${say}"`);
  const day = await txt(d.page, '.brday .rw');
  check(/can’t be reached/.test(day) && (await d.page.locator('.brday').count()) === 1, `[${W}] [brief: the diary down] "${day}"`);
  await d.ctx.close();
}

// ================================================================ THE HOUSE LINE
for (const vp of on('house') ? [PHONE, PHONE2] : []) {
  const W = vp.width;
  log(`${W}: the house line`);
  const { ctx, page } = await phone(vp, { still: true });
  // THE PLAN: the amber dot said once, every key 44 pt, nothing sideways
  await page.click('#dock .housebtn, .scankickkey');
  await page.waitForSelector('#plan', { timeout: 5000 });
  const pl = await page.evaluate(() => ({ legend: [...document.querySelectorAll('#plan .planlegend')].map((e) => e.textContent), dots: document.querySelectorAll('#plan .planthing .ptdot').length, stars: document.querySelectorAll('#plan .ptmark').length }));
  check(pl.legend.length === 1 && /^Amber: in the works$/.test(pl.legend[0]) && pl.dots >= 1, `[${W}] [plan: amber] ${JSON.stringify(pl)} (want "Amber: in the works" once, with the dots there)`);
  const psm = await small(page, '#plan button');
  check(!psm.length, `[${W}] [plan: keys 44 pt] under 44 pt: ${psm.join(', ')}`);
  check(!(await sideways(page)), `[${W}] [plan: sideways]`);
  await still(page, 'plan', vp);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // YOU ARE IN follows the screen he is on (three rooms, one after another)
  for (const [hash, room] of [['gym', 'LEARN'], ['radio', 'PLAN'], ['memory', 'ME'], ['core', 'HOME']]) {
    await page.evaluate((t) => (location.hash = t), hash);
    await until(page, (t) => document.body.dataset.tab === t, hash, 8000);
    await page.waitForTimeout(500);
    const w = await page.evaluate(() => document.querySelector('#dock .housewhere')?.textContent ?? document.querySelector('.scankick span:last-child')?.textContent ?? '');
    check(hash === 'core' ? /^You are (home|in HOME|out|on the way)/i.test(w) : w === `You are in ${room}`, `[${W}] [house: you are in] on ${hash} the line reads "${w}" (want You are in ${room})`);
  }
  // THE JUMP BAR: first use, a word that matches nothing (the nearest room offered), a number
  await page.evaluate(() => (location.hash = 'area-learn'));
  await until(page, () => document.body.dataset.tab === 'area-learn', null, 8000);
  await page.click('#dock .housefield');
  await page.waitForSelector('#palette.scanjump .jgroup', { timeout: 5000 }).catch(() => problems.push(`[${W}] the jump bar did not open`));
  await page.keyboard.type('gsdfg');
  await page.waitForTimeout(700);
  const j = await page.evaluate(() => ({ none: [...document.querySelectorAll('#palette .jnone')].map((e) => e.textContent), near: [...document.querySelectorAll('#palette .jnear')].map((e) => e.textContent), ask: document.querySelector('#palette .jask')?.textContent ?? '', h: Math.round(document.querySelector('#palette .jnear')?.getBoundingClientRect().height ?? 0), state: document.querySelector('#palette .jnone')?.dataset.state }));
  check(j.none.length === 1 && j.none[0] === 'Nothing matches that.' && j.state === 'error' && j.near.length === 1 && /Every screen/.test(j.near[0]) && j.h >= 44, `[${W}] [jump: nothing matches] ${JSON.stringify(j)} (want the line once, the way to every screen, 44 pt)`);
  check(/Or ask me: “gsdfg” goes to me as a question$/.test(j.ask) && !/\.\.\./.test(j.ask), `[${W}] [jump: the ask row] "${j.ask}" (want no stray dots on a short word)`);
  await still(page, 'jump', vp);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('2');
  await page.waitForTimeout(700);
  const two = await page.evaluate(() => ({ n: document.querySelector('#palette .jplate')?.dataset.n ?? '', screen: document.querySelector('#palette .jplate')?.dataset.screen ?? '' }));
  check(two.n === '2' && two.screen === 'arcade', `[${W}] [jump: a number] "2" in LEARN finds ${JSON.stringify(two)} (want 02, Games)`);
  await page.evaluate(() => document.querySelector('#palette .pcancel')?.click());
  await page.waitForTimeout(300);
  await ctx.close();
  // first use: nothing pinned, nothing opened: one line of his
  const f = await phone(vp, { settle: 300 });
  await f.page.evaluate(() => (location.hash = 'area-learn'));
  await until(f.page, () => document.body.dataset.tab === 'area-learn', null, 8000);
  await f.page.click('#dock .housefield');
  await f.page.waitForSelector('#palette.scanjump .jgroup', { timeout: 5000 }).catch(() => undefined);
  const first = await f.page.evaluate(() => [...document.querySelectorAll('#palette .jempty')].map((e) => ({ t: e.textContent, s: e.dataset.state })));
  if (first.length) check(first.length === 1 && first[0].s === 'empty' && /^Hold any thing to pin it, and the last ones you open wait here\.$/.test(first[0].t), `[${W}] [jump: first use] ${JSON.stringify(first)}`);
  await f.ctx.close();
}

// ================================================================ THE BOOT AND THE ORB
if (on('boot')) {
  log('the boot and the orb');
  // the orb: from the first press the house line is said once, in one line, and not again (BRIEF-QUALITY-BOOT-ORB: the HOME pass left "after
  // the tenth press" as a question; decided there, first press, once). Stronger than the tenth-press check: the line is not said before any
  // press, is said on the first, and a second and a third press say nothing more (the hint is hidden again once it has left).
  const { ctx, page } = await phone(PHONE, { settle: 1500 });
  await page.evaluate(() => localStorage.removeItem('ghosty.orbpresses'));
  const orb = page.locator('.scanorb');
  const hint = () => page.evaluate(() => { const e = document.querySelector('.scanorbhint'); return { shown: !!e && !e.hidden, text: e?.textContent ?? '' }; });
  const before = await hint();
  await orb.dispatchEvent('click');
  const first = await hint();
  await page.evaluate(() => { const e = document.querySelector('.scanorbhint'); if (e) e.hidden = true; });
  await orb.dispatchEvent('click');
  const second = await hint();
  await orb.dispatchEvent('click');
  const third = await hint();
  await page.waitForTimeout(200);
  check(!before.shown && first.shown && !second.shown && !third.shown && /^The house line below reaches every room\.$/.test(first.text), `[orb: the first press] before ${JSON.stringify(before)}, first ${JSON.stringify(first)}, second ${JSON.stringify(second)}, third ${JSON.stringify(third)} (want the line said at the first press, once)`);
  await ctx.close();
}
await browser.close();
console.log(`(homepass spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`HOME pass run clean: ${checks} checks at 440 and 390: the brain's silence said once, every instrument its own words, every wait said, a failed send with RETRY, THE BRIEF true to the hour and read in under a minute, the plan's amber said, the jump bar's nothing-matches with a way on, the orb's line, nothing sideways, every control 44 pt.`);
