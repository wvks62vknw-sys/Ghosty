/**
 * NO CAP ON SKILL (OWNER-ISSUES 57 b: "there should be no such thing as him mastering a game because he should have no
 * limit of how good he can get"). Every game of this pass has a LEVEL for the player and one for Ghosty, kept the same way:
 * the level is `1 + floor(rating)`, the rating is a number with no ceiling, a PASS (the run reached the level's target)
 * raises it by one plus one more for each doubling of the target that was beaten, and a FAIL takes 0.8 back (never below
 * the first level), so every run is set at the edge of the one who plays it. What a level asks (`rise`) is a strictly
 * increasing function of the level that never flattens, and the top of the ranks is not a rank: past the named ones a
 * level is just "Level 41".
 *
 * Ghosty's own rating is earned by practice on the game's real rules (no model; code): `practiceSession` plays the game
 * with his bot at his own level, tries a small change to the bot's weights and keeps it when it plays better, then plays
 * one run that counts. Pure arithmetic and a small localStorage record; the node test holds it to the numbers.
 */

export const SKILL_KEY = 'ghosty.arcade.skill';

/** What a pass gives, what a fail takes. */
export const PASS_GAIN = 1;
export const FAIL_LOSS = 0.8;

/** A player's rating in one game: `r` (no ceiling), the runs counted, and for Ghosty the bot's weights. */
export interface Who {
  r: number;
  n: number;
  theta?: number[];
}
export interface Book {
  you: Who;
  ghosty: Who;
}

/** 1 for a new rating; every whole point of rating is one more level; nothing stops it. */
export const levelOf = (r: number): number => 1 + Math.floor(Math.max(0, Number.isFinite(r) ? r : 0) + 1e-9);

/** The rank's name: the first six levels have names; after them there is only the number, for as far as anyone goes. */
const RANKS = ['Fresh', 'Warming up', 'Getting it', 'Sharp', 'Quick', 'Fierce'];
export const rankName = (level: number): string => (level >= 1 && level <= RANKS.length ? RANKS[level - 1]! : `Level ${Math.max(1, Math.floor(level))}`);
export const levelWords = (level: number): string => (level <= RANKS.length ? `Level ${level} · ${rankName(level)}` : `Level ${level}`);

/**
 * What a level asks, as a number that rises without end: `a + b·ln(1 + L/k)`. Strictly increasing for any b > 0, and
 * unbounded (a log never stops, however slowly), so there is always a harder level.
 */
export const rise = (level: number, a: number, b: number, k = 4): number => a + b * Math.log1p(Math.max(0, level - 1) / k);
/** The same, falling (a gap that closes) but never reaching its floor; the other numbers keep rising past it. */
export const fall = (level: number, a: number, b: number, floor: number, k = 4): number => Math.max(floor, a - b * Math.log1p(Math.max(0, level - 1) / k));

/**
 * One number for how hard a level is, the sum of what rises in it plus a term that is the level itself, so that however
 * many of a game's own numbers have met their floors, the measure never flattens: `intensity` is strictly increasing.
 */
export const intensity = (level: number, parts: readonly number[]): number => parts.reduce((s, v) => s + v, 0) + level * 1e-3;

/** What a run did to the rating: a pass by a margin (score over target) or a fail. */
export function gain(passed: boolean, score: number, target: number): number {
  if (!passed) return -FAIL_LOSS;
  const ratio = target > 0 && Number.isFinite(score / target) ? Math.max(1, score / target) : 1;
  return PASS_GAIN + Math.floor(Math.log2(ratio) + 1e-9);
}
export const afterRun = (r: number, passed: boolean, score: number, target: number): number => Math.max(0, r + gain(passed, score, target));

// ---------------------------------------------------------------- the record

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const fresh = (): Book => ({ you: { r: 0, n: 0 }, ghosty: { r: 0, n: 0 } });
const goodWho = (w: unknown): w is Who => {
  const v = w as Who | null;
  return !!v && Number.isFinite(v.r) && v.r >= 0 && Number.isFinite(v.n) && (v.theta === undefined || (Array.isArray(v.theta) && v.theta.every(Number.isFinite)));
};

export function allBooks(): Record<string, Book> {
  try {
    const raw = JSON.parse(storage()?.getItem(SKILL_KEY) ?? '{}') as Record<string, Partial<Book>>;
    const out: Record<string, Book> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) out[k] = { you: goodWho(v?.you) ? v.you : { r: 0, n: 0 }, ghosty: goodWho(v?.ghosty) ? v.ghosty : { r: 0, n: 0 } };
    return out;
  } catch {
    return {};
  }
}
export const bookOf = (game: string): Book => allBooks()[game] ?? fresh();
export function saveBook(game: string, book: Book): void {
  const all = allBooks();
  all[game] = book;
  try {
    storage()?.setItem(SKILL_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the level lives for this visit only */
  }
}

/** A run is over for `who` in `game`: the rating moves and is kept. Says what changed. */
export function finishRun(game: string, who: 'you' | 'ghosty', passed: boolean, score: number, target: number): { before: number; after: number; levelBefore: number; levelAfter: number; passed: boolean } {
  const book = bookOf(game);
  const w = book[who];
  const before = w.r;
  w.r = afterRun(before, passed, score, target);
  w.n++;
  saveBook(game, book);
  return { before, after: w.r, levelBefore: levelOf(before), levelAfter: levelOf(w.r), passed };
}

// ---------------------------------------------------------------- Ghosty's practice

/** A game as Ghosty practises it: his bot's weights, the real rules at a level, and what a run came to. */
export interface PracticeGame {
  id: string;
  /** The weights a new bot starts with, and how far a try may move each. */
  theta0: readonly number[];
  sigma: readonly number[];
  /** Play one whole run of the real rules at `level` with the bot `theta`; the score and the level's target, and whether it passed. */
  play(theta: readonly number[], level: number, seed: number): { score: number; target: number; passed: boolean };
}

/** A seeded generator for the practice's own choices (the same numbers for the same seed). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const gauss = (r: () => number): number => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += r();
  return (s - 3) / 0.7071;
};

/** How well a bot does at a level over a few runs: the mean of score over target (more is better; a pass is 1 or more). */
function ratio(g: PracticeGame, theta: readonly number[], level: number, seeds: readonly number[]): number {
  let s = 0;
  for (const sd of seeds) {
    const r = g.play(theta, level, sd);
    s += r.target > 0 ? Math.min(4, r.score / r.target) : 0;
  }
  return s / seeds.length;
}

/**
 * One practice session for Ghosty: at his own level, try the weights nudged and keep them when they do better over the
 * same three runs; then one more run counts for his rating. Returns what happened. `book` is changed in place and kept.
 */
export function practiceSession(g: PracticeGame, seed: number, book: Book = bookOf(g.id)): { level: number; kept: boolean; passed: boolean; score: number; target: number; rating: number } {
  const w = book.ghosty;
  const rnd = rng(seed);
  const level = levelOf(w.r);
  const theta = (w.theta && w.theta.length === g.theta0.length ? w.theta : [...g.theta0]).slice();
  const seeds = [1, 2, 3].map(() => Math.floor(rnd() * 2 ** 30) + 1);
  const trial = theta.map((v, i) => v + gauss(rnd) * g.sigma[i]!);
  const kept = ratio(g, trial, level, seeds) > ratio(g, theta, level, seeds);
  w.theta = kept ? trial : theta;
  const run = g.play(w.theta, level, Math.floor(rnd() * 2 ** 30) + 1);
  const before = w.r;
  w.r = afterRun(before, run.passed, run.score, run.target);
  w.n++;
  saveBook(g.id, book);
  return { level, kept, passed: run.passed, score: run.score, target: run.target, rating: w.r };
}

/** Practise for up to `ms` of wall-clock time (a session at a time); how many ran. Used when a game opens, in small slices. */
export function practiceFor(g: PracticeGame, ms: number, seed: number, now: () => number = () => Date.now()): number {
  const end = now() + ms;
  const book = bookOf(g.id);
  let n = 0;
  do {
    practiceSession(g, seed + n * 7919, book);
    n++;
  } while (now() < end);
  return n;
}
