/**
 * His move against the owner in Connect 4, with everything he has, whatever his level: what he has solved
 * and been taught (the book), then the exact solver (c4solve.ts) for as long as the move's time allows, then —
 * for what it cannot settle in that time — a search a fixed number of moves ahead (proved wins and losses,
 * threat parity at its leaves) to rule out every move that loses by force, and the learned network's tree
 * search (connect4.ts) to choose among the moves left that the search finds equally good. Every move comes
 * with one line saying why, in his words, kept for the review after the game.
 *
 * Worker only. Time: `ms` (about 1.5 s on the phone) or, for tests that must give the same answer on any
 * machine, a node count.
 */
import { COLS, copyPos, legal, posFromBoard, ROWS, type Pos } from './c4board';
import { bitsOf, type Bits, parity, playB, scoreMoves, searchAhead, solveBits, threatSquares, WIN, winsB } from './c4solve';

/** The move's time on the phone (the search stops at it; a position the solver settles returns sooner). */
export const MOVE_MS = 1500;

export type MoveKind = 'win' | 'block' | 'lost' | 'book' | 'lesson' | 'solved' | 'search';

export interface Choice {
  move: number;
  /** One line in his words: why this move. */
  reason: string;
  kind: MoveKind;
  /** Proved: 1 he wins, 0 a draw, −1 the owner can force a win; null not proved. */
  value: number | null;
  /** How far the search looked (moves), when it decided. */
  depth?: number;
  ms: number;
}

/** What the net and its tree search bring (passed in, so this file does not import the learner). */
export interface Instinct {
  /** The network's tree search restricted to `allowed`, until the time given; visit counts per column out. */
  mcts(p: Pos, allowed: number[], until: number, sims: number, visits: number[]): number;
}

/** A book entry: each column's proved result for the side to move ('W', 'D', 'L', '.' not playable), and where it came from. */
export interface BookHit {
  values: string;
  lesson: boolean;
}

const col = (c: number) => `column ${c + 1}`;
const cols = (cs: number[]) => (cs.length === 1 ? col(cs[0]!) : `columns ${cs.slice(0, -1).map((c) => c + 1).join(', ')} and ${cs.at(-1)! + 1}`);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The columns where the side NOT to move would make four if it could play there now. */
function threatsNow(board: number[], b: Bits): number[] {
  const opp = b.n % 2 === 0 ? 2 : 1;
  const sq = threatSquares(board, opp);
  const h = heights(board);
  return [...new Set(sq.filter((s) => s % ROWS === h[Math.floor(s / ROWS)]).map((s) => Math.floor(s / ROWS)))];
}
const heights = (board: number[]) => Array.from({ length: COLS }, (_, c) => {
  let r = 0;
  while (r < ROWS && board[c * ROWS + r]) r++;
  return r;
});

/** The board's left–right mirror (the book keeps one entry for both). */
export const mirror = (board: ArrayLike<number>) => Array.from({ length: COLS * ROWS }, (_, s) => board[(COLS - 1 - Math.floor(s / ROWS)) * ROWS + (s % ROWS)]!);
/** The book's key for a position: the smaller of its own and its mirror's digits, and whether the mirror was used. */
export function bookKey(board: ArrayLike<number>): { key: string; flipped: boolean } {
  const a = Array.from(board).join('');
  const b = mirror(board).join('');
  return a <= b ? { key: a, flipped: false } : { key: b, flipped: true };
}
export const flipValues = (v: string) => [...v].reverse().join('');

/**
 * His move. `book` looks a position up in what he has solved or been taught; `w` is never needed here (the
 * instinct carries it). Limits: `ms` of thinking, or `nodes` (the same answer on every machine).
 */
export function fullMove(board: number[], instinct: Instinct, opts: { ms?: number; nodes?: number; book?: (key: string) => BookHit | null } = {}): Choice {
  const t0 = now();
  const ms = opts.ms ?? MOVE_MS;
  const p = posFromBoard(board);
  const b = bitsOf(board);
  const moves = legal(p);
  const done = (move: number, kind: MoveKind, reason: string, value: number | null, depth?: number): Choice => ({ move, kind, reason, value, depth, ms: Math.round(now() - t0) });
  if (!moves.length) return done(-1, 'lost', '', null);
  // 1. Four now.
  for (const c of moves) if (winsB(b, c)) return done(c, 'win', 'Four in a row.', 1);
  // 2. His threats: one must be stopped; two cannot both be.
  const threats = threatsNow(board, b);
  if (threats.length >= 2) return done(threats[0]!, 'lost', `You have two threats, ${cols(threats)}. I can only stop one.`, -1);
  if (threats.length === 1) {
    // (the block may itself be the losing move: the reason still says why it had to be played)
    return done(threats[0]!, 'block', `I had to stop ${col(threats[0]!)}.`, null);
  }
  // 3. What he has solved or been taught.
  const bk = opts.book ? bookKey(board) : null;
  const hit = bk ? opts.book!(bk.key) : null;
  // (a lesson may know only which columns lose: '?' for the rest, which the search then judges)
  const taught: number[] = [];
  if (hit) {
    const v = bk!.flipped ? flipValues(hit.values) : hit.values;
    const rank = (ch: string) => (ch === 'W' ? 2 : ch === 'D' ? 1 : ch === 'L' ? 0 : -1);
    const top = Math.max(...moves.map((c) => rank(v[c] ?? '.')));
    const best = moves.filter((c) => rank(v[c] ?? '.') === top);
    if (v.includes('?') && top < 2) {
      for (const c of moves) if (v[c] === 'L') taught.push(c);
    } else if (top >= 0 && best.length) {
      const c = best[0]!;
      const value = top - 1;
      const what = value === 1 ? 'it wins' : value === 0 ? 'it holds the draw' : 'nothing better is left';
      return done(c, hit.lesson ? 'lesson' : 'book', hit.lesson ? `You taught me this position. ${niceCol(c)}: ${what}.` : `I solved this position while you were away. ${niceCol(c)}: ${what}.`, value);
    }
  }
  // 4. The exact solver, for a third of the time (win / draw / loss for every column).
  const share = (f: number) => (opts.nodes != null ? { nodes: Math.round(opts.nodes * f) } : { until: t0 + ms * f });
  const exact = scoreMoves(b, share(0.3), true);
  for (const c of taught) exact[c] ??= -1;
  if (moves.every((c) => exact[c] != null)) return settled(b, p, moves, exact, instinct, opts.nodes != null, ms, done);
  // 5. Not settled in time: look a fixed number of moves ahead (deepening), proved results first.
  const ahead = searchAhead(b, parity, opts.nodes != null ? { nodes: Math.round(opts.nodes * 0.25) } : { until: t0 + ms * 0.55 });
  const lost = new Set(moves.filter((c) => exact[c] === -1 || (ahead.values[c] != null && ahead.values[c]! < -WIN)));
  const won = moves.filter((c) => exact[c] === 1 || (ahead.values[c] != null && ahead.values[c]! > WIN));
  if (won.length) return done(won[0]!, 'solved', `${niceCol(won[0]!)} wins by force.`, 1, ahead.depth);
  if (lost.size === moves.length) {
    const c = moves.reduce((a, x) => ((ahead.values[x] ?? -Infinity) > (ahead.values[a] ?? -Infinity) ? x : a), moves[0]!);
    return done(c, 'solved', 'You can force a win from here. I\'ve made it as hard as I can.', -1, ahead.depth);
  }
  // Draws proved by the solver are as good as the search's even judgements; otherwise its values decide.
  const val = (c: number) => (exact[c] === 0 ? 0 : ahead.values[c] ?? -WIN);
  const safe = moves.filter((c) => !lost.has(c)).sort((x, y) => val(y) - val(x));
  const top = val(safe[0]!);
  const near = safe.filter((c) => val(c) >= top - 25);
  // 6. His instinct (the network's tree search) chooses among the equally good; the rest in the search's order.
  const visits = new Array(COLS).fill(0);
  // (on a node budget: a fixed number of simulations, so the move is the same on any machine)
  const pick = near.length > 1 ? instinct.mcts(copyPos(p), near, opts.nodes != null ? 0 : t0 + ms * 0.7, opts.nodes != null ? 800 : 200, visits) : near[0]!;
  const ranked = [pick, ...near.filter((c) => c !== pick).sort((x, y) => visits[y]! - visits[x]!), ...safe.filter((c) => !near.includes(c))];
  // 7. The rest of the time proves the choice: a candidate the solver shows to lose is dropped for the next.
  const proofLim = share(1);
  let c = -1;
  let proved: number | null = null;
  for (const x of ranked) {
    const v = exact[x] ?? solveOne(b, x, proofLim);
    if (v === -1) {
      lost.add(x);
      continue;
    }
    if (c < 0) {
      c = x;
      proved = v;
      // a proved draw is kept, but the time left still looks for a proved win among the rest
      if (v !== 0) break;
    } else if (v === 1) {
      c = x;
      proved = 1;
      break;
    }
  }
  if (c < 0) return done(ranked[0]!, 'solved', 'You can force a win from here. I\'ve made it as hard as I can.', -1, ahead.depth);
  const depth = ahead.depth;
  const lostList = moves.filter((x) => lost.has(x));
  const reason = proved === 1
    ? `${niceCol(c)} wins by force.`
    : taught.length
      ? `You taught me this position: ${cols(taught)} ${taught.length > 1 ? 'lose' : 'loses'}.`
      : lostList.length
      ? `${cap(cols(lostList))} ${lostList.length > 1 ? 'lose' : 'loses'} by force. ${proved === 0 ? `${niceCol(c)} holds.` : 'I kept clear.'}`
      : proved === 0
        ? `Solved: ${col(c)} holds the draw.`
        : near.length > 1
          ? `Nothing loses within ${depth} moves. My instinct chose ${col(c)}.`
          : `Looked ${depth} moves ahead: ${col(c)} is the strongest.`;
  return done(c, taught.length ? 'lesson' : proved == null ? 'search' : 'solved', reason, proved, depth);
}

/** One column's exact result (1 / 0 / −1) within the limit, or null. */
function solveOne(b: Bits, c: number, lim: { nodes?: number; until?: number }): number | null {
  if (lim.until != null && now() >= lim.until) return null;
  const s = solveBits(playB(b, c), lim, true);
  return s == null ? null : -s || 0;
}

/** Every column proved: the best result; among equals the search ahead and his instinct choose (the quickest win, the longest loss). */
function settled(b: Bits, p: Pos, moves: number[], exact: (number | null)[], instinct: Instinct, fixed: boolean, ms: number, done: (move: number, kind: MoveKind, reason: string, value: number | null) => Choice): Choice {
  const top = Math.max(...moves.map((c) => exact[c]!));
  let best = moves.filter((c) => exact[c] === top);
  if (top !== 0 && best.length > 1) {
    // a win as soon as possible, a loss as late as possible: the exact scores, if there is time
    const strong = scoreMoves(b, fixed ? { nodes: 200_000 } : { until: now() + Math.min(300, ms * 0.2) });
    if (best.every((c) => strong[c] != null)) {
      const hi = Math.max(...best.map((c) => strong[c]!));
      best = best.filter((c) => strong[c] === hi);
    }
  }
  const pickLim = fixed ? { nodes: 100_000 } : { until: now() + Math.min(ms * 0.3, 400) };
  const c = best.length > 1 ? pickAmong(b, p, best, instinct, pickLim) : best[0]!;
  const reason = top > 0 ? `${niceCol(c)} wins by force.` : top === 0 ? `Solved: ${col(c)} holds the draw.` : `You can force a win from here. I've made it as hard as I can.`;
  return done(c, 'solved', reason, top);
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const niceCol = (c: number) => cap(col(c));

/** Several columns proved equal: the search ahead's judgement, then his instinct, choose. */
function pickAmong(b: Bits, p: Pos, best: number[], instinct: Instinct, lim: { nodes?: number; until?: number }): number {
  const ahead = searchAhead(b, parity, lim, 0, 12);
  const top = Math.max(...best.map((c) => ahead.values[c] ?? -Infinity));
  const near = best.filter((c) => (ahead.values[c] ?? -Infinity) >= top - 10);
  if (near.length <= 1) return near[0] ?? best[0]!;
  return instinct.mcts(copyPos(p), near, lim.until != null ? now() + 40 : 0, 300, new Array(COLS).fill(0));
}
