/**
 * THE CLASSICS SHOP (learn.u6), on the Library's ADD section: free public-domain books for his shelf.
 *   - MOST READ: Project Gutenberg's most read books (through Gutendex, keyless and free), or a search by title or author.
 *   - NEW FROM STANDARD EBOOKS: the 15 newest from their open feed; each with its free Gutenberg edition when there is one,
 *     and a link to read it on Standard Ebooks' own site. Their paid catalogue is never used.
 * Nothing is fetched until he taps a book: then its size is looked up and said on the key (ADD TO MY SHELF · 1.2 MB), and the
 * book comes only on his tap, on Wi-Fi; on mobile data, or where the phone cannot tell, a second tap within 20 s is his yes.
 * The brain fetches it (apps/edge/src/library/classics.ts) a part at a time, and the shelf shows it when the last part is in.
 * State for specs at window.__ghosty.classics.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, panel, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { onMobileData } from '../../wiki/store';
import { netUnknown, secondTap } from '../learn/wifi';

export interface Classic { id: number; title: string; authors: string[]; downloads: number; subjects: string[] }
export interface Fresh { title: string; author: string; link: string; line: string; gutenberg?: number }

export const classicsState = { view: 'top' as 'top' | 'new' | 'search', shown: 0, open: 0, size: 0, adding: 0, part: 0, added: [] as number[], line: '', error: '' };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/library/classics${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' }).catch(() => {
    throw new Error('I can’t reach my brain right now (no connection?), so the free classics can’t be listed.');
  });
  const j = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok) throw new Error(j?.error ?? 'The free classics did not answer just now. Try again in a moment.');
  return j as T;
}

/** "1.2 MB", "640 KB". */
export const sizeWords = (bytes: number): string => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

/** The panel. `onAdded`: the shelf is read again once a book is in. */
export function classicsPanel(onAdded: () => void): HTMLElement {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.classics = classicsState;
  const pn = panel('CLASSICS', { grow: false, cls: 'classics' });
  const say = h('p.note.clsay', { role: 'status' });
  const list = h('div.cllist', { role: 'list', 'aria-label': 'Free classics' });
  const box = h('input', { type: 'search', placeholder: 'Search by title or author', 'aria-label': 'Search the free classics', enterKeyHint: 'search' }) as HTMLInputElement;
  const topKey = button('MOST READ', () => void load('top'), 'on');
  const newKey = button('NEW FROM STANDARD EBOOKS', () => void load('new'));
  // (the name as written, not re-cased by the stylesheet's sentence case)
  newKey.dataset.label = 'New from Standard Ebooks';
  const tell = (t: string) => ((say.textContent = t), (classicsState.line = t));

  /** One book's row: tap to see its size, then ADD TO MY SHELF with the size on the key. */
  const bookRow = (id: number, title: string, by: string, extra: string, link?: string) => {
    const row = h('div.clrow', { role: 'listitem', dataset: { id: String(id || '') } });
    const head = h('button.clhead', { type: 'button', 'aria-expanded': 'false', dataset: { case: 'keep' } }, h('b', title), h('small', [by, extra].filter(Boolean).join(' · ')));
    const more = h('div.clmore', { hidden: true });
    head.addEventListener('click', () => {
      more.hidden = !more.hidden;
      head.setAttribute('aria-expanded', String(!more.hidden));
      if (!more.hidden) void openBook(id, title, more, link);
    });
    row.append(head, more);
    return row;
  };

  async function openBook(id: number, title: string, more: HTMLElement, link?: string) {
    classicsState.open = id;
    const read = link ? h('a.lnk', { href: link, target: '_blank', rel: 'noopener' }, 'READ IT ON STANDARD EBOOKS ↗') : null;
    if (!id) return void clear(more, h('p.note', 'No free Gutenberg edition was found for this one, so it can’t go on your shelf from here. You can read it free on Standard Ebooks.'), read);
    if (classicsState.added.includes(id)) return void clear(more, h('p.note', 'It’s on your shelf.'), read);
    clear(more, h('p.note', 'Looking up its size…'));
    let bytes = 0;
    try {
      bytes = (await call<{ bytes: number }>('GET', `/size?id=${id}`)).bytes;
    } catch (e) {
      return void clear(more, h('p.note', sayError(e, 'look up its size')), read);
    }
    classicsState.size = bytes;
    const size = bytes ? sizeWords(bytes) : 'size not given by the site';
    const add = button(`ADD TO MY SHELF · ${size}`, () => void addBook(id, title, size, add, more), 'on');
    add.setAttribute('aria-label', `Add ${title} to my shelf: ${size}, on Wi-Fi`);
    clear(more, h('p.note', `Free and public domain, from Project Gutenberg. It comes on Wi-Fi, ${size}, and stays in your library.`), h('div.keyrow', add, read));
  }

  async function addBook(id: number, title: string, size: string, key: HTMLButtonElement, more: HTMLElement) {
    if (classicsState.adding) return;
    // downloads only on his tap, on Wi-Fi, with the size said: on mobile data, or where the phone cannot tell, a second tap
    if ((onMobileData() || netUnknown()) && !secondTap(`classic:${id}`)) {
      key.textContent = `TAP AGAIN TO FETCH · ${size}`;
      return void tell(onMobileData() ? `You’re on mobile data: tap again within 20 seconds to fetch “${title}” now (${size}), or wait until you’re on Wi-Fi.` : `I can’t tell Wi-Fi from mobile data on this phone: tap again within 20 seconds to fetch “${title}” now (${size}).`);
    }
    classicsState.adding = id;
    key.disabled = true;
    let offset = 0;
    try {
      for (let i = 0; i < 60; i++) {
        classicsState.part = offset + 1;
        key.textContent = offset ? `ADDING · PART ${offset + 1}…` : 'ADDING…';
        const r = await call<{ next: number | null; note: string }>('POST', '/add', { id, offset });
        if (r.next === null || r.next === undefined) break;
        offset = r.next;
      }
      classicsState.added = [...classicsState.added, id];
      clear(more, h('p.note', 'It’s on your shelf.'));
      toast(`“${title}” is on your shelf`, 'ok');
      onAdded();
    } catch (e) {
      key.disabled = false;
      key.textContent = `TRY AGAIN · ${size}`;
      tell(sayError(e, `add “${title}”`));
    } finally {
      classicsState.adding = 0;
    }
  }

  async function load(view: 'top' | 'new' | 'search') {
    classicsState.view = view;
    classicsState.error = '';
    topKey.className = view === 'top' ? 'on' : '';
    newKey.className = view === 'new' ? 'on' : '';
    pn.setStatus('…', 'mid');
    tell(view === 'new' ? 'Reading Standard Ebooks’ new releases…' : view === 'search' ? `Searching the free classics for “${box.value.trim()}”…` : 'Reading the most read free classics…');
    clear(list);
    try {
      if (view === 'new') {
        const { books } = await call<{ books: Fresh[] }>('GET', '/new');
        list.append(...books.map((b) => bookRow(b.gutenberg ?? 0, b.title, b.author, b.gutenberg ? 'free on Gutenberg too' : 'on Standard Ebooks', b.link)));
        classicsState.shown = books.length;
        tell(books.length ? 'The newest free books from Standard Ebooks. Tap one to see its size.' : 'Standard Ebooks has no new releases listed just now.');
      } else {
        const words = view === 'search' ? box.value.trim() : '';
        const { books } = await call<{ books: Classic[] }>('GET', words ? `?q=${encodeURIComponent(words)}` : '');
        list.append(...books.map((b) => bookRow(b.id, b.title, b.authors.join(', '), b.downloads ? `${b.downloads.toLocaleString('en-GB')} reads this month` : '')));
        classicsState.shown = books.length;
        tell(books.length ? 'Free and public domain. Tap a book to see its size before anything comes.' : `No free classic matches “${words}”. Try the author’s surname, or fewer words.`);
      }
      pn.setStatus(classicsState.shown ? String(classicsState.shown) : 'NONE', classicsState.shown ? 'ok' : 'off');
      list.dataset.state = classicsState.shown ? '' : 'empty';
    } catch (e) {
      classicsState.error = sayError(e, 'list the free classics');
      tell(classicsState.error);
      list.dataset.state = navigator.onLine === false ? 'offline' : 'error';
      pn.setStatus(navigator.onLine === false ? 'OFFLINE' : 'ERROR', 'off');
    }
  }

  box.addEventListener('keydown', (e) => e.key === 'Enter' && box.value.trim() && void load('search'));
  // a book from the Lens: its search runs at once (and again whenever another comes while the panel is on screen)
  liveSearch = (words: string) => {
    start.remove();
    box.value = words;
    void load('search');
  };
  const find = button('SEARCH', () => (box.value.trim() ? void load('search') : tell('Type a title or an author first.')));
  // nothing is fetched until he opens it: the list is asked for the first time the panel comes into view
  const start = h('div.keyrow', button('SHOW THE FREE CLASSICS', () => (start.remove(), void load('top')), 'on'));
  pn.body.append(h('p.note', 'Thousands of free public-domain books (Project Gutenberg, and Standard Ebooks’ new releases). Nothing comes until you tap, and then only on Wi-Fi, with its size said.'), start, h('div.keyrow.clsearch', box, find), h('div.keyrow', topKey, newKey), say, list);
  pn.setStatus('FREE', 'ok');
  if (pendingSearch) {
    const w = pendingSearch;
    pendingSearch = '';
    queueMicrotask(() => liveSearch?.(w));
  }
  return pn.el;
}

// ---------------------------------------------------------------------------------------------------------------------
// [learn.c1, with lens.s11] A BOOK FROM THE LENS: a book's barcode, looked up in the Lens, goes on his reading list in the
// Library (its details only, as a note to read: nothing is downloaded), and the free classics are searched for a free copy
// by its title, which he can add with its size said, on Wi-Fi, as any other.
// ---------------------------------------------------------------------------------------------------------------------

/** The search the panel runs when it next opens (a book from the Lens), or ''. */
let pendingSearch = '';
/** The open panel's search, while it is on screen. */
let liveSearch: ((words: string) => void) | null = null;

/** Search the free classics for these words: now when the panel is open, else when it next opens. */
export function findClassic(words: string): void {
  const w = words.trim().slice(0, 100);
  if (!w) return;
  if (liveSearch) liveSearch(w);
  else pendingSearch = w;
}

/** The Lens's book card: on his reading list, and the free classics searched for it. Returns the line to show. */
export async function bookFromLens(b: { title: string; authors?: string[]; code?: string; url?: string; description?: string }): Promise<string> {
  const title = b.title.trim().slice(0, 160);
  if (!title) return 'That book has no title to file it under.';
  const text = [title, b.authors?.length ? `By ${b.authors.join(', ')}` : '', b.code ? `ISBN ${b.code}` : '', b.description ?? '', b.url ? `More: ${b.url}` : '', 'On my reading list, from the Lens.'].filter(Boolean).join('\n');
  const r = await fetch('/api/library/text', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ title: `To read: ${title}`, text, kind: 'note', source: b.url ?? '' }), credentials: 'same-origin' }).catch(() => null);
  const ok = !!r?.ok;
  findClassic(`${title} ${b.authors?.[0]?.split(' ').at(-1) ?? ''}`);
  void import('../../shell/areas').then((a) => a.navTo('library', 'push')).then(() => import('../../ui/sections')).then((s) => s.revealSection('library', 'CLASSICS')).catch(() => undefined);
  return ok ? `“${title}” is on your reading list in the Library. I’m looking for a free copy among the classics.` : `I couldn’t put “${title}” on your reading list just now, so I’m only looking for a free copy among the classics.`;
}
