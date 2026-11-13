// THE PHOTO EDITOR'S MATHS AND RECIPE (BRIEF-EDITOR-PHOTO): the pure parts the phone's pipeline (photo/gpu.ts) and its slow path
// (photo/cpu.ts) both draw from, proved on numbers: a white-balance matrix's neutral grey, an exposure stop doubling, a curve through its
// points and never going back down, the eight colour bands adding to one, the vignette's centre untouched, a recipe's sixty-deep history
// and its undo, a preset keeping a second recipe's crop, the store's `room()` words, and the CPU path's picture for a tiny image against
// pixels worked out by hand. Run from router.test.mjs (package.json is protected, so no new file in the test list), like kernel-yes.
// The bundles are built here with esbuild's API (as engines.test.mjs does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['math', 'recipe', 'cpu', 'room', 'alpha'].map((m) => at(`../../web/src/photo/${m}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/photo'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const M = await import('./.build/photo/math.mjs');
const R = await import('./.build/photo/recipe.mjs');
const C = await import('./.build/photo/cpu.mjs');
const Room = await import('./.build/photo/room.mjs');
const A = await import('./.build/photo/alpha.mjs');

const near = (a, b, e = 1e-6, why = '') => assert.ok(Math.abs(a - b) <= e, `${why} ${a} is not ${b} (±${e})`);

test('an exposure stop doubles linear light, and a stop down halves it', () => {
  assert.equal(M.exposureGain(1), 2);
  assert.equal(M.exposureGain(-1), 0.5);
  assert.equal(M.exposureGain(0), 1);
  const base = R.newRecipe();
  const g1 = M.gradeOfLight({ ...base.light, exposure: 1 }, base.wb, base.color, base.curves);
  const c = [0.2, 0.3, 0.4];
  const out = M.grade(c, g1);
  for (let i = 0; i < 3; i++) near(M.srgbToLin(out[i]), 2 * M.srgbToLin(c[i]), 1e-9, `channel ${i}`);
  // sRGB and linear are each other's inverse
  for (const v of [0, 0.01, 0.2, 0.5, 0.9, 1]) near(M.linToSrgb(M.srgbToLin(v)), v, 1e-9);
});

test('a white-balance matrix sends the cast it is set to remove to a neutral grey, and is the identity at 6,500 K', () => {
  const id = M.wbMatrix(6500, 0);
  [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => near(id[i], v, 1e-9, `identity ${i}`));
  for (const [t, tint] of [[3200, 0], [4500, 10], [5200, 0], [8000, -20], [10000, 0]]) {
    const m = M.wbMatrix(t, tint);
    const cast = M.castOf(t, tint);
    const out = [m[0] * cast[0], m[4] * cast[1], m[8] * cast[2]];
    near(out[0], out[1], 1e-9, `${t} K: red against green`);
    near(out[1], out[2], 1e-9, `${t} K: green against blue`);
    // the brightness holds
    near(0.2126 * m[0] + 0.7152 * m[4] + 0.0722 * m[8], 1, 1e-9, `${t} K: brightness`);
  }
  // warmer than neutral reddens, cooler blues
  const warm = M.wbGains(8000, 0);
  const cool = M.wbGains(4500, 0);
  assert.ok(warm[0] > 1 && warm[2] < 1, `warm gains ${warm}`);
  assert.ok(cool[0] < 1 && cool[2] > 1, `cool gains ${cool}`);
});

test('a curve passes through its points and never goes back down', () => {
  const pts = [[0, 0], [0.25, 0.4], [0.6, 0.62], [1, 1]];
  const m = M.curveSlopes(pts);
  for (const [x, y] of pts) near(M.curveEval(pts, m, x), y, 1e-9, `at ${x}`);
  let last = -1;
  for (let i = 0; i <= 1000; i++) {
    const y = M.curveEval(pts, m, i / 1000);
    assert.ok(y >= last - 1e-12, `the curve goes down at ${i / 1000}`);
    last = y;
  }
  // a step in the points (a flat run then a rise) stays monotone too
  const hard = [[0, 0], [0.3, 0.3], [0.4, 0.9], [1, 1]];
  const mh = M.curveSlopes(hard);
  let l2 = -1;
  for (let i = 0; i <= 1000; i++) {
    const y = M.curveEval(hard, mh, i / 1000);
    assert.ok(y >= l2 - 1e-12 && y <= 1 + 1e-9, `the hard curve overshoots at ${i / 1000}: ${y}`);
    l2 = y;
  }
  // a point lifts the midtones; the straight line is not applied at all
  assert.ok(M.curveEval([[0, 0], [0.5, 0.65], [1, 1]], M.curveSlopes([[0, 0], [0.5, 0.65], [1, 1]]), 0.5) > 0.5);
  assert.equal(M.curveReady(R.identityCurve()), null);
  // six points at most, the ends held at 0 and 1, none closer than 2 %
  const t = M.tidyCurve([[0, 0], [0.1, 0.1], [0.11, 0.2], [0.3, 0.3], [0.4, 0.4], [0.5, 0.5], [0.6, 0.6], [0.7, 0.7], [1, 1]]);
  assert.ok(t.length <= 6 && t[0][0] === 0 && t[t.length - 1][0] === 1, JSON.stringify(t));
  for (let i = 1; i < t.length; i++) assert.ok(t[i][0] - t[i - 1][0] >= 0.02);
});

test('the eight colour bands always add up to one, and a band holds its own hue wholly', () => {
  for (let h = 0; h < 360; h += 0.5) near(M.hslWeights(h).reduce((a, b) => a + b, 0), 1, 1e-12, `hue ${h}`);
  M.BAND_HUES.forEach((hue, i) => near(M.hslWeights(hue)[i], 1, 1e-12, `band ${i}`));
  // the hue's round trip through HSL holds
  for (const c of [[0.8, 0.2, 0.1], [0.1, 0.9, 0.4], [0.3, 0.3, 0.9], [0.5, 0.5, 0.5]]) {
    const back = M.hslToRgb(M.rgbToHsl(c));
    c.forEach((v, i) => near(back[i], v, 1e-9));
  }
});

test('the vignette leaves the middle of the picture untouched and darkens the corners', () => {
  const c = [0.5, 0.4, 0.3];
  assert.deepEqual(M.vignette(c, 0, 0.8), c);
  assert.deepEqual(M.vignette(c, 0.3, 0.8), c);
  const corner = M.vignette(c, 1, 0.8);
  assert.ok(corner[0] < 0.2, `corner ${corner}`);
  assert.ok(M.vignette(c, 1, -0.8)[0] > 0.8, 'a light vignette lightens');
  // the grain is the same for the same cell and seed, and moves with the seed
  assert.equal(M.hash01(10, 20, 7), M.hash01(10, 20, 7));
  assert.notEqual(M.hash01(10, 20, 7), M.hash01(10, 20, 8));
});

test('a recipe keeps sixty steps and undoes them; the first is the photo as opened', () => {
  const h = new R.RecipeHistory(R.newRecipe());
  const r = R.newRecipe();
  for (let i = 1; i <= 70; i++) {
    r.light.exposure = i / 10;
    assert.equal(h.push(`step ${i}`, r), true);
  }
  assert.equal(h.steps.length, 61, 'sixty steps and the first');
  assert.equal(h.steps[0].label, 'Opened');
  assert.equal(h.recipe.light.exposure, 7);
  assert.equal(h.push('same', r), false, 'a change that changes nothing is not a step');
  assert.equal(h.undo().light.exposure, 6.9);
  assert.equal(h.redo().light.exposure, 7);
  assert.equal(h.redo(), null);
  assert.equal(h.jump(0).light.exposure, 0);
  assert.equal(h.undo(), null);
  // a change after an undo drops what was undone
  h.jump(30);
  r.light.contrast = 5;
  h.push('new', r);
  assert.equal(h.canRedo, false);
});

test('a preset applied to a second photo keeps that photo\'s crop, masks and heals', () => {
  const a = R.newRecipe();
  a.light.exposure = 0.7;
  a.wb.temp = 7200;
  a.effects.grain = 0.4;
  a.crop = { ...a.crop, x: 0.1, w: 0.5, ratio: '1:1' };
  const p = R.presetOf(a, 'MINE');
  assert.equal(p.mine, true);
  const b = R.newRecipe();
  b.crop = { x: 0.2, y: 0.1, w: 0.6, h: 0.8, angle: 3, quarter: 1, flip: true, ratio: '4:5' };
  b.masks = [R.newMask('linear', 1)];
  b.heals = [{ x: 0.5, y: 0.5, r: 0.02, dx: 0.05, dy: 0, feather: 0.5 }];
  b.effects.seed = 99;
  const out = R.applyPreset(b, p);
  assert.deepEqual(out.crop, b.crop);
  assert.equal(out.masks.length, 1);
  assert.equal(out.heals.length, 1);
  assert.equal(out.light.exposure, 0.7);
  assert.equal(out.wb.temp, 7200);
  assert.equal(out.effects.grain, 0.4);
  assert.equal(out.effects.seed, 99, 'the grain keeps this photo\'s own seed');
  // the eight looks are ours, in his words, with no brand in them
  assert.equal(R.LOOKS.length, 8);
  for (const l of R.LOOKS) assert.ok(/^[A-Z ]+$/.test(l.name) && l.line.length > 10 && !l.mine, l.name);
  // a preset is JSON and survives being sent through it
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test('the store\'s room() says what goes, oldest first, before it goes', () => {
  const day = 86_400_000;
  const mk = (n, bytes = 5_000_000) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `IMG_${100 + i}`, at: 1_000_000 + i * day, bytes }));
  const few = Room.room(mk(3), 4_000_000);
  assert.equal(few.fits, true);
  assert.match(few.words, /^Room for 6 more photos \(\d+ MB left\)\.$/);
  const full = Room.room(mk(10), 4_000_000);
  assert.equal(full.fits, false);
  assert.deepEqual(full.drop.map((d) => d.id), ['p0']);
  assert.match(full.words, /^I am full: I keep 10 photos or 150 MB\. To keep this one, “IMG_100” goes, the oldest\./);
  // by size: two big ones go to make room for one huge one
  const big = [{ id: 'a', name: 'A', at: 1, bytes: 60_000_000 }, { id: 'b', name: 'B', at: 2, bytes: 60_000_000 }, { id: 'c', name: 'C', at: 3, bytes: 20_000_000 }];
  const r = Room.room(big, 100_000_000);
  assert.deepEqual(r.drop.map((d) => d.id), ['a', 'b']);
  assert.ok(r.words.includes('“A” and “B” go, the oldest'), r.words);
  const huge = Room.room([], 200_000_000);
  assert.equal(huge.tooBig, true);
  assert.match(huge.words, /more than I can keep/);
  assert.equal(Room.megabytes(4_500_000), '4.5 MB');
});

test('a brush\'s alpha picture: a stroke adds, erase takes away, and the old picture stays for undo', () => {
  const a0 = A.blankAlpha(64, 48);
  const a1 = A.stroke(a0, { x: 0.3, y: 0.5 }, { x: 0.6, y: 0.5 }, 0.08, false, 640, 480);
  assert.equal(A.coverage(a0), 0);
  assert.ok(A.coverage(a1) > 0.03, `coverage ${A.coverage(a1)}`);
  assert.ok(A.alphaAt(a1, 0.45, 0.5) > 0.95);
  assert.equal(A.alphaAt(a1, 0.9, 0.1), 0);
  const a2 = A.stroke(a1, { x: 0.3, y: 0.5 }, { x: 0.6, y: 0.5 }, 0.12, true, 640, 480);
  assert.ok(A.coverage(a2) < 0.001);
});

// ---- the CPU path: a 2 × 2 picture, drawn and checked against pixels worked out by hand
const img = { w: 2, h: 2, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 100, 100, 100, 255]) };
const draw = (recipe, o = {}) => C.renderCpu({ src: img, recipe, outW: o.outW ?? 2, outH: o.outH ?? 2, ...o });
const px = (d, i) => [...d.slice(i * 4, i * 4 + 4)];

test('the slow path: no edit gives the picture back unchanged', () => {
  const d = draw(R.newRecipe());
  assert.deepEqual([...d], [...img.data]);
});

test('the slow path: +1 stop on a grey of 100 is 138 (worked by hand), red stays red and black stays black', () => {
  // 100/255 = 0.392157 → linear 0.12744 (((0.392157 + 0.055) / 1.055) ^ 2.4) → ×2 = 0.25488 → sRGB 0.54207 → 138.2 → 138
  const r = R.newRecipe();
  r.light.exposure = 1;
  const d = draw(r);
  assert.deepEqual(px(d, 3), [138, 138, 138, 255]);
  assert.deepEqual(px(d, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(d, 1), [0, 255, 0, 255]);
  // and minus a stop: 0.06372 → sRGB 0.27885... 100/255 down one stop = 71 (0.27885 × 255 = 71.1)
  r.light.exposure = -1;
  assert.deepEqual(px(draw(r), 3), [71, 71, 71, 255]);
});

test('the slow path: a quarter turn, a flip and a crop put the pixels where the hand says', () => {
  const R0 = [255, 0, 0, 255];
  const G0 = [0, 255, 0, 255];
  const B0 = [0, 0, 255, 255];
  const K0 = [100, 100, 100, 255];
  // clockwise: [A B; C D] becomes [C A; D B]
  const q = R.newRecipe();
  q.crop.quarter = 1;
  const d = draw(q);
  assert.deepEqual([px(d, 0), px(d, 1), px(d, 2), px(d, 3)], [B0, R0, K0, G0]);
  // flipped across: [A B; C D] becomes [B A; D C]
  const f = R.newRecipe();
  f.crop.flip = true;
  const df = draw(f);
  assert.deepEqual([px(df, 0), px(df, 1), px(df, 2), px(df, 3)], [G0, R0, K0, B0]);
  // the right half only: B over D, one column two pixels tall
  const c = R.newRecipe();
  c.crop = { ...c.crop, x: 0.5, w: 0.5 };
  const dc = C.renderCpu({ src: img, recipe: c, outW: 1, outH: 2 });
  assert.deepEqual([px(dc, 0), px(dc, 1)], [G0, K0]);
  assert.deepEqual(R.outputSize(c, 4000, 3000), { w: 2000, h: 3000 });
  assert.deepEqual(R.outputSize({ ...q, crop: { ...q.crop, w: 1, h: 1 } }, 4000, 3000), { w: 3000, h: 4000 }, 'a quarter turn swaps the width and the height');
});

test('the slow path: a gradient mask darkens where it holds and not where it does not', () => {
  const sky = { w: 4, h: 4, data: new Uint8Array(4 * 4 * 4).fill(180) };
  const r = R.newRecipe();
  const m = R.newMask('linear', 1);
  m.a = { x: 0.5, y: 0 };
  m.b = { x: 0.5, y: 1 };
  m.adj.exposure = -50;
  r.masks = [m];
  const d = C.renderCpu({ src: sky, recipe: r, outW: 4, outH: 4 });
  assert.ok(d[0] < 150, `top ${d[0]}`);
  assert.ok(d[(3 * 4) * 4] > 165, `bottom ${d[(3 * 4) * 4]}`);
  assert.ok(d[0] < d[(3 * 4) * 4]);
});

test('the slow path: a heal takes the clean neighbour over the blemish', () => {
  const w = 16;
  const data = new Uint8Array(w * w * 4).fill(200);
  for (let y = 7; y <= 8; y++) for (let x = 7; x <= 8; x++) data.set([20, 20, 20, 255], (y * w + x) * 4);
  const r = R.newRecipe();
  r.heals = [{ x: 8 / 16, y: 8 / 16, r: 0.2, dx: 0.3, dy: 0, feather: 0.5 }];
  const d = C.renderCpu({ src: { w, h: w, data }, recipe: r, outW: w, outH: w });
  const at = (x, y) => d[(y * w + x) * 4];
  assert.ok(at(7, 7) > 190, `the blemish is ${at(7, 7)}`);
  assert.equal(at(1, 1), 200);
});

test('the slow path: the picture\'s detail passes keep a flat colour flat and sharpen an edge', () => {
  const w = 12;
  const flat = { w, h: w, data: new Uint8Array(w * w * 4).fill(128) };
  const r = R.newRecipe();
  r.detail = { amount: 80, radius: 1, threshold: 0, noise: 50 };
  const df = C.renderCpu({ src: flat, recipe: r, outW: w, outH: w });
  assert.ok(df.every((v, i) => i % 4 === 3 || v === 128), 'a flat grey stays flat');
  const edge = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) edge.set(x < 6 ? [100, 100, 100, 255] : [160, 160, 160, 255], (y * w + x) * 4);
  const r2 = R.newRecipe();
  r2.detail = { amount: 100, radius: 1, threshold: 0, noise: 0 };
  const de = C.renderCpu({ src: { w, h: w, data: edge }, recipe: r2, outW: w, outH: w });
  assert.ok(de[(5 * w + 5) * 4] < 100, 'the dark side of an edge goes darker');
  assert.ok(de[(5 * w + 6) * 4] > 160, 'the light side goes lighter');
  // a part of the picture drawn alone equals the same part of the whole (what the tiled export relies on)
  const whole = C.renderCpu({ src: { w, h: w, data: edge }, recipe: r2, outW: w, outH: w });
  const part = C.renderCpu({ src: { w, h: w, data: edge }, recipe: r2, outW: w, outH: w, region: { x: 3, y: 2, w: 6, h: 5 } });
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) assert.equal(part[(y * 6 + x) * 4], whole[((y + 2) * w + x + 3) * 4], `tile ${x},${y}`);
});

test('the geometry: the output maps into the original and back, straightening turns it, perspective and lens are the identity when unset', () => {
  const geo = (o = {}) => ({ crop: { ...R.newRecipe().crop, ...o }, h: null, k1: 0, w: 4000, hh: 3000 });
  const p = M.mapOut(0.5, 0.5, geo());
  near(p.x, 0.5);
  near(p.y, 0.5);
  const turned = M.mapOut(0.8, 0.3, geo({ angle: 5 }));
  assert.ok(Math.abs(turned.x - 0.8) > 0.001 || Math.abs(turned.y - 0.3) > 0.001);
  for (const g of [geo(), geo({ angle: -7, quarter: 1 }), geo({ x: 0.1, y: 0.2, w: 0.6, h: 0.6, flip: true })]) {
    const o = M.mapOut(0.37, 0.64, g);
    const back = M.mapIn(o, g);
    near(back.x, 0.37, 1e-4, 'u');
    near(back.y, 0.64, 1e-4, 'v');
  }
  assert.equal(M.perspective([[0, 0], [0, 0], [0, 0], [0, 0]]), null);
  const fit = R.fitCrop(4000, 3000, 5);
  assert.ok(fit.w < 1 && fit.w > 0.85, `a 5 degree straighten crops to ${fit.w}`);
  const sq = R.fitCrop(4000, 3000, 0, 1);
  near(sq.w * 4000, sq.h * 3000, 1e-6, 'a 1:1 crop is square');
});
