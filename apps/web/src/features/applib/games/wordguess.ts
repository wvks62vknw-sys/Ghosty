/**
 * The WORDGUESS board. Options (GameConfig.options): words (string[] of one length), tries (3 to 8, default 6),
 * daily (default true), strict (guesses must be in the list, default false).
 * Type on the on-screen keyboard (or a real one); each row is marked hit, near or miss, and the keys keep their best mark.
 */
import { h, clear } from '../../../core/dom';
import * as W from '../../../../../../packages/shared/src/applib/games/wordguess';
import { bool, list, num } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export const wordguess: Board = (p) => {
  const words = W.wordsFrom(list(p.opts, 'words'));
  const tries = num(p.opts, 'tries', 6, 3, 8);
  const strict = bool(p.opts, 'strict', false);
  const len = words[0]!.length;
  const saved = p.resume as { answer: string; guesses: string[]; typing: string } | null;
  const answer = saved?.answer ?? W.answerFor(words, p.seed(bool(p.opts, 'daily', true)));
  const guesses = saved?.guesses ?? [];
  let typing = saved?.typing ?? '';
  let done = false;
  const rows = h('div.al-gwrows', { style: `--al-len: ${len}` });
  const kb = h('div.al-gkb');
  p.stage.append(rows, kb);
  const keyEls: Record<string, HTMLElement> = {};
  ROWS.forEach((r, ri) => {
    const row = h('div.al-gkbrow');
    if (ri === 2) row.append(kbKey('Enter', 'enter', 'al-gkbwide'));
    for (const ch of r) row.append((keyEls[ch] = kbKey(ch.toUpperCase(), ch)));
    if (ri === 2) row.append(kbKey('⌫', 'back', 'al-gkbwide'));
    kb.append(row);
  });
  function kbKey(word: string, v: string, cls = ''): HTMLElement {
    const b = h(`div.al-gkbkey${cls ? `.${cls}` : ''}` as 'div', { role: 'button', tabIndex: 0, 'aria-label': v === 'back' ? 'Delete' : v === 'enter' ? 'Enter' : word }, word);
    b.addEventListener('click', () => press(v));
    return b;
  }
  function press(v: string): void {
    if (done || p.paused()) return;
    if (v === 'back') typing = typing.slice(0, -1);
    else if (v === 'enter') return submit();
    else if (/^[a-z]$/.test(v) && typing.length < len) typing += v;
    draw();
    p.keep({ answer, guesses, typing });
  }
  function submit(): void {
    const why = W.allowed(typing, words, strict);
    if (why) {
      rows.querySelector('.al-gwnow')?.classList.add('al-gshake');
      setTimeout(() => rows.querySelector('.al-gshake')?.classList.remove('al-gshake'), 400);
      return p.notice(why === 'short' ? `Words here have ${len} letters.` : why === 'unknown' ? 'That word is not in the list.' : 'Letters only.', 'warn');
    }
    guesses.push(typing);
    typing = '';
    draw();
    if (guesses[guesses.length - 1] === answer) {
      done = true;
      return p.end({ won: true, score: W.score(guesses.length, tries), words: `Found in ${guesses.length} of ${tries}.` });
    }
    if (guesses.length >= tries) {
      done = true;
      return p.end({ won: false, score: 0, words: `The word was ${answer.toUpperCase()}.` });
    }
    p.keep({ answer, guesses, typing });
  }
  function draw(): void {
    clear(rows);
    for (let r = 0; r < tries; r++) {
      const g = guesses[r];
      const now = r === guesses.length;
      const marks = g ? W.marks(g, answer) : [];
      const row = h(`div.al-gwrow${now ? '.al-gwnow' : ''}` as 'div');
      for (let c = 0; c < len; c++) {
        const ch = g ? g[c]! : now ? (typing[c] ?? '') : '';
        const cell = h('div.al-gwcell', ch.toUpperCase());
        if (g) cell.dataset.m = marks[c]!;
        else if (ch) cell.classList.add('al-gwfull');
        row.append(cell);
      }
      rows.append(row);
    }
    const km = W.keyMarks(guesses, answer);
    for (const [ch, el] of Object.entries(keyEls)) {
      if (km[ch]) el.dataset.m = km[ch]!;
      else delete el.dataset.m;
    }
    p.score(0, `Try ${Math.min(guesses.length + 1, tries)} of ${tries}`);
  }
  const keyd = (e: KeyboardEvent) => {
    if (!rows.isConnected || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') press('enter');
    else if (e.key === 'Backspace') press('back');
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  };
  window.addEventListener('keydown', keyd);
  draw();
  return () => window.removeEventListener('keydown', keyd);
};
