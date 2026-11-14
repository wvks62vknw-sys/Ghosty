/**
 * The TYPING board. Options (GameConfig.options): passages (string[]), secs (15 to 300, default 60).
 * Type the passage with the phone's keyboard; right letters go bright, wrong ones amber. Words a minute and accuracy
 * are counted the standard way (five characters a word).
 */
import { h, clear } from '../../../core/dom';
import * as T from '../../../../../../packages/shared/src/applib/games/typing';
import { list, num } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const typing: Board = (p) => {
  const secs = num(p.opts, 'secs', 60, 15, 300);
  const pool = list(p.opts, 'passages');
  let target = T.passage(pool, p.seed());
  let done = '';
  let started = false;
  const text = h('p.al-gtype');
  const input = h('textarea.al-gtypein', { rows: 2, autocapitalize: 'off', autocomplete: 'off', spellcheck: false, 'aria-label': 'Type the passage here', placeholder: 'Start typing to begin' }) as HTMLTextAreaElement;
  p.stage.append(text, input);
  input.addEventListener('input', () => {
    if (p.paused()) return;
    if (!started) {
      started = true;
      startAt = p.secs();
    }
    const v = input.value;
    if (v.length >= target.length) {
      done += v.slice(0, target.length) + ' ';
      target = T.passage(pool, Math.floor(Math.random() * 1e9));
      input.value = '';
    }
    draw();
  });
  let startAt = 0;
  const all = () => ({ tgt: done + target, typed: done + input.value });
  function draw(): void {
    const v = input.value;
    clear(text, ...[...target].map((ch, i) => h(`span${i < v.length ? (v[i] === ch ? '.al-gtok' : '.al-gtbad') : i === v.length ? '.al-gtnow' : ''}` as 'span', ch)));
    tick();
  }
  function tick(): void {
    const used = started ? p.secs() - startAt : 0;
    const left = Math.max(0, Math.ceil(secs - used));
    const { tgt, typed } = all();
    const res = T.result(tgt, typed, Math.max(1, used));
    p.score(res.wpm, `${res.accuracy}% right · ${left} s left`);
    if (started && left <= 0) {
      input.disabled = true;
      p.end({ won: res.correct > 0, score: res.wpm, words: `${res.wpm} words a minute at ${res.accuracy}% right.` });
    }
  }
  const t = setInterval(() => !p.paused() && started && tick(), 250);
  draw();
  return () => clearInterval(t);
};
