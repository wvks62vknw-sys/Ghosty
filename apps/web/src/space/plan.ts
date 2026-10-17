/**
 * The SPACE PLANNER's pure parts (unit-tested in apps/edge/test/measure.test.mjs): a room as a
 * rectangle in centimetres, furniture as rectangles in it, the common UK sizes, snapping,
 * walkway clearances, "will it fit?", and MAKE SPACE — a small packing heuristic that pushes the
 * furniture against the walls in a few different ways and keeps the arrangements that leave the
 * biggest open rectangle of floor.
 *
 * Coordinates: x across the room's width (left → right), y across its depth (top → bottom, the
 * top wall being the one the plan shows at the top), each piece's x/y its top-left corner.
 */

export interface Room {
  w: number;
  d: number;
}

export interface Item {
  id: string;
  /** The catalogue's kind ('sofa3', 'double', …) or 'custom'. */
  kind: string;
  label: string;
  /** Its own width (along its back) and depth (front to back), cm. */
  w: number;
  d: number;
  x: number;
  y: number;
  /** Quarter turns: 0 = back to the top wall, 1 = back to the right wall, 2 = bottom, 3 = left. */
  rot: 0 | 1 | 2 | 3;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Common UK sizes (cm), width × depth as the piece stands against a wall; beds include a typical frame. */
export const CATALOGUE: { kind: string; label: string; w: number; d: number }[] = [
  { kind: 'sofa2', label: 'Sofa, 2-seater', w: 160, d: 90 },
  { kind: 'sofa3', label: 'Sofa, 3-seater', w: 210, d: 95 },
  { kind: 'armchair', label: 'Armchair', w: 85, d: 85 },
  { kind: 'single', label: 'Bed, single', w: 100, d: 200 },
  { kind: 'double', label: 'Bed, double', w: 145, d: 205 },
  { kind: 'king', label: 'Bed, king', w: 160, d: 215 },
  { kind: 'wardrobe', label: 'Wardrobe, double', w: 100, d: 60 },
  { kind: 'desk', label: 'Desk', w: 120, d: 60 },
  { kind: 'dining', label: 'Dining table, 4', w: 120, d: 80 },
  { kind: 'tv', label: 'TV unit', w: 150, d: 40 },
  { kind: 'bookcase', label: 'Bookcase', w: 80, d: 30 },
];

/** The least gap people walk through between two pieces (cm). */
export const WALKWAY = 70;
/** Snap step (cm), and how close to a wall or a piece's edge a dragged piece jumps to it. */
export const GRID = 5;
export const SNAP = 12;

/** The floor a piece covers, turned. */
export function footprint(it: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rot'>): Rect {
  const side = it.rot % 2 === 1;
  return { x: it.x, y: it.y, w: side ? it.d : it.w, h: side ? it.w : it.d };
}

export const overlap = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

export const insideRoom = (room: Room, r: Rect) => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= room.w + 0.01 && r.y + r.h <= room.d + 0.01;

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A dragged piece's resting place: kept in the room, on the 5 cm grid, and pulled flush to a
 * wall or to another piece's edge when within 12 cm of it.
 */
export function snapItem(room: Room, it: Item, others: Item[]): { x: number; y: number } {
  const f = footprint(it);
  let x = clampTo(Math.round(it.x / GRID) * GRID, 0, Math.max(0, room.w - f.w));
  let y = clampTo(Math.round(it.y / GRID) * GRID, 0, Math.max(0, room.d - f.h));
  const xs = [0, room.w - f.w];
  const ys = [0, room.d - f.h];
  for (const o of others) {
    if (o.id === it.id) continue;
    const r = footprint(o);
    xs.push(r.x + r.w, r.x - f.w, r.x);
    ys.push(r.y + r.h, r.y - f.h, r.y);
  }
  const bx = xs.reduce((b, c) => (Math.abs(c - it.x) < Math.abs(b - it.x) ? c : b), Infinity);
  if (Math.abs(bx - it.x) <= SNAP) x = clampTo(bx, 0, Math.max(0, room.w - f.w));
  const by = ys.reduce((b, c) => (Math.abs(c - it.y) < Math.abs(b - it.y) ? c : b), Infinity);
  if (Math.abs(by - it.y) <= SNAP) y = clampTo(by, 0, Math.max(0, room.d - f.h));
  return { x, y };
}

/** A tight gap: two pieces facing each other closer than a walkway (and not touching). */
export interface Gap {
  a: string;
  b: string;
  cm: number;
  /** The strip between them, for drawing. */
  rect: Rect;
}

/**
 * Gaps under the 70 cm walkway between pieces that face each other along at least 30 cm (pieces
 * pushed together, 0 cm apart, are one block and no gap).
 */
export function tightGaps(items: Item[], min = WALKWAY): Gap[] {
  const out: Gap[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = footprint(items[i]!);
      const b = footprint(items[j]!);
      // side by side (a gap across x) where their y ranges share ≥ 30 cm
      const yShare = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const xShare = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (yShare >= 30) {
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const gap = r.x - (l.x + l.w);
        if (gap > 0.5 && gap < min) out.push({ a: items[i]!.id, b: items[j]!.id, cm: Math.round(gap), rect: { x: l.x + l.w, y: Math.max(a.y, b.y), w: gap, h: yShare } });
      }
      if (xShare >= 30) {
        const [t, u] = a.y <= b.y ? [a, b] : [b, a];
        const gap = u.y - (t.y + t.h);
        if (gap > 0.5 && gap < min) out.push({ a: items[i]!.id, b: items[j]!.id, cm: Math.round(gap), rect: { x: Math.max(a.x, b.x), y: t.y + t.h, w: xShare, h: gap } });
      }
    }
  }
  return out;
}

/** Pieces that overlap another or stick out of the room. */
export function clashes(room: Room, items: Item[]): string[] {
  const bad = new Set<string>();
  items.forEach((it, i) => {
    const f = footprint(it);
    if (!insideRoom(room, f)) bad.add(it.id);
    for (let j = i + 1; j < items.length; j++) {
      if (overlap(f, footprint(items[j]!))) {
        bad.add(it.id);
        bad.add(items[j]!.id);
      }
    }
  });
  return [...bad];
}

/** Room floor not covered by furniture (cm²). */
export const freeArea = (room: Room, items: Item[]) => room.w * room.d - items.reduce((s, it) => s + it.w * it.d, 0);

/**
 * The biggest open rectangle of floor (cm and cm²), on a 5 cm grid: the classic largest
 * rectangle in a histogram, row by row.
 */
export function largestOpen(room: Room, items: Item[], cell = GRID): Rect & { area: number } {
  const cols = Math.max(1, Math.floor(room.w / cell));
  const rows = Math.max(1, Math.floor(room.d / cell));
  const blocked = new Uint8Array(cols * rows);
  for (const it of items) {
    const f = footprint(it);
    const x0 = Math.max(0, Math.floor(f.x / cell + 1e-6));
    const x1 = Math.min(cols, Math.ceil((f.x + f.w) / cell - 1e-6));
    const y0 = Math.max(0, Math.floor(f.y / cell + 1e-6));
    const y1 = Math.min(rows, Math.ceil((f.y + f.h) / cell - 1e-6));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) blocked[y * cols + x] = 1;
  }
  const heights = new Int32Array(cols);
  let best = { x: 0, y: 0, w: 0, h: 0, area: 0 };
  const stack: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) heights[x] = blocked[y * cols + x] ? 0 : heights[x]! + 1;
    stack.length = 0;
    for (let x = 0; x <= cols; x++) {
      const hgt = x < cols ? heights[x]! : 0;
      while (stack.length && heights[stack[stack.length - 1]!]! >= hgt) {
        const top = stack.pop()!;
        const hh = heights[top]!;
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
        const ww = x - left;
        const area = ww * hh * cell * cell;
        if (area > best.area) best = { x: left * cell, y: (y - hh + 1) * cell, w: ww * cell, h: hh * cell, area };
      }
      stack.push(x);
    }
  }
  return best;
}

/** Where a new piece (w × d cm) could stand without overlapping anything, trying both turns; null when nowhere. */
export function findSpot(room: Room, items: Item[], w: number, d: number, clearance = 0): { x: number; y: number; rot: 0 | 1 } | null {
  const others = items.map(footprint);
  for (const rot of [0, 1] as const) {
    const fw = rot ? d : w;
    const fh = rot ? w : d;
    if (fw > room.w || fh > room.d) continue;
    for (let y = 0; y + fh <= room.d + 0.01; y += GRID) {
      for (let x = 0; x + fw <= room.w + 0.01; x += GRID) {
        const r = { x, y, w: fw, h: fh };
        if (!others.some((o) => overlap(r, o, clearance - 0.01))) return { x, y, rot };
      }
    }
  }
  return null;
}

/** "Will it fit?": with a walkway round it, without one, or not at all — in plain words. */
export function willItFit(room: Room, items: Item[], w: number, d: number): { fits: boolean; spot: { x: number; y: number; rot: 0 | 1 } | null; text: string } {
  if (!(w > 0 && d > 0)) return { fits: false, spot: null, text: 'Type its width and depth.' };
  if (Math.min(w, d) > Math.min(room.w, room.d) || Math.max(w, d) > Math.max(room.w, room.d)) return { fits: false, spot: null, text: `No: ${w} × ${d} cm is bigger than the room (${room.w} × ${room.d} cm).` };
  const easy = findSpot(room, items, w, d, WALKWAY);
  if (easy) return { fits: true, spot: easy, text: `Yes, with a ${WALKWAY} cm walkway round it${easy.rot ? ' (turned)' : ''}.` };
  const tight = findSpot(room, items, w, d, 0);
  if (tight) return { fits: true, spot: tight, text: `Only just: it fits${tight.rot ? ' turned' : ''}, but leaves less than ${WALKWAY} cm to walk past. Try MAKE SPACE first.` };
  const open = largestOpen(room, items);
  return { fits: false, spot: null, text: `Not as things stand: the biggest open floor is ${open.w} × ${open.h} cm. MAKE SPACE may free enough.` };
}

// ---------------------------------------------------------------- MAKE SPACE

type Wall = 0 | 1 | 2 | 3; // top, right, bottom, left (the piece's back against it)

/** A piece placed with its back to a wall, slid along it from one end; null when it does not fit there. */
function onWall(room: Room, it: Item, wall: Wall, placed: Rect[], fromEnd: boolean): Item | null {
  const rot = wall as Item['rot'];
  const side = rot % 2 === 1;
  const fw = side ? it.d : it.w;
  const fh = side ? it.w : it.d;
  if (fw > room.w + 0.01 || fh > room.d + 0.01) return null;
  const run = wall % 2 === 0 ? room.w - fw : room.d - fh;
  for (let s = 0; s <= run + 0.01; s += GRID) {
    const along = fromEnd ? run - s : s;
    const x = wall === 0 || wall === 2 ? along : wall === 1 ? room.w - fw : 0;
    const y = wall === 1 || wall === 3 ? along : wall === 0 ? 0 : room.d - fh;
    const r = { x, y, w: fw, h: fh };
    if (!placed.some((p) => overlap(r, p))) return { ...it, x, y, rot };
  }
  return null;
}

/** The ways MAKE SPACE tries: the walls in turn (pieces from the corners), biggest pieces first. */
const STRATEGIES: { name: string; walls: Wall[]; fromEnd: boolean[] }[] = [
  { name: 'along the top and bottom walls', walls: [0, 2, 3, 1], fromEnd: [false, false, false, false] },
  { name: 'along the side walls', walls: [3, 1, 0, 2], fromEnd: [false, false, false, false] },
  { name: 'round the walls, corner to corner', walls: [0, 1, 2, 3], fromEnd: [false, false, true, true] },
  { name: 'into the top-left corner', walls: [0, 3, 1, 2], fromEnd: [false, false, false, false] },
  { name: 'into the bottom-right corner', walls: [2, 1, 0, 3], fromEnd: [true, true, true, true] },
  { name: 'along the bottom and side walls', walls: [2, 3, 1, 0], fromEnd: [false, false, false, false] },
];

export interface Arrangement {
  name: string;
  items: Item[];
  /** The biggest open rectangle of floor it leaves. */
  open: Rect & { area: number };
  /** Gaps under a walkway it leaves. */
  gaps: number;
  /** Pieces moved from where they stand now. */
  moved: number;
}

/** One strategy: biggest pieces first, each against the first wall in the list that has room. */
function arrange(room: Room, items: Item[], walls: Wall[], fromEnd: boolean[]): Item[] | null {
  const order = [...items].sort((a, b) => b.w * b.d - a.w * a.d || a.id.localeCompare(b.id));
  const placed: Rect[] = [];
  const out: Item[] = [];
  for (const it of order) {
    let put: Item | null = null;
    for (let k = 0; k < walls.length && !put; k++) put = onWall(room, it, walls[k]!, placed, fromEnd[k]!);
    if (!put) {
      const spot = findSpot(room, out, it.w, it.d);
      if (!spot) return null;
      put = { ...it, x: spot.x, y: spot.y, rot: spot.rot };
    }
    placed.push(footprint(put));
    out.push(put);
  }
  // back in the owner's order, so the list on screen does not jump about
  return items.map((it) => out.find((o) => o.id === it.id)!);
}

/**
 * MAKE SPACE: up to `max` arrangements that leave more open floor than now, the biggest open
 * rectangle first (fewer tight gaps, then fewer pieces moved, break ties). Every piece stays in
 * the room and nothing overlaps.
 */
export function makeSpace(room: Room, items: Item[], max = 3): { now: Rect & { area: number }; options: Arrangement[] } {
  const now = largestOpen(room, items);
  const seen = new Set<string>();
  const options: Arrangement[] = [];
  for (const s of STRATEGIES) {
    const got = arrange(room, items, s.walls, s.fromEnd);
    if (!got || clashes(room, got).length) continue;
    const key = got.map((it) => `${it.x},${it.y},${it.rot}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const open = largestOpen(room, got);
    const moved = got.filter((g, i) => g.x !== items[i]!.x || g.y !== items[i]!.y || g.rot !== items[i]!.rot).length;
    options.push({ name: s.name, items: got, open, gaps: tightGaps(got).length, moved });
  }
  options.sort((a, b) => b.open.area - a.open.area || a.gaps - b.gaps || a.moved - b.moved);
  return { now, options: options.filter((o) => o.open.area > now.area && o.moved > 0).slice(0, max) };
}

// ---------------------------------------------------------------- saving

export interface Plan {
  v: 1;
  room: Room;
  items: Item[];
}

/** A plan read back from JSON (the phone's storage or an imported file), checked and cleaned; null when it is not one. */
export function readPlan(json: unknown): Plan | null {
  const o = json as { room?: { w?: unknown; d?: unknown }; items?: unknown };
  const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clampTo(v, lo, hi) : null);
  const w = n(o?.room?.w, 50, 5000);
  const d = n(o?.room?.d, 50, 5000);
  if (w == null || d == null || !Array.isArray(o.items)) return null;
  const items: Item[] = [];
  for (const raw of o.items.slice(0, 60) as Record<string, unknown>[]) {
    const iw = n(raw?.w, 5, 1000);
    const id = n(raw?.d, 5, 1000);
    if (iw == null || id == null) continue;
    const rot = [0, 1, 2, 3].includes(raw.rot as number) ? (raw.rot as Item['rot']) : 0;
    items.push({ id: String(raw.id ?? `i${items.length}`).slice(0, 24), kind: String(raw.kind ?? 'custom').slice(0, 20), label: String(raw.label ?? 'Item').slice(0, 40), w: iw, d: id, x: n(raw.x, 0, w) ?? 0, y: n(raw.y, 0, d) ?? 0, rot });
  }
  return { v: 1, room: { w, d }, items };
}

/** The plan in plain words, for the chat ("Room 420 × 360 cm; Sofa, 3-seater 210 × 95 at the top wall; …"). */
export function describePlan(plan: Plan): string {
  const wall = (it: Item) => {
    const f = footprint(it);
    const at = [f.y <= 1 ? 'top wall' : '', f.x + f.w >= plan.room.w - 1 ? 'right wall' : '', f.y + f.h >= plan.room.d - 1 ? 'bottom wall' : '', f.x <= 1 ? 'left wall' : ''].filter(Boolean);
    return at.length ? `against the ${at.join(' and ')}` : `at ${Math.round(f.x)},${Math.round(f.y)} cm`;
  };
  const open = largestOpen(plan.room, plan.items);
  const gaps = tightGaps(plan.items);
  return [
    `Room ${plan.room.w} × ${plan.room.d} cm (${(plan.room.w * plan.room.d / 10000).toFixed(1)} m²)`,
    ...plan.items.map((it) => `${it.label} ${it.w} × ${it.d} cm ${wall(it)}`),
    `biggest open floor ${open.w} × ${open.h} cm`,
    gaps.length ? `${gaps.length} gap${gaps.length > 1 ? 's' : ''} under ${WALKWAY} cm` : '',
  ]
    .filter(Boolean)
    .join('; ');
}
