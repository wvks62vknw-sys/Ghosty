/**
 * THE AGENDA'S TO-DO LIST AND MONTH, their words and their order, pure (the planlane spec imports this file): what is due said
 * in his words ("Due today", "2 days late"), the order a to-do list keeps (late first, then by day, then the ones with no day,
 * the done ones last), and the month's grid of days. Nothing here touches the page or the phone's storage.
 */

export interface Todo {
  id: string;
  text: string;
  /** the day it is due, "2026-11-13" (local), or '' for no day */
  due: string;
  done: boolean;
  /** when it was added and when it was ticked (ms) */
  at: number;
  doneAt?: number;
  /** a star for the important ones (they come right after the late ones) */
  star?: boolean;
  /** a to-do that comes back: ticking it makes the next one (todo.ts) */
  every?: Every;
}
export type Every = 'daily' | 'weekdays' | 'weekly' | 'monthly';
export const EVERY: [Every | '', string][] = [['', 'Once'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Every week'], ['monthly', 'Every month']];
/** "every day", "weekdays"… in his words, lower case; '' for a one-off. */
export const everyWords = (e?: Every | ''): string => (e ? (EVERY.find(([v]) => v === e)?.[1] ?? '').toLowerCase() : '');

/** The day the next one of a repeating to-do is due: one step on from its own day (or from today, if it had none); never a day already gone. */
export function nextDue(due: string, every: Every, now: number): string {
  const [y, m, d] = (due || dayOf(now)).split('-').map(Number);
  const t = new Date(y!, m! - 1, d!);
  const step = () => {
    if (every === 'daily') t.setDate(t.getDate() + 1);
    else if (every === 'weekly') t.setDate(t.getDate() + 7);
    else if (every === 'monthly') {
      t.setDate(1);
      t.setMonth(t.getMonth() + 1);
      t.setDate(Math.min(d!, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
    } else
      do t.setDate(t.getDate() + 1);
      while (t.getDay() === 0 || t.getDay() === 6);
  };
  step();
  // one ticked days late comes back on a day still to come, not in the past
  for (let i = 0; i < 400 && daysTo(dayOf(t.getTime()), now) <= 0; i++) step();
  return dayOf(t.getTime());
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** A local day as "2026-11-13". */
export const dayOf = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
/** Whole days from today to `due` (negative when it is late). */
export function daysTo(due: string, now: number): number {
  const [y, m, d] = due.split('-').map(Number);
  const a = new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
  const t = new Date(now);
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((a - b) / 86400_000);
}

/** When a to-do is due, in his words: "Due today", "Due tomorrow", "Due Fri 20 Nov", "1 day late", "3 days late"; '' with no day. */
export function dueWords(due: string, now: number): string {
  if (!due) return '';
  const n = daysTo(due, now);
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n < 0) return `${-n} ${n === -1 ? 'day' : 'days'} late`;
  const [y, m, d] = due.split('-').map(Number);
  return `Due ${new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

/** The order the list keeps: open ones first (late, then starred, then by day, then those with no day, oldest added first), the done ones last (newest ticked first). */
export function sortTodos(l: readonly Todo[], now = Date.now()): Todo[] {
  const late = (t: Todo) => !!t.due && daysTo(t.due, now) < 0;
  return [...l].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0);
    if (late(a) !== late(b)) return late(a) ? -1 : 1;
    if (!!a.star !== !!b.star) return a.star ? -1 : 1;
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return a.at - b.at;
  });
}

/** The list's line: "3 to do · 1 late · 2 done" or the empty words. */
export function todoLine(l: readonly Todo[], now: number): string {
  const open = l.filter((t) => !t.done);
  const late = open.filter((t) => t.due && daysTo(t.due, now) < 0).length;
  const today = open.filter((t) => t.due && daysTo(t.due, now) === 0).length;
  const done = l.length - open.length;
  if (!l.length) return '';
  return [`${open.length} to do`, late ? `${late} late` : '', today ? `${today} due today` : '', done ? `${done} done` : ''].filter(Boolean).join(' · ');
}

/** The views of the list: everything, what is due today (and late), what has a day ahead, the starred ones. */
export type TodoView = 'all' | 'today' | 'upcoming' | 'starred';
export const VIEWS: [TodoView, string][] = [['all', 'All'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['starred', 'Starred']];
export function inView(t: Todo, v: TodoView, now: number): boolean {
  if (v === 'all') return true;
  if (v === 'starred') return !!t.star;
  if (v === 'today') return !t.done ? !!t.due && daysTo(t.due, now) <= 0 : !!t.doneAt && dayOf(t.doneAt) === dayOf(now);
  return !t.done && !!t.due && daysTo(t.due, now) > 0;
}
/** What an empty view says (the list itself has things in it). */
export const VIEW_EMPTY: Record<Exclude<TodoView, 'all'>, string> = {
  today: 'Nothing due today. Tap All to see the rest.',
  upcoming: 'Nothing with a day ahead. Give a to-do a day and it shows here.',
  starred: 'Nothing starred. Tap ☆ on a to-do that matters and it shows here.',
};

/** His words for a to-do, made plain for matching ("I've done the passport" finds "Renew passport"). */
const plain = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(?:the|my|a|an|to|of|for|off)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** The to-do `words` name, among the open ones of `l` (or the done ones): exactly, then one holding all the words, then most words in common. */
export function findTodo(l: readonly Todo[], words: string, done = false): Todo | null {
  const w = plain(words);
  if (!w) return null;
  const pool = l.filter((t) => t.done === done);
  const exact = pool.find((t) => plain(t.text) === w);
  if (exact) return exact;
  const has = pool.find((t) => ` ${plain(t.text)} `.includes(` ${w} `) || ` ${w} `.includes(` ${plain(t.text)} `));
  if (has) return has;
  const ws = w.split(' ').filter((x) => x.length > 2);
  let best: Todo | null = null;
  let score = 0;
  for (const t of pool) {
    const tw = new Set(plain(t.text).split(' '));
    const n = ws.filter((x) => tw.has(x) || tw.has(x.replace(/s$/, ''))).length;
    if (n > score) [best, score] = [t, n];
  }
  return score && score * 2 >= ws.length ? best : null;
}

export const TODO_EMPTY = { head: 'Nothing to do', line: 'Type a to-do above and tap ADD. Give it a day if it has one; it stays on this phone.' };
export const TODO_ALL_DONE = 'All done. Nice work.';
export const TODO_NEED_TEXT = 'Type what needs doing first';

/** The month as a grid: weeks of seven days, Monday first; a day outside the month is null. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A day's line under the month: "Friday 20 November: 2 events" or "…: nothing on". */
export function dayLine(t: number, events: number, todos: number): string {
  const d = new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const bits = [events ? `${events} ${events === 1 ? 'event' : 'events'}` : '', todos ? `${todos} ${todos === 1 ? 'to-do' : 'to-dos'} due` : ''].filter(Boolean);
  return `${d}: ${bits.length ? bits.join(', ') : 'nothing on'}`;
}
/** How far ahead the month can show what is on: what the diary reads (the brain gives up to 62 days). */
export const AHEAD_DAYS = 42;
export const beyondWords = 'Further ahead than I read your calendars. Events you add still show in the diary.';
export const pastWords = 'This day has gone. The diary shows what is still to come.';
/** The open to-dos due today or late (late first): the brief's TO-DO line. */
export function dueToday(l: readonly Todo[], now: number): Todo[] {
  return sortTodos(l.filter((t) => !t.done && t.due && daysTo(t.due, now) <= 0), now);
}
