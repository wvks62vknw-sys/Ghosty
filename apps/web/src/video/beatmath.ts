/**
 * ON THE BEAT's maths (BRIEF-EDITOR-VIDEO-2), pure: an onset-strength envelope from the mix's spectral flux, the tempo by
 * autocorrelation within 60 to 180 beats a minute and then fitted to the onsets, the beat grid snapped to the strongest of them,
 * and the move of each cut to its nearest beat. Nothing leaves the phone and nothing is downloaded.
 */

/** In-place radix-2 FFT. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a]! += tr;
        im[a]! += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export interface Envelope {
  env: Float32Array;
  /** Envelope values a second. */
  fps: number;
}
/** The onset strength: the log-compressed spectrum's rise from one frame to the next, summed over the bins, the slow trend taken off. */
export function onsetEnvelope(mono: Float32Array, rate: number, size = 512, hop = 128): Envelope {
  const n = Math.max(0, Math.floor((mono.length - size) / hop));
  const win = new Float32Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  const bins = size / 2;
  let prev = new Float32Array(bins);
  const env = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    for (let i = 0; i < size; i++) {
      re[i] = mono[f * hop + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    const cur = new Float32Array(bins);
    let flux = 0;
    for (let k = 1; k < bins; k++) {
      cur[k] = Math.log1p(40 * Math.hypot(re[k]!, im[k]!) / size);
      const d = cur[k]! - prev[k]!;
      if (d > 0) flux += d;
    }
    env[f] = flux;
    prev = cur;
  }
  const fps = rate / hop;
  // the trend (a one second moving average) off, and what is left below zero dropped
  const half = Math.max(1, Math.round(fps / 2));
  const out = new Float32Array(n);
  let acc = 0;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i]! + env[i]!;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    acc = (pre[b]! - pre[a]!) / (b - a);
    out[i] = Math.max(0, env[i]! - acc);
    if (out[i]! > max) max = out[i]!;
  }
  if (max > 0) for (let i = 0; i < n; i++) out[i]! /= max;
  return { env: out, fps };
}

const at = (env: Float32Array, x: number): number => {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= env.length) return 0;
  const f = x - i;
  // the larger of the neighbours, so a beat a hair off a frame still counts in full
  return Math.max(env[i]! * (1 - f), env[i + 1]! * f, Math.min(env[i]!, env[i + 1]!));
};

export interface Tempo {
  bpm: number;
  /** The grid: its period and first beat, in envelope frames. */
  period: number;
  phase: number;
  /** How clear the pulse is (0 to 1): the fitted grid's mean onset against the envelope's mean. */
  clarity: number;
}
export const BPM_MIN = 60;
export const BPM_MAX = 180;

/** The tempo: the autocorrelation's best lag in 60 to 180 beats a minute (a mild liking for the middle of the range settles the octave), then a grid fitted around it. */
export function findTempo(e: Envelope): Tempo | null {
  const { env, fps } = e;
  if (env.length < fps * 4) return null;
  const lagMin = Math.floor((60 / BPM_MAX) * fps);
  const lagMax = Math.ceil((60 / BPM_MIN) * fps);
  const ac: number[] = [];
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i]! * env[i + lag]!;
    ac.push(s / (env.length - lag));
  }
  let best = -1;
  let bi = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.75) ** 2);
    const v = ac[lag - lagMin + 1]! * (0.6 + 0.4 * prior);
    if (v > best) {
      best = v;
      bi = lag;
    }
  }
  if (best <= 0) return null;
  const bpm0 = (60 * fps) / bi;
  // fit: bpm within 4% and the phase over one period, the grid that sits on the most onset
  let top = -1;
  let fit: { bpm: number; phase: number } = { bpm: bpm0, phase: 0 };
  for (let b = bpm0 * 0.96; b <= bpm0 * 1.04 + 1e-9; b += bpm0 * 0.002) {
    const period = (60 * fps) / b;
    for (let ph = 0; ph < period; ph += 0.5) {
      let s = 0;
      let c = 0;
      for (let x = ph; x < env.length - 1; x += period) {
        s += at(env, x);
        c++;
      }
      s /= Math.max(1, c);
      if (s > top + 1e-9) {
        top = s;
        fit = { bpm: b, phase: ph };
      }
    }
  }
  const mean = env.reduce((a, v) => a + v, 0) / env.length;
  return { bpm: fit.bpm, period: (60 * fps) / fit.bpm, phase: fit.phase, clarity: Math.min(1, mean > 0 ? top / (mean * 8) : 0) };
}

/** The beats (ms of the sound), each grid line pulled to the strongest onset within `snapMs` of it when that onset is clear. */
export function beatGrid(e: Envelope, t: Tempo, durMs: number, snapMs = 45): number[] {
  const out: number[] = [];
  const r = Math.max(1, Math.round((snapMs / 1000) * e.fps));
  for (let x = t.phase; (x / e.fps) * 1000 <= durMs; x += t.period) {
    let bx = x;
    let bv = at(e.env, x);
    for (let k = -r; k <= r; k++) {
      const v = e.env[Math.round(x) + k] ?? 0;
      if (v > bv + 1e-6) {
        bv = v;
        bx = Math.round(x) + k;
      }
    }
    out.push(Math.round(((bv >= 0.25 ? bx : x) / e.fps) * 1000));
  }
  return out;
}

export interface Move {
  /** The cut's index, where it was and where it goes (ms). */
  i: number;
  from: number;
  to: number;
}
/** Each cut's nearest beat within `maxMs`; the moves made and the biggest. */
export function nearestBeats(cuts: number[], beats: number[], maxMs = 400): { moves: Move[]; biggest: number } {
  const moves: Move[] = [];
  let biggest = 0;
  cuts.forEach((c, i) => {
    let best = Infinity;
    let to = c;
    for (const b of beats) {
      const d = Math.abs(b - c);
      if (d < best) {
        best = d;
        to = b;
      }
    }
    if (best <= maxMs && best >= 1) {
      moves.push({ i, from: c, to });
      biggest = Math.max(biggest, best);
    }
  });
  return { moves, biggest };
}

export const tempoWords = (bpm: number): string => `about ${Math.round(bpm)} beats a minute`;
