/**
 * THE WORKSPACE AS MARKDOWN (BRIEF-EDITOR-WORKSPACE): a page tree written as a folder of Markdown files (one per page, a page's children in a
 * folder of its name, links rewritten as relative paths, a database as a CSV beside its page, the rows' own words in files under it), zipped
 * through convert/zip.ts with the size said; and a Markdown file or a folder of them read back with the tree kept. What a plain reader
 * cannot hold (a picture's bytes, a database's views) rides in comments that any Markdown viewer hides and this reader understands.
 * Anything it cannot keep is said once. Pure: apps/edge/test/workspace.test.mjs holds the round trip.
 */
import { inline, tidyRuns, type Run } from '../docs/model';
import { safeHref } from '../core/safeurl';
import { importCsv, toCsv } from './csv';
import { newDatabase } from './db';
import {
  newPage, patchPage, wblock, commentId, viewId, rowsOf, children, titleOf, ICONS, syncId,
  type Database, type Page, type Prop, type PropKind, type PVal, type View, type WBlock, type Workspace,
} from './model';

export interface ExportFile {
  path: string;
  text: string;
}
const safe = (t: string): string => (t.trim() || 'Untitled').replace(/[\\/:*?"<>|#%\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '') || 'Untitled';

// ---------------------------------------------------------------- runs as Markdown

const escText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/\[/g, '\\[').replace(/</g, '\\<').replace(/([~=])(?=\1)/g, '\\$1'); // (a doubled ~ or = is a mark in Markdown: "a==b" must come back as written)
const runMd = (r: Run): string => {
  let t = escText(r.text);
  if (!t) return '';
  if (r.b && r.i) t = `***${t}***`;
  else if (r.b) t = `**${t}**`;
  else if (r.i) t = `*${t}*`;
  if (r.u && !r.href) t = `<u>${t}</u>`;
  if (r.s) t = `~~${t}~~`;
  if (r.hl) t = `==${t}==`;
  if (r.href) t = `[${t}](${r.href})`;
  return t;
};
const lineMd = (runs: Run[]): string => runs.map(runMd).join('').replace(/\n/g, '  \n');
const unesc = (s: string): string => s.replace(/\\([\\*_\[<#>+~=-])/g, '$1');
/** Markdown's inline marks as runs (links, underline, bold, italic). */
export function mdRuns(md: string): Run[] {
  const out: Run[] = [];
  const re = /\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)\)|<u>([\s\S]*?)<\/u>/g;
  let at = 0;
  const plain = (s: string, extra: Partial<Run> = {}): void => {
    for (const r of inline(s.replace(/\\([\\_*<\[])/g, (_m, c: string) => `\u0001${c.charCodeAt(0)}\u0001`))) {
      const text = r.text.replace(/\u0001(\d+)\u0001/g, (_m, n: string) => String.fromCharCode(Number(n)));
      out.push({ ...r, text, ...extra });
    }
  };
  for (const m of md.matchAll(re)) {
    if (m.index! > at) plain(md.slice(at, m.index));
    // [security] an imported file's link keeps its address only when its scheme is safe (no javascript: or data: pages)
    if (m[2] !== undefined) plain(m[1]!, safeHref(m[2]) ? { href: m[2] } : {});
    else plain(m[3]!, { u: true });
    at = m.index! + m[0].length;
  }
  if (at < md.length) plain(md.slice(at));
  return tidyRuns(out);
}

// ---------------------------------------------------------------- one page

interface Placed {
  page: Page;
  file: string;
  dir: string;
}
const dirOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
/** The relative path from one file to another ("../Notes/Plan.md"). */
export function relPath(from: string, to: string): string {
  const a = dirOf(from).split('/').filter(Boolean);
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/') || b[b.length - 1]!;
}
const decode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const enc = (p: string): string => p.split('/').map((s) => (s === '..' ? s : encodeURIComponent(s).replace(/%2F/g, '/'))).join('/');
/** Resolve a relative path against a file's folder. */
const resolve = (from: string, rel: string): string => {
  const parts = dirOf(from).split('/').filter(Boolean);
  for (const s of decode(rel).split('/')) {
    if (s === '..') parts.pop();
    else if (s && s !== '.') parts.push(s);
  }
  return parts.join('/');
};

const sidecar = (ws: Workspace, p: Page, paths: Map<string, string>, file: string): unknown => {
  const db = p.db!;
  const nameOf = (id: string | undefined): string | undefined => db.props.find((x) => x.id === id)?.name;
  return {
    props: db.props.map((x) => {
      return {
        name: x.name, kind: x.kind, ...(x.options ? { options: x.options } : {}), ...(x.formula ? { formula: x.formula } : {}),
        ...(x.rel && paths.get(x.rel) ? { rel: enc(relPath(file, paths.get(x.rel)!)) } : {}),
        ...(x.roll ? { roll: { via: nameOf(x.roll.via), of: ws.pages[db.props.find((y) => y.id === x.roll!.via)?.rel ?? '']?.db?.props.find((y) => y.id === x.roll!.of)?.name, fn: x.roll.fn } } : {}),
      };
    }),
    views: db.views.map((v) => ({
      name: v.name, kind: v.kind, ...(v.by ? { by: nameOf(v.by) } : {}), ...(v.end ? { end: nameOf(v.end) } : {}), hidden: v.hidden.map(nameOf),
      ...(v.sort ? { sort: { prop: v.sort.prop === 'name' ? 'name' : nameOf(v.sort.prop), dir: v.sort.dir } } : {}),
      ...(v.filter ? { filter: { prop: v.filter.prop === 'name' ? 'name' : nameOf(v.filter.prop), op: v.filter.op, value: v.filter.value } } : {}),
      ...(v.month ? { month: v.month } : {}),
    })),
  };
};

function pageMd(ws: Workspace, p: Page, file: string, paths: Map<string, string>, docTitle: (id: string) => string, onLoss: (s: string) => void): string {
  const head: Record<string, unknown> = { icon: p.icon };
  if (p.db) head.db = sidecar(ws, p, paths, file);
  const lines: string[] = [`<!--ghosty ${JSON.stringify(head)}-->`, `# ${escText(p.title)}`, ''];
  let n = 0;
  // a toggle is <details>: its blocks that follow it go inside, until the first that is not one of them
  const open: string[] = [];
  p.blocks.forEach((b, k) => {
    while (open.length && b.under !== open[open.length - 1]) {
      open.pop();
      lines.push('', '</details>');
    }
    const prev = p.blocks[k - 1]?.t;
    n = b.t === 'ol' ? (prev === 'ol' ? n + 1 : 1) : 0;
    const inner = lineMd(b.runs);
    let line: string;
    switch (b.t) {
      case 'h1': line = `## ${inner}`; break;
      case 'h2': line = `### ${inner}`; break;
      case 'h3': line = `#### ${inner}`; break;
      case 'ul': line = `- ${inner}`; break;
      case 'ol': line = `${n}. ${inner}`; break;
      case 'quote': line = `> ${inner}`; break;
      case 'callout': line = `> [!${b.tone === 'warn' ? 'WARNING' : b.tone === 'tip' ? 'TIP' : 'NOTE'}] ${inner}`; break;
      case 'todo': line = `- [${b.done ? 'x' : ' '}] ${inner}${b.done ? ` <!--done ${b.done}-->` : ''}`; break;
      case 'right': line = `<p align="right">${inner}</p>`; break;
      case 'toggle': line = `<details${b.folded ? '' : ' open'}><summary>${inner}</summary>`; break;
      case 'pb': line = '---'; break;
      case 'img': onLoss(`a picture (${b.alt || 'no description'})`); line = `![${escText(b.alt ?? '')}](picture)`; break;
      case 'table': {
        const rows = (b.rows ?? []).map((r) => `| ${r.map((c) => lineMd(c).replace(/\|/g, '\\|').replace(/ {2}\n/g, ' ')).join(' | ')} |`);
        if (rows.length) rows.splice(1, 0, `| ${(b.rows![0] ?? []).map(() => '---').join(' | ')} |`);
        line = rows.join('\n');
        break;
      }
      case 'link': {
        const target = b.to?.startsWith('doc:') ? undefined : b.to ? paths.get(b.to) : undefined;
        const title = b.to?.startsWith('doc:') ? docTitle(b.to.slice(4)) : titleOf(ws.pages[b.to ?? '']);
        line = b.to?.startsWith('doc:') ? `[${escText(title)}](ghosty-doc:${b.to.slice(4)} "ghosty:doc")` : target ? `[${escText(title)}](${enc(relPath(file, target))} "ghosty:page")` : `[${escText(title)}](missing.md "ghosty:page")`;
        break;
      }
      case 'view': {
        const target = b.db ? paths.get(b.db) : undefined;
        const view = ws.pages[b.db ?? '']?.db?.views.find((v) => v.id === b.view)?.name ?? '';
        line = `<!--ghosty:view ${JSON.stringify({ db: target ? relPath(file, target) : '', view })}-->`;
        break;
      }
      default: line = b.t === 'p' && /^(?:[#>+-]|\d+[.)]\s)/.test(inner) ? `\\${inner}` : inner;
    }
    const listy = (t?: string): boolean => t === 'ul' || t === 'ol' || t === 'todo';
    if (k && !(listy(b.t) && listy(prev) && b.t === prev)) lines.push('');
    if (b.sync) lines.push(`<!--ghosty:synced ${b.sync}-->`);
    lines.push(line);
    if (b.t === 'toggle') open.push(b.id);
    for (const c of b.comments ?? []) lines.push(`<!--ghosty:comment ${JSON.stringify({ at: c.at, text: c.text })}-->`);
  });
  while (open.pop()) lines.push('', '</details>');
  return lines.join('\n').trimEnd() + '\n';
}

/** Pages written as files: `roots` (default: every live top-level page) and everything below them. */
export function exportTree(ws: Workspace, roots?: string[], docTitle: (id: string) => string = () => 'a document'): { files: ExportFile[]; pages: number; pictures: number; lost: string[] } {
  const placed: Placed[] = [];
  const paths = new Map<string, string>();
  const rowFiles: { row: Page; file: string; dbFile: string }[] = [];
  const csvOf: { db: Page; file: string }[] = [];
  const place = (p: Page, dir: string, used: Set<string>): void => {
    let name = safe(p.title);
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${safe(p.title)} ${n}`;
    used.add(name.toLowerCase());
    const file = `${dir}${name}.md`;
    paths.set(p.id, file);
    placed.push({ page: p, file, dir: `${dir}${name}/` });
    const sub = new Set<string>();
    if (p.db) {
      csvOf.push({ db: p, file: `${dir}${name}.csv` });
      for (const r of rowsOf(ws, p.id)) {
        if (!r.blocks.some((b) => b.t !== 'p' || b.runs.length)) continue;
        let rn = safe(r.title);
        for (let n = 2; sub.has(rn.toLowerCase()); n++) rn = `${safe(r.title)} ${n}`;
        sub.add(rn.toLowerCase());
        rowFiles.push({ row: r, file: `${dir}${name}/${rn}.md`, dbFile: file });
        paths.set(r.id, `${dir}${name}/${rn}.md`);
      }
    }
    for (const c of children(ws, p.id)) place(c, `${dir}${name}/`, sub);
  };
  const top = new Set<string>();
  const list = roots ? roots.map((id) => ws.pages[id]).filter((p): p is Page => !!p && !p.deleted) : children(ws, null);
  for (const p of list) place(p, '', top);
  const lost: string[] = [];
  const files: ExportFile[] = [];
  for (const pl of placed) files.push({ path: pl.file, text: pageMd(ws, pl.page, pl.file, paths, docTitle, (s) => lost.push(s)) });
  for (const c of csvOf) files.push({ path: c.file, text: toCsv(ws, c.db.id) });
  for (const rf of rowFiles) files.push({ path: rf.file, text: pageMd(ws, rf.row, rf.file, paths, docTitle, (s) => lost.push(s)) });
  return { files, pages: placed.length, pictures: lost.filter((l) => l.startsWith('a picture')).length, lost: [...new Set(lost)] };
}

// ---------------------------------------------------------------- Markdown in

interface Parsed {
  title: string;
  icon: string;
  blocks: (WBlock & { _link?: string; _view?: { db: string; view: string } })[];
  db?: { props: SideProp[]; views: SideView[] };
}
interface SideProp { name: string; kind: PropKind; options?: string[]; formula?: string; rel?: string; roll?: { via?: string; of?: string; fn: 'count' | 'sum' | 'average' | 'latest' } }
interface SideView { name: string; kind: View['kind']; by?: string; end?: string; hidden: (string | undefined)[]; sort?: { prop?: string; dir: 'asc' | 'desc' }; filter?: { prop?: string; op: never; value: string }; month?: string }

const tableCells = (line: string): string[] => {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (t[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
};

/** One Markdown file read as a page's title, mark and blocks (our comments understood, anything else read as plain Markdown). */
export function parseMd(text: string, fallbackTitle = 'Untitled', onLoss: (s: string) => void = () => undefined): Parsed {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: Parsed = { title: fallbackTitle, icon: 'page', blocks: [] };
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i++;
  const head = /^<!--ghosty (\{.*\})-->\s*$/.exec(lines[i] ?? '');
  if (head) {
    try {
      const h = JSON.parse(head[1]!) as { icon?: string; db?: Parsed['db'] };
      if (h.icon && ICONS[h.icon]) out.icon = h.icon;
      if (h.db) out.db = h.db;
    } catch {
      onLoss('a page header I could not read');
    }
    i++;
  }
  while (i < lines.length && !lines[i]!.trim()) i++;
  const t1 = /^#\s+(.*?)\s*#*$/.exec(lines[i] ?? '');
  if (t1) {
    out.title = unesc(t1[1]!);
    i++;
  }
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) {
      const joined = para.join('\n').replace(/ {2}\n/g, '\n');
      out.blocks.push(wblock('p', mdRuns(joined.replace(/^\\(?=[#>+-]|\d+[.)])/, ''))));
    }
    para = [];
  };
  const last = (): WBlock | undefined => out.blocks[out.blocks.length - 1];
  // toggles open as <details> is read; a synced mark waits for the block after it
  const toggles: string[] = [];
  let sync = '';
  let made = 0;
  /** The blocks made since the last look take the toggle they are inside and the synced mark before them. */
  const settle = (): void => {
    for (const b of out.blocks.slice(made)) {
      if (toggles.length && b.id !== toggles[toggles.length - 1] && !b.under) b.under = toggles[toggles.length - 1];
      if (sync) {
        b.sync = sync;
        sync = '';
      }
    }
    made = out.blocks.length;
  };
  for (; i < lines.length; i++) {
    const line = lines[i]!.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    settle();
    if (!line.trim()) {
      flush();
      continue;
    }
    if ((m = /^<!--ghosty:synced ([\w-]{1,40})-->$/.exec(line))) {
      flush();
      settle();
      sync = m[1]!;
      continue;
    }
    if ((m = /^<details(\s+open)?\s*>\s*<summary>(.*)<\/summary>\s*$/i.exec(line))) {
      flush();
      settle();
      const t = wblock('toggle', mdRuns(m[2]!), m[1] ? {} : { folded: true });
      out.blocks.push(t);
      settle();
      toggles.push(t.id);
      continue;
    }
    if (/^<\/details>$/i.test(line.trim())) {
      flush();
      settle();
      toggles.pop();
      continue;
    }
    if ((m = /^<!--ghosty:comment (\{.*\})-->$/.exec(line))) {
      flush();
      try {
        const c = JSON.parse(m[1]!) as { at: number; text: string };
        const b = last();
        if (b) b.comments = [...(b.comments ?? []), { id: commentId(), text: String(c.text), at: Number(c.at) || Date.now() }];
      } catch {
        onLoss('a note I could not read');
      }
      continue;
    }
    if ((m = /^<!--ghosty:view (\{.*\})-->$/.exec(line))) {
      flush();
      try {
        const v = JSON.parse(m[1]!) as { db: string; view: string };
        out.blocks.push({ ...wblock('view'), _view: v });
      } catch {
        onLoss('a database view I could not read');
      }
      continue;
    }
    if ((m = /^(#{2,6})\s+(.*?)\s*#*$/.exec(line))) {
      flush();
      out.blocks.push(wblock(m[1]!.length === 2 ? 'h1' : m[1]!.length === 3 ? 'h2' : 'h3', mdRuns(m[2]!)));
    } else if ((m = /^\[((?:[^\]\\]|\\.)*)\]\((\S+?)\s+"ghosty:(page|doc)"\)$/.exec(line))) {
      flush();
      if (m[3] === 'doc') out.blocks.push(wblock('link', unesc(m[1]!), { to: `doc:${m[2]!.replace(/^ghosty-doc:/, '')}` }));
      else out.blocks.push({ ...wblock('link', unesc(m[1]!)), _link: m[2]! });
    } else if ((m = /^- \[( |x)\]\s?(.*?)(?:\s*<!--done (\d+)-->)?$/i.exec(line))) {
      flush();
      out.blocks.push(wblock('todo', mdRuns(m[2]!), m[1]!.toLowerCase() === 'x' ? { done: Number(m[3]) || Date.now() } : {}));
    } else if ((m = /^\s*[-*+•]\s+(.*)$/.exec(line)) && !/^\s*\*\*/.test(line)) {
      flush();
      out.blocks.push(wblock('ul', mdRuns(m[1]!)));
    } else if ((m = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line))) {
      flush();
      out.blocks.push(wblock('ol', mdRuns(m[1]!)));
    } else if ((m = /^>\s?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s?(.*)$/i.exec(line))) {
      // a callout (GitHub's and Obsidian's way of writing one in Markdown)
      flush();
      const k = m[1]!.toUpperCase();
      out.blocks.push(wblock('callout', mdRuns(m[2]!), k === 'TIP' ? { tone: 'tip' } : k === 'WARNING' || k === 'CAUTION' ? { tone: 'warn' } : {}));
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flush();
      out.blocks.push(wblock('quote', mdRuns(m[1]!)));
    } else if ((m = /^<p align="right">(.*)<\/p>$/.exec(line))) {
      flush();
      out.blocks.push(wblock('right', mdRuns(m[1]!)));
    } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      out.blocks.push(wblock('pb'));
    } else if ((m = /^!\[((?:[^\]\\]|\\.)*)\]\((\S*)\)$/.exec(line))) {
      flush();
      onLoss(`a picture (${unesc(m[1]!) || 'no description'}) a Markdown file cannot carry`);
    } else if (line.startsWith('|') && (lines[i + 1] ?? '').trim().startsWith('|') && /^\|?\s*:?-{3,}/.test((lines[i + 1] ?? '').trim().replace(/^\|\s*/, '|'))) {
      flush();
      const rows: string[][] = [tableCells(line)];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(tableCells(lines[i++]!));
      i--;
      out.blocks.push(wblock('table', '', { head: true, rows: rows.map((r) => r.map((c) => mdRuns(c))) }));
    } else if (/^<!--/.test(line)) {
      flush();
    } else para.push(line.trim());
  }
  flush();
  settle();
  return out;
}

export interface MdImport {
  ws: Workspace;
  /** The pages made at the top of what was read. */
  roots: Page[];
  pages: number;
  /** Anything it could not keep, said once. */
  lost: string[];
  /** A CSV's guess, when one was read ("12 rows, 4 properties …"). */
  line: string;
}
/** Files (a Markdown file, a folder of them, CSVs beside them) read as pages under `parent`, the tree kept. */
export function importFiles(ws0: Workspace, files: ExportFile[], parent: string | null = null, docOk: (id: string) => boolean = () => true): MdImport {
  const lost: string[] = [];
  let ws = ws0;
  const mds = files.filter((f) => /\.(md|markdown|txt)$/i.test(f.path)).sort((a, b) => a.path.localeCompare(b.path));
  const csvs = new Map(files.filter((f) => /\.csv$/i.test(f.path)).map((f) => [f.path.replace(/\.csv$/i, '').toLowerCase(), f]));
  const ignored = files.filter((f) => !/\.(md|markdown|txt|csv)$/i.test(f.path));
  for (const f of ignored) lost.push(`${f.path.split('/').pop()} (not Markdown or CSV)`);
  const byPath = new Map<string, Page>();
  const parsed = new Map<string, Parsed>();
  const created: Page[] = [];
  const stripExt = (p: string): string => p.replace(/\.(md|markdown|txt|csv)$/i, '');
  const key = (p: string): string => stripExt(p).toLowerCase();
  const rowOwners = new Set<string>();
  // a folder with no page of its own becomes a page of its name
  const ensureDir = (dir: string): string | null => {
    if (!dir) return parent;
    const trimmed = dir.replace(/\/$/, '');
    const owner = byPath.get(key(trimmed));
    if (owner) return owner.id;
    const up = ensureDir(trimmed.includes('/') ? trimmed.slice(0, trimmed.lastIndexOf('/') + 1) : '');
    const r = newPage(ws, { title: trimmed.split('/').pop()!, parent: up, from: 'a folder read' });
    ws = r.ws;
    byPath.set(key(trimmed), r.page);
    created.push(r.page);
    return r.page.id;
  };
  let line = '';
  // database pages first (their CSVs), so rows' own files can attach to them
  const dbFiles = new Set<string>();
  for (const f of mds) {
    const p = parseMd(f.text, f.path.split('/').pop()!.replace(/\.[^.]+$/, ''), (s) => lost.push(s));
    parsed.set(f.path, p);
    if (csvs.has(key(f.path)) || p.db) dbFiles.add(key(f.path));
  }
  const place = (file: string, pg: Page): void => {
    byPath.set(key(file), pg);
    created.push(pg);
  };
  // pages in path order so a parent exists before its children
  const order = [...mds].sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  const pendingCsvOnly = [...csvs.entries()].filter(([k]) => !mds.some((m) => key(m.path) === k));
  for (const f of order) {
    const p = parsed.get(f.path)!;
    const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : '';
    // a file in a database's folder that is one of its rows' bodies is attached to the row afterwards
    const owner = dir ? byPath.get(key(dir.replace(/\/$/, ''))) : undefined;
    if (owner?.db) {
      rowOwners.add(f.path);
      continue;
    }
    const par = ensureDir(dir);
    const csv = csvs.get(key(f.path));
    if (csv || p.db) {
      const known = p.db ? { props: p.db.props.map((x) => ({ name: x.name, kind: x.kind, ...(x.options ? { options: x.options } : {}), ...(x.formula ? { formula: x.formula } : {}) })), names: p.db.props.map((x) => x.name) } : undefined;
      const imp = csv ? importCsv(ws, csv.text, p.title, par, known) : null;
      if (imp) {
        ws = imp.ws;
        line = imp.line;
        lost.push(...imp.lost);
        ws = patchPage(ws, imp.page.id, (x) => ({ ...x, icon: p.icon, blocks: p.blocks.map(({ _link, _view, ...b }) => b) }));
        place(f.path, ws.pages[imp.page.id]!);
        continue;
      }
      const made = newDatabase(ws, { title: p.title, parent: par, icon: p.icon, props: known?.props ?? [], views: ['table'], from: 'Markdown' });
      ws = made.ws;
      place(f.path, made.page);
      continue;
    }
    const r = newPage(ws, { title: p.title, parent: par, icon: p.icon, blocks: p.blocks.map(({ _link, _view, ...b }) => b), from: 'Markdown' });
    ws = r.ws;
    place(f.path, r.page);
  }
  for (const [k, f] of pendingCsvOnly) {
    const par = ensureDir(f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : '');
    const imp = importCsv(ws, f.text, f.path.split('/').pop()!.replace(/\.csv$/i, ''), par);
    if (!imp) {
      lost.push(`${f.path.split('/').pop()} (no rows)`);
      continue;
    }
    ws = imp.ws;
    line = imp.line;
    lost.push(...imp.lost);
    byPath.set(k, ws.pages[imp.page.id]!);
    created.push(ws.pages[imp.page.id]!);
  }
  // a database's row bodies, then every link, view and relation resolved against the paths now known
  for (const f of mds) {
    if (!rowOwners.has(f.path)) continue;
    const p = parsed.get(f.path)!;
    const dir = f.path.slice(0, f.path.lastIndexOf('/') + 1).replace(/\/$/, '');
    const owner = byPath.get(key(dir))!;
    const row = rowsOf(ws, owner.id).find((r) => r.title === p.title || safe(r.title).toLowerCase() === f.path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase());
    if (row) {
      ws = patchPage(ws, row.id, (x) => ({ ...x, icon: p.icon, blocks: p.blocks.map(({ _link, _view, ...b }) => b) }));
      byPath.set(key(f.path), ws.pages[row.id]!);
    } else {
      const r = newPage(ws, { title: p.title, parent: owner.id, icon: p.icon, blocks: p.blocks.map(({ _link, _view, ...b }) => b), from: 'Markdown' });
      ws = r.ws;
      place(f.path, r.page);
    }
  }
  const now = (id: string): Page => ws.pages[id]!;
  const syncIds = new Map<string, string>();
  for (const f of mds) {
    const pg = byPath.get(key(f.path));
    const p = parsed.get(f.path)!;
    if (!pg) continue;
    // links and views
    const blocks = p.blocks.map((b): WBlock => {
      const { _link, _view, ...rest } = b;
      if (_link) {
        const t = byPath.get(key(resolve(f.path, _link)));
        if (!t) {
          lost.push(`a link to “${rest.runs.map((r) => r.text).join('') || _link}” (that page was not in what I read)`);
          return { ...rest, to: undefined };
        }
        return { ...rest, to: t.id };
      }
      if (_view) {
        const t = byPath.get(key(resolve(f.path, _view.db)));
        if (!t?.db) {
          lost.push('a database view whose database was not in what I read');
          return { ...rest, db: undefined };
        }
        return { ...rest, db: t.id, view: '' };
      }
      return rest;
    });
    // (synced blocks read back are synced with each other, never with the pages they were written from)
    const synced = (b: WBlock): WBlock => (b.sync ? { ...b, sync: syncIds.get(b.sync) ?? (syncIds.set(b.sync, syncId()), syncIds.get(b.sync)!) } : b);
    ws = patchPage(ws, pg.id, (x) => ({ ...x, blocks: blocks.filter((b) => !(b.t === 'link' && !b.to) && !(b.t === 'view' && !b.db)).map(synced) }));
  }
  // databases: relations, rollups, formulas and views from the sidecar, then row relations from the CSV text
  for (const f of mds) {
    const pg = byPath.get(key(f.path));
    const p = parsed.get(f.path)!;
    if (!pg?.db || !p.db) continue;
    const props: Prop[] = now(pg.id).db!.props.map((x) => ({ ...x }));
    for (const sp of p.db.props) {
      const mine = props.find((x) => x.name === sp.name);
      if (!mine) continue;
      mine.kind = sp.kind;
      if (sp.rel) {
        const t = byPath.get(key(resolve(f.path, sp.rel)));
        if (t?.db) mine.rel = t.id;
      }
      if (sp.formula) mine.formula = sp.formula;
    }
    for (const sp of p.db.props) {
      if (sp.kind !== 'rollup' || !sp.roll) continue;
      const mine = props.find((x) => x.name === sp.name)!;
      const via = props.find((x) => x.name === sp.roll!.via);
      const target = via?.rel ? now(via.rel) : undefined;
      const of = target?.db?.props.find((x) => x.name === sp.roll!.of) ?? (sp.roll.fn === 'count' ? target?.db?.props[0] : undefined);
      if (via && of) mine.roll = { via: via.id, of: of.id, fn: sp.roll.fn };
      else lost.push(`the rollup ${sp.name} (what it adds up was not in what I read)`);
    }
    const idOf = (name: string | undefined): string | undefined => (name === 'name' ? 'name' : props.find((x) => x.name === name)?.id);
    const views: View[] = p.db.views.map((sv) => ({
      id: viewId(), name: sv.name, kind: sv.kind, hidden: sv.hidden.flatMap((n) => (idOf(n) ? [idOf(n)!] : [])),
      ...(sv.by && idOf(sv.by) ? { by: idOf(sv.by) } : {}), ...(sv.end && idOf(sv.end) ? { end: idOf(sv.end) } : {}),
      ...(sv.sort && idOf(sv.sort.prop) ? { sort: { prop: idOf(sv.sort.prop)!, dir: sv.sort.dir } } : {}),
      ...(sv.filter && idOf(sv.filter.prop) ? { filter: { prop: idOf(sv.filter.prop)!, op: sv.filter.op, value: sv.filter.value } } : {}),
      ...(sv.month ? { month: sv.month } : {}),
    }));
    const db: Database = { props, views: views.length ? views : now(pg.id).db!.views };
    ws = patchPage(ws, pg.id, (x) => ({ ...x, db }));
    // relation cells came as titles: find the rows by title
    const csv = csvs.get(key(f.path));
    if (csv) {
      const rows = csv.text ? parseRows(csv.text) : [];
      const header = rows[0] ?? [];
      const mine = rowsOf(ws, pg.id);
      rows.slice(1).forEach((r, ri) => {
        const row = mine[ri];
        if (!row) return;
        for (const pr of props) {
          if (pr.kind !== 'relation' || !pr.rel) continue;
          const c = header.findIndex((h) => h.trim().toLowerCase() === pr.name.toLowerCase());
          const titles = (r[c] ?? '').split(/\s*;\s*/).filter(Boolean);
          const ids = titles.flatMap((t) => rowsOf(ws, pr.rel!).filter((x) => x.title === t).map((x) => x.id).slice(0, 1));
          ws = patchPage(ws, row.id, (x) => ({ ...x, vals: { ...(x.vals ?? {}), [pr.id]: ids as PVal } }));
        }
      });
    }
  }
  // view blocks learn which view they showed (by name)
  for (const f of mds) {
    const pg = byPath.get(key(f.path));
    const p = parsed.get(f.path)!;
    if (!pg) continue;
    const vs = p.blocks.filter((b) => b._view);
    if (!vs.length) continue;
    let k = 0;
    ws = patchPage(ws, pg.id, (x) => ({
      ...x,
      blocks: x.blocks.map((b) => {
        if (b.t !== 'view') return b;
        const want = vs[k++]?._view?.view ?? '';
        const v = ws.pages[b.db ?? '']?.db?.views.find((y) => y.name === want) ?? ws.pages[b.db ?? '']?.db?.views[0];
        return { ...b, view: v?.id ?? '' };
      }),
    }));
  }
  const roots = created.filter((x) => (ws.pages[x.id]?.parent ?? null) === parent).map((x) => ws.pages[x.id]!);
  return { ws, roots, pages: created.length, lost: [...new Set(lost)], line };
}
import { parseCsv } from '../sheets/csv';
const parseRows = (t: string): string[][] => parseCsv(t).filter((r) => r.some((c) => c.trim()));
