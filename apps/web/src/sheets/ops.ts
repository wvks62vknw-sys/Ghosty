/**
 * WHAT HE DOES TO A SHEET (BRIEF-EDITOR-SPREADSHEETS): sort a column (the first row stays the header, and a formula in a moved row keeps
 * leaning on its own row), filter a column (rows hidden, never lost), fill a series with the handle (1, 2 → 3, 4; a month; a formula slides),
 * and turn a chosen range into a chart's numbers. Pure.
 */
import { addr, parseAddr, parseRange, shiftFormula, sheetIndex, usedRows, type Book, type Cell, type Chart, type Filter, type Sheet, type Val, isErr } from './model';
import { Engine } from './formula';
import { colName, MAXC, MAXR, moveLinesIn, parseAddr as pa, tokenize } from './tokens';
import { general } from './numfmt';
import type { Series } from '../show/chart';

const rankOf = (v: Val): number => (typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3);
function compare(a: Val, b: Val): number {
  const ra = rankOf(a as Val);
  const rb = rankOf(b as Val);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number') return a - (b as number);
  if (typeof a === 'string') return a.toLowerCase() < (b as string).toLowerCase() ? -1 : a.toLowerCase() > (b as string).toLowerCase() ? 1 : 0;
  return Number(a) - Number(b);
}
const colOf = (c: string | number): number => (typeof c === 'number' ? c : (pa(`${c}1`)?.c ?? -1));

/**
 * Where the rows that are sorted and filtered end (counted from 0, exclusive): at the first row that adds up the rows above it in a column
 * (a Total, a Difference), so those stay where they are, below the rows they count.
 */
export function dataEnd(s: Sheet): number {
  const n = usedRows(s);
  for (const [k, c] of Object.entries(s.cells)) {
    if (c.f === undefined) continue;
    const p = parseAddr(k)!;
    if (p.r < 2) continue;
    try {
      for (const t of tokenize(c.f)) if (t.t === 'ref' && !t.sheet && t.b && t.a.r < p.r && t.b.r < p.r && Math.abs(t.b.r - t.a.r) >= 1 && t.a.c === p.c) return Math.min(n, p.r);
    } catch {
      /* a formula that does not parse adds up nothing */
    }
  }
  return n;
}
/** The rows of a column in order, the first row left where it is; blanks last whichever way. */
export function sortRows(b: Book, sheet: string | number, col: string | number, dir: 'asc' | 'desc'): Book {
  const si = typeof sheet === 'number' ? sheet : sheetIndex(b, sheet);
  const s = b.sheets[si];
  const c = colOf(col);
  if (!s || c < 0) return b;
  const eng = new Engine(b);
  const n = dataEnd(s);
  const keys: { r: number; v: Val }[] = [];
  for (let r = 1; r < n; r++) keys.push({ r, v: eng.value(s.name, addr(r, c)) });
  const sorted = keys.slice().sort((p, q) => {
    const pe = p.v === null || p.v === '' || isErr(p.v);
    const qe = q.v === null || q.v === '' || isErr(q.v);
    if (pe || qe) return pe && qe ? p.r - q.r : pe ? 1 : -1;
    const d = compare(p.v, q.v);
    return (dir === 'asc' ? d : -d) || p.r - q.r;
  });
  const byRow = new Map<number, [number, Cell][]>();
  for (const [k, cell] of Object.entries(s.cells)) {
    const p = parseAddr(k)!;
    if (p.r >= 1 && p.r < n) (byRow.get(p.r) ?? byRow.set(p.r, []).get(p.r)!).push([p.c, cell]);
  }
  const cells: Record<string, Cell> = {};
  for (const [k, cell] of Object.entries(s.cells)) if (parseAddr(k)!.r < 1 || parseAddr(k)!.r >= n) cells[k] = cell;
  sorted.forEach(({ r: old }, i) => {
    const r = i + 1;
    for (const [cc, cell] of byRow.get(old) ?? []) cells[addr(r, cc)] = cell.f !== undefined ? { ...cell, f: shiftFormula(cell.f, r - old, 0) } : cell;
  });
  return { ...b, at: Date.now(), sheets: b.sheets.map((x, k) => (k === si ? { ...s, cells } : x)) };
}

const numArg = (t: string): number | null => {
  const m = /^\s*[£$€]?\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*%?\s*$/.exec(t.replace(/,/g, ''));
  return m ? Number(m[1]) : null;
};
export function passes(f: Filter, v: Val): boolean {
  if (f.op === 'filled') return v !== null && v !== '';
  const n = numArg(f.v);
  if (f.op === 'over') return typeof v === 'number' && n !== null && v > n;
  if (f.op === 'under') return typeof v === 'number' && n !== null && v < n;
  const text = v === null ? '' : typeof v === 'number' ? general(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : isErr(v) ? v.e : v;
  if (f.op === 'is') return typeof v === 'number' && n !== null ? v === n : text.toLowerCase() === f.v.trim().toLowerCase();
  return text.toLowerCase().includes(f.v.trim().toLowerCase());
}
/** The rows (counted from 1) a sheet shows: the first row always, then each row that passes the filter. */
export function visibleRows(s: Sheet, filter: Filter | null | undefined, eng?: Engine): number[] {
  const n = Math.max(usedRows(s), 1);
  const end = filter ? dataEnd(s) : n;
  const rows = [1];
  for (let r = 1; r < n; r++) {
    if (!filter || r >= end) rows.push(r + 1);
    else {
      const cell = s.cells[addr(r, filter.c)];
      const v = eng ? eng.value(s.name, addr(r, filter.c)) : cell?.f !== undefined ? null : (cell?.v ?? null);
      if (passes(filter, v)) rows.push(r + 1);
    }
  }
  return rows;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const same = (src: string, word: string): string => (src === src.toUpperCase() && src.length > 1 ? word.toUpperCase() : src[0] === src[0]!.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word);
/** The word after `n` more steps in a list of names, or null when it is in none. */
function nameStep(t: string, n: number): string | null {
  const low = t.toLowerCase();
  for (const list of [MONTHS, DAYS]) {
    const full = list.indexOf(low);
    if (full >= 0) return same(t, list[(full + n) % list.length]!);
    const short = list.findIndex((w) => w.slice(0, 3) === low);
    if (short >= 0) return same(t, list[(((short + n) % list.length) + list.length) % list.length]!.slice(0, 3));
  }
  return null;
}
const tail = (t: string): { head: string; n: number; width: number } | null => {
  const m = /^(.*?)(\d+)$/.exec(t);
  return m ? { head: m[1]!, n: Number(m[2]), width: m[2]!.length } : null;
};

/** The cell `n` steps past the source cells (a column or a row of them): a series where there is one, a copy where not (a formula is slid by the caller). */
function stepCell(list: (Cell | undefined)[], n: number): Cell | undefined {
  const k = list.length;
  const nums = list.every((c) => c && c.f === undefined && typeof c.v === 'number');
  const strs = list.every((c) => c && c.f === undefined && typeof c.v === 'string');
  const diffs = nums && k >= 2 ? list.slice(1).map((c, i) => (c!.v as number) - (list[i]!.v as number)) : [];
  const linear = nums && k >= 2 && diffs.every((d) => Math.abs(d - diffs[0]!) < 1e-9);
  const last = list[k - 1];
  const src = list[(n - 1) % k];
  if (linear) return { ...last, v: (last!.v as number) + diffs[0]! * n };
  if (nums && k === 1 && list[0]!.x?.n === 'date') return { ...last, v: (last!.v as number) + n };
  if (strs && k === 1 && nameStep(list[0]!.v as string, n) !== null) return { ...src, v: nameStep(list[0]!.v as string, n)! };
  if (strs && k === 1 && tail(list[0]!.v as string)) {
    const t = tail(list[0]!.v as string)!;
    return { ...src, v: `${t.head}${String(t.n + n).padStart(t.width, '0')}` };
  }
  if (strs && k >= 2 && tail(last!.v as string) && tail(list[k - 2]!.v as string) && tail(last!.v as string)!.head === tail(list[k - 2]!.v as string)!.head) {
    const a = tail(last!.v as string)!;
    const step = a.n - tail(list[k - 2]!.v as string)!.n;
    return { ...last, v: `${a.head}${String(a.n + step * n).padStart(a.width, '0')}` };
  }
  return src ? { ...src } : undefined;
}

/** The chosen range carried on to `target` (down or right, whichever is further), as the fill handle does. */
export function fillRange(b: Book, sheet: string | number, src: string, target: string): Book {
  const g = parseRange(src);
  const t = parseAddr(target);
  const si = typeof sheet === 'number' ? sheet : sheetIndex(b, sheet);
  const s = b.sheets[si];
  if (!g || !t || !s) return b;
  const down = Math.max(0, t.r - g.r2);
  const right = Math.max(0, t.c - g.c2);
  if (!down && !right) return b;
  const vertical = down >= right;
  if (vertical ? g.r2 + down >= MAXR : g.c2 + right >= MAXC) return b;
  const cells = { ...s.cells };
  const lines = vertical ? g.c2 - g.c1 + 1 : g.r2 - g.r1 + 1;
  const len = vertical ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
  for (let ln = 0; ln < lines; ln++) {
    const at = (i: number) => (vertical ? addr(g.r1 + i, g.c1 + ln) : addr(g.r1 + ln, g.c1 + i));
    const list = Array.from({ length: len }, (_, i) => s.cells[at(i)]);
    for (let n = 1; n <= (vertical ? down : right); n++) {
      const idx = (n - 1) % len;
      const orig = list[idx];
      let cell = stepCell(list, n);
      if (orig?.f !== undefined) cell = { ...orig, f: shiftFormula(orig.f, vertical ? len + n - 1 - idx : 0, vertical ? 0 : len + n - 1 - idx) };
      const key = at(len + n - 1);
      if (cell && (cell.v !== undefined || cell.f !== undefined || cell.x)) cells[key] = cell;
      else delete cells[key];
    }
  }
  return { ...b, at: Date.now(), sheets: b.sheets.map((x, k) => (k === si ? { ...s, cells } : x)) };
}

/** What a chart of a chosen range would be: labels from the first column (or a text column beside), numbers from the last; a header row is the title. */
export function chartOf(b: Book, eng: Engine, sheet: string, range: string, kind: 'bars' | 'line'): Omit<Chart, 'id'> | null {
  const g = parseRange(range);
  const si = sheetIndex(b, sheet);
  if (!g || si < 0) return null;
  const vc = g.c2;
  const lc = g.c2 > g.c1 ? g.c1 : vc > 0 ? vc - 1 : -1;
  const at = (r: number, c: number): Val => eng.value(b.sheets[si]!.name, addr(r, c));
  let r1 = g.r1;
  let title = '';
  const first = at(r1, vc);
  if (typeof first === 'string' && g.r2 > r1 && typeof at(r1 + 1, vc) === 'number') {
    title = first;
    r1++;
  }
  const nums = [];
  for (let r = r1; r <= g.r2; r++) if (typeof at(r, vc) === 'number') nums.push(r);
  if (nums.length < 2) return null;
  let labels: string | null = null;
  if (lc >= 0 && (g.c2 > g.c1 || nums.some((r) => typeof at(r, lc) === 'string'))) {
    const texty = nums.filter((r) => typeof at(r, lc) === 'string').length;
    if (texty >= nums.length / 2) labels = `${colName(lc)}${r1 + 1}:${colName(lc)}${g.r2 + 1}`;
  }
  return { sheet: b.sheets[si]!.name, kind, title: title || `${colName(vc)}${r1 + 1} to ${colName(vc)}${g.r2 + 1}`, labels, values: `${colName(vc)}${r1 + 1}:${colName(vc)}${g.r2 + 1}` };
}
/** A chart's numbers, in the shape the app's own chart draws (show/chart.ts). */
export function chartSeries(b: Book, eng: Engine, c: Chart): Series | null {
  const s = b.sheets[sheetIndex(b, c.sheet)];
  const v = parseRange(c.values);
  if (!s || !v) return null;
  const l = c.labels ? parseRange(c.labels) : null;
  const points: Series['points'] = [];
  const fmt = s.cells[addr(v.r1, v.c1)]?.x;
  const pct = fmt?.n === 'percent';
  for (let r = v.r1; r <= v.r2; r++) {
    const val = eng.value(s.name, addr(r, v.c1));
    if (typeof val !== 'number') continue;
    const lab = l ? eng.text(s.name, addr(l.r1 + (r - v.r1), l.c1)) : String(r - v.r1 + 1);
    points.push({ label: lab || String(r - v.r1 + 1), value: pct ? val * 100 : val });
  }
  if (points.length < 2) return null;
  const cur = fmt?.n === 'currency';
  return { kind: c.kind, points, unit: cur ? '£' : pct ? '%' : '', before: cur };
}

/**
 * ROWS AND COLUMNS PUT IN OR TAKEN OUT (as Numbers and Excel do): `n` > 0 puts `n` empty rows (axis 'r') or columns ('c') in before line
 * `at`; `n` < 0 takes `-n` out from `at`. The cells after move along with their look, widths and heights follow, and every formula, name and
 * chart on every sheet that pointed past the change follows its cells (one that pointed only into lines taken out says #REF!). Pure.
 */
export function moveLines(b: Book, sheet: string | number, axis: 'r' | 'c', at: number, n: number): Book {
  const si = typeof sheet === 'number' ? sheet : sheetIndex(b, sheet);
  const s = b.sheets[si];
  if (!s || !n || at < 0) return b;
  const max = axis === 'r' ? MAXR : MAXC;
  const gone = n < 0 ? -n : 0;
  const to = (i: number): number | null => (n > 0 ? (i >= at ? i + n : i) : i < at ? i : i >= at + gone ? i - gone : null);
  const lines = (m: Record<number, number>): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(m)) {
      const j = to(Number(k));
      if (j !== null && j < max) out[j] = v;
    }
    return out;
  };
  const sheets = b.sheets.map((x, k) => {
    const cells: Record<string, Cell> = {};
    for (const [key, c] of Object.entries(x.cells)) {
      let cell = c;
      if (c.f !== undefined) {
        const f = moveLinesIn(c.f, x.name, s.name, axis, at, n);
        if (f !== c.f) cell = { ...c, f };
      }
      if (k !== si) {
        cells[key] = cell;
        continue;
      }
      const p = parseAddr(key);
      if (!p) continue;
      const j = to(p[axis]);
      if (j === null || j >= max) continue;
      cells[axis === 'r' ? addr(j, p.c) : addr(p.r, j)] = cell;
    }
    if (k !== si) return cells === x.cells ? x : { ...x, cells };
    const filter = x.filter && axis === 'c' ? (to(x.filter.c) === null ? null : { ...x.filter, c: to(x.filter.c)! }) : x.filter;
    return { ...x, cells, widths: axis === 'c' ? lines(x.widths) : x.widths, heights: axis === 'r' ? lines(x.heights) : x.heights, filter };
  });
  const names: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.names)) names[k] = moveLinesIn(v, '', s.name, axis, at, n);
  const charts = b.charts.map((c) => {
    const values = moveLinesIn(c.values, c.sheet, s.name, axis, at, n);
    const labels = c.labels ? moveLinesIn(c.labels, c.sheet, s.name, axis, at, n) : null;
    return values === c.values && labels === c.labels ? c : { ...c, values, labels };
  });
  return { ...b, at: Date.now(), sheets, names, charts };
}

/**
 * AUTOSUM (Σ): one cell chosen adds up the numbers right above it (or, with none above, those to its left); several cells chosen get a
 * SUM under each column of them. What it wrote, and where; null when there are no numbers to add up.
 */
export function autoSum(b: Book, eng: Engine, sheet: string | number, g: { r1: number; c1: number; r2: number; c2: number }): { book: Book; cells: string[]; f: string } | null {
  const si = typeof sheet === 'number' ? sheet : sheetIndex(b, sheet);
  const s = b.sheets[si];
  if (!s) return null;
  const num = (r: number, c: number) => typeof eng.value(s.name, addr(r, c)) === 'number';
  const cells = { ...s.cells };
  const put = (a: string, f: string) => {
    const prev = cells[a];
    const x = prev?.x ?? s.cells[a.replace(/\d+$/, String(Number(a.match(/\d+$/)![0]) - 1))]?.x;
    cells[a] = { f, ...(x ? { x } : {}) };
  };
  const done: string[] = [];
  let f = '';
  if (g.r1 === g.r2 && g.c1 === g.c2) {
    const { r1: r, c1: c } = g;
    let top = r;
    while (top > 0 && !num(top - 1, c)) top--;
    if (top > 0 && top === r) {
      while (top > 0 && num(top - 1, c)) top--;
      f = `SUM(${addr(top, c)}:${addr(r - 1, c)})`;
    } else {
      let left = c;
      while (left > 0 && num(r, left - 1)) left--;
      if (left === c) {
        // nothing right beside it: the nearest run of numbers above, past a gap or a header
        let end = r - 1;
        while (end >= 0 && !num(end, c)) end--;
        if (end < 0) return null;
        let start = end;
        while (start > 0 && num(start - 1, c)) start--;
        f = `SUM(${addr(start, c)}:${addr(end, c)})`;
      } else f = `SUM(${addr(r, left)}:${addr(r, c - 1)})`;
    }
    put(addr(r, c), f);
    done.push(addr(r, c));
  } else {
    if (g.r2 + 1 >= MAXR) return null;
    for (let c = g.c1; c <= g.c2; c++) {
      let any = false;
      for (let r = g.r1; r <= g.r2 && !any; r++) any = num(r, c);
      if (!any) continue;
      f = `SUM(${addr(g.r1, c)}:${addr(g.r2, c)})`;
      put(addr(g.r2 + 1, c), f);
      done.push(addr(g.r2 + 1, c));
    }
    if (!done.length) return null;
  }
  return { book: { ...b, at: Date.now(), sheets: b.sheets.map((x, k) => (k === si ? { ...s, cells } : x)) }, cells: done, f };
}
