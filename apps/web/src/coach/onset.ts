/**
 * ONSETS AND NOTES FROM A RECORDING, IN CODE (BRIEF-REST-B part 2). An ONSET is the moment a sound begins — a pluck, a strum,
 * a key, a sung note: the loudness envelope is taken every 5 ms, and a rise above what came just before it, over a floor,
 * is an onset (with a quiet gap after each, so one strum is one onset). A NOTE is a run of steady pitch found by YIN
 * (pitch.ts) block by block, starting where it stops being silent or changes. Pure; the node tests run them on strums and
 * tunes made in code.
 */
import { detectPitch, rmsOf } from './pitch';
import { midiOf } from './notes';

export interface OnsetOpts {
  /** Seconds of quiet needed between two onsets. */
  gap?: number;
  /** How far above the envelope's recent level a rise must be (in multiples of that level). */
  rise?: number;
  /** Below this RMS nothing is an onset. */
  floor?: number;
}

/** The loudness (RMS) every `hop` seconds over windows of twice that. */
export function envelope(x: ArrayLike<number>, sampleRate: number, hop = 0.005): { env: Float32Array; hop: number } {
  const h = Math.max(1, Math.round(hop * sampleRate));
  const n = Math.floor(x.length / h);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * h;
    const b = Math.min(x.length, a + 2 * h);
    let s = 0;
    for (let k = a; k < b; k++) s += x[k]! * x[k]!;
    env[i] = Math.sqrt(s / Math.max(1, b - a));
  }
  return { env, hop: h / sampleRate };
}

/** Where sounds begin, in seconds from the start of the recording. */
export function detectOnsets(x: ArrayLike<number>, sampleRate: number, opts: OnsetOpts = {}): number[] {
  const { gap = 0.12, rise = 0.6, floor = 0.01 } = opts;
  const { env, hop } = envelope(x, sampleRate);
  const out: number[] = [];
  const back = Math.max(2, Math.round(0.06 / hop));
  let last = -1e9;
  for (let i = 1; i < env.length; i++) {
    // the loudest it was between 60 and 120 ms ago: a slow fade-in (a voice) rises past it too, and a note already ringing does not
    let level = 0;
    for (let k = back; k < 2 * back; k++) if (i - k >= 0) level = Math.max(level, env[i - k]!);
    const e = env[i]!;
    // the first frame that is clearly louder than it was a moment ago: a sound has begun (and for `gap` seconds
    // nothing else is an onset, so one strum, whose strings arrive over some milliseconds, is one onset)
    if (e > floor && e > level * (1 + rise) && i * hop - last >= gap) {
      out.push((i + 0.5) * hop);
      last = i * hop;
    }
  }
  return out;
}

/** A steady note heard: when it began, how long it lasted, its nearest note (MIDI number) and how far from it (cents), how loud. */
export interface NoteEvent {
  t: number;
  dur: number;
  midi: number;
  cents: number;
  hz: number;
  level: number;
  /** How far the pitch wandered while it lasted (highest to lowest block, in cents). */
  spread: number;
}

export interface TrackOpts {
  minHz?: number;
  maxHz?: number;
  /** Seconds between blocks. */
  hop?: number;
  /** The shortest note kept, in seconds. */
  minDur?: number;
  clarity?: number;
}

/** Notes in a recording: a block of 2,048 samples every `hop` seconds is given to YIN; a run of blocks on the same note is one note. */
export function trackNotes(x: ArrayLike<number>, sampleRate: number, opts: TrackOpts = {}): NoteEvent[] {
  const { minHz = 60, maxHz = 1200, hop = 0.03, minDur = 0.09, clarity = 0.8 } = opts;
  const blockLen = 4096 >= Math.floor(sampleRate * 0.085) ? 4096 : 2 ** Math.ceil(Math.log2(sampleRate * 0.085));
  const step = Math.max(1, Math.round(hop * sampleRate));
  const frames: { t: number; midi: number; hz: number; level: number }[] = [];
  const buf = new Float32Array(blockLen);
  for (let a = 0; a + blockLen <= x.length; a += step) {
    for (let i = 0; i < blockLen; i++) buf[i] = x[a + i]!;
    const p = detectPitch(buf, sampleRate, { minHz, maxHz });
    if (p && p.clarity >= clarity) frames.push({ t: a / sampleRate, midi: midiOf(p.hz), hz: p.hz, level: p.rms });
    else frames.push({ t: a / sampleRate, midi: NaN, hz: 0, level: rmsOf(buf) });
  }
  const out: NoteEvent[] = [];
  let run: typeof frames = [];
  const flush = () => {
    if (run.length) {
      const dur = (run.at(-1)!.t - run[0]!.t) + hop;
      if (dur >= minDur) {
        const midis = run.map((f) => f.midi).sort((p, q) => p - q);
        const med = midis[Math.floor(midis.length / 2)]!;
        out.push({ t: run[0]!.t + (blockLen / sampleRate) * 0.35, dur, midi: Math.round(med), cents: Math.round((med - Math.round(med)) * 1000) / 10, hz: run[Math.floor(run.length / 2)]!.hz, level: Math.max(...run.map((f) => f.level)), spread: Math.round((midis[midis.length - 1]! - midis[0]!) * 1000) / 10 });
      }
    }
    run = [];
  };
  for (const f of frames) {
    if (Number.isNaN(f.midi)) flush();
    else if (run.length && Math.abs(f.midi - run[run.length - 1]!.midi) > 0.7) {
      flush();
      run.push(f);
    } else run.push(f);
  }
  flush();
  return out;
}
