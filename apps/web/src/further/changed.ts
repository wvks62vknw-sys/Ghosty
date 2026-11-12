/**
 * WHAT CHANGED SINCE YESTERDAY (BRIEF-OCT-IDEAS-3 item 6; STARS 167): one line a room on THE PLAN ("LEARN: I passed 2 more coach lessons",
 * "PLAN: 2 new alerts near Home", "LIFE: £42 more spent this month"), a room with nothing new says nothing, and "what changed?" reads
 * them all. Made on the phone from what it already holds of the shared mind (the readings the room cards keep) and its own stores:
 * each time the readings are in, today's are kept beside the earlier days' (`ghosty.since`, the last week, numbers only), and a line is
 * the difference between now and the latest earlier day. Nothing is guessed: a reading the phone has not got is not compared.
 */
import { loadChangedFacts, hubFacts } from '../shell/hubcards';
import { dayOf, loadProgress } from '../coach/progress';
import { guardian } from '../state/guardian';
import { home } from '../state/app';

export const SINCE_KEY = 'ghosty.since';

/** The readings, a room at a time (a number each; a reading not held is left out). */
export type Marks = Record<string, Record<string, number>>;
export interface ChangeLine {
  room: string;
  text: string;
}

const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));
const up = (now: Record<string, number> | undefined, was: Record<string, number> | undefined, k: string): number => {
  const a = now?.[k];
  const b = was?.[k];
  return a != null && b != null && a > b ? a - b : 0;
};
const pounds = (x: number) => `£${Math.round(x).toLocaleString('en-GB')}`;

/** The lines the difference makes, in the rooms' order (pure). `place` is the saved Home's name ("Home", "Birmingham"). */
export function diffLines(was: Marks, now: Marks, place = 'Home'): ChangeLine[] {
  const out: ChangeLine[] = [];
  const add = (room: string, parts: string[]) => parts.length && out.push({ room, text: `${and(parts).charAt(0).toUpperCase()}${and(parts).slice(1)}` });
  {
    const l = now.learn;
    const w = was.learn;
    const parts: string[] = [];
    const coach = up(l, w, 'coach');
    if (coach) parts.push(`I passed ${n(coach, 'more coach lesson')}`);
    const school = up(l, w, 'school');
    if (school) parts.push(`${parts.length ? 'passed' : 'I passed'} ${n(school, 'more school subject')}`);
    const gym = up(l, w, 'gym');
    if (gym) parts.push(`${parts.length ? 'went' : 'I went'} up ${n(gym, 'level')} in the GYM`);
    add('learn', parts);
  }
  {
    const a = up(now.plan, was.plan, 'alerts');
    add('plan', a ? [`${n(a, 'new alert')} near ${place}`] : []);
  }
  {
    const l = now.life;
    const w = was.life;
    const parts: string[] = [];
    // a month that turned over is a new total, not a rise
    const sameMonth = l?.moneyMonth != null && l?.moneyMonth === w?.moneyMonth;
    const spent = sameMonth ? up(l, w, 'money') : 0;
    if (spent >= 1) parts.push(`${pounds(spent)} more spent this month`);
    const people = up(l, w, 'people');
    if (people) parts.push(`${n(people, 'new person', 'new people')} you told me about`);
    const todo = up(l, w, 'todo');
    if (todo) parts.push(`${n(todo, 'more to-do')} done`);
    add('life', parts);
  }
  {
    const m = now.make;
    const w = was.make;
    const parts: string[] = [];
    const projects = up(m, w, 'projects');
    if (projects) parts.push(`I finished ${n(projects, 'project')}`);
    const kept = up(m, w, 'kept');
    if (kept) parts.push(`${n(kept, 'more 3-D model')} kept`);
    const taken = up(m, w, 'reverse');
    if (taken) parts.push(`${n(taken, 'more take-apart report')} ready`);
    add('make', parts);
  }
  return out;
}

/** The readings the phone holds now (what the room cards keep; null readings are left out). */
export function marksNow(): Marks {
  const m: Marks = { learn: {}, plan: {}, life: {}, make: {} };
  const put = (room: string, k: string, v: number | null | undefined) => {
    if (v != null && Number.isFinite(v)) m[room]![k] = v;
  };
  // (the coach's practice is on this phone: read as it is now, not as a card last read it)
  put('learn', 'coach', Object.keys(loadProgress().passed).length);
  put('learn', 'school', hubFacts.school ? hubFacts.school.passed : null);
  if (hubFacts.gym) put('learn', 'gym', [...hubFacts.gym.values()].reduce((a, r) => a + (r.level ?? 0), 0));
  const g = guardian.get().info;
  if (g) put('plan', 'alerts', g.places.find((p) => p.id === 'home')?.active.length ?? 0);
  if (hubFacts.money) {
    put('life', 'money', hubFacts.money.out);
    put('life', 'moneyMonth', Number(hubFacts.money.month.replace(/\D/g, '').slice(0, 6)));
  }
  put('life', 'people', hubFacts.people?.n);
  put('life', 'todo', hubFacts.work?.done);
  if (hubFacts.projects) put('make', 'projects', hubFacts.projects.filter((p) => p.status === 'done').length);
  put('make', 'kept', hubFacts.kept);
  if (hubFacts.reverse) put('make', 'reverse', hubFacts.reverse.filter((j) => j.status === 'done').length);
  for (const k of Object.keys(m)) if (!Object.keys(m[k]!).length) delete m[k];
  return m;
}

interface Kept {
  days: Record<string, Marks>;
  /** The day every room's readings were last all read (the network ones too), so the daily read is made once. */
  full?: string;
}
const load = (): Kept => {
  try {
    const v = JSON.parse(localStorage.getItem(SINCE_KEY) ?? 'null') as Kept | null;
    if (v && typeof v.days === 'object' && v.days) return { days: v.days, ...(typeof v.full === 'string' ? { full: v.full } : {}) };
  } catch {
    /* nothing kept yet */
  }
  return { days: {} };
};
const save = (k: Kept): void => {
  try {
    const keep = Object.keys(k.days).sort().slice(-7);
    localStorage.setItem(SINCE_KEY, JSON.stringify({ days: Object.fromEntries(keep.map((d) => [d, k.days[d]!])), ...(k.full ? { full: k.full } : {}) }));
  } catch {
    /* kept for this visit only */
  }
};

/** Today's readings, kept beside the earlier days' (each reading the phone holds replaces today's of the same name). */
export function keepToday(now = Date.now(), marks = marksNow()): void {
  const k = load();
  const today = dayOf(now);
  const t = (k.days[today] ??= {});
  for (const [room, vals] of Object.entries(marks)) t[room] = { ...(t[room] ?? {}), ...vals };
  save(k);
}

/** The latest earlier day kept, or null (the first day: there is nothing to compare with). */
export function yesterdayMarks(now = Date.now()): { day: string; marks: Marks } | null {
  const k = load();
  const today = dayOf(now);
  const day = Object.keys(k.days).filter((d) => d < today).sort().at(-1);
  return day ? { day, marks: k.days[day]! } : null;
}

/** The lines now: the difference between the readings held and the earlier day's. */
export function changedLines(now = Date.now()): ChangeLine[] {
  const y = yesterdayMarks(now);
  return y ? diffLines(y.marks, marksNow(), home().name || 'Home') : [];
}

/** Read what the rooms hold (their own throttled reads), keep today's, and say the lines. */
export async function refreshChanged(): Promise<ChangeLine[]> {
  await loadChangedFacts().catch(() => undefined);
  keepToday();
  const k = load();
  k.full = dayOf(Date.now());
  save(k);
  return changedLines();
}

/** True until the day's full read has been made (the readings of every room, the network ones too). */
export const needsDailyRead = (now = Date.now()): boolean => load().full !== dayOf(now);

/** What a test can read (window.__ghosty.changed). */
export const changedState = { lines: () => changedLines(), marks: marksNow, refresh: refreshChanged, yesterday: () => yesterdayMarks() };

/** The room's title as the plan writes it ("LEARN"). */
export const ROOM_TITLE: Record<string, string> = { learn: 'LEARN', plan: 'PLAN', life: 'LIFE', make: 'MAKE', see: 'SEE', me: 'ME', home: 'HOME' };

/** "what changed?" read out: a line a room, or why there is none. */
export function changedWords(lines: ChangeLine[], haveYesterday: boolean): string {
  if (lines.length) return lines.map((l) => `${ROOM_TITLE[l.room] ?? l.room.toUpperCase()}: ${l.text}`).join('\n');
  return haveYesterday ? 'Nothing has changed since yesterday that I can see from this phone.' : 'I only began keeping a picture of each day today, so I can’t say yet what changed. Ask me tomorrow.';
}
