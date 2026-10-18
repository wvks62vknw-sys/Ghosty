/**
 * TRUST TOURNAMENT: the iterated prisoner's dilemma. Each round both players cooperate (C) or defect (D):
 * both C → 3 each, both D → 1 each, D against C → 5 for the defector and 0 for the other. A strategy is a
 * genome: what to do first, and what to do after each possible last round (memory-1), or after each
 * possible last two rounds (memory-2, from Level 6). A population of genomes evolves: every generation all
 * of them play each other and a fixed panel of classic strategies, the best half survive, and mutated copies
 * replace the rest. Moves go wrong by mistake with a small chance (noise, growing with the level).
 * The population starts as a world of defectors (everyone ALWAYS DEFECT). Matches are scored exactly
 * (expected payoffs over the noise, no dice). Evolution sees only the population and a TRAINING panel; the
 * test is a different, held-out panel of classics he never plays while evolving. Ground truth: all 32
 * memory-1 strategies tried against that test panel; mastery = where his champion's score sits between
 * ALWAYS DEFECT's (0%, where he starts) and the best memory-1 strategy's (100%).
 */
import { type Cell, finalLine, lastInt, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { TRUST } from './meta';

/** Payoff to me for (my move, their move); 0 = C, 1 = D. */
export const PAY = [
  [3, 0],
  [5, 1],
];

/** A strategy: chance of cooperating first, after one round (index my*2+their), and after two (index my1*8+their1*4+my2*2+their2). */
export interface Strategy {
  first: number;
  second: number[];
  table: number[];
}

/** A memory-1 strategy from its first move and its reply to CC, CD, DC, DD (my move, their move). */
export function mem1(first: number, after: number[]): Strategy {
  const table: number[] = [];
  for (let i = 0; i < 16; i++) table.push(after[i & 3]!);
  return { first, second: after.slice(), table };
}

export const CLASSIC: Record<string, Strategy> = {
  'ALWAYS COOPERATE': mem1(1, [1, 1, 1, 1]),
  'ALWAYS DEFECT': mem1(0, [0, 0, 0, 0]),
  'TIT FOR TAT': mem1(1, [1, 0, 1, 0]),
  'SUSPICIOUS TIT FOR TAT': mem1(0, [1, 0, 1, 0]),
  GRUDGER: mem1(1, [1, 0, 0, 0]),
  'WIN-STAY LOSE-SHIFT': mem1(1, [1, 0, 0, 1]),
  ALTERNATOR: mem1(1, [0, 0, 1, 1]),
  RANDOM: mem1(0.5, [0.5, 0.5, 0.5, 0.5]),
  // Memory-2: defects only after two defections in a row.
  'TIT FOR TWO TATS': { first: 1, second: [1, 1, 1, 1], table: Array.from({ length: 16 }, (_, i) => ((i >> 2) & 1 && i & 1 ? 0 : 1)) },
};

/** The held-out test panel (mastery) and the training panel evolution plays — no strategy is in both. */
export const PANEL = ['GRUDGER', 'WIN-STAY LOSE-SHIFT', 'SUSPICIOUS TIT FOR TAT', 'ALTERNATOR', 'TIT FOR TWO TATS'];
export const TRAIN_PANEL = ['ALWAYS COOPERATE', 'ALWAYS DEFECT', 'TIT FOR TAT', 'RANDOM'];

export const DESCRIBE: Record<string, string> = {
  'ALWAYS COOPERATE': 'always cooperates',
  'ALWAYS DEFECT': 'always defects',
  'TIT FOR TAT': 'cooperates first, then copies what the other player did last round',
  'SUSPICIOUS TIT FOR TAT': 'defects first, then copies what the other player did last round',
  GRUDGER: 'cooperates until the other player defects once, then defects for ever',
  'WIN-STAY LOSE-SHIFT': 'cooperates first; repeats its last move after getting 3 or 5, switches after getting 0 or 1',
  ALTERNATOR: 'cooperates first, then does the opposite of its own last move',
  'TIT FOR TWO TATS': 'cooperates unless the other player defected in both of the last two rounds',
};

export interface Rules {
  rounds: number;
  noise: number;
  memory: 1 | 2;
}
export const rules = (level: number): Rules => {
  const L = lvl(level);
  return { rounds: 50, noise: [0, 0, 0.005, 0.01, 0.015, 0, 0.005, 0.01, 0.015, 0.02][L - 1]!, memory: L >= 6 ? 2 : 1 };
};

const noisy = (p: number, e: number) => p * (1 - e) + (1 - p) * e;

/**
 * Exact expected total payoffs of a match (A's, B's) over `rounds`, with each move flipped by mistake with
 * chance `noise`: a probability for each of the 16 possible last-two-rounds histories, round by round.
 */
export function match(A: Strategy, B: Strategy, rounds: number, noise: number): [number, number] {
  // Round 1.
  const a1 = noisy(A.first, noise);
  const b1 = noisy(B.first, noise);
  let sa = 0;
  let sb = 0;
  // dist over (myA, myB) of the last round: index a*2+b with 0 = C.
  const one = [a1 * b1, a1 * (1 - b1), (1 - a1) * b1, (1 - a1) * (1 - b1)];
  for (let i = 0; i < 4; i++) {
    const a = i >> 1;
    const b = i & 1;
    sa += one[i]! * PAY[a]![b]!;
    sb += one[i]! * PAY[b]![a]!;
  }
  if (rounds === 1) return [sa, sb];
  // Round 2: from one round of history; then keep the last two rounds (16 states: a1 b1 a2 b2).
  let two = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    const a = i >> 1;
    const b = i & 1;
    const pa = noisy(A.second[a * 2 + b]!, noise);
    const pb = noisy(B.second[b * 2 + a]!, noise);
    for (let j = 0; j < 4; j++) {
      const a2 = j >> 1;
      const b2 = j & 1;
      const pr = one[i]! * (a2 ? 1 - pa : pa) * (b2 ? 1 - pb : pb);
      two[i * 4 + j] += pr;
      sa += pr * PAY[a2]![b2]!;
      sb += pr * PAY[b2]![a2]!;
    }
  }
  for (let r = 3; r <= rounds; r++) {
    const next = new Array(16).fill(0);
    for (let s = 0; s < 16; s++) {
      const pr0 = two[s]!;
      if (!pr0) continue;
      const a1_ = (s >> 3) & 1;
      const b1_ = (s >> 2) & 1;
      const a2 = (s >> 1) & 1;
      const b2 = s & 1;
      const pa = noisy(A.table[a1_ * 8 + b1_ * 4 + a2 * 2 + b2]!, noise);
      const pb = noisy(B.table[b1_ * 8 + a1_ * 4 + b2 * 2 + a2]!, noise);
      for (let j = 0; j < 4; j++) {
        const a3 = j >> 1;
        const b3 = j & 1;
        const pr = pr0 * (a3 ? 1 - pa : pa) * (b3 ? 1 - pb : pb);
        next[a2 * 8 + b2 * 4 + a3 * 2 + b3] += pr;
        sa += pr * PAY[a3]![b3]!;
        sb += pr * PAY[b3]![a3]!;
      }
    }
    two = next;
  }
  return [sa, sb];
}

/** Average points per round against the panel. */
export function panelScore(s: Strategy, R: Rules): number {
  let t = 0;
  for (const nm of PANEL) t += match(s, CLASSIC[nm]!, R.rounds, R.noise)[0];
  return t / PANEL.length / R.rounds;
}

/** All 32 deterministic memory-1 strategies. */
export function allMem1(): Strategy[] {
  const out: Strategy[] = [];
  for (let k = 0; k < 32; k++) out.push(mem1(k >> 4, [(k >> 3) & 1, (k >> 2) & 1, (k >> 1) & 1, k & 1]));
  return out;
}

const bestCache = new Map<number, { score: number; name: string; worst: number; defect: number }>();
/** Ground truth: the best (and worst) test-panel score of any memory-1 strategy (exhaustive), and ALWAYS DEFECT's. */
export function bestMem1(level: number): { score: number; name: string; worst: number; defect: number } {
  const L = lvl(level);
  const hit = bestCache.get(L);
  if (hit) return hit;
  const R = rules(L);
  let best = { score: -1, name: '', worst: Infinity, defect: panelScore(CLASSIC['ALWAYS DEFECT']!, R) };
  for (const s of allMem1()) {
    const sc = panelScore(s, R);
    if (sc > best.score) best = { ...best, score: sc, name: nameOf(s) };
    best.worst = Math.min(best.worst, sc);
  }
  bestCache.set(L, best);
  return best;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A recognisable name for a genome, or its code (first move, then replies to CC CD DC DD). */
export function nameOf(s: Strategy): string {
  for (const [nm, c] of Object.entries(CLASSIC)) if (c.first === s.first && same(c.second, s.second) && same(c.table, s.table)) return nm;
  const m1 = s.table.every((x, i) => x === s.table[i & 3]) && same(s.second, s.table.slice(0, 4));
  const bit = (x: number) => (x >= 0.5 ? 'C' : 'D');
  if (m1) return `${bit(s.first)}·${s.second.map(bit).join('')}`;
  // Memory-2 that acts like Tit for Tat whenever the last round is all it looks at.
  return `M2 ${bit(s.first)}·${s.table.map(bit).join('')}`;
}

/** Tit-for-Tat-like: nice (starts with C), retaliates after being exploited, forgives when they cooperate again. */
export function tftLike(s: Strategy): boolean {
  if (s.first < 0.5 || s.second[0]! < 0.5 || s.second[1]! >= 0.5) return false;
  // After CC CC it keeps cooperating; after (C,D) it defects.
  return s.table[0]! >= 0.5 && s.table[1]! < 0.5;
}

class TrustEnv implements Env {
  history: [number, number][] = [];
  opp: Strategy = CLASSIC['TIT FOR TAT']!;
  oppName = 'TIT FOR TAT';
  r = rng(1);
  constructor(private level: number) {}
  reset(seed: number) {
    this.r = rng(seed);
    this.oppName = PANEL[Math.floor(this.r() * PANEL.length)]!;
    this.opp = CLASSIC[this.oppName]!;
    this.history = [];
  }
  actions() {
    return [0, 1];
  }
  /** 0 = cooperate, 1 = defect. The other player is one of the panel (noise applies to both). */
  step(a: number) {
    const R = rules(this.level);
    const h = this.history;
    const n = h.length;
    const p = n === 0 ? this.opp.first : n === 1 ? this.opp.second[h[0]![1] * 2 + h[0]![0]]! : this.opp.table[h[n - 2]![1] * 8 + h[n - 2]![0] * 4 + h[n - 1]![1] * 2 + h[n - 1]![0]]!;
    const flip = (x: number) => (this.r() < R.noise ? 1 - x : x);
    const mine = flip(a);
    const theirs = flip(this.r() < p ? 0 : 1);
    h.push([mine, theirs]);
    return { reward: PAY[mine]![theirs]!, done: h.length >= R.rounds };
  }
  describe() {
    const R = rules(this.level);
    const h = this.history.map(([a, b]) => `${'CD'[a]}${'CD'[b]}`).join(' ');
    return `Prisoner's dilemma, round ${this.history.length + 1} of ${R.rounds} (you, them): ${h || 'no rounds yet'}. Both C → 3 each; both D → 1 each; D against C → 5 and 0.`;
  }
}

interface TrustSave {
  game: 'trust';
  level: number;
  pop: Strategy[];
  gen: number;
  rand: number;
  rise: { gen: number; top: string; share: number }[];
}

const POP = 24;

class TrustLearner implements Learner {
  R: Rules;
  pop: Strategy[];
  fit: number[] = [];
  gen: number;
  rand: number;
  r: () => number;
  rise: { gen: number; top: string; share: number }[];
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    this.R = rules(level);
    const s = savedFor<TrustSave>(saved, 'trust', level);
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
    // A world without trust: everyone starts as ALWAYS DEFECT.
    this.pop = s?.pop?.length === POP ? s.pop : Array.from({ length: POP }, () => this.defector());
    this.gen = s?.gen ?? 0;
    this.rise = s?.rise ?? [];
    this.score();
  }
  defector(): Strategy {
    const s = mem1(0, [0, 0, 0, 0]);
    return s;
  }
  randomGenome(): Strategy {
    const b = () => (this.r() < 0.5 ? 1 : 0);
    const s = mem1(b(), [b(), b(), b(), b()]);
    if (this.R.memory === 2) s.table = s.table.map(() => b());
    return s;
  }
  mutate(s: Strategy): Strategy {
    const c: Strategy = { first: s.first, second: s.second.slice(), table: s.table.slice() };
    const genes = this.R.memory === 2 ? 21 : 5;
    const k = Math.floor(this.r() * genes);
    if (k === 0) c.first = 1 - c.first;
    else if (this.R.memory === 1) {
      const i = k - 1;
      c.second[i] = 1 - c.second[i]!;
      for (let j = 0; j < 16; j++) if ((j & 3) === i) c.table[j] = c.second[i]!;
    } else if (k <= 4) c.second[k - 1] = 1 - c.second[k - 1]!;
    else c.table[k - 5] = 1 - c.table[k - 5]!;
    return c;
  }
  /** Everyone plays everyone (and the training panel — never the test panel): average points per round. */
  score() {
    const { R } = this;
    const n = this.pop.length;
    const tot = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const [a, b] = match(this.pop[i]!, this.pop[j]!, R.rounds, R.noise);
        tot[i] += a;
        tot[j] += b;
      }
      for (const nm of TRAIN_PANEL) tot[i] += match(this.pop[i]!, CLASSIC[nm]!, R.rounds, R.noise)[0];
    }
    this.fit = tot.map((t) => t / (n - 1 + TRAIN_PANEL.length) / R.rounds);
  }
  champion(): Strategy {
    let b = 0;
    for (let i = 1; i < this.pop.length; i++) if (this.fit[i]! > this.fit[b]!) b = i;
    return this.pop[b]!;
  }
  shares(): [string, number][] {
    const m = new Map<string, number>();
    for (const s of this.pop) m.set(nameOf(s), (m.get(nameOf(s)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / this.pop.length]);
  }
  train(n: number) {
    for (let g = 0; g < n; g++) {
      const order = [...this.pop.keys()].sort((a, b) => this.fit[b]! - this.fit[a]! || a - b);
      const keep = order.slice(0, POP / 2).map((i) => this.pop[i]!);
      const kids = keep.map((s) => (this.r() < 0.8 ? this.mutate(s) : this.randomGenome()));
      this.pop = [...keep, ...kids];
      this.score();
      this.gen++;
      const [top, share] = this.shares()[0]!;
      const last = this.rise[this.rise.length - 1];
      if (!last || last.top !== top) this.rise.push({ gen: this.gen, top, share });
      if (this.rise.length > 30) this.rise.shift();
    }
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const c = this.champion();
    const his = panelScore(c, this.R);
    const best = bestMem1(this.level);
    const nm = nameOf(c);
    return {
      mastery: Math.max(0, Math.min(1, (his - best.defect) / (best.score - best.defect))),
      detail: `His champion (${nm}${tftLike(c) ? ', Tit-for-Tat-like' : ''}) scores ${his.toFixed(2)} a round against the held-out panel of classics; the best memory-1 strategy (${best.name}, found by trying all 32) scores ${best.score.toFixed(2)}, ALWAYS DEFECT ${best.defect.toFixed(2)} (0%).`,
    };
  }
  save(): TrustSave {
    return { game: 'trust', level: this.level, pop: this.pop, gen: this.gen, rand: this.rand, rise: this.rise };
  }
  view(): Frame {
    const bars = this.shares()
      .slice(0, 6)
      .map(([k, v]) => [k, v, `${Math.round(v * 100)}%`] as [string, number, string]);
    const lines = this.rise.slice(-4).map((x) => `Generation ${x.gen}: ${x.top} leads (${Math.round(x.share * 100)}%).`);
    return { bars, lines, caption: `Generation ${this.gen}: who is winning the population (${this.R.memory === 2 ? 'two rounds of memory' : 'one round of memory'}, ${Math.round(this.R.noise * 100)}% mistakes).` };
  }
  watch(seed: number): Frame[] {
    const r = rng(seed);
    const oppName = PANEL[Math.floor(r() * PANEL.length)]!;
    const A = this.champion();
    const B = CLASSIC[oppName]!;
    const rounds = 16;
    const h: [number, number][] = [];
    const frames: Frame[] = [];
    let sa = 0;
    let sb = 0;
    const act = (S: Strategy, me: number) => {
      const n = h.length;
      const o = 1 - me;
      const p = n === 0 ? S.first : n === 1 ? S.second[h[0]![me]! * 2 + h[0]![o]!]! : S.table[h[n - 2]![me]! * 8 + h[n - 2]![o]! * 4 + h[n - 1]![me]! * 2 + h[n - 1]![o]!]!;
      const m = r() < p ? 0 : 1;
      return r() < this.R.noise ? 1 - m : m;
    };
    for (let i = 0; i < rounds; i++) {
      const a = act(A, 0);
      const b = act(B, 1);
      h.push([a, b]);
      sa += PAY[a]![b]!;
      sb += PAY[b]![a]!;
      const cells: Cell[] = [];
      for (const who of [0, 1]) for (let j = 0; j < rounds; j++) cells.push(j < h.length ? { t: 'CD'[h[j]![who]!], c: h[j]![who] ? 'miss' : 'hit' } : {});
      frames.push({ grid: { w: rounds, h: 2, cells }, caption: `Top: his champion (${nameOf(A)}) ${sa} · bottom: ${oppName} ${sb}` });
    }
    return frames;
  }
}

const QUIZ = ['TIT FOR TAT', 'ALWAYS DEFECT', 'ALWAYS COOPERATE', 'GRUDGER', 'ALTERNATOR', 'SUSPICIOUS TIT FOR TAT', 'WIN-STAY LOSE-SHIFT', 'TIT FOR TWO TATS'];

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed);
  const pool = QUIZ.slice(0, Math.min(QUIZ.length, 3 + Math.ceil(L / 2)));
  const a = pool[Math.floor(r() * pool.length)]!;
  const b = pool[Math.floor(r() * pool.length)]!;
  const rounds = 2 + L;
  const [sa] = match(CLASSIC[a]!, CLASSIC[b]!, rounds, 0);
  const text = `Prisoner's dilemma, ${rounds} rounds, no mistakes. Both cooperate → 3 points each; both defect → 1 each; a defector against a cooperator gets 5 and the cooperator 0. Player A ${DESCRIBE[a]}. Player B ${DESCRIBE[b]}. How many points does A score in total?`;
  return { game: 'trust', level: L, seed, text, data: { a, b, rounds, answer: Math.round(sa) } };
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { answer: number };
  const got = lastInt(finalLine(answer));
  const ok = got === d.answer;
  return { correct: ok, score: ok ? 1 : Number.isFinite(got) ? Math.max(0, 1 - Math.abs(got - d.answer) / Math.max(1, d.answer)) : 0, why: ok ? 'Right.' : `A scores ${d.answer}.` };
}

export const trust: Game = {
  ...TRUST,
  env: (level) => new TrustEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new TrustLearner(level, seed, saved),
};
