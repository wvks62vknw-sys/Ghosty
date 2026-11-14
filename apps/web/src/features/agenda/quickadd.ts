/**
 * [planlane4:tasks] QUICK ADD: one line typed as he would say it, read into a to-do, pure (the spec imports this file; no DOM, no
 * storage). "Call the bank tomorrow at 3pm p1 #Home @phone" is the words "Call the bank", due tomorrow, ringing at 15:00, priority 1,
 * in the project Home, tagged phone; "#Home/Kitchen" is the project Home, its section Kitchen. It also reads "every Monday", "next Friday", "in 3 days", "by the 20th", "daily", "at half 4".
 * Each thing it understood is a chip under the field before ADD; a chip tapped is dropped (its words stay in the to-do's words).
 * Days are London days: the caller gives today and the time now as London has them (londonNow).
 */
import { splitTime } from '../../../../../packages/shared/src/work';
import type { Every } from './todowords';

export type QuickKind = 'due' | 'time' | 'p' | 'project' | 'tag' | 'every';
/** One thing understood: its kind, its key (what a tap drops: 'due', 'time', 'p', 'project', 'every', 'tag:phone') and its chip words. */
export interface QuickBit { kind: QuickKind; key: string; label: string }
export interface Quick {
  /** the to-do's words with what was understood taken out ('' when nothing is left) */
  text: string;
  /** "2026-11-20" (London), or '' */
  due: string;
  /** "15:00", or '' */
  time: string;
  /** 1 to 3, or 0 for none (P4) */
  p: 0 | 1 | 2 | 3;
  project: string;
  /** the section of its project ("#Home/Kitchen"), or '' */
  section: string;
  tags: string[];
  every?: Every;
  bits: QuickBit[];
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** London's day ("2026-11-14") and time ("15:05") at `t`, whatever zone the phone is in. */
export function londonNow(t = Date.now()): { day: string; hm: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
const utc = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd!));
};
const iso = (x: Date) => x.toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
};
/** 0 = Sunday */
const weekday = (d: string) => utc(d).getUTCDay();
/** A day's chip: "Today", "Tomorrow", "Fri 20 Nov". */
export function dayChip(d: string, today: string): string {
  if (d === today) return 'Today';
  if (d === addDays(today, 1)) return 'Tomorrow';
  return utc(d).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const FULLDAY = '(?:mon|tues|wednes|thurs|fri|satur|sun)day';
const SHORTDAY = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)';
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD = '\\d{1,2}(?:st|nd|rd|th)?';
const END = '(?=$|[\\s,.!?;])';
/** the next `wd` (0 = Sunday) after today; `orToday` lets today's own name be today */
const nextWeekday = (today: string, wd: number, orToday = false) => addDays(today, (wd - weekday(today) + 7) % 7 || (orToday ? 0 : 7));

/** A day said in words, from London's today: "today", "tomorrow", "the day after tomorrow", "next week" (Monday), "weekend", "end
 * of the month", "in 3 days", "in 2 weeks", "Friday", "next Friday", "this Fri" (the next one; today's own name is a week on, as the
 * chat reads it), "the 20th", "20th", "20 Nov", "Nov 20" (a day gone this month is next month's; a date gone this year is next year's). */
export function dayFrom(words: string, today: string): string {
  const w = words.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(?:today|tonight)$/.test(w)) return today;
  if (/^(?:tomorrow|tmrw|tmr)$/.test(w)) return addDays(today, 1);
  if (w === 'the day after tomorrow') return addDays(today, 2);
  if (w === 'next week') return nextWeekday(today, 1);
  if (/^(?:this )?weekend$/.test(w)) return nextWeekday(today, 6, true);
  if (/^end of (?:the )?month$/.test(w)) {
    const x = utc(today);
    return iso(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)));
  }
  let m = /^in (\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten) (day|week)s?$/.exec(w);
  if (m) return addDays(today, (/^\d/.test(m[1]!) ? Number(m[1]) : NUM[m[1]!]!) * (m[2] === 'week' ? 7 : 1));
  m = new RegExp(`^(?:next |this )?(${FULLDAY}|${SHORTDAY})$`).exec(w);
  if (m) return nextWeekday(today, DAYS.indexOf(m[1]!.slice(0, 3)));
  m = new RegExp(`^(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)?(?: (${MONTH}))?$`).exec(w) ?? null;
  const m2 = m ? null : new RegExp(`^(${MONTH}) (?:the )?(\\d{1,2})(?:st|nd|rd|th)?$`).exec(w);
  if (m || m2) {
    const day = Number(m ? m[1] : m2![2]);
    const mon = m ? m[2] : m2![1];
    const t = utc(today);
    let y = t.getUTCFullYear();
    let mo = mon ? MONTHS.indexOf(mon.slice(0, 3)) : t.getUTCMonth();
    const make = () => new Date(Date.UTC(y, mo, day));
    let d = make();
    if (iso(d) < today) {
      if (mon) y += 1;
      else mo += 1;
      d = make();
    }
    return day >= 1 && day <= 31 && d.getUTCDate() === day ? iso(d) : '';
  }
  return '';
}

const DUE = new RegExp(`(^|\\s)((?:(?:by|on|for|due|before|until)\\s+)?(the day after tomorrow|tomorrow|tmrw|today|tonight|next week|(?:this )?weekend|end of (?:the )?month|in (?:\\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten) (?:days?|weeks?)|(?:next |this )?${FULLDAY}|(?:next|this) ${SHORTDAY}|the ${ORD}(?: of ${MONTH})?|${ORD} (?:of )?${MONTH}|${MONTH} ${ORD}|\\d{1,2}(?:st|nd|rd|th)))${END}`, 'i');
const EVERY_RX = new RegExp(`(^|\\s)((?:every|each) (?:day|weekday|week|month|${FULLDAY}|${SHORTDAY})|daily|weekly|monthly|on weekdays|weekdays)${END}`, 'i');
const PRIO = /(^|\s)p([1-4])(?=$|[\s,.!?;])/i;
const PROJECT = /(^|\s)#([\p{L}\d][\p{L}\d_-]{0,29})(?:\/([\p{L}\d][\p{L}\d_-]{0,29}))?/u;
const TAG = /(^|\s)@([\p{L}\d][\p{L}\d_-]{0,29})/gu;
const BARE_TIME = /(^|\s)(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm)(?=$|[\s,.!?;])|(^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=$|[\s,.!?;])/i;
const EVERY_LABEL: Record<Every, string> = { daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week', monthly: 'Every month' };

/**
 * Read one typed line. `today` and `hm` are London's (londonNow); `drop` holds the keys of chips he tapped away (their words stay in
 * the to-do's words). Pure.
 */
export function quickParse(input: string, today: string, hm: string, drop: ReadonlySet<string> = new Set()): Quick {
  let s = ` ${input.replace(/\s+/g, ' ').trim()} `;
  const bits: QuickBit[] = [];
  const out: Quick = { text: '', due: '', time: '', p: 0, project: '', section: '', tags: [], bits };
  const cut = (m: RegExpExecArray, lead = m[1] ?? '') => {
    s = `${s.slice(0, m.index)}${lead ? ' ' : ''} ${s.slice(m.index + m[0].length)}`;
  };
  // tags (@phone), each its own chip
  for (const m of [...s.matchAll(TAG)]) {
    const tag = m[2]!.toLowerCase();
    if (drop.has(`tag:${tag}`) || out.tags.includes(tag)) continue;
    out.tags.push(tag);
    bits.push({ kind: 'tag', key: `tag:${tag}`, label: `@${tag}` });
  }
  if (out.tags.length) s = s.replace(TAG, (all, lead: string, t: string) => (out.tags.includes(t.toLowerCase()) ? `${lead} ` : all));
  // the project (#Home)
  let m = PROJECT.exec(s);
  if (m && !drop.has('project')) {
    out.project = m[2]!;
    out.section = m[3] ?? '';
    bits.push({ kind: 'project', key: 'project', label: `#${out.project}${out.section ? ` / ${out.section}` : ''}` });
    cut(m);
  }
  // the priority (p1 … p4; p4 is none, said as such)
  m = PRIO.exec(s);
  if (m && !drop.has('p')) {
    const n = Number(m[2]);
    out.p = (n === 4 ? 0 : n) as Quick['p'];
    bits.push({ kind: 'p', key: 'p', label: n === 4 ? 'No priority' : `P${n}` });
    cut(m);
  }
  // a repeat ("every Monday" is weekly from the next Monday, today if it is Monday)
  m = EVERY_RX.exec(s);
  let everyDay = '';
  if (m && !drop.has('every')) {
    const w = m[2]!.toLowerCase();
    const d = new RegExp(`^(?:every|each) (${FULLDAY}|${SHORTDAY})$`).exec(w);
    out.every = d ? 'weekly' : /weekday/.test(w) ? 'weekdays' : /^(?:every |each )?day$|^daily$/.test(w) ? 'daily' : /week/.test(w) ? 'weekly' : 'monthly';
    if (d) everyDay = nextWeekday(today, DAYS.indexOf(d[1]!.slice(0, 3)), true);
    const day = d ? utc(everyDay).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' }) : '';
    bits.push({ kind: 'every', key: 'every', label: d ? `Every ${day}` : EVERY_LABEL[out.every] });
    cut(m);
  }
  // the time it rings ("at 3pm", "at half 4", "at 15:30", "3pm")
  if (!drop.has('time')) {
    const st = splitTime(s.trim());
    if (st.time) {
      out.time = st.time;
      s = ` ${st.text} `;
    } else {
      m = BARE_TIME.exec(s);
      if (m) {
        const h = m[2] ? (Number(m[2]) % 12) + (m[4]!.toLowerCase() === 'pm' ? 12 : 0) : Number(m[6]);
        const mi = Number(m[2] ? m[3] ?? 0 : m[7]);
        if (h < 24 && mi < 60) {
          out.time = `${p2(h)}:${p2(mi)}`;
          cut(m, m[1] ?? m[5] ?? '');
        }
      }
    }
  }
  // the day ("tomorrow", "next Friday", "in 3 days", "by the 20th")
  m = DUE.exec(s);
  if (m && !drop.has('due')) {
    const d = dayFrom(m[3]!, today);
    if (d) {
      out.due = d;
      cut(m);
    }
  }
  if (!out.due && everyDay) out.due = everyDay;
  if (out.due && !(everyDay && out.due === everyDay)) bits.push({ kind: 'due', key: 'due', label: dayChip(out.due, today) });
  // (a time with no day: its chip says the day it will ring, today while the time is ahead, else tomorrow)
  if (out.time) bits.push({ kind: 'time', key: 'time', label: out.due || out.every ? out.time : `${out.time} ${hm < out.time ? 'today' : 'tomorrow'}` });
  const ORDER: QuickKind[] = ['due', 'time', 'every', 'p', 'project', 'tag'];
  bits.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const t = s.replace(/\s+/g, ' ').replace(/\s+([,.!?;])/g, '$1').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').replace(/\s+(?:on|by|at|for|due)$/i, '').trim();
  out.text = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  return out;
}

/** The chips' order and words as one line, for VoiceOver and the spec: "Tomorrow · 15:00 · P1 · #Home · @phone". */
export const quickLine = (q: Quick): string => q.bits.map((b) => b.label).join(' · ');
