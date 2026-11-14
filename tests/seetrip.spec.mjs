// THE SEE LANE, NEXT ROUND (docs/build-plan/next/see.md; docs/build-plan/NEXT-SEE.md): what the lane built on God's Eye and the map,
// proved on the owner's 440 × 956 and a 390 × 844 phone, against the preview's real brain with the public feeds stood in (no internet):
//   a. GETTING THERE (see.c1): an appointment with a place, in AGENDA, has GETTING THERE on its card; one tap shows when to leave (a
//      journey that arrives in time), the weather when he arrives, the road reports' line and the public cameras along the way, each
//      with a fresh picture; every key 44 pt, nothing sideways; "how do I get to my next appointment?" opens it from the chat;
//      the journey asked from "Here" never carries finer than the square kilometre (the brain never gets live GPS);
//   b. THE JOURNEY WITH NO SIGNAL (the half-done one): the journey shown is kept on the phone; with the signal cut, the planner says it
//      cannot plan and offers the kept one, which opens on the offline map with "its times may be out of date";
//   c. the words: every wording of TRIP MODE and of the layer sets is one meaning (read from the very source the page is built from);
//   d. GOD'S EYE (see.u3, see.u6): COMMUTE, STORM and SKY each set their layers in one tap; a search for "BAW" lists every matching
//      flight to pick from (a tap opens its card), an exact call sign goes straight to it; every key 44 pt;
//   e. YOUR CAMERA WALL (see.u2): PIN TO WALL on a camera's card keeps it on the phone; WALL in the bar opens the wall, its tile live;
//      EDIT and TAKE OFF empty it, said in his words; "my camera wall" is its wording.
//   BASE=http://localhost:8788 node tests/seetrip.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
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
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}

// ---- the stand-ins: one appointment in central London three hours from now, a journey that arrives in time, the weather, TfL's cameras
const IMG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAEklEQVR42mNkYPhfz0AEYBxVCAB1BgL9mY8kAQAAAABJRU5ErkJggg==', 'base64');
const START = Date.now() + 3 * 3600_000;
const EVENT = { id: 'ev-trip-1', title: 'Dentist', start: START, end: START + 3600_000, location: 'Strand, London', source: 'mine' };
const iso = (ms) => new Date(ms).toISOString();
const STRAND = { name: 'Strand, London', lat: 51.5105, lon: -0.1225 };
const FROM = { name: 'Here', lat: 51.52, lon: -0.14 };
const leg = (mode, from, to, s, e, line = '') => ({ mode, line, color: '', agency: line ? 'TfL' : '', headsign: line ? 'Strand' : '', from, to, start: iso(s), end: iso(e), duration: (e - s) / 1000, distance: 900, stops: [], points: '', realTime: false });
const journey = (arrive) => {
  const s = arrive - 32 * 60_000;
  const m = { name: 'Oxford Circus', lat: 51.515, lon: -0.1415 };
  return {
    from: FROM, to: STRAND, time: iso(arrive), arriveBy: true, tz: 'Europe/London',
    itineraries: [{ start: iso(s), end: iso(arrive), duration: 32 * 60, transfers: 0, direct: false, legs: [leg('walk', FROM, m, s, s + 6 * 60_000), leg('bus', m, { name: 'Strand', lat: 51.511, lon: -0.123 }, s + 6 * 60_000, arrive - 3 * 60_000, '15'), leg('walk', { name: 'Strand', lat: 51.511, lon: -0.123 }, STRAND, arrive - 3 * 60_000, arrive)] }],
  };
};
const tfl = (i) => ({ id: `JamCams_00001.0${2000 + i}`, commonName: `Strand / Camera ${i + 1}`, lat: 51.5107 + i * 0.0006, lon: -0.1235 + i * 0.0006, additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/0001${i}.jpg` }] });
// three aircraft over London: two of them British Airways (a search for "BAW" lists both)
const AC = [['406a1b', 'BAW123  ', 'A320', 'G-EUYA', 51.47, -0.3, 12000], ['406b2c', 'BAW456  ', 'A35K', 'G-XWBA', 51.5, -0.1, 36000], ['4ca9f1', 'EIN154  ', 'A21N', 'EI-LRA', 51.55, -0.2, 22000]].map(([hex, flight, t, r, lat, lon, alt]) => ({ hex, flight, t, r, lat, lon, alt_baro: alt, gs: 410, track: 90 }));
const hours = () => {
  const h0 = Math.floor(Date.now() / 3600_000) * 3600;
  const time = Array.from({ length: 72 }, (_, i) => h0 + i * 3600);
  // (the same answer serves home's own weather, so it carries what that reads too)
  const days = Array.from({ length: 3 }, (_, i) => new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10));
  return {
    current: { temperature_2m: 9.4, apparent_temperature: 7, relative_humidity_2m: 80, weather_code: 61, wind_speed_10m: 12, wind_direction_10m: 220, pressure_msl: 1008 },
    hourly: { time, temperature_2m: time.map(() => 9.4), precipitation_probability: time.map(() => 60), weather_code: time.map(() => 61) },
    daily: { time: days, temperature_2m_max: [11, 11, 11], temperature_2m_min: [5, 5, 5], precipitation_probability_max: [60, 60, 60], sunrise: days.map((d) => `${d}T07:20`), sunset: days.map((d) => `${d}T16:10`), uv_index_max: [1, 1, 1] },
  };
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const asked = { journey: [] };
  await ctx.route('**/api/proxy?**', (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).searchParams.get('url') ?? '');
    if (/\.(jpg|jpeg)$/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: IMG });
    if (/api\.tfl\.gov\.uk/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify([0, 1, 2].map(tfl)) });
    if (/api\.adsb\.lol|airplanes\.live/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ac: AC }) });
    if (/api\.open-meteo\.com/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(hours()) });
    return route.fulfill({ status: 404, body: '' });
  });
  await ctx.route(/\/api\/agenda(\?|$)/, (route) => route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tz: 'Europe/London', events: [EVENT], errors: [], jobs: [], feeds: [] }) }) : route.fallback());
  await ctx.route(/\/api\/journey/, (route) => {
    const u = new URL(route.request().url());
    const body = route.request().postData() ?? '';
    asked.journey.push(`${u.search} ${body}`);
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(journey(START - 5 * 60_000)) });
  });
  await ctx.route(/\/api\/guardian$/, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ places: [], checked: {}, failed: {}, tz: 'Europe/London', person: null, walk: null }) }) : route.fallback()));
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  await ctx.grantPermissions(['geolocation']);
  await ctx.setGeolocation({ latitude: 51.523456, longitude: -0.143219, accuracy: 10 });
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
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`[${viewport.width}] the boot never ended`));
  return { ctx, page, asked };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
/** The sheet's opening animation over (a key measured mid-rise reads 43 pt): every finite animation on the page finished. */
const still = (page) => page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 2000))]));
const text = (page, sel) => page.evaluate((s) => (document.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' ').trim(), sel);
/** Every key in a part 44 pt, nothing sideways (what scrolls in its own row is its row's). */
const bar = (page, scope) =>
  page.evaluate((scope) => {
    const bad = [];
    const shows = (e) => !e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    for (const b of document.querySelectorAll(`${scope} button`)) {
      if (!shows(b)) continue;
      // (its layout size: a sheet still rising is scaled for a moment, and a key in it is not smaller for that)
      const r = { width: b.offsetWidth || b.getBoundingClientRect().width, height: b.offsetHeight || b.getBoundingClientRect().height };
      if (r.width < 43.5 || r.height < 43.5) bad.push(`key "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`the page scrolls sideways (${document.documentElement.scrollWidth})`);
    for (const e of document.querySelectorAll(`${scope} *`)) {
      if (!shows(e)) continue;
      let inner = false;
      for (let p = e.parentElement; p && !p.matches(scope); p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) inner = true;
      const r = e.getBoundingClientRect();
      if (!inner && r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) bad.push(`sideways <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}"`);
    }
    return [...new Set(bad)].slice(0, 6);
  }, scope);

const W = await pure('apps/web/src/ui/tripwords.ts');
const S = await pure('apps/web/src/features/eye/sets.ts');
// (the wall's empty line, read from the very source the page shows it from)
const WALL_EMPTY = /export const WALL_EMPTY = '([^']+)'/.exec(readFileSync(new URL('../apps/web/src/features/eye/wall.ts', import.meta.url), 'utf8'))?.[1] ?? '';

// c. the words (one meaning, many wordings; nothing else taken)
{
  for (const t of ['trip mode', 'Getting there', 'How do I get to my next appointment?', 'how should i get to my next meeting', 'When should I leave for my meeting?', 'when do i need to leave', 'plan my journey to my next appointment', 'hey ghosty, how do I get there in time?'])
    check(W.TRIP_ASK.test(t), `[c words] "${t}" is not TRIP MODE`);
  for (const t of ['plan a journey to Manchester', 'how do I get to Leeds?', 'when is my next appointment?', 'trip to Paris'])
    check(!W.TRIP_ASK.test(t), `[c words] "${t}" was taken as TRIP MODE`);
}

{
  const want = { 'commute view': 'commute', 'show me the storm layers': 'storm', 'Sky mode': 'sky', 'weather view': 'storm', 'switch to the commute set': 'commute' };
  for (const [t, k] of Object.entries(want)) check(S.setAsked(t) === k, `[c words] "${t}" is not the ${k} set (${S.setAsked(t)})`);
  for (const t of ['what is the weather', 'sky news', 'storm in a teacup']) check(S.setAsked(t) === null, `[c words] "${t}" was taken as a layer set`);
  for (const t of ['my camera wall', 'show my cameras', 'open the camera wall', 'camera wall']) check(S.WALL_ASK.test(t), `[c words] "${t}" is not the camera wall`);
  for (const t of ['the wall', 'show me the cameras on the Strand', 'wall mode']) check(!S.WALL_ASK.test(t), `[c words] "${t}" was taken as the camera wall`);
}

for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  log(`${T} trip`);
  const { ctx, page, asked } = await phone(vp);
  // a. AGENDA: the event's card has GETTING THERE
  await page.evaluate(() => (location.hash = 'agenda'));
  const row = await until(page, (t) => [...document.querySelectorAll('#pg-agenda .ev')].some((r) => r.textContent.includes(t)), EVENT.title, 15000);
  if (check(row, `${T} [a agenda] the appointment never showed in AGENDA`)) {
    await page.evaluate((t) => [...document.querySelectorAll('#pg-agenda .ev')].find((r) => r.textContent.includes(t))?.click(), EVENT.title);
    const key = await until(page, () => !!document.querySelector('#pg-agenda .evcard button[data-act="trip"]'), null, 5000);
    if (check(key, `${T} [a agenda] the appointment's card has no GETTING THERE`)) {
      await page.evaluate(() => document.querySelector('#pg-agenda .evcard button[data-act="trip"]')?.click());
      const ready = await until(page, () => window.__ghosty?.trip?.state === 'ready' || !!document.querySelector('.trip [data-sec="leave"] .note:not([data-state])'), null, 15000);
      check(ready, `${T} [a trip] GETTING THERE never said when to leave: "${await text(page, '.trip')}"`);
      // everything along the way arrives: the weather, the road reports' line, the cameras with their pictures
      await until(page, () => !document.querySelector('.trip .note[data-state="loading"]') && document.querySelectorAll('.trip .tripcam img[src]').length > 0, null, 15000);
      const leave = await text(page, '.trip [data-sec="leave"]');
      check(/Leave by \d\d:\d\d to arrive \d\d:\d\d \(32 min, no changes\)\./.test(leave), `${T} [a trip] the leave line reads "${leave}"`);
      const sky = await text(page, '.trip [data-sec="weather"]');
      check(/9°C, 60% chance of rain at \d\d:\d\d\./.test(sky), `${T} [a trip] the weather when he arrives reads "${sky}"`);
      const roads = await text(page, '.trip [data-sec="roads"]');
      check(roads.includes(W.TRIP_ROADS_FAR), `${T} [a trip] the road reports' line reads "${roads}"`);
      const camsN = await page.evaluate(() => document.querySelectorAll('.trip .tripcam img[src]').length);
      check(camsN >= 2, `${T} [a trip] ${camsN} cameras along the way with a picture (want the Strand's)`);
      await still(page);
      const b = await bar(page, '.trip');
      check(!b.length, `${T} [a trip] ${b.join(', ')}`);
      // the brain's journey: from where he is to the square kilometre at most (the brain never gets live GPS)
      const fine = asked.journey.filter((q) => /51\.523|0\.1432|51\.5234|-0\.143/.test(q));
      check(asked.journey.length > 0 && !fine.length, `${T} [a GPS] the journey asked carried his position finer than a kilometre: ${asked.journey.join(' | ').slice(0, 200)}`);
      if (vp === PHONE) await page.screenshot({ path: `${out}/seetrip-trip-${vp.width}.png` }).catch(() => undefined);
      // SHOW ON THE MAP: the journey drawn, and kept on the phone
      await page.evaluate(() => [...document.querySelectorAll('.trip .tripacts button')].find((x) => /show on the map/i.test(x.textContent))?.click());
      check(await until(page, () => !!document.querySelector('.jsheet .jhead'), null, 8000), `${T} [b kept] SHOW ON THE MAP did not open the journey`);
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.journey.last') ?? 'null'));
      check(!!kept && kept.answer?.to?.name === 'Strand, London' && Number.isFinite(kept.at), `${T} [b kept] the journey is not kept on the phone: ${JSON.stringify(kept)?.slice(0, 120)}`);
      await page.keyboard.press('Escape');
    }
  }
  // a. by words, from the chat
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  await page.evaluate(() => (location.hash = 'eye'));
  await until(page, () => typeof window.__ghosty?.send === 'function', null, 15000);
  await page.evaluate(() => window.__ghosty.send('how do I get to my next appointment?'));
  check(await until(page, () => !!document.querySelector('.trip .triphead'), null, 15000), `${T} [a words] "how do I get to my next appointment?" did not open GETTING THERE`);
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  // d. God's Eye: the layer sets and every match of a search (the God's Eye page is open now)
  {
    await page.evaluate(() => { const b = document.querySelector('#pg-eye .eyechips .lchip.ico'); const pill = document.querySelector('#pg-eye .eyelay.min > h3'); (b && getComputedStyle(b).visibility !== 'hidden' ? b : pill)?.click(); });
    const sets = await until(page, () => document.querySelectorAll('#pg-eye .eyesets button').length === 3, null, 8000);
    if (check(sets, `${T} [d sets] WHAT TO SHOW has no COMMUTE / STORM / SKY`)) {
      for (const [k, on, off] of [['commute', ['cams', 'traffic', 'incidents', 'transit', 'enforce'], ['air', 'ships', 'sats']], ['storm', ['radar', 'alerts', 'quakes'], ['air', 'transit']], ['sky', ['air', 'sats', 'orbits'], ['radar', 'transit']]]) {
        await page.evaluate((k) => document.querySelector(`#pg-eye .eyesets button[data-set="${k}"]`)?.click(), k);
        const v = await page.evaluate(() => ({ ...window.__ghosty.globe.vis }));
        check(on.every((n) => v[n]) && off.every((n) => !v[n]), `${T} [d sets] ${k}: on ${on.filter((n) => !v[n]).join(',') || 'ok'} / off ${off.filter((n) => v[n]).join(',') || 'ok'}`);
        check(await page.evaluate((k) => document.querySelector(`#pg-eye .eyesets button[data-set="${k}"]`)?.classList.contains('on'), k), `${T} [d sets] ${k} is not marked as picked`);
      }
      const b = await bar(page, '#pg-eye .eyelay');
      check(!b.length, `${T} [d sets] ${b.join(', ')}`);
      await page.evaluate(() => document.querySelector('#pg-eye .eyelay:not(.min) > h3')?.click());
    }
    // every match: the aircraft over London arrive, then "BAW" lists both British Airways flights
    await page.evaluate(() => { const c = window.__ghosty.globe.cam; c.fly = null; Object.assign(c, { lat: 51.5, lon: -0.15, range: 200 }); c.target = { lat: 51.5, lon: -0.15, range: 200, tilt: 0, hd: 0 }; });
    const flying = await until(page, () => /EIN154|BAW/.test(document.querySelector('#pg-eye .eyebot .readout')?.textContent ?? '') || /\d+ planes?/.test(document.querySelector('#pg-eye .eyebot .readout')?.textContent ?? ''), null, 20000);
    if (check(flying, `${T} [d search] the stand-in aircraft never arrived: "${await text(page, '#pg-eye .eyebot .readout')}"`)) {
      await page.fill('#pg-eye .search input', 'BAW');
      await page.keyboard.press('Enter');
      const listed = await until(page, () => document.querySelectorAll('#pg-eye .searchlist:not([hidden]) .searchpick[data-kind="flight"]').length === 2, null, 5000);
      check(listed, `${T} [d search] "BAW" did not list both flights: "${await text(page, '#pg-eye .searchlist')}"`);
      const b = await bar(page, '#pg-eye .searchlist');
      check(!b.length, `${T} [d search] ${b.join(', ')}`);
      await page.evaluate(() => [...document.querySelectorAll('#pg-eye .searchpick')].find((x) => /BAW456/.test(x.textContent))?.click());
      check(await until(page, () => /BAW456/.test(document.querySelector('#pg-eye .eyeinfo:not([hidden])')?.textContent ?? '') && document.querySelector('#pg-eye .searchlist').hidden, null, 5000), `${T} [d search] a tapped match did not open its card`);
      await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyeinfo button')].find((x) => x.textContent.trim() === '✕')?.click());
      await page.fill('#pg-eye .search input', 'ein154');
      await page.keyboard.press('Enter');
      check(await until(page, () => /EIN154/.test(document.querySelector('#pg-eye .eyeinfo:not([hidden])')?.textContent ?? '') && document.querySelector('#pg-eye .searchlist').hidden, null, 5000), `${T} [d search] an exact call sign did not go straight to its card`);
      await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyeinfo button')].find((x) => x.textContent.trim() === '✕')?.click());
    }
  }
  // e. the camera wall: pin the Strand's camera, open the wall, take it off
  {
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: true }));
    await page.evaluate(() => { const c = window.__ghosty.globe.cam; c.fly = null; c.follow = null; Object.assign(c, { lat: 51.511, lon: -0.123, range: 3 }); c.target = { lat: 51.511, lon: -0.123, range: 3, tilt: 0, hd: 0 }; });
    const grid = await until(page, () => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, 30000);
    if (check(grid, `${T} [e wall] the cameras' grid never showed on the Strand`)) {
      await page.evaluate(() => document.querySelector('#pg-eye .camgrid:not([hidden]) .camview')?.click());
      const pin = await until(page, () => !!document.querySelector('#pg-eye .eyeinfo:not([hidden]) button[data-act="pin"]'), null, 8000);
      if (check(pin, `${T} [e wall] the camera's card has no PIN TO WALL`)) {
        await page.evaluate(() => document.querySelector('#pg-eye .eyeinfo button[data-act="pin"]')?.click());
        check(/on your wall/i.test(await text(page, '#pg-eye .eyeinfo button[data-act="pin"]')), `${T} [e wall] PIN TO WALL did not say it is on the wall: "${await text(page, '#pg-eye .eyeinfo button[data-act="pin"]')}"`);
        const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.eye.wall') ?? '[]'));
        check(kept.length === 1 && /Strand/.test(kept[0].name), `${T} [e wall] the wall kept: ${JSON.stringify(kept).slice(0, 120)}`);
        await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyeinfo button')].find((x) => x.textContent.trim() === '✕')?.click());
        await page.evaluate(() => [...document.querySelectorAll('#pg-eye .eyebot .btns button')].find((b) => /^wall$/i.test((b.dataset.label || b.textContent).trim()))?.click());
        const live = await until(page, () => window.__ghosty?.wall?.open && document.querySelectorAll('.wall .walltile').length === 1 && !document.querySelector('.wall .wallstamp[data-state]'), null, 10000);
        check(live, `${T} [e wall] the wall did not show its camera live: "${await text(page, '.wall')}"`);
        await still(page);
        const b = await bar(page, '.wall');
        check(!b.length, `${T} [e wall] ${b.join(', ')}`);
        if (vp === PHONE) await page.screenshot({ path: `${out}/seetrip-wall-${vp.width}.png` }).catch(() => undefined);
        await page.evaluate(() => document.querySelector('.wall button[data-act="edit"]')?.click());
        await page.evaluate(() => document.querySelector('.wall button[data-act="off"]')?.click());
        check(await until(page, (w) => document.querySelector('.wall .wallnote')?.textContent === w, WALL_EMPTY, 5000), `${T} [e wall] the empty wall reads "${await text(page, '.wall .wallnote')}"`);
        await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
      }
    }
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: false }));
  }
  // b. no signal: the planner offers the kept journey, which opens with its warning
  await ctx.setOffline(true);
  await page.evaluate(() => window.__ghosty.run('journey_planner', {}));
  const off = await until(page, () => document.querySelector('.jerr')?.dataset.state === 'offline' && !!document.querySelector('.jres .jopt'), null, 8000);
  check(off, `${T} [b offline] with no signal the planner says: "${await text(page, '.jform')}"`);
  check(/No signal, so I can’t plan a new journey\. Your last one is kept on this phone, below\./.test(await text(page, '.jerr')), `${T} [b offline] the planner's line reads "${await text(page, '.jerr')}"`);
  await page.evaluate(() => document.querySelector('.jres .jopt')?.click());
  const stale = await until(page, () => /No signal: this journey was planned (today|on) .* so its times may be out of date\./.test(document.querySelector('.jsheet .jstale')?.textContent ?? ''), null, 8000);
  check(stale, `${T} [b offline] the kept journey opened without its warning: "${await text(page, '.jsheet')}"`);
  await still(page);
  const b2 = await bar(page, '.jsheet');
  check(!b2.length, `${T} [b offline] ${b2.join(', ')}`);
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  await ctx.close();
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `SEE next round clean: ${checks} checks in ${secs} s: GETTING THERE on an appointment says when to leave, the weather there, the roads and the cameras on the way, by a tap or by words, never with his position finer than a kilometre; the journey is kept on the phone and, with no signal, opens on the offline map with its times marked as possibly out of date.`);
process.exit(problems.length ? 1 : 0);
