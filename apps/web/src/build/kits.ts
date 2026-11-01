/**
 * DESIGN A BUILD's kits (BRIEF-REST-D 1): a design drawn by code from a parametric kit per build type — never by a model —
 * so the same words always give the same design, and every number says how it was reached. Pure, so the node test reads it.
 *
 *  - SHED: a timber frame at 600 centres (47 × 75), shiplap cladding, a pent or an apex roof with its pitch (OSB and felt),
 *    a door and a window, a floor on bearers, and the base it needs (slabs on sand).
 *  - GARDEN ROOM: insulated stud walls (47 × 100, PIR between), a warm flat roof, double doors, a window, the electrics as one
 *    line for a registered electrician (Part P), on ground screws.
 *  - GARAGE: block (or timber) walls, an up-and-over door under a steel lintel, a concrete slab on hardcore, a mono-pitch
 *    roof.
 *  - A ROOM: the walls' paint, the floor, the skirting, the ceiling, a radiator or electric underfloor heating sized by a plain
 *    rule of thumb, and a fitted wardrobe wall when he asks for one.
 *  - FURNITURE (a bookshelf, a desk, a bench): the boards, the fixings and a load line from the beam formula.
 *  - A PC, a car, a robot, a TV: pc.ts and concept.ts.
 * Each design has THE PLAN (2-D views in metres), THE 3-D (boxes, each in a part group, with where it goes when the build is
 * exploded), THE BILL (lines priced from prices.ts, cut lists for what is cut from lengths) and THE BUILD (the order of work,
 * the tools, the hours for one person, the safety and law lines as rules of thumb with the official words).
 */
import { boxesFor, cutList, kilosFor, PRICES, radiatorPrice, sheetsFor, type Cut, type CutPlan, type PriceId } from './prices';
import { pcDesign } from './pc';
import { conceptDesign } from './concept';

export type Kind = 'shed' | 'gardenroom' | 'garage' | 'room' | 'shelf' | 'desk' | 'bench' | 'pc' | 'car' | 'robot' | 'tv';
export const BUILDINGS: Kind[] = ['shed', 'gardenroom', 'garage', 'room'];
export const FURNITURE: Kind[] = ['shelf', 'desk', 'bench'];
export const CONCEPTS: Kind[] = ['car', 'robot', 'tv'];

export const KIND_NAMES: Record<Kind, string> = {
  shed: 'Garden shed', gardenroom: 'Garden room', garage: 'Single garage', room: 'Room', shelf: 'Bookshelf', desk: 'Desk', bench: 'Garden bench',
  pc: 'PC build', car: 'Electric car', robot: 'Robot', tv: 'Big screen',
};

export type PcSlot = 'cpu' | 'board' | 'ram' | 'ssd' | 'gpu' | 'psu' | 'case' | 'cooler';

/** Everything a design is made from: his words, then his fields. Sizes in metres. */
export interface Params {
  kind: Kind;
  /** Buildings: the front's width and the depth, outside; furniture: width, depth; height: walls' (the high side) or the piece's. */
  w: number;
  d: number;
  h: number;
  roof: 'pent' | 'apex' | 'flat';
  walls: 'timber' | 'block';
  windows: number;
  doors: 'single' | 'double';
  floor: 'carpet' | 'laminate';
  heat: 'radiator' | 'underfloor' | 'none';
  wardrobe: boolean;
  desk: boolean;
  material: 'pine' | 'mdf' | 'oak' | 'ply';
  /** A room's name in his words ("bedroom"). */
  room: string;
  budget: number;
  use: 'gaming' | 'editing' | 'school';
  /** A PC's parts, by slot (pc.ts ids). */
  pc?: Partial<Record<PcSlot, string>>;
  /** What his words left me to assume ("8 by 6 read as feet"). */
  notes: string[];
}

/** A line of the bill: what to buy, how many, what it costs (a first estimate) and, for lengths, the cut list. */
export interface Line {
  id: string;
  group: string;
  name: string;
  size: string;
  material: string;
  /** How many to buy, in `unit` ("7 lengths", "3 sheets", "2 boxes", "1.5 kg"). */
  n: number;
  unit: string;
  /** The priced quantity and its rate: metres of timber at £ a metre, or `n` at £ each. */
  qty: number;
  per: string;
  rate: number;
  total: number;
  cut?: CutPlan;
  note?: string;
  price?: PriceId;
}

/** A part in 3-D: a box (centre and size, m), its group, colour, and where it goes when the build is exploded. */
export interface Box {
  id: string;
  group: string;
  label: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  out: [number, number, number];
  rx?: number;
  ry?: number;
  rz?: number;
  glass?: boolean;
  /** A wedge, not a box: its top slopes from nothing to its full height, high at its own +x (1) or −x (−1). */
  wedge?: 1 | -1;
}

/** A drawing's items, in metres, y up. */
export type Item2D =
  | { t: 'rect'; x: number; y: number; w: number; h: number; k: 'wall' | 'board' | 'open' | 'glass' | 'part' | 'ground' | 'roof' | 'fill'; label?: string }
  | { t: 'line'; pts: [number, number][]; k: 'edge' | 'thin' | 'dash' | 'roof'; close?: boolean }
  | { t: 'dim'; a: [number, number]; b: [number, number]; text: string; off: number }
  | { t: 'arc'; x: number; y: number; r: number; a0: number; a1: number }
  | { t: 'text'; x: number; y: number; text: string };
export interface View2D {
  title: string;
  /** The drawing's extent (m), from 0,0. */
  w: number;
  h: number;
  items: Item2D[];
  /** What VoiceOver reads for this view. */
  words: string;
}

export interface Group {
  id: string;
  name: string;
}
export interface LawLine {
  title: string;
  words: string;
  source: string;
}

export interface Design {
  params: Params;
  kind: Kind;
  title: string;
  /** One line: the sizes and the main choices. */
  summary: string;
  concept: boolean;
  groups: Group[];
  lines: Line[];
  boxes: Box[];
  views: View2D[];
  steps: string[];
  tools: string[];
  hours: number;
  safety: string[];
  law: LawLine[];
  notes: string[];
  /** Furniture: what it carries (the beam formula); a room: its heat need. */
  load?: string;
  heat?: string;
  /** The parts total (first estimate), £. */
  total: number;
  /** A PC: its compatibility lines; a concept: its parts named. */
  compat?: { ok: boolean; text: string }[];
  parts?: { role: string; name: string; why: string; typical: string }[];
}

// ---------------------------------------------------------------- the defaults per kind

export const DEFAULTS: Record<Kind, Pick<Params, 'w' | 'd' | 'h'> & Partial<Params>> = {
  shed: { w: 2.4, d: 1.8, h: 2.1, roof: 'pent' },
  gardenroom: { w: 4, d: 3, h: 2.45, roof: 'flat', doors: 'double', windows: 1 },
  garage: { w: 3.2, d: 5.6, h: 2.3, roof: 'pent', walls: 'block' },
  room: { w: 4, d: 3, h: 2.4, windows: 1, heat: 'radiator', floor: 'carpet' },
  shelf: { w: 0.8, d: 0.3, h: 1.8, material: 'pine' },
  desk: { w: 1.2, d: 0.6, h: 0.73, material: 'ply' },
  bench: { w: 1.5, d: 0.42, h: 0.45, material: 'pine' },
  pc: { w: 0.23, d: 0.45, h: 0.47, budget: 800, use: 'gaming' },
  car: { w: 1.4, d: 2.6, h: 1.2 },
  robot: { w: 0.2, d: 0.25, h: 0.12 },
  tv: { w: 1.23, d: 0.06, h: 0.71 },
};
/** Sizes a kind is held to (m): [min, max] for width, depth, height. */
export const LIMITS: Partial<Record<Kind, [[number, number], [number, number], [number, number]]>> = {
  shed: [[1.2, 6], [1.2, 5], [1.8, 2.5]],
  gardenroom: [[2, 8], [2, 6], [2.2, 2.5]],
  garage: [[2.4, 8], [4, 9], [2.1, 3]],
  room: [[1.5, 10], [1.5, 10], [2.1, 3.5]],
  shelf: [[0.3, 4], [0.15, 0.6], [0.3, 2.6]],
  desk: [[0.6, 3], [0.4, 1.2], [0.6, 1.2]],
  bench: [[0.6, 3], [0.3, 0.6], [0.35, 0.6]],
};

export function paramsFor(kind: Kind, over: Partial<Params> = {}): Params {
  const base: Params = { kind, w: 1, d: 1, h: 1, roof: 'pent', walls: 'timber', windows: 1, doors: 'single', floor: 'carpet', heat: 'radiator', wardrobe: false, desk: false, material: 'pine', room: '', budget: 800, use: 'gaming', notes: [] };
  return clampParams({ ...base, ...DEFAULTS[kind], ...over, kind, notes: over.notes ?? [] });
}

const r2 = (x: number) => Math.round(x * 100) / 100;
/** A size as he reads it: "3.0 m", "2.45 m" (never rounded past what it is). */
const m = (x: number) => {
  const v = r2(x);
  return `${Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? v.toFixed(1) : v.toFixed(2)} m`;
};
const mm = (x: number) => `${Math.round(x * 1000)} mm`;
const deg = (rad: number) => (rad * 180) / Math.PI;

/** Sizes held inside what the kind can be; a size moved is said in the notes. */
export function clampParams(p: Params): Params {
  const lim = LIMITS[p.kind];
  if (!lim) return p;
  const notes = [...p.notes];
  const keep = (v: number, [lo, hi]: [number, number], what: string) => {
    if (v < lo) {
      notes.push(`I kept the ${what} to ${m(lo)}, the least a ${KIND_NAMES[p.kind].toLowerCase()} works at`);
      return lo;
    }
    if (v > hi) {
      notes.push(`I kept the ${what} to ${m(hi)}: past that it is not a ${KIND_NAMES[p.kind].toLowerCase()} I can draw honestly`);
      return hi;
    }
    return r2(v);
  };
  return { ...p, w: keep(p.w, lim[0], 'width'), d: keep(p.d, lim[1], 'depth'), h: keep(p.h, lim[2], 'height'), windows: Math.max(0, Math.min(4, Math.round(p.windows))), notes: [...new Set(notes)] };
}

// ---------------------------------------------------------------- the bill, as it is built up

class Bill {
  lines: Line[] = [];
  private seen = new Map<string, number>();
  constructor(private kind: Kind) {}
  /** A line's id from its group and what it is (so a live price stays with its line when the design changes). */
  private idOf(group: string, price: string): string {
    const k = `${this.kind}-${group}-${price}`;
    const n = (this.seen.get(k) ?? 0) + 1;
    this.seen.set(k, n);
    return `${k}-${n}`;
  }
  /** Bought by the piece (sheets, boxes, kilos, tubes, units). */
  add(group: string, price: PriceId, n: number, o: { size?: string; material?: string; note?: string; unit?: string; name?: string; rate?: number } = {}): Line {
    const p = PRICES[price];
    const rate = o.rate ?? p.gbp;
    const l: Line = {
      id: this.idOf(group, price), group, name: o.name ?? p.name, size: o.size ?? '', material: o.material ?? '', n: r2(n), unit: o.unit ?? unitOf(p.unit, n),
      qty: r2(n), per: p.unit, rate, total: r2(n * rate), ...(o.note || (p as { note?: string }).note ? { note: o.note ?? (p as { note?: string }).note } : {}), price,
    };
    if (l.n > 0) this.lines.push(l);
    return l;
  }
  /** Cut from lengths: the cut list, priced by the metre bought. */
  timber(group: string, price: PriceId, cuts: Cut[], o: { size: string; material?: string; note?: string; name?: string }): Line | null {
    const plan = cutList(cuts.filter((c) => c.n > 0 && c.len > 0));
    if (!plan.bars.length) return null;
    const p = PRICES[price];
    const l: Line = {
      id: this.idOf(group, price), group, name: o.name ?? p.name, size: o.size, material: o.material ?? 'treated softwood', n: plan.bars.length, unit: plan.bars.length === 1 ? 'length' : 'lengths',
      qty: plan.bought, per: 'm', rate: p.gbp, total: r2(plan.bought * p.gbp), cut: plan, ...(o.note ? { note: o.note } : {}), price,
    };
    this.lines.push(l);
    return l;
  }
}
const unitOf = (u: string, n: number) => {
  const one = n === 1;
  return u === 'sheet' ? (one ? 'sheet' : 'sheets') : u === 'box' ? (one ? 'box' : 'boxes') : u === 'tube' ? (one ? 'tube' : 'tubes') : u === 'roll' ? (one ? 'roll' : 'rolls') : u === 'bag' ? (one ? 'bag' : 'bags') : u === 'tin' ? (one ? 'tin' : 'tins') : u === 'tonne' ? (one ? 'tonne' : 'tonnes') : u === 'pack' ? (one ? 'pack' : 'packs') : u;
};

const total = (lines: Line[]) => r2(lines.reduce((s, l) => s + l.total, 0));

// ---------------------------------------------------------------- the law and safety lines (rules of thumb)

const GOV_PD = 'gov.uk, Permitted development rights for householders: technical guidance (Class E, outbuildings)';
const GOV_BR = 'Planning Portal (the government’s planning site), Outbuildings: Building Regulations';
export const LAW = {
  height: {
    title: 'Planning: how tall (a rule of thumb)',
    words: 'Outbuildings are permitted development when they are “single storey with maximum eaves height of 2.5 metres and maximum overall height of four metres with a dual pitched roof or three metres for any other roof”, and at most 2.5 m tall within two metres of a boundary. Not in front of the house, and no more than half the garden covered. Listed buildings, conservation areas and National Parks differ: check with your council.',
    source: GOV_PD,
  },
  use: {
    title: 'Planning: what it is for',
    words: 'It must be for use “incidental to the enjoyment of the dwellinghouse”: a home office, a gym, a games room or a store. Sleeping in it, or a kitchen and bathroom to live in, needs planning permission. Check with your council.',
    source: GOV_PD,
  },
  regs: {
    title: 'Building Regulations (a rule of thumb)',
    words: 'Under 15 m² with no sleeping space: not normally needed. 15–30 m²: not normally needed if it is at least 1 m from every boundary or built mostly of non-combustible material. Bigger, or joined to the house: building control. Check with your council.',
    source: GOV_BR,
  },
  partP: {
    title: 'Electrics: Part P',
    words: 'A new circuit (power to an outbuilding, a heating mat) is notifiable under Part P of the Building Regulations: a registered electrician fits and certifies it, or building control is told before the work starts.',
    source: 'Building Regulations, Approved Document P',
  },
  gas: {
    title: 'Gas',
    words: 'Only a Gas Safe registered engineer may work on gas pipes or a boiler: it is the law. A radiator on an existing wet system is plumbing, not gas.',
    source: 'Gas Safety (Installation and Use) Regulations 1998',
  },
  wall: {
    title: 'Walls that hold the house up',
    words: 'Taking out or cutting into a wall that carries the floor or roof above needs Building Regulations approval and a structural engineer’s steel or lintel: check with your council before anything is cut.',
    source: 'Building Regulations, Approved Document A',
  },
} satisfies Record<string, LawLine>;

// ---------------------------------------------------------------- timber framing (the shed, the garden room, a timber garage)

interface Opening {
  kind: 'door' | 'window';
  /** Its middle, along the wall from the wall's start (m). */
  at: number;
  w: number;
  h: number;
  sill: number;
}
interface WallDef {
  id: 'front' | 'back' | 'left' | 'right';
  len: number;
  /** Height at the wall's start and end (a pent roof's side walls slope). */
  h0: number;
  h1: number;
  openings: Opening[];
}
interface Framed {
  studs: Cut[];
  plates: Cut[];
  noggins: Cut[];
  headers: Cut[];
  /** Where each stud stands along the wall (m) and how tall it is, for the 3-D. */
  at: { s: number; y0: number; len: number }[];
  count: number;
}
const PLATE = 0.047;

/** A wall's frame at its centres: studs (full, beside each opening, and the short ones above and below), plates, a row of noggins. */
function frameWall(w: WallDef, centres: number): Framed {
  const hAt = (s: number) => w.h0 + ((w.h1 - w.h0) * s) / w.len;
  const inOpening = (s: number) => w.openings.find((o) => s > o.at - o.w / 2 - PLATE && s < o.at + o.w / 2);
  const at: Framed['at'] = [];
  const stud = (s: number, y0: number, top: number) => {
    const len = r2(top - y0);
    if (len > 0.05) at.push({ s: r2(s), y0: r2(y0), len });
  };
  const xs: number[] = [];
  for (let s = 0; s < w.len - PLATE - 0.01; s += centres) xs.push(r2(s));
  xs.push(r2(w.len - PLATE));
  for (const s of xs) {
    const o = inOpening(s);
    const top = hAt(s) - PLATE;
    if (!o) stud(s, PLATE, top);
    else {
      // over (and under) an opening: short studs at the same centres
      stud(s, o.sill + o.h + 0.075, top);
      if (o.kind === 'window') stud(s, PLATE, o.sill - 0.047);
    }
  }
  // each side of each opening: a full stud
  for (const o of w.openings) {
    for (const s of [o.at - o.w / 2 - PLATE, o.at + o.w / 2]) stud(s, PLATE, hAt(s) - PLATE);
  }
  at.sort((a, b) => a.s - b.s);
  const full = at.filter((a) => a.y0 <= PLATE + 0.001 && a.len > 1);
  const noggins: Cut[] = [];
  for (let i = 1; i < full.length; i++) {
    const gap = r2(full[i]!.s - full[i - 1]!.s - PLATE);
    const between = w.openings.some((o) => full[i]!.s > o.at - o.w / 2 && full[i - 1]!.s < o.at + o.w / 2);
    if (gap > 0.1 && !between) noggins.push({ len: gap, n: 1, label: 'noggin' });
  }
  const rise = Math.abs(w.h1 - w.h0);
  return {
    studs: at.map((a) => ({ len: a.len, n: 1, label: 'stud' })),
    plates: [{ len: r2(w.len), n: 1, label: 'bottom plate' }, { len: r2(Math.hypot(w.len, rise)), n: 1, label: 'top plate' }],
    noggins,
    headers: w.openings.flatMap((o) => [{ len: r2(o.w + 2 * PLATE), n: 1, label: `${o.kind} head` }, ...(o.kind === 'window' ? [{ len: r2(o.w), n: 1, label: 'window sill' }] : [])]),
    at,
    count: at.length,
  };
}

/** Where a wall runs in the world: its start, its direction along the floor and its outward normal (x, z). */
function wallFrame(id: WallDef['id'], w: number, d: number): { sx: number; sz: number; ux: number; uz: number; nx: number; nz: number } {
  switch (id) {
    case 'front': return { sx: -w / 2, sz: d / 2, ux: 1, uz: 0, nx: 0, nz: 1 };
    case 'back': return { sx: w / 2, sz: -d / 2, ux: -1, uz: 0, nx: 0, nz: -1 };
    case 'left': return { sx: -w / 2, sz: -d / 2, ux: 0, uz: 1, nx: -1, nz: 0 };
    default: return { sx: w / 2, sz: d / 2, ux: 0, uz: -1, nx: 1, nz: 0 };
  }
}

const COL = { frame: 0xd9b27c, plate: 0xcaa06b, clad: 0x8a6a4a, cladLight: 0xb08a63, roof: 0x3b3f45, deck: 0xc9b48a, floor: 0xbfa274, base: 0x9a9a96, glass: 0x9fd3ff, door: 0x7a5a3c, slab: 0xb4b2ac, block: 0xb9b6ae, white: 0xf2f0ea, grey: 0x6c7077, ins: 0xf0d36a, board: 0xe2c9a0, steel: 0x8d949c };

/** A wall's frame and cladding as boxes (world coordinates, the floor's top at `y0`). */
function wallBoxes(def: WallDef, f: Framed, o: { w: number; d: number; y0: number; depth: number; cladT: number; group: string; clad: string; colour?: number }): Box[] {
  const wf = wallFrame(def.id, o.w, o.d);
  const out: Box[] = [];
  const along = (s: number, inset: number) => ({ x: wf.sx + wf.ux * s - wf.nx * inset, z: wf.sz + wf.uz * s - wf.nz * inset });
  const rotY = def.id === 'left' || def.id === 'right' ? Math.PI / 2 : 0;
  f.at.forEach((a, i) => {
    const c = along(a.s + PLATE / 2, o.depth / 2);
    out.push({ id: `${def.id}-stud-${i}`, group: o.group, label: 'Stud', x: c.x, y: o.y0 + a.y0 + a.len / 2, z: c.z, w: PLATE, h: a.len, d: o.depth, color: COL.frame, out: [0, 0, 0], ry: rotY });
  });
  const mid = along(def.len / 2, o.depth / 2);
  const hMid = (def.h0 + def.h1) / 2;
  out.push({ id: `${def.id}-plate-b`, group: o.group, label: 'Bottom plate', x: mid.x, y: o.y0 + PLATE / 2, z: mid.z, w: def.len, h: PLATE, d: o.depth, color: COL.plate, out: [0, 0, 0], ry: rotY });
  // which way the wall's height rises along the box's own x (its turn about y puts that x along or against the wall)
  const along1 = Math.cos(rotY) * wf.ux - Math.sin(rotY) * wf.uz > 0;
  const rise = along1 ? def.h1 - def.h0 : def.h0 - def.h1;
  out.push({ id: `${def.id}-plate-t`, group: o.group, label: 'Top plate', x: mid.x, y: o.y0 + hMid - PLATE / 2, z: mid.z, w: Math.hypot(def.len, def.h1 - def.h0), h: PLATE, d: o.depth, color: COL.plate, out: [0, 0, 0], ry: rotY, ...(rise ? { rz: Math.atan2(rise, def.len) } : {}) });
  // the cladding: one sheet a side of each opening, and above and below it
  const push = 1.1;
  const clad = (s0: number, s1: number, y0: number, y1: number, k: string) => {
    if (s1 - s0 < 0.02 || y1 - y0 < 0.02) return;
    const c = along((s0 + s1) / 2, -o.cladT / 2);
    out.push({ id: `${def.id}-clad-${k}`, group: o.clad, label: 'Cladding', x: c.x, y: o.y0 + (y0 + y1) / 2, z: c.z, w: s1 - s0, h: y1 - y0, d: o.cladT, color: o.colour ?? COL.clad, out: [wf.nx * push, 0, wf.nz * push], ry: rotY });
  };
  const ops = [...def.openings].sort((a, b) => a.at - b.at);
  let s = 0;
  const top = Math.min(def.h0, def.h1);
  ops.forEach((op, i) => {
    const l = op.at - op.w / 2;
    const r = op.at + op.w / 2;
    clad(s, l, 0, top, `${i}a`);
    clad(l, r, op.sill + op.h, top, `${i}b`);
    if (op.sill > 0.05) clad(l, r, 0, op.sill, `${i}c`);
    s = r;
  });
  clad(s, def.len, 0, top, 'end');
  // a sloped wall's wedge above the lower height, high at the wall's high end
  if (Math.abs(rise) > 0.02) {
    const c = along(def.len / 2, -o.cladT / 2);
    out.push({ id: `${def.id}-clad-top`, group: o.clad, label: 'Cladding', x: c.x, y: o.y0 + top + Math.abs(rise) / 2, z: c.z, w: def.len, h: Math.abs(rise), d: o.cladT, color: o.colour ?? COL.clad, out: [wf.nx * push, 0, wf.nz * push], ry: rotY, wedge: rise > 0 ? 1 : -1 });
  }
  // the openings themselves: a door or a pane, proud of the cladding
  for (const op of ops) {
    const c = along(op.at, -o.cladT - 0.01);
    out.push(op.kind === 'door'
      ? { id: `${def.id}-door`, group: 'door', label: 'Door', x: c.x, y: o.y0 + op.sill + op.h / 2, z: c.z, w: op.w, h: op.h, d: 0.04, color: COL.door, out: [wf.nx * 1.6, 0, wf.nz * 1.6], ry: rotY }
      : { id: `${def.id}-window-${op.at}`, group: 'window', label: 'Window', x: c.x, y: o.y0 + op.sill + op.h / 2, z: c.z, w: op.w, h: op.h, d: 0.02, color: COL.glass, out: [wf.nx * 1.6, 0, wf.nz * 1.6], ry: rotY, glass: true });
  }
  return out;
}

/** Cladding boards for a wall: each row a length of the wall, split round its openings (rows of `cover` m). */
function cladCuts(def: WallDef, cover: number): Cut[] {
  const cuts: Cut[] = [];
  const top = Math.max(def.h0, def.h1);
  const rows = Math.ceil(top / cover - 1e-9);
  for (let r = 0; r < rows; r++) {
    const y0 = r * cover;
    const y1 = y0 + cover;
    // a sloped wall's boards stop where the slope does (cut along it)
    const low = Math.min(def.h0, def.h1);
    let len = def.len;
    if (y0 >= low) len = def.len * Math.max(0, 1 - (y0 - low) / Math.max(0.01, top - low));
    const hit = def.openings.filter((o) => y1 > o.sill && y0 < o.sill + o.h);
    if (!hit.length) cuts.push({ len: r2(len), n: 1 });
    else {
      let s = 0;
      for (const o of [...hit].sort((a, b) => a.at - b.at)) {
        if (o.at - o.w / 2 - s > 0.05) cuts.push({ len: r2(o.at - o.w / 2 - s), n: 1 });
        s = o.at + o.w / 2;
      }
      if (def.len - s > 0.05) cuts.push({ len: r2(def.len - s), n: 1 });
    }
  }
  return cuts.filter((c) => c.len > 0.05);
}

/** The area of a wall (m²), less its openings. */
const wallArea = (def: WallDef) => ((def.h0 + def.h1) / 2) * def.len - def.openings.reduce((s, o) => s + o.w * o.h, 0);

// ---------------------------------------------------------------- the plan's common drawings

/** A building's floor plan: the walls (a frame's depth plus its cladding), the door with its swing, the windows, the sizes. */
function floorPlan(w: number, d: number, t: number, walls: WallDef[], title = 'PLAN', extra: Item2D[] = []): View2D {
  const items: Item2D[] = [];
  const pad = 0.6;
  const X = (x: number) => x + w / 2 + pad;
  const Y = (z: number) => -z + d / 2 + pad;
  items.push({ t: 'rect', x: pad, y: pad, w, h: d, k: 'fill' });
  // walls as bands, cut where the openings are
  for (const def of walls) {
    const f = wallFrame(def.id, w, d);
    let s = 0;
    const ops = [...def.openings].sort((a, b) => a.at - b.at);
    const seg = (a: number, b: number) => {
      if (b - a < 0.01) return;
      const x0 = f.sx + f.ux * a;
      const z0 = f.sz + f.uz * a;
      const x1 = f.sx + f.ux * b;
      const z1 = f.sz + f.uz * b;
      const ix = -f.nx * t;
      const iz = -f.nz * t;
      const xs = [x0, x1, x0 + ix, x1 + ix];
      const zs = [z0, z1, z0 + iz, z1 + iz];
      items.push({ t: 'rect', x: X(Math.min(...xs)), y: Y(Math.max(...zs)), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...zs) - Math.min(...zs), k: 'wall' });
    };
    for (const o of ops) {
      seg(s, o.at - o.w / 2);
      const cx = f.sx + f.ux * o.at;
      const cz = f.sz + f.uz * o.at;
      if (o.kind === 'window') {
        const hx = (f.ux * o.w) / 2;
        const hz = (f.uz * o.w) / 2;
        items.push({ t: 'line', pts: [[X(cx - hx - f.nx * t * 0.5), Y(cz - hz - f.nz * t * 0.5)], [X(cx + hx - f.nx * t * 0.5), Y(cz + hz - f.nz * t * 0.5)]], k: 'thin' });
        items.push({ t: 'rect', x: X(Math.min(cx - hx, cx + hx, cx - hx - f.nx * t, cx + hx - f.nx * t)), y: Y(Math.max(cz - hz, cz + hz, cz - hz - f.nz * t, cz + hz - f.nz * t)), w: Math.abs(f.ux) * o.w + Math.abs(f.nx) * t, h: Math.abs(f.uz) * o.w + Math.abs(f.nz) * t, k: 'glass' });
      } else {
        // the door: a leaf swung open inside, and its arc
        const hx = cx - (f.ux * o.w) / 2;
        const hz = cz - (f.uz * o.w) / 2;
        const lx = hx - f.nx * o.w;
        const lz = hz - f.nz * o.w;
        items.push({ t: 'line', pts: [[X(hx), Y(hz)], [X(lx), Y(lz)]], k: 'edge' });
        // the quarter between the open leaf and the closed one, the short way round (angles with the plan's y up)
        const leaf = Math.atan2(-(lz - hz), lx - hx);
        const shut = Math.atan2(-(f.uz * o.w), f.ux * o.w);
        let turn = shut - leaf;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn <= -Math.PI) turn += 2 * Math.PI;
        const a0 = turn >= 0 ? leaf : shut;
        items.push({ t: 'arc', x: X(hx), y: Y(hz), r: o.w, a0, a1: a0 + Math.abs(turn) });
      }
      s = o.at + o.w / 2;
    }
    seg(s, def.len);
  }
  items.push(...extra.map((e) => shift(e, X, Y)));
  items.push({ t: 'dim', a: [pad, pad], b: [pad + w, pad], text: m(w), off: -0.35 });
  items.push({ t: 'dim', a: [pad + w, pad], b: [pad + w, pad + d], text: m(d), off: -0.35 });
  return { title, w: w + 2 * pad, h: d + 2 * pad, items, words: '' };
}
/** Moves an item drawn in world x, z (z towards the front) onto the plan's own coordinates. */
function shift(e: Item2D, X: (x: number) => number, Y: (z: number) => number): Item2D {
  switch (e.t) {
    case 'rect': return { ...e, x: X(e.x), y: Y(e.y) };
    case 'line': return { ...e, pts: e.pts.map(([x, z]) => [X(x), Y(z)] as [number, number]) };
    case 'dim': return { ...e, a: [X(e.a[0]), Y(e.a[1])], b: [X(e.b[0]), Y(e.b[1])] };
    case 'arc': return { ...e, x: X(e.x), y: Y(e.y) };
    default: return { ...e, x: X(e.x), y: Y(e.y) };
  }
}

/** A building's front, from the ground: its walls' outline, the roof line, the door and windows, the heights. */
function frontView(w: number, o: { hl: number; hr: number; roofPts: [number, number][]; base: number; openings: Opening[]; title?: string; pitch?: string; d?: number }): View2D {
  const pad = 0.6;
  const items: Item2D[] = [];
  const X = (x: number) => x + pad;
  const Y = (y: number) => y + pad;
  items.push({ t: 'rect', x: X(-0.3), y: Y(-0.05), w: w + 0.6, h: 0.05, k: 'ground' });
  items.push({ t: 'line', pts: [[X(0), Y(o.base)], [X(w), Y(o.base)], [X(w), Y(o.base + o.hr)], [X(0), Y(o.base + o.hl)]], k: 'edge', close: true });
  items.push({ t: 'line', pts: o.roofPts.map(([x, y]) => [X(x), Y(y)] as [number, number]), k: 'roof' });
  for (const op of o.openings) items.push({ t: 'rect', x: X(op.at - op.w / 2), y: Y(o.base + op.sill), w: op.w, h: op.h, k: op.kind === 'door' ? 'open' : 'glass', label: op.kind === 'door' ? 'door' : '' });
  items.push({ t: 'dim', a: [X(0), Y(0)], b: [X(0), Y(o.base + o.hl)], text: m(o.base + o.hl), off: 0.35 });
  if (Math.abs(o.hr - o.hl) > 0.01) items.push({ t: 'dim', a: [X(w), Y(0)], b: [X(w), Y(o.base + o.hr)], text: m(o.base + o.hr), off: -0.35 });
  items.push({ t: 'dim', a: [X(0), Y(0)], b: [X(w), Y(0)], text: m(w), off: -0.3 });
  if (o.pitch) items.push({ t: 'text', x: X(w / 2), y: Y(Math.max(...o.roofPts.map((p) => p[1])) + 0.25), text: o.pitch });
  const top = Math.max(o.base + o.hl, o.base + o.hr, ...o.roofPts.map((p) => p[1]));
  return { title: o.title ?? 'FRONT', w: w + 2 * pad, h: top + 2 * pad, items, words: '' };
}

/** How long the work is, in words, for one person (7-hour days). */
export const daysWords = (hours: number) => {
  const d = Math.max(0.5, Math.round((hours / 7) * 2) / 2);
  return `about ${Math.round(hours)} hours: ${d === 0.5 ? 'half a day' : d === 1 ? 'a day' : `${d} days`} for one person`;
};

// ---------------------------------------------------------------- the shed

function shed(p: Params): Design {
  const { w, d } = p;
  const apex = p.roof === 'apex';
  const B = new Bill('shed');
  const floorH = 0.047 + 0.075 + 0.018; // bearers, joists, deck
  const front = apex ? 1.8 : p.h;
  const back = apex ? 1.8 : Math.max(1.6, r2(p.h - 0.3));
  const pitch = apex ? (25 * Math.PI) / 180 : Math.atan2(front - back, d);
  const ridge = apex ? r2(front + (d / 2) * Math.tan(pitch)) : front;
  const doorW = p.doors === 'double' ? 1.2 : 0.8;
  const doorH = Math.min(1.8, front - 0.15);
  const winW = 0.6;
  const winH = 0.45;
  const sill = 1.0;
  const walls: WallDef[] = [
    { id: 'front', len: w, h0: front, h1: front, openings: [{ kind: 'door', at: w / 2, w: doorW, h: doorH, sill: 0 }] },
    { id: 'back', len: w, h0: back, h1: back, openings: p.windows > 2 ? [{ kind: 'window', at: w / 2, w: winW, h: winH, sill }] : [] },
    { id: 'left', len: d, h0: back, h1: front, openings: p.windows > 1 ? [{ kind: 'window', at: d / 2, w: winW, h: winH, sill }] : [] },
    { id: 'right', len: d, h0: front, h1: back, openings: p.windows > 0 ? [{ kind: 'window', at: d / 2, w: winW, h: winH, sill }] : [] },
  ];
  const framed = walls.map((x) => frameWall(x, 0.6));
  const studCount = framed.reduce((s, f) => s + f.count, 0);
  // the frame
  B.timber('frame', 't47x75', framed.flatMap((f) => [...f.studs, ...f.plates, ...f.noggins, ...f.headers]), { size: '47 × 75 mm', note: `${studCount} studs at 600 mm centres, plates top and bottom, a row of noggins` });
  // the floor: bearers on the base, joists across them, an OSB deck
  const bearers = Math.ceil(d / 1.0) + 1;
  const joists = Math.ceil(w / 0.4) + 1;
  B.timber('floor', 't47x100', [{ len: w, n: bearers, label: 'bearer' }], { size: '47 × 100 mm', note: `${bearers} bearers along the width, on the base` });
  B.timber('floor', 't47x75', [{ len: r2(d), n: joists, label: 'joist' }], { size: '47 × 75 mm', note: `${joists} floor joists at 400 mm centres` });
  const floorSheets = sheetsFor(w * d);
  B.add('floor', 'osb18', floorSheets, { size: '2440 × 1220 × 18 mm', material: 'OSB3' });
  // the roof
  const over = 0.1;
  const rafterLen = apex ? r2((d / 2 + over) / Math.cos(pitch)) : r2(Math.hypot(d + 2 * over, front - back));
  const rafters = (Math.ceil(w / 0.6) + 1) * (apex ? 2 : 1);
  const roofArea = r2((w + 2 * over) * rafterLen * (apex ? 2 : 1));
  B.timber('roof', 't47x100', [{ len: rafterLen, n: rafters, label: 'rafter' }, ...(apex ? [{ len: r2(w + 2 * over), n: 1, label: 'ridge' }] : [])], { size: '47 × 100 mm', note: `${rafters} rafters at 600 mm centres, ${apex ? `a ${Math.round(deg(pitch))}° apex` : `a pent roof at ${deg(pitch).toFixed(1)}°`}` });
  B.add('roof', 'osb11', sheetsFor(roofArea), { size: '2440 × 1220 × 11 mm', material: 'OSB3' });
  B.add('roof', 'felt', Math.ceil((roofArea * 1.15) / 10), { size: '10 m × 1 m', material: 'bitumen felt', note: 'laid with 75 mm laps, the top over the bottom' });
  B.timber('roof', 'fascia', [{ len: r2(w + 2 * over), n: apex ? 2 : 2 }, { len: rafterLen, n: apex ? 4 : 2 }], { size: '22 × 100 mm', note: 'fascia front and back, barge boards at the ends' });
  // the cladding
  const cover = 0.11;
  const cladCutsAll = walls.flatMap((x) => cladCuts(x, cover));
  const gable = apex ? Array.from({ length: Math.ceil((ridge - front) / cover) }, (_, i) => ({ len: r2(d * (1 - (i * cover) / (ridge - front))), n: 2 })) : [];
  const cladArea = r2(walls.reduce((s, x) => s + wallArea(x), 0) + (apex ? d * (ridge - front) : 0));
  B.timber('cladding', 'shiplap', [...cladCutsAll, ...gable], { size: '12 × 125 mm', material: 'treated shiplap', note: `${cladArea.toFixed(1)} m² of wall, 110 mm of each board showing` });
  // the door: boards on ledges and braces, hung on T-hinges
  const doorBoards = Math.ceil(doorW / cover);
  B.timber('door', 'shiplap', [{ len: doorH, n: doorBoards }], { size: '12 × 125 mm', material: 'treated shiplap', name: 'Door boards (shiplap)', note: `${p.doors === 'double' ? 'two leaves' : 'one leaf'}, boards upright` });
  B.timber('door', 't47x75', [{ len: r2(doorW - 0.02), n: 3, label: 'ledge' }, { len: r2(Math.hypot(doorW, doorH / 2)), n: 2, label: 'brace' }], { size: '47 × 75 mm', name: 'Door ledges and braces', note: 'three ledges and two braces, the braces rising away from the hinges' });
  B.add('door', 'thinge', p.doors === 'double' ? 6 : 3, { size: '300 mm' });
  B.add('door', 'hasp', 1, { note: 'add a padlock you already trust' });
  // the windows
  const panes = walls.reduce((s, x) => s + x.openings.filter((o) => o.kind === 'window').length, 0);
  if (panes) {
    B.add('window', 'poly4', r2(panes * (winW + 0.05) * (winH + 0.05)), { unit: 'm²', size: `${panes} × ${mm(winW + 0.05)} × ${mm(winH + 0.05)}`, material: 'polycarbonate (safer than glass)' });
    B.timber('window', 'batten', [{ len: r2(winW + 0.05), n: panes * 4 }, { len: r2(winH + 0.05), n: panes * 4 }], { size: '25 × 38 mm', name: 'Window beads', note: 'a bead inside and out, all round' });
  }
  // the base it needs
  const nx = Math.ceil((w + 0.1) / 0.6);
  const nz = Math.ceil((d + 0.1) / 0.6);
  B.add('base', 'slab600', nx * nz, { size: '600 × 600 mm', material: 'concrete', note: `${nx} × ${nz} slabs, ${m(nx * 0.6)} × ${m(nz * 0.6)}` });
  B.add('base', 'sand', Math.ceil((nx * nz * 0.36 * 0.04 * 1600) / 25), { size: '25 kg', material: 'sharp sand', note: 'a 40 mm bed, a little cement mixed in' });
  // fixings, counted
  const frameScrews = studCount * 4 + framed.reduce((s, f) => s + f.noggins.length, 0) * 4 + rafters * 4 + joists * 4 + bearers * 2;
  B.add('fixings', 'screws70', boxesFor(frameScrews), { note: `${frameScrews} for the frame, the joists and the rafters (four a joint)` });
  const sheetScrews = (floorSheets + sheetsFor(roofArea)) * 30;
  B.add('fixings', 'screws40', boxesFor(sheetScrews), { note: `${sheetScrews} for the floor and roof boards (30 a sheet)` });
  const cladNails = cladCutsAll.reduce((s, c) => s + c.n * (Math.ceil(c.len / 0.6) + 1) * 2, 0);
  B.add('fixings', 'nails50', kilosFor(cladNails, 400), { unit: 'kg', note: `about ${cladNails}: two a board at every stud` });
  B.add('fixings', 'clouts', kilosFor((roofArea / 10) * 500, 1000), { unit: 'kg', note: 'at 50 mm along every edge and lap of the felt' });
  B.add('fixings', 'sealant', Math.max(1, Math.ceil((walls.reduce((s, x) => s + x.openings.reduce((k, o) => k + 2 * (o.w + o.h), 0), 0) * 2) / 6)), { note: 'round the door and windows, inside and out' });
  B.add('finish', 'preserver', Math.max(1, Math.ceil((cladArea * 2) / 8 / 5)), { size: '5 litres', note: `two coats over ${cladArea.toFixed(0)} m² (about 8 m² a litre a coat)` });

  // 3-D
  const y0 = 0.05 + floorH;
  const boxes: Box[] = [];
  boxes.push({ id: 'base', group: 'base', label: 'Base (slabs)', x: 0, y: 0.025, z: 0, w: nx * 0.6, h: 0.05, d: nz * 0.6, color: COL.base, out: [0, -0.3, 0] });
  for (let i = 0; i < bearers; i++) boxes.push({ id: `bearer-${i}`, group: 'floor', label: 'Bearer', x: 0, y: 0.05 + 0.0235, z: -d / 2 + 0.05 + (i * (d - 0.1)) / Math.max(1, bearers - 1), w, h: 0.047, d: 0.1, color: COL.plate, out: [0, -0.15, 0] });
  boxes.push({ id: 'deck', group: 'floor', label: 'Floor (OSB)', x: 0, y: y0 - 0.009, z: 0, w, h: 0.018, d, color: COL.floor, out: [0, -0.1, 0] });
  walls.forEach((x, i) => boxes.push(...wallBoxes(x, framed[i]!, { w, d, y0, depth: 0.075, cladT: 0.012, group: 'frame', clad: 'cladding' })));
  // the roof: rafters, the deck and the felt on top
  const roofOut: [number, number, number] = [0, 1.4, 0];
  if (apex) {
    for (const side of [1, -1]) {
      const zc = (side * (d / 2 + over)) / 2;
      const yc = y0 + front + ((d / 2 - over) / 2) * Math.tan(pitch);
      boxes.push({ id: `roof-${side}`, group: 'roof', label: 'Roof', x: 0, y: yc + 0.06, z: zc, w: w + 2 * over, h: 0.03, d: rafterLen, color: COL.roof, out: roofOut, rx: side * pitch });
      for (let i = 0; i < rafters / 2; i++) boxes.push({ id: `rafter-${side}-${i}`, group: 'roof', label: 'Rafter', x: -w / 2 + (i * w) / Math.max(1, rafters / 2 - 1), y: yc, z: zc, w: 0.047, h: 0.1, d: rafterLen, color: COL.frame, out: [0, 0.9, 0], rx: side * pitch });
    }
  } else {
    const yc = y0 + (front + back) / 2 + 0.05;
    boxes.push({ id: 'roof-deck', group: 'roof', label: 'Roof', x: 0, y: yc + 0.065, z: 0, w: w + 2 * over, h: 0.03, d: rafterLen, color: COL.roof, out: roofOut, rx: -pitch });
    for (let i = 0; i < rafters; i++) boxes.push({ id: `rafter-${i}`, group: 'roof', label: 'Rafter', x: -w / 2 + (i * w) / Math.max(1, rafters - 1), y: yc, z: 0, w: 0.047, h: 0.1, d: rafterLen, color: COL.frame, out: [0, 0.9, 0], rx: -pitch });
  }

  // the plan
  const plan = floorPlan(w, d, 0.087, walls);
  plan.words = `The plan, from above: the floor ${m(w)} wide and ${m(d)} deep; the door, ${m(doorW)} wide, in the middle of the front${panes ? `; ${panes === 1 ? 'a window' : `${panes} windows`}, ${m(winW)} wide, in the ${['right-hand side', 'left-hand side', 'back'].slice(0, panes).join(', the ')}` : ''}.`;
  const roofPts: [number, number][] = apex ? [[-over, 0.05 + floorH + front], [w + over, 0.05 + floorH + front]] : [[-over, 0.05 + floorH + front + 0.05], [w + over, 0.05 + floorH + front + 0.05]];
  const fv = apex
    ? frontView(d, { hl: front + floorH, hr: front + floorH, roofPts: [[-over, 0.05 + floorH + front - over * Math.tan(pitch)], [d / 2, 0.05 + floorH + ridge], [d + over, 0.05 + floorH + front - over * Math.tan(pitch)]], base: 0.05, openings: walls[3]!.openings, title: 'SIDE (THE GABLE)', pitch: `${Math.round(deg(pitch))}° apex` })
    : frontView(w, { hl: front + floorH, hr: front + floorH, roofPts, base: 0.05, openings: walls[0]!.openings, title: 'FRONT', pitch: `pent roof ${deg(pitch).toFixed(1)}°` });
  fv.words = apex ? `The side: ${m(front + floorH + 0.05)} to the eaves, ${m(ridge + floorH + 0.05)} to the ridge, a ${Math.round(deg(pitch))} degree apex roof.` : `The front: ${m(front + floorH + 0.05)} high at the front and ${m(back + floorH + 0.05)} at the back, a pent roof falling ${deg(pitch).toFixed(1)} degrees to the back; the door ${m(doorH)} high.`;
  const side = apex ? null : frontView(d, { hl: back + floorH, hr: front + floorH, roofPts: [[-over, 0.05 + floorH + back - over * Math.tan(pitch)], [d + over, 0.05 + floorH + front + over * Math.tan(pitch)]], base: 0.05, openings: walls[3]!.openings.map((o) => ({ ...o, at: d - o.at })), title: 'SIDE', pitch: `${deg(pitch).toFixed(1)}° fall` });
  if (side) side.words = `The side: the roof falls from ${m(front + floorH + 0.05)} to ${m(back + floorH + 0.05)} over ${m(d)}.`;
  const height = ridge + floorH + 0.05;
  const hours = 8 + 4 + walls.reduce((s, x) => s + wallArea(x), 0) * 0.5 + roofArea * 0.6 + 3 + 2;
  return {
    params: p, kind: 'shed', title: `${KIND_NAMES.shed}, ${m(w)} × ${m(d)}`, concept: false,
    summary: `${m(w)} wide, ${m(d)} deep, ${apex ? `an apex roof (${Math.round(deg(pitch))}°) ${m(height)} to the ridge` : `a pent roof (${deg(pitch).toFixed(1)}°) ${m(height)} at the front`}, ${p.doors === 'double' ? 'double doors' : 'a door'}${panes ? ` and ${panes === 1 ? 'a window' : `${panes} windows`}` : ''}`,
    groups: [g('base', 'Base'), g('floor', 'Floor'), g('frame', 'Frame'), g('roof', 'Roof'), g('cladding', 'Cladding'), g('door', 'Door'), g('window', 'Windows'), g('fixings', 'Fixings'), g('finish', 'Finish')],
    lines: B.lines, boxes, views: [plan, fv, ...(side ? [side] : [])],
    steps: [
      'Mark out the base and dig out the turf; lay the slabs level on a sand and cement bed, 50 mm bigger than the floor all round. Leave it a day.',
      'Lay the bearers on the slabs, the floor joists across them at 400 mm centres, square it (the diagonals equal) and screw the OSB floor down.',
      'Build each wall flat on the floor: plates, studs at 600 mm centres, a stud each side of the door and window, the heads, a row of noggins.',
      'Stand the walls one at a time, plumb them with the level, screw the corners together and to the floor; cut the bottom plate out of the door way.',
      'Fix the rafters at 600 mm centres, the OSB roof boards on them, the felt from the bottom up with 75 mm laps, and the fascia and barge boards.',
      'Clad the walls from the bottom up, two nails a board at every stud; fit the window panes in their beads with sealant.',
      'Make the door from boards on three ledges and two braces (the braces rising away from the hinges), hang it on its T-hinges, fit the hasp.',
      'Two coats of wood treatment on everything outside, and seal round the door and windows.',
    ],
    tools: ['Tape measure, pencil and a builder’s square', 'Spirit level (1.2 m) and a string line', 'Mitre saw or a hand saw', 'Drill-driver with a 3 mm pilot bit', 'Hammer and a nail punch', 'Staple gun and a sharp knife (the felt)', 'Step ladder, two sawhorses', 'Safety glasses, gloves, ear defenders'],
    hours: Math.round(hours), safety: ['Two people to lift each wall and the roof boards: a wall is heavier than it looks.', 'Work off a steady step ladder on the slabs, never on the roof boards themselves.'],
    law: [LAW.height, LAW.regs], notes: [...p.notes, 'The base is needed and is in the bill: a shed must sit level, off the ground and dry.'], total: total(B.lines),
  };
}
const g = (id: string, name: string): Group => ({ id, name });

// ---------------------------------------------------------------- the garden room

function gardenroom(p: Params): Design {
  const { w, d } = p;
  const B = new Bill('gardenroom');
  const h = p.h;
  const wallH = r2(h - 0.35); // the floor (0.2 up on screws) and the roof's build-up come off the outside height
  const doorW = 1.5;
  const doorH = 2.1 > wallH - 0.1 ? r2(wallH - 0.1) : 2.1;
  const winW = 1.2;
  const winH = 1.0;
  const walls: WallDef[] = [
    { id: 'front', len: w, h0: wallH, h1: wallH, openings: [{ kind: 'door', at: w / 2, w: doorW, h: doorH, sill: 0 }] },
    { id: 'back', len: w, h0: wallH, h1: wallH, openings: p.windows > 1 ? [{ kind: 'window', at: w / 2, w: winW, h: winH, sill: 0.9 }] : [] },
    { id: 'left', len: d, h0: wallH, h1: wallH, openings: p.windows > 2 ? [{ kind: 'window', at: d / 2, w: winW, h: winH, sill: 0.9 }] : [] },
    { id: 'right', len: d, h0: wallH, h1: wallH, openings: p.windows > 0 ? [{ kind: 'window', at: d / 2, w: winW, h: winH, sill: 0.9 }] : [] },
  ];
  const framed = walls.map((x) => frameWall(x, 0.6));
  const studs = framed.reduce((s, f) => s + f.count, 0);
  B.timber('frame', 't47x100', framed.flatMap((f) => [...f.studs, ...f.plates, ...f.noggins, ...f.headers]), { size: '47 × 100 mm', material: 'C24 treated softwood', note: `${studs} studs at 600 mm centres` });
  // the floor on ground screws: joists, insulation between, a deck
  const screws = (Math.ceil(w / 1.2) + 1) * (Math.ceil(d / 1.5) + 1);
  B.add('base', 'groundscrew', screws, { note: `${screws} screws in a grid, levelled: no concrete` });
  const fj = Math.ceil(w / 0.4) + 1;
  B.timber('floor', 't47x150', [{ len: w, n: 2, label: 'rim' }, { len: r2(d), n: fj, label: 'joist' }], { size: '47 × 150 mm', material: 'C24 treated softwood', note: `${fj} joists at 400 mm centres on the screws` });
  const floorArea = w * d;
  // walls: net area, PIR between the studs; roof: over the deck (a warm roof); floor: between the joists
  const wallNet = r2(walls.reduce((s, x) => s + wallArea(x), 0));
  const roofArea = r2((w + 0.3) * (d + 0.3));
  const insWalls = sheetsFor(wallNet, 2.88, 0.1);
  const insRoof = sheetsFor(roofArea, 2.88, 0.05);
  const insFloor = sheetsFor(floorArea, 2.88, 0.1);
  B.add('insulation', 'pir75', insWalls, { size: '2400 × 1200 × 75 mm', material: 'PIR foam board', note: `${wallNet.toFixed(1)} m² of wall between the studs, 10% for cutting` });
  B.add('insulation', 'pir100', insRoof, { size: '2400 × 1200 × 100 mm', material: 'PIR foam board', note: `${roofArea.toFixed(1)} m² over the roof deck (a warm roof)` });
  B.add('insulation', 'pir50', insFloor, { size: '2400 × 1200 × 50 mm', material: 'PIR foam board', note: `${floorArea.toFixed(1)} m² between the floor joists` });
  B.add('floor', 'osb18', sheetsFor(floorArea), { size: '2440 × 1220 × 18 mm', material: 'OSB3 (tongue and groove)' });
  // the roof: joists, a deck, the vapour layer, PIR, a second deck, EPDM
  const rj = Math.ceil(w / 0.4) + 1;
  B.timber('roof', 't47x150', [{ len: r2(d + 0.3), n: rj, label: 'roof joist' }], { size: '47 × 150 mm', material: 'C24 treated softwood', note: `${rj} roof joists at 400 mm centres, a fall of 1 in 40 to the back` });
  B.add('roof', 'osb18', sheetsFor(roofArea), { size: '2440 × 1220 × 18 mm', material: 'OSB3', name: 'Roof deck (OSB3 18 mm)' });
  B.add('roof', 'vcl', Math.ceil(roofArea / 50), { size: '50 m²', material: 'polythene', note: 'on the deck, under the insulation' });
  B.add('roof', 'osb11', sheetsFor(roofArea), { size: '2440 × 1220 × 11 mm', material: 'OSB3', name: 'Top deck (OSB3 11 mm)' });
  B.add('roof', 'epdm', r2((w + 0.5) * (d + 0.5)), { unit: 'm²', size: `${m(w + 0.5)} × ${m(d + 0.5)}, one piece`, material: 'EPDM rubber' });
  B.timber('roof', 'fascia', [{ len: r2(w + 0.3), n: 2 }, { len: r2(d + 0.3), n: 2 }], { size: '22 × 100 mm', note: 'fascia all round' });
  // outside: membrane, battens, cladding; inside: plasterboard
  const cover = 0.11;
  B.add('cladding', 'membrane', Math.ceil(wallNet / 50), { size: '50 m²', note: 'on the frame outside, under the battens' });
  B.timber('cladding', 'batten', walls.map((x) => ({ len: r2(wallH), n: Math.ceil(x.len / 0.6) + 1 })), { size: '25 × 38 mm', name: 'Battens behind the cladding', note: 'upright over every stud: an air gap behind the boards' });
  const cladAll = walls.flatMap((x) => cladCuts(x, cover));
  B.timber('cladding', 'shiplap', cladAll, { size: '12 × 125 mm', material: 'treated shiplap', note: `${wallNet.toFixed(1)} m² of wall` });
  const ceiling = w * d;
  B.add('lining', 'plasterboard', sheetsFor(wallNet + ceiling, 2.88, 0.12), { size: '2400 × 1200 × 12.5 mm', note: `walls and ceiling, ${(wallNet + ceiling).toFixed(1)} m²; taped and filled, or skimmed` });
  B.add('door', 'doubledoor', 1, { size: '1.5 × 2.1 m', material: 'uPVC or aluminium, double glazed' });
  const wins = walls.reduce((s, x) => s + x.openings.filter((o) => o.kind === 'window').length, 0);
  if (wins) B.add('window', 'window', wins, { size: '1.2 × 1.0 m', material: 'uPVC, double glazed' });
  B.add('electrics', 'electrician', 1, { note: 'a new circuit is notifiable (Part P): a registered electrician, a first estimate for a run of up to 15 m' });
  if (p.desk) addDesk(B, 1.4, 0.7, 'desk');
  const frameScrews = studs * 4 + fj * 4 + rj * 4;
  B.add('fixings', 'screws70', boxesFor(frameScrews), { note: `${frameScrews} for the frame and joists (four a joint)` });
  B.add('fixings', 'screws40', boxesFor((sheetsFor(floorArea) + sheetsFor(roofArea) * 2) * 30 + sheetsFor(wallNet + ceiling, 2.88, 0.12) * 35), { note: '30 a sheet for the decks, 35 a sheet for the plasterboard' });
  B.add('fixings', 'nails50', kilosFor(cladAll.reduce((s, c) => s + (Math.ceil(c.len / 0.6) + 1) * 2, 0), 400), { unit: 'kg', note: 'two a board at every batten' });
  B.add('fixings', 'sealant', Math.max(2, Math.ceil((walls.reduce((s, x) => s + x.openings.reduce((k, o) => k + 2 * (o.w + o.h), 0), 0) * 2) / 6)), { note: 'round the doors and windows, inside and out' });
  B.add('finish', 'preserver', Math.max(1, Math.ceil((wallNet * 2) / 8 / 5)), { size: '5 litres', note: 'two coats outside' });
  B.add('finish', 'emulsion', Math.max(1, Math.ceil(((wallNet + ceiling) * 2) / 12 / 5)), { size: '5 litres', note: 'two coats inside (about 12 m² a litre)' });

  const y0 = 0.2 + 0.15 + 0.018;
  const boxes: Box[] = [];
  for (let i = 0; i <= Math.ceil(w / 1.2); i++) for (let k = 0; k <= Math.ceil(d / 1.5); k++) boxes.push({ id: `screw-${i}-${k}`, group: 'base', label: 'Ground screw', x: -w / 2 + (i * w) / Math.ceil(w / 1.2), y: 0.1, z: -d / 2 + (k * d) / Math.ceil(d / 1.5), w: 0.07, h: 0.2, d: 0.07, color: COL.steel, out: [0, -0.4, 0] });
  boxes.push({ id: 'floor', group: 'floor', label: 'Floor', x: 0, y: 0.2 + 0.075, z: 0, w, h: 0.15, d, color: COL.floor, out: [0, -0.25, 0] });
  walls.forEach((x, i) => boxes.push(...wallBoxes(x, framed[i]!, { w, d, y0, depth: 0.1, cladT: 0.04, group: 'frame', clad: 'cladding', colour: 0x4a4f55 })));
  boxes.push({ id: 'ins-roof', group: 'insulation', label: 'Insulation', x: 0, y: y0 + wallH + 0.2, z: 0, w: w + 0.3, h: 0.1, d: d + 0.3, color: COL.ins, out: [0, 1.0, 0] });
  boxes.push({ id: 'roof', group: 'roof', label: 'Roof', x: 0, y: y0 + wallH + 0.28, z: 0, w: w + 0.3, h: 0.05, d: d + 0.3, color: COL.roof, out: [0, 1.6, 0] });
  if (p.desk) boxes.push({ id: 'desk', group: 'desk', label: 'Desk', x: 0, y: y0 + 0.73, z: -d / 2 + 0.45, w: 1.4, h: 0.03, d: 0.7, color: COL.board, out: [0, 0, 0] });

  const plan = floorPlan(w, d, 0.15, walls, 'PLAN', p.desk ? [{ t: 'rect', x: -0.7, y: -d / 2 + 0.85, w: 1.4, h: 0.7, k: 'part', label: 'desk' }] : []);
  plan.words = `The plan: ${m(w)} wide and ${m(d)} deep outside, double doors ${m(doorW)} wide in the front${wins ? `, ${wins === 1 ? 'a window' : `${wins} windows`} ${m(winW)} wide` : ''}${p.desk ? ', a desk against the back wall' : ''}.`;
  const fv = frontView(w, { hl: h - 0.05, hr: h - 0.05, roofPts: [[-0.15, h], [w + 0.15, h]], base: 0, openings: walls[0]!.openings.map((o) => ({ ...o, sill: o.sill + 0.37 })), title: 'FRONT' });
  fv.words = `The front: ${m(h)} high overall (under 2.5 m, for a garden room near a boundary), a flat roof with a fall of 1 in 40 to the back.`;
  const hours = 6 + floorArea * 1.2 + wallNet * 0.9 + roofArea * 1.0 + 10 + (wallNet + ceiling) * 0.4;
  return {
    params: p, kind: 'gardenroom', title: `${KIND_NAMES.gardenroom}, ${m(w)} × ${m(d)}`, concept: false,
    summary: `${m(w)} × ${m(d)} outside, ${m(h)} high, insulated walls, floor and a warm flat roof, double doors${wins ? ` and ${wins === 1 ? 'a window' : `${wins} windows`}` : ''}, the electrics by a registered electrician${p.desk ? ', a desk' : ''}`,
    groups: [g('base', 'Base'), g('floor', 'Floor'), g('frame', 'Frame'), g('insulation', 'Insulation'), g('roof', 'Roof'), g('cladding', 'Cladding'), g('lining', 'Inside walls'), g('door', 'Doors'), g('window', 'Windows'), g('electrics', 'Electrics'), ...(p.desk ? [g('desk', 'Desk')] : []), g('fixings', 'Fixings'), g('finish', 'Finish')],
    lines: B.lines, boxes, views: [plan, fv],
    steps: [
      'Set out the footprint; the ground screws go in on a grid and are levelled (a ground-screw firm does this in a morning).',
      'Floor: the rim and joists at 400 mm centres on the screws, PIR between the joists, the OSB deck glued and screwed.',
      'Walls flat on the deck: plates, studs at 600 mm centres, the door and window openings sized to the frames you have bought.',
      'Stand and fix the walls; the breather membrane outside, the battens over each stud.',
      'Roof: joists with a fall of 1 in 40, the OSB deck, the vapour layer, the PIR, the top deck, the EPDM in one piece, the fascia.',
      'Fit the doors and windows into their openings on packers, level and square, and seal them.',
      'The electrician runs the first fix now, before anything is lined.',
      'PIR between the wall studs, foil tape on the joints; plasterboard on the walls and ceiling; tape and fill, or a skim.',
      'The cladding on the battens, two coats of treatment outside; paint inside; the electrician comes back for the second fix.',
    ],
    tools: ['Tape measure, builder’s square, string line', 'Spirit level (1.8 m) and a laser level if you can borrow one', 'Mitre saw and a circular saw', 'Drill-driver and an impact driver', 'Insulation saw or a long knife', 'Plasterboard saw, taping knives', 'Step ladders, a scaffold tower for the roof', 'Safety glasses, gloves, ear defenders, a dust mask'],
    hours: Math.round(hours), safety: ['Two people for the walls, the roof boards and the doors (a double door frame is very heavy).', 'Never stand on the roof deck between joists; a scaffold tower, not a ladder, for the roof.', 'PIR dust: cut it outside with a mask on.'],
    law: [LAW.height, LAW.use, LAW.regs, LAW.partP], notes: [...p.notes, 'The doors and windows are bought units: make the openings to the frames you buy, not to these sizes.'], total: total(B.lines),
  };
}

/** A desk's lines (in a garden room, or on its own). */
function addDesk(B: Bill, w: number, d: number, group: string): void {
  B.add(group, 'ply18', 1, { size: `top ${mm(w)} × ${mm(d)} from one sheet`, material: 'birch plywood', name: 'Desk top (birch plywood 18 mm)' });
  B.timber(group, 'pse44', [{ len: 0.71, n: 4, label: 'leg' }, { len: r2(w - 0.1), n: 2, label: 'rail' }, { len: r2(d - 0.1), n: 2, label: 'rail' }], { size: '44 × 44 mm', material: 'planed pine', name: 'Desk legs and rails' });
}

// ---------------------------------------------------------------- the garage

function garage(p: Params): Design {
  const { w, d } = p;
  const B = new Bill('garage');
  const block = p.walls === 'block';
  const h = p.h;
  const back = r2(h - 0.2);
  const doorW = 2.13;
  const doorH = 1.98;
  const t = block ? 0.1 : 0.112;
  const walls: WallDef[] = [
    { id: 'front', len: w, h0: h, h1: h, openings: [{ kind: 'door', at: w / 2, w: doorW, h: doorH, sill: 0 }] },
    { id: 'back', len: w, h0: back, h1: back, openings: [] },
    { id: 'left', len: d, h0: back, h1: h, openings: [] },
    { id: 'right', len: d, h0: h, h1: back, openings: p.windows > 0 ? [{ kind: 'window', at: d / 2, w: 1.2, h: 1.0, sill: 1.0 }] : [] },
  ];
  const area = r2(walls.reduce((s, x) => s + wallArea(x), 0));
  // the slab: 100 mm of concrete on 150 mm of hardcore, mesh, a membrane, 300 mm wider than the walls all round
  const sw = w + 0.6;
  const sd = d + 0.6;
  B.add('slab', 'hardcore', r2(Math.ceil(sw * sd * 0.15 * 2.1 * 2) / 2), { unit: 'tonnes', size: '150 mm deep, compacted', note: `${(sw * sd).toFixed(1)} m²` });
  B.add('slab', 'dpm', 1, { size: '4 × 25 m', material: 'polythene', note: 'under the concrete, lapped 300 mm' });
  B.add('slab', 'mesh', Math.ceil((sw * sd * 1.1) / 11.52), { size: '4.8 × 2.4 m', material: 'A142 steel mesh', note: 'on spacers, 40 mm up' });
  B.add('slab', 'concrete', r2(Math.ceil(sw * sd * 0.1 * 1.05 * 4) / 4), { unit: 'm³', size: '100 mm deep', material: 'C25 concrete', note: 'ordered to the quarter cubic metre, 5% over' });
  let blocks = 0;
  if (block) {
    blocks = Math.ceil(area * 10 * 1.05) + Math.ceil(((2 * (w + d)) / 3) * h * 5);
    B.add('walls', 'block', blocks, { size: '440 × 215 × 100 mm', material: 'dense concrete (7 N)', note: `${area.toFixed(1)} m² at 10 blocks a m², 5% over, and piers at the corners and every 3 m` });
    B.add('walls', 'mortar', Math.ceil(blocks / 20), { size: '25 kg', note: 'about a bag for every 20 blocks' });
    B.add('walls', 'dpc', Math.ceil((2 * (w + d)) / 30), { size: '100 mm × 30 m', note: 'one course above the ground' });
    B.add('walls', 'lintel', 1, { size: '2.7 m', material: 'galvanised steel', note: 'over the garage door' });
    B.timber('walls', 't47x100', [{ len: r2(w), n: 2 }, { len: r2(d), n: 2 }], { size: '47 × 100 mm', name: 'Wall plates (bedded on the blockwork)' });
  } else {
    const framed = walls.map((x) => frameWall(x, 0.6));
    B.timber('walls', 't47x100', framed.flatMap((f) => [...f.studs, ...f.plates, ...f.noggins, ...f.headers]), { size: '47 × 100 mm', note: `${framed.reduce((s, f) => s + f.count, 0)} studs at 600 mm centres` });
    B.add('walls', 'osb11', sheetsFor(area), { size: '2440 × 1220 × 11 mm', name: 'Sheathing (OSB3 11 mm)' });
    B.timber('walls', 'shiplap', walls.flatMap((x) => cladCuts(x, 0.11)), { size: '12 × 125 mm', material: 'treated shiplap' });
  }
  // the roof: joists across the width, falling to the back; OSB; EPDM
  const rj = Math.ceil(d / 0.4) + 1;
  const roofArea = r2((w + 0.3) * (d + 0.3));
  B.timber('roof', 't47x150', [{ len: r2(w + 0.3), n: rj, label: 'roof joist' }], { size: '47 × 150 mm', note: `${rj} roof joists at 400 mm centres` });
  B.add('roof', 'osb18', sheetsFor(roofArea), { size: '2440 × 1220 × 18 mm', material: 'OSB3' });
  B.add('roof', 'epdm', r2((w + 0.5) * (d + 0.5)), { unit: 'm²', size: 'one piece', material: 'EPDM rubber' });
  B.timber('roof', 'fascia', [{ len: r2(w + 0.3), n: 2 }, { len: r2(d + 0.3), n: 2 }], { size: '22 × 100 mm' });
  B.add('door', 'garagedoor', 1, { size: '2.13 × 1.98 m', material: 'steel, with its frame and gear' });
  if (p.windows > 0) B.add('window', 'window', 1, { size: '1.2 × 1.0 m' });
  B.add('fixings', 'screws70', boxesFor(rj * 4 + 40), { note: 'the joists to the wall plates (four a joint), the plates down' });
  B.add('fixings', 'screws40', boxesFor(sheetsFor(roofArea) * 30), { note: '30 a sheet for the roof deck' });
  B.add('fixings', 'sealant', 2, { note: 'round the door frame' });

  const boxes: Box[] = [];
  boxes.push({ id: 'slab', group: 'slab', label: 'Slab', x: 0, y: 0.05, z: 0, w: sw, h: 0.1, d: sd, color: COL.slab, out: [0, -0.5, 0] });
  const y0 = 0.1;
  for (const def of walls) {
    if (!block) {
      boxes.push(...wallBoxes(def, frameWall(def, 0.6), { w, d, y0, depth: 0.1, cladT: 0.012, group: 'walls', clad: 'walls' }));
      continue;
    }
    const f = wallFrame(def.id, w, d);
    const rotY = def.id === 'left' || def.id === 'right' ? Math.PI / 2 : 0;
    const at = (s: number) => ({ x: f.sx + f.ux * s - f.nx * (t / 2), z: f.sz + f.uz * s - f.nz * (t / 2) });
    const low = Math.min(def.h0, def.h1);
    const segs: [number, number, number, number][] = [];
    let s = 0;
    for (const o of def.openings) {
      segs.push([s, o.at - o.w / 2, 0, low], [o.at - o.w / 2, o.at + o.w / 2, o.sill + o.h, low]);
      if (o.sill > 0.05) segs.push([o.at - o.w / 2, o.at + o.w / 2, 0, o.sill]);
      s = o.at + o.w / 2;
    }
    segs.push([s, def.len, 0, low]);
    segs.forEach(([a, b, c, e], i) => {
      if (b - a < 0.02 || e - c < 0.02) return;
      const mid = at((a + b) / 2);
      boxes.push({ id: `${def.id}-blocks-${i}`, group: 'walls', label: 'Blockwork', x: mid.x, y: y0 + (c + e) / 2, z: mid.z, w: b - a, h: e - c, d: t, color: COL.block, out: [f.nx * 1.2, 0, f.nz * 1.2], ry: rotY });
    });
    for (const o of def.openings) {
      const c = at(o.at);
      boxes.push(o.kind === 'door' ? { id: 'garagedoor', group: 'door', label: 'Garage door', x: c.x, y: y0 + o.h / 2, z: c.z + f.nz * 0.06, w: o.w, h: o.h, d: 0.04, color: COL.white, out: [0, 0, 1.6] } : { id: `win-${def.id}`, group: 'window', label: 'Window', x: c.x, y: y0 + o.sill + o.h / 2, z: c.z, w: o.w, h: o.h, d: 0.03, color: COL.glass, out: [f.nx * 1.4, 0, f.nz * 1.4], ry: rotY, glass: true });
    }
  }
  const pitch = Math.atan2(h - back, d);
  boxes.push({ id: 'roof', group: 'roof', label: 'Roof', x: 0, y: y0 + (h + back) / 2 + 0.12, z: 0, w: w + 0.3, h: 0.17, d: Math.hypot(d + 0.3, h - back), color: COL.roof, out: [0, 1.6, 0], rx: -pitch });

  const plan = floorPlan(w, d, t, walls);
  plan.words = `The plan: ${m(w)} wide and ${m(d)} deep, ${block ? '100 mm blockwork' : 'a timber frame'}, the up-and-over door ${m(doorW)} wide in the front${p.windows ? ', a window in the right-hand side' : ''}.`;
  const fv = frontView(w, { hl: h + 0.1, hr: h + 0.1, roofPts: [[-0.15, h + 0.27], [w + 0.15, h + 0.27]], base: 0.1, openings: walls[0]!.openings, title: 'FRONT', pitch: `roof falls ${Math.round(((h - back) / d) * 1000) / 10}% to the back` });
  fv.words = `The front: ${m(h + 0.1)} high, the garage door ${m(doorW)} wide and ${m(doorH)} high under a steel lintel.`;
  const hours = 16 + (block ? area * 0.8 : area * 0.6) + roofArea * 0.8 + 6;
  return {
    params: p, kind: 'garage', title: `${KIND_NAMES.garage}, ${m(w)} × ${m(d)}`, concept: false,
    summary: `${m(w)} × ${m(d)}, ${m(h)} at the front, ${block ? 'block walls' : 'a timber frame'}, an up-and-over door, a concrete slab, a flat roof falling to the back`,
    groups: [g('slab', 'Slab'), g('walls', 'Walls'), g('roof', 'Roof'), g('door', 'Door'), ...(p.windows ? [g('window', 'Window')] : []), g('fixings', 'Fixings')],
    lines: B.lines, boxes, views: [plan, fv],
    steps: [
      'Set out the slab with pegs and string, 300 mm bigger than the walls all round; dig out to firm ground.',
      'Lay the hardcore in layers, each compacted with a plate compactor (hire one); the membrane on top, lapped.',
      'The mesh on spacers, the edge boards level; the concrete poured, tamped and left to cure for a week (wet it in hot weather).',
      block ? 'The blockwork, corners first then a string line between them, a course of DPC near the ground, piers at the corners and every 3 m; the steel lintel over the door way.' : 'The timber walls built flat, stood up and fixed down to the slab with frame fixings, the sheathing and the cladding.',
      'Wall plates bedded on top, the roof joists falling to the back, the OSB deck, the EPDM in one piece, the fascia.',
      'The up-and-over door fitted to its frame as its maker’s instructions say (its springs are under tension: follow them exactly).',
    ],
    tools: ['Pegs, string line, tape, builder’s square', 'Spade, wheelbarrow, a plate compactor (hired)', 'Tamping board and a float', ...(block ? ['Brick trowel, pointing trowel, spirit levels, a line and pins', 'Mixer (hired) or a delivery of ready-mixed mortar'] : ['Mitre saw, circular saw, drill-driver']), 'Scaffold tower for the roof', 'Safety boots, gloves, glasses'],
    hours: Math.round(hours), safety: ['Concrete burns skin: gloves, long sleeves and boots, wash it off at once.', 'The garage door’s springs can injure: fit it exactly as its maker says, or have it fitted.', 'A scaffold tower for the roof, never a ladder on its own.'],
    law: [LAW.height, LAW.regs], notes: [...p.notes, 'A 100 mm slab on 150 mm of hardcore is a rule of thumb for a car on firm ground: soft or clay ground changes it. Ask building control or a groundworker.'], total: total(B.lines),
  };
}

// ---------------------------------------------------------------- a room

/** The heat a room needs, a plain rule of thumb: about 50 watts a cubic metre for a bedroom, 60 for a living room. */
export function heatNeed(w: number, d: number, h: number, room: string): { watts: number; btu: number; perM3: number } {
  const perM3 = /\b(?:living|lounge|sitting|dining|bath|kitchen)/i.test(room) ? 60 : 50;
  const watts = Math.round((w * d * h * perM3) / 10) * 10;
  return { watts, btu: Math.round((watts * 3.412) / 10) * 10, perM3 };
}
/** A type 22 radiator 600 mm high gives about 1,800 W a metre (at a 50° difference): the length to the next 100 mm. */
export const radiatorLength = (watts: number) => Math.min(2, Math.max(0.4, Math.ceil(watts / 1800 / 0.1 - 1e-9) / 10));

function room(p: Params): Design {
  const { w, d, h } = p;
  const B = new Bill('room');
  const name = p.room || 'room';
  const doorW = 0.76;
  const winW = 1.2;
  const walls: WallDef[] = [
    { id: 'front', len: w, h0: h, h1: h, openings: [{ kind: 'door', at: 0.15 + doorW / 2, w: doorW, h: 1.98, sill: 0 }] },
    { id: 'back', len: w, h0: h, h1: h, openings: p.windows > 0 ? [{ kind: 'window', at: w / 2, w: winW, h: 1.2, sill: 0.9 }] : [] },
    { id: 'left', len: d, h0: h, h1: h, openings: [] },
    { id: 'right', len: d, h0: h, h1: h, openings: p.windows > 1 ? [{ kind: 'window', at: d / 2, w: 1.0, h: 1.2, sill: 0.9 }] : [] },
  ];
  const floorArea = r2(w * d);
  const wallNet = r2(walls.reduce((s, x) => s + wallArea(x), 0));
  const wardrobeD = 0.6;
  const wardW = p.wardrobe ? d : 0;
  // the floor
  B.add('flooring', p.floor === 'laminate' ? 'laminate' : 'carpet', r2(Math.ceil(floorArea * 1.1 * 10) / 10), { unit: 'm²', size: `${floorArea.toFixed(1)} m² and 10% for cutting`, material: p.floor });
  B.timber('flooring', 'skirting', walls.flatMap((x) => {
    const gaps = x.openings.filter((o) => o.kind === 'door');
    return gaps.length ? [{ len: r2(gaps[0]!.at - gaps[0]!.w / 2), n: 1 }, { len: r2(x.len - gaps[0]!.at - gaps[0]!.w / 2), n: 1 }] : [{ len: r2(x.len - (x.id === 'left' && p.wardrobe ? x.len : 0)), n: 1 }];
  }), { size: '119 mm', material: 'primed MDF', note: 'round the room, cut at the door' });
  // the walls and ceiling
  const wallPaint = Math.max(1, Math.ceil((wallNet * 2) / 12 / 5));
  B.add('walls', 'emulsion', wallPaint, { size: '5 litres', note: `two coats over ${wallNet.toFixed(1)} m² (about 12 m² a litre)` });
  B.add('ceiling', 'emulsion', Math.max(1, Math.ceil((floorArea * 2) / 12 / 5)), { size: '5 litres', name: 'Ceiling paint (white emulsion)', note: `two coats over ${floorArea.toFixed(1)} m²` });
  // the heat
  const need = heatNeed(w, d, h, name);
  let heatWords = '';
  if (p.heat === 'underfloor') {
    const matArea = r2(Math.floor((floorArea - wardW * wardrobeD) * 0.8 * 2) / 2);
    B.add('heating', 'ufhmat', matArea, { unit: 'm²', size: `${matArea} m² of mat, ${Math.round(matArea * 150)} W`, material: 'electric mat with its thermostat', note: 'about 80% of the free floor: never under the wardrobe or the bed' });
    B.add('heating', 'electrician', 1, { name: 'A registered electrician: the mat’s circuit and its thermostat', rate: 350, note: 'a new circuit is notifiable (Part P): a first estimate' });
    heatWords = `This ${name} needs about ${need.watts} W (${need.perM3} W a cubic metre, a rule of thumb). ${matArea} m² of 150 W mat gives ${Math.round(matArea * 150)} W.`;
  } else if (p.heat === 'radiator') {
    const len = radiatorLength(need.watts);
    B.add('heating', 'radiator', 1, { size: `600 × ${Math.round(len * 1000)} mm, about ${Math.round(len * 1800)} W`, rate: radiatorPrice(len), note: 'under the window; a plumber fits it to the system' });
    heatWords = `This ${name} needs about ${need.watts} W (${need.btu.toLocaleString('en-GB')} BTU): ${need.perM3} W a cubic metre, a rule of thumb. A type 22 radiator 600 mm high and ${Math.round(len * 1000)} mm long gives about ${Math.round(len * 1800)} W.`;
  }
  // the wardrobe wall: carcass boards, sliding doors, rails
  if (p.wardrobe) {
    const bays = Math.max(1, Math.round(wardW / 1.0));
    const bayW = wardW / bays;
    const ch = r2(h - 0.05);
    const panels = r2((bays + 1) * wardrobeD * ch + 2 * wardW * wardrobeD + bays * bayW * wardrobeD);
    B.add('wardrobe', 'mfc18', sheetsFor(panels, 2.977, 0.2), { size: '2440 × 1220 × 18 mm', material: 'white melamine-faced chipboard', note: `${bays + 1} sides ${mm(ch)} × ${mm(wardrobeD)}, a top and a bottom, ${bays} shelves; ${panels.toFixed(1)} m² and 20% for cutting` });
    B.add('wardrobe', 'hardboard', sheetsFor(wardW * ch, 2.977, 0.1), { size: '2440 × 1220 × 3 mm', name: 'Backs (hardboard 3 mm)' });
    B.add('wardrobe', 'slider', Math.ceil(wardW / 0.9), { size: `${mm(Math.min(0.9, wardW))} × ${mm(ch)}` });
    B.add('wardrobe', 'rail', bays, { size: `${mm(bayW - 0.02)}` });
    B.add('wardrobe', 'screws40', boxesFor((bays + 1) * 16 + bays * 4), { name: 'Wood screws 4.0 × 40 mm (the carcass), box of 200' });
    B.add('wardrobe', 'bracket', bays + 1, { name: 'Wall brackets for the carcass' });
  }
  const boxes: Box[] = [];
  boxes.push({ id: 'floor', group: 'flooring', label: 'Floor', x: 0, y: -0.02, z: 0, w, h: 0.04, d, color: p.floor === 'laminate' ? 0xb08350 : 0x8c8f99, out: [0, -0.4, 0] });
  for (const def of walls) {
    const f = wallFrame(def.id, w, d);
    const rotY = def.id === 'left' || def.id === 'right' ? Math.PI / 2 : 0;
    const t = 0.1;
    const at = (s: number) => ({ x: f.sx + f.ux * s + f.nx * (t / 2), z: f.sz + f.uz * s + f.nz * (t / 2) });
    const segs: [number, number, number, number][] = [];
    let s = 0;
    for (const o of def.openings) {
      segs.push([s, o.at - o.w / 2, 0, h], [o.at - o.w / 2, o.at + o.w / 2, o.sill + o.h, h]);
      if (o.sill > 0.05) segs.push([o.at - o.w / 2, o.at + o.w / 2, 0, o.sill]);
      s = o.at + o.w / 2;
    }
    segs.push([s, def.len, 0, h]);
    segs.forEach(([a, b, c, e], i) => {
      if (b - a < 0.02 || e - c < 0.02) return;
      const mid = at((a + b) / 2);
      boxes.push({ id: `${def.id}-wall-${i}`, group: 'walls', label: 'Wall', x: mid.x, y: (c + e) / 2, z: mid.z, w: b - a, h: e - c, d: t, color: 0xe8e4dc, out: [f.nx * 1.0, 0, f.nz * 1.0], ry: rotY });
    });
    for (const o of def.openings) {
      const c = at(o.at);
      if (o.kind === 'window') boxes.push({ id: `${def.id}-glass`, group: 'walls', label: 'Window', x: c.x, y: o.sill + o.h / 2, z: c.z, w: o.w, h: o.h, d: 0.02, color: COL.glass, out: [f.nx * 1.0, 0, f.nz * 1.0], ry: rotY, glass: true });
    }
  }
  boxes.push({ id: 'ceiling', group: 'ceiling', label: 'Ceiling', x: 0, y: h + 0.02, z: 0, w: w + 0.2, h: 0.04, d: d + 0.2, color: 0xf4f2ee, out: [0, 1.2, 0] });
  if (p.heat === 'radiator') {
    const len = radiatorLength(need.watts);
    boxes.push({ id: 'radiator', group: 'heating', label: 'Radiator', x: 0, y: 0.45, z: -d / 2 + 0.08, w: len, h: 0.6, d: 0.1, color: 0xffffff, out: [0, 0, 0.4] });
  } else if (p.heat === 'underfloor') boxes.push({ id: 'mat', group: 'heating', label: 'Underfloor heating mat', x: 0.3, y: 0.003, z: 0.1, w: w * 0.7, h: 0.004, d: d * 0.6, color: 0xff7a45, out: [0, -0.2, 0] });
  if (p.wardrobe) boxes.push({ id: 'wardrobe', group: 'wardrobe', label: 'Wardrobe', x: -w / 2 + wardrobeD / 2, y: (h - 0.05) / 2, z: 0, w: wardrobeD, h: h - 0.05, d: wardW, color: 0xf7f7f4, out: [0.8, 0, 0] });
  if (/bed/i.test(name)) boxes.push({ id: 'bed', group: 'furniture', label: 'A double bed, for scale', x: w / 2 - 1.0, y: 0.25, z: -d / 2 + 1.05, w: 1.4, h: 0.5, d: 1.95, color: 0x6f86a8, out: [0, 0, 0] });
  const extra: Item2D[] = [];
  if (p.wardrobe) extra.push({ t: 'rect', x: -w / 2, y: d / 2, w: wardrobeD, h: wardW, k: 'part', label: 'wardrobe' });
  if (p.heat === 'radiator') extra.push({ t: 'rect', x: -radiatorLength(need.watts) / 2, y: -d / 2 + 0.13, w: radiatorLength(need.watts), h: 0.1, k: 'part', label: 'radiator' });
  if (/bed/i.test(name)) extra.push({ t: 'rect', x: w / 2 - 1.7, y: -d / 2 + 2.03, w: 1.4, h: 1.95, k: 'part', label: 'bed' });
  // (the room's walls are drawn inward from its inside sizes)
  const plan = floorPlan(w, d, -0.1, walls, 'PLAN', extra);
  plan.words = `The plan: the ${name} ${m(w)} by ${m(d)} inside, ${m(h)} to the ceiling; the door, ${m(doorW)} wide, at the front left${p.windows ? '; the window in the back wall' : ''}${p.wardrobe ? `; a fitted wardrobe along the left wall, ${m(wardW)} long and 0.6 m deep` : ''}${p.heat === 'radiator' ? '; the radiator under the window' : p.heat === 'underfloor' ? '; underfloor heating under the free floor' : ''}.`;
  const hours = 3 + wallNet * 0.35 + floorArea * 0.3 + (p.wardrobe ? 10 : 0) + 3;
  return {
    params: p, kind: 'room', title: `${cap(name)}, ${m(w)} × ${m(d)}`, concept: false,
    summary: `${m(w)} × ${m(d)}, ${m(h)} to the ceiling, ${p.floor}, ${p.heat === 'radiator' ? 'a radiator' : p.heat === 'underfloor' ? 'electric underfloor heating' : 'no heating'}${p.wardrobe ? ', a fitted wardrobe wall' : ''}`,
    groups: [g('walls', 'Walls'), g('ceiling', 'Ceiling'), g('flooring', 'Floor'), ...(p.heat !== 'none' ? [g('heating', 'Heating')] : []), ...(p.wardrobe ? [g('wardrobe', 'Wardrobe')] : [])],
    lines: B.lines, boxes, views: [plan], heat: heatWords || undefined,
    steps: [
      'Empty the room; fill and sand the walls, wipe them down.',
      'The ceiling first: two coats. Then the walls: a mist coat on new plaster, then two coats.',
      p.heat === 'underfloor' ? 'The underfloor mat on the subfloor with its sensor, tested with a meter before and after; the electrician connects it.' : 'The radiator: a plumber drains down, fits the valves and the radiator, fills and bleeds it.',
      ...(p.wardrobe ? ['The wardrobe: the carcass bays screwed together on the floor, stood, fixed to the wall at the top, the rails and shelves in, the sliding doors on their track last.'] : []),
      'The skirting, mitred at the corners; one coat of gloss or satin on it.',
      `The ${p.floor === 'laminate' ? 'laminate, clicked together over its underlay with a 10 mm gap at the walls' : 'carpet, fitted by the shop (it is in the price)'}.`,
    ],
    tools: ['Filler, sanding block, dust sheets, masking tape', 'Roller, tray, a 50 mm brush, an extension pole', 'Mitre saw (the skirting)', ...(p.wardrobe ? ['Drill-driver, a level, a stud finder'] : []), ...(p.floor === 'laminate' ? ['Laminate kit: spacers, a pull bar, a tapping block'] : [])],
    hours: Math.round(hours), safety: ['Find the cables and pipes before you drill a wall: a detector, and never straight above or beside a socket or switch.', 'Ventilate while painting; a step ladder, never a chair.'],
    law: p.heat === 'underfloor' ? [LAW.partP, LAW.wall] : [LAW.gas, LAW.wall], notes: p.notes, total: total(B.lines),
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- furniture: the beam formula

/** Stiffness of a board (GPa) and the price row it is bought from. */
const BOARDS = {
  pine: { E: 9, price: 'pine18' as PriceId, name: 'pine', t: 0.018 },
  mdf: { E: 3.5, price: 'mdf18' as PriceId, name: 'MDF', t: 0.018 },
  oak: { E: 11, price: 'oak27' as PriceId, name: 'oak', t: 0.027 },
  ply: { E: 8, price: 'ply18' as PriceId, name: 'birch plywood', t: 0.018 },
};

/** A board's even load before it bends more than 1/`limit` of its span (kg), simply supported: w = δ·384EI / 5L⁴. */
export function evenLoadKg(span: number, width: number, thick: number, gpa: number, limit = 360): number {
  const I = (width * thick ** 3) / 12;
  const w = ((span / limit) * 384 * gpa * 1e9 * I) / (5 * span ** 4);
  return Math.round((w * span) / 9.81);
}
/** A board's load in the middle before it bends 1/`limit` of its span (kg): P = δ·48EI / L³. */
export function pointLoadKg(span: number, width: number, thick: number, gpa: number, limit = 300): number {
  const I = (width * thick ** 3) / 12;
  return Math.round((((span / limit) * 48 * gpa * 1e9 * I) / span ** 3) / 9.81);
}

function shelf(p: Params): Design {
  const { w, d, h } = p;
  const B = new Bill('shelf');
  const b = BOARDS[p.material];
  const t = b.t;
  const uprights = Math.ceil(w / 0.8 - 1e-9) + 1;
  const spans = uprights - 1;
  const span = r2((w - uprights * t) / spans);
  const levels = Math.max(2, Math.round(h / 0.35) + 1);
  const gap = (h - 0.07 - levels * t) / (levels - 1);
  const area = r2(uprights * h * d + levels * spans * span * d + w * 0.07);
  if (b.price === 'pine18' || b.price === 'oak27') B.add('boards', b.price, r2(Math.ceil(area * 1.15 * 10) / 10), { unit: 'm²', size: `${uprights} sides ${mm(h)} × ${mm(d)}, ${levels * spans} shelves ${mm(span)} × ${mm(d)}, a plinth`, material: b.name, note: `${area.toFixed(2)} m² and 15% for cutting` });
  else B.add('boards', b.price, sheetsFor(area, 2.977, 0.15), { size: `${uprights} sides ${mm(h)} × ${mm(d)}, ${levels * spans} shelves ${mm(span)} × ${mm(d)}, a plinth`, material: b.name, note: `${area.toFixed(2)} m² and 15% for cutting` });
  B.add('boards', 'hardboard', sheetsFor(w * h, 2.977, 0.05), { size: `${mm(w)} × ${mm(h)}`, name: 'Back (hardboard 3 mm)', note: 'pinned on square: it keeps the case from racking' });
  const screws = levels * spans * 4 + uprights * 4;
  B.add('fixings', 'screws50', boxesFor(screws), { note: `${screws}: two each end of every shelf, the plinth` });
  B.add('fixings', 'bracket', Math.max(2, spans), { note: 'into the wall at the top: a tall case must never tip' });
  B.add('finish', 'varnish', Math.max(1, Math.ceil((area * 2 * 2) / 12)), { size: '750 ml', note: 'two coats' });
  const kg = evenLoadKg(span, d, t, b.E);
  const load = `Each shelf takes about ${kg} kg spread evenly before it bends more than 1/360 of its span (${mm(span)} of ${Math.round(t * 1000)} mm ${b.name}). Books weigh 15–20 kg a metre, so a full row is ${kg >= span * 20 ? 'fine' : 'too much: put an upright closer, or use thicker board'}.`;
  const boxes: Box[] = [];
  for (let i = 0; i < uprights; i++) boxes.push({ id: `side-${i}`, group: 'boards', label: 'Side', x: -w / 2 + t / 2 + i * (span + t), y: h / 2, z: 0, w: t, h, d, color: p.material === 'mdf' ? 0xd9c7a8 : COL.board, out: [(i - (uprights - 1) / 2) * 0.25, 0, 0] });
  for (let s = 0; s < spans; s++) for (let l = 0; l < levels; l++) boxes.push({ id: `shelf-${s}-${l}`, group: 'shelves', label: 'Shelf', x: -w / 2 + t + span / 2 + s * (span + t), y: 0.07 + t / 2 + l * (gap + t), z: 0, w: span, h: t, d, color: 0xead6b0, out: [0, 0, 0.35] });
  boxes.push({ id: 'back', group: 'boards', label: 'Back', x: 0, y: h / 2, z: -d / 2 - 0.0015, w, h, d: 0.003, color: 0x9b8b74, out: [0, 0, -0.3] });
  const items: Item2D[] = [];
  const pad = 0.4;
  for (let i = 0; i < uprights; i++) items.push({ t: 'rect', x: pad + i * (span + t), y: pad, w: t, h, k: 'board' });
  for (let s = 0; s < spans; s++) for (let l = 0; l < levels; l++) items.push({ t: 'rect', x: pad + t + s * (span + t), y: pad + 0.07 + l * (gap + t), w: span, h: t, k: 'board' });
  items.push({ t: 'dim', a: [pad, pad], b: [pad + w, pad], text: m(w), off: -0.25 });
  items.push({ t: 'dim', a: [pad, pad], b: [pad, pad + h], text: m(h), off: 0.25 });
  items.push({ t: 'dim', a: [pad + t, pad + h], b: [pad + t + span, pad + h], text: mm(span), off: 0.2 });
  items.push({ t: 'text', x: pad + w / 2, y: pad + h + 0.35, text: `${levels} shelves a bay, ${mm(gap)} apart, ${mm(d)} deep` });
  const front: View2D = { title: 'FRONT', w: w + 2 * pad, h: h + 2 * pad, items, words: `The front: ${m(w)} wide and ${m(h)} tall, ${uprights} sides making ${spans} ${spans === 1 ? 'bay' : 'bays'} ${mm(span)} wide, ${levels} shelves in each, ${mm(gap)} apart, ${mm(d)} deep, in ${Math.round(t * 1000)} mm ${b.name}.` };
  return {
    params: p, kind: 'shelf', title: `${KIND_NAMES.shelf}, ${m(w)} wide`, concept: false,
    summary: `${m(w)} wide, ${m(h)} tall, ${mm(d)} deep, ${spans} ${spans === 1 ? 'bay' : 'bays'} of ${levels} shelves, ${Math.round(t * 1000)} mm ${b.name}`,
    groups: [g('boards', 'Sides and back'), g('shelves', 'Shelves'), g('fixings', 'Fixings'), g('finish', 'Finish')],
    lines: B.lines, boxes, views: [front], load,
    steps: ['Cut the sides, shelves and plinth (or have the shop cut them to the list).', 'Mark the shelf heights on the sides together, so they match; drill pilot holes.', 'Screw the case together on the floor, the plinth at the bottom; check it is square (the diagonals equal).', 'Pin the back on square; two coats of varnish.', 'Stand it, and fix it to the wall at the top with the brackets.'],
    tools: ['Tape, square, pencil', 'Saw (or the shop cuts it)', 'Drill-driver, a 3 mm pilot bit, a countersink', 'Clamps', 'A stud finder and wall plugs for the brackets'],
    hours: Math.round(2 + levels * spans * 0.3 + 1), safety: ['Fix every tall case to the wall: a full bookcase that tips can kill a child.'],
    law: [], notes: p.notes, total: total(B.lines),
  };
}

function desk(p: Params): Design {
  const { w, d, h } = p;
  const B = new Bill('desk');
  const b = BOARDS[p.material === 'mdf' ? 'mdf' : p.material];
  if (b.price === 'oak27' || b.price === 'pine18') B.add('top', b.price, r2(Math.ceil(w * d * 1.05 * 10) / 10), { unit: 'm²', size: `${mm(w)} × ${mm(d)}`, material: b.name, name: `Desk top (${b.name})` });
  else B.add('top', b.price, 1, { size: `${mm(w)} × ${mm(d)} from one sheet`, material: b.name, name: `Desk top (${b.name})` });
  B.timber('frame', 'pse44', [{ len: r2(h - b.t), n: 4, label: 'leg' }, { len: r2(w - 0.1), n: 2, label: 'rail' }, { len: r2(d - 0.1), n: 3, label: 'rail' }], { size: '44 × 44 mm', material: 'planed pine', name: 'Legs and rails' });
  B.add('fixings', 'screws50', 1, { note: 'the rails to the legs (two a joint), the top from below' });
  B.add('fixings', 'adhesive', 1, { name: 'Wood glue (PVA), 310 ml' });
  B.add('finish', 'varnish', 1, { size: '750 ml', note: 'two coats on the top' });
  const span = r2(d - 0.1);
  const kg = evenLoadKg(span, w, b.t, b.E, 300);
  const load = `The top takes about ${Math.min(kg, 150)} kg spread over it (${Math.round(b.t * 1000)} mm ${b.name} across ${mm(span)} between the rails, bending under 1/300); a monitor, a PC and books together are about 30 kg. Never sit or stand on it.`;
  const boxes: Box[] = [{ id: 'top', group: 'top', label: 'Top', x: 0, y: h - b.t / 2, z: 0, w, h: b.t, d, color: COL.board, out: [0, 0.5, 0] }];
  for (const [i, sx, sz] of [[0, -1, -1], [1, 1, -1], [2, -1, 1], [3, 1, 1]] as const) boxes.push({ id: `leg-${i}`, group: 'frame', label: 'Leg', x: sx * (w / 2 - 0.05), y: (h - b.t) / 2, z: sz * (d / 2 - 0.05), w: 0.044, h: h - b.t, d: 0.044, color: 0xc89f6c, out: [sx * 0.15, 0, sz * 0.15] });
  for (const sz of [-1, 1]) boxes.push({ id: `rail-${sz}`, group: 'frame', label: 'Rail', x: 0, y: h - b.t - 0.05, z: sz * (d / 2 - 0.05), w: w - 0.1, h: 0.044, d: 0.044, color: 0xc89f6c, out: [0, 0.2, sz * 0.15] });
  const pad = 0.3;
  const front: View2D = { title: 'FRONT', w: w + 2 * pad, h: h + 2 * pad, words: `The front: ${m(w)} wide, ${m(h)} high, ${m(d)} deep, a ${Math.round(b.t * 1000)} mm ${b.name} top on four 44 mm legs.`, items: [
    { t: 'rect', x: pad, y: pad + h - b.t, w, h: b.t, k: 'board' },
    { t: 'rect', x: pad + 0.028, y: pad, w: 0.044, h: h - b.t, k: 'board' },
    { t: 'rect', x: pad + w - 0.072, y: pad, w: 0.044, h: h - b.t, k: 'board' },
    { t: 'dim', a: [pad, pad + h], b: [pad + w, pad + h], text: m(w), off: 0.2 },
    { t: 'dim', a: [pad + w, pad], b: [pad + w, pad + h], text: m(h), off: -0.2 },
  ] };
  return {
    params: p, kind: 'desk', title: `${KIND_NAMES.desk}, ${m(w)} × ${m(d)}`, concept: false, summary: `${m(w)} × ${m(d)}, ${m(h)} high, a ${b.name} top on a pine frame`,
    groups: [g('top', 'Top'), g('frame', 'Legs and rails'), g('fixings', 'Fixings'), g('finish', 'Finish')], lines: B.lines, boxes, views: [front], load,
    steps: ['Cut the legs and rails to the list; sand them.', 'Glue and screw the two end frames (two legs, a rail), then join them with the long rails; check square.', 'The top on, screwed from below through the rails (slotted holes for solid wood, so it can move).', 'Two coats of varnish on the top.'],
    tools: ['Tape, square, saw', 'Drill-driver, pilot and countersink bits', 'Clamps', 'Sandpaper (120, then 180)'],
    hours: 5, safety: ['Clamp the work, never hold it, when you drill.'], law: [], notes: p.notes, total: total(B.lines),
  };
}

function bench(p: Params): Design {
  const { w, d, h } = p;
  const B = new Bill('bench');
  const slats = Math.max(3, Math.round(d / 0.13));
  B.timber('seat', 'decking', [{ len: r2(w), n: slats }], { size: '28 × 120 mm', material: 'treated deck board', name: 'Seat slats', note: `${slats} slats with 10 mm gaps` });
  const legs = Math.ceil(w / 1.2) + 1;
  B.timber('frame', 't47x75', [{ len: r2(h - 0.028), n: legs * 2, label: 'leg' }, { len: r2(d), n: legs, label: 'bearer' }, { len: r2(w - 0.2), n: 1, label: 'stretcher' }], { size: '47 × 75 mm', name: 'Legs, seat bearers and a stretcher' });
  B.add('fixings', 'bolts', Math.ceil((legs * 4) / 10), { note: 'the legs to the bearers' });
  B.add('fixings', 'screws50', 1, { note: 'two a slat at each bearer (stainless or coated, for outside)' });
  B.add('finish', 'preserver', 1, { size: '5 litres', note: 'two coats' });
  const span = r2(w / (legs - 1));
  const kg = pointLoadKg(span, slats * 0.12, 0.028, 9, 200);
  const people = Math.max(1, Math.min(Math.floor(w / 0.5), Math.floor(kg / 100) || 1));
  const load = `The slats together take about ${kg} kg sat in the middle of each ${mm(span)} span before they bend 1/200 (28 mm treated pine): it seats ${people} ${people === 1 ? 'adult' : 'adults'} of 100 kg, side by side.`;
  const boxes: Box[] = [];
  for (let i = 0; i < slats; i++) boxes.push({ id: `slat-${i}`, group: 'seat', label: 'Slat', x: 0, y: h - 0.014, z: -d / 2 + 0.06 + (i * (d - 0.12)) / Math.max(1, slats - 1), w, h: 0.028, d: 0.12, color: 0xb98b56, out: [0, 0.5, 0] });
  for (let i = 0; i < legs; i++) {
    const x = -w / 2 + 0.1 + (i * (w - 0.2)) / Math.max(1, legs - 1);
    for (const sz of [-1, 1]) boxes.push({ id: `leg-${i}-${sz}`, group: 'frame', label: 'Leg', x, y: (h - 0.028) / 2, z: sz * (d / 2 - 0.05), w: 0.075, h: h - 0.028, d: 0.047, color: COL.frame, out: [0, 0, sz * 0.2] });
  }
  const pad = 0.3;
  const front: View2D = { title: 'FRONT', w: w + 2 * pad, h: h + 2 * pad, words: `The front: ${m(w)} long, the seat ${m(h)} high and ${m(d)} deep, ${slats} slats on ${legs} pairs of legs.`, items: [
    { t: 'rect', x: pad, y: pad + h - 0.028, w, h: 0.028, k: 'board' },
    ...Array.from({ length: legs }, (_, i) => ({ t: 'rect' as const, x: pad + 0.1 - 0.0375 + (i * (w - 0.2)) / Math.max(1, legs - 1), y: pad, w: 0.075, h: h - 0.028, k: 'board' as const })),
    { t: 'dim', a: [pad, pad + h], b: [pad + w, pad + h], text: m(w), off: 0.2 },
    { t: 'dim', a: [pad + w, pad], b: [pad + w, pad + h], text: m(h), off: -0.2 },
  ] };
  return {
    params: p, kind: 'bench', title: `${KIND_NAMES.bench}, ${m(w)} long`, concept: false, summary: `${m(w)} long, ${m(h)} to the seat, ${slats} slats, ${legs} pairs of legs, treated pine for outside`,
    groups: [g('seat', 'Seat'), g('frame', 'Frame'), g('fixings', 'Fixings'), g('finish', 'Finish')], lines: B.lines, boxes, views: [front], load,
    steps: ['Cut the legs, bearers and slats; round the slats’ edges.', 'Bolt each pair of legs to a bearer; join the pairs with the stretcher.', 'Screw the slats on with 10 mm gaps (a spacer), starting from the front.', 'Two coats of treatment, the cut ends too.'],
    tools: ['Tape, square, saw', 'Drill with a 10 mm bit (the bolts) and a driver', 'Spanner', 'Sandpaper'],
    hours: 4, safety: ['Treated timber dust: cut it outside, with a mask.'], law: [], notes: p.notes, total: total(B.lines),
  };
}

// ---------------------------------------------------------------- the design for any kind

/** The design for his parameters: every face of it, from the same numbers. */
export function design(p: Params): Design {
  const q = clampParams(p);
  switch (q.kind) {
    case 'shed': return shed(q);
    case 'gardenroom': return gardenroom(q);
    case 'garage': return garage(q);
    case 'room': return room(q);
    case 'shelf': return shelf(q);
    case 'desk': return desk(q);
    case 'bench': return bench(q);
    case 'pc': return pcDesign(q);
    default: return conceptDesign(q);
  }
}

// ---------------------------------------------------------------- the trade's words, plainly

/** Every trade word a design may use, with its plain gloss (shown under THE BILL and THE BUILD, and in the text export). */
export const GLOSSARY: [RegExp, string, string][] = [
  [/\bstuds?\b/i, 'Stud', 'one of the upright timbers a wall is framed from'],
  [/\bnoggins?\b/i, 'Noggin', 'a short timber across between two studs, to stiffen the wall'],
  [/\b(?:top|bottom|wall) plates?\b|\bplates top and bottom\b/i, 'Plate', 'the timber along the top or the bottom of a wall that the studs are fixed to'],
  [/\bbearers?\b/i, 'Bearer', 'a timber on the base that the floor sits on'],
  [/\bjoists?\b/i, 'Joist', 'one of the beams a floor or a flat roof is laid across'],
  [/\brafters?\b/i, 'Rafter', 'one of the sloping timbers that carry a pitched roof'],
  [/\bridge\b/i, 'Ridge', 'the top line where the two slopes of a roof meet'],
  [/\bpitch(?:ed)?\b|°\)|° apex|° fall/i, 'Pitch', 'how steep a roof is, in degrees from flat'],
  [/\bpent\b/i, 'Pent roof', 'a roof that slopes one way only'],
  [/\bapex\b/i, 'Apex roof', 'a roof with two slopes meeting at a ridge'],
  [/\bfascia\b|\bbarge\b/i, 'Fascia and barge boards', 'the boards along the roof’s edges that keep the weather out of the ends'],
  [/\bOSB3?\b/, 'OSB3', 'oriented strand board: strong sheets of pressed wood chips, made for damp places'],
  [/\bshiplap\b/i, 'Shiplap', 'cladding boards shaped to overlap, so rain runs off'],
  [/\bC16\b|\bC24\b/, 'C16, C24', 'strength grades of timber: C24 is the stronger'],
  [/\bPIR\b/, 'PIR', 'rigid foam insulation board, foil-faced'],
  [/\bEPDM\b/, 'EPDM', 'a rubber roof laid in one sheet, with no joins to leak'],
  [/\bbreather membrane\b/i, 'Breather membrane', 'a sheet that keeps rain out but lets damp out of the wall'],
  [/\bvapour control\b/i, 'Vapour control layer', 'a sheet on the warm side that stops damp air getting into the insulation'],
  [/\bwarm (?:flat )?roof\b/i, 'Warm roof', 'a flat roof with its insulation on top of the deck, so the timbers stay warm and dry'],
  [/\bbattens?\b/i, 'Batten', 'a thin strip of timber that holds cladding off the wall, leaving an air gap'],
  [/\blintel\b/i, 'Lintel', 'the beam over a door or window that carries the wall above it'],
  [/\bdamp-proof course\b|\bDPC\b/i, 'Damp-proof course', 'a plastic strip laid in a wall near the ground, so damp cannot rise'],
  [/\bdamp-proof membrane\b/i, 'Damp-proof membrane', 'a plastic sheet under a concrete slab, so damp cannot rise'],
  [/\bMOT type 1\b|\bhardcore\b/i, 'Hardcore (MOT type 1)', 'crushed stone, compacted, to make a firm base under concrete'],
  [/\bA142\b|\bmesh\b/i, 'A142 mesh', 'a sheet of steel mesh set inside concrete so it does not crack'],
  [/\bpiers?\b/i, 'Pier', 'a thicker column of blocks that stiffens a wall'],
  [/\bground screws?\b/i, 'Ground screw', 'a big steel screw wound into the ground instead of a concrete base'],
  [/\bPart P\b/, 'Part P', 'the part of the Building Regulations about electrical work in a home'],
  [/\bpermitted development\b/i, 'Permitted development', 'building you may do without asking for planning permission, inside set limits'],
  [/\bcut list\b/i, 'Cut list', 'which pieces to cut from which lengths of timber, and what is left over'],
  [/\btype 22\b/i, 'Type 22 radiator', 'a radiator with two panels and two sets of fins: the usual size for a room'],
  [/\bBTU\b/, 'BTU', 'British thermal units: another way of saying how much heat (1 W is about 3.4 BTU)'],
  [/\bMFC\b|\bmelamine-faced\b/i, 'Melamine-faced board', 'chipboard with a hard plastic face, for furniture'],
  [/\bCPU\b|\bprocessor\b/i, 'Processor (CPU)', 'the chip that does the computing'],
  [/\bsocket\b|\bAM[45]\b|\bLGA1700\b/i, 'Socket', 'the shape of the processor’s seat on the board: the two must match'],
  [/\bDDR[45]\b/, 'DDR4, DDR5', 'generations of memory: a board takes one or the other'],
  [/\bNVMe\b|\bM\.2\b/i, 'NVMe (M.2) SSD', 'a fast storage card that plugs straight into the board'],
  [/\bmicro-ATX\b|\bATX\b/i, 'ATX, micro-ATX', 'board sizes: a case says which it takes'],
  [/\bpower supply\b|\bPSU\b/i, 'Power supply', 'the box that turns mains power into what the parts need'],
  [/\bBIOS\b|\bEXPO\b|\bXMP\b/i, 'BIOS, EXPO, XMP', 'the board’s own settings screen; EXPO or XMP runs the memory at its rated speed'],
];

/** The trade words this design uses, each with its plain gloss. */
export function glossFor(d: Design): { term: string; gloss: string }[] {
  // (a bill with lengths to cut shows its cut list: that is one of the words too)
  const text = [d.summary, ...d.lines.flatMap((l) => [l.name, l.size, l.material, l.note ?? '', l.cut ? 'cut list' : '']), ...d.steps, ...(d.compat ?? []).map((c) => c.text), ...d.views.map((v) => v.words)].join(' \n ');
  return GLOSSARY.filter(([re]) => re.test(text)).map(([, term, gloss]) => ({ term, gloss }));
}

/** The lines of a part group ("the roof"), and what they come to. */
export function groupLines(d: Design, group: string): { lines: Line[]; total: number } {
  const lines = d.lines.filter((l) => l.group === group);
  return { lines, total: total(lines) };
}

/** VoiceOver's reading of the whole plan: each view in words, then the bill in one line. */
export function planWords(d: Design): string {
  if (d.concept) return `${d.title}: a concept with real parts, not a build plan, so nothing is drawn.`;
  return [...d.views.map((v) => v.words), `${d.lines.length} lines in the bill, about ${Math.round(d.total).toLocaleString('en-GB')} pounds as a first estimate.`].join(' ');
}
