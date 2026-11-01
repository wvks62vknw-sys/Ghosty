/**
 * WHAT HE HAS PRACTISED (BRIEF-REST-B part 2): the days he practised, the best score on each lesson, the typing best, the
 * words of the day he has said back, the drawings of the day — kept on this phone (localStorage `ghosty.coach`, nothing sent),
 * a streak, and what to practise next. Pure apart from `load`/`save`.
 */
import { LESSONS, lessonById, lessonsFor, type Lesson, type Teach } from './lessons';

export interface Progress {
  v: 1;
  /** The days he practised anything, YYYY-MM-DD, the last 120. */
  days: string[];
  /** The best score (0–1) on each lesson. */
  best: Record<string, number>;
  /** The day each lesson was first passed. */
  passed: Record<string, string>;
  typing: { best: number; log: { d: string; wpm: number; acc: number }[]; /** The keys he missed most last time. */ weak?: string[] };
  /** Words said back, by language and day: how many of the ten. */
  words: Record<string, Record<string, number>>;
  /** The days he did the drawing of the day. */
  drawn: string[];
  /** The instrument he last practised. */
  last?: Teach;
}

export const newProgress = (): Progress => ({ v: 1, days: [], best: {}, passed: {}, typing: { best: 0, log: [] }, words: {}, drawn: [] });

/** Today as YYYY-MM-DD in the phone's own day. */
export const dayOf = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** The day's number (days since 1970), for the lists that turn over each day. */
export const dayNumber = (day: string): number => Math.floor(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000);

const before = (day: string, n = 1) => dayOf(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) - n, 12));

/** Practised today, or the same days in a row up to yesterday: how many (0 when yesterday was missed). */
export function streak(days: string[], today: string): number {
  const have = new Set(days);
  let day = have.has(today) ? today : before(today);
  let n = 0;
  while (have.has(day)) {
    n++;
    day = before(day);
  }
  return n;
}

export const markDay = (p: Progress, day: string): Progress => (p.days.includes(day) ? p : { ...p, days: [...p.days, day].sort().slice(-120) });

/** A lesson done: the best score kept, the first pass dated, the day marked. */
export function recordLesson(p: Progress, id: string, score: number, passed: boolean, day: string): Progress {
  const l = lessonById(id);
  const q = markDay({ ...p, best: { ...p.best, [id]: Math.max(p.best[id] ?? 0, score) }, ...(l ? { last: l.instrument } : {}) }, day);
  return passed && !q.passed[id] ? { ...q, passed: { ...q.passed, [id]: day } } : q;
}

export function recordTyping(p: Progress, wpm: number, acc: number, day: string, weak: string[] = []): Progress {
  const log = [...p.typing.log, { d: day, wpm: Math.round(wpm), acc: Math.round(acc * 100) / 100 }].slice(-30);
  return markDay({ ...p, typing: { best: Math.max(p.typing.best, Math.round(wpm)), log, weak } }, day);
}

export const recordWords = (p: Progress, lang: string, day: string, said: number): Progress => markDay({ ...p, words: { ...p.words, [lang]: { ...(p.words[lang] ?? {}), [day]: Math.max(said, p.words[lang]?.[day] ?? 0) } } }, day);
export const recordDrawing = (p: Progress, day: string): Progress => markDay(p.drawn.includes(day) ? p : { ...p, drawn: [...p.drawn, day].slice(-120) }, day);

/** What to practise next on an instrument: the first lesson not yet passed; when all ten are, the one he did worst. */
export function nextLesson(p: Progress, instrument: Teach): { lesson: Lesson; why: string } {
  const ls = lessonsFor(instrument);
  const open = ls.find((l) => !p.passed[l.id]);
  if (open) {
    const b = p.best[open.id];
    return { lesson: open, why: b ? `you got ${Math.round(b * 100)}% on it last time; ${Math.round(open.pass * 100)}% passes` : ls[0] === open ? 'it is the first one' : 'it is the next one' };
  }
  const worst = [...ls].sort((a, b) => (p.best[a.id] ?? 0) - (p.best[b.id] ?? 0))[0]!;
  return { lesson: worst, why: `all ten are passed; this is the one you scored least on (${Math.round((p.best[worst.id] ?? 0) * 100)}%)` };
}

/** The instrument to open with: the one he last practised, else the first with a lesson not yet passed (guitar). */
export const startInstrument = (p: Progress): Teach => p.last ?? 'guitar';

/** "A 3-day streak. Next on guitar: lesson 4, A minor, a string at a time (it is the next one)." */
export function practiceWords(p: Progress, today: string, instrument: Teach = startInstrument(p)): string {
  const s = streak(p.days, today);
  const n = nextLesson(p, instrument);
  const passed = LESSONS.filter((l) => l.instrument === instrument && p.passed[l.id]).length;
  return `${s ? `A ${s}-day streak. ` : p.days.length ? 'The streak starts again today. ' : ''}${instrument[0]!.toUpperCase()}${instrument.slice(1)}: ${passed} of 10 passed. Next: lesson ${n.lesson.n}, ${n.lesson.title.toLowerCase()} (${n.why}).`;
}

const KEY = 'ghosty.coach';
export function parseProgress(raw: unknown): Progress {
  const p = raw as Partial<Progress> | null;
  if (!p || p.v !== 1 || !Array.isArray(p.days) || typeof p.best !== 'object' || !p.typing) return newProgress();
  return { ...newProgress(), ...p } as Progress;
}
export function loadProgress(): Progress {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return newProgress();
  }
}
export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* no storage: it lasts until the page closes */
  }
}
