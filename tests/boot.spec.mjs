// The boot cinematic (apps/web/src/shell/boot.ts; docs/build-plan/BRIEF-BOOT.md): MIND waking up, on the iPhone 18 Pro
// Max's 440 × 956 with software WebGL (SwiftShader, as tests/hero.spec.mjs runs MIND). Checks, each of which fails on the
// old boot (a spinner, engine lines and "INITIALISING…"):
//   1. the full cinematic: its frames come in order (point, gather, sphere, name, greeting, land), its own part is over
//      3.5 s after its first frame (plus what the app underneath needed), nothing on it is a number or a status line, the
//      old spinner, engine lines and "INITIALISING…" are gone, the greeting is his ("Good evening, Tony."), it is not
//      spoken on a cold open until the first tap (and is then), the app booted underneath (Home was there before it
//      ended), and it lands on Home's real MIND: the same canvas, in the hero's box to the pixel, three.js loaded once;
//   2. a tap skips it;  3. every cold open plays it: a second cold open (a reload: a new page) plays the full cinematic
//   again, while a resume (coming back to the running app, or a page restored from the back-forward cache) and a deep
//   link play only Mind's breath;  4. Reduce Motion: the frames fade, nothing moves;  5. "reboot" plays it again over Home (and SYSTEM has the
//   line);  6. automated checks (no flag) see no cinematic at all.
// It also photographs each moment (the cinematic stepped by hand) into a strip, and prints the timings it measured.
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
async function open({ reducedMotion = 'no-preference', flag = true, kind = '', manual = false, hero = true } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, flag, kind, manual, hero }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: true }));
    if (hero) window.__ghostyHero = true; // MIND draws (automated checks otherwise get the 2-D reactor: mind.ts)
    if (flag) window.__ghostyBoot = true; // this check wants the cinematic (others never see it: boot.ts)
    if (kind) window.__ghostyBootKind = kind; // software WebGL is slow: keep the full version, as the phone plays it
    if (manual) window.__ghostyBootManual = true;
    // The phone's rule on a cold open: no sound or speech until a real tap. (Playwright's own page.evaluate counts as
    // a user gesture in Chromium, so the page is told only about real taps, as iOS would see them.)
    window.__tapped = false;
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, (e) => e.isTrusted && (window.__tapped = true), true);
    try {
      Object.defineProperty(Navigator.prototype, 'userActivation', { configurable: true, get: () => ({ get hasBeenActive() { return window.__tapped; }, get isActive() { return false; } }) });
    } catch { /* left as it is */ }
    // what the overlay showed, sampled every frame: its words, and whether anything moved
    window.__seen = { texts: new Set(), digits: [], moved: [], old: [] };
    const look = () => {
      const b = document.getElementById('boot');
      if (b) {
        const t = (b.innerText || '').trim();
        if (t) window.__seen.texts.add(t.replace(/\s+/g, ' '));
        if (/\d/.test(b.textContent || '')) window.__seen.digits.push(b.textContent);
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
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, { key: KEY, flag, kind, manual, hero });
  await stubLibrary(page);
  const three = [];
  page.on('request', (r) => /three\.module/.test(r.url()) && three.push(r.url()));
  return { ctx, page, three };
}
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__bootState ?? null)));
const seen = (page) => page.evaluate(() => ({ texts: [...window.__seen.texts], digits: window.__seen.digits.slice(0, 3), moved: window.__seen.moved.slice(0, 5), old: window.__seen.old.slice(0, 2) }));
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

// ---- 1. the full cinematic, in real time
{
  const { ctx, page, three } = await open({ kind: 'full' });
  const t0 = Date.now();
  await page.goto(base);
  await until(page, () => window.__bootState?.marks?.point === 0, 15000, 'the cinematic never started');
  // the app keeps booting underneath: Home is built before the cinematic ends
  await until(page, () => !!document.querySelector('.hud.core canvas.reactor') && !!document.getElementById('boot'), 20000, 'Home was not built underneath while the cinematic played');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the cinematic never ended'));
  const wall = Date.now() - t0;
  const s = await state(page);
  const v = await seen(page);
  const marks = ORDER.map((p) => s?.marks?.[p]);
  if (s?.kind !== 'full') problems.push(`full: it played "${s?.kind}", not the full cinematic`);
  if (marks.some((m) => typeof m !== 'number')) problems.push(`full: a frame never came: ${JSON.stringify(s?.marks)}`);
  for (let i = 1; i < marks.length; i++) if (!(marks[i] >= marks[i - 1])) problems.push(`full: ${ORDER[i]} (${marks[i]} ms) came before ${ORDER[i - 1]} (${marks[i - 1]} ms)`);
  // its own part is over by 3.5 s; anything after is the app underneath still starting (measured, and said). A frame is
  // only seen when it is drawn, so the slowest gap between two frames (software WebGL here) is allowed on top.
  const waitedForApp = s && s.appReady > (s.marks.land ?? 0) - 1;
  if (!waitedForApp && s && s.ended > 3500 + s.worstGap) problems.push(`full: it ended at ${s.ended} ms, after the 3.5 s cap (worst frame gap ${s.worstGap} ms)`);
  if (s && s.appReady >= 0 && s.ended < s.appReady) problems.push(`full: it ended (${s.ended} ms) before the app underneath was ready (${s.appReady} ms)`);
  if (v.old.length) problems.push(`full: the old boot is still there: ${v.old[0]}`);
  if (v.digits.length) problems.push(`full: a number on the cinematic: ${v.digits[0]}`);
  const want = await greetingFor(page);
  const words = v.texts.join(' | ');
  if (!words.includes('G H O S T Y') && !words.includes('GHOSTY')) problems.push(`full: the name never showed (saw: ${words})`);
  if (!words.includes(want)) problems.push(`full: the greeting was not "${want}" (saw: ${words})`);
  const extra = v.texts.flatMap((t) => t.split(' | ')).map((t) => t.replace(/G H O S T Y|GHOSTY/g, '').replace(want, '').trim()).filter(Boolean);
  if (extra.length) problems.push(`full: something else was written on it (a status line?): ${extra.join(' / ')}`);
  // it lands on Home's real MIND: the canvas that flew is the one in the hero, to the pixel
  if (!s?.mind) problems.push('full: MIND did not draw the cinematic');
  const L = s?.landed;
  if (!L || !L.hero.length || L.flight.some((x, i) => Math.abs(x - L.hero[i]) > 1.5)) problems.push(`full: it did not land on the hero: flight ${JSON.stringify(L?.flight)} vs hero ${JSON.stringify(L?.hero)}`);
  await page.waitForTimeout(300);
  const hp = await onHero(page);
  if (hp.count !== 1) problems.push(`full: ${hp.count} Mind canvases after the landing (want the one)`);
  if (!hp.inHero || JSON.stringify(hp.a) !== JSON.stringify(hp.b)) problems.push(`full: Mind is not in the hero's box after the landing: ${hp.a} vs ${hp.b}`);
  if (hp.mode !== 'mind') problems.push(`full: Home's hero is "${hp.mode}", not MIND`);
  if (three.length !== 1) problems.push(`full: three.js was requested ${three.length} times (want once, shared by the boot and Home)`);
  // the voice: a cold open has had no tap, so nothing was spoken (and no hum) until the first tap
  if (s?.spoken !== 'waiting') problems.push(`full: the greeting was "${s?.spoken}" before any tap (want: waiting for the first tap)`);
  if (s?.sound) problems.push('full: the hum played on a cold open with no tap (the phone would refuse it)');
  await page.mouse.click(220, 560);
  await page.waitForTimeout(200);
  const s2 = await state(page);
  if (s2?.spoken !== 'tap') problems.push(`full: the first tap did not speak the greeting ("${s2?.spoken}")`);
  if (s) timings.push(`full (real time, software WebGL): first frame ${s.firstFrame} ms after the page started; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; app ready underneath at ${s.appReady} ms; held ${s.held} ms for Home's hero; one MIND draw ${s.drawMs} ms; ended at ${s.ended} ms (the boot layer gone ${s.firstFrame + s.ended} ms after the page started); ${s.frames} frames, worst gap ${s.worstGap} ms; ${wall} ms of test time from goto to Home`);
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
  const s = await state(page);
  const gone = s ? s.firstFrame + s.ended - at : 0;
  if (!s?.skipped) problems.push('skip: the tap was not taken as a skip');
  if (s && (s.marks.name !== undefined || s.marks.greeting !== undefined)) problems.push(`skip: it played on to the name or the greeting after the tap (${JSON.stringify(s.marks)})`);
  if (s?.spoken === 'now' || s?.spoken === 'tap') problems.push(`skip: the greeting was spoken after a skip (${s.spoken})`);
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`skip: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  if (s) timings.push(`skip: the tap at ${Math.round(at - s.firstFrame)} ms after the first frame; ${s.kind}; ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; ended ${Math.round(gone)} ms after the tap (held ${s.held} ms for the app and Home's hero) (app ready at ${s.appReady} ms; ${s.frames} frames, worst gap ${s.worstGap} ms)`);

  // ---- 3. every cold open plays it: a second open (a reload is a new page, as a launch from the Home Screen is)
  await page.reload();
  await until(page, () => window.__bootState?.marks?.point === 0, 15000, 'second open: the cinematic never started');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('second open: the cinematic never ended'));
  const w = await state(page);
  if (w?.kind !== 'full') problems.push(`second open: a second cold open played "${w?.kind}" (want the full cinematic every cold open)`);
  if (ORDER.some((p) => typeof w?.marks?.[p] !== 'number')) problems.push(`second open: frames missing: ${JSON.stringify(w?.marks)}`);
  if (w?.skipped) problems.push('second open: it was skipped with no tap');
  if (w) timings.push(`second cold open: ${w.kind}; ${ORDER.map((p) => `${p} ${w.marks[p]}`).join(' · ')} ms`);
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

// ---- 5. "reboot" plays it again over Home; SYSTEM has the line
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
  const s = await state(page);
  if (!s?.mind || !s.landed?.hero?.length || s.landed.flight.some((x, i) => Math.abs(x - s.landed.hero[i]) > 1.5)) problems.push(`reboot: it did not land on the hero: ${JSON.stringify(s?.landed)}`);
  if (ORDER.some((p) => typeof s?.marks?.[p] !== 'number')) problems.push(`reboot: frames missing: ${JSON.stringify(s?.marks)}`);
  const hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`reboot: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  if (three.length !== 1) problems.push(`reboot: three.js was requested ${three.length} times`);
  // a reboot comes from a tap: the greeting is spoken at once (the voice is on)
  if (s?.spoken !== 'now') problems.push(`reboot: the greeting was "${s?.spoken}" (want spoken at once after a tap)`);
  if (!s?.sound) problems.push('reboot: the hum did not play (the voice is on and he had tapped)');
  if (s) timings.push(`reboot: ${ORDER.map((p) => `${p} ${s.marks[p]}`).join(' · ')} ms; hum ${s.sound ? 'played' : 'not played'}`);
  await ctx.close();
}

// ---- 6. automated checks without the flag: no cinematic, the black goes as soon as the app is up
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

// ---- the frame strip: each moment photographed, the cinematic stepped by hand (the same drawing, held still)
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
  const frames = [[200, 'point'], [700, 'gather'], [1150, 'sweep'], [1800, 'sphere'], [2450, 'name'], [3000, 'greeting'], [3340, 'land'], [3500, 'home']];
  for (const [ms, name] of ready ? frames : []) {
    await p2.evaluate((t) => window.__bootSeek(t), ms);
    await p2.waitForTimeout(ms >= 3500 ? 900 : 350);
    await p2.screenshot({ path: `${out}/boot-frame-${String(ms).padStart(4, '0')}-${name}.png` });
  }
  await c2.close();
}

await browser.close();
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'BOOT run clean at 440 × 956: the full cinematic came in order (point, gather, sphere, name, greeting, land) with the app booting underneath, no number and no status line on it, the old spinner, engine lines and INITIALISING gone, his greeting spoken on the first tap of a cold open, landed on Home\'s real MIND to the pixel with three.js loaded once; a tap skipped it; a second cold open played the full cinematic again, while a resume, a page back from the back-forward cache and a deep link only breathed; Reduce Motion faded with nothing moving; "reboot" played it again over Home; automated checks saw none of it.');
process.exit(problems.length ? 1 : 0);
