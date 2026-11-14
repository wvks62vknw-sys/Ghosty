/**
 * ONE-TAP TABLE SUMMARIES (NEXT ROUND, editors.u3; Excel's and Numbers' pivot tables, made plain): a table (a header row and rows under it) is
 * summed, counted or averaged BY a column: each month of a date column, or each value of any other column. The summary is a sheet of its own,
 * each figure a real formula (SUMIFS, COUNTIFS, AVERAGEIFS over the table) so it follows the numbers; and when the table gains a row, a new
 * shop or a new month, the summary's rows are made again (refreshPivots, after every change), so it is never stale. A chart of it follows too.
 * Pure: values come from the engine through `value`.
 */
import { addr, colName, emptySheet, sheetIndex, usedCols, type Book, type Chart, type Sheet, type Val } from './model';
import { dateOf, serialOf } from './numfmt';
import { dataEnd } from './ops';
import { parseRange } from './tokens';

export type PivotHow = 'sum' | 'count' | 'average';
export interface Pivot {
  id: string;
  /** The table's sheet. */
  src: string;
  /** Its header row (0-based) and its columns (0-based, inclusive); its rows run from under the header to the end of the data. */
  head: number;
  c1: number;
  c2: number;
  /** The column it is summed BY, and whether by month (a date column). */
  by: number;
  month: boolean;
  /** The column of numbers it sums or averages (a count needs none). */
  of: number | null;
  how: PivotHow;
  /** The summary's own sheet. */
  sheet: string;
}
type ValueOf = (sheet: string, a: string) => Val;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOW_WORDS: Record<PivotHow, string> = { sum: 'Total', count: 'Count', average: 'Average' };
const q = (name: string): string => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);
let seq = 0;
export const pivotId = (): string => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

/** The table around what is chosen: the range itself when it is more than one cell, else the sheet's used block. Null when there is no table. */
export function tableOf(s: Sheet, range: string): { head: number; c1: number; c2: number } | null {
  const g = parseRange(range);
  if (g && g.r2 > g.r1) return { head: g.r1, c1: g.c1, c2: g.c2 };
  const cols = usedCols(s);
  return cols > 0 && dataEnd(s) >= 2 ? { head: 0, c1: 0, c2: cols - 1 } : null;
}

/** The table's header words, one for each column ("Column C" where a header is blank). */
export function headersOf(s: Sheet, t: { head: number; c1: number; c2: number }, value: ValueOf): { c: number; name: string; dates: boolean; numbers: boolean }[] {
  const out: { c: number; name: string; dates: boolean; numbers: boolean }[] = [];
  const end = Math.min(dataEnd(s), t.head + 400);
  for (let c = t.c1; c <= t.c2; c++) {
    const hv = value(s.name, addr(t.head, c));
    let nums = 0;
    let dates = 0;
    let filled = 0;
    for (let r = t.head + 1; r < end; r++) {
      const v = value(s.name, addr(r, c));
      if (v === null || v === '') continue;
      filled++;
      if (typeof v === 'number') {
        nums++;
        if (s.cells[addr(r, c)]?.x?.n === 'date') dates++;
      }
    }
    out.push({ c, name: typeof hv === 'string' && hv.trim() ? hv.trim() : `Column ${colName(c)}`, dates: filled > 0 && dates === filled, numbers: filled > 0 && nums === filled });
  }
  return out;
}

/** The groups the table has BY its column, in order: months oldest first, else as they first appear. Each with its label and its criteria. */
export function groupsOf(b: Book, p: Pivot, value: ValueOf): { label: string; crit: string[] }[] {
  const si = sheetIndex(b, p.src);
  const s = b.sheets[si];
  if (!s) return [];
  const end = dataEnd(s);
  if (p.month) {
    const months = new Set<number>();
    for (let r = p.head + 1; r < end; r++) {
      const v = value(s.name, addr(r, p.by));
      if (typeof v === 'number' && v >= 1) {
        const d = dateOf(v);
        months.add(d.y * 12 + d.m - 1);
      }
    }
    return [...months].sort((x, y) => x - y).map((k) => {
      const y = Math.floor(k / 12);
      const m = (k % 12) + 1;
      const from = serialOf(y, m, 1);
      const to = m === 12 ? serialOf(y + 1, 1, 1) : serialOf(y, m + 1, 1);
      return { label: `${MONTHS[m - 1]} ${y}`, crit: [`">=${from}"`, `"<${to}"`] };
    });
  }
  const seen = new Map<string, string>();
  for (let r = p.head + 1; r < end; r++) {
    const v = value(s.name, addr(r, p.by));
    if (v === null || v === '' || typeof v === 'object') continue;
    const label = String(v).trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()].map((label) => ({ label, crit: [`"${label.replace(/"/g, '""')}"`] }));
}

/** The summary sheet's cells for a pivot: the header, a row for each group (each figure a formula over the table), and a total row. */
export function pivotCells(b: Book, p: Pivot, value: ValueOf): { sheet: Sheet; rows: number } {
  const s = b.sheets[sheetIndex(b, p.src)]!;
  const end = Math.max(dataEnd(s), p.head + 2);
  const col = (c: number) => `${q(s.name)}!$${colName(c)}$${p.head + 2}:$${colName(c)}$${end}`;
  const byRef = col(p.by);
  const ofRef = p.of !== null ? col(p.of) : byRef;
  const heads = headersOf(s, p, value);
  const name = (c: number) => heads.find((x) => x.c === c)?.name ?? `Column ${colName(c)}`;
  const groups = groupsOf(b, p, value);
  const cells: Sheet['cells'] = {
    A1: { v: p.month ? 'Month' : name(p.by), x: { b: 1 } },
    B1: { v: p.how === 'count' ? 'Count' : `${HOW_WORDS[p.how]} of ${name(p.of ?? p.by)}`, x: { b: 1, a: 'r' } },
  };
  const money = p.of !== null && s.cells[addr(p.head + 1, p.of)]?.x?.n === 'currency';
  const fmt = p.how === 'count' ? undefined : money ? { n: 'currency' as const } : { n: 'number' as const, d: 2 };
  groups.forEach((g, i) => {
    const r = i + 1;
    const pairs = g.crit.map((c) => `${byRef},${c}`).join(',');
    const f = p.how === 'sum' ? `SUMIFS(${ofRef},${pairs})` : p.how === 'count' ? `COUNTIFS(${pairs})` : `IFERROR(AVERAGEIFS(${ofRef},${pairs}),0)`;
    cells[addr(r, 0)] = { v: g.label };
    cells[addr(r, 1)] = { f, ...(fmt ? { x: fmt } : {}) };
  });
  const last = groups.length;
  const tr = last + 1;
  cells[addr(tr, 0)] = { v: p.how === 'average' ? 'All' : 'Total', x: { b: 1 } };
  cells[addr(tr, 1)] = { f: last ? (p.how === 'average' ? `IFERROR(AVERAGE(${ofRef}),0)` : `SUM(B2:B${last + 1})`) : '0', x: { b: 1, ...(fmt ?? {}) } };
  return { sheet: { ...emptySheet(p.sheet), cells, widths: { 0: 160, 1: 150 }, frozen: true }, rows: last };
}

/** A name for a new summary sheet ("Summary", "Summary 2", …). */
export function summaryName(b: Book, base = 'Summary'): string {
  if (sheetIndex(b, base) < 0) return base;
  for (let n = 2; ; n++) if (sheetIndex(b, `${base} ${n}`) < 0) return `${base} ${n}`;
}

/** The workbook with a new summary added (its sheet after the table's, and chosen). */
export function addPivot(b: Book, p: Omit<Pivot, 'id' | 'sheet'>, value: ValueOf): { book: Book; pivot: Pivot; rows: number } {
  const pivot: Pivot = { ...p, id: pivotId(), sheet: summaryName(b) };
  const withPivots = { ...b, pivots: [...(b.pivots ?? []), pivot] };
  const { sheet, rows } = pivotCells(withPivots, pivot, value);
  const at = sheetIndex(b, p.src) + 1;
  const sheets = [...b.sheets.slice(0, at), sheet, ...b.sheets.slice(at)];
  return { book: { ...withPivots, at: Date.now(), sheets, view: { sheet: at, sel: 'A1' } }, pivot, rows };
}

/** The chart of a summary: bars of its figures by its groups. */
export function pivotChart(p: Pivot, rows: number, title: string): Omit<Chart, 'id'> {
  return { sheet: p.sheet, kind: 'bars', title, labels: `A2:A${rows + 1}`, values: `B2:B${rows + 1}` };
}

/**
 * Every summary made again where its table changed shape (a new group, one gone, a row added): the same book when nothing did.
 * A summary whose sheet or table was deleted is let go. A chart of a summary follows its rows.
 */
export function refreshPivots(b: Book, value: ValueOf): Book {
  if (!b.pivots?.length) return b;
  let out = b;
  const keep: Pivot[] = [];
  for (const p of b.pivots) {
    const si = sheetIndex(out, p.sheet);
    if (si < 0 || sheetIndex(out, p.src) < 0) continue;
    keep.push(p);
    const { sheet, rows } = pivotCells(out, p, value);
    const cur = out.sheets[si]!;
    const same = JSON.stringify(Object.entries(sheet.cells).map(([k, c]) => [k, c.v, c.f])) === JSON.stringify(Object.entries(cur.cells).filter(([, c]) => c.v !== undefined || c.f !== undefined).map(([k, c]) => [k, c.v, c.f]));
    if (same) continue;
    const charts = out.charts.map((c) => (c.sheet === p.sheet ? { ...c, labels: `A2:A${rows + 1}`, values: `B2:B${rows + 1}` } : c));
    out = { ...out, sheets: out.sheets.map((x, i) => (i === si ? { ...cur, cells: sheet.cells } : x)), charts };
  }
  return keep.length === b.pivots.length ? out : { ...out, pivots: keep };
}

/** The summary in his words ("Total of Amount by Month"). */
export const pivotWords = (b: Book, p: Pivot, value: ValueOf): string => {
  const s = b.sheets[sheetIndex(b, p.src)];
  const heads = s ? headersOf(s, p, value) : [];
  const name = (c: number) => heads.find((x) => x.c === c)?.name ?? `Column ${colName(c)}`;
  return `${p.how === 'count' ? 'Count of rows' : `${HOW_WORDS[p.how]} of ${name(p.of ?? p.by)}`} by ${p.month ? 'month' : name(p.by)}`;
};
