/**
 * FILES (THE APPS ROUND, lane BOOT): one place for everything Ghosty keeps, on this phone, in the manner of the phone's own Files app.
 *  - BROWSE: everything, newest first (or by name or size); search by name, by tag and by the words inside; the kind chips and his folders;
 *    a star on every row; IMPORT brings files in from the phone's Files (a zip opens to its files); SELECT picks several for ZIP or SHARE.
 *  - Tapping a thing opens its card: a preview (the picture, the words, the first rows, the slides' titles, a zip's list), OPEN IN its app,
 *    SHARE through the phone's Share sheet (in the leaders' formats: .docx, .xlsx, .pptx), RENAME, DUPLICATE, MOVE to a folder, TAGS, DELETE.
 *  - RECENTS and FAVOURITES; RECENTLY DELETED (30 days, RESTORE puts it back exactly, DELETE NOW); STORAGE (the space each kind takes, and the
 *    biggest things first, to clear).
 * Every delete goes to Recently deleted with an UNDO bar. Nothing leaves the phone unless he shares it himself.
 */
import { h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, modal, toast, undoBar } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { addFolder, binned, dropFolder, filesStore, keepOwn, noteOf, notes, outOfBin, setNote, toBin, type Binned } from './store';
import { asFile, binOf, duplicate, gather, putBack, removeFromApp, rename, type Item } from './sources';
import { EMPTY, KIND_PLURAL, KINDS, binLeft, cleanFolder, cleanTag, matchOf, sizeWords, whenWords, type Kind } from './words';

import { filesState } from './state';
export { filesState };

let cache: Item[] = [];
const listeners = new Set<() => void>();
const changed = () => {
  for (const f of listeners) f();
};
/** Everything, read again from every app's store. */
export async function refresh(): Promise<Item[]> {
  cache = await gather();
  filesState.count = cache.length;
  filesState.bytes = cache.reduce((n, it) => n + it.size, 0);
  filesState.binned = (await binned()).length;
  filesState.loaded = true;
  return cache;
}
/** The hub card's count (shell/hubcards.ts). */
export const countFiles = (): Promise<unknown> => refresh();

const undo = undoBar();
const glyph = (k: Kind) => ({ Document: 'DOC', Spreadsheet: 'XLS', Presentation: 'PPT', Photo: 'IMG', Video: 'VID', Game: 'GAME', Comic: 'CBZ', File: 'FILE' })[k];

/** Open a thing in the app it belongs to (the document itself where the app opens one by itself). */
export async function openItem(it: Item): Promise<void> {
  setNote(it.key, { opened: Date.now() });
  filesState.last = it.key;
  try {
    if (it.src === 'docs') {
      const [{ listDocs }, { openDocs }] = await Promise.all([import('../../docs/store'), import('../../docs/sheet')]);
      const doc = listDocs().find((d) => d.id === it.id);
      return void (await openDocs(doc ? { doc } : {}));
    }
    if (it.src === 'sheets') {
      const [{ listBooks }, { openSheets }] = await Promise.all([import('../../sheets/store'), import('../../sheets/sheet')]);
      const book = listBooks().find((b) => b.id === it.id);
      return void (await openSheets(book ? { book } : {}));
    }
    if (it.src === 'slides') {
      const [{ listDecks }, { openSlides }] = await Promise.all([import('../../slides/store'), import('../../slides/sheet')]);
      const deck = listDecks().find((d) => d.id === it.id);
      return void (await openSlides(deck ? { deck } : {}));
    }
    if (it.src === 'own') return void (await showCard(it));
    go(it.tab);
  } catch (e) {
    toast(sayError(e, `open ${it.name}`), 'bad');
  }
}

/** Share one thing, or several as one zip, through the phone's Share sheet (else saved to the phone's downloads). */
async function share(items: Item[]): Promise<void> {
  const run = await import('../../convert/run');
  const files = (await Promise.all(items.map((it) => asFile(it).catch(() => null)))).filter((f): f is { name: string; blob: Blob } => !!f);
  if (!files.length) return toast('That can’t be shared from here: open it in its app to export it.', 'warn');
  let out = files[0]!;
  if (files.length > 1) {
    const { zipStore } = await import('../../convert/zip');
    const seen = new Set<string>();
    const parts = await Promise.all(files.map(async (f) => {
      let n = f.name;
      for (let i = 2; seen.has(n); i++) n = f.name.replace(/(\.[a-z0-9]+)?$/i, ` ${i}$1`);
      seen.add(n);
      return { name: n, data: new Uint8Array(await f.blob.arrayBuffer()) };
    }));
    const z = zipStore(parts);
    out = { name: `Ghosty files ${new Date().toISOString().slice(0, 10)}.zip`, blob: new Blob([new Uint8Array(z).buffer as ArrayBuffer], { type: 'application/zip' }) };
  }
  if (!(await run.shareBlob(out.blob, out.name).catch(() => false))) {
    run.saveBlob(out.blob, out.name);
    toast(`Saved ${out.name} (${sizeWords(out.blob.size)}) to your downloads.`, 'ok');
  }
}

/** Delete: into Recently deleted, whole, with UNDO. */
async function deleteItems(items: Item[]): Promise<void> {
  const kept: Binned[] = [];
  for (const it of items) {
    if (!it.can.del) continue;
    const b = binOf(it);
    if (!b) continue;
    await toBin(b);
    await removeFromApp(b);
    kept.push(b);
  }
  if (!kept.length) return;
  await refresh();
  changed();
  undo.show(kept.length === 1 ? `${kept[0]!.name} is in Recently deleted.` : `${kept.length} things are in Recently deleted.`, async () => {
    for (const b of kept) {
      await putBack(b);
      await outOfBin(b.key);
    }
    await refresh();
    changed();
  });
}

/** IMPORT: files from the phone (a zip opens to its files), kept untouched here. */
async function importFiles(list: FileList | File[]): Promise<number> {
  let n = 0;
  for (const f of [...list]) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      try {
        const { unzipSync } = await import('../../convert/zip');
        const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
        for (const [name, data] of entries) {
          if (name.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store)/.test(name)) continue;
          const base = name.split('/').pop() || name;
          await keepOwn({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name: base, type: '', size: data.length, at: Date.now(), blob: new Blob([new Uint8Array(data).buffer as ArrayBuffer]) });
          n++;
        }
        continue;
      } catch (e) {
        toast(sayError(e, `open ${f.name}`), 'bad');
        continue;
      }
    }
    await keepOwn({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name: f.name, type: f.type, size: f.size, at: Date.now(), blob: f });
    n++;
  }
  await refresh();
  changed();
  return n;
}

// ---------------------------------------------------------------- the card: a preview and every action
async function preview(it: Item): Promise<HTMLElement> {
  const box = h('div.fpreview', { dataset: { case: 'keep' } });
  const pic = it.thumb ? await it.thumb().catch(() => null) : null;
  if (pic) box.append(h('img.fpic', { src: pic, alt: it.name }));
  if (it.src === 'own' && it.own && /\.zip$/i.test(it.name)) {
    try {
      const { unzipSync } = await import('../../convert/zip');
      const entries = [...unzipSync(new Uint8Array(await it.own.blob.arrayBuffer()))].filter(([n]) => !n.endsWith('/'));
      box.append(h('p.note', `${entries.length} ${entries.length === 1 ? 'file' : 'files'} inside:`), h('ul.flist', ...entries.slice(0, 30).map(([n, d]) => h('li', `${n} · ${sizeWords(d.length)}`))));
      box.append(button('EXTRACT ALL', async () => {
        const n = await importFiles([new File([it.own!.blob], it.name, { type: 'application/zip' })]);
        toast(`${n} ${n === 1 ? 'file' : 'files'} taken out of ${it.name}.`, 'ok');
      }));
    } catch (e) {
      box.append(h('p.note', sayError(e, 'open the zip')));
    }
  } else if (it.text) box.append(h('p.ftext', it.text.slice(0, 1200) + (it.text.length > 1200 ? '…' : '')));
  else if (!pic) box.append(h('p.note', it.can.del ? 'No preview for this kind of file. SHARE sends it to an app that opens it.' : `Open it in ${it.app} to see it.`));
  return box;
}

export async function showCard(it: Item): Promise<void> {
  const body = h('div.fcard');
  const meta = h('p.fmeta', { dataset: { case: 'keep' } }, `${it.kind} · ${it.app} · ${sizeWords(it.size)} · ${whenWords(it.at)}`);
  const note = noteOf(it.key);
  const tagLine = h('p.ftags', { dataset: { case: 'keep' } }, note.tags?.length ? note.tags.map((t) => `#${t}`).join('  ') : 'No tags');
  const folderLine = h('p.note', note.folder ? `In ${note.folder}` : 'Not in a folder');
  let close = () => undefined as void;
  const done = async () => {
    await refresh();
    changed();
    close();
  };
  const keys = h('div.keyrow.fkeys');
  keys.append(button(it.src === 'own' ? 'SHARE' : `OPEN IN ${it.app.toUpperCase()}`, () => (it.src === 'own' ? void share([it]) : (close(), void openItem(it)))));
  if (it.src !== 'own') keys.append(button('SHARE', () => void share([it])));
  if (it.can.rename) keys.append(button('RENAME', async () => {
    const n = prompt('A new name', it.name);
    if (n && n.trim() && (await rename(it, n))) await done();
  }));
  if (it.can.duplicate) keys.append(button('DUPLICATE', async () => {
    if (await duplicate(it)) {
      toast(`A copy of ${it.name} is beside it.`, 'ok');
      await done();
    }
  }));
  keys.append(button('MOVE', async () => {
    const f = prompt(`Move to which folder? (${notes().folders.join(', ') || 'none yet'}; empty takes it out of its folder)`, note.folder ?? '');
    if (f === null) return;
    setNote(it.key, { folder: cleanFolder(f) || undefined });
    await done();
  }));
  keys.append(button('TAGS', async () => {
    const t = prompt('Tags, separated by commas', (note.tags ?? []).join(', '));
    if (t === null) return;
    setNote(it.key, { tags: [...new Set(t.split(',').map(cleanTag).filter(Boolean))].slice(0, 8) });
    await done();
  }));
  if (it.can.del) keys.append(button('DELETE', async () => {
    close();
    await deleteItems([it]);
  }, 'warn'));
  body.append(meta, folderLine, tagLine, await preview(it), keys);
  const m = modal(it.name.toUpperCase().slice(0, 60), body);
  close = () => m.close();
}

// ---------------------------------------------------------------- the rows
function row(it: Item, o: { snippet?: string; select?: Set<string>; onPick?: () => void } = {}): HTMLElement {
  const note = noteOf(it.key);
  const star = h('button.fstar', { type: 'button', 'aria-pressed': String(!!note.fav), 'aria-label': note.fav ? `Unstar ${it.name}` : `Star ${it.name}` }, note.fav ? '★' : '☆');
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    setNote(it.key, { fav: !noteOf(it.key).fav });
    changed();
  });
  const pick = o.select ? h('input.fpick', { type: 'checkbox', 'aria-label': `Select ${it.name}`, checked: o.select.has(it.key) }) as HTMLInputElement : null;
  pick?.addEventListener('click', (e) => e.stopPropagation());
  pick?.addEventListener('change', () => {
    if (pick.checked) o.select!.add(it.key);
    else o.select!.delete(it.key);
    o.onPick?.();
  });
  const el = h('div.frow', { role: 'button', tabIndex: 0, dataset: { key: it.key, kind: it.kind } },
    ...(pick ? [pick] : []),
    h('span.fglyph', { 'aria-hidden': 'true' }, glyph(it.kind)),
    h('span.fbody', h('span.fname', it.name), h('span.fsub', `${it.app} · ${sizeWords(it.size)} · ${whenWords(it.at)}${note.folder ? ` · ${note.folder}` : ''}`), ...(o.snippet ? [h('span.fsnip', o.snippet)] : []), ...(note.tags?.length ? [h('span.fsub', note.tags.map((t) => `#${t}`).join(' '))] : [])),
    star);
  el.addEventListener('click', () => (o.select ? pick?.click() : void showCard(it)));
  el.addEventListener('keydown', (e) => e.key === 'Enter' && el.click());
  return el;
}

/** A part's list painter, repainted when anything changes; stopped when the part goes. */
function live(paint: () => Promise<void> | void): () => void {
  const f = () => void paint();
  listeners.add(f);
  return () => listeners.delete(f);
}

// ---------------------------------------------------------------- BROWSE
export function browsePart(): { el: HTMLElement; stop(): void } {
  const q = h('input.fsearch', { type: 'search', placeholder: 'Search everything', 'aria-label': 'Search Files: names, tags and the words inside', enterKeyHint: 'search' }) as HTMLInputElement;
  const kinds = h('div.keyrow.fchips', { role: 'group', 'aria-label': 'Kinds' });
  const folders = h('div.keyrow.fchips', { role: 'group', 'aria-label': 'Folders' });
  const sortSel = h('select.fsort', { 'aria-label': 'Sort' }, h('option', { value: 'new' }, 'Newest'), h('option', { value: 'name' }, 'Name'), h('option', { value: 'size' }, 'Size')) as HTMLSelectElement;
  const picker = h('input', { type: 'file', multiple: true, hidden: true, 'aria-hidden': 'true' }) as HTMLInputElement;
  const status = h('p.note.fstatus', { role: 'status', dataset: { case: 'keep', id: 'filesstatus' } });
  const list = h('div.flistbox', { 'aria-live': 'polite' });
  const selectBar = h('div.keyrow.fselbar', { hidden: true });
  let kind: Kind | '' = '';
  let folder = '';
  let select: Set<string> | null = null;
  picker.addEventListener('change', async () => {
    if (!picker.files?.length) return;
    status.textContent = 'Bringing them in…';
    const n = await importFiles(picker.files);
    picker.value = '';
    toast(`${n} ${n === 1 ? 'file' : 'files'} in Files.`, 'ok');
  });
  const importKey = button('IMPORT', () => picker.click());
  const selKey = button('SELECT', () => {
    select = select ? null : new Set();
    selKey.textContent = select ? 'CANCEL' : 'SELECT';
    void paint();
  });
  const zipKey = button('ZIP', () => select?.size && void share(cache.filter((it) => select!.has(it.key))));
  const delKey = button('DELETE', async () => {
    if (!select?.size) return;
    const picked = cache.filter((it) => select!.has(it.key));
    select = new Set();
    await deleteItems(picked);
  }, 'warn');
  selectBar.append(zipKey, delKey);
  const paint = async () => {
    if (!filesState.loaded) {
      status.textContent = 'Gathering everything Ghosty keeps…';
      await refresh();
    }
    const n = notes();
    // the chips: every kind he has, every folder
    const have = new Set(cache.map((it) => it.kind));
    kinds.replaceChildren(...[['', 'All'] as [Kind | '', string], ...KINDS.filter((k) => have.has(k)).map((k) => [k, KIND_PLURAL[k]] as [Kind, string])].map(([k, label]) => {
      const b = button(label, () => ((kind = k), void paint()));
      b.setAttribute('aria-pressed', String(kind === k));
      b.classList.toggle('on', kind === k);
      return b;
    }));
    folders.replaceChildren(...['', ...n.folders].map((f) => {
      const b = button(f || 'All folders', () => ((folder = f), void paint()));
      b.setAttribute('aria-pressed', String(folder === f));
      b.classList.toggle('on', folder === f);
      return b;
    }), button('NEW FOLDER', () => {
      const f = cleanFolder(prompt('The new folder’s name') ?? '');
      if (!f) return;
      addFolder(f);
      folder = f;
      void paint();
    }), ...(folder ? [button('REMOVE FOLDER', () => {
      dropFolder(folder);
      folder = '';
      void paint();
    })] : []));
    const s = q.value;
    let shown = cache.map((it) => ({ it, m: matchOf(s, { name: it.name, tags: noteOf(it.key).tags ?? [], text: it.text }) })).filter((x) => x.m.hit && (!kind || x.it.kind === kind) && (!folder || noteOf(x.it.key).folder === folder));
    const by = sortSel.value;
    shown = shown.sort((a, b) => (by === 'name' ? a.it.name.localeCompare(b.it.name) : by === 'size' ? b.it.size - a.it.size : b.it.at - a.it.at));
    selectBar.hidden = !select;
    zipKey.textContent = select?.size ? `ZIP ${select.size}` : 'ZIP';
    /* state: files.browse empty */
    status.textContent = !cache.length ? EMPTY.all : !shown.length ? (s ? EMPTY.search(s) : folder ? EMPTY.folder(folder) : EMPTY.all) : `${shown.length} ${shown.length === 1 ? 'thing' : 'things'} · ${sizeWords(shown.reduce((t, x) => t + x.it.size, 0))}${filesStore.lasting ? '' : ' · this window keeps nothing after you close it'}`;
    list.replaceChildren(...shown.slice(0, 300).map((x) => row(x.it, { snippet: x.m.snippet, ...(select ? { select, onPick: () => (zipKey.textContent = select?.size ? `ZIP ${select.size}` : 'ZIP') } : {}) })));
  };
  q.addEventListener('input', () => void paint());
  sortSel.addEventListener('change', () => void paint());
  const stop = live(paint);
  void refresh().then(paint);
  return { el: h('div.files', h('div.keyrow.ftop', q), h('div.keyrow.ftools', importKey, selKey, sortSel), kinds, folders, selectBar, status, list, picker, undo.el), stop };
}

// ---------------------------------------------------------------- RECENTS and FAVOURITES
function shortList(which: 'recents' | 'favourites'): { el: HTMLElement; stop(): void } {
  const status = h('p.note', { role: 'status', dataset: { case: 'keep' } });
  const list = h('div.flistbox');
  const paint = async () => {
    if (!filesState.loaded) await refresh();
    const pick = which === 'favourites' ? cache.filter((it) => noteOf(it.key).fav) : [...cache].sort((a, b) => Math.max(noteOf(b.key).opened ?? 0, b.at) - Math.max(noteOf(a.key).opened ?? 0, a.at)).slice(0, 20);
    /* state: files.short empty */
    status.textContent = pick.length ? '' : EMPTY[which];
    status.hidden = !!pick.length;
    list.replaceChildren(...pick.map((it) => row(it)));
  };
  const stop = live(paint);
  void paint();
  return { el: h('div.files', status, list, undo.el), stop };
}
export const recentsPart = () => shortList('recents');
export const favouritesPart = () => shortList('favourites');

// ---------------------------------------------------------------- RECENTLY DELETED
export function binPart(): { el: HTMLElement; stop(): void } {
  const status = h('p.note', { role: 'status', dataset: { case: 'keep', id: 'filesbin' } });
  const list = h('div.flistbox');
  const empty = button('EMPTY RECENTLY DELETED', async () => {
    if (!confirm('Delete everything in Recently deleted for good? This can’t be undone.')) return;
    for (const b of await binned()) await outOfBin(b.key);
    await refresh();
    changed();
  }, 'warn');
  const paint = async () => {
    const l = await binned();
    filesState.binned = l.length;
    /* state: files.bin empty */
    status.textContent = l.length ? `${l.length} ${l.length === 1 ? 'thing' : 'things'} · ${sizeWords(l.reduce((t, b) => t + b.size, 0))} · each kept 30 days` : EMPTY.bin;
    empty.hidden = !l.length;
    list.replaceChildren(...l.map((b) => h('div.frow', { dataset: { key: b.key } },
      h('span.fglyph', { 'aria-hidden': 'true' }, glyph(b.kind as Kind)),
      h('span.fbody', h('span.fname', b.name), h('span.fsub', `${b.kind} · ${sizeWords(b.size)} · deleted ${whenWords(b.deletedAt)} · ${binLeft(b.deletedAt)}`)),
      h('span.keyrow.fbinkeys', button('RESTORE', async () => {
        if (await putBack(b)) {
          await outOfBin(b.key);
          if (b.note) setNote(b.key, b.note);
          toast(`${b.name} is back.`, 'ok');
          await refresh();
          changed();
        } else toast(`${b.name} could not go back: its app’s store is full. Make room there and try again.`, 'warn');
      }), button('DELETE NOW', async () => {
        if (!confirm(`Delete ${b.name} for good?`)) return;
        await outOfBin(b.key);
        await refresh();
        changed();
      }, 'warn')))));
  };
  const stop = live(paint);
  void paint();
  return { el: h('div.files', status, list, h('div.keyrow', empty)), stop };
}

// ---------------------------------------------------------------- STORAGE
export function storagePart(): { el: HTMLElement; stop(): void } {
  const total = h('p.fbig', { dataset: { case: 'keep', id: 'filestotal' } });
  const bars = h('div.fbars');
  const big = h('div.flistbox');
  const quota = h('p.note', { dataset: { case: 'keep' } });
  const paint = async () => {
    if (!filesState.loaded) await refresh();
    total.textContent = `${sizeWords(filesState.bytes)} in ${filesState.count} ${filesState.count === 1 ? 'thing' : 'things'}`;
    const per = KINDS.map((k) => ({ k, n: cache.filter((it) => it.kind === k).reduce((t, it) => t + it.size, 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const most = Math.max(1, ...per.map((x) => x.n));
    bars.replaceChildren(...per.map((x) => h('div.fbar', h('span.fbarname', KIND_PLURAL[x.k]), h('span.fbartrack', { role: 'img', 'aria-label': `${KIND_PLURAL[x.k]}: ${sizeWords(x.n)}` }, h('i', { style: `width:${Math.max(2, Math.round((x.n / most) * 100))}%` })), h('span.fbarsize', sizeWords(x.n)))));
    /* state: files.storage empty */
    const biggest = [...cache].sort((a, b) => b.size - a.size).slice(0, 10);
    big.replaceChildren(h('div.lab', 'THE BIGGEST, TO CLEAR'), ...(biggest.length ? biggest.map((it) => row(it)) : [h('p.note', EMPTY.all)]));
    try {
      const e = await navigator.storage?.estimate?.();
      quota.textContent = e?.quota ? `This phone lets Ghosty keep up to ${sizeWords(e.quota)}; ${sizeWords(e.usage ?? 0)} is used in all, with the brain’s copies and caches.` : '';
    } catch {
      quota.textContent = '';
    }
  };
  const stop = live(paint);
  void paint();
  return { el: h('div.files', total, bars, quota, big, undo.el), stop };
}

/** For the checks and the console: Files' own handles (window.__ghosty.files). */
export const filesApi = { state: filesState, refresh, importFiles: (f: File[]) => importFiles(f), all: () => cache };
