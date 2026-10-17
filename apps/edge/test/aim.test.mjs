// AIM's geometry and targets (the Lens mode that labels what the phone points at), off the phone:
// headings that wrap (359° → 1° is a 2° turn), bearing and elevation with the Earth's curvature
// (a far ship sits below level, the space station is hidden when the planet is in the way), the
// phone's pose from its orientation sensor (an iPhone's compass heading included), projection onto
// the screen with edge arrows for things out of view, the horizon line, label decluttering, and the
// feeds' real answers (aim.fixture.json: adsb.lol and wheretheiss.at, fetched 2026-10-17) turned
// into labelled targets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const P = await import('./.build/aim/project.mjs');
const T = await import('./.build/aim/targets.mjs');
const FIX = JSON.parse(readFileSync(new URL('./aim.fixture.json', import.meta.url), 'utf8'));

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what ?? ''} ${a} is not within ${eps} of ${b}`);
const BHAM = { lat: 52.4797, lon: -1.9026, alt: 140 };
const VP = { w: 390, h: 400, focal: 500 };

test('headings wrap: 359° to 1° is a 2° turn right, and back is 2° left', () => {
  assert.equal(P.turn(359, 1), 2);
  assert.equal(P.turn(1, 359), -2);
  assert.equal(P.wrap360(-1), 359);
  assert.equal(P.wrap360(720), 0);
  assert.equal(P.wrap180(181), -179);
  assert.equal(P.compassPoint(359), 'N');
  assert.equal(P.compassPoint(90), 'E');
  assert.equal(P.compassPoint(225), 'SW');
});

test('bearing and distance: north, east, south, west of Birmingham', () => {
  const n = P.look(BHAM, { lat: BHAM.lat + 0.1, lon: BHAM.lon, alt: BHAM.alt });
  near(n.bearing, 0, 0.2, 'north');
  near(n.ground, 11_130, 30, 'a tenth of a degree of latitude');
  const e = P.look(BHAM, { lat: BHAM.lat, lon: BHAM.lon + 0.1, alt: BHAM.alt });
  near(e.bearing, 90, 0.1, 'east');
  near(e.ground, 6_780, 30, 'a tenth of a degree of longitude at 52.5°');
  near(P.look(BHAM, { lat: BHAM.lat - 0.1, lon: BHAM.lon, alt: BHAM.alt }).bearing, 180, 0.2, 'south');
  near(P.look(BHAM, { lat: BHAM.lat, lon: BHAM.lon - 0.1, alt: BHAM.alt }).bearing, 270, 0.1, 'west');
});

test("the Earth's curvature: a ship 30 km out sits below level; a plane 10 km off at 3,000 m is ~16.7° up", () => {
  const shore = { lat: 50.0, lon: -5.0, alt: 2 };
  const ship = P.look(shore, { lat: 50.0, lon: -5.0 + 30 / 71.5, alt: 0 });
  near(ship.ground, 30_000, 200, 'the ship is 30 km away');
  // flat Earth would say −0.004°; the curve drops it by about d/2R = 0.135°
  near(ship.elevation, -0.139, 0.01, 'the ship sits below level');
  const plane = P.look({ lat: 52, lon: -2, alt: 0 }, { lat: 52 + 10 / 111.2, lon: -2, alt: 3000 });
  near(plane.elevation, (Math.atan(3000 / 10_000) * 180) / Math.PI - 0.045, 0.05, 'the plane');
  near(plane.range, Math.hypot(3000, 10_000), 30, 'slant range');
  const up = P.look({ lat: 52, lon: -2, alt: 0 }, { lat: 52, lon: -2, alt: 1000 });
  near(up.elevation, 90, 0.01, 'straight overhead');
});

test('the space station is shown only above the horizon', () => {
  const iss = (lat, lon) => ({ lat, lon, alt: 420_000 });
  assert.equal(P.aboveHorizon(BHAM, iss(50.44, -2.75)), true, 'nearly overhead');
  assert.equal(P.aboveHorizon(BHAM, iss(-50, 178)), false, 'the far side of the planet');
  // 420 km up it clears the horizon out to about 2,250 km along the ground
  assert.equal(P.aboveHorizon(BHAM, iss(52.4797, -1.9026 + 1500 / 67.8)), true, '1,500 km away');
  assert.equal(P.aboveHorizon(BHAM, iss(52.4797 - 2800 / 111.2, -1.9026)), false, '2,800 km away');
});

test('the pose from the orientation sensor: upright facing east, tilted up, and an iPhone compass heading', () => {
  // W3C: alpha counts anticlockwise from north, so a phone held upright facing east reads 270
  const east = P.headingOf(P.poseFromOrientation(270, 90, 0));
  near(east.heading, 90, 1e-6, 'facing east');
  near(east.pitch, 0, 1e-6, 'level');
  near(P.headingOf(P.poseFromOrientation(0, 90, 0)).heading, 0, 1e-6, 'facing north');
  const up = P.headingOf(P.poseFromOrientation(0, 120, 0));
  near(up.pitch, 30, 1e-6, 'tilted 30° up');
  near(up.heading, 0, 1e-6, 'still north');
  // flat on a table, the camera looks at the floor
  near(P.headingOf(P.poseFromOrientation(0, 0, 0)).pitch, -90, 1e-6, 'flat: straight down');
  // an iPhone: webkitCompassHeading 45 is alpha 315 measured from north
  near(P.headingOf(P.poseFromOrientation(360 - 45, 90, 0)).heading, 45, 1e-6, 'compass 45');
  // turning the pose to a heading keeps the tilt
  const turned = P.headingOf(P.headingTo(P.poseFromOrientation(10, 110, 0), 200));
  near(turned.heading, 200, 1e-6, 'turned');
  near(turned.pitch, 20, 1e-6, 'tilt kept');
  // landscape: the screen's right is the phone's bottom edge, its up the phone's right edge
  const p = P.poseFromOrientation(0, 90, 0);
  const l = P.poseFromOrientation(0, 90, 0, 90);
  for (let i = 0; i < 3; i++) {
    near(l.u[i], p.r[i], 1e-9, 'landscape up');
    near(l.r[i], -p.u[i], 1e-9, 'landscape right');
  }
  // ALIGN's correction turns the pose clockwise
  near(P.headingOf(P.rotatePose(P.poseFrom(350), 15)).heading, 5, 1e-6, 'align across north');
});

test('projection: due east in the middle when facing east, right of centre when facing a bit left, an edge arrow when facing west', () => {
  const center = P.project(P.direction(90, 0), P.poseFrom(90), VP);
  assert.equal(center.on, true);
  near(center.x, 195, 1e-6, 'x');
  near(center.y, 200, 1e-6, 'y');
  const right = P.project(P.direction(90, 0), P.poseFrom(75), VP);
  assert.equal(right.on, true);
  near(right.x, 195 + Math.tan((15 * Math.PI) / 180) * 500, 1e-6, '15° right');
  const higher = P.project(P.direction(90, 5), P.poseFrom(90), VP);
  assert.ok(higher.y < 200, 'above level is up the screen');
  // facing west: east is straight behind — an arrow at an edge
  const behind = P.project(P.direction(90, 0), P.poseFrom(270), VP, 28);
  assert.equal(behind.on, false);
  assert.ok(behind.x === 390 - 28 || behind.x === 28 || behind.y === 28 || behind.y === 400 - 28, `arrow on an edge: ${behind.x},${behind.y}`);
  // facing north, east is to the right: the arrow sits on the right edge pointing right
  const side = P.project(P.direction(90, 0), P.poseFrom(0), VP, 28);
  assert.equal(side.on, false);
  near(side.x, 390 - 28, 1e-6, 'right edge');
  near(side.angle, 0, 1e-6, 'points right');
  // the left: an arrow on the left edge
  const left = P.project(P.direction(300, 0), P.poseFrom(0), VP, 28);
  near(left.x, 28, 1e-6, 'left edge');
  // across north: facing 359°, something at 1° is just right of the middle
  const wrap = P.project(P.direction(1, 0), P.poseFrom(359), VP);
  assert.equal(wrap.on, true);
  near(wrap.x, 195 + Math.tan((2 * Math.PI) / 180) * 500, 1e-6, 'wraps across north');
  // the phone turned on its side (top to the right): the sky is to the screen's left
  const rolled = P.project(P.direction(0, 5), P.poseFrom(0, 0, 90), VP);
  assert.equal(rolled.on, true);
  assert.ok(rolled.x < 195 - 30 && Math.abs(rolled.y - 200) < 1, `rolled: ${rolled.x},${rolled.y}`);
});

test("the focal length follows the camera's long side and the viewfinder's crop", () => {
  // a 720×1280 portrait frame shown at 0.5 scale: the 1280 side spans 69°
  near(P.focalFor({ w: 720, h: 1280 }, 0.5, { w: 360, h: 640 }), (640 * 0.5) / Math.tan((34.5 * Math.PI) / 180), 1e-6, 'focal');
  // no camera: the long side of the viewfinder
  near(P.focalFor({ w: 0, h: 0 }, 1, { w: 390, h: 400 }), 200 / Math.tan((34.5 * Math.PI) / 180), 1e-6, 'no camera');
});

test('the horizon: through the middle when level, lower when the phone tilts up, tilted when rolled, gone when looking straight down', () => {
  const level = P.horizonLine(P.poseFrom(30), VP);
  near(level.y1, 200, 1e-6, 'left');
  near(level.y2, 200, 1e-6, 'right');
  const up = P.horizonLine(P.poseFrom(30, 10), VP);
  near(up.y1, 200 + Math.tan((10 * Math.PI) / 180) * 500, 1e-6, 'tilted up 10°');
  near(up.y2, up.y1, 1e-6, 'still flat');
  const rolled = P.horizonLine(P.poseFrom(30, 0, 10), VP);
  assert.ok(rolled.y1 > 200 && rolled.y2 < 200, 'rolled clockwise: the picture (and the horizon) turns the other way');
  assert.equal(P.horizonLine(P.poseFrom(30, -89), VP), null, 'looking at your feet');
});

test('labels do not overlap: the nearest wins the space, the rest step up or drop out, at most max', () => {
  const ls = [
    { id: 'far', x: 100, y: 200, w: 80, h: 28, dist: 9000 },
    { id: 'near', x: 100, y: 200, w: 80, h: 28, dist: 100 },
    { id: 'mid', x: 110, y: 205, w: 80, h: 28, dist: 500 },
    { id: 'away', x: 300, y: 100, w: 60, h: 28, dist: 50_000 },
  ];
  const out = P.declutter(ls, 25, { w: 390, h: 400 });
  assert.deepEqual(out.map((l) => l.id), ['near', 'mid', 'far', 'away']);
  for (const a of out)
    for (const b of out) if (a !== b) assert.ok(!(a.lx < b.lx + b.w && a.lx + a.w > b.lx && a.ly < b.ly + b.h && a.ly + a.h > b.ly), `${a.id} overlaps ${b.id}`);
  assert.equal(out[0].ly, 200 - 28 - 10, 'the nearest sits right above its marker');
  // a crowd: fifty labels on one spot, only as many as fit (and never more than max)
  const crowd = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, x: 195, y: 200, w: 90, h: 28, dist: i }));
  const few = P.declutter(crowd, 25, { w: 390, h: 400 });
  assert.ok(few.length >= 1 && few.length <= 5, `crowd placed ${few.length}`);
  assert.equal(few[0].id, 'c0');
  assert.equal(P.declutter(Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, x: (i % 8) * 50 + 25, y: Math.floor(i / 8) * 80 + 60, w: 40, h: 20, dist: i })), 25).length, 25, 'max');
  // labels stay on the screen
  const edge = P.declutter([{ id: 'e', x: 385, y: 50, w: 100, h: 28, dist: 1 }], 25, { w: 390, h: 400 });
  assert.ok(edge[0].lx + edge[0].w <= 390 && edge[0].ly >= 0, 'clamped inside');
});

test('distances in plain words', () => {
  assert.equal(P.distanceText(847), '850 m');
  assert.equal(P.distanceText(4230), '4.2 km');
  assert.equal(P.distanceText(38_400), '38 km');
});

test('aircraft from a real adsb.lol answer: callsign, altitude in feet, type, ground traffic at ground level', () => {
  const planes = T.planesFrom(FIX.adsb);
  const withPos = FIX.adsb.ac.filter((a) => a.lat != null && a.lon != null && a.hex).length;
  assert.equal(planes.length, withPos);
  const elys = planes.find((p) => p.title === 'GELYS');
  assert.ok(elys, 'G-ELYS by its callsign');
  near(elys.alt, 4100 * 0.3048, 0.01, 'feet to metres');
  assert.match(elys.tag, /4,100 ft · C150/);
  assert.deepEqual(elys.facts.find(([k]) => k === 'Registration'), ['Registration', 'G-ELYS']);
  assert.equal(elys.kind, 'plane');
  const gnd = T.planesFrom({ ac: [{ hex: 'abc123', lat: 52.45, lon: -1.74, alt_baro: 'ground', r: 'G-TEST' }] })[0];
  assert.equal(gnd.alt, null, 'on the ground: at ground level');
  assert.equal(gnd.title, 'G-TEST', 'no callsign: the registration');
  assert.deepEqual(T.planesFrom(null), []);
  assert.deepEqual(T.planesFrom({ ac: [{ hex: 'x' }] }), [], 'no position, no label');
});

test('the space station from a real wheretheiss.at answer (as the brain passes it on): shown when above the horizon', () => {
  const j = { lat: FIX.iss.latitude, lon: FIX.iss.longitude, altKm: FIX.iss.altitude, speedKmh: Math.round(FIX.iss.velocity), visibility: FIX.iss.visibility };
  const [iss] = T.issFrom(j);
  assert.equal(iss.kind, 'space');
  near(iss.alt, FIX.iss.altitude * 1000, 1, 'kilometres to metres');
  assert.match(iss.facts.map((f) => f.join(' ')).join(' | '), /Speed 27,566 km\/h/);
  const [seen] = T.locate([iss], BHAM);
  assert.ok(seen.elevation > 0, `it was over Dorset: ${seen.elevation.toFixed(1)}° up from Birmingham`);
  assert.deepEqual(T.issFrom({}), []);
});

test('ships, buses and places from the brain routes; a tower is seen at its top; one line for the brain', () => {
  const [ship] = T.shipsFrom({ ships: [{ mmsi: 235000001, name: 'PRIDE OF KENT', lat: 51.1, lon: 1.4, sog: 18.2, cog: 120, dest: 'CALAIS' }] });
  assert.equal(ship.title, 'PRIDE OF KENT');
  assert.equal(ship.tag, '18 kn');
  const [bus] = T.transitFrom({ vehicles: [{ id: 'v1', kind: 'bus', line: '50', dest: 'Maypole', lat: 52.47, lon: -1.89, bearing: 180, delayS: 120 }] });
  assert.equal(bus.title, 'Bus 50');
  assert.deepEqual(bus.facts.find(([k]) => k === 'Running'), ['Running', '2 min late']);
  const places = T.placesFrom({ places: [
    { id: 'on1', name: 'Walton Hill', kind: 'peak', lat: 52.4122, lon: -2.0667, ele: 316, wiki: 'Walton Hill' },
    { id: 'on2', name: 'BT Tower', kind: 'tower', lat: 52.4836, lon: -1.9047, height: 152 },
  ] });
  assert.equal(places[0].alt, 316, 'a hilltop at its mapped height');
  assert.equal(places[1].alt, null);
  assert.equal(places[1].above, 152, 'a tower: its top');
  const seen = T.locate(places, BHAM);
  assert.ok(seen[1].elevation > 10, `the tower half a kilometre away towers: ${seen[1].elevation.toFixed(1)}°`);
  assert.ok(seen[0].elevation > 0, 'the hill rises above Birmingham');
  const line = T.describeTarget(seen[0]);
  assert.match(line, /^aimed at a place "Walton Hill" \(\d+° from north, [\d.]+° up, [\d.]+ km away; What: hilltop; Height: 316 m above sea level\)$/);
  assert.match(T.labelLine(seen[0]), /hilltop · [\d.]+ km/);
});
