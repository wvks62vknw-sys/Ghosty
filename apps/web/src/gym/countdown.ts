/**
 * COUNTDOWN / 24 GAME: reach the target from the numbers with + − × ÷. Levels 1–4 are the 24-game kind
 * (use every number exactly once); Levels 5–10 are Countdown's (use each at most once), with more numbers
 * and bigger targets. Every step must give a whole number above zero. An exhaustive solver (every way of
 * combining two numbers, repeated, duplicates skipped) is the ground truth: only solvable problems are set.
 * Ghosty searches depth-first with a budget of steps and learns the ORDER in which to try combinations —
 * a score from a few facts about each (how close the result gets, which operation, whether it is one step
 * from the target, a factor of it, uses a big number) — by evolution on a set of practice problems (a
 * nudge to the weights is kept when he solves at least as many in fewer tries). Mastery = the share of a
 * different, fixed set of problems he solves within a third of the tries the plain order (no learning, every
 * combination as it comes) needs — so where he starts, the plain order, is 0%.
 */
import { type Env, type Frame, type Game, type Learner, lvl, type Problem, randInt, rng, savedFor, shuffle, type Verdict } from './core';
import { COUNTDOWN } from './meta';

const OPS = ['+', '−', '×', '÷'];

export interface Spec {
  count: number;
  exact: boolean;
  /** Target range. */
  lo: number;
  hi: number;
  /** How many big numbers (25 50 75 100) among them. */
  large: number;
  /** The highest small number. */
  smallMax: number;
}

export const specFor = (level: number): Spec =>
  [
    { count: 3, exact: true, lo: 10, hi: 40, large: 0, smallMax: 9 },
    { count: 4, exact: true, lo: 24, hi: 24, large: 0, smallMax: 9 },
    { count: 4, exact: true, lo: 24, hi: 24, large: 0, smallMax: 13 },
    { count: 4, exact: true, lo: 25, hi: 60, large: 0, smallMax: 13 },
    { count: 5, exact: false, lo: 100, hi: 300, large: 1, smallMax: 10 },
    { count: 5, exact: false, lo: 100, hi: 500, large: 2, smallMax: 10 },
    { count: 6, exact: false, lo: 100, hi: 999, large: 2, smallMax: 10 },
    { count: 6, exact: false, lo: 100, hi: 999, large: 1, smallMax: 10 },
    { count: 6, exact: false, lo: 100, hi: 999, large: 3, smallMax: 10 },
    { count: 6, exact: false, lo: 500, hi: 999, large: 1, smallMax: 10 },
  ][lvl(level) - 1]!;

export interface Step {
  a: number;
  b: number;
  op: number;
  r: number;
}

/** a op b, or −1 when the rules forbid it (not a whole number above zero). ÷1 only when `one` allows it. */
export function apply(a: number, b: number, op: number, one = false): number {
  if (op === 0) return a + b;
  if (op === 1) return a > b ? a - b : -1;
  if (op === 2) return a * b;
  return (b > 1 || (one && b === 1)) && a % b === 0 ? a / b : -1;
}

/**
 * Every allowed combination of two of the numbers (bigger first). ×1 and ÷1 change nothing, so they are
 * skipped — except when every number must be used (`exact`, the 24 game), where they are how a 1 is used up.
 */
export function moves(nums: number[], exact = false): { i: number; j: number; s: Step }[] {
  const out: { i: number; j: number; s: Step }[] = [];
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const a = nums[i]!;
      const b = nums[j]!;
      if (a < b || (a === b && i > j)) continue;
      for (let op = 0; op < 4; op++) {
        if (op === 2 && b === 1 && !exact) continue;
        const r = apply(a, b, op, exact);
        if (r > 0) out.push({ i, j, s: { a, b, op, r } });
      }
    }
  return out;
}

const after = (nums: number[], i: number, j: number, r: number) => [...nums.filter((_, k) => k !== i && k !== j), r];
const keyOf = (nums: number[]) => nums.slice().sort((x, y) => x - y).join(',');
const done = (nums: number[], target: number, exact: boolean) => (exact ? nums.length === 1 && nums[0] === target : nums.includes(target));

/** Ground truth: a solution (list of steps) if one exists. Exhaustive, with repeated states skipped. */
export function solve(nums: number[], target: number, exact: boolean): Step[] | null {
  const seen = new Set<string>();
  const rec = (ns: number[]): Step[] | null => {
    if (done(ns, target, exact)) return [];
    if (ns.length === 1) return null;
    const k = keyOf(ns);
    if (seen.has(k)) return null;
    seen.add(k);
    for (const m of moves(ns, exact)) {
      const rest = rec(after(ns, m.i, m.j, m.s.r));
      if (rest) return [m.s, ...rest];
    }
    return null;
  };
  return rec(nums);
}

export interface Puzzle {
  nums: number[];
  target: number;
  exact: boolean;
}

export function makePuzzle(level: number, seed: number): Puzzle {
  const sp = specFor(level);
  const r = rng(seed * 17 + lvl(level));
  for (;;) {
    const big = shuffle(r, [25, 50, 75, 100]).slice(0, sp.large);
    const nums = [...big, ...Array.from({ length: sp.count - sp.large }, () => randInt(r, 1, sp.smallMax))];
    const target = randInt(r, sp.lo, sp.hi);
    if (nums.includes(target)) continue;
    if (solve(nums, target, sp.exact)) return { nums, target, exact: sp.exact };
  }
}

export const FEATURES = 10;
/** Facts about one combination: how close it gets, the operation, whether it hits or is one step away, factors, big numbers. */
export function features(nums: number[], i: number, j: number, s: Step, target: number): number[] {
  const near = Math.abs(s.r - target) / Math.max(1, target);
  const rest = nums.filter((_, k) => k !== i && k !== j);
  const oneAway = rest.some((x) => [0, 1, 2, 3].some((op) => apply(Math.max(x, s.r), Math.min(x, s.r), op) === target));
  return [
    1 - Math.min(1, near),
    s.op === 0 ? 1 : 0,
    s.op === 1 ? 1 : 0,
    s.op === 2 ? 1 : 0,
    s.op === 3 ? 1 : 0,
    s.r === target ? 1 : 0,
    s.a >= 25 || s.b >= 25 ? 1 : 0,
    oneAway ? 1 : 0,
    s.r > 1 && target % s.r === 0 ? 1 : 0,
    Math.min(s.r, target) / Math.max(s.r, target),
  ];
}
const dot = (w: number[], f: number[]) => f.reduce((t, x, i) => t + x * w[i]!, 0);

/** His search: depth-first, combinations tried best-scored first; one step per combination tried. */
export function search(p: Puzzle, w: number[], budget: number): { route: Step[]; steps: number } | null {
  let steps = 0;
  const seen = new Set<string>();
  const rec = (ns: number[]): Step[] | null => {
    if (done(ns, p.target, p.exact)) return [];
    if (ns.length === 1) return null;
    const k = keyOf(ns);
    if (seen.has(k)) return null;
    seen.add(k);
    const scored = moves(ns, p.exact)
      .map((m, idx) => ({ m, idx, sc: dot(w, features(ns, m.i, m.j, m.s, p.target)) }))
      .sort((x, y) => y.sc - x.sc || x.idx - y.idx);
    for (const { m } of scored) {
      if (++steps > budget) return null;
      const rest = rec(after(ns, m.i, m.j, m.s.r));
      if (rest) return [m.s, ...rest];
      if (steps > budget) return null;
    }
    return null;
  };
  const route = rec(p.nums);
  return route ? { route, steps } : null;
}

export const budgetFor = (level: number) => [40, 120, 200, 300, 2000, 3000, 3000, 5000, 6000, 8000][lvl(level) - 1]!;

/** Tries the plain order (every combination as it comes, no learning) needs, counted up to 3 × the level's budget. */
export function plainSteps(p: Puzzle, level: number): number {
  const cap = 3 * budgetFor(level);
  return search(p, new Array(FEATURES).fill(0), cap)?.steps ?? cap;
}
/** His allowance on a puzzle: a third of what the plain order needs (never more than the level's budget). */
export const limitFor = (plain: number) => Math.floor(plain / 3);

export interface Graded {
  p: Puzzle;
  limit: number;
}
/** A fixed set of problems, each with its allowance; problems the plain order solves in under 6 tries are left out. */
function graded(level: number, from: number, size: number): Graded[] {
  const out: Graded[] = [];
  for (let seed = from; out.length < size; seed++) {
    const p = makePuzzle(level, seed);
    const plain = plainSteps(p, level);
    if (plain >= 6) out.push({ p, limit: limitFor(plain) });
  }
  return out;
}
const benches = new Map<number, Graded[]>();
export function bench(level: number): Graded[] {
  const L = lvl(level);
  let b = benches.get(L);
  if (!b) benches.set(L, (b = graded(L, 70000, 20)));
  return b;
}

const stepText = (s: Step) => `${s.a} ${OPS[s.op]} ${s.b} = ${s.r}`;
const rulesText = (p: Puzzle) => (p.exact ? 'use every number exactly once' : 'use each number at most once');

class CountEnv implements Env {
  p: Puzzle = makePuzzle(1, 1);
  nums: number[] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    this.p = makePuzzle(this.level, seed);
    this.nums = this.p.nums.slice();
  }
  /** Index into moves(nums) at this moment. */
  actions() {
    return moves(this.nums, this.p.exact).map((_, i) => i);
  }
  step(a: number) {
    const m = moves(this.nums, this.p.exact)[a];
    if (!m) return { reward: -1, done: true };
    this.nums = after(this.nums, m.i, m.j, m.s.r);
    const win = done(this.nums, this.p.target, this.p.exact);
    return { reward: win ? 10 : -0.1, done: win || this.nums.length === 1 };
  }
  describe() {
    return `Numbers ${this.nums.join(' ')}; target ${this.p.target} (${rulesText(this.p)}; + − × ÷, whole numbers only).`;
  }
}

interface CountSave {
  game: 'countdown';
  level: number;
  w: number[];
  best: number;
  sigma: number;
  problems: number;
  rand: number;
}

const practices = new Map<number, Graded[]>();
function practiceSet(level: number): Graded[] {
  const L = lvl(level);
  let b = practices.get(L);
  if (!b) practices.set(L, (b = graded(L, 80000, 30)));
  return b;
}

class CountLearner implements Learner {
  w: number[];
  problems: number;
  rand: number;
  sigma: number;
  best: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<CountSave>(saved, 'countdown');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts knowing nothing: every combination looks the same, so he tries them in the order they come.
    this.w = s?.w?.length === FEATURES ? s.w.slice() : new Array(FEATURES).fill(0);
    this.problems = s?.problems ?? 0;
    this.sigma = s?.sigma ?? 1;
    this.best = s?.level === level ? s.best : this.practice(this.w);
  }
  /** How he does on the practice problems with weights w: solved first, then fewer tries. */
  practice(w: number[]): number {
    let sc = 0;
    for (const { p, limit } of practiceSet(this.level)) {
      const s = search(p, w, limit);
      sc += s ? 100_000 - s.steps : -limit;
    }
    return sc;
  }
  /** (1+1) evolution: nudge the weights, keep the nudge when the practice problems go at least as well. */
  train(n: number) {
    let done = 0;
    while (done < n) {
      const u = Math.max(1e-9, this.r());
      const cand = this.w.map((x) => x + this.sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.r()) * (this.r() < 0.5 ? 1 : -1));
      const sc = this.practice(cand);
      done += practiceSet(this.level).length;
      if (sc >= this.best) {
        this.w = cand;
        this.best = sc;
        this.sigma = Math.min(3, this.sigma * 1.4);
      } else this.sigma = Math.max(0.05, this.sigma * 0.9);
    }
    this.problems += done;
    this.rand = (this.rand + done * 2654435761) >>> 0;
    return done;
  }
  measure() {
    const set = bench(this.level);
    let ok = 0;
    for (const { p, limit } of set) if (search(p, this.w, limit)) ok++;
    const sp = specFor(this.level);
    return {
      mastery: ok / set.length,
      detail: `${sp.count} numbers, ${sp.exact ? 'all used' : 'each at most once'}: he solves ${ok} of ${set.length} in a third of the tries the plain order needs (every one is solvable — checked by exhaustive search).`,
    };
  }
  save(): CountSave {
    return { game: 'countdown', level: this.level, w: this.w.slice(), best: this.best, sigma: this.sigma, problems: this.problems, rand: this.rand };
  }
  view(): Frame {
    const names = ['gets close to the target', 'adding', 'subtracting', 'multiplying', 'dividing', 'hits the target', 'uses a big number', 'one step from the target', 'a factor of the target', 'about the right size'];
    const mx = Math.max(0.01, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]! >= 0 ? 'tries first' : 'tries later'] as [string, number, string]), caption: 'What makes him try a combination early.' };
  }
  watch(seed: number): Frame[] {
    const p = makePuzzle(this.level, seed);
    const s = search(p, this.w, budgetFor(this.level) * 4);
    const head = `Numbers ${p.nums.join(' ')} → ${p.target}`;
    if (!s) return [{ lines: [head], caption: 'He ran out of tries on this one.' }];
    const frames: Frame[] = [{ lines: [head], caption: `He found a way after ${s.steps} tries.` }];
    s.route.forEach((st, i) => frames.push({ lines: [head, ...s.route.slice(0, i + 1).map(stepText)], caption: i === s.route.length - 1 ? `${p.target}!` : `Step ${i + 1}` }));
    return frames;
  }
}

// ---- checking an answer -----------------------------------------------------------------------------------

/** Evaluate an expression by the rules (whole numbers above zero at every step); the numbers it used. */
export function evaluate(expr: string): { value: number; used: number[] } | { error: string } {
  const t = expr.replace(/[x×*]/g, '*').replace(/[÷:/]/g, '/').replace(/[−–]/g, '-').match(/\d+|[-+*/()]/g) ?? [];
  let i = 0;
  const used: number[] = [];
  const fail = (e: string): never => {
    throw new Error(e);
  };
  const atom = (): number => {
    const x = t[i++];
    if (x === '(') {
      const v = sum();
      if (t[i++] !== ')') fail('a bracket is not closed');
      return v;
    }
    if (!x || !/^\d+$/.test(x)) fail('the expression is incomplete');
    used.push(Number(x));
    return Number(x);
  };
  const prod = (): number => {
    let v = atom();
    while (t[i] === '*' || t[i] === '/') {
      const mul = t[i++] === '*';
      const b = atom();
      if (!mul && (b === 0 || v % b !== 0)) fail('a division does not come out whole');
      v = mul ? v * b : v / b;
    }
    return v;
  };
  const sum = (): number => {
    let v = prod();
    while (t[i] === '+' || t[i] === '-') {
      const add = t[i++] === '+';
      const b = prod();
      v = add ? v + b : v - b;
      if (v <= 0) fail('a step goes to zero or below');
    }
    return v;
  };
  try {
    const value = sum();
    if (i < t.length) fail('there is something extra at the end');
    return { value, used };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function generate(level: number, seed: number): Problem {
  const p = makePuzzle(level, seed);
  const text = `Reach ${p.target} from the numbers ${p.nums.join(', ')} with + − × ÷ (${rulesText(p)}; every step must give a whole number above zero). Answer with one expression, e.g. (3 + 5) × 3.`;
  return { game: 'countdown', level: lvl(level), seed, text, data: p };
}

function check(prob: Problem, answer: string): Verdict {
  const p = prob.data as Puzzle;
  const line = answer.split('\n').find((l) => /\d/.test(l)) ?? '';
  const e = evaluate(line.split('=')[0]!);
  if ('error' in e) return { correct: false, score: 0, why: `Not valid: ${e.error}.` };
  const pool = p.nums.slice();
  for (const u of e.used) {
    const k = pool.indexOf(u);
    if (k < 0) return { correct: false, score: 0, why: `${u} is not one of the numbers left.` };
    pool.splice(k, 1);
  }
  if (p.exact && pool.length) return { correct: false, score: 0, why: 'Every number must be used.' };
  if (e.value === p.target) return { correct: true, score: 1, why: `${p.target} — right.` };
  const off = Math.abs(e.value - p.target);
  return { correct: false, score: p.exact ? 0 : Math.max(0, (10 - off) / 10), why: `That makes ${e.value}, ${off} away.` };
}

export const countdown: Game = {
  ...COUNTDOWN,
  env: (level) => new CountEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new CountLearner(level, seed, saved),
};
