/**
 * ON THE BEAT (BRIEF-EDITOR-VIDEO-2): the music's tempo and beats found on the phone (the worker does the spectrum; beatmath.ts is
 * the arithmetic), and SNAP TO THE BEAT, which moves each cut to its nearest beat within 400 ms by trimming the clip before it
 * longer or shorter and the clip after it by the same (the video is as long as it was).
 */
import { place, type Project } from './model';
import { nearestBeats, type Move, type Tempo } from './beatmath';
import type { Crunch } from './crunch';

export const RATE = 11_025;
export const SNAP_MS = 400;

export interface Beats {
  tempo: Tempo;
  /** Ms of the music's own sound. */
  beats: number[];
  /** What it took, ms, and how long the music is, ms. */
  ms: number;
  musicMs: number;
}

/** The sound mixed down to mono at 11 kHz (the browser's own resampler), for the spectrum. */
export async function monoOf(buf: AudioBuffer): Promise<Float32Array> {
  const len = Math.max(1, Math.ceil(buf.duration * RATE));
  const ctx = new OfflineAudioContext(1, len, RATE);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

export async function findBeats(buf: AudioBuffer, crunch: Crunch): Promise<Beats | null> {
  const t0 = performance.now();
  const mono = await monoOf(buf);
  const r = await crunch.ask({ op: 'beat', mono, rate: RATE }, [mono.buffer]);
  if (!r.tempo) return null;
  return { tempo: r.tempo, beats: r.beats ?? [], ms: performance.now() - t0, musicMs: buf.duration * 1000 };
}

/** The beats on the timeline: the music item's start, less what it skips at its in point. */
export const onTimeline = (b: Beats, item: { start: number; in: number; len: number }): number[] => b.beats.map((t) => item.start + t - item.in).filter((t) => t >= item.start - 1 && t <= item.start + item.len);

/** The cuts of the main track: where each clip after the first begins (the middle of a transition that brings it in). */
export function cutsOf(p: Project): number[] {
  return place(p.main).slice(1).map((x) => Math.round(x.start + (x.tin ? x.tin.len / 2 : 0)));
}

export interface Snapped {
  p: Project;
  moved: Move[];
  biggest: number;
  /** Cuts that wanted to move but had no picture to move into. */
  stuck: number;
}
/** Every cut to its nearest beat within 400 ms. Moving the cut at the start of clip i+1 by d adds d to clip i and takes d from clip i+1. */
export function snapToBeats(p: Project, beats: number[], maxMs = SNAP_MS): Snapped {
  const found = nearestBeats(cutsOf(p), beats, maxMs);
  const q = structuredClone(p);
  const moved: Move[] = [];
  let stuck = 0;
  let biggest = 0;
  for (const m of found.moves) {
    const a = q.main[m.i]!;
    const b = q.main[m.i + 1]!;
    const d = m.to - m.from;
    // earlier clip lengthens (its out moves on) or shortens; later clip loses or gains the same at its in
    const srcA = q.sources[a.src];
    const srcB = q.sources[b.src];
    const newAOut = a.reverse ? a.out : a.out + d * a.speed;
    const newAIn = a.reverse ? a.in - d * a.speed : a.in;
    const newBIn = b.reverse ? b.in : b.in + d * b.speed;
    const newBOut = b.reverse ? b.out - d * b.speed : b.out;
    const okA = newAOut <= (srcA?.dur ?? Infinity) && newAIn >= 0 && newAOut - newAIn >= 200;
    const okB = newBIn >= 0 && newBOut <= (srcB?.dur ?? Infinity) && newBOut - newBIn >= 200;
    if (!okA || !okB || (a.tr.keys.speed?.length ?? 0) || (b.tr.keys.speed?.length ?? 0)) {
      stuck++;
      continue;
    }
    a.out = Math.round(newAOut);
    a.in = Math.round(newAIn);
    b.in = Math.round(newBIn);
    b.out = Math.round(newBOut);
    moved.push(m);
    biggest = Math.max(biggest, Math.abs(d));
  }
  return { p: q, moved, biggest: Math.round(biggest), stuck };
}

export const movedWords = (n: number, biggest: number): string => `${n} cut${n === 1 ? '' : 's'} moved to the beat, the biggest by ${Math.round(biggest)} ms`;
