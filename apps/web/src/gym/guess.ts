/**
 * What CODE BREAKER and WORD GUESS share: a hidden answer among `n` possibilities, a guess answered by
 * feedback, and a guessing policy. The feedback for every (guess, secret) pair is worked out once into a
 * table, so a whole game tree (every possible secret) can be played in milliseconds.
 *
 * His policy scores each possible guess by a few facts about how it splits the answers still possible
 * (the biggest group left, the average group, the information it gives, whether it could itself be
 * the answer) with weights he learns by evolution: try a nudged set of weights on every secret, keep
 * it when he needs fewer guesses on average. The yardsticks (Knuth's minimax for Mastermind, the
 * information-gain guesser for words) are fixed rules computed exactly the same way.
 */
import { rng } from './core';

export interface Space {
  n: number;
  /** fb[g * n + s] = the feedback guess g gets when the secret is s. */
  fb: Uint8Array;
  /** How many feedback values there can be. */
  nf: number;
  /** The feedback that means "all right". */
  win: number;
}

export type Chooser = (s: Space, cand: number[], depth: number) => number;

export const FEATURES = 5;

/** How guess g splits the candidates: [biggest group, average group, information left, not a candidate, groups] — smaller is better. */
export function features(s: Space, g: number, cand: number[], counts: Uint16Array): number[] {
  counts.fill(0);
  const base = g * s.n;
  let inS = 0;
  for (const c of cand) {
    counts[s.fb[base + c]!]!++;
    if (c === g) inS = 1;
  }
  const N = cand.length;
  let max = 0;
  let sq = 0;
  let ent = 0;
  let parts = 0;
  for (let f = 0; f < s.nf; f++) {
    const k = counts[f]!;
    if (!k) continue;
    parts++;
    if (k > max) max = k;
    sq += k * k;
    ent -= (k / N) * Math.log2(k / N);
  }
  const lg = Math.log2(N) || 1;
  return [max / N, sq / (N * N), 1 - ent / lg, 1 - inS, 1 - parts / N];
}

/** A guess that tells nothing (every candidate gives the same, non-winning feedback) is never worth making. */
function useless(s: Space, g: number, cand: number[]): boolean {
  const f0 = s.fb[g * s.n + cand[0]!]!;
  if (f0 === s.win) return false;
  for (const c of cand) if (s.fb[g * s.n + c] !== f0) return false;
  return true;
}

/** The learned policy: the guess with the lowest weighted score (lowest number on ties). */
export function weighted(w: ArrayLike<number>): Chooser {
  return (s, cand, depth) => {
    if (cand.length <= 1 || depth >= 10) return cand[0]!;
    const counts = new Uint16Array(s.nf);
    let best = -1;
    let bestScore = Infinity;
    for (let g = 0; g < s.n; g++) {
      const f = features(s, g, cand, counts);
      let sc = 0;
      for (let i = 0; i < FEATURES; i++) sc += w[i]! * f[i]!;
      if (sc < bestScore - 1e-12 && !useless(s, g, cand)) (best = g), (bestScore = sc);
    }
    return best < 0 ? cand[0]! : best;
  };
}

/** Knuth's minimax rule: the smallest worst case; a possible answer first on ties; then the lowest number. */
export const minimax: Chooser = (s, cand) => {
  if (cand.length <= 1) return cand[0]!;
  const counts = new Uint16Array(s.nf);
  let best = 0;
  let key = Infinity;
  for (let g = 0; g < s.n; g++) {
    const f = features(s, g, cand, counts);
    const k = f[0]! * cand.length * 2 + f[3]!;
    if (k < key) (key = k), (best = g);
  }
  return best;
};

/** The information-gain rule: the most expected information; a possible answer first on ties; then the lowest number. */
export const infoGain: Chooser = (s, cand) => {
  if (cand.length <= 1) return cand[0]!;
  const counts = new Uint16Array(s.nf);
  let best = 0;
  let key = Infinity;
  for (let g = 0; g < s.n; g++) {
    const f = features(s, g, cand, counts);
    const k = f[2]! + f[3]! * 1e-9;
    if (k < key - 1e-12) (key = k), (best = g);
  }
  return best;
};

/** Split candidates by the feedback guess g gets. */
export function split(s: Space, g: number, cand: number[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const c of cand) {
    const f = s.fb[g * s.n + c]!;
    const l = m.get(f);
    if (l) l.push(c);
    else m.set(f, [c]);
  }
  return m;
}

/** Play every possible secret with `choose` (one game tree): total guesses and the worst game. */
export function playAll(s: Space, choose: Chooser): { total: number; worst: number } {
  let total = 0;
  let worst = 0;
  const rec = (cand: number[], depth: number) => {
    const g = choose(s, cand, depth);
    for (const [f, part] of split(s, g, cand)) {
      if (f === s.win) {
        total += depth;
        worst = Math.max(worst, depth);
      } else if (depth >= 14) {
        // A policy that can't finish counts each unfinished game as 15 guesses.
        total += 15 * part.length;
        worst = 15;
      } else rec(part, depth + 1);
    }
  };
  rec([...Array(s.n).keys()], 1);
  return { total, worst };
}

/** One game against one secret: the guesses made, in order. */
export function playOne(s: Space, choose: Chooser, secret: number): number[] {
  let cand = [...Array(s.n).keys()];
  const out: number[] = [];
  for (let depth = 1; depth <= 15; depth++) {
    const g = choose(s, cand, depth);
    out.push(g);
    const f = s.fb[g * s.n + secret]!;
    if (f === s.win) break;
    cand = cand.filter((c) => s.fb[g * s.n + c] === f);
  }
  return out;
}

export interface GuessSave {
  w: number[];
  sigma: number;
  avg: number;
  games: number;
  rand: number;
}

/** His guessing policy and how it learns: a (1+1) evolution strategy on the weights, judged on every secret. */
export class GuessPolicy {
  w: number[];
  sigma: number;
  avg: number;
  games: number;
  r: () => number;
  rand: number;
  constructor(
    private s: Space,
    seed: number,
    saved?: GuessSave | null,
  ) {
    this.rand = saved?.rand ?? seed;
    this.r = rng(this.rand);
    // He starts with weights picked at random: some of them reward bad guesses.
    this.w = saved?.w?.length === FEATURES ? saved.w.slice() : Array.from({ length: FEATURES }, () => this.r() * 2 - 1);
    this.sigma = saved?.sigma ?? 0.6;
    this.games = saved?.games ?? 0;
    this.avg = saved?.avg ?? this.score(this.w);
  }
  score(w: number[]): number {
    return playAll(this.s, weighted(w)).total / this.s.n;
  }
  /** Generations until about `n` games have been played (each generation plays every secret once). */
  train(n: number): number {
    let played = 0;
    while (played < n) {
      const g = () => {
        // Box-Muller: a normal nudge.
        const u = Math.max(1e-9, this.r());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.r());
      };
      const cand = this.w.map((x) => x + this.sigma * g());
      const a = this.score(cand);
      played += this.s.n;
      if (a <= this.avg) {
        this.w = cand;
        this.avg = a;
        this.sigma = Math.min(2, this.sigma * 1.5);
      } else this.sigma = Math.max(0.02, this.sigma * 0.85);
    }
    this.games += played;
    this.rand = (this.rand + played * 2654435761) >>> 0;
    return played;
  }
  save(): GuessSave {
    return { w: this.w.slice(), sigma: this.sigma, avg: this.avg, games: this.games, rand: this.rand };
  }
}
