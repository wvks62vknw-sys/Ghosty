// THE BOOT FILM, BACK (FINAL-ROUND, lane BOOT; docs/build-plan/FINAL-BOOT.md). The owner, 13 Nov: "currently the boot-up cinematic is like
// non-existent? It's definitely not the 7 second one we made". The film (features/core/scan/film.ts, conducted by shell/boot.ts) only ever
// played when a check picked the version (window.__ghostyBootKind): left to choose for itself, as on his phone, the film decided at the orb's
// 2,000 ms, which is always past the 1,700 ms by which Mind had to be drawing, so every real cold open fell to the 1.7 s flat cut with no film.
// Every check here opens the app as his phone does: NO version picked, Mind drawing (software GL), the cinematic left to choose. Each fails on
// the code before FINAL-BOOT:
//   1. a cold open plays THE FILM, the full cut, its whole length: 7,000 ms of its own to a usable Home (never cut short, never more than the
//      film plus what the app underneath needed), every shot in order, the scan, the descent and the things found run to the end, every frame
//      counted (the frames, the gaps, the frame rate it drew at, printed), at 440 × 956 and 390 × 844;
//   2. THE HAND-OVER: the orb's last place in the film is Home's hero to the pixel, the one Mind in the hero, the HUD a beat after, and nothing
//      moves after the landing (the hero where the film left it half a second later);
//   3. a tap skips it: the landing at once, no greeting after the tap;
//   4. Reduce Motion: the calm still version (two frames, 1.2 s), nothing travelling;
//   5. the reopen rule: under three minutes since he last had Ghosty on screen, a cold open plays the short cut (4,800 ms); after that, the
//      whole film again; the first open ever, the whole film.
//   BASE=http://localhost:8788 node tests/bootfilm.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const FILM = { ground: 0, floor: 500, orb: 2000, stamp: 3100, feeds: 4000, recognise: 4900, greeting: 5400, land: 6500, end: 7000 };
const ORDER = ['ground', 'floor', 'orb', 'stamp', 'feeds', 'recognise', 'greeting', 'land'];
const problems = [];
const report = [];
const t0 = Date.now();
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** His phone, signed in, opened cold on Home: the cinematic left to choose its own version (no __ghostyBootKind). `lastSeen`: ms ago he last had it on screen. */
async function open({ viewport = PHONE, reducedMotion = 'no-preference', lastSeen = 0, set = {} } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, lastSeen, set }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, ...set }));
    // (once only, before the first load: the reload in check 5 must see the stamp the page itself wrote)
    if (lastSeen && !sessionStorage.getItem('bootfilm.seeded')) {
      sessionStorage.setItem('bootfilm.seeded', '1');
      localStorage.setItem('ghosty.lastopen', String(Date.now() - lastSeen));
    }
    window.__ghostyHero = true; // MIND draws, as on his phone (automated checks otherwise get the 2-D reactor)
    window.__ghostyBoot = true; // the cinematic plays (automated checks otherwise never see it); its version is NOT picked here
  }, { key: KEY, lastSeen, set });
  return { ctx, page };
}
const state = (page) => page.evaluate(() => {
  const s = window.__bootState;
  return s && JSON.parse(JSON.stringify({ ...s, score: undefined }));
});
const ended = async (page, what, ms = 45000) => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: ms }).catch(() => problems.push(`${what}: the boot never ended`));
  await page.waitForTimeout(300);
  return state(page);
};
const landedOk = (L) => !!L && !!L.hero?.length && !L.flight.some((x, i) => Math.abs(x - L.hero[i]) > 1.5);
/** Mind in Home's hero (as tests/boot.spec.mjs reads it): the one canvas, and the box it is drawn in (the stage's orb box on The Scan). */
const onHero = (page) => page.evaluate(() => {
  const gl = [...document.querySelectorAll('canvas.mindhero')];
  const r2 = document.querySelector('.hud.core canvas.reactor');
  const st = window.__ghosty?.hero?.stage;
  const a0 = gl[0]?.getBoundingClientRect();
  const b = r2?.getBoundingClientRect();
  const a = st?.on && st.rect ? st.rect : a0 && [a0.x, a0.y, a0.width, a0.height].map((v) => Math.round(v));
  const bb = b && [b.x, b.y, b.width, b.height].map((v) => Math.round(v));
  const inHero = !!gl[0] && (st?.on ? !!gl[0].closest('.scanstage') && JSON.stringify(a) === JSON.stringify(bb) : gl[0].parentElement === r2?.parentElement);
  return { count: gl.length, inHero, a, b: bb, staged: !!st?.on };
});
const fps = (s) => (s.ended > 0 ? Math.round((s.frames / (s.ended / 1000)) * 10) / 10 : 0);
const line = (s) => `${s.kind}${s.film ? ' (the film)' : ''}: ${ORDER.map((p) => `${p} ${s.marks?.[p]}`).join(' · ')} ms; ended ${s.ended} ms (held ${s.held} for the app, its own ${s.ended - s.held}); pace ${s.pace}; ${s.frames} frames (${fps(s)} a second here), worst gap ${s.worstGap} ms, frame work worst ${s.budget?.work} ms mean ${s.budget?.avg} ms, ${s.budget?.long} long at ${s.budget?.hz} Hz${s.budget?.lean ? `, leaned at ${s.budget.lean}` : ''}; Mind's draw ${s.drawMs} ms; app ready ${s.appReady} ms; first frame ${s.firstFrame} ms after the page began`;

/** The whole film, as a cold open plays it: the checks of 1 and 2. */
function checkFilm(s, what) {
  if (!s) return problems.push(`${what}: no state`);
  if (s.kind !== 'full' || !s.film) problems.push(`${what}: it played "${s.kind}"${s.film ? '' : ' without the film'}, not the full film (the bug: a cold open fell to the flat cut)`);
  const tl = s.timeline;
  if (!tl || tl.end !== FILM.end) problems.push(`${what}: the cut is ${tl?.end} ms long (the film's is 7,000)`);
  for (const [p, at] of Object.entries(FILM)) if (tl && tl[p] !== at) problems.push(`${what}: the cut has ${p} at ${tl[p]} ms (the film: ${at})`);
  const marks = ORDER.map((p) => s.marks?.[p]);
  if (marks.some((m) => typeof m !== 'number')) problems.push(`${what}: a shot never came: ${JSON.stringify(s.marks)}`);
  for (let i = 1; i < marks.length; i++) if (!(marks[i] >= marks[i - 1])) problems.push(`${what}: ${ORDER[i]} (${marks[i]} ms) before ${ORDER[i - 1]} (${marks[i - 1]} ms)`);
  // its whole length: never cut short (the film is the film), never longer than the film plus what the app underneath needed
  const own = s.ended - s.held;
  const tol = s.worstGap + 120;
  if (own < FILM.end - tol) problems.push(`${what}: the film ran ${own} ms of its own, cut short of its 7,000 (worst frame gap ${s.worstGap})`);
  if (own > FILM.end + tol) problems.push(`${what}: the film ran ${own} ms of its own, longer than its 7,000 (worst frame gap ${s.worstGap})`);
  if (s.ended > Math.max(FILM.end, s.appReady + 400) + tol + s.held) problems.push(`${what}: the first use came at ${s.ended} ms, later than the film (7,000) or the app (${s.appReady})`);
  // the wait for Mind made up by the pace, but never rushed (a quarter quicker at most), and never quickened by a lean
  if (!(s.pace >= 1 && s.pace <= 1.3)) problems.push(`${what}: the film ran at pace ${s.pace} (want 1 to 1.3: the wait for Mind made up, never rushed)`);
  // the scan, the descent and the things found ran their course, on frames the film drew
  const f = s.scan;
  if (!f || !(f.build >= 0.99) || !(f.edge >= 0.99) || !(f.descent >= 0.99)) problems.push(`${what}: the film did not run its course: ${JSON.stringify(f && { build: f.build, edge: f.edge, descent: f.descent })}`);
  if (!f || Object.keys(f.things).length < 4 || !(f.frames > 0)) problems.push(`${what}: the film found ${f ? Object.keys(f.things).length : 0} things and drew ${f?.frames} frames`);
  // every frame counted, honestly
  const B = s.budget;
  if (!B || B.gaps.length !== Math.min(600, s.frames - 1)) problems.push(`${what}: ${B?.gaps?.length} gaps recorded for ${s.frames} frames`);
  if (B && B.long !== B.gaps.filter((g) => g > B.ms).length) problems.push(`${what}: ${B.long} long frames counted, ${B.gaps.filter((g) => g > B.ms).length} gaps over ${B.ms} ms`);
  if (!(s.frames >= ORDER.length)) problems.push(`${what}: only ${s.frames} frames drawn`);
  // 2. the hand-over: on the hero to the pixel, the HUD a beat after
  if (!landedOk(s.landed)) problems.push(`${what}: it did not land on the hero: flight ${JSON.stringify(s.landed?.flight)} vs hero ${JSON.stringify(s.landed?.hero)}`);
  if (!(s.hudAt >= s.ended + 60)) problems.push(`${what}: the HUD came in at ${s.hudAt} ms, not a beat after the landing (${s.ended} ms)`);
}
/** The one Mind in the hero, the boot's layer gone, the HUD back, and nothing moving after the landing (the hero box now, and half a second later, is where the film left the orb). */
async function checkHandOver(page, s, what) {
  let hp = await onHero(page);
  for (let t = Date.now(); Date.now() - t < 6000 && !(hp.count === 1 && hp.inHero); await page.waitForTimeout(150)) hp = await onHero(page);
  if (hp.count !== 1 || !hp.inHero) problems.push(`${what}: Mind did not end up in the hero (${JSON.stringify(hp)})`);
  const r = await page.evaluate(() => ({ boot: !!document.getElementById('boot'), booting: document.body.classList.contains('booting'), wait: document.body.classList.contains('bootwait') }));
  if (r.boot || r.booting || r.wait) problems.push(`${what}: the boot's layer or its hold is still there after the landing (${JSON.stringify(r)})`);
  await page.waitForTimeout(500);
  const later = await onHero(page);
  const L = s?.landed?.hero ?? [];
  for (const [when, box] of [['at the landing', hp.b], ['half a second later', later.b]])
    if (!box || L.length !== 4 || box.some((v, i) => Math.abs(v - L[i]) > 1.5)) problems.push(`${what}: Home's hero ${when} is ${JSON.stringify(box)}, the film landed the orb on ${JSON.stringify(L)} (something jumped)`);
}

// ---- 1 + 2. the cold open at both widths: the whole film, and the hand-over
for (const [vp, tag] of [[PHONE, '440'], [SMALL, '390']]) {
  const what = `cold open ${tag}`;
  const { ctx, page } = await open({ viewport: vp });
  await page.goto(base);
  await page.waitForFunction(() => window.__bootState?.marks?.ground === 0, null, { timeout: 20000 }).catch(() => problems.push(`${what}: the cinematic never started`));
  // the film photographed mid-flight (the descent and the orb forming), then the landing
  await page.waitForFunction(() => (window.__bootState?.marks?.orb ?? -1) >= 0, null, { timeout: 30000 }).catch(() => undefined);
  await page.screenshot({ path: `${out}/bootfilm-${tag}-orb.png` }).catch(() => undefined);
  const s = await ended(page, what);
  checkFilm(s, what);
  await checkHandOver(page, s, what);
  await page.screenshot({ path: `${out}/bootfilm-${tag}-home.png` }).catch(() => undefined);
  if (s) report.push(`${what}: ${line(s)}`);
  await ctx.close();
}

// ---- 3. a tap skips it: the landing at once, no greeting after the tap
{
  const what = 'skip';
  const { ctx, page } = await open();
  await page.goto(base);
  await page.waitForFunction(() => (window.__bootState?.marks?.orb ?? -1) >= 0 && window.__bootState.film, null, { timeout: 30000 }).catch(() => problems.push(`${what}: the film never reached the orb`));
  const at = await page.evaluate(() => performance.now());
  await page.touchscreen.tap(220, 700).catch(() => page.mouse.click(220, 700));
  const s = await ended(page, what, 15000);
  if (!s?.skipped) problems.push(`${what}: the tap was not taken as a skip`);
  if (s && (s.marks.recognise !== undefined || s.marks.greeting !== undefined)) problems.push(`${what}: it played on to the recognition or the greeting after the tap (${JSON.stringify(s.marks)})`);
  const gone = s ? s.firstFrame + s.ended - at : 0;
  if (s && gone - s.held > 1200 + s.worstGap) problems.push(`${what}: it took ${Math.round(gone)} ms after the tap to land (held ${s.held} for the app)`);
  if (!landedOk(s?.landed)) problems.push(`${what}: it did not land on the hero: ${JSON.stringify(s?.landed)}`);
  if (s) report.push(`${what}: the tap at ${Math.round(at - s.firstFrame)} ms; landed ${Math.round(gone)} ms after it; ${s.kind}, film ${s.film}`);
  await ctx.close();
}

// ---- 4. Reduce Motion: the calm still version, nothing travelling
{
  const what = 'Reduce Motion';
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await page.goto(base);
  const s = await ended(page, what);
  if (s?.kind !== 'still') problems.push(`${what}: it played "${s?.kind}", not the calm still version`);
  if (s?.timeline?.end !== 1200) problems.push(`${what}: the still version is ${s?.timeline?.end} ms (want 1,200: two frames)`);
  // (the still version holds its first frame until Mind draws, then its second frame and the landing come at its own pace: 1,000 ms from the orb)
  if (s && s.ended - s.held - (s.marks?.orb ?? 0) > 1000 + s.worstGap + 120) problems.push(`${what}: it ran ${s.ended - s.held - (s.marks?.orb ?? 0)} ms after Mind came (want 1,000: two frames)`);
  if (s && !(s.pace >= 1 && s.pace <= 1.01)) problems.push(`${what}: the still version ran at pace ${s.pace} (want 1: never hurried)`);
  if (s && s.budget?.lean) problems.push(`${what}: the still version leaned (${s.budget.lean})`);
  if (s?.mind && !landedOk(s.landed)) problems.push(`${what}: it did not land on the hero: ${JSON.stringify(s?.landed)}`);
  if (s) report.push(`${what}: ${line(s)}`);
  await ctx.close();
}

// ---- 5. the reopen rule: under three minutes, the short cut; after that, the whole film; and a reload of the first is a quick reopen
{
  const what = 'quick reopen';
  const { ctx, page } = await open({ lastSeen: 60_000 });
  await page.goto(base);
  const s = await ended(page, what);
  if (s?.kind !== 'short' || !s?.quick) problems.push(`${what}: a cold open a minute after he last had it on screen played "${s?.kind}" (quick ${s?.quick}, ${s?.reopen} ms) (want the short cut)`);
  if (s?.film && s.timeline?.end !== 4800) problems.push(`${what}: the short cut is ${s.timeline?.end} ms (want 4,800)`);
  if (s && !(s.reopen >= 55_000 && s.reopen < 180_000)) problems.push(`${what}: it measured ${s.reopen} ms since he last had it on screen (want about 60,000)`);
  if (s && s.ended - s.held > Math.max(4800, (s.marks?.floor ?? 0) + 4500 / 1.25) + s.worstGap + 120) problems.push(`${what}: the short cut ran ${s.ended - s.held} ms of its own (want 4,800, or a late Mind's wait made up at most a quarter quicker)`);
  if (s && !(s.pace >= 1 && s.pace <= 1.25)) problems.push(`${what}: the short cut ran at pace ${s.pace} (want 1 to 1.25: never rushed)`);
  if (!landedOk(s?.landed)) problems.push(`${what}: it did not land on the hero: ${JSON.stringify(s?.landed)}`);
  if (s) report.push(`${what} (a minute away): ${line(s)}`);
  // a reload is a cold open too: the page stamped its leaving a moment ago, so it is a quick reopen as well
  await page.reload();
  const r = await ended(page, 'reload');
  if (r?.kind !== 'short' || !r?.quick || !(r.reopen >= 0 && r.reopen < 60_000)) problems.push(`reload: a cold open a moment after leaving played "${r?.kind}" (quick ${r?.quick}, ${r?.reopen} ms)`);
  await ctx.close();
}
{
  const what = 'reopen after four minutes';
  const { ctx, page } = await open({ lastSeen: 4 * 60_000 });
  await page.goto(base);
  const s = await ended(page, what);
  if (s?.quick || !(s?.reopen >= 235_000)) problems.push(`${what}: taken as a quick reopen (quick ${s?.quick}, ${s?.reopen} ms)`);
  checkFilm(s, what);
  if (s) report.push(`${what}: ${line(s)}`);
  await ctx.close();
}
{
  // the first open ever on this phone: no stamp at all, the whole film (check 1 opened fresh phones too: said here by its own name)
  const { ctx, page } = await open();
  await page.goto(base);
  const s = await ended(page, 'first open ever');
  if (s?.reopen !== -1 || s?.quick || s?.kind !== 'full') problems.push(`first open ever: ${s?.kind}, reopen ${s?.reopen}, quick ${s?.quick} (want the full film, -1, false)`);
  await ctx.close();
}

// ---- 6. THE NEXT ROUND (docs/build-plan/next/boot.md): the opening his way
// a. how long: SHORT plays the short cut on a cold open with nothing before it; ONCE A DAY plays the whole film on the day's first open
//    and the short cut on a later one the same day; FULL FILM (the default) the whole film
{
  const a = await open({ set: { bootLength: 'short' } });
  await a.page.goto(base);
  const s = await ended(a.page, 'length: short');
  if (s?.kind !== 'short' || !s.film || s.quick) problems.push(`length: SHORT played "${s?.kind}" (film ${s?.film}, quick ${s?.quick}) on a first open (want the short film)`);
  await a.ctx.close();
  // (anchored to London's midnight, as CI runs at any hour: "earlier today" is at most 40 minutes ago and never before midnight)
  const sinceMidnight = await (async () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' })); return (d.getHours() * 60 + d.getMinutes()) * 60_000 + d.getSeconds() * 1000; })();
  if (sinceMidnight > 5 * 60_000) {
    const b = await open({ set: { bootLength: 'daily' }, lastSeen: Math.min(40 * 60_000, sinceMidnight - 60_000) });
    await b.page.goto(base);
    const t = await ended(b.page, 'length: once a day, later the same day');
    if (t?.kind !== 'short' || t.quick) problems.push(`length: ONCE A DAY played "${t?.kind}" (quick ${t?.quick}) on a later open the same day (want the short film)`);
    await b.ctx.close();
  }
  const c = await open({ set: { bootLength: 'daily' }, lastSeen: sinceMidnight + 3 * 3_600_000 });
  await c.page.goto(base);
  const u = await ended(c.page, 'length: once a day, first open');
  if (u?.kind !== 'full' || !u.film) problems.push(`length: ONCE A DAY played "${u?.kind}" on the day's first open (want the whole film)`);
  // b. the jobs that can wait waited for the landing, and went once it was done
  if (!(u?.deferred > 0) || !(u?.deferredAt >= 0 && u.deferredAt >= u.ended - 1)) problems.push(`start-up: the jobs that can wait did not wait for the landing (deferred ${u?.deferred}, let go at ${u?.deferredAt} ms, landed ${u?.ended} ms)`);
  // c. how smoothly it ran: kept on the phone, said in Settings and in the chat in the same words
  const run = await c.page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.lastboot') ?? 'null'));
  if (!run || run.kind !== 'full' || !run.film || Math.abs(run.ms - (u.ended - u.held)) > 2 || run.frames !== u.frames) problems.push(`run: the last opening's run kept as ${JSON.stringify(run)} (the boot said ${u?.kind}, ${u ? u.ended - u.held : '?'} ms, ${u?.frames} frames)`);
  await c.page.evaluate(() => (location.hash = 'settings'));
  await c.page.waitForSelector('[data-id="bootrun"]', { state: 'attached', timeout: 15000 }).catch(() => problems.push('run: Settings has no line for how the last opening ran'));
  const line = await c.page.evaluate(() => document.querySelector('[data-id="bootrun"]')?.textContent ?? '');
  if (!/^The last opening played the whole film in \d+\.\d seconds, \d+ frames a second, (with no stutter|with one small catch \(\d+ ms\)|with a stutter of \d+ ms)\.$/.test(line)) problems.push(`run: Settings says "${line}"`);
  report.push(`run line: ${line}`);
  await c.ctx.close();
}
// d. the greeting that remembers: away three days, "Welcome back, Tony. It's been three days."; his own lines take turns; a guest he named, once
{
  const a = await open({ lastSeen: 3 * 86_400_000 + 3_600_000 });
  await a.page.goto(base);
  const s = await ended(a.page, 'greeting: away three days');
  if (s?.greeting !== 'Welcome back, Tony. It’s been three days.') problems.push(`greeting: away three days it said "${s?.greeting}"`);
  await a.ctx.close();
  const b = await open({ set: { bootLines: 'Systems up, Tony.\n\nBack to work.' } });
  await b.page.goto(base);
  const t1 = await ended(b.page, 'greeting: his own line');
  await b.page.reload();
  const t2 = await ended(b.page, 'greeting: his own line, the next open');
  if (t1?.greeting !== 'Systems up, Tony.' || t2?.greeting !== 'Back to work.') problems.push(`greeting: his own lines said "${t1?.greeting}" then "${t2?.greeting}" (want them in turn)`);
  await b.ctx.close();
  const c = await open({ set: { bootGuest: { name: 'Sam', until: Date.now() + 3_600_000 } } });
  await c.page.goto(base);
  const g1 = await ended(c.page, 'greeting: a guest');
  const hr = await c.page.evaluate(() => new Date().getHours());
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  await c.page.reload();
  const g2 = await ended(c.page, 'greeting: after the guest');
  if (g1?.greeting !== `${part}, Sam.` || !/Tony\.$/.test(g2?.greeting ?? '')) problems.push(`greeting: the guest's opening said "${g1?.greeting}", the next "${g2?.greeting}" (want Sam once, then Tony)`);
  await c.ctx.close();
}
// e. by words, on the phone: the length set, the run said, a guest refused when he has not introduced them; and Settings' keys at both widths
for (const [vp, tag] of [[PHONE, '440'], [SMALL, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await page.goto(base);
  await ended(page, `words ${tag}`);
  const say = async (text, want) => {
    const at = await page.evaluate(() => Date.now());
    await page.evaluate((t) => window.__ghosty.send(t), text);
    const ok = await page.waitForFunction(([w, at]) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => Number(m.dataset.at ?? Date.now()) >= at - 50 && new RegExp(w).test(m.textContent ?? '')), [want, at], { timeout: 15000 }).then(() => true).catch(() => false);
    if (!ok) problems.push(`words ${tag}: "${text}" did not answer /${want}/`);
  };
  await say('short opening', 'The opening: short\\. The five-second cut on every open\\.');
  const len = await page.evaluate(() => window.__ghosty.settings.get().bootLength);
  if (len !== 'short') problems.push(`words ${tag}: "short opening" left the length "${len}"`);
  await say('opening once a day', 'The opening: once a day\\.');
  await say('how did the opening run?', '^.*The last opening played ');
  await say("Sam's turn", 'I only greet people you’ve introduced');
  const guest = await page.evaluate(() => window.__ghosty.settings.get().bootGuest);
  if (guest?.name) problems.push(`words ${tag}: a guest nobody introduced was kept: ${JSON.stringify(guest)}`);
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('[data-id="bootlength"]', { state: 'attached', timeout: 15000 }).catch(() => problems.push(`settings ${tag}: no keys for the opening's length`));
  // (Settings → VOICE & HOME: its row tapped, as he would)
  await openPanel(page, 'settings', 'VOICE & HOME');
  await page.waitForFunction(() => (document.querySelector('[data-id="bootlength"] button')?.getBoundingClientRect().height ?? 0) > 0, null, { timeout: 8000 }).catch(() => undefined);
  const keys = await page.evaluate(() => {
    const row = document.querySelector('[data-id="bootlength"]');
    row?.scrollIntoView();
    return [...(row?.querySelectorAll('button') ?? [])].map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent ?? '').trim(), w: Math.round(r.width), h: Math.round(r.height), on: b.getAttribute('aria-checked'), cut: b.scrollWidth > b.clientWidth + 1, right: Math.round(r.right) }; });
  });
  const vw = vp.width;
  if (keys.length !== 3 || keys.some((k) => k.w < 44 || k.h < 44 || k.cut || k.right > vw) || keys.find((k) => k.on === 'true')?.t.toUpperCase() !== 'ONCE A DAY') problems.push(`settings ${tag}: the opening's keys ${JSON.stringify(keys)} (want three, 44 pt, whole, inside the screen, ONCE A DAY on)`);
  await page.screenshot({ path: `${out}/bootfilm-${tag}-settings.png` }).catch(() => undefined);
  await ctx.close();
}

// f. what matters today (boot.u2): a to-do due today is the line the search ends on (unless the diary has a next thing, which comes first);
//    offline (boot.s10): one line says so and what still works; the director's mode (boot.u12) steps the opening shot by shot and lands
{
  const day = await (async () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const { ctx, page } = await open();
  await page.addInitScript((day) => {
    if (!localStorage.getItem('ghosty.agenda.todo')) localStorage.setItem('ghosty.agenda.todo', JSON.stringify([{ id: 't1', text: 'Pay the window cleaner', due: day, done: false, at: Date.now() - 3_600_000 }]));
  }, day);
  await page.goto(base);
  const seenToday = await page.waitForFunction(() => { const e = document.querySelector('#boot .btoday'); return e && !e.hidden && Number(e.style.opacity) > 0.5 ? e.textContent : null; }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  const s = await ended(page, 'today');
  const line = s?.todayLine ?? '';
  if (!(line === 'Due today · Pay the window cleaner' || /^Today · (\d{2}:\d{2}|All day|By \d{2}:\d{2}) · .+/.test(line)) || seenToday !== line) problems.push(`today: the opening's day line was "${line}", seen on screen as "${seenToday}" (want the to-do due today, or the diary's next thing)`);
  report.push(`today line: ${line}`);
  // the director's mode, by words: the bar, the first shot, NEXT, then DONE lands on Home with Mind in the hero
  await page.evaluate(() => window.__ghosty.send('director mode'));
  const first = await page.waitForFunction(() => document.querySelector('#bdirector .bdline')?.textContent || null, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
  const keys = await page.evaluate(() => [...document.querySelectorAll('#bdirector button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: Math.round(r.width), h: Math.round(r.height) }; }));
  await page.click('#bdirector button:nth-child(2)').catch(() => undefined);
  const second = await page.evaluate(() => document.querySelector('#bdirector .bdline')?.textContent ?? '');
  const phase = await page.evaluate(() => window.__bootState.phase);
  await page.click('#bdirector button.on').catch(() => undefined);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push('director: DONE did not land'));
  const after = await page.evaluate(() => ({ bar: !!document.getElementById('bdirector'), manual: !!window.__ghostyBootManual, landed: window.__bootState.landed }));
  if (first !== '1 of 10 · The eye opens · 0.0 s' || second !== '2 of 10 · The scan · 0.5 s' || phase !== 'floor') problems.push(`director: the shots read "${first}" then "${second}" (phase ${phase})`);
  if (keys.length !== 3 || keys.some((k) => k.w < 44 || k.h < 44)) problems.push(`director: its keys ${JSON.stringify(keys)} (want PREV, NEXT, DONE at 44 pt)`);
  if (after.bar || after.manual || !landedOk(after.landed)) problems.push(`director: after DONE ${JSON.stringify(after)}`);
  await ctx.close();
  const o = await open();
  await o.page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await o.page.goto(base);
  const seenOff = await o.page.waitForFunction(() => { const e = document.querySelector('#boot .boffline'); return e && !e.hidden ? e.textContent : null; }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  const so = await ended(o.page, 'offline');
  const OFF = ['Working offline: I still answer from this phone, and what is saved here opens.', 'Working offline: what is saved on this phone opens; answers wait for a signal.'];
  if (!OFF.includes(so?.offlineLine) || seenOff !== so?.offlineLine) problems.push(`offline: the opening's line was "${so?.offlineLine}", seen as "${seenOff}"`);
  await o.ctx.close();
}

// g. the score in his colour's key (boot.u7): after a real tap (iOS allows no sound before one) "reboot" plays the score, in Blue's key
//    (A) with the hour's texture; in Orange it plays three semitones up; at night the third goes minor
{
  const { ctx, page } = await open({ set: { sounds: true, bootScore: true } });
  await page.goto(base);
  await ended(page, 'score');
  await page.touchscreen.tap(220, 300).catch(() => undefined);
  const tuneOf = async (what) => {
    await page.evaluate(() => window.__ghosty.send('reboot'));
    await page.waitForFunction(() => !!window.__bootState?.score?.tuning, null, { timeout: 20000 }).catch(() => problems.push(`score: ${what}: no score played after a tap`));
    const t = await page.evaluate(() => ({ ...window.__bootState.score.tuning, on: window.__bootState.score.on, hr: new Date().getHours() }));
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    return t;
  };
  const a = await tuneOf('Blue');
  const night = a.hr < 6 || a.hr >= 21;
  if (!a.on || a.key !== 0 || Math.abs(a.third - (night ? 1.1892 : 1.2599)) > 1e-4 || a.minor !== night) problems.push(`score: in Blue at ${a.hr}:00 it played ${JSON.stringify(a)} (want key 0, ${night ? 'the minor third at night' : 'the major third by day'})`);
  await page.evaluate(() => window.__ghosty.run('set_theme', { theme: 'ember' }));
  const b = await tuneOf('Orange');
  if (!b.on || b.key !== 3 || Math.abs(b.ratio - Math.pow(2, 3 / 12)) > 1e-6) problems.push(`score: in Orange it played ${JSON.stringify(b)} (want three semitones up)`);
  report.push(`score: Blue key ${a.key} bright ${a.bright}, Orange key ${b.key}`);
  await ctx.close();
}

await browser.close();
for (const r of report) console.log(`  ${r}`);
if (problems.length) {
  console.error(`\nbootfilm: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`ok bootfilm (${Math.round((Date.now() - t0) / 1000)} s): a cold open left to choose plays THE FILM, the full cut, its whole 7,000 ms (at 440 and 390), every shot in order, every frame counted; the hand-over on the hero to the pixel with the HUD a beat after and nothing moving after; a tap skips to the landing; Reduce Motion the calm still 1,200 ms; a quick reopen (under three minutes) the short cut 4,800 ms, after four minutes and on the first open ever the whole film; THE NEXT ROUND: its length his way (SHORT, ONCE A DAY), the jobs that can wait waiting for the landing, how it ran kept and said, the greeting that remembers, his own lines in turn, a guest once, by words and by Settings' keys at 440 and 390, today's line, the offline line and the director's mode`);
