// The boot cinematic (apps/web/src/shell/boot.ts; docs/build-plan/BRIEF-BOOT.md): MIND waking up, on the iPhone 18 Pro
// Max's 440 × 956 with software WebGL (SwiftShader, as tests/hero.spec.mjs runs MIND). Checks, each of which fails on the
// old boot (a spinner, engine lines and "INITIALISING…") or on the first cut (once a day, 3.5 s, no budget):
//   1. the full cinematic: the richer cut (3.5–4.5 s), its frames come in order (point, gather, sphere, name, greeting,
//      land) each at its time within tolerance (the slowest frame gap, as a phase is only seen on a drawn frame), its own
//      part is over when the cut says (plus what the app underneath needed), the frame budget is in __bootState and
//      honest (the display's rate, a long frame's limit, every long frame counted), nothing on it is a number or a
//      status line, the greeting is his ("Good evening, Tony."), it is not spoken on a cold open until the first tap
//      (and is then, once), the app booted underneath (Home was there before it ended), it lands on Home's real MIND:
//      the same canvas, in the hero's box to the pixel, three.js loaded once; the HUD stays out of sight while Mind flies
//      and slides in a beat after it lands, not with it;
//   2. a tap skips it, on a cold open and at every stage of a replay (point, gather, sphere, name, greeting, land),
//      landing cleanly each time (on the hero to the pixel, the HUD back, no greeting after the tap);
//   3. every cold open plays it: a second cold open (a reload: a new page) plays the full cinematic again, while a
//      resume (coming back to the running app, or a page restored from the back-forward cache) and a deep link play
//      only Mind's breath;
//   4. Reduce Motion: the frames fade, nothing moves;  5. "reboot" plays it again over Home (and SYSTEM has the line),
//      the greeting spoken at once, once;  6. a phone that cannot keep up: long frames counted and the cinematic
//      shortened (the short version chosen, or the full cut leaning mid-flight);  7. automated checks (no flag) see no
//      cinematic at all.
// It also photographs each moment (the cinematic stepped by hand), checks what those moments draw (the depths round
// Mind, the name wide then tightened, the line under it, the greeting's bloom), and prints the timings it measured.
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
    const look = () => {
      const b = document.getElementById('boot');
      if (b) {
        const t = (b.innerText || '').trim();
        if (t) window.__seen.texts.add(t.replace(/\s+/g, ' '));
        if (/\d/.test(b.textContent || '') || [...b.querySelectorAll('[aria-label]')].some((x) => /\d/.test(x.getAttribute('aria-label')))) window.__seen.digits.push(b.textContent);
        if (b.querySelector('.ring, .log') || /INITIALIS/i.test(b.textContent || '')) window.__seen.old.push(b.innerHTML.slice(0, 120));
        const c = b.querySelector('canvas.mindhero');
        const ct = c && getComputedStyle(c).transform;
        if (ct && ct !== 'none') window.__seen.moved.push(`mind ${ct}`);
        const g = b.querySelector('.bgreet');
        const gt = g && g.style.transform;
        if (gt && !/translate\(-50%, 0(px)?\)/.test(gt)) window.__seen.moved.push(`greeting ${gt}`);
        const d = b.querySelector('.bdot');
        const dt = d && d.style.transform;
        if (dt && !/scale\(1(\.000)?\)/.test(dt)) window.__seen.moved.push(`point ${dt}`);
        for (const s of b.querySelectorAll('.bword span')) if (s.style.transform) window.__seen.moved.push(`letter ${s.style.transform}`);
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
const ORDER = ['point', 'gather', 'sphere', 'name', 'greeting', 'land', 'done'];
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
  if (!tl || tl.end < 3500 || tl.end > 4500) problems.push(`${what}: the cut is ${tl?.end} ms long (want 3.5–4.5 s)`);
  if (marks.some((m) => typeof m !== 'number')) problems.push(`${what}: a frame never came: ${JSON.stringify(s.marks)}`);
  for (let i = 1; i < marks.length; i++) if (!(marks[i] >= marks[i - 1])) problems.push(`${what}: ${ORDER[i]} (${marks[i]} ms) came before ${ORDER[i - 1]} (${marks[i - 1]} ms)`);
  // each phase at its time from the gathering on (at the pace it ran), within the slowest frame gap (a phase can only
  // be seen to start on a drawn frame) and a little; the landing may also have waited for the app (held)
  const tol = s.worstGap + 60;
  const off = [];
  for (const p of tl ? ['sphere', 'name', 'greeting', 'land'] : []) {
    const want = (tl[p] - tl.gather) / (s.pace || 1);
    const got = s.marks[p] - s.marks.gather - (p === 'land' ? s.held : 0);
    off.push(`${p} ${Math.round(got - want)}`);
    if (Math.abs(got - want) > tol + (p === 'land' ? s.held : 0)) problems.push(`${what}: ${p} came ${got} ms after the gathering (want ${Math.round(want)} ± ${tol})`);
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
  return `${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms (off the cut by ${off.join(', ')} ms at pace ${s.pace}); held ${s.held} ms; ended ${s.ended} ms, HUD in at ${s.hudAt} ms; ${s.frames} frames, budget ${B?.hz} Hz / ${B?.ms} ms: ${B?.long} long, worst gap ${s.worstGap} ms, frame work worst ${B?.work} ms, mean ${B?.avg} ms${B?.lean ? `, leaned at ${B.lean}` : ''}`;
}

// ---- 1. the full cinematic, in real time
{
  const { ctx, page, three } = await open({ kind: 'full' });
  const t0 = Date.now();
  await page.goto(base);
  await until(page, () => window.__bootState?.marks?.point === 0, 15000, 'the cinematic never started');
  // the app keeps booting underneath: Home is built before the cinematic ends
  await until(page, () => !!document.querySelector('.hud.core canvas.reactor') && !!document.getElementById('boot'), 20000, 'Home was not built underneath while the cinematic played');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the cinematic never ended'));
  await page.waitForTimeout(400);
  const wall = Date.now() - t0;
  const s = await state(page);
  const v = await seen(page);
  const line = checkCut(s, 'full');
  if (v.old.length) problems.push(`full: the old boot is still there: ${v.old[0]}`);
  if (v.digits.length) problems.push(`full: a number on the cinematic: ${v.digits[0]}`);
  if (v.hudInFlight > 0.05) problems.push(`full: the HUD showed while Mind was still flying (opacity ${v.hudInFlight})`);
  const want = await greetingFor(page);
  const words = v.texts.join(' | ');
  if (!words.includes('G H O S T Y') && !words.includes('GHOSTY')) problems.push(`full: the name never showed (saw: ${words})`);
  if (!words.includes(want)) problems.push(`full: the greeting was not "${want}" (saw: ${words})`);
  const extra = v.texts.flatMap((t) => t.split(' | ')).map((t) => t.replace(/G H O S T Y|GHOSTY/g, '').replace(want, '').trim()).filter(Boolean);
  if (extra.length) problems.push(`full: something else was written on it (a status line?): ${extra.join(' / ')}`);
  // it lands on Home's real MIND: the canvas that flew is the one in the hero, to the pixel
  if (!s?.mind) problems.push('full: MIND did not draw the cinematic');
  const hp = await onHero(page);
  if (hp.count !== 1) problems.push(`full: ${hp.count} Mind canvases after the landing (want the one)`);
  if (!hp.inHero || JSON.stringify(hp.a) !== JSON.stringify(hp.b)) problems.push(`full: Mind is not in the hero's box after the landing: ${hp.a} vs ${hp.b}`);
  if (hp.mode !== 'mind') problems.push(`full: Home's hero is "${hp.mode}", not MIND`);
  const hud = await hudBack(page);
  if (hud.wait || hud.dock < 0.99 || hud.top < 0.99) problems.push(`full: the HUD did not come back after the landing (${JSON.stringify(hud)})`);
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
  if (s) timings.push(`full cold open (real time, software WebGL): first frame ${s.firstFrame} ms after the page started; ${line}; app ready underneath at ${s.appReady} ms; one MIND draw ${s.drawMs} ms; the boot layer gone ${s.firstFrame + s.ended} ms after the page started; ${wall} ms of test time from goto to Home`);
  await page.screenshot({ path: `${out}/boot-landed.png` });
  await ctx.close();
}

// ---- 2. a tap skips it
{
  const { ctx, page } = await open({ kind: 'full' });
  await page.goto(base);
  await until(page, () => (window.__bootState?.marks?.gather ?? -1) >= 0, 20000, 'skip: the cinematic never got going');
  const at = await page.evaluate(() => performance.now());
  await page.mouse.click(220, 700);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push('skip: the tap did not end it'));
  await page.waitForTimeout(400);
  const s = await state(page);
  const gone = s ? s.firstFrame + s.ended - at : 0;
  if (!s?.skipped) problems.push('skip: the tap was not taken as a skip');
  if (s && (s.marks.name !== undefined || s.marks.greeting !== undefined)) problems.push(`skip: it played on to the name or the greeting after the tap (${JSON.stringify(s.marks)})`);
  if (s?.spoken === 'now' || s?.spoken === 'tap' || s?.said) problems.push(`skip: the greeting was spoken after a skip (${s.spoken}, ${s.said})`);
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`skip: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  const hud = await hudBack(page);
  if (hud.wait || hud.dock < 0.99) problems.push(`skip: the HUD did not come back (${JSON.stringify(hud)})`);
  if (s) timings.push(`skip: the tap at ${Math.round(at - s.firstFrame)} ms after the first frame; ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; ended ${Math.round(gone)} ms after the tap (held ${s.held} ms for the app and Home's hero) (app ready at ${s.appReady} ms; ${s.frames} frames, worst gap ${s.worstGap} ms)`);

  // ---- 3. every cold open plays it: a second open (a reload is a new page, as a launch from the Home Screen is)
  await page.reload();
  await until(page, () => window.__bootState?.marks?.point === 0, 15000, 'second open: the cinematic never started');
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
  // its own part, without the wait for the app underneath and Home's hero (measured as s.held)
  const own = s?.kind === 'still' ? (s.marks.land ?? 0) - (s.marks.gather ?? 0) - s.held : 0;
  // (software WebGL draws a frame in up to a second or more here: a phase can only be seen to start on a drawn frame)
  if (s?.kind === 'still' && own > 800 + 2 * s.worstGap) problems.push(`reduce motion: ${own} ms from Mind to the landing (want 800, worst frame gap ${s.worstGap} ms)`);
  if (s) timings.push(`reduce motion: ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms (the point holds until MIND is drawing: ${s.marks.gather} ms here; then held ${s.held} ms for the app and Home's hero; app ready at ${s.appReady} ms; worst frame gap ${s.worstGap} ms)`);
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
  if (s) timings.push(`reboot: ${line}; hum ${s.sound ? 'played' : 'not played'}`);
  // a tap at each stage of a replay lands cleanly: on the hero to the pixel, the HUD back, nothing said after the tap
  // (software WebGL draws a frame in up to a second here, so a phase of a few hundred ms can pass between two frames:
  // the replay is held at the moment by hand, tapped there, then let run on its own clock to the landing)
  const AT = { point: 200, gather: 900, sphere: 1900, name: 2700, greeting: 3250, land: 3650 };
  for (const stage of Object.keys(AT)) {
    const n = (await state(page))?.plays ?? 0;
    await page.evaluate(() => {
      window.__ghostyBootManual = true;
      window.__ghosty.run('reboot');
    });
    const got = await until(page, (k) => window.__bootState.plays === k + 1 && window.__bootState.marks.point === 0, 15000, `skip at ${stage}: the replay never started`, n);
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
  if (s && !(s.ended - s.held <= 3900 + s.worstGap)) problems.push(`slow phone: it ran ${s.ended - s.held} ms (want shorter than the full cut)`);
  if (s) timings.push(`slow phone, its own choice: ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; budget ${B?.hz} Hz / ${B?.ms} ms: ${B?.long} of ${B?.gaps?.length} frames long; ended ${s.ended} ms`);
  await ctx.close();
  // the full cut, then the phone falling behind mid-flight: it leans (no depths, trails or refraction) and quickens
  const L = await open({ kind: 'full', lean: true });
  // every frame from the gathering on takes longer than a 60 Hz frame and a bit (as a phone that cannot keep up would)
  await L.page.addInitScript(() => {
    const burn = () => {
      if (window.__bootState?.marks?.gather !== undefined && document.getElementById('boot')) {
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
  const frames = [[250, 'point'], [800, 'gather'], [1175, 'refract'], [1850, 'sphere'], [2650, 'name'], [3050, 'tighten'], [3300, 'greeting'], [3720, 'land'], [3900, 'home']];
  /** Lit pixels of the depths' canvas outside Mind's box (the far dust and the near motes), and the name's state. */
  const probe = () => p2.evaluate(() => {
    const d = document.querySelector('#boot canvas.bdust');
    const m = document.querySelector('#boot canvas.mindhero')?.getBoundingClientRect();
    let lit = 0;
    if (d && m) {
      const g = d.getContext('2d');
      const k = d.width / innerWidth;
      const img = g.getImageData(0, 0, d.width, d.height).data;
      for (let y = 0; y < d.height; y += 2)
        for (let x = 0; x < d.width; x += 2) {
          const X = x / k;
          const Y = y / k;
          if (X > m.left && X < m.right && Y > m.top && Y < m.bottom) continue;
          if (img[(y * d.width + x) * 4 + 3] > 8) lit++;
        }
    }
    const spans = [...document.querySelectorAll('#boot .bword span')].map((s) => s.style.transform);
    const line = document.querySelector('#boot svg.bline');
    // (the instruments' light, with a box of its own: a glow filter on a box with no height draws nothing)
    const bar = line?.querySelector('.fl');
    return { lit, spans, line: line ? { t: line.style.transform, o: Number(line.style.opacity), inst: line.classList.contains('inst') && !!bar && bar.getBBox().height > 0 && bar.getBBox().width > 100 } : null, bloom: Number(document.querySelector('#boot .bbloom')?.style.opacity ?? 0) };
  });
  const seenAt = {};
  for (const [ms, name] of ready ? frames : []) {
    await p2.evaluate((t) => window.__bootSeek(t), ms);
    await p2.waitForTimeout(ms >= 3900 ? 900 : 350);
    if (ms < 3900) seenAt[name] = await probe();
    await p2.screenshot({ path: `${out}/boot-frame-${String(ms).padStart(4, '0')}-${name}.png` });
  }
  if (ready) {
    // the depths: motes of light round Mind, outside its own box, while the camera pushes in
    if (!(seenAt.gather?.lit > 40)) problems.push(`strip: no depths round Mind while it gathers (${seenAt.gather?.lit} lit pixels outside its box)`);
    // the name assembles a little wide, then tightens: its letters held apart, then home
    if (!seenAt.name?.spans?.some((t) => /translateX\(-?[1-9]/.test(t))) problems.push(`strip: the name did not assemble wide before tightening (${JSON.stringify(seenAt.name?.spans)})`);
    if (seenAt.tighten?.spans?.some((t) => t)) problems.push(`strip: the name had not tightened by 3.05 s (${JSON.stringify(seenAt.tighten?.spans)})`);
    // one thin line under it, the instruments' own line, drawn by then
    const ln = seenAt.tighten?.line;
    if (!ln?.inst || !/scaleX\(1(\.0+)?\)/.test(ln.t) || ln.o < 0.99) problems.push(`strip: the line under the name was not drawn by 3.05 s (${JSON.stringify(ln)})`);
    // the greeting's breath of bloom
    if (!(seenAt.greeting?.bloom > 0.3)) problems.push(`strip: no bloom on the greeting (${seenAt.greeting?.bloom})`);
    timings.push(`strip: depths ${seenAt.gather?.lit} lit pixels round Mind at 800 ms; letters at 2650 ms ${JSON.stringify(seenAt.name?.spans)}; line at 3050 ms ${seenAt.tighten?.line?.t}; bloom at 3300 ms ${seenAt.greeting?.bloom}`);
  }
  await c2.close();
}

await browser.close();
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'BOOT run clean at 440 × 956: the full cut (3.5–4.5 s) came in order and on time (point, gather, sphere, name, greeting, land) with the app booting underneath and its frame budget honest in __bootState, no number and no status line on it, the old spinner, engine lines and INITIALISING gone, his greeting spoken once on the first tap of a cold open, landed on Home\'s real MIND to the pixel with three.js loaded once and the HUD a beat after; a tap skipped it on a cold open and at every stage of a replay; a second cold open played it again, while a resume, a page back from the back-forward cache and a deep link only breathed; Reduce Motion faded with nothing moving; "reboot" played it again over Home and said the greeting at once, once; a phone that could not keep up counted its long frames and got a shorter cut; the depths, the tightening, the line and the bloom were drawn; automated checks saw none of it.');
process.exit(problems.length ? 1 : 0);
