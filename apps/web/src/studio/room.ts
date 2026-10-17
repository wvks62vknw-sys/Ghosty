/**
 * The ROOM generator: a room's size and its furniture (in centimetres, as the SPACE PLANNER
 * exports it or as typed) → boxes in metres for the 3D STUDIO to build, so the owner can walk
 * round a room design. Pure, unit-tested in Node.
 *
 * The shared shape (MAP.md, "Room JSON"):
 *   { "room": { "w": 400, "d": 300, "h": 240 },
 *     "items": [ { "name": "Sofa", "w": 200, "d": 90, "h": 85, "x": 20, "y": 200, "rot": 0 } ] }
 * w = width (left to right on the plan), d = depth (top to bottom on the plan), h = height;
 * x, y = the item's top-left corner on the plan, measured from the room's top-left corner, as a
 * planner draws it before turning; rot = degrees clockwise seen from above, about the item's own
 * centre. room.h and item h are optional (240 cm and 75 cm). The planner's own shape (quarter
 * turns, `label`) is read too, converted by space/roomjson.ts.
 *
 * Room JSON v2 adds rooms as polygons, doors and windows and the wall thickness
 * (packages/shared/src/design.ts): such a plan is built wall by wall — each wall cut round its
 * openings (solid pieces either side, a lintel above, a sill and a pane of glass for a window, the
 * door leaf standing open), a floor (and, asked for, a ceiling) the shape of each room. A plain
 * box room with nothing in its walls is built exactly as before.
 */
import { DEFAULTS, convexAt, doorSwing, edgeOf, isPlainBox, layoutBounds, openingSpan, readLayout, rectInRooms, roomAt, type Layout, type Opening, type Pt, type RoomShape } from '../../../../packages/shared/src/design';
import { readPlan } from '../space/plan';
import { isPlannerPlan, planToRoom } from '../space/roomjson';

export interface RoomItem {
  name: string;
  w: number;
  d: number;
  h?: number;
  x: number;
  y: number;
  rot?: number;
}
export interface RoomPlan {
  room: { w: number; d: number; h?: number };
  items?: RoomItem[];
  /** Room JSON v2's architecture, when the plan has any (rooms in cm, the box round them at 0, 0). */
  rooms?: RoomShape[];
  openings?: Opening[];
  wall?: number;
  north?: number;
}

/**
 * One box to build: centre and size in metres (y is up), turned `rotY` radians about the vertical.
 * A floor or ceiling with `poly` is a slab that shape (corners in metres, x and z about the plan's
 * centre) `size[1]` thick, its top at pos[1] + size[1] / 2.
 */
export interface Box {
  name: string;
  kind: 'floor' | 'ceiling' | 'wall' | 'item' | 'glass' | 'door';
  size: [number, number, number];
  pos: [number, number, number];
  rotY: number;
  poly?: [number, number][];
}

export const WALL_M = 0.1;
const MAX_ITEMS = 120;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Read a room plan from text (JSON) or an object; throws an Error saying plainly what is wrong. */
export function parseRoom(input: unknown): RoomPlan {
  let v: unknown = input;
  if (typeof input === 'string') {
    try {
      v = JSON.parse(input);
    } catch {
      throw new Error('that is not room JSON — it should look like {"room":{"w":400,"d":300,"h":240},"items":[…]}');
    }
  }
  if (isPlannerPlan(v)) {
    const p = readPlan(v);
    if (p) v = planToRoom(p);
  }
  const o = (v ?? {}) as { room?: unknown; items?: unknown; w?: unknown; d?: unknown; h?: unknown };
  const r = (o.room && typeof o.room === 'object' ? o.room : o) as { w?: unknown; d?: unknown; h?: unknown };
  const w = num(r.w);
  const d = num(r.d);
  const h = num(r.h);
  if (w === null || d === null) throw new Error('the room needs a width (w) and a depth (d) in centimetres');
  if (w < 50 || d < 50 || w > 5000 || d > 5000) throw new Error('room width and depth must be between 50 cm and 50 m');
  if (h !== null && (h < 100 || h > 1000)) throw new Error('room height must be between 1 m and 10 m');
  const list = Array.isArray(o.items) ? o.items : [];
  const items: RoomItem[] = [];
  for (const it of list.slice(0, MAX_ITEMS)) {
    const x = it as Record<string, unknown>;
    const iw = num(x.w);
    const id = num(x.d);
    const ix = num(x.x) ?? 0;
    const iy = num(x.y) ?? 0;
    if (iw === null || id === null || iw <= 0 || id <= 0 || iw > 2000 || id > 2000) continue;
    const ih = num(x.h);
    items.push({
      name: String(x.name ?? 'Item').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Item',
      w: iw,
      d: id,
      ...(ih !== null && ih > 0 && ih <= 1000 ? { h: ih } : {}),
      x: ix,
      y: iy,
      rot: num(x.rot) ?? 0,
    });
  }
  // v2: the architecture, checked (a wall, door or window that does not fit is left out).
  const arch = o as { rooms?: unknown; openings?: unknown; wall?: unknown; north?: unknown };
  if ((Array.isArray(arch.rooms) && arch.rooms.length) || (Array.isArray(arch.openings) && arch.openings.length)) {
    const lay = readLayout({ room: { w, d, h: h ?? undefined }, rooms: arch.rooms, openings: arch.openings, wall: arch.wall, north: arch.north });
    if (lay && !isPlainBox(lay)) {
      // Rooms drawn away from 0, 0 are moved there (the furniture with them); the box grows to hold them.
      const b = layoutBounds(lay.rooms);
      const rooms = lay.rooms.map((r) => ({ ...r, poly: r.poly.map(([x, y]): Pt => [x - b.x, y - b.y]) }));
      const moved = b.x || b.y ? items.map((it) => ({ ...it, x: it.x - b.x, y: it.y - b.y })) : items;
      return { room: { w: Math.max(w, b.w), d: Math.max(d, b.h), ...(h !== null ? { h } : {}) }, items: moved, rooms, openings: lay.openings, wall: lay.wall, north: lay.north };
    }
  }
  return { room: { w, d, ...(h !== null ? { h } : {}) }, items };
}

/** The architecture of a room plan: its own rooms and openings, or the one box room a v1 plan is. */
export function layoutOfRoom(plan: RoomPlan): Layout {
  const h = plan.room.h ?? DEFAULTS.h;
  if (plan.rooms?.length) return { rooms: plan.rooms, openings: plan.openings ?? [], wall: plan.wall ?? DEFAULTS.wall, h, north: plan.north ?? 0 };
  return { rooms: [{ id: 'r1', name: 'Room', poly: [[0, 0], [plan.room.w, 0], [plan.room.w, plan.room.d], [0, plan.room.d]] }], openings: plan.openings ?? [], wall: plan.wall ?? WALL_M * 100, h, north: plan.north ?? 0 };
}

/** One wall to build: where it runs (cm on the plan), how thick, which side of the line, and the openings in it. */
interface WallRun {
  name: string;
  a: Pt;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  /** From -start to len + end along the line (extended past convex corners so they close). */
  from: number;
  to: number;
  /** How far the wall's centre line sits outside the room's edge (t / 2 outside, 0 for a wall two rooms share). */
  off: number;
  cuts: { s0: number; s1: number; op: Opening }[];
}

/** Every wall of a layout: each room's edges, a wall two rooms share built once on the line between them. */
export function wallRuns(lay: Layout): WallRun[] {
  const t = lay.wall;
  const runs: WallRun[] = [];
  const seen = new Set<string>();
  const key = (a: Pt, b: Pt) => [a, b].map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).sort().join('|');
  for (const room of lay.rooms) {
    const n = room.poly.length;
    for (let i = 0; i < n; i++) {
      const e = edgeOf(room.poly, i);
      const mid: Pt = [(e.a[0] + e.b[0]) / 2 + e.nx * (t / 2 + 1), (e.a[1] + e.b[1]) / 2 + e.ny * (t / 2 + 1)];
      const other = roomAt(lay.rooms.filter((r) => r.id !== room.id), mid);
      if (other) {
        const k = key(e.a, e.b);
        if (seen.has(k)) continue;
        seen.add(k);
      }
      const ext = other ? 0 : t;
      const run: WallRun = { name: `${room.name}, wall ${i + 1}`, a: e.a, ux: e.ux, uy: e.uy, nx: e.nx, ny: e.ny, from: convexAt(room.poly, i) ? -ext : 0, to: e.len + (convexAt(room.poly, i + 1) ? ext : 0), off: other ? 0 : t / 2, cuts: [] };
      // Openings on this line (from this room or the one next door), cut out of it.
      for (const op of lay.openings) {
        const r = lay.rooms.find((x) => x.id === op.room);
        if (!r) continue;
        const { p0, p1 } = openingSpan(r, op);
        const along = (p: Pt) => (p[0] - e.a[0]) * e.ux + (p[1] - e.a[1]) * e.uy;
        const across = (p: Pt) => Math.abs((p[0] - e.a[0]) * e.nx + (p[1] - e.a[1]) * e.ny);
        if (across(p0) > 1 || across(p1) > 1) continue;
        const s0 = Math.max(0, Math.min(along(p0), along(p1)));
        const s1 = Math.min(e.len, Math.max(along(p0), along(p1)));
        if (s1 - s0 > 1) run.cuts.push({ s0, s1, op });
      }
      run.cuts.sort((x, y) => x.s0 - y.s0);
      runs.push(run);
    }
  }
  return runs;
}

/**
 * The boxes of a v2 plan: per room a floor slab its shape (and a ceiling when asked), per wall the
 * solid pieces between openings, a lintel over each, a sill and glass in each window, each door's
 * leaf standing open where it swings. Centred on the box round the rooms, like roomBoxes.
 */
function archBoxes(plan: RoomPlan, ceiling: boolean): Box[] {
  const lay = layoutOfRoom(plan);
  const W = plan.room.w / 100;
  const D = plan.room.d / 100;
  const H = lay.h / 100;
  const t = lay.wall / 100;
  const P = (x: number, y: number): [number, number] => [x / 100 - W / 2, y / 100 - D / 2];
  const boxes: Box[] = [];
  for (const r of lay.rooms) {
    const poly = r.poly.map(([x, y]) => P(x, y));
    boxes.push({ name: `${r.name} floor`, kind: 'floor', size: [W, 0.02, D], pos: [0, -0.01, 0], rotY: 0, poly });
    if (ceiling) boxes.push({ name: `${r.name} ceiling`, kind: 'ceiling', size: [W, 0.02, D], pos: [0, H + 0.01, 0], rotY: 0, poly });
  }
  for (const run of wallRuns(lay)) {
    const rotY = Math.atan2(-run.uy, run.ux);
    const piece = (name: string, kind: Box['kind'], s0: number, s1: number, y0: number, y1: number, thick = t) => {
      if (s1 - s0 < 0.5 || y1 - y0 < 0.005) return;
      const sc = (s0 + s1) / 2;
      const [x, z] = P(run.a[0] + run.ux * sc + run.nx * run.off, run.a[1] + run.uy * sc + run.ny * run.off);
      boxes.push({ name, kind, size: [(s1 - s0) / 100, y1 - y0, thick], pos: [x, (y0 + y1) / 2, z], rotY });
    };
    let s = run.from;
    for (const c of run.cuts) {
      piece(run.name, 'wall', s, c.s0, 0, H);
      const top = Math.min(H, (c.op.sill + c.op.h) / 100);
      piece(`${run.name}, over the ${c.op.type}`, 'wall', c.s0, c.s1, top, H);
      if (c.op.type === 'window') {
        piece(`${run.name}, under the window`, 'wall', c.s0, c.s1, 0, c.op.sill / 100);
        piece(`${run.name}, window`, 'glass', c.s0, c.s1, c.op.sill / 100, top, 0.02);
      }
      s = Math.max(s, c.s1);
    }
    piece(run.name, 'wall', s, run.to, 0, H);
  }
  // Each door's leaf, standing open along the line from its hinge to where its tip swings.
  for (const op of lay.openings) {
    const room = lay.rooms.find((r) => r.id === op.room);
    const sw = room ? doorSwing(room, op) : null;
    if (!sw) continue;
    const mx = (sw.hinge[0] + sw.open[0]) / 2;
    const my = (sw.hinge[1] + sw.open[1]) / 2;
    const [x, z] = P(mx, my);
    const ux = sw.open[0] - sw.hinge[0];
    const uy = sw.open[1] - sw.hinge[1];
    boxes.push({ name: `Door ${op.id}`, kind: 'door', size: [op.w / 100, Math.min(H, op.h / 100), 0.04], pos: [x, Math.min(H, op.h / 100) / 2, z], rotY: Math.atan2(-uy, ux) });
  }
  return boxes;
}

/**
 * Boxes for a room: the floor, four walls (outside the floor, so inside sizes are exact) and
 * every item standing on the floor. The room's centre is the origin. Warnings name items that
 * stick out of the room or are taller than it.
 */
export function roomBoxes(plan: RoomPlan, opts: { ceiling?: boolean } = {}): { boxes: Box[]; warnings: string[] } {
  const W = plan.room.w / 100;
  const D = plan.room.d / 100;
  const H = (plan.room.h ?? 240) / 100;
  const t = WALL_M;
  const arch = !!plan.rooms?.length;
  const boxes: Box[] = arch ? archBoxes(plan, !!opts.ceiling) : [
    { name: 'Floor', kind: 'floor', size: [W, 0.02, D], pos: [0, -0.01, 0], rotY: 0 },
    { name: 'Back wall', kind: 'wall', size: [W + 2 * t, H, t], pos: [0, H / 2, -D / 2 - t / 2], rotY: 0 },
    { name: 'Front wall', kind: 'wall', size: [W + 2 * t, H, t], pos: [0, H / 2, D / 2 + t / 2], rotY: 0 },
    { name: 'Left wall', kind: 'wall', size: [t, H, D], pos: [-W / 2 - t / 2, H / 2, 0], rotY: 0 },
    { name: 'Right wall', kind: 'wall', size: [t, H, D], pos: [W / 2 + t / 2, H / 2, 0], rotY: 0 },
  ];
  if (!arch && opts.ceiling) boxes.push({ name: 'Ceiling', kind: 'ceiling', size: [W, 0.02, D], pos: [0, H + 0.01, 0], rotY: 0 });
  const warnings: string[] = [];
  for (const it of plan.items ?? []) {
    const w = it.w / 100;
    const d = it.d / 100;
    const h = (it.h ?? 75) / 100;
    const rot = ((it.rot ?? 0) * Math.PI) / 180;
    // The corner is where the planner drew the unturned rectangle; turning is about its centre.
    const cx = it.x / 100 + w / 2;
    const cy = it.y / 100 + d / 2;
    // Clockwise on the plan (y down) is a negative turn about three.js's up axis.
    boxes.push({ name: it.name, kind: 'item', size: [w, h, d], pos: [cx - W / 2, h / 2, cy - D / 2], rotY: rot ? -rot : 0 });
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    const hw = (w * c + d * s) / 2;
    const hd = (w * s + d * c) / 2;
    const eps = 0.005;
    const out = arch ? !rectInRooms(plan.rooms!, { x: (cx - hw) * 100, y: (cy - hd) * 100, w: hw * 200, h: hd * 200 }) : cx - hw < -eps || cy - hd < -eps || cx + hw > W + eps || cy + hd > D + eps;
    if (out) warnings.push(`${it.name} sticks out of the room`);
    if (h > H + eps) warnings.push(`${it.name} is taller than the room`);
  }
  return { boxes, warnings };
}
