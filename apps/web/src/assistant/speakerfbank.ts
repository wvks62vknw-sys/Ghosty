/**
 * WHAT THE VOICE MODEL IS FED (STARS 171): the 80-band log filterbank of a capture, in plain arithmetic. Pure: no DOM, no network,
 * no storage. The capture is 16 kHz mono, -1 to 1. It is cut in frames of 25 ms every 10 ms; each frame has its own average taken
 * off, is pre-emphasised (0.97), windowed (Hamming), run through a 512-point FFT; its power is added up in 80 triangular bands
 * spaced evenly on the mel scale from 20 Hz to 8 kHz; the log of each is taken. The model was trained on audio counted in 16-bit
 * steps, so the capture is scaled by 32768 first. Last, the mean of each band over the whole capture is taken off (the room and the
 * microphone count for less, the shape of the voice for more). The silence at both ends is cut off first: a model told voices apart
 * on speech, not on the room's hum.
 */

export const RATE = 16_000;
const FRAME = 400; // 25 ms
const HOP = 160; // 10 ms
const NFFT = 512;
export const MELS = 80;
const LOW_HZ = 20;
const HIGH_HZ = 8000;
/** At least this much speech (seconds) for a capture to be embedded; under it the voice is not judged. */
export const MIN_SPEECH = 1.0;
/** At most this much (seconds) is embedded: a long capture is cut to its middle, so a turn never costs more than this. */
export const MAX_SPEECH = 12;
/** Where speech starts and ends: a frame this far under the capture's loud frames (their 90th percentile) is silence. */
const GATE = 0.01;

const HAMMING = new Float64Array(FRAME).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
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

const mel = (hz: number) => 1127 * Math.log(1 + hz / 700);

/** The triangular filters over the first 256 bins: for each band the first bin with a weight, and the weights. */
const FILTERS = (() => {
  const binHz = RATE / NFFT;
  const lo = mel(LOW_HZ);
  const step = (mel(HIGH_HZ) - lo) / (MELS + 1);
  return Array.from({ length: MELS }, (_, b) => {
    const left = lo + step * b;
    const centre = lo + step * (b + 1);
    const right = lo + step * (b + 2);
    const w: number[] = [];
    let from = -1;
    for (let k = 0; k < NFFT / 2; k++) {
      const m = mel(binHz * k);
      if (m <= left || m >= right) continue;
      if (from < 0) from = k;
      w.push(m <= centre ? (m - left) / (centre - left) : (right - m) / (right - centre));
    }
    return { from: Math.max(0, from), w };
  });
})();

const re = new Float64Array(NFFT);
const im = new Float64Array(NFFT);
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
  for (let k = 0; k < NFFT / 2; k++) pow[k] = re[k]! * re[k]! + im[k]! * im[k]!;
}

/** The part of a capture that is speech: from the first loud frame to the last, a tenth of a second of room kept each side. */
export function speechOf(pcm: Float32Array): Float32Array {
  const frames = Math.floor((pcm.length - FRAME) / HOP) + 1;
  if (frames < 10) return new Float32Array(0);
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * HOP; i < f * HOP + FRAME; i++) s += pcm[i]! * pcm[i]!;
    energy[f] = s;
  }
  const loud = Float64Array.from(energy).sort()[Math.floor(frames * 0.9)]!;
  const gate = Math.max(loud * GATE, 1e-7);
  let first = 0;
  while (first < frames && energy[first]! < gate) first++;
  let last = frames - 1;
  while (last > first && energy[last]! < gate) last--;
  if (first >= frames) return new Float32Array(0);
  const room = 10;
  const from = Math.max(0, (first - room) * HOP);
  const to = Math.min(pcm.length, (last + room) * HOP + FRAME);
  let out = pcm.subarray(from, to);
  const cap = MAX_SPEECH * RATE;
  if (out.length > cap) {
    const mid = Math.floor((out.length - cap) / 2);
    out = out.subarray(mid, mid + cap);
  }
  return out;
}

/**
 * The filterbank of a capture's speech, the mean taken off: `frames` x 80 numbers (row by row), or null when there is too little
 * speech (under MIN_SPEECH seconds) to tell a voice by.
 */
export function fbank(pcm: Float32Array): { data: Float32Array; frames: number } | null {
  const x = speechOf(pcm);
  if (x.length < MIN_SPEECH * RATE) return null;
  const frames = Math.floor((x.length - FRAME) / HOP) + 1;
  const out = new Float32Array(frames * MELS);
  const frame = new Float64Array(FRAME);
  const pow = new Float64Array(NFFT / 2);
  for (let f = 0; f < frames; f++) {
    const at = f * HOP;
    let mean = 0;
    for (let i = 0; i < FRAME; i++) {
      frame[i] = x[at + i]! * 32768;
      mean += frame[i]!;
    }
    mean /= FRAME;
    for (let i = 0; i < FRAME; i++) frame[i] = frame[i]! - mean;
    for (let i = FRAME - 1; i > 0; i--) frame[i] = frame[i]! - 0.97 * frame[i - 1]!;
    frame[0] = frame[0]! - 0.97 * frame[0]!;
    for (let i = 0; i < FRAME; i++) frame[i] = frame[i]! * HAMMING[i]!;
    power(frame, pow);
    for (let b = 0; b < MELS; b++) {
      const { from, w } = FILTERS[b]!;
      let s = 0;
      for (let k = 0; k < w.length; k++) s += w[k]! * pow[from + k]!;
      out[f * MELS + b] = Math.log(Math.max(s, 1.1920929e-7));
    }
  }
  for (let b = 0; b < MELS; b++) {
    let m = 0;
    for (let f = 0; f < frames; f++) m += out[f * MELS + b]!;
    m /= frames;
    for (let f = 0; f < frames; f++) out[f * MELS + b] = out[f * MELS + b]! - m;
  }
  return { data: out, frames };
}
