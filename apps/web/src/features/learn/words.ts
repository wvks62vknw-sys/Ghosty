/**
 * COURSES' WORDS (BRIEF-QUALITY-LEARN): the lines the courses screen says in his voice, in one place and with no DOM, so the spec reads
 * the very words the page is built from. A fact cut from a line is kept behind a "?" (`details`), never in smaller type.
 */

/** The page's one line under its tag (the longer account of what a course holds is behind the "?" below it). */
export const INTRO = 'Courses at your level, made by me and kept on this phone.';

/** What a course holds, said once behind a "?" on the cold screen (it was the screen's 40-word note). */
export const COURSE_HAS = 'A course comes in units, with lessons that have worked examples and their sources, quizzes, an exam, and flashcards of each lesson and of what you got wrong, brought back just before you would forget them.';
export const COURSE_HAS_KEY = 'What is in a course?';

/** The waits, each said once, where it happens (ui/wait.ts). */
export const PLANNING = 'Planning your course…';
export const LESSON_WAIT = 'Writing the lesson at your level (only the first time)…';
export const QUIZ_WAIT = 'Writing your questions…';
export const EXAM_WAIT = 'Drawing your exam from the lessons…';
export const MARK_WAIT = 'Marking your exam…';

/** START with nothing typed: said beside the box, not as a toast that is gone before it is read. */
export const TOPIC_EMPTY = 'Type what you want to learn first, like “photosynthesis”.';

/** A lesson I cannot write without my brain: what still works, and the one way on. */
export function lessonOut(cards: number): { head: string; line: string } {
  return {
    head: 'I can’t write this lesson without my brain.',
    line: `Lessons you have already opened still work${cards ? `, and so do your ${cards} flashcard${cards === 1 ? '' : 's'}` : ''}. Try this one again when I can be reached.`,
  };
}
export const OFFLINE_KEYS = { back: 'BACK TO COURSE', revise: 'REVISE CARDS' };

/** A wrong answer, said kindly with the right one. */
export function wrongAnswer(letter: string, choice: string, why: string | undefined): string {
  return `Not quite. The answer is ${letter}) ${choice}.${why ? ` ${why}` : ''}`;
}

/** A typed answer I cannot mark without my brain: nothing counted, the answer shown. */
export function cantMark(answer: string): string {
  return `I can’t mark that without my brain, so it isn’t counted. The answer: ${answer}.`;
}
