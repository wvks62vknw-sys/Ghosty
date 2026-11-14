/**
 * The NONOGRAM board. Options (GameConfig.options): size (5 to 15, default 10), density (35 to 70, default 55),
 * daily (default false). Tap or drag to fill; CROSS mode marks cells he knows are empty. A clue greys out once its line
 * is met. Every picture solves by logic alone.
 */
import { h, clear } from '../../../core/dom';
import * as N from '../../../../../../packages/shared/src/applib/games/nonogram';
import { bool, num } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime } from './frame';

export const nonogram: Board = (p) => {
  const size = num(p.opts, 'size', 10, 5, 15);
  const saved = p.resume as { n: N.Nonogram; cells: number[] } | null;
  const n = saved?.n ?? N.generate(p.seed(bool(p.opts, 'daily', false)), size, num(p.opts, 'density', 55, 35, 70));
  const cells = saved?.cells ?? Array(n.size * n.size).fill(0); // 0 blank, 1 filled, 2 crossed
  let cross = false;
  const wrap = h('div.al-gnono', { style: `grid-template-columns: auto repeat(${n.size}, minmax(0, 1fr))`, role: 'grid' });
  const els: HTMLElement[] = [];
  const colClues: HTMLElement[] = [];
  const rowClues: HTMLElement[] = [];
  wrap.append(h('div.al-gnocorner'));
  for (let c = 0; c < n.size; c++) wrap.append((colClues[c] = h('div.al-gnoclue.al-gnocol', ...n.cols[c]!.map((x) => h('span', String(x))))));
  for (let r = 0; r < n.size; r++) {
    wrap.append((rowClues[r] = h('div.al-gnoclue.al-gnorow', ...n.rows[r]!.map((x) => h('span', String(x))))));
    for (let c = 0; c < n.size; c++) {
      const i = r * n.size + c;
      const el = h('div.al-gcell.al-gnocell', { role: 'gridcell', tabIndex: 0, dataset: { i: String(i) }, 'aria-label': `Row ${r + 1} column ${c + 1}` });
      if (c % 5 === 4 && c < n.size - 1) el.classList.add('al-gbr');
      if (r % 5 === 4 && r < n.size - 1) el.classList.add('al-gbb');
      els.push(el);
      wrap.append(el);
    }
  }
  p.stage.append(wrap);
  wrap.style.touchAction = 'none';
  let painting: number | null = null;
  const at = (e: PointerEvent): number => {
    const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    return t?.dataset.i ? Number(t.dataset.i) : -1;
  };
  wrap.addEventListener('pointerdown', (e) => {
    const i = at(e);
    if (i < 0 || p.paused()) return;
    const want = cross ? 2 : 1;
    painting = cells[i] === want ? 0 : want;
    set(i);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (painting === null) return;
    const i = at(e);
    if (i >= 0) set(i);
  });
  const endPaint = () => {
    if (painting === null) return;
    painting = null;
    p.keep({ n, cells });
    check();
  };
  window.addEventListener('pointerup', endPaint);
  function set(i: number): void {
    if (painting === null || cells[i] === painting) return;
    cells[i] = painting;
    draw();
  }
  const filled = () => cells.map((v) => v === 1);
  function check(): void {
    if (N.isSolved(n, filled())) {
      const secs = p.secs();
      p.end({ won: true, score: N.score(n.size, secs, 0), words: `Picture finished in ${fmtTime(secs)}.` });
    }
  }
  function draw(): void {
    const f = filled();
    els.forEach((el, i) => {
      el.dataset.v = String(cells[i]);
    });
    for (let r = 0; r < n.size; r++) rowClues[r]!.classList.toggle('al-gnodone', N.lineDone(n.rows[r]!, f.slice(r * n.size, r * n.size + n.size)));
    for (let c = 0; c < n.size; c++) colClues[c]!.classList.toggle('al-gnodone', N.lineDone(n.cols[c]!, [...Array(n.size).keys()].map((r) => f[r * n.size + c]!)));
    p.score(0, `${f.filter(Boolean).length} filled · ${fmtTime(p.secs())}`);
  }
  const setKeys = () =>
    p.keys([
      { word: cross ? 'Cross on' : 'Cross', on: cross, run: () => ((cross = !cross), setKeys()), label: 'Mark empty cells' },
      { word: 'Clear', run: () => (cells.fill(0), draw(), p.keep({ n, cells })), label: 'Clear the picture' },
    ]);
  setKeys();
  draw();
  p.keep({ n, cells });
  void clear;
  return () => window.removeEventListener('pointerup', endPaint);
};
