/**
 * THE 3D STUDIO's WAITING LIST (NEXT ROUND, MAKE lane: "make from words", finished). The free 3-D makers are often busy, and
 * Ghosty's own allowance is ten tries a day. When a job cannot be made, it waits here (on this phone, `ghosty.studio.queue`)
 * and is tried again by itself while Ghosty is open: after 3, then 10, then 30 minutes when the makers were busy, or just after
 * midnight (UTC, when the brain's day turns) when the day's tries were used. Three tries by itself at most, because every try
 * counts against the day's ten; after that it waits for his TRY NOW. Pure: the studio screen runs it.
 *
 * Honest about the phone: an iPhone stops a hidden web app, so a job is tried only while Ghosty is open, and the words say so.
 */

export type WaitWhy = 'busy' | 'quota';

export interface MakeJob {
  id: string;
  /** What to make, in his words. */
  prompt: string;
  /** When it was first asked for. */
  at: number;
  /** Tries made by itself so far. */
  tries: number;
  /** When it is next tried by itself (0: not by itself any more; it waits for TRY NOW). */
  next: number;
  why: WaitWhy;
}

export const QUEUE_KEY = 'ghosty.studio.queue';
/** Tries a job gets by itself before it waits for him. */
export const AUTO_TRIES = 3;
/** The most jobs kept waiting. */
export const MAX_JOBS = 6;
const BACKOFF_MIN = [3, 10, 30];

/** The next UTC midnight after `now`, plus five minutes (the brain's day turns at UTC midnight). */
export function afterMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 5);
}

/** When a job that has been tried `tries` times by itself is next tried, or 0 when it should wait for him. */
export function nextTry(tries: number, why: WaitWhy, now: number): number {
  if (tries >= AUTO_TRIES) return 0;
  return why === 'quota' ? afterMidnight(now) : now + BACKOFF_MIN[Math.min(tries, BACKOFF_MIN.length - 1)]! * 60_000;
}

/** The fail from the brain as a reason to wait, or null when waiting would not help (a real failure, not a busy one). */
export function waitWhy(code: string | undefined, status: number | undefined, error = ''): WaitWhy | null {
  if (code === 'quota') return 'quota';
  if (code === 'busy') return 'busy';
  // a code that is neither of those names a real failure (no_picture: nothing could draw it here), which waiting would not mend
  if (code) return null;
  if (status === 429 || /daily limit|more tomorrow|allowance/i.test(error)) return 'quota';
  if (status === 503 || status === 504 || /\bbusy\b|took too long|queue/i.test(error)) return 'busy';
  return null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The list with this job waiting (an old one for the same words is moved up, not doubled; the oldest goes past six). */
export function addJob(jobs: MakeJob[], prompt: string, why: WaitWhy, now: number): { jobs: MakeJob[]; job: MakeJob } {
  const old = jobs.find((j) => same(j.prompt, prompt));
  const job: MakeJob = old ? { ...old, why, next: nextTry(old.tries, why, now) } : { id: `j${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, prompt: prompt.trim().slice(0, 200), at: now, tries: 0, next: nextTry(0, why, now), why };
  return { jobs: [...jobs.filter((j) => j.id !== job.id), job].slice(-MAX_JOBS), job };
}

/** After a try by itself that failed again: one more try counted, and its next time. */
export function triedAgain(jobs: MakeJob[], id: string, why: WaitWhy, now: number): MakeJob[] {
  return jobs.map((j) => (j.id === id ? { ...j, why, tries: j.tries + 1, next: nextTry(j.tries + 1, why, now) } : j));
}

export const dropJob = (jobs: MakeJob[], id: string): MakeJob[] => jobs.filter((j) => j.id !== id);

/** The first job due by now (the oldest first). */
export function dueJob(jobs: MakeJob[], now: number): MakeJob | null {
  return jobs.filter((j) => j.next > 0 && j.next <= now).sort((a, b) => a.next - b.next)[0] ?? null;
}

/** "in 3 min", "in 1 h 5 min". */
function inTime(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** What a waiting job's line says. */
export function jobWords(j: MakeJob, now: number): string {
  if (!j.next) return `Tried ${j.tries} times by itself. Tap TRY NOW when you like.`;
  if (j.why === 'quota') return `Today’s ten tries are used. I’ll try again just after midnight, ${inTime(j.next - now)}, if Ghosty is open.`;
  return `The free makers were busy. I’ll try again ${inTime(j.next - now)}, while Ghosty is open.`;
}

/** The line said when a job joins the list. */
export function queuedWords(prompt: string, why: WaitWhy): string {
  return why === 'quota'
    ? `“${prompt}” is waiting: today’s ten free tries are used. I’ll make it just after midnight if Ghosty is open, and tell you when it’s ready.`
    : `“${prompt}” is waiting: the free makers are busy. I’ll try again in a few minutes while Ghosty is open, and tell you when it’s ready.`;
}

/** The line said when a waiting job is made. */
export const readyWords = (prompt: string) => `Your “${prompt}” is ready. It’s open in the 3D studio, and kept on this phone.`;

/** The list as kept on the phone (anything that is not a job is left out). */
export function readJobs(raw: string | null): MakeJob[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((j): j is MakeJob => !!j && typeof j === 'object' && typeof (j as MakeJob).id === 'string' && typeof (j as MakeJob).prompt === 'string' && (j as MakeJob).prompt.trim() !== '' && Number.isFinite((j as MakeJob).next) && Number.isFinite((j as MakeJob).tries) && ((j as MakeJob).why === 'busy' || (j as MakeJob).why === 'quota')).slice(-MAX_JOBS);
  } catch {
    return [];
  }
}
