/**
 * AUTO's whole first step for one picture, in the browser: the depth model's map (measure/depth.ts),
 * corrected for the camera (EXIF, measure/exif.ts) and for real photos, then checked against the
 * things of known size the detector finds and a sheet of paper if one is lying in view
 * (measure/cues.ts). Shared by the Lens's MEASURE and the planner's FROM PHOTO; the arithmetic is in
 * the pure files, tested in apps/edge/test/measure.test.mjs.
 */
import { fromMediaPipe, type Detection } from '../vision/boxes';
import { detector, nextStamp, type Progress } from '../vision/models';
import { quadArea, toGray, type Quad } from '../scan/page';
import { cueFromBox, cueFromSheet, findSheets, fuseScale, sheetLooksPlain, SHEETS, type Cue, type Fused } from './cues';
import { depthModel } from './depth';
import { depthAt, dist3, metricDepth, pointAt, rescaleDepth, sceneProblem, type DepthMap } from './depth3d';
import { intrinsicsFor, type Exif, type Intrinsics } from './exif';

export interface Scaled {
  /** The depth map in metres, corrected by the cues. */
  D: DepthMap;
  /** The same before the cues (for cues of its own a caller adds, like the phone's height). */
  D0: DepthMap;
  K: Intrinsics;
  fused: Fused;
  cues: Cue[];
  dets: Detection[];
  /** How long the depth model took, ms. */
  ms: number;
  /** The picture's colours at the depth map's size (RGBA), for finding a tapped thing's edges. */
  rgb: Uint8ClampedArray | null;
  /** A plain light sheet of A4/Letter shape in view: its corners (picture pixels) and its 3-D sides (mm, before the cues). */
  sheet: { quad: Quad; long: number; short: number } | null;
  /** Why no sheet was taken, in words (for the state a test reads). */
  sheetWhy: string;
  /** Not what AUTO is for: outdoors / far away, or too close (null when fine). */
  scene: 'outdoors' | 'close' | null;
}

/** The cues again, the sheet left out (the tapped thing is the sheet) or trusted (the owner said it is one). */
export function refuse(s: Pick<Scaled, 'cues' | 'sheet' | 'D0'>, sheet: 'out' | 'confirmed'): { fused: Fused; D: DepthMap } {
  const others = s.cues.filter((c) => !SHEETS.some((sh) => sh.name === c.name));
  const sc = s.sheet && sheet === 'confirmed' ? cueFromSheet({ long: s.sheet.long, short: s.sheet.short }, true) : null;
  const fused = fuseScale(sc ? [...others, sc] : others);
  return { fused, D: rescaleDepth(s.D0, fused.scale) };
}

/** The median depth over the middle half of a box (the thing itself, not what is round it). */
export function boxDepth(D: DepthMap, size: { w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const zs: number[] = [];
  for (let fy = 0.3; fy <= 0.71; fy += 0.1) for (let fx = 0.3; fx <= 0.71; fx += 0.1) zs.push(depthAt(D, size, { x: b.x + b.w * fx, y: b.y + b.h * fy }, 1));
  zs.sort((a, c) => a - c);
  return zs[zs.length >> 1] ?? 0;
}

/**
 * Depth for a picture, in metres, with every scale cue in view. `extra(D0, K)` may add cues of its
 * own (the planner adds the phone's height above the floor). `alive()` false stops it early
 * (a new picture came): it then throws "superseded".
 */
export async function scalePhoto(c: HTMLCanvasElement, exif: Exif | null, progress: Progress, opts: { alive?: () => boolean; extra?: (D0: DepthMap, K: Intrinsics) => Cue[] } = {}): Promise<Scaled> {
  const alive = opts.alive ?? (() => true);
  const check = () => {
    if (!alive()) throw new Error('superseded');
  };
  const size = { w: c.width, h: c.height };
  const K = intrinsicsFor(size, exif);
  await depthModel.load(progress);
  check();
  progress('working out distances in the photo (about half a minute)…');
  const raw = await depthModel.run(c, size);
  check();
  const D0 = metricDepth(raw.data, raw.w, raw.h, K, size);
  const cues: Cue[] = [];
  let dets: Detection[] = [];
  try {
    const d = await detector.get(() => undefined);
    check();
    dets = fromMediaPipe(d.detectForVideo(c, nextStamp(performance.now())));
  } catch (e) {
    if ((e as Error)?.message === 'superseded') throw e;
    dets = [];
  }
  for (const det of dets) {
    const cue = cueFromBox(det.label, det.box, boxDepth(D0, size, det.box), K.f, size);
    if (cue) cues.push(cue);
  }
  let rgb: Uint8ClampedArray | null = null;
  const small = document.createElement('canvas');
  small.width = D0.w;
  small.height = D0.h;
  const g = small.getContext('2d', { willReadFrequently: true });
  if (g) {
    g.drawImage(c, 0, 0, D0.w, D0.h);
    rgb = g.getImageData(0, 0, D0.w, D0.h).data;
  }
  // a sheet of paper: plain, near-white, much smaller than the picture, of a sheet's shape in 3-D
  let sheet: Scaled['sheet'] = null;
  let sheetWhy = 'no small light rectangle';
  // light rectangles, found on a small copy (256 px), then each checked: plain, near-white, a sheet's shape in 3-D
  const k = Math.min(1, 256 / Math.max(size.w, size.h));
  const tw = Math.max(1, Math.round(size.w * k));
  const th = Math.max(1, Math.round(size.h * k));
  const tiny = document.createElement('canvas');
  tiny.width = tw;
  tiny.height = th;
  const tg = tiny.getContext('2d', { willReadFrequently: true });
  const quads = tg ? (tg.drawImage(c, 0, 0, tw, th), findSheets(toGray(tg.getImageData(0, 0, tw, th).data, tw, th), tw, th)) : [];
  for (const small of quads.slice(0, 4)) {
    const q = small.map((p) => ({ x: p.x / k, y: p.y / k })) as Quad;
    if (!rgb) break;
    const inQuad = (x: number, y: number) => {
      let inside = false;
      for (let i = 0, j = 3; i < 4; j = i++) {
        const A = q[i]!;
        const B = q[j]!;
        if (A.y > y !== B.y > y && x < ((B.x - A.x) * (y - A.y)) / (B.y - A.y) + A.x) inside = !inside;
      }
      return inside;
    };
    const greys: number[] = [];
    for (let v = 0; v < D0.h; v++)
      for (let u = 0; u < D0.w; u++) {
        if (!inQuad(((u + 0.5) * size.w) / D0.w, ((v + 0.5) * size.h) / D0.h)) continue;
        const i4 = (v * D0.w + u) * 4;
        greys.push((rgb[i4]! * 299 + rgb[i4 + 1]! * 587 + rgb[i4 + 2]! * 114) / 1000);
      }
    const mean = greys.reduce((p, x) => p + x, 0) / Math.max(1, greys.length);
    const sd = Math.sqrt(greys.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, greys.length));
    const share = quadArea(q) / (size.w * size.h);
    sheetWhy = `not plain/white/small enough (grey ${Math.round(mean)} ± ${Math.round(sd)}, ${Math.round(share * 100)} % of the picture)`;
    if (!(greys.length > 20 && sheetLooksPlain({ mean, sd, share }))) continue;
    const P = q.map((p) => pointAt(D0, K, size, p));
    const a2 = (dist3(P[0]!, P[1]!) + dist3(P[3]!, P[2]!)) * 500;
    const b2 = (dist3(P[0]!, P[3]!) + dist3(P[1]!, P[2]!)) * 500;
    const sides = { long: Math.max(a2, b2), short: Math.min(a2, b2) };
    const cue = cueFromSheet(sides);
    sheetWhy = `not a sheet's shape in 3-D (${Math.round(sides.long)} × ${Math.round(sides.short)} mm)`;
    if (cue) {
      cues.push(cue);
      sheet = { quad: q, ...sides };
      sheetWhy = '';
      break;
    }
  }
  if (opts.extra) cues.push(...opts.extra(D0, K));
  const fused = fuseScale(cues);
  return { D: rescaleDepth(D0, fused.scale), D0, K, fused, cues, dets, ms: raw.ms, rgb, sheet, sheetWhy, scene: sceneProblem(D0) };
}
