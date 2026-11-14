/**
 * THE CURVE BEHIND A WORKBENCH ANSWER (NEXT ROUND, make.u6): the shape of an answer, not just its one number — how a beam
 * bends along its span, the power a car needs as it speeds up, a room's heat lost month by month, the sun's height through
 * the day. Pure and total: every point is the same solver run again with one input moved (or, for a beam, the solver's own
 * deflection along the span), so the curve can never say something the card does not. Every curve is a first estimate,
 * never certified, and says so in its own note. The phone draws it (apps/web/src/features/workbench/chart.ts).
 *
 * Re-exported by index.ts; it calls `solve` from there only when a curve is asked for, so the cycle is harmless.
 */
import { solve, type Estimate, type WorkKind } from './index';
import { fromSI, num, unitFor, type QtyKind, type UnitSystem } from './units';

export interface CurvePoint {
  x: number;
  y: number;
  /** A bar's own name ("Jan"), when the curve is bars. */
  label?: string;
}

export interface Curve {
  /** "Deflection along the span". */
  title: string;
  x: { label: string; unit: string };
  y: { label: string; unit: string };
  points: CurvePoint[];
  /** Bars (months) rather than a line. */
  bars?: boolean;
  /** Where his own answer sits on the curve. */
  mark?: { x: number; y: number; label: string };
  /** Drawn below the axis as the curve's own words: "First estimate, not certified: …". */
  note: string;
  /** A line across at this height (the span/250 limit, the stall). */
  limit?: { y: number; label: string };
  /** The axis grows downwards (a beam's sag is drawn below its line, as it bends). */
  down?: boolean;
}

type Raw = Record<string, unknown>;
const FIRST = 'First estimate, not certified';
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A display unit for a kind near `sample` (SI), and the conversion into it. */
function inUnit(kind: QtyKind, system: UnitSystem, sample: number): { unit: string; f: (si: number) => number } {
  const unit = unitFor(kind, system, sample);
  return { unit, f: (si) => fromSI(si, unit, kind) };
}

/** `count` values evenly from `lo` to `hi`. */
const span = (lo: number, hi: number, count: number) => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));

/** The same problem with one input moved, solved again: the points whose answer could be worked out (problems are left out). */
function sweep(kind: WorkKind, raw: Raw, key: string, xs: number[], read: (e: Estimate) => number | undefined, system: UnitSystem, now: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const x of xs) {
    const e = solve(kind, { ...raw, [key]: x }, system, now);
    if (e.problem) continue;
    const y = read(e);
    if (fin(y)) out.push({ x, y });
  }
  return out;
}

/**
 * UK monthly mean air temperatures, °C: the Met Office's UK climate averages for 1991–2020 (public), rounded to a tenth.
 * A first estimate of a typical year, not this year.
 */
export const UK_MONTHS: { m: string; t: number; days: number }[] = [
  { m: 'Jan', t: 4.4, days: 31 }, { m: 'Feb', t: 4.6, days: 28 }, { m: 'Mar', t: 6.2, days: 31 }, { m: 'Apr', t: 8.3, days: 30 },
  { m: 'May', t: 11.3, days: 31 }, { m: 'Jun', t: 14.1, days: 30 }, { m: 'Jul', t: 16.1, days: 31 }, { m: 'Aug', t: 15.8, days: 31 },
  { m: 'Sep', t: 13.5, days: 30 }, { m: 'Oct', t: 10.3, days: 31 }, { m: 'Nov', t: 6.9, days: 30 }, { m: 'Dec', t: 4.6, days: 31 },
];
/** Sun, people and cooking warm a room by about this much for free: heating runs only below (inside − 3 K), the degree-day rule. */
export const FREE_GAIN_K = 3;

/** A room's heating by month (kWh) from its loss per degree H (W/K) and the inside temperature (K). */
export function heatByMonth(H: number, insideK: number): { m: string; kwh: number }[] {
  const base = insideK - 273.15 - FREE_GAIN_K;
  return UK_MONTHS.map(({ m, t, days }) => ({ m, kwh: (H * Math.max(0, base - t) * 24 * days) / 1000 }));
}

/** The local clock hour (0–24, decimal) of `ms` in `tz` (UTC if the zone is not known). */
function clockHour(ms: number, tz?: string): number {
  const fmt = (zone: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).formatToParts(ms);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = fmt(tz || 'UTC');
  } catch {
    parts = fmt('UTC');
  }
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h + m / 60;
}

/**
 * The curve behind an estimate, or null when the answer has no shape worth drawing (a single ratio, a problem). `raw` is the
 * same loose input the estimate was worked out from.
 */
export function curveOf(e: Estimate, raw: Raw = {}, system: UnitSystem = 'metric', now = Date.now()): Curve | null {
  if (e.problem) return null;
  try {
    return build(e, raw ?? {}, system, now);
  } catch {
    return null;
  }
}

function build(e: Estimate, raw: Raw, system: UnitSystem, now: number): Curve | null {
  const V = e.values;
  switch (e.kind) {
    case 'beam': {
      const prof = e.profile;
      if (!prof?.length) return null;
      const L = prof[prof.length - 1]!.x;
      const X = inUnit('length', system, L);
      const Y = inUnit('length', system, Math.max(V.deflection ?? 0, 1e-6) < 0.001 ? 0.0005 : 0.005);
      return {
        title: 'How it bends along the span',
        down: true,
        x: { label: 'Along the beam', unit: X.unit },
        y: { label: 'Sag', unit: Y.unit },
        points: prof.map((p) => ({ x: X.f(p.x), y: Y.f(Math.abs(p.y)) })),
        mark: fin(V.deflectionAt) && fin(V.deflection) ? { x: X.f(V.deflectionAt), y: Y.f(V.deflection), label: `most sag ${num(Y.f(V.deflection), 3)} ${Y.unit}` } : undefined,
        limit: fin(V.limit) ? { y: Y.f(V.limit), label: `span/250: ${num(Y.f(V.limit), 3)} ${Y.unit}` } : undefined,
        note: `${FIRST}: the textbook beam formulae, sagging downwards, drawn along its length.`,
      };
    }
    case 'column': {
      const L0 = fin(raw.length) && raw.length > 0 ? raw.length : 3;
      const pts = sweep('column', raw, 'length', span(L0 * 0.4, L0 * 2, 24), (x) => x.values.capacity, system, now);
      if (pts.length < 3) return null;
      const X = inUnit('length', system, L0);
      const Y = inUnit('force', system, pts[Math.floor(pts.length / 2)]!.y);
      return {
        title: 'What it carries as it gets longer',
        x: { label: 'Length', unit: X.unit },
        y: { label: 'Load before it buckles', unit: Y.unit },
        points: pts.map((p) => ({ x: X.f(p.x), y: Y.f(p.y) })),
        mark: fin(V.capacity) ? { x: X.f(L0), y: Y.f(V.capacity), label: 'yours' } : undefined,
        note: `${FIRST}: Euler's ideal column; a real one buckles below this.`,
      };
    }
    case 'car': {
      const v0 = fin(raw.speed) && raw.speed > 0 ? raw.speed : 31.2928;
      const top = Math.max(v0 * 1.6, 20);
      const pts = sweep('car', raw, 'speed', span(top / 24, top, 24), (x) => x.values.total, system, now);
      if (pts.length < 3) return null;
      const X = inUnit('speed', system, v0);
      return {
        title: 'Power it takes as it speeds up',
        x: { label: 'Speed', unit: X.unit },
        y: { label: 'Power at the wheels', unit: 'kW' },
        points: pts.map((p) => ({ x: X.f(p.x), y: p.y / 1000 })),
        mark: fin(V.total) ? { x: X.f(v0), y: V.total / 1000, label: `${num(V.total / 1000, 3)} kW at yours` } : undefined,
        note: `${FIRST}: drag grows with the cube of speed; rolling resistance with speed alone.`,
      };
    }
    case 'wing': {
      const a0 = fin(raw.alpha) ? raw.alpha : (4 * Math.PI) / 180;
      const deg = (r: number) => (r * 180) / Math.PI;
      const pts = sweep('wing', raw, 'alpha', span((-6 * Math.PI) / 180, (20 * Math.PI) / 180, 27), (x) => x.values.lift, system, now);
      if (pts.length < 3) return null;
      const Y = inUnit('force', system, Math.max(...pts.map((p) => Math.abs(p.y))));
      return {
        title: 'Lift as the angle rises, up to the stall',
        x: { label: 'Angle of attack', unit: '°' },
        y: { label: 'Lift', unit: Y.unit },
        points: pts.map((p) => ({ x: deg(p.x), y: Y.f(p.y) })),
        mark: fin(V.lift) ? { x: deg(a0), y: Y.f(V.lift), label: 'yours' } : undefined,
        note: `${FIRST}: thin-aerofoil theory; past the stall the lift falls away, which it cannot follow, so the line stops there.`,
      };
    }
    case 'fall': {
      const vt = V.vt;
      if (!fin(vt) || vt <= 0) return null;
      const g = 9.80665;
      const tEnd = Math.max(fin(V.t95) ? V.t95 * 1.4 : (vt / g) * 3, 1);
      const X = { unit: 's' };
      const Y = inUnit('speed', system, vt);
      return {
        title: 'Speed through the fall',
        x: { label: 'Time falling', unit: X.unit },
        y: { label: 'Speed', unit: Y.unit },
        points: span(0, tEnd, 30).map((t) => ({ x: t, y: Y.f(vt * Math.tanh((g * t) / vt)) })),
        limit: { y: Y.f(vt), label: `terminal ${num(Y.f(vt), 3)} ${Y.unit}` },
        note: `${FIRST}: a steady fall with constant drag, v = vt·tanh(g·t ÷ vt); never safety advice.`,
      };
    }
    case 'projectile': {
      const th = fin(raw.angle) ? raw.angle : Math.PI / 4;
      const deg = (r: number) => (r * 180) / Math.PI;
      const pts = sweep('projectile', raw, 'angle', span((5 * Math.PI) / 180, (85 * Math.PI) / 180, 17), (x) => x.values.range, system, now);
      if (pts.length < 3) return null;
      const Y = inUnit('length', system, Math.max(...pts.map((p) => p.y)));
      return {
        title: 'How far it goes at each launch angle',
        x: { label: 'Launch angle', unit: '°' },
        y: { label: 'Range', unit: Y.unit },
        points: pts.map((p) => ({ x: deg(p.x), y: Y.f(p.y) })),
        mark: fin(V.range) ? { x: deg(th), y: Y.f(V.range), label: 'yours' } : undefined,
        note: `${FIRST}: a point mass; spin, wind and shape move it.`,
      };
    }
    case 'orbit': {
      const h0 = fin(raw.altitude) && raw.altitude > 0 ? raw.altitude : 420_000;
      const pts = sweep('orbit', { ...raw, to: undefined }, 'altitude', span(Math.max(h0 * 0.25, 100_000), h0 * 4, 24), (x) => x.values.period, system, now);
      if (pts.length < 3) return null;
      return {
        title: 'Time round as the orbit rises',
        x: { label: 'Height', unit: 'km' },
        y: { label: 'One orbit', unit: 'min' },
        points: pts.map((p) => ({ x: p.x / 1000, y: p.y / 60 })),
        mark: fin(V.period) ? { x: h0 / 1000, y: V.period / 60, label: 'yours' } : undefined,
        note: `${FIRST}: two-body circular orbits.`,
      };
    }
    case 'bike': {
      const c0 = fin(raw.cadence) && raw.cadence > 0 ? raw.cadence : 90;
      const pts = sweep('bike', raw, 'cadence', span(40, 130, 19), (x) => x.values.speed, system, now);
      if (pts.length < 3) return null;
      const Y = inUnit('speed', system, pts[0]!.y);
      return {
        title: 'Speed at each cadence in this gear',
        x: { label: 'Cadence', unit: 'rpm' },
        y: { label: 'Speed', unit: Y.unit },
        points: pts.map((p) => ({ x: p.x, y: Y.f(p.y) })),
        mark: fin(V.speed) ? { x: c0, y: Y.f(V.speed), label: 'yours' } : undefined,
        note: `${FIRST}: the wheel's size is nominal.`,
      };
    }
    case 'heat': {
      const H = V.H;
      if (!fin(H) || H <= 0) return null;
      const inside = fin(raw.inside) ? raw.inside : 294.15;
      const months = heatByMonth(H, inside);
      const perKwh = fin(V.cost) && fin(V.kwhDay) && V.kwhDay > 0 ? V.cost / V.kwhDay : 0;
      const year = months.reduce((s, m) => s + m.kwh, 0);
      return {
        title: 'Heating through a typical UK year',
        x: { label: 'Month', unit: '' },
        y: { label: 'Heat lost', unit: 'kWh' },
        bars: true,
        points: months.map((m, i) => ({ x: i, y: m.kwh, label: m.m })),
        note: `${FIRST}: about ${num(year, 3)} kWh a year${perKwh ? ` (about £${Math.round(year * perKwh)})` : ''}, from the Met Office's UK monthly averages (1991–2020) and ${FREE_GAIN_K} K of free warmth from sun and people; a typical year, never a bill.`,
      };
    }
    case 'sun': {
      const at = fin(raw.at) ? raw.at : now;
      const tz = typeof raw.tz === 'string' ? raw.tz : undefined;
      const midnight = at - clockHour(at, tz) * 3_600_000;
      const xs = span(0, 24, 49).map((hr) => midnight + hr * 3_600_000);
      const pts = sweep('sun', raw, 'at', xs, (x) => x.values.altitude, system, now);
      if (pts.length < 3) return null;
      // (the solver's altitude is already in degrees)
      const deg = (d: number) => d;
      return {
        title: 'The sun’s height through the day',
        x: { label: 'Time of day', unit: 'h' },
        y: { label: 'Height above the horizon', unit: '°' },
        points: pts.map((p) => ({ x: (p.x - midnight) / 3_600_000, y: deg(p.y) })),
        mark: fin(V.altitude) ? { x: (at - midnight) / 3_600_000, y: deg(V.altitude), label: 'now' } : undefined,
        limit: { y: 0, label: 'the horizon' },
        note: `${FIRST}: the standard solar-position algorithm, flat ground.`,
      };
    }
    case 'circuit': {
      const tau = V.tau;
      if (!fin(tau) || tau <= 0) return null;
      const scale = tau < 1e-3 ? { unit: 'µs', f: 1e6 } : tau < 1 ? { unit: 'ms', f: 1e3 } : { unit: 's', f: 1 };
      return {
        title: 'The capacitor charging',
        x: { label: 'Time', unit: scale.unit },
        y: { label: 'Charged', unit: '%' },
        points: span(0, 5 * tau, 30).map((t) => ({ x: t * scale.f, y: 100 * (1 - Math.exp(-t / tau)) })),
        mark: { x: tau * scale.f, y: 63.2, label: 'one τ: 63 %' },
        note: `${FIRST}: V(t) = V(1 − e^(−t/τ)) with ideal parts.`,
      };
    }
    default:
      return null;
  }
}
