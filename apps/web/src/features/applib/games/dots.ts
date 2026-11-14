/**
 * The DOTS board, against the phone. Options (GameConfig.options): size (boxes a side, 2 to 6, default 4),
 * cpu ('easy' | 'fair', default 'fair'). Tap between two dots to draw a line; closing a box scores it and gives
 * another turn. Winning is more boxes than the phone.
 */
import { h } from '../../../core/dom';
import * as D from '../../../../../../packages/shared/src/applib/games/dots';
import { num, rng, str } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const dots: Board = (p) => {
  const size = num(p.opts, 'size', 4, 2, 6);
  const level = str(p.opts, 'cpu', ['easy', 'fair'] as const, 'fair');
  const r = rng(p.seed());
  const d: D.Dots = (p.resume as D.Dots | null) ?? D.start(size);
  let cpuTimer = 0;
  const n = d.size;
  const across = n * (n + 1);
  const cols = Array.from({ length: 2 * n + 1 }, (_, k) => (k % 2 ? 'minmax(0, 1fr)' : '14px')).join(' ');
  const board = h('div.al-gdots', { style: `grid-template-columns: ${cols}; grid-template-rows: ${cols}` });
  const edgeEls: HTMLElement[] = [];
  const boxEls: HTMLElement[] = [];
  for (let R = 0; R <= 2 * n; R++)
    for (let C = 0; C <= 2 * n; C++) {
      if (R % 2 === 0 && C % 2 === 0) board.append(h('i.al-gdot'));
      else if (R % 2 === 0) {
        const e = (R / 2) * n + (C - 1) / 2;
        board.append((edgeEls[e] = edge(e, 'al-gedgeh')));
      } else if (C % 2 === 0) {
        const e = across + ((R - 1) / 2) * (n + 1) + C / 2;
        board.append((edgeEls[e] = edge(e, 'al-gedgev')));
      } else board.append((boxEls[((R - 1) / 2) * n + (C - 1) / 2] = h('div.al-gbox')));
    }
  p.stage.append(board);
  function edge(e: number, cls: string): HTMLElement {
    const el = h(`div.al-gedge.${cls}` as 'div', { role: 'button', tabIndex: 0, 'aria-label': `Line ${e + 1}` }, h('i'));
    el.addEventListener('click', () => mine(e));
    return el;
  }
  function mine(e: number): void {
    if (p.paused() || d.turn !== 1 || D.over(d)) return;
    if (D.draw(d, e) < 0) return;
    after();
  }
  function after(): void {
    draw();
    if (D.over(d)) {
      const t = D.tally(d);
      return p.end({ won: t.me > t.cpu, score: t.me * 10, words: t.me > t.cpu ? `You won ${t.me} to ${t.cpu}.` : t.me === t.cpu ? `A draw, ${t.me} each.` : `The phone won ${t.cpu} to ${t.me}.` });
    }
    p.keep(d);
    if (d.turn === 2) cpuTimer = window.setTimeout(cpu, 420);
  }
  function cpu(): void {
    if (p.paused()) return;
    D.draw(d, D.cpuEdge(d, r, level));
    after();
  }
  p.onPause((paused) => {
    if (paused) clearTimeout(cpuTimer);
    else if (d.turn === 2 && !D.over(d)) cpuTimer = window.setTimeout(cpu, 420);
  });
  function draw(): void {
    edgeEls.forEach((el, e) => (el.dataset.by = String(d.edges[e])));
    boxEls.forEach((el, b) => (el.dataset.by = String(d.boxes[b])));
    const t = D.tally(d);
    p.score(t.me * 10, `You ${t.me} · phone ${t.cpu} · ${d.turn === 1 ? 'your turn' : 'the phone is thinking'}`);
  }
  draw();
  p.keep(d);
  if (d.turn === 2) cpuTimer = window.setTimeout(cpu, 420);
  return () => clearTimeout(cpuTimer);
};
