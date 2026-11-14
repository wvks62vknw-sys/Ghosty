// BRIEF-EDITOR-VIDEO (the seventh full editor): the project's maths and files on numbers.
//  time mapping through speed and trims; keyframes; a transition's weights; the ducking curve; the chroma distance; the .cube
//  parser (a hand-written 2-point LUT, and a malformed one refused in his words); SCENES on synthetic histograms; QUIET on a
//  synthetic RMS series; the .srt and .vtt writers and readers; the mp4 muxer's boxes on two fake samples; the store's room()
//  words; the history's depth; the six grade functions. Run from router.test.mjs (package.json is protected: no new file in the
//  test list). Bundles are built here with esbuild's API (the files are pure), so a stale bundle can never give a false answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
const names = ['model', 'edit', 'compose', 'math', 'grade', 'lut', 'subs', 'scenes', 'quiet', 'mp4', 'demux', 'store'];
await build({ entryPoints: names.map((n) => `${web}/video/${n}.ts`), bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/video'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/video/apps/web/src/video/${f}.mjs`);
const M = await load('model');
const X = await load('math');
const E = await load('edit');
const K = await load('compose');
const G = await load('grade');
const L = await load('lut');
const S = await load('subs');
const C = await load('scenes');
const Q = await load('quiet');
const P = await load('mp4');
const R = await load('store');
const Dx = await load('demux');

const src = (id, dur = 10_000, extra = {}) => ({ id, name: id, kind: 'video', size: 1000, dur, w: 1280, h: 720, fps: 30, hasAudio: true, ...extra });
const project = (...lens) => {
  const p = M.newProject('t');
  for (const [i, d] of lens.entries()) {
    const s = src(`s${i}`, d);
    p.sources[s.id] = s;
    p.main.push(M.newClip(s));
  }
  return p;
};
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} is not within ${e} of ${b}`);

test('time maps through speed and trims: a clip at 2x over 10 s is 5 s, and the frame at t is in + (t - start) x speed', () => {
  const p = M.setSpeed(project(10_000), M.newProject().id && project(10_000).main[0].id, 2);
  assert.equal(p, null, 'a clip id from another project is not found');
  const q = project(10_000);
  const r = M.setSpeed(q, q.main[0].id, 2);
  assert.equal(M.clipLen(r.main[0]), 5000);
  assert.equal(M.duration(r), 5000);
  const t = M.trimClip(r, r.main[0].id, 2000, 8000);
  assert.equal(M.duration(t), 3000, '6 s of source at 2x');
  const pl = M.place(t.main)[0];
  assert.equal(M.sourceTime(pl.clip, 1000 - pl.start), 2000 + 1000 * 2);
  assert.equal(M.setSpeed(q, q.main[0].id, 99).main[0].speed, 4, 'speed is held between 0.25 and 4');
  assert.equal(M.setSpeed(q, q.main[0].id, 0.01).main[0].speed, 0.25);
});

test('clips lie end to end, a transition overlaps the next clip by its length, and it cannot be longer than half a clip', () => {
  const p = project(4000, 6000, 2000);
  assert.deepEqual(M.place(p.main).map((x) => [x.start, x.len]), [[0, 4000], [4000, 6000], [10000, 2000]]);
  const a = M.setTransition(p, 0, 'crossfade', 1000);
  assert.deepEqual(M.place(a.main).map((x) => x.start), [0, 3000, 9000]);
  assert.equal(M.duration(a), 11000);
  assert.deepEqual(M.place(a.main)[1].tin, { kind: 'crossfade', len: 1000 });
  const b = M.setTransition(p, 1, 'wipe', 9000);
  assert.equal(b.main[1].next.len, 1000, 'at most half of the shorter clip (2 s)');
  assert.equal(M.setTransition(p, 2, 'dip', 500), null, 'nothing follows the last clip');
  assert.equal(M.activeMain(a, 3500).length, 2, 'two clips show while the transition runs');
  assert.equal(M.activeMain(a, 1000).length, 1);
});

test('split makes two clips with the source continuing, and refuses a cut at an edge', () => {
  const p = project(10_000);
  const s = M.splitAt(p, 4000);
  assert.equal(s.main.length, 2);
  assert.equal(s.main[0].out, 4000);
  assert.equal(s.main[1].in, 4000);
  assert.equal(M.duration(s), 10_000, 'splitting does not change the length');
  assert.equal(M.splitAt(p, 50), null);
  const sp = M.setSpeed(p, p.main[0].id, 2);
  const s2 = M.splitAt(sp, 1000);
  assert.equal(s2.main[1].in, 2000, 'at 2x the first second of the timeline is two seconds of the source');
  const mv = M.moveClip(s, 0, 1);
  assert.equal(mv.main[0].in, 4000);
});

test('keyframes: the base value, the keys, linear between them, eased between them, held outside', () => {
  const keys = [{ t: 0, v: 0 }, { t: 1000, v: 10, ease: true }, { t: 2000, v: 0 }];
  assert.equal(X.valueAt(undefined, 7, 500), 7);
  assert.equal(X.valueAt(keys, 0, 0), 0);
  assert.equal(X.valueAt(keys, 0, 1000), 10);
  near(X.valueAt(keys, 0, 500), 5, 1e-9);
  near(X.valueAt(keys, 0, 1500), 5, 1e-9);
  const eased = [{ t: 0, v: 0, ease: true }, { t: 1000, v: 10 }];
  assert.ok(X.valueAt(eased, 0, 250) < 2.5, 'eased starts slower than linear');
  near(X.valueAt(eased, 0, 500), 5, 1e-9);
  assert.equal(X.valueAt(keys, 0, 9000), 0);
  assert.equal(X.valueAt(keys, 0, -5), 0);
  const tr = { ...M.flatTransform(), keys: { scale: [{ t: 0, v: 1 }, { t: 1000, v: 2 }] } };
  near(X.transformAt(tr, 500).scale, 1.5);
});

test('a transition\'s weights sum to one at every step, for every kind', () => {
  for (const k of ['cut', 'crossfade', 'dip', 'wipe', 'slide']) for (let i = 0; i <= 20; i++) {
    const w = X.transitionWeights(k, i / 20);
    near(w.a + w.b + w.black, 1, 1e-9);
    assert.ok(w.a >= 0 && w.b >= 0 && w.black >= 0);
  }
  assert.deepEqual(X.transitionWeights('crossfade', 0.25), { a: 0.75, b: 0.25, black: 0 });
  assert.equal(X.transitionWeights('dip', 0.5).black, 1);
  assert.equal(X.transitionProgress(500, 0, 1000) > 0.49 && X.transitionProgress(500, 0, 1000) < 0.51, true);
});

test('ducking: the music drops by the set decibels under the voice, with an attack and a release, and not elsewhere', () => {
  const v = [{ start: 5000, end: 8000 }];
  assert.equal(X.duckGain(1000, v, 12), 1);
  near(X.duckGain(6000, v, 12), Math.pow(10, -12 / 20), 1e-9);
  const rising = X.duckGain(4900, v, 12);
  assert.ok(rising < 1 && rising > Math.pow(10, -12 / 20), 'on its way down in the attack');
  const falling = X.duckGain(8200, v, 12);
  assert.ok(falling < 1 && falling > Math.pow(10, -12 / 20), 'on its way back in the release');
  assert.equal(X.duckGain(9000, v, 12), 1);
  assert.equal(X.duckGain(6000, v, 0), 1, 'off is off');
  assert.equal(X.duckGain(6000, [], 12), 1);
  // the plan: the music's own gain is lower where the voice is
  const p = project(10_000);
  p.music.push({ id: 'm', src: 'mus', start: 0, in: 0, len: 10_000, gain: 0.8, fadeIn: 0, fadeOut: 0 });
  p.voice.push({ id: 'v', src: 'vo', start: 5000, in: 0, len: 3000, gain: 1, fadeIn: 0, fadeOut: 0 });
  p.duck = 12;
  const plan = X.mixPlan(p).find((s) => s.kind === 'music');
  assert.ok(X.gainAt(plan, 6000) < X.gainAt(plan, 1000) * 0.3, `${X.gainAt(plan, 6000)} under the voice against ${X.gainAt(plan, 1000)}`);
  near(X.gainAt(plan, 1000), 0.8, 1e-9);
  p.duck = 0;
  const flat = X.mixPlan(p).find((s) => s.kind === 'music');
  near(X.gainAt(flat, 6000), 0.8, 1e-9);
});

test('fades ramp the gain, and a crossfade ramps the two clips\' sound against each other', () => {
  const p = project(4000, 4000);
  p.music.push({ id: 'm', src: 'mus', start: 0, in: 0, len: 8000, gain: 1, fadeIn: 1000, fadeOut: 1000 });
  const m = X.mixPlan(p).find((s) => s.kind === 'music');
  near(X.gainAt(m, 0), 0);
  near(X.gainAt(m, 500), 0.5, 1e-9);
  near(X.gainAt(m, 4000), 1);
  near(X.gainAt(m, 7500), 0.5, 1e-9);
  const q = M.setTransition(p, 0, 'crossfade', 1000);
  const [a, b] = X.mixPlan(q).filter((s) => s.kind === 'clip');
  near(X.gainAt(a, 3500), 0.5, 1e-9);
  near(X.gainAt(b, 3500), 0.5, 1e-9);
});

test('the chroma distance is zero for the key colour and grows with the difference; the alpha clears the key and keeps the rest', () => {
  const green = [0, 1, 0];
  assert.equal(X.chromaDistance(green, green), 0);
  assert.ok(X.chromaDistance(green, [1, 0, 0]) > 0.5);
  assert.ok(X.chromaDistance(green, [0.1, 0.9, 0.1]) < X.chromaDistance(green, [0.5, 0.5, 0.5]) + 0.5);
  assert.equal(X.chromaAlpha(green, green, 0.1, 0.1), 0);
  assert.equal(X.chromaAlpha([1, 0, 0], green, 0.1, 0.1), 1);
  const mid = X.chromaAlpha([0.3, 0.8, 0.3], green, 0.05, 0.3);
  assert.ok(mid > 0 && mid < 1, `a soft edge: ${mid}`);
});

const cube2 = ['TITLE "invert"', 'LUT_3D_SIZE 2', '1 1 1', '0 1 1', '1 0 1', '0 0 1', '1 1 0', '0 1 0', '1 0 0', '0 0 0'].join('\n');
test('the .cube parser reads a hand-written 2-point LUT, applies it trilinearly, and refuses a malformed one in his words', () => {
  const l = L.parseCube(cube2);
  assert.equal(l.size, 2);
  assert.equal(l.title, 'invert');
  assert.deepEqual(L.applyLut(l, [0, 0, 0]), [1, 1, 1]);
  assert.deepEqual(L.applyLut(l, [1, 0, 0]), [0, 1, 1]);
  const mid = L.applyLut(l, [0.5, 0.5, 0.5]);
  mid.forEach((v) => near(v, 0.5, 1e-9));
  const l17 = L.parseCube(['LUT_3D_SIZE 17', ...Array.from({ length: 17 ** 3 }, (_, i) => { const r = i % 17, g = Math.floor(i / 17) % 17, b = Math.floor(i / 289); return `${r / 16} ${g / 16} ${b / 16}`; })].join('\n'));
  const id = L.applyLut(l17, [0.31, 0.62, 0.9]);
  [0.31, 0.62, 0.9].forEach((v, i) => near(id[i], v, 1e-6));
  assert.equal(L.lutBytes(l).length, 2 ** 3 * 4);
  assert.throws(() => L.parseCube('LUT_3D_SIZE 2\n1 1 1\n'), /should hold 8 colours and holds 1/);
  assert.throws(() => L.parseCube('1 1 1\n'), /does not say its size/);
  assert.throws(() => L.parseCube('LUT_3D_SIZE 2\na b c\n'), /not three numbers/);
  assert.throws(() => L.parseCube('LUT_1D_SIZE 4\n'), /one-dimensional/);
  assert.throws(() => L.parseCube(cube2.replace('LUT_3D_SIZE 2', 'LUT_3D_SIZE 99')), /does not say its size/);
});

test('the six grade functions: a stop doubles the light, warm lifts red, the curve is monotone through its points, colour moves from grey', () => {
  near(G.exposureGain(1), 2);
  near(G.exposureGain(-1), 0.5);
  const wb = G.whiteBalance(0.5, 0);
  assert.ok(wb[0] > 1 && wb[2] < 1);
  const flat = G.whiteBalance(0, 0);
  assert.deepEqual(flat, [1, 1, 1]);
  const lifted = G.tone([0.2, 0.2, 0.2], { contrast: 0, highlights: 0, shadows: 1, whites: 0, blacks: 0 });
  assert.ok(lifted[0] > 0.2, 'shadows up lifts the dark');
  assert.deepEqual(G.tone([0.4, 0.5, 0.6], { contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 }).map((v) => Math.round(v * 1e6) / 1e6), [0.4, 0.5, 0.6]);
  const tab = G.monotoneCurve([[0, 0], [0.5, 0.7], [1, 1]]);
  assert.equal(tab.length, 256);
  near(tab[0], 0, 1e-6);
  near(tab[255], 1, 1e-6);
  near(tab[128], 0.7, 0.01);
  for (let i = 1; i < 256; i++) assert.ok(tab[i] >= tab[i - 1] - 1e-9, 'never goes down');
  const steep = G.monotoneCurve([[0, 0], [0.1, 0.9], [0.2, 0.92], [1, 1]]);
  for (let i = 0; i < 256; i++) assert.ok(steep[i] <= 1 + 1e-9 && steep[i] >= 0, 'no overshoot');
  const grey = G.saturation([0.5, 0.5, 0.5], 1);
  grey.forEach((v) => near(v, 0.5, 1e-9));
  const desat = G.saturation([0.9, 0.3, 0.3], -1);
  near(desat[0], desat[1], 1e-9);
  const vivid = G.vibrance([1, 0, 0], 1);
  assert.deepEqual(vivid, [1, 0, 0].map((v, i) => vivid[i]), 'a fully saturated colour is left alone');
  const flatGrade = M.flatGrade();
  const px = G.gradePixel([0.25, 0.5, 0.75], flatGrade);
  [0.25, 0.5, 0.75].forEach((v, i) => near(px[i], v, 0.01));
  const up = G.gradePixel([0.25, 0.5, 0.75], { ...flatGrade, exposure: 1 });
  assert.ok(up.every((v, i) => v > px[i]), 'exposure up brightens');
});

test('SCENES: a cut is found where the histogram jumps, a fade is one cut, and the time is the first sample after it', () => {
  const frame = (r, g, b, n = 64) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4); return a; };
  const red = C.histogram(frame(250, 10, 10));
  const blue = C.histogram(frame(10, 10, 250));
  near(red.reduce((s, v) => s + v, 0), 1, 1e-6);
  assert.equal(C.histDistance(red, red), 0);
  assert.equal(C.histDistance(red, blue), 1);
  const series = [red, red, red, blue, blue, blue, blue];
  assert.deepEqual(C.findCuts(series, 250), [750]);
  const mid = C.histogram(frame(130, 10, 130));
  assert.deepEqual(C.findCuts([red, red, mid, blue, blue], 250, 0.35), [500], 'a two-step fade counts once');
  assert.deepEqual(C.findCuts([red, red, red], 250), []);
});

test('QUIET: pauses over 600 ms under the threshold are found, trimmed at both ends, and the time saved is said', () => {
  const rate = 8000;
  const sec = (n, amp) => Float32Array.from({ length: n * rate }, (_, i) => amp * Math.sin(i / 3));
  const sound = new Float32Array(rate * 6);
  sound.set(sec(2, 0.5), 0);
  sound.set(sec(1, 0.001), rate * 2);
  sound.set(sec(2, 0.5), rate * 3);
  sound.set(sec(0.4, 0.001), rate * 5);
  sound.set(sec(0.6, 0.5), rate * 5.4);
  const series = Q.rmsSeries([sound], rate, 50);
  assert.equal(series.length, 120);
  const pauses = Q.findPauses(series, 50, 0.02, 600, 150);
  assert.equal(pauses.length, 1, 'the 0.4 s gap is under 600 ms');
  assert.deepEqual(pauses[0], { from: 2150, to: 2850 });
  assert.equal(Q.timeSaved(pauses), 700);
});

test('subtitles: .srt and .vtt written and read back; pieces of at most 25 s; the words laid across their stretch', () => {
  const cues = [{ start: 1000, end: 2500, text: 'Hello there', pos: 'bottom' }, { start: 3_661_005, end: 3_662_000, text: 'Two\nlines', pos: 'top' }];
  const srt = S.toSrt(cues);
  assert.match(srt, /^1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n01:01:01,005 --> 01:01:02,000\nTwo\nlines\n$/);
  assert.deepEqual(S.parseCues(srt).map((c) => [c.start, c.end, c.text]), cues.map((c) => [c.start, c.end, c.text]));
  const vtt = S.toVtt(cues);
  assert.match(vtt, /^WEBVTT\n\n00:00:01\.000 --> 00:00:02\.500\nHello there/);
  assert.deepEqual(S.parseCues(vtt).map((c) => [c.start, c.end, c.text, c.pos]), cues.map((c) => [c.start, c.end, c.text, c.pos]));
  assert.deepEqual(S.pieces(60_000), [[0, 25_000], [25_000, 50_000], [50_000, 60_000]]);
  assert.deepEqual(S.pieces(10_000), [[0, 10_000]]);
  const laid = S.cuesFromWords('one two three four five six seven eight nine ten', 0, 5000, 5);
  assert.equal(laid.length, 2);
  assert.equal(laid[0].start, 0);
  assert.equal(laid[1].end, 5000);
  assert.equal(laid[0].end, laid[1].start);
  assert.equal(S.cueAt(cues, 1500).text, 'Hello there');
  assert.equal(S.cueAt(cues, 2600), undefined);
});

test('the mp4 muxer: box sizes add up, stts and stsz are right, the avcC is passed through byte for byte, durations are scaled', () => {
  const avcC = Uint8Array.from([1, 100, 0, 40, 255, 225, 0, 4, 103, 100, 0, 40, 1, 0, 2, 104, 235]);
  const frames = [new Uint8Array(500).fill(1), new Uint8Array(300).fill(2)];
  const aac = [new Uint8Array(120).fill(3), new Uint8Array(100).fill(4), new Uint8Array(90).fill(5)];
  const out = P.muxMp4(
    { width: 1920, height: 1080, avcC, samples: frames.map((data, i) => ({ data, dur: 33_333, key: i === 0 })) },
    { rate: 48_000, channels: 2, config: Uint8Array.from([0x11, 0x90]), samples: aac.map((data) => ({ data, dur: 1024 })) },
  );
  const bytes = new Uint8Array(out.size);
  let at = 0;
  for (const p of out.parts) { bytes.set(p, at); at += p.length; }
  assert.equal(at, out.size);
  const top = P.walkBoxes(bytes);
  assert.deepEqual(top.map((b) => b.type), ['ftyp', 'mdat', 'moov']);
  assert.equal(top.reduce((n, b) => n + b.size, 0), bytes.length, 'the boxes add up to the file');
  const d = P.describeMp4(bytes);
  assert.deepEqual(d.tracks.map((t) => [t.kind, t.entry, t.samples]), [['vide', 'avc1', 2], ['soun', 'mp4a', 3]]);
  assert.equal(d.tracks[0].scale, 90_000);
  assert.equal(d.tracks[0].duration, Math.round(33_333 * 90_000 / 1e6) * 2, 'the video duration is its two frames in 90 kHz ticks');
  assert.equal(d.tracks[1].duration, 3072);
  assert.equal(d.tracks[1].scale, 48_000);
  assert.equal(d.movieDuration, Math.max(Math.round(d.tracks[0].duration / 90), Math.round(3072 / 48)), 'the movie header is in milliseconds');
  // the avcC bytes are inside the file exactly
  const hex = (u) => Buffer.from(u).toString('hex');
  assert.ok(hex(bytes).includes(`61766343${hex(avcC)}`), 'avcC passed through byte-equal');
  // the sample sizes and offsets: the first video sample sits where stco says
  const text = Buffer.from(bytes);
  const stco = text.indexOf('stco');
  const firstOffset = text.readUInt32BE(stco + 12);
  assert.equal(bytes[firstOffset], 1, 'the first chunk starts at the video sample');
  const stsz = text.indexOf('stsz');
  assert.equal(text.readUInt32BE(stsz + 8), 0, 'sizes are per sample');
  assert.equal(text.readUInt32BE(stsz + 12), 2);
  assert.equal(text.readUInt32BE(stsz + 16), 500);
  assert.equal(text.readUInt32BE(stsz + 20), 300);
  const stts = text.indexOf('stts');
  assert.equal(text.readUInt32BE(stts + 8), 1, 'one run for equal durations');
  assert.equal(text.readUInt32BE(stts + 12), 2);
  assert.equal(text.readUInt32BE(stts + 16), Math.round(33_333 * 90_000 / 1e6));
  const stss = text.indexOf('stss');
  assert.equal(text.readUInt32BE(stss + 8), 1, 'only the first frame is a sync sample');
  assert.equal(text.readUInt32BE(stss + 12), 1);
  // video only
  const v = P.muxMp4({ width: 64, height: 64, avcC, samples: [{ data: frames[0], dur: 40_000, key: true }] }, null);
  const vb = new Uint8Array(v.size);
  let q = 0; for (const p of v.parts) { vb.set(p, q); q += p.length; }
  assert.equal(P.describeMp4(vb).tracks.length, 1);
});

test('the store: room() says what fits and what would be let go, oldest first, in words', () => {
  const MB = 1_000_000;
  const kept = [{ id: 'a', name: 'Holiday', at: 1, bytes: 300 * MB }, { id: 'b', name: 'Birthday', at: 2, bytes: 250 * MB }];
  const fits = R.room(kept, 20 * MB, 600 * MB);
  assert.equal(fits.fits, true);
  assert.match(fits.words, /Room is running out: about 30 MB left/);
  const roomy = R.room([], 20 * MB, 600 * MB);
  assert.match(roomy.words, /There is room: about 580 MB left/);
  const full = R.room(kept, 100 * MB, 600 * MB);
  assert.equal(full.fits, true);
  assert.deepEqual(full.letGo.map((x) => x.name), ['Holiday']);
  assert.match(full.words, /let go of “Holiday”, the oldest/);
  const two = R.room(kept, 400 * MB, 600 * MB);
  assert.deepEqual(two.letGo.map((x) => x.name), ['Holiday', 'Birthday']);
  assert.equal(R.room(kept, 700 * MB, 600 * MB).fits, false);
  assert.match(R.room(kept, 700 * MB, 600 * MB).words, /alone is bigger than I can keep/);
  const mine = R.room(kept, 100 * MB, 600 * MB, 'a');
  assert.deepEqual(mine.letGo.map((x) => x.name), ['Birthday'], 'the project being edited is never the one let go');
  const none = R.room(kept, 400 * MB, 600 * MB, 'a');
  assert.equal(none.fits, false, 'and where that is not enough it says so');
  assert.match(none.words, /even with every other video let go/);
});

test('the history is sixty deep, undoes and redoes, and a new step clears what was undone', () => {
  let p = M.newProject('h');
  const h = new M.History(p);
  for (let i = 0; i < 70; i++) p = h.push({ ...p, name: `n${i}` });
  assert.equal(h.depth, 60);
  for (let i = 0; i < 60; i++) assert.ok(h.undo());
  assert.equal(h.undo(), null);
  assert.equal(h.now.name, 'n9', 'the oldest ten are gone');
  assert.equal(h.redo().name, 'n10');
  h.push({ ...h.now, name: 'new' });
  assert.equal(h.canRedo, false);
});

test('words: clocks and lengths as a person reads them', () => {
  assert.equal(M.clock(65_300, true), '1:05.3');
  assert.equal(M.clock(12_000), '0:12');
  assert.equal(M.lengthWords(65_000), '1 min 05 s');
  assert.equal(M.lengthWords(12_340), '12.3 s');
  assert.deepEqual(M.shape({ aspect: '9:16', w: 1280, h: 720 }, 1920), { w: 1080, h: 1920 });
  assert.deepEqual(M.shape({ aspect: 'project', w: 1280, h: 720 }, 1920), { w: 1920, h: 1080 });
  assert.deepEqual(M.shape({ aspect: '1:1', w: 1280, h: 720 }, 1080), { w: 1080, h: 1080 });
});

test('SPLIT AT THE CUTS and CUT THE PAUSES: the timeline keeps its length when split, and loses exactly what is cut', () => {
  const p = project(10_000);
  const s = E.splitMany(p, [2000, 5000, 5020, 9000]);
  assert.equal(s.made, 3, 'a cut within 100 ms of another is refused');
  assert.equal(M.duration(s.p), 10_000);
  const c = E.rippleDelete(p, 2000, 3000);
  assert.equal(M.duration(c), 9000);
  assert.deepEqual(c.main.map((x) => [x.in, x.out]), [[0, 2000], [3000, 10_000]]);
  p.music.push({ id: 'm', src: 'x', start: 0, in: 0, len: 10_000, gain: 1, fadeIn: 0, fadeOut: 0 });
  p.subs.push({ start: 4000, end: 5000, text: 'hello', pos: 'bottom' }, { start: 2200, end: 2800, text: 'gone', pos: 'bottom' });
  const d = E.cutRanges(p, [{ from: 2000, to: 3000 }, { from: 6000, to: 6500 }]);
  assert.equal(M.duration(d), 8500, 'two pauses, 1.5 s saved');
  assert.deepEqual(d.subs.map((x) => [x.text, x.start]), [['hello', 3000]], 'a cue after the cut moves up, a cue inside it goes');
  assert.equal(d.music[0].len, 8500);
  const sp = M.setSpeed(project(10_000), 'nope', 2);
  assert.equal(sp, null);
});

test('a frame is planned from the timeline: the clips showing, the source time of each, and the transition at its midpoint', () => {
  let p = project(4000, 4000);
  p = M.setTransition(p, 0, 'crossfade', 1000);
  const mid = K.planFrame(p, 3500);
  assert.equal(mid.layers.length, 2);
  assert.deepEqual(mid.layers.map((l) => l.role), ['main', 'mainB']);
  near(mid.tr.p, 0.5, 1e-9);
  assert.equal(mid.layers[0].srcMs, 3500);
  assert.equal(mid.layers[1].srcMs, 500);
  assert.equal(K.planFrame(p, 1000).tr, null);
  const q = project(10_000);
  assert.equal(K.planFrame(q, 5000).layers[0].srcMs, 5000);
  const two = M.setSpeed(q, q.main[0].id, 2);
  assert.equal(K.planFrame(two, 2000).layers[0].srcMs, 4000);
  const o = E.addTitle(q, 1000, 2000, 'Hi');
  assert.equal(o.p.overlays[0].track, 0);
  const t = K.titleAnim(o.p.overlays[0], 1150);
  near(t.alpha, 0.5, 1e-9);
  assert.equal(K.titleAnim(o.p.overlays[0], 2000).alpha, 1);
});

test('the mp4 reader finds every sample of a flat file (the muxer\'s own) and of a fragmented one (a recorder\'s)', () => {
  const avcC = Uint8Array.from([1, 100, 0, 40, 255, 225, 0, 4, 103, 100, 0, 40, 1, 0, 2, 104, 235]);
  const frames = [new Uint8Array(500).fill(1), new Uint8Array(300).fill(2), new Uint8Array(200).fill(3)];
  const out = P.muxMp4({ width: 1920, height: 1080, avcC, samples: frames.map((data, i) => ({ data, dur: 33_333, key: i === 0 })) }, null);
  const flat = new Uint8Array(out.size);
  let at = 0; for (const p of out.parts) { flat.set(p, at); at += p.length; }
  const t = Dx.demuxMp4(flat);
  assert.equal(t.codec, 'avc1.640028');
  assert.equal([t.w, t.h].join('x'), '1920x1080');
  assert.equal(t.timescale, 90_000);
  assert.deepEqual(t.samples.map((x) => x.size), [500, 300, 200]);
  assert.deepEqual(t.samples.map((x) => x.key), [true, false, false]);
  assert.deepEqual(t.samples.map((x) => flat[x.offset]), [1, 2, 3], 'each sample sits where the reader says');
  assert.deepEqual(t.samples.map((x) => x.dts), [0, 3000, 6000]);
  assert.deepEqual(Array.from(t.description), Array.from(avcC));
  // a fragmented file: moov (with an avc1 entry and trex defaults) then a moof whose trun lists sizes, the tfhd giving the duration
  const u32 = (n) => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const cat = (...a) => Uint8Array.from(a.flatMap((x) => Array.from(x)));
  const asc = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
  const box = (ty, ...b) => { const body = cat(...b); return cat(u32(8 + body.length), asc(ty), body); };
  const full = (ty, vf, ...b) => box(ty, u32(vf), ...b);
  const entry = box('avc1', new Uint8Array(6), Uint8Array.from([0, 1]), new Uint8Array(16), Uint8Array.from([5, 0, 2, 208]), new Uint8Array(50), box('avcC', avcC));
  const stbl = box('stbl', full('stsd', 0, u32(1), entry), full('stts', 0, u32(0)), full('stsc', 0, u32(0)), full('stsz', 0, u32(0), u32(0)), full('stco', 0, u32(0)));
  const trak = box('trak', full('tkhd', 0, u32(0), u32(0), u32(1), new Uint8Array(68)), box('mdia', full('mdhd', 0, u32(0), u32(0), u32(1000), u32(0), new Uint8Array(4)), full('hdlr', 0, u32(0), asc('vide'), new Uint8Array(12), Uint8Array.from([0])), box('minf', stbl)));
  const moov = box('moov', full('mvhd', 0, new Uint8Array(96)), trak, box('mvex', full('trex', 0, u32(1), u32(1), u32(0), u32(0), u32(0))));
  const d1 = new Uint8Array(40).fill(7);
  const d2 = new Uint8Array(30).fill(8);
  const trunBody = (off) => full('trun', 0x000201, u32(2), u32(off), u32(40), u32(30));
  const tfhd = full('tfhd', 0x20008, u32(1), u32(33));
  const tfdt = full('tfdt', 0, u32(1000));
  const mk = (off) => box('moof', full('mfhd', 0, u32(1)), box('traf', tfhd, tfdt, trunBody(off)));
  const moofLen = mk(0).length;
  const frag = cat(moov, mk(moofLen + 8), box('mdat', d1, d2));
  const f = Dx.demuxMp4(frag);
  assert.deepEqual(f.samples.map((x) => x.size), [40, 30]);
  assert.deepEqual(f.samples.map((x) => frag[x.offset]), [7, 8]);
  assert.deepEqual(f.samples.map((x) => x.dts), [1000, 1033]);
  assert.equal(f.samples[0].key, true, 'with no flags given, only the first sample is trusted as a key');
  assert.equal(f.samples[1].key, false);
  assert.equal(Dx.demuxMp4(Uint8Array.from([0, 0, 0, 8, 102, 114, 101, 101])), null, 'not an mp4 with a video track');
});

test('the frame-by-frame file is exactly as long as the timeline: the last picture and the sound trimmed or padded to it', async () => {
  const { exactLength } = await load('math');
  // 54,901 ms at 30 frames a second: 1,647 whole frames would be 54,900 ms; the last picture stretched by 1 ms
  const v = Array.from({ length: 1647 }, () => ({ dur: Math.round(1e6 / 30) }));
  const a = Array.from({ length: Math.ceil((54.901 * 48000 + 2112) / 1024) }, () => ({ dur: 1024 }));
  exactLength(v, a, 54901);
  assert.equal(v.reduce((n, s) => n + s.dur, 0), 54_901_000, 'the pictures end at the timeline’s end, to the microsecond');
  assert.equal(a.reduce((n, s) => n + s.dur, 0), Math.round(54.901 * 48000), 'the sound ends at the timeline’s end, to the sample');
  assert.ok(a.every((s) => s.dur >= 1 && s.dur <= 1024), 'no packet of sound is longer than it was');
  // too short a sound is padded on its last packet
  const short = [{ dur: 1024 }, { dur: 1024 }];
  exactLength([], short, 50);
  assert.equal(short.reduce((n, s) => n + s.dur, 0), 2400);
  // a picture never gets a duration of nothing
  const one = [{ dur: 99999 }, { dur: 99999 }];
  exactLength(one, [], 10);
  assert.ok(one[1].dur >= 1);
});

test('the grade over time: keys followed in a straight line, the nearest key held outside them, and a split carries it on', async () => {
  const Mo = await load('model');
  const g = (exposure, temp, curve = [[0, 0], [1, 1]]) => ({ ...Mo.flatGrade(), exposure, temp, curve });
  const c = { grade: g(0, 0), gradeKeys: [{ t: 1000, g: g(0, -0.5) }, { t: 3000, g: g(1, 0.5) }] };
  assert.equal(Mo.gradeAt({ grade: g(0.3, 0) }, 500).exposure, 0.3, 'no keys: the one grade holds');
  assert.equal(Mo.gradeAt(c, 0).temp, -0.5, 'before the first key, the first holds');
  assert.equal(Mo.gradeAt(c, 9000).exposure, 1, 'after the last, the last holds');
  const mid = Mo.gradeAt(c, 2000);
  assert.ok(Math.abs(mid.exposure - 0.5) < 1e-9 && Math.abs(mid.temp) < 1e-9, 'halfway between the keys, halfway between their numbers');
  // a key set within 40 ms is the same key; keys stay in time order
  const clip = { ...c, gradeKeys: structuredClone(c.gradeKeys) };
  Mo.upsertGradeKey(clip, 3020, g(2, 0));
  Mo.upsertGradeKey(clip, 0, g(0, 0));
  assert.deepEqual(clip.gradeKeys.map((k) => k.t), [0, 1000, 3000]);
  assert.equal(clip.gradeKeys[2].g.exposure, 2);
  // a split at 2 s: the second half starts with the grade at the cut and keeps the rest of the keys, shifted
  const source = { id: 's1', name: 'a', kind: 'video', size: 1, dur: 6000, w: 640, h: 360, fps: 30, hasAudio: false };
  const p0 = Mo.newProject();
  const p = { ...p0, sources: { s1: source }, main: [{ ...Mo.newClip(source), gradeKeys: structuredClone(c.gradeKeys) }] };
  const q = Mo.splitAt(p, 2000);
  assert.ok(q && q.main.length === 2);
  assert.deepEqual(q.main[1].gradeKeys.map((k) => k.t), [0, 1000]);
  assert.ok(Math.abs(q.main[1].gradeKeys[0].g.exposure - 0.5) < 1e-9, 'the second half starts where the grade was at the cut');
});

test('a photo film: each photo held for whole beats (at least 1.8 s), a slow zoom each, the song from its first beat', async () => {
  const Mo = await load('model');
  const Ed = await load('edit');
  const img = (id) => ({ id, name: `${id}.jpg`, kind: 'image', size: 1, dur: 600_000, w: 640, h: 360, fps: 30, hasAudio: false });
  const song = { id: 'song', name: 'song.wav', kind: 'audio', size: 1, dur: 30_000, w: 0, h: 0, fps: 0, hasAudio: true };
  assert.equal(Mo.newClip(img('a')).out, 3000, 'a photo lies in as a 3 s still clip');
  const q = Ed.photoFilm(Mo.newProject(), [img('a'), img('b'), img('c')], song, { period: 500, first: 120 });
  assert.deepEqual(q.main.map((c) => c.out - c.in), [2000, 2000, 2000], '120 a minute: four beats, 2 s a photo');
  assert.deepEqual(q.main.map((c) => c.tr.keys.scale.map((k) => k.v)), [[1, 1.1], [1.1, 1], [1, 1.1]], 'in, out, in');
  assert.equal(q.music.length, 1);
  assert.equal(q.music[0].in, 120, 'the song from its first beat, so each cut lands on one');
  assert.equal(q.music[0].len, 6000);
  // a slow song (60 a minute): two beats; no beat found: two seconds
  assert.deepEqual(Ed.photoFilm(Mo.newProject(), [img('a')], song, { period: 1000, first: 0 }).main.map((c) => c.out), [2000]);
  assert.deepEqual(Ed.photoFilm(Mo.newProject(), [img('a'), img('b')], null, null).main.map((c) => c.out), [2000, 2000]);
  // a fast one (150 a minute, 400 ms): five beats, still on the grid
  assert.deepEqual(Ed.photoFilm(Mo.newProject(), [img('a'), img('b')], song, { period: 400, first: 0 }).main.map((c) => c.out), [2000, 2000]);
});
