/**
 * PARAMETRIC FURNITURE AND ROOMS FOR THE STAGE (BRIEF-SHOW-ME-1): a part or a room built from numbers, as boxes, no model and no
 * download. A part is composed from its size (his numbers where he gave them, a stated default where not); a room is the Studio's
 * own room plan (studio/room.ts) with the parts stood in it. Pure: the drawing is show/iso.ts, the surface show/stage.ts.
 *
 * The wall, said on screen: this composes a thing from parameters; there is no free text-to-3D on a phone, so a thing that is not
 * in the table below is not drawn at all.
 */
import { roomBoxes, type Box, type RoomItem, type RoomPlan } from '../studio/room';

export type PartKind = 'table' | 'desk' | 'shelf' | 'bed' | 'sofa' | 'wardrobe' | 'chair' | 'stool' | 'bench' | 'cabinet' | 'engine';
/** Width, depth, height in cm. */
export type Dims = { w: number; d: number; h: number };

/** Each part: its words, its default size (cm), what it is called. Defaults are the common sizes the planner uses. */
export const PARTS: { kind: PartKind; re: RegExp; name: string; dims: Dims }[] = [
  { kind: 'desk', re: /\bdesks?\b|\bworkstation\b/, name: 'Desk', dims: { w: 120, d: 60, h: 75 } },
  { kind: 'table', re: /\b(?:dining |coffee |kitchen |side )?tables?\b/, name: 'Table', dims: { w: 160, d: 90, h: 75 } },
  { kind: 'shelf', re: /\bshel(?:f|ves|ving)(?: unit)?\b|\bbookcases?\b|\bbookshel(?:f|ves)\b/, name: 'Shelf unit', dims: { w: 80, d: 30, h: 180 } },
  { kind: 'bed', re: /\bbeds?\b|\bdouble bed\b|\bsingle bed\b/, name: 'Bed', dims: { w: 150, d: 200, h: 90 } },
  { kind: 'sofa', re: /\bsofas?\b|\bcouch(?:es)?\b|\bsettees?\b/, name: 'Sofa', dims: { w: 210, d: 95, h: 85 } },
  { kind: 'wardrobe', re: /\bwardrobes?\b/, name: 'Wardrobe', dims: { w: 100, d: 55, h: 200 } },
  { kind: 'chair', re: /\bchairs?\b|\barmchairs?\b/, name: 'Chair', dims: { w: 45, d: 45, h: 90 } },
  { kind: 'stool', re: /\bstools?\b/, name: 'Stool', dims: { w: 35, d: 35, h: 65 } },
  { kind: 'bench', re: /\bbench(?:es)?\b/, name: 'Bench', dims: { w: 120, d: 35, h: 45 } },
  { kind: 'cabinet', re: /\bcabinets?\b|\bsideboards?\b|\bcupboards?\b|\bdrawers\b|\bchest of drawers\b/, name: 'Cabinet', dims: { w: 100, d: 45, h: 80 } },
];

const partOf = (kind: PartKind) => PARTS.find((p) => p.kind === kind)!;

/** The working engine (BRIEF-WORKING-ENGINE): a part of a kind of its own, not one of the ten of a room: the car's own model (car/engine.ts) turns inside the Studio. */
export const ENGINE_PART = { kind: 'engine' as const, name: 'Engine', dims: { w: 120, d: 60, h: 70 } };
/** "how does an engine work", "show me the four strokes", "show me a turbo", "draw me an engine". */
const ENGINE_ASK = /\bhow (?:does|do|would) (?:an? |the |my |a car'?s |car )?(?:car |petrol |diesel )?engines? work\b|\b(?:four|4)[ -]strokes?\b|\bstrokes? (?:of|in) (?:an? |the )?engine\b|\b(?:show|draw|build|make|picture|model|explain|open)\b.{0,24}\b(?:an? |the |my )?(?:car |petrol |diesel )?engine\b|\b(?:show|draw|explain)\b.{0,20}\bturbo(?:charger)?\b/;

const MAKE = /\b(?:show|draw|design|build|make|model|picture|visuali[sz]e|render|sketch|3-?d|what (?:does|would) (?:it|that|a|an|the) .{0,30}look like|lay out|furnish)\b/i;
const NOT = /\b(?:buy|price|cost|cheap(?:est)?|where (?:can|do) i|deliver|order|sell|how much|review|best)\b/i;
const ROOM_WORD = /\b(?:room|bedroom|lounge|living room|kitchen|study|office|nursery|garage|box room|spare room)\b/i;

const nums = (text: string): { v: number; unit: string }[] => [...text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|foot|in|inch(?:es)?)?\b/gi)].map((m) => ({ v: Number(m[1]), unit: (m[2] ?? '').toLowerCase() }));

/** A length with its unit, in cm; a bare number is cm above 10 and metres below it ("4 by 3" is metres, "140 by 70" is cm). */
function cm(v: number, unit: string, bareIsM: boolean): number {
  if (/^m/.test(unit) && unit !== 'mm') return v * 100;
  if (unit === 'mm') return v / 10;
  if (/^f/.test(unit)) return v * 30.48;
  if (/^in/.test(unit)) return v * 2.54;
  if (unit === 'cm') return v;
  return bareIsM ? v * 100 : v;
}

/** "140 by 70", "140 x 70 x 75 cm", "4m × 3m": the run of two or three sizes joined by by / x / ×. */
export type Shown = 'mm' | 'cm' | 'm' | 'ft' | 'in';
/** The unit he used, as the edges of the picture write it ("4 by 3" is metres, "140 by 70" is cm). */
const shownOf = (unit: string, bareIsM: boolean): Shown => (unit === 'mm' ? 'mm' : /^m/.test(unit) ? 'm' : /^f/.test(unit) ? 'ft' : /^in/.test(unit) ? 'in' : unit === 'cm' ? 'cm' : bareIsM ? 'm' : 'cm');
/** A length in cm written in the unit he used: "1.4 m", "140 cm", "4 ft 7". */
export function lengthIn(cmv: number, unit: Shown): string {
  const r = (x: number, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d);
  if (unit === 'm') return `${r(cmv / 100, 2)} m`;
  if (unit === 'mm') return `${r(cmv * 10, 0)} mm`;
  if (unit === 'ft') return `${r(cmv / 30.48, 1)} ft`;
  if (unit === 'in') return `${r(cmv / 2.54, 1)} in`;
  return `${r(cmv, 0)} cm`;
}
function runOf(text: string): { vals: number[]; unit: string; shown: Shown } | null {
  const m = /(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|in|inch(?:es)?)?\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|in|inch(?:es)?)?(?:\s*(?:by|x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|in|inch(?:es)?)?)?/i.exec(text);
  if (!m) return null;
  const units = [m[2], m[4], m[6]].filter(Boolean).map((u) => u!.toLowerCase());
  const unit = units[units.length - 1] ?? '';
  const raw = [m[1], m[3], m[5]].filter(Boolean).map(Number);
  const bareIsM = !unit && raw.every((x) => x <= 12);
  const us = [m[2], m[4], m[6]];
  return { vals: raw.map((x, i) => cm(x, (us[i] ?? unit ?? '').toLowerCase() || unit, bareIsM)), unit, shown: shownOf(unit, bareIsM) };
}

export interface PartAsk {
  kind: PartKind;
  /** The engine ask named a turbo ("show me a turbo"): it opens on a turbo engine. */
  turbo?: boolean;
  name: string;
  dims: Dims;
  /** Which of w, d, h were his and which are the stated default. */
  given: ('w' | 'd' | 'h')[];
  /** The unit he used, for the sizes written on the edges. */
  unit: Shown;
}

/** "show me a desk 140 by 70": a part and its size; null for a thing not in the table, a buying question, or no making word. */
export function partAsked(ask: string): PartAsk | null {
  const t = ask.toLowerCase().replace(/[’']/g, "'");
  // an engine: how it works, its strokes, a turbo (a room with an engine in it is not a thing)
  if (!NOT.test(t) && ENGINE_ASK.test(t) && !ROOM_WORD.test(t)) return { kind: 'engine', name: ENGINE_PART.name, dims: { ...ENGINE_PART.dims }, given: [], unit: 'cm', ...(/\bturbo/.test(t) ? { turbo: true } : {}) };
  if (NOT.test(t) || !MAKE.test(t)) return null;
  // a room with parts in it is a room, not a part
  const hit = PARTS.map((p) => ({ p, at: t.search(p.re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at);
  if (!hit.length) return null;
  const p = hit[0]!.p;
  const dims = { ...p.dims };
  const given: PartAsk['given'][number][] = [];
  const run = runOf(t);
  let unit: Shown = run?.shown ?? 'cm';
  if (run && run.vals.length >= 2) {
    const [a, b, c] = run.vals as [number, number, number | undefined];
    // two sizes are width and depth; three are width, depth, height
    dims.w = a;
    dims.d = b;
    given.push('w', 'd');
    if (c) {
      dims.h = c;
      given.push('h');
    }
  } else {
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|in|inch(?:es)?)?\s*(wide|long|deep|high|tall)\b/g)) {
      const v = cm(Number(m[1]), (m[2] ?? '').toLowerCase(), false);
      const k = m[3] === 'wide' || m[3] === 'long' ? 'w' : m[3] === 'deep' ? 'd' : 'h';
      if (!given.length) unit = shownOf((m[2] ?? '').toLowerCase(), false);
      dims[k] = v;
      if (!given.includes(k)) given.push(k);
    }
  }
  for (const k of ['w', 'd', 'h'] as const) dims[k] = Math.round(Math.max(15, Math.min(k === 'h' ? 300 : 400, dims[k])));
  return { kind: p.kind, name: p.name, dims, given, unit };
}

export interface RoomAsk {
  w: number;
  d: number;
  /** What he named to stand in it, in the order he said it, with counts. */
  things: { kind: PartKind; n: number }[];
  /** True when the size was his. */
  sized: boolean;
  /** The unit he used (metres when he gave none), for the sizes written on the edges. */
  unit: Shown;
}

const COUNT: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, a_pair_of: 2 };

/** "a room 4 by 3 with a sofa and a bed": the room's size in cm and the parts in it; null when no room is meant. */
export function roomAsked(ask: string): RoomAsk | null {
  const t = ask.toLowerCase().replace(/[’']/g, "'");
  if (NOT.test(t) || !MAKE.test(t) || !ROOM_WORD.test(t)) return null;
  const run = runOf(t);
  const sized = !!run && run.vals.length >= 2 && run.vals[0]! >= 150 && run.vals[1]! >= 150;
  const w = sized ? run!.vals[0]! : 400;
  const d = sized ? run!.vals[1]! : 300;
  const things: RoomAsk['things'] = [];
  const after = t.slice(Math.max(0, t.search(/\bwith\b|\bcontaining\b|\bfurnished with\b|\bfor\b/)));
  const scope = /\bwith\b|\bcontaining\b|\bfurnished with\b/.test(t) ? after : t;
  for (const p of PARTS) {
    const m = new RegExp(`(?:\\b(a|an|one|two|three|four|\\d+)\\s+)?(?:[a-z]+\\s+)?${p.re.source}`, 'i').exec(scope);
    if (m) things.push({ kind: p.kind, n: Math.max(1, Math.min(4, COUNT[(m[1] ?? 'a').toLowerCase()] ?? (Number(m[1]) || 1))) });
  }
  things.sort((a, b) => scope.search(partOf(a.kind).re) - scope.search(partOf(b.kind).re));
  return { w: Math.round(Math.max(150, Math.min(1500, w))), d: Math.round(Math.max(150, Math.min(1500, d))), things: things.slice(0, 6), sized, unit: sized ? run!.shown : 'm' };
}

/** A part as boxes in metres: centred on x and z at 0, standing on the floor (y up), its width along x. */
export function partBoxes(kind: PartKind, dims: Dims): Box[] {
  const W = dims.w / 100;
  const D = dims.d / 100;
  const H = dims.h / 100;
  const box = (name: string, size: [number, number, number], pos: [number, number, number]): Box => ({ name, kind: 'item', size, pos, rotY: 0 });
  const top = Math.min(0.04, H * 0.06);
  const leg = Math.min(0.06, Math.min(W, D) * 0.12);
  const legs = (h: number, inset = 0.02): Box[] =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => box(`Leg ${i + 1}`, [leg, h, leg], [sx! * (W / 2 - leg / 2 - inset), h / 2, sz! * (D / 2 - leg / 2 - inset)]));
  switch (kind) {
    case 'table':
      return [box('Top', [W, top, D], [0, H - top / 2, 0]), ...legs(H - top)];
    case 'desk': {
      const side = Math.min(0.03, W * 0.04);
      return [
        box('Top', [W, top, D], [0, H - top / 2, 0]),
        box('Left panel', [side, H - top, D * 0.92], [-W / 2 + side / 2 + 0.02, (H - top) / 2, 0]),
        box('Right panel', [side, H - top, D * 0.92], [W / 2 - side / 2 - 0.02, (H - top) / 2, 0]),
        box('Back rail', [W - 0.08, (H - top) * 0.3, side], [0, (H - top) * 0.78, -D / 2 + side / 2 + 0.02]),
      ];
    }
    case 'shelf': {
      const t = 0.02;
      const n = Math.max(2, Math.min(7, Math.round(H / 0.35)));
      const out: Box[] = [
        box('Left side', [t, H, D], [-W / 2 + t / 2, H / 2, 0]),
        box('Right side', [t, H, D], [W / 2 - t / 2, H / 2, 0]),
        box('Back', [W, H, 0.006], [0, H / 2, -D / 2 + 0.003]),
      ];
      for (let i = 0; i <= n; i++) out.push(box(`Shelf ${i + 1}`, [W - 2 * t, t, D - 0.006], [0, t / 2 + (i * (H - t)) / n, 0.003]));
      return out;
    }
    case 'bed': {
      const base = Math.min(0.3, H * 0.34);
      return [
        box('Frame', [W, base, D], [0, base / 2, 0]),
        box('Mattress', [W - 0.06, 0.2, D - 0.1], [0, base + 0.1, 0.02]),
        box('Headboard', [W, H - base * 0.5, 0.06], [0, (H + base * 0.5) / 2, -D / 2 + 0.03]),
        box('Pillow', [Math.min(0.6, W * 0.38), 0.12, 0.35], [-W * 0.2, base + 0.26, -D / 2 + 0.3]),
      ];
    }
    case 'sofa': {
      const seat = Math.min(0.42, H * 0.5);
      const arm = Math.min(0.18, W * 0.1);
      return [
        box('Base', [W, seat * 0.7, D], [0, seat * 0.35, 0]),
        box('Seat cushions', [W - 2 * arm, seat * 0.35, D - 0.22], [0, seat * 0.7 + seat * 0.175, 0.1]),
        box('Back', [W, H - seat * 0.5, 0.22], [0, seat * 0.5 + (H - seat * 0.5) / 2, -D / 2 + 0.11]),
        box('Left arm', [arm, seat * 1.25, D], [-W / 2 + arm / 2, seat * 0.625, 0]),
        box('Right arm', [arm, seat * 1.25, D], [W / 2 - arm / 2, seat * 0.625, 0]),
      ];
    }
    case 'wardrobe':
      return [
        box('Carcass', [W, H - 0.08, D], [0, 0.08 + (H - 0.08) / 2, 0]),
        box('Left door', [W / 2 - 0.01, H - 0.14, 0.02], [-W / 4, 0.08 + (H - 0.08) / 2, D / 2 + 0.01]),
        box('Right door', [W / 2 - 0.01, H - 0.14, 0.02], [W / 4, 0.08 + (H - 0.08) / 2, D / 2 + 0.01]),
        box('Plinth', [W - 0.04, 0.08, D - 0.04], [0, 0.04, 0]),
      ];
    case 'chair': {
      const seatH = H * 0.5;
      return [
        box('Seat', [W, 0.04, D], [0, seatH, 0]),
        ...legs(seatH - 0.02, 0.01).map((b) => ({ ...b, size: [0.035, b.size[1], 0.035] as [number, number, number] })),
        box('Back', [W, H - seatH, 0.03], [0, seatH + (H - seatH) / 2, -D / 2 + 0.015]),
      ];
    }
    case 'stool':
      return [box('Seat', [W, 0.04, D], [0, H - 0.02, 0]), ...legs(H - 0.04, 0.02)];
    case 'bench':
      return [box('Seat', [W, 0.05, D], [0, H - 0.025, 0]), box('Left end', [0.04, H - 0.05, D], [-W / 2 + 0.02, (H - 0.05) / 2, 0]), box('Right end', [0.04, H - 0.05, D], [W / 2 - 0.02, (H - 0.05) / 2, 0])];
    case 'cabinet':
      return [
        box('Carcass', [W, H - 0.1, D], [0, 0.1 + (H - 0.1) / 2, 0]),
        box('Left door', [W / 2 - 0.01, H - 0.16, 0.02], [-W / 4, 0.1 + (H - 0.1) / 2, D / 2 + 0.01]),
        box('Right door', [W / 2 - 0.01, H - 0.16, 0.02], [W / 4, 0.1 + (H - 0.1) / 2, D / 2 + 0.01]),
        ...legs(0.1, 0.03),
      ];
    case 'engine': {
      // the Stage's picture of the working engine: its main masses as boxes (the Studio draws the real one, turning)
      const sump = H * 0.14;
      const block = H * 0.34;
      const head = H * 0.2;
      const cover = H * 0.1;
      return [
        box('Sump', [W * 0.5, sump, D * 0.5], [0, sump / 2, 0]),
        box('Block', [W * 0.56, block, D * 0.6], [0, sump + block / 2, 0]),
        box('Head', [W * 0.56, head, D * 0.62], [0, sump + block + head / 2, 0]),
        box('Cover', [W * 0.52, cover, D * 0.5], [0, sump + block + head + cover / 2, 0]),
        box('Inlet manifold', [W * 0.46, H * 0.12, D * 0.16], [0, sump + block + head * 0.55, -D * 0.4]),
        box('Exhaust manifold', [W * 0.46, H * 0.12, D * 0.14], [0, sump + block + head * 0.4, D * 0.4]),
        box('Flywheel', [W * 0.08, H * 0.55, D * 0.8], [-W * 0.34, H * 0.3, 0]),
        box('Pulleys', [W * 0.1, H * 0.4, D * 0.5], [W * 0.34, H * 0.3, 0]),
        box('Alternator', [W * 0.1, H * 0.16, D * 0.2], [W * 0.4, H * 0.55, -D * 0.3]),
      ];
    }
  }
}

/** The room plan for a room ask: the parts stood along the walls, a table in the middle (cm, the Studio's own shape). */
export function roomPlanFor(r: RoomAsk): RoomPlan {
  const items: (RoomItem & { kind: PartKind })[] = [];
  const m = 8; // a hand's breadth from the wall
  let back = 0;
  let left = 0;
  let right = 0;
  for (const t of r.things) {
    const p = partOf(t.kind);
    for (let i = 0; i < t.n; i++) {
      const { w, d, h } = p.dims;
      if (t.kind === 'table' || t.kind === 'chair' || t.kind === 'stool') {
        items.push({ kind: t.kind, name: p.name, w, d, h, x: Math.round((r.w - w) / 2 + (t.kind === 'table' ? 0 : (i - (t.n - 1) / 2) * (w + 20))), y: Math.round((r.d - d) / 2 + (t.kind === 'table' ? 0 : d + 60)), rot: 0 });
      } else if (t.kind === 'bed' || t.kind === 'wardrobe' || t.kind === 'shelf' || t.kind === 'desk' || t.kind === 'cabinet') {
        // along the back wall first, then the left wall (turned), then the right
        if (back + w + m <= r.w - m) {
          items.push({ kind: t.kind, name: p.name, w, d, h, x: m + back, y: m, rot: 0 });
          back += w + m;
        } else if (left + w + m <= r.d - 2 * m - d) {
          items.push({ kind: t.kind, name: p.name, w, d, h, x: m, y: m + d + left, rot: 0 });
          left += w + m;
        } else {
          items.push({ kind: t.kind, name: p.name, w, d, h, x: r.w - m - w, y: m + d + right, rot: 0 });
          right += w + m;
        }
      } else {
        // a sofa faces the room from the front wall; a bench beside it
        items.push({ kind: t.kind, name: p.name, w, d, h, x: Math.round((r.w - w) / 2 + i * 20), y: r.d - d - m, rot: 0 });
      }
    }
  }
  return { room: { w: r.w, d: r.d, h: 240 }, items };
}

/** The room as boxes: the Studio's floor and walls, each item composed from its own parameters, in the place the plan gives it. */
export function roomBoxesOf(plan: RoomPlan, kinds: PartKind[]): { boxes: Box[]; warnings: string[] } {
  const base = roomBoxes({ ...plan, items: [] });
  const W = plan.room.w / 100;
  const D = plan.room.d / 100;
  const out = [...base.boxes];
  (plan.items ?? []).forEach((it, i) => {
    const cx = it.x / 100 + it.w / 200 - W / 2;
    const cz = it.y / 100 + it.d / 200 - D / 2;
    const rot = (-(it.rot ?? 0) * Math.PI) / 180;
    for (const b of partBoxes(kinds[i] ?? 'table', { w: it.w, d: it.d, h: it.h ?? 75 })) out.push({ ...b, name: `${it.name}: ${b.name}`, pos: [cx + b.pos[0], b.pos[1], cz + b.pos[2]], rotY: rot });
  });
  return { boxes: out, warnings: roomBoxes(plan).warnings };
}
