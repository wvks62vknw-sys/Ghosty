/**
 * The MERGE board. Options (GameConfig.options): size (3 to 6, default 4), sizes (a picker), target (the winning tile,
 * default 2048), daily.
 * Swipe (or the arrow keys) slides every tile; reaching the target wins, and play can go on for a higher score.
 */
import { h, clear } from '../../../core/dom';
import * as M from '../../../../../../packages/shared/src/applib/games/merge';
import { bool, num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, grid, swipe } from './frame';

export const merge: Board = (p) => {
  const size = num(p.opts, 'size', 4, 3, 6);
  const target = num(p.opts, 'target', 2048, 16, 131072);
  const saved = p.resume as { b: M.MergeBoard; score: number; seed: number; n: number; reached: boolean } | null;
  const seed = saved?.seed ?? p.seed(bool(p.opts, 'daily', false));
  let n = saved?.n ?? 0;
  const r = rng(seed + n);
  let b = saved?.b ?? M.start(size, r);
  let score = saved?.score ?? 0;
  let reached = saved?.reached ?? false;
  let fresh = -1;
  const els: HTMLElement[] = [];
  const board = grid(b.size, 'al-gmerge', b.cells.length, () => {
    const c = h('div.al-gtile');
    els.push(c);
    return c;
  });
  p.stage.append(board);
  const unswipe = swipe(board, go);

  function go(d: M.Dir): void {
    if (p.paused()) return;
    const m = M.move(b, d);
    if (!m.moved) return;
    b = m.board;
    score += m.gained;
    n++;
    fresh = M.spawn(b, rng(seed * 31 + n));
    draw();
    slideIn(m.from);
    if (!reached && M.reached(b, target)) {
      reached = true;
      p.notice(`${target.toLocaleString('en-GB')} reached. Keep going for a higher score.`, 'ok');
    }
    if (!M.canMove(b)) return p.end({ won: reached, score, words: reached ? `No moves left. Best tile ${M.best(b)}.` : `No moves left. Best tile ${M.best(b)}.` });
    p.keep({ b, score, seed, n, reached });
  }
  /** Each tile starts where it came from and glides to its cell; joined tiles bump. */
  function slideIn(from: number[][]): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r0 = els[0]!.getBoundingClientRect();
    const r1 = els[1]!.getBoundingClientRect();
    const step = r1.left - r0.left;
    els.forEach((el, i) => {
      const src = from[i];
      if (!src?.length) return;
      const s = src[src.length - 1]!;
      const dx = ((s % b.size) - (i % b.size)) * step;
      const dy = (Math.floor(s / b.size) - Math.floor(i / b.size)) * step;
      if (src.length > 1) el.classList.add('al-gbump');
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = '';
      el.style.transform = '';
    });
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
