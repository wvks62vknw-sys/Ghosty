/**
 * THE WORKSPACE'S DATABASES (BRIEF-EDITOR-WORKSPACE): a database is a page whose rows are pages, with properties (text, number, select,
 * multi-select, date, checkbox, person, relation, rollup, formula) and views (table, board, calendar, timeline, gallery), each view with its
 * own sort, filter and hidden properties. The formulas are worked by the spreadsheet's own Engine (sheets/formula.ts): the databases are laid as
 * one Book, a sheet each, a row a row, a property a column, so `prop("Cost") * 1.2` and the engine's whole function table work as they do in
 * a spreadsheet, and a rollup is the engine summing the related rows' cells. Pure: apps/edge/test/workspace.test.mjs.
 */
import { Engine } from '../sheets/formula';
import { addr, colName, err, formatValue, isErr, type Book, type Cell, type Val } from '../sheets/model';
import { dateOf, serialOf } from '../sheets/numfmt';
import {
  patchPage, putPage, propId, viewId, rowsOf, live, wblock, pageId,
  type Database, type Filter, type Page, type Prop, type PropKind, type PVal, type RollFn, type View, type ViewKind, type Workspace,
} from './model';

// ---------------------------------------------------------------- dates as he keeps them: YYYY-MM-DD

const pad = (n: number): string => String(n).padStart(2, '0');
export const isoOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function parseIso(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? { y, m: mo, d } : null;
}
const utcDay = (s: string): number => {
  const p = parseIso(s);
  return p ? Date.UTC(p.y, p.m - 1, p.d) / 86_400_000 : NaN;
};
export const addDays = (iso: string, n: number): string => {
  const t = new Date((utcDay(iso) + n) * 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
export const dayDiff = (a: string, b: string): number => utcDay(b) - utcDay(a);
export const monthOf = (iso: string): string => iso.slice(0, 7);
export const addMonths = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthWords = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1] ?? ''} ${y}`;
};
/** "5 Nov 2026", the way he says a date. */
export function dateWords(iso: string): string {
  const p = parseIso(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]!.slice(0, 3)} ${p.y}` : iso;
}
/** A date typed as he writes it (5/3/2026, 5 March 2026, 2026-03-05) as YYYY-MM-DD, or null. Day first. */
export function dateTyped(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (isIso(s) && parseIso(s)) return s;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    return parseIso(iso) ? iso : null;
  }
  m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.toLowerCase().startsWith(m![2]!.toLowerCase().slice(0, 3)));
    const iso = `${m[3]}-${pad(mi + 1)}-${pad(Number(m[1]))}`;
    return mi >= 0 && parseIso(iso) ? iso : null;
  }
  return null;
}
const serial = (iso: string): number | null => {
  const p = parseIso(iso);
  return p ? serialOf(p.y, p.m, p.d) : null;
};
const isoFromSerial = (n: number): string => {
  const d = dateOf(n);
  return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
};
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------- the properties' words

export const KIND_NAMES: Record<PropKind, string> = {
  text: 'Text', number: 'Number', select: 'Select', multi: 'Multi-select', date: 'Date', check: 'Checkbox', person: 'Person', relation: 'Relation', rollup: 'Rollup', formula: 'Formula',
};
export const VIEW_NAMES: Record<ViewKind, string> = { table: 'TABLE', board: 'BOARD', calendar: 'CALENDAR', timeline: 'TIMELINE', gallery: 'GALLERY' };
export const ROLL_NAMES: Record<RollFn, string> = { count: 'Count', sum: 'Sum', average: 'Average', latest: 'Latest' };

// ---------------------------------------------------------------- databases and their rows

export const dbOf = (ws: Workspace, id: string): Database | undefined => ws.pages[id]?.db;
export const propOf = (db: Database | undefined, id: string | undefined): Prop | undefined => db?.props.find((p) => p.id === id);
export const propNamed = (db: Database, name: string): Prop | undefined => db.props.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
export const viewOf = (db: Database | undefined, id: string | undefined): View | undefined => db?.views.find((v) => v.id === id) ?? db?.views[0];
/** Every live database in the workspace. */
export const databases = (ws: Workspace): Page[] => live(ws).filter((p) => !!p.db && !(p.parent && ws.pages[p.parent]?.deleted));

const mkView = (kind: ViewKind, db: Database | null, name?: string): View => {
  const select = db?.props.find((p) => p.kind === 'select');
  const dates = db?.props.filter((p) => p.kind === 'date') ?? [];
  return {
    id: viewId(), name: name ?? VIEW_NAMES[kind], kind, hidden: [],
    ...(kind === 'board' && select ? { by: select.id } : {}),
    ...(kind === 'calendar' && dates[0] ? { by: dates[0].id } : {}),
    ...(kind === 'timeline' && dates[0] ? { by: dates[0].id, ...(dates[1] ? { end: dates[1].id } : {}) } : {}),
  };
};
export const newView = mkView;

/** A database made as a page (its views start as a TABLE). */
export function newDatabase(ws: Workspace, o: { title: string; parent?: string | null; icon?: string; props?: Omit<Prop, 'id'>[]; views?: ViewKind[]; from?: string; id?: string }): { ws: Workspace; page: Page } {
  const id = o.id ?? pageId();
  const props: Prop[] = (o.props ?? []).map((p) => ({ ...p, id: propId() }));
  const db: Database = { props, views: [] };
  for (const k of o.views ?? ['table']) db.views.push(mkView(k, db));
  const now = Date.now();
  const parent = o.parent ?? null;
  const order = Math.max(-1, ...Object.values(ws.pages).filter((p) => p.parent === parent).map((p) => p.order)) + 1;
  const page: Page = { id, title: o.title, icon: o.icon ?? 'table', parent, blocks: [], at: now, created: now, order, db, ...(o.from ? { from: o.from } : {}) };
  return { ws: { ...ws, pages: { ...ws.pages, [id]: page }, at: now }, page };
}
const withDb = (ws: Workspace, dbId: string, f: (db: Database) => Database): Workspace => patchPage(ws, dbId, (p) => (p.db ? { ...p, db: f(p.db) } : p));

export function addProp(ws: Workspace, dbId: string, p: Omit<Prop, 'id'>): { ws: Workspace; prop: Prop | null } {
  const db = dbOf(ws, dbId);
  if (!db) return { ws, prop: null };
  const prop: Prop = { ...p, id: propId(), name: uniqueName(db, p.name || KIND_NAMES[p.kind]) };
  if ((prop.kind === 'select' || prop.kind === 'multi') && !prop.options) prop.options = [];
  return { ws: withDb(ws, dbId, (d) => ({ ...d, props: [...d.props, prop] })), prop };
}
const uniqueName = (db: Database, want: string, except = ''): string => {
  let name = want.trim() || 'Property';
  let n = 2;
  while (db.props.some((x) => x.id !== except && x.name.trim().toLowerCase() === name.toLowerCase())) name = `${want.trim()} ${n++}`;
  return name;
};
export const renameProp = (ws: Workspace, dbId: string, id: string, name: string): Workspace =>
  withDb(ws, dbId, (d) => ({ ...d, props: d.props.map((p) => (p.id === id ? { ...p, name: uniqueName(d, name, id) } : p)) }));
export const patchProp = (ws: Workspace, dbId: string, id: string, f: (p: Prop) => Prop): Workspace => withDb(ws, dbId, (d) => ({ ...d, props: d.props.map((p) => (p.id === id ? f(p) : p)) }));
export function removeProp(ws: Workspace, dbId: string, id: string): Workspace {
  let out = withDb(ws, dbId, (d) => ({
    props: d.props.filter((p) => p.id !== id && p.roll?.via !== id),
    views: d.views.map((v) => ({
      ...v, hidden: v.hidden.filter((h) => h !== id),
      ...(v.by === id ? { by: undefined } : {}), ...(v.end === id ? { end: undefined } : {}),
      sort: v.sort?.prop === id ? null : v.sort, filter: v.filter?.prop === id ? null : v.filter,
    })),
  }));
  for (const r of rowsOf(out, dbId)) if (r.vals && id in r.vals) out = patchPage(out, r.id, (p) => ({ ...p, vals: Object.fromEntries(Object.entries(p.vals ?? {}).filter(([k]) => k !== id)) }));
  return out;
}
export function moveProp(ws: Workspace, dbId: string, id: string, by: -1 | 1): Workspace {
  return withDb(ws, dbId, (d) => {
    const i = d.props.findIndex((p) => p.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= d.props.length) return d;
    const props = [...d.props];
    [props[i], props[j]] = [props[j]!, props[i]!];
    return { ...d, props };
  });
}
export const addOption = (ws: Workspace, dbId: string, id: string, option: string): Workspace =>
  option.trim() ? patchProp(ws, dbId, id, (p) => ((p.options ?? []).some((o) => o.toLowerCase() === option.trim().toLowerCase()) ? p : { ...p, options: [...(p.options ?? []), option.trim()] })) : ws;

/** A view added; a board with no select to make columns of gets a Status, a calendar or timeline with no date gets a Date. */
export function addView(ws: Workspace, dbId: string, kind: ViewKind): { ws: Workspace; view: View | null } {
  let out = ws;
  let db = dbOf(out, dbId);
  if (!db) return { ws, view: null };
  if (kind === 'board' && !db.props.some((p) => p.kind === 'select')) out = addProp(out, dbId, { name: 'Status', kind: 'select', options: ['To do', 'Doing', 'Done'] }).ws;
  if ((kind === 'calendar' || kind === 'timeline') && !db.props.some((p) => p.kind === 'date')) out = addProp(out, dbId, { name: 'Date', kind: 'date' }).ws;
  db = dbOf(out, dbId)!;
  const same = db.views.filter((v) => v.kind === kind).length;
  const view = mkView(kind, db, same ? `${VIEW_NAMES[kind]} ${same + 1}` : undefined);
  return { ws: withDb(out, dbId, (d) => ({ ...d, views: [...d.views, view] })), view };
}
export const removeView = (ws: Workspace, dbId: string, id: string): Workspace => withDb(ws, dbId, (d) => (d.views.length > 1 ? { ...d, views: d.views.filter((v) => v.id !== id) } : d));
export const patchView = (ws: Workspace, dbId: string, id: string, f: (v: View) => View): Workspace => withDb(ws, dbId, (d) => ({ ...d, views: d.views.map((v) => (v.id === id ? f(v) : v)) }));

export function addRow(ws: Workspace, dbId: string, title = '', vals: Record<string, PVal> = {}): { ws: Workspace; row: Page } {
  const now = Date.now();
  const order = Math.max(-1, ...Object.values(ws.pages).filter((p) => p.parent === dbId).map((p) => p.order)) + 1;
  const row: Page = { id: pageId(), title, icon: 'page', parent: dbId, blocks: [], at: now, created: now, order, vals: { ...vals } };
  return { ws: { ...ws, pages: { ...ws.pages, [row.id]: row }, at: now }, row };
}
export const setVal = (ws: Workspace, rowId: string, prop: string, v: PVal): Workspace => patchPage(ws, rowId, (p) => ({ ...p, vals: { ...(p.vals ?? {}), [prop]: v } }));
export const valOf = (p: Page, prop: string): PVal => p.vals?.[prop] ?? null;

// ---------------------------------------------------------------- the engine: the databases laid as one Book

export interface Calc {
  book: Book;
  engine: Engine;
  sheetOf: Map<string, string>;
  rowAt: Map<string, number>;
  /** A formula or rollup that could not work, in his words, by `${row}:${prop}`. */
  problems: Map<string, string>;
}
const cache = new WeakMap<Workspace, Calc>();
const PROP_REF = /\bprop\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\)/gi;

export function calcOf(ws: Workspace): Calc {
  const hit = cache.get(ws);
  if (hit) return hit;
  const dbs = databases(ws);
  const sheetOf = new Map<string, string>();
  dbs.forEach((d, i) => sheetOf.set(d.id, `db_${i + 1}`));
  const rowAt = new Map<string, number>();
  const problems = new Map<string, string>();
  const colOf = (d: Page, id: string): number => d.db!.props.findIndex((p) => p.id === id) + 1;
  for (const d of dbs) rowsOf(ws, d.id).forEach((r, i) => rowAt.set(r.id, i + 1));
  const sheets = dbs.map((d) => {
    const cells: Record<string, Cell> = { A1: { v: 'Name' } };
    d.db!.props.forEach((p, c) => (cells[addr(0, c + 1)] = { v: p.name }));
    for (const r of rowsOf(ws, d.id)) {
      const row = rowAt.get(r.id)!;
      cells[addr(row, 0)] = { v: r.title };
      d.db!.props.forEach((p, c) => {
        const a = addr(row, c + 1);
        const raw = r.vals?.[p.id] ?? null;
        switch (p.kind) {
          case 'text': case 'person': case 'select':
            if (typeof raw === 'string' && raw) cells[a] = { v: raw };
            break;
          case 'number':
            if (typeof raw === 'number') cells[a] = { v: raw };
            else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) cells[a] = { v: Number(raw) };
            break;
          case 'multi':
            if (Array.isArray(raw) && raw.length) cells[a] = { v: raw.join(', ') };
            break;
          case 'date': {
            const s = typeof raw === 'string' ? serial(raw) : null;
            if (s !== null) cells[a] = { v: s, x: { n: 'date' } };
            break;
          }
          case 'check':
            cells[a] = { v: raw === true };
            break;
          case 'relation':
            if (Array.isArray(raw) && raw.length) cells[a] = { v: raw.map((id) => ws.pages[id]?.title ?? '').filter(Boolean).join(', ') };
            break;
          case 'rollup': {
            const roll = p.roll;
            const via = d.db!.props.find((x) => x.id === roll?.via);
            const target = via?.rel ? ws.pages[via.rel] : undefined;
            const ids = (Array.isArray(r.vals?.[roll?.via ?? '']) ? (r.vals![roll!.via] as string[]) : []).filter((id) => ws.pages[id] && !ws.pages[id]!.deleted);
            if (!roll || !via || !target?.db) {
              problems.set(`${r.id}:${p.id}`, 'This rollup has no relation to look through. Pick the relation and the property to add up.');
              cells[a] = { v: err('#REF!') };
              break;
            }
            if (roll.fn === 'count') {
              cells[a] = { v: ids.length };
              break;
            }
            const ofCol = colOf(target, roll.of);
            const sheet = sheetOf.get(target.id);
            if (ofCol <= 0 || !sheet) {
              problems.set(`${r.id}:${p.id}`, 'The property this rollup adds up is not on the related database any more.');
              cells[a] = { v: err('#REF!') };
              break;
            }
            const refs = ids.flatMap((id) => (rowAt.has(id) ? [`${sheet}!${addr(rowAt.get(id)!, ofCol)}`] : []));
            if (!refs.length) {
              if (roll.fn === 'sum') cells[a] = { v: 0 };
              break;
            }
            cells[a] = { f: `${roll.fn === 'sum' ? 'SUM' : roll.fn === 'average' ? 'AVERAGE' : 'MAX'}(${refs.join(',')})`, ...(roll.fn === 'latest' ? { x: { n: 'date' as const } } : {}) };
            break;
          }
          case 'formula': {
            const text = (p.formula ?? '').trim().replace(/^=/, '');
            if (!text) break;
            let bad = '';
            const f = text.replace(PROP_REF, (_m, a1: string | undefined, a2: string | undefined) => {
              const name = (a1 ?? a2 ?? '').replace(/\\(.)/g, '$1');
              if (name.trim().toLowerCase() === 'name') return addr(row, 0);
              const i = d.db!.props.findIndex((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
              if (i < 0) {
                bad = `There is no property called “${name}” on this database. Check the spelling, or add it.`;
                return '0';
              }
              return addr(row, i + 1);
            });
            if (bad) {
              problems.set(`${r.id}:${p.id}`, bad);
              cells[a] = { v: err('#NAME?') };
            } else cells[a] = { f };
            break;
          }
        }
      });
    }
    return { name: sheetOf.get(d.id)!, cells, widths: {}, heights: {}, frozen: false };
  });
  if (!sheets.length) sheets.push({ name: 'db_0', cells: {}, widths: {}, heights: {}, frozen: false });
  const book: Book = { id: 'workspace', title: 'Workspace', at: ws.at, sheets, names: {}, charts: [], view: { sheet: 0, sel: 'A1' } };
  const out: Calc = { book, engine: new Engine(book), sheetOf, rowAt, problems };
  cache.set(ws, out);
  return out;
}

export interface Shown {
  /** The value as the engine worked it (null: nothing). */
  v: Val;
  text: string;
  /** Why it could not be worked, in his one line. */
  error?: string;
}
/** What a property holds for a row, as shown: formulas and rollups worked by the engine; the rest as written. */
export function shown(ws: Workspace, dbId: string, row: Page, prop: Prop): Shown {
  const raw = row.vals?.[prop.id] ?? null;
  if (prop.kind === 'formula' || prop.kind === 'rollup') {
    const c = calcOf(ws);
    const sheet = c.sheetOf.get(dbId);
    const r = c.rowAt.get(row.id);
    const col = (ws.pages[dbId]?.db?.props.findIndex((x) => x.id === prop.id) ?? -1) + 1;
    if (!sheet || !r || col <= 0) return { v: null, text: '' };
    const a = addr(r, col);
    const v = c.engine.value(sheet, a);
    const mine = c.problems.get(`${row.id}:${prop.id}`);
    if (isErr(v)) return { v, text: v.e, error: mine ?? errorWords(v.e) };
    if (prop.kind === 'formula' && !(prop.formula ?? '').trim()) return { v: null, text: '' };
    const cell = c.book.sheets.find((s) => s.name === sheet)?.cells[a];
    let text = formatValue(v, cell?.x);
    if (typeof v === 'number' && cell?.x?.n === 'date') text = dateWords(isoFromSerial(v));
    else if (typeof v === 'boolean') text = v ? '✓' : '';
    return { v, text };
  }
  switch (prop.kind) {
    case 'date': return { v: typeof raw === 'string' ? raw : null, text: typeof raw === 'string' && raw ? dateWords(raw) : '' };
    case 'check': return { v: raw === true, text: raw === true ? '✓' : '' };
    case 'multi': return { v: Array.isArray(raw) ? raw.join(', ') : null, text: Array.isArray(raw) ? raw.join(', ') : '' };
    case 'relation': return { v: null, text: Array.isArray(raw) ? raw.map((id) => ws.pages[id]?.title.trim() || 'Untitled').join(', ') : '' };
    case 'number': return { v: typeof raw === 'number' ? raw : null, text: typeof raw === 'number' ? String(Number(raw.toPrecision(12))) : '' };
    default: return { v: typeof raw === 'string' ? raw : null, text: typeof raw === 'string' ? raw : '' };
  }
}
/** The engine's errors in Ghosty's one line. */
export const errorWords = (code: string): string => Engine.explain(code);

// ---------------------------------------------------------------- what a view shows: filter, sort, hide

const rawFor = (ws: Workspace, dbId: string, row: Page, prop: Prop): string | number | boolean | string[] | null => {
  if (prop.kind === 'formula' || prop.kind === 'rollup') {
    const s = shown(ws, dbId, row, prop);
    return isErr(s.v) ? null : (s.v as string | number | boolean | null);
  }
  if (prop.kind === 'relation') return (Array.isArray(row.vals?.[prop.id]) ? (row.vals![prop.id] as string[]) : []).map((id) => ws.pages[id]?.title ?? '');
  return row.vals?.[prop.id] ?? null;
};
const isEmptyVal = (v: unknown): boolean => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || v === false;
function matches(ws: Workspace, dbId: string, row: Page, db: Database, f: Filter): boolean {
  const prop = f.prop === 'name' ? null : propOf(db, f.prop);
  if (f.prop !== 'name' && !prop) return true;
  const v = prop ? rawFor(ws, dbId, row, prop) : row.title;
  const s = (Array.isArray(v) ? v.join(', ') : String(v ?? '')).toLowerCase();
  const want = f.value.trim().toLowerCase();
  switch (f.op) {
    case 'empty': return isEmptyVal(v);
    case 'filled': return !isEmptyVal(v);
    case 'checked': return v === true;
    case 'unchecked': return v !== true;
    case 'is': return Array.isArray(v) ? v.some((x) => x.toLowerCase() === want) : s === want;
    case 'isnot': return Array.isArray(v) ? !v.some((x) => x.toLowerCase() === want) : s !== want;
    case 'contains': return s.includes(want);
    case 'over':
    case 'under': {
      const a = typeof v === 'number' ? v : Number(v);
      const b = Number(want);
      if (prop?.kind === 'date' || (isIso(v) && isIso(f.value))) return isIso(v) && isIso(f.value) ? (f.op === 'over' ? v > f.value : v < f.value) : false;
      if (v === null || v === '' || Number.isNaN(a) || Number.isNaN(b)) return false;
      return f.op === 'over' ? a > b : a < b;
    }
  }
}
/** The rows a view shows, in its order. `all`: how many rows the database has (so a filter that hides everything can say so). */
export function viewRows(ws: Workspace, dbId: string, view: View | undefined): { rows: Page[]; all: number; hiddenByFilter: boolean } {
  const db = dbOf(ws, dbId);
  const all = rowsOf(ws, dbId);
  if (!db || !view) return { rows: all, all: all.length, hiddenByFilter: false };
  let rows = all;
  if (view.filter) rows = rows.filter((r) => matches(ws, dbId, r, db, view.filter!));
  if (view.sort) {
    const prop = view.sort.prop === 'name' ? null : propOf(db, view.sort.prop);
    const dir = view.sort.dir === 'desc' ? -1 : 1;
    const key = (r: Page): string | number | null => {
      const v = prop ? rawFor(ws, dbId, r, prop) : r.title;
      if (isEmptyVal(v) && v !== 0) return null;
      return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? Number(v) : (v as string | number);
    };
    rows = [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en-GB', { numeric: true, sensitivity: 'base' })) * dir;
    });
  }
  return { rows, all: all.length, hiddenByFilter: !!view.filter && all.length > 0 && rows.length === 0 };
}
export const visibleProps = (db: Database, view: View | undefined): Prop[] => db.props.filter((p) => !view?.hidden.includes(p.id));

// ---------------------------------------------------------------- the five views

export interface BoardColumn {
  key: string;
  name: string;
  rows: Page[];
  /** The "No status" column: rows that have none. */
  none?: boolean;
}
export function boardColumns(ws: Workspace, dbId: string, view: View): { columns: BoardColumn[]; prop: Prop | null } {
  const db = dbOf(ws, dbId);
  const prop = propOf(db, view.by);
  if (!db || !prop) return { columns: [], prop: null };
  const rows = viewRows(ws, dbId, view).rows;
  const opts = prop.options ?? [];
  const columns: BoardColumn[] = opts.map((o) => ({ key: o, name: o, rows: rows.filter((r) => r.vals?.[prop.id] === o) }));
  const stray = rows.filter((r) => typeof r.vals?.[prop.id] === 'string' && r.vals[prop.id] !== '' && !opts.includes(r.vals[prop.id] as string));
  for (const o of [...new Set(stray.map((r) => r.vals![prop.id] as string))]) columns.push({ key: o, name: o, rows: stray.filter((r) => r.vals![prop.id] === o) });
  const none = rows.filter((r) => !r.vals?.[prop.id]);
  columns.push({ key: '', name: `No ${prop.name.toLowerCase()}`, rows: none, none: true });
  return { columns, prop };
}
/** A card dragged to another column changes the select. */
export const moveCard = (ws: Workspace, rowId: string, prop: string, to: string): Workspace => setVal(ws, rowId, prop, to || null);

export interface Day {
  iso: string;
  d: number;
  inMonth: boolean;
  rows: Page[];
}
/** A month as weeks (Monday first), each day with the rows dated on it. */
export function monthGrid(ws: Workspace, dbId: string, view: View, ym: string): { weeks: Day[][]; undated: Page[]; prop: Prop | null } {
  const db = dbOf(ws, dbId);
  const prop = propOf(db, view.by);
  if (!db || !prop) return { weeks: [], undated: [], prop: null };
  const rows = viewRows(ws, dbId, view).rows;
  const byDay = new Map<string, Page[]>();
  const undated: Page[] = [];
  for (const r of rows) {
    const v = rawFor(ws, dbId, r, prop);
    if (isIso(v)) byDay.set(v, [...(byDay.get(v) ?? []), r]);
    else undated.push(r);
  }
  const first = `${ym}-01`;
  const dow = (new Date(utcDay(first) * 86_400_000).getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  const weeks: Day[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(start, w * 7 + i);
      week.push({ iso, d: Number(iso.slice(8)), inMonth: monthOf(iso) === ym, rows: byDay.get(iso) ?? [] });
    }
    if (w >= 4 && !week.some((x) => x.inMonth)) break;
    weeks.push(week);
  }
  return { weeks, undated, prop };
}
export interface Bar {
  row: Page;
  start: string;
  end: string;
  /** Whole days, the first day counted. */
  days: number;
}
export function timelineBars(ws: Workspace, dbId: string, view: View): { bars: Bar[]; first: string; last: string; undated: Page[]; prop: Prop | null } {
  const db = dbOf(ws, dbId);
  const prop = propOf(db, view.by);
  const endProp = propOf(db, view.end);
  if (!db || !prop) return { bars: [], first: '', last: '', undated: [], prop: null };
  const rows = viewRows(ws, dbId, view).rows;
  const bars: Bar[] = [];
  const undated: Page[] = [];
  for (const r of rows) {
    const a = rawFor(ws, dbId, r, prop);
    if (!isIso(a)) {
      undated.push(r);
      continue;
    }
    const e = endProp ? rawFor(ws, dbId, r, endProp) : null;
    let start = a;
    let end = isIso(e) ? e : a;
    if (end < start) [start, end] = [end, start];
    bars.push({ row: r, start, end, days: dayDiff(start, end) + 1 });
  }
  const first = bars.reduce((m, b) => (m && m < b.start ? m : b.start), '');
  const last = bars.reduce((m, b) => (m && m > b.end ? m : b.end), '');
  return { bars, first, last, undated, prop };
}
export interface Card {
  row: Page;
  title: string;
  /** The first picture in the row's page (its id in the picture store). */
  img?: string;
  alt?: string;
  lines: string[];
}
export function galleryCards(ws: Workspace, dbId: string, view: View): Card[] {
  const db = dbOf(ws, dbId);
  if (!db) return [];
  const props = visibleProps(db, view);
  return viewRows(ws, dbId, view).rows.map((r) => {
    const pic = r.blocks.find((b) => b.t === 'img' && b.img);
    return {
      row: r,
      title: r.title.trim() || 'Untitled',
      ...(pic ? { img: pic.img, alt: pic.alt ?? '' } : {}),
      lines: props.map((p) => shown(ws, dbId, r, p)).filter((s, i) => s.text && props[i]!.kind !== 'check').slice(0, 2).map((s) => s.text),
    };
  });
}

// ---------------------------------------------------------------- done, and due

export function isDone(ws: Workspace, dbId: string, row: Page): boolean {
  const db = dbOf(ws, dbId);
  if (!db) return false;
  for (const p of db.props) {
    if (p.kind === 'check' && /\b(done|complete[d]?|finished)\b/i.test(p.name) && row.vals?.[p.id] === true) return true;
    if (p.kind === 'select' && typeof row.vals?.[p.id] === 'string' && /^(done|complete[d]?|finished|shipped)$/i.test(row.vals[p.id] as string)) return true;
  }
  return false;
}
export interface Due {
  row: Page;
  db: Page;
  prop: string;
  date: string;
}
/** Rows dated from `from` for `days` days, in date order, not done (every date property counts; his dates are his data). `within`: only that project's pages. */
export function dueRows(ws: Workspace, from: string, days: number, within?: string, includeDone = false): Due[] {
  const last = addDays(from, days - 1);
  const out: Due[] = [];
  for (const d of databases(ws)) {
    if (within && !isUnder(ws, d.id, within)) continue;
    for (const r of rowsOf(ws, d.id)) {
      if (!includeDone && isDone(ws, d.id, r)) continue;
      for (const p of d.db!.props) {
        if (p.kind !== 'date') continue;
        const v = r.vals?.[p.id];
        if (isIso(v) && v >= from && v <= last) out.push({ row: r, db: d, prop: p.name, date: v });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.row.title.localeCompare(b.row.title));
}
const isUnder = (ws: Workspace, id: string, root: string): boolean => {
  let at: Page | undefined = ws.pages[id];
  const seen = new Set<string>();
  while (at && !seen.has(at.id)) {
    if (at.id === root) return true;
    seen.add(at.id);
    at = at.parent ? ws.pages[at.parent] : undefined;
  }
  return false;
};

// ---------------------------------------------------------------- a row page's blocks (the first picture, for a card)

export const firstPicture = (p: Page): string | undefined => p.blocks.find((b) => b.t === 'img' && b.img)?.img;
export { wblock, putPage, colName };
