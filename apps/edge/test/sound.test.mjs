// SOUND CHECK's pure ears (apps/web/src/sound/analyse.ts): the FFT against a known answer, levels
// and crest factor, clipping of a sine (flat tops, the microphone overloaded), THD of a clipped
// sine against the textbook value, hum at 50 Hz under quiet noise, boom, and the verdicts; the
// test tone (steps + sweep) through a perfect speaker, one that clips above 60%, and a recording
// with no tone in it at all. Every signal is made here; no microphone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const A = await import('./.build/sound/analyse.mjs');
const SR = 48000;
const sine = (f, a, sec, clip = Infinity, sr = SR) => Float32Array.from({ length: Math.round(sr * sec) }, (_, i) => Math.max(-clip, Math.min(clip, a * Math.sin((2 * Math.PI * f * i) / sr))));
/** A repeatable noise source (Park–Miller). */
const rng = (seed = 7) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
};
/** Pink-ish noise (Paul Kellet's filter): music-like spectrum, crest factor ~12 dB. */
function pink(sec, gain = 0.1, seed = 3) {
  const r = rng(seed);
  const out = new Float32Array(Math.round(SR * sec));
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * gain;
  }
  return out;
}

test('the FFT matches a direct DFT, and puts a sine in its bin', () => {
  const n = 64;
  const r = rng(11);
  const x = Array.from({ length: n }, () => r());
  const re = Float64Array.from(x);
  const im = new Float64Array(n);
  A.fft(re, im);
  for (const k of [0, 1, 5, 17, 32, 63]) {
    let sr = 0, si = 0;
    for (let t = 0; t < n; t++) {
      sr += x[t] * Math.cos((-2 * Math.PI * k * t) / n);
      si += x[t] * Math.sin((-2 * Math.PI * k * t) / n);
    }
    assert.ok(Math.abs(re[k] - sr) < 1e-9 && Math.abs(im[k] - si) < 1e-9, `bin ${k}`);
  }
  // a cosine with 8 cycles in 1024 samples: all its energy in bins 8 and 1024-8
  const N = 1024;
  const cr = Float64Array.from({ length: N }, (_, i) => Math.cos((2 * Math.PI * 8 * i) / N));
  const ci = new Float64Array(N);
  A.fft(cr, ci);
  assert.ok(Math.abs(cr[8] - N / 2) < 1e-6 && Math.abs(cr[N - 8] - N / 2) < 1e-6);
  assert.ok(Math.abs(cr[9]) < 1e-6 && Math.abs(ci[8]) < 1e-6);
  assert.throws(() => A.fft(new Float64Array(12), new Float64Array(12)), /power of two/);
});

test('levels: a sine has a 3 dB crest factor, its spectrum peak sits on its frequency at 0 dB for full scale', () => {
  const lv = A.levels(sine(1000, 0.5, 1));
  assert.ok(Math.abs(lv.peakDb - -6.02) < 0.05, `peak ${lv.peakDb}`);
  assert.ok(Math.abs(lv.rmsDb - -9.03) < 0.05, `rms ${lv.rmsDb}`);
  assert.ok(Math.abs(lv.crestDb - 3.01) < 0.05, `crest ${lv.crestDb}`);
  const sp = A.spectrum(sine(1000, 1, 1), SR, 16384);
  const p = A.peakNear(sp, 900, 1100);
  assert.ok(Math.abs(p.freq - 1000) < 0.5, `peak at ${p.freq} Hz`);
  const bin = sp.power[Math.round(p.freq / sp.binHz)];
  assert.ok(A.db(bin) > -1.5 && A.db(bin) < 0.5, `full-scale sine reads ${A.db(bin)} dB in its bin`);
  assert.ok(A.levels(pink(3)).crestDb > 9, 'noise has a music-like crest factor');
});

test('THD: a clean sine has none; a sine clipped at half its height has the textbook ~20%', () => {
  const clean = A.thd(A.spectrum(sine(1000, 0.8, 1), SR, 16384), 1000);
  assert.ok(clean.thd < 0.001, `clean ${clean.thd}`);
  // a sine of amplitude 2 hard-clipped at ±1: odd harmonics, THD ≈ 21% (Fourier series of the clipped wave)
  const clipped = A.thd(A.spectrum(sine(1000, 2, 1, 1), SR, 16384), 1000);
  assert.ok(clipped.thd > 0.17 && clipped.thd < 0.26, `clipped ${clipped.thd}`);
  assert.ok(clipped.harmonics[1] > clipped.harmonics[0] * 50, 'the 3rd harmonic dominates the 2nd (symmetric clipping)');
});

test('LISTEN: a clean tone is clean, a clipped one says clipping and to turn it down, an overloaded microphone says so', () => {
  const clean = A.analyseRecording(sine(440, 0.5, 5), SR);
  assert.equal(clean.kind, 'clean');
  assert.match(clean.verdict, /^clean/);
  assert.ok(clean.tone && Math.abs(clean.tone.freq - 440) < 1);
  const clipped = A.analyseRecording(sine(440, 2, 5, 0.9), SR);
  assert.equal(clipped.kind, 'clipping');
  assert.match(clipped.verdict, /^clipping: turn the volume down a couple of notches$/);
  assert.ok(clipped.clipping.flatShare > 0.6, `flat tops ${clipped.clipping.flatShare}`);
  assert.ok(clipped.levels.crestDb < 2);
  const overload = A.analyseRecording(sine(440, 3, 5, 1), SR);
  assert.equal(overload.kind, 'overload');
  assert.match(overload.verdict, /microphone was overloaded/);
  assert.ok(overload.clipping.fullScaleRuns > 100);
  const quiet = A.analyseRecording(sine(440, 0.0005, 3), SR);
  assert.equal(quiet.kind, 'quiet');
  assert.match(quiet.verdict, /too quiet/);
});

test('LISTEN: music-like noise is clean; mains hum at 50 Hz is found and blamed on the cable or earth; a 100 Hz boom is found', () => {
  const music = A.analyseRecording(pink(5), SR);
  assert.equal(music.kind, 'clean', music.findings.map((f) => f.text).join('; '));
  assert.equal(music.tone, null);
  assert.ok(music.flatness > 0.2, `flatness ${music.flatness}`);
  const quietRoom = pink(5, 0.01);
  const hummy = quietRoom.map((v, i) => v + 0.02 * Math.sin((2 * Math.PI * 50 * i) / SR));
  const h = A.analyseRecording(hummy, SR);
  assert.equal(h.hum?.freq, 50, JSON.stringify(h.hum));
  assert.equal(h.kind, 'hum');
  assert.match(h.verdict, /^hum at 50 Hz: check the cable and the earth/);
  // a room boom: noise with a resonance near 100 Hz (a narrow band boosted ~15 dB)
  const base = pink(5, 0.05, 9);
  const r = rng(5);
  let y1 = 0, y2 = 0;
  const w0 = (2 * Math.PI * 100) / SR, q = 8, alpha = Math.sin(w0) / (2 * q);
  const boom = base.map((v) => {
    // a band-pass at 100 Hz added back in: the room ringing
    const y = (alpha * v * 6) / (1 + alpha) + ((2 * Math.cos(w0)) / (1 + alpha)) * y1 - ((1 - alpha) / (1 + alpha)) * y2;
    y2 = y1;
    y1 = y;
    return v + y + r() * 1e-5;
  });
  const b = A.analyseRecording(boom, SR);
  const f = b.findings.find((x) => x.kind === 'boomy');
  assert.ok(f, b.findings.map((x) => x.text).join('; '));
  assert.match(f.text, /Boomy bass at ~(80|100|125) Hz: turn the bass down/);
});

test('the words for Ghosty carry the verdict and the numbers', () => {
  const r = A.analyseRecording(sine(440, 2, 2, 0.9), SR);
  const t = A.describeListen(r);
  assert.match(t, /^SOUND CHECK \(measured by the phone's microphone, 2\.0 s\): verdict "clipping/);
  assert.match(t, /peak -0\.9 dBFS/);
  assert.match(t, /third-octave levels/);
  assert.equal(A.hz(1000 * 2 ** (-3 / 3)), '500 Hz');
  assert.equal(A.hz(1000 * 2 ** (5 / 3)), '3.15 kHz');
  assert.equal(A.hz(440), '440 Hz');
});

/** The test tone as a microphone would hear it: 0.4 s of room noise first, the speaker clipping at `clip`, an optional low cut. */
function heard(clip = Infinity, gain = 0.8, sr = SR) {
  const plan = A.renderPlan(A.TONE_PLAN, sr);
  const lead = Math.round(0.4 * sr);
  const out = new Float32Array(plan.length + lead + sr);
  const r = rng(21);
  for (let i = 0; i < out.length; i++) out[i] = 0.0005 * r();
  for (let i = 0; i < plan.length; i++) out[i + lead] += Math.max(-clip, Math.min(clip, gain * plan[i]));
  return out;
}

test('TEST TONE: a perfect speaker is clean to full volume with a flat response', () => {
  const r = A.analyseTestTone(heard(), SR);
  assert.equal(r.heard, true);
  assert.ok(Math.abs(r.onsetSec - 0.4) < 0.012, `onset ${r.onsetSec}`);
  assert.equal(r.steps.length, 10);
  assert.ok(r.steps.every((s) => s.heard && s.thd < 0.01), r.steps.map((s) => s.thd).join());
  assert.equal(r.distortsAt, null);
  assert.equal(r.kind, 'clean');
  assert.match(r.verdict, /^clean all the way to full volume/);
  assert.ok(r.response.length >= 20);
  assert.ok(r.response.every((b) => Math.abs(b.db) < 1), r.response.map((b) => `${b.f.toFixed(0)}:${b.db.toFixed(2)}`).join(' '));
  assert.equal(r.bassLimit, null);
  // the levels rise 20·log10 of the step ratio
  const [a, b] = [r.steps[0], r.steps[9]];
  assert.ok(Math.abs(b.db - a.db - 20) < 0.5);
});

test('TEST TONE: a speaker clipping above 60% "distorts above ~60% volume", limits, and says turn it down', () => {
  const r = A.analyseTestTone(heard(0.45), SR);
  assert.equal(r.kind, 'distorts');
  assert.equal(r.cleanUpTo, 0.6);
  assert.equal(r.distortsAt, 0.7);
  assert.ok(r.steps.slice(0, 5).every((s) => s.thd < 0.01));
  assert.ok(r.steps[5].thd < 0.03, 'just over the edge at 60%: a trace, under the limit');
  assert.ok(r.steps[9].thd > 0.15, `thd at full ${r.steps[9].thd}`);
  assert.match(r.verdict, /^distorts above ~60% volume: turn it down a couple of notches$/);
  assert.equal(r.limiting, true);
  const words = A.describeTone(r);
  assert.match(words, /distortion by level: 10% 0\.\d%/);
  assert.match(words, /verdict "distorts above ~60% volume/);
});

test('TEST TONE: a small speaker with no deep bass reports where the bass fades; a recording with no tone says it heard nothing', () => {
  // a 2nd-order high-pass at 200 Hz on the speaker
  const x = heard();
  const w0 = (2 * Math.PI * 200) / SR, alpha = Math.sin(w0) / Math.SQRT2, c = Math.cos(w0), a0 = 1 + alpha;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const y = x.map((v) => {
    const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o;
    return o;
  });
  const r = A.analyseTestTone(y, SR);
  assert.equal(r.heard, true);
  assert.ok(r.bassLimit >= 63 && r.bassLimit <= 160, `bass limit ${r.bassLimit}`);
  assert.ok(r.findings.some((f) => /Bass fades below/.test(f.text)));
  const none = A.analyseTestTone(sine(440, 0.5, 8), SR);
  assert.equal(none.heard, false);
  assert.equal(none.kind, 'unheard');
  assert.match(none.verdict, /^didn't hear the test tone/);
  assert.match(A.describeTone(none), /didn't hear/);
});

test('TEST TONE: the plan lasts under 10 s and the sweep is exponential end to end', () => {
  assert.ok(A.planSeconds() < 10);
  assert.equal(Math.round(A.sweepFreq(A.TONE_PLAN, 0)), 40);
  assert.equal(Math.round(A.sweepFreq(A.TONE_PLAN, A.TONE_PLAN.sweep.sec)), 16000);
  // at 44.1 kHz too (iPhones record at 48 kHz, some Macs and Bluetooth paths at 44.1)
  const r = A.analyseTestTone(heard(Infinity, 0.8, 44100), 44100);
  assert.equal(r.kind, 'clean');
});
