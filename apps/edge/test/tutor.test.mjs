// The tutor (tutor.ts, tools/learn.ts, packages/shared/src/sm2.ts): SM-2's maths and the streak; the
// model's replies read however they come (fences, chatter, letters for answers); answers marked
// (multiple choice exactly, short answers by words, a model only when the words are not clear);
// a course planned from the library and Wikipedia (the fixture is a real answer) in one model
// call, kept small in storage; lessons written once and cached; wrong answers become cards; the
// phone's revisions replayed; the daily "cards to revise" note; the routes, the alarm and the
// tool through the agent with the scripted model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const T = await import('./.build/tutor.mjs');
const M = await import('./.build/learn/sm2.mjs');
const S = await import('./.build/schedule.mjs');
const { Library } = await import('./.build/library/store.mjs');
const { toolByName, selectTools } = await import('./.build/tools/index.mjs');
const brain = await import('./.build/brain.mjs');
const FX = JSON.parse(readFileSync(new URL('./learn.fixture.json', import.meta.url)));

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  alarm = null;
  writes = 0;
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.writes++; if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarm = typeof t === 'number' ? t : t.getTime(); }
  async getAlarm() { return this.alarm; }
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 17, 9, 0);

/** Wikipedia faked from the fixture (Simple English has the article); every call counted. */
function wiki() {
  const calls = [];
  const f = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://simple.wikipedia.org/')) return new Response(JSON.stringify(FX.simple), { headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 429 });
  };
  return { f, calls };
}

/** The tutor's needs, faked: storage + library, a model answering with `reply(system, user)` (an Error to throw), notes collected. */
function deps(reply, opts = {}) {
  const storage = opts.storage ?? new MemStorage();
  const asked = [];
  const notes = [];
  const w = wiki();
  return {
    storage,
    library: opts.library === null ? null : new Library(storage, {}),
    fetch: w.f,
    wikiCalls: w.calls,
    asked,
    notes,
    now: opts.now ?? T0,
    notify: async (item) => void notes.push(item),
    ask: async (system, user) => {
      asked.push({ system, user });
      const r = typeof reply === 'function' ? reply(system, user) : reply;
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

const PLAN = '```json\n{"title":"Photosynthesis from scratch","summary":"How plants make food.","lessons":[{"title":"1. What it is","goal":"You will say what it is.","query":"photosynthesis definition"},{"title":"Light and leaves","goal":"You will know where it happens.","query":"chloroplast chlorophyll"},{"title":"The two phases","goal":"You will tell them apart.","query":"light-dependent reactions"},{"title":"What limits it","goal":"You will name the factors.","query":"limiting factors"},{"title":"light and leaves","goal":"dup","query":"x"},{"title":"Why it matters","goal":"You will see the big picture.","query":"oxygen atmosphere"}]}\n```';
const LESSON = `Plants feed themselves from light [1].\n\nChlorophyll in the chloroplasts catches the light [1], and water is split to give oxygen [2].\n\nWorked example: a pondweed in bright light gives off more bubbles.\n\nRemember:\n- light in, sugar out\n- oxygen is a by-product\n\nCHECK: What does chlorophyll do?\nA) Stores water\nB) Absorbs light energy\nC) Makes soil\nD) Breathes oxygen\nANSWER: B\nWHY: It is the pigment that captures light.`;
const QUIZ = 'Here we go!\n```\n{"questions":[{"type":"mc","q":"Which gas is released?","choices":["Oxygen","Nitrogen","Helium"],"answer":"A","why":"Water is split.","source":1},{"type":"mc","q":"Where does it happen?","choices":["A) Nucleus","B) Chloroplast","C) Root"],"answer":"Chloroplast"},{"type":"short","q":"Name the green pigment.","answer":"chlorophyll","rubric":"chlorophyll"},{"type":"short","q":"What two things does it use to make glucose?","answer":"carbon dioxide and water","rubric":"carbon dioxide; water"},{"q":"bad"},{"type":"mc","q":"Which gas is released?","choices":["x","y"],"answer":0}]}\n```\nGood luck!';

test('SM-2: the first good review → 1 day, the second → 6, then × ease; a lapse comes back in 10 minutes; ease changes by grade and never drops below 1.3', () => {
  let c = M.freshCard(T0);
  assert.deepEqual(c, { ef: 2.5, reps: 0, interval: 0, due: T0, lapses: 0, last: 0 });
  c = M.rate(c, 'good', T0);
  assert.equal(c.interval, 1);
  assert.equal(c.due, T0 + DAY);
  assert.equal(c.ef, 2.5, 'good (4) keeps the ease: 0.1 − 1 × (0.08 + 0.02) = 0');
  c = M.rate(c, 'good', T0 + DAY);
  assert.equal(c.interval, 6);
  c = M.rate(c, 'easy', T0 + 7 * DAY);
  assert.equal(c.interval, 15, '6 × 2.5');
  assert.equal(c.ef, 2.6);
  c = M.rate(c, 'again', T0 + 22 * DAY);
  assert.deepEqual({ reps: c.reps, interval: c.interval, lapses: c.lapses, ef: c.ef }, { reps: 0, interval: 1, lapses: 1, ef: 2.06 });
  assert.equal(c.due, T0 + 22 * DAY + 10 * 60_000, 'seen again in this sitting');
  const hard = M.rate(M.freshCard(T0), 'hard', T0);
  assert.equal(hard.ef, 2.36, 'hard (3): −0.14');
  assert.equal(hard.interval, 1, 'hard still counts as remembered');
  let low = M.freshCard(T0);
  for (let i = 0; i < 10; i++) low = M.sm2(low, 0, T0 + i);
  assert.equal(low.ef, 1.3, 'the floor');
  assert.equal(M.sm2(M.freshCard(T0), 9, T0).ef, 2.6, 'grades are clamped to 0–5');
  assert.equal(M.nextText(M.freshCard(T0), 'again', T0), '10 min');
  assert.equal(M.nextText(M.freshCard(T0), 'good', T0), '1 day');
  assert.equal(M.nextText({ ...M.freshCard(T0), reps: 2, interval: 40 }, 'good', T0), '3 mo');
  assert.ok(M.isDue({ due: T0 }, T0) && !M.isDue({ due: T0 + 1 }, T0));
});

test('the streak: days in a row ending today (or yesterday, still alive), the best kept, two copies merged', () => {
  let s = M.emptyStreak();
  for (const d of ['2026-10-10', '2026-10-14', '2026-10-15', '2026-10-16']) s = M.markDay(s, d);
  assert.deepEqual(M.streakOf(s, '2026-10-16'), { current: 3, best: 3, today: true });
  assert.deepEqual(M.streakOf(s, '2026-10-17'), { current: 3, best: 3, today: false }, 'yesterday still counts until today is over');
  assert.deepEqual(M.streakOf(s, '2026-10-18'), { current: 0, best: 3, today: false });
  assert.equal(M.markDay(s, '2026-10-16').days.length, 4, 'a day counts once');
  assert.equal(M.markDay(s, 'nonsense'), s);
  const merged = M.mergeStreaks(s, { days: ['2026-10-17', '2026-10-13'], best: 5 });
  assert.deepEqual(M.streakOf(merged, '2026-10-17'), { current: 5, best: 5, today: true });
  assert.equal(M.dayKey(Date.UTC(2026, 9, 17, 23, 30), 'Europe/London'), '2026-10-18', 'the owner\'s calendar day, not UTC');
  assert.equal(M.dayKey(Date.UTC(2026, 9, 17, 23, 30), 'Not/AZone'), '2026-10-17');
  let long = M.emptyStreak();
  for (let i = 0; i < 120; i++) long = M.markDay(long, M.dayKey(T0 + i * DAY));
  assert.equal(long.days.length, 120);
  assert.equal(long.best, 120);
  for (let i = 120; i < 450; i++) long = M.markDay(long, M.dayKey(T0 + i * DAY));
  assert.equal(long.days.length, 400, 'the last 400 days kept');
  assert.ok(long.best >= 400);
});

test("the model's replies: course plans, lessons with their check question, quizzes and verdicts read through fences and chatter; bad parts dropped", () => {
  const plan = T.parseCoursePlan(PLAN);
  assert.equal(plan.title, 'Photosynthesis from scratch');
  assert.deepEqual(plan.lessons.map((l) => l.title), ['What it is', 'Light and leaves', 'The two phases', 'What limits it', 'Why it matters'], 'numbering off, the duplicate dropped');
  assert.equal(T.parseCoursePlan('{"lessons":["a","b"]}'), null, 'fewer than three lessons is no plan');
  assert.equal(T.parseCoursePlan('no json here'), null);
  assert.equal(T.parseCoursePlan('[{"title":"One"},{"title":"Two"},{"title":"Three"}]').lessons[2].query, 'Three', 'a bare list works; the title is the query when none is given');
  assert.equal(T.parseCoursePlan(JSON.stringify({ lessons: Array.from({ length: 20 }, (_, i) => ({ title: `Lesson topic ${i}` })) })).lessons.length, 12);

  const l = T.parseLesson(`\`\`\`\n${LESSON}\n\`\`\``);
  assert.match(l.text, /^Plants feed themselves from light \[1\]\./);
  assert.ok(!/CHECK/.test(l.text), 'the check is taken out of the text');
  assert.deepEqual(l.check, { q: 'What does chlorophyll do?', choices: ['Stores water', 'Absorbs light energy', 'Makes soil', 'Breathes oxygen'], answer: 1, why: 'It is the pigment that captures light.' });
  assert.equal(T.parseLesson('**CHECK:** Which?\n**A)** one\n**B)** two\n**ANSWER:** A').check.answer, 0, 'bold markdown is fine');
  assert.equal(T.parseLesson('Text.\nCHECK: Which?\nA) one\nB) two\nANSWER: E').check, undefined, 'an answer that is not a choice drops the question, not the lesson');
  assert.equal(T.parseLesson('Just text.').check, undefined);

  const q = T.parseQuiz(QUIZ);
  assert.deepEqual(q.map((x) => [x.kind, x.answer]), [['mc', 0], ['mc', 1], ['short', 'chlorophyll'], ['short', 'carbon dioxide and water']]);
  assert.deepEqual(q[1].choices, ['Nucleus', 'Chloroplast', 'Root'], 'letters taken off the choices');
  assert.equal(q[0].source, 1);
  assert.deepEqual(q.map((x) => x.id), ['q1', 'q2', 'q3', 'q4']);
  assert.equal(T.parseQuiz(QUIZ, 2).length, 2);
  assert.deepEqual(T.parseQuiz('Sorry, I cannot.'), []);
  assert.deepEqual(T.parseQuiz('{"questions":[{"q":"Pick one please","choices":["a","a"],"answer":0}]}'), [], 'repeated choices');

  assert.deepEqual(T.parseGrade('```json\n{"correct": false, "feedback": "Close, but no."}\n```'), { correct: false, feedback: 'Close, but no.' });
  assert.deepEqual(T.parseGrade('Correct — well done.'), { correct: true, feedback: 'well done.' });
  assert.equal(T.parseGrade('Hmm.'), null);
});

test('marking without a model: multiple choice exactly; short answers by their key words (endings, case and accents forgiven)', () => {
  assert.ok(T.gradeMc({ answer: 2 }, 2) && T.gradeMc({ answer: 2 }, '2'));
  assert.ok(!T.gradeMc({ answer: 2 }, 1) && !T.gradeMc({ answer: 2 }, 'C') && !T.gradeMc({ answer: 2 }, undefined));
  assert.deepEqual(T.gradeWords('chlorophyll', 'chlorophyll', 'Chlorophyll!'), { exact: true, score: 1 });
  assert.equal(T.gradeWords('carbon dioxide and water', 'carbon dioxide; water', 'water and CO2').score, 0.33);
  assert.equal(T.gradeWords('carbon dioxide and water', 'carbon dioxide; water', 'they use water plus carbon dioxide gas').score, 1);
  assert.equal(T.gradeWords('the mitochondria', '', 'mitochondrion').score, 1, 'a near form counts');
  assert.deepEqual(T.gradeWords('42', '', '42.0'), { exact: true, score: 1 });
  assert.deepEqual(T.gradeWords('x', '', ''), { exact: false, score: 0 });
});

test('a course: one cheap model call over the library and Wikipedia (filed in the course notebook); the record is small and listed; the same topic again is the same course', async () => {
  const d = deps(() => PLAN);
  const c = await T.startCourse(d, { topic: 'photosynthesis', level: 'beginner', minutes: 12 });
  assert.equal(d.asked.length, 1, 'one model call');
  assert.match(d.asked[0].system, /^COURSE PLAN: .*complete beginner/);
  assert.match(d.asked[0].user, /Topic: photosynthesis\nLevel: beginner\nMinutes a day: 12/);
  assert.match(d.asked[0].user, /<<external content from your library and Wikipedia/, 'what it read is marked as data');
  assert.match(d.asked[0].user, /Wikipedia: Photosynthesis \(https:\/\/simple\.wikipedia\.org\/wiki\/Photosynthesis\)/);
  assert.ok(!/displaystyle/.test(d.asked[0].user), 'the flattened maths is gone');
  assert.equal(d.wikiCalls.length, 1);
  assert.match(d.wikiCalls[0], /^https:\/\/simple\.wikipedia\.org\/w\/api\.php\?action=query&generator=search&gsrsearch=photosynthesis/, 'Simple English first for a beginner');
  assert.deepEqual(Object.keys(c).sort(), ['basis', 'created', 'id', 'lessons', 'level', 'minutes', 'summary', 'title', 'topic', 'updated']);
  assert.equal(c.title, 'Photosynthesis from scratch');
  assert.equal(c.basis, 'library + Wikipedia');
  assert.equal(c.minutes, 12);
  assert.deepEqual(c.lessons[0], { n: 1, title: 'What it is', goal: 'You will say what it is.', query: 'photosynthesis definition' });
  assert.ok(JSON.stringify(c).length < 3000, 'a plan is small');
  assert.deepEqual((await d.storage.get(T.INDEX_KEY)).map((e) => [e.id, e.lessons, e.done, e.next, e.nextTitle]), [[c.id, 5, 0, 1, 'What it is']]);
  // the article is now in the library, with its address, so the next lesson finds it there
  const hits = await d.library.search('chlorophyll chloroplasts', 3);
  assert.ok(hits.some((h) => h.doc === `learn_${c.id}` && /Source: https:\/\/simple\.wikipedia\.org\/wiki\/Photosynthesis/.test(h.text)));
  const again = await T.startCourse(d, { topic: 'Photosynthesis', level: 'beginner' });
  assert.equal(again.id, c.id);
  assert.equal(d.asked.length, 1, 'no second call for the same course');
  await assert.rejects(T.startCourse(d, { topic: ' ' }), /say what to learn/);
});

test('with no model free, a course still gets an outline (the curriculum, the article\'s sections, or a plain shape)', async () => {
  const d = deps(new Error('every model is cooling'));
  const c = await T.startCourse(d, { topic: 'photosynthesis', level: 'intermediate' });
  assert.match(c.basis, /outline only/);
  assert.ok(c.lessons.length >= 4 && c.lessons.length <= 12);
  const none = T.fallbackOutline('juggling', 'beginner', []);
  assert.deepEqual(none.map((l) => l.title).slice(0, 2), ['What juggling is', 'The key ideas']);
  const fromHeadings = T.fallbackOutline('zzqx', 'advanced', ['History', 'Origin', 'Process', 'Factors', 'Uses']);
  assert.deepEqual(fromHeadings.map((l) => l.title), ['Origin', 'Process', 'Factors', 'Uses']);
});

test('lessons: written once from cited passages and kept (never a second call); a lesson with no model is the passages, not kept; NEXT marks it and the streak', async () => {
  let reply = () => PLAN;
  const d = deps((s, u) => reply(s, u));
  const c = await T.startCourse(d, { topic: 'photosynthesis', level: 'beginner' });
  reply = () => LESSON;
  const r = await T.lesson(d, c.id);
  assert.equal(r.fresh, true);
  assert.equal(r.lesson.n, 1);
  assert.match(d.asked[1].system, /^LESSON: .*lesson 1 of 5 of the course "Photosynthesis from scratch"/);
  assert.match(d.asked[1].system, /like \[2\]/);
  assert.match(d.asked[1].user, /^Lesson 1: What it is\nGoal: You will say what it is\./);
  assert.ok(r.lesson.sources.length >= 1 && r.lesson.sources[0].url, 'sources with their address');
  assert.equal(r.lesson.check.answer, 1);
  assert.equal(r.lesson.done, undefined, 'reading is not finishing');
  const again = await T.lesson(d, c.id, 1);
  assert.equal(again.fresh, false);
  assert.equal(d.asked.length, 2, 'cached in the course record');
  assert.equal((await T.loadCourse(d.storage, c.id)).lessons[0].text, r.lesson.text);
  // no model for lesson 2: the passages themselves, cited, and not kept
  reply = () => new Error('cooling');
  const bare = await T.lesson(d, c.id, 2);
  assert.match(bare.lesson.text, /^No model was free to write this lesson/);
  assert.match(bare.lesson.text, /\[1\] /);
  assert.equal((await T.loadCourse(d.storage, c.id)).lessons[1].text, undefined);
  // NEXT: lesson 1 is done, the list moves on, today counts
  const e = await T.finishLesson(d, c.id, 1);
  assert.deepEqual([e.done, e.next, e.nextTitle], [1, 2, 'Light and leaves']);
  assert.deepEqual((await d.storage.get(T.STREAK_KEY)).days, ['2026-10-17']);
  await assert.rejects(T.lesson(d, c.id, 9), /has 5 lessons/);
  await assert.rejects(T.lesson(d, 'nope'), /no such course/);
});

test('quizzes and answers: one call for the questions; MC marked exactly, short answers by words first and a model only when unclear; wrong answers become cards once; the score and streak count', async () => {
  let reply = () => PLAN;
  const d = deps((s, u) => reply(s, u));
  const c = await T.startCourse(d, { topic: 'photosynthesis', level: 'beginner' });
  reply = () => QUIZ;
  const quiz = await T.makeQuiz(d, { course: c.id, n: 4 });
  assert.equal(d.asked.length, 2);
  assert.match(d.asked[1].system, /^QUIZ: .* 4 questions/);
  assert.equal(quiz.course, c.id);
  assert.equal(quiz.questions.length, 4);
  assert.deepEqual((await T.loadQuiz(d.storage, quiz.id)).id, quiz.id, 'kept to be marked');
  // multiple choice
  let r = await T.answer(d, { quiz: quiz.id, q: 'q1', answer: 0 });
  assert.deepEqual([r.correct, r.how, r.card], [true, 'exact', undefined]);
  r = await T.answer(d, { quiz: quiz.id, q: 'q2', answer: 0 });
  assert.equal(r.correct, false);
  assert.match(r.feedback, /^Not quite: the answer is B\) Chloroplast\./);
  assert.match(r.card.front, /^Where does it happen\?\nA\) Nucleus\nB\) Chloroplast\nC\) Root$/);
  assert.match(r.card.back, /^B\) Chloroplast \(Photosynthesis from scratch\)$/);
  assert.equal(d.asked.length, 2, 'no model for multiple choice');
  // short answers: the words settle it without a model…
  r = await T.answer(d, { quiz: quiz.id, q: 'q3', answer: 'Chlorophyll' });
  assert.deepEqual([r.correct, r.how], [true, 'words']);
  assert.equal(d.asked.length, 2);
  // …and an unclear one goes to a cheap model with the rubric, the answer marked as data
  reply = () => '{"correct": true, "feedback": "Yes: CO2 is carbon dioxide."}';
  r = await T.answer(d, { quiz: quiz.id, q: 'q4', answer: 'water and CO2' });
  assert.deepEqual([r.correct, r.how, r.feedback], [true, 'model', 'Yes: CO2 is carbon dioxide.']);
  assert.match(d.asked[2].system, /^GRADE ANSWER:/);
  assert.match(d.asked[2].user, /Rubric: carbon dioxide; water\n<<external content from the learner's answer/);
  // no model: words decide, and it says so
  reply = () => new Error('cooling');
  r = await T.answer(d, { quiz: quiz.id, q: 'q4', answer: 'sunlight' });
  assert.deepEqual([r.correct, r.how], [false, 'words']);
  assert.match(r.feedback, /^No model was free to read your answer/);
  // a wrong answer twice is one card
  await T.answer(d, { quiz: quiz.id, q: 'q2', answer: 2 });
  const cards = await T.loadCards(d.storage, c.id);
  assert.equal(cards.length, 2);
  assert.deepEqual(Object.keys(cards[0]).sort(), ['added', 'back', 'course', 'due', 'ef', 'front', 'id', 'interval', 'lapses', 'last', 'reps']);
  const e = (await T.loadIndex(d.storage))[0];
  assert.deepEqual([e.asked, e.right], [6, 3]);
  // a lesson's check question is marked the same way
  reply = () => LESSON;
  await T.lesson(d, c.id, 1);
  r = await T.answer(d, { course: c.id, lesson: 1, answer: 1 });
  assert.equal(r.correct, true);
  await assert.rejects(T.answer(d, { quiz: 'gone', q: 'q1', answer: 0 }), /no longer kept/);
  // no model for the questions: the lessons' check questions make the quiz
  reply = () => new Error('cooling');
  const fromChecks = await T.makeQuiz(d, { course: c.id });
  assert.deepEqual(fromChecks.questions.map((q) => q.q), ['What does chlorophyll do?']);
  // a topic with nothing anywhere and no model: said plainly
  const empty = deps(new Error('cooling'), { library: null });
  empty.fetch = async () => new Response('{}');
  await assert.rejects(T.makeQuiz(empty, { topic: 'zzqx' }), /nothing on "zzqx" to quiz you from/);
});

test('cards: the phone\'s revisions replayed with the same SM-2, once each and in order; ≤ 500 a course across two keys; the state the tab mirrors; the daily note only when cards are due', async () => {
  const d = deps(() => PLAN);
  const c = await T.startCourse(d, { topic: 'photosynthesis' });
  const a = await T.addCard(d, c.id, 'Front A', 'Back A');
  const b = await T.addCard(d, c.id, 'Front B', 'Back B');
  assert.equal((await T.addCard(d, c.id, 'front a', 'other')).id, a.id, 'the same front is the same card');
  assert.equal(await T.addCard(d, c.id, 'x', ''), null);
  const reviews = [
    { course: c.id, card: a.id, rating: 'good', at: T0 + 2000 },
    { course: c.id, card: a.id, rating: 'good', at: T0 + 1000 },
    { course: c.id, card: b.id, rating: 'again', at: T0 + 1500 },
    { course: c.id, card: 'missing', rating: 'good', at: T0 },
    { course: c.id, card: a.id, rating: 'meh', at: T0 },
  ];
  assert.deepEqual(await T.applyReviews(d, reviews), { applied: 3 });
  let cards = await T.loadCards(d.storage, c.id);
  const ca = cards.find((x) => x.id === a.id);
  const expect = M.rate(M.rate(M.freshCard(T0), 'good', T0 + 1000), 'good', T0 + 2000);
  assert.deepEqual({ ef: ca.ef, reps: ca.reps, interval: ca.interval, due: ca.due, last: ca.last }, { ef: expect.ef, reps: expect.reps, interval: expect.interval, due: expect.due, last: expect.last });
  assert.deepEqual(await T.applyReviews(d, reviews), { applied: 0 }, 'sent twice, applied once');
  // the state: courses with due counts, every card, the streak
  d.now = T0 + 3 * DAY;
  let st = await T.learnState(d);
  assert.deepEqual(st.courses.map((x) => [x.cards, x.due]), [[2, 1]], 'A is due in 6 days, B tomorrow');
  assert.equal(st.cards.length, 2);
  assert.deepEqual(T.revisionNote(st.courses), '1 card to revise (Photosynthesis from scratch 1) — about 1 min in LEARN → REVISE.');
  assert.equal(T.revisionNote([{ title: 'x', due: 0 }]), null);
  assert.equal(await T.reviseNudge(d), d.notes[0].text);
  assert.deepEqual(d.notes[0], { kind: 'task', title: 'Cards to revise', text: '1 card to revise (Photosynthesis from scratch 1) — about 1 min in LEARN → REVISE.' });
  d.now = T0;
  await T.applyReviews(d, [{ course: c.id, card: b.id, rating: 'good', at: T0 + 5000 }]);
  d.now = T0 + 10 * 60_000;
  assert.equal(await T.reviseNudge(d), 'nothing due');
  assert.equal(d.notes.length, 1, 'quiet when nothing is due');
  // 500 at most, in two keys; the best-known card makes room
  for (let i = 0; i < 510; i++) await T.addCard(d, c.id, `Card ${i}`, 'b');
  cards = await T.loadCards(d.storage, c.id);
  assert.equal(cards.length, 500);
  assert.equal((await d.storage.get(`cards:${c.id}`)).length, 250);
  assert.equal((await d.storage.get(`cards:${c.id}:2`)).length, 250);
  assert.ok(JSON.stringify(await d.storage.get(`cards:${c.id}`)).length < 120_000, 'each stored value stays small');
  assert.ok(!cards.some((x) => x.id === a.id), 'card A (6 days, the longest interval) made room first');
  st = await T.learnState(d);
  assert.equal(st.cards.length, 500);
  // removing a course takes its cards
  assert.equal(await T.removeCourse(d.storage, c.id), true);
  assert.equal((await T.loadCards(d.storage, c.id)).length, 0);
  assert.deepEqual((await T.learnState(d)).courses, []);
});

test('the learn group: keyword-gated, one tool; "teach me", "quiz me", flashcards and revision turn it on, small talk does not', () => {
  const names = (q) => selectTools(q, new Set(), false).map((t) => t.name);
  for (const q of ['teach me photosynthesis', 'quiz me on the french revolution', 'test me', 'my flashcards', 'time to revise', 'explain like I am five', 'start a course on chess']) assert.ok(names(q).includes('tutor'), q);
  for (const q of ['hello', 'what is the weather', 'play some jazz']) assert.ok(!names(q).includes('tutor'), q);
  assert.ok(toolByName.get('tutor').description.length < 700);
});

test('through the agent (scripted model): the tool plans, teaches, quizzes; the routes mark answers and take revisions; the daily job is standing and the alarm sends the note', async () => {
  const storage = new MemStorage();
  const pending = [];
  const env = { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 7).toString('base64') };
  const realFetch = globalThis.fetch;
  globalThis.fetch = wiki().f;
  try {
    // the tool, as the chat would call it
    const events = [];
    const ctx = { storage, env, vault: { get: async () => null }, emit: (e) => events.push(e), progress: () => undefined, kernelUnlocked: async () => false, github: async () => null };
    const tutor = toolByName.get('tutor');
    let out = await tutor.run({ action: 'start', topic: 'photosynthesis' }, ctx);
    assert.match(out, /^Course "Photosynthesis from scratch" \(beginner, 5 lessons of about 10 minutes; from library \+ Wikipedia\) is in the LEARN tab:\n1\. What it is: photosynthesis/);
    const id = events.at(-1).args.course;
    assert.deepEqual(events.at(-1), { t: 'client', name: 'open_learn', args: { course: id } });
    out = await tutor.run({ action: 'lesson' }, ctx);
    assert.match(out, /^Lesson 1 of 5 of "Photosynthesis from scratch"/);
    assert.match(out, /Sources: \[1\] Wikipedia: Photosynthesis https:\/\/simple\.wikipedia\.org\/wiki\/Photosynthesis/);
    assert.match(out, /CHECK \(ask it, wait for their answer\): What gas do leaves give off in sunlight\?\nA\) Nitrogen\nB\) Oxygen/);
    assert.match(out, /\[right answer, do not show before they answer: B/);
    assert.match(out, /4 lessons left\./, 'a lesson given in the chat counts as read');
    out = await tutor.run({ action: 'quiz', spoken: true }, ctx);
    assert.match(out, /^Quiz on "Photosynthesis from scratch", 2 questions\. Ask ONE question at a time/);
    assert.equal(events.at(-1).name, 'open_learn', 'a spoken quiz does not open the tab…');
    assert.equal(events.at(-1).args.quiz, undefined, '…the last thing opened is still the lesson');
    out = await tutor.run({ action: 'courses' }, ctx);
    assert.match(out, /Photosynthesis from scratch \[.+\] — beginner, 1\/5 lessons, next: The key ideas/);
    await assert.rejects(tutor.run({ action: 'dance' }, ctx), /action must be/);

    // the routes
    const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, env);
    const call = async (path, init = {}) => {
      const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789', 'content-type': 'application/json', ...(init.headers ?? {}) } }));
      const text = await r.text();
      await Promise.allSettled(pending.splice(0));
      return { status: r.status, json: () => JSON.parse(text) };
    };
    let r = await call('/learn');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json().courses.map((c) => [c.id, c.done]), [[id, 1]]);
    assert.equal(r.json().tz, 'UTC');
    const job = (await S.loadJobs(storage)).find((j) => j.kind === 'revise');
    assert.ok(job, 'the daily cards job is standing after the first request');
    r = await call('/learn/quiz', { method: 'POST', body: JSON.stringify({ course: id, n: 3 }) });
    const quiz = r.json().quiz;
    assert.deepEqual(quiz.questions.map((q) => q.kind), ['mc', 'mc', 'short']);
    r = await call('/learn/answer', { method: 'POST', body: JSON.stringify({ quiz: quiz.id, q: 'q1', answer: 3 }) });
    assert.equal(r.json().correct, false);
    const card = r.json().card;
    assert.ok(card.id);
    r = await call('/learn/answer', { method: 'POST', body: JSON.stringify({ quiz: quiz.id, q: 'q3', answer: 'the chlorofil, I think' }) });
    assert.deepEqual([r.json().correct, r.json().how], [true, 'model'], 'a misspelling goes to the (scripted) grader');
    r = await call('/learn/review', { method: 'POST', body: JSON.stringify({ reviews: [{ course: id, card: card.id, rating: 'good', at: Date.now() }] }) });
    assert.deepEqual(r.json(), { applied: 1 });
    r = await call(`/learn/course/${id}`);
    assert.equal(r.json().course.lessons[0].done > 0, true);
    r = await call('/learn/lesson', { method: 'POST', body: JSON.stringify({ course: id, n: 2 }) });
    assert.match(r.json().lesson.text, /The key ideas: photosynthesis is explained here/);
    r = await call('/learn/done', { method: 'POST', body: JSON.stringify({ course: id, n: 2 }) });
    assert.equal(r.json().course.next, 3);
    r = await call('/learn/card', { method: 'POST', body: JSON.stringify({ course: id, front: 'Mine', back: 'Yes' }) });
    assert.equal(r.json().card.front, 'Mine');
    assert.equal((await call('/learn/answer', { method: 'POST', body: JSON.stringify({ quiz: 'nope', q: 'q1', answer: 0 }) })).status, 400);
    assert.equal((await call(`/learn/quiz/${quiz.id}`)).json().quiz.id, quiz.id);
    assert.equal((await call('/learn/nothing', { method: 'POST', body: '{}' })).status, 404);

    // the alarm: a card is due → the inbox note
    const jobs = await S.loadJobs(storage);
    jobs.find((j) => j.kind === 'revise').next = Date.now() - 1000;
    await storage.put('jobs', jobs);
    await agent.alarm();
    await Promise.allSettled(pending.splice(0));
    const after = (await S.loadJobs(storage)).find((j) => j.kind === 'revise');
    assert.match(after.lastResult, /^1 card to revise/, 'the new card ("Mine") is due now');
    assert.ok(after.next > Date.now(), 'tomorrow');
    const inbox = await S.loadInbox(storage);
    assert.deepEqual([inbox.at(-1).title, inbox.at(-1).kind], ['Cards to revise', 'task']);
    // DELETE the course
    assert.equal((await call(`/learn/course/${id}`, { method: 'DELETE' })).json().removed, true);
    assert.equal((await call(`/learn/course/${id}`)).status, 404);
  } finally {
    globalThis.fetch = realFetch;
  }
});
