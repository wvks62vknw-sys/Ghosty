/**
 * LIBRARY tab: Ghosty's offline brain. Add books, PDFs, Word files, e-books, notes, web
 * pages, arXiv papers, CVEs and GitHub repositories; Ghosty keeps them forever and looks
 * things up in them before answering. Searching here uses no AI at all. SELF-STUDY shows
 * what Ghosty is learning on its own (what it read, the notes it wrote, how its drills go),
 * takes the owner's focus, and exports every notebook to GitHub; any document on the shelf
 * opens in a reader. FRESH TODAY is the day's digest (the news, papers and events Ghosty
 * gathered this morning — DIGEST NOW gathers again).
 */
import type { LibraryDoc, LibraryHit } from '../../../../../packages/shared/src/protocol';
import { brain, mirrorLibraryNow, type StudyInfo } from '../../api/brain';
import { shelf as deviceShelf } from '../../library/local';
import { clear, fmt, h } from '../../core/dom';
import { ACCEPT } from '../../library/extract';
import { addFile, addText } from '../../library/upload';
import type { TabDef } from '../../shell/tabs';
import { bar, button, modal, pager, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

const KIND: Record<string, string> = { pdf: 'PDF', book: 'BOOK', document: 'DOC', notes: 'NOTES', text: 'TEXT', web: 'WEB', paper: 'PAPER', cve: 'CVE', code: 'CODE', starter: 'BUILT-IN', study: 'READ BY GHOSTY', digest: 'GHOSTY NOTES', scan: 'SCANNED', recon: 'RECON', note: 'NOTE', project: 'PROJECT' };
/** One passage of the day's digest (library/digest.ts in the brain): "YYYY-MM-DD · source". */
interface FreshItem {
  heading: string;
  text: string;
}

export const libraryTab: TabDef = {
  id: 'library',
  title: 'LIBRARY',
  icon: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
  scene: 'backdrop',
  blurb: 'ask the offline brain · add books & PDFs',
  mount(root) {
    const P = page(root, { tag: 'LIBRARY // OFFLINE BRAIN', sub: 'everything Ghosty has read — searched without AI', leftLabel: 'ASK', rightLabel: 'ADD & SHELF', stack: true });
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
          const here = doc.id.startsWith('local-') ? ' on this device (sent to Ghosty when memory is back; searchable now)' : '';
          line.textContent = `✓ ${doc.title} — ${doc.passages} passage${doc.passages === 1 ? '' : 's'} saved${here}${warning ? ` (${warning})` : ''}`;
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
        line.textContent = `✓ ${d.title} — ${d.passages} passage${d.passages === 1 ? '' : 's'} saved${d.id.startsWith('local-') ? ' on this device (sent to Ghosty when memory is back)' : ''}`;
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
      const r = row(KIND[d.kind] ?? d.kind.toUpperCase(), d.title, d.builtin ? `${d.passages}` : '✕', { wrap: true, onClick: () => openDoc(d) });
      if (!d.builtin) {
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.title = `Remove "${d.title}" from the library`;
        x.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Remove "${d.title}" from Ghosty's library?`)) return;
          await brain.libraryRemove(d.id).catch(() => toast('Could not remove it', 'bad'));
          void refresh();
        });
      }
      return r;
    }, () => 'SYNC');
    // ---- the reader: any document on the shelf, passage by passage (Ghosty's notebooks included)
    const openDoc = (d: LibraryDoc) => {
      const body = h('div.reader');
      const more = button('MORE', () => void load(), 'on');
      let after = 0;
      let last = '';
      const load = async () => {
        more.disabled = true;
        try {
          const r = await brain.libraryPassages(d.id, after);
          for (const p of r.passages) {
            if (p.heading && p.heading !== last) {
              body.append(h('h4', p.heading));
              last = p.heading;
            }
            body.append(h('p', p.text));
          }
          if (r.next === null) more.remove();
          else {
            after = r.next;
            more.disabled = false;
          }
        } catch (e) {
          body.append(h('div.note.bad', `Could not read it: ${(e as Error).message}`));
          more.remove();
        }
      };
      modal(d.title, h('div.readwrap', h('div.note', `${KIND[d.kind] ?? d.kind.toUpperCase()} · ${d.source || 'no source'} · ${fmt.n(d.passages)} passages`), body, h('div.keyrow', more)));
      void load();
    };

    // ---- self-study: Ghosty studies on its own, around the clock, within the free plan
    const study = panel('SELF-STUDY', { grow: false, cls: 'study' });
    let allFields = false;
    const focusIn = h('input', { placeholder: 'Put first: e.g. physics, finance, Swift · "none" clears', 'aria-label': 'Fields to study first' });
    const paintStudy = (st: StudyInfo | null) => {
      clear(study.body);
      if (!st) {
        study.setStatus('OFFLINE', 'off');
        return;
      }
      const sum = st.summary;
      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
      study.setStatus(st.on ? 'LEARNING' : 'OFF', st.on ? 'ok' : 'mid');
      const weakest = sum.drills.skills.filter((k) => k.n >= 2).slice(0, 3).map((k) => `${k.skill} ${pct(k.right, k.n)}%`).join(' · ');
      const lastText = !st.last ? '' : st.last.error ? `${st.last.topic} — ${st.last.error}` : st.last.kind === 'drill' ? `${st.last.topic}: ${st.last.title ?? ''}` : st.last.kind === 'digest' ? `wrote notes on ${st.last.topic}` : `read ${st.last.topic}${st.last.passages ? ` (${st.last.passages} passages)` : ''}`;
      const fields = [...sum.domains].sort((a, b) => Number(b.focus) - Number(a.focus) || b.read - a.read || a.name.localeCompare(b.name));
      const shown = allFields ? fields : fields.slice(0, 5);
      const focusNames = st.focus.map((id) => sum.domains.find((d) => d.id === id)?.name ?? id);
      study.body.append(
        h('div.note', st.on
          ? `Around the clock, on its own: Ghosty reads a curriculum of ${fmt.n(sum.topics)} topics across ${sum.domains.length} fields (Wikipedia, MDN, arXiv, OpenStax, the Swift book), writes study notes on each with a free model, and sets itself drills it marks without any AI. Everything is filed in this library — open any notebook on the shelf, or export it all to GitHub.`
          : 'Switched off. Turn it on and Ghosty reads, takes notes and drills itself around the clock, free, filing everything here.'),
        bar('READ', sum.read / Math.max(1, sum.topics), `${fmt.n(sum.read)} / ${fmt.n(sum.topics)} topics`, '#5ce1ff'),
        bar('NOTES', sum.digested / Math.max(1, sum.topics), `${fmt.n(sum.digested)} written${sum.pending ? ` · ${sum.pending} waiting for a model` : ''}`, '#52f2b5'),
        // from the basics up: each field is read beginner → intermediate → advanced
        sum.levels ? row('LEVELS', sum.levels.map((l) => `${l.level} ${pct(l.read, l.topics)}%`).join(' · '), null, { wrap: true }) : '',
        row('TODAY', `${sum.today.reads} read · ${sum.today.digests} notes · ${sum.today.drills} drills`, `${sum.today.ai} AI calls`),
        row('DRILLS', sum.drills.asked ? `${sum.drills.right} of ${sum.drills.asked} right · ${pct(sum.drills.right, sum.drills.asked)}%` : 'none yet', weakest ? `weakest: ${weakest}` : null, { wrap: true, tone: sum.drills.asked && pct(sum.drills.right, sum.drills.asked) < 60 ? 'dn' : 'up' }),
        st.last ? row('LAST', lastText, fmt.ago(st.last.at), { wrap: true, ...(st.last.error ? { tone: 'bad' as const } : {}) }) : '',
        st.gaps.length ? row('YOUR QUESTIONS', st.gaps.slice(-3).join(' · '), String(st.gaps.length), { wrap: true }) : '',
        st.on && st.next ? row('NEXT', new Date(st.next).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), `${st.sessions} sessions`) : row('SESSIONS', String(st.sessions)),
        h('div.lab', 'FIELDS'),
        ...shown.map((d) => bar(d.focus ? `★ ${d.name}` : d.name, d.read / Math.max(1, d.topics), `${d.read}/${d.topics}`, d.focus ? '#ffd24d' : undefined)),
        fields.length > 5
          ? h('div.keyrow', button(allFields ? 'FEWER' : `ALL ${fields.length} FIELDS`, () => {
            allFields = !allFields;
            paintStudy(st);
          }))
          : '',
        focusNames.length ? row('FIRST', focusNames.join(', '), '★', { wrap: true }) : '',
        h('div.keyrow', focusIn, button('FOCUS', async () => {
          const words = focusIn.value.trim();
          if (!words) return;
          focusIn.value = '';
          const r = await brain.study({ focus: words }).catch(() => null);
          if (r && !r.focus.length && !/^(none|off|clear|-)$/i.test(words)) toast('No field by that name — the FIELDS list has them all', 'warn');
          paintStudy(r ? await brain.studyStatus().catch(() => r) : null);
        })),
        h('div.keyrow',
          button(st.on ? 'TURN OFF' : 'TURN ON', async () => paintStudy(await brain.study({ on: !st.on }).then(() => brain.studyStatus()).catch(() => null)), st.on ? 'warn' : 'on'),
          st.on ? button('STUDY NOW', async (b) => {
            b.disabled = true;
            study.setStatus('STUDYING…', 'mid');
            const r = await brain.study({ now: true }).catch(() => null);
            if (r?.did) toast(`Studied: ${r.did.reads} read, ${r.did.digests} notes, ${r.did.drills} drills`, 'ok');
            paintStudy(await brain.studyStatus().catch(() => r));
            void refresh();
          }) : '',
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
    const freshList = pager(fresh, 46, freshRow, () => 'NONE YET');
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
    fresh.foot!.prepend(button('DIGEST NOW', async (b) => {
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
    }, 'on'));
    P.right.append(fresh.el, study.el, ap.el, shelf.el);

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
        // Keep this device's copy current (it answers when the brain can't), and say how much is here.
        const sub = P.sub.textContent;
        void mirrorLibraryNow()
          .then(() => deviceShelf())
          .then((x) => {
            if (P.sub.textContent === sub) P.sub.textContent = `${sub} · ${fmt.n(x.stats.passages)} passages on this device (works offline)`;
          });
      } catch (e) {
        shelf.setStatus('OFFLINE', 'off');
        clear(shelf.body);
        shelf.body.append(h('div.note', `The library is not reachable: ${(e as Error).message}`));
      }
    };

    return {
      enter() {
        void refresh();
        void brain.studyStatus().then(paintStudy, () => paintStudy(null));
        void paintFresh();
      },
      describe: () => `Library: ${docs.length} documents (${docs.filter((d) => !d.builtin).map((d) => d.title).slice(0, 8).join('; ')}).`,
    };
  },
};
