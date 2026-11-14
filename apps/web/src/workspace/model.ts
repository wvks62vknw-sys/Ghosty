/**
 * THE WORKSPACE (BRIEF-EDITOR-WORKSPACE; MAKE → THE WORKSPACE): the core of Notion on the phone. Pages inside pages without limit, each with a
 * title, a mark, blocks (the documents' Block and Run, so headings, lists, tables, pictures, bold and links are the same code, plus a page
 * link, a database view and a to-do), a database being a page whose rows are pages. Everything here is immutable (a change makes a new
 * workspace sharing what it did not touch), so undo is a step back and a snapshot is cheap. Pure: apps/edge/test/workspace.test.mjs.
 */
import { blockId, tidyRuns, type Block, type Run } from '../docs/model';

export type WType = Block['t'] | 'todo' | 'link' | 'view' | 'callout' | 'toggle';
/** A callout's kind: a note, a tip, or a warning (its mark and its tint). */
export type Tone = 'note' | 'tip' | 'warn';
export const TONES: Tone[] = ['note', 'tip', 'warn'];
export interface Comment {
  id: string;
  text: string;
  at: number;
}
export interface WBlock extends Omit<Block, 't'> {
  t: WType;
  /** A to-do: when it was ticked (ms); 0 or missing when it is not. */
  done?: number;
  /** A page link: the page's id, or "doc:<id>" for one of MY DOCUMENTS. */
  to?: string;
  /** A database view: the database's page id, and which of its views this block shows. */
  db?: string;
  view?: string;
  /** A callout: which kind (left out: a note). */
  tone?: Tone;
  /** His own words to himself on this block, dated. */
  comments?: Comment[];
  /** Inside a toggle: that toggle's block id (folded away with it). */
  under?: string;
  /** A toggle: folded shut (its blocks out of sight). */
  folded?: boolean;
  /** A synced block: its group's id; every block of the group, on any page, holds the same words. */
  sync?: string;
}

export type PropKind = 'text' | 'number' | 'select' | 'multi' | 'date' | 'check' | 'person' | 'relation' | 'rollup' | 'formula';
export type RollFn = 'count' | 'sum' | 'average' | 'latest';
export interface Prop {
  id: string;
  name: string;
  kind: PropKind;
  /** A select's and a multi-select's choices, in order. */
  options?: string[];
  /** A relation: the database (a page id) whose rows it points at. */
  rel?: string;
  /** A rollup: through which relation property, which property of the related rows, and how it is worked. */
  roll?: { via: string; of: string; fn: RollFn };
  /** A formula: its text, with prop("Name") for another property of the same row. */
  formula?: string;
}
/** What a row holds for a property: text, a number, a date as YYYY-MM-DD, true or false, the chosen ones, or the related rows' ids. */
export type PVal = string | number | boolean | string[] | null;
export type ViewKind = 'table' | 'board' | 'calendar' | 'timeline' | 'gallery';
export interface Filter {
  prop: string;
  op: 'is' | 'isnot' | 'contains' | 'empty' | 'filled' | 'over' | 'under' | 'checked' | 'unchecked';
  value: string;
}
export interface View {
  id: string;
  name: string;
  kind: ViewKind;
  /** The select a board's columns are made of; the date a calendar and a timeline begin on. */
  by?: string;
  /** A timeline's end date (left out: the bar is one day). */
  end?: string;
  sort?: { prop: string; dir: 'asc' | 'desc' } | null;
  filter?: Filter | null;
  hidden: string[];
  /** The month a calendar shows, "2026-11". */
  month?: string;
}
export interface Database {
  props: Prop[];
  views: View[];
}
export interface Page {
  id: string;
  title: string;
  /** One of ICONS' keys. */
  icon: string;
  /** The page it sits inside (null: at the top). A row's parent is its database. */
  parent: string | null;
  blocks: WBlock[];
  /** Last changed (ms). */
  at: number;
  created: number;
  /** Its place among its brothers and sisters. */
  order: number;
  /** A database: its properties and views. */
  db?: Database;
  /** A row: its values by property id. */
  vals?: Record<string, PVal>;
  /** When it went to the BIN (ms). */
  deleted?: number;
  /** Where it came from ("made here", "from a CSV", "a document added"). */
  from?: string;
}
export interface Version {
  at: number;
  title: string;
  icon: string;
  blocks: WBlock[];
  vals?: Record<string, PVal>;
}
export interface Workspace {
  v: 1;
  pages: Record<string, Page>;
  /** A page's snapshots, newest last, sixty at most. */
  versions: Record<string, Version[]>;
  at: number;
}

/** The marks a page may wear: the house's own thin-line marks (never an emoji set). */
export const ICONS: Record<string, { name: string; path: string }> = {
  page: { name: 'Page', path: '<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M9.5 12h5.5M9.5 15.5h5.5"/>' },
  project: { name: 'Project', path: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9.5h16M9 9.5V19M14.5 9.5V19"/>' },
  board: { name: 'Board', path: '<rect x="4" y="4.5" width="4.6" height="15" rx="1"/><rect x="9.7" y="4.5" width="4.6" height="9" rx="1"/><rect x="15.4" y="4.5" width="4.6" height="12" rx="1"/>' },
  calendar: { name: 'Calendar', path: '<rect x="4" y="5.5" width="16" height="14" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>' },
  table: { name: 'Table', path: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16M4 14.5h16M10 5v14"/>' },
  book: { name: 'Book', path: '<path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>' },
  trip: { name: 'Trip', path: '<path d="M3.5 12l17-7-5 15-3.5-6z"/><path d="M12 14l8.5-9"/>' },
  week: { name: 'Week', path: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>' },
  meeting: { name: 'Meeting', path: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.4"/><path d="M3.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M15 14.5c2.4 0 4 1.5 4.5 4"/>' },
  star: { name: 'Star', path: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>' },
  key: { name: 'Key', path: '<circle cx="8.5" cy="12" r="3.5"/><path d="M12 12h8.5M17 12v3M20 12v2"/>' },
  tag: { name: 'Tag', path: '<path d="M4 4.5h8l8 8-7.5 7.5-8-8z"/><circle cx="8.5" cy="9" r="1.2"/>' },
};

let seq = 0;
const uid = (p: string): string => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const pageId = (): string => uid('w');
export const propId = (): string => uid('p');
export const viewId = (): string => uid('v');
export const commentId = (): string => uid('c');

export const wblock = (t: WType, text: string | Run[] = '', extra: Partial<WBlock> = {}): WBlock => ({ id: blockId(), t, runs: typeof text === 'string' ? (text ? [{ text }] : []) : text, ...extra });
export const emptyWorkspace = (): Workspace => ({ v: 1, pages: {}, versions: {}, at: Date.now() });
export const isEmptyWorkspace = (ws: Workspace): boolean => !Object.values(ws.pages).some((p) => !p.deleted);

// ---------------------------------------------------------------- words of a block

const cell = (c: Run[]): string => c.map((r) => r.text).join('');
/** A block as the words it holds (a table row by row, a picture by its description, a link by its page's title when it is known). */
export function wText(b: WBlock, ws?: Workspace, docTitle?: (id: string) => string): string {
  if (b.t === 'table') return (b.rows ?? []).map((r) => r.map(cell).join('\t')).join('\n');
  if (b.t === 'img') return b.alt ?? '';
  if (b.t === 'pb') return '';
  if (b.t === 'link') {
    const t = b.to?.startsWith('doc:') ? docTitle?.(b.to.slice(4)) : b.to ? ws?.pages[b.to]?.title : '';
    return t ?? b.runs.map((r) => r.text).join('');
  }
  if (b.t === 'view') return ws?.pages[b.db ?? '']?.title ?? '';
  return b.runs.map((r) => r.text).join('');
}

// ---------------------------------------------------------------- the tree

export const live = (ws: Workspace): Page[] => Object.values(ws.pages).filter((p) => !p.deleted);
const byOrder = (a: Page, b: Page): number => a.order - b.order || a.created - b.created;
/** A page's children (a database's rows are its children too: callers ask `rows` for those and `children` for the sub-pages). */
export const children = (ws: Workspace, id: string | null): Page[] =>
  Object.values(ws.pages).filter((p) => p.parent === id && !p.deleted && !(id && ws.pages[id]?.db && p.vals)).sort(byOrder);
export const rowsOf = (ws: Workspace, dbId: string): Page[] => Object.values(ws.pages).filter((p) => p.parent === dbId && !p.deleted && !!p.vals).sort(byOrder);
export const isRow = (ws: Workspace, p: Page): boolean => !!p.vals && !!p.parent && !!ws.pages[p.parent]?.db;
export const isDb = (p: Page | undefined): boolean => !!p?.db;
/** Every page below one, at any depth (rows included). */
export function below(ws: Workspace, id: string): Page[] {
  const out: Page[] = [];
  const walk = (pid: string): void => {
    for (const p of Object.values(ws.pages).filter((x) => x.parent === pid && !x.deleted).sort(byOrder)) {
      out.push(p);
      walk(p.id);
    }
  };
  walk(id);
  return out;
}
/** The pages from the top down to this one ("Project › Tasks"). */
export function trail(ws: Workspace, id: string): Page[] {
  const out: Page[] = [];
  let at: Page | undefined = ws.pages[id];
  const seen = new Set<string>();
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    out.unshift(at);
    at = at.parent ? ws.pages[at.parent] : undefined;
  }
  return out;
}
/** The top-level page a page is under: the "project" it belongs to. */
export const projectOf = (ws: Workspace, id: string): Page | undefined => trail(ws, id)[0];
export const depth = (ws: Workspace, id: string): number => trail(ws, id).length - 1;

const touch = (ws: Workspace, pages: Record<string, Page>): Workspace => ({ ...ws, pages, at: Date.now() });
export function putPage(ws: Workspace, p: Page): Workspace {
  return touch(ws, { ...ws.pages, [p.id]: { ...p, at: Date.now() } });
}
export function patchPage(ws: Workspace, id: string, f: (p: Page) => Page): Workspace {
  const p = ws.pages[id];
  return p ? putPage(ws, f(p)) : ws;
}
const nextOrder = (ws: Workspace, parent: string | null): number => Math.max(-1, ...Object.values(ws.pages).filter((p) => p.parent === parent).map((p) => p.order)) + 1;

export function newPage(ws: Workspace, o: { title?: string; parent?: string | null; icon?: string; blocks?: WBlock[]; from?: string; id?: string } = {}): { ws: Workspace; page: Page } {
  const parent = o.parent ?? null;
  const now = Date.now();
  const page: Page = { id: o.id ?? pageId(), title: o.title ?? '', icon: o.icon ?? 'page', parent, blocks: o.blocks ?? [], at: now, created: now, order: nextOrder(ws, parent), ...(o.from ? { from: o.from } : {}) };
  return { ws: touch(ws, { ...ws.pages, [page.id]: page }), page };
}
export const titleOf = (p: Page | undefined): string => (p?.title.trim() ? p.title.trim() : 'Untitled');

/** Is `id` the page `ancestor` or somewhere below it? */
export const isInside = (ws: Workspace, id: string, ancestor: string): boolean => trail(ws, id).some((p) => p.id === ancestor);

/** Move a page under another (or to the top with null). A page cannot go under itself or its own child: the move is refused and says why. */
export function movePage(ws: Workspace, id: string, to: string | null): { ws: Workspace; error?: string } {
  const p = ws.pages[id];
  if (!p) return { ws, error: 'That page is not here any more.' };
  if (to === p.parent) return { ws };
  if (to && isInside(ws, to, id)) return { ws, error: to === id ? 'A page cannot go inside itself.' : 'A page cannot go inside one of its own pages: that would lose both. Move the inner one out first.' };
  if (to && !ws.pages[to]) return { ws, error: 'That page is not here any more.' };
  if (to && ws.pages[to]!.deleted) return { ws, error: 'That page is in the BIN.' };
  return { ws: putPage(ws, { ...p, parent: to, order: nextOrder(ws, to) }) };
}
/** One place up or down among its brothers and sisters (the one-hand keys beside drag). */
export function shiftPage(ws: Workspace, id: string, by: -1 | 1): Workspace {
  const p = ws.pages[id];
  if (!p) return ws;
  const sibs = Object.values(ws.pages).filter((x) => x.parent === p.parent && !x.deleted && !!x.vals === !!p.vals).sort(byOrder);
  const i = sibs.findIndex((x) => x.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= sibs.length) return ws;
  const order = sibs.map((x) => x.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  const pages = { ...ws.pages };
  order.forEach((pid, k) => {
    pages[pid] = { ...pages[pid]!, order: k };
  });
  return touch(ws, pages);
}
/** Put a page at a place among its brothers and sisters (drag). */
export function placePage(ws: Workspace, id: string, index: number): Workspace {
  const p = ws.pages[id];
  if (!p) return ws;
  const sibs = Object.values(ws.pages).filter((x) => x.parent === p.parent && !x.deleted && !!x.vals === !!p.vals && x.id !== id).sort(byOrder);
  sibs.splice(Math.max(0, Math.min(sibs.length, index)), 0, p);
  const pages = { ...ws.pages };
  sibs.forEach((x, k) => {
    pages[x.id] = { ...pages[x.id]!, order: k };
  });
  return touch(ws, pages);
}

// ---------------------------------------------------------------- the BIN: thirty days

export const BIN_DAYS = 30;
const DAY = 86_400_000;
/** A page and everything below it goes to the BIN (kept thirty days). */
export function deletePage(ws: Workspace, id: string, now = Date.now()): Workspace {
  if (!ws.pages[id]) return ws;
  const ids = [id, ...below(ws, id).map((p) => p.id)];
  const pages = { ...ws.pages };
  for (const i of ids) pages[i] = { ...pages[i]!, deleted: now, at: now };
  return touch(ws, pages);
}
/** Put a page back from the BIN with everything that went with it (its parent too, when that is in the BIN). */
export function restorePage(ws: Workspace, id: string): Workspace {
  const p = ws.pages[id];
  if (!p?.deleted) return ws;
  const at = p.deleted;
  const pages = { ...ws.pages };
  const back = (pid: string): void => {
    const x = pages[pid];
    if (!x?.deleted) return;
    const { deleted: _d, ...rest } = x;
    pages[pid] = { ...rest, at: Date.now() };
    if (x.parent && pages[x.parent]?.deleted) back(x.parent);
  };
  back(id);
  for (const x of Object.values(ws.pages)) if (x.deleted === at && isInside(ws, x.id, id)) back(x.id);
  return touch(ws, pages);
}
export const binned = (ws: Workspace): Page[] => Object.values(ws.pages).filter((p) => p.deleted && !(p.parent && ws.pages[p.parent]?.deleted === p.deleted)).sort((a, b) => b.deleted! - a.deleted!);
export const binDaysLeft = (p: Page, now = Date.now()): number => Math.max(0, Math.ceil((p.deleted! + BIN_DAYS * DAY - now) / DAY));
/** Pages in the BIN past thirty days let go for good; how many. */
export function purgeBin(ws: Workspace, now = Date.now()): { ws: Workspace; gone: number } {
  const old = new Set(Object.values(ws.pages).filter((p) => p.deleted && now - p.deleted > BIN_DAYS * DAY).map((p) => p.id));
  if (!old.size) return { ws, gone: 0 };
  const pages = Object.fromEntries(Object.entries(ws.pages).filter(([k]) => !old.has(k)));
  const versions = Object.fromEntries(Object.entries(ws.versions).filter(([k]) => !old.has(k)));
  return { ws: { ...ws, pages, versions, at: Date.now() }, gone: old.size };
}
export function emptyBin(ws: Workspace): { ws: Workspace; gone: number } {
  const old = new Set(Object.values(ws.pages).filter((p) => p.deleted).map((p) => p.id));
  const pages = Object.fromEntries(Object.entries(ws.pages).filter(([k]) => !old.has(k)));
  const versions = Object.fromEntries(Object.entries(ws.versions).filter(([k]) => !old.has(k)));
  return { ws: { ...ws, pages, versions, at: Date.now() }, gone: old.size };
}

/** A copy of a page and everything below it, under the same parent (a row's copy is a new row). */
export function duplicatePage(ws: Workspace, id: string): { ws: Workspace; id: string } {
  const p = ws.pages[id];
  if (!p) return { ws, id };
  const map = new Map<string, string>();
  const group = [p, ...below(ws, id)];
  for (const x of group) map.set(x.id, pageId());
  const now = Date.now();
  const pages = { ...ws.pages };
  const props = new Map<string, string>();
  for (const x of group) {
    if (x.db) for (const pr of x.db.props) props.set(`${x.id}:${pr.id}`, propId());
  }
  for (const x of group) {
    const copy: Page = JSON.parse(JSON.stringify(x)) as Page;
    copy.id = map.get(x.id)!;
    copy.created = now;
    copy.at = now;
    // (new block ids; a line inside a toggle follows its toggle's new id)
    const bids = new Map(copy.blocks.map((b) => [b.id, blockId()]));
    copy.blocks = copy.blocks.map((b) => ({ ...b, id: bids.get(b.id)!, ...(b.db && map.has(b.db) ? { db: map.get(b.db)! } : {}), ...(b.under ? { under: bids.get(b.under) ?? b.under } : {}) }));
    if (x.id === id) {
      copy.title = `${x.title.trim() || 'Untitled'} copy`;
      copy.order = nextOrder(ws, x.parent);
    } else {
      copy.parent = map.get(x.parent ?? '') ?? x.parent;
    }
    pages[copy.id] = copy;
  }
  // a copied database keeps its own properties' meaning: new property ids, rows' values moved across
  for (const x of group) {
    if (!x.db) continue;
    const nid = map.get(x.id)!;
    const rename = (pid: string): string => props.get(`${x.id}:${pid}`) ?? pid;
    const c = pages[nid]!;
    pages[nid] = {
      ...c,
      db: {
        props: c.db!.props.map((pr) => ({ ...pr, id: rename(pr.id), ...(pr.roll ? { roll: { ...pr.roll, via: rename(pr.roll.via) } } : {}) })),
        views: c.db!.views.map((v) => ({ ...v, id: viewId(), ...(v.by ? { by: rename(v.by) } : {}), ...(v.end ? { end: rename(v.end) } : {}), hidden: v.hidden.map(rename), ...(v.sort ? { sort: { ...v.sort, prop: rename(v.sort.prop) } } : {}), ...(v.filter ? { filter: { ...v.filter, prop: rename(v.filter.prop) } } : {}) })),
      },
    };
    for (const r of rowsOf(ws, x.id)) {
      const row = pages[map.get(r.id)!]!;
      pages[row.id] = { ...row, vals: Object.fromEntries(Object.entries(r.vals ?? {}).map(([k, v]) => [rename(k), v])) };
    }
  }
  return { ws: touch(ws, pages), id: map.get(id)! };
}

// ---------------------------------------------------------------- backlinks, computed from the store and never kept twice

/** Every live page whose blocks link to this one (or show it as a database), each once, with the block that does. */
export function backlinks(ws: Workspace, id: string): { page: Page; block: WBlock }[] {
  const out: { page: Page; block: WBlock }[] = [];
  for (const p of live(ws)) {
    if (p.id === id) continue;
    const b = p.blocks.find((x) => (x.t === 'link' && x.to === id) || (x.t === 'view' && x.db === id));
    if (b) out.push({ page: p, block: b });
  }
  return out.sort((a, b) => b.page.at - a.page.at);
}
/** The documents (MY DOCUMENTS ids) a page links to. */
export const docLinks = (p: Page): string[] => p.blocks.filter((b) => b.t === 'link' && b.to?.startsWith('doc:')).map((b) => b.to!.slice(4));

// ---------------------------------------------------------------- blocks

export const withBlocks = (ws: Workspace, id: string, f: (b: WBlock[]) => WBlock[]): Workspace => patchPage(ws, id, (p) => ({ ...p, blocks: f(p.blocks) }));
export const setTitle = (ws: Workspace, id: string, title: string): Workspace => patchPage(ws, id, (p) => ({ ...p, title }));
export const setIcon = (ws: Workspace, id: string, icon: string): Workspace => patchPage(ws, id, (p) => ({ ...p, icon: ICONS[icon] ? icon : 'page' }));
export function patchBlock(ws: Workspace, id: string, bid: string, f: (b: WBlock) => WBlock | null): Workspace {
  return withBlocks(ws, id, (bs) => bs.flatMap((b) => (b.id === bid ? (f(b) ?? []) : [b])));
}
export function insertBlock(ws: Workspace, id: string, b: WBlock, after?: string): Workspace {
  return withBlocks(ws, id, (bs) => {
    const i = after ? bs.findIndex((x) => x.id === after) : bs.length - 1;
    const at = i < 0 ? bs.length : i + 1;
    return [...bs.slice(0, at), b, ...bs.slice(at)];
  });
}
export function moveBlock(ws: Workspace, id: string, bid: string, by: -1 | 1): Workspace {
  return withBlocks(ws, id, (bs) => {
    const i = bs.findIndex((b) => b.id === bid);
    const j = i + by;
    if (i < 0 || j < 0 || j >= bs.length) return bs;
    const out = [...bs];
    [out[i], out[j]] = [out[j]!, out[i]!];
    return out;
  });
}
/** Tick or untick a to-do: done keeps its date. */
export const tick = (ws: Workspace, id: string, bid: string, on: boolean, now = Date.now()): Workspace => patchBlock(ws, id, bid, (b) => ({ ...b, done: on ? now : 0 }));
export const addComment = (ws: Workspace, id: string, bid: string, text: string, now = Date.now()): Workspace =>
  text.trim() ? patchBlock(ws, id, bid, (b) => ({ ...b, comments: [...(b.comments ?? []), { id: commentId(), text: text.trim(), at: now }] })) : ws;
export const removeComment = (ws: Workspace, id: string, bid: string, cid: string): Workspace => patchBlock(ws, id, bid, (b) => ({ ...b, comments: (b.comments ?? []).filter((c) => c.id !== cid) }));
export const setRuns = (ws: Workspace, id: string, bid: string, runs: Run[]): Workspace => patchBlock(ws, id, bid, (b) => ({ ...b, runs: tidyRuns(runs) }));

export const wordsOf = (p: Page, ws?: Workspace): number => [p.title, ...p.blocks.map((b) => wText(b, ws))].join(' ').match(/\S+/g)?.length ?? 0;

// ---------------------------------------------------------------- History: undo across every change on the open page, sixty deep

export class History {
  private back: Workspace[] = [];
  private fwd: Workspace[] = [];
  constructor(private now: Workspace) {}
  get ws(): Workspace {
    return this.now;
  }
  get depth(): number {
    return this.back.length;
  }
  get canUndo(): boolean {
    return this.back.length > 0;
  }
  get canRedo(): boolean {
    return this.fwd.length > 0;
  }
  push(next: Workspace): Workspace {
    if (next === this.now) return this.now;
    this.back.push(this.now);
    if (this.back.length > 60) this.back.shift();
    this.fwd = [];
    this.now = next;
    return next;
  }
  /** Replace the present without a step (a version snapshot, a purge). */
  set(next: Workspace): void {
    this.now = next;
  }
  undo(): Workspace {
    const prev = this.back.pop();
    if (prev) {
      this.fwd.push(this.now);
      // (the versions kept are the present's: undoing a change never takes a snapshot away)
      this.now = { ...prev, versions: this.now.versions };
    }
    return this.now;
  }
  redo(): Workspace {
    const next = this.fwd.pop();
    if (next) {
      this.back.push(this.now);
      this.now = { ...next, versions: this.now.versions };
    }
    return this.now;
  }
}

// ---------------------------------------------------------------- toggles and synced blocks (editors.u6)

/** The blocks out of sight: inside a folded toggle, at any depth (a toggle inside a folded one is hidden with its own blocks). */
export function hiddenBlocks(bs: WBlock[]): Set<string> {
  const by = new Map(bs.map((b) => [b.id, b]));
  const out = new Set<string>();
  for (const b of bs) {
    let at = b.under;
    const seen = new Set<string>();
    while (at && !seen.has(at)) {
      seen.add(at);
      const t = by.get(at);
      if (!t) break;
      if (t.folded) {
        out.add(b.id);
        break;
      }
      at = t.under;
    }
  }
  return out;
}
/** How deep inside toggles a block sits (0: not inside one). */
export function toggleDepth(bs: WBlock[], b: WBlock): number {
  let n = 0;
  let at = b.under;
  const seen = new Set<string>();
  while (at && !seen.has(at) && n < 8) {
    seen.add(at);
    const t = bs.find((x) => x.id === at);
    if (!t) break;
    n++;
    at = t.under;
  }
  return n;
}
/** A toggle folded or opened. */
export const foldToggle = (ws: Workspace, id: string, bid: string, folded: boolean): Workspace => patchBlock(ws, id, bid, (b) => ({ ...b, folded: folded || undefined }));
/** A block and everything inside it (a toggle's blocks, at any depth). */
export function withInside(bs: WBlock[], bid: string): Set<string> {
  const out = new Set([bid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of bs) if (b.under && out.has(b.under) && !out.has(b.id)) {
      out.add(b.id);
      grew = true;
    }
  }
  return out;
}
/** A line inside a toggle, after the last of its blocks; the toggle opens. */
export function addInside(ws: Workspace, id: string, toggle: string, nb: WBlock): Workspace {
  const p = ws.pages[id];
  if (!p) return ws;
  const inside = withInside(p.blocks, toggle);
  let last = toggle;
  for (const b of p.blocks) if (inside.has(b.id)) last = b.id;
  return insertBlock(foldToggle(ws, id, toggle, false), id, { ...nb, under: toggle }, last);
}

export const syncId = (): string => uid('s');
/** Where a synced group shows: each live page holding one of its blocks. */
export const syncPages = (ws: Workspace, sync: string): Page[] => live(ws).filter((p) => p.blocks.some((b) => b.sync === sync));
/** New words for a synced block: every block of its group, on every page, gets them (one change, so one UNDO). */
export function syncRuns(ws: Workspace, sync: string, runs: Run[]): Workspace {
  const clean = tidyRuns(runs);
  let out = ws;
  for (const p of syncPages(ws, sync)) out = withBlocks(out, p.id, (bs) => bs.map((b) => (b.sync === sync ? { ...b, runs: clean } : b)));
  return out;
}
/** A block shown on another page too: it joins (or starts) a synced group, and a copy of it goes at the end of `to`. */
export function syncTo(ws: Workspace, id: string, bid: string, to: string): { ws: Workspace; sync: string; error?: string } {
  const b = ws.pages[id]?.blocks.find((x) => x.id === bid);
  const target = ws.pages[to];
  if (!b) return { ws, sync: '', error: 'That block is not here any more.' };
  if (!target || target.deleted) return { ws, sync: '', error: 'That page is not here any more.' };
  if (!['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'quote', 'todo', 'callout', 'right'].includes(b.t)) return { ws, sync: '', error: 'Only a line of words can be synced: a heading, a line, a list item, a to-do, a quotation or a callout.' };
  const sync = b.sync ?? syncId();
  if (target.blocks.some((x) => x.sync === sync)) return { ws, sync, error: `It is already on “${titleOf(target)}”.` };
  let out = b.sync ? ws : patchBlock(ws, id, bid, (x) => ({ ...x, sync }));
  const { comments: _c, under: _u, done: _d, ...rest } = b;
  out = withBlocks(out, to, (bs) => [...bs, { ...rest, id: blockId(), sync }]);
  return { ws: out, sync };
}
/** This one block lets go of its group (the others stay synced). */
export const unsync = (ws: Workspace, id: string, bid: string): Workspace => patchBlock(ws, id, bid, (b) => {
  const { sync: _s, ...rest } = b;
  return rest;
});
