/**
 * THE WORKING ENGINE, as numbers (BRIEF-WORKING-ENGINE; OWNER-ISSUES 91a, 164 and the audit's "the working 3-D engine"): a
 * parametric internal-combustion engine (or an electric motor) made from the CarSpec, pure geometry and timing with no three.js
 * and no page, so the brain's tests read it (apps/edge/test/workingengine.test.mjs) and the 3-D ENGINE's tray and its glTF
 * exporter draw the same primitives the bay does (car/enginemesh.ts turns them into meshes).
 *
 * What it is: the cylinder count and layout (an inline three or four by default from the car's size and fuel; an inline six, a
 * vee six or a vee eight where the record's displacement or a small table of common UK engines says so, "typical for this car",
 * never "yours"), the bore and stroke from the displacement when the record gives one and a typical pair when it does not,
 * petrol or diesel, a turbo where the fuel and year make one typical, a belt or a chain by the maker. Every part has an id
 * (car/parts.ts), a name, a place, a layer for TAKE APART and its numbers, each marked estimate, typical or from the MOT record.
 *
 * What it does, from one crank angle (degrees, 0 to 720 for a whole cycle): the pistons by the rod geometry (not a sine), the
 * valves by a cam profile with the usual overlap, the belt's pulleys at their ratios, the flywheel. Cylinder one is at top dead
 * centre on the start of its power stroke at 0°. There is no physics here (that is KERNEL 2's): the motion is kinematic, which
 * is exact for what it shows.
 *
 * The frame (metres): X along the crank, Y up from the crank's axis, Z across the cylinders (the exhaust side +Z). A cylinder's
 * own parts are drawn in ITS frame (Y up its axis), posed at its place on the crank and tilted by its bank's angle.
 */
import { PARTS, type BayId, type PartId } from './parts';

export type V3 = [number, number, number];
export type Layout = 'I3' | 'I4' | 'I6' | 'V6' | 'V8' | 'EV';
/** The palette the meshes wear: car/kit.ts's own materials, by name. */
export type MatKey = 'block' | 'alu' | 'steel' | 'chrome' | 'trim' | 'plastic' | 'hose' | 'yellow' | 'red' | 'orange' | 'blue' | 'pink' | 'rubber' | 'alloy';

/** A primitive in metres: a box, a cylinder (its axis Y until turned) or a sphere, `r` the turn (x, y, z; three's XYZ order). */
export interface EPrim {
  t: 'box' | 'cyl' | 'sph';
  c: V3;
  /** Width, height, depth; a cylinder's diameters and length. */
  s: V3;
  r?: V3;
}

export type Motion =
  | { k: 'none' }
  | { k: 'spin'; ratio: number }
  | { k: 'piston'; i: number }
  | { k: 'rod'; i: number }
  | { k: 'valve'; i: number; intake: boolean };

export interface Piece {
  id: PartId;
  /** What a tap names: "Piston 2". */
  inst: string;
  /** Its cylinder (1-based), or 0. */
  cyl: number;
  prims: EPrim[];
  mat: MatKey;
  home: V3;
  rx0: number;
  motion: Motion;
  /** TAKE APART: the layer it flies out in (1 head and manifolds, 2 valves and cams, 3 pistons and rods, 4 the block's own), where to, and when it starts (0–1). */
  layer: 1 | 2 | 3 | 4;
  ex: V3;
  start: number;
  /** The casing: it turns see-through when the cover is lifted and SECTION cuts it. */
  shell?: boolean;
  /** The cover over the top, which LIFT THE COVER takes off. */
  cover?: boolean;
  /** Shown only in the cutaway (the oil and coolant channels). */
  passage?: boolean;
  /** Turns see-through with the casing when the cover is lifted (the manifolds, the gasket), but is not cut by SECTION. */
  ghost?: boolean;
  /** The working parts inside: a tap goes through the see-through casing to these first. */
  inner?: boolean;
}

/** The ids whose pieces work inside the casing: a tap on the lifted engine reaches these through it. */
export const INNER: readonly PartId[] = ['piston', 'piston_rings', 'con_rod', 'inlet_valve', 'exhaust_valve', 'valve_spring', 'plugs', 'oil_passages', 'coolant_passages'];
const GHOSTS: readonly PartId[] = ['inlet_manifold', 'exhaust_manifold', 'head_gasket'];

export type Fuel = 'petrol' | 'diesel' | 'electric' | 'hybrid' | '';

export interface EngineModel {
  layout: Layout;
  cyl: number;
  /** Cubic centimetres, and where that came from. */
  cc: number;
  ccFrom: 'record' | 'typical';
  /** Metres. */
  bore: number;
  stroke: number;
  rod: number;
  /** The compression ratio, "typical". */
  comp: number;
  fuel: Fuel;
  diesel: boolean;
  turbo: boolean;
  chain: boolean;
  cams: number;
  electric: boolean;
  hybrid: boolean;
  /** Firing order, 1-based cylinder numbers. */
  firing: number[];
  /** Per cylinder (index 0 = cylinder 1): its place along the crank, its bank's tilt (radians), its crank pin (degrees), where in the 720° its power stroke starts. */
  cylX: number[];
  beta: number[];
  pin: number[];
  fire: number[];
  /** Metres: the deck above the crank's axis. */
  deck: number;
  /** The words: "a typical four-cylinder petrol engine". */
  words: string;
  /** What the table said (the maker and model it knew), or ''. */
  tableHit: string;
  pieces: Piece[];
  /** The envelope, metres, in the engine's own frame. */
  box: { min: V3; max: V3 };
}

// ---------------------------------------------------------------- the table of common UK engines

const FIRING: Record<Exclude<Layout, 'EV'>, number[]> = {
  I3: [1, 2, 3],
  I4: [1, 3, 4, 2],
  I6: [1, 5, 3, 6, 2, 4],
  V6: [1, 4, 2, 5, 3, 6],
  V8: [1, 8, 4, 3, 6, 5, 7, 2],
};
const CYLS: Record<Layout, number> = { I3: 3, I4: 4, I6: 6, V6: 6, V8: 8, EV: 0 };
const BANK: Record<Layout, number> = { I3: 0, I4: 0, I6: 0, V6: 60, V8: 90, EV: 0 };
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

interface Hit {
  re: RegExp;
  layout: Layout;
  cc?: number;
  /** Petrol, diesel or either. */
  fuel?: 'petrol' | 'diesel';
  /** The year it applies from. */
  from?: number;
}
/** A small table of common UK engines in his words: the make and model the record names, and what it usually has. Typical, never exact. */
const TABLE: Hit[] = [
  { re: /^bmw .*\b(?:3[3-4]\d|5[3-4]\d|6[3-4]\d|7[3-4]\d|m[2-5](?:\d{2})?|x[3-6] ?m40|z4 m40)/, layout: 'I6', cc: 2998 },
  { re: /^mercedes.*\b(?:[cesg]l?[ce]?\s?(?:350|400|450)|gle ?(?:350|400)|ml ?350)\b/, layout: 'V6', cc: 2996 },
  { re: /^mercedes.*\b(?:63|amg gt|g 63)\b/, layout: 'V8', cc: 3982 },
  { re: /^audi .*\b(?:s[4-6]|rs[4-7]|[aq][4-8] ?(?:3\.0|50 tdi|55)|q7|q8)\b/, layout: 'V6', cc: 2995 },
  { re: /^ford .*\bmustang\b/, layout: 'V8', cc: 4951, fuel: 'petrol' },
  { re: /^(?:land rover|range rover|jaguar)\b.*\b(?:discovery|range rover|defender|velar|f-pace|xf|xj)\b/, layout: 'V6', cc: 2993, fuel: 'diesel' },
  { re: /^toyota .*\bprius\b/, layout: 'I4', cc: 1798 },
  { re: /^mini\b/, layout: 'I3', cc: 1499, from: 2014 },
  { re: /^volvo .*\b(?:xc90|v90|s90)\b/, layout: 'I4', cc: 1969 },
];

const lc = (s: string | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const CHAIN_MAKES = /^(?:bmw|mercedes|toyota|lexus|honda|nissan|mazda|kia|hyundai|suzuki|jaguar|land rover|range rover|audi|porsche|mini|subaru|mitsubishi|ford mustang)/;

/** What the car says about its engine: only what the spec carries (the silhouette, the size, the fuel, the year, the displacement the record gave). */
export interface EngineFacts {
  make: string;
  model: string;
  silhouette: string;
  size: 'S' | 'M' | 'L';
  fuel: Fuel;
  year: number | null;
  /** From the record (DVSA's MOT history), or null. */
  engineCc: number | null;
}

/** The layout and displacement: the record's displacement first, then the table, then the car's size and fuel. */
export function layoutFor(f: EngineFacts): { layout: Layout; cc: number; from: 'record' | 'typical'; table: string } {
  if (f.fuel === 'electric') return { layout: 'EV', cc: 0, from: 'typical', table: '' };
  const name = `${lc(f.make)} ${lc(f.model)}`.trim();
  const recorded = typeof f.engineCc === 'number' && f.engineCc >= 600 && f.engineCc <= 9000 ? Math.round(f.engineCc) : null;
  const diesel = f.fuel === 'diesel';
  const hit = TABLE.find((t) => t.re.test(name) && (!t.fuel || t.fuel === (diesel ? 'diesel' : 'petrol')) && (!t.from || !f.year || f.year >= t.from));
    if (recorded) {
    let layout: Layout;
    if (recorded >= 3700) layout = 'V8';
    else if (recorded >= 2500) layout = hit && hit.layout !== 'I3' && hit.layout !== 'I4' ? hit.layout : /^(?:bmw|volvo)/.test(name) ? 'I6' : 'V6';
    else if (!diesel && (recorded <= 1200 || (recorded <= 1500 && f.size === 'S'))) layout = 'I3';
    else layout = 'I4';
    return { layout, cc: recorded, from: 'record', table: hit?.layout === layout ? name : '' };
  }
  if (hit) return { layout: hit.layout, cc: hit.cc ?? 1998, from: 'typical', table: name };
  if (!diesel && f.size === 'S') return { layout: 'I3', cc: 999, from: 'typical', table: '' };
  if (diesel) return { layout: 'I4', cc: f.size === 'S' ? 1461 : 1968, from: 'typical', table: '' };
  return { layout: 'I4', cc: f.size === 'L' ? 1998 : 1498, from: 'typical', table: '' };
}

/** A turbo is typical on every diesel since the late nineties and on the small petrols of the last decade. */
export function turboTypical(fuel: Fuel, year: number | null, cc: number, layout: Layout): boolean {
  if (layout === 'EV' || fuel === 'hybrid') return false;
  const y = year ?? 2014;
  if (fuel === 'diesel') return y >= 1998;
  if (layout === 'V8') return false;
  if (layout === 'I6' || layout === 'V6') return y >= 2016 && cc <= 3000;
  return (y >= 2014 && cc <= 1700) || (y >= 2018 && cc <= 2200);
}

// ---------------------------------------------------------------- the geometry

const rad = (d: number) => (d * Math.PI) / 180;
const mod = (v: number, m: number) => ((v % m) + m) % m;
const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];

const box = (c: V3, s: V3, r?: V3): EPrim => ({ t: 'box', c, s, ...(r ? { r } : {}) });
const cylY = (c: V3, d: number, h: number, r?: V3): EPrim => ({ t: 'cyl', c, s: [d, h, d], ...(r ? { r } : {}) });
const cylX = (c: V3, d: number, len: number): EPrim => ({ t: 'cyl', c, s: [d, len, d], r: [0, 0, -Math.PI / 2] });
const cylZ = (c: V3, d: number, len: number): EPrim => ({ t: 'cyl', c, s: [d, len, d], r: [Math.PI / 2, 0, 0] });
const sph = (c: V3, d: number): EPrim => ({ t: 'sph', c, s: [d, d, d] });
/** A primitive of a bank's cylinder frame, put in the engine's frame: its centre and its turn follow the bank's tilt. */
const inBank = (p: EPrim, b: number): EPrim => (b ? { ...p, c: rotX(p.c, b), r: [(p.r?.[0] ?? 0) + b, p.r?.[1] ?? 0, p.r?.[2] ?? 0] } : p);
/** A rod of a belt or chain in the (Z, Y) plane at x: from (u0, v0) to (u1, v1). */
function segment(x: number, u0: number, v0: number, u1: number, v1: number, w: number, th: number): EPrim {
  const du = u1 - u0;
  const dv = v1 - v0;
  const len = Math.hypot(du, dv);
  return box([x, (v0 + v1) / 2, (u0 + u1) / 2], [w, len, th], [Math.atan2(du, dv), 0, 0]);
}

interface Circle {
  u: number;
  v: number;
  r: number;
}
/** The loop of a belt round circles that all sit on its outside (in the (Z, Y) plane): tangent lines and arcs, as thin boxes. */
export function beltLoop(x: number, circles: Circle[], w: number, th: number): EPrim[] {
  const cx = circles.reduce((s, c) => s + c.u, 0) / circles.length;
  const cy = circles.reduce((s, c) => s + c.v, 0) / circles.length;
  // counter-clockwise in the (u, v) plane, so the outside is on the right of the way round
  const ring = [...circles].sort((a, b) => Math.atan2(a.v - cy, a.u - cx) - Math.atan2(b.v - cy, b.u - cx));
  const n = ring.length;
  const out: EPrim[] = [];
  const angOut: { a0: number; a1: number }[] = ring.map(() => ({ a0: 0, a1: 0 }));
  for (let i = 0; i < n; i++) {
    const A = ring[i]!;
    const B = ring[(i + 1) % n]!;
    const d = Math.hypot(B.u - A.u, B.v - A.v) || 1e-6;
    const dir = Math.atan2(B.v - A.v, B.u - A.u);
    const na = dir - Math.acos(Math.max(-1, Math.min(1, (A.r - B.r) / d)));
    angOut[i]!.a1 = na;
    angOut[(i + 1) % n]!.a0 = na;
    out.push(segment(x, A.u + A.r * Math.cos(na), A.v + A.r * Math.sin(na), B.u + B.r * Math.cos(na), B.v + B.r * Math.sin(na), w, th));
  }
  for (let i = 0; i < n; i++) {
    const C = ring[i]!;
    let a0 = angOut[i]!.a0;
    const a1 = angOut[i]!.a1;
    while (a1 < a0) a0 -= Math.PI * 2;
    const steps = Math.max(1, Math.ceil((a1 - a0) / rad(18)));
    for (let k = 0; k < steps; k++) {
      const p = a0 + ((a1 - a0) * k) / steps;
      const q = a0 + ((a1 - a0) * (k + 1)) / steps;
      out.push(segment(x, C.u + C.r * Math.cos(p), C.v + C.r * Math.sin(p), C.u + C.r * Math.cos(q), C.v + C.r * Math.sin(q), w, th));
    }
  }
  return out;
}

/** A pulley, with a notch so its turning shows: a disc across X at (x, v, u). */
const pulley = (x: number, u: number, v: number, r: number, w: number): EPrim[] => [cylX([x, v, u], r * 2, w), box([x + w * 0.1, v + r * 0.6, u], [w * 1.2, r * 0.5, r * 0.28])];

// ---------------------------------------------------------------- the engine from the car

const SHAPES: Record<string, string> = { petrol: 'petrol', diesel: 'diesel', electric: 'electric', hybrid: 'petrol-electric hybrid' };

export function wordsFor(layout: Layout, fuel: Fuel): string {
  if (layout === 'EV') return 'a typical electric motor';
  const n = NUMBER_WORDS[CYLS[layout]]!;
  const kind = layout === 'V6' || layout === 'V8' ? `${n}-cylinder vee` : `${n}-cylinder`;
  return `a typical ${kind} ${fuel === 'diesel' ? 'diesel' : fuel === 'hybrid' ? 'petrol hybrid' : 'petrol'} engine`;
}

/** The one honest line the view says, once. */
export function engineLine(m: Pick<EngineModel, 'words' | 'hybrid' | 'electric'>): string {
  const a = m.words.charAt(0).toUpperCase() + m.words.slice(1);
  if (m.electric) return `${a} for a car like yours, a first estimate; not your exact motor.`;
  return `${a} for a car like yours, a first estimate; not your exact engine.${m.hybrid ? ' A hybrid has an electric motor beside it, drawn too.' : ''}`;
}

export function engineModel(f: EngineFacts): EngineModel {
  const lay = layoutFor(f);
  const layout = lay.layout;
  const electric = layout === 'EV';
  const hybrid = f.fuel === 'hybrid';
  const diesel = f.fuel === 'diesel';
  const cyl = CYLS[layout];
  const cc = lay.cc;
  const turbo = turboTypical(f.fuel, f.year, cc, layout);
  const name = `${lc(f.make)} ${lc(f.model)}`;
  const chain = CHAIN_MAKES.test(name) && !(diesel && /^audi/.test(name));
  const cams = f.year && f.year < 2002 && f.size === 'S' && !diesel ? 1 : 2;
  const fuel: Fuel = f.fuel;
  // bore and stroke from the displacement: one cylinder's volume = pi/4 bore² stroke, the stroke a typical multiple of the bore
  const k = diesel ? 1.15 : layout === 'I3' ? 1.1 : layout === 'V8' ? 0.85 : 0.95;
  const per = cyl ? (cc * 1e-6) / cyl : 0;
  const bore = cyl ? Math.cbrt((4 * per) / (Math.PI * k)) : 0;
  const stroke = bore * k;
  const comp = diesel ? 16.2 : turbo ? 9.6 : 10.6;
  const firing = electric ? [] : FIRING[layout as Exclude<Layout, 'EV'>];
  const bankDeg = BANK[layout];
  const v = bankDeg > 0;
  const rr = stroke / 2;
  const rod = rr * 3.4;
  const ch = bore * 0.5;
  const deck = rod + rr + ch;
  const pitch = bore * 1.18;
  const perBank = v ? cyl / 2 : cyl;
  const half = ((perBank - 1) * pitch) / 2;
  const cylX: number[] = [];
  const beta: number[] = [];
  const fire: number[] = [];
  const pin: number[] = [];
  for (let i = 0; i < cyl; i++) {
    const bank = v ? (i < perBank ? 0 : 1) : 0;
    const k2 = v ? i % perBank : i;
    // the second bank sits a rod's width along the crank from the first
    cylX.push(-half + k2 * pitch + (bank ? 0.024 : 0));
    beta.push(v ? (bank ? -rad(bankDeg / 2) : rad(bankDeg / 2)) : 0);
    fire.push((firing.indexOf(i + 1) * 720) / (cyl || 1));
    pin.push(mod((beta[i]! * 180) / Math.PI - fire[i]!, 360));
  }
  const m: EngineModel = {
    layout, cyl, cc, ccFrom: lay.from, bore, stroke, rod, comp, fuel, diesel, turbo, chain, cams, electric, hybrid, firing, cylX, beta, pin, fire, deck,
    words: wordsFor(layout, fuel), tableHit: lay.table, pieces: [], box: { min: [0, 0, 0], max: [0, 0, 0] },
  };
  m.pieces = electric ? electricPieces(m) : [...icePieces(m, pitch), ...(hybrid ? hybridPieces(m, half) : [])];
  m.box = envelope(m);
  return m;
}

/** The engine's facts from a CarSpec-shaped thing (the spec's own fields). */
export function factsOf(s: { make: string; model: string; silhouette: string; size: 'S' | 'M' | 'L'; fuel: Fuel; year: number | null; engineCc?: number | null }): EngineFacts {
  return { make: s.make, model: s.model, silhouette: s.silhouette, size: s.size, fuel: s.fuel, year: s.year, engineCc: s.engineCc ?? null };
}

type Add = (id: PartId, inst: string, prims: EPrim[], mat: MatKey, o?: Partial<Piece> & { cyl?: number }) => Piece;

function collector(list: Piece[]): Add {
  return (id, inst, prims, mat, o = {}) => {
    const p: Piece = { id, inst, cyl: o.cyl ?? 0, prims, mat, home: o.home ?? [0, 0, 0], rx0: o.rx0 ?? 0, motion: o.motion ?? { k: 'none' }, layer: o.layer ?? 4, ex: o.ex ?? [0, 0, 0], start: o.start ?? 0, ...(o.shell ? { shell: true } : {}), ...(o.cover ? { cover: true } : {}), ...(o.passage ? { passage: true } : {}), ...(GHOSTS.includes(id) ? { ghost: true } : {}), ...(INNER.includes(id) ? { inner: true } : {}) };
    list.push(p);
    return p;
  };
}

/** A pipe through axis-aligned points: a cylinder along each leg and a sphere at each bend. */
function pipe(pts: V3[], d: number): EPrim[] {
  const out: EPrim[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const dx = Math.abs(b[0] - a[0]);
    const dy = Math.abs(b[1] - a[1]);
    const dz = Math.abs(b[2] - a[2]);
    if (dx >= dy && dx >= dz) out.push(cylX(mid, d, dx + d * 0.2));
    else if (dy >= dz) out.push(cylY(mid, d, dy + d * 0.2));
    else out.push(cylZ(mid, d, dz + d * 0.2));
    if (i < pts.length - 1) out.push(sph(b, d * 1.05));
  }
  return out;
}

function icePieces(m: EngineModel, pitch: number): Piece[] {
  const out: Piece[] = [];
  const add = collector(out);
  const { bore: b, stroke: st, rod: l, deck, cyl } = m;
  const r = st / 2;
  const v = BANK[m.layout] > 0;
  const nBank = v ? cyl / 2 : cyl;
  const len = (nBank - 1) * pitch + bore2(b) + (v ? 0.024 : 0);
  const xa = len / 2 + 0.012;
  const banks = v ? [rad(BANK[m.layout] / 2), -rad(BANK[m.layout] / 2)] : [0];
  const headH = 0.065;
  const coverH = 0.03;
  const hc = headH + coverH;
  const camY = deck + 0.052;
  const depth = b + 0.07;
  const bottom = -(r + 0.045);
  const sumpD = 0.03;
  const petrol = !m.diesel;
  const instOf = (base: string, i: number) => (m.cyl > 1 ? `${base} ${i + 1}` : base);
  const bankName = (bk: number, s: string) => (v ? `${s} (${bk ? 'right' : 'left'} bank)` : s);
  const upOf = (bt: number, d: number): V3 => [0, d * Math.cos(bt), d * Math.sin(bt)];

  // ---- the block: the crankcase across the crank, and each bank's cylinders on it (a vee block is two slabs on one case)
  const blockPrims: EPrim[] = [box([0, (bottom + (v ? 0.04 : deck)) / 2, 0], [len + 0.02, (v ? 0.04 : deck) - bottom, v ? b * 1.7 : depth])];
  if (v) for (const bt of banks) blockPrims.push(inBank(box([0, deck / 2 + 0.01, 0], [len + 0.02, deck - 0.02, depth]), bt));
  add('block', 'Engine block', blockPrims, 'block', { shell: true });
  // ---- the sump under it, and the oil pump
  add('sump', 'Sump', [box([0, bottom - sumpD / 2 + 0.004, 0], [len * 0.92, sumpD, b * 1.3]), box([0.02, bottom - sumpD - 0.006, 0], [0.035, 0.014, 0.035])], 'alu', { shell: true, ex: [0, -0.13, 0], start: 0.3 });
  add('oil_pump', 'Oil pump', [cylX([xa - 0.03, bottom + 0.018, 0], 0.07, 0.03), box([xa - 0.03, bottom - 0.01, 0], [0.04, 0.05, 0.06])], 'steel', { ex: [0, -0.1, 0], start: 0.3 });
  // ---- the crankshaft: main journals, a pin per cylinder with its webs and counterweights
  const crank: EPrim[] = [cylX([0, 0, 0], 0.044, len + 0.1)];
  for (let i = 0; i < cyl; i++) {
    const x = m.cylX[i]!;
    const p = rad(m.pin[i]!);
    const dir: V3 = [0, Math.cos(p), Math.sin(p)];
    crank.push(cylX([x, r * dir[1], r * dir[2]], 0.04, 0.022));
    for (const side of [-1, 1]) {
      const wx = x + side * 0.017;
      crank.push(box([wx, (r / 2) * dir[1], (r / 2) * dir[2]], [0.011, r + 0.05, 0.05], [p, 0, 0]));
      crank.push(box([wx, -0.036 * dir[1], -0.036 * dir[2]], [0.011, 0.062, 0.07], [p, 0, 0]));
    }
  }
  add('crankshaft', 'Crankshaft', crank, 'steel', { motion: { k: 'spin', ratio: 1 } });
  // ---- the flywheel at the gearbox end (-X)
  add('flywheel', 'Flywheel', [cylX([0, 0, 0], 0.23, 0.03), cylX([0, 0, 0], 0.105, 0.036), box([0, 0.09, 0], [0.034, 0.03, 0.026]), box([0, -0.05, 0.05], [0.034, 0.02, 0.02])], 'steel', { home: [-(xa + 0.012), 0, 0], motion: { k: 'spin', ratio: 1 }, ex: [-0.13, 0, 0], start: 0.1 });

  // ---- per cylinder: the piston, its rings, its rod, the valves and their springs, the plug and coil or the injector
  for (let i = 0; i < cyl; i++) {
    const bt = m.beta[i]!;
    const home: V3 = [m.cylX[i]!, 0, 0];
    const up = upOf(bt, 0.075);
    add('piston', instOf('Piston', i), [cylY([0, b * 0.5 - 0.031, 0], b * 0.965, 0.062), cylX([0, 0, 0], 0.018, b * 0.74)], 'alu', { cyl: i + 1, home, rx0: bt, motion: { k: 'piston', i }, layer: 3, ex: up, start: 0.25 });
    add('piston_rings', instOf('Piston rings', i), [0, 1, 2].map((k) => cylY([0, b * 0.5 - 0.006 - k * 0.0095, 0], b * 0.99, 0.003)), 'steel', { cyl: i + 1, home, rx0: bt, motion: { k: 'piston', i }, layer: 3, ex: up, start: 0.25 });
    add('con_rod', instOf('Connecting rod', i), [box([0, l / 2, 0], [0.014, l - 0.03, 0.026]), cylX([0, 0, 0], 0.046, 0.02), cylX([0, l, 0], 0.026, 0.02)], 'steel', { cyl: i + 1, home, motion: { k: 'rod', i }, layer: 3, ex: up, start: 0.25 });
    // valves: one inlet and one exhaust are drawn for each cylinder (most engines have two of each)
    for (const intake of [true, false]) {
      const z = intake ? -0.03 : 0.03;
      const name = intake ? 'Inlet valve' : 'Exhaust valve';
      const fly = upOf(bt, 0.17);
      add(intake ? 'inlet_valve' : 'exhaust_valve', instOf(name, i), [cylY([0, deck + 0.0295, z], 0.006, 0.035), cylY([0, deck + 0.0115, z], 0.028, 0.003), cylY([0, deck + 0.047, z], 0.016, 0.004)], intake ? 'chrome' : 'steel', { cyl: i + 1, home, rx0: bt, motion: { k: 'valve', i, intake }, layer: 2, ex: fly, start: 0.12 });
      add('valve_spring', instOf(`${name} spring`, i), [cylY([0, deck + 0.033, z], 0.019, 0.026)], 'steel', { cyl: i + 1, home, rx0: bt, layer: 2, ex: fly, start: 0.12 });
    }
    const top = upOf(bt, 0.3);
    if (petrol) {
      add('plugs', instOf('Spark plug', i), [cylY([0, deck + 0.045, 0], 0.013, 0.075), cylY([0, deck + 0.088, 0], 0.02, 0.012)], 'chrome', { cyl: i + 1, home, rx0: bt, layer: 1, ex: top });
      add('coils', instOf('Ignition coil', i), [box([0, deck + hc + 0.02, 0], [0.032, 0.04, 0.032]), cylY([0, deck + hc + 0.045, 0], 0.014, 0.01)], 'hose', { cyl: i + 1, home, rx0: bt, layer: 1, ex: top });
    } else {
      add('injectors', instOf('Fuel injector', i), [cylY([0, deck + hc + 0.01, 0], 0.02, 0.06), box([0.012, deck + hc + 0.036, 0.012], [0.02, 0.02, 0.02])], 'steel', { cyl: i + 1, home, rx0: bt, layer: 1, ex: top });
    }
  }

  // ---- the head, its gasket, the cams
  const camCircles: Circle[] = [];
  for (let k = 0; k < banks.length; k++) {
    const bt = banks[k]!;
    const first = v ? (k ? nBank : 0) : 0;
    const x0 = m.cylX[first]!;
    const x1 = m.cylX[first + nBank - 1]!;
    const cx = (x0 + x1) / 2;
    const hl = x1 - x0 + b + 0.02;
    add('head', bankName(k, 'Cylinder head'), [inBank(box([cx, deck + headH / 2, 0], [hl, headH, depth]), bt), inBank(box([cx, deck + headH + coverH / 2, 0], [hl * 0.97, coverH, depth * 0.78]), bt)], 'alu', { shell: true, layer: 1, ex: upOf(bt, 0.3) });
    add('head_gasket', bankName(k, 'Head gasket'), [inBank(box([cx, deck - 0.0015, 0], [hl, 0.003, depth]), bt)], 'hose', { layer: 1, ex: upOf(bt, 0.2) });
    // the cams: one shaft with a lobe over each valve on a one-cam engine; two on the usual (inlet and exhaust)
    const shafts = m.cams >= 2 ? [{ z: -0.03, intake: true, name: 'Inlet camshaft' }, { z: 0.03, intake: false, name: 'Exhaust camshaft' }] : [{ z: 0, intake: true, name: 'Camshaft' }];
    for (const sh of shafts) {
      const prims: EPrim[] = [cylX([0, 0, 0], 0.024, hl)];
      for (let j = 0; j < nBank; j++) {
        const i = first + j;
        const lobes = m.cams >= 2 ? [sh.intake] : [true, false];
        for (const intake of lobes) {
          const peak = intake ? 465 : 255;
          const psi = Math.PI - ((m.fire[i]! + peak) * Math.PI) / 360;
          const xl = m.cylX[i]! - cx + (lobes.length > 1 ? (intake ? -0.007 : 0.007) : 0);
          prims.push(cylX([xl, 0, 0], 0.03, 0.012), box([xl, 0.0195 * Math.cos(psi), 0.0195 * Math.sin(psi)], [0.012, 0.012, 0.012], [psi, 0, 0]));
        }
      }
      const at = rotX([0, camY, sh.z], bt);
      const nm = v ? `${sh.name} (${k ? 'right' : 'left'} bank)` : sh.name;
      add('camshaft', nm, prims, 'steel', { home: [cx, at[1], at[2]], rx0: bt, motion: { k: 'spin', ratio: RATIOS.cam }, layer: 2, ex: upOf(bt, 0.17), start: 0.12 });
      camCircles.push({ u: at[2], v: at[1], r: 0.03 });
    }
  }
  // the cover over the top (LIFT THE COVER): the maker's cover, which turns see-through for the plugs and coils
  const coverY = deck + hc + 0.065;
  if (!v) add('engine_cover', 'Engine cover', [box([0, coverY, 0], [len * 0.98, 0.03, depth * 0.84]), box([0, coverY - 0.03, -depth * 0.4], [len * 0.98, 0.05, 0.012]), cylY([0.03, coverY + 0.017, 0], 0.07, 0.006)], 'plastic', { cover: true, ex: [0, 0.45, 0] });
  else add('engine_cover', 'Engine cover', banks.map((bt) => inBank(box([0, deck + hc + 0.065, 0], [len * 0.96, 0.03, depth * 0.7]), bt)), 'plastic', { cover: true, ex: [0, 0.45, 0] });
  add('oil_cap', 'Oil filler cap', [cylY([-len * 0.3, coverY + 0.022, 0.022], 0.05, 0.02), cylY([-len * 0.3, coverY + 0.034, 0.022], 0.036, 0.012)], 'yellow', { ex: [0, 0.4, 0] });
  add('dipstick', 'Dipstick', [cylY([len * 0.34, deck * 0.55, -(depth / 2 + 0.02)], 0.006, deck * 0.9), cylY([len * 0.34, deck + 0.012, -(depth / 2 + 0.02)], 0.03, 0.01)], 'yellow', { ex: [0, 0.2, -0.04], start: 0.05 });

  // ---- the intake side (-Z): the manifold and its runners, the throttle body; the exhaust side (+Z): the manifold, the turbo
  const px = (len + 0.02) * 0.5;
  const intakeY = deck + headH * 0.55;
  const inlet: EPrim[] = v ? [box([0, deck + hc + 0.03, 0], [len * 0.8, 0.07, depth * 0.5])] : [box([0, intakeY + 0.04, -(depth / 2 + 0.045)], [len * 0.86, 0.07, 0.07])];
  if (!v) for (let i = 0; i < cyl; i++) inlet.push(box([m.cylX[i]!, intakeY + 0.01, -(depth / 2 + 0.018)], [0.03, 0.05, 0.05]));
  add('inlet_manifold', 'Inlet manifold', inlet, 'plastic', { layer: 1, ex: [0, 0.06, -0.12], start: 0.02 });
  const thrZ = v ? 0 : -(depth / 2 + 0.045);
  const thrY = v ? deck + hc + 0.03 : intakeY + 0.04;
  add('throttle_body', 'Throttle body', [cylX([0, 0, 0], 0.06, 0.07), box([0, 0, 0], [0.01, 0.052, 0.052])], 'alu', { home: [-px - 0.03, thrY, thrZ], ex: [-0.1, 0.04, -0.08], start: 0.02 });
  const exhaust: EPrim[] = v ? banks.map((bt) => inBank(box([0, deck * 0.9, depth / 2 + 0.035], [len * 0.84, 0.08, 0.05]), bt)) : [box([0, intakeY, depth / 2 + 0.035], [len * 0.86, 0.075, 0.05])];
  if (!v) for (let i = 0; i < cyl; i++) exhaust.push(box([m.cylX[i]!, intakeY - 0.002, depth / 2 + 0.015], [0.034, 0.06, 0.04]));
  exhaust.push(cylY([px * 0.5, intakeY - 0.06, depth / 2 + 0.05], 0.05, 0.1));
  add('exhaust_manifold', 'Exhaust manifold', exhaust, 'alu', { layer: 1, ex: [0, 0.06, 0.12], start: 0.02 });
  if (m.turbo) {
    const tz = depth / 2 + 0.115;
    const tx = px * 0.25;
    const ty = intakeY - 0.03;
    add('turbo', 'Turbo', [sph([tx, ty, tz], 0.12), cylZ([tx, ty, tz + 0.065], 0.06, 0.07), cylZ([tx, ty, tz - 0.05], 0.07, 0.04)], 'alu', { layer: 1, ex: [0, 0.1, 0.16], start: 0.02 });
    const hi = deck + hc + 0.115;
    add('intercooler_pipe', 'Intercooler pipe', pipe([[tx, ty, tz + 0.1], [tx, ty, tz + 0.17], [-px - 0.03, ty, tz + 0.17], [-px - 0.03, hi, tz + 0.17], [-px - 0.03, hi, thrZ], [-px - 0.03, thrY + 0.03, thrZ]], 0.04), 'hose', { layer: 1, ex: [0, 0.02, 0.2], start: 0.02 });
  }
  if (!petrol) add('fuel_rail', 'Fuel rail', [box([0, deck + hc + 0.055, -0.03], [len * 0.9, 0.022, 0.022]), box([-len * 0.45 - 0.03, deck + hc + 0.05, -0.04], [0.06, 0.016, 0.016])], 'steel', { layer: 1, ex: [0, 0.34, -0.02] });

  // ---- the end with the belts (+X): the timing belt or chain on its sprockets and tensioner, then the drive belt with its machines
  const xt = xa + 0.016;
  const crankC: Circle = { u: 0, v: 0, r: 0.015 };
  const tens: Circle = { u: 0.075, v: camY * 0.5, r: 0.016 };
  const tw = m.chain ? 0.014 : 0.02;
  const spin = (id: PartId, inst: string, x: number, c: Circle, w: number, ratio: number, mat: MatKey, layer: 1 | 2 | 3 | 4, ex: V3, start: number) =>
    add(id, inst, pulley(0, 0, 0, c.r, w), mat, { home: [x, c.v, c.u], motion: { k: 'spin', ratio }, layer, ex, start });
  add('timing_belt', m.chain ? 'Timing chain' : 'Timing belt', beltLoop(xt, [crankC, ...camCircles, tens], tw, m.chain ? 0.006 : 0.004), m.chain ? 'steel' : 'rubber', { layer: 2, ex: [0.14, 0, 0], start: 0.1 });
  spin('crankshaft', 'Crank sprocket', xt, crankC, tw + 0.004, 1, 'alloy', 2, [0.14, 0, 0], 0.1);
  camCircles.forEach((c, i) => spin('camshaft', `Cam sprocket ${i + 1}`, xt, c, tw + 0.004, RATIOS.cam, 'alloy', 2, [0.14, 0, 0], 0.1));
  spin('timing_tensioner', 'Timing tensioner', xt, tens, tw + 0.004, crankC.r / tens.r, 'steel', 2, [0.14, 0.03, 0.06], 0.1);
  // the drive belt's pulleys, each at its ratio to the crank (the crank pulley is 55 mm, the alternator 25 mm...)
  const xd = xt + 0.04;
  const cR = 0.055;
  const alt: Circle = { u: -0.115, v: 0.065, r: 0.027 };
  const pump: Circle = { u: -0.05, v: 0.135, r: 0.036 };
  const ac: Circle = { u: 0.115, v: -0.045, r: 0.05 };
  const tn: Circle = { u: 0.082, v: 0.075, r: 0.02 };
  const auxC: Circle = { u: 0, v: 0, r: cR };
  add('drive_belt', 'Drive belt', beltLoop(xd, [auxC, alt, pump, tn, ac], 0.022, 0.005), 'rubber', { layer: 2, ex: [0.18, 0, 0], start: 0.1 });
  spin('crankshaft', 'Crank pulley', xd, auxC, 0.026, 1, 'alloy', 2, [0.18, 0, 0], 0.1);
  spin('drive_belt', 'Drive belt tensioner', xd, tn, 0.026, cR / tn.r, 'steel', 2, [0.18, 0.03, 0.03], 0.1);
  add('alternator', 'Alternator', [cylX([xd - 0.05, alt.v, alt.u], 0.1, 0.1)], 'alu', { ex: [0.2, 0.03, -0.06], start: 0.1 });
  spin('alternator', 'Alternator pulley', xd, alt, 0.026, RATIOS.alternator, 'alloy', 4, [0.2, 0.03, -0.06], 0.1);
  add('water_pump', 'Water pump', [cylX([xd - 0.03, pump.v, pump.u], 0.08, 0.05)], 'alu', { ex: [0.2, 0.06, 0], start: 0.1 });
  spin('water_pump', 'Water pump pulley', xd, pump, 0.026, RATIOS.pump, 'alloy', 4, [0.2, 0.06, 0], 0.1);
  add('aircon_compressor', 'Aircon compressor', [cylX([xd - 0.06, ac.v, ac.u], 0.12, 0.12)], 'steel', { ex: [0.2, -0.04, 0.06], start: 0.1 });
  spin('aircon_compressor', 'Aircon pulley', xd, ac, 0.026, RATIOS.aircon, 'alloy', 4, [0.2, -0.04, 0.06], 0.1);
  add('thermostat', 'Thermostat', pipe([[xd - 0.02, pump.v + 0.01, pump.u + 0.07], [xd - 0.02, pump.v + 0.02, pump.u + 0.14]], 0.03), 'alu', { ex: [0.12, 0.1, 0.05], start: 0.12 });
  // ---- the oil filter on the block's face, the starter at the gearbox end
  add('oil_filter', 'Oil filter', [cylZ([xa * 0.45, bottom * 0.2 + 0.02, -(depth / 2 + 0.05)], 0.076, 0.1), box([xa * 0.45, bottom * 0.2 + 0.02, -(depth / 2 + 0.005)], [0.09, 0.09, 0.012])], 'blue', { ex: [0, -0.02, -0.12], start: 0.08 });
  add('starter', 'Starter motor', [cylX([-(xa + 0.1), -0.045, depth / 2 + 0.02], 0.08, 0.14), box([-(xa + 0.17), -0.045, depth / 2 + 0.02], [0.04, 0.06, 0.07])], 'steel', { ex: [-0.12, -0.05, 0.12], start: 0.1 });
  // ---- the channels, drawn only in the cutaway
  const oil: EPrim[] = [cylX([0, -0.002, 0], 0.012, len)];
  const water: EPrim[] = [cylX([0, deck * 0.9, b * 0.6], 0.012, len)];
  if (!v) {
    for (let i = 0; i < cyl; i++) {
      oil.push(cylY([m.cylX[i]!, deck * 0.45, 0.0], 0.008, deck * 0.9));
      water.push(cylY([m.cylX[i]!, deck * 0.6, b * 0.57], 0.012, deck * 0.7), cylY([m.cylX[i]!, deck * 0.6, -b * 0.57], 0.012, deck * 0.7));
    }
  }
  add('oil_passages', 'Oil channels', oil, 'yellow', { passage: true });
  add('coolant_passages', 'Coolant channels', water, 'pink', { passage: true });
  return out;
}

const bore2 = (b: number) => b * 1.18;

function electricPieces(m: EngineModel): Piece[] {
  const out: Piece[] = [];
  const add = collector(out);
  const L = 0.32;
  add('motor', 'Motor housing', [cylX([0, 0.13, 0], 0.27, L), cylX([-L / 2 - 0.02, 0.13, 0], 0.2, 0.04)], 'alu', { shell: true, ex: [0, 0, 0] });
  const fins: EPrim[] = [cylX([0, 0.13, 0], 0.1, L * 0.94)];
  for (let k = 0; k < 8; k++) fins.push(box([0, 0.13 + 0.095 * Math.cos((k * Math.PI) / 4), 0.095 * Math.sin((k * Math.PI) / 4)], [L * 0.86, 0.04, 0.03], [(k * Math.PI) / 4, 0, 0]));
  add('motor', 'Motor rotor', fins, 'steel', { motion: { k: 'spin', ratio: 1 }, home: [0, 0.13, 0], layer: 3, ex: [0.16, 0, 0], start: 0.2 });
  out[out.length - 1]!.prims = out[out.length - 1]!.prims.map((p) => ({ ...p, c: [p.c[0], p.c[1] - 0.13, p.c[2]] as V3 }));
  add('inverter', 'Inverter', [box([0, 0.34, 0.0], [0.3, 0.1, 0.22]), box([0.0, 0.4, 0], [0.26, 0.02, 0.18]), cylY([0.16, 0.3, 0.06], 0.026, 0.14)], 'trim', { layer: 1, ex: [0, 0.2, 0], start: 0 });
  add('charger', 'On-board charger', [box([-0.04, 0.12, 0.25], [0.26, 0.1, 0.12]), box([-0.04, 0.18, 0.25], [0.22, 0.014, 0.1])], 'alu', { layer: 1, ex: [0, 0.05, 0.14], start: 0.05 });
  add('coolant_loop', 'Coolant loop', [cylZ([0.14, 0.13, -0.19], 0.026, 0.2), cylX([0.15, 0.13, -0.29], 0.026, 0.3), cylY([0.15, 0.25, -0.29], 0.026, 0.25), box([0.0, 0.07, -0.29], [0.22, 0.04, 0.05])], 'pink', { layer: 1, ex: [0.12, 0, -0.15], start: 0.05 });
  add('engine_cover', 'Motor cover', [box([0, 0.5, 0], [0.34, 0.025, 0.26])], 'plastic', { cover: true, ex: [0, 0.45, 0], start: 0 });
  void m;
  return out;
}

/** A hybrid's electric motor and inverter, beside the engine at the gearbox end. */
function hybridPieces(m: EngineModel, half: number): Piece[] {
  const out: Piece[] = [];
  const add = collector(out);
  const x = -(half + m.bore * 0.6 + 0.13);
  add('motor', 'Motor housing', [cylX([x, 0, 0], 0.22, 0.07)], 'alu', { shell: true });
  add('motor', 'Motor rotor', [cylX([0, 0, 0], 0.17, 0.08), box([0, 0.075, 0], [0.085, 0.03, 0.02])], 'steel', { motion: { k: 'spin', ratio: 1 }, home: [x, 0, 0], layer: 3, ex: [-0.12, 0, 0], start: 0.2 });
  add('inverter', 'Inverter', [box([x, 0.17, -0.1], [0.18, 0.07, 0.13]), cylY([x + 0.07, 0.12, -0.1], 0.024, 0.08)], 'trim', { layer: 1, ex: [-0.04, 0.2, 0], start: 0 });
  return out;
}

// ---------------------------------------------------------------- the motion

/** Where a piston's pin is along its cylinder's axis from the crank's axis, metres, at crank angle θ (degrees): the rod's geometry, not a sine. */
export function pistonS(m: Pick<EngineModel, 'stroke' | 'rod' | 'fire'>, i: number, theta: number): number {
  const r = m.stroke / 2;
  const phi = rad(theta - m.fire[i]!);
  return r * Math.cos(phi) + Math.sqrt(m.rod * m.rod - r * r * Math.sin(phi) * Math.sin(phi));
}
/** The piston's height above its bottom dead centre, metres: 0 at the bottom of the stroke, the stroke at the top. */
export function pistonRise(m: Pick<EngineModel, 'stroke' | 'rod' | 'fire'>, i: number, theta: number): number {
  return pistonS(m, i, theta) - (m.rod - m.stroke / 2);
}

export type Stroke = 'POWER' | 'EXHAUST' | 'INTAKE' | 'COMPRESSION';
export const STROKES: Stroke[] = ['INTAKE', 'COMPRESSION', 'POWER', 'EXHAUST'];
/** Where cylinder i is in its 720° cycle at crank angle θ: 0 is the start of its power stroke. */
export const cycleAt = (m: Pick<EngineModel, 'fire'>, i: number, theta: number) => mod(theta - m.fire[i]!, 720);
export function strokeAt(m: Pick<EngineModel, 'fire'>, i: number, theta: number): Stroke {
  const c = cycleAt(m, i, theta);
  return c < 180 ? 'POWER' : c < 360 ? 'EXHAUST' : c < 540 ? 'INTAKE' : 'COMPRESSION';
}

/** The cam profile: how far a valve is open (metres) at a cylinder's cycle angle c. The inlet opens 15° before the exhaust stroke ends and closes 45° after the bottom; the exhaust opens 45° before the bottom and closes 15° after the top: 30° of overlap at exhaust TDC (c = 360). */
export const VALVE = { intake: { open: 345, dur: 240, lift: 0.0095 }, exhaust: { open: 135, dur: 240, lift: 0.0085 } };
export function valveLift(intake: boolean, c: number): number {
  const v = intake ? VALVE.intake : VALVE.exhaust;
  const k = (mod(c, 720) - v.open) / v.dur;
  return k >= 0 && k <= 1 ? v.lift * Math.sin(Math.PI * k) * Math.sin(Math.PI * k) : 0;
}

/** The belts' ratios to the crank: the cams at half, the alternator by its smaller pulley, and so on ("typical"). */
export const RATIOS = { cam: 0.5, alternator: 0.055 / 0.027, pump: 0.055 / 0.036, aircon: 0.055 / 0.05 };

export interface Pose {
  pos: V3;
  rx: number;
}
/** Where a piece is at crank angle θ (degrees), before TAKE APART moves it. */
export function poseOf(m: EngineModel, p: Piece, theta: number): Pose {
  const mo = p.motion;
  switch (mo.k) {
    case 'spin':
      return { pos: p.home, rx: p.rx0 + mo.ratio * rad(theta) };
    case 'piston': {
      const s = pistonS(m, mo.i, theta);
      const b = m.beta[mo.i]!;
      return { pos: [m.cylX[mo.i]!, s * Math.cos(b), s * Math.sin(b)], rx: b };
    }
    case 'rod': {
      const r = m.stroke / 2;
      const a = rad(theta + m.pin[mo.i]!);
      const py = r * Math.cos(a);
      const pz = r * Math.sin(a);
      const s = pistonS(m, mo.i, theta);
      const b = m.beta[mo.i]!;
      return { pos: [m.cylX[mo.i]!, py, pz], rx: Math.atan2(s * Math.sin(b) - pz, s * Math.cos(b) - py) };
    }
    case 'valve': {
      const lift = valveLift(mo.intake, cycleAt(m, mo.i, theta));
      const b = m.beta[mo.i]!;
      return { pos: [m.cylX[mo.i]!, -lift * Math.cos(b), -lift * Math.sin(b)], rx: b };
    }
    default:
      return { pos: p.home, rx: p.rx0 };
  }
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
/** How far a piece has flown at TAKE APART t (0–1): its own start, then out. */
export function flown(p: Piece, t: number): number {
  return ease(Math.max(0, Math.min(1, (t - p.start) / (1 - p.start || 1))));
}

/** The cylinder on its power stroke at θ (1-based); with the crank's quarter turns this goes round in the firing order. */
export function powerCylinders(m: Pick<EngineModel, 'fire' | 'cyl'>, theta: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < m.cyl; i++) if (cycleAt(m, i, theta) < 180) out.push(i + 1);
  return out;
}

export const firingWords = (m: Pick<EngineModel, 'firing'>) => m.firing.join('-');

export const STROKE_WORDS: Record<Stroke, (diesel: boolean) => string> = {
  INTAKE: () => 'the piston drops and pulls fresh air in',
  COMPRESSION: () => 'the piston rises and squeezes it',
  POWER: (d) => (d ? 'the squeezed air is so hot the fuel lights itself, and the push turns the crank' : 'the spark lights the fuel, and the push turns the crank'),
  EXHAUST: () => 'the piston rises and pushes the burnt gas out',
};

// ---------------------------------------------------------------- the envelope, the bay, the numbers

const corners = (p: EPrim): V3[] => {
  const [hx, hy, hz] = [p.s[0] / 2, p.s[1] / 2, p.s[2] / 2];
  const [rx, ry, rz] = p.r ?? [0, 0, 0];
  const out: V3[] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
    let v: V3 = [a * hx, b * hy, c * hz];
    // three's XYZ order: R = Rx Ry Rz, so Rz first
    v = [v[0] * Math.cos(rz) - v[1] * Math.sin(rz), v[0] * Math.sin(rz) + v[1] * Math.cos(rz), v[2]];
    v = [v[0] * Math.cos(ry) + v[2] * Math.sin(ry), v[1], -v[0] * Math.sin(ry) + v[2] * Math.cos(ry)];
    v = rotX(v, rx);
    out.push([v[0] + p.c[0], v[1] + p.c[1], v[2] + p.c[2]]);
  }
  return out;
};

/** The box a model fills over four crank angles, in its own frame (spheres and cylinders by their bounding boxes). */
function envelope(m: EngineModel): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const th of [0, 90, 180, 270]) {
    for (const p of m.pieces) {
      if (p.passage) continue;
      const pose = poseOf(m, p, th);
      for (const pr of p.prims) for (const c of corners(pr)) {
        const q = rotX(c, pose.rx);
        for (let a = 0; a < 3; a++) {
          const w = q[a]! + pose.pos[a]!;
          min[a] = Math.min(min[a]!, w);
          max[a] = Math.max(max[a]!, w);
        }
      }
    }
  }
  return { min, max };
}

export const SUMP_WELL = 0.13;

export interface BayBox {
  front: number;
  rear: number;
  halfW: number;
  floor: number;
  top: number;
}
export interface Placement {
  /** Where the engine's origin (the crank's axis, middle) stands in the car's frame; the turn about Y; the scale (1 unless the bay is too small). */
  at: V3;
  turnY: number;
  scale: number;
  /** The engine's box in the car's frame. */
  min: V3;
  max: V3;
}

/** The engine in the bay: across the bay (the crank along the car's width) except a straight six, which lies along the car; the sump hangs below the bay's floor line as on real cars; shrunk only if the bay is too small to hold it. */
export function placeInBay(m: EngineModel, bay: BayBox): Placement {
  const longitudinal = m.layout === 'I6';
  const turnY = longitudinal ? 0 : -Math.PI / 2;
  // the box in the car's frame at scale 1, before moving it
  const [a, b] = [m.box.min, m.box.max];
  const x: [number, number] = longitudinal ? [a[0], b[0]] : [-b[2], -a[2]];
  const z: [number, number] = longitudinal ? [a[2], b[2]] : [a[0], b[0]];
  const y: [number, number] = [a[1], b[1]];
  const wx = x[1] - x[0];
  const wy = y[1] - y[0];
  const wz = z[1] - z[0];
  const len = bay.front - bay.rear;
  const availX = len - 0.08;
  const availZ = bay.halfW * 2 - 0.04;
  const availY = bay.top - 0.02 - (bay.floor - SUMP_WELL);
  const scale = Math.min(1, availX / wx, availZ / wz, availY / wy);
  const cx = bay.rear + 0.47 * len;
  const cz = -0.08 * bay.halfW;
  const px = cx - ((x[0] + x[1]) / 2) * scale;
  const pz = cz - ((z[0] + z[1]) / 2) * scale;
  const py = bay.floor - SUMP_WELL - y[0] * scale;
  return { at: [px, py, pz], turnY, scale, min: [px + x[0] * scale, py + y[0] * scale, pz + z[0] * scale], max: [px + x[1] * scale, py + y[1] * scale, pz + z[1] * scale] };
}

/** A point of the engine's frame in the car's frame. */
export function toCar(p: V3, pl: Placement): V3 {
  const t = pl.turnY;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const q: V3 = [(p[0] * c + p[2] * s) * pl.scale, p[1] * pl.scale, (-p[0] * s + p[2] * c) * pl.scale];
  return [q[0] + pl.at[0], q[1] + pl.at[1], q[2] + pl.at[2]];
}

const mm = (v: number) => `${Math.round(v * 1000)} mm`;
const litres = (cc: number) => `${(cc / 1000).toFixed(1)} litres`;
const fromWhere = (m: EngineModel) => (m.ccFrom === 'record' ? 'from the MOT record' : 'typical for this size');

/** The numbers of a part of this engine, each with its word (estimate, typical or from the MOT record). */
export function numbersFor(m: EngineModel, id: PartId): string[] {
  const cc = `Displacement ${litres(m.cc)}, ${fromWhere(m)}`;
  const layout = m.electric ? '' : `${NUMBER_WORDS[m.cyl]![0]!.toUpperCase()}${NUMBER_WORDS[m.cyl]!.slice(1)} cylinders${m.layout.startsWith('V') ? ' in a vee' : ' in line'}, typical for this car`;
  const boreL = `Bore ${mm(m.bore)}, an estimate`;
  const strokeL = `Stroke ${mm(m.stroke)}, an estimate`;
  switch (id) {
    case 'block':
      return m.electric ? [] : [layout, cc, boreL, strokeL];
    case 'head':
    case 'head_gasket':
      return [`Compression ratio ${m.comp.toFixed(1)} to 1, typical${m.diesel ? ' for a diesel' : ''}`, boreL];
    case 'piston':
    case 'piston_rings':
      return [boreL, strokeL, `Compression ratio ${m.comp.toFixed(1)} to 1, typical`];
    case 'con_rod':
      return [`Length ${mm(m.rod)} between its holes, an estimate`, `Rod length to crank radius ${(m.rod / (m.stroke / 2)).toFixed(1)}, typical`];
    case 'crankshaft':
      return [strokeL, m.firing.length ? `Firing order ${firingWords(m)}, typical for this layout` : ''].filter(Boolean);
    case 'flywheel':
      return ['Width about 230 mm, an estimate'];
    case 'camshaft':
      return [`Turns at half the crank's speed, typical`, m.cams >= 2 ? 'Two camshafts, typical' : 'One camshaft, typical for an older small engine'];
    case 'inlet_valve':
      return [`Opens up to ${mm(VALVE.intake.lift)}, an estimate`, 'Opens 15° before the top and closes 45° after the bottom, typical'];
    case 'exhaust_valve':
      return [`Opens up to ${mm(VALVE.exhaust.lift)}, an estimate`, 'Opens 45° before the bottom and closes 15° after the top, typical'];
    case 'valve_spring':
      return ['Drawn one per valve; most engines have two inlet and two exhaust valves a cylinder, typical'];
    case 'timing_belt':
      return [m.chain ? 'A chain: made to last the engine; a rattle on a cold start means it is stretching, typical' : 'Change about every 5 years or 60,000 miles, typical', m.chain ? 'Made by this maker as a chain, typical' : 'A rubber belt for this maker, typical'];
    case 'timing_tensioner':
      return ['Changed with the belt, typical'];
    case 'plugs':
      return ['Gap about 0.8 mm, typical', 'Changed about every 40,000 miles, typical'];
    case 'coils':
      return ['One coil to each plug, typical'];
    case 'injectors':
      return ['One injector a cylinder, typical', 'Pressure about 1,600 bar in a diesel common rail, typical'];
    case 'turbo':
      return ['Spins at up to about 150,000 rpm, typical'];
    case 'oil_pump':
    case 'oil_filter':
    case 'oil_passages':
      return ['Oil pressure about 3 bar when warm at 2,000 rpm, typical'];
    case 'water_pump':
    case 'coolant_passages':
    case 'thermostat':
      return ['Opens at about 90 °C, typical'];
    case 'alternator':
      return [`Turns about ${RATIOS.alternator.toFixed(1)} times for every turn of the crank, typical`, 'Charges at about 14 volts, typical'];
    case 'drive_belt':
      return ['Change about every 5 years, typical'];
    case 'motor':
    case 'inverter':
    case 'charger':
      return ['Sizes and power for this car are an estimate'];
    default:
      return [];
  }
}

/** A part's name for this engine (a chain or a belt; a motor), else its sheet's. */
export function nameFor(m: EngineModel, id: PartId): string {
  if (id === 'timing_belt') return m.chain ? 'Timing chain' : 'Timing belt';
  if (id === 'engine_cover' && m.electric) return 'Motor (under its cover)';
  return PARTS[id].name;
}

/** The part count by id for a model (an instance counts once each), and the list of ids it uses. */
export function idsOf(m: EngineModel): PartId[] {
  return [...new Set(m.pieces.map((p) => p.id))];
}

/** The ids the working engine owns in the bay (the bay's build table gets them from it). */
export type EngineId = BayId;

/** What an engine part says for itself, in a line or two: the "what is this?" answer with no model (the sheet, then its numbers). */
export function partWords(m: EngineModel | null, id: PartId, inst = ''): string {
  const sheet = PARTS[id];
  const name = inst || (m ? nameFor(m, id) : sheet.name);
  const nums = m ? numbersFor(m, id) : [];
  return `${name}: ${sheet.what}${nums.length ? ` ${nums.join('. ')}.` : ''}`;
}
