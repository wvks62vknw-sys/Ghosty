/**
 * MEASURE's arithmetic, pure and unit-tested (apps/edge/test/measure.test.mjs): turning taps on a
 * photo into real sizes.
 *
 * Three ways to know the scale:
 * - A REFERENCE RECTANGLE of known size lying flat on the surface being measured (a bank card,
 *   85.6 × 54 mm; an A4 sheet, 210 × 297 mm): its four tapped corners give the homography from
 *   the photo to that plane in millimetres, so any two points ON THAT PLANE measure exactly, even
 *   seen at an angle. Points off that plane (a wall when the card is on the floor) are estimates.
 * - A DOOR (or anything upright of known height; UK standard internal door 1981 mm): its top and
 *   bottom tapped give millimetres per pixel at the door's distance — an estimate for things at
 *   about that distance, seen square on.
 * - A DISTANCE to the wall, typed: with the iPhone 13 wide camera's field of view (about 69° across
 *   the long side of the photo) the focal length in pixels is known, so millimetres per pixel at
 *   that distance is distance / focal — again for a wall seen square on.
 */
import { applyH, homography, type Pt, type Quad } from '../scan/page';

export type { Pt, Quad } from '../scan/page';

export const CARD_MM = { w: 85.6, h: 54 } as const;
export const A4_MM = { w: 210, h: 297 } as const;
/** A UK standard internal door's height (6′6″). */
export const DOOR_MM = 1981;
/** The iPhone 13 wide (main) camera's field of view across the long side of the picture, in degrees. */
export const IPHONE13_LONG_FOV = 69;

/** 'auto': no reference at all — the depth model and the things it recognises (depth3d.ts, cues.ts). */
export type RefKind = 'auto' | 'card' | 'a4' | 'door' | 'distance';

export type Calibration =
  /** Photo pixels → millimetres on the reference's plane; `ref` is the reference's corners in the photo. */
  | { kind: 'plane'; ref: RefKind; H: number[]; quad: Quad; sizeMm: { w: number; h: number } }
  /** A single scale (millimetres per photo pixel) for things square on at one distance. */
  | { kind: 'scale'; ref: RefKind; mmPerPx: number; at?: [Pt, Pt] };

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Four tapped corners in order top-left, top-right, bottom-right, bottom-left, whatever order
 * they were tapped in: round their centre clockwise, starting from the top-left-most. (Sorting by
 * x + y alone mixes corners up when the rectangle is seen at a steep angle.)
 */
export function orderCorners(pts: Pt[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const round = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let first = 0;
  round.forEach((p, i) => {
    if (p.x + p.y < round[first]!.x + round[first]!.y) first = i;
  });
  const q = [0, 1, 2, 3].map((k) => round[(first + k) % 4]!);
  return [q[0]!, q[1]!, q[2]!, q[3]!];
}

/**
 * Calibrate from a known rectangle's four corners (any order). Its longer side in the picture is
 * matched to its longer real side, so a card held landscape or portrait both work.
 */
export function calibrateRect(corners: Pt[], sizeMm: { w: number; h: number }, ref: RefKind): Calibration {
  if (corners.length !== 4) throw new Error('Tap the four corners of the reference');
  const q = orderCorners(corners);
  const across = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const down = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  if (across < 4 || down < 4) throw new Error('Those corners are too close together: tap the reference’s four corners');
  const long = Math.max(sizeMm.w, sizeMm.h);
  const short = Math.min(sizeMm.w, sizeMm.h);
  const [w, h] = across >= down ? [long, short] : [short, long];
  const target: Quad = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  return { kind: 'plane', ref, H: homography(q, target), quad: q, sizeMm: { w, h } };
}

/** Calibrate from something upright of known height: its top and bottom tapped. */
export function calibrateHeight(top: Pt, bottom: Pt, heightMm: number, ref: RefKind = 'door'): Calibration {
  const px = dist(top, bottom);
  if (px < 4) throw new Error('Tap the top and the bottom of it');
  if (!(heightMm > 0)) throw new Error('Type its height');
  return { kind: 'scale', ref, mmPerPx: heightMm / px, at: [top, bottom] };
}

/** The camera's focal length in pixels for a picture of this size (the field of view spans its long side). */
export function focalPx(frame: { w: number; h: number }, longFovDeg = IPHONE13_LONG_FOV): number {
  return Math.max(frame.w, frame.h) / 2 / Math.tan(((longFovDeg / 2) * Math.PI) / 180);
}

/** The field of view across the picture's width (degrees): the long side's 69°, narrower across a portrait picture. */
export function horizontalFov(frame: { w: number; h: number }, longFovDeg = IPHONE13_LONG_FOV): number {
  return (2 * Math.atan(frame.w / 2 / focalPx(frame, longFovDeg)) * 180) / Math.PI;
}

/** Calibrate from the distance to a wall seen square on (millimetres). */
export function calibrateDistance(distanceMm: number, frame: { w: number; h: number }, longFovDeg = IPHONE13_LONG_FOV): Calibration {
  if (!(distanceMm > 0)) throw new Error('Type the distance to the wall');
  return { kind: 'scale', ref: 'distance', mmPerPx: distanceMm / focalPx(frame, longFovDeg) };
}

/** Where a photo point lands in millimetres (plane calibrations only). */
export function toPlane(cal: Calibration, p: Pt): Pt | null {
  return cal.kind === 'plane' ? applyH(cal.H, p.x, p.y) : null;
}

/** The real length between two photo points, in millimetres. */
export function lengthMm(cal: Calibration, a: Pt, b: Pt): number {
  if (cal.kind === 'scale') return dist(a, b) * cal.mmPerPx;
  const A = applyH(cal.H, a.x, a.y);
  const B = applyH(cal.H, b.x, b.y);
  return dist(A, B);
}

/** A rectangle's real width (mean of top and bottom) and height (mean of the sides), from its four corners in any order. */
export function rectMm(cal: Calibration, corners: Pt[]): { w: number; h: number; quad: Quad } {
  const q = orderCorners(corners);
  const w = (lengthMm(cal, q[0], q[1]) + lengthMm(cal, q[3], q[2])) / 2;
  const h = (lengthMm(cal, q[0], q[3]) + lengthMm(cal, q[1], q[2])) / 2;
  return { w, h, quad: q };
}

export type Confidence = 'good' | 'fair' | 'rough';

/**
 * How far to trust a measurement, in plain words. A reference rectangle: good near it, fair up to
 * about four times its size away, rough beyond (and rough when the reference is tiny in the
 * picture); a door or a distance: always an estimate (fair at best).
 */
export function confidence(cal: Calibration, pts: Pt[]): { level: Confidence; note: string } {
  if (cal.kind === 'scale') {
    return cal.ref === 'distance'
      ? { level: 'rough', note: 'estimate from the distance: only for a wall seen square on, within about ±10 %' }
      : { level: 'fair', note: 'estimate from the door: right for things at the door’s distance, seen square on' };
  }
  const q = cal.quad;
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const size = Math.max(dist(q[0], q[2]), dist(q[1], q[3]));
  const name = cal.ref === 'a4' ? 'the A4 sheet' : 'the card';
  if (size < 60) return { level: 'rough', note: `${name} is small in the picture: move closer or use an A4 sheet` };
  const far = Math.max(0, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) / size;
  if (far <= 1.5) return { level: 'good', note: `exact on the surface ${name} lies on (±2 %)` };
  if (far <= 4) return { level: 'fair', note: `on ${name}’s surface, a little way from it (±5 %); anything off that surface is an estimate` };
  return { level: 'rough', note: `far from ${name}: an estimate (±10 % or more); measure near the reference for better` };
}

// ---------------------------------------------------------------- units

/** "123.4 cm" (one decimal under a metre, whole centimetres above). */
export function cmText(mm: number): string {
  const cm = mm / 10;
  return cm < 100 ? `${cm.toFixed(1)} cm` : `${Math.round(cm)} cm`;
}

/** "4 ft 1 in", "11 in", to the nearest inch (half inches under a foot). */
export function ftInText(mm: number): string {
  const inches = mm / 25.4;
  if (inches < 12) {
    const half = Math.round(inches * 2) / 2;
    return `${Number.isInteger(half) ? half : half.toFixed(1)} in`;
  }
  let ft = Math.floor(inches / 12);
  let inch = Math.round(inches - ft * 12);
  if (inch === 12) {
    ft++;
    inch = 0;
  }
  return `${ft} ft ${inch} in`;
}

/** Both: "123 cm · 4 ft 0 in". */
export const bothText = (mm: number) => `${cmText(mm)} · ${ftInText(mm)}`;

/**
 * A typed length in millimetres: "2.4 m", "240cm", "2400 mm", "8ft", "6' 6\"", "6 ft 6 in", "78in";
 * a bare number is taken as `bare` units (cm by default, metres when under 10 and bare is 'auto').
 */
export function parseLength(text: string, bare: 'cm' | 'm' | 'mm' | 'auto' = 'cm'): number | null {
  const t = text.trim().toLowerCase().replace(/,/g, '.').replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  if (!t) return null;
  const ftin = t.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (ftin) return Math.round((Number(ftin[1]) * 12 + Number(ftin[2] ?? 0)) * 25.4);
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|in|inch|inches|")?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  const unit = m[2] ?? (bare === 'auto' ? (n < 10 ? 'm' : 'cm') : bare);
  if (unit === 'mm') return Math.round(n);
  if (unit === 'cm') return Math.round(n * 10);
  if (unit.startsWith('m')) return Math.round(n * 1000);
  return Math.round(n * 25.4);
}

/** One saved measurement, as the planner and the chat get it. */
export interface Measurement {
  /** 'object': a thing tapped in AUTO — its width, height and (the part the camera saw of) its depth. */
  kind: 'length' | 'rect' | 'object';
  /** Millimetres: a length's `w` only; a rectangle's width and height; a thing's width, height and depth. */
  w: number;
  h?: number;
  d?: number;
  confidence: Confidence;
  /** How it was calibrated, in words ("bank card", "door 1981 mm", "distance 2.5 m", "depth + an A4 sheet"). */
  via: string;
  /** AUTO: the likely range as a fraction either way (0.12: the real size is probably within about ±12 %). */
  range?: number;
  /** AUTO: what the thing is, when the detector knew. */
  name?: string;
}

/** "±12 %" for a measurement that has a range. */
export const rangeText = (m: Pick<Measurement, 'range'>) => (m.range ? ` ±${Math.max(1, Math.round((Math.exp(m.range) - 1) * 100))} %` : '');

/** The set in plain words, as data for the chat ("Wall: 312 cm × 240 cm (10 ft 3 in × 7 ft 10 in), good, by bank card"). */
export function describeMeasurements(list: Measurement[]): string {
  return list
    .map((m, i) =>
      m.kind === 'object'
        ? `${i + 1}. ${m.name ? `${m.name[0]!.toUpperCase()}${m.name.slice(1)}` : 'Thing'} ${cmText(m.w)} wide × ${cmText(m.h ?? 0)} high${m.d ? ` × ${cmText(m.d)} deep (the side seen)` : ''} (${ftInText(m.w)} × ${ftInText(m.h ?? 0)}), ${m.confidence}${rangeText(m)}, by ${m.via}`
        : m.kind === 'rect'
          ? `${i + 1}. Rectangle ${cmText(m.w)} wide × ${cmText(m.h ?? 0)} high (${ftInText(m.w)} × ${ftInText(m.h ?? 0)}), ${m.confidence}${rangeText(m)}, by ${m.via}`
          : `${i + 1}. Length ${cmText(m.w)} (${ftInText(m.w)}), ${m.confidence}${rangeText(m)}, by ${m.via}`,
    )
    .join('\n');
}

