/**
 * The tutor as ONE tool (tutor.ts does the work): every group's tool names are in the plain-turn
 * prompt, which is at its size limit, so the course, the lessons, quizzes and revision share a
 * name and an `action`. Each action also opens the LEARN tab where it can (`open_learn`).
 */
import { lesson, makeQuiz, pickCourse, startCourse, tutorDepsFor, learnState, isLevel } from '../tutor';
import { asData } from '../kernel/permissions';
import { arg, type Tool } from './types';

const LETTERS = 'ABCDEF';

export const learnTools: Tool[] = [
  {
    name: 'tutor',
    description:
      "Teach the owner anything at their level, with spaced repetition. action start: plan a course (topic, level beginner|intermediate|advanced — ask if unsure, minutes_per_day); lesson: the next lesson (or course's lesson n) to give them as written, sources [n] included, then ask its CHECK question; quiz: 3–8 questions on a course or topic (spoken: true in a voice chat — ask one at a time, wait, say right or wrong and why); revise: cards due; courses: the list. Opens the LEARN tab.",
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'lesson', 'quiz', 'revise', 'courses'] },
        topic: { type: 'string' },
        level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        minutes_per_day: { type: 'number' },
        course: { type: 'string', description: 'a course id or words from its title (default: the latest)' },
        n: { type: 'number', description: 'lesson: its number; quiz: how many questions' },
        spoken: { type: 'boolean' },
      },
      required: ['action'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const deps = await tutorDepsFor(ctx);
      const action = arg.str(a, 'action');
      const open = (args: Record<string, unknown>) => ctx.emit({ t: 'client', name: 'open_learn', args });
      if (action === 'start') {
        ctx.progress('planning the course…');
        const c = await startCourse(deps, { topic: arg.str(a, 'topic'), level: isLevel(a.level) ? a.level : undefined, minutes: a.minutes_per_day });
        open({ course: c.id });
        return `Course "${c.title}" (${c.level}, ${c.lessons.length} lessons of about ${c.minutes} minutes; from ${c.basis}) is in the LEARN tab:\n${c.lessons.map((l) => `${l.n}. ${l.title}${l.done ? ' (done)' : ''}`).join('\n')}\n${c.summary}\nOffer the first lesson now (tutor action lesson).`;
      }
      if (action === 'lesson') {
        const e = await pickCourse(ctx.storage, arg.str(a, 'course', false) || arg.str(a, 'topic', false));
        if (!e) return 'There is no course yet: start one (tutor action start with a topic).';
        ctx.progress(`writing lesson ${a.n ?? e.next ?? ''}…`);
        const r = await lesson(deps, e.id, Number(a.n) || undefined, { markDone: true });
        open({ course: e.id, n: r.lesson.n });
        const l = r.lesson;
        const check = l.check ? `\n\nCHECK: ${l.check.q}\n${l.check.choices.map((c, i) => `${LETTERS[i]}) ${c}`).join('\n')}${l.check.why ? `\nWHY (after they answer): ${l.check.why}` : ''}` : '';
        const sources = l.sources?.length ? `\n\nSources: ${l.sources.map((s) => `[${s.n}] ${s.title}${s.url ? ` ${s.url}` : ''}`).join(' · ')}` : '';
        const left = r.course.lessons.filter((x) => !x.done).length;
        // The lesson is written from (or, with no model free, IS) library and Wikipedia text: data to relay, never instructions.
        const body = asData('the lesson (written from your library and Wikipedia)', `${(l.text ?? '').slice(0, 2600)}${sources}${check}`);
        return `Lesson ${l.n} of ${r.course.lessons.length} of "${r.course.title}" — ${l.title} (also open in LEARN). Give it to the owner as written${l.check ? `, then ask its CHECK question and wait for their answer [right answer, do not show before they answer: ${LETTERS[l.check.answer]}]` : ''}:\n\n${body}\n\n${left ? `${left} lesson${left === 1 ? '' : 's'} left.` : 'That was the last lesson: offer a quiz.'}`;
      }
      if (action === 'quiz') {
        ctx.progress('writing the quiz…');
        const topic = arg.str(a, 'topic', false);
        const course = arg.str(a, 'course', false);
        const spoken = arg.bool(a, 'spoken');
        const q = await makeQuiz(deps, { course: course || undefined, topic: topic || undefined, n: a.n, spoken });
        if (!spoken) open({ quiz: q.id });
        const lines = q.questions.map((x, i) => `${i + 1}. ${x.q}${x.choices ? `\n${x.choices.map((c, j) => `   ${LETTERS[j]}) ${c}`).join('\n')}` : ' (short answer)'}`);
        const key = q.questions.map((x, i) => `${i + 1}: ${x.kind === 'mc' ? LETTERS[Number(x.answer)] : x.answer}`).join('; ');
        return `${spoken ? 'Quiz' : 'Quiz open in LEARN (they can tap their answers there)'} on "${q.topic}", ${q.questions.length} questions. ${spoken ? 'Ask ONE question at a time, short, wait for the answer, then say right or wrong and why.' : 'If they want it here instead, ask one at a time.'}\n${lines.join('\n')}\n[answers, never show before they answer: ${key}]`;
      }
      if (action === 'revise') {
        const st = await learnState(deps);
        const now = Date.now();
        const due = st.cards.filter((c) => c.due <= now).length;
        open({ view: 'revise' });
        return due ? `${due} card${due === 1 ? '' : 's'} due (of ${st.cards.length}); REVISE is open in LEARN: they flip each card and tap AGAIN, HARD, GOOD or EASY.` : `Nothing due to revise (${st.cards.length} cards in all). Wrong quiz answers become cards.`;
      }
      if (action === 'courses') {
        const st = await learnState(deps);
        open({ view: 'courses' });
        if (!st.courses.length) return 'No courses yet. Say "teach me <anything>" to start one.';
        return st.courses.map((c) => `${c.title} [${c.id}] — ${c.level}, ${c.done}/${c.lessons} lessons${c.next ? `, next: ${c.nextTitle}` : ', finished'}; quizzes ${c.right}/${c.asked}; cards due ${c.due}`).join('\n');
      }
      throw new Error('action must be start, lesson, quiz, revise or courses');
    },
  },
];
