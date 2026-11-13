// OFFLINE MAPS (BRIEF-OFFLINE-1): the map of his area kept on the phone on his tap, in a real browser at 440 × 956 and 390 × 844, in all
// three worlds (The Scan, Glass, ONE INK). The map source is never touched: every address of tiles.openfreemap.org is answered by a
// route here (a hand-encoded vector tile with water, a road and a place; tests/fixtures/offlinepacks.mjs). The pack's arithmetic
// (offline/mapmath.ts) is bundled and checked in this process, so the size said before the tap is held to the tiles that cover the area.
//  1. SETTINGS → OFFLINE MAPS: the pack is offered with its size said as "about N MB" (the tiles' count at their measured weight), its
//     licence (OpenStreetMap, ODbL), "on Wi-Fi", and what works and what needs a signal; nothing was fetched by looking;
//  2. on MOBILE DATA a tap fetches nothing and says "it waits for Wi-Fi"; Wi-Fi comes and it starts by itself;
//  3. the pieces are fetched in order and counted ("piece 40 of 61 · …"), exactly the tiles of zooms 0 to 9 (the spec's smaller map: the
//     hook window.__ghostyPackTest, so the map is looked at from zoom 9) and every sheet, sprite, letter range and relief tile; a failed piece stops it with "carries on from
//     there"; GET again fetches only what is missing (no address twice); then "<name>, <month>, <size> on your phone";
//  4. NO SIGNAL (navigator.onLine false, every live address refused and counted): the map's MAP view draws from the pack on a MapLibre
//     canvas (water and road drawn, the place's label), the quiet line says it, no live address was asked; the 3D view too; a view
//     outside the area says "Outside the map on this phone"; a pin says the address needs a signal; the signal coming back is the live map;
//  5. A JOURNEY with no signal draws its stops as pins and its path as the line on the pack's map;
//  6. NO PACK and no signal: the line says where to get it (Settings, OFFLINE MAPS, on Wi-Fi);
//  7. DELETE: the UNDO bar holds it back; UNDO keeps it; DELETE again and let it go: the cache is gone and the offer is back;
//  8. every world at 440 and 390: nothing sideways, every key 44 pt, no page errors, nothing blocked by the security policy.
//   BASE=http://localhost:8800 node tests/offlinemaps.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { dark, glyphs, OFM, PNG, tileJson, VERSION, vectorTile } from './fixtures/offlinepacks.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const notes = [];
process.on('exit', (c) => c && problems.length && console.error(`problems so far:\n- ${problems.join('\n- ')}`));

// ---- the pack's arithmetic, bundled from the source and checked here
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'offlinemaps-'));
esbuild.buildSync({ entryPoints: [join(root, 'apps/web/src/offline/mapmath.ts')], bundle: true, format: 'esm', outfile: join(tmp, 'mapmath.mjs'), logLevel: 'warning' });
const M = await import(join(tmp, 'mapmath.mjs'));
const MAXZ = 9;
const sizeWords = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
check(M.tileCount(0) === 1 && M.tileCount(1) === 1, '[math] the first zooms are one tile each');
check(M.tilesTotal(14) === Array.from({ length: 15 }, (_, z) => M.tileCount(z)).reduce((a, b) => a + b, 0), '[math] the tile total is the sum of the zooms');
check(M.tileCount(14) > 800 && M.tileCount(14) < 1500, `[math] zoom 14 is ${M.tileCount(14)} tiles for the West Midlands (expected about a thousand)`);
check(M.estimate() > 55e6 && M.estimate() < 85e6, `[math] the size said is ${sizeWords(M.estimate())} (expected about 70 MB)`);
check(M.inArea(52.4778, -1.899) && M.inArea(52.4, -1.51) && M.inArea(52.59, -2.12) && !M.inArea(51.5, -0.12) && !M.inArea(53.48, -2.24), '[math] Birmingham, Coventry and Wolverhampton are in the area; London and Manchester are not');
const tilesBelow = M.tilesTotal(MAXZ);
const reliefBelow = Array.from({ length: 7 }, (_, z) => M.tileCount(z)).reduce((a, b) => a + b, 0);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const GL = { look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } };
const INK = { look: { ground: 'warm', world: 'ink', night: 'warm', switches: {} } };

/** A phone: the brain answered by the preview, the map source answered here, the network the spec says it is. */
async function phone({ viewport = PHONE, world = null, pack = true, hook = { maxZoom: MAXZ } } = {}) {
  // (service workers blocked: a route sees every request, as the other specs have it)
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const st = { live: [], asked: new Map(), fail: 0, off: false, seen: [] };
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|Not found in the map|ERR_FAILED/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  if (hook) await page.addInitScript((h) => (window.__ghostyPackTest = h), hook);
  // the connection: Wi-Fi or mobile data (Safari never says; Chromium does) and whether the phone has a signal at all
  await page.addInitScript(() => {
    const conn = Object.assign(new EventTarget(), { type: 'wifi', saveData: false });
    Object.defineProperty(navigator, 'connection', { get: () => conn, configurable: true });
    window.__net = (type) => {
      conn.type = type;
      conn.dispatchEvent(new Event('change'));
    };
    window.__signal = (on) => {
      Object.defineProperty(navigator, 'onLine', { get: () => on, configurable: true });
      window.dispatchEvent(new Event(on ? 'online' : 'offline'));
    };
  });
  await page.route(`${OFM}/**`, (r) => {
    const u = new URL(r.request().url());
    st.seen.push(u.pathname);
    if (st.off) {
      st.live.push(r.request().url());
      return r.abort('internetdisconnected');
    }
    const p = u.pathname;
    st.asked.set(p, (st.asked.get(p) ?? 0) + 1);
    if (/^\/styles\/dark$/.test(p)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(dark()) });
    if (p === '/planet') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(tileJson()) });
    if (/^\/sprites\/ofm_f384\/ofm(@2x)?\.json$/.test(p)) return r.fulfill({ contentType: 'application/json', body: '{}' });
    if (/^\/sprites\/ofm_f384\/ofm(@2x)?\.png$/.test(p)) return r.fulfill({ contentType: 'image/png', body: PNG });
    const g = /^\/fonts\/Noto%20Sans%20Regular\/(\d+-\d+)\.pbf$/.exec(p);
    if (g) return r.fulfill({ contentType: 'application/x-protobuf', body: glyphs(g[1]) });
    const t = new RegExp(`^/planet/${VERSION}/(\\d+)/(\\d+)/(\\d+)\\.pbf$`).exec(p);
    if (t) {
      if (st.fail > 0 && --st.fail === 0) {
        st.asked.delete(p); // (the piece that failed was not fetched: it is asked for once, by GET again)
        return r.abort('connectionreset');
      }
      return r.fulfill({ contentType: 'application/x-protobuf', body: vectorTile(+t[1], +t[2], +t[3]) });
    }
    if (/^\/natural_earth\/ne2sr\/\d+\/\d+\/\d+\.png$/.test(p)) return r.fulfill({ contentType: 'image/png', body: PNG });
    return r.fulfill({ status: 404, body: '' });
  });
  // the rest of the world stays out: a live address of any other map or service is a failure of the spec
  await page.route(/^https:\/\/(?!tiles\.openfreemap\.org)(?!fonts\.g)/, (r) => {
    st.live.push(r.request().url());
    return r.abort('internetdisconnected');
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  const w = world === 'glass' ? GL : world === 'ink' ? INK : {};
  await page.evaluate((w) => window.__ghosty.settings.set({ sounds: false, ...w }), w);
  await page.evaluate(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return { ctx, page, st };
}

/** A picture for the report (God's Eye's own WebGL can hang a software-GL screenshot: it is given 15 s and the spec goes on). */
const shot = (page, path) => page.screenshot({ path, timeout: 15000 }).catch(() => undefined);
/** Closes the map sheet if it is open (a signal coming back may have drawn it again). */
const closeSheet = async (page) => {
  const b = page.locator('.modal .mhead button:has-text("CLOSE")');
  if (await b.count()) await b.first().click({ timeout: 8000 }).catch(() => b.first().click({ force: true, timeout: 5000 }).catch(() => undefined));
  await page.waitForTimeout(300);
};
const mapRow = (page) => page.locator('#pg-settings .wikioffer[data-pack="map-west-midlands"]');
async function openMaps(page) {
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 20000 });
  await openPanel(page, 'settings', 'OFFLINE MAPS');
  await page.waitForSelector('#pg-settings .wikioffer[data-pack="map-west-midlands"]', { timeout: 10000 });
}
const rowText = async (page) => ((await mapRow(page).innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');
/** Waits for an async condition (Playwright's own waiting takes a promise as true at once). */
const poll = async (page, fn, ms, why) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(300);
  }
  problems.push(why);
  return false;
};
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
        if (!e.getClientRects().length) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
      })
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`),
  );
const small = (page, sel) =>
  page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().height > 0).slice(0, 5).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().height)}`));

// ================================================================== 1-3: offered, mobile data, fetched, resumed, kept
{
  const { ctx, page, st } = await phone();
  await openMaps(page);
  // the hook shrinks the pack for the spec; the offer's wording is checked on the full one below
  const t0 = await rowText(page);
  check(/The West Midlands map/.test(t0), `[offer] the row is not named: ${t0.slice(0, 120)}`);
  check(new RegExp(`Get · about ${sizeWords(M.estimate(MAXZ)).replace(/[.]/g, '\\.')}`, 'i').test(t0), `[offer] the size on the button is not "about ${sizeWords(M.estimate(MAXZ))}": ${t0.slice(0, 200)}`);
  check(/OpenStreetMap/.test(t0) && /ODbL/.test(t0), '[offer] the licence is not said');
  check(/on Wi-Fi/.test(t0), '[offer] "on Wi-Fi" is not said');
  check(/Needs a signal, and says so/.test(await page.locator('#pg-settings .offmaps').innerText()), '[offer] what needs a signal is not said');
  check(st.seen.length === 0, `[offer] looking at the offer fetched ${st.seen.length} addresses`);
  check((await mapRow(page).locator('button[data-act="get"]').getAttribute('aria-label')) === `Get The West Midlands map, about ${sizeWords(M.estimate(MAXZ))}, on Wi-Fi`, '[offer] the button has no VoiceOver label with the size');
  await shot(page, `${out}/maps-offered.png`);

  // 2. mobile data: nothing is fetched, it says so, and Wi-Fi starts it by itself
  await page.evaluate(() => window.__net('cellular'));
  await mapRow(page).locator('button[data-act="get"]').click();
  await until(page, () => /it waits for Wi-Fi/.test(document.querySelector('.wikioffer[data-pack="map-west-midlands"]')?.textContent ?? ''), null, 5000, '[mobile] a tap on mobile data did not say it waits for Wi-Fi');
  const words = await rowText(page);
  check(new RegExp(`You are on mobile data, and The West Midlands map is about ${sizeWords(M.estimate(MAXZ))}: it waits for Wi-Fi\\. Join Wi-Fi and it starts by itself\\.`).test(words), `[mobile] the words: ${words.slice(0, 260)}`);
  await page.waitForTimeout(600);
  check(st.seen.length === 0, `[mobile] ${st.seen.length} addresses were fetched on mobile data`);

  // 3. Wi-Fi comes; the sixth tile fails once; GET again carries on
  st.fail = 6;
  await page.evaluate(() => window.__net('wifi'));
  await until(page, () => /The download stopped at piece \d+ of \d+/.test(document.querySelector('.wikioffer[data-pack="map-west-midlands"]')?.textContent ?? ''), null, 20000, '[get] a failed piece did not stop it with the packs\' words');
  const stopped = await rowText(page);
  check(/Tap RETRY on Wi-Fi: it carries on from there/.test(stopped), `[get] the stop does not say it carries on: ${stopped.slice(0, 260)}`);
  check(await mapRow(page).locator('button[data-act="get"]').isEnabled(), '[get] GET is not there again after a stop');
  const before = new Map(st.asked);
  await mapRow(page).locator('button[data-act="get"]').click();
  const done = await until(page, () => document.querySelector('.wikioffer[data-pack="map-west-midlands"]')?.dataset.state === 'here', null, 40000, '[get] the pack did not finish');
  if (done) {
    const tiles = [...st.asked.keys()].filter((p) => p.startsWith(`/planet/${VERSION}/`));
    check(tiles.length === tilesBelow, `[get] ${tiles.length} tiles were fetched, not the ${tilesBelow} of zooms 0 to ${MAXZ}`);
    const relief = [...st.asked.keys()].filter((p) => p.startsWith('/natural_earth/'));
    check(relief.length === reliefBelow, `[get] ${relief.length} relief tiles, not ${reliefBelow}`);
    for (const p of ['/styles/dark', '/planet', '/sprites/ofm_f384/ofm.json', '/sprites/ofm_f384/ofm.png', '/sprites/ofm_f384/ofm@2x.json', '/sprites/ofm_f384/ofm@2x.png', '/fonts/Noto%20Sans%20Regular/0-255.pbf', '/fonts/Noto%20Sans%20Regular/256-511.pbf', '/fonts/Noto%20Sans%20Regular/8192-8447.pbf'])
      check(st.asked.has(p), `[get] ${p} was not fetched`);
    const twice = [...st.asked].filter(([p, n]) => n > 1 && p !== '/planet' && p !== '/styles/dark');
    check(twice.length === 0, `[get] fetched twice (GET again must carry on, not start over): ${twice.slice(0, 3).map(([p]) => p).join(', ')}`);
    check([...before.keys()].every((p) => (st.asked.get(p) ?? 0) === before.get(p) || p === '/planet' || p === '/styles/dark'), '[get] GET again fetched an address already kept');
    const kept = await rowText(page);
    const month = await page.evaluate(() => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()]} ${new Date().getFullYear()}`);
    check(new RegExp(`The West Midlands map, ${month}, \\d+(\\.\\d)? (MB|KB) on your phone`).test(kept), `[kept] the kept line: ${kept.slice(0, 200)}`);
    check(await page.evaluate(async () => (await caches.keys()).includes('ghosty-maps-v1')), '[kept] the pack is not in ghosty-maps-v1');
    check(await mapRow(page).locator('button[data-act="delete"]').isVisible(), '[kept] there is no DELETE');
    check((await page.locator('#pg-settings .offmaps').innerText()).length > 0 && !/\bGet · about\b/.test(kept), '[kept] the offer is still showing');
    await shot(page, `${out}/maps-kept.png`);
    notes.push(`the pack: ${tiles.length} tiles of zooms 0 to ${MAXZ} + ${relief.length} relief tiles, ${st.asked.size} addresses, none twice`);
  }

  // 4. no signal: the map draws from the pack
  st.off = true;
  st.live.length = 0;
  st.seen.length = 0;
  await page.evaluate(() => window.__signal(false));
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForTimeout(1200);
  await page.click('#pg-eye .eyebot .btns button:has-text("MAP")');
  const canvas = await page.waitForSelector('.modal .m3host .map3d .maplibregl-canvas', { timeout: 40000 }).then(() => true, () => false);
  check(canvas, `[offline] the MAP view did not draw the pack's map: ${await page.textContent('.modal').then((t) => (t ?? '').slice(0, 200)).catch(() => '')}`);
  if (canvas) {
    check((await page.locator('.modal .leaflet-container:visible').count()) === 0, '[offline] the flat map (live tiles) is showing with no signal');
    await until(page, () => !!window.__ghostyMap, null, 5000, '[offline] no map handle');
    await page.evaluate(() => window.__ghostyMap.jumpTo({ center: [-1.8904, 52.4862], zoom: 9 }));
    await page.evaluate(() => new Promise((ok) => { const m = window.__ghostyMap; const done = () => (m.isStyleLoaded() && m.areTilesLoaded() ? ok(true) : m.once('idle', done)); m.triggerRepaint(); m.once('idle', done); setTimeout(ok, 20000); }));
    const drawn = await page.evaluate(() => ({ water: window.__ghostyMap.queryRenderedFeatures({ layers: ['water'] }).length, road: window.__ghostyMap.queryRenderedFeatures({ layers: ['road'] }).length, place: window.__ghostyMap.querySourceFeatures('openmaptiles', { sourceLayer: 'place' }).length, name: window.__ghostyMap.querySourceFeatures('openmaptiles', { sourceLayer: 'place' })[0]?.properties?.name ?? '' }));
    check(drawn.water > 0 && drawn.road > 0, `[offline] the map drew water ${drawn.water} and road ${drawn.road} features from the pack`);
    check(/^Tile [89]\//.test(drawn.name), `[offline] the place's name did not come from the pack's tile (${JSON.stringify(drawn)})`);
    check(await page.evaluate(() => window.__ghostyMap.getPitch() === 0), '[offline] the MAP view is not flat');
    const info = (await page.textContent('.modal .m3host .fminfo'))?.trim();
    check(info === 'Offline: drawn from the West Midlands map on this phone.', `[offline] the quiet line: "${info}"`);
    const note = (await page.textContent('.modal .mapnote'))?.trim();
    check(/The map on this phone/.test(note ?? ''), `[offline] the sheet's note: "${note}"`);
    check(st.live.length === 0, `[offline] a live address was asked with no signal: ${st.live.slice(0, 3).join(' ')}`);
    await shot(page, `${out}/maps-offline-map.png`);
    // outside the area
    await page.evaluate(() => window.__ghostyMap.jumpTo({ center: [-0.1276, 51.5072], zoom: 9 }));
    await until(page, () => /Outside the map on this phone: the West Midlands only\./.test(document.querySelector('.modal .m3host .fminfo')?.textContent ?? ''), null, 8000, '[offline] a view outside the area did not say so');
    await page.evaluate(() => window.__ghostyMap.jumpTo({ center: [-1.5113, 52.4068], zoom: 9 }));
    await until(page, () => /^Offline: drawn from the West Midlands map/.test(document.querySelector('.modal .m3host .fminfo')?.textContent ?? ''), null, 8000, '[offline] Coventry (inside) did not bring the quiet line back');
    // a pin: the address needs a signal
    await page.evaluate(() => window.__ghostyMap.fire('click', { lngLat: { lng: -1.5113, lat: 52.4068 }, point: { x: 100, y: 100 } }));
    await until(page, () => /needs a signal/.test(document.querySelector('.m3addr')?.textContent ?? ''), null, 8000, '[offline] a pin does not say the address needs a signal');
    // the 3D tab draws from it too
    await page.click('.modal .maptabs button[data-view="3d"]');
    await page.waitForTimeout(600);
    check((await page.locator('.modal .m3host:visible .maplibregl-canvas').count()) === 1, '[offline] the 3D tab has no canvas');
    check(st.live.length === 0, `[offline] the 3D tab asked a live address: ${st.live.slice(0, 3).join(' ')}`);
    // the signal comes back: the live map
    st.off = false;
    await page.evaluate(() => window.__signal(true));
    await until(page, () => !/^Offline:/.test(document.querySelector('.modal .m3host .fminfo')?.textContent ?? 'x'), null, 8000, '[online] the quiet line stayed with the signal back');
    await page.waitForFunction(() => window.__ghostyMap.getStyle().sources.openmaptiles?.url?.startsWith('https://'), null, { timeout: 8000 }).catch(() => problems.push('[online] the live style did not come back with the signal'));
    await closeSheet(page);
  }

  // 5. a journey with no signal: pins and path on the pack's map
  st.off = true;
  st.live.length = 0;
  await page.evaluate(() => window.__signal(false));
  const leg = (mode, a, b, n) => ({ mode, from: { name: a[2], lat: a[0], lon: a[1] }, to: { name: b[2], lat: b[0], lon: b[1] }, stops: [], start: '2026-11-10T09:00:00Z', end: '2026-11-10T09:10:00Z', duration: 600, distance: 900, line: mode === 'walk' ? '' : '9', agency: 'Test', headsign: '', track: '', color: '', realTime: false, cancelled: false, points: '', precision: 7, n });
  const A = [52.4778, -1.899, 'New Street'], B = [52.4651, -1.9, 'Five Ways'], C = [52.4515, -1.9153, 'Pebble Mill Road'];
  const it = { id: '1', start: '2026-11-10T09:00:00Z', end: '2026-11-10T09:25:00Z', duration: 1500, transfers: 0, legs: [leg('walk', A, B), leg('bus', B, C)] };
  const answer = { from: { name: 'New Street', lat: A[0], lon: A[1] }, to: { name: 'Pebble Mill Road', lat: C[0], lon: C[1] }, tz: 'Europe/London', time: '2026-11-10T09:00:00Z', arriveBy: false, itineraries: [it] };
  const body = [{ t: 'status', text: 'thinking…' }, { t: 'client', name: 'show_journey', args: answer }, { t: 'text', text: 'One option.' }, { t: 'done', model: 'Mock · scripted' }].map((e) => JSON.stringify(e)).join('\n') + '\n';
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(900);
  await page.click('.logbtn');
  await page.fill('#cin', 'plan a journey from new street to pebble mill road');
  await page.keyboard.press('Enter');
  const sheet = await page.waitForSelector('.modal .jhead', { timeout: 20000 }).then(() => true, () => false);
  check(sheet, '[journey] the journey sheet did not open with no signal');
  if (sheet) {
    const drawn = await page.waitForFunction(() => window.__ghostyMap?.getSource('ghosty-line')?.serialize?.().data?.geometry?.coordinates?.length >= 2 && document.querySelectorAll('.modal .m3pin').length >= 2, null, { timeout: 30000 }).then(() => true, () => false);
    check(drawn, `[journey] the stops were not drawn as pins and the path as a line on the pack's map (${await page.locator('.modal .m3pin').count()} pins)`);
    check((await page.locator('.modal .jstep').count()) === 2, '[journey] the sheet under the map does not list its two steps');
    check((await page.textContent('.modal .m3host .fminfo'))?.includes('Offline'), '[journey] the quiet line is missing under the journey');
    check(st.live.length === 0, `[journey] a live address was asked with no signal: ${st.live.slice(0, 3).join(' ')}`);
    await shot(page, `${out}/maps-offline-journey.png`);
    await closeSheet(page);
  }
  await page.unroute('**/api/chat');

  // 7. DELETE: UNDO holds it back; then let it go
  st.off = false;
  await page.evaluate(() => window.__signal(true));
  await openMaps(page);
  await mapRow(page).locator('button[data-act="delete"]').click();
  await page.waitForSelector('.undo:not([hidden]), .rcundo:not([hidden])', { timeout: 5000 }).catch(() => problems.push('[delete] no UNDO bar'));
  check(/deleted from this phone/.test((await page.textContent('body')) ?? ''), '[delete] the bar does not say it was deleted');
  check((await page.locator('#pg-settings .wikioffer[data-pack="map-west-midlands"] button[data-act="get"]').count()) === 1, '[delete] the offer did not come back at once');
  await page.locator('.undo:not([hidden]) button, .rcundo:not([hidden]) button').first().click();
  await until(page, () => document.querySelector('.wikioffer[data-pack="map-west-midlands"]')?.dataset.state === 'here', null, 5000, '[delete] UNDO did not keep the pack');
  check(await page.evaluate(async () => (await caches.has('ghosty-maps-v1')) && (await (await caches.open('ghosty-maps-v1')).keys()).length > 20), '[delete] UNDO lost the files');
  await mapRow(page).locator('button[data-act="delete"]').click();
  await poll(page, async () => !(await caches.has('ghosty-maps-v1')), 25000, '[delete] the cache was not cleared once the bar let it go');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !localStorage.getItem('ghosty.pack.kept') || !JSON.parse(localStorage.getItem('ghosty.pack.kept'))['map-west-midlands']), '[delete] the record of the pack stayed');
  check(await mapRow(page).locator('button[data-act="get"]').isVisible(), '[delete] the offer is not back after DELETE');
  check((await page.evaluate(() => window.__cspv)).length === 0, `[security] blocked by the policy: ${JSON.stringify(await page.evaluate(() => window.__cspv))}`);
  await ctx.close();
}

// ================================================================== 6: no pack, no signal
{
  const { ctx, page, st } = await phone({ hook: null });
  await page.evaluate(() => window.__signal(false));
  st.off = true;
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForTimeout(1200);
  await page.click('#pg-eye .eyebot .btns button:has-text("MAP")');
  await page.waitForSelector('.modal .mapnote', { timeout: 10000 });
  await until(page, () => /No signal, and the map is not on this phone: Settings, OFFLINE MAPS, on Wi-Fi\./.test(document.querySelector('.modal .mapnote')?.textContent ?? ''), null, 8000, '[no pack] the line does not say where to get the map');
  // the full pack's offer, with its real size said
  await closeSheet(page);
  await page.evaluate(() => window.__signal(true));
  st.off = false;
  await openMaps(page);
  const t = await rowText(page);
  check(new RegExp(`Get · about ${sizeWords(M.estimate()).replace(/[.]/g, '\\.')}`, 'i').test(t), `[offer] the full pack's size on the button is not "about ${sizeWords(M.estimate())}": ${t.slice(0, 160)}`);
  notes.push(`the full pack is offered as "about ${sizeWords(M.estimate())}" (${M.tilesTotal()} tiles of zooms 0 to 14)`);
  await ctx.close();
}

// ================================================================== 8: the three worlds, at 440 and 390
for (const world of ['scan', 'glass', 'ink']) {
  for (const vp of [PHONE, SMALL]) {
    const { ctx, page } = await phone({ viewport: vp, world, hook: null });
    await openMaps(page);
    await page.waitForTimeout(900); // (the panel pushes in on a spring: measured when it has landed)
    const tag = `[${world} ${vp.width}]`;
    check((await sideways(page, '#pg-settings *')).length === 0, `${tag} something sticks out sideways: ${(await sideways(page, '#pg-settings *')).join(', ')}`);
    const tiny = await small(page, '#pg-settings .offmaps button');
    check(tiny.length === 0, `${tag} a key under 44 pt: ${tiny.join(', ')}`);
    check((await page.locator('#pg-settings .offmaps .wikioffer').count()) === 1, `${tag} the pack is not offered`);
    await shot(page, `${out}/maps-${world}-${vp.width}.png`);
    await ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error(`OFFLINE MAPS: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: OFFLINE MAPS - the pack offered with its size and licence, waits for Wi-Fi, fetched in pieces and carried on, kept in ghosty-maps-v1, drawn with no signal (map, 3D, journey, outside the area, the address, the signal back), no pack says where to get it, DELETE with UNDO, three worlds at 440 and 390 (${notes.join('; ')})`);
