/**
 * THE APP KIT (APPS ROUND, consistency's flagship): the one frame every app in Ghosty is built from, so a hundred apps read as
 * made by one company. One call, `app(root, spec)`, gives an app:
 *   - its header: its own icon and name, a search key, a settings key;
 *   - ONE scroll area (`body`): the page itself never scrolls, and nothing scrolls twice;
 *   - a toolbar of keys at the bottom, in thumb reach;
 *   - one calm place for notices, in the header's foot: small, never mid-screen, gone on its own or with a tap;
 *   - every state in plain words: `loading` (skeleton rows, never content popping in), `empty` (with what to do), `error` (with its fix);
 *   - a first run that shows it working with sample data and a three-step tour, never an empty grey screen;
 *   - search inside the app, undo and redo for every change, deletes kept in RECENTLY DELETED;
 *   - share and export (CSV and JSON, through the phone's Share sheet where there is one), and a settings sheet;
 *   - a Home card (`homeCard`), the app's widget-sized summary.
 * Every class is `ak-`-prefixed (styles.css "THE APP KIT"), and every colour is a world token, so it is right in all seven looks.
 * The kit keeps nothing off the phone: an app's things live in localStorage under its own key (`ghosty.app.<id>`).
 * docs/build-plan/APP-KIT.md shows how to build an app from it; `kitDemo()` is a whole one (tests/appkit.spec.mjs drives it).
 */
import { h, icon } from '../core/dom';
import { key } from './machine';

/** The kit's own icons (24-unit paths, drawn in the world's stroke). */
export const KIT_ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
};

/** One thing an app keeps: an id, a title and a line, and whatever else the app needs. */
export interface KitItem {
  id: string;
  title: string;
  sub?: string;
  meta?: string;
  [more: string]: unknown;
}

export interface KitSetting {
  id: string;
  label: string;
  on: boolean;
}

export interface KitSpec {
  /** Its own id (its key on the phone: ghosty.app.<id>) and name, as on its hub card and in the Jump bar. */
  id: string;
  name: string;
  /** Its icon (24-unit SVG paths), the same as its hub card's. */
  glyph?: string;
  /** What a thing is called, one and many ("list", "lists"), for the words the kit says. */
  noun: [string, string];
  /** What the first run shows, so it is never an empty screen. */
  sample: KitItem[];
  /** The three steps of the first run's tour, one short sentence each. */
  tour: [string, string, string];
  /** The keys along the bottom (the kit adds none of its own there). */
  actions?: { word: string; glyph?: string; run: (k: KitApp) => void }[];
  settings?: KitSetting[];
  /** A thing tapped (the app opens it its own way). */
  open?: (item: KitItem, k: KitApp) => void;
}

export interface KitApp {
  el: HTMLElement;
  /** The one scroll area. */
  body: HTMLElement;
  items(): KitItem[];
  add(item: KitItem): void;
  update(id: string, patch: Partial<KitItem>): void;
  remove(id: string): void;
  undo(): boolean;
  redo(): boolean;
  /** RECENTLY DELETED: what was taken away, newest first, each one put back with `restore`. */
  bin(): KitItem[];
  restore(id: string): void;
  search(q: string): void;
  notice(words: string, o?: { tone?: 'ok' | 'warn'; ms?: number }): void;
  state(kind: 'ready' | 'loading' | 'empty' | 'error', words?: string, fix?: { word: string; run: () => void }): void;
  exportAs(kind: 'csv' | 'json'): { name: string; text: string };
  share(kind: 'csv' | 'json'): Promise<'shared' | 'saved'>;
  openSettings(): void;
  setting(id: string): boolean;
  render(): void;
}

interface Kept {
  items: KitItem[];
  bin: (KitItem & { gone: number })[];
  seen: boolean;
  settings: Record<string, boolean>;
}

const BIN_MAX = 30;
const STEPS_MAX = 50;
/** For the spec and the console: the apps built from the kit, and what each did last. */
export const kitState: Record<string, { items: number; bin: number; steps: number; state: string; notice: string; tour: number; q: string }> = {};

const store = (id: string) => `ghosty.app.${id}`;
function load(id: string): Kept | null {
  try {
    const v = JSON.parse(localStorage.getItem(store(id)) ?? 'null') as Kept | null;
    return v && Array.isArray(v.items) ? { items: v.items, bin: Array.isArray(v.bin) ? v.bin : [], seen: !!v.seen, settings: v.settings ?? {} } : null;
  } catch {
    return null;
  }
}
function save(id: string, k: Kept): void {
  try {
    localStorage.setItem(store(id), JSON.stringify(k));
  } catch {
    // (a private window or a full phone: the app goes on, it is only not kept)
  }
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One line of a list: its title, its line, a number or time at the right; tapped, it opens. 44 pt at least. */
export function listRow(item: KitItem, o: { onTap?: () => void; onDelete?: () => void } = {}): HTMLElement {
  const main = h('button.ak-rowmain', { type: 'button' }, h('b.ak-rowtitle', item.title), item.sub ? h('small.ak-rowsub', item.sub) : null);
  if (o.onTap) main.addEventListener('click', o.onTap);
  const row = h('div.ak-row', { role: 'listitem', dataset: { id: item.id } }, main, item.meta ? h('span.ak-rowmeta', item.meta) : null);
  if (o.onDelete) {
    const del = h('button.ak-rowdel', { type: 'button', 'aria-label': `Delete ${item.title}` }, icon(KIT_ICONS.x));
    del.addEventListener('click', o.onDelete);
    row.append(del);
  }
  return row;
}

/** A state in plain words, with what to do next: the empty, the error and its fix. */
export function stateCard(kind: 'empty' | 'error', words: string, fix?: { word: string; run: () => void }): HTMLElement {
  return h(`div.ak-state.ak-${kind}`, { role: kind === 'error' ? 'alert' : 'status' }, h('p', words), fix ? key(fix.word, () => fix.run(), { kind: 'fill' }) : null);
}

/** Skeleton rows while a thing loads: the page keeps its shape, so nothing jumps when it lands. */
export function skeleton(n = 4, words = 'Loading'): HTMLElement {
  return h('div.ak-skel', { role: 'status', 'aria-label': words }, ...Array.from({ length: n }, () => h('div.ak-skelrow', h('i'), h('i'))));
}

/** The app's Home card: its icon, its name and one line of what it holds, a tap opens it. */
export function homeCard(o: { name: string; glyph?: string; line: string; onTap: () => void }): HTMLElement {
  const b = h('button.ak-card', { type: 'button', 'aria-label': `${o.name}: ${o.line}` }, h('span.ak-cardhead', o.glyph ? icon(o.glyph) : null, h('b', o.name)), h('small', o.line));
  b.addEventListener('click', o.onTap);
  return b;
}

/** Build an app into `root`. */
export function app(root: HTMLElement, spec: KitSpec): KitApp {
  const kept: Kept = load(spec.id) ?? { items: [], bin: [], seen: false, settings: {} };
  for (const s of spec.settings ?? []) if (!(s.id in kept.settings)) kept.settings[s.id] = s.on;
  // the first run: never an empty screen; the sample shows it working, the tour says how in three steps
  const first = !kept.seen;
  if (first && !kept.items.length) kept.items = spec.sample.map((x) => ({ ...x }));
  const past: string[] = [];
  const ahead: string[] = [];
  let q = '';
  let mode: 'ready' | 'loading' | 'empty' | 'error' = 'ready';
  let tourAt = first ? 1 : 0;
  const st = (kitState[spec.id] = { items: 0, bin: 0, steps: 0, state: 'ready', notice: '', tour: tourAt, q: '' });

  const find = h('input.ak-find', { type: 'search', placeholder: `Search ${spec.noun[1]}`, 'aria-label': `Search ${spec.noun[1]}`, hidden: true }) as HTMLInputElement;
  const findKey = h('button.ak-hkey', { type: 'button', 'aria-label': 'Search' }, icon(KIT_ICONS.search));
  const setKey = h('button.ak-hkey', { type: 'button', 'aria-label': 'Settings' }, icon(KIT_ICONS.settings));
  const note = h('div.ak-notice', { role: 'status', 'aria-live': 'polite', hidden: true });
  const head = h('header.ak-head', h('span.ak-icon', spec.glyph ? icon(spec.glyph) : null), h('h2.ak-name', spec.name), h('span.ak-sp'), findKey, setKey);
  const tour = h('div.ak-tour', { role: 'note' });
  const body = h('div.ak-body', { role: 'list', 'aria-label': spec.noun[1] });
  const tools = h('nav.ak-tools', { 'aria-label': `${spec.name}'s keys` });
  const el = h(`section.ak-app`, { dataset: { app: spec.id } }, head, note, find, tour, body, tools);
  root.append(el);

  const persist = () => {
    save(spec.id, kept);
    Object.assign(st, { items: kept.items.length, bin: kept.bin.length, steps: past.length, state: mode, tour: tourAt, q });
  };
  const snap = () => JSON.stringify({ items: kept.items, bin: kept.bin });
  const change = (fn: () => void) => {
    past.push(snap());
    if (past.length > STEPS_MAX) past.shift();
    ahead.length = 0;
    fn();
    kept.seen = true;
    persist();
    k.render();
  };
  const back = (from: string[], to: string[]) => {
    const s = from.pop();
    if (!s) return false;
    to.push(snap());
    const v = JSON.parse(s) as Pick<Kept, 'items' | 'bin'>;
    kept.items = v.items;
    kept.bin = v.bin;
    persist();
    k.render();
    return true;
  };
  let noteTimer = 0;

  const k: KitApp = {
    el,
    body,
    items: () => kept.items.slice(),
    add: (item) => change(() => kept.items.unshift(item)),
    update: (id, patch) => change(() => (kept.items = kept.items.map((x) => (x.id === id ? { ...x, ...patch, id } : x)))),
    remove(id) {
      const it = kept.items.find((x) => x.id === id);
      if (!it) return;
      change(() => {
        kept.items = kept.items.filter((x) => x.id !== id);
        kept.bin = [{ ...it, gone: Date.now() }, ...kept.bin].slice(0, BIN_MAX);
      });
      k.notice(`Deleted “${it.title}”. It is in Recently deleted.`);
    },
    undo: () => back(past, ahead),
    redo: () => back(ahead, past),
    bin: () => kept.bin.map(({ gone: _g, ...x }) => x as KitItem),
    restore(id) {
      const it = kept.bin.find((x) => x.id === id);
      if (!it) return;
      const { gone: _g, ...back_ } = it;
      change(() => {
        kept.bin = kept.bin.filter((x) => x.id !== id);
        kept.items.unshift(back_ as KitItem);
      });
    },
    search(words) {
      q = words.trim().toLowerCase();
      find.hidden = !q && find.hidden;
      persist();
      k.render();
    },
    notice(words, o = {}) {
      clearTimeout(noteTimer);
      note.textContent = words;
      note.dataset.tone = o.tone ?? '';
      note.hidden = false;
      st.notice = words;
      noteTimer = window.setTimeout(() => (note.hidden = true), o.ms ?? 4000);
    },
    state(kind, words, fix) {
      mode = kind;
      persist();
      if (kind === 'ready') return k.render();
      body.replaceChildren(kind === 'loading' ? skeleton(4, words) : stateCard(kind, words ?? '', fix));
    },
    exportAs(kind) {
      const rows = kept.items;
      if (kind === 'json') return { name: `${spec.id}.json`, text: JSON.stringify(rows, null, 2) };
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return { name: `${spec.id}.csv`, text: [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') };
    },
    async share(kind) {
      const { name, text } = k.exportAs(kind);
      const file = new File([text], name, { type: kind === 'csv' ? 'text/csv' : 'application/json' });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      // (the phone's own Share sheet, where it has one: he picks where it goes; otherwise the file is saved on the phone)
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: spec.name });
          return 'shared';
        } catch {
          // (he closed the sheet: saved instead, so the tap still did something)
        }
      }
      const a = h('a', { href: URL.createObjectURL(file), download: name }) as HTMLAnchorElement;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      k.notice(`Saved ${name} on this phone.`, { tone: 'ok' });
      return 'saved';
    },
    openSettings() {
      const sheet = h('div.ak-sheet', { role: 'dialog', 'aria-label': `${spec.name} settings` });
      const close = () => sheet.remove();
      const rows = (spec.settings ?? []).map((s) => {
        const b = h('button.ak-switch', { type: 'button', role: 'switch', 'aria-checked': String(kept.settings[s.id]), dataset: { id: s.id } }, h('span', s.label), h('i'));
        b.addEventListener('click', () => {
          kept.settings[s.id] = !kept.settings[s.id];
          b.setAttribute('aria-checked', String(kept.settings[s.id]));
          persist();
          k.render();
        });
        return b;
      });
      const binRows = kept.bin.map((x) => listRow(x, { onTap: () => (k.restore(x.id), close(), k.notice(`Put back “${x.title}”.`, { tone: 'ok' })) }));
      sheet.append(
        h('h3.ak-sheethead', `${spec.name} settings`),
        ...rows,
        key('Export CSV', () => void k.share('csv')),
        key('Export JSON', () => void k.share('json')),
        h('h3.ak-sheethead', 'Recently deleted'),
        binRows.length ? h('div.ak-bin', ...binRows) : h('p.ak-binnone', 'Nothing deleted.'),
        key('Done', close, { kind: 'fill' }),
      );
      el.append(sheet);
    },
    setting: (id) => !!kept.settings[id],
    render() {
      if (mode !== 'ready') return;
      const shown = q ? kept.items.filter((x) => `${x.title} ${x.sub ?? ''} ${x.meta ?? ''}`.toLowerCase().includes(q)) : kept.items;
      const list = shown.map((x) => listRow(x, { onTap: spec.open ? () => spec.open!(x, k) : undefined, onDelete: () => k.remove(x.id) }));
      if (list.length) body.replaceChildren(...list);
      else if (q) body.replaceChildren(stateCard('empty', `No ${spec.noun[1]} match “${q}”.`, { word: 'Clear search', run: () => ((find.value = ''), k.search('')) }));
      else body.replaceChildren(stateCard('empty', `No ${spec.noun[1]} yet. Add your first ${spec.noun[0]} with the key below.`));
      tour.hidden = !tourAt;
      if (tourAt) {
        const next = key(tourAt < 3 ? 'Next' : 'Got it', () => {
          tourAt = tourAt < 3 ? tourAt + 1 : 0;
          if (!tourAt) kept.seen = true;
          persist();
          k.render();
        }, { kind: 'fill' });
        tour.replaceChildren(h('span.ak-tourn', `${tourAt} of 3`), h('p', spec.tour[tourAt - 1]!), next);
      }
      persist();
    },
  };

  findKey.addEventListener('click', () => {
    find.hidden = !find.hidden;
    if (!find.hidden) find.focus();
    else k.search((find.value = ''));
  });
  find.addEventListener('input', () => k.search(find.value));
  setKey.addEventListener('click', () => k.openSettings());
  note.addEventListener('click', () => (note.hidden = true));
  for (const a of spec.actions ?? []) tools.append(key(a.word, () => a.run(k), { glyph: a.glyph }));
  tools.append(key('Undo', () => k.undo() || k.notice('Nothing to undo.')), key('Redo', () => k.redo() || k.notice('Nothing to redo.')));
  k.render();
  return k;
}

/** A whole app built from the kit (a packing list), for the spec, the console and as the worked example in APP-KIT.md. */
export function kitDemo(root: HTMLElement = document.body): KitApp {
  document.querySelector('.ak-demo')?.remove();
  const host = h('div.ak-demo');
  root.append(host);
  let n = 0;
  return app(host, {
    id: 'kitdemo',
    name: 'Packing',
    glyph: KIT_ICONS.list,
    noun: ['item', 'items'],
    sample: [
      { id: 's1', title: 'Passport', sub: 'Documents', meta: '1' },
      { id: 's2', title: 'Phone charger', sub: 'Tech', meta: '1' },
      { id: 's3', title: 'Walking boots', sub: 'Clothes', meta: '1 pair' },
    ],
    tour: ['These are sample items, to show how it works.', 'Tap ✕ to delete one: Undo puts it back.', 'Settings has export and Recently deleted.'],
    settings: [{ id: 'done', label: 'Show packed items', on: true }],
    actions: [{ word: 'Add', glyph: KIT_ICONS.plus, run: (k) => k.add({ id: `n${Date.now()}${n++}`, title: `New item ${k.items().length + 1}`, sub: 'Other', meta: '1' }) }],
  });
}

const g = globalThis as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0): unknown => (g.__ghosty ? (g.__ghosty.appkit = { state: kitState, demo: kitDemo }) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
