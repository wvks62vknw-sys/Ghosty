/**
 * THE WORKBENCH: projectile and orbital paths (OWNER-ISSUES 61b), pure and total. A projectile in a vacuum (the closed form)
 * and through air with quadratic drag (fourth-order Runge–Kutta, said); range, apex, time and impact speed. Orbits: circular
 * speed and period at an altitude, escape velocity, a Hohmann transfer's two burns and its time, around the Earth, the Moon
 * or Mars (their constants named: NASA's planetary fact sheets).
 */
import { G, isa } from './aero';
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const deg = (r: number) => (r * 180) / Math.PI;

export interface ProjectileIn {
  /** Launch speed m/s, angle above the horizontal rad, launch height m. */
  speed?: number;
  angle?: number;
  height?: number;
  /** Through air (true unless he says it is a vacuum). */
  drag?: boolean;
  mass?: number;
  /** Diameter of the ball, m. */
  diameter?: number;
  cd?: number;
}

export const PROJECTILE_DEFAULTS = { speed: 25, angle: Math.PI / 4, height: 0, drag: true, mass: 0.43, diameter: 0.22, cd: 0.25 };

/** The vacuum path's closed form from height h: time, range, apex and impact speed. */
export function vacuumPath(v: number, th: number, h = 0, g = G): { time: number; range: number; apex: number; impact: number } {
  const vx = v * Math.cos(th);
  const vy = v * Math.sin(th);
  const time = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * h))) / g;
  return { time, range: vx * time, apex: h + (vy > 0 ? (vy * vy) / (2 * g) : 0), impact: Math.sqrt(v * v + 2 * g * h) };
}

/**
 * Through air: dv/dt = −g·ŷ − (k/m)|v|v with k = ½ρ·Cd·A, by fourth-order Runge–Kutta in steps of a four-thousandth of the
 * vacuum flight time; the landing found between the last two steps. Null if it does not land (an endless climb).
 */
export function dragPath(v: number, th: number, h: number, kOverM: number, g = G): { time: number; range: number; apex: number; impact: number } | null {
  const vac = vacuumPath(v, th, h, g);
  const dt = Math.max(1e-5, vac.time / 4000);
  let s = [0, h, v * Math.cos(th), v * Math.sin(th)];
  let t = 0;
  let apex = h;
  const f = (q: number[]) => {
    const sp = Math.hypot(q[2]!, q[3]!);
    return [q[2]!, q[3]!, -kOverM * sp * q[2]!, -g - kOverM * sp * q[3]!];
  };
  for (let i = 0; i < 400_000; i++) {
    const k1 = f(s);
    const k2 = f(s.map((x, j) => x + (dt / 2) * k1[j]!));
    const k3 = f(s.map((x, j) => x + (dt / 2) * k2[j]!));
    const k4 = f(s.map((x, j) => x + dt * k3[j]!));
    const n = s.map((x, j) => x + (dt / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    if (n[1]! < 0 && n[3]! < 0) {
      // the landing, between this step and the last (linear in height)
      const frac = s[1]! / (s[1]! - n[1]!);
      const at = (j: number) => s[j]! + frac * (n[j]! - s[j]!);
      return { time: t + frac * dt, range: at(0), apex, impact: Math.hypot(at(2), at(3)) };
    }
    s = n;
    t += dt;
    if (s[1]! > apex) apex = s[1]!;
  }
  return null;
}

export function solveProjectile(input: ProjectileIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Projectile';
  const used: string[] = [];
  const v = ok(input.speed) ? input.speed : (used.push(`launched at ${show(PROJECTILE_DEFAULTS.speed, 'speed', system)}`), PROJECTILE_DEFAULTS.speed);
  const th = fin(input.angle) ? input.angle : (used.push('at 45°'), PROJECTILE_DEFAULTS.angle);
  const h = fin(input.height) ? input.height : 0;
  const drag = input.drag !== false;
  if (v > 1500) return problemEstimate('projectile', title, 'faster than about 1.5 km/s the air behaves differently (supersonic) and the curve of the Earth starts to matter');
  if (th <= -Math.PI / 2 || th > Math.PI / 2) return problemEstimate('projectile', title, 'the angle is measured up from the horizontal: between −90° and 90°');
  if (h < 0) return problemEstimate('projectile', title, 'it must start at or above the ground');
  const vac = vacuumPath(v, th, h);
  const lines: EstLine[] = [];
  const values: Record<string, number> = { vacuumRange: vac.range, vacuumTime: vac.time, vacuumApex: vac.apex, vacuumImpact: vac.impact };
  let guessed = false;
  if (drag) {
    const m = ok(input.mass) ? input.mass : ((guessed = true), used.push('a football: 0.43 kg, 22 cm across, Cd 0.25'), PROJECTILE_DEFAULTS.mass);
    const d = ok(input.diameter) ? input.diameter : PROJECTILE_DEFAULTS.diameter;
    const cd = ok(input.cd) ? input.cd : PROJECTILE_DEFAULTS.cd;
    const rho = isa(0).rho;
    const k = 0.5 * rho * cd * ((Math.PI * d * d) / 4);
    const p = dragPath(v, th, h, k / m);
    if (!p) return problemEstimate('projectile', title, 'it never comes down in the time this can follow');
    lines.push(
      { label: 'Range through air', value: show(p.range, 'length', system), note: `${num((1 - p.range / Math.max(vac.range, 1e-9)) * 100, 2)} % short of a vacuum` },
      { label: 'Highest point', value: show(p.apex, 'length', system) },
      { label: 'Time in the air', value: `${num(p.time, 3)} s` },
      { label: 'Speed when it lands', value: show(p.impact, 'speed', system) },
      { label: 'Range in a vacuum', value: show(vac.range, 'length', system) },
    );
    Object.assign(values, { range: p.range, apex: p.apex, time: p.time, impact: p.impact, k });
  } else {
    lines.push(
      { label: 'Range', value: show(vac.range, 'length', system) },
      { label: 'Highest point', value: show(vac.apex, 'length', system) },
      { label: 'Time in the air', value: `${num(vac.time, 3)} s` },
      { label: 'Speed when it lands', value: show(vac.impact, 'speed', system) },
    );
    Object.assign(values, { range: vac.range, apex: vac.apex, time: vac.time, impact: vac.impact });
  }
  return {
    kind: 'projectile',
    title: `${title}: ${show(v, 'speed', system)} at ${num(deg(th), 3)}°`,
    lines,
    assumptions: [...used, h ? `launched ${show(h, 'length', system)} up` : 'launched from the ground, landing at the same height', drag ? 'still air at sea level (1.225 kg/m³), no spin' : 'no air at all (a vacuum)', 'flat ground and constant gravity'],
    method: drag ? 'drag ½ρ·Cd·A·v² against the motion, stepped by fourth-order Runge–Kutta; the vacuum range v²·sin2θ ÷ g beside it' : 'the vacuum closed form: range = v²·sin2θ ÷ g from the ground',
    confidence: guessed ? 'rough' : used.length ? 'fair' : 'good',
    changes: ['spin curls a ball (the Magnus effect): this has none', 'a headwind shortens it, a tailwind lengthens it', drag ? 'the best angle through air is below 45°' : 'through air it falls well short of this'],
    caveat: caveatFor('projectile'),
    values,
  };
}

export type Body = 'earth' | 'moon' | 'mars';

/** Gravitational parameter μ (m³/s²) and mean radius (m): NASA's planetary fact sheets. */
export const BODIES: Record<Body, { name: string; mu: number; R: number }> = {
  earth: { name: 'the Earth', mu: 3.986004418e14, R: 6_371_000 },
  moon: { name: 'the Moon', mu: 4.9048695e12, R: 1_737_400 },
  mars: { name: 'Mars', mu: 4.282837e13, R: 3_389_500 },
};

export const circularSpeed = (mu: number, r: number) => Math.sqrt(mu / r);
export const orbitPeriod = (mu: number, r: number) => 2 * Math.PI * Math.sqrt(r ** 3 / mu);
export const escapeSpeed = (mu: number, r: number) => Math.sqrt((2 * mu) / r);

/** A Hohmann transfer between two circular orbits of radius r1 and r2: the two burns and the half-ellipse's time. */
export function hohmann(mu: number, r1: number, r2: number): { dv1: number; dv2: number; time: number } {
  const at = (r1 + r2) / 2;
  const dv1 = Math.abs(Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1));
  const dv2 = Math.abs(Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2))));
  return { dv1, dv2, time: Math.PI * Math.sqrt(at ** 3 / mu) };
}

export interface OrbitIn {
  body?: Body;
  /** Altitude above the mean surface, m. */
  altitude?: number;
  /** A second orbit's altitude, m: the Hohmann transfer to it. */
  to?: number;
}

export const ORBIT_DEFAULTS = { body: 'earth' as Body, altitude: 420_000 };

const span = (s: number) => (s < 7200 ? `${num(s / 60, 3)} min` : s < 3 * 86400 ? `${num(s / 3600, 3)} h` : `${num(s / 86400, 3)} days`);

export function solveOrbit(input: OrbitIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Orbit';
  const used: string[] = [];
  const body = input.body && BODIES[input.body] ? input.body : (used.push('around the Earth'), ORBIT_DEFAULTS.body);
  const B = BODIES[body];
  const alt = fin(input.altitude) ? input.altitude : (used.push('420 km up (the ISS)'), ORBIT_DEFAULTS.altitude);
  if (alt < 0) return problemEstimate('orbit', title, 'that is below the surface');
  if (alt > 2e9) return problemEstimate('orbit', title, `that far out, other bodies' pull matters more than ${B.name}'s: two-body orbits no longer hold`);
  const r = B.R + alt;
  const v = circularSpeed(B.mu, r);
  const T = orbitPeriod(B.mu, r);
  const esc = escapeSpeed(B.mu, r);
  const kms = (x: number) => `${num(x / 1000, 3)} km/s`;
  const lines: EstLine[] = [
    { label: 'Orbital speed', value: kms(v), note: system === 'metric' ? `${num(v * 3.6, 3)} km/h` : `${num(v / 0.44704, 3)} mph` },
    { label: 'Once round', value: span(T) },
    { label: 'Escape velocity here', value: kms(esc), note: `from the surface ${kms(escapeSpeed(B.mu, B.R))}` },
  ];
  if (body === 'earth' && alt < 160_000 && alt > 0) lines.push({ label: 'The air', value: 'drags it down', note: 'below about 160 km an orbit lasts hours to days' });
  const values: Record<string, number> = { speed: v, period: T, escape: esc, surfaceEscape: escapeSpeed(B.mu, B.R) };
  if (fin(input.to) && input.to >= 0 && input.to !== alt) {
    const t = hohmann(B.mu, r, B.R + input.to);
    lines.push(
      { label: `Transfer to ${show(input.to, 'length', system)}`, value: kms(t.dv1 + t.dv2), note: `two burns: ${kms(t.dv1)} then ${kms(t.dv2)}` },
      { label: 'Transfer time', value: span(t.time), note: 'half an ellipse (Hohmann)' },
    );
    Object.assign(values, { dv1: t.dv1, dv2: t.dv2, transfer: t.time });
  }
  return {
    kind: 'orbit',
    title: `${title}: ${show(alt, 'length', system)} above ${B.name}`,
    lines,
    assumptions: [...used, `${B.name}: μ ${num(B.mu, 4)} m³/s², mean radius ${num(B.R / 1000, 5)} km (NASA)`, 'a circular orbit, two bodies only, a perfectly round planet', ...(fin(input.to) ? ['each burn instant (impulsive)'] : [])],
    method: 'v = √(μ/r); period = 2π√(r³/μ); escape = √(2μ/r); Hohmann burns from the vis-viva equation',
    confidence: used.length ? 'fair' : 'good',
    changes: ["the planet's bulge turns the orbit's plane slowly", 'a low orbit decays in the thin air and needs boosts', 'a real burn takes minutes and loses a little to gravity'],
    caveat: caveatFor('orbit'),
    values,
  };
}
