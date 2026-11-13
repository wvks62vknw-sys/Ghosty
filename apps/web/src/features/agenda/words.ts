/**
 * THE AGENDA'S WORDS (POLISH 3 · THE AGENDA'S UPGRADE PASS): a time typed as he says it ("dentist half three", "quarter past nine",
 * "ring mum tomorrow at 7"), the day's line at a glance with the free gap said, the empty day, and the states with no message before.
 * Pure: no DOM, no brain, so the spec reads the very words the page is built from.
 */

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty five': 25, 'twenty-five': 25,
};
const NUMW = Object.keys(NUM).sort((a, b) => b.length - a.length).join('|');
const HOUR = `(\\d{1,2}|${NUMW})`;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const n = (s: string): number => (/^\d+$/.test(s) ? Number(s) : NUM[s.toLowerCase()] ?? NaN);

export interface When {
  /** What it is, in his words, first letter up ('' when he only said a time). */
  title: string;
  /** When, in ms (local). */
  at: number;
  /** The time as he will be told it: "Today 15:30". */
  said: string;
}

/** The minute of the day a clock phrase means, and the phrase's span in the text; ambiguous hours (1 to 12 with no am or pm) come as `h12`. */
interface Clock {
  h: number;
  m: number;
  /** An hour said without am or pm, 1 to 12. */
  h12: boolean;
  from: number;
  to: number;
}

function clockIn(t: string): Clock | null {
  let m: RegExpExecArray | null;
  const at = (x: RegExpExecArray, h: number, mi: number, h12: boolean): Clock => ({ h, m: mi, h12, from: x.index, to: x.index + x[0].length });
  if ((m = /\b(?:at )?noon\b|\bmidday\b/i.exec(t))) return at(m, 12, 0, false);
  if ((m = /\b(?:at )?midnight\b/i.exec(t))) return at(m, 0, 0, false);
  // half three, half past three
  if ((m = new RegExp(`\\b(?:at )?half (?:past )?${HOUR}\\b`, 'i').exec(t)) && n(m[1]!) >= 1 && n(m[1]!) <= 12) return at(m, n(m[1]!) % 12, 30, true);
  // quarter past / to, five past, ten to, twenty five to
  if ((m = new RegExp(`\\b(?:at )?(quarter|${NUMW}|\\d{1,2}) (past|to) ${HOUR}\\b`, 'i').exec(t))) {
    const mins = m[1]!.toLowerCase() === 'quarter' ? 15 : n(m[1]!);
    const hr = n(m[3]!);
    if (hr >= 1 && hr <= 12 && mins >= 1 && mins <= 29) return m[2]!.toLowerCase() === 'past' ? at(m, hr % 12, mins, true) : at(m, (hr + 11) % 12, 60 - mins, true);
  }
  // 15:30, 3:30pm, 3.30
  if ((m = /\b(?:at )?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i.exec(t))) {
    let h = Number(m[1]);
    const mi = Number(m[2]);
    if (h <= 23 && mi <= 59) {
      const ap = m[3]?.toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return at(m, h, mi, !ap && h >= 1 && h <= 12);
    }
  }
  // 3pm, 3 pm
  if ((m = /\b(?:at )?(\d{1,2})\s*(am|pm)\b/i.exec(t))) {
    let h = Number(m[1]);
    if (h >= 1 && h <= 12) {
      if (m[2]!.toLowerCase() === 'pm' && h < 12) h += 12;
      if (m[2]!.toLowerCase() === 'am' && h === 12) h = 0;
      return at(m, h, 0, false);
    }
  }
  // three o'clock
  if ((m = new RegExp(`\\b(?:at )?${HOUR} o.?clock\\b`, 'i').exec(t)) && n(m[1]!) >= 1 && n(m[1]!) <= 12) return at(m, n(m[1]!) % 12, 0, true);
  // at 3, at three (a bare hour needs "at")
  if ((m = new RegExp(`\\bat ${HOUR}\\b`, 'i').exec(t)) && n(m[1]!) >= 0 && n(m[1]!) <= 23) {
    const h = n(m[1]!);
    return at(m, h % 24, 0, h >= 1 && h <= 12);
  }
  return null;
}

/** The first sensible moment for a clock phrase: the soonest of am and pm still ahead (daytime first), else tomorrow's. */
function pick(base: Date, c: Clock, dayGiven: boolean): Date {
  const cand = (add: number, h: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + add, h, c.m, 0, 0);
  const hours = c.h12 ? [c.h % 12 + 12, c.h % 12 === 0 ? 12 : c.h % 12].map((x) => x % 24) : [c.h];
  // an ambiguous hour: the daytime reading (7 to 22) comes first, the other after
  const order = c.h12 ? hours.slice().sort((a, b) => Number(!(a >= 7 && a <= 22)) - Number(!(b >= 7 && b <= 22)) || a - b) : hours;
  const now = Date.now();
  const sameDay = order.map((h) => cand(0, h)).filter((d) => d.getTime() > now);
  if (sameDay.length) {
    // the soonest still ahead, but never a night reading when a daytime one is still to come
    const day = sameDay.filter((d) => d.getHours() >= 7 && d.getHours() <= 22);
    return (day.length ? day : sameDay).sort((a, b) => a.getTime() - b.getTime())[0]!;
  }
  return dayGiven ? cand(0, order[0]!) : cand(1, order[0]!);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Today 15:30", "Tomorrow 07:00", "Fri 20 Nov 09:15". */
export function saidWhen(at: number, now = Date.now()): string {
  const d = new Date(at);
  const t = new Date(now);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const tm = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (key(d) === key(t)) return `Today ${hm}`;
  if (key(d) === key(tm)) return `Tomorrow ${hm}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${hm}`;
}

/**
 * What he typed to add: "dentist half three", "ring mum tomorrow at 7", "quarter past nine call Sam", "lunch with Ann friday 1pm".
 * The time is read as he says it; the rest is the title, kept whole. null when there is no time in it (the sheet asks for one).
 */
export function parseWhen(text: string, now = Date.now()): When | null {
  let t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const base = new Date(now);
  let day: Date | null = null;
  let m: RegExpExecArray | null;
  const cut = (x: RegExpExecArray) => (t = `${t.slice(0, x.index)} ${t.slice(x.index + x[0].length)}`.replace(/\s+/g, ' ').trim());
  if ((m = /\b(?:on )?tomorrow\b/i.exec(t))) {
    day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    cut(m);
  } else if ((m = /\b(?:today|tonight|this evening)\b/i.exec(t))) {
    day = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    cut(m);
  } else if ((m = new RegExp(`\\b(?:on |next )?(${DAYS.join('|')})\\b`, 'i').exec(t))) {
    const want = DAYS.indexOf(m[1]!.toLowerCase());
    const add = (want - base.getDay() + 7) % 7 || 7;
    day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + add);
    cut(m);
  }
  const c = clockIn(t);
  if (!c) return null;
  t = `${t.slice(0, c.from)} ${t.slice(c.to)}`.replace(/\s+/g, ' ').trim();
  t = t.replace(/\b(?:at|on|for|by|around)\s*$/i, '').replace(/^(?:at|on|for|by|around)\b\s*/i, '').replace(/\s+/g, ' ').trim();
  let when: Date;
  if (day && c.h12 && day.toDateString() === base.toDateString()) when = pick(base, c, true);
  else if (day) {
    // another day, an hour said with no am or pm: 7 to 11 is the morning, 12 noon, 1 to 6 the afternoon
    const h = c.h12 ? (c.h === 0 ? 12 : c.h <= 6 ? c.h + 12 : c.h) : c.h;
    when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, c.m, 0, 0);
  } else when = pick(base, c, false);
  return { title: cap(t), at: when.getTime(), said: saidWhen(when.getTime(), now) };
}

/** The sheet's live line as he types: what it will add, or what is missing. */
export function previewLine(text: string, now = Date.now()): string {
  if (!text.trim()) return 'Say what and when, like “dentist half three”.';
  const w = parseWhen(text, now);
  if (!w) return 'I need a time: “half three”, “quarter past nine” or “7pm”.';
  return `${w.title || 'Reminder'} · ${w.said}`;
}

// ---------------------------------------------------------------- the day's line

export interface Ev {
  title: string;
  start: number;
  end?: number;
  allDay?: boolean;
}

const hm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
export const longGap = (min: number): string => (min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`);

/**
 * The day at a glance: today's first thing and its time, and the gap said ("Free until 15:30", "In Dentist until 16:00", "Nothing else today").
 * Counts only what is still to come today: a finished thing is not "today's".
 */
export function dayLine(events: Ev[], now = Date.now()): { first: string; gap: string; left: number } {
  const today = events.filter((e) => dayKey(e.start) === dayKey(now));
  const timed = today.filter((e) => !e.allDay);
  const live = timed.find((e) => e.start <= now && (e.end ?? e.start) > now);
  const nextOne = timed.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0];
  const left = timed.filter((e) => (e.end ?? e.start) > now).length + today.filter((e) => e.allDay).length;
  if (live) return { first: `Now: ${live.title}`, gap: `In it until ${hm(live.end ?? live.start)}`, left };
  if (nextOne) {
    const mins = Math.round((nextOne.start - now) / 60_000);
    return { first: `${nextOne.title} at ${hm(nextOne.start)}`, gap: `Free for ${longGap(mins)}`, left };
  }
  return { first: today.length ? 'Done for today' : 'Nothing today', gap: 'Free for the rest of the day', left };
}

// ---------------------------------------------------------------- states, in his voice

/** The empty day, with the one next thing. */
export const EMPTY_DAY = { head: 'Nothing in the next two weeks.', line: 'Tap ADD and say what and when.' };
/** No reminders. */
export const EMPTY_JOBS = { head: 'No reminders.', line: 'Tap ADD and say what and when.' };
/** The brain cannot be reached and nothing is kept to show. */
export const DIARY_OFFLINE = 'I can’t reach my brain, so I can’t show your diary. It comes back when I can.';
/** A time that has gone. */
export const TIME_PASSED = 'That time has gone. Pick one still to come.';
/** The ADD sheet's labels. */
export const ADD_SHEET = { title: 'ADD', placeholder: 'Dentist half three', key: 'ADD', again: 'ADDED' };
