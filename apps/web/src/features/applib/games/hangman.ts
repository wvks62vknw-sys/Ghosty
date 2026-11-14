/**
 * The HANGMAN board (drawn as a lamp that dims with each miss). Options (GameConfig.options): words (string[]),
 * misses (4 to 10, default 7). Tap letters (or type them).
 */
import { h, clear } from '../../../core/dom';
import * as H from '../../../../../../packages/shared/src/applib/games/hangman';
import { list, num } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';
import { letterPad } from './letters';

export const hangman: Board = (p) => {
  const g: H.Hangman = (p.resume as H.Hangman | null) ?? H.start(list(p.opts, 'words'), num(p.opts, 'misses', 7, 4, 10), p.seed());
  const lamp = h('div.al-glamp', h('i'));
  const word = h('div.al-gword');
  const pad = letterPad((ch) => {
    if (p.paused()) return;
    const res = H.guess(g, ch);
    if (!res) return;
    pad.mark(ch, res === 'hit' ? 'hit' : 'miss');
    draw();
    const st = H.state(g);
    if (st === 'won') return p.end({ won: true, score: H.score(g), words: `Found with ${g.misses} misses.` });
    if (st === 'lost') return p.end({ won: false, score: 0, words: `The word was ${g.word.toUpperCase()}.` });
    p.keep(g);
  });
  for (const ch of g.guessed) pad.mark(ch, g.word.includes(ch) ? 'hit' : 'miss');
  p.stage.append(lamp, word, pad.el);
  function draw(): void {
    lamp.style.setProperty('--al-lit', String(1 - g.misses / g.max));
    clear(word, ...[...H.shown(g)].map((c) => h(c === ' ' ? 'span.al-gwordgap' : 'span.al-gwordch', c === '_' ? '' : c.toUpperCase())));
    p.score(H.score(g), `${g.max - g.misses} misses left`);
  }
  draw();
  return pad.stop;
};
