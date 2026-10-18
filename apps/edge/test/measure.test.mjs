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

// ---------------------------------------------------------------- MEASURE with no settings (AUTO)
// The pure parts of AUTO and of the planner's FROM PHOTO, built here (their own entry points):
// EXIF → the camera's focal length in pixels; a depth map → 3-D lengths, the tapped thing's
// region and size, the likely range; known-size cues joined with the depth model's own scale;
// written plan sizes read; a drawn plan's walls, rooms, doors, windows and scale; a corrected wall
// rescaling the plan; a room's width and depth from depth maps of the room.
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['measure/exif', 'measure/depth3d', 'measure/cues', 'space/planphoto', 'space/roomphoto'].map((f) => at(`../../web/src/${f}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/auto'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const EX = await import('./.build/auto/measure/exif.mjs');
const D3 = await import('./.build/auto/measure/depth3d.mjs');
const CU = await import('./.build/auto/measure/cues.mjs');
const PP = await import('./.build/auto/space/planphoto.mjs');
const RP = await import('./.build/auto/space/roomphoto.mjs');

/** A JPEG's first bytes with an APP1 EXIF block (TIFF `order` II or MM) holding the iPhone 13's tags. */
function jpegWithExif(order = 'II', tags = {}) {
  const T = { make: 'Apple', model: 'iPhone 13', focalMm: [51, 10], focal35: 26, w: 4032, h: 3024, ...tags };
  const le = order === 'II';
  const bytes = [];
  const u16 = (v) => (le ? bytes.push(v & 255, v >> 8) : bytes.push(v >> 8, v & 255));
  const u32 = (v) => (le ? bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : bytes.push(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  const str = (s) => [...s].map((c) => c.charCodeAt(0));
  const make = [...str(T.make), 0];
  const model = [...str(T.model), 0];
  // layout: header 8 | IFD0 (3 entries) at 8 | Exif IFD (4 entries) | data
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + 3 * 12 + 4;
  let data = exifIfd + 2 + 4 * 12 + 4;
  const makeAt = data;
  data += make.length;
  const modelAt = data;
  data += model.length;
  const ratAt = data;
  bytes.push(...str(order));
  u16(42);
  u32(ifd0);
  u16(3);
  u16(0x010f), u16(2), u32(make.length), u32(makeAt);
  u16(0x0110), u16(2), u32(model.length), u32(modelAt);
  u16(0x8769), u16(4), u32(1), u32(exifIfd);
  u32(0);
  u16(4);
  u16(0x920a), u16(5), u32(1), u32(ratAt);
  u16(0xa002), u16(4), u32(1), u32(T.w);
  u16(0xa003), u16(4), u32(1), u32(T.h);
  u16(0xa405), u16(3), u32(1);
  if (le) bytes.push(T.focal35 & 255, T.focal35 >> 8, 0, 0);
  else bytes.push(T.focal35 >> 8, T.focal35 & 255, 0, 0);
  u32(0);
  bytes.push(...make, ...model);
  u32(T.focalMm[0]);
  u32(T.focalMm[1]);
  const app1 = [...str('Exif'), 0, 0, ...bytes];
  const len = app1.length + 2;
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xda, 0, 2]);
}

test('EXIF: an iPhone photo’s lens, both byte orders; the focal length in pixels from the 35 mm equivalent', () => {
  for (const order of ['II', 'MM']) {
    const e = EX.readExif(jpegWithExif(order));
    assert.deepEqual(e, { make: 'Apple', model: 'iPhone 13', focalMm: 5.1, focal35: 26, width: 4032, height: 3024 }, order);
  }
  // 26 mm across a 4032 × 3024 photo: 26 × 5040 / 43.27 ≈ 3028 px, about 67° across the long side
  const K = EX.intrinsicsFor({ w: 4032, h: 3024 }, EX.readExif(jpegWithExif()));
  near(K.f, 3028.4, 1, 'focal px');
  near(K.longFov, 67.3, 0.2, 'long-side view');
  assert.equal(K.kind, 'exif');
  assert.match(K.source, /^Apple iPhone 13, 26 mm lens \(from the photo\)$/);
  assert.deepEqual([K.cx, K.cy], [2016, 1512]);
  // the same photo downscaled to 2048 px, and turned portrait: same view, scaled focal
  near(EX.intrinsicsFor({ w: 1536, h: 2048 }, EX.readExif(jpegWithExif())).f, 3028.4 * (2048 / 4032), 1, 'portrait, downscaled');
  // cropped square afterwards: still an answer, and it says it is less sure
  assert.match(EX.intrinsicsFor({ w: 2000, h: 2000 }, EX.readExif(jpegWithExif())).source, /cropped since/);
  // the telephoto (77 mm) is three times longer
  near(EX.intrinsicsFor({ w: 4032, h: 3024 }, EX.readExif(jpegWithExif('II', { focal35: 77 }))).f, 8969, 2, 'telephoto');
  // a 16:9 photo from the phone is cut from the 4:3 frame: same focal in pixels as the 4:3 photo
  near(EX.intrinsicsFor({ w: 4032, h: 2268 }, EX.readExif(jpegWithExif('II', { w: 4032, h: 2268 }))).f, 3028.4, 1, '16:9');
  near(EX.intrinsicsFor({ w: 3024, h: 3024 }, EX.readExif(jpegWithExif('II', { w: 3024, h: 3024 }))).f, 3028.4, 1, 'square');
  // no 35 mm equivalent: the real focal length over the sensor's width (FocalPlaneXResolution)
  const K2 = EX.intrinsicsFor({ w: 4000, h: 3000 }, { make: 'Acme', focalMm: 5, width: 4000, height: 3000, planeXRes: 4000 / 0.25, planeUnitMm: 25.4 });
  near(K2.f, (5 * 4000) / 6.35, 1e-6, 'focal from mm and sensor');
  assert.equal(K2.kind, 'exif');
  // no EXIF: the iPhone 13 main camera's 69° assumed, and said
  const d = EX.intrinsicsFor({ w: 4032, h: 3024 }, null);
  assert.equal(d.kind, 'default');
  near(d.longFov, 69, 1e-9, 'default view');
  assert.match(d.source, /no camera details/);
  // not a JPEG, a JPEG with no EXIF, a broken block: null, never a throw
  assert.equal(EX.readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(EX.readExif(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2])), null);
  assert.equal(EX.readExif(jpegWithExif().slice(0, 40)), null);
});

/** A depth map rendered by ray casting: `hit(x, y)` gives the depth along a ray (x, y, 1) of a pinhole camera. */
function render(w, h, K, hit) {
  const z = new Float32Array(w * h);
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) z[v * w + u] = hit((u + 0.5 - K.cx) / K.f, (v + 0.5 - K.cy) / K.f);
  return { w, h, z };
}

test('AUTO: model input size, the focal and real-photo corrections, 3-D lengths and rectangles from a depth map', () => {
  assert.deepEqual(D3.inputSize(4032, 3024), { w: 518, h: 392 });
  assert.deepEqual(D3.inputSize(1536, 2048), { w: 392, h: 518 });
  assert.deepEqual(D3.inputSize(4000, 1000), { w: 784, h: 392 }, 'a panorama is capped');
  for (const v of Object.values(D3.inputSize(999, 777))) assert.equal(v % 14, 0);
  // the input: channels apart (CHW), ImageNet's mean and spread taken out
  const x = D3.toInput([255, 0, 128, 255, 0, 255, 0, 255], 2, 1);
  near(x[0], (1 - 0.485) / 0.229, 1e-5, 'red of pixel 0');
  near(x[3], (1 - 0.456) / 0.224, 1e-5, 'green of pixel 1');
  near(x[4], (128 / 255 - 0.406) / 0.225, 1e-5, 'blue of pixel 0');
  // Hypersim's own camera: no focal correction; an iPhone main camera: ×0.87
  near(D3.focalFactor({ f: 886.81 }, { w: 1024, h: 768 }), 1, 1e-9, 'Hypersim camera');
  near(D3.focalFactor({ f: 3028.4 }, { w: 4032, h: 3024 }), 0.869, 0.002, 'iPhone 13 main camera');
  const m = D3.metricDepth([2, 4], 2, 1, { f: 886.81 }, { w: 1024, h: 768 });
  near(m.z[1], 4 * D3.REAL_FACTOR, 1e-6, 'real-photo factor applied');
  // a wall 2 m away, square on: 500 px apart at f = 1000 px is 1 m
  const K = { f: 1000, cx: 400, cy: 300 };
  const Kmap = { f: 100, cx: 40, cy: 30 };
  const frame = { w: 800, h: 600 };
  const wall = render(80, 60, Kmap, () => 2);
  near(D3.lengthFromDepth(wall, K, frame, { x: 150, y: 300 }, { x: 650, y: 300 }), 1000, 1e-6, 'square-on length');
  // the floor 1.3 m below the camera: two points 1 m apart going away from the camera
  const floor = render(80, 60, Kmap, (x, y) => (y > 0.01 ? 1.3 / y : 9));
  const p = (Z) => ({ x: 400, y: 300 + (1000 * 1.3) / Z });
  near(D3.lengthFromDepth(floor, K, frame, p(2), p(3)), 1000, 60, 'a metre along the floor');
  const r = D3.rectFromDepth(wall, K, frame, [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 450 }, { x: 200, y: 450 }]);
  near(r.w, 800, 1e-6, 'rect width');
  near(r.h, 500, 1e-6, 'rect height');
  // the range: the scale's doubt, the shape error and the tap's pixels; levels in plain words
  const b = D3.band(1000, 0.05, 500);
  assert.ok(b.lo < 1000 && b.hi > 1000 && Math.abs(Math.log(b.hi / 1000) - b.sigma) < 1e-9);
  near(b.sigma, Math.hypot(0.05, D3.DEPTH_STATS.shapeLogSd, (Math.SQRT2 * 3) / 500), 1e-12, 'sigma');
  assert.equal(D3.levelOf(0.05), 'good');
  assert.equal(D3.levelOf(0.13), 'fair');
  assert.equal(D3.levelOf(0.3), 'rough');
  assert.ok(D3.band(1000, 0, 20).sigma > D3.band(1000, 0, 400).sigma, 'a short tap span is less sure');
});

test('AUTO: a tapped box in front of a wall is found by its depth and measured in 3-D (60 × 80 cm, 1.5 m away)', () => {
  // the camera 1.5 m from a box's front face (60 wide, 80 high, 40 deep), a wall 3 m away behind it
  const K = { f: 500, cx: 200, cy: 150 };
  const frame = { w: 400, h: 300 };
  const box = { x0: -0.3, x1: 0.3, y0: -0.4, y1: 0.4, z0: 1.5, z1: 1.9 };
  const D = render(400, 300, K, (x, y) => {
    const t = box.z0;
    if (x * t >= box.x0 && x * t <= box.x1 && y * t >= box.y0 && y * t <= box.y1) return t;
    return 3;
  });
  const reg = D3.regionAt(D, frame, { x: 200, y: 150 });
  const sz = D3.regionSize(D, { ...K, source: '', kind: 'default', longFov: 0 }, frame, reg);
  // the trimmed spans are put right (÷ 0.94): not 6 % short
  near(sz.w, 600, 20, 'width');
  near(sz.h, 800, 25, 'height');
  assert.ok(sz.d < 50, `seen square on, only the front: ${sz.d}`);
  near(sz.z, 1.5, 0.01, 'distance');
  // the wall behind is not part of it
  near(reg.box.w, 200, 4, 'region box width (px)');
  near(reg.box.h, 267, 4, 'region box height (px)');
  // a floor-to-wall surface at one depth, two colours: with the picture's colours the region stops at the colour edge
  const flat = render(100, 100, { f: 100, cx: 50, cy: 50 }, () => 2);
  const rgb = new Uint8ClampedArray(100 * 100 * 4);
  for (let i = 0; i < 100 * 100; i++) {
    const x = i % 100;
    const grey = x < 60 ? 90 : 220;
    rgb.set([grey, grey, grey, 255], i * 4);
  }
  const noColour = D3.regionAt(flat, { w: 100, h: 100 }, { x: 30, y: 50 }, { maxShare: 1 });
  const withColour = D3.regionAt(flat, { w: 100, h: 100 }, { x: 30, y: 50 }, { rgb });
  assert.ok(noColour.box.w > 90, 'depth alone runs on across the flat surface');
  near(withColour.box.w, 60, 1, 'the colours stop it at the edge');
  // the kind of picture AUTO is for: a room; not the sky, not a close-up
  assert.equal(D3.sceneProblem(D), null);
  assert.equal(D3.sceneProblem(render(40, 30, K, (x, y) => (y < 0 ? 20 : 3))), 'outdoors');
  assert.equal(D3.sceneProblem(render(40, 30, K, () => 0.3)), 'close');
  assert.match(D3.SCENE_WORDS.outdoors, /AUTO is for rooms, things 0\.5–10 m away: use a card or an A4 sheet/);
  // inside a detector box: cut to the box
  const cut = D3.regionAt(D, frame, { x: 200, y: 150 }, { within: { x: 150, y: 100, w: 100, h: 100 } });
  assert.ok(cut.box.w <= 104 && cut.box.h <= 104, `kept in the box: ${JSON.stringify(cut.box)}`);
});

test('AUTO cues: known sizes from the detector and a sheet of paper, joined with the depth model by their doubt', () => {
  const frame = { w: 1000, h: 800 };
  // a person 400 px tall at 3 m with f 700: by depth 1.714 m tall — scale 1700 / 1714
  const person = CU.cueFromBox('person', { x: 400, y: 200, w: 120, h: 400 }, 3, 700, frame);
  near(person.scale, 1700 / 1714.3, 0.001, 'person cue');
  assert.equal(person.weak, true);
  assert.equal(CU.cueFromBox('person', { x: 400, y: 200, w: 300, h: 400 }, 3, 700, frame), null, 'sitting/crouching: no cue');
  assert.equal(CU.cueFromBox('person', { x: 400, y: 0, w: 120, h: 400 }, 3, 700, frame), null, 'cut off by the picture’s edge');
  assert.equal(CU.cueFromBox('dining table', { x: 400, y: 200, w: 300, h: 100 }, 3, 700, frame), null, 'tables come in any size');
  assert.equal(CU.cueFromBox('laptop', { x: 0, y: 300, w: 200, h: 100 }, 1, 700, frame), null, 'a laptop cut at the side says nothing of its width');
  // A4: its shape must be A4's (or Letter's)
  near(CU.cueFromSheet({ long: 330, short: 233 }).scale, 0.9, 0.003, 'A4 seen 10 % big');
  // any light box of A4's shape passes the shape test: unconfirmed it is no surer than the depth itself
  assert.equal(CU.cueFromSheet({ long: 330, short: 233 }).sigma, 0.15);
  assert.equal(CU.cueFromSheet({ long: 330, short: 233 }, true).sigma, 0.04);
  // a sheet is plain, near-white and small in the picture; a box lid, a wall, a printed poster are not
  assert.equal(CU.sheetLooksPlain({ mean: 230, sd: 8, share: 0.03 }), true);
  assert.equal(CU.sheetLooksPlain({ mean: 230, sd: 8, share: 0.4 }), false, 'too big: a wall or a door');
  assert.equal(CU.sheetLooksPlain({ mean: 150, sd: 8, share: 0.03 }), false, 'grey: not paper');
  assert.equal(CU.sheetLooksPlain({ mean: 220, sd: 45, share: 0.03 }), false, 'printed or patterned');
  // a phone lying sideways: its box's longer side is the phone's length
  const flat = CU.cueFromBox('cell phone', { x: 100, y: 100, w: 147, h: 72 }, 1, 1000, frame);
  near(flat.scale, 1, 1e-9, 'a phone lying landscape');
  assert.equal(CU.cueFromSheet({ long: 330, short: 233 }).name, 'an A4 sheet');
  assert.equal(CU.cueFromSheet({ long: 279, short: 216 }).name, 'a US Letter sheet');
  assert.equal(CU.cueFromSheet({ long: 600, short: 300 }), null, 'a 2:1 white rectangle is not a sheet');
  // nothing: the depth model alone
  const none = CU.fuseScale([]);
  assert.deepEqual([none.scale, none.sigma, none.used], [1, D3.DEPTH_STATS.logSd, []]);
  // one cue on its own counts no more than the depth itself (σ at least the prior),
  const lone = CU.fuseScale([{ name: 'a phone', scale: 0.9, sigma: 0.08 }]);
  near(lone.scale, Math.exp(Math.log(0.9) / 2), 1e-9, 'a lone cue meets the depth half way');
  // unless the owner confirmed it: an A4 sheet says 0.9 and wins, the doubt shrinks below 4 %
  const a4 = CU.fuseScale([{ name: 'an A4 sheet', scale: 0.9, sigma: 0.04, confirmed: true }]);
  const w1 = 1 / 0.04 ** 2;
  const w0 = 1 / D3.DEPTH_STATS.logSd ** 2;
  near(a4.scale, Math.exp((Math.log(0.9) * w1) / (w0 + w1)), 1e-9, 'inverse-variance in log space');
  assert.ok(a4.scale < 0.91 && a4.sigma < 0.04);
  assert.equal(a4.level, 'good');
  // a toy car (2.5× off), a weak person next to strong cues, one that disagrees: set aside and named
  const mixed = CU.fuseScale([
    { name: 'an A4 sheet', scale: 0.9, sigma: 0.04 },
    { name: 'a phone', scale: 0.93, sigma: 0.09 },
    { name: 'a car', scale: 3.1, sigma: 0.11 },
    { name: 'a person', scale: 1.1, sigma: 0.11, weak: true },
    { name: 'a mug', scale: 1.4, sigma: 0.05 },
  ]);
  assert.deepEqual(mixed.used, ['an A4 sheet', 'a phone']);
  assert.equal(mixed.ignored.length, 3);
  assert.ok(mixed.ignored.some((t) => /car.*wrong size/.test(t)) && mixed.ignored.some((t) => /person.*not needed/.test(t)) && mixed.ignored.some((t) => /mug.*disagrees/.test(t)), mixed.ignored.join(' | '));
  // a confident cue more than twice off is not dropped in silence: the owner is warned
  assert.equal(mixed.warnings.length, 1);
  assert.match(mixed.warnings[0], /^a car looks 3\.1× smaller than usual/);
  assert.deepEqual(CU.fuseScale([{ name: 'a laptop', scale: 0.45, sigma: 0.13 }]).warnings.length, 1);
  // a confirmed sheet is used even far from the depth's guess, and that is said
  const far = CU.fuseScale([{ name: 'an A4 sheet', scale: 0.2, sigma: 0.04, confirmed: true }]);
  assert.deepEqual(far.used, ['an A4 sheet']);
  assert.ok(far.scale < 0.25 && /5\.0× long by an A4 sheet/.test(far.warnings[0]), JSON.stringify(far));
  // weak cues alone are used
  assert.deepEqual(CU.fuseScale([{ name: 'a person', scale: 1.1, sigma: 0.11, weak: true }]).used, ['a person']);
  assert.equal(CU.cuesLine({ used: [] }, 'X'), 'depth from the photo (no known-size things seen: an estimate); camera: X');
  assert.equal(CU.cuesLine({ used: ['a', 'b', 'c'] }, 'X'), 'depth from the photo, corrected by a, b and c; camera: X');
});

test('written plan sizes: metric, imperial, pairs, the unit once at the end; room names give nothing', () => {
  const one = (t) => PP.parseDims(t).map((d) => (d.b == null ? Math.round(d.a) : [Math.round(d.a), Math.round(d.b)]));
  assert.deepEqual(one('4.20 x 3.60m'), [[4200, 3600]]);
  assert.deepEqual(one('4.20m × 3.60m'), [[4200, 3600]]);
  assert.deepEqual(one('4200 X 3600'), [[4200, 3600]]);
  assert.deepEqual(one('420 x 360 cm'), [[4200, 3600]]);
  assert.deepEqual(one("13'9\" x 11'10\""), [[4191, 3607]]);
  assert.deepEqual(one('Kitchen 13’9” x 11’10” (4.19 x 3.61 m)'), [[4191, 3607], [4190, 3610]]);
  assert.deepEqual(one('3.6 m'), [3600]);
  assert.deepEqual(one('3600'), [3600]);
  assert.deepEqual(one("12' 6\""), [3810]);
  assert.deepEqual(one('12ft 6in'), [3810]);
  assert.deepEqual(one('360cm'), [3600]);
  assert.deepEqual(one('Bedroom 2'), []);
  assert.deepEqual(one('Flat 12, 3 rooms'), []);
  assert.deepEqual(one('0.05 m'), [], 'too small for a room');
});

/** A drawn plan: white page, walls `t` px thick (black), a door gap with its leaf and swing, a window (thin glazing lines), a bed. */
function drawPlan({ w = 900, h = 600 } = {}) {
  const g = new Uint8Array(w * h).fill(255);
  const rect = (x0, y0, x1, y1, v = 0) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) g[y * w + x] = v;
  };
  // room A inside 100..500 × 100..400 (400 × 300 px), room B inside 510..800 × 100..400, walls 10 px
  rect(90, 90, 810, 100);
  rect(90, 400, 810, 410);
  rect(90, 90, 100, 410);
  rect(800, 90, 810, 410);
  rect(500, 90, 510, 410);
  // a door 80 px in the wall between, y 220..300, its leaf and swing drawn thin in room B
  rect(500, 220, 510, 300, 255);
  rect(510, 220, 512, 300, 0);
  for (let a = 0; a < 90; a += 0.5) {
    const x = Math.round(510 + 80 * Math.sin((a * Math.PI) / 180));
    const y = Math.round(220 + 80 * Math.cos((a * Math.PI) / 180));
    rect(x, y, x + 1, y + 1, 0);
  }
  // a window 120 px in room A's top wall, x 200..320: the wall cleared, two glazing lines
  rect(200, 90, 320, 100, 255);
  rect(200, 92, 320, 93, 0);
  rect(200, 97, 320, 98, 0);
  // a bed drawn in room B (a thin outline): not a room
  rect(600, 150, 700, 151, 0);
  rect(600, 330, 700, 331, 0);
  rect(600, 150, 601, 331, 0);
  rect(699, 150, 700, 331, 0);
  return { w, h, g };
}

test('a drawn plan: two rooms, their walls, the door between them and the window, scaled by the written sizes', () => {
  const img = drawPlan();
  // 10 mm a pixel: room A 4.00 × 3.00 m, room B 2.90 × 3.00 m
  const text = [
    { text: 'Living Room', box: { x: 250, y: 200, w: 100, h: 16 } },
    { text: '4.00 x 3.00 m', box: { x: 250, y: 230, w: 110, h: 16 } },
    { text: 'Bedroom', box: { x: 620, y: 200, w: 70, h: 16 } },
    { text: '2900', box: { x: 630, y: 375, w: 40, h: 14 } },
  ];
  const r = PP.planFromDrawing(img, text);
  assert.ok(!r.error, r.error);
  assert.equal(r.guessed, false);
  near(r.mmPerPx, 10, 0.25, 'scale (mm per px)');
  assert.equal(r.plan.rooms.length, 2, JSON.stringify(r.plan.rooms));
  const box = (room) => {
    const xs = room.poly.map((p) => p[0]);
    const ys = room.poly.map((p) => p[1]);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const [aw, ad] = box(r.plan.rooms.find((x) => x.name === 'Living Room'));
  const [bw, bd] = box(r.plan.rooms.find((x) => x.name === 'Bedroom'));
  // the shared wall: the rooms meet on its middle line, so each is half a wall (5 cm) wider than inside
  near(aw, 405, 8, 'living room width (cm)');
  near(ad, 300, 8, 'living room depth (cm)');
  near(bw, 295, 8, 'bedroom width (cm)');
  near(bd, 300, 8, 'bedroom depth (cm)');
  assert.equal(r.plan.wall, 10);
  const doors = r.plan.openings.filter((o) => o.type === 'door');
  const windows = r.plan.openings.filter((o) => o.type === 'window');
  assert.equal(doors.length, 1, JSON.stringify(r.plan.openings));
  near(doors[0].w, 80, 6, 'door width (cm)');
  assert.equal(windows.length, 1, JSON.stringify(r.plan.openings));
  near(windows[0].w, 120, 6, 'window width (cm)');
  assert.equal(r.plan.rooms.find((x) => x.id === windows[0].room).name, 'Living Room');
  assert.equal(r.notes[0], 'Found 2 rooms, 1 door and 1 window; walls 10 cm.');
  // turned 4° (a photo of a page, not quite square): straightened, same rooms
  const r2 = PP.planFromDrawing(PP.rotateGray(img, 4), []);
  assert.ok(!r2.error, r2.error);
  near(r2.angle, -4, 0.3, 'straightening angle');
  assert.equal(r2.plan.rooms.length, 2);
  // no written sizes: a guess from the walls, said plainly
  assert.equal(r2.guessed, true);
  assert.match(r2.notes.join(' '), /scale is a guess/);
  // not a plan
  assert.match(PP.planFromDrawing({ w: 100, h: 100, g: new Uint8Array(10000).fill(255) }, []).error, /No walls found/);
});

test('a corrected wall rescales the whole plan; square polygons from patches; growing an outline; shared walls meet', () => {
  const plan = { v: 2, room: { w: 400, d: 300 }, items: [{ id: 's', kind: 'sofa3', label: 'Sofa', w: 210, d: 95, x: 100, y: 0, rot: 0 }], rooms: [{ id: 'r1', name: 'Lounge', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] }], openings: [{ id: 'd1', type: 'door', room: 'r1', wall: 2, at: 100, w: 80, h: 200, sill: 0, hinge: 'start', swing: 'in' }], wall: 10, h: 240, north: 0 };
  const r = PP.rescalePlan(plan, 'r1', 0, 500);
  near(r.factor, 1.25, 1e-9, 'factor');
  assert.deepEqual(r.plan.rooms[0].poly, [[0, 0], [500, 0], [500, 375], [0, 375]]);
  assert.deepEqual([r.plan.openings[0].at, r.plan.openings[0].w], [125, 100]);
  assert.deepEqual([r.plan.items[0].w, r.plan.items[0].x], [210, 125], 'furniture keeps its size, its place scales');
  assert.equal(r.plan.h, 240, 'the ceiling is not a plan length');
  assert.equal(PP.rescalePlan(plan, 'nope', 0, 500), null);
  // two rooms meeting on a shared wall's middle line: the top wall of the left room runs half a wall (5 cm)
  // past its inside face at the shared end, so a typed inside length of 400 scales by 400 / (405 − 5)
  const two = { ...plan, items: [], openings: [], rooms: [{ id: 'a', name: 'A', poly: [[0, 0], [405, 0], [405, 300], [0, 300]] }, { id: 'b', name: 'B', poly: [[405, 0], [700, 0], [700, 300], [405, 300]] }], room: { w: 700, d: 300 } };
  near(PP.rescalePlan(two, 'a', 0, 400).factor, 1, 1e-9, 'inside length allowed for');
  near(PP.rescalePlan(two, 'a', 1, 300).factor, 1, 1e-9, 'the shared wall itself: no shared ends');
  // an L-shaped patch → six square corners
  const w = 60;
  const h = 50;
  const label = new Int32Array(w * h);
  for (let y = 10; y < 40; y++) for (let x = 10; x < (y < 25 ? 50 : 30); x++) label[y * w + x] = 1;
  assert.deepEqual(PP.spanPolygon(label, w, h, 1, 2), [[50, 10], [50, 25], [30, 25], [30, 40], [10, 40], [10, 10]]);
  assert.deepEqual(PP.grow([[0, 0], [10, 0], [10, 10], [0, 10]], 2), [[-2, -2], [12, -2], [12, 12], [-2, 12]]);
  // two rooms either side of a 10 px wall meet on its middle line
  const met = PP.meetShared([[[0, 0], [100, 0], [100, 50], [0, 50]], [[110, 0], [200, 0], [200, 50], [110, 50]]], 18);
  assert.deepEqual(met[0][1], [105, 0]);
  assert.deepEqual(met[1][0], [105, 0]);
});

/** A depth map of a box room W × D × H (metres) seen from `cam` (X right, Y up, Z into the room), turned `yaw`° and pitched down `pitch`°. */
function roomDepth({ W, D, H = 2.4, cam, yaw = 0, pitch = 10, boxes = [] }, K, size) {
  const yw = (yaw * Math.PI) / 180;
  const pt = (pitch * Math.PI) / 180;
  return render(size.w, size.h, K, (x, y) => {
    // the ray in camera space (x right, y down, z ahead; z = 1) → room space
    let dx = x;
    let dy = -y;
    let dz = 1;
    [dy, dz] = [dy * Math.cos(pt) - dz * Math.sin(pt), dy * Math.sin(pt) + dz * Math.cos(pt)];
    [dx, dz] = [dx * Math.cos(yw) + dz * Math.sin(yw), -dx * Math.sin(yw) + dz * Math.cos(yw)];
    let best = Infinity;
    const tryT = (t) => {
      if (!(t > 1e-6) || t >= best) return;
      const X = cam[0] + dx * t;
      const Y = cam[1] + dy * t;
      const Z = cam[2] + dz * t;
      if (X >= -1e-6 && X <= W + 1e-6 && Y >= -1e-6 && Y <= H + 1e-6 && Z >= -1e-6 && Z <= D + 1e-6) best = t;
    };
    if (dx) (tryT(-cam[0] / dx), tryT((W - cam[0]) / dx));
    if (dy) (tryT(-cam[1] / dy), tryT((H - cam[1]) / dy));
    if (dz) (tryT(-cam[2] / dz), tryT((D - cam[2]) / dz));
    // furniture: boxes [x0, x1, height, z0, z1] standing on the floor (the slab test)
    for (const [x0, x1, bh, z0, z1] of boxes) {
      let lo = -Infinity;
      let hi = Infinity;
      for (const [o, d, a, b] of [[cam[0], dx, x0, x1], [cam[1], dy, 0, bh], [cam[2], dz, z0, z1]]) {
        if (Math.abs(d) < 1e-12) {
          if (o < a || o > b) lo = Infinity;
          continue;
        }
        const t1 = (a - o) / d;
        const t2 = (b - o) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
      if (lo <= hi && lo > 1e-6 && lo < best) best = lo;
    }
    // the camera-space ray has z = 1, so t is the depth along the camera's axis
    return best;
  });
}

test('a room from photos: floor, walls squared up, width from the side walls, depth from the far wall and where the phone stood', () => {
  // a 90° view across (the main camera’s 69° cannot see both side walls of a wide room from close up; the 0.5× lens sees 108°)
  const size = { w: 160, h: 120 };
  const K = { f: 80, cx: 80, cy: 60 };
  // 3.2 × 4.5 m; the phone 25 cm in front of the back wall, in the middle, 1.3 m up, 12° down
  const s1 = RP.roomFromCloud(RP.cloudOf(roomDepth({ W: 3.2, D: 4.5, cam: [1.6, 1.3, 0.25], pitch: 12 }, K, size), K, 2));
  assert.ok(!s1.error, s1.error);
  near(s1.height, 1.3, 0.05, 'phone height');
  near(s1.across, 3.2, 0.1, 'width between the side walls');
  near(s1.along, 4.5, 0.1, 'depth: far wall + stance');
  // a second photo a quarter turn round: back to a side wall, looking across
  const s2 = RP.roomFromCloud(RP.cloudOf(roomDepth({ W: 4.5, D: 3.2, cam: [2.25, 1.3, 0.25], pitch: 12 }, K, size), K, 2));
  assert.ok(!s2.error, s2.error);
  const joined = RP.joinRoom([s1, s2]);
  assert.equal(joined.turned, true);
  near(joined.w, 320, 10, 'width (cm)');
  near(joined.d, 450, 10, 'depth (cm)');
  assert.ok(joined.wSd < 12 && joined.dSd < 15, `sd ${joined.wSd} ${joined.dSd}`);
  // turned 10° to the room: still squared up, the width still right
  const s3 = RP.roomFromCloud(RP.cloudOf(roomDepth({ W: 3.2, D: 4.5, cam: [1.6, 1.3, 0.3], yaw: 10, pitch: 12 }, K, size), K, 2));
  assert.ok(!s3.error, s3.error);
  near(s3.across, 3.2, 0.12, 'width, turned 10°');
  // the narrow main camera in a wide room: no side walls, so only "at least" the far wall in view
  const narrow = { f: 130, cx: 80, cy: 60 };
  const s4 = RP.roomFromCloud(RP.cloudOf(roomDepth({ W: 5, D: 3, cam: [2.5, 1.3, 0.25], pitch: 12 }, narrow, size), narrow, 2));
  assert.equal(s4.across, null);
  assert.ok(s4.acrossMin > 2.5 && s4.acrossMin < 5, `at least ${s4.acrossMin}`);
  const only = RP.joinRoom([s4]);
  assert.ok(only.w >= 250 && only.notes.some((n) => /at least/.test(n)), JSON.stringify(only));
  // a sofa along the left wall and a table: their tops are flat and face up too, but the floor is the lowest plane
  const furnished = RP.roomFromCloud(RP.cloudOf(roomDepth({ W: 3.2, D: 4.5, cam: [1.6, 1.3, 0.25], pitch: 12, boxes: [[0, 0.9, 0.45, 1.5, 3.5], [1.6, 2.4, 0.75, 1.9, 2.7]] }, K, size), K, 2));
  assert.ok(!furnished.error, furnished.error);
  near(furnished.height, 1.3, 0.06, 'the floor, not the sofa seat');
  near(furnished.across, 3.2, 0.12, 'width with furniture in front');
  // the scale's doubt and the depth model's shape error widen what a photo showed
  const wider = RP.withScaleDoubt(s1, 0.1);
  near(wider.acrossSd, Math.hypot(s1.acrossSd, s1.across * Math.hypot(0.1, RP.ROOM_SHAPE_SD)), 1e-9, 'widened across');
  assert.ok(wider.alongSd > s1.alongSd);
  // no floor in view: said plainly
  assert.match(RP.roomFromCloud(RP.cloudOf(render(160, 120, K, () => 3), K, 2)).error, /No floor in view/);
});
