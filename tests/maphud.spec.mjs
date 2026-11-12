// THE MAP, the third whole HUD (BRIEF-MAP-EYE-HUDS; apps/web/src/features/core/map/home.ts, shell/house.ts scaleOn, styles.css THE MAP): the
// Machine's own map on the owner's 440 × 956 and a 390 × 844 phone (every check fails on the code before this brief: it was run against it once):
//   a. THE GALLERY: THE MAP's card has no COMING; a tap sets recipe.world 'map' at once, says YOU'RE IN IT, survives a reload; a tap on THE SCAN
//      brings The Scan back; "the map" by words switches (no model), the colour staying his; "open the map" is NOT the look's words;
//   b. HOME IS THE MAP: the stamp, the greeting and the one sentence (the caption's words), the plane in perspective (no flat grid over it),
//      six districts with their `N SCREENS` (a tap goes into the room), the square of nine with exactly one lit cell (tonight: the book, the
//      agenda or the Brief) and the orb in its middle, his recents and favourites as cells (a tap opens, a long press pins), the ask line
//      and the mic, the scale with seven ticks and Home marked; nothing sideways; every control 44 pt; no scan marks, no ink frame;
//   c. THE SCALE ON EVERY SCREEN: LEARN and Settings with LEARN / ME marked, the page ending above it, the plan from the kick with seven
//      rooms drawn as dashed districts, the jump bar finding "rad" → RADIO · 04;
//   d. THE SPEED HABIT AND THE GROUND'S COST: Home in the map and a room's screen under 300 ms; the plane's drift is one compositor
//      animation that stops under Reduce Motion and MOTION calm; no animation on any other element of the page;
//   e. nothing of the map in The Scan, ONE INK or Glass: their Home carries no map frame, and the map's frame is not the ink page.
//   BASE=http://localhost:8803 node tests/maphud.spec.mjs [outDir]
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
const MAP = { ground: 'graphite', world: 'map', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const WIDE = { width: 390, height: 844 };

/** A phone opened on Ghosty, signed in, his name Boss, in the look asked for; `book`: a book on the go; `pins`: his favourites. */
async function open({ viewport = PHONE, look = MAP, book = false, pins = ['lens', 'agenda'], recents = null, once = true } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, look, book, pins, recents, once }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!once || !localStorage.getItem('spec.map.seeded')) {
      localStorage.setItem('spec.map.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (book) localStorage.setItem('ghosty.places', JSON.stringify({ map: { 'alices-adventures-in-wonderland.pdf': { n: 4, off: 0, page: 42, pct: 0.37, done: false, at: Date.now() - 86_400_000 } } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the stopwatch's tests (timed() below): the printed page drawn, the room's band drawn, the jump bar open with its first rows
    window.__mapTests = {
      home: () => { const f = document.querySelector('.maphudframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('maphome') && !!r && r.width > 0 && !!document.querySelector('.mapask')?.getBoundingClientRect().width; },
      see: () => document.body.dataset.tab === 'area-see' && !!document.querySelector('#pg-area-see .roomband')?.getBoundingClientRect().width,
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
    if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest('canvas, .mapplane, .maporb, .mapgrid')) bad.push(`sideways: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push(`the page scrolls sideways: ${document.documentElement.scrollWidth}`);
  return bad;
}, [W, scope]);
const settingsLook = (page) => page.evaluate(() => window.__ghosty.settings.get().look?.world ?? null);
const foot = (page) => page.evaluate(() => [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, label: b.getAttribute('aria-label') || b.title || b.textContent.trim(), lit: b.classList.contains('on'), rect: (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(b.getBoundingClientRect()) })));
/** Click a thing and the ms until a named test is true on a frame (the phone's own stopwatch; the tests live in the page: its policy forbids building code from strings). */
async function timed(page, click, name) {
  await page.evaluate((name) => {
    window.__map_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const f = window.__mapTests[name];
      const tick = () => {
        if (f()) window.__map_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, name);
  await click();
  await page.waitForFunction(() => window.__map_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__map_t);
}
const HOME_READY = () => { const f = document.querySelector('.maphudframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('maphome') && !!r && r.width > 0 && !!document.querySelector('.mapask')?.getBoundingClientRect().width; };


// ---- a. the gallery: THE MAP's card, a tap, a reload, THE SCAN back, the words
{
  const { ctx, page } = await open({ look: SCAN, once: true });
  const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
  const themePage = async () => {
    await go(page, 'settings');
    await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
    await openSection(page, 'settings', 'Appearance').catch(() => undefined);
    await page.locator('#pg-settings .scanset button.srow').filter({ has: page.locator('.srname', { hasText: /^Theme$/i }) }).first().click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open'));
    await page.waitForSelector(card('map'), { timeout: 8000 }).catch(() => problems.push('[gallery] the Theme page has no THE MAP card'));
    await page.waitForTimeout(400);
  };
  await themePage();
  const m0 = await page.evaluate((sel) => ({ coming: !!document.querySelector(`${sel} .gg-coming`), built: document.querySelector(sel)?.dataset.built }), card('map'));
  check(!m0.coming && m0.built === 'true', `[gallery] THE MAP's card is still COMING: ${JSON.stringify(m0)}`);
  const comings = await page.$$eval('#pg-settings .gg-look', (bs) => bs.filter((b) => b.querySelector('.gg-coming')).map((b) => b.dataset.look).join());
  check(comings === 'eye,orbit,grown', `[gallery] COMING is on ${comings} (want eye,orbit,grown)`);
  await page.click(card('map'));
  await until(page, () => document.documentElement.dataset.world === 'map', 5000, '[gallery] a tap on THE MAP did not make the world map');
  const said = (k) => page.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
  const s1 = await said('map');
  check(s1.on === 'true' && /you.re in it/i.test(s1.line) && /THE MAP/i.test(s1.head), `[gallery] THE MAP after its tap: ${JSON.stringify(s1)}`);
  check((await settingsLook(page)) === 'map', '[gallery] THE MAP was not kept in his settings');
  await page.screenshot({ path: `${out}/map-gallery.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.documentElement.dataset.world === 'map'), '[gallery] THE MAP did not survive a reload');
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
  // the looks still coming say their line and change nothing
  await page.fill('#cin', 'the eye');
  await page.press('#cin', 'Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes('The Eye is coming')), null, { timeout: 8000 }).catch(() => problems.push('[words] "the eye" did not say its line'));
  check(await page.evaluate(() => document.documentElement.dataset.world === 'scan'), '[words] "the eye" changed the world');
  await page.fill('#cin', 'the map');
  await page.press('#cin', 'Enter');
  await until(page, () => document.documentElement.dataset.world === 'map', 8000, '[words] "the map" did not make the world map');
  const wd = await page.evaluate(() => ({ colour: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, said: [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => /The Map/.test(t)).pop() ?? '' }));
  check(wd.colour === 'ember' && wd.saved === 'ember', `[words] "the map" changed his colour: ${JSON.stringify(wd)}`);
  check(/The Map: on\./.test(wd.said), `[words] "the map" answered "${wd.said}"`);
  check(!asked.length, `[words] the brain was asked ${asked.length} times for "the map"`);
  await ctx.close();
}

// ---- b. Home is the map, at 440 and at 390
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, book: true, recents: ['library', 'eye', 'brief'] });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[home ${tag}] Home never became the map`);
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const text = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const box = (s) => { const r = q(s)?.getBoundingClientRect(); return r && [r.x, r.y, r.width, r.height].map(Math.round); };
    const fr = q('.maphudframe').getBoundingClientRect();
    const cells = [...document.querySelectorAll('.mapnine .mapcell')].map((c) => ({ slot: c.dataset.slot, kind: c.dataset.kind, lit: c.classList.contains('lit'), id: c.dataset.id ?? '', name: c.querySelector('.mcname')?.textContent ?? '', tag: c.querySelector('.mctag')?.textContent ?? '', w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) }));
    return {
      stamp: text('.mapmast .g-stamp'), say: text('.mapsay'), say2: text('.mapsay2'), state: window.__ghosty?.map ? { on: window.__ghosty.map.on, line: window.__ghosty.map.line, tonight: window.__ghosty.map.tonight, cells: window.__ghosty.map.cells, districts: window.__ghosty.map.districts } : null,
      districts: [...document.querySelectorAll('.mapdistrict')].map((d) => ({ room: d.dataset.room, name: d.querySelector('.mdname')?.textContent, count: d.querySelector('.mdcount')?.textContent, pins: d.querySelectorAll('.mdpins i').length, border: getComputedStyle(d).borderTopStyle, h: Math.round(d.getBoundingClientRect().height) })),
      cells, orb: box('.maporbhost'), nine: box('.mapnine'), orbCanvas: !!q('.maporbhost canvas'), orbCell: q('.maporb')?.style.gridArea || css(q('.maporb'), 'grid-area'),
      hand: text('.maphand'), field: text('.mapfield'), mic: !!q('.mapspeak svg'),
      plane: css(q('.mapplane'), 'transform'), flat: css(document.body, 'display') && getComputedStyle(document.body, '::before').display,
      scale: [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, label: b.getAttribute('aria-label') || b.textContent.trim(), lit: b.classList.contains('on'), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })),
      kick: text('#dock .housekick'), houseask: css(q('#dock .houseask'), 'display'), footTop: Math.round(q('#dock .tabcap').getBoundingClientRect().top),
      frameBottom: Math.round(fr.bottom), frameTop: Math.round(fr.top), askBox: box('.mapask'), scroll: [q('.maphudframe').scrollHeight, q('.maphudframe').clientHeight, css(q('.maphudframe'), 'padding-bottom')],
      scanmarks: [...document.querySelectorAll('.scanmarks, .scanleads')].filter((e) => e.getClientRects().length).length, ink: document.querySelectorAll('.inkframe').length ? [...document.querySelectorAll('.inkframe')].filter((e) => getComputedStyle(e).display !== 'none').length : 0,
      topShown: q('#top') ? getComputedStyle(q('#top')).display : 'none', glow: css(document.documentElement, '--g-glow'), world: document.documentElement.dataset.world, edge: css(document.documentElement, '--g-plate-edge'),
    };
  });
  check(/^(SUN|MON|TUE|WED|THU|FRI|SAT) \d{1,2} [A-Z]{3} · \d{2}:\d{2} · BIRMINGHAM · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(h.stamp), `[home ${tag}] the stamp reads "${h.stamp}"`);
  check(/^Good (morning|afternoon|evening|night), Boss\.$/.test(h.say) && h.say2.length > 3 && h.state && h.state.line === h.say2, `[home ${tag}] the words: "${h.say}" / "${h.say2}" / state ${h.state?.line}`);
  check(h.districts.map((d) => d.room).join() === 'see,make,learn,plan,life,me' && h.districts.every((d) => /^\d+ screens$/i.test(d.count) && d.pins === +d.count.split(' ')[0] && d.border === 'dashed' && d.h >= 44), `[home ${tag}] the districts: ${JSON.stringify(h.districts)}`);
  check(h.districts.find((d) => d.room === 'learn')?.count === '7 screens' && h.districts.find((d) => d.room === 'see')?.count === '2 screens', `[home ${tag}] LEARN has ${h.districts.find((d) => d.room === 'learn')?.count}`);
  const lit = h.cells.filter((c) => c.lit);
  check(lit.length === 1 && lit[0].kind === 'tonight' && lit[0].slot === 't' && /Alice/.test(lit[0].name) && /^TONIGHT|THIS MORNING|TODAY$/i.test(lit[0].tag), `[home ${tag}] the lit cell: ${JSON.stringify(lit)}`);
  check(h.cells.length === 8 && h.state.cells.length === 8 && h.cells.filter((c) => c.kind === 'recent').length >= 2 && h.cells.filter((c) => c.kind === 'favourite').map((c) => c.id).join() === 'lens,agenda', `[home ${tag}] the square: ${JSON.stringify(h.cells.map((c) => `${c.slot}:${c.kind}:${c.id}`))}`);
  check(h.cells.filter((c) => c.kind !== 'free').every((c) => c.h >= 44 && c.w >= 44), `[home ${tag}] a cell under 44 pt: ${JSON.stringify(h.cells.filter((c) => c.h < 44 || c.w < 44))}`);
  check(h.orbCanvas && h.orb && h.orb[2] >= 80 && Math.abs(h.orb[2] - h.orb[3]) <= 30 && h.nine && h.orb[0] > h.nine[0] + 40 && h.orb[0] + h.orb[2] < h.nine[0] + h.nine[2] - 40, `[home ${tag}] the orb's box ${h.orb} is not in the middle of the square ${h.nine}`);
  check(/^at hand$/i.test(h.hand) && /fly there/.test(h.field) && h.mic, `[home ${tag}] the words: "${h.hand}" / "${h.field}" / mic ${h.mic}`);
  check(/matrix\(3d|matrix3d/.test(h.plane) && h.flat === 'none', `[home ${tag}] the plane is ${h.plane.slice(0, 30)} and the flat grid over it is ${h.flat}`);
  check(h.scale.length === 7 && h.scale.map((f) => f.area).join() === 'ask,see,make,learn,plan,life,me' && h.scale[0].lit && h.scale.slice(1).every((f) => !f.lit) && h.scale[0].label === 'Home', `[home ${tag}] the scale: ${JSON.stringify(h.scale)}`);
  check(/THE MAP · 7 DISTRICTS/i.test(h.kick) && /YOU ARE IN HOME/i.test(h.kick) && h.houseask === 'none', `[home ${tag}] the scale's words: "${h.kick}", second ask line ${h.houseask}`);
  check(h.frameBottom <= innerHeightOf(vp) && h.scroll[2] !== '0px', `[home ${tag}] the frame's foot padding is ${h.scroll[2]}`);
  check(h.scanmarks === 0 && h.ink === 0 && h.topShown === 'none' && h.glow === '1' && h.world === 'map', `[home ${tag}] Scan marks ${h.scanmarks}, ink ${h.ink}, top ${h.topShown}, glow ${h.glow}, world ${h.world}`);
  const bad = await floor(page, vp.width, '.maphudframe');
  check(!bad.length, `[home ${tag}] the floor: ${bad.slice(0, 6).join('; ')}`);
  // the content of Home ends above the scale (the plane may run under it: it is the ground)
  const ends = await page.evaluate(() => { const a = document.querySelector('.mapask').getBoundingClientRect(); const k = document.querySelector('#dock .housekick').getBoundingClientRect(); return [Math.round(a.bottom), Math.round(k.top)]; });
  check(ends[0] <= ends[1] + 1, `[home ${tag}] the ask line (${ends[0]}) runs under the scale's words (${ends[1]})`);
  await page.screenshot({ path: `${out}/map-home-${tag}.png` });
  // a district opens its room; the scale follows; the page ends above it
  await page.click('.mapdistrict[data-room="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[home ${tag}] a tap on the LEARN district did not open the room`);
  check((await foot(page)).find((f) => f.lit)?.area === 'learn', `[home ${tag}] on LEARN the scale marks ${(await foot(page)).find((f) => f.lit)?.area}`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back`);
  // a cell opens its thing; a long press on one pins it
  await page.click('.mapcell[data-kind="recent"] >> nth=0');
  await until(page, () => document.body.dataset.tab === 'library', 8000, `[home ${tag}] a tap on a recent cell did not open it`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back (2)`);
  const cell = page.locator('.mapcell[data-kind="recent"]').nth(1);
  const id = await cell.getAttribute('data-id');
  const box = await cell.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#pinsheet'), 4000, `[home ${tag}] a long press on a cell did not open the pin sheet`);
  await page.click('#pinsheet [data-pin="pin"]');
  await until(page, (id) => [...document.querySelectorAll('.mapcell[data-kind="favourite"]')].some((b) => b.dataset.id === id), 4000, `[home ${tag}] the pinned cell ${id} did not become a favourite`, id);
  await ctx.close();
}
function innerHeightOf(vp) { return vp.height; }

// ---- b2. the thing of the hour: the Brief (no book), the morning and the evening words
{
  const { ctx, page } = await open({ book: false });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[hour] Home never became the map');
  await page.waitForTimeout(600);
  const brief = await page.evaluate(() => ({ t: window.__ghosty.map.tonight, lit: document.querySelector('.mapcell.lit .mcname')?.textContent }));
  // the preview's agenda is shared by every spec that runs against it (routec leaves "Call Mum" in it): so what the lit cell must be is worked out from
  // the agenda's own content, read as the app reads it: an event still ahead makes it the agenda's next thing, an empty one makes it the Brief
  const agenda = await fetch(`${base}/api/agenda`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()).catch(() => null);
  const nowT = Date.now();
  const ahead = (agenda?.events ?? []).filter((e) => (e.end ?? e.start) > nowT).sort((a, b) => a.start - b.start);
  if (ahead.length) {
    check(brief.t.kind === 'agenda' && brief.t.name === ahead[0].title && brief.lit === ahead[0].title, `[hour] with no book and "${ahead[0].title}" next in the agenda the lit cell is ${JSON.stringify(brief)}`);
  } else {
    check(brief.t.kind === 'brief' && brief.t.name === 'The Brief' && brief.lit === 'The Brief', `[hour] with no book and nothing in the agenda the lit cell is ${JSON.stringify(brief)}`);
  }
  await ctx.close();
}

// ---- c. the scale on every screen: LEARN, Settings; the plan from the kick; the jump bar
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[scale ${tag}] Home never became the map`);
  await page.click('#dock .tabcap button[data-area="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[scale ${tag}] the LEARN tick did not open the room`);
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const keys = [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, lit: b.classList.contains('on'), colour: getComputedStyle(b).color, marker: getComputedStyle(b, '::before').clipPath, tick: getComputedStyle(b, '::after').borderLeftWidth }));
    const pr = [...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none').map((p) => Math.round(p.getBoundingClientRect().bottom));
    return { keys, kickTop: Math.round(q('#dock .housekick').getBoundingClientRect().top), pageBottom: Math.max(...pr, 0), title: q('#top .navtitle')?.textContent.trim(), kick: q('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim(), ask: css(q('#dock .houseask'), 'display'), rule: css(q('#dock .tabcap'), 'border-top-width'), floorA: css(document.documentElement, '--g-floor-a'), dashed: getComputedStyle(q('.roomband, #stage > .pg .g-plate') ?? document.body).borderTopStyle };
  });
  check(l.keys.length === 7 && l.keys.filter((k) => k.lit).map((k) => k.area).join() === 'learn', `[scale ${tag}] on LEARN the scale marks ${l.keys.filter((k) => k.lit).map((k) => k.area)}`);
  check(l.keys.filter((k) => k.lit)[0]?.marker.startsWith('polygon') && l.keys.every((k) => k.tick !== '0px'), `[scale ${tag}] the marker and the ticks are not drawn: ${JSON.stringify(l.keys.map((k) => [k.area, k.marker.slice(0, 8), k.tick]))}`);
  check(l.pageBottom > 0 && l.pageBottom <= l.kickTop + 1, `[scale ${tag}] LEARN's page ends at ${l.pageBottom}, under the scale's words at ${l.kickTop}`);
  check(/THE MAP · 7 DISTRICTS/i.test(l.kick) && /YOU ARE IN LEARN/i.test(l.kick) && /LEARN/i.test(l.title ?? ''), `[scale ${tag}] the words: "${l.kick}" / "${l.title}"`);
  check(Number(l.floorA) > 0, `[scale ${tag}] the plotting grid is not the ground of LEARN (floor ${l.floorA})`);
  const bad = await floor(page, vp.width, '#stage > .pg');
  check(!bad.length, `[scale ${tag}] LEARN's floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/map-learn-${tag}.png` });
  const room = await timed(page, () => page.click('#dock .tabcap button[data-area="see"]'), 'see');
  timings.push(`room ${tag}: SEE's screen ${room} ms after the tap`);
  check(room != null && room < BUDGET, `[speed ${tag}] a room's screen took ${room} ms (the budget is ${BUDGET} ms)`);
  await go(page, 'settings');
  await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ lit: [...document.querySelectorAll('#dock .tabcap button.on')].map((b) => b.dataset.area).join(), kickTop: Math.round(document.querySelector('#dock .housekick').getBoundingClientRect().top), bottom: Math.max(...[...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length).map((p) => Math.round(p.getBoundingClientRect().bottom))), title: document.querySelector('#top .navtitle')?.textContent.trim(), sets: document.querySelectorAll('#pg-settings .scanset button.srow').length, edge: getComputedStyle(document.querySelector('#pg-settings .scanset')).borderTopStyle }));
  check(st.lit === 'me' && st.bottom <= st.kickTop + 1 && /SETTINGS/i.test(st.title ?? '') && st.sets > 5, `[scale ${tag}] Settings: ${JSON.stringify(st)}`);
  check(st.edge === 'dashed', `[scale ${tag}] Settings' plate is ${st.edge}, not the map's dashed border`);
  await page.screenshot({ path: `${out}/map-settings-${tag}.png` });
  const sbad = await floor(page, vp.width, '#stage > .pg');
  check(!sbad.length, `[scale ${tag}] Settings' floor: ${sbad.slice(0, 6).join('; ')}`);
  await ctx.close();
}

// ---- c2. the plan from the kick (seven districts, dashed); the jump bar from the ask line: "rad" → RADIO · 04, under 300 ms
{
  const { ctx, page } = await open({});
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[plan] Home never became the map');
  await page.click('#dock .housebtn');
  await until(page, () => !!document.querySelector('#plan'), 4000, '[plan] a tap on the kick did not open the plan');
  const pl = await page.evaluate(() => ({ rooms: [...document.querySelectorAll('#plan .planroom')].map((r) => r.querySelector('.rtitle')?.textContent), things: document.querySelectorAll('#plan .planthing').length, tab: document.body.dataset.tab, head: document.querySelector('#plan .planhead')?.textContent.replace(/\s+/g, ' ').trim(), lit: document.querySelector('#plan .planroom.lit .rtitle')?.textContent, border: getComputedStyle(document.querySelector('#plan .plangrid')).borderTopStyle, litBorder: getComputedStyle(document.querySelector('#plan .planroom.lit')).borderTopColor, accent: getComputedStyle(document.documentElement).getPropertyValue('--g-accent').trim(), bottom: Math.round(document.querySelector('#plan').getBoundingClientRect().bottom), capTop: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top) }));
  check(pl.rooms.join() === 'HOME,SEE,MAKE,LEARN,PLAN,LIFE,ME' && pl.things > 30 && pl.tab === 'core' && /THE MAP · 7 DISTRICTS/i.test(pl.head), `[plan] the plan: ${JSON.stringify(pl)}`);
  check(pl.lit === 'HOME' && pl.border === 'dashed' && pl.bottom <= pl.capTop + 12, `[plan] the plan is not the map's districts standing on the scale: ${JSON.stringify({ lit: pl.lit, border: pl.border, bottom: pl.bottom, capTop: pl.capTop })}`);
  await page.screenshot({ path: `${out}/map-plan.png` });
  await page.click('#plan .planthing[data-room="see"] >> nth=0');
  await until(page, () => document.body.dataset.tab !== 'core' && !document.querySelector('#plan'), 6000, '[plan] a tap on a number did not open the thing and close the plan');
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[plan] Home did not come back');
  const opens = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await until(page, HOME_READY, 10000, '[jump] Home did not come back');
    await page.waitForTimeout(250);
    const ms = await timed(page, () => page.click('.mapfield'), 'jump');
    opens.push(ms ?? 9999);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  timings.push(`jump bar: opens ${opens.join(', ')} ms from the ask line (median ${median(opens)})`);
  check(median(opens) < BUDGET, `[speed] the jump bar's open took ${median(opens)} ms (median of five: ${opens.join(', ')}; the budget is ${BUDGET} ms)`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[jump] Home did not come back');
  await page.click('.mapfield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', 'rad');
  await until(page, () => /^RADIO · 04$/i.test(window.__ghosty?.jump?.found ?? ''), 4000, '[jump] "rad" did not find RADIO · 04');
  await page.screenshot({ path: `${out}/map-jump-typed.png` });
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, '[jump] OPEN did not open Radio');
  check((await foot(page)).some((f) => f.lit), '[jump] on Radio the scale marks no room');
  await ctx.close();
}

// ---- d. Home in the map under 300 ms (median of five); the ground's cost: one compositor animation, none under Reduce Motion or calm
{
  const { ctx, page } = await open({ book: true });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[speed] Home never became the map');
  const times = [];
  for (let i = 0; i < 5; i++) {
    await page.click('#dock .tabcap button[data-area="see"]');
    await until(page, () => document.body.dataset.tab === 'area-see', 8000, '[speed] SEE did not open');
    await page.waitForTimeout(500);
    const ms = await timed(page, () => page.click('#dock .tabcap button[data-area="ask"]'), 'home');
    times.push(ms ?? 9999);
    await page.waitForTimeout(400);
  }
  timings.push(`home: map opens ${times.join(', ')} ms from the Home tick (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed] Home in the map opened in ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target && !!a.effect.target.closest?.('.maphudframe')).map((a) => `${a.effect.target.className}:${a.animationName ?? ''}`));
  check(anims.length <= 1 && anims.every((a) => /mapgrid/.test(a)), `[ground] the page runs more than the plane's drift: ${anims}`);
  const stepped = await page.evaluate(() => getComputedStyle(document.querySelector('.mapgrid')).animationTimingFunction);
  check(/steps/.test(stepped), `[ground] the drift is not stepped (${stepped}): it would redraw at the screen's rate`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => getComputedStyle(document.querySelector('.mapgrid')).animationName);
  check(reduced === 'none', `[ground] under Reduce Motion the plane still drifts (${reduced})`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => (document.documentElement.dataset.motion = 'calm'));
  check((await page.evaluate(() => getComputedStyle(document.querySelector('.mapgrid')).animationName)) === 'none', '[ground] under MOTION calm the plane still drifts');
  await ctx.close();
}

// ---- e. nothing of the map in the other worlds, and ink's page is not the map's
for (const [look, name] of [[SCAN, 'scan'], [INK, 'ink'], [GLASS, 'glass']]) {
  const { ctx, page } = await open({ look, book: true });
  await go(page, 'core');
  await page.waitForTimeout(1500);
  const own = await page.evaluate(() => ({ maphome: document.body.classList.contains('maphome'), frame: !!document.querySelector('.maphudframe') && getComputedStyle(document.querySelector('.maphudframe')).display !== 'none', kick: document.querySelector('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim() ?? '', world: document.documentElement.dataset.world, ticks: getComputedStyle(document.querySelector('#dock .tabcap'), '::before').borderTopWidth }));
  check(!own.maphome && !own.frame && !/THE MAP/i.test(own.kick) && own.world === name, `[world] ${name} wears the map: ${JSON.stringify(own)}`);
  await go(page, 'area-learn');
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => ({ marker: [...document.querySelectorAll('#dock .tabcap button.on')].map((b) => getComputedStyle(b, '::before').clipPath), kick: document.querySelector('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim() ?? '' }));
  check(!l.marker.some((m) => m.startsWith('polygon')) && !/THE MAP/i.test(l.kick), `[world] ${name}'s LEARN carries the map's scale: ${JSON.stringify(l)}`);
  await ctx.close();
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THE MAP run clean at 440 × 956 and 390 × 844: the gallery built and kept, Home the map, the scale on every screen, the plan, the jump bar, under budget, the ground costing one stepped animation, the other worlds untouched.');
process.exit(problems.length ? 1 : 0);
