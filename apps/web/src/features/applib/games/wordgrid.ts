/**
 * The WORDGRID board. Options (GameConfig.options): words (string[]), size (8 to 14, default 10), count (4 to 12,
 * default 8), diagonal (default true). Drag along a word, or tap its first then its last letter.
 */
import { h } from '../../../core/dom';
import * as W from '../../../../../../packages/shared/src/applib/games/wordgrid';
import { bool, list, num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime, grid } from './frame';

export const wordgrid: Board = (p) => {
  const saved = p.resume as { g: W.WordGrid; found: string[] } | null;
  const g = saved?.g ?? W.build(list(p.opts, 'words'), num(p.opts, 'size', 10, 8, 14), num(p.opts, 'count', 8, 4, 12), bool(p.opts, 'diagonal', true), p.seed());
  const found = new Set(saved?.found ?? []);
  const els: HTMLElement[] = [];
  const board = grid(g.size, 'al-gwgrid', g.letters.length, (i) => {
    const el = h('div.al-gcell', { role: 'gridcell', dataset: { i: String(i) } }, g.letters[i]!.toUpperCase());
    els.push(el);
    return el;
  });
  const wordsEl = h('div.al-gwlist');
  p.stage.append(board, wordsEl);
  board.style.touchAction = 'none';
  let a = -1;
  let trail: number[] = [];
  let tapFirst = -1;
  const at = (e: PointerEvent) => Number((document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.dataset.i ?? -1);
  board.addEventListener('pointerdown', (e) => {
    if (p.paused()) return;
    a = at(e);
    trail = a >= 0 ? [a] : [];
    draw();
  });
  board.addEventListener('pointermove', (e) => {
    if (a < 0) return;
    const b = at(e);
    if (b >= 0) {
      const l = W.line(g.size, a, b);
      if (l.length) trail = l;
      draw();
    }
  });
  const up = () => {
    if (a < 0) return;
    if (trail.length === 1) {
      if (tapFirst >= 0 && tapFirst !== trail[0]) {
        const l = W.line(g.size, tapFirst, trail[0]!);
        tapFirst = -1;
        if (l.length) trail = l;
      } else tapFirst = trail[0]!;
    } else tapFirst = -1;
    if (trail.length > 1) {
      const w = W.found(g, trail);
      if (w && !found.has(w)) {
        found.add(w);
        p.notice(`${w.toUpperCase()} found.`, 'ok');
        p.keep({ g, found: [...found] });
        if (found.size === g.words.length) {
          const secs = p.secs();
          p.end({ won: true, score: W.score(found.size, secs), words: `All ${found.size} words in ${fmtTime(secs)}.` });
        }
      }
      trail = [];
    }
    a = -1;
    draw();
  };
  window.addEventListener('pointerup', up);
  function draw(): void {
    const foundCells = new Set(g.words.filter((w) => found.has(w.word)).flatMap((w) => w.cells));
    els.forEach((el, i) => {
      el.classList.toggle('al-gfound', foundCells.has(i));
      el.classList.toggle('al-gsel', trail.includes(i) || i === tapFirst);
    });
    wordsEl.replaceChildren(...g.words.map((w) => h(`span${found.has(w.word) ? '.al-gdone' : ''}` as 'span', w.word.toUpperCase())));
    p.score(found.size * 100, `${found.size} of ${g.words.length} found`);
  }
  draw();
  p.keep({ g, found: [...found] });
  return () => window.removeEventListener('pointerup', up);
};
