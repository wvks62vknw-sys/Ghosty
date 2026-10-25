/**
 * One game's training record and the session that moves it on: train a little, measure against the
 * ground truth now and then, and when the mastery bar is passed, make the next level (keeping what the
 * learner can carry over). Pure — the Web Worker (worker.ts) drives it with a clock; tests drive it
 * directly. The record is what the phone keeps in IndexedDB (features/gym/store.ts).
 */
import { type Game, type Learner, LEVELS, type Problem, type Report, type Verdict } from './core';
import type { GameMeta } from './meta';
import { type League, leagueMeta } from './rating';
import { EDGE_SPAN, edgeNext, type EdgeState, newEdge } from './stretch';

export interface Point {
  /** Units trained so far (all levels). */
  u: number;
  /** Mastery measured then (0–1). */
  m: number;
  l: number;
}

export interface GymRecord {
  id: string;
  level: number;
  units: number;
  mastery: number;
  /** Mastery when this level began ("61% → 88%"); −1 until the first measurement at a new level. */
  start: number;
  detail: string;
  history: Point[];
  mastered: boolean;
  seed: number;
  /** The learner's own state (typed arrays allowed: IndexedDB keeps them as they are). */
  saved: unknown;
  updated: number;
  /** League play (the board games): his kept past selves, his rating over time, the latest decisions (gym/rating.ts). */
  league?: League;
  /** Puzzles at the edge of what he can do (the maze, Sokoban, Sudoku: gym/stretch.ts). */
  edge?: EdgeState;
  /** One point a day (UTC day, units, level, mastery), the last DAYS: what he practised this week. */
  days?: DayPoint[];
}

export interface DayPoint {
  d: string;
  u: number;
  l: number;
  m: number;
  /** Puzzles tried and solved at his edge, in all (gym/stretch.ts). */
  t?: number;
  s?: number;
}

const DAYS = 15;

/** Today's point on a record's days (one a day; today's is replaced). Pure. */
export function noteDay(days: DayPoint[] | undefined, rec: Pick<GymRecord, 'units' | 'level' | 'mastery' | 'mastered' | 'edge'>, now: number): DayPoint[] {
  const d = new Date(now).toISOString().slice(0, 10);
  const p = { d, u: rec.units, l: rec.mastered ? 11 : rec.level, m: Math.round(rec.mastery * 1000) / 1000, t: rec.edge?.n ?? 0, s: rec.edge?.solved ?? 0 };
  return [...(days ?? []).filter((x) => x.d !== d), p].slice(-DAYS);
}

/**
 * A game's week for the REPORT CARD's LOOPS card: units played, levels passed, his rating a week ago and now,
 * the league's decisions (kept, thrown away and why) and his tries at his edge since then. "A week ago" is the
 * day's point at or before then, else the first point kept (a game first played this week counts from nothing).
 */
export function gymWeek(rec: GymRecord, name: string, now: number): { id: string; name: string; units: number; levels: number; rating?: [number, number]; kept: number; thrown: { level: number; why: string }[]; tries: number; solved: number } {
  const since = now - 7 * 86_400_000;
  const day = new Date(since).toISOString().slice(0, 10);
  const days = rec.days ?? [];
  const then = [...days].reverse().find((p) => p.d <= day);
  const start = then ?? { d: '', u: 0, l: 1, m: 0, t: 0, s: 0 };
  const lg = rec.league;
  const week = (lg?.verdicts ?? []).filter((v) => v.at >= since && v.games > 0);
  const ratingThen = lg?.history.length ? ([...lg.history].reverse().find((h) => h.at <= since) ?? lg.history[0]!).r : 0;
  return {
    id: rec.id,
    name,
    units: Math.max(0, rec.units - start.u),
    levels: Math.max(0, (rec.mastered ? 11 : rec.level) - start.l),
    ...(lg?.versions.length ? { rating: [ratingThen, lg.rating] as [number, number] } : {}),
    kept: week.filter((v) => v.kept).length,
    thrown: week.filter((v) => !v.kept).map((v) => ({ level: v.level, why: v.why })),
    tries: Math.max(0, (rec.edge?.n ?? 0) - (start.t ?? 0)),
    solved: Math.max(0, (rec.edge?.solved ?? 0) - (start.s ?? 0)),
  };
}

/** The record as the page is sent it: without the learner's state or his kept selves' knowledge. */
export const recMeta = (rec: GymRecord): GymRecord => ({ ...rec, saved: null, league: leagueMeta(rec.league) });

const HISTORY = 120;

export function newRecord(id: string): GymRecord {
  let seed = 7;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return { id, level: 1, units: 0, mastery: 0, start: 0, detail: '', history: [], mastered: false, seed, saved: null, updated: 0 };
}

export class Session {
  rec: GymRecord;
  learner: Learner;
  /** The last measurement is still under way (a match played in slices). */
  pending = false;
  constructor(
    public game: Game,
    rec?: GymRecord | null,
  ) {
    this.rec = rec && rec.id === game.id ? { ...rec, history: rec.history.slice() } : newRecord(game.id);
    this.learner = game.learner(this.rec.level, this.rec.seed, this.rec.saved);
    if (!this.rec.history.length) {
      const r = this.learner.measure();
      this.note(r);
      this.rec.start = r.mastery;
    }
  }
  private note(r: Report) {
    this.rec.mastery = r.mastery;
    this.rec.detail = r.detail;
    // A match played in slices reports every slice: only its finished score goes on the graph.
    if (r.pending && this.rec.history.length) return;
    const h = this.rec.history;
    h.push({ u: this.rec.units, m: r.mastery, l: this.rec.level });
    // Keep the graph small: when full, keep every other older point (the newest stay exact).
    if (h.length > HISTORY) this.rec.history = h.filter((_, i) => i % 2 === 0 || i > h.length - 20);
  }
  /** Train about n units; returns how many were played. */
  train(n: number): number {
    if (this.rec.mastered) return 0;
    const k = this.learner.train(n);
    this.rec.units += k;
    return k;
  }
  /**
   * Measure against the ground truth; past the bar, the next level is made. The new level is measured at
   * the next call (not straight away: one measurement per call keeps the worker responsive), and that
   * first measurement only says where he starts.
   */
  measure(): 'level' | 'mastered' | null {
    const r = this.learner.measure();
    this.pending = !!r.pending;
    this.note(r);
    if (this.rec.start < 0) {
      this.rec.start = r.mastery;
      return null;
    }
    if (r.mastery + 1e-9 < this.game.bar(this.rec.level)) return null;
    if (this.rec.level >= LEVELS) {
      this.rec.mastered = true;
      return 'mastered';
    }
    this.rec.level++;
    this.learner = this.game.learner(this.rec.level, this.rec.seed, this.learner.save());
    // Not measured at the new level yet.
    this.rec.start = -1;
    this.rec.mastery = 0;
    return 'level';
  }
  /** The record with the learner's state, to keep. */
  snapshot(): GymRecord {
    const now = Date.now();
    this.rec.days = noteDay(this.rec.days, this.rec, now);
    return { ...this.rec, saved: this.learner.save(), updated: now };
  }
  /** Back to a kept version's knowledge (a new version the league threw away): a copy, at the level he is on. */
  revert(saved: unknown): void {
    this.learner = this.game.learner(this.rec.level, this.rec.seed, structuredClone(saved));
  }
  /** Puzzles at his edge are made in this game (and he is still climbing). */
  get stretches(): boolean {
    return !this.rec.mastered && typeof this.learner.stretch === 'function';
  }
  /**
   * One puzzle at the edge of what he can do: made at his edge's difficulty, his answer checked by the game's own
   * check() (never the learner's say-so), the edge moved by the result. null when no puzzle could be made.
   */
  stretchTry(): { problem: Problem; answer: string; verdict: Verdict; x: number } | null {
    if (!this.stretches) return null;
    const e = this.rec.edge?.level === this.rec.level ? this.rec.edge : { ...newEdge(this.rec.level), n: this.rec.edge?.n ?? 0, solved: this.rec.edge?.solved ?? 0 };
    // Its own seeds (below the exam's, away from the ladder's test and practice sets).
    const seed = 400_000 + ((this.rec.seed + 7919 * (e.n + 1)) % 400_000);
    const t = this.learner.stretch!(e.x, seed);
    if (!t) return null;
    let verdict: Verdict;
    try {
      verdict = this.game.check(t.problem, t.answer);
    } catch (err) {
      verdict = { correct: false, score: 0, why: `the checker failed: ${String((err as Error)?.message ?? err).slice(0, 80)}` };
    }
    this.rec.edge = edgeNext(e, !!verdict.correct, this.rec.level, EDGE_SPAN[this.game.id] ?? 1);
    return { ...t, verdict, x: e.x };
  }
}

const n = (x: number) => Math.round(x).toLocaleString('en-GB');
const pc = (x: number) => `${Math.round(x * 100)}%`;

/** The plain status line on a game. */
export function statusLine(rec: GymRecord | null, game: GameMeta, training: boolean): string {
  if (!rec || (!rec.units && !training)) return `Not started · Level 1 · tap TRAIN to begin.`;
  if (rec.mastered) return `Mastered all ${LEVELS} levels · ${n(rec.units)} ${game.unit} · ${pc(rec.mastery)}`;
  const move = `${pc(Math.max(0, rec.start))} → ${pc(rec.mastery)}`;
  return training ? `Learning… ${n(rec.units)} ${game.unit} · Level ${rec.level} · mastery ${move}` : `Paused · ${n(rec.units)} ${game.unit} · Level ${rec.level} · mastery ${move}`;
}

/** Is a worker message about game `id` from its current epoch? (Messages from before a RESET are older and dropped.) */
export const current = (epochs: Record<string, number>, id: string, epoch: number | undefined): boolean => (epoch ?? 0) === (epochs[id] ?? 0);

// ======================= GYM part 3: he carries on by himself (TRAIN ALL; one toast for a run of level-ups)

/** TRAIN ALL gives each game this much training time a round, then the next game has its turn. */
export const ALL_BUDGET = 20 * 60_000;

/** TRAIN ALL's progress, kept with the GYM's settings (features/gym/store.ts) so a reload shows where it got to. */
export interface AllRun {
  /** Training time each game has had this round (ms). */
  spent: Record<string, number>;
  /** Training time in all, every round (ms). */
  total: number;
  /** The game it is training ('' before the first). */
  current: string;
  round: number;
}

export const newAllRun = (): AllRun => ({ spent: {}, total: 0, current: '', round: 1 });

type Standing = Pick<GymRecord, 'level' | 'mastery' | 'mastered'>;

/** How far a game has got, 0–10: the levels passed plus the mastery measured at the one under way. */
export const standing = (r: Standing | undefined): number => (!r ? 0 : r.mastered ? LEVELS : r.level - 1 + Math.max(0, Math.min(1, r.mastery)));

/**
 * TRAIN ALL's next game: of the games not mastered yet that still have time this round, the least
 * mastered (a tie goes to the GYM's own order). When every game left has had its time, a new round
 * starts (`newRound`: the page clears `spent`). null when every game is mastered.
 */
export function nextForAll(ids: string[], recs: ReadonlyMap<string, Standing>, spent: Record<string, number>, budget = ALL_BUDGET): { id: string; newRound: boolean } | null {
  const left = ids.filter((id) => !recs.get(id)?.mastered);
  if (!left.length) return null;
  const fresh = left.filter((id) => (spent[id] ?? 0) < budget);
  const pool = fresh.length ? fresh : left;
  let best = pool[0]!;
  for (const id of pool) if (standing(recs.get(id)) < standing(recs.get(best))) best = id;
  return { id: best, newRound: !fresh.length };
}

/** "1 h 12 min", "7 min", "under a minute". */
export function span(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'under a minute';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** TRAIN ALL's status line: "Training all · Sudoku level 6 · 3 of 22 games mastered · 1 h 12 min". */
export function allLine(run: AllRun | null, on: boolean, name: string, level: number, mastered: number, games: number): string {
  const tally = `${mastered} of ${games} games mastered`;
  if (mastered >= games) return `Every game mastered · ${tally}${run?.total ? ` · ${span(run.total)}` : ''}`;
  if (!run?.current) return `Trains every game in turn, the least learned first · ${tally}`;
  const where = `${name} level ${level} · ${tally} · ${span(run.total)}`;
  return on ? `Training all · ${where}` : `Stopped · ${where} · tap TRAIN ALL to carry on`;
}

/** The level-ups one toast tells of: one game, Levels `from`–`to` passed, the last at `at` (ms). */
export interface LevelNote {
  id: string;
  from: number;
  to: number;
  at: number;
  /** He passed Level 10: every level is mastered. */
  done: boolean;
}

/** Level-ups this close together (ms) share one toast. */
export const TOGETHER = 5000;

/**
 * One toast for a run of level-ups: Level `passed` of game `id`, at `at`. Straight after the last one
 * (the same game, the next level, within a few seconds) it joins that toast ("Levels 4–6 passed");
 * otherwise it starts a new one.
 */
export function joinLevels(prev: LevelNote | null, id: string, passed: number, at: number, done = false): LevelNote {
  if (prev && prev.id === id && !prev.done && passed === prev.to + 1 && at - prev.at <= TOGETHER) return { id, from: prev.from, to: passed, at, done };
  return { id, from: passed, to: passed, at, done };
}

/** The toast's words: "Level 4 passed · on to level 5", "Levels 4–6 passed · on to level 7", "Mastered every level". */
export function levelText(n: LevelNote, carry = true): string {
  const passed = n.from === n.to ? `Level ${n.to} passed` : `Levels ${n.from}–${n.to} passed`;
  if (n.done) return n.from === n.to ? 'Mastered every level' : `${passed} · Mastered every level`;
  return `${passed} · ${carry ? 'on to' : 'I wait for you at'} level ${n.to + 1}`;
}
