/**
 * The LEARN tab's copy of the tutor on this phone (localStorage `ghosty.learn`): the courses, every
 * flashcard, the lessons already opened, the last quizzes and the streak — so revision, reading
 * and the streak work with no connection. Revisions made here are queued (`pending`) and sent to
 * the brain (POST /api/learn/review) when it is reachable; the brain replays them with the same
 * SM-2 (packages/shared/src/sm2.ts), so both copies agree.
 */
import type { AnswerResult, Card, Course, CourseLesson, CourseSummary, LearnLevel, LearnState, Quiz, Review } from '../../../../../packages/shared/src/learn';
import { dayKey, emptyStreak, markDay, mergeStreaks, rate, type Rating, type Streak } from '../../../../../packages/shared/src/sm2';
import { headers } from '../../api/brain';
import { createStore } from '../../core/store';

export interface Mirror {
  courses: CourseSummary[];
  cards: Card[];
  /** Full courses (with the lessons opened so far), by id. */
  full: Record<string, Course>;
  quizzes: Quiz[];
  pending: Review[];
  streak: Streak;
  /** When the brain last answered (0 never). */
  synced: number;
}

export const learn = createStore<Mirror>({ courses: [], cards: [], full: {}, quizzes: [], pending: [], streak: emptyStreak(), synced: 0 }, { persist: 'ghosty.learn' });

/** One request to the brain's /api/learn routes; its error text when it refuses. */
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/learn${path}`, {
    method,
    headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const j = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok || !j) throw new Error(j?.error ?? `the brain answered ${r.status}`);
  return j;
}

export const today = () => dayKey(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

/** Today counts for the streak on this phone too (the brain counts it on its side). */
export function touchDay(): void {
  learn.set((s) => ({ streak: markDay(s.streak, today()) }));
}

/** The cards with this phone's not-yet-sent revisions on top. */
function withPending(cards: Card[], pending: Review[]): Card[] {
  if (!pending.length) return cards;
  const out = cards.map((c) => ({ ...c }));
  for (const r of [...pending].sort((a, b) => a.at - b.at)) {
    const i = out.findIndex((c) => c.id === r.card);
    if (i >= 0 && r.at > out[i]!.last) out[i] = { ...out[i]!, ...rate(out[i]!, r.rating, r.at) };
  }
  return out;
}

/** Send the queued revisions; true when none are left. */
export async function flush(): Promise<boolean> {
  const pending = learn.get().pending;
  if (!pending.length) return true;
  try {
    await call('POST', '/review', { reviews: pending });
    learn.set((s) => ({ pending: s.pending.filter((p) => !pending.includes(p)) }));
    return true;
  } catch {
    return false;
  }
}

/** Fetch everything from the brain (after sending what waits); the phone's copy stays when it is unreachable. */
export async function sync(): Promise<boolean> {
  await flush();
  try {
    const st = await call<LearnState>('GET', '');
    learn.set((s) => {
      const ids = new Set(st.courses.map((c) => c.id));
      const full = Object.fromEntries(Object.entries(s.full).filter(([id]) => ids.has(id)));
      return { courses: st.courses, cards: withPending(st.cards, s.pending), full, streak: mergeStreaks(s.streak, st.streak), synced: Date.now() };
    });
    return true;
  } catch {
    return false;
  }
}

export async function startCourse(topic: string, level: LearnLevel, minutes: number): Promise<Course> {
  const { course } = await call<{ course: Course }>('POST', '/course', { topic, level, minutes });
  keepCourse(course);
  await sync();
  return course;
}

export function keepCourse(c: Course): void {
  learn.set((s) => ({ full: { ...s.full, [c.id]: c } }));
}

/** The whole course (the brain's copy, else this phone's). */
export async function course(id: string): Promise<Course | null> {
  try {
    const { course: c } = await call<{ course: Course }>('GET', `/course/${encodeURIComponent(id)}`);
    keepCourse(c);
    return c;
  } catch {
    return learn.get().full[id] ?? null;
  }
}

/** A lesson: kept on the phone once written, so it can be read again offline. */
export async function lesson(courseId: string, n: number): Promise<CourseLesson> {
  const have = learn.get().full[courseId]?.lessons.find((l) => l.n === n);
  if (have?.text) return have;
  const { lesson: l } = await call<{ lesson: CourseLesson }>('POST', '/lesson', { course: courseId, n });
  const c = learn.get().full[courseId];
  // Only a written lesson is kept (one that comes back as bare passages has no check question and is tried again later).
  if (c && l.check) keepCourse({ ...c, lessons: c.lessons.map((x) => (x.n === l.n ? l : x)) });
  return l;
}

export async function finishLesson(courseId: string, n: number): Promise<void> {
  touchDay();
  const was = learn.get().full[courseId];
  const c = was ? { ...was, lessons: was.lessons.map((x) => (x.n === n && !x.done ? { ...x, done: Date.now() } : x)) } : undefined;
  if (c) keepCourse(c);
  learn.set((s) => ({ courses: s.courses.map((x) => (x.id === courseId ? progressed(x, c) : x)) }));
  // The brain's own count wins when it answers (it also knows lessons finished elsewhere).
  const r = await call<{ course: CourseSummary | null }>('POST', '/done', { course: courseId, n }).catch(() => null);
  if (r?.course) learn.set((s) => ({ courses: s.courses.map((x) => (x.id === courseId ? { ...x, ...r.course } : x)) }));
}

function progressed(x: CourseSummary, c: Course | undefined): CourseSummary {
  if (!c) return x;
  const next = c.lessons.find((l) => !l.done);
  return { ...x, done: c.lessons.filter((l) => l.done).length, next: next?.n ?? 0, nextTitle: next?.title ?? '' };
}

export async function removeCourse(id: string): Promise<void> {
  await call('DELETE', `/course/${encodeURIComponent(id)}`);
  learn.set((s) => {
    const full = { ...s.full };
    delete full[id];
    return { courses: s.courses.filter((c) => c.id !== id), cards: s.cards.filter((c) => c.course !== id), full };
  });
}

export async function quiz(a: { course?: string; topic?: string; n?: number }): Promise<Quiz> {
  const { quiz: q } = await call<{ quiz: Quiz }>('POST', '/quiz', a);
  learn.set((s) => ({ quizzes: [q, ...s.quizzes.filter((x) => x.id !== q.id)].slice(0, 6) }));
  return q;
}

/** A quiz the brain made (the chat's quiz_me): from this phone's copy, else the brain. */
export async function quizById(id: string): Promise<Quiz | null> {
  const have = learn.get().quizzes.find((q) => q.id === id);
  if (have) return have;
  try {
    const { quiz: q } = await call<{ quiz: Quiz }>('GET', `/quiz/${encodeURIComponent(id)}`);
    learn.set((s) => ({ quizzes: [q, ...s.quizzes].slice(0, 6) }));
    return q;
  } catch {
    return null;
  }
}

/** Mark an answer on the brain (it keeps the score and makes a card of a wrong one). */
export async function answer(a: { quiz?: string; q?: string; course?: string; lesson?: number; answer: unknown }): Promise<AnswerResult> {
  const r = await call<AnswerResult>('POST', '/answer', a);
  touchDay();
  if (r.card) learn.set((s) => ({ cards: s.cards.some((c) => c.id === r.card!.id) ? s.cards : [...s.cards, r.card!] }));
  return r;
}

export async function addCard(course: string, front: string, back: string): Promise<Card> {
  const { card } = await call<{ card: Card }>('POST', '/card', { course, front, back });
  learn.set((s) => ({ cards: s.cards.some((c) => c.id === card.id) ? s.cards : [...s.cards, card] }));
  return card;
}

/** One flip of a card here: SM-2 on the phone at once, the revision queued for the brain. */
export function review(card: Card, rating: Rating): Card {
  const at = Date.now();
  const next = { ...card, ...rate(card, rating, at) };
  learn.set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? next : c)), pending: [...s.pending, { course: card.course, card: card.id, rating, at }].slice(-400) }));
  touchDay();
  return next;
}

/** The cards due now, the most overdue first. */
export const dueCards = (now = Date.now()) => learn.get().cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
