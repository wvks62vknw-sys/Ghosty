/**
 * The tutor's records, shared by the brain (apps/edge/src/tutor.ts, routes under /api/learn) and
 * the LEARN tab (apps/web/src/features/learn). A course is a plan of lessons at one level; each
 * lesson is written once (grounded in library passages, with [n] source markers) and kept; quizzes
 * come from the same passages; what the owner gets wrong becomes a flashcard revised by SM-2
 * (sm2.ts).
 */
import type { Sm2State, Streak } from './sm2';

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

export interface CourseLesson {
  n: number;
  title: string;
  /** What the owner can do after it, one line. */
  goal: string;
  /** The words used to find its passages. */
  query?: string;
  /** Written the first time it is opened, then kept (never a second model call). */
  text?: string;
  sources?: LearnSource[];
  check?: CheckQuestion;
  /** When it was finished. */
  done?: number;
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
}

export interface Quiz {
  id: string;
  /** The course it belongs to; 'general' for a topic quiz outside any course. */
  course: string;
  topic: string;
  questions: QuizQuestion[];
  sources: LearnSource[];
  at: number;
}

/** The brain's verdict on one answer. */
export interface AnswerResult {
  correct: boolean;
  /** For a short answer graded by a model, or by matching words when none was free. */
  how: 'exact' | 'words' | 'model';
  feedback: string;
  expected: string;
  /** The card made from a wrong answer, when one was. */
  card?: Card;
}

export interface Card extends Sm2State {
  id: string;
  course: string;
  front: string;
  back: string;
  added: number;
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
