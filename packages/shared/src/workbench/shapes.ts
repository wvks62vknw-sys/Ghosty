/**
 * THE WIND TUNNEL's shapes (OWNER-ISSUES 61b), pure: a NACA 4-digit aerofoil by its code and angle of attack, a circle, a
 * square, a flat plate at an angle, a simple car profile, and a free shape from a list of points (his finger), each
 * rasterised to the lattice's mask (a cell is solid when its centre is inside the outline). Coordinates are lattice cells,
 * y up; a positive angle of attack lifts the leading edge (the nose up), so it gives lift upwards.
 */
import { nacaOf } from './aero';

export type Pt = [number, number];
export type ShapeKind = 'naca' | 'circle' | 'square' | 'plate' | 'car' | 'free';

export interface ShapeSpec {
  kind: ShapeKind;
  /** NACA 4-digit code ("2412"). */
  code?: string;
  /** Angle of attack, degrees (nose up positive). */
  alpha?: number;
  /** The shape's size as a share of the tunnel's height (its chord, or a circle's diameter): 0.1 to 0.6. */
  size?: number;
  /** A free shape's points, in cells. */
  points?: Pt[];
}

export interface Shape {
  mask: Uint8Array;
  /** The reference length in cells (the chord; a circle's diameter). */
  chord: number;
  /** The outline in cells (for drawing). */
  outline: Pt[];
  /** Solid cells. */
  cells: number;
  name: string;
}

/**
 * A NACA 4-digit section of unit chord, leading edge at (0, 0): the closed-trailing-edge thickness formula (−0.1036 for the
 * last term), cosine-spaced; the upper surface from the trailing edge to the nose, then the lower back to the trailing
 * edge, so the first and last points are the same point. Null for a code that is not one.
 */
export function nacaOutline(code: string, n = 60): Pt[] | null {
  const c = nacaOf(code);
  if (!c) return null;
  const { m, p, t } = c;
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i * Math.PI) / n)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0;
    let dyc = 0;
    if (m > 0) {
      if (x < p) {
        yc = (m / (p * p)) * (2 * p * x - x * x);
        dyc = ((2 * m) / (p * p)) * (p - x);
      } else {
        yc = (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
        dyc = ((2 * m) / ((1 - p) ** 2)) * (p - x);
      }
    }
    const th = Math.atan(dyc);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return [...upper.reverse(), ...lower.slice(1)];
}

/** Rotate (nose up by alpha degrees, about the quarter chord), scale by `chord` cells and move the quarter chord to (cx, cy). */
export function place(pts: Pt[], chord: number, alpha: number, cx: number, cy: number, pivot: Pt = [0.25, 0]): Pt[] {
  const a = (-alpha * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return pts.map(([x, y]) => {
    const px = (x - pivot[0]) * chord;
    const py = (y - pivot[1]) * chord;
    return [cx + px * ca - py * sa, cy + px * sa + py * ca] as Pt;
  });
}

/** Whether (x, y) is inside the polygon (even–odd rule). */
export function inside(poly: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The polygon's area (shoelace), in cells². */
export function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  return Math.abs(s) / 2;
}

/** The mask of a polygon: every cell whose centre is inside it. */
export function rasterise(poly: Pt[], nx: number, ny: number): Uint8Array {
  const mask = new Uint8Array(nx * ny);
  if (poly.length < 3) return mask;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [, y] of poly) {
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(ny - 1, Math.ceil(y1)); y++) {
    for (let x = 0; x < nx; x++) if (inside(poly, x, y)) mask[y * nx + x] = 1;
  }
  return mask;
}

/** The mask of a stroke: every cell within `half` cells of the polyline (a drawn line too thin to enclose anything). */
export function strokeMask(pts: Pt[], nx: number, ny: number, half = 1.2): Uint8Array {
  const mask = new Uint8Array(nx * ny);
  const seg = (ax: number, ay: number, bx: number, by: number, x: number, y: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[Math.min(i + 1, pts.length - 1)]!;
        if (seg(a[0], a[1], b[0], b[1], x, y) <= half) {
          mask[y * nx + x] = 1;
          break;
        }
      }
    }
  }
  return mask;
}

/** A circle's mask: the cells whose centres are within r of (cx, cy). */
export function circleMask(nx: number, ny: number, cx: number, cy: number, r: number): Uint8Array {
  const mask = new Uint8Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * nx + x] = 1;
  return mask;
}

/** A hatchback in side view, unit length, nose at x = 0, ground at y = 0 (the tunnel has no road: it floats in the stream). */
const CAR: Pt[] = [
  [0, 0.08], [0.02, 0.2], [0.08, 0.26], [0.3, 0.3], [0.42, 0.44], [0.5, 0.47], [0.72, 0.46], [0.9, 0.38], [1, 0.34], [1, 0.08], [0.96, 0.04], [0.04, 0.04],
];

const count = (m: Uint8Array) => m.reduce((n, v) => n + v, 0);

/** A shape in the tunnel (nx × ny): its mask, reference length, outline and name. Total: an unreadable spec gives a circle. */
export function shapeMask(spec: ShapeSpec, nx: number, ny: number): Shape {
  const size = Math.max(0.1, Math.min(0.6, spec.size ?? (spec.kind === 'circle' || spec.kind === 'square' ? 0.16 : 0.42)));
  const alpha = Math.max(-25, Math.min(25, spec.alpha ?? 0));
  const cx = Math.round(nx * 0.3);
  const cy = (ny - 1) / 2;
  const L = size * ny;
  const done = (mask: Uint8Array, chord: number, outline: Pt[], name: string): Shape => ({ mask, chord, outline, cells: count(mask), name });
  switch (spec.kind) {
    case 'naca': {
      const pts = nacaOutline(spec.code ?? '2412') ?? nacaOutline('2412')!;
      // the chord along the stream (1.6 × the size of the height reads as a wing in a tunnel of this shape), its quarter chord at cx
      const chord = Math.min(nx * 0.45, L * 1.6);
      const out = place(pts, chord, alpha, cx, cy);
      return done(rasterise(out, nx, ny), chord, out, `NACA ${String(spec.code ?? '2412').replace(/\D/g, '')} at ${Math.round(alpha)}°`);
    }
    case 'plate': {
      const chord = Math.min(nx * 0.45, L * 1.6);
      const ends = place([[0, 0], [1, 0]], chord, alpha, cx, cy, [0.5, 0]);
      const mask = strokeMask(ends, nx, ny, 1);
      return done(mask, chord, ends, `a flat plate at ${Math.round(alpha)}°`);
    }
    case 'square': {
      const s = L;
      const sq: Pt[] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      const out = place(sq, s, alpha, cx, cy, [0, 0]);
      return done(rasterise(out, nx, ny), s, out, 'a square');
    }
    case 'car': {
      const len = Math.min(nx * 0.5, L * 2);
      const out = place(CAR, len, alpha, cx, cy, [0.5, 0.25]);
      return done(rasterise(out, nx, ny), len, out, 'a car');
    }
    case 'free': {
      const pts = (spec.points ?? []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(([x, y]) => [Math.max(1, Math.min(nx - 2, x)), Math.max(0, Math.min(ny - 1, y))] as Pt);
      if (!pts.length) break;
      const solid = pts.length >= 3 && area(pts) >= 4 ? rasterise(pts, nx, ny) : strokeMask(pts, nx, ny);
      let x0 = Infinity;
      let x1 = -Infinity;
      for (const [x] of pts) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      return done(solid, Math.max(2, x1 - x0 + 1), pts, 'your shape');
    }
    case 'circle':
      break;
  }
  const r = L / 2;
  const n = 48;
  const out = Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)] as Pt);
  return done(circleMask(nx, ny, cx, cy, r), 2 * r, out, 'a circle');
}
