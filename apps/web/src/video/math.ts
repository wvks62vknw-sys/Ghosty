/**
 * The video editor's maths (BRIEF-EDITOR-VIDEO), pure: keyframes, a transition's weights, the ducking curve, the chroma
 * distance, and the audio mix as a plan of gains over time (the live player and the export both read the same plan).
 */
import { clipLen, fadeCap, place, type Channel, type Clip, type Key, type Project, type TransitionKind, type Transform } from './model';
import { pictureAt, playTime, speedAt, type SpeedKey } from './ramp';
export { paceAt, pictureAt, playTime, speedAt, type SpeedKey } from './ramp';

export const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

/** A channel's value at `t` (ms from the clip's start): the base value when it has no keys, else linear (or eased) between keys. */
export function valueAt(keys: Key[] | undefined, base: number, t: number): number {
  if (!keys?.length) return base;
  const k = [...keys].sort((a, b) => a.t - b.t);
  if (t <= k[0]!.t) return k[0]!.v;
  const last = k[k.length - 1]!;
  if (t >= last.t) return last.v;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / Math.max(1, b.t - a.t);
      return a.v + (b.v - a.v) * (a.ease ? smooth(f) : f);
    }
  }
  return last.v;
}

export function transformAt(tr: Transform, t: number): { x: number; y: number; scale: number; rot: number; opacity: number } {
  const v = (c: Channel) => valueAt(tr.keys[c], tr[c], t);
  return { x: v('x'), y: v('y'), scale: v('scale'), rot: v('rot'), opacity: clamp(v('opacity'), 0, 1) };
}

/**
 * A transition's weights at progress p (0 to 1): the clip going out (a), the clip coming in (b) and black. They sum to one.
 * A dip fades the first clip to black in the first half and the second up from black in the second; a crossfade swaps them;
 * a wipe and a slide mix by position (see `wipeEdge`), so their weights are the hard cut at the edge: 1 and 0.
 */
export function transitionWeights(kind: TransitionKind, p: number): { a: number; b: number; black: number } {
  const x = clamp(p, 0, 1);
  if (kind === 'crossfade') return { a: 1 - x, b: x, black: 0 };
  if (kind === 'dip') return x < 0.5 ? { a: 1 - x * 2, b: 0, black: x * 2 } : { a: 0, b: (x - 0.5) * 2, black: 1 - (x - 0.5) * 2 };
  if (kind === 'wipe' || kind === 'slide') return { a: 1 - (x >= 1 ? 1 : 0), b: x >= 1 ? 1 : 0, black: 0 };
  return { a: x >= 1 ? 0 : 1, b: x >= 1 ? 1 : 0, black: 0 };
}

/** The progress of a transition running from `start` for `len` ms at timeline time `t`, eased a little. */
export const transitionProgress = (t: number, start: number, len: number): number => smooth((t - start) / Math.max(1, len));

/** The music's gain (a multiplier, 1 = untouched) at time t under voice stretches [start, end], dropping by `db` decibels. */
export function duckGain(t: number, voice: { start: number; end: number }[], db: number, attack = 150, release = 400): number {
  if (db <= 0 || !voice.length) return 1;
  const floor = Math.pow(10, -db / 20);
  let depth = 0;
  for (const v of voice) {
    let d = 0;
    if (t >= v.start && t <= v.end) d = 1;
    else if (t < v.start && t > v.start - attack) d = (t - (v.start - attack)) / attack;
    else if (t > v.end && t < v.end + release) d = 1 - (t - v.end) / release;
    depth = Math.max(depth, d);
  }
  return 1 + (floor - 1) * smooth(depth);
}

/** The colour distance a chroma key judges by: the distance in the blue-red chroma plane of YCbCr, 0 to about 0.7. */
export function chromaDistance(a: [number, number, number], b: [number, number, number]): number {
  const cb = (c: [number, number, number]) => -0.168736 * c[0] - 0.331264 * c[1] + 0.5 * c[2];
  const cr = (c: [number, number, number]) => 0.5 * c[0] - 0.418688 * c[1] - 0.081312 * c[2];
  return Math.hypot(cb(a) - cb(b), cr(a) - cr(b));
}
/** 0 where the pixel is the keyed colour (clear), 1 where it is not: tolerance, then a softness over which it comes back. */
export function chromaAlpha(px: [number, number, number], key: [number, number, number], tol: number, soft: number): number {
  const d = chromaDistance(px, key);
  return soft <= 0 ? (d <= tol ? 0 : 1) : smooth((d - tol) / soft);
}

/** A clip's picture rectangle in the frame, as the layer shader will draw it: used for hit tests and the overlay's corner. */
export function cornerPos(corner: 'tl' | 'tr' | 'bl' | 'br', size: number): { x: number; y: number } {
  const m = 0.04 + size / 2;
  const x = 0.5 - m;
  return { x: corner === 'tl' || corner === 'bl' ? -x : x, y: corner === 'tl' || corner === 'tr' ? -(0.5 - m) : 0.5 - m };
}

// ---------------------------------------------------------------- the mix, as a plan
export interface Strand {
  kind: 'clip' | 'music' | 'voice';
  id: string;
  src: string;
  /** Timeline start (ms), source in (ms), the stretch of the source played (ms), the speed. */
  start: number;
  in: number;
  span: number;
  speed: number;
  /** Timeline length played (ms): span / speed, or a ramp's own. */
  len: number;
  /** Plays backwards (a reversed clip: the sound is read from a reversed copy). */
  rev?: boolean;
  /** A speed ramp's playback rate along the timeline: [timeline ms, rate] pairs (the sound pitched with it). */
  rate?: [number, number][];
  /** Gain automation: [timeline ms, gain] pairs, joined by straight lines. */
  gain: [number, number][];
}

/** Every sound in the project with its gain over time (volume, fades, the transition's crossfade, and the music's ducking). */
export function mixPlan(p: Project): Strand[] {
  const out: Strand[] = [];
  const total = place(p.main).reduce((m, x) => Math.max(m, x.start + x.len), 0);
  const pl = place(p.main);
  for (const x of pl) {
    const src = p.sources[x.clip.src];
    if (!src?.hasAudio) continue;
    const g: [number, number][] = [];
    const v = x.clip.volume;
    const next = pl[x.index + 1];
    // the clip's own fades (from and to black) take its sound with them, where no transition already does
    const cap = fadeCap(x.clip);
    const upIn = !x.tin && (x.clip.fade?.in ?? 0) > 0 ? Math.min(x.clip.fade!.in, cap) : 0;
    const downOut = !next?.tin && (x.clip.fade?.out ?? 0) > 0 ? Math.min(x.clip.fade!.out, cap) : 0;
    const fin = x.tin ? x.tin.len : upIn || 8;
    const fout = next?.tin ? next.tin.len : downOut || 8;
    g.push([x.start, x.tin || upIn ? 0 : v], [x.start + fin, v], [x.start + x.len - fout, v], [x.start + x.len, next?.tin || downOut ? 0 : v]);
    const ramp = (x.clip.tr.keys.speed ?? []) as SpeedKey[];
    // a ramp with its sound dropped plays none; a pitched one follows the speed (sampled every 100 ms of the clip's own time)
    if (ramp.length && x.clip.rampSound === 'drop') continue;
    const strand: Strand = { kind: 'clip', id: x.clip.id, src: x.clip.src, start: x.start, in: x.clip.in, span: x.clip.out - x.clip.in, speed: x.clip.speed, len: x.len, gain: g };
    if (x.clip.reverse) strand.rev = true;
    if (ramp.length) strand.rate = rateAlong(x.clip, x.start, x.len);
    out.push(strand);
  }
  const voiceSpans = p.voice.map((v) => ({ start: v.start, end: v.start + v.len }));
  const item = (kind: 'music' | 'voice', a: Project['music'][number]): Strand => {
    const g: [number, number][] = [[a.start, a.fadeIn > 0 ? 0 : a.gain]];
    if (a.fadeIn > 0) g.push([a.start + a.fadeIn, a.gain]);
    const end = Math.min(a.start + a.len, Math.max(total, a.start + a.len));
    if (kind === 'music' && p.duck > 0 && voiceSpans.length) {
      // sample the ducking curve every 50 ms so the plan is straight lines the audio graph can ramp along
      for (let t = a.start + a.fadeIn; t <= end; t += 50) {
        const fo = a.fadeOut > 0 && t > end - a.fadeOut ? (end - t) / a.fadeOut : 1;
        g.push([t, a.gain * duckGain(t, voiceSpans, p.duck) * fo]);
      }
    } else {
      g.push([end - a.fadeOut, a.gain]);
    }
    g.push([end, a.fadeOut > 0 ? 0 : g[g.length - 1]![1]]);
    return { kind, id: a.id, src: a.src, start: a.start, in: a.in, span: a.len, speed: 1, len: a.len, gain: g };
  };
  for (const a of p.music) out.push(item('music', a));
  for (const a of p.voice) out.push(item('voice', a));
  return out;
}

/** A plan's gain at timeline time t. */
export function gainAt(s: Strand, t: number): number {
  const g = s.gain;
  if (t <= g[0]![0]) return g[0]![1];
  for (let i = 0; i < g.length - 1; i++) {
    const [t0, v0] = g[i]!;
    const [t1, v1] = g[i + 1]!;
    if (t >= t0 && t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return g[g.length - 1]![1];
}

/** How long the whole piece plays, counting music and voice that run past the last clip: the sound is cut at the picture's end. */
export const pieceLength = (p: Project): number => place(p.main).reduce((m, x) => Math.max(m, x.start + x.len), 0);

/** The length of a clip, for words. */
export { clipLen };

/** A ramped clip's playback rate along the timeline, a point every 100 ms (the speed at that picture, times the clip's own). */
export function rateAlong(c: Clip, start: number, len: number): [number, number][] {
  const ramp = (c.tr.keys.speed ?? []) as SpeedKey[];
  const span = c.out - c.in;
  const out: [number, number][] = [];
  for (let t = 0; t <= len + 99; t += 100) {
    const tt = Math.min(t, len);
    const u = pictureAt(ramp, tt * c.speed, span);
    out.push([start + tt, speedAt(ramp, u) * c.speed]);
    if (t >= len) break;
  }
  return out;
}
/** The speed a clip plays at, `t` ms into it (its own speed times the ramp's there). */
export function speedNow(c: Clip, t: number): number {
  const ramp = (c.tr.keys.speed ?? []) as SpeedKey[];
  if (!ramp.length) return c.speed;
  return speedAt(ramp, pictureAt(ramp, t * c.speed, c.out - c.in)) * c.speed;
}
export { playTime as rampPlayTime };

/**
 * The frame-by-frame file to the timeline's exact length (NEXT ROUND, the export's last tenth of a second): the pictures are whole
 * frames and the sound whole packets of 1,024 samples (and the encoder adds a few at the start), so each track could run up to a frame
 * or a packet past the end. The last picture's duration is set so the pictures end at the timeline's end, and the sound's packets past
 * the end are dropped and the last one's duration cut (or stretched) to land on it. Pure on its numbers; the brain test proves it.
 */
export function exactLength(v: { dur: number }[], a: { dur: number }[], durMs: number, rate = 48_000): void {
  if (v.length) {
    const want = Math.round(durMs * 1000);
    const before = v.slice(0, -1).reduce((n, s) => n + s.dur, 0);
    v[v.length - 1]!.dur = Math.max(1, want - before);
  }
  if (a.length) {
    const want = Math.max(1, Math.round((durMs / 1000) * rate));
    let sum = 0;
    let i = 0;
    while (i < a.length && sum + a[i]!.dur < want) sum += a[i++]!.dur;
    if (i < a.length) {
      a.length = i + 1;
      a[i]!.dur = Math.max(1, want - sum);
    } else if (a.length) a[a.length - 1]!.dur += want - sum;
  }
}
