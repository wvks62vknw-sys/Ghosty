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

/** The order the list keeps: open ones first (late, then by day, then those with no day, oldest added first), the done ones last (newest ticked first). */
export function sortTodos(l: readonly Todo[]): Todo[] {
  return [...l].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0);
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
  return sortTodos(l.filter((t) => !t.done && t.due && daysTo(t.due, now) <= 0));
}
