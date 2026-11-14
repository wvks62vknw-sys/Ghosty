/**
 * The MERGE board. Options (GameConfig.options): size (3 to 6, default 4), target (the winning tile, default 2048).
 * Swipe (or the arrow keys) slides every tile; reaching the target wins, and play can go on for a higher score.
 */
import { h, clear } from '../../../core/dom';
import * as M from '../../../../../../packages/shared/src/applib/games/merge';
import { num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, grid, swipe } from './frame';

export const merge: Board = (p) => {
  const size = num(p.opts, 'size', 4, 3, 6);
  const target = num(p.opts, 'target', 2048, 16, 131072);
  const saved = p.resume as { b: M.MergeBoard; score: number; seed: number; n: number; reached: boolean } | null;
  const seed = saved?.seed ?? p.seed();
  let n = saved?.n ?? 0;
  const r = rng(seed + n);
  let b = saved?.b ?? M.start(size, r);
  let score = saved?.score ?? 0;
  let reached = saved?.reached ?? false;
  let undoState: { b: M.MergeBoard; score: number } | null = null;
  let fresh = -1;
  const els: HTMLElement[] = [];
  const board = grid(b.size, 'al-gmerge', b.cells.length, () => {
    const c = h('div.al-gtile');
    els.push(c);
    return c;
  });
  p.stage.append(board);
  const unswipe = swipe(board, go);
  p.keys([{ word: 'Undo move', run: undo, label: 'Undo the last swipe' }]);

  function go(d: M.Dir): void {
    if (p.paused()) return;
    const m = M.move(b, d);
    if (!m.moved) return;
    undoState = { b, score };
    b = m.board;
    score += m.gained;
    n++;
    fresh = M.spawn(b, rng(seed * 31 + n));
    draw();
    if (!reached && M.reached(b, target)) {
      reached = true;
      p.notice(`${target.toLocaleString('en-GB')} reached. Keep going for a higher score.`, 'ok');
    }
    if (!M.canMove(b)) return p.end({ won: reached, score, words: reached ? `No moves left. Best tile ${M.best(b)}.` : `No moves left. Best tile ${M.best(b)}.` });
    p.keep({ b, score, seed, n, reached });
  }
  function undo(): void {
    if (!undoState || p.paused()) return p.notice('Nothing to undo.');
    ({ b, score } = undoState);
    undoState = null;
    fresh = -1;
    draw();
    p.keep({ b, score, seed, n, reached });
  }
  function draw(): void {
    els.forEach((el, i) => {
      const v = b.cells[i]!;
      el.className = 'al-gtile';
      if (v) el.dataset.v = String(Math.min(v, 4096));
      else delete el.dataset.v;
      if (i === fresh) el.classList.add('al-gpop');
      clear(el, v ? v.toLocaleString('en-GB') : '');
    });
    p.score(score, `Best tile ${M.best(b)}`);
  }
  draw();
  p.keep({ b, score, seed, n, reached });
  return unswipe;
};
