/**
 * The MINES board. Options (GameConfig.options): rows (6 to 24, default 12), cols (6 to 16, default 9),
 * mines (default about 15% of the cells), levels beginner | intermediate | expert (a picker), daily. Tap opens; FLAG mode (or a long press) marks a mine; tapping an open number
 * whose flags are all placed opens the rest around it. The first tap is always an opening.
 */
import { h, clear } from '../../../core/dom';
import * as M from '../../../../../../packages/shared/src/applib/games/mines';
import { bool, num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime, grid } from './frame';

export const mines: Board = (p) => {
  const rows = num(p.opts, 'rows', 12, 6, 24);
  const cols = num(p.opts, 'cols', 9, 6, 16);
  const count = num(p.opts, 'mines', Math.round(rows * cols * 0.15), 1, rows * cols - 9);
  const saved = p.resume as { g: M.Mines; seed: number } | null;
  const g = saved?.g ?? M.create(rows, cols, count);
  const seed = saved?.seed ?? p.seed(bool(p.opts, 'daily', false));
  let flagMode = false;
  const els: HTMLElement[] = [];
  const board = grid(g.cols, 'al-gmines', g.cells.length, (i) => {
    const b = h('div.al-gcell', { role: 'gridcell', tabIndex: 0, 'aria-label': `Row ${Math.floor(i / g.cols) + 1} column ${(i % g.cols) + 1}` });
    let timer = 0;
    let longed = false;
    b.addEventListener('pointerdown', () => {
      longed = false;
      timer = window.setTimeout(() => {
        longed = true;
        act(i, true);
      }, 420);
    });
    const cancel = () => clearTimeout(timer);
    b.addEventListener('pointerup', cancel);
    b.addEventListener('pointerleave', cancel);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      if (!longed) act(i, flagMode);
    });
    els.push(b);
    return b;
  });
  p.stage.append(board);
  const setKeys = () => p.keys([{ word: flagMode ? 'Flag on' : 'Flag', on: flagMode, run: () => ((flagMode = !flagMode), setKeys()), label: 'Flag mode' }]);

  function act(i: number, flag: boolean): void {
    if (p.paused() || g.state !== 'play') return;
    if (flag && !g.open[i]) {
      M.toggleFlag(g, i);
      navigator.vibrate?.(15);
    } else if (g.open[i]) M.chord(g, i, seed);
    else M.reveal(g, i, seed);
    draw();
    if (g.state === 'play') p.keep({ g, seed });
    else if (g.state === 'won') {
      const secs = p.secs();
      p.end({ won: true, score: M.score(g, secs), words: `Cleared in ${fmtTime(secs)}.` });
    } else p.end({ won: false, score: 0, words: 'A mine. Every one is shown now.' });
  }
  function draw(): void {
    els.forEach((b, i) => {
      b.className = 'al-gcell';
      const v = g.cells[i]!;
      if (g.open[i] || (g.state === 'lost' && v === -1)) {
        b.classList.add('al-gopen');
        if (v === -1) {
          b.classList.add(i === g.boom ? 'al-gboom' : 'al-gmine');
          clear(b, h('i.al-gdot'));
        } else {
          b.dataset.n = String(v);
          clear(b, v ? String(v) : '');
        }
      } else if (g.flag[i]) {
        b.classList.add('al-gflag');
        clear(b, h('i.al-gflagmark'));
      } else clear(b);
    });
    p.score(0, `${M.flagsLeft(g)} mines left · ${fmtTime(p.secs())}`);
  }
  setKeys();
  draw();
  const tick = setInterval(() => !p.paused() && g.state === 'play' && g.laid && p.score(0, `${M.flagsLeft(g)} mines left · ${fmtTime(p.secs())}`), 1000);
  return () => clearInterval(tick);
};
