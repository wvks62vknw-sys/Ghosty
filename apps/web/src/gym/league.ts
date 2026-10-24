/**
 * League play against his past selves (GYM ideas, part 1): the games themselves. When he passes a level in
 * a board game, the version that passed plays each kept past self LEAGUE_GAMES games, a move at a time (so
 * the worker stays responsive: `LeagueRun.step(ms)` plays moves until its slice of time is used), and the
 * results go to gym/rating.ts's maths and decision. Both sides use the candidate's level (the same search
 * depth), so only what they have learned differs. Each game opens with two random moves from a seed (his
 * moves are deterministic: without them every game against the same self would be the same game), and each
 * opening is played twice, once with each colour, so its luck cancels out.
 *
 * Runs in the worker (it builds learners, so it is an engine file: the page never imports it).
 */
import { canPlay, play as c4Play, posFromBoard, winnerOf } from './c4board';
import { ckFrom, ckState, legalCk, playCk, resultCk, startCk } from './ckboard';
import { fromFen, fromPageMove, legal as chessLegal, make, pageMove, posFrom, posState, START, status } from './chessboard';
import { type Game, type Learner, rng } from './core';
import { goFrom, goState, inner, legalPoints, margin, newGo, outer, over, pass, playAt } from './goboard';
import { LEAGUE_GAMES, type Frozen, type Result } from './rating';
import { toMove, winner as tttWinner } from './tttboard';

/** A board as the league plays it: the moves allowed (in the learner's own move codes), a move, the result. */
export interface Arena {
  start(): number[];
  legal(s: number[]): number[];
  play(s: number[], m: number): number[];
  /** 0 still playing, 1 the first player won, 2 the second won, 3 a draw. */
  result(s: number[]): number;
  /** Plies before a game is called (a draw; Go is counted as it stands). */
  plies: number;
  /** A called game's result (default: a draw). */
  called?(s: number[]): number;
}

const goResult = (s: number[]) => {
  const m = margin(goFrom(s));
  return m > 0 ? 1 : m < 0 ? 2 : 3;
};

export const ARENAS: Record<string, Arena> = {
  tictactoe: {
    start: () => new Array(9).fill(0),
    legal: (s) => s.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0),
    play: (s, m) => {
      const b = s.slice();
      b[m] = toMove(b);
      return b;
    },
    result: (s) => tttWinner(s),
    plies: 9,
  },
  connect4: {
    start: () => new Array(42).fill(0),
    legal: (s) => {
      const p = posFromBoard(s);
      return [0, 1, 2, 3, 4, 5, 6].filter((c) => canPlay(p, c));
    },
    play: (s, m) => {
      const p = posFromBoard(s);
      c4Play(p, m);
      return Array.from(p.b);
    },
    result: (s) => winnerOf(posFromBoard(s)),
    plies: 42,
  },
  checkers: {
    start: () => ckState(startCk()),
    legal: (s) => legalCk(ckFrom(s)).map((_, i) => i),
    play: (s, m) => {
      const p = ckFrom(s);
      playCk(p, legalCk(p)[m]!);
      return ckState(p);
    },
    result: (s) => {
      const r = resultCk(ckFrom(s));
      return r === 0 ? 0 : r === 0.5 ? 3 : r === 1 ? 1 : 2;
    },
    plies: 200,
  },
  chess: {
    start: () => posState(fromFen(START)),
    legal: (s) => chessLegal(posFrom(s)).map(pageMove),
    play: (s, m) => {
      const p = posFrom(s);
      make(p, fromPageMove(p, m));
      return posState(p);
    },
    result: (s) => {
      const p = posFrom(s);
      const st = status(p);
      // Mate: the side to move has lost (White moves first).
      return !st ? 0 : st === 'mate' ? (p.side > 0 ? 2 : 1) : 3;
    },
    plies: 160,
  },
  go: {
    start: () => goState(newGo(9)),
    legal: (s) => {
      const g = goFrom(s);
      return [...legalPoints(g).map((i) => outer(g, i)), -1];
    },
    play: (s, m) => {
      const g = goFrom(s);
      if (m < 0 || !playAt(g, inner(g, m))) pass(g);
      return goState(g);
    },
    result: (s) => (over(goFrom(s)) ? goResult(s) : 0),
    plies: 200,
    called: goResult,
  },
};

/** The games a league is played in. */
export const LEAGUE_IDS = Object.keys(ARENAS);
export const hasLeague = (id: string): boolean => id in ARENAS;

/** One game between two learners: `first` moves first. 1 first won, 2 second won, 3 a draw. Opens with `open` random moves. */
export function playOne(a: Arena, first: Learner, second: Learner, seed: number, open = 2): number {
  const g = new LeagueGame(a, first, second, seed, open);
  while (!g.done) g.ply();
  return g.result;
}

class LeagueGame {
  s: number[];
  n = 0;
  result = 0;
  r: () => number;
  constructor(
    private a: Arena,
    private first: Learner,
    private second: Learner,
    seed: number,
    private open: number,
  ) {
    this.s = a.start();
    this.r = rng(seed);
  }
  get done() {
    return this.result !== 0;
  }
  ply() {
    const { a } = this;
    const legal = a.legal(this.s);
    let m: number;
    if (this.n < this.open) m = legal[Math.floor(this.r() * legal.length)]!;
    else {
      m = (this.n % 2 === 0 ? this.first : this.second).move?.(this.s.slice()) ?? -1;
      // A move he did not mean (none, or not allowed here): the first allowed one (in Go a pass is allowed).
      if (!legal.includes(m)) m = legal[0]!;
    }
    this.s = a.play(this.s, m);
    this.n++;
    this.result = a.result(this.s);
    if (!this.result && this.n >= a.plies) this.result = a.called?.(this.s) ?? 3;
  }
}

/**
 * The candidate's games against each kept past self: LEAGUE_GAMES each, colours alternating, played a move
 * at a time. `results()` gives the points per opponent once `done`.
 */
export class LeagueRun {
  private games: { opp: number; first: boolean; seed: number }[] = [];
  private i = 0;
  private cur: LeagueGame | null = null;
  private score: number[];
  private played: number[];
  private opps: Learner[];
  constructor(
    game: Game,
    private cand: Learner,
    private versions: Frozen[],
    level: number,
    seed: number,
    perSelf = LEAGUE_GAMES,
  ) {
    this.a = ARENAS[game.id]!;
    // His past selves, at his level now (the same search), each with what it knew when it was kept.
    this.opps = versions.map((v) => game.learner(level, seed, v.saved));
    versions.forEach((_, o) => {
      // In pairs: the same opening twice, once with each colour, so an opening's luck cancels out.
      for (let k = 0; k < perSelf; k++) this.games.push({ opp: o, first: k % 2 === 0, seed: (seed + 7919 * (o + 1) + 104729 * (k >> 1)) >>> 0 });
    });
    this.score = versions.map(() => 0);
    this.played = versions.map(() => 0);
  }
  private a: Arena;
  get done(): boolean {
    return this.i >= this.games.length;
  }
  get total(): number {
    return this.games.length;
  }
  get finished(): number {
    return this.i;
  }
  /** Play moves until `ms` have passed (at least one); true when every game is over. */
  step(ms: number, clock: () => number = () => Date.now()): boolean {
    const t0 = clock();
    while (!this.done) {
      const g = this.games[this.i]!;
      this.cur ??= g.first ? new LeagueGame(this.a, this.cand, this.opps[g.opp]!, g.seed, 2) : new LeagueGame(this.a, this.opps[g.opp]!, this.cand, g.seed, 2);
      this.cur.ply();
      if (this.cur.done) {
        const r = this.cur.result;
        // His points: a win 1, a draw ½.
        this.score[g.opp]! += r === 3 ? 0.5 : (r === 1) === g.first ? 1 : 0;
        this.played[g.opp]!++;
        this.cur = null;
        this.i++;
      }
      if (clock() - t0 >= ms) break;
    }
    return this.done;
  }
  results(): Result[] {
    return this.versions.map((v, o) => ({ opp: v.rating, games: this.played[o]!, score: this.score[o]! }));
  }
}
