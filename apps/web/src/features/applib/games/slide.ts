/**
 * The SLIDE board. Options (GameConfig.options): size (3 to 6, default 4).
 * Tap a tile in the gap's row or column (or swipe toward the gap) to slide it. Every shuffle can be solved.
 */
import { h, clear } from '../../../core/dom';
import * as S from '../../../../../../packages/shared/src/applib/games/slide';
import { num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime, grid, swipe } from './frame';

export const slide: Board = (p) => {
  const size = num(p.opts, 'size', 4, 3, 6);
  const saved = p.resume as { b: S.SlideBoard; moves: number } | null;
  const b = saved?.b ?? S.shuffled(size, p.seed());
  let moves = saved?.moves ?? 0;
  const els: HTMLElement[] = [];
  const board = grid(b.size, 'al-gslide', b.cells.length, (i) => {
    const el = h('div.al-gtile', { role: 'gridcell', tabIndex: 0 });
    el.addEventListener('click', () => tap(i));
    els.push(el);
    return el;
  });
  p.stage.append(board);
  const unswipe = swipe(board, (d) => {
    const g = b.cells.indexOf(0);
    const n = b.size;
    const from = { up: g + n, down: g - n, left: g + 1, right: g - 1 }[d];
    const ok = d === 'up' || d === 'down' ? from >= 0 && from < n * n : Math.floor(from / n) === Math.floor(g / n);
    if (ok) tap(from);
  });
  function tap(i: number): void {
    if (p.paused()) return;
    const n = S.tap(b, i);
    if (!n) return;
    moves += n;
    draw();
    if (S.isSolved(b)) {
      const secs = p.secs();
      return p.end({ won: true, score: S.score(b.size, moves, secs), words: `In order in ${moves} moves, ${fmtTime(secs)}.` });
    }
    p.keep({ b, moves });
  }
  function draw(): void {
    els.forEach((el, i) => {
      const v = b.cells[i]!;
      el.className = v ? 'al-gtile al-gslidetile' : 'al-gtile al-ggap';
      el.classList.toggle('al-ghome', v === i + 1);
      el.setAttribute('aria-label', v ? `Tile ${v}` : 'Gap');
      clear(el, v ? String(v) : '');
    });
    p.score(0, `${moves} moves · ${fmtTime(p.secs())}`);
  }
  draw();
  p.keep({ b, moves });
  return unswipe;
};
