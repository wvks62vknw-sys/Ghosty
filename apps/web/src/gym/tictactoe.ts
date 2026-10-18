/**
 * TIC-TAC-TOE by self-play. Ghosty keeps a value for every position (+1 X wins … −1 O wins) and plays
 * himself, nudging each position's value toward the best value one move ahead (temporal-difference
 * learning with a one-move look-ahead), exploring with random moves now and then. Ground truth: exhaustive
 * minimax over all 4,520 reachable positions where someone is to move; mastery = the share of those where
 * the choice matters (not every move equally good) in which his move is game-theoretically optimal. 100% is
 * reachable. Levels raise the bar (85% → 100%).
 */
import { type Cell, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { TICTACTOE } from './meta';
import { boardText, frameOf, keyOf, toMove, winner } from './tttboard';

export * from './tttboard';

const result = (w: number) => (w === 1 ? 1 : w === 2 ? -1 : 0);

/** Exhaustive minimax: the value (X's view) of every reachable position, and the optimal moves where someone is to move. */
export interface Solved {
  value: Map<number, number>;
  best: Map<number, number[]>;
  positions: number[][];
}
let solvedCache: Solved | null = null;
export function solve(): Solved {
  if (solvedCache) return solvedCache;
  const value = new Map<number, number>();
  const best = new Map<number, number[]>();
  const positions: number[][] = [];
  const rec = (b: number[]): number => {
    const k = keyOf(b);
    const hit = value.get(k);
    if (hit != null) return hit;
    const w = winner(b);
    if (w) {
      value.set(k, result(w));
      return result(w);
    }
    const p = toMove(b);
    const vals: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = p;
      vals.push([i, rec(b)]);
      b[i] = 0;
    }
    const v = p === 1 ? Math.max(...vals.map((x) => x[1])) : Math.min(...vals.map((x) => x[1]));
    value.set(k, v);
    best.set(k, vals.filter((x) => x[1] === v).map((x) => x[0]));
    positions.push(b.slice());
    return v;
  };
  rec([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  solvedCache = { value, best, positions };
  return solvedCache;
}

class TttEnv implements Env {
  b = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  reset() {
    this.b = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  actions() {
    return winner(this.b) ? [] : [...this.b.keys()].filter((i) => !this.b[i]);
  }
  /** The player to move marks square a; reward +1 to the mover for a win, −1 for an illegal move. */
  step(a: number) {
    if (this.b[a] || winner(this.b)) return { reward: -1, done: true };
    const p = toMove(this.b);
    this.b[a] = p;
    const w = winner(this.b);
    return { reward: w === p ? 1 : 0, done: w !== 0 };
  }
  describe() {
    return boardText(this.b);
  }
}

interface TttSave {
  game: 'tictactoe';
  v: Float32Array;
  games: number;
  rand: number;
}

let choiceCache: number[][] | null = null;
/** The positions where the choice matters: not every legal move is equally good. */
export function choices(): number[][] {
  if (!choiceCache) {
    const S = solve();
    choiceCache = S.positions.filter((b) => S.best.get(keyOf(b))!.length < b.filter((x) => !x).length);
  }
  return choiceCache;
}

class TttLearner implements Learner {
  v: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  constructor(seed: number, saved?: unknown) {
    // What he knows carries over between levels: the levels only raise the bar.
    const s = savedFor<TttSave>(saved, 'tictactoe');
    this.v = s?.v?.length === 19683 ? s.v : new Float32Array(19683);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** His value of the position after a move: exact when the game is over, learned otherwise. */
  private after(b: number[]): number {
    const w = winner(b);
    return w ? result(w) : this.v[keyOf(b)]!;
  }
  /** His move: the best position one move ahead for the side to move (first square on ties). */
  choose(b: number[]): { move: number; value: number } {
    const p = toMove(b);
    let move = -1;
    let value = p === 1 ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = p;
      const x = this.after(b);
      b[i] = 0;
      if (p === 1 ? x > value + 1e-9 : x < value - 1e-9) (value = x), (move = i);
    }
    return { move, value };
  }
  train(n: number) {
    const b = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let g = 0; g < n; g++) {
      b.fill(0);
      // Each game opens with a few random moves, so he also meets the positions good players never reach.
      let opening = Math.floor(this.r() * 8);
      while (!winner(b)) {
        const { move, value } = this.choose(b);
        const k = keyOf(b);
        this.v[k]! += 0.7 * (value - this.v[k]!);
        let m = move;
        if (opening-- > 0 || this.r() < 0.1) {
          const free = [...b.keys()].filter((i) => !b[i]);
          m = free[Math.floor(this.r() * free.length)]!;
        }
        b[m] = toMove(b);
      }
    }
    this.games += n;
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const S = solve();
    const set = choices();
    let good = 0;
    for (const b of set) if (S.best.get(keyOf(b))!.includes(this.choose(b.slice()).move)) good++;
    const n = set.length;
    return { mastery: good / n, detail: `His move is perfect in ${good.toLocaleString('en-GB')} of the ${n.toLocaleString('en-GB')} positions where the choice matters (of all ${S.positions.length.toLocaleString('en-GB')}, checked against exhaustive minimax).` };
  }
  save(): TttSave {
    return { game: 'tictactoe', v: this.v, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // The empty board: how good each first move looks to him (X's view).
    const cells: Cell[] = [];
    for (let i = 0; i < 9; i++) {
      const x = this.v[keyOf([...Array(9)].map((_, j) => (j === i ? 1 : 0)))]!;
      cells.push({ t: x >= 0 ? `+${x.toFixed(2)}` : x.toFixed(2), c: `hsl(${x >= 0 ? 160 : 350} 80% ${16 + Math.abs(x) * 30}%)` });
    }
    return { grid: { w: 3, h: 3, cells }, caption: 'How good each opening square looks to him as X (+1 = sure win, 0 = draw, −1 = sure loss).' };
  }
  watch(seed: number): Frame[] {
    // He plays himself: a random first move (from the seed), then his best on both sides.
    const b = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const frames: Frame[] = [];
    b[Math.floor(rng(seed)() * 9)] = 1;
    frames.push(frameOf(b, 'X opens.'));
    while (!winner(b)) {
      const p = toMove(b);
      b[this.choose(b).move] = p;
      const w = winner(b);
      frames.push(frameOf(b, w === 3 ? 'A draw — perfect play on both sides ends like this.' : w ? `${w === 1 ? 'X' : 'O'} wins.` : `${p === 1 ? 'X' : 'O'} moves.`));
    }
    return frames;
  }
  move(state: number[]) {
    return winner(state) ? -1 : this.choose(state.slice()).move;
  }
}

const EMPTIES = [2, 3, 4, 5, 5, 6, 6, 7, 7, 8];

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const S = solve();
  const want = EMPTIES[L - 1]!;
  const pool = S.positions.filter((b) => b.filter((x) => !x).length === want && S.best.get(keyOf(b))!.length < want);
  const b = pool[Math.floor(rng(seed)() * pool.length)]!;
  const text = `${boardText(b)}\nWhich square (1–9) is the best move? Best means it keeps the best result possible with perfect play from both sides.`;
  return { game: 'tictactoe', level: L, seed, text, data: { board: b, best: S.best.get(keyOf(b))!.map((x) => x + 1) } };
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { best: number[] };
  const m = Number(answer.match(/[1-9]/)?.[0] ?? 0);
  const ok = d.best.includes(m);
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'A perfect move.' : `The best square${d.best.length > 1 ? 's are' : ' is'} ${d.best.join(', ')}.` };
}


export const tictactoe: Game = {
  ...TICTACTOE,
  env: () => new TttEnv(),
  generate,
  check,
  learner: (_level, seed, saved) => new TttLearner(seed, saved),
};
