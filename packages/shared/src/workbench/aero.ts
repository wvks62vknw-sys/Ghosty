/**
 * THE WORKBENCH: aerofoil lift and drag (OWNER-ISSUES 61b), pure and total. The International Standard Atmosphere for the
 * air's density, pressure and viscosity at an altitude; thin-aerofoil lift (Cl = 2π(α − α₀), α₀ from the NACA camber line)
 * with Prandtl's lifting-line correction for a wing of finite span and a stall cap at a stated Cl,max; the drag polar
 * Cd = Cd₀ + Cl²/(π·e·AR); lift and drag forces at a speed; a car's drag force and the power it takes (Cd·A), with rolling
 * resistance and a rear wing's downforce; the Reynolds number; a falling body's terminal velocity. `flow.ts` (the wind
 * tunnel) is the 2-D flow itself.
 */
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

export const G = 9.80665;
const R_AIR = 287.05287;

/** ISA (ICAO): temperature K, pressure Pa, density kg/m³, viscosity Pa·s (Sutherland), speed of sound m/s, to 20 km. */
export function isa(alt: number): { T: number; p: number; rho: number; mu: number; a: number } {
  const h = Math.max(-500, Math.min(20_000, alt));
  let T: number;
  let p: number;
  if (h <= 11_000) {
    T = 288.15 - 0.0065 * h;
    p = 101_325 * (T / 288.15) ** (G / (0.0065 * R_AIR));
  } else {
    T = 216.65;
    p = 22_632.06 * Math.exp((-G * (h - 11_000)) / (R_AIR * T));
  }
  const rho = p / (R_AIR * T);
  const mu = (1.458e-6 * T ** 1.5) / (T + 110.4);
  return { T, p, rho, mu, a: Math.sqrt(1.4 * R_AIR * T) };
}

/** Reynolds number ρ·v·L/μ. */
export const reynolds = (rho: number, v: number, L: number, mu: number) => (rho * v * L) / mu;

/** A NACA 4-digit code → max camber m, its position p, thickness t (fractions of the chord); null if it is not one. */
export function nacaOf(code: string): { m: number; p: number; t: number } | null {
  const c = /^\s*(?:naca\s*)?(\d)(\d)(\d\d)\s*$/i.exec(String(code ?? ''));
  if (!c) return null;
  const m = Number(c[1]) / 100;
  const p = Number(c[2]) / 10;
  const t = Number(c[3]) / 100;
  if (t <= 0 || (m > 0 && p <= 0)) return null;
  return { m, p, t };
}

/** The NACA camber line's slope dz/dx at x (0..1). */
function camberSlope(m: number, p: number, x: number): number {
  if (m === 0) return 0;
  return x < p ? ((2 * m) / (p * p)) * (p - x) : ((2 * m) / ((1 - p) ** 2)) * (p - x);
}

/** Thin-aerofoil theory's zero-lift angle, rad: α₀ = −(1/π)∫₀^π (dz/dx)(cos θ − 1) dθ, integrated numerically. */
export function zeroLiftAngle(m: number, p: number): number {
  if (m === 0) return 0;
  const n = 2000;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) * Math.PI) / n;
    const x = (1 - Math.cos(th)) / 2;
    s += camberSlope(m, p, x) * (Math.cos(th) - 1);
  }
  return -(s * (Math.PI / n)) / Math.PI;
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

export interface WingIn {
  /** Wing area m², span m. */
  area?: number;
  span?: number;
  /** Airspeed m/s. */
  speed?: number;
  /** Angle of attack, rad. */
  alpha?: number;
  /** m above sea level. */
  altitude?: number;
  naca?: string;
  clMax?: number;
  cd0?: number;
  /** Oswald efficiency. */
  e?: number;
  /** The aircraft's mass, kg (for the lift it needs and its stall speed). */
  mass?: number;
}

export const WING_DEFAULTS = { area: 16.2, span: 11, speed: 50, alpha: rad(4), altitude: 0, naca: '2412', clMax: 1.4, cd0: 0.027, e: 0.8 };

/** A wing's lift and drag at a speed and an angle (a Cessna 172-like wing unless he says). */
export function solveWing(input: WingIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Wing';
  const used: string[] = [];
  const S = ok(input.area) ? input.area : (used.push('16.2 m² of wing'), WING_DEFAULTS.area);
  const b = ok(input.span) ? input.span : (used.push('11 m of span'), WING_DEFAULTS.span);
  const v = ok(input.speed) ? input.speed : (used.push(`${show(WING_DEFAULTS.speed, 'speed', system)} (${num(WING_DEFAULTS.speed, 3)} m/s)`), WING_DEFAULTS.speed);
  const alpha = typeof input.alpha === 'number' && Number.isFinite(input.alpha) ? input.alpha : (used.push('4° angle of attack'), WING_DEFAULTS.alpha);
  const alt = typeof input.altitude === 'number' && Number.isFinite(input.altitude) ? input.altitude : (used.push('sea level'), 0);
  const code = input.naca ?? (used.push('a NACA 2412 section'), WING_DEFAULTS.naca);
  const clMax = ok(input.clMax) ? input.clMax : WING_DEFAULTS.clMax;
  const cd0 = ok(input.cd0) ? input.cd0 : WING_DEFAULTS.cd0;
  const e = ok(input.e) && input.e <= 1 ? input.e : WING_DEFAULTS.e;
  const naca = nacaOf(code);
  if (!naca) return problemEstimate('wing', title, `"${code}" is not a NACA 4-digit section (like 2412 or 0012)`);
  if (b * b < S * 0.5) return problemEstimate('wing', title, 'a span this short for its area is not a wing: lifting-line theory needs an aspect ratio above about 0.5');
  if (Math.abs(alpha) > rad(25)) return problemEstimate('wing', title, `${num(deg(alpha), 3)}° is far past any stall: thin-aerofoil theory is for small angles`);
  if (v > 250) return problemEstimate('wing', title, `${show(v, 'speed', system)} is near the speed of sound: these low-speed formulae no longer hold (compressibility)`);
  if (alt < -500 || alt > 20_000) return problemEstimate('wing', title, 'the standard atmosphere here runs from sea level to 20 km');
  const air = isa(alt);
  const AR = (b * b) / S;
  const a0 = 2 * Math.PI;
  const a = a0 / (1 + a0 / (Math.PI * e * AR));
  const al0 = zeroLiftAngle(naca.m, naca.p);
  const stall = al0 + clMax / a;
  if (alpha > stall || alpha < al0 - clMax / a) {
    return problemEstimate('wing', title, `past the stall: this wing stalls at about ${num(deg(stall), 2)}° (Cl,max ${num(clMax, 3)}). Beyond it the flow separates and lift falls away, which thin-aerofoil theory cannot follow`);
  }
  const Cl = a * (alpha - al0);
  const Cdi = (Cl * Cl) / (Math.PI * e * AR);
  const Cd = cd0 + Cdi;
  const q = 0.5 * air.rho * v * v;
  const L = q * S * Cl;
  const D = q * S * Cd;
  const chord = S / b;
  const Re = reynolds(air.rho, v, chord, air.mu);
  const lines: EstLine[] = [
    { label: 'Lift', value: show(L, 'force', system), note: `holds up ${num(L / G, 3)} kg` },
    { label: 'Drag', value: show(D, 'force', system), note: `${num(Cdi / Cd * 100, 2)} % of it induced` },
    { label: 'Lift ÷ drag', value: num(L / D, 3) },
    { label: 'Cl', value: num(Cl, 3), note: `wing lift slope ${num(a, 3)} per radian, zero lift at ${num(deg(al0), 2)}°` },
    { label: 'Cd', value: num(Cd, 3), note: `Cd₀ ${num(cd0, 3)} + induced ${num(Cdi, 3)}` },
    { label: 'Stalls at about', value: `${num(deg(stall), 2)}°` },
    { label: 'Reynolds number', value: num(Re, 2), note: `on the ${num(chord, 3)} m mean chord` },
    { label: 'Air density', value: `${num(air.rho, 4)} kg/m³`, note: alt ? `ISA at ${show(alt, 'length', system)}` : 'ISA, sea level' },
  ];
  if (ok(input.mass)) {
    const W = input.mass * G;
    const need = W / (q * S);
    const vs = Math.sqrt((2 * W) / (air.rho * S * clMax));
    lines.splice(1, 0, { label: 'Cl it needs to fly level', value: num(need, 3), note: `${num(input.mass, 3)} kg` }, { label: 'Stall speed', value: show(vs, 'speed', system), note: 'wings level, no flaps' });
  }
  return {
    kind: 'wing',
    title: `${title}: NACA ${code.replace(/\D/g, '')} at ${num(deg(alpha), 2)}°`,
    lines,
    assumptions: [
      ...used,
      `Oswald efficiency ${num(e, 2)}, Cd₀ ${num(cd0, 3)} (a light aircraft's whole drag at zero lift)`,
      `Cl,max ${num(clMax, 3)} with no flaps`,
      'low speed (no compressibility), steady, straight and level',
    ],
    method: 'Cl = a(α − α₀), a = 2π ÷ (1 + 2π/(π·e·AR)) (Prandtl lifting line); Cd = Cd₀ + Cl²/(π·e·AR); lift = ½ρv²·S·Cl; ISA density',
    confidence: used.length ? 'fair' : 'good',
    changes: [
      'lift grows with the square of the speed',
      'thinner air higher up: about a third less lift at 3,000 m',
      'flaps raise Cl,max (to 2 or more) and lower the stall speed',
      'a dirty or iced wing stalls much earlier',
    ],
    caveat: caveatFor('wing'),
    values: { lift: L, drag: D, Cl, Cd, Cdi, AR, a, alpha0: al0, stall, Re, rho: air.rho },
  };
}

export interface CarIn {
  cd?: number;
  /** Frontal area m². */
  area?: number;
  /** Speed m/s. */
  speed?: number;
  /** kg (rolling resistance). */
  mass?: number;
  crr?: number;
  /** A rear wing: its area m² and lift coefficient (pressing down). */
  wingArea?: number;
  wingCl?: number;
  altitude?: number;
}

export const CAR_DEFAULTS = { cd: 0.3, area: 2.2, speed: 31.2928, mass: 1300, crr: 0.012 };

/** A car's drag and the power it takes at a speed (a family hatchback unless he says). */
export function solveCar(input: CarIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Car drag';
  const used: string[] = [];
  let guessed = false;
  const cd = ok(input.cd) ? input.cd : ((guessed = true), used.push('Cd 0.30 (a family hatchback)'), CAR_DEFAULTS.cd);
  const A = ok(input.area) ? input.area : ((guessed = true), used.push('2.2 m² of frontal area'), CAR_DEFAULTS.area);
  const v = ok(input.speed) ? input.speed : (used.push('70 mph'), CAR_DEFAULTS.speed);
  const m = ok(input.mass) ? input.mass : (used.push('1,300 kg'), CAR_DEFAULTS.mass);
  const crr = ok(input.crr) ? input.crr : CAR_DEFAULTS.crr;
  const alt = typeof input.altitude === 'number' && Number.isFinite(input.altitude) ? input.altitude : 0;
  if (cd > 2 || A > 15) return problemEstimate('car', title, 'that drag area is far beyond any road vehicle (Cd up to about 1, frontal area up to about 10 m²)');
  if (v > 140) return problemEstimate('car', title, 'past about 300 mph the air starts to compress: these formulae no longer hold');
  const air = isa(alt);
  const q = 0.5 * air.rho * v * v;
  const Fd = q * cd * A;
  const Fr = crr * m * G;
  const Pd = Fd * v;
  const Pr = Fr * v;
  const lines: EstLine[] = [
    { label: 'Power to push the air', value: show(Pd, 'power', system), note: `${show(Fd, 'force', system)} of drag` },
    { label: 'Power to roll the tyres', value: show(Pr, 'power', system), note: `${show(Fr, 'force', system)}, Crr ${num(crr, 2)}` },
    { label: 'At the wheels, in all', value: show(Pd + Pr, 'power', system), note: 'level road, no wind' },
    { label: 'Drag area Cd·A', value: `${num(cd * A, 3)} m²` },
    { label: 'Reynolds number', value: num(reynolds(air.rho, v, 4.3, air.mu), 2), note: 'on a 4.3 m car' },
  ];
  const values: Record<string, number> = { dragForce: Fd, dragPower: Pd, rollForce: Fr, rollPower: Pr, total: Pd + Pr, cda: cd * A };
  if (ok(input.wingArea)) {
    const cl = ok(input.wingCl) ? input.wingCl : 1;
    const down = q * input.wingArea * cl;
    const wd = q * input.wingArea * (0.02 + (cl * cl) / (Math.PI * 0.7 * 3));
    lines.splice(3, 0, { label: 'Downforce from the wing', value: show(down, 'force', system), note: `${num(down / G, 3)} kg pressing down, at a cost of ${show(wd * v, 'power', system)}` });
    values.downforce = down;
    if (!ok(input.wingCl)) used.push('the rear wing at Cl 1.0, aspect ratio 3');
  }
  return {
    kind: 'car',
    title: `${title} at ${show(v, 'speed', system)}`,
    lines,
    assumptions: [...used, `air at ${num(air.rho, 4)} kg/m³ (ISA${alt ? ` at ${show(alt, 'length', system)}` : ', sea level'})`, 'a level road, still air, steady speed', 'power at the wheels: the engine makes 10–20 % more (the drivetrain)'],
    method: 'drag = ½ρv²·Cd·A; rolling = Crr·m·g; power = force × speed',
    confidence: guessed ? 'rough' : used.length ? 'fair' : 'good',
    changes: ['drag power grows with the cube of the speed: 10 % faster needs about 33 % more', 'a roof box adds 10–25 % to the drag', 'a headwind counts as speed through the air'],
    caveat: caveatFor('car'),
    values,
  };
}

export interface FallIn {
  mass?: number;
  cd?: number;
  /** The area facing the air, m². */
  area?: number;
  altitude?: number;
}

export const FALL_DEFAULTS = { mass: 80, cd: 1, area: 0.7 };

/** Terminal velocity: √(2mg ÷ ρ·Cd·A) (a skydiver belly-down unless he says). */
export function solveFall(input: FallIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Terminal velocity';
  const used: string[] = [];
  let guessed = false;
  const m = ok(input.mass) ? input.mass : (used.push('80 kg'), FALL_DEFAULTS.mass);
  const cd = ok(input.cd) ? input.cd : ((guessed = true), used.push('Cd 1.0 (a body falling flat)'), FALL_DEFAULTS.cd);
  const A = ok(input.area) ? input.area : ((guessed = true), used.push('0.7 m² facing the air'), FALL_DEFAULTS.area);
  const alt = typeof input.altitude === 'number' && Number.isFinite(input.altitude) ? input.altitude : 0;
  const air = isa(alt);
  const vt = Math.sqrt((2 * m * G) / (air.rho * cd * A));
  if (vt > 300) return problemEstimate('fall', title, 'it would fall faster than sound, where this formula no longer holds');
  const t95 = (vt / G) * Math.atanh(0.95);
  return {
    kind: 'fall',
    title: `${title}: ${num(m, 3)} kg`,
    lines: [
      { label: 'Terminal velocity', value: show(vt, 'speed', system), note: `${num(vt, 3)} m/s` },
      { label: 'Time to 95 % of it', value: `${num(t95, 2)} s`, note: `about ${show((vt * vt / G) * Math.log(Math.cosh(Math.atanh(0.95))), 'length', system)} of fall` },
    ],
    assumptions: [...used, `air at ${num(air.rho, 4)} kg/m³ (ISA${alt ? ` at ${show(alt, 'length', system)}` : ', sea level'})`, 'the drag coefficient stays the same all the way down'],
    method: 'v = √(2mg ÷ ρ·Cd·A), where the drag equals the weight; v(t) = v·tanh(g·t ÷ v)',
    confidence: guessed ? 'rough' : used.length ? 'fair' : 'good',
    changes: ['head-down halves the area: about 40 % faster', 'thinner air higher up: faster at altitude'],
    caveat: caveatFor('fall'),
    values: { vt, t95 },
  };
}
