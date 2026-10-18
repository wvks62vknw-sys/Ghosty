/**
 * GO 9×9 (area scoring, komi 7, simple ko, suicide illegal). Ghosty searches with Monte Carlo tree search
 * guided by two small learned pattern tables instead of random play-outs: one says, from the 3×3 shape
 * around a point (and how many liberties its stones have), who will own that point at the end — summed
 * over the board, that is his estimate of the score; the other says which moves look promising from the
 * shape around them (and whether they capture or save stones). Both are learned in self-play: after
 * each game every position learns who really ended up owning each point, and which moves his search
 * liked. Shapes are counted once for all their rotations and mirror images.
 *
 * Ground truth: a fixed ladder of reference engines — plain Monte Carlo tree search with random
 * play-outs (UCT, never filling its own eyes) — at 8 … 500 play-outs a move. At each level he plays a
 * match with the SAME number of searches per move (each of his is a look-up instead of a play-out),
 * from fixed openings played both ways; mastery = his share of the points. Second measure: capture
 * puzzles on small boards (Black to play and capture the marked stones, whatever White does), each
 * answer proved by exhaustive search.
 */
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { area, copyGo, type Go, goFrame, goFrom, goState, goText, group, inner, isEye, KOMI, legalAt, margin, newGo, outer, over, pass, playAt, ptName } from './goboard';
import { GO_PUZZLES } from './gosets';
import { Match, type MatchResult, perfRating, record, share, type Stepper } from './match';
import { GO } from './meta';

export * from './goboard';
export { setSlice } from './match';

export const playoutsFor = (level: number) => [8, 16, 32, 64, 100, 150, 200, 300, 400, 500][lvl(level) - 1]!;

// ---- shapes ---------------------------------------------------------------------------------------------------

/** The 3×3 shape code around a point: its eight neighbours, each 0 empty, 1 Black, 2 White, 3 off the board. */
function code(g: Go, i: number): number {
  const W = g.n + 2;
  const b = g.b;
  return b[i - W - 1]! | (b[i - W]! << 2) | (b[i - W + 1]! << 4) | (b[i - 1]! << 6) | (b[i + 1]! << 8) | (b[i + W - 1]! << 10) | (b[i + W]! << 12) | (b[i + W + 1]! << 14);
}
/** The same shape with the colours swapped. */
const SWAP = (() => {
  const t = new Uint16Array(65536);
  for (let c = 0; c < 65536; c++) {
    let x = 0;
    for (let k = 0; k < 8; k++) {
      const v = (c >> (2 * k)) & 3;
      x |= (v === 1 ? 2 : v === 2 ? 1 : v) << (2 * k);
    }
    t[c] = x;
  }
  return t;
})();
/** One class for a shape and all its rotations and mirror images. */
const CANON = (() => {
  // Neighbour k at (dr, dc); the eight symmetries of the square map positions to positions.
  const pos = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  const syms: number[][] = [];
  for (let s = 0; s < 8; s++) {
    syms.push(
      pos.map(([r, c]) => {
        let [a, b] = [r!, c!];
        if (s & 1) [a, b] = [b, a];
        if (s & 2) a = -a;
        if (s & 4) b = -b;
        return pos.findIndex(([x, y]) => x === a && y === b);
      }),
    );
  }
  const cls = new Int32Array(65536).fill(-1);
  let n = 0;
  for (let c = 0; c < 65536; c++) {
    if (cls[c]! >= 0) continue;
    for (const sm of syms) {
      let x = 0;
      for (let k = 0; k < 8; k++) x |= ((c >> (2 * k)) & 3) << (2 * sm[k]!);
      if (cls[x]! < 0) cls[x] = n;
    }
    n++;
  }
  return { cls, n };
})();
export const SHAPES = CANON.n;

/** Liberties of every stone's group (1–4, 4 meaning four or more). */
function libsAll(g: Go): Uint8Array {
  const out = new Uint8Array(g.b.length);
  const seen = new Uint8Array(g.b.length);
  for (let i = 0; i < g.b.length; i++) {
    const x = g.b[i]!;
    if ((x !== 1 && x !== 2) || seen[i]) continue;
    const gr = group(g, i, seen);
    const l = Math.min(4, gr.libs);
    for (const s of gr.stones) out[s] = l;
  }
  return out;
}

/** How far a point is from the edge (0 = on it, capped at 4). */
const lineOf = (g: Go, i: number) => {
  const W = g.n + 2;
  const r = Math.floor(i / W) - 1;
  const c = (i % W) - 1;
  return Math.min(4, r, c, g.n - 1 - r, g.n - 1 - c);
};

// ---- the learned tables ------------------------------------------------------------------------------------------

/** Ownership table: [centre 0–2][liberties 0–4][shape class], then [centre][line 0–4]. Policy table: [shape class seen by the mover], then 2 tactical bonuses. */
export interface Tables {
  own: Float32Array;
  line: Float32Array;
  pol: Float32Array;
}
export const newTables = (): Tables => ({ own: new Float32Array(3 * 5 * SHAPES), line: new Float32Array(15), pol: new Float32Array(SHAPES + 2) });
const swapC = (x: number) => (x === 1 ? 2 : x === 2 ? 1 : 0);

/** Who he thinks will own point i at the end: −1 White … +1 Black (the raw sum before the squash). */
function ownRaw(t: Tables, g: Go, i: number, libs: Uint8Array): number {
  const x = g.b[i]!;
  const l = libs[i]!;
  const c = code(g, i);
  const a = t.own[(x * 5 + l) * SHAPES + CANON.cls[c]!]!;
  const b = t.own[(swapC(x) * 5 + l) * SHAPES + CANON.cls[SWAP[c]!]!]!;
  const ln = lineOf(g, i);
  return a - b + t.line[x * 5 + ln]! - t.line[swapC(x) * 5 + ln]!;
}

/** His estimate of Black's final score (area, minus komi). */
export function scoreEstimate(t: Tables, g: Go): number {
  const libs = libsAll(g);
  const W = g.n + 2;
  let s = 0;
  for (let r = 1; r <= g.n; r++) for (let c = 1; c <= g.n; c++) s += Math.tanh(ownRaw(t, g, r * W + c, libs));
  return s - (g.n >= 9 ? KOMI : 0);
}
/** …as a chance of winning for the side to move. */
const winChance = (t: Tables, g: Go) => {
  const s = scoreEstimate(t, g);
  const pb = 1 / (1 + Math.exp(-s / 2));
  return g.side === 1 ? pb : 1 - pb;
};

/** The policy features of a move at i for the side to move: its shape (seen as the mover), and whether it captures or saves stones in atari. */
function polFeatures(g: Go, i: number, libs: Uint8Array): [number, number, number] {
  let c = code(g, i);
  if (g.side === 2) c = SWAP[c]!;
  const W = g.n + 2;
  let capture = 0;
  let save = 0;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    const x = g.b[j]!;
    if (x === 3 - g.side && libs[j] === 1) capture = 1;
    if (x === g.side && libs[j] === 1) save = 1;
  }
  return [CANON.cls[c]!, capture, save];
}

// ---- moves both engines consider -----------------------------------------------------------------------------------

/** Legal points that do not fill one's own eye; a pass only when there are none. */
export function candidates(g: Go): number[] {
  const out: number[] = [];
  const W = g.n + 2;
  for (let r = 1; r <= g.n; r++)
    for (let c = 1; c <= g.n; c++) {
      const i = r * W + c;
      if (g.b[i] === 0 && !isEye(g, i, g.side) && legalAt(g, i)) out.push(i);
    }
  return out.length ? out : [-1];
}
const doMove = (g: Go, i: number) => (i < 0 ? (pass(g), true) : playAt(g, i));

/** A random play-out to the end (no eye filling); the area result for Black (positive = Black wins, after komi). */
function playout(g: Go, r: () => number): number {
  const W = g.n + 2;
  const cap = g.n * g.n * 3;
  const empties: number[] = [];
  for (let k = 0; k < g.b.length; k++) if (g.b[k] === 0) empties.push(k);
  while (!over(g) && g.moves < cap) {
    // Try empty points in random order until one is legal and not an own eye.
    let moved = false;
    let n = empties.length;
    while (n > 0) {
      const k = Math.floor(r() * n);
      const i = empties[k]!;
      if (g.b[i] === 0 && !isEye(g, i, g.side) && playAt(g, i)) {
        moved = true;
        break;
      }
      empties[k] = empties[n - 1]!;
      empties[n - 1] = i;
      n--;
    }
    if (!moved) pass(g);
    else if (g.moves % 8 === 0) {
      // Captures free points: refresh the list now and then.
      empties.length = 0;
      for (let k = W; k < g.b.length - W; k++) if (g.b[k] === 0) empties.push(k);
    }
  }
  return margin(g);
}

interface Node {
  moves: number[];
  prior: Float32Array;
  n: Int32Array;
  w: Float64Array;
  kids: (Node | null)[];
  total: number;
}

/**
 * One engine's search for a move, run a slice at a time (so a long search never holds up the worker).
 * `t` = his tables (PUCT, values from the tables); null = the reference (UCT with random play-outs).
 */
export class Searcher {
  root: Node | null = null;
  only = -1;
  done = 0;
  constructor(
    private g0: Go,
    private t: Tables | null,
    private r: () => number,
  ) {
    const rootMoves = candidates(g0);
    if (rootMoves.length === 1) this.only = rootMoves[0]!;
    else this.root = this.open(g0, rootMoves);
  }
  private open(g: Go, moves: number[]): Node {
    const t = this.t;
    const prior = new Float32Array(moves.length);
    if (t) {
      const libs = libsAll(g);
      let sum = 0;
      moves.forEach((m, k) => {
        if (m < 0) return;
        const [cl, cap, save] = polFeatures(g, m, libs);
        prior[k] = Math.exp(Math.max(-20, Math.min(20, t.pol[cl]! + cap * t.pol[SHAPES]! + save * t.pol[SHAPES + 1]!)));
        sum += prior[k]!;
      });
      for (let k = 0; k < moves.length; k++) prior[k] = sum > 0 ? prior[k]! / sum : 1 / moves.length;
    } else prior.fill(1 / moves.length);
    return { moves, prior, n: new Int32Array(moves.length), w: new Float64Array(moves.length), kids: new Array(moves.length).fill(null), total: 0 };
  }
  /** Run `sims` more simulations. */
  run(sims: number): void {
    const root = this.root;
    if (!root) return;
    const { t, r, g0 } = this;
    for (let s = 0; s < sims; s++) {
      this.done++;
      const g = copyGo(g0);
      const path: [Node, number][] = [];
      let node = root;
      let value: number;
      for (;;) {
        // Pick a child: PUCT (his) or UCT with every move tried once first (the reference).
        let best = 0;
        let bv = -Infinity;
        const sq = Math.sqrt(node.total + 1);
        const ln = Math.log(node.total + 1);
        for (let k = 0; k < node.moves.length; k++) {
          const n = node.n[k]!;
          let u: number;
          if (t) u = (n ? node.w[k]! / n : 0.5) + (1.2 * node.prior[k]! * sq) / (1 + n);
          else u = n ? node.w[k]! / n + Math.sqrt((2 * ln) / n) : 1e9 + r();
          if (u > bv) (bv = u), (best = k);
        }
        const mover = g.side;
        doMove(g, node.moves[best]!);
        path.push([node, best]);
        if (over(g) || g.moves > g.n * g.n * 3) {
          const m = margin(g);
          value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          break;
        }
        const kid = node.kids[best];
        if (!kid) {
          node.kids[best] = this.open(g, candidates(g));
          // The new position's value for the side that just moved.
          if (t) value = 1 - winChance(t, g);
          else {
            const m = playout(g, r);
            value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          }
          break;
        }
        node = kid;
      }
      // Back up: value is for the player who made the last move on the path.
      for (let k = path.length - 1; k >= 0; k--) {
        const [nd, c] = path[k]!;
        nd.n[c]!++;
        nd.w[c]! += value;
        nd.total++;
        value = 1 - value;
      }
    }
  }
  /** The most visited move (inner index, −1 = pass). */
  best(): number {
    const root = this.root;
    if (!root) return this.only;
    let best = 0;
    for (let k = 1; k < root.moves.length; k++) if (root.n[k]! > root.n[best]!) best = k;
    return root.moves[best]!;
  }
}

/** A whole search at once: `sims` simulations, then the most visited move. */
export function search(g0: Go, sims: number, t: Tables | null, r: () => number): number {
  const s = new Searcher(g0, t, r);
  s.run(sims);
  lastRoot = s.root;
  return s.best();
}
let lastRoot: Node | null = null;

// ---- matches -----------------------------------------------------------------------------------------------------

/** Fixed openings: the first two stones (one each) in the middle of the board, the same list every time. */
export const OPENINGS: [number, number][] = (() => {
  const r = rng(9090);
  const out: [number, number][] = [];
  while (out.length < 8) {
    const a = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    const b = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    if (a !== b && !out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
  }
  return out;
})();
export const gamesFor = (level: number) => (lvl(level) <= 4 ? 12 : 8);

export function duel(opening: number, first: boolean, sims: number, mine: Tables, seed: number): Stepper & { g: Go; me: number } {
  const g = newGo(9);
  const [a, b] = OPENINGS[opening % OPENINGS.length]!;
  playAt(g, inner(g, a));
  playAt(g, inner(g, b));
  // He is Black when he moves "first".
  const me = first ? 1 : 2;
  const r = rng(seed);
  let cur: Searcher | null = null;
  return {
    g,
    me,
    // One step = a slice of one move's search (at most 32 of his look-ups or 12 random play-outs), so the worker is never held up for long.
    step() {
      if (over(g) || g.moves > 200) {
        const m = margin(g);
        const res = m === 0 ? 0.5 : m > 0 ? 1 : 0;
        return me === 1 ? res : 1 - res;
      }
      cur ??= new Searcher(g, g.side === me ? mine : null, r);
      cur.run(Math.min(g.side === me ? 32 : 12, sims - cur.done));
      if (cur.done >= sims || !cur.root) {
        doMove(g, cur.best());
        cur = null;
      }
      return null;
    },
  };
}

/**
 * Ratings of the reference engines on Ghosty's own scale: 8 play-outs = 1000. Matches between neighbouring
 * rungs (12 games each, 8 … 300 play-outs) came to about 140 points for each doubling of the play-outs —
 * single small matches are noisy, so the ladder uses that fitted line: 1000 + 138 × log2(play-outs ÷ 8).
 */
export const LADDER = [1000, 1138, 1276, 1414, 1503, 1584, 1641, 1722, 1779, 1823];
export const ladderRating = (level: number) => LADDER[lvl(level) - 1]!;

// ---- capture puzzles (exact) ---------------------------------------------------------------------------------------

export interface Puzzle {
  g: Go;
  /** A stone of the group to capture (outer point). */
  target: number;
  n: number;
  /** The first moves (outer points) that capture it within n moves, whatever White does. */
  best: number[];
}

/** Can Black (to move) capture the group at `target` within k Black moves, whatever White does (White may also pass)? Exhaustive. */
export function captures(g: Go, target: number, k: number): boolean {
  for (const i of legalMoves(g)) {
    const c = copyGo(g);
    playAt(c, i);
    if (c.b[target] !== 2) return true;
    if (k <= 1) continue;
    let all = true;
    for (const j of [...legalMoves(c), -1]) {
      const d = copyGo(c);
      if (j < 0) pass(d);
      else playAt(d, j);
      if (!captures(d, target, k - 1)) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}
function legalMoves(g: Go): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.b.length; i++) if (g.b[i] === 0 && legalAt(g, i)) out.push(i);
  return out;
}
/** Every first move that captures the group within k. */
export function capturingMoves(g: Go, target: number, k: number): number[] {
  return legalMoves(g)
    .filter((i) => {
      const c = copyGo(g);
      playAt(c, i);
      if (c.b[target] !== 2) return true;
      if (k <= 1) return false;
      return [...legalMoves(c), -1].every((j) => {
        const d = copyGo(c);
        if (j < 0) pass(d);
        else playAt(d, j);
        return captures(d, target, k - 1);
      });
    })
    .map((i) => outer(g, i));
}

export function puzzles(): Puzzle[] {
  return GO_PUZZLES.map((line) => {
    const [n, cells, target, k, best] = line.split('|') as [string, string, string, string, string];
    const g = newGo(Number(n));
    for (let pt = 0; pt < g.n * g.n; pt++) g.b[inner(g, pt)] = '.XO'.indexOf(cells[pt]!);
    return { g, target: inner(g, Number(target)), n: Number(k), best: best.split(',').map(Number) };
  });
}

// ---- the learner -----------------------------------------------------------------------------------------------------

interface GoSave {
  game: 'go';
  own: Float32Array;
  line: Float32Array;
  pol: Float32Array;
  games: number;
  rand: number;
}

const TRAIN_SIMS = 16;

class GoLearner implements Learner {
  t: Tables;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  puz: { found: number; of: number } | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // What he learned carries over between levels.
    const s = savedFor<GoSave>(saved, 'go');
    const fresh = newTables();
    this.t = s && s.own?.length === fresh.own.length ? { own: s.own, line: s.line, pol: s.pol } : fresh;
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** One self-play game with a quick search, then every position learns who owned each point at the end, and which moves the search liked. */
  /** The self-play game under way (played a few moves per call, so the worker is never held up). */
  private cur: { g: Go; seen: { g: Go; moves: number[]; visits: number[] }[] } | null = null;
  /** Play up to `k` moves of the current self-play game; when it ends, learn from it. True when a game finished. */
  private play(k: number): boolean {
    this.cur ??= { g: newGo(9), seen: [] };
    const { g, seen } = this.cur;
    for (let i = 0; i < k && !over(g) && g.moves < 200; i++) {
      let m: number;
      const cand = candidates(g);
      if (g.moves < 4 || this.r() < 0.05) m = cand[Math.floor(this.r() * cand.length)]!;
      else {
        m = search(g, TRAIN_SIMS, this.t, this.r);
        const root = lastRoot;
        if (root) {
          seen.push({ g: copyGo(g), moves: root.moves.slice(), visits: Array.from(root.n) });
          // Early on, follow the search's visits loosely (more variety).
          if (g.moves < 12) {
            let x = this.r() * root.total;
            for (let j = 0; j < root.moves.length; j++)
              if ((x -= root.n[j]!) < 0) {
                m = root.moves[j]!;
                break;
              }
          }
        }
      }
      doMove(g, m);
    }
    if (!over(g) && g.moves < 200) return false;
    this.cur = null;
    this.learn(g, seen);
    return true;
  }
  private learn(g: Go, seen: { g: Go; moves: number[]; visits: number[] }[]) {
    const owner = area(g).owner;
    const t = this.t;
    for (const s of seen) {
      const p = s.g;
      const libs = libsAll(p);
      const W = p.n + 2;
      // Ownership: each point towards who owned it at the end.
      for (let rr = 1; rr <= p.n; rr++)
        for (let c = 1; c <= p.n; c++) {
          const i = rr * W + c;
          const target = owner[i] === 1 ? 1 : owner[i] === 2 ? -1 : 0;
          const y = Math.tanh(ownRaw(t, p, i, libs));
          const gr = 0.02 * (target - y) * (1 - y * y);
          const x = p.b[i]!;
          const l = libs[i]!;
          const cd = code(p, i);
          const ln = lineOf(p, i);
          t.own[(x * 5 + l) * SHAPES + CANON.cls[cd]!]! += gr;
          t.own[(swapC(x) * 5 + l) * SHAPES + CANON.cls[SWAP[cd]!]!]! -= gr;
          t.line[x * 5 + ln]! += gr;
          t.line[swapC(x) * 5 + ln]! -= gr;
        }
      // Policy: towards the share of the search's visits each move got.
      if (s.moves[0]! < 0) continue;
      const feats = s.moves.map((m) => polFeatures(p, m, libs));
      const logits = feats.map(([cl, cap, save]) => t.pol[cl]! + cap * t.pol[SHAPES]! + save * t.pol[SHAPES + 1]!);
      const mx = Math.max(...logits);
      const ex = logits.map((v) => Math.exp(v - mx));
      const sum = ex.reduce((a, b) => a + b, 0);
      const tot = s.visits.reduce((a, b) => a + b, 0) || 1;
      feats.forEach(([cl, cap, save], k) => {
        const gr = 0.05 * (s.visits[k]! / tot - ex[k]! / sum);
        t.pol[cl]! += gr;
        if (cap) t.pol[SHAPES]! += gr;
        if (save) t.pol[SHAPES + 1]! += gr;
      });
    }
  }
  /** A unit is a whole self-play game; one call plays a slice of it (0 until a game is finished). */
  train(_n: number) {
    if (!this.play(12)) return 0;
    this.games++;
    this.rand = (this.rand + 2654435761) >>> 0;
    return 1;
  }
  /** Capture puzzles: his move (his search on the small board) is one that captures the stones by force. */
  puzzles(t = this.t) {
    const set = puzzles();
    let found = 0;
    const r = rng(77);
    for (const p of set) {
      const m = search(p.g, 120, t, r);
      if (m >= 0 && p.best.includes(outer(p.g, m))) found++;
    }
    return { found, of: set.length };
  }
  measure() {
    const sims = playoutsFor(this.level);
    const n = gamesFor(this.level);
    if (!this.match) {
      const frozen: Tables = { own: this.t.own.slice(), line: this.t.line.slice(), pol: this.t.pol.slice() };
      this.match = new Match(n, (o, first) => duel(o, first, sims, frozen, 1000 + o));
    }
    if (this.match.run()) {
      this.last = this.match.res;
      this.match = null;
      this.puz = this.puzzles();
    }
    if (!this.last) {
      const played = this.match?.res.games ?? 0;
      return { mastery: 0, detail: `His first match against the ${sims}-play-out reference engine is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    return {
      mastery: s,
      detail: `Against the reference engine (tree search with ${sims} random play-outs a move), searching as many times himself: ${record(this.last)} — ${Math.round(s * 100)}% of the points; estimated rating ${perfRating(s, ladderRating(this.level))} on Ghosty's own scale (8 play-outs = 1000). Capture puzzles: ${this.puz!.found} of ${this.puz!.of} solved (each answer proved by exhaustive search).`,
    };
  }
  save(): GoSave {
    return { game: 'go', own: this.t.own, line: this.t.line, pol: this.t.pol, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // A position from his last practice: who he thinks owns each point.
    const g = newGo(9);
    const r = rng(5);
    for (let k = 0; k < 30; k++) {
      const c = candidates(g);
      doMove(g, c[Math.floor(r() * c.length)]!);
    }
    const libs = libsAll(g);
    const marks: Record<number, string> = {};
    for (let pt = 0; pt < 81; pt++) {
      const v = Math.tanh(ownRaw(this.t, g, inner(g, pt), libs));
      if (g.b[inner(g, pt)] === 0 && Math.abs(v) > 0.3) marks[pt] = v > 0 ? 'ownb' : 'ownw';
    }
    return goFrame(g, `A random position: the small squares show who he expects to own each empty point (score estimate ${scoreEstimate(this.t, g).toFixed(1)} for Black, after komi).`, marks);
  }
  watch(seed: number): Frame[] {
    const sims = Math.min(64, playoutsFor(this.level));
    const d = duel(seed % OPENINGS.length, seed % 2 === 0, sims, this.t, seed);
    const who = d.me === 1 ? 'Black' : 'White';
    const frames: Frame[] = [{ ...goFrame(d.g, `He is ${who}, against the ${sims}-play-out reference engine.`), every: 0.3 }];
    for (let i = 0; i < 220; i++) {
      const mover = d.g.side;
      const before = d.g.b.slice();
      const res = d.step();
      if (res != null) {
        const m = margin(d.g);
        frames.push({ ...goFrame(d.g, `${res === 1 ? 'He wins' : res === 0 ? 'The reference engine wins' : 'A draw'}: ${m > 0 ? 'Black' : 'White'} by ${Math.abs(m)} (area, komi ${KOMI}).`), every: 0.3 });
        break;
      }
      let placed = -1;
      for (let k = 0; k < before.length; k++) if (before[k] === 0 && d.g.b[k] === mover) placed = outer(d.g, k);
      frames.push({ ...goFrame(d.g, `${mover === d.me ? 'He' : 'Reference'} ${placed >= 0 ? `plays ${ptName(d.g, placed)}` : 'passes'}.`, placed >= 0 ? { [placed]: 'new' } : {}), every: 0.3 });
    }
    return frames;
  }
  move(state: number[]) {
    const g = goFrom(state);
    if (over(g)) return -2;
    const m = search(g, Math.max(64, Math.min(200, playoutsFor(this.level))), this.t, this.r);
    return m < 0 ? -1 : outer(g, m);
  }
}

// ---- problems --------------------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const set = puzzles();
  const k = L <= 3 ? 1 : L <= 7 ? 2 : 3;
  const pool = set.filter((p) => p.n === k);
  const p = (pool.length ? pool : set)[Math.floor(rng(seed * 7727 + L)() * (pool.length || set.length))]!;
  const text = `${goText(p.g)}\nBlack to play and capture the White group that includes ${ptName(p.g, outer(p.g, p.target))} within ${p.n} Black move${p.n > 1 ? 's' : ''}, whatever White does. Which point should Black play first (e.g. "C3")?`;
  return { game: 'go', level: L, seed, text, data: { n: p.g.n, best: p.best, names: p.best.map((x) => ptName(p.g, x)) } };
}

/** Read a point like "C3" (columns skip I) from the last line. */
export function readPoint(n: number, answer: string): number {
  const toks = finalLine(answer).toUpperCase().match(/\b[A-HJ-T]\s?\d{1,2}\b/g) ?? [];
  const t = toks[toks.length - 1];
  if (!t) return -1;
  const col = 'ABCDEFGHJKLMNOPQRST'.indexOf(t[0]!);
  const row = Number(t.slice(1).trim());
  if (col < 0 || col >= n || row < 1 || row > n) return -1;
  return (n - row) * n + col;
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { n: number; best: number[]; names: string[] };
  const pt = readPoint(d.n, answer);
  const ok = d.best.includes(pt);
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'It captures by force.' : `A move that captures by force: ${d.names.join(' or ')}.` };
}

/** Actions: points 0–80, 81 = pass. Reward at the end: +1 to the winner. */
class GoEnv implements Env {
  g = newGo(9);
  reset() {
    this.g = newGo(9);
  }
  actions() {
    if (over(this.g)) return [];
    return [...candidates(this.g).filter((i) => i >= 0).map((i) => outer(this.g, i)), 81];
  }
  step(a: number) {
    const mover = this.g.side;
    if (a === 81) pass(this.g);
    else if (!playAt(this.g, inner(this.g, a))) return { reward: -1, done: false };
    if (over(this.g)) {
      const m = margin(this.g);
      return { reward: m === 0 ? 0 : (m > 0) === (mover === 1) ? 1 : -1, done: true };
    }
    return { reward: 0, done: false };
  }
  describe() {
    return goText(this.g);
  }
}

export const go: Game = {
  ...GO,
  env: () => new GoEnv(),
  generate,
  check,
  learner: (level, seed, saved) => new GoLearner(level, seed, saved),
};

