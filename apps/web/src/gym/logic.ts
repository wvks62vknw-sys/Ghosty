/**
 * LOGIC SANDBOX: claims of the form "from these premises, this follows". Levels 1–5 are propositional logic
 * (letters p, q, r… joined by not / and / or / if-then / if-and-only-if); Levels 6–10 are simple
 * first-order claims over a small finite world with named individuals (a, b, c, d) and predicates (Red(x),
 * Big(x), Round(x), Likes(x, y)), where "for every x" means "for each of the individuals" — so every claim
 * can be checked exactly.
 *
 * Ground truth is never his say-so: a claim is VALID when no case makes every premise true and the
 * conclusion false. That is checked by a full truth table (every true/false assignment, worked out from
 * the formulas themselves) when there are at most 8 basic facts, and by a complete SAT solver (DPLL)
 * otherwise; the tests check the two agree.
 *
 * He proves claims with resolution: the premises and the conclusion's opposite are written as clauses
 * ("this or that"), and two clauses that disagree on one letter combine into a new one; deriving the empty
 * clause (a contradiction) proves the claim. Resolution is sound, so a false claim can never be proved — and
 * every proof he offers is re-checked step by step (`verifyProof`) and against the truth table anyway: a
 * false claim accepted is a hard failure that sets mastery to 0 (tested with a cheating prover).
 * What he learns is the ORDER in which to try pairs of clauses (a score from a few facts about each pair:
 * does it use the conclusion's opposite, is one clause a single fact, how short is the result, which kinds
 * of premise it draws on…), by evolution on practice claims. Each level brings a new kind of premise
 * (either-or, if-both-then, if-and-only-if, for-every, there-is, Likes rules…) that every true claim of the
 * level needs; he can only use kinds of premise he has practised with, so a level is never passed on what
 * he knew before. Mastery = the share of held-out TRUE claims he proves within his allowance — a little
 * more than a strong textbook search order needs (less slack level by level), never more than half the
 * plain order's — with no false claim ever accepted.
 */
import { type Env, finalLine, type Frame, type Game, type Learner, lvl, pick, type Problem, randInt, rng, savedFor, shuffle, type Verdict } from './core';
import { oneVerdict } from './answer';
import { LOGIC_SETS } from './logicsets';
import { LOGIC } from './meta';

// ---- formulas ---------------------------------------------------------------------------------------------

export type F =
  | { k: 'p'; p: string; t: string[] }
  | { k: 'not'; a: F }
  | { k: 'and' | 'or' | 'imp' | 'iff'; a: F; b: F }
  | { k: 'all' | 'ex'; v: string; a: F };

export const atom = (p: string, ...t: string[]): F => ({ k: 'p', p, t });
export const not = (a: F): F => ({ k: 'not', a });
export const and = (a: F, b: F): F => ({ k: 'and', a, b });
export const or = (a: F, b: F): F => ({ k: 'or', a, b });
export const imp = (a: F, b: F): F => ({ k: 'imp', a, b });
export const iff = (a: F, b: F): F => ({ k: 'iff', a, b });
export const all = (v: string, a: F): F => ({ k: 'all', v, a });
export const ex = (v: string, a: F): F => ({ k: 'ex', v, a });

const SYM = { and: '∧', or: '∨', imp: '→', iff: '↔' } as const;

/** A formula in symbols: p ∧ ¬q → r, ∀x (Red(x) → Big(x)). */
export function show(f: F, top = true): string {
  switch (f.k) {
    case 'p':
      return f.t.length ? `${f.p}(${f.t.join(', ')})` : f.p;
    case 'not':
      return `¬${show(f.a, false)}`;
    case 'all':
    case 'ex':
      return `${f.k === 'all' ? '∀' : '∃'}${f.v} ${f.a.k === 'all' || f.a.k === 'ex' || f.a.k === 'p' || f.a.k === 'not' ? show(f.a, false) : `(${show(f.a, true)})`}`;
    default: {
      const s = `${show(f.a, false)} ${SYM[f.k]} ${show(f.b, false)}`;
      return top ? s : `(${s})`;
    }
  }
}

export interface Claim {
  premises: F[];
  goal: F;
  /** The individuals of the finite world (empty for propositional claims). */
  world: string[];
}

export const claimText = (c: Claim) => `${c.premises.map((p) => show(p)).join(' ; ')} ⊢ ${show(c.goal)}`;

/** Read a formula written the way `show` writes it (nested two-sided formulas are always in brackets). */
export function parse(text: string): F {
  const toks = text.match(/[A-Za-z]+\([^)]*\)|[a-z]\b|[¬∀∃()]|[∧∨→↔]|[a-z]/g) ?? [];
  let i = 0;
  const unary = (): F => {
    const t = toks[i++];
    if (t === '¬') return not(unary());
    if (t === '∀' || t === '∃') {
      const v = toks[i++]!;
      return t === '∀' ? all(v, unary()) : ex(v, unary());
    }
    if (t === '(') {
      const f = binary();
      if (toks[i++] !== ')') throw new Error('bracket');
      return f;
    }
    if (!t) throw new Error('incomplete');
    const m = t.match(/^([A-Za-z]+)\(([^)]*)\)$/);
    return m ? atom(m[1]!, ...m[2]!.split(',').map((x) => x.trim())) : atom(t);
  };
  const binary = (): F => {
    const a = unary();
    const op = toks[i];
    const k = op === '∧' ? 'and' : op === '∨' ? 'or' : op === '→' ? 'imp' : op === '↔' ? 'iff' : null;
    if (!k) return a;
    i++;
    return { k, a, b: unary() };
  };
  const f = binary();
  if (i < toks.length) throw new Error('extra');
  return f;
}

/** A stored claim: "a,b,c|premise ; premise ⊢ conclusion". */
export const claimOf = (line: string): Claim => {
  const [w, body] = line.split('|') as [string, string];
  const [prem, goal] = body.split(' ⊢ ') as [string, string];
  return { world: w ? w.split(',') : [], premises: prem.split(' ; ').map(parse), goal: parse(goal) };
};
export const lineOf = (c: Claim) => `${c.world.join(',')}|${claimText(c)}`;

// ---- grounding: over a finite world, ∀ is "and" over the individuals and ∃ is "or" -------------------------

/** Ground formulas: atoms are numbered basic facts. */
type G = { k: 'v'; n: number } | { k: 'not'; a: G } | { k: 'and' | 'or'; xs: G[] } | { k: 'imp' | 'iff'; a: G; b: G };

export class Atoms {
  names: string[] = [];
  ids = new Map<string, number>();
  id(name: string): number {
    let i = this.ids.get(name);
    if (i == null) {
      i = this.names.length;
      this.ids.set(name, i);
      this.names.push(name);
    }
    return i;
  }
}

function ground(f: F, world: string[], at: Atoms, env: Record<string, string> = {}): G {
  switch (f.k) {
    case 'p':
      return { k: 'v', n: at.id(f.t.length ? `${f.p}(${f.t.map((t) => env[t] ?? t).join(', ')})` : f.p) };
    case 'not':
      return { k: 'not', a: ground(f.a, world, at, env) };
    case 'and':
    case 'or':
      return { k: f.k, xs: [ground(f.a, world, at, env), ground(f.b, world, at, env)] };
    case 'imp':
    case 'iff':
      return { k: f.k, a: ground(f.a, world, at, env), b: ground(f.b, world, at, env) };
    case 'all':
    case 'ex':
      return { k: f.k === 'all' ? 'and' : 'or', xs: world.map((d) => ground(f.a, world, at, { ...env, [f.v]: d })) };
  }
}

function evalG(g: G, val: (n: number) => boolean): boolean {
  switch (g.k) {
    case 'v':
      return val(g.n);
    case 'not':
      return !evalG(g.a, val);
    case 'and':
      return g.xs.every((x) => evalG(x, val));
    case 'or':
      return g.xs.some((x) => evalG(x, val));
    case 'imp':
      return !evalG(g.a, val) || evalG(g.b, val);
    case 'iff':
      return evalG(g.a, val) === evalG(g.b, val);
  }
}

/** Every basic fact the claim mentions, and its premises / conclusion grounded. */
export function groundClaim(c: Claim) {
  const at = new Atoms();
  const prem = c.premises.map((p) => ground(p, c.world, at));
  const goal = ground(c.goal, c.world, at);
  return { at, prem, goal };
}

/** Truth table / exhaustive model check: a case (assignment) where every premise holds and the conclusion fails, or null. */
export function counterBrute(c: Claim): boolean[] | null {
  const { at, prem, goal } = groundClaim(c);
  const n = at.names.length;
  if (n > 20) throw new Error('too many facts for a truth table');
  for (let m = 0; m < 1 << n; m++) {
    const val = (i: number) => ((m >> i) & 1) === 1;
    if (prem.every((p) => evalG(p, val)) && !evalG(goal, val)) return Array.from({ length: n }, (_, i) => val(i));
  }
  return null;
}

// ---- clauses: literal = ±(atom + 1) ---------------------------------------------------------------------

export type Clause = number[];

function nnf(g: G, neg: boolean): G {
  switch (g.k) {
    case 'v':
      return neg ? { k: 'not', a: g } : g;
    case 'not':
      return nnf(g.a, !neg);
    case 'and':
    case 'or': {
      const k = (g.k === 'and') !== neg ? 'and' : 'or';
      return { k, xs: g.xs.map((x) => nnf(x, neg)) };
    }
    case 'imp':
      return nnf({ k: 'or', xs: [{ k: 'not', a: g.a }, g.b] }, neg);
    case 'iff':
      return nnf({ k: 'and', xs: [{ k: 'imp', a: g.a, b: g.b }, { k: 'imp', a: g.b, b: g.a }] }, neg);
  }
}

const norm = (c: Clause): Clause | null => {
  const s = [...new Set(c)].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y);
  for (let i = 1; i < s.length; i++) if (s[i] === -s[i - 1]!) return null; // p ∨ ¬p: always true, dropped
  return s;
};

function cnfOf(g: G): Clause[] {
  switch (g.k) {
    case 'v':
      return [[g.n + 1]];
    case 'not':
      return [[-((g.a as { n: number }).n + 1)]];
    case 'and':
      return g.xs.flatMap(cnfOf);
    case 'or': {
      let acc: Clause[] = [[]];
      for (const x of g.xs) {
        const cx = cnfOf(x);
        const next: Clause[] = [];
        for (const a of acc) for (const b of cx) next.push([...a, ...b]);
        acc = next;
      }
      return acc;
    }
    default:
      throw new Error('not in NNF');
  }
}

/** Clauses with duplicates and always-true ones dropped. */
export function toClauses(g: G, neg = false): Clause[] {
  const out: Clause[] = [];
  const seen = new Set<string>();
  for (const c of cnfOf(nnf(g, neg))) {
    const s = norm(c);
    if (!s) continue;
    const k = s.join(',');
    if (!seen.has(k)) seen.add(k), out.push(s);
  }
  return out;
}

/** DPLL: a satisfying assignment of the clauses (by atom), or null when there is none. Complete. */
export function sat(clauses: Clause[], n: number): Int8Array | null {
  const val = new Int8Array(n); // 0 unknown, 1 true, -1 false
  const litVal = (l: number) => (l > 0 ? val[l - 1]! : -val[-l - 1]!);
  const rec = (): boolean => {
    // Unit propagation, repeated.
    const trail: number[] = [];
    for (;;) {
      let unit = 0;
      for (const c of clauses) {
        let open = 0;
        let last = 0;
        let ok = false;
        for (const l of c) {
          const v = litVal(l);
          if (v === 1) {
            ok = true;
            break;
          }
          if (v === 0) open++, (last = l);
        }
        if (ok) continue;
        if (open === 0) {
          for (const a of trail) val[a] = 0;
          return false;
        }
        if (open === 1) {
          unit = last;
          break;
        }
      }
      if (!unit) break;
      val[Math.abs(unit) - 1] = unit > 0 ? 1 : -1;
      trail.push(Math.abs(unit) - 1);
    }
    // Branch on a letter of the shortest clause not yet satisfied (none left: every clause holds).
    let pickLit = 0;
    let fewest = Infinity;
    for (const c of clauses) {
      let open = 0;
      let lit = 0;
      let ok = false;
      for (const l of c) {
        const v = litVal(l);
        if (v === 1) {
          ok = true;
          break;
        }
        if (v === 0) open++, (lit = l);
      }
      if (!ok && open < fewest) (fewest = open), (pickLit = lit);
    }
    if (!pickLit) return true;
    const free = Math.abs(pickLit) - 1;
    for (const v of pickLit > 0 ? [1, -1] : [-1, 1]) {
      val[free] = v;
      if (rec()) return true;
    }
    val[free] = 0;
    for (const a of trail) val[a] = 0;
    return false;
  };
  return rec() ? val : null;
}

/** The claim's clauses: premises', then the conclusion's opposite (marked `goal`). */
export function clausesOf(c: Claim) {
  const { at, prem, goal } = groundClaim(c);
  /** Each clause, whether it comes from the conclusion's opposite, and the form of the premise it came from. */
  const list: { lits: Clause; goal: boolean; form: number }[] = [];
  const seen = new Set<string>();
  const add = (cs: Clause[], g: boolean, form: number) => {
    for (const x of cs) {
      const k = x.join(',');
      if (!seen.has(k)) seen.add(k), list.push({ lits: x, goal: g, form });
    }
  };
  prem.forEach((p, i) => add(toClauses(p), false, FORMS.indexOf(formOf(c.premises[i]!))));
  add(toClauses(goal, true), true, 0);
  return { at, list };
}

/** Ground truth: does the conclusion follow? A full truth table up to 8 basic facts, the complete SAT solver beyond (tested to agree). */
export function valid(c: Claim): boolean {
  const { at, list } = clausesOf(c);
  if (at.names.length <= 8) return counterBrute(c) === null;
  return sat(
    list.map((x) => x.lits),
    at.names.length,
  ) === null;
}

// ---- his prover: resolution, pairs tried in the order his weights score them -------------------------------

/** What he notices about a pair of clauses: ten general facts, then one per premise form it draws on. */
export const GENERAL = 10;
export const FEATURES = GENERAL + 12;

export interface PStep {
  /** Indices of the two clauses combined, the letter they disagree on, the new clause. */
  i: number;
  j: number;
  pivot: number;
  res: Clause;
}

interface Node {
  lits: Clause;
  goal: boolean;
  gen: number;
  /** The premise forms it was derived from (bit per form). */
  forms: number;
}

/** Combine two clauses on their one disagreement; null when they disagree on none or on more than one (the result would be always true). */
export function resolve(a: Clause, b: Clause): { pivot: number; res: Clause } | null {
  let pivot = 0;
  for (const l of a)
    if (b.includes(-l)) {
      if (pivot) return null;
      pivot = l;
    }
  if (!pivot) return null;
  const res = norm([...a.filter((l) => l !== pivot), ...b.filter((l) => l !== -pivot)]);
  return res ? { pivot: Math.abs(pivot), res } : null;
}

function pairFeatures(a: Node, b: Node, res: Clause, goalAtoms: Set<number>, pivot: number): number[] {
  const big = Math.max(a.lits.length, b.lits.length);
  return [
    a.goal || b.goal ? 1 : 0,
    !a.goal && !b.goal ? 1 : 0,
    a.lits.length === 1 || b.lits.length === 1 ? 1 : 0,
    res.length === 0 ? 1 : 0,
    res.length === 1 ? 1 : 0,
    (res.length - big) / 3,
    res.length / 4,
    Math.max(a.gen, b.gen) / 5,
    (a.lits.length + b.lits.length) / 6,
    goalAtoms.has(pivot) ? 1 : 0,
    ...FORMS_BITS.map((bit) => ((a.forms | b.forms) & bit ? 1 : 0)),
  ];
}
const FORMS_BITS = Array.from({ length: 12 }, (_, i) => 1 << i);

/** A tiny max-heap of scored pairs (ties: the earlier pair first — so zero weights try pairs as they come). */
class Heap {
  s: number[] = [];
  o: number[] = [];
  v: [number, number, number, Clause][] = [];
  private less(x: number, y: number) {
    return this.s[x]! < this.s[y]! || (this.s[x] === this.s[y] && this.o[x]! > this.o[y]!);
  }
  private swap(x: number, y: number) {
    [this.s[x], this.s[y]] = [this.s[y]!, this.s[x]!];
    [this.o[x], this.o[y]] = [this.o[y]!, this.o[x]!];
    [this.v[x], this.v[y]] = [this.v[y]!, this.v[x]!];
  }
  push(score: number, order: number, v: [number, number, number, Clause]) {
    this.s.push(score), this.o.push(order), this.v.push(v);
    let i = this.s.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(p, i)) break;
      this.swap(p, i);
      i = p;
    }
  }
  pop(): [number, number, number, Clause] | undefined {
    if (!this.v.length) return undefined;
    const top = this.v[0]!;
    const last = this.s.length - 1;
    this.swap(0, last);
    this.s.pop(), this.o.pop(), this.v.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.s.length && this.less(m, l)) m = l;
      if (r < this.s.length && this.less(m, r)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export interface ProofRun {
  /** Found a contradiction? */
  proved: boolean;
  /** Pairs combined (each one a step). */
  steps: number;
  /** The starting clauses, then every derived one in order. */
  clauses: { lits: Clause; goal: boolean }[];
  /** Every step taken (the proof is the steps leading to the empty clause). */
  trace: PStep[];
  /** The basic facts' names (for the words). */
  at: Atoms;
}

/** Put individual d in place of variable v. */
export function subst(f: F, v: string, d: string): F {
  switch (f.k) {
    case 'p':
      return { k: 'p', p: f.p, t: f.t.map((t) => (t === v ? d : t)) };
    case 'not':
      return { k: 'not', a: subst(f.a, v, d) };
    case 'all':
    case 'ex':
      return f.v === v ? f : { k: f.k, v: f.v, a: subst(f.a, v, d) };
    default:
      return { k: f.k, a: subst(f.a, v, d), b: subst(f.b, v, d) };
  }
}

/**
 * What has to be proved: "for every x, …" over a finite world is proved one individual at a time (for a,
 * then for b, …: the "for all" rule of natural deduction over a closed world); anything else in one go.
 */
export function partsOf(c: Claim): Claim[] {
  if (c.goal.k === 'all' && c.world.length) {
    const g = c.goal;
    return c.world.map((d) => ({ premises: c.premises, goal: subst(g.a, g.v, d), world: c.world }));
  }
  return [c];
}

/**
 * Resolution on one part with a step budget: each step combines the best-scored pair not yet combined.
 * `learner`: he can only use the kinds of premise he has practised with (a weight for the form); clauses
 * from any other kind are not used at all. Without it (the yardsticks) every clause is usable.
 */
export function refute(c: Claim, w: number[], budget: number, learner = false): ProofRun {
  const { list, at } = clausesOf(c);
  const nodes: Node[] = [];
  const seen = new Set<string>();
  /** Literal → the clauses containing it (so a new clause meets only the ones it can combine with). */
  const occ = new Map<number, number[]>();
  const heap = new Heap();
  const goalAtoms = new Set(list.filter((x) => x.goal).flatMap((x) => x.lits.map(Math.abs)));
  /** The premise forms he has no weight for yet (never practised with): bit per form. */
  let unknown = 0;
  if (learner) for (let k = 0; k < FORMS.length; k++) if (w[GENERAL + k] === 0) unknown |= 1 << k;
  let order = 0;
  const subsumed = (r: Clause) => nodes.some((n) => n.lits.length <= r.length && n.lits.every((l) => r.includes(l)));
  const add = (lits: Clause, goal: boolean, gen: number, forms: number) => {
    const i = nodes.length;
    nodes.push({ lits, goal, gen, forms });
    seen.add(lits.join(','));
    const partners = new Set<number>();
    for (const l of lits) for (const j of occ.get(-l) ?? []) partners.add(j);
    for (const j of [...partners].sort((x, y) => x - y)) {
      const r = resolve(nodes[j]!.lits, lits);
      if (!r || seen.has(r.res.join(','))) continue;
      const f = pairFeatures(nodes[j]!, nodes[i]!, r.res, goalAtoms, r.pivot);
      let sc = 0;
      for (let k = 0; k < FEATURES; k++) sc += w[k]! * f[k]!;
      heap.push(sc, order++, [j, i, r.pivot, r.res]);
    }
    for (const l of lits) {
      const o = occ.get(l);
      if (o) o.push(i);
      else occ.set(l, [i]);
    }
  };
  for (const x of list) if (!((1 << x.form) & unknown)) add(x.lits, x.goal, 0, 1 << x.form);
  const trace: PStep[] = [];
  let steps = 0;
  for (;;) {
    const top = heap.pop();
    if (!top) break;
    const [i, j, pivot, res] = top;
    const k = res.join(',');
    if (seen.has(k) || (res.length && subsumed(res))) continue;
    if (++steps > budget) {
      steps = budget;
      break;
    }
    trace.push({ i, j, pivot, res });
    add(res, nodes[i]!.goal || nodes[j]!.goal, Math.max(nodes[i]!.gen, nodes[j]!.gen) + 1, nodes[i]!.forms | nodes[j]!.forms);
    if (!res.length) return { proved: true, steps, clauses: nodes, trace, at };
  }
  return { proved: false, steps, clauses: nodes, trace, at };
}

export interface Attempt {
  proved: boolean;
  /** Steps over all parts. */
  steps: number;
  parts: Claim[];
  runs: ProofRun[];
}

/** His proof attempt: every part in turn, all sharing one step budget. */
export function prove(c: Claim, w: number[], budget: number, learner = false): Attempt {
  const parts = partsOf(c);
  const runs: ProofRun[] = [];
  let steps = 0;
  for (const p of parts) {
    const run = refute(p, w, budget - steps, learner);
    runs.push(run);
    steps += run.steps;
    if (!run.proved) return { proved: false, steps, parts, runs };
  }
  return { proved: true, steps, parts, runs };
}

/** Only the steps that lead to the empty clause. */
export function proofOf(run: ProofRun): PStep[] {
  if (!run.proved) return [];
  const base = run.clauses.length - run.trace.length;
  const need = new Set<number>([run.clauses.length - 1]);
  for (let s = run.trace.length - 1; s >= 0; s--) {
    if (!need.has(base + s)) continue;
    need.add(run.trace[s]!.i);
    need.add(run.trace[s]!.j);
  }
  return run.trace.filter((_, s) => need.has(base + s));
}

export type ProofStep = { a: Clause; b: Clause; res: Clause };

/**
 * Re-check a proof from scratch, part by part: every step must combine two clauses that are the premises'
 * clauses, the part's conclusion's opposite, or earlier results, on exactly one disagreement, giving what it
 * says; each part must end in the empty clause. Steps name clauses by their literals, not by index.
 */
export function verifyProof(c: Claim, proof: ProofStep[][]): boolean {
  const parts = partsOf(c);
  if (proof.length !== parts.length) return false;
  return parts.every((part, k) => {
    const steps = proof[k]!;
    const known = new Set(clausesOf(part).list.map((x) => x.lits.join(',')));
    for (const s of steps) {
      const a = norm(s.a);
      const b = norm(s.b);
      if (!a || !b || !known.has(a.join(',')) || !known.has(b.join(','))) return false;
      const r = resolve(a, b);
      if (!r || r.res.join(',') !== (norm(s.res) ?? ['x']).join(',')) return false;
      known.add(r.res.join(','));
    }
    return steps.length > 0 && steps[steps.length - 1]!.res.length === 0;
  });
}

/** A proof attempt as checkable steps (clause literals), part by part. */
export const proofSteps = (t: Attempt): ProofStep[][] => t.runs.map((run) => proofOf(run).map((s) => ({ a: run.clauses[s.i]!.lits, b: run.clauses[s.j]!.lits, res: s.res })));

// ---- making claims ---------------------------------------------------------------------------------------

/**
 * The kinds of premise ("forms"). Each level brings one new form, and every true claim of that level
 * needs a premise of it (without it the conclusion would not follow) — so a level asks for something he
 * has not met before. His search order has a weight for pairs that use each form; a form he has never met
 * has none until he practises with it.
 */
export const FORMS = ['goal', 'fact', 'imp', 'or', 'andimp', 'iff', 'impor', 'all-imp', 'all-or', 'exists', 'likes', 'all-complex'] as const;
export type Form = (typeof FORMS)[number];
export const FORM_WORDS: Record<Form, string> = {
  goal: 'the conclusion’s opposite',
  fact: 'a plain fact',
  imp: 'an if-then',
  or: 'an either-or',
  andimp: 'an if-both-then',
  iff: 'an if-and-only-if',
  impor: 'an if-then-either',
  'all-imp': 'a for-every if-then',
  'all-or': 'a for-every either-or',
  exists: 'a there-is',
  likes: 'a Likes rule',
  'all-complex': 'a for-every if-both / then-either',
};

const isLit = (f: F) => f.k === 'p' || (f.k === 'not' && f.a.k === 'p');
/** Which form a premise has (read from its shape, so stored claims need no labels). */
export function formOf(f: F): Form {
  if (isLit(f)) return 'fact';
  if (f.k === 'ex') return 'exists';
  if (f.k === 'all') {
    if (show(f).includes('Likes')) return 'likes';
    const b = f.a;
    if (b.k === 'or') return 'all-or';
    if (b.k === 'imp' && isLit(b.a) && isLit(b.b)) return 'all-imp';
    return 'all-complex';
  }
  if (f.k === 'iff') return 'iff';
  if (f.k === 'or') return 'or';
  if (f.k === 'imp') return f.a.k === 'and' ? 'andimp' : f.b.k === 'or' ? 'impor' : 'imp';
  return 'fact';
}

export interface Spec {
  /** Letters (propositional) or individuals (first-order). */
  atoms: number;
  premises: number;
  fo: boolean;
  /** The forms premises may take, and the new one every true claim of the level needs. */
  forms: Form[];
  fresh: Form;
}

export const specFor = (level: number): Spec =>
  (
    [
      { atoms: 4, premises: 5, fo: false, forms: ['fact', 'imp'], fresh: 'imp' },
      { atoms: 5, premises: 6, fo: false, forms: ['fact', 'imp', 'or'], fresh: 'or' },
      { atoms: 5, premises: 7, fo: false, forms: ['fact', 'imp', 'or', 'andimp'], fresh: 'andimp' },
      { atoms: 6, premises: 8, fo: false, forms: ['fact', 'imp', 'or', 'andimp', 'iff'], fresh: 'iff' },
      { atoms: 6, premises: 9, fo: false, forms: ['fact', 'imp', 'or', 'andimp', 'iff', 'impor'], fresh: 'impor' },
      { atoms: 3, premises: 5, fo: true, forms: ['fact', 'all-imp'], fresh: 'all-imp' },
      { atoms: 3, premises: 6, fo: true, forms: ['fact', 'all-imp', 'all-or'], fresh: 'all-or' },
      { atoms: 3, premises: 6, fo: true, forms: ['fact', 'all-imp', 'all-or', 'exists'], fresh: 'exists' },
      { atoms: 4, premises: 6, fo: true, forms: ['fact', 'all-imp', 'all-or', 'exists', 'likes'], fresh: 'likes' },
      { atoms: 4, premises: 7, fo: true, forms: ['fact', 'all-imp', 'all-or', 'exists', 'likes', 'all-complex'], fresh: 'all-complex' },
    ] as Spec[]
  )[lvl(level) - 1]!;

const LETTERS = ['p', 'q', 'r', 's', 't', 'u'];
const PEOPLE = ['a', 'b', 'c', 'd'];
const PREDS = ['Red', 'Big', 'Round'];

function propPremise(r: () => number, sp: Spec, form: Form): F {
  // Different letters within one premise (no "q → q").
  const pool = shuffle(r, LETTERS.slice(0, sp.atoms));
  const L = () => {
    const a = atom(pool.pop() ?? pick(r, LETTERS.slice(0, sp.atoms)));
    return r() < 0.3 ? not(a) : a;
  };
  switch (form) {
    case 'imp':
      return imp(L(), L());
    case 'or':
      return or(L(), L());
    case 'andimp':
      return imp(and(L(), L()), L());
    case 'iff':
      return iff(L(), L());
    case 'impor':
      return imp(L(), or(L(), L()));
    default:
      return L();
  }
}

function propGoals(sp: Spec): F[] {
  const ls = LETTERS.slice(0, sp.atoms);
  const lits = ls.flatMap((x) => [atom(x), not(atom(x))]);
  const out: F[] = [...lits];
  const letter = (f: F) => show(f).replace('¬', '');
  for (const a of lits) for (const b of lits) if (letter(a) < letter(b)) out.push(or(a, b), imp(a, b), and(a, b));
  return out;
}

function foPremise(r: () => number, sp: Spec, world: string[], form: Form): F {
  const preds = PREDS.slice(0, Math.min(3, sp.atoms));
  const pool = shuffle(r, preds.slice());
  const P = (v: string) => {
    const a = atom(pool.pop() ?? pick(r, preds), v);
    return r() < 0.25 ? not(a) : a;
  };
  const who = () => pick(r, world);
  switch (form) {
    case 'all-imp':
      return all('x', imp(P('x'), P('x')));
    case 'all-or':
      return all('x', or(P('x'), P('x')));
    case 'exists':
      return ex('x', P('x'));
    case 'likes':
      return pick(r, [all('x', all('y', imp(atom('Likes', 'x', 'y'), atom('Likes', 'y', 'x')))), all('x', imp(atom('Likes', 'x', who()), P('x'))), all('x', imp(P('x'), ex('y', atom('Likes', 'x', 'y'))))]);
    case 'all-complex':
      return r() < 0.5 ? all('x', imp(and(P('x'), P('x')), P('x'))) : all('x', imp(P('x'), or(P('x'), P('x'))));
    default:
      // A plain fact: about one individual (or who likes whom, once Likes rules are about).
      return sp.forms.includes('likes') && r() < 0.4 ? atom('Likes', who(), who()) : P(who());
  }
}

function foGoals(sp: Spec, world: string[]): F[] {
  const preds = PREDS.slice(0, Math.min(3, sp.atoms));
  const lit = (p: string, v: string, n: boolean) => (n ? not(atom(p, v)) : atom(p, v));
  const out: F[] = [];
  for (const p of preds)
    for (const n of [false, true]) {
      for (const d of world) out.push(lit(p, d, n));
      out.push(ex('x', lit(p, 'x', n)), all('x', lit(p, 'x', n)));
      for (const q of preds) if (q !== p) for (const m of [false, true]) out.push(all('x', imp(lit(p, 'x', n), lit(q, 'x', m))), ex('x', and(lit(p, 'x', n), lit(q, 'x', m))));
    }
  if (sp.forms.includes('likes')) for (const a of world) for (const b of world) out.push(atom('Likes', a, b));
  return out;
}

const same = (a: F, b: F) => show(a) === show(b);

/**
 * A claim whose truth is `want`: premises (that can all be true together) with at least one of the level's
 * new form, then a conclusion from a pool of candidates that does (or does not) follow — never one of the
 * premises themselves; a true one must NEED the new form (without those premises it would not follow).
 * `hard` (for the stored test sets): of a few true candidates, the one the plain order needs most steps
 * for. Otherwise the first that fits, with a bounded number of tries — null if none (the caller falls
 * back to a stored claim), so making a problem never stalls.
 */
export function makeClaim(level: number, seed: number, want: boolean, hard = true): Claim | null {
  const sp = specFor(level);
  const r = rng(seed * 31 + lvl(level) * 7 + (want ? 1 : 0));
  const world = sp.fo ? PEOPLE.slice(0, sp.atoms) : [];
  const cap = 2 * budgetFor(level);
  for (let tries = 0; hard || tries < 25; tries++) {
    const premises: F[] = [];
    for (let k = 0; premises.length < sp.premises && k < 50; k++) {
      const form = premises.length === 0 ? sp.fresh : pick(r, sp.forms);
      const p = sp.fo ? foPremise(r, sp, world, form) : propPremise(r, sp, form);
      if (!premises.some((q) => same(p, q))) premises.push(p);
    }
    // The premises must be possible together (otherwise anything follows).
    const pc = clausesOf({ premises, goal: atom('p'), world });
    if (!sat(pc.list.filter((x) => !x.goal).map((x) => x.lits), pc.at.names.length)) continue;
    const without = premises.filter((p) => formOf(p) !== sp.fresh);
    const goals = shuffle(r, (sp.fo ? foGoals(sp, world) : propGoals(sp)).filter((g) => !premises.some((p) => same(p, g))));
    let best: Claim | null = null;
    let most = -1;
    let seen = 0;
    for (const goal of goals.slice(0, hard ? 60 : 30)) {
      const c = { premises, goal, world };
      if (valid(c) !== want) continue;
      if (!want) return c;
      if (valid({ premises: without, goal, world })) continue;
      if (!hard) {
        if (!prove(c, ZERO, 2).proved) return c;
        continue;
      }
      const run = prove(c, ZERO, cap);
      // (One the plain order cannot finish within the cap has no fair allowance: skipped.)
      if (run.proved && run.steps > most) (most = run.steps), (best = c);
      if (++seen >= 4) break;
    }
    if (best && most >= 3) return best;
  }
  return null;
}

/** A claim for a problem or a WATCH: made fresh when that is quick, else one of the stored practice / test claims. */
export function quickClaim(level: number, seed: number, want: boolean): Claim {
  const c = makeClaim(level, seed, want, false);
  if (c) return c;
  const b = bench(level);
  const list = want ? b.practice.map((g) => g.c) : b.falses;
  return list[seed % list.length]!;
}

const ZERO = new Array(FEATURES).fill(0);

export const budgetFor = (level: number) => [60, 80, 120, 160, 200, 100, 150, 200, 250, 300][lvl(level) - 1]!;

/** Steps the plain order (pairs as they come, no learning) needs, counted up to 2 × the level's budget. */
export function plainSteps(c: Claim, level: number): number {
  const cap = 2 * budgetFor(level);
  const run = prove(c, ZERO, cap);
  return run.proved ? run.steps : cap;
}

/** His allowance on a claim: a share of the steps the plain order needs — half at first, a third by Level 10. */
/**
 * A strong hand-made search order (the textbook one: use the conclusion's opposite, prefer single facts and
 * short results), knowing every kind of premise — the yardstick his allowance is set from.
 */
export const REF = [3, -1, 2, 5, 2, -1, -1, -0.5, -0.5, 1, ...new Array(12).fill(0.01)];
/** Steps the yardstick order needs on a claim. */
export const refSteps = (c: Claim, level: number) => {
  const run = prove(c, REF, 2 * budgetFor(level));
  return run.proved ? run.steps : 2 * budgetFor(level);
};
/**
 * His allowance on a claim: a little more than the yardstick order needs — less slack level by level —
 * and never more than half of what the plain order needs.
 */
export const allowance = (plain: number, level: number, ref = plain) => Math.max(2, Math.min(Math.floor(plain / 2), Math.ceil(ref * [1.5, 1.4, 1.35, 1.3, 1.25, 1.3, 1.25, 1.2, 1.15, 1.1][lvl(level) - 1]!)));

export interface Graded {
  c: Claim;
  /** His allowance of steps (see `allowance`). */
  limit: number;
}

function graded(level: number, from: number, size: number): Graded[] {
  const out: Graded[] = [];
  for (let seed = from; out.length < size; seed++) {
    const c = makeClaim(level, seed, true)!;
    const plain = plainSteps(c, level);
    if (plain >= (specFor(level).fo ? 10 : 6)) out.push({ c, limit: allowance(plain, level, refSteps(c, level)) });
  }
  return out;
}

export interface Bench {
  truths: Graded[];
  falses: Claim[];
  practice: Graded[];
}
/**
 * Each level's fixed claims: 20 held-out true ones (each with its allowance) and 8 false ones for the
 * test, never trained on, and 32 true practice ones he learns from (different seeds). Read from the stored
 * list (logicsets.ts) so the phone never waits on making them; `fresh` makes them again (the tests check
 * the two agree).
 */
export function bench(level: number, fresh = false): Bench {
  const L = lvl(level);
  let b = fresh ? undefined : benches.get(L);
  if (b) return b;
  const st = LOGIC_SETS[L - 1];
  const read = (x: string): Graded => {
    const k = x.lastIndexOf('|');
    return { c: claimOf(x.slice(0, k)), limit: Number(x.slice(k + 1)) };
  };
  if (!fresh && st) b = { truths: st.t.map(read), falses: st.f.map(claimOf), practice: st.p.map(read) };
  else {
    const falses: Claim[] = [];
    for (let s = 0; s < 8; s++) falses.push(makeClaim(L, 70500 + s, false)!);
    b = { truths: graded(L, 70000, 20), falses, practice: graded(L, 80000, 32) };
  }
  if (!fresh) benches.set(L, b);
  return b;
}
const benches = new Map<number, Bench>();
const practiceSet = (level: number) => bench(level).practice;

/** A prover: given a claim and an allowance, a proof (checkable steps) or nothing. */
export type Prover = (c: Claim, limit: number) => ProofStep[][] | null;

/**
 * Grade a prover on the held-out set: proofs that pass the step-by-step check count for true claims; a
 * false claim with a proof that passes the check — or any proof the truth table refutes — is a hard
 * failure (mastery 0). A proof that fails the check is not a proof.
 */
export function grade(level: number, prover: Prover): { proved: number; of: number; accepted: number; mastery: number } {
  const b = bench(level);
  let proved = 0;
  for (const { c, limit } of b.truths) {
    const p = prover(c, limit);
    if (p && p.reduce((t, x) => t + x.length, 0) <= limit && verifyProof(c, p)) proved++;
  }
  let accepted = 0;
  for (const c of b.falses) {
    const p = prover(c, budgetFor(level));
    // The truth table has the last word: "proved" and refuted is a hard failure, whatever the checker said.
    if (p && (verifyProof(c, p) || !valid(c))) accepted++;
  }
  return { proved, of: b.truths.length, accepted, mastery: accepted ? 0 : proved / b.truths.length };
}

// ---- words -----------------------------------------------------------------------------------------------

const LEGEND = '¬ means "not", ∧ "and", ∨ "or", → "if … then", ↔ "if and only if"';
const FO_LEGEND = '∀x means "for every individual x", ∃x "for at least one individual x"';

export function claimWords(c: Claim): string {
  const world = c.world.length ? `The world has exactly ${c.world.length} individuals: ${c.world.join(', ')} (no others).\n` : '';
  const prem = c.premises.map((p, i) => `${i + 1}. ${show(p)}`).join('\n');
  return `${world}Premises:\n${prem}\nConclusion: ${show(c.goal)}\n(${LEGEND}${c.world.length ? `; ${FO_LEGEND}` : ''}.)`;
}

export function clauseText(cl: Clause, at: Atoms): string {
  if (!cl.length) return '□ (a contradiction)';
  return cl.map((l) => `${l < 0 ? '¬' : ''}${at.names[Math.abs(l) - 1]}`).join(' ∨ ');
}

class LogicEnv implements Env {
  c: Claim = quickClaim(1, 1, true);
  clauses: Clause[] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    this.c = quickClaim(this.level, seed, seed % 2 === 0);
    this.clauses = clausesOf(this.c).list.map((x) => x.lits);
  }
  private pairs() {
    const out: [number, number][] = [];
    const have = new Set(this.clauses.map((x) => x.join(',')));
    for (let i = 0; i < this.clauses.length; i++)
      for (let j = i + 1; j < this.clauses.length; j++) {
        const r = resolve(this.clauses[i]!, this.clauses[j]!);
        if (r && !have.has(r.res.join(','))) out.push([i, j]);
      }
    return out;
  }
  /** Index into the pairs of clauses that give something new. */
  actions() {
    const n = this.pairs().length;
    return n ? Array.from({ length: n }, (_, i) => i) : [0];
  }
  step(a: number) {
    const p = this.pairs()[a];
    if (!p) return { reward: -1, done: true };
    const r = resolve(this.clauses[p[0]]!, this.clauses[p[1]]!)!;
    this.clauses.push(r.res);
    if (!r.res.length) return { reward: 10, done: true };
    return { reward: -0.1, done: this.clauses.length > 400 };
  }
  describe() {
    const { at } = clausesOf(this.c);
    return `Claim: ${claimText(this.c)}. Clauses so far: ${this.clauses.map((c) => `[${clauseText(c, at)}]`).join(' ')}.`;
  }
}

interface LogicSave {
  game: 'logic';
  level: number;
  w: number[];
  best: number;
  sigma: number;
  rand: number;
}

/** Which of his weights a level's claims bear on: the general ones, and the forms its premises may take. */
export function activeFeatures(level: number): boolean[] {
  const forms = new Set<string>(['goal', ...specFor(level).forms]);
  return Array.from({ length: FEATURES }, (_, i) => i < GENERAL || forms.has(FORMS[i - GENERAL]!));
}

class LogicLearner implements Learner {
  w: number[];
  rand: number;
  sigma: number;
  best: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<LogicSave>(saved, 'logic');
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts knowing nothing: every pair looks the same, so he combines them in the order they come.
    this.w = s?.w?.length === FEATURES ? s.w.slice() : ZERO.slice();
    // A new level: a fresh, wide search from what he knew (a narrow one could stay stuck where the last level left it).
    this.sigma = s?.level === level ? s.sigma : 1;
    this.best = s?.level === level ? s.best : this.practice(this.w);
  }
  /** Practice score with weights w: proved first, then fewer steps. */
  practice(w: number[]): number {
    let sc = 0;
    for (const { c, limit } of practiceSet(this.level)) {
      const run = prove(c, w, limit, true);
      sc += run.proved ? 100_000 - run.steps : -limit;
    }
    return sc;
  }
  train(n: number) {
    let done = 0;
    while (done < n) {
      // Only what this level's claims can show him is nudged: a form he has not met keeps no opinion.
      const on = activeFeatures(this.level);
      const cand = this.w.map((x, i) => (on[i] ? x + this.sigma * gauss(this.r) : x));
      const sc = this.practice(cand);
      done += practiceSet(this.level).length;
      if (sc >= this.best) {
        this.w = cand;
        this.best = sc;
        this.sigma = Math.min(3, this.sigma * 1.4);
      } else this.sigma = Math.max(0.05, this.sigma * 0.9);
    }
    this.rand = (this.rand + done * 2654435761) >>> 0;
    return done;
  }
  measure() {
    const g = grade(this.level, (c, limit) => {
      const t = prove(c, this.w, limit, true);
      return t.proved ? proofSteps(t) : null;
    });
    const kind = specFor(this.level).fo ? 'first-order claims over a small world' : 'propositional claims';
    return {
      mastery: g.mastery,
      detail: g.accepted
        ? `HARD FAILURE: he accepted ${g.accepted} false claim(s) — mastery 0.`
        : `${kind}: he proves ${g.proved} of ${g.of} true ones within his allowance of steps (each proof re-checked), and accepted none of ${bench(this.level).falses.length} false ones (truth table / SAT).`,
    };
  }
  save(): LogicSave {
    return { game: 'logic', level: this.level, w: this.w.slice(), best: this.best, sigma: this.sigma, rand: this.rand };
  }
  view(): Frame {
    const names = ['uses the conclusion’s opposite', 'premises only', 'one clause is a single fact', 'gives a contradiction', 'gives a single fact', 'result shorter than its parts', 'long result', 'deep in the proof', 'big parents', 'about the conclusion’s letters', ...FORMS.map((f) => `uses ${FORM_WORDS[f]}`)];
    const on = activeFeatures(this.level);
    const mx = Math.max(0.01, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]! >= 0 ? 'tries first' : 'tries later'] as [string, number, string]).filter((_, i) => on[i]), caption: 'Which pairs of clauses he combines first.' };
  }
  watch(seed: number): Frame[] {
    // A stored claim (no waiting on making one): a practice one he can prove, or now and then a false one.
    const b = bench(this.level);
    const c = seed % 3 !== 0 ? b.practice[seed % b.practice.length]!.c : b.falses[seed % b.falses.length]!;
    const head = [`Claim: ${claimText(c)}`];
    const t = prove(c, this.w, budgetFor(this.level), true);
    const frames: Frame[] = [{ lines: head, caption: 'To prove it, he assumes the conclusion is false and looks for a contradiction.' }];
    const done: string[] = [];
    t.runs.forEach((run, p) => {
      const part = t.parts.length > 1 ? `For ${c.world[p]}: ${show(t.parts[p]!.goal)}` : '';
      const start = run.clauses.length - run.trace.length;
      const base = run.clauses.slice(0, start).map((x, i) => `[${i + 1}] ${clauseText(x.lits, run.at)}${x.goal ? '  (the conclusion’s opposite)' : ''}`);
      const top = [...head, ...done, ...(part ? [part] : [])];
      frames.push({ lines: [...top, ...base.slice(0, 12), ...(base.length > 12 ? [`… and ${base.length - 12} more clauses`] : [])], caption: 'The premises and the opposite of the conclusion, as “or” clauses.' });
      const steps = run.proved ? proofOf(run) : run.trace.slice(0, 8);
      const idx = new Map<number, number>();
      const lines: string[] = [];
      steps.forEach((s, k) => {
        idx.set(start + run.trace.indexOf(s), start + k);
        const nm = (i: number) => `[${(idx.get(i) ?? i) + 1}]`;
        lines.push(`[${start + k + 1}] from ${nm(s.i)} and ${nm(s.j)} on ${run.at.names[s.pivot - 1]}: ${clauseText(s.res, run.at)}`);
        frames.push({ lines: [...top, ...lines.slice(-8)], caption: `Step ${k + 1}${run.proved ? ` of ${steps.length} in the proof` : ''}` });
      });
      if (part) done.push(`${part}${run.proved ? ' ✓' : ' ✗'}`);
    });
    if (t.proved) frames.push({ lines: [...head, ...done], caption: `Contradiction every time: the claim follows. ${t.steps} pairs tried; the proof re-checked step by step: ${verifyProof(c, proofSteps(t)) ? 'sound' : 'NOT sound'}.` });
    else {
      const cm = counterexample(c);
      const why = cm ? `It is false — a case where every premise holds and the conclusion fails: ${cm}.` : 'It is true — he ran out of steps.';
      frames.push({ lines: [...head, ...done], caption: `No contradiction within ${t.steps} steps: not proved. ${why}` });
    }
    return frames;
  }
}

/** A case (the facts that are true; all others false) making every premise true and the conclusion false, or null when it follows. */
export function counterexample(c: Claim): string | null {
  const { at, list } = clausesOf(c);
  const m = sat(
    list.map((x) => x.lits),
    at.names.length,
  );
  if (!m) return null;
  const yes = at.names.filter((_, i) => m[i] === 1 && at.names[i] !== '');
  return yes.length ? `${yes.join(', ')} true, everything else false` : 'everything false';
}

export function gauss(r: () => number): number {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ---- problems ---------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const want = rng(seed * 13 + level)() < 0.5;
  const c = quickClaim(level, seed, want);
  const text = `Decide whether the conclusion follows from the premises: it is VALID if, in every case where all the premises are true, the conclusion is true too; otherwise it is INVALID.\n${claimWords(c)}\nAnswer VALID or INVALID.`;
  return { game: 'logic', level: lvl(level), seed, text, data: { claim: c, valid: valid(c) } };
}

/** VALID / INVALID from a reply's last line ("does not follow", "not valid" and "invalid" are INVALID). */
export function readValid(answer: string): boolean | null {
  const v = oneVerdict(
    finalLine(answer),
    [
      [/\binvalid\b/, 'I'],
      [/\bdoes ?n[o']t follow\b|\bdoesn't follow\b/, 'I'],
      [/\bvalid\b/, 'V'],
      [/\bfollows\b/, 'V'],
    ],
    { V: 'I', I: 'V' },
  );
  return v == null ? null : v === 'V';
}

function check(prob: Problem, answer: string): Verdict {
  const d = prob.data as { claim: Claim; valid: boolean };
  const said = readValid(answer);
  if (said == null) return { correct: false, score: 0, why: 'No VALID or INVALID found.' };
  return said === d.valid ? { correct: true, score: 1, why: `${d.valid ? 'VALID' : 'INVALID'} — right.` } : { correct: false, score: 0, why: `It is ${d.valid ? 'VALID' : 'INVALID'}.` };
}

export const logic: Game = {
  ...LOGIC,
  env: (level) => new LogicEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new LogicLearner(level, seed, saved),
};
