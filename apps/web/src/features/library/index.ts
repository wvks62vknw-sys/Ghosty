/**
 * LIBRARY tab: Ghosty's offline brain. Add books, PDFs, Word files, e-books, notes, web
 * pages, arXiv papers, CVEs and GitHub repositories; Ghosty keeps them forever and looks
 * things up in them before answering. ASK THE LIBRARY searches by keywords, or by meaning once
 * SEARCH BY MEANING is on this phone and its index is whole (library/meaning.ts) — its small print
 * says which, every time. SELF-STUDY shows
 * what Ghosty is learning on its own, one field at a time (the field he is reading, how far, the
 * time left at his pace, the fields after it), STUDY for a field picked from the list, the STUDY
 * ALL switch (go on to the next field by himself), what he learned today, the notes he wrote and
 * how his drills go; it takes the owner's focus, and exports every notebook to GitHub; any document on the shelf
 * opens in a reader. FRESH TODAY is the day's digest (the news, papers and events Ghosty
 * gathered this morning — DIGEST NOW gathers again).
 */
import type { LibraryDoc, LibraryHit } from '../../../../../packages/shared/src/protocol';
import { brain, lastSeen, mirrorLibraryNow, unreachable, type StudyInfo } from '../../api/brain';
import { shelf as deviceShelf } from '../../library/local';
import { meaningComplete, meaningIndex } from '../../library/meaning';
import { queryTerms, rareTerms } from '../../../../../packages/shared/src/meaning';
import { embedState } from '../../offline/embed';
import { clear, fmt, h, icon } from '../../core/dom';
import { ACCEPT } from '../../library/extract';
import { addFile, addPhotos, addText, isPhoto } from '../../library/upload';
import type { TabDef } from '../../shell/tabs';
import { bar, button, modal, pager, panel, row, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';

/** Each kind's glyph on the shelf (route C: a neutral glass tile per row). */
const PAGE = '<path d="M7 3.5h6.5l4 4V20a.5.5 0 01-.5.5H7a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z"/><path d="M13.5 3.5V8h4M9.5 12.5h5M9.5 16h5"/>';
const GLYPH: Record<string, string> = {
  pdf: PAGE, document: PAGE, text: PAGE, note: PAGE, notes: PAGE,
  book: '<path d="M4.5 5h5.5a2 2 0 012 2v12.5a1.6 1.6 0 00-1.6-1.6H4.5z"/><path d="M19.5 5H14a2 2 0 00-2 2v12.5a1.6 1.6 0 011.6-1.6h5.9z"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>',
  paper: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/>',
  cve: '<path d="M12 3.5l7 2.8v5.4c0 4.3-3 7.4-7 8.8-4-1.4-7-4.5-7-8.8V6.3z"/><path d="M12 8.5v4M12 15.5v.01"/>',
  code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/>',
  starter: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/>',
  study: '<circle cx="7" cy="14.5" r="3.5"/><circle cx="17" cy="14.5" r="3.5"/><path d="M10.5 14c1-.8 2-.8 3 0M3.5 14l1.8-6M20.5 14l-1.8-6"/>',
  digest: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16"/>',
  recon: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  project: '<path d="M3.5 7a1.5 1.5 0 011.5-1.5h4.2l2 2.2H19a1.5 1.5 0 011.5 1.5v8.3A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/>',
  manual: '<path d="M14.5 6.5a4 4 0 00-5.3 5.3L4 17v3h3l5.2-5.2a4 4 0 005.3-5.3l-2.3 2.3-2.6-.4-.4-2.6z"/>',
};
const KIND: Record<string, string> = { pdf: 'PDF', book: 'BOOK', document: 'DOC', notes: 'NOTES', text: 'TEXT', web: 'WEB', paper: 'PAPER', cve: 'CVE', code: 'CODE', starter: 'BUILT-IN', study: 'READ BY GHOSTY', digest: 'GHOSTY NOTES', scan: 'SCANNED', recon: 'RECON', note: 'NOTE', project: 'PROJECT', manual: 'MANUAL' };
/** A field in the brain's study summary (library/study.ts `studySummary`), with what STUDY at scale adds. */
interface FieldRow {
  id: string;
  name: string;
  topics: number;
  read: number;
  digested: number;
  focus: boolean;
  finished?: boolean;
  grown?: number;
}
/** The study state as the brain sends it now: the queue (one field at a time), its status line, STUDY ALL, what the outlines added. */
type StudyNow = StudyInfo & {
  all?: boolean;
  summary: StudyInfo['summary'] & {
    domains: FieldRow[];
    queue?: FieldRow[];
    current?: (FieldRow & { minutesLeft: number | null }) | null;
    status?: string;
    all?: boolean;
    finished?: number;
    grown?: { topics: number; latest: number };
    today: StudyInfo['summary']['today'] & { finished?: number };
  };
};
/** The STUDY ALL switch travels as FOCUS words (the brain's library/study.ts ALL_ON / ALL_OFF). */
const ALL_ON = 'study-all-on';
const ALL_OFF = 'study-all-off';
/** One passage of the day's digest (library/digest.ts in the brain): "YYYY-MM-DD · source". */
interface FreshItem {
  heading: string;
  text: string;
}

/** Ghosty's own notebooks (what he read, his notes, the day's digest, projects, courses, his own code): after the owner's documents on the shelf. */
const GHOSTYS = /^(read_|digest_|study_|notes_|project_|learn_|self_|yt_)/;
/** The searched words' stems (their first five letters at most, three at least: "plants" finds "plant"). */
const stemsOf = (terms: string[]) => terms.map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
/** Every searched word starts a word somewhere in the text. */
function hasAll(text: string, terms: string[]): boolean {
  const low = text.toLowerCase();
  return !!terms.length && stemsOf(terms).every((s) => new RegExp(`(^|[^a-z0-9])${esc(s)}`).test(low));
}
/** About `max` characters of a passage around the first searched word (on one line, cut at spaces, … where cut). */
function around(text: string, terms: string[], max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const low = flat.toLowerCase();
  const first = Math.min(...stemsOf(terms).map((s) => low.search(new RegExp(`(^|[^a-z0-9])${esc(s)}`))).filter((i) => i >= 0), Infinity);
  let start = Number.isFinite(first) ? Math.max(0, first - 90) : 0;
  if (start > 0) start = flat.indexOf(' ', start) + 1 || start;
  let end = Math.min(flat.length, start + max);
  if (end < flat.length) end = Math.max(flat.lastIndexOf(' ', end), start + Math.round(max / 2));
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}
/**
 * A passage as running text: a PDF's lines (and a photo's) break where the page's edge was, so a line that does not
 * end a sentence joins the next when that one carries on in lower case ("worth\nreading twice" → "worth reading
 * twice"), and a word split by a hyphen at a line end is whole again. Headings, lists and paragraphs stay as they are.
 */
function flowing(text: string): string {
  return text.replace(/(\p{L}{2,})-\n(?=\p{Ll})/gu, '$1').replace(/([^\n.!?:;])[ \t]*\n(?=[ \t]*\p{Ll})/gu, '$1 ');
}

/** The text with every word that starts with a searched word in a <mark> (text nodes only, never HTML). */
function marked(text: string, terms: string[]): Node[] {
  const stems = stemsOf(terms);
  if (!stems.length) return [document.createTextNode(text)];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${stems.map(esc).join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const out: Node[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push(document.createTextNode(text.slice(at, m.index)));
    out.push(h('mark', m[0]));
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(document.createTextNode(text.slice(at)));
  return out;
}

export const libraryTab: TabDef = {
  id: 'library',
  title: 'LIBRARY',
  icon: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
  scene: 'backdrop',
  blurb: 'ask the offline brain · add books & PDFs',
  now: () => (lastSeen.get().passages != null ? `${fmt.n(lastSeen.get().passages)} passages` : ''),
  mount(root) {
    const P = page(root, { tag: 'LIBRARY // OFFLINE BRAIN', sub: 'everything Ghosty has read — searched on this phone too', leftLabel: 'ASK', rightLabel: 'ADD & SHELF', stack: true });
    let docs: LibraryDoc[] = [];
    /** Removed with the UNDO bar still up: off the shelf, not yet off the brain. */
    const leaving = new Set<string>();

    // ---- add knowledge
    const ap = panel('ADD KNOWLEDGE', { grow: false, cls: 'libadd' });
    const fileInput = h('input', { type: 'file', multiple: true, accept: ACCEPT, style: { display: 'none' }, 'aria-label': 'Choose files for the library' });
    // (route C words it for a phone, where nothing is dropped: the tile is tapped)
    const drop = h('div.drop', { tabIndex: 0, role: 'button', 'aria-label': 'Add files to the library' },
      h('i.dropic', icon('<path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9"/><path d="M4.5 14.5v3a2 2 0 002 2h11a2 2 0 002-2v-3"/>')),
      h('b', { dataset: { label: 'Add a PDF, a photo of a page or a file' } }, 'DROP PDFS, PHOTOS OF PAGES & FILES HERE'),
      h('span', { dataset: { label: 'Tap to choose · photos are read on this phone · PDF, Word, EPUB, web pages, text, CSV, code' } }, 'or tap to choose · photos are read on this phone · PDF, Word, EPUB, web pages, text, CSV/JSON, code'));
    const log = h('div.liblog');
    const busy = { n: 0 };
    const note = (text: string, kind: '' | 'ok' | 'bad' = '') => {
      const r = h(`div.note${kind ? `.${kind}` : ''}` as 'div', text);
      log.prepend(r);
      while (log.children.length > 6) log.lastChild!.remove();
      return r;
    };
    /** What a finished import leaves: what is on the shelf now and how big, where it is kept, anything to know, and OPEN. */
    const saved = (line: HTMLElement, doc: LibraryDoc, extra = '') => {
      const size = doc.pages > 1 ? `${fmt.n(doc.pages)} pages` : `${fmt.n(doc.passages)} passage${doc.passages === 1 ? '' : 's'}`;
      const here = doc.id.startsWith('local-') ? '; kept on this phone and searchable now, sent to Ghosty when he can be reached' : '';
      clear(line, h('span', `✓ ${doc.title} saved on the shelf (${size})${here}${extra ? `. ${extra}` : ''}`), button('OPEN', () => openDoc(doc), 'libopen'));
      line.className = 'note ok done';
    };
    /** What went wrong, in his words: a scan with no converter says what works instead (photos are read here). */
    const failed = (line: HTMLElement, name: string, e: unknown) => {
      const m = String((e as Error)?.message ?? e);
      line.textContent = `✕ ${name}: ${/Workers AI/.test(m) ? 'it looks like pictures of pages (a scan), and there is no converter for scans set up. Take photos of the pages instead: the Library reads photos on this phone.' : m}`;
      line.className = 'note bad';
    };
    const ingest = async (picked: File[]) => {
      // Photos of pages picked together are one document (a page per photo); every other file is its own.
      const photos = picked.filter(isPhoto);
      const jobs: { name: string; add: (p: (t: string) => void) => Promise<{ doc: LibraryDoc; warning?: string }> }[] = [
        ...(photos.length ? [{ name: photos.length === 1 ? photos[0]!.name : `${photos.length} photos`, add: (p: (t: string) => void) => addPhotos(photos, p) }] : []),
        ...picked.filter((f) => !isPhoto(f)).map((f) => ({ name: f.name, add: (p: (t: string) => void) => addFile(f, p) })),
      ];
      for (const f of jobs) {
        const line = note(`${f.name}: reading…`);
        busy.n++;
        try {
          const { doc, warning } = await f.add((t) => (line.textContent = `${f.name}: ${t}`));
          saved(line, doc, warning ? warning.charAt(0).toUpperCase() + warning.slice(1) : '');
        } catch (e) {
          failed(line, f.name, e);
        } finally {
          busy.n--;
        }
        void refresh();
      }
    };
    fileInput.addEventListener('change', () => {
      const files = [...(fileInput.files ?? [])];
      fileInput.value = '';
      void ingest(files);
    });
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click());
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('on');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('on'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('on');
      void ingest([...(e.dataTransfer?.files ?? [])]);
    });

    const src = h('input', { placeholder: 'A web address: a page, a paper, a book', 'aria-label': 'Import from the web' });
    const doImport = async () => {
      const s = src.value.trim();
      if (!s) return;
      src.value = '';
      const line = note(`${s}: importing…`);
      try {
        const r = await brain.libraryImport(s);
        saved(line, r.doc, r.note);
      } catch (e) {
        failed(line, s, e);
      }
      void refresh();
    };
    src.addEventListener('keydown', (e) => e.key === 'Enter' && void doImport());

    // Ghosty's own code and architecture, so it understands exactly how it works
    const readSelf = async () => {
      const line = note('reading my own source code…');
      let offset = 0;
      try {
        for (let round = 0; round < 40; round++) {
          const r = await brain.libraryImport('self', offset);
          line.textContent = `reading my own source code… ${r.note}`;
          if (r.next === null || r.next === undefined) break;
          offset = r.next;
        }
        line.textContent = '✓ my own source code is in the library — it is re-read after every shipped change';
        line.className = 'note ok';
      } catch (e) {
        line.textContent = `✕ ${(e as Error).message}`;
        line.className = 'note bad';
      }
      void refresh();
    };

    const tTitle = h('input', { placeholder: 'Title (optional)', 'aria-label': 'Title of the text' });
    const tBody = h('textarea', { rows: 3, placeholder: 'Paste notes, an article, instructions, code…', 'aria-label': 'Text to save' });
    const saveText = async () => {
      const t = tBody.value.trim();
      if (!t) return;
      const line = note('saving text…');
      try {
        const d = await addText(tTitle.value, t, () => undefined);
        tBody.value = '';
        tTitle.value = '';
        saved(line, d);
      } catch (e) {
        failed(line, 'Text', e);
      }
      void refresh();
    };
    // One thing to do here (the tile); a web address, pasted text and Ghosty's own code wait behind MORE WAYS TO ADD.
    const moreWays = h('div.libmore', { hidden: true },
      h('div.lab', 'IMPORT FROM THE WEB'),
      h('div.keyrow', src, button('IMPORT', () => void doImport())),
      h('div.lab', 'OR PASTE TEXT'),
      tTitle,
      tBody,
      h('div.keyrow', button('SAVE TEXT', () => void saveText())),
      h('div.keyrow', button('READ MY OWN CODE', () => void readSelf()), h('span.note', 'Ghosty reads its own source and architecture.')),
    );
    const moreBtn = button('MORE WAYS TO ADD', (b) => {
      moreWays.hidden = !moreWays.hidden;
      b.textContent = moreWays.hidden ? 'MORE WAYS TO ADD' : 'FEWER WAYS';
      b.setAttribute('aria-expanded', String(!moreWays.hidden));
    }, 'libmorebtn');
    moreBtn.setAttribute('aria-expanded', 'false');
    ap.body.append(fileInput, drop, log, h('div.keyrow', moreBtn, h('span.note', 'a web address or pasted text')), moreWays);

    // ---- ask (no AI): the whole first column, results scroll
    // The small print says how the results were found: "by meaning" or "by keywords", honestly (library/meaning.ts).
    const byWhat = () => (meaningComplete() ? 'by meaning' : 'by keywords');
    const sp = panel('ASK THE LIBRARY', { status: byWhat(), cls: 'ask' });
    const q = h('input.askq', { type: 'search', placeholder: 'Ask anything Ghosty has read…', enterKeyHint: 'search', 'aria-label': 'Search the library' });
    /** A result: where it is, the words around the first one searched for with the searched words marked; a tap opens it in the reader there. */
    const hitRow = (x: LibraryHit, terms: string[]) => {
      const where = [x.title, x.heading && x.heading !== x.title ? x.heading : '', x.page ? `p. ${x.page}` : ''].filter(Boolean).join(' · ');
      const r = h('div.rw.wrap.hit', { tabIndex: 0, role: 'button', 'aria-label': `Open ${x.title} here` }, h('span.k', where), h('span.v', ...marked(around(x.text, terms), terms)));
      const open = () => openDoc(docs.find((d) => d.id === x.doc) ?? { id: x.doc, title: x.title, source: '', kind: '', pages: 0, passages: 0, chars: 0, status: 'ready', builtin: false, at: 0 }, { text: x.text, terms });
      r.addEventListener('click', open);
      r.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
      return r;
    };
    // Before a search: his own last searches (kept on this phone only), or a few the built-in books answer.
    const TRY = ['Binary search', 'Famous security bugs', 'Reinforcement learning'];
    const RECENT = 'ghosty.library.recent';
    const recent = (): string[] => {
      try {
        const v: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5) : [];
      } catch {
        return [];
      }
    };
    const keepRecent = (list: string[]) => {
      try {
        if (list.length) localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 5)));
        else localStorage.removeItem(RECENT);
      } catch {
        /* private browsing: nothing kept */
      }
    };
    /** What a search will be ranked by, in a line: by meaning (and that it stays on the phone), or by keywords and why. */
    const howLine = () => {
      const ix = meaningIndex.get();
      if (meaningComplete()) return `Found by what they mean, not only their words: a small model on this phone does it, and nothing is sent anywhere (${fmt.n(Math.min(ix.indexed, ix.total))} of ${fmt.n(ix.total)} passages ready).`;
      if (embedState.get().downloaded && ix.total) return `Found by their words for now: ${fmt.n(Math.min(ix.indexed, ix.total))} of ${fmt.n(ix.total)} passages are ready to be found by meaning.`;
      return 'Found by their words. Turn on SEARCH BY MEANING in Settings → Offline brain to find passages by what they mean too.';
    };
    const idle = () => {
      const mine = recent();
      const chip = (t: string) => button(t, () => {
        q.value = t;
        void search();
      });
      const clearAll = button('Clear', () => {
        keepRecent([]);
        idle();
      }, 'clear');
      clearAll.setAttribute('aria-label', 'Clear recent searches');
      clear(sp.body, h('div.note', 'Everything on the shelf, searched in a moment. It works on this phone with no connection too.'), h('div.note.askhow', howLine()),
        h('div.lab', mine.length ? 'RECENT' : 'TRY'), h('div.tabs.trychips', ...(mine.length ? mine : TRY).map(chip), mine.length ? clearAll : ''));
      sp.setStatus(byWhat(), 'ok');
    };
    // The line before any search keeps up with the index as it fills.
    meaningIndex.subscribe(() => {
      const line = sp.body.querySelector('.askhow');
      if (line) {
        line.textContent = howLine();
        sp.setStatus(byWhat(), 'ok');
      }
    });
    const search = async () => {
      const t = q.value.trim();
      if (!t) return idle();
      sp.setStatus('searching…', 'mid');
      try {
        const r = await brain.librarySearch(t, 20);
        const terms = queryTerms(t);
        // Only what really matches: the brain's own verdict, or every word that says what is asked there (one short
        // word, "ATP", is enough when he typed it himself). Passages sharing only everyday words are left out.
        const good = r.hits.filter((x) => x.relevant || hasAll(`${x.title} ${x.heading} ${x.text}`, rareTerms(terms)));
        // a search that found something is kept for next time (RECENT), on this phone only
        if (good.length) keepRecent([t, ...recent().filter((x) => x.toLowerCase() !== t.toLowerCase())]);
        clear(sp.body, ...(good.length ? good.map((x) => hitRow(x, terms)) : [h('div.note.nohits', `Nothing in the library mentions “${t}”. Try fewer or other words${meaningComplete() ? '' : ', or turn on SEARCH BY MEANING in Settings → Offline brain to find passages by what they mean'}.`)]));
        sp.body.scrollTop = 0;
        // By meaning with a few new passages not indexed yet: those were found by their words, and it says so.
        sp.setStatus(`${good.length} passage${good.length === 1 ? '' : 's'} · by ${r.how === 'meaning' ? 'meaning' : 'keywords'}${r.how === 'meaning' && r.unindexed ? ` · ${fmt.n(r.unindexed)} newest by keywords` : ''}${isOffline() ? ' · on this phone' : ''}`, 'ok');
      } catch (e) {
        sp.setStatus('OFFLINE', 'off');
        toast(`Library: ${(e as Error).message}`, 'warn');
      }
    };
    q.addEventListener('keydown', (e) => e.key === 'Enter' && void search());
    q.addEventListener('search', () => !q.value && idle());
    sp.el.insertBefore(h('div.keyrow.askrow', q, button('ASK', () => void search(), 'on')), sp.body);
    idle();
    P.left.append(sp.el);

    // ---- shelf
    const shelf = panel('SHELF', { footer: true, cls: 'shelf' });
    // A row each: the kind's glyph on a glass tile, the title with its kind under it, how many passages, a chevron.
    // (Removing a document is in its reader: REMOVE FROM LIBRARY.)
    // His own documents first (newest first), then Ghosty's notebooks, then the built-in ones; FIND narrows by name.
    const find = h('input.shelffind', { type: 'search', placeholder: 'Find on the shelf', enterKeyHint: 'search', 'aria-label': 'Find on the shelf' });
    const findRow = h('div.keyrow.shelffindrow', find);
    shelf.el.insertBefore(findRow, shelf.body);
    const whose = (d: LibraryDoc) => (d.builtin ? 2 : GHOSTYS.test(d.id) || d.kind === 'study' || d.kind === 'digest' ? 1 : 0);
    const paintShelf = () => {
      const words = find.value.trim().toLowerCase();
      const here = docs.filter((x) => !leaving.has(x.id));
      const shown = here.filter((d) => !words || `${d.title} ${d.source} ${KIND[d.kind] ?? d.kind}`.toLowerCase().includes(words)).sort((a, b) => whose(a) - whose(b) || b.at - a.at);
      shelfList.set(shown);
      findRow.hidden = here.length <= 8 && !words;
      shelf.setStatus(words ? `${shown.length} OF ${here.length}` : `${here.length} DOCS`, 'ok');
      if (words && !shown.length) clear(shelf.body, h('div.note', `Nothing on the shelf is called “${find.value.trim()}”.`));
    };
    find.addEventListener('input', paintShelf);
    const shelfList = pager(shelf, 46, (d: LibraryDoc) => {
      const r = row(KIND[d.kind] ?? d.kind.toUpperCase(), d.title, fmt.n(d.passages), { wrap: true, onClick: () => openDoc(d) });
      r.prepend(h('span.libtile', { 'aria-hidden': 'true' }, icon(GLYPH[d.kind] ?? PAGE)));
      (r.lastChild as HTMLElement).title = `${d.passages} passage${d.passages === 1 ? '' : 's'}`;
      return r;
    }, () => 'SYNC', 'Add a book or a file above, or import a page from the web: it is on the shelf in seconds.');
    // ---- GADGETS: the manuals the brain found for his gadgets (gadget_manual), each with where it came from and its licence
    const gadgets = panel('GADGETS', { grow: false, cls: 'gadgets' });
    const paintGadgets = (list: LibraryDoc[]) => {
      const manuals = list.filter((d) => d.kind === 'manual');
      gadgets.setStatus(manuals.length ? `${manuals.length} MANUAL${manuals.length === 1 ? '' : 'S'}` : 'NONE YET', manuals.length ? 'ok' : 'off');
      clear(gadgets.body, ...(manuals.length
        ? manuals.map((d) => {
          const [url = '', licence = ''] = d.source.split(' · ');
          let host = url;
          try {
            host = new URL(url).hostname.replace(/^www\./, '');
          } catch {
            /* not an address: shown as it is */
          }
          const r = row(`from ${host}${licence ? ` · ${licence}` : ''}`, d.title, fmt.n(d.passages), { wrap: true, onClick: () => openDoc(d) });
          r.classList.add('gadgetrow');
          // where it came from and its licence, as written (no sentence case: "© Bosch")
          (r.querySelector('.k') as HTMLElement | null)?.setAttribute('data-case', 'keep');
          r.prepend(h('span.libtile', { 'aria-hidden': 'true' }, icon(GLYPH.manual!)));
          return r;
        })
        : [h('div.note', 'Ask in the chat: "find the manual for my Bosch dishwasher SMS24AW01G" (the model number is on the rating plate; Lens READ can read it). Ghosty looks on the maker\'s own site first, keeps the manual here, and answers fault codes from its pages.')]));
    };
    // ---- the reader: any document on the shelf, passage by passage (Ghosty's notebooks included)
    // (`at`: a search result: the reader reads on until it reaches that passage, shows it marked, and scrolls to it)
    const openDoc = (d: LibraryDoc, at?: { text: string; terms: string[] }) => {
      const body = h('div.reader');
      const more = button('MORE', () => void load(), 'on');
      let after = 0;
      let last = '';
      let lastPage: number | null = null;
      let found: HTMLElement | null = null;
      const prose = d.kind !== 'code';
      const load = async () => {
        more.disabled = true;
        try {
          const r = await brain.libraryPassages(d.id, after);
          for (const p of r.passages) {
            // where a new page of the book starts, its number (a PDF knows each passage's page)
            if (p.page && p.page !== lastPage && (d.pages > 1 || lastPage !== null)) body.append(h('div.pgmark', { dataset: { case: 'keep' } }, `Page ${p.page}`));
            if (p.page) lastPage = p.page;
            if (p.heading && p.heading !== last) {
              body.append(h('h4', p.heading));
              last = p.heading;
            }
            const text = prose ? flowing(p.text) : p.text;
            const para = h('p', text);
            if (at && !found && (p.text === at.text || p.text.slice(0, 80) === at.text.slice(0, 80))) {
              found = para;
              para.className = 'here';
              clear(para, ...marked(text, at.terms));
            }
            body.append(para);
          }
          if (r.next === null) more.remove();
          else {
            after = r.next;
            more.disabled = false;
          }
          return r.next !== null;
        } catch (e) {
          body.append(h('div.note.bad', `Could not read it: ${(e as Error).message}`));
          more.remove();
          return false;
        }
      };
      // what it is as chips (kind, where from, how many passages), then the passages to read; REMOVE for his own
      const kind = (KIND[d.kind] ?? d.kind).toLowerCase().replace(/\b(pdf|cve)\b/g, (x) => x.toUpperCase()).replace(/\bghosty\b/g, 'Ghosty');
      const meta = h('div.readmeta', { dataset: { case: 'keep' } },
        kind ? h('span.chip', { dataset: { case: 'keep' } }, kind.charAt(0).toUpperCase() + kind.slice(1)) : '',
        d.source ? h('span.chip.src', { dataset: { case: 'keep' } }, d.source) : '',
        d.pages > 1 ? h('span.chip', { dataset: { case: 'keep' } }, `${fmt.n(d.pages)} pages`) : d.passages ? h('span.chip', { dataset: { case: 'keep' } }, `${fmt.n(d.passages)} passage${d.passages === 1 ? '' : 's'}`) : '');
      // Off the shelf at once with UNDO; removed from the brain and this phone only when the bar goes, so UNDO
      // brings it back exactly as it was (its passages, its meaning index, where it came from).
      const remove = d.builtin ? null : button('REMOVE FROM LIBRARY', () => {
        m.close();
        leaving.add(d.id);
        paintShelf();
        undo(
          `Removed: “${d.title}”`,
          () => {
            leaving.delete(d.id);
            paintShelf();
            toast(`Back in the library: ${d.title}`, 'ok');
          },
          async () => {
            await brain.libraryRemove(d.id).catch(() => toast(`Could not remove “${d.title}”`, 'bad'));
            leaving.delete(d.id);
            void refresh();
          },
        );
      }, 'warn readrm');
      const m = modal(d.title, h('div.readwrap', meta, body, h('div.keyrow', more, remove)));
      void (async () => {
        // a search result far into a long book: read on to it (up to 3,000 passages), then bring it into view
        for (let round = 0; round < 10 && (await load()) && at && !found; round++);
        if (found) (found as HTMLElement).scrollIntoView({ block: 'center' });
      })();
    };

    // ---- self-study: Ghosty studies on its own, around the clock, within the free plan — one field at a time
    const study = panel('SELF-STUDY', { grow: false, cls: 'study' });
    let allFields = false;
    const focusIn = h('input', { placeholder: 'Put first: e.g. physics, finance, Swift · "none" clears', 'aria-label': 'Fields to study first' });
    const pick = h('select', { 'aria-label': 'Field to study' });
    // The owner's pick outlives every repaint (the FOCUS reply, a status answer landing late, STUDY's own): a repaint
    // used to put the picker back on the field being read, so a STUDY tapped after a pick could send that field instead.
    let ownPick = '';
    pick.addEventListener('change', () => {
      ownPick = pick.value;
      study.body.querySelectorAll('.studyfields .bar').forEach((x) => x.classList.toggle('picked', (x as HTMLElement).dataset.id === pick.value));
    });
    /** The last study state shown (painted again when the phone goes offline or comes back). */
    let lastStudy: StudyNow | null = null;
    const paintStudy = (st: StudyNow | null) => {
      clear(study.body);
      lastStudy = st;
      if (!st) {
        study.setStatus('OFFLINE', 'off');
        study.body.append(h('div.note', 'Ghosty can’t be reached right now, so his self-study can’t be shown. It comes back by itself.'));
        return;
      }
      // No connection: what he was reading when last seen, said so, and nothing to press that cannot work now.
      const off = isOffline();
      const sum = st.summary;
      const doms = sum.domains as FieldRow[];
      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
      study.setStatus(off ? 'OFFLINE' : st.on ? 'LEARNING' : 'OFF', off ? 'off' : st.on ? 'ok' : 'mid');
      const weakest = sum.drills.skills.filter((k) => k.n >= 2).slice(0, 3).map((k) => `${k.skill} ${pct(k.right, k.n)}%`).join(' · ');
      const lastText = !st.last ? '' : st.last.error ? `${st.last.topic} — ${st.last.error}` : st.last.kind === 'drill' ? `${st.last.topic}: ${st.last.title ?? ''}` : st.last.kind === 'digest' ? `wrote notes on ${st.last.topic}` : `read ${st.last.topic}${st.last.passages ? ` (${st.last.passages} passages)` : ''}`;
      const fields = [...doms].sort((a, b) => Number(b.focus) - Number(a.focus) || b.read - a.read || a.name.localeCompare(b.name));
      const shown = allFields ? fields : fields.slice(0, 5);
      const focusNames = st.focus.map((id) => doms.find((d) => d.id === id)?.name ?? id);
      const all = sum.all ?? st.all ?? true;
      const cur = sum.current ?? null;
      const later = (sum.queue ?? []).slice(1, 5);
      // the topic picker: every field in the curriculum's order, its progress, ✓ once read to the end
      clear(pick, ...doms.map((d) => h('option', { value: d.id }, `${d.name} · ${d.read} of ${d.topics}${d.finished ? ' ✓' : ''}`)));
      pick.value = (ownPick && doms.some((d) => d.id === ownPick) ? ownPick : null) ?? cur?.id ?? doms[0]?.id ?? '';
      const studyNow = async (b: HTMLButtonElement) => {
        const id = pick.value;
        const row = doms.find((d) => d.id === id);
        if (!row) return;
        b.disabled = true;
        study.setStatus('STUDYING…', 'mid');
        const others = st.focus.filter((f) => f !== id);
        // A finished field that is already first: take it out and put it back, so the brain reads it again (he asked).
        if (row.finished && st.focus.includes(id)) await brain.study({ focus: others.length ? others.join(', ') : 'none' }).catch(() => null);
        const r = await brain.study({ focus: [id, ...others].slice(0, 5).join(', '), now: true }).catch(() => null);
        if (r?.did) toast(`${row.name}: ${r.did.reads} read just now · the rest follows on its own`, 'ok');
        else toast('Ghosty could not be reached — try again in a moment', 'bad');
        paintStudy(((await brain.studyStatus().catch(() => r)) as StudyNow | null) ?? null);
        void refresh();
      };
      const allSwitch = button(`STUDY ALL: ${all ? 'ON' : 'OFF'}`, async (b) => {
        b.disabled = true;
        // the switch, then the focus as it is (FOCUS words carry both)
        await brain.study({ focus: [all ? ALL_OFF : ALL_ON, ...st.focus.slice(0, 5)].join(', ') }).catch(() => null);
        paintStudy(((await brain.studyStatus().catch(() => null)) as StudyNow | null) ?? null);
      }, `studyall${all ? ' on' : ''}`);
      allSwitch.setAttribute('role', 'switch');
      allSwitch.dataset.label = 'Study all'; // route C: the words beside a switch
      allSwitch.setAttribute('aria-checked', String(all));
      const today = sum.today;
      study.body.append(
        // what he is reading now, honestly: "Reading Algebra · 212 of 480 · about 40 minutes left at this pace"
        h('div.studynow', h('b', off ? `You’re offline. When Ghosty was last reached: ${sum.status ?? (st.on ? 'learning' : 'switched off')}. He keeps reading on his side; this updates when you’re back.` : sum.status ?? (st.on ? 'Learning' : 'Switched off')), cur ? bar('NOW', cur.read / Math.max(1, cur.topics), `${cur.read}/${cur.topics}`, '#ffd24d') : ''),
        later.length ? row('THEN', later.map((d) => `${d.name} ${d.read}/${d.topics}`).join(' · '), null, { wrap: true }) : '',
        off ? '' : h('div.keyrow.studypick', pick, st.on ? button('STUDY', (b) => void studyNow(b), 'on') : ''),
        off ? '' : h('div.keyrow.studyallrow', allSwitch, h('span.note', all ? 'When a field is done, he starts the next one by himself.' : 'He reads only the fields you send with STUDY.')),
        // what he learned today: three numbers, large
        h('div.studytoday', { dataset: { case: 'keep' } }, h('small', 'Learned today'),
          h('div', h('span', h('b', fmt.n(today.reads)), h('em', 'pieces read')), h('span', h('b', fmt.n(today.finished ?? 0)), h('em', 'topics finished')), h('span', h('b', fmt.n(today.digests)), h('em', 'notes written')))),
        bar('READ', sum.read / Math.max(1, sum.topics), `${fmt.n(sum.read)} / ${fmt.n(sum.topics)} topics`, '#5ce1ff'),
        bar('NOTES', sum.digested / Math.max(1, sum.topics), `${fmt.n(sum.digested)} written${sum.pending ? ` · ${sum.pending} waiting for a model` : ''}`, '#52f2b5'),
        sum.grown?.topics ? row('MORE TO READ', `${fmt.n(sum.grown.topics)} topics found in Wikipedia's outlines`, `+${fmt.n(sum.grown.latest)}`, { wrap: true }) : '',
        // from the basics up: each field is read beginner → intermediate → advanced
        sum.levels ? row('LEVELS', sum.levels.map((l) => `${l.level} ${pct(l.read, l.topics)}%`).join(' · '), null, { wrap: true }) : '',
        row('DRILLS', sum.drills.asked ? `${sum.drills.right} of ${sum.drills.asked} right · ${pct(sum.drills.right, sum.drills.asked)}%` : 'none yet', weakest ? `weakest: ${weakest}` : null, { wrap: true, tone: sum.drills.asked && pct(sum.drills.right, sum.drills.asked) < 60 ? 'dn' : 'up' }),
        st.last ? row('LAST', lastText, fmt.ago(st.last.at), { wrap: true, ...(st.last.error ? { tone: 'bad' as const } : {}) }) : '',
        st.gaps.length ? row('YOUR QUESTIONS', st.gaps.slice(-3).join(' · '), String(st.gaps.length), { wrap: true }) : '',
        st.on && st.next ? row('NEXT', new Date(st.next).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), `${st.sessions} sessions`) : row('SESSIONS', String(st.sessions)),
        h('div.lab', 'FIELDS'),
        // the fields as a list that picks: a tap chooses the field STUDY sends (the picker above follows)
        h('div.studyfields', ...shown.map((d) => {
          const b = bar(`${d.focus ? '★ ' : ''}${d.finished ? '✓ ' : ''}${d.name}`, d.read / Math.max(1, d.topics), `${d.read}/${d.topics}`, d.focus ? '#ffd24d' : undefined);
          b.dataset.id = d.id;
          b.tabIndex = 0;
          b.setAttribute('role', 'button');
          b.setAttribute('aria-label', `Pick ${d.name}: ${d.read} of ${d.topics} read`);
          b.classList.toggle('picked', d.id === pick.value);
          const choose = () => {
            pick.value = d.id;
            ownPick = d.id;
            study.body.querySelectorAll('.studyfields .bar').forEach((x) => x.classList.toggle('picked', (x as HTMLElement).dataset.id === d.id));
          };
          b.addEventListener('click', choose);
          b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && choose());
          return b;
        })),
        fields.length > 5
          ? h('div.keyrow', button(allFields ? 'FEWER' : `ALL ${fields.length} FIELDS`, () => {
            allFields = !allFields;
            paintStudy(st);
          }))
          : '',
        focusNames.length ? row('FIRST', focusNames.join(', '), '★', { wrap: true }) : '',
        off ? '' : h('div.keyrow', focusIn, button('FOCUS', async () => {
          const words = focusIn.value.trim();
          if (!words) return;
          focusIn.value = '';
          const r = await brain.study({ focus: words }).catch(() => null);
          if (r && !r.focus.length && !/^(none|off|clear|-)$/i.test(words)) toast('No field by that name — the FIELDS list has them all', 'warn');
          paintStudy(r ? ((await brain.studyStatus().catch(() => r)) as StudyNow) : null);
        })),
        off ? '' : h('div.keyrow.wrapit',
          button(st.on ? 'TURN OFF' : 'TURN ON', async () => paintStudy((await brain.study({ on: !st.on }).then(() => brain.studyStatus()).catch(() => null)) as StudyNow | null), st.on ? 'warn' : 'on'),
          button('EXPORT TO GITHUB', async (b) => {
            // Every notebook as Markdown on the "library" branch of Ghosty's own repository: free, off the phone, readable anywhere.
            b.disabled = true;
            const line = h('div.note', 'exporting…');
            b.parentElement!.after(line);
            try {
              let offset = 0;
              let total = 0;
              let r = await brain.libraryExport(0);
              total += r.files;
              for (let guard = 0; guard < 25 && r.left > 0; guard++) {
                offset += r.files;
                line.textContent = `exporting… ${total} notebooks written, ${r.left} to go`;
                r = await brain.libraryExport(offset);
                total += r.files;
              }
              clear(line, `✓ ${total} notebook${total === 1 ? '' : 's'} on GitHub: `, h('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.url.replace(/^https:\/\//, '')));
              line.className = 'note ok';
            } catch (e) {
              line.textContent = `✕ ${(e as Error).message}`;
              line.className = 'note bad';
            } finally {
              b.disabled = false;
            }
          }),
        ),
      );
    };
    // ---- fresh today: the morning digest (BBC, Hacker News, arXiv, Wikipedia's current events, the day in three levels)
    const fresh = panel('FRESH TODAY', { footer: true, status: '', cls: 'fresh' });
    const freshRow = (p: FreshItem) => {
      const source = p.heading.replace(/^\d{4}-\d{2}-\d{2} · /, '');
      const body = p.text.split('\n').slice(1).join(' ').replace(/\s+/g, ' ');
      return row(source, body, '›', { wrap: true, onClick: () => modal(p.heading, h('div.readwrap', h('div.reader', ...p.text.split('\n').map((line) => h('p', line))))) });
    };
    const freshList = pager(fresh, 46, freshRow, () => 'NONE YET', 'Tap Digest now and he gathers today’s news, papers and events.');
    const paintFresh = async () => {
      try {
        const all: FreshItem[] = [];
        let after = 0;
        for (let i = 0; i < 6; i++) {
          const r = await brain.libraryPassages('notes_daily', after);
          all.push(...r.passages);
          if (r.next === null) break;
          after = r.next;
        }
        const day = all.reduce((d, p) => (p.heading.slice(0, 10) > d ? p.heading.slice(0, 10) : d), '');
        const today = all.filter((p) => p.heading.startsWith(day));
        fresh.setStatus(day || 'NOTHING YET', day ? 'ok' : 'mid');
        freshList.set(today);
      } catch {
        fresh.setStatus('OFFLINE', 'off');
      }
    };
    const digestBtn = button('DIGEST NOW', async (b) => {
      b.disabled = true;
      b.textContent = 'GATHERING…';
      try {
        const r = await brain.digestNow();
        if (r.skipped) toast(`Not gathered: ${r.skipped}`, 'warn');
        else toast(`Gathered ${r.passages} passages from ${r.sources.length} sources${r.levels ? ', and the day in three levels' : ''}`, 'ok');
      } catch (e) {
        toast(`Could not gather: ${(e as Error).message}`, 'bad');
      }
      b.disabled = false;
      b.textContent = 'DIGEST NOW';
      void paintFresh();
      void refresh();
    }, 'on');
    fresh.foot!.prepend(digestBtn);
    // his own things first (add, his shelf, his gadgets' manuals), then what Ghosty reads by himself and the day's digest
    P.right.append(ap.el, shelf.el, gadgets.el, study.el, fresh.el);

    let vectors = false;
    let starterReady = true;
    /** The brain could not be reached the last time the shelf was asked for (the phone's copy is shown). */
    let unreached = false;
    const isOffline = () => unreached || (typeof navigator !== 'undefined' && navigator.onLine === false);
    /** What depends on a connection, set to match it (DIGEST NOW; self-study's controls). */
    const showReach = () => {
      digestBtn.disabled = isOffline();
      if (lastStudy) paintStudy(lastStudy);
    };
    const refresh = async (): Promise<void> => {
      try {
        const r = await brain.library();
        const was = unreached;
        unreached = !!r.offline;
        if (was !== unreached) showReach();
        docs = r.docs;
        vectors = r.vectors;
        starterReady = r.starterReady;
        // (a document whose REMOVE is waiting on its UNDO bar is already off the shelf and off the gadgets)
        paintShelf();
        paintGadgets(docs.filter((x) => !leaving.has(x.id)));
        P.big.textContent = `${fmt.n(r.stats.passages)} PASSAGES`;
        P.sub.textContent = r.offline
          ? `You’re offline: this is the copy on this phone (${fmt.n(r.stats.docs)} documents). It updates by itself when you’re back.`
          : `${r.stats.docs} documents · ${(r.stats.bytes / 1e6).toFixed(1)} MB · ${vectors ? 'searched by meaning and words' : 'searched by words'}${starterReady ? '' : ' · setting up starter library…'}`;
        P.dials([
          ['YOURS', Math.min(1, docs.filter((d) => !d.builtin).length / 50), `${docs.filter((d) => !d.builtin).length}`, '#5ce1ff'],
          ['BUILT-IN', 1, `${docs.filter((d) => d.builtin).length}`, '#52f2b5'],
          ['SIZE', Math.min(1, r.stats.bytes / 1e9), r.stats.bytes < 1e7 ? `${(r.stats.bytes / 1e6).toFixed(1)}MB` : `${Math.round(r.stats.bytes / 1e6)}MB`, '#ffd24d'],
        ]);
        if (!starterReady && !busy.n) setTimeout(() => void refresh(), 1500); // keep filling the starter library
        // Keep this device's copy current (it answers when the brain can't), and say how much is here.
        if (r.offline) return;
        const sub = P.sub.textContent;
        void mirrorLibraryNow()
          .then(() => deviceShelf())
          .then((x) => {
            if (P.sub.textContent === sub) P.sub.textContent = `${sub} · ${fmt.n(x.stats.passages)} passages on this device (works offline)`;
          });
      } catch (e) {
        if (unreachable(e) && !unreached) {
          unreached = true;
          showReach();
        }
        shelf.setStatus('OFFLINE', 'off');
        clear(shelf.body);
        shelf.body.append(h('div.note', `The library is not reachable: ${(e as Error).message}`));
      }
    };

    addEventListener('online', () => {
      if (!root.isConnected || !root.getClientRects().length) return;
      unreached = false;
      void refresh();
      void brain.studyStatus().then((s) => paintStudy(s as StudyNow), () => paintStudy(null));
      void paintFresh();
    });
    addEventListener('offline', () => root.isConnected && showReach());
    return {
      enter() {
        // (self-study is painted once the shelf has said whether Ghosty can be reached)
        void Promise.all([refresh(), brain.studyStatus().catch(() => null)]).then(([, s]) => {
          paintStudy(s as StudyNow | null);
          digestBtn.disabled = isOffline();
        });
        void paintFresh();
      },
      describe: () => `Library: ${docs.length} documents (${docs.filter((d) => !d.builtin).map((d) => d.title).slice(0, 8).join('; ')}).`,
    };
  },
};
