/**
 * Spaced repetition for the tutor's flashcards (SM-2, the SuperMemo 2 algorithm, as Anki and most
 * flashcard apps use it), and the daily learning streak. Pure: the brain (apps/edge/src/tutor.ts)
 * and the phone (features/learn) run the same maths, so a card revised on the phone offline lands
 * on the same day when the brain replays the review later.
 *
 * SM-2 in short: each card has an ease factor (EF, starts 2.5, never below 1.3), a repetition
 * count and an interval in days. A grade of 0–5 after each review:
 *   grade < 3 (forgotten): repetitions back to 0, interval 1 day — and the card comes back in
 *                          10 minutes in this sitting, so it is seen again before you stop;
 *   grade ≥ 3 (remembered): interval 1 day, then 6 days, then the last interval × EF;
 *   EF += 0.1 − (5 − grade) × (0.08 + (5 − grade) × 0.02).
 * The four buttons map to grades the way Anki's do: AGAIN 1, HARD 3, GOOD 4, EASY 5.
 */

export const DAY_MS = 86_400_000;
export const AGAIN_MS = 10 * 60_000;

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const RATING_GRADE: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/** What SM-2 keeps about a card. */
export interface Sm2State {
  /** Ease factor, 1.3 or more. */
  ef: number;
  /** Reviews remembered in a row. */
  reps: number;
  /** Days until the next review after the last one. */
  interval: number;
  /** When it is next due (ms). */
  due: number;
  /** Times forgotten. */
  lapses: number;
  /** When it was last reviewed (ms); 0 never. */
  last: number;
}

export const freshCard = (now: number): Sm2State => ({ ef: 2.5, reps: 0, interval: 0, due: now, lapses: 0, last: 0 });

/** One review: the card's next state after a grade of 0–5 at time `at`. */
export function sm2(s: Sm2State, grade: number, at: number): Sm2State {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  const ef = Math.max(1.3, Math.round((s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 1000) / 1000);
  if (q < 3) return { ef, reps: 0, interval: 1, due: at + AGAIN_MS, lapses: s.lapses + 1, last: at };
  const reps = s.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, Math.round(s.interval * s.ef));
  return { ef, reps, interval, due: at + interval * DAY_MS, lapses: s.lapses, last: at };
}

/** A review with one of the four buttons. */
export const rate = (s: Sm2State, r: Rating, at: number): Sm2State => sm2(s, RATING_GRADE[r], at);

/** "in 10 min", "tomorrow", "in 6 days": when a card will come back after this rating (the buttons' small print). */
export function nextText(s: Sm2State, r: Rating, at: number): string {
  const ms = rate(s, r, at).due - at;
  if (ms < 3600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  const d = Math.round(ms / DAY_MS);
  if (d <= 1) return '1 day';
  if (d < 31) return `${d} days`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${Math.round((d / 365) * 10) / 10} yr`;
}

export const isDue = (s: Pick<Sm2State, 'due'>, now: number) => s.due <= now;

/** The calendar day of a moment in a time zone, as YYYY-MM-DD (the streak counts days, not 24-hour spans). */
export function dayKey(at: number, tz = 'UTC'): string {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

const dayNum = (k: string) => Math.round(Date.parse(`${k}T00:00:00Z`) / DAY_MS);

/** The days learning happened (a lesson read, a quiz answered, a card revised) and the best run so far. */
export interface Streak {
  /** YYYY-MM-DD, oldest first, the last 400 kept. */
  days: string[];
  best: number;
}

export const emptyStreak = (): Streak => ({ days: [], best: 0 });

/** Today counted as a learning day (once). */
export function markDay(s: Streak, today: string): Streak {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return s;
  const all = [...new Set([...s.days, today])].sort();
  // The run is counted before the oldest days are let go, so a run longer than what is kept stays the best.
  const best = Math.max(s.best, streakOf({ days: all, best: 0 }, today).current);
  return { days: all.slice(-400), best };
}

/** Two copies (the phone's and the brain's) as one: every day either saw, the better best. */
export function mergeStreaks(a: Streak, b: Streak): Streak {
  const days = [...new Set([...(a.days ?? []), ...(b.days ?? [])])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-400);
  return { days, best: Math.max(a.best ?? 0, b.best ?? 0) };
}

/**
 * The current run of days in a row ending today — or yesterday, so the streak is not lost before
 * today's learning is done (`today` false then: "do something today to keep it").
 */
export function streakOf(s: Streak, today: string): { current: number; best: number; today: boolean } {
  const set = new Set((s.days ?? []).map(dayNum));
  const t = dayNum(today);
  const start = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  if (start !== null) for (let d = start; set.has(d); d--) current++;
  return { current, best: Math.max(s.best ?? 0, current), today: set.has(t) };
}
