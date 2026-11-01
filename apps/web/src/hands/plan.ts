/**
 * SHAPES → A PLAN (BRIEF-REST-C part 2). Pure, no DOM (unit-tested in restc.test.mjs). The sketch keeps what his hands
 * placed in sketch units (shapes.ts); `buildPlan` turns it into Room JSON v2 (packages/shared/src/design.ts) in cm — the
 * format the 3D STUDIO's ROOM pane builds and the SPACE planner reads, the way DESIGN MY HOME lands its plans —
 * with the measured list and the words VoiceOver reads.
 *  - closed shapes are ROOMS (a circle with 16 sides); open shapes are WALLS standing on their own (thin blocks);
 *  - a two-finger CUT on a room's wall is an opening there (a door, 80 cm; a window, 100 cm, when he says so);
 *  - FURNITURE is a block of its size (words.ts), where he pinched;
 *  - the scale is the one length he said; until then a guess, said so on the blueprint and in the list;
 *  - every corner on the 5 cm grid; areas in m² to one place; the honest line on everything it makes.
 */
import { areaText, DEFAULTS, polyArea, type Opening, type RoomShape } from '../../../../packages/shared/src/design';
import { dist, roundCm, segDist, toCm, type Pt, type Shape } from './shapes';
import type { ItemWords } from './words';

/** The line that goes on the blueprint, the list and the Studio: what it is and what it is not. */
export const HONEST = 'A sketch to measurements you gave, not a survey';
/** Until he says one real length: one unit (the picture's width) is taken as this many cm, and the plan says so. */
export const GUESS_CM_PER_UNIT = 600;

export interface Cut {
  shape: number;
  edge: number;
  /** Where along that wall, 0–1 from its first corner. */
  t: number;
  type: 'door' | 'window';
}
export interface SketchItem extends ItemWords {
  /** Its middle, sketch units. */
  at: Pt;
}
export interface Sketch {
  /** The plan's own straight (radians, in the picture), from the first shape. */
  axis: number | null;
  shapes: Shape[];
  cuts: Cut[];
  items: SketchItem[];
  /** cm per sketch unit, and whether he said a length (false: the guess). */
  scale: number;
  said: { metres: number; shape: number; edge: number } | null;
  /** The bearing of the plan's top edge, degrees (0: north is up). */
  north: number;
  /** What the walls are, from his words (null: not said). */
  material: string | null;
  names: Record<number, string>;
  /** The wall a length or a cut refers to: the last one placed, or picked with a pinch. */
  selected: { shape: number; edge: number } | null;
}

export const emptySketch = (): Sketch => ({ axis: null, shapes: [], cuts: [], items: [], scale: GUESS_CM_PER_UNIT, said: null, north: 0, material: null, names: {}, selected: null });

/** The sides of a shape (a closed one wraps round). */
export function edges(s: Shape): [Pt, Pt][] {
  const n = s.closed ? s.pts.length : s.pts.length - 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => [s.pts[i]!, s.pts[(i + 1) % s.pts.length]!] as [Pt, Pt]);
}

/** The longest side of a shape: the wall "that wall" means when he has picked none. */
export function longestEdge(s: Shape): number {
  return edges(s).reduce((b, e, i, all) => (dist(e[0], e[1]) > dist(all[b]![0], all[b]![1]) ? i : b), 0);
}

/** The wall nearest a point (sketch units), within `within`; null when none is that near. */
export function nearestWall(sk: Sketch, p: Pt, within = 0.08, closedOnly = false): { shape: number; edge: number; t: number } | null {
  let best: { shape: number; edge: number; t: number; d: number } | null = null;
  sk.shapes.forEach((s, si) => {
    if (closedOnly && !s.closed) return;
    edges(s).forEach(([a, b], ei) => {
      const d = segDist(p, a, b);
      if (d > within || (best && d >= best.d)) return;
      const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2)) : 0;
      best = { shape: si, edge: ei, t, d };
    });
  });
  return best ? { shape: (best as { shape: number }).shape, edge: (best as { edge: number }).edge, t: (best as { t: number }).t } : null;
}

/** A shape added: the last wall placed becomes the one "that wall" means. */
export function addShape(sk: Sketch, shape: Shape, axis: number): Sketch {
  const shapes = [...sk.shapes, shape];
  return { ...sk, axis: sk.axis ?? axis, shapes, selected: { shape: shapes.length - 1, edge: longestEdge(shape) } };
}

/** One real length for the selected wall (or the longest of the last shape): the scale for the whole sketch. */
export function setLength(sk: Sketch, metres: number): Sketch {
  const sel = sk.selected ?? (sk.shapes.length ? { shape: sk.shapes.length - 1, edge: longestEdge(sk.shapes[sk.shapes.length - 1]!) } : null);
  if (!sel) return sk;
  const e = edges(sk.shapes[sel.shape]!)[sel.edge];
  if (!e) return sk;
  return { ...sk, scale: (metres * 100) / Math.max(1e-9, dist(e[0], e[1])), said: { metres, shape: sel.shape, edge: sel.edge } };
}

/** A two-finger cut at a point: an opening on the nearest room wall; null when no room wall is near. */
export function addCut(sk: Sketch, p: Pt, type: Cut['type'] = 'door'): Sketch | null {
  const w = nearestWall(sk, p, 0.08, true);
  if (!w) return null;
  return { ...sk, cuts: [...sk.cuts, { shape: w.shape, edge: w.edge, t: w.t, type }], selected: { shape: w.shape, edge: w.edge } };
}

/** The last thing placed taken back (a cut, a piece or a shape, whichever came last). */
export function undoLast(sk: Sketch, order: ('shape' | 'cut' | 'item')[]): { sk: Sketch; order: ('shape' | 'cut' | 'item')[] } {
  const last = order[order.length - 1];
  const rest = order.slice(0, -1);
  if (last === 'cut') return { sk: { ...sk, cuts: sk.cuts.slice(0, -1) }, order: rest };
  if (last === 'item') return { sk: { ...sk, items: sk.items.slice(0, -1) }, order: rest };
  if (last === 'shape') {
    const n = sk.shapes.length - 1;
    const names = { ...sk.names };
    delete names[n];
    const shapes = sk.shapes.slice(0, -1);
    return {
      sk: { ...sk, shapes, cuts: sk.cuts.filter((c) => c.shape !== n), names, axis: shapes.length ? sk.axis : null, said: sk.said?.shape === n ? null : sk.said, scale: sk.said?.shape === n ? GUESS_CM_PER_UNIT : sk.scale, selected: shapes.length ? { shape: shapes.length - 1, edge: longestEdge(shapes[shapes.length - 1]!) } : null },
      order: rest,
    };
  }
  return { sk, order };
}

export interface RoomJson {
  v: 2;
  room: { w: number; d: number; h: number };
  wall: number;
  north: number;
  rooms: RoomShape[];
  openings: Opening[];
  items: { name: string; w: number; d: number; h: number; x: number; y: number; rot: number }[];
}
export interface BuiltPlan {
  room: RoomJson;
  /** Each room: name, its walls' lengths (m), area (m²), its box (m) when it is a rectangle. */
  rooms: { name: string; walls: number[]; area: number; box: [number, number] | null }[];
  walls: number[];
  openings: { type: 'door' | 'window'; w: number; room: string; wall: number }[];
  items: { label: string; w: number; d: number }[];
  /** For VoiceOver and the chat: the plan in one plain sentence. */
  words: string;
  scaleSaid: boolean;
}

const m2 = (cm2: number) => Math.round(cm2 / 1000) / 10;
const metres = (cm: number) => Math.round(roundCm(cm)) / 100;
const OPEN_W = { door: DEFAULTS.door.w, window: DEFAULTS.window.w } as const;
/** An opening keeps this far from a corner (design.ts JAMB is 5 cm; a little more reads better). */
const JAMB = 10;

/**
 * The sketch as Room JSON v2 in cm (the box round everything starting at 0, 0) and its measured parts. Rooms keep their
 * own outlines; a free line is a thin wall block the ceiling's height; a cut is an opening on its wall, kept off the
 * corners; furniture is a block where he placed it.
 */
export function buildPlan(sk: Sketch): BuiltPlan {
  const k = sk.scale;
  const rooms0 = sk.shapes.map((s) => toCm(s.pts, k));
  const items0 = sk.items.map((it) => ({ ...it, c: [roundCm(it.at[0] * k), roundCm(it.at[1] * k)] as Pt }));
  // the box round everything, moved to 0, 0
  const all: Pt[] = [...rooms0.flat(), ...items0.flatMap((it) => [[it.c[0] - it.w / 2, it.c[1] - it.d / 2], [it.c[0] + it.w / 2, it.c[1] + it.d / 2]] as Pt[])];
  const minX = all.length ? Math.min(...all.map((p) => p[0])) : 0;
  const minY = all.length ? Math.min(...all.map((p) => p[1])) : 0;
  const ox = roundCm(minX);
  const oy = roundCm(minY);
  const shift = (p: Pt): Pt => [p[0] - ox, p[1] - oy];
  const rooms: RoomShape[] = [];
  const outRooms: BuiltPlan['rooms'] = [];
  const freeWalls: number[] = [];
  const blocks: RoomJson['items'] = [];
  const ids = new Map<number, string>();
  sk.shapes.forEach((s, i) => {
    const pts = rooms0[i]!.map(shift);
    if (s.closed) {
      const id = `r${rooms.length + 1}`;
      ids.set(i, id);
      const name = sk.names[i] ?? `Room ${rooms.length + 1}`;
      rooms.push({ id, name, poly: pts });
      const ws = pts.map((p, j) => metres(dist(p, pts[(j + 1) % pts.length]!)));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      outRooms.push({ name, walls: ws, area: m2(polyArea(pts)), box: s.kind === 'rect' ? [metres(Math.max(...xs) - Math.min(...xs)), metres(Math.max(...ys) - Math.min(...ys))] : null });
      return;
    }
    // walls on their own: one thin block per straight
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j]!;
      const b = pts[j + 1]!;
      const len = roundCm(dist(a, b));
      if (len < 10) continue;
      freeWalls.push(metres(len));
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      blocks.push({ name: 'Wall', w: len, d: DEFAULTS.wall, h: DEFAULTS.h, x: Math.round(mx - len / 2), y: Math.round(my - DEFAULTS.wall / 2), rot: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) });
    }
  });
  const openings: Opening[] = [];
  const outOpen: BuiltPlan['openings'] = [];
  sk.cuts.forEach((c, i) => {
    const id = ids.get(c.shape);
    const room = rooms.find((r) => r.id === id);
    if (!room) return;
    const a = room.poly[c.edge]!;
    const b = room.poly[(c.edge + 1) % room.poly.length]!;
    const len = dist(a, b);
    const w = Math.min(OPEN_W[c.type], Math.max(0, len - 2 * JAMB));
    if (w < 40) return;
    const at = roundCm(Math.max(JAMB, Math.min(len - JAMB - w, c.t * len - w / 2)));
    openings.push(c.type === 'door'
      ? { id: `o${i + 1}`, type: 'door', room: room.id, wall: c.edge, at, w, h: DEFAULTS.door.h, sill: 0, hinge: 'start', swing: 'in' }
      : { id: `o${i + 1}`, type: 'window', room: room.id, wall: c.edge, at, w, h: DEFAULTS.window.h, sill: DEFAULTS.window.sill, hinge: 'start', swing: 'in' });
    outOpen.push({ type: c.type, w: metres(w), room: room.name, wall: c.edge + 1 });
  });
  for (const it of items0) {
    const [cx, cy] = shift(it.c);
    blocks.push({ name: it.label, w: it.w, d: it.d, h: it.h, x: Math.round(cx - it.w / 2), y: Math.round(cy - it.d / 2), rot: 0 });
  }
  const pts = [...rooms.flatMap((r) => r.poly), ...blocks.flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y + b.d]] as Pt[])];
  const W = Math.max(50, roundCm(Math.max(0, ...pts.map((p) => p[0]))));
  const D = Math.max(50, roundCm(Math.max(0, ...pts.map((p) => p[1]))));
  const room: RoomJson = { v: 2, room: { w: W, d: D, h: DEFAULTS.h }, wall: DEFAULTS.wall, north: sk.north, rooms, openings, items: blocks };
  const itemsOut = sk.items.map((it) => ({ label: it.label, w: metres(it.w), d: metres(it.d) }));
  return { room, rooms: outRooms, walls: freeWalls, openings: outOpen, items: itemsOut, words: planWords(outRooms, freeWalls, outOpen, itemsOut, !!sk.said), scaleSaid: !!sk.said };
}

const mText = (m: number) => `${m.toFixed(2)} m`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The plan in one plain sentence (VoiceOver reads it on the blueprint). */
function planWords(rooms: BuiltPlan['rooms'], walls: number[], openings: BuiltPlan['openings'], items: BuiltPlan['items'], said: boolean): string {
  if (!rooms.length && !walls.length) return 'Nothing drawn yet.';
  const bits: string[] = [];
  for (const r of rooms) bits.push(`${r.name}${r.box ? `, ${r.box[0].toFixed(2)} by ${r.box[1].toFixed(2)} metres` : `, ${plural(r.walls.length, 'wall')}`}, ${areaText(r.area * 10000)}`);
  if (walls.length) bits.push(plural(walls.length, 'wall standing on its own', 'walls standing on their own'));
  const doors = openings.filter((o) => o.type === 'door').length;
  const wins = openings.length - doors;
  if (doors) bits.push(plural(doors, 'door'));
  if (wins) bits.push(plural(wins, 'window'));
  for (const it of items) bits.push(it.label.toLowerCase());
  return `${bits.join('; ')}.${said ? '' : ' The scale is a guess until you say one real length.'}`;
}

/** EXPORT: the measured list, plain text — walls with lengths, areas, openings, furniture, the materials his words suggest. */
export function measuredList(sk: Sketch, built: BuiltPlan, when = new Date()): string {
  const day = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const mat = sk.material ? `${sk.material} (a guess from your words)` : 'not said';
  const lines = [
    `GHOSTY · A PLAN FROM YOUR HANDS · ${day}`,
    `${HONEST}.`,
    sk.said ? `Scale: from the one length you gave (${mText(sk.said.metres)}).` : 'Scale: a guess (no length given yet), so the sizes are not real.',
    `North: ${sk.north === 0 ? 'up the page' : `${sk.north}° round from up the page`}.`,
    '',
    'ROOMS',
    ...(built.rooms.length ? built.rooms.flatMap((r) => [`  ${r.name}: ${r.box ? `${mText(r.box[0])} × ${mText(r.box[1])}, ` : ''}area ${r.area.toFixed(1)} m²`, `    Walls: ${r.walls.map(mText).join(', ')} · ${mat}`]) : ['  none']),
  ];
  if (built.walls.length) lines.push('', 'WALLS ON THEIR OWN', ...built.walls.map((w) => `  Wall: ${mText(w)} · ${mat}`));
  if (built.openings.length) lines.push('', 'OPENINGS', ...built.openings.map((o) => `  ${o.type === 'door' ? 'Door' : 'Window'}: ${mText(o.w)} wide, ${o.room}, wall ${o.wall}`));
  if (built.items.length) lines.push('', 'FURNITURE', ...built.items.map((it) => `  ${it.label}: ${mText(it.w)} × ${mText(it.d)}`));
  const total = built.rooms.reduce((s, r) => s + r.area, 0);
  lines.push('', `TOTAL FLOOR: ${total.toFixed(1)} m²`, `Wall length in all: ${mText([...built.rooms.flatMap((r) => r.walls), ...built.walls].reduce((s, w) => s + w, 0))}`);
  return lines.join('\n');
}
