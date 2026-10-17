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
 * centre. room.h and item h are optional (240 cm and 75 cm).
 */
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
}

/** One box to build: centre and size in metres (y is up), turned `rotY` radians about the vertical. */
export interface Box {
  name: string;
  kind: 'floor' | 'wall' | 'item';
  size: [number, number, number];
  pos: [number, number, number];
  rotY: number;
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
  return { room: { w, d, ...(h !== null ? { h } : {}) }, items };
}

/**
 * Boxes for a room: the floor, four walls (outside the floor, so inside sizes are exact) and
 * every item standing on the floor. The room's centre is the origin. Warnings name items that
 * stick out of the room or are taller than it.
 */
export function roomBoxes(plan: RoomPlan): { boxes: Box[]; warnings: string[] } {
  const W = plan.room.w / 100;
  const D = plan.room.d / 100;
  const H = (plan.room.h ?? 240) / 100;
  const t = WALL_M;
  const boxes: Box[] = [
    { name: 'Floor', kind: 'floor', size: [W, 0.02, D], pos: [0, -0.01, 0], rotY: 0 },
    { name: 'Back wall', kind: 'wall', size: [W + 2 * t, H, t], pos: [0, H / 2, -D / 2 - t / 2], rotY: 0 },
    { name: 'Front wall', kind: 'wall', size: [W + 2 * t, H, t], pos: [0, H / 2, D / 2 + t / 2], rotY: 0 },
    { name: 'Left wall', kind: 'wall', size: [t, H, D], pos: [-W / 2 - t / 2, H / 2, 0], rotY: 0 },
    { name: 'Right wall', kind: 'wall', size: [t, H, D], pos: [W / 2 + t / 2, H / 2, 0], rotY: 0 },
  ];
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
    if (cx - hw < -eps || cy - hd < -eps || cx + hw > W + eps || cy + hd > D + eps) warnings.push(`${it.name} sticks out of the room`);
    if (h > H + eps) warnings.push(`${it.name} is taller than the room`);
  }
  return { boxes, warnings };
}
