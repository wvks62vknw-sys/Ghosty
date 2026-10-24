// Journeys by public transport (Transitous, keyless), with the network faked from real answers
// (transitous.fixture.json: a geocode, two bus itineraries, a train, a walk all the way, four
// departures). The geocoder's choice and the owner's "here", the words for a time, the plan's
// request and its compact shape for the phone, the numbered lines with live times and delays,
// departures, the /journey route's plain errors, the two tools (offered by the right words,
// show_journey emitted) and a whole turn through the brain with the scripted model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FIX = JSON.parse(readFileSync(new URL('./transitous.fixture.json', import.meta.url), 'utf8'));
const X = await import('./.build/integrations/transitous.mjs');
const T = await import('./.build/tools/index.mjs');
const mod = await import('./.build/brain.mjs');

// ---- The network, faked: the router's answers for the fixture's places; nothing else exists.
const calls = [];
let geocodeStatus = 200;
const FAR_FIRST = [
  { type: 'PLACE', name: 'Moseley Village', id: 'way/[321762706]', lat: 42.8286, lon: -70.9043, areas: [{ name: 'Newburyport', default: true }] },
  { type: 'STOP', name: 'Moseley Village', id: 'gb-great-britain_910GMOSLEY', lat: 52.4476, lon: -1.8848, areas: [{ name: 'Birmingham', default: true }] },
];
globalThis.fetch = async (input, init) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  calls.push({ url: u, headers: init?.headers ?? {} });
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  if (u.hostname !== 'api.transitous.org') return new Response('not faked', { status: 599 });
  if (u.pathname === '/api/v1/geocode') {
    if (geocodeStatus !== 200) return j({ error: 'overloaded' }, geocodeStatus);
    const text = u.searchParams.get('text') ?? '';
    if (/zzz/.test(text)) return j([]);
    if (/moseley/i.test(text)) return j(FAR_FIRST);
    return j(FIX.geocode);
  }
  if (u.pathname === '/api/v1/plan') {
    if (/52\.586/.test(u.searchParams.get('toPlace') ?? '')) return j(FIX.rail);
    if (/52\.481/.test(u.searchParams.get('toPlace') ?? '')) return j(FIX.short);
    if (/40\.000/.test(u.searchParams.get('fromPlace') ?? '')) return j({ itineraries: [], direct: [] });
    return j(FIX.plan);
  }
  if (u.pathname === '/api/v1/stoptimes') return j(FIX.stoptimes);
  return new Response('{"error":"not found"}', { status: 404 });
};
const last = () => calls[calls.length - 1];
const reset = () => {
  calls.length = 0;
  geocodeStatus = 200;
  X._testing.resetCache();
};

const TZ = 'Europe/London';
const HOME = { name: 'Birmingham', lat: 52.4797, lon: -1.9026 };
const ctxFor = (known = true) => {
  const events = [];
  return { events, ctx: { storage: { get: async (k) => (k === 'owner:ctx' && known ? { tz: TZ, location: HOME } : undefined) }, vault: { get: async () => null }, emit: (e) => events.push(e), progress: () => undefined } };
};
const FROM = { name: 'Here', lat: 52.4778, lon: -1.899 };
const TO = { name: 'Pebble Mill', lat: 52.4515, lon: -1.9153 };
const T0 = Date.parse('2026-10-17T09:15:00Z');

test('geocode: the right address, our User-Agent, a bias on the owner, stops with their ids, the cache', async () => {
  reset();
  const list = await X.geocode('Birmingham New Street', HOME);
  assert.equal(last().url.origin + last().url.pathname, 'https://api.transitous.org/api/v1/geocode');
  assert.equal(last().url.searchParams.get('text'), 'Birmingham New Street');
  assert.equal(last().url.searchParams.get('language'), 'en');
  assert.equal(last().url.searchParams.get('place'), '52.47970,-1.90260');
  assert.equal(last().headers['User-Agent'], 'Ghosty/2.0 (personal assistant; single user)');
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { type: 'STOP', name: 'Birmingham New Street', area: 'Birmingham', lat: FIX.geocode[0].lat, lon: FIX.geocode[0].lon, stopId: 'gb-great-britain_910GBHAMNWS' });
  assert.equal(list[1].stopId, 'gb-great-britain_430G05014');
  const n = calls.length;
  await X.geocode('birmingham  new street', HOME);
  assert.equal(calls.length, n, 'the same words again within ten minutes are answered from memory');
  await X.geocode('Birmingham New Street', HOME, 'STOP');
  assert.equal(last().url.searchParams.get('type'), 'STOP');
});

test('geocode puts a namesake near the owner before one on another continent, and says plainly when the router is down', async () => {
  reset();
  const list = await X.geocode('Moseley Village', HOME);
  assert.equal(list[0].stopId, 'gb-great-britain_910GMOSLEY', 'Birmingham before Massachusetts');
  assert.equal(list[1].area, 'Newburyport');
  const far = await X.geocode('Moseley Village', { lat: 42.8, lon: -70.9 });
  assert.equal(far[0].area, 'Newburyport', 'nearest the owner, whoever they are');
  const plain = await X.geocode('Moseley Village');
  assert.equal(plain[0].area, 'Newburyport', 'with no owner location the router\'s own order stands');
  geocodeStatus = 503;
  await assert.rejects(X.geocode('Elsewhere', HOME), (e) => e instanceof X.JourneyError && /Transitous\) answered 503 \(overloaded\)/.test(e.message));
  geocodeStatus = 429;
  await assert.rejects(X.geocode('Elsewhere2', HOME), /slow down/);
});

test('resolvePlace: "here" is the owner, said plainly when unknown; "lat,lon" as it is; a name looked up near the owner; nothing found', async () => {
  reset();
  const { ctx } = ctxFor();
  assert.deepEqual(await X.resolvePlace('here', ctx), { type: 'PLACE', area: '', name: 'Birmingham', lat: 52.4797, lon: -1.9026 });
  assert.equal((await X.resolvePlace('', ctx)).name, 'Birmingham');
  assert.equal((await X.resolvePlace('my location', ctx)).lat, 52.4797);
  await assert.rejects(X.resolvePlace('here', ctxFor(false).ctx), /open God's Eye once so I know where you are, or name the place/);
  assert.equal(calls.length, 0, 'the owner\'s own place asks the router nothing');
  const c = await X.resolvePlace(' 52.4515, -1.9153 ', ctx);
  assert.deepEqual([c.lat, c.lon, c.name], [52.4515, -1.9153, '52.4515, -1.9153']);
  const s = await X.resolvePlace('Birmingham New Street', ctx);
  assert.equal(s.stopId, 'gb-great-britain_910GBHAMNWS');
  assert.equal(last().url.searchParams.get('place'), '52.47970,-1.90260', 'looked up near the owner');
  await X.resolvePlace('Moseley Village', ctx, { lat: 42.8, lon: -70.9 });
  assert.equal(last().url.searchParams.get('place'), '42.80000,-70.90000', 'or near the place given');
  await assert.rejects(X.resolvePlace('zzz', ctx), /I couldn't find "zzz": try the name of a stop, a station, a street or a town/);
});

test('whenToTime: the owner\'s words for a time, in their zone', () => {
  const now = Date.parse('2026-10-17T08:00:00Z'); // 09:00 British Summer Time
  const at = (w, arrive = false) => {
    const r = X.whenToTime(w, TZ, arrive, now);
    return `${new Date(r.time).toISOString()} ${r.arriveBy}`;
  };
  assert.equal(at(''), '2026-10-17T08:00:00.000Z false');
  assert.equal(at('now'), '2026-10-17T08:00:00.000Z false');
  assert.equal(at('now', true), '2026-10-17T08:00:00.000Z true');
  assert.equal(at('10:15'), '2026-10-17T09:15:00.000Z false');
  assert.equal(at('08:30'), '2026-10-18T07:30:00.000Z false', 'a clock time already past today means tomorrow');
  assert.equal(at('5pm'), '2026-10-17T16:00:00.000Z false');
  assert.equal(at('12:30pm'), '2026-10-17T11:30:00.000Z false');
  assert.equal(at('arrive by 09:30'), '2026-10-17T08:30:00.000Z true');
  assert.equal(at('arrive 09:30'), '2026-10-17T08:30:00.000Z true');
  assert.equal(at('be there by 6pm'), '2026-10-17T17:00:00.000Z true');
  assert.equal(at('leave at 10:15'), '2026-10-17T09:15:00.000Z false');
  assert.equal(at('tomorrow 07:45'), '2026-10-18T06:45:00.000Z false');
  assert.equal(at('tomorrow at 7am'), '2026-10-18T06:00:00.000Z false');
  assert.equal(at('tomorrow'), '2026-10-18T07:00:00.000Z false');
  assert.equal(at('tonight'), '2026-10-17T18:00:00.000Z false');
  assert.equal(at('in 20 minutes'), '2026-10-17T08:20:00.000Z false');
  assert.equal(at('in 2 hours'), '2026-10-17T10:00:00.000Z false');
  assert.equal(at('2026-10-17T08:30'), '2026-10-17T07:30:00.000Z false', 'a local date and time');
  assert.equal(at('2026-10-20'), '2026-10-19T23:00:00.000Z false');
  assert.throws(() => X.whenToTime('whenever', TZ), (e) => e instanceof X.JourneyError && /didn't understand the time "whenever"/.test(e.message));
  assert.throws(() => X.whenToTime('25:99', TZ), /is not a time of day/);
});

test('plan: the request (places, UTC time, options) and the compact journeys for the phone', async () => {
  reset();
  const its = await X.plan({ from: FROM, to: TO, time: T0, maxTransfers: 2, modes: ['BUS', 'COACH', 'BUS'] });
  const q = last().url.searchParams;
  assert.equal(last().url.pathname, '/api/v1/plan');
  assert.equal(q.get('fromPlace'), '52.477800,-1.899000');
  assert.equal(q.get('toPlace'), '52.451500,-1.915300');
  assert.equal(q.get('time'), '2026-10-17T09:15:00Z');
  assert.equal(q.get('numItineraries'), '5');
  assert.equal(q.get('maxTransfers'), '2');
  assert.equal(q.get('transitModes'), 'BUS,COACH');
  assert.equal(q.get('arriveBy'), null);
  assert.equal(its.length, 2);
  assert.deepEqual(its.map((j) => j.id), ['1', '2']);
  const [a] = its;
  assert.equal(a.start, '2026-10-17T09:20:00Z');
  assert.equal(a.end, '2026-10-17T09:39:00Z');
  assert.equal(a.duration, 1140);
  assert.equal(a.transfers, 0);
  assert.equal(a.direct, undefined);
  assert.deepEqual(a.legs.map((l) => l.mode), ['walk', 'bus', 'walk']);
  const walk = a.legs[0];
  assert.equal(walk.from.name, 'Here', 'the router\'s START is the owner\'s own word');
  assert.equal(walk.to.name, 'Birmingham New Street Station');
  assert.equal(walk.to.stopId, 'gb-great-britain_43000201703');
  assert.equal(walk.distance, 302);
  assert.equal(walk.duration, 300);
  assert.equal(walk.precision, 7);
  assert.equal(walk.points, FIX.plan.itineraries[0].legs[0].legGeometry.points, 'the shape goes through as the router encoded it');
  const bus = a.legs[1];
  assert.equal(bus.kind, 'BUS');
  assert.equal(bus.line, '61');
  assert.equal(bus.headsign, 'Arden Road Terminus');
  assert.equal(bus.agency, 'National Express West Midlands');
  assert.equal(bus.track, 'NS3');
  assert.equal(bus.color, '');
  assert.equal(bus.realTime, false);
  assert.equal(bus.cancelled, false);
  assert.equal(bus.start, '2026-10-17T09:25:00Z');
  assert.equal(bus.scheduledStart, '2026-10-17T09:25:00Z');
  assert.equal(bus.stops.length, 7);
  const im = FIX.plan.itineraries[0].legs[1].intermediateStops[0];
  assert.deepEqual(bus.stops[0], { name: 'O2 Academy', lat: im.lat, lon: im.lon, stopId: 'gb-great-britain_43000204701' });
  assert.equal(a.legs[2].to.name, 'Pebble Mill', 'the router\'s END is the owner\'s own word');
  assert.equal(its[1].legs[1].line, '63');
  // a train: the operator's colour, live times, the platform; arriveBy on the request; a stop goes by its id
  reset();
  const rail = await X.plan({ from: { name: 'Birmingham New Street', lat: 52.4776, lon: -1.8987, stopId: 'gb-great-britain_910GBHAMNWS' }, to: { name: 'Wolverhampton', lat: 52.5862, lon: -2.1288 }, time: T0, arriveBy: true });
  assert.equal(last().url.searchParams.get('fromPlace'), 'gb-great-britain_910GBHAMNWS');
  assert.equal(last().url.searchParams.get('arriveBy'), 'true');
  assert.equal(last().url.searchParams.get('maxTransfers'), null);
  assert.equal(last().url.searchParams.get('transitModes'), null);
  const train = rail[0].legs[1];
  assert.equal(train.mode, 'rail');
  assert.equal(train.kind, 'REGIONAL_RAIL');
  assert.equal(train.line, 'LNR');
  assert.equal(train.color, '#00bf6f');
  assert.equal(train.realTime, true);
  assert.equal(train.track, '3M');
  assert.equal(train.agency, 'West Midlands Trains');
});

test('plan: a walk all the way is an option when it is short — first when it beats every ride; nothing is nothing', async () => {
  reset();
  const short = await X.plan({ from: FROM, to: { name: 'Snow Hill', lat: 52.481, lon: -1.899 }, time: T0 });
  assert.equal(short.length, 1);
  assert.equal(short[0].direct, true);
  assert.equal(short[0].id, '1');
  assert.equal(short[0].duration, 481);
  assert.deepEqual(short[0].legs.map((l) => [l.mode, l.distance, l.from.name, l.to.name]), [['walk', 535, 'Here', 'Snow Hill']]);
  const none = await X.plan({ from: { name: 'Mid-ocean', lat: 40, lon: -30 }, to: TO, time: T0 });
  assert.deepEqual(none, []);
});

test('format: the numbered lines, in the owner\'s zone, with stops and stands; live, late and cancelled rides', async () => {
  reset();
  const its = await X.plan({ from: FROM, to: TO, time: T0 });
  assert.equal(
    X.format(its, TZ),
    [
      '1. 10:20 → 10:39 · 19 min · no changes: walk 5 min to Birmingham New Street Station (stop NS3) → bus 61 towards Arden Road Terminus at 10:25, 8 stops, get off at Pebble Mill Road 10:35 → walk 4 min',
      '2. 10:27 → 10:47 · 20 min · no changes: walk 5 min to Birmingham New Street Station (stop NS3) → bus 63 towards Arden Road Terminus at 10:32, 8 stops, get off at Pebble Mill Road 10:43 → walk 4 min',
    ].join('\n'),
  );
  assert.match(X.format(its, 'UTC'), /^1\. 09:20 → 09:39/, 'another zone, other clock times');
  const live = structuredClone(its);
  live[0].legs[1].realTime = true;
  live[0].legs[1].start = '2026-10-17T09:28:00Z';
  live[1].legs[1].realTime = true;
  live[1].legs[1].cancelled = true;
  const text = X.format(live, TZ);
  assert.match(text, /bus 61 towards Arden Road Terminus at 10:28 \(live: 3 min late\), 8 stops/);
  assert.match(text, /bus 63 towards Arden Road Terminus at 10:32 — CANCELLED, 8 stops/);
  live[0].legs[1].start = '2026-10-17T09:25:20Z';
  assert.match(X.format(live, TZ), /at 10:25 \(live\), 8 stops/, 'live and on time');
  live[0].legs[1].start = '2026-10-17T09:23:00Z';
  assert.match(X.format(live, TZ), /at 10:23 \(live: 2 min early\)/);
  const rail = await X.plan({ from: { name: 'Birmingham New Street', lat: 52.4776, lon: -1.8987, stopId: 'gb-great-britain_910GBHAMNWS' }, to: { name: 'Wolverhampton', lat: 52.5862, lon: -2.1288 }, time: T0 });
  assert.equal(X.format(rail, TZ), '1. 10:29 → 11:06 · 37 min · no changes: walk 5 min to Birmingham New Street (platform 3M) → train LNR towards Liverpool Lime Street (via Wolverhampton & Crewe) at 10:34 (live), 2 stops, get off at Wolverhampton 10:53 → walk 13 min');
  const short = await X.plan({ from: FROM, to: { name: 'Snow Hill', lat: 52.481, lon: -1.899 }, time: T0 });
  assert.equal(X.format(short, TZ), '1. 06:24 → 06:32 · 8 min · walk all the way (535 m)');
  // a ride that starts the journey (no walk first) says where it leaves from; a change says so
  const twoRides = structuredClone(its[0]);
  twoRides.legs = [its[0].legs[1], { ...its[1].legs[1], from: its[0].legs[1].to, line: 'X1', mode: 'bus', kind: 'COACH', track: '' }];
  twoRides.transfers = 1;
  const t2 = X.format([twoRides], TZ);
  assert.match(t2, /· 1 change: bus 61 towards Arden Road Terminus from Birmingham New Street Station \(stop NS3\) at 10:25, 8 stops, get off at Pebble Mill Road 10:35 → coach X1 towards Arden Road Terminus at 10:32/);
  assert.equal(X.minutes(3900), '1 h 5 min');
  assert.equal(X.hhmm('nonsense', TZ), '--:--');
  assert.equal(X.delayWords(0), 'on time');
  assert.equal(X.delayWords(-120), '2 min early');
});

test('departures: every stop around a point (centre + radius) or one stop by id, sorted by time, as lines', async () => {
  reset();
  const near = await X.departures({ lat: 52.4778, lon: -1.899 }, 10);
  assert.equal(last().url.pathname, '/api/v1/stoptimes');
  assert.equal(last().url.searchParams.get('center'), '52.47780,-1.89900');
  assert.equal(last().url.searchParams.get('radius'), '400');
  assert.equal(last().url.searchParams.get('n'), '10');
  assert.equal(last().url.searchParams.get('stopId'), null);
  assert.equal(near.list.length, 4);
  assert.deepEqual(near.list[0], {
    line: '23',
    mode: 'bus',
    kind: 'BUS',
    color: '',
    headsign: 'Bus Mall',
    agency: 'National Express West Midlands',
    stop: { name: 'Theatre Approach', lat: FIX.stoptimes.stopTimes[0].place.lat, lon: FIX.stoptimes.stopTimes[0].place.lon, stopId: 'gb-great-britain_43000203501' },
    track: 'NS7',
    time: '2026-10-17T03:29:00Z',
    scheduled: '2026-10-17T03:29:00Z',
    realTime: false,
    cancelled: false,
  });
  assert.equal(
    X.formatDepartures(near.list, TZ),
    [
      '- 04:29 bus 23 towards Bus Mall, from Theatre Approach (stop NS7)',
      '- 04:30 bus 23 towards Bus Mall, from Birmingham New Street Station (stop NS1)',
      '- 04:32 bus 61 towards Arden Road Terminus, from Birmingham New Street Station (stop NS3)',
      '- 04:34 bus 87 towards Colmore Row, from Theatre Approach (stop NS7)',
    ].join('\n'),
  );
  const one = await X.departures({ stopId: 'gb-great-britain_910GBHAMNWS' }, 5, { time: Date.parse('2026-10-17T10:00:00Z') });
  assert.equal(last().url.searchParams.get('stopId'), 'gb-great-britain_910GBHAMNWS');
  assert.equal(last().url.searchParams.get('center'), null);
  assert.equal(last().url.searchParams.get('time'), '2026-10-17T10:00:00Z');
  assert.equal(last().url.searchParams.get('n'), '5');
  assert.equal(one.list.length, 4);
  const live = structuredClone(near.list);
  live[0].realTime = true;
  live[0].time = '2026-10-17T03:33:00Z';
  live[1].cancelled = true;
  live[2].realTime = true;
  const lines = X.formatDepartures(live.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)), TZ).split('\n');
  assert.equal(lines[0], '- 04:30 bus 23 towards Bus Mall, from Birmingham New Street Station (stop NS1), CANCELLED');
  assert.equal(lines[1], '- 04:32 bus 61 towards Arden Road Terminus, from Birmingham New Street Station (stop NS3), live');
  assert.equal(lines[2], '- 04:33 bus 23 towards Bus Mall, from Theatre Approach (stop NS7), live: 4 min late');
});

test('/journey route: the phone\'s question answered in the compact shape, or a plain-words problem with status 400', async () => {
  reset();
  const { ctx } = ctxFor();
  const r = await X.journeyRoute(new URL('https://x/journey?from=here&to=Pebble%20Mill&tz=Europe/London'), ctx);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(Object.keys(j), ['from', 'to', 'tz', 'time', 'arriveBy', 'itineraries']);
  assert.deepEqual(j.from, { name: 'Birmingham', lat: 52.4797, lon: -1.9026 });
  assert.equal(j.to.stopId, 'gb-great-britain_910GBHAMNWS', 'the geocoder answered (the fixture) and the stop\'s id came along');
  assert.equal(j.tz, 'Europe/London');
  assert.match(j.time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(j.arriveBy, false);
  assert.equal(j.itineraries.length, 2);
  assert.equal(j.itineraries[0].legs[1].line, '61');
  // a coordinate pair for "here" (what the GO panel sends), a local time to arrive by, the phone's zone
  const r2 = await X.journeyRoute(new URL('https://x/journey?from=52.4778,-1.899&to=52.4515,-1.9153&time=2026-10-17T10:30&arriveBy=true&tz=Europe/London'), ctx);
  const j2 = await r2.json();
  assert.equal(j2.time, '2026-10-17T09:30:00Z', 'local 10:30 BST is 09:30 UTC');
  assert.equal(j2.arriveBy, true);
  assert.equal(last().url.searchParams.get('arriveBy'), 'true');
  assert.equal(j2.from.name, '52.4778, -1.8990');
  // the zone comes from the phone; with none, from what the owner's phone last said; with nothing, UTC
  const r3 = await X.journeyRoute(new URL('https://x/journey?from=52.4778,-1.899&to=52.4515,-1.9153'), ctx);
  assert.equal((await r3.json()).tz, 'Europe/London');
  const r4 = await X.journeyRoute(new URL('https://x/journey?from=52.4778,-1.899&to=52.4515,-1.9153&tz=Mars/Olympus'), { storage: { get: async () => { throw new Error('Exceeded allowed rows read'); } } });
  assert.equal(r4.status, 200);
  assert.equal((await r4.json()).tz, 'UTC', 'a paused database and an unknown zone still answer');
  // nothing found
  const r5 = await X.journeyRoute(new URL('https://x/journey?from=40,-30&to=52.4515,-1.9153&tz=UTC'), ctx);
  const j5 = await r5.json();
  assert.equal(r5.status, 200);
  assert.deepEqual(j5.itineraries, []);
  assert.match(j5.note, /No journeys found between 40\.0000, -30\.0000 and 52\.4515, -1\.9153 at that time: try another time/);
  // plain problems
  const bad = async (qs) => {
    const res = await X.journeyRoute(new URL(`https://x/journey?${qs}`), ctx);
    return [res.status, (await res.json()).error];
  };
  assert.deepEqual(await bad('from=here&to='), [400, 'Say where to go.']);
  assert.deepEqual(await bad('from=here&to=zzz'), [400, 'I couldn\'t find "zzz": try the name of a stop, a station, a street or a town.']);
  assert.deepEqual(await bad('from=52.4778,-1.899&to=52.4515,-1.9153&time=whenever'), [400, 'I didn\'t understand the time "whenever": try "now", "08:30", "arrive by 09:00", "tomorrow 07:45" or "in 20 minutes".']);
  const res = await X.journeyRoute(new URL('https://x/journey?from=here&to=Pebble%20Mill'), ctxFor(false).ctx);
  assert.deepEqual([res.status, (await res.json()).error], [400, "I don't know where you are yet: open God's Eye once so I know where you are, or name the place."]);
  geocodeStatus = 500;
  assert.deepEqual(await bad('from=here&to=Somewhere%20New'), [400, 'The journey planner (Transitous) answered 500 (overloaded); try again in a minute.']);
});

test('the journey tools are offered for the right words, and are read-only', () => {
  const names = (msg) => T.selectTools(msg, new Set(), false).map((t) => t.name);
  for (const q of ['how do I get to moseley', 'next bus from new street', 'train to coventry at 9', 'take me to the airport by tram', 'plan a journey home', 'what time do departures from wolverhampton leave', 'commute options tomorrow']) {
    assert.ok(names(q).includes('plan_journey') && names(q).includes('next_departures'), q);
  }
  assert.ok(!names('what is the weather tomorrow').includes('plan_journey'));
  assert.ok(!names('remember I like flat whites').includes('next_departures'));
  assert.equal(T.toolByName.get('plan_journey').pure, true);
  assert.equal(T.toolByName.get('next_departures').pure, true);
  assert.equal(T.toolByName.get('plan_journey').risk, 'auto');
  const group = T.TOOL_GROUPS.find((g) => g.name === 'journeys');
  assert.ok(group && group.about.length <= 220 && /^you can /i.test(group.about));
});

test('plan_journey: the numbered lines as data, the planner credited, and show_journey for the phone with the compact journeys', async () => {
  reset();
  const { events, ctx } = ctxFor();
  const out = await T.toolByName.get('plan_journey').run({ to: 'Birmingham New Street', when: 'arrive by 10:30', modes: ['train', 'bus'], max_changes: 1 }, ctx);
  assert.match(out, /^<<external content from Transitous journey planner/);
  assert.match(out, /Journeys from Birmingham to Birmingham New Street, arriving by \w{3} \d{1,2} \w{3} 10:30 \(Europe\/London\):/);
  assert.match(out, /\n1\. 10:20 → 10:39 · 19 min · no changes: walk 5 min to Birmingham New Street Station \(stop NS3\) → bus 61 towards Arden Road Terminus at 10:25, 8 stops, get off at Pebble Mill Road 10:35 → walk 4 min\n/);
  assert.match(out, /\(Shown on the map on the phone\.\)/);
  assert.match(out, /Times marked "live" come from the operator's live feed; the rest are the timetable\. Powered by Transitous \(transitous\.org\)/);
  const plan = calls.find((c) => c.url.pathname === '/api/v1/plan');
  assert.equal(plan.url.searchParams.get('arriveBy'), 'true');
  assert.equal(plan.url.searchParams.get('transitModes'), 'RAIL,BUS,COACH');
  assert.equal(plan.url.searchParams.get('maxTransfers'), '1');
  assert.equal(plan.url.searchParams.get('fromPlace'), '52.479700,-1.902600', 'from the owner\'s own location');
  assert.equal(plan.url.searchParams.get('toPlace'), 'gb-great-britain_910GBHAMNWS', 'the station by its id');
  assert.equal(calls.length, 2, 'one geocode and one plan: well under the turn\'s allowance');
  assert.equal(events.length, 1);
  assert.equal(events[0].t, 'client');
  assert.equal(events[0].name, 'show_journey');
  const a = events[0].args;
  assert.deepEqual(a.from, { name: 'Birmingham', lat: 52.4797, lon: -1.9026 });
  assert.equal(a.to.name, 'Birmingham New Street');
  assert.equal(a.tz, 'Europe/London');
  assert.equal(a.arriveBy, true);
  assert.equal(a.itineraries.length, 2);
  assert.equal(a.itineraries[0].legs[1].points.length, 792);
  assert.equal(a.itineraries[0].legs[1].precision, 7);
  assert.equal(a.itineraries[0].legs[1].stops.length, 7);
  assert.ok(JSON.stringify(a).length < 60_000, 'compact enough for the stream');
  // nothing found: said plainly, and nothing drawn
  reset();
  const none = ctxFor();
  const text = await T.toolByName.get('plan_journey').run({ from: '40,-30', to: '52.4515,-1.9153' }, none.ctx);
  assert.match(text, /No journeys found between 40\.0000, -30\.0000 and 52\.4515, -1\.9153 at that time: try another time, or a different place name\./);
  assert.equal(none.events.length, 0);
  await assert.rejects(T.toolByName.get('plan_journey').run({ to: 'zzz' }, ctxFor().ctx), /I couldn't find "zzz"/);
  await assert.rejects(T.toolByName.get('plan_journey').run({ to: 'Pebble Mill' }, ctxFor(false).ctx), /open God's Eye once/);
});

test('next_departures: the stops around the owner, or a named stop; a line filter; the words', async () => {
  reset();
  const { events, ctx } = ctxFor();
  const here = await T.toolByName.get('next_departures').run({}, ctx);
  assert.equal(last().url.pathname, '/api/v1/stoptimes');
  assert.equal(last().url.searchParams.get('center'), '52.47970,-1.90260');
  assert.equal(last().url.searchParams.get('radius'), '400');
  assert.match(here, /Next departures from the stops within 400 m of Birmingham \(Europe\/London\):\n- 04:29 bus 23 towards Bus Mall, from Theatre Approach \(stop NS7\)\n- 04:30 bus 23/);
  assert.match(here, /Powered by Transitous/);
  assert.equal(events.length, 0, 'departures open nothing on screen');
  reset();
  const named = await T.toolByName.get('next_departures').run({ stop: 'Birmingham New Street', line: '61', count: 3 }, ctx);
  assert.equal(calls[0].url.pathname, '/api/v1/geocode');
  assert.equal(calls[0].url.searchParams.get('type'), 'STOP');
  assert.equal(calls[1].url.searchParams.get('stopId'), 'gb-great-britain_910GBHAMNWS');
  assert.match(named, /Next departures from Birmingham New Street, Birmingham \(line 61 only\) \(Europe\/London\):\n- 04:32 bus 61 towards Arden Road Terminus, from Birmingham New Street Station \(stop NS3\)\n/);
  assert.doesNotMatch(named, /bus 23/);
  const none = await T.toolByName.get('next_departures').run({ stop: 'Birmingham New Street', line: 'X99' }, ctx);
  assert.match(none, /4 departures found, but none on line X99 in that window\./);
  await assert.rejects(T.toolByName.get('next_departures').run({ stop: 'zzz' }, ctx), /I couldn't find a stop or station called "zzz"/);
  await assert.rejects(T.toolByName.get('next_departures').run({}, ctxFor(false).ctx), /open God's Eye once so I know where you are, or name the stop/);
  const later = await T.toolByName.get('next_departures').run({ stop: '52.4778,-1.899', when: '2026-10-17T10:00' }, ctx);
  assert.equal(last().url.searchParams.get('time'), '2026-10-17T09:00:00Z');
  assert.match(later, /, from \w{3} 17 Oct 10:00 \(Europe\/London\)/);
});

// ---- A whole turn through the brain with the scripted model.
class MemStorage {
  m = new Map();
  async get(k) {
    return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() {
    return null;
  }
}
const OWNER_KEY = 'journey-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p) };
const env = { OWNER_KEY, MOCK_LLM: '1' };
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
async function chat(message) {
  const context = { tz: TZ, location: HOME };
  const r = await mod.default.fetch(new Request('https://ghosty.me.workers.dev/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, body: JSON.stringify({ message, context }) }), env, { waitUntil: (p) => pending.push(p) });
  assert.equal(r.status, 200);
  const text = await r.text();
  await Promise.allSettled(pending.splice(0));
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('"plan a journey from new street to moseley": the brain plans it, the phone is told to draw it, the reply carries the lines', async () => {
  reset();
  const ev = await chat('plan a journey from new street to moseley');
  const tool = ev.find((e) => e.t === 'tool');
  assert.equal(tool?.name, 'plan_journey');
  assert.deepEqual(tool.args, { from: 'new street', to: 'moseley' });
  const shown = ev.find((e) => e.t === 'client');
  assert.equal(shown?.name, 'show_journey');
  assert.equal(shown.args.from.name, 'Birmingham New Street', 'the geocoder\'s stop');
  assert.equal(shown.args.to.name, 'Moseley Village');
  assert.equal(shown.args.itineraries.length, 2);
  const result = ev.find((e) => e.t === 'tool_result');
  assert.equal(result.ok, true);
  const reply = ev.find((e) => e.t === 'text');
  assert.match(reply.text, /Journeys from Birmingham New Street to Moseley Village/, 'the scripted model repeats the first 160 characters');
  assert.ok(ev.some((e) => e.t === 'done'));
  assert.deepEqual(calls.map((c) => c.url.pathname), ['/api/v1/geocode', '/api/v1/geocode', '/api/v1/plan'], 'two lookups and one plan: well under the turn\'s allowance');
  assert.equal(calls[1].url.searchParams.get('place'), `${FIX.geocode[0].lat.toFixed(5)},${FIX.geocode[0].lon.toFixed(5)}`, 'the destination is looked up near the start');
});

test('"next buses from new street" asks for departures and nothing is drawn', async () => {
  reset();
  const ev = await chat('next buses from new street');
  assert.equal(ev.find((e) => e.t === 'tool')?.name, 'next_departures');
  assert.ok(!ev.some((e) => e.t === 'client'));
  assert.match(ev.find((e) => e.t === 'text').text, /Next departures from Birmingham New Street/);
});

// The /api/journey route through the Worker: owner-only, like every other route.
test('/api/journey needs the owner, and answers the GO panel through the Worker', async () => {
  reset();
  const anon = await mod.default.fetch(new Request('https://ghosty.me.workers.dev/api/journey?from=here&to=Pebble%20Mill'), env, { waitUntil: () => undefined });
  assert.ok(anon.status === 401 || anon.status === 403, `anonymous: ${anon.status}`);
  const r = await mod.default.fetch(new Request('https://ghosty.me.workers.dev/api/journey?from=52.4778,-1.899&to=Pebble%20Mill&tz=Europe/London', { headers: { 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, { waitUntil: () => undefined });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.itineraries.length, 2);
  assert.equal(j.from.name, '52.4778, -1.8990');
  const bad = await mod.default.fetch(new Request('https://ghosty.me.workers.dev/api/journey?from=here&to=zzz', { headers: { 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, { waitUntil: () => undefined });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /I couldn't find "zzz"/);
});

// ---- "Take me home" (BRIEF-PLACES-SPENDING): the saved home (places.ts), never where the phone is.
const SAVED = [
  { id: 'home', label: 'Home', query: '12 Acacia Avenue, B13', address: '12, Acacia Avenue, Kings Heath, Birmingham, B13 9XX', lat: 52.4351, lon: -1.8912, at: 1 },
  { id: 'work', label: 'Work', query: 'QE hospital', address: 'Queen Elizabeth Hospital, Mindelsohn Way, Birmingham', lat: 52.4532, lon: -1.9418, at: 1 },
];
const savedCtx = (places = SAVED) => {
  const events = [];
  const data = { 'owner:ctx': { tz: TZ, location: HOME }, places };
  return { events, ctx: { storage: { get: async (k) => data[k] }, vault: { get: async () => null }, emit: (e) => events.push(e), progress: () => undefined } };
};

test('"take me home": plan_journey and resolvePlace go to the saved home and work; "home" not saved yet says how', async () => {
  reset();
  const { ctx, events } = savedCtx();
  assert.deepEqual(await X.resolvePlace('home', ctx), { type: 'PLACE', area: '', name: 'Home', lat: 52.4351, lon: -1.8912 });
  assert.equal((await X.resolvePlace('my home', ctx)).lat, 52.4351);
  assert.equal((await X.resolvePlace('the office', ctx)).name, 'Work');
  assert.equal((await X.resolvePlace('here', ctx)).name, 'Birmingham', '"here" is still where he is');
  assert.equal(calls.length, 0, 'a saved place is not looked up');
  await assert.rejects(X.resolvePlace('home', savedCtx([]).ctx), /I don't know where home is yet: tell me \("remember home is …"/);
  await assert.rejects(X.resolvePlace('work', savedCtx([]).ctx), /Memory → ME → PLACES/);
  // "take me home" from work, by bus.
  const out = await T.toolByName.get('plan_journey').run({ to: 'home', from: 'work' }, ctx);
  const plan = calls.find((c) => c.url.pathname === '/api/v1/plan').url;
  assert.match(plan.searchParams.get('toPlace'), /^52\.4351/);
  assert.match(plan.searchParams.get('fromPlace'), /^52\.4532/);
  assert.match(out, /Journeys from Work to Home/);
  assert.equal(events[0].args.to.name, 'Home');
  // The stops near home.
  reset();
  await T.toolByName.get('next_departures').run({ stop: 'home' }, ctx);
  assert.match(last().url.searchParams.get('center') ?? last().url.search, /52\.4351/);
});

test('"how long to work?": get_directions drives to the saved work, from the saved home, without the map search', async () => {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input) => {
    const u = typeof input === 'string' ? input : input.url;
    asked.push(u);
    if (u.startsWith('https://routing.openstreetmap.de/routed-car/')) return Response.json({ code: 'Ok', routes: [{ distance: 4800, duration: 900, geometry: { coordinates: [[-1.8912, 52.4351], [-1.9418, 52.4532]] }, legs: [{ steps: [] }] }] });
    return new Response('not faked', { status: 599 });
  };
  try {
    const { ctx, events } = savedCtx();
    const out = await T.toolByName.get('get_directions').run({ to: 'work', from: 'home' }, ctx);
    assert.match(out, /^Driving from Home to Work: 4\.8 km \(3\.0 mi\), about 15 min/);
    assert.ok(asked[0].includes('/-1.8912,52.4351;-1.9418,52.4532?'), asked[0]);
    assert.ok(!asked.some((u) => u.includes('nominatim')), 'no map search for a saved place');
    assert.equal(events[0].args.to, 'Work');
    await assert.rejects(T.toolByName.get('get_directions').run({ to: 'home' }, savedCtx([]).ctx), /I don't know where home is yet/);
  } finally {
    globalThis.fetch = real;
  }
});
