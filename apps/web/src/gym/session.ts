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
  /** Mastery when this level began ("61% → 88%"). */
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
  /** Measure against the ground truth; past the bar, the next level is made. */
  measure(): 'level' | 'mastered' | null {
    const r = this.learner.measure();
    this.note(r);
    if (r.mastery + 1e-9 < this.game.bar(this.rec.level)) return null;
    if (this.rec.level >= LEVELS) {
      this.rec.mastered = true;
      return 'mastered';
    }
    this.rec.level++;
    this.learner = this.game.learner(this.rec.level, this.rec.seed, this.learner.save());
    const r2 = this.learner.measure();
    this.note(r2);
    this.rec.start = r2.mastery;
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
  const move = `${pc(rec.start)} → ${pc(rec.mastery)}`;
  return training ? `Learning… ${n(rec.units)} ${game.unit} · Level ${rec.level} · mastery ${move}` : `Paused · ${n(rec.units)} ${game.unit} · Level ${rec.level} · mastery ${move}`;
}
