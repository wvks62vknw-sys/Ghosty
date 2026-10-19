/**
 * BALANCE & LANDER: plain physics, a controller to learn. Levels 1–5: a pole on a cart (the classic
 * cart-pole: push the cart left or right so the pole stays up and the cart stays on the track) for longer,
 * from wider starts, with gusts and a longer pole. Levels 6–10: a 2-D moon lander (main engine and
 * turning thrusters, moon gravity) that must touch down softly and upright on a pad, from further away,
 * onto a smaller pad, with wind and less fuel.
 *
 * Learner: policy search by the cross-entropy method — a small LINEAR controller (each control is a
 * weighted sum of the state, clipped to what the motor can do); he tries a population of variations,
 * keeps the best few and moves towards them. Ground truth: the success rate on a fixed set of held-out
 * start states he never trains on (training starts come from his own random numbers). The fuel he uses
 * is compared with a reference controller tuned by hand (a plain proportional-derivative design written
 * for this game), on the starts where both succeed.
 */
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, mentions, type Problem, rng, savedFor, type Shape, type Verdict } from './core';
import { BALANCE } from './meta';

export const taskFor = (level: number): 'pole' | 'lander' => (lvl(level) <= 5 ? 'pole' : 'lander');

// ---- the cart and pole -------------------------------------------------------------------------------------------

export interface PoleRules {
  /** One pole, or two side by side on the same cart (the classic double-pole task). */
  poles: 1 | 2;
  steps: number;
  /** Start spread: the (long) pole's angle (rad), position (m); speeds are a third of these. */
  angle: number;
  pos: number;
  /** Random pushes (N) the cart gets every step. */
  gust: number;
  /** Half the pole's length (m); with two poles, the long one is 0.5 and this is the short one. */
  half: number;
  /** How wrong his sensors are (a random error on each reading, in the state's own units). */
  noise: number;
  /** The reference controller's gains on each reading (position, speed, then angle and spin of each pole). */
  ref: number[];
}
export const FMAX = 10;
export const TRACK = 2.4;
/**
 * Each level is harder in a new way. 1: one pole. 2: wider starts, a longer run. 3: TWO poles on the same
 * cart, a long one and a short one (a new controller to learn: the short one falls fast, and one push has to
 * hold both). 4: the short pole three times as long, and a longer run — the closer the two lengths, the harder
 * they are to hold together. 5: closer still, with noisy sensors.
 * The reference controllers: level 1–2 gains picked by hand; for two poles, a linear-quadratic regulator
 * worked out for this cart (gym2.test.mjs checks they succeed).
 */
export function poleRules(level: number): PoleRules {
  const L = lvl(level);
  return [
    { poles: 1, steps: 200, angle: 0.05, pos: 0.05, gust: 0, half: 0.5, noise: 0, ref: [1, 2.2, 30, 6] },
    { poles: 1, steps: 600, angle: 0.15, pos: 1.2, gust: 0, half: 0.5, noise: 0, ref: [1, 2.2, 30, 6] },
    { poles: 2, steps: 600, angle: 0.05, pos: 0.1, gust: 0, half: 0.05, noise: 0, ref: DOUBLE_05 },
    { poles: 2, steps: 1000, angle: 0.12, pos: 0.6, gust: 0, half: 0.15, noise: 0, ref: DOUBLE_15 },
    { poles: 2, steps: 1000, angle: 0.12, pos: 0.6, gust: 0, half: 0.2, noise: 0.005, ref: DOUBLE_20 },
  ][Math.min(L, 5) - 1]! as PoleRules;
}
/** Linear-quadratic regulator gains for the double pole (short pole 0.05, 0.15 and 0.2 half-length), computed offline for this model. */
const DOUBLE_05 = [-2.8, -5.08, -88.8, -23.21, 55.97, 4.59];
const DOUBLE_15 = [-3.32, -6.29, -168.87, -44.13, 123.17, 17.47];
const DOUBLE_20 = [-3.4, -6.58, -219.76, -57.42, 170.48, 27.98];
const DT = 0.02;
const LIMIT_A = (12 * Math.PI) / 180;
const LIMIT_2 = (36 * Math.PI) / 180;

/**
 * One step (0.02 s) of the cart and pole(s). One pole: Barto, Sutton & Anderson's equations, s = [x, ẋ, θ,
 * θ̇]. Two poles: the standard double-pole equations (Wieland), in four Euler steps of 5 ms, s = [x, ẋ, θ1,
 * θ̇1, θ2, θ̇2]; masses: cart 1 kg, poles 0.1 kg and a tenth of that for the short one.
 */
export function poleStep(s: number[], force: number, R: { poles: number; half: number }): void {
  if (R.poles === 2) {
    const h = DT / 4;
    const L1 = 0.5;
    const L2 = R.half;
    const m1 = 0.1;
    const m2 = 0.1 * (R.half / 0.5);
    for (let k = 0; k < 4; k++) {
      const [, xd, t1, t1d, t2, t2d] = s as [number, number, number, number, number, number];
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const c2 = Math.cos(t2);
      const s2 = Math.sin(t2);
      const f1 = m1 * L1 * t1d * t1d * s1 + 0.75 * m1 * c1 * (-9.8 * s1);
      const f2 = m2 * L2 * t2d * t2d * s2 + 0.75 * m2 * c2 * (-9.8 * s2);
      const e1 = m1 * (1 - 0.75 * c1 * c1);
      const e2 = m2 * (1 - 0.75 * c2 * c2);
      const xacc = (force + f1 + f2) / (1 + e1 + e2);
      const a1 = (-0.75 * (xacc * c1 - 9.8 * s1)) / L1;
      const a2 = (-0.75 * (xacc * c2 - 9.8 * s2)) / L2;
      s[0]! += h * xd;
      s[1]! += h * xacc;
      s[2]! += h * t1d;
      s[3]! += h * a1;
      s[4]! += h * t2d;
      s[5]! += h * a2;
    }
    return;
  }
  const [, xd, th, thd] = s as [number, number, number, number];
  const half = R.half;
  const mc = 1;
  const mp = 0.1;
  const M = mc + mp;
  const sin = Math.sin(th);
  const cos = Math.cos(th);
  const temp = (force + mp * half * thd * thd * sin) / M;
  const thacc = (9.8 * sin - cos * temp) / (half * (4 / 3 - (mp * cos * cos) / M));
  const xacc = temp - (mp * half * thacc * cos) / M;
  s[0]! += DT * xd;
  s[1]! += DT * xacc;
  s[2]! += DT * thd;
  s[3]! += DT * thacc;
}
const poleFailed = (s: number[], R: PoleRules) =>
  Math.abs(s[0]!) > TRACK || (R.poles === 2 ? Math.abs(s[2]!) > LIMIT_2 || Math.abs(s[4]!) > LIMIT_2 : Math.abs(s[2]!) > LIMIT_A);

function poleStart(R: PoleRules, r: () => number): number[] {
  const u = (a: number) => (r() * 2 - 1) * a;
  return R.poles === 2 ? [u(R.pos), u(R.pos / 3), u(R.angle), u(R.angle / 3), 0, 0] : [u(R.pos), u(R.pos / 3), u(R.angle), u(R.angle / 3)];
}

// ---- the lander ----------------------------------------------------------------------------------------------------

export interface LanderRules {
  /** Start spread across (m) and the start height range. */
  spread: number;
  pad: number;
  fuel: number;
  /** Steady wind (m/s² sideways, up to) and gusts. */
  wind: number;
  gust: number;
  /** Full main engine (m/s² along the lander's axis). */
  thrust: number;
  /** How slowly the engine follows the throttle (seconds; 0 = at once). */
  lag: number;
  /** Whether he has a wind gauge (without one, the wind shows only in how he drifts). */
  gauge: boolean;
}
/**
 * The lander gets harder in new ways: further away, a smaller pad and a steady wind; then gusts and a weaker
 * engine; then no wind gauge (the wind shows only in his drift); then an engine that answers the throttle
 * late and a smaller pad.
 */
export function landerRules(level: number): LanderRules {
  const L = Math.max(6, lvl(level));
  return [
    { spread: 15, pad: 10, fuel: 60, wind: 0, gust: 0, thrust: 4, lag: 0, gauge: true },
    { spread: 40, pad: 4, fuel: 50, wind: 0.4, gust: 0, thrust: 4, lag: 0, gauge: true },
    { spread: 40, pad: 4, fuel: 45, wind: 0.4, gust: 0.6, thrust: 3, lag: 0, gauge: true },
    { spread: 40, pad: 4, fuel: 45, wind: 0.4, gust: 0.6, thrust: 3, lag: 0, gauge: false },
    { spread: 40, pad: 3, fuel: 45, wind: 0.4, gust: 0.6, thrust: 3, lag: 1, gauge: false },
  ][L - 6]!;
}
export const MOON = 1.62;
/** Turning thrusters: rad/s². */
const TURN = 1.5;
const LDT = 0.05;
const LSTEPS = 1400;

/** s = [x, y, vx, vy, angle (0 upright, + leans right), spin, fuel, wind, engine (0–1, what it gives now)]. */
function landerStart(R: LanderRules, r: () => number): number[] {
  const u = (a: number) => (r() * 2 - 1) * a;
  return [u(R.spread), 60 + r() * 30, u(3), -r() * 2, u(0.1), 0, R.fuel, u(R.wind), 0];
}
/** One step: throttle u (0–1), turn t (−1–1), gust g (m/s²). Fuel burns 1 a second at full engine, a fifth of that per thruster. */
export function landerStep(s: number[], u: number, t: number, g: number, R: LanderRules): void {
  if (s[6]! <= 0) (u = 0), (t = 0);
  u = Math.max(0, Math.min(1, u));
  t = Math.max(-1, Math.min(1, t));
  // A slow engine moves towards the throttle a little each step.
  s[8] = R.lag ? s[8]! + (u - s[8]!) * Math.min(1, LDT / R.lag) : u;
  u = s[8]!;
  const a = s[4]!;
  s[2]! += LDT * (Math.sin(a) * R.thrust * u + s[7]! + g);
  s[3]! += LDT * (Math.cos(a) * R.thrust * u - MOON);
  s[5]! += LDT * TURN * t;
  s[0]! += LDT * s[2]!;
  s[1]! += LDT * s[3]!;
  s[4]! += LDT * s[5]!;
  s[6] = Math.max(0, s[6]! - LDT * (u + 0.2 * Math.abs(t)));
}
/** Touched down: safe means slow, upright and on the pad. */
export const landedSafely = (s: number[], R: LanderRules) => Math.abs(s[3]!) < 2 && Math.abs(s[2]!) < 1 && Math.abs(s[4]!) < 0.25 && Math.abs(s[0]!) < R.pad;

// ---- controllers and runs ------------------------------------------------------------------------------------------

/** A linear controller: each output a weighted sum of the (scaled) state plus a bias. */
export type Policy = Float64Array;
/** How many numbers his controller has at a level: one pole 4 + 1, two poles 6 + 1, the lander 2 × (7 + 1). */
export const dims = (level: number) => (taskFor(level) === 'lander' ? 16 : poleRules(level).poles === 2 ? 7 : 5);

const poleFeat = (s: number[]) => (s.length >= 6 ? [s[0]!, s[1]!, s[2]! * 10, s[3]!, s[4]! * 10, s[5]!] : [s[0]!, s[1]!, s[2]! * 10, s[3]!]);
/** What the lander senses: across, height, drift, fall speed, lean, spin, and the wind (when he has a wind gauge). */
const landerFeat = (s: number[], gauge: boolean) => [s[0]! / 20, s[1]! / 50, s[2]! / 5, s[3]! / 5, s[4]!, s[5]!, gauge ? s[7]! * 2 : 0];

function polePolicy(w: Policy, s: number[]): number {
  const f = poleFeat(s);
  let x = w[f.length]!;
  for (let i = 0; i < f.length; i++) x += w[i]! * f[i]!;
  return Math.max(-FMAX, Math.min(FMAX, x * 10));
}
function landerPolicy(w: Policy, s: number[], gauge: boolean): [number, number] {
  const f = landerFeat(s, gauge);
  let u = w[7]!;
  let t = w[15]!;
  for (let i = 0; i < 7; i++) (u += w[i]! * f[i]!), (t += w[8 + i]! * f[i]!);
  return [u, t];
}

/** The hand-tuned reference: a proportional-derivative design (gains picked by hand for this game). */
export function referencePole(s: number[], R: PoleRules): number {
  let f = 0;
  for (let i = 0; i < R.ref.length; i++) f += R.ref[i]! * s[i]!;
  return Math.max(-FMAX, Math.min(FMAX, f));
}
export function referenceLander(s: number[], R: LanderRules = landerRules(6)): [number, number] {
  const [x, y, vx, vy, a, w] = s as [number, number, number, number, number, number];
  // Sink at a speed that shrinks with height; lean to steer over the pad; straighten up near the ground.
  const want = -Math.max(0.8, Math.min(6, 0.1 * y));
  const u = (MOON + 2 * (want - vy)) / (R.thrust * Math.max(0.5, Math.cos(a)));
  // (It reads the wind gauge too, when there is one, and leans against the wind.)
  const ax = -0.12 * x - 0.7 * vx - (R.gauge ? s[7]! : 0);
  const lean = y < 4 ? 0 : Math.max(-0.4, Math.min(0.4, ax / R.thrust));
  return [u, 4 * (lean - a) - 2.5 * w];
}

export interface Run {
  ok: boolean;
  steps: number;
  fuel: number;
  /** Every few steps, for WATCH. */
  trace: number[][];
  why: string;
}

/** One run from a start: the pole or the lander, controlled by `ctl`. */
export function runPole(R: PoleRules, start: number[], ctl: (s: number[]) => number, r: () => number, trace = 0): Run {
  const s = start.slice();
  let effort = 0;
  const tr: number[][] = [];
  for (let i = 0; i < R.steps; i++) {
    // What the controller sees: the state, with sensor noise at the harder levels.
    const seen = R.noise ? s.map((x) => x + (r() * 2 - 1) * R.noise) : s;
    const f = ctl(seen);
    effort += Math.abs(f) * DT;
    if (trace && i % trace === 0) tr.push([...s, f]);
    poleStep(s, f + (R.gust ? (r() * 2 - 1) * R.gust : 0), R);
    if (poleFailed(s, R)) {
      tr.push([...s, 0]);
      return { ok: false, steps: i + 1, fuel: effort, trace: tr, why: Math.abs(s[2]!) > LIMIT_A ? 'the pole fell' : 'the cart ran off the track' };
    }
  }
  tr.push([...s, 0]);
  return { ok: true, steps: R.steps, fuel: effort, trace: tr, why: 'balanced to the end' };
}
export function runLander(R: LanderRules, start: number[], ctl: (s: number[]) => [number, number], r: () => number, trace = 0): Run {
  const s = start.slice();
  const tr: number[][] = [];
  for (let i = 0; i < LSTEPS; i++) {
    const [u, t] = ctl(s);
    if (trace && i % trace === 0) tr.push(s.slice());
    landerStep(s, u, t, R.gust ? (r() * 2 - 1) * R.gust : 0, R);
    if (s[1]! <= 0) {
      s[1] = 0;
      const ok = landedSafely(s, R);
      tr.push(s.slice());
      const why = ok ? 'a soft landing on the pad' : Math.abs(s[0]!) >= R.pad ? 'touched down off the pad' : Math.abs(s[4]!) >= 0.25 ? 'landed tilted over' : 'came down too hard';
      return { ok, steps: i + 1, fuel: R.fuel - s[6]!, trace: tr, why };
    }
    if (Math.abs(s[4]!) > 1.2) {
      tr.push(s.slice());
      return { ok: false, steps: i + 1, fuel: R.fuel - s[6]!, trace: tr, why: 'tipped over in the air' };
    }
    if (Math.abs(s[0]!) > 120 || s[1]! > 200) break;
  }
  tr.push(s.slice());
  return { ok: false, steps: LSTEPS, fuel: R.fuel - s[6]!, trace: tr, why: 'never came down on the pad' };
}

/** The held-out start states for a level (never used in training: training starts come from his own random numbers). */
export const HELD_OUT = 40;
export function heldOut(level: number): { start: number[]; seed: number }[] {
  const L = lvl(level);
  const r = rng(777_000 + L * 101);
  return Array.from({ length: HELD_OUT }, (_, i) => {
    const seed = 900_000 + L * 1000 + i;
    return { start: taskFor(L) === 'pole' ? poleStart(poleRules(L), r) : landerStart(landerRules(L), r), seed };
  });
}

/** A whole test: how many held-out starts a controller succeeds from, and the fuel (or effort) it used on each. */
function test(level: number, pole: ((s: number[]) => number) | null, lander: ((s: number[]) => [number, number]) | null): { ok: boolean[]; fuel: number[] } {
  const L = lvl(level);
  const ok: boolean[] = [];
  const fuel: number[] = [];
  for (const h of heldOut(L)) {
    const run = taskFor(L) === 'pole' ? runPole(poleRules(L), h.start, pole!, rng(h.seed)) : runLander(landerRules(L), h.start, lander!, rng(h.seed));
    ok.push(run.ok);
    fuel.push(run.fuel);
  }
  return { ok, fuel };
}
const refs = new Map<number, { ok: boolean[]; fuel: number[] }>();
export function reference(level: number): { ok: boolean[]; fuel: number[] } {
  const L = lvl(level);
  let x = refs.get(L);
  if (!x) refs.set(L, (x = test(L, (s) => referencePole(s, poleRules(L)), (s) => referenceLander(s, landerRules(L)))));
  return x;
}

// ---- the learner: the cross-entropy method -------------------------------------------------------------------------

interface BalanceSave {
  game: 'balance';
  task: 'pole' | 'lander';
  mean: Float64Array;
  sd: Float64Array;
  trials: number;
  rand: number;
}

const POP = 40;
const ELITE = 8;
const STARTS = 5;

class BalanceLearner implements Learner {
  task: 'pole' | 'lander';
  mean: Float64Array;
  sd: Float64Array;
  trials: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    this.task = taskFor(level);
    const n = dims(level);
    const s = savedFor<BalanceSave>(saved, 'balance');
    // What he learned carries over while the task stays the same; a new level widens his search a little.
    const keep = s && s.task === this.task && s.mean?.length === n;
    this.mean = keep ? s.mean : new Float64Array(n);
    this.sd = keep ? s.sd.map((x) => Math.max(x, 0.15)) : new Float64Array(n).fill(this.task === 'pole' ? 2 : 1);
    this.trials = s?.trials ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  private normal() {
    const u = Math.max(1e-9, this.r());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.r());
  }
  /** How well a controller does from a few of his own random starts: successes first, then time survived (or how close and soft he came down), less fuel. */
  private fitness(w: Policy, starts: number[][], seeds: number[]): number {
    let f = 0;
    for (let i = 0; i < starts.length; i++) {
      const rr = rng(seeds[i]!);
      if (this.task === 'pole') {
        const R = poleRules(this.level);
        const run = runPole(R, starts[i]!, (s) => polePolicy(w, s), rr);
        f += (run.ok ? 1 : 0) + run.steps / R.steps - 0.0005 * run.fuel;
      } else {
        const R = landerRules(this.level);
        const s = starts[i]!.slice();
        const run = runLander(R, s, (x) => landerPolicy(w, x, R.gauge), rr, 1e9);
        const end = run.trace[run.trace.length - 1]!;
        // Shaped so that every bit better counts: a slower crash beats a faster one, nearer the pad beats further.
        if (Math.abs(end[4]!) > 1.2) f -= 9 - Math.min(2, (run.steps * LDT) / 20);
        else if (end[1]! > 0.01) f -= 6 + Math.min(2, Math.abs(end[1]!) / 100);
        else
          f +=
            (run.ok ? 3 : 0) -
            Math.min(4, Math.max(0, Math.abs(end[3]!) - 1.5) / 3) -
            Math.min(1.5, Math.max(0, Math.abs(end[0]!) - R.pad * 0.5) / 20) -
            Math.min(1, Math.max(0, Math.abs(end[2]!) - 0.5) / 3) -
            Math.min(1, Math.abs(end[4]!)) -
            0.01 * run.fuel;
      }
    }
    return f / starts.length;
  }
  train(_n: number) {
    // One generation: POP variations of his controller, each tried from the same few random starts.
    const n = this.mean.length;
    const starts: number[][] = [];
    const seeds: number[] = [];
    for (let i = 0; i < STARTS; i++) {
      starts.push(this.task === 'pole' ? poleStart(poleRules(this.level), this.r) : landerStart(landerRules(this.level), this.r));
      seeds.push(Math.floor(this.r() * 1e9));
    }
    const pop: { w: Policy; f: number }[] = [];
    for (let k = 0; k < POP; k++) {
      const w = new Float64Array(n);
      // The first one is his current controller as it is.
      for (let i = 0; i < n; i++) w[i] = this.mean[i]! + (k ? this.normal() * this.sd[i]! : 0);
      pop.push({ w, f: this.fitness(w, starts, seeds) });
    }
    pop.sort((a, b) => b.f - a.f);
    const elite = pop.slice(0, ELITE);
    for (let i = 0; i < n; i++) {
      const m = elite.reduce((x, e) => x + e.w[i]!, 0) / ELITE;
      const v = elite.reduce((x, e) => x + (e.w[i]! - m) ** 2, 0) / ELITE;
      this.mean[i] = m;
      // A little extra spread keeps him from settling too early.
      this.sd[i] = Math.sqrt(v) + 0.02;
    }
    this.trials += POP * STARTS;
    this.rand = (this.rand + 2654435761) >>> 0;
    return POP * STARTS;
  }
  private result() {
    return test(this.level, (s) => polePolicy(this.mean, s), (s) => landerPolicy(this.mean, s, landerRules(this.level).gauge));
  }
  measure() {
    const his = this.result();
    const ref = reference(this.level);
    const ok = his.ok.filter(Boolean).length;
    const rok = ref.ok.filter(Boolean).length;
    // Fuel (or pushing effort) on the starts where both succeed.
    const both = his.ok.map((x, i) => x && ref.ok[i]);
    const mine = his.fuel.reduce((t, f, i) => t + (both[i] ? f : 0), 0);
    const theirs = ref.fuel.reduce((t, f, i) => t + (both[i] ? f : 0), 0);
    const nb = both.filter(Boolean).length;
    const what = this.task === 'pole' ? 'keeps the pole up' : 'lands softly on the pad';
    const unit = this.task === 'pole' ? 'pushing effort' : 'fuel';
    const fuel = nb ? ` On the ${nb} where both succeed he uses ${Math.round((mine / Math.max(1e-9, theirs)) * 100)}% of the reference's ${unit}.` : '';
    return { mastery: ok / HELD_OUT, detail: `He ${what} from ${ok} of ${HELD_OUT} start positions he has never trained on; the hand-tuned reference controller manages ${rok}.${fuel}` };
  }
  save(): BalanceSave {
    return { game: 'balance', task: this.task, mean: this.mean, sd: this.sd, trials: this.trials, rand: this.rand };
  }
  view(): Frame {
    const w = this.mean;
    const two = this.task === 'pole' && poleRules(this.level).poles === 2;
    const names = this.task === 'pole' ? (two ? ['position', 'speed', 'long pole angle', 'long pole spin', 'short pole angle', 'short pole spin'] : ['position', 'speed', 'pole angle', 'pole spin']) : ['engine: across', 'engine: height', 'engine: drift', 'engine: fall speed', 'engine: lean', 'engine: wind', 'turn: across', 'turn: drift', 'turn: lean', 'turn: spin', 'turn: wind'];
    const idx = this.task === 'pole' ? (two ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3]) : [0, 1, 2, 3, 4, 6, 8, 10, 12, 13, 14];
    const mx = Math.max(1e-9, ...idx.map((i) => Math.abs(w[i]!)));
    return {
      bars: names.map((nm, k) => [nm, Math.abs(w[idx[k]!]!) / mx, `${w[idx[k]!]! >= 0 ? '+' : '−'}${Math.abs(w[idx[k]!]!).toFixed(2)}`] as [string, number, string]),
      caption: this.task === 'pole' ? 'How hard he pushes the cart for each thing he senses (his learned controller).' : 'How his engine and turning thrusters respond to what he senses (his learned controller).',
    };
  }
  watch(seed: number): Frame[] {
    const L = this.level;
    const r = rng(seed);
    if (this.task === 'pole') {
      const R = poleRules(L);
      const run = runPole(R, poleStart(R, r), (s) => polePolicy(this.mean, s), r, 4);
      return run.trace.map((s, i) => poleFrame(s, R, i === run.trace.length - 1 ? `${run.ok ? 'Balanced' : 'Failed'}: ${run.why} after ${((run.steps * DT) | 0).toString()} s.` : `${(i * 4 * DT).toFixed(1)} s · push ${s[4]! >= 0 ? 'right' : 'left'} ${Math.abs(s[4]!).toFixed(1)} N`));
    }
    const R = landerRules(L);
    const run = runLander(R, landerStart(R, r), (s) => landerPolicy(this.mean, s, R.gauge), r, 4);
    return run.trace.map((s, i) => landerFrame(s, R, i === run.trace.length - 1 ? `${run.ok ? 'Landed' : 'Failed'}: ${run.why} · fuel used ${(R.fuel - s[6]!).toFixed(1)} of ${R.fuel}.` : `${(i * 4 * LDT).toFixed(1)} s · height ${s[1]!.toFixed(0)} m · falling ${Math.max(0, -s[3]!).toFixed(1)} m/s · fuel ${s[6]!.toFixed(0)}`));
  }
}

// ---- pictures ---------------------------------------------------------------------------------------------------------

export function poleFrame(s: number[], R: PoleRules, caption: string): Frame {
  const W = 300;
  const H = 150;
  const sx = (x: number) => W / 2 + (x / TRACK) * (W / 2 - 20);
  const cx = sx(s[0]!);
  const len = R.half * 2 * 90;
  const shapes: Shape[] = [
    { k: 'line', x1: 10, y1: 120, x2: W - 10, y2: 120, c: 'rgba(120,200,255,.35)', sw: 2 },
    { k: 'line', x1: sx(-TRACK), y1: 110, x2: sx(-TRACK), y2: 130, c: '#ff4d6a', sw: 2 },
    { k: 'line', x1: sx(TRACK), y1: 110, x2: sx(TRACK), y2: 130, c: '#ff4d6a', sw: 2 },
    { k: 'rect', x: cx - 18, y: 104, w: 36, h: 14, c: 'var(--c)' },
    { k: 'line', x1: cx, y1: 104, x2: cx + Math.sin(s[2]!) * (R.poles === 2 ? 90 : len), y2: 104 - Math.cos(s[2]!) * (R.poles === 2 ? 90 : len), c: '#ffd24d', sw: 4 },
  ];
  if (R.poles === 2) shapes.push({ k: 'line', x1: cx + 6, y1: 104, x2: cx + 6 + Math.sin(s[4]!) * len, y2: 104 - Math.cos(s[4]!) * len, c: '#ff9f43', sw: 4 });
  // The push is the last number of a traced state.
  const f = s[s.length - 1] ?? 0;
  if (Math.abs(f) > 0.5) shapes.push({ k: 'line', x1: cx - Math.sign(f) * 22, y1: 111, x2: cx - Math.sign(f) * (22 + Math.abs(f) * 2.5), y2: 111, c: '#4fe3a8', sw: 3 });
  return { draw: { w: W, h: H, shapes }, caption, every: 0.08 };
}

export function landerFrame(s: number[], R: LanderRules, caption: string): Frame {
  const W = 300;
  const H = 200;
  const sx = (x: number) => W / 2 + x * 2.4;
  const sy = (y: number) => 185 - y * 1.8;
  const x = sx(s[0]!);
  const y = sy(s[1]!);
  const a = s[4]!;
  const rot = (dx: number, dy: number) => [x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a)];
  const body = [rot(-6, 4), rot(6, 4), rot(4, -6), rot(-4, -6)].flat();
  const shapes: Shape[] = [
    { k: 'rect', x: 0, y: 185, w: W, h: 15, c: 'rgba(120,200,255,.18)' },
    { k: 'rect', x: sx(-R.pad), y: 183, w: sx(R.pad) - sx(-R.pad), h: 4, c: '#4fe3a8' },
    { k: 'poly', pts: body, c: 'var(--c)' },
    { k: 'line', x1: rot(-5, 4)[0]!, y1: rot(-5, 4)[1]!, x2: rot(-8, 9)[0]!, y2: rot(-8, 9)[1]!, c: 'var(--c)', sw: 1.5 },
    { k: 'line', x1: rot(5, 4)[0]!, y1: rot(5, 4)[1]!, x2: rot(8, 9)[0]!, y2: rot(8, 9)[1]!, c: 'var(--c)', sw: 1.5 },
  ];
  const u = s[8] ?? 0;
  if (u > 0.05) {
    const [fx, fy] = rot(0, 4 + u * 14);
    const [bx, by] = rot(0, 4);
    shapes.push({ k: 'line', x1: bx!, y1: by!, x2: fx!, y2: fy!, c: '#ffd24d', sw: 3 });
  }
  // Fuel gauge.
  shapes.push({ k: 'rect', x: 8, y: 8, w: 60, h: 6, c: 'rgba(120,200,255,.2)' }, { k: 'rect', x: 8, y: 8, w: (60 * s[6]!) / R.fuel, h: 6, c: '#ffd24d' });
  return { draw: { w: W, h: H, shapes }, caption, every: 0.08 };
}

// ---- the environment and problems -----------------------------------------------------------------------------------

/** Actions — the pole: 0 push left, 1 push right. The lander: 0 coast, 1 main engine, 2 turn left, 3 turn right, 4 engine + left, 5 engine + right. */
class BalanceEnv implements Env {
  s: number[] = [];
  n = 0;
  r: () => number = rng(1);
  constructor(private level: number) {}
  reset(seed: number) {
    this.r = rng(seed);
    this.n = 0;
    this.s = taskFor(this.level) === 'pole' ? poleStart(poleRules(this.level), this.r) : landerStart(landerRules(this.level), this.r);
  }
  actions() {
    return taskFor(this.level) === 'pole' ? [0, 1] : [0, 1, 2, 3, 4, 5];
  }
  step(a: number) {
    this.n++;
    if (taskFor(this.level) === 'pole') {
      const R = poleRules(this.level);
      poleStep(this.s, a ? FMAX : -FMAX, R);
      const dead = poleFailed(this.s, R);
      return { reward: dead ? 0 : 1, done: dead || this.n >= R.steps };
    }
    const R = landerRules(this.level);
    const u = a === 1 || a >= 4 ? 1 : 0;
    const t = a === 2 || a === 4 ? -1 : a === 3 || a === 5 ? 1 : 0;
    const before = this.s[6]!;
    landerStep(this.s, u, t, R.gust ? (this.r() * 2 - 1) * R.gust : 0, R);
    if (this.s[1]! <= 0) return { reward: landedSafely(this.s, R) ? 100 : -100, done: true };
    return { reward: -(before - this.s[6]!), done: this.n >= LSTEPS };
  }
  describe() {
    const s = this.s;
    if (taskFor(this.level) === 'pole') return `Cart and pole: the cart is ${s[0]!.toFixed(2)} m from the centre (track ends at ±${TRACK} m), moving ${s[1]!.toFixed(2)} m/s; the pole leans ${((s[2]! * 180) / Math.PI).toFixed(1)}° (it falls past 12°), turning ${((s[3]! * 180) / Math.PI).toFixed(1)}°/s. Push left or right.`;
    return `Moon lander: ${s[0]!.toFixed(1)} m across from the pad centre, ${s[1]!.toFixed(1)} m up, drifting ${s[2]!.toFixed(1)} m/s across and ${s[3]!.toFixed(1)} m/s up, leaning ${((s[4]! * 180) / Math.PI).toFixed(0)}°, fuel ${s[6]!.toFixed(1)}. Land slower than 2 m/s, upright, on the pad.`;
  }
}

/**
 * Problems about the same physics. Pole levels: a pole leaning and falling with a steady angular
 * acceleration — when does it pass the 12° limit? Lander levels: falling at some speed, the engine fires
 * and stays on — at what height does it stop, or does it crash (and, higher up, does the fuel last)?
 */
function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed * 104729 + L);
  if (taskFor(L) === 'pole') {
    for (;;) {
      const th = Math.round(r() * (2 + L)) ;
      const om = Math.round((r() * 2 - 0.5) * (4 + 2 * L));
      const al = Math.round(5 + r() * (10 + 6 * L));
      // θ + ωt + ½αt² = 12
      const disc = om * om + 2 * al * (12 - th);
      const t = (-om + Math.sqrt(disc)) / al;
      if (!(t > 0.2 && t < 5)) continue;
      const text = `A pole on a cart leans ${th}° and is turning at ${om}°/s further over (negative means back towards upright), and it speeds up by a steady ${al}°/s² in the falling direction. After how many seconds does it pass 12°, where it counts as fallen? Answer in seconds to one decimal place.`;
      return { game: 'balance', level: L, seed, text, data: { kind: 'time', answer: Math.round(t * 100) / 100 } };
    }
  }
  for (;;) {
    const h = 10 + Math.round(r() * 80);
    const v = 1 + Math.round(r() * (4 + L));
    const a = Math.round((MOON + 0.5 + r() * 3) * 10) / 10;
    const net = a - MOON;
    const stop = h - (v * v) / (2 * net);
    const burnT = v / net;
    let fuel: number | null = null;
    if (L >= 8) fuel = Math.round((burnT * (0.5 + r())) * 10) / 10;
    const crash = stop < 0 || (fuel != null && fuel < burnT);
    if (!crash && stop < 0.5) continue;
    const text = `A lander on the moon (gravity 1.62 m/s²) is ${h} m up, falling at ${v} m/s. Its engine, once lit, pushes up at ${a} m/s² and stays on${fuel != null ? `, but it only has fuel for ${fuel} seconds of burning (after that it falls freely)` : ''}. If the engine is lit now, at what height (metres, one decimal) does the lander stop falling? If it reaches the ground first, answer "crash".`;
    return { game: 'balance', level: L, seed, text, data: { kind: 'height', answer: crash ? 'crash' : Math.round(stop * 100) / 100 } };
  }
}

/**
 * What a reply says: 'crash', a number, or NaN. A crash it rules out ("does not crash") is not a crash; a
 * number in brackets ("using g = 1.62") is working, not the answer; with units, only numbers in the right
 * unit count; two different numbers is not an answer.
 */
export function readBalance(answer: string, unit: 'm' | 's'): number | 'crash' {
  const line = finalLine(answer).toLowerCase().replace(/[−–]/g, '-').replace(/\([^)]*\)/g, ' ').replace(/\b[a-z]\s*=\s*-?\d+(\.\d+)?/g, ' ');
  const crash = mentions(line, /\bcrash(es|ed|ing)?\b/g);
  if (crash.some((c) => !c.negated)) return crash.some((c) => c.negated) ? NaN : 'crash';
  const all = [...line.matchAll(/(-?\d+(?:\.\d+)?)\s*(m|metres?|meters?|s|secs?|seconds?)?\b/g)];
  // Numbers in the right unit, and bare numbers (a number in another unit is something else).
  const pick = all.filter((x) => !x[2] || x[2][0] === unit);
  const vals = [...new Set(pick.map((x) => Number(x[1])))];
  return vals.length === 1 ? vals[0]! : NaN;
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { kind: string; answer: number | 'crash' };
  const said = readBalance(answer, d.kind === 'time' ? 's' : 'm');
  if (d.answer === 'crash') {
    const ok = said === 'crash';
    return { correct: ok, score: ok ? 1 : 0, why: ok ? 'Right: it crashes.' : 'It reaches the ground before it stops: crash.' };
  }
  const ok = typeof said === 'number' && Math.abs(said - d.answer) <= 0.11;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'Right.' : `${d.answer.toFixed(1)}${d.kind === 'time' ? ' s' : ' m'}.` };
}

export const balance: Game = {
  ...BALANCE,
  env: (level) => new BalanceEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new BalanceLearner(level, seed, saved),
};
