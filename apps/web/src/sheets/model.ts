/**
 * THE WORKBOOK (BRIEF-EDITOR-SPREADSHEETS; MAKE → SPREADSHEETS): named sheets of cells by address (A1 style, up to AZ and 10,000 rows, sparse);
 * a cell holds a value (number, text, true or false, a date as the serial Excel keeps, an error) or a formula; its format (number, £, %, date,
 * text, decimals, bold, italic, alignment, a fill from the house's own five colours); column widths, row heights, the frozen first row, a filter;
 * named ranges and charts; and a History for undo across every change. Everything here is immutable: a change makes a new workbook sharing what
 * it did not touch, so undo is a step back, not a copy of everything. The formulas are worked out by formula.ts's Engine; nothing here knows how.
 */
import { addr, colName, MAXC, MAXR, parseAddr, parseRange, renameSheetIn, shiftFormula, type Pos, type Rect } from './tokens';
import { applyCode, general, serialOf } from './numfmt';

export type ErrCode = '#DIV/0!' | '#REF!' | '#NAME?' | '#VALUE!' | '#N/A' | '#NUM!' | '#CALC!' | '#SPILL!' | '#CIRCULAR!';
export interface ErrVal {
  e: ErrCode;
}
export type Val = number | string | boolean | null | ErrVal;
export const isErr = (v: unknown): v is ErrVal => typeof v === 'object' && v !== null && 'e' in v;
export const err = (e: ErrCode): ErrVal => ({ e });

export interface Fmt {
  n?: 'number' | 'currency' | 'percent' | 'date' | 'text';
  d?: number;
  b?: 1;
  i?: 1;
  a?: 'l' | 'c' | 'r';
  fill?: 1 | 2 | 3 | 4 | 5;
  /** A number shown without thousands separators (as a file may have it). */
  k?: 1;
}
export interface Cell {
  v?: Val;
  f?: string;
  x?: Fmt;
}
export interface Filter {
  c: number;
  op: 'over' | 'under' | 'is' | 'contains' | 'filled';
  v: string;
}
export interface Sheet {
  name: string;
  cells: Record<string, Cell>;
  widths: Record<number, number>;
  heights: Record<number, number>;
  frozen: boolean;
  filter?: Filter | null;
}
export interface Chart {
  id: string;
  sheet: string;
  kind: 'bars' | 'line';
  title: string;
  /** Where its labels are ("A2:A13") and where its numbers are ("D2:D13"), on its own sheet. */
  labels: string | null;
  values: string;
}
export interface Book {
  id: string;
  title: string;
  at: number;
  sheets: Sheet[];
  names: Record<string, string>;
  charts: Chart[];
  view: { sheet: number; sel: string };
  /** Where it came from, for the list ("made here", "read from a file", "from an answer"). */
  from?: string;
}
export { addr, colName, MAXC, MAXR, parseAddr, parseRange, shiftFormula };
export type { Pos, Rect };

export const COL_PX = 96;
let counter = 0;
const uid = (): string => `sh${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptySheet = (name: string): Sheet => ({ name, cells: {}, widths: {}, heights: {}, frozen: false });
export function newBook(title = 'Untitled spreadsheet'): Book {
  return { id: uid(), title, at: Date.now(), sheets: [emptySheet('Sheet1')], names: {}, charts: [], view: { sheet: 0, sel: 'A1' } };
}
export const sheetIndex = (b: Book, name: string): number => b.sheets.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
const sheetOf = (b: Book, name: string | number): number => (typeof name === 'number' ? name : sheetIndex(b, name));

// ---------------------------------------------------------------- what he types
const NUM = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUM_COMMAS = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const decimalsOf = (s: string): number => (s.split('.')[1] ?? '').replace(/\D.*$/, '').length;

/** A date as typed (5/3/2024, 5-3-24, 2024-03-05), as a serial, or null. Day first, as he writes it. */
export function dateEntry(t: string): number | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  let y: number;
  let mo: number;
  let d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
    if (m[3]!.length === 2) y += y < 30 ? 2000 : 1900;
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 9999) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return serialOf(y, mo, d);
}

/** What he typed into a cell, as a cell: null when it is nothing. `=` starts a formula, `'` makes text, and £, % and dates bring their format. */
export function entry(text: string): Cell | null {
  if (text === '') return null;
  if (text.startsWith("'")) return { v: text.slice(1), x: { n: 'text' } };
  const t = text.trim();
  if (t.startsWith('=') && t.length > 1) return { f: t.slice(1) };
  if (t === '') return { v: text };
  if (NUM.test(t)) return { v: Number(t) };
  if (NUM_COMMAS.test(t)) return { v: Number(t.replace(/,/g, '')) };
  let m: RegExpExecArray | null;
  if ((m = /^([+-]?)(\d+(?:\.\d+)?)%$/.exec(t))) return { v: Number(`${m[1]}${m[2]}`) / 100, x: { n: 'percent', ...(decimalsOf(m[2]!) !== 2 ? { d: decimalsOf(m[2]!) } : {}) } };
  if ((m = /^([+-]?)£\s?(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?$/.exec(t))) {
    const dp = m[3] ? m[3].length - 1 : 2;
    return { v: Number(`${m[1]}${m[2]!.replace(/,/g, '')}${m[3] ?? ''}`), x: { n: 'currency', ...(dp !== 2 ? { d: dp } : {}) } };
  }
  const date = dateEntry(t);
  if (date !== null) return { v: date, x: { n: 'date' } };
  if (/^(true|false)$/i.test(t)) return { v: t.toLowerCase() === 'true' };
  if (/^#(?:DIV\/0!|REF!|NAME\?|VALUE!|N\/A|NUM!)$/i.test(t)) return { v: err(t.toUpperCase() as ErrCode) };
  return { v: text };
}

/** The Excel format code a format stands for. */
export function fmtCode(x: Fmt | undefined): string {
  if (!x?.n) return 'General';
  const d = x.d ?? 2;
  const dec = d > 0 ? `.${'0'.repeat(d)}` : '';
  switch (x.n) {
    case 'number':
      return x.k ? `0${dec}` : `#,##0${dec}`;
    case 'currency':
      return `£#,##0${dec}`;
    case 'percent':
      return `0${dec}%`;
    case 'date':
      return 'd mmm yyyy';
    default:
      return '@';
  }
}
/** A value as the cell shows it. */
export function formatValue(v: Val, x?: Fmt): string {
  if (v === null || v === undefined) return '';
  if (isErr(v)) return v.e;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  if (!x?.n || x.n === 'text') return general(v);
  return applyCode(v, fmtCode(x));
}
/** What the formula line shows for a cell, so editing it and pressing Enter changes nothing. */
export function cellInput(c: Cell | undefined | null): string {
  if (!c) return '';
  if (c.f !== undefined) return `=${c.f}`;
  const v = c.v;
  if (v === null || v === undefined) return '';
  if (isErr(v)) return v.e;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') {
    const again = entry(v);
    return again && again.v === v && !again.x && again.f === undefined ? v : again === null ? v : `'${v}`;
  }
  const n = c.x?.n;
  if (n === 'percent') return `${Number((v * 100).toPrecision(12))}%`;
  if (n === 'currency') return applyCode(v, `£#,##0.00`);
  if (n === 'date') return applyCode(v, 'dd/mm/yyyy');
  return String(Number(v.toPrecision(15)));
}

// ---------------------------------------------------------------- changes
const withSheet = (b: Book, i: number, s: Sheet): Book => ({ ...b, at: Date.now(), sheets: b.sheets.map((x, k) => (k === i ? s : x)) });

/** A cell set to what he typed (its own format kept, as Excel keeps it; typing nothing leaves just the format). */
export function setEntry(b: Book, sheet: string | number, a: string, text: string): Book {
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  if (!s) return b;
  const p = parseAddr(a);
  if (!p || p.r >= MAXR || p.c >= MAXC) return b;
  const key = addr(p.r, p.c);
  const prev = s.cells[key];
  const next = entry(text);
  const cells = { ...s.cells };
  if (!next) {
    if (prev?.x) cells[key] = { x: prev.x };
    else delete cells[key];
  } else {
    const x = { ...prev?.x, ...next.x };
    if (next.x?.n === undefined && prev?.x?.n === 'text' && typeof next.v !== 'string' && next.f === undefined) delete x.n;
    cells[key] = { ...next, ...(Object.keys(x).length ? { x } : {}) };
  }
  return withSheet(b, i, { ...s, cells });
}
/** Several cells at once, as typed: [address, text]. */
export function setEntries(b: Book, sheet: string | number, items: [string, string][]): Book {
  return items.reduce((book, [a, t]) => setEntry(book, sheet, a, t), b);
}
/** The cells of a range given this much format (the pieces merge; `n: undefined` clears the number format). */
export function setFormat(b: Book, sheet: string | number, range: string, patch: Partial<Fmt> | null): Book {
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  const g = parseRange(range);
  if (!s || !g) return b;
  const cells = { ...s.cells };
  const last = Math.min(g.r2, Math.max(usedRows(s), g.r1) + 100, MAXR - 1);
  for (let r = g.r1; r <= last; r++) {
    for (let c = g.c1; c <= Math.min(g.c2, MAXC - 1); c++) {
      const k = addr(r, c);
      const prev = cells[k] ?? {};
      let x: Fmt | undefined;
      if (patch === null) x = undefined;
      else {
        const merged: Record<string, unknown> = { ...prev.x, ...patch };
        for (const [key, val] of Object.entries(merged)) if (val === undefined || val === null) delete merged[key];
        x = Object.keys(merged).length ? (merged as Fmt) : undefined;
      }
      const { x: _x, ...rest } = prev;
      void _x;
      const cell = x ? { ...rest, x } : rest;
      if (Object.keys(cell).length) cells[k] = cell;
      else delete cells[k];
    }
  }
  return withSheet(b, i, { ...s, cells });
}
export const usedRows = (s: Sheet): number => {
  let m = 0;
  for (const k of Object.keys(s.cells)) {
    const p = parseAddr(k);
    if (p && p.r + 1 > m) m = p.r + 1;
  }
  return m;
};
export const usedCols = (s: Sheet): number => {
  let m = 0;
  for (const k of Object.keys(s.cells)) {
    const p = parseAddr(k);
    if (p && p.c + 1 > m) m = p.c + 1;
  }
  return m;
};
export const isEmptyBook = (b: Book): boolean => b.sheets.every((s) => !Object.values(s.cells).some((c) => c.v !== undefined || c.f !== undefined));

export function setWidth(b: Book, sheet: string | number, col: number, px: number): Book {
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  if (!s) return b;
  return withSheet(b, i, { ...s, widths: { ...s.widths, [col]: Math.max(40, Math.min(480, Math.round(px))) } });
}
export function setFrozen(b: Book, sheet: string | number, on: boolean): Book {
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  return s ? withSheet(b, i, { ...s, frozen: on }) : b;
}
export function setFilter(b: Book, sheet: string | number, f: Filter | null): Book {
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  return s ? withSheet(b, i, { ...s, filter: f }) : b;
}
export function setName(b: Book, name: string, ref: string | null): Book {
  const names = { ...b.names };
  if (ref === null) delete names[name];
  else names[name] = ref;
  return { ...b, at: Date.now(), names };
}
export const validName = (n: string): boolean => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(n) && !parseAddr(n) && !/^(true|false)$/i.test(n);

/** A sheet added at the end ("Sheet2", or the name given when it is free). */
export function addSheet(b: Book, name?: string): Book {
  let n = name?.trim() || '';
  if (!n || sheetIndex(b, n) >= 0) {
    let k = b.sheets.length + 1;
    while (sheetIndex(b, `Sheet${k}`) >= 0) k++;
    n = name?.trim() && sheetIndex(b, name.trim()) < 0 ? name.trim() : `Sheet${k}`;
  }
  return { ...b, at: Date.now(), sheets: [...b.sheets, emptySheet(n)] };
}
export const sheetNameProblem = (b: Book, name: string, except = -1): string => {
  const n = name.trim();
  if (!n) return 'A sheet needs a name.';
  if (n.length > 31) return 'A sheet’s name is 31 letters at most.';
  if (/[[\]:*?/\\]/.test(n)) return 'A sheet’s name can’t hold [ ] : * ? / or \\.';
  const at = sheetIndex(b, n);
  if (at >= 0 && at !== except) return `There is a sheet called ${b.sheets[at]!.name} already.`;
  return '';
};
/** A sheet renamed, and every formula, name and chart that reached into it follows. */
export function renameSheet(b: Book, from: string, to: string): Book {
  const i = sheetIndex(b, from);
  if (i < 0 || sheetNameProblem(b, to, i)) return b;
  const fix = (f: string) => renameSheetIn(f, b.sheets[i]!.name, to.trim());
  const sheets = b.sheets.map((s, k) => {
    const cells: Record<string, Cell> = {};
    for (const [a, c] of Object.entries(s.cells)) cells[a] = c.f !== undefined ? { ...c, f: fix(c.f) } : c;
    return { ...s, name: k === i ? to.trim() : s.name, cells };
  });
  const names = Object.fromEntries(Object.entries(b.names).map(([k, v]) => [k, fix(v)]));
  const charts = b.charts.map((c) => (c.sheet.toLowerCase() === b.sheets[i]!.name.toLowerCase() ? { ...c, sheet: to.trim() } : c));
  return { ...b, at: Date.now(), sheets, names, charts };
}
/** A sheet taken out (the last one stays); formulas that reached into it say #REF!. */
export function removeSheet(b: Book, name: string): Book {
  const i = sheetIndex(b, name);
  if (i < 0 || b.sheets.length < 2) return b;
  const gone = b.sheets[i]!.name;
  const sheets = b.sheets
    .filter((_, k) => k !== i)
    .map((s) => ({ ...s, cells: Object.fromEntries(Object.entries(s.cells).map(([a, c]) => [a, c.f !== undefined ? { ...c, f: renameSheetIn(c.f, gone, '') } : c])) }));
  const names = Object.fromEntries(Object.entries(b.names).filter(([, v]) => !v.toLowerCase().startsWith(`${gone.toLowerCase()}!`)));
  return { ...b, at: Date.now(), sheets, names, charts: b.charts.filter((c) => c.sheet !== gone), view: { ...b.view, sheet: Math.min(b.view.sheet, sheets.length - 1) } };
}
export const addChart = (b: Book, c: Omit<Chart, 'id'>): Book => ({ ...b, at: Date.now(), charts: [...b.charts, { ...c, id: uid() }] });
export const removeChart = (b: Book, id: string): Book => ({ ...b, at: Date.now(), charts: b.charts.filter((c) => c.id !== id) });
export const retitle = (b: Book, title: string): Book => ({ ...b, title, at: Date.now() });
export const looking = (b: Book, view: Partial<Book['view']>): Book => ({ ...b, view: { ...b.view, ...view } });
/** Cells cleared (their format stays). */
export function clearRange(b: Book, sheet: string | number, range: string): Book {
  const g = parseRange(range);
  const i = sheetOf(b, sheet);
  const s = b.sheets[i];
  if (!g || !s) return b;
  const cells = { ...s.cells };
  for (const k of Object.keys(cells)) {
    const p = parseAddr(k)!;
    if (p.r >= g.r1 && p.r <= g.r2 && p.c >= g.c1 && p.c <= g.c2) {
      if (cells[k]!.x) cells[k] = { x: cells[k]!.x };
      else delete cells[k];
    }
  }
  return withSheet(b, i, { ...s, cells });
}

// ---------------------------------------------------------------- undo
/** Sixty steps back and forward through whole workbooks (each shares what it did not change). */
export class History {
  private past: Book[] = [];
  private future: Book[] = [];
  constructor(public book: Book) {}
  push(next: Book): void {
    this.past.push(this.book);
    if (this.past.length > 60) this.past.shift();
    this.book = next;
    this.future = [];
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  undo(): Book | null {
    const p = this.past.pop();
    if (!p) return null;
    this.future.push(this.book);
    this.book = p;
    return p;
  }
  redo(): Book | null {
    const n = this.future.pop();
    if (!n) return null;
    this.past.push(this.book);
    this.book = n;
    return n;
  }
}

// ---------------------------------------------------------------- tables in
/** A workbook from a table of words (an answer's table, a pasted block): the first row its header, numbers and £ read as such. */
export function bookFromTable(title: string, rows: string[][], from = 'from an answer'): Book {
  let b = newBook(title);
  b = { ...b, from };
  const w = Math.max(...rows.map((r) => r.length), 1);
  const cells: Record<string, Cell> = {};
  const widths: Record<number, number> = {};
  rows.slice(0, MAXR).forEach((row, r) => {
    row.slice(0, MAXC).forEach((t, c) => {
      const cell = entry(t.trim());
      if (!cell) return;
      cells[addr(r, c)] = r === 0 ? { ...cell, x: { ...cell.x, b: 1 } } : cell;
      widths[c] = Math.max(widths[c] ?? COL_PX, Math.min(260, t.length * 9 + 24));
    });
  });
  void w;
  return { ...b, sheets: [{ ...b.sheets[0]!, cells, widths, frozen: true }] };
}

// ---------------------------------------------------------------- the household budget (the benchmark's seed)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Twelve monthly sheets (income, rent, bills, food, travel, the rest, a totals row of SUMs, a difference line) and a Summary of one line a month, reaching into each, a year total, a VLOOKUP and a chart. */
export function budget(year = new Date().getFullYear()): Book {
  const heating = [18, 14, 8, 0, 0, 0, 0, 0, 0, 6, 12, 20];
  const months: Sheet[] = MONTH_NAMES.map((name, m) => {
    const cells: Record<string, Cell> = {};
    const head = ['Week', 'Income', 'Rent', 'Bills', 'Food', 'Travel', 'The rest', 'Out'];
    head.forEach((t, c) => (cells[addr(0, c)] = { v: t, x: { b: 1, ...(c ? { a: 'r' as const } : {}) } }));
    const rows = [
      [1200, 950, 62 + heating[m]!, 85 + (m % 3) * 4, 24, 40 + (m === 11 ? 60 : 0)],
      [0, 0, 48, 92, 18, 55],
      [1200, 0, 35, 78, 30 + (m === 6 || m === 7 ? 40 : 0), 35],
      [0, 0, 71, 88 + (m % 2) * 6, 22, 60 + (m === 11 ? 90 : 0)],
    ];
    rows.forEach((row, k) => {
      cells[addr(k + 1, 0)] = { v: `Week ${k + 1}` };
      row.forEach((v, c) => (cells[addr(k + 1, c + 1)] = { v, x: { n: 'currency', d: 0 } }));
      cells[addr(k + 1, 7)] = { f: `SUM(C${k + 2}:G${k + 2})`, x: { n: 'currency', d: 0 } };
    });
    cells.A6 = { v: 'Total', x: { b: 1 } };
    for (let c = 1; c <= 7; c++) cells[addr(5, c)] = { f: `SUM(${colName(c)}2:${colName(c)}5)`, x: { n: 'currency', d: 0, b: 1 } };
    cells.A7 = { v: 'Difference', x: { b: 1 } };
    cells.B7 = { f: 'B6-H6', x: { n: 'currency', d: 0, b: 1, fill: 2 } };
    return { name, cells, widths: { 0: 110, 1: 96, 2: 96, 3: 96, 4: 96, 5: 96, 6: 104, 7: 96 }, heights: {}, frozen: true };
  });
  const cells: Record<string, Cell> = {};
  ['Month', 'Income', 'Out', 'Left'].forEach((t, c) => (cells[addr(0, c)] = { v: t, x: { b: 1, ...(c ? { a: 'r' as const } : {}) } }));
  MONTH_NAMES.forEach((name, m) => {
    cells[addr(m + 1, 0)] = { v: name };
    cells[addr(m + 1, 1)] = { f: `${name}!B6`, x: { n: 'currency', d: 0 } };
    cells[addr(m + 1, 2)] = { f: `${name}!H6`, x: { n: 'currency', d: 0 } };
    cells[addr(m + 1, 3)] = { f: `B${m + 2}-C${m + 2}`, x: { n: 'currency', d: 0 } };
  });
  cells.A14 = { v: 'Year', x: { b: 1 } };
  for (const c of [1, 2, 3]) cells[addr(13, c)] = { f: `SUM(${colName(c)}2:${colName(c)}13)`, x: { n: 'currency', d: 0, b: 1, fill: 2 } };
  cells.F1 = { v: 'Look up a month', x: { b: 1 } };
  cells.G1 = { v: 'March', x: { fill: 1 } };
  cells.F2 = { v: 'What is left in it' };
  cells.G2 = { f: 'VLOOKUP(G1,$A$2:$D$13,4,FALSE)', x: { n: 'currency', d: 0 } };
  const summary: Sheet = { name: 'Summary', cells, widths: { 0: 110, 1: 96, 2: 96, 3: 96, 4: 24, 5: 150, 6: 96 }, heights: {}, frozen: true };
  const b = newBook(`Household budget ${year}`);
  return {
    ...b,
    from: 'a household budget made here',
    sheets: [summary, ...months],
    charts: [{ id: uid(), sheet: 'Summary', kind: 'bars', title: 'What is left each month', labels: 'A2:A13', values: 'D2:D13' }],
    view: { sheet: 0, sel: 'A1' },
  };
}
