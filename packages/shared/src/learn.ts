/**
 * The tutor's records, shared by the brain (apps/edge/src/tutor.ts, routes under /api/learn) and
 * the LEARN tab (apps/web/src/features/learn). A course is a syllabus at one level: units of
 * lessons in the order they build on each other, paced from the minutes a day; each lesson is
 * written once (why it matters, the idea, two worked examples, common mistakes, a question to try,
 * the idea in one line; grounded in library passages, with [n] source markers) and kept; quizzes
 * come from the same passages and fill each lesson's question pool, which the course's EXAM draws
 * from; what the owner gets wrong (or guessed right) becomes a flashcard revised by SM-2 (sm2.ts),
 * and so does every lesson's one line.
 *
 * Pure helpers both halves run: the pacing (`paceOf`), each stop's state and the course's mastery
 * (`masteryOf`), the confidence record (`calibrationLine`), the exam's draw and timer (`drawExam`,
 * `examSeconds`) and its grade (the percent bands of school.ts).
 */
import { gradeFor, percentBands } from './school';
import type { Confidence, Sm2State, Streak } from './sm2';

export type { Confidence };

export type LearnLevel = 'beginner' | 'intermediate' | 'advanced';
export const LEARN_LEVELS: LearnLevel[] = ['beginner', 'intermediate', 'advanced'];

/** A passage a lesson or quiz was built from: [n] in the text points here. */
export interface LearnSource {
  n: number;
  title: string;
  /** A web address when the passage came from one (Wikipedia, a page). */
  url?: string;
}

/** One multiple-choice question, answered by its index. */
export interface CheckQuestion {
  q: string;
  choices: string[];
  answer: number;
  why?: string;
}

/** A written lesson's parts (absent for a lesson written before them, or the bare passages). */
export interface LessonParts {
  /** WHY IT MATTERS: one line. */
  why: string;
  /** THE IDEA: the explanation, paragraphs with [n] markers. */
  idea: string;
  /** TWO WORKED EXAMPLES, step by step (one when the model gave only one). */
  examples: string[];
  /** COMMON MISTAKES: short lines. */
  mistakes: string[];
  /** IN ONE LINE: the summary, which becomes a card when the lesson is read. */
  summary: string;
}

export interface CourseLesson {
  n: number;
  title: string;
  /** What the owner can do after it, one line. */
  goal: string;
  /** The words used to find its passages. */
  query?: string;
  /** The unit it belongs to (1-based; absent = 1, a course from before units). */
  unit?: number;
  /** Earlier lessons it builds on (their n). */
  needs?: number[];
  /** Written the first time it is opened, then kept (never a second model call). */
  text?: string;
  parts?: LessonParts;
  sources?: LearnSource[];
  /** TRY IT: the check question. */
  check?: CheckQuestion;
  /** Questions about this lesson from its quizzes (≤ 8, newest kept): with the check, the exam's pool. */
  pool?: QuizQuestion[];
  /** When it was finished. */
  done?: number;
}

export interface CourseUnit {
  n: number;
  title: string;
}

/** How the course is paced from the minutes a day: "3 lessons a week, done by 14 November". */
export interface Pace {
  perWeek: number;
  /** The minutes one lesson takes at this level (reading, the examples, TRY IT, its cards). */
  lessonMinutes: number;
  /** The day the last lesson falls on, YYYY-MM-DD in the owner's zone. */
  finish: string;
  text: string;
}

/** A finished exam, kept on the course (the last 5). */
export interface ExamResult {
  id: string;
  at: number;
  n: number;
  right: number;
  pct: number;
  /** The percent band (school.ts): Top band, Secure, Expected, Working towards. */
  grade: string;
  top: boolean;
  /** Lessons under 80 % in this exam. */
  weak: { n: number; title: string }[];
  /** Seconds taken (≤ the time allowed). */
  used: number;
  seconds: number;
}

export interface Course {
  id: string;
  topic: string;
  title: string;
  level: LearnLevel;
  minutes: number;
  summary: string;
  created: number;
  updated: number;
  lessons: CourseLesson[];
  /** "library", "library + web" or "outline only" (no model was free): where the plan came from. */
  basis: string;
  /** The units, in order (absent: one unit, a course from before units). */
  units?: CourseUnit[];
  /** What the learner should know before starting (0–3 short items). */
  prereqs?: string[];
  pace?: Pace;
  exams?: ExamResult[];
}

/** A course in a list: no lesson texts. */
export interface CourseSummary {
  id: string;
  topic: string;
  title: string;
  level: LearnLevel;
  minutes: number;
  lessons: number;
  done: number;
  /** The next lesson to read (1-based), 0 when all are done. */
  next: number;
  nextTitle: string;
  /** Questions answered in this course's quizzes and checks, and how many were right. */
  asked: number;
  right: number;
  cards: number;
  due: number;
  updated: number;
  /** Lessons mastered, and as a percent of all (masteryOf). */
  mastered?: number;
  mastery?: number;
  /** Per-lesson scores and the confidence record. */
  stats?: CourseStats;
}

export const CONFIDENCES: Confidence[] = ['sure', 'think', 'guess'];

/** One lesson's answers (quiz, check and exam questions about it). */
export interface LessonScore {
  asked: number;
  right: number;
  /** The last answers, 1 right, 0 wrong, oldest first (RECENT kept): what "quiz ≥ 80 %" is measured on. */
  recent: number[];
}

export interface CourseStats {
  /** By lesson n. */
  lessons: Record<string, LessonScore>;
  /** By confidence: answers given with it, and how many were right. */
  conf: Partial<Record<Confidence, { n: number; right: number }>>;
}

export interface QuizQuestion {
  id: string;
  kind: 'mc' | 'short';
  q: string;
  choices?: string[];
  /** The right choice's index (mc) or the model answer (short). */
  answer: number | string;
  /** For short answers: what a right answer must contain. */
  rubric?: string;
  why?: string;
  /** The [n] of the passage it came from. */
  source?: number;
  /** The lesson it is about (course quizzes and exams). */
  lesson?: number;
}

export interface Quiz {
  id: string;
  /** The course it belongs to; 'general' for a topic quiz outside any course. */
  course: string;
  topic: string;
  questions: QuizQuestion[];
  sources: LearnSource[];
  at: number;
  /** Where the questions came from, in words (the lessons' check questions when no model was free). */
  basis?: string;
}

/** The brain's verdict on one answer. */
export interface AnswerResult {
  correct: boolean;
  /** For a short answer graded by a model, or by matching words when none was free. */
  how: 'exact' | 'words' | 'model';
  feedback: string;
  expected: string;
  /** The card made from a wrong answer (or a guessed right one), when one was. */
  card?: Card;
}

export interface Card extends Sm2State {
  id: string;
  course: string;
  front: string;
  back: string;
  added: number;
  /** The lesson it is about, when known (its due cards keep the lesson from mastered). */
  lesson?: number;
}

/** An exam in progress: drawn from the lessons' pools, timed from its start (the clock never stops). */
export interface Exam {
  id: string;
  course: string;
  title: string;
  level: LearnLevel;
  questions: QuizQuestion[];
  started: number;
  seconds: number;
  /** started + seconds: answers after it do not count. */
  ends: number;
  /** Where the questions came from, in words ("the lessons' quizzes", "check questions only …"). */
  basis: string;
}

/** One exam answer, held on the phone until the end (no feedback before). */
export interface ExamAnswer {
  q: string;
  answer: number | string | null;
  conf?: Confidence;
  at?: number;
}

/** The marked exam: the result, and each question's verdict for the review after it. */
export interface ExamMarked {
  result: ExamResult;
  marks: { q: string; correct: boolean; expected: string; lesson?: number; conf?: Confidence }[];
  cards: Card[];
}

/** One revision on the phone, replayed by the brain (POST /api/learn/review). */
export interface Review {
  course: string;
  card: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  at: number;
}

/** GET /api/learn: everything the LEARN tab mirrors on the phone. */
export interface LearnState {
  courses: CourseSummary[];
  cards: Card[];
  streak: Streak;
  /** The owner's time zone, for the streak's days. */
  tz: string;
}

// ======================================================================= pure helpers (brain and phone)

/** The minutes one lesson takes at each level: reading, two worked examples, TRY IT and its cards. */
export const LESSON_MINUTES: Record<LearnLevel, number> = { beginner: 20, intermediate: 25, advanced: 30 };

const keyDay = (k: string) => Math.round(Date.parse(`${k}T00:00:00Z`) / 86_400_000);
const dayOfKey = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10);

/** "14 November" (with the year when it is not the start's year), en-GB. */
export function dayText(key: string, fromKey?: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  const sameYear = !fromKey || fromKey.slice(0, 4) === key.slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
}

/**
 * The pace from the minutes a day: as many whole lessons a week as the minutes allow (at least 1,
 * at most one a day), the first lesson on the start day (YYYY-MM-DD in the owner's zone), the rest
 * spread evenly, and the day the last one falls on.
 */
export function paceOf(lessons: number, minutesADay: number, level: LearnLevel, startKey: string): Pace {
  const lessonMinutes = LESSON_MINUTES[level] ?? 20;
  const perWeek = Math.max(1, Math.min(7, Math.floor((Math.max(1, minutesADay) * 7) / lessonMinutes)));
  const n = Math.max(1, Math.round(lessons));
  const finish = dayOfKey(keyDay(startKey) + Math.floor(((n - 1) * 7) / perWeek));
  return { perWeek, lessonMinutes, finish, text: `${perWeek} lesson${perWeek === 1 ? '' : 's'} a week, done by ${dayText(finish, startKey)}` };
}

/** How many lessons the pace expected done before `todayKey` (today's own lesson is not late yet): for "on track" / "behind". */
export function paceDue(pace: Pick<Pace, 'perWeek'>, startKey: string, todayKey: string, lessons: number): number {
  const days = keyDay(todayKey) - keyDay(startKey);
  if (!Number.isFinite(days) || days <= 0) return 0;
  // Lesson k falls on day floor((k − 1) × 7 / perWeek): those before today.
  return Math.min(lessons, Math.ceil((days * pace.perWeek) / 7));
}

/** The answers a lesson's quiz percent is measured on (the latest), and the fewest that count. */
export const RECENT = 6;
export const MIN_ANSWERS = 3;

export type StopState = 'new' | 'read' | 'passed' | 'mastered';
export const STOP_WORDS: Record<StopState, string> = { new: 'NOT STARTED', read: 'READ', passed: 'QUIZ PASSED', mastered: 'MASTERED' };

/**
 * One stop on the course map: MASTERED when its quiz percent (the last RECENT answers about it,
 * at least MIN_ANSWERS) is 80 or more and none of its cards is due; QUIZ PASSED at 50 or more;
 * READ when finished; else NOT STARTED.
 */
export function stopState(l: Pick<CourseLesson, 'n' | 'done'>, score: LessonScore | undefined, cards: Pick<Card, 'lesson' | 'due'>[], now: number): { state: StopState; pct: number | null; due: number } {
  const recent = (score?.recent ?? []).slice(-RECENT);
  const pct = recent.length ? Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 100) : null;
  const due = cards.filter((c) => c.lesson === l.n && c.due <= now).length;
  const enough = recent.length >= MIN_ANSWERS && pct !== null;
  const state: StopState = enough && pct! >= 80 && !due ? 'mastered' : enough && pct! >= 50 ? 'passed' : l.done ? 'read' : 'new';
  return { state, pct, due };
}

/** Every stop's state and the course's mastery: the share of its lessons mastered. */
export function masteryOf(c: Pick<Course, 'lessons'>, stats: CourseStats | undefined, cards: Pick<Card, 'lesson' | 'due'>[], now: number) {
  const stops = c.lessons.map((l) => ({ n: l.n, ...stopState(l, stats?.lessons?.[String(l.n)], cards, now) }));
  const count = (s: StopState) => stops.filter((x) => x.state === s).length;
  const mastered = count('mastered');
  return { stops, mastered, passed: count('passed'), read: stops.filter((x) => x.state !== 'new').length, pct: c.lessons.length ? Math.round((mastered / c.lessons.length) * 100) : 0 };
}

/** A lesson's score after one more answer. */
export function scoreAnswer(s: LessonScore | undefined, right: boolean): LessonScore {
  return { asked: (s?.asked ?? 0) + 1, right: (s?.right ?? 0) + (right ? 1 : 0), recent: [...(s?.recent ?? []), right ? 1 : 0].slice(-RECENT) };
}

/** The course map's CALIBRATION line: how often SURE was right ("Sure and right 8 of 10"), then the others. */
export function calibrationLine(conf: CourseStats['conf'] | undefined): string {
  const c = conf ?? {};
  if (!c.sure?.n && !c.think?.n && !c.guess?.n) return 'No answers with SURE, THINK SO or GUESSING yet.';
  const part = (k: Confidence, word: string) => (c[k]?.n ? `${word} and right ${c[k]!.right} of ${c[k]!.n}` : '');
  return [part('sure', 'Sure'), part('think', 'Thought so'), part('guess', 'Guessed')].filter(Boolean).join(' · ');
}

/** Seconds a question in an exam at each level: the timer is the count times this. */
export const EXAM_SECONDS: Record<LearnLevel, number> = { beginner: 90, intermediate: 75, advanced: 60 };
export const examSeconds = (level: LearnLevel, n: number) => (EXAM_SECONDS[level] ?? 90) * Math.max(1, n);
export const EXAM_MIN = 10;
export const EXAM_MAX = 20;

/** A small seeded random (mulberry32): the same exam from the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A lesson's exam pool: its check question (marked exactly) and the questions its quizzes gave. */
export function poolOf(l: Pick<CourseLesson, 'n' | 'check' | 'pool'>): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  if (l.check) out.push({ id: `c${l.n}`, kind: 'mc', q: l.check.q, choices: l.check.choices, answer: l.check.answer, ...(l.check.why ? { why: l.check.why } : {}), lesson: l.n });
  for (const q of l.pool ?? []) out.push({ ...q, lesson: l.n });
  return out;
}

/**
 * The exam's questions: between EXAM_MIN and EXAM_MAX (two a lesson, fewer only when the pools
 * hold fewer), drawn round by round so every lesson with questions is in it before any has a
 * second, no question twice (the same words count as the same question), in lesson order.
 */
export function drawExam(pools: { lesson: number; questions: QuizQuestion[] }[], seed: number): QuizQuestion[] {
  const rnd = seeded(seed);
  const seen = new Set<string>();
  const decks = pools
    .map((p) => {
      const qs = p.questions.filter((q) => {
        const k = q.q.trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [qs[i], qs[j]] = [qs[j]!, qs[i]!];
      }
      return { lesson: p.lesson, qs };
    })
    .filter((d) => d.qs.length);
  const total = decks.reduce((n, d) => n + d.qs.length, 0);
  const want = Math.min(EXAM_MAX, total, Math.max(EXAM_MIN, decks.length * 2));
  const picked: { lesson: number; q: QuizQuestion; round: number }[] = [];
  for (let round = 0; picked.length < want; round++) {
    let any = false;
    for (const d of decks) {
      if (picked.length >= want) break;
      const q = d.qs[round];
      if (!q) continue;
      picked.push({ lesson: d.lesson, q, round });
      any = true;
    }
    if (!any) break;
  }
  return picked.sort((a, b) => a.lesson - b.lesson || a.round - b.round).map((x, i) => ({ ...x.q, id: `e${i + 1}`, lesson: x.lesson }));
}

/** An exam's grade from the percent bands (school.ts), and the lessons under 80 % in it. */
export function examGrade(marks: { correct: boolean; lesson?: number }[], titles: Record<number, string>): Pick<ExamResult, 'n' | 'right' | 'pct' | 'grade' | 'top' | 'weak'> {
  const n = marks.length;
  const right = marks.filter((m) => m.correct).length;
  const g = gradeFor({ bands: percentBands(n) }, right);
  const by = new Map<number, { n: number; right: number }>();
  for (const m of marks) {
    if (!m.lesson) continue;
    const s = by.get(m.lesson) ?? { n: 0, right: 0 };
    s.n++;
    if (m.correct) s.right++;
    by.set(m.lesson, s);
  }
  const weak = [...by].filter(([, s]) => s.right / s.n < 0.8).sort((a, b) => a[0] - b[0]).map(([l]) => ({ n: l, title: titles[l] ?? `Lesson ${l}` }));
  return { n, right, pct: n ? Math.round((right / n) * 100) : 0, grade: g.grade, top: g.top, weak };
}
