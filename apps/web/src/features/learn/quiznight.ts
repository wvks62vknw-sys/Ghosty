/**
 * QUIZ NIGHT (learn.s10): Ghosty hosts a quiz at the table from his own courses, for him and the friends sitting with him.
 *  - The questions come from his courses' own question pools and lesson checks, kept on this phone: it works with no signal.
 *  - Up to six players, by the names he types (kept only while the quiz runs; nobody is looked up or kept).
 *  - Each question is shown big and read aloud; whoever answers first, he taps their name if they were right, or NOBODY; the
 *    right answer is shown either way; the scoreboard keeps count; after the last question, the winner (or a draw) is said.
 * State for specs at window.__ghosty.quiznight.
 */
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { settings } from '../../state/app';
import { button, modal } from '../../ui/components';
import { poolOf, type QuizQuestion } from '../../../../../packages/shared/src/learn';
import { learn } from './store';

export const quizNight = { on: false, players: [] as string[], scores: [] as number[], i: 0, of: 0, q: '', shown: false, winner: '', line: '' };

const LETTERS = 'ABCDEF';
/** Questions a quiz night has (fewer when his courses hold fewer). */
export const NIGHT_QUESTIONS = 10;

/** Every question his courses hold (lesson checks and pools), multiple choice only, no repeats, shuffled by `seed`. */
export function nightQuestions(courses: { lessons: { n: number; check?: unknown; pool?: QuizQuestion[] }[] }[], seed: number, n = NIGHT_QUESTIONS): QuizQuestion[] {
  const seen = new Set<string>();
  const all: QuizQuestion[] = [];
  for (const c of courses) for (const l of c.lessons) for (const q of poolOf(l as Parameters<typeof poolOf>[0])) {
    const k = q.q.trim().toLowerCase();
    if (q.kind !== 'mc' || !q.choices?.length || !k || seen.has(k)) continue;
    seen.add(k);
    all.push(q);
  }
  let a = seed >>> 0 || 1;
  const rnd = () => ((a = (Math.imul(a ^ (a >>> 15), 2246822519) + 0x9e3779b9) >>> 0), a / 4294967296);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, n);
}

/** The end in one line: "Sam wins with 6 points." or "A draw: Sam and Jo, 4 points each." */
export function winnerLine(players: string[], scores: number[]): string {
  const top = Math.max(0, ...scores);
  const who = players.filter((_, i) => scores[i] === top);
  if (!top) return 'Nobody scored this time. Another round?';
  return who.length === 1 ? `${who[0]} wins with ${top} point${top === 1 ? '' : 's'}.` : `A draw: ${who.slice(0, -1).join(', ')} and ${who.at(-1)}, ${top} point${top === 1 ? '' : 's'} each.`;
}

/** Open quiz night over the screen. */
export function openQuizNight(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.quiznight = quizNight;
  const body = h('div.qnight');
  const aloud = (t: string) => settings.get().speak !== false && void speak(t, { here: true }).catch(() => undefined);
  const m = modal('QUIZ NIGHT', body, () => {
    stopSpeaking();
    Object.assign(quizNight, { on: false });
  });
  Object.assign(quizNight, { on: true, players: [], scores: [], i: 0, of: 0, q: '', shown: false, winner: '', line: '' });

  // 1 · who is playing
  const setup = () => {
    const inputs = Array.from({ length: 6 }, (_, i) => h('input', { type: 'text', placeholder: i < 2 ? `Player ${i + 1}` : `Player ${i + 1} (if playing)`, 'aria-label': `Player ${i + 1}'s name`, autocomplete: 'off', maxlength: '20' }) as HTMLInputElement);
    const say = h('p.note', { role: 'status' });
    const go = button('START THE QUIZ', () => {
      const names = inputs.map((x, i) => x.value.trim() || (i < 2 ? `Player ${i + 1}` : '')).filter(Boolean);
      const qs = nightQuestions(Object.values(learn.get().full), Date.now());
      if (!qs.length) return void (say.textContent = 'Your courses hold no quiz questions yet: take a quiz or two in a course first, and they become tonight’s questions.');
      Object.assign(quizNight, { players: names, scores: names.map(() => 0), i: 0, of: qs.length });
      ask(qs, 0);
    }, 'on');
    clear(body, h('p.note', 'I host, from your own courses’ questions. Type who is playing (two to six), then I read each question; tap whoever got it right first.'), h('div.qnplayers', ...inputs), say, h('div.keyrow', go));
  };

  // 2 · one question: read aloud; the host taps who was right first (or NOBODY); the answer is shown
  const ask = (qs: QuizQuestion[], i: number) => {
    const q = qs[i]!;
    Object.assign(quizNight, { i: i + 1, q: q.q, shown: false });
    const right = Number(q.answer);
    const choices = (q.choices ?? []).map((c, k) => h('li', h('b', `${LETTERS[k]}) `), c));
    const reveal = h('p.qnreveal', { hidden: true, role: 'status' });
    const who = h('div.keyrow.qnwho');
    const next = button(i + 1 < qs.length ? 'NEXT QUESTION' : 'THE RESULT', () => (i + 1 < qs.length ? ask(qs, i + 1) : end()), 'on');
    next.hidden = true;
    const mark = (p: number | null) => {
      if (quizNight.shown) return;
      if (p !== null) quizNight.scores[p] = (quizNight.scores[p] ?? 0) + 1;
      quizNight.shown = true;
      const line = `${p === null ? 'Nobody this time.' : `A point to ${quizNight.players[p]}.`} The answer: ${LETTERS[right]}) ${q.choices?.[right] ?? ''}.${q.why ? ` ${q.why}` : ''}`;
      reveal.textContent = line;
      reveal.hidden = false;
      quizNight.line = line;
      for (const b of who.querySelectorAll('button')) (b as HTMLButtonElement).disabled = true;
      next.hidden = false;
      paintBoard();
      aloud(line);
    };
    clear(who, ...quizNight.players.map((p, k) => button(p.toUpperCase(), () => mark(k))), button('NOBODY', () => mark(null)));
    for (const b of who.querySelectorAll('button')) (b as HTMLButtonElement).dataset.case = 'keep';
    clear(body, board, h('p.qnhead', `Question ${i + 1} of ${qs.length}`), h('p.qnq', q.q), h('ol.qnchoices', ...choices), h('small.note', 'Whoever answers first: tap their name if they were right.'), who, reveal, h('div.keyrow', next));
    paintBoard();
    aloud(`Question ${i + 1}. ${q.q} ${(q.choices ?? []).map((c, k) => `${LETTERS[k]}: ${c}.`).join(' ')}`);
  };

  // the scoreboard, at the top of every question
  const board = h('div.qnboard', { role: 'list', 'aria-label': 'The scores' });
  const paintBoard = () => clear(board, ...quizNight.players.map((p, k) => h('span.qnscore', { role: 'listitem', dataset: { case: 'keep' } }, h('b', String(quizNight.scores[k] ?? 0)), h('small', p))));

  // 3 · the end
  const end = () => {
    const line = winnerLine(quizNight.players, quizNight.scores);
    quizNight.winner = line;
    paintBoard();
    clear(body, board, h('p.qnq', line), h('div.keyrow', button('PLAY AGAIN', () => setup(), 'on'), button('DONE', () => m.close())));
    aloud(line);
  };
  setup();
}
