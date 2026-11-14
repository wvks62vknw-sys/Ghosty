/**
 * PAINT's stroke maths (pure, read by the brain's test): smoothing and the stabiliser for a finger, the spacing of dabs along a
 * stroke, symmetry, and QuickShape (a wobbly line, circle, oval or box snapped clean when he holds still at the end).
 */
export interface Pt {
  x: number;
  y: number;
  /** pressure 0..1 */
  p: number;
  /** pencil altitude in radians (π/2 upright) */
  alt: number;
  /** pencil azimuth in radians */
  az: number;
  /** time in ms */
  t: number;
}

/** Streamline + stabiliser: the drawn point trails the finger on a string of length `lazy`, then eases toward it. */
export function smoother(amount: number, lazy: number): (p: Pt) => Pt | null {
  let s: Pt | null = null;
  const k = 1 - Math.max(0, Math.min(0.95, amount)) * 0.92;
  return (p) => {
    if (!s) { s = { ...p }; return { ...s }; }
    const dx = p.x - s.x, dy = p.y - s.y;
    const d = Math.hypot(dx, dy);
    if (lazy > 0) {
      if (d <= lazy) return null;
      const f = (d - lazy) / d;
      s = { ...p, x: s.x + dx * f * k, y: s.y + dy * f * k, p: s.p + (p.p - s.p) * k };
    } else {
      s = { ...p, x: s.x + dx * k, y: s.y + dy * k, p: s.p + (p.p - s.p) * k };
    }
    return { ...s };
  };
}

/** A finger has no pressure: slow strokes read as a firmer press, fast ones lighter, as a real pen behaves. */
export function fingerPressure(prev: Pt | null, x: number, y: number, t: number): number {
  if (!prev) return 0.6;
  const v = Math.hypot(x - prev.x, y - prev.y) / Math.max(1, t - prev.t);
  const target = Math.max(0.25, Math.min(1, 1.05 - v * 0.35));
  return prev.p + (target - prev.p) * 0.3;
}

/** Dabs along a segment every `step` pixels, carrying the leftover distance to the next segment. */
export function dabsAlong(a: Pt, b: Pt, step: number, carry: number): { dabs: Pt[]; carry: number } {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const out: Pt[] = [];
  let at = step - carry;
  while (at <= d) {
    const f = d ? at / d : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, p: a.p + (b.p - a.p) * f, alt: a.alt + (b.alt - a.alt) * f, az: b.az, t: a.t + (b.t - a.t) * f });
    at += step;
  }
  return { dabs: out, carry: d - (at - step) };
}

export type Symmetry = 'off' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';
export const SYMMETRY_NAMES: Record<Symmetry, string> = { off: 'Off', vertical: 'Mirror left and right', horizontal: 'Mirror top and bottom', quadrant: 'Four ways', radial: 'Six ways round' };

/** Every mirrored copy of a point (the first is the point itself); `rot` is the angle each copy turns, for a tilted nib. */
export function mirrored(x: number, y: number, sym: Symmetry, cx: number, cy: number): { x: number; y: number; flip: boolean; rot: number }[] {
  const out = [{ x, y, flip: false, rot: 0 }];
  if (sym === 'vertical' || sym === 'quadrant') out.push({ x: 2 * cx - x, y, flip: true, rot: 0 });
  if (sym === 'horizontal' || sym === 'quadrant') out.push({ x, y: 2 * cy - y, flip: true, rot: 0 });
  if (sym === 'quadrant') out.push({ x: 2 * cx - x, y: 2 * cy - y, flip: false, rot: Math.PI });
  if (sym === 'radial') {
    for (let i = 1; i < 6; i++) {
      const a = (i * Math.PI) / 3, dx = x - cx, dy = y - cy;
      out.push({ x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a), flip: false, rot: a });
    }
  }
  return out;
}

// ---- QuickShape
export type Shape = { kind: 'line' | 'circle' | 'ellipse' | 'rectangle' | 'triangle' | 'polygon'; pts: Pt[] };

const distToSeg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Ramer–Douglas–Peucker: the corners of a hand-drawn path. */
export function simplify<T extends { x: number; y: number }>(pts: T[], eps: number): T[] {
  if (pts.length < 3) return pts.slice();
  let best = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > best) { best = d; at = i; }
  }
  if (best <= eps) return [pts[0]!, pts[pts.length - 1]!];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

const pathLength = (pts: { x: number; y: number }[]): number => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) : 0), 0);

/** Points along a clean shape, at the stroke's mean pressure, so the brush draws it like a stroke. */
function along(corners: { x: number; y: number }[], closed: boolean, p: number, t0: number): Pt[] {
  const c = closed ? [...corners, corners[0]!] : corners;
  const out: Pt[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const a = c[i]!, b = c[i + 1]!;
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, p, alt: Math.PI / 2, az: 0, t: t0 + out.length });
  }
  const last = c[c.length - 1]!;
  out.push({ x: last.x, y: last.y, p, alt: Math.PI / 2, az: 0, t: t0 + out.length });
  return out;
}

/** What a hand-drawn stroke was meant to be, or null when it is just a stroke. */
export function quickShape(raw: Pt[]): Shape | null {
  if (raw.length < 6) return null;
  const len = pathLength(raw);
  if (len < 24) return null;
  const a = raw[0]!, b = raw[raw.length - 1]!;
  const p = raw.reduce((s, q) => s + q.p, 0) / raw.length;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  // a line: every point close to the chord
  const off = Math.max(...raw.map((q) => distToSeg(q, a, b)));
  if (chord > len * 0.85 && off < Math.max(6, chord * 0.06)) return { kind: 'line', pts: along([a, b], false, p, a.t) };
  const closed = chord < Math.max(18, len * 0.18);
  if (!closed) return null;
  // corners: three is a triangle, four a box, more an even polygon; a round path with none is a circle or oval
  const corners = simplify(raw, Math.max(8, len * 0.035));
  const ring = corners.length > 2 && Math.hypot(corners[0]!.x - corners[corners.length - 1]!.x, corners[0]!.y - corners[corners.length - 1]!.y) < len * 0.18 ? corners.slice(0, -1) : corners;
  const cx = raw.reduce((s, q) => s + q.x, 0) / raw.length, cy = raw.reduce((s, q) => s + q.y, 0) / raw.length;
  const rs = raw.map((q) => Math.hypot(q.x - cx, q.y - cy));
  const rMean = rs.reduce((s, r) => s + r, 0) / rs.length;
  const rDev = Math.sqrt(rs.reduce((s, r) => s + (r - rMean) ** 2, 0) / rs.length) / Math.max(1, rMean);
  if (ring.length === 3) return { kind: 'triangle', pts: along(ring, true, p, a.t) };
  if (ring.length === 4 && rDev > 0.06) {
    // a box: square it up to its bounding rectangle when its sides are near level
    const xs = ring.map((q) => q.x), ys = ring.map((q) => q.y);
    const level = ring.every((q, i) => { const n = ring[(i + 1) % 4]!; const ang = Math.abs(Math.atan2(n.y - q.y, n.x - q.x)) % (Math.PI / 2); return ang < 0.25 || ang > Math.PI / 2 - 0.25; });
    const box = level ? [{ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }, { x: Math.min(...xs), y: Math.max(...ys) }] : ring;
    return { kind: 'rectangle', pts: along(box, true, p, a.t) };
  }
  if (rDev < 0.12 || ring.length > 6) {
    // an oval from the spread along x and y; a circle when the two nearly match
    const sx = Math.sqrt(raw.reduce((s, q) => s + (q.x - cx) ** 2, 0) / raw.length) * Math.SQRT2;
    const sy = Math.sqrt(raw.reduce((s, q) => s + (q.y - cy) ** 2, 0) / raw.length) * Math.SQRT2;
    const circle = Math.abs(sx - sy) / Math.max(sx, sy) < 0.12;
    const rx = circle ? (sx + sy) / 2 : sx, ry = circle ? (sx + sy) / 2 : sy;
    const n = Math.max(24, Math.ceil((Math.PI * (rx + ry)) / 4));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2; pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t), p, alt: Math.PI / 2, az: 0, t: a.t + i }); }
    return { kind: circle ? 'circle' : 'ellipse', pts };
  }
  if (ring.length >= 5) return { kind: 'polygon', pts: along(ring, true, p, a.t) };
  return null;
}

/** Thin ends: a share of full size at distance d from the nearest end of a stroke `len` long. */
export const taperAt = (d: number, len: number, taper: number): number => (taper <= 0 ? 1 : Math.max(0.15, Math.min(1, Math.min(d, Math.max(0, len - d)) / taper)));
