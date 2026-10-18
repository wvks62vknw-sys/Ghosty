/**
 * CHECKERS (English draughts). Ghosty's evaluator is small and learned: a value for a man and for a king on
 * each of the 32 squares (seen from the owner's side of the board), trained by temporal-difference learning
 * in self-play — each position's value is nudged towards the value of the position after his move, and
 * the last one towards the result. He plays with an alpha-beta search (captures searched to the end) and
 * that evaluator.
 *
 * Ground truth: a fixed ladder of reference engines — the SAME alpha-beta search at depths 1–8 with a
 * hand-written material + position evaluator (a man 100, a king 160, plus a little for advancing, the
 * centre and guarding the back row). At Level L he plays a match against the reference engine at the
 * same depth (Levels 9–10: depth 8 again, with a higher bar), so the only difference is what he has
 * learned about positions. Mastery = his match score (a win 1, a draw ½), from fixed openings played
 * both ways. His estimated rating is on Ghosty's own scale for this ladder (the depth-1 engine = 1000,
 * each step up measured by matches between the reference engines themselves).
 */
import { type Ck, type CkMove, ckFrame, ckFrom, ckState, ckText, copyCk, legalCk, moveText, NB, playCk, resultCk, rowOf, colOf, startCk } from './ckboard';
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, mentions, type Problem, rng, savedFor, type Verdict } from './core';
import { Match, type MatchResult, record, share, type Stepper } from './match';
import { CHECKERS } from './meta';

export * from './ckboard';
export { setSlice } from './match';

const WIN = 100_000;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---- the search -------------------------------------------------------------------------------------------------

/** An evaluator: the position's value for the side to move (any scale; bigger is better). */
export type CkEval = (p: Ck) => number;

interface Undo {
  pc: number;
  capsV: number[];
  q: number;
}
function make(p: Ck, m: CkMove): Undo {
  const u = { pc: p.b[m.path[0]!]!, capsV: m.caps.map((c) => p.b[c]!), q: p.quiet };
  playCk(p, m);
  return u;
}
function unmake(p: Ck, m: CkMove, u: Undo): void {
  p.b[m.path[m.path.length - 1]!] = 0;
  p.b[m.path[0]!] = u.pc;
  m.caps.forEach((c, i) => (p.b[c] = u.capsV[i]!));
  p.quiet = u.q;
  p.side = -p.side;
}

let lastNodes = 0;

/** Material for Black (a man 1, a king 1½) minus White's. */
export function materialCk(p: Ck): number {
  let s = 0;
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (x) s += (x > 0 ? 1 : -1) * (Math.abs(x) === 2 ? 1.5 : 1);
  }
  return s;
}
/**
 * A game that stalls — 40 moves each with no capture and no man moved, or the move limit in a match — is
 * scored by material, the way engine testers cut games short: 2 or more ahead (a man counts 1, a king 1½)
 * wins, anything closer is a draw. Returns Black's result 1 / ½ / 0.
 */
export const adjudicateCk = (p: Ck, lead = 2) => {
  const m = materialCk(p);
  return m >= lead ? 1 : m <= -lead ? 0 : 0.5;
};
/** A game's result for Black (1, ½, 0), or null while it goes on: no moves left loses; a stalled game or one past `limit` plies is scored by material. */
export function scoreCk(p: Ck, plies: number, limit: number, moves = legalCk(p), lead = 2): number | null {
  if (!moves.length) return p.side > 0 ? 0 : 1;
  if (p.quiet >= 80 || plies >= limit) return adjudicateCk(p, lead);
  return null;
}
/**
 * Negamax alpha-beta; at depth 0 a position with a capture to make is searched on (up to 8 plies more), so
 * no exchange is cut in half. A generator that pauses every 2,048 positions, so a deep search can run a
 * slice at a time.
 */
function* ab(p: Ck, depth: number, alpha: number, beta: number, ev: CkEval, ply: number, c: { nodes: number }): Generator<void, number, void> {
  if ((++c.nodes & 2047) === 0) yield;
  const moves = legalCk(p);
  if (!moves.length) return -WIN + ply;
  if (p.quiet >= 80) {
    // A stalled game is scored by material (see adjudicateCk).
    const r = adjudicateCk(p);
    return r === 0.5 ? 0 : (r === 1) === (p.side > 0) ? WIN / 2 : -WIN / 2;
  }
  if (depth <= 0 && (!moves[0]!.caps.length || depth <= -8)) return ev(p);
  if (moves.length > 1 && moves[0]!.caps.length) moves.sort((a, b) => b.caps.length - a.caps.length);
  let best = -Infinity;
  for (const m of moves) {
    const u = make(p, m);
    const v = -(yield* ab(p, depth - 1, -beta, -alpha, ev, ply + 1, c));
    unmake(p, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best move at `depth` with evaluator `ev`, as a search that can be paused (the first of equals, in the order moves are listed). */
export function* searchGen(p0: Ck, depth: number, ev: CkEval, moves = legalCk(p0)): Generator<void, { move: CkMove; value: number }, void> {
  const p = copyCk(p0);
  if (moves.length === 1) return { move: moves[0]!, value: 0 };
  const c = { nodes: 0 };
  let best = moves[0]!;
  let alpha = -Infinity;
  for (const m of moves) {
    const u = make(p, m);
    const v = -(yield* ab(p, depth - 1, -Infinity, -alpha, ev, 1, c));
    unmake(p, m, u);
    if (v > alpha) (alpha = v), (best = m);
  }
  lastNodes = c.nodes;
  return { move: best, value: alpha };
}
/** …run to the end at once. */
export function bestMove(p0: Ck, depth: number, ev: CkEval, moves = legalCk(p0)): { move: CkMove; value: number } {
  const it = searchGen(p0, depth, ev, moves);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
export const nodeCount = () => lastNodes;

// ---- the reference evaluator (hand-written) -----------------------------------------------------------------------

/**
 * Material and position, for the side to move: man 100, king 160; men gain 3 a row advanced and 8 on their
 * own back row; 4 for the centre. In the ending, the side ahead is paid for trading down and for bringing
 * its kings close to the other side's pieces (so a won ending gets finished instead of shuffled).
 */
export const referenceEval: CkEval = (p) => {
  let s = 0;
  let pieces = 0;
  const mat = materialCk(p);
  if (Math.abs(mat) >= 1) {
    const ahead = mat > 0 ? 1 : -1;
    for (let i = 0; i < 32; i++) if (p.b[i]) pieces++;
    let chase = (24 - pieces) * 6;
    for (let i = 0; i < 32; i++) {
      if (p.b[i] !== 2 * ahead) continue;
      let near = 14;
      for (let j = 0; j < 32; j++) if (p.b[j] && Math.sign(p.b[j]!) === -ahead) near = Math.min(near, Math.max(Math.abs(rowOf(i) - rowOf(j)), Math.abs(colOf(i) - colOf(j))));
      chase -= 3 * near;
    }
    s += ahead * chase;
  }
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const centre = r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 4 : 0;
    let v: number;
    if (Math.abs(x) === 2) v = 160 + centre;
    else {
      const adv = x > 0 ? r : 7 - r;
      v = 100 + 3 * adv + centre + (adv === 0 ? 8 : 0);
    }
    s += x > 0 ? v : -v;
  }
  return s * p.side;
};

// ---- the learned evaluator ----------------------------------------------------------------------------------------

/** 64 weights: a man on each square, then a king on each square, seen from the owner's side (White's squares mirrored). */
export const NW = 64;
const own = (i: number, x: number) => (x > 0 ? i : 31 - i) + (Math.abs(x) === 2 ? 32 : 0);

/** The raw learned value for the side to move. */
export function learnedRaw(w: Float32Array, p: Ck): number {
  let s = 0;
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    const v = w[own(i, x)]!;
    s += Math.sign(x) === p.side ? v : -v;
  }
  return s;
}
export const learnedEval = (w: Float32Array): CkEval => (p) => learnedRaw(w, p);

function tdUpdate(w: Float32Array, p: Ck, target: number, rate: number): void {
  const v = Math.tanh(learnedRaw(w, p));
  const g = rate * (target - v) * (1 - v * v);
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    w[own(i, x)]! += Math.sign(x) === p.side ? g : -g;
  }
}

// ---- matches against the reference ladder -----------------------------------------------------------------------

/** Fixed openings: four random moves from the start (the same list every time), each played both ways. */
export function openings(n: number): CkMove[][] {
  const out: CkMove[][] = [];
  const seen = new Set<string>();
  const r = rng(4242);
  while (out.length < n) {
    const p = startCk();
    const line: CkMove[] = [];
    for (let k = 0; k < 4; k++) {
      const ms = legalCk(p);
      const m = ms[Math.floor(r() * ms.length)]!;
      line.push(m);
      playCk(p, m);
    }
    const key = Array.from(p.b).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}
const OPEN = openings(8);
const MAX_PLIES = 160;
/**
 * Match games are cut at 30 moves each and scored by material then (a king 1½; ahead by `lead` wins):
 * short, decisive games, so a stronger player shows clearly in a few games.
 */
export const MATCH = { plies: 60, lead: 1 };

/** A rung of the ladder: how far he looks ahead, and the reference engine he plays (its depth, and how often it plays a random move instead). */
export interface Rung {
  me: number;
  ref: number;
  rand: number;
  /** Men the reference engine starts without (taken from its back rows after the opening): the odds it gives. */
  odds: number;
}
export const RUNGS: Rung[] = [
  { me: 4, ref: 4, rand: 0, odds: 3 },
  { me: 4, ref: 4, rand: 0, odds: 2 },
  { me: 4, ref: 4, rand: 0, odds: 1 },
  { me: 4, ref: 2, rand: 0, odds: 0 },
  { me: 4, ref: 4, rand: 0, odds: 0 },
  { me: 4, ref: 5, rand: 0, odds: 0 },
  { me: 3, ref: 4, rand: 0, odds: 0 },
  { me: 3, ref: 5, rand: 0, odds: 0 },
  { me: 2, ref: 4, rand: 0, odds: 0 },
  { me: 2, ref: 5, rand: 0, odds: 0 },
];
export const rungFor = (level: number) => RUNGS[lvl(level) - 1]!;
export const gamesFor = (_level: number) => 24;
const rungWords = (r: Rung) => `the reference engine looking ${r.ref} move${r.ref > 1 ? 's' : ''} ahead${r.odds ? `, starting ${r.odds} m${r.odds > 1 ? 'en' : 'an'} down` : ''}${r.rand ? ` (with ${Math.round(r.rand * 100)}% of its moves random)` : ''}; he looks ${r.me} ahead`;

/** One game: him (evaluator `mine`) against the reference engine of a rung. */
export function duel(opening: number, first: boolean, rung: Rung, mine: CkEval, seed = opening): Stepper & { p: Ck } {
  const p = startCk();
  for (const m of OPEN[opening % OPEN.length]!) playCk(p, m);
  // "First" = he plays the side to move after the opening.
  const me = first ? p.side : -p.side;
  // The odds: the reference's men nearest its own edge come off.
  for (let k = 0, left = rung.odds; left > 0 && k < 32; k++) {
    const sq = -me > 0 ? k : 31 - k;
    if (p.b[sq] === -me) (p.b[sq] = 0), left--;
  }
  const r = rng(7919 * (seed + 1) + (first ? 1 : 2));
  let plies = 0;
  let cur: Generator<void, { move: CkMove; value: number }, void> | null = null;
  return {
    p,
    // One step = a slice of one move's search (about two thousand positions), so the worker is never held up for long.
    step() {
      if (!cur) {
        const moves = legalCk(p);
        const res = scoreCk(p, plies, MATCH.plies, moves, MATCH.lead);
        if (res != null) return me > 0 ? res : 1 - res;
        plies++;
        if (p.side !== me && rung.rand && r() < rung.rand) {
          playCk(p, moves[Math.floor(r() * moves.length)]!);
          return null;
        }
        cur = searchGen(p, p.side === me ? rung.me : rung.ref, p.side === me ? mine : referenceEval, moves);
      }
      const x = cur.next();
      if (x.done) {
        playCk(p, x.value.move);
        cur = null;
      }
      return null;
    },
  };
}


// ---- the learner ---------------------------------------------------------------------------------------------------

/** TD step size. */
const RATE = 0.008;

interface CkSave {
  game: 'checkers';
  w: Float32Array;
  games: number;
  rand: number;
}

class CkLearner implements Learner {
  w: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // The evaluator carries over between levels.
    const s = savedFor<CkSave>(saved, 'checkers');
    this.w = s?.w?.length === NW ? s.w : new Float32Array(NW);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** His move in self-play: the best position one move ahead by his evaluator, now and then a random one. */
  private pick(p: Ck, moves: CkMove[]): CkMove {
    if (moves.length === 1) return moves[0]!;
    if (this.r() < 0.08) return moves[Math.floor(this.r() * moves.length)]!;
    let best = moves[0]!;
    let bv = -Infinity;
    for (const m of moves) {
      const u = make(p, m);
      const v = legalCk(p).length ? -learnedRaw(this.w, p) : WIN;
      unmake(p, m, u);
      if (v > bv) (bv = v), (best = m);
    }
    return best;
  }
  train(n: number) {
    // Whole games, as many as fit in ~30 ms (the worker asks again straight after).
    const t0 = clock();
    let k = 0;
    while (k < n && (k === 0 || clock() - t0 < 30)) {
      k++;
      const p = startCk();
      // A few random moves first, so he meets all kinds of positions.
      let opening = Math.floor(this.r() * 6);
      // Value of a result for the side to move: Black's result r seen by `side`.
      const forSide = (r: number, side: number) => (r === 0.5 ? 0 : (r === 1) === (side > 0) ? 1 : -1);
      // Big steps at first, smaller as he settles (otherwise the last games' luck swings his values about).
      const rate = RATE * Math.max(0.25, 1 / Math.sqrt(1 + this.games / 4000));
      for (let ply = 0; ; ply++) {
        const moves = legalCk(p);
        const res = scoreCk(p, ply, MAX_PLIES, moves);
        if (res != null) {
          tdUpdate(this.w, p, forSide(res, p.side), rate);
          break;
        }
        const m = opening-- > 0 ? moves[Math.floor(this.r() * moves.length)]! : this.pick(p, moves);
        const before = copyCk(p);
        playCk(p, m);
        const r2 = scoreCk(p, ply + 1, MAX_PLIES);
        // The value before the move should match minus the value after it (the other side to move then).
        const target = r2 != null ? forSide(r2, before.side) : -Math.tanh(learnedRaw(this.w, p));
        tdUpdate(this.w, before, target, rate);
      }
    }
    this.games += k;
    this.rand = (this.rand + k * 2654435761) >>> 0;
    return k;
  }
  measure() {
    const rung = rungFor(this.level);
    const n = gamesFor(this.level);
    if (!this.match) {
      const frozen = this.w.slice();
      this.match = new Match(n, (o, first) => duel(o, first, rung, learnedEval(frozen)));
    }
    if (this.match.run()) {
      this.last = this.match.res;
      this.match = null;
    }
    const pending = !!this.match;
    if (!this.last) {
      const played = this.match?.res.games ?? 0;
      return { mastery: 0, pending, detail: `His first match against ${rungWords(rung)} is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    return {
      mastery: s,
      pending,
      detail: `Against ${rungWords(rung)} (a hand-written material + position evaluator; games that stall are scored by material): ${record(this.last)} — ${Math.round(s * 100)}% of the points.`,
    };
  }
  save(): CkSave {
    return { game: 'checkers', w: this.w, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // What a man is worth on each square to him (Black's view), relative to his average man.
    const avg = this.w.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
    const king = this.w.slice(32).reduce((a, b) => a + b, 0) / 32;
    const p: Ck = { b: new Int8Array(32), side: 1, quiet: 0 };
    const f = ckFrame(p, `What a man is worth to him on each square (brighter = more). A king is worth ${avg > 0 ? (king / avg).toFixed(2) : '?'} men to him.`);
    const mx = Math.max(1e-9, ...Array.from(this.w.slice(0, 32), (x) => Math.abs(x - avg)));
    for (let i = 0; i < 32; i++) {
      const cell = rowOf(i) * 8 + colOf(i);
      const x = (this.w[i]! - avg) / mx;
      f.grid!.cells[cell] = { c: `hsl(${x >= 0 ? 190 : 350} 85% ${14 + Math.abs(x) * 36}%)` };
    }
    return f;
  }
  watch(seed: number): Frame[] {
    // He plays the reference engine (a shallower search than the match, so it is quick to show).
    // (Both look at most 3 moves ahead here, so the game is quick to show.)
    const full = rungFor(this.level);
    const rung = { me: Math.min(3, full.me), ref: Math.min(3, full.ref), rand: full.rand, odds: full.odds };
    const g = duel(seed % OPEN.length, seed % 2 === 0, rung, learnedEval(this.w), seed);
    const me = seed % 2 === 0 ? g.p.side : -g.p.side;
    const who = me === 1 ? 'Black (cyan)' : 'White (amber)';
    const frames: Frame[] = [{ ...ckFrame(g.p, `He is ${who}, against ${rungWords(rung)}.`), every: 0.35 }];
    for (let i = 0; i < 160; i++) {
      const before = Array.from(g.p.b);
      // A step is a slice of a search: step until the move is made (or the game ends).
      let r: number | null = null;
      for (const s0 = g.p.side; r == null && g.p.side === s0; ) r = g.step();
      if (r != null) {
        frames.push({ ...ckFrame(g.p, r === 1 ? 'He wins.' : r === 0 ? 'The reference engine wins.' : 'A draw.'), every: 0.35 });
        break;
      }
      const moved = before.map((x, k) => (x !== g.p.b[k] ? k : -1)).filter((k) => k >= 0 && g.p.b[k]);
      const marks: Record<number, string> = {};
      for (const k of moved) marks[k] = 'new';
      frames.push({ ...ckFrame(g.p, `${g.p.side === -me ? 'He' : 'Reference'} moved.`, marks), every: 0.35 });
    }
    return frames;
  }
  move(state: number[]) {
    const p = ckFrom(state);
    const moves = legalCk(p);
    if (resultCk(p, moves)) return -1;
    const m = bestMove(p, rungFor(this.level).me, learnedEval(this.w), moves).move;
    return moves.indexOf(m);
  }
}

// ---- problems: forced wins in small endgames (exact) ----------------------------------------------------------------

/** Does the side to move force a win within `plies` (no moves left for the other side)? Exhaustive. */
function forced(p: Ck, plies: number, cap: { n: number }): boolean {
  if (--cap.n < 0) throw new Error('budget');
  const moves = legalCk(p);
  if (!moves.length) return false;
  if (plies <= 0) return false;
  for (const m of moves) {
    const u = make(p, m);
    const replies = legalCk(p);
    let win = !replies.length;
    if (!win && plies >= 3) {
      win = true;
      for (const r of replies) {
        const u2 = make(p, r);
        const ok = forced(p, plies - 2, cap);
        unmake(p, r, u2);
        if (!ok) {
          win = false;
          break;
        }
      }
    }
    unmake(p, m, u);
    if (win) return true;
  }
  return false;
}

export const winIn = (level: number) => [1, 1, 2, 2, 2, 3, 3, 3, 4, 4][lvl(level) - 1]!;

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const N = winIn(L);
  const r = rng(seed * 92821 + L);
  for (;;) {
    const p: Ck = { b: new Int8Array(32), side: 1, quiet: 0 };
    const nb = 1 + Math.floor(r() * 3);
    const nw = 1 + Math.floor(r() * (N >= 3 ? 3 : 2));
    const put = (x: number) => {
      for (;;) {
        const i = Math.floor(r() * 32);
        if (p.b[i]) continue;
        // No man on its own crowning row.
        if (x === 1 && rowOf(i) === 7) continue;
        if (x === -1 && rowOf(i) === 0) continue;
        p.b[i] = x;
        return;
      }
    };
    for (let i = 0; i < nb; i++) put(r() < 0.5 ? 2 : 1);
    for (let i = 0; i < nw; i++) put(r() < 0.4 ? -2 : -1);
    const moves = legalCk(p);
    if (moves.length < 2 || !legalCk({ ...p, side: -1 }).length) continue;
    try {
      const cap = { n: 400_000 };
      // A win in exactly N of his moves, and only one first move that does it.
      if (N > 1 && forced(p, 2 * N - 3, cap)) continue;
      const winners = moves.filter((m) => {
        const q = copyCk(p);
        playCk(q, m);
        const rep = legalCk(q);
        if (!rep.length) return true;
        if (N === 1) return false;
        return rep.every((x) => {
          const q2 = copyCk(q);
          playCk(q2, x);
          return forced(q2, 2 * N - 3, cap);
        });
      });
      if (winners.length !== 1) continue;
      const m = winners[0]!;
      const text = `${ckText(p)}\nBlack to move and win in ${N} move${N > 1 ? 's' : ''} (White left with no pieces or no legal move), whatever White does. Give Black's first move, e.g. "9-14" or "9x18x27" for a capture.`;
      return { game: 'checkers', level: L, seed, text, data: { board: ckState(p), answer: moveText(m), path: m.path.map((s) => s + 1) } };
    } catch {
      continue;
    }
  }
}

/** The move a reply names: "9-14", "9x18x27", "9 to 14" (its whole path, or where it starts and ends); null if none, or if it names two different moves. */
export function readCkMove(p: Ck, answer: string): CkMove | null {
  const legal = legalCk(p);
  const named = new Set<CkMove>();
  for (const { m, negated } of mentions(finalLine(answer), /\b\d{1,2}(?:\s*(?:[-x×]|to)\s*\d{1,2})+\b/gi)) {
    if (negated) continue;
    const nums = (m[0].match(/\d+/g) ?? []).map(Number);
    const hits = legal.filter((mv) => {
      const path = mv.path.map((s) => s + 1);
      if (nums.length === path.length && nums.every((x, i) => x === path[i])) return true;
      return nums.length === 2 && nums[0] === path[0] && nums[1] === path[path.length - 1];
    });
    // Where it starts and ends must pick out one move.
    if (hits.length === 1) named.add(hits[0]!);
    else if (hits.length > 1) return null;
  }
  return named.size === 1 ? [...named][0]! : null;
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { board: number[]; answer: string; path: number[] };
  const m = readCkMove(ckFrom(d.board), answer);
  const ok = !!m && moveText(m) === d.answer;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'The winning move.' : `The winning move is ${d.answer}.` };
}

/** Actions are indices into the list of legal moves; reward +1 / −1 to the mover at the end. */
class CkEnv implements Env {
  p = startCk();
  reset() {
    this.p = startCk();
  }
  actions() {
    return resultCk(this.p) ? [] : legalCk(this.p).map((_, i) => i);
  }
  step(a: number) {
    const moves = legalCk(this.p);
    const m = moves[a];
    if (!m || resultCk(this.p, moves)) return { reward: -1, done: true };
    playCk(this.p, m);
    const res = resultCk(this.p);
    return { reward: res && res !== 0.5 ? 1 : 0, done: !!res };
  }
  describe() {
    return `${ckText(this.p)}\nLegal moves: ${legalCk(this.p).map(moveText).join(', ')}.`;
  }
}

export const checkers: Game = {
  ...CHECKERS,
  env: () => new CkEnv(),
  generate,
  check,
  learner: (level, seed, saved) => new CkLearner(level, seed, saved),
};

/** For the tests: the first legal moves of the start position and a perft-style count of positions `depth` moves on. */
export function countCk(p0: Ck, depth: number): number {
  if (!depth) return 1;
  let n = 0;
  const p = copyCk(p0);
  for (const m of legalCk(p)) {
    const u = make(p, m);
    n += countCk(p, depth - 1);
    unmake(p, m, u);
  }
  return n;
}
export { NB };
