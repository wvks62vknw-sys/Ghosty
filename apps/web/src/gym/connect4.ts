/**
 * CONNECT 4, AlphaZero-style but phone-sized: a tree search (Monte Carlo tree search, no random play-outs)
 * whose leaves are judged by a small learned evaluator — an n-tuple network: one weight table for each of
 * the 69 lines of four, indexed by what is in its cells — trained by temporal-difference learning in
 * self-play. Ground truth: a bounded exact solver (alpha-beta with a transposition table) on a fixed set of
 * mid/late-game positions. Mastery = how much of the gap he closes between the same search with an
 * untrained network (0%) and the perfect solver (100%), counting the positions where his move keeps the
 * best result (win / draw / loss) with perfect play. Levels move the test positions earlier in the game (8 → 20 empty
 * squares), where they are harder to judge and to solve.
 *
 * Squares are numbered column by column from the bottom: square = column × 6 + row.
 */
import { COLS, canPlay, copyPos, LINES, legal, newPos, play, type Pos, ROWS, turn, undo, wonAt, winsNow, winnerOf, boardText, frameOf, posFromBoard } from './c4board';
import { C4_SETS } from './c4sets';
import { type Cell, finalLine, lastInt, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { CONNECT4 } from './meta';

export * from './c4board';

const N = COLS * ROWS;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const THROUGH: number[][] = Array.from({ length: N }, (_, sq) => LINES.map((l, i) => (l.includes(sq) ? i : -1)).filter((i) => i >= 0));

// ---- the exact solver (ground truth) --------------------------------------------------------------

const Z = (() => {
  const r = rng(424242);
  return Array.from({ length: N * 3 }, () => [Math.floor(r() * 4294967296), Math.floor(r() * 2097152)] as [number, number]);
})();
/** The position's hash in two parts (32 + 21 bits, so the key is an exact number). */
function hashOf(p: Pos): [number, number] {
  let a = 0;
  let b = 0;
  for (let s = 0; s < N; s++) {
    const x = p.b[s]!;
    if (!x) continue;
    a ^= Z[s * 3 + x]![0];
    b ^= Z[s * 3 + x]![1];
  }
  return [a, b];
}

/**
 * The game-theoretic result for the side to move: 1 win, 0 draw, −1 loss (alpha-beta, null window
 * steps, a transposition table, immediate wins and forced blocks first). `nodes` caps the work.
 */
export function solvePos(p0: Pos, maxNodes = 5_000_000): number {
  const p = copyPos(p0);
  const tt = new Map<number, number>();
  let nodes = 0;
  const neg = (alpha: number, beta: number, ha: number, hb: number): number => {
    const hash = (ha >>> 0) + hb * 4294967296;
    if (++nodes > maxNodes) throw new Error('solver budget');
    if (p.n === N) return 0;
    const me = turn(p);
    const moves = legal(p);
    for (const c of moves) if (winsNow(p, c)) return 1;
    // The opponent threatens to win: only blocking can help (two threats lose).
    const opp = me === 1 ? 2 : 1;
    const threats: number[] = [];
    for (const c of moves) {
      const s = c * ROWS + p.h[c]!;
      p.b[s] = opp;
      if (wonAt(p, s)) threats.push(c);
      p.b[s] = 0;
    }
    if (threats.length > 1) return -1;
    const list = threats.length ? threats : moves;
    if (p.n === N - 1) return 0;
    const hit = tt.get(hash);
    if (hit != null) {
      // Stored as value*4 + flag (0 exact, 1 lower bound, 2 upper bound).
      const v = Math.floor(hit / 4) - 1;
      const f = hit % 4;
      if (f === 0) return v;
      if (f === 1 && v >= beta) return v;
      if (f === 2 && v <= alpha) return v;
    }
    const a0 = alpha;
    let best = -2;
    for (const c of list) {
      const s = c * ROWS + p.h[c]!;
      play(p, c);
      const z = Z[s * 3 + me]!;
      const v = -neg(-beta, -alpha, ha ^ z[0], hb ^ z[1]);
      undo(p, c);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    tt.set(hash, (best + 1) * 4 + (best <= a0 ? 2 : best >= beta ? 1 : 0));
    return best;
  };
  const [ha, hb] = hashOf(p);
  return neg(-1, 1, ha, hb);
}

/** Every legal column's result for the side to move, and the columns that keep the best result. */
export function bestMoves(p0: Pos, maxNodes?: number): { values: (number | null)[]; best: number[] } {
  const p = copyPos(p0);
  const values: (number | null)[] = new Array(COLS).fill(null);
  for (let c = 0; c < COLS; c++) {
    if (!canPlay(p, c)) continue;
    const s = play(p, c);
    values[c] = wonAt(p, s) ? 1 : p.n === N ? 0 : -solvePos(p, maxNodes);
    undo(p, c);
  }
  const top = Math.max(...values.filter((v): v is number => v != null));
  return { values, best: values.map((v, c) => (v === top ? c : -1)).filter((c) => c >= 0) };
}

export const empties = (level: number) => [12, 13, 14, 15, 16, 17, 18, 19, 20, 21][lvl(level) - 1]!;

/** A random-play position with `empty` squares left: nobody has won, and not every move is equally good. */
function testPosition(r: () => number, empty: number): { pos: Pos; best: number[] } | null {
  const p = newPos();
  while (p.n < N - empty) {
    const ms = legal(p);
    const s = play(p, ms[Math.floor(r() * ms.length)]!);
    if (wonAt(p, s)) return null;
  }
  // No gimmes: no win in one, no threat that simply has to be blocked, and at most half the moves keep the result.
  const ms = legal(p);
  if (ms.length < 4 || ms.some((c) => winsNow(p, c))) return null;
  const opp = turn(p) === 1 ? 2 : 1;
  for (const c of ms) {
    const s = c * ROWS + p.h[c]!;
    p.b[s] = opp;
    const threat = wonAt(p, s);
    p.b[s] = 0;
    if (threat) return null;
  }
  try {
    const bm = bestMoves(p, 400_000);
    if (bm.best.length * 2 > ms.length) return null;
    return { pos: p, best: bm.best };
  } catch {
    return null;
  }
}

/** Test positions per level: enough that one lucky or unlucky move hardly shows. */
export const SET_SIZE = 120;
const sets = new Map<number, { pos: Pos; best: number[] }[]>();
/**
 * The fixed test set for a level (always the same 120 positions, solved exactly). They come from the stored
 * list (c4sets.ts) so the phone never waits on the solver; `fresh` makes them again with the solver
 * (that is how the list was made, and the tests check the two agree).
 */
export function testSet(level: number, size = SET_SIZE, fresh = false): { pos: Pos; best: number[] }[] {
  const L = lvl(level);
  const key = L * 1000 + size + (fresh ? 500 : 0);
  const hit = sets.get(key);
  if (hit) return hit;
  let out: { pos: Pos; best: number[] }[] = [];
  const stored = C4_SETS[L - 1];
  if (!fresh && size === SET_SIZE && stored?.length === SET_SIZE) {
    out = stored.map((line) => {
      const [sq, best] = line.split(':');
      return { pos: posFromBoard(sq!.split('').map(Number)), best: best!.split('').map(Number) };
    });
  } else {
    // Half the positions are ones the search alone (an untrained network) gets right, half ones it gets
    // wrong — so every level leaves the same room to learn, instead of whatever random play happened to give.
    const r = rng(9001 + L);
    const zero = new Float32Array(LINES.length * 81);
    let right = 0;
    let wrong = 0;
    while (out.length < size) {
      const t = testPosition(r, empties(L));
      if (!t) continue;
      const ok = t.best.includes(mcts(zero, t.pos, SIMS));
      if (ok ? right >= size / 2 : wrong >= size / 2) continue;
      if (ok) right++;
      else wrong++;
      out.push(t);
    }
  }
  sets.set(key, out);
  return out;
}

// ---- the learned evaluator and the search -----------------------------------------------------------

const POW = [1, 3, 9, 27];
/** A square's mirror image (left ↔ right): the network reads the board both ways, so it learns twice as fast. */
const MIRROR = Array.from({ length: N }, (_, s) => (COLS - 1 - Math.floor(s / ROWS)) * ROWS + (s % ROWS));
const tupleIndex = (b: Int8Array, l: number[], m: boolean) => (m ? b[MIRROR[l[0]!]!]! + b[MIRROR[l[1]!]!]! * 3 + b[MIRROR[l[2]!]!]! * 9 + b[MIRROR[l[3]!]!]! * 27 : b[l[0]!]! + b[l[1]!]! * 3 + b[l[2]!]! * 9 + b[l[3]!]! * 27);

/** The n-tuple network: the first player's chance, from −1 to 1. */
export function evaluate(w: Float32Array, p: Pos): number {
  let sum = 0;
  for (let i = 0; i < LINES.length; i++) {
    const l = LINES[i]!;
    sum += w[i * 81 + tupleIndex(p.b, l, false)]! + w[i * 81 + tupleIndex(p.b, l, true)]!;
  }
  return Math.tanh(sum);
}
function learn(w: Float32Array, p: Pos, delta: number): void {
  for (let i = 0; i < LINES.length; i++) {
    const l = LINES[i]!;
    w[i * 81 + tupleIndex(p.b, l, false)]! += delta;
    w[i * 81 + tupleIndex(p.b, l, true)]! += delta;
  }
}

interface Node {
  n: number;
  /** Total value for the player who moved INTO this node. */
  q: number;
  kids: (Node | null)[] | null;
  /** How promising each move looks to the network before searching (AlphaZero's prior). */
  prior: Float32Array | null;
  done: number | null;
}

/** Open a node: the network's look at every move from here becomes the prior; returns the node's own value for the side that moved into it. */
function expand(w: Float32Array, p: Pos, node: Node, temp: number): number {
  const me = turn(p);
  const prior = new Float32Array(COLS);
  let sum = 0;
  for (const c of ORDER) {
    if (!canPlay(p, c)) continue;
    const s = play(p, c);
    const v = wonAt(p, s) ? 3 : (me === 1 ? 1 : -1) * evaluate(w, p);
    undo(p, c);
    prior[c] = Math.exp(temp * v);
    sum += prior[c]!;
  }
  for (let c = 0; c < COLS; c++) prior[c]! /= sum;
  node.prior = prior;
  node.kids = new Array(COLS).fill(null);
  const e = evaluate(w, p);
  return me === 2 ? e : -e;
}

/**
 * Monte Carlo tree search guided by the evaluator, AlphaZero-style (PUCT): each move is tried in
 * proportion to how promising the network finds it and how well it has done in the search so far;
 * new positions are judged by the network instead of random play-outs. `sims` simulations.
 */
export function mcts(w: Float32Array, p0: Pos, sims: number, allowed?: number[]): number {
  const p = copyPos(p0);
  const moves = allowed ?? legal(p);
  for (const c of moves) if (winsNow(p, c)) return c;
  const root: Node = { n: 0, q: 0, kids: null, prior: null, done: null };
  expand(w, p, root, TEMP);
  for (let i = 0; i < sims; i++) {
    const path: [Node, number][] = [];
    let node = root;
    while (node.kids && node.done == null) {
      let bestC = -1;
      let bestU = -Infinity;
      const sq = Math.sqrt(node.n + 1);
      for (const c of ORDER) {
        if (!canPlay(p, c) || (node === root && !moves.includes(c))) continue;
        const k = node.kids[c];
        const u = (k && k.n ? k.q / k.n : 0) + 1.5 * node.prior![c]! * sq / (1 + (k?.n ?? 0));
        if (u > bestU) (bestU = u), (bestC = c);
      }
      const s = play(p, bestC);
      path.push([node, bestC]);
      node = node.kids[bestC] ??= { n: 0, q: 0, kids: null, prior: null, done: wonAt(p, s) ? 1 : p.n === N ? 0 : null };
      if (!node.kids) break;
    }
    // v is from the point of view of the player who moved into `node`.
    let v = node.done != null ? node.done : LEAF * expand(w, p, node, TEMP);
    node.n++;
    node.q += v;
    for (let j = path.length - 1; j >= 0; j--) {
      const [parent, c] = path[j]!;
      undo(p, c);
      v = -v;
      parent.n++;
      parent.q += v;
    }
  }
  let best = moves[0]!;
  let most = -1;
  for (const c of ORDER) {
    const k = root.kids?.[c];
    if (k && k.n > most) (most = k.n), (best = c);
  }
  return best;
}
/** How sharply the prior follows the network, and how far its judgement of a new position is trusted. */
const TEMP = 4;
const LEAF = 0.5;

/** His greedy move by the network alone (training): the best position one move ahead. */
function greedy(w: Float32Array, p: Pos): number {
  const me = turn(p);
  let best = -1;
  let bv = -Infinity;
  for (const c of legal(p)) {
    const s = play(p, c);
    // A move that lets the other side win at once is judged as the loss it is (cleaner self-play to learn from).
    const v = wonAt(p, s) ? 2 : legal(p).some((o) => winsNow(p, o)) ? -2 : (me === 1 ? 1 : -1) * evaluate(w, p);
    undo(p, c);
    if (v > bv) (bv = v), (best = c);
  }
  return best;
}

class C4Env implements Env {
  p = newPos();
  reset() {
    this.p = newPos();
  }
  actions() {
    return winnerOf(this.p) ? [] : legal(this.p).sort((a, b) => a - b);
  }
  step(c: number) {
    if (!canPlay(this.p, c) || winnerOf(this.p)) return { reward: -1, done: true };
    const s = play(this.p, c);
    const w = wonAt(this.p, s);
    return { reward: w ? 1 : 0, done: w || this.p.n === N };
  }
  describe() {
    return boardText(this.p);
  }
}

/** How many test positions the search gets right with network weights w. */
function agreement(w: Float32Array, set: { pos: Pos; best: number[] }[]): number {
  let good = 0;
  for (const t of set) if (t.best.includes(mcts(w, t.pos, SIMS))) good++;
  return good;
}
const alone = new Map<number, number>();
/** The search on its own (an all-zero network): the 0% end of the scale, worked out once per level. */
export function searchAlone(level: number): number {
  const L = lvl(level);
  let v = alone.get(L);
  if (v == null) alone.set(L, (v = agreement(new Float32Array(LINES.length * 81), testSet(L))));
  return v;
}

interface C4Save {
  game: 'connect4';
  w: Float32Array;
  games: number;
  rand: number;
}

const SIMS = 64;

class C4Learner implements Learner {
  w: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // The evaluator carries over between levels.
    const s = savedFor<C4Save>(saved, 'connect4');
    this.w = s?.w?.length === LINES.length * 81 ? s.w : new Float32Array(LINES.length * 81);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  train(n: number) {
    const { w, r } = this;
    const alpha = 0.001;
    for (let g = 0; g < n; g++) {
      const p = newPos();
      let prev: Pos | null = null;
      let prevV = 0;
      // Each game opens with a few random moves, so he meets all kinds of positions.
      let opening = Math.floor(r() * 27);
      for (;;) {
        const ms = legal(p);
        const c = opening-- > 0 || r() < 0.1 ? ms[Math.floor(r() * ms.length)]! : greedy(w, p);
        const s = play(p, c);
        const won = wonAt(p, s);
        const over = won || p.n === N;
        const v = evaluate(w, p);
        if (prev) {
          const target = over ? (won ? (turn(p) === 1 ? -1 : 1) : 0) : v;
          learn(w, prev, alpha * (target - prevV) * (1 - prevV * prevV));
        }
        if (over) {
          // The final position itself learns the result too.
          const z = won ? (turn(p) === 1 ? -1 : 1) : 0;
          learn(w, p, alpha * (z - v) * (1 - v * v));
          break;
        }
        prev = copyPos(p);
        prevV = v;
      }
    }
    this.games += n;
    this.rand = (this.rand + n * 2654435761) >>> 0;
    return n;
  }
  measure() {
    const set = testSet(this.level);
    const good = agreement(this.w, set);
    const base = searchAlone(this.level);
    return {
      mastery: Math.max(0, Math.min(1, (good - base) / Math.max(1, set.length - base))),
      detail: `His move keeps the best result in ${good} of ${set.length} test positions with ${empties(this.level)} empty squares (checked by an exact solver); the same search with an untrained network gets ${base} (0%), the solver ${set.length} (100%).`,
    };
  }
  save(): C4Save {
    return { game: 'connect4', w: this.w, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // How much each square is worth to the first player, summed over the lines through it.
    const vals = Array.from({ length: N }, (_, s) => {
      let x = 0;
      for (const li of THROUGH[s]!) {
        const l = LINES[li]!;
        x += this.w[li * 81 + POW[l.indexOf(s)]!]! - this.w[li * 81]!;
      }
      return x;
    });
    const mx = Math.max(...vals.map(Math.abs)) || 1;
    const cells: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r--)
      for (let c = 0; c < COLS; c++) {
        const x = vals[c * ROWS + r]! / mx;
        cells.push({ c: `hsl(${x >= 0 ? 190 : 350} 85% ${12 + Math.abs(x) * 38}%)` });
      }
    return { grid: { w: COLS, h: ROWS, cells }, caption: 'Squares he has learned to value: brighter = a stone there helps more.' };
  }
  watch(seed: number): Frame[] {
    const p = newPos();
    const frames: Frame[] = [frameOf(p, 'He plays himself.')];
    const r = rng(seed);
    play(p, Math.floor(r() * COLS));
    frames.push(frameOf(p, 'X opens.'));
    while (!winnerOf(p)) {
      const c = mcts(this.w, p, SIMS);
      const s = play(p, c);
      const w = winnerOf(p);
      frames.push(frameOf(p, w === 3 ? 'Board full — a draw.' : w ? `${w === 1 ? 'X' : 'O'} connects four.` : `${turn(p) === 1 ? 'O' : 'X'} plays column ${c + 1}.`, s));
    }
    return frames;
  }
  move(state: number[]) {
    const p = posFromBoard(state);
    return winnerOf(p) ? -1 : mcts(this.w, p, SIMS * 2);
  }
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed * 31 + L);
  for (;;) {
    const t = testPosition(r, empties(L));
    if (!t) continue;
    const text = `${boardText(t.pos)}\nWhich column (1–7) is the best move? Best means it keeps the best result possible (win, draw or loss) with perfect play from both sides.`;
    return { game: 'connect4', level: L, seed, text, data: { board: Array.from(t.pos.b), best: t.best.map((c) => c + 1) } };
  }
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { best: number[] };
  const m = lastInt(finalLine(answer));
  const ok = d.best.includes(m);
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'A perfect move.' : `Best: column ${d.best.join(' or ')}.` };
}

export const connect4: Game = {
  ...CONNECT4,
  env: () => new C4Env(),
  generate,
  check,
  learner: (level, seed, saved) => new C4Learner(level, seed, saved),
};
