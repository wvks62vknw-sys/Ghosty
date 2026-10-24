/**
 * Room JSON v2's architecture, shared by the phone (the SPACE PLANNER, the 3D STUDIO) and the
 * brain (design_review): rooms as polygons, walls with a thickness, doors and windows on the
 * walls, and the plain geometry every one of them needs — area and perimeter, "is this inside the
 * room?", where an opening sits, the floor a door sweeps, which way a window faces. Pure, no DOM.
 *
 * Coordinates are centimetres on the plan: x left → right, y top → bottom (the screen's way), so a
 * polygon listed corner by corner may go either way round; nothing here assumes which.
 *
 * Room JSON v2 (MAP.md, "Room JSON"), everything after `items` optional — a v1 file is v2 with one
 * rectangular room and no openings:
 *   { "v": 2, "room": { "w": 600, "d": 420, "h": 240 }, "wall": 10, "north": 0,
 *     "rooms": [ { "id": "r1", "name": "Living room", "poly": [[0,0],[420,0],[420,420],[0,420]] } ],
 *     "openings": [ { "id": "o1", "type": "door", "room": "r1", "wall": 2, "at": 40, "w": 80,
 *                     "hinge": "start", "swing": "in" },
 *                   { "id": "o2", "type": "window", "room": "r1", "wall": 0, "at": 150, "w": 120,
 *                     "h": 120, "sill": 90 } ],
 *     "items": [ … as v1 … ] }
 * `room` is the box round every room (so a v1 reader still builds something sensible); `wall` is
 * the wall thickness; `north` the compass bearing of the plan's top edge (0 = north is up). An
 * opening sits on wall number `wall` of its room — the edge from corner `wall` to the next — `at`
 * cm from that corner, `w` wide; a door is `h` tall (200), hinged at the `start` or `end` of its
 * width and swings `in` (into its room) or `out`; a window is `h` tall (120) above a `sill` (90).
 */

export type Pt = [number, number];

export interface RoomShape {
  id: string;
  name: string;
  /** Corners in order, cm; either way round. */
  poly: Pt[];
}

export interface Opening {
  id: string;
  type: 'door' | 'window';
  /** The room whose wall it is on. */
  room: string;
  /** Which wall: the edge from corner `wall` to corner `wall + 1` (wrapping round). */
  wall: number;
  /** From that wall's first corner to the opening's near side, cm. */
  at: number;
  w: number;
  h: number;
  /** Windows: the height of the bottom of the window above the floor (doors 0). */
  sill: number;
  /** Doors: hinged at the near (`start`) or far (`end`) side of the opening. */
  hinge: 'start' | 'end';
  /** Doors: swings into its room or out of it. */
  swing: 'in' | 'out';
}

export interface Layout {
  rooms: RoomShape[];
  openings: Opening[];
  /** Wall thickness, cm. */
  wall: number;
  /** Ceiling height, cm. */
  h: number;
  /** Compass bearing of the plan's top edge, degrees (0: north is up). */
  north: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULTS = { wall: 10, h: 240, door: { w: 80, h: 200 }, window: { w: 100, h: 120, sill: 90 } } as const;
/** At most this many rooms, corners per room and openings in a plan (a phone draws them all). */
export const LIMITS = { rooms: 12, corners: 24, openings: 60 } as const;
const MIN_OPENING = 30;
/** Openings keep this far (cm) from a corner and from each other: the wall needs something to hang on. */
const JAMB = 5;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const round1 = (v: number) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ polygons

/** Twice the signed area (positive when the corners go clockwise on screen, y down). */
export function signed2(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    s += x0 * y1 - x1 * y0;
  }
  return s;
}

/** Floor area, cm². */
export const polyArea = (poly: Pt[]): number => Math.abs(signed2(poly)) / 2;

/** Length of all the walls, cm. */
export function polyPerimeter(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += dist(poly[i]!, poly[(i + 1) % poly.length]!);
  return s;
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** An area in both units the owner reads: "15.1 m² (163 ft²)". */
export function areaText(cm2: number): string {
  const m2 = cm2 / 10000;
  return `${m2.toFixed(1)} m² (${Math.round(m2 * 10.7639)} ft²)`;
}

/** The box round some corners. */
export function bounds(points: Pt[]): Rect {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface Edge {
  a: Pt;
  b: Pt;
  len: number;
  /** Unit vector from a to b. */
  ux: number;
  uy: number;
  /** Unit normal pointing out of the room. */
  nx: number;
  ny: number;
}

/** Wall `i` of a room: from corner i to the next, with its outward normal. */
export function edgeOf(poly: Pt[], i: number): Edge {
  const n = poly.length;
  const a = poly[((i % n) + n) % n]!;
  const b = poly[(((i + 1) % n) + n) % n]!;
  const len = dist(a, b) || 1e-9;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  // Clockwise on screen (y down): the outside is to the left of travel, (uy, −ux).
  const cw = signed2(poly) > 0;
  return { a, b, len, ux, uy, nx: cw ? uy : -uy, ny: cw ? -ux : ux };
}

/** Is corner i convex (pointing out of the room) rather than a re-entrant corner of an L? */
export function convexAt(poly: Pt[], i: number): boolean {
  const n = poly.length;
  const p = poly[(i - 1 + n) % n]!;
  const c = poly[i % n]!;
  const q = poly[(i + 1) % n]!;
  const cross = (c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]);
  return signed2(poly) > 0 ? cross >= 0 : cross <= 0;
}

/** Inside the polygon, or on its edge (within `eps` cm). */
export function pointInPoly(p: Pt, poly: Pt[], eps = 0.5): boolean {
  for (let i = 0; i < poly.length; i++) if (segDist(p, poly[i]!, poly[(i + 1) % poly.length]!) <= eps) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Do segments ab and cd cross at a point inside both (touching ends do not count)? */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  const e = 1e-6;
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}

/** A rectangle wholly inside a room (corners in, no corner of the room poking into it, no wall across it). */
export function rectInPoly(r: Rect, poly: Pt[], eps = 0.5): boolean {
  const c: Pt[] = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
  ];
  if (!c.every((p) => pointInPoly(p, poly, eps))) return false;
  if (poly.some(([x, y]) => x > r.x + eps && x < r.x + r.w - eps && y > r.y + eps && y < r.y + r.h - eps)) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, c[k]!, c[(k + 1) % 4]!)) return false;
  }
  return true;
}

/** A simple polygon: 3 to 24 corners, a real area, no wall crossing another. */
export function polyProblem(poly: Pt[]): string | null {
  if (poly.length < 3) return 'a room needs at least three corners';
  if (poly.length > LIMITS.corners) return `a room has at most ${LIMITS.corners} corners`;
  for (let i = 0; i < poly.length; i++) if (dist(poly[i]!, poly[(i + 1) % poly.length]!) < 1) return 'two corners of a room are in the same place';
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return 'two walls of a room cross';
    }
  }
  if (polyArea(poly) < 2500) return 'a room must be at least 50 × 50 cm';
  return null;
}

/** A rectangular room's corners, clockwise on screen from the top-left. */
export const rectPoly = (x: number, y: number, w: number, d: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + d],
  [x, y + d],
];

export type Corner = 'tl' | 'tr' | 'br' | 'bl';

/** An L-shaped room: the w × d box with an nw × nd notch taken out of one corner (clockwise from the top-left). */
export function lPoly(x: number, y: number, w: number, d: number, nw: number, nd: number, corner: Corner): Pt[] {
  const a = Math.max(10, Math.min(nw, w - 10));
  const b = Math.max(10, Math.min(nd, d - 10));
  const X = x + w;
  const Y = y + d;
  if (corner === 'tr') return [[x, y], [X - a, y], [X - a, y + b], [X, y + b], [X, Y], [x, Y]];
  if (corner === 'br') return [[x, y], [X, y], [X, Y - b], [X - a, Y - b], [X - a, Y], [x, Y]];
  if (corner === 'bl') return [[x, y], [X, y], [X, Y], [x + a, Y], [x + a, Y - b], [x, Y - b]];
  return [[x + a, y], [X, y], [X, Y], [x, Y], [x, y + b], [x + a, y + b]];
}

/**
 * The floor as triangles (indices into the corners), by ear clipping: enough for the dozen-corner
 * rooms people draw. Works either way round.
 */
export function triangulate(poly: Pt[]): number[] {
  const n = poly.length;
  if (n < 3) return [];
  const idx = Array.from({ length: n }, (_, i) => i);
  const cw = signed2(poly) > 0;
  const out: number[] = [];
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inTri = (p: Pt, a: Pt, b: Pt, c: Pt) => {
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k - 1 + idx.length) % idx.length]!;
      const i1 = idx[k]!;
      const i2 = idx[(k + 1) % idx.length]!;
      const a = poly[i0]!;
      const b = poly[i1]!;
      const c = poly[i2]!;
      const turn = cross(a, b, c);
      if (cw ? turn <= 1e-9 : turn >= -1e-9) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inTri(poly[j]!, a, b, c))) continue;
      out.push(i0, i1, i2);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(idx[0]!, idx[1]!, idx[2]!);
  return out;
}

// ------------------------------------------------------------------ rooms side by side

/**
 * Do two rooms share floor (not just a wall)? Tested where walls cross and at the middle of every
 * cell of the grid their corners make (the same test as the planner's space/rooms.ts roomsOverlap).
 */
export function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (segmentsCross(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) return true;
  const xs = [...new Set([...a, ...b].map((q) => q[0]))].sort((x, y) => x - y);
  const ys = [...new Set([...a, ...b].map((q) => q[1]))].sort((x, y) => x - y);
  for (let j = 0; j + 1 < ys.length; j++) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const c: Pt = [(xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2];
      if (pointInPoly(c, a, 0) && pointInPoly(c, b, 0)) return true;
    }
  }
  return false;
}

/** A stretch of one wall of a room: wall number `wall`, from `from` to `to` cm along it from its first corner. */
export interface WallSpan {
  wall: number;
  from: number;
  to: number;
}

/**
 * Where room `a` shares a wall with room `b`: for each of a's walls, the stretch that lies along
 * one of b's walls on the same line, the two rooms on either side of it (where a door between
 * them can go). Empty when they only touch at a corner or not at all.
 */
export function sharedWalls(a: Pt[], b: Pt[], eps = 0.5): WallSpan[] {
  const out: WallSpan[] = [];
  for (let i = 0; i < a.length; i++) {
    const e = edgeOf(a, i);
    for (let j = 0; j < b.length; j++) {
      const f = edgeOf(b, j);
      // facing each other: the outsides point opposite ways, and b's wall lies on a's line
      if (Math.abs(e.nx + f.nx) > 1e-6 || Math.abs(e.ny + f.ny) > 1e-6) continue;
      const off = (p: Pt) => (p[0] - e.a[0]) * e.nx + (p[1] - e.a[1]) * e.ny;
      if (Math.abs(off(f.a)) > eps || Math.abs(off(f.b)) > eps) continue;
      const along = (p: Pt) => (p[0] - e.a[0]) * e.ux + (p[1] - e.a[1]) * e.uy;
      const s0 = Math.max(0, Math.min(along(f.a), along(f.b)));
      const s1 = Math.min(e.len, Math.max(along(f.a), along(f.b)));
      if (s1 - s0 > eps) out.push({ wall: i, from: s0, to: s1 });
    }
  }
  return out;
}

/** The outside walls of a room among others: each stretch of its walls that no other room is on the far side of (for windows and outside doors). */
export function outsideWalls(room: RoomShape, rooms: RoomShape[]): WallSpan[] {
  const shared = rooms.filter((r) => r.id !== room.id).flatMap((r) => sharedWalls(room.poly, r.poly));
  const out: WallSpan[] = [];
  for (let i = 0; i < room.poly.length; i++) {
    const len = edgeOf(room.poly, i).len;
    const cuts = shared.filter((s) => s.wall === i).sort((x, y) => x.from - y.from);
    let at = 0;
    for (const c of cuts) {
      if (c.from - at > 0.5) out.push({ wall: i, from: at, to: c.from });
      at = Math.max(at, c.to);
    }
    if (len - at > 0.5) out.push({ wall: i, from: at, to: len });
  }
  return out;
}

// ------------------------------------------------------------------ openings

/** Where an opening is on the plan: its two ends along the wall (start, end), its middle, and the wall. */
export function openingSpan(room: RoomShape, op: Opening): { p0: Pt; p1: Pt; mid: Pt; edge: Edge } {
  const e = edgeOf(room.poly, op.wall);
  const p0: Pt = [e.a[0] + e.ux * op.at, e.a[1] + e.uy * op.at];
  const p1: Pt = [p0[0] + e.ux * op.w, p0[1] + e.uy * op.w];
  return { p0, p1, mid: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], edge: e };
}

/**
 * The floor a door sweeps: the hinge, the door's tip shut and fully open, and the square box
 * round the quarter circle (what must be kept clear). A window sweeps nothing.
 */
export function doorSwing(room: RoomShape, op: Opening): { hinge: Pt; shut: Pt; open: Pt; box: Rect } | null {
  if (op.type !== 'door') return null;
  const { p0, p1, edge } = openingSpan(room, op);
  const [hinge, shut] = op.hinge === 'end' ? [p1, p0] : [p0, p1];
  const k = op.swing === 'out' ? 1 : -1;
  const open: Pt = [hinge[0] + edge.nx * k * op.w, hinge[1] + edge.ny * k * op.w];
  const far: Pt = [shut[0] + edge.nx * k * op.w, shut[1] + edge.ny * k * op.w];
  return { hinge, shut, open, box: bounds([hinge, shut, open, far]) };
}

/** The compass direction a window looks out to ("S", "NE"…), given the plan's `north`. */
export function facing(room: RoomShape, op: Opening, north = 0): string {
  const e = edgeOf(room.poly, op.wall);
  // Up the plan (y −) is `north` degrees; bearings go clockwise, as do angles on a y-down screen.
  const bearing = (((Math.atan2(e.nx, -e.ny) * 180) / Math.PI + north) % 360 + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8]!;
}

/** Why an opening cannot be where it is, in words; null when it can. `others` are the plan's other openings. */
export function openingProblem(room: RoomShape | undefined, op: Opening, others: Opening[], ceiling: number): string | null {
  const what = op.type === 'door' ? 'door' : 'window';
  if (!room) return `the ${what} is on a room that is not in the plan`;
  if (!(op.wall >= 0 && op.wall < room.poly.length && Number.isInteger(op.wall))) return `the ${what} is on a wall ${room.name} does not have`;
  if (!(op.w >= MIN_OPENING)) return `a ${what} must be at least ${MIN_OPENING} cm wide`;
  const e = edgeOf(room.poly, op.wall);
  if (op.at < JAMB - 0.01 || op.at + op.w > e.len - JAMB + 0.01) return `the ${what} (${round1(op.w)} cm) does not fit on that ${round1(e.len)} cm wall`;
  if (!(op.h > 0) || op.sill < 0 || op.sill + op.h > ceiling + 0.01) return `the ${what} is taller than the room`;
  for (const o of others) {
    if (o.id === op.id || o.room !== op.room || o.wall !== op.wall) continue;
    if (op.at < o.at + o.w + JAMB - 0.01 && o.at < op.at + op.w + JAMB - 0.01) return `the ${what} overlaps another opening on the same wall`;
  }
  return null;
}

// ------------------------------------------------------------------ reading

const str = (v: unknown, max: number, fallback: string) => {
  const s = typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim().slice(0, max) : '';
  return s || fallback;
};

/**
 * The architecture of a Room JSON (v1 or v2), checked: rooms with a bad outline and openings that
 * do not fit are left out (named in `dropped`). A v1 file — or a v2 one without rooms — is one
 * rectangular room the size of `room`, with no openings. Null when there is no room at all.
 */
export function readLayout(json: unknown): (Layout & { dropped: string[] }) | null {
  const o = (json ?? {}) as { room?: { w?: unknown; d?: unknown; h?: unknown }; rooms?: unknown; openings?: unknown; wall?: unknown; north?: unknown };
  if (!o || typeof o !== 'object') return null;
  const dropped: string[] = [];
  const hh = num(o.room?.h);
  const h = hh !== null && hh >= 100 && hh <= 1000 ? hh : DEFAULTS.h;
  const wl = num(o.wall);
  const wall = wl !== null && wl >= 2 && wl <= 60 ? wl : DEFAULTS.wall;
  const nn = num(o.north);
  const north = nn !== null ? ((nn % 360) + 360) % 360 : 0;
  const rooms: RoomShape[] = [];
  if (Array.isArray(o.rooms)) {
    for (const [i, raw] of (o.rooms as unknown[]).slice(0, LIMITS.rooms).entries()) {
      const r = (raw ?? {}) as { id?: unknown; name?: unknown; poly?: unknown };
      const poly: Pt[] = Array.isArray(r.poly) ? (r.poly as unknown[]).flatMap((p): Pt[] => (Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null ? [[round1(num(p[0])!), round1(num(p[1])!)]] : [])) : [];
      const name = str(r.name, 30, `Room ${i + 1}`);
      const bad = polyProblem(poly) ?? (poly.some(([x, y]) => Math.abs(x) > 10000 || Math.abs(y) > 10000) ? 'a room must be within 100 m' : null);
      if (bad) {
        dropped.push(`${name}: ${bad}`);
        continue;
      }
      let id = str(r.id, 24, `r${i + 1}`);
      while (rooms.some((x) => x.id === id)) id = `${id}_`;
      rooms.push({ id, name, poly });
    }
  }
  if (!rooms.length) {
    const w = num(o.room?.w);
    const d = num(o.room?.d);
    if (w === null || d === null || w < 50 || d < 50 || w > 5000 || d > 5000) return null;
    rooms.push({ id: 'r1', name: 'Room', poly: rectPoly(0, 0, w, d) });
  }
  const openings: Opening[] = [];
  if (Array.isArray(o.openings)) {
    for (const [i, raw] of (o.openings as unknown[]).slice(0, LIMITS.openings).entries()) {
      const x = (raw ?? {}) as Record<string, unknown>;
      const type = x.type === 'window' ? 'window' : x.type === 'door' ? 'door' : null;
      if (!type) {
        dropped.push(`opening ${i + 1}: neither a door nor a window`);
        continue;
      }
      const dflt = type === 'door' ? { ...DEFAULTS.door, sill: 0 } : DEFAULTS.window;
      let id = str(x.id, 24, `o${i + 1}`);
      while (openings.some((p) => p.id === id)) id = `${id}_`;
      const op: Opening = {
        id,
        type,
        room: str(x.room, 24, rooms[0]!.id),
        wall: num(x.wall) ?? -1,
        at: round1(num(x.at) ?? 0),
        w: round1(num(x.w) ?? dflt.w),
        h: round1(num(x.h) ?? dflt.h),
        sill: type === 'door' ? 0 : round1(num(x.sill) ?? dflt.sill),
        hinge: x.hinge === 'end' ? 'end' : 'start',
        swing: x.swing === 'out' ? 'out' : 'in',
      };
      const bad = openingProblem(rooms.find((r) => r.id === op.room), op, openings, h);
      if (bad) dropped.push(`${type} ${i + 1}: ${bad}`);
      else openings.push(op);
    }
  }
  return { rooms, openings, wall, h, north, dropped };
}

/** The box round every room of a layout. */
export const layoutBounds = (rooms: RoomShape[]): Rect => bounds(rooms.flatMap((r) => r.poly));

/** A layout that is just one rectangle with nothing in its walls (what a v1 file can say). */
export function isPlainBox(l: Pick<Layout, 'rooms' | 'openings'>): boolean {
  if (l.rooms.length !== 1 || l.openings.length) return false;
  const p = l.rooms[0]!.poly;
  const b = bounds(p);
  return p.length === 4 && b.x === 0 && b.y === 0 && p.every(([x, y]) => (x === 0 || x === b.w) && (y === 0 || y === b.h));
}

/** The room a point is in (the first, when rooms overlap), or null. */
export const roomAt = (rooms: RoomShape[], p: Pt): RoomShape | null => rooms.find((r) => pointInPoly(p, r.poly)) ?? null;

/** A rectangle wholly inside one of the rooms. */
export const rectInRooms = (rooms: RoomShape[], r: Rect): boolean => rooms.some((room) => rectInPoly(r, room.poly));

/**
 * Rectangles covering the parts of the box round the rooms that are NOT floor (the notch of an L,
 * the gap between two rooms): furniture must keep out of them. Exact for walls that run straight
 * across or down the plan; a slanted wall is approximated by the grid of its corners.
 */
export function outsideRects(rooms: RoomShape[]): Rect[] {
  const b = layoutBounds(rooms);
  const xs = [...new Set([b.x, b.x + b.w, ...rooms.flatMap((r) => r.poly.map((p) => p[0]))])].sort((a, c) => a - c);
  const ys = [...new Set([b.y, b.y + b.h, ...rooms.flatMap((r) => r.poly.map((p) => p[1]))])].sort((a, c) => a - c);
  const out: Rect[] = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const c: Pt = [(xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2];
      if (roomAt(rooms, c)) continue;
      const r = { x: xs[i]!, y: ys[j]!, w: xs[i + 1]! - xs[i]!, h: ys[j + 1]! - ys[j]! };
      // join with the cell to the left on the same row when it is outside too
      const last = out[out.length - 1];
      if (last && last.y === r.y && last.h === r.h && Math.abs(last.x + last.w - r.x) < 1e-6) last.w += r.w;
      else out.push(r);
    }
  }
  return out;
}

/** One line per room for words: "Living room 15.1 m² (163 ft²), walls 15.6 m; 1 door, 2 windows". */
export function describeRooms(l: Pick<Layout, 'rooms' | 'openings'>): string[] {
  return l.rooms.map((r) => {
    const ops = l.openings.filter((o) => o.room === r.id);
    const doors = ops.filter((o) => o.type === 'door').length;
    const wins = ops.length - doors;
    const parts = [doors ? `${doors} door${doors > 1 ? 's' : ''}` : '', wins ? `${wins} window${wins > 1 ? 's' : ''}` : ''].filter(Boolean);
    return `${r.name} ${areaText(polyArea(r.poly))}, ${r.poly.length === 4 ? 'rectangular' : `${r.poly.length} corners`}, walls ${(polyPerimeter(r.poly) / 100).toFixed(1)} m${parts.length ? `; ${parts.join(', ')}` : ''}`;
  });
}

// ------------------------------------------------------------------ furniture on the plan

/** A Room JSON piece of furniture: the UNTURNED rectangle's corner, turned `rot` degrees clockwise about its centre. */
export interface PlanItem {
  id?: string;
  kind?: string;
  name: string;
  w: number;
  d: number;
  h?: number;
  x: number;
  y: number;
  rot?: number;
}

/** A whole Room JSON v2, read and checked. */
export interface DesignPlan extends Layout {
  v: 2;
  /** The box round every room (its corner is 0, 0). */
  room: { w: number; d: number; h: number };
  items: PlanItem[];
}

const overlaps = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** The floor a piece covers (the box round it when it is turned at an angle). */
export function itemRect(it: Pick<PlanItem, 'w' | 'd' | 'x' | 'y' | 'rot'>): Rect {
  const r = ((it.rot ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const fw = it.w * c + it.d * s;
  const fh = it.w * s + it.d * c;
  const cx = it.x + it.w / 2;
  const cy = it.y + it.d / 2;
  return { x: round1(cx - fw / 2), y: round1(cy - fh / 2), w: round1(fw), h: round1(fh) };
}

/** Does this floor rectangle stand where a door swings? */
export function inSwing(room: RoomShape, op: Opening, r: Rect): boolean {
  const s = doorSwing(room, op);
  if (!s || !overlaps(s.box, r, -1)) return false;
  const cx = Math.max(r.x, Math.min(s.hinge[0], r.x + r.w));
  const cy = Math.max(r.y, Math.min(s.hinge[1], r.y + r.h));
  return Math.hypot(cx - s.hinge[0], cy - s.hinge[1]) < op.w - 1;
}

/**
 * A Room JSON (v1 or v2) as a checked v2 plan: the layout from readLayout, every room moved so
 * the box round them starts at 0, 0 (furniture moved with them), and the pieces with a real size.
 */
export function readDesign(json: unknown): (DesignPlan & { dropped: string[] }) | null {
  let v: unknown = json;
  if (typeof json === 'string') {
    try {
      v = JSON.parse(json);
    } catch {
      return null;
    }
  }
  const lay = readLayout(v);
  if (!lay) return null;
  const b = layoutBounds(lay.rooms);
  const dx = -b.x;
  const dy = -b.y;
  const rooms = lay.rooms.map((r) => ({ ...r, poly: r.poly.map(([x, y]): Pt => [round1(x + dx), round1(y + dy)]) }));
  const raw = (v as { items?: unknown }).items;
  const items: PlanItem[] = [];
  for (const [i, x] of (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).slice(0, 120).entries()) {
    if (!x || typeof x !== 'object') continue;
    const w = num(x.w);
    const d = num(x.d);
    if (w === null || d === null || w <= 0 || d <= 0 || w > 2000 || d > 2000) continue;
    const h = num(x.h);
    items.push({
      ...(x.id !== undefined ? { id: str(x.id, 24, `i${i}`) } : {}),
      ...(x.kind !== undefined ? { kind: str(x.kind, 20, 'custom') } : {}),
      name: str(x.name ?? x.label, 40, 'Item'),
      w,
      d,
      ...(h !== null && h > 0 && h <= 1000 ? { h } : {}),
      x: (num(x.x) ?? 0) + dx,
      y: (num(x.y) ?? 0) + dy,
      rot: num(x.rot) ?? 0,
    });
  }
  return { v: 2, room: { w: round1(b.w), d: round1(b.h), h: lay.h }, h: lay.h, wall: lay.wall, north: lay.north, rooms, openings: lay.openings, items, dropped: lay.dropped };
}

/** What is wrong with a plan's furniture, in words: pieces outside every room, on top of each other, or where a door swings. */
export function designProblems(p: Pick<DesignPlan, 'rooms' | 'openings' | 'items'>): string[] {
  const out: string[] = [];
  const rects = p.items.map(itemRect);
  p.items.forEach((it, i) => {
    if (!rectInRooms(p.rooms, rects[i]!)) out.push(`${it.name} is not inside a room`);
    for (let j = i + 1; j < p.items.length; j++) if (overlaps(rects[i]!, rects[j]!, -0.5)) out.push(`${it.name} overlaps ${p.items[j]!.name}`);
    for (const op of p.openings) {
      const room = p.rooms.find((r) => r.id === op.room);
      if (room && inSwing(room, op, rects[i]!)) out.push(`${it.name} is where the door ${op.id} swings`);
    }
  });
  return out;
}

/**
 * Can a suggested change be applied to the plan the owner has? Its plan must read back whole
 * (nothing dropped), keep the same rooms, and add no problem the owner's plan did not have.
 * Null when it can; otherwise why not.
 */
export function changeProblem(before: unknown, after: unknown): string | null {
  const a = readDesign(before);
  const b = readDesign(after);
  if (!a || !b) return 'the changed plan could not be read';
  if (b.dropped.length) return `the changed plan has a mistake: ${b.dropped[0]}`;
  if (a.rooms.length !== b.rooms.length || a.rooms.some((r, i) => polyArea(r.poly) !== polyArea(b.rooms[i]!.poly))) return 'the change would alter the rooms themselves';
  const had = new Set(designProblems(a));
  const fresh = designProblems(b).filter((x) => !had.has(x));
  return fresh.length ? `the change would leave ${fresh[0]}` : null;
}

/** The most grid cells a search over the plan may visit (a 14 × 14 m plan at 10 cm). */
export const MAX_CELLS = 20_000;

/**
 * The grid step (cm) for a search over a w × h box: `min`, or coarser (in 5 cm steps) so the grid
 * stays within MAX_CELLS — a 100 m plan (typed in mm, or imported) must not stall the brain.
 */
export function gridStep(w: number, h: number, min = 10): number {
  return Math.max(min, Math.ceil(Math.sqrt((Math.max(0, w) * Math.max(0, h)) / MAX_CELLS) / 5) * 5);
}

/**
 * The biggest open rectangle of floor (cm), on a `cell` grid: floor that is in a room and under no
 * furniture. The classic largest rectangle in a histogram, row by row.
 */
export function openFloor(p: Pick<DesignPlan, 'rooms' | 'items'>, cell = 10): Rect & { area: number } {
  const b = layoutBounds(p.rooms);
  cell = gridStep(b.w, b.h, cell);
  const cols = Math.max(1, Math.floor(b.w / cell));
  const rows = Math.max(1, Math.floor(b.h / cell));
  const free = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (roomAt(p.rooms, [b.x + (x + 0.5) * cell, b.y + (y + 0.5) * cell])) free[y * cols + x] = 1;
  // Each piece clears the cells whose centres it covers (a cell at a time per piece, not every piece per cell).
  for (const r of p.items.map(itemRect)) {
    const x0 = Math.max(0, Math.floor((r.x - b.x) / cell - 0.5) + 1);
    const x1 = Math.min(cols - 1, Math.ceil((r.x + r.w - b.x) / cell - 0.5) - 1);
    const y0 = Math.max(0, Math.floor((r.y - b.y) / cell - 0.5) + 1);
    const y1 = Math.min(rows - 1, Math.ceil((r.y + r.h - b.y) / cell - 0.5) - 1);
    for (let y = y0; y <= y1; y++) free.fill(0, y * cols + x0, y * cols + x1 + 1);
  }
  const hts = new Int32Array(cols);
  let best = { x: 0, y: 0, w: 0, h: 0, area: 0 };
  const stack: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) hts[x] = free[y * cols + x] ? hts[x]! + 1 : 0;
    stack.length = 0;
    for (let x = 0; x <= cols; x++) {
      const hgt = x < cols ? hts[x]! : 0;
      while (stack.length && hts[stack[stack.length - 1]!]! >= hgt) {
        const top = stack.pop()!;
        const hh = hts[top]!;
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
        const area = (x - left) * hh * cell * cell;
        if (area > best.area) best = { x: b.x + left * cell, y: b.y + (y - hh + 1) * cell, w: (x - left) * cell, h: hh * cell, area };
      }
      stack.push(x);
    }
  }
  return best;
}

/** A plan as plain Room JSON v2 (what goes in a file, to the brain, or back to the phone). */
export function toRoomJson(p: DesignPlan): Record<string, unknown> {
  return { v: 2, room: { ...p.room }, wall: p.wall, north: p.north, rooms: p.rooms.map((r) => ({ id: r.id, name: r.name, poly: r.poly.map((q) => [q[0], q[1]]) })), openings: p.openings.map((o) => ({ ...o })), items: p.items.map((i) => ({ ...i })) };
}
