/**
 * The QUIZ board. Options (GameConfig.options): questions (string[], each "Question | right | wrong | wrong | wrong"),
 * count (3 to 20, default 10), secs (seconds a question, 0 for no clock, default 15).
 * Tap an answer; the right one is shown either way, then the next question comes.
 */
import { h, clear } from '../../../core/dom';
import * as Q from '../../../../../../packages/shared/src/applib/games/quiz';
import { list, num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const quiz: Board = (p) => {
  const secs = num(p.opts, 'secs', 15, 0, 120);
  const qs = Q.round(list(p.opts, 'questions'), num(p.opts, 'count', 10, 3, 20), rng(p.seed()));
  let at = 0;
  let score = 0;
  let right = 0;
  let askedAt = 0;
  let locked = false;
  let next = 0;
  const card = h('div.al-gquiz');
  p.stage.append(card);
  function ask(): void {
    locked = false;
    askedAt = p.secs();
    const q = qs[at]!;
    clear(card, h('small.al-gquizn', `Question ${at + 1} of ${qs.length}`), h('p.al-gquizq', q.q), ...q.choices.map((c) => {
      const b = h('button.al-gchoice', { type: 'button' }, c);
      b.addEventListener('click', () => answer(c, b));
      return b;
    }));
    tick();
  }
  function answer(c: string, b: HTMLElement | null): void {
    if (locked || p.paused()) return;
    locked = true;
    const q = qs[at]!;
    const ok = c === q.right;
    const left = secs ? secs - (p.secs() - askedAt) : 0;
    score += Q.points(ok, left);
    if (ok) right++;
    card.querySelectorAll<HTMLElement>('.al-gchoice').forEach((x) => {
      if (x.textContent === q.right) x.dataset.m = 'hit';
      else if (x === b) x.dataset.m = 'miss';
    });
    p.score(score, `${right} right of ${at + 1}`);
    next = window.setTimeout(() => {
      at++;
      if (at >= qs.length) p.end({ won: right > qs.length / 2, score, words: `${right} of ${qs.length} right.` });
      else ask();
    }, 1100);
  }
  function tick(): void {
    if (!secs || locked) return p.score(score, `${right} right of ${at}`);
    const left = Math.max(0, Math.ceil(secs - (p.secs() - askedAt)));
    p.score(score, `${left} s · ${right} right of ${at}`);
    if (left <= 0) answer('', null);
  }
  const t = setInterval(() => !p.paused() && tick(), 250);
  ask();
  return () => {
    clearInterval(t);
    clearTimeout(next);
  };
};
