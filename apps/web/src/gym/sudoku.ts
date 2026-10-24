/**
 * SUDOKU and LOGIC GRIDS. Sudoku puzzles are made by filling a grid at random and taking out clues one at a
 * time, keeping each removal only if the puzzle still has exactly one solution (checked by counting
 * solutions up to two). Ghosty solves with four deduction rules — naked single, hidden single, naked pair,
 * pointing — and guesses (with backtracking) when none applies. What he learns is the order to try the
 * rules in and which cell to guess, by evolution on a set of practice puzzles: every rule tried counts as a
 * step, so a better order solves in fewer steps. Ground truth: every answer is checked against the puzzle's
 * unique solution; mastery = the share of a fixed set of puzzles he solves in no more steps than plain
 * backtracking needs and within the level's step budget. He starts with the costly rules first. Levels take out more clues (48 → 26).
 *
 * `generate` makes Sudoku problems for even seeds and logic-grid problems ("Ana keeps the cat…") for odd
 * seeds; `check` handles both.
 */
import { type Cell, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, shuffle, type Verdict } from './core';
import { SUDOKU } from './meta';
import { between } from './stretch';

export const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let i = 0; i < 9; i++) {
    u.push([...Array(9).keys()].map((k) => i * 9 + k));
    u.push([...Array(9).keys()].map((k) => k * 9 + i));
    const br = Math.floor(i / 3) * 3;
    const bc = (i % 3) * 3;
    u.push([...Array(9).keys()].map((k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3)));
  }
  return u;
})();
const PEERS: number[][] = Array.from({ length: 81 }, (_, c) => [...new Set(UNITS.filter((u) => u.includes(c)).flat())].filter((x) => x !== c));
const BOXES = UNITS.filter((_, i) => i % 3 === 2);
const ALL = 0x1ff;
const bits = (m: number) => {
  let n = 0;
  while (m) (m &= m - 1), n++;
  return n;
};
const low = (m: number) => 31 - Math.clz32(m & -m);

export const cluesFor = (level: number) => [48, 44, 40, 37, 34, 32, 30, 28, 27, 26][lvl(level) - 1]!;

/** Grid state: values (0 empty) and each empty cell's candidates (bit d-1). */
interface Grid {
  v: Int8Array;
  c: Uint16Array;
}

function fromValues(vals: ArrayLike<number>): Grid | null {
  const g: Grid = { v: new Int8Array(81), c: new Uint16Array(81).fill(ALL) };
  for (let i = 0; i < 81; i++) if (vals[i]) if (!place(g, i, vals[i]!)) return null;
  return g;
}
const copy = (g: Grid): Grid => ({ v: g.v.slice(), c: g.c.slice() });

/** Put d in cell i and remove it from the peers; false on a contradiction. */
function place(g: Grid, i: number, d: number): boolean {
  if (!(g.c[i]! & (1 << (d - 1))) && !g.v[i]) return false;
  g.v[i] = d;
  g.c[i] = 0;
  const b = 1 << (d - 1);
  for (const p of PEERS[i]!) {
    if (g.v[p] === d) return false;
    if (!g.v[p] && g.c[p]! & b) {
      g.c[p]! &= ~b;
      if (!g.c[p]) return false;
    }
  }
  return true;
}

/** Count solutions up to `limit` (fewest-candidates first). */
export function countSolutions(vals: ArrayLike<number>, limit = 2): number {
  const g0 = fromValues(vals);
  if (!g0) return 0;
  let count = 0;
  const rec = (g: Grid) => {
    if (count >= limit) return;
    let best = -1;
    let bc = 10;
    for (let i = 0; i < 81; i++)
      if (!g.v[i]) {
        const n = bits(g.c[i]!);
        if (n < bc) (bc = n), (best = i);
      }
    if (best < 0) {
      count++;
      return;
    }
    for (let m = g.c[best]!; m; m &= m - 1) {
      const h = copy(g);
      if (place(h, best, low(m) + 1)) rec(h);
    }
  };
  rec(g0);
  return count;
}

/** A full random grid, then clues taken out while the solution stays unique. */
export function makeSudoku(level: number, seed: number, target = cluesFor(level)): { puzzle: number[]; solution: number[] } {
  const r = rng(seed * 7 + lvl(level));
  const fill = (g: Grid): Grid | null => {
    let best = -1;
    let bc = 10;
    for (let i = 0; i < 81; i++)
      if (!g.v[i]) {
        const n = bits(g.c[i]!);
        if (n < bc) (bc = n), (best = i);
      }
    if (best < 0) return g;
    const ds: number[] = [];
    for (let m = g.c[best]!; m; m &= m - 1) ds.push(low(m) + 1);
    for (const d of shuffle(r, ds)) {
      const h = copy(g);
      if (place(h, best, d)) {
        const f = fill(h);
        if (f) return f;
      }
    }
    return null;
  };
  const solution = Array.from(fill(fromValues(new Array(81).fill(0))!)!.v);
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffle(r, [...Array(81).keys()])) {
    if (clues <= target) break;
    const keep = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle) !== 1) puzzle[i] = keep;
    else clues--;
  }
  return { puzzle, solution };
}

// ---- the rules -------------------------------------------------------------------------------------------

export const RULES = ['naked single', 'hidden single', 'naked pair', 'pointing'];
export const GUESSES = ['first empty cell', 'fewest candidates', 'most candidates'];

/** 1 progress, 0 nothing found, −1 contradiction. */
function applyRule(g: Grid, rule: number): number {
  if (rule === 0) {
    for (let i = 0; i < 81; i++) if (!g.v[i] && bits(g.c[i]!) === 1) return place(g, i, low(g.c[i]!) + 1) ? 1 : -1;
    return 0;
  }
  if (rule === 1) {
    for (const u of UNITS)
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        let at = -1;
        let n = 0;
        let has = false;
        for (const i of u) {
          if (g.v[i] === d) has = true;
          else if (!g.v[i] && g.c[i]! & b) (n++), (at = i);
        }
        if (has) continue;
        if (n === 0) return -1;
        if (n === 1) return place(g, at, d) ? 1 : -1;
      }
    return 0;
  }
  if (rule === 2) {
    let moved = false;
    for (const u of UNITS) {
      const pairs = u.filter((i) => !g.v[i] && bits(g.c[i]!) === 2);
      for (let a = 0; a < pairs.length; a++)
        for (let b = a + 1; b < pairs.length; b++) {
          const m = g.c[pairs[a]!]!;
          if (g.c[pairs[b]!] !== m) continue;
          for (const i of u)
            if (i !== pairs[a] && i !== pairs[b] && !g.v[i] && g.c[i]! & m) {
              g.c[i]! &= ~m;
              if (!g.c[i]) return -1;
              moved = true;
            }
        }
      if (moved) return 1;
    }
    return 0;
  }
  // Pointing: a digit's places in a box all in one row (or column) → not elsewhere in that row (column).
  for (const box of BOXES)
    for (let d = 1; d <= 9; d++) {
      const b = 1 << (d - 1);
      const at = box.filter((i) => !g.v[i] && g.c[i]! & b);
      if (at.length < 2) continue;
      for (const [same, line] of [
        [(i: number) => Math.floor(i / 9), (k: number, x: number) => x * 9 + k],
        [(i: number) => i % 9, (k: number, x: number) => k * 9 + x],
      ] as const) {
        const x = same(at[0]!);
        if (!at.every((i) => same(i) === x)) continue;
        let moved = false;
        for (let k = 0; k < 9; k++) {
          const i = line(k, x);
          if (box.includes(i) || g.v[i] || !(g.c[i]! & b)) continue;
          g.c[i]! &= ~b;
          if (!g.c[i]) return -1;
          moved = true;
        }
        if (moved) return 1;
      }
    }
  return 0;
}

export interface Policy {
  order: number[];
  guess: number;
}

export interface SolveResult {
  solved: boolean;
  steps: number;
  guesses: number;
  values: number[];
  /** Which rule (or 4 = a guess) placed or cleared what, in order — for WATCH. */
  trail: { rule: number; values: number[] }[];
}

/** Solve with a policy: each rule tried is one step, each guess one more. Stops at `budget` steps. */
export function solveWith(puzzle: ArrayLike<number>, pol: Policy, budget: number, keepTrail = false): SolveResult {
  const res: SolveResult = { solved: false, steps: 0, guesses: 0, values: Array.from(puzzle), trail: [] };
  const g0 = fromValues(puzzle);
  if (!g0) return res;
  const run = (g: Grid): Grid | null => {
    for (;;) {
      if (res.steps > budget) return null;
      let empty = -1;
      for (let i = 0; i < 81; i++) if (!g.v[i]) (empty = i), (i = 81);
      if (empty < 0) return g;
      let progress = false;
      for (const rule of pol.order) {
        res.steps++;
        const r = applyRule(g, rule);
        if (r < 0) return null;
        if (r > 0) {
          progress = true;
          if (keepTrail) res.trail.push({ rule, values: Array.from(g.v) });
          break;
        }
      }
      if (progress) continue;
      // No rule applies: guess a cell (by his chosen way) and try its candidates in turn.
      let cell = -1;
      let key = pol.guess === 2 ? -1 : 99;
      for (let i = 0; i < 81; i++) {
        if (g.v[i]) continue;
        const n = bits(g.c[i]!);
        if (pol.guess === 0) {
          cell = i;
          break;
        }
        if (pol.guess === 1 ? n < key : n > key) (key = n), (cell = i);
      }
      for (let m = g.c[cell]!; m; m &= m - 1) {
        res.steps++;
        res.guesses++;
        const h = copy(g);
        if (!place(h, cell, low(m) + 1)) continue;
        if (keepTrail) res.trail.push({ rule: 4, values: Array.from(h.v) });
        const out = run(h);
        if (out) return out;
        if (res.steps > budget) return null;
      }
      return null;
    }
  };
  const out = run(g0);
  if (out) {
    res.solved = true;
    res.values = Array.from(out.v);
  }
  return res;
}

/** The baseline: plain backtracking, first empty cell, digits in order; each digit tried is one step. */
export function baselineSteps(puzzle: ArrayLike<number>): number {
  return solveWith(puzzle, { order: [], guess: 0 }, 1e7).steps;
}

/** Steps allowed per puzzle: a little over one rule tried per empty cell. */
export const budgetFor = (level: number) => Math.round(1.2 * (81 - cluesFor(level))) + 30;

const sets = new Map<string, { puzzle: number[]; solution: number[] }[]>();
function setOf(level: number, kind: 'bench' | 'practice', size: number) {
  const k = `${lvl(level)}:${kind}`;
  let s = sets.get(k);
  if (!s) sets.set(k, (s = Array.from({ length: size }, (_, i) => makeSudoku(level, (kind === 'bench' ? 50000 : 90000) + i))));
  return s;
}
export const benchSet = (level: number) => setOf(level, 'bench', 10);
const baseCache = new Map<number, number[]>();
/** Plain backtracking's steps on each benchmark puzzle (worked out once per level). */
export function baselines(level: number): number[] {
  let b = baseCache.get(lvl(level));
  if (!b) baseCache.set(lvl(level), (b = benchSet(level).map((p) => baselineSteps(p.puzzle))));
  return b;
}
/** Where an untrained learner starts. */
export const START: Policy = { order: [2, 3, 1, 0], guess: 2 };
const practiceSet = (level: number) => setOf(level, 'practice', 6);

class SudokuEnv implements Env {
  p = makeSudoku(1, 1);
  v: number[] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    this.p = makeSudoku(this.level, seed);
    this.v = this.p.puzzle.slice();
  }
  /** cell × 9 + (digit − 1) for every empty cell. */
  actions() {
    const out: number[] = [];
    this.v.forEach((x, i) => {
      if (!x) for (let d = 0; d < 9; d++) out.push(i * 9 + d);
    });
    return out;
  }
  step(a: number) {
    const i = Math.floor(a / 9);
    const d = (a % 9) + 1;
    if (this.v[i] || this.p.solution[i] !== d) return { reward: -5, done: true };
    this.v[i] = d;
    return { reward: 1, done: !this.v.includes(0) };
  }
  describe() {
    return `Sudoku (. = empty):\n${gridText(this.v)}`;
  }
}

const gridText = (v: ArrayLike<number>) => [...Array(9).keys()].map((r) => Array.from({ length: 9 }, (_, c) => v[r * 9 + c] || '.').join('')).join('\n');

interface SudokuSave {
  game: 'sudoku';
  pol: Policy;
  steps: number;
  level: number;
  puzzles: number;
  rand: number;
}

class SudokuLearner implements Learner {
  pol: Policy;
  steps: number;
  puzzles: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<SudokuSave>(saved, 'sudoku');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts with no idea which rule pays: the costly pattern rules first, the singles last, and he
    // guesses in the cell with the most candidates.
    this.pol = s?.pol ?? { ...START };
    this.puzzles = s?.puzzles ?? 0;
    this.steps = s?.level === level ? s.steps : this.practice(this.pol);
  }
  /** Total steps on the practice puzzles (a failure counts as the whole budget). */
  practice(pol: Policy): number {
    const budget = budgetFor(this.level) * 3;
    return practiceSet(this.level).reduce((t, p) => t + Math.min(budget, solveWith(p.puzzle, pol, budget).steps), 0);
  }
  train(n: number) {
    let done = 0;
    while (done < n) {
      const c: Policy = { order: this.pol.order.slice(), guess: this.pol.guess };
      if (this.r() < 0.7) {
        const i = Math.floor(this.r() * 4);
        const j = Math.floor(this.r() * 4);
        [c.order[i], c.order[j]] = [c.order[j]!, c.order[i]!];
      } else c.guess = Math.floor(this.r() * 3);
      const s = this.practice(c);
      done += practiceSet(this.level).length;
      if (s <= this.steps) (this.pol = c), (this.steps = s);
    }
    this.puzzles += done;
    this.rand = (this.rand + done * 2654435761) >>> 0;
    return done;
  }
  measure() {
    const set = benchSet(this.level);
    const bases = baselines(this.level);
    const budget = budgetFor(this.level);
    let ok = 0;
    let steps = 0;
    set.forEach((p, k) => {
      // A pass: solved (checked against its one solution) in no more steps than plain backtracking, and within the budget.
      const limit = Math.min(budget, bases[k]!);
      const s = solveWith(p.puzzle, this.pol, limit);
      if (s.solved && s.steps <= limit && s.values.every((x, i) => x === p.solution[i])) ok++;
      steps += s.steps;
    });
    const base = bases.reduce((a, b) => a + b, 0);
    return {
      mastery: ok / set.length,
      detail: `${cluesFor(this.level)}-clue sudokus: he solves ${ok} of ${set.length} in no more steps than plain backtracking and within ${budget} (each checked against its one solution); ${Math.round(steps / set.length)} steps on average against ${Math.round(base / set.length)} for plain backtracking.`,
    };
  }
  save(): SudokuSave {
    return { game: 'sudoku', pol: this.pol, steps: this.steps, level: this.level, puzzles: this.puzzles, rand: this.rand };
  }
  /**
   * A puzzle at his edge: as many clues as Level `x`'s (part of the way to the next level's count; fewer still past
   * Level 10), the step budget likewise; his answer is the grid his rules reach within it. (Solving it is the
   * practice: what he learns, the order of his rules, is judged on his practice set.)
   */
  stretch(x: number, seed: number) {
    const clues = Math.round(between(x, cluesFor));
    const { puzzle, solution } = makeSudoku(this.level, seed, clues);
    const res = solveWith(puzzle, this.pol, Math.round(between(x, budgetFor)));
    this.puzzles++;
    return { problem: sudokuProblem(this.level, seed, puzzle, solution), answer: gridText(res.values) };
  }
  view(): Frame {
    return {
      lines: [...this.pol.order.map((r, i) => `${i + 1}. ${RULES[r]}`), `Stuck: guess the cell with the ${GUESSES[this.pol.guess]}`],
      caption: 'The order he tries his rules in.',
    };
  }
  watch(seed: number): Frame[] {
    const p = benchSet(this.level)[Math.abs(seed) % benchSet(this.level).length]!;
    const s = solveWith(p.puzzle, this.pol, budgetFor(this.level) * 4, true);
    const frame = (vals: number[], prev: number[], caption: string): Frame => ({
      grid: { w: 9, h: 9, cells: vals.map((x, i): Cell => (x ? { t: String(x), c: p.puzzle[i] ? 'dim' : x !== prev[i] ? 'new' : 'hit' } : {})) },
      caption,
    });
    const frames = [frame(p.puzzle, p.puzzle, `${cluesFor(this.level)} clues.`)];
    let prev = p.puzzle;
    const trail = s.trail.filter((t, i) => i % Math.ceil(s.trail.length / 40) === 0 || i === s.trail.length - 1);
    for (const t of trail) {
      frames.push(frame(t.values, prev, t.rule === 4 ? 'A guess.' : `Found by ${RULES[t.rule]}.`));
      prev = t.values;
    }
    frames.push(frame(s.values, prev, s.solved ? `Solved in ${s.steps} steps (${s.guesses} guesses).` : 'Out of steps.'));
    return frames;
  }
}

// ---- logic grids (problems only) ---------------------------------------------------------------------------

const PEOPLE = ['Ana', 'Ben', 'Cara', 'Dev', 'Eli'];
const CATS: [string, string[]][] = [
  ['pet', ['cat', 'dog', 'fish', 'bird', 'rabbit']],
  ['drink', ['tea', 'coffee', 'juice', 'milk', 'water']],
  ['colour', ['red', 'blue', 'green', 'yellow', 'white']],
];

function perms(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

/** A clue: person (or attribute) a and attribute b go together (pos) or not. Values: [cat, item]; cat −1 = person. */
interface Clue {
  a: [number, number];
  b: [number, number];
  pos: boolean;
}

/** All solutions (each category: person → item), up to `limit`. */
function solveGrid(n: number, k: number, clues: Clue[], limit = 2): number[][][] {
  const P = perms(n);
  const out: number[][][] = [];
  const holds = (asg: number[][], c: Clue): boolean | null => {
    // Who has a, who has b (−1 unknown yet).
    const who = ([cat, item]: [number, number]) => (cat < 0 ? item : asg[cat] ? asg[cat]!.indexOf(item) : -1);
    const x = who(c.a);
    const y = who(c.b);
    if (x < 0 || y < 0) return null;
    return (x === y) === c.pos;
  };
  const rec = (asg: number[][]) => {
    if (out.length >= limit) return;
    if (asg.length === k) {
      out.push(asg.map((p) => p.slice()));
      return;
    }
    for (const p of P) {
      const next = [...asg, p];
      if (clues.every((c) => holds(next, c) !== false)) rec(next);
    }
  };
  rec([]);
  return out;
}

export function makeLogicGrid(level: number, seed: number) {
  const L = lvl(level);
  const n = L <= 3 ? 3 : L <= 7 ? 4 : 5;
  const k = L <= 2 ? 2 : L <= 5 ? 2 : 3;
  const r = rng(seed * 13 + L);
  const answer = Array.from({ length: k }, () => shuffle(r, [...Array(n).keys()]));
  const clues: Clue[] = [];
  const truth = (a: [number, number], b: [number, number]) => {
    const who = ([cat, item]: [number, number]) => (cat < 0 ? item : answer[cat]!.indexOf(item));
    return who(a) === who(b);
  };
  for (let t = 0; t < 400 && solveGrid(n, k, clues).length > 1; t++) {
    const ca = Math.floor(r() * (k + 1)) - 1;
    let cb = Math.floor(r() * k);
    if (cb === ca) cb = (cb + 1) % k;
    const a: [number, number] = [ca, Math.floor(r() * n)];
    // About a third of the clues say who goes together; the rest say who doesn't. All are true.
    const owner = ca < 0 ? a[1] : answer[ca]!.indexOf(a[1]);
    const b: [number, number] = [cb, r() < 0.35 ? answer[cb]![owner]! : Math.floor(r() * n)];
    clues.push({ a, b, pos: truth(a, b) });
  }
  // Then drop every clue the others already imply (the answer stays the only one).
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, j) => j !== i);
    if (solveGrid(n, k, without).length === 1) clues.splice(i, 1);
  }
  return { n, k, clues, answer };
}

const itemName = ([cat, item]: [number, number]) => (cat < 0 ? PEOPLE[item]! : `the ${CATS[cat]![1][item]}`);
function clueText(c: Clue): string {
  const a = itemName(c.a);
  const b = itemName(c.b);
  if (c.a[0] < 0) return c.pos ? `${a} has ${b}.` : `${a} does not have ${b}.`;
  return c.pos ? `Whoever has ${a} also has ${b}.` : `Whoever has ${a} does not have ${b}.`;
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  if (seed % 2 === 0) {
    const { puzzle, solution } = makeSudoku(L, seed);
    return sudokuProblem(L, seed, puzzle, solution);
  }
  const g = makeLogicGrid(L, seed);
  const people = PEOPLE.slice(0, g.n);
  const cats = CATS.slice(0, g.k).map(([nm, items]) => `${nm}: ${items.slice(0, g.n).join(', ')}`);
  const text = `Logic grid. People: ${people.join(', ')}. Each has exactly one of each:\n${cats.join('\n')}\nClues:\n${g.clues.map(clueText).join('\n')}\nAnswer one line per person, e.g. "${people[0]}: ${CATS.slice(0, g.k)
    .map(([, items]) => items[0])
    .join(', ')}".`;
  const answer = people.map((_, pi) => g.answer.map((perm, ci) => CATS[ci]![1][perm[pi]!]!));
  return { game: 'sudoku', level: L, seed, text, data: { kind: 'grid', people, answer } };
}

function sudokuProblem(L: number, seed: number, puzzle: number[], solution: number[]): Problem {
  const text = `Solve this sudoku (. = empty; every row, column and 3×3 box holds 1–9 once). Answer with the 81 digits, row by row.\n${gridText(puzzle)}`;
  return { game: 'sudoku', level: L, seed, text, data: { kind: 'sudoku', puzzle, solution } };
}

function check(p: Problem, ans: string): Verdict {
  const d = p.data as { kind: string; puzzle?: number[]; solution?: number[]; people?: string[]; answer?: string[][] };
  if (d.kind === 'sudoku') {
    // Nine rows of nine digits (the last nine lines that have them, row labels ignored), else the last 81 digits.
    const rows = ans
      .split('\n')
      .map((l) => l.replace(/[^1-9]/g, ''))
      .filter((l) => l.length >= 9)
      .map((l) => l.slice(-9));
    const digits = (rows.length >= 9 ? rows.slice(-9).join('') : ans.replace(/[^1-9]/g, '').slice(-81)).split('').map(Number);
    const blanks = d.puzzle!.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
    if (digits.length !== 81) return { correct: false, score: 0, why: 'The answer is not 81 digits.' };
    if (d.puzzle!.some((x, i) => x && x !== digits[i])) return { correct: false, score: 0, why: 'A given clue was changed.' };
    const right = blanks.filter((i) => digits[i] === d.solution![i]).length;
    return { correct: right === blanks.length, score: right / blanks.length, why: right === blanks.length ? 'Solved.' : `${right} of ${blanks.length} empty cells right.` };
  }
  // Each person's part: from the last time their name is written to the next name or the end of the line.
  // Exactly one item of each kind must be named there, and it must be the right one.
  let right = 0;
  let total = 0;
  const names = d.people!;
  d.people!.forEach((nm, pi) => {
    const at = [...ans.matchAll(new RegExp(`\\b${nm}\\b`, 'gi'))].pop()?.index ?? -1;
    let part = at < 0 ? '' : ans.slice(at + nm.length).split('\n')[0]!;
    for (const other of names) {
      const k = part.search(new RegExp(`\\b${other}\\b`, 'i'));
      if (k >= 0) part = part.slice(0, k);
    }
    d.answer![pi]!.forEach((item, ci) => {
      total++;
      const kinds = CATS[ci]![1].slice(0, names.length).filter((x) => new RegExp(`\\b${x}\\b`, 'i').test(part));
      if (kinds.length === 1 && kinds[0] === item) right++;
    });
  });
  return { correct: right === total, score: right / total, why: right === total ? 'All right.' : `${right} of ${total} right.` };
}

export const sudoku: Game = {
  ...SUDOKU,
  env: (level) => new SudokuEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new SudokuLearner(level, seed, saved),
};
