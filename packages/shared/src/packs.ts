/**
 * THE PACKS (BRIEF-PACKS-1; OWNER-ISSUES 92 ④): money, body and kitchen — small real abilities, each one tool with an
 * `action` enum on the brain (apps/edge/src/tools/money.ts, body.ts, kitchen.ts) and the phone's screens where a screen
 * is needed (apps/web/src/features/body, features/kitchen). This file is what they share: the days on his calendar, the
 * distance between two points, money and amounts in his words, and the shape of a pack action's answer. Pure: no storage,
 * no network. Every number made here says what it assumed, in the words that carry it.
 */
import type { Card } from './cards';

export const PACKS = ['money', 'body', 'kitchen'] as const;
export type PackName = (typeof PACKS)[number];

/** What one pack action gives back: his words, the cards for the chat, data for a screen, a screen to open on the phone. */
export interface PackOut {
  text: string;
  cards?: Card[];
  data?: unknown;
  /** A phone command to run (open_body, open_kitchen, kitchen_timer): the brain emits it as a screen command. */
  open?: { name: string; args: Record<string, unknown> };
}

// ---------------------------------------------------------------- distance

/** Kilometres between two points on the Earth (haversine, radius 6,371 km). */
export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const KM_PER_MILE = 1.609344;
/** "0.4 miles", "3 miles" — the UK's road unit. */
export const milesText = (km: number): string => {
  const mi = km / KM_PER_MILE;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mile${Math.abs(mi - 1) < 0.05 ? '' : 's'}`;
};

// ---------------------------------------------------------------- his calendar (YYYY-MM-DD, no time zone in the sums)

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(utc(s));
export const addDays = (ymd: string, n: number): string => toYmd(utc(ymd) + n * 86_400_000);
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86_400_000);
/** 0 is Sunday. */
export const weekdayOf = (ymd: string): number => new Date(utc(ymd)).getUTCDay();
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** The same day `n` months on, kept inside the month (31 Jan + 1 month is 28 or 29 Feb). */
export function addMonths(ymd: string, n: number): string {
  const y = +ymd.slice(0, 4);
  const m = +ymd.slice(5, 7) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${pad(mm + 1)}-${pad(Math.min(+ymd.slice(8, 10), daysInMonth(yy, mm + 1)))}`;
}
/** The Monday of the week a day is in (a UK week). */
export const mondayOf = (ymd: string): string => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Fri 28 Nov", with the year when it is not `thisYear`'s. */
export const prettyDay = (ymd: string, thisYear?: string): string =>
  `${DAY_NAMES[weekdayOf(ymd)]} ${+ymd.slice(8, 10)} ${MONTHS_SHORT[+ymd.slice(5, 7) - 1]}${thisYear && ymd.slice(0, 4) !== thisYear ? ` ${ymd.slice(0, 4)}` : ''}`;

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/**
 * A day in his words, from `today` (YYYY-MM-DD): "today", "yesterday", "tomorrow", "3 March 2025", "March 3rd", "03/03/2025",
 * "2025-03-03", "the 14th" (the next 14th). A day and month with no year is this year's. '' when the words name no day.
 */
export function dayWords(words: string, today: string): string {
  const w = ` ${words.toLowerCase()} `;
  if (/\btoday\b|\btonight\b/.test(w)) return today;
  if (/\byesterday\b/.test(w)) return addDays(today, -1);
  if (/\btomorrow\b/.test(w)) return addDays(today, 1);
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(w);
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!);
  m = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})\b/.exec(w);
  if (m) return valid(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!);
  const mon = `(${MONTH_WORDS.join('|')})[a-z]*`;
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${mon}(?:,? (\\d{4}))?\\b`).exec(w);
  if (m) return valid(m[3] ? +m[3] : +today.slice(0, 4), MONTH_WORDS.indexOf(m[2]!) + 1, +m[1]!);
  m = new RegExp(`\\b${mon} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?\\b`).exec(w);
  if (m) return valid(m[3] ? +m[3] : +today.slice(0, 4), MONTH_WORDS.indexOf(m[1]!) + 1, +m[2]!);
  m = /\bthe (\d{1,2})(?:st|nd|rd|th)\b/.exec(w);
  if (m) return nextDayOfMonth(+m[1]!, today);
  return '';
}
const valid = (y: number, m: number, d: number): string => (m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? `${y}-${pad(m)}-${pad(d)}` : '');
/** The next time the month reaches day `n` (today counts), kept inside short months. */
export function nextDayOfMonth(n: number, today: string): string {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const here = `${y}-${pad(m)}-${pad(Math.min(n, daysInMonth(y, m)))}`;
  if (here >= today) return here;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(n, daysInMonth(ny, nm)))}`;
}

// ---------------------------------------------------------------- amounts in his words

/** The first amount of money in his words ("£12", "12.50", "12 quid", "a fiver", "£1,200") — null when there is none. */
export function moneyIn(words: string): number | null {
  const w = words.toLowerCase();
  if (/\ba tenner\b/.test(w)) return 10;
  if (/\ba fiver\b/.test(w)) return 5;
  const m = /£\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(?:quid|pounds?|gbp)\b|(?:^|\s)(\d+)\.(\d{2})\b|(?:^|\s)(\d+)(?=\s|$)/.exec(w);
  if (!m) return null;
  const whole = (m[1] ?? m[3] ?? m[5] ?? m[7] ?? '').replace(/,/g, '');
  const pence = m[2] ?? m[4] ?? m[6] ?? '';
  const n = Number(`${whole}.${(pence || '0').padEnd(2, '0')}`);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** £ for his eyes: "£12", "£1,240", or with pence when there are some ("£12.99"). */
export function pounds(n: number): string {
  const neg = n < 0 ? '−' : '';
  const a = Math.abs(n);
  const whole = Math.abs(a - Math.round(a)) < 0.005;
  return `${neg}£${whole ? Math.round(a).toLocaleString('en-GB') : a.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A short id for a kept thing (a watch, a subscription, a timer). */
export const shortId = (): string => Math.random().toString(36).slice(2, 8);

/** The words after a verb, cleaned: "add milk and eggs to the list" → ["milk", "eggs"]. */
export function listWords(words: string): string[] {
  return words
    .split(/,|\band\b|\n|;|\+/i)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/^(?:some|a|an|the)\s+/i, '').replace(/[.!?]+$/, ''))
    .filter((s) => s.length > 0 && s.length <= 60);
}
