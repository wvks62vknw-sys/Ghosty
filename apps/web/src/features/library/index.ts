/**
 * LIBRARY tab: Ghosty's offline brain. Add books, PDFs, Word files, e-books, notes, web
 * pages, arXiv papers, CVEs and GitHub repositories; Ghosty keeps them forever and looks
 * things up in them before answering. Searching here uses no AI at all.
 */
import type { LibraryDoc, LibraryHit } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { ACCEPT } from '../../library/extract';
import { addFile, addText } from '../../library/upload';
import type { TabDef } from '../../shell/tabs';
import { button, pager, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

const KIND: Record<string, string> = { pdf: 'PDF', book: 'BOOK', document: 'DOC', notes: 'NOTES', text: 'TEXT', web: 'WEB', paper: 'PAPER', cve: 'CVE', code: 'CODE', starter: 'BUILT-IN' };

export const libraryTab: TabDef = {
  id: 'library',
  title: 'LIBRARY',
  icon: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
  scene: 'backdrop',
  blurb: 'ask the offline brain · add books & PDFs',
  mount(root) {
    const P = page(root, { tag: 'LIBRARY // OFFLINE BRAIN', sub: 'everything Ghosty has read — searched without AI', leftLabel: 'ASK', rightLabel: 'ADD & SHELF' });
    let docs: LibraryDoc[] = [];

    // ---- add knowledge
    const ap = panel('ADD KNOWLEDGE', { grow: false, cls: 'libadd' });
    const fileInput = h('input', { type: 'file', multiple: true, accept: ACCEPT, style: { display: 'none' }, 'aria-label': 'Choose files for the library' });
    const drop = h('div.drop', { tabIndex: 0, role: 'button', 'aria-label': 'Add files to the library' }, h('b', 'DROP BOOKS, PDFS & FILES HERE'), h('span', 'or tap to choose · PDF, Word, EPUB, web pages, text, Markdown, CSV/JSON, code'));
    const log = h('div.liblog');
    const busy = { n: 0 };
    const note = (text: string, kind: '' | 'ok' | 'bad' = '') => {
      const r = h(`div.note${kind ? `.${kind}` : ''}` as 'div', text);
      log.prepend(r);
      while (log.children.length > 6) log.lastChild!.remove();
      return r;
    };
    const ingest = async (files: File[]) => {
      for (const f of files) {
        const line = note(`${f.name}: reading…`);
        busy.n++;
        try {
          const { doc, warning } = await addFile(f, (t) => (line.textContent = `${f.name}: ${t}`));
          line.textContent = `✓ ${doc.title} — ${doc.passages} passage${doc.passages === 1 ? '' : 's'} saved${warning ? ` (${warning})` : ''}`;
          line.className = 'note ok';
        } catch (e) {
          line.textContent = `✕ ${f.name}: ${(e as Error).message}`;
          line.className = 'note bad';
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

    const src = h('input', { placeholder: 'https://… · arXiv 1706.03762 · CVE-2021-44228 · owner/repo', 'aria-label': 'Import from the web' });
    const doImport = async () => {
      const s = src.value.trim();
      if (!s) return;
      src.value = '';
      const line = note(`${s}: importing…`);
      try {
        const r = await brain.libraryImport(s);
        line.textContent = `✓ ${r.doc.title} — ${r.passages} passages saved. ${r.note}`.trim();
        line.className = 'note ok';
      } catch (e) {
        line.textContent = `✕ ${s}: ${(e as Error).message}`;
        line.className = 'note bad';
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
        line.textContent = `✓ ${d.title} — ${d.passages} passage${d.passages === 1 ? '' : 's'} saved`;
        line.className = 'note ok';
      } catch (e) {
        line.textContent = `✕ ${(e as Error).message}`;
        line.className = 'note bad';
      }
      void refresh();
    };
    ap.body.append(
      fileInput,
      drop,
      h('div.lab', 'IMPORT FROM THE WEB'),
      h('div.keyrow', src, button('IMPORT', () => void doImport())),
      h('div.keyrow', button('READ MY OWN CODE', () => void readSelf()), h('span.note', 'Ghosty reads its own source and architecture.')),
      h('div.lab', 'OR PASTE TEXT'),
      tTitle,
      tBody,
      h('div.keyrow', button('SAVE TEXT', () => void saveText())),
      log,
    );

    // ---- ask (no AI): the whole first column, results scroll
    const sp = panel('ASK THE LIBRARY', { status: 'no AI used', cls: 'ask' });
    const q = h('input.askq', { type: 'search', placeholder: 'Ask anything Ghosty has read…', enterKeyHint: 'search', 'aria-label': 'Search the library' });
    const hitRow = (x: LibraryHit) => {
      const where = [x.title, x.heading && x.heading !== x.title ? x.heading : '', x.page ? `p. ${x.page}` : ''].filter(Boolean).join(' · ');
      return h('div.rw.wrap.hit', h('span.k', where), h('span.v', x.text.length > 700 ? `${x.text.slice(0, 700)}…` : x.text));
    };
    const TRY = ['how attention works in transformers', 'binary search edge cases', 'how Ghosty works', 'SQL injection', 'big-O of sorting'];
    const idle = () => clear(sp.body, h('div.note', 'Search every book, PDF, paper, note and line of code in the library — instantly, offline, no AI or API key used.'), h('div.lab', 'TRY'), h('div.tabs.trychips', ...TRY.map((t) => button(t, () => {
      q.value = t;
      void search();
    }))));
    const search = async () => {
      const t = q.value.trim();
      if (!t) return idle();
      sp.setStatus('searching…', 'mid');
      try {
        const r = await brain.librarySearch(t, 20);
        clear(sp.body, ...(r.hits.length ? r.hits.map(hitRow) : [h('div.note', 'Nothing matches that yet. Add a book or document on the other side, or try other words.')]));
        sp.body.scrollTop = 0;
        sp.setStatus(`${r.hits.length} passages · no AI used`, 'ok');
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
    const shelf = panel('SHELF', { footer: true });
    const shelfList = pager(shelf, 46, (d: LibraryDoc) => {
      const r = row(KIND[d.kind] ?? d.kind.toUpperCase(), d.title, d.builtin ? `${d.passages}` : '✕', { wrap: true });
      if (!d.builtin) {
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.title = `Remove "${d.title}" from the library`;
        x.addEventListener('click', async () => {
          if (!confirm(`Remove "${d.title}" from Ghosty's library?`)) return;
          await brain.libraryRemove(d.id).catch(() => toast('Could not remove it', 'bad'));
          void refresh();
        });
      }
      return r;
    }, () => 'SYNC');
    P.right.append(ap.el, shelf.el);

    let vectors = false;
    let starterReady = true;
    const refresh = async (): Promise<void> => {
      try {
        const r = await brain.library();
        docs = r.docs;
        vectors = r.vectors;
        starterReady = r.starterReady;
        shelfList.set(docs);
        shelf.setStatus(`${r.stats.docs} DOCS`, 'ok');
        P.big.textContent = `${fmt.n(r.stats.passages)} PASSAGES`;
        P.sub.textContent = `${r.stats.docs} documents · ${(r.stats.bytes / 1e6).toFixed(1)} MB · ${vectors ? 'meaning search on (Workers AI)' : 'keyword search'}${starterReady ? '' : ' · setting up starter library…'}`;
        P.dials([
          ['YOURS', Math.min(1, docs.filter((d) => !d.builtin).length / 50), `${docs.filter((d) => !d.builtin).length}`, '#5ce1ff'],
          ['BUILT-IN', 1, `${docs.filter((d) => d.builtin).length}`, '#52f2b5'],
          ['SIZE', Math.min(1, r.stats.bytes / 1e9), r.stats.bytes < 1e7 ? `${(r.stats.bytes / 1e6).toFixed(1)}MB` : `${Math.round(r.stats.bytes / 1e6)}MB`, '#ffd24d'],
        ]);
        if (!starterReady && !busy.n) setTimeout(() => void refresh(), 1500); // keep filling the starter library
      } catch (e) {
        shelf.setStatus('OFFLINE', 'off');
        clear(shelf.body);
        shelf.body.append(h('div.note', `The library is not reachable: ${(e as Error).message}`));
      }
    };

    return {
      enter() {
        void refresh();
      },
      describe: () => `Library: ${docs.length} documents (${docs.filter((d) => !d.builtin).map((d) => d.title).slice(0, 8).join('; ')}).`,
    };
  },
};
