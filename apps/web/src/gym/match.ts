/**
 * Matches against fixed reference engines (checkers, chess, Go), played a slice at a time. A whole match
 * takes seconds to minutes of search, far longer than the worker may stop for (~200 ms), so a learner's
 * measure() plays the match on in short slices and reports the LAST FINISHED match; the next match starts
 * with a frozen copy of what he knows then (so each match measures one fixed player). Untrained, before
 * any match has finished, mastery is 0 ("the first match is under way").
 *
 * Each opening is played twice, once with him moving first and once second, so neither side gets the
 * better half of the openings.
 */

/** One game being played: step() makes one move; it returns his result when the game is over (1 win, 0.5 draw, 0 loss), else null. */
export interface Stepper {
  step(): number | null;
}

export interface MatchResult {
  score: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
}

let slice = 120;
/** How long one measure() may play for (ms). Tests set Infinity to play a whole match at once. */
export function setSlice(ms: number): void {
  slice = ms;
}
export const sliceMs = () => slice;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Match {
  i = 0;
  cur: Stepper | null = null;
  res: MatchResult = { score: 0, games: 0, wins: 0, draws: 0, losses: 0 };
  /**
   * @param games  how many games (an even number: each opening both ways)
   * @param start  a new game: opening `opening`, he moves first if `first`
   */
  constructor(
    public games: number,
    private start: (opening: number, first: boolean) => Stepper,
  ) {}
  get done() {
    return this.i >= this.games;
  }
  /** Play on for up to `ms` (or to the end). Returns true when the match is over. */
  run(ms = slice): boolean {
    const t0 = now();
    while (!this.done) {
      this.cur ??= this.start(this.i >> 1, this.i % 2 === 0);
      const r = this.cur.step();
      if (r != null) {
        this.res.games++;
        this.res.score += r;
        if (r === 1) this.res.wins++;
        else if (r === 0) this.res.losses++;
        else this.res.draws++;
        this.cur = null;
        this.i++;
      }
      if (now() - t0 > ms) break;
    }
    return this.done;
  }
}

/** His share of the points (0–1). */
export const share = (r: MatchResult) => (r.games ? r.score / r.games : 0);

/** A performance rating from a match score against an opponent rated `opp` (Elo's formula, score clamped to 2–98%). */
export function perfRating(score: number, opp: number): number {
  const s = Math.max(0.02, Math.min(0.98, score));
  return Math.round(opp + 400 * Math.log10(s / (1 - s)));
}

export const record = (r: MatchResult) => `${r.wins} won, ${r.draws} drawn, ${r.losses} lost`;
