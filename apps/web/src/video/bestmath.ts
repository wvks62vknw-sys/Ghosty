/**
 * THE BEST CLIPS' scores (BRIEF-EDITOR-VIDEO-2), pure. A frame's score is its sharpness, its light, its motion and its variety,
 * never who is in it: the numbers come from grey pixels, a histogram and the motion between two frames, and nothing here looks for
 * a face. `histDistance` is SCENES' own, so "a new view" means what it means there.
 */
import { histDistance } from './scenes';

/** The variance of the four-neighbour Laplacian over the interior of a grey frame: a sharp picture has edges, a soft one has none. */
export function sharpness(g: Uint8Array, w: number, h: number): number {
  let s = 0;
  let q = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = 4 * g[i]! - g[i - 1]! - g[i + 1]! - g[i - w]! - g[i + w]!;
    s += l;
    q += l * l;
    n++;
  }
  const m = s / Math.max(1, n);
  return q / Math.max(1, n) - m * m;
}
/** 0 (a blur) to 1 (crisp): a soft curve over the Laplacian's variance. */
export const sharpScore = (variance: number): number => 1 - Math.exp(-Math.max(0, variance) / 80);

export interface Light {
  mean: number;
  p5: number;
  p95: number;
  /** The share of pixels at either end of the scale. */
  clipped: number;
}
export function lightOf(g: Uint8Array): Light {
  const bins = new Uint32Array(256);
  let sum = 0;
  for (const v of g) {
    bins[v]!++;
    sum += v;
  }
  const at = (share: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += bins[i]!;
      if (acc >= share * g.length) return i;
    }
    return 255;
  };
  return { mean: sum / Math.max(1, g.length), p5: at(0.05), p95: at(0.95), clipped: (bins[0]! + bins[1]! + bins[2]! + bins[253]! + bins[254]! + bins[255]!) / Math.max(1, g.length) };
}
/** What is wrong with the light, if anything. */
export const lightFault = (l: Light): '' | 'dark' | 'bright' => (l.mean < 35 ? 'dark' : l.mean > 225 ? 'bright' : '');
/** 0 to 1: a mean in the middle of the scale scores well, a spread histogram a little better, a clipped one worse. */
export function lightScore(l: Light): number {
  const mid = l.mean < 35 ? l.mean / 35 : l.mean > 215 ? Math.max(0, (255 - l.mean) / 40) : 1;
  const spread = Math.min(1, (l.p95 - l.p5) / 120);
  return Math.max(0, mid * (0.75 + 0.25 * spread) - l.clipped * 0.5);
}

/**
 * Motion as the steady pass measures it: the picture's widths moved a second. A little is good (it is alive), none is a still, and
 * a fast sweep is a smear. 1 for a gentle move, a little less for a still, falling to 0 by 1.8 widths a second.
 */
export function motionScore(widthsPerSecond: number | null): number {
  if (widthsPerSecond === null) return 0.8;
  const v = Math.abs(widthsPerSecond);
  if (v < 0.1) return 0.7 + 3 * v;
  if (v <= 0.6) return 1;
  return Math.max(0, 1 - (v - 0.6) / 1.2);
}

/** How new a picture is against those already chosen: the least SCENES distance to any of them (1 when none is chosen). */
export function variety(h: Float32Array, chosen: Float32Array[]): number {
  if (!chosen.length) return 1;
  let d = 1;
  for (const c of chosen) d = Math.min(d, histDistance(h, c));
  return d;
}

export interface Unit {
  /** The clip it is a stretch of (the project's own clip id) and its stretch of the source, ms. */
  clip: string;
  src: string;
  from: number;
  to: number;
  sharp: number;
  light: number;
  motion: number;
  /** A colour histogram of its middle. */
  hist: Float32Array;
  fault: '' | 'blurred' | 'dark' | 'bright';
  /** Whether the clip has any sound. */
  sound: boolean;
}
export const quality = (u: Pick<Unit, 'sharp' | 'light' | 'motion'>): number => 0.5 * u.sharp + 0.3 * u.light + 0.2 * u.motion;

export interface Pick_ {
  unit: Unit;
  /** The stretch picked (source ms): all of the unit, or the best part of it when the target is nearly full. */
  from: number;
  to: number;
  variety: number;
  score: number;
}

/**
 * The pick for a target length (ms): units with a fault are left out; the rest are taken best first, each scored by its quality
 * and how new it looks against what is already chosen, until the target is met; the last is cut to fit. `len` is a unit's playing
 * length (its stretch over the clip's speed). Returns the picks in the order of the clips, and the faulty units and the good ones
 * the target had no room for.
 */
export function choose(units: Unit[], target: number, len: (u: Unit) => number = (u) => u.to - u.from): { picks: Pick_[]; left: { unit: Unit; why: 'blurred' | 'dark' | 'bright' | 'full' }[]; short: number } {
  const good = units.filter((u) => !u.fault);
  const chosen: Pick_[] = [];
  const hists: Float32Array[] = [];
  let have = 0;
  const pool = [...good];
  while (pool.length && target - have >= 500) {
    let bi = 0;
    let bs = -1;
    const vs = pool.map((u) => variety(u.hist, hists));
    pool.forEach((u, i) => {
      const s = quality(u) * (0.65 + 0.35 * Math.min(1, vs[i]! / 0.3));
      if (s > bs) {
        bs = s;
        bi = i;
      }
    });
    const u = pool.splice(bi, 1)[0]!;
    const l = len(u);
    const room = target - have;
    const k = l / Math.max(1, u.to - u.from);
    // a last pick longer than the room is cut to it, from the start of the unit
    const take = Math.min(l, room);
    chosen.push({ unit: u, from: u.from, to: Math.round(u.from + take / k), variety: vs[bi]!, score: bs });
    hists.push(u.hist);
    have += take;
  }
  const order = (p: { unit: Unit }) => units.indexOf(p.unit);
  chosen.sort((a, b) => order(a) - order(b));
  const picked = new Set(chosen.map((p) => p.unit));
  const left: { unit: Unit; why: 'blurred' | 'dark' | 'bright' | 'full' }[] = [];
  for (const u of units) {
    if (picked.has(u)) continue;
    left.push({ unit: u, why: u.fault ? u.fault : 'full' });
  }
  return { picks: chosen, left, short: Math.max(0, target - have) };
}

/** The reason in one line, in his voice. */
export function reason(p: { unit: Unit; variety: number }, first: boolean): string {
  const u = p.unit;
  return `${u.sharp >= 0.6 ? 'sharp' : 'a little soft'}, ${u.light >= 0.6 ? 'well lit' : 'dimly lit'}, ${first || p.variety > 0.25 ? 'a new view' : 'like another pick'}`;
}
export function leftReason(l: { unit: Unit; why: string }): string {
  if (l.why === 'blurred') return 'blurred: left out';
  if (l.why === 'dark') return l.unit.sound ? 'too dark: left out' : 'nothing to choose from here: no light and no sound';
  if (l.why === 'bright') return 'too bright: left out';
  return 'good, but the length is full';
}
