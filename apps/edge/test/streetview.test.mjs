// Street View, satellite imagery and the live traffic map: Google's and Waze's own pages, free and
// keyless, opened on God's Eye by the brain's tools. No network needed here (known places only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const T = await import('./.build/tools/index.mjs');
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ctx = (emit) => ({ emit, vault: { get: async () => '' }, storage: { get: async () => undefined } });

test('street view and the live traffic map are offered for the right questions', () => {
  const names = (msg) => T.selectTools(msg, new Set(), false).map((t) => t.name);
  for (const q of ['show me the street view of big ben', 'look around times square', "what's the traffic like in london"]) assert.ok(names(q).includes('street_view'), q);
  assert.ok(!names('what is the weather tomorrow').includes('street_view'));
});

test("street_view opens Google Street View at the place on God's Eye", async () => {
  const events = [];
  const out = await T.toolByName.get('street_view').run({ place: 'London' }, ctx((e) => events.push(e)));
  assert.equal(events[0].name, 'street_view');
  assert.ok(Math.abs(events[0].args.lat - 51.5074) < 0.01 && Math.abs(events[0].args.lon + 0.1278) < 0.01);
  assert.match(out, /Street View of London/);
  assert.match(out, /not live/);
});

test('traffic_now with no key still opens the live Waze map and the nearest cameras; the numbers need the free TomTom key', async () => {
  const events = [];
  const out = await T.toolByName.get('traffic_now').run({ place: 'London' }, ctx((e) => events.push(e)));
  assert.deepEqual(events.map((e) => e.name), ['traffic_map', 'show_cameras']);
  assert.match(out, /Waze/);
  assert.match(out, /TomTom key/);
  // Birmingham: the motorways around it have public cameras (National Highways), so those open too
  const ev2 = [];
  await T.toolByName.get('traffic_now').run({ place: 'Birmingham' }, ctx((e) => ev2.push(e)));
  assert.deepEqual(ev2.map((e) => e.name), ['traffic_map', 'show_cameras']);
  // a place with none at all: the live map alone
  const ev3 = [];
  await T.toolByName.get('traffic_now').run({ lat: 55.95, lon: -3.19, place: 'Edinburgh' }, ctx((e) => ev3.push(e)));
  assert.deepEqual(ev3.map((e) => e.name), ['traffic_map']);
});

test('the interface may frame exactly Google Maps, Waze and Spline public scenes (3D STUDIO), nothing else', () => {
  const headers = readFileSync(`${ROOT}apps/web/public/_headers`, 'utf8');
  const csp = headers.split('\n').find((l) => /^\s*Content-Security-Policy: default-src 'self'/.test(l));
  assert.match(csp, /frame-src 'self' https:\/\/www\.google\.com https:\/\/embed\.waze\.com https:\/\/my\.spline\.design;/);
  const protocol = readFileSync(`${ROOT}packages/shared/src/protocol.ts`, 'utf8');
  for (const c of ['street_view', 'traffic_map']) assert.ok(protocol.includes(`'${c}'`), c);
});
