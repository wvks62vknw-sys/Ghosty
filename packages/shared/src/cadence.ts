/**
 * SPEAK FIRST — THE CADENCE (BRIEF-SIDEWAYS item 3; OWNER-ISSUES 93b "he can speak first idm"): how often Ghosty may bring
 * something up unasked, across the chat, push and Telegram together. Pure: the brain keeps the state (apps/edge/src/speak.ts),
 * the phone shows the dial (Settings → CHARACTER → SPEAK FIRST).
 *
 *   at most four unprompted cards a day (the dial: QUIET danger only · SOME four · CHATTY eight);
 *   never two within two hours; nothing between 23:00 and 07:00; any stop word silences the rest of his day;
 *   a warning about one of his places is never held and never counted.
 *
 * Every line is recorded — said, or held back and why — so WHY and "what did you do today" can list it with its reason.
 */

export type Dial = 'quiet' | 'some' | 'chatty';

/** Where the brain keeps it (apps/edge/src/speak.ts; today.ts and why.ts read it too). */
export const CADENCE_KEY = 'speak:cadence';

export const DIALS: { id: Dial; label: string; cap: number; says: string }[] = [
  { id: 'quiet', label: 'QUIET', cap: 0, says: 'I only speak first for danger: a warning about one of your places.' },
  { id: 'some', label: 'SOME', cap: 4, says: 'I speak first up to four times a day, never two within two hours, never at night.' },
  { id: 'chatty', label: 'CHATTY', cap: 8, says: 'I speak first up to eight times a day, never two within two hours, never at night.' },
];
export const DEFAULT_DIAL: Dial = 'some';
export const GAP_MS = 2 * 3_600_000;
/** His night, on his clock: from 23:00 to 07:00. */
export const NIGHT = { from: 23, to: 7 } as const;
const KEEP_MS = 2 * 86_400_000;
const KEEP = 80;

/** One line he did not ask for: said (no `held`), or held back and why. */
export interface Spoken {
  at: number;
  /** The card's id: the same piece is said once. */
  id: string;
  title: string;
  line: string;
  /** Why it was said ("the morning piece: your diary and the rain at Home"). */
  why: string;
  danger?: boolean;
  /** Held back: "the night", "the dial is on QUIET", "four already today", "one within the last two hours", "you said stop today". */
  held?: string;
}

export interface Cadence {
  dial: Dial;
  log: Spoken[];
  /** The day (on his clock, "2026-11-01") a stop word silenced: nothing more that day but danger. */
  stopped?: string;
}

const parts = (ms: number, tz: string) => {
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
};
/** His calendar day ("2026-11-01"). */
export const localDay = (ms: number, tz: string): string => parts(ms, tz).day;
/** The hour on his clock, with the minutes as a fraction (7.5 is half past seven). */
export const localHour = (ms: number, tz: string): number => {
  const p = parts(ms, tz);
  return p.hour + p.minute / 60;
};
export const atNight = (ms: number, tz: string): boolean => {
  const h = localHour(ms, tz);
  return h >= NIGHT.from || h < NIGHT.to;
};

/** What is stored, made safe: an unknown dial is the default, a broken log is empty. */
export function readCadence(v: unknown): Cadence {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Cadence>;
  const dial = DIALS.some((d) => d.id === o.dial) ? (o.dial as Dial) : DEFAULT_DIAL;
  const log = Array.isArray(o.log) ? o.log.filter((s): s is Spoken => !!s && typeof s.at === 'number' && typeof s.id === 'string') : [];
  return { dial, log, ...(typeof o.stopped === 'string' ? { stopped: o.stopped } : {}) };
}

export const capOf = (dial: Dial): number => DIALS.find((d) => d.id === dial)?.cap ?? 4;

/** Today's lines on his clock (said and held), oldest first. */
export const linesToday = (c: Cadence, now: number, tz: string): Spoken[] => c.log.filter((s) => localDay(s.at, tz) === localDay(now, tz));
/** What was said today, unasked, that counts towards the cap (danger never does). */
export const saidToday = (c: Cadence, now: number, tz: string): Spoken[] => linesToday(c, now, tz).filter((s) => !s.held && !s.danger);

/** May an unprompted line go now? Danger always; otherwise the stop, the night, the dial, the cap and the gap, in that order. */
export function maySpeak(c: Cadence, o: { danger?: boolean; now: number; tz: string }): { ok: true } | { ok: false; why: string } {
  if (o.danger) return { ok: true };
  if (c.stopped && c.stopped === localDay(o.now, o.tz)) return { ok: false, why: 'you said stop today' };
  if (atNight(o.now, o.tz)) return { ok: false, why: 'the night (23:00 to 07:00)' };
  const cap = capOf(c.dial);
  if (!cap) return { ok: false, why: 'the dial is on QUIET' };
  const said = saidToday(c, o.now, o.tz);
  if (said.length >= cap) return { ok: false, why: `${cap === 4 ? 'four' : cap === 8 ? 'eight' : cap} already today` };
  const last = c.log.filter((s) => !s.held && !s.danger).reduce((m, s) => Math.max(m, s.at), 0);
  if (last && o.now - last < GAP_MS) return { ok: false, why: 'one within the last two hours' };
  return { ok: true };
}

/** Was this piece already said (today's morning, this month's MOT)? Held tries do not count: it can still go later. */
export const alreadySaid = (c: Cadence, id: string): boolean => c.log.some((s) => s.id === id && !s.held);

/** Keep a line in the record (two days of them): a held line once a day per piece and reason, so the record stays short. */
export function record(c: Cadence, s: Spoken, tz = 'UTC'): Cadence {
  const day = localDay(s.at, tz);
  if (s.held && c.log.some((x) => x.id === s.id && x.held === s.held && localDay(x.at, tz) === day)) return c;
  const log = [...c.log.filter((x) => s.at - x.at <= KEEP_MS), s].slice(-KEEP);
  return { ...c, log };
}

/** A stop word: nothing more unasked for the rest of his day (danger still goes). */
export const silence = (c: Cadence, now: number, tz: string): Cadence => ({ ...c, stopped: localDay(now, tz) });
/** "You can talk again": the day's stop lifted. */
export const unsilence = (c: Cadence): Cadence => {
  const { stopped: _, ...rest } = c;
  return rest;
};
export const setDial = (c: Cadence, dial: Dial): Cadence => ({ ...c, dial: DIALS.some((d) => d.id === dial) ? dial : c.dial });

/** "Spoke first: Good morning — your diary and the rain (why: …)" / "Held back: … (the night)", for what he did today. */
export function spokenLine(s: Spoken): string {
  return s.held ? `Held back: ${s.title} (${s.held})` : `${s.danger ? 'Warned you' : 'Spoke first'}: ${s.title} — ${s.line} (why: ${s.why})`;
}
