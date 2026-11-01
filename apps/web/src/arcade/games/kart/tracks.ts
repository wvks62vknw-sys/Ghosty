/**
 * THE KART RACER's three tracks, all our own: SALTWIND BAY (a seaside loop past a lighthouse, the beach huts and a
 * harbour hairpin), CLOUDTOP PASS (a mountain road that climbs through the pines to a tunnel under the summit and sweeps
 * down again) and NEON HARBOUR (a city at night: boulevards, square corners and a chicane by the water). Each is a closed
 * curve through a few points (x, z and the road's height), sampled every 2 m into what the rules and the drawing need:
 * where the road runs and which way, how sharply it bends, the line a good driver takes and how fast each bend goes.
 */

export type TrackId = 'seaside' | 'pass' | 'city';
export const TRACK_IDS: readonly TrackId[] = ['seaside', 'pass', 'city'];

export interface TrackDef {
  id: TrackId | string;
  name: string;
  line: string;
  /** Points round the loop: x, z and the road's height (m). */
  pts: [number, number, number][];
  /** Half the road's width (m). */
  half: number;
  /** The verge between the kerb and the wall (m). */
  verge: number;
  /** Stretches under a roof (fractions of a lap). */
  tunnel: [number, number][];
  /** Where a row of item boxes stands (fractions of a lap). */
  boxes: number[];
}

export const TRACKS: Record<TrackId, TrackDef> = {
  seaside: {
    id: 'seaside',
    name: 'Saltwind Bay',
    line: 'A seaside loop past the lighthouse and the beach huts, with a tight hairpin at the harbour.',
    pts: [[0, 0, 0], [0, 90, 0], [8, 150, 0], [45, 190, 1], [105, 200, 3], [160, 175, 4], [185, 125, 4], [170, 80, 3], [135, 62, 2], [118, 30, 1], [135, -8, 0], [185, -25, 0], [214, -60, 0], [205, -100, 0], [172, -112, 0], [150, -95, 0], [120, -80, 0], [70, -112, 0], [25, -85, 0], [4, -45, 0]],
    half: 6.6,
    verge: 4,
    tunnel: [],
    boxes: [0.2, 0.5, 0.78],
  },
  pass: {
    id: 'pass',
    name: 'Cloudtop Pass',
    line: 'A mountain road that climbs through the pines to a tunnel under the summit, then sweeps down again.',
    pts: [[0, 0, 0], [-8, 70, 3], [5, 130, 8], [45, 160, 12], [75, 140, 15], [70, 100, 18], [95, 70, 21], [140, 80, 24], [160, 125, 27], [150, 170, 29], [175, 210, 31], [230, 215, 31], [270, 180, 30], [270, 120, 28], [240, 80, 24], [245, 30, 19], [260, -20, 14], [230, -70, 9], [170, -85, 5], [110, -60, 3], [60, -80, 1], [15, -60, 0]],
    half: 6.3,
    verge: 3,
    tunnel: [[0.415, 0.525]],
    boxes: [0.16, 0.36, 0.68],
  },
  city: {
    id: 'city',
    name: 'Neon Harbour',
    line: 'A city at night: long boulevards under neon, square corners and a chicane by the water.',
    pts: [[0, 0, 0], [0, 150, 0], [12, 182, 0], [42, 192, 0], [140, 192, 0], [168, 182, 0], [178, 155, 0], [176, 110, 0], [158, 90, 0], [122, 80, 0], [106, 52, 0], [118, 22, 0], [150, 6, 0], [168, -28, 0], [158, -66, 0], [126, -80, 0], [35, -80, 0], [8, -68, 0], [0, -40, 0]],
    half: 6.9,
    verge: 1.4,
    tunnel: [],
    boxes: [0.14, 0.47, 0.74],
  },
};

/** The grip a bend allows (m/s²): how fast a bend of radius R can be taken, √(A·R). */
export const A_LAT = 25;
/** How hard a careful driver brakes for what is coming (m/s²). */
export const PLAN_DECEL = 16;
/** The fastest any bend is planned at (m/s): no faster than a kart goes. */
export const PLAN_TOP = 30;

export interface Track {
  def: TrackDef;
  n: number;
  ds: number;
  length: number;
  x: Float32Array;
  z: Float32Array;
  y: Float32Array;
  /** The unit tangent (the way the road runs). */
  tx: Float32Array;
  tz: Float32Array;
  /** Signed curvature (1/m), + bending left. */
  k: Float32Array;
  /** The racing line: an offset to the right of the centre (m). */
  line: Float32Array;
  /** The speed a kart can carry here, braking in time for what comes (m/s). */
  plan: Float32Array;
  /** The wall's distance from the centre (m). */
  wall: Float32Array;
  tunnel: Uint8Array;
}

const wrapA = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export { wrapA as wrapAngle };

/** Centripetal Catmull-Rom between p1 and p2 (no loops or cusps where points bunch up). */
function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number): number[] {
  const d = (a: number[], b: number[]) => Math.pow(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) || 1e-6, 0.5);
  const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const L = (a: number[], b: number[], ta: number, tb: number) => a.map((v, i) => ((tb - tt) / (tb - ta)) * v + ((tt - ta) / (tb - ta)) * b[i]!);
  const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  return L(L(A1, A2, 0, t2), L(A2, A3, t1, t3), t1, t2);
}

const smooth = (a: Float32Array, w: number): Float32Array => {
  const n = a.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let q = -w; q <= w; q++) s += a[(i + q + n * 4) % n]!;
    out[i] = s / (2 * w + 1);
  }
  return out;
};

/** A track from its points: the road sampled every 2 m, its bends, the racing line and the speeds it allows. */
export function buildTrack(def: TrackDef): Track {
  const P = def.pts, m = P.length;
  const dense: number[][] = [];
  for (let i = 0; i < m; i++) for (let k = 0; k < 40; k++) dense.push(catmull(P[(i - 1 + m) % m]!, P[i]!, P[(i + 1) % m]!, P[(i + 2) % m]!, k / 40));
  const cum = [0];
  let L = 0;
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1]!, b = dense[i % dense.length]!;
    L += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    cum.push(L);
  }
  const n = Math.round(L / 2), ds = L / n;
  const t: Track = {
    def, n, ds, length: L,
    x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n),
    k: new Float32Array(n), line: new Float32Array(n), plan: new Float32Array(n), wall: new Float32Array(n), tunnel: new Uint8Array(n),
  };
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    while (cum[j + 1]! < s) j++;
    const a = dense[j]!, b = dense[(j + 1) % dense.length]!, f = (s - cum[j]!) / (cum[j + 1]! - cum[j]! || 1);
    t.x[i] = a[0]! + (b[0]! - a[0]!) * f;
    t.z[i] = a[1]! + (b[1]! - a[1]!) * f;
    t.y[i] = a[2]! + (b[2]! - a[2]!) * f;
  }
  const th = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    const dx = t.x[b]! - t.x[a]!, dz = t.z[b]! - t.z[a]!, l = Math.hypot(dx, dz) || 1;
    t.tx[i] = dx / l;
    t.tz[i] = dz / l;
    th[i] = Math.atan2(dx, dz);
  }
  for (let i = 0; i < n; i++) t.k[i] = wrapA(th[(i + 1) % n]! - th[(i - 1 + n) % n]!) / (2 * ds);
  // the racing line: to the inside where the road bends, judged over 40 m so it turns in early and runs out late
  const wide = smooth(t.k, 10), tight = smooth(t.k, 3);
  const lim = def.half - 1.7;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = Math.max(-lim, Math.min(lim, -wide[i]! * 26 * lim));
  t.line.set(smooth(raw, 6));
  // the speed through each bend, then planned backwards so a kart has room to brake for it (twice round the loop)
  for (let i = 0; i < n; i++) t.plan[i] = Math.min(PLAN_TOP, Math.sqrt(A_LAT / Math.max(Math.abs(tight[i]!), 1e-4)));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const nx = t.plan[(i + 1) % n]!;
      t.plan[i] = Math.min(t.plan[i]!, Math.sqrt(nx * nx + 2 * PLAN_DECEL * ds));
    }
  }
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const inside = def.tunnel.some(([a, b]) => f >= a && f <= b);
    t.tunnel[i] = inside ? 1 : 0;
    t.wall[i] = def.half + (inside ? 0.6 : def.verge + 0.8);
  }
  return t;
}

const cache = new Map<string, Track>();
/** The track for an id, built once. */
export function trackOf(id: TrackId): Track {
  let t = cache.get(id);
  if (!t) cache.set(id, (t = buildTrack(TRACKS[id])));
  return t;
}

export interface Where {
  /** The nearest sample. */
  i: number;
  /** The distance along the lap (m). */
  s: number;
  /** The offset to the right of the centre (m). */
  lat: number;
  /** The road's height there. */
  y: number;
}

/** Where a point is on the track: the nearest sample, looked for near the last one (`hint`; −1 looks everywhere). */
export function locate(t: Track, x: number, z: number, hint: number, span = 10): Where {
  let best = 0, bd = Infinity;
  const from = hint < 0 ? 0 : -span, to = hint < 0 ? t.n - 1 : span;
  for (let d = from; d <= to; d++) {
    const i = hint < 0 ? d : (((hint + d) % t.n) + t.n) % t.n;
    const dx = x - t.x[i]!, dz = z - t.z[i]!;
    const q = dx * dx + dz * dz;
    if (q < bd) (bd = q), (best = i);
  }
  const i = best;
  const dx = x - t.x[i]!, dz = z - t.z[i]!;
  const along = dx * t.tx[i]! + dz * t.tz[i]!;
  const lat = -dx * t.tz[i]! + dz * t.tx[i]!;
  let s = i * t.ds + along;
  if (s < 0) s += t.length;
  if (s >= t.length) s -= t.length;
  const j = along >= 0 ? (i + 1) % t.n : (i - 1 + t.n) % t.n;
  const f = Math.min(1, Math.abs(along) / t.ds);
  return { i, s, lat, y: t.y[i]! + (t.y[j]! - t.y[i]!) * f };
}

/** The point `lat` metres right of the centre, `s` metres along the lap, and the way the road runs there. */
export function pointAt(t: Track, s: number, lat = 0): { x: number; z: number; y: number; tx: number; tz: number; i: number } {
  const L = t.length;
  s = ((s % L) + L) % L;
  const f = s / t.ds;
  const i = Math.floor(f) % t.n, j = (i + 1) % t.n, u = f - Math.floor(f);
  let tx = t.tx[i]! + (t.tx[j]! - t.tx[i]!) * u, tz = t.tz[i]! + (t.tz[j]! - t.tz[i]!) * u;
  const l = Math.hypot(tx, tz) || 1;
  (tx /= l), (tz /= l);
  return {
    x: t.x[i]! + (t.x[j]! - t.x[i]!) * u - tz * lat,
    z: t.z[i]! + (t.z[j]! - t.z[i]!) * u + tx * lat,
    y: t.y[i]! + (t.y[j]! - t.y[i]!) * u,
    tx,
    tz,
    i,
  };
}

/** A value of a per-sample array at a distance along the lap (between the samples). */
export function along(t: Track, a: Float32Array, s: number): number {
  const L = t.length;
  s = ((s % L) + L) % L;
  const f = s / t.ds;
  const i = Math.floor(f) % t.n, u = f - Math.floor(f);
  return a[i]! + (a[(i + 1) % t.n]! - a[i]!) * u;
}
