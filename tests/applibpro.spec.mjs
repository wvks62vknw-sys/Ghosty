// THE PRO ROUND, lane SHELL (docs/build-plan/APPLIB-PRO.md; apps/web/src/features/applib/pro.ts): every Library app takes the
// whole screen like a proper app, with its own identity and its family's skin.
// - An opened app covers the viewport: no room bar, ask line or page title shows anywhere on screen, and it grows from its icon.
// - Back (the chevron), the edge swipe (past 35% closes it, short of it springs back) and the phone's back each close it to the Library.
// - The large title collapses into the small centred title as the app scrolls.
// - The coach marks show once (and again from ⋯ → How it works); the ⋯ menu has How it works, Settings, Export, Recently
//   deleted, Make my own and Pin to Home.
// - Accents differ across the families, and text keeps 4.5:1 in the app (on a dark ground and on Paper).
// - Every key is 44 pt, nothing goes sideways and no word is cut, in the frame and on the Library's front page.
// - At 440 × 956 and 390 × 844, in all seven looks for a sample; a screenshot of one app per skin goes to the shots folder.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const notes = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const WORLDS = ['glass', 'eye', 'grown', 'ink', 'map', 'orbit', 'scan'];
const SMALL = { width: 390, height: 844 };
const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

async function open(viewport = PHONE, world = 'glass', ground = 'graphite', fresh = true) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${world} ${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(([world, ground, fresh]) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (fresh && !sessionStorage.getItem('pro.seeded')) {
      sessionStorage.setItem('pro.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground, world, night: 'graphite', switches: {} } }));
    }
  }, [world, ground, fresh]);
  await page.goto(`${base}/#apps`);
  await page.waitForFunction(() => !!window.__ghosty?.applib?.pro && document.querySelector('#pg-apps .al-pro-feature'), null, { timeout: 30000 });
  return { ctx, page };
}
const A = (page) => page.evaluate(() => ({ lib: { ...window.__ghosty.applib.library }, pro: { ...window.__ghosty.applib.pro }, hash: location.hash }));
/** Open an app as he would: a tap on its row in a search, then OPEN on the row. Waits for the open to settle. */
async function openApp(page, id) {
  await page.evaluate((id) => window.__ghosty.applib.open(id), id);
  await page.waitForSelector(`.al-pro-frame .ak-app[data-app="${id}"]`, { timeout: 8000 });
  await wait(page, 520);
}
const endCoach = async (page) => {
  for (let i = 0; i < 4 && (await page.locator('.al-pro-coach').count()); i++) await page.click('.al-pro-coach .al-pro-coachcard .g-key');
};
const closed = (page) => page.waitForFunction(() => !document.querySelector('.al-pro-frame') && window.__ghosty.applib.library.view !== 'app', null, { timeout: 5000 }).then(() => true, () => false);

/** One frame's measure: covered, keys 44, nothing sideways, no word cut, the text's contrast. */
const MEASURE = (sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const W = innerWidth, H = innerHeight;
  // covered: every point on a grid over the screen is the frame (no room bar, ask line or page title through it)
  const leaks = [];
  if (sel === '.al-pro-frame') for (let x = 6; x < W; x += Math.floor((W - 12) / 6)) for (let y = 4; y < H; y += Math.floor((H - 8) / 10)) {
    const e = document.elementFromPoint(Math.min(x, W - 2), Math.min(y, H - 2));
    if (!e || !e.closest('.al-pro-frame')) leaks.push(`${x},${y}:${(e?.className?.toString?.() || e?.tagName || 'nothing').slice(0, 24)}`);
  }
  const keys = [...root.querySelectorAll('button, select, input:not([type=file]):not([type=range])')].filter((b) => b.offsetParent && !b.closest('[hidden], .ak-sheet'));
  const small = keys.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || (b.matches('button') && r.width < 43.5); }).map((b) => (b.getAttribute('aria-label') || b.textContent || b.className).slice(0, 30));
  const wide = [...root.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 0.5 || r.left < -0.5) && !e.closest('.al-pro-coach'); }).map((e) => e.className.toString().slice(0, 30)).slice(0, 4);
  // no word cut: text that runs past its own box where the box hides it, or an ellipsis
  const cut = [...root.querySelectorAll('*')].filter((e) => {
    if (!e.offsetParent || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    const s = getComputedStyle(e);
    if (s.opacity === '0' || e.closest('[hidden]')) return false;
    return (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) || (/(hidden|clip)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && s.whiteSpace === 'nowrap');
  }).map((e) => e.textContent.trim().slice(0, 24)).slice(0, 4);
  // contrast: a colour resolved by the canvas (oklch included), laid over the backgrounds under it
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (e) => {
    const chain = [];
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    // (the Library stands on the room's floor, the 3-D scene cleared to --g-room-canvas; the frame paints its own canvas)
    let c = rgba(sel === '.al-pro-frame' ? getComputedStyle(document.body).backgroundColor : getComputedStyle(document.documentElement).getPropertyValue('--g-room-canvas').trim());
    if (c[3] < 1) c = over(c, [0, 0, 0, 1]);
    for (const n of chain.reverse()) { const b = rgba(getComputedStyle(n).backgroundColor); if (b[3] > 0) c = over(b, c); }
    return c;
  };
  const low = [];
  const texts = [...root.querySelectorAll('.al-pro-largename, .al-pro-largeline, .ak-rowtitle, .ak-rowsub, .g-key span, .al-pro-get, .al-pro-featureget, .al-kicker, .al-pro-kicker, .al-pro-coachwords, .al-pro-coachn, .al-approwwords b, .al-tile b, .al-pro-menuitem span')]
    .filter((e) => e.offsetParent && getComputedStyle(e).opacity !== '0' && e.textContent.trim() && !e.closest('[hidden]'));
  for (const e of texts.slice(0, 60)) {
    const bg = bgOf(e);
    const fg = over(rgba(getComputedStyle(e).color), bg);
    const a = lum(fg), b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) low.push(`${e.className || e.tagName} "${e.textContent.trim().slice(0, 16)}" ${ratio.toFixed(2)}`);
  }
  return { leaks: leaks.slice(0, 4), small: small.slice(0, 5), wide, cut, low: low.slice(0, 4), texts: texts.length, sideways: document.documentElement.scrollWidth > W };
};
const measure = (page, sel) => page.evaluate(`(${MEASURE})(${JSON.stringify(sel)})`);
const ok = (m) => !m.missing && !m.leaks.length && !m.small.length && !m.wide.length && !m.cut.length && !m.low.length && !m.sideways;

// the apps to try: an essential one per skin (the catalogue's own), and a log app with enough rows to scroll
const pick = async (page) => page.evaluate(() => {
  const defs = window.__ghosty.applib.defs().filter((d) => !['screen', 'game', 'importer'].includes(d.archetype) && !d.id.startsWith('spec-'));
  const skins = {};
  for (const d of defs) if (!skins[d.skin] || (skins[d.skin].tier === 'more' && d.tier !== 'more') || (skins[d.skin].archetype !== 'log' && d.archetype === 'log' && d.tier !== 'more')) skins[d.skin] = d;
  return { skins, families: [...new Set(defs.map((d) => d.family))].map((f) => defs.find((d) => d.family === f && d.hue == null) ?? defs.find((d) => d.family === f)) };
});

// ── the frame at 440: grows from its icon, covers the screen, collapses, and every way back closes it ─────────────────────
let SK = {};
{
  const { ctx, page } = await open(PHONE, 'glass');
  const { skins, families } = await pick(page);
  SK = skins;
  check(Object.keys(skins).length >= 8, `[skins] only ${Object.keys(skins).length} skins have an app to try`);
  // the Library's front page: App Store class, and the same rules
  check(await page.locator('#pg-apps .al-shelf[data-shelf="featured"] .al-pro-feature .al-pro-tile[data-size="xl"]').count() === 1, '[library] the featured hero has no large icon');
  check(await page.locator('#pg-apps .al-pro-store .al-appline .al-pro-tile').count() >= 8, '[library] the sections have no large-icon rows');
  check(await page.locator('#pg-apps .al-pro-store .al-pro-get').count() >= 8, '[library] the rows have no Open pill');
  const tierMore = await page.evaluate(() => window.__ghosty.applib.defs().filter((d) => d.tier === 'more').length);
  check(!tierMore || await page.locator('#pg-apps .al-shelf[data-shelf="more"]').count() === 1, `[library] ${tierMore} apps are tier 'more' but there is no MORE APPS`);
  let m = await measure(page, '#pg-apps');
  check(ok(m), `[library 440] ${JSON.stringify(m)}`);
  // Today's picks: four across, evenly spaced over the width
  const picks = await page.evaluate(() => [...document.querySelectorAll('#pg-apps [data-shelf="featured"] .al-pro-tiles .al-pro-tile')].map((t) => { const r = t.getBoundingClientRect(); return r.left + r.width / 2; }));
  const gaps = picks.slice(1).map((x, i) => x - picks[i]);
  check(picks.length === 4 && Math.max(...gaps) - Math.min(...gaps) < 2 && picks[0] > 40 && Math.abs((picks[0] + picks[3]) / 2 - 220) < 4, `[library] Today's picks are not four evenly across: ${picks.map(Math.round).join(', ')}`);
  await page.screenshot({ path: `${out}/applibpro-library.png` });
  // accents differ across the families (each tile's gradient from its family's hue)
  const accents = await page.evaluate((ids) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const host = document.createElement('div'); document.body.append(host);
    const res = ids.map(({ id, family }) => {
      const el = document.createElement('div'); el.className = 'al-pro'; host.append(el);
      const d = window.__ghosty.applib.defs().find((x) => x.id === id);
      el.style.setProperty('--al-hue', String(d.hue ?? { body: 18, life: 50, learn: 82, maker: 128, money: 158, world: 196, tools: 226, office: 256, games: 288, create: 322, data: 352 }[family]));
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = getComputedStyle(el).getPropertyValue('--al-accent').trim(); cx.fillRect(0, 0, 1, 1);
      return { family, rgb: [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3) };
    });
    host.remove();
    return res;
  }, families.map((d) => ({ id: d.id, family: d.family })));
  // (and from the page itself: the featured hero's accent is its family's)
  const near = [];
  for (let i = 0; i < accents.length; i++) for (let j = i + 1; j < accents.length; j++) {
    const [a, b] = [accents[i].rgb, accents[j].rgb];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 24) near.push(`${accents[i].family}~${accents[j].family}`);
  }
  check(accents.length >= 8 && !near.length && accents.every((x) => x.rgb.some((v) => v > 0)), `[accents] families share an accent: ${near.join(', ') || JSON.stringify(accents)}`);

  // grows from its icon: a tap on a row's Open pill, the frame animating from there
  const first = skins.money ?? Object.values(skins)[0];
  await page.fill('#pg-apps .al-find', first.name);
  await page.click(`#pg-apps .al-results .al-appline:has(.al-approw[data-app="${first.id}"]) .al-pro-get`);
  await page.waitForSelector(`.al-pro-frame .ak-app[data-app="${first.id}"]`);
  const anim = await page.evaluate(() => document.querySelector('.al-pro-frame').getAnimations().length);
  check(anim >= 1, '[open] the app did not grow from its icon (no animation on the frame)');
  await wait(page, 520);
  let s = await A(page);
  check(s.hash === `#apps/${first.id}` && s.pro.open === first.id && s.lib.view === 'app', `[open] ${JSON.stringify(s)}`);
  check(await page.evaluate(() => document.documentElement.classList.contains('al-open')), '[open] the page is not marked open');
  // the header: the chevron points left (never mirrored), and back, search and ⋯ are 44 pt with a glyph at size in the accent
  const head = await page.evaluate(() => [...document.querySelectorAll('.al-pro-frame .ak-head .ak-hkey')].map((k) => { const r = k.getBoundingClientRect(), g = k.querySelector('.ic').getBoundingClientRect(), t = new DOMMatrix(getComputedStyle(k).transform === 'none' ? undefined : getComputedStyle(k).transform); return { l: k.getAttribute('aria-label'), w: r.width, h: r.height, g: g.width, flip: t.a < 0 || t.m11 < 0 || /rotateY|matrix3d/.test(getComputedStyle(k).transform) }; }));
  check(head.length >= 3 && head.every((x) => x.w >= 44 && x.h >= 44 && x.g >= 22 && !x.flip), `[header] the keys: ${JSON.stringify(head)}`);
  // the coach marks: once, then never again; ⋯ → How it works plays them again
  check(await page.locator('.al-pro-coach .al-pro-coachwords').count() === 1, '[coach] the coach marks did not show on the first run');
  check(await page.locator('.al-pro-frame .ak-tour:visible').count() === 0, '[coach] the tour banner still shows');
  const steps = [];
  for (let i = 0; i < 3 && (await page.locator('.al-pro-coach').count()); i++) { steps.push(await page.textContent('.al-pro-coachn')); await page.click('.al-pro-coach .al-pro-coachcard .g-key'); await wait(page, 60); }
  check(steps[0] === '1 of 3' && (await page.locator('.al-pro-coach').count()) === 0, `[coach] three steps and Got it did not end them: ${steps.join(' / ')}`);
  m = await measure(page, '.al-pro-frame');
  check(ok(m), `[frame 440 ${first.skin}] ${JSON.stringify(m)}`);
  // the large title collapses as the app scrolls
  const large0 = await page.evaluate(() => getComputedStyle(document.querySelector('.al-pro-large')).opacity);
  await page.evaluate(() => { const b = document.querySelector('.al-pro-frame .ak-body'); for (let i = 0; i < 24; i++) b.append(Object.assign(document.createElement('div'), { className: 'ak-row', textContent: 'filler', style: 'min-height:60px' })); b.scrollTop = 600; b.dispatchEvent(new Event('scroll')); });
  await wait(page, 120);
  const col = await page.evaluate(() => ({ c: window.__ghosty.applib.pro.collapsed, large: +getComputedStyle(document.querySelector('.al-pro-large')).opacity, small: +getComputedStyle(document.querySelector('.al-pro-smalltitle')).opacity, bar: document.querySelector('.al-pro-bar').hasAttribute('data-collapsed') }));
  check(large0 === '1' && col.c && col.bar && col.large < 0.2 && col.small > 0.8, `[collapse] the large title did not collapse: ${JSON.stringify(col)}`);
  await page.evaluate(() => { const b = document.querySelector('.al-pro-frame .ak-body'); b.scrollTop = 0; b.dispatchEvent(new Event('scroll')); });
  await wait(page, 80);
  check(!(await A(page)).pro.collapsed, '[collapse] scrolled back up, the large title did not come back');
  // the ⋯ menu
  await page.click('.al-pro-frame .ak-head button[aria-label="More"]');
  const items = await page.$$eval('.al-pro-menu .al-pro-menuitem', (e) => e.map((x) => x.textContent.trim()));
  for (const w of ['How it works', 'Settings', 'Export CSV', 'Recently deleted', 'Pin to Home']) check(items.some((x) => x.startsWith(w)), `[menu] no "${w}" in ⋯: ${items.join(', ')}`);
  const maker = await page.evaluate(() => !!document.querySelector('.al-pro-menu .al-pro-menuitem[aria-label="Make my own"]'));
  notes.push(maker ? 'Make my own in ⋯' : 'Make my own waits for App Maker');
  await page.click('.al-pro-menu .al-pro-menuitem[aria-label="Pin to Home"]');
  check(/pinned to Home/.test(await page.textContent('.al-pro-frame .ak-notice')), '[menu] Pin to Home said nothing');
  await page.click('.al-pro-frame .ak-head button[aria-label="More"]');
  await page.click('.al-pro-menu .al-pro-menuitem[aria-label="Recently deleted"]');
  check(await page.locator('.al-pro-binsheet').count() === 1, '[menu] Recently deleted did not open');
  await page.click('.al-pro-binsheet button:has-text("Done")');
  await page.click('.al-pro-frame .ak-head button[aria-label="More"]');
  await page.click('.al-pro-menu .al-pro-menuitem[aria-label="How it works"]');
  await wait(page, 80);
  check(await page.locator('.al-pro-coach').count() === 1, '[coach] ⋯ → How it works did not play the coach marks again');
  await endCoach(page);
  // back: the chevron closes it into its icon, on the Library
  await page.click('.al-pro-frame .ak-head .al-pro-back');
  check(await closed(page), '[back] the chevron did not close the app');
  s = await A(page);
  check(!s.hash.includes(first.id) && s.lib.view !== 'app' && await page.locator('#pg-apps.on .al-lib .al-libbody').isVisible(), `[back] not on the Library after the chevron: ${JSON.stringify(s)}`);
  check(!(await page.evaluate(() => document.documentElement.classList.contains('al-open'))), '[back] the page is still marked open');
  // once: opened again, no coach marks
  await openApp(page, first.id);
  check(await page.locator('.al-pro-coach').count() === 0, '[coach] the coach marks showed a second time');
  // the phone's back
  await page.goBack();
  check(await closed(page), '[phone back] the phone\'s back did not close the app');
  s = await A(page);
  check(/^#apps(\/|$)/.test(s.hash) && !s.hash.includes(first.id), `[phone back] left the Library: ${s.hash}`);
  // the edge swipe: short of 35% springs back, past it closes
  await openApp(page, first.id);
  const drag = async (to) => { await page.mouse.move(4, 500); await page.mouse.down(); for (let x = 12; x <= to; x += 24) await page.mouse.move(x, 504); await page.mouse.move(to, 504); await page.mouse.up(); };
  await drag(110);
  await wait(page, 360);
  check(await page.locator('.al-pro-frame').count() === 1 && (await A(page)).pro.swipe === 0, '[swipe] a short swipe did not spring back');
  await drag(300);
  check(await closed(page), '[swipe] the edge swipe past 35% did not close the app');
  s = await A(page);
  check(/^#apps(\/|$)/.test(s.hash) && !s.hash.includes(first.id), `[swipe] not on the Library after the swipe: ${s.hash}`);
  // a cold link straight to an app: back still lands on the Library
  await page.evaluate((id) => { location.hash = `#apps/${id}`; }, first.id);
  await page.waitForSelector('.al-pro-frame .ak-app');
  await wait(page, 450);
  await page.click('.al-pro-frame .ak-head .al-pro-back');
  check(await closed(page), '[back] from an app opened by its address, the chevron did not close it');

  // one app per skin, its screenshot, its frame measured
  for (const [skin, d] of Object.entries(skins)) {
    await openApp(page, d.id);
    await endCoach(page);
    const sk = await page.evaluate(() => document.querySelector('.al-pro-frame .ak-app').dataset.skin);
    check(sk === skin, `[skin] ${d.id} has data-skin ${sk}, not ${skin}`);
    m = await measure(page, '.al-pro-frame');
    check(ok(m), `[frame 440 ${skin} ${d.id}] ${JSON.stringify(m)}`);
    await page.screenshot({ path: `${out}/applibpro-${skin}.png` });
    await page.click('.al-pro-frame .ak-head .al-pro-back');
    await closed(page);
  }
  notes.push(`${Object.keys(skins).length} skins shot`);
  await ctx.close();
}

// ── every look at 440 and 390: a sample app in the frame, and the Library's front page ───────────────────────────────────
const list = Object.values(SK);
let n = 0;
for (const vp of [PHONE, SMALL]) {
  for (const world of WORLDS) {
    const { ctx, page } = await open(vp, world);
    const d = list[n++ % list.length];
    await openApp(page, d.id);
    await endCoach(page);
    const m = await measure(page, '.al-pro-frame');
    check(ok(m), `[${world} ${vp.width} ${d.skin} ${d.id}] ${JSON.stringify(m)}`);
    await page.goBack();
    check(await closed(page), `[${world} ${vp.width}] the phone's back did not close ${d.id}`);
    const ml = await measure(page, '#pg-apps');
    check(ok(ml), `[${world} ${vp.width} library] ${JSON.stringify(ml)}`);
    if (vp.width === 390) await page.screenshot({ path: `${out}/applibpro-${world}-390.png` });
    await ctx.close();
  }
}

// ── on Paper, the light ground: the accents darken so the text still keeps 4.5:1 ─────────────────────────────────────────
{
  const { ctx, page } = await open(PHONE, 'glass', 'paper');
  for (const d of list.slice(0, 3)) {
    await openApp(page, d.id);
    await endCoach(page);
    const m = await measure(page, '.al-pro-frame');
    check(ok(m), `[paper ${d.skin} ${d.id}] ${JSON.stringify(m)}`);
    await page.click('.al-pro-frame .ak-head .al-pro-back');
    await closed(page);
  }
  await page.screenshot({ path: `${out}/applibpro-library-paper.png` });
  await ctx.close();
}

await browser.close();
const secs = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`applibpro: ${problems.length} problem(s) in ${secs} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`applibpro: OK (full screen from the icon, the room bar covered; back, edge swipe and the phone's back to the Library; the large title collapses; coach marks once and from ⋯; accents per family; 4.5:1; 44 pt keys, nothing sideways or cut; seven looks at 440 and 390, and Paper; ${notes.join('; ')}) in ${secs} s`);
