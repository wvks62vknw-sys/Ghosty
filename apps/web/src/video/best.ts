/**
 * THE BEST CLIPS (BRIEF-EDITOR-VIDEO-2): every clip (a long one in stretches of about three seconds) scored on the phone: its
 * sharpness (the Laplacian's variance of the grey sample), its light (the histogram's spread, not clipped at either end), its motion
 * (the steady pass's own block matching: a little is good, a blur is not) and its variety (SCENES' histogram distance from what is
 * already chosen); and, only when the namer is already on this phone, a word for what is in a pick. Never who is in it. The clips
 * never leave the phone. The pick and the cut built from it are in bestmath.ts and here (pure).
 */
import { uid, type Clip, type Project } from './model';
import { histogram } from './scenes';
import { lightFault, lightOf, lightScore, motionScore, sharpScore, type Pick_, type Unit } from './bestmath';
import { Crunch, Frames } from './crunch';
import type { Feeder } from './preview';
import { rekey } from './steadymath';

export const SAMPLE_MS = 250;
export const UNIT_MS = 3000;

export interface Scored {
  units: Unit[];
  /** Total time and the clips scored. */
  ms: number;
  clips: number;
  /** One representative frame per unit (grey 32 × 18 of the middle), for the namer's word. */
  frames: Map<Unit, Uint8ClampedArray>;
}
export interface ScoreRun {
  onProgress?(clip: number, of: number, left: number): void;
  cancel?: { cancelled: boolean };
}

export async function scoreClips(p: Project, blobOf: (src: string) => Promise<Blob | null>, feeder: Feeder, crunch: Crunch, run: ScoreRun = {}): Promise<Scored> {
  const t0 = performance.now();
  const units: Unit[] = [];
  const frames = new Map<Unit, Uint8ClampedArray>();
  let ci = 0;
  for (const c of p.main) {
    if (run.cancel?.cancelled) break;
    const src = p.sources[c.src];
    const fr = await Frames.open(await blobOf(c.src), feeder, c.src);
    try {
      const n = Math.max(1, Math.floor((c.out - c.in) / SAMPLE_MS));
      const samples: { sharp: number; light: ReturnType<typeof lightOf>; motion: number | null; hist: Float32Array; small: Uint8ClampedArray }[] = [];
      for (let i = 0; i < n; i++) {
        if (run.cancel?.cancelled) break;
        const g = await fr.at(c.in + i * SAMPLE_MS + Math.min(SAMPLE_MS / 2, (c.out - c.in) / 2));
        const small = new Uint8ClampedArray(g.small);
        const r = await crunch.ask({ op: 'frame', grey: g.grey, w: g.w, h: g.h, reset: i === 0, stats: true }, [g.grey.buffer]);
        // the picture's widths a second: the block matching between samples a quarter of a second apart
        const m = r.motion && r.motion.ok ? (Math.hypot(r.motion.tx, r.motion.ty) / g.w) / (SAMPLE_MS / 1000) : null;
        samples.push({ sharp: r.sharp ?? 0, light: r.light!, motion: m, hist: histogram(small), small });
        const per = (performance.now() - t0) / Math.max(1, ci + (i + 1) / n);
        run.onProgress?.(ci + 1, p.main.length, (per * (p.main.length - ci - (i + 1) / n)) / 1000);
      }
      const count = Math.max(1, Math.round(((c.out - c.in) / UNIT_MS)));
      const per = Math.max(1, Math.floor(samples.length / count));
      for (let u = 0; u < count; u++) {
        const part = samples.slice(u * per, u === count - 1 ? samples.length : (u + 1) * per);
        if (!part.length) continue;
        const mean = (f: (s: (typeof part)[number]) => number) => part.reduce((a, s) => a + f(s), 0) / part.length;
        const from = Math.round(c.in + (u * (c.out - c.in)) / count);
        const to = Math.round(c.in + ((u + 1) * (c.out - c.in)) / count);
        const light = { mean: mean((s) => s.light.mean), p5: mean((s) => s.light.p5), p95: mean((s) => s.light.p95), clipped: mean((s) => s.light.clipped) };
        const sharp = sharpScore(mean((s) => s.sharp));
        const lf = lightFault(light);
        const motions = part.map((s) => s.motion).filter((m): m is number => m !== null);
        const mid = part[Math.floor(part.length / 2)]!;
        const unit: Unit = {
          clip: c.id, src: c.src, from, to, sharp, light: lightScore(light),
          motion: motionScore(motions.length ? motions.reduce((a, b) => a + b, 0) / motions.length : null),
          hist: mid.hist, fault: lf ? lf : sharp < 0.15 ? 'blurred' : '', sound: !!src?.hasAudio,
        };
        units.push(unit);
        frames.set(unit, mid.small);
      }
    } finally {
      fr.close();
    }
    ci++;
  }
  return { units, ms: performance.now() - t0, clips: ci, frames };
}

/** A unit's playing length on the timeline: its stretch of the clip over the clip's speed. */
export const unitLen = (p: Project) => (u: Unit): number => {
  const c = p.main.find((x) => x.id === u.clip);
  return (u.to - u.from) / (c?.speed ?? 1);
};

/** What each tick means: one stretch of one of the clips. */
export interface Tick {
  clip: string;
  from: number;
  to: number;
}

/**
 * The project built from the ticks: a copy of each clip's recipe (its grade, its speed, its crop and the rest) over the stretch
 * picked, one after another with plain cuts. The originals are untouched; the titles, pictures and subtitles, whose times would no
 * longer fit, are cleared (UNDO brings everything back). With a beat (the period in ms), each pick is made a whole number of
 * beats long where its clip has the picture, and the music starts on its first beat.
 */
export function cutFromTicks(p: Project, ticks: Tick[], beat?: { period: number; first: number }): Project | null {
  const main: Clip[] = [];
  for (const t of ticks) {
    const base = p.main.find((c) => c.id === t.clip);
    if (!base) continue;
    const c = structuredClone(base);
    c.id = uid();
    c.in = t.from;
    c.out = t.to;
    if (beat && base.speed > 0) {
      const beats = Math.max(2, Math.round((t.to - t.from) / base.speed / beat.period));
      const want = Math.round((beats * beat.period) * base.speed);
      const src = p.sources[base.src];
      c.out = Math.min(src?.dur ?? t.to + want, t.from + want);
      if (c.out - c.in < want * 0.6) c.in = Math.max(0, c.out - want);
    }
    c.next = { kind: 'cut', len: 0 };
    if (c.steady) rekey(c);
    main.push(c);
  }
  if (!main.length) return null;
  const q = structuredClone(p);
  q.main = main;
  q.overlays = [];
  q.subs = [];
  if (beat && q.music[0]) {
    q.music[0].in = Math.max(0, Math.round(beat.first));
    q.music[0].start = 0;
  }
  q.playhead = 0;
  return q;
}

/** The namer's word for a frame, only where it is already on this phone (offline/eyes.ts says so); null otherwise, never blocking the pick. */
export async function nameWords(frames: Uint8ClampedArray[], kept: boolean): Promise<(string | null)[]> {
  if (!kept) return frames.map(() => null);
  try {
    const { namer } = await import('../vision/clip');
    await namer.load(() => undefined);
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 18;
    const g = cv.getContext('2d')!;
    const out: (string | null)[] = [];
    for (const f of frames) {
      g.putImageData(new ImageData(new Uint8ClampedArray(f), 32, 18), 0, 0);
      const r = await namer.name(cv, { w: 32, h: 18 }, undefined, 1);
      out.push(r?.names[0]?.label ?? null);
    }
    namer.release();
    return out;
  } catch {
    return frames.map(() => null);
  }
}

export type { Pick_ };
