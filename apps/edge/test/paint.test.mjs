// PAINT (APPS ROUND, lane COMIC), its pure parts held to their rules with no screen: the brushes (pressure makes a dab wider and
// a light touch thinner, tilt widens a pencil), smoothing and the stabiliser, the dabs' even spacing, symmetry's copies, QuickShape
// (a wobbly line, circle, oval, box and triangle snapped; a scribble left alone), the fill bucket stopping at lines, his photo's
// outlines, and the PSD writer keeping every layer's name and blend mode. esbuild-bundled from the source, run from comic.test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const S = '../../web/src/features/paint/';
await build({
  entryPoints: { brushes: at(`${S}brushes.ts`), stroke: at(`${S}stroke.ts`), pixels: at(`${S}pixels.ts`) },
  outdir: at('./.build/paint/'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const O = (n) => import(at(`./.build/paint/${n}.js`));
const B = await O('brushes');
const K = await O('stroke');
const X = await O('pixels');
const P = (x, y, p = 0.6) => ({ x, y, p, alt: Math.PI / 2, az: 0, t: 0 });

test('the six brushes, each with words, and pressure and tilt shaping a dab', () => {
  assert.deepEqual(B.BRUSHES.map((b) => b.id), ['pencil', 'ink', 'marker', 'watercolour', 'oils', 'airbrush']);
  for (const b of B.BRUSHES) assert.ok(b.says.length > 20 && /\.$/.test(b.says), `${b.id} says what it is for`);
  const ink = B.brushOf('ink');
  assert.ok(B.dabOf(ink, 10, 1, 1).r > B.dabOf(ink, 10, 1, 0.2).r * 2, 'a firm press makes the ink wider');
  const pencil = B.brushOf('pencil');
  assert.ok(B.dabOf(pencil, 6, 1, 0.6, 0.3).r > B.dabOf(pencil, 6, 1, 0.6, Math.PI / 2).r * 1.5, 'a pencil laid on its side shades wider');
  assert.ok(B.dabOf(pencil, 6, 1, 0.2).a < B.dabOf(pencil, 6, 1, 1).a, 'a light touch is lighter');
  assert.ok(B.curveOf(0.3, 'soft') > B.curveOf(0.3, 'even') && B.curveOf(0.3, 'even') > B.curveOf(0.3, 'firm'));
  const r1 = B.seeded(42), r2 = B.seeded(42);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()], 'the same seed replays the same grain (the time-lapse)');
});

test('smoothing calms a shaky line; the stabiliser waits for the string to pull tight', () => {
  const shaky = Array.from({ length: 80 }, (_, i) => P(i * 5, 100 + (i % 2 ? 6 : -6)));
  const sm = K.smoother(0.6, 0);
  const out = shaky.map(sm).filter(Boolean);
  const wob = (pts) => Math.max(...pts.slice(10).map((q) => Math.abs(q.y - 100)));
  assert.ok(wob(out) < 3, `smoothed wobble ${wob(out)}`);
  const lazy = K.smoother(0, 20);
  assert.equal(lazy(P(0, 0)) !== null, true);
  assert.equal(lazy(P(10, 0)), null, 'inside the string: nothing drawn yet');
  assert.ok(Math.abs(lazy(P(50, 0)).x - 30) < 1e-6, 'past the string: the point trails by its length');
});

test('dabs fall evenly along a stroke, carrying the leftover to the next segment', () => {
  let carry = 0;
  const xs = [];
  for (const [a, b] of [[0, 7], [7, 30], [30, 31], [31, 60]]) {
    const r = K.dabsAlong(P(a, 0), P(b, 0), 5, carry);
    xs.push(...r.dabs.map((d) => Math.round(d.x * 1000) / 1000));
    carry = r.carry;
  }
  assert.deepEqual(xs, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
});

test('symmetry: two, four and six copies, mirrored about the centre', () => {
  assert.equal(K.mirrored(10, 20, 'off', 50, 50).length, 1);
  assert.deepEqual(K.mirrored(10, 20, 'vertical', 50, 50).map((q) => [q.x, q.y]), [[10, 20], [90, 20]]);
  assert.equal(K.mirrored(10, 20, 'quadrant', 50, 50).length, 4);
  const six = K.mirrored(80, 50, 'radial', 50, 50);
  assert.equal(six.length, 6);
  for (const q of six) assert.ok(Math.abs(Math.hypot(q.x - 50, q.y - 50) - 30) < 1e-9, 'each copy the same distance from the centre');
});

test('QuickShape: a wobbly line, circle, oval, box and triangle snap clean; a scribble is left alone', () => {
  const line = Array.from({ length: 30 }, (_, i) => P(i * 20, 100 + Math.sin(i) * 4));
  assert.equal(K.quickShape(line).kind, 'line');
  const circle = Array.from({ length: 60 }, (_, i) => { const a = (i / 59) * Math.PI * 2, r = 180 + Math.sin(i * 1.7) * 9; return P(600 + Math.cos(a) * r, 600 + Math.sin(a) * r); });
  const c = K.quickShape(circle);
  assert.equal(c.kind, 'circle');
  for (const q of c.pts) assert.ok(Math.abs(Math.hypot(q.x - 600, q.y - 600) - 180) < 12, 'the snapped circle is round about the drawn one');
  const oval = Array.from({ length: 60 }, (_, i) => { const a = (i / 59) * Math.PI * 2; return P(600 + Math.cos(a) * 300, 600 + Math.sin(a) * 150); });
  assert.equal(K.quickShape(oval).kind, 'ellipse');
  const box = [];
  for (const [a, b] of [[[0, 0], [300, 0]], [[300, 0], [300, 300]], [[300, 300], [0, 300]], [[0, 300], [0, 0]]]) for (let i = 0; i < 15; i++) box.push(P(a[0] + ((b[0] - a[0]) * i) / 15 + Math.sin(i) * 3, a[1] + ((b[1] - a[1]) * i) / 15 + Math.cos(i) * 3));
  const r = K.quickShape(box);
  assert.equal(r.kind, 'rectangle');
  const xs = r.pts.map((q) => q.x);
  assert.ok(Math.abs(Math.min(...xs)) < 6 && Math.abs(Math.max(...xs) - 300) < 6, 'the box is squared to its sides');
  const tri = [];
  for (const [a, b] of [[[0, 0], [300, 0]], [[300, 0], [150, 260]], [[150, 260], [0, 0]]]) for (let i = 0; i < 15; i++) tri.push(P(a[0] + ((b[0] - a[0]) * i) / 15, a[1] + ((b[1] - a[1]) * i) / 15));
  tri.push(P(0, 0));
  assert.equal(K.quickShape(tri).kind, 'triangle');
  const scribble = Array.from({ length: 40 }, (_, i) => P(i * 12, (i * 37) % 90));
  assert.equal(K.quickShape(scribble), null);
  assert.equal(K.taperAt(0, 100, 20), 0.15);
  assert.equal(K.taperAt(50, 100, 20), 1);
});

test('the bucket fills up to the lines (and tucks under their soft edge), and stays inside the canvas', () => {
  const w = 40, h = 30;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (x === 20) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 255; } }
  const got = X.floodMask(px, w, h, 5, 5, 24, 0);
  let n = 0;
  for (const v of got.mask) if (v) n++;
  assert.equal(n, 20 * h, 'the left half, exactly up to the line');
  assert.deepEqual(got.box, { x: 0, y: 0, w: 20, h });
  const grown = X.floodMask(px, w, h, 5, 5, 24, 1);
  assert.ok(grown.mask[5 * w + 20] === 255 && grown.mask[5 * w + 21] === 0, 'grown one pixel under the line, not past it');
  assert.equal(X.floodMask(px, w, h, -1, 5, 24), null);
});

test('his photo as outlines: an edge becomes a dark line, a flat area stays clear', () => {
  const w = 60, h = 40;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const v = x < 30 ? 30 : 230; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
  const o = X.outlinesOf(px, w, h, 0.5);
  const a = (x, y) => o[(y * w + x) * 4 + 3];
  assert.ok(Math.max(a(28, 20), a(29, 20), a(27, 20)) > 128, 'a line along the edge');
  assert.equal(a(5, 20), 0);
  assert.equal(a(55, 20), 0);
});

test('his photo as comic art: a few flat tones, inked black along the edges', () => {
  const w = 60, h = 40;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px[i] = x < 30 ? 40 + y : 200; px[i + 1] = x < 30 ? 90 : 180 - y; px[i + 2] = 60; px[i + 3] = 255; }
  const o = X.comicArtOf(px, w, h, 5);
  const tones = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 22 || x > 37) tones.add(o[(y * w + x) * 4]);
  assert.ok(tones.size <= 5, `away from the ink, a few flat tones (${tones.size})`);
  const dark = (x, y) => o[(y * w + x) * 4] + o[(y * w + x) * 4 + 1] + o[(y * w + x) * 4 + 2];
  assert.ok(Math.min(dark(28, 20), dark(29, 20)) < dark(10, 20) * 0.6, 'the edge is inked darker than the flat colour beside it');
  assert.equal(o[3], 255);
});

test('a layered PSD: the header, and every layer kept with its name, blend mode, opacity and visibility', () => {
  const w = 4, h = 3;
  const rgba = (r) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 3] = 200; } return d; };
  const bytes = X.psdOf(w, h, [
    { name: 'Paper', rgba: rgba(255), opacity: 1, visible: true, blend: 'source-over' },
    { name: 'Ink', rgba: rgba(10), opacity: 0.5, visible: false, blend: 'multiply' },
    { name: 'Glow', rgba: rgba(90), opacity: 1, visible: true, blend: 'screen' },
  ], rgba(128));
  const info = X.psdInfo(bytes);
  assert.deepEqual(info, { w, h, layers: ['Paper', 'Ink', 'Glow'], blends: ['norm', 'mul ', 'scrn'] });
  assert.equal(String.fromCharCode(...bytes.subarray(0, 4)), '8BPS');
  for (const b of Object.values(X.PSD_BLEND)) assert.equal(b.length, 4, 'every blend key is four letters');
  // PackBits: rows of clear and of runs pack small and unpack exactly
  for (const row of [new Uint8Array(1200), Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 251), Uint8Array.from({ length: 500 }, (_, i) => (i < 200 ? 9 : i % 3))]) {
    const pk = X.packBits(row);
    assert.deepEqual(X.unpackBits(pk, row.length), row);
  }
  assert.ok(X.packBits(new Uint8Array(1200)).length <= 20, 'a clear row packs to a few bytes');
  const big = new Uint8ClampedArray(300 * 200 * 4);
  const packedPsd = X.psdOf(300, 200, [{ name: 'Clear', rgba: big, opacity: 1, visible: true, blend: 'source-over' }], big);
  assert.ok(packedPsd.length < 30000, `a clear 300 × 200 layer's PSD is small: ${packedPsd.length} bytes`);
});
