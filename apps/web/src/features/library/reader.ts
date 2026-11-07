/**
 * THE READER (BRIEF-LIBRARY-READER 1–3, 5–7 and its 7 Nov addendum; OWNER-ISSUES 125: "our library should act as just that, a
 * library … i can't pull up the library and read them myself"). The second screen drawn in the design system, after THE LOOK:
 * the canvas and the page are the tokens' (the page is a plate), the marks are ui/machine.ts's, and nothing here names a colour.
 *
 *  - The head: the stamp line (the day, the time, his place, what is watched, LOOKING AT <the book>), the book's name and who
 *    wrote it, and his place as a truth line ("PAGE 42 OF 300 · YESTERDAY · CARRY ON") that takes him there.
 *  - READ: the book's own words flowing on the page, its page marks where it has pages, its headings as chapter heads; scroll,
 *    or turn a screen at a time (TEXT: pages or scroll, the size, his voice for books); LISTEN, which reads from his place with
 *    the passage being read held in the reticle (ATTENDING) and the page following the voice.
 *  - CHAPTERS: the headings (or page ranges, parts, tenths: library/book.ts), the one he is in marked; a tap jumps there.
 *  - SEARCH: inside this book; a result jumps to its passage with his words marked.
 *  - ABOUT: what it is, where it came from, its size, its cover; KEEP ON THIS PHONE (its size said; on Wi-Fi) and REMOVE FROM
 *    LIBRARY (with UNDO); which voice reads it, and what happens when the screen locks (checked on his phone, not claimed).
 * Your place is kept as you read (library/place.ts) and opening a book goes there, the box snapping onto it with the recognition
 * tone once (his sound setting honoured). Reading by words ("read me <book>", "carry on reading", "where were we", "read chapter
 * 3", "stop reading", "go on" after a cut) is answered here with no model (`readingTurn`), and "that's all" signs off with the
 * page (`bookSignOff`). Every state is said in a sentence: no book yet, opening, not on this phone with no signal, a failure.
 */
import type { LibraryDoc } from '../../../../../packages/shared/src/protocol';
import { continueIntent, readingIntent, stopIntent, titleMatch } from '../../../../../packages/shared/src/intent';
import { brain } from '../../api/brain';
import { addPaletteProvider, register } from '../../commands/registry';
import { clear, h, icon } from '../../core/dom';
import { createStore } from '../../core/store';
import { chat } from '../../assistant/session';
import type { LocalAnswer } from '../../assistant/local';
import { holdEars, interrupt, primeSpeech, speak, talkHooks } from '../../assistant/voice';
import { findIn, markParts, pageStart, placeInfo, type Book, type BookPassage } from '../../library/book';
import { coverNow, coverOf, dropCover, onCover } from '../../library/covers';
import { canResume, CARRY_MS, listenLog, loadBook, onlyThisChapter, placeLine, reading, resumeReading, setBook, shortTitle, startReading, stopQuietly, stopReading, bookNow, bookVoiceLeft } from '../../library/listen';
import { keepBookHere, keptHere } from '../../library/local';
import { forgetPlace, lineFor, placeOf, places, placeStats, readingPrefs, setPlace, SIZES, sizeNow, syncPlace, syncPlaces, whenWords, type Place } from '../../library/place';
import { go, type TabInstance } from '../../shell/tabs';
import { home, settings, ui } from '../../state/app';
import { guardian, loadGuardian } from '../../state/guardian';
import { toast, type Panel } from '../../ui/components';
import { index, key, lockBox, plate, recognise, release, stampLine, tag, truthLine, typedLine, type StampFacts, type TruthPart } from '../../ui/machine';
import type { Sections } from '../../ui/sections';
import { offMobileData, onMobileData } from '../../wiki/store';
import { sizeWords } from '../../wiki/files';

/** The reader's glyph: an open book. */
export const READER_ICON = '<path d="M4 5.5c2.6-1 5.2-1 8 .8 2.8-1.8 5.4-1.8 8-.8v13c-2.6-1-5.2-1-8 .8-2.8-1.8-5.4-1.8-8-.8z"/><path d="M12 6.3v13"/>';
const G = {
  listen: '<path d="M5 9.5v5h3.5L13 18.5v-13L8.5 9.5z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1"/>',
  text: '<path d="M4 18L8.5 6h1L14 18M5.6 14h6.8"/><path d="M15 18l2.6-7h.8l2.6 7M15.9 15.6h4.2"/>',
  prev: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
};

/** Each kind of document as he would say it. */
const KIND: Record<string, string> = { pdf: 'PDF', book: 'E-book', document: 'Word file', notes: 'Notes', text: 'Text', web: 'Web page', paper: 'Paper', cve: 'CVE record', code: 'Code', starter: 'Built in', study: 'Read by me', digest: 'My notes', scan: 'Photos of pages', recon: 'Recon', note: 'Note', project: 'Project', manual: 'Manual' };
export const kindWord = (k: string): string => KIND[k] ?? (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Document');

/** The shelf as last read (the Library keeps it up to date): reading by words and the jump bar find books in it. */
export const shelfDocs = createStore({ docs: [] as LibraryDoc[], at: 0 });
/** What the Library screen does for the reader (it owns the shelf and its UNDO bar). */
export const shelfHooks = { remove: null as null | ((d: LibraryDoc) => void) };

/** What the checks read (window.__ghosty.reader). */
export const readerState = {
  doc: '',
  section: 'read',
  /** Every open: the book, how long from the tap to its words on the page at his place, where, and whether it was his kept place. */
  opens: [] as { doc: string; ms: number; n: number; off: number; kept: boolean; tone: boolean }[],
  mode: 'scroll' as 'scroll' | 'pages',
  size: 17,
  screen: 0,
  screens: 0,
  states: [] as string[],
  get listen() {
    return listenLog;
  },
  get reading() {
    return reading.get();
  },
  get places() {
    return placeStats;
  },
  place: (doc: string) => placeOf(doc),
};

// ---------------------------------------------------------------------------------------------------- covers and the Shelf

const words3 = (s: string) => s.split(/\s+/).slice(0, 14).join(' ');

/** A cover drawn from the title where the file has no picture of its own: the plate, the tag, the title, in the theme's accent. */
export function drawnCover(d: { title: string; author?: string; kind: string }, size: 'row' | 'big' = 'row'): HTMLElement {
  return h(`span.grd-cover.drawn.${size}` as 'span', { 'aria-hidden': 'true', dataset: { case: 'keep' } },
    h('span.g-ret-frame'),
    tag(kindWord(d.kind)),
    h('b.grd-cover-t', words3(d.title)),
    d.author ? h('i.grd-cover-a', d.author) : null);
}

/** A book's cover: its own picture when this phone has one, else the drawn one (swapped for the picture when it arrives). */
export function coverFor(d: { id: string; title: string; author?: string; kind: string }, size: 'row' | 'big' = 'row'): HTMLElement {
  const pic = (url: string) => h(`span.grd-cover.pic.${size}` as 'span', { 'aria-hidden': 'true' }, h('img', { src: url, alt: '', decoding: 'async' }));
  const known = coverNow(d.id);
  if (known) return pic(known);
  const el = drawnCover(d, size);
  if (known === undefined) void coverOf(d.id).then((url) => url && el.isConnected && el.replaceWith(pic(url)));
  return el;
}

/** A document with pages of its own (a PDF, photos of pages, a text with page breaks): an e-book's parts are not pages. */
export const hasOwnPages = (d: Pick<LibraryDoc, 'pages' | 'kind'>): boolean => d.pages > 1 && d.kind !== 'book';

/** How far through a book he is, as the Shelf row and the reader's head say it. */
export function progressOf(d: LibraryDoc, p: Place | null = placeOf(d.id)): { parts: TruthPart[]; started: boolean; finished: boolean; words: string } {
  if (!p) return { parts: [{ text: 'Not started', tone: 'strong' }], started: false, finished: false, words: 'not started' };
  const when = whenWords(p.at);
  if (p.done) return { parts: [{ text: 'Finished', tone: 'on' }, when], started: true, finished: true, words: `finished ${when}` };
  const where = hasOwnPages(d) && p.page ? `Page ${p.page} of ${d.pages}` : `${Math.max(1, Math.floor(p.pct * 100))}% read`;
  return { parts: [{ text: where, tone: 'strong' }, when], started: true, finished: false, words: `${where.toLowerCase()} · ${when}` };
}

/**
 * A book on the Shelf (STARS 169): its cover, its name, who wrote it, its kind, and how far he is ("PAGE 42 OF 300 ·
 * YESTERDAY", "FINISHED", "NOT STARTED"); a tap opens it at his place. A row the old selectors still know (.rw .k .v).
 */
export function shelfRow(d: LibraryDoc, open: () => void): HTMLElement {
  const pr = progressOf(d);
  const r = h('div.rw.link.wrap.bookrow', {
    tabIndex: 0,
    role: 'button',
    dataset: { id: d.id, case: 'keep', state: pr.finished ? 'finished' : pr.started ? 'reading' : 'new' },
    'aria-label': `${d.title}${d.author ? `, by ${d.author}` : ''}: ${pr.words}. Open`,
  },
  coverFor(d),
  h('span.btxt',
    h('span.v', d.title),
    d.author ? h('span.by', d.author) : null,
    h('span.k', `${kindWord(d.kind)}${hasOwnPages(d) ? ` · ${d.pages} pages` : ''}`),
    truthLine(pr.parts)),
  pr.finished ? tag('Finished', { tone: 'on' }) : null);
  r.addEventListener('click', open);
  r.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
  return r;
}

export type ShelfSort = 'recent' | 'progress' | 'title';
const titleKey = (t: string) => t.toLowerCase().replace(/^(the|a|an)\s+/, '');
/** His books in the order he picked: by when he last read them (or added them), by how far through, or by name. */
export function sortShelf(list: LibraryDoc[], by: ShelfSort): LibraryDoc[] {
  const p = (d: LibraryDoc) => placeOf(d.id);
  const rank = (d: LibraryDoc) => (p(d)?.done ? 2 : p(d) ? 0 : 1);
  return [...list].sort((a, b) =>
    by === 'title' ? titleKey(a.title).localeCompare(titleKey(b.title), 'en')
    : by === 'progress' ? rank(a) - rank(b) || (p(b)?.pct ?? 0) - (p(a)?.pct ?? 0) || b.at - a.at
    : Math.max(p(b)?.at ?? 0, b.at) - Math.max(p(a)?.at ?? 0, a.at));
}

// ---------------------------------------------------------------------------------------------------- SETTINGS → READING

/**
 * How he likes to read, one set of controls shown in two places (Settings → Reading, and the reader's own TEXT key): pages or
 * scroll, the size (never under 12 pt, 17 to start), and HIS VOICE FOR BOOKS. Night text follows his theme.
 */
export function readingControls(): HTMLElement {
  const box = h('div.grd-prefs', { role: 'group', 'aria-label': 'Reading' });
  const paint = () => {
    const p = readingPrefs.get();
    const size = sizeNow();
    const at = SIZES.indexOf(size as (typeof SIZES)[number]);
    const scroll = key('Scroll', () => readingPrefs.set({ mode: 'scroll' }), { label: 'Read by scrolling' });
    const pages = key('Pages', () => readingPrefs.set({ mode: 'pages' }), { label: 'Read a page at a time' });
    scroll.setAttribute('aria-pressed', String(p.mode === 'scroll'));
    pages.setAttribute('aria-pressed', String(p.mode === 'pages'));
    const smaller = key('A−', () => readingPrefs.set({ size: SIZES[Math.max(0, at - 1)]! }), { label: 'Smaller text' });
    const bigger = key('A+', () => readingPrefs.set({ size: SIZES[Math.min(SIZES.length - 1, at + 1)]! }), { label: 'Bigger text' });
    smaller.disabled = at <= 0;
    bigger.disabled = at >= SIZES.length - 1;
    const voice = key(`His voice for books · ${p.bookVoice ? 'on' : 'off'}`, () => readingPrefs.set({ bookVoice: !readingPrefs.get().bookVoice }), { label: `His voice for books: ${p.bookVoice ? 'on' : 'off'}` });
    voice.classList.add('grd-voicekey');
    voice.setAttribute('aria-pressed', String(p.bookVoice));
    const left = Math.max(0, Math.round(bookVoiceLeft() / 60));
    clear(box,
      tag('Reading'),
      h('div.grd-keys', scroll, pages),
      h('div.grd-keys.size', smaller, h('span.grd-size', { 'aria-live': 'polite', dataset: { case: 'keep' } }, `${size} pt`), bigger),
      h('p.grd-cap', { dataset: { case: 'keep' } }, 'Night text follows your theme: always light on the graphite, with your theme’s colour for what I attend to.'),
      voice,
      h('p.grd-cap', { dataset: { case: 'keep' } }, p.bookVoice
        ? `My own voice reads your books for about an hour a day (${left} minutes left today), within the free share it has; when it runs out mid-read I say “My own voice from here.” and the phone’s voice carries on.`
        : 'Off: the phone’s own voice reads your books. A book is hours of speech, and my own voice has a daily share that would run out mid-chapter.'));
  };
  paint();
  readingPrefs.subscribe(() => box.isConnected ? paint() : undefined);
  return box;
}

// ---------------------------------------------------------------------------------------------------- the screen

interface OpenReq {
  doc: LibraryDoc;
  /** A place to open at (a chapter, a page, a search result); else his kept place. */
  n?: number;
  off?: number;
  /** A search's words, marked in the passage it opens at. */
  terms?: string[];
  /** A search result from the Library (ASK THE LIBRARY): the passage whose text this is. */
  hitText?: string;
  /** Read it aloud once open (by words: "read me …"). */
  listen?: { lead?: string; only?: boolean };
  /** When he asked (the open and the first word are timed from it). */
  t0: number;
}

interface View {
  open(r: OpenReq): Promise<void>;
  enter(): void;
}
let view: View | null = null;
let pending: OpenReq | null = null;
/** The document open in the reader (its library entry). */
let docNow: LibraryDoc | null = null;

/** Open a book in the reader (the Shelf's tap, a search result, reading by words). */
export async function openBook(doc: LibraryDoc, req: Omit<OpenReq, 'doc' | 't0'> & { t0?: number } = {}): Promise<void> {
  const r: OpenReq = { ...req, doc, t0: req.t0 ?? performance.now() };
  pending = r;
  if (ui.get().tab !== 'reader') {
    const { navTo } = await import('../../shell/areas');
    navTo('reader', 'push');
  }
  if (view && pending === r) {
    pending = null;
    await view.open(r);
  }
}

/** The deck's live line: the book being read and where. */
export function readerNow(): string {
  const d = docNow;
  if (!d) return '';
  const p = placeOf(d.id);
  return p ? `${shortTitle(d.title)} · ${progressOf(d, p).words}` : shortTitle(d.title);
}

/** The feeds the guardian reads that answered last time (the stamp line's "watching"), as THE LOOK counts them. */
function feedsWatched(): number | null {
  const info = guardian.get().info;
  if (!info) return null;
  return (['flood', 'weather', 'crime'] as const).filter((f) => info.checked[f] && !info.failed[f]).length;
}

/** The hud, its head and its column, with the four panels in it (features/reader/index.ts names them for the catalogue). */
export function readerShell(root: HTMLElement, P: Record<'read' | 'chapters' | 'search' | 'about', Panel>): { hud: HTMLElement; hero: HTMLElement; col: HTMLElement } {
  const hero = h('div.hero.grd-head');
  const col = h('div.col');
  const hud = h('div.hud.grd', hero, col);
  for (const p of Object.values(P)) {
    p.title.dataset.case = 'keep';
    // a section's head is a title here, not a fold
    p.el.addEventListener('click', (e) => (e.target as Element).closest(':scope > h3') && e.stopPropagation(), true);
    col.append(p.el);
  }
  root.append(hud);
  return { hud, hero, col };
}

export function mountReader(shell: { hud: HTMLElement; hero: HTMLElement; col: HTMLElement }, P: Record<'read' | 'chapters' | 'search' | 'about', Panel>, secs: Sections): TabInstance {
  // the checks' handle: a reload on #reader builds this screen before the app has made window.__ghosty, so it waits for it
  const expose = (tries = 0) => {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.reader = readerState;
    else if (tries < 100) setTimeout(() => expose(tries + 1), 100);
  };
  expose();
  const { hud, hero } = shell;
  let book: Book | null = null;
  let doc: LibraryDoc | null = null;

  // ---------------------------------------------------------------- the head: the stamp, the name, his place
  let looking = 'your shelf';
  const facts = (): StampFacts => ({ place: home().name, watching: feedsWatched(), looking, offline: typeof navigator !== 'undefined' && navigator.onLine === false });
  const stamp = stampLine(facts);
  const title = h('h2.grd-title', { dataset: { case: 'keep' } }, 'Your books');
  const by = h('p.grd-by', { dataset: { case: 'keep' } });
  const placeBtn = h('button.grd-place', { type: 'button', dataset: { case: 'keep' } });
  const say = typedLine({ label: 'What I am saying' });
  say.el.classList.add('grd-say');
  hero.append(stamp.el, title, by, placeBtn, say.el);

  // ---------------------------------------------------------------- READ: the page, the bar under it, the text settings
  const flow = h('div.grd-flow');
  const page = h('div.grd-page', { role: 'document', 'aria-label': 'The book' }, flow);
  const box = lockBox(page);
  const note = h('div.grd-note', { role: 'status', 'aria-live': 'polite' });
  const prefsBox = h('div.grd-prefsbox', { hidden: true }, plate({ strong: true }, readingControls()));
  const barLine = h('div.grd-barline', { role: 'status', 'aria-live': 'polite' });
  const listenKey = key('Listen', () => toggleListen(), { kind: 'fill', label: 'Listen: I read it to you from your place', glyph: G.listen });
  const textKey = key('Text', () => {
    prefsBox.hidden = !prefsBox.hidden;
    textKey.setAttribute('aria-expanded', String(!prefsBox.hidden));
  }, { label: 'Text: pages or scroll, the size, the voice', glyph: G.text });
  textKey.setAttribute('aria-expanded', 'false');
  const prevKey = key('', () => turn(-1), { label: 'Back a page', glyph: G.prev });
  const nextKey = key('', () => turn(1), { label: 'Next page', glyph: G.next });
  const bar = h('div.grd-bar', { role: 'group', 'aria-label': 'Listen' }, barLine, h('div.grd-keys', prevKey, listenKey, textKey, nextKey));
  P.read.el.classList.add('grd-readpn');
  P.read.body.append(prefsBox, note, page, bar);

  // ---------------------------------------------------------------- CHAPTERS, SEARCH, ABOUT
  const chList = h('div.grd-chapters', { role: 'list' });
  P.chapters.body.append(chList);
  const q = h('input.grd-q', { type: 'search', placeholder: 'Find in this book', enterKeyHint: 'search', 'aria-label': 'Find in this book' });
  const findKey = key('Find', () => runSearch(), { label: 'Find in this book' });
  const found = h('div.grd-found', { role: 'list' });
  const foundLine = h('div.grd-foundline', { role: 'status', 'aria-live': 'polite' });
  P.search.body.append(h('div.grd-keys.find', q, findKey), foundLine, found);
  q.addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());
  const about = h('div.grd-about');
  P.about.body.append(about);

  // ---------------------------------------------------------------- states, said in a sentence
  const states = (list: [string, string][]) => {
    readerState.states = list.map(([k]) => k);
    clear(note, ...list.map(([k, v]) => h('p.grd-state', { dataset: { case: 'keep' } }, h('b', k), v)));
  };

  // ---------------------------------------------------------------- drawing the book
  /** Each passage's element, by its place in the book. */
  let els: HTMLElement[] = [];
  const passageEl = (n: number) => els[n] ?? null;
  const lh = () => lineFor(sizeNow());
  const applyType = () => {
    const s = sizeNow();
    flow.style.setProperty('--rd-size', `${s}px`);
    flow.style.setProperty('--rd-lh', `${lineFor(s)}px`);
    readerState.size = s;
  };
  const drawPassage = (p: BookPassage, terms: string[] = []): HTMLElement => {
    const el = h('div.grd-p', { dataset: { n: String(p.n) } });
    if (book?.code) el.append(h('pre.grd-code', p.text));
    else for (const para of p.paras) {
      if (para.head) el.append(h('h3.grd-ch', { dataset: { case: 'keep', at: String(para.at) } }, para.text));
      else {
        const t = h('p.grd-tx', { dataset: { case: 'keep', at: String(para.at) } });
        for (const part of markParts(para.text, terms)) t.append(part.mark ? h('mark', part.text) : part.text);
        el.append(t);
      }
    }
    return el;
  };
  const drawBook = () => {
    if (!book) return;
    applyType();
    const frag = document.createDocumentFragment();
    els = [];
    let lastPage: number | null = null;
    for (const p of book.passages) {
      if (book.hasPages && p.page && p.page !== lastPage) frag.append(h('div.grd-pg', { dataset: { case: 'keep', page: String(p.page) }, 'aria-label': `Page ${p.page}` }, `Page ${p.page}`));
      if (p.page) lastPage = p.page;
      const el = drawPassage(p);
      els[p.n] = el;
      frag.append(el);
    }
    flow.replaceChildren(frag);
    release(box);
  };

  // ---------------------------------------------------------------- where he is on the page
  /** Where the pills end now (what is under them is his place as he scrolls)… */
  const pillsBottom = () => (secs.el.hidden ? hud.getBoundingClientRect().top : secs.el.getBoundingClientRect().bottom) + 8;
  /** …and where they end once held at the top (where a place is brought to). */
  const stuckBottom = () => hud.getBoundingClientRect().top + (secs.el.hidden ? 0 : secs.el.offsetHeight) + 8;
  /** The paragraph of passage `n` that holds `off`. */
  const paraAt = (n: number, off: number): HTMLElement | null => {
    const el = passageEl(n);
    if (!el) return null;
    let pick: HTMLElement | null = null;
    for (const c of el.children) if (Number((c as HTMLElement).dataset.at ?? 0) <= off) pick = c as HTMLElement;
    return pick ?? (el.firstElementChild as HTMLElement | null) ?? el;
  };
  /** How far down the book's words an element is (from the top of the flow; the same in either mode, turned or not). */
  const topIn = (el: Element): number => el.getBoundingClientRect().top - flow.getBoundingClientRect().top;
  /** The y of a place in the flow: its paragraph's top, and how far into that paragraph the offset falls. */
  const yIn = (n: number, off: number): number => {
    const para = paraAt(n, off);
    if (!para || !book) return 0;
    const start = Number(para.dataset.at ?? 0);
    const len = Math.max(1, para.textContent?.length ?? 1);
    return topIn(para) + Math.max(0, Math.min(1, (off - start) / len)) * para.getBoundingClientRect().height;
  };
  let auto = 0; // a scroll the reader made itself (opening, following the voice): not his
  let touched = 0; // when he last scrolled or turned by hand
  const mode = () => readingPrefs.get().mode;

  /** Scroll mode: the page scrolled so the place sits under the pills (the book's very start: the head shown above it). */
  const scrollTo = (n: number, off: number, smooth = false) => {
    const el = passageEl(n);
    if (!el) return;
    auto = performance.now();
    if (n === 0 && off < 40) {
      hud.scrollTo({ top: 0, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
      return;
    }
    const rect = flow.getBoundingClientRect();
    const target = hud.scrollTop + rect.top + yIn(n, off) - stuckBottom();
    hud.scrollTo({ top: Math.max(0, target), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  };

  // pages mode: the page a fixed box of whole lines, the words moved up a screen at a time
  let screen = 0;
  let step = 0;
  let screens = 1;
  const fitPages = () => {
    if (mode() !== 'pages' || !book) return;
    page.classList.add('pages');
    // the page brought up under the pills, then as tall as the screen leaves room for, in whole lines
    hud.style.overflowY = '';
    auto = performance.now();
    hud.scrollTop += page.getBoundingClientRect().top - stuckBottom();
    const top = page.getBoundingClientRect().top;
    const tab = (document.querySelector('#dock') as HTMLElement | null)?.getBoundingClientRect().top ?? innerHeight;
    const room = Math.max(lh() * 6, Math.min(innerHeight, tab) - top - bar.offsetHeight - 16);
    const pad = 16;
    const lines = Math.max(4, Math.floor((room - pad * 2) / lh()));
    step = lines * lh();
    page.style.height = `${step + pad * 2}px`;
    screens = Math.max(1, Math.ceil(flow.scrollHeight / step));
    hud.style.overflowY = 'hidden';
    readerState.screens = screens;
    showScreen(Math.min(screen, screens - 1), false);
  };
  const showScreen = (k: number, animate = true) => {
    screen = Math.max(0, Math.min(screens - 1, k));
    readerState.screen = screen;
    flow.style.transition = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : 'none';
    flow.style.transform = `translateY(${-screen * step}px)`;
    prevKey.disabled = screen <= 0;
    nextKey.disabled = screen >= screens - 1;
    if (book) {
      // the place: the passage at the top of this screen
      const y = screen * step;
      let n = 0;
      for (const el of els) if (el && topIn(el) <= y + 2) n = Number(el.dataset.n);
      const el = passageEl(n);
      const into = el ? Math.max(0, y - topIn(el)) / Math.max(1, el.getBoundingClientRect().height) : 0;
      if (reading.get().state !== 'reading') keepAt(n, Math.round(into * (book.passages[n]?.text.length ?? 0)));
    }
  };
  const unfitPages = () => {
    page.classList.remove('pages');
    page.style.height = '';
    flow.style.transform = '';
    hud.style.overflowY = '';
  };
  const turn = (d: number) => {
    if (mode() !== 'pages') return;
    touched = performance.now();
    showScreen(screen + d);
  };
  const pagesTo = (n: number, off: number) => {
    if (!step) return;
    showScreen(Math.floor(yIn(n, off) / step), false);
  };
  /** Bring a place into view, in either mode. */
  const bringTo = (n: number, off: number, smooth = false) => (mode() === 'pages' ? pagesTo(n, off) : scrollTo(n, off, smooth));

  /** His place moves here (as he scrolls or turns), kept on the phone and sent to the brain a moment later. */
  const keepAt = (n: number, off: number) => {
    if (!book || !doc) return;
    const p = placeInfo(book, n, off);
    const prev = placeOf(doc.id);
    if (prev && prev.n === p.n && Math.abs(prev.off - p.off) < 40 && !p.end) return;
    setPlace(doc.id, { n: p.n, off: p.off, page: p.page, pct: p.pct, done: p.end || (prev?.done ?? false) });
    paintHead();
  };
  // scroll mode: the passage under the pills is his place
  let ticking = false;
  hud.addEventListener('scroll', () => {
    if (ticking || mode() === 'pages' || !book || secs.current() !== 'read') return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (performance.now() - auto < 600 || reading.get().state === 'reading') return;
      touched = performance.now();
      const y = pillsBottom() + 4;
      const x = page.getBoundingClientRect().left + 24;
      const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.grd-p');
      const el = hit ?? els.find((e) => e && e.getBoundingClientRect().bottom > y) ?? null;
      if (!el) return;
      const n = Number(el.dataset.n);
      const r = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (y - r.top) / Math.max(1, r.height)));
      // the end of the book in view: finished
      const last = els[els.length - 1];
      const atEnd = !!last && last.getBoundingClientRect().bottom <= innerHeight - bar.offsetHeight;
      keepAt(atEnd ? book!.passages.length - 1 : n, atEnd ? Math.max(0, book!.passages[book!.passages.length - 1]!.text.length - 1) : Math.round(frac * (book!.passages[n]?.text.length ?? 0)));
      if (box && !box.hidden) release(box);
    });
  }, { passive: true });
  // pages mode: a swipe turns the page; a tap on the right or left of it too (while I read aloud, a tap stops me instead)
  let sx = 0;
  let sy = 0;
  let st = 0;
  page.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
    st = performance.now();
  });
  page.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (reading.get().state === 'reading') {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) interrupt('tap');
      return;
    }
    if (mode() !== 'pages') return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return turn(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && performance.now() - st < 400) {
      const r = page.getBoundingClientRect();
      const at = (e.clientX - r.left) / r.width;
      if (at > 0.6) turn(1);
      else if (at < 0.4) turn(-1);
    }
  });

  // ---------------------------------------------------------------- the head, kept true
  const paintHead = () => {
    stamp.look(looking);
    if (!doc) {
      title.textContent = 'Your books';
      by.textContent = '';
      clear(placeBtn, truthLine([{ text: 'No book open', tone: 'strong' }, 'pick one on your shelf']));
      placeBtn.setAttribute('aria-label', 'No book open: pick one on your shelf');
      return;
    }
    title.textContent = doc.title;
    title.classList.toggle('long', doc.title.length > 28);
    by.textContent = doc.author ? `by ${doc.author}` : kindWord(doc.kind);
    const p = placeOf(doc.id);
    const pr = progressOf(doc, p);
    const parts: TruthPart[] = !p ? [{ text: book ? placeInfo(book, 0, 0).words : 'Not started', tone: 'strong' }, 'not started', { text: 'Start', tone: 'on' }]
      : p.done ? [{ text: 'Finished', tone: 'on' }, whenWords(p.at), { text: 'Read again', tone: 'on' }]
      : [{ text: book ? placeInfo(book, p.n, p.off).words : pr.parts[0] && typeof pr.parts[0] !== 'string' ? pr.parts[0].text : '', tone: 'strong' }, whenWords(p.at), { text: 'Carry on', tone: 'on' }];
    clear(placeBtn, truthLine(parts));
    placeBtn.setAttribute('aria-label', `Your place: ${parts.map((x) => (typeof x === 'string' ? x : x.text)).join(', ')}`);
  };
  placeBtn.addEventListener('click', () => {
    if (!book || !doc) {
      void import('../../shell/areas').then((a) => a.navTo('library', 'pop'));
      return;
    }
    const p = placeOf(doc.id);
    secs.select('read');
    if (p?.done) {
      setPlace(doc.id, { n: 0, off: 0, page: book.passages[0]?.page ?? null, pct: 0, done: false });
      bringTo(0, 0);
    } else bringTo(p?.n ?? 0, p?.off ?? 0, true);
    paintHead();
  });

  // ---------------------------------------------------------------- LISTEN, and the bar's line
  const engineWords = () => {
    const s = reading.get();
    if (s.engine === 'ghosty') return 'My own voice';
    if (s.switched) return 'The phone’s voice from here';
    return 'The phone’s voice';
  };
  const paintBar = () => {
    const s = reading.get();
    const mine = !!doc && s.doc === doc.id;
    const st = mine ? s.state : 'idle';
    const where = book && doc ? placeInfo(book, mine ? s.n : placeOf(doc.id)?.n ?? 0, mine ? s.off : placeOf(doc.id)?.off ?? 0).words : '';
    const line: TruthPart[] = st === 'reading' ? [{ text: 'Attending', tone: 'on' }, where, engineWords()]
      : st === 'cut' ? [{ text: 'Stopped', tone: 'strong' }, where, 'say “go on”']
      : st === 'stopped' || (st === 'ended' && !s.finished) ? [{ text: 'Your place', tone: 'strong' }, where, canResume() ? 'say “go on”' : 'tap listen']
      : s.finished && mine ? [{ text: 'Finished', tone: 'on' }, 'read to the end']
      : book ? [{ text: 'Listen', tone: 'strong' }, readingPrefs.get().bookVoice ? 'my own voice, about an hour a day' : 'the phone’s own voice'] : [{ text: 'Open a book first', tone: 'strong' }];
    clear(barLine, truthLine(line));
    const word = st === 'reading' ? 'Stop' : st === 'cut' || ((st === 'stopped' || st === 'ended') && canResume()) ? 'Go on' : 'Listen';
    const label = st === 'reading' ? 'Stop reading, and say where we are' : word === 'Go on' ? 'Go on: read on from where you stopped me' : 'Listen: I read it to you from your place';
    listenKey.replaceChildren(icon(st === 'reading' ? G.stop : G.listen, 'g-glyph'), h('span', word));
    listenKey.setAttribute('aria-label', label);
    listenKey.disabled = !book;
    const pages = mode() === 'pages';
    prevKey.hidden = nextKey.hidden = !pages;
    bar.classList.toggle('pages', pages);
  };
  /** LISTEN's key: start (from his place), stop (and say where we are), or go on (after a cut). */
  const toggleListen = () => {
    if (!book || !doc) return;
    const s = reading.get();
    if (s.state === 'reading' && s.doc === doc.id) {
      // the microphone let go: the conversation ends, and I say where we are
      talkHooks.end?.();
      void stopReading(settings.get().speak);
      return;
    }
    primeSpeech();
    // in the tap: the ear held open so he can talk over me (Safari opens the microphone only from a tap)
    void holdEars().then((ears) => ears && talkHooks.converse?.());
    if (s.doc === doc.id && canResume() && (s.state === 'cut' || s.state === 'stopped' || s.state === 'ended')) {
      resumeReading();
      return;
    }
    const p = placeOf(doc.id);
    const from = p && !p.done ? { n: p.n, off: p.off } : { n: 0, off: 0 };
    if (p?.done) setPlace(doc.id, { n: 0, off: 0, page: book.passages[0]?.page ?? null, pct: 0, done: false });
    startReading(book, from);
  };
  // the voice moves: the passage it reads is held in the reticle, and the page follows (unless he moved it in the last few seconds)
  let litEl: HTMLElement | null = null;
  const light = (n: number) => {
    const el = n >= 0 ? passageEl(n) : null;
    if (litEl === el) return;
    if (litEl) {
      litEl.classList.remove('lit');
      litEl.removeAttribute('aria-current');
      litEl.querySelector(':scope > .grd-litframe')?.remove();
    }
    litEl = el;
    if (!el) return;
    el.classList.add('lit');
    el.setAttribute('aria-current', 'true');
    el.prepend(h('span.g-ret-frame.grd-litframe', { 'aria-hidden': 'true' }));
    release(box);
  };
  reading.subscribe((s, prev) => {
    paintBar();
    if (!doc || s.doc !== doc.id) return light(-1);
    light(s.state === 'reading' || s.state === 'cut' ? s.lit : -1);
    if (s.state === 'reading' && (s.n !== prev.n || s.off !== prev.off) && performance.now() - touched > 6000) {
      if (mode() === 'pages') {
        // the page turns when the voice reaches the words below it
        const y = yIn(s.n, s.off);
        if (y >= (screen + 1) * step - lh() || y < screen * step) pagesTo(s.n, s.off);
      } else {
        const el = passageEl(s.lit);
        const r = el?.getBoundingClientRect();
        if (r && (r.top < pillsBottom() - 2 || r.top > innerHeight - bar.offsetHeight - lh() * 3)) scrollTo(s.lit, 0, true);
      }
    }
    paintHead();
  });

  // ---------------------------------------------------------------- CHAPTERS
  const paintChapters = () => {
    if (!book || !doc) {
      clear(chList, h('p.grd-cap', { dataset: { case: 'keep' } }, 'Open a book and its chapters are here.'));
      P.chapters.setStatus('');
      return;
    }
    const p = placeOf(doc.id);
    const cur = book.passages[p?.n ?? 0]?.chapter ?? 0;
    P.chapters.setStatus(`${book.chapters.length} ${book.byHeadings ? (book.chapters.length === 1 ? 'chapter' : 'chapters') : book.hasPages ? 'page ranges' : 'parts'}`);
    clear(chList, ...(book.byHeadings ? [] : [h('p.grd-cap', { dataset: { case: 'keep' } }, book.hasPages ? 'This book has no chapter headings of its own, so here are its pages.' : 'This has no chapter headings of its own, so here it is in parts.')]),
      ...book.chapters.map((c) => {
        const here = c.i === cur;
        const b = h('button.grd-chrow', { type: 'button', role: 'listitem', dataset: { i: String(c.i), case: 'keep' }, 'aria-label': `${c.title}${c.page ? `, page ${c.page}` : ''}${here ? ', you are here' : ''}`, 'aria-current': here ? 'true' : null },
          index(c.i + 1, { on: here }),
          h('span.grd-chtxt', h('b', c.title), truthLine([c.page && book!.hasPages ? `Page ${c.page}` : `${Math.round(c.pct * 100)}% in`, ...(here ? [{ text: 'You are here', tone: 'on' } as TruthPart] : [])])));
        b.addEventListener('click', () => jump(c.n, 0));
        return b;
      }));
  };
  /** Go to a place in the book (a chapter, a search result): it is his place now, READ shows it. */
  const jump = (n: number, off: number, terms: string[] = []) => {
    if (!book || !doc) return;
    secs.select('read');
    if (reading.get().state === 'reading') stopQuietly();
    if (terms.length) {
      const old = flow.querySelector('.grd-p.found');
      if (old) {
        const k = Number((old as HTMLElement).dataset.n);
        const fresh = drawPassage(book.passages[k]!);
        els[k] = fresh;
        old.replaceWith(fresh);
      }
      const el = drawPassage(book.passages[n]!, terms);
      el.classList.add('found');
      els[n]?.replaceWith(el);
      els[n] = el;
    }
    const p = placeInfo(book, n, off);
    setPlace(doc.id, { n: p.n, off: p.off, page: p.page, pct: p.pct, done: false });
    requestAnimationFrame(() => {
      if (mode() === 'pages') fitPages();
      bringTo(n, off);
      const target = terms.length ? els[n]?.querySelector('mark')?.parentElement ?? els[n] : paraAt(n, off);
      if (target) void holdOn(target as HTMLElement);
    });
    paintHead();
    paintChapters();
  };
  /** The box held on a thing with no tone (the tone is for a book opening at his place, once). */
  const holdOn = async (el: HTMLElement) => {
    box.hidden = false;
    box.dataset.state = 'attend';
    const hb = page.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: `${r.left - hb.left - page.clientLeft}px`, top: `${r.top - hb.top - page.clientTop}px`, width: `${r.width}px`, height: `${r.height}px` });
  };

  // ---------------------------------------------------------------- SEARCH inside the book
  const runSearch = () => {
    const words = q.value.trim();
    if (!book) return;
    if (!words) {
      clear(found);
      clear(foundLine);
      return;
    }
    const hits = findIn(book, words);
    clear(foundLine, truthLine(hits.length ? [{ text: `${hits.length}${hits.length >= 60 ? '+' : ''} found`, tone: 'strong' }, `“${words}”`] : [{ text: 'Not in this book', tone: 'strong' }, `“${words}”`]));
    clear(found, ...(hits.length ? hits.map((x, i) => {
      const where = [x.page && book!.hasPages ? `Page ${x.page}` : '', book!.byHeadings ? book!.chapters[x.chapter]?.title ?? '' : ''].filter(Boolean);
      const snip = h('span.grd-snip', { dataset: { case: 'keep' } });
      for (const part of markParts(x.around, x.terms)) snip.append(part.mark ? h('mark', part.text) : part.text);
      const b = h('button.grd-hit', { type: 'button', role: 'listitem', dataset: { n: String(x.n), case: 'keep' }, 'aria-label': `${where.join(', ') || `Result ${i + 1}`}: ${x.around}. Go there` }, index(i + 1), h('span.grd-hittxt', where.length ? truthLine(where) : null, snip));
      b.addEventListener('click', () => jump(x.n, x.off, x.terms));
      return b;
    }) : [h('p.grd-cap', { dataset: { case: 'keep' } }, 'Try fewer words, or another spelling. I look for every word you type, in any order.')]));
  };

  // ---------------------------------------------------------------- ABOUT
  let keeping: AbortController | null = null;
  const paintAbout = async () => {
    if (!doc) {
      clear(about, h('p.grd-cap', { dataset: { case: 'keep' } }, 'Open a book and what it is, where it came from and how to keep it are here.'));
      return;
    }
    const d = doc;
    const here = await keptHere(d.id).catch(() => 0);
    if (doc !== d) return;
    const size = Math.max(1000, Math.round(d.chars * 1.05));
    const whole = here >= d.passages && d.passages > 0;
    const added = d.at ? new Date(d.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const keep = key(whole ? `Kept on this phone · ${sizeWords(size)}` : `Keep on this phone · ${sizeWords(size)}`, () => void keepHere(d, size, keep), { label: whole ? `Kept on this phone, ${sizeWords(size)}: it reads with no signal` : `Keep on this phone: a download of ${sizeWords(size)}, on Wi-Fi` });
    keep.classList.add('grd-keepkey');
    keep.disabled = whole || d.id.startsWith('local-');
    keep.setAttribute('aria-pressed', String(whole));
    const remove = d.builtin ? null : key('Remove from library', () => {
      if (!shelfHooks.remove) return;
      if (reading.get().doc === d.id) stopQuietly();
      shelfHooks.remove(d);
      forgetPlace(d.id);
      void dropCover(d.id);
      docNow = null;
      void import('../../shell/areas').then((a) => a.navTo('library', 'pop'));
    }, { label: `Remove ${d.title} from the library (you can undo it)` });
    remove?.classList.add('grd-remove');
    const lock = 'When the screen locks: not checked on your phone yet. My own voice plays through the page’s sound and may keep going; the phone’s own voice stops, because the iPhone pauses it. Tell me what happened and I’ll say it here.';
    clear(about,
      h('div.grd-aboutrow', coverFor(d, 'big'), h('div.grd-abouttxt',
        h('b.grd-abouttitle', { dataset: { case: 'keep' } }, d.title),
        d.author ? h('span.by', { dataset: { case: 'keep' } }, d.author) : null,
        truthLine([kindWord(d.kind), hasOwnPages(d) ? `${d.pages} pages` : `${d.passages} passage${d.passages === 1 ? '' : 's'}`, ...(book ? [`${book.chapters.length} ${book.byHeadings ? 'chapters' : book.hasPages ? 'page ranges' : 'parts'}`] : [])]),
        d.source ? truthLine([{ text: 'From', tone: 'strong' }, d.source]) : null,
        added ? truthLine([{ text: 'Added', tone: 'strong' }, added]) : null,
        truthLine([{ text: 'On this phone', tone: 'strong' }, whole ? 'all of it · reads with no signal' : here ? `${here} of ${d.passages} passages` : d.id.startsWith('local-') ? 'only here so far' : 'not yet']))),
      h('div.grd-keys.about', keep, remove),
      h('p.grd-cap', { dataset: { case: 'keep' } }, whole ? 'It is all on this phone, so it opens and reads aloud with no signal.' : `Keeping it here is a download of ${sizeWords(size)}: I fetch it on Wi-Fi, and wait for Wi-Fi if you are on mobile data.`),
      tag('Who reads it'),
      h('p.grd-cap', { dataset: { case: 'keep' } }, readingPrefs.get().bookVoice ? `My own voice, about an hour a day (${Math.max(0, Math.round(bookVoiceLeft() / 60))} minutes left today); then the phone’s voice carries on, and I say so.` : 'The phone’s own voice. Settings › Reading › His voice for books lets my own voice read about an hour a day.'),
      h('p.grd-cap', { dataset: { case: 'keep' } }, lock));
  };
  /** KEEP ON THIS PHONE: on his tap, the whole book here (on Wi-Fi; on mobile data it waits, said, until Wi-Fi). */
  const keepHere = async (d: LibraryDoc, size: number, k: HTMLButtonElement) => {
    if (keeping) {
      keeping.abort();
      keeping = null;
      void paintAbout();
      return;
    }
    keeping = new AbortController();
    const sig = keeping.signal;
    const said = (w: string) => k.replaceChildren(h('span', w));
    if (onMobileData()) {
      said(`Waiting for Wi-Fi · ${sizeWords(size)}`);
      toast(`You’re on mobile data: I’ll fetch “${shortTitle(d.title)}” (${sizeWords(size)}) once you’re on Wi-Fi. Tap again to cancel.`, 'warn');
      await offMobileData(sig);
      if (sig.aborted) return;
    }
    try {
      const all: { rid: number; text: string; heading: string; page: number | null }[] = [];
      let after = 0;
      for (let i = 0; i < 200 && !sig.aborted; i++) {
        said(`Fetching · ${Math.min(100, Math.round((all.length / Math.max(1, d.passages)) * 100))}%`);
        const r = await brain.libraryPassages(d.id, after);
        all.push(...r.passages);
        if (r.next === null || !r.passages.length) break;
        after = r.next;
      }
      if (sig.aborted) return;
      await keepBookHere(d, all);
      toast(`Kept on this phone: ${shortTitle(d.title)} reads with no signal now`, 'ok');
    } catch (e) {
      toast(`Couldn’t keep it on this phone: ${(e as Error).message}`, 'warn');
    } finally {
      keeping = null;
      void paintAbout();
    }
  };

  // ---------------------------------------------------------------- opening a book
  let opening = 0;
  const open = async (r: OpenReq) => {
    const me = ++opening;
    const d = r.doc;
    if (reading.get().state === 'reading' && reading.get().doc !== d.id) stopQuietly();
    doc = d;
    docNow = d;
    readerState.doc = d.id;
    looking = shortTitle(d.title);
    secs.select('read');
    prefsBox.hidden = true;
    clear(found);
    clear(foundLine);
    q.value = '';
    paintHead();
    // (a book already open stays on the page while the next one loads; a slow load says what it is doing)
    const slow = setTimeout(() => me === opening && states([['Opening', `Opening “${shortTitle(d.title)}”…`]]), 150);
    let b: Book;
    try {
      const [loaded] = await Promise.all([loadBook(d), syncPlace(d.id, 900)]);
      b = loaded;
    } catch (e) {
      clearTimeout(slow);
      if (me !== opening) return;
      book = null;
      setBook(null);
      flow.replaceChildren();
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const m = String((e as Error)?.message ?? e);
      states([[offline ? 'Not on this phone' : 'Couldn’t open it', offline || /not on this phone/.test(m) ? `“${shortTitle(d.title)}” isn’t on this phone yet, so it opens when I can be reached. Next time you’re on Wi-Fi, Keep on this phone in About and it reads with no signal.` : `I couldn’t open “${shortTitle(d.title)}”: ${m}. Try again in a moment.`]]);
      paintBar();
      return;
    }
    clearTimeout(slow);
    if (me !== opening) return;
    book = b;
    setBook(b);
    states([]);
    drawBook();
    // where to open: what he asked for (a chapter, a page, a result), else his place, else the start
    let n = r.n;
    let off = r.off ?? 0;
    if (n === undefined && r.hitText) {
      const want = r.hitText.slice(0, 80);
      const k = b.passages.findIndex((p, i) => p.text.slice(0, 80) === want || (i > 0 && b.passages[i]!.text.length && r.hitText!.includes(p.text.slice(0, 60))));
      if (k >= 0) n = k;
    }
    const kept = placeOf(d.id);
    const fromKept = n === undefined && !!kept && !kept.done;
    if (n === undefined) {
      n = kept && !kept.done ? kept.n : 0;
      off = kept && !kept.done ? kept.off : 0;
    }
    const at = placeInfo(b, n, off);
    if (r.n !== undefined || r.hitText || !kept) setPlace(d.id, { n: at.n, off: at.off, page: at.page, pct: at.pct, done: false });
    if (r.terms?.length) {
      const el = drawPassage(b.passages[at.n]!, r.terms);
      el.classList.add('found');
      els[at.n]?.replaceWith(el);
      els[at.n] = el;
    }
    paintHead();
    paintBar();
    paintChapters();
    void paintAbout();
    if (mode() === 'pages') fitPages();
    else unfitPages();
    bringTo(at.n, at.off);
    // the words at his place painted: the open is timed to the frame after (the page's own clock, from his tap)
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    if (me !== opening) return;
    bringTo(at.n, at.off); // (a second look once the page has laid out)
    const ms = Math.round(performance.now() - r.t0);
    // opened at his place: the box snaps onto where he was, with the one tone (his sound setting honoured)
    const target = r.terms?.length ? els[at.n]?.querySelector('mark')?.parentElement ?? els[at.n] : paraAt(at.n, at.off);
    let tone = false;
    if (target && fromKept && !r.listen) tone = await recognise(box, target, { name: 'your place', again: true });
    else if (target && (r.terms?.length || r.n !== undefined)) void holdOn(target as HTMLElement);
    readerState.opens.push({ doc: d.id, ms, n: at.n, off: at.off, kept: fromKept, tone });
    if (r.listen && me === opening) {
      const s = reading.get();
      startReading(b, s.doc === d.id && r.n === undefined && canResume() ? { n: s.n, off: s.off } : { n: at.n, off: at.off }, { lead: r.listen.lead, only: r.listen.only, t0: r.t0 });
    }
  };

  // ---------------------------------------------------------------- following the phone
  readingPrefs.subscribe((p, prev) => {
    readerState.mode = p.mode;
    if (!book) return paintBar();
    const s = reading.get();
    const at = doc && s.doc === doc.id && s.state === 'reading' ? { n: s.n, off: s.off } : placeOf(doc!.id) ?? { n: 0, off: 0 };
    if (p.size !== prev.size) applyType();
    if (p.mode === 'pages') requestAnimationFrame(() => {
      fitPages();
      pagesTo(at.n, at.off);
    });
    else {
      unfitPages();
      requestAnimationFrame(() => scrollTo(at.n, at.off));
    }
    paintBar();
    void paintAbout();
  });
  addEventListener('resize', () => mode() === 'pages' && book && fitPages());
  places.subscribe(() => doc && paintHead());
  onCover((id) => {
    if (doc?.id === id) void paintAbout();
  });
  guardian.subscribe(() => stamp.refresh());
  addEventListener('online', () => stamp.refresh());
  addEventListener('offline', () => stamp.refresh());
  secs.el.addEventListener('click', () => requestAnimationFrame(() => {
    readerState.section = secs.current();
    // pages mode holds the page still under the pills: the other sections scroll as usual
    if (secs.current() === 'read' && mode() === 'pages') fitPages();
    else hud.style.overflowY = '';
  }));

  readerState.mode = mode();
  paintHead();
  paintBar();
  paintChapters();
  void paintAbout();
  states([['No book open', 'Pick a book on your Shelf and I’ll open it at your place. Say “read me” and its name and I’ll read it to you.']]);

  view = {
    open,
    enter() {
      void loadGuardian();
      stamp.refresh();
      if (pending) {
        const r = pending;
        pending = null;
        void open(r);
        return;
      }
      // opened from the jump bar or a link with no book named: the book he was reading last, at his place
      if (!doc) {
        void lastBook().then((d) => {
          if (d && !doc) void open({ doc: d, t0: performance.now() });
        });
      }
      else if (mode() === 'pages') requestAnimationFrame(() => fitPages());
    },
  };
  return {
    enter: () => view?.enter(),
    leave() {
      hud.style.overflowY = '';
    },
    open(arg: string) {
      const d = shelfDocs.get().docs.find((x) => x.id === arg);
      if (d) void open({ doc: d, t0: performance.now() });
    },
    describe: () => (doc ? `The reader: “${doc.title}”${book && placeOf(doc.id) ? `, ${placeInfo(book, placeOf(doc.id)!.n, placeOf(doc.id)!.off).words.toLowerCase()}` : ''}${reading.get().state === 'reading' ? ', reading it aloud' : ''}.` : 'The reader, no book open.'),
  };
}

// ---------------------------------------------------------------------------------------------------- the shelf, read here

/** The shelf: as the Library last read it, or read now (the brain's, or this phone's copy with no signal). */
async function shelfNow(): Promise<LibraryDoc[]> {
  const s = shelfDocs.get();
  if (s.docs.length && Date.now() - s.at < 5 * 60_000) return s.docs;
  try {
    const r = await brain.library();
    shelfDocs.set({ docs: r.docs, at: Date.now() });
    return r.docs;
  } catch {
    return s.docs;
  }
}
/** His own books (not my notebooks, not the built-in ones), the ones reading by words looks in first. */
export const hisBooks = (docs: LibraryDoc[]): LibraryDoc[] => docs.filter((d) => !d.builtin && !/^(read_|digest_|study_|notes_|project_|learn_|self_|yt_)/.test(d.id) && d.kind !== 'study' && d.kind !== 'digest');

/**
 * The book he is reading (the hub card's "Reading · The Hobbit", "Page · 42 of 300"): the one open in the reader, else his newest
 * place in the last month on a book not finished; null when there is none.
 */
export function readingNow(): { doc: LibraryDoc; place: Place } | null {
  const map = places.get().map;
  const docs = shelfDocs.get().docs;
  const open = docNow && map[docNow.id] && !map[docNow.id]!.done ? docNow : null;
  const d = open ?? hisBooks(docs).filter((x) => map[x.id] && !map[x.id]!.done && Date.now() - map[x.id]!.at < 30 * 86_400_000).sort((a, b) => map[b.id]!.at - map[a.id]!.at)[0];
  return d && map[d.id] ? { doc: d, place: map[d.id]! } : null;
}
/** The book he read last, finished or not (the hub card's "Last book"). */
export function lastRead(): LibraryDoc | null {
  const map = places.get().map;
  return hisBooks(shelfDocs.get().docs).filter((x) => map[x.id]).sort((a, b) => map[b.id]!.at - map[a.id]!.at)[0] ?? null;
}

/** The book he read last (his newest place among the books on the shelf). */
async function lastBook(): Promise<LibraryDoc | null> {
  const docs = await shelfNow();
  void syncPlaces();
  const map = places.get().map;
  const withPlace = docs.filter((d) => map[d.id]).sort((a, b) => map[b.id]!.at - map[a.id]!.at);
  return withPlace[0] ?? null;
}

// ---------------------------------------------------------------------------------------------------- reading by words

let lastStamp = 0;
const stampAt = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
/** His words and my answer in the conversation, answered here with no model ("Direct · no AI"). */
function answer(asked: string, reply: string, local?: LocalAnswer): void {
  const a = stampAt();
  const b = stampAt();
  chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text: asked, at: a }, { kind: 'assistant' as const, text: reply, at: b, model: 'Direct · no AI', ...(local ? { local } : {}) }].slice(-120), live: reply }));
}

/**
 * Reading by words, with no model (BRIEF-LIBRARY-READER 4): true when the words were about a book and are answered here.
 *  - "go on" / "carry on" just after the book was cut or stopped: on from the sentence he was in, after "Back to <it>.";
 *  - a plain "stop" while I read (or just after a cut): I stop and say the page; a harsh one stays the silent stop it always is;
 *  - "read me <book>" (his shelf's titles matched loosely), "carry on reading", "where were we", "read chapter 3", "read from page
 *    40", "just this chapter", "stop reading". A book he has not got: "I don't have that one. ADD it…" with the ADD button.
 */
export async function readingTurn(text: string, o: { voice?: boolean; speak?: boolean } = {}): Promise<boolean> {
  const t0 = performance.now();
  const s = reading.get();
  const aloud = o.speak !== false && settings.get().speak;
  // "go on" after the book was cut or stopped: the book, from the sentence he was in
  if (canResume() && s.state !== 'reading' && continueIntent(text)) {
    answer(text, `Back to ${shortTitle(s.title)}.`);
    if (aloud) resumeReading(t0);
    return true;
  }
  const stop = stopIntent(text);
  if (stop && (s.state === 'reading' || canResume())) {
    if (stop.harsh) {
      stopQuietly();
      return false;
    }
    const line = await stopReading(false);
    if (!line) return false;
    answer(text, line);
    if (aloud) await speak(line, { here: !readingPrefs.get().bookVoice });
    return true;
  }
  const ask = readingIntent(text);
  if (!ask) return false;
  const reply = (line: string, local?: LocalAnswer) => {
    answer(text, line, local);
    if (aloud) void speak(line, { here: true });
    return true;
  };
  if (ask.kind === 'stop') {
    const line = await stopReading(false);
    if (!line) return reply('I’m not reading anything just now.');
    answer(text, line);
    if (aloud) await speak(line, { here: !readingPrefs.get().bookVoice });
    return true;
  }
  if (ask.kind === 'only') {
    if (s.state === 'reading') {
      onlyThisChapter();
      answer(text, 'Just this chapter, then.');
      return true;
    }
    if (canResume()) {
      onlyThisChapter();
      answer(text, 'Just this chapter, then.');
      if (aloud) resumeReading(t0);
      return true;
    }
    return reply('I’m not reading anything just now. Say “read me” and a book’s name.');
  }
  const docs = await shelfNow();
  // the book: named, else the one in hand, else the last he read
  let d: LibraryDoc | null = null;
  if (ask.kind === 'book') {
    const mine = hisBooks(docs);
    const m = titleMatch(ask.words, mine) ?? titleMatch(ask.words, docs);
    if (!m) {
      if (!ask.plain) return false;
      return reply('I don’t have that one. ADD it to the library and I’ll read it.', { kind: 'pack', go: [{ id: 'library_add', ask: -1, label: 'ADD', run: 'library_add' }] });
    }
    d = m.book;
  } else {
    const inHand = bookNow();
    d = (inHand && docs.find((x) => x.id === inHand.id)) ?? docNow ?? (await lastBook());
    if (!d) return reply('We haven’t started a book yet. Say “read me” and a title, or pick one on your Shelf.');
  }
  // where to start: the chapter or page he named, his place (a finished book from the start), or where the cut left it
  let b: Book;
  try {
    b = await loadBook(d);
  } catch (e) {
    return reply(`I couldn’t open “${shortTitle(d.title)}”: ${(e as Error).message}.`);
  }
  const chapter = ask.kind === 'chapter' ? ask.n : ask.kind === 'book' ? ask.chapter : undefined;
  const pageNo = ask.kind === 'page' ? ask.n : ask.kind === 'book' ? ask.page : undefined;
  const only = (ask.kind === 'chapter' || ask.kind === 'book') && !!ask.only;
  let n: number | undefined;
  let lead = '';
  const name = shortTitle(d.title);
  if (chapter !== undefined) {
    const c = b.chapters[chapter - 1];
    if (!c || !b.byHeadings) return reply(b.byHeadings ? `“${name}” has ${b.chapters.length} chapter${b.chapters.length === 1 ? '' : 's'}.` : `“${name}” has no chapter headings of its own. Say “read from page” and a number${b.hasPages ? '' : ', or open it and pick a part'}.`);
    n = c.n;
    lead = `${name}, ${c.title}.`;
  } else if (pageNo !== undefined) {
    const k = pageStart(b, pageNo);
    if (k === null) return reply(b.hasPages ? `“${name}” has ${b.pages} pages.` : `“${name}” has no page numbers of its own. Say “read chapter” and a number instead.`);
    n = k;
    lead = `${name}, page ${b.passages[k]!.page}.`;
  }
  const kept = placeOf(d.id);
  if (n === undefined) {
    const s2 = reading.get();
    if (s2.doc === d.id && canResume()) lead = `Back to ${name}.`;
    else if (kept?.done) {
      setPlace(d.id, { n: 0, off: 0, page: b.passages[0]?.page ?? null, pct: 0, done: false });
      lead = `You finished ${name} ${whenWords(kept.at)}. From the start.`;
    } else if (kept) {
      const where = placeInfo(b, kept.n, kept.off);
      lead = ask.kind === 'resume' && /where were we/i.test(text) ? `We were ${where.page ? `on page ${where.page}` : `${Math.max(1, Math.round(where.pct * 100))}% of the way`} into ${name}, ${whenWords(kept.at)}.` : `${name}, ${where.page ? `page ${where.page}` : `${Math.max(1, Math.round(where.pct * 100))}% in`}.`;
    } else lead = `${name}, from the start.`;
  }
  answer(text, lead);
  await openBook(d, { ...(n !== undefined ? { n, off: 0 } : {}), ...(aloud ? { listen: { lead, only } } : {}), t0 });
  if (!aloud) toast(`“${name}” is open at your place. Tap Listen and I’ll read it to you.`);
  return true;
}

/** "That's all" (or the microphone let go) while a book is read or just after a cut: I stop and say where we are. */
export async function bookSignOff(words: string): Promise<boolean> {
  const s = reading.get();
  if (!(s.state === 'reading' || canResume())) return false;
  const line = await stopReading(false);
  if (!line) return false;
  if (words) answer(words, line);
  if (settings.get().speak) await speak(line, { here: !readingPrefs.get().bookVoice });
  return true;
}

/** The microphone let go after a cut (its tap ended the conversation): where we are, said once. */
export function micLetGo(): void {
  const s = reading.get();
  if (s.state === 'cut' && Date.now() - s.stoppedAt < CARRY_MS) void bookSignOff('');
}

// the ADD button under "I don't have that one": the Library, on ADD
register({
  id: 'library_add',
  title: 'Add a book to the library',
  hidden: true,
  run: () => void import('../../shell/launcher').then((l) => l.perform({ open: 'library', panel: 'ADD KNOWLEDGE' })),
});

// the jump bar finds his books by their names: "Read: The Lighthouse Keeper"
addPaletteProvider((q) => {
  const words = q.trim();
  if (words.length < 3) return [];
  const docs = hisBooks(shelfDocs.get().docs);
  const low = words.toLowerCase().replace(/^read\s+/, '');
  return docs
    .filter((d) => d.title.toLowerCase().includes(low) || (low.length >= 4 && titleMatch(low, [d])))
    .slice(0, 3)
    .map((d) => ({ id: `book_${d.id}`, title: `Read: ${d.title}`, group: 'BOOKS', words: d.author ?? '', run: () => void openBook(d) }));
});
