/**
 * STEADY (BRIEF-EDITOR-VIDEO-2): the clip's camera path measured between neighbouring frames (sampled at the project's rate, grey,
 * about 160 px wide, through the same frame reader SCENES uses) by the worker's block matching, smoothed, and written into the
 * clip's recipe as keys (steadymath.rekey). A clip whose motion the match cannot follow is said so once and left as it was.
 */
import { flatTransform, shape, type Clip, type Project } from './model';
import { sayError } from '../ui/hisWords';
import { Crunch, Frames, playerLag } from './crunch';
import { accumulate, cannotFollow, correct, losesPercent, rekey, type Motion, type SteadyRecord } from './steadymath';

/** The longest stretch steadied at once: the keys are one for each frame, and the history keeps sixty copies of them. */
export const STEADY_MAX_MS = 180_000;

export interface SteadyRun {
  /** Frames done, of how many, and the seconds left the pace so far says. */
  onProgress?(done: number, of: number, left: number): void;
  cancel?: { cancelled: boolean };
}
export type SteadyResult = { ok: true; clip: Clip; ms: number; frames: number; clipMs: number; loses: number; window: number; readMs: number; workMs: number; lagMs: number } | { ok: false; why: string; ms: number; cancelled?: boolean };

/** "Steadying… about 12 s": a first guess before the pace is known (the frames are read and matched at about 30 a second). */
export const steadyGuess = (clipMs: number, fps: number): number => Math.max(2, Math.round((clipMs / 1000) * fps * 0.03));

/** How much of the canvas the picture spans (gpu.ts's own fit), across and up and down. */
export function fitOf(p: Pick<Project, 'aspect' | 'w' | 'h'>, c: Clip, srcW: number, srcH: number): { fw: number; fh: number } {
  const s = shape(p);
  const A = s.w / s.h;
  const ca = (c.crop.w * srcW) / Math.max(1, c.crop.h * srcH);
  const wide = c.fit === 'fit' ? ca > A : ca <= A;
  return { fw: wide ? 1 : ca / A, fh: wide ? A / ca : 1 };
}

export async function steadyClip(p: Project, c: Clip, strength: number, blob: Blob | null, feeder: Parameters<typeof Frames.open>[1], crunch: Crunch, run: SteadyRun = {}): Promise<SteadyResult> {
  const t0 = performance.now();
  const src = p.sources[c.src];
  if (!src) return { ok: false, why: 'I can’t find that clip’s picture.', ms: 0 };
  const fps = p.fps || 30;
  const step = 1000 / fps;
  const span = c.out - c.in;
  const n = Math.max(2, Math.floor(span / step) + 1);
  let frames: Frames;
  try {
    frames = await Frames.open(blob, feeder, c.src);
  } catch {
    return { ok: false, why: 'I can’t read that clip’s picture, so I can’t steady it.', ms: performance.now() - t0 };
  }
  let lag = 0;
  try {
    lag = Math.round(await playerLag(frames, c.in, c.out));
  } catch {
    lag = 0;
  }
  const motions: Motion[] = [];
  const fly = new Set<Promise<void>>();
  let light = 0;
  let lights = 0;
  let done = 0;
  let readMs = 0;
  let workMs = 0;
  try {
    for (let i = 0; i < n; i++) {
      if (run.cancel?.cancelled) return { ok: false, why: 'Stopped. The clip is as it was.', ms: performance.now() - t0, cancelled: true };
      const r0 = performance.now();
      const g = await frames.at(c.in + i * step);
      readMs += performance.now() - r0;
      if (i % 5 === 0) {
        let s = 0;
        for (let k = 0; k < g.grey.length; k += 7) s += g.grey[k]!;
        light += s / Math.ceil(g.grey.length / 7);
        lights++;
      }
      const at = i;
      const job: Promise<void> = crunch.ask({ op: 'frame', grey: g.grey, w: g.w, h: g.h, reset: i === 0 }, [g.grey.buffer]).then((r) => {
        if (at > 0) motions[at - 1] = r.motion ?? { rot: 0, tx: 0, ty: 0, s: 1, used: 0, of: 0, edge: 0, ok: false };
        workMs += r.ms;
        done++;
      }).finally(() => fly.delete(job));
      fly.add(job);
      // the worker keeps up with the reading: never more than eight frames waiting for it
      while (fly.size > 8) await Promise.race(fly);
      if (i % 6 === 0 || i === n - 1) {
        const per = (performance.now() - t0) / (i + 1);
        run.onProgress?.(i + 1, n, (per * (n - i - 1)) / 1000);
      }
    }
    await Promise.all(fly);
  } catch (e) {
    return { ok: false, why: crunch.dead || sayError(e, 'steady it'), ms: performance.now() - t0 };
  } finally {
    frames.close();
  }
  const why = cannotFollow(motions, lights ? light / lights : 0);
  if (why) return { ok: false, why, ms: performance.now() - t0 };
  const path = accumulate(motions);
  const fit = fitOf(p, c, src.w, src.h);
  const old = c.steady;
  const base = old ? old.base : { x: c.tr.x, y: c.tr.y, rot: c.tr.rot, scale: c.tr.scale };
  const rec: SteadyRecord = {
    strength,
    fps,
    t0: c.in,
    lag,
    step,
    w: frames.w,
    h: frames.h,
    fw: fit.fw,
    fh: fit.fh,
    path: path.flatMap((q) => [Math.round(q.rot * 1000) / 1000, Math.round(q.tx * 100) / 100, Math.round(q.ty * 100) / 100]),
    base,
    zoom: 1,
    loses: 0,
    window: 0,
  };
  const out = structuredClone(c);
  out.tr = { ...flatTransform(), ...structuredClone(c.tr), keys: structuredClone(c.tr.keys) };
  out.steady = rec;
  rekey(out);
  return { ok: true, clip: out, ms: performance.now() - t0, frames: n, clipMs: span, loses: out.steady!.loses, window: out.steady!.window, readMs, workMs, lagMs: lag };
}

/** The same record at another strength (the slider): the corrections are made again from the stored path, no frames read. */
export function restrength(c: Clip, strength: number): Clip {
  const out = structuredClone(c);
  if (!out.steady) return out;
  out.steady.strength = strength;
  rekey(out);
  return out;
}
/** What a strength would cost at the edges, said ("loses 8% at the edges"), without changing the clip. */
export function costWords(c: Clip, strength: number): string {
  if (!c.steady) return '';
  const { zoom } = correct({ ...c.steady, strength });
  const l = losesPercent(zoom);
  return l <= 0 ? 'loses nothing at the edges' : `loses ${l}% at the edges`;
}
