/**
 * The SPACE PLANNER's architecture edits, pure (unit-tested in apps/edge/test/design.test.mjs):
 * turning a plain room into Room JSON v2, resizing a room, making it an L, adding a room beside the
 * others, putting doors and windows in walls and moving them along. Every edit goes back through
 * readPlan, so what comes out is always a checked plan (the box round the rooms at 0, 0, furniture
 * kept in it, an opening that no longer fits its wall left out — named in `dropped`).
 */
import { DEFAULTS, bounds, edgeOf, lPoly, openingProblem, openingSpan, pointInPoly, rectPoly, segmentsCross, type Corner, type Opening, type Pt, type RoomShape } from '../../../../packages/shared/src/design';
import { GRID, layoutOf, readPlan, type Plan } from './plan';

/** A plan with its architecture spelled out (a v1 plan becomes one box room, nothing in its walls). */
export function ensureV2(plan: Plan): Plan & { rooms: RoomShape[]; openings: Opening[] } {
  const l = layoutOf(plan);
  return { ...plan, v: 2, rooms: l.rooms.map((r) => ({ ...r, poly: r.poly.map((p): Pt => [p[0], p[1]]) })), openings: l.openings.map((o) => ({ ...o })), wall: l.wall, h: l.h, north: l.north };
}

/** A plan rebuilt and checked; the openings that no longer fit are named. */
function settle(raw: Plan & { rooms: RoomShape[]; openings: Opening[] }): { plan: Plan; dropped: string[] } {
  const before = raw.openings.length;
  const plan = readPlan(raw);
  if (!plan) return { plan: raw, dropped: ['that plan could not be read'] };
  const lost = before - (plan.openings?.length ?? 0);
  return { plan, dropped: lost > 0 ? [lostText(lost)] : [] };
}

const lostText = (n: number) => (n === 1 ? 'A door or window no longer fitted its wall and was taken out' : `${n} doors or windows no longer fitted their walls and were taken out`);

export interface Shape {
  kind: 'box' | 'l' | 'other';
  x: number;
  y: number;
  w: number;
  d: number;
  /** An L's notch: its size and which corner of the box it is cut from. */
  nw: number;
  nd: number;
  corner: Corner;
}

/** What shape a room is: a box, an L (its notch read back), or something else drawn by hand. */
export function shapeOf(room: RoomShape): Shape {
  const b = bounds(room.poly);
  const base: Shape = { kind: 'other', x: b.x, y: b.y, w: b.w, d: b.h, nw: Math.round(b.w / 3), nd: Math.round(b.h / 3), corner: 'tr' };
  const square = room.poly.every(([x, y], i) => {
    const [x2, y2] = room.poly[(i + 1) % room.poly.length]!;
    return x === x2 || y === y2;
  });
  if (!square) return base;
  if (room.poly.length === 4) return { ...base, kind: 'box' };
  if (room.poly.length !== 6) return base;
  const corners: [Corner, Pt][] = [
    ['tl', [b.x, b.y]],
    ['tr', [b.x + b.w, b.y]],
    ['br', [b.x + b.w, b.y + b.h]],
    ['bl', [b.x, b.y + b.h]],
  ];
  const has = (p: Pt) => room.poly.some(([x, y]) => x === p[0] && y === p[1]);
  const missing = corners.filter(([, p]) => !has(p));
  if (missing.length !== 1) return base;
  const corner = missing[0]![0];
  // The re-entrant corner: the one corner not on the box's edge.
  const inner = room.poly.find(([x, y]) => x !== b.x && x !== b.x + b.w && y !== b.y && y !== b.y + b.h);
  if (!inner) return base;
  const nw = corner === 'tr' || corner === 'br' ? b.x + b.w - inner[0] : inner[0] - b.x;
  const nd = corner === 'bl' || corner === 'br' ? b.y + b.h - inner[1] : inner[1] - b.y;
  return { ...base, kind: 'l', nw, nd, corner };
}

const snap = (v: number) => Math.round(v / GRID) * GRID;

/**
 * A room's outline from a shape. Doors and windows stay on the same wall numbers, so a box and
 * an L keep theirs where the walls still match (the rest drop out if they no longer fit).
 */
export function outline(s: Shape): Pt[] {
  return s.kind === 'l' ? lPoly(s.x, s.y, s.w, s.d, s.nw, s.nd, s.corner) : rectPoly(s.x, s.y, s.w, s.d);
}

/**
 * Resize one room (cm), keeping its shape (an L keeps its notch) and its top-left corner. Its doors
 * and windows stay on their walls, where they were across the plan (slid in from a wall's end when
 * it got shorter). Throws in words when the new size would run into another room.
 */
export function resizeRoom(plan: Plan, roomId: string, w: number, d: number): { plan: Plan; dropped: string[] } {
  const p = ensureV2(plan);
  const room = p.rooms.find((r) => r.id === roomId) ?? p.rooms[0]!;
  const s = shapeOf(room);
  const W = snap(Math.max(50, w));
  const D = snap(Math.max(50, d));
  const old = { ...room, poly: room.poly.map((q): Pt => [q[0], q[1]]) };
  // A room drawn by hand keeps its outline, stretched to the new size.
  const stretch = ([x, y]: Pt): Pt => [s.x + ((x - s.x) * W) / s.w, s.y + ((y - s.y) * D) / s.d];
  if (s.kind === 'other') room.poly = room.poly.map((q): Pt => stretch(q).map(Math.round) as Pt);
  else room.poly = outline({ ...s, w: W, d: D, nw: Math.min(s.nw, W - 30), nd: Math.min(s.nd, D - 30) });
  const hit = p.rooms.find((r) => r !== room && roomsOverlap(r.poly, room.poly));
  if (hit) throw new Error(`${room.name} at ${W} × ${D} cm would run into ${hit.name}: move or resize ${hit.name} first`);
  // `at` is measured from a wall's first corner, and on the bottom and left walls that corner moves:
  // put each opening back where it was across the plan, on its wall's new line.
  p.openings = p.openings.map((o) => {
    if (o.room !== room.id || o.wall >= room.poly.length || room.poly.length !== old.poly.length) return o;
    const mid = openingSpan(old, o).mid;
    const m = s.kind === 'other' ? stretch(mid) : mid;
    const e = edgeOf(room.poly, o.wall);
    const at = (m[0] - e.a[0]) * e.ux + (m[1] - e.a[1]) * e.uy - o.w / 2;
    return { ...o, at: Math.round(Math.max(5, Math.min(e.len - o.w - 5, at)) * 10) / 10 };
  });
  return settle(p);
}

/** Do two rooms share floor (not just a wall)? Tested at the middle of every cell of the grid their corners make, and where walls cross. */
export function roomsOverlap(a: Pt[], b: Pt[]): boolean {
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

/** Make a room a box or an L (its notch nw × nd cm cut from `corner`). */
export function reshapeRoom(plan: Plan, roomId: string, kind: 'box' | 'l', notch: { nw?: number; nd?: number; corner?: Corner } = {}): { plan: Plan; dropped: string[] } {
  const p = ensureV2(plan);
  const room = p.rooms.find((r) => r.id === roomId) ?? p.rooms[0]!;
  const s = shapeOf(room);
  const nw = snap(Math.max(30, Math.min(notch.nw ?? s.nw, s.w - 30)));
  const nd = snap(Math.max(30, Math.min(notch.nd ?? s.nd, s.d - 30)));
  const old = { ...room, poly: room.poly.map((q): Pt => [q[0], q[1]]) };
  room.poly = outline({ ...s, kind, nw, nd, corner: notch.corner ?? s.corner });
  // Wall numbers change with the shape: each door and window goes to whichever new wall it still lies on.
  const n = p.openings.length;
  p.openings = p.openings.flatMap((o) => (o.room === room.id ? rehome(old, room, o) : [o]));
  const got = settle(p);
  const lost = n - p.openings.length;
  return lost ? { plan: got.plan, dropped: [lostText(lost), ...got.dropped] } : got;
}

/**
 * An opening moved onto the new outline of its room: the new wall it lies along (same place on
 * the plan, its hinge on the same side), or nothing when no wall is there any more.
 */
export function rehome(before: RoomShape, after: RoomShape, op: Opening): Opening[] {
  const { p0, p1 } = openingSpan(before, op);
  for (let i = 0; i < after.poly.length; i++) {
    const e = edgeOf(after.poly, i);
    const along = (q: Pt) => (q[0] - e.a[0]) * e.ux + (q[1] - e.a[1]) * e.uy;
    const across = (q: Pt) => Math.abs((q[0] - e.a[0]) * e.uy - (q[1] - e.a[1]) * e.ux);
    if (across(p0) > 0.5 || across(p1) > 0.5) continue;
    const s0 = along(p0);
    const s1 = along(p1);
    const at = Math.min(s0, s1);
    if (at < 0 || Math.max(s0, s1) > e.len) continue;
    // The wall now runs the other way: the hinge's end of the opening swaps name.
    const flipped = s1 < s0;
    return [{ ...op, wall: i, at: Math.round(at * 10) / 10, hinge: flipped ? (op.hinge === 'start' ? 'end' : 'start') : op.hinge }];
  }
  return [];
}

/** Rename a room. */
export function renameRoom(plan: Plan, roomId: string, name: string): Plan {
  const p = ensureV2(plan);
  const room = p.rooms.find((r) => r.id === roomId);
  if (room) room.name = name.replace(/\s+/g, ' ').trim().slice(0, 30) || room.name;
  return settle(p).plan;
}

/** A new box room (w × d cm) against the right of the plan (top edges level) or below it (left edges level). */
export function addRoom(plan: Plan, side: 'right' | 'below', w = 300, d = 300): { plan: Plan; id: string } {
  const p = ensureV2(plan);
  let n = p.rooms.length + 1;
  while (p.rooms.some((r) => r.id === `r${n}`)) n++;
  const id = `r${n}`;
  const x = side === 'right' ? plan.room.w : 0;
  const y = side === 'right' ? 0 : plan.room.d;
  p.rooms.push({ id, name: `Room ${n}`, poly: rectPoly(x, y, w, d) });
  return { plan: settle(p).plan, id };
}

/** Take a room out, with its doors and windows (the furniture in it stays, shown as a clash, for the owner to move). */
export function removeRoom(plan: Plan, roomId: string): Plan | null {
  const p = ensureV2(plan);
  if (p.rooms.length < 2) return null;
  p.rooms = p.rooms.filter((r) => r.id !== roomId);
  p.openings = p.openings.filter((o) => o.room !== roomId);
  return settle(p).plan;
}

/**
 * A door or a window in the middle of a wall (cm), with the usual sizes (a door 80 × 200 cm, a
 * window 100 × 120 cm on a 90 cm sill), narrowed to fit a short wall. Throws in words when the
 * wall has no room for it.
 */
export function addOpening(plan: Plan, roomId: string, wall: number, type: 'door' | 'window'): { plan: Plan; id: string } {
  const p = ensureV2(plan);
  const room = p.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('choose a wall first');
  const e = edgeOf(room.poly, wall);
  const d = type === 'door' ? { ...DEFAULTS.door, sill: 0 } : DEFAULTS.window;
  const w = Math.min(d.w, snap(e.len - 20));
  let n = p.openings.length + 1;
  while (p.openings.some((o) => o.id === `${type[0]}${n}`)) n++;
  const op: Opening = { id: `${type[0]}${n}`, type, room: room.id, wall, at: snap((e.len - w) / 2), w, h: d.h, sill: d.sill, hinge: 'start', swing: 'in' };
  // The middle of the wall may be taken: try along it, nearest the middle first.
  const spots = [...Array(Math.max(1, Math.floor((e.len - w) / GRID)) + 1).keys()].map((k) => k * GRID).sort((a, b) => Math.abs(a - op.at) - Math.abs(b - op.at));
  const at = spots.find((s) => !openingProblem(room, { ...op, at: s }, p.openings, p.h ?? DEFAULTS.h));
  if (at === undefined) throw new Error(openingProblem(room, op, p.openings, p.h ?? DEFAULTS.h) ?? 'no room on that wall');
  p.openings.push({ ...op, at });
  return { plan: settle(p).plan, id: op.id };
}

/** Change an opening (its place along the wall, width, height, sill, hinge side, swing); throws in words when it would not fit. */
export function updateOpening(plan: Plan, id: string, patch: Partial<Pick<Opening, 'at' | 'w' | 'h' | 'sill' | 'hinge' | 'swing'>>): Plan {
  const p = ensureV2(plan);
  const i = p.openings.findIndex((o) => o.id === id);
  if (i < 0) throw new Error('that door or window is gone');
  const next = { ...p.openings[i]!, ...patch };
  if (patch.at !== undefined) next.at = snap(patch.at);
  const room = p.rooms.find((r) => r.id === next.room);
  const bad = openingProblem(room, next, p.openings, p.h ?? DEFAULTS.h);
  if (bad) throw new Error(bad);
  p.openings[i] = next;
  return settle(p).plan;
}

/** Take a door or window out. */
export function removeOpening(plan: Plan, id: string): Plan {
  const p = ensureV2(plan);
  p.openings = p.openings.filter((o) => o.id !== id);
  return settle(p).plan;
}

/** Slide an opening to where a finger is (a plan point, cm): along its wall, its middle under the finger. */
export function slideOpening(plan: Plan, id: string, at: Pt): Plan | null {
  const p = ensureV2(plan);
  const op = p.openings.find((o) => o.id === id);
  const room = op && p.rooms.find((r) => r.id === op.room);
  if (!op || !room) return null;
  const e = edgeOf(room.poly, op.wall);
  const t = (at[0] - e.a[0]) * e.ux + (at[1] - e.a[1]) * e.uy - op.w / 2;
  const s = Math.max(5, Math.min(e.len - op.w - 5, snap(t)));
  try {
    return updateOpening(plan, id, { at: s });
  } catch {
    return null;
  }
}
