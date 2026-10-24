/**
 * The Brief's words, worked out from what the phone already holds (no model, no fetch): the greeting and the
 * date, when it will rain, the day's diary, and the one plain sentence the hero shows and READ IT TO ME says.
 * Everything here is pure so the spec and the page agree on the wording.
 */
import type { AgendaEventInfo, JobInfo } from '../../../../../packages/shared/src/protocol';

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "Good morning" before noon, "Good afternoon" until six, then "Good evening" (the phone's own clock). */
export const greeting = (d: Date) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

/** "Monday 26 October". */
export const dayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** The calendar day on the phone's clock, "2026-10-26" (the digest's headings use the same shape). */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * When it will rain for the rest of today, from Open-Meteo's hourly chances (index 0 = midnight where the
 * weather is; `hour` = the hour now). "Likely" is 50 % or more. Never says "today 100 %" for rain that fell
 * before he woke up.
 */
export function rainWhen(probs: number[], hour: number): { line: string; wet: boolean } {
  const rest = probs.slice(hour, 24);
  if (!rest.length) return { line: 'No forecast', wet: false };
  const LIKELY = 50;
  if (rest[0]! >= LIKELY) {
    const dry = rest.findIndex((p) => p < LIKELY);
    return { line: dry < 0 ? 'Likely for the rest of today' : `Likely now, easing by ${pad(hour + dry)}:00`, wet: true };
  }
  const wet = rest.findIndex((p) => p >= LIKELY);
  if (wet > 0) return { line: `Likely from ${pad(hour + wet)}:00 · ${rest[wet]}%`, wet: true };
  const most = Math.max(...rest);
  return { line: most >= 25 ? `Small chance later · ${most}%` : 'Dry for the rest of today', wet: false };
}

export interface DayItem {
  /** "09:30", "All day", or "By 18:00" for a reminder. */
  when: string;
  title: string;
  where?: string;
  at: number;
}

/** What is left of today: diary events not yet over and reminders still to go off, in time order. */
export function todayItems(events: AgendaEventInfo[], jobs: JobInfo[], now: number): DayItem[] {
  const end = new Date(now).setHours(24, 0, 0, 0);
  const evs = events
    .filter((e) => (e.end ?? e.start) > now && e.start < end)
    .map((e): DayItem => ({ when: e.allDay ? 'All day' : e.start <= now ? 'Now' : hhmm(e.start), title: e.title, ...(e.location ? { where: e.location } : {}), at: e.allDay ? 0 : e.start }));
  // A diary event's own reminder is the same thing twice: only the event is listed.
  const own = new Set(events.map((e) => e.id));
  const rem = jobs
    .filter((j) => (j.kind === 'reminder' || j.kind === 'task') && j.next >= now && j.next < end && !(j.eventId && own.has(j.eventId)))
    .map((j): DayItem => ({ when: hhmm(j.next), title: j.title || j.text, at: j.next }));
  return [...evs, ...rem].sort((a, b) => a.at - b.at);
}

/** The first thing after today (for "Nothing more today · tomorrow: …"). */
export function nextAfterToday(events: AgendaEventInfo[], now: number): AgendaEventInfo | undefined {
  const end = new Date(now).setHours(24, 0, 0, 0);
  return events.filter((e) => e.start >= end).sort((a, b) => a.start - b.start)[0];
}

/** "2 things today, first Dentist at 09:30" — or "Nothing in your diary for the rest of today". */
export function diarySentence(items: DayItem[]): string {
  if (!items.length) return 'Nothing in your diary for the rest of today';
  const first = items[0]!;
  const at = first.when === 'All day' ? ' (all day)' : first.when === 'Now' ? ' (on now)' : ` at ${first.when}`;
  return items.length === 1 ? `One thing today: ${first.title}${at}` : `${items.length} things today, first ${first.title}${at}`;
}

/** The same as a clause for the hero's sentence: "rain likely from 09:00", "dry for the rest of today". */
export function rainClause(line: string): string {
  if (/^Likely/.test(line)) return `rain ${line.replace(/ · \d+%$/, '').replace(/^Likely/, 'likely')}`;
  if (/^Small chance/.test(line)) return 'a small chance of rain later';
  if (/^Dry/.test(line)) return 'dry for the rest of today';
  return '';
}

export interface Facts {
  /** "Drizzle, 15°C" (the sky and the temperature now): said aloud, not shown (the hero shows it already). */
  now?: string;
  /** "7 to 16°C". */
  range?: string;
  /** rainClause's words. */
  rain?: string;
  diary?: string;
  /** "24 min to work". */
  commute?: string;
}

/** The hero's one plain sentence, short enough to read at a glance and to say aloud. */
export function summary(f: Facts): string {
  const wx = [f.now, f.range ? `${f.range} today` : '', f.rain].filter(Boolean).join(', ');
  const parts = [wx, f.diary, f.commute].filter((x): x is string => !!x).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  return parts.length ? `${parts.join('. ')}.` : '';
}

/** What READ IT TO ME says: the greeting, the day, the sentence, and the top headlines. No symbols to stumble on. */
export function spoken(d: Date, line: string, headlines: string[]): string {
  const said = line.replace(/°C/g, ' degrees').replace(/°F/g, ' degrees Fahrenheit').replace(/(\d+)%/g, '$1 percent').replace(/ · /g, ', ');
  const top = headlines.slice(0, 3).map((t) => t.replace(/[.!?]?$/, '.'));
  return `${greeting(d)}. It's ${dayName(d)}. ${said}${top.length ? ` The headlines. ${top.join(' ')}` : ''}`.replace(/\s+/g, ' ').trim();
}

/** One passage of the library's "Fresh knowledge" notebook: heading "YYYY-MM-DD · source". */
export interface DigestPassage {
  heading?: string;
  text: string;
}

/**
 * The newest day of the morning digest: its day, the BBC News headlines (the lines "- title — description"),
 * and "In one line:" from the day in three levels when a model wrote one.
 */
export function digestDay(passages: DigestPassage[]): { day: string; headlines: { title: string; desc: string }[]; oneLine: string } | null {
  const day = passages.reduce((d, p) => {
    const k = (p.heading ?? '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(k) && k > d ? k : d;
  }, '');
  if (!day) return null;
  const of = (src: string) => passages.find((p) => p.heading === `${day} · ${src}`)?.text ?? '';
  const headlines = of('BBC News')
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      const [title, ...rest] = l.slice(2).split(' — ');
      return { title: title!.trim(), desc: rest.join(' — ').trim() };
    })
    .filter((x) => x.title);
  const one = /In one line:\s*(.+)/i.exec(of('in three levels'))?.[1]?.trim() ?? '';
  return { day, headlines, oneLine: one };
}
