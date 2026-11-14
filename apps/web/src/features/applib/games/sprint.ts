/**
 * The SPRINT board. Options (GameConfig.options): secs (30 to 180, default 60), ops (any of + - × ÷, default '+-×÷'),
 * max (10 to 100, default 20). Type each answer on the number pad; a right answer moves on at once.
 */
import { h, clear } from '../../../core/dom';
import * as S from '../../../../../../packages/shared/src/applib/games/sprint';
import { num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const sprint: Board = (p) => {
  const secs = num(p.opts, 'secs', 60, 30, 180);
  const ops = typeof p.opts.ops === 'string' ? p.opts.ops.replace(/\*/g, '×').replace(/\//g, '÷') : '+-×÷';
  const max = num(p.opts, 'max', 20, 10, 100);
  const r = rng(p.seed());
  let q = S.sum(r, ops, max);
  let typed = '';
  let score = 0;
  let right = 0;
  let streak = 0;
  const sumEl = h('div.al-gsum');
  const pad = h('div.al-gpad.al-gnumpad');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']) {
    const b = h('button.al-gpadkey', { type: 'button', 'aria-label': k === 'C' ? 'Clear' : k === '⌫' ? 'Delete' : k }, k);
    b.addEventListener('click', () => press(k));
    pad.append(b);
  }
  p.stage.append(sumEl, pad);
  function press(k: string): void {
    if (p.paused()) return;
    if (k === 'C') typed = '';
    else if (k === '⌫') typed = typed.slice(0, -1);
    else if (typed.length < 4) typed += k;
    if (typed && Number(typed) === q.answer) {
      streak++;
      right++;
      score += S.points(streak);
      q = S.sum(r, ops, max);
      typed = '';
    } else if (typed.length >= String(q.answer).length && Number(typed) !== q.answer) {
      streak = 0;
      sumEl.classList.add('al-gshake');
      setTimeout(() => sumEl.classList.remove('al-gshake'), 350);
    }
    draw();
  }
  function draw(): void {
    clear(sumEl, h('b', q.text), h('span.al-gsumans', typed || '?'));
    tick();
  }
  function tick(): void {
    const left = Math.max(0, Math.ceil(secs - p.secs()));
    p.score(score, `${right} right · ${left} s left`);
    if (left <= 0) p.end({ won: right > 0, score, words: `${right} right in ${secs} seconds.` });
  }
  const keyd = (e: KeyboardEvent) => {
    if (!sumEl.isConnected) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('⌫');
  };
  window.addEventListener('keydown', keyd);
  const t = setInterval(() => !p.paused() && tick(), 250);
  draw();
  return () => {
    clearInterval(t);
    window.removeEventListener('keydown', keyd);
  };
};
