// THE SEE LANE (FINAL ROUND, 13 Nov; docs/build-plan/FINAL-SEE.md): "sometimes the layers on Gods Eye can overlap the cameras".
// God's Eye's floating things (the tapped card, the CCTV grid, the layers sheet, the zoom rail, the LOOK menu) live in one measured band
// between the search's chips and the sheet's keys (features/eye/index.ts reach()), one corner one thing. Checked in all seven looks
// (scan, map, eye, orbit, grown and ink with the house; glass without it) on the owner's 440 × 956 and a 390 × 844 phone, with the
// cameras' feed stood in (no internet):
//   a. THE GRID: London's cameras near the view: the grid shows, inside the band, over nothing (not the chips, the rail, the keys);
//   b. THE CARD: a camera tapped: the card in the band, the grid gone, the camera's picture showing in it, ASK GHOSTY and ✕ on top and
//      pressable, over nothing (the readout steps aside when the card reaches past it);
//   c. THE LAYERS SHEET opened over a card: the card steps aside until the sheet folds, the sheet in the band, over nothing;
//   d. LOOK opened over a card: the card steps aside, nothing overlaps; a camera opened (the brain's show_cameras) closes LOOK (the newest wins);
//   e. every key on God's Eye 44 pt, nothing sideways.
// And the specialist pass's fixes, once (THE SCAN, 440):
//   f. the zoom rail's + and − are keys: one tap (or VoiceOver's activate) zooms a step (they did nothing unless held);
//   g. his own position never goes to the brain: the YOU card's ASK GHOSTY and God's Eye's own description carry no coordinates.
//   BASE=http://localhost:8788 node tests/seelane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORDS = { scan: 'the scan', map: 'the map', eye: 'the eye', orbit: 'orbit', grown: 'grown up', ink: 'one ink', glass: 'glass' };
const LOOKS = (process.env.SEE_LOOKS ?? 'scan,map,eye,orbit,grown,ink,glass').split(',');
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 300)}`);
  }
  return ok;
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');

// the stand-in feeds: eight public cameras in central London (TfL's JamCams shape), every picture a small grey frame
const IMG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAEklEQVR42mNkYPhfz0AEYBxVCAB1BgL9mY8kAQAAAABJRU5ErkJggg==', 'base64');
const tfl = (i) => ({ id: `JamCams_00001.0${1000 + i}`, commonName: `Strand / Camera ${i + 1}`, lat: 51.508 + i * 0.002, lon: -0.128 - i * 0.002, additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/0000${i}.jpg` }] });
const CAMS = Array.from({ length: 8 }, (_, i) => tfl(i));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  await ctx.route('**/api/proxy?**', (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).searchParams.get('url') ?? '');
    if (/\.(jpg|jpeg)$/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: IMG });
    if (/api\.tfl\.gov\.uk/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(CAMS) });
    return route.fulfill({ status: 404, body: '' });
  });
  await ctx.route(/\/api\/guardian$/, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ places: [], checked: {}, failed: {}, tz: 'Europe/London', person: null, walk: null }) }) : route.fallback()));
  await ctx.route('**/api/ships?**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ships":[]}' }));
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript((key) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, KEY);
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

/** Every floating thing on God's Eye that shows, and each pair that lies over another (the folded layers button sits in the chips' row by design). */
const overlaps = (page) =>
  page.evaluate(() => {
    const sel = { card: '.eyeinfo', grid: '.camgrid', road: '.roadahead', sheet: '.eyelay:not(.min)', rail: '.zoomrail', look: '.lookmenu', search: '.eyetop .search', places: '.myplaces', keys: '.eyebot .btns', readout: '.eyebot .readout' };
    const box = {};
    const shows = (e) => e && !e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0;
    for (const [k, s] of Object.entries(sel)) {
      const e = document.querySelector(`#pg-eye ${s}`);
      if (!shows(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) box[k] = r;
    }
    // the chips: each one that shows (the row itself scrolls and is wider than its chips)
    [...document.querySelectorAll('#pg-eye .eyechips .lchip:not(.ico)')].filter(shows).forEach((e, i) => (box[`chip${i}`] = e.getBoundingClientRect()));
    const dock = document.querySelector('#dock');
    if (shows(dock)) box.dock = dock.getBoundingClientRect();
    const bad = [];
    const ks = Object.keys(box);
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const a = box[ks[i]];
        const b = box[ks[j]];
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) bad.push(`${ks[i]} over ${ks[j]} (${Math.round(w)}×${Math.round(h)})`);
      }
    // nothing of the band runs off the screen
    for (const k of ['card', 'grid', 'sheet', 'rail']) if (box[k] && (box[k].bottom > innerHeight + 1 || box[k].top < -1)) bad.push(`${k} off the screen (${Math.round(box[k].top)}–${Math.round(box[k].bottom)})`);
    return { bad, shown: ks };
  });

/** The bar: every key that shows is 44 pt, nothing on God's Eye runs sideways (what scrolls inside its own row is its row's). */
const bar = (page) =>
  page.evaluate(() => {
    const bad = [];
    const shows = (e) => !e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    for (const b of document.querySelectorAll('#pg-eye button')) {
      if (!shows(b)) continue;
      const a = getComputedStyle(b, '::after');
      const reach = (p) => (a.position === 'absolute' && a.content !== 'none' ? Math.max(0, -(parseFloat(a[p]) || 0)) : 0);
      const w = (b.offsetWidth || b.getBoundingClientRect().width) + reach('left') + reach('right');
      const h = (b.offsetHeight || b.getBoundingClientRect().height) + reach('top') + reach('bottom');
      if (w < 43.5 || h < 43.5) bad.push(`key "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 20)}" ${Math.round(w)}×${Math.round(h)}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`the page scrolls sideways (${document.documentElement.scrollWidth})`);
    // (whether an element sits inside a row that clips or scrolls on its own, worked out once per element)
    const clipped = new Map();
    const inside = (p) => {
      if (!p || p.id === 'pg-eye') return false;
      if (!clipped.has(p)) clipped.set(p, /(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) || inside(p.parentElement));
      return clipped.get(p);
    };
    for (const e of document.querySelectorAll('#pg-eye *')) {
      if (e.closest('.labels, canvas, [hidden]') || inside(e.parentElement) || !shows(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) bad.push(`sideways <${e.tagName.toLowerCase()}.${[...e.classList].join('.')}> ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    return [...new Set(bad)].slice(0, 6);
  });

const openEye = async (page) => {
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForSelector('#pg-eye .eyebot .btns', { timeout: 30000 });
  await until(page, () => !!window.__ghosty?.globe?.cam, null, 15000);
  await page.evaluate(() => (window.__ghosty.globe.cam.autoSpin = false));
};
const tapCamera = (page) => page.evaluate(() => document.querySelector('#pg-eye .camgrid:not([hidden]) .camview')?.click());
const cardUp = (page) => until(page, () => { const i = document.querySelector('#pg-eye .eyeinfo'); return !!i && !i.hidden && getComputedStyle(i).display !== 'none' && /CCTV/i.test(i.textContent ?? '') && document.querySelector('#pg-eye .camgrid').hidden; }, null, 12000);
// the view put straight where the check needs it (software GL draws a fly-to at a frame or two a second: what is checked is the band, not the flight)
const place = (page, pose) => page.evaluate((p) => { const c = window.__ghosty.globe.cam; c.follow = null; c.fly = null; Object.assign(c, p); c.target = { ...p }; }, pose);
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150))));

for (const vp of [PHONE, PHONE2]) {
  const { ctx, page } = await phone(vp);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`[${vp.width}] the boot never ended`));
  for (const world of LOOKS) {
    const T = `[${vp.width} ${world}]`;
    log(`${T}`);
    // the look switched in the page by his own words for it (the chat's set_theme, as "switch to the map" runs it): God's Eye lays itself out again
    await page.evaluate((w) => window.__ghosty.run('set_theme', { theme: w }), WORDS[world]);
    await until(page, (w) => document.documentElement.dataset.world === w, world, 5000);
    check((await page.evaluate(() => document.documentElement.dataset.world)) === world, `${T} the look did not take: ${await page.evaluate(() => document.documentElement.dataset.world)}`);
    await openEye(page);
    log(`${T} open`);
    // a. the grid near London's cameras
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: true }));
    await place(page, { lat: 51.512, lon: -0.135, range: 3, tilt: 0, hd: 0 });
    const grid = check(await until(page, () => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, 30000), `${T} [a grid] the CCTV grid never showed near the London cameras`);
    if (grid) {
      await settled(page);
      const o = await overlaps(page);
      check(!o.bad.length, `${T} [a grid] ${o.bad.join(', ')}`);
      const b = await bar(page);
      check(!b.length, `${T} [e keys] ${b.join(', ')}`);
      if (vp === PHONE && world === 'scan') await page.screenshot({ path: `${out}/seelane-grid-${vp.width}-${world}.png` }).catch(() => undefined);
    }
    log(`${T} grid`);
    // b. a camera tapped: the card
    await tapCamera(page);
    if (check(await cardUp(page), `${T} [b card] a tapped camera opened no card (or the grid stayed over it)`)) {
      await until(page, () => !!document.querySelector('#pg-eye .eyeinfo .camview.big img')?.naturalWidth, null, 10000);
      log(`${T} card`);
      await settled(page);
      const o = await overlaps(page);
      check(!o.bad.length, `${T} [b card] ${o.bad.join(', ')}`);
      const c = await page.evaluate(() => {
        const info = document.querySelector('#pg-eye .eyeinfo');
        const ir = info.getBoundingClientRect();
        const pic = info.querySelector('.camview.big')?.getBoundingClientRect();
        const seenPic = pic ? Math.max(0, Math.min(pic.bottom, ir.bottom) - Math.max(pic.top, ir.top)) : 0;
        const keys = [...info.querySelectorAll('button')].filter((b) => /^(ask ghosty|✕)$/i.test(b.textContent.trim()));
        const pressable = keys.map((b) => {
          const r = b.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { t: b.textContent.trim(), ok: !!at && b.contains(at) && r.bottom <= innerHeight };
        });
        return { seenPic: Math.round(seenPic), pressable };
      });
      check(c.seenPic >= 60, `${T} [b card] the camera's picture shows ${c.seenPic} px in its card (want 60 at least)`);
      check(c.pressable.length === 2 && c.pressable.every((k) => k.ok), `${T} [b card] ASK GHOSTY / ✕ not both on top and pressable: ${JSON.stringify(c.pressable)}`);
      const b = await bar(page);
      check(!b.length, `${T} [e keys] with the card: ${b.join(', ')}`);
      if (world === 'scan') await page.screenshot({ path: `${out}/seelane-card-${vp.width}-${world}.png` }).catch(() => undefined);
      // c. the layers sheet over the card
      await page.evaluate(() => {
        const pill = document.querySelector('#pg-eye .eyelay.min > h3');
        const btn = document.querySelector('#pg-eye .eyechips .lchip.ico');
        (btn && getComputedStyle(btn).visibility !== 'hidden' ? btn : pill)?.click();
      });
      if (check(await until(page, () => !!document.querySelector('#pg-eye .eyelay:not(.min)'), null, 5000), `${T} [c sheet] the layers sheet did not open`)) {
        await settled(page);
        const s = await overlaps(page);
        check(!s.shown.includes('card') && !s.bad.length, `${T} [c sheet] the sheet over the card: shown ${s.shown.filter((k) => !/^chip/.test(k)).join(' ')}; ${s.bad.join(', ')}`);
        // folded, the card comes back
        await page.evaluate(() => document.querySelector('#pg-eye .eyelay:not(.min) > h3')?.click());
        await until(page, () => !document.querySelector('#pg-eye .eyelay:not(.min)'), null, 5000);
        const back = await until(page, () => getComputedStyle(document.querySelector('#pg-eye .eyeinfo')).display !== 'none' && !document.querySelector('#pg-eye .eyeinfo').hidden, null, 5000);
        check(back, `${T} [c sheet] the card did not come back when the sheet folded`);
      }
      // d. LOOK over the card
      await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyebot .btns button')].find((b) => /^look$/i.test((b.dataset.label || b.textContent).trim()))?.click());
      if (check(await until(page, () => !document.querySelector('#pg-eye .lookmenu').hidden, null, 5000), `${T} [d look] LOOK did not open`)) {
        await settled(page);
        const l = await overlaps(page);
        check(!l.shown.includes('card') && !l.bad.length, `${T} [d look] LOOK over the card: shown ${l.shown.filter((k) => !/^chip/.test(k)).join(' ')}; ${l.bad.join(', ')}`);
        await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyebot .btns button')].find((b) => /^look$/i.test((b.dataset.label || b.textContent).trim()))?.click());
      }
      await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyeinfo button')].find((b) => b.textContent.trim() === '✕')?.click());
      check(await until(page, () => document.querySelector('#pg-eye .eyeinfo').hidden, null, 5000), `${T} [b card] ✕ did not close the card`);
    }
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: false }));
  }
  // d. (once per phone) the newest wins: a camera opened while LOOK is open closes LOOK
  {
    const T = `[${vp.width}]`;
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: true }));
    await until(page, () => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, 20000);
    await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyebot .btns button')].find((b) => /^look$/i.test((b.dataset.label || b.textContent).trim()))?.click());
    await until(page, () => !document.querySelector('#pg-eye .lookmenu').hidden, null, 5000);
    // the brain's own way to a camera (show_cameras, as "show me the cameras on the Strand" runs it) while LOOK is open
    await page.evaluate(() => void window.__ghosty.run('show_cameras', { lat: 51.508, lon: -0.128, place: 'the Strand' }));
    const won = await until(page, () => document.querySelector('#pg-eye .lookmenu').hidden && !document.querySelector('#pg-eye .eyeinfo').hidden, null, 8000);
    check(won, `${T} [d newest] a camera opened with LOOK open did not close LOOK and open its card`);
    await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyeinfo button')].find((b) => b.textContent.trim() === '✕')?.click());
  }
  // f. the zoom rail's keys, tapped once (in whichever look was loaded last)
  if (vp === PHONE) {
    const T = `[${vp.width}]`;
    await place(page, { lat: 52.48, lon: -1.9, range: 300, tilt: 0, hd: 0 });
    await until(page, () => !window.__ghosty.globe.cam.fly, null, 10000);
    const r0 = await page.evaluate(() => window.__ghosty.globe.cam.target.range);
    await page.evaluate(() => document.querySelector('#pg-eye .zoomrail button[aria-label="Zoom in"]')?.click());
    const r1 = await page.evaluate(() => window.__ghosty.globe.cam.target.range);
    check(r1 < r0 * 0.9, `${T} [f zoom] a tap on + did not zoom in (${Math.round(r0)} → ${Math.round(r1)} km)`);
    await page.evaluate(() => document.querySelector('#pg-eye .zoomrail button[aria-label="Zoom out"]')?.click());
    const r2 = await page.evaluate(() => window.__ghosty.globe.cam.target.range);
    check(r2 > r1 * 1.1, `${T} [f zoom] a tap on − did not zoom out (${Math.round(r1)} → ${Math.round(r2)} km)`);
  }
  await ctx.close();
}

// g. his own position never goes to the brain (read from the very source the page is built from)
{
  const eye = src('features/eye/index.ts');
  const me = /case 'me':[\s\S]*?return ([^;]+);/.exec(eye)?.[1] ?? '';
  check(me && !/toFixed|\.lat|\.lon/.test(me), `[g GPS] the YOU card's words for the brain carry coordinates: ${me.slice(0, 120)}`);
  check(/roadAhead\.on \? 'following the phone/.test(eye), "[g GPS] God's Eye's own description says where the phone is while ROAD AHEAD follows it");
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `SEE lane clean: ${checks} checks in ${secs} s: in all seven looks at 440 and 390 God's Eye's grid, card, layers sheet, zoom rail and LOOK menu each keep to the measured band and never lie over one another, the chips or the keys; a camera's card shows its picture with ASK GHOSTY and ✕ in reach; the zoom keys work at a tap; his position never goes to the brain.`);
process.exit(problems.length ? 1 : 0);
