/**
 * What the four board games share: the shape of a game (rules, a hand-written value, how to read a tap), the search Ghosty
 * plays with (Monte-Carlo tree search, on this phone, in a Worker so the board never freezes), and the dial of his thinking
 * time: level 1 thinks for 0.2 s, level 20 for 8 s, and above level 20 the time keeps growing and the search keeps deepening
 * (there is no top level). The search is open-loop, so a dice roll in the middle of a game is rolled afresh each time the
 * search goes through it (backgammon), and the dice of the real game are rolled fairly and shown.
 *
 * LEARNING IS NOT HERE. A value network trained by the GYM on its free GPU would be read through `weights` (a vector the
 * same length as the game's hand-written one, kept under `ghosty.arcade.board.weights.<id>`); there is none by default, so
 * until it is trained and put there Ghosty is search alone, and every card says so. Nothing learns on the phone.
 */
import type { BoardId } from '../shelf5';

export type Side = 1 | 2;
export const other = (s: Side): Side => (s === 1 ? 2 : 1);
/** 0 still playing, 1 or 2 the side that won, 3 a draw. */
export type Result = 0 | 1 | 2 | 3;

export interface BoardGame<S, M> {
  id: BoardId;
  name: string;
  /** A game's first position (a seed rolls any opening dice). */
  start(seed: number): S;
  /** Who moves now. */
  side(s: S): Side;
  /** Every legal move now (a move is plain data: it crosses to the Worker). Never empty while the game is on (a pass is a move). */
  legal(s: S): M[];
  /** The state after a move; never changes `s`. `rnd` rolls what chance decides (backgammon's dice). */
  apply(s: S, m: M, rnd: () => number): S;
  result(s: S): Result;
  /** What the hand-written value looks at, from `side`'s side, each roughly in -1…1. */
  features(s: S, side: Side): number[];
  /** The weights the hand-written value gives them (a trained set of the same length may replace them). */
  hand: readonly number[];
  key(m: M): string;
  /** A tap's reading: the cell a move starts on (or -1: it is a single tap) and the cell it ends on. */
  from(m: M): number;
  to(m: M): number;
  /** Whether a position's last move was a capture or a flip or a hit (the sound and the haptic). */
  words?: { first: string; second: string };
}

export const dot = (a: readonly number[], b: readonly number[]): number => {
  let t = 0;
  for (let i = 0; i < a.length; i++) t += a[i]! * (b[i] ?? 0);
  return t;
};
/** The value of a position for `side`: -1 (lost) … 1 (won), from the hand-written weights or a trained set of the same length. */
export function valueOf<S, M>(g: BoardGame<S, M>, s: S, side: Side, weights?: readonly number[] | null): number {
  const w = weights && weights.length === g.hand.length ? weights : g.hand;
  return Math.tanh(dot(w, g.features(s, side)));
}

/** A seeded generator (the same numbers for the same seed). */
export function rngOf(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** The generator the real game rolls its dice with at move number `ply` of a game with this seed (so a saved game replays exactly). */
export const rngAt = (seed: number, ply: number): (() => number) => rngOf(Math.imul(seed >>> 0 || 1, 2654435761) ^ Math.imul(ply + 1, 40503));

// ---------------------------------------------------------------- the dial

/** How long Ghosty thinks, in milliseconds, at a level: 0.2 s at level 1, 8 s at level 20, then ever longer. */
export const thinkMs = (level: number): number => {
  const l = Math.max(1, Math.floor(level));
  return Math.round(l <= 20 ? 200 * Math.pow(40, (l - 1) / 19) : 8000 * (1 + (l - 20) * 0.1));
};
/** How many plies a playout runs before the hand-written value takes over; deeper with the level, no ceiling. */
export const depthOf = (level: number): number => 4 + Math.max(1, Math.floor(level)) * 2;
/** How often a playout picks the move the hand-written value likes best rather than a random one (it rises toward 0.9). */
export const greedOf = (level: number): number => 0.9 - 0.7 / (1 + (Math.max(1, level) - 1) / 4);
/** His thinking in words: "0.2 s", "3.4 s". */
export const secondsWords = (ms: number): string => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;

// ---------------------------------------------------------------- the search

interface Node<M> {
  m: M | null;
  key: string;
  mover: Side;
  n: number;
  w: number;
  kids: Map<string, Node<M>>;
}

export interface SearchOpts {
  seed: number;
  level: number;
  weights?: readonly number[] | null;
  /** The game has no chance and no turn of several moves: a move that lets the other side win at once is never chosen if another is not. */
  tactical?: boolean;
  c?: number;
}
export interface Pick<M> {
  move: M | null;
  /** Visits at the root, and the best move's share of the win value (0…1): how sure he is. */
  iters: number;
  value: number;
  /** Moves tried, most visited first, with their visits. */
  ranked: { move: M; n: number; value: number }[];
}

export class Search<S, M> {
  private root: Node<M>;
  private rnd: () => number;
  iters = 0;
  private forced: M | null = null;
  private avoid = new Set<string>();
  private rootSide: Side;
  private depth: number;
  private greed: number;
  constructor(private g: BoardGame<S, M>, private state: S, private o: SearchOpts) {
    this.rnd = rngOf(o.seed);
    this.rootSide = g.side(state);
    this.root = { m: null, key: '', mover: other(this.rootSide), n: 0, w: 0, kids: new Map() };
    this.depth = depthOf(o.level);
    this.greed = greedOf(o.level);
    const moves = g.legal(state);
    // a win at once is taken; a move that hands the other side one is set aside (where the game allows the check)
    for (const m of moves) {
      const s2 = g.apply(state, m, this.rnd);
      const r = g.result(s2);
      if (r === this.rootSide) {
        this.forced ??= m;
      } else if (o.tactical && r === 0 && g.side(s2) !== this.rootSide) {
        for (const m2 of g.legal(s2)) if (g.result(g.apply(s2, m2, this.rnd)) === other(this.rootSide)) (this.avoid.add(g.key(m)), void 0);
      }
    }
    if (this.avoid.size === moves.length) this.avoid.clear();
  }
  private v(s: S, side: Side): number {
    return valueOf(this.g, s, side, this.o.weights);
  }
  private playout(s: S): number {
    const g = this.g;
    for (let d = 0; d < this.depth; d++) {
      const r = g.result(s);
      if (r) return r === 3 ? 0.5 : r === this.rootSide ? 1 : 0;
      const moves = g.legal(s);
      if (!moves.length) break;
      let pick: M;
      if (this.rnd() < this.greed && moves.length > 1) {
        const me = g.side(s);
        let bestV = -2;
        pick = moves[0]!;
        const tries = Math.min(moves.length, 5);
        for (let i = 0; i < tries; i++) {
          const m = moves[Math.floor(this.rnd() * moves.length)]!;
          const s2 = g.apply(s, m, this.rnd);
          const r2 = g.result(s2);
          const val = r2 ? (r2 === me ? 2 : r2 === 3 ? 0 : -1.5) : this.v(s2, me) * (g.side(s2) === me ? 1 : 1);
          if (val > bestV) ((bestV = val), (pick = m));
        }
      } else pick = moves[Math.floor(this.rnd() * moves.length)]!;
      s = g.apply(s, pick, this.rnd);
    }
    const r = g.result(s);
    if (r) return r === 3 ? 0.5 : r === this.rootSide ? 1 : 0;
    return (this.v(s, this.rootSide) + 1) / 2;
  }
  private once(): void {
    const g = this.g;
    let s = this.state;
    let node = this.root;
    const path: Node<M>[] = [];
    let val: number;
    const c = this.o.c ?? 0.9;
    for (;;) {
      const r = g.result(s);
      if (r) {
        val = r === 3 ? 0.5 : r === this.rootSide ? 1 : 0;
        break;
      }
      const moves = g.legal(s);
      if (!moves.length) {
        val = 0.5;
        break;
      }
      const me = g.side(s);
      const untried = moves.filter((m) => !node.kids.has(g.key(m)));
      if (untried.length) {
        const m = untried[Math.floor(this.rnd() * untried.length)]!;
        const child: Node<M> = { m, key: g.key(m), mover: me, n: 0, w: 0, kids: new Map() };
        node.kids.set(child.key, child);
        path.push(child);
        s = g.apply(s, m, this.rnd);
        val = this.playout(s);
        break;
      }
      let best: Node<M> | null = null;
      let bestScore = -Infinity;
      const lnN = Math.log(Math.max(1, node.n));
      for (const m of moves) {
        const k = node.kids.get(g.key(m))!;
        const sc = k.w / Math.max(1, k.n) + c * Math.sqrt(lnN / Math.max(1, k.n));
        if (sc > bestScore) ((bestScore = sc), (best = k));
      }
      node = best!;
      path.push(node);
      s = g.apply(s, node.m!, this.rnd);
    }
    this.root.n++;
    for (const n of path) {
      n.n++;
      n.w += n.mover === this.rootSide ? val : 1 - val;
    }
    this.iters++;
  }
  /** Search for `ms` milliseconds (or `iters` more iterations if given, whichever comes first). */
  step(ms: number, iters = Infinity): void {
    const end = Date.now() + ms;
    let k = 0;
    while (k < iters) {
      for (let i = 0; i < 16 && k < iters; i++, k++) this.once();
      if (Date.now() >= end) break;
    }
  }
  best(): Pick<M> {
    const g = this.g;
    const ranked = [...this.root.kids.values()].map((k) => ({ move: k.m!, n: k.n, value: k.n ? k.w / k.n : 0, key: k.key })).sort((a, b) => b.n - a.n);
    const safe = ranked.filter((r) => !this.avoid.has(r.key));
    const list = safe.length ? safe : ranked;
    const move = this.forced ?? list[0]?.move ?? g.legal(this.state)[0] ?? null;
    return { move, iters: this.iters, value: this.forced ? 1 : (list[0]?.value ?? 0.5), ranked: list.map((r) => ({ move: r.move, n: r.n, value: r.value })) };
  }
}

/** One whole search: `ms` of thinking (and at most `iters` iterations). The Worker, the hint and the node test all come through here. */
export function think<S, M>(g: BoardGame<S, M>, s: S, o: SearchOpts & { ms: number; iters?: number }): Pick<M> {
  const se = new Search(g, s, o);
  se.step(o.ms, o.iters);
  return se.best();
}

// ---------------------------------------------------------------- the weights slot

export const WEIGHTS_KEY = 'ghosty.arcade.board.weights.';
/** A trained set of weights, if the GYM's job has put one here (absent by default). */
export function loadWeights(id: string): number[] | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WEIGHTS_KEY + id);
    if (!raw) return null;
    const w = JSON.parse(raw) as unknown;
    return Array.isArray(w) && w.length > 0 && w.every((x) => Number.isFinite(x)) ? (w as number[]) : null;
  } catch {
    return null;
  }
}
