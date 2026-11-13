// GROWN UP, the sixth whole HUD (BRIEF-GROWN-UP-HUD; apps/web/src/shell/capsule.ts, shell/drops.ts, features/core/grown/home.ts, shell/house.ts THE ROOMS
// layer, shell/areas.ts hubs, show/stage.ts, styles.css GROWN UP): today's look with less on it, one glass capsule at the foot of every screen; on the
// owner's 440 × 956 and a 390 × 844 phone (every check fails on the code before this brief: it was run against it once):
//   a. THE GALLERY: GROWN UP's card has no COMING and no card has but THE EYE's; a tap sets recipe.world 'grown' at once, says YOU'RE IN IT, survives a
//      reload; a tap on THE SCAN brings The Scan back; "grown up" by words switches to it again (no model), the colour staying his;
//   b. HOME: the stamp, the greeting and one sentence, the orb with ONE ring (free answers left, said in a line), the hour's card, one row of chips
//      (recents then favourites), the capsule with the rooms key, the field and the small Mind; no second bar, no four gauges; nothing sideways; every
//      control 44 pt; a chip opens its screen, a long press pins; the book, the Brief and the agenda each as tonight;
//   c. THE CAPSULE ON EVERY SCREEN (LEARN, Settings): the page ends above it; ROOMS opens the layer with recent and starred on top and seven rooms with
//      their chips, a chip opens its screen; the field finds "rad" → RADIO under 300 ms and a sentence goes to the brain as a turn; the small Mind's press
//      talks (the mic's own press) and its hold fans the quick switcher;
//   d. A HUB IS THREE LAYERS: the recent card in front and raised with its panels as chips, the favourites one level back, the rest folded into one
//      stack that opens in place;
//   e. THE STAGE: a seeded map and a seeded document are the glass panel with the dashed bezel lit from the orb docked in its top edge; giving it back is
//      the panel folding; under Reduce Motion it is there at once;
//   f. THE SEVEN DENSE SCREENS each have fewer elements in their top half than in GLASS (counted), and every dropped thing is one tap away;
//   g. THE SPEED HABIT: Home under 300 ms (median of five); under Reduce Motion nothing runs;
//   h. THE BIGGEST TEXT: Home and a hub at BODY 21 on 390 × 844: nothing sideways, every control 44 pt;
//   i. nothing of GROWN UP in THE SCAN, THE MAP, ORBIT, ONE INK or Glass (their Home, LEARN and Settings' key facts as before), and Glass the same after
//      a visit to GROWN UP.
// (the finding rule in all worlds is apps/edge/test/finding.test.mjs)
//   BASE=http://localhost:8817 node tests/grownhud.spec.mjs [outDir]
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
const GROWN = { ground: 'graphite', world: 'grown', night: 'graphite', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const MAP = { ground: 'slate', world: 'map', night: 'slate', switches: {} };
const ORBIT = { ground: 'black', world: 'orbit', night: 'black', switches: {} };
const WIDE = { width: 390, height: 844 };
const ROOMS = ['home', 'see', 'make', 'learn', 'plan', 'life', 'me'];

/** A phone opened on Ghosty, signed in, his name Boss, in the look asked for; `book`: a book on the go; `pins`: his favourites. */
async function open({ viewport = PHONE, look = GROWN, book = false, pins = ['lens', 'agenda'], recents = null, once = true, reduced = false, body = 17, show = false } = {}) {
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
    if (!once || !localStorage.getItem('spec.grown.seeded')) {
      localStorage.setItem('spec.grown.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look: { ...look, switches: { ...look.switches, body } }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (book) localStorage.setItem('ghosty.places', JSON.stringify({ map: { 'alices-adventures-in-wonderland.pdf': { n: 4, off: 0, page: 42, pct: 0.37, done: false, at: Date.now() - 86_400_000 } } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
    }
    if (show) window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the stopwatch's tests (timed() below): Home drawn, a hub's layers drawn
    window.__grownTests = {
      home: () => { const f = document.querySelector('.gnframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('grownhome') && !!r && r.width > 0 && !!document.querySelector('.gnhour .gnname') && document.querySelectorAll('.gnchip').length > 0; },
      hub: () => document.body.dataset.tab === 'area-see' && !!document.querySelector('#pg-area-see .glylayer')?.getBoundingClientRect().width,
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
const floor = (page, W, scope, skip = 'canvas, .gnring') => page.evaluate(([W, scope, skip]) => {
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
    window.__grown_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const f = window.__grownTests[name];
      const tick = () => {
        if (f()) window.__grown_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, name);
  await click();
  await page.waitForFunction(() => window.__grown_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__grown_t);
}
const HOME_READY = () => { const f = document.querySelector('.gnframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('grownhome') && !!r && r.width > 0 && !!document.querySelector('.gnhour .gnname') && document.querySelectorAll('.gnchip').length > 0; };
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** Hold the small Mind in the capsule 450 ms (the hold is 350) and leave the finger down. */
async function holdMind(page) {
  const b = await page.locator('#dock .gcapmind').boundingBox();
  const c = centre(b);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  return c;
}
/** How much of the top half of a screen is drawn: the elements of its page that are seen and begin above the middle of the phone. */
// (what a screen exists to LIST, its games, its second column, is not counted: folding the chart above it lets the list rise into the top half, which is
// the point of folding, so the count is of the controls and readings round it)
const LISTS = { gym: '.gymcards, .gympager', library: '.col.cR, .pn.wiki' };
const topHalf = (page, tab) => page.evaluate(([tab, list]) => {
  const pg = document.getElementById(`pg-${tab}`);
  const half = innerHeight / 2;
  let n = 0;
  for (const e of pg.querySelectorAll('*')) {
    if (list && e.closest(list)) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top < half && r.bottom > 0) n++;
  }
  return n;
}, [tab, LISTS[tab] ?? '']);

// (a check that cannot get as far as its next step says where it stopped, and the run still reports every problem found before it)
try {
// ---- a. the gallery: GROWN UP's card, a tap, a reload, THE SCAN back, the words
{
  const { ctx, page } = await open({ look: SCAN, once: true });
  const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
  const themePage = async () => {
    await go(page, 'settings');
    const w = await page.evaluate(() => document.documentElement.dataset.world);
    await page.waitForSelector(w === 'scan' ? '#pg-settings.listmode .scanset button.srow' : '#pg-settings.listmode .lgrp', { timeout: 15000 }).catch(() => problems.push(`[gallery] Settings never drew its list in ${w}`));
    await openSection(page, 'settings', 'Appearance').catch(() => undefined);
    const scanRow = page.locator('#pg-settings .scanset button.srow').filter({ has: page.locator('.srname', { hasText: /^Theme$/i }) }).first();
    if (w === 'scan') await scanRow.click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open'));
    else await page.locator('#pg-settings .pn.themepn > h3').first().click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open (the list)'));
    await page.waitForSelector(card('grown'), { timeout: 8000 }).catch(() => problems.push('[gallery] the Theme page has no GROWN UP card'));
    await page.waitForTimeout(400);
  };
  await themePage();
  const g0 = await page.evaluate((sel) => ({ coming: !!document.querySelector(`${sel} .gg-coming`), built: document.querySelector(sel)?.dataset.built }), card('grown'));
  check(!g0.coming && g0.built === 'true', `[gallery] GROWN UP's card is still COMING: ${JSON.stringify(g0)}`);
  const comings = await page.$$eval('#pg-settings .gg-look', (bs) => bs.filter((b) => b.querySelector('.gg-coming')).map((b) => b.dataset.look));
  check(comings.join() === '', `[gallery] COMING is on ${comings} (want none: all seven looks are built)`);
  await page.click(card('grown'));
  await until(page, () => document.documentElement.dataset.world === 'grown', 5000, '[gallery] a tap on GROWN UP did not make the world grown');
  const said = (k) => page.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
  const s1 = await said('grown');
  check(s1.on === 'true' && /you.re in it/i.test(s1.line) && /GROWN UP/i.test(s1.head), `[gallery] GROWN UP after its tap: ${JSON.stringify(s1)}`);
  check((await settingsLook(page)) === 'grown', '[gallery] GROWN UP was not kept in his settings');
  await page.screenshot({ path: `${out}/grown-gallery.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.documentElement.dataset.world === 'grown'), '[gallery] GROWN UP did not survive a reload');
  await themePage();
  await page.click(card('scan'));
  await until(page, () => document.documentElement.dataset.world === 'scan', 5000, '[gallery] a tap on THE SCAN did not bring The Scan back');
  const s2 = await said('scan');
  check(s2.on === 'true' && /you.re in it/i.test(s2.line), `[gallery] THE SCAN after its tap: ${JSON.stringify(s2)}`);
  // "grown up" by words: no model, the world at once, the colour his (he is on Ember: it stays)
  await page.click('#pg-settings .pn.themepn.pushed .gg-sw[data-colour="ember"]');
  await until(page, () => document.documentElement.dataset.theme === 'ember', 5000, '[words] the ember swatch did not apply');
  const asked = [];
  page.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('scanhome'), 10000, '[words] Home did not wear The Scan before the words');
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', 'grown up');
  await page.press('#cin', 'Enter');
  await until(page, () => document.documentElement.dataset.world === 'grown', 8000, '[words] "grown up" did not make the world grown');
  const wd = await page.evaluate(() => ({ colour: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme }));
  check(wd.colour === 'ember' && wd.saved === 'ember', `[words] "grown up" changed his colour: ${JSON.stringify(wd)}`);
  check(!asked.length, `[words] the brain was asked ${asked.length} times for "grown up"`);
  await ctx.close();
}

// ---- b. Home, at 440 and at 390
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, book: true, recents: ['library', 'eye', 'brief'] });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[home ${tag}] Home never became GROWN UP's`);
  await page.waitForTimeout(1200);
  const h = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const text = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const box = (e) => e && (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(e.getBoundingClientRect());
    return {
      stamp: text('.gnmast .g-stamp'), say: text('.gnsay'), say2: text('.gnsay2'), host: box(q('.gnhost')), ring: box(q('.gnring')), hostCanvas: !!q('.gnhost canvas'), arcs: document.querySelectorAll('.gnarc').length, free: text('.gnfree'),
      hour: { kick: text('.gnhour .gnkick'), name: text('.gnhour .gnname'), meta: text('.gnhour .gnmeta'), prog: q('.gnhour .gnprog')?.getAttribute('aria-valuenow'), keys: [...document.querySelectorAll('.gnhour button')].map((b) => box(b)) },
      chips: [...document.querySelectorAll('.gnchips .gnchip')].map((b) => ({ id: b.dataset.id, kind: b.dataset.kind, name: b.querySelector('span')?.textContent, box: box(b) })),
      more: box(q('.gnchips .gnmore')),
      cap: { box: box(q('#dock .gcap')), rooms: box(q('#dock .gcaprooms')), field: box(q('#dock .gcapfield')), mind: box(q('#dock .gcapmind')), words: q('#dock .gcapwords')?.textContent, canvas: !!q('#dock .gcapmind canvas'), glass: css(q('#dock .gcap'), 'background-color') },
      state: window.__ghosty.grownHome && JSON.parse(JSON.stringify({ ...window.__ghosty.grownHome, clock: null })),
      hidden: ['.cside', '#cbar', '.rcwx', '.rcbelow', '#dock .tabcap', '#dock .houseask', '#dock .orbline', '.rcarcs', '.callout', '.gauges', '.gauge'].filter((s) => [...document.querySelectorAll(s)].some(seen)),
      bars: [...document.querySelectorAll('#dock .gcap, #dock .tabcap, #cbar, #dock .houseask')].filter(seen).length,
      frame: box(q('.gnframe')), W: innerWidth, H: innerHeight, you: box(q('#top .you')), glow: css(document.documentElement, '--g-glow'), world: document.documentElement.dataset.world,
    };
  });
  check(/^(SUN|MON|TUE|WED|THU|FRI|SAT) \d{1,2} [A-Z]{3} · \d{2}:\d{2} · BIRMINGHAM · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(h.stamp), `[home ${tag}] the stamp reads "${h.stamp}"`);
  check(/^Good (morning|afternoon|evening|night), Boss\.$/.test(h.say) && h.say2.length > 3, `[home ${tag}] the greeting is "${h.say}" and the sentence "${h.say2}"`);
  check(h.state && h.state.on && h.state.line === h.say2, `[home ${tag}] the sentence is not the one text the state holds: ${JSON.stringify({ line: h.state?.line, say2: h.say2 })}`);
  check(h.hostCanvas && h.host && Math.abs(h.host[0] + h.host[2] / 2 - h.W / 2) <= 2 && Math.abs(h.host[2] - h.host[3]) <= 1 && h.host[2] >= 180, `[home ${tag}] the orb's box ${h.host} is not centred (screen ${h.W} wide) or not round`);
  // ONE ring on the orb: the arc, its line, no more
  check(h.ring && h.arcs === 1 && h.ring[2] >= 220 && Math.abs(h.ring[0] + h.ring[2] / 2 - h.W / 2) <= 2, `[home ${tag}] the orb's ring: ${h.ring}, ${h.arcs} arcs`);
  check(/^(I have \d+% of today’s free answers left\.|Only \d+% of today’s free answers are left\.|Today’s free answers have no daily cap\.|Today’s free answers are used up\. Room comes back soon\.|I can’t count today’s free answers[^.]*\.|I’m counting today’s free answers\.|I haven’t measured today’s free answers yet\.|I have no AI key yet\. Add one in System and I can answer\.)$/.test(h.free) && h.state.ring.says === h.free, `[home ${tag}] the ring says "${h.free}" (the state: "${h.state?.ring?.says}")`);
  check(/^Carry on reading$/i.test(h.hour.kick) && /Alice/.test(h.hour.name) && /^Page 42 · 37% read · you were here yesterday$/.test(h.hour.meta) && h.hour.prog === '37', `[home ${tag}] the hour's card: ${JSON.stringify(h.hour)}`);
  check(h.hour.keys.length === 2 && h.hour.keys.every((b) => b[2] >= 44 && b[3] >= 44), `[home ${tag}] the hour's card holds ${h.hour.keys.length} keys, one of them under 44 pt: ${JSON.stringify(h.hour.keys)}`);
  // ONE row: the newest recent, then his two stars, and the dots (recents then favourites)
  check(h.state?.chips?.map((c) => `${c.kind}:${c.id}`).join() === 'recent:library,recent:eye,recent:brief,favourite:lens,favourite:agenda', `[home ${tag}] the chips' order is ${h.state?.chips?.map((c) => `${c.kind}:${c.id}`)}`);
  check(h.chips.map((c) => `${c.kind}:${c.id}`).join() === 'recent:library,favourite:lens,favourite:agenda' && h.more && h.chips.every((c) => c.name && c.box[3] >= 44), `[home ${tag}] the row shows ${JSON.stringify(h.chips.map((c) => `${c.kind}:${c.id}`))}`);
  check(new Set(h.chips.map((c) => c.box[1])).size === 1 && h.more && h.more[1] === h.chips[0].box[1] && h.more[2] >= 44, `[home ${tag}] the chips are not one row: ${JSON.stringify(h.chips.map((c) => c.box))} ${h.more}`);
  // the capsule: the rooms key, the one field, the small Mind
  check(h.cap.box && h.cap.rooms && h.cap.field && h.cap.mind && h.cap.rooms[0] < h.cap.field[0] && h.cap.field[0] < h.cap.mind[0] && h.cap.rooms[2] >= 44 && h.cap.rooms[3] >= 44 && h.cap.mind[2] >= 44 && h.cap.mind[3] >= 44 && h.cap.field[3] >= 44, `[home ${tag}] the capsule: ${JSON.stringify(h.cap)}`);
  check(h.cap.words === 'Ask or jump anywhere' && h.cap.canvas && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(h.cap.glass), `[home ${tag}] the field says "${h.cap.words}", the small Mind has a picture: ${h.cap.canvas}, glass: ${h.cap.glass}`);
  check(h.cap.box && h.cap.box[1] + h.cap.box[3] <= h.H - 4 && h.cap.box[1] >= h.hour.keys[0][1], `[home ${tag}] the capsule is not at the foot: ${h.cap.box}`);
  check(!h.hidden.length && h.bars === 1, `[home ${tag}] a second bar, a gauge or a house line is drawn: ${h.hidden}; ${h.bars} bars`);
  check(h.you && h.you[2] >= 44 && h.you[3] >= 44 && h.you[0] + h.you[2] > h.W - 40, `[home ${tag}] the avatar is not the one control top right: ${h.you}`);
  const bad = await floor(page, vp.width, '.gnframe, #dock .gcap, #top');
  check(!bad.length, `[home ${tag}] the floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/grown-home-${tag}.png` });
  // a chip opens its screen (a tap), and a long press pins or unpins as the deck does
  await page.click('.gnchip[data-id="library"]');
  await until(page, () => document.body.dataset.tab === 'library', 8000, `[home ${tag}] a tap on a chip did not open it`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back`);
  const hold = page.locator('.gnchip[data-kind="recent"]').first();
  const id = await hold.getAttribute('data-id');
  const hb = await hold.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#pinsheet'), 4000, `[home ${tag}] a long press on a chip did not open the pin sheet`);
  check((await page.evaluate(() => document.body.dataset.tab)) === 'core', `[home ${tag}] the long press opened the screen under the sheet`);
  await page.click('#pinsheet [data-pin="pin"]');
  await until(page, (id) => window.__ghosty.grownHome.chips.some((c) => c.id === id && c.kind === 'favourite'), 4000, `[home ${tag}] the pinned item ${id} did not move among his favourites`, id);
  // the three dots open THE ROOMS layer
  await page.click('.gnchips .gnmore');
  await until(page, () => !!document.querySelector('#plan.glayer'), 4000, `[home ${tag}] the three dots did not open THE ROOMS layer`);
  await ctx.close();
}

// ---- b2. the thing of the hour: the Brief (no book)
{
  const { ctx, page } = await open({ book: false });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[hour] Home never became GROWN UP\'s');
  await page.waitForTimeout(600);
  const brief = await page.evaluate(() => ({ t: window.__ghosty.grownHome.tonight, name: document.querySelector('.gnhour .gnname')?.textContent, prog: !!document.querySelector('.gnhour .gnprog'), kick: document.querySelector('.gnhour .gnkick')?.textContent }));
  check(brief.t.kind === 'brief' && brief.name === 'The Brief' && !brief.prog && brief.kick === 'The Brief', `[hour] with no book and nothing in the agenda the thing is ${JSON.stringify(brief)}`);
  check(await page.evaluate(() => document.querySelector('.gnchips .gnnone')?.textContent === 'Nothing opened yet. The last things you open wait here; hold one to star it.' || document.querySelectorAll('.gnchips .gnchip').length > 0), '[hour] an empty row says nothing');
  await ctx.close();
}

// ---- c. the capsule on every screen: LEARN, Settings; ROOMS; the field; the small Mind
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, recents: ['library', 'eye'] });
  await go(page, 'area-learn');
  await until(page, () => document.body.dataset.tab === 'area-learn' && !!document.querySelector('#pg-area-learn .glylayer'), 15000, `[capsule ${tag}] LEARN has no layers`);
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const seen = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const box = (e) => e && (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(e.getBoundingClientRect());
    const pgs = [...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none');
    return { cap: box(q('#dock .gcap')), rooms: box(q('#dock .gcaprooms')), field: box(q('#dock .gcapfield')), mind: box(q('#dock .gcapmind')), words: q('#dock .gcapwords')?.textContent, bar: ['#dock .tabcap', '#dock .houseask', '#dock .housekick', '#pg-area-learn .cmdbar', '#top .cmd'].filter((s) => seen(q(s))), pageBottom: Math.max(...pgs.map((p) => Math.round(p.getBoundingClientRect().bottom))), W: innerWidth, H: innerHeight, view: window.__ghosty.capsule?.view, title: q('#top .navtitle')?.textContent, back: !!q('#top .navback') && seen(q('#top .navback')), you: seen(q('#top .you')), canv: document.querySelectorAll('#dock .gcapmind canvas').length };
  });
  check(!l.bar.length, `[capsule ${tag}] LEARN still draws a second bar: ${l.bar}`);
  check(l.cap && l.cap[0] >= 12 && l.cap[0] + l.cap[2] <= l.W - 12 && l.cap[1] + l.cap[3] >= l.H - 40 && l.cap[3] >= 56, `[capsule ${tag}] the capsule is not at the foot: ${l.cap} (screen ${l.W}×${l.H})`);
  check(l.words === 'Find anything in Learn', `[capsule ${tag}] the field says "${l.words}"`);
  check(l.pageBottom > 0 && l.pageBottom <= l.cap[1] + 1, `[capsule ${tag}] LEARN's page ends at ${l.pageBottom}, under the capsule at ${l.cap[1]}`);
  check(l.view === 'standin' || l.view === 'mind', `[capsule ${tag}] the small Mind is drawn as "${l.view}" (the one Mind's view or its 2-D stand-in)`);
  check(l.canv === 1 && (await page.evaluate(() => document.querySelectorAll('canvas.mindhero').length <= 1)), `[capsule ${tag}] the second view costs a second renderer`);
  check(l.back && l.you && /Learn/i.test(l.title ?? ''), `[capsule ${tag}] LEARN's navigation: back ${l.back}, avatar ${l.you}, title "${l.title}"`);
  const bad = await floor(page, vp.width, '#stage > .pg, #dock .gcap, #top');
  check(!bad.length, `[capsule ${tag}] LEARN's floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/grown-learn-${tag}.png` });
  // ROOMS: the layer with recent and starred on top, seven rooms with their chips
  await page.click('#dock .gcaprooms');
  await until(page, () => !!document.querySelector('#plan.glayer'), 4000, `[rooms ${tag}] a tap on the rooms key did not open THE ROOMS layer`);
  await page.waitForTimeout(500);
  const pl = await page.evaluate(() => {
    const seen = (e) => !!e && e.getClientRects().length > 0;
    return {
      kick: [...document.querySelectorAll('#plan .glykick .g-truth')].map((e) => e.textContent), title: document.querySelector('#plan .glytitle h2')?.textContent,
      hand: [...document.querySelectorAll('#plan .glyhand .glychip')].map((b) => `${b.dataset.mark}:${b.dataset.id}`), label: [...document.querySelectorAll('#plan .glylabel')].map((e) => e.textContent),
      rooms: [...document.querySelectorAll('#plan .glyroom')].map((r) => `${r.dataset.room}:${r.querySelectorAll('.glychip').length}`), lit: document.querySelector('#plan .glyroom.lit')?.dataset.room,
      deck: !!document.querySelector('#plan .glychip[data-id="deck"]'), sheet: (({ top, bottom }) => ({ top: Math.round(top), bottom: Math.round(bottom) }))(document.querySelector('#plan').getBoundingClientRect()),
      capTop: Math.round(document.querySelector('#dock .gcap').getBoundingClientRect().top), expanded: document.querySelector('#dock .gcaprooms').getAttribute('aria-expanded'), closeBox: (({ width, height }) => [Math.round(width), Math.round(height)])(document.querySelector('#plan .glyclose').getBoundingClientRect()),
      small: [...document.querySelectorAll('#plan button')].filter((b) => seen(b) && (b.getBoundingClientRect().height < 43.5)).map((b) => b.textContent),
      avatarFree: document.querySelector('#plan').getBoundingClientRect().top >= document.querySelector('#top .you').getBoundingClientRect().bottom - 1,
    };
  });
  check(pl.kick.join() === 'The house · 7 rooms,You are in LEARN' && pl.title === 'Go to', `[rooms ${tag}] the layer's head: ${JSON.stringify(pl.kick)} "${pl.title}"`);
  check(pl.hand.join() === 'recent:library,recent:eye,starred:lens,starred:agenda' && pl.label.join() === 'Recent and starred,Every screen, by room', `[rooms ${tag}] recent and starred on top: ${JSON.stringify(pl.hand)} ${pl.label}`);
  check(pl.rooms.length === 7 && pl.rooms.map((r) => r.split(':')[0]).join() === ROOMS.join() && pl.rooms.every((r) => Number(r.split(':')[1]) >= 1) && pl.lit === 'learn' && !pl.deck, `[rooms ${tag}] the seven rooms with their chips: ${JSON.stringify(pl.rooms)} lit ${pl.lit}`);
  check(pl.sheet.bottom <= pl.capTop + 12 && pl.expanded === 'true' && pl.closeBox.every((n) => n >= 44) && !pl.small.length && pl.avatarFree, `[rooms ${tag}] the layer's place or keys: ${JSON.stringify(pl)}`);
  await page.screenshot({ path: `${out}/grown-rooms-${tag}.png` });
  // a chip opens its screen: two taps from anywhere (the rooms key, the chip)
  await page.click('#plan .glychip[data-id="radio"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, `[rooms ${tag}] the chip RADIO did not open Radio`);
  check(await page.evaluate(() => !document.querySelector('#plan')), `[rooms ${tag}] the layer stayed open after a chip`);
  // a room's name opens its hub
  await page.click('#dock .gcaprooms');
  await page.waitForSelector('#plan.glayer .glyroomhead[data-room="plan"]', { timeout: 4000 });
  await page.click('#plan .glyroomhead[data-room="plan"]');
  await until(page, () => document.body.dataset.tab === 'area-plan', 8000, `[rooms ${tag}] a room's name did not open its hub`);
  // a second tap on the key folds it
  await page.click('#dock .gcaprooms');
  await until(page, () => !!document.querySelector('#plan'), 4000, `[rooms ${tag}] the layer did not open again`);
  await page.click('#dock .gcaprooms');
  await until(page, () => !document.querySelector('#plan'), 3000, `[rooms ${tag}] a second tap on the rooms key did not fold the layer`);
  // Settings: the field says its words, the page ends above the capsule
  await go(page, 'settings');
  await page.waitForSelector('#pg-settings.listmode', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ words: document.querySelector('#dock .gcapwords')?.textContent, bar: !!document.querySelector('#dock .tabcap')?.getClientRects().length, capTop: Math.round(document.querySelector('#dock .gcap').getBoundingClientRect().top), bottom: Math.max(...[...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none').map((p) => Math.round(p.getBoundingClientRect().bottom))), title: document.querySelector('#top .navtitle')?.textContent }));
  check(st.words === 'Find a setting' && !st.bar && st.bottom <= st.capTop + 1 && /SETTINGS/i.test(st.title ?? ''), `[capsule ${tag}] Settings: ${JSON.stringify(st)}`);
  await page.screenshot({ path: `${out}/grown-settings-${tag}.png` });
  const sbad = await floor(page, vp.width, '#stage > .pg, #dock .gcap, #top');
  check(!sbad.length, `[capsule ${tag}] Settings' floor: ${sbad.slice(0, 6).join('; ')}`);
  // the field: "rad" finds RADIO under 300 ms (Recent and Starred first when nothing is typed)
  await page.click('#dock .gcapfield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  const j = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#palette .jgroup')].map((g) => g.dataset.group), placeholder: document.querySelector('#palette input')?.placeholder }));
  check(j.groups.join() === 'Favourites,Recent' && j.placeholder === 'Ask or jump anywhere', `[field ${tag}] the field opened with ${JSON.stringify(j)}`);
  const t0 = Date.now();
  await page.fill('#palette input', 'rad');
  await until(page, () => /^RADIO · 04$/i.test(window.__ghosty?.jump?.found ?? ''), 4000, '[field] "rad" did not find RADIO · 04');
  const found = Date.now() - t0;
  timings.push(`field ${tag}: "rad" found in ${found} ms`);
  check(found < BUDGET + 200, `[speed ${tag}] "rad" took ${found} ms to find RADIO (the budget is ${BUDGET} ms of the bar's own work, ${BUDGET + 200} with the driver's)`);
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, '[field] OPEN did not open Radio');
  // a sentence goes to the brain as a turn
  const turns = [];
  page.on('request', (r) => /\/api\/chat\b/.test(r.url()) && turns.push(r.url()));
  await page.click('#dock .gcapfield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', 'why is the sky blue at noon but red at sunset');
  await page.waitForTimeout(500);
  const ask = await page.evaluate(() => ({ only: document.querySelector('#palette .jask.only')?.textContent ?? '', found: window.__ghosty.jump.found }));
  check(/^why is the sky blue at noon but red at sunsetOr ask me/.test(ask.only) && ask.found === '', `[field ${tag}] a sentence finds no screen and offers itself to me: ${JSON.stringify(ask)}`);
  await page.press('#palette input', 'Enter');
  await until(page, () => document.body.dataset.tab === 'core', 8000, `[field ${tag}] a sentence did not take him to the conversation`);
  await page.waitForTimeout(1500);
  check(turns.length >= 1, `[field ${tag}] a sentence in the field never went to the brain as a turn`);
  // the small Mind: a press is the mic's own press (it talks); a hold fans the quick switcher with this room's tools
  await go(page, 'area-learn');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__micClicks = 0; document.querySelector('#cbar #mic')?.addEventListener('click', () => (window.__micClicks += 1)); });
  await page.click('#dock .gcapmind');
  await page.waitForTimeout(400);
  check((await page.evaluate(() => window.__micClicks)) >= 1 && (await page.evaluate(() => !window.__ghosty.capsule.fan)), `[mind ${tag}] a press on the small Mind did not talk (the mic's own press) or opened the fan`);
  await page.evaluate(() => document.querySelector('#cbar #mic.on')?.click());
  await holdMind(page);
  await until(page, () => window.__ghosty.capsule.fan && document.querySelectorAll('#switcher:not([hidden]) .switem').length >= 5, 3000, `[mind ${tag}] holding the small Mind did not fan the quick switcher`);
  await until(page, () => [...document.querySelectorAll('#switcher:not([hidden]) .switem')].every((b) => getComputedStyle(b).opacity === '1' && getComputedStyle(b).transform === 'none'), 6000, `[mind ${tag}] the fan never finished opening`);
  const fan = await page.evaluate(() => ({ room: window.__ghosty.capsule.room, ids: [...document.querySelectorAll('#switcher:not([hidden]) .switem')].map((b) => b.dataset.id), boxes: [...document.querySelectorAll('#switcher:not([hidden]) .switem .swring')].map((b) => (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(b.getBoundingClientRect())) }));
  check(fan.room === 'learn' && fan.ids.length >= 5 && fan.ids.includes('library') && fan.ids.includes('gym'), `[mind ${tag}] the fan holds ${fan.ids} for ${fan.room}`);
  check(fan.boxes.every((b) => b[2] >= 44 && b[3] >= 44 && b[0] >= 0 && b[0] + b[2] <= vp.width), `[mind ${tag}] a tool on the fan is under 44 pt or off screen: ${JSON.stringify(fan.boxes)}`);
  await page.screenshot({ path: `${out}/grown-fan-${tag}.png` });
  const gym = fan.boxes[fan.ids.indexOf('gym')];
  await page.mouse.move(gym[0] + gym[2] / 2, gym[1] + gym[3] / 2, { steps: 6 });
  await until(page, () => window.__ghosty.capsule.on === 'gym', 2000, `[mind ${tag}] sliding onto GYM did not light it`);
  await page.mouse.up();
  await until(page, () => document.body.dataset.tab === 'gym', 6000, `[mind ${tag}] letting go on GYM did not open it`);
  check(await page.evaluate(() => !document.querySelector('#switcher:not([hidden])') && !window.__ghosty.capsule.fan), `[mind ${tag}] the fan is still open after the let-go`);
  await ctx.close();
}

// ---- d. a hub is three layers
{
  const { ctx, page } = await open({ pins: ['gym', 'arcade'], recents: ['library', 'school'] });
  await go(page, 'area-learn');
  await until(page, () => document.body.dataset.tab === 'area-learn' && !!document.querySelector('#pg-area-learn .glylayer .hubtile'), 15000, '[layers] LEARN has no layers');
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => e && (({ y, height, x, width }) => ({ top: Math.round(y), bottom: Math.round(y + height), left: Math.round(x), right: Math.round(x + width), h: Math.round(height) }))(e.getBoundingClientRect());
    const ids = (s) => [...document.querySelectorAll(`#pg-area-learn .glylayer[data-layer="${s}"] .hubtile`)].map((b) => b.dataset.id);
    const front = q('#pg-area-learn .glyfront .hubtile');
    return {
      recent: ids('recent'), fav: ids('favourites'), rest: ids('rest'), chips: [...document.querySelectorAll('#pg-area-learn .glyfront .glychip')].map((b) => ({ t: b.textContent, to: b.dataset.to, h: Math.round(b.getBoundingClientRect().height) })),
      heads: [...document.querySelectorAll('#pg-area-learn .glyhead2 h3')].map((e) => e.textContent), fold: q('#pg-area-learn .glyfold')?.getAttribute('aria-expanded'), foldText: q('#pg-area-learn .glyfold')?.textContent, rows: document.querySelectorAll('#pg-area-learn .glyrows').length,
      boxes: { recent: box(q('#pg-area-learn .glyrecent')), fav: box(q('#pg-area-learn .glyfav')), rest: box(q('#pg-area-learn .glyrest')), cap: box(q('#dock .gcap')) },
      raised: front && getComputedStyle(front).transform, lit: front && getComputedStyle(front).boxShadow, band: !!q('#pg-area-learn .roomband') && !!q('#pg-area-learn .roomband').getClientRects().length, grid: !!q('#pg-area-learn .hubgrid')?.getClientRects().length, cmdbar: !!q('#pg-area-learn .cmdbar')?.getClientRects().length,
      back: q('#top .navback') && q('#top .navback').getBoundingClientRect().width > 0,
    };
  });
  check(d.recent.join() === 'library' && d.fav.join() === 'gym,arcade' && !d.rows && d.fold === 'false', `[layers] the layers are ${JSON.stringify({ recent: d.recent, fav: d.fav, rest: d.rest, fold: d.fold })}`);
  check(d.boxes.recent.bottom <= d.boxes.fav.top && d.boxes.fav.bottom <= d.boxes.rest.top && d.boxes.rest.bottom <= d.boxes.cap.top, `[layers] the layers are not in order: recent in front, favourites one level back, the rest last: ${JSON.stringify(d.boxes)}`);
  check(d.raised && d.raised !== 'none' && /rgba?\(/.test(d.lit ?? ''), `[layers] the recent card is not raised and lit: ${d.raised} ${d.lit}`);
  check(d.chips.map((c) => c.t).join() === 'Reader,Shelf,Ask the library' && d.chips.every((c) => c.h >= 44) && d.chips.map((c) => c.to).join() === 'reader,library?shelf,library?ask', `[layers] the recent card's panels: ${JSON.stringify(d.chips)}`);
  check(d.heads.join() === 'Recent,Favourites' && /^Everything else · \d+/.test(d.foldText) && !d.band && !d.grid && !d.cmdbar && d.back, `[layers] the layers' names: ${d.heads}; fold "${d.foldText}"; band ${d.band}, grid ${d.grid}, second ask ${d.cmdbar}, back ${d.back}`);
  await page.screenshot({ path: `${out}/grown-hub-440.png` });
  await page.click('#pg-area-learn .glychip[data-to="library?shelf"]');
  await until(page, () => document.body.dataset.tab === 'library', 6000, '[layers] a chip did not open its panel');
  await go(page, 'area-learn');
  await until(page, () => !!document.querySelector('#pg-area-learn .glyfold'), 6000, '[layers] the hub did not come back');
  // the folded rows open in place: single lines, each its name, its state and its two readings
  await page.click('#pg-area-learn .glyfold');
  await until(page, () => document.querySelectorAll('#pg-area-learn .glyrows .hubtile').length >= 3, 3000, '[layers] the fold did not open in place');
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ open: document.querySelector('#pg-area-learn .glyfold').getAttribute('aria-expanded'), rows: [...document.querySelectorAll('#pg-area-learn .glyrows .hubtile')].map((b) => ({ id: b.dataset.id, name: b.querySelector('.nm')?.textContent, st: b.querySelector('.st')?.textContent, reads: b.querySelectorAll('.rd').length, h: Math.round(b.getBoundingClientRect().height) })), same: document.querySelector('#pg-area-learn .glyrecent').getBoundingClientRect().top }));
  check(r.open === 'true' && r.rows.length >= 3 && r.rows.every((x) => x.name && x.st && x.reads >= 1 && x.reads <= 2 && x.h >= 44 && x.h <= 96), `[layers] the rows: ${JSON.stringify(r.rows)}`);
  await page.screenshot({ path: `${out}/grown-hub-open-440.png` });
  await page.click(`#pg-area-learn .glyrows .hubtile[data-id="${r.rows[0].id}"]`);
  await until(page, (id) => document.body.dataset.tab === id || document.body.dataset.tab.startsWith(id), 6000, `[layers] a row did not open its screen (${r.rows[0].id})`, r.rows[0].id);
  // the empty hub: no recent, no favourites: both layers say so
  await go(page, 'area-see');
  await page.waitForTimeout(900);
  const e = await page.evaluate(() => ({ none: [...document.querySelectorAll('#pg-area-see .glylayer .glynone')].map((p) => p.textContent) }));
  check(e.none.length >= 1 && e.none.every((t) => /^(Hold any thing to star it: it stands here\.|Nothing opened here yet: the last thing you open stands here, in front\.)$/.test(t)), `[layers] a hub with nothing recent or starred says nothing: ${JSON.stringify(e)}`);
  await ctx.close();
}

// ---- e. the Stage: a glass panel with the dashed bezel lit from the orb docked in its top edge
{
  const { ctx, page } = await open({ show: true });
  await page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => problems.push('window.__ghosty.show never appeared'));
  await go(page, 'learn');
  await page.waitForTimeout(500);
  const present = (f) => page.evaluate((f) => window.__ghosty.show.present({ tools: [], clients: [], cards: [], ...f }), f);
  const panel = async () => {
    await page.waitForFunction(() => { const s = document.querySelector('#thestage'); return !!s && s.getAnimations().every((a) => a.playState !== 'running'); }, null, { timeout: 8000 }).catch(() => undefined);
    return panelNow();
  };
  const panelNow = () => page.evaluate(() => {
    const s = document.querySelector('#thestage');
    const cs = getComputedStyle(s);
    const before = getComputedStyle(s, '::before');
    const j = s.querySelector('.stgjewel')?.getBoundingClientRect();
    const r = s.getBoundingClientRect();
    const cap = document.querySelector('#dock .gcap').getBoundingClientRect();
    return { kind: s.dataset.kind, jewel: j && { cx: Math.round(j.x + j.width / 2 - (r.x + r.width / 2)), cy: Math.round(j.y + j.height / 2 - r.y), w: Math.round(j.width) }, canvas: !!s.querySelector('.stgjewel canvas'), border: before.borderTopStyle, borderW: before.borderTopWidth, mask: before.maskImage || before.webkitMaskImage, radius: cs.borderTopLeftRadius, blur: cs.backdropFilter, anim: cs.animationName, field: document.querySelector('#dock .gcapwords')?.textContent, bottom: Math.round(r.bottom), capTop: Math.round(cap.top), keys: [...s.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)), top: Math.round(r.top), overflow: cs.overflow };
  });
  await present({ ask: 'where is Lisbon?', reply: 'Lisbon is the capital of Portugal.', brain: { kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, zoom: 11 } } });
  await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'map', 15000, '[stage] a map did not come to the Stage');
  await page.waitForTimeout(1200);
  const m = await panel();
  check(m.kind === 'map' && m.canvas && m.jewel && Math.abs(m.jewel.cx) <= 2 && Math.abs(m.jewel.cy) <= 8 && m.jewel.w >= 44, `[stage] the orb is not docked in the panel's top edge: ${JSON.stringify(m.jewel)}`);
  check(m.border === 'dashed' && parseFloat(m.borderW) >= 2 && m.mask && m.mask !== 'none' && /gradient/.test(m.mask), `[stage] the bezel is not a dashed edge lit from the orb (a mask): ${m.border} ${m.borderW} ${m.mask}`);
  check(m.radius !== '0px' && m.blur !== 'none' && m.bottom <= m.capTop + 12 && m.keys.every((h) => h >= 44), `[stage] the panel is not glass above the capsule, or a key is under 44 pt: ${JSON.stringify({ r: m.radius, b: m.blur, bottom: m.bottom, cap: m.capTop, keys: m.keys })}`);
  check(m.field === 'Ask about it, or change it', `[stage] with the Stage up the field says "${m.field}"`);
  await page.screenshot({ path: `${out}/grown-stage-map.png` });
  // giving it back: the panel folding to the orb, then gone
  await page.click('#thestage button[aria-label="Close"]');
  const leaving = await page.evaluate(() => ({ out: document.querySelectorAll('#thestage[data-leaving]').length, anim: document.querySelector('#thestage[data-leaving]') ? getComputedStyle(document.querySelector('#thestage[data-leaving]')).animationName : '' }));
  check(leaving.out === 1 && /gnfold/.test(leaving.anim), `[stage] giving the Stage back is not the panel folding: ${JSON.stringify(leaving)}`);
  await until(page, () => document.querySelectorAll('#thestage').length === 0, 4000, '[stage] the folding Stage never left');
  await until(page, () => document.querySelector('#dock .gcapwords').textContent === 'Ask or jump anywhere', 3000, '[stage] the field did not go back to its words');
  // a letter: the same panel, the page inside it
  await present({ ask: 'write me a letter to my landlord about the heating', reply: 'Dear Mr Hall,\n\nThe heating in the flat has not worked since Monday.\n\nPlease could someone come and look at it this week.\n\nYours sincerely,\nBoss' });
  await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'document', 15000, '[stage] a letter did not come to the Stage');
  await page.waitForTimeout(1200);
  const dcu = await panel();
  check(dcu.kind === 'document' && dcu.canvas && dcu.border === 'dashed' && dcu.jewel && Math.abs(dcu.jewel.cy) <= 8, `[stage] the document is not in the same panel with the orb docked: ${JSON.stringify(dcu)}`);
  await page.screenshot({ path: `${out}/grown-stage-page.png` });
  await page.keyboard.press('Escape');
  await ctx.close();
  // Reduce Motion: the Stage is there at once, nothing folds
  const r = await open({ show: true, reduced: true });
  await r.page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => undefined);
  await go(r.page, 'learn');
  await r.page.evaluate(() => window.__ghosty.show.present({ tools: [], clients: [], cards: [], ask: 'where is Lisbon?', reply: 'Lisbon is the capital of Portugal.', brain: { kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, zoom: 11 } } }));
  await until(r.page, () => document.querySelector('#thestage')?.dataset.kind === 'map', 15000, '[stage] (reduced) a map did not come to the Stage');
  const rd = await r.page.evaluate(() => getComputedStyle(document.querySelector('#thestage')).animationName);
  check(rd === 'none', `[stage] under Reduce Motion the Stage still animates (${rd})`);
  await r.ctx.close();
}

// ---- f. the seven dense screens each have fewer elements in their top half than in GLASS, and what is dropped is one tap away
{
  const tabs = ['core', 'gym', 'school', 'library', 'eye', 'settings', 'system'];
  const counts = { grown: {}, glass: {} };
  for (const [name, look] of [['glass', GLASS], ['grown', GROWN]]) {
    const { ctx, page } = await open({ look, book: true, recents: ['library', 'eye'] });
    for (const t of tabs) {
      await go(page, t === 'core' ? 'core' : t);
      await page.waitForTimeout(t === 'core' ? 2200 : t === 'eye' ? 2500 : 3000);
      if (t === 'gym') await page.waitForSelector('#pg-gym .gymcards .gymcard', { state: 'attached', timeout: 15000 }).catch(() => problems.push('[dense] the Gym games never drew'));
      if (t === 'school') await page.waitForSelector('#pg-school .schrung', { timeout: 8000 }).catch(() => problems.push('[dense] the School ladder never drew'));
      if (t === 'system') await page.waitForSelector('#pg-system .megauge', { state: 'attached', timeout: 8000 }).catch(() => problems.push('[dense] the System dials never drew'));
      counts[name][t] = await topHalf(page, t);
      if (name === 'grown' && t !== 'core') {
        await page.waitForFunction((t) => document.getElementById(`pg-${t}`).getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || a.effect?.getTiming?.().iterations === Infinity), t, { timeout: 8000 }).catch(() => undefined);
        const key = await page.evaluate((t) => ({ keys: Object.keys(window.__ghosty.drops.shown).filter((k) => k.startsWith(`${t}.`)), seen: [...document.querySelectorAll(`#pg-${t} [data-gdropkey]`)].filter((e) => e.getClientRects().length).length, hidden: [...document.querySelectorAll(`#pg-${t} [data-gdrop]`)].filter((e) => getComputedStyle(e).display === 'none').length, wide: [...document.querySelectorAll(`#pg-${t} .gdropkey`)].map((b) => b.getBoundingClientRect().height) }), t);
        check(key.keys.length === 1 && key.seen === 1 && key.hidden >= 1 && key.wide.every((h) => h >= 43.5), `[dense ${t}] the fold: ${JSON.stringify(key)}`);
        // one tap: the dropped thing is drawn where it was
        await page.click(`#pg-${t} .gdropkey`);
        await page.waitForTimeout(400);
        const after = await page.evaluate((t) => ({ open: document.querySelector(`#pg-${t} .gdropkey`)?.getAttribute('aria-expanded'), shown: [...document.querySelectorAll(`#pg-${t} [data-gdrop]`)].filter((e) => getComputedStyle(e).display !== 'none').length, all: document.querySelectorAll(`#pg-${t} [data-gdrop]`).length }), t);
        check(after.open === 'true' && after.shown === after.all && after.all >= 1, `[dense ${t}] one tap on the key did not open what was dropped: ${JSON.stringify(after)}`);
        if (t !== 'eye') await page.screenshot({ path: `${out}/grown-dense-${t}-open.png`, timeout: 90000 }).catch(() => undefined);
        await page.click(`#pg-${t} .gdropkey`);
      }
      if (name === 'grown' && t !== 'eye') await page.screenshot({ path: `${out}/grown-dense-${t}.png`, timeout: 90000 }).catch(() => undefined);
    }
    await ctx.close();
  }
  timings.push(`dense (top-half elements, Glass → Grown Up): ${tabs.map((t) => `${t} ${counts.glass[t]}→${counts.grown[t]}`).join(', ')}`);
  for (const t of tabs) check(counts.grown[t] < counts.glass[t], `[dense ${t}] GROWN UP draws ${counts.grown[t]} elements in the top half, Glass ${counts.glass[t]}: it is not less`);
}

// ---- g. the speed habit and Reduce Motion: Home under 300 ms (median of five); nothing runs when motion is reduced
{
  const { ctx, page } = await open({ book: true });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[speed] Home never became GROWN UP\'s');
  const times = [];
  for (let i = 0; i < 5; i++) {
    await page.click('#dock .gcaprooms');
    await page.waitForSelector('#plan .glyroomhead[data-room="see"]', { timeout: 4000 });
    await page.click('#plan .glyroomhead[data-room="see"]');
    await until(page, () => document.body.dataset.tab === 'area-see', 8000, '[speed] SEE did not open');
    await page.waitForTimeout(500);
    const ms = await timed(page, () => page.click('#top .navback'), 'home');
    times.push(ms ?? 9999);
    await page.waitForTimeout(400);
  }
  timings.push(`home: GROWN UP opens ${times.join(', ')} ms from a hub's way back (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed] Home in GROWN UP opened in ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  const hubs = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await until(page, HOME_READY, 10000, '[speed] Home did not come back');
    await page.waitForTimeout(300);
    await page.click('#dock .gcaprooms');
    await page.waitForSelector('#plan .glyroomhead[data-room="see"]', { timeout: 4000 });
    const ms = await timed(page, () => page.click('#plan .glyroomhead[data-room="see"]'), 'hub');
    hubs.push(ms ?? 9999);
  }
  timings.push(`hub: a room's layers ${hubs.join(', ')} ms from its name in the rooms layer (median ${median(hubs)})`);
  check(median(hubs) < BUDGET, `[speed] a room's layers took ${median(hubs)} ms (median of five: ${hubs.join(', ')}; the budget is ${BUDGET} ms)`);
  await ctx.close();
  const r = await open({ reduced: true, book: true });
  await go(r.page, 'core');
  await until(r.page, HOME_READY, 15000, '[motion] (reduced) Home never became GROWN UP\'s');
  await r.page.waitForTimeout(800);
  const still = await r.page.evaluate(() => ({ anims: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.gnframe, #dock .gcap')).length, arc: getComputedStyle(document.querySelector('.gnarc')).transitionDuration, caret: getComputedStyle(document.querySelector('.gcaprooms .ic')).transitionDuration }));
  check(still.anims === 0 && parseFloat(still.arc) <= 0.001, `[motion] under Reduce Motion something runs on Home: ${JSON.stringify(still)}`);
  await go(r.page, 'area-learn');
  await r.page.waitForTimeout(700);
  await holdMind(r.page);
  await until(r.page, () => window.__ghosty.capsule.fan, 3000, '[motion] (reduced) the fan did not open');
  const fanT = await r.page.evaluate(() => getComputedStyle(document.querySelector('#switcher:not([hidden]) .switem')).transitionDuration);
  check(fanT.split(',').every((d) => parseFloat(d) <= 0.001), `[motion] under Reduce Motion the fan eases (${fanT})`);
  await r.page.mouse.up();
  await r.ctx.close();
}

// ---- h. the biggest text: BODY 21 on a 390 × 844 phone, Home and a hub
{
  const { ctx, page } = await open({ viewport: WIDE, book: true, recents: ['library', 'eye', 'brief'], body: 21 });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[biggest] Home never became GROWN UP\'s');
  await page.waitForTimeout(900);
  const bad = await floor(page, 390, '.gnframe, #dock .gcap');
  check(!bad.length, `[biggest] Home at BODY 21: ${bad.slice(0, 6).join('; ')}`);
  const fit = await page.evaluate(() => ({ ring: Math.round(document.querySelector('.gnring').getBoundingClientRect().width), chips: new Set([...document.querySelectorAll('.gnchips .gnchip, .gnchips .gnmore')].map((b) => Math.round(b.getBoundingClientRect().top))).size }));
  check(fit.ring >= 160, `[biggest] the ring is squeezed to ${fit.ring} px at BODY 21`);
  await page.screenshot({ path: `${out}/grown-home-390-body21.png` });
  await go(page, 'area-learn');
  await page.waitForTimeout(1200);
  const bad2 = await floor(page, 390, '#stage > .pg, #dock .gcap');
  check(!bad2.length, `[biggest] a hub at BODY 21: ${bad2.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/grown-hub-390-body21.png` });
  await ctx.close();
}

// ---- i. nothing of GROWN UP in the other worlds, and nothing of theirs in it
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
        return { world: document.documentElement.dataset.world, grownBody: document.body.classList.contains('grown') || document.body.classList.contains('grownhome'), frame: seen(q('.gnframe')), cap: seen(q('#dock .gcap')), layers: [...document.querySelectorAll('.glylayer')].filter(seen).length, drops: [...document.querySelectorAll('[data-gdropkey]')].filter(seen).length, closed: [...document.querySelectorAll('[data-gstate="closed"]')].filter((e) => getComputedStyle(e).display === 'none').length, housed: document.body.classList.contains('housed'), keys: [...document.querySelectorAll('#dock .tabcap button')].filter(seen).map((b) => b.dataset.area).join() };
      });
    }
    await ctx.close();
    return out;
  };
  for (const [look, name, housed, keys] of [[SCAN, 'scan', true, 'ask,see,make,learn,plan,life,me'], [INK, 'ink', true, 'ask,see,make,learn,plan,life,me'], [MAP, 'map', true, 'ask,see,make,learn,plan,life,me'], [GLASS, 'glass', false, 'ask,see,make,learn,plan,life'], [ORBIT, 'orbit', true, '']]) {
    const f = await facts(look, PHONE);
    for (const id of ['home', 'learn', 'settings']) {
      const x = f[id];
      check(!x.grownBody && !x.frame && !x.cap && !x.layers && !x.drops && !x.closed, `[world] ${name} ${id} wears GROWN UP: ${JSON.stringify(x)}`);
      check(x.housed === housed, `[world] ${name} ${id}: body.housed is ${x.housed}`);
      if (name !== 'orbit' && (id !== 'home' || name === 'glass')) check(x.keys === keys, `[world] ${name} ${id}: the bar's keys are "${x.keys}" (want ${keys})`);
    }
  }
  // Glass the same after a visit to GROWN UP (a world left leaves nothing behind)
  const shot = async (page, hash) => { await go(page, hash); await page.waitForTimeout(1500); return page.evaluate(() => { const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; return { tab: [...document.querySelectorAll('#dock .tabcap button')].filter(seen).length, cap: [...document.querySelectorAll('#dock .gcap')].filter(seen).length, dockh: document.body.style.getPropertyValue('--dockh'), cmd: seen(document.querySelector('#top .cmd')) || getComputedStyle(document.querySelector('#top .cmd')).display, bottom: Math.round(document.getElementById('pg-area-learn').getBoundingClientRect().bottom) }; }); };
  const g = await open({ look: GLASS, once: false });
  const before = await shot(g.page, 'area-learn');
  await g.page.evaluate((look) => localStorage.setItem('ghosty.settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('ghosty.settings')), look })), GROWN);
  await g.page.reload({ waitUntil: 'domcontentloaded' });
  await g.page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await g.page.waitForTimeout(1000);
  await shot(g.page, 'core');
  await shot(g.page, 'area-learn');
  await g.page.evaluate((look) => localStorage.setItem('ghosty.settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('ghosty.settings')), look })), GLASS);
  await g.page.reload({ waitUntil: 'domcontentloaded' });
  await g.page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await g.page.waitForTimeout(1000);
  const after = await shot(g.page, 'area-learn');
  check(JSON.stringify(before) === JSON.stringify(after) && before.tab === 6 && !before.cap, `[world] Glass after a visit to GROWN UP: ${JSON.stringify(before)} then ${JSON.stringify(after)}`);
  await g.ctx.close();
  // and nothing of theirs in GROWN UP: no Scan marks, no ink foot, no map plane, no orbit line, no floor
  const { ctx, page } = await open({ book: true });
  for (const hash of ['core', 'area-learn', 'settings']) {
    await go(page, hash);
    await page.waitForTimeout(1200);
    const o = await page.evaluate(() => {
      const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
      return { scan: [...document.querySelectorAll('.scanframe, .scanmarks, .scanleads, .scanask, .scanco')].filter(seen).length, ink: [...document.querySelectorAll('.inkframe, .inkask')].filter(seen).length, map: [...document.querySelectorAll('.maphudframe, .mapgrid')].filter(seen).length, orbit: [...document.querySelectorAll('.orbframe, #dock .orbline, .orbst')].filter(seen).length, housed: document.body.classList.contains('housed'), floor: getComputedStyle(document.documentElement).getPropertyValue('--g-floor-a').trim(), glow: getComputedStyle(document.documentElement).getPropertyValue('--g-glow').trim(), radius: getComputedStyle(document.documentElement).getPropertyValue('--g-radius-cell').trim(), blur: getComputedStyle(document.documentElement).getPropertyValue('--g-blur').trim(), tabcap: [...document.querySelectorAll('#dock .tabcap')].filter(seen).length };
    });
    check(!o.scan && !o.ink && !o.map && !o.orbit && !o.housed && !o.tabcap && o.floor === '0' && o.glow === '1' && o.radius === '20px' && o.blur === '24px', `[world] GROWN UP's ${hash} carries another world's drawing: ${JSON.stringify(o)}`);
  }
  await ctx.close();
}

} catch (e) {
  problems.push(`the run stopped: ${String(e?.message ?? e).split('\n').slice(0, 3).join(' | ')}`);
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'GROWN UP run clean at 440 × 956 and 390 × 844: the gallery built and kept, Home with its one ring, the capsule on every screen, THE ROOMS layer, the field and the small Mind, the three layers of a hub, the Stage as the glass panel, the seven dense screens with less, under budget, the other worlds untouched.');
process.exit(problems.length ? 1 : 0);
