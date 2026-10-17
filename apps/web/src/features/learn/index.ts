/**
 * LEARN tab — Ghosty the tutor (the brain's tutor.ts). COURSES with a progress ring each, START A
 * COURSE (a topic, the level, minutes a day), and one STUDY panel that shows a course's lessons, a
 * LESSON (its sources as chips, READ ALOUD, the CHECK question, NEXT), a QUIZ (tap an answer for
 * instant feedback, short answers marked by the brain, the score at the end, + CARD to keep one),
 * or REVISE (flashcards: SHOW ANSWER, then AGAIN / HARD / GOOD / EASY with SM-2's next date in the
 * small print). The daily streak and the cards due are in the hero. Everything is mirrored on the
 * phone (store.ts) so revision and opened lessons work offline. The chat's tutor tool opens views
 * here through the `open_learn` command. State for specs at window.__ghosty.learn.
 */
import type { Card, Course, CourseLesson, CourseSummary, LearnLevel, LearnSource, Quiz, QuizQuestion } from '../../../../../packages/shared/src/learn';
import { LEARN_LEVELS } from '../../../../../packages/shared/src/learn';
import { nextText, streakOf, type Rating } from '../../../../../packages/shared/src/sm2';
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h, svgEl } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import * as L from './store';

type View = 'home' | 'course' | 'lesson' | 'quiz' | 'revise';

/** What the tab shows, for tests and the console (window.__ghosty.learn). */
export const learnState = {
  view: 'home' as View,
  course: '',
  lesson: 0,
  quiz: { id: '', i: 0, n: 0, right: 0, answered: 0, last: '' },
  revise: { left: 0, done: 0, shown: false },
  streak: { current: 0, best: 0, today: false },
  courses: 0,
  due: 0,
};

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.learn = learnState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

const LETTERS = 'ABCDEF';

/** A progress ring: the share of lessons done, the count in the middle. */
function ring(frac: number, text: string): SVGSVGElement {
  const R = 15;
  const C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, frac));
  const s = svgEl('svg', { viewBox: '0 0 36 36', class: 'learnring', 'aria-hidden': 'true' });
  s.append(
    svgEl('circle', { cx: 18, cy: 18, r: R, class: 'track' }),
    svgEl('circle', { cx: 18, cy: 18, r: R, class: 'fg', 'stroke-dasharray': `${(C * f).toFixed(1)} ${C.toFixed(1)}`, transform: 'rotate(-90 18 18)' }),
  );
  const t = svgEl('text', { x: 18, y: 21.5, 'text-anchor': 'middle' });
  t.textContent = text;
  s.append(t);
  return s;
}

/** A lesson's text as paragraphs, "- " lines as a list, its [n] markers as small source chips. */
function lessonBody(text: string, sources: LearnSource[]): HTMLElement {
  const box = h('div.learntext');
  const inline = (s: string): (string | Node)[] =>
    s.split(/(\[\d+\])/).map((part) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (!m) return part;
      const src = sources.find((x) => x.n === Number(m[1]));
      return h('sup.learncite', { title: src?.title ?? '' }, m[1]!);
    });
  for (const para of text.split(/\n{2,}/)) {
    const lines = para.split('\n').filter((x) => x.trim());
    if (!lines.length) continue;
    if (lines.every((x) => /^\s*[-•*]\s+/.test(x))) {
      box.append(h('ul', ...lines.map((x) => h('li', ...inline(x.replace(/^\s*[-•*]\s+/, ''))))));
      continue;
    }
    const lead = lines[0]!.match(/^(Worked example|Remember|Example|In one line):\s*(.*)$/i);
    if (lead) {
      box.append(h('p', h('b.learnlead', `${lead[1]!.toUpperCase()} `), ...inline(lead[2] ?? '')));
      const rest = lines.slice(1);
      if (rest.length && rest.every((x) => /^\s*[-•*]\s+/.test(x))) box.append(h('ul', ...rest.map((x) => h('li', ...inline(x.replace(/^\s*[-•*]\s+/, ''))))));
      else for (const x of rest) box.append(h('p', ...inline(x)));
      continue;
    }
    box.append(h('p', ...inline(lines.join(' '))));
  }
  return box;
}

function sourceChips(sources: LearnSource[] = []): HTMLElement {
  return h(
    'div.learnsources',
    ...sources.map((s) =>
      s.url ? h('a.chip.learnsrc', { href: s.url, target: '_blank', rel: 'noopener noreferrer', title: s.title }, `[${s.n}] ${s.title}`) : h('span.chip.learnsrc', { title: s.title }, `[${s.n}] ${s.title}`),
    ),
  );
}

let opener: ((a: Record<string, unknown>) => void) | null = null;
let waiting: Record<string, unknown> | null = null;

/** The brain's `open_learn`: the tab, then a course, a lesson, a quiz or REVISE. */
export function openLearn(a: Record<string, unknown> = {}): void {
  go('learn');
  if (opener) opener(a);
  else waiting = a;
}

export const learnTab: TabDef = {
  id: 'learn',
  title: 'LEARN',
  icon: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
  scene: 'backdrop',
  blurb: 'courses · quizzes · flashcards',
  mount(root) {
    const P = page(root, { tag: 'TUTOR', sub: 'courses at your level · kept on this phone', leftLabel: 'STUDY', rightLabel: 'START', stack: true });
    expose();
    let view: View = 'home';
    let current: Course | null = null;
    let quizNow: Quiz | null = null;
    let queue: Card[] = [];

    // ======================= STUDY: the one panel that changes
    const sp = panel('STUDY', { cls: 'learnstudy' });
    const setView = (v: View, title: string) => {
      view = v;
      learnState.view = v;
      sp.title.textContent = title;
      stopSpeaking();
    };

    // ======================= COURSES
    const cp = panel('COURSES', { cls: 'learncourses' });
    // ======================= START A COURSE
    const np = panel('START A COURSE', { cls: 'learnnew' });
    const topicIn = h('input', { placeholder: 'What do you want to learn?', 'aria-label': 'Topic to learn', maxlength: '120' });
    let level: LearnLevel = 'beginner';
    let minutes = 10;
    const levelChips = h('div.lenschips.learnchips', { role: 'group', 'aria-label': 'Level' });
    const paintLevels = () => {
      clear(levelChips, ...LEARN_LEVELS.map((l) => button(l.toUpperCase(), () => ((level = l), paintLevels()), l === level ? 'on' : '')));
    };
    const minChips = h('div.lenschips.learnchips', { role: 'group', 'aria-label': 'Minutes a day' });
    const paintMinutes = () => {
      clear(minChips, h('span.lab', 'MIN / DAY'), ...[5, 10, 20, 30].map((m) => button(String(m), () => ((minutes = m), paintMinutes()), m === minutes ? 'on' : '')));
    };
    paintLevels();
    paintMinutes();
    const startBtn = button('START', () => void start(), 'on');
    const start = async () => {
      const t = topicIn.value.trim();
      if (t.length < 2) return void toast('Type what you want to learn', 'warn');
      startBtn.disabled = true;
      startBtn.textContent = 'PLANNING…';
      try {
        const c = await L.startCourse(t, level, minutes);
        topicIn.value = '';
        toast(`Course ready: ${c.title}`, 'ok');
        showCourse(c.id);
      } catch (e) {
        toast(`Could not plan it: ${(e as Error).message}`, 'bad');
      }
      startBtn.disabled = false;
      startBtn.textContent = 'START';
    };
    topicIn.addEventListener('keydown', (e) => e.key === 'Enter' && void start());
    np.body.append(h('div.keyrow.learntopic', topicIn), levelChips, minChips, h('div.row.wrap', startBtn), h('div.note', 'Or just say "teach me …" to Ghosty. Lessons come from your library and Wikipedia, with their sources.'));

    P.left.append(sp.el, cp.el);
    P.right.append(np.el);

    // ======================= the hero: streak, progress, cards due
    const paintHero = () => {
      const s = L.learn.get();
      const st = streakOf(s.streak, L.today());
      const due = L.dueCards().length;
      const total = s.courses.reduce((n, c) => n + c.lessons, 0);
      const done = s.courses.reduce((n, c) => n + c.done, 0);
      const asked = s.courses.reduce((n, c) => n + c.asked, 0);
      const right = s.courses.reduce((n, c) => n + c.right, 0);
      learnState.streak = st;
      learnState.courses = s.courses.length;
      learnState.due = due;
      P.big.textContent = `${st.current} DAY STREAK`;
      P.sub.textContent = `${st.today ? 'today done' : st.current ? 'learn something today to keep it' : 'learn something today to start one'} · best ${st.best} · ${due} card${due === 1 ? '' : 's'} due`;
      P.dials([
        ['LESSONS', total ? done / total : 0, `${done}/${total}`],
        ['RIGHT', asked ? right / asked : 0, asked ? `${Math.round((right / asked) * 100)}%` : '--'],
        ['DUE', Math.min(1, due / 20), String(due), due ? 'var(--a)' : undefined],
      ]);
    };

    const paintCourses = () => {
      const s = L.learn.get();
      cp.setStatus(s.synced ? `${s.courses.length}` : 'ON THIS PHONE', s.synced ? 'ok' : 'mid');
      clear(cp.body);
      if (!s.courses.length) {
        cp.body.append(h('div.note', 'No courses yet. Start one, or say "teach me photosynthesis".'));
        return;
      }
      for (const c of [...s.courses].sort((a, b) => b.updated - a.updated)) {
        const due = s.cards.filter((x) => x.course === c.id && x.due <= Date.now()).length;
        const r = h(
          'button.learncourse',
          { type: 'button', 'data-id': c.id },
          ring(c.lessons ? c.done / c.lessons : 0, `${c.done}/${c.lessons}`),
          h('span.learncinfo', h('b', c.title), h('small', `${c.level.toUpperCase()} · ${c.next ? `next: ${c.nextTitle}` : 'finished'}${c.asked ? ` · ${c.right}/${c.asked} right` : ''}`)),
          due ? h('span.chip.learndue', `${due} DUE`) : '',
        );
        r.addEventListener('click', () => showCourse(c.id));
        cp.body.append(r);
      }
    };

    // ======================= views
    const showHome = () => {
      setView('home', 'STUDY');
      learnState.course = '';
      const s = L.learn.get();
      clear(sp.body);
      const due = L.dueCards().length;
      const latest = [...s.courses].sort((a, b) => b.updated - a.updated)[0];
      if (latest && latest.next) sp.body.append(button(h('span', h('b', 'CONTINUE'), h('small', `${latest.title} · lesson ${latest.next}: ${latest.nextTitle}`)), () => void showLesson(latest.id, latest.next), 'learnbig'));
      if (due) sp.body.append(button(h('span', h('b', `REVISE ${due} CARD${due === 1 ? '' : 'S'}`), h('small', 'a few minutes keeps them for good')), () => showRevise(), 'learnbig'));
      if (!latest && !due) sp.body.append(h('div.note', 'Ghosty teaches anything at your level: a short course of lessons with their sources, a check question in each, quizzes, and flashcards of what you got wrong, brought back just before you would forget them.'));
      else if (!due) sp.body.append(h('div.note', 'No cards due. Wrong quiz answers become cards here.'));
    };

    const showCourse = async (id: string) => {
      learnState.course = id;
      const c = (await L.course(id)) ?? null;
      if (!c) return void toast('That course is not on this phone yet', 'warn');
      current = c;
      setView('course', 'COURSE');
      const sum = L.learn.get().courses.find((x) => x.id === id);
      clear(sp.body);
      const doneN = c.lessons.filter((l) => l.done).length;
      sp.body.append(
        h('div.learnhead', ring(c.lessons.length ? doneN / c.lessons.length : 0, `${doneN}/${c.lessons.length}`), h('span', h('b', c.title), h('small', `${c.level.toUpperCase()} · ${c.minutes} MIN A DAY · ${c.basis}`))),
        h('div.note', c.summary),
      );
      const list = h('div.learnlessons');
      for (const l of c.lessons) {
        const b = h('button.learnlesson', { type: 'button' }, h('i', l.done ? '✓' : String(l.n)), h('span', h('b', l.title), h('small', l.goal)));
        if (l.done) b.classList.add('done');
        b.addEventListener('click', () => void showLesson(c.id, l.n));
        list.append(b);
      }
      const next = c.lessons.find((l) => !l.done);
      let sure = false;
      const del = button('REMOVE', async (btn) => {
        if (!sure) {
          sure = true;
          btn.textContent = 'TAP AGAIN TO REMOVE';
          return;
        }
        try {
          await L.removeCourse(c.id);
          toast('Course removed', 'ok');
          showHome();
        } catch (e) {
          toast(`Could not remove it: ${(e as Error).message}`, 'bad');
        }
      }, 'warn');
      sp.body.append(list, h('div.row.wrap.learnbar', next ? button(`LESSON ${next.n}`, () => void showLesson(c.id, next.n), 'on') : h('span.chip.good', 'FINISHED'), button('QUIZ ME', () => void startQuiz({ course: c.id })), del));
      if (sum?.cards) sp.body.append(h('div.note', `${sum.cards} card${sum.cards === 1 ? '' : 's'} from this course, ${sum.due} due.`));
    };

    const showLesson = async (courseId: string, n: number) => {
      setView('lesson', `LESSON ${n}`);
      learnState.course = courseId;
      learnState.lesson = n;
      clear(sp.body, h('div.note.learnwait', 'Writing the lesson at your level… (only the first time)'));
      let l: CourseLesson;
      try {
        if (!L.learn.get().full[courseId]) await L.course(courseId);
        l = await L.lesson(courseId, n);
      } catch (e) {
        clear(sp.body, h('div.note', `Could not get the lesson: ${(e as Error).message}`), button('BACK', () => void showCourse(courseId)));
        return;
      }
      if (learnState.view !== 'lesson' || learnState.lesson !== n) return;
      const c = L.learn.get().full[courseId];
      current = c ?? current;
      const total = c?.lessons.length ?? n;
      clear(sp.body);
      const text = l.text ?? '';
      const aloud = button('READ ALOUD', (b) => {
        if (b.classList.toggle('on')) void speak(`${l.title}. ${text.replace(/\[\d+\]/g, '')}`).finally(() => b.classList.remove('on'));
        else stopSpeaking();
      });
      sp.body.append(h('div.learnhead', h('span', h('b', l.title), h('small', `LESSON ${n} OF ${total}${c ? ` · ${c.title}` : ''}`))), h('div.row.wrap.learnbar', aloud), lessonBody(text, l.sources ?? []), sourceChips(l.sources));
      const after = h('div.row.wrap.learnbar');
      const nextBtn = button(n < total ? 'NEXT LESSON' : 'FINISH', async () => {
        await L.finishLesson(courseId, n);
        paintAll();
        if (n < total) void showLesson(courseId, n + 1);
        else {
          toast('Course finished — try a quiz', 'ok');
          void showCourse(courseId);
        }
      }, 'on');
      if (l.check) {
        const ck = l.check;
        const box = h('div.learncheck', h('div.lab', 'CHECK QUESTION'), h('p.learnq', ck.q));
        const out = h('div.note.learnfeed');
        const choices = ck.choices.map((ch, i) => {
          const b = button(`${LETTERS[i]}) ${ch}`, () => {
            const right = i === ck.answer;
            for (const x of choices) x.disabled = true;
            b.classList.add(right ? 'good' : 'bad');
            choices[ck.answer]!.classList.add('good');
            out.textContent = `${right ? 'Right.' : `Not quite: ${LETTERS[ck.answer]}) ${ck.choices[ck.answer]}.`}${ck.why ? ` ${ck.why}` : ''}`;
            learnState.quiz.last = right ? 'right' : 'wrong';
            void L.answer({ course: courseId, lesson: n, answer: i }).then((r) => r.card && toast('Made a flashcard of it', 'ok')).catch(() => undefined).finally(() => paintAll());
          }, 'learnchoice');
          return b;
        });
        box.append(...choices, out);
        sp.body.append(box);
      }
      after.append(nextBtn, button('BACK TO COURSE', () => void showCourse(courseId)));
      sp.body.append(after);
    };

    const startQuiz = async (a: { course?: string; topic?: string }) => {
      setView('quiz', 'QUIZ');
      clear(sp.body, h('div.note.learnwait', 'Writing your questions…'));
      try {
        const q = await L.quiz({ ...a, n: 5 });
        showQuiz(q);
      } catch (e) {
        clear(sp.body, h('div.note', `No quiz: ${(e as Error).message}`), button('BACK', () => showHome()));
      }
    };

    const showQuiz = (q: Quiz, i = 0, right = 0) => {
      quizNow = q;
      setView('quiz', `QUIZ · ${i + 1} / ${q.questions.length}`);
      learnState.quiz = { ...learnState.quiz, id: q.id, i, n: q.questions.length, right, answered: i };
      clear(sp.body);
      if (i >= q.questions.length) {
        sp.title.textContent = 'QUIZ · DONE';
        const pct = Math.round((right / q.questions.length) * 100);
        sp.body.append(
          h('div.learnscore', h('b', `${right} / ${q.questions.length}`), h('small', pct >= 80 ? 'Excellent.' : pct >= 50 ? 'Good — the misses are now flashcards.' : 'Worth another go — the misses are now flashcards.')),
          h('div.row.wrap.learnbar', button('NEW QUIZ', () => void startQuiz(q.course !== 'general' ? { course: q.course } : { topic: q.topic }), 'on'), L.dueCards().length ? button('REVISE', () => showRevise()) : '', q.course !== 'general' ? button('BACK TO COURSE', () => void showCourse(q.course)) : ''),
        );
        // The brain's score for the course, now that every answer is in.
        void L.sync().then(() => paintAll());
        paintAll();
        return;
      }
      const item: QuizQuestion = q.questions[i]!;
      const out = h('div.note.learnfeed');
      const nextBtn = button(i + 1 < q.questions.length ? 'NEXT' : 'SCORE', () => showQuiz(q, i + 1, right), 'on');
      nextBtn.hidden = true;
      const cardBtn = button('+ CARD', async (b) => {
        b.disabled = true;
        try {
          await L.addCard(q.course, item.q, `${item.kind === 'mc' ? `${LETTERS[Number(item.answer)]}) ${item.choices?.[Number(item.answer)]}` : item.answer}${item.why ? ` — ${item.why}` : ''}`);
          toast('Kept as a flashcard', 'ok');
        } catch (e) {
          toast(`Could not keep it: ${(e as Error).message}`, 'bad');
          b.disabled = false;
        }
      });
      cardBtn.hidden = true;
      const done = (ok: boolean, text: string) => {
        if (ok) right++;
        learnState.quiz = { ...learnState.quiz, right, answered: i + 1, last: ok ? 'right' : 'wrong' };
        out.textContent = text;
        out.className = `note learnfeed ${ok ? 'good' : 'bad'}`;
        nextBtn.hidden = false;
        // A miss is a card already (the brain made it); a hit can be kept too.
        cardBtn.hidden = !ok;
      };
      sp.body.append(h('p.learnq', item.q));
      if (item.kind === 'mc') {
        const choices = (item.choices ?? []).map((ch, k) => {
          const b = button(`${LETTERS[k]}) ${ch}`, () => {
            for (const x of choices) x.disabled = true;
            const ok = k === Number(item.answer);
            b.classList.add(ok ? 'good' : 'bad');
            choices[Number(item.answer)]?.classList.add('good');
            done(ok, `${ok ? 'Right.' : `Not quite: ${LETTERS[Number(item.answer)]}) ${item.choices?.[Number(item.answer)]}.`}${item.why ? ` ${item.why}` : ''}`);
            void L.answer({ quiz: q.id, q: item.id, answer: k }).catch(() => undefined).finally(() => paintAll());
          }, 'learnchoice');
          return b;
        });
        sp.body.append(...choices);
      } else {
        const inp = h('input', { placeholder: 'Your answer', 'aria-label': 'Your answer', maxlength: '300' });
        const check = button('CHECK', async (b) => {
          const given = inp.value.trim();
          if (!given) return void toast('Type an answer first', 'warn');
          b.disabled = true;
          inp.disabled = true;
          b.textContent = 'MARKING…';
          try {
            const r = await L.answer({ quiz: q.id, q: item.id, answer: given });
            done(r.correct, `${r.feedback}${r.correct ? '' : ` (answer: ${r.expected})`}`);
          } catch {
            // No brain to mark it: the answer is shown and nothing is counted.
            out.textContent = `Can't mark it offline. The answer: ${String(item.answer)}.`;
            nextBtn.hidden = false;
          }
          b.textContent = 'CHECK';
          paintAll();
        }, 'on');
        inp.addEventListener('keydown', (e) => e.key === 'Enter' && !check.disabled && check.click());
        sp.body.append(h('div.keyrow.learnshort', inp, check));
      }
      sp.body.append(out, h('div.row.wrap.learnbar', nextBtn, cardBtn));
    };

    const showRevise = () => {
      setView('revise', 'REVISE');
      queue = L.dueCards();
      learnState.revise = { left: queue.length, done: 0, shown: false };
      nextCard();
    };
    const again = new Set<string>();
    const nextCard = () => {
      clear(sp.body);
      const card = queue.shift();
      learnState.revise = { ...learnState.revise, left: queue.length + (card ? 1 : 0), shown: false };
      if (!card) {
        sp.title.textContent = 'REVISE · DONE';
        sp.body.append(h('div.learnscore', h('b', learnState.revise.done ? 'ALL REVISED' : 'NOTHING DUE'), h('small', learnState.revise.done ? `${learnState.revise.done} card${learnState.revise.done === 1 ? '' : 's'} — they come back just before you would forget them.` : 'Wrong quiz answers become cards; they come back here when due.')), button('BACK', () => showHome()));
        again.clear();
        void L.flush();
        paintAll();
        return;
      }
      sp.title.textContent = `REVISE · ${queue.length + 1} LEFT`;
      const course = L.learn.get().courses.find((c) => c.id === card.course);
      const back = h('div.learnback', card.back);
      back.hidden = true;
      const rates = h('div.learnrates');
      rates.hidden = true;
      for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) {
        const b = button(h('span', h('b', r.toUpperCase()), h('small', nextText(card, r, Date.now()))), () => {
          L.review(card, r);
          learnState.revise.done++;
          // Forgotten: seen again before this sitting ends (SM-2 brings it back in 10 minutes anyway).
          if (r === 'again' && !again.has(card.id)) {
            again.add(card.id);
            queue.push({ ...card });
          }
          paintHero();
          nextCard();
        }, `learnrate ${r}`);
        rates.append(b);
      }
      const show = button('SHOW ANSWER', () => {
        back.hidden = false;
        rates.hidden = false;
        show.hidden = true;
        learnState.revise.shown = true;
      }, 'on');
      const face = h('div.learncard', h('small', course?.title ?? 'CARD'), h('div.learnfront', card.front), back);
      face.addEventListener('click', () => !learnState.revise.shown && show.click());
      sp.body.append(face, show, rates);
    };

    const paintAll = () => {
      paintHero();
      paintCourses();
    };

    const handle = (a: Record<string, unknown>) => {
      const id = typeof a.course === 'string' ? a.course : '';
      void L.sync().then(() => {
        paintAll();
        if (typeof a.quiz === 'string') void L.quizById(a.quiz).then((q) => (q ? showQuiz(q) : toast('That quiz is no longer kept', 'warn')));
        else if (a.view === 'revise') showRevise();
        else if (id && Number(a.n)) void showLesson(id, Number(a.n));
        else if (id) void showCourse(id);
        else if (a.view === 'courses' || view === 'home') showHome();
      });
    };
    opener = handle;

    L.learn.subscribe(() => paintHero());
    paintAll();
    showHome();
    if (waiting) {
      const a = waiting;
      waiting = null;
      handle(a);
    }
    return {
      enter() {
        paintAll();
        void L.sync().then(() => {
          paintAll();
          if (view === 'home') showHome();
        });
      },
      leave() {
        stopSpeaking();
        void L.flush();
      },
      describe() {
        const s = L.learn.get();
        if (view === 'lesson' && current) return `LEARN tab: reading lesson ${learnState.lesson} of the course "${current.title}" (${current.level}).`;
        if (view === 'quiz' && quizNow) return `LEARN tab: a quiz on "${quizNow.topic}", question ${learnState.quiz.i + 1} of ${learnState.quiz.n}.`;
        if (view === 'revise') return `LEARN tab: revising flashcards, ${learnState.revise.left} left.`;
        return `LEARN tab: ${s.courses.length} course${s.courses.length === 1 ? '' : 's'} (${s.courses.map((c: CourseSummary) => `${c.title} ${c.done}/${c.lessons}`).join('; ') || 'none'}), ${L.dueCards().length} cards due, streak ${learnState.streak.current} days.`;
      },
    };
  },
};
