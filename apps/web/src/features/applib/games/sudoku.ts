/**
 * The SUDOKU board. Options (GameConfig.options): difficulty 'easy' | 'medium' | 'hard' (default 'medium'),
 * mistakes (wrong entries allowed, 0 for unlimited, default 3), daily (boolean, default false).
 * Tap a cell, then a number; NOTES pencils small candidates in; HINT fills the cell with fewest candidates.
 */
import { h, clear } from '../../../core/dom';
import * as S from '../../../../../../packages/shared/src/applib/games/sudoku';
import { bool, num, str } from '../../../../../../packages/shared/src/applib/games/rng';
import { type Board, fmtTime, grid } from './frame';

interface State {
  diff: S.Difficulty;
  puzzle: number[];
  solution: number[];
  cells: number[];
  notes: number[];
  mistakes: number;
  hints: number;
}

export const sudoku: Board = (p) => {
  const diff = str(p.opts, 'difficulty', ['easy', 'medium', 'hard'] as const, 'medium');
  const maxMistakes = num(p.opts, 'mistakes', 3, 0, 9);
  let s = p.resume as State | null;
  if (!s) {
    const g = S.generate(p.seed(bool(p.opts, 'daily', false)), diff);
    s = { diff, puzzle: g.puzzle, solution: g.solution, cells: g.puzzle.slice(), notes: Array(81).fill(0), mistakes: 0, hints: 0 };
  }
  const st = s;
  let sel = st.cells.indexOf(0);
  let notes = false;
  const cellEls: HTMLElement[] = [];
  const board = grid(9, 'al-gsudoku', 81, (i) => {
    const b = h('div.al-gcell', { role: 'gridcell', tabIndex: 0, 'aria-label': `Row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}` });
    b.addEventListener('click', () => ((sel = i), draw()));
    cellEls.push(b);
    return b;
  });
  const pad = h('div.al-gpad');
  for (let v = 1; v <= 9; v++) {
    const b = h('button.al-gpadkey', { type: 'button', 'aria-label': `Enter ${v}` }, String(v));
    b.addEventListener('click', () => enter(v));
    pad.append(b);
  }
  const erase = h('button.al-gpadkey', { type: 'button', 'aria-label': 'Erase' }, '⌫');
  erase.addEventListener('click', () => enter(0));
  pad.append(erase);
  p.stage.append(board, pad);

  function setKeys(): void {
    p.keys([
      { word: notes ? 'Notes on' : 'Notes', on: notes, run: () => ((notes = !notes), setKeys()), label: 'Pencil notes' },
      { word: 'Hint', run: hint },
    ]);
  }
  function line(): string {
    return `${maxMistakes ? `Mistakes ${st.mistakes}/${maxMistakes}` : `Mistakes ${st.mistakes}`} · ${fmtTime(p.secs())}`;
  }
  function enter(v: number): void {
    if (p.paused() || sel < 0 || st.puzzle[sel]) return;
    if (notes && v) {
      if (!st.cells[sel]) st.notes[sel]! ^= 1 << v;
    } else {
      st.cells[sel] = v;
      st.notes[sel] = 0;
      if (v && v !== st.solution[sel]) {
        st.mistakes++;
        p.notice(`${v} does not go there.`, 'warn');
        if (maxMistakes && st.mistakes >= maxMistakes) {
          draw();
          return p.end({ won: false, score: 0, words: `${maxMistakes} mistakes. The puzzle is kept for another try.` });
        }
      }
      if (v === st.solution[sel]) for (const q of S.PEERS[sel]!) st.notes[q]! &= ~(1 << v);
    }
    p.keep(st);
    draw();
    if (S.isSolved(st.cells, st.solution)) {
      const secs = p.secs();
      p.end({ won: true, score: S.score(st.diff, secs, st.mistakes, st.hints), words: `Solved in ${fmtTime(secs)}.` });
    }
  }
  function hint(): void {
    if (p.paused()) return;
    const c = S.hintCell(st.cells.map((v, i) => (v === st.solution[i] ? v : 0)));
    if (c < 0) return;
    sel = c;
    st.hints++;
    st.cells[c] = 0;
    enter(st.solution[c]!);
  }
  function draw(): void {
    const clash = S.conflicts(st.cells);
    const selV = sel >= 0 ? st.cells[sel] : 0;
    const sr = Math.floor(sel / 9);
    const sc = sel % 9;
    cellEls.forEach((b, i) => {
      const v = st.cells[i]!;
      const r = Math.floor(i / 9);
      const c = i % 9;
      b.className = 'al-gcell';
      if (st.puzzle[i]) b.classList.add('al-ggiven');
      if (i === sel) b.classList.add('al-gsel');
      else if (sel >= 0 && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)))) b.classList.add('al-gpeer');
      if (v && v === selV) b.classList.add('al-gsame');
      if (clash.has(i) || (v && v !== st.solution[i])) b.classList.add('al-gbad');
      if (c % 3 === 2 && c < 8) b.classList.add('al-gbr');
      if (r % 3 === 2 && r < 8) b.classList.add('al-gbb');
      if (v) clear(b, String(v));
      else if (st.notes[i]) clear(b, h('span.al-gnotes', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('i', st.notes[i]! & (1 << n) ? String(n) : '')))); 
      else clear(b);
    });
    p.score(0, line());
  }
  setKeys();
  draw();
  const tick = setInterval(() => !p.paused() && p.score(0, line()), 1000);
  const keyd = (e: KeyboardEvent) => {
    if (!board.isConnected) return;
    if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
    else if (e.key === 'Backspace' || e.key === '0') enter(0);
  };
  window.addEventListener('keydown', keyd);
  return () => {
    clearInterval(tick);
    window.removeEventListener('keydown', keyd);
  };
};
