// The boot cinematic (apps/web/src/shell/boot.ts; docs/build-plan/BRIEF-ORB-AND-BOOT.md and its storyboard,
// docs/build-plan/mockups/boot/2026-11-07/cut.js): the orb waking on the ground, in the world, in his colour, on the iPhone 18
// Pro Max's 440 × 956 with software WebGL (SwiftShader, as tests/hero.spec.mjs runs MIND). Checks, each of which fails on the
// boot before it (point → gather → sphere → name → greeting → land, 3.9 s, no stamp, no feeds, no recognition):
//   1. the full cinematic: the storyboard's cut (2,880 ms to a usable Home: under three seconds), its frames come in order
//      (ground, floor, orb, stamp, feeds, recognise, greeting, land) each at its time within tolerance (the slowest frame
//      gap, as a phase is only seen on a drawn frame), its own part is over when the cut says (plus what the app underneath
//      needed), the frame budget is in __bootState and honest (the display's rate, a long frame's limit, every long frame
//      counted), every word on it is true of its moment: the stamp line's words are the real facts (today's date in his
//      format, the clock's time, his saved place, the feeds' state), the feeds' lines come only for feeds that really
//      answered and say WATCHING n FEEDS when they have, the only numbers on it are theirs, the recognition's box lands on
//      the orb (the tone under the sound rules: none on a cold open until a tap), G H O S T Y, TAP TO SKIP small, the
//      greeting is his ("Good evening, Tony."), not spoken on a cold open until the first tap (and then, once), the app
//      booted underneath (Home was there before it ended), it lands on Home's real MIND: the same canvas, in the hero's box
//      to the pixel, three.js loaded once; the HUD stays out of sight while Mind flies and slides in a beat after it lands;
//   2. a tap skips it, on a cold open and at every stage of a replay (ground, floor, orb, stamp, feeds, recognise, greeting,
//      land), landing cleanly each time (on the hero to the pixel, the HUD back, no greeting after the tap);
//   3. every cold open plays it: a second cold open (a reload: a new page) plays the full cinematic again, while a
//      resume (coming back to the running app, or a page restored from the back-forward cache) and a deep link play
//      only Mind's breath;
//   4. Reduce Motion: the two-frame version, nothing moves, 1.2 s;  5. "reboot" plays it again over Home (and SYSTEM has the
//      line), the greeting spoken at once, once, the recognition's tone heard (he has tapped);  6. a phone that cannot keep
//      up: long frames counted and the cinematic shortened (the short version chosen, or the full cut leaning mid-flight);
//      7. automated checks (no flag) see no cinematic at all.
// It also photographs each moment (the cinematic stepped by hand), checks what those moments draw (the floor forming, the
// stamp typing with its cursor, the feeds' lines, the box on the orb, the name, the greeting), and prints the timings.
//   BASE=http://localhost:8875 node tests/boot.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const timings = [];
const KEY = 'preview-owner-key-0123456789';
// The library the brain reports (as tests/hero.spec.mjs stubs it): 4,186 passages over five fields, so the constellation
// MIND wakes into is the size of a real one (the preview's own library is a handful of passages).
const LIB = { docs: [], stats: { docs: 12, passages: 4186, chars: 0, bytes: 0, vectors: 0 }, starterReady: true, vectors: false };
const FIELDS = [['Algorithms', 120, 60], ['Calculus', 80, 20], ['World history', 60, 0], ['Chemistry', 50, 50], ['Psychology', 40, 10]].map(([name, topics, read]) => ({ id: name.toLowerCase(), name, topics, read, digested: 0, focus: false }));
const STUDY = { on: false, i: 0, gaps: [], sessions: 0, focus: [], summary: { topics: 350, read: 140, digested: 0, domains: FIELDS, levels: [], today: { reads: 0, digests: 0, drills: 0, ai: 0 }, drills: { asked: 0, right: 0, skills: [] }, pending: 0 } };
async function stubLibrary(page) {
  await page.route('**/api/library', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIB) }) : r.continue()));
  await page.route('**/api/library/study', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDY) }) : r.continue()));
}

/** A phone opened on Ghosty, signed in already (no pairing form), his name Tony and the voice on. */
async function open({ reducedMotion = 'no-preference', flag = true, kind = '', lean = false, manual = false, hero = true } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, flag, kind, lean, manual, hero }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: true }));
    if (hero) window.__ghostyHero = true; // MIND draws (automated checks otherwise get the 2-D reactor: mind.ts)
    if (flag) window.__ghostyBoot = true; // this check wants the cinematic (others never see it: boot.ts)
    if (kind) window.__ghostyBootKind = kind; // software WebGL is slow: keep the full version, as the phone plays it
    if (lean) window.__ghostyBootLean = true; // ...but let it lean mid-flight, as a phone that cannot keep up would
    if (manual) window.__ghostyBootManual = true;
    // The phone's rule on a cold open: no sound or speech until a real tap. (Playwright's own page.evaluate counts as
    // a user gesture in Chromium, so the page is told only about real taps, as iOS would see them.)
    window.__tapped = false;
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, (e) => e.isTrusted && (window.__tapped = true), true);
    try {
      Object.defineProperty(Navigator.prototype, 'userActivation', { configurable: true, get: () => ({ get hasBeenActive() { return window.__tapped; }, get isActive() { return false; } }) });
    } catch { /* left as it is */ }
    // what the phone was asked to say (his voice, or the phone's own when his is not set up)
    window.__utter = [];
    try {
      const sp = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (u) => (window.__utter.push(u.text), sp(u));
    } catch { /* no speech here */ }
    // what the overlay showed, sampled every frame: its words, whether anything moved, and the HUD while Mind flew
    window.__seen = { texts: new Set(), digits: [], moved: [], old: [], hudInFlight: 0 };
    // what the page played (the recognition's tone under the sound rules)
    window.__sfx = [];
    document.addEventListener('ghosty-sfx', (e) => window.__sfx.push(e.detail));
    const look = () => {
      const b = document.getElementById('boot');
      if (b) {
        const t = (b.innerText || '').trim();
        if (t) window.__seen.texts.add(t.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n'));
        // a number belongs to the stamp line and the feeds' lines (their facts) and nowhere else
        const outside = [...b.querySelectorAll('*')].filter((x) => !x.closest('.bstamp, .bfeeds') && !x.querySelector('.bstamp, .bfeeds') && x.childElementCount === 0 && /\d/.test(x.textContent || '')).map((x) => x.textContent);
        if (outside.length) window.__seen.digits.push(outside.join(' | '));
        if (b.querySelector('.ring, .log') || /INITIALIS/i.test(b.textContent || '')) window.__seen.old.push(b.innerHTML.slice(0, 120));
        const c = b.querySelector('canvas.mindhero');
        const ct = c && getComputedStyle(c).transform;
        if (ct && ct !== 'none') window.__seen.moved.push(`mind ${ct}`);
        const g = b.querySelector('.bgreet');
        const gt = g && g.style.transform;
        if (gt && !/translateY\(0(px)?\)/.test(gt)) window.__seen.moved.push(`greeting ${gt}`);
        const d = b.querySelector('.bdot');
        const dt = d && d.style.transform;
        if (dt && !/scale\(1(\.000)?\)/.test(dt)) window.__seen.moved.push(`point ${dt}`);
        // the box lands where it lands (no Web Animation), the stamp shows whole (no cursor writing)
        const lk = b.querySelector('.g-lock');
        if (lk && !lk.hidden && lk.getAnimations().length) window.__seen.moved.push('lock animating');
        if (b.querySelector('.bstamp.writing')) window.__seen.moved.push('stamp typing');
        if (b.querySelector('.bglass') && b.querySelector('.bglass').style.backdropFilter) window.__seen.moved.push('glass blurring');
        // while Mind is in the air (the land, before it is done), the ribbon and the tab bar wait out of sight
        if (window.__bootState?.phase === 'land' && !b.classList.contains('out')) {
          const dock = document.getElementById('dock');
          const top = document.getElementById('top');
          window.__seen.hudInFlight = Math.max(window.__seen.hudInFlight, ...[dock, top].map((x) => (x ? Number(getComputedStyle(x).opacity) : 0)));
        }
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, { key: KEY, flag, kind, lean, manual, hero });
  await stubLibrary(page);
  const three = [];
  page.on('request', (r) => /three\.module/.test(r.url()) && three.push(r.url()));
  return { ctx, page, three };
}
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__bootState ?? null)));
const seen = (page) => page.evaluate(() => ({ texts: [...window.__seen.texts], digits: window.__seen.digits.slice(0, 3), moved: window.__seen.moved.slice(0, 5), old: window.__seen.old.slice(0, 2), hudInFlight: window.__seen.hudInFlight }));
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const ORDER = ['ground', 'floor', 'orb', 'stamp', 'feeds', 'recognise', 'greeting', 'land', 'done'];
/** The stamp line's facts as the page would say them now (ui/machine.ts stampWords): the day and the time in his format. */
const stampNow = (page) => page.evaluate(() => {
  const now = new Date();
  return { day: now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, ''), minutes: now.getHours() * 60 + now.getMinutes() };
});
/** The feeds that really answered, as the phone knows them (checked and not failed), in the boot's order. */
const feedsAnswered = (page) => page.evaluate(() => {
  const info = window.__ghosty?.guardian?.get?.().info ?? null;
  return info ? ['flood', 'weather', 'crime'].filter((f) => info.checked[f] && !info.failed[f]) : null;
});
const FEED_WORD = { flood: 'Flood', weather: 'Weather', crime: 'Crime' };
/** The words that may be on the cinematic: the stamp, the feeds' lines, TAP TO SKIP, the name, his greeting. */
const STAMP = /^[A-Z]{3} \d{1,2} [A-Z]{3} · \d{2}:\d{2} · .+ · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED)$/;
/** (`stamps`: the whole stamp lines seen, so a line caught mid-typing counts as the stamp too) */
const allowed = (t, greeting, stamps) => t === 'TAP TO SKIP' || t === 'GHOSTY' || t === greeting || STAMP.test(t) || stamps.some((f) => f.startsWith(t)) || /^(FLOOD|WEATHER|CRIME) · /.test(t);
const greetingFor = (page) => page.evaluate(() => {
  const hr = new Date().getHours();
  return `${hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, Tony.`;
});
/** Mind on Home: one canvas, over the hero's reactor box, drawn by three.js. */
const onHero = (page) => page.evaluate(() => {
  const gl = [...document.querySelectorAll('canvas.mindhero')];
  const r2 = document.querySelector('.hud.core canvas.reactor');
  const a = gl[0]?.getBoundingClientRect();
  const b = r2?.getBoundingClientRect();
  return { count: gl.length, inHero: !!gl[0] && gl[0].parentElement === r2?.parentElement, a: a && [a.x, a.y, a.width, a.height].map((v) => Math.round(v)), b: b && [b.x, b.y, b.width, b.height].map((v) => Math.round(v)), mode: window.__ghosty?.hero?.mode };
});
/** The HUD back after a landing: the ribbon and the tab bar fully there, nothing waiting out of sight. */
// (its slide is a CSS animation, which software WebGL's slow frames on Home can hold back: waited for, up to 6 s)
const hudBack = async (page) => {
  const now = () => page.evaluate(() => ({ wait: document.body.classList.contains('bootwait'), dock: Number(getComputedStyle(document.getElementById('dock') ?? document.body).opacity), top: Number(getComputedStyle(document.getElementById('top') ?? document.body).opacity) }));
  for (let t = Date.now(); Date.now() - t < 6000; await page.waitForTimeout(150)) {
    const h = await now();
    if (!h.wait && h.dock > 0.99 && h.top > 0.99) return h;
  }
  return now();
};
const landedOk = (L) => !!L && !!L.hero?.length && !L.flight.some((x, i) => Math.abs(x - L.hero[i]) > 1.5);

/** The full cut's checks, wherever it played (a cold open, a second open, a reboot). */
function checkCut(s, what) {
  if (!s) return problems.push(`${what}: no state`);
  const tl = s.timeline;
  const marks = ORDER.map((p) => s.marks?.[p]);
  if (s.kind !== 'full') problems.push(`${what}: it played "${s.kind}", not the full cinematic`);
  // the storyboard's cut: 2,880 ms to a usable Home, under three seconds
  if (!tl || tl.end !== 2880) problems.push(`${what}: the cut is ${tl?.end} ms long (the storyboard's is 2,880)`);
  if (tl && tl.end > 3000) problems.push(`${what}: a usable Home takes ${tl.end} ms (want under three seconds)`);
  for (const [p, at] of Object.entries({ ground: 0, floor: 240, orb: 560, stamp: 1240, feeds: 1700, recognise: 2180, greeting: 2460, land: 2640 })) if (tl && tl[p] !== at) problems.push(`${what}: the cut has ${p} at ${tl[p]} ms (the storyboard: ${at})`);
  if (marks.some((m) => typeof m !== 'number')) problems.push(`${what}: a frame never came: ${JSON.stringify(s.marks)}`);
  for (let i = 1; i < marks.length; i++) if (!(marks[i] >= marks[i - 1])) problems.push(`${what}: ${ORDER[i]} (${marks[i]} ms) came before ${ORDER[i - 1]} (${marks[i - 1]} ms)`);
  // each phase at its time from the gathering on (at the pace it ran), within the slowest frame gap (a phase can only
  // be seen to start on a drawn frame) and a little; the landing may also have waited for the app (held)
  const tol = s.worstGap + 60;
  const off = [];
  for (const p of tl ? ['stamp', 'feeds', 'recognise', 'greeting', 'land'] : []) {
    const want = (tl[p] - tl.orb) / (s.pace || 1);
    const got = s.marks[p] - s.marks.orb - (p === 'land' ? s.held : 0);
    off.push(`${p} ${Math.round(got - want)}`);
    if (Math.abs(got - want) > tol + (p === 'land' ? s.held : 0)) problems.push(`${what}: ${p} came ${got} ms after the orb (want ${Math.round(want)} ± ${tol})`);
  }
  // its own part is over when the cut says (from the first frame), plus what the app underneath needed
  const waitedForApp = s.appReady > (s.marks.land ?? 0) - 1;
  if (tl && !waitedForApp && s.ended - s.held > tl.end + s.worstGap) problems.push(`${what}: it ended at ${s.ended} ms (held ${s.held}), after the ${tl.end} ms cut (worst frame gap ${s.worstGap} ms)`);
  if (s.appReady >= 0 && s.ended < s.appReady) problems.push(`${what}: it ended (${s.ended} ms) before the app underneath was ready (${s.appReady} ms)`);
  // the frame budget, honest: the display's rate as its frames show it, a long frame's limit for that rate, and every
  // gap over it counted
  const B = s.budget;
  if (!B || ![60, 120].includes(B.hz)) problems.push(`${what}: no frame budget in __bootState (${JSON.stringify(B && { hz: B.hz, ms: B.ms })})`);
  else {
    if (B.ms !== (B.hz === 120 ? 12 : 20)) problems.push(`${what}: a long frame is ${B.ms} ms at ${B.hz} Hz (want 12 at 120, 20 at 60)`);
    if (B.gaps.length !== Math.min(600, s.frames - 1)) problems.push(`${what}: ${B.gaps.length} gaps recorded for ${s.frames} frames`);
    const long = B.gaps.filter((g) => g > B.ms).length;
    if (B.long !== long) problems.push(`${what}: ${B.long} long frames counted, but ${long} gaps were over ${B.ms} ms`);
    if (!(B.work > 0)) problems.push(`${what}: no frame work measured`);
  }
  // the HUD: out of sight while Mind flew, in a beat after it landed (not with it)
  if (!landedOk(s.landed)) problems.push(`${what}: it did not land on the hero: flight ${JSON.stringify(s.landed?.flight)} vs hero ${JSON.stringify(s.landed?.hero)}`);
  if (!(s.hudAt >= s.ended + 60)) problems.push(`${what}: the HUD came in at ${s.hudAt} ms, not a beat after Mind landed (${s.ended} ms)`);
  // the stamp line's words, true of the moment: four segments (the day, the time, his place, the feeds' state)
  if (!Array.isArray(s.stamp) || s.stamp.length !== 4) problems.push(`${what}: the stamp line has ${s.stamp?.length} segments: ${JSON.stringify(s.stamp)}`);
  // the recognition came, with the world's floor drawn forming (the recipe's world has one: The Scan's points)
  if (s.marks.recognise === undefined) problems.push(`${what}: no recognition`);
  if (s.floorDrawn !== 'scan') problems.push(`${what}: the floor drawn forming was "${s.floorDrawn}" (want the recipe's world, scan)`);
  return `${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms (off the cut by ${off.join(', ')} ms at pace ${s.pace}); held ${s.held} ms; ended ${s.ended} ms (usable Home ${s.ended - s.held} ms of its own), HUD in at ${s.hudAt} ms; ${s.frames} frames, budget ${B?.hz} Hz / ${B?.ms} ms: ${B?.long} long, worst gap ${s.worstGap} ms, frame work worst ${B?.work} ms, mean ${B?.avg} ms${B?.lean ? `, leaned at ${B.lean}` : ''}; stamp ${JSON.stringify(s.stamp)}; feeds ${JSON.stringify(s.feedLines)}; tone ${s.tone}`;
}
/** The stamp's facts and the feeds' lines, true: checked against the clock and the guardian as the page knows them. */
async function checkWords(page, s, what, { tapped }) {
  if (!s?.stamp?.length) return;
  // (the guardian's handle joins window.__ghosty a few seconds after the app is up)
  await page.waitForFunction(() => !!window.__ghosty?.guardian, null, { timeout: 6000 }).catch(() => undefined);
  const now = await stampNow(page);
  const [day, time, place, watch] = s.stamp;
  if (day !== now.day) problems.push(`${what}: the stamp's day is "${day}" (today is ${now.day})`);
  const m = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
  if (!m || Math.abs(minutes - now.minutes) > 2) problems.push(`${what}: the stamp's time is "${time}" (the clock says ${Math.floor(now.minutes / 60)}:${String(now.minutes % 60).padStart(2, '0')})`);
  if (!place || /\d/.test(place)) problems.push(`${what}: the stamp's place is "${place}"`);
  const answered = await feedsAnswered(page);
  if (!/^(Watching \d+ feeds?|Checking feeds|No feeds yet|Offline, feeds paused)$/.test(watch ?? '')) problems.push(`${what}: the stamp's feeds segment is "${watch}"`);
  // the feeds' lines: one per feed that answered, in the order flood, weather, crime, each saying its source; none for a feed that
  // did not; and the stamp then says WATCHING that many
  const ids = (s.feedLines ?? []).map((l) => Object.keys(FEED_WORD).find((f) => l.startsWith(`${FEED_WORD[f]} · `)) ?? `?${l}`);
  if (answered) {
    if (ids.join() !== answered.join()) problems.push(`${what}: the feeds' lines were for ${JSON.stringify(ids)}, the feeds that answered are ${JSON.stringify(answered)}`);
    if (s.feedLines.length && watch !== `Watching ${answered.length} ${answered.length === 1 ? 'feed' : 'feeds'}`) problems.push(`${what}: ${answered.length} feeds answered but the stamp says "${watch}"`);
  } else if (ids.length) problems.push(`${what}: feed lines with no guardian answer: ${JSON.stringify(s.feedLines)}`);
  for (const l of s.feedLines ?? []) if (!/^(Flood · Environment Agency|Weather · Met Office|Crime · police\.uk) · .+/.test(l)) problems.push(`${what}: a feed line without its source: "${l}"`);
  // the recognition's tone under the sound rules: his sounds are on, but a cold open has had no tap, so nothing is heard
  // until one; after a tap, the sound switch's tone, once
  const heard = await page.evaluate(() => window.__sfx.filter((k) => k === 'lock' || k === 'click'));
  if (!tapped && (s.tone !== 'quiet' || heard.length)) problems.push(`${what}: the recognition's tone before any tap: "${s.tone}", heard ${JSON.stringify(heard)} (iOS allows no sound until a tap)`);
  if (tapped && (s.tone !== 'tone' || heard.length !== 1)) problems.push(`${what}: the recognition's tone after a tap: "${s.tone}", heard ${JSON.stringify(heard)} (want the tone, once)`);
}

// ---- 1. the full cinematic, in real time
{
  const { ctx, page, three } = await open({ kind: 'full' });
  const t0 = Date.now();
  await page.goto(base);
  await until(page, () => window.__bootState?.marks?.ground === 0, 15000, 'the cinematic never started');
  // the app keeps booting underneath: Home is built before the cinematic ends
  await until(page, () => !!document.querySelector('.hud.core canvas.reactor') && !!document.getElementById('boot'), 20000, 'Home was not built underneath while the cinematic played');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the cinematic never ended'));
  await page.waitForTimeout(400);
  const wall = Date.now() - t0;
  const s = await state(page);
  const v = await seen(page);
  const line = checkCut(s, 'full');
  if (v.old.length) problems.push(`full: the old boot is still there: ${v.old[0]}`);
  if (v.digits.length) problems.push(`full: a number on the cinematic outside the stamp and the feeds' lines: ${v.digits[0]}`);
  if (v.hudInFlight > 0.05) problems.push(`full: the HUD showed while Mind was still flying (opacity ${v.hudInFlight})`);
  const want = await greetingFor(page);
  const words = v.texts.join(' | ').replace(/\n/g, ' ');
  if (!words.includes('GHOSTY')) problems.push(`full: the name never showed (saw: ${words})`);
  if (!words.includes(want)) problems.push(`full: the greeting was not "${want}" (saw: ${words})`);
  if (!words.includes('TAP TO SKIP')) problems.push(`full: TAP TO SKIP never showed (saw: ${words})`);
  if (!v.texts.some((t) => /WATCHING \d+ FEEDS?|CHECKING FEEDS|OFFLINE, FEEDS PAUSED/.test(t))) problems.push(`full: the stamp line never showed (saw: ${words})`);
  // (the stamp wraps whole segments onto a second line at 440 as the real component wraps: joined back before it is read)
  const joinWrapped = (lines) => lines.reduce((acc, l) => (acc.length && /^(WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED)$/.test(l) ? [...acc.slice(0, -1), `${acc.at(-1)} ${l}`] : [...acc, l]), []);
  // every line on it is one of its own (the stamp, the feeds' lines, the skip, the name, his greeting): no status line, no decoration
  const lines = v.texts.flatMap((t) => joinWrapped(t.split('\n').map((x) => x.trim()).filter(Boolean)));
  const stamps = lines.filter((t) => STAMP.test(t));
  const extra = lines.filter((t) => !allowed(t, want, stamps));
  if (extra.length) problems.push(`full: something else was written on it (a status line?): ${extra.join(' / ')}`);
  await checkWords(page, s, 'full', { tapped: false });
  // it lands on Home's real MIND: the canvas that flew is the one in the hero, to the pixel
  if (!s?.mind) problems.push('full: MIND did not draw the cinematic');
  const hp = await onHero(page);
  if (hp.count !== 1) problems.push(`full: ${hp.count} Mind canvases after the landing (want the one)`);
  if (!hp.inHero || JSON.stringify(hp.a) !== JSON.stringify(hp.b)) problems.push(`full: Mind is not in the hero's box after the landing: ${hp.a} vs ${hp.b}`);
  if (hp.mode !== 'mind') problems.push(`full: Home's hero is "${hp.mode}", not MIND`);
  const hud = await hudBack(page);
  if (hud.wait || hud.dock < 0.99 || hud.top < 0.99) problems.push(`full: the HUD did not come back after the landing (${JSON.stringify(hud)})`);
  // THE STAMP BECOMES HOME'S (BRIEF-SHELL pass 1, OWNER-ISSUES 149; was: the stamp leaves with the layer): the boot's line does not go with
  // the cinematic, Home has its own at the landing: the same day, the same place, the feeds as they are now, and the fifth segment, LOOKING AT
  // HOME, which the cinematic could not say. Whole, showing, and the only stamp line on Home.
  await page.waitForTimeout(900);
  const handed = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#pg-core .g-stamp')];
    const e = document.querySelector('#pg-core .hstamp');
    return { count: all.length, text: e?.innerText.replace(/\s+/g, ' ').trim() ?? '', opacity: e ? Number(getComputedStyle(e).opacity) : -1, boot: !!document.querySelector('#boot .bstamp') };
  });
  const bootSaid = (s?.stamp ?? []).map((x) => x.toUpperCase());
  if (handed.count !== 1 || handed.boot) problems.push(`full: after the landing there are ${handed.count} stamp lines on Home (the boot's still there: ${handed.boot}); want Home's one`);
  if (handed.opacity < 0.99) problems.push(`full: Home's stamp line is not showing after the landing (opacity ${handed.opacity})`);
  if (bootSaid.length === 4 && !(handed.text.startsWith(`${bootSaid[0]} · `) && handed.text.includes(` · ${bootSaid[2]} · `))) problems.push(`full: Home's stamp "${handed.text}" is not the boot's day and place ("${bootSaid.join(' · ')}")`);
  if (!/ · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(handed.text)) problems.push(`full: Home's stamp line reads "${handed.text}" (want the feeds, then LOOKING AT HOME)`);
  if (bootSaid.length === 4 && /WATCHING (\d+)/.exec(bootSaid[3])?.[1] && !handed.text.includes(bootSaid[3]) && /WATCHING/.test(handed.text)) timings.push(`stamp hand-over: the boot said ${bootSaid[3]}, Home says ${handed.text.split(' · ')[3]} (the feeds moved after the cut)`);
  if (three.length !== 1) problems.push(`full: three.js was requested ${three.length} times (want once, shared by the boot and Home)`);
  // the voice: a cold open has had no tap, so nothing was spoken (and no hum) until the first tap; then once
  if (s?.spoken !== 'waiting') problems.push(`full: the greeting was "${s?.spoken}" before any tap (want: waiting for the first tap)`);
  if (s?.said !== 0) problems.push(`full: the greeting was handed to the voice ${s?.said} times before any tap`);
  if (s?.sound) problems.push('full: the hum played on a cold open with no tap (the phone would refuse it)');
  await page.mouse.click(220, 560);
  await page.waitForTimeout(200);
  await page.mouse.click(220, 560);
  await page.waitForTimeout(300);
  const s2 = await state(page);
  if (s2?.spoken !== 'tap') problems.push(`full: the first tap did not speak the greeting ("${s2?.spoken}")`);
  if (s2?.said !== 1) problems.push(`full: the greeting was handed to the voice ${s2?.said} times after two taps (want once)`);
  const utter = await page.evaluate(() => window.__utter.filter((t) => /Tony/.test(t)).length);
  if (utter > 1) problems.push(`full: the phone was asked to say the greeting ${utter} times`);
  if (s) timings.push(`full cold open (real time, software WebGL): first frame ${s.firstFrame} ms after the page started; ${line}; app ready underneath at ${s.appReady} ms; one MIND draw ${s.drawMs} ms; the boot layer gone ${s.firstFrame + s.ended} ms after the page started (a usable Home); ${wall} ms of test time from goto to Home`);
  await page.screenshot({ path: `${out}/boot-landed.png` });
  await ctx.close();
}

// ---- 2. a tap skips it
{
  const { ctx, page } = await open({ kind: 'full' });
  await page.goto(base);
  await until(page, () => (window.__bootState?.marks?.orb ?? -1) >= 0, 20000, 'skip: the cinematic never got going');
  const at = await page.evaluate(() => performance.now());
  await page.mouse.click(220, 700);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push('skip: the tap did not end it'));
  await page.waitForTimeout(400);
  const s = await state(page);
  const gone = s ? s.firstFrame + s.ended - at : 0;
  if (!s?.skipped) problems.push('skip: the tap was not taken as a skip');
  if (s && (s.marks.recognise !== undefined || s.marks.greeting !== undefined)) problems.push(`skip: it played on to the recognition or the greeting after the tap (${JSON.stringify(s.marks)})`);
  if (s?.spoken === 'now' || s?.spoken === 'tap' || s?.said) problems.push(`skip: the greeting was spoken after a skip (${s.spoken}, ${s.said})`);
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`skip: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  const hud = await hudBack(page);
  if (hud.wait || hud.dock < 0.99) problems.push(`skip: the HUD did not come back (${JSON.stringify(hud)})`);
  if (s) timings.push(`skip: the tap at ${Math.round(at - s.firstFrame)} ms after the first frame; ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; ended ${Math.round(gone)} ms after the tap (held ${s.held} ms for the app and Home's hero) (app ready at ${s.appReady} ms; ${s.frames} frames, worst gap ${s.worstGap} ms)`);

  // ---- 3. every cold open plays it: a second open (a reload is a new page, as a launch from the Home Screen is)
  await page.reload();
  await until(page, () => window.__bootState?.marks?.ground === 0, 15000, 'second open: the cinematic never started');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('second open: the cinematic never ended'));
  await page.waitForTimeout(400);
  const w = await state(page);
  if (w?.skipped) problems.push('second open: it was skipped with no tap');
  const line = checkCut(w, 'second open');
  if (w) timings.push(`second cold open: ${w.kind}; ${line}`);
  const hp2 = await onHero(page);
  if (hp2.count !== 1 || !hp2.inHero) problems.push(`second open: Mind did not end up in the hero (${JSON.stringify(hp2)})`);
  // a resume (coming back to the app after more than a few seconds away, the page still alive): a breath, no cinematic
  const before = (await state(page))?.warm ?? 0;
  const plays = (await state(page))?.plays ?? 0;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(3300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await until(page, (n) => (window.__bootState?.warm ?? 0) > n, 5000, 'resume: coming back to the app did not breathe', before);
  if (await page.$('#boot')) problems.push('resume: coming back to the app showed the boot layer');
  // the page restored whole from the back-forward cache: the same page life, a breath
  const before2 = (await state(page))?.warm ?? 0;
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await until(page, (n) => (window.__bootState?.warm ?? 0) > n, 5000, 'resume: a page back from the back-forward cache did not breathe', before2);
  const after = await state(page);
  if (after?.plays !== plays) problems.push(`resume: the cinematic played again on a resume (${after?.plays} plays, was ${plays})`);
  await ctx.close();
}

// ---- 3b. a deep link (a notification he tapped opens its screen): no cinematic over it, only the breath
{
  const { ctx, page } = await open({ kind: 'full' });
  await page.goto(`${base}/#agenda`);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push('deep link: the black never went'));
  const w = await state(page);
  const wv = await seen(page);
  if (w?.kind !== 'warm') problems.push(`deep link: an open on a deep link played "${w?.kind}" (want only the breath)`);
  if (wv.texts.length) problems.push(`deep link: words over a deep link: ${wv.texts.join(' | ')}`);
  await ctx.close();
}

// ---- 4. Reduce Motion: the frames fade, nothing moves
{
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => problems.push('reduce motion: it never ended'));
  const s = await state(page);
  const v = await seen(page);
  if (!['still', 'flat'].includes(s?.kind)) problems.push(`reduce motion: it played "${s?.kind}"`);
  if (v.moved.length) problems.push(`reduce motion: something moved: ${v.moved.join(' / ')}`);
  const want = await greetingFor(page);
  if (!v.texts.join(' | ').includes(want)) problems.push(`reduce motion: no greeting (saw: ${v.texts.join(' | ')})`);
  if (!v.texts.join(' | ').includes('GHOSTY')) problems.push(`reduce motion: no name (saw: ${v.texts.join(' | ')})`);
  if (!v.texts.some((t) => /WATCHING \d+ FEEDS?|CHECKING FEEDS|OFFLINE, FEEDS PAUSED/.test(t))) problems.push(`reduce motion: no stamp line (saw: ${v.texts.join(' | ')})`);
  // the two frames: 1,200 ms, the recognition at 600
  if (s?.kind === 'still' && (s.timeline?.end !== 1200 || s.timeline?.recognise !== 600)) problems.push(`reduce motion: the cut is ${JSON.stringify(s.timeline)} (want two frames: the recognition at 600, over at 1,200)`);
  if (s?.marks.recognise === undefined) problems.push('reduce motion: no recognition');
  // its own part, without the wait for the app underneath and Home's hero (measured as s.held)
  const own = s?.kind === 'still' ? (s.marks.land ?? 0) - (s.marks.orb ?? 0) - s.held : 0;
  // (software WebGL draws a frame in up to a second or more here: a phase can only be seen to start on a drawn frame)
  if (s?.kind === 'still' && own > 800 + 2 * s.worstGap) problems.push(`reduce motion: ${own} ms from the orb to the landing (want 800, worst frame gap ${s.worstGap} ms)`);
  await checkWords(page, s, 'reduce motion', { tapped: false });
  if (s) timings.push(`reduce motion: ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms (the ground holds until MIND is drawing: ${s.marks.orb} ms here; then held ${s.held} ms for the app and Home's hero; app ready at ${s.appReady} ms; worst frame gap ${s.worstGap} ms)`);
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`reduce motion: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  await ctx.close();
}

// ---- 5. "reboot" plays it again over Home; SYSTEM has the line; then a tap skips a replay at every stage
{
  const { ctx, page, three } = await open({ kind: 'full' });
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 });
  await page.evaluate(() => window.__ghosty.run('open_tab', { tab: 'system' }));
  await until(page, () => [...document.querySelectorAll('button')].some((b) => /REBOOT HIM/i.test(b.textContent || '')), 15000, 'reboot: SYSTEM has no REBOOT HIM line');
  // a real tap first (a reboot comes from one: the button or his words), so the phone allows the hum and the voice
  await page.mouse.click(220, 120);
  await page.evaluate(() => window.__ghosty.run('reboot'));
  await until(page, () => !!document.getElementById('boot') && window.__bootState.plays === 2, 8000, 'reboot: the cinematic did not play again');
  await until(page, () => window.__ghosty.ui.get().tab === 'core', 8000, 'reboot: it did not go to Home');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => problems.push('reboot: it never ended'));
  await page.waitForTimeout(400);
  const s = await state(page);
  if (!s?.mind) problems.push('reboot: MIND did not draw it');
  const line = checkCut(s, 'reboot');
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`reboot: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  // a reboot comes from a tap: the greeting is spoken at once (the voice is on), once
  if (s?.spoken !== 'now') problems.push(`reboot: the greeting was "${s?.spoken}" (want spoken at once after a tap)`);
  if (s?.said !== 1) problems.push(`reboot: the greeting was handed to the voice ${s?.said} times (want once)`);
  if (!s?.sound) problems.push('reboot: the hum did not play (the voice is on and he had tapped)');
  await checkWords(page, s, 'reboot', { tapped: true });
  if (s) timings.push(`reboot: ${line}; hum ${s.sound ? 'played' : 'not played'}`);
  // a tap at each stage of a replay lands cleanly: on the hero to the pixel, the HUD back, nothing said after the tap
  // (software WebGL draws a frame in up to a second here, so a phase of a few hundred ms can pass between two frames:
  // the replay is held at the moment by hand, tapped there, then let run on its own clock to the landing)
  const AT = { ground: 100, floor: 300, orb: 700, stamp: 1300, feeds: 1800, recognise: 2250, greeting: 2500, land: 2700 };
  for (const stage of Object.keys(AT)) {
    const n = (await state(page))?.plays ?? 0;
    await page.evaluate(() => {
      window.__ghostyBootManual = true;
      window.__ghosty.run('reboot');
    });
    const got = await until(page, (k) => window.__bootState.plays === k + 1 && window.__bootState.marks.ground === 0, 15000, `skip at ${stage}: the replay never started`, n);
    if (!got) continue;
    await page.evaluate((ms) => window.__bootSeek(ms), AT[stage]);
    const at = (await state(page))?.phase;
    if (at !== stage) problems.push(`skip at ${stage}: the replay was at "${at}"`);
    const said = (await state(page))?.said ?? 0;
    await page.mouse.click(220, 330);
    await page.evaluate(() => delete window.__ghostyBootManual);
    await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push(`skip at ${stage}: the tap did not end it`));
    await page.waitForTimeout(450);
    const k = await state(page);
    const hp3 = await onHero(page);
    const hud = await hudBack(page);
    if (stage !== 'land' && !k?.skipped) problems.push(`skip at ${stage}: the tap was not taken as a skip`);
    if (!landedOk(k?.landed)) problems.push(`skip at ${stage}: it did not land on the hero (${JSON.stringify(k?.landed)})`);
    if (hp3.count !== 1 || !hp3.inHero || JSON.stringify(hp3.a) !== JSON.stringify(hp3.b)) problems.push(`skip at ${stage}: Mind is not in the hero after it (${JSON.stringify(hp3)})`);
    if (hud.wait || hud.dock < 0.99 || hud.top < 0.99) problems.push(`skip at ${stage}: the HUD did not come back (${JSON.stringify(hud)})`);
    if ((k?.said ?? 0) > Math.max(1, said)) problems.push(`skip at ${stage}: the greeting was said after the tap (${k?.said})`);
    if (k) timings.push(`skip at ${stage}: ${ORDER.map((p) => `${p} ${k.marks[p]}`).join(' · ')} ms`);
  }
  if (three.length !== 1) problems.push(`reboot: three.js was requested ${three.length} times`);
  await ctx.close();
}

// ---- 6. a phone that cannot keep up (software WebGL is one): every long frame counted, and the cinematic shortened
{
  // left to choose for itself: the point of light already stutters here, so it picks the short version (or flat)
  const { ctx, page } = await open();
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('slow phone: it never ended'));
  const s = await state(page);
  const B = s?.budget;
  if (!B || !(B.long > 0)) problems.push(`slow phone: no long frames counted (${JSON.stringify(B && { hz: B.hz, long: B.long })})`);
  if (s?.kind === 'full' && !B?.lean) problems.push('slow phone: the full cut played on, with every frame long');
  if (s && !(s.ended - s.held <= 2880 + s.worstGap)) problems.push(`slow phone: it ran ${s.ended - s.held} ms (want shorter than the full cut)`);
  if (s) timings.push(`slow phone, its own choice: ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; budget ${B?.hz} Hz / ${B?.ms} ms: ${B?.long} of ${B?.gaps?.length} frames long; ended ${s.ended} ms`);
  await ctx.close();
  // the full cut, then the phone falling behind mid-flight: it leans (no depths, trails or refraction) and quickens
  const L = await open({ kind: 'full', lean: true });
  // every frame from the gathering on takes longer than a 60 Hz frame and a bit (as a phone that cannot keep up would)
  await L.page.addInitScript(() => {
    const burn = () => {
      if (window.__bootState?.marks?.orb !== undefined && document.getElementById('boot')) {
        const t = performance.now();
        while (performance.now() - t < 26);
      }
      requestAnimationFrame(burn);
    };
    requestAnimationFrame(burn);
  });
  await L.page.goto(base);
  await L.page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('lean: it never ended'));
  const l = await state(L.page);
  if (!l?.budget?.lean) problems.push(`lean: the full cut did not lean with its frames long (${l?.budget?.long} long of ${l?.budget?.gaps?.length})`);
  if (l?.budget?.lean && !(l.pace > 1)) problems.push(`lean: it leaned but did not quicken (pace ${l.pace})`);
  if (!landedOk(l?.landed)) problems.push(`lean: it did not land on the hero (${JSON.stringify(l?.landed)})`);
  if (l) timings.push(`lean: leaned at ${l.budget?.lean}, pace ${l.pace}; ${ORDER.map((p) => `${p} ${l.marks[p]}`).join(' · ')} ms; ${l.budget?.long} of ${l.budget?.gaps?.length} frames long`);
  await L.ctx.close();
}

// ---- 7. automated checks without the flag: no cinematic, the black goes as soon as the app is up
{
  const { ctx, page } = await open({ flag: false, hero: false });
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push('quiet: the black never went'));
  const s = await state(page);
  const v = await seen(page);
  if (s?.kind !== 'quiet') problems.push(`quiet: automated checks got "${s?.kind}"`);
  if (v.texts.length) problems.push(`quiet: words on the boot layer: ${v.texts.join(' | ')}`);
  await ctx.close();
}

// ---- the frame strip: each moment photographed, the cinematic stepped by hand (the same drawing, held still), and
// what those moments draw checked
{
  const c2 = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p2 = await c2.newPage();
  await p2.addInitScript((key) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false }));
    window.__ghostyHero = true;
    window.__ghostyBoot = true;
    window.__ghostyBootKind = 'full';
    window.__ghostyBootManual = true;
  }, KEY);
  await stubLibrary(p2);
  await p2.goto(base);
  const ready = await until(p2, () => window.__ghosty?.hero?.mode === 'mind' && !!document.querySelector('canvas.reactor.mindon') && window.__bootState?.appReady >= 0, 60000, 'strip: MIND and Home never got ready under the cinematic');
  const frames = [[160, 'ground'], [420, 'floor'], [900, 'orb'], [1560, 'stamp'], [2060, 'feeds'], [2440, 'recognise'], [2600, 'greeting'], [2800, 'land'], [2880, 'home']];
  /** What the moment draws: the floor's lit pixels outside the orb's box, the stamp as typed (and whether its cursor is still
   *  writing), the feeds' lines showing, the box on the orb (where it is against the orb's canvas), the name, the greeting, the skip. */
  const probe = () => p2.evaluate(() => {
    const f = document.querySelector('#boot canvas.bfloor');
    const m = document.querySelector('#boot canvas.mindhero')?.getBoundingClientRect();
    let lit = 0;
    if (f && m) {
      const g = f.getContext('2d');
      const k = f.width / innerWidth;
      const img = g.getImageData(0, 0, f.width, f.height).data;
      for (let y = 0; y < f.height; y += 2)
        for (let x = 0; x < f.width; x += 2) {
          const X = x / k;
          const Y = y / k;
          if (X > m.left && X < m.right && Y > m.top && Y < m.bottom) continue;
          if (img[(y * f.width + x) * 4 + 3] > 8) lit++;
        }
    }
    const st = document.querySelector('#boot .bstamp');
    const lock = document.querySelector('#boot .g-lock');
    const lr = lock && !lock.hidden ? lock.getBoundingClientRect() : null;
    const op = (sel) => Number(document.querySelector(sel)?.style.opacity ?? 0);
    return {
      lit,
      stamp: st ? { text: st.innerText.replace(/\s+/g, ' ').trim(), writing: st.classList.contains('writing'), cursor: !!st.querySelector('.g-cursor') && getComputedStyle(st.querySelector('.g-cursor')).display !== 'none', opacity: Number(st.style.opacity) } : null,
      feeds: [...document.querySelectorAll('#boot .bfeeds .g-truth')].map((p) => ({ text: p.innerText.replace(/\s+/g, ' ').trim(), opacity: Number(p.style.opacity) })),
      lock: lr && m ? { state: lock.dataset.state, opacity: Number(lock.style.opacity || 1), dx: Math.round(lr.left + lr.width / 2 - (m.left + m.width / 2)), dy: Math.round(lr.top + lr.height / 2 - (m.top + m.height / 2)), size: Math.round(lr.width), orb: Math.round(m.width) } : null,
      name: op('#boot .bname'),
      greeting: op('#boot .bgreet'),
      skip: op('#boot .bskip'),
      room: op('#boot .broom'),
    };
  });
  const seenAt = {};
  for (const [ms, name] of ready ? frames : []) {
    await p2.evaluate((t) => window.__bootSeek(t), ms);
    await p2.waitForTimeout(ms >= 2880 ? 900 : 350);
    if (ms < 2880) seenAt[name] = await probe();
    await p2.screenshot({ path: `${out}/boot-frame-${String(ms).padStart(4, '0')}-${name}.png` });
  }
  if (ready) {
    // 1. the ground, nothing else: the room's light coming in, no floor yet, no words
    if (!(seenAt.ground?.room > 0.3) || seenAt.ground?.lit > 0 || seenAt.ground?.stamp?.opacity > 0) problems.push(`strip: the ground frame is not the ground alone (${JSON.stringify({ room: seenAt.ground?.room, lit: seenAt.ground?.lit })})`);
    // 2. the floor forming: part of the field of points drawn by 420 ms, the whole of it by the orb's moment
    if (!(seenAt.floor?.lit > 200)) problems.push(`strip: the floor was not forming at 420 ms (${seenAt.floor?.lit} lit pixels)`);
    if (!(seenAt.orb?.lit > seenAt.floor?.lit)) problems.push(`strip: the floor did not go on forming (${seenAt.floor?.lit} then ${seenAt.orb?.lit} lit pixels)`);
    // 4. the stamp typing itself: part of the line at 1,560 ms with the cursor writing, whole (no cursor) by the feeds
    const st = seenAt.stamp?.stamp;
    if (!st || !st.writing || !st.cursor || !st.text || st.text.length >= 'SAT 7 NOV · 21:08 · BIRMINGHAM · CHECKING FEEDS'.length) problems.push(`strip: the stamp was not typing at 1,560 ms (${JSON.stringify(st)})`);
    const st2 = seenAt.feeds?.stamp;
    if (!st2 || st2.writing || !/^[A-Z]{3} \d{1,2} [A-Z]{3} · \d{2}:\d{2} · .+ · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED)$/.test(st2.text)) problems.push(`strip: the stamp was not whole by 2,060 ms (${JSON.stringify(st2)})`);
    if (seenAt.stamp?.skip < 0.99) problems.push(`strip: TAP TO SKIP was not showing at 1,560 ms (opacity ${seenAt.stamp?.skip})`);
    // 5. the feeds' lines showing at 2,060 ms (the first two whole, the third arriving), gone by the recognition
    const fl = seenAt.feeds?.feeds ?? [];
    if (!fl.length || !(fl[0].opacity > 0.99) || !fl.every((l) => /^(FLOOD|WEATHER|CRIME) · /.test(l.text))) problems.push(`strip: the feeds' lines at 2,060 ms: ${JSON.stringify(fl)}`);
    if ((seenAt.recognise?.feeds ?? []).some((l) => l.opacity > 0)) problems.push(`strip: the feeds' lines were still there at the recognition (${JSON.stringify(seenAt.recognise?.feeds)})`);
    // 6. the recognition: the box in the attend state, centred on the orb's canvas, G H O S T Y under it, the skip gone
    const lk = seenAt.recognise?.lock;
    if (!lk || lk.state !== 'attend' || Math.abs(lk.dx) > 3 || Math.abs(lk.dy) > 3 || !(lk.size > 0.6 * lk.orb && lk.size < lk.orb)) problems.push(`strip: the box is not on the orb at 2,440 ms (${JSON.stringify(lk)})`);
    if (!(seenAt.recognise?.name > 0.5)) problems.push(`strip: the name was not under the box at 2,440 ms (opacity ${seenAt.recognise?.name})`);
    if (seenAt.recognise?.skip > 0.01) problems.push(`strip: TAP TO SKIP was still showing at the recognition (opacity ${seenAt.recognise?.skip})`);
    // 7. the greeting, with the box and the name still on the orb
    if (!(seenAt.greeting?.greeting > 0.8) || !seenAt.greeting?.lock || !(seenAt.greeting?.name > 0.9)) problems.push(`strip: the greeting frame (${JSON.stringify({ greeting: seenAt.greeting?.greeting, lock: !!seenAt.greeting?.lock, name: seenAt.greeting?.name })})`);
    // 8. the landing: the words going
    if (!(seenAt.land?.greeting < 0.1) || !(seenAt.land?.name < 0.1)) problems.push(`strip: the words had not gone as it landed (${JSON.stringify({ greeting: seenAt.land?.greeting, name: seenAt.land?.name })})`);
    timings.push(`strip: floor ${seenAt.floor?.lit} then ${seenAt.orb?.lit} lit pixels; stamp at 1560 ms "${st?.text}"; feeds at 2060 ms ${JSON.stringify(fl.map((l) => `${l.text} @${l.opacity}`))}; box at 2440 ms ${JSON.stringify(lk)}`);
  }
  await c2.close();
}

await browser.close();
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'BOOT run clean at 440 × 956: the storyboard\'s cut (2,880 ms to a usable Home) came in order and on time (ground, floor, orb, stamp, feeds, recognise, greeting, land) with the app booting underneath and its frame budget honest in __bootState, the stamp line\'s words true (the day, the clock, his place, the feeds\' state), the feeds\' lines only for feeds that answered, no other number and no status line on it, the box landed on the orb with G H O S T Y under it and no tone before a tap, his greeting spoken once on the first tap of a cold open, landed on Home\'s real MIND to the pixel with three.js loaded once and the HUD a beat after; a tap skipped it on a cold open and at every stage of a replay; a second cold open played it again, while a resume, a page back from the back-forward cache and a deep link only breathed; Reduce Motion played its two frames with nothing moving; "reboot" played it again over Home, said the greeting at once, once, and the tone was heard; a phone that could not keep up counted its long frames and got a shorter cut; the floor forming, the stamp typing, the feeds\' lines, the box, the name and the greeting were drawn; automated checks saw none of it.');
process.exit(problems.length ? 1 : 0);
