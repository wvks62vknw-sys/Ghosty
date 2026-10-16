// The interface's West Midlands data modules, pure parts: the ROAD AHEAD cone, incidents parsing and
// severity, transit dead reckoning and counts. No network, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const R = await import('./.build/roadahead.mjs');
const I = await import('./.build/incidents.mjs');
const T = await import('./.build/transit.mjs');

test('ROAD AHEAD: heading comes from movement when the fix has none; the cone keeps what is in front', () => {
  const ra = new R.RoadAhead();
  ra.update(52.505, -1.9, null, null, 10, 1000);
  assert.equal(ra.me.heading, null, 'standing at the first fix');
  ra.update(52.5052, -1.88, null, 5, 10, 11000); // moved east
  assert.ok(ra.me.heading > 70 && ra.me.heading < 110, `east: ${ra.me.heading}`);
  assert.equal(R.cardinal(ra.me.heading), 'E');
  assert.equal(R.mph(13.4), '30 mph');
  const items = [
    { name: 'ahead east', lat: 52.506, lon: -1.84 },
    { name: 'behind west', lat: 52.505, lon: -1.97 },
    { name: 'far east', lat: 52.5, lon: -1.2 },
    { name: 'north', lat: 52.6, lon: -1.88 },
  ];
  const ahead = ra.ahead(items, 15, 60);
  assert.deepEqual(ahead.map((x) => x.name), ['ahead east']);
  // a fix that says it is heading north overrides the trail
  ra.update(52.5053, -1.879, 0, 5, 10, 12000);
  assert.equal(ra.me.heading, 0);
  assert.deepEqual(ra.ahead(items, 15, 60).map((x) => x.name), ['north']);
  // stopped at the lights: the last heading is kept, so the cone still points the way the car faces
  ra.update(52.5053, -1.879, null, 0, 10, 13000);
  assert.equal(ra.me.heading, 0);
  assert.deepEqual(ra.ahead(items, 15, 60).map((x) => x.name), ['north']);
  assert.equal(ra.trail.length, 4);
  // no heading at all (one fix, never moved): everything within range, nearest first
  const fresh = new R.RoadAhead();
  fresh.update(52.505, -1.9, null, null, 10, 1000);
  assert.deepEqual(fresh.ahead(items, 15, 60).map((x) => x.name), ['ahead east', 'behind west', 'north']);
});

test('incidents: parsed defensively, placed ones only; severity from closures, lanes and delay', () => {
  const list = I.parseIncidents({ events: [
    { id: 'a', road: 'M6', direction: 'S', title: 'M6 southbound between J6 and J5', reason: 'Congestion', delayS: 1140, lanesClosed: '0|0|0', lat: 52.509, lon: -1.838, normalBy: 'by 13:45' },
    { id: 'b', road: 'M42', title: 'no coordinates', reason: 'Roadworks' },
    { id: 'c', road: 'M5', title: 'M5 northbound J2', reason: 'Road closed', delayS: 0, lanesClosed: '', lat: '52.49', lon: '-2.03' },
    { id: 'd', road: 'M6', title: 'M6 J7', reason: 'Collision', delayS: 400, lanesClosed: '2|0|0', lat: 52.54, lon: -1.91 },
    null,
  ] });
  assert.deepEqual(list.map((i) => i.id), ['a', 'c', 'd']);
  assert.equal(I.severity(list[0]), 1, '19 min delay');
  assert.equal(I.severity(list[1]), 3, 'closed');
  assert.equal(I.severity(list[2]), 2, 'two lanes closed');
  assert.equal(I.lanesClosedCount('2 lanes closed'), 2);
  assert.equal(I.lanesClosedCount('two lanes closed'), 2);
  assert.equal(I.lanesClosedCount('1 lane closed'), 1);
  assert.equal(I.lanesClosedCount('1|0|3'), 1);
  assert.equal(I.lanesClosedCount('0|0|0'), 0);
  assert.equal(I.lanesClosedCount(''), 0);
  assert.equal(I.severity({ ...list[0], lanesClosed: '2 lanes closed', delayS: 0 }), 2, 'lane text counts lanes, not digits');
  assert.equal(I.severity({ ...list[0], lanesClosed: '1 lane closed', delayS: 0 }), 1);
  assert.equal(I.delayWords(1140), '19 min');
  assert.equal(I.delayWords(5400), '1.5 h');
  const feed = new I.IncidentFeed();
  let changes = 0;
  feed.events.on('change', () => changes++);
  assert.equal(feed.seed({ events: list }), 3);
  assert.equal(feed.status, 'LIVE');
  assert.equal(changes, 1);
  assert.deepEqual(feed.worst(2).map((i) => i.id), ['c', 'd']);
  assert.deepEqual(feed.near(52.51, -1.84, 3).map((i) => i.id), ['a']);
});

test('transit: dead reckoning along the bearing for at most a minute; counts and nearest', () => {
  const t = new T.TransitFeed();
  const now = 1_000_000;
  const bus = { id: 'b1', kind: 'bus', line: '11A', dest: 'Outer Circle', operator: 'NXWM', lat: 52.48, lon: -1.9, bearing: 90, speedMs: 10, t: now - 30_000, delayS: 180, src: 'bustimes.org' };
  const tram = { id: 't1', kind: 'tram', line: 'MM1', dest: 'Wolverhampton', operator: 'Metro', lat: 52.4835, lon: -1.9005, bearing: null, speedMs: null, t: now, delayS: 0, src: 'bustimes.org' };
  t.list.set(bus.id, bus);
  t.list.set(tram.id, tram);
  const p = t.pos(bus, now);
  assert.ok(p.lon > -1.9 && p.lon < -1.89, `moved east ~300 m: ${p.lon}`);
  assert.ok(Math.abs(p.lat - 52.48) < 0.0005);
  const far = t.pos(bus, now + 3600_000);
  assert.ok(far.lon - (-1.9) < 0.01, 'capped at a minute of motion');
  assert.deepEqual(t.pos(tram, now), tram, 'no bearing: stays put');
  assert.deepEqual(t.counts(), { bus: 1, tram: 1, lines: 2 });
  assert.deepEqual(t.near(52.4835, -1.9005, 0.1, now).map((v) => v.id), ['t1']);
  assert.equal(t.find('11a')?.id, 'b1');
  assert.equal(T.delayText(180), '3 min late');
  assert.equal(T.delayText(-120), '2 min early');
  assert.equal(T.delayText(20), 'on time');
  assert.equal(T.delayText(null), '');
});

test('transit: the box asked of the brain never exceeds its 1.5-degree limit, even zoomed out over Birmingham', async () => {
  const asked = [];
  globalThis.fetch = async (input) => {
    asked.push(new URL(String(typeof input === 'string' ? input : input.url), 'http://x').searchParams.get('bbox'));
    return new Response(JSON.stringify({ vehicles: [], src: null, credit: '', at: 1 }), { headers: { 'content-type': 'application/json' } });
  };
  const t = new T.TransitFeed();
  await t.refresh(52.48, -1.9, 110);
  assert.equal(asked.length, 1);
  const [w, s, e, n] = asked[0].split(',').map(Number);
  assert.ok(e - w <= 1.5 && e - w > 1.4, `longitude span ${e - w}`);
  assert.ok(n - s <= 1.5 && n - s > 1.1, `latitude span ${n - s}`);
  await t.refresh(52.48, -1.9, 130);
  assert.equal(asked.length, 1, 'too far out: not asked at all');
  await t.refresh(52.48, -1.9, 110);
  assert.equal(asked.length, 1, 'the same box within 20 s is not asked again');
});
