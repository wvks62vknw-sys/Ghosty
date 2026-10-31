/**
 * THE WORKBENCH (OWNER-ISSUES 61b): in-house solvers, no packages, no fetch, no model — pure and total. Shared by the phone
 * (apps/web/src/features/workbench: the WORKBENCH screen and the wind tunnel) and the brain (apps/edge/src/tools/workbench.ts:
 * the `estimate` tool). Every answer is an `Estimate` and every one is a first estimate, never certified.
 */
import { solveFall, solveCar, solveWing } from './aero';
import { MATERIALS, solveBeam, solveColumn, K_FACTOR, type BeamIn, type ColumnIn, type Ends, type MaterialId, type SectionIn, type Support } from './beams';
import { solveCircuit, type CircuitIn, type CircuitMode } from './circuits';
import { ENGINE_KINDS, solveEngine, type EngineType } from './engine';
import { problemEstimate, type Estimate, type WorkKind } from './estimate';
import { solveBike, solveGears, type Stage } from './gears';
import { solveHeat, type Fuel, type Layer } from './heat';
import { BODIES, solveOrbit, solveProjectile, type Body } from './motion';
import { solveSun } from './sun';
import type { UnitSystem } from './units';

export * from './units';
export * from './estimate';
export * from './beams';
export * from './gears';
export * from './engine';
export * from './aero';
export * from './motion';
export * from './heat';
export * from './sun';
export * from './circuits';
export * from './words';

/** Every kind the solvers answer (the wind tunnel lives on the phone: it needs a screen). */
export const WORK_KINDS: WorkKind[] = ['beam', 'column', 'gears', 'bike', 'engine', 'wing', 'car', 'fall', 'projectile', 'orbit', 'heat', 'sun', 'circuit'];

type Raw = Record<string, unknown>;
const n = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : undefined);
const s = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x.trim().toLowerCase() : undefined);
const oneOf = <T extends string>(x: unknown, ok: readonly T[]): T | undefined => {
  const v = s(x);
  return v && (ok as readonly string[]).includes(v) ? (v as T) : undefined;
};

/** A section from loose fields: its shape and sizes (m). */
function sectionFrom(r: Raw): SectionIn | undefined {
  const sec = (typeof r.section === 'object' && r.section ? r.section : r) as Raw;
  const shape = oneOf(sec.shape, ['rect', 'round', 'tube', 'ibeam'] as const);
  if (!shape) return undefined;
  return { shape, b: n(sec.b), h: n(sec.h), d: n(sec.d), t: n(sec.t), tw: n(sec.tw), tf: n(sec.tf) };
}

/**
 * One estimate from loose inputs (the brain's tool arguments, the phone's form): every field read with care, anything that
 * is not what it should be left to the solver's default (and said). Total: never throws.
 */
export function solve(kind: WorkKind, raw: Raw = {}, system: UnitSystem = 'metric', now = Date.now()): Estimate {
  const r = raw ?? {};
  try {
    switch (kind) {
      case 'beam':
        return solveBeam({ support: oneOf<Support>(r.support, ['simple', 'cantilever', 'fixed']), span: n(r.span), load: n(r.load), at: n(r.at), udl: n(r.udl), material: oneOf<MaterialId>(r.material, Object.keys(MATERIALS) as MaterialId[]), section: sectionFrom(r), selfWeight: r.selfWeight === true } satisfies BeamIn, system);
      case 'column':
        return solveColumn({ length: n(r.length), ends: oneOf<Ends>(r.ends, Object.keys(K_FACTOR) as Ends[]), load: n(r.load), material: oneOf<MaterialId>(r.material, Object.keys(MATERIALS) as MaterialId[]), section: sectionFrom(r) } satisfies ColumnIn, system);
      case 'gears': {
        const stages = Array.isArray(r.stages)
          ? (r.stages as Raw[]).map((x) => ({ kind: oneOf(x?.kind, ['gear', 'belt', 'chain', 'ratio'] as const), driver: n(x?.driver) ?? NaN, driven: n(x?.driven) ?? NaN }) as Stage)
          : undefined;
        return solveGears({ stages, rpm: n(r.rpm), torque: n(r.torque), mesh: n(r.mesh) }, system);
      }
      case 'bike':
        return solveBike({ chainring: n(r.chainring), sprocket: n(r.sprocket), wheel: n(r.wheel), cadence: n(r.cadence) }, system);
      case 'engine':
        return solveEngine({ displacement: n(r.displacement), rpm: n(r.rpm), type: oneOf<EngineType>(r.type, Object.keys(ENGINE_KINDS) as EngineType[]), power: n(r.power), cr: n(r.cr), bmep: n(r.bmep) }, system);
      case 'wing':
        return solveWing({ area: n(r.area), span: n(r.span), speed: n(r.speed), alpha: n(r.alpha), altitude: n(r.altitude), naca: typeof r.naca === 'string' || typeof r.naca === 'number' ? String(r.naca) : undefined, clMax: n(r.clMax), cd0: n(r.cd0), e: n(r.e), mass: n(r.mass) }, system);
      case 'car':
        return solveCar({ cd: n(r.cd), area: n(r.area), speed: n(r.speed), mass: n(r.mass), crr: n(r.crr), wingArea: n(r.wingArea), wingCl: n(r.wingCl), altitude: n(r.altitude) }, system);
      case 'fall':
        return solveFall({ mass: n(r.mass), cd: n(r.cd), area: n(r.area), altitude: n(r.altitude) }, system);
      case 'projectile':
        return solveProjectile({ speed: n(r.speed), angle: n(r.angle), height: n(r.height), drag: r.drag === false ? false : undefined, mass: n(r.mass), diameter: n(r.diameter), cd: n(r.cd) }, system);
      case 'orbit':
        return solveOrbit({ body: oneOf<Body>(r.body, Object.keys(BODIES) as Body[]), altitude: n(r.altitude), to: n(r.to) }, system);
      case 'heat': {
        const layers = Array.isArray(r.layers) ? (r.layers as Raw[]).map((x) => ({ mat: s(x?.mat) ?? '', thickness: n(x?.thickness) ?? NaN, k: n(x?.k) }) as Layer) : undefined;
        return solveHeat({ layers, wallU: n(r.wallU), floor: n(r.floor), height: n(r.height), wall: n(r.wall), window: n(r.window), windowU: n(r.windowU), ach: n(r.ach), inside: n(r.inside), outside: n(r.outside), tariff: n(r.tariff), fuel: oneOf<Fuel>(r.fuel, ['gas', 'electric', 'heatpump']), mass: oneOf(r.mass, ['low', 'medium', 'high'] as const) }, system);
      }
      case 'sun':
        return solveSun({ lat: n(r.lat), lon: n(r.lon), at: n(r.at), height: n(r.height), tz: typeof r.tz === 'string' ? r.tz : undefined, place: typeof r.place === 'string' ? r.place.slice(0, 60) : undefined }, system, now);
      case 'circuit':
        return solveCircuit({ mode: oneOf<CircuitMode>(r.mode, ['ohm', 'resistors', 'divider', 'led', 'rc', 'power']), v: n(r.v), i: n(r.i), r: n(r.r), rs: Array.isArray(r.rs) ? (r.rs as unknown[]).map((x) => n(x) ?? NaN) : undefined, vin: n(r.vin), r1: n(r.r1), r2: n(r.r2), vout: n(r.vout), supply: n(r.supply), vf: n(r.vf), current: n(r.current), c: n(r.c), watts: n(r.watts), hours: n(r.hours), tariff: n(r.tariff) } satisfies CircuitIn, system);
      case 'tunnel':
        return problemEstimate('tunnel', 'Wind tunnel', 'the wind tunnel runs on the phone: open the Workbench → WIND TUNNEL');
    }
  } catch (e) {
    return problemEstimate(kind, 'Estimate', `the numbers could not be worked out (${String((e as Error)?.message ?? e).slice(0, 80)})`);
  }
  return problemEstimate(kind, 'Estimate', `"${String(kind)}" is not something the workbench solves`);
}
