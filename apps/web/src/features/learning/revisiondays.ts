/** REVISION DAYS (learn.s12): the pure dates, shared with the brain tests (features/learning/revision.ts draws them). */

/** The most sessions one plan adds. */
export const MAX_SESSIONS = 20;

/** London's calendar date of a moment (YYYY-MM-DD). */
export const ymd = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

/**
 * The days to revise on, from tomorrow up to the day before the exam: every other day while more than a week away, every day in
 * the last week, at most MAX_SESSIONS (the latest kept). Pure: dates as YYYY-MM-DD.
 */
export function revisionDays(today: string, exam: string): string[] {
  const d0 = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const d1 = Date.UTC(+exam.slice(0, 4), +exam.slice(5, 7) - 1, +exam.slice(8, 10));
  const days = Math.round((d1 - d0) / 86_400_000);
  const out: string[] = [];
  for (let k = 1; k < days; k++) {
    const left = days - k;
    if (left <= 7 || (days - k) % 2 === 1) out.push(new Date(d0 + k * 86_400_000).toISOString().slice(0, 10));
  }
  return out.slice(-MAX_SESSIONS);
}

/** A London date and a time of day ("18:30") as a moment. */
export function londonAt(day: string, hm: string): number {
  const [hh, mm] = hm.split(':').map(Number) as [number, number];
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), hh, mm);
  // (London is UTC or UTC+1: the offset that day, worked out from what the guess reads as in London)
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guess);
  const [sh, sm] = shown.split(':').map(Number) as [number, number];
  return guess - ((sh - hh) * 60 + (sm - mm)) * 60_000;
}

