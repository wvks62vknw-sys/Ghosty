// MEASURE and the SPACE PLANNER, the pure parts: the homography from four tapped corners, a
// length measured with a bank card on a surface seen in steep perspective, an A4 sheet held
// portrait, a door's height, the distance-to-the-wall estimate with the iPhone 13's 69° field of
// view (portrait and landscape), the confidence hint, cm and ft/in, typed lengths; then the room
// plan: footprints, snapping, walkway gaps, "will it fit?", and MAKE SPACE's packing (more open
// floor, nothing overlapping, nothing outside the room, at most three options).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const G = await import('./.build/measure/measure/geom.mjs');
const S = await import('./.build/measure/space/plan.mjs');

/** A perspective view of a plane: plane millimetres → photo pixels. */
const VIEW = [0.9, 0.25, 400, 0.02, 0.55, 300, 0.00012, 0.0009, 1];
const project = (H, x, y) => {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
};
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);

test('a bank card in steep perspective: lengths on its surface come out true, whatever order the corners were tapped in', () => {
  const card = [[100, 100], [185.6, 100], [185.6, 154], [100, 154]].map(([x, y]) => project(VIEW, x, y));
  // tapped in a muddled order: bottom-right, top-left, bottom-left, top-right
  const cal = G.calibrateRect([card[2], card[0], card[3], card[1]], G.CARD_MM, 'card');
  assert.equal(cal.kind, 'plane');
  assert.deepEqual(cal.sizeMm, { w: 85.6, h: 54 });
  const a = project(VIEW, 50, 300);
  const b = project(VIEW, 650, 300);
  near(G.lengthMm(cal, a, b), 600, 0.5, 'a 600 mm line across the surface');
  const c = project(VIEW, 120, 20);
  const d = project(VIEW, 120, 420);
  near(G.lengthMm(cal, c, d), 400, 0.5, 'a 400 mm line going away from the camera');
  // a wall-like rectangle 900 × 450 mm on the same surface
  const r = G.rectMm(cal, [[0, 0], [900, 0], [900, 450], [0, 450]].map(([x, y]) => project(VIEW, x, y)));
  near(r.w, 900, 1, 'rectangle width');
  near(r.h, 450, 1, 'rectangle height');
  // the same pixels, naively scaled by the card's width in the picture, would be well out: the homography matters
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  const naive = (px / Math.hypot(card[1].x - card[0].x, card[1].y - card[0].y)) * 85.6;
  assert.ok(Math.abs(naive - 600) > 30, `perspective is real in this test (${naive.toFixed(0)} mm naive)`);
});

test('the homography maps the four corners exactly; an A4 sheet seen portrait is matched long side to long side', () => {
  const H = [1.1, 0.1, 20, -0.05, 0.9, 40, 0.0002, 0.0001, 1];
  const src = [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 297 }, { x: 0, y: 297 }];
  const img = src.map((p) => project(H, p.x, p.y));
  const cal = G.calibrateRect(img, G.A4_MM, 'a4');
  assert.deepEqual(cal.sizeMm, { w: 210, h: 297 }, 'taller than wide in the picture: portrait');
  for (let i = 0; i < 4; i++) {
    const back = G.toPlane(cal, img[i]);
    near(back.x, src[i].x, 1e-6, `corner ${i} x`);
    near(back.y, src[i].y, 1e-6, `corner ${i} y`);
  }
  assert.throws(() => G.calibrateRect(img.slice(0, 3), G.A4_MM, 'a4'), /four corners/);
  assert.throws(() => G.calibrateRect([img[0], img[0], img[0], img[0]], G.A4_MM, 'a4'), /too close/);
});

test('a door: its height gives the scale for things at its distance', () => {
  const cal = G.calibrateHeight({ x: 500, y: 100 }, { x: 500, y: 1090 }, G.DOOR_MM);
  assert.equal(cal.kind, 'scale');
  near(cal.mmPerPx, 2.001, 0.001, 'mm per pixel');
  near(G.lengthMm(cal, { x: 0, y: 0 }, { x: 400, y: 0 }), 800.4, 0.1, 'a 400 px width');
  assert.equal(G.confidence(cal, []).level, 'fair');
  assert.throws(() => G.calibrateHeight({ x: 1, y: 1 }, { x: 1, y: 2 }, 1981), /top and the bottom/);
});

test('distance to the wall with the iPhone 13 wide camera (69° across the long side)', () => {
  const land = { w: 4032, h: 3024 };
  const port = { w: 3024, h: 4032 };
  near(G.horizontalFov(land), 69, 1e-9, 'landscape: the full 69° across');
  near(G.horizontalFov(port), 54.5, 0.1, 'portrait: narrower across');
  // 2.5 m away, landscape: the picture spans 2 × 2.5 × tan(34.5°) ≈ 3.437 m across
  const cal = G.calibrateDistance(2500, land);
  near(G.lengthMm(cal, { x: 0, y: 0 }, { x: land.w, y: 0 }), 2 * 2500 * Math.tan((34.5 * Math.PI) / 180), 0.01, 'full width');
  // the same distance in portrait: the same millimetres per pixel (the focal length does not turn with the phone)
  near(G.calibrateDistance(2500, port).mmPerPx, cal.mmPerPx, 1e-9, 'portrait scale');
  assert.equal(G.confidence(cal, []).level, 'rough');
  assert.throws(() => G.calibrateDistance(0, land), /distance/);
});

test('confidence: good near the card, fair a little way off, rough far away or with a tiny card', () => {
  const sq = (x, y, s) => [{ x, y }, { x: x + s * 1.585, y }, { x: x + s * 1.585, y: y + s }, { x, y: y + s }];
  const cal = G.calibrateRect(sq(500, 500, 100), G.CARD_MM, 'card');
  assert.equal(G.confidence(cal, [{ x: 520, y: 510 }, { x: 600, y: 560 }]).level, 'good');
  assert.equal(G.confidence(cal, [{ x: 900, y: 500 }]).level, 'fair');
  assert.equal(G.confidence(cal, [{ x: 2000, y: 500 }]).level, 'rough');
  assert.equal(G.confidence(G.calibrateRect(sq(500, 500, 20), G.CARD_MM, 'card'), [{ x: 510, y: 510 }]).level, 'rough');
});

test('units: cm and ft/in, and lengths typed every which way', () => {
  assert.equal(G.cmText(856), '85.6 cm');
  assert.equal(G.cmText(1981), '198 cm');
  assert.equal(G.ftInText(1981), '6 ft 6 in');
  assert.equal(G.ftInText(254), '10 in');
  assert.equal(G.ftInText(3048), '10 ft 0 in');
  assert.equal(G.ftInText(3040), '10 ft 0 in');
  assert.equal(G.bothText(2000), '200 cm · 6 ft 7 in');
  assert.equal(G.parseLength('2.4 m'), 2400);
  assert.equal(G.parseLength('240cm'), 2400);
  assert.equal(G.parseLength('2400 mm'), 2400);
  assert.equal(G.parseLength("6' 6\""), 1981);
  assert.equal(G.parseLength('6 ft 6 in'), 1981);
  assert.equal(G.parseLength('78in'), 1981);
  assert.equal(G.parseLength('8ft'), 2438);
  assert.equal(G.parseLength('2,5', 'auto'), 2500);
  assert.equal(G.parseLength('250', 'auto'), 2500);
  assert.equal(G.parseLength('198'), 1980);
  assert.equal(G.parseLength('nonsense'), null);
  assert.equal(G.parseLength('0'), null);
  const set = G.describeMeasurements([{ kind: 'rect', w: 3120, h: 2400, confidence: 'good', via: 'bank card' }, { kind: 'length', w: 850, confidence: 'fair', via: 'door 1981 mm' }]);
  assert.equal(set, '1. Rectangle 312 cm wide × 240 cm high (10 ft 3 in × 7 ft 10 in), good, by bank card\n2. Length 85.0 cm (2 ft 9 in), fair, by door 1981 mm');
});

const item = (id, kind, x, y, rot = 0) => {
  const c = S.CATALOGUE.find((k) => k.kind === kind);
  return { id, kind, label: c.label, w: c.w, d: c.d, x, y, rot };
};

test('footprints turn with the piece; snapping pulls a piece flush to a wall and to a neighbour', () => {
  const room = { w: 400, d: 350 };
  assert.deepEqual(S.footprint(item('a', 'sofa3', 10, 20)), { x: 10, y: 20, w: 210, h: 95 });
  assert.deepEqual(S.footprint(item('a', 'sofa3', 10, 20, 1)), { x: 10, y: 20, w: 95, h: 210 });
  const tv = item('tv', 'tv', 0, 0);
  // dragged to 8,203: within 12 cm of the left wall → 0; y snaps to the grid
  assert.deepEqual(S.snapItem(room, { ...item('s', 'sofa3', 8, 203) }, [tv]), { x: 0, y: 205 });
  // near the TV's right edge (150): flush against it
  assert.deepEqual(S.snapItem(room, { ...item('b', 'bookcase', 157, 0) }, [tv]), { x: 150, y: 0 });
  // pushed past the room: kept in
  assert.deepEqual(S.snapItem(room, { ...item('b', 'bookcase', 390, 340) }, []), { x: 320, y: 320 });
});

test('walkway gaps under 70 cm between facing pieces; touching pieces are no gap', () => {
  const sofa = item('sofa', 'sofa3', 50, 0);
  const tv = item('tv', 'tv', 60, 140);
  const gaps = S.tightGaps([sofa, tv]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].cm, 45);
  assert.deepEqual(gaps[0].rect, { x: 60, y: 95, w: 150, h: 45 });
  assert.equal(S.tightGaps([sofa, item('tv', 'tv', 60, 95)]).length, 0, 'pushed together');
  assert.equal(S.tightGaps([sofa, item('tv', 'tv', 60, 200)]).length, 0, '105 cm apart: fine');
  assert.deepEqual(S.clashes({ w: 300, d: 300 }, [sofa, item('x', 'armchair', 200, 50), item('y', 'desk', 250, 0)]).sort(), ['sofa', 'x', 'y']);
});

test('will it fit: with a walkway, only just, no, bigger than the room', () => {
  const room = { w: 300, d: 300 };
  assert.match(S.willItFit(room, [], 210, 95).text, /^Yes, with a 70 cm walkway/);
  const crowded = [item('a', 'double', 0, 0), item('b', 'wardrobe', 200, 0)];
  const r = S.willItFit(room, crowded, 100, 90);
  assert.equal(r.fits, true);
  assert.match(r.text, /^Only just/);
  assert.equal(S.willItFit(room, crowded, 290, 290).fits, false);
  assert.match(S.willItFit(room, [], 350, 90).text, /bigger than the room/);
});

test('MAKE SPACE: up to three layouts, each with more open floor, nothing overlapping or outside the room', () => {
  const room = { w: 420, d: 360 };
  // a cluttered living room: everything stranded in the middle
  const items = [item('sofa', 'sofa3', 100, 120), item('chair', 'armchair', 40, 40), item('tv', 'tv', 150, 260), item('books', 'bookcase', 300, 150), item('desk', 'desk', 260, 30)];
  const before = S.largestOpen(room, items);
  const r = S.makeSpace(room, items);
  assert.equal(r.now.area, before.area);
  assert.ok(r.options.length >= 1 && r.options.length <= 3, `${r.options.length} options`);
  let last = Infinity;
  for (const o of r.options) {
    assert.ok(o.open.area > before.area, `${o.name}: ${o.open.area} > ${before.area}`);
    assert.ok(o.open.area <= last, 'best first');
    last = o.open.area;
    assert.deepEqual(S.clashes(room, o.items), [], `${o.name}: no overlaps, all in the room`);
    assert.deepEqual(o.items.map((i) => i.id), items.map((i) => i.id), 'same pieces, same order');
    for (const [i, it] of o.items.entries()) assert.deepEqual([it.w, it.d], [items[i].w, items[i].d], 'sizes untouched');
  }
  // the best frees a real slab of floor: at least half the room in one open rectangle
  assert.ok(r.options[0].open.area >= 0.5 * room.w * room.d, `best open ${r.options[0].open.w} × ${r.options[0].open.h}`);
  // an already tidy room: nothing better to offer
  const tidy = S.makeSpace(room, r.options[0].items);
  assert.ok(tidy.options.every((o) => o.open.area > tidy.now.area));
  // deterministic
  assert.deepEqual(S.makeSpace(room, items), r);
});

test('largest open rectangle and plans read back safely', () => {
  assert.deepEqual(S.largestOpen({ w: 300, d: 200 }, []), { x: 0, y: 0, w: 300, h: 200, area: 60000 });
  const o = S.largestOpen({ w: 300, d: 200 }, [item('a', 'desk', 0, 0)]);
  assert.equal(o.area, Math.max(300 * 140, 180 * 200));
  const plan = S.readPlan({ room: { w: 420, d: 360 }, items: [{ id: 'a', kind: 'sofa3', label: 'Sofa', w: 210, d: 95, x: 0, y: 0, rot: 7 }, { w: 'x' }, null].filter(Boolean) });
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].rot, 0);
  assert.equal(S.readPlan({ room: { w: 'big' }, items: [] }), null);
  assert.equal(S.readPlan(null), null);
  assert.match(S.describePlan(plan), /^Room 420 × 360 cm \(15\.1 m²\); Sofa 210 × 95 cm against the top wall and left wall; biggest open floor/);
});
