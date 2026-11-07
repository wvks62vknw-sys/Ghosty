/**
 * What the room plan says about itself (BRIEF-AWARENESS; shell/awareness.ts): the plan in one line and the thing he has picked, said
 * the way he would say it ("the north wall", "3.2 m"). Pure: the plan, the selection key and which view is up go in, a
 * `ScreenContext` comes out. The selection keys are the planner's own: an item id, `room:<id>`, `wall:<room>:<edge>`, `op:<id>`.
 */
import { edgeOf, polyArea, type RoomShape } from '../../../../packages/shared/src/design';
import type { ScreenContext, Selected } from '../../../../packages/shared/src/awareness';
import { footprint, layoutOf, type Plan } from './plan';

const POINTS = ['north', 'east', 'south', 'west'] as const;

/** A direction on the plan's screen (0 = up, 90 = right…) as a compass word, given where the plan's north points; '' when it is not along a wall's axis. */
export function compassOf(screenAngle: number, north: number): string {
  const a = (((screenAngle - north) % 360) + 360) % 360;
  const near = Math.round(a / 90) % 4;
  return Math.abs(a - Math.round(a / 90) * 90) <= 12 ? POINTS[near]! : '';
}

/** Which way a wall faces (its outward side), as a compass word, or ''. */
export function wallFaces(room: RoomShape, edge: number, north: number): string {
  const e = edgeOf(room.poly, edge);
  return compassOf((Math.atan2(e.nx, -e.ny) * 180) / Math.PI, north);
}

const metres = (cm: number) => `${(cm / 100).toFixed(1)} m`;
const m2 = (cm2: number) => `${(cm2 / 10000).toFixed(1)} m²`;
const lower = (s: string) => s.trim().toLowerCase();

/** The wall's name: "the north wall" when only one wall of its room faces that way, else "wall 3" (and the room's, with several rooms). */
export function wallName(room: RoomShape, edge: number, north: number, rooms: number): string {
  const faces = wallFaces(room, edge, north);
  const same = room.poly.filter((_, i) => wallFaces(room, i, north) === faces).length;
  const own = faces && same === 1 ? `${faces} wall` : `wall ${edge + 1}`;
  return rooms > 1 ? `the ${lower(room.name)}'s ${own}` : `the ${own}`;
}

/** The thing picked, or undefined when nothing is (or the key no longer names anything). */
export function spaceSelected(plan: Plan, key: string): Selected | undefined {
  if (!key) return undefined;
  const lay = layoutOf(plan);
  const rooms = lay.rooms.length;
  if (key.startsWith('wall:')) {
    const [, rid, wi] = key.split(':');
    const room = lay.rooms.find((r) => r.id === rid);
    if (!room) return undefined;
    const edge = Number(wi);
    return { kind: 'wall', id: key, label: wallName(room, edge, lay.north, rooms), detail: metres(edgeOf(room.poly, edge).len) };
  }
  if (key.startsWith('op:')) {
    const op = lay.openings.find((o) => `op:${o.id}` === key);
    if (!op) return undefined;
    const room = lay.rooms.find((r) => r.id === op.room);
    const where = room ? ` in ${wallName(room, op.wall, lay.north, rooms)}` : '';
    return { kind: 'opening', id: key, label: `the ${op.type}`, detail: `${op.w} cm wide${where}` };
  }
  if (key.startsWith('room:')) {
    const room = lay.rooms.find((r) => `room:${r.id}` === key);
    if (!room) return undefined;
    return { kind: 'room', id: key, label: `the ${lower(room.name)}`, detail: m2(polyArea(room.poly)) };
  }
  const it = plan.items.find((i) => i.id === key);
  if (!it) return undefined;
  const f = footprint(it);
  // the walls it touches (the plan's up, right, down, left → compass words through the plan's north)
  const sides = [f.y <= 1 ? 0 : -1, f.x + f.w >= plan.room.w - 1 ? 90 : -1, f.y + f.h >= plan.room.d - 1 ? 180 : -1, f.x <= 1 ? 270 : -1].filter((a) => a >= 0).map((a) => compassOf(a, lay.north)).filter(Boolean);
  const by = sides.length ? `, by the ${sides.join(' and ')} wall` : '';
  return { kind: 'item', id: it.id, label: `the ${lower(it.label)}`, detail: `${Math.round(f.w)} × ${Math.round(f.h)} cm${by}` };
}

/** The plan in one line: "the room plan, bedroom 3.2 × 4.1 m, 6 items". */
export function spaceLine(plan: Plan, after = false): string {
  const lay = layoutOf(plan);
  const n = plan.items.length;
  const items = `${n === 0 ? 'no' : n} item${n === 1 ? '' : 's'}`;
  const one = lay.rooms.length === 1 ? lay.rooms[0]! : null;
  const room = one ? `${lower(one.name === 'Room' ? 'room' : one.name)} ${(plan.room.w / 100).toFixed(1)} × ${(plan.room.d / 100).toFixed(1)} m` : `${lay.rooms.length} rooms, ${m2(lay.rooms.reduce((s, r) => s + polyArea(r.poly), 0))}`;
  return `the room plan, ${room}, ${items}${after ? ', showing a suggested change' : ''}`;
}

export function spaceContext(plan: Plan, key: string, after = false, now = Date.now()): ScreenContext {
  const selected = after ? undefined : spaceSelected(plan, key);
  return { screen: 'space', title: 'Room plan', line: spaceLine(plan, after), ...(selected ? { selected } : {}), at: now };
}
