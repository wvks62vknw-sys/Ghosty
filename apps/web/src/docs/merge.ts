/**
 * MAIL MERGE (NEXT ROUND, editors.s2): one letter with {{Name}} fields, a spreadsheet of names and addresses, a copy of the letter for
 * every row with each field filled from that row's column of the same name (its header, as the cell shows it: £, dates). The copies are
 * one document with a page break between them (one PDF or one Word file), or one file each in a zip. Nothing is sent anywhere. Pure but
 * for the spreadsheet's formulas, worked out by its own engine.
 */
import { Engine } from '../sheets/formula';
import { formatValue, usedCols, usedRows, addr, type Book } from '../sheets/model';
import { blockId, newDoc, tidyRuns, type Block, type Doc, type Run } from './model';

export const FIELD = /\{\{\s*([^{}]+?)\s*\}\}/g;
const key = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The fields the letter asks for, in the order they first appear, each once. */
export function mergeFields(d: Doc): string[] {
  const seen = new Map<string, string>();
  const scan = (runs: Run[]) => {
    for (const m of runs.map((r) => r.text).join('').matchAll(FIELD)) if (!seen.has(key(m[1]!))) seen.set(key(m[1]!), m[1]!.trim());
  };
  for (const b of d.blocks) {
    scan(b.runs);
    for (const row of b.rows ?? []) for (const c of row) scan(c);
  }
  return [...seen.values()];
}

export interface MergeTable {
  head: string[];
  rows: string[][];
}
/** A spreadsheet's first sheet as a table: its first row the column names, every row under it with something in it, as the cells show. */
export function tableOf(b: Book): MergeTable {
  const s = b.sheets[0];
  if (!s) return { head: [], rows: [] };
  const eng = new Engine(b);
  const cols = usedCols(s);
  const nrows = usedRows(s);
  const text = (r: number, c: number): string => {
    const cell = s.cells[addr(r, c)];
    if (!cell) return '';
    const v = cell.f !== undefined ? eng.value(s.name, addr(r, c)) : cell.v ?? null;
    return formatValue(v ?? null, cell.x).trim();
  };
  const head = Array.from({ length: cols }, (_, c) => text(0, c));
  const rows: string[][] = [];
  for (let r = 1; r < nrows; r++) {
    const row = Array.from({ length: cols }, (_, c) => text(r, c));
    if (row.some((x) => x)) rows.push(row);
  }
  return { head, rows };
}

/** The fields the letter asks for that the spreadsheet has no column for. */
export const missingFields = (fields: string[], head: string[]): string[] => {
  const have = new Set(head.map(key));
  return fields.filter((f) => !have.has(key(f)));
};

const fillRuns = (runs: Run[], values: Map<string, string>): Run[] => {
  // a field typed in one go is in one run; one split across marks (half bold) is joined first when the marks allow
  const tidy = tidyRuns(runs);
  return tidyRuns(tidy.map((r) => ({ ...r, text: r.text.replace(FIELD, (m, name: string) => values.get(key(name)) ?? m) })));
};

/** The letter for one row: each {{field}} its column's words (a field with no column, or an empty cell, said as it is). */
export function mergeOne(d: Doc, t: MergeTable, row: string[]): Doc {
  const values = new Map(t.head.map((h, c) => [key(h), row[c] ?? ''] as [string, string]));
  return {
    ...d,
    blocks: d.blocks.map((b): Block => ({
      ...b,
      runs: fillRuns(b.runs, values),
      ...(b.rows ? { rows: b.rows.map((r) => r.map((c) => fillRuns(c, values))) } : {}),
    })),
  };
}

/** Every row's letter as one document, a page break between them. */
export function mergeAll(d: Doc, t: MergeTable): Doc {
  const blocks: Block[] = [];
  t.rows.forEach((row, k) => {
    if (k) blocks.push({ id: blockId(), t: 'pb', runs: [] });
    blocks.push(...mergeOne(d, t, row).blocks.map((b) => ({ ...b, id: blockId() })));
  });
  return { ...newDoc(`${d.title} (${t.rows.length} copies)`, blocks, d.kind === 'letter' ? 'letter' : 'document', 'mail merge'), ...(d.page ? { page: d.page } : {}) };
}

/** A copy's file name: the letter's title and the row's first filled cell ("Invitation – Sam Khan"), safe for a file. */
export function copyName(d: Doc, row: string[], k: number, ext: string, used: Set<string>): string {
  const who = row.find((x) => x.trim()) ?? `${k + 1}`;
  const base = `${d.title} – ${who}`.replace(/[\\/:*?"<>|\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  let name = `${base}.${ext}`;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
  used.add(name.toLowerCase());
  return name;
}
