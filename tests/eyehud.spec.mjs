// THE EYE, the fourth whole HUD (BRIEF-EYE-HUD; apps/web/src/features/core/eye/{home,ground,grain}.ts, shell/house.ts eyeOn, styles.css THE EYE): the
// Machine's attention as a wall of feeds on the owner's 440 × 956 and a 390 × 844 phone (every check fails on the code before this brief: it was run
// against it once):
//   a. THE GALLERY: THE EYE's card has no COMING; a tap sets recipe.world 'eye' at once, says YOU'RE IN IT, survives a reload; a tap on THE SCAN
//      brings The Scan back; "the eye" and "switch to the eye" by words switch (no model), the colour staying his; "the eye of the storm" is not the look's;
//   b. HOME IS THE WALL: the stamp, the greeting and the one sentence (the caption's words), six room feeds with their `N screens` and every screen (a tap
//      goes into the room), exactly ONE sharp feed (tonight: the book, else the agenda's real next event, else the Brief) in the accent box with the orb
//      under it and the line of sight, his recents and favourites as feeds in grain (a tap opens, a long press pins), the ask line and the mic, the
//      instruments with seven keys and Home sharp; no scan marks, no ink frame, no map plane, no <nav> before the dock; nothing sideways; every control 44 pt;
//   c. THE INSTRUMENTS ON EVERY SCREEN: LEARN and Settings with LEARN / ME sharp, the page ending above them, the plan from the kick with seven rooms,
//      the jump bar finding "rad" → RADIO · 04;
//   d. THE SPEED HABIT AND THE GROUND'S COST: Home in the eye and a room's screen under 300 ms; the globe starts only after Home has been shown (nothing
//      drawn before), draws at a few frames a second, nothing under Reduce Motion or MOTION calm but one still frame, and God's Eye's camera is as it
//      was after Home lets go; no CSS animation on the wall;
//   e. nothing of the eye in The Scan, ONE INK, THE MAP or Glass.
//   BASE=http://localhost:8808 node tests/eyehud.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
const EYE = { ground: 'graphite', world: 'eye', night: 'graphite', switches: {} };
const MAP = { ground: 'graphite', world: 'map', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const WIDE = { width: 390, height: 844 };

/** A phone opened on Ghosty, signed in, his name Boss, in the look asked for; `book`: a book on the go; `pins`: his favourites. */
async function open({ viewport = PHONE, look = EYE, book = false, pins = ['lens', 'agenda'], recents = null, once = true, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, look, book, pins, recents, once }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!once || !localStorage.getItem('spec.eye.seeded')) {
      localStorage.setItem('spec.eye.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (book) localStorage.setItem('ghosty.places', JSON.stringify({ map: { 'alices-adventures-in-wonderland.pdf': { n: 4, off: 0, page: 42, pct: 0.37, done: false, at: Date.now() - 86_400_000 } } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the stopwatch's tests (timed() below): the printed page drawn, the room's band drawn, the jump bar open with its first rows
    window.__eyeTests = {
      home: () => { const f = document.querySelector('.eyeframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('eyehome') && !!r && r.width > 0 && !!document.querySelector('.eyeask')?.getBoundingClientRect().width; },
      // (a room in the eye is the wall now, BRIEF-EYE-HUD-2: the budget is held to the wall's own first feed being drawn, not to The Scan's band, which the eye no longer draws)
      see: () => document.body.dataset.tab === 'area-see' && !!document.querySelector('#pg-area-see .eyeroom .eyefeed')?.getBoundingClientRect().width && !document.querySelector('#pg-area-see .roomband')?.getClientRects().length,
      jump: () => { const p = document.querySelector('#palette.on'); const r = p?.querySelector('input')?.getBoundingClientRect(); return !!r && r.width > 0 && !!p.querySelector('.jgroup, .jempty'); },
    };
  }, { key: KEY, look, book, pins, recents, once });
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
const floor = (page, W, scope) => page.evaluate(([W, scope]) => {
  const bad = [];
  const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  for (const b of document.querySelectorAll(`${scope} button, #dock .tabcap button`)) {
    if (!seen(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`target "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll(`${scope} *, #dock .tabcap *`)) {
    if (!seen(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest('canvas, .eyeveil, .eyeorb, .eyepic')) bad.push(`sideways: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push(`the page scrolls sideways: ${document.documentElement.scrollWidth}`);
  return bad;
}, [W, scope]);
const settingsLook = (page) => page.evaluate(() => window.__ghosty.settings.get().look?.world ?? null);
const foot = (page) => page.evaluate(() => [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, label: b.getAttribute('aria-label') || b.title || b.textContent.trim(), lit: b.classList.contains('on'), rect: (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(b.getBoundingClientRect()) })));
/** Click a thing and the ms until a named test is true on a frame (the phone's own stopwatch; the tests live in the page: its policy forbids building code from strings). */
async function timed(page, click, name) {
  await page.evaluate((name) => {
    window.__eye_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const f = window.__eyeTests[name];
      const tick = () => {
        if (f()) window.__eye_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, name);
  await click();
  await page.waitForFunction(() => window.__eye_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__eye_t);
}
const HOME_READY = () => { const f = document.querySelector('.eyeframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('eyehome') && !!r && r.width > 0 && !!document.querySelector('.eyeask')?.getBoundingClientRect().width; };

// ---- a. the gallery: THE EYE's card, a tap, a reload, THE SCAN back, the words
{
  const { ctx, page } = await open({ look: SCAN, once: true });
  const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
  const themePage = async () => {
    await go(page, 'settings');
    await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
    await openSection(page, 'settings', 'Appearance').catch(() => undefined);
    await page.locator('#pg-settings .scanset button.srow').filter({ has: page.locator('.srname', { hasText: /^Theme$/i }) }).first().click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open'));
    await page.waitForSelector(card('eye'), { timeout: 8000 }).catch(() => problems.push('[gallery] the Theme page has no THE EYE card'));
    await page.waitForTimeout(400);
  };
  await themePage();
  const m0 = await page.evaluate((sel) => ({ coming: !!document.querySelector(`${sel} .gg-coming`), built: document.querySelector(sel)?.dataset.built }), card('eye'));
  check(!m0.coming && m0.built === 'true', `[gallery] THE EYE's card is still COMING: ${JSON.stringify(m0)}`);
  const comings = await page.$$eval('#pg-settings .gg-look', (bs) => bs.filter((b) => b.querySelector('.gg-coming')).map((b) => b.dataset.look).join());
  check(comings === '', `[gallery] COMING is on ${comings} (want none: ORBIT and GROWN UP are built too)`);
  await page.click(card('eye'));
  await until(page, () => document.documentElement.dataset.world === 'eye', 5000, '[gallery] a tap on THE EYE did not make the world eye');
  const said = (k) => page.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
  const s1 = await said('eye');
  check(s1.on === 'true' && /you.re in it/i.test(s1.line) && /THE EYE/i.test(s1.head), `[gallery] THE EYE after its tap: ${JSON.stringify(s1)}`);
  check((await settingsLook(page)) === 'eye', '[gallery] THE EYE was not kept in his settings');
  await page.screenshot({ path: `${out}/eye-gallery.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.documentElement.dataset.world === 'eye'), '[gallery] THE EYE did not survive a reload');
  await themePage();
  await page.click(card('scan'));
  await until(page, () => document.documentElement.dataset.world === 'scan', 5000, '[gallery] a tap on THE SCAN did not bring The Scan back');
  await page.click('#pg-settings .pn.themepn.pushed .gg-sw[data-colour="ember"]');
  await until(page, () => document.documentElement.dataset.theme === 'ember', 5000, '[words] the ember swatch did not apply');
  const asked = [];
  page.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('scanhome'), 10000, '[words] Home did not wear The Scan before the words');
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  for (const words of ['the eye', 'switch to the map', 'switch to the eye']) {
    const want = /map/.test(words) ? 'map' : 'eye';
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
    await until(page, (w) => document.documentElement.dataset.world === w, 8000, `[words] "${words}" did not make the world ${want}`, want);
    const wd = await page.evaluate(() => ({ colour: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, said: [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => /The (Eye|Map)/.test(t)).pop() ?? '' }));
    check(wd.colour === 'ember' && wd.saved === 'ember', `[words] "${words}" changed his colour: ${JSON.stringify(wd)}`);
    check(want === 'map' ? /The Map: on\./.test(wd.said) : /The Eye: on\./.test(wd.said), `[words] "${words}" answered "${wd.said}"`);
  }
  check(!asked.length, `[words] the brain was asked ${asked.length} times for the eye's words`);
  await ctx.close();
}

// ---- b. Home is the wall, at 440 and at 390
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, book: true, recents: ['library', 'eye', 'brief'] });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[home ${tag}] Home never became the wall`);
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const text = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const box = (s) => { const r = q(s)?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height].map(Math.round); };
    const fr = q('.eyeframe').getBoundingClientRect();
    const feeds = [...document.querySelectorAll('.eyewall .eyefeed')].map((c) => ({ slot: c.dataset.slot, kind: c.dataset.kind, room: c.dataset.room ?? '', sharp: c.classList.contains('sharp'), id: c.dataset.id ?? '', name: (c.querySelector('.eyename') ?? c.querySelector('.eyetag'))?.textContent?.trim() ?? '', line: (c.querySelector('.eyeline')?.textContent ?? '').trim(), tag: (c.querySelector('.eyetag')?.textContent ?? '').trim(), border: getComputedStyle(c).borderTopStyle, borderColour: getComputedStyle(c).borderTopColor, pic: c.querySelector('canvas.eyepic') ? { w: Math.round(c.querySelector('canvas.eyepic').getBoundingClientRect().width), drawn: !!c.querySelector('canvas.eyepic').dataset.drawn } : null, w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), el: c.tagName }));
    const wall = q('.eyewall').getBoundingClientRect();
    const orb = box('.eyeorbhost');
    const sharpR = q('.eyefeed.sharp')?.getBoundingClientRect();
    const sight = q('.eyesight')?.getBoundingClientRect();
    return {
      stamp: text('.eyemast .g-stamp'), say: text('.eyesay'), say2: text('.eyesay2'), state: window.__ghosty?.eyehome ? { on: window.__ghosty.eyehome.on, line: window.__ghosty.eyehome.line, tonight: window.__ghosty.eyehome.tonight, cells: window.__ghosty.eyehome.cells, rooms: window.__ghosty.eyehome.rooms, sharp: window.__ghosty.eyehome.sharp, grain: window.__ghosty.eyehome.grain } : null,
      feeds, orb, wallBox: [wall.x, wall.y, wall.width, wall.height].map(Math.round), orbCanvas: !!q('.eyeorbhost canvas'),
      sightBox: sight && [sight.x, sight.y, sight.width, sight.height].map(Math.round), sharpBox: sharpR && [sharpR.x, sharpR.y, sharpR.width, sharpR.height].map(Math.round), sightStyle: css(q('.eyesight'), 'border-left-style'),
      legend: text('.eyelegend'), field: text('.eyefield'), mic: !!q('.eyespeak svg'), accent: css(document.documentElement, '--g-accent'),
      scale: [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, label: b.getAttribute('aria-label') || b.textContent.trim(), lit: b.classList.contains('on'), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), grain: getComputedStyle(b, '::before').display, border: getComputedStyle(b).borderTopStyle })),
      kick: text('#dock .housekick'), houseask: css(q('#dock .houseask'), 'display'), footTop: Math.round(q('#dock .tabcap').getBoundingClientRect().top),
      frameBottom: Math.round(fr.bottom), askBox: box('.eyeask'), scroll: [q('.eyeframe').scrollHeight, q('.eyeframe').clientHeight],
      firstNav: document.querySelector('nav')?.id ?? '', navs: document.querySelectorAll('nav').length,
      scanmarks: [...document.querySelectorAll('.scanmarks, .scanleads')].filter((e) => e.getClientRects().length).length,
      ink: [...document.querySelectorAll('.inkframe')].filter((e) => getComputedStyle(e).display !== 'none').length,
      maphudframe: [...document.querySelectorAll('div.maphudframe')].filter((e) => getComputedStyle(e).display !== 'none').length,
      topShown: q('#top') ? getComputedStyle(q('#top')).display : 'none', glow: css(document.documentElement, '--g-glow'), world: document.documentElement.dataset.world, edge: css(document.documentElement, '--g-plate-edge'),
    };
  });
  check(/^(SUN|MON|TUE|WED|THU|FRI|SAT) \d{1,2} [A-Z]{3} · \d{2}:\d{2} · BIRMINGHAM · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(h.stamp), `[home ${tag}] the stamp reads "${h.stamp}"`);
  check(/^Good (morning|afternoon|evening|night), Boss\.$/.test(h.say) && h.say2.length > 3 && h.state && h.state.line === h.say2, `[home ${tag}] the words: "${h.say}" / "${h.say2}" / state ${h.state?.line}`);
  const rooms = h.feeds.filter((f) => f.kind === 'room');
  check(rooms.map((d) => d.room).join() === 'see,make,learn,plan,life,me,screens' && rooms.slice(0, 6).every((d) => /^\d+ screens$/i.test(d.line) && d.border === 'dotted' && d.h >= 44 && d.pic?.drawn), `[home ${tag}] the room feeds: ${JSON.stringify(rooms.map((d) => [d.room, d.line, d.border, d.h, d.pic]))}`);
  check(rooms.find((d) => d.room === 'learn')?.line === '8 screens' && rooms.find((d) => d.room === 'see')?.line === '3 screens' && /^all \d+$/i.test(rooms.find((d) => d.room === 'screens')?.line ?? ''), `[home ${tag}] LEARN has ${rooms.find((d) => d.room === 'learn')?.line}`);
  const sharp = h.feeds.filter((f) => f.sharp);
  check(sharp.length === 1 && h.state.sharp === 1 && sharp[0].kind === 'tonight' && sharp[0].slot === 't' && /Alice/.test(sharp[0].name) && /^TONIGHT|THIS MORNING|TODAY$/i.test(sharp[0].tag) && sharp[0].borderColour !== h.feeds.find((f) => !f.sharp).borderColour && !sharp[0].pic, `[home ${tag}] the sharp feed: ${JSON.stringify(sharp)}`);
  const grain = h.feeds.filter((f) => !f.sharp && f.kind !== 'free');
  check(grain.length >= 9 && grain.every((f) => f.pic?.drawn && f.pic.w > 30) && h.state.grain === h.feeds.length - 1, `[home ${tag}] the grain feeds: ${JSON.stringify(grain.filter((f) => !f.pic?.drawn).map((f) => f.room || f.id))} of ${grain.length}`);
  const side = h.feeds.filter((f) => ['recent', 'favourite', 'free'].includes(f.kind));
  check(side.length === 6 && h.state.cells.length === 7 && side.filter((c) => c.kind === 'recent').length >= 2 && side.filter((c) => c.kind === 'favourite').map((c) => c.id).join() === 'lens,agenda', `[home ${tag}] the side feeds: ${JSON.stringify(side.map((c) => `${c.slot}:${c.kind}:${c.id}`))}`);
  check(h.feeds.filter((c) => c.kind !== 'free').every((c) => c.h >= 44 && c.w >= 44 && c.el === 'BUTTON'), `[home ${tag}] a feed under 44 pt: ${JSON.stringify(h.feeds.filter((c) => c.h < 44 || c.w < 44))}`);
  const mid = (b) => b[0] + b[2] / 2;
  check(h.orbCanvas && h.orb && h.orb[2] >= 50 && Math.abs(h.orb[2] - h.orb[3]) <= 6 && Math.abs(mid(h.orb) - mid(h.wallBox)) <= 10 && h.orb[1] >= h.sharpBox[1] + h.sharpBox[3] - 2, `[home ${tag}] the orb ${h.orb} is not under the sharp feed ${h.sharpBox} in the middle of the wall ${h.wallBox}`);
  check(h.sightBox && h.sightBox[3] >= 10 && /dashed/.test(h.sightStyle) && Math.abs(h.sightBox[0] - mid(h.wallBox)) <= 6 && h.sightBox[1] + h.sightBox[3] <= h.orb[1] + 4, `[home ${tag}] the line of sight ${h.sightBox} (${h.sightStyle}) does not run from the orb up to the sharp feed`);
  check(/^IN FOCUS: (TONIGHT|THIS MORNING|TODAY) · AT THE EDGE: STARRED$/i.test(h.legend) && h.legend.toUpperCase().includes(h.state.tonight.tag.toUpperCase()) && /say what to look at/.test(h.field) && h.mic, `[home ${tag}] the words: "${h.legend}" / "${h.field}" / mic ${h.mic}`);
  check(h.scale.length === 7 && h.scale.map((f) => f.area).join() === 'ask,see,make,learn,plan,life,me' && h.scale[0].lit && h.scale.slice(1).every((f) => !f.lit) && h.scale[0].label === 'Home' && h.scale[0].grain === 'none' && h.scale.slice(1).every((f) => f.grain === 'block' && f.border === 'dotted') && h.scale.every((f) => f.h >= 44 && f.w >= 44), `[home ${tag}] the instruments: ${JSON.stringify(h.scale)}`);
  check(/THE WALL · 7 FEEDS/i.test(h.kick) && /LOOKING AT HOME/i.test(h.kick) && h.houseask === 'none', `[home ${tag}] the instruments' words: "${h.kick}", second ask line ${h.houseask}`);
  check(h.firstNav === 'dock' && h.navs === 1, `[home ${tag}] the first <nav> on the page is "${h.firstNav}" (${h.navs} of them): layout and library read it as the dock`);
  check(h.frameBottom <= vp.height && h.scroll[0] <= h.scroll[1] + 2, `[home ${tag}] the frame scrolls (${h.scroll}) or runs past the screen (${h.frameBottom})`);
  check(h.scanmarks === 0 && h.ink === 0 && h.maphudframe === 0 && h.topShown === 'none' && h.glow === '1' && h.world === 'eye', `[home ${tag}] Scan marks ${h.scanmarks}, ink ${h.ink}, map ${h.mapframe}, top ${h.topShown}, glow ${h.glow}, world ${h.world}`);
  const bad = await floor(page, vp.width, '.eyeframe');
  check(!bad.length, `[home ${tag}] the floor: ${bad.slice(0, 6).join('; ')}`);
  const ends = await page.evaluate(() => { const a = document.querySelector('.eyeask').getBoundingClientRect(); const k = document.querySelector('#dock .housekick').getBoundingClientRect(); return [Math.round(a.bottom), Math.round(k.top)]; });
  check(ends[0] <= ends[1] + 1, `[home ${tag}] the ask line (${ends[0]}) runs under the instruments' words (${ends[1]})`);
  await page.screenshot({ path: `${out}/eye-home-${tag}.png` });
  // a room feed opens its room; the instruments follow; the page ends above them
  await page.click('.eyefeed[data-room="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[home ${tag}] a tap on the LEARN feed did not open the room`);
  check((await foot(page)).find((f) => f.lit)?.area === 'learn', `[home ${tag}] on LEARN the instruments mark ${(await foot(page)).find((f) => f.lit)?.area}`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back`);
  // a feed opens its thing; a long press on one pins it
  await page.click('.eyefeed[data-kind="recent"] >> nth=0');
  await until(page, () => document.body.dataset.tab === 'library', 8000, `[home ${tag}] a tap on a recent feed did not open it`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back (2)`);
  const cell = page.locator('.eyefeed[data-kind="recent"]').nth(1);
  const id = await cell.getAttribute('data-id');
  const box = await cell.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#pinsheet'), 4000, `[home ${tag}] a long press on a feed did not open the pin sheet`);
  await page.waitForSelector('#pinsheet [data-pin]', { timeout: 6000 }).catch(() => undefined);
  const sheet = await page.evaluate(() => [...document.querySelectorAll('#pinsheet button')].map((b) => `${b.dataset.pin ?? ''}:${b.textContent.trim()}`));
  if (!sheet.some((x) => x.startsWith('pin:'))) { problems.push(`[home ${tag}] the pin sheet for ${id} offers ${JSON.stringify(sheet)}`); await ctx.close(); continue; }
  await page.click('#pinsheet [data-pin="pin"]');
  await until(page, (id) => [...document.querySelectorAll('.eyefeed[data-kind="favourite"]')].some((b) => b.dataset.id === id), 4000, `[home ${tag}] the pinned feed ${id} did not become a favourite`, id);
  await ctx.close();
}

// ---- b2. the thing of the hour, from the agenda's real content: the book wins; with no book it is the agenda's next event, else the Brief
// (routec seeds "Call Mum" into the preview's shared agenda: what is asked of the page is computed from what the brain's agenda holds now)
{
  const { ctx, page } = await open({ book: false });
  const ag = await page.evaluate(async (key) => {
    const r = await fetch(`/api/agenda?days=2&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, { headers: { 'x-ghosty-key': key } });
    const j = r.ok ? await r.json() : { events: [] };
    const now = Date.now();
    const ev = j.events.filter((x) => (x.end ?? x.start) > now).sort((a, b) => a.start - b.start)[0];
    return ev ? { title: ev.title } : null;
  }, KEY);
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[hour] Home never became the wall');
  const want = ag ? { kind: 'agenda', name: ag.title } : { kind: 'brief', name: 'The Brief' };
  await until(page, (w) => window.__ghosty.eyehome.tonight.kind === w.kind && window.__ghosty.eyehome.tonight.name === w.name, 12000, `[hour] with no book the sharp feed is not ${JSON.stringify(want)}`, want);
  const got = await page.evaluate(() => ({ t: window.__ghosty.eyehome.tonight, sharp: document.querySelector('.eyefeed.sharp .eyename')?.textContent, n: document.querySelectorAll('.eyefeed.sharp').length }));
  check(got.n === 1 && got.sharp === want.name && got.t.kind === want.kind, `[hour] the sharp feed is ${JSON.stringify(got)}, the agenda says ${JSON.stringify(want)}`);
  timings.push(`hour: with no book the sharp feed is the ${want.kind} (${want.name})`);
  await ctx.close();
}

// ---- c. the instruments on every screen: LEARN, Settings; the plan from the kick; the jump bar
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[instruments ${tag}] Home never became the wall`);
  await page.click('#dock .tabcap button[data-area="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[instruments ${tag}] the LEARN key did not open the room`);
  await page.waitForTimeout(900);
  // (the page's measured foot, --dockh, is written on the frame after the dock changes size: a busy software GL can hold that frame back, so it is waited for)
  await until(page, () => parseInt(document.body.style.getPropertyValue('--dockh'), 10) === Math.round(document.querySelector('#dock').getBoundingClientRect().height), 15000, `[instruments ${tag}] --dockh never caught up with the dock on LEARN`);
  const l = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const keys = [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, lit: b.classList.contains('on'), grain: getComputedStyle(b, '::before').display, border: getComputedStyle(b).borderTopStyle }));
    const pr = [...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none').map((p) => Math.round(p.getBoundingClientRect().bottom));
    return { keys, kickTop: Math.round(q('#dock .housekick').getBoundingClientRect().top), pageBottom: Math.max(...pr, 0), title: q('#top .navtitle')?.textContent.trim(), kick: q('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim(), floorA: css(document.documentElement, '--g-floor-a'), eyehome: document.body.classList.contains('eyehome'), ground: window.__ghosty.eyeground?.on };
  });
  check(l.keys.length === 7 && l.keys.filter((k) => k.lit).map((k) => k.area).join() === 'learn', `[instruments ${tag}] on LEARN the instruments mark ${l.keys.filter((k) => k.lit).map((k) => k.area)}`);
  check(l.keys.filter((k) => k.lit)[0]?.grain === 'none' && l.keys.filter((k) => !k.lit).every((k) => k.grain === 'block' && k.border === 'dotted'), `[instruments ${tag}] the one sharp feed is not the only one without grain: ${JSON.stringify(l.keys)}`);
  check(l.pageBottom > 0 && l.pageBottom <= l.kickTop + 1, `[instruments ${tag}] LEARN's page ends at ${l.pageBottom}, under the instruments' words at ${l.kickTop}`);
  check(/THE WALL · 7 FEEDS/i.test(l.kick) && /LOOKING AT LEARN/i.test(l.kick) && /LEARN/i.test(l.title ?? ''), `[instruments ${tag}] the words: "${l.kick}" / "${l.title}"`);
  check(Number(l.floorA) > 0 && !l.eyehome, `[instruments ${tag}] the fine grain is not the ground of LEARN (floor ${l.floorA}) or Home's frame stayed (${l.eyehome})`);
  const bad = await floor(page, vp.width, '#stage > .pg');
  check(!bad.length, `[instruments ${tag}] LEARN's floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/eye-learn-${tag}.png` });
  const room = await timed(page, () => page.click('#dock .tabcap button[data-area="see"]'), 'see');
  timings.push(`room ${tag}: SEE's screen ${room} ms after the tap`);
  check(room != null && room < BUDGET, `[speed ${tag}] a room's screen took ${room} ms (the budget is ${BUDGET} ms)`);
  await go(page, 'settings');
  await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await until(page, () => parseInt(document.body.style.getPropertyValue('--dockh'), 10) === Math.round(document.querySelector('#dock').getBoundingClientRect().height), 15000, `[instruments ${tag}] --dockh never caught up with the dock on Settings`);
  const st = await page.evaluate(() => ({ lit: [...document.querySelectorAll('#dock .tabcap button.on')].map((b) => b.dataset.area).join(), kickTop: Math.round(document.querySelector('#dock .housekick').getBoundingClientRect().top), bottom: Math.max(...[...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length).map((p) => Math.round(p.getBoundingClientRect().bottom))), title: document.querySelector('#top .navtitle')?.textContent.trim(), sets: document.querySelectorAll('#pg-settings .scanset button.srow').length, edge: getComputedStyle(document.querySelector('#pg-settings .scanset')).borderTopStyle }));
  check(st.lit === 'me' && st.bottom <= st.kickTop + 1 && /SETTINGS/i.test(st.title ?? '') && st.sets > 5, `[instruments ${tag}] Settings: ${JSON.stringify(st)}`);
  check(st.edge === 'dotted', `[instruments ${tag}] Settings' plate is ${st.edge}, not the eye's dotted border`);
  await page.screenshot({ path: `${out}/eye-settings-${tag}.png` });
  const sbad = await floor(page, vp.width, '#stage > .pg');
  check(!sbad.length, `[instruments ${tag}] Settings' floor: ${sbad.slice(0, 6).join('; ')}`);
  await ctx.close();
}

// ---- c2. the plan from the kick (seven rooms as the wall); the jump bar from the ask line: "rad" → RADIO · 04, under 300 ms
{
  const { ctx, page } = await open({});
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[plan] Home never became the wall');
  await page.click('#dock .housebtn');
  await until(page, () => !!document.querySelector('#plan'), 4000, '[plan] a tap on the kick did not open the plan');
  await page.waitForTimeout(700);
  const pl = await page.evaluate(() => ({ rooms: [...document.querySelectorAll('#plan .planroom')].map((r) => r.querySelector('.rtitle')?.textContent), things: document.querySelectorAll('#plan .planthing').length, tab: document.body.dataset.tab, head: document.querySelector('#plan .planhead')?.textContent.replace(/\s+/g, ' ').trim(), lit: document.querySelector('#plan .planroom.lit .rtitle')?.textContent, border: getComputedStyle(document.querySelector('#plan .plangrid')).borderTopStyle, bottom: Math.round(document.querySelector('#plan').getBoundingClientRect().bottom), capTop: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top) }));
  check(pl.rooms.join() === 'HOME,SEE,MAKE,LEARN,PLAN,LIFE,ME' && pl.things > 30 && pl.tab === 'core' && /THE WALL · 7 FEEDS/i.test(pl.head), `[plan] the plan: ${JSON.stringify(pl)}`);
  check(pl.lit === 'HOME' && pl.border === 'dotted' && pl.bottom <= pl.capTop + 12, `[plan] the plan is not the wall standing on the instruments: ${JSON.stringify({ lit: pl.lit, border: pl.border, bottom: pl.bottom, capTop: pl.capTop })}`);
  await page.screenshot({ path: `${out}/eye-plan.png` });
  await page.click('#plan .planthing[data-room="see"] >> nth=0');
  await until(page, () => document.body.dataset.tab !== 'core' && !document.querySelector('#plan'), 6000, '[plan] a tap on a number did not open the thing and close the plan');
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[plan] Home did not come back');
  // (the globe's first start is a one-off on a software GL: its texture worker and their upload; the budget is the page at rest with the ground turning, the one-off is d.'s)
  await until(page, () => window.__ghosty.eyeground.on && window.__ghosty.eyeground.draws >= 3, 40000, '[jump] the globe never settled under the wall');
  await page.waitForTimeout(1500);
  const opens = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await until(page, HOME_READY, 10000, '[jump] Home did not come back');
    await page.waitForTimeout(250);
    const ms = await timed(page, () => page.click('.eyefield'), 'jump');
    opens.push(ms ?? 9999);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  timings.push(`jump bar: opens ${opens.join(', ')} ms from the ask line (median ${median(opens)})`);
  check(median(opens) < BUDGET, `[speed] the jump bar's open took ${median(opens)} ms (median of five: ${opens.join(', ')}; the budget is ${BUDGET} ms)`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[jump] Home did not come back');
  await page.click('.eyefield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', 'rad');
  await until(page, () => /^RADIO · 04$/i.test(window.__ghosty?.jump?.found ?? ''), 4000, '[jump] "rad" did not find RADIO · 04');
  await page.screenshot({ path: `${out}/eye-jump-typed.png` });
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, '[jump] OPEN did not open Radio');
  check((await foot(page)).some((f) => f.lit), '[jump] on Radio the instruments mark no room');
  await ctx.close();
}

// ---- d. Home in the eye under 300 ms (median of five); the ground's cost: the globe starts after Home is shown, at a few frames a second,
// nothing but one still frame under Reduce Motion or MOTION calm, and God's Eye's camera is as it was once Home lets go
{
  const { ctx, page } = await open({ book: true });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[speed] Home never became the wall');
  // (a fresh phone has never been to God's Eye: its camera is the engine's own, and must be again once Home lets go)
  const camBefore = { lat: 25, lon: 10, range: 16000 };
  await until(page, () => window.__ghosty.eyeground.on && window.__ghosty.eyeground.draws > 0, 25000, '[ground] the globe never started under the wall');
  const gap = await page.evaluate(() => window.__ghosty.eyeground.since - window.__ghosty.eyehome.shownAt);
  check(gap >= 1700, `[ground] the globe started ${gap} ms after Home was shown (it waits for the page to settle: 1,800 ms)`);
  const t1 = await page.evaluate(() => ({ d: window.__ghosty.eyeground.draws, t: performance.now() }));
  await until(page, (d) => window.__ghosty.eyeground.draws >= d + 3, 30000, '[ground] the globe stopped drawing under the wall', t1.d);
  const t2 = await page.evaluate(() => ({ d: window.__ghosty.eyeground.draws, t: performance.now(), interval: window.__ghosty.eyeground.interval, cost: window.__ghosty.eyeground.cost, body: document.body.classList.contains('eyeground'), op: getComputedStyle(document.querySelector('#gl')).opacity }));
  const fps = ((t2.d - t1.d) / (t2.t - t1.t)) * 1000;
  timings.push(`ground: ${fps.toFixed(1)} draws a second, interval ${t2.interval} ms, a draw costs ${t2.cost.toFixed(1)} ms`);
  check(t2.body && t2.d > t1.d && fps <= 13 && t2.interval >= 80, `[ground] the globe drew ${fps.toFixed(1)} times a second at an interval of ${t2.interval} ms (a few a second at most): ${JSON.stringify(t2)}`);
  check(Number(t2.op) > 0.2 && Number(t2.op) < 1, `[ground] the canvas's opacity is ${t2.op}`);
  const times = [];
  for (let i = 0; i < 5; i++) {
    await page.click('#dock .tabcap button[data-area="see"]');
    await until(page, () => document.body.dataset.tab === 'area-see', 8000, '[speed] SEE did not open');
    await page.waitForTimeout(500);
    const ms = await timed(page, () => page.click('#dock .tabcap button[data-area="ask"]'), 'home');
    times.push(ms ?? 9999);
    await page.waitForTimeout(400);
  }
  timings.push(`home: eye opens ${times.join(', ')} ms from the Home key (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed] Home in the eye opened in ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target && !!a.effect.target.closest?.('.eyeframe')).map((a) => `${a.effect.target.className}:${a.animationName ?? ''}`));
  check(anims.length === 0, `[ground] the wall runs CSS animations (the ground is one canvas): ${anims}`);
  // Home lets go: the globe stops, its canvas goes back to the room's, God's Eye's camera is as it was
  await go(page, 'settings');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ on: window.__ghosty.eyeground.on, body: document.body.classList.contains('eyeground'), cam: window.__ghosty.eyeground.cam() }));
  check(!after.on && !after.body, `[ground] the globe is still the ground away from Home: ${JSON.stringify(after)}`);
  check(Math.abs(after.cam.lat - camBefore.lat) < 0.01 && Math.abs(after.cam.lon - camBefore.lon) < 0.01 && Math.abs(after.cam.range - camBefore.range) < 1, `[ground] God's Eye's camera is ${JSON.stringify(after.cam)}, it was ${JSON.stringify(camBefore)}`);
  await ctx.close();
}
for (const how of ['reduce', 'calm']) {
  const { ctx, page } = await open({ book: true, reduced: how === 'reduce' });
  if (how === 'calm') {
    await go(page, 'settings');
    await page.evaluate(() => (document.documentElement.dataset.motion = 'calm'));
  }
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[ground ${how}] Home never became the wall`);
  await until(page, () => window.__ghosty.eyeground.on, 20000, `[ground ${how}] the ground never started`);
  await page.waitForTimeout(3000);
  const g = await page.evaluate(() => ({ still: window.__ghosty.eyeground.still, draws: window.__ghosty.eyeground.draws }));
  check(g.still && g.draws <= 1, `[ground ${how}] under ${how === 'reduce' ? 'Reduce Motion' : 'MOTION calm'} the globe drew ${g.draws} frames (one still frame only; still ${g.still})`);
  await ctx.close();
}

// ---- e. nothing of the eye in the other worlds
for (const [look, name] of [[SCAN, 'scan'], [INK, 'ink'], [MAP, 'map'], [GLASS, 'glass']]) {
  const { ctx, page } = await open({ look, book: true });
  await go(page, 'core');
  await page.waitForTimeout(3200);
  const own = await page.evaluate(() => ({ eyehome: document.body.classList.contains('eyehome'), frame: !!document.querySelector('.eyeframe') && getComputedStyle(document.querySelector('.eyeframe')).display !== 'none', kick: document.querySelector('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim() ?? '', world: document.documentElement.dataset.world, ground: window.__ghosty.eyeground?.on ?? false, body: document.body.classList.contains('eyeground') }));
  check(!own.eyehome && !own.frame && !/THE WALL/i.test(own.kick) && own.world === name && !own.ground && !own.body, `[world] ${name} wears the eye: ${JSON.stringify(own)}`);
  await go(page, 'area-learn');
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => ({ keys: [...document.querySelectorAll('#dock .tabcap button.on')].map((b) => getComputedStyle(b).borderTopStyle), kick: document.querySelector('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim() ?? '' }));
  check(!/THE WALL/i.test(l.kick) && !/LOOKING AT/i.test(l.kick), `[world] ${name}'s LEARN carries the eye's instruments: ${JSON.stringify(l)}`);
  await ctx.close();
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THE EYE run clean at 440 × 956 and 390 × 844: the gallery built and kept, Home the wall with one sharp feed, the instruments on every screen, the plan, the jump bar, under budget, the globe started after Home was shown and costing a few frames a second, the other worlds untouched.');
process.exit(problems.length ? 1 : 0);
