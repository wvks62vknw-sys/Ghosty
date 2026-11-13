/**
 * THE SPREADSHEETS SHEET (BRIEF-EDITOR-SPREADSHEETS; MAKE → SPREADSHEETS, "my spreadsheets", the Stage's OPEN on a table, a file shared to
 * Ghosty): MY SPREADSHEETS kept on this phone; a workbook as a grid he touches (grid.ts) with a formula line above it, a name box, the function
 * names offered as he types, FORMAT, SORT and FILTER on a column's header, a chart from a range, several sheets along the foot (long press to
 * rename), UNDO and REDO, FIND and REPLACE, Σ (AutoSum), rows and columns put in and taken out (every formula following its cells), a fill
 * handle, FILL DOWN and FILL RIGHT, copy and paste; autosave said once; export as .xlsx, CSV and PDF with the size said before; import
 * of an .xlsx or a CSV with what it could not keep said once; Ghosty explaining a cell, writing a formula, tidying a column (chat turns with the
 * chosen cells as context). The workbook, its formulas and its files are the app's own code (this folder): no package.
 */
import { h, clear } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { sayError } from '../ui/hisWords';
import { MIME, sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';
import { askBrain } from '../docs/ask';
import { cleanMessage, contextOf, explainMessage, formulaFrom, formulaMessage, numberedFrom, sentenceFrom } from './ask';
import { chartSvg } from './chartdraw';
import { fromCsv, toCsv } from './csv';
import { Engine, FUNCTION_NAMES } from './formula';
import { makeGrid, rectOf, type Grid, type GridHost } from './grid';
import {
  addChart, addSheet, bookFromTable, budget, cellInput, clearRange, History, isEmptyBook, isErr, looking, newBook, removeChart, removeSheet, renameSheet, retitle, setEntry, setFilter, setFormat, setFrozen, setName, setWidth,
  sheetNameProblem, usedCols, usedRows, validName, type Book, type Cell, type Fmt, type Val,
} from './model';
import { autoSum, chartOf, chartSeries, fillRange, moveLines, sortRows, visibleRows } from './ops';
import { pdfOfBook } from './pdf';
import { getBook, listBooks, removeBook, saveBook, whenWords } from './store';
import { addr, colName, MAXC, MAXR, parseAddr, parseRange, rangeText, type Pos, type Rect } from './tokens';
import { readXlsx, } from './xlsxread';
import { writeXlsx } from './xlsx';

export const sheetsState = {
  open: false,
  view: 'list' as 'list' | 'book',
  title: '',
  sheets: [] as string[],
  active: '',
  sel: '',
  range: '',
  said: '',
  kept: 0,
  saved: 0,
  savedCount: 0,
  exported: [] as { name: string; size: number; type: string }[],
  lost: [] as string[],
  json: '',
  zoom: 1,
  offline: false,
  blocked: false,
  opened: 0,
  recalcMs: 0,
  read: (_sheet: string, _a: string): { v: Val; f?: string; text: string } => ({ v: null, text: '' }),
};
let current: { close(): void } | null = null;
/** The sheet's name (its title, and its panel on the SPREADSHEETS screen: features/sheets/index.ts). */
export const SHEETS_TITLE = 'SPREADSHEETS';
type SheetsAsk = { book?: Book; table?: string[][]; title?: string; id?: string; what?: 'list' | 'new' | 'budget' | 'import' };

/** The sheet: a workbook to open, a table from an answer, or MY SPREADSHEETS. */
export async function openSheets(o: SheetsAsk = {}): Promise<void> {
  current?.close();
  const d = sheetsParts();
  sheetsState.open = true;
  current = modal(SHEETS_TITLE, d.el, () => {
    d.stop();
    sheetsState.open = false;
    current = null;
  });
  await d.start(o);
}

const COMMON = ['SUM', 'AVERAGE', 'IF', 'COUNT', 'MIN', 'MAX', 'ROUND', 'VLOOKUP', 'XLOOKUP', 'SUMIF', 'COUNTIF', 'IFERROR', 'TODAY', 'CONCAT', 'TEXT', 'INDEX', 'MATCH', 'SUMIFS'];
const slug = (t: string): string => t.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'spreadsheet';
const fileTitle = (name: string): string => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported spreadsheet';
const posOf = (a: string): Pos => parseAddr(a) ?? { r: 0, c: 0 };
const aText = (p: Pos): string => addr(p.r, p.c);
const countCells = (b: Book): number => b.sheets.reduce((n, s) => n + Object.keys(s.cells).length, 0);

/**
 * The spreadsheets' page (the sheet's, and the SPREADSHEETS screen's: features/sheets/index.ts): `start` opens what was asked for;
 * `stop` puts the last words away.
 */
export function sheetsParts(): { el: HTMLElement; start(o: SheetsAsk): Promise<void>; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.sheets = sheetsState;
  let hist: History | null = null;
  let eng: Engine | null = null;
  let A: Pos = { r: 0, c: 0 };
  let B: Pos = { r: 0, c: 0 };
  let zoom = 1;
  let panel = 'format';
  let chartKind: 'bars' | 'line' = 'bars';
  let clip: { cells: (Cell | undefined)[][]; at: Pos } | null = null;
  let rev = 0;
  let editFor: { sheet: string; a: string } | null = null;
  let saveTimer = 0;
  let sizeTimer = 0;
  let blocked = false;
  let hold = 0;
  let suggestion: { kind: 'explain' | 'formula' | 'clean'; text: string; formula?: string; edits?: { a: string; text: string; old: string }[] } | null = null;
  let findHits: string[] = [];
  let findAt = -1;
  let colOpen = -1;
  const cache = new Map<string, { rev: number; bytes: Uint8Array }>();

  const book = (): Book => hist!.book;
  const si = (): number => Math.max(0, Math.min(book().view.sheet, book().sheets.length - 1));
  const sheet = () => book().sheets[si()]!;
  const say = (words: string) => {
    status.textContent = words;
    sheetsState.said = words;
  };
  const shareOrSave = async (blob: Blob, name: string) => {
    if (!(await shareBlob(blob, name))) saveBlob(blob, name);
  };

  const fileIn = h('input', { type: 'file', hidden: true, accept: '.xlsx,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aria-label': 'Choose a spreadsheet to open' }) as HTMLInputElement;
  const status = h('p.shstatus', { 'aria-live': 'polite' });
  const view = h('div.shview');
  const offline = h('p.shoffline');
  const paintOffline = () => {
    sheetsState.offline = !navigator.onLine;
    offline.hidden = navigator.onLine;
    offline.textContent = navigator.onLine ? '' : 'No signal. Everything here still works, and it is kept on this phone; only asking Ghosty needs one.';
  };
  const onNet = () => paintOffline();
  addEventListener('online', onNet);
  addEventListener('offline', onNet);
  paintOffline();

  // ---------------------------------------------------------------- keeping
  const keep = (announce: boolean) => {
    if (!hist) return;
    if (saveBook(hist.book)) {
      blocked = false;
      sheetsState.blocked = false;
      sheetsState.kept = listBooks().length;
      sheetsState.saved = Date.now();
      if (announce) {
        const quiet = Date.now() < hold;
        hold = Date.now() + 1800;
        savedEl.textContent = `SAVED · KEPT ON THIS PHONE ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        if (!quiet) {
          sheetsState.savedCount++;
          savedEl.dataset.on = '0';
          void savedEl.offsetWidth;
          savedEl.dataset.on = '1';
        }
      }
    } else if (!blocked) {
      blocked = true;
      sheetsState.blocked = true;
      say('This phone is not letting me keep spreadsheets (its storage is blocked or full). You can still work and export; nothing will be here when you leave.');
    }
  };
  let wantSaid = false;
  const schedule = (announce: boolean) => {
    clearTimeout(saveTimer);
    wantSaid = wantSaid || announce;
    saveTimer = window.setTimeout(flush, 200);
  };
  /** What waits to be kept is kept now (a pause of 200 ms, leaving the screen, the app going to the background). */
  const flush = () => {
    clearTimeout(saveTimer);
    if (!hist) return;
    const say1 = wantSaid;
    wantSaid = false;
    keep(say1);
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', flush);
  const savedEl = h('small.shsaved', { 'aria-live': 'polite' });
  savedEl.dataset.on = '0';

  // ---------------------------------------------------------------- the grid's host
  const host: GridHost = {
    book,
    sheet: si,
    eng: () => eng!,
    sel: () => ({ a: A, b: B }),
    select: (a, b) => select(a, b),
    edit: () => {
      line.focus();
      line.select();
    },
    point: (p) => {
      if (document.activeElement !== line || !/^=(?:.*[(,+\-*/^&=<>:])?$/.test(line.value)) return false;
      line.setRangeText(aText(p), line.selectionStart ?? line.value.length, line.selectionEnd ?? line.value.length, 'end');
      line.dispatchEvent(new Event('input'));
      return true;
    },
    column: (c) => openColumn(c),
    row: (r) => select({ r, c: 0 }, { r, c: Math.max(usedCols(sheet()) - 1, 0) }),
    fill: (src, target) => {
      commit(fillRange(book(), si(), rangeText(src), aText(target)), 'all');
      select({ r: src.r1, c: src.c1 }, { r: Math.max(src.r2, target.r > src.r2 ? target.r : src.r2), c: Math.max(src.c2, target.c > src.c2 ? target.c : src.c2) });
      say('Carried on. UNDO takes it back.');
    },
    zoom: () => zoom,
    setZoom: (z) => {
      const next = Math.round(z * 20) / 20;
      if (next === zoom) return;
      zoom = next;
      sheetsState.zoom = zoom;
      requestAnimationFrame(() => grid.paint());
    },
    key: (e) => onKey(e),
  };
  const grid: Grid = makeGrid(host);

  // ---------------------------------------------------------------- the formula line
  const addrIn = h('input.shaddr', { type: 'text', 'aria-label': 'Chosen cells: type a cell, a range or a name and press Enter', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, enterKeyHint: 'go' }) as HTMLInputElement;
  const line = h('input.shline', { type: 'text', 'aria-label': 'Formula line: what is in the chosen cell', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: false, enterKeyHint: 'done' }) as HTMLInputElement;
  const fns = h('div.shfns', { 'aria-label': 'Functions that start like that' });
  const errLine = h('p.sherr', { 'aria-live': 'polite' });
  let lineOrig = '';
  const paintErr = () => {
    const v = eng!.value(sheet().name, aText(A));
    if (isErr(v)) {
      errLine.hidden = false;
      errLine.textContent = `${v.e} ${Engine.explain(v.e)}`;
    } else {
      errLine.hidden = true;
      errLine.textContent = '';
    }
  };
  const paintLine = () => {
    const cell = sheet().cells[aText(A)];
    line.value = cellInput(cell);
    lineOrig = line.value;
    const g = rectOf(A, B);
    const one = g.r1 === g.r2 && g.c1 === g.c2;
    const whole = g.r1 === 0 && g.r2 >= usedRows(sheet()) - 1 && g.c1 === g.c2 && !one;
    addrIn.value = one ? aText(A) : whole ? `${colName(g.c1)}:${colName(g.c2)}` : rangeText(g);
    sheetsState.sel = aText(A);
    sheetsState.range = rangeText(g);
    clear(fns);
    paintErr();
  };
  const offer = () => {
    clear(fns);
    if (!line.value.startsWith('=')) return;
    const upto = line.value.slice(0, line.selectionStart ?? line.value.length);
    const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(upto);
    if (!m) return;
    const pre = m[1]!.toUpperCase();
    const hits = FUNCTION_NAMES.filter((n) => n.startsWith(pre) && n !== pre).sort((p, q) => (COMMON.indexOf(p) < 0 ? 99 : COMMON.indexOf(p)) - (COMMON.indexOf(q) < 0 ? 99 : COMMON.indexOf(q)) || p.localeCompare(q)).slice(0, 3);
    for (const n of hits) {
      const k = button(n, () => {
        const at = line.selectionStart ?? line.value.length;
        const start = at - m[1]!.length;
        line.setRangeText(`${n}(`, start, at, 'end');
        line.focus();
        offer();
      }, 'shfn');
      k.setAttribute('aria-label', `Use the function ${n}`);
      fns.append(k);
    }
  };
  line.addEventListener('focus', () => {
    editFor = { sheet: sheet().name, a: aText(A) };
  });
  line.addEventListener('input', offer);
  const commitLine = (move: 'down' | 'right' | null) => {
    const f = editFor ?? { sheet: sheet().name, a: aText(A) };
    if (line.value !== lineOrig) {
      const next = setEntry(book(), f.sheet, f.a, line.value);
      commit(next, [`${f.sheet}!${f.a}`]);
    }
    editFor = null;
    if (move === 'down') select({ r: Math.min(A.r + 1, MAXR - 1), c: A.c }, { r: Math.min(A.r + 1, MAXR - 1), c: A.c });
    else if (move === 'right') select({ r: A.r, c: Math.min(A.c + 1, MAXC - 1) }, { r: A.r, c: Math.min(A.c + 1, MAXC - 1) });
    else paintLine();
    lineOrig = line.value;
  };
  line.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitLine('down');
      grid.el.focus({ preventScroll: true });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitLine('right');
    } else if (e.key === 'Escape') {
      line.value = lineOrig;
      editFor = null;
      clear(fns);
      grid.el.focus({ preventScroll: true });
    }
  });
  line.addEventListener('change', () => {
    if (document.activeElement !== line && line.value !== lineOrig) commitLine(null);
  });
  line.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== line && line.value !== lineOrig && editFor) commitLine(null);
    }, 0);
  });
  addrIn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = addrIn.value.trim();
    const named = Object.entries(book().names).find(([k]) => k.toLowerCase() === t.toLowerCase())?.[1];
    const colOnly = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(t);
    const g = colOnly ? { r1: 0, r2: Math.max(usedRows(sheet()) - 1, 0), c1: parseAddr(`${colOnly[1]}1`)?.c ?? 0, c2: parseAddr(`${colOnly[2]}1`)?.c ?? 0 } : parseRange(named ?? t);
    if (!g) {
      say(`I don’t know “${t}”. Type a cell like B2, a range like A1:D5, or the name of a range you made.`);
      paintLine();
      return;
    }
    select({ r: g.r1, c: g.c1 }, { r: g.r2, c: g.c2 });
    grid.reveal({ r: g.r1, c: g.c1 });
  });

  // ---------------------------------------------------------------- choosing
  function select(a: Pos, b: Pos): void {
    A = { r: Math.max(0, Math.min(a.r, MAXR - 1)), c: Math.max(0, Math.min(a.c, MAXC - 1)) };
    B = { r: Math.max(0, Math.min(b.r, MAXR - 1)), c: Math.max(0, Math.min(b.c, MAXC - 1)) };
    if (hist) hist.book = looking(hist.book, { sel: aText(A) });
    if (colOpen >= 0 && !(A.c === colOpen && B.c === colOpen && A.r !== B.r)) closeColumn();
    paintLine();
    grid.paintSel();
    schedule(false);
  }
  const lastCol = () => Math.max(usedCols(sheet()) - 1, 0);
  function onKey(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && /^z$/i.test(e.key)) {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && /^y$/i.test(e.key)) return redo();
    if (mod && /^c$/i.test(e.key)) return copy();
    if (mod && /^v$/i.test(e.key)) return void paste();
    if (mod) return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      const to = { r: Math.max(0, Math.min((e.shiftKey ? B : A).r + dr, MAXR - 1)), c: Math.max(0, Math.min((e.shiftKey ? B : A).c + dc, MAXC - 1)) };
      if (e.shiftKey) select(A, to);
      else select(to, to);
      grid.reveal(to);
    };
    if (e.key === 'ArrowDown') return move(1, 0);
    if (e.key === 'ArrowUp') return move(-1, 0);
    if (e.key === 'ArrowRight') return move(0, 1);
    if (e.key === 'ArrowLeft') return move(0, -1);
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      return host.edit();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      return clearCells();
    }
    if (e.key.length === 1) {
      line.focus();
      line.value = '';
    }
  }

  // ---------------------------------------------------------------- changes
  function commit(next: Book, changed: string[] | 'all' = [], structure = false): void {
    const t0 = performance.now();
    hist!.push(next);
    rev++;
    eng!.update(next, changed === 'all' ? undefined : changed);
    refresh(structure || changed === 'all');
    sheetsState.recalcMs = Math.round(performance.now() - t0);
    schedule(true);
  }
  function undo(): void {
    if (!hist!.canUndo) return say('Nothing to undo.');
    hist!.undo();
    rev++;
    eng!.update(book());
    A = clampPos(posOf(book().view.sel));
    B = A;
    refresh(true);
    schedule(true);
  }
  function redo(): void {
    if (!hist!.canRedo) return say('Nothing to redo.');
    hist!.redo();
    rev++;
    eng!.update(book());
    refresh(true);
    schedule(true);
  }
  const clampPos = (p: Pos): Pos => ({ r: Math.min(p.r, MAXR - 1), c: Math.min(p.c, MAXC - 1) });
  const fmtOf = (): Fmt | undefined => sheet().cells[aText(A)]?.x;
  const range = (): string => rangeText(rectOf(A, B));
  function clearCells(): void {
    commit(clearRange(book(), si(), range()), 'all');
    say('Cleared; their look stays. UNDO brings them back.');
  }
  function copy(): void {
    const g = rectOf(A, B);
    clip = { cells: Array.from({ length: g.r2 - g.r1 + 1 }, (_, i) => Array.from({ length: g.c2 - g.c1 + 1 }, (_, j) => sheet().cells[addr(g.r1 + i, g.c1 + j)])), at: { r: g.r1, c: g.c1 } };
    const text = clip.cells.map((r, i) => r.map((_, j) => eng!.text(sheet().name, addr(g.r1 + i, g.c1 + j))).join('\t')).join('\n');
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    say(`Copied ${clip.cells.length * (clip.cells[0]?.length ?? 0)} cell${clip.cells.length * (clip.cells[0]?.length ?? 0) === 1 ? '' : 's'}. Choose where and PASTE.`);
  }
  async function paste(): Promise<void> {
    if (!clip) return say('Nothing copied yet: choose cells and COPY first.');
    const { shiftFormula } = await import('./tokens');
    let next = book();
    const s = sheet();
    const cells = { ...s.cells };
    clip.cells.forEach((row, i) => row.forEach((cell, j) => {
      const key = addr(A.r + i, A.c + j);
      if (A.r + i >= MAXR || A.c + j >= MAXC) return;
      if (!cell) delete cells[key];
      else cells[key] = cell.f !== undefined ? { ...cell, f: shiftFormula(cell.f, A.r - clip!.at.r, A.c - clip!.at.c) } : cell;
    }));
    next = { ...next, at: Date.now(), sheets: next.sheets.map((x, k) => (k === si() ? { ...x, cells } : x)) };
    commit(next, 'all');
    say('Pasted. UNDO takes it back.');
  }
  function fmt(patch: Partial<Fmt>): void {
    commit(setFormat(book(), si(), range(), patch), []);
  }
  const decimals = (delta: number) => {
    const x = fmtOf();
    const v = eng!.value(sheet().name, aText(A));
    if (x?.n === 'date' || x?.n === 'text' || typeof v !== 'number') return say('Decimals are for numbers.');
    const cur = x?.n ? (x.d ?? 2) : Math.min(8, (String(v).split('.')[1] ?? '').length);
    fmt({ ...(x?.n ? {} : { n: 'number' as const }), d: Math.max(0, Math.min(8, cur + delta)) });
  };

  // ---------------------------------------------------------------- a column's header: SORT and FILTER
  const colLabel = h('b.shcollabel');
  const fop = h('select.shfop', { 'aria-label': 'Keep the rows where the column is' }, ...[['over', 'is over'], ['under', 'is under'], ['is', 'is'], ['contains', 'contains'], ['filled', 'is not empty']].map(([v, t]) => h('option', { value: v }, t))) as HTMLSelectElement;
  const fval = h('input.shfval', { type: 'text', 'aria-label': 'The value to keep rows by', placeholder: 'a number or a word', autocomplete: 'off', enterKeyHint: 'go' }) as HTMLInputElement;
  const colMenu = h('div.shcolmenu');
  colMenu.hidden = true;
  function openColumn(c: number): void {
    colOpen = c;
    const last = Math.max(usedRows(sheet()) - 1, 0);
    A = { r: 0, c };
    B = { r: last, c };
    colLabel.textContent = `COLUMN ${colName(c)} · ${sheet().cells[addr(0, c)] ? eng!.text(sheet().name, addr(0, c)) : 'no title'}`;
    const f = sheet().filter;
    if (f && f.c === c) {
      fop.value = f.op;
      fval.value = f.v;
    }
    colMenu.hidden = false;
    paintLine();
    grid.paintSel();
    clearFilterKey.disabled = !sheet().filter;
  }
  function closeColumn(): void {
    colOpen = -1;
    colMenu.hidden = true;
  }
  const sortBy = (dir: 'asc' | 'desc') => {
    commit(sortRows(book(), si(), colOpen, dir), 'all', true);
    say(`Sorted by column ${colName(colOpen)}, ${dir === 'asc' ? 'smallest' : 'largest'} first. The first row stays the title row, and each row keeps its own formulas. UNDO puts them back.`);
  };
  const applyFilter = () => {
    if (fop.value !== 'filled' && !fval.value.trim()) return say('Say what to keep: a number or a word.');
    commit(setFilter(book(), si(), { c: colOpen, op: fop.value as 'over', v: fval.value.trim() }), 'all', true);
    const shown = visibleRows(sheet(), sheet().filter, eng!).length - 1;
    say(`Filter on column ${colName(colOpen)}: ${shown} of ${Math.max(usedRows(sheet()) - 1, 0)} rows kept. The others are only hidden.`);
    openColumn(colOpen);
  };
  const clearFilterKey = button('CLEAR FILTER', () => {
    commit(setFilter(book(), si(), null), 'all', true);
    say('Every row is back.');
    openColumn(colOpen);
  });
  clearFilterKey.disabled = true;
  const widen = (d: number) => commit(setWidth(book(), si(), colOpen, (sheet().widths[colOpen] ?? 96) + d), [], true);
  clear(colMenu, colLabel,
    h('div.shrow', button('SORT SMALLEST FIRST', () => sortBy('asc')), button('SORT LARGEST FIRST', () => sortBy('desc'))),
    h('div.shrow', fop, fval, button('FILTER', applyFilter, 'on'), clearFilterKey),
    h('div.shrow', button('INSERT A COLUMN BEFORE', () => lines('c', colOpen, 1)), button('DELETE THIS COLUMN', () => lines('c', colOpen, -1))),
    h('div.shrow', button('WIDER', () => widen(24)), button('NARROWER', () => widen(-24)), button('CLOSE', () => closeColumn())));
  fval.addEventListener('keydown', (e) => e.key === 'Enter' && applyFilter());

  // ---------------------------------------------------------------- rows and columns put in or taken out, and AUTOSUM
  /** `n` lines (rows 'r', columns 'c') put in before `at`, or `-n` taken out from `at`; every formula follows its cells. */
  function lines(axis: 'r' | 'c', at: number, n: number): void {
    const what = axis === 'r' ? 'row' : 'column';
    const k = Math.abs(n);
    const name = (i: number) => (axis === 'r' ? String(i + 1) : colName(i));
    const span = k === 1 ? `${what} ${name(at)}` : `${what}s ${name(at)} to ${name(at + k - 1)}`;
    if (n > 0 && (axis === 'r' ? usedRows(sheet()) + n > MAXR : usedCols(sheet()) + n > MAXC)) return say(`The sheet is full: take a ${what} out first.`);
    closeColumn();
    commit(moveLines(book(), si(), axis, at, n), 'all', true);
    if (n > 0) {
      A = axis === 'r' ? { r: at, c: A.c } : { r: A.r, c: at };
      B = axis === 'r' ? { r: at + k - 1, c: B.c } : { r: B.r, c: at + k - 1 };
      say(`${k === 1 ? `A new ${what}` : `${k} new ${what}s`} in at ${name(at)}; the formulas moved with their cells. UNDO takes ${k === 1 ? 'it' : 'them'} out.`);
    } else {
      A = clampPos(A);
      B = A;
      say(`Took out ${span}; the formulas moved with their cells. UNDO brings ${k === 1 ? 'it' : 'them'} back.`);
    }
    paintLine();
    grid.paintSel();
  }
  const selLines = (axis: 'r' | 'c'): [number, number] => {
    const g = rectOf(A, B);
    return axis === 'r' ? [g.r1, g.r2 - g.r1 + 1] : [g.c1, g.c2 - g.c1 + 1];
  };
  function sum(): void {
    const g = rectOf(A, B);
    const r = autoSum(book(), eng!, si(), g);
    if (!r) return say('No numbers above or beside to add up. Choose the numbers, or the cell under them.');
    commit(r.book, r.cells);
    if (r.cells.length === 1) {
      A = posOf(r.cells[0]!);
      B = A;
      say(`=${r.f} is in ${r.cells[0]}: ${eng!.text(sheet().name, r.cells[0]!)}. UNDO takes it out.`);
    } else say(`A total under each column, in ${r.cells[0]} to ${r.cells[r.cells.length - 1]}. UNDO takes them out.`);
    paintLine();
    grid.paintSel();
  }

  // ---------------------------------------------------------------- the panels
  const key = (label: string, run: () => void, cls = '', name = '') => {
    const b = button(label, run, cls);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  const pressed = (b: HTMLButtonElement, on: boolean) => b.setAttribute('aria-pressed', String(on));
  const boldKey = key('B', () => fmt({ b: fmtOf()?.b ? undefined : 1 }), 'shbold', 'Bold');
  const italKey = key('I', () => fmt({ i: fmtOf()?.i ? undefined : 1 }), 'shital', 'Italic');
  const swatches = [1, 2, 3, 4, 5].map((n) => {
    const b = key('', () => fmt({ fill: n as 1 }), 'shsw', `Fill ${n}`);
    b.dataset.fill = String(n);
    return b;
  });
  const freezeKey = key('FREEZE FIRST ROW', () => {
    commit(setFrozen(book(), si(), !sheet().frozen), [], true);
    say(sheet().frozen ? 'The first row stays in view as you scroll.' : 'The first row scrolls like the others.');
  });
  const nameIn = h('input', { type: 'text', 'aria-label': 'A name for the chosen cells', placeholder: 'a name, like Rent', autocomplete: 'off', autocapitalize: 'none', enterKeyHint: 'done' }) as HTMLInputElement;
  const findIn = h('input', { type: 'search', 'aria-label': 'Find in this sheet', placeholder: 'Find', autocomplete: 'off', enterKeyHint: 'search' }) as HTMLInputElement;
  const replIn = h('input', { type: 'text', 'aria-label': 'Replace with', placeholder: 'Replace with', autocomplete: 'off' }) as HTMLInputElement;
  const findSaid = h('small.shfound', { 'aria-live': 'polite' });
  const findBox = h('div.shfind');
  findBox.hidden = true;
  const doFind = (step: number) => {
    const t = findIn.value.trim().toLowerCase();
    findHits = [];
    if (t) {
      const s = sheet();
      const keys = Object.keys(s.cells).sort((p, q) => {
        const a = parseAddr(p)!;
        const b = parseAddr(q)!;
        return a.r - b.r || a.c - b.c;
      });
      for (const k of keys) if (eng!.text(s.name, k).toLowerCase().includes(t) || cellInput(s.cells[k]).toLowerCase().includes(t)) findHits.push(k);
    }
    if (!findHits.length) {
      findSaid.textContent = t ? 'Nothing like that on this sheet.' : '';
      return;
    }
    findAt = (findAt + step + findHits.length) % findHits.length;
    const p = posOf(findHits[findAt]!);
    select(p, p);
    grid.reveal(p);
    findSaid.textContent = `${findAt + 1} of ${findHits.length}`;
  };
  clear(findBox, h('div.shrow', findIn, key('NEXT', () => doFind(1)), key('BEFORE', () => doFind(-1))), h('div.shrow', replIn, key('REPLACE ALL', () => {
    const t = findIn.value;
    if (!t) return say('Say what to find first.');
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const s = sheet();
    let n = 0;
    const cells = { ...s.cells };
    for (const [k, c] of Object.entries(s.cells)) {
      if (typeof c.v === 'string' && c.f === undefined && re.test(c.v)) {
        re.lastIndex = 0;
        cells[k] = { ...c, v: c.v.replace(re, () => replIn.value) };
        n++;
      }
      re.lastIndex = 0;
    }
    if (!n) return say('No words to change: I only change words, never a formula.');
    commit({ ...book(), at: Date.now(), sheets: book().sheets.map((x, i) => (i === si() ? { ...x, cells } : x)) }, 'all');
    say(`Changed the words in ${n} cell${n === 1 ? '' : 's'}. UNDO takes it back.`);
  })), findSaid);
  findIn.addEventListener('keydown', (e) => e.key === 'Enter' && doFind(1));
  findIn.addEventListener('input', () => {
    findAt = -1;
  });

  const panels: Record<string, HTMLElement> = {
    format: h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Format' },
      h('div.shrow', key('NUMBER', () => fmt({ n: 'number' })), key('£', () => fmt({ n: 'currency' }), '', 'Pounds'), key('%', () => fmt({ n: 'percent' }), '', 'Percent'), key('DATE', () => fmt({ n: 'date' })), key('TEXT', () => fmt({ n: 'text' })), key('PLAIN', () => fmt({ n: undefined, d: undefined, k: undefined }), '', 'Plain number')),
      h('div.shrow', key('DECIMALS −', () => decimals(-1), '', 'Fewer decimals'), key('DECIMALS +', () => decimals(1), '', 'More decimals'), boldKey, italKey),
      h('div.shrow', key('LEFT', () => fmt({ a: 'l' }), '', 'Align left'), key('CENTRE', () => fmt({ a: 'c' }), '', 'Centre'), key('RIGHT', () => fmt({ a: 'r' }), '', 'Align right')),
      h('div.shrow.shswrow', ...swatches, key('NO FILL', () => fmt({ fill: undefined })), key('CLEAR FORMAT', () => commit(setFormat(book(), si(), range(), null), []))),
    ),
    data: h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Data' },
      h('p.shnote', 'Tap a column’s letter for SORT and FILTER.'),
      h('div.shrow', key('FIND', () => {
        findBox.hidden = !findBox.hidden;
        if (!findBox.hidden) findIn.focus();
      }), freezeKey, key('FILL DOWN', () => {
        const g = rectOf(A, B);
        if (g.r2 === g.r1) return say('Choose the cell and the cells below it first.');
        commit(fillRange(book(), si(), rangeText({ ...g, r2: g.r1 }), addr(g.r2, g.c2)), 'all');
        say('Filled down. UNDO takes it back.');
      }), key('FILL RIGHT', () => {
        const g = rectOf(A, B);
        if (g.c2 === g.c1) return say('Choose the cell and the cells to its right first.');
        commit(fillRange(book(), si(), rangeText({ ...g, c2: g.c1 }), addr(g.r2, g.c2)), 'all');
        say('Filled right. UNDO takes it back.');
      })),
      h('div.shrow', key('COPY', copy), key('PASTE', () => void paste()), key('CLEAR', clearCells)),
      h('div.shrow', key('ROW ABOVE', () => lines('r', selLines('r')[0], selLines('r')[1]), '', 'Insert a row above'), key('ROW BELOW', () => lines('r', selLines('r')[0] + selLines('r')[1], selLines('r')[1]), '', 'Insert a row below'), key('DELETE ROWS', () => lines('r', selLines('r')[0], -selLines('r')[1]), '', 'Delete the chosen rows')),
      h('div.shrow', key('COLUMN BEFORE', () => lines('c', selLines('c')[0], selLines('c')[1]), '', 'Insert a column before'), key('COLUMN AFTER', () => lines('c', selLines('c')[0] + selLines('c')[1], selLines('c')[1]), '', 'Insert a column after'), key('DELETE COLUMNS', () => lines('c', selLines('c')[0], -selLines('c')[1]), '', 'Delete the chosen columns')),
      h('div.shrow', nameIn, key('NAME THE CELLS', () => {
        const n = nameIn.value.trim();
        if (!validName(n)) return say('A name is letters, numbers and _, starting with a letter, and not like a cell (B2).');
        commit(setName(book(), n, `${sheet().name.includes(' ') ? `'${sheet().name}'` : sheet().name}!${range().split(':').map((x) => x.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':')}`), []);
        say(`${n} now means ${range()}. Use it in a formula, or type it in the box on the left.`);
        nameIn.value = '';
      }))),
    chart: h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Chart' },
      h('p.shnote', 'Choose the cells first: the first column names each bar, the last column is the numbers, and a first row of words is the chart’s title.'),
      h('div.shrow', key('BARS', () => { chartKind = 'bars'; paintChartKeys(); }), key('LINE', () => { chartKind = 'line'; paintChartKeys(); }), key('MAKE THE CHART', () => {
        const c = chartOf(book(), eng!, sheet().name, range(), chartKind);
        if (!c) return say('I need at least two numbers in the last column of what you chose.');
        commit(addChart(book(), c), []);
        say(`A ${chartKind === 'bars' ? 'bar' : 'line'} chart of ${c.values}, under the sheet. It follows the numbers.`);
      }, 'on')),
    ),
  };
  const barsKey = panels.chart!.querySelectorAll('button')[0] as HTMLButtonElement;
  const lineKey = panels.chart!.querySelectorAll('button')[1] as HTMLButtonElement;
  const paintChartKeys = () => {
    pressed(barsKey, chartKind === 'bars');
    pressed(lineKey, chartKind === 'line');
  };
  const paintFormatKeys = () => {
    const x = fmtOf();
    pressed(boldKey, !!x?.b);
    pressed(italKey, !!x?.i);
    pressed(freezeKey, sheet().frozen);
    for (const b of swatches) pressed(b, String(x?.fill ?? '') === b.dataset.fill);
  };
  const pills = h('div.shpills', { role: 'tablist', 'aria-label': 'Editing keys' }, ...(['format', 'data', 'chart'] as const).map((id) => {
    const b = button(id.toUpperCase(), () => showPanel(id), 'shpill');
    b.dataset.panel = id;
    b.setAttribute('role', 'tab');
    return b;
  }));
  function showPanel(id: string): void {
    panel = id;
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== id;
    for (const b of pills.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.panel === id));
    paintFormatKeys();
    paintChartKeys();
  }

  // ---------------------------------------------------------------- the foot: sheets
  const tabs = h('div.shtabs', { role: 'tablist', 'aria-label': 'The sheets of this workbook' });
  const renameBox = h('div.shrow.shrenamebox');
  renameBox.hidden = true;
  const renameIn = h('input.shrename', { type: 'text', 'aria-label': 'A new name for the sheet', autocomplete: 'off', maxlength: 31, enterKeyHint: 'done' }) as HTMLInputElement;
  let renaming = '';
  let deleteArmed = '';
  const doRename = () => {
    const to = renameIn.value.trim();
    const bad = sheetNameProblem(book(), to, book().sheets.findIndex((s) => s.name === renaming));
    if (bad) return say(bad);
    if (to !== renaming) commit(renameSheet(book(), renaming, to), 'all', true);
    renameBox.hidden = true;
    renaming = '';
    say(`Renamed. The formulas that reach into it follow.`);
  };
  const renameDelete = key('DELETE SHEET', () => {
    if (book().sheets.length < 2) return say('A workbook keeps at least one sheet.');
    if (deleteArmed !== renaming) {
      deleteArmed = renaming;
      renameDelete.textContent = 'TAP AGAIN TO DELETE';
      return say(`Tap again to delete ${renaming} and everything on it. UNDO would bring it back.`);
    }
    commit(removeSheet(book(), renaming), 'all', true);
    renameBox.hidden = true;
    say(`Deleted ${renaming}. Formulas that pointed at it show #REF!.`);
  });
  clear(renameBox, renameIn, key('RENAME', doRename, 'on'), renameDelete, key('CANCEL', () => {
    renameBox.hidden = true;
  }));
  renameIn.addEventListener('keydown', (e) => e.key === 'Enter' && doRename());
  const paintTabs = () => {
    clear(tabs);
    book().sheets.forEach((s, i) => {
      const b = h('button.shtab', { type: 'button', role: 'tab', 'aria-selected': String(i === si()), dataset: { sheet: s.name }, 'aria-label': `${s.name}: tap to open, hold to rename` }, s.name);
      let timer = 0;
      let long = false;
      let downAt = 0;
      const hold = () => {
        long = true;
        renaming = s.name;
        deleteArmed = '';
        renameDelete.textContent = 'DELETE SHEET';
        renameIn.value = s.name;
        renameBox.hidden = false;
        renameIn.focus();
        renameIn.select();
      };
      b.addEventListener('pointerdown', () => {
        long = false;
        downAt = performance.now();
        timer = window.setTimeout(hold, 650);
      });
      // (a busy phone may run the timer after the finger is up: the time held decides)
      b.addEventListener('pointerup', () => {
        clearTimeout(timer);
        if (!long && downAt && performance.now() - downAt >= 650) hold();
        downAt = 0;
      });
      for (const ev of ['pointerleave', 'pointercancel']) b.addEventListener(ev, () => {
        clearTimeout(timer);
        downAt = 0;
      });
      b.addEventListener('click', () => {
        if (long) return (long = false);
        if (i === si()) return;
        hist!.book = looking(hist!.book, { sheet: i, sel: 'A1' });
        rev++;
        A = { r: 0, c: 0 };
        B = A;
        closeColumn();
        refresh(true);
        schedule(false);
      });
      tabs.append(b);
    });
    tabs.append(key('ADD SHEET', () => {
      const b = addSheet(book());
      commit(looking(b, { sheet: b.sheets.length - 1, sel: 'A1' }), 'all', true);
      A = { r: 0, c: 0 };
      B = A;
      say(`${b.sheets[b.sheets.length - 1]!.name} added. UNDO takes it away.`);
    }));
  };

  // ---------------------------------------------------------------- charts under the grid
  const charts = h('div.shcharts');
  const paintCharts = () => {
    clear(charts);
    for (const c of book().charts.filter((x) => x.sheet === sheet().name)) {
      const s = chartSeries(book(), eng!, c);
      const fig = h('figure.shchart', h('figcaption', h('b', c.title)));
      if (s) fig.append(chartSvg(s, c.title));
      else fig.append(h('p.shnote', 'This chart’s cells have fewer than two numbers now.'));
      fig.append(h('div.shrow', key('REMOVE', () => {
        commit(removeChart(book(), c.id), []);
        say('The chart is off the sheet; the numbers stay.');
      }, '', `Remove the chart ${c.title}`)));
      charts.append(fig);
    }
  };

  // ---------------------------------------------------------------- the foot of the page: empty, meta, export, Ghosty
  const metaEl = h('p.shmeta');
  const empty = h('div.shempty');
  const paintEmpty = () => {
    empty.hidden = !isEmptyBook(book());
    if (empty.hidden) return;
    clear(empty, h('p', 'A blank sheet. Tap a cell and type, or start with a household budget I set up for you.'), key('START WITH A BUDGET', () => seedBudget(), 'on'));
  };
  const paintMeta = () => {
    const s = sheet();
    const f = s.filter;
    const rows = Math.max(usedRows(s) - 1, 0);
    const forms = Object.values(s.cells).filter((c) => c.f !== undefined).length;
    const shown = f ? visibleRows(s, f, eng!).length - 1 : rows;
    metaEl.textContent = `${s.name} · ${usedRows(s)} row${usedRows(s) === 1 ? '' : 's'} × ${usedCols(s)} column${usedCols(s) === 1 ? '' : 's'}${forms ? ` · ${forms} formula${forms === 1 ? '' : 's'}` : ''}${f ? ` · filter on ${colName(f.c)}: ${f.op === 'filled' ? 'not empty' : `${f.op === 'is' ? 'is' : f.op === 'contains' ? 'contains' : `is ${f.op}`} ${f.v}`}, ${shown} of ${rows} rows shown` : ''}`;
  };
  const sizeSpans = { xlsx: h('span.shsize', { dataset: { for: 'xlsx' } }), csv: h('span.shsize', { dataset: { for: 'csv' } }), pdf: h('span.shsize', { dataset: { for: 'pdf' } }) };
  const outs = h('div.shouts');
  const made = (kind: 'xlsx' | 'csv' | 'pdf'): { bytes: Uint8Array; name: string; type: string } => {
    const have = cache.get(kind);
    const stem = slug(book().title);
    const name = kind === 'csv' ? `${stem}-${slug(sheet().name)}.csv` : `${stem}.${kind}`;
    const type = kind === 'xlsx' ? MIME.xlsx! : kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf';
    if (have && have.rev === rev) return { bytes: have.bytes, name, type };
    const bytes = kind === 'xlsx' ? writeXlsx(book()) : kind === 'csv' ? new TextEncoder().encode(toCsv(book(), sheet().name)) : pdfOfBook(book());
    cache.set(kind, { rev, bytes });
    return { bytes, name, type };
  };
  const paintSizes = (all: boolean) => {
    try {
      sizeSpans.xlsx.textContent = sizeWords(made('xlsx').bytes.length);
      sizeSpans.csv.textContent = sizeWords(made('csv').bytes.length);
      if (all || cache.get('pdf')?.rev === rev) sizeSpans.pdf.textContent = sizeWords(made('pdf').bytes.length);
      else sizeSpans.pdf.textContent = 'working it out…';
    } catch {
      sizeSpans.xlsx.textContent = '';
    }
  };
  const doExport = (kind: 'xlsx' | 'csv' | 'pdf') => {
    say(`Making your ${kind === 'xlsx' ? 'Excel file' : kind === 'csv' ? 'CSV file' : 'PDF'} on this phone…`);
    setTimeout(() => {
      try {
        const m = made(kind);
        void shareOrSave(new Blob([m.bytes as BlobPart], { type: m.type }), m.name).then(() => {
          sheetsState.exported.push({ name: m.name, size: m.bytes.length, type: kind });
          outs.append(h('p.shout', `${m.name} · ${sizeWords(m.bytes.length)}`));
          say(`${m.name} is made (${sizeWords(m.bytes.length)}).${kind === 'xlsx' ? ' Opened in Excel or Numbers it works the same numbers out again.' : ''}`);
        });
      } catch (e) {
        say(sayError(e, 'make it'));
      }
    }, 0);
  };
  const exportRow = h('div.shexport',
    h('small.cvgh', 'EXPORT'),
    ...(['xlsx', 'csv', 'pdf'] as const).map((k) => h('div.shexrow', button(k.toUpperCase(), () => doExport(k)), sizeSpans[k])),
    h('p.shexportnote.shnote', 'The chart is in the PDF, the numbers are in the file. A CSV keeps the numbers and dates, not the £ and % look, and only this sheet.'),
    outs);
  const scheduleSizes = () => {
    clearTimeout(sizeTimer);
    sizeTimer = window.setTimeout(() => paintSizes(true), 1200);
  };

  // Ghosty in it
  const askIn = h('input', { type: 'text', 'aria-label': 'What should Ghosty write a formula for?', placeholder: 'What do you want worked out? (“the total of the bills”)', autocomplete: 'off', enterKeyHint: 'send' }) as HTMLInputElement;
  const sug = h('div.shsug', { 'aria-live': 'polite' });
  const paintSug = () => {
    clear(sug);
    if (!suggestion) return;
    const s = suggestion;
    const box = h('div.shsugbox', h('p', s.text));
    if (s.formula) box.append(h('code.shcode', s.formula), h('div.shrow', key('USE IT', () => {
      commit(setEntry(book(), sheet().name, aText(A), s.formula!), [`${sheet().name}!${aText(A)}`]);
      paintLine();
      suggestion = null;
      paintSug();
      say(`${s.formula} is in ${aText(A)}. UNDO takes it out.`);
    }, 'on'), key('DISMISS', () => {
      suggestion = null;
      paintSug();
    })));
    else if (s.edits) {
      // Ghosty's marked changes, each one his to accept or reject (every one shown: ACCEPT ALL never takes a change he did not see)
      const decided = (x: { a: string }) => {
        s.edits = s.edits!.filter((y) => y !== x);
        if (!s.edits.length) suggestion = null;
        paintSug();
      };
      box.append(h('ul.shedits', ...s.edits.map((x) => h('li', h('span.shedit', h('b', x.a), ' ', h('del', x.old), ' → ', h('ins', x.text)), h('div.shrow',
        key('ACCEPT', () => {
          commit(setEntry(book(), sheet().name, x.a, x.text), [`${sheet().name}!${x.a}`]);
          say(`${x.a} is now “${x.text}”. UNDO puts it back.`);
          decided(x);
        }, '', `Accept the change to ${x.a}`),
        key('REJECT', () => {
          say(`${x.a} stays “${x.old}”.`);
          decided(x);
        }, '', `Reject the change to ${x.a}`))))), h('div.shrow', key('ACCEPT ALL', () => {
        let next = book();
        for (const x of s.edits!) next = setEntry(next, sheet().name, x.a, x.text);
        commit(next, s.edits!.map((x) => `${sheet().name}!${x.a}`));
        suggestion = null;
        paintSug();
        say(`${s.edits!.length} cell${s.edits!.length === 1 ? '' : 's'} tidied. UNDO puts them back.`);
      }, 'on'), key('NO THANKS', () => {
        suggestion = null;
        paintSug();
      })));
    } else box.append(h('div.shrow', key('DISMISS', () => {
      suggestion = null;
      paintSug();
    })));
    sug.append(box);
  };
  const ctx = () => contextOf(book(), eng!, sheet().name, rectOf(A, B), aText(A));
  const askWith = async (message: string, wait: string) => {
    say(wait);
    try {
      return await askBrain(message, () => undefined, 'sheets');
    } catch (e) {
      say(sayError(e, 'ask'));
      return null;
    }
  };
  const explain = async () => {
    const r = await askWith(explainMessage(ctx()), 'Asking my brain what this cell does. The chosen cells go to it as this message’s data.');
    if (!r) return;
    suggestion = { kind: 'explain', text: sentenceFrom(r.text) || r.text.trim() };
    paintSug();
    say(`${r.where === 'phone' ? 'The brain on this phone' : 'My brain'} explained it.`);
  };
  const writeFormula = async () => {
    const r = await askWith(formulaMessage(askIn.value, ctx()), 'Asking my brain for a formula. Nothing changes until you tap USE IT.');
    if (!r) return;
    const f = formulaFrom(r.text);
    if (!f) return say('My brain didn’t give me a formula I can use. Try saying it another way.');
    suggestion = { kind: 'formula', text: sentenceFrom(r.text) || 'This should do it.', formula: f };
    paintSug();
    say(`A formula for ${aText(A)}: tap USE IT to put it in.`);
  };
  const cleanColumn = async () => {
    const g = rectOf(A, B);
    const items: { a: string; old: string }[] = [];
    for (let r = Math.max(g.r1, 1); r <= g.r2 && items.length < 40; r++)
      for (let c = g.c1; c <= g.c2 && items.length < 40; c++) {
        const cell = sheet().cells[addr(r, c)];
        if (cell && cell.f === undefined && typeof cell.v === 'string' && cell.v.trim()) items.push({ a: addr(r, c), old: cell.v });
      }
    if (!items.length) return say('Choose a column (tap its letter) that has words in it first.');
    const r = await askWith(cleanMessage(items.map((x) => x.old)), 'Asking my brain to tidy these words. Nothing changes until you accept.');
    if (!r) return;
    const got = numberedFrom(r.text, items.length);
    const edits = items.flatMap((x, i) => (got[i] && got[i] !== x.old ? [{ a: x.a, old: x.old, text: got[i]! }] : []));
    suggestion = { kind: 'clean', text: edits.length ? `${edits.length} of ${items.length} would change.` : 'My brain would leave every one as it is.', edits };
    paintSug();
    say(edits.length ? 'Each change is marked: ACCEPT or REJECT it, or ACCEPT ALL, or NO THANKS.' : 'Nothing to tidy.');
  };
  const askBox = h('div.shask', h('small.cvgh', 'GHOSTY IN IT'), h('div.shrow', askIn), h('div.shrow', key('EXPLAIN THIS CELL', () => void explain()), key('WRITE ME A FORMULA', () => void writeFormula(), 'on'), key('CLEAN THIS COLUMN', () => void cleanColumn())), sug);
  askIn.addEventListener('keydown', (e) => e.key === 'Enter' && void writeFormula());

  // ---------------------------------------------------------------- keeping the page's state for the checks
  const readOut = (sheetName: string, a: string) => {
    const s = book().sheets.find((x) => x.name === sheetName);
    const cell = s?.cells[a.toUpperCase()];
    return { v: eng!.value(sheetName, a), ...(cell?.f !== undefined ? { f: cell.f } : {}), text: eng!.text(sheetName, a) };
  };
  sheetsState.read = (s, a) => (hist ? readOut(s, a) : { v: null, text: '' });
  function refresh(structure: boolean): void {
    paintMeta();
    if (structure) {
      paintTabs();
      grid.paint();
    } else grid.paintCells();
    paintLine();
    paintCharts();
    paintEmpty();
    paintFormatKeys();
    closeIfStale();
    sheetsState.view = 'book';
    sheetsState.title = book().title;
    sheetsState.sheets = book().sheets.map((s) => s.name);
    sheetsState.active = sheet().name;
    sheetsState.json = countCells(book()) < 20_000 ? JSON.stringify(book()) : '';
    paintSizes(false);
    scheduleSizes();
  }
  const closeIfStale = () => {
    if (colOpen >= 0 && !sheet().cells && colOpen >= MAXC) closeColumn();
  };

  // ---------------------------------------------------------------- MY SPREADSHEETS
  const seedBudget = () => {
    const t0 = performance.now();
    const b = budget(new Date().getFullYear());
    if (hist && isEmptyBook(book())) {
      commit({ ...b, id: book().id, title: b.title }, 'all', true);
      A = { r: 0, c: 0 };
      B = A;
      paintLine();
    } else {
      saveBook(b);
      showBook(b);
    }
    say(`A household budget: twelve months and a summary, made in ${Math.round(performance.now() - t0)} ms. Change a rent and watch the year move.`);
    sheetsState.opened = Math.round(performance.now() - t0);
  };
  const showList = () => {
    clearTimeout(saveTimer);
    if (hist) keep(false);
    hist = null;
    eng = null;
    closeColumn();
    sheetsState.view = 'list';
    const books = listBooks();
    sheetsState.kept = books.length;
    clear(view,
      h('h3.shh3', 'MY SPREADSHEETS'),
      books.length
        ? h('div.shlist', ...books.map((b) => h('div.shrowitem', button(h('span.shdoc', h('b', b.title), h('small', `${b.sheets.length} sheet${b.sheets.length === 1 ? '' : 's'} · ${countCells(b).toLocaleString('en-GB')} cells · ${whenWords(b.at)}`)), () => showBook(getBook(b.id) ?? b), 'shopen'), key('REMOVE', () => {
          removeBook(b.id);
          say(`Removed “${b.title}” from this phone.`);
          showList();
        }, 'shremove', `Remove ${b.title} from my spreadsheets`))))
        : h('div.shempty', h('p', 'No spreadsheets yet. Start with a household budget I set up for you, make a blank sheet, or open an Excel or CSV file.'), key('START WITH A BUDGET', () => seedBudget(), 'on')),
      books.length ? h('div.shrow', key('START WITH A BUDGET', () => seedBudget(), '', 'Start a new household budget')) : null);
    say(books.length ? `${books.length} spreadsheet${books.length === 1 ? '' : 's'}, kept on this phone only.` : '');
  };

  function showBook(b: Book): void {
    clearTimeout(saveTimer);
    hist = new History(b);
    eng = new Engine(b);
    cache.clear();
    A = clampPos(posOf(b.view.sel));
    B = A;
    zoom = 1;
    sheetsState.zoom = 1;
    suggestion = null;
    colOpen = -1;
    colMenu.hidden = true;
    findHits = [];
    const title = h('input.shtitle', { type: 'text', value: b.title, 'aria-label': 'The spreadsheet’s name', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
    title.addEventListener('change', () => {
      commit(retitle(book(), title.value.trim() || 'Untitled spreadsheet'), []);
    });
    const tools = h('div.shtools', { role: 'toolbar', 'aria-label': 'Editing' },
      key('UNDO', undo), key('REDO', redo), key('Σ', sum, 'shsum', 'AutoSum: add up the numbers'),
      key('FIND', () => {
        findBox.hidden = !findBox.hidden;
        if (!findBox.hidden) findIn.focus();
      }),
      key('−', () => host.setZoom(zoom - 0.15), 'shzoom', 'Zoom out'), key('+', () => host.setZoom(zoom + 0.15), 'shzoom', 'Zoom in'));
    for (const bar of [tools, pills, fns, ...Object.values(panels), colMenu]) {
      bar.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      });
    }
    clear(view, title, metaEl, savedEl, offline, h('p.shsaid', { 'aria-live': 'polite' }), empty,
      h('div.shfbar', addrIn, line), fns, errLine, colMenu, grid.el, tabs, renameBox, tools, findBox, pills, ...Object.values(panels), charts, exportRow, askBox,
      h('div.shrow', key('REMOVE FROM MY SPREADSHEETS', () => {
        removeBook(book().id);
        say(`Removed “${book().title}” from this phone.`);
        showList();
      })));
    showPanel(panel);
    sheetsState.opened = 0;
    refresh(true);
    grid.reveal(A);
    keep(false);
  }

  // ---------------------------------------------------------------- opening files and answers
  const importFile = async (f: File) => {
    say(`Reading ${f.name} on this phone…`);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const t0 = performance.now();
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
      let b: Book;
      let lost: string[] = [];
      if (isZip || /\.xlsx$/i.test(f.name)) {
        const r = readXlsx(bytes, fileTitle(f.name));
        b = r.book;
        lost = r.lost;
      } else if (/\.xls$/i.test(f.name)) throw new Error('that is an old .xls file: save it as .xlsx from Excel first, and I can read it');
      else b = { ...fromCsv(new TextDecoder().decode(bytes), fileTitle(f.name)) };
      b = { ...b, title: fileTitle(f.name) };
      saveBook(b);
      showBook(b);
      sheetsState.lost = lost;
      sheetsState.opened = Math.round(performance.now() - t0);
      const said = view.querySelector('.shsaid');
      const kept = `${b.sheets.length} sheet${b.sheets.length === 1 ? '' : 's'}, ${countCells(b).toLocaleString('en-GB')} cells`;
      if (said) said.textContent = lost.length ? `I opened ${f.name} (${kept}). I could not keep: ${lost.join('; ')}.` : `I opened ${f.name}: ${kept}, nothing left out.`;
      say(`${f.name} is open${lost.length ? ' (what I could not keep is said under the title)' : ''}. Nothing was sent anywhere.`);
    } catch (e) {
      say(sayError(e, 'read it'));
    }
  };
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (f) await importFile(f);
  });
  const bar = h('div.shbar', button('MY SPREADSHEETS', showList), button('NEW', () => {
    const b = newBook('New spreadsheet');
    b.from = 'made here';
    saveBook(b);
    showBook(b);
    say('A blank workbook. Tap a cell and type, or start with a budget.');
  }), key('IMPORT', () => fileIn.click(), '', 'Open an Excel or CSV file'), fileIn);
  const root = h('div.shsheet', bar, status, view);
  const start = async (o: SheetsAsk) => {
    if (o.book) {
      saveBook(o.book);
      showBook(o.book);
    } else if (o.table) {
      const b = bookFromTable(o.title || 'From an answer', o.table);
      saveBook(b);
      showBook(b);
      say(`Your answer’s table is a sheet now: ${o.table.length - 1} row${o.table.length === 2 ? '' : 's'}, kept on this phone.`);
    } else if (o.id && getBook(o.id)) showBook(getBook(o.id)!);
    else if (o.what === 'new') (bar.children[1] as HTMLButtonElement).click();
    else if (o.what === 'budget') seedBudget();
    else if (o.what === 'import') {
      showList();
      fileIn.click();
    } else showList();
  };
  return {
    el: root,
    start,
    stop: () => {
      flush();
      clearTimeout(sizeTimer);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', flush);
      removeEventListener('online', onNet);
      removeEventListener('offline', onNet);
    },
  };
}
export { toast };
