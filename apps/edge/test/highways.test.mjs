// National Highways live incidents: the site API parsed defensively, events pinned to West
// Midlands junctions, the RSS fallback, the three-minute cache, typical speeds by weekday and
// quarter-hour, and the motorway_now tool. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const H = await import('./.build/integrations/highways.mjs');
const T = await import('./.build/tools/index.mjs');

const JUNCTIONS = {
  M6: { '4A': [52.4495, -1.7385, 'M42 interchange'], '5': [52.5076, -1.8065, 'Castle Bromwich'], '6': [52.5103, -1.869, 'Spaghetti Junction'], '7': [52.5407, -1.9155, 'Great Barr'], '10A': [52.6262, -2.0387, 'M54 interchange'] },
  'A38(M)': { '1': [52.4965, -1.8785, 'Park Circus'] },
  'M6 TOLL': { T3: [52.5985, -1.7735, 'Weeford'] },
};

const event = (o) => ({
  id: 'ev-1', road: 'M6', region: 'West Midlands', title: 'M6 southbound between J6 and J5', location: 'M6 southbound between J6 and J5', reason: 'Congestion', returnToNormal: '2026-10-13T12:45:00Z',
  status: 'Active', delay: 1140, direction: 'S', type: 'AbnormalTraffic', laneClosures: true, lanesClosed: '2|0|2', carriageway: 'main', createdDate: '2026-10-13T06:50:00Z', updatedDate: '2026-10-13T07:10:00Z', isActive: true,
  overallStartTime: '2026-10-13T06:48:00Z', overallEndTime: '2026-10-13T13:00:00Z', returnToNormalText: 'Normal traffic conditions are expected between 13:45 and 14:00', lanesClosedText: '2 lanes closed', timeToClearText: '', ...o,
});
const SAMPLE = {
  data: [
    event({}),
    event({ id: 'ev-2', title: 'M6 northbound at J7', location: 'M6 northbound at J7', reason: 'Broken down vehicle', direction: 'N', delay: 300, lanesClosed: '1|0|3', lanesClosedText: '1 lane closed', returnToNormalText: '' }),
    event({ id: 'ev-3', road: 'A38M', title: 'A38(M) southbound at J1', location: '', reason: 'Roadworks', direction: 'S', delay: 60, lanesClosed: '', lanesClosedText: '', returnToNormalText: '', returnToNormal: '' }),
    { id: 'ev-4', title: 'M5 northbound, Oldbury area' }, // most fields missing, no junction named: must still parse
    event({ id: 'ev-old', isActive: false }), // ended: left out
    'not an event',
    null,
  ],
  pagination: { totalItems: 5, currentPage: 1, pageSize: 100, totalPages: 1 },
};

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>National Highways Breaking News</title>
<item><title><![CDATA[M6 southbound between J6 and J5 | Collision]]></title><link>https://nationalhighways.co.uk/travel-updates/1</link><guid>alert-1</guid>
<description><![CDATA[<p>The M6 southbound between J6 &amp; J5 is closed following a collision. Two lanes closed; delays of up to 40 minutes. Normal traffic conditions expected by 14:30.</p>]]></description><pubDate>Tue, 13 Oct 2026 07:00:00 GMT</pubDate></item>
<item><title>M25 anticlockwise J10 to J9</title><description>Lane closures after a lorry fire. Delay of 1 hour.</description><link>https://nationalhighways.co.uk/travel-updates/2</link></item>
</channel></rss>`;

test('parseEvents maps the site API defensively, including events with missing fields', () => {
  const ev = H.parseEvents(SAMPLE);
  assert.equal(ev.length, 4, 'inactive and non-events are dropped');
  const [a, , c, d] = ev;
  assert.equal(a.id, 'ev-1');
  assert.equal(a.road, 'M6');
  assert.equal(a.direction, 'southbound');
  assert.equal(a.delayS, 1140);
  assert.equal(a.lanesClosed, '2 lanes closed');
  assert.match(a.normalBy, /13:45/);
  assert.equal(a.start, Date.parse('2026-10-13T06:48:00Z'));
  assert.equal(a.updated, Date.parse('2026-10-13T07:10:00Z'));
  assert.equal(a.status, 'Active');
  assert.equal(c.road, 'A38(M)', 'A38M normalised');
  assert.equal(c.normalBy, '', 'no clearance time given');
  assert.equal(d.road, 'M5', 'road read from the title when the field is missing');
  assert.equal(d.direction, 'northbound');
  assert.equal(d.delayS, 0);
  assert.equal(d.lanesClosed, '');
  assert.equal(d.start, null);
  assert.equal(d.lat, null);
  assert.deepEqual(H.parseEvents(null), []);
  assert.deepEqual(H.parseEvents({ data: 'nope' }), []);
  assert.equal(H.parseEvents([{ title: 'M42 clockwise at J7' }]).length, 1, 'a bare list is fine too');
});

test('placeEvent pins "between J6 and J5" to the midpoint of the two junctions', () => {
  const e = H.placeEvent(H.parseEvents(SAMPLE)[0], JUNCTIONS);
  assert.equal(e.from, 'J6');
  assert.equal(e.to, 'J5');
  assert.ok(Math.abs(e.lat - (52.5103 + 52.5076) / 2) < 1e-4, `lat ${e.lat}`);
  assert.ok(Math.abs(e.lon - (-1.869 + -1.8065) / 2) < 1e-4, `lon ${e.lon}`);
});

test('placeEvent handles "at J10A", "J4A to J5", "between junctions J20A and J18" and unknown roads', () => {
  const base = H.parseEvents([{ title: 'M6 northbound at J10A', direction: 'N' }])[0];
  const one = H.placeEvent(base, JUNCTIONS);
  assert.equal(one.from, 'J10A');
  assert.equal(one.to, '');
  assert.deepEqual([one.lat, one.lon], [52.6262, -2.0387]);
  const span = H.placeEvent(H.parseEvents([{ road: 'M6', title: 'M6 southbound J4A to J5', direction: 'S' }])[0], JUNCTIONS);
  assert.deepEqual([span.from, span.to], ['J4A', 'J5']);
  assert.ok(Math.abs(span.lat - (52.4495 + 52.5076) / 2) < 1e-4);
  const far = H.placeEvent(H.parseEvents([{ road: 'M1', title: 'M1 northbound between junctions J20A and J18' }])[0], JUNCTIONS);
  assert.deepEqual([far.from, far.to], ['J20A', 'J18'], 'junction refs are read even when the road is unknown');
  assert.equal(far.lat, null);
  assert.equal(far.lon, null);
  const toll = H.placeEvent(H.parseEvents([{ road: 'M6 Toll', title: 'M6 Toll northbound at T3' }])[0], JUNCTIONS);
  assert.equal(toll.road, 'M6 TOLL');
  assert.equal(toll.from, 'T3');
  assert.deepEqual([toll.lat, toll.lon], [52.5985, -1.7735]);
  // a junction the table does not know yet: the event stays unplaced rather than guessed
  const unknown = H.placeEvent(H.parseEvents([{ road: 'M6', title: 'M6 northbound at J2' }])[0], JUNCTIONS);
  assert.equal(unknown.from, 'J2');
  assert.equal(unknown.lat, null);
  // the shipped junction table knows Spaghetti Junction
  const real = H.placeEvent(H.parseEvents(SAMPLE)[0]);
  assert.ok(real.lat !== null && Math.abs(real.lat - 52.509) < 0.05 && Math.abs(real.lon + 1.84) < 0.05, `placed with the real table: ${real.lat}, ${real.lon}`);
});

test('A38(M) is normalised from A38M and from the title, and M6 Toll to M6 TOLL', () => {
  assert.equal(H.roadName('A38M'), 'A38(M)');
  assert.equal(H.roadName('a38(m)'), 'A38(M)');
  assert.equal(H.roadName('M6 Toll'), 'M6 TOLL');
  assert.equal(H.roadName('m42'), 'M42');
  assert.equal(H.roadName('A5'), 'A5');
  assert.equal(H.roadFrom('A38(M) southbound at J1'), 'A38(M)');
  assert.equal(H.roadFrom('Queues on the M6 Toll northbound'), 'M6 TOLL');
  const e = H.placeEvent(H.parseEvents([{ road: 'A38M', title: 'A38(M) southbound at J1', direction: 'S' }])[0], JUNCTIONS);
  assert.equal(e.road, 'A38(M)');
  assert.equal(e.direction, 'southbound');
  assert.deepEqual([e.lat, e.lon], [52.4965, -1.8785]);
});

test('parseAlertsRss reads title, description and link with no XML library', () => {
  const ev = H.parseAlertsRss(RSS);
  assert.equal(ev.length, 2);
  const [a, b] = ev;
  assert.equal(a.id, 'alert-1');
  assert.equal(a.title, 'M6 southbound between J6 and J5 | Collision');
  assert.equal(a.road, 'M6');
  assert.equal(a.direction, 'southbound');
  assert.match(a.location, /J6 & J5 is closed following a collision/, 'CDATA, tags and entities handled');
  assert.doesNotMatch(a.location, /<p>/);
  assert.match(a.reason, /^The M6 southbound between J6 & J5 is closed following a collision\./);
  assert.equal(a.delayS, 40 * 60);
  assert.equal(a.normalBy, '14:30');
  assert.equal(a.lanesClosed, 'two lanes closed');
  assert.equal(a.start, Date.parse('Tue, 13 Oct 2026 07:00:00 GMT'));
  assert.equal(a.lat, null, 'the feed has no coordinates');
  assert.equal(b.id, 'https://nationalhighways.co.uk/travel-updates/2');
  assert.equal(b.road, 'M25');
  assert.equal(b.direction, 'anticlockwise');
  assert.equal(b.delayS, 3600);
  const placed = H.placeEvent(a, JUNCTIONS);
  assert.deepEqual([placed.from, placed.to], ['J6', 'J5']);
  assert.ok(placed.lat !== null);
  assert.deepEqual(H.parseAlertsRss('<rss><channel></channel></rss>'), []);
});

test('liveEvents caches for three minutes, falls back to the RSS after a 500, and keeps the last good answer', async () => {
  const calls = [];
  let apiStatus = 200;
  let rssStatus = 200;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push(url);
    if (url.pathname === '/trafficsearchapi/events') return new Response(apiStatus === 200 ? JSON.stringify(SAMPLE) : 'boom', { status: apiStatus, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/travel-alerts-rss') return new Response(rssStatus === 200 ? RSS : 'boom', { status: rssStatus, headers: { 'content-type': 'application/rss+xml' } });
    return new Response('not faked', { status: 599 });
  };
  const t0 = Date.parse('2026-10-13T07:00:00Z');
  const first = await H.liveEvents({ region: 'West Midlands', now: t0 });
  assert.equal(first.src, 'api');
  assert.equal(first.at, t0);
  assert.equal(first.credit, 'Contains public sector information licensed under the Open Government Licence v3.0 (National Highways)');
  assert.equal(first.events.length, 4);
  assert.ok(first.events[0].lat !== null, 'events come back placed');
  assert.equal(calls.length, 1);
  const req = calls[0];
  assert.equal(req.hostname, 'nationalhighways.co.uk');
  assert.equal(req.searchParams.get('region'), 'West Midlands');
  assert.equal(req.searchParams.get('limit'), '100');
  assert.equal(req.searchParams.get('page'), '1');
  // within three minutes: served from memory, no request
  const again = await H.liveEvents({ region: 'West Midlands', now: t0 + 2 * 60_000 });
  assert.equal(again.at, t0);
  assert.equal(calls.length, 1, 'no second request inside the cache window');
  // a road is a different key; the API gets the site's spelling of the road
  await H.liveEvents({ region: 'West Midlands', road: 'A38(M)', now: t0 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get('road'), 'A38M');
  // after the window, with the API down: the RSS stands in
  apiStatus = 500;
  const fallback = await H.liveEvents({ region: 'West Midlands', now: t0 + 4 * 60_000 });
  assert.equal(fallback.src, 'rss');
  assert.equal(fallback.at, t0 + 4 * 60_000);
  assert.deepEqual(calls.slice(2).map((u) => u.pathname), ['/trafficsearchapi/events', '/travel-alerts-rss']);
  assert.equal(fallback.events.length, 1, 'the feed is England-wide: only the West Midlands item is kept');
  assert.equal(fallback.events[0].road, 'M6');
  assert.ok(fallback.events[0].lat !== null, 'placed at its junctions');
  // both down: the last good answer, with its old time, rather than an error
  rssStatus = 503;
  const stale = await H.liveEvents({ region: 'West Midlands', now: t0 + 8 * 60_000 });
  assert.equal(stale.src, 'rss');
  assert.equal(stale.at, t0 + 4 * 60_000);
  // both down with nothing cached: a plain-English error
  await assert.rejects(H.liveEvents({ region: 'East', now: t0 }), /National Highways is not answering right now/);
});

test('typicalAt picks the weekday and quarter-hour slot in UK time and skips sites with no figure', () => {
  const grid = (fill) => Array.from({ length: 7 }, (_, d) => Array.from({ length: 96 }, (_, s) => fill(d, s)));
  const sites = [
    { id: 'a', name: 'M6 J6 southbound', road: 'M6', dir: 'southbound', lat: 52.51, lon: -1.87, mph: grid((d, s) => (d === 2 && s === 33 ? 48 : 70)), vol: grid((d, s) => (d === 2 && s === 33 ? 1200 : 300)) },
    { id: 'b', name: 'M6 J7 northbound', road: 'M6', dir: 'northbound', lat: 52.54, lon: -1.92, mph: grid(() => 0), vol: grid(() => 0) }, // no data: skipped
    { id: 'c', name: 'A38(M) J1', road: 'A38(M)', dir: 'southbound', lat: 52.4965, lon: -1.8785, mph: grid(() => 31), vol: grid(() => 500) },
    { id: 'd', name: 'M42 J7', road: 'M42', dir: 'clockwise', lat: 52.46, lon: -1.72, mph: grid(() => 65), vol: grid(() => 400) },
    { id: 'e', name: 'M5 J2', road: 'M5', dir: 'northbound', lat: 52.49, lon: -2.05, mph: grid(() => 60), vol: grid(() => 350) },
  ];
  // Tuesday 13 Oct 2026, 07:20 UTC = 08:20 British Summer Time → Tuesday (2), slot 33 (08:15–08:30)
  const when = new Date('2026-10-13T07:20:00Z');
  assert.deepEqual(H.ukSlot(when), { day: 2, slot: 33, label: 'Tuesday 08:15' });
  const got = H.typicalAt(sites, 52.5103, -1.869, when);
  assert.equal(got.length, 3);
  assert.equal(got[0].name, 'M6 J6 southbound');
  assert.equal(got[0].mph, 48, 'the Tuesday 08:15 figure, not the all-day one');
  assert.equal(got[0].vol, 1200);
  assert.ok(got[0].km < 0.2);
  assert.deepEqual(got.map((t) => t.name), ['M6 J6 southbound', 'A38(M) J1', 'M42 J7'], 'nearest first, the empty site skipped');
  // winter: 13 Jan 2026 is a Tuesday, 08:20 GMT = 08:20 local
  assert.deepEqual(H.ukSlot(new Date('2026-01-13T08:20:00Z')), { day: 2, slot: 33, label: 'Tuesday 08:15' });
  // Sunday is day 0
  assert.equal(H.ukSlot(new Date('2026-10-11T23:50:00Z')).day, 1, 'Sunday 23:50 UTC is already Monday 00:50 in BST');
  assert.equal(H.ukSlot(new Date('2026-10-11T12:00:00Z')).day, 0);
  assert.equal(H.parseTypical({ sites: [{ id: 'x', lat: 52, lon: -1, mph: [] }, { id: 'nope' }], period: 'Mar to Jun 2026' }).sites.length, 1);
  assert.equal(H.parseTypical('junk'), null);
});

const TYPICAL = {
  period: 'Mar to Jun 2026',
  sites: [
    { id: 'a', name: 'M6 J6 southbound', road: 'M6', dir: 'southbound', lat: 52.51, lon: -1.87, mph: Array.from({ length: 7 }, () => Array(96).fill(48)), vol: Array.from({ length: 7 }, () => Array(96).fill(900)) },
    { id: 'b', name: 'M6 J7 northbound', road: 'M6', dir: 'northbound', lat: 52.54, lon: -1.92, mph: Array.from({ length: 7 }, () => Array(96).fill(55)), vol: [] },
  ],
};

/** Fake network for the tool: the site API, the RSS, the phone's typical-speeds file and the map search. */
function fakeNet(opts = {}) {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push(url);
    const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/trafficsearchapi/events') return opts.api ? opts.api(url) : j(SAMPLE);
    if (url.pathname === '/travel-alerts-rss') return new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } });
    if (url.hostname === 'ghosty.test' && url.pathname === '/data/wm-typical.json') return opts.typical === false ? new Response('nope', { status: 404 }) : j(TYPICAL);
    if (url.hostname === 'nominatim.openstreetmap.org') {
      const q = url.searchParams.get('q').toLowerCase();
      if (q.includes('walsall')) return j([{ lat: '52.586', lon: '-1.982', display_name: 'Walsall, West Midlands, England', name: 'Walsall' }]);
      return j([]);
    }
    return new Response('not faked', { status: 599 });
  };
  return calls;
}

const ctxFor = (env = { PUBLIC_ORIGIN: 'https://ghosty.test' }) => {
  const events = [];
  return { events, ctx: { env, vault: { get: async () => null }, storage: { get: async () => undefined }, emit: (e) => events.push(e) } };
};

test('motorway_now lists the worst incidents by delay around a West Midlands place, pins them for God\'s Eye and credits National Highways', async () => {
  const tool = T.toolByName.get('motorway_now');
  assert.ok(tool, 'tool registered');
  assert.equal(tool.side ?? 'brain', 'brain');
  const calls = fakeNet();
  const { events, ctx } = ctxFor();
  const out = await tool.run({ place: 'Birmingham' }, ctx);
  assert.ok(out.startsWith('<<external content from National Highways'), 'wrapped as data');
  assert.match(out, /Contains public sector information licensed under the Open Government Licence v3\.0 \(National Highways\)/);
  assert.match(out, /4 incidents on the roads around Birmingham \(within 15 km\) right now/);
  assert.match(out, /- M6 southbound J6 to J5: congestion, 19 min delay, 2 lanes closed, clear by 13:45 to 14:00/);
  assert.match(out, /- M6 northbound J7: broken down vehicle, 5 min delay, 1 lane closed/);
  assert.match(out, /- A38\(M\) southbound J1: roadworks, 1 min delay/);
  assert.match(out, /- M5 northbound, Oldbury area: incident \(exact spot not given\)/);
  const order = ['J6 to J5', 'J7: broken', 'A38(M) southbound', 'M5 northbound'].map((s) => out.indexOf(s));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'ordered by delay, worst first');
  assert.match(out, /Usually at this time: M6 J6 southbound about 48 mph, 900 vehicles in that quarter-hour; M6 J7 northbound about 55 mph \((Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day \d\d:\d\d average, Mar to Jun 2026; from past traffic counts, not live\)/);
  assert.match(out, /live map \(Waze\) and TomTom give road-by-road speeds/);
  // the West Midlands list was asked for, and the typical file came from Ghosty's own address
  const api = calls.find((u) => u.pathname === '/trafficsearchapi/events');
  assert.equal(api.searchParams.get('region'), 'West Midlands');
  assert.ok(calls.some((u) => u.hostname === 'ghosty.test' && u.pathname === '/data/wm-typical.json'));
  // God's Eye gets the placed events with coordinates
  assert.deepEqual(events.map((e) => e.name), ['show_incidents']);
  const args = events[0].args;
  assert.equal(args.place, 'Birmingham');
  assert.equal(args.range_km, 15);
  assert.ok(args.events.length >= 2 && args.events.length <= 3, `only events with a spot are drawn: ${args.events.length}`);
  assert.ok(args.events.some((e) => e.id === 'ev-2') && !args.events.some((e) => e.id === 'ev-4'));
  assert.ok(args.events.every((e) => typeof e.lat === 'number' && typeof e.lon === 'number'));
  assert.deepEqual(Object.keys(args.events[0]).sort(), ['delayS', 'direction', 'id', 'lanesClosed', 'lat', 'lon', 'normalBy', 'reason', 'road', 'title']);
  const spaghetti = args.events.find((e) => e.id === 'ev-1');
  assert.ok(Math.abs(spaghetti.lat - 52.509) < 0.05 && Math.abs(spaghetti.lon + 1.84) < 0.05, `placed at Spaghetti Junction: ${spaghetti.lat}, ${spaghetti.lon}`);
});

test('motorway_now works for a road with no place, for a place outside the West Midlands, and says when typical speeds are missing', async () => {
  const tool = T.toolByName.get('motorway_now');
  fakeNet();
  // a road alone: the whole road, no place needed
  let { events, ctx } = ctxFor();
  let out = await tool.run({ road: 'M6' }, ctx);
  assert.match(out, /incidents? on the M6 right now/);
  assert.match(out, /M6 southbound J6 to J5/);
  assert.doesNotMatch(out, /A38\(M\) southbound J1/, 'other roads filtered out');
  assert.equal(events[0].name, 'show_incidents');
  // a road with a place the map search cannot find: the whole road, and it says why
  ({ events, ctx } = ctxFor());
  out = await tool.run({ road: 'M6', place: 'Nowhereville' }, ctx);
  assert.match(out, /I couldn't find "Nowhereville" on the map, so this is the whole M6\./);
  // outside the West Midlands: honest about not placing, England-wide list
  ({ events, ctx } = ctxFor());
  out = await tool.run({ place: 'London' }, ctx);
  assert.match(out, /0 incidents placed within 15 km of London/);
  assert.match(out, /only pin National Highways incidents to the map around the West Midlands/);
  assert.match(out, /M6 southbound J6 to J5: congestion, 19 min delay/);
  // no PUBLIC_ORIGIN: typical speeds are not available, and it says so
  ({ events, ctx } = ctxFor({}));
  out = await tool.run({ place: 'Birmingham' }, ctx);
  assert.match(out, /Typical speeds for this time of day are not available: Ghosty's public address \(PUBLIC_ORIGIN\) is not set/);
  // the file is missing on a different origin
  fakeNet({ typical: false });
  ({ events, ctx } = ctxFor({ PUBLIC_ORIGIN: 'https://ghosty.test/' }));
  out = await tool.run({ place: 'Walsall' }, ctx);
  assert.match(out, /around Walsall/);
  assert.match(out, /M6 southbound J6 to J5/, 'Spaghetti Junction is within 15 km of Walsall');
  assert.match(out, /Usually at this time: M6 J7 northbound about 55 mph; M6 J6 southbound about 48 mph/, 'nearest first; the typical file is kept in memory for a day');
});

test('motorway_now clips long answers and falls back to the RSS when the site API is down', async () => {
  const tool = T.toolByName.get('motorway_now');
  const long = { data: Array.from({ length: 30 }, (_, i) => event({ id: `long-${i}`, road: 'M42', direction: 'CW', title: `M42 clockwise between J7 and J6 ${'queueing traffic '.repeat(30)}`, reason: `Congestion ${'with very slow traffic '.repeat(20)}`, delay: 6000 - i * 60 })) };
  fakeNet({ api: () => new Response(JSON.stringify(long), { headers: { 'content-type': 'application/json' } }) });
  // a fresh cache key: a road the earlier tests did not ask for
  let { ctx } = ctxFor();
  let out = await tool.run({ place: 'Birmingham', road: 'M42', radius_km: 20 }, ctx);
  assert.match(out, /30 incidents on the M42 within 20 km of Birmingham/);
  assert.ok(out.length <= 4500 + 60, `clipped: ${out.length}`);
  assert.match(out, /\[truncated, \d+ more characters\]/);
  assert.match(out, /Open Government Licence v3\.0 \(National Highways\)/, 'the credit line survives the clip');
  // the API down: the breaking-news feed stands in and the answer says so
  fakeNet({ api: () => new Response('boom', { status: 500 }) });
  ({ ctx } = ctxFor());
  out = await tool.run({ place: 'Birmingham', road: 'M5', radius_km: 20 }, ctx);
  assert.match(out, /breaking-news feed — major incidents only/);
  assert.match(out, /0 incidents on the M5/);
  ({ ctx } = ctxFor());
  out = await tool.run({ place: 'Birmingham', road: 'M6 Toll' }, ctx);
  assert.match(out, /0 incidents on the M6 TOLL/);
});

test('motorway_now is offered when the owner asks about the motorway', () => {
  const names = (msg) => T.selectTools(msg, new Set()).map((t) => t.name);
  assert.ok(names("what's happening on the M6 right now?").includes('motorway_now'));
});
