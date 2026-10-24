/**
 * The LEARN tab's copy of the tutor on this phone (localStorage `ghosty.learn`): the courses, every
 * flashcard, the lessons already opened, the last quizzes, the exam under way and the streak — so
 * revision, reading, the exam's clock and the streak work with no connection. Revisions made here
 * are queued (`pending`) and sent to the brain (POST /api/learn/review) when it is reachable; the
 * brain replays them with the same SM-2 (packages/shared/src/sm2.ts), so both copies agree. An
 * exam's answers stay here until its end (no feedback before); one finished with the brain out of
 * reach waits (`finishing`) and is marked when it is back.
 */
import type { AnswerResult, Card, Confidence, Course, CourseLesson, CourseSummary, Exam, ExamAnswer, ExamMarked, LearnLevel, LearnState, Quiz, Review } from '../../../../../packages/shared/src/learn';
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
  /** Lessons finished here that the brain has not heard about yet (sent before the next fetch). */
  pendingDone: Done[];
  streak: Streak;
  /** When the brain last answered (0 never). */
  synced: number;
  /** The exam under way (one at a time), with this phone's answers and its deadline on this phone's clock. */
  exam?: OpenExam | null;
}

export interface OpenExam {
  exam: Exam;
  answers: ExamAnswer[];
  /** The question showing. */
  i: number;
  /** When time is up, on this phone's clock (the brain's deadline less the brain's now, from when it was fetched). */
  endsAt: number;
  /** Ended here, waiting to be marked by the brain (and when it ended, on this phone's clock). */
  finishing?: boolean;
  finishedAt?: number;
}

export interface Done {
  course: string;
  n: number;
  at: number;
}

export const learn = createStore<Mirror>({ courses: [], cards: [], full: {}, quizzes: [], pending: [], pendingDone: [], streak: emptyStreak(), synced: 0, exam: null }, { persist: 'ghosty.learn' });

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

/** This phone's time zone (the owner's: the course's pace and the streak count its days). */
export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const today = () => dayKey(Date.now(), tz());

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

/** A course with this phone's not-yet-sent finished lessons on top (the brain's copy would undo them). */
function withDone(c: Course, done: Done[]): Course {
  const mine = done.filter((d) => d.course === c.id);
  if (!mine.length) return c;
  return { ...c, lessons: c.lessons.map((l) => (l.done ? l : { ...l, done: mine.find((d) => d.n === l.n)?.at ?? l.done })) };
}

/** Send the finished lessons and the queued revisions; true when none are left. */
export async function flush(): Promise<boolean> {
  let sent = true;
  for (const d of learn.get().pendingDone ?? []) {
    try {
      await call('POST', '/done', { course: d.course, n: d.n });
      learn.set((s) => ({ pendingDone: (s.pendingDone ?? []).filter((x) => x !== d) }));
    } catch {
      // Unreachable now (or refused): kept for the next flush; the revisions still go.
      sent = false;
      break;
    }
  }
  // An exam ended while the brain was out of reach: marked now.
  if (learn.get().exam?.finishing) await finishExam().catch(() => (sent = false));
  const pending = learn.get().pending;
  if (!pending.length) return sent;
  try {
    await call('POST', '/review', { reviews: pending });
    learn.set((s) => ({ pending: s.pending.filter((p) => !pending.includes(p)) }));
    return sent;
  } catch {
    return false;
  }
}

/** Fetch everything from the brain (after sending what waits); the phone's copy stays when it is unreachable. */
export async function sync(): Promise<boolean> {
  await flush();
  try {
    const got = await call<LearnState>('GET', '');
    // (a course on its way out, its UNDO bar still up, stays out)
    const st = { ...got, courses: got.courses.filter((c) => !leaving.has(c.id)), cards: got.cards.filter((c) => !leaving.has(c.course)) };
    learn.set((s) => {
      const ids = new Set(st.courses.map((c) => c.id));
      const full = Object.fromEntries(Object.entries(s.full).filter(([id]) => ids.has(id)).map(([id, c]) => [id, withDone(c, s.pendingDone ?? [])]));
      // A course with lessons still to send counts them, unless the brain already knows of more.
      const courses = st.courses.map((x) => {
        const p = (s.pendingDone ?? []).some((d) => d.course === x.id) ? progressed(x, full[x.id]) : x;
        return p.done > x.done ? p : x;
      });
      return { courses, cards: withPending(st.cards, s.pending), full, streak: mergeStreaks(s.streak, st.streak), synced: Date.now() };
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
    const { course: got } = await call<{ course: Course }>('GET', `/course/${encodeURIComponent(id)}`);
    const c = withDone(got, learn.get().pendingDone ?? []);
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
  // Only a written lesson is kept (one that comes back as bare passages has no parts or check question and is tried again later).
  if (c && (l.check || l.parts)) keepCourse({ ...c, lessons: c.lessons.map((x) => (x.n === l.n ? l : x)) });
  return l;
}

export async function finishLesson(courseId: string, n: number): Promise<void> {
  touchDay();
  const was = learn.get().full[courseId];
  const c = was ? { ...was, lessons: was.lessons.map((x) => (x.n === n && !x.done ? { ...x, done: Date.now() } : x)) } : undefined;
  if (c) keepCourse(c);
  learn.set((s) => ({ courses: s.courses.map((x) => (x.id === courseId ? progressed(x, c) : x)) }));
  // The brain's own count wins when it answers (it also knows lessons finished elsewhere);
  // unreachable, the lesson waits in pendingDone and goes with the next flush.
  const r = await call<{ course: CourseSummary | null; card?: Card }>('POST', '/done', { course: courseId, n }).catch(() => undefined);
  if (r === undefined) learn.set((s) => ({ pendingDone: [...(s.pendingDone ?? []).filter((d) => d.course !== courseId || d.n !== n), { course: courseId, n, at: Date.now() }].slice(-100) }));
  else {
    if (r.course) learn.set((s) => ({ courses: s.courses.map((x) => (x.id === courseId ? { ...x, ...r.course } : x)) }));
    // The lesson's one line, now a card (back tomorrow).
    if (r.card) keepCards([r.card]);
  }
}

function keepCards(cards: Card[]): void {
  learn.set((s) => ({ cards: [...s.cards, ...cards.filter((c) => !s.cards.some((x) => x.id === c.id))] }));
}

function progressed(x: CourseSummary, c: Course | undefined): CourseSummary {
  if (!c) return x;
  const next = c.lessons.find((l) => !l.done);
  return { ...x, done: c.lessons.filter((l) => l.done).length, next: next?.n ?? 0, nextTitle: next?.title ?? '' };
}

/** Courses REMOVEd with the UNDO bar still up: gone from this phone's list, not yet from the brain. */
const leaving = new Set<string>();

/**
 * REMOVE with UNDO: the course, its cards and its lessons leave this phone's lists now, and the brain is told only
 * when the bar goes (`commit`); `undo` before then puts each back exactly where it was.
 */
export function removeCourseLater(id: string): { undo(): void; commit(): Promise<void> } {
  const was = learn.get();
  const at = was.courses.findIndex((c) => c.id === id);
  const course = was.courses[at];
  const cards = was.cards.filter((c) => c.course === id);
  const full = was.full[id];
  const done = (was.pendingDone ?? []).filter((d) => d.course === id);
  leaving.add(id);
  dropHere(id);
  return {
    undo() {
      leaving.delete(id);
      learn.set((s) => {
        const courses = s.courses.filter((c) => c.id !== id);
        if (course) courses.splice(Math.max(0, Math.min(at, courses.length)), 0, course);
        return { courses, cards: [...s.cards, ...cards.filter((c) => !s.cards.some((x) => x.id === c.id))], full: full ? { ...s.full, [id]: full } : s.full, pendingDone: [...(s.pendingDone ?? []), ...done] };
      });
    },
    async commit() {
      try {
        await call('DELETE', `/course/${encodeURIComponent(id)}`);
      } finally {
        leaving.delete(id);
      }
    },
  };
}

function dropHere(id: string): void {
  learn.set((s) => {
    const full = { ...s.full };
    delete full[id];
    return { courses: s.courses.filter((c) => c.id !== id), cards: s.cards.filter((c) => c.course !== id), full, pendingDone: (s.pendingDone ?? []).filter((d) => d.course !== id) };
  });
}

export async function removeCourse(id: string): Promise<void> {
  await call('DELETE', `/course/${encodeURIComponent(id)}`);
  learn.set((s) => {
    const full = { ...s.full };
    delete full[id];
    return { courses: s.courses.filter((c) => c.id !== id), cards: s.cards.filter((c) => c.course !== id), full, pendingDone: (s.pendingDone ?? []).filter((d) => d.course !== id) };
  });
}

export async function quiz(a: { course?: string; topic?: string; n?: number; lesson?: number }): Promise<Quiz> {
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

/** Mark an answer on the brain (it keeps the score, the confidence, and makes a card of a wrong or guessed one). */
export async function answer(a: { quiz?: string; q?: string; course?: string; lesson?: number; answer: unknown; conf?: Confidence }): Promise<AnswerResult> {
  const r = await call<AnswerResult>('POST', '/answer', a);
  touchDay();
  if (r.card) keepCards([r.card]);
  return r;
}

/**
 * The course's exam: the one under way on this phone (resumed, its clock still running), else the
 * brain's (a new one, or one started elsewhere with the time it has left).
 */
export async function startExam(courseId: string): Promise<OpenExam> {
  const have = learn.get().exam;
  if (have && have.exam.course === courseId) return have;
  if (have && !have.finishing) throw new Error(`finish the exam on "${have.exam.title}" first`);
  const { exam, now } = await call<{ exam: Exam; now: number }>('POST', '/exam', { course: courseId });
  const open: OpenExam = { exam, answers: [], i: 0, endsAt: Date.now() + Math.max(0, exam.ends - (now || exam.started)) };
  learn.set({ exam: open });
  return open;
}

/** One answer kept here (no feedback until the end), and the next question. */
export function answerExam(q: string, given: ExamAnswer['answer'], conf?: Confidence): OpenExam | null {
  const e = learn.get().exam;
  if (!e || e.finishing) return e ?? null;
  // Time is up: nothing more counts.
  if (Date.now() > e.endsAt) return e;
  const answers = [...e.answers.filter((a) => a.q !== q), { q, answer: given, ...(conf ? { conf } : {}), at: Date.now() }];
  const next: OpenExam = { ...e, answers, i: Math.min(e.exam.questions.length, e.exam.questions.findIndex((x) => x.id === q) + 1) };
  learn.set({ exam: next });
  return next;
}

/** The end: the brain marks every answer; out of reach, the exam waits (`finishing`) and goes with the next flush. */
export async function finishExam(): Promise<ExamMarked | null> {
  const e = learn.get().exam;
  if (!e) return null;
  if (!e.finishing) learn.set({ exam: { ...e, finishing: true, finishedAt: Date.now() } });
  let r: ExamMarked;
  try {
    // The time taken, as this phone's clock counted it (the clock that was shown).
    const used = Math.round(e.exam.seconds - Math.max(0, (e.endsAt - (e.finishedAt ?? Date.now())) / 1000));
    r = await call<ExamMarked>('POST', '/exam/finish', { exam: e.exam.id, answers: e.answers, used });
  } catch (err) {
    // Gone from the brain (marked elsewhere, or the course removed): nothing to wait for.
    if (/no longer open/.test((err as Error).message)) learn.set({ exam: null });
    throw err;
  }
  learn.set({ exam: null });
  keepCards(r.cards);
  const c = learn.get().full[e.exam.course];
  if (c) keepCourse({ ...c, exams: [...(c.exams ?? []).filter((x) => x.id !== r.result.id), r.result].slice(-5) });
  touchDay();
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

/** The cards due now, the most overdue first (one course's, when named). */
export const dueCards = (now = Date.now(), course?: string) => learn.get().cards.filter((c) => c.due <= now && (!course || c.course === course)).sort((a, b) => a.due - b.due);

/** A weak lesson's cards to revise now: its due ones first, then the rest (revising early is allowed). */
export const lessonCards = (course: string, lesson: number, now = Date.now()) =>
  learn.get().cards.filter((c) => c.course === course && c.lesson === lesson).sort((a, b) => Number(b.due <= now) - Number(a.due <= now) || a.due - b.due);
