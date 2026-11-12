/**
 * A FORMULA RUNS (BRIEF-SHOW-ME-1): a workbench problem in his words (a throw, a fall, an orbit) solved by the shared solver
 * (packages/shared/src/workbench), and its path stepped for the Stage to run. The numbers are the solver's; the drawn path is the
 * same physics stepped at small time steps. A first estimate, never certified, said on the picture. Pure.
 */
import { PROJECTILE_DEFAULTS, parseProblem, solve, type Estimate, type Problem } from '../../../../packages/shared/src/workbench';

export interface Sim {
  kind: 'projectile' | 'fall' | 'orbit';
  title: string;
  /** Up to four lines of the solver's own words: label, value. */
  lines: { label: string; value: string }[];
  /** The path in the picture's own units (x right, y up), at least two points, from the start to the end. */
  path: { x: number; y: number }[];
  /** What the axes are, in words. */
  axes: { x: string; y: string };
  /** The seconds the real thing takes, and the seconds the picture takes to run it (never slower than the real thing). */
  seconds: number;
  caveat: string;
  /** The solver's numbers, for the checks. */
  values: Record<string, number>;
  /** What the solver was given (his numbers, and nothing the dials have not shown), for the dials to move. */
  inputs: Record<string, unknown>;
}

/** A variable he can turn: its words, unit, range, and how the solver reads it (`to`/`from` map the dial's number to the solver's). */
export interface Dial {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** The dial's number now, in its own unit. */
  value: number;
  to: (v: number) => number;
}

/** The variables of this formula as dials, set where the solver now stands. */
export function dialsOf(sim: Sim): Dial[] {
  const i = sim.inputs;
  const num = (k: string, d: number) => (typeof i[k] === 'number' ? (i[k] as number) : d);
  if (sim.kind === 'projectile')
    return [
      { key: 'speed', label: 'Speed', unit: 'm/s', min: 1, max: 100, step: 1, value: Math.round(num('speed', PROJECTILE_DEFAULTS.speed)), to: (v) => v },
      { key: 'angle', label: 'Angle', unit: '°', min: 5, max: 85, step: 1, value: Math.round((num('angle', PROJECTILE_DEFAULTS.angle) * 180) / Math.PI), to: (v) => (v * Math.PI) / 180 },
      { key: 'height', label: 'Starts at', unit: 'm up', min: 0, max: 50, step: 1, value: Math.round(num('height', 0)), to: (v) => v },
    ];
  if (sim.kind === 'orbit') return [{ key: 'altitude', label: 'Height', unit: 'km up', min: 200, max: 36000, step: 100, value: Math.round(num('altitude', 420_000) / 1000), to: (v) => v * 1000 }];
  return [{ key: 'mass', label: 'Mass', unit: 'kg', min: 1, max: 200, step: 1, value: Math.round(num('mass', 80)), to: (v) => v }];
}

/** The same formula with one dial moved: solved again, its path stepped again. null when the solver has no answer there. */
export function simWith(sim: Sim, key: string, v: number): Sim | null {
  const dial = dialsOf(sim).find((d) => d.key === key);
  if (!dial) return null;
  return simOf(sim.kind, { ...sim.inputs, [key]: dial.to(v) });
}

const G = 9.80665;

function projectilePath(e: Estimate, inputs: Record<string, unknown>): { x: number; y: number }[] {
  const v = typeof inputs.speed === 'number' ? (inputs.speed as number) : PROJECTILE_DEFAULTS.speed;
  const th = typeof inputs.angle === 'number' ? (inputs.angle as number) : PROJECTILE_DEFAULTS.angle;
  const h0 = typeof inputs.height === 'number' ? (inputs.height as number) : 0;
  const m = typeof inputs.mass === 'number' ? (inputs.mass as number) : PROJECTILE_DEFAULTS.mass;
  const kOverM = e.values.k ? e.values.k / m : 0;
  let x = 0;
  let y = h0;
  let vx = v * Math.cos(th);
  let vy = v * Math.sin(th);
  const dt = 1 / 480;
  const out = [{ x, y }];
  for (let i = 0; i < 480 * 60; i++) {
    const sp = Math.hypot(vx, vy);
    vx -= kOverM * sp * vx * dt;
    vy -= (G + kOverM * sp * vy) * dt;
    x += vx * dt;
    y += vy * dt;
    if (y < 0) {
      out.push({ x, y: 0 });
      break;
    }
    if (i % 12 === 0) out.push({ x, y });
  }
  return out;
}

function fallPath(e: Estimate): { x: number; y: number }[] {
  const vt = e.values.vt ?? 50;
  const T = Math.max(1, (e.values.t95 ?? 6) * 1.4);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (T * i) / 60;
    // v(t) = vt·tanh(g·t/vt); the distance fallen, (vt²/g)·ln cosh(g·t/vt)
    out.push({ x: t, y: -(vt * vt / G) * Math.log(Math.cosh((G * t) / vt)) });
  }
  return out;
}

function orbitPath(e: Estimate, inputs: Record<string, unknown>): { x: number; y: number }[] {
  // the orbit drawn to the planet's scale: radius R + altitude, the planet's own radius from its table
  const alt = typeof inputs.altitude === 'number' ? (inputs.altitude as number) : 420_000;
  const body = typeof inputs.body === 'string' ? (inputs.body as string) : 'earth';
  const R = body === 'moon' ? 1_737_400 : body === 'mars' ? 3_389_500 : 6_371_000;
  const r = R + alt;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= 90; i++) out.push({ x: r * Math.cos((2 * Math.PI * i) / 90), y: r * Math.sin((2 * Math.PI * i) / 90) });
  void e;
  return out;
}

/** The estimate's first lines, as label and value. */
const linesOf = (e: Estimate, n = 4) => e.lines.slice(0, n).map((l) => ({ label: l.label, value: l.value }));

/** A formula in his words, solved and stepped; null when the words hold no problem the workbench knows, or it has no answer. */
export function simFrom(ask: string): Sim | null {
  const p: Problem | null = parseProblem(ask);
  if (!p || (p.kind !== 'projectile' && p.kind !== 'fall' && p.kind !== 'orbit')) return null;
  // the words must carry a problem: a number he gave, or the thing named as the thing (a bare "orbit" is not a problem)
  if (!p.filled.length && !/\b(?:throw|thrown|kick|kicked|fire|fired|launch|launched|drop|dropped|fall|falling|orbit)\b/i.test(ask)) return null;
  return simOf(p.kind, p.inputs);
}

function simOf(kind: 'projectile' | 'fall' | 'orbit', inputs: Record<string, unknown>): Sim | null {
  const p = { kind, inputs };
  const e = solve(p.kind, p.inputs);
  if (e.problem) return null;
  if (p.kind === 'projectile') {
    const path = projectilePath(e, p.inputs);
    return { kind: 'projectile', title: e.title, lines: linesOf(e), path, axes: { x: 'distance, m', y: 'height, m' }, seconds: e.values.time ?? 3, caveat: e.caveat, values: e.values, inputs };
  }
  if (p.kind === 'fall') {
    const path = fallPath(e);
    return { kind: 'fall', title: e.title, lines: linesOf(e), path, axes: { x: 'seconds', y: 'metres fallen' }, seconds: path[path.length - 1]!.x, caveat: e.caveat, values: e.values, inputs };
  }
  const path = orbitPath(e, p.inputs);
  return { kind: 'orbit', title: e.title, lines: linesOf(e), path, axes: { x: 'east, m', y: 'north, m' }, seconds: e.values.period ?? 5400, caveat: e.caveat, values: e.values, inputs };
}
