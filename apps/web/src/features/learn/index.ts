/**
 * LEARN tab — Ghosty the tutor (the brain's tutor.ts). COURSES with their mastery ring each, START A
 * COURSE (a topic, the level, minutes a day), and one STUDY panel that shows:
 * - a course as a MAP: its units, each lesson a stop (NOT STARTED / READ / QUIZ PASSED / MASTERED,
 *   the next one lit), the course's mastery in the ring, the pace, what to know first, the
 *   CALIBRATION line (how often SURE was right), the last exam, and LESSON n / QUIZ ME / EXAM /
 *   REVISE (up to 10 due cards of the course);
 * - a LESSON in its six parts (WHY IT MATTERS, THE IDEA, TWO WORKED EXAMPLES, COMMON MISTAKES,
 *   TRY IT, IN ONE LINE — the line a card once read), its sources as chips, READ ALOUD, NEXT;
 * - a QUIZ: pick an answer, say how sure (SURE / THINK SO / GUESSING), then see it marked;
 * - the EXAM: 10–20 questions from every opened lesson, a clock that never stops (leave and come
 *   back to the time that is really left), no marks until the end, then the grade, the weak
 *   lessons with REVISE, and every question's answer;
 * - REVISE (flashcards: SHOW ANSWER, then AGAIN / HARD / GOOD / EASY with SM-2's next date).
 * The daily streak and the cards due are in the hero. Everything is mirrored on the phone
 * (store.ts) so revision, opened lessons and the exam's clock work offline. The chat's tutor tool
 * opens views here through the `open_learn` command. State for specs at window.__ghosty.learn.
 */
import type { Card, Confidence, Course, CourseLesson, CourseSummary, ExamMarked, LearnLevel, LearnSource, LessonParts, Quiz, QuizQuestion } from '../../../../../packages/shared/src/learn';
import { LEARN_LEVELS, STOP_WORDS, aimOf, calibrationLine, dayText, masteryOf, paceDue } from '../../../../../packages/shared/src/learn';
import { dayKey, nextText, streakOf, type Rating } from '../../../../../packages/shared/src/sm2';
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h, svgEl } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { button, empty, panel, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import * as L from './store';
import { sayError } from '../../ui/hisWords';
import { waiting as said } from '../../ui/wait';
import { COURSE_HAS, COURSE_HAS_KEY, EXAM_WAIT, INTRO, LESSON_WAIT, MARK_WAIT, OFFLINE_KEYS, PLANNING, QUIZ_WAIT, TOPIC_EMPTY, cantMark, lessonOut, wrongAnswer } from './words';

type View = 'home' | 'course' | 'lesson' | 'quiz' | 'revise' | 'exam';

/** What the tab shows, for tests and the console (window.__ghosty.learn). */
export const learnState = {
  view: 'home' as View,
  course: '',
  lesson: 0,
  /** The lesson's parts on show (why, idea, examples, mistakes, try, summary). */
  parts: [] as string[],
  quiz: { id: '', i: 0, n: 0, right: 0, answered: 0, last: '', conf: '' },
  /** The course map: units, each stop's state, the mastery percent, the calibration line. */
  map: { units: 0, stops: [] as string[], mastery: 0, calibration: '' },
  /** Today's aim for the course on show (learn.u2): misses, the next lesson, or done; the lesson, the line and the lessons a misses quiz covers. */
  aim: { kind: '', lesson: 0, why: '', quiz: [] as number[] },
  exam: { id: '', i: 0, n: 0, left: 0, answered: 0, done: false, right: 0, pct: 0, grade: '', weak: [] as number[] },
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
  const inline = citer(sources);
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

/** A worked example: its first line as a heading unless it is a step, the "1." lines as a numbered list. */
function exampleBody(text: string, inline: (s: string) => (string | Node)[]): Node[] {
  const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
  const out: Node[] = [];
  let steps: HTMLLIElement[] = [];
  const flush = () => {
    if (steps.length) out.push(h('ol', ...steps));
    steps = [];
  };
  lines.forEach((x, i) => {
    const m = x.match(/^(?:\d+[.)]|[-•*])\s+(.*)$/);
    if (m) steps.push(h('li', ...inline(m[1]!)));
    else {
      flush();
      out.push(i === 0 ? h('p.learnextitle', ...inline(x)) : h('p', ...inline(x)));
    }
  });
  flush();
  return out;
}

/** [n] markers as small source chips, inside any line. */
const citer = (sources: LearnSource[]) => (s: string): (string | Node)[] =>
  s.split(/(\[\d+\])/).map((part) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return part;
    const src = sources.find((x) => x.n === Number(m[1]));
    return h('sup.learncite', { title: src?.title ?? '' }, m[1]!);
  });

/** A lesson written in its parts: WHY IT MATTERS, THE IDEA, the worked examples, COMMON MISTAKES (TRY IT and IN ONE LINE follow it). */
function lessonParts(p: LessonParts, sources: LearnSource[]): HTMLElement {
  const inline = citer(sources);
  const part = (id: string, label: string, ...kids: Node[]) => h('section.learnpart', { 'data-part': id }, h('div.lab.learnlead', label), ...kids);
  const box = h('div.learntext.learnparts');
  if (p.why) box.append(part('why', 'WHY IT MATTERS', h('p.learnwhy', ...inline(p.why))));
  box.append(part('idea', 'THE IDEA', ...p.idea.split(/\n{2,}/).map((x) => h('p', ...inline(x.replace(/\n/g, ' '))))));
  box.append(part('examples', p.examples.length > 1 ? 'TWO WORKED EXAMPLES' : 'WORKED EXAMPLE', ...p.examples.map((x, i) => h('div.learnexample', h('b.learnexn', `EXAMPLE ${i + 1}`), ...exampleBody(x, inline)))));
  if (p.mistakes.length) box.append(part('mistakes', 'COMMON MISTAKES', h('ul', ...p.mistakes.map((x) => h('li', ...inline(x))))));
  return box;
}

const CONF: [Confidence, string][] = [
  ['sure', 'SURE'],
  ['think', 'THINK SO'],
  ['guess', 'GUESSING'],
];

/** SURE / THINK SO / GUESSING, tapped before the answer is shown (or, in the exam, kept). */
function confidenceRow(onPick: (c: Confidence) => void): HTMLElement {
  const row = h('div.learnconf', { role: 'group', 'aria-label': 'How sure are you?' }, h('span.lab', 'HOW SURE ARE YOU?'));
  const btns = CONF.map(([c, label]) =>
    button(label, (b) => {
      for (const x of btns) x.disabled = true;
      b.classList.add('on');
      learnState.quiz.conf = c;
      onPick(c);
    }, `learnconfbtn ${c}`),
  );
  row.append(h('div.learnconfbtns', ...btns));
  return row;
}

const mmss = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

function sourceChips(sources: LearnSource[] = []): HTMLElement {
  return h(
    'div.learnsources',
    ...sources.map((s) =>
      s.url ? h('a.chip.learnsrc', { href: s.url, target: '_blank', rel: 'noopener noreferrer', title: s.title }, `[${s.n}] ${s.title}`) : h('span.chip.learnsrc', { title: s.title }, `[${s.n}] ${s.title}`),
    ),
  );
}

/** Quiz answers that never reached the brain, by quiz: the DONE line then never claims every miss is a flashcard. */
const lostAnswers = new Map<string, number>();
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
  // [consistency] one name: the screen is Courses everywhere (Learn is the room it sits in)
  title: 'COURSES',
  icon: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
  scene: 'backdrop',
  blurb: 'courses · quizzes · flashcards',
  mount(root) {
    const P = page(root, { tag: 'TUTOR', sub: INTRO, leftLabel: 'STUDY', rightLabel: 'START', stack: true });
    expose();
    let view: View = 'home';
    let current: Course | null = null;
    let quizNow: Quiz | null = null;
    let queue: Card[] = [];
    /** The exam's clock (one tick a second while the exam is on show). */
    let tick = 0;

    // ======================= STUDY: the one panel that changes
    const sp = panel('STUDY', { cls: 'learnstudy' });
    const setView = (v: View, title: string) => {
      view = v;
      learnState.view = v;
      sp.title.textContent = title;
      clearInterval(tick);
      stopSpeaking();
    };

    // ======================= COURSES
    const cp = panel('COURSES', { cls: 'learncourses' });
    /** Whether the last sync with the brain went through (the COURSES count is said only then). */
    let syncOk = true;
    const syncNow = (): Promise<boolean> =>
      L.sync().then((ok) => {
        syncOk = ok;
        return ok;
      });
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
    /* state: learn.courses empty */
    /* state: learn.courses error */
    const topicSay = h('p.note.learnsay', { role: 'status', 'aria-live': 'polite', hidden: true, dataset: { state: 'empty', case: 'keep' } });
    const start = async () => {
      const t = topicIn.value.trim();
      topicSay.hidden = true;
      if (t.length < 2) {
        topicSay.textContent = TOPIC_EMPTY;
        topicSay.hidden = false;
        topicIn.focus();
        return;
      }
      startBtn.disabled = true;
      // (planning is said once, as a waiting line: the key keeps its word)
      /* state: learn.courses loading */
      const done = said(np.body, PLANNING);
      try {
        const c = await L.startCourse(t, level, minutes);
        topicIn.value = '';
        toast(`Course ready: ${c.title}`, 'ok');
        done();
        showCourse(c.id);
      } catch (e) {
        done();
        topicSay.textContent = sayError(e, 'plan it');
        topicSay.dataset.state = 'error';
        topicSay.hidden = false;
      }
      done();
      startBtn.disabled = false;
    };
    topicIn.addEventListener('keydown', (e) => e.key === 'Enter' && void start());
    // [learn.s3, learn.s4] ready starts: driving theory from the public Highway Code, and trade basics (figures marked first estimates)
    const STARTS: [string, string][] = [['Driving theory', 'driving theory from the Highway Code'], ['Car mechanics', 'car mechanics basics'], ['Home electrics', 'home electrics basics'], ['First aid', 'first aid basics']];
    const starts = h('div.learnstarts', { role: 'group', 'aria-label': 'Ready starts' }, ...STARTS.map(([label, topic]) => {
      const b = button(label.toUpperCase(), () => {
        topicIn.value = topic;
        topicIn.focus();
        topicSay.textContent = /mechanic|electric/.test(topic) ? 'Every figure in it is a first estimate, never certified: check the maker’s figure, and a qualified person for anything dangerous.' : '';
      });
      b.dataset.label = label;
      return b;
    }));
    np.body.append(h('div.keyrow.learntopic', topicIn), starts, levelChips, minChips, topicSay, h('div.row.wrap', startBtn), h('div.note', 'Or just say "teach me …" to Ghosty. Lessons come from your library and Wikipedia, with their sources.'));

    // [learn.u3] MY LEARNING MAP: one picture of courses, reading, speaking and revision, and the one thing to try next
    const mp = panel('MY LEARNING MAP', { cls: 'learnmapall', grow: false });
    const paintMastery = () => void import('./mastery').then((m) => m.masteryPanelBody(mp.body));
    paintMastery();
    L.learn.subscribe(() => paintMastery());
    P.left.append(sp.el, cp.el);
    P.right.append(np.el, mp.el);

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
      // (a count only while the brain answers: offline, or after a sync that failed, the courses are the phone's own copy)
      const live = !!s.synced && syncOk && navigator.onLine !== false;
      cp.setStatus(live ? `${s.courses.length}` : 'ON THIS PHONE', live ? 'ok' : 'mid');
      clear(cp.body);
      if (!s.courses.length) {
        const none = empty('NONE', 'Start one below, or just say “teach me photosynthesis”.', 'No courses yet');
        none.dataset.state = 'empty';
        cp.body.append(none);
        return;
      }
      for (const c of [...s.courses].sort((a, b) => b.updated - a.updated)) {
        const due = s.cards.filter((x) => x.course === c.id && x.due <= Date.now()).length;
        const pct = c.mastery ?? 0;
        const r = h(
          'button.learncourse',
          { type: 'button', 'data-id': c.id },
          ring(pct / 100, `${pct}%`),
          h('span.learncinfo', h('b', c.title), h('small', `${c.level.toUpperCase()} · ${c.done}/${c.lessons} read · ${c.mastered ?? 0} mastered · ${c.next ? `next: ${c.nextTitle}` : 'all read'}`)),
          due ? h('span.chip.learndue', `${due} DUE`) : '',
        );
        r.addEventListener('click', () => void showCourse(c.id));
        cp.body.append(r);
      }
      // [learn.s10] QUIZ NIGHT: Ghosty hosts a quiz at the table from these courses' own questions (works with no signal)
      const night = button('QUIZ NIGHT', () => void import('./quiznight').then((q) => q.openQuizNight()));
      night.classList.add('learnnight');
      // [learn.c6] QUIZ ME ALOUD: hands-free, every question and answer spoken, nothing to look at ("quiz me while I drive")
      const aloud = button('QUIZ ME ALOUD', () => void import('./aloud').then((q) => q.openAloud()));
      aloud.classList.add('learnaloud');
      cp.body.append(h('div.row.wrap.learnnightrow', night, h('small', 'I host a quiz for you and friends at the table, from your courses.')), h('div.row.wrap.learnnightrow', aloud, h('small', 'Hands-free: I ask aloud and you answer by voice, nothing to look at.')));
    };

    // ======================= views
    const showHome = () => {
      setView('home', 'STUDY');
      learnState.course = '';
      const s = L.learn.get();
      clear(sp.body);
      const due = L.dueCards().length;
      const latest = [...s.courses].sort((a, b) => b.updated - a.updated)[0];
      const ex = s.exam;
      if (ex) sp.body.append(button(h('span', h('b', ex.finishing ? 'EXAM WAITING TO BE MARKED' : 'RESUME EXAM'), h('small', `${ex.exam.title} · ${ex.finishing ? 'marked when Ghosty is reachable' : `${mmss(Math.ceil((ex.endsAt - Date.now()) / 1000))} left`}`)), () => void showExam(ex.exam.course), 'learnbig'));
      if (latest && latest.next) sp.body.append(button(h('span', h('b', 'CONTINUE'), h('small', `${latest.title} · lesson ${latest.next}: ${latest.nextTitle}`)), () => void showLesson(latest.id, latest.next), 'learnbig'));
      if (due) sp.body.append(button(h('span', h('b', `REVISE ${Math.min(10, due)} CARD${Math.min(10, due) === 1 ? '' : 'S'}`), h('small', `${due} due · a few minutes keeps them for good`)), () => showRevise({ limit: 10 }), 'learnbig'));
      if (!latest && !due) sp.body.append(h('div.note.learncold', { dataset: { state: 'empty' } }, 'Tell me what to teach and I make you a course.'), h('details.learnhas', h('summary', COURSE_HAS_KEY), h('p', COURSE_HAS)));
      else if (!due) sp.body.append(h('div.note', 'No cards due. Each lesson you read, and each wrong answer, becomes a card here.'));
    };

    /** The plan's basis in plain words: where it came from, or that it is only an outline. */
    const basisLine = (c: Course) => (c.basis.startsWith('outline') ? 'An outline only: no model was free to plan it. The lessons are still written when you open them.' : `Planned from your ${c.basis}.`);

    const showCourse = async (id: string) => {
      learnState.course = id;
      const c = (await L.course(id)) ?? null;
      if (!c) return void toast('That course is not on this phone yet', 'warn');
      paintMap(c);
    };

    /** What the map shows, in one string: it is painted again only when this changes (a score, a card, a lesson, an exam). */
    const mapSig = (id: string) => {
      const s = L.learn.get();
      const sum = s.courses.find((x) => x.id === id);
      const c = s.full[id];
      return JSON.stringify([sum?.stats, sum?.done, L.dueCards(Date.now(), id).length, c?.lessons.map((l) => !!l.done), c?.exams?.length, s.exam?.exam.id ?? '', s.exam?.finishing]);
    };
    let painted = '';

    const paintMap = (c: Course) => {
      const id = c.id;
      current = c;
      setView('course', 'COURSE');
      painted = mapSig(id);
      const s = L.learn.get();
      const sum = s.courses.find((x) => x.id === id);
      const now = Date.now();
      const m = masteryOf(c, sum?.stats, s.cards.filter((x) => x.course === id), now);
      const units = c.units?.length ? c.units : [{ n: 1, title: 'The course' }];
      const due = L.dueCards(now, id).length;
      const calib = calibrationLine(sum?.stats?.conf);
      learnState.map = { units: units.length, stops: m.stops.map((x) => x.state), mastery: m.pct, calibration: calib };
      clear(sp.body);
      const doneN = c.lessons.filter((l) => l.done).length;
      sp.body.append(h('div.learnhead', ring(m.pct / 100, `${m.pct}%`), h('span', h('b', c.title), h('small', `${c.level.toUpperCase()} · ${c.minutes} MIN A DAY · ${doneN}/${c.lessons.length} READ · ${m.mastered} MASTERED`))));
      // The facts: the pace (and whether it is kept), the plan's basis, what to know first, calibration, the last exam.
      const facts = h('div.learnfacts');
      const fact = (k: string, v: string, cls = '') => facts.append(h(`div.learnfact${cls ? `.${cls}` : ''}` as 'div', h('span.lab', k), h('span', v)));
      if (c.pace) {
        const start = dayKey(c.created, L.tz());
        const want = paceDue(c.pace, start, L.today(), c.lessons.length);
        const behind = want - doneN;
        fact('PACE', `${c.pace.text}${doneN >= c.lessons.length ? ' · all read' : behind > 0 ? ` · ${behind} behind` : ' · on track'}`, 'pace');
      }
      fact('PLAN', basisLine(c), 'basis');
      if (c.prereqs?.length) fact('BEFORE YOU START', c.prereqs.join(' · '), 'prereqs');
      fact('CALIBRATION', calib, 'calib');
      const last = c.exams?.at(-1);
      if (last) fact('LAST EXAM', `${last.grade} · ${last.right} of ${last.n} (${last.pct}%) · ${dayText(dayKey(last.at, L.tz()))}`, 'lastexam');
      sp.body.append(facts, h('div.note', c.summary));
      const next = c.lessons.find((l) => !l.done);
      // TODAY (learn.u2): the lesson his recent answers say to look at again (a miss he was sure of most), and a quiz on
      // just those lessons; with nothing missed, the next lesson. Worked out on this phone from the kept scores.
      const aim = aimOf(c, sum?.stats, next?.n ?? 0);
      learnState.aim = { kind: aim.kind, lesson: aim.lesson, why: aim.why, quiz: aim.quiz };
      if (aim.kind !== 'next') {
        sp.body.append(h('div.learntoday', { dataset: { kind: aim.kind } },
          h('span.lab', 'TODAY'),
          h('b', aim.kind === 'misses' ? `${aim.lesson}. ${aim.title}` : 'All read'),
          h('small', aim.why),
          aim.kind === 'misses'
            ? h('div.row.wrap', button(`LESSON ${aim.lesson} AGAIN`, () => void showLesson(c.id, aim.lesson), 'on'), button('QUIZ ME ON MY MISSES', () => void startQuiz({ course: c.id, lessons: aim.quiz })))
            : null));
      }
      const open = s.exam && s.exam.exam.course === c.id ? s.exam : null;
      // REMOVE: gone at once with UNDO (12 s) — its lessons, cards and progress come back exactly; the brain
      // forgets the course only when the bar goes.
      const del = button('REMOVE', () => {
        const going = L.removeCourseLater(c.id);
        showHome();
        undo(
          `Course removed: ${c.title}`,
          () => {
            going.undo();
            toast(`Back: ${c.title}`, 'ok');
            if (learnState.view === 'home') showHome();
          },
          () =>
            going.commit().catch((e) => {
              // the brain could not be told: it stays, and shows again
              going.undo();
              toast(sayError(e, 'remove it'), 'bad');
              if (learnState.view === 'home') showHome();
            }),
        );
      }, 'warn');
      sp.body.append(
        h(
          'div.row.wrap.learnbar',
          next ? button(`LESSON ${next.n}`, () => void showLesson(c.id, next.n), 'on') : h('span.chip.good', 'ALL READ'),
          button('QUIZ ME', () => void startQuiz({ course: c.id })),
          button(open ? `RESUME EXAM · ${mmss(Math.ceil((open.endsAt - now) / 1000))}` : 'EXAM', () => void showExam(c.id), 'learnexambtn'),
          due ? button(`REVISE ${Math.min(10, due)}`, () => showRevise({ course: c.id, limit: 10 }), 'learnrevisebtn') : '',
          // [sites] this course's cards as an offline app on the Home Screen (NEXT ROUND sites.c2): asked in the chat, built after his APPROVE
          L.learn.get().cards.some((x) => x.course === c.id)
            ? button('CARDS ON MY HOME SCREEN', () => void (async () => {
                const [{ send }, { openChat }] = await Promise.all([import('../../assistant/session'), import('../../shell/launcher')]);
                openChat();
                void send(`Make my ${c.topic} cards an app`);
              })(), 'learncardsapp')
            : '',
          del,
        ),
      );
      // The map: each unit's header, then its stops; the next lesson is lit.
      const map = h('div.learnmap');
      for (const u of units) {
        const ls = c.lessons.filter((l) => (l.unit ?? 1) === u.n);
        if (!ls.length) continue;
        const stops = ls.map((l) => m.stops.find((x) => x.n === l.n)!);
        if (units.length > 1) map.append(h('div.learnunit', h('b', `UNIT ${u.n} · ${u.title}`), h('small', `${stops.filter((x) => x.state === 'mastered').length} of ${ls.length} mastered`)));
        const list = h('div.learnlessons');
        for (const l of ls) {
          const st = m.stops.find((x) => x.n === l.n)!;
          const info = [STOP_WORDS[st.state], st.pct !== null ? `quiz ${st.pct}%` : '', st.due ? `${st.due} card${st.due === 1 ? '' : 's'} due` : '', l.needs?.length ? `after ${l.needs.join(', ')}` : ''].filter(Boolean).join(' · ');
          const b = h('button.learnlesson', { type: 'button', 'data-state': st.state, 'data-n': String(l.n) }, h('i', st.state === 'mastered' ? '★' : st.state !== 'new' ? '✓' : String(l.n)), h('span', h('b', `${l.n}. ${l.title}`), h('small', info)));
          if (l.done) b.classList.add('done');
          if (next && l.n === next.n) b.classList.add('next');
          b.addEventListener('click', () => void showLesson(c.id, l.n));
          list.append(b);
        }
        map.append(list);
      }
      sp.body.append(map);
      if (sum?.cards) sp.body.append(h('div.note', `${sum.cards} card${sum.cards === 1 ? '' : 's'} from this course, ${due} due.`));
    };

    const showLesson = async (courseId: string, n: number) => {
      setView('lesson', `LESSON ${n}`);
      learnState.course = courseId;
      learnState.lesson = n;
      learnState.parts = [];
      clear(sp.body);
      const done = said(sp.body, LESSON_WAIT);
      let l: CourseLesson;
      try {
        if (!L.learn.get().full[courseId]) await L.course(courseId);
        l = await L.lesson(courseId, n);
        done();
      } catch (e) {
        done();
        if (learnState.view !== 'lesson' || learnState.lesson !== n) return;
        // my brain out of reach or the lesson not written: what still works (the lessons opened, the cards), and the one way on
        const out = lessonOut(L.dueCards().length);
        /* state: learn.courses offline */
        clear(sp.body, h('div.learnout', { role: 'status', dataset: { state: navigator.onLine === false ? 'offline' : 'error' } }, h('p', h('b', out.head)), h('p', out.line)), h('div.row.wrap.learnbar', button(OFFLINE_KEYS.back, () => void showCourse(courseId), 'on'), L.dueCards().length ? button(OFFLINE_KEYS.revise, () => showRevise({ limit: 10 })) : ''));
        void sayError(e, 'get the lesson');
        return;
      }
      if (learnState.view !== 'lesson' || learnState.lesson !== n) return;
      const c = L.learn.get().full[courseId];
      current = c ?? current;
      const total = c?.lessons.length ?? n;
      const unit = c?.units && c.units.length > 1 ? c.units.find((u) => u.n === (l.unit ?? 1)) : undefined;
      clear(sp.body);
      const text = l.text ?? '';
      const p = l.parts;
      const spoken = p
        ? [l.title, `Why it matters: ${p.why}`, p.idea, ...p.examples.map((x, i) => `Example ${i + 1}: ${x}`), p.mistakes.length ? `Common mistakes: ${p.mistakes.join('. ')}` : '', p.summary ? `In one line: ${p.summary}` : ''].filter(Boolean).join('. ')
        : `${l.title}. ${text}`;
      const aloud = button('READ ALOUD', (b) => {
        if (b.classList.toggle('on')) void speak(spoken.replace(/\[\d+\]/g, '')).finally(() => b.classList.remove('on'));
        else stopSpeaking();
      });
      sp.body.append(h('div.learnhead', h('span', h('b', l.title), h('small', `LESSON ${n} OF ${total}${unit ? ` · UNIT ${unit.n}: ${unit.title}` : ''}${c ? ` · ${c.title}` : ''}`))), h('div.row.wrap.learnbar', aloud));
      if (p) {
        sp.body.append(lessonParts(p, l.sources ?? []));
        learnState.parts = ['why', 'idea', 'examples', 'mistakes'].filter((x) => x !== 'why' || p.why).filter((x) => x !== 'mistakes' || p.mistakes.length);
      } else sp.body.append(lessonBody(text, l.sources ?? []));
      sp.body.append(sourceChips(l.sources));
      const after = h('div.row.wrap.learnbar');
      const nextBtn = button(n < total ? 'NEXT LESSON' : 'FINISH', async () => {
        await L.finishLesson(courseId, n);
        paintAll();
        if (n < total) void showLesson(courseId, n + 1);
        else {
          toast('Course read — try the exam', 'ok');
          void showCourse(courseId);
        }
      }, 'on');
      if (l.check) {
        const ck = l.check;
        const box = h('section.learncheck.learnpart', { 'data-part': 'try' }, h('div.lab.learnlead', 'TRY IT'), h('p.learnq', ck.q));
        const out = h('div.note.learnfeed');
        const choices = ck.choices.map((ch, i) => {
          const b = button(`${LETTERS[i]}) ${ch}`, () => {
            const right = i === ck.answer;
            for (const x of choices) x.disabled = true;
            b.classList.add(right ? 'good' : 'bad');
            choices[ck.answer]!.classList.add('good');
            out.textContent = right ? `Right.${ck.why ? ` ${ck.why}` : ''}` : wrongAnswer(LETTERS[ck.answer]!, ck.choices[ck.answer]!, ck.why);
            learnState.quiz.last = right ? 'right' : 'wrong';
            void L.answer({ course: courseId, lesson: n, answer: i }).then((r) => r.card && toast('Made a flashcard of it', 'ok')).catch(() => undefined).finally(() => paintAll());
          }, 'learnchoice');
          return b;
        });
        box.append(...choices, out);
        sp.body.append(box);
        learnState.parts.push('try');
      }
      if (p?.summary) {
        sp.body.append(h('section.learnone.learnpart', { 'data-part': 'summary' }, h('div.lab.learnlead', 'IN ONE LINE'), h('p', ...citer(l.sources ?? [])(p.summary)), h('small', l.done ? 'It is one of your flashcards.' : 'Becomes a flashcard when you finish this lesson.')));
        learnState.parts.push('summary');
      }
      after.append(nextBtn, button('QUIZ ON THIS', () => void startQuiz({ course: courseId, lesson: n })), button('BACK TO COURSE', () => void showCourse(courseId)));
      sp.body.append(after);
    };

    const startQuiz = async (a: { course?: string; topic?: string; lesson?: number; lessons?: number[] }) => {
      setView('quiz', 'QUIZ');
      clear(sp.body);
      const done = said(sp.body, QUIZ_WAIT);
      try {
        const q = await L.quiz({ ...a, n: 5 });
        done();
        showQuiz(q);
      } catch (e) {
        done();
        clear(sp.body, h('div.note', sayError(e, 'make that quiz')), button('BACK', () => (a.course ? void showCourse(a.course) : showHome())));
      }
    };

    const showQuiz = (q: Quiz, i = 0, right = 0) => {
      quizNow = q;
      setView('quiz', `QUIZ · ${i + 1} / ${q.questions.length}`);
      learnState.quiz = { ...learnState.quiz, id: q.id, i, n: q.questions.length, right, answered: i, conf: '' };
      clear(sp.body);
      if (i >= q.questions.length) {
        sp.title.textContent = 'QUIZ · DONE';
        const pct = Math.round((right / q.questions.length) * 100);
        sp.body.append(
          h('div.learnscore', h('b', `${right} / ${q.questions.length}`), h('small', lostAnswers.get(q.id) ? `${pct >= 80 ? 'Excellent.' : pct >= 50 ? 'Good.' : 'Worth another go.'} Some answers didn’t reach me, so not every miss is a flashcard yet.` : pct >= 80 ? 'Excellent.' : pct >= 50 ? 'Good — the misses (and lucky guesses) are now flashcards.' : 'Worth another go — the misses are now flashcards.')),
          h('div.row.wrap.learnbar', button('NEW QUIZ', () => void startQuiz(q.course !== 'general' ? { course: q.course } : { topic: q.topic }), 'on'), L.dueCards().length ? button('REVISE', () => showRevise({ limit: 10 })) : '', q.course !== 'general' ? button('BACK TO COURSE', () => void showCourse(q.course)) : ''),
        );
        // The brain's score for the course, now that every answer is in.
        void syncNow().then(() => paintAll());
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
          toast(sayError(e, 'keep it'), 'bad');
          b.disabled = false;
        }
      });
      cardBtn.hidden = true;
      const done = (ok: boolean, text: string, card: boolean) => {
        if (ok) right++;
        learnState.quiz = { ...learnState.quiz, right, answered: i + 1, last: ok ? 'right' : 'wrong' };
        out.textContent = text;
        out.className = `note learnfeed ${ok ? 'good' : 'bad'}`;
        nextBtn.hidden = false;
        // A miss (or a lucky guess) is a card already (the brain made it); a hit can be kept too.
        cardBtn.hidden = !ok || card;
      };
      sp.body.append(h('p.learnq', item.q));
      if (q.basis && /no model/.test(q.basis) && i === 0) sp.body.append(h('div.note.learnbasis', `These are ${q.basis}.`));
      const slot = h('div.learnconfslot');
      if (item.kind === 'mc') {
        const choices = (item.choices ?? []).map((ch, k) => {
          const b = button(`${LETTERS[k]}) ${ch}`, () => {
            for (const x of choices) x.disabled = true;
            b.classList.add('picked');
            // How sure, first; then the answer is shown.
            clear(slot, confidenceRow((conf) => {
              clear(slot);
              const ok = k === Number(item.answer);
              b.classList.remove('picked');
              b.classList.add(ok ? 'good' : 'bad');
              choices[Number(item.answer)]?.classList.add('good');
              const guessNote = ok && conf === 'guess' ? ' A lucky guess still becomes a card.' : !ok && conf === 'sure' ? ' You were sure: this card comes back more often.' : '';
              done(ok, `${ok ? `Right.${item.why ? ` ${item.why}` : ''}` : wrongAnswer(LETTERS[Number(item.answer)]!, String(item.choices?.[Number(item.answer)] ?? ''), item.why)}${guessNote}`, !ok || conf === 'guess');
              void L.answer({ quiz: q.id, q: item.id, answer: k, conf }).catch(() => void lostAnswers.set(q.id, (lostAnswers.get(q.id) ?? 0) + 1)).finally(() => paintAll());
            }));
          }, 'learnchoice');
          return b;
        });
        sp.body.append(...choices, slot);
      } else {
        const inp = h('input', { placeholder: 'Your answer', 'aria-label': 'Your answer', maxlength: '300' });
        const check = button('CHECK', (b) => {
          const given = inp.value.trim();
          if (!given) return void toast('Type an answer first', 'warn');
          b.disabled = true;
          inp.disabled = true;
          clear(slot, confidenceRow(async (conf) => {
            b.textContent = 'MARKING…';
            try {
              const r = await L.answer({ quiz: q.id, q: item.id, answer: given, conf });
              clear(slot);
              done(r.correct, `${r.feedback}${r.correct ? '' : ` (answer: ${r.expected})`}`, !!r.card);
            } catch {
              // No brain to mark it: the answer is shown and nothing is counted.
              clear(slot);
              out.textContent = cantMark(String(item.answer));
              nextBtn.hidden = false;
            }
            b.textContent = 'CHECK';
            paintAll();
          }));
        }, 'on');
        inp.addEventListener('keydown', (e) => e.key === 'Enter' && !check.disabled && check.click());
        sp.body.append(h('div.keyrow.learnshort', inp, check), slot);
      }
      sp.body.append(out, h('div.row.wrap.learnbar', nextBtn, cardBtn));
    };

    // ======================= the exam
    const showExam = async (courseId: string) => {
      setView('exam', 'EXAM');
      learnState.course = courseId;
      learnState.exam = { ...learnState.exam, done: false };
      clear(sp.body);
      const done = said(sp.body, EXAM_WAIT);
      try {
        await L.startExam(courseId);
        done();
      } catch (e) {
        done();
        // (another course's exam is still open: the way to it, not only the way back)
        const open = L.learn.get().exam;
        clear(sp.body, h('div.note', sayError(e, 'make that exam')), open && open.exam.course !== courseId ? button('RESUME THAT EXAM', () => void showExam(open.exam.course), 'on') : null, button('BACK TO COURSE', () => void showCourse(courseId)));
        return;
      }
      if (view === 'exam') runExam();
    };

    /** The exam on show: the clock (from the deadline, so it never stops), one question at a time, no marks until the end. */
    const runExam = () => {
      const e = L.learn.get().exam;
      if (!e) return void showCourse(learnState.course);
      clearInterval(tick);
      learnState.course = e.exam.course;
      const n = e.exam.questions.length;
      const left = () => Math.ceil((e.endsAt - Date.now()) / 1000);
      learnState.exam = { ...learnState.exam, id: e.exam.id, i: e.i, n, left: Math.max(0, left()), answered: e.answers.length, done: false };
      if (e.finishing || left() <= 0) return void endExam();
      clear(sp.body);
      const clock = h('b.learnclock', mmss(left()));
      const paintClock = () => {
        const sec = left();
        learnState.exam.left = Math.max(0, sec);
        clock.textContent = mmss(sec);
        clock.classList.toggle('low', sec <= 60);
        sp.title.textContent = `EXAM · ${mmss(sec)} LEFT`;
        if (sec <= 0) void endExam();
      };
      tick = window.setInterval(paintClock, 1000);
      paintClock();
      sp.body.append(h('div.learnexamhead', h('span', h('b', e.exam.title), h('small', `${n} questions from ${e.exam.basis} · ${e.answers.length} answered · no marks until the end`)), clock));
      let sure = false;
      const finishBtn = button(e.i >= n ? 'FINISH AND MARK' : 'FINISH NOW', (b) => {
        if (e.i < n && !sure) {
          sure = true;
          b.textContent = `${n - e.answers.length} UNANSWERED · TAP AGAIN`;
          return;
        }
        void endExam();
      }, e.i >= n ? 'on' : 'warn');
      if (e.i >= n) {
        sp.body.append(h('div.learnscore', h('b', `${e.answers.filter((x) => x.answer !== null).length} / ${n}`), h('small', 'answered. Finish to see your grade, or use the time left to go back.')), h('div.row.wrap.learnbar', finishBtn, button('BACK TO QUESTION 1', () => (L.learn.set({ exam: { ...e, i: 0 } }), runExam()))));
        return;
      }
      const q = e.exam.questions[e.i]!;
      const had = e.answers.find((x) => x.q === q.id);
      const slot = h('div.learnconfslot');
      const go2 = (given: number | string | null, conf?: Confidence) => {
        L.answerExam(q.id, given, conf);
        runExam();
      };
      sp.body.append(h('div.lab.learnqn', `QUESTION ${e.i + 1} OF ${n}`), h('p.learnq', q.q));
      if (q.kind === 'mc') {
        const choices = (q.choices ?? []).map((ch, k) => {
          const b = button(`${LETTERS[k]}) ${ch}`, () => {
            for (const x of choices) x.disabled = true;
            b.classList.add('picked');
            clear(slot, confidenceRow((conf) => go2(k, conf)));
          }, 'learnchoice');
          if (had?.answer === k) b.classList.add('was');
          return b;
        });
        sp.body.append(...choices, slot);
      } else {
        const inp = h('input', { placeholder: 'Your answer', 'aria-label': 'Your answer', maxlength: '300', value: typeof had?.answer === 'string' ? had.answer : '' });
        const ok = button('NEXT', (b) => {
          const given = inp.value.trim();
          if (!given) return void toast('Type an answer, or SKIP', 'warn');
          b.disabled = true;
          inp.disabled = true;
          clear(slot, confidenceRow((conf) => go2(given, conf)));
        }, 'on');
        inp.addEventListener('keydown', (ev) => ev.key === 'Enter' && !ok.disabled && ok.click());
        sp.body.append(h('div.keyrow.learnshort', inp, ok), slot);
      }
      sp.body.append(h('div.row.wrap.learnbar', button('SKIP', () => go2(had?.answer ?? null, had?.conf)), e.i > 0 ? button('BACK', () => (L.learn.set({ exam: { ...e, i: e.i - 1 } }), runExam())) : '', finishBtn));
    };

    const endExam = async () => {
      clearInterval(tick);
      const e = L.learn.get().exam;
      if (!e) return;
      if (view === 'exam') clear(sp.body);
      const done = view === 'exam' ? said(sp.body, MARK_WAIT) : () => undefined;
      sp.title.textContent = 'EXAM · MARKING';
      let r: ExamMarked | null = null;
      try {
        r = await L.finishExam();
      } catch {
        r = null;
      }
      done();
      if (view !== 'exam') return;
      if (!r) {
        const still = L.learn.get().exam;
        clear(sp.body, h('div.note', still ? 'Your answers are kept on this phone; the exam is marked as soon as Ghosty is reachable.' : 'That exam is no longer open.'), button('BACK TO COURSE', () => void showCourse(e.exam.course)));
        return;
      }
      showExamResult(r, e.exam);
      paintAll();
      void syncNow().then(() => paintAll());
    };

    const showExamResult = (r: ExamMarked, exam: { course: string; title: string; questions: QuizQuestion[] }) => {
      setView('exam', 'EXAM · RESULT');
      const res = r.result;
      learnState.exam = { ...learnState.exam, id: res.id, done: true, right: res.right, n: res.n, pct: res.pct, grade: res.grade, weak: res.weak.map((w) => w.n), left: 0 };
      clear(sp.body);
      sp.body.append(h('div.learnscore.learngrade', h('b', res.grade.toUpperCase()), h('small', `${res.right} of ${res.n} right · ${res.pct}% · ${mmss(res.used)} of ${mmss(res.seconds)} used`)));
      const weak = h('div.learnweak', h('div.lab', res.weak.length ? 'WEAK LESSONS' : 'NO WEAK LESSONS'));
      if (!res.weak.length) weak.append(h('div.note', 'Every lesson in it was 80 % or more.'));
      for (const w of res.weak)
        weak.append(h('div.learnweakrow', h('span', h('b', `${w.n}. ${w.title}`)), button('REVISE', () => showRevise({ course: exam.course, lesson: w.n }), 'on'), button('OPEN', () => void showLesson(exam.course, w.n))));
      sp.body.append(weak);
      const review = h('div.learnreview', h('div.lab', 'EVERY QUESTION'));
      r.marks.forEach((mk, i) => {
        const q = exam.questions.find((x) => x.id === mk.q);
        review.append(h(`div.learnrev.${mk.correct ? 'good' : 'bad'}` as 'div', h('i', mk.correct ? '✓' : '✗'), h('span', h('b', `${i + 1}. ${q?.q ?? ''}`), h('small', `${mk.correct ? 'Right' : `Answer: ${mk.expected}`}${mk.conf ? ` · you said ${mk.conf === 'think' ? 'think so' : mk.conf === 'guess' ? 'guessing' : 'sure'}` : ''}`))));
      });
      sp.body.append(review, h('div.row.wrap.learnbar', button('BACK TO COURSE', () => void showCourse(exam.course), 'on')));
    };

    const showRevise = (o: { course?: string; lesson?: number; limit?: number } = {}) => {
      setView('revise', 'REVISE');
      queue = o.lesson && o.course ? L.lessonCards(o.course, o.lesson) : L.dueCards(Date.now(), o.course);
      if (o.limit) queue = queue.slice(0, o.limit);
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
          const rated = L.review(card, r);
          learnState.revise.done++;
          // Forgotten: seen again before this sitting ends (SM-2 brings it back in 10 minutes anyway),
          // as the card is now — the lapse just recorded is what the next rating builds on.
          if (r === 'again' && !again.has(card.id)) {
            again.add(card.id);
            queue.push(rated);
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
      void syncNow().then(() => {
        paintAll();
        if (typeof a.quiz === 'string') void L.quizById(a.quiz).then((q) => (q ? showQuiz(q) : toast('That quiz is no longer kept', 'warn')));
        else if (a.view === 'revise') showRevise({ limit: 10 });
        else if (id && Number(a.n)) void showLesson(id, Number(a.n));
        else if (id) void showCourse(id);
        else if (a.view === 'courses' || view === 'home') showHome();
      });
    };
    opener = handle;

    // The map follows what arrives after it was drawn (the brain's scores after a quiz, a card made, a lesson read elsewhere).
    let repaint = 0;
    L.learn.subscribe(() => {
      paintHero();
      if (view !== 'course' || !current) return;
      clearTimeout(repaint);
      repaint = window.setTimeout(() => {
        const c = current && L.learn.get().full[current.id];
        if (view === 'course' && c && mapSig(c.id) !== painted) paintMap(c);
      }, 60);
    });
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
        // An exam left open: back on its question with the time that is really left (or marked, if it ran out).
        if (view === 'exam' && L.learn.get().exam) runExam();
        void syncNow().then(() => {
          paintAll();
          if (view === 'home') showHome();
        });
      },
      leave() {
        clearInterval(tick);
        stopSpeaking();
        void L.flush();
      },
      // (BRIEF-SHELL pass 1) what is open: an exam, a course, a lesson, a quiz or the cards
      context: () => {
        const s = L.learn.get();
        const said =
          view === 'exam' && s.exam ? `an exam, question ${s.exam.i + 1} of ${s.exam.exam.questions.length}`
          : view === 'course' && current ? `the map of ${current.title}`
          : view === 'lesson' && current ? `lesson ${learnState.lesson} of ${current.title}`
          : view === 'quiz' && quizNow ? `a quiz, question ${learnState.quiz.i + 1} of ${learnState.quiz.n}`
          : view === 'revise' ? 'the flashcards'
          : `${s.courses.length} ${s.courses.length === 1 ? 'course' : 'courses'}`;
        const label = view === 'exam' && s.exam ? s.exam.exam.title : current && (view === 'course' || view === 'lesson') ? current.title : '';
        return screenSays('learn', 'Courses', `the courses, ${said}`, {
          looking: 'the courses',
          ...(label ? { selected: { kind: 'item', id: `course:${label}`, label, detail: view } } : {}),
        });
      },
      describe() {
        const s = L.learn.get();
        if (view === 'exam' && s.exam) return `LEARN tab: an exam on "${s.exam.exam.title}", question ${s.exam.i + 1} of ${s.exam.exam.questions.length}, ${mmss(learnState.exam.left)} left (no marks until the end).`;
        if (view === 'course' && current) return `LEARN tab: the map of "${current.title}": ${learnState.map.mastery}% mastered; ${learnState.map.calibration}.`;
        if (view === 'lesson' && current) return `LEARN tab: reading lesson ${learnState.lesson} of the course "${current.title}" (${current.level}).`;
        if (view === 'quiz' && quizNow) return `LEARN tab: a quiz on "${quizNow.topic}", question ${learnState.quiz.i + 1} of ${learnState.quiz.n}.`;
        if (view === 'revise') return `LEARN tab: revising flashcards, ${learnState.revise.left} left.`;
        return `LEARN tab: ${s.courses.length} course${s.courses.length === 1 ? '' : 's'} (${s.courses.map((c: CourseSummary) => `${c.title} ${c.done}/${c.lessons}`).join('; ') || 'none'}), ${L.dueCards().length} cards due, streak ${learnState.streak.current} days.`;
      },
    };
  },
};
