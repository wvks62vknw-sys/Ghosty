/**
 * THE SHOW ME DOOR INTO THE ENGINE (BRIEF-ENGINE-3D-1): the Stage's room and part (show/parts.ts) as a scene to build on. A room is a
 * ground of its size, four walls standing just outside it and the parts where the Stage's plan puts them; a part is itself in the middle
 * of a ground a little bigger than it. Pure.
 */
import { PARTS, roomPlanFor, type Dims, type PartKind, type RoomAsk } from '../show/parts';
import { addObject, newScene, type Scene } from './scene';

const WALL = 10;
const WALL_H = 240;

export function sceneFromRoom(r: RoomAsk, name = `Room ${r.w / 100} × ${r.d / 100} m`): Scene {
  const plan = roomPlanFor(r);
  let s = newScene(r.w, r.d, name);
  const h = plan.room.h ?? WALL_H;
  for (const [n, w, d, x, z] of [
    ['Wall back', r.w + 2 * WALL, WALL, 0, -(r.d / 2 + WALL / 2)],
    ['Wall front', r.w + 2 * WALL, WALL, 0, r.d / 2 + WALL / 2],
    ['Wall left', WALL, r.d, -(r.w / 2 + WALL / 2), 0],
    ['Wall right', WALL, r.d, r.w / 2 + WALL / 2, 0],
  ] as [string, number, number, number, number][]) s = addObject(s, 'box', { x, z }, { name: n, w, d, h, mat: 'white' }).scene;
  for (const it of plan.items ?? []) {
    const kind = (it as unknown as { kind: PartKind }).kind;
    s = addObject(s, kind, { x: it.x + it.w / 2 - r.w / 2, z: it.y + it.d / 2 - r.d / 2 }, { name: it.name, w: it.w, d: it.d, h: it.h ?? 75 }).scene;
  }
  return s;
}

export function sceneFromPart(kind: PartKind, dims: Dims, name?: string): Scene {
  const label = name ?? PARTS.find((p) => p.kind === kind)?.name ?? 'Part';
  const s = newScene(dims.w + 120, dims.d + 120, `${label} ${dims.w} × ${dims.d} × ${dims.h} cm`);
  return addObject(s, kind, { x: 0, z: 0 }, { name: label, ...dims }).scene;
}
