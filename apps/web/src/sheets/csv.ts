/**
 * CSV IN AND OUT (BRIEF-EDITOR-SPREADSHEETS): a sheet as comma-separated lines the way Excel writes them (quotes round a field with a comma, a
 * quote or a line break; the numbers as numbers, dates as 2024-03-05, so nothing is lost but the £ and % styling, which the export says), and a CSV
 * read back (commas, semicolons or tabs; quotes and doubled quotes; lines inside quotes) with numbers, dates and true or false typed as such.
 * Pure.
 */
import { addr, entry, newBook, sheetIndex, usedCols, usedRows, type Book, type Cell, type Val, isErr } from './model';
import { Engine } from './formula';
import { dateOf, plain } from './numfmt';
import { MAXC, MAXR } from './tokens';

const field = (t: string): string => (/[",\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
/** A value as a CSV field. */
export function csvValue(v: Val, date: boolean): string {
  if (v === null || v === undefined) return '';
  if (isErr(v)) return v.e;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  if (date) {
    const d = dateOf(v);
    return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return plain(v);
}
/** One sheet as CSV text (every row, hidden or not, as Excel does). */
export function toCsv(b: Book, sheet: string): string {
  const i = sheetIndex(b, sheet);
  const s = b.sheets[i];
  if (!s) return '';
  const eng = new Engine(b);
  const rows = usedRows(s);
  const cols = usedCols(s);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(field(csvValue(eng.value(s.name, addr(r, c)), s.cells[addr(r, c)]?.x?.n === 'date')));
    lines.push(row.join(','));
  }
  return lines.length ? `${lines.join('\r\n')}\r\n` : '';
}

/** The records of CSV text (the delimiter found from the first line). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = (/^[^\r\n]*/.exec(t) ?? [''])[0].replace(/"[^"]*"/g, '');
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((p, q) => q[1] - p[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  let any = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"' && cur === '') {
      q = true;
      any = true;
    } else if (ch === delim) {
      row.push(cur);
      cur = '';
      any = true;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      if (any || cur !== '') {
        row.push(cur);
        rows.push(row);
      }
      row = [];
      cur = '';
      any = false;
    } else {
      cur += ch;
      any = true;
    }
  }
  if (any || cur !== '') {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
/** A workbook of one sheet from CSV text: typed as he would type it (a leading = is a formula, as in Excel); the first row a bold, frozen header when it is words over numbers. */
export function fromCsv(text: string, title = 'Imported CSV'): Book {
  const rows = parseCsv(text).slice(0, MAXR);
  const b = newBook(title);
  if (!rows.length) return { ...b, from: 'read from a file' };
  const cells: Record<string, Cell> = {};
  const widths: Record<number, number> = {};
  rows.forEach((row, r) => row.slice(0, MAXC).forEach((t, c) => {
    const cell = entry(t);
    if (!cell) return;
    cells[addr(r, c)] = cell;
    widths[c] = Math.max(widths[c] ?? 96, Math.min(240, t.length * 8 + 24));
  }));
  const headed = rows.length > 1 && (rows[0] ?? []).every((t) => t !== '' && entry(t)?.v !== undefined && typeof entry(t)!.v === 'string') && (rows[1] ?? []).some((t) => typeof entry(t)?.v === 'number');
  if (headed) for (const k of Object.keys(cells)) if (/^[A-Z]+1$/.test(k)) cells[k] = { ...cells[k]!, x: { ...cells[k]!.x, b: 1 } };
  return { ...b, from: 'read from a file', sheets: [{ ...b.sheets[0]!, cells, widths, frozen: headed }] };
}
