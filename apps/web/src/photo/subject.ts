/**
 * THE SUBJECT MASK (BRIEF-EDITOR-PHOTO): a first cut of what a photo is about, made on the phone from MEASURE'S DISTANCE (the depth model:
 * how far each part of the picture is) and THE LENS'S EYES (the object finder's biggest box), where those two packs are kept on this phone
 * (offline/eyes.ts; a pack only ever comes on his tap, on Wi-Fi, with its size said). The cut is the part of the box that is no further
 * away than the box's own middle, edged soft. It is a FIRST CUT, said as one: "paint to fix it". A true matting model is a download he has
 * not been asked for (NEEDS HIS WORD in the report). Nothing looks for or names a face; nothing leaves the phone.
 */
import { clamp, smoothstep } from './math';
import { alphaAt, alphaSizeFor, blankAlpha, type Alpha } from './alpha';
import { DEPTH, FINDER, RUNTIME, WORKER_RUNTIME, sum } from '../offline/eyesfiles';

/** What the two packs weigh together, in bytes (the shared runtime counted once). */
export const SUBJECT_BYTES = sum(RUNTIME, FINDER, WORKER_RUNTIME, DEPTH);
export const SUBJECT_LINE = 'A first cut, from how far things are and the object finder: paint to fix it.';

export const sizeIn = (n: number): string => `${Math.round(n / 1_000_000)} MB`;

export interface SubjectState {
  ready: boolean;
  /** One line for the tray. */
  words: string;
}

/** Are MEASURE'S DISTANCE and THE LENS'S EYES kept on this phone? */
export async function subjectState(): Promise<SubjectState> {
  try {
    const { EYES_LENS, EYES_MEASURE, eyesHere } = await import('../offline/eyes');
    const [lens, measure] = await Promise.all([eyesHere(EYES_LENS), eyesHere(EYES_MEASURE)]);
    if (lens && measure) return { ready: true, words: 'MEASURE’S DISTANCE and THE LENS’S EYES are on this phone: I can make the cut here.' };
    const missing = [!lens ? 'THE LENS’S EYES' : '', !measure ? 'MEASURE’S DISTANCE' : ''].filter(Boolean).join(' and ');
    return { ready: false, words: `To make the cut I need ${missing} kept on this phone (${sizeIn(SUBJECT_BYTES)} together; Settings, the Lens’s eyes, on Wi-Fi). Until then paint the subject with the brush.` };
  } catch {
    return { ready: false, words: `To make the cut I need MEASURE’S DISTANCE and THE LENS’S EYES kept on this phone (${sizeIn(SUBJECT_BYTES)} together). Until then paint the subject with the brush.` };
  }
}

/** The cut, as an alpha picture in the original's frame. `step` says each wait ("loading the depth model 40%"). */
export async function cutSubject(canvas: HTMLCanvasElement, step: (words: string) => void): Promise<{ alpha: Alpha; box: boolean }> {
  const { w, h } = alphaSizeFor(canvas.width, canvas.height);
  const side = Math.min(640, Math.max(w, h));
  const k = side / Math.max(canvas.width, canvas.height);
  const small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(canvas.width * k));
  small.height = Math.max(2, Math.round(canvas.height * k));
  small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);

  const models = await import('../vision/models');
  step('Looking for the thing the photo is about…');
  const det = await models.detector.get((s) => step(s.charAt(0).toUpperCase() + s.slice(1)));
  const found = det.detectForVideo(small, models.nextStamp(performance.now())).detections ?? [];
  let box = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
  let boxFound = false;
  let best = 0;
  for (const d of found) {
    const b = d.boundingBox;
    if (!b) continue;
    const area = b.width * b.height;
    if (area > best) {
      best = area;
      box = { x: b.originX / small.width, y: b.originY / small.height, w: b.width / small.width, h: b.height / small.height };
      boxFound = true;
    }
  }
  const { depthModel } = await import('../measure/depth');
  await depthModel.load((s) => step(s.charAt(0).toUpperCase() + s.slice(1)));
  step('Working out how far each part is…');
  const depth = await depthModel.run(small, { w: small.width, h: small.height });
  depthModel.release();

  const at = (u: number, v: number): number => {
    const x = clamp(u * depth.w - 0.5, 0, depth.w - 1);
    const y = clamp(v * depth.h - 0.5, 0, depth.h - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(depth.w - 1, x0 + 1);
    const y1 = Math.min(depth.h - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const d = depth.data;
    return (d[y0 * depth.w + x0]! * (1 - fx) + d[y0 * depth.w + x1]! * fx) * (1 - fy) + (d[y1 * depth.w + x0]! * (1 - fx) + d[y1 * depth.w + x1]! * fx) * fy;
  };
  // the box's own middle half sets how far the subject is
  const mid: number[] = [];
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) mid.push(at(box.x + box.w * (0.25 + (i / 11) * 0.5), box.y + box.h * (0.25 + (j / 11) * 0.5)));
  mid.sort((a, b) => a - b);
  const d0 = mid[Math.floor(mid.length / 2)]!;
  const out = blankAlpha(w, h);
  const grow = 0.06;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      const v = (j + 0.5) / h;
      const inBox = smoothstep(box.x - grow, box.x + 0.01, u) * (1 - smoothstep(box.x + box.w - 0.01, box.x + box.w + grow, u)) * smoothstep(box.y - grow, box.y + 0.01, v) * (1 - smoothstep(box.y + box.h - 0.01, box.y + box.h + grow, v));
      const near = 1 - smoothstep(d0 * 1.12 + 0.05, d0 * 1.45 + 0.2, at(u, v));
      out.data[j * w + i] = Math.round(clamp(inBox * near) * 255);
    }
  }
  // a light 3 × 3 blur so the edge is not a staircase
  const src = out.data.slice();
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    let s = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += src[(j + b) * w + i + a]!;
    out.data[j * w + i] = Math.round(s / 9);
  }
  return { alpha: out, box: boxFound };
}

// ---------------------------------------------------------------- REFINE WITH DEPTH (BRIEF-EDITOR-PHOTO-2)

/** What MEASURE'S DISTANCE weighs on its own, in bytes (the cut-out model's mask is refined with it, not made from it). */
export const DEPTH_BYTES = sum(WORKER_RUNTIME, DEPTH);

/** Is MEASURE'S DISTANCE kept on this phone? The words for the tray say what is missing when it is not. */
export async function depthState(): Promise<SubjectState> {
  try {
    const { EYES_MEASURE, eyesHere } = await import('../offline/eyes');
    if (await eyesHere(EYES_MEASURE)) return { ready: true, words: 'MEASURE’S DISTANCE is on this phone: I can refine the cut with how far things are.' };
  } catch {
    /* said below */
  }
  return { ready: false, words: `To refine with depth I need MEASURE’S DISTANCE kept on this phone (${sizeIn(DEPTH_BYTES)}; Settings, the Lens’s eyes, on Wi-Fi). The cut stays as it is.` };
}

/**
 * The cut-out model's mask kept only where it is about as far away as the subject itself (the depth model, MEASURE'S DISTANCE): the
 * depth of the subject is the median over what the mask holds firmly, and what lies clearly behind it goes. A first cut can stay in
 * front of a wall the model took in; a mask that holds nothing firmly comes back as it was.
 */
export async function refineWithDepth(canvas: HTMLCanvasElement, alpha: Alpha, step: (words: string) => void): Promise<Alpha> {
  const side = Math.min(640, Math.max(alpha.w, alpha.h));
  const k = side / Math.max(canvas.width, canvas.height);
  const small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(canvas.width * k));
  small.height = Math.max(2, Math.round(canvas.height * k));
  small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);
  const { depthModel } = await import('../measure/depth');
  await depthModel.load((s) => step(s.charAt(0).toUpperCase() + s.slice(1)));
  step('Working out how far each part is…');
  let depth;
  try {
    depth = await depthModel.run(small, { w: small.width, h: small.height });
  } finally {
    depthModel.release();
  }
  const at = (u: number, v: number): number => {
    const x = clamp(u * depth.w - 0.5, 0, depth.w - 1);
    const y = clamp(v * depth.h - 0.5, 0, depth.h - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(depth.w - 1, x0 + 1);
    const y1 = Math.min(depth.h - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const d = depth.data;
    return (d[y0 * depth.w + x0]! * (1 - fx) + d[y0 * depth.w + x1]! * fx) * (1 - fy) + (d[y1 * depth.w + x0]! * (1 - fx) + d[y1 * depth.w + x1]! * fx) * fy;
  };
  const firm: number[] = [];
  for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
    const u = (i + 0.5) / 24;
    const v = (j + 0.5) / 24;
    if (alphaAt(alpha, u, v) > 0.7) firm.push(at(u, v));
  }
  if (firm.length < 6) return alpha;
  firm.sort((a, b) => a - b);
  const d0 = firm[Math.floor(firm.length / 2)]!;
  const out = blankAlpha(alpha.w, alpha.h);
  for (let j = 0; j < alpha.h; j++)
    for (let i = 0; i < alpha.w; i++) {
      const u = (i + 0.5) / alpha.w;
      const v = (j + 0.5) / alpha.h;
      const near = 1 - smoothstep(d0 * 1.12 + 0.05, d0 * 1.45 + 0.2, at(u, v));
      out.data[j * alpha.w + i] = Math.round(alpha.data[j * alpha.w + i]! * clamp(near));
    }
  return out;
}
