/**
 * A DATABASE AS A CSV, and a CSV as a database (BRIEF-EDITOR-WORKSPACE): the header becomes the properties, the first column the page's
 * name, the kinds guessed from the values and said ("12 rows, 4 properties: 2 text, 1 number, 1 date. Change any."). Pure.
 */
import { parseCsv } from '../sheets/csv';
import { addRow, dateTyped, KIND_NAMES, newDatabase, shown } from './db';
import { rowsOf, type Page, type Prop, type PropKind, type PVal, type Workspace } from './model';

const quote = (s: string): string => (/[",\n\r]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
/** The database as CSV text: its name column, then each property (a date as YYYY-MM-DD, a checkbox as true or false, a multi-select or a relation joined with "; ", a formula or rollup as its worked answer). */
export function toCsv(ws: Workspace, dbId: string): string {
  const db = ws.pages[dbId]?.db;
  if (!db) return '';
  const lines = [['Name', ...db.props.map((p) => p.name)].map(quote).join(',')];
  for (const r of rowsOf(ws, dbId)) {
    lines.push([r.title, ...db.props.map((p) => cellText(ws, dbId, r, p))].map(quote).join(','));
  }
  return lines.join('\n') + '\n';
}
function cellText(ws: Workspace, dbId: string, r: Page, p: Prop): string {
  const v = r.vals?.[p.id] ?? null;
  switch (p.kind) {
    case 'check': return v === true ? 'true' : 'false';
    case 'multi': return Array.isArray(v) ? v.join('; ') : '';
    case 'relation': return Array.isArray(v) ? v.map((id) => ws.pages[id]?.title ?? '').filter(Boolean).join('; ') : '';
    case 'date': return typeof v === 'string' ? v : '';
    case 'formula':
    case 'rollup': return shown(ws, dbId, r, p).text;
    case 'number': return typeof v === 'number' ? String(v) : '';
    default: return typeof v === 'string' ? v : '';
  }
}

const NUM = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const YES = /^(true|false|yes|no|✓|✗|x)$/i;
export interface Guess {
  kinds: PropKind[];
  options: string[][];
}
/** The kinds of the columns, from their values: number, date, checkbox, select (few short repeating values), else text. Column 0 is the name. */
export function guessKinds(header: string[], rows: string[][]): Guess {
  const kinds: PropKind[] = [];
  const options: string[][] = [];
  header.forEach((_h, c) => {
    options.push([]);
    if (c === 0) return void kinds.push('text');
    const vs = rows.map((r) => (r[c] ?? '').trim()).filter(Boolean);
    if (!vs.length) return void kinds.push('text');
    if (vs.every((v) => NUM.test(v))) return void kinds.push('number');
    if (vs.every((v) => dateTyped(v) !== null)) return void kinds.push('date');
    if (vs.every((v) => YES.test(v))) return void kinds.push('check');
    const distinct = [...new Set(vs)];
    if (rows.length >= 4 && distinct.length <= 6 && distinct.length * 2 <= vs.length + 1 && distinct.every((v) => v.length <= 24 && v.split(/\s+/).length <= 4)) {
      options[c] = distinct;
      return void kinds.push('select');
    }
    kinds.push('text');
  });
  return { kinds, options };
}
/** "12 rows, 4 properties: 2 text, 1 number, 1 date. Change any." */
export function kindsLine(rows: number, kinds: PropKind[]): string {
  const n = new Map<PropKind, number>();
  for (const k of kinds) n.set(k, (n.get(k) ?? 0) + 1);
  const parts = [...n].map(([k, c]) => `${c} ${KIND_NAMES[k].toLowerCase()}`);
  return `${rows} row${rows === 1 ? '' : 's'}, ${kinds.length} propert${kinds.length === 1 ? 'y' : 'ies'}: ${parts.join(', ')}. Change any.`;
}
const valueFor = (kind: PropKind, raw: string): PVal => {
  const t = raw.trim();
  if (!t) return kind === 'check' ? false : null;
  switch (kind) {
    case 'number': return Number(t.replace(/,/g, ''));
    case 'date': return dateTyped(t);
    case 'check': return /^(true|yes|✓|x)$/i.test(t);
    case 'multi': return t.split(/\s*;\s*/).filter(Boolean);
    default: return raw;
  }
};
export interface Imported {
  ws: Workspace;
  page: Page;
  rows: number;
  kinds: PropKind[];
  /** What it said about the guess, and anything it could not keep. */
  line: string;
  /** Rows or cells it could not keep, said once. */
  lost: string[];
}
/** A CSV made into a database page (the first row is the header). */
export function importCsv(ws: Workspace, text: string, title: string, parent: string | null = null, known?: { props: Omit<Prop, 'id'>[]; names: string[] }): Imported | null {
  const all = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (all.length < 1) return null;
  const header = all[0]!.map((h) => h.trim());
  const rows = all.slice(1);
  const g = known ? { kinds: ['text', ...known.props.map((p) => p.kind)] as PropKind[], options: [[], ...known.props.map((p) => p.options ?? [])] } : guessKinds(header, rows);
  const props: Omit<Prop, 'id'>[] = known
    ? known.props
    : header.slice(1).map((name, i) => ({ name: name || `Property ${i + 1}`, kind: g.kinds[i + 1]!, ...(g.kinds[i + 1] === 'select' ? { options: g.options[i + 1]! } : {}) }));
  let out = newDatabase(ws, { title: title || 'Imported table', parent, props, views: ['table'], from: 'a CSV' });
  const page = out.page;
  let w = out.ws;
  const lost: string[] = [];
  const colOf = (name: string): number => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  for (const r of rows) {
    const vals: Record<string, PVal> = {};
    page.db!.props.forEach((p, i) => {
      if (p.kind === 'formula' || p.kind === 'rollup' || p.kind === 'relation') return;
      const c = known ? colOf(p.name) : i + 1;
      const raw = c >= 0 ? r[c] ?? '' : '';
      const v = valueFor(p.kind, raw);
      if (p.kind === 'date' && raw.trim() && v === null) lost.push(`“${raw.trim()}” is not a date I can read (${p.name})`);
      vals[p.id] = v;
      if (p.kind === 'select' && typeof v === 'string' && v && !(p.options ?? []).includes(v)) p.options = [...(p.options ?? []), v];
    });
    w = addRowRaw(w, page.id, r[0] ?? '', vals);
  }
  out = { ws: w, page: w.pages[page.id]! };
  const kinds = ['text' as PropKind, ...page.db!.props.map((p) => p.kind)];
  return { ws: out.ws, page: out.page, rows: rows.length, kinds, line: kindsLine(rows.length, kinds), lost: [...new Set(lost)].slice(0, 5) };
}
const addRowRaw = (ws: Workspace, dbId: string, title: string, vals: Record<string, PVal>): Workspace => addRow(ws, dbId, title, vals).ws;
