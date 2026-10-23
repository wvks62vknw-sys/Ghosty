/**
 * One game's training record and the session that moves it on: train a little, measure against the
 * ground truth now and then, and when the mastery bar is passed, make the next level (keeping what the
 * learner can carry over). Pure — the Web Worker (worker.ts) drives it with a clock; tests drive it
 * directly. The record is what the phone keeps in IndexedDB (features/gym/store.ts).
 */
import { type Game, type Learner, LEVELS, type Report } from './core';
import type { GameMeta } from './meta';

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
}

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
    return { ...this.rec, saved: this.learner.save(), updated: Date.now() };
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
  return `${passed} · ${carry ? 'on to' : 'he waits for you at'} level ${n.to + 1}`;
}
