/**
 * THE WORKBENCH's tool (OWNER-ISSUES 61b): `estimate`, one tool in its own group `workbench`, on by his words, never always
 * (the plain turn only names it: "workbench: estimate", paid for in prompt.ts). It runs the shared solvers
 * (packages/shared/src/workbench) on his problem — read from his own words, with any field the model sets as text with its
 * unit — and returns `estimateText`: the numbers, the method, what it assumed, what would change it, the confidence and the
 * caveat. No model, no fetch, nothing that can bill him; every number a first estimate, never certified.
 */
import { estimateText, kindOf, parseProblem, parseQuantity, solve, WORK_KINDS, type QtyKind, type WorkKind } from '../../../../packages/shared/src/workbench';
import { zoneOf } from '../guardstate';
import { loadPlaces } from '../places';
import { fromZoned, zoned } from '../time';
import type { Tool } from './types';

/** The group's line for the model, and when its tool is described in full (his words: never always). */
export const WORKBENCH_ABOUT = 'You can give first engineering estimates from your own formulae (estimate): beams, gears, engines, wings, cars, orbits, heat loss, sun and shadow, circuits — never certified; pass on its last line.';
export const WORKBENCH_WHEN = /\b(?:beams?|joists?|lintels?|deflect\w*|cantilever\w*|spans?|load[- ]bearing|gear ?ratios?|gearbox|teeth|rpm|torque|bhp|horse ?power|engines?|compression ratio|aero ?foils?|air ?foils?|naca|wings?|lift|drag|downforce|wind tunnel|terminal velocity|projectiles?|trajector\w*|orbits?|escape velocity|hohmann|u-?values?|heat loss|insulation|radiators?|shadows?|sun angle|resistors?|ohms?|voltage divider|kwh|buckl\w*)\b/i;

/** A field the model may set, as text with its unit ("3 m", "5 kN") or a bare number in the unit named here. */
const FIELDS: Record<string, [QtyKind, string]> = {
  span: ['length', 'm'], at: ['length', 'm'], length: ['length', 'm'], load: ['force', 'kN'], udl: ['lineload', 'kN/m'],
  b: ['length', 'mm'], h: ['length', 'mm'], d: ['length', 'mm'], t: ['length', 'mm'], tw: ['length', 'mm'], tf: ['length', 'mm'],
  rpm: ['rpm', 'rpm'], torque: ['torque', 'Nm'], displacement: ['volume', 'L'], power: ['power', 'kW'],
  speed: ['speed', 'm/s'], alpha: ['angle', '°'], angle: ['angle', '°'], area: ['area', 'm²'], altitude: ['length', 'm'], to: ['length', 'km'],
  height: ['length', 'm'], mass: ['mass', 'kg'], floor: ['area', 'm²'], wall: ['area', 'm²'], window: ['area', 'm²'],
  inside: ['temperature', '°C'], outside: ['temperature', '°C'],
  v: ['voltage', 'V'], vin: ['voltage', 'V'], vout: ['voltage', 'V'], supply: ['voltage', 'V'], vf: ['voltage', 'V'], i: ['current', 'A'], current: ['current', 'A'],
  r: ['resistance', 'Ω'], r1: ['resistance', 'Ω'], r2: ['resistance', 'Ω'], c: ['capacitance', 'F'], watts: ['power', 'W'],
};
/** Plain words and numbers taken as they are. */
const PLAIN = ['support', 'material', 'shape', 'ends', 'type', 'naca', 'body', 'mode', 'fuel', 'cd', 'cr', 'chainring', 'sprocket', 'hours', 'tariff', 'ach', 'lat', 'lon'];

function field(v: unknown, [kind, unit]: [QtyKind, string]): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return parseQuantity(String(v), kind, unit)?.si;
  if (typeof v === 'string' && v.trim()) return parseQuantity(v, kind, unit)?.si;
  return undefined;
}

/** The inputs: his words first, then whatever the model set itself (a field it set wins). */
export function inputsOf(kind: WorkKind, a: Record<string, unknown>): Record<string, unknown> {
  const words = typeof a.words === 'string' ? a.words : '';
  const inputs: Record<string, unknown> = { ...(words ? parseProblem(words, kind)?.inputs ?? {} : {}) };
  for (const [k, spec] of Object.entries(FIELDS)) {
    const x = field(a[k], spec);
    if (x != null) inputs[k] = x;
  }
  for (const k of PLAIN) if (a[k] != null && a[k] !== '') inputs[k] = typeof a[k] === 'string' ? (a[k] as string).trim().toLowerCase() : a[k];
  // a beam's or a column's section from its sizes
  const sec = (inputs.section ?? {}) as Record<string, unknown>;
  if (inputs.b != null || inputs.h != null || inputs.d != null) {
    const shape = inputs.shape ?? (inputs.tw != null ? 'ibeam' : inputs.t != null ? 'tube' : inputs.d != null ? 'round' : 'rect');
    inputs.section = { ...sec, shape, b: inputs.b, h: inputs.h, d: inputs.d, t: inputs.t, tw: inputs.tw, tf: inputs.tf };
  }
  if (typeof a.teeth === 'string' && a.teeth.trim()) {
    const g = parseProblem(`gears ${a.teeth}`, 'gears');
    if (g?.inputs.stages) inputs.stages = g.inputs.stages;
  }
  if (Array.isArray(a.layers)) inputs.layers = a.layers;
  if (typeof a.layers === 'string') {
    const h = parseProblem(`u-value ${a.layers}`, 'heat');
    if (h?.inputs.layers) inputs.layers = h.inputs.layers;
  }
  if (Array.isArray(a.rs)) inputs.rs = (a.rs as unknown[]).map((x) => field(x, ['resistance', 'Ω']) ?? NaN);
  return inputs;
}

/** The sun's date and time from his words ("15:00", "12-21") in his zone, and his saved home when no place is given. */
async function sunInputs(inputs: Record<string, unknown>, storage: DurableObjectStorage): Promise<Record<string, unknown>> {
  const tz = await zoneOf(storage);
  const out: Record<string, unknown> = { ...inputs, tz };
  const now = Date.now();
  const z = zoned(now, tz);
  const date = typeof inputs.date === 'string' ? /^(\d\d)-(\d\d)$/.exec(inputs.date) : null;
  const time = typeof inputs.time === 'string' ? (inputs.time === 'noon' ? ['', '12', '00'] : /^(\d\d):(\d\d)$/.exec(inputs.time)) : null;
  if (date || time) {
    const m = date ? Number(date[1]) : z.m;
    const d = date ? Number(date[2]) : z.d;
    out.at = fromZoned(z.y, m, d, time ? Number(time[1]) : 12, time ? Number(time[2]) : 0, tz);
  }
  if (typeof inputs.lat !== 'number') {
    const home = (await loadPlaces(storage).catch(() => [])).find((p) => p.id === 'home');
    if (home) Object.assign(out, { lat: home.lat, lon: home.lon, place: 'his home' });
  }
  return out;
}

export const workbenchTools: Tool[] = [
  {
    name: 'estimate',
    description:
      "A first engineering estimate from the workbench's own formulae (never certified: pass on its last line as it is). kind: beam, column, gears, bike, engine, wing, car, fall (terminal velocity), projectile, orbit, heat (U-value, a room's loss), sun (angle, shadow), circuit. words: the problem in his words with numbers and units — read for you (\"3 m steel beam, 5 kN in the middle\", \"50 and 11 teeth\", \"2.0 litre turbo at 6000 rpm\", \"LED from 5 V at 20 mA\"). Optional fields, as text with units: span, load, at, udl, support simple|cantilever|fixed, material s275|s355|al6061|c24|c30, b, h; teeth \"20:60, 15:45\", rpm, torque; displacement, type na|turbo|diesel, power; area, speed, alpha, naca, cd; body earth|moon|mars, altitude, to; layers \"brick 225, plaster 13\", floor; mode ohm|resistors|divider|led|rc|power, v, i, r. Missing ones take a stated default.",
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: WORK_KINDS },
        words: { type: 'string', description: 'the problem in his words, with its numbers and units' },
        units: { type: 'string', enum: ['metric', 'imperial'], description: 'how to show the numbers (metric unless he uses feet, mph, lbs)' },
      },
      required: ['kind', 'words'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const words = typeof a.words === 'string' ? a.words : '';
      const asked = typeof a.kind === 'string' ? a.kind.trim().toLowerCase() : '';
      const kind = ((WORK_KINDS as string[]).includes(asked) ? asked : kindOf(words)) as WorkKind | null;
      if (!kind) return `Nothing estimated: say which kind (${WORK_KINDS.join(', ')}) and give the problem in words with its numbers.`;
      let inputs = inputsOf(kind, a);
      if (kind === 'sun') inputs = await sunInputs(inputs, ctx.storage);
      const units = a.units === 'imperial' ? 'imperial' : 'metric';
      const e = solve(kind, inputs, units);
      return `${estimateText(e)}\n\n(Answer his question from these numbers in a line or two, and end with the last line above exactly as it is.)`;
    },
  },
];
