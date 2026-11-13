/**
 * MEMORY's words, pure (the spec imports this file): a day said as he says it, a search with no hit that names what he typed, the waits and the
 * one next thing on every empty state. What memory keeps and FORGET's effect are not here: only what the screen says.
 */
const midnight = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** A day as he says it: "Today", "Yesterday", else "Sat 17 Oct" (the year only when it is not this one). */
export function dayWords(at: number, now: number = Date.now()): string {
  const days = Math.round((midnight(now) - midnight(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(at);
  const year = d.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' as const };
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...year });
}

/** The line under the title. */
export const PAGE_SUB = 'Kept in your private brain, the same on all your devices.';
export const OFFLINE_SUB = 'You’re offline: this is what I knew before. It updates by itself when you’re back.';

/** A search with no hit: what he typed, and what to try. */
export function noHitWords(query: string, kindIsEverything: boolean): { head: string; next: string } {
  const q = query.trim();
  return {
    head: q ? `Nothing matches “${q.length > 40 ? `${q.slice(0, 40)}…` : q}”` : 'Nothing in this list',
    next: kindIsEverything ? 'Try other words, or fewer of them.' : 'Try other words, or show Everything.',
  };
}

export const LOADING = 'Reading your memory…';
export const READ_FAILED = { head: 'I couldn’t read my memory just now', next: 'Nothing was lost. Tap RETRY.' };
export const OFFLINE_EMPTY = { head: 'You’re offline', next: 'My memory shows again as soon as the phone has a signal.' };
export const PATTERNS_EMPTY = 'Nothing yet. After a few days of chats I point out what keeps coming up, and how often.';
/** The fact cut from PATTERNS' empty state, kept where he can ask for it. */
export const PATTERNS_WHY = 'Each one is worked out by counting what is stored in your brain, never guessed.';
