/**
 * AUTO's whole first step for one picture, in the browser: the depth model's map (measure/depth.ts),
 * corrected for the camera (EXIF, measure/exif.ts) and for real photos, then checked against the
 * things of known size the detector finds and a sheet of paper if one is lying in view
 * (measure/cues.ts). Shared by the Lens's MEASURE and the planner's FROM PHOTO; the arithmetic is in
 * the pure files, tested in apps/edge/test/measure.test.mjs.
 */
import { fromMediaPipe, type Detection } from '../vision/boxes';
import { detector, nextStamp, type Progress } from '../vision/models';
import { findPageIn } from '../scan/page';
import { cueFromBox, cueFromSheet, fuseScale, type Cue, type Fused } from './cues';
import { depthModel } from './depth';
import { depthAt, dist3, metricDepth, pointAt, rescaleDepth, type DepthMap } from './depth3d';
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
  progress('working out distances in the photo (a few seconds)…');
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
  // a sheet of paper, by its four corners in 3-D
  const q = findPageIn(c);
  if (q) {
    const P = q.map((p) => pointAt(D0, K, size, p));
    const a = (dist3(P[0]!, P[1]!) + dist3(P[3]!, P[2]!)) * 500;
    const b = (dist3(P[0]!, P[3]!) + dist3(P[1]!, P[2]!)) * 500;
    const sheet = cueFromSheet({ long: Math.max(a, b), short: Math.min(a, b) });
    if (sheet) cues.push(sheet);
  }
  if (opts.extra) cues.push(...opts.extra(D0, K));
  const fused = fuseScale(cues);
  let rgb: Uint8ClampedArray | null = null;
  const small = document.createElement('canvas');
  small.width = D0.w;
  small.height = D0.h;
  const g = small.getContext('2d', { willReadFrequently: true });
  if (g) {
    g.drawImage(c, 0, 0, D0.w, D0.h);
    rgb = g.getImageData(0, 0, D0.w, D0.h).data;
  }
  return { D: rescaleDepth(D0, fused.scale), D0, K, fused, cues, dets, ms: raw.ms, rgb };
}
