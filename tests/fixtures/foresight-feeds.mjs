// Test only: foresight's public sources in the preview brain (tests/preview-server.mjs), so no spec — and no hourly
// 'foresee' job on CI's one shared preview — ever reads the live feeds: Open-Meteo's hourly rain (only the call foresight
// makes: past_days=1 with the hourly amount), Transitous's journey plan and a stop's departures (the shapes of the real
// recorded answers in apps/edge/test/transitous.fixture.json, moved to the time asked), and TomTom's drive time. Rain and a
// late train by default; the foresight spec switches them (/__test/foresight?rain=0&late=0).
//   foresightFeeds(url) → a Response for a foresight source, else null.
//   seedLedger(now) → a ledger with yesterday's scored train, one of his questions still open, and today's two open ones.
import { readFileSync } from 'node:fs';

export const foreMode = { rain: true, late: true };

export function setForeMode(params) {
  for (const k of ['rain', 'late']) if (params.has(k)) foreMode[k] = params.get(k) === '1';
  return { ...foreMode };
}

const FIX = JSON.parse(readFileSync(new URL('../../apps/edge/test/transitous.fixture.json', import.meta.url), 'utf8'));
const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (t) => new Date(Math.floor(t / 1000) * 1000).toISOString().replace('.000Z', 'Z');
const STOP = { name: 'Birmingham New Street', stopId: 'gb-great-britain_9100BHAMNWS6:sup', lat: 52.477818, lon: -1.9002054 };

/** Three days of hours around now: the chance and the amount of rain as the switch says. */
function hourly() {
  const from = Math.floor(Date.now() / HOUR) * HOUR - 36 * HOUR;
  const time = Array.from({ length: 72 }, (_, i) => (from + i * HOUR) / 1000);
  return json({ hourly: { time, precipitation_probability: time.map(() => (foreMode.rain ? 80 : 10)), precipitation: time.map(() => (foreMode.rain ? 0.8 : 0)) } });
}

/** The recorded rail journey, moved so its train leaves New Street twelve minutes after the time asked. */
function plan(u) {
  const asked = Date.parse(u.searchParams.get('time') ?? '') || Date.now();
  const it = FIX.rail.itineraries[0];
  const ride = it.legs.find((l) => /RAIL/.test(l.mode));
  const shift = asked + 12 * MIN - Date.parse(ride.scheduledStartTime);
  const moved = JSON.parse(JSON.stringify(it).replace(/"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)"/g, (_, t) => `"${iso(Date.parse(t) + shift)}"`));
  return json({ ...FIX.rail, itineraries: [moved], direct: [] });
}

/** The stop's departures: the LNR every minute for twenty minutes from the time asked, six minutes late when `late`. */
function stoptimes(u) {
  const from = Math.floor((Date.parse(u.searchParams.get('time') ?? '') || Date.now()) / MIN) * MIN;
  const stopTimes = Array.from({ length: 21 }, (_, i) => {
    const t = from + i * MIN;
    return { place: { ...STOP, departure: iso(t + (foreMode.late ? 6 * MIN : 0)), scheduledDeparture: iso(t), track: '3M', scheduledTrack: '3M' }, mode: 'REGIONAL_RAIL', realTime: true, headsign: 'Liverpool Lime Street (via Wolverhampton & Crewe)', routeShortName: 'LNR', agencyName: 'West Midlands Trains', cancelled: false, tripCancelled: false };
  });
  return json({ place: { name: STOP.name, lat: STOP.lat, lon: STOP.lon }, stopTimes });
}

export function foresightFeeds(u) {
  if (u.hostname === 'api.open-meteo.com' && u.pathname === '/v1/forecast' && u.searchParams.get('past_days') === '1' && /(^|,)precipitation(,|$)/.test(u.searchParams.get('hourly') ?? '')) return hourly();
  if (u.hostname === 'api.transitous.org' && u.pathname === '/api/v1/plan') return plan(u);
  if (u.hostname === 'api.transitous.org' && u.pathname === '/api/v1/stoptimes') return stoptimes(u);
  if (u.hostname === 'api.tomtom.com' && u.pathname.startsWith('/routing/1/calculateRoute/')) return json({ routes: [{ summary: { lengthInMeters: 25300, travelTimeInSeconds: 31 * 60, trafficDelayInSeconds: 4 * 60 } }] });
  return null;
}

/** Midnight to midnight in UK time: a day's wall-clock time as UTC ms. */
function ukTime(dayOffset, h, mi) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(Date.now()).map((x) => [x.type, x.value]));
  const guess = Date.UTC(+p.year, +p.month - 1, +p.day + dayOffset, h, mi);
  const off = (t) => {
    const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map((x) => [x.type, x.value]));
    return Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute) - t;
  };
  return guess - off(guess);
}
const dayKey = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

/**
 * A ledger as a day of foresight leaves it (UK time): yesterday's 08:12 expected late and six minutes late (right, the
 * first one true), one of his questions from yesterday still open, and today's rain and train open (due within the hour,
 * or just before midnight); today's predictions marked made, so the job adds nothing of its own today.
 */
export function seedLedger(now = Date.now()) {
  const end = ukTime(1, 0, 0) - 2 * MIN;
  const due = Math.min(now + 40 * MIN, end);
  const train = (d) => ukTime(d, 8, 12);
  const key = `LNR|${STOP.stopId}|08:12|wd`;
  return {
    items: [
      { id: 'seed-dep-y', at: ukTime(-1, 6, 0), kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'late by 3 min or more', confidence: 0.7, by: train(-1) + 3 * MIN, outcome: { at: train(-1) + 3 * MIN, actual: '6 minutes late', right: true, how: 'feed', value: 360 }, told: true, ref: { stopId: STOP.stopId, line: 'LNR', scheduled: train(-1), key } },
      { id: 'seed-ask-y', at: ukTime(-1, 10, 0), kind: 'answer', subject: 'will it rain on Saturday?', expect: 'rain on Saturday', confidence: 0.6, by: ukTime(-1, 20, 0), said: "I reckon rain on Saturday: it's on record, I'll check myself then." },
      { id: 'seed-rain', at: ukTime(0, 6, 0), kind: 'rain', subject: 'rain at Home 12:00–18:00', expect: 'rain by 15:00', confidence: 0.7, by: due, ref: { lat: 52.443186, lon: -1.892525, win: [ukTime(0, 12, 0), ukTime(0, 18, 0)] } },
      { id: 'seed-dep', at: ukTime(0, 6, 0), kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'on time', confidence: 0.6, by: due, ref: { stopId: STOP.stopId, line: 'LNR', scheduled: train(0), key } },
    ],
    samples: { dep: { [key]: [360] }, com: {} },
    firstTrue: train(-1) + 3 * MIN,
    made: { day: dayKey(now), done: ['rain', 'commute', 'departure'], notes: [] },
  };
}
