// BATCH ⑧ PART C (BRIEF-REST-C): the pure parts of the three, on recorded sequences and drawn traces.
//  1. CHECK IT'S LIVE (apps/web/src/features/lens/liveness.ts): the eye aspect ratio and its blinks, the nose-to-cheek
//     ratio and its turns, the flatness check (one plane's homography and what it leaves over), the verdicts on the
//     recorded sequences (tests/fixtures/livefaces.mjs: a live face blinking or turning passes; a printed photo, a photo
//     turned by hand, a screen playing a blinking still and that screen turned all fail; a face held too still is
//     "unsure" and is asked for a small turn); which uses need the check; the lines that hold in the source.
//  2. SHAPES (apps/web/src/hands): hand-drawn traces (wobbly, tilted, a corner overshot) become a rectangle, an L, a
//     circle, a line; corners within 12° of square snap, beyond it they do not; one said length sets the scale and every
//     corner lands on 5 cm; the plan builder's rooms, openings (kept off the corners), furniture, free walls, areas, the
//     measured list with the honest line; the Room JSON reads back whole through the shared reader; the four hand
//     poses from 21 points; his words (lengths in metres, centimetres and feet, pieces, north, materials, names).
//  3. TV MODE (apps/web/src/tv/detect.ts): which screens are televisions (the PS5's browser, a smart TV, a wide screen
//     with no touch and no fine pointer; never a computer with a mouse or a tablet), the setting over the shape, the
//     reading order and where each d-pad press goes, the words that switch it.
// Bundles are built here with esbuild's API (as catalogue.test.mjs does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/features/lens/liveness.ts'), at('../../web/src/hands/shapes.ts'), at('../../web/src/hands/plan.ts'), at('../../web/src/hands/words.ts'), at('../../web/src/hands/pose.ts'), at('../../web/src/tv/detect.ts'), at('../../../packages/shared/src/design.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/restc'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const L = await import('./.build/restc/apps/web/src/features/lens/liveness.mjs');
const SH = await import('./.build/restc/apps/web/src/hands/shapes.mjs');
const PL = await import('./.build/restc/apps/web/src/hands/plan.mjs');
const WD = await import('./.build/restc/apps/web/src/hands/words.mjs');
const PO = await import('./.build/restc/apps/web/src/hands/pose.mjs');
const DS = await import('./.build/restc/packages/shared/src/design.mjs');
const TV = await import('./.build/restc/apps/web/src/tv/detect.mjs');
const { faceSequence } = await import('../../../tests/fixtures/livefaces.mjs');
const WEB = new URL('../../web/', import.meta.url);
const src = (p) => readFileSync(new URL(p, WEB), 'utf8');
/** The code alone, without its comments. */
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// ---------------------------------------------------------------- 1. CHECK IT'S LIVE

test('the eye aspect ratio: about 0.3 open, near 0 shut; the nose-to-cheek ratio is 0 facing, + to his left, − to his right', () => {
  const eye = (gap) => [[0, 0], [9, -gap / 2], [18, -gap / 2], [27, 0], [18, gap / 2], [9, gap / 2]];
  assert.ok(Math.abs(L.ear(eye(8)) - 8 / 27) < 1e-9);
  assert.ok(L.ear(eye(0.5)) < 0.03);
  const seq = faceSequence('turn-lr', { seed: 3, noise: 0 });
  const r = seq.map((s) => L.yaw(s.p));
  // frontal for half a second, then his left (above 0), then his right (below 0)
  assert.ok(Math.abs(r[0]) < L.TURN, `frontal ${r[0]}`);
  assert.ok(Math.max(...r.slice(25, 40)) > L.TURN, 'turned left');
  assert.ok(Math.min(...r.slice(55, 75)) < -L.TURN, 'then right');
  assert.deepEqual(L.turns(seq), ['left', 'right']);
  assert.deepEqual(L.turns(faceSequence('turn-rl', { seed: 3 })), ['right', 'left']);
});

test('blinks: a live blink sequence has its two, a photo none; a photo tipped back and forth is not a blink (the face squashes with it)', () => {
  for (const seed of SEEDS) {
    assert.equal(L.blinks(faceSequence('blink', { seed })).count, 2, `blink seed ${seed}`);
    assert.equal(L.blinks(faceSequence('photo', { seed })).count, 0, `photo seed ${seed}`);
  }
  // a photo tipped back hard twice (every point squashed to half its height for 120 ms): the raw ratio dips like a blink
  const tipped = faceSequence('photo', { seed: 4 }).map((s, i) => {
    if (!((i >= 20 && i < 24) || (i >= 50 && i < 54))) return s;
    const cy = (s.p.brow[1] + s.p.chin[1]) / 2;
    const sq = ([x, y]) => [x, cy + (y - cy) * 0.5];
    const p = Object.fromEntries(Object.entries(s.p).map(([k, v]) => [k, Array.isArray(v[0]) ? v.map(sq) : sq(v)]));
    return { t: s.t, p };
  });
  const raw = tipped.map((s) => (L.ear(s.p.eyeR) + L.ear(s.p.eyeL)) / 2);
  assert.ok(Math.min(...raw) < 0.62 * Math.max(...raw), 'the raw eye ratio dips when the photo is tipped');
  assert.equal(L.blinks(tipped).count, 0, 'but it is not a blink');
});

test('the flatness check: one homography carries a flat picture exactly; a real head leaves parallax; a still head cannot tell', () => {
  // a flat picture, no jitter: the plane's map is exact
  const flat = faceSequence('photo-turned', { seed: 2, noise: 0 });
  const pts = (s) => [s.p.eyeR[0], s.p.eyeR[3], s.p.eyeL[0], s.p.eyeL[3], s.p.nose, s.p.bridge, s.p.edgeR, s.p.edgeL, s.p.brow];
  const H = L.homography(pts(flat[0]), pts(flat[40]));
  const err = Math.max(...pts(flat[0]).map((p, i) => Math.hypot(H(p)[0] - pts(flat[40])[i][0], H(p)[1] - pts(flat[40])[i][1])));
  assert.ok(err < 1e-6, `a plane's map is exact (${err})`);
  for (const seed of SEEDS) {
    const d = (k) => L.depth(faceSequence(k, { seed }));
    assert.equal(d('blink').verdict, 'deep', `a live face's natural drift shows its depth (seed ${seed}: ${d('blink').parallax})`);
    assert.equal(d('turn-lr').verdict, 'deep');
    assert.equal(d('photo-turned').verdict, 'flat', `a photo turned by hand is flat (seed ${seed}: ${d('photo-turned').parallax})`);
    assert.equal(d('screen-turn').verdict, 'flat');
    assert.equal(d('still-blink').verdict, 'unsure', 'a face held dead still: too little movement to tell');
    assert.ok(d('photo').parallax < L.DEEP && d('screen-blink').parallax < L.DEEP);
  }
});

test('the verdicts on the recorded sequences: a live face passes; a still image, a photo turned, a screen video with no parallax fail', () => {
  for (const seed of SEEDS) {
    const j = (k, c) => L.judge(faceSequence(k, { seed }), c);
    assert.equal(j('blink', 'blink').live, true, `a real blink sequence passes (seed ${seed})`);
    assert.equal(j('turn-lr', 'turn-lr').live, true);
    assert.equal(j('turn-rl', 'turn-rl').live, true);
    // the order is the challenge: left-then-right is not right-then-left
    assert.equal(j('turn-lr', 'turn-rl').live, false);
    const still = j('photo', 'blink');
    assert.equal(still.live, false, 'a still image fails');
    assert.equal(still.why, 'challenge');
    assert.equal(j('photo', 'turn-lr').live, false);
    const turned = j('photo-turned', 'turn-lr');
    assert.equal(turned.live, false, 'a photo turned by hand fails');
    assert.equal(turned.depth, 'flat');
    const screen = j('screen-blink', 'blink');
    assert.equal(screen.blinks, 2, 'the screen video does blink');
    assert.equal(screen.live, false, 'but a screen video with no parallax fails');
    assert.notEqual(screen.depth, 'deep');
    const screenTurned = j('screen-turn', 'turn-rl');
    assert.equal(screenTurned.live, false);
    assert.equal(screenTurned.depth, 'flat', 'turned like a head, a screen is still flat');
    // dead still but blinking: not a pass yet, and "unsure" (the check then asks for a small turn)
    const held = j('still-blink', 'blink');
    assert.equal(held.live, false);
    assert.equal(held.why, 'unsure');
  }
  // too short to judge
  assert.equal(L.judge(faceSequence('blink', { seconds: 0.15 }), 'blink').why, 'face');
});

test('when it runs: never for a hello, always before a face is saved, unlocks or acts (while the setting is on)', () => {
  for (const u of ['hello', 'label', 'who', 'whoami', 'card']) assert.equal(L.LIVE_USES[u], false, u);
  for (const u of ['enrol', 'introduce', 'unlock']) assert.equal(L.LIVE_USES[u], true, u);
  assert.equal(L.liveCheckOn(), true, 'on by default');
  assert.equal(L.needsLive('enrol'), true);
  globalThis.window ??= globalThis; // (the store saves on a timer of the page's)
  L.liveSetting.set({ on: false });
  assert.equal(L.needsLive('enrol'), false);
  L.liveSetting.set({ on: true });
  assert.equal(L.needsLive('hello'), false);
  // the challenge is the phone's own random pick, all three possible
  assert.deepEqual([0.1, 0.6, 0.9].map((x) => L.pickChallenge(() => x)), ['blink', 'turn-lr', 'turn-rl']);
  assert.equal(L.NOT_SURE, 'I can’t be sure that’s a live face');
});

test('the lines that hold: the live camera only, nothing sent, the check before saving him or anyone, the model vendored', () => {
  const live = code('src/features/lens/liveness.ts');
  assert.match(live, /async look\(cam: LiveCamera\): Promise<[^>]*>\s*\{\s*if \(!isLive\(cam\)\) throw new Error\(NOT_LIVE\);/, 'the live camera first');
  const NET = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts)\s*\(|\bbrain\.|\/api\//;
  assert.doesNotMatch(live.replace(/fetchModel\(LIVE_FILE,/g, ''), NET, 'no network but its own model file');
  assert.match(live, /LIVE_FILE = '\/vendor\/facemesh\/face_landmarker\.task'/);
  const people = code('src/features/lens/people.ts');
  const enrolAt = people.indexOf("confirmLive('enrol'");
  const introAt = people.indexOf("confirmLive('introduce'");
  assert.ok(enrolAt > 0 && enrolAt < people.indexOf('await saveMe('), 'the check comes before his face is saved');
  assert.ok(introAt > 0 && introAt < people.indexOf('await addPerson('), 'and before a person is saved');
  assert.doesNotMatch(people, /\bchat\.set|\bbrain\.|from '\.\.\/\.\.\/api\/brain'/);
  assert.match(code('src/features/settings/faces.ts'), /switchRow\('CHECK IT’S LIVE'/);
  // the model: Google's own file, unchanged, with its licence and where it came from
  const dir = new URL('public/vendor/facemesh/', WEB);
  const bytes = readFileSync(new URL('face_landmarker.task', dir));
  assert.equal(statSync(new URL('face_landmarker.task', dir)).size, 3758596);
  const sum = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sum, '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff');
  const source = readFileSync(new URL('SOURCE.md', dir), 'utf8');
  assert.match(source, new RegExp(sum));
  assert.match(source, /storage\.googleapis\.com\/mediapipe-models\/face_landmarker/);
  assert.match(readFileSync(new URL('LICENSE', dir), 'utf8'), /Apache License\s+Version 2\.0/);
});

// ---------------------------------------------------------------- 2. SHAPES

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A finger's trace round some corners (sketch units): tilted by `tilt`°, shaky (`shake` units), each corner overshot a little. */
function handTrace(corners, { tilt = 0, shake = 0.004, closed = true, seed = 3, step = 0.01 } = {}) {
  const r = rng(seed);
  const n = () => (r() - 0.5) * 2 * shake;
  const c = [corners.reduce((s, p) => s + p[0], 0) / corners.length, corners.reduce((s, p) => s + p[1], 0) / corners.length];
  const a = (tilt * Math.PI) / 180;
  const rot = ([x, y]) => [c[0] + (x - c[0]) * Math.cos(a) - (y - c[1]) * Math.sin(a), c[1] + (x - c[0]) * Math.sin(a) + (y - c[1]) * Math.cos(a)];
  const path = closed ? [...corners, corners[0]] : corners;
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [p, q] = [path[i], path[i + 1]];
    const k = Math.max(2, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    // a hand runs a little past each corner before it turns
    for (let j = 0; j <= k + 1; j++) out.push(rot([p[0] + ((q[0] - p[0]) * j) / k + n(), p[1] + ((q[1] - p[1]) * j) / k + n()]));
  }
  return out;
}
const RECT = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.6], [0.3, 0.6]];
const angleAt = (pts, i) => {
  const [a, p, b] = [pts[(i - 1 + pts.length) % pts.length], pts[i], pts[(i + 1) % pts.length]];
  const d = Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0]);
  return Math.abs((Math.atan2(Math.sin(d), Math.cos(d)) * 180) / Math.PI);
};

test('a shaky, tilted rectangle in the air is a rectangle: square corners, its sides across and down the page', () => {
  for (const [tilt, seed] of [[0, 1], [8, 2], [-11, 3], [30, 4]]) {
    const r = SH.recognise(handTrace(RECT, { tilt, seed }));
    assert.ok(r, `tilt ${tilt}`);
    assert.equal(r.shape.kind, 'rect', `tilt ${tilt}: ${r.shape.kind} ${JSON.stringify(r.shape.pts)}`);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(angleAt(r.shape.pts, i) - 90) < 1e-6, `a right angle at corner ${i}`);
    for (let i = 0; i < 4; i++) {
      const [a, b] = [r.shape.pts[i], r.shape.pts[(i + 1) % 4]];
      assert.ok(Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9, 'every side runs across or down');
    }
    const xs = r.shape.pts.map((p) => p[0]);
    const ys = r.shape.pts.map((p) => p[1]);
    const [w, d] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    assert.ok(Math.abs(Math.max(w, d) - 0.4) < 0.02 && Math.abs(Math.min(w, d) - 0.3) < 0.02, `size ${w} × ${d}`);
  }
});

test('corners snap to a right angle within 12°, not beyond; an L, a circle and a line are known for what they are', () => {
  const skew = (deg) => SH.snapCorners([[0, 0], [1, 0], [1 + Math.tan((deg * Math.PI) / 180), 1], [0, 1]], true, 0);
  assert.ok([0, 1, 2, 3].every((i) => Math.abs(angleAt(skew(8), i) - 90) < 1e-6), 'within 12°: square');
  assert.ok([0, 1, 2, 3].some((i) => Math.abs(angleAt(skew(20), i) - 90) > 10), 'beyond 12°: as drawn');
  const L2 = SH.recognise(handTrace([[0.2, 0.2], [0.6, 0.2], [0.6, 0.4], [0.4, 0.4], [0.4, 0.7], [0.2, 0.7]], { tilt: 6, seed: 5 }));
  assert.equal(L2.shape.kind, 'L');
  assert.equal(L2.shape.pts.length, 6);
  const circle = Array.from({ length: 80 }, (_, i) => [0.5 + 0.2 * Math.cos((i / 78) * 2 * Math.PI) + Math.sin(i * 7.3) * 0.004, 0.5 + 0.2 * Math.sin((i / 78) * 2 * Math.PI)]);
  const C = SH.recognise(circle);
  assert.equal(C.shape.kind, 'circle');
  assert.equal(C.shape.pts.length, SH.CIRCLE_SIDES);
  const line = SH.recognise(handTrace([[0.2, 0.5], [0.75, 0.53]], { closed: false, seed: 6 }));
  assert.equal(line.shape.kind, 'line');
  assert.equal(line.shape.closed, false);
  assert.equal(SH.recognise([[0.5, 0.5], [0.51, 0.5], [0.5, 0.51], [0.51, 0.51], [0.5, 0.5]]), null, 'a dot is nothing');
  // a later shape keeps the first one's straight
  assert.equal(SH.recognise(handTrace(RECT, { tilt: 9, seed: 8 }), 0.05).axis, 0.05);
});

test('the scale from one said length, every corner on 5 cm; the plan: a room, a door and a window off the corners, a bed, a wall, areas', () => {
  let sk = PL.emptySketch();
  const room = SH.recognise(handTrace(RECT, { tilt: 5, seed: 9 }));
  sk = PL.addShape(sk, room.shape, room.axis);
  assert.equal(PL.buildPlan(sk).scaleSaid, false);
  assert.match(PL.buildPlan(sk).words, /scale is a guess/);
  sk = PL.setLength(sk, WD.lengthSaid('that wall is four metres'));
  let built = PL.buildPlan(sk);
  assert.equal(built.scaleSaid, true);
  // the wall he named is exactly what he said; the others follow from his drawing, each a whole number of 5 cm
  const walls = built.rooms[0].walls;
  const [w0, d0] = built.rooms[0].box;
  assert.equal(w0, 4, `walls ${walls}`);
  assert.ok(Math.abs(d0 - 3) <= 0.1, `the drawn 3:4 side: ${d0}`);
  assert.deepEqual([...walls].sort(), [d0, d0, 4, 4].sort());
  for (const m of walls) assert.ok(Math.abs(Math.round(m * 20) - m * 20) < 1e-9, `${m} m is not a whole number of 5 cm`);
  assert.equal(built.rooms[0].area, Math.round(4 * d0 * 10) / 10);
  for (const p of built.room.rooms[0].poly) for (const v of p) assert.equal(v % 5, 0, `a corner off the 5 cm grid: ${v}`);
  // a rectangle drawn true to 4 by 3 is 4.00 by 3.00 and 12.0 m² exactly
  const exact = PL.setLength(PL.addShape(PL.emptySketch(), { kind: 'rect', pts: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.6], [0.3, 0.6]], closed: true }, 0), 4);
  assert.deepEqual(PL.buildPlan(exact).rooms[0].box, [4, 3]);
  assert.equal(PL.buildPlan(exact).rooms[0].area, 12);
  // a door in the middle of the bottom wall, a window cut right at a corner (kept off it), a bed, a wall on its own
  const pts = sk.shapes[0].pts;
  const bottom = Math.max(...pts.map((p) => p[1]));
  const top = Math.min(...pts.map((p) => p[1]));
  const midX = pts.reduce((s, p) => s + p[0], 0) / 4;
  sk = PL.addCut(sk, [midX, bottom + 0.01], 'door');
  sk = PL.addCut(sk, [pts[0][0] + 0.002, pts[0][1]], 'window');
  sk = { ...sk, items: [{ ...WD.itemSaid('a bed here'), at: [midX, (top + bottom) / 2] }] };
  const wall = SH.recognise(handTrace([[0.8, 0.3], [0.8, 0.6]], { closed: false, seed: 4 }), sk.axis);
  sk = PL.addShape(sk, wall.shape, wall.axis);
  sk = { ...sk, material: WD.materialSaid('brick walls please'), north: WD.northSaid('north is to the left') };
  built = PL.buildPlan(sk);
  assert.deepEqual(built.openings.map((o) => [o.type, o.w]), [['door', 0.8], ['window', 1]]);
  const lay = DS.readLayout(built.room);
  assert.deepEqual(lay.dropped, [], 'the shared reader keeps everything');
  assert.equal(lay.rooms.length, 1);
  assert.equal(lay.openings.length, 2, 'both openings fit their walls');
  for (const o of lay.openings) assert.equal(DS.openingProblem(lay.rooms[0], o, lay.openings, lay.h), null);
  assert.equal(lay.north, 90);
  assert.deepEqual(built.items, [{ label: 'Bed, double', w: 1.45, d: 2.05 }]);
  assert.equal(built.walls.length, 1, 'a wall on its own');
  assert.ok(built.room.items.some((i) => i.name === 'Wall' && i.h === 240 && i.d === 10));
  const list = PL.measuredList(sk, built, new Date('2026-11-01T12:00:00Z'));
  assert.match(list, /A sketch to measurements you gave, not a survey\./);
  assert.match(list, /Room 1: 4\.00 m × \d\.\d\d m, area \d+\.\d m²/);
  assert.match(list, /brick \(a guess from your words\)/);
  assert.match(list, /Door: 0\.80 m wide/);
  assert.match(list, /Bed, double: 1\.45 m × 2\.05 m/);
  assert.match(built.words, /Room 1, 4\.00 by \d\.\d\d metres, \d+\.\d m²/);
  // undo takes back the last thing placed
  const u = PL.undoLast(sk, ['shape', 'cut', 'cut', 'item', 'shape']);
  assert.equal(u.sk.shapes.length, 1);
  assert.equal(u.sk.cuts.length, 2);
});

test('the four hand poses from 21 points; his words read with no model', () => {
  // a hand, wrist at the bottom; `out` lists the fingers held out (1 index … 4 little)
  const hand = (out, pinch = false) => {
    const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
    const fingers = [[1, 2, 3, 4, 0.36], [5, 6, 7, 8, 0.44], [9, 10, 11, 12, 0.5], [13, 14, 15, 16, 0.56], [17, 18, 19, 20, 0.62]];
    for (const [f, [mcp, pip, dip, tip, x]] of fingers.entries()) {
      const isOut = out.includes(f);
      p[mcp] = { x, y: 0.62 };
      p[pip] = { x, y: 0.52 };
      p[dip] = isOut ? { x, y: 0.45 } : { x, y: 0.6 };
      p[tip] = isOut ? { x, y: 0.38 } : { x, y: 0.66 };
    }
    p[0] = { x: 0.5, y: 0.85 };
    p[4] = pinch ? { ...p[8] } : { x: 0.28, y: 0.6 };
    return p;
  };
  assert.equal(PO.poseOf(hand([1])), 'point');
  assert.equal(PO.poseOf(hand([1, 2])), 'two');
  assert.equal(PO.poseOf(hand([1, 2, 3, 4])), 'open');
  assert.equal(PO.poseOf(hand([])), 'fist');
  assert.equal(PO.poseOf(hand([1], true)), 'pinch');
  assert.equal(PO.poseOf([]), 'none');
  assert.deepEqual(PO.LESSON.map((l) => l.pose), ['point', 'pinch', 'two', 'open']);
  assert.equal(WD.lengthSaid('that wall is four metres'), 4);
  assert.equal(WD.lengthSaid("it's 3.5 m"), 3.5);
  assert.equal(WD.lengthSaid('this one is four and a half metres long'), 4.5);
  assert.equal(WD.lengthSaid('that wall is 350 cm'), 3.5);
  assert.equal(WD.lengthSaid('that side is twelve feet'), 3.658);
  assert.equal(WD.lengthSaid('that wall is twenty five metres'), 25);
  assert.equal(WD.lengthSaid('a bed here'), null);
  assert.equal(WD.lengthSaid('that is nice'), null);
  assert.equal(WD.itemSaid('a bed here').label, 'Bed, double');
  assert.equal(WD.itemSaid('put a single bed there').w, 100);
  assert.equal(WD.itemSaid('a sofa here').kind, 'sofa3');
  assert.deepEqual([WD.itemSaid('a 2 by 1 metre table').w, WD.itemSaid('a 2 by 1 metre table').d], [200, 100]);
  assert.equal(WD.itemSaid('that wall is four metres'), null);
  assert.deepEqual(['north is up', 'north is to the left', 'north is right', 'north is behind me', 'the north wall'].map(WD.northSaid), [0, 90, 270, 180, null]);
  assert.equal(WD.materialSaid('it is a timber garden room'), 'timber');
  assert.equal(WD.materialSaid('make the walls brick'), 'brick');
  assert.equal(WD.nameSaid('this is the kitchen'), 'Kitchen');
  assert.equal(WD.nameSaid('that is four metres'), null);
  assert.deepEqual(['undo', 'start again', 'done', 'make it a window', 'hello'].map(WD.commandSaid), ['undo', 'clear', 'done', 'window', null]);
  assert.ok(WD.shapesAsked('draw a room with my hands') && WD.shapesAsked('Sketch a plan in the air') && !WD.shapesAsked('draw me a picture of a cat'));
});

// ---------------------------------------------------------------- 3. TV MODE

test('which screens are televisions: the PS5’s browser and smart TVs, a wide screen with no touch and no fine pointer; never a laptop or a tablet', () => {
  const PS5 = 'Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15';
  const TIZEN = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const s = (w, h, pointer, touch, agent) => ({ w, h, pointer, touch, agent });
  assert.equal(TV.tvShaped(s(1920, 1080, 'fine', 0, PS5)), true, 'the PS5’s hidden browser (its pointer may say fine)');
  assert.equal(TV.tvShaped(s(1280, 720, 'coarse', 0, PS5)), true);
  assert.equal(TV.tvShaped(s(1920, 1080, 'none', 0, TIZEN)), true, 'a smart TV');
  assert.equal(TV.tvShaped(s(1920, 1080, 'coarse', 0, 'Mozilla/5.0 (X11; Linux) Chrome/120')), true, 'a remote’s pointer, no touch');
  assert.equal(TV.tvShaped(s(1920, 1080, 'none', 0, 'Mozilla/5.0 (X11; Linux) Chrome/120')), true);
  assert.equal(TV.tvShaped(s(1440, 900, 'fine', 0, MAC)), false, 'a computer with a mouse is not a television');
  assert.equal(TV.tvShaped(s(1366, 1024, 'coarse', 5, IPAD)), false, 'a tablet held sideways is not');
  assert.equal(TV.tvShaped(s(440, 956, 'coarse', 5, IPAD)), false, 'his phone is not');
  assert.equal(TV.tvShaped(s(1080, 1920, 'none', 0, PS5)), false, 'upright is not TV-shaped');
  assert.equal(TV.tvShaped(s(1024, 768, 'none', 0, 'x')), false, 'under 1,100 wide is not');
  // his setting rules over the shape
  assert.equal(TV.tvWanted('on', s(440, 956, 'coarse', 5, IPAD)), true);
  assert.equal(TV.tvWanted('off', s(1920, 1080, 'fine', 0, PS5)), false);
  assert.equal(TV.tvWanted('auto', s(1920, 1080, 'fine', 0, PS5)), true);
  // and his words
  assert.deepEqual(['TV mode on', 'turn on TV mode', 'TV mode off', 'switch off the tv layout', 'what is on tv tonight'].map(TV.tvAsked), ['on', 'on', 'off', 'off', null]);
  assert.deepEqual(TV.PAD, { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1 });
});

test('the focus order: rows top to bottom, left to right; LEFT and RIGHT step through it, UP and DOWN go to the nearest one in the next row', () => {
  // a top bar (back, title button, search), a 3 × 2 grid of tiles, a wide box with a send button
  const B = (x, y, w, h) => ({ x, y, w, h });
  const boxes = [
    B(900, 600, 300, 150), B(20, 20, 60, 56), B(1700, 20, 60, 56), B(500, 400, 300, 150), B(900, 400, 300, 150),
    B(100, 400, 300, 150), B(100, 600, 300, 150), B(500, 600, 300, 150), B(100, 900, 1300, 72), B(1420, 905, 120, 60), B(860, 26, 200, 44),
  ];
  assert.deepEqual(TV.readingOrder(boxes), [1, 10, 2, 5, 3, 4, 6, 7, 0, 8, 9]);
  assert.equal(TV.nextFocus(boxes, -1, 'down'), 1, 'nothing focused: the first in reading order');
  assert.equal(TV.nextFocus(boxes, 1, 'right'), 10);
  assert.equal(TV.nextFocus(boxes, 4, 'right'), 6, 'RIGHT at the end of a row goes on in reading order');
  assert.equal(TV.nextFocus(boxes, 6, 'left'), 4);
  assert.equal(TV.nextFocus(boxes, 1, 'left'), 1, 'the first stays the first');
  assert.equal(TV.nextFocus(boxes, 3, 'down'), 7, 'DOWN keeps the column');
  assert.equal(TV.nextFocus(boxes, 4, 'down'), 0);
  assert.equal(TV.nextFocus(boxes, 7, 'up'), 3);
  assert.equal(TV.nextFocus(boxes, 10, 'down'), 4, 'from the title down to the tile under it');
  assert.equal(TV.nextFocus(boxes, 0, 'down'), 8, 'to the box');
  assert.equal(TV.nextFocus(boxes, 9, 'down'), 9, 'nothing below the last row');
  assert.equal(TV.nextFocus([], -1, 'down'), -1);
});
