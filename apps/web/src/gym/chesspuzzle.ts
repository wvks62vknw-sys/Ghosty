/**
 * CHESS PUZZLES, the pure parts (the APPS ROUND, chess): the position set up from the game's moves, his move checked against
 * the solution (a different move that mates counts too, as Lichess counts it), and his puzzle rating after each one (a plain
 * Elo step against the puzzle's own rating, said as "about"). No DOM, so the brain tests can run it.
 */
import { fromFen, legal, make, san, START, status, toFen as toFenOf, uci, type Pos } from './chessboard';

export interface Puzzle { id: string; rating: number; themes: string[]; moves: string[]; solution: string[] }

/** The move whose SAN is `s` in this position (checks, captures' marks and annotations aside), or -1. Pure. */
export function moveOfSan(p: Pos, s: string): number {
  const want = s.replace(/[+#!?]/g, '').replace(/=/, '');
  for (const m of legal(p)) if (san(p, m).replace(/[+#!?]/g, '').replace(/=/, '') === want) return m;
  return -1;
}
export const moveOfUci = (p: Pos, u: string): number => legal(p).find((m) => uci(m) === u) ?? -1;

/** The puzzle's position (his side to move), or null when a move doesn't fit. */
export function puzzleStart(z: Puzzle): Pos | null {
  const p = fromFen(START);
  for (const s of z.moves) {
    const m = moveOfSan(p, s);
    if (m < 0) return null;
    make(p, m);
  }
  return moveOfUci(p, z.solution[0] ?? '') >= 0 ? p : null;
}

/** His move at step k (k even: his turns): 'right' (and the puzzle goes on), 'solved', or 'wrong'. Mutates nothing. */
export function judge(p: Pos, z: Puzzle, k: number, m: number): 'right' | 'solved' | 'wrong' {
  const ok = uci(m) === z.solution[k];
  if (!ok) {
    // (a copy of the position through its FEN, so judging never moves the real board)
    const q = fromFen(toFenOf(p));
    make(q, m);
    return status(q) === 'mate' ? 'solved' : 'wrong';
  }
  return k + 1 >= z.solution.length ? 'solved' : 'right';
}

/** His puzzle rating after one: an Elo step (K 32 while new, 16 after 30 puzzles) against the puzzle's rating. Pure. */
export function puzzleRating(mine: number, theirs: number, solved: boolean, done: number): number {
  const k = done < 30 ? 32 : 16;
  const expect = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(mine + k * ((solved ? 1 : 0) - expect));
}

/** The theme names, said plainly ("mateIn2" → "mate in 2", "backRankMate" → "back rank mate"). Pure. */
export const themeWords = (t: string): string => t.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/(\d)/, ' $1').replace(/\s+/g, ' ').toLowerCase().trim();
