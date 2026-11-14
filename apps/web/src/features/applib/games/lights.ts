/**
 * The LIGHTS board. Options (GameConfig.options): size (3 to 7, default 5), moves (scramble presses, 3 to 25, default 10).
 * Tap a light: it and the four next to it change. Turn them all off; par is the presses used to scramble.
 */
import { h } from '../../../core/dom';
import * as L from '../../../../../../packages/shared/src/applib/games/lights';
import { num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, grid } from './frame';

export const lights: Board = (p) => {
  const saved = p.resume as { l: L.Lights; presses: number } | null;
  const l: L.Lights = saved?.l ?? L.scramble(num(p.opts, 'size', 5, 3, 7), num(p.opts, 'moves', 10, 3, 25), p.seed());
  let presses = saved?.presses ?? 0;
  const els: HTMLElement[] = [];
  const board = grid(l.size, 'al-glights', l.on.length, (i) => {
    const el = h('div.al-glight', { role: 'gridcell', tabIndex: 0, 'aria-label': `Light ${i + 1}` });
    el.addEventListener('click', () => tap(i));
    els.push(el);
    return el;
  });
  p.stage.append(board);
  function tap(i: number): void {
    if (p.paused()) return;
    L.press(l, i);
    presses++;
    draw();
    if (L.cleared(l)) return p.end({ won: true, score: L.score(l, presses), words: `All off in ${presses} presses (par ${l.par}).` });
    p.keep({ l: { size: l.size, on: l.on, par: l.par }, presses });
  }
  function draw(): void {
    els.forEach((el, i) => el.classList.toggle('al-gon', l.on[i]!));
    p.score(0, `${presses} presses · par ${l.par}`);
  }
  draw();
  p.keep({ l: { size: l.size, on: l.on, par: l.par }, presses });
};
