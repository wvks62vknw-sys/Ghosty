// The Lens's NAME mode, its pure arithmetic (apps/web/src/vision/clipmath.ts): half floats, the
// label banks as shipped in apps/web/public/vendor/clip (shape and lengths), int8 packing, scores,
// the top few, CLIP's shares, the square crop, pixels into the model's layout, the tapped square
// and the words that ride along to the brain. No DOM, no network, no model run (the browser spec
// tests/name.spec.mjs runs the real encoder).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const M = await import('./.build/clipmath.mjs');
const VENDOR = new URL('../../web/public/vendor/clip/', import.meta.url);

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('half floats: the usual values, the edges and a little-endian array', () => {
  near(M.f16(0x3c00), 1);
  near(M.f16(0xc000), -2);
  near(M.f16(0x3555), 0.33325, 1e-4);
  near(M.f16(0x0001), 2 ** -24, 1e-12);
  assert.equal(M.f16(0x7c00), Infinity);
  assert.ok(Number.isNaN(M.f16(0x7e00)));
  assert.equal(M.f16(0x8000), -0);
  const bytes = new Uint8Array([0x00, 0x3c, 0x00, 0xc0, 0x00, 0x38]);
  assert.deepEqual([...M.decodeF16(bytes)], [1, -2, 0.5]);
});

test('banks: the names and their numbers must line up', () => {
  const two = new Uint8Array(2 * 2 * 2); // 2 names × 2 numbers × 2 bytes
  assert.equal(M.bankFromF16(['a', 'b'], two, 2).labels.length, 2);
  assert.throws(() => M.bankFromF16(['a', 'b', 'c'], two, 2), /do not match/);
  assert.throws(() => M.bankFromI8(['a'], new Uint8Array(3), 2), /do not match/);
});

test('int8 bank: packed and read back, the scores barely move', () => {
  const dim = 8;
  const rows = [M.normalize([1, 2, 3, 4, 0, 0, 0, 1]), M.normalize([0, 0, 1, 0, 5, -2, 1, 0]), M.normalize([-1, 1, -1, 1, -1, 1, -1, 1])];
  const vecs = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => vecs.set(r, i * dim));
  const { scales, q } = M.quantizeI8(vecs, dim);
  const file = new Uint8Array(rows.length * 4 + q.length);
  file.set(new Uint8Array(scales.buffer), 0);
  file.set(new Uint8Array(q.buffer), rows.length * 4);
  // read back from an offset inside a bigger buffer, as a fetch might hand it over
  const big = new Uint8Array(file.length + 3);
  big.set(file, 3);
  const i8 = M.bankFromI8(['one', 'two', 'three'], big.subarray(3), dim);
  const f32 = { labels: ['one', 'two', 'three'], dim, vecs };
  const emb = M.normalize([1, 2, 3, 3, 0, 0, 0, 1]);
  const a = M.scoresAgainst(emb, f32);
  const b = M.scoresAgainst(emb, i8);
  for (let i = 0; i < 3; i++) near(a[i], b[i], 0.01);
  assert.equal(M.nameTop(emb, i8, 1)[0].label, 'one');
});

test('scores, the top few and the shares', () => {
  assert.deepEqual(M.topK([0.1, 0.9, NaN, 0.5, 0.7], 3), [1, 4, 3]);
  assert.deepEqual(M.topK([3, 1], 5), [0, 1]);
  const p = M.softmax([1, 2, 3]);
  near(p[0] + p[1] + p[2], 1);
  assert.ok(p[2] > p[1] && p[1] > p[0]);
  // CLIP's ×100: cosines a few hundredths apart become clear winners, and huge values do not overflow
  const sharp = M.softmax([0.30, 0.27, 0.20], M.CLIP_SCALE);
  assert.ok(sharp[0] > 0.9, `top share ${sharp[0]}`);
  const big = M.softmax([1000, 999], 1);
  assert.ok(Number.isFinite(big[0]) && big[0] > big[1]);
  assert.equal(M.softmax([]).length, 0);
  assert.deepEqual([...M.normalize([0, 0])], [0, 0]);
  near(M.normalize([3, 4])[1], 0.8);
});

test('two banks: one set of shares over both, a name in both adds up', () => {
  const dim = 2;
  const core = { labels: ['cat', 'dog'], dim, vecs: new Float32Array([1, 0, 0, 1]) };
  const ext = { labels: ['tabby', 'cat'], dim, vecs: new Float32Array([0.99, 0.141, 1, 0]) };
  const emb = M.normalize([1, 0.05]);
  const one = M.nameTop(emb, core, 2);
  assert.equal(one[0].label, 'cat');
  const both = M.nameTop(emb, [core, ext], 3);
  assert.equal(both[0].label, 'cat', JSON.stringify(both));
  assert.equal(new Set(both.map((g) => g.label)).size, both.length, 'no name twice');
  const sum = both.reduce((n, g) => n + g.p, 0);
  assert.ok(sum <= 1.0001, `shares add up to at most 1: ${sum}`);
  // cat's share is its two rows together, so more than tabby's
  assert.ok(both[0].p > both.find((g) => g.label === 'tabby').p);
});

test('pictures: the centre square, pixels into three planes, the tapped square', () => {
  assert.deepEqual(M.centreSquare(1280, 720), { x: 280, y: 0, w: 720, h: 720 });
  assert.deepEqual(M.centreSquare(300, 500), { x: 0, y: 100, w: 300, h: 300 });
  // a 2 × 1 picture: one red pixel, one half-grey pixel
  const chw = M.rgbaToChw(new Uint8ClampedArray([255, 0, 0, 255, 128, 128, 128, 255]), 2, 1);
  assert.equal(chw.length, 6);
  near(chw[0], 1);
  near(chw[1], 128 / 255);
  near(chw[2], 0);
  near(chw[3], 128 / 255);
  near(chw[4], 0);
  near(chw[5], 128 / 255);
  // 40 % of the short side around the tap, kept inside the picture at the edges
  assert.deepEqual(M.tapSquare(640, 360, 1280, 720), { x: 496, y: 216, w: 288, h: 288 });
  assert.deepEqual(M.tapSquare(5, 700, 1280, 720), { x: 0, y: 432, w: 288, h: 288 });
});

test('words: the scene line and the note for the brain say these are guesses', () => {
  const names = [{ label: 'banana', p: 0.823 }, { label: 'plantain', p: 0.09 }, { label: 'fruit', p: 0.01 }, { label: 'x', p: 0.001 }];
  assert.equal(M.namesLine(names, 2), 'banana 82%, plantain 9%');
  assert.match(M.namesSeen(names), /^phone guesses \(name match, may be wrong\) banana 82%, plantain 9%, fruit 1%, x 0%$/);
  assert.equal(M.namesSeen([]), '');
});

test('the shipped banks: right sizes, every row about length 1, a name nearest itself', () => {
  const labels = JSON.parse(readFileSync(new URL('core.labels.json', VENDOR), 'utf8'));
  const core = M.bankFromF16(labels, readFileSync(new URL('core.f16.bin', VENDOR)));
  assert.equal(labels.length, 4624);
  assert.ok(labels.includes('banana') && labels.includes('bicycle') && labels.includes('cat'));
  for (let r = 0; r < labels.length; r += 97) {
    let n = 0;
    for (let k = 0; k < M.CLIP_DIM; k++) n += core.vecs[r * M.CLIP_DIM + k] ** 2;
    near(Math.sqrt(n), 1, 0.002);
  }
  const extLabels = JSON.parse(readFileSync(new URL('extended.labels.json', VENDOR), 'utf8'));
  const ext = M.bankFromI8(extLabels, readFileSync(new URL('extended.i8.bin', VENDOR)));
  assert.equal(extLabels.length, 28223);
  // the text vector of "banana" from the core bank finds "banana" first in the extended bank too
  const i = labels.indexOf('banana');
  const emb = core.vecs.slice(i * M.CLIP_DIM, (i + 1) * M.CLIP_DIM);
  assert.equal(M.nameTop(emb, ext, 1)[0].label, 'banana');
  assert.equal(M.nameTop(emb, [core, ext], 1)[0].label, 'banana');
});
