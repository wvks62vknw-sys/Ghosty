/**
 * The arcade's scores, per game: the best, the last, and when the last was played. Kept in localStorage under
 * `ghosty.arcade.scores` (small, his own, on this phone); a damaged or missing record reads as no score yet.
 */

export const SCORES_KEY = 'ghosty.arcade.scores';

export interface Score {
  best: number;
  last: number;
  /** When the last score was set (ISO time). */
  when: string;
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const valid = (s: unknown): s is Score => {
  const v = s as Score | null;
  return !!v && Number.isFinite(v.best) && Number.isFinite(v.last) && typeof v.when === 'string';
};

/** Every game's score (only well-formed records). */
export function allScores(): Record<string, Score> {
  try {
    const raw = JSON.parse(storage()?.getItem(SCORES_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<string, Score> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (valid(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export const scoreOf = (id: string): Score | null => allScores()[id] ?? null;

/** Record a finished run's score: `last` always, `best` when it beats it. Says whether it was a new best. */
export function recordScore(id: string, value: number, now: Date = new Date()): { score: Score; isBest: boolean } {
  const v = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const all = allScores();
  const prev = all[id];
  const isBest = !prev || v > prev.best;
  const score: Score = { best: isBest ? v : prev.best, last: v, when: now.toISOString() };
  all[id] = score;
  try {
    storage()?.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the score lives for this visit only */
  }
  return { score, isBest };
}

/**
 * His longest sitting with a game (seconds), kept beside its score under `<id>/sitting`: DOOM and Quake score a
 * finished level (their own tally), and every game they play keeps how long he stayed too. A DOS game, which says
 * nothing of its levels, has its sitting AS its score (recordScore), so it keeps no second record.
 */
export const sittingKey = (id: string): string => `${id}/sitting`;
export const recordSitting = (id: string, seconds: number, now: Date = new Date()): { score: Score; isBest: boolean } => recordScore(sittingKey(id), seconds, now);
export const sittingOf = (id: string): Score | null => scoreOf(sittingKey(id));

/** Forget one game's score. */
export function clearScore(id: string): void {
  const all = allScores();
  delete all[id];
  try {
    storage()?.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    /* blocked */
  }
}
