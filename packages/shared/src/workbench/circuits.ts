/**
 * THE WORKBENCH: circuits (OWNER-ISSUES 61b), pure and total. Ohm's law from any two of volts, amps and ohms; resistors in
 * series and in parallel; a voltage divider (and the resistor for a wanted output); the resistor for an LED, rounded up to
 * the next standard (E12) value; an RC circuit's time constant; a device's power, energy and running cost at a tariff.
 * Low-voltage hobby electronics only: never mains wiring.
 */
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

export type CircuitMode = 'ohm' | 'resistors' | 'divider' | 'led' | 'rc' | 'power';

export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];

/** The smallest standard E12 value at or above r (so a current limit is never exceeded). */
export function nextE12(r: number): number {
  if (!(r > 0)) return 10;
  const dec = 10 ** Math.floor(Math.log10(r) - 1);
  for (const base of [...E12, 100]) {
    const v = base * dec;
    if (v >= r * (1 - 1e-9)) return v;
  }
  return 100 * dec;
}

export const series = (rs: number[]) => rs.reduce((s, r) => s + r, 0);
export const parallel = (rs: number[]) => 1 / rs.reduce((s, r) => s + 1 / r, 0);

export interface CircuitIn {
  mode?: CircuitMode;
  /** Volts, amps, ohms (Ohm's law: give two). */
  v?: number;
  i?: number;
  r?: number;
  /** Resistors (series and parallel), ohms. */
  rs?: number[];
  /** Divider: input volts, the top and bottom resistors, or a wanted output. */
  vin?: number;
  r1?: number;
  r2?: number;
  vout?: number;
  /** LED: supply volts, forward voltage, current A. */
  supply?: number;
  vf?: number;
  current?: number;
  /** RC: farads (with r). */
  c?: number;
  /** Power: watts, hours a day, £ per kWh. */
  watts?: number;
  hours?: number;
  tariff?: number;
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const money = (x: number) => (x < 1 ? `${num(x * 100, 2)}p` : `£${x.toFixed(2)}`);
const watts = (w: number) => (w < 1 ? `${num(w * 1000, 3)} mW` : `${num(w, 3)} W`);

export function solveCircuit(input: CircuitIn = {}, system: UnitSystem = 'metric'): Estimate {
  const mode: CircuitMode = input.mode ?? 'led';
  const used: string[] = [];
  const done = (title: string, lines: EstLine[], method: string, values: Record<string, number>, changes: string[], extra: string[] = []): Estimate => ({
    kind: 'circuit',
    title,
    lines,
    assumptions: [...used, ...extra, 'ideal parts: no wire resistance, resistors exactly their value (real ones are within 5 % or 1 %)'],
    method,
    confidence: used.length ? 'fair' : 'good',
    changes,
    caveat: caveatFor('circuit'),
    values,
  });
  switch (mode) {
    case 'ohm': {
      const given = [ok(input.v), ok(input.i), ok(input.r)].filter(Boolean).length;
      if (given < 2) return problemEstimate('circuit', "Ohm's law", 'give two of volts, amps and ohms');
      const V = ok(input.v) ? input.v : input.i! * input.r!;
      const I = ok(input.i) ? input.i : V / input.r!;
      const R = ok(input.r) ? input.r : V / I;
      if (given === 3 && Math.abs(V - I * R) > 0.01 * V) return problemEstimate('circuit', "Ohm's law", `those three do not agree: ${num(I, 3)} A through ${num(R, 3)} Ω drops ${num(I * R, 3)} V, not ${num(V, 3)} V`);
      return done("Ohm's law", [
        { label: 'Voltage', value: show(V, 'voltage', system) },
        { label: 'Current', value: show(I, 'current', system) },
        { label: 'Resistance', value: show(R, 'resistance', system) },
        { label: 'Power', value: watts(V * I), note: 'turned to heat in the resistance' },
      ], 'V = I × R; P = V × I', { v: V, i: I, r: R, p: V * I }, ['heat raises most resistors’ value a little']);
    }
    case 'resistors': {
      const rs = (input.rs ?? []).filter(ok);
      if (rs.length < 2) return problemEstimate('circuit', 'Resistors', 'give two resistors or more');
      const s = series(rs);
      const p = parallel(rs);
      return done(`Resistors: ${rs.length}`, [
        { label: 'In series', value: show(s, 'resistance', system), note: 'the sum' },
        { label: 'In parallel', value: show(p, 'resistance', system), note: 'always below the smallest' },
      ], 'series R = R₁ + R₂ + …; parallel 1/R = 1/R₁ + 1/R₂ + …', { series: s, parallel: p }, ['each resistor’s tolerance (±5 % for E12) carries into the total']);
    }
    case 'divider': {
      const vin = ok(input.vin) ? input.vin : (used.push('9 V in'), 9);
      if (ok(input.vout) && ok(input.r1) && !ok(input.r2)) {
        if (input.vout >= vin) return problemEstimate('circuit', 'Voltage divider', 'a divider only gives less than its input');
        const r2 = (input.vout * input.r1) / (vin - input.vout);
        const e = nextE12(r2);
        return done('Voltage divider', [
          { label: 'Bottom resistor', value: show(r2, 'resistance', system), note: `nearest standard above: ${show(e, 'resistance', system)}` },
          { label: 'Output with that', value: show((vin * e) / (input.r1 + e), 'voltage', system) },
        ], 'R₂ = Vout × R₁ ÷ (Vin − Vout)', { r2, e12: e }, ['a load on the output pulls it down: keep the load ten times the bottom resistor or more']);
      }
      const r1 = ok(input.r1) ? input.r1 : (used.push('10 kΩ on top'), 10_000);
      const r2 = ok(input.r2) ? input.r2 : (used.push('10 kΩ below'), 10_000);
      const vout = (vin * r2) / (r1 + r2);
      const I = vin / (r1 + r2);
      return done('Voltage divider', [
        { label: 'Output', value: show(vout, 'voltage', system), note: 'with nothing connected to it' },
        { label: 'Current through it', value: show(I, 'current', system) },
        { label: 'Power wasted', value: watts(vin * I) },
      ], 'Vout = Vin × R₂ ÷ (R₁ + R₂)', { vout, i: I }, ['a load on the output pulls it down: keep the load ten times R₂ or more']);
    }
    case 'led': {
      const vs = ok(input.supply) ? input.supply : (used.push('a 5 V supply'), 5);
      const vf = ok(input.vf) ? input.vf : (used.push('a red LED: 2 V forward'), 2);
      const I = ok(input.current) ? input.current : (used.push('20 mA'), 0.02);
      if (vf >= vs) return problemEstimate('circuit', 'LED resistor', `the supply (${show(vs, 'voltage', system)}) must be above the LED's forward voltage (${show(vf, 'voltage', system)})`);
      if (I > 1) return problemEstimate('circuit', 'LED resistor', 'over an amp is a power LED: it needs a constant-current driver, not a resistor');
      const R = (vs - vf) / I;
      const e = nextE12(R);
      const Ie = (vs - vf) / e;
      const p = Ie * Ie * e;
      const rating = p * 2 <= 0.125 ? '⅛ W' : p * 2 <= 0.25 ? '¼ W' : p * 2 <= 0.5 ? '½ W' : p * 2 <= 1 ? '1 W' : `${num(p * 2, 2)} W`;
      return done('LED resistor', [
        { label: 'Resistor', value: show(R, 'resistance', system), note: 'exactly' },
        { label: 'Standard value', value: show(e, 'resistance', system), note: 'the next E12 value up' },
        { label: 'Current with it', value: show(Ie, 'current', system) },
        { label: 'Heat in the resistor', value: watts(p), note: `a ${rating} resistor is plenty` },
      ], 'R = (supply − forward voltage) ÷ current', { r: R, e12: e, i: Ie, p }, ['a blue or white LED drops about 3 V, a red one about 2 V', 'the forward voltage falls as the LED warms'], ['check the LED’s datasheet for its forward voltage and its current']);
    }
    case 'rc': {
      const R = ok(input.r) ? input.r : (used.push('10 kΩ'), 10_000);
      const C = ok(input.c) ? input.c : (used.push('100 µF'), 100e-6);
      const tau = R * C;
      const t = (s: number) => (s < 1 ? `${num(s * 1000, 3)} ms` : `${num(s, 3)} s`);
      return done('RC circuit', [
        { label: 'Time constant', value: t(tau), note: 'charged to 63 %' },
        { label: 'Nearly full (5 τ)', value: t(5 * tau), note: '99.3 %' },
        { label: 'Cut-off frequency', value: `${num(1 / (2 * Math.PI * tau), 3)} Hz`, note: 'as a filter' },
      ], 'τ = R × C; V(t) = V(1 − e^(−t/τ)); f = 1 ÷ 2πRC', { tau, fc: 1 / (2 * Math.PI * tau) }, ['electrolytic capacitors are often 20 % off their marked value']);
    }
    case 'power': {
      const W = ok(input.watts) ? input.watts : (used.push('a 100 W device'), 100);
      const h = ok(input.hours) ? Math.min(24, input.hours) : (used.push('on 4 hours a day'), 4);
      const tariff = ok(input.tariff) ? input.tariff : (used.push('25p a kWh (put in your own tariff)'), 0.25);
      const day = (W * h) / 1000;
      return done('Running cost', [
        { label: 'Energy a day', value: `${num(day, 3)} kWh` },
        { label: 'Cost a day', value: money(day * tariff) },
        { label: 'Cost a year', value: money(day * tariff * 365), note: `${num(day * 365, 3)} kWh` },
      ], 'kWh = watts × hours ÷ 1,000; cost = kWh × tariff', { kwhDay: day, costDay: day * tariff, costYear: day * tariff * 365 }, ['a device on standby still uses a few watts all day', 'the label’s watts are its most, not always what it uses']);
    }
  }
  return problemEstimate('circuit', 'Circuit', 'an unknown kind of circuit');
}
