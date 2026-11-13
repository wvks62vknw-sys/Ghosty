// PHOTO 2 (BRIEF-EDITOR-PHOTO-2): the pure parts of the three downloads the photo editor offers, proved on numbers and on the files.
//  - the packs' pins: every byte count in offline/eyesfiles.ts equals the vendored file, each pack's size is what it says, and every
//    folder has its licence and README beside it;
//  - the guided upsample on a synthetic mask: the edge follows the picture's, the interior is flat;
//  - the tiling of a hole over 512 px: the tiles cover the hole, with the feather, inside the photo;
//  - the RAW reader's refusal words for an unreadable file, the shoulder, the 16-bit picture's round trip;
//  - the recipe's new fields (patches, a SUBJECT mask's cut) round-tripping, and a recipe from before still reading.
// Run from router.test.mjs by one import line (package.json is protected, so no new file in the test list), like photoedit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['alpha', 'tiles', 'raw', 'png16', 'recipe', 'math'].map((m) => at(`../../web/src/photo/${m}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/photo2'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
await build({ entryPoints: [at('../../web/src/offline/eyesfiles.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/photo2/eyesfiles.mjs'), logLevel: 'warning' });
const A = await import('./.build/photo2/alpha.mjs');
const T = await import('./.build/photo2/tiles.mjs');
const RAW = await import('./.build/photo2/raw.mjs');
const P16 = await import('./.build/photo2/png16.mjs');
const R = await import('./.build/photo2/recipe.mjs');
const F = await import('./.build/photo2/eyesfiles.mjs');
const PUBLIC = at('../../web/public');

test('the packs’ pins are the vendored files, byte for byte, and each folder has its licence and its README', () => {
  for (const [name, rows] of [['CUTOUT', F.CUTOUT], ['ERASE', F.ERASE], ['RAWREADER', F.RAWREADER]]) {
    assert.ok(rows.length >= 2, `${name} has files`);
    for (const [url, bytes] of rows) assert.equal(statSync(PUBLIC + url).size, bytes, `${url} is ${bytes} bytes`);
  }
  // the erase model is cut in parts under 25 MB (Cloudflare's limit), each pinned
  for (const [url, bytes] of F.ERASE.filter(([u]) => u.includes('.part'))) assert.ok(bytes <= 25 * 1024 * 1024, `${url} is under 25 MiB`);
  assert.equal(F.ERASE.filter(([u]) => u.includes('.part')).length, 3);
  // the size said before the tap: the cut-out is about 19 MB with the shared runtime, the erase about 70 MB, the RAW reader about 1 MB
  const mb = (...r) => F.sum(...r) / 1e6;
  assert.ok(mb(F.WORKER_RUNTIME, F.CUTOUT) > 18 && mb(F.WORKER_RUNTIME, F.CUTOUT) < 20, 'the cut-out pack');
  assert.ok(mb(F.WORKER_RUNTIME, F.ERASE) > 69 && mb(F.WORKER_RUNTIME, F.ERASE) < 71, 'the erase pack');
  assert.ok(mb(F.RAWREADER) > 0.9 && mb(F.RAWREADER) < 1, 'the RAW reader');
  for (const dir of ['cutout', 'erase', 'raw']) {
    assert.ok(statSync(`${PUBLIC}/vendor/${dir}/README.md`).size > 500, `${dir}/README.md`);
    assert.ok(statSync(`${PUBLIC}/vendor/${dir}/worker.mjs`).size > 500, `${dir}/worker.mjs`);
  }
  for (const f of ['cutout/LICENSE.txt', 'erase/LICENSE.txt', 'raw/LICENSE-libraw-lgpl-2.1.txt', 'raw/LICENSE-libraw-cddl-1.0.txt', 'raw/COPYRIGHT-libraw.txt']) assert.ok(statSync(`${PUBLIC}/vendor/${f}`).size > 500, f);
  // the licences are the ones their READMEs name
  assert.match(readFileSync(`${PUBLIC}/vendor/cutout/LICENSE.txt`, 'utf8'), /Apache License\s+Version 2\.0/);
  assert.match(readFileSync(`${PUBLIC}/vendor/erase/LICENSE.txt`, 'utf8'), /Apache License\s+Version 2\.0/);
  assert.match(readFileSync(`${PUBLIC}/vendor/raw/LICENSE-libraw-lgpl-2.1.txt`, 'utf8'), /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 2\.1/);
  assert.match(readFileSync(`${PUBLIC}/vendor/raw/README.md`, 'utf8'), /separately\s+fetched file/);
  // the erase model's parts joined are the file the README gives the SHA-256 of
  const joined = Buffer.concat(F.ERASE.filter(([u]) => u.includes('.part')).map(([u]) => readFileSync(PUBLIC + u)));
  assert.equal(joined.length, 55_657_319);
});

// ---------------------------------------------------------------- the guided upsample

test('a guided upsample: the mask’s edge follows the picture’s, and its interior is flat', () => {
  // a picture 96 × 64: dark on the left of x = 41, light on the right, with a little noise; the small mask has its edge a texel off, blurred
  const W = 96;
  const H = 64;
  const EDGE = 41;
  const guide = new Float32Array(W * H);
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.02;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) guide[y * W + x] = (x < EDGE ? 0.15 : 0.85) + rnd();
  // the mask is 24 × 16 (four times smaller): the subject is the right side, its edge at x = 40 of the picture, i.e. between texels, blurred
  const lw = 24;
  const lh = 16;
  const low = new Float32Array(lw * lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) low[y * lw + x] = Math.min(1, Math.max(0, ((x + 0.5) * 4 - 35) / 8));
  const up = A.guidedUpsample({ w: lw, h: lh, data: low }, { w: W, h: H, data: guide }, 6, 0.0015);
  // the edge sits on the picture's: well below half at x = EDGE - 2, well above at x = EDGE + 1 (a plain bilinear upsample crosses 0.5 at x = 39, two pixels early)
  const row = (y, x) => up.data[y * W + x];
  for (const y of [8, 32, 55]) {
    assert.ok(row(y, EDGE - 2) < 0.35, `left of the edge at row ${y}: ${row(y, EDGE - 2)}`);
    assert.ok(row(y, EDGE + 1) > 0.65, `right of the edge at row ${y}: ${row(y, EDGE + 1)}`);
  }
  const plain = A.planeAt({ w: lw, h: lh, data: low }, (EDGE - 2 + 0.5) / W, 0.5);
  assert.ok(plain > 0.45, `a plain upsample puts the edge elsewhere (${plain} at the picture's left of the edge)`);
  // the interiors are flat
  for (const [x0, x1] of [[2, 30], [52, 92]]) {
    let lo = 1;
    let hi = 0;
    for (let y = 4; y < H - 4; y++) for (let x = x0; x < x1; x++) (lo = Math.min(lo, row(y, x)), (hi = Math.max(hi, row(y, x))));
    assert.ok(hi - lo < 0.06, `the interior between ${x0} and ${x1} varies by ${hi - lo}`);
  }
  assert.ok(row(32, 10) < 0.05 && row(32, 80) > 0.95, 'the ends are 0 and 1');
  // the letterbox: a 4:3 picture in a 320 square sits 240 high, 40 down
  const lb = A.letterbox(4000, 3000, 320);
  assert.deepEqual([lb.x, lb.y, lb.w, lb.h], [0, 40, 320, 240]);
  const sq = { w: 320, h: 320, data: new Float32Array(320 * 320).fill(0.5) };
  for (let y = 40; y < 280; y++) for (let x = 0; x < 320; x++) sq.data[y * 320 + x] = x < 160 ? 0 : 1;
  const cut = A.unletterbox(sq, 4000, 3000, 64, 48);
  assert.equal(cut.data[24 * 64 + 5], 0);
  assert.equal(cut.data[24 * 64 + 60], 1);
  assert.equal(cut.data[0], 0, 'the empty bars are cut away: the first row is the picture');
});

// ---------------------------------------------------------------- the erase's tiling

test('a hole over 512 px is filled in tiles that cover it, with the feather, inside the photo', () => {
  const IW = 4000;
  const IH = 3000;
  const check = (box) => {
    const plan = T.planErase(box, IW, IH);
    // every pixel of the hole is the core of some tile; every window is inside the photo and holds its core
    for (let y = box.y; y < box.y + box.h; y += 7)
      for (let x = box.x; x < box.x + box.w; x += 7) {
        const best = Math.max(...plan.tiles.map((t) => T.coreWeight(t.core, x, y, T.FEATHER / plan.k)));
        assert.equal(best, 1, `(${x}, ${y}) of the hole is in a core`);
      }
    for (const t of plan.tiles) {
      assert.ok(t.win.x >= 0 && t.win.y >= 0 && t.win.x + t.win.w <= IW && t.win.y + t.win.h <= IH, 'the window is inside the photo');
      assert.ok(t.core.x >= t.win.x && t.core.y >= t.win.y && t.core.x + t.core.w <= t.win.x + t.win.w && t.core.y + t.core.h <= t.win.y + t.win.h, 'the window holds its core');
      assert.ok(t.win.w * plan.k <= T.MODEL_SIDE + 1 && t.win.h * plan.k <= T.MODEL_SIDE + 1, 'the window fits the model');
    }
    // the patch holds the hole and its feather, inside the photo
    const m = Math.floor((T.FEATHER + T.GROW) / plan.k);
    assert.ok(plan.patch.x <= Math.max(0, box.x - m) + 1 && plan.patch.x + plan.patch.w >= Math.min(IW, box.x + box.w + m) - 1, 'the patch holds the feather');
    return plan;
  };
  const small = check({ x: 1800, y: 1400, w: 90, h: 70 });
  assert.equal(small.tiles.length, 1);
  assert.equal(small.k, 1);
  const wide = check({ x: 600, y: 900, w: 1200, h: 300 });
  assert.equal(wide.k, 1);
  assert.equal(wide.tiles.length, 4, 'a 1,200 px wide hole is four 300 px parts');
  const corner = check({ x: 3700, y: 2750, w: 290, h: 240 });
  assert.equal(corner.tiles.length, 1);
  const huge = check({ x: 400, y: 300, w: 3000, h: 2400 });
  assert.ok(huge.k < 1, 'a hole bigger than four tiles across is filled at a smaller scale');
  assert.ok(huge.tiles.length <= T.MAX_TILES_ACROSS ** 2, `${huge.tiles.length} tiles`);
  // the weight falls from 1 at the core's edge to 0 a feather away
  const core = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(T.coreWeight(core, 120, 120, 24), 1);
  assert.equal(T.coreWeight(core, 149, 120, 24), 1);
  assert.ok(Math.abs(T.coreWeight(core, 150 + 11, 120, 24) - 0.5) < 1e-9);
  assert.equal(T.coreWeight(core, 149 + 24, 120, 24), 0);
  // the hole's bounds, a dilation and the soft edge
  const w = 20;
  const h = 12;
  const m = new Uint8Array(w * h);
  m[5 * w + 7] = 255;
  m[6 * w + 9] = 255;
  assert.deepEqual(T.holeBounds(m, w, h, 40), { x: 7, y: 5, w: 3, h: 2 });
  assert.equal(T.holeBounds(new Uint8Array(w * h), w, h), null);
  const bin = new Uint8Array(w * h);
  bin[5 * w + 7] = 1;
  const d = T.dilate(bin, w, h, 2);
  assert.equal(d[5 * w + 9], 1);
  assert.equal(d[5 * w + 10], 0);
  assert.equal(d[3 * w + 7], 1);
  assert.equal(d[2 * w + 7], 0);
  const soft = T.soften(d, w, h, 1);
  assert.ok(soft[5 * w + 7] > 0.99 && soft[5 * w + 10] < 0.4 && soft[5 * w + 10] >= 0);
  assert.equal(T.waitSeconds(1, 21000), 25);
  assert.equal(T.waitSeconds(4, 21000), 85);
  assert.equal(T.waitSeconds(1, 100), 5);
});

// ---------------------------------------------------------------- the RAW reader

test('the RAW reader says what went wrong in plain words and never the same thing for two causes', () => {
  const junk = RAW.rawRefusal(-100009, 'holiday.nef');
  assert.match(junk, /holiday\.nef/);
  assert.match(junk, /not a RAW file I know|cut short/);
  assert.match(junk, /JPEG or HEIC/);
  const unsupported = RAW.rawRefusal(-3, 'x.dng');
  assert.match(unsupported, /can’t read that kind of RAW yet/);
  const memory = RAW.rawRefusal(-100007, 'big.cr3');
  assert.match(memory, /ran out of memory/);
  const odd = RAW.rawRefusal(-77, 'y.arw');
  assert.match(odd, /-77/);
  assert.equal(new Set([junk, unsupported, memory, odd]).size, 4);
  for (const w of [junk, unsupported, memory, odd]) {
    assert.ok(!/LibRaw|wasm|exception|undefined/i.test(w), `no jargon in: ${w}`);
  }
  const e = new RAW.RawError(-2, junk);
  assert.equal(e.name, 'RawError');
  assert.equal(e.code, -2);
  assert.equal(new RAW.RawNeedsReader('x').name, 'RawNeedsReader');
});

test('the developed picture keeps what the sensor held beyond white: a shoulder that rises and never reaches one', () => {
  let last = -1;
  for (let x = 0; x <= 4; x += 0.05) {
    const y = RAW.shoulder(x);
    assert.ok(y >= last, 'rising');
    assert.ok(y < 1, `below one at ${x}`);
    last = y;
  }
  assert.equal(RAW.shoulder(0.5), 0.5);
  // a small dark-ish picture is brightened (at most four stops, never darkened), the brightest still apart from the next
  const w = 8;
  const h = 4;
  const data = new Uint16Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = i === 0 ? 60000 : i === 1 ? 52000 : 9000;
    data[i * 3] = v;
    data[i * 3 + 1] = v;
    data[i * 3 + 2] = v;
  }
  const d = RAW.develop16(data, w, h);
  assert.ok(d.stops > 0.5 && d.stops <= 4, `brightened by ${d.stops} stops`);
  assert.ok(d.rgba[8] < d.rgba[4], 'the dark part is darker than the bright one');
  assert.ok(d.rgba[0] > d.rgba[4], 'the two brightest are still apart (the highlights are not both clipped)');
  assert.ok(d.rgba[0] < 255, 'and not clipped');
  assert.equal(d.rgba[3], 255);
});

test('the 16-bit picture kept beside a RAW comes back exactly', async () => {
  const w = 37;
  const h = 19;
  const data = new Uint16Array(w * h * 3);
  let s = 3;
  for (let i = 0; i < data.length; i++) data[i] = (s = (s * 1664525 + 1013904223) >>> 0) >>> 16;
  data[0] = 0;
  data[1] = 65535;
  const blob = await P16.encodePng16(data, w, h);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(String.fromCharCode(...bytes.slice(12, 16)), 'IHDR');
  const back = await P16.decodePng16(blob);
  assert.equal(back.w, w);
  assert.equal(back.h, h);
  assert.deepEqual([...back.data], [...data]);
  await assert.rejects(() => P16.decodePng16(new Blob([new Uint8Array(40)])), /not the picture I kept/);
});

// ---------------------------------------------------------------- the recipe's new fields

test('the recipe’s new fields round-trip, and a recipe from before still reads', () => {
  const r = R.newRecipe();
  assert.equal(r.patches, undefined, 'a fresh recipe has no list: an old one has none either');
  assert.ok(R.isUntouched(r));
  const m = R.newMask('subject', 1);
  m.cut = 'model';
  r.masks.push(m);
  r.patches = [{ id: 'x1', x: 0.1, y: 0.2, w: 0.3, h: 0.1 }];
  const back = JSON.parse(JSON.stringify(r));
  assert.deepEqual(back.patches, r.patches);
  assert.equal(back.masks[0].cut, 'model');
  assert.equal(R.cloneRecipe(r).patches[0].id, 'x1');
  assert.ok(!R.isUntouched(r));
  // an empty list is as untouched as none
  const e = R.newRecipe();
  e.patches = [];
  assert.ok(R.isUntouched(e));
  // a recipe saved before (no patches, no cut) read the way the store reads it: over a fresh recipe
  const old = JSON.parse(JSON.stringify(R.newRecipe()));
  delete old.patches;
  old.masks = [{ ...R.newMask('subject', 1) }];
  delete old.masks[0].cut;
  const read = { ...R.newRecipe(), ...old };
  assert.equal(read.v, 1);
  assert.equal(read.masks[0].cut, undefined);
  assert.equal((read.patches ?? []).length, 0);
  assert.ok(Array.isArray(read.heals));
  // a history over it takes the patch as a step and gives it back on undo
  const hst = new R.RecipeHistory(R.newRecipe());
  const next = R.cloneRecipe(R.newRecipe());
  next.patches = [{ id: 'x2', x: 0, y: 0, w: 0.5, h: 0.5 }];
  assert.ok(hst.push('Erased on this phone', next));
  assert.equal(hst.recipe.patches[0].id, 'x2');
  assert.equal(hst.undo().patches, undefined);
  assert.equal(hst.redo().patches[0].id, 'x2');
});
