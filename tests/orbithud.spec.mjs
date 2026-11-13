// ORBIT, the fifth whole HUD (BRIEF-ORBIT-HUD; apps/web/src/shell/orbit.ts, features/core/orbit/home.ts, shell/areas.ts hubs, show/stage.ts,
// styles.css ORBIT): no bar, the orb is the way in; on the owner's 440 × 956 and a 390 × 844 phone (every check fails on the code before this
// brief: it was run against it once):
//   a. THE GALLERY: ORBIT's card has no COMING; a tap sets recipe.world 'orbit' at once, says YOU'RE IN IT, survives a reload; a tap on THE
//      SCAN brings The Scan back; "orbit" by words switches to it again (no model), the colour staying his; "the eye" still says its line;
//   b. HOME IS THE ORBIT: the stamp, the greeting and one sentence, the orb centred, six stations with their words and exactly one lit,
//      the capsule with recents then favourites, the hint line present then gone after ten presses (counted on the phone), no tab bar, no
//      ask bar, no gauges; nothing sideways; every control 44 pt; a station tap opens its hub; an orb press opens the typed word with
//      Recent and Starred first; the hour's card as the book and as the Brief;
//   c. THE ORB ON EVERY SCREEN: LEARN and Settings with no tab bar, the orb bottom-left with the line, the page ending above it; hold
//      350 ms fans six rooms, slide to PLAN and release opens PLAN's hub, release on none closes it; the plan from the line's left end
//      shows seven rooms; the jump bar finds "rad" → RADIO under 300 ms;
//   d. A HUB IS LAYERS BY DISTANCE FROM THE ORB: the rest, then the favourites, then the recent card nearest the orb on its thread with
//      its panels as chips;
//   e. THE STAGE: a seeded map grows as a sphere from the orb and shrinks back; a seeded document is the rounded page with the bezel;
//   f. THE SPEED HABIT: Home in ORBIT under 300 ms (median of five); under Reduce Motion no animation runs on the ring or the orb's line;
//   g. THE BIGGEST TEXT: Home and a hub at BODY 21 on 390 × 844: nothing sideways, every control 44 pt;
//   h. nothing of ORBIT in THE SCAN, ONE INK, THE MAP, THE EYE or Glass (their Home, LEARN and Settings' key facts as before), and nothing
//      of theirs in ORBIT.
// (the finding rule in all worlds is apps/edge/test/finding.test.mjs)
//   BASE=http://localhost:8816 node tests/orbithud.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const timings = [];
const check = (ok, what) => ok || problems.push(what);
const KEY = 'preview-owner-key-0123456789';
const T0 = Date.now();
const BUDGET = 300;
const ORBIT = { ground: 'black', world: 'orbit', night: 'black', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const MAP = { ground: 'slate', world: 'map', night: 'slate', switches: {} };
const EYE = { ground: 'black', world: 'eye', night: 'black', switches: {} };
const WIDE = { width: 390, height: 844 };
const ROOMS = ['see', 'make', 'learn', 'plan', 'life', 'me'];

/** A phone opened on Ghosty, signed in, his name Boss, in the look asked for; `book`: a book on the go; `pins`: his favourites. */
async function open({ viewport = PHONE, look = ORBIT, book = false, pins = ['lens', 'agenda'], recents = null, once = true, reduced = false, body = 17, show = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, look, book, pins, recents, once, body, show }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!once || !localStorage.getItem('spec.orbit.seeded')) {
      localStorage.setItem('spec.orbit.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look: { ...look, switches: { ...look.switches, body } }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (book) localStorage.setItem('ghosty.places', JSON.stringify({ map: { 'alices-adventures-in-wonderland.pdf': { n: 4, off: 0, page: 42, pct: 0.37, done: false, at: Date.now() - 86_400_000 } } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
    }
    if (show) window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the stopwatch's tests (timed() below): Home drawn, a hub's layers drawn, the jump bar open with its first rows
    window.__orbitTests = {
      home: () => { const f = document.querySelector('.orbframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('orbithome') && !!r && r.width > 0 && document.querySelectorAll('.orbst').length === 6 && !!document.querySelector('.orbhost')?.getBoundingClientRect().width; },
      hub: () => document.body.dataset.tab === 'area-see' && !!document.querySelector('#pg-area-see .orblayer')?.getBoundingClientRect().width,
      jump: () => { const p = document.querySelector('#palette.on'); const r = p?.querySelector('input')?.getBoundingClientRect(); return !!r && r.width > 0 && !!p.querySelector('.jgroup, .jempty'); },
    };
  }, { key: KEY, look, book, pins, recents, once, body, show });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(700);
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
/** Everything that can be pressed on the page, drawn: 44 pt, and nothing wider than the screen. */
const floor = (page, W, scope, skip = 'canvas, .orbrings') => page.evaluate(([W, scope, skip]) => {
  const bad = [];
  const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  for (const b of document.querySelectorAll(`${scope} button, ${scope} [role="button"]`)) {
    if (!seen(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`target "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll(`${scope} *`)) {
    if (!seen(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest(skip) && !e.matches(skip)) bad.push(`sideways: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push(`the page scrolls sideways: ${document.documentElement.scrollWidth}`);
  return bad;
}, [W, scope, skip]);
const settingsLook = (page) => page.evaluate(() => window.__ghosty.settings.get().look?.world ?? null);
/** Click a thing and the ms until a named test is true on a frame (the phone's own stopwatch; the tests live in the page: its policy forbids building code from strings). */
async function timed(page, click, name) {
  await page.evaluate((name) => {
    window.__orbit_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const f = window.__orbitTests[name];
      const tick = () => {
        if (f()) window.__orbit_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, name);
  await click();
  await page.waitForFunction(() => window.__orbit_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__orbit_t);
}
const HOME_READY = () => { const f = document.querySelector('.orbframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('orbithome') && !!r && r.width > 0 && document.querySelectorAll('.orbst').length === 6; };
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** Hold the orb on the line 450 ms (the hold is 350) and leave the finger down. */
async function holdOrb(page) {
  const b = await page.locator('#dock .orbbtn').boundingBox();
  const c = centre(b);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  return c;
}

// (a check that cannot get as far as its next step says where it stopped, and the run still reports every problem found before it)
try {
// ---- a. the gallery: ORBIT's card, a tap, a reload, THE SCAN back, the words
{
  const { ctx, page } = await open({ look: SCAN, once: true });
  const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
  const themePage = async () => {
    await go(page, 'settings');
    await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
    await openSection(page, 'settings', 'Appearance').catch(() => undefined);
    await page.locator('#pg-settings .scanset button.srow').filter({ has: page.locator('.srname', { hasText: /^Theme$/i }) }).first().click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open'));
    await page.waitForSelector(card('orbit'), { timeout: 8000 }).catch(() => problems.push('[gallery] the Theme page has no ORBIT card'));
    await page.waitForTimeout(400);
  };
  await themePage();
  const o0 = await page.evaluate((sel) => ({ coming: !!document.querySelector(`${sel} .gg-coming`), built: document.querySelector(sel)?.dataset.built, label: document.querySelector(sel)?.getAttribute('aria-label') }), card('orbit'));
  check(!o0.coming && o0.built === 'true', `[gallery] ORBIT's card is still COMING: ${JSON.stringify(o0)}`);
  const comings = await page.$$eval('#pg-settings .gg-look', (bs) => bs.filter((b) => b.querySelector('.gg-coming')).map((b) => b.dataset.look));
  check(comings.join() === '', `[gallery] COMING is on ${comings} (want none: all seven looks are built)`);
  await page.click(card('orbit'));
  await until(page, () => document.documentElement.dataset.world === 'orbit', 5000, '[gallery] a tap on ORBIT did not make the world orbit');
  const said = (k) => page.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
  const s1 = await said('orbit');
  check(s1.on === 'true' && /you.re in it/i.test(s1.line) && /ORBIT/i.test(s1.head), `[gallery] ORBIT after its tap: ${JSON.stringify(s1)}`);
  check((await settingsLook(page)) === 'orbit', '[gallery] ORBIT was not kept in his settings');
  // THE LOOK's Orbit plate says what Orbit now is, and never the old line
  const plate = await page.evaluate(() => document.body.innerText);
  check(!/a way round, not a look/i.test(plate), '[gallery] the old line "a way round, not a look" is still on the page');
  await page.screenshot({ path: `${out}/orbit-gallery.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.documentElement.dataset.world === 'orbit'), '[gallery] ORBIT did not survive a reload');
  await themePage();
  await page.click(card('scan'));
  await until(page, () => document.documentElement.dataset.world === 'scan', 5000, '[gallery] a tap on THE SCAN did not bring The Scan back');
  const s2 = await said('scan');
  check(s2.on === 'true' && /you.re in it/i.test(s2.line), `[gallery] THE SCAN after its tap: ${JSON.stringify(s2)}`);
  // "orbit" by words: no model, the world at once, the colour his (he is on Ember: it stays)
  await page.click('#pg-settings .pn.themepn.pushed .gg-sw[data-colour="ember"]');
  await until(page, () => document.documentElement.dataset.theme === 'ember', 5000, '[words] the ember swatch did not apply');
  const asked = [];
  page.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('scanhome'), 10000, '[words] Home did not wear The Scan before the words');
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  // (every look is built: none answers with a coming line; checked after the words below)
  await page.fill('#cin', 'orbit');
  await page.press('#cin', 'Enter');
  await until(page, () => document.documentElement.dataset.world === 'orbit', 8000, '[words] "orbit" did not make the world orbit');
  const wd = await page.evaluate(() => ({ colour: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, said: [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => /Orbit/.test(t)).pop() ?? '' }));
  check(wd.colour === 'ember' && wd.saved === 'ember', `[words] "orbit" changed his colour: ${JSON.stringify(wd)}`);
  check(/Orbit: on\./.test(wd.said), `[words] "orbit" answered "${wd.said}"`);
  check(!(await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /is coming/.test(m.textContent ?? '')))), '[words] a look answered that it is coming: all seven are built');
  check(!asked.length, `[words] the brain was asked ${asked.length} times for "orbit"`);
  await ctx.close();
}

// ---- b. Home is the orbit, at 440 and at 390
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, book: true, recents: ['library', 'eye', 'brief'] });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[home ${tag}] Home never became the orbit`);
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const text = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const box = (e) => e && (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(e.getBoundingClientRect());
    const st = [...document.querySelectorAll('.orbst')];
    return {
      stamp: text('.orbmast .g-stamp'), say: text('.orbsay'), say2: text('.orbsay2'), sayFont: css(q('.orbsay'), 'font-size'),
      host: box(q('.orbhost')), ring: box(q('.orbplace')), hostCanvas: !!q('.orbhost canvas'),
      stations: st.map((b) => ({ room: b.dataset.room, word: b.querySelector('.orbnm')?.textContent, hot: b.classList.contains('hot'), box: box(b), disc: box(b.querySelector('.orbdisc')) })),
      capsule: [...document.querySelectorAll('.orbcap .orbitem')].map((b) => ({ id: b.dataset.id, kind: b.dataset.kind, name: b.querySelector('b')?.textContent, line: b.querySelector('small')?.textContent ?? '', h: Math.round(b.getBoundingClientRect().height) })),
      more: !!q('.orbcap .orbmore'),
      hint: q('.orbhint') && seen(q('.orbhint')) ? text('.orbhint') : '',
      hour: { kick: text('.orbhour .orbkick'), name: text('.orbhour .orbname'), line: text('.orbhour .orbhourline') },
      state: window.__ghosty.orbitHome && JSON.parse(JSON.stringify({ ...window.__ghosty.orbitHome, clock: null })),
      hidden: ['.cside', '#cbar', '.rcwx', '.rcbelow', '#dock .tabcap', '#dock .orbline', '#dock .houseask', '.gauges', '.gauge'].filter((s) => [...document.querySelectorAll(s)].some(seen)),
      dock: css(q('#dock'), 'display'), top: css(q('#top'), 'display'), glow: css(document.documentElement, '--g-glow'),
      blur: [...document.querySelectorAll('.orbframe, .orbframe *')].filter((e) => seen(e) && ((getComputedStyle(e).backdropFilter && getComputedStyle(e).backdropFilter !== 'none') || (getComputedStyle(e).webkitBackdropFilter && getComputedStyle(e).webkitBackdropFilter !== 'none'))).length,
      shadows: [...document.querySelectorAll('.orbframe *')].filter((e) => seen(e) && /rgba?\([^)]*\) [-\d.]+px [-\d.]+px [1-9]/.test(getComputedStyle(e).boxShadow.replace(/inset /g, '')) && !/^0px 0px/.test(getComputedStyle(e).boxShadow.replace(/rgba?\([^)]*\) /, ''))).length,
      frame: box(q('.orbframe')), W: innerWidth, ground: css(document.documentElement, '--g-canvas'),
    };
  });
  check(/^(SUN|MON|TUE|WED|THU|FRI|SAT) \d{1,2} [A-Z]{3} · \d{2}:\d{2} · BIRMINGHAM · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(h.stamp), `[home ${tag}] the stamp reads "${h.stamp}"`);
  check(/^Good (morning|afternoon|evening|night), Boss\.$/.test(h.say) && h.say2.length > 3, `[home ${tag}] the greeting is "${h.say}" and the sentence "${h.say2}"`);
  check(h.state && h.state.on && h.state.line === h.say2 && h.say2, `[home ${tag}] the sentence is not the one text the state holds: ${JSON.stringify({ line: h.state?.line, say2: h.say2 })}`);
  check(h.hostCanvas && h.host && Math.abs(h.host[0] + h.host[2] / 2 - h.W / 2) <= 2 && Math.abs(h.host[2] - h.host[3]) <= 1 && h.host[2] >= 120, `[home ${tag}] the orb's box ${h.host} is not centred (screen ${h.W} wide) or not round`);
  check(h.ring && Math.abs(h.host[1] + h.host[3] / 2 - (h.ring[1] + h.ring[3] / 2)) <= 2, `[home ${tag}] the orb is not at the centre of its ring: ${h.host} in ${h.ring}`);
  check(h.stations.map((s) => s.room).join() === ROOMS.join() && h.stations.map((s) => s.word).join() === 'See,Make,Learn,Plan,Life,Me', `[home ${tag}] the stations are ${h.stations.map((s) => `${s.room}:${s.word}`)}`);
  check(h.stations.filter((s) => s.hot).map((s) => s.room).join() === 'learn', `[home ${tag}] with a book on the go the lit station is ${h.stations.filter((s) => s.hot).map((s) => s.room)} (want learn)`);
  // the stations stand on the ring, an equal distance from the orb, in the mock's places (See upper right, Make right, Learn lower right, Plan lower left, Life left, Me upper left)
  const cx = h.host && h.host[0] + h.host[2] / 2;
  const cy = h.host && h.host[1] + h.host[3] / 2;
  const dist = h.stations.map((s) => Math.round(Math.hypot(s.disc[0] + s.disc[2] / 2 - cx, s.disc[1] + s.disc[3] / 2 - cy)));
  const NONE = [NaN, NaN];
  check(dist.length === 6 && Math.max(...dist) - Math.min(...dist) <= 2, `[home ${tag}] the stations are not on one ring: ${dist}`);
  const at = Object.fromEntries([...ROOMS.map((r) => [r, NONE]), ...h.stations.map((s) => [s.room, [s.disc[0] + s.disc[2] / 2 - cx, s.disc[1] + s.disc[3] / 2 - cy]])]);
  check(at.see[0] > 0 && at.see[1] < 0 && at.make[0] > 0 && Math.abs(at.make[1]) < 3 && at.learn[0] > 0 && at.learn[1] > 0 && at.plan[0] < 0 && at.plan[1] > 0 && at.life[0] < 0 && Math.abs(at.life[1]) < 3 && at.me[0] < 0 && at.me[1] < 0, `[home ${tag}] the stations are not in the mock's places: ${JSON.stringify(at)}`);
  check(h.stations.length === 6 && h.stations.every((s) => s.disc[2] >= 44 && s.disc[3] >= 44 && s.box[2] >= 44 && s.box[3] >= 44), `[home ${tag}] a station is under 44 pt: ${JSON.stringify(h.stations.map((s) => s.disc))}`);
  // the capsule: recents then favourites (library is the newest recent; lens and agenda are his stars), each a name and one true reading
  check(h.state?.capsule?.map((c) => `${c.kind}:${c.id}`).join() === 'recent:library,recent:eye,recent:brief,favourite:lens,favourite:agenda', `[home ${tag}] the capsule's order is ${h.state?.capsule?.map((c) => `${c.kind}:${c.id}`)}`);
  check(h.capsule.length === 3 && h.capsule.map((c) => c.kind).join() === 'recent,favourite,favourite' && h.capsule[0].id === 'library' && h.more, `[home ${tag}] the capsule shows ${JSON.stringify(h.capsule.map((c) => `${c.kind}:${c.id}`))} (want the newest recent, then his two stars, and the dots)`);
  check(h.capsule.every((c) => c.name && c.line.length > 2 && c.h >= 44), `[home ${tag}] a capsule item has no name or no true reading: ${JSON.stringify(h.capsule)}`);
  check(h.hint === 'Press me to ask, or to find anything.', `[home ${tag}] the hint line is "${h.hint}"`);
  check(/^Carry on reading$/i.test(h.hour.kick) && /Alice/.test(h.hour.name) && /^Page 42 · 37 % read · you were here yesterday$/.test(h.hour.line), `[home ${tag}] the hour's card: ${JSON.stringify(h.hour)}`);
  check(!h.hidden.length && h.dock === 'none' && h.top === 'none', `[home ${tag}] a tab bar, ask bar, gauge or house line is drawn: ${h.hidden}; dock ${h.dock}; top ${h.top}`);
  check(h.blur === 0 && h.shadows === 0, `[home ${tag}] nothing may blur or cast a shadow in this world: blur ${h.blur}, shadows ${h.shadows}`);
  check(h.frame && h.frame[1] <= 1 && h.frame[1] + h.frame[3] >= (vp === PHONE ? 950 : 838), `[home ${tag}] the sky does not fill the screen: ${h.frame}`);
  const bad = await floor(page, vp.width, '.orbframe');
  check(!bad.length, `[home ${tag}] the floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/orbit-home-${tag}.png` });
  // a station tap opens its hub (one tap from Home)
  await page.click('.orbst[data-room="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[home ${tag}] a tap on LEARN's station did not open its hub`);
  await page.click('#top .navback');
  await until(page, HOME_READY, 10000, `[home ${tag}] a hub's way back did not bring Home`);
  // a capsule item opens its screen (a tap), and a long press pins or unpins as the deck does
  await page.click('.orbcap .orbitem[data-id="library"]');
  await until(page, () => document.body.dataset.tab === 'library', 8000, `[home ${tag}] a tap on a capsule item did not open it`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back`);
  const hold = page.locator('.orbcap .orbitem[data-kind="recent"]').first();
  const id = await hold.getAttribute('data-id');
  const hb = await hold.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#pinsheet'), 4000, `[home ${tag}] a long press on a capsule item did not open the pin sheet`);
  check((await page.evaluate(() => document.body.dataset.tab)) === 'core', `[home ${tag}] the long press opened the screen under the sheet`);
  await page.click('#pinsheet [data-pin="pin"]');
  await until(page, (id) => window.__ghosty.orbitHome.capsule.some((c) => c.id === id && c.kind === 'favourite'), 4000, `[home ${tag}] the pinned item ${id} did not move among his favourites`, id);
  // an orb press opens the typed word, Recent and Starred first; ten presses and the hint is gone (counted on the phone)
  await page.click('.orbhost');
  await page.waitForSelector('#palette.on input', { timeout: 5000 }).catch(() => problems.push(`[home ${tag}] a press on the orb did not open the typed word`));
  const j = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#palette .jgroup')].map((g) => g.dataset.group), placeholder: document.querySelector('#palette input')?.placeholder, first: [...document.querySelectorAll('#palette .jgroup[data-group="Favourites"] .jchip, #palette .jgroup[data-group="Recent"] .jchip')].length }));
  check(j.groups.join() === 'Favourites,Recent' && j.first >= 3 && j.placeholder === 'Type a word', `[home ${tag}] the typed word opened with ${JSON.stringify(j)}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  for (let i = 1; i < 9; i++) {
    await page.click('.orbhost');
    await page.waitForSelector('#palette.on', { timeout: 3000 }).catch(() => undefined);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  check((await page.evaluate(() => window.__ghosty.orbit.presses)) === 9 && (await page.locator('.orbhint').isVisible()), `[home ${tag}] after nine presses the hint should still be there (${await page.evaluate(() => window.__ghosty.orbit.presses)})`);
  await page.click('.orbhost');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check((await page.evaluate(() => window.__ghosty.orbit.presses)) === 10 && !(await page.locator('.orbhint').isVisible()), `[home ${tag}] after ten presses the hint line is still there`);
  check((await page.evaluate(() => Number(localStorage.getItem('ghosty.orbit.presses')))) === 10, `[home ${tag}] the presses are not counted on the phone`);
  await ctx.close();
}

// ---- b2. the thing of the hour: the Brief (no book), and the lit station with it
{
  const { ctx, page } = await open({ book: false });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[hour] Home never became the orbit');
  await page.waitForTimeout(600);
  const brief = await page.evaluate(() => ({ t: window.__ghosty.orbitHome.tonight, lit: window.__ghosty.orbitHome.lit, hot: [...document.querySelectorAll('.orbst.hot')].map((b) => b.dataset.room), name: document.querySelector('.orbhour .orbname')?.textContent }));
  check(brief.t.kind === 'brief' && brief.name === 'The Brief' && brief.hot.join() === 'plan' && brief.lit === 'plan', `[hour] with no book and nothing in the agenda the thing is ${JSON.stringify(brief)}`);
  await ctx.close();
}

// ---- c. the orb on every screen: LEARN, Settings; the fan; the plan from the line's end; the jump bar
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[line ${tag}] Home never became the orbit`);
  await page.click('.orbst[data-room="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[line ${tag}] the LEARN station did not open the room`);
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const seen = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const box = (e) => e && (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(e.getBoundingClientRect());
    const pgs = [...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none');
    return { orb: box(q('#dock .orbbtn')), line: box(q('#dock .orbline')), plan: box(q('#dock .orbplan')), field: box(q('#dock .orbfield')), mic: box(q('#dock .orbmic')), words: q('#dock .orbwords')?.textContent, bar: ['#dock .tabcap', '#dock .houseask', '#dock .housekick'].filter((s) => seen(q(s))), pageBottom: Math.max(...pgs.map((p) => Math.round(p.getBoundingClientRect().bottom)), 0), thread: seen(q('#dock .orbthread')), ask: seen(q('#cbar')), W: innerWidth, H: innerHeight, housed: document.body.classList.contains('housed'), view: window.__ghosty.orbit.view };
  });
  check(!l.bar.length && l.housed, `[line ${tag}] LEARN still draws a bar: ${l.bar}`);
  check(l.orb && l.orb[2] === 56 && l.orb[3] === 56 && l.orb[0] <= 32 && l.orb[1] + 56 >= l.H - 24, `[line ${tag}] the orb is not 56 pt at the bottom left: ${l.orb} (screen ${l.W}×${l.H})`);
  check(l.line && l.line[0] + l.line[2] >= l.W - 24 && l.field && l.field[0] > l.orb[0] + 56, `[line ${tag}] the line does not run from the orb to the right edge: ${l.line}`);
  check(l.plan && l.plan[2] >= 44 && l.plan[3] >= 44 && l.plan[0] < l.field[0] && l.mic[2] >= 44, `[line ${tag}] the plan's key (left end, next to the orb) or the mic is under 44 pt: ${l.plan} ${l.mic}`);
  check(l.words === 'Find anything in Learn', `[line ${tag}] the line says "${l.words}"`);
  check(l.pageBottom > 0 && l.pageBottom <= l.line[1] + 1, `[line ${tag}] LEARN's page ends at ${l.pageBottom}, under the line at ${l.line[1]}`);
  check(l.view === 'standin' || l.view === 'mind', `[line ${tag}] the orb on the line is drawn as "${l.view}" (the one Mind's view or its 2-D stand-in)`);
  check(await page.evaluate(() => document.querySelectorAll('canvas.orbview').length === 1 && document.querySelectorAll('canvas.mindhero').length <= 1), `[line ${tag}] the second view costs a second renderer`);
  const bad = await floor(page, vp.width, '#stage > .pg, #dock .orbline');
  check(!bad.length, `[line ${tag}] LEARN's floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/orbit-learn-${tag}.png` });
  // hold 350 ms: the six rooms fan round the orb; slide to PLAN and let go: PLAN's hub
  await holdOrb(page);
  await until(page, () => window.__ghosty.orbit.fan && document.querySelectorAll('#switcher:not([hidden]) .switem').length === 6, 3000, `[fan ${tag}] holding the orb did not fan six rooms`);
  await page.waitForTimeout(900);
  const fan = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#switcher .switem')].map((b) => b.dataset.id), boxes: [...document.querySelectorAll('#switcher .switem .swring')].map((b) => (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(b.getBoundingClientRect())), names: [...document.querySelectorAll('#switcher .switem .swnm')].map((b) => b.textContent), touch: getComputedStyle(document.querySelector('#dock .orbbtn')).webkitTouchCallout || getComputedStyle(document.querySelector('#dock .orbbtn')).touchAction, blur: getComputedStyle(document.querySelector('#switcher .swdim')).backdropFilter }));
  check(fan.ids.join() === ROOMS.join() && fan.names.join() === 'See,Make,Learn,Plan,Life,Me', `[fan ${tag}] the fan holds ${fan.ids} (${fan.names})`);
  check(fan.boxes.every((b) => b[2] >= 44 && b[3] >= 44 && b[0] >= 0 && b[0] + b[2] <= vp.width), `[fan ${tag}] a room on the fan is under 44 pt or off screen: ${JSON.stringify(fan.boxes)}`);
  const gaps = fan.boxes.slice(1).map((b, i) => Math.hypot(b[0] - fan.boxes[i][0], b[1] - fan.boxes[i][1]));
  check(gaps.every((g) => g >= 44), `[fan ${tag}] two rooms on the fan are closer than 44 pt: ${gaps.map(Math.round)}`);
  check(fan.blur === 'none', `[fan ${tag}] the fan's dimmer blurs (${fan.blur})`);
  await page.screenshot({ path: `${out}/orbit-fan-${tag}.png` });
  const plan = fan.boxes[ROOMS.indexOf('plan')];
  await page.mouse.move(plan[0] + plan[2] / 2, plan[1] + plan[3] / 2, { steps: 6 });
  await until(page, () => window.__ghosty.orbit.on === 'plan', 2000, `[fan ${tag}] sliding onto PLAN did not light it`);
  const cap = await page.evaluate(() => document.querySelector('#switcher[data-fan] .swt')?.textContent ?? '');
  check(/markets|days|radio/i.test(cap), `[fan ${tag}] on PLAN the fan says "${cap}" (want its line)`);
  await page.mouse.up();
  await until(page, () => document.body.dataset.tab === 'area-plan', 6000, `[fan ${tag}] letting go on PLAN did not open PLAN's hub`);
  check(await page.evaluate(() => !document.querySelector('#switcher:not([hidden])') && !window.__ghosty.orbit.fan), `[fan ${tag}] the fan is still open after the let-go`);
  // hold and let go on none: nothing
  await holdOrb(page);
  await until(page, () => window.__ghosty.orbit.fan, 3000, `[fan ${tag}] the second hold did not fan`);
  await page.mouse.move(vp.width / 2, 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.body.dataset.tab === 'area-plan' && !document.querySelector('#switcher:not([hidden])') && !window.__ghosty.orbit.fan), `[fan ${tag}] letting go on none did something (tab ${await page.evaluate(() => document.body.dataset.tab)})`);
  // a plain tap is the typed word, not the fan
  await page.click('#dock .orbbtn');
  await page.waitForSelector('#palette.on input', { timeout: 5000 }).catch(() => problems.push(`[fan ${tag}] a press on the line's orb did not open the typed word`));
  check(await page.evaluate(() => !window.__ghosty.orbit.fan), `[fan ${tag}] a press opened the fan`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // the plan from the left end of the line: seven rooms, the one he is in lit
  await page.click('#dock .orbplan');
  await until(page, () => !!document.querySelector('#plan'), 4000, `[plan ${tag}] a tap on the line's left end did not open the plan`);
  const pl = await page.evaluate(() => ({ rooms: [...document.querySelectorAll('#plan .planroom')].map((r) => r.querySelector('.rtitle')?.textContent), things: document.querySelectorAll('#plan .planthing').length, lit: document.querySelector('#plan .planroom.lit .rtitle')?.textContent, bottom: Math.round(document.querySelector('#plan').getBoundingClientRect().bottom), lineTop: Math.round(document.querySelector('#dock .orbline').getBoundingClientRect().top), expanded: document.querySelector('#dock .orbplan').getAttribute('aria-expanded'), radius: getComputedStyle(document.querySelector('#plan .planroom')).borderTopLeftRadius }));
  check(pl.rooms.join() === 'HOME,SEE,MAKE,LEARN,PLAN,LIFE,ME' && pl.things > 30 && pl.lit === 'PLAN' && pl.bottom <= pl.lineTop + 12 && pl.expanded === 'true' && pl.radius !== '0px', `[plan ${tag}] the plan: ${JSON.stringify(pl)}`);
  await page.screenshot({ path: `${out}/orbit-plan-${tag}.png` });
  await page.click('#dock .orbplan');
  await until(page, () => !document.querySelector('#plan'), 3000, `[plan ${tag}] a second tap did not fold the plan`);
  // Settings: the line says its words, the page ends above it
  await go(page, 'settings');
  await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ words: document.querySelector('#dock .orbwords')?.textContent, bar: !!document.querySelector('#dock .tabcap')?.getClientRects().length, lineTop: Math.round(document.querySelector('#dock .orbline').getBoundingClientRect().top), bottom: Math.max(...[...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length).map((p) => Math.round(p.getBoundingClientRect().bottom))), title: document.querySelector('#top .navtitle')?.textContent.trim(), sets: document.querySelectorAll('#pg-settings .scanset button.srow').length }));
  check(st.words === 'Find a setting' && !st.bar && st.bottom <= st.lineTop + 1 && /SETTINGS/i.test(st.title ?? '') && st.sets > 5, `[line ${tag}] Settings: ${JSON.stringify(st)}`);
  await page.screenshot({ path: `${out}/orbit-settings-${tag}.png` });
  const sbad = await floor(page, vp.width, '#stage > .pg, #dock .orbline');
  check(!sbad.length, `[line ${tag}] Settings' floor: ${sbad.slice(0, 6).join('; ')}`);
  // the jump bar: "rad" finds RADIO under 300 ms
  await page.click('#dock .orbbtn');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  const t0 = Date.now();
  await page.fill('#palette input', 'rad');
  await until(page, () => /^RADIO · 04$/i.test(window.__ghosty?.jump?.found ?? ''), 4000, '[jump] "rad" did not find RADIO · 04');
  const found = Date.now() - t0;
  timings.push(`jump bar ${tag}: "rad" found in ${found} ms`);
  check(found < BUDGET + 200, `[speed ${tag}] "rad" took ${found} ms to find RADIO (the budget is ${BUDGET} ms of the bar's own work, ${BUDGET + 200} with the driver's)`);
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, '[jump] OPEN did not open Radio');
  await ctx.close();
}

// ---- d. a hub is layers by distance from the orb
{
  const { ctx, page } = await open({ pins: ['gym', 'arcade'], recents: ['library', 'school'] });
  await go(page, 'area-learn');
  await until(page, () => document.body.dataset.tab === 'area-learn' && !!document.querySelector('#pg-area-learn .orblayer .hubtile'), 15000, '[layers] LEARN has no layers');
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => e && (({ y, height, x, width }) => ({ top: Math.round(y), bottom: Math.round(y + height), left: Math.round(x), right: Math.round(x + width) }))(e.getBoundingClientRect());
    const ids = (s) => [...document.querySelectorAll(`#pg-area-learn .orblayer[data-layer="${s}"] .hubtile`)].map((b) => b.dataset.id);
    return { rest: ids('rest'), fav: ids('favourites'), recent: ids('recent'), chips: [...document.querySelectorAll('#pg-area-learn .orbchip')].map((b) => ({ t: b.textContent, to: b.dataset.to, h: Math.round(b.getBoundingClientRect().height) })), boxes: { rest: box(q('#pg-area-learn .orblayer[data-layer="rest"]')), fav: box(q('#pg-area-learn .orblayer[data-layer="favourites"]')), recent: box(q('#pg-area-learn .orbrecent')), line: box(q('#dock .orbline')), orb: box(q('#dock .orbbtn')), thread: box(q('#dock .orbthread')) }, threadShown: !!q('#dock .orbthread')?.getClientRects().length, heads: [...document.querySelectorAll('#pg-area-learn .orbtier span')].map((s) => s.textContent), band: !!q('#pg-area-learn .roomband')?.getClientRects().length, scrollTop: Math.round([...document.querySelectorAll('#pg-area-learn, #pg-area-learn *')].find((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))?.scrollTop ?? 0) };
  });
  check(d.recent.join() === 'library' && d.fav.join() === 'gym,arcade' && d.rest.length >= 3 && !d.rest.includes('library') && !d.rest.includes('gym'), `[layers] the layers are ${JSON.stringify({ recent: d.recent, fav: d.fav, rest: d.rest })}`);
  check(d.boxes.rest.bottom <= d.boxes.fav.top && d.boxes.fav.bottom <= d.boxes.recent.top && d.boxes.recent.bottom <= d.boxes.line.top, `[layers] the layers are not in order by distance from the orb: ${JSON.stringify(d.boxes)}`);
  check(d.threadShown && d.boxes.thread && d.boxes.thread.left >= d.boxes.orb.left + 20 && d.boxes.thread.right <= d.boxes.orb.right - 20 && d.boxes.thread.bottom >= d.boxes.line.top - 2 && d.boxes.recent.bottom - d.boxes.thread.top <= 40, `[layers] the recent card does not hang on a thread from the orb: ${JSON.stringify(d.boxes)}`);
  check(d.chips.map((c) => c.t).join() === 'Reader,Shelf,Ask the library' && d.chips.every((c) => c.h >= 44) && d.chips.map((c) => c.to).join() === 'reader,library?shelf,library?ask', `[layers] the recent card's panels: ${JSON.stringify(d.chips)}`);
  check(/^Everything else · \d+$/.test(d.heads[0]) && d.heads[1] === 'Favourites' && d.heads[2] === 'Recent' && !d.band, `[layers] the layers' names: ${d.heads}`);
  await page.screenshot({ path: `${out}/orbit-hub-440.png` });
  await page.click('#pg-area-learn .orbchip[data-to="library?shelf"]');
  await until(page, () => document.body.dataset.tab === 'library', 6000, '[layers] a chip did not open its panel');
  // the empty hub: no recent, no favourites: both layers say so
  await go(page, 'area-see');
  await page.waitForTimeout(900);
  const e = await page.evaluate(() => ({ none: [...document.querySelectorAll('#pg-area-see .orblayer .orbnone')].map((p) => p.textContent) }));
  check(e.none.length >= 1, `[layers] a hub with nothing recent or starred says nothing: ${JSON.stringify(e)}`);
  await ctx.close();
}

// ---- e. the Stage: a map is a sphere grown from the orb and shrinks back; a document is the rounded page with the bezel
{
  const { ctx, page } = await open({ show: true, look: ORBIT });
  await page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => problems.push('window.__ghosty.show never appeared'));
  await go(page, 'learn');
  await page.waitForTimeout(500);
  const present = (f) => page.evaluate((f) => window.__ghosty.show.present({ tools: [], clients: [], cards: [], ...f }), f);
  await present({ ask: 'where is Lisbon?', reply: 'Lisbon is the capital of Portugal.', brain: { kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, zoom: 11 } } });
  await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'map', 15000, '[stage] a map did not come to the Stage');
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const s = document.querySelector('#thestage');
    const pic = s.querySelector('.stgpic');
    const r = pic.getBoundingClientRect();
    const cs = getComputedStyle(pic);
    const orb = document.querySelector('#dock .orbbtn').getBoundingClientRect();
    return { shape: s.dataset.shape, w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderTopLeftRadius, overflow: cs.overflow, rim: cs.boxShadow, before: getComputedStyle(pic, '::before').content, after: getComputedStyle(pic, '::after').content, mask: getComputedStyle(pic, '::before').webkitMaskImage || getComputedStyle(pic, '::before').maskImage, plate: getComputedStyle(s).backgroundColor, origin: s.style.getPropertyValue('--orb-x') + ' ' + s.style.getPropertyValue('--orb-y'), orbY: Math.round(orb.top), picBottom: Math.round(r.bottom), keys: [...s.querySelectorAll('.stgkeys button')].map((b) => b.offsetHeight) };
  });
  check(m.shape === 'sphere' && Math.abs(m.w - m.h) <= 1 && m.radius === '50%' && m.overflow === 'hidden' && /rgb/.test(m.rim) && m.before !== 'none' && m.after !== 'none' && /svg/.test(m.mask ?? ''), `[stage] the map is not a sphere with its graticule, equator and lit rim: ${JSON.stringify(m)}`);
  check(m.plate !== 'rgba(0, 0, 0, 0)' && /px/.test(m.origin) && m.picBottom <= m.orbY, `[stage] the sphere's ground is clear (the page shows through), it does not grow from the orb or stands on the line: ${JSON.stringify(m)}`);
  check(m.keys.every((h) => h >= 44), `[stage] a key on the Stage is under 44 pt: ${m.keys}`);
  await page.screenshot({ path: `${out}/orbit-stage-sphere.png` });
  // giving it back: the orb shrinking (a leaving Stage with no id while it plays), then gone
  await page.click('#thestage button[aria-label="Close"]');
  const leaving = await page.evaluate(() => ({ out: document.querySelectorAll('#thestage[data-leaving]').length, anim: document.querySelector('#thestage[data-leaving]') ? getComputedStyle(document.querySelector('#thestage[data-leaving]')).animationName : '' }));
  check(leaving.out === 1 && /orbshrink/.test(leaving.anim), `[stage] giving the Stage back is not the orb shrinking: ${JSON.stringify(leaving)}`);
  await until(page, () => document.querySelectorAll('#thestage').length === 0, 4000, '[stage] the shrinking Stage never left');
  // a letter: the rounded page, the same lit ring as its bezel, the orb docked at its top edge
  await present({ ask: 'write me a letter to my landlord about the heating', reply: 'Dear Mr Hall,\n\nThe heating in the flat has not worked since Monday.\n\nPlease could someone come and look at it this week.\n\nYours sincerely,\nBoss' });
  await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'document', 15000, '[stage] a letter did not come to the Stage');
  await page.waitForTimeout(1200);
  const dcu = await page.evaluate(() => {
    const s = document.querySelector('#thestage');
    const cs = getComputedStyle(s);
    const before = getComputedStyle(s, '::before');
    return { shape: s.dataset.shape, radius: cs.borderTopLeftRadius, ring: cs.boxShadow, dock: before.content, dockW: before.width, bg: cs.backgroundColor };
  });
  check(dcu.shape === 'page' && dcu.radius !== '0px' && /rgb/.test(dcu.ring) && dcu.dock !== 'none' && dcu.dockW === '44px', `[stage] the document is not the rounded page with the bezel and the orb docked: ${JSON.stringify(dcu)}`);
  await page.screenshot({ path: `${out}/orbit-stage-page.png` });
  await page.keyboard.press('Escape');
  await ctx.close();
  // Reduce Motion: the Stage is there at once, nothing grows
  const r = await open({ show: true, look: ORBIT, reduced: true });
  await r.page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => undefined);
  await go(r.page, 'learn');
  await r.page.evaluate(() => window.__ghosty.show.present({ tools: [], clients: [], cards: [], ask: 'where is Lisbon?', reply: 'Lisbon is the capital of Portugal.', brain: { kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, zoom: 11 } } }));
  await until(r.page, () => document.querySelector('#thestage')?.dataset.kind === 'map', 15000, '[stage] (reduced) a map did not come to the Stage');
  const rd = await r.page.evaluate(() => getComputedStyle(document.querySelector('#thestage')).animationDuration);
  check(/^0s$|^0ms$/.test(rd), `[stage] under Reduce Motion the Stage still takes ${rd} to grow`);
  await r.ctx.close();
}

// ---- f. the speed habit and Reduce Motion: Home in ORBIT under 300 ms (median of five); nothing moves on the ring when motion is reduced
{
  const { ctx, page } = await open({ book: true });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[speed] Home never became the orbit');
  const times = [];
  for (let i = 0; i < 5; i++) {
    await page.click('.orbst[data-room="see"]');
    await until(page, () => document.body.dataset.tab === 'area-see', 8000, '[speed] SEE did not open');
    await page.waitForTimeout(500);
    const ms = await timed(page, () => page.click('#top .navback'), 'home');
    times.push(ms ?? 9999);
    await page.waitForTimeout(400);
  }
  timings.push(`home: orbit opens ${times.join(', ')} ms from a hub's way back (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed] Home in ORBIT opened in ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  const hubs = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await until(page, HOME_READY, 10000, '[speed] Home did not come back');
    await page.waitForTimeout(300);
    const ms = await timed(page, () => page.click('.orbst[data-room="see"]'), 'hub');
    hubs.push(ms ?? 9999);
  }
  timings.push(`hub: a room's layers ${hubs.join(', ')} ms from its station (median ${median(hubs)})`);
  check(median(hubs) < BUDGET, `[speed] a room's layers took ${median(hubs)} ms (median of five: ${hubs.join(', ')}; the budget is ${BUDGET} ms)`);
  // alive: the ring drifts
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[motion] Home did not come back');
  const alive = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('.orbplace')).length + (getComputedStyle(document.querySelector('.orbticks')).animationName !== 'none' ? 1 : 0));
  check(alive > 0, '[motion] with motion alive the ring does not drift');
  await ctx.close();
  const r = await open({ reduced: true, book: true });
  await go(r.page, 'core');
  await until(r.page, HOME_READY, 15000, '[motion] (reduced) Home never became the orbit');
  await r.page.waitForTimeout(600);
  const still = await r.page.evaluate(() => ({ anims: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.orbframe')).length, ring: getComputedStyle(document.querySelector('.orbticks')).animationName, stations: [...document.querySelectorAll('.orbst .orbdisc')].map((e) => getComputedStyle(e).transitionDuration).join() }));
  check(still.anims === 0 && still.ring === 'none', `[motion] under Reduce Motion something runs on the ring: ${JSON.stringify(still)}`);
  // the fan opens without easing
  await go(r.page, 'area-learn');
  await r.page.waitForTimeout(700);
  await holdOrb(r.page);
  await until(r.page, () => window.__ghosty.orbit.fan, 3000, '[motion] (reduced) the fan did not open');
  const fanT = await r.page.evaluate(() => ({ dur: getComputedStyle(document.querySelector('#switcher .switem')).transitionDuration, ring: getComputedStyle(document.querySelector('#dock .orbring')).transitionDuration }));
  check(fanT.dur.split(',').every((d) => parseFloat(d) <= 0.001), `[motion] under Reduce Motion the fan eases (${fanT.dur})`);
  await r.page.mouse.up();
  await r.ctx.close();
}

// ---- g. the biggest text: BODY 21 on a 390 × 844 phone, Home and a hub
{
  const { ctx, page } = await open({ viewport: WIDE, book: true, recents: ['library', 'eye', 'brief'], body: 21 });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[biggest] Home never became the orbit');
  await page.waitForTimeout(800);
  const bad = await floor(page, 390, '.orbframe');
  check(!bad.length, `[biggest] Home at BODY 21: ${bad.slice(0, 6).join('; ')}`);
  const fit = await page.evaluate(() => { const f = document.querySelector('.orbframe'); return { scroll: f.scrollHeight, client: f.clientHeight, ring: Math.round(document.querySelector('.orbplace').getBoundingClientRect().width) }; });
  check(fit.ring >= 250, `[biggest] the ring is squeezed to ${fit.ring} px at BODY 21 (${JSON.stringify(fit)})`);
  await page.screenshot({ path: `${out}/orbit-home-390-body21.png` });
  await go(page, 'area-learn');
  await page.waitForTimeout(1200);
  const bad2 = await floor(page, 390, '#stage > .pg, #dock .orbline');
  check(!bad2.length, `[biggest] a hub at BODY 21: ${bad2.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/orbit-hub-390-body21.png` });
  await ctx.close();
}

// ---- h. nothing of ORBIT in the other worlds, and nothing of theirs in ORBIT
{
  const facts = async (look, W) => {
    const { ctx, page } = await open({ viewport: W, look, book: true });
    const out = {};
    for (const [id, hash] of [['home', 'core'], ['learn', 'area-learn'], ['settings', 'settings']]) {
      await go(page, hash);
      await page.waitForTimeout(1300);
      out[id] = await page.evaluate(() => {
        const seen = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
        const q = (s) => document.querySelector(s);
        return { world: document.documentElement.dataset.world, orbitHome: document.body.classList.contains('orbithome'), frame: seen(q('.orbframe')), line: seen(q('#dock .orbline')), orbBtn: seen(q('#dock .orbbtn')), stations: [...document.querySelectorAll('.orbst')].filter(seen).length, housed: document.body.classList.contains('housed'), keys: [...document.querySelectorAll('#dock .tabcap button')].filter(seen).map((b) => b.dataset.area).join(), layers: [...document.querySelectorAll('.orblayer')].filter(seen).length, fan: !!q('#switcher[data-fan]'), tab: document.body.dataset.tab };
      });
    }
    await ctx.close();
    return out;
  };
  for (const [look, name, housed, keys] of [[SCAN, 'scan', true, 'ask,see,make,learn,plan,life,me'], [INK, 'ink', true, 'ask,see,make,learn,plan,life,me'], [GLASS, 'glass', false, 'ask,see,make,learn,plan,life'], [MAP, 'map', true, 'ask,see,make,learn,plan,life,me'], [EYE, 'eye', false, 'ask,see,make,learn,plan,life']]) {
    const f = await facts(look, PHONE);
    for (const id of ['home', 'learn', 'settings']) {
      const x = f[id];
      check(!x.orbitHome && !x.frame && !x.line && !x.orbBtn && !x.stations && !x.layers && !x.fan, `[world] ${name} ${id} wears ORBIT: ${JSON.stringify(x)}`);
      check(x.housed === housed, `[world] ${name} ${id}: body.housed is ${x.housed}`);
      if (id !== 'home' || name === 'glass') check(x.keys === keys || (name === 'ink' && x.keys === keys), `[world] ${name} ${id}: the bar's keys are "${x.keys}" (want ${keys})`);
    }
  }
  // and nothing of theirs in ORBIT: no Scan marks, no ink foot, no blur on Home or a hub
  const { ctx, page } = await open({ book: true });
  for (const hash of ['core', 'area-learn', 'settings']) {
    await go(page, hash);
    await page.waitForTimeout(1200);
    const o = await page.evaluate(() => {
      const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
      return { scan: [...document.querySelectorAll('.scanframe, .scanmarks, .scanleads, .scanask, .scanco')].filter(seen).length, ink: [...document.querySelectorAll('.inkframe, .inkask')].filter(seen).length, floor: getComputedStyle(document.documentElement).getPropertyValue('--g-floor-a').trim(), glow: getComputedStyle(document.documentElement).getPropertyValue('--g-glow').trim(), blur: [...document.querySelectorAll('body *')].filter((e) => seen(e) && ((getComputedStyle(e).backdropFilter && getComputedStyle(e).backdropFilter !== 'none') || (getComputedStyle(e).webkitBackdropFilter && getComputedStyle(e).webkitBackdropFilter !== 'none'))).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`), radius: getComputedStyle(document.documentElement).getPropertyValue('--g-radius-cell').trim() };
    });
    check(!o.scan && !o.ink && o.floor === '0' && o.glow === '1' && !o.blur.length && o.radius === '28px', `[world] ORBIT's ${hash} carries another world's drawing: ${JSON.stringify(o)}`);
  }
  await ctx.close();
}

} catch (e) {
  problems.push(`the run stopped: ${String(e?.message ?? e).split('\n')[0]}`);
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'ORBIT run clean at 440 × 956 and 390 × 844: the gallery built and kept, Home the orbit, the orb and its line on every screen, the fan, the plan, the layers of a hub, the Stage as a sphere and a page, under budget, the other worlds untouched.');
process.exit(problems.length ? 1 : 0);
