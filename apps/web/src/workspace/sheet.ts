/**
 * THE WORKSPACE SHEET (BRIEF-EDITOR-WORKSPACE; MAKE → THE WORKSPACE, "my workspace", the Stage's ADD TO A PROJECT): the core of Notion on the phone.
 * His pages as a tree (a chevron folds the children), NEW PAGE from five templates or blank, SEARCH, RECENT; a page with its mark and title in a line
 * above, its blocks (the documents' blocks, a to-do, a callout (a note, a tip or a warning), a link to a page, a view of a database) with "/" offering the kinds, BACKLINKS under them, a
 * comment on a block by a long press, HISTORY (versions listed, opened read-only, RESTORE THIS VERSION), MOVE TO, DUPLICATE, DELETE into a BIN for
 * thirty days; a database with VIEW pills (TABLE, BOARD, CALENDAR, TIMELINE, GALLERY), FILTER & SORT, PROPERTIES, a row opening as a page with its
 * properties at the head; ASK ABOUT THIS PROJECT (the project's text as one chat turn's data, its size said first); EXPORT as a zip of Markdown and
 * CSV, IMPORT of Markdown, a folder, a zip or a CSV. Autosave said once; reopened where he was. Everything is on the phone; only an ASK leaves it.
 */
import { bytesOf } from '../core/safeurl';
import { h, clear, icon } from '../core/dom';
import { sayError } from '../ui/hisWords';
import { button, modal } from '../ui/components';
import { sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';
import { unzipSync, zipStore } from '../convert/zip';
import { addPhoto, imageNow, keepOnly, loadImages } from '../docs/images';
import { getDoc, imagesInUse, listDocs } from '../docs/store';
import { askBrain } from '../docs/ask';
import { fromMarkdown, newTable, tidyRuns, type Block, type Run } from '../docs/model';
import { caretAt, fillRuns, placeCaret, readRuns, safeLink, splitRuns } from './runs';
import { dueWords, askMessage, flatten, sizeLine } from './context';
import { addRow, dateTyped, dateWords, isoOf, newDatabase, propNamed, setVal, shown } from './db';
import { openWorkBlock, q } from '../../../../packages/shared/src/openwork';
import { setLiveWork } from '../proposals/live';
import { askBox, proposalBar } from '../proposals/bar';
import { exportTree, importFiles } from './md';
import { searchWs } from './search';
import { agoWords, restoreVersion, snapshot, versionsOf } from './versions';
import { fromTemplate, TEMPLATES } from './templates';
import { dbView, propEditor, type Ctx } from './views';
import { keepWhere, lastBackupAt, loadWorkspace, saveWorkspace, where, workspaceImageIds, room, roomWords } from './store';
import { importCsv } from './csv';
import { voiceBlocks, doneWords, type Tidy } from './voicenote';
import { voicePanel, voiceState } from './voicesheet';
import { newDoc, block as docBlock } from '../docs/model';
import { saveDoc } from '../docs/store';
import {
  addComment, backlinks, below, binDaysLeft, binned, children, deletePage, depth, duplicatePage, emptyBin, History, ICONS, insertBlock, isDb, isEmptyWorkspace, isInside, isRow, live, movePage, moveBlock,
  newPage, patchBlock, patchPage, projectOf, putPage, removeComment, restorePage, rowsOf, setIcon, setRuns, setTitle, shiftPage, tick, titleOf, trail, wblock, withBlocks, wordsOf, wText,
  type Page, type Tone, TONES, type WBlock, type WType, type Workspace,
  addInside, foldToggle, hiddenBlocks, syncPages, syncRuns, syncTo, toggleDepth, unsync, withInside,
} from './model';
import { fromOwnTemplate, saveAsTemplate } from './templates';
import { cardsFrom, cardsWords, type NoteCard } from './cards';
import { formAnswer, formQuestions, formSkipped, type FormRaw } from './form';
import { addNode, branchTodos, kidsOf, layout, removeNode, renameNode, type MindNode } from './mind';
import { changeWords, comparePage, restorePart, type Part } from './compare';
import { loadOwnTemplates, saveOwnTemplates } from './store';

export const WORKSPACE_TITLE = 'THE WORKSPACE';
type WsAsk = { id?: string; what?: 'list' | 'project' | 'blank' | 'import' | 'due' | 'bin' | 'voice' | 'mind'; addDoc?: { text: string; title?: string }; template?: string };

export const wsState = {
  open: false,
  view: 'home' as 'home' | 'page' | 'history' | 'bin' | 'search',
  page: '',
  title: '',
  pages: 0,
  tree: [] as { id: string; title: string; depth: number; folded: boolean }[],
  recent: [] as string[],
  blocks: [] as { id: string; t: string; text: string; done: number }[],
  kept: 0,
  saved: 0,
  savedSaid: 0,
  said: '',
  undo: 0,
  versions: 0,
  size: 0,
  focus: '',
  panel: '',
  search: '',
  results: [] as { id: string; title: string; line: string }[],
  lost: [] as string[],
  exported: [] as { name: string; size: number; type: string; files: number }[],
  imported: '',
  ask: { size: '', sent: 0, reply: '', where: '' },
  due: '',
  failing: false,
  letGo: 0,
  json: '',
  voice: voiceState,
  compare: 0,
};
let current: { close(): void } | null = null;
/** "Saved" fades in once while this page is open (every later save is quiet). */
let savedOnce = false;
const cased = (b: HTMLButtonElement, words = b.textContent ?? ''): HTMLButtonElement => {
  b.dataset.label = words;
  return b;
};

/** The sheet: a page to open, a project to start, or his workspace. */
export async function openWorkspace(o: WsAsk = {}): Promise<void> {
  current?.close();
  const d = workspaceParts();
  wsState.open = true;
  current = modal(WORKSPACE_TITLE, d.el, () => {
    d.stop();
    wsState.open = false;
    current = null;
  });
  await d.start(o);
}

const KIND_ITEMS: { id: string; label: string; line: string }[] = [
  { id: 'h1', label: 'HEADING', line: 'A big line that names a part of the page' },
  { id: 'h2', label: 'SMALLER HEADING', line: 'A heading inside a part' },
  { id: 'ul', label: 'LIST', line: 'Bullets, one a line' },
  { id: 'ol', label: 'NUMBERED LIST', line: 'Steps, counted' },
  { id: 'todo', label: 'TO-DO', line: 'A box to tick, with the day I ticked it' },
  { id: 'table', label: 'TABLE', line: 'Rows and columns of words' },
  { id: 'img', label: 'PICTURE', line: 'A photo from my own photos' },
  { id: 'page', label: 'PAGE', line: 'A new page inside this one' },
  { id: 'db', label: 'DATABASE', line: 'A list of rows with properties, drawn as a table, a board, a calendar…' },
  { id: 'link', label: 'LINK TO A PAGE', line: 'A card that opens another page, or one of my documents' },
  { id: 'quote', label: 'QUOTATION', line: 'Words set apart' },
  { id: 'callout', label: 'CALLOUT', line: 'A note in a box: tap its mark for a tip or a warning' },
  { id: 'toggle', label: 'TOGGLE', line: 'A line that folds away the lines inside it' },
  { id: 'mind', label: 'MIND MAP', line: 'Ideas and their branches; any branch becomes to-dos in one tap' },
];
const TONE_WORDS: Record<Tone, { mark: string; name: string }> = { note: { mark: 'i', name: 'Note' }, tip: { mark: '✓', name: 'Tip' }, warn: { mark: '!', name: 'Warning' } };

/**
 * The workspace's page (the sheet's, and THE WORKSPACE screen's: features/workspace/index.ts): `start` opens what was asked for (a page, a project
 * started, his pages, or where he was); `stop` puts away what runs.
 */
export function workspaceParts(hooks: { onChange?: () => void } = {}): { el: HTMLElement; start(o: WsAsk): Promise<void>; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.workspace = wsState;
  let hist = new History(purgeAndLoad());
  let cur = '';
  let mode: 'home' | 'page' | 'history' | 'bin' | 'search' = 'home';
  let timer = 0;
  let retry = 0;
  let blocked = false;
  let people: string[] = [];
  let preview = 0;
  const subs = new Set<() => void>();
  const dirty = new Set<string>();
  const openNow = new Set<string>();
  const status = h('p.wsstatus', { 'aria-live': 'polite' });
  const savedEl = h('small.wssaved', { 'aria-live': 'polite' });
  const flash = h('span.wsflash', { 'aria-live': 'polite' });
  const metaEl = h('p.wsmeta');
  const view = h('div.wsview0');
  const fileIn = h('input', { type: 'file', hidden: true, multiple: true, accept: '.md,.markdown,.txt,.csv,.zip,text/markdown,text/csv,application/zip', 'aria-label': 'Choose Markdown, CSV or a zip to read' }) as HTMLInputElement;
  const photoIn = h('input', { type: 'file', hidden: true, accept: 'image/*', 'aria-label': 'Choose a photo for the page' }) as HTMLInputElement;
  // ---------------------------------------------------------------- Ghosty's marked changes (BRIEF-KERNEL-3): the brain's `workspace` tool proposes, his tap decides
  const props = proposalBar(() => undefined, (words) => say(words));
  /** The pages in the order the tree shows them (rows left out: a database's rows are its own lines). */
  const ordered = (): Page[] => {
    const out: Page[] = [];
    const walk = (parent: string | null, guard = 0): void => {
      if (guard > 12) return;
      for (const p of children(ws(), parent)) {
        if (isRow(ws(), p)) continue;
        out.push(p);
        walk(p.id, guard + 1);
      }
    };
    walk(null);
    return out;
  };
  const dataOf = (): string => {
    const w = ws();
    const lines: string[] = [];
    ordered().forEach((p, i) => {
      const n = i + 1;
      if (p.db) {
        lines.push(`table ${n} | title ${q(titleOf(p))}${p.db.props.map((x) => ` | col ${q(x.name)}`).join('')}`);
        rowsOf(w, p.id).forEach((r, k) => lines.push(`row ${n}.${k + 1} | title ${q(titleOf(r))}${p.db!.props.map((x) => ` | v ${q(shown(w, p.id, r, x).text)}`).join('')}`));
      } else lines.push(`page ${n} | title ${q(titleOf(p))}`);
      p.blocks.forEach((b, k) => {
        const t = wText(b, w).trim();
        if (t && b.t !== 'view') lines.push(`block ${n}.${k + 1} | t ${b.t} | text ${q(t.slice(0, 400))}${b.t === 'todo' ? ` | done ${b.done ? 1 : 0}` : ''}`);
      });
    });
    return openWorkBlock('workspace', `workspace | pages ${lines.filter((l) => /^(page|table) /.test(l)).length}`, lines);
  };
  const byName = (title: string): Page | undefined => {
    const k = title.trim().toLowerCase();
    return ordered().find((p) => titleOf(p).toLowerCase() === k) ?? ordered().find((p) => k && titleOf(p).toLowerCase().includes(k));
  };
  const goneW = (what: string): never => {
    throw Object.assign(new Error(`That ${what} is not in the workspace any more, so I left it alone.`), { refuse: true });
  };
  const proposeHere = (a: Record<string, unknown>): string => {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const text = str(a.text);
    const page = byName(str(a.page));
    const fail = (): string => {
      const f = 'I could not place that change in the workspace.';
      say(f);
      return f;
    };
    if (a.change === 'block' && page) {
      const b = page.blocks[Number(a.block) - 1];
      if (!b) return fail();
      const pid = page.id;
      const bid = b.id;
      props.add({ line: `A block of “${titleOf(page)}”`, old: wText(b, ws()), now: text, accept: () => {
        if (!ws().pages[pid]?.blocks.some((x) => x.id === bid)) goneW('block');
        change(setRuns(ws(), pid, bid, [{ text }]), 'all');
      } });
    } else if (a.change === 'cell' && page?.db) {
      const rowTitle = str(a.row).trim().toLowerCase();
      const row = rowsOf(ws(), page.id).find((r) => titleOf(r).toLowerCase() === rowTitle);
      const colName = str(a.column);
      const prop = colName.toLowerCase() === 'name' ? null : propNamed(page.db, colName);
      if (!row || (!prop && colName.toLowerCase() !== 'name')) return fail();
      const rid = row.id;
      props.add({ line: `“${colName}” of “${titleOf(row)}” in “${titleOf(page)}”`, old: str(a.old), now: text, accept: () => {
        if (!ws().pages[rid]) goneW('row');
        if (!prop) return change(setTitle(ws(), rid, text), 'all');
        let v: string | number | boolean | null = text;
        if (prop.kind === 'number') {
          v = Number(text.replace(/[^\d.-]/g, ''));
          if (!Number.isFinite(v)) throw Object.assign(new Error(`“${text}” is not a number, so I left “${prop.name}” alone.`), { refuse: true });
        } else if (prop.kind === 'check') v = /^(?:yes|true|done|ticked|x|1)$/i.test(text.trim());
        else if (prop.kind === 'date') {
          v = dateTyped(text);
          if (!v) throw Object.assign(new Error(`I could not read “${text}” as a date, so I left “${prop.name}” alone.`), { refuse: true });
        } else if (!['text', 'select', 'person'].includes(prop.kind)) throw Object.assign(new Error(`“${prop.name}” is worked out or linked, so I left it alone.`), { refuse: true });
        change(setVal(ws(), rid, prop.id, v), 'all');
      } });
    } else if (a.change === 'append' && page) {
      const pid = page.id;
      const last = page.blocks[page.blocks.length - 1];
      props.add({ line: page.db ? `A new row in “${titleOf(page)}”` : `At the end of “${titleOf(page)}”`, old: '', now: text, accept: () => {
        if (!ws().pages[pid]) goneW('page');
        if (page.db) change(addRow(ws(), pid, text).ws, 'all');
        else change(insertBlock(ws(), pid, wblock(last?.t === 'todo' ? 'todo' : last?.t === 'ul' ? 'ul' : 'p', text)), 'all');
      } });
    } else if (a.change === 'page') {
      const parent = str(a.parent) ? byName(str(a.parent)) : undefined;
      if (str(a.parent) && !parent) return fail();
      const title = str(a.title).slice(0, 120);
      props.add({ line: `A new page “${title}”${parent ? ` under “${titleOf(parent)}”` : ''}`, old: '', now: text, accept: () => {
        const r = newPage(ws(), { title, parent: parent ? parent.id : null, blocks: text ? text.split(/\n{2,}|\n/).filter(Boolean).map((t) => wblock('p', t)) : [], from: 'made with Ghosty' });
        change(r.ws, 'all');
      } });
    } else return fail();
    const words = 'Ghosty marked a change: ACCEPT applies it, REJECT leaves your pages as they were.';
    say(words);
    return words;
  };
  const askEl = askBox('workspace', 'the workspace', dataOf, proposeHere, (w) => say(w), () => flush());
  const el = h('div.wssheet', status, h('div.wsline', savedEl, flash), metaEl, props.el, view, askEl, fileIn, photoIn);
  setLiveWork('workspace', { data: dataOf, propose: proposeHere });

  function purgeAndLoad(): Workspace {
    return loadWorkspace();
  }
  const say = (words: string): void => {
    status.textContent = words;
    wsState.said = words;
  };
  const ws = (): Workspace => hist.ws;
  const today = (): string => isoOf(new Date());
  const image = (id: string): string | null => imageNow(id);
  const page = (): Page | undefined => ws().pages[cur];
  const key = (label: string, run: () => void, cls = '', name = ''): HTMLButtonElement => {
    const b = button(label, run, cls);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  void getDoc;
  void cased;

  // ---------------------------------------------------------------- keeping
  const paintMeta = (): void => {
    const live0 = live(ws()).filter((p) => !isRow(ws(), p));
    const t = Date.now();
    void t;
    metaEl.textContent = `${live0.length} page${live0.length === 1 ? '' : 's'}${live(ws()).length > live0.length ? ` · ${live(ws()).length - live0.length} database row${live(ws()).length - live0.length === 1 ? '' : 's'}` : ''}`;
    savedEl.textContent = blocked ? 'NOT KEPT · THIS PHONE’S STORAGE IS BLOCKED, TRYING AGAIN' : wsState.saved ? `KEPT ON THIS PHONE · ${new Date(wsState.saved).toLocaleTimeString('en-GB')}` : 'NOT CHANGED YET';
  };
  const paintState = (): void => {
    const s = ws();
    wsState.view = mode;
    wsState.page = cur;
    wsState.title = page()?.title ?? '';
    wsState.pages = live(s).length;
    wsState.undo = hist.depth;
    wsState.versions = cur ? versionsOf(s, cur).length : 0;
    wsState.blocks = (page()?.blocks ?? []).map((b) => ({ id: b.id, t: b.t, text: wText(b, s, docTitle), done: b.done ?? 0 }));
    wsState.tree = treeRows().map((r) => ({ id: r.page.id, title: r.page.title, depth: r.depth, folded: r.folded }));
    wsState.recent = recentPages().map((p) => p.id);
    wsState.size = room().bytes;
    wsState.json = cur && page() ? JSON.stringify(page()) : '';
    paintMeta();
  };
  const docTitle = (id: string): string => listDocs().find((d) => d.id === id)?.title ?? 'A document that is not here any more';
  const saveNow = (): void => {
    clearTimeout(timer);
    clearTimeout(retry);
    if (!dirty.size && !blocked) return;
    let next = ws();
    for (const id of dirty) {
      const p = next.pages[id];
      if (p && !p.deleted && (!isRow(next, p) || id === cur || p.blocks.length)) next = snapshot(next, id);
    }
    const k = saveWorkspace(next);
    hist.set(k.ok ? k.ws : next);
    if (k.ok) {
      dirty.clear();
      wsState.saved = Date.now();
      wsState.kept = live(k.ws).length;
      wsState.failing = false;
      blocked = false;
      if (k.dropped) {
        wsState.letGo += k.dropped;
        say(`I let go of the ${k.dropped} oldest page versions to make room: ${roomWords(room())}. Your pages are all here.`);
      }
      hooks.onChange?.();
      keepWhere(cur, '');
      if (!savedOnce) {
        savedOnce = true;
        wsState.savedSaid++;
        flash.textContent = 'SAVED';
        flash.classList.remove('go');
        void flash.offsetWidth;
        flash.classList.add('go');
      }
    } else {
      blocked = true;
      wsState.failing = true;
      say('This phone is not letting me keep the workspace just now (its storage is blocked or full). You can keep working; I try again every few seconds, and nothing is lost while this page is open.');
      retry = window.setTimeout(saveNow, 3000);
    }
    paintMeta();
  };
  const schedule = (): void => {
    clearTimeout(timer);
    timer = window.setTimeout(saveNow, 200);
  };
  const flush = (): void => {
    for (const f of [...flushers]) f();
    saveNow();
  };
  const flushers = new Set<() => void>();
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  /** A change, kept soon (the 200 ms rule) and its pages marked for a snapshot. */
  const change = (next: Workspace, redraw: 'all' | 'views' | 'none' = 'views'): void => {
    const prev = ws();
    if (next === prev) return;
    for (const id of Object.keys(next.pages)) if (next.pages[id] !== prev.pages[id]) dirty.add(id);
    hist.push(next);
    paintState();
    schedule();
    if (redraw === 'all') render();
    else if (redraw === 'views') for (const f of [...subs]) f();
    paintMeta();
  };
  const ctx: Ctx = {
    ws,
    change: (n) => change(n, 'views'),
    open: (id) => openPage(id),
    say,
    today,
    image,
    people: () => people,
    subscribe: (f) => void subs.add(f),
  };
  const recentPages = (): Page[] => live(ws()).filter((p) => !isRow(ws(), p) && !isDb(p)).sort((a, b) => b.at - a.at).slice(0, 5);

  const render = (): void => {
    subs.clear();
    if (mode === 'page' && page()) showPage(cur);
    else if (mode === 'history') showHistory(cur);
    else if (mode === 'bin') showBin();
    else showHome();
    paintState();
  };
  const doUndo = (): void => {
    if (!hist.canUndo) return say('Nothing to undo.');
    flush();
    const before = ws();
    hist.undo();
    flushers.clear();
    for (const id of Object.keys(ws().pages)) if (ws().pages[id] !== before.pages[id]) dirty.add(id);
    for (const id of Object.keys(before.pages)) if (!ws().pages[id]) dirty.add(id);
    if (cur && !page()) {
      cur = '';
      mode = 'home';
    }
    schedule();
    render();
    say('Undone.');
  };
  const doRedo = (): void => {
    if (!hist.canRedo) return say('Nothing to redo.');
    flush();
    const before = ws();
    hist.redo();
    flushers.clear();
    for (const id of Object.keys(ws().pages)) if (ws().pages[id] !== before.pages[id]) dirty.add(id);
    schedule();
    render();
  };
  const undoBar = (words: string): void => {
    clear(status, `${words} `, key('UNDO', doUndo, 'on', 'Undo'));
    wsState.said = words;
  };

  // ---------------------------------------------------------------- the tree
  const folded = new Set<string>();
  const treeRows = (): { page: Page; depth: number; folded: boolean }[] => {
    const out: { page: Page; depth: number; folded: boolean }[] = [];
    const walk = (p: Page, d: number): void => {
      const kids = children(ws(), p.id);
      out.push({ page: p, depth: d, folded: !!kids.length && folded.has(p.id) });
      if (!folded.has(p.id)) for (const k of kids) walk(k, d + 1);
    };
    for (const p of children(ws(), null)) walk(p, 0);
    return out;
  };
  const markOf = (p: Page, cls = 'ic'): SVGElement => icon(ICONS[p.icon]?.path ?? ICONS.page!.path, cls);
  const treeEl = (): HTMLElement =>
    h('div.wstree', { role: 'tree', 'aria-label': 'My pages' }, ...treeRows().map(({ page: p, depth: d, folded: f }) => {
      const kids = children(ws(), p.id);
      const chev = kids.length
        ? (key(f ? '›' : '⌄', () => {
          if (folded.has(p.id)) folded.delete(p.id);
          else folded.add(p.id);
          showHome();
          paintState();
        }, 'wschev', `${f ? 'Open' : 'Fold'} the pages inside ${titleOf(p)}`) as HTMLElement)
        : h('span.wschev.none', { 'aria-hidden': 'true' });
      chev.setAttribute('aria-expanded', String(!f));
      const open = h('button.wsopen', { type: 'button', dataset: { id: p.id }, 'aria-label': `Open ${titleOf(p)}` }, markOf(p), h('span.wstt', titleOf(p)), h('small', kids.length ? `${kids.length}` : isDb(p) ? `${rowsOf(ws(), p.id).length} rows` : '')) as HTMLButtonElement;
      open.addEventListener('click', () => openPage(p.id));
      return h('div.wsrow1', { role: 'treeitem', 'aria-level': String(d + 1), dataset: { id: p.id, depth: String(d) }, style: `--d:${d}` }, chev, open);
    }));

  // ---------------------------------------------------------------- home
  const newBlank = (parent: string | null = null): void => {
    const r = newPage(ws(), { title: '', parent, from: 'made here' });
    change(r.ws, 'none');
    openPage(r.page.id, true);
  };
  const startTemplate = (id: string, parent: string | null = null): void => {
    flush();
    const r = fromTemplate(ws(), id, parent, new Date());
    change(r.ws, 'none');
    flush();
    openPage(r.root.id);
    say(`${TEMPLATES.find((t) => t.id === id)?.name ? titleOf(r.root) : 'A page'} is made, with every word yours to change.`);
  };
  const templatesEl = (parent: string | null): HTMLElement =>
    h('div.wspanel.wstemplates', { dataset: { panel: 'templates' } }, h('small.wsh', 'NEW PAGE'),
      ...TEMPLATES.map((t) => {
        const b = h('button.wstemplate', { type: 'button', dataset: { template: t.id }, 'aria-label': `${t.name}: ${t.line}` }, markOf({ icon: t.icon } as Page), h('span', h('b', t.name), h('small', t.line))) as HTMLButtonElement;
        b.addEventListener('click', () => startTemplate(t.id, parent));
        return b;
      }),
      ...ownTemplatesEl(parent),
      key('A MIND MAP', () => newMindMap(parent), '', 'A new page with a mind map'),
      key('BLANK', () => newBlank(parent), '', 'A blank page'));
  // ---- his own templates (editors.u6): SAVE AS TEMPLATE on a page's … puts it here
  const ownTemplatesEl = (parent: string | null): HTMLElement[] => {
    const own = loadOwnTemplates();
    if (!own.length) return [h('p.wsnote.wsnoown', 'Your own templates go here: open a page, tap …, then SAVE AS TEMPLATE.')];
    return [h('small.wsh', 'MY TEMPLATES'), ...own.map((t) => {
      const b = h('button.wstemplate', { type: 'button', dataset: { own: t.id }, 'aria-label': `My template ${t.name}` }, markOf({ icon: t.icon } as Page), h('span', h('b', t.name.toUpperCase()), h('small', `${t.pages.length} page${t.pages.length === 1 ? '' : 's'}, saved ${agoWords(t.at)}`))) as HTMLButtonElement;
      b.addEventListener('click', () => {
        flush();
        const r = fromOwnTemplate(ws(), t, parent);
        if (!r) return say('That template is empty, so nothing was made.');
        change(r.ws, 'none');
        flush();
        openPage(r.root.id);
        say(`“${titleOf(r.root)}” is made from your template, with every word yours to change.`);
      });
      return h('div.wsownt', b, key('DELETE', () => {
        if (!saveOwnTemplates(loadOwnTemplates().filter((x) => x.id !== t.id))) return say('This phone would not let me change your templates just now.');
        showHome();
        say(`Your template “${t.name}” is deleted. Pages made from it stay as they are.`);
      }, 'wsowndel', `Delete my template ${t.name}`));
    })];
  };
  let homePanel: '' | 'new' | 'export' | 'import' | 'voice' = '';
  /** A page with a mind map on it (editors.s8: NEW PAGE → A MIND MAP, "make a mind map"). */
  const newMindMap = (parent: string | null = null): void => {
    flush();
    const r = newPage(ws(), { title: 'Mind map', parent, from: 'made here', blocks: [wblock('mind', '', { mind: [{ id: 'm0', text: 'My idea', parent: null }] })] });
    change(r.ws, 'none');
    flush();
    openPage(r.page.id);
    say('A mind map page: tap the idea in the middle to rename it and add branches.');
  };
  // ---------------------------------------------------------------- VOICE NOTE (editors.s6): one panel for the whole sheet, so a recording survives a redraw
  let voice: ReturnType<typeof voicePanel> | null = null;
  const voiceMade = (t: Tidy, target: 'page' | 'document', at: number): string => {
    const words = doneWords(t, target);
    if (target === 'document') {
      const d = newDoc(t.title, voiceBlocks(t, at).map((b) => docBlock(b.t === 'callout' ? 'quote' : (b.t as Block['t']), b.runs)), 'document', 'a voice note');
      if (!saveDoc(d)) return 'This phone would not keep the document just now (its storage is full or blocked). Your recording is kept: TIDY IT NOW tries again.';
      clear(status, `${words} `, key('OPEN IT', () => void import('../docs/sheet').then((m) => m.openDocs({ id: d.id })), 'on', `Open ${t.title}`));
      wsState.said = words;
      return words;
    }
    flush();
    const r = newPage(ws(), { title: t.title, blocks: voiceBlocks(t, at), from: 'a voice note', icon: 'page' });
    change(r.ws, 'none');
    flush();
    homePanel = '';
    openPage(r.page.id);
    // (opening a page starts its own undo, so UNDO here takes the new page away: into the BIN, as DELETE does)
    const pid = r.page.id;
    clear(status, `${words} `, key('UNDO', () => {
      flush();
      change(deletePage(ws(), pid), 'none');
      flush();
      showHome();
      say('Taken away: the page sits in the BIN for 30 days.');
    }, 'on', 'Undo: take the page away'));
    wsState.said = words;
    return words;
  };
  const voiceEl = (start = false): HTMLElement => {
    if (!voice) voice = voicePanel({ made: voiceMade }, { start });
    return voice.el;
  };
  let query = '';
  const showHome = (): void => {
    flush();
    flushers.clear();
    mode = 'home';
    cur = '';
    openNow.clear();
    keepWhere('', '');
    tidy();
    subs.clear();
    const s = ws();
    const empty = isEmptyWorkspace(s);
    const search = h('input.wssearch', { type: 'search', placeholder: 'Search every page', 'aria-label': 'Search my pages', autocomplete: 'off', enterKeyHint: 'search', value: query }) as HTMLInputElement;
    const results = h('div.wsresults', { 'aria-live': 'polite' });
    const doSearch = (): void => {
      query = search.value;
      wsState.search = query;
      clear(results);
      if (!query.trim()) {
        wsState.results = [];
        return;
      }
      const out = searchWs(ws(), query, docTitle);
      wsState.results = out.map((r) => ({ id: r.page.id, title: r.page.title, line: r.hits[0] ? `${r.hits[0].before}${r.hits[0].match}${r.hits[0].after}` : '' }));
      if (!out.length) return void results.append(h('p.wsnote.wsnone', `Nothing in your pages says “${query.trim()}”. I searched every title and every word on this phone.`));
      results.append(h('small.wsh', `${out.length} PAGE${out.length === 1 ? '' : 'S'}`), ...out.map((r) => {
        const b = h('button.wshit', { type: 'button', dataset: { id: r.page.id }, 'aria-label': `Open ${titleOf(r.page)}` },
          h('b', titleOf(r.page)), r.hits[0]!.path ? h('small', r.hits[0]!.path) : '',
          ...r.hits.map((x) => h('span.wsline1', x.before, h('mark', x.match), x.after))) as HTMLButtonElement;
        b.addEventListener('click', () => openPage(r.page.id));
        return b;
      }));
    };
    search.addEventListener('input', doSearch);
    const recent = recentPages();
    const when = lastBackupAt();
    const keys = h('div.wsrow',
      key('NEW PAGE', () => {
        homePanel = homePanel === 'new' ? '' : 'new';
        showHome();
      }, 'on'),
      key('IMPORT', () => {
        homePanel = homePanel === 'import' ? '' : 'import';
        showHome();
      }),
      key('EXPORT', () => {
        homePanel = homePanel === 'export' ? '' : 'export';
        showHome();
      }),
      key('VOICE NOTE', () => {
        homePanel = homePanel === 'voice' ? '' : 'voice';
        showHome();
      }, '', 'Take a voice note: it becomes a tidy page'),
      key('BIN', () => showBin()),
      key('UNDO', doUndo), key('REDO', doRedo));
    clear(view,
      h('h3.wsh3', 'MY WORKSPACE'),
      empty
        ? h('div.wsempty', h('p.wsemptyline', 'No pages yet. A project gives you a board, notes, decisions and deadlines to start from.'), h('div.wsrow', key('START A PROJECT', () => startTemplate('project'), 'on'), key('START BLANK', () => newBlank())))
        : '',
      keys,
      homePanel === 'new' ? templatesEl(null) : homePanel === 'export' ? exportPanel(null) : homePanel === 'import' ? importPanel() : homePanel === 'voice' ? voiceEl() : '',
      search, results,
      !empty && !query.trim() && recent.length
        ? h('section.wsrecent', { dataset: { part: 'recent' } }, h('small.wsh', 'RECENT'), h('div.wsrecentrow', ...recent.map((p) => {
          const b = h('button.wsrec', { type: 'button', dataset: { id: p.id }, 'aria-label': `Open ${titleOf(p)}` }, markOf(p), h('span', titleOf(p))) as HTMLButtonElement;
          b.addEventListener('click', () => openPage(p.id));
          return b;
        })))
        : '',
      !empty ? h('section.wspages', h('small.wsh', 'ALL MY PAGES'), treeEl()) : '',
      h('p.wsnote.wsbackup', when ? `Backed up to my brain ${agoWords(when)}, sealed so I can't open it. It comes back on a new phone with the rest.` : 'Not backed up yet. SETTINGS → SYSTEM takes the daily backup; until then your pages live on this phone only.'),
    );
    if (query) doSearch();
    say(empty ? '' : `${live(s).length} page${live(s).length === 1 ? '' : 's'}, kept on this phone.`);
    paintState();
  };

  // ---------------------------------------------------------------- export and import
  const exportPanel = (root: string | null): HTMLElement => {
    const out = h('div.wsouts', { 'aria-live': 'polite' });
    const make = (): void => {
      flush();
      const r = exportTree(ws(), root ? [root] : undefined, docTitle);
      if (!r.files.length) return void say('There is nothing to export yet.');
      const bytes = zipStore(r.files.map((f) => ({ name: f.path, data: f.text })));
      const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
      const name = `${root ? titleOf(ws().pages[root]).replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) : 'My workspace'}.zip`;
      wsState.exported.push({ name, size: blob.size, type: blob.type, files: r.files.length });
      clear(out,
        h('div.cvout', h('div.cvoutt', h('b', name), h('small', `${sizeWords(blob.size)} · ${r.files.length} file${r.files.length === 1 ? '' : 's'}: one Markdown file for each of ${r.pages} page${r.pages === 1 ? '' : 's'}, a CSV beside each database`)),
          h('div.cvbtns', key('SAVE', () => saveBlob(blob, name)), key('SHARE', () => void shareBlob(blob, name).then((ok) => ok || say('This phone could not share it; SAVE puts it in Files.'))))),
        ...(r.pictures ? [h('p.wsnote', `${r.pictures} picture${r.pictures === 1 ? '' : 's'} stay in the app: Markdown cannot carry them, so each is a description in the file.`)] : []));
      say(`Made on this phone: ${name}, ${sizeWords(blob.size)}. Nothing was sent.`);
    };
    return h('div.wspanel.wsexport', { dataset: { panel: 'export' } }, h('small.wsh', root ? 'EXPORT THIS PAGE AND WHAT IS INSIDE IT' : 'EXPORT EVERY PAGE'),
      h('p.wsnote', 'A zip of Markdown files, one for each page, the pages inside a page in a folder of its name, links as relative paths, and a CSV beside each database. The size is said as soon as it is made.'),
      h('p.wsnote.wsmdlimits', 'A toggle goes out as a fold (details) that GitHub and Obsidian fold too. Markdown cannot link a synced block to its copies: each goes out as an ordinary line with a mark only I read back, so they are synced again when IMPORT reads this zip. Pictures stay in the app.'),
      key('MAKE THE ZIP', make, 'on'), out);
  };
  const importPanel = (): HTMLElement =>
    h('div.wspanel.wsimport', { dataset: { panel: 'import' } }, h('small.wsh', 'IMPORT'),
      h('p.wsnote', 'A Markdown file, several of them, a zip of a folder of them, or a CSV (it becomes a database, its header the properties). Nothing is uploaded.'),
      key('CHOOSE FILES', () => fileIn.click(), 'on'));
  const addImported = async (files: File[], parent: string | null): Promise<void> => {
    say(`Reading ${files.length === 1 ? files[0]!.name : `${files.length} files`} on this phone…`);
    const all: { path: string; text: string }[] = [];
    const lost: string[] = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        try {
          for (const [p, b] of unzipSync(await bytesOf(f))) {
            if (p.endsWith('/') || /^__MACOSX\//.test(p)) continue;
            if (/\.(md|markdown|txt|csv)$/i.test(p)) all.push({ path: p, text: new TextDecoder().decode(b) });
            else lost.push(`${p.split('/').pop()} (not Markdown or CSV)`);
          }
        } catch {
          lost.push(`${f.name} (I could not open this zip)`);
        }
      } else all.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
    }
    if (!all.length) return say(lost.length ? `I could not read anything: ${lost.join('; ')}.` : 'There was nothing there I can read.');
    const csvOnly = all.length === 1 && /\.csv$/i.test(all[0]!.path);
    flush();
    if (csvOnly) {
      const imp = importCsv(ws(), all[0]!.text, all[0]!.path.replace(/\.csv$/i, '').split('/').pop()!, parent);
      if (!imp) return say('That CSV has no rows I can read.');
      change(imp.ws, 'none');
      flush();
      wsState.imported = imp.line;
      wsState.lost = [...imp.lost];
      openPage(imp.page.id);
      return say(`${imp.line}${imp.lost.length ? ` I could not keep: ${imp.lost.join('; ')}.` : ''}`);
    }
    const imp = importFiles(ws(), all, parent);
    if (!imp.roots.length) return say('I found nothing in those files that makes a page.');
    change(imp.ws, 'none');
    flush();
    const lostAll = [...lost, ...imp.lost];
    wsState.lost = lostAll;
    wsState.imported = `Read ${imp.pages} page${imp.pages === 1 ? '' : 's'}${imp.line ? `. ${imp.line}` : ''}`;
    openPage(imp.roots[0]!.id);
    say(`${wsState.imported}.${lostAll.length ? ` I could not keep: ${lostAll.slice(0, 4).join('; ')}${lostAll.length > 4 ? ` and ${lostAll.length - 4} more` : ''}.` : ' Nothing was left out.'}`);
  };
  fileIn.addEventListener('change', () => {
    const files = [...(fileIn.files ?? [])];
    fileIn.value = '';
    if (files.length) void addImported(files, mode === 'page' && cur ? null : null).catch(() => say('I could not read that. Is it Markdown, a CSV or a zip of them?'));
  });
  const tidy = (): void => void keepOnly(new Set([...imagesInUse(), ...workspaceImageIds()])).catch(() => undefined);

  // ---------------------------------------------------------------- a page
  const openPage = (id: string, focusTitle = false): void => {
    flush();
    if (!ws().pages[id] || ws().pages[id]!.deleted) return showHome();
    mode = 'page';
    cur = id;
    comparing = 0;
    hist = new History(ws());
    savedOnce = savedOnce;
    keepWhere(id, '');
    showPage(id, focusTitle);
  };
  let panelOpen: '' | 'more' | 'move' | 'icon' | 'kinds' | 'pick' | 'comment' | 'ask' | 'export' | 'sync' | 'cards' | 'form' | 'mind' = '';
  let panelFor = '';
  const showPage = (id: string, focusTitle = false): void => {
    flush();
    mode = 'page';
    cur = id;
    const p = ws().pages[id];
    if (!p) return showHome();
    subs.clear();
    flushers.clear();
    const s = ws();
    const row = isRow(s, p);
    const dbPage = isDb(p);
    const t = trail(s, id);
    const crumbs = h('nav.wscrumbs', { 'aria-label': 'Where this page sits' },
      key('MY WORKSPACE', () => showHome(), 'wscrumb', 'Back to my workspace'),
      ...t.slice(0, -1).map((x) => {
        const b = key(titleOf(x), () => openPage(x.id), 'wscrumb', `Up to ${titleOf(x)}`);
        return b;
      }));
    const title = h('input.wstitle', { type: 'text', value: p.title, placeholder: dbPage ? 'Name of this database' : row ? 'Name of this row' : 'Untitled', 'aria-label': 'Page title', enterKeyHint: 'next', autocomplete: 'off' }) as HTMLInputElement;
    let tt = 0;
    const putTitle = (): void => {
      clearTimeout(tt);
      if (page() && page()!.title !== title.value) change(setTitle(ws(), id, title.value), 'none');
    };
    flushers.add(putTitle);
    title.addEventListener('input', () => {
      clearTimeout(tt);
      tt = window.setTimeout(putTitle, 150);
    });
    title.addEventListener('blur', putTitle);
    title.addEventListener('focus', () => (wsState.focus = 'title'));
    title.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      putTitle();
      focusBlock(page()!.blocks[0]?.id ?? '');
    });
    const mark = h('button.wsmark', { type: 'button', 'aria-label': `The mark of this page: ${ICONS[p.icon]?.name ?? 'Page'}. Change it` }, markOf(p)) as HTMLButtonElement;
    mark.addEventListener('click', () => openPanel('icon'));
    const more = key('…', () => openPanel('more'), 'wsmore', 'More for this page: history, move, duplicate, delete');
    const head = h('div.wshead', mark, title);
    const bar = h('div.wsrow.wspagekeys', key('UNDO', doUndo), key('REDO', doRedo), key('SEARCH', () => showHome(), '', 'Search every page'), key('ADD A BLOCK', () => openPanel('kinds', page()!.blocks.at(-1)?.id ?? ''), 'on'), key('ASK ABOUT THIS PROJECT', () => openPanel('ask'), '', 'Ask Ghosty about this project'), ...(dbPage ? [key('FORM', () => openPanel('form'), '', 'A form: each answer becomes a row of this database')] : []), more);
    let focused = '';
    const lineSlot = h('div.wslineslot');
    const panelHost = h('div.wspanelhost', { dataset: { for: id } });
    const blocksEl = h('div.wsblocks', { role: 'group', 'aria-label': 'The page' });
    const tail = h('div.wstail');
    clear(view, crumbs, head, bar, lineSlot, panelHost, ...(row ? [propEditor(ctx, p.parent!, p)] : []), ...(dbPage ? [dbView(ctx, id)] : []), blocksEl, tail);
    const openPanel = (k: typeof panelOpen, f = ''): void => {
      panelOpen = panelOpen === k && panelFor === f && k !== 'kinds' && k !== 'mind' ? '' : k;
      panelFor = f;
      wsState.panel = panelOpen;
      drawPanel();
    };
    const closePanel = (): void => {
      panelOpen = '';
      wsState.panel = '';
      drawPanel();
    };
    const drawPanel = (): void => {
      const a = panelOpen === 'more' ? morePanel() : panelOpen === 'move' ? movePanel() : panelOpen === 'icon' ? iconPanel() : panelOpen === 'kinds' ? kindsPanel(panelFor) : panelOpen === 'pick' ? pickPanel(panelFor) : panelOpen === 'comment' ? commentPanel(panelFor) : panelOpen === 'ask' ? askPanel() : panelOpen === 'export' ? exportPanel(id) : panelOpen === 'sync' ? syncPanel(panelFor) : panelOpen === 'cards' ? cardsPanel(panelFor) : panelOpen === 'form' ? formPanel() : panelOpen === 'mind' ? mindPanel(panelFor) : null;
      clear(panelHost, ...(a ? [a, key('CLOSE', closePanel, 'wsclose', 'Close this panel')] : []));
    };
    // ---- the page's own sheets
    const morePanel = (): HTMLElement =>
      h('div.wspanel.wsmorep', { dataset: { panel: 'more' } },
        key('HISTORY', () => showHistory(id), '', 'The versions of this page'),
        key('MOVE TO', () => openPanel('move'), '', 'Move this page inside another'),
        key('DUPLICATE', () => {
          flush();
          const r = duplicatePage(ws(), id);
          change(r.ws, 'none');
          flush();
          openPage(r.id);
          say('A copy is made, with everything inside it.');
        }),
        key('EXPORT THIS PAGE', () => openPanel('export')),
        key('MAKE FLASHCARDS', () => openPanel('cards'), '', 'Make flashcards from this page for Learn’s revision'),
        key('SAVE AS TEMPLATE', () => {
          flush();
          const t = saveAsTemplate(ws(), id);
          if (!t) return say('That page is not here any more.');
          if (!saveOwnTemplates([...loadOwnTemplates(), t])) return say('This phone would not keep the template just now (its storage is full or blocked).');
          closePanel();
          say(`Saved as a template: NEW PAGE → MY TEMPLATES makes a fresh “${t.name}” whenever you like.`);
        }, '', 'Save this page as a template of my own'),
        key('DELETE', () => {
          const parent = p.parent && !isRow(ws(), p) ? p.parent : isRow(ws(), p) ? p.parent : null;
          change(deletePage(ws(), id), 'none');
          flush();
          if (parent && ws().pages[parent] && !ws().pages[parent]!.deleted) openPage(parent);
          else showHome();
          undoBar('Deleted. It sits in the BIN for 30 days.');
        }, 'wsdel', 'Delete this page: it sits in the bin for thirty days'));
    const movePanel = (): HTMLElement => {
      const s2 = ws();
      const inside = new Set([id, ...below(s2, id).map((x) => x.id)]);
      const options = live(s2).filter((x) => !inside.has(x.id) && !isRow(s2, x) && !isDb(x));
      return h('div.wspanel.wsmovep', { dataset: { panel: 'move' } }, h('small.wsh', 'MOVE THIS PAGE INSIDE'),
        key('THE TOP OF MY WORKSPACE', () => doMove(null), '', 'Move to the top'),
        ...options.map((x) => key(`${'· '.repeat(depth(s2, x.id))}${titleOf(x)}`, () => doMove(x.id), 'wsmoveto', `Move inside ${titleOf(x)}`)),
        h('small.wsnote', 'A page cannot go inside one of its own pages.'));
    };
    const doMove = (to: string | null): void => {
      const r = movePage(ws(), id, to);
      if (r.error) return say(r.error);
      change(r.ws, 'none');
      flush();
      closePanel();
      showPage(id);
      say(`Moved ${to ? `inside ${titleOf(ws().pages[to])}` : 'to the top of my workspace'}.`);
    };
    const iconPanel = (): HTMLElement =>
      h('div.wspanel.wsiconp', { dataset: { panel: 'icon' } }, h('small.wsh', 'THE MARK OF THIS PAGE'),
        h('div.wsrow', ...Object.entries(ICONS).map(([k, v]) => {
          const b = h('button.wsicon', { type: 'button', 'aria-label': v.name, 'aria-pressed': String(p.icon === k) }, icon(v.path, 'ic')) as HTMLButtonElement;
          b.addEventListener('click', () => {
            change(setIcon(ws(), id, k), 'none');
            flush();
            showPage(id);
          });
          return b;
        })));
    const askPanel = (): HTMLElement => {
      const pr = projectOf(ws(), id)!;
      const q = h('input', { type: 'text', placeholder: 'What do you want to ask about it?', 'aria-label': 'Your question about this project', autocomplete: 'off', enterKeyHint: 'send', value: wsState.ask.size ? '' : '' }) as HTMLInputElement;
      const out = h('div.wsaskout', { 'aria-live': 'polite' });
      const sizeBox = h('p.wssize', { dataset: { case: 'keep' } });
      const refresh = (): void => {
        const { flat } = askMessage(ws(), pr.id, q.value, today(), docTitle);
        sizeBox.textContent = sizeLine(flat);
        wsState.ask.size = sizeBox.textContent;
      };
      refresh();
      q.addEventListener('input', refresh);
      const due = (): void => {
        const d = dueWords(ws(), today(), pr.id);
        wsState.due = d.text;
        clear(out, h('p.wsduetext', { dataset: { case: 'keep' } }, d.text), h('small.wsnote', 'That came from your own dates on this phone: I did not need my brain for it.'));
      };
      const send = async (): Promise<void> => {
        const { message, flat } = askMessage(ws(), pr.id, q.value, today(), docTitle);
        wsState.ask.size = sizeLine(flat);
        wsState.ask.sent++;
        clear(out, h('p.wsnote', 'Asking, with the project’s words as the question’s data…'));
        try {
          const r = await askBrain(message, () => undefined, 'workspace');
          wsState.ask.reply = r.text;
          wsState.ask.where = r.where;
          clear(out, h('div.wsreply', { dataset: { where: r.where } },
            h('small.wsh', r.where === 'phone' ? 'FROM MY OWN BRAIN ON THIS PHONE' : 'FROM MY BRAIN'), h('p', { dataset: { case: 'keep' } }, r.text),
            h('div.wsrow',
              key('KEEP IT', () => {
                const bs = replyBlocks(r.text, q.value);
                let w2 = ws();
                let after = page()!.blocks.at(-1)?.id;
                for (const b of bs) {
                  w2 = insertBlock(w2, id, b, after);
                  after = b.id;
                }
                change(w2, 'none');
                flush();
                closePanel();
                showPage(id);
                undoBar('Kept as blocks at the end of this page.');
              }, 'on'),
              key('DISCARD', () => {
                clear(out);
                say('Discarded. Nothing was added to the page.');
              }))));
        } catch (e) {
          const d = dueWords(ws(), today(), pr.id);
          clear(out, h('p.wsnote', `${sayError(e, 'answer that')} Nothing was changed.`), ...(/\bdue\b|deadline/i.test(q.value) ? [h('p.wsduetext', { dataset: { case: 'keep' } }, d.text)] : []));
        }
      };
      return h('div.wspanel.wsask', { dataset: { panel: 'ask' } }, h('small.wsh', `ASK ABOUT ${titleOf(pr).toUpperCase()}`),
        h('p.wsnote', 'I send the words of this project’s pages, its databases as tables and its dates, as the data of one question. Nothing else leaves the phone, and nothing is sent until you say.'),
        q, sizeBox,
        h('div.wsrow', key('SEND', () => void send(), 'on', 'Send the question and the project’s words'), key('DUE THIS WEEK', due, '', 'What is due this week, from my own dates')), out);
    };
    // ---- the blocks
    const focusBlock = (bid: string, at = -1): void => {
      const e = blocksEl.querySelector<HTMLElement>(`.wsblock[data-id="${bid}"] .wsedit`);
      if (!e) return;
      e.focus();
      placeCaret(e, at < 0 ? readRuns(e).reduce((n, x) => n + x.text.length, 0) : at);
    };
    const putRuns = (bid: string, runs: Run[]): void => {
      const cur2 = page()?.blocks.find((b) => b.id === bid);
      if (!cur2 || JSON.stringify(cur2.runs) === JSON.stringify(runs)) return;
      // a synced block: every copy of it, on every page, gets the words (one change, one UNDO)
      change(cur2.sync ? syncRuns(ws(), cur2.sync, runs) : setRuns(ws(), id, bid, runs), 'none');
    };
    const drawBlocks = (focus = '', at = -1): void => {
      const bs = page()?.blocks ?? [];
      const hidden = hiddenBlocks(bs);
      clear(blocksEl, ...bs.flatMap((b, i) => (hidden.has(b.id) ? [] : [blockEl(b, i)])));
      if (!bs.length) blocksEl.append(h('p.wsnote.wsnoblocks', 'Nothing on this page yet. Tap ADD A BLOCK, or type “/” in a line.'), key('START WRITING', () => {
        const nb = wblock('p');
        change(insertBlock(ws(), id, nb), 'none');
        drawBlocks(nb.id);
      }));
      if (focus) focusBlock(focus, at);
    };
    const blockEl = (b: WBlock, i: number): HTMLElement => {
      const row1 = h('div.wsblock', { dataset: { id: b.id, t: b.t, n: String(i) } });
      if (b.under) {
        row1.dataset.under = b.under;
        row1.style.setProperty('--in', String(Math.min(4, toggleDepth(page()?.blocks ?? [], b))));
      }
      const onPages = b.sync ? syncPages(ws(), b.sync).length : 0;
      const syncLabel = b.sync ? h('small.wssynced', `SYNCED · ON ${onPages} PAGE${onPages === 1 ? '' : 'S'}`) : null;
      if (b.sync) row1.dataset.sync = b.sync;
      const talk = (b.comments ?? []).length
        ? h('div.wscomments', { dataset: { for: b.id } }, ...(b.comments ?? []).map((c) => h('p.wscomment', h('small', `${new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`), ' ', c.text)))
        : null;
      // a long press on a block opens its comments
      let lp = 0;
      row1.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('button, input, select')) return;
        const sx = e.clientX;
        const sy = e.clientY;
        clearTimeout(lp);
        lp = window.setTimeout(() => openPanel('comment', b.id), 520);
        const cancel = (ev: PointerEvent): void => {
          if (ev.type === 'pointermove' && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
          clearTimeout(lp);
          removeEventListener('pointermove', cancel);
          removeEventListener('pointerup', cancel);
        };
        addEventListener('pointermove', cancel);
        addEventListener('pointerup', cancel, { once: true });
      });
      if (b.t === 'link') {
        const doc = b.to?.startsWith('doc:');
        const target = doc ? undefined : ws().pages[b.to ?? ''];
        const gone = doc ? !listDocs().some((d) => d.id === b.to!.slice(4)) : !target || !!target.deleted;
        const card = h('button.wslink', { type: 'button', dataset: { to: b.to ?? '', gone: gone ? '1' : '' }, 'aria-label': gone ? 'A page that is not here any more' : `Open ${doc ? docTitle(b.to!.slice(4)) : titleOf(target)}` },
          doc ? icon('<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M9.5 12h5.5M9.5 15.5h5.5"/>', 'ic') : markOf(target ?? ({ icon: 'page' } as Page)),
          h('span.wslt', h('b', gone ? 'Not here any more' : doc ? docTitle(b.to!.slice(4)) : titleOf(target)), h('small', doc ? 'One of my documents' : gone ? 'It went to the BIN or was removed' : trail(ws(), target!.id).slice(0, -1).map(titleOf).join(' › ') || 'Page'))) as HTMLButtonElement;
        card.addEventListener('click', () => {
          if (gone) return say('That page is not here any more. If it is in the BIN, RESTORE brings it back.');
          if (doc) return void import('../docs/sheet').then((m) => m.openDocs({ id: b.to!.slice(4) }));
          openPage(target!.id);
        });
        row1.append(card, blockKeys(b, i));
      } else if (b.t === 'view') {
        const dbp = ws().pages[b.db ?? ''];
        if (!dbp?.db || dbp.deleted) row1.append(h('p.wsnote', 'This database is not here any more.'), blockKeys(b, i));
        else {
          const v = dbView(ctx, dbp.id, { embedded: true, view: b.view, onView: (vid) => change(patchBlock(ws(), id, b.id, (x) => ({ ...x, view: vid })), 'none') });
          row1.append(h('header.wsviewhead', markOf(dbp), h('b', titleOf(dbp)), key('OPEN', () => openPage(dbp.id), '', `Open the database ${titleOf(dbp)}`)), v, blockKeys(b, i));
        }
      } else if (b.t === 'mind') row1.append(mindEl(b), blockKeys(b, i));
      else if (b.t === 'table') row1.append(tableEl(b), blockKeys(b, i));
      else if (b.t === 'img') {
        const src = b.img ? image(b.img) : null;
        row1.append(h('figure.wsfig', src ? h('img', { src, alt: b.alt ?? '' }) : h('div.wsnopic', 'A picture that is not on this phone any more'), h('figcaption', b.alt ?? '')), blockKeys(b, i));
      } else {
        const ed = h(`div.wsedit.${b.t === 'callout' ? 'wscallout' : b.t}` as 'div', { contentEditable: 'true', spellcheck: true, role: 'textbox', 'aria-multiline': 'true', 'aria-label': b.t === 'todo' ? 'A to-do' : b.t === 'callout' ? 'A callout' : b.t.startsWith('h') ? 'A heading' : 'A line of the page', dataset: { t: b.t, ph: i === 0 && !b.runs.length ? 'Type here, or “/” for more' : '' } });
        fillRuns(ed, b.runs);
        let tm = 0;
        const sync = (): void => {
          clearTimeout(tm);
          putRuns(b.id, readRuns(ed));
        };
        flushers.add(sync);
        ed.addEventListener('focus', () => {
          wsState.focus = b.id;
          focused = b.id;
          row1.classList.add('on');
        });
        ed.addEventListener('blur', () => {
          sync();
          row1.classList.remove('on');
        });
        ed.addEventListener('input', () => {
          clearTimeout(tm);
          const text = ed.textContent ?? '';
          if (text === '/' && !b.runs.length) {
            fillRuns(ed, []);
            return openPanel('kinds', b.id);
          }
          tm = window.setTimeout(sync, 150);
        });
        ed.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            const runs = readRuns(ed);
            const [a, z] = splitRuns(runs, caretAt(ed));
            const listy = b.t === 'ul' || b.t === 'ol' || b.t === 'todo';
            if (listy && !runs.length) {
              change(patchBlock(ws(), id, b.id, (x) => ({ ...x, t: 'p' })), 'none');
              return drawBlocks(b.id);
            }
            // (a new line after a toggle goes inside it; a line inside a toggle stays inside)
            const nb = wblock(listy ? b.t : 'p', z, b.t === 'toggle' ? { under: b.id } : b.under ? { under: b.under } : {});
            let w2 = patchBlock(ws(), id, b.id, (x) => ({ ...x, runs: a, ...(b.t === 'toggle' ? { folded: undefined } : {}) }));
            if (b.sync) w2 = syncRuns(w2, b.sync, a);
            w2 = insertBlock(w2, id, nb, b.id);
            change(w2, 'none');
            drawBlocks(nb.id, 0);
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            document.execCommand('insertLineBreak');
          } else if (ev.key === 'Backspace' && getSelection()?.isCollapsed && caretAt(ed) === 0) {
            ev.preventDefault();
            const bs = page()!.blocks;
            const k = bs.findIndex((x) => x.id === b.id);
            if (b.t !== 'p') {
              // (a toggle turned back into a line lets its lines out, where they are)
              let w2 = patchBlock(ws(), id, b.id, (x) => ({ ...x, t: 'p', folded: undefined }));
              if (b.t === 'toggle') w2 = withBlocks(w2, id, (all) => all.map((x) => (x.under === b.id ? { ...x, under: b.under } : x)));
              change(w2, 'none');
              return drawBlocks(b.id, 0);
            }
            if (b.under) {
              change(patchBlock(ws(), id, b.id, (x) => ({ ...x, under: page()!.blocks.find((t) => t.id === b.under)?.under })), 'none');
              return drawBlocks(b.id, 0);
            }
            const prev = bs[k - 1];
            if (!prev || !['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'quote', 'todo', 'right', 'callout'].includes(prev.t)) return;
            const at = prev.runs.reduce((n, x) => n + x.text.length, 0);
            let w2 = patchBlock(ws(), id, prev.id, (x) => ({ ...x, runs: tidyRuns([...x.runs, ...readRuns(ed)]) }));
            w2 = patchBlock(w2, id, b.id, () => null);
            change(w2, 'none');
            drawBlocks(prev.id, at);
          }
        });
        if (b.t === 'todo') {
          const done = !!b.done;
          const box = h('button.wscheck', { type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': 'Tick this to-do' }, done ? '✓' : '') as HTMLButtonElement;
          box.addEventListener('click', () => {
            flush();
            change(tick(ws(), id, b.id, !done), 'none');
            drawBlocks();
            say(!done ? `Ticked, ${dateWords(today())}.` : 'Unticked.');
          });
          row1.append(box, ed, ...(done ? [h('small.wsdone', `Done ${new Date(b.done!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)] : []));
          row1.dataset.done = done ? '1' : '';
        } else if (b.t === 'callout') {
          const tone: Tone = b.tone ?? 'note';
          const next = TONES[(TONES.indexOf(tone) + 1) % TONES.length]!;
          const mark = h('button.wstone', { type: 'button', dataset: { tone }, 'aria-label': `${TONE_WORDS[tone].name}: tap to make it a ${TONE_WORDS[next].name.toLowerCase()}` }, TONE_WORDS[tone].mark) as HTMLButtonElement;
          mark.addEventListener('click', () => {
            flush();
            change(patchBlock(ws(), id, b.id, (x) => ({ ...x, tone: next === 'note' ? undefined : next })), 'none');
            drawBlocks();
            say(`Now a ${TONE_WORDS[next].name.toLowerCase()}. UNDO takes it back.`);
          });
          row1.dataset.tone = tone;
          row1.append(mark, ed);
        } else if (b.t === 'toggle') {
          const f = !!b.folded;
          const n = withInside(page()?.blocks ?? [], b.id).size - 1;
          const chev = h('button.wsfold', { type: 'button', 'aria-expanded': String(!f), 'aria-label': `${f ? 'Open' : 'Fold'} this toggle${n ? `: ${n} line${n === 1 ? '' : 's'} inside` : ''}` }, f ? '›' : '⌄') as HTMLButtonElement;
          chev.addEventListener('click', () => {
            flush();
            change(foldToggle(ws(), id, b.id, !f), 'none');
            drawBlocks();
            say(f ? 'Opened.' : `Folded away${n ? `: ${n} line${n === 1 ? '' : 's'} inside` : ''}.`);
          });
          const add = h('button.wsaddin', { type: 'button', 'aria-label': 'Add a line inside this toggle' }, '+') as HTMLButtonElement;
          add.addEventListener('click', () => {
            flush();
            const nb = wblock('p');
            change(addInside(ws(), id, b.id, nb), 'none');
            drawBlocks(nb.id);
          });
          row1.dataset.folded = f ? '1' : '';
          row1.append(chev, ed, ...(f && n ? [h('small.wsinside', `${n} inside`)] : []), add);
        } else row1.append(ed);
      }
      if (syncLabel) row1.append(syncLabel);
      if (talk) row1.append(talk);
      return row1;
    };
    /** The keys for one block (move, comment, delete; marks too for a line of words). One bar serves the line he is in, so nothing appears or goes under his thumb. */
    const keysFor = (idOf: () => string, edit: boolean, cls = 'wsblockkeys'): HTMLElement => {
      const need = (): WBlock | null => {
        const b = page()?.blocks.find((x) => x.id === idOf());
        if (!b) say('Tap a line of the page first, then use these keys.');
        return b ?? null;
      };
      const mk = (cmd: string): void => {
        const b = need();
        if (!b) return;
        blocksEl.querySelector<HTMLElement>(`.wsblock[data-id="${b.id}"] .wsedit`)?.focus();
        document.execCommand(cmd);
      };
      const kb = h(`div.${cls}` as 'div', { role: 'toolbar', 'aria-label': edit ? 'The line I am in' : 'This block' },
        ...(edit ? [key('B', () => mk('bold'), 'wsfmt', 'Bold'), key('I', () => mk('italic'), 'wsfmt', 'Italic'), key('U', () => mk('underline'), 'wsfmt', 'Underline'), key('S', () => mk('strikeThrough'), 'wsfmt', 'Strikethrough'),
          key('LINK', () => {
            if (!need()) return;
            const a = prompt('The address to link the chosen words to (https://… or an email)');
            const href = a ? safeLink(a) : '';
            if (href) document.execCommand('createLink', false, href);
          }, 'wsfmt', 'Link the chosen words')] : []),
        key('UP', () => {
          const b = need();
          if (!b) return;
          change(moveBlock(ws(), id, b.id, -1), 'none');
          drawBlocks(edit ? b.id : '');
        }, '', 'Move this block up'),
        key('DOWN', () => {
          const b = need();
          if (!b) return;
          change(moveBlock(ws(), id, b.id, 1), 'none');
          drawBlocks(edit ? b.id : '');
        }, '', 'Move this block down'),
        key('COMMENT', () => {
          const b = need();
          if (b) openPanel('comment', b.id);
        }, '', 'A comment on this block'),
        key('SYNC', () => {
          const b = need();
          if (b) openPanel('sync', b.id);
        }, '', 'Show this block on another page too, kept the same'),
        key('DELETE', () => {
          const b = need();
          if (!b) return;
          const gone = withInside(page()!.blocks, b.id);
          change(withBlocks(ws(), id, (all) => all.filter((x) => !gone.has(x.id))), 'none');
          focused = '';
          drawBlocks();
          undoBar(gone.size > 1 ? `The toggle and the ${gone.size - 1} line${gone.size === 2 ? '' : 's'} inside it are deleted.` : 'The block is deleted.');
        }, '', 'Delete this block'));
      kb.addEventListener('pointerdown', (e) => (e.target as HTMLElement).closest('button') && e.preventDefault());
      return kb;
    };
    const blockKeys = (b: WBlock, _i: number): HTMLElement => keysFor(() => b.id, false);
    lineSlot.append(keysFor(() => focused, true, 'wsblockkeys.wslinebar'));
    const tableEl = (b: WBlock): HTMLElement => {
      const rows = b.rows ?? [];
      const t = h('table.wsdt', h('tbody', ...rows.map((r, ri) => h('tr', ...r.map((c, ci) => {
        const td = h(`${ri === 0 && b.head ? 'th' : 'td'}` as 'td', { contentEditable: 'true', role: 'textbox', 'aria-label': `Row ${ri + 1}, column ${ci + 1}`, dataset: { r: String(ri), c: String(ci) } });
        fillRuns(td, c);
        const sync = (): void => {
          const cur3 = page()?.blocks.find((x) => x.id === b.id);
          if (!cur3?.rows) return;
          const next = cur3.rows.map((row2, y) => row2.map((cell, x) => (y === ri && x === ci ? readRuns(td) : cell)));
          if (JSON.stringify(next) !== JSON.stringify(cur3.rows)) change(patchBlock(ws(), id, b.id, (x) => ({ ...x, rows: next })), 'none');
        };
        flushers.add(sync);
        td.addEventListener('blur', sync);
        td.addEventListener('input', () => {
          clearTimeout((td as HTMLElement & { _t?: number })._t);
          (td as HTMLElement & { _t?: number })._t = window.setTimeout(sync, 150);
        });
        return td;
      })))));
      const edit = (f: (r: Run[][][]) => Run[][][]): void => {
        flush();
        change(patchBlock(ws(), id, b.id, (x) => ({ ...x, rows: f((x.rows ?? []).map((r) => r.map((c) => c))) })), 'none');
        drawBlocks();
      };
      return h('div.wstablebox', h('div.wsscroll', t), h('div.wsrow',
        key('ADD ROW', () => edit((r) => [...r, Array.from({ length: r[0]?.length ?? 1 }, () => [])])),
        key('ADD COLUMN', () => edit((r) => r.map((row2) => [...row2, []]))),
        key('REMOVE ROW', () => edit((r) => (r.length > 1 ? r.slice(0, -1) : r))),
        key('REMOVE COLUMN', () => edit((r) => ((r[0]?.length ?? 0) > 1 ? r.map((row2) => row2.slice(0, -1)) : r))),
        key('DELETE TABLE', () => {
          change(patchBlock(ws(), id, b.id, () => null), 'none');
          drawBlocks();
          undoBar('The table is deleted.');
        })));
    };
    // ---- "/": the kinds, a link picker, comments
    const kindsPanel = (at: string): HTMLElement =>
      h('div.wspanel.wskinds', { dataset: { panel: 'kinds' } }, h('small.wsh', 'ADD A BLOCK'),
        ...KIND_ITEMS.map((k) => {
          const b = h('button.wskind', { type: 'button', dataset: { kind: k.id }, 'aria-label': `${k.label}: ${k.line}` }, h('b', k.label), h('small', k.line)) as HTMLButtonElement;
          b.addEventListener('click', () => insertKind(k.id, at));
          return b;
        }));
    const insertKind = (kind: string, at: string): void => {
      const here = page()!.blocks.find((x) => x.id === at);
      // an empty line asked for a kind: that line becomes it
      const replace = here && !here.runs.length && !['table', 'img', 'view', 'link'].includes(here.t) ? here.id : '';
      const put = (nb: WBlock, extra: Workspace = ws()): void => {
        let w2 = extra;
        w2 = insertBlock(w2, id, nb, at || undefined);
        if (replace) w2 = patchBlock(w2, id, replace, () => null);
        change(w2, 'none');
        closePanel();
        drawBlocks(['table', 'img', 'view', 'link'].includes(nb.t) ? '' : nb.id);
      };
      if (kind === 'table') {
        const tb = newTable(3, 3);
        put({ ...(tb as Block), t: 'table' } as WBlock);
        say('A table of three rows and three columns. ADD ROW and ADD COLUMN change it.');
      } else if (kind === 'img') {
        photoIn.dataset.at = at;
        photoIn.dataset.replace = replace;
        photoIn.click();
      } else if (kind === 'page') {
        const r = newPage(ws(), { title: '', parent: id, from: 'made here' });
        put(wblock('link', '', { to: r.page.id }), r.ws);
        say('A page inside this one, linked here. Tap the card to open it.');
      } else if (kind === 'db') {
        const r = newDatabase(ws(), {
          title: 'List', parent: id, icon: 'table',
          props: [{ name: 'Status', kind: 'select', options: ['To do', 'Doing', 'Done'] }, { name: 'Date', kind: 'date' }], views: ['table', 'board', 'calendar'],
        });
        put(wblock('view', '', { db: r.page.id, view: r.page.db!.views[0]!.id }), r.ws);
        say('A database inside this page, with a table, a board and a calendar of its rows.');
      } else if (kind === 'link') openPanel('pick', at);
      else if (kind === 'mind') {
        put(wblock('mind', '', { mind: [{ id: 'm0', text: titleOf(page()) === 'Untitled' ? 'My idea' : titleOf(page()), parent: null }] }));
        say('A mind map: tap the idea in the middle to add a branch.');
      } else put(wblock(kind as WType));
    };
    photoIn.addEventListener('change', () => {
      const f = photoIn.files?.[0];
      const at = photoIn.dataset.at ?? '';
      const rep = photoIn.dataset.replace ?? '';
      photoIn.value = '';
      if (!f || mode !== 'page' || cur !== id) return;
      say('Putting the photo on the page on this phone…');
      void addPhoto(f).then((r) => {
        const nb = wblock('img', '', { img: r.id, alt: '', w: 100, iw: r.iw, ih: r.ih });
        let w2 = insertBlock(ws(), id, nb, at || undefined);
        if (rep) w2 = patchBlock(w2, id, rep, () => null);
        change(w2, 'none');
        closePanel();
        drawBlocks();
        say('A picture on the page, kept on this phone only.');
      }).catch(() => say('I could not read that photo. Is it a picture from your photos?'));
    });
    const pickPanel = (at: string): HTMLElement => {
      const q = h('input', { type: 'search', placeholder: 'Find a page or a document', 'aria-label': 'Find a page or a document to link', autocomplete: 'off' }) as HTMLInputElement;
      const list = h('div.wspicklist');
      const link = (to: string, words: string): void => {
        const here = page()!.blocks.find((x) => x.id === at);
        const replace = here && !here.runs.length && !['table', 'img', 'view', 'link'].includes(here.t) ? here.id : '';
        let w2 = insertBlock(ws(), id, wblock('link', '', { to }), at || undefined);
        if (replace) w2 = patchBlock(w2, id, replace, () => null);
        change(w2, 'none');
        closePanel();
        drawBlocks();
        say(`A link to ${words} on this page.`);
      };
      const draw = (): void => {
        const f = q.value.trim().toLowerCase();
        const pages = live(ws()).filter((x) => x.id !== id && !isRow(ws(), x) && titleOf(x).toLowerCase().includes(f));
        const docs = listDocs().filter((d) => d.title.toLowerCase().includes(f));
        clear(list, h('small.wsh', 'PAGES'), ...(pages.length ? pages.slice(0, 30).map((x) => key(`${'· '.repeat(depth(ws(), x.id))}${titleOf(x)}`, () => link(x.id, `“${titleOf(x)}”`), 'wspick', `Link to ${titleOf(x)}`)) : [h('p.wsnote', 'No page of that name.')]),
          h('small.wsh', 'MY DOCUMENTS'), ...(docs.length ? docs.slice(0, 30).map((d) => key(d.title, () => link(`doc:${d.id}`, `“${d.title}”`), 'wspick wspickdoc', `Link to my document ${d.title}`)) : [h('p.wsnote', listDocs().length ? 'No document of that name.' : 'No documents yet. Write one in DOCUMENTS.')]));
      };
      q.addEventListener('input', draw);
      draw();
      return h('div.wspanel.wspickp', { dataset: { panel: 'pick' } }, h('small.wsh', 'LINK TO A PAGE OR A DOCUMENT'), q, list);
    };
    // ---- MIND MAP (editors.s8): the tree drawn from the left, each idea a 44 pt key; its panel adds, renames, deletes, makes to-dos
    const COL = 176;
    const ROW = 60;
    const mindEl = (b: WBlock): HTMLElement => {
      const L = layout(b.mind ?? []);
      const w = (L.depth + 1) * COL;
      const ht = Math.max(1, L.rows) * ROW;
      const at = new Map(L.nodes.map((n) => [n.id, n]));
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'wsmindlines');
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(ht));
      svg.setAttribute('aria-hidden', 'true');
      for (const [a, z] of L.edges) {
        const p = at.get(a)!;
        const q = at.get(z)!;
        const x1 = p.depth * COL + COL - 20;
        const y1 = p.row * ROW + ROW / 2;
        const x2 = q.depth * COL;
        const y2 = q.row * ROW + ROW / 2;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', `M${x1} ${y1} C${x1 + 14} ${y1}, ${x2 - 14} ${y2}, ${x2} ${y2}`);
        svg.append(path);
      }
      const nodes = L.nodes.map((n) => {
        const kids = kidsOf(b.mind ?? [], n.id).length;
        const k = h('button.wsmindnode', { type: 'button', dataset: { node: n.id, depth: String(n.depth) }, style: `left:${n.depth * COL}px;top:${n.row * ROW + 6}px;width:${COL - 24}px`, 'aria-label': `${n.text || 'An empty idea'}${kids ? `, ${kids} branch${kids === 1 ? '' : 'es'}` : ''}: tap to add a branch, rename it or make to-dos` }, n.text || '…') as HTMLButtonElement;
        k.addEventListener('click', () => openPanel('mind', `${b.id}:${n.id}`));
        return k;
      });
      return h('div.wsmind', { dataset: { scrolls: '1' }, role: 'group', 'aria-label': 'A mind map' }, h('div.wsmindin', { style: `width:${w}px;height:${ht}px` }, svg, ...nodes));
    };
    const mindPanel = (f: string): HTMLElement => {
      const [bid, nid] = f.split(':') as [string, string];
      const b = page()?.blocks.find((x) => x.id === bid);
      const n = b?.mind?.find((x) => x.id === nid);
      if (!b || !n) return h('div.wspanel', h('p.wsnote', 'That idea is not on the map any more.'));
      const setMind = (m: MindNode[]): Workspace => patchBlock(ws(), id, bid, (x) => ({ ...x, mind: m }));
      const name = h('input.wsfin', { type: 'text', value: n.text, 'aria-label': 'The idea', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
      const rename = (): void => {
        const cur4 = page()?.blocks.find((x) => x.id === bid)?.mind ?? [];
        if (cur4.find((x) => x.id === nid)?.text === name.value.trim()) return;
        change(setMind(renameNode(cur4, nid, name.value)), 'none');
        drawBlocks();
      };
      flushers.add(rename);
      name.addEventListener('change', rename);
      name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), rename()));
      const todos = branchTodos(b.mind ?? [], nid);
      return h('div.wspanel.wsmindp', { dataset: { panel: 'mind', node: nid } }, h('small.wsh', n.parent === null ? 'THE IDEA IN THE MIDDLE' : 'A BRANCH'), name,
        h('div.wsrow',
          key('ADD A BRANCH', () => {
            rename();
            const r = addNode(page()?.blocks.find((x) => x.id === bid)?.mind ?? [], nid, '');
            if ('error' in r) return say(r.error);
            change(setMind(r.nodes), 'none');
            drawBlocks();
            openPanel('mind', `${bid}:${r.id}`);
            panelHost.querySelector<HTMLInputElement>('.wsmindp input')?.focus();
            say('A new branch: type its words.');
          }, 'on', 'Add a branch to this idea'),
          ...(todos.length ? [key(`MAKE ${todos.length} TO-DO${todos.length === 1 ? '' : 'S'}`, () => {
            rename();
            const list = branchTodos(page()?.blocks.find((x) => x.id === bid)?.mind ?? [], nid);
            let w2 = ws();
            let after = bid;
            for (const t of list) {
              const nb = wblock('todo', t);
              w2 = insertBlock(w2, id, nb, after);
              after = nb.id;
            }
            change(w2, 'none');
            closePanel();
            drawBlocks();
            undoBar(`${list.length} to-do${list.length === 1 ? ' is' : 's are'} under the map: ${list.map((t) => `“${t}”`).join(', ')}.`);
          }, '', `Turn this branch into ${todos.length} to-dos`)] : []),
          ...(n.parent !== null ? [key('DELETE THIS BRANCH', () => {
            change(setMind(removeNode(page()?.blocks.find((x) => x.id === bid)?.mind ?? [], nid)), 'none');
            closePanel();
            drawBlocks();
            undoBar('The branch is deleted, with what grew from it.');
          }, '', 'Delete this branch and what grows from it')] : [])));
    };
    // ---- FORM (editors.s1): the database's columns as questions; each answer a new row, the form clear for the next
    const formPanel = (): HTMLElement => {
      const d = page()?.db;
      if (!d) return h('div.wspanel');
      const qs = formQuestions(d);
      const name = h('input.wsfin', { type: 'text', 'aria-label': 'Name', placeholder: 'Name', autocomplete: 'off', enterKeyHint: 'next' }) as HTMLInputElement;
      const fields = new Map<string, () => string | boolean | string[]>();
      const clearAll: (() => void)[] = [() => (name.value = '')];
      const field = (pr: (typeof qs)[number]): HTMLElement => {
        const lab = h('span.wsfqn', pr.name);
        if (pr.kind === 'select') {
          const sel = h('select.wsfin', { 'aria-label': pr.name }, h('option', { value: '' }, 'Not chosen'), ...(pr.options ?? []).map((o) => h('option', { value: o }, o))) as HTMLSelectElement;
          fields.set(pr.id, () => sel.value);
          clearAll.push(() => (sel.value = ''));
          return h('label.wsfq', { dataset: { prop: pr.id } }, lab, sel);
        }
        if (pr.kind === 'multi' || pr.kind === 'check') {
          const opts = pr.kind === 'check' ? [pr.name] : (pr.options ?? []);
          const boxes = opts.map((o) => {
            const b = h('input', { type: 'checkbox', value: o, 'aria-label': pr.kind === 'check' ? pr.name : `${pr.name}: ${o}` }) as HTMLInputElement;
            clearAll.push(() => (b.checked = false));
            return { o, b };
          });
          fields.set(pr.id, () => (pr.kind === 'check' ? boxes[0]!.b.checked : boxes.filter((x) => x.b.checked).map((x) => x.o)));
          return h('fieldset.wsfq', { dataset: { prop: pr.id } }, h('legend.wsfqn', pr.name), ...boxes.map((x) => h('label.wsfbox', x.b, h('span', pr.kind === 'check' ? 'Yes' : x.o))));
        }
        const inp = h('input.wsfin', { type: pr.kind === 'date' ? 'date' : 'text', inputMode: pr.kind === 'number' ? 'decimal' : 'text', 'aria-label': pr.name, autocomplete: 'off' }) as HTMLInputElement;
        fields.set(pr.id, () => inp.value);
        clearAll.push(() => (inp.value = ''));
        return h('label.wsfq', { dataset: { prop: pr.id } }, lab, inp);
      };
      const err = h('p.wsferr', { 'aria-live': 'assertive' });
      const submit = (): void => {
        flush();
        const raw: FormRaw = {};
        for (const [k, f] of fields) raw[k] = f();
        const dd = page()?.db;
        if (!dd) return;
        const a = formAnswer(dd, name.value, raw);
        if ('error' in a) {
          err.textContent = a.error;
          say(a.error);
          return;
        }
        err.textContent = '';
        const r = addRow(ws(), id, a.title, a.vals);
        change(r.ws, 'views');
        for (const c of clearAll) c();
        name.focus();
        undoBar(`Added: “${a.title}” is a new row of ${titleOf(page())}. The form is clear for the next one.`);
      };
      name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
      const skipped = formSkipped(d);
      return h('div.wspanel.wsformp', { dataset: { panel: 'form' } }, h('small.wsh', `FORM · ${titleOf(page()).toUpperCase()}`),
        h('p.wsnote', 'Each answer becomes a new row of this database, kept on this phone. Leave a box empty to leave it blank.'),
        h('label.wsfq', h('span.wsfqn', 'Name'), name), ...qs.map(field), err,
        key('ADD THIS ANSWER', submit, 'on', 'Add this answer as a new row'),
        ...(skipped.length ? [h('p.wsnote', `Not asked: ${skipped.join(', ')}.`)] : []));
    };
    // ---- MAKE FLASHCARDS (editors.c3, into LEARN's own revision): from this page, or from one of MY DOCUMENTS
    const cardsPanel = (src: string): HTMLElement => {
      const doc = src.startsWith('doc:') ? listDocs().find((d) => d.id === src.slice(4)) : undefined;
      const title = doc ? doc.title : titleOf(page());
      const cards: NoteCard[] = cardsFrom(doc ? (doc.blocks as WBlock[]) : (page()?.blocks ?? []));
      const out = h('div.wscardsout', { 'aria-live': 'polite' });
      const sayCards = (w: string, state: string): void => {
        out.dataset.state = state;
        clear(out, h('p.wsnote', w));
        say(w);
      };
      const make = async (): Promise<void> => {
        if (!navigator.onLine) return sayCards('Offline: Learn keeps its cards with your brain, so I make them when you are back online. Your page is as it was.', 'offline');
        const L = await import('../features/learn/store');
        let made = 0;
        try {
          for (const c of cards) {
            sayCards(`Making your cards… ${made + 1} of ${cards.length}.`, 'loading');
            await L.addCard('general', c.front, c.back);
            made++;
          }
        } catch {
          return sayCards(made ? `I made ${made} of ${cards.length} cards; the rest could not reach Learn just now. MAKE them again adds only the missing ones.` : 'I could not reach Learn just now, so no cards were made. Try again in a moment.', 'error');
        }
        out.dataset.state = 'done';
        const w = `Done: ${made} card${made === 1 ? ' is' : 's are'} in Learn’s revision, from “${title}”.`;
        clear(out, h('p.wsnote', w), key('REVISE NOW', () => void import('../features/learn').then((m) => m.openLearn({ view: 'revise' })), 'on', 'Revise these cards now in Learn'));
        say(w);
        wsState.said = w;
      };
      const docs = listDocs().slice(0, 8);
      return h('div.wspanel.wscardsp', { dataset: { panel: 'cards', src } }, h('small.wsh', 'MAKE FLASHCARDS'),
        h('p.wsnote', cardsWords(cards.length, title)),
        ...(cards.length ? [h('ol.wscards', ...cards.slice(0, 8).map((c) => h('li', h('b', c.front), h('span', c.back)))), cards.length > 8 ? h('p.wsnote', `and ${cards.length - 8} more`) : '',
          h('p.wsnote', 'They go into Learn’s revision with your other cards (Learn keeps its cards with your brain), and this page stays as it is.'),
          key(`MAKE ${cards.length} CARD${cards.length === 1 ? '' : 'S'}`, () => void make(), 'on', `Make ${cards.length} flashcards for Learn`)] : []),
        out,
        ...(docs.length ? [h('small.wsh', 'OR FROM ONE OF MY DOCUMENTS'), ...docs.map((d) => key(d.title, () => openPanel('cards', `doc:${d.id}`), 'wspick wspickdoc', `Flashcards from my document ${d.title}`))] : []),
        ...(doc ? [key('FROM THIS PAGE', () => openPanel('cards', ''), '', 'Flashcards from this page')] : []));
    };
    // ---- SYNC (editors.u6): one block shown on several pages; editing one edits all
    const syncPanel = (bid: string): HTMLElement => {
      const b = page()?.blocks.find((x) => x.id === bid);
      if (!b) return h('div.wspanel');
      const on = b.sync ? syncPages(ws(), b.sync) : [];
      const options = live(ws()).filter((x) => !isRow(ws(), x) && !isDb(x) && !on.some((o) => o.id === x.id) && x.id !== id);
      const put = (to: string): void => {
        flush();
        const r = syncTo(ws(), id, bid, to);
        if (r.error) return say(r.error);
        change(r.ws, 'none');
        drawBlocks();
        drawPanel();
        say(`Synced: it is on “${titleOf(ws().pages[to])}” too, and changing it on either page changes both.`);
      };
      return h('div.wspanel.wssyncp', { dataset: { panel: 'sync', block: bid } }, h('small.wsh', 'SYNC THIS BLOCK TO A PAGE'),
        h('p.wsquote', wText(b, ws(), docTitle).slice(0, 120) || 'This block'),
        on.length ? h('p.wsnote', `On ${on.length} page${on.length === 1 ? '' : 's'}: ${on.map((x) => `“${titleOf(x)}”`).join(', ')}.`) : h('p.wsnote', 'Pick a page: the block goes at its end, and stays the same on both.'),
        ...options.slice(0, 40).map((x) => key(`${'· '.repeat(depth(ws(), x.id))}${titleOf(x)}`, () => put(x.id), 'wssyncto', `Sync to ${titleOf(x)}`)),
        ...(b.sync ? [key('UNSYNC THIS ONE', () => {
          change(unsync(ws(), id, bid), 'none');
          drawBlocks();
          closePanel();
          say('This one is on its own now; the other copies stay synced.');
        }, '', 'Let this block go of its synced copies')] : []));
    };
    const commentPanel = (bid: string): HTMLElement => {
      const b = page()?.blocks.find((x) => x.id === bid);
      if (!b) return h('div.wspanel');
      const q = h('input', { type: 'text', placeholder: 'A comment to myself on this block', 'aria-label': 'A comment on this block', enterKeyHint: 'done', autocomplete: 'off' }) as HTMLInputElement;
      const add = (): void => {
        if (!q.value.trim()) return;
        change(addComment(ws(), id, bid, q.value), 'none');
        drawBlocks();
        drawPanel();
        say('Comment kept, with today’s date.');
      };
      q.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), add()));
      return h('div.wspanel.wscommentp', { dataset: { panel: 'comment', block: bid } }, h('small.wsh', 'COMMENTS ON THIS BLOCK'),
        h('p.wsquote', wText(b, ws(), docTitle).slice(0, 120) || 'This block'),
        ...(b.comments ?? []).map((c) => h('div.wsrow', h('p.wscomment', h('small', new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })), ' ', c.text),
          key('REMOVE', () => {
            change(removeComment(ws(), id, bid, c.id), 'none');
            drawBlocks();
            drawPanel();
          }, '', 'Remove this comment'))),
        h('div.wsrow', q, key('ADD COMMENT', add, 'on')),
        h('small.wsnote', 'A comment is my own words to myself. Ghosty’s suggestions come through SUGGESTIONS in DOCUMENTS, accepted one by one.'));
    };
    // ---- under the blocks: the pages inside, and BACKLINKS
    const inside = children(s, id).filter((x) => !isRow(s, x));
    const backs = backlinks(s, id);
    clear(tail,
      inside.length ? h('section.wsinside', { dataset: { part: 'inside' } }, h('small.wsh', 'PAGES INSIDE'), ...inside.map((x) => {
        const b = h('button.wsopen', { type: 'button', dataset: { id: x.id } }, markOf(x), h('span.wstt', titleOf(x))) as HTMLButtonElement;
        b.addEventListener('click', () => openPage(x.id));
        return b;
      }), key('NEW PAGE INSIDE', () => newBlank(id), '', 'A new page inside this one')) : key('NEW PAGE INSIDE', () => newBlank(id), '', 'A new page inside this one'),
      h('section.wsbacklinks', { dataset: { part: 'backlinks', n: String(backs.length) } }, h('small.wsh', 'BACKLINKS'),
        ...(backs.length ? backs.map((x) => {
          const b = h('button.wsbl', { type: 'button', dataset: { id: x.page.id }, 'aria-label': `Open ${titleOf(x.page)}, which links here` }, markOf(x.page), h('span.wstt', titleOf(x.page))) as HTMLButtonElement;
          b.addEventListener('click', () => openPage(x.page.id));
          return b;
        }) : [h('p.wsnote', 'Nothing links here yet. A link to this page from another page shows up here by itself.')])),
      h('p.wsnote', `${wordsOf(p, s)} word${wordsOf(p, s) === 1 ? '' : 's'} on this page · ${new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`));
    drawBlocks(focusTitle ? '' : '');
    if (focusTitle) title.focus();
    wsState.panel = panelOpen;
    drawPanel();
    paintState();
    if (panelOpen === 'comment' && panelFor && !page()?.blocks.some((b) => b.id === panelFor)) closePanel();
  };
  const replyBlocks = (text: string, question: string): WBlock[] => {
    const bs = fromMarkdown(text);
    const out: WBlock[] = [wblock('h3', question.trim() ? `Ghosty on: ${question.trim()}` : 'Ghosty on this project')];
    for (const b of bs) out.push({ ...(b as WBlock), id: wblock('p').id });
    if (!bs.length) out.push(wblock('p', text));
    return out;
  };

  // ---------------------------------------------------------------- history
  /** The version being compared with now (kept through UNDO, so the compare stays open). */
  let comparing = 0;
  const showHistory = (id: string): void => {
    flush();
    flushers.clear();
    mode = 'history';
    cur = id;
    subs.clear();
    const p = ws().pages[id];
    if (!p) return showHome();
    const list = versionsOf(ws(), id);
    const body = h('div.wsvpreview', { 'aria-live': 'polite' });
    const open = (at: number): void => {
      const v = list.find((x) => x.at === at)!;
      preview = at;
      comparing = 0;
      clear(body,
        h('small.wsh', `AS IT WAS ${agoWords(v.at).toUpperCase()} · READ ONLY`),
        h('h4.wsvtitle', v.title.trim() || 'Untitled'),
        ...v.blocks.map((b) => h('p.wsvblock', { dataset: { t: b.t } }, b.t === 'todo' ? `${b.done ? '☑' : '☐'} ` : b.t === 'ul' ? '• ' : '', wText(b, ws(), docTitle))),
        key('RESTORE THIS VERSION', () => {
          flush();
          change(restoreVersion(ws(), id, v.at), 'none');
          flush();
          mode = 'page';
          showPage(id);
          undoBar(`Restored to the version from ${agoWords(v.at)}. UNDO brings back what was here.`);
        }, 'on'),
        key('COMPARE WITH NOW', () => compare(v.at), '', 'Compare this version with the page as it is now, side by side'));
      for (const x of view.querySelectorAll<HTMLElement>('.wsver')) x.setAttribute('aria-pressed', String(Number(x.dataset.at) === at));
    };
    // COMPARE WITH NOW (editors.u10): the version and now side by side, changes coloured, one part brought back at a time
    const compare = (at: number): void => {
      const v = list.find((x) => x.at === at);
      if (!v) return;
      preview = at;
      comparing = at;
      wsState.compare = at;
      const parts = comparePage(v.blocks, ws().pages[id]?.blocks ?? []);
      const words = (b: WBlock | undefined): string => (b ? `${b.t === 'todo' ? `${b.done ? '☑' : '☐'} ` : b.t === 'ul' ? '• ' : ''}${wText(b, ws(), docTitle)}` : '');
      const marked = (x: Part, side: 'then' | 'now'): Node[] => (x.words ?? []).flatMap((w): Node[] => (w.same !== undefined ? [document.createTextNode(w.same)] : side === 'then' && w.gone !== undefined ? [h('del.wscmpgone', w.gone)] : side === 'now' && w.came !== undefined ? [h('ins.wscmpcame', w.came)] : []));
      const bring = (x: Part): void => {
        flush();
        change(withBlocks(ws(), id, (bs) => restorePart(v.blocks, bs, x.id)), 'none');
        flush();
        compare(at);
        undoBar(x.kind === 'came' ? 'Taken out, as it was in that version. UNDO puts it back.' : 'Brought back from that version, just that part. UNDO takes it away again.');
      };
      const changed = parts.filter((x) => x.kind !== 'same');
      const same = parts.length - changed.length;
      clear(body,
        h('small.wsh', `${agoWords(v.at).toUpperCase()} · BESIDE · NOW`),
        h('p.wsnote.wscmpsum', changeWords(parts)),
        h('div.wscmphead', { 'aria-hidden': 'true' }, h('b', 'THEN'), h('b', 'NOW')),
        ...changed.map((x) => h('div.wscmp', { dataset: { kind: x.kind, id: x.id } },
          h('div.wscmpcols',
            h('p.wscmpthen', { 'aria-label': x.kind === 'came' ? 'Not in that version' : `Then: ${words(x.then)}` }, ...(x.kind === 'changed' ? marked(x, 'then') : x.kind === 'gone' ? [h('del.wscmpgone', words(x.then))] : [h('span.wscmpnone', 'not there')])),
            h('p.wscmpnow', { 'aria-label': x.kind === 'gone' ? 'Not there now' : `Now: ${words(x.now)}` }, ...(x.kind === 'changed' ? marked(x, 'now') : x.kind === 'came' ? [h('ins.wscmpcame', words(x.now))] : [h('span.wscmpnone', 'gone now')]))),
          key(x.kind === 'came' ? 'TAKE THIS OUT' : 'BRING THIS BACK', () => bring(x), '', x.kind === 'came' ? 'Take this added part out, as in that version' : 'Bring this part back from that version'))),
        same ? h('p.wsnote', `${same} block${same === 1 ? '' : 's'} the same in both.`) : '',
        h('div.wsrow', key('BACK TO THIS VERSION', () => open(at)), key('RESTORE THE WHOLE VERSION', () => {
          flush();
          change(restoreVersion(ws(), id, v.at), 'none');
          flush();
          mode = 'page';
          showPage(id);
          undoBar(`Restored to the version from ${agoWords(v.at)}. UNDO brings back what was here.`);
        })));
      say(changeWords(parts));
    };
    clear(view,
      h('nav.wscrumbs', key('BACK TO THE PAGE', () => openPage(id), 'wscrumb', 'Back to the page')),
      h('h3.wsh3', `HISTORY · ${titleOf(p).toUpperCase()}`),
      list.length
        ? h('div.wsvers', ...list.map((v) => {
          const b = h('button.wsver', { type: 'button', dataset: { at: String(v.at) }, 'aria-pressed': 'false' }, h('b', agoWords(v.at)), h('small', `${[v.title, ...v.blocks.map((x) => wText(x, ws(), docTitle))].join(' ').match(/\S+/g)?.length ?? 0} words · ${new Date(v.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)) as HTMLButtonElement;
          b.addEventListener('click', () => open(v.at));
          return b;
        }))
        : h('p.wsnote', 'No versions yet. I keep one each time you stop typing, sixty for every page.'),
      body);
    say(list.length ? `${list.length} version${list.length === 1 ? '' : 's'} of this page, newest first. Tap one to read it.` : '');
    wsState.view = 'history';
    paintState();
    if (comparing && list.some((v) => v.at === comparing)) compare(comparing);
    void preview;
  };

  // ---------------------------------------------------------------- the BIN
  const showBin = (): void => {
    flush();
    flushers.clear();
    mode = 'bin';
    cur = '';
    subs.clear();
    const list = binned(ws());
    clear(view,
      h('nav.wscrumbs', key('MY WORKSPACE', () => showHome(), 'wscrumb', 'Back to my workspace')),
      h('h3.wsh3', 'BIN'),
      list.length
        ? h('div.wsbin', ...list.map((p) => h('div.wsrow.wsbinrow', { dataset: { id: p.id } }, h('span.wsbintt', markOf(p), h('b', titleOf(p)), h('small', `${binDaysLeft(p)} day${binDaysLeft(p) === 1 ? '' : 's'} left${below(ws(), p.id).length ? ` · ${below(ws(), p.id).length} inside` : ''}`)),
          key('RESTORE', () => {
            change(restorePage(ws(), p.id), 'none');
            flush();
            showBin();
            say(`“${titleOf(p)}” is back, with everything that went with it.`);
          }, '', `Restore ${titleOf(p)}`))))
        : h('p.wsnote', 'The BIN is empty. A page I delete sits here for 30 days before it is gone for good.'),
      list.length ? key('EMPTY THE BIN', () => {
        const r = emptyBin(ws());
        change(r.ws, 'none');
        flush();
        showBin();
        say(`${r.gone} page${r.gone === 1 ? '' : 's'} gone for good.`);
      }) : '');
    say('');
    wsState.view = 'bin';
    paintState();
  };

  // ---------------------------------------------------------------- start
  void knownNames().then((n) => (people = n));
  const start = async (o: WsAsk): Promise<void> => {
    if (o.addDoc) {
      showHome();
      return addDocFlow(o.addDoc);
    }
    if (o.what === 'project') return startTemplate('project');
    if (o.what === 'blank') return newBlank();
    if (o.what === 'bin') return showBin();
    if (o.what === 'mind') return newMindMap();
    if (o.what === 'voice') {
      homePanel = 'voice';
      voiceEl();
      return showHome();
    }
    if (o.what === 'import') {
      homePanel = 'import';
      showHome();
      return say('Choose the Markdown, the zip or the CSV and I read it here. Nothing is uploaded.');
    }
    if (o.id && ws().pages[o.id] && !ws().pages[o.id]!.deleted) return openPage(o.id);
    if (!o.what) {
      const wh = where();
      if (wh && ws().pages[wh.page] && !ws().pages[wh.page]!.deleted) return openPage(wh.page);
    }
    showHome();
    if (o.what === 'due') {
      const d = dueWords(ws(), today());
      wsState.due = d.text;
      say(d.text);
    }
  };
  /** ADD TO A PROJECT: the answer's words become a page inside the project he picks (or a new one). */
  const addDocFlow = (d: { text: string; title?: string }): void => {
    const projects = children(ws(), null);
    const add = (parent: string | null): void => {
      const bs = fromMarkdown(d.text).map((b) => ({ ...(b as WBlock) }));
      const r = newPage(ws(), { title: d.title?.trim() || 'From my last answer', parent, blocks: bs.length ? bs : [wblock('p', d.text)], from: 'an answer added' });
      change(r.ws, 'none');
      flush();
      openPage(r.page.id);
      say(`Added as a page${parent ? ` inside ${titleOf(ws().pages[parent])}` : ''}. It stays yours to change.`);
    };
    clear(view,
      h('h3.wsh3', 'ADD TO A PROJECT'),
      h('p.wsnote', `“${d.title?.trim() || 'This answer'}” becomes a page inside the project you pick, kept on this phone.`),
      h('div.wsprojects', ...projects.map((p) => key(titleOf(p), () => add(p.id), 'wsprojpick', `Add to ${titleOf(p)}`)),
        key('A NEW PROJECT', () => {
          const r = fromTemplate(ws(), 'project', null, new Date());
          change(r.ws, 'none');
          flush();
          add(r.root.id);
        }, 'on'),
        key('JUST A PAGE OF ITS OWN', () => add(null))),
      key('CANCEL', () => showHome()));
    say('Pick the project to add it to.');
    wsState.view = 'home';
    paintState();
  };
  const stop = (): void => {
    voice?.stop();
    voice = null;
    flush();
    setLiveWork('workspace', null);
    clearTimeout(timer);
    clearTimeout(retry);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
  void loadImages;
  void putPage;
  void patchPage;
  void isInside;
  void shiftPage;
  void wblock;
  void withBlocks;
  void listDocs;
  void flatten;
  return { el, start, stop };
}

async function knownNames(): Promise<string[]> {
  try {
    const { knownFaces } = await import('../vision/facestore');
    return [...new Set((await knownFaces()).map((f) => f.name.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}
