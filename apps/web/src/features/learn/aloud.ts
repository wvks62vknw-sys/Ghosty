/**
 * QUIZ ME ALOUD, HANDS-FREE (learn.c6: "quiz me while I drive"): every question and its choices are said aloud; he answers by
 * voice ("B", "the second one", or the answer's words); I say whether it was right and the answer, then the next, with
 * nothing to look at. One tap starts it, one big STOP ends it. The questions are his own courses' (kept on the phone), so it
 * runs with no signal wherever the phone can still hear him. Five seconds of silence is a pass, said so, and on to the next.
 * Hearing uses the phone's own listening (further/interpret.ts hear); nothing he says is kept.
 */
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { canHear, hear } from '../../further/interpret';
import type { QuizQuestion } from '../../../../../packages/shared/src/learn';
import { nightQuestions } from './quiznight';
import { learn } from './store';
import { choiceOf, LISTEN_MS } from './aloudwords';

export const aloudState = { on: false, i: 0, of: 0, right: 0, heard: '', said: '', done: false };
const LETTERS = 'ABCDEF';
/** Open it over the screen and start: a big STOP, the question in large type for anyone beside him, nothing to press. */
export function openAloud(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.aloud = aloudState;
  const body = h('div.qaloud');
  let stopped = false;
  const m = modal('QUIZ ME ALOUD', body, () => {
    stopped = true;
    stopSpeaking();
    aloudState.on = false;
  });
  const qs = nightQuestions(Object.values(learn.get().full), Date.now(), 8);
  Object.assign(aloudState, { on: true, i: 0, of: qs.length, right: 0, heard: '', said: '', done: false });
  const stop = button('STOP', () => m.close(), 'warn');
  stop.classList.add('qastop');
  const line = h('p.qaline', { role: 'status', 'aria-live': 'polite' });
  const say = async (t: string) => {
    aloudState.said = t;
    line.textContent = t;
    if (!stopped) await speak(t, { here: true }).catch(() => undefined);
  };
  if (!canHear()) return void clear(body, h('p.qaline', 'This browser can’t listen, so a hands-free quiz can’t run here. QUIZ NIGHT or QUIZ ME work by tapping.'), h('div.keyrow', button('CLOSE', () => m.close())));
  if (!qs.length) return void clear(body, h('p.qaline', 'Your courses hold no quiz questions yet: take a quiz or two in a course first, and I can ask them aloud.'), h('div.keyrow', button('CLOSE', () => m.close())));
  clear(body, line, h('div.keyrow', stop));
  const listen = (): Promise<string> =>
    new Promise((resolve) => {
      const ear = hear('en-GB', (t) => (aloudState.heard = t));
      setTimeout(() => void ear.stop().then(resolve, () => resolve('')), LISTEN_MS);
    });
  void (async () => {
    await say(`Hands-free quiz: ${qs.length} questions from your courses. Say the letter, or the answer.`);
    for (const [i, q] of qs.entries()) {
      if (stopped) return;
      aloudState.i = i + 1;
      const choices = q.choices ?? [];
      await say(`Question ${i + 1}. ${q.q} ${choices.map((c, k) => `${LETTERS[k]}: ${c}.`).join(' ')}`);
      if (stopped) return;
      const heard = await listen();
      aloudState.heard = heard;
      const pick = choiceOf(heard, choices);
      const right = Number((q as QuizQuestion).answer);
      const answer = `${LETTERS[right]}, ${choices[right] ?? ''}`;
      if (pick === right) aloudState.right++;
      await say(pick < 0 ? `I didn't catch an answer. It was ${answer}.` : pick === right ? `Right: ${answer}.` : `Not quite: it was ${answer}.`);
    }
    if (stopped) return;
    aloudState.done = true;
    await say(`That's the quiz: ${aloudState.right} of ${qs.length}.`);
    clear(body, line, h('div.keyrow', button('AGAIN', () => (m.close(), openAloud()), 'on'), button('DONE', () => m.close())));
  })();
}
