// The Brief on the owner's phone (440 × 956) at 07:00 on a Monday, as he reads it first thing (and once at
// 1280 × 800): every source it draws on is stood in here (the weather and air from Open-Meteo, the BBC's
// headlines, the diary and reminders, the inbox, the saved places and the drive to work, the library's morning
// digest), so the spec never depends on what else is on the preview. Checked (BRIEF-UPGRADE-PASS):
//  1. YOUR DAY leads the page: the rest of today's diary and reminders (not what is over, not tomorrow), the
//     inbox's new messages, 44 pt rows that open the Agenda.
//  2. The hero greets him with the date and says the day in one plain sentence (rain from when, the diary, the drive).
//  3. READ IT TO ME and BRIEF ME are in the hero, on the first screen, 44 pt; READ IT TO ME says the Brief aloud
//     with no model; BRIEF ME hands the chat the facts.
//  4. The morning's weather is kept on the phone: reopened with Open-Meteo unreachable it shows "as of".
//  5. With no weather at all the hero says why instead of going blank.
//  6. RAIN says when, in words; no air pressure in hPa; the UV with its band.
//  7. The commute comes after YOUR DAY, its whole line shown; offline it says so (never an old LIVE time);
//     a failure is said in plain words.
//  8. With no saved home and work, one line says where to save them (a tap opens Memory).
//  9. The digest's "Today in one line", and its headlines when the BBC can't be reached.
// 10. What Ghosty is told is on screen carries the day's facts.
// 11. FORESIGHT comes after the commute: today's expectations with the confidence as a word, yesterday's line, the score.
// No page errors, nothing sideways.
//   BASE=http://localhost:<port> node tests/brief.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const check = (n, ok, what) => ok || problems.push(`[${n}] ${what}`);

// Monday 26 October 2026, 07:00 in London (GMT by then).
const NOW = Date.parse('2026-10-26T07:00:00Z');
const at = (iso) => Date.parse(iso);

// ---- the stand-ins
const hours = (f) => Array.from({ length: 72 }, (_, i) => f(i % 24, i));
const FORECAST = {
  latitude: 52.48, longitude: -1.9, timezone: 'Europe/London',
  current: { time: '2026-10-26T07:00', temperature_2m: 9.6, apparent_temperature: 7.2, relative_humidity_2m: 88, weather_code: 61, wind_speed_10m: 14, wind_direction_10m: 225, pressure_msl: 1003.4 },
  hourly: { time: hours((h, i) => `2026-10-${26 + Math.floor(i / 24)}T${String(h).padStart(2, '0')}:00`), temperature_2m: hours((h) => 6 + Math.round(7 * Math.sin(((h - 6) / 24) * Math.PI))), precipitation_probability: hours((h) => (h >= 9 && h <= 12 ? 70 : h < 9 ? 10 : 20)) },
  daily: { time: ['2026-10-26', '2026-10-27', '2026-10-28'], temperature_2m_max: [13.4, 12, 11], temperature_2m_min: [5.8, 6, 5], precipitation_probability_max: [70, 30, 20], sunrise: ['2026-10-26T06:50', '2026-10-27T06:52', '2026-10-28T06:54'], sunset: ['2026-10-26T16:40', '2026-10-27T16:38', '2026-10-28T16:36'], uv_index_max: [1.4, 1, 1] },
};
const AIR = { current: { european_aqi: 18, pm2_5: 4, pm10: 7, nitrogen_dioxide: 12, ozone: 40 } };
const RSS = `<?xml version="1.0"?><rss><channel>${Array.from({ length: 10 }, (_, i) => `<item><title>Live story ${i + 1}</title><description>About story ${i + 1}</description><link>https://www.bbc.co.uk/news/${i}</link><pubDate>${new Date(NOW - (i + 1) * 1800e3).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
const AGENDA = {
  tz: 'Europe/London',
  errors: [],
  feeds: [],
  events: [
    { id: 'e0', title: 'Early run', start: at('2026-10-26T06:00:00Z'), end: at('2026-10-26T06:45:00Z'), source: 'mine' },
    { id: 'e1', title: 'Dentist', start: at('2026-10-26T09:30:00Z'), end: at('2026-10-26T10:00:00Z'), location: 'High Street', source: 'mine' },
    { id: 'e2', title: 'Team call', start: at('2026-10-26T14:00:00Z'), source: 'mine' },
    { id: 'e3', title: 'Gym', start: at('2026-10-27T08:00:00Z'), source: 'mine' },
  ],
  jobs: [
    { id: 'j1', kind: 'reminder', title: 'Take the bins out', text: 'Take the bins out', next: at('2026-10-26T19:00:00Z'), repeat: 'none', tz: 'Europe/London' },
    { id: 'j2', kind: 'reminder', title: 'Dentist in 30 min', text: 'Dentist', next: at('2026-10-26T09:00:00Z'), repeat: 'none', tz: 'Europe/London', eventId: 'e1' },
    { id: 'j3', kind: 'reflect', title: 'Reflect', text: '', next: at('2026-10-27T03:20:00Z'), repeat: 'daily', tz: 'Europe/London' },
  ],
};
// What the brain's one shared mind (apps/edge/src/mind.ts, GET /api/mind) makes of AGENDA at 07:00 — the Brief shows his
// day from it, the same picture the chat's context is made from: the rest of today only. (Leaving out the run that is
// over, tomorrow's gym, the Dentist's own reminder and the nightly job is the brain's rule now: checked on this same
// agenda in apps/edge/test/mind.test.mjs.)
const MIND = {
  at: NOW,
  owner: { name: 'boss', summary: '', lines: [], facts: [], rules: [], principles: [] },
  now: { iso: '2026-10-26T07:00', weekday: 'Mon', tz: 'Europe/London', day: '2026-10-26' },
  today: {
    day: '2026-10-26',
    items: [
      { at: at('2026-10-26T09:30:00Z'), end: at('2026-10-26T10:00:00Z'), when: '09:30', title: 'Dentist', where: 'High Street', kind: 'event' },
      { at: at('2026-10-26T14:00:00Z'), when: '14:00', title: 'Team call', kind: 'event' },
      { at: at('2026-10-26T19:00:00Z'), when: '19:00', title: 'Take the bins out', kind: 'reminder' },
    ],
    doing: [],
  },
  recent: [],
  ahead: [],
  can: [],
};
const PLACES = [
  { id: 'home', label: 'Home', query: 'B13', address: 'Kings Heath, Birmingham', lat: 52.4351, lon: -1.8912, at: 1 },
  { id: 'work', label: 'Work', query: 'B15', address: 'Edgbaston, Birmingham', lat: 52.4531, lon: -1.9416, at: 1 },
];
const LIVE_DRIVE = { minutes: 24, km: 6.1, delayMin: 5, live: true, line: '24 min by car now, 5 min of it traffic (TomTom live)' };
// What the brain's foresight ledger (apps/edge/src/foresight.ts, GET /api/foresight) says at 07:00: today's rain and train open.
const FORESIGHT = {
  items: [
    { id: 'r', at: at('2026-10-26T06:00:00Z'), kind: 'rain', subject: 'rain at Home 12:00–18:00', expect: 'rain by 09:00', confidence: 0.7, by: at('2026-10-26T18:30:00Z') },
    { id: 'd', at: at('2026-10-26T06:00:00Z'), kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'on time', confidence: 0.6, by: at('2026-10-26T08:15:00Z') },
    { id: 'y', at: at('2026-10-25T06:00:00Z'), kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'late by 3 min or more', confidence: 0.7, by: at('2026-10-25T08:15:00Z'), outcome: { at: at('2026-10-25T08:15:00Z'), actual: '6 minutes late', right: true, how: 'feed', value: 360 } },
  ],
  expect: ['I expect the 08:12 on time (60%)', 'I expect rain by 09:00 (70%)'],
  yesterday: 'Yesterday: right 1 of 1 — I expected the 08:12 late; it was, by 6 minutes.',
  calibration: { rain: { n: 0, right: 0, share: 0 }, departure: { n: 1, right: 1, share: 1 }, commute: { n: 0, right: 0, share: 0 }, answer: { n: 0, right: 0, share: 0 }, all: { n: 1, right: 1, share: 1 } },
  score: "I keep score: I've only scored 1 so far about trains.",
  notes: ['The commute needs the free TomTom key, SYSTEM → KEYS.'],
  tz: 'Europe/London',
};
const FREE_DRIVE = { minutes: 12, km: 5.4, delayMin: 0, live: false, line: 'about 12 min by car with clear roads (no live traffic: add the free TomTom key in System for it)' };
const DIGEST = [
  { rid: 11, heading: '2026-10-25 · BBC News', text: 'Fresh knowledge 2026-10-25 — BBC News (feeds.bbci.co.uk):\n- Yesterday story — old news', page: null },
  { rid: 12, heading: '2026-10-26 · BBC News', text: 'Fresh knowledge 2026-10-26 — BBC News (feeds.bbci.co.uk):\n- Digest story one — what happened first\n- Digest story two — and then this\n- Digest story three — and this too', page: null },
  { rid: 13, heading: '2026-10-26 · in three levels', text: 'Fresh knowledge 2026-10-26 — the day in three levels:\nIn one line: Storms close the M5 as the clocks go back.\nIn more detail: More.\nFor an expert: Detail.', page: null },
];
const DOC = { id: 'notes_daily', title: 'Fresh knowledge', source: 'gathered daily by Ghosty', kind: 'notes', pages: 0, passages: DIGEST.length, chars: DIGEST.reduce((n, p) => n + p.text.length, 0), status: 'ready', builtin: false, at: NOW };

/** One phone (or desktop) with the stand-ins; `down` names sources answering with an error. */
async function open(browser, { viewport = PHONE, places = PLACES, drive = LIVE_DRIVE, down = new Set() } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: viewport === PHONE, isMobile: viewport === PHONE });
  const page = await ctx.newPage();
  const seen = { chat: [], tts: [], spoken: [], errors: [] };
  page.on('pageerror', (e) => webkitNoise(e) || seen.errors.push(e.message));
  // The clock reads 07:00 on Monday and keeps going (the page's timers stay real).
  await page.addInitScript((now) => {
    const off = now - Date.now();
    const Real = Date;
    globalThis.Date = class extends Real {
      constructor(...a) {
        super(...(a.length ? a : [Real.now() + off]));
      }
      static now() {
        return Real.now() + off;
      }
    };
    // The phone's voice, heard here as text (it ends at once).
    window.__spoken = [];
    if ('speechSynthesis' in window) {
      speechSynthesis.speak = (u) => {
        window.__spoken.push(u.text);
        setTimeout(() => u.onend?.(new Event('end')), 5);
      };
    }
  }, NOW);
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/api\/proxy\?/, (r) => {
    const u = new URL(r.request().url()).searchParams.get('url') ?? '';
    if (/air-quality-api\.open-meteo/.test(u)) return down.has('weather') ? r.fulfill({ status: 502, body: 'down' }) : json(r, AIR);
    if (/api\.open-meteo\.com/.test(u)) return down.has('weather') ? r.fulfill({ status: 502, body: 'down' }) : json(r, FORECAST);
    if (/bbci\.co\.uk/.test(u)) return down.has('bbc') ? r.fulfill({ status: 502, body: 'down' }) : r.fulfill({ status: 200, contentType: 'application/rss+xml', body: RSS });
    return r.fulfill({ status: 404, body: 'not in this spec' });
  });
  await page.route(/\/api\/agenda\?/, (r) => (down.has('agenda') ? json(r, { error: 'down' }, 500) : json(r, AGENDA)));
  await page.route(/\/api\/mind\?/, (r) => (down.has('agenda') ? json(r, { error: 'down' }, 500) : json(r, MIND)));
  await page.route(/\/api\/inbox$/, (r) => json(r, { items: [], unread: 2 }));
  await page.route(/\/api\/profile\/places$/, (r) => json(r, { places }));
  await page.route(/\/api\/traffic\/commute\//, (r) => (down.has('drive') ? json(r, { error: 'the route service answered 502' }, 502) : json(r, drive)));
  await page.route(/\/api\/foresight\?/, (r) => json(r, FORESIGHT));
  await page.route(/\/api\/library$/, (r) => json(r, { docs: [DOC], stats: { docs: 1, passages: DIGEST.length, chars: DOC.chars, bytes: 0, vectors: 0 }, starterReady: true, vectors: false, spare: true }));
  await page.route(/\/api\/library\/docs\/notes_daily\/passages/, (r) => json(r, { passages: DIGEST, next: null }));
  await page.route(/\/api\/tts$/, (r) => {
    seen.tts.push(r.request().postDataJSON()?.text ?? '');
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no voice in this spec"}' });
  });
  await page.route(/\/api\/chat$/, (r) => {
    seen.chat.push(r.request().postDataJSON());
    return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ type: 'text', text: 'Morning.' })}\n${JSON.stringify({ type: 'done' })}\n` });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  return { ctx, page, seen, down };
}
const toBrief = async (page) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = 'brief'));
  await page.waitForSelector('#pg-brief .hero .brdate', { timeout: 10000 }).catch(() => undefined);
};
const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);
const sideways = async (page, where) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > (page.viewportSize()?.width ?? 0)) problems.push(`[layout] ${where} scrolls sideways (${w} px)`);
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// ======== A. 07:00, everything answering, home and work saved, the drive live.
{
  const { page, seen, ctx } = await open(browser);
  // A reload once paired: the phone copies the library (the digest) at start-up, as it does every morning.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => undefined);
  const t0 = Date.now();
  await toBrief(page);
  const shown = await page.waitForFunction(() => /rain likely from 09:00/i.test(document.querySelector('#pg-brief .hero .brsay')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true, () => false);
  const firstLine = Date.now() - t0;
  await page.waitForFunction(() => /24 min to work/.test(document.querySelector('#pg-brief .hero .brsay')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('#pg-brief .pn.news .brone')?.hidden, null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/brief-morning.png` });
  console.log(shown ? `the day's sentence showed ${firstLine} ms after the Brief was opened` : 'the day\'s sentence never showed');

  // 1. YOUR DAY first, today's rest only, the inbox, 44 pt rows.
  const order = await page.$$eval('#pg-brief .col .pn:not([hidden])', (ps) => ps.map((p) => p.className.split(' ').find((c) => ['brday', 'commute', 'wx', 'news'].includes(c)) ?? p.className));
  check(1, order[0] === 'brday', `the first card is ${order[0]} (order: ${order.join(', ')}), not YOUR DAY`);
  const day = await text(page, '#pg-brief .pn.brday');
  check(1, /09:30\s*Dentist/.test(day) && /14:00\s*Team call/.test(day) && /19:00\s*Take the bins out/.test(day), `YOUR DAY does not list today's rest: ${day}`);
  check(1, !/Early run|Gym|Dentist in 30 min|Reflect/.test(day), `YOUR DAY lists what is over, tomorrow's, an event's own reminder or a background job: ${day}`);
  check(1, /2 new messages/.test(day), `YOUR DAY does not say the inbox has 2 new: ${day}`);
  const dayRows = await page.$$eval('#pg-brief .pn.brday .rw.link', (rs) => rs.map((r) => Math.round(r.getBoundingClientRect().height)));
  check(1, dayRows.length >= 4 && dayRows.every((hgt) => hgt >= 44), `YOUR DAY's rows are not 44 pt taps: ${dayRows.join(', ')}`);

  // 2. The greeting, the date, the sentence.
  check(2, (await text(page, '#pg-brief .hero .brdate')) === 'Good morning · Monday 26 October', `the hero's date line reads "${await text(page, '#pg-brief .hero .brdate')}"`);
  const say = await text(page, '#pg-brief .hero .brsay');
  check(2, /6 to 13°C today, rain likely from 09:00\./.test(say) && /3 things today, first Dentist at 09:30\./.test(say) && /24 min to work, 5 min of it traffic\./.test(say), `the hero's sentence reads "${say}"`);

  // 3. READ IT TO ME and BRIEF ME on the first screen, 44 pt.
  const acts = await page.$$eval('#pg-brief .hero .bract button', (bs) => bs.map((b) => ({ t: b.textContent, h: Math.round(b.getBoundingClientRect().height), bottom: Math.round(b.getBoundingClientRect().bottom) })));
  const bar = await page.evaluate(() => document.querySelector('#dock .tabcap')?.getBoundingClientRect().top ?? innerHeight);
  check(3, acts.length === 2 && acts.every((a) => a.h >= 44 && a.bottom <= Math.min(bar, 956)), `the hero's buttons: ${JSON.stringify(acts)} (the tab bar at ${Math.round(bar)})`);
  await page.click('#pg-brief .hero .bract button.brread', { timeout: 3000 }).catch(() => problems.push('[3] no READ IT TO ME in the hero'));
  await page.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  const heard = [...seen.tts, ...(await page.evaluate(() => window.__spoken))].join(' ');
  check(3, /Good morning\. It's Monday 26 October\./.test(heard) && /6 to 13 degrees today/.test(heard) && /Dentist/.test(heard) && /Live story 1\./.test(heard) && !/°|·/.test(heard), `READ IT TO ME said: "${heard.slice(0, 400)}"`);

  // 9. The digest's one line above the sections.
  const one = await text(page, '#pg-brief .pn.news .brone');
  check(9, /Today in one line\s*Storms close the M5 as the clocks go back\./.test(one), `no "Today in one line" from the digest: "${one}"`);

  // 6. RAIN in words, no hPa, the UV's band.
  const wx = await text(page, '#pg-brief .pn.wx');
  check(6, /RAIN\s*Likely from 09:00 · 70%/i.test(wx), `the weather card has no RAIN line in words: ${wx.slice(0, 300)}`);
  check(6, !/hPa|PRESSURE/i.test(wx), `the weather card still shows the air pressure: ${wx.slice(0, 300)}`);
  check(6, /UV\s*1 · low/i.test(wx), `the UV has no band: ${wx.slice(0, 300)}`);

  // 7. The commute straight after YOUR DAY, live.
  check(7, order[1] === 'commute', `the commute is not straight after YOUR DAY (order: ${order.join(', ')})`);
  check(7, /24 min by car now, 5 min of it traffic \(TomTom live\)/.test(await text(page, '#pg-brief .pn.commute')), 'the live drive is not shown');

  // 11. FORESIGHT after the commute: today's two in the order they come due, the confidence as a word; yesterday; the score.
  await page.waitForFunction(() => /Yesterday: right 1 of 1/.test(document.querySelector('#pg-brief .pn.foresight')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
  const after = await page.$$eval('#pg-brief .col .pn:not([hidden])', (ps) => ps.map((p) => (p.classList.contains('foresight') ? 'foresight' : p.className.split(' ').find((c) => ['brday', 'commute', 'wx', 'news'].includes(c)) ?? p.className)));
  check(11, after.indexOf('foresight') === after.indexOf('commute') + 1, `FORESIGHT is not straight after the commute (order: ${after.join(', ')})`);
  const fl = await page.$$eval('#pg-brief .pn.foresight .foreline .v', (vs) => vs.map((v) => v.textContent));
  check(11, fl.join(' | ') === 'I think: the 08:12 on time | Likely: rain by 09:00', `FORESIGHT's lines: ${fl.join(' | ')}`);
  const fs = await text(page, '#pg-brief .pn.foresight');
  check(11, fs.includes('Yesterday: right 1 of 1 — I expected the 08:12 late; it was, by 6 minutes.') && fs.includes("I keep score: I've only scored 1 so far about trains.") && fs.includes('The commute needs the free TomTom key, SYSTEM → KEYS.'), `FORESIGHT reads: ${fs}`);

  // 10. What Ghosty is told is on screen.
  const told = await page.evaluate(() => window.__ghosty?.brief?.describe?.() ?? '');
  check(10, /Monday 26 October/.test(told) && /rain likely from 09:00/.test(told) && /09:30 Dentist/.test(told), `the screen description reads "${told}"`);
  await sideways(page, 'the Brief at 07:00');

  // 3. BRIEF ME hands the chat the facts.
  await page.click('#pg-brief .hero .bract button.brme', { timeout: 3000 }).catch(() => problems.push('[3] no BRIEF ME in the hero'));
  await page.waitForFunction(() => location.hash === '#core', null, { timeout: 5000 }).catch(() => undefined);
  for (let i = 0; i < 20 && !seen.chat.length; i++) await page.waitForTimeout(250);
  const asked = String(seen.chat[0]?.message ?? '');
  check(3, /DIARY TODAY: 09:30 Dentist; 14:00 Team call; 19:00 Take the bins out/.test(asked) && /WEATHER: Light rain|WEATHER: Rain, 10°C/.test(asked) && /COMMUTE: 24 min to work/.test(asked) && /HEADLINES: Live story 1/.test(asked), `BRIEF ME asked: "${asked.slice(0, 500)}"`);

  // 7. Offline, the drive is not an old LIVE time.
  await ctx.setOffline(true);
  await toBrief(page);
  await page.waitForTimeout(800);
  const off = await text(page, '#pg-brief .pn.commute');
  check(7, /You’re offline: the drive time comes back with the connection/.test(off) && !/TomTom live|Live/.test(off), `offline the commute reads: ${off}`);
  await ctx.setOffline(false);

  // 4. Reopened with Open-Meteo, the BBC and the route service unreachable: the kept weather, "as of".
  const B = await open(browser, { down: new Set(['weather', 'bbc', 'drive']) });
  // (a second phone has nothing kept: copy this one's kept weather and its library copy is fetched at start-up)
  const kept = await page.evaluate(() => localStorage.getItem('ghosty.brief.wx'));
  check(4, !!kept, 'the weather was not kept on the phone');
  await B.page.evaluate((k) => k && localStorage.setItem('ghosty.brief.wx', k), kept);
  await B.page.reload({ waitUntil: 'domcontentloaded' });
  await B.page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => undefined);
  await toBrief(B.page);
  await B.page.waitForFunction(() => /as of/.test(document.querySelector('#pg-brief .hero .sub')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  await B.page.waitForFunction(() => /digest/i.test(document.querySelector('#pg-brief .pn.news h3')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  await B.page.waitForTimeout(500);
  const bHero = await text(B.page, '#pg-brief .hero');
  check(4, /10°C/.test(bHero) && /Rain · feels 7°C · as of \d\d:\d\d/.test(bHero), `with the weather unreachable the hero reads "${bHero}"`);
  check(4, /Not updating · \d\d:\d\d|Offline · \d\d:\d\d/i.test(await text(B.page, '#pg-brief .pn.wx h3')), `the weather card's status reads "${await text(B.page, '#pg-brief .pn.wx h3')}"`);
  // 9. The BBC unreachable: the digest's headlines, said where from.
  const news = await text(B.page, '#pg-brief .pn.news');
  check(9, /From this morning’s digest/i.test(news) && /Digest story one/.test(news) && !/Yesterday story/.test(news), `with the BBC unreachable the headlines read: ${news.slice(0, 300)}`);
  // 7. The route service down: plain words.
  const failed = await text(B.page, '#pg-brief .pn.commute');
  check(7, /The drive can’t be timed right now/.test(failed) && !/HTTP|502|answered/.test(failed), `a failed drive reads: ${failed}`);
  await B.page.screenshot({ path: `${out}/brief-unreachable.png` });
  await B.ctx.close();
  await ctx.close();
  if (seen.errors.length) problems.push(...seen.errors.map((e) => `pageerror: ${e}`));
}

// ======== C. Nothing saved, nothing kept, the weather unreachable; the free (not live) drive's long line.
{
  const { page, seen, ctx } = await open(browser, { places: [], down: new Set(['weather']) });
  await toBrief(page);
  await page.waitForFunction(() => /weather/i.test(document.querySelector('#pg-brief .hero .sub')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const sub = await text(page, '#pg-brief .hero .sub');
  check(5, /The weather can’t be reached right now|Getting the weather/.test(sub), `with no weather at all the hero says "${sub}"`);
  const invite = page.locator('#pg-brief .pn.commute .rw.link');
  check(8, /Save home and work in Memory → Me → Places/.test((await invite.textContent({ timeout: 3000 }).catch(() => '')) ?? ''), 'no line on where to save home and work');
  const ih = await invite.evaluate((r) => r.getBoundingClientRect().height, null, { timeout: 3000 }).catch(() => 0);
  check(8, ih >= 44, `the line to save places is ${ih} px tall`);
  await page.screenshot({ path: `${out}/brief-nothing.png` });
  await invite.click({ timeout: 3000 }).catch(() => undefined);
  await page.waitForFunction(() => location.hash === '#memory', null, { timeout: 5000 }).catch(() => problems.push('[8] the line to save places does not open Memory'));
  await ctx.close();
  if (seen.errors.length) problems.push(...seen.errors.map((e) => `pageerror: ${e}`));

  const D = await open(browser, { drive: FREE_DRIVE });
  await toBrief(D.page);
  await D.page.waitForFunction(() => /TomTom key in System for it\)/.test(document.querySelector('#pg-brief .pn.commute')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
  const cut = await D.page.$eval('#pg-brief .pn.commute .rw .v', (v) => ({ sh: v.scrollHeight, ch: v.clientHeight, w: Math.round(v.getBoundingClientRect().width) })).catch(() => null);
  check(7, !!cut && cut.sh <= cut.ch + 1 && cut.w >= 300, `the commute's line is cut off or squeezed: ${JSON.stringify(cut)}`);
  await D.page.screenshot({ path: `${out}/brief-commute.png` });
  await D.ctx.close();
}

// ======== E. 1280 × 800: the hero's buttons in view.
{
  const { page, ctx } = await open(browser, { viewport: { width: 1280, height: 800 } });
  await toBrief(page);
  await page.waitForTimeout(1500);
  const acts = await page.$$eval('#pg-brief .hero .bract button', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().bottom)));
  check(3, acts.length === 2 && acts.every((b) => b > 0 && b <= 800), `at 1280 × 800 the hero's buttons end at ${acts.join(', ')}`);
  await page.screenshot({ path: `${out}/brief-desktop.png` });
  await sideways(page, 'the Brief at 1280 × 800');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`BRIEF: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log('BRIEF: ok');
