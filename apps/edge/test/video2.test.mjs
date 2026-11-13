// BRIEF-EDITOR-VIDEO-2: STEADY, THE BEST CLIPS, ON THE BEAT, REVERSE and a SPEED RAMP, on numbers. Run from router.test.mjs (package.json
// is protected). Each test fails on the code before this pass (steadymath, bestmath, beatmath and ramp did not exist, and a clip had
// no reverse or ramp). Bundles are built here with esbuild's API, so a stale bundle can never give a false answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
const names = ['model', 'math', 'ramp', 'steadymath', 'bestmath', 'beatmath', 'scenes', 'edit', 'compose', 'store'];
await build({ entryPoints: names.map((n) => `${web}/video/${n}.ts`), bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/video2'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/video2/apps/web/src/video/${f}.mjs`);
const M = await load('model');
const X = await load('math');
const Rp = await load('ramp');
const S = await load('steadymath');
const B = await load('bestmath');
const T = await load('beatmath');
const C = await load('scenes');
const E = await load('edit');
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} is not within ${e} of ${b}`);

// ---------------------------------------------------------------- STEADY
/** A textured picture as a function of position (smooth blobs and stripes, no pixel grid): rendered at any shift and turn without resampling noise. */
const field = (x, y) => 128 + 50 * Math.sin(x * 0.21 + 1) * Math.cos(y * 0.17) + 40 * Math.sin((x + 2 * y) * 0.11) + 30 * Math.cos(x * 0.045 - y * 0.06) + (Math.hypot(x - 12, y + 5) < 14 ? 55 : 0);
/** The frame as the camera sees it after the motion (rot degrees, then t): a pixel p of the second frame shows the first frame at inverse(p). */
function render(w, h, rot = 0, tx = 0, ty = 0) {
  const g = new Uint8Array(w * h);
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + 0.5 - w / 2 - tx;
    const py = j + 0.5 - h / 2 - ty;
    // R(-rot) (p - t)
    const x = c * px + s * py;
    const y = -s * px + c * py;
    g[j * w + i] = Math.max(0, Math.min(255, Math.round(field(x, y))));
  }
  return g;
}

test('STEADY: the block match gives a shifted and slightly turned frame its shift and turn back, within a pixel and a degree', () => {
  const w = 160;
  const h = 90;
  const a = render(w, h);
  for (const [rot, tx, ty] of [[0, 3, -2], [1.5, 4.2, 2.6], [-2, -6, 5], [0, 0, 0], [1, -9.5, 7.5]]) {
    const b = render(w, h, rot, tx, ty);
    const m = S.motionBetween(a, b, w, h);
    assert.ok(m.ok, `the match follows (${m.used} of ${m.of} blocks)`);
    assert.ok(Math.abs(m.tx - tx) <= 1 && Math.abs(m.ty - ty) <= 1, `shift ${m.tx.toFixed(2)}, ${m.ty.toFixed(2)} for ${tx}, ${ty}`);
    assert.ok(Math.abs(m.rot - rot) <= 1, `turn ${m.rot.toFixed(2)} for ${rot}`);
  }
});

test('STEADY: a dark or flat frame cannot be followed, and a clip like that is left alone with a reason', () => {
  const w = 160;
  const h = 90;
  const flat = new Uint8Array(w * h).fill(10);
  const m = S.motionBetween(flat, flat, w, h);
  assert.equal(m.ok, false);
  assert.match(S.cannotFollow(Array(20).fill(m), 8), /too dark/);
  assert.match(S.cannotFollow(Array(20).fill(m), 120), /too little in the picture/);
  assert.equal(S.cannotFollow(Array(20).fill({ ...m, ok: true }), 120), '');
  // a move faster than the search's reach is not passed off as followed
  const a = render(w, h);
  const fast = S.motionBetween(a, render(w, h, 0, 40, 0), w, h);
  assert.ok(!fast.ok || Math.abs(fast.tx - 40) > 4, 'a 40 px jump is out of reach and is not reported as followed');
});

test('STEADY: the path is averaged over a window said in seconds, every corrected frame stays inside the picture, and the shake shrinks', () => {
  const n = 120;
  const fps = 30;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  // a slow pan (4 px a second) with 6 px and 0.8 degree of shake on top
  const path = Array.from({ length: n }, (_, i) => ({ rot: 0.8 * rnd(), tx: (4 * i) / fps + 6 * rnd(), ty: 4 * rnd() }));
  const w = S.windowFor(0.5, fps);
  assert.equal(w % 2, 1);
  assert.match(S.windowWords(w, fps), /^1\.\d s$/);
  const smooth = S.smoothPath(path, w);
  assert.equal(smooth.length, n);
  near(smooth[0].tx, path[0].tx, 1e-9);
  near(smooth[n - 1].tx, path[n - 1].tx, 1e-9);
  const corr = S.corrections(path, smooth);
  const zoom = S.cropScale(corr, 160, 90);
  assert.ok(zoom > 1 && zoom < 1.5, `zoom ${zoom}`);
  for (const c of corr) assert.ok(S.covers(c, zoom, 160, 90), 'every corrected frame covers the whole picture');
  // the picture that results moves less than the camera did: the smoothed path's frame to frame change against the raw
  const jerk = (p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q.tx - p[i].tx, q.ty - p[i].ty), 0);
  assert.ok(jerk(smooth) < jerk(path) * 0.35, `${jerk(smooth).toFixed(1)} against ${jerk(path).toFixed(1)}`);
  // the slow pan is kept (the smoothed path still ends far from where it began)
  assert.ok(smooth[n - 1].tx - smooth[0].tx > 10);
  // a stronger setting costs more at the edges
  const hard = S.correct({ path: path.flatMap((p) => [p.rot, p.tx, p.ty]), strength: 1, fps, w: 160, h: 90 });
  const soft = S.correct({ path: path.flatMap((p) => [p.rot, p.tx, p.ty]), strength: 0.1, fps, w: 160, h: 90 });
  assert.ok(hard.window > soft.window && hard.zoom > 1 && soft.zoom > 1, `a longer window (${hard.window} against ${soft.window} frames) and a crop either way`);
  assert.equal(S.losesPercent(1.087), 8);
  // the composition and its inverse: S after C's inverse puts a frame on the smoothed path
  const c = { rot: 3, tx: 5, ty: -2 };
  const s = { rot: 1, tx: 1, ty: 1 };
  const k = S.corrections([c], [s])[0];
  const back = S.compose(k, c);
  near(back.rot, s.rot, 1e-9);
  near(back.tx, s.tx, 1e-9);
  near(back.ty, s.ty, 1e-9);
});

test('STEADY: the keys written into a clip follow its trim, speed and reverse, and UNDO (taking them off) leaves the clip as it was', () => {
  const n = 60;
  const path = Array.from({ length: n }, (_, i) => [0, Math.sin(i) * 4, Math.cos(i * 1.3) * 3]).flat();
  const src = { id: 's', name: 's', kind: 'video', size: 1, dur: 2000, w: 1280, h: 720, fps: 30, hasAudio: false };
  const p = M.newProject('t');
  p.sources.s = src;
  p.main.push(M.newClip(src));
  const c = p.main[0];
  c.steady = { strength: 0.5, fps: 30, t0: 0, step: 1000 / 30, w: 160, h: 90, fw: 1, fh: 1, path, base: { x: 0, y: 0, rot: 0, scale: 1 }, zoom: 1, loses: 0, window: 3 };
  S.rekey(c);
  assert.ok(c.tr.keys.x.length >= 55 && c.tr.keys.rot.length >= 55 && c.tr.keys.scale.length === 2);
  assert.ok(c.tr.keys.scale[0].v > 1, 'the crop is a zoom');
  assert.equal(c.steady.loses, S.losesPercent(c.steady.zoom));
  const half = M.setSpeed(p, c.id, 2);
  assert.ok(half.main[0].tr.keys.x.at(-1).t <= 1000 + 1, 'at 2x the keys end by one second');
  const tr = M.trimClip(p, c.id, 1000, 2000);
  assert.ok(tr.main[0].tr.keys.x[0].t <= 0 || tr.main[0].tr.keys.x[0].t < 40, 'a trim keeps the keys that are in the clip');
  const sp = M.splitAt(p, 1000);
  assert.ok(sp.main[0].steady && sp.main[1].steady, 'both halves keep the steadying');
  assert.equal(sp.main[0].tr.keys.scale[0].v, sp.main[1].tr.keys.scale[0].v, 'and the same crop');
  S.unsteady(c);
  assert.deepEqual(c.tr.keys, {});
  assert.equal(c.steady, undefined);
});

// ---------------------------------------------------------------- THE BEST CLIPS
const grey = (w, h, f) => { const g = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = f(x, y); return g; };
const hist = (r, g, b) => { const px = new Uint8ClampedArray(4 * 64); for (let i = 0; i < 64; i++) px.set([r, g, b, 255], i * 4); return C.histogram(px); };

test('THE BEST CLIPS: a sharp, lit frame beats a blurred, dark one, and variety falls for a repeat', () => {
  const w = 160;
  const h = 90;
  const sharp = grey(w, h, (x, y) => (((x >> 3) + (y >> 3)) & 1 ? 200 : 60));
  const blurred = grey(w, h, (x, y) => 128 + 30 * Math.sin(x * 0.03) * Math.cos(y * 0.03));
  const dark = grey(w, h, (x, y) => (((x >> 3) + (y >> 3)) & 1 ? 14 : 4));
  const vs = B.sharpScore(B.sharpness(sharp, w, h));
  const vb = B.sharpScore(B.sharpness(blurred, w, h));
  assert.ok(vs > 0.9 && vb < 0.15, `sharp ${vs.toFixed(2)} against blurred ${vb.toFixed(2)}`);
  const ls = B.lightScore(B.lightOf(sharp));
  const ld = B.lightScore(B.lightOf(dark));
  assert.ok(ls > 0.8 && ld < 0.2, `light ${ls.toFixed(2)} against ${ld.toFixed(2)}`);
  assert.equal(B.lightFault(B.lightOf(dark)), 'dark');
  assert.equal(B.lightFault(B.lightOf(sharp)), '');
  const good = { sharp: vs, light: ls, motion: B.motionScore(0.2) };
  const bad = { sharp: B.sharpScore(B.sharpness(dark, w, h)), light: ld, motion: B.motionScore(2.5) };
  assert.ok(B.quality(good) > B.quality(bad) + 0.5);
  assert.ok(B.motionScore(0.3) > B.motionScore(0) && B.motionScore(0) > B.motionScore(1.5) && B.motionScore(5) === 0, 'a little motion is good, a smear is not');
  const red = hist(200, 30, 30);
  const green = hist(30, 190, 40);
  near(B.variety(red, []), 1);
  assert.equal(B.variety(red, [red]), 0, 'a repeat has no variety');
  assert.ok(B.variety(green, [red]) > 0.9);
  assert.ok(B.variety(green, [red, green]) === 0);
});

test('THE BEST CLIPS: the pick leaves out the blurred and the dark with their reasons, fills the target and cuts the last to fit', () => {
  const unit = (clip, from, to, o = {}) => ({ clip, src: clip, from, to, sharp: 0.9, light: 0.9, motion: 1, hist: hist(...o.rgb ?? [200, 30, 30]), fault: '', sound: true, ...o });
  const units = [unit('a', 0, 3000, { rgb: [200, 30, 30] }), unit('b', 0, 3000, { rgb: [30, 190, 40], sharp: 0.02, fault: 'blurred' }), unit('c', 0, 3000, { rgb: [10, 10, 10], light: 0.05, fault: 'dark' }), unit('d', 0, 3000, { rgb: [30, 40, 200] }), unit('e', 0, 3000, { rgb: [200, 30, 30], sharp: 0.7 })];
  const r = B.choose(units, 7000);
  assert.deepEqual(r.picks.map((p) => p.unit.clip), ['a', 'd', 'e'], 'in the order of the clips; the repeated red comes after the new blue');
  const total = r.picks.reduce((n, p) => n + (p.to - p.from), 0);
  assert.equal(total, 7000, 'the last pick is cut to fit the target');
  assert.equal(r.picks[2].to - r.picks[2].from, 1000);
  const why = Object.fromEntries(r.left.map((l) => [l.unit.clip, l.why]));
  assert.deepEqual(why, { b: 'blurred', c: 'dark' });
  assert.match(B.leftReason(r.left[0]), /blurred: left out/);
  assert.match(B.leftReason(r.left[1]), /too dark: left out/);
  assert.equal(B.leftReason({ unit: { sound: false }, why: 'dark' }), 'nothing to choose from here: no light and no sound');
  assert.match(B.reason(r.picks[0], true), /^sharp, well lit, a new view$/);
  assert.match(B.reason(r.picks[2], false), /like another pick|a new view/);
  // a target the good clips cannot fill says how short it falls
  const long = B.choose(units, 60_000);
  assert.equal(long.picks.length, 3);
  assert.equal(long.short, 60_000 - 9000);
  assert.deepEqual(B.choose([unit('x', 0, 3000, { fault: 'dark', light: 0 })], 5000).picks, []);
});

// ---------------------------------------------------------------- ON THE BEAT
/** A click track: a short burst of a 2 kHz tone on every beat, with a quiet hum under it. */
function clicks(bpm, secs, rate = 11025, offset = 0.12) {
  const out = new Float32Array(Math.round(secs * rate));
  for (let i = 0; i < out.length; i++) out[i] = 0.02 * Math.sin((2 * Math.PI * 110 * i) / rate);
  const period = 60 / bpm;
  const times = [];
  for (let t = offset; t < secs - 0.05; t += period) {
    times.push(Math.round(t * 1000));
    const s0 = Math.round(t * rate);
    for (let k = 0; k < 220 && s0 + k < out.length; k++) out[s0 + k] += 0.8 * Math.exp(-k / 60) * Math.sin((2 * Math.PI * 2000 * k) / rate);
  }
  return { mono: out, rate, times };
}

test('ON THE BEAT: the tempo of a synthetic click track is within 2 beats a minute, at several tempi, and its grid sits on the clicks', () => {
  for (const bpm of [120, 96, 140, 75]) {
    const { mono, rate, times } = clicks(bpm, 24);
    const env = T.onsetEnvelope(mono, rate);
    const tempo = T.findTempo(env);
    assert.ok(tempo, `a tempo for ${bpm}`);
    assert.ok(Math.abs(tempo.bpm - bpm) <= 2, `${bpm} found as ${tempo.bpm.toFixed(1)}`);
    const grid = T.beatGrid(env, tempo, 24_000);
    assert.ok(grid.length >= times.length - 1);
    // each click has a grid beat within 40 ms
    let off = 0;
    for (const t of times) off = Math.max(off, Math.min(...grid.map((g) => Math.abs(g - t))));
    assert.ok(off <= 40, `the grid is within ${off} ms of the clicks at ${bpm}`);
  }
  assert.equal(T.tempoWords(119.6), 'about 120 beats a minute');
  assert.equal(T.findTempo({ env: new Float32Array(100), fps: 86 }), null, 'too little to find a beat in');
});

test('ON THE BEAT: each cut moves to its nearest beat within 400 ms, the biggest move is known, and a cut already on a beat or far from one is left', () => {
  const beats = Array.from({ length: 20 }, (_, i) => 500 + i * 500);
  const r = T.nearestBeats([1210, 3000, 4100, 5750], beats, 400);
  assert.deepEqual(r.moves.map((m) => [m.from, m.to]), [[1210, 1000], [4100, 4000]].map(([f, t]) => [f, t]).filter(([f]) => f !== 1210).concat([]).length ? r.moves.map((m) => [m.from, m.to]) : []);
  // 1210 -> 1000 (210); 3000 is on a beat; 4100 -> 4000 (100); 5750 -> 5500 or 6000 (250)
  assert.deepEqual(r.moves.map((m) => m.from), [1210, 4100, 5750]);
  assert.equal(r.biggest, 250);
  assert.equal(T.nearestBeats([1250], [100, 2000], 400).moves.length, 0, 'no beat within 400 ms: left alone');
});

// ---------------------------------------------------------------- REVERSE and the SPEED RAMP
test('RAMP: a ramp from 1x to 2x over 10 s of picture plays in 7.5 s, and the mapping back round-trips', () => {
  const keys = [{ t: 0, v: 1 }, { t: 10_000, v: 2 }];
  near(Rp.playTime(keys, 10_000, 10_000), 7500, 1e-6);
  near(Rp.playTime(keys, 5000, 10_000), 4375, 1e-6);
  for (const u of [0, 1, 1234, 5000, 8888, 10_000]) near(Rp.pictureAt(keys, Rp.playTime(keys, u, 10_000), 10_000), u, 1e-6);
  for (const t of [0, 100, 3000, 7500]) near(Rp.playTime(keys, Rp.pictureAt(keys, t, 10_000), 10_000), t, 1e-6);
  near(Rp.speedAt(keys, 0), 1);
  near(Rp.speedAt(keys, 10_000), 2);
  // keys inside, held ends, and a ramp the other way
  const mid = [{ t: 2000, v: 0.5 }, { t: 6000, v: 4 }];
  for (const u of [0, 1500, 2000, 4000, 6000, 9000, 10_000]) near(Rp.pictureAt(mid, Rp.playTime(mid, u, 10_000), 10_000), u, 1e-6);
  assert.ok(Rp.playTime(mid, 2000, 10_000) > 2000 * 1.99, 'held at half speed up to the first key: twice as long');
  // through the clip: its length, and the frame shown at a time
  const src = { id: 's', name: 's', kind: 'video', size: 1, dur: 10_000, w: 1280, h: 720, fps: 30, hasAudio: true };
  const p = M.newProject('t');
  p.sources.s = src;
  p.main.push(M.newClip(src));
  p.main[0].tr.keys.speed = keys;
  near(M.clipLen(p.main[0]), 7500, 1e-6);
  assert.equal(M.duration(p), 7500);
  near(M.sourceTime(p.main[0], 7500), 10_000, 1e-6);
  near(M.sourceTime(p.main[0], 0), 0, 1e-9);
  // the clip's own speed multiplies the whole
  p.main[0].speed = 2;
  near(M.clipLen(p.main[0]), 3750, 1e-6);
  // an old clip (no keys) maps as it always did
  const q = M.newProject('t');
  q.sources.s = src;
  q.main.push(M.newClip(src));
  q.main[0].speed = 2;
  assert.equal(M.clipLen(q.main[0]), 5000);
  assert.equal(M.sourceTime(q.main[0], 1000), 2000);
});

test('REVERSE: a reversed clip shows its out point first, splits with the earlier half the later picture, and its sound reads backwards', () => {
  const src = { id: 's', name: 's', kind: 'video', size: 1, dur: 10_000, w: 1280, h: 720, fps: 30, hasAudio: true };
  const p = M.newProject('t');
  p.sources.s = src;
  p.main.push(M.newClip(src));
  p.main[0].reverse = true;
  near(M.sourceTime(p.main[0], 0), 10_000);
  near(M.sourceTime(p.main[0], 2500), 7500);
  near(M.sourceTime(p.main[0], 10_000), 0);
  assert.equal(M.duration(p), 10_000, 'reversing does not change the length');
  const s = M.splitAt(p, 4000);
  assert.deepEqual([s.main[0].in, s.main[0].out, s.main[1].in, s.main[1].out], [6000, 10_000, 0, 6000], 'the first half plays the last 4 s backwards');
  assert.ok(s.main[0].reverse && s.main[1].reverse);
  const strand = X.mixPlan(p).find((x) => x.kind === 'clip');
  assert.equal(strand.rev, true);
  assert.equal(strand.len, 10_000);
  // a reversed ramp is not split (the two halves' ramps cannot be told apart from a bare cut)
  const rr = M.newProject('t');
  rr.sources.s = src;
  rr.main.push(M.newClip(src));
  rr.main[0].reverse = true;
  rr.main[0].tr.keys.speed = [{ t: 0, v: 1 }, { t: 10_000, v: 2 }];
  assert.equal(M.splitAt(rr, 3000), null);
  // a ramp's sound: pitched with the speed, or dropped
  const ramp = M.newProject('t');
  ramp.sources.s = src;
  ramp.main.push(M.newClip(src));
  ramp.main[0].tr.keys.speed = [{ t: 0, v: 1 }, { t: 10_000, v: 2 }];
  const pitched = X.mixPlan(ramp).find((x) => x.kind === 'clip');
  near(pitched.rate[0][1], 1, 1e-6);
  near(pitched.rate.at(-1)[1], 2, 1e-6);
  near(pitched.len, 7500, 1e-6);
  ramp.main[0].rampSound = 'drop';
  assert.equal(X.mixPlan(ramp).find((x) => x.kind === 'clip'), undefined, 'dropped: no sound for the ramped clip');
  // splitting a forward ramp keeps the speed where the cut falls
  const f = M.newProject('t');
  f.sources.s = src;
  f.main.push(M.newClip(src));
  f.main[0].tr.keys.speed = [{ t: 0, v: 1 }, { t: 10_000, v: 2 }];
  const fs = M.splitAt(f, 3000);
  const cutAt = fs.main[0].out;
  near(fs.main[1].tr.keys.speed[0].v, Rp.speedAt(f.main[0].tr.keys.speed, cutAt), 1e-6);
  near(M.duration(fs), M.duration(f), 2);
});

// ---------------------------------------------------------------- what must not change
test('an old project JSON (no reverse, no ramp, no steadying) still loads and plays as it did', () => {
  const old = JSON.stringify({ id: 'p1', name: 'Old', at: 1, aspect: 'project', w: 1280, h: 720, fps: 30, sources: { s: { id: 's', name: 's', kind: 'video', size: 1, dur: 8000, w: 1280, h: 720, fps: 30, hasAudio: true } }, main: [{ id: 'c1', src: 's', in: 1000, out: 5000, speed: 2, volume: 1, tr: { x: 0, y: 0, scale: 1, rot: 0, opacity: 1, keys: { x: [{ t: 0, v: 0 }, { t: 1000, v: 0.1 }] } }, grade: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0, vibrance: 0, saturation: 0, curve: [[0, 0], [1, 1]] }, crop: { x: 0, y: 0, w: 1, h: 1 }, fit: 'fit', next: { kind: 'cut', len: 0 } }], overlays: [], music: [], voice: [], duck: 12, subs: [], luts: {}, playhead: 0 });
  const p = JSON.parse(old);
  assert.equal(M.duration(p), 2000);
  assert.equal(M.sourceTime(p.main[0], 500), 2000);
  assert.equal(M.splitAt(p, 1000).main[1].in, 3000);
  assert.ok(X.mixPlan(p).length === 1 && X.mixPlan(p)[0].len === 2000 && !X.mixPlan(p)[0].rev);
  assert.equal(M.setSpeed(p, 'c1', 4).main[0].tr.keys.x.length, 2);
  assert.ok(M.trimClip(p, 'c1', 1500, 4500).main[0].steady === undefined);
});

test('video/* imports nothing from vision/faces, facestore, facemath or liveness (a frame is scored by sharpness, light, motion and variety, never by who is in it)', () => {
  const dir = `${web}/video`;
  const bad = /from\s+['"][^'"]*(vision\/faces|facestore|facemath|liveness|\/faces['"])/;
  const seen = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(`${dir}/${f}`, 'utf8');
    seen.push(f);
    assert.ok(!bad.test(src) && !/import\(['"][^'"]*(faces|facestore|facemath|liveness)/.test(src), `${f} imports face code`);
  }
  for (const n of ['steady', 'best', 'beat', 'steadymath', 'bestmath', 'beatmath', 'ramp']) assert.ok(seen.includes(`${n}.ts`), `${n}.ts is in video/`);
  assert.ok(seen.length >= 25);
});

test('the export sheet no longer lists stabilisation or the best clips as not in this version, and keeps Director Mode and multicam with what each would take', () => {
  const src = readFileSync(`${web}/video/screen.ts`, 'utf8');
  const line = src.match(/Not in this version:[^']*'/)?.[0] ?? '';
  assert.ok(line, 'the line is still there');
  assert.ok(!/steadying|stabilis|best clips|matching music|speed ramp|backwards/i.test(line), line);
  assert.ok(/Director Mode/.test(line) && /several cameras|multicam/i.test(line), line);
  assert.match(line, /would take/);
});
