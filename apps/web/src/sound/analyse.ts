/**
 * SOUND CHECK's ears: what a recording says about the sound, worked out on the phone with no
 * libraries — levels, clipping, the spectrum (our own radix-2 FFT), hum, boom and harshness, and
 * for the test tone the distortion at each level and the frequency response. Pure functions on
 * plain sample arrays (no DOM, no WebAudio), so the same code is unit-tested in Node
 * (apps/edge/test/sound.test.mjs) and runs in the Lens (features/lens/sound.ts).
 *
 * Levels are dBFS: 0 dB is the loudest a sample can be (±1). A sine at full scale reads 0 dB on
 * the peak meter and −3 dB on the RMS meter.
 */

/** In-place radix-2 FFT (the length must be a power of two). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || n & (n - 1)) throw new Error('fft: the length must be a power of two');
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    const wr = Math.cos(step);
    const wi = Math.sin(step);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

export const db = (power: number): number => 10 * Math.log10(Math.max(power, 1e-20));
const amp = (x: number): number => 20 * Math.log10(Math.max(x, 1e-10));

/** The largest power of two ≤ n (at least 2). */
export const pow2Below = (n: number): number => 2 ** Math.max(1, Math.floor(Math.log2(Math.max(2, n))));

// ---------------------------------------------------------------- levels and clipping

export interface Levels {
  peak: number;
  peakDb: number;
  rmsDb: number;
  /** Peak over RMS in dB: about 3 for a sine, 12–20 for lively music, under 8 for squashed or clipped sound. */
  crestDb: number;
}

export function levels(x: ArrayLike<number>): Levels {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, x.length));
  return { peak, peakDb: amp(peak), rmsDb: amp(rms), crestDb: peak > 0 && rms > 0 ? amp(peak / rms) : 0 };
}

export interface Clipping {
  /** Runs of 3+ samples stuck at the very top of the scale: the recording itself overloaded. */
  fullScaleRuns: number;
  /**
   * Of the samples above half the (robust) peak, the share within 3% of it. A sine has ~23%,
   * lively music a few %; flat-topped (clipped) sound piles up at the top: 35% and more.
   */
  flatShare: number;
  /** The level the tops sit at (the 99.9th percentile of |x|). */
  top: number;
}

export function clipping(x: ArrayLike<number>): Clipping {
  let fullScaleRuns = 0;
  let run = 0;
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    if (a > peak) peak = a;
    if (a >= 0.995) run++;
    else {
      if (run >= 3) fullScaleRuns++;
      run = 0;
    }
  }
  if (run >= 3) fullScaleRuns++;
  if (peak <= 0) return { fullScaleRuns, flatShare: 0, top: 0 };
  // The 99.9th percentile of |x| from a fine histogram (no sort of half a million numbers).
  const BINS = 4096;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < x.length; i++) hist[Math.min(BINS - 1, Math.floor((Math.abs(x[i]!) / peak) * BINS))]!++;
  let above = 0;
  let k = BINS - 1;
  const want = x.length * 0.001;
  for (; k > 0; k--) {
    above += hist[k]!;
    if (above >= want) break;
  }
  const top = ((k + 1) / BINS) * peak;
  let high = 0;
  let loud = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    if (a >= 0.5 * top) {
      loud++;
      if (a >= 0.97 * top) high++;
    }
  }
  return { fullScaleRuns, flatShare: loud ? high / loud : 0, top };
}

// ---------------------------------------------------------------- spectrum

export interface Spectrum {
  sampleRate: number;
  size: number;
  /** Hz per bin. */
  binHz: number;
  /** Power per bin (n/2 + 1 bins), scaled so a full-scale sine's peak bin reads about 0 dB. */
  power: Float64Array;
}

/**
 * The averaged power spectrum (Welch: Hann windows, half overlapping). A recording shorter than
 * one window is zero-padded into it.
 */
export function spectrum(x: ArrayLike<number>, sampleRate: number, size = 16384): Spectrum {
  const n = pow2Below(size);
  const win = new Float64Array(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    wsum += win[i]!;
  }
  const power = new Float64Array(n / 2 + 1);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const hop = n / 2;
  let count = 0;
  for (let start = 0; count === 0 || start + n <= x.length; start += hop) {
    for (let i = 0; i < n; i++) {
      const j = start + i;
      re[i] = j < x.length ? x[j]! * win[i]! : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= n / 2; k++) power[k] = power[k]! + re[k]! * re[k]! + im[k]! * im[k]!;
    count++;
    if (start + n >= x.length) break;
  }
  const norm = (wsum / 2) ** 2 * count;
  for (let k = 0; k < power.length; k++) power[k] = power[k]! / norm;
  return { sampleRate, size: n, binHz: sampleRate / n, power };
}

const binOf = (s: Spectrum, f: number) => Math.round(f / s.binHz);

/** Power in [lo, hi] Hz (summed bins). */
export function bandPower(s: Spectrum, lo: number, hi: number): number {
  const a = Math.max(1, Math.ceil(lo / s.binHz));
  const b = Math.min(s.power.length - 1, Math.floor(hi / s.binHz));
  let p = 0;
  for (let k = a; k <= b; k++) p += s.power[k]!;
  // A band narrower than a bin still reads the bin it falls in.
  if (b < a) p = s.power[Math.min(s.power.length - 1, Math.max(1, binOf(s, (lo + hi) / 2)))]!;
  return p;
}

/** The strongest bin in [lo, hi] Hz, refined by parabolic interpolation; its power summed over the window's main lobe. */
export function peakNear(s: Spectrum, lo: number, hi: number): { freq: number; power: number } {
  const a = Math.max(1, Math.floor(lo / s.binHz));
  const b = Math.min(s.power.length - 2, Math.ceil(hi / s.binHz));
  let best = a;
  for (let k = a; k <= b; k++) if (s.power[k]! > s.power[best]!) best = k;
  const l = Math.sqrt(s.power[best - 1] ?? 0);
  const c = Math.sqrt(s.power[best]!);
  const r = Math.sqrt(s.power[best + 1] ?? 0);
  const den = l - 2 * c + r;
  const off = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den)) : 0;
  let p = 0;
  for (let k = Math.max(1, best - 3); k <= Math.min(s.power.length - 1, best + 3); k++) p += s.power[k]!;
  return { freq: (best + off) * s.binHz, power: p };
}

/** Total harmonic distortion of a tone: √(Σ harmonics² / fundamental²), harmonics 2–10 below 95% of Nyquist. */
export function thd(s: Spectrum, f0: number): { thd: number; fundamental: number; harmonics: number[] } {
  const f = peakNear(s, f0 * 0.95, f0 * 1.05);
  const harmonics: number[] = [];
  let sum = 0;
  for (let k = 2; k <= 10; k++) {
    const fk = f.freq * k;
    if (fk > s.sampleRate * 0.475) break;
    const h = peakNear(s, fk * 0.99 - s.binHz, fk * 1.01 + s.binHz);
    harmonics.push(h.power / Math.max(f.power, 1e-30));
    sum += h.power;
  }
  return { thd: Math.sqrt(sum / Math.max(f.power, 1e-30)), fundamental: f.freq, harmonics };
}

/** Geometric over arithmetic mean of the power from 50 Hz up: near 1 for noise, near 0 for a pure tone. */
export function flatness(s: Spectrum, lo = 50, hi = 16000): number {
  const a = Math.max(1, Math.ceil(lo / s.binHz));
  const b = Math.min(s.power.length - 1, Math.floor(Math.min(hi, s.sampleRate / 2) / s.binHz));
  let logSum = 0;
  let sum = 0;
  let n = 0;
  for (let k = a; k <= b; k++) {
    const p = s.power[k]! + 1e-20;
    logSum += Math.log(p);
    sum += p;
    n++;
  }
  return n && sum > 0 ? Math.exp(logSum / n) / (sum / n) : 0;
}

/** The third-octave band centres (base-2), 25 Hz to 16 kHz. */
export const THIRD_OCTAVES: readonly number[] = Array.from({ length: 29 }, (_, i) => 1000 * 2 ** ((i - 16) / 3));

export interface Band {
  /** Centre frequency, Hz. */
  f: number;
  db: number;
}

/** Power in each third-octave band that fits below Nyquist, in dB. */
export function thirdOctaves(s: Spectrum): Band[] {
  const k = 2 ** (1 / 6);
  return THIRD_OCTAVES.filter((f) => f * k < s.sampleRate / 2).map((f) => ({ f, db: db(bandPower(s, f / k, f * k)) }));
}

/** The names the third-octave bands go by (25 Hz … 16 kHz), in THIRD_OCTAVES order. */
const NOMINAL = [25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000];

/** A frequency as people say it: "125 Hz", "3.15 kHz" (a band centre by its usual name). */
export function hz(f: number): string {
  const named = NOMINAL.find((n) => Math.abs(n - f) / n < 0.03) ?? (f >= 1000 ? Math.round(f / 10) * 10 : Math.round(f));
  return named >= 1000 ? `${+(named / 1000).toFixed(2)} kHz` : `${named} Hz`;
}

// ---------------------------------------------------------------- LISTEN: a recording judged

export type FindingKind = 'quiet' | 'overload' | 'clipping' | 'hum' | 'boomy' | 'harsh' | 'thin' | 'clean';

export interface Finding {
  kind: FindingKind;
  /** 0 fine, 1 worth a look, 2 fix it. */
  level: 0 | 1 | 2;
  /** One plain sentence: what it is and what to do. */
  text: string;
}

export interface ListenReport {
  seconds: number;
  sampleRate: number;
  levels: Levels;
  clipping: Clipping;
  flatness: number;
  /** A single tone dominates (a test tone, a whistle): its frequency and distortion. */
  tone: { freq: number; thd: number } | null;
  hum: { freq: number; prominenceDb: number } | null;
  bands: Band[];
  findings: Finding[];
  /** The headline, e.g. "clipping: turn the volume down a couple of notches". */
  verdict: string;
  kind: FindingKind;
}

/** How far a narrow peak at `f` stands above the bins around it (4–15 Hz away), in dB. */
function prominence(s: Spectrum, f: number): number {
  const peak = peakNear(s, f - 1.6, f + 1.6);
  const near: number[] = [];
  for (let k = Math.max(1, Math.floor((f - 15) / s.binHz)); k <= Math.ceil((f + 15) / s.binHz); k++) {
    const fk = k * s.binHz;
    if (Math.abs(fk - f) >= 4 && k < s.power.length) near.push(s.power[k]!);
  }
  if (!near.length) return 0;
  near.sort((a, b) => a - b);
  const median = near[near.length >> 1]!;
  const top = Math.max(...[-1, 0, 1].map((d) => s.power[binOf(s, peak.freq) + d] ?? 0));
  return db(top) - db(median);
}

const powerMean = (bands: Band[]): number => (bands.length ? db(bands.reduce((a, b) => a + 10 ** (b.db / 10), 0) / bands.length) : -200);

/** Judge a recording of whatever is playing (mono samples in −1…1). */
export function analyseRecording(x: ArrayLike<number>, sampleRate: number): ListenReport {
  const lv = levels(x);
  const cl = clipping(x);
  // ~1.5 Hz bins at 48 kHz when the recording is long enough (mains hum sits at 50/100 Hz exactly)
  const size = x.length >= 65536 ? 32768 : pow2Below(Math.max(2048, x.length));
  const sp = spectrum(x, sampleRate, size);
  const fl = flatness(sp);
  const bands = thirdOctaves(sp);
  const findings: Finding[] = [];

  // A single tone? (most of the power in one peak)
  const total = bandPower(sp, 40, Math.min(16000, sampleRate / 2));
  const strongest = peakNear(sp, 40, Math.min(12000, sampleRate / 2.2));
  let tone: ListenReport['tone'] = null;
  // (a steady 50/60 Hz or 100/120 Hz "tone" is mains hum, judged below, not a tone)
  const mains = [50, 60, 100, 120].some((f) => Math.abs(strongest.freq - f) < 2);
  if (total > 0 && strongest.power / total > 0.5 && !mains) {
    const t = thd(sp, strongest.freq);
    tone = { freq: t.fundamental, thd: t.thd };
  }

  const quiet = lv.rmsDb < -60;
  if (quiet) findings.push({ kind: 'quiet', level: 1, text: 'Too quiet to judge: play it louder or hold the phone closer to the speaker' });

  if (cl.fullScaleRuns >= 3) {
    findings.push({ kind: 'overload', level: 2, text: "The phone's microphone was overloaded (too loud for it): hold the phone further away or turn it down, then listen again" });
  } else if (!quiet && (cl.flatShare >= 0.35 || (tone && tone.thd >= 0.1))) {
    const how = tone && tone.thd >= 0.1 ? `${(tone.thd * 100).toFixed(0)}% distortion on the ${hz(tone.freq)} tone` : 'the waveform has flat tops';
    findings.push({ kind: 'clipping', level: 2, text: `Clipping (${how}): turn the volume down a couple of notches` });
  }

  // Mains hum: a narrow, steady peak at 50 Hz (UK mains) or 100 Hz (its rectified twin); 60/120 Hz elsewhere.
  let hum: ListenReport['hum'] = null;
  if (!quiet && !tone) {
    for (const f of [50, 100, 60, 120]) {
      if (f / sp.binHz < 8) continue;
      const p = prominence(sp, f);
      if (p >= 12 && (!hum || p > hum.prominenceDb)) hum = { freq: f, prominenceDb: p };
    }
    if (hum) findings.push({ kind: 'hum', level: 2, text: `Hum at ${hum.freq} Hz: check the cable and the earth — a loose or unscreened lead, or two mains plugs on different sockets (a ground loop)` });
  }

  // Tone balance (music or speech only — a test tone says nothing about it).
  if (!quiet && !tone && lv.rmsDb > -55) {
    const inRange = (lo: number, hi: number) => bands.filter((b) => b.f >= lo && b.f <= hi);
    const bass = powerMean(inRange(60, 200));
    const mid = powerMean(inRange(250, 2000));
    const treble = powerMean(inRange(2500, 8000));
    // one band standing proud of its neighbours: a room boom or a resonance
    const proud = (lo: number, hi: number) => {
      let best: { f: number; by: number } | null = null;
      for (let i = 2; i < bands.length - 2; i++) {
        const b = bands[i]!;
        if (b.f < lo || b.f > hi) continue;
        const around = (bands[i - 2]!.db + bands[i - 1]!.db + bands[i + 1]!.db + bands[i + 2]!.db) / 4;
        const by = b.db - around;
        if (by >= 6 && (!best || by > best.by)) best = { f: b.f, by };
      }
      return best;
    };
    const boom = proud(60, 315);
    if (boom || bass - mid > 14) {
      const at = boom?.f ?? inRange(60, 250).reduce((a, b) => (b.db > a.db ? b : a), { f: 100, db: -999 }).f;
      findings.push({ kind: 'boomy', level: 1, text: `Boomy bass at ~${hz(at)}: turn the bass down a little${boom ? ', or move the speaker away from the wall or corner' : ''}` });
    }
    const ring = proud(2000, 8000);
    if (ring || treble - mid > 3) {
      const at = ring?.f ?? inRange(2500, 8000).reduce((a, b) => (b.db > a.db ? b : a), { f: 4000, db: -999 }).f;
      findings.push({ kind: 'harsh', level: 1, text: `Harsh at ~${hz(at)}: turn the treble down a notch${ring ? ' (a sharp resonance there)' : ''}` });
    } else if (mid - treble > 30) {
      findings.push({ kind: 'thin', level: 1, text: 'Dull, little treble: turn the treble up a notch, and check nothing is in front of the speaker' });
    }
  }

  if (!findings.length) findings.push({ kind: 'clean', level: 0, text: lv.crestDb < 8 && !tone ? 'Clean — no clipping or hum, though the sound is quite squashed (little difference between loud and soft)' : 'Clean: no clipping, no hum, nothing standing out' });
  findings.sort((a, b) => b.level - a.level);
  const head = findings[0]!;
  return { seconds: x.length / sampleRate, sampleRate, levels: lv, clipping: cl, flatness: fl, tone, hum, bands, findings, verdict: verdictLine(head), kind: head.kind };
}

/** "Clipping (…): turn …" → "clipping: turn …" — the short headline. */
function verdictLine(f: Finding): string {
  const t = f.text.replace(/\s*\([^)]*\)/, '');
  return t.charAt(0).toLowerCase() + t.slice(1);
}

// ---------------------------------------------------------------- TEST TONE: a speaker measured

/** What TEST TONE plays: a 1 kHz tone stepping up in level, a pause, then a log sweep. */
export interface TonePlan {
  freq: number;
  /** Amplitudes (share of full scale) of the steps, quietest first. */
  levels: number[];
  stepSec: number;
  gapSec: number;
  sweep: { from: number; to: number; sec: number; level: number };
}

export const TONE_PLAN: TonePlan = {
  freq: 1000,
  levels: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  stepSec: 0.5,
  gapSec: 0.3,
  sweep: { from: 40, to: 16000, sec: 4, level: 0.5 },
};

/** How long the plan plays (without the lead-in). */
export const planSeconds = (p: TonePlan = TONE_PLAN): number => p.levels.length * p.stepSec + p.gapSec + p.sweep.sec;

/** The sweep's frequency at time t (s) — exponential, the same curve WebAudio's exponentialRamp draws. */
export const sweepFreq = (p: TonePlan, t: number): number => p.sweep.from * (p.sweep.to / p.sweep.from) ** (t / p.sweep.sec);

/**
 * The plan as samples (what a perfect speaker into a perfect microphone gives back): for tests,
 * and for the fake microphone in the browser spec.
 */
export function renderPlan(p: TonePlan, sampleRate: number): Float32Array {
  const n = Math.round(planSeconds(p) * sampleRate);
  const out = new Float32Array(n);
  const stepN = Math.round(p.stepSec * sampleRate);
  const ramp = Math.round(0.005 * sampleRate);
  const steps = p.levels.length * stepN;
  for (let i = 0; i < steps; i++) {
    // the level jumps between steps (WebAudio's setValueAtTime); the tone keeps its phase; soft edges at the very start and end
    const edge = Math.min(1, i / ramp, (steps - i) / ramp);
    out[i] = p.levels[Math.floor(i / stepN)]! * edge * Math.sin((2 * Math.PI * p.freq * i) / sampleRate);
  }
  const s0 = Math.round((p.levels.length * p.stepSec + p.gapSec) * sampleRate);
  const k = Math.log(p.sweep.to / p.sweep.from);
  for (let i = 0; s0 + i < n; i++) {
    const t = i / sampleRate;
    const phase = ((2 * Math.PI * p.sweep.from * p.sweep.sec) / k) * (Math.exp((k * t) / p.sweep.sec) - 1);
    out[s0 + i] = p.sweep.level * Math.sin(phase);
  }
  return out;
}

/** Goertzel power of one frequency over x[start, start+len) (normalised like `spectrum`, rectangular window). */
function goertzel(x: ArrayLike<number>, start: number, len: number, f: number, sampleRate: number): number {
  const w = (2 * Math.PI * f) / sampleRate;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < start + len && i < x.length; i++) {
    const s = x[i]! + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / (len / 2) ** 2;
}

/** Energy of x[a, b) between lo and hi Hz (rectangular window, zero-padded FFT), per sample. */
function segmentPower(x: ArrayLike<number>, a: number, b: number, sampleRate: number, lo: number, hi: number): number {
  const len = b - a;
  const n = 2 ** Math.ceil(Math.log2(len));
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < len; i++) re[i] = x[a + i]!;
  fft(re, im);
  const binHz = sampleRate / n;
  let e = 0;
  for (let k = Math.max(1, Math.floor(lo / binHz)); k <= Math.min(n / 2, Math.ceil(hi / binHz)); k++) e += re[k]! * re[k]! + im[k]! * im[k]!;
  return (2 * e) / (n * len);
}

/** Where the first step starts in the recording (seconds), or -1 when the tone was never heard. */
export function findOnset(x: ArrayLike<number>, sampleRate: number, p: TonePlan = TONE_PLAN, searchSec = 3): number {
  const block = Math.round(0.005 * sampleRate);
  const blocks = Math.min(Math.floor(x.length / block), Math.round(searchSec / 0.005));
  if (blocks < 4) return -1;
  const pw: number[] = [];
  for (let b = 0; b < blocks; b++) pw.push(goertzel(x, b * block, block * 2, p.freq, sampleRate));
  const sorted = [...pw].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.05)]!;
  // ≥ 15 dB over the quiet blocks before it, and above −70 dBFS (a speaker across a room is quiet, the phone's noise quieter)
  const need = Math.max(floor * 31.6, 1e-7);
  for (let b = 0; b < blocks - 3; b++) {
    if (pw[b]! >= need && pw[b + 1]! >= need && pw[b + 2]! >= need && pw[b + 3]! >= need) return (b * block) / sampleRate;
  }
  return -1;
}

export interface StepResult {
  /** The step's amplitude, share of full scale. */
  level: number;
  /** The tone's level in the recording, dBFS ('-Infinity' never: −200 when nothing). */
  db: number;
  thd: number;
  heard: boolean;
}

export interface ToneReport {
  heard: boolean;
  onsetSec: number;
  steps: StepResult[];
  /** The quietest step whose distortion passed the limit (share of full scale), or null. */
  distortsAt: number | null;
  /** The loudest step below it that was clean (share of full scale; 0 when even the first step distorted), or null. */
  cleanUpTo: number | null;
  /** The level rose less than it should between the last steps: the speaker is limiting. */
  limiting: boolean;
  /** Third-octave response relative to 1 kHz (dB). */
  response: Band[];
  /** Where the bass falls 10 dB under 1 kHz, Hz (null when it never does in the sweep's range). */
  bassLimit: number | null;
  findings: Finding[];
  verdict: string;
  kind: 'distorts' | 'clean' | 'unheard';
}

/** Distortion this high counts as distorting (3%: plainly audible on a tone). */
export const THD_LIMIT = 0.03;

/** Judge a recording made while TEST TONE played the plan. */
export function analyseTestTone(x: ArrayLike<number>, sampleRate: number, p: TonePlan = TONE_PLAN): ToneReport {
  const onset = findOnset(x, sampleRate, p);
  const none: ToneReport = { heard: false, onsetSec: -1, steps: [], distortsAt: null, cleanUpTo: null, limiting: false, response: [], bassLimit: null, findings: [], verdict: '', kind: 'unheard' };
  if (onset < 0) {
    const text = "Didn't hear the test tone: turn the speaker up, hold the phone near it (or plug the phone into it), and keep the room quiet";
    return { ...none, findings: [{ kind: 'quiet', level: 1, text }], verdict: verdictLine({ kind: 'quiet', level: 1, text }) };
  }
  const at = (sec: number) => Math.round((onset + sec) * sampleRate);
  const steps: StepResult[] = [];
  for (let i = 0; i < p.levels.length; i++) {
    // skip the step's first 120 ms (the speaker settling, the gain gliding) and its last 40 ms
    const a = at(i * p.stepSec + 0.12);
    const b = at((i + 1) * p.stepSec - 0.04);
    if (b > x.length) break;
    const seg = Array.prototype.slice.call(x, a, b) as number[];
    const sp = spectrum(seg, sampleRate, pow2Below(seg.length));
    const t = thd(sp, p.freq);
    const fund = peakNear(sp, p.freq * 0.95, p.freq * 1.05).power;
    const noise = bandPower(sp, p.freq * 1.3, p.freq * 1.7) / Math.max(1, (p.freq * 0.4) / sp.binHz);
    const heard = db(fund) - db(noise * 7) > 20;
    steps.push({ level: p.levels[i]!, db: db(fund), thd: heard ? t.thd : 0, heard });
  }
  const heardSteps = steps.filter((s) => s.heard);
  const base = heardSteps[0]?.thd ?? 0;
  const bad = heardSteps.find((s) => s.thd >= Math.max(THD_LIMIT, base * 2));
  const distortsAt = bad ? bad.level : null;
  // the loudest step below the first distorting one: "distorts above ~60%"
  const cleanUpTo = bad ? (heardSteps.filter((s) => s.level < bad.level).pop()?.level ?? 0) : null;
  // over the last three heard steps the level should rise by 20·log10(ratio) dB; much less is the speaker limiting
  let limiting = false;
  if (heardSteps.length >= 4) {
    const u = heardSteps[heardSteps.length - 4]!;
    const v = heardSteps[heardSteps.length - 1]!;
    limiting = v.db - u.db < 20 * Math.log10(v.level / u.level) - 1.5;
  }

  // the sweep: each third-octave band read where the sweep passes through it
  const s0 = p.levels.length * p.stepSec + p.gapSec;
  const k = 2 ** (1 / 6);
  const tOf = (f: number) => (p.sweep.sec * Math.log(f / p.sweep.from)) / Math.log(p.sweep.to / p.sweep.from);
  const raw: Band[] = [];
  for (const f of THIRD_OCTAVES) {
    if (f / k < p.sweep.from || f * k > p.sweep.to || f * k >= sampleRate / 2) continue;
    const a = at(s0 + tOf(f / k));
    const b = at(s0 + tOf(f * k));
    if (b > x.length || b - a < 64) continue;
    // the stretch where the sweep crosses this band holds the whole band and nothing else of it:
    // its energy in (a little wider than) the band, no window, so every band is read alike
    raw.push({ f, db: db(segmentPower(x, a, b, sampleRate, f / k / 1.15, f * k * 1.15)) });
  }
  const ref = raw.find((b) => Math.abs(b.f - 1000) < 1)?.db ?? (raw.length ? raw.reduce((a, b) => a + b.db, 0) / raw.length : 0);
  const response = raw.map((b) => ({ f: b.f, db: b.db - ref }));
  const low = response.filter((b) => b.f < 1000);
  // the lowest band from which everything up to 1 kHz stays within 10 dB of it
  let bassLimit: number | null = null;
  for (let i = low.length - 1; i >= 0; i--) {
    if (low[i]!.db < -10) {
      bassLimit = low[i + 1]?.f ?? 1000;
      break;
    }
  }

  const findings: Finding[] = [];
  if (bad && cleanUpTo !== null) {
    const pct = Math.round(cleanUpTo * 100);
    const notches = pct <= 50 ? 'a few notches' : 'a couple of notches';
    findings.push({ kind: 'clipping', level: 2, text: pct ? `Distorts above ~${pct}% volume (${(bad.thd * 100).toFixed(1)}% distortion at ${Math.round(bad.level * 100)}%): turn it down ${notches}` : `Distorts even at the quietest step (${(bad.thd * 100).toFixed(1)}% distortion): turn the speaker well down and test again` });
  }
  if (limiting) findings.push({ kind: 'clipping', level: 1, text: 'It stops getting louder at the top steps: the speaker is limiting itself — that is as loud as it goes cleanly' });
  if (bassLimit && bassLimit > 60) findings.push({ kind: 'thin', level: 1, text: `Bass fades below ~${hz(bassLimit)} (normal for a small speaker${bassLimit > 150 ? ', or the phone is too far away' : ''})` });
  const peak = response.filter((b) => b.f >= 80 && b.f <= 10000).reduce<Band | null>((a, b) => (!a || b.db > a.db ? b : a), null);
  if (peak && peak.db >= 8) findings.push({ kind: peak.f < 400 ? 'boomy' : 'harsh', level: 1, text: `A peak at ~${hz(peak.f)} (+${peak.db.toFixed(0)} dB over 1 kHz): ${peak.f < 400 ? 'turn the bass down a little' : 'turn the treble down a notch'}` });
  if (!findings.length || findings.every((f) => f.level < 2)) findings.unshift({ kind: 'clean', level: 0, text: heardSteps.length === steps.length ? 'Clean all the way to full volume' : 'Clean at every level the phone could hear' });
  findings.sort((a, b) => b.level - a.level);
  const head = findings[0]!;
  return { heard: true, onsetSec: onset, steps, distortsAt, cleanUpTo, limiting, response, bassLimit, findings, verdict: verdictLine(head), kind: distortsAt !== null ? 'distorts' : 'clean' };
}

/** The whole report in words, for Ghosty (sent as data with ASK GHOSTY). */
export function describeListen(r: ListenReport): string {
  const bits = [
    `SOUND CHECK (measured by the phone's microphone, ${r.seconds.toFixed(1)} s): verdict "${r.verdict}"`,
    `peak ${r.levels.peakDb.toFixed(1)} dBFS, RMS ${r.levels.rmsDb.toFixed(1)} dBFS, crest factor ${r.levels.crestDb.toFixed(1)} dB`,
    `flat tops ${(r.clipping.flatShare * 100).toFixed(0)}%, full-scale runs ${r.clipping.fullScaleRuns}, spectral flatness ${r.flatness.toFixed(2)}`,
  ];
  if (r.tone) bits.push(`a single tone at ${hz(r.tone.freq)} with ${(r.tone.thd * 100).toFixed(1)}% distortion`);
  if (r.hum) bits.push(`hum at ${r.hum.freq} Hz (${r.hum.prominenceDb.toFixed(0)} dB above its surroundings)`);
  bits.push(`findings: ${r.findings.map((f) => f.text).join('; ')}`);
  bits.push(`third-octave levels (dB): ${r.bands.filter((b) => b.f >= 40).map((b) => `${hz(b.f)} ${b.db.toFixed(0)}`).join(', ')}`);
  return bits.join('. ');
}

export function describeTone(r: ToneReport): string {
  if (!r.heard) return `SOUND CHECK test tone (phone's microphone): ${r.verdict}`;
  const bits = [
    `SOUND CHECK test tone (a 1 kHz tone in 10 steps, then a 40 Hz–16 kHz sweep, measured by the phone's microphone): verdict "${r.verdict}"`,
    `distortion by level: ${r.steps.map((s) => `${Math.round(s.level * 100)}% ${s.heard ? `${(s.thd * 100).toFixed(1)}%` : 'not heard'}`).join(', ')}`,
  ];
  if (r.limiting) bits.push('the level stopped rising at the top steps (limiting)');
  if (r.bassLimit) bits.push(`bass fades below ~${hz(r.bassLimit)}`);
  bits.push(`response relative to 1 kHz (dB): ${r.response.map((b) => `${hz(b.f)} ${b.db >= 0 ? '+' : ''}${b.db.toFixed(0)}`).join(', ')}`);
  bits.push(`findings: ${r.findings.map((f) => f.text).join('; ')}`);
  return bits.join('. ');
}
