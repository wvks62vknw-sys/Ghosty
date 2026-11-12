/**
 * THE VOICEPRINT, WITH NO MODEL (BRIEF-VOICE-KNOWN 1; OWNER-ISSUES 131 (7)): whose voice a capture is, from the phone's own audio
 * features, in plain arithmetic. Pure: no DOM, no network, no storage (voicestore.ts keeps the numbers, voiceknown.ts uses them).
 *
 * WHAT IT MEASURES. The capture is 16 kHz mono. In frames of 25 ms every 10 ms it finds the frames that are a voice (loud enough
 * against the capture's own quietest part, and periodic: a pitch between 70 and 400 Hz). On those it takes the log energy in 24
 * mel bands from 100 Hz to 3.4 kHz (the telephone band: above it a voice sinks under a room's own noise and the bands follow the
 * room and the loudness, not the voice: measured, apps/edge/test/voiceknown.test.mjs) with the room's spectrum (read off the quietest
 * frames of the capture) taken off and the frame's own average taken off (so loudness and distance from the phone count for little,
 * the shape of the voice does: the length of the throat and mouth, the tilt of the spectrum), and the pitch. A profile is the
 * mean and the spread of each band over the capture and the mean and spread of the pitch: 50 numbers. A person is kept as the
 * profile of each sentence read, and the pooled one: 4 x 50 = 200 numbers, never a recording.
 *
 * HOW IT COMPARES. `distance(profile, capture)` is one number: the band shapes' root-mean-square gap, the spreads' gap and the
 * pitch gap, each in units of how far one voice wanders between two sentences (`SCALE`, measured on synthetic voices in
 * apps/edge/test/voiceknown.test.mjs), added in quadrature. Under `floor` it is the same voice; over `CEILING` it is certainly
 * another; between the two it is NOT SURE, and not sure is "a voice I don't know" (it fails closed). The floor is set from the
 * enrolment itself: the worst distance of a sentence read to the other sentences read (leave one out), with a margin, never
 * under FLOOR_MIN nor over FLOOR_MAX: a steady speaker gets a tight floor, one whose voice moves a lot a wider one.
 *
 * HOW STRONG IT IS: a courtesy signal, not a lock. A recording of his voice played at the phone defeats it; a cold, a shout or a
 * whisper moves it; two people who sound alike may not be told apart (then adding the second says so). The voice model (a pack
 * he fetches on his tap: speakermodel.ts, speakerjudge.ts) tells voices apart better; this is what the phone does by itself, and
 * what it falls back to when the model is not on the phone (`judgeBest` at the end of this file chooses).
 */

import { enrolEmb, hasEmb, isEmb, judgeEmb, tooAlike, type EmbPrint, type KnownEmb } from './speakerjudge';

export const RATE = 16_000;
const FRAME = 400; // 25 ms
const HOP = 160; // 10 ms
const NFFT = 512;
export const BANDS = 24;
const LOW_HZ = 100;
const HIGH_HZ = 3400;
/** A profile is BANDS means, BANDS spreads, the pitch's mean and spread (ln Hz): this many numbers. */
export const PROFILE_LEN = BANDS * 2 + 2;
/** Too little voice to judge (seconds of voiced frames): not sure. */
export const MIN_VOICED = 0.35;
/** A sentence read at enrolment needs this much voice, or it is asked for again. */
export const MIN_ENROL_VOICED = 1.2;
export const SENTENCES = 3;

/**
 * One voice wanders this much between two sentences, in each measure (ln-energy per band for the shape, for the spread; ln Hz
 * for the pitch): the unit the distance is counted in. Measured on the synthetic voices of the test, which move a little more
 * between sentences than a steady real voice does (three vowel orders, a different pitch line each).
 */
export const SCALE = { shape: 0.34, spread: 0.2, pitch: 0.1 };
/** Over this, certainly another voice: the gap between the test's two synthetic voices (4.0), less 20%. */
export const CEILING = 3.2;
/** The least and the most the floor can be, whatever the enrolment says. */
export const FLOOR_MIN = 1.1;
export const FLOOR_MAX = 2.4;
/** The floor is the worst leave-one-out distance of the enrolment times this. */
export const FLOOR_MARGIN = 1.35;

/** A voice, as numbers. `looks`: the profile of each sentence read; `pooled`: all of them together. */
export interface Print {
  v: 1;
  looks: number[][];
  pooled: number[];
  floor: number;
  /** The voice model's numbers for the same three lines, when the model was on the phone at enrolment (speakerjudge.ts). */
  emb?: EmbPrint;
}

export interface Voiced {
  /** Seconds of voice found. */
  secs: number;
  /** The capture's profile (PROFILE_LEN numbers), or null when there was too little voice. */
  profile: number[] | null;
  /** The voice model's embedding of the capture, when the model is on the phone and there was speech enough. */
  emb?: number[] | null;
}

// ---------------------------------------------------------------- the arithmetic

const HANN = new Float64Array(FRAME).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
const COS = new Float64Array(NFFT / 2).map((_, i) => Math.cos((2 * Math.PI * i) / NFFT));
const SIN = new Float64Array(NFFT / 2).map((_, i) => -Math.sin((2 * Math.PI * i) / NFFT));
const REV = (() => {
  const r = new Uint16Array(NFFT);
  const bits = Math.log2(NFFT);
  for (let i = 0; i < NFFT; i++) {
    let x = i;
    let y = 0;
    for (let b = 0; b < bits; b++) {
      y = (y << 1) | (x & 1);
      x >>= 1;
    }
    r[i] = y;
  }
  return r;
})();

const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const unmel = (m: number) => 700 * (10 ** (m / 2595) - 1);

/** The triangular mel filters: for each band the first bin, and its weights. */
const FILTERS = (() => {
  const edges = Array.from({ length: BANDS + 2 }, (_, i) => unmel(mel(LOW_HZ) + ((mel(HIGH_HZ) - mel(LOW_HZ)) * i) / (BANDS + 1)));
  const bin = (hz: number) => (hz * NFFT) / RATE;
  return Array.from({ length: BANDS }, (_, b) => {
    const lo = bin(edges[b]!);
    const mid = bin(edges[b + 1]!);
    const hi = bin(edges[b + 2]!);
    const from = Math.max(1, Math.floor(lo));
    const w: number[] = [];
    for (let k = from; k <= Math.min(NFFT / 2, Math.ceil(hi)); k++) w.push(k <= mid ? Math.max(0, (k - lo) / (mid - lo)) : Math.max(0, (hi - k) / (hi - mid)));
    return { from, w };
  });
})();

const re = new Float64Array(NFFT);
const im = new Float64Array(NFFT);
/** The power spectrum of one windowed frame into `pow` (NFFT/2 + 1 bins). */
function power(frame: Float64Array, pow: Float64Array): void {
  for (let i = 0; i < NFFT; i++) {
    const j = REV[i]!;
    re[j] = i < FRAME ? frame[i]! : 0;
    im[j] = 0;
  }
  for (let size = 2; size <= NFFT; size <<= 1) {
    const half = size >> 1;
    const step = NFFT / size;
    for (let i = 0; i < NFFT; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j;
        const b = a + half;
        const tr = re[b]! * COS[k]! - im[b]! * SIN[k]!;
        const ti = re[b]! * SIN[k]! + im[b]! * COS[k]!;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
  for (let k = 0; k <= NFFT / 2; k++) pow[k] = re[k]! * re[k]! + im[k]! * im[k]!;
}

/**
 * The pitch of one stretch of the capture (halved to 8 kHz, 40 ms), by the strongest self-similarity between 70 and 400 Hz:
 * Hz and how periodic it was (0 to 1), or 0 for none.
 */
function pitchOf(at: number, half: Float64Array): { hz: number; strength: number } {
  const n = 320;
  const start = Math.max(0, Math.floor(at / 2) - 80);
  if (start + n + 115 > half.length) return { hz: 0, strength: 0 };
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += half[start + i]! * half[start + i]!;
  if (e0 < 1e-9) return { hz: 0, strength: 0 };
  let best = 0;
  let bestLag = 0;
  const scores = new Float64Array(116);
  for (let lag = 19; lag <= 114; lag++) {
    let s = 0;
    let e1 = 0;
    for (let i = 0; i < n; i++) {
      const b = half[start + i + lag]!;
      s += half[start + i]! * b;
      e1 += b * b;
    }
    const r = s / Math.sqrt(e0 * e1 + 1e-12);
    scores[lag] = r;
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  // the shortest lag that is nearly as good as the best (an octave down is a worse answer than the true period)
  for (let lag = 19; lag < bestLag; lag++) {
    if (scores[lag]! > best * 0.9 && scores[lag]! >= scores[lag - 1]! && scores[lag]! >= scores[lag + 1]!) {
      bestLag = lag;
      break;
    }
  }
  return { hz: 8000 / bestLag, strength: best };
}

/**
 * What a capture says of the voice in it: its seconds of voice and its profile (null under MIN_VOICED seconds). `pcm` is 16 kHz
 * mono, -1 to 1.
 */
export function features(pcm: Float32Array): Voiced {
  const frames = Math.floor((pcm.length - FRAME) / HOP) + 1;
  if (frames < 20) return { secs: 0, profile: null };
  // pre-emphasis, so the high bands are not lost under the low ones
  const x = new Float32Array(pcm.length);
  for (let i = 1; i < pcm.length; i++) x[i] = pcm[i]! - 0.97 * pcm[i - 1]!;
  const half = new Float64Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < half.length; i++) half[i] = (pcm[2 * i]! + pcm[2 * i + 1]!) / 2;
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * HOP; i < f * HOP + FRAME; i++) s += pcm[i]! * pcm[i]!;
    energy[f] = s;
  }
  // loud enough: 24 dB under the capture's loud frames (its 90th percentile), and above silence
  const sorted = Float64Array.from(energy).sort();
  const loud = sorted[Math.floor(frames * 0.9)]!;
  const gate = Math.max(loud * 0.004, 1e-6);
  const frame = new Float64Array(FRAME);
  const pow = new Float64Array(NFFT / 2 + 1);
  // every frame's band energies (the room's own spectrum is read off the quietest of them and taken off the voice's)
  const bandsOf = new Float64Array(frames * BANDS);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < FRAME; i++) frame[i] = x[f * HOP + i]! * HANN[i]!;
    power(frame, pow);
    for (let b = 0; b < BANDS; b++) {
      const { from, w } = FILTERS[b]!;
      let s = 0;
      for (let k = 0; k < w.length; k++) s += w[k]! * pow[from + k]!;
      bandsOf[f * BANDS + b] = s;
    }
  }
  const quiet = Array.from(energy.keys()).sort((a, b) => energy[a]! - energy[b]!).slice(0, Math.max(5, Math.floor(frames * 0.15)));
  const room = new Float64Array(BANDS);
  for (const f of quiet) for (let b = 0; b < BANDS; b++) room[b] = room[b]! + bandsOf[f * BANDS + b]! / quiet.length;
  const sum = new Float64Array(BANDS);
  const sq = new Float64Array(BANDS);
  const logs = new Float64Array(BANDS);
  let n = 0;
  let pitchSum = 0;
  let pitchSq = 0;
  for (let f = 0; f < frames; f++) {
    if (energy[f]! < gate) continue;
    const p = pitchOf(f * HOP + FRAME / 2, half);
    if (p.hz < 70 || p.hz > 400 || p.strength < 0.5) continue;
    let mean = 0;
    for (let b = 0; b < BANDS; b++) {
      const e = bandsOf[f * BANDS + b]!;
      // the room taken off, never to less than a twentieth of what was there
      logs[b] = Math.log(Math.max(e - room[b]!, 0.5 * room[b]!) + 1e-9);
      mean += logs[b]!;
    }
    mean /= BANDS;
    for (let b = 0; b < BANDS; b++) {
      const v = logs[b]! - mean;
      sum[b] = sum[b]! + v;
      sq[b] = sq[b]! + v * v;
    }
    const lf = Math.log(p.hz);
    pitchSum += lf;
    pitchSq += lf * lf;
    n++;
  }
  const secs = (n * HOP) / RATE;
  if (secs < MIN_VOICED) return { secs, profile: null };
  const out = new Array<number>(PROFILE_LEN);
  for (let b = 0; b < BANDS; b++) {
    const m = sum[b]! / n;
    out[b] = m;
    out[BANDS + b] = Math.sqrt(Math.max(0, sq[b]! / n - m * m));
  }
  const pm = pitchSum / n;
  out[BANDS * 2] = pm;
  out[BANDS * 2 + 1] = Math.sqrt(Math.max(0, pitchSq / n - pm * pm));
  return { secs, profile: out };
}

/** Profiles averaged (each weighted by its seconds of voice). */
export function pool(profiles: number[][], weights: number[] = profiles.map(() => 1)): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return Array.from({ length: PROFILE_LEN }, (_, i) => profiles.reduce((s, p, j) => s + p[i]! * weights[j]!, 0) / total);
}

const rms = (a: number[], b: number[], from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(s / (to - from));
};

/** How far a capture's profile is from a voice's: 0 the same, about 1 two sentences of one voice, over CEILING another. */
export function distance(voice: number[], capture: number[]): number {
  const shape = rms(voice, capture, 0, BANDS) / SCALE.shape;
  const spread = rms(voice, capture, BANDS, BANDS * 2) / SCALE.spread;
  const pitch = Math.abs(voice[BANDS * 2]! - capture[BANDS * 2]!) / SCALE.pitch;
  return Math.sqrt((shape * shape + spread * spread + pitch * pitch) / 3);
}

/** The floor for an enrolment: its worst sentence against the others, with a margin, kept between FLOOR_MIN and FLOOR_MAX. */
export function floorFor(looks: number[][], weights: number[] = looks.map(() => 1)): number {
  let worst = 0;
  for (let i = 0; i < looks.length; i++) {
    const rest = looks.filter((_, j) => j !== i);
    if (!rest.length) continue;
    worst = Math.max(worst, distance(pool(rest, weights.filter((_, j) => j !== i)), looks[i]!));
  }
  return Math.min(FLOOR_MAX, Math.max(FLOOR_MIN, worst * FLOOR_MARGIN));
}

/** A voice kept, from the sentences read. */
export function enrol(looks: Voiced[]): Print | null {
  const good = looks.filter((l): l is Voiced & { profile: number[] } => !!l.profile && l.secs >= MIN_ENROL_VOICED);
  if (good.length < SENTENCES) return null;
  const profiles = good.map((l) => l.profile);
  const weights = good.map((l) => l.secs);
  const emb = enrolEmb(good.map((l) => l.emb));
  return { v: 1, looks: profiles, pooled: pool(profiles, weights), floor: floorFor(profiles, weights), ...(emb ? { emb } : {}) };
}

/** Is a stored thing a Print with its numbers whole? (A hurt record is no voice.) */
export function isPrint(p: unknown): p is Print {
  const q = p as Print | null;
  return !!q && q.v === 1 && Array.isArray(q.pooled) && q.pooled.length === PROFILE_LEN && Array.isArray(q.looks) && q.looks.length > 0 && q.looks.every((l) => Array.isArray(l) && l.length === PROFILE_LEN && l.every(Number.isFinite)) && q.pooled.every(Number.isFinite) && Number.isFinite(q.floor) && (q.emb === undefined || isEmb(q.emb));
}

export type Who = { kind: 'owner' } | { kind: 'person'; id: string; name: string } | { kind: 'unknown'; why: 'voice' | 'unsure' | 'short' };

export interface Known {
  id: string;
  name: string;
  me: boolean;
  print: Print;
}

/**
 * Whose voice a capture is among the voices known. The best match under its own floor, and no other within its floor too: that
 * is them. A capture of too little voice, one that is between a floor and the ceiling and one that two voices both claim are NOT
 * SURE; one over the ceiling of every voice is another's. Every one of those is "a voice I don't know": it fails closed.
 * (`why` is for the checks and the console, never for the brain or the screen.)
 */
export function judge(known: Known[], capture: Voiced): { who: Who; d: number } {
  if (!capture.profile) return { who: { kind: 'unknown', why: 'short' }, d: Infinity };
  const near = known.map((k) => ({ k, d: distance(k.print.pooled, capture.profile!) })).sort((a, b) => a.d / a.k.print.floor - b.d / b.k.print.floor);
  const best = near[0];
  if (!best) return { who: { kind: 'unknown', why: 'voice' }, d: Infinity };
  const inside = near.filter((n) => n.d <= n.k.print.floor);
  if (inside.length === 1) {
    return { who: best.k.me ? { kind: 'owner' } : { kind: 'person', id: best.k.id, name: best.k.name }, d: best.d };
  }
  if (inside.length > 1) return { who: { kind: 'unknown', why: 'unsure' }, d: best.d };
  return { who: { kind: 'unknown', why: near.every((n) => n.d >= CEILING) ? 'voice' : 'unsure' }, d: best.d };
}

/**
 * Could this voice be added as someone new beside the voices known? Not when the two could be mistaken: their floors would
 * overlap (the gap between the two is less than their floors together), and the phone would call one by the other's name.
 * Returns the one it sounds like, or null.
 */
export function soundsLike(known: Known[], print: Print): Known | null {
  return known.find((k) => distance(k.print.pooled, print.pooled) < k.print.floor + print.floor) ?? (print.emb ? tooAlike(known, print.emb) : null);
}

/**
 * Whose voice a capture is: by the model's numbers when the model gave some and every voice known has its own, else by the phone's
 * own features (voiceprint.ts), exactly as before. `via` says which, for the checks and the MY VOICE screen.
 */
export function judgeBest(known: Known[], capture: Voiced): { who: Who; d: number; via: 'model' | 'features' } {
  if (capture.emb && known.length && known.every(hasEmb)) return { ...judgeEmb(known as KnownEmb[], capture.emb), via: 'model' };
  return { ...judge(known, capture), via: 'features' };
}
