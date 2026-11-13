/**
 * SYSTEM's pages' words, pure (the spec imports this file): the wait each page says while it reads, every number with its unit and its
 * "as of", and the size always said on the storage line. The pages' numbers themselves are the brain's; only the words are here.
 */
export const clockOf = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dayOf = (t: number): string => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** What each page that fetches says while it waits. */
export const WAIT = { loops: 'Reading this week…', ledger: 'Reading what I learned…', foresight: 'Reading my record…', keys: 'Looking at my keys and models…', training: 'Reading my training record…', backups: 'Looking for backups…', status: 'Asking my brain how it is…' };

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

// ---------------------------------------------------------------- POLISH 3: the System pass

/** What the top of SYSTEM needs to be honest about, from the brain's own status (nothing here asks the network). */
export interface Facts {
  /** The brain answered. */
  reached: boolean;
  /** Models ready now, and keys added. */
  models: number;
  keys: number;
  /** Keys marked NEEDED that are not set. */
  needed: number;
  /** The database meter's level (1 and over: memory is paused) and when it resets. */
  meter?: { level: number; resetAt: number };
  /** Every free AI allowance used up until (ms), when they all are. */
  allFullUntil?: number;
  /** The clock of this reading. */
  at: number;
}

/** ONE HONEST LINE at the top: WORKING, or the first thing that is not, in his words, with when it was read. */
export function honestLine(f: Facts): { big: string; sub: string; ok: boolean } {
  const asOf = `as of ${clockOf(f.at)}`;
  if (!f.reached) return { big: 'NOT WORKING', sub: `I can’t reach my brain, so nothing here is current (${asOf}).`, ok: false };
  if (f.needed > 0) return { big: 'NOT WORKING', sub: `Add the ${f.needed === 1 ? 'key' : `${f.needed} keys`} under NEEDED in KEYS to get started (${asOf}).`, ok: false };
  if (!f.models) return { big: 'NOT WORKING', sub: `No AI model is ready: check your keys under KEYS (${asOf}).`, ok: false };
  if (f.meter && f.meter.level >= 1) return { big: 'NOT WORKING', sub: `My memory is paused until ${clockOf(f.meter.resetAt)}; the AI still answers (${asOf}).`, ok: false };
  if (f.allFullUntil) return { big: 'WORKING', sub: `Every free AI is used up until ${clockOf(f.allFullUntil)} (${asOf}).`, ok: true };
  return { big: 'WORKING', sub: `${f.models} model${f.models === 1 ? '' : 's'} ready and ${f.keys} key${f.keys === 1 ? '' : 's'} added (${asOf}).`, ok: true };
}

/** The AI room's numbers, each with its unit: requests. */
export const roomNow = (left: number, per: number): string => `room now ${left} of ${per} requests a minute`;
export const roomToday = (used: string, of: string | null): string => `used today ${used}${of ? ` of ${of}` : ''} requests`;

/** The database meter's value with units and as-of: rows read and written today, of the day's allowance. */
export const meterValue = (reads: string, readsOf: string, rp: string, writes: string, writesOf: string, wp: string, at: number): string =>
  `${reads} of ${readsOf} rows read (${rp}) · ${writes} of ${writesOf} rows written (${wp}) a day, as of ${clockOf(at)}`;

/** The size a backup would be, said on its key before the tap (an estimate: what is sealed is a little more than the words). */
export const backupKey = (sizeText: string): string => `BACK UP NOW · about ${sizeText}`;
