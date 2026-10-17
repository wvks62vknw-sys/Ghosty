/**
 * WALK mode's rules, pure (unit-tested in Node): standing at eye height in a room plan, looking
 * about by dragging, moving with the joystick (or the arrow keys), never through a wall — from one
 * room to the next only through a door. Positions are metres about the plan's centre, as the 3D
 * STUDIO builds rooms (x across, z down the plan); `yaw` 0 looks up the plan (towards the top wall),
 * positive turns left, as three.js turns a camera about its up axis.
 */
import { edgeOf, openingSpan, pointInPoly, segmentsCross, type Pt, type RoomShape } from '../../../../packages/shared/src/design';
import { layoutOfRoom, type RoomPlan } from './room';

export interface WalkState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Eye height (m), walking speed (m/s), how close to a wall one can stand (cm). */
export const EYE = 1.6;
export const SPEED = 1.3;
const BODY = 15;
const PITCH = 1.2;

const toPlan = (plan: RoomPlan, x: number, z: number): Pt => [(x + plan.room.w / 200) * 100, (z + plan.room.d / 200) * 100];
const toWorld = (plan: RoomPlan, p: Pt): [number, number] => [p[0] / 100 - plan.room.w / 200, p[1] / 100 - plan.room.d / 200];

function edgeDist(p: Pt, room: RoomShape): number {
  let best = Infinity;
  for (let i = 0; i < room.poly.length; i++) {
    const e = edgeOf(room.poly, i);
    const t = Math.max(0, Math.min(e.len, (p[0] - e.a[0]) * e.ux + (p[1] - e.a[1]) * e.uy));
    best = Math.min(best, Math.hypot(p[0] - (e.a[0] + e.ux * t), p[1] - (e.a[1] + e.uy * t)));
  }
  return best;
}

/** The doors of a plan as segments on the plan (cm). */
function doors(plan: RoomPlan): [Pt, Pt][] {
  const lay = layoutOfRoom(plan);
  return lay.openings.flatMap((op): [Pt, Pt][] => {
    const room = lay.rooms.find((r) => r.id === op.room);
    if (!room || op.type !== 'door') return [];
    const { p0, p1, edge } = openingSpan(room, op);
    // A little way through the wall on both sides, so stepping through the doorway crosses it.
    const k = 30;
    return [[[p0[0] - edge.nx * k, p0[1] - edge.ny * k], [p0[0] + edge.nx * k, p0[1] + edge.ny * k]], [[p1[0] - edge.nx * k, p1[1] - edge.ny * k], [p1[0] + edge.nx * k, p1[1] + edge.ny * k]], [p0, p1]];
  });
}

/** Which room a plan point is in (the index), or −1. */
function roomIndex(rooms: RoomShape[], p: Pt): number {
  return rooms.findIndex((r) => pointInPoly(p, r.poly, 0));
}

/** May one stand here: on a room's floor, a body's width from its walls (unless in a doorway)? */
export function canStand(plan: RoomPlan, x: number, z: number): boolean {
  const lay = layoutOfRoom(plan);
  const p = toPlan(plan, x, z);
  const i = roomIndex(lay.rooms, p);
  if (i < 0) return false;
  if (edgeDist(p, lay.rooms[i]!) >= BODY) return true;
  return inDoorway(plan, p);
}

function inDoorway(plan: RoomPlan, p: Pt): boolean {
  const lay = layoutOfRoom(plan);
  return lay.openings.some((op) => {
    const room = lay.rooms.find((r) => r.id === op.room);
    if (!room || op.type !== 'door') return false;
    const { p0, edge } = openingSpan(room, op);
    const along = (p[0] - p0[0]) * edge.ux + (p[1] - p0[1]) * edge.uy;
    const across = Math.abs((p[0] - p0[0]) * edge.nx + (p[1] - p0[1]) * edge.ny);
    return along >= BODY - 1 && along <= op.w - BODY + 1 && across <= 40;
  });
}

/** May one step from a to b: both standable, and changing rooms only through a doorway. */
export function canStep(plan: RoomPlan, a: [number, number], b: [number, number]): boolean {
  if (!canStand(plan, b[0], b[1])) return false;
  const lay = layoutOfRoom(plan);
  const pa = toPlan(plan, a[0], a[1]);
  const pb = toPlan(plan, b[0], b[1]);
  const ra = roomIndex(lay.rooms, pa);
  const rb = roomIndex(lay.rooms, pb);
  if (ra === rb) return true;
  // Into another room: only where a door is (on either side of its line, within its width).
  return inDoorway(plan, pa) || inDoorway(plan, pb) || doors(plan).some(([d0, d1]) => segmentsCross(pa, pb, d0, d1));
}

/** Turn the head by a drag of (dx, dy) pixels. */
export function lookBy(s: WalkState, dx: number, dy: number, k = 0.005): WalkState {
  return { ...s, yaw: s.yaw - dx * k, pitch: Math.max(-PITCH, Math.min(PITCH, s.pitch - dy * k)) };
}

/**
 * One step: `fwd` and `side` from −1 to 1 (the joystick), for `dt` seconds. A step into a wall
 * slides along it (each direction is tried alone) instead of stopping dead.
 */
export function walkStep(plan: RoomPlan, s: WalkState, input: { fwd: number; side: number }, dt: number): WalkState {
  const f = Math.max(-1, Math.min(1, input.fwd));
  const r = Math.max(-1, Math.min(1, input.side));
  if (!f && !r) return s;
  const step = SPEED * Math.min(dt, 0.1);
  const dx = (-Math.sin(s.yaw) * f + Math.cos(s.yaw) * r) * step;
  const dz = (-Math.cos(s.yaw) * f - Math.sin(s.yaw) * r) * step;
  for (const [mx, mz] of [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ] as const) {
    if (!mx && !mz) continue;
    const to: [number, number] = [s.x + mx, s.z + mz];
    if (canStep(plan, [s.x, s.z], to)) return { ...s, x: to[0], z: to[1] };
  }
  return s;
}

/**
 * Where WALK starts: just inside the first door, looking into its room; with no door, the middle
 * of the first room (or the first point inside it), looking up the plan.
 */
export function startWalk(plan: RoomPlan): WalkState {
  const lay = layoutOfRoom(plan);
  for (const op of lay.openings) {
    const room = lay.rooms.find((r) => r.id === op.room);
    if (!room || op.type !== 'door') continue;
    const { mid, edge } = openingSpan(room, op);
    const p: Pt = [mid[0] - edge.nx * 60, mid[1] - edge.ny * 60];
    const [x, z] = toWorld(plan, p);
    if (canStand(plan, x, z)) return { x, z, yaw: Math.atan2(edge.nx, edge.ny), pitch: 0 };
  }
  const room = lay.rooms[0]!;
  const xs = room.poly.map((p) => p[0]);
  const ys = room.poly.map((p) => p[1]);
  const c: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const tries: Pt[] = [c, ...room.poly.map(([x, y]): Pt => [(x * 3 + c[0]) / 4, (y * 3 + c[1]) / 4])];
  for (const p of tries) {
    const [x, z] = toWorld(plan, p);
    if (canStand(plan, x, z)) return { x, z, yaw: 0, pitch: 0 };
  }
  const [x, z] = toWorld(plan, c);
  return { x, z, yaw: 0, pitch: 0 };
}
