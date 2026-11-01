/**
 * THE CHECK AFTER A GAME, and the hint during one, in plain words (BRIEF-REST-B part 1). The engine (Stockfish, at full
 * strength for a moment on each position) scores every position of the game for the side to move; a move's cost is how much
 * that score fell between the position before it and the position after it, seen from the one who moved. Pure: the scores come
 * in, the words go out. The engine and the page are chessengine.ts and features/gym/chessrated.ts.
 */
import { toCp } from './chessuci';

/** The engine's score for one position, for the side to move there. */
export interface Score {
  cp?: number | null;
  mate?: number | null;
}

export type Kind = 'blunder' | 'mistake' | 'slip' | 'fine';

/** One move of the game, judged. */
export interface Moment {
  /** 1-based ply, and the move number as chess writes it ("23" for White, "23…" for Black). */
  ply: number;
  number: string;
  san: string;
  white: boolean;
  /** What the move cost the one who played it, in centipawns (0 when it was the best or near it). */
  loss: number;
  kind: Kind;
  /** "lost a rook", "missed a mate in 2"… ('' for a fine move). */
  words: string;
}

/** A cost in centipawns as what it would have taken off the board. */
export function lostWords(loss: number): string {
  return loss >= 900 ? 'lost a queen' : loss >= 450 ? 'lost a rook' : loss >= 250 ? 'lost a piece' : loss >= 120 ? 'lost a pawn' : loss >= 60 ? 'gave up some ground' : '';
}

const kindOf = (loss: number): Kind => (loss >= 250 ? 'blunder' : loss >= 120 ? 'mistake' : loss >= 60 ? 'slip' : 'fine');

/**
 * The moments of a game. `sans` are the moves in order; `scores` the engine's score of the position before each of them and
 * of the final position (one more than there are moves). The final position of a checkmate has no best move, so its score is
 * given as a mate of 0 (the side to move has lost).
 */
export function reviewGame(sans: string[], scores: Score[]): Moment[] {
  const out: Moment[] = [];
  for (let i = 0; i < sans.length; i++) {
    const a = scores[i];
    const b = scores[i + 1];
    if (!a || !b) continue;
    const white = i % 2 === 0;
    const before = toCp(a);
    const after = -toCp(b);
    const loss = Math.max(0, before - after);
    let words = lostWords(loss);
    // a mate the mover had and let go, or one he walked into, is said as a mate
    if (typeof a.mate === 'number' && a.mate > 0 && !(typeof b.mate === 'number' && b.mate < 0)) words = `missed a mate in ${a.mate}`;
    else if (typeof b.mate === 'number' && b.mate > 0 && !(typeof a.mate === 'number' && a.mate < 0)) words = `allowed a mate in ${b.mate}`;
    else if (before >= 300 && after <= 50 && loss >= 250) words = 'threw away a winning position';
    out.push({ ply: i + 1, number: `${Math.floor(i / 2) + 1}${white ? '' : '…'}`, san: sans[i]!, white, loss, kind: words && loss < 60 ? 'slip' : kindOf(loss), words });
  }
  return out;
}

/** "Move 23 (Nxe5) lost a rook." */
export const momentLine = (m: Moment): string => `Move ${m.number} (${m.san}) ${m.words}.`;

/**
 * What to tell him after the game: the worst of his moves (and Ghosty's own, if it was a game of his), in plain words. `mine`
 * says which side he played (true: White).
 */
export function reviewWords(moments: Moment[], mine: boolean): { lines: string[]; summary: string } {
  const his = moments.filter((m) => m.white === mine);
  const bad = his.filter((m) => m.kind !== 'fine' && m.words).sort((a, b) => b.loss - a.loss);
  const lines = bad.slice(0, 3).sort((a, b) => a.ply - b.ply).map(momentLine);
  const n = his.length;
  const summary = !n
    ? 'There were no moves to check.'
    : !bad.length
      ? `You played ${n} moves and none of them cost you anything the engine could see. A clean game.`
      : `You played ${n} moves; ${bad.length} cost you something. The worst: move ${bad[0]!.number} (${bad[0]!.san}) ${bad[0]!.words}.`;
  return { lines, summary };
}

/** "Try Nf3, which keeps you about a pawn up." (the hint: the engine's best move in words, and where it leaves him). */
export function hintWords(san: string, score: Score): string {
  if (typeof score.mate === 'number' && score.mate > 0) return `Try ${san}: it leads to a forced mate in ${score.mate}.`;
  if (typeof score.mate === 'number' && score.mate < 0) return `Try ${san}: it is the best defence, though the engine sees a mate against you in ${-score.mate}.`;
  const cp = toCp(score);
  const a = Math.abs(cp);
  const size = a >= 900 ? 'a queen' : a >= 450 ? 'a rook' : a >= 250 ? 'a piece' : a >= 100 ? 'about a pawn' : '';
  return `Try ${san}: ${!size ? 'it keeps the position about level' : cp > 0 ? `it keeps you ${size} ahead` : `it limits you to being ${size} behind`}.`;
}

/** Where the game stands, in words, for a quick look: "you are about a pawn ahead". */
export function standingWords(score: Score): string {
  if (typeof score.mate === 'number') return score.mate > 0 ? `you have a forced mate in ${score.mate}` : `the engine has a forced mate in ${-score.mate}`;
  const cp = toCp(score);
  const a = Math.abs(cp);
  if (a < 60) return 'the game is about level';
  const size = a >= 900 ? 'a queen' : a >= 450 ? 'a rook' : a >= 250 ? 'a piece' : 'about a pawn';
  return cp > 0 ? `you are ${size} ahead` : `you are ${size} behind`;
}
