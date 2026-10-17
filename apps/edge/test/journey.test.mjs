// The phone's journey helpers (apps/web/src/data/journey.ts): the encoded-polyline decoder
// against strings encoded elsewhere (Google's documented example, a textbook encoder in Python,
// a real precision-7 shape from Transitous), the colours and words per kind of leg, clock times
// in a zone, delays, and the shape to draw when a leg has no polyline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const J = await import('./.build/journey.mjs');
const FIX = JSON.parse(readFileSync(new URL('./transitous.fixture.json', import.meta.url), 'utf8'));

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('decodePolyline: Google\'s own example at precision 5', () => {
  const pts = J.decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
  assert.deepEqual(pts, [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ]);
});

test('decodePolyline: precision 6 and 7, encoded by a textbook encoder written in Python', () => {
  const six = J.decodePolyline('ou~acBn~{rBrDowD', 6);
  assert.equal(six.length, 2);
  assert.ok(close(six[0][0], 52.4778) && close(six[0][1], -1.899));
  assert.ok(close(six[1][0], 52.47771) && close(six[1][1], -1.896048));
  // The far corners at seven digits: more than 32 bits once zig-zagged, so sums must not be done in 32-bit words.
  const edge = J.decodePolyline('|nsrst@}~gfhjB{~gfhjBz~pmquE', 7);
  assert.equal(edge.length, 2);
  assert.ok(close(edge[0][0], -89.9999999, 1e-7) && close(edge[0][1], 179.9999999, 1e-7), JSON.stringify(edge));
  assert.ok(close(edge[1][0], 89.9999999, 1e-7) && close(edge[1][1], -179.9999999, 1e-7), JSON.stringify(edge));
});

test('decodePolyline: a real Transitous shape (precision 7) decodes to its declared number of points, ending at the stops', () => {
  const walk = FIX.plan.itineraries[0].legs[0];
  const bus = FIX.plan.itineraries[0].legs[1];
  const w = J.decodePolyline(walk.legGeometry.points, walk.legGeometry.precision);
  assert.equal(w.length, walk.legGeometry.length);
  assert.ok(close(w[0][0], 52.4777899, 1e-7) && close(w[0][1], -1.8990025, 1e-7), JSON.stringify(w[0]));
  assert.ok(close(w.at(-1)[0], 52.4777117, 1e-7) && close(w.at(-1)[1], -1.8960507, 1e-7), JSON.stringify(w.at(-1)));
  const b = J.decodePolyline(bus.legGeometry.points, bus.legGeometry.precision);
  assert.equal(b.length, 144);
  assert.ok(close(b[0][0], 52.4777381, 1e-7) && close(b[0][1], -1.8961015, 1e-7));
  assert.ok(close(b.at(-1)[0], 52.4521656, 1e-7) && close(b.at(-1)[1], -1.9143899, 1e-7));
  // the same string at the wrong precision lands somewhere else (or off the planet, and is dropped): the precision field matters
  assert.ok(close(J.decodePolyline(walk.legGeometry.points, 8)[0][0], 5.24777899, 1e-7));
  assert.deepEqual(J.decodePolyline(walk.legGeometry.points, 6), [], 'at six digits the first point is past 90° and nothing is kept');
});

test('decodePolyline never throws: broken or odd strings give what could be read', () => {
  assert.deepEqual(J.decodePolyline('', 7), []);
  assert.deepEqual(J.decodePolyline(undefined, 7), []);
  const cut = J.decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq', 5);
  assert.equal(cut.length, 2, 'the third point is cut off, the first two stand');
  assert.deepEqual(J.decodePolyline('_p~iF~ps|U\u0001\u0002', 5), [[38.5, -120.2]], 'a character below the alphabet ends it');
  assert.deepEqual(J.decodePolyline('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', 5), [], 'a varint that never ends is dropped');
});

test('colours and words per kind: the operator\'s line colour for rides, never for a walk; black or white text', () => {
  assert.equal(J.legColor({ mode: 'bus', color: '#e07709' }), '#e07709');
  assert.equal(J.legColor({ mode: 'bus', color: '' }), J.MODE_COLORS.bus);
  assert.equal(J.legColor({ mode: 'bus', color: 'red' }), J.MODE_COLORS.bus);
  assert.equal(J.legColor({ mode: 'walk', color: '#e07709' }), J.MODE_COLORS.walk);
  assert.equal(J.textOn('#ffb23e'), '#000');
  assert.equal(J.textOn('#660f21'), '#fff');
  assert.equal(J.textOn('nonsense'), '#fff');
  assert.equal(J.modeWord({ mode: 'bus', kind: 'BUS' }), 'bus');
  assert.equal(J.modeWord({ mode: 'bus', kind: 'COACH' }), 'coach');
  assert.equal(J.modeWord({ mode: 'rail', kind: 'REGIONAL_RAIL' }), 'train');
  assert.equal(J.modeWord({ mode: 'subway', kind: 'SUBWAY' }), 'metro');
  assert.equal(J.modeWord({ mode: 'other', kind: 'AERIAL_LIFT' }), 'aerial lift');
});

test('clock times in a zone, durations, distances and delays', () => {
  assert.equal(J.hhmm('2026-10-17T09:25:00Z', 'Europe/London'), '10:25', 'British Summer Time');
  assert.equal(J.hhmm('2026-10-17T09:25:00Z', 'UTC'), '09:25');
  assert.equal(J.hhmm('2026-10-17T09:25:00Z', 'Not/AZone').length, 5, 'an unknown zone falls back instead of throwing');
  assert.equal(J.hhmm('nonsense', 'UTC'), '--:--');
  assert.equal(J.mins(1140), '19 min');
  assert.equal(J.mins(3900), '1 h 5 min');
  assert.equal(J.metres(535), '535 m');
  assert.equal(J.metres(1234), '1.2 km');
  assert.deepEqual(J.delayOf({ realTime: false, start: '2026-10-17T09:28:00Z', scheduledStart: '2026-10-17T09:25:00Z' }), { s: 0, text: '' });
  assert.deepEqual(J.delayOf({ realTime: true, start: '2026-10-17T09:28:00Z', scheduledStart: '2026-10-17T09:25:00Z' }), { s: 180, text: '3 min late' });
  assert.deepEqual(J.delayOf({ realTime: true, start: '2026-10-17T09:24:00Z', scheduledStart: '2026-10-17T09:25:00Z' }), { s: -60, text: '1 min early' });
  assert.deepEqual(J.delayOf({ realTime: true, start: '2026-10-17T09:25:30Z', scheduledStart: '2026-10-17T09:25:00Z' }), { s: 30, text: 'on time' });
});

test('legPath draws the polyline, or stop to stop when the brain left the shape out; bounds and words of a journey', () => {
  const leg = { mode: 'bus', kind: 'BUS', line: '50', color: '', headsign: '', agency: '', from: { name: 'A', lat: 52.48, lon: -1.9 }, to: { name: 'C', lat: 52.46, lon: -1.92 }, start: '', end: '', scheduledStart: '', scheduledEnd: '', realTime: false, cancelled: false, duration: 600, distance: 0, track: '', stops: [{ name: 'B', lat: 52.47, lon: -1.91 }], points: '', precision: 7 };
  assert.deepEqual(J.legPath(leg), [
    [52.48, -1.9],
    [52.47, -1.91],
    [52.46, -1.92],
  ]);
  const withShape = { ...leg, points: 'ou~acBn~{rBrDowD', precision: 6 };
  assert.equal(J.legPath(withShape).length, 2);
  const j = { id: '1', start: '', end: '', duration: 1200, transfers: 1, legs: [leg, { ...leg, mode: 'walk', kind: 'WALK', line: '', stops: [], from: leg.to, to: { name: 'D', lat: 52.45, lon: -1.93 } }] };
  assert.deepEqual(J.journeyBounds(j), [
    [52.45, -1.93],
    [52.48, -1.9],
  ]);
  assert.equal(J.journeyBounds({ ...j, legs: [] }), null);
  assert.equal(J.changesText(j), '1 change');
  assert.equal(J.changesText({ ...j, transfers: 0 }), 'no changes');
  assert.equal(J.changesText({ ...j, transfers: 3 }), '3 changes');
  assert.equal(J.changesText({ ...j, direct: true }), 'walk all the way');
  assert.equal(J.ridesOf(j).length, 1);
  assert.equal(J.stopsText(leg), '2 stops');
  assert.equal(J.stopsText({ ...leg, stops: [] }), '1 stop');
});
