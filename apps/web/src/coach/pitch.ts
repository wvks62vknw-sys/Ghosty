/**
 * PITCH FROM THE MIC, IN CODE (BRIEF-REST-B part 2): the YIN algorithm (de Cheveigné and Kawahara, 2002) — the difference
 * function, its cumulative mean normalisation, an absolute threshold and a parabolic fit round the dip — on a block of samples.
 * No model, no network: it works offline, on a guitar string, a piano key or a voice. Pure; the node tests run it on tones
 * made in code (A4 440, E2 82.4, a detuned G).
 *
 * The block is first averaged down to about 16 kHz (a box filter, which is also a gentle low-pass): the pitches wanted are
 * under 2 kHz, and the work falls by a factor of ten.
 */
export interface Pitch {
  hz: number;
  /** 0–1: how clean the periodicity is (1 − the normalised difference at the dip). Under 0.8 is noise or a chord. */
  clarity: number;
  /** The block's loudness (RMS, 0–1). */
  rms: number;
}

export interface PitchOpts {
  minHz?: number;
  maxHz?: number;
  /** YIN's absolute threshold (0.10–0.20; lower is stricter). */
  threshold?: number;
  /** Below this RMS the block is silence (null). */
  floor?: number;
}

export const rmsOf = (x: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, x.length));
};

/** Average `x` down by an integer factor. */
export function decimate(x: ArrayLike<number>, factor: number): Float32Array {
  if (factor <= 1) return Float32Array.from(x as ArrayLike<number> as number[]);
  const n = Math.floor(x.length / factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[i * factor + k]!;
    out[i] = s / factor;
  }
  return out;
}

/** The pitch of a block of samples taken at `sampleRate`, or null (silence, or nothing periodic). */
export function detectPitch(block: ArrayLike<number>, sampleRate: number, opts: PitchOpts = {}): Pitch | null {
  const { minHz = 55, maxHz = 1400, threshold = 0.15, floor = 0.008 } = opts;
  const rms = rmsOf(block);
  if (rms < floor) return null;
  const factor = Math.max(1, Math.floor(sampleRate / 16000));
  const sr = sampleRate / factor;
  const x = decimate(block, factor);
  // a long enough window for the lowest pitch: its period must fit twice in the block
  const tauMax = Math.min(Math.floor(x.length / 2) - 1, Math.floor(sr / minHz));
  const tauMin = Math.max(2, Math.floor(sr / maxHz));
  if (tauMax <= tauMin + 2) return null;
  const W = x.length - tauMax;
  if (W < tauMax) return null;
  // the difference function
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const v = x[j]! - x[j + tau]!;
      s += v * v;
    }
    d[tau] = s;
  }
  // its cumulative mean normalisation
  const n = new Float64Array(tauMax + 1);
  n[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau]!;
    n[tau] = run > 0 ? (d[tau]! * tau) / run : 1;
  }
  // the first dip under the threshold (then down to the bottom of it), else the lowest dip if it is clear enough
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (n[t]! < threshold) {
      while (t + 1 <= tauMax && n[t + 1]! < n[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (n[t]! < n[best]!) best = t;
    if (n[best]! > 0.35) return null;
    tau = best;
  }
  // a parabola through the dip and its neighbours: the period to a fraction of a sample
  let period = tau;
  if (tau > 1 && tau < tauMax) {
    const a = n[tau - 1]!;
    const b = n[tau]!;
    const c = n[tau + 1]!;
    const denom = a - 2 * b + c;
    if (Math.abs(denom) > 1e-12) period = tau + (a - c) / (2 * denom);
  }
  const hz = sr / period;
  if (!(hz >= minHz * 0.9 && hz <= maxHz * 1.1)) return null;
  return { hz, clarity: Math.max(0, Math.min(1, 1 - n[tau]!)), rms };
}

/** A tone made in code: its fundamental and a few harmonics (a plucked string is rich in them), for the tests and the spec's fake microphone. */
export function tone(hz: number, secs: number, sampleRate: number, opts: { harmonics?: number[]; amp?: number; decay?: number; noise?: number; seed?: number } = {}): Float32Array {
  const { harmonics = [1, 0.5, 0.25], amp = 0.4, decay = 0, noise = 0 } = opts;
  const n = Math.floor(secs * sampleRate);
  const out = new Float32Array(n);
  let seed = opts.seed ?? 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const norm = harmonics.reduce((t, v) => t + v, 0);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (let k = 0; k < harmonics.length; k++) v += harmonics[k]! * Math.sin(2 * Math.PI * hz * (k + 1) * t);
    out[i] = (amp * v * Math.exp(-decay * t)) / norm + noise * rnd();
  }
  return out;
}
