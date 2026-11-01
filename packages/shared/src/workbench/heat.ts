/**
 * THE WORKBENCH: heat (OWNER-ISSUES 61b), pure and total. Layers of a wall (thickness and conductivity) → its U-value with
 * the standard surface resistances (BS EN ISO 6946: Rsi 0.13, Rse 0.04 m²K/W for a wall); a room's heat loss in watts per
 * kelvin and at a temperature difference (fabric plus ventilation, 0.33 W per m³ per air change); a lumped cooling time with
 * the heating off (SAP's thermal mass per m² of floor); a radiator's size from the loss (a rule of thumb, said as one); the
 * kWh and the cost at a stated tariff.
 *
 * Conductivities are typical design values (CIBSE Guide A, Table 3.x; manufacturers' declared values for insulation); a real
 * wall is measured or taken from its own data.
 */
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

export interface LayerMat {
  name: string;
  /** Conductivity W/mK (or, for an air gap, its own resistance in `R`). */
  k: number;
  R?: number;
}

/** Typical design conductivities (CIBSE Guide A; insulation at declared values). */
export const LAYER_MATS: Record<string, LayerMat> = {
  brick: { name: 'brick', k: 0.77 },
  block: { name: 'dense concrete block', k: 1.13 },
  lightblock: { name: 'lightweight block', k: 0.15 },
  stone: { name: 'stone', k: 2.3 },
  concrete: { name: 'concrete', k: 1.4 },
  plaster: { name: 'plaster', k: 0.57 },
  plasterboard: { name: 'plasterboard', k: 0.21 },
  render: { name: 'render', k: 1.0 },
  timber: { name: 'timber', k: 0.13 },
  mineralwool: { name: 'mineral wool', k: 0.037 },
  pir: { name: 'PIR board', k: 0.022 },
  eps: { name: 'EPS', k: 0.035 },
  glass: { name: 'glass', k: 1.0 },
  cavity: { name: 'unventilated cavity', k: 0, R: 0.18 },
};

const ALIASES: [RegExp, string][] = [
  [/^(?:brick(?:work)?s?|bricks)$/, 'brick'],
  [/^(?:dense )?(?:concrete )?blocks?$|^blockwork$/, 'block'],
  [/^(?:light(?:weight)? ?blocks?|thermalite|aircrete)$/, 'lightblock'],
  [/^stone$/, 'stone'],
  [/^concrete$/, 'concrete'],
  [/^plaster$/, 'plaster'],
  [/^(?:plaster ?board|drywall|gyproc)$/, 'plasterboard'],
  [/^render$/, 'render'],
  [/^(?:timber|wood|osb|ply(?:wood)?)$/, 'timber'],
  [/^(?:mineral ?wool|rock ?wool|glass ?wool|insulation|wool|loft insulation)$/, 'mineralwool'],
  [/^(?:pir|celotex|kingspan)$/, 'pir'],
  [/^(?:eps|polystyrene)$/, 'eps'],
  [/^glass$/, 'glass'],
  [/^(?:cavity|air gap|gap)$/, 'cavity'],
];

export interface Layer {
  /** A key of LAYER_MATS, or his own name with `k`. */
  mat: string;
  /** m */
  thickness: number;
  /** His own conductivity, W/mK. */
  k?: number;
}

/** "brick 225, cavity 50, block 100, plaster 13" (millimetres) → the layers; null if a word is not one it knows. */
export function layersOf(words: string): Layer[] | null {
  const parts = String(words ?? '').toLowerCase().split(/[,;+\n]|\bthen\b|\band\b/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: Layer[] = [];
  for (const p of parts) {
    const m = /^(?:(\d+(?:\.\d+)?)\s*(mm|cm|m)?\s+(?:of\s+)?([a-z][a-z ]*?)|([a-z][a-z ]*?)\s+(\d+(?:\.\d+)?)\s*(mm|cm|m)?)$/.exec(p);
    if (!m) return null;
    const name = (m[3] ?? m[4] ?? '').trim();
    const n = Number(m[1] ?? m[5]);
    const u = m[2] ?? m[6] ?? 'mm';
    const key = ALIASES.find(([re]) => re.test(name))?.[1];
    if (!key || !(n > 0)) return null;
    out.push({ mat: key, thickness: n * (u === 'm' ? 1 : u === 'cm' ? 0.01 : 0.001) });
  }
  return out;
}

export const RSI = 0.13;
export const RSE = 0.04;

/** U = 1 ÷ (Rsi + Σ thickness ÷ conductivity + Rse); null if a layer cannot be read. */
export function uValue(layers: Layer[], rsi = RSI, rse = RSE): { U: number; R: number; parts: { name: string; R: number }[] } | null {
  const parts: { name: string; R: number }[] = [];
  for (const l of layers) {
    const m = LAYER_MATS[l.mat];
    const k = l.k ?? m?.k;
    if (!(l.thickness > 0)) return null;
    if (m?.R != null && l.k == null) parts.push({ name: m.name, R: m.R });
    else if (k && k > 0) parts.push({ name: m?.name ?? l.mat, R: l.thickness / k });
    else return null;
  }
  const R = rsi + rse + parts.reduce((s, p) => s + p.R, 0);
  return { U: 1 / R, R, parts };
}

export type Fuel = 'gas' | 'electric' | 'heatpump';
const FUEL: Record<Fuel, { name: string; eff: number }> = { gas: { name: 'a gas boiler, 90 % efficient', eff: 0.9 }, electric: { name: 'electric heaters, 100 %', eff: 1 }, heatpump: { name: 'a heat pump, COP 3', eff: 3 } };
const TMP: Record<'low' | 'medium' | 'high', number> = { low: 100e3, medium: 250e3, high: 450e3 };

export interface HeatIn {
  layers?: Layer[];
  /** His own wall U-value, W/m²K (instead of the layers). */
  wallU?: number;
  /** Floor area m², ceiling height m. */
  floor?: number;
  height?: number;
  /** External wall, m² (windows included), and the windows in it. */
  wall?: number;
  window?: number;
  windowU?: number;
  /** Air changes an hour. */
  ach?: number;
  /** Inside and outside temperatures, K. */
  inside?: number;
  outside?: number;
  /** £ per kWh of fuel. */
  tariff?: number;
  fuel?: Fuel;
  mass?: 'low' | 'medium' | 'high';
}

export const HEAT_DEFAULTS = {
  layers: [{ mat: 'brick', thickness: 0.225 }, { mat: 'plaster', thickness: 0.013 }] as Layer[],
  floor: 20,
  height: 2.4,
  wall: 10,
  window: 2,
  windowU: 2.8,
  ach: 1.5,
  inside: 273.15 + 21,
  outside: 273.15 + 1,
  tariff: 0.06,
  fuel: 'gas' as Fuel,
  mass: 'medium' as const,
};

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function solveHeat(input: HeatIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Heat loss';
  const used: string[] = [];
  const D = HEAT_DEFAULTS;
  const layers = input.layers?.length ? input.layers : ok(input.wallU) ? [] : (used.push('a solid 225 mm brick wall, plastered'), D.layers);
  const u = ok(input.wallU) ? { U: input.wallU, R: 1 / input.wallU, parts: [] as { name: string; R: number }[] } : uValue(layers);
  if (!u) return problemEstimate('heat', title, 'a layer needs a thickness and a material it knows (brick, block, plaster, insulation, cavity …) or its own conductivity');
  const floor = ok(input.floor) ? input.floor : (used.push('a 20 m² room'), D.floor);
  const height = ok(input.height) ? input.height : (used.push('2.4 m ceilings'), D.height);
  const wall = ok(input.wall) ? input.wall : (used.push('one outside wall of 10 m²'), D.wall);
  const win = fin(input.window) && input.window >= 0 ? input.window : (used.push('a 2 m² window in it'), D.window);
  const winU = ok(input.windowU) ? input.windowU : (used.push('older double glazing, U 2.8'), D.windowU);
  const ach = fin(input.ach) && input.ach >= 0 ? input.ach : (used.push('1.5 air changes an hour'), D.ach);
  const tin = fin(input.inside) ? input.inside : (used.push(`${show(D.inside, 'temperature', system)} inside`), D.inside);
  const tout = fin(input.outside) ? input.outside : (used.push(`${show(D.outside, 'temperature', system)} outside`), D.outside);
  const tariff = ok(input.tariff) ? input.tariff : (used.push('gas at 6p a kWh (put in your own tariff)'), D.tariff);
  const fuel = input.fuel && FUEL[input.fuel] ? input.fuel : D.fuel;
  const mass = input.mass && TMP[input.mass] ? input.mass : D.mass;
  if (win > wall) return problemEstimate('heat', title, 'the window is bigger than the wall it is in');
  if (floor > 2000 || height > 20) return problemEstimate('heat', title, 'that is a hall, not a room: this is for rooms up to 2,000 m²');
  const dT = tin - tout;
  if (dT <= 0) return problemEstimate('heat', title, 'it is as warm outside as in: there is no heat loss to work out');
  const V = floor * height;
  const fabric = (wall - win) * u.U + win * winU;
  const vent = 0.33 * ach * V;
  const H = fabric + vent;
  const W = H * dT;
  const rad = W * 1.1;
  const kwhDay = (W * 24) / 1000;
  const f = FUEL[fuel];
  const cost = (kwhDay / f.eff) * tariff;
  const C = TMP[mass] * floor;
  const tau = C / H;
  const drop = Math.min(3, dT * 0.9);
  const coolTime = tau * Math.log(dT / (dT - drop));
  const money = (x: number) => (x < 1 ? `${num(x * 100, 2)}p` : `£${x.toFixed(2)}`);
  const lines: EstLine[] = [
    { label: 'Heat loss', value: `${num(W, 3)} W`, note: `at ${show(dT, 'deltaT', system)} inside to out` },
    { label: 'Per degree', value: `${num(H, 3)} W/K`, note: `walls and windows ${num(fabric, 3)}, air ${num(vent, 3)}` },
    { label: 'Wall U-value', value: `${num(u.U, 3)} W/m²K`, note: u.parts.length ? u.parts.map((p) => `${p.name} ${num(p.R, 2)}`).join(', ') + ` m²K/W + surfaces ${num(RSI + RSE, 2)}` : 'as given' },
    { label: 'Radiator to fit', value: `${num(rad, 3)} W`, note: 'the loss + 10 %, at the catalogue ΔT50; a heat pump’s ΔT30 needs about twice the radiator' },
    { label: 'Energy on a day like this', value: `${num(kwhDay, 3)} kWh`, note: 'if it held for 24 hours' },
    { label: 'Cost on a day like this', value: money(cost), note: `${f.name}, at ${money(tariff)} a kWh` },
    { label: `Cools ${num(drop, 2)} K with the heating off`, value: coolTime < 3600 ? `${num(coolTime / 60, 2)} min` : `${num(coolTime / 3600, 2)} h`, note: `${mass} thermal mass` },
  ];
  return {
    kind: 'heat',
    title: `${title}: a ${num(floor, 3)} m² room`,
    lines,
    assumptions: [
      ...used,
      `surface resistances ${RSI} inside and ${RSE} outside (BS EN ISO 6946)`,
      'heat lost only through the one outside wall, its window and the air: floors, roofs and party walls left out',
      `ventilation at 0.33 W per m³ per air change; ${mass} thermal mass (SAP: ${num(TMP[mass] / 1000, 3)} kJ/m²K of floor)`,
      'steady state: no sun, no people, no cooking',
    ],
    method: 'U = 1 ÷ (Rsi + Σ d/λ + Rse); loss = (Σ U·A + 0.33·n·V) × ΔT; cooling time = (C ÷ H) · ln(ΔT ÷ (ΔT − drop))',
    confidence: used.length ? 'fair' : 'good',
    changes: [
      '100 mm of wall insulation cuts a solid brick wall’s loss by about three quarters',
      'draughts: each extra air change an hour adds a third of a watt per m³ per degree',
      'a colder night raises the loss in proportion to the temperature difference',
    ],
    caveat: caveatFor('heat'),
    values: { U: u.U, H, fabric, vent, loss: W, radiator: rad, kwhDay, cost, tau, coolTime, V },
  };
}
