// Live buses and trams: the hand-written GTFS-realtime decoder against bytes encoded here
// (independently of it), the TfWM key shape, source choice (TfWM → BODS → bustimes.org) with the
// network faked, bbox and staleness filters, tram detection, the exact credit lines, the cache,
// the /transit route and the transit_now tool's text and God's Eye hand-off.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const G = await import('./.build/integrations/gtfsrt.mjs');
const X = await import('./.build/integrations/transit.mjs');
const T = await import('./.build/tools/index.mjs');

// ---- A tiny protobuf encoder, written here so the decoder is checked against something it did not write.
const enc = new TextEncoder();
const varint = (n) => {
  let v = BigInt(n);
  if (v < 0n) v += 1n << 64n; // negative ints are sign-extended to 64 bits
  const out = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
};
const tag = (field, wire) => varint((field << 3) | wire);
const ld = (field, arr) => [...tag(field, 2), ...varint(arr.length), ...arr];
const str = (field, s) => ld(field, [...enc.encode(s)]);
const msg = (field, parts) => ld(field, parts.flat());
const uint = (field, n) => [...tag(field, 0), ...varint(n)];
const f32 = (field, x) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, x, true);
  return [...tag(field, 5), ...b];
};
const f64 = (field, x) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, x, true);
  return [...tag(field, 1), ...b];
};

const T0 = 1_760_000_000; // a header time, unix seconds

/** A VehiclePosition entity. */
const vehicleEntity = (id, { trip, route, vehId, label, lat, lon, bearing, speed, seq, status, t, occupancy, odometer }) =>
  msg(2, [
    str(1, id),
    msg(4, [
      trip || route ? msg(1, [trip ? str(1, trip) : [], route ? str(5, route) : [], uint(6, 0), str(3, '20261016')]) : [],
      msg(2, [f32(1, lat), f32(2, lon), bearing === undefined ? [] : f32(3, bearing), odometer === undefined ? [] : f64(4, odometer), speed === undefined ? [] : f32(5, speed)]),
      seq === undefined ? [] : uint(3, seq),
      status === undefined ? [] : uint(4, status),
      t === undefined ? [] : uint(5, t),
      vehId || label ? msg(8, [vehId ? str(1, vehId) : [], label ? str(2, label) : []]) : [],
      occupancy === undefined ? [] : uint(9, occupancy),
    ]),
  ]);

/** A TripUpdate entity with stops [{seq, stopId, arrival, arrivalDelay, departure}]. */
const tripEntity = (id, { trip, route, vehId, stops, delay, t }) =>
  msg(2, [
    str(1, id),
    msg(3, [
      msg(1, [str(1, trip), str(5, route)]),
      ...stops.map((s) =>
        msg(2, [
          uint(1, s.seq),
          str(4, s.stopId),
          s.arrival === undefined ? [] : msg(2, [s.arrivalDelay === undefined ? [] : uint(1, s.arrivalDelay), uint(2, s.arrival), uint(3, 30)]),
          s.departure === undefined ? [] : msg(3, [uint(2, s.departure)]),
          uint(5, 0),
        ]),
      ),
      vehId ? msg(3, [str(1, vehId)]) : [],
      t === undefined ? [] : uint(4, t),
      delay === undefined ? [] : uint(5, delay),
    ]),
  ]);

const header = (t) => msg(1, [str(1, '2.0'), uint(2, 0), uint(3, t)]);
const feed = (...entities) => new Uint8Array([header(T0), ...entities].flat());

const BUS1 = { trip: 'trip1', route: '11A', vehId: 'bus1', label: '1234', lat: 52.481, lon: -1.9, bearing: 90, speed: 8.5, seq: 7, status: 2, t: T0 - 20, occupancy: 3, odometer: 12345.5 };
const TRAM1 = { trip: 'trip2', route: 'MM1', vehId: 'tram1', lat: 52.478, lon: -1.905, t: T0 - 40 };

test('decodeFeed reads the header time, vehicle positions (with and without bearing/speed) and a trip update', () => {
  const bytes = feed(
    vehicleEntity('A', BUS1),
    vehicleEntity('B', TRAM1),
    tripEntity('C', { trip: 'trip1', route: '11A', vehId: 'bus1', stops: [{ seq: 7, stopId: 'stopA', arrival: T0 + 300, arrivalDelay: 180 }, { seq: 8, stopId: 'stopB', departure: T0 + 400 }], delay: -60, t: T0 - 5 }),
    // an alert entity and an unknown field on the message itself: both skipped
    msg(2, [str(1, 'D'), msg(5, [str(1, 'closed road')])]),
    [...tag(9, 1), 1, 2, 3, 4, 5, 6, 7, 8],
    // a deleted entity is dropped
    msg(2, [str(1, 'E'), uint(2, 1), msg(4, [msg(2, [f32(1, 52.5), f32(2, -1.9)])])]),
  );
  const out = G.decodeFeed(bytes);
  assert.equal(out.headerTime, T0);
  assert.equal(out.vehicles.length, 2);
  const [a, b] = out.vehicles;
  assert.equal(a.id, 'bus1');
  assert.equal(a.routeId, '11A');
  assert.equal(a.tripId, 'trip1');
  assert.equal(a.label, '1234');
  assert.ok(Math.abs(a.lat - 52.481) < 1e-4 && Math.abs(a.lon + 1.9) < 1e-4);
  assert.ok(Math.abs(a.bearing - 90) < 1e-4);
  assert.ok(Math.abs(a.speedMs - 8.5) < 1e-4);
  assert.equal(a.stopSeq, 7);
  assert.equal(a.status, 2);
  assert.equal(a.t, (T0 - 20) * 1000);
  assert.equal(a.occupancy, 3);
  assert.equal(b.id, 'tram1');
  assert.equal(b.routeId, 'MM1');
  assert.equal(b.bearing, null);
  assert.equal(b.speedMs, null);
  assert.equal(b.stopSeq, null);
  assert.equal(b.occupancy, null);
  assert.equal(out.trips.length, 1);
  const tu = out.trips[0];
  assert.equal(tu.tripId, 'trip1');
  assert.equal(tu.routeId, '11A');
  assert.equal(tu.vehicleId, 'bus1');
  assert.equal(tu.delay, -60, 'a negative int32 decodes exactly');
  assert.equal(tu.t, (T0 - 5) * 1000);
  assert.deepEqual(tu.stops, [
    { stopId: 'stopA', seq: 7, arrival: T0 + 300, departure: null, delay: 180 },
    { stopId: 'stopB', seq: 8, arrival: null, departure: T0 + 400, delay: null },
  ]);
});

test('decodeFeed: a vehicle with no timestamp takes the header time; one with no position is dropped', () => {
  const out = G.decodeFeed(feed(vehicleEntity('A', { route: '50', lat: 52.4, lon: -1.9 }), msg(2, [str(1, 'B'), msg(4, [msg(1, [str(1, 'tripX')])])])));
  assert.equal(out.vehicles.length, 1);
  assert.equal(out.vehicles[0].t, T0 * 1000);
  assert.equal(out.vehicles[0].id, 'A', 'the entity id stands in when the vehicle has none');
});

test('decodeFeed throws a plain Error on truncated or malformed bytes, and never hangs', () => {
  const bytes = feed(vehicleEntity('A', BUS1), vehicleEntity('B', TRAM1));
  for (const cut of [bytes.length - 1, bytes.length - 7, 25, 3, 1]) assert.throws(() => G.decodeFeed(bytes.subarray(0, cut)), /truncated|bad GTFS/);
  assert.throws(() => G.decodeFeed(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])), Error);
  assert.throws(() => G.decodeFeed(new Uint8Array([0x00])), /field number/);
  assert.throws(() => G.decodeFeed(new Uint8Array([0x0b])), /wire type/); // field 1, wire 3 (a group)
  assert.deepEqual(G.decodeFeed(new Uint8Array(0)), { headerTime: null, vehicles: [], trips: [] });
});

test('decodeFeed stops at 20,000 entities', () => {
  const one = vehicleEntity('x', { lat: 52.4, lon: -1.9 });
  const many = new Array(20_050).fill(one);
  const out = G.decodeFeed(feed(...many));
  assert.equal(out.vehicles.length, 20_000);
});

test('parseTfwmKey accepts "id key" or "id:key" and nothing else', () => {
  assert.deepEqual(X.parseTfwmKey('abc123 0123456789abcdef'), { id: 'abc123', key: '0123456789abcdef' });
  assert.deepEqual(X.parseTfwmKey('  abc123:0123456789abcdef '), { id: 'abc123', key: '0123456789abcdef' });
  assert.deepEqual(X.parseTfwmKey('app_id=abc123 app_key=0123456789abcdef'), { id: 'abc123', key: '0123456789abcdef' });
  assert.equal(X.parseTfwmKey('0123456789abcdef'), null);
  assert.equal(X.parseTfwmKey('a b c'), null);
  assert.equal(X.parseTfwmKey(''), null);
});

// ---- The network, faked.
const calls = [];
let tfwmStatus = 200;
let tfwmFirstHostFails = false;
let bodsStatus = 200;
let bustimesBody = null;
const BBOX_BHAM = [-1.95, 52.45, -1.85, 52.52]; // Birmingham city centre
const BBOX_LONDON = [-0.2, 51.45, -0.05, 51.55];
const NOW = (T0 + 60) * 1000; // "now" is a minute after the header

const gtfsResponse = (bytes, status = 200) => new Response(status === 200 ? bytes : 'no', { status, headers: { 'content-type': 'application/x-protobuf' } });
const tfwmFeed = () =>
  feed(
    vehicleEntity('A', BUS1),
    vehicleEntity('B', TRAM1),
    vehicleEntity('C', { route: '50', vehId: 'bus50', lat: 52.46, lon: -1.9, t: T0 }),
    vehicleEntity('OUT', { route: '9', vehId: 'far', lat: 52.6, lon: -2.1, t: T0 }), // outside the box
    vehicleEntity('OLD', { route: '11A', vehId: 'old', lat: 52.48, lon: -1.9, t: T0 - 900 }), // 16 minutes old
    tripEntity('TU', { trip: 'trip1', route: '11A', vehId: 'bus1', stops: [{ seq: 7, stopId: 'stopA', arrival: T0 + 300, arrivalDelay: 180 }], t: T0 }),
  );
const bodsFeed = () => feed(vehicleEntity('L1', { route: '4321', vehId: 'LX1', lat: 51.5, lon: -0.12, t: T0 }), vehicleEntity('L2', { route: '4321', vehId: 'LX2', lat: 51.51, lon: -0.1, bearing: 45, speed: 5, t: T0 }), vehicleEntity('L3', { route: '88', vehId: 'LX3', lat: 51.52, lon: -0.15, t: T0 }));

globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  calls.push(url);
  if (url.hostname === 'api-realtime-odp.tfwm.itoworld.com') {
    if (tfwmFirstHostFails) throw new TypeError('fetch failed: certificate has expired');
    if (url.searchParams.get('app_id') !== 'myid' || url.searchParams.get('app_key') !== 'mysecretkey1') return gtfsResponse(null, 403);
    return gtfsResponse(tfwmFeed(), tfwmStatus);
  }
  if (url.hostname === 'api.tfwm.org.uk') {
    if (url.searchParams.get('app_id') !== 'myid' || url.searchParams.get('app_key') !== 'mysecretkey1') return gtfsResponse(null, 403);
    return gtfsResponse(tfwmFeed(), tfwmStatus);
  }
  if (url.hostname === 'data.bus-data.dft.gov.uk') {
    if (url.searchParams.get('api_key') !== 'BODSKEY') return gtfsResponse(null, 401);
    return gtfsResponse(bodsFeed(), bodsStatus);
  }
  if (url.hostname === 'bustimes.org') {
    const body = bustimesBody ?? [
      { id: 101, coordinates: [-1.9, 52.48], heading: 180, datetime: new Date(NOW - 30_000).toISOString(), destination: 'Perry Barr', service: { line_name: '11A' }, vehicle: { name: '4321 - BX11 AAA', livery: 1 }, delay: 240 },
      { id: 102, coordinates: [-1.905, 52.478], heading: null, datetime: new Date(NOW - 40_000).toISOString(), destination: 'Wolverhampton', service: { line_name: 'MM1' }, vehicle: { name: '17 Tram' }, delay: 0 },
      { id: 103, coordinates: [-1.89, 52.49], heading: '20', datetime: new Date(NOW - 20 * 60_000).toISOString(), destination: 'Old', service: { line_name: '50' }, vehicle: {}, delay: null }, // stale
      { id: 104, coordinates: [-2.3, 52.3], heading: 0, datetime: new Date(NOW).toISOString(), destination: 'Far', service: { line_name: '1' }, vehicle: {} }, // outside the box
    ];
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  }
  if (url.hostname === 'nominatim.openstreetmap.org') return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
  return new Response('not faked', { status: 599 });
};

const reset = () => {
  calls.length = 0;
  tfwmStatus = 200;
  tfwmFirstHostFails = false;
  bodsStatus = 200;
  bustimesBody = null;
  X._testing.resetCache();
};

test('vehiclesIn prefers TfWM in the West Midlands: app_id/app_key on the URL, box and staleness filters, trams, the exact credit', async () => {
  reset();
  const out = await X.vehiclesIn(BBOX_BHAM, { tfwm: 'myid mysecretkey1', bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, 'TfWM');
  assert.equal(out.credit, 'Powered by TfWM part of West Midlands Combined Authority Open Data');
  assert.equal(out.note, '');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'api-realtime-odp.tfwm.itoworld.com');
  assert.equal(calls[0].pathname, '/gtfs/vehicle_positions');
  assert.equal(calls[0].searchParams.get('app_id'), 'myid');
  assert.equal(calls[0].searchParams.get('app_key'), 'mysecretkey1');
  const ids = out.vehicles.map((v) => v.id).sort();
  assert.deepEqual(ids, ['TfWM:bus1', 'TfWM:bus50', 'TfWM:tram1'], 'outside-the-box and 16-minute-old vehicles dropped');
  const tram = out.vehicles.find((v) => v.id === 'TfWM:tram1');
  assert.equal(tram.kind, 'tram');
  assert.equal(tram.line, 'MM1');
  const bus = out.vehicles.find((v) => v.id === 'TfWM:bus1');
  assert.equal(bus.kind, 'bus');
  assert.equal(bus.line, '11A');
  assert.equal(bus.bearing, 90);
  assert.ok(Math.abs(bus.speedMs - 8.5) < 1e-4);
  assert.equal(bus.t, (T0 - 20) * 1000, 'GTFS seconds become ms');
  assert.equal(bus.delayS, 180, 'a bundled trip update gives the delay');
  assert.equal(out.vehicles.find((v) => v.id === 'TfWM:bus50').delayS, null);
});

test('vehiclesIn never sends the TfWM key over plain HTTP: a TLS failure on the HTTPS host moves on to the next feed', async () => {
  reset();
  tfwmFirstHostFails = true;
  const out = await X.vehiclesIn(BBOX_BHAM, { tfwm: 'myid:mysecretkey1', bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, 'BODS', 'the next keyed feed answers instead');
  assert.deepEqual(
    calls.map((u) => `${u.protocol}//${u.hostname}`),
    ['https://api-realtime-odp.tfwm.itoworld.com', 'https://data.bus-data.dft.gov.uk'],
  );
  assert.ok(calls.every((u) => u.protocol === 'https:'), 'the owner\'s key only ever rides on HTTPS');
  assert.match(out.note, /TfWM's live feed did not answer/);
});

test('vehiclesIn uses BODS when TfWM has no key or the place is outside the West Midlands; the exact credit', async () => {
  reset();
  let out = await X.vehiclesIn(BBOX_LONDON, { tfwm: 'myid mysecretkey1', bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, 'BODS');
  assert.equal(out.credit, 'Bus Open Data Service (Department for Transport), Open Government Licence v3.0');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'data.bus-data.dft.gov.uk');
  assert.equal(calls[0].searchParams.get('boundingBox'), '-0.2000,51.4500,-0.0500,51.5500');
  assert.equal(calls[0].searchParams.get('api_key'), 'BODSKEY');
  assert.equal(out.vehicles.length, 3);
  assert.ok(out.vehicles.every((v) => v.src === 'BODS' && v.kind === 'bus'));
  assert.match(out.note, /only covers the West Midlands/);
  reset();
  out = await X.vehiclesIn(BBOX_BHAM, { bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, 'BODS');
  assert.equal(out.note, '');
});

test('vehiclesIn with no key at all uses bustimes.org: the box on the URL, the mapping, the exact credit and an honest note', async () => {
  reset();
  const out = await X.vehiclesIn(BBOX_BHAM, {}, { now: NOW });
  assert.equal(out.src, 'bustimes.org');
  assert.equal(out.credit, 'bustimes.org (community data from the Bus Open Data Service)');
  assert.match(out.note, /No transport key yet: showing bustimes.org's community feed, updated about once a minute/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'bustimes.org');
  assert.equal(calls[0].pathname, '/vehicles.json');
  assert.equal(calls[0].searchParams.get('ymin'), '52.4500');
  assert.equal(calls[0].searchParams.get('ymax'), '52.5200');
  assert.equal(calls[0].searchParams.get('xmin'), '-1.9500');
  assert.equal(calls[0].searchParams.get('xmax'), '-1.8500');
  assert.deepEqual(out.vehicles.map((v) => v.id), ['bustimes:101', 'bustimes:102'], 'stale and outside-the-box vehicles dropped');
  const [bus, tram] = out.vehicles;
  assert.equal(bus.kind, 'bus');
  assert.equal(bus.line, '11A');
  assert.equal(bus.dest, 'Perry Barr');
  assert.equal(bus.bearing, 180);
  assert.equal(bus.delayS, 240);
  assert.equal(bus.lat, 52.48);
  assert.equal(bus.lon, -1.9);
  assert.equal(tram.kind, 'tram');
  assert.equal(tram.bearing, null);
  assert.equal(tram.delayS, 0);
  // polled no more than once a minute for the same box
  await X.vehiclesIn(BBOX_BHAM, {}, { now: NOW });
  assert.equal(calls.length, 1, 'the second ask within a minute reuses the answer');
});

test('vehiclesIn says so and moves on when a keyed feed fails; a wrong key is reported', async () => {
  reset();
  tfwmStatus = 500;
  let out = await X.vehiclesIn(BBOX_BHAM, { tfwm: 'myid mysecretkey1', bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, 'BODS');
  assert.match(out.note, /TfWM's live feed did not answer \(TfWM answered 500\)/);
  assert.deepEqual(calls.map((u) => u.hostname), ['api-realtime-odp.tfwm.itoworld.com', 'data.bus-data.dft.gov.uk']);
  reset();
  out = await X.vehiclesIn(BBOX_BHAM, { tfwm: 'myid WRONGKEY123' }, { now: NOW });
  assert.equal(out.src, 'bustimes.org');
  assert.match(out.note, /TfWM did not accept the key/);
  assert.match(out.note, /community feed instead/);
  assert.equal(calls.filter((u) => u.hostname.includes('tfwm')).length, 1, 'a rejected key is not retried on the other host');
  reset();
  out = await X.vehiclesIn(BBOX_BHAM, { tfwm: 'justonetoken' }, { now: NOW });
  assert.equal(out.src, 'bustimes.org');
  assert.match(out.note, /not in the right shape/);
  reset();
  bodsStatus = 503;
  bustimesBody = 'not a list';
  out = await X.vehiclesIn(BBOX_LONDON, { bods: 'BODSKEY' }, { now: NOW });
  assert.equal(out.src, null);
  assert.deepEqual(out.vehicles, []);
  assert.match(out.note, /Bus Open Data feed did not answer/);
  assert.match(out.note, /bustimes.org did not answer either/);
});

test('cachedVehicles: one load in flight per box, kept for the ttl, at most 40 boxes', async () => {
  X._testing.resetCache();
  let loads = 0;
  const load = async () => {
    loads++;
    await new Promise((r) => setTimeout(r, 5));
    return { n: loads };
  };
  const [a, b] = await Promise.all([X.cachedVehicles('box1', 30_000, load), X.cachedVehicles('box1', 30_000, load)]);
  assert.equal(loads, 1);
  assert.deepEqual(a, { n: 1 });
  assert.equal(a, b, 'the same in-flight promise answers both');
  assert.deepEqual(await X.cachedVehicles('box1', 30_000, load), { n: 1 }, 'kept for the ttl');
  assert.deepEqual(await X.cachedVehicles('box1', 0, load), { n: 2 }, 'a ttl of 0 reloads');
  await assert.rejects(X.cachedVehicles('bad', 30_000, async () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(await X.cachedVehicles('bad', 30_000, async () => 'ok'), 'ok', 'a failed load is not cached');
  for (let i = 0; i < 45; i++) await X.cachedVehicles(`b${i}`, 30_000, async () => i);
  assert.equal(X._testing.cacheSize(), 40);
  assert.equal(await X.cachedVehicles('b44', 30_000, async () => 'reloaded'), 44, 'the newest boxes stay');
  assert.equal(await X.cachedVehicles('b0', 30_000, async () => 'reloaded'), 'reloaded', 'the oldest were dropped');
});

test('/transit route: parses the bbox, refuses wide or broken boxes, answers vehicles with credit, note and at', async () => {
  reset();
  const vault = { get: async (k) => ({ tfwm: 'myid mysecretkey1' })[k] ?? null };
  const bad = await X.transitRoute(new URL('https://x/transit?bbox=1,2,3'), vault);
  assert.match(bad.error, /bbox must be/);
  const wide = await X.transitRoute(new URL('https://x/transit?bbox=-3,52,-1,53'), vault);
  assert.match(wide.error, /zoom in/);
  const inside = await X.transitRoute(new URL('https://x/transit?bbox=-1.85,52.45,-1.95,52.52'), vault);
  assert.match(inside.error, /min below max/);
  // The route reads the real clock; the fixture's feed is stamped at T0, so make that "now".
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const ok = await X.transitRoute(new URL(`https://x/transit?bbox=${BBOX_BHAM.join(',')}`), vault);
    assert.equal(ok.src, 'TfWM');
    assert.equal(ok.credit, 'Powered by TfWM part of West Midlands Combined Authority Open Data');
    assert.equal(ok.vehicles.length, 3);
    assert.equal(ok.at, NOW);
    const n = calls.length;
    const again = await X.transitRoute(new URL(`https://x/transit?bbox=${BBOX_BHAM.join(',')}`), vault);
    assert.equal(again.at, ok.at, 'the same box within 30 s is served from the cache');
    assert.equal(calls.length, n);
  } finally {
    Date.now = realNow;
  }
});

// ---- The brain tool.
const ctxFor = (keys = {}) => {
  const events = [];
  return { events, ctx: { vault: { get: async (k) => keys[k] ?? null }, storage: { get: async () => undefined }, emit: (e) => events.push(e) } };
};

test('transit_now: counts by kind, the lines running, the nearest with distance and delay in words, the globe hand-off, the trains sentence', async () => {
  reset();
  const tool = T.toolByName.get('transit_now');
  assert.ok(tool, 'registered through extra.ts');
  assert.equal(tool.side ?? 'brain', 'brain');
  const { events, ctx } = ctxFor({ tfwm: 'myid mysecretkey1' });
  // The feed's clock is October 2026; the tool uses the real clock, so make the feed "now".
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const out = await tool.run({ place: 'Birmingham city centre', radius_km: 3 }, ctx);
    assert.match(out, /<<external content from live transport/);
    assert.match(out, /Powered by TfWM part of West Midlands Combined Authority Open Data/);
    assert.match(out, /3 vehicles right now: 2 buses, 1 tram\./);
    assert.match(out, /Lines running \(vehicles\): 11A \(1\), 50 \(1\), MM1 \(1\)/);
    assert.match(out, /Nearest:\n- 11A, \d{2,3} m away, 3 min late/);
    assert.match(out, /- MM1 tram, \d{2,3} m away/);
    assert.match(out, /National Rail trains are not in these feeds/);
    assert.equal(events.length, 1);
    assert.equal(events[0].t, 'client');
    assert.equal(events[0].name, 'show_transit');
    assert.ok(Math.abs(events[0].args.lat - 52.48) < 0.01);
    assert.equal(events[0].args.range_km, 3);
    assert.equal(events[0].args.place, 'Birmingham city centre');
    // a line filter
    const one = await tool.run({ place: 'Birmingham', line: '11a' }, ctxFor({ tfwm: 'myid mysecretkey1' }).ctx);
    assert.match(one, /1 vehicle right now: 1 bus, 0 trams\. \(line 11a only\)/);
    assert.doesNotMatch(one, /MM1/);
    const none = await tool.run({ place: 'Birmingham', line: 'X99', radius_km: 3 }, ctxFor({ tfwm: 'myid mysecretkey1' }).ctx);
    assert.match(none, /3 vehicles nearby, but none on line X99/);
    assert.doesNotMatch(none, /Nearest:/);
  } finally {
    Date.now = realNow;
  }
});

test('transit_now without a key: bustimes.org, destinations, "on time", and the honest note', async () => {
  reset();
  const tool = T.toolByName.get('transit_now');
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const { events, ctx } = ctxFor();
    const out = await tool.run({ lat: 52.48, lon: -1.9, place: 'Birmingham' }, ctx);
    assert.match(out, /bustimes.org \(community data from the Bus Open Data Service\)/);
    assert.match(out, /No transport key yet/);
    assert.match(out, /2 vehicles right now: 1 bus, 1 tram\./);
    assert.match(out, /- 11A to Perry Barr, \d+ m away, 4 min late/);
    assert.match(out, /- MM1 tram to Wolverhampton, \d+ m away, on time/);
    assert.match(out, /National Rail trains are not in these feeds/);
    assert.equal(events[0].name, 'show_transit');
    assert.equal(events[0].args.range_km, 2, 'default radius');
    assert.ok(out.length <= 4000 + 80);
  } finally {
    Date.now = realNow;
  }
});

test('transit_now says plainly when nothing is reported, and asks for a place when none is known', async () => {
  reset();
  bustimesBody = [];
  const tool = T.toolByName.get('transit_now');
  const out = await tool.run({ lat: 55.95, lon: -3.19, place: 'Edinburgh' }, ctxFor().ctx);
  assert.match(out, /No buses or trams are reported within 2 km of Edinburgh right now/);
  assert.match(out, /National Rail trains are not in these feeds/);
  await assert.rejects(tool.run({}, ctxFor().ctx), /say which place/);
});
