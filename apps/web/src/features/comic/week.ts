/**
 * YOUR WEEK AS A COMIC (NEXT ROUND, comic.s3; with PLAN's plan.c5): this week from his own agenda and the to-dos he ticked,
 * day by day, as a short comic to keep. Only his own data: an event's title and day, never where it is. Ghosty writes it when
 * the brain is in reach (the week as the idea); with no signal the phone writes it, a panel a day, each with a line that fits
 * what the day held. Pure.
 */
import { lookFor, newId, writeComic, type Comic, type Mood, type Page, type Panel, type Pose, type Scene } from './model';

export interface WeekItem {
  /** local day, 0 Monday … 6 Sunday */
  day: number;
  title: string;
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Monday 00:00 of the week holding `now`, local time. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** His week's things: events from Monday to Sunday and the to-dos he ticked this week (titles only, never a place). */
export function weekItems(events: readonly { title: string; start: number }[], todos: readonly { text: string; done: boolean; doneAt?: number }[], now = Date.now()): WeekItem[] {
  const from = weekStart(now);
  const to = from + 7 * 86_400_000;
  const dayOf = (t: number) => Math.min(6, Math.max(0, Math.floor((t - from) / 86_400_000)));
  const out: WeekItem[] = [];
  for (const e of events) if (e.start >= from && e.start < to && e.title.trim()) out.push({ day: dayOf(e.start), title: e.title.trim().slice(0, 60) });
  for (const t of todos) if (t.done && t.doneAt && t.doneAt >= from && t.doneAt < to) out.push({ day: dayOf(t.doneAt), title: `ticked off: ${t.text.trim().slice(0, 50)}` });
  return out.sort((a, b) => a.day - b.day).slice(0, 24);
}

/** The week said as an idea for Ghosty to write from. */
export function weekIdea(items: readonly WeekItem[], name: string): string {
  const by = DAYS.map((d, i) => [d, items.filter((x) => x.day === i).map((x) => x.title)] as const).filter(([, l]) => l.length);
  return `${name || 'me'}'s week, day by day: ${by.map(([d, l]) => `${d}: ${l.join(', ')}`).join('; ')}. Make it a fond, funny keepsake of the week.`;
}

/** What a day's things suggest: where it happens and a line for it (the joke a friend would make). */
function dayBeat(titles: string[]): { scene: Scene; mood: Mood; pose: Pose; line: string; sfx: string } {
  const t = titles.join(' ').toLowerCase();
  if (titles.every((x) => /^ticked off/i.test(x))) return { scene: 'home', mood: 'smug', pose: 'cheer', line: 'Done. Look at me, getting things done.', sfx: 'TICK!' };
  if (/\b(gym|run|swim|football|yoga|training|workout|match|bike)\b/.test(t)) return { scene: 'park', mood: 'happy', pose: 'run', line: 'My legs have filed a formal complaint.', sfx: 'PUFF PUFF!' };
  if (/\b(meeting|call|standup|review|interview|work|office|deadline)\b/.test(t)) return { scene: 'home', mood: 'think', pose: 'sit', line: 'This could have been an email. It was not an email.', sfx: '' };
  if (/\b(dentist|doctor|gp|hospital|vet|appointment)\b/.test(t)) return { scene: 'town', mood: 'scared', pose: 'stand', line: 'Brave face. Very brave face.', sfx: 'GULP!' };
  if (/\b(dinner|lunch|breakfast|cook|bake|pizza|cafe|restaurant|party|drinks|birthday)\b/.test(t)) return { scene: 'kitchen', mood: 'happy', pose: 'cheer', line: 'Best part of the week, and it is not close.', sfx: 'NOM!' };
  if (/\b(school|class|lesson|exam|course|study)\b/.test(t)) return { scene: 'school', mood: 'think', pose: 'point', line: 'I learned something. I think. Ask me later.', sfx: '' };
  if (/\b(trip|flight|train|holiday|drive|travel)\b/.test(t)) return { scene: 'town', mood: 'happy', pose: 'run', line: 'Bags packed. Mostly. One sock.', sfx: 'VROOM!' };
  if (/ticked off/.test(t)) return { scene: 'home', mood: 'smug', pose: 'cheer', line: 'Done. Look at me, getting things done.', sfx: 'TICK!' };
  return { scene: 'town', mood: 'calm', pose: 'stand', line: 'A perfectly reasonable day.', sfx: '' };
}

/** The phone's own week comic: a cover and a panel for each day that held something, the week's star as the hero. */
export function weekComic(items: readonly WeekItem[], name: string, seed = Date.now() % 100000): Comic {
  const hero = (name || 'Me').slice(0, 24);
  const base = writeComic({ idea: `${hero}'s week`, hero, friend: 'Future Me', rival: 'Monday', seed });
  base.cast[0]!.look = lookFor('person', seed ^ 0x51);
  const panels: Panel[] = [];
  DAYS.forEach((d, i) => {
    const titles = items.filter((x) => x.day === i).map((x) => x.title.replace(/^ticked off: /, 'Ticked off: '));
    if (!titles.length) return;
    const b = dayBeat(titles);
    panels.push({
      id: newId('p'), scene: b.scene, time: i >= 5 ? 'day' : 'day', shot: panels.length % 3 === 0 ? 'wide' : 'mid',
      actors: [{ who: 'hero', mood: b.mood, pose: b.pose, x: 0.45, face: 1 }],
      balloons: [{ id: newId('b'), who: 'hero', kind: 'speech', text: b.line }],
      caption: `${d}: ${titles.join(', ')}`.slice(0, 140), sfx: b.sfx, beat: `${d}, as it was`,
    });
  });
  const last: Panel = {
    id: newId('p'), scene: 'home', time: 'night', shot: 'mid',
    actors: [{ who: 'hero', mood: 'happy', pose: 'sit', x: 0.35, face: 1 }, { who: 'friend', mood: 'smug', pose: 'stand', x: 0.72, face: -1 }],
    balloons: [{ id: newId('b'), who: 'friend', kind: 'speech', text: 'Same again next week?' }, { id: newId('b'), who: 'hero', kind: 'speech', text: 'Ask me on Monday.' }],
    caption: 'THE END… until next week.', sfx: '', beat: 'The week, done',
  };
  panels.push(last);
  const pages: Page[] = [];
  for (let i = 0; i < panels.length; i += 4) pages.push({ id: newId('g'), layout: 0, panels: panels.slice(i, i + 4) });
  return { ...base, title: `${hero}’s Week`, tagline: 'Seven days. One hero. Mostly on time.', premise: `${hero}'s week, day by day, from the agenda.`, idea: weekIdea(items, hero), pages };
}
