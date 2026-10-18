/**
 * The GYM's one interface. Every game is a small environment Ghosty plays (reset / actions / step /
 * describe), a problem maker for later language-model training (generate / check), and a learner that
 * improves by playing and is measured against ground truth it never sees while learning (a solver,
 * exhaustive search or a fixed benchmark) — never by what it says about itself.
 *
 * Everything here is pure: no DOM, no timers, seeded randomness only, so the same seed always plays the
 * same games (the edge tests run these in node; the phone runs them in a Web Worker, gym/worker.ts).
 */
import type { GameMeta } from './meta';

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

/** A shape in a drawn picture (the cart and pole, the lander): coordinates in the drawing's own units, y down. */
export type Shape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; c: string }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; c: string; sw?: number }
  | { k: 'circle'; cx: number; cy: number; r: number; c: string }
  | { k: 'poly'; pts: number[]; c: string };

/** One picture of a game: a grid and/or lines of text, with a caption. */
export interface Frame {
  grid?: { w: number; h: number; cells: Cell[] };
  /** A drawing (w × h units) — used where a grid can't show the game (the cart and pole, the lander). */
  draw?: { w: number; h: number; shapes: Shape[] };
  /** Seconds this frame stays up in a WATCH (default 0.45). */
  every?: number;
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
  /** A measurement played in slices is under way (a match): the worker measures more often until it is done. */
  pending?: boolean;
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

/** A whole game: its page-side facts (meta.ts) plus the engine, the problem maker and the learner. */
export interface Game extends GameMeta {
  env(level: number): Env;
  generate(level: number, seed: number): Problem;
  check(problem: Problem, answer: string): Verdict;
  learner(level: number, seed: number, saved?: unknown): Learner;
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

// ---- reading an answer ------------------------------------------------------------------------------------

/** The final answer in a reply: its last non-empty line, a leading label ("Answer:", "Final route:") and markdown taken off. */
export function finalLine(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\*\*|__|`/g, ' ').replace(/^[#>\s]+/, '').trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? '').replace(/^[A-Za-z][A-Za-z ]{0,30}:\s*/, '').trim();
}

/** The last whole number in a piece of text (NaN if none). */
export function lastInt(text: string): number {
  const m = text.match(/-?\d+/g);
  return m ? Number(m[m.length - 1]) : NaN;
}

/**
 * Moves written as letters or words — "NNE", "N, E", "north, east" — as indices into `letters`. Words in
 * `words` (same order) count as their letter; a word made only of the letters counts letter by letter;
 * any other word (a label, "then") is ignored.
 */
export function readMoves(text: string, letters: string, words: string[]): number[] {
  const out: number[] = [];
  for (const t of text.toUpperCase().match(/[A-Z]+/g) ?? []) {
    const w = words.indexOf(t);
    if (w >= 0) out.push(w);
    else if ([...t].every((ch) => letters.includes(ch))) for (const ch of t) out.push(letters.indexOf(ch));
  }
  return out;
}

/**
 * Every match of `re` in `text` with whether it is negated ("not", "don't", "never", "avoid", "instead of"
 * in the few words just before it). Answer checkers use it to drop what a reply rules out and to refuse a
 * reply that still names two different answers ("Qe3 or Qb1#").
 */
export function mentions(text: string, re: RegExp): { m: RegExpExecArray; negated: boolean }[] {
  const out: { m: RegExpExecArray; negated: boolean }[] = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  for (let m = g.exec(text); m; m = g.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 24), m.index).toLowerCase();
    // Only the clause the mention is in counts (a full stop, colon, semicolon or "but" starts a new one).
    const clause = before.split(/[.;:!?]|\bbut\b/).pop() ?? '';
    out.push({ m, negated: /\b(not|no|never|avoid|instead of|rather than|n't|dont|don't|won't|doesn't|isn't)\b[^,]*$/.test(clause) });
    if (m[0] === '') g.lastIndex++;
  }
  return out;
}

/** Saved state is only reused when it was made for this game at this level (and shape). */
export function savedFor<T>(saved: unknown, game: string, level?: number): T | null {
  const s = saved as { game?: string; level?: number } | null;
  if (!s || typeof s !== 'object' || s.game !== game) return null;
  if (level != null && s.level !== level) return null;
  return saved as T;
}
