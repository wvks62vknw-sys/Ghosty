// HEALTH HUB (APPS ROUND, docs/build-plan/APPS-BODY.md), at 440 × 956 and 390 × 844, kept on the phone:
//   a. THE FIRST RUN: a sample marked as one, a three-step tour, the rings, a card for each measure, highlights, sleep stages,
//      workouts; GOT IT puts the tour away for good;
//   b. A CARD: its chart from a day to all time (the range keys and a pinch), the average, lowest and highest, weight's trend line;
//   c. THE SHORTCUT: "#body?hub=steps=8421,…" keeps the day's totals (the sample goes), the Steps tracker gets them too; a paste works;
//   d. THE EXPORT: every type read (steps from the source that counted most, kJ and lb converted, sleep stages, a workout), and a
//      second export reads only the newer days;
//   e. THE PDF for an appointment, highlights never advice; the chat; nothing sideways, every key 44 pt, offline in his words.
//   BASE=http://localhost:8788 node tests/healthhub.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 260)}`);
  }
};
const planCalls = [];
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d/i;
const VIEWPORTS = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
await standDown(base, KEY);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
/** The stood-in forecast: dry and 15°C at 17:00, wet and 9°C otherwise, sunset 19:40. */
const FORECAST = (day) => ({ current: { temperature_2m: 12, apparent_temperature: 11, relative_humidity_2m: 70, weather_code: 3, wind_speed_10m: 10, wind_direction_10m: 200, pressure_msl: 1012 }, hourly: { temperature_2m: Array.from({ length: 72 }, (_, i) => (i % 24 === 17 ? 15 : 9)), precipitation_probability: Array.from({ length: 72 }, (_, i) => (i % 24 === 17 ? 5 : 60)) }, daily: { temperature_2m_max: [15, 14, 13], temperature_2m_min: [6, 5, 4], precipitation_probability_max: [60, 50, 40], sunrise: [`${day}T07:20`], sunset: [`${day}T19:40`], uv_index_max: [1, 1, 1] } });
const brainDo = (pack, action, args) => fetch(`${base}/api/packs/do`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ pack, action, args }) }).then((r) => r.json());
const jobs = () => fetch(`${base}/api/agenda?days=2&tz=Europe%2FLondon`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()).then((j) => j.jobs ?? []);

// the day anchored to London's midnight in his own time (a run between 00:00 and 01:00 still passes)
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  // (every change the phone asks of the meal plan, so a red can say who changed it)
  page.on('request', (r) => { if (r.url().includes('/api/packs/do') && /"action":"plan"/.test(r.postData() ?? '') && /"days"|clear/.test(r.postData() ?? '')) planCalls.push(`${((Date.now() - t0) / 1000).toFixed(1)} s ${r.postData()?.slice(0, 160)}`); });
  await page.addInitScript(({ key, world, larder }) => {
    if (!sessionStorage.getItem('bn.seeded')) {
      localStorage.setItem('ghosty.ownerKey', key);
      localStorage.setItem('ghosty.themes1', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (larder) localStorage.setItem('ghosty.kitchen.larder', JSON.stringify(larder));
      sessionStorage.setItem('bn.seeded', '1');
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    window.__ghostyHeat = 18;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__off !== true });
  }, { key: KEY, world: o.world ?? 'scan', larder: o.larder ?? null });
  // (stand-ins at the phone's door go on before the page loads: once the service worker holds the page, a later route misses its calls)
  if (o.before) await o.before(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
async function open(page, id, pill) {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForFunction((t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, { timeout: 15000 }).catch(() => problems.push(`${id}: the screen did not open`));
  if (pill) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${pill}$`) }).first().click().catch(() => problems.push(`${id}: no "${pill}" pill`));
  await page.waitForSelector(`#pg-${id} .pn:not([hidden]) .pk > *`, { timeout: 8000 }).catch(() => problems.push(`${id}/${pill}: the page was not drawn`));
}
const PK = (id) => `#pg-${id} .pn:not([hidden]) .pk`;
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], summary)`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height };
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 5));
const sideways = (page, id) => page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} .pn:not([hidden]) *`)].some((e) => { if (!e.getClientRects().length) return false; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }), id);
async function bar(page, tag, id) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.evaluate((t) => document.querySelectorAll(`#pg-${t} .pn:not([hidden]) details`).forEach((d) => (d.open = true)), id);
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, PK(id));
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${PK(id)} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
/** Say `words` in the chat and wait for the first reply after his own message (found by its data-at) that matches `re`. */
async function ask(page, words, re = /\S/, ms = 15000) {
  await page.evaluate(() => (location.hash = 'core'));
  // (the chat's box shows once the log is open: opened if a screen before left it shut)
  if (!(await page.waitForSelector('#cin', { state: 'visible', timeout: 4000 }).then(() => true, () => false))) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.locator('.logbtn:visible').first().click().catch(() => undefined);
    await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
  }
  const at = await page.evaluate(() => Date.now());
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  const find = ({ at, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= at).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? r.textContent ?? '' : null;
  };
  const arg = { at, src: re.source, flags: re.flags, any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  if (got) return { ok: true, text: got };
  return { ok: false, text: (await page.evaluate(find, { ...arg, any: true }).catch(() => '')) ?? '' };
}


const H = `${PK('body')} .bt[data-track="hub"]`;
/** An Apple Health export, made here: two days (the iPhone and the Watch both counting steps), each type the hub reads. */
const exportXml = (days) => {
  const rec = (type, d, value, unit, extra = '') => `<Record type="${type}" sourceName="${extra || 'Watch'}" unit="${unit}" creationDate="${d} 21:00:00 +0000" startDate="${d} 08:00:00 +0000" endDate="${d} 08:30:00 +0000" value="${value}"/>`;
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<HealthData locale="en_GB">'];
  for (const [d, k] of days) {
    lines.push(rec('HKQuantityTypeIdentifierStepCount', d, 6000 + k, 'count', 'Watch'), rec('HKQuantityTypeIdentifierStepCount', d, 4000, 'count', 'Watch'), rec('HKQuantityTypeIdentifierStepCount', d, 7000, 'count', 'iPhone'));
    lines.push(rec('HKQuantityTypeIdentifierActiveEnergyBurned', d, 2092, 'kJ'), rec('HKQuantityTypeIdentifierRestingHeartRate', d, 61, 'count/min'), rec('HKQuantityTypeIdentifierRestingHeartRate', d, 57, 'count/min'));
    lines.push(rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', d, 40, 'ms'), rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', d, 50, 'ms'), rec('HKQuantityTypeIdentifierVO2Max', d, 41.5, 'mL/min·kg'), rec('HKQuantityTypeIdentifierBodyMass', d, 182, 'lb'));
    lines.push(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="${d} 01:00:00 +0000" endDate="${d} 02:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepDeep"/>`);
    lines.push(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="${d} 02:30:00 +0000" endDate="${d} 06:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>`);
    lines.push(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="${d} 06:30:00 +0000" endDate="${d} 07:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepREM"/>`);
    lines.push(`<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="31.5" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" totalEnergyBurned="320" totalEnergyBurnedUnit="kcal" sourceName="Watch" startDate="${d} 18:00:00 +0000" endDate="${d} 18:31:30 +0000"/>`);
  }
  lines.push('</HealthData>');
  return Buffer.from(lines.join('\n'));
};

for (const vp of VIEWPORTS) {
  const T = `[${vp.width}]`;
  const { ctx, page } = await phone(vp);
  // ---- a. the first run
  log(`first run ${vp.width}`);
  await open(page, 'body', 'Health');
  await page.waitForSelector(`${H} .hh-cards`);
  check((await page.getAttribute(`${H} [data-source]`, 'data-source')) === 'sample' && /Sample numbers/.test(await txt(page, `${H} [data-source]`)), `${T} the first run shows a sample, said as one`);
  check((await page.locator(`${H} [data-tour] li`).count()) === 3, `${T} a three-step tour on the first run`);
  check((await page.locator(`${H} .hh-cards > button`).count()) >= 12, `${T} a card for each measure (${await page.locator(`${H} .hh-cards > button`).count()})`);
  check((await page.locator(`${H} .hh-rings .hh-ringfill`).count()) === 3, `${T} three activity rings`);
  const hl = await txt(page, `${H} [data-hl]`);
  check(/Resting heart rate averaged .* over the last 30 days, \d+ bpm lower than the 30 days before/.test(hl) && !/\b(?:should|will|try|recommend|aim)\b/i.test(hl), `${T} highlights from his history, as what happened: "${hl.slice(0, 160)}"`);
  check((await page.locator(`${H} .hh-stages .hh-st`).count()) === 4 && Number(await page.getAttribute(`${H} [data-workouts]`, 'data-workouts')) > 5, `${T} sleep stages and workouts`);
  await page.screenshot({ path: `${out}/healthhub-${vp.width}.png` });
  await bar(page, `${T} health hub`, 'body');
  await page.locator(`${H} [data-tour] button`, { hasText: /^Got it$/ }).click();
  check(await until(page, (s) => !document.querySelector(`${s} [data-tour]`), H), `${T} GOT IT puts the tour away`);

  // ---- b. a card's chart
  log(`charts ${vp.width}`);
  await page.locator(`${H} button[data-card="weight"]`).click();
  check(await until(page, (s) => document.querySelector(`${s} .hh-chartbox`)?.dataset.range === 'M', H), `${T} a card opens its chart on the month`);
  check((await page.locator(`${H} .hh-chart .hh-trend`).count()) === 1, `${T} weight has its smoothed trend line`);
  check(/Average/.test(await txt(page, `${H} .bc-grid`)) && /Lowest/.test(await txt(page, `${H} .bc-grid`)), `${T} the average, the lowest and the highest`);
  const pts = {};
  for (const r of ['W', 'M', '6M', 'Y', 'A']) {
    await page.locator(`${H} .hh-ranges button[aria-label]`, { hasText: new RegExp(`^${r}$`) }).click();
    await until(page, ([s, rr]) => document.querySelector(`${s} .hh-chartbox`)?.dataset.range === rr, [H, r]);
    pts[r] = Number(await page.getAttribute(`${H} .hh-chartbox`, 'data-points'));
  }
  check(pts.W === 7 && pts.M === 30 && pts['6M'] === 26 && pts.Y === 53 && pts.A >= 17, `${T} a day a point to a month, a week's average beyond: ${JSON.stringify(pts)}`);
  // pinch: two fingers apart on the chart go to a closer range
  await page.evaluate((s) => {
    const box = document.querySelector(`${s} .hh-chartbox`);
    const t = (id, x) => new Touch({ identifier: id, target: box, clientX: x, clientY: 80 });
    box.dispatchEvent(new TouchEvent('touchstart', { touches: [t(1, 150), t(2, 170)], bubbles: true }));
    box.dispatchEvent(new TouchEvent('touchmove', { touches: [t(1, 100), t(2, 220)], bubbles: true }));
  }, H);
  check(await until(page, (s) => document.querySelector(`${s} .hh-chartbox`)?.dataset.range === 'Y', H), `${T} a pinch apart zooms in from all time to the year`);
  await bar(page, `${T} a chart`, 'body');
  await page.locator(`${H} button[aria-label="Back to all measures"]`).click();

  // ---- c. the Shortcut
  log(`shortcut ${vp.width}`);
  await page.evaluate(() => (location.hash = 'body?hub=steps=8421,kcal=420,ex=31,stand=10,rhr=58,hrv=44,sleep=7.5,deep=1.2,rem=1.5,core=4.3,awake=0.5'));
  check(await until(page, () => { const d = window.__ghosty?.hub?.data(); const k = Object.keys(d?.days ?? {}); return d && !d.sample && k.length === 1 && d.days[k[0]].steps === 8421 && d.days[k[0]].rhr === 58; }, null, 10000), `${T} the Shortcut's link keeps the day's totals, and the sample goes`);
  check(await until(page, () => (window.__ghosty?.track?.data().log.steps ?? []).some((e) => e.from === 'health' && e.v === 8421), null, 8000) || (await page.evaluate(() => !window.__ghosty?.track)), `${T} the Steps tracker gets the day too`);
  check(await until(page, (s) => document.querySelector(`${s} [data-source]`)?.dataset.source === 'shortcut', H), `${T} it says the Shortcut updated it`);
  await page.evaluate((s) => document.querySelectorAll(`${s} details`).forEach((d) => (d.open = true)), H);
  await page.fill(`${H} textarea[aria-label="Paste what the Shortcut copied"]`, 'd=2026-01-02\nSteps: 5100\nRHR: 60');
  await page.locator(`${H} button[aria-label="Keep the pasted totals"]`).click();
  check(await until(page, () => window.__ghosty.hub.data().days['2026-01-02']?.steps === 5100), `${T} a paste of the Shortcut's copy works too`);

  // ---- d. the export, then only its new days
  log(`export ${vp.width}`);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  await page.setInputFiles(`${H} input[type=file]`, { name: 'export.xml', mimeType: 'text/xml', buffer: exportXml([[day(3), 0], [day(2), 1]]) });
  check(await until(page, (dd) => { const x = window.__ghosty.hub.data().days[dd]; return x && x.steps === 10000 && x.kcal === 500 && x.rhr === 57 && x.hrv === 45 && x.vo2 === 41.5 && Math.abs(x.weight - 82.6) < 0.1 && x.deep === 1.5 && x.core === 4 && x.rem === 1 && x.sleep === 6.5; }, day(3), 15000), `${T} every type read: ${JSON.stringify(await page.evaluate((dd) => window.__ghosty.hub.data().days[dd], day(3)))}`);
  check((await page.evaluate(() => window.__ghosty.hub.data().workouts.filter((w) => w.kind === 'Running' && w.min === 32 && w.km === 5.2).length)) === 2, `${T} the workouts, with their time and distance`);
  await page.setInputFiles(`${H} input[type=file]`, { name: 'export.xml', mimeType: 'text/xml', buffer: exportXml([[day(10), 0], [day(1), 5]]) });
  check(await until(page, (dd) => window.__ghosty.hub.data().days[dd]?.steps === 10005, day(1), 15000), `${T} a second export reads its newer day`);
  check(!(await page.evaluate((dd) => !!window.__ghosty.hub.data().days[dd], day(10))), `${T} and not the days before the last one read`);

  // ---- e. the PDF, the chat, offline
  log(`pdf ${vp.width}`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator(`${H} button[aria-label^="Save a one-page summary PDF"]`).click()]);
  const bytes = dl ? await (await import('node:fs/promises')).readFile(await dl.path()) : Buffer.from('');
  check(!!dl && dl.suggestedFilename() === 'health-summary.pdf' && bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 800, `${T} a one-page summary PDF (${bytes.length} bytes)`);
  if (vp.width === 440) {
    let r = await ask(page, 'open health hub', /Health hub is open/);
    check(r.ok, `${T} "open health hub": "${r.text.slice(0, 120)}"`);
    r = await ask(page, 'my resting heart rate', /Resting heart rate: \d+ bpm on average over the last 30 days/);
    check(r.ok, `${T} "my resting heart rate": "${r.text.slice(0, 160)}"`);
  }
  await page.evaluate(() => (window.__off = true));
  await open(page, 'body', 'Mood');
  await open(page, 'body', 'Health');
  check(/No signal needed: everything here is on this phone/.test(await txt(page, `${H} [data-state="offline"]`)), `${T} offline, said in his words`);
  await ctx.close();
}

// ---- f. KITCHEN TIMERS ring on a locked phone: a timer of a minute or more is a one-off reminder on the brain's clock, taken back on CANCEL
{
  log('timers on the lock screen');
  const { ctx, page } = await phone(VIEWPORTS[0]);
  await open(page, 'kitchen', 'Timers');
  const KT = PK('kitchen');
  const t0 = await page.evaluate(() => Date.now());
  await page.fill(`${KT} input[aria-label="A new timer: how long and what for"]`, '2 minutes for the eggs');
  await page.locator(`${KT} button[aria-label="Set the timer"]`).click();
  check(await until(page, (t) => (window.__ghosty?.lockpush?.sent ?? []).some((x) => x.key.startsWith('timer:') && x.repeat === 'none' && /eggs/.test(x.text) && Math.abs(x.at - (t + 120000)) < 5000), t0, 10000), '[440] a two-minute timer also rings on the lock screen, at its end time');
  const n = await page.evaluate(() => window.__ghosty.lockpush.gone.length);
  await page.locator(`${KT} button[aria-label^="Cancel the"]`).first().click();
  check(await until(page, (k) => window.__ghosty.lockpush.gone.length > k, n, 8000), '[440] CANCEL takes the lock-screen ring back');
  // a preset, and one more minute (its lock-screen ring moved with it)
  await page.locator(`${KT} button[aria-label="A 10 minute timer for the pasta"]`).click();
  check(await until(page, () => window.__ghosty.timers().some((t) => t.name === 'pasta' && t.left > 590 && t.left <= 600)), '[440] PASTA 10 MIN starts a ten-minute timer');
  await until(page, () => (window.__ghosty.lockpush.sent ?? []).some((x) => /pasta/.test(x.text)), null, 8000);
  await page.locator(`${KT} button[aria-label="One more minute on the pasta timer"]`).click();
  check(await until(page, () => window.__ghosty.timers().some((t) => t.name === 'pasta' && t.left > 650)), '[440] +1 MIN adds a minute');
  check(await until(page, () => window.__ghosty.lockpush.sent.filter((x) => /pasta/.test(x.text)).length === 2, null, 8000), '[440] and the lock-screen ring moves with it');
  await bar(page, '[440] timers', 'kitchen');
  await page.evaluate(() => window.__ghosty.timers().forEach(() => undefined));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks} checks, ${problems.length} red, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
