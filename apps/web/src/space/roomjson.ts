/**
 * The one converter between the SPACE PLANNER's own plan and the Room JSON (MAP.md, "Room JSON")
 * the 3D STUDIO's ROOM pane reads. The planner keeps quarter turns (0–3), the corner of the TURNED
 * footprint and a `label`; Room JSON has degrees clockwise, the corner of the UNTURNED rectangle
 * (turned about its own centre) and a `name`. The planner's EXPORT writes Room JSON through
 * `planToRoom`; its IMPORT and the studio both read either shape, so an older planner file still
 * works. Pure, unit-tested in apps/edge/test/studio.test.mjs.
 */
import { readPlan, type Item, type Plan } from './plan';
import type { RoomItem, RoomPlan } from '../studio/room';

/** A Room JSON item as the planner writes it: the studio's fields plus the planner's id and kind. */
export type PlannerRoomItem = RoomItem & { id: string; kind: string };

/** A planner plan (an old EXPORT or the phone's storage): pieces carry `label` and never `name`. */
export function isPlannerPlan(json: unknown): boolean {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items) || !items.length) return false;
  const objs = items.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  return objs.some((x) => 'label' in x) && !objs.some((x) => 'name' in x);
}

/** The planner's plan as Room JSON: label → name, quarter turns → degrees, footprint corner → unturned corner. */
export function planToRoom(plan: Plan): { room: { w: number; d: number }; items: PlannerRoomItem[] } {
  return {
    room: { w: plan.room.w, d: plan.room.d },
    items: plan.items.map((it) => {
      // A piece turned a quarter has its footprint's sides swapped about the same centre.
      const side = it.rot % 2 === 1;
      return {
        name: it.label,
        w: it.w,
        d: it.d,
        x: side ? it.x + (it.d - it.w) / 2 : it.x,
        y: side ? it.y + (it.w - it.d) / 2 : it.y,
        rot: it.rot * 90,
        id: it.id,
        kind: it.kind,
      };
    }),
  };
}

/**
 * A plan for the planner from either shape (Room JSON or the planner's own), checked by readPlan;
 * null when it is neither. Room JSON turns are rounded to the nearest quarter.
 */
export function roomToPlan(json: unknown): Plan | null {
  if (isPlannerPlan(json)) return readPlan(json);
  const o = json as { room?: unknown; items?: unknown };
  if (!o || typeof o !== 'object') return null;
  const items = (Array.isArray(o.items) ? o.items : []).flatMap((raw, i): Partial<Item>[] => {
    if (!raw || typeof raw !== 'object') return [];
    const x = raw as Record<string, unknown>;
    const w = Number(x.w);
    const d = Number(x.d);
    const deg = Number(x.rot) || 0;
    const rot = ((((Math.round(deg / 90) % 4) + 4) % 4) as Item['rot']);
    const side = rot % 2 === 1;
    const cx = Number(x.x) || 0;
    const cy = Number(x.y) || 0;
    return [{ id: String(x.id ?? `i${i}`), kind: String(x.kind ?? 'custom'), label: String(x.name ?? x.label ?? 'Item'), w, d, x: side ? cx - (d - w) / 2 : cx, y: side ? cy - (w - d) / 2 : cy, rot }];
  });
  return readPlan({ room: o.room, items });
}
