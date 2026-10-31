// THE MACHINE VIEW's pure parts (apps/web/src/features/eye/machine.ts; OWNER-ISSUES 61c), bundled by the test script:
// the count line's words (a warning instead of the all-clear, no ships feed, outside the West Midlands, today's first
// expectation), the 25 km radius and the sky above 10°, the tags on public vehicles, the box labels, the hub's reading, the
// chat's words — and the mode's own layers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('./.build/machine.mjs');

const HOME = { lat: 52.443186, lon: -1.892525 };
const R = 6371;
/** A point `alt` km up at lat, lon (Earth-centred, km), as the globe holds a satellite. */
const ecef = (lat, lon, alt) => {
  const r = Math.PI / 180;
  const k = R + alt;
  return [k * Math.cos(lat * r) * Math.cos(lon * r), k * Math.cos(lat * r) * Math.sin(lon * r), k * Math.sin(lat * r)];
};

test('the count line, in his voice: the numbers, the incidents, the all-clear or the warning, no ships feed, today\'s expectation', () => {
  const c = { city: 'Birmingham', air: 41, transit: 188, ships: 2, sats: 9, incidents: 3 };
  assert.equal(M.countLine(c, { home: 'Home' }), 'Watching Birmingham. 41 aircraft, 188 buses and trams, 2 ships, 9 satellites overhead; 3 road incidents. Nothing active near Home.');
  const flood = { id: 'ea:1', feed: 'flood', title: 'Flood alert: River Cole at Kings Heath', level: 3, since: Date.UTC(2026, 10, 2, 14, 5) };
  const warning = M.warningSentence(flood, 'Home', 'Europe/London');
  assert.equal(warning, 'A flood alert is active near Home (Environment Agency, since 14:05).');
  assert.equal(M.countLine(c, { home: 'Home', warning }), 'Watching Birmingham. 41 aircraft, 188 buses and trams, 2 ships, 9 satellites overhead; 3 road incidents. A flood alert is active near Home (Environment Agency, since 14:05).');
  assert.equal(M.countLine({ ...c, ships: null }, { home: 'Home' }), 'Watching Birmingham. 41 aircraft, 188 buses and trams, 9 satellites overhead; 3 road incidents. Nothing active near Home. No ships feed here.');
  assert.equal(M.countLine({ ...c, ships: 0 }, { home: 'Home', expect: 'I expect rain by 15:00 (70%)' }), 'Watching Birmingham. 41 aircraft, 188 buses and trams, 9 satellites overhead; 3 road incidents. Nothing active near Home. I expect rain by 15:00.');
  // outside the West Midlands: no incidents said; no live buses where the feed has none; no saved home: no all-clear
  assert.equal(M.countLine({ city: 'Leeds', air: 1, transit: null, ships: 0, sats: 1, incidents: null }), 'Watching Leeds. 1 aircraft, no live buses here, 1 satellite overhead.');
  assert.equal(M.countLine({ city: 'Birmingham', air: 0, transit: 1, ships: 1, sats: 0, incidents: 0 }), 'Watching Birmingham. 0 aircraft, 1 bus or tram, 1 ship, 0 satellites overhead; no road incidents.');
  assert.equal(M.countLine({ ...c, air: 2117 }).split('.')[1], ' 2,117 aircraft, 188 buses and trams, 2 ships, 9 satellites overhead; 3 road incidents');
  assert.equal(M.hubLine(c), 'WATCHING · 41 AIR · 188 TRANSIT');
  assert.equal(M.hubLine({ air: 3, transit: null }), 'WATCHING · 3 AIR · 0 TRANSIT');
  assert.match(M.NO_HOME, /^Save home in Memory → ME → PLACES and I'll watch your city; for now this is the phone's home\.$/);
});

test('the radius: what is within 25 km of the frame\'s centre, by where each is now; the nearest first', () => {
  const things = [{ id: 'a', lat: 52.45, lon: -1.88 }, { id: 'b', lat: 52.36, lon: -1.75 }, { id: 'c', lat: 52.806, lon: -2.117 }, { id: 'd', lat: NaN, lon: 0 }];
  assert.deepEqual(M.within(things, HOME).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(M.within(things, HOME, 5).map((x) => x.id), ['a']);
  // by where each is now (a dead-reckoned position), not where it was reported
  assert.deepEqual(M.within(things, HOME, 25, (x) => (x.id === 'a' ? { lat: 53.2, lon: -1.88 } : x)).map((x) => x.id), ['b']);
  assert.deepEqual(M.nearest(things, HOME, 2).map((x) => x.id), ['a', 'b']);
  assert.ok(Math.abs(M.kmBetween(HOME, { lat: 52.4862, lon: -1.8904 }) - 4.79) < 0.05, 'Moseley to the city centre');
  assert.ok(M.inWestMidlands(HOME) && !M.inWestMidlands({ lat: 53.8, lon: -1.55 }));
  assert.ok(M.nearBaltic({ lat: 59.33, lon: 18.07 }) && !M.nearBaltic(HOME));
});

test('the sky: satellites above 10° over the centre, never the ones below the horizon', () => {
  assert.ok(Math.abs(M.elevation(HOME, ecef(HOME.lat, HOME.lon, 550)) - 90) < 1e-6, 'straight up');
  assert.ok(M.elevation(HOME, ecef(-HOME.lat, HOME.lon + 180, 550)) < -60, 'the other side of the Earth');
  const low = ecef(HOME.lat + 22, HOME.lon, 550);
  assert.ok(M.elevation(HOME, low) < 10, `${M.elevation(HOME, low).toFixed(1)}°: low on the horizon`);
  // a geostationary satellite over 0° stands about 30° up from Birmingham; one over 120°E is below the horizon
  assert.ok(Math.abs(M.elevation(HOME, ecef(0, 0, 35786)) - 30) < 1);
  const sats = [{ w: ecef(HOME.lat, HOME.lon, 550) }, { w: ecef(HOME.lat + 3, HOME.lon + 2, 800) }, { w: low }, { w: ecef(0, 0, 35786) }, { w: ecef(0, 120, 35786) }];
  assert.equal(M.overhead(sats, HOME), 3);
});

test('the tags: an aircraft by its callsign and altitude (its type when the feed gives one), the nearest bus or tram, his places', () => {
  assert.equal(M.airTag({ call: 'BAW123', hex: '400a01', altft: 7380, type: 'A320' }), 'BAW123 · 7,400 FT · A320');
  assert.equal(M.airTag({ call: '', hex: '400a01', altft: 950, type: '' }), '400A01 · 1,000 FT');
  assert.equal(M.airTag({ call: 'EZY12', hex: 'x', altft: 0, gnd: true }), 'EZY12 · ON THE GROUND');
  assert.equal(M.airTag({ call: 'N1', hex: 'x', altft: 3000, type: 'Cessna 172 Skyhawk' }), 'N1 · 3,000 FT', 'not a one-word type: left out');
  assert.equal(M.transitTag({ line: '50', dest: 'Druids Heath' }), 'LINE 50 · TOWARDS DRUIDS HEATH');
  assert.equal(M.transitTag({ line: 'mm1', dest: '' }), 'LINE MM1');
  const flood = { id: 'ea:1', feed: 'flood', title: 'Flood alert: River Cole', level: 3, since: 1 };
  const amber = { id: 'mo:1', feed: 'weather', title: 'Amber warning of rain', level: 2, since: 2 };
  assert.equal(M.placeTag('Home'), 'HOME');
  assert.equal(M.placeTag('Home', [flood]), 'HOME · FLOOD ALERT');
  assert.equal(M.placeTag('Work', [flood, amber]), 'WORK · AMBER RAIN WARNING', 'the worst first');
  assert.equal(M.walkTag({ stage: 'walking', eta: Date.UTC(2026, 10, 2, 23, 20) }, 'Europe/London'), 'WALKING HOME · DUE 23:20');
  assert.equal(M.walkTag({ stage: 'done', eta: 1 }, 'Europe/London'), '');
  assert.equal(M.walkTag(null, 'Europe/London'), '');
});

test('his words for it, no model; the mode\'s own layers: the moving things on, the clutter off', () => {
  for (const t of ['machine view', 'Machine view', 'show me my city', 'What are you watching?', 'what can you see?', 'Ghosty, machine view.', 'open the machine view']) assert.ok(M.machineAsked(t), t);
  for (const t of ['what can you see in this picture?', 'what are you watching on Netflix?', 'show me the machine learning course', 'the machine is broken', 'watch my city', 'hello']) assert.ok(!M.machineAsked(t), t);
  for (const k of ['air', 'transit', 'ships', 'sats', 'incidents', 'me', 'spot', 'cities', 'coast', 'borders']) assert.equal(M.MACHINE_LAYERS[k], true, k);
  for (const k of ['cams', 'crime', 'enforce', 'radar', 'imagery', 'orbits']) assert.equal(M.MACHINE_LAYERS[k], false, k);
  assert.equal(M.MACHINE_KM, 25);
  assert.equal(M.SAT_MIN_EL, 10);
  assert.deepEqual([M.MACHINE_RANGE, M.MACHINE_TILT], [14, 50]);
  assert.equal(M.machineState.on, false);
});
