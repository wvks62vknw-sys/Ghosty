/**
 * THE WORKBENCH: the engine cycle (OWNER-ISSUES 61b), pure and total. The ideal Otto and Diesel cycles (γ = 1.4) for the
 * efficiency a compression ratio allows; power and torque from the swept volume, the speed and a first guess at the brake
 * mean effective pressure (BMEP) by the kind of engine, with a torque curve that peaks near 60 % of the rated speed; the
 * reverse (a claimed power → the BMEP it implies, "about right" or "optimistic for this size"); the air it breathes and the
 * fuel it burns at the real-world efficiency range (25–40 %).
 *
 * The BMEP guesses are at the rated speed (where the power peaks), four-stroke: modern NA petrol about 12 bar (older ones
 * 9–10: Heywood, Internal Combustion Engine Fundamentals, gives 8.5–10.5 bar at peak torque), turbo petrol about 18, turbo
 * diesel about 15. They are said as the guesses they are: the confidence of a power from a guessed BMEP is `rough`.
 */
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

export type EngineType = 'na' | 'turbo' | 'diesel';

export const GAMMA = 1.4;

export interface EngineKind {
  name: string;
  /** BMEP at the rated speed, Pa: the first guess. */
  bmep: number;
  /** The range a real engine of this kind makes at its rated speed, Pa. */
  range: [number, number];
  /** The rated speed if he gives none, rpm. */
  rpm: number;
  /** Compression ratio if he gives none. */
  cr: number;
  /** Manifold pressure ÷ the air's (breathing). */
  pr: number;
  /** Fuel: lower heating value J/kg, density kg/L, air-fuel ratio at full power. */
  lhv: number;
  density: number;
  afr: number;
  fuel: string;
}

export const ENGINE_KINDS: Record<EngineType, EngineKind> = {
  na: { name: 'naturally aspirated petrol', bmep: 12e5, range: [9e5, 13.5e5], rpm: 6000, cr: 10.5, pr: 1, lhv: 43.4e6, density: 0.745, afr: 13.5, fuel: 'petrol' },
  turbo: { name: 'turbocharged petrol', bmep: 18e5, range: [14e5, 24e5], rpm: 5500, cr: 9.5, pr: 1.8, lhv: 43.4e6, density: 0.745, afr: 12.5, fuel: 'petrol' },
  diesel: { name: 'turbo diesel', bmep: 15e5, range: [12e5, 22e5], rpm: 4000, cr: 16.5, pr: 2, lhv: 42.6e6, density: 0.832, afr: 20, fuel: 'diesel' },
};

/** The ideal Otto cycle's efficiency: 1 − 1/r^(γ−1). */
export const ottoEfficiency = (r: number, g = GAMMA) => 1 - 1 / r ** (g - 1);

/** The ideal Diesel cycle's efficiency with cut-off ratio rc: 1 − (1/r^(γ−1))·(rc^γ − 1)/(γ(rc − 1)). */
export const dieselEfficiency = (r: number, rc = 2, g = GAMMA) => 1 - (1 / r ** (g - 1)) * ((rc ** g - 1) / (g * (rc - 1)));

/**
 * The torque curve's shape, as a share of the peak, at u = speed ÷ rated speed: 1 at u = 0.6, 0.88 at the rated speed — so
 * the power still rises to the rated speed and peaks there. One shape for every engine, said as a shape.
 */
export const torqueShape = (u: number) => Math.max(0, 1 - 0.75 * (u - 0.6) ** 2);

/** Four-stroke: one power stroke per two turns. P = BMEP · Vd · n / 120; T = BMEP · Vd / 4π. */
export const powerOf = (bmep: number, vd: number, rpm: number) => (bmep * vd * rpm) / 120;
export const torqueOf = (bmep: number, vd: number) => (bmep * vd) / (4 * Math.PI);

export interface EngineIn {
  /** Swept volume, m³ (2.0 L = 0.002). */
  displacement?: number;
  /** The rated speed (where the power peaks), rpm. */
  rpm?: number;
  type?: EngineType;
  /** A claimed power, W: the reverse (the BMEP it implies). */
  power?: number;
  /** Compression ratio. */
  cr?: number;
  /** His own BMEP, Pa (instead of the guess). */
  bmep?: number;
}

export const ENGINE_DEFAULTS = { displacement: 0.002, type: 'na' as EngineType };

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const bar = (pa: number) => `${num(pa / 1e5, 3)} bar`;

export function solveEngine(input: EngineIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Engine';
  const used: string[] = [];
  const type: EngineType = input.type && ENGINE_KINDS[input.type] ? input.type : (used.push('a naturally aspirated petrol engine'), ENGINE_DEFAULTS.type);
  const k = ENGINE_KINDS[type];
  const vd = ok(input.displacement) ? input.displacement : (used.push('2.0 litres'), ENGINE_DEFAULTS.displacement);
  const rpm = ok(input.rpm) ? input.rpm : (used.push(`rated at ${num(k.rpm, 4)} rpm`), k.rpm);
  const cr = ok(input.cr) ? input.cr : (used.push(`a compression ratio of ${num(k.cr, 3)}`), k.cr);
  if (vd < 20e-6 || vd > 0.03) return problemEstimate('engine', title, `${num(vd * 1000, 3)} litres is outside what this is for (0.02 to 30 litres)`);
  if (rpm < 500 || rpm > 20000) return problemEstimate('engine', title, `${num(rpm, 3)} rpm is not an engine's rated speed (500 to 20,000)`);
  if (cr <= 1 || cr > 25) return problemEstimate('engine', title, `a compression ratio of ${num(cr, 3)} is outside the cycle's range (above 1, up to 25)`);
  const ideal = type === 'diesel' ? dieselEfficiency(cr, 2) : ottoEfficiency(cr);
  const reverse = ok(input.power);
  const guessed = !reverse && !ok(input.bmep);
  const bmep = reverse ? (input.power! * 120) / (vd * rpm) : ok(input.bmep) ? input.bmep : k.bmep;
  const P = reverse ? input.power! : powerOf(bmep, vd, rpm);
  const Trated = torqueOf(bmep, vd);
  const Tpeak = Trated / torqueShape(1);
  const air = 1.2 * vd * (rpm / 120) * 0.9 * k.pr;
  const fuelHi = P / 0.25;
  const fuelLo = P / 0.4;
  const lph = (w: number) => (w / k.lhv / k.density) * 3600;
  const lines: EstLine[] = [];
  if (reverse) {
    const [lo, hi] = k.range;
    const verdict = bmep > hi ? `optimistic for this size: a ${k.name} makes ${bar(lo)} to ${bar(hi)}` : bmep < lo ? `modest for this size (${bar(lo)} to ${bar(hi)} is usual)` : `about right for a ${k.name}`;
    lines.push({ label: 'Implied BMEP', value: bar(bmep), note: verdict });
  } else {
    lines.push({ label: `Power at ${num(rpm, 4)} rpm`, value: show(P, 'power', system), note: system === 'metric' ? `${num(P / 745.69987, 3)} hp` : `${num(P / 1000, 3)} kW` });
  }
  lines.push(
    { label: 'Peak torque', value: show(Tpeak, 'torque', system), note: `near ${num(0.6 * rpm, 2)} rpm; the curve’s shape is a guess` },
    { label: `Torque at ${num(rpm, 4)} rpm`, value: show(Trated, 'torque', system) },
    { label: 'Ideal cycle efficiency', value: `${num(ideal * 100, 3)} %`, note: `${type === 'diesel' ? 'Diesel' : 'Otto'} cycle, r = ${num(cr, 3)}, γ = ${GAMMA}` },
    { label: 'Real efficiency', value: '25–40 %', note: 'friction, heat and pumping lose the rest' },
    { label: 'Fuel at full power', value: `${num(lph(fuelLo), 2)}–${num(lph(fuelHi), 2)} L/h`, note: `${num(fuelLo / 1000, 3)}–${num(fuelHi / 1000, 3)} kW of ${k.fuel}` },
    { label: 'Air it breathes', value: `${num(air * 1000, 3)} g/s`, note: `${num(air * 3600, 3)} kg an hour at ${num(rpm, 4)} rpm` },
  );
  if (!reverse) lines.splice(1, 0, { label: 'BMEP', value: bar(bmep), note: guessed ? `a first guess for a ${k.name}` : 'as given' });
  return {
    kind: 'engine',
    title: `${title}: ${(vd * 1000).toFixed(1)} L ${k.name}`,
    lines,
    assumptions: [
      ...used,
      'four-stroke: one power stroke every two turns',
      ...(guessed ? [`a BMEP of ${bar(k.bmep)} at the rated speed: a guess for a ${k.name} (${bar(k.range[0])} to ${bar(k.range[1])} is usual)`] : []),
      `breathing at 90 % volumetric efficiency${k.pr > 1 ? `, boost ${num(k.pr, 2)}× the air's pressure` : ''}, air at 1.2 kg/m³`,
      `${k.fuel}: ${num(k.lhv / 1e6, 3)} MJ/kg, ${num(k.density, 3)} kg/L`,
    ],
    method: reverse ? 'BMEP = power × 120 ÷ (swept volume × rpm), against what this kind of engine really makes' : 'power = BMEP × swept volume × rpm ÷ 120; torque = BMEP × swept volume ÷ 4π; ideal efficiency 1 − 1/r^(γ−1)',
    confidence: guessed ? 'rough' : used.length ? 'fair' : 'good',
    changes: [
      'cams, valves and the intake move the BMEP and where the torque peaks',
      'more boost raises the BMEP (and the heat and the stress)',
      'altitude and hot air take power away: about 3 % per 300 m up',
    ],
    caveat: caveatFor('engine'),
    values: { power: P, bmep, torqueRated: Trated, torquePeak: Tpeak, ideal, air, fuelLo, fuelHi },
  };
}
