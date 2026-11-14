/**
 * AN OPENING THAT KNOWS YOUR DAY (NEXT ROUND boot.u2): the one line the film's search ends on, from what the phone and his own brain
 * already hold: the next thing in today's diary (the shared day the Brief reads, asked once, given 2.5 s), else a to-do due today (kept
 * on this phone), else rain on the way (the forecast the phone already has; nothing is fetched for it). Nothing is sent but the diary's
 * own ask, which the Brief makes too. The words are shell/bootwords.ts dayFocusLine.
 */
import { brain } from '../api/brain';
import { weather } from '../data/weather';
import { loadTodos } from '../features/agenda/todo';
import { dueToday } from '../features/agenda/todowords';
import { rainWhen, stillToday } from '../features/brief/day';
import { dayFocusLine } from './bootwords';

const within = <T>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function dayFocus(now = Date.now()): Promise<string> {
  const mind = navigator.onLine === false ? null : await within(brain.mind(), 2500);
  const items = mind ? stillToday(mind.today, now) : null;
  const next = items?.find((x) => x.when !== 'Now') ?? items?.[0];
  if (next) return dayFocusLine({ event: { when: next.when, title: next.title } });
  let todo = '';
  try {
    todo = dueToday(loadTodos(), now)[0]?.text ?? '';
  } catch {
    /* no list on this phone */
  }
  if (todo) return dayFocusLine({ todo });
  const w = weather.data;
  const rain = w ? rainWhen(w.hourly.precipitation_probability, new Date(now).getHours()) : null;
  return dayFocusLine({ rain: rain?.wet ? rain.line : '' });
}
