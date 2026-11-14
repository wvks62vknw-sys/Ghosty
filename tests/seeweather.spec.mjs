// WEATHER, an app of its own (the APPS ROUND, SEE's flagship; apps/web/src/weather/{app,words}.ts; docs/build-plan/APPS-SEE.md), on the
// owner's 440 × 956 and a 390 × 844 phone, against the preview's real brain with the forecast stood in (no internet):
//   a. the Weather card (the App Kit's Home card) in the Brief opens it on home: the temperature, the sky, today's high and low, feels like, and Ghosty's dry line;
//   b. the next hour: the rain line for home ("Light rain at Birmingham in about … minutes") and its quarter hours;
//   c. the next 24 hours as a graph: a line of 24 points for temperature, 24 bars when RAIN is picked;
//   d. ten days, each with its range; the details (feels like, dew point, pressure and its trend, visibility, wind, UV, the sun, the
//      daylight gained, the moon, today against yesterday) and the air (quality, pollen);
//   e. his saved places as tabs (Home, Work): a tap shows Work; ADD a city ("Leeds") adds its tab; a city that cannot be found says so;
//   f. with no signal, the last forecast kept on the phone still shows, with its age, said in his words;
//   g. every key 44 pt, nothing sideways; and the words: "weather app", "open the weather", "10 day forecast" (read from source).
//   BASE=http://localhost:8788 node tests/seeweather.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
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
const W = await pure('apps/web/src/weather/words.ts');

// the stand-in forecast: from yesterday's midnight (past_days=1) through ten days, dry now and rain from twenty minutes on
function forecast(lat) {
  const h0 = Math.floor(Date.now() / 86400000) * 86400 - 86400;
  const hours = Array.from({ length: 24 * 11 }, (_, i) => h0 + i * 3600);
  const days = Array.from({ length: 11 }, (_, i) => h0 + i * 86400);
  const q0 = Math.floor(Date.now() / 900000) * 900;
  const warm = lat > 53 ? 0 : 2;
  return {
    current: { temperature_2m: 9 + warm, apparent_temperature: 6 + warm, relative_humidity_2m: 81, dew_point_2m: 6, weather_code: 3, wind_speed_10m: 22, wind_gusts_10m: 41, wind_direction_10m: 225, pressure_msl: 1004, visibility: 24000, uv_index: 1 },
    minutely_15: { time: Array.from({ length: 8 }, (_, i) => q0 + i * 900), precipitation: Array.from({ length: 8 }, (_, i) => (i >= 2 ? 0.5 : 0)) },
    hourly: { time: hours, temperature_2m: hours.map((t, i) => 6 + warm + 4 * Math.sin(i / 4)), precipitation_probability: hours.map((_, i) => (i * 7) % 100), precipitation: hours.map(() => 0.2), wind_speed_10m: hours.map((_, i) => 10 + (i % 12)), uv_index: hours.map((_, i) => Math.max(0, 3 * Math.sin(((i % 24) - 6) / 4))), pressure_msl: hours.map((_, i) => 1010 - i * 0.05) },
    daily: { time: days, weather_code: days.map((_, i) => [3, 61, 2, 0, 80, 3, 45, 61, 1, 2, 3][i]), temperature_2m_max: days.map((_, i) => 10 + (i % 4) + warm), temperature_2m_min: days.map((_, i) => 3 + (i % 3) + warm), precipitation_probability_max: days.map((_, i) => (i * 13) % 100), sunrise: days.map((d) => d + 7 * 3600 + 20 * 60), sunset: days.map((d) => d + 16 * 3600 + 10 * 60), uv_index_max: days.map(() => 1), daylight_duration: days.map((_, i) => 31000 - i * 120) },
  };
}
const AIR = { current: { european_aqi: 24, pm2_5: 6, alder_pollen: 0, birch_pollen: 2, grass_pollen: 35 } };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const asked = [];
  await ctx.route('**/api/proxy?**', (route) => {
    const target = decodeURIComponent(new URL(route.request().url()).searchParams.get('url') ?? '');
    asked.push(target);
    if (/air-quality-api\.open-meteo\.com/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(AIR) });
    if (/geocoding-api\.open-meteo\.com/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(/name=Leeds/i.test(target) ? { results: [{ name: 'Leeds', latitude: 53.8, longitude: -1.55, country: 'United Kingdom' }] } : {}) });
    // (only the app's own ask, in unix time; the Brief's own weather is not this spec's and gets no answer)
    if (/api\.open-meteo\.com/.test(target) && /timeformat=unixtime/.test(target)) {
      const lat = Number(/latitude=([\d.-]+)/.exec(target)?.[1] ?? 52);
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(forecast(lat)) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await ctx.route(/\/api\/profile\/places$/, (route) => route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ places: [{ id: 'home', label: 'Home', query: 'Moseley', address: 'Moseley, Birmingham', lat: 52.445, lon: -1.888 }, { id: 'work', label: 'Work', query: 'Colmore Row', address: 'Colmore Row, Birmingham', lat: 52.481, lon: -1.9 }] }) }) : route.fallback());
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
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`[${viewport.width}] the boot never ended`));
  return { ctx, page, asked };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const text = (page, sel) => page.evaluate((s) => (document.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' ').trim(), sel);
const bar = (page, scope) =>
  page.evaluate((scope) => {
    const bad = [];
    const shows = (e) => !e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    for (const b of document.querySelectorAll(`${scope} button, ${scope} input`)) {
      if (!shows(b)) continue;
      const r = { width: b.offsetWidth, height: b.offsetHeight };
      if (r.width < 43.5 || r.height < 43.5) bad.push(`key "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${r.width}×${r.height}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`the page scrolls sideways (${document.documentElement.scrollWidth})`);
    for (const e of document.querySelectorAll(`${scope} *`)) {
      if (!shows(e) || e.closest('svg')) continue;
      let inner = false;
      for (let p = e.parentElement; p && !p.matches(scope); p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) inner = true;
      const r = e.getBoundingClientRect();
      if (!inner && r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) bad.push(`sideways <${e.tagName.toLowerCase()}.${[...e.classList].join('.')}> "${(e.textContent || '').trim().slice(0, 20)}"`);
    }
    return [...new Set(bad)].slice(0, 6);
  }, scope);

// g. the words, and the pure sums
{
  for (const t of ['weather app', 'open the weather', 'Open weather', 'show me the weather app', '10 day forecast', 'ten-day forecast', 'hourly forecast']) check(W.WEATHER_ASK.test(t), `[g words] "${t}" is not the weather app`);
  for (const t of ['what is the weather like', 'will it rain today', 'weather in Paris tomorrow']) check(!W.WEATHER_ASK.test(t), `[g words] "${t}" was taken as the weather app`);
  check(W.pressureTrend(1004, 1007) === 'falling' && W.pressureTrend(1010, 1008) === 'rising' && W.pressureTrend(1010, 1010.5) === 'steady', '[g sums] the pressure trend');
  check(W.daylightLine(31000, 31122) === '−2 min 2 s of daylight on yesterday', `[g sums] daylight reads "${W.daylightLine(31000, 31122)}"`);
  check(W.againstYesterday(11.2, 8.9) === '2° warmer than yesterday at this time.', `[g sums] against yesterday reads "${W.againstYesterday(11.2, 8.9)}"`);
  const full = W.moonPhase(Date.UTC(2026, 10, 24, 12));
  check(/Full moon|Waxing gibbous|Waning gibbous/.test(full.name) && full.lit > 0.85, `[g sums] the moon on 24 Nov 2026 reads ${JSON.stringify(full)}`);
  check(W.pollenWord(35) === 'moderate' && W.uvWord(7) === 'high', '[g sums] the pollen and UV words');
}

for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  log(`${T} weather`);
  const { ctx, page, asked } = await phone(vp);
  // a. from the Brief
  await page.evaluate(() => (location.hash = 'brief'));
  const key = await until(page, () => !!document.querySelector('#pg-brief button.ak-card[data-act="weather"]'), null, 15000);
  if (!check(key, `${T} [a open] the Brief's weather has no Weather card (tab ${await page.evaluate(() => document.body.dataset.tab)}, wx ${await page.evaluate(() => !!document.querySelector(".pn.wx"))}, btns ${await page.evaluate(() => document.querySelectorAll("button[data-act=weather]").length)})`)) {
    await ctx.close();
    continue;
  }
  await page.evaluate(() => document.querySelector('#pg-brief button[data-act="weather"]')?.click());
  const ready = await until(page, () => window.__ghosty?.weatherApp?.state === 'ready' && !!document.querySelector('.wxapp .wxday'), null, 15000);
  if (check(ready, `${T} [a open] the weather app never showed home: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.weatherApp))} "${(await text(page, '.wxapp')).slice(0, 200)}"`)) {
    const hero = await text(page, '.wxapp .wxhero');
    check(/^11°C\s*Overcast\s*H 1\d°C · L \d°C · feels like 8°C/.test(hero) && hero.length > 40, `${T} [a now] the hero reads "${hero}"`);
    check(await page.evaluate(() => !!document.querySelector('.wxapp .wxdry')?.textContent.trim()), `${T} [a now] no dry line`);
    // b. the next hour
    check(/^Light rain at Home in about (15|20|25|30) minutes\.$/.test(await text(page, '.wxapp .wxrain')), `${T} [b hour] the rain line reads "${await text(page, '.wxapp .wxrain')}"`);
    check((await page.evaluate(() => document.querySelectorAll('.wxapp .wxq').length)) === 4, `${T} [b hour] not four quarter hours`);
    // c. the graph
    const pts = await page.evaluate(() => (document.querySelector('.wxapp .wxgraph .wxline')?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).length);
    check(pts === 24, `${T} [c graph] the temperature line has ${pts} points (want 24)`);
    await page.evaluate(() => document.querySelector('.wxapp .wxseg button[data-kind="rain"]')?.click());
    check((await page.evaluate(() => document.querySelectorAll('.wxapp .wxgraph.wx-rain .wxbar').length)) === 24, `${T} [c graph] RAIN does not draw 24 bars`);
    // d. ten days, the details, the air
    check((await page.evaluate(() => document.querySelectorAll('.wxapp .wxday').length)) === 10, `${T} [d days] not ten days`);
    const det = await text(page, '.wxapp .wxgrid');
    for (const k of ['FEELS LIKE', 'DEW POINT', 'PRESSURE', 'falling', 'VISIBILITY', '24 km+', 'WIND', 'gusts 41 km/h', 'UV', 'SUNRISE', 'DAYLIGHT', 'of daylight on yesterday', 'MOON', '% lit', 'AGAINST YESTERDAY']) check(det.includes(k), `${T} [d details] "${k}" is missing: "${det.slice(0, 300)}"`);
    const air = await text(page, '.wxapp');
    check(/AIR QUALITY/.test(air) && /grass moderate/.test(air), `${T} [d air] the air reads "${air.slice(air.indexOf('AIR QUALITY'), air.indexOf('AIR QUALITY') + 120)}"`);
    await page.waitForTimeout(400);
    const b = await bar(page, '.wxapp');
    check(!b.length, `${T} [g keys] ${b.join(', ')}`);
    if (vp === PHONE) await page.screenshot({ path: `${out}/seeweather-${vp.width}.png`, fullPage: false }).catch(() => undefined);
    // e. the places: Work, then a city added
    check(/HomeWork/i.test((await text(page, '.wxapp .wxplaces')).replace(/\s/g, '')), `${T} [e places] the tabs read "${await text(page, '.wxapp .wxplaces')}"`);
    await page.evaluate(() => document.querySelector('.wxapp .wxplaces button[data-place="work"]')?.click());
    check(await until(page, () => window.__ghosty.weatherApp.place === 'Work' && window.__ghosty.weatherApp.state === 'ready', null, 8000), `${T} [e places] Work did not show`);
    await page.fill('.wxapp .wxcity', 'Leeds');
    await page.keyboard.press('Enter');
    check(await until(page, () => window.__ghosty.weatherApp.place === 'Leeds' && /Leeds/.test(document.querySelector('.wxapp .wxplaces')?.textContent ?? ''), null, 8000), `${T} [e places] Leeds was not added: "${await text(page, '.wxapp .wxplaces')}"`);
    await page.fill('.wxapp .wxcity', 'Zzqxville');
    await page.keyboard.press('Enter');
    check(await until(page, (w) => document.querySelector('.wxapp .wxstatus')?.textContent === w, W.WX_CITY_NONE('Zzqxville'), 8000), `${T} [e places] a city not found reads "${await text(page, '.wxapp .wxstatus')}"`);
    // his position never asked: only his saved places and the named city
    check(!asked.some((u) => /latitude=52\.4[0-9]{2}.*longitude=-1\.8[0-9]{2}/.test(u) && !/52\.445/.test(u)), `${T} [g rules] a forecast was asked for a place he did not save`);
    // f. no signal: the kept forecast, with its age
    await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
    await ctx.setOffline(true);
    await page.evaluate(() => document.querySelector('#pg-brief button[data-act="weather"]')?.click());
    const off = await until(page, () => window.__ghosty.weatherApp.state === 'offline' && !!document.querySelector('.wxapp .wxday'), null, 10000);
    check(off && /^No signal: this is the forecast from \d\d:\d\d\.$/.test(await text(page, '.wxapp .wxstatus')), `${T} [f offline] with no signal it reads "${await text(page, '.wxapp .wxstatus')}"`);
    await ctx.setOffline(false);
  }
  await ctx.close();
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `SEE weather clean: ${checks} checks in ${secs} s: the weather app shows now, the next hour, 24 hours as a graph, ten days, the details and the air for every saved place and any city, keeps each forecast for no signal, and is asked only about the places shown.`);
process.exit(problems.length ? 1 : 0);
