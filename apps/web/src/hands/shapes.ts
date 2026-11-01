/**
 * SHAPES (BRIEF-REST-C part 2): what a finger traced in the air, as clean geometry. Pure, no DOM (unit-tested in
 * apps/edge/test/restc.test.mjs).
 *
 *  - A trace is the fingertip's path in SKETCH UNITS: the Lens's picture as he sees it, one unit across its width.
 *  - It is simplified (Ramer–Douglas–Peucker), then recognised: a LINE (open, one stroke), a RECTANGLE (closed, four
 *    corners), an L (closed, six), a CIRCLE (closed, round), or any other outline (POLY: closed, or an open run of walls).
 *  - Corners are snapped to right angles: each side's direction goes to the nearest quarter turn of the plan's own
 *    straight (the first shape's main direction, kept for every later shape) when it is within 12°, and the corners are
 *    rebuilt where the snapped sides cross; the plan is then turned so its straight runs across the page.
 *  - Lengths: one real length he says ("that wall is four metres") sets the scale for the whole sketch; every corner
 *    then lands on a 5 cm grid, so every straight wall is a whole number of 5 cm.
 */
export type Pt = [number, number];
export type ShapeKind = 'line' | 'rect' | 'L' | 'circle' | 'poly';
export interface Shape {
  kind: ShapeKind;
  /** Corners in sketch units, in the plan's own straight (a circle: its outline as 16 corners). */
  pts: Pt[];
  closed: boolean;
}

/** Corners within this of a right angle become one. */
export const SNAP_DEG = 12;
/** Lengths round to this, cm. */
export const ROUND_CM = 5;
/** A circle becomes this many corners (Room JSON allows 24). */
export const CIRCLE_SIDES = 16;

const RAD = Math.PI / 180;
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The longer side of the box round the points. */
export function extent(pts: Pt[]): number {
  if (!pts.length) return 0;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** The distance from p to the segment a–b. */
export function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker: the fewest points that stay within `eps` of the trace. */
export function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return [...pts];
  let best = -1;
  let far = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > far) {
      far = d;
      best = i;
    }
  }
  if (far <= eps) return [pts[0]!, pts[pts.length - 1]!];
  const a = rdp(pts.slice(0, best + 1), eps);
  const b = rdp(pts.slice(best), eps);
  return [...a.slice(0, -1), ...b];
}

/** The plan's own straight from some sides: the length-weighted mean direction, modulo a quarter turn (radians). */
export function mainDirection(poly: Pt[], closed: boolean): number {
  let s = 0;
  let c = 0;
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const l = dist(a, b);
    s += l * Math.sin(4 * th);
    c += l * Math.cos(4 * th);
  }
  return Math.atan2(s, c) / 4;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where two lines cross (each a point and a direction); null when they run (nearly) the same way. */
function cross(p: Pt, th1: number, q: Pt, th2: number): Pt | null {
  const d1: Pt = [Math.cos(th1), Math.sin(th1)];
  const d2: Pt = [Math.cos(th2), Math.sin(th2)];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < Math.sin(20 * RAD)) return null;
  const t = ((q[0] - p[0]) * d2[1] - (q[1] - p[1]) * d2[0]) / den;
  return [p[0] + t * d1[0], p[1] + t * d1[1]];
}

/**
 * Corners snapped to right angles: each side's direction goes to the nearest quarter turn of `axis` when within 12°;
 * sides that end up running the same way in a row become one; the corners are rebuilt where the sides cross.
 */
export function snapCorners(poly: Pt[], closed: boolean, axis: number): Pt[] {
  const n = closed ? poly.length : poly.length - 1;
  if (n < 1) return [...poly];
  type Side = { a: Pt; b: Pt; th: number; snapped: boolean };
  let sides: Side[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const k = Math.round(wrap(th - axis) / (90 * RAD));
    const snappedTh = axis + k * 90 * RAD;
    const ok = Math.abs(wrap(th - snappedTh)) <= SNAP_DEG * RAD;
    sides.push({ a, b, th: ok ? snappedTh : th, snapped: ok });
  }
  // sides running the same way in a row are one side (a wobble in a long wall)
  const same = (x: Side, y: Side) => Math.abs(wrap(x.th - y.th)) < 1e-6;
  const merged: Side[] = [];
  for (const s of sides) {
    const last = merged[merged.length - 1];
    if (last && same(last, s)) merged[merged.length - 1] = { a: last.a, b: s.b, th: last.th, snapped: last.snapped };
    else merged.push(s);
  }
  if (closed && merged.length > 2 && same(merged[0]!, merged[merged.length - 1]!)) {
    const last = merged.pop()!;
    merged[0] = { a: last.a, b: merged[0]!.b, th: merged[0]!.th, snapped: merged[0]!.snapped };
  }
  sides = merged;
  const mid = (s: Side): Pt => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
  const out: Pt[] = [];
  const m = sides.length;
  if (closed) {
    for (let i = 0; i < m; i++) {
      const prev = sides[(i - 1 + m) % m]!;
      const cur = sides[i]!;
      out.push(cross(mid(prev), prev.th, mid(cur), cur.th) ?? cur.a);
    }
    return out;
  }
  // open: the ends are the trace's own ends, brought onto their sides
  const onto = (p: Pt, s: Side): Pt => {
    const d: Pt = [Math.cos(s.th), Math.sin(s.th)];
    const c = mid(s);
    const t = (p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1];
    return [c[0] + t * d[0], c[1] + t * d[1]];
  };
  out.push(onto(sides[0]!.a, sides[0]!));
  for (let i = 1; i < m; i++) out.push(cross(mid(sides[i - 1]!), sides[i - 1]!.th, mid(sides[i]!), sides[i]!.th) ?? sides[i]!.a);
  out.push(onto(sides[m - 1]!.b, sides[m - 1]!));
  return out;
}

/** Turn points about 0, 0 by -axis (the plan's straight then runs across the page). */
export const align = (pts: Pt[], axis: number): Pt[] => pts.map(([x, y]) => [x * Math.cos(-axis) - y * Math.sin(-axis), x * Math.sin(-axis) + y * Math.cos(-axis)]);

/** The turn at each corner of a closed outline, radians (left or right). */
function turnsAt(poly: Pt[]): number[] {
  return poly.map((p, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length]!;
    const b = poly[(i + 1) % poly.length]!;
    return wrap(Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0]));
  });
}

/**
 * What he drew, as clean geometry in the plan's straight. `axis`: the sketch's straight when it has one (radians;
 * the first shape sets it). Null when the trace is too small or too short to be anything.
 */
export function recognise(trace: Pt[], axis: number | null = null): { shape: Shape; axis: number } | null {
  if (trace.length < 5) return null;
  const size = extent(trace);
  if (size < 0.04) return null;
  const closed = dist(trace[0]!, trace[trace.length - 1]!) < 0.22 * size;
  const path = closed ? [...trace.slice(0, -1), trace[0]!] : trace;
  let simple = rdp(path, 0.07 * size);
  if (closed) simple = simple.slice(0, -1);
  if (closed && simple.length < 3) return null;
  // round: no sharp corner, and its points about as far from the middle all the way round
  if (closed) {
    const cx = trace.reduce((s, p) => s + p[0], 0) / trace.length;
    const cy = trace.reduce((s, p) => s + p[1], 0) / trace.length;
    const r = trace.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
    const mean = r.reduce((s, x) => s + x, 0) / r.length;
    const cv = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length) / (mean || 1);
    const sharp = turnsAt(simple).some((t) => Math.abs(t) > 70 * RAD);
    if (simple.length >= 5 && !sharp && cv < 0.2) {
      const ax = axis ?? 0;
      const [c] = align([[cx, cy]], ax);
      const pts = Array.from({ length: CIRCLE_SIDES }, (_, i): Pt => [c![0] + mean * Math.cos((2 * Math.PI * i) / CIRCLE_SIDES), c![1] + mean * Math.sin((2 * Math.PI * i) / CIRCLE_SIDES)]);
      return { shape: { kind: 'circle', pts, closed: true }, axis: ax };
    }
  }
  const ax = axis ?? mainDirection(simple, closed);
  const snapped = align(snapCorners(simple, closed, ax), ax);
  const square = (pts: Pt[]) => turnsAt(pts).every((t) => Math.abs(Math.abs(t) - 90 * RAD) < 1 * RAD);
  const kind: ShapeKind = !closed ? (snapped.length === 2 ? 'line' : 'poly') : snapped.length === 4 && square(snapped) ? 'rect' : snapped.length === 6 && square(snapped) ? 'L' : 'poly';
  return { shape: { kind, pts: snapped, closed }, axis: ax };
}

/** A length in cm, rounded to the 5 cm grid. */
export const roundCm = (cm: number): number => Math.round(cm / ROUND_CM) * ROUND_CM;

/** Sketch units to cm at a scale, every corner on the 5 cm grid. */
export const toCm = (pts: Pt[], cmPerUnit: number): Pt[] => pts.map(([x, y]) => [roundCm(x * cmPerUnit), roundCm(y * cmPerUnit)]);

/** The scale from one length he said: the side `a`–`b` (sketch units) is `metres` long. */
export const scaleFrom = (a: Pt, b: Pt, metres: number): number => (metres * 100) / Math.max(1e-9, dist(a, b));
