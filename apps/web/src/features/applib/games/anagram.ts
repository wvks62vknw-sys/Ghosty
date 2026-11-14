/**
 * The ANAGRAM board. Options (GameConfig.options): words (string[]), secs (30 to 300, default 90).
 * Tap the letters in order to spell the word (tap a placed letter to take it back). SKIP costs 5 points.
 */
import { h, clear } from '../../../core/dom';
import * as A from '../../../../../../packages/shared/src/applib/games/anagram';
import { WORDS5 } from '../../../../../../packages/shared/src/applib/games/wordguess';
import { list, num, pick, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const anagram: Board = (p) => {
  const pool = list(p.opts, 'words').map((w) => w.toLowerCase()).filter((w) => /^[a-z]{3,10}$/.test(w));
  const words = pool.length >= 3 ? pool : WORDS5;
  const secs = num(p.opts, 'secs', 90, 30, 300);
  const r = rng(p.seed());
  let score = 0;
  let solved = 0;
  let word = '';
  let tiles: string[] = [];
  let used: number[] = [];
  const answer = h('div.al-ganswer');
  const rack = h('div.al-grack');
  p.stage.append(answer, rack);
  p.keys([
    { word: 'Skip', run: () => (p.paused() ? 0 : ((score = Math.max(0, score - A.SKIP_COST)), p.notice(`It was ${word.toUpperCase()}.`), next())), label: 'Skip this word' },
    { word: 'Shuffle', run: () => ((tiles = [...A.scramble(tiles.join(''), r)]), (used = []), draw()), label: 'Shuffle the letters' },
  ]);
  function next(): void {
    word = pick(r, words);
    tiles = [...A.scramble(word, r)];
    used = [];
    draw();
  }
  function draw(): void {
    clear(answer, ...used.map((t, k) => {
      const b = h('button.al-gltile', { type: 'button', 'aria-label': `Take back ${tiles[t]}` }, tiles[t]!.toUpperCase());
      b.addEventListener('click', () => ((used = used.slice(0, k)), draw()));
      return b;
    }), ...Array.from({ length: word.length - used.length }, () => h('span.al-gltile.al-glslot')));
    clear(rack, ...tiles.map((ch, t) => {
      const b = h('button.al-gltile', { type: 'button', disabled: used.includes(t), 'aria-label': ch }, ch.toUpperCase());
      b.addEventListener('click', () => {
        if (p.paused() || used.includes(t)) return;
        used.push(t);
        draw();
        if (used.length === word.length) {
          const guess = used.map((i) => tiles[i]).join('');
          if (A.accepts(guess, word, words)) {
            score += A.points(word);
            solved++;
            p.notice(`${guess.toUpperCase()}. Well found.`, 'ok');
            next();
          } else {
            p.notice('Not that one. Tap a letter to take it back.', 'warn');
          }
        }
      });
      return b;
    }));
    tick();
  }
  const tick = () => {
    const left = Math.max(0, Math.ceil(secs - p.secs()));
    p.score(score, `${solved} solved · ${left} s left`);
    if (left <= 0) p.end({ won: solved > 0, score, words: `${solved} words in ${secs} seconds.` });
  };
  const t = setInterval(() => !p.paused() && tick(), 250);
  next();
  return () => clearInterval(t);
};
