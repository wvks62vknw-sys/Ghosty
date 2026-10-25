/**
 * BUG HUNT: a small program in TINY (tiny.ts, interpreted here — no eval) with ONE bug put in on purpose,
 * and a test suite it fails. He must name the buggy line and its fix. Ground truth is the tests: a fix is
 * right when the fixed program passes every test, the shown and the hidden ones (check() runs it).
 *
 * The bugs are the classic slips: + for −, < for <= or turned round to >, == for !=, a number off by one, a
 * wrong variable read or set, `and` for `or`, two things swapped round. Each level brings a new kind of
 * slip (most of its bugs), and he only suspects kinds he has practised with, so it has to be learned. His candidate fixes are the same kinds of one-word change on every line; he
 * tries them one at a time (each try = run the tests) in the order his weights score them — from what he
 * can see: which lines the failing tests ran and the passing ones did not (fault localisation), what kind
 * of line it is (loop, condition, return, sum), what kind of change. He learns the weights from
 * fresh practice programs (pairwise ranking: the changes that fixed one should score above those that did
 * not). Mastery = the share of held-out buggy programs he fixes within a budget of tries — a
 * share of what the plain order (top line first, changes as they come) needs, so the plain order is 0%.
 */
import { type Env, finalLine, type Frame, type Game, type Learner, lvl, pick, type Problem, randInt, rng, savedFor, shuffle, type Verdict } from './core';
import { BUG_SETS } from './bugsets';
import { BUGHUNT } from './meta';
import { ARITH, COMPARE, fmt, indent, KEYWORDS, parse, type Program, RULES, run, show, TinyError, tokens, type Val } from './tiny';

// ---- the programs (correct versions); {a} {b}… are variable names chosen per seed ----------------------

/** A template's correct program with these variable names. */
export const goodLines = (t: Template, names: Record<string, string>) => t.src.map((l) => fmt(tokens(l.replace(/\{(\w+)\}/g, (_, k: string) => names[k] ?? k))));

interface Template {
  name: string;
  what: string;
  /** Lines, with {x} placeholders for variable names. */
  src: string[];
  /** Placeholder → name choices. */
  vars: Record<string, string[]>;
  /** Test inputs. */
  inputs: (r: () => number) => Val[];
  level: number;
}

const list = (r: () => number, n: number, lo: number, hi: number) => Array.from({ length: n }, () => randInt(r, lo, hi));

export const TEMPLATES: Template[] = [
  { name: 'sum_to', what: 'adds up the whole numbers from 1 to n', level: 1, vars: { s: ['s', 'total', 'acc', 'sum'], i: ['i', 'k', 'j'] }, src: ['fn sum_to(n)', '{s} = 0', 'for {i} = 1 to n do', '{s} = {s} + {i}', 'end', 'return {s}', 'end'], inputs: (r) => [randInt(r, 0, 12)] },
  { name: 'sum_down', what: 'adds up n, n − 1, …, 1', level: 1, vars: { s: ['s', 'total', 'acc', 'sum'] }, src: ['fn sum_down(n)', '{s} = 0', 'while n > 0 do', '{s} = {s} + n', 'n = n - 1', 'end', 'return {s}', 'end'], inputs: (r) => [randInt(r, 0, 12)] },
  { name: 'mix', what: 'works out a − b + c', level: 1, vars: { t: ['t', 'r', 'v', 'w'] }, src: ['fn mix(a, b, c)', '{t} = a - b', '{t} = {t} + c', 'return {t}', 'end'], inputs: (r) => [randInt(r, 0, 20), randInt(r, 0, 20), randInt(r, 0, 20)] },
  { name: 'evens_to', what: 'adds up the even numbers 2, 4, …, 2n', level: 1, vars: { s: ['s', 'total', 'acc', 'sum'], i: ['i', 'k', 'j'] }, src: ['fn evens_to(n)', '{s} = 0', 'for {i} = 1 to n do', '{s} = {s} + {i} + {i}', 'end', 'return {s}', 'end'], inputs: (r) => [randInt(r, 0, 10)] },
  { name: 'factorial', what: 'multiplies 1 × 2 × … × n', level: 1, vars: { p: ['p', 'prod', 'f'], i: ['i', 'k'] }, src: ['fn factorial(n)', '{p} = 1', 'for {i} = 2 to n do', '{p} = {p} * {i}', 'end', 'return {p}', 'end'], inputs: (r) => [randInt(r, 0, 8)] },
  { name: 'power', what: 'works out b to the power e', level: 1, vars: { p: ['p', 'result'], i: ['i', 'k'] }, src: ['fn power(b, e)', '{p} = 1', 'for {i} = 1 to e do', '{p} = {p} * b', 'end', 'return {p}', 'end'], inputs: (r) => [randInt(r, 1, 5), randInt(r, 0, 5)] },
  { name: 'bigger', what: 'gives the bigger of a and b, or a when they are equal', level: 1, vars: {}, src: ['fn bigger(a, b)', 'if a >= b then', 'return a', 'else', 'return b', 'end', 'end'], inputs: (r) => [randInt(r, 0, 9), randInt(r, 0, 9)] },
  { name: 'gap', what: 'gives how far apart a and b are', level: 2, vars: { d: ['d', 'diff'] }, src: ['fn gap(a, b)', '{d} = a - b', 'if {d} < 0 then', '{d} = 0 - {d}', 'end', 'return {d}', 'end'], inputs: (r) => [randInt(r, 0, 20), randInt(r, 0, 20)] },
  { name: 'count_down', what: 'counts the steps of halving n (rounding down) until it reaches 1', level: 2, vars: { c: ['c', 'steps'], m: ['m', 'x'] }, src: ['fn count_down(n)', '{c} = 0', '{m} = n', 'while {m} > 1 do', '{m} = {m} / 2', '{c} = {c} + 1', 'end', 'return {c}', 'end'], inputs: (r) => [randInt(r, 1, 70)] },
  { name: 'sum_list', what: 'adds up the numbers in the list xs', level: 3, vars: { t: ['t', 'total', 'sum'], i: ['i', 'j'] }, src: ['fn sum_list(xs)', '{t} = 0', 'for {i} = 0 to len(xs) - 1 do', '{t} = {t} + xs[{i}]', 'end', 'return {t}', 'end'], inputs: (r) => [list(r, randInt(r, 0, 6), 0, 9)] },
  { name: 'count_even', what: 'counts the even numbers in the list xs', level: 3, vars: { c: ['c', 'count', 'n'], i: ['i', 'j'] }, src: ['fn count_even(xs)', '{c} = 0', 'for {i} = 0 to len(xs) - 1 do', 'if xs[{i}] % 2 == 0 then', '{c} = {c} + 1', 'end', 'end', 'return {c}', 'end'], inputs: (r) => [list(r, randInt(r, 0, 7), 0, 9)] },
  { name: 'largest', what: 'gives the largest number in the list xs (which is never empty)', level: 3, vars: { m: ['m', 'best', 'top'], i: ['i', 'j'] }, src: ['fn largest(xs)', '{m} = xs[0]', 'for {i} = 1 to len(xs) - 1 do', 'if xs[{i}] > {m} then', '{m} = xs[{i}]', 'end', 'end', 'return {m}', 'end'], inputs: (r) => [list(r, randInt(r, 1, 6), 0, 20)] },
  { name: 'find', what: 'gives the position of the first x in the list xs, or -1 if it is not there', level: 4, vars: { i: ['i', 'k', 'pos'] }, src: ['fn find(xs, x)', 'for {i} = 0 to len(xs) - 1 do', 'if xs[{i}] == x then', 'return {i}', 'end', 'end', 'return 0 - 1', 'end'], inputs: (r) => [list(r, randInt(r, 0, 6), 0, 5), randInt(r, 0, 5)] },
  { name: 'gcd', what: 'gives the greatest common divisor of a and b (both above 0)', level: 4, vars: { t: ['t', 'tmp'] }, src: ['fn gcd(a, b)', 'while b != 0 do', '{t} = b', 'b = a % b', 'a = {t}', 'end', 'return a', 'end'], inputs: (r) => [randInt(r, 1, 60), randInt(r, 1, 60)] },
  { name: 'digit_sum', what: 'adds up the digits of n', level: 4, vars: { s: ['s', 'total'] }, src: ['fn digit_sum(n)', '{s} = 0', 'while n > 0 do', '{s} = {s} + n % 10', 'n = n / 10', 'end', 'return {s}', 'end'], inputs: (r) => [randInt(r, 0, 9999)] },
  { name: 'fib', what: 'gives the n-th Fibonacci number (0, 1, 1, 2, 3, 5, …; fib(0) is 0)', level: 5, vars: { a: ['a', 'x'], b: ['b', 'y'], t: ['t', 'z'], i: ['i', 'k'] }, src: ['fn fib(n)', '{a} = 0', '{b} = 1', 'for {i} = 1 to n do', '{t} = {a} + {b}', '{a} = {b}', '{b} = {t}', 'end', 'return {a}', 'end'], inputs: (r) => [randInt(r, 0, 15)] },
  { name: 'is_prime', what: 'gives 1 if n is a prime number and 0 if not', level: 5, vars: { d: ['d', 'k'] }, src: ['fn is_prime(n)', 'if n < 2 then', 'return 0', 'end', '{d} = 2', 'while {d} * {d} <= n do', 'if n % {d} == 0 then', 'return 0', 'end', '{d} = {d} + 1', 'end', 'return 1', 'end'], inputs: (r) => [randInt(r, 0, 60)] },
  { name: 'in_range', what: 'counts the numbers in xs from lo to hi (both included)', level: 6, vars: { c: ['c', 'count'], i: ['i', 'j'] }, src: ['fn in_range(xs, lo, hi)', '{c} = 0', 'for {i} = 0 to len(xs) - 1 do', 'if xs[{i}] >= lo and xs[{i}] <= hi then', '{c} = {c} + 1', 'end', 'end', 'return {c}', 'end'], inputs: (r) => [list(r, randInt(r, 0, 7), 0, 9), randInt(r, 0, 4), randInt(r, 4, 9)] },
  { name: 'is_sorted', what: 'gives 1 if the list xs never goes down, 0 if it does', level: 6, vars: { i: ['i', 'k'] }, src: ['fn is_sorted(xs)', 'for {i} = 1 to len(xs) - 1 do', 'if xs[{i} - 1] > xs[{i}] then', 'return 0', 'end', 'end', 'return 1', 'end'], inputs: (r) => [r() < 0.5 ? list(r, randInt(r, 0, 5), 0, 9).sort((x, y) => x - y) : list(r, randInt(r, 0, 5), 0, 9)] },
  { name: 'reverse_num', what: 'writes the digits of n backwards (1230 gives 321)', level: 7, vars: { r: ['r', 'out'] }, src: ['fn reverse_num(n)', '{r} = 0', 'while n > 0 do', '{r} = {r} * 10 + n % 10', 'n = n / 10', 'end', 'return {r}', 'end'], inputs: (r) => [randInt(r, 0, 9999)] },
  { name: 'second', what: 'gives the second largest number in xs (it has at least two different numbers)', level: 7, vars: { a: ['a', 'top'], b: ['b', 'next'], i: ['i', 'k'], x: ['x', 'v'] }, src: ['fn second(xs)', '{a} = 0 - 1', '{b} = 0 - 1', 'for {i} = 0 to len(xs) - 1 do', '{x} = xs[{i}]', 'if {x} > {a} then', '{b} = {a}', '{a} = {x}', 'else', 'if {x} > {b} and {x} < {a} then', '{b} = {x}', 'end', 'end', 'end', 'return {b}', 'end'], inputs: (r) => [shuffle(r, [randInt(r, 0, 4), randInt(r, 5, 9), ...list(r, randInt(r, 0, 4), 0, 9)])] },
  { name: 'records', what: 'counts how many numbers in xs are bigger than every number before them', level: 8, vars: { c: ['c', 'count'], m: ['m', 'best'], i: ['i', 'k'] }, src: ['fn records(xs)', '{c} = 0', '{m} = 0 - 1', 'for {i} = 0 to len(xs) - 1 do', 'if xs[{i}] > {m} then', '{c} = {c} + 1', '{m} = xs[{i}]', 'end', 'end', 'return {c}', 'end'], inputs: (r) => [list(r, randInt(r, 0, 7), 0, 9)] },
  { name: 'pair_sum', what: 'gives 1 if two different positions in xs add up to t, 0 if not', level: 8, vars: { i: ['i', 'p'], j: ['j', 'q'] }, src: ['fn pair_sum(xs, t)', 'for {i} = 0 to len(xs) - 1 do', 'for {j} = {i} + 1 to len(xs) - 1 do', 'if xs[{i}] + xs[{j}] == t then', 'return 1', 'end', 'end', 'end', 'return 0', 'end'], inputs: (r) => [list(r, randInt(r, 0, 6), 0, 9), randInt(r, 0, 18)] },
  { name: 'bsearch', what: 'finds x in the sorted list xs by halving; gives its position or -1', level: 9, vars: { lo: ['lo', 'left'], hi: ['hi', 'right'], m: ['m', 'mid'] }, src: ['fn bsearch(xs, x)', '{lo} = 0', '{hi} = len(xs) - 1', 'while {lo} <= {hi} do', '{m} = ({lo} + {hi}) / 2', 'if xs[{m}] == x then', 'return {m}', 'end', 'if xs[{m}] < x then', '{lo} = {m} + 1', 'else', '{hi} = {m} - 1', 'end', 'end', 'return 0 - 1', 'end'], inputs: (r) => [[...new Set(list(r, randInt(r, 0, 8), 0, 30))].sort((x, y) => x - y), randInt(r, 0, 30)] },
  { name: 'sort', what: 'sorts the list xs from smallest to largest (bubble sort) and gives it back', level: 9, vars: { i: ['i', 'p'], j: ['j', 'q'], t: ['t', 'tmp'] }, src: ['fn sort(xs)', 'for {i} = 1 to len(xs) - 1 do', 'for {j} = 0 to len(xs) - 1 - {i} do', 'if xs[{j}] > xs[{j} + 1] then', '{t} = xs[{j}]', 'xs[{j}] = xs[{j} + 1]', 'xs[{j} + 1] = {t}', 'end', 'end', 'end', 'return xs', 'end'], inputs: (r) => [list(r, randInt(r, 0, 6), 0, 9)] },
  { name: 'longest_run', what: 'gives the length of the longest stretch of equal numbers next to each other in xs (0 for an empty list)', level: 10, vars: { best: ['best', 'most'], run: ['run', 'cur'], i: ['i', 'k'] }, src: ['fn longest_run(xs)', 'if len(xs) == 0 then', 'return 0', 'end', '{best} = 1', '{run} = 1', 'for {i} = 1 to len(xs) - 1 do', 'if xs[{i}] == xs[{i} - 1] then', '{run} = {run} + 1', 'else', '{run} = 1', 'end', 'if {run} > {best} then', '{best} = {run}', 'end', 'end', 'return {best}', 'end'], inputs: (r) => [list(r, randInt(r, 0, 9), 0, 2)] },
];

/** Which programs a level draws from, and how many tests come with each. */
export const specFor = (level: number) => {
  const L = lvl(level);
  return { from: Math.max(1, L - 3), to: L, tests: Math.min(8, 4 + Math.ceil(L / 3)) };
};

// ---- candidate changes: one word on one line -------------------------------------------------------------

/**
 * The kinds of slip, finer than the kind of word: + for −, an operator among * / %, a number off by one, < for
 * <= (strictness), < for > (turned round), == for !=, a wrong variable read, a wrong variable set, and for
 * or, and two things swapped round (a − b for b − a).
 */
export const SLIPS = ['plusminus', 'number', 'strict', 'operand', 'muldiv', 'flip', 'target', 'equality', 'logic', 'swap'] as const;
export type Slip = (typeof SLIPS)[number];
export const SLIP_WORDS: Record<Slip, string> = { plusminus: '+ for − (or − for +)', number: 'a number off by one', strict: '< for <= (or the like)', operand: 'a wrong variable read', muldiv: 'a wrong * / %', flip: '< turned round to >', target: 'a wrong variable set', equality: '== for != (or back)', logic: 'and for or (or back)', swap: 'two things swapped round' };

export interface Change {
  line: number;
  tok: number;
  to: string;
  kind: 'compare' | 'arith' | 'number' | 'variable' | 'logic' | 'swap';
  slip: Slip;
  /** A swap changes a second word too. */
  tok2?: number;
  to2?: string;
}

const STRICT: Record<string, string> = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };
function compareSlip(x: string, y: string): Slip {
  if (x === '==' || x === '!=' || y === '==' || y === '!=') return 'equality';
  return STRICT[x] === y ? 'strict' : 'flip';
}
/** Operators whose two sides cannot be swapped without changing the meaning. */
const ORDERED = new Set(['-', '/', '%', '<', '<=', '>', '>=']);

const isName = (x: string) => /^[A-Za-z_]\w*$/.test(x) && !KEYWORDS.has(x);

/** Every one-word change of the kinds bugs come in, in plain order: top line first, left to right. */
export function changes(lines: string[]): Change[] {
  const names = new Set<string>();
  for (const l of lines.slice(1)) for (const t of tokens(l)) if (isName(t)) names.add(t);
  for (const t of tokens(lines[0]!).slice(3)) if (isName(t)) names.add(t);
  const vars = [...names];
  const out: Change[] = [];
  lines.forEach((l, li) => {
    if (li === 0) return;
    const t = tokens(l);
    t.forEach((x, ti) => {
      const prev = t[ti - 1];
      const binary = prev != null && (/^\d+$/.test(prev) || isName(prev) || prev === ')' || prev === ']');
      const at = { line: li + 1, tok: ti };
      if (ARITH.includes(x) && binary) for (const y of ARITH) y !== x && out.push({ ...at, to: y, kind: 'arith', slip: (x === '+' || x === '-') && (y === '+' || y === '-') ? 'plusminus' : 'muldiv' });
      else if (COMPARE.includes(x)) for (const y of COMPARE) y !== x && out.push({ ...at, to: y, kind: 'compare', slip: compareSlip(x, y) });
      else if (x === 'and' || x === 'or') out.push({ ...at, to: x === 'and' ? 'or' : 'and', kind: 'logic', slip: 'logic' });
      else if (/^\d+$/.test(x)) {
        const n = Number(x);
        out.push({ ...at, to: String(n + 1), kind: 'number', slip: 'number' });
        if (n > 0) out.push({ ...at, to: String(n - 1), kind: 'number', slip: 'number' });
      } else if (isName(x) && !(t[0] === 'for' && ti === 1) && !(ti === 1 && prev === 'fn')) {
        const slip: Slip = ti === 0 && (t[1] === '=' || t[1] === '[') ? 'target' : 'operand';
        for (const y of vars) y !== x && out.push({ ...at, to: y, kind: 'variable', slip });
      }
      // Two plain things either side of an operator whose order matters, swapped round.
      const a = t[ti - 1];
      const b = t[ti + 1];
      if (ORDERED.has(x) && binary && a && b && a !== b && /^(\d+|[A-Za-z_]\w*)$/.test(a) && /^(\d+|[A-Za-z_]\w*)$/.test(b) && !KEYWORDS.has(a) && !KEYWORDS.has(b) && t[ti - 2] !== '[' && t[ti + 2] !== '[' && t[ti + 2] !== '(')
        out.push({ line: li + 1, tok: ti - 1, to: b, tok2: ti + 1, to2: a, kind: 'swap', slip: 'swap' });
    });
  });
  return out;
}

export function apply(lines: string[], c: Change): string[] {
  const out = lines.slice();
  const t = tokens(out[c.line - 1]!);
  t[c.tok] = c.to;
  if (c.tok2 != null) t[c.tok2] = c.to2!;
  out[c.line - 1] = fmt(t);
  return out;
}

export interface Test {
  args: Val[];
  want: Val;
}

/** Run the tests: which pass, and the lines each ran. A program that does not parse fails them all. */
export function runTests(lines: string[], tests: Test[]): { pass: boolean[]; got: (Val | string)[]; cover: Set<number>[] } {
  let p: Program;
  try {
    p = parse(lines);
  } catch (e) {
    const m = e instanceof TinyError ? e.message : String(e);
    return { pass: tests.map(() => false), got: tests.map(() => `cannot run: ${m}`), cover: tests.map(() => new Set()) };
  }
  const pass: boolean[] = [];
  const got: (Val | string)[] = [];
  const cover: Set<number>[] = [];
  for (const t of tests) {
    const o = run(p, t.args);
    pass.push(o.error == null && same(o.value!, t.want));
    got.push(o.error ?? o.value!);
    cover.push(o.lines);
  }
  return { pass, got, cover };
}
/** Does the program pass every test? (Stops at the first that fails: most changed programs fail at once.) */
export function passesAll(lines: string[], tests: Test[]): boolean {
  let p: Program;
  try {
    p = parse(lines);
  } catch {
    return false;
  }
  for (const t of tests) {
    const o = run(p, t.args);
    if (o.error != null || !same(o.value!, t.want)) return false;
  }
  return true;
}
const same = (a: Val, b: Val) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b);

export interface Buggy {
  t: Template;
  /** The variable names chosen for the template's placeholders. */
  names: Record<string, string>;
  /** The correct program and the buggy one (same lines but one). */
  good: string[];
  lines: string[];
  bug: Change;
  tests: Test[];
  /** More tests, never shown: a fix is graded on these too (so answers that only fit the shown tests fail). */
  hidden: Test[];
}

/**
 * Each level brings a new kind of slip (most of its bugs, seven in ten), the rest are kinds met before.
 * He only suspects kinds of slip he has met (practised with), so a new kind has to be learned.
 */
export const NEW_SLIP: Slip[] = ['plusminus', 'number', 'operand', 'flip', 'muldiv', 'strict', 'target', 'equality', 'logic', 'swap'];
export const slipsUpTo = (level: number) => NEW_SLIP.slice(0, lvl(level));

/** A program with one bug that at least one test catches (and that the same kind of one-word change can undo). */
export function makeBuggy(level: number, seed: number): Buggy {
  const sp = specFor(level);
  const r = rng(seed * 4099 + lvl(level) * 17);
  const L = lvl(level);
  const slipFocus: Slip[] = L > 1 && r() < 0.3 ? NEW_SLIP.slice(0, L - 1) : [NEW_SLIP[L - 1]!];
  for (;;) {
    const t = pick(r, TEMPLATES.filter((x) => x.level >= sp.from && x.level <= sp.to));
    const names: Record<string, string> = {};
    for (const [k, opts] of Object.entries(t.vars)) names[k] = pick(r, opts);
    const good = goodLines(t, names);
    const prog = parse(good);
    const seen = new Set<string>();
    const draw = (rr: () => number, n: number): Test[] => {
      const out: Test[] = [];
      for (let k = 0; out.length < n && k < 200; k++) {
        const args = t.inputs(rr);
        const key = JSON.stringify(args);
        if (seen.has(key)) continue;
        seen.add(key);
        const o = run(prog, args);
        if (o.error == null) out.push({ args, want: o.value! });
      }
      return out;
    };
    const tests = draw(r, sp.tests);
    // The hidden tests come from their own random stream (so they never change which bug is chosen).
    const hidden = draw(rng(seed * 6007 + lvl(level) * 29 + tests.length), 10);
    const focus = slipFocus;
    const all = shuffle(r, changes(good)).filter((c) => focus.includes(c.slip));
    for (const bug of all.slice(0, 40)) {
      const lines = apply(good, bug);
      const res = runTests(lines, tests);
      // Caught by some test; a bug that fails every test is kept only half the time (subtler ones are better).
      if (res.pass.every(Boolean) || (!res.pass.some(Boolean) && r() < 0.5)) continue;
      // The fix must be a change of the same kinds (so his search can find it).
      const undo = changes(lines).find((c) => c.line === bug.line && apply(lines, c)[c.line - 1] === good[bug.line - 1]);
      if (!undo) continue;
      // A bug of the level's new kind must need it: no change of a kind met at earlier levels may fix it too.
      const before = new Set<string>(NEW_SLIP.slice(0, L - 1));
      // (Only a line some failing test runs can hold such a fix.)
      const ran = new Set(res.cover.filter((_, i) => !res.pass[i]).flatMap((c) => [...c]));
      if (L > 1 && bug.slip === NEW_SLIP[L - 1] && changes(lines).some((c) => before.has(c.slip) && ran.has(c.line) && passesAll(apply(lines, c), tests))) continue;
      return { t, names, good, lines, bug, tests, hidden };
    }
  }
}

// ---- his search ------------------------------------------------------------------------------------------

/** What he notices about a candidate change: 23 general facts, then the kind of slip (one each). */
export const GENERAL = 23;
export const FEATURES = GENERAL + SLIPS.length;
const slipFeature = (c: Change) => GENERAL + SLIPS.indexOf(c.slip);
/** Does he know this kind of slip (has practised with it: a weight for it)? */
export const knowsSlip = (w: number[], c: Change) => w[slipFeature(c)] !== 0;

export interface Case {
  b: Buggy;
  cands: Change[];
  feats: number[][];
  /** Which candidates fix it (worked out on demand: each one is a run of the tests). */
  fixes: Map<number, boolean>;
}

/** What he can see about each candidate: where the failing tests went, the kind of line, the kind of change. */
export function prepare(b: Buggy): Case {
  const res = runTests(b.lines, b.tests);
  const failed = res.pass.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0);
  const passed = res.pass.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  const cands = changes(b.lines);
  const n = b.lines.length;
  const susp = (line: number) => {
    const f = failed.filter((i) => res.cover[i]!.has(line)).length;
    const p = passed.filter((i) => res.cover[i]!.has(line)).length;
    return f ? f / Math.sqrt(Math.max(1, failed.length) * (f + p)) : 0;
  };
  const top = Math.max(0, ...b.lines.map((_, i) => susp(i + 1)));
  const feats = cands.map((c) => {
    const f = failed.filter((i) => res.cover[i]!.has(c.line)).length;
    const p = passed.filter((i) => res.cover[i]!.has(c.line)).length;
    const ochiai = f ? f / Math.sqrt(Math.max(1, failed.length) * (f + p)) : 0;
    const w = tokens(b.lines[c.line - 1]!)[0];
    const old = tokens(b.lines[c.line - 1]!)[c.tok]!;
    const strict = (old === '<' && c.to === '<=') || (old === '<=' && c.to === '<') || (old === '>' && c.to === '>=') || (old === '>=' && c.to === '>');
    return [
      f ? 1 : 0,
      ochiai,
      passed.length ? p / passed.length : 0,
      c.kind === 'compare' ? 1 : 0,
      c.kind === 'arith' ? 1 : 0,
      c.kind === 'number' ? 1 : 0,
      c.kind === 'variable' ? 1 : 0,
      c.kind === 'logic' ? 1 : 0,
      w === 'for' || w === 'while' ? 1 : 0,
      w === 'if' ? 1 : 0,
      w === 'return' ? 1 : 0,
      w !== 'for' && w !== 'while' && w !== 'if' && w !== 'return' ? 1 : 0,
      strict ? 1 : 0,
      (c.line - 1) / n,
      // Would the changed program even read? (Checked without running any test, like a spelling check.)
      lineReads(apply(b.lines, c)[c.line - 1]!) ? 0 : 1,
      top > 0 && Math.abs(ochiai - top) < 1e-9 ? 1 : 0,
      c.kind === 'number' && (w === 'for' || w === 'while') ? 1 : 0,
      c.kind === 'variable' && w === 'return' ? 1 : 0,
      c.kind === 'arith' && w !== 'for' && w !== 'while' && w !== 'if' && w !== 'return' ? 1 : 0,
      c.kind === 'variable' && c.tok === 0 ? 1 : 0,
      selfish(tokens(apply(b.lines, c)[c.line - 1]!)) ? 1 : 0,
      c.kind === 'compare' && FLIP[old] === c.to ? 1 : 0,
      c.kind === 'arith' && (old === '/' || old === '%') ? 1 : 0,
      ...SLIPS.map((k) => (c.slip === k ? 1 : 0)),
    ];
  });
  return { b, cands, feats, fixes: new Map() };
}

const FLIP: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '!=', '!=': '==' };
/** "x = x", "p / p", "m - m": a line that sets something to itself or combines a thing with itself. */
function selfish(t: string[]): boolean {
  if (t.length === 3 && t[1] === '=' && t[0] === t[2]) return true;
  for (let i = 1; i + 1 < t.length; i++) if ((ARITH.includes(t[i]!) || COMPARE.includes(t[i]!)) && t[i - 1] === t[i + 1] && /^[A-Za-z_]/.test(t[i - 1]!) && t[i - 2] !== '[') return true;
  return false;
}

/**
 * Would a changed line still read? A one-word change never touches the words that open or close blocks,
 * so the line is checked on its own, inside a tiny program of its own (quick: no whole-program parse).
 */
function lineReads(line: string): boolean {
  const w = tokens(line)[0];
  return parses(['fn f()', line, ...(w === 'if' || w === 'while' || w === 'for' ? ['end'] : []), 'end']);
}

function parses(lines: string[]): boolean {
  try {
    parse(lines);
    return true;
  } catch {
    return false;
  }
}

export function fixes(cs: Case, i: number): boolean {
  let ok = cs.fixes.get(i);
  if (ok == null) {
    ok = passesAll(apply(cs.b.lines, cs.cands[i]!), cs.b.tests);
    cs.fixes.set(i, ok);
  }
  return ok;
}

/** His order of candidates (best-scored first; ties in plain order). */
export function order(cs: Case, w: number[]): number[] {
  const sc = cs.feats.map((f) => f.reduce((t, x, j) => t + x * w[j]!, 0));
  return cs.cands.map((_, i) => i).sort((a, b) => sc[b]! - sc[a]! || a - b);
}

/**
 * Tries until a candidate passes every test (or the budget runs out). `learner`: he only suspects the
 * kinds of slip he has practised with; the yardsticks (the plain order) consider every change.
 */
export function hunt(cs: Case, w: number[], budget: number, learner = false): { fix: Change | null; tries: number } {
  const ord = learner ? order(cs, w).filter((i) => knowsSlip(w, cs.cands[i]!)) : order(cs, w);
  for (let k = 0; k < Math.min(budget, ord.length); k++) if (fixes(cs, ord[k]!)) return { fix: cs.cands[ord[k]!]!, tries: k + 1 };
  return { fix: null, tries: Math.min(budget, ord.length) };
}

const ZERO = new Array(FEATURES).fill(0);
export const plainTries = (cs: Case) => hunt(cs, ZERO, Infinity).tries;
export const allowance = (plain: number, level: number) => Math.max(2, Math.floor(plain * [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.45, 0.45, 0.4, 0.4][lvl(level) - 1]!));

export interface Graded {
  cs: Case;
  limit: number;
  seed: number;
}
/** The first `size` programs from seed `from` on that the plain order needs at least 10 tries for. */
function graded(level: number, from: number, size: number): Graded[] {
  const out: Graded[] = [];
  for (let seed = from; out.length < size; seed++) {
    const cs = prepare(makeBuggy(level, seed));
    const plain = plainTries(cs);
    if (plain >= 10) out.push({ cs, limit: allowance(plain, level), seed });
  }
  return out;
}
const benches = new Map<number, Graded[]>();
const benchTexts = new Map<number, Set<string>>();
/** The held-out programs' text, so practice never meets one of them. */
export function heldOut(level: number): Set<string> {
  const L = lvl(level);
  let t = benchTexts.get(L);
  if (!t) benchTexts.set(L, (t = new Set(bench(L).map((g) => g.cs.b.lines.join('\n')))));
  return t;
}
/** A fresh practice program from far-away seeds — never one of the held-out programs (the same text counts as the same). */
export function practiceProgram(level: number, r: () => number): Buggy {
  const held = heldOut(level);
  for (;;) {
    const b = makeBuggy(level, 1_000_000 + Math.floor(r() * 1e8));
    if (!held.has(b.lines.join('\n'))) return b;
  }
}
/**
 * The held-out programs (20 a level): never trained on (he practises on fresh ones from far-away seeds).
 * Which seeds and their allowances are stored (bugsets.ts) so the phone does not wait on the plain order's
 * tries; `fresh` works them out again (the tests check the two agree).
 */
export function bench(level: number, fresh = false): Graded[] {
  const L = lvl(level);
  if (fresh) return graded(L, 70000, 20);
  let b = benches.get(L);
  if (!b) {
    const st = BUG_SETS[L - 1];
    b = st ? st.map((x) => ({ cs: prepare(rebuild(x)), limit: x.l, seed: x.s })) : graded(L, 70000, 20);
    benches.set(L, b);
  }
  return b;
}

/**
 * A held-out program as stored: its seed and allowance, the template, the variable names, the bug (line,
 * word, new word — and the second word of a swap), and the test inputs, shown and hidden (the answers are
 * worked out again by running the correct program).
 */
export interface StoredBug {
  s: number;
  l: number;
  t: string;
  n: Record<string, string>;
  b: (number | string)[];
  a: Val[][];
  h: Val[][];
}
export const storeBug = (g: Graded): StoredBug => {
  const b = g.cs.b;
  return { s: g.seed, l: g.limit, t: b.t.name, n: b.names, b: [b.bug.line, b.bug.tok, b.bug.to, ...(b.bug.tok2 != null ? [b.bug.tok2, b.bug.to2!] : [])], a: b.tests.map((x) => x.args), h: b.hidden.map((x) => x.args) };
};
export function rebuild(st: StoredBug): Buggy {
  const t = TEMPLATES.find((x) => x.name === st.t)!;
  const good = goodLines(t, st.n);
  const bug = changes(good).find((c) => c.line === st.b[0] && c.tok === st.b[1] && c.to === st.b[2] && (c.tok2 ?? -1) === (st.b[3] ?? -1))!;
  const prog = parse(good);
  const test = (args: Val[]): Test => ({ args, want: run(prog, args).value! });
  return { t, names: st.n, good, lines: apply(good, bug), bug, tests: st.a.map(test), hidden: st.h.map(test) };
}

// ---- words -------------------------------------------------------------------------------------------------

const call = (b: Buggy, t: Test) => `${b.t.name}(${t.args.map((a) => show(a)).join(', ')})`;

export function programText(lines: string[]): string {
  return indent(lines)
    .map((l, i) => `${String(i + 1).padStart(2, ' ')}  ${l}`)
    .join('\n');
}

function testLines(b: Buggy): string[] {
  const res = runTests(b.lines, b.tests);
  return b.tests.map((t, i) => {
    const g = res.got[i]!;
    return `${call(b, t)} should give ${show(t.want)}${res.pass[i] ? ' — passes' : ` — but ${typeof g === 'string' ? `stops: ${g}` : `gives ${show(g)}`}`}`;
  });
}

class BugEnv implements Env {
  cs: Case = prepare(makeBuggy(1, 1));
  tried = 0;
  constructor(private level: number) {}
  reset(seed: number) {
    this.cs = prepare(makeBuggy(this.level, seed));
    this.tried = 0;
  }
  /** Index of the candidate change to try. */
  actions() {
    return this.cs.cands.map((_, i) => i);
  }
  step(a: number) {
    this.tried++;
    if (fixes(this.cs, a)) return { reward: 10, done: true };
    return { reward: -0.2, done: this.tried >= this.cs.cands.length };
  }
  describe() {
    return `This program ${this.cs.b.t.what}, but has one bug:\n${programText(this.cs.b.lines)}\nTests:\n${testLines(this.cs.b).join('\n')}`;
  }
}

interface BugSave {
  game: 'bughunt';
  level: number;
  w: number[];
  programs: number;
  rand: number;
}

class BugLearner implements Learner {
  w: number[];
  programs: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<BugSave>(saved, 'bughunt');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts knowing nothing: every change looks the same, so he tries them top line first.
    this.w = s?.w?.length === FEATURES ? s.w.slice() : ZERO.slice();
    this.programs = s?.programs ?? 0;
  }
  /**
   * Practice on a fresh buggy program (never one from the test): try every candidate fix, see which ones
   * pass the tests, and nudge the weights so those score above the ones that do not (pairwise ranking).
   */
  train(n: number) {
    for (let k = 0; k < n; k++) {
      const cs = prepare(practiceProgram(this.level, this.r));
      const good: number[] = [];
      const bad: number[] = [];
      cs.cands.forEach((_, i) => (fixes(cs, i) ? good : bad).push(i));
      const sc = cs.feats.map((f) => f.reduce((t, x, j) => t + x * this.w[j]!, 0));
      const g = new Array(FEATURES).fill(0);
      for (const p of good)
        for (const q of bad) {
          const e = 1 / (1 + Math.exp(sc[p]! - sc[q]!));
          if (e < 1e-3) continue;
          for (let j = 0; j < FEATURES; j++) g[j] += e * (cs.feats[p]![j]! - cs.feats[q]![j]!);
        }
      const norm = Math.max(1, good.length * bad.length);
      // A kind of slip this level's programs do not have (yet) keeps no weight: he has not met it.
      const met = new Set<string>(slipsUpTo(this.level));
      for (let j = 0; j < FEATURES; j++) if (j < GENERAL || met.has(SLIPS[j - GENERAL]!)) this.w[j]! += (1.5 * g[j]!) / Math.sqrt(norm);
    }
    this.programs += n;
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const set = bench(this.level);
    let ok = 0;
    let tries = 0;
    for (const { cs, limit } of set) {
      const h = hunt(cs, this.w, limit, true);
      if (h.fix) ok++;
      tries += h.tries;
    }
    return { mastery: ok / set.length, detail: `I fix ${ok} of ${set.length} held-out buggy programs within my budget of tries (${(tries / set.length).toFixed(1)} tries each); a fix counts only when every test passes.` };
  }
  save(): BugSave {
    return { game: 'bughunt', level: this.level, w: this.w.slice(), programs: this.programs, rand: this.rand };
  }
  view(): Frame {
    const names = ['line run by a failing test', 'suspicious line (failing tests only)', 'line run by passing tests', 'change a comparison', 'change + − * / %', 'change a number by one', 'change a variable', 'swap and / or', 'a loop line', 'an if line', 'a return line', 'a plain sum or setting', '< vs <= (off by one)', 'further down', 'would not even read', 'the most suspicious line', 'a loop’s number', 'what is returned', 'a sum’s operator', 'what a line sets', 'a thing with itself', '< turned round to >', 'a / or %', ...SLIPS.map((k) => `slip: ${SLIP_WORDS[k]}`)];
    const mx = Math.max(0.01, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]! >= 0 ? 'suspects first' : 'suspects later'] as [string, number, string]).filter((_, i) => i < GENERAL || this.w[i] !== 0), caption: 'What he suspects first (only the kinds of slip he has met).' };
  }
  watch(seed: number): Frame[] {
    const cs = prepare(makeBuggy(this.level, seed));
    const b = cs.b;
    const code = programText(b.lines).split('\n');
    const tests = testLines(b);
    const frames: Frame[] = [{ lines: [`This program ${b.t.what}.`, ...code, ...tests], caption: 'One line has a bug. The failing tests show where to look.' }];
    const ord = order(cs, this.w).filter((i) => knowsSlip(this.w, cs.cands[i]!));
    const lim = Math.min(ord.length, 40);
    const tried: string[] = [];
    for (let k = 0; k < lim; k++) {
      const c = cs.cands[ord[k]!]!;
      const ok = fixes(cs, ord[k]!);
      tried.push(`Try ${k + 1}: line ${c.line} → ${apply(b.lines, c)[c.line - 1]}  ${ok ? '✓ all tests pass' : '✗'}`);
      if (ok || k < 6) frames.push({ lines: [...code, ...tried.slice(-8)], caption: ok ? `Fixed after ${k + 1} tries: line ${c.line} should be "${apply(b.lines, c)[c.line - 1]}".` : `Try ${k + 1}` });
      if (ok) return frames;
    }
    const why = lim ? `Not found in ${lim} tries.` : 'He has not practised with this kind of slip yet, so he does not suspect it.';
    frames.push({ lines: [...code, ...tried.slice(-8)], caption: `${why} The bug was on line ${b.bug.line}: it should be "${b.good[b.bug.line - 1]}".` });
    return frames;
  }
}

// ---- problems ---------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const b = makeBuggy(level, seed);
  const text = [
    `The program ${b.t.name} ${b.t.what}, but exactly one line has a bug.`,
    RULES,
    programText(b.lines),
    'Tests:',
    ...testLines(b),
    'Name the buggy line and write it corrected. Answer like: Line 4: s = s + i',
  ].join('\n');
  return { game: 'bughunt', level: lvl(level), seed, text, data: { lines: b.lines, tests: b.tests, hidden: b.hidden, bug: b.bug, good: b.good[b.bug.line - 1] } };
}

/** "Line 4: s = s + i" (or "line 4 should be `s = s + i`") from a reply: the last line that names a line number and its new text. */
export function readFix(answer: string): { line: number; text: string } | null {
  const rows = answer
    .split('\n')
    .map((l) => l.replace(/\*\*|__/g, ' ').trim())
    .filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i]!.match(/\bline\s*(\d+)\b[\s,]*(?:(?:it|this)\s+)?(?:should\s+(?:be|read)|becomes|→|->|=>|[:\-–—])\s*(.+)$/i);
    if (m) {
      // The new line, without quotes, a trailing remark in brackets ("(was wrong)") or a // comment.
      const text = m[2]!
        .replace(/`/g, '')
        .replace(/\s*\/\/.*$/, '')
        .replace(/\s+\((?=[^()]*[a-z]{3})[^()]*\)\s*\.?$/i, '')
        .replace(/^["“']|["”'.]+$/g, '')
        .trim();
      if (text) return { line: Number(m[1]), text };
    }
  }
  return null;
}

/** How many tokens must change (insert, delete, replace) to turn one line into the other. */
export function tokenEdits(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length]!;
}

/**
 * A fix counts when the changed line is a small edit of the line that was there (at most two words
 * changed — a bug is one slip, so its fix is too; no rewriting a line into a `return`), and the program
 * then passes every test: the ones shown AND the hidden ones, so an answer that just lists the shown
 * tests' answers fails.
 */
function check(prob: Problem, answer: string): Verdict {
  const d = prob.data as { lines: string[]; tests: Test[]; hidden: Test[] };
  const fix = readFix(answer) ?? readFix(`Line ${finalLine(answer)}`);
  if (!fix) return { correct: false, score: 0, why: 'No "Line N: corrected line" found.' };
  if (fix.line < 2 || fix.line > d.lines.length) return { correct: false, score: 0, why: `There is no line ${fix.line} to fix.` };
  const old = d.lines[fix.line - 1]!;
  const neu = fmt(tokens(fix.text));
  if (tokens(neu)[0] === 'return' && tokens(old)[0] !== 'return') return { correct: false, score: 0, why: `Line ${fix.line} is not a return: a fix changes the slip, it does not rewrite the line.` };
  if (tokenEdits(old, neu) > 2) return { correct: false, score: 0, why: `That rewrites line ${fix.line}; the bug is one small slip.` };
  const lines = d.lines.slice();
  lines[fix.line - 1] = neu;
  const all = [...d.tests, ...(d.hidden ?? [])];
  const res = runTests(lines, all);
  const n = res.pass.filter(Boolean).length;
  if (n === all.length) return { correct: true, score: 1, why: `Line ${fix.line} fixed: every test passes, the hidden ones too.` };
  return { correct: false, score: (0.5 * n) / all.length, why: `With that change ${n} of ${all.length} tests pass (some are hidden).` };
}

export const bughunt: Game = {
  ...BUGHUNT,
  env: (level) => new BugEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new BugLearner(level, seed, saved),
};
