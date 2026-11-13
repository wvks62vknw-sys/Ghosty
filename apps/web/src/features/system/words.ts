/**
 * SYSTEM's pages' words, pure (the spec imports this file): the wait each page says while it reads, every number with its unit and its
 * "as of", and the size always said on the storage line. The pages' numbers themselves are the brain's; only the words are here.
 */
export const clockOf = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dayOf = (t: number): string => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** What each page that fetches says while it waits. */
export const WAIT = { loops: 'Reading this week…', ledger: 'Reading what I learned…', foresight: 'Reading my record…' };

/** LOOPS' line: since when, as of when, what it shows (one line). */
export const loopsHead = (since: number, now: number): string => `This week, since ${dayOf(since)}, as of ${clockOf(now)}: what each loop practised, improved and threw out.`;
/** WHAT I LEARNED's line. */
export const ledgerHead = (since: number, now: number): string => `This week, since ${dayOf(since)}, as of ${clockOf(now)}:`;
/** FORESIGHT's bar: how often right, and out of how many scored. */
export const foreValue = (share: number, n: number): string => (n ? `${Math.round(share * 100)}% right · ${n} scored` : 'none scored yet');
/** The independence meter: of what. */
export const ownBrainsValue = (pct: number): string => `${pct}% of answers`;

/** The storage line always says the size when the phone will say it (a number he can feel), after the rest. */
export const withSize = (text: string, usageBytes: number): string => {
  if (usageBytes < 0 || / MB used$/.test(text)) return text;
  const mb = usageBytes / 1024 / 1024;
  return `${text} · ${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} MB used`;
};
