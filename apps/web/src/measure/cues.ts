/**
 * Things of known size that MEASURE finds in a photo by itself, and how they correct the depth
 * model's scale (pure, unit-tested in apps/edge/test/measure.test.mjs).
 *
 * Each cue says: "by the depth map this thing is X mm; things like it are usually Y mm, give or
 * take σ" — so the depth map should be scaled by Y / X, with that much doubt. The cues and the
 * depth model's own guess (scale 1, doubt `DEPTH_STATS.logSd`) are combined in log space,
 * weighted by 1/σ² (the usual way to join independent measurements), after any cue that
 * disagrees wildly with the rest is set aside (a toy car, a poster of a person) and named.
 *
 * The everyday sizes are the middle of the usual range, and σ says how much they vary: a sheet of
 * A4 is exact (±3 % for finding its corners), a fridge or a person is a weak cue (people vary
 * ±10 % in height and are rarely standing straight to the camera).
 */
import { DEPTH_STATS, levelOf, type Level } from './depth3d';

export interface KnownSize {
  /** Which side of the thing's box is the reliable one. */
  side: 'h' | 'w';
  mm: number;
  /** Log-scale spread (0.1 ≈ ±10 %). */
  sigma: number;
  /** In words, for "which cues were used". */
  name: string;
  /** Weak cues are only used when nothing better is in the picture. */
  weak?: boolean;
}

/**
 * The detector's labels (COCO's 80 everyday things) that have a usual size worth using. Things
 * that come in any size (tables, beds, TVs, sofas' widths) are left out on purpose.
 */
export const KNOWN: Record<string, KnownSize> = {
  person: { side: 'h', mm: 1700, sigma: 0.1, name: 'a person (average height)', weak: true },
  'cell phone': { side: 'h', mm: 147, sigma: 0.08, name: 'a phone (about 15 cm)' },
  laptop: { side: 'w', mm: 330, sigma: 0.12, name: 'a laptop (about 33 cm wide)' },
  keyboard: { side: 'w', mm: 440, sigma: 0.12, name: 'a keyboard (about 44 cm)' },
  mouse: { side: 'w', mm: 62, sigma: 0.15, name: 'a computer mouse' },
  microwave: { side: 'w', mm: 480, sigma: 0.1, name: 'a microwave (about 48 cm wide)' },
  refrigerator: { side: 'h', mm: 1800, sigma: 0.12, name: 'a fridge (about 1.8 m)', weak: true },
  toilet: { side: 'h', mm: 780, sigma: 0.1, name: 'a toilet (about 78 cm high)' },
  chair: { side: 'h', mm: 850, sigma: 0.15, name: 'a chair (about 85 cm high)', weak: true },
  cup: { side: 'h', mm: 95, sigma: 0.15, name: 'a mug (about 9.5 cm)' },
  bottle: { side: 'h', mm: 240, sigma: 0.3, name: 'a bottle', weak: true },
  book: { side: 'h', mm: 220, sigma: 0.2, name: 'a book', weak: true },
  'sports ball': { side: 'w', mm: 220, sigma: 0.2, name: 'a football', weak: true },
  car: { side: 'h', mm: 1500, sigma: 0.1, name: 'a car (about 1.5 m high)' },
  'stop sign': { side: 'w', mm: 750, sigma: 0.06, name: 'a stop sign (75 cm)' },
  'fire hydrant': { side: 'h', mm: 750, sigma: 0.2, name: 'a fire hydrant', weak: true },
  bicycle: { side: 'h', mm: 1000, sigma: 0.12, name: 'a bicycle (about 1 m high)' },
};

/** A4 and US Letter, the sheets MEASURE looks for by itself (mm, long side first). */
export const SHEETS = [
  { name: 'an A4 sheet', long: 297, short: 210 },
  { name: 'a US Letter sheet', long: 279.4, short: 215.9 },
] as const;

export interface Cue {
  /** In words: "a person (average height)". */
  name: string;
  /** The factor the depth map should be multiplied by, by this cue. */
  scale: number;
  sigma: number;
  weak?: boolean;
}

/**
 * A detected thing as a cue: its box's reliable side in picture pixels, at the depth `zM` (metres,
 * the median of the thing's own pixels), is `px × z / f` long by the depth map. A box cut off by
 * the picture's edge says nothing about that side, and a person must be standing (taller than
 * wide by 1.8 times) to count. Null when the label has no usual size or the box cannot be trusted.
 */
export function cueFromBox(label: string, box: { x: number; y: number; w: number; h: number }, zM: number, f: number, frame: { w: number; h: number }): Cue | null {
  const k = KNOWN[label.toLowerCase()];
  if (!k || !(zM > 0) || !(f > 0)) return null;
  const edge = 3;
  const cutX = box.x <= edge || box.x + box.w >= frame.w - edge;
  const cutY = box.y <= edge || box.y + box.h >= frame.h - edge;
  if ((k.side === 'h' && cutY) || (k.side === 'w' && cutX)) return null;
  if (label.toLowerCase() === 'person' && box.h < 1.8 * box.w) return null;
  const px = k.side === 'h' ? box.h : box.w;
  if (px < 12) return null;
  const mm = ((px * zM) / f) * 1000;
  // the box is a loose fit (a few per cent) on top of how much the thing itself varies
  return { name: k.name, scale: k.mm / mm, sigma: Math.hypot(k.sigma, 0.05), weak: k.weak };
}

/**
 * A sheet of paper as a cue: its four corners' 3-D side lengths (mm, by the depth map). It counts
 * only when its shape is a sheet's (long/short within 7 % of A4's or Letter's) — a white
 * rectangle of the wrong shape is a picture frame or a window, not a sheet.
 */
export function cueFromSheet(sidesMm: { long: number; short: number }): Cue | null {
  const { long, short } = sidesMm;
  if (!(long > 0 && short > 0)) return null;
  const ratio = long / short;
  for (const s of SHEETS) {
    if (Math.abs(ratio / (s.long / s.short) - 1) <= 0.07) {
      const scale = Math.sqrt((s.long / long) * (s.short / short));
      return { name: s.name, scale, sigma: 0.04 };
    }
  }
  return null;
}

export interface Fused {
  /** Multiply the depth by this. */
  scale: number;
  /** The doubt that is left in the scale (log). */
  sigma: number;
  level: Level;
  used: string[];
  /** Cues set aside, with why, in words. */
  ignored: string[];
}

/**
 * The depth model's own scale (1, doubt `prior`) joined with the cues. A cue more than 2.5× off
 * the depth's own guess, or more than three of its σ from the weighted middle of the strong cues,
 * is set aside; weak cues are used only when no strong cue is there.
 */
export function fuseScale(cues: Cue[], prior = DEPTH_STATS.logSd): Fused {
  const ignored: string[] = [];
  let ok = cues.filter((c) => {
    if (!(c.scale > 0) || Math.abs(Math.log(c.scale)) > Math.log(2.5)) {
      ignored.push(`${c.name}: the wrong size for one (a toy or a picture of one?)`);
      return false;
    }
    return true;
  });
  const strong = ok.filter((c) => !c.weak);
  if (strong.length) {
    for (const c of ok) if (c.weak) ignored.push(`${c.name}: not needed (a better cue is there)`);
    ok = strong;
  }
  if (ok.length >= 2) {
    // the weighted median of the cues, then anything far from it out
    const sorted = [...ok].sort((a, b) => a.scale - b.scale);
    const total = sorted.reduce((s, c) => s + 1 / c.sigma ** 2, 0);
    let acc = 0;
    let mid = sorted[0]!.scale;
    for (const c of sorted) {
      acc += 1 / c.sigma ** 2;
      if (acc >= total / 2) {
        mid = c.scale;
        break;
      }
    }
    ok = ok.filter((c) => {
      const off = Math.abs(Math.log(c.scale / mid)) / c.sigma;
      if (off > 3) ignored.push(`${c.name}: disagrees with the others`);
      return off <= 3;
    });
  }
  let wSum = 1 / prior ** 2;
  let lSum = 0;
  for (const c of ok) {
    wSum += 1 / c.sigma ** 2;
    lSum += Math.log(c.scale) / c.sigma ** 2;
  }
  const sigma = 1 / Math.sqrt(wSum);
  return { scale: Math.exp(lSum / wSum), sigma, level: levelOf(sigma), used: ok.map((c) => c.name), ignored };
}

/** The cues used, in one plain line: "depth from the photo, corrected by an A4 sheet and a mug". */
export function cuesLine(f: Pick<Fused, 'used'>, camera: string): string {
  const by = f.used.length ? `, corrected by ${f.used.length > 1 ? `${f.used.slice(0, -1).join(', ')} and ${f.used[f.used.length - 1]}` : f.used[0]}` : ' (no known-size things seen: an estimate)';
  return `depth from the photo${by}; camera: ${camera}`;
}
