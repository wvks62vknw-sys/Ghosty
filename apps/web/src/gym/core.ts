/**
 * The GYM's one interface. Every game is a small environment Ghosty plays (reset / actions / step /
 * describe), a problem maker for later language-model training (generate / check), and a learner that
 * improves by playing and is measured against ground truth it never sees while learning (a solver,
 * exhaustive search or a fixed benchmark) — never by what it says about itself.
 *
 * Everything here is pure: no DOM, no timers, seeded randomness only, so the same seed always plays the
 * same games (the edge tests run these in node; the phone runs them in a Web Worker, gym/worker.ts).
 */

/** What a move did. */
export interface StepResult {
  reward: number;
  done: boolean;
}

/** One playable game state machine. */
export interface Env {
  reset(seed: number): void;
  /** The moves allowed now (numbers; each game says what they mean). */
  actions(): number[];
  step(action: number): StepResult;
  /** The state in plain words (what a language model would read). */
  describe(): string;
}

/** A checkable reasoning problem made from a game. `text` is the whole question in words. */
export interface Problem {
  game: string;
  level: number;
  seed: number;
  text: string;
  data: unknown;
}

export interface Verdict {
  correct: boolean;
  /** 0–1: how good the answer is (1 = as good as the ground truth). */
  score: number;
  why: string;
}

/** A cell of a picture the interface draws (a grid of these, plus lines of text). */
export interface Cell {
  /** Text in the cell (a digit, a letter, an arrow). */
  t?: string;
  /** A colour token: 'wall' | 'mud' | 'gold' | 'me' | 'x' | 'o' | 'hit' | 'near' | 'miss' | 'dim' | 'path' | 'new' — or a CSS colour. */
  c?: string;
}

/** One picture of a game: a grid and/or lines of text, with a caption. */
export interface Frame {
  grid?: { w: number; h: number; cells: Cell[] };
  lines?: string[];
  /** Bars (label, share 0–1, text) — Colony's stores, Trust's population. */
  bars?: [string, number, string][];
  caption: string;
}

/** How the learner is doing, for the status line. */
export interface Report {
  /** 0–1 against the ground truth. */
  mastery: number;
  /** One plain sentence: what was measured and against what. */
  detail: string;
}

export interface Learner {
  /** Play/learn `n` more units (games, episodes, puzzles); returns how many were played. */
  train(n: number): number;
  /** Measure against the ground truth (may take a while: the worker calls it every few seconds). */
  measure(): Report;
  /** What can be kept in IndexedDB (structured-clonable: plain objects and typed arrays). */
  save(): unknown;
  /** A picture of what he knows now (the maze's value map, the colony's action shares…). */
  view(): Frame;
  /** One game played by his current policy, frame by frame (WATCH). `secret` = the owner's pick for PLAY HIM. */
  watch(seed: number, secret?: string): Frame[];
  /** His move in a position the owner is playing (PLAY HIM on a board), or -1. */
  move?(state: number[]): number;
}

export interface Game {
  id: string;
  title: string;
  /** A few words under the name on the card. */
  blurb: string;
  /** One sentence on what he is learning. */
  learns: string;
  /** What one training unit is called in the status line ("games", "puzzles", "runs"). */
  unit: string;
  /** Mastery needed to move up from `level` (1–10). */
  bar(level: number): number;
  env(level: number): Env;
  generate(level: number, seed: number): Problem;
  check(problem: Problem, answer: string): Verdict;
  learner(level: number, seed: number, saved?: unknown): Learner;
  /** PLAY HIM: 'board' (take turns on the board), 'secret' (you pick what he must find), or none. */
  play?: 'board' | 'secret';
}

export const LEVELS = 10;

/** Seeded random numbers (mulberry32): the same seed, the same games. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
export const randInt = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

export function shuffle<T>(r: () => number, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const pct = (x: number) => `${Math.round(x * 100)}%`;
/** The level clamped to 1–10. */
export const lvl = (level: number) => clamp(Math.round(level) || 1, 1, LEVELS);
/** Index of the largest value (first on ties). */
export function argmax(xs: ArrayLike<number>, from = 0, n = xs.length - from): number {
  let b = 0;
  for (let i = 1; i < n; i++) if (xs[from + i]! > xs[from + b]!) b = i;
  return b;
}

/** Saved state is only reused when it was made for this game at this level (and shape). */
export function savedFor<T>(saved: unknown, game: string, level?: number): T | null {
  const s = saved as { game?: string; level?: number } | null;
  if (!s || typeof s !== 'object' || s.game !== game) return null;
  if (level != null && s.level !== level) return null;
  return saved as T;
}
