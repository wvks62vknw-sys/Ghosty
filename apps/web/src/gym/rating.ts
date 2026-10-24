/**
 * League play against his past selves (GYM ideas, part 1): the rating maths and the league's decisions.
 * Pure, and light (no engine): the page imports it for the rating line, the worker (gym/league.ts) for the
 * decisions.
 *
 * Every level he passes in a board game is a mastered version. The first one starts the league at
 * BASE_RATING. Every later one plays each past self LEAGUE_GAMES games (half with each colour); its rating
 * is the Elo performance rating those games give against the past selves' own ratings (the rating at which
 * the expected score equals the score he made). It is kept — frozen and added to the league, his rating now
 * — only if that rating is above the rating he has; otherwise it is thrown away (he goes back to the kept
 * version's knowledge) and the page says so. At most LEAGUE_CAP versions are kept per game (the oldest goes).
 */

/** Where the first version starts. */
export const BASE_RATING = 1000;
/** Versions kept per game. */
export const LEAGUE_CAP = 8;
/** Games against each past self per level-up: three openings, each played once with each colour. */
export const LEAGUE_GAMES = 6;
/** Ratings older than this many entries are dropped from the history (newest kept). */
const HISTORY = 60;
const WEEK = 7 * 86_400_000;

/** One kept version: the level it passed, when, its rating, what it takes on the phone, and its frozen knowledge. */
export interface Frozen {
  level: number;
  at: number;
  rating: number;
  bytes: number;
  /** The learner's saved state, copied when it was frozen (null in messages to the page: it stays in the worker and IndexedDB). */
  saved: unknown;
}

/** What one league decision said. */
export interface LeagueVerdict {
  at: number;
  /** The level he had just passed. */
  level: number;
  /** The new version's rating from its games, and the rating he had before. */
  rating: number;
  before: number;
  kept: boolean;
  /** Games played and points scored (a win 1, a draw ½). */
  games: number;
  score: number;
  why: string;
}

export interface League {
  versions: Frozen[];
  /** His rating now (the kept version's). */
  rating: number;
  /** His rating over time (one point per decision that changed it, and the first). */
  history: { at: number; r: number }[];
  /** The latest decisions, newest last (at most 12). */
  verdicts: LeagueVerdict[];
}

export const newLeague = (): League => ({ versions: [], rating: BASE_RATING, history: [], verdicts: [] });

/** Elo's expected score of a player rated `a` against one rated `b` (0–1). */
export const expected = (a: number, b: number): number => 1 / (1 + 10 ** ((b - a) / 400));

/** The games against one opponent: its rating, games played, points scored. */
export interface Result {
  opp: number;
  games: number;
  score: number;
}

/**
 * The performance rating of a run of games: the rating R at which the expected score against those opponents
 * equals the score made (found by halving the interval; it is monotone). A clean sweep or no points at all
 * has no such R: it is capped at 400 above the strongest / below the weakest opponent (the usual convention).
 */
export function performance(results: Result[]): number {
  const games = results.reduce((t, r) => t + r.games, 0);
  if (!games) return BASE_RATING;
  const score = results.reduce((t, r) => t + r.score, 0);
  const lo0 = Math.min(...results.map((r) => r.opp)) - 400;
  const hi0 = Math.max(...results.map((r) => r.opp)) + 400;
  if (score <= 0) return lo0;
  if (score >= games) return hi0;
  let lo = lo0;
  let hi = hi0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const e = results.reduce((t, r) => t + r.games * expected(mid, r.opp), 0);
    if (e < score) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The decision: a new version is kept only if its rating is above the one he has (by at least half a point). */
export function decide(before: number, rating: number): boolean {
  return rating >= before + 0.5;
}

const n0 = (x: number) => Math.round(x).toLocaleString('en-GB');

/**
 * The league after a new version's games: kept (frozen and added, the oldest dropped past the cap, his rating
 * now) or thrown away (the league as it was, the verdict saying why). Pure: returns a new league.
 */
export function admit(league: League, cand: Omit<Frozen, 'rating'>, results: Result[], at: number): { league: League; verdict: LeagueVerdict } {
  const games = results.reduce((t, r) => t + r.games, 0);
  const score = results.reduce((t, r) => t + r.score, 0);
  const first = !league.versions.length;
  const rating = first ? BASE_RATING : performance(results);
  const before = league.rating;
  const kept = first || decide(before, rating);
  const pts = `${score % 1 ? score.toFixed(1) : score} of ${games}`;
  const why = first
    ? `his first mastered version starts the league at ${n0(rating)}`
    : kept
      ? `it scored ${pts} against his ${league.versions.length} past self${league.versions.length > 1 ? 'ves' : ''}: rating ${n0(rating)}, up from ${n0(before)}`
      : `it scored ${pts} against his past selves: rating ${n0(rating)}, not above his ${n0(before)}, so it was thrown away`;
  const verdict: LeagueVerdict = { at, level: cand.level, rating: Math.round(rating), before: Math.round(before), kept, games, score, why };
  const verdicts = [...league.verdicts, verdict].slice(-12);
  if (!kept) return { league: { ...league, verdicts }, verdict };
  const versions = [...league.versions, { ...cand, rating: Math.round(rating) }].slice(-LEAGUE_CAP);
  const history = [...league.history, { at, r: Math.round(rating) }].slice(-HISTORY);
  return { league: { versions, rating: Math.round(rating), history, verdicts }, verdict };
}

/** How much his rating changed in the last week (0 with no history). */
export function weekChange(l: League | null | undefined, now: number): number {
  const h = l?.history ?? [];
  if (!h.length) return 0;
  // The rating he had a week ago: the last point at or before then; a league begun this week counts from its start.
  const then = [...h].reverse().find((p) => p.at <= now - WEEK) ?? h[0]!;
  return h.at(-1)!.r - then.r;
}

/** "Rating 1,240 · up 35 this week" ('' before the league has a version). */
export function ratingLine(l: League | null | undefined, now: number): string {
  if (!l?.versions.length) return '';
  const d = weekChange(l, now);
  return `Rating ${n0(l.rating)} · ${d > 0 ? `up ${n0(d)}` : d < 0 ? `down ${n0(-d)}` : 'no change'} this week`;
}

/** The bytes a saved learner takes (typed arrays at their size, numbers 8, text 2 a character). */
export function bytesOf(x: unknown, seen = new Set<unknown>()): number {
  if (x == null) return 0;
  if (typeof x === 'number') return 8;
  if (typeof x === 'boolean') return 4;
  if (typeof x === 'string') return 2 * x.length;
  if (ArrayBuffer.isView(x)) return x.byteLength;
  if (typeof x !== 'object' || seen.has(x)) return 0;
  seen.add(x);
  let n = 0;
  for (const v of Array.isArray(x) ? x : Object.values(x as Record<string, unknown>)) n += bytesOf(v, seen);
  return n;
}

/** "92 KB" / "1.4 MB". */
export const kb = (b: number): string => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

/** The league without the frozen knowledge (for messages to the page: the worker keeps it). */
export const leagueMeta = (l: League | undefined): League | undefined => l && { ...l, versions: l.versions.map((v) => ({ ...v, saved: null })) };

/** A progress message's league with the knowledge the page already holds put back (matched by when each was frozen). */
export function leagueKept(next: League | undefined, prev: League | undefined): League | undefined {
  if (!next) return next;
  return { ...next, versions: next.versions.map((v) => (v.saved != null ? v : { ...v, saved: prev?.versions.find((p) => p.at === v.at)?.saved ?? null })) };
}
