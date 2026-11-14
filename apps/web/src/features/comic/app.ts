/**
 * THE COMIC (FINAL ROUND, lane COMIC; the owner: "things like Comic should be able to import actual real comics or like have
 * them separately and create actual full fledged comics which can actually entertain someone"). Three pages of one app:
 *  - SHELF: every comic on this phone, his own files (CBZ, PDF, pictures, a folder), the public-domain ones he fetched and the
 *    ones he made, each with its cover, READ (where he stopped), and REMOVE.
 *  - MAKE: an idea becomes a whole comic (cover, four pages, a cast with names and looks kept panel to panel); every panel,
 *    balloon, caption and sound effect can then be changed, panels and pages added or taken away, the grid changed; it is kept
 *    as he goes, read in the reader, and saved as a CBZ or a PDF, or shared.
 *  - LIBRARY: public-domain comics from the Internet Archive, fetched on his tap, on Wi-Fi, with the size said first.
 */
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, sizeWords, stateLine } from '../lifeui';
import { drawCover, drawPage, hitOf, photosReady, type Drawn } from './art';
import { cbzOf, importFiles, panelsOf, pdfOf, sniff } from './files';
import { getRarReader, isRarNeeded, RAR_BYTES } from './rar';
import { creditOf, fetchPd, fileOf, onMobileData, PD_QUERY, searchPd, type PdFile, type PdItem } from './library';
import { blankPanel, comicFrom, hashOf, KINDS, layoutCount, lookFor, MAX_PANELS, MOODS, newId, PAGE_H, PAGE_W, panelRects, POSES, SCENES, scriptOf, SHOTS, SPECIES, TIMES, writeComic, type Balloon, type Comic, type Panel, type Species } from './model';
import { openReader, type ReadSource } from './reader';
import { allMade, bookOf, books, dropBook, keepBook, keepMade, madeOf, pageOf, shelfInfo, updateBook, type Book } from './store';
import { comicState } from './state';
import { readScript, scriptAsk, withScript } from './script';
import { askBrain } from '../../docs/ask';
import { brain } from '../../api/brain';
import { settings } from '../../state/app';
import { loadTodos } from '../agenda/todo';
import { weekComic, weekIdea, weekItems } from './week';

const WRITERS = ['ghosty', 'phone'] as const;
type Writer = (typeof WRITERS)[number];
const savedWriter = (): Writer => {
  try {
    return localStorage.getItem('ghosty.comic.writer') === 'phone' ? 'phone' : 'ghosty';
  } catch {
    return 'ghosty';
  }
};
const keepWriter = (w: Writer) => {
  try {
    localStorage.setItem('ghosty.comic.writer', w);
  } catch {
    /* (kept for this visit only) */
  }
};
/** The kinds of story Ghosty can be asked for. */
export const STYLES = ['', 'mystery', 'space', 'heist', 'spooky', 'sports', 'romance', 'superhero'] as const;
export const STYLE_NAMES: Record<string, string> = { '': 'Any kind', mystery: 'A mystery', space: 'A space adventure', heist: 'A heist', spooky: 'Something spooky', sports: 'A sports final', romance: 'A romance', superhero: 'A superhero story' };

void PD_QUERY;
const sel = <T extends string>(label: string, options: readonly T[], value: T, on: (v: T) => void, names?: Record<string, string>): HTMLLabelElement => {
  const s = h('select', { 'aria-label': label }) as HTMLSelectElement;
  for (const o of options) s.append(h('option', { value: o }, names?.[o] ?? o));
  s.value = value;
  s.addEventListener('change', () => on(s.value as T));
  return h('label.cxfield', h('span.cxlab', label), s);
};
const text = (label: string, value: string, on: (v: string) => void, opts: { area?: boolean; max?: number; place?: string } = {}): HTMLLabelElement => {
  const el = (opts.area ? h('textarea', { rows: 2, maxLength: opts.max ?? 240, placeholder: opts.place ?? '', 'aria-label': label }) : h('input', { type: 'text', maxLength: opts.max ?? 120, placeholder: opts.place ?? '', 'aria-label': label })) as HTMLInputElement;
  el.value = value;
  el.addEventListener('input', () => on(el.value));
  return h('label.cxfield', h('span.cxlab', label), el);
};
const key = (label: string, fn: () => void, aria?: string, cls = ''): HTMLButtonElement => {
  const b = button(label, () => fn(), `g-key cxkey${cls ? ` ${cls}` : ''}`);
  if (aria) b.setAttribute('aria-label', aria);
  return b;
};

// ---------------------------------------------------------------- saving to his downloads, and sharing
function saveBlob(data: Blob | Uint8Array, name: string, mime: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  Object.assign(comicState.saved, { kind: name.split('.').pop() ?? '', name, bytes: blob.size });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => (a.remove(), URL.revokeObjectURL(url)), 4000);
}
const fileName = (t: string) => (t.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'comic');

// ---------------------------------------------------------------- a made comic's pages as pictures
const pagePic = async (c: Comic, n: number): Promise<Blob> => {
  await photosReady(c);
  const cv = document.createElement('canvas');
  if (n === 0) drawCover(cv, c);
  else drawPage(cv, c, c.pages[n - 1]!, n - 1);
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('canvas'))), 'image/png'));
};
export function madeSource(c: Comic): ReadSource {
  return {
    id: c.id,
    title: c.title,
    count: c.pages.length + 1,
    page: (n) => pagePic(c, n),
    panels: async (n, rtl) => {
      if (n === 0) return [[0, 0, 1, 1]];
      const rs = panelRects(c.pages[n - 1]!).map((r) => [r.x / PAGE_W, r.y / PAGE_H, r.w / PAGE_W, r.h / PAGE_H] as [number, number, number, number]);
      // (right to left: each row from the right)
      return rtl ? [...rs].sort((a, b) => (Math.abs(a[1] - b[1]) > 0.02 ? a[1] - b[1] : b[0] - a[0])) : rs;
    },
  };
}
function bookSource(b: Book): ReadSource {
  return {
    id: b.id,
    title: b.title,
    count: b.pages,
    page: async (n) => {
      const p = await pageOf(b.id, n);
      if (!p) throw new Error('this page is missing from the phone');
      return p;
    },
    panels: async (n, rtl) => {
      if (rtl) {
        const p = await pageOf(b.id, n);
        return p ? panelsOf(p, true) : [[0, 0, 1, 1]];
      }
      const kept = b.panels?.[n];
      if (kept) return kept;
      const p = await pageOf(b.id, n);
      const found = p ? await panelsOf(p) : [[0, 0, 1, 1] as [number, number, number, number]];
      b.panels = { ...(b.panels ?? {}), [n]: found };
      void updateBook(b).catch(() => undefined);
      return found;
    },
  };
}
export async function readBook(id: string): Promise<boolean> {
  const b = await bookOf(id);
  if (!b) return false;
  if (b.from === 'made') {
    const c = comicFrom(await madeOf(id));
    if (!c) return false;
    await openReader(madeSource(c));
  } else await openReader(bookSource(b));
  return true;
}

// ---------------------------------------------------------------- the app's hooks (what the chat and the other pages call)
type Hooks = { week?: () => void; askImport?: () => void; showShelf?: () => void; make?: (idea: string) => void; edit?: (id: string) => void; pick?: (section: string) => void; importNow?: () => void; library?: (q: string) => void };
export const hooks: Hooks = {};
/** What the chat asked before the screen was ready. */
export const pending: { make?: string; edit?: string; library?: string; import?: boolean; week?: boolean } = {};
/** A made comic opened in MAKE, whether MAKE is on screen yet or not (on a phone it is built when its pill is picked). */
function editMade(id: string): void {
  void import('../../shell/tabs').then(({ go }) => {
    if (hooks.edit) {
      go('comic?make');
      hooks.edit(id);
    } else {
      pending.edit = id;
      go('comic?make');
    }
  });
}

// ---------------------------------------------------------------- SHELF
export function shelfPart(): { el: HTMLElement; stop(): void } {
  const list = h('div.cxshelf', { 'aria-live': 'polite' });
  const note = h('p.cxnote', { 'aria-live': 'polite' });
  const pickFile = h('input', { type: 'file', accept: '.cbz,.cbr,.cb7,.cbt,.zip,.pdf,application/pdf,image/*', multiple: true, hidden: true }) as HTMLInputElement;
  const pickDir = h('input', { type: 'file', multiple: true, hidden: true }) as HTMLInputElement;
  pickDir.setAttribute('webkitdirectory', '');
  const take = async (files: File[], opts: { rar?: boolean } = {}): Promise<void> => {
    if (!files.length) return;
    comicState.import.state = 'loading';
    /* state: comic.shelf loading */
    clear(note, stateLine('loading', 'Reading your comic…'));
    try {
      const got = await importFiles(files, (w) => {
        comicState.import.words = w;
        clear(note, stateLine('loading', w));
      }, 'file', undefined, opts);
      await keepBook(got.book, got.pages);
      comicState.import.state = 'done';
      comicState.last = got.book.title;
      clear(note, h('span', { dataset: { state: 'done' } }, `“${got.book.title}” is on your shelf: ${got.book.pages} page${got.book.pages === 1 ? '' : 's'}, from ${got.book.kind}, kept on this phone.`));
      await paint();
    } catch (e) {
      comicState.import.state = 'error';
      comicState.error = sayError(e, 'read that comic');
      /* state: comic.shelf error */
      clear(note, stateLine('error', comicState.error));
      if (isRarNeeded(e)) {
        // a CBR: the free archive reader, fetched only on his tap, its size said, never on mobile data
        comicState.import.state = 'rar';
        const get = key(`Get the RAR reader · ${sizeWords(RAR_BYTES)}`, async () => {
          get.disabled = true;
          clear(note, stateLine('loading', `Getting the RAR reader (${sizeWords(RAR_BYTES)})…`));
          try {
            await getRarReader();
            await take(files, { rar: true });
          } catch (e2) {
            get.disabled = false;
            comicState.import.state = 'error';
            clear(note, stateLine('error', sayError(e2, 'get the RAR reader')), h('div.cxrow', get));
          }
        }, `Get the free RAR reader, ${sizeWords(RAR_BYTES)}, to open this CBR`);
        note.append(h('div.cxrow', get));
      }
    }
  };
  pickFile.addEventListener('change', () => void take([...(pickFile.files ?? [])]).finally(() => (pickFile.value = '')));
  pickDir.addEventListener('change', () => void take([...(pickDir.files ?? [])]).finally(() => (pickDir.value = '')));
  const paint = async () => {
    let all: Book[] = [];
    try {
      all = await books();
    } catch (e) {
      clear(list, stateLine('error', sayError(e, 'open your shelf')));
      return;
    }
    Object.assign(comicState, { books: all.length, made: all.filter((b) => b.from === 'made').length, imported: all.filter((b) => b.from !== 'made').length });
    comicState.shelf.titles = all.map((b) => b.title);
    comicState.shelf.state = all.length ? 'shown' : 'empty';
    if (!all.length) {
      /* state: comic.shelf empty */
      clear(list, emptyState('No comics yet', 'Import one of yours (a CBZ, a PDF, pictures or a folder of them), get a free public-domain one from the Library, or make your own.'));
      return;
    }
    clear(list, ...all.map((b) => {
      const cover = b.thumb ? h('img.cxthumb', { src: b.thumb, alt: '' }) : h('div.cxthumb.none', b.title.slice(0, 1));
      const read = key('Read', () => void readBook(b.id).then((ok) => ok || toast('That comic is no longer on this phone.', 'warn')), `Read ${b.title}`);
      const edit = b.from === 'made' ? key('Edit', () => editMade(b.id), `Edit ${b.title}`) : null;
      const drop = key('Remove', async () => {
        if (drop.dataset.sure !== '1') {
          drop.dataset.sure = '1';
          drop.textContent = 'Remove it?';
          setTimeout(() => {
            drop.dataset.sure = '';
            drop.textContent = 'Remove';
          }, 4000);
          return;
        }
        await dropBook(b.id).catch(() => undefined);
        await paint();
      }, `Remove ${b.title} from this phone`);
      const from = b.from === 'made' ? 'Made by you' : b.from === 'library' ? 'Public domain' : 'Your file';
      return h('article.cxbook', { dataset: { from: b.from, id: b.id } }, cover,
        h('div.cxbookwords', h('h3.cxbooktitle', b.title), h('p.cxbookline', `${from} · ${b.pages} page${b.pages === 1 ? '' : 's'}${b.bytes ? ` · ${sizeWords(b.bytes)}` : ''}`), b.credit ? h('p.cxcredit', b.credit) : null,
          h('div.cxrow', read, edit, drop)));
    }));
  };
  hooks.showShelf = () => void paint();
  hooks.importNow = () => pickFile.click();
  const lasting = h('p.cxnote', { hidden: true }, 'This browser keeps nothing after you leave (a private window), so your shelf lasts for this visit only.');
  hooks.askImport = () => clear(note, h('span', 'Pick your comic: a CBZ, a CBR, a PDF, pictures or a folder of them. A CBR needs the free RAR reader once; I’ll offer it, with its size.'));
  void paint().then(() => {
    lasting.hidden = shelfInfo.lasting;
    if (pending.import) {
      pending.import = false;
      hooks.askImport?.();
    }
  });
  const el = h('div.cx.cxcol',
    h('div.cxrow', key('Import a comic', () => pickFile.click(), 'Import a comic file: CBZ, PDF or pictures'), key('Import a folder', () => pickDir.click(), 'Import a folder of page pictures')),
    h('p.cxsmall', 'CBZ, CBR, PDF, pictures or a folder of them. A CBR needs the free RAR reader once (1.1 MB, on your tap, on Wi-Fi). Everything stays on this phone.'),
    note, pickFile, pickDir, lasting, list,
  );
  return { el, stop: () => ((hooks.showShelf = undefined), (hooks.askImport = undefined)) };
}

// ---------------------------------------------------------------- MAKE: the idea, then the editor
export function makePart(): { el: HTMLElement; stop(): void } {
  const root = h('div.cx.cxcol');
  let cur: Comic | null = null;
  let page = 0;
  let panel = -1;
  let balloon = '';
  let drawn: Drawn | null = null;
  let saveT = 0;
  let drawT = 0;
  const canvas = h('canvas.cxpage', { width: PAGE_W, height: PAGE_H, role: 'img', 'aria-label': 'The comic page' }) as HTMLCanvasElement;
  const editBox = h('div.cxedit');
  const status = h('p.cxnote', { 'aria-live': 'polite' });
  const where = h('p.cxwhere', { 'aria-live': 'polite' });

  const keep = () => {
    if (!cur) return;
    cur.edited = Date.now();
    clearTimeout(saveT);
    const c = cur;
    saveT = window.setTimeout(async () => {
      try {
        await keepMade(c.id, c);
        const cv = document.createElement('canvas');
        drawCover(cv, c);
        const t = document.createElement('canvas');
        t.width = 160;
        t.height = 240;
        t.getContext('2d')!.drawImage(cv, 0, 0, 160, 240);
        const old = await bookOf(c.id);
        await updateBook({ id: c.id, title: c.title, from: 'made', pages: c.pages.length + 1, bytes: 0, added: old?.added ?? c.made, kind: 'made here', thumb: t.toDataURL('image/jpeg', 0.7) });
        hooks.showShelf?.();
      } catch (e) {
        clear(status, stateLine('error', sayError(e, 'keep your comic')));
      }
    }, 400);
  };
  const redraw = () => {
    if (!cur) return;
    const c = cur;
    if (page === 0) {
      drawCover(canvas, c);
      drawn = { panels: [{ x: 0, y: 0, w: PAGE_W, h: PAGE_H }], balloons: [] };
    } else drawn = drawPage(canvas, c, c.pages[page - 1]!, page - 1, () => soon());
    // the chosen panel and balloon, ringed
    const ctx = canvas.getContext('2d')!;
    if (page > 0 && panel >= 0 && drawn.panels[panel]) {
      const r = drawn.panels[panel]!;
      ctx.strokeStyle = '#1e90ff';
      ctx.lineWidth = 10;
      ctx.setLineDash([24, 14]);
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      ctx.setLineDash([]);
      const bl = drawn.balloons.find((q) => q.id === balloon);
      if (bl) {
        ctx.strokeStyle = '#ff2d55';
        ctx.lineWidth = 6;
        ctx.strokeRect(bl.box.x - 6, bl.box.y - 6, bl.box.w + 12, bl.box.h + 12);
      }
    }
    const pg = page > 0 ? c.pages[page - 1]! : null;
    canvas.setAttribute('aria-label', page === 0 ? `The cover: ${c.title}. ${c.tagline}` : `Page ${page} of ${c.pages.length}: ${pg!.panels.map((p, i) => `panel ${i + 1}, ${[p.caption, ...p.balloons.map((b) => `${c.cast.find((m) => m.id === b.who)?.name ?? ''}: ${b.text}`), p.sfx].filter(Boolean).join('; ')}`).join('. ')}`);
    where.textContent = page === 0 ? `The cover · ${c.pages.length} pages after it` : `Page ${page} of ${c.pages.length} · ${pg!.panels.length} panels${panel >= 0 ? ` · panel ${panel + 1} chosen` : ' · tap a panel to change it'}`;
    comicState.editing.boxes = drawn.balloons.filter((q) => q.panel === panel).map((q) => ({ id: q.id, ...q.box }));
    comicState.editing.photo = !!(page > 0 && panel >= 0 && c.pages[page - 1]?.panels[panel]?.photo);
    Object.assign(comicState.editing, { id: c.id, title: c.title, pages: c.pages.length, page, panel, balloon, drawn: comicState.editing.drawn + 1, panels: pg?.panels.length ?? 0, balloons: pg ? pg.panels.reduce((n, p) => n + p.balloons.length, 0) : 0, cast: c.cast.map((m) => m.name) });
  };
  const soon = () => {
    clearTimeout(drawT);
    drawT = window.setTimeout(() => {
      drawT = 0;
      redraw();
      keep();
    }, 140);
  };
  // ---- undo and redo: the comic as it was before each change (a burst of typing in one box is one step)
  const undo: string[] = [];
  const redo: string[] = [];
  let was = '';
  let wasAt = 0;
  let wasIn: Element | null = null;
  const remember = (burst: boolean) => {
    if (!cur) return;
    const now = JSON.stringify(cur);
    if (now === was) return;
    // (one box typed in without a pause is one step; another box, or a pause, is a new one)
    const inBox = burst ? document.activeElement : null;
    const same = burst && inBox === wasIn && Date.now() - wasAt < 1500 && undo.length;
    wasIn = inBox;
    if (!same) {
      undo.push(was);
      if (undo.length > 80) undo.shift();
    }
    redo.length = 0;
    was = now;
    wasAt = Date.now();
    comicState.editing.undo = undo.length;
    comicState.editing.redo = 0;
  };
  const back = (from: string[], to: string[]) => {
    const prev = from.pop();
    if (!cur || prev === undefined) return;
    to.push(JSON.stringify(cur));
    const c = comicFrom(JSON.parse(prev));
    if (!c) return;
    cur = c;
    was = prev;
    wasAt = 0;
    page = Math.min(page, c.pages.length);
    panel = Math.min(panel, (c.pages[page - 1]?.panels.length ?? 0) - 1);
    balloon = '';
    comicState.editing.undo = undo.length;
    comicState.editing.redo = redo.length;
    redraw();
    keep();
    paintEditor();
  };
  const changed = (full = false) => {
    remember(!full);
    if (full) {
      redraw();
      keep();
      paintEditor();
    } else soon();
  };
  // a tap picks a panel (and the balloon under the finger); once a panel is picked, a finger drags its balloons, its people and
  // its sound effect (the page scrolls as usual until then)
  const at = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAGE_W, y: ((e.clientY - r.top) / r.height) * PAGE_H };
  };
  let drag: { kind: 'balloon' | 'actor' | 'sfx'; id: string; x0: number; y0: number; base: [number, number]; moved: boolean } | null = null;
  let dragged = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragged = false;
    if (!cur || !drawn || page === 0 || panel < 0) return;
    const p0 = at(e);
    const hit = hitOf(drawn, p0.x, p0.y);
    if (hit.panel !== panel) return;
    const pn = cur.pages[page - 1]!.panels[panel]!;
    const box = drawn.panels[panel]!;
    if (hit.balloon) {
      const b = pn.balloons.find((q) => q.id === hit.balloon)!;
      drag = { kind: 'balloon', id: b.id, x0: p0.x, y0: p0.y, base: [b.dx ?? 0, b.dy ?? 0], moved: false };
    } else if (hit.sfx) {
      const s0 = drawn.sfxs?.find((q) => q.panel === panel)?.box;
      drag = { kind: 'sfx', id: '', x0: p0.x, y0: p0.y, base: pn.sfxAt ?? (s0 ? [(s0.x + s0.w / 2 - box.x) / box.w, (s0.y + s0.h / 2 - box.y) / box.h] : [0.5, 0.5]), moved: false };
    } else if (hit.actor) {
      const a = pn.actors.find((q) => q.who === hit.actor)!;
      drag = { kind: 'actor', id: a.who, x0: p0.x, y0: p0.y, base: [a.x, 0], moved: false };
    } else return;
    canvas.setPointerCapture(e.pointerId);
  });
  let frame = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || !cur) return;
    const p1 = at(e);
    const dx = p1.x - drag.x0;
    const dy = p1.y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    e.preventDefault();
    const pn = cur.pages[page - 1]!.panels[panel]!;
    const box = drawn!.panels[panel]!;
    if (drag.kind === 'balloon') {
      const b = pn.balloons.find((q) => q.id === drag!.id);
      if (b) {
        b.dx = Math.round(drag.base[0] + dx);
        b.dy = Math.round(drag.base[1] + dy);
        balloon = b.id;
      }
    } else if (drag.kind === 'sfx') pn.sfxAt = [Math.max(0.05, Math.min(0.95, drag.base[0] + dx / box.w)), Math.max(0.05, Math.min(0.95, drag.base[1] + dy / box.h))];
    else {
      const a = pn.actors.find((q) => q.who === drag!.id);
      if (a) a.x = Math.max(0.08, Math.min(0.92, drag.base[0] + dx / box.w));
    }
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), redraw()));
  });
  const drop = () => {
    if (drag?.moved) {
      dragged = true;
      comicState.editing.dragged++;
      changed(true);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('click', (e) => {
    if (!cur || !drawn || dragged) return;
    const p0 = at(e);
    const hit = hitOf(drawn, p0.x, p0.y);
    if (page === 0) return;
    panel = hit.panel;
    balloon = hit.balloon;
    canvas.classList.toggle('cxdrag', panel >= 0);
    redraw();
    paintEditor();
    editBox.querySelector<HTMLElement>(balloon ? `[data-balloon="${balloon}"] textarea` : '.cxpanel input')?.focus({ preventScroll: true });
  });
  // his photo behind a panel: picked on the phone, made small (a JPEG up to 1,000 pixels), kept inside the comic
  const pickPhoto = (p: Panel) => {
    const input = h('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const bm = await createImageBitmap(f);
        const k = Math.min(1, 1000 / Math.max(bm.width, bm.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(bm.width * k));
        cv.height = Math.max(1, Math.round(bm.height * k));
        cv.getContext('2d')!.drawImage(bm, 0, 0, cv.width, cv.height);
        bm.close();
        p.photo = cv.toDataURL('image/jpeg', 0.82);
        changed(true);
        clear(status, h('span', { dataset: { state: 'done' } }, 'Your photo is behind this panel, kept inside the comic on this phone.'));
      } catch (e) {
        clear(status, stateLine('error', sayError(e, 'use that photo')));
      }
    });
    input.click();
  };

  // ---- the editor's parts
  const panelEditor = (c: Comic, p: Panel): HTMLElement => {
    const nameOf = Object.fromEntries(c.cast.map((m) => [m.id, m.name]));
    const balloonRow = (b: Balloon, i: number) => h('div', { dataset: { balloon: b.id }, class: b.id === balloon ? 'cxballoon on' : 'cxballoon' },
      h('div.cxrow',
        sel(`Who says line ${i + 1}`, c.cast.map((m) => m.id), b.who as string, (v) => ((b.who = v), changed()), nameOf),
        sel(`Balloon ${i + 1}`, KINDS, b.kind, (v) => ((b.kind = v), changed()), { speech: 'Speech', thought: 'Thought', shout: 'Shout', whisper: 'Whisper' }),
      ),
      text(`Line ${i + 1}`, b.text, (v) => ((b.text = v), changed()), { area: true, max: 200 }),
      h('div.cxrow',
        key('Up', () => (i > 0 && (p.balloons.splice(i, 1), p.balloons.splice(i - 1, 0, b)), changed(true)), `Move line ${i + 1} earlier`),
        key('Remove line', () => (p.balloons.splice(i, 1), (balloon = ''), changed(true)), `Remove line ${i + 1}`),
      ));
    const inPanel = (id: string) => p.actors.find((a) => a.who === id);
    const castRows = c.cast.map((m) => {
      const a = inPanel(m.id);
      const box = h('input', { type: 'checkbox', 'aria-label': `${m.name} is in this panel` }) as HTMLInputElement;
      box.checked = !!a;
      box.addEventListener('change', () => {
        if (box.checked && !inPanel(m.id)) p.actors.push({ who: m.id, mood: 'calm', pose: 'stand', x: p.actors.length ? Math.min(0.85, 0.2 + p.actors.length * 0.3) : 0.5, face: p.actors.length ? -1 : 1 });
        else if (!box.checked) p.actors.splice(p.actors.findIndex((x) => x.who === m.id), 1);
        changed(true);
      });
      const where2 = a ? h('input', { type: 'range', min: '5', max: '95', value: String(Math.round(a.x * 100)), 'aria-label': `Where ${m.name} stands` }) as HTMLInputElement : null;
      where2?.addEventListener('input', () => a && ((a.x = Number(where2.value) / 100), changed()));
      return h('div.cxactor', h('label.cxcheck', box, h('span', m.name)), a ? h('div.cxrow',
        sel(`${m.name}’s face`, MOODS, a.mood, (v) => ((a.mood = v), changed())),
        sel(`${m.name}’s pose`, POSES, a.pose, (v) => ((a.pose = v), changed())),
        key('Turn', () => ((a.face = a.face === 1 ? -1 : 1), changed()), `Turn ${m.name} around`),
      ) : null, where2 ? h('label.cxfield', h('span.cxlab', 'Where they stand'), where2) : null);
    });
    return h('div.cxpanel', { dataset: { panel: String(panel) } },
      h('h3.cxhead', `Panel ${panel + 1}`),
      p.beat ? h('p.cxsmall', `What it is for: ${p.beat}`) : null,
      text('Caption', p.caption, (v) => ((p.caption = v), changed()), { max: 140, place: 'Meanwhile…' }),
      text('Sound effect', p.sfx, (v) => ((p.sfx = v), changed()), { max: 24, place: 'KA-BOOM!' }),
      h('div.cxrow',
        key(p.photo ? 'Change my photo' : 'My photo behind it', () => pickPhoto(p), 'Put one of my own photos behind this panel'),
        p.photo ? key('Remove photo', () => ((p.photo = undefined), changed(true)), 'Take the photo away from behind this panel') : null,
        p.sfxAt || p.balloons.some((b) => b.dx || b.dy) ? key('Put things back', () => {
          p.sfxAt = undefined;
          for (const b of p.balloons) b.dx = b.dy = undefined;
          changed(true);
        }, 'Put the balloons and the sound effect back where they were laid out') : null),
      h('div.cxrow', sel('Place', SCENES, p.scene, (v) => ((p.scene = v), changed())), sel('Time', TIMES, p.time, (v) => ((p.time = v), changed())), sel('Shot', SHOTS, p.shot, (v) => ((p.shot = v), changed()))),
      h('h4.cxsub', 'Who is in it'), ...castRows,
      h('h4.cxsub', 'What they say'), ...p.balloons.map(balloonRow),
      h('div.cxrow',
        key('Add a line', () => {
          const b: Balloon = { id: newId('b'), who: p.actors[0]?.who ?? c.cast[0]!.id, kind: 'speech', text: 'Something to say.' };
          p.balloons.push(b);
          balloon = b.id;
          changed(true);
        }, 'Add a speech balloon to this panel'),
        key('Remove panel', () => {
          const pg = c.pages[page - 1]!;
          if (pg.panels.length <= 1) return toast('A page needs one panel. Remove the page instead.', 'warn');
          pg.panels.splice(panel, 1);
          panel = -1;
          changed(true);
        }, 'Remove this panel'),
      ));
  };
  const castEditor = (c: Comic): HTMLElement => h('details.cxcast', h('summary', `The cast (${c.cast.map((m) => m.name).join(', ')})`),
    ...c.cast.map((m) => h('div.cxactor',
      text(`${m.role === 'hero' ? 'Hero' : m.role === 'friend' ? 'Friend' : m.role === 'rival' ? 'Rival' : 'Character'}’s name`, m.name, (v) => ((m.name = v.slice(0, 24) || m.name), changed())),
      h('div.cxrow',
        sel(`What ${m.name} is`, SPECIES, m.look.species, (v) => ((m.look = { ...lookFor(v as Species, hashOf(m.id + v + c.seed)), height: m.look.height }), changed(true))),
        key('New look', () => ((m.look = { ...lookFor(m.look.species, (Math.random() * 1e9) >>> 0) }), changed(true)), `Give ${m.name} a new look`),
      ))),
    key('Add a character', () => {
      const id = newId('m');
      c.cast.push({ id, name: 'New friend', role: 'extra', look: lookFor('person', hashOf(id)) });
      changed(true);
    }, 'Add a character to the cast'));
  const paintEditor = () => {
    const c = cur;
    if (!c) return;
    const undoKey = key('Undo', () => back(undo, redo), 'Undo the last change');
    undoKey.disabled = !undo.length;
    const redoKey = key('Redo', () => back(redo, undo), 'Redo what was undone');
    redoKey.disabled = !redo.length;
    const pageKeys = h('div.cxrow',
      undoKey, redoKey,
      key('‹ Page', () => ((page = Math.max(0, page - 1)), (panel = -1), changed(true)), 'Previous page'),
      key('Page ›', () => ((page = Math.min(c.pages.length, page + 1)), (panel = -1), changed(true)), 'Next page'),
      page > 0 ? key('Grid', () => {
        const pg = c.pages[page - 1]!;
        pg.layout = (pg.layout + 1) % layoutCount(pg.panels.length);
        changed(true);
      }, 'Change this page’s panel grid') : null,
      page > 0 ? key('Add panel', () => {
        const pg = c.pages[page - 1]!;
        if (pg.panels.length >= MAX_PANELS) return toast(`A page holds up to ${MAX_PANELS} panels. Add a page instead.`, 'warn');
        pg.panels.push(blankPanel(c, pg.panels[pg.panels.length - 1]));
        pg.layout = 0;
        panel = pg.panels.length - 1;
        changed(true);
      }, 'Add a panel to this page') : null,
      key('Add page', () => {
        c.pages.splice(page, 0, { id: newId('g'), layout: 0, panels: [blankPanel(c, c.pages[Math.max(0, page - 1)]?.panels[0]), blankPanel(c)] });
        page += 1;
        panel = 0;
        changed(true);
      }, 'Add a page after this one'),
      page > 0 && c.pages.length > 1 ? key('Remove page', () => {
        c.pages.splice(page - 1, 1);
        page = Math.min(page, c.pages.length);
        panel = -1;
        changed(true);
      }, 'Remove this page') : null,
    );
    const cover = page === 0 ? h('div.cxpanel', h('h3.cxhead', 'The cover'),
      text('Title', c.title, (v) => ((c.title = v.slice(0, 60) || c.title), changed()), { max: 60 }),
      text('Tagline', c.tagline, (v) => ((c.tagline = v), changed()), { max: 120 })) : null;
    const pn = page > 0 && panel >= 0 ? c.pages[page - 1]!.panels[panel] : null;
    const out = h('div.cxrow',
      key('Read it', () => void openReader(madeSource(c), page), 'Read your comic full screen'),
      key('Save CBZ', () => void exportAs('cbz'), 'Save the comic as a CBZ file'),
      key('Save PDF', () => void exportAs('pdf'), 'Save the comic as a PDF'),
      key('Share', () => void exportAs('share'), 'Share the comic as a PDF'),
      key('New comic', () => ((cur = null), paintIdea()), 'Start a new comic from an idea'),
    );
    const script = h('details.cxscript', h('summary', 'The script'), h('pre.cxpre', scriptOf(c)));
    clear(editBox, pageKeys, cover, pn ? panelEditor(c, pn) : page > 0 ? h('p.cxsmall', 'Tap a panel on the page to change its words, its place, who is in it and how they look.') : null, castEditor(c), out, status, script);
  };
  const exportAs = async (how: 'cbz' | 'pdf' | 'share') => {
    if (!cur) return;
    const c = cur;
    /* state: comic.maker loading */
    clear(status, stateLine('loading', `Drawing ${c.pages.length + 1} pages…`));
    try {
      const pics: Blob[] = [];
      for (let i = 0; i <= c.pages.length; i++) pics.push(await pagePic(c, i));
      const name = fileName(c.title);
      if (how === 'cbz') {
        const z = await cbzOf(c.title, pics, { summary: c.premise });
        saveBlob(z, `${name}.cbz`, 'application/vnd.comicbook+zip');
        clear(status, h('span', { dataset: { state: 'done' } }, `Saved ${name}.cbz, ${sizeWords(z.byteLength)}, to your downloads. Any comic reader opens it.`));
        return;
      }
      const pdf = await pdfOf(c.title, pics);
      const file = new File([pdf as BlobPart], `${name}.pdf`, { type: 'application/pdf' });
      if (how === 'share' && navigator.canShare?.({ files: [file] })) {
        let how2 = 'shared' as 'shared' | 'cancelled' | 'saved';
        await navigator.share({ files: [file], title: c.title, text: c.tagline }).catch((e: Error) => {
          if (e?.name === 'AbortError') how2 = 'cancelled';
          else if (e?.name === 'NotAllowedError') how2 = 'saved';
          else throw e;
        });
        if (how2 === 'cancelled') return void clear(status, h('span', { dataset: { state: 'done' } }, 'Nothing was shared.'));
        if (how2 === 'saved') {
          saveBlob(pdf, file.name, 'application/pdf');
          return void clear(status, h('span', { dataset: { state: 'done' } }, `The phone wouldn’t open its share sheet this time, so ${file.name} (${sizeWords(file.size)}) is in your downloads to send from there.`));
        }
        comicState.saved = { kind: 'share', name: file.name, bytes: file.size };
        clear(status, h('span', { dataset: { state: 'done' } }, `Shared ${file.name}, ${sizeWords(file.size)}. Only the people you picked get it.`));
        return;
      }
      saveBlob(pdf, `${name}.pdf`, 'application/pdf');
      clear(status, h('span', { dataset: { state: 'done' } }, how === 'share' ? `This browser can’t share files, so ${name}.pdf (${sizeWords(pdf.byteLength)}) is in your downloads to send from there.` : `Saved ${name}.pdf, ${sizeWords(pdf.byteLength)}, to your downloads.`));
    } catch (e) {
      /* state: comic.maker error */
      clear(status, stateLine('error', sayError(e, 'save your comic')));
    }
  };

  // ---- the idea
  const idea = { words: '', hero: '', friend: '', rival: '', style: '', writer: savedWriter() };
  const paintIdea = () => {
    /* state: comic.maker empty */
    const make = key('Make my comic', () => void start(), 'Make a whole comic from this idea');
    const ideaBox = text('What is it about?', idea.words, (v) => (idea.words = v), { area: true, max: 300, place: 'a cat who wants to be an astronaut' });
    const tries = ['a cat who wants to be an astronaut', 'a robot who can’t dance', 'my dog Rex tries to catch the postman', 'a ghost who is scared of the dark'].map((t) => key(t, () => {
      idea.words = t;
      void start();
    }, `Make a comic about ${t}`, 'cxtry'));
    clear(root,
      h('p.cxsmall', 'Say an idea and I write it and draw it: a cover, four pages, a hero, a friend and a rival who look the same in every panel, a beginning, a turn and an end. Then change anything.'),
      ideaBox,
      h('details.cxnames', h('summary', 'Names (or leave them to me)'),
        text('Hero', idea.hero, (v) => (idea.hero = v), { max: 24 }), text('Friend', idea.friend, (v) => (idea.friend = v), { max: 24 }), text('Rival', idea.rival, (v) => (idea.rival = v), { max: 24 })),
      h('div.cxrow',
        sel('Who writes it', WRITERS, idea.writer, (v) => {
          idea.writer = v;
          keepWriter(v);
        }, { ghosty: 'Ghosty writes it (my brain)', phone: 'Written here on the phone' }),
        sel('Kind of story', STYLES, idea.style as (typeof STYLES)[number], (v) => (idea.style = v), STYLE_NAMES)),
      h('div.cxrow', make),
      h('div.cxrow', key('My week as a comic', () => void myWeek(), 'Make a comic of my week from my agenda')),
      h('p.cxsmall', 'Or try one:'), h('div.cxtries', ...tries),
      h('p.cxsmall', 'Ghosty writes the story for your exact idea; the drawing is done on this phone, so every character stays the same panel to panel. With no signal, the phone writes it.'),
      status,
    );
    comicState.editing.id = '';
  };
  const show = (c: Comic, at = 1) => {
    cur = c;
    undo.length = 0;
    redo.length = 0;
    was = JSON.stringify(c);
    comicState.editing.undo = 0;
    comicState.editing.redo = 0;
    page = at;
    panel = -1;
    balloon = '';
    clear(root, h('div.cxstage', canvas), where, editBox);
    redraw();
    paintEditor();
  };
  let writing = 0;
  const start = async (words = idea.words, fallback?: Comic) => {
    const w = words.trim() || 'a cat who wants to be an astronaut';
    const local = fallback ?? writeComic({ idea: w, hero: idea.hero.trim(), friend: idea.friend.trim(), rival: idea.rival.trim() });
    let c = local;
    let by: 'brain' | 'phone' = 'phone';
    let why = '';
    if (idea.writer === 'ghosty' && !lacksSignal()) {
      const ticket = ++writing;
      comicState.editing.writing = true;
      /* state: comic.maker loading */
      clear(root, stateLine('loading', `Ghosty is writing your comic about ${w.slice(0, 80)}…`), h('div.cxrow', key('Write it here instead', () => {
        writing++;
        comicState.editing.writing = false;
        finish(local, 'phone', '');
      }, 'Stop waiting and write it here on the phone')));
      try {
        const r = await askBrain(scriptAsk(w, local.cast, STYLE_NAMES[idea.style] && idea.style ? STYLE_NAMES[idea.style] : ''), () => undefined, 'comic');
        if (ticket !== writing) return;
        const s = readScript(r.text, local.cast);
        if (s) {
          c = withScript(local, s);
          by = 'brain';
        } else why = 'Ghosty’s script didn’t come back in a shape I can draw, so I wrote this one here on the phone.';
      } catch (e) {
        if (ticket !== writing) return;
        why = `${sayError(e, 'reach my brain')} So I wrote this one here on the phone.`;
      }
      comicState.editing.writing = false;
    } else if (idea.writer === 'ghosty') why = 'No signal, so I wrote this one here on the phone.';
    finish(c, by, why);
  };
  const finish = (c: Comic, by: 'brain' | 'phone', why: string) => {
    comicState.last = c.title;
    comicState.editing.by = by;
    show(c, 0);
    keep();
    /* state: comic.maker offline */
    clear(status, h('span', { dataset: { state: 'done' } }, `${why ? `${why} ` : ''}“${c.title}” is made: the cover and ${c.pages.length} pages${by === 'brain' ? ', written by Ghosty for your idea and drawn here' : ''}, kept on this phone. Tap a panel to change it, or read it full screen.`));
    paintEditor();
  };
  hooks.make = (w) => void start(w);
  // his week from his own agenda and ticked to-dos (titles and days only, never a place)
  const myWeek = async () => {
    /* state: comic.maker loading */
    clear(status, stateLine('loading', 'Reading your week from your agenda…'));
    let events: { title: string; start: number }[] = [];
    try {
      events = (await brain.agenda(7)).events;
    } catch {
      /* (no agenda in reach: the ticked to-dos still count) */
    }
    const items = weekItems(events, loadTodos());
    comicState.editing.week = items.length;
    if (!items.length) {
      /* state: comic.maker empty */
      clear(status, emptyState('Nothing in your week yet', 'Add something in PLAN → AGENDA, or tick off a to-do, and your week becomes a comic.'));
      return;
    }
    const name = settings.get().name || 'Me';
    await start(weekIdea(items, name), weekComic(items, name));
  };
  hooks.week = () => void myWeek();
  hooks.edit = (id) => void madeOf(id).then((x) => {
    const c = comicFrom(x);
    if (c) show(c, 1);
    else toast('That comic is no longer on this phone.', 'warn');
  });
  if (pending.week) {
    pending.week = false;
    paintIdea();
    void myWeek();
  } else if (pending.make) {
    const w = pending.make;
    pending.make = undefined;
    void start(w);
  } else if (pending.edit) {
    const id = pending.edit;
    pending.edit = undefined;
    hooks.edit(id);
  } else paintIdea();
  return {
    el: root,
    stop: () => {
      if (drawT) keep();
      clearTimeout(drawT);
      hooks.make = undefined;
      hooks.edit = undefined;
    },
  };
}

// ---------------------------------------------------------------- LIBRARY
export function libraryPart(): { el: HTMLElement; stop(): void } {
  const list = h('div.cxlib', { 'aria-live': 'polite' });
  const q = h('input', { type: 'search', placeholder: 'Search: western, space, horror, a title…', 'aria-label': 'Search public-domain comics', maxLength: 80 }) as HTMLInputElement;
  let ctl: AbortController | null = null;
  const run = async (words: string) => {
    ctl?.abort();
    ctl = new AbortController();
    comicState.library.query = words;
    if (lacksSignal()) {
      comicState.library.state = 'offline';
      /* state: comic.library offline */
      clear(list, stateLine('offline', 'No signal. The library needs the internet; your shelf works without it.'));
      return;
    }
    comicState.library.state = 'loading';
    /* state: comic.library loading */
    clear(list, stateLine('loading', 'Looking in the Internet Archive’s public-domain comics…'));
    try {
      const items = await searchPd(words, ctl.signal);
      comicState.library.items = items.length;
      comicState.library.state = items.length ? 'shown' : 'empty';
      if (!items.length) {
        /* state: comic.library empty */
        clear(list, emptyState('Nothing found', `No public-domain comic matches “${words}”. Try a simpler word: western, war, romance, space, horror.`));
        return;
      }
      clear(list, ...items.map(row));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      comicState.library.state = 'error';
      /* state: comic.library error */
      clear(list, stateLine('error', sayError(e, 'reach the library')));
    }
  };
  const row = (it: PdItem): HTMLElement => {
    const line = h('p.cxbookline', { 'aria-live': 'polite' }, [it.year, it.creator].filter(Boolean).join(' · ') || 'Public domain');
    let file: PdFile | null = null;
    let kept = '';
    let busy = false;
    const get: HTMLButtonElement = key('See size', async () => {
      if (kept) return void readBook(kept);
      if (busy) return;
      busy = true;
      try {
        if (!file) {
          get.disabled = true;
          get.textContent = 'Checking…';
          file = await fileOf(it.id);
          get.disabled = false;
          get.textContent = `Get · ${sizeWords(file.bytes)}`;
          get.setAttribute('aria-label', `Get ${it.title}: a ${file.kind}, ${sizeWords(file.bytes)}`);
          line.textContent = `A ${file.kind}, ${sizeWords(file.bytes)}. Tap GET to fetch it on Wi-Fi.`;
          return;
        }
        if (onMobileData()) {
          line.textContent = `You are on mobile data, and this is ${sizeWords(file.bytes)}: it waits for Wi-Fi. Join Wi-Fi and tap GET again.`;
          return;
        }
        get.disabled = true;
        const fetchOne = (pf: PdFile) => fetchPd(it.id, pf, (n) => (line.textContent = `Fetching… ${sizeWords(n)} of ${sizeWords(pf.bytes)}`));
        const f = await fetchOne(file);
        if (file.alt && sniff(new Uint8Array(await f.slice(0, 8).arrayBuffer())) === 'rar') {
          // (its CBZ is RAR inside, which no browser opens: its PDF is offered instead, its size said, fetched only on his next tap)
          file = file.alt;
          get.disabled = false;
          get.textContent = `Get PDF · ${sizeWords(file.bytes)}`;
          get.setAttribute('aria-label', `Get ${it.title} as a PDF, ${sizeWords(file.bytes)}`);
          line.textContent = `Its CBZ turned out to be a RAR file inside, which a browser can’t open. Its PDF is ${sizeWords(file.bytes)}: tap GET PDF for that instead.`;
          return;
        }
        line.textContent = 'Putting it on your shelf…';
        const got = await importFiles([f], (w) => (line.textContent = w), 'library', creditOf(it));
        got.book.title = it.title.slice(0, 120);
        await keepBook(got.book, got.pages);
        comicState.library.got = it.title;
        get.textContent = 'Read';
        get.disabled = false;
        line.textContent = `On your shelf: ${got.book.pages} pages. ${creditOf(it)}`;
        hooks.showShelf?.();
        kept = got.book.id;
        get.setAttribute('aria-label', `Read ${it.title}`);
      } catch (e) {
        get.disabled = false;
        get.textContent = file ? `Get · ${sizeWords(file.bytes)}` : 'See size';
        line.textContent = sayError(e, 'fetch that comic');
      } finally {
        busy = false;
      }
    }, `See the size of ${it.title} before getting it`);
    const thumb = h('img.cxthumb', { src: `https://archive.org/services/img/${encodeURIComponent(it.id)}`, alt: '', loading: 'lazy' });
    return h('article.cxbook', { dataset: { id: it.id } }, thumb, h('div.cxbookwords', h('h3.cxbooktitle', it.title), line, h('div.cxrow', get)));
  };
  let t = 0;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(() => void run(q.value.trim()), 450);
  });
  hooks.library = (w) => {
    q.value = w;
    void run(w);
  };
  const first = pending.library ?? '';
  pending.library = undefined;
  q.value = first;
  void run(first);
  const el = h('div.cx.cxcol',
    h('p.cxsmall', 'Comics old enough that their copyright has ended, free to read and keep, from the Internet Archive. Nothing is fetched until you tap, never on mobile data, and the size is said first.'),
    h('label.cxfield', h('span.cxlab', 'Search'), q),
    list,
  );
  return { el, stop: () => (ctl?.abort(), clearTimeout(t), (hooks.library = undefined)) };
}

/** What the screen holds, said by its counts. */
export const comicWords = (): string => `${comicState.books ? `${comicState.books} comic${comicState.books === 1 ? '' : 's'} on the shelf (${comicState.made} made, ${comicState.imported} imported)` : 'no comics on the shelf yet'}${comicState.editing.id ? `; editing “${comicState.editing.title}”, page ${comicState.editing.page}` : ''}`;
export async function countShelf(): Promise<void> {
  try {
    const all = await books();
    Object.assign(comicState, { books: all.length, made: all.filter((b) => b.from === 'made').length, imported: all.filter((b) => b.from !== 'made').length });
  } catch {
    /* the shelf says its own trouble when it is open */
  }
}
void allMade;
