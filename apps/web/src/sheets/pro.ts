/**
 * SPREADSHEETS, PRO EDITION, THE PURE PART (APPS ROUND, editors): input checks on cells (a drop-down list, a tick box, a date) and what he
 * hears when an entry breaks one; sparklines placed beside their numbers; merged cells; borders; table styles with a header row and banded
 * rows; and how each dresses the grid's cells (grid.ts draws it). Every change makes a new workbook, so UNDO takes it back. Pure.
 */
import { addr, entry, parseAddr, parseRange, setFormat, setSheetPart, type Book, type Check, type Sheet, type Spark, type TableStyle, type Val } from './model';
import type { Deco } from './grid';
import type { Rect } from './tokens';

const overlap = (p: Rect, q: Rect) => p.r1 <= q.r2 && q.r1 <= p.r2 && p.c1 <= q.c2 && q.c1 <= p.c2;
const inside = (r: number, c: number, g: Rect) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
const sheetAt = (b: Book, sheet: number): Sheet | undefined => b.sheets[sheet];

/** The input check on a cell, or null. */
export function checkAt(s: Sheet, a: string): Check | null {
  const p = parseAddr(a);
  if (!p) return null;
  for (const k of s.checks ?? []) {
    const g = parseRange(k.range);
    if (g && inside(p.r, p.c, g)) return k;
  }
  return null;
}
const orList = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);
/** What he hears when what he typed breaks the cell's check ('' when it is fine: a formula and an empty cell always are). */
export function checkProblem(s: Sheet, a: string, text: string): string {
  const k = checkAt(s, a);
  const t = text.trim();
  if (!k || !t || t.startsWith('=')) return '';
  if (k.kind === 'list') {
    const items = k.items ?? [];
    return items.some((x) => x.toLowerCase() === t.toLowerCase()) ? '' : `${a} takes one of its list: ${orList(items)}. Choose one under the formula line; nothing was changed.`;
  }
  if (k.kind === 'tick') return /^(true|false)$/i.test(t) ? '' : `${a} is a tick box: tap TICK or UNTICK under the formula line; nothing was changed.`;
  const e = entry(t);
  return e?.x?.n === 'date' ? '' : `${a} takes a date, like 14/11/2026, or pick one under the formula line; nothing was changed.`;
}
/** A check put on a range (any check it overlaps is taken off first). */
export function addCheck(b: Book, sheet: number, range: string, k: Omit<Check, 'range'>): Book {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return b;
  const rest = (s.checks ?? []).filter((x) => {
    const h = parseRange(x.range);
    return !h || !overlap(h, g);
  });
  return setSheetPart(b, sheet, 'checks', [...rest, { range, ...k }]);
}
/** Every check that touches the range taken off; how many. */
export function removeChecks(b: Book, sheet: number, range: string): { book: Book; n: number } {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return { book: b, n: 0 };
  const keep = (s.checks ?? []).filter((x) => {
    const h = parseRange(x.range);
    return !h || !overlap(h, g);
  });
  const n = (s.checks?.length ?? 0) - keep.length;
  return { book: n ? setSheetPart(b, sheet, 'checks', keep) : b, n };
}
/** A list's choices as he typed them ("Paid, Owed, Later"): trimmed, no blanks, no repeats. */
export const listItems = (t: string): string[] => [...new Set(t.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 40);

/** Sparklines for the chosen numbers: one row (or each row of a block) gets one in the cell after it; one column gets one under it. Null and why when it can't. */
export function addSparks(b: Book, sheet: number, range: string, kind: Spark['kind'], tone: Spark['tone'], value: (a: string) => Val): { book: Book; at: string[] } | { why: string } {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return { why: 'Choose the numbers first.' };
  const col = g.c1 === g.c2 && g.r2 > g.r1;
  const lines: { range: string; at: string }[] = [];
  if (col) lines.push({ range, at: addr(g.r2 + 1, g.c1) });
  else for (let r = g.r1; r <= g.r2; r++) lines.push({ range: `${addr(r, g.c1)}:${addr(r, g.c2)}`, at: addr(r, g.c2 + 1) });
  for (const l of lines) {
    const h = parseRange(l.range)!;
    let n = 0;
    for (let r = h.r1; r <= h.r2; r++) for (let c = h.c1; c <= h.c2; c++) if (typeof value(addr(r, c)) === 'number') n++;
    if (n < 2) return { why: `A sparkline needs at least two numbers: ${l.range} has ${n === 0 ? 'none' : 'one'}.` };
    const there = s.cells[l.at];
    if (there && (there.v !== undefined || there.f !== undefined)) return { why: `${l.at}, where the sparkline would go, has something in it. Clear it first, or choose other numbers.` };
  }
  const ats = new Set(lines.map((l) => l.at));
  const rest = (s.sparks ?? []).filter((x) => !ats.has(x.at));
  return { book: setSheetPart(b, sheet, 'sparks', [...rest, ...lines.map((l) => ({ ...l, kind, ...(tone && tone !== 1 ? { tone } : {}) }))]), at: lines.map((l) => l.at) };
}
/** The sparklines in the chosen cells taken out; how many. */
export function removeSparks(b: Book, sheet: number, range: string): { book: Book; n: number } {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return { book: b, n: 0 };
  const keep = (s.sparks ?? []).filter((x) => {
    const p = parseAddr(x.at);
    return !p || !inside(p.r, p.c, g);
  });
  const n = (s.sparks?.length ?? 0) - keep.length;
  return { book: n ? setSheetPart(b, sheet, 'sparks', keep) : b, n };
}

/** The chosen cells merged into one (merges they overlap are undone first). Null with one cell. */
export function mergeRange(b: Book, sheet: number, range: string): Book | null {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g || (g.r1 === g.r2 && g.c1 === g.c2)) return null;
  const rest = (s.merges ?? []).filter((m) => {
    const h = parseRange(m);
    return !h || !overlap(h, g);
  });
  return setSheetPart(b, sheet, 'merges', [...rest, range]);
}
/** Every merge the chosen cells touch undone; how many. */
export function unmergeRange(b: Book, sheet: number, range: string): { book: Book; n: number } {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return { book: b, n: 0 };
  const keep = (s.merges ?? []).filter((m) => {
    const h = parseRange(m);
    return !h || !overlap(h, g);
  });
  const n = (s.merges?.length ?? 0) - keep.length;
  return { book: n ? setSheetPart(b, sheet, 'merges', keep) : b, n };
}
/** The merge a cell is part of, or null. */
export function mergeAt(s: Sheet, a: string): string | null {
  const p = parseAddr(a);
  if (!p) return null;
  return (s.merges ?? []).find((m) => {
    const g = parseRange(m);
    return g && inside(p.r, p.c, g);
  }) ?? null;
}

export type BorderKind = 'all' | 'outer' | 'bottom' | 'none';
/** Borders on the chosen cells: every line, the outline, a line under, or none (1 top, 2 right, 4 bottom, 8 left). */
export function setBorders(b: Book, sheet: number, range: string, kind: BorderKind): Book {
  const g = parseRange(range);
  if (!g) return b;
  let next = b;
  for (let r = g.r1; r <= g.r2; r++)
    for (let c = g.c1; c <= g.c2; c++) {
      let m = 0;
      if (kind === 'all') m = 15;
      else if (kind === 'outer') m = (r === g.r1 ? 1 : 0) | (c === g.c2 ? 2 : 0) | (r === g.r2 ? 4 : 0) | (c === g.c1 ? 8 : 0);
      else if (kind === 'bottom') m = r === g.r2 ? 4 : 0;
      const prev = next.sheets[sheet]?.cells[addr(r, c)]?.x?.bd ?? 0;
      const want = kind === 'bottom' ? prev | m : m;
      if (want !== prev) next = setFormat(next, sheet, addr(r, c), { bd: want || undefined });
    }
  return next;
}

/** The chosen cells styled as a table (tables they overlap are taken off first). */
export function addTable(b: Book, sheet: number, range: string, t: Omit<TableStyle, 'range'>): Book | null {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g || g.r2 - g.r1 < 1) return null;
  const rest = (s.tables ?? []).filter((x) => {
    const h = parseRange(x.range);
    return !h || !overlap(h, g);
  });
  return setSheetPart(b, sheet, 'tables', [...rest, { range, ...t }]);
}
/** The table the chosen cells are in taken off; how many. */
export function removeTables(b: Book, sheet: number, range: string): { book: Book; n: number } {
  const s = sheetAt(b, sheet);
  const g = parseRange(range);
  if (!s || !g) return { book: b, n: 0 };
  const keep = (s.tables ?? []).filter((x) => {
    const h = parseRange(x.range);
    return !h || !overlap(h, g);
  });
  const n = (s.tables?.length ?? 0) - keep.length;
  return { book: n ? setSheetPart(b, sheet, 'tables', keep) : b, n };
}

/** How the pro parts dress each cell of a sheet (sparklines with their numbers now, checks, merges, table bands). */
export function proDeco(s: Sheet, value: (a: string) => Val): Map<string, Deco> {
  const out = new Map<string, Deco>();
  const at = (a: string): Deco => out.get(a) ?? (out.set(a, {}), out.get(a)!);
  for (const t of s.tables ?? []) {
    const g = parseRange(t.range);
    if (!g) continue;
    for (let r = g.r1; r <= g.r2; r++)
      for (let c = g.c1; c <= g.c2; c++) {
        const head = t.header && r === g.r1;
        const i = r - g.r1 - (t.header ? 1 : 0);
        if (!head && !t.banded) continue;
        at(addr(r, c)).band = { tone: t.tone, head, odd: !head && i % 2 === 1 };
      }
  }
  for (const k of s.checks ?? []) {
    const g = parseRange(k.range);
    if (!g) continue;
    for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 500); r++) for (let c = g.c1; c <= g.c2; c++) at(addr(r, c)).check = k.kind;
  }
  for (const m of s.merges ?? []) {
    const g = parseRange(m);
    if (!g) continue;
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) at(addr(r, c)).merge = r === g.r1 && c === g.c1 ? { cols: g.c2 - g.c1 + 1, rows: g.r2 - g.r1 + 1 } : 'hid';
  }
  for (const k of s.sparks ?? []) {
    const g = parseRange(k.range);
    if (!g) continue;
    const values: number[] = [];
    for (let r = g.r1; r <= g.r2; r++)
      for (let c = g.c1; c <= g.c2; c++) {
        const v = value(addr(r, c));
        if (typeof v === 'number') values.push(v);
      }
    at(k.at).spark = { values, kind: k.kind, tone: k.tone ?? 1 };
  }
  return out;
}
