/**
 * THE CHART EDITOR'S PURE PART (APPS ROUND, editors: the pro edition): a chart of any kind from the chosen cells (column, bar, line, area, pie,
 * scatter, stacked column, stacked bar, line and column together), and a chart's numbers read back from its cells as labels and one or more
 * named series. Every point is a number of the sheet; nothing is added. Pure.
 */
import { addr, sheetIndex, type Book, type Chart, type ChartKind, type Val } from './model';
import type { Engine } from './formula';
import { colName, parseRange } from './tokens';

export interface ChartData {
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  /** A scatter's x numbers (one per label). */
  xs?: number[];
  unit: string;
  before: boolean;
}

const MULTI: ChartKind[] = ['column', 'bars', 'line', 'area', 'stackedcol', 'stackedbar', 'combo'];

/** A chart of the chosen range: labels from the first column, numbers from the columns after it (several for stacked, combo and the rest; one for a pie); a first row of words names the series. Null with fewer than two numbers. */
export function chartFrom(b: Book, eng: Engine, sheet: string, range: string, kind: ChartKind): Omit<Chart, 'id'> | null {
  const g = parseRange(range);
  const si = sheetIndex(b, sheet);
  if (!g || si < 0) return null;
  const name = b.sheets[si]!.name;
  const at = (r: number, c: number): Val => eng.value(name, addr(r, c));
  const numCol = (c: number, r1: number) => {
    let n = 0;
    for (let r = r1; r <= g.r2; r++) if (typeof at(r, c) === 'number') n++;
    return n;
  };
  let r1 = g.r1;
  const headed = g.r2 > g.r1 && typeof at(g.r1, g.c2) === 'string' && typeof at(g.r1 + 1, g.c2) === 'number';
  if (headed) r1++;
  const cols: number[] = [];
  for (let c = g.c1; c <= g.c2; c++) if (numCol(c, r1) >= 2) cols.push(c);
  if (!cols.length) return null;
  const lc = g.c1 < cols[0]! ? g.c1 : kind === 'scatter' && cols.length >= 2 ? cols[0]! : -1;
  const ref = (c: number) => `${colName(c)}${r1 + 1}:${colName(c)}${g.r2 + 1}`;
  let valueCols = cols.filter((c) => c !== lc);
  if (!valueCols.length) return null;
  if (kind === 'pie') valueCols = [valueCols[valueCols.length - 1]!];
  else if (kind === 'scatter') valueCols = [valueCols[valueCols.length - 1]!];
  else if (!MULTI.includes(kind)) valueCols = [valueCols[valueCols.length - 1]!];
  else valueCols = valueCols.slice(0, 4);
  if (kind === 'combo' && valueCols.length < 2) return null;
  const head = (c: number) => (headed ? String(at(g.r1, c)) : colName(c));
  const title = headed && valueCols.length === 1 ? String(at(g.r1, valueCols[0]!)) : `${ref(valueCols[0]!).split(':')[0]} to ${ref(valueCols[valueCols.length - 1]!).split(':')[1]}`;
  return {
    sheet: name,
    kind,
    title,
    labels: lc >= 0 ? ref(lc) : null,
    values: ref(valueCols[0]!),
    ...(valueCols.length > 1 ? { more: valueCols.slice(1).map(ref) } : {}),
    names: valueCols.map(head),
    ...(kind === 'scatter' && lc >= 0 ? { xTitle: head(lc), yTitle: head(valueCols[0]!) } : {}),
  };
}

/** A chart's labels and series, read from its cells now. Null when it has fewer than two numbers. */
export function chartData(b: Book, eng: Engine, c: Chart): ChartData | null {
  const si = sheetIndex(b, c.sheet);
  const s = b.sheets[si];
  const v = parseRange(c.values);
  if (!s || !v) return null;
  const l = c.labels ? parseRange(c.labels) : null;
  const ranges = [v, ...(c.more ?? []).map((m) => parseRange(m))].filter((x): x is NonNullable<typeof x> => !!x);
  const n = v.r2 - v.r1 + 1;
  const fmt = s.cells[addr(v.r1, v.c1)]?.x;
  const pct = fmt?.n === 'percent';
  const labels: string[] = [];
  const xs: number[] = [];
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    const any = ranges.some((g) => typeof eng.value(s.name, addr(g.r1 + i, g.c1)) === 'number');
    if (!any) continue;
    if (c.kind === 'scatter') {
      const x = l ? eng.value(s.name, addr(l.r1 + i, l.c1)) : i + 1;
      if (typeof x !== 'number') continue;
      xs.push(x);
    }
    keep.push(i);
    const lab = l ? eng.text(s.name, addr(l.r1 + i, l.c1)) : '';
    labels.push(lab || String(i + 1));
  }
  if (keep.length < 2) return null;
  const series = ranges.map((g, k) => ({
    name: c.names?.[k] ?? colName(g.c1),
    values: keep.map((i) => {
      const val = eng.value(s.name, addr(g.r1 + i, g.c1));
      return typeof val === 'number' ? (pct ? val * 100 : val) : null;
    }),
  }));
  const cur = fmt?.n === 'currency';
  return { labels, series, ...(c.kind === 'scatter' ? { xs } : {}), unit: cur ? '£' : pct ? '%' : '', before: cur };
}

/** A chart in his words, for what he hears after a change. */
export function chartWords(c: Pick<Chart, 'kind' | 'values' | 'more'>, words: string): string {
  const n = 1 + (c.more?.length ?? 0);
  return `A ${words} chart of ${c.values}${n > 1 ? ` and ${n - 1} more column${n === 2 ? '' : 's'}` : ''}`;
}
