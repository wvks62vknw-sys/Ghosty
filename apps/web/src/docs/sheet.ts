/**
 * THE DOCUMENTS SHEET (BRIEF-REST-E part 2; MAKE → DOCUMENTS, "my documents", a reply's "laid out" card): MY DOCUMENTS
 * kept on this phone with their dates; a document READ from a file (PDF, Word, EPUB, HTML, Markdown, text) with its
 * CONTENTS, READ IT TO ME in the phone's voice, FIND; WRITTEN by the brain in the chat and laid out here; EDITED here —
 * paragraphs, headings, bold, italic, lists, find and replace, undo — with the brain's edits as SUGGESTIONS accepted or
 * rejected one by one; TRANSLATED paragraph by paragraph (side by side on a wide screen, stacked on the phone); its
 * letters TRANSLITERATED by tables; exported as PDF, Word, Markdown or HTML. All on the phone but the brain's words.
 * BRIEF-EDITOR-DOCUMENTS made it the core of Word: underline, links, alignment, photos from his own photos, tables, page breaks, the
 * page's size, margins, header, footer and numbers, a live word and page count, autosave said, a Word file read and written with
 * its tables, links and pictures, and Ghosty writing into the page after the paragraph he is in. The EDITORS lane added strikethrough,
 * the highlighter (MARK) and checklists with a box to tick, each kept through Markdown, HTML, Word and the PDF.
 */
import { h, clear } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { MIME, sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';
import { readDocBytes, pdfOfDocAnyScript, readNotes } from './read';
import { addPhoto, imageBytes, imageNow, loadImages } from './images';
import { docxFrom } from './docx';
import { pageCount, readingWords } from './layout';
import { askBrain, myName, replyText, suggestEdits, tellGhosty, translateDoc } from './ask';
import { setLiveDoc } from './live';
import { getDoc, letterDate, listDocs, removeDoc, saveDoc, tidyImages, whenWords } from './store';
import { fromLatin, scriptOf, SCRIPTS, THE_LINE, toLatin, type Script } from './translit';
import {
  accept, block, blockId, contents, counts, docFromReply, EDITS, findIn, History, isHeading, langCode, LANGUAGES, newDoc, newTable, openDocData, pageOf, plainBlock, proposalFrom, replaceAll, rewriteMessage, textOf, tidyRuns, toHtml, toMarkdown, withBlock, wordDiff,
  writeMessage, writtenBlocks,
  type Align, type Block, type BlockType, type Doc, type EditKind, type PageSetup, type Run, type Suggestion,
} from './model';
import { sayError } from '../ui/hisWords';

export const docsState = {
  open: false,
  view: 'list' as 'list' | 'doc' | 'pair',
  title: '',
  text: '',
  blocks: 0,
  suggestions: [] as { old: string; new: string }[],
  accepted: 0,
  reading: '',
  said: '',
  exported: [] as { name: string; size: number; type: string }[],
  pair: { left: '', right: '', rtl: false, lang: '' },
  kept: 0,
  words: 0,
  chars: 0,
  pages: 1,
  saved: 0,
  json: '',
  lost: [] as string[],
  focus: '',
  panel: 'write',
};
let current: { close(): void } | null = null;
/** A button that shows its words as written ("In plain English", "HTML"), not in the buttons' sentence case. */
const cased = (b: HTMLButtonElement, words = b.textContent ?? ''): HTMLButtonElement => {
  b.dataset.label = words;
  return b;
};

/** The sheet's name (its title, and its panel on the DOCUMENTS screen: features/docs/index.ts). */
export const DOCS_TITLE = 'DOCUMENTS';
type DocsAsk = { doc?: Doc; reply?: number; ask?: string; id?: string; what?: 'list' | 'new' | 'open' | 'translate' | 'letters'; language?: string };

/** The sheet: a document to open (one read here, a chat reply laid out), or MY DOCUMENTS. */
export async function openDocs(o: DocsAsk = {}): Promise<void> {
  current?.close();
  const d = docsParts();
  docsState.open = true;
  current = modal(DOCS_TITLE, d.el, () => {
    d.stop();
    docsState.open = false;
    current = null;
  });
  await d.start(o);
}

/**
 * The documents' page (the sheet's, and the DOCUMENTS screen's: features/docs/index.ts): `start` opens what was asked for
 * (a document, a reply laid out, a new one, MY DOCUMENTS); `stop` ends a reading aloud.
 */
export function docsParts(): { el: HTMLElement; start(o: DocsAsk): Promise<void>; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.docs = docsState;
  let hist: History | null = null;
  let focused = '';
  let suggestions: Suggestion[] = [];
  let timer = 0;

  const fileIn = h('input', { type: 'file', hidden: true, accept: '.pdf,.docx,.epub,.html,.htm,.md,.markdown,.txt,text/plain,application/pdf', 'aria-label': 'Choose a document to read' }) as HTMLInputElement;
  const status = h('p.dcstatus', { 'aria-live': 'polite' });
  const view = h('div.dcview');
  const say = (words: string) => {
    status.textContent = words;
    docsState.said = words;
  };
  const shareOrSave = async (blob: Blob, name: string) => {
    if (!(await shareBlob(blob, name))) saveBlob(blob, name);
  };
  let blocked = false;
  const keep = (d: Doc) => {
    if (d.kind === 'read' && !getDoc(d.id)) return;
    if (saveDoc(d)) {
      docsState.kept = listDocs().length;
      docsState.saved = Date.now();
      blocked = false;
    } else if (!blocked) {
      blocked = true;
      say('This phone is not letting me keep documents (its storage is blocked or full). You can still write and export; nothing will be here when you leave.');
    }
  };

  // ---------------------------------------------------------------- MY DOCUMENTS
  const showList = () => {
    setLiveDoc(null);
    stopReading();
    docsState.view = 'list';
    tidyImages();
    const docs = listDocs();
    docsState.kept = docs.length;
    clear(view,
      h('h3.dch', 'MY DOCUMENTS'),
      docs.length
        ? h('div.dclist', ...docs.map((d) => button(h('span.dcdoc', h('b', d.title), h('small', `${d.kind === 'letter' ? 'Letter' : d.kind === 'translation' ? `Translation${d.lang ? ` into ${d.lang}` : ''}` : d.kind === 'read' ? 'Read from a file' : 'Document'} · ${whenWords(d.at)} · ${readingWords(d).split(',')[0]}`)), () => showDoc(d), 'dcopen')))
        : h('p.dcnote', 'Nothing kept yet. Ask me in the chat to write something (“write a letter to my landlord about the damp”), open a file, or start a new one.'),
    );
    say(docs.length ? `${docs.length} document${docs.length === 1 ? '' : 's'}, kept on this phone only.` : '');
  };

  // ---------------------------------------------------------------- a document
  const showDoc = (d: Doc) => {
    stopReading();
    hist = new History(d);
    suggestions = [];
    focused = '';
    // the chat sends this document with his message, and the brain's `document` tool proposes changes to it (BRIEF-KERNEL-2)
    setLiveDoc({ data: () => (hist ? openDocData(hist.doc) : ''), propose: proposeHere });
    render();
    void hydrate(d);
  };
  const doc = () => hist!.doc;
  /** A change: kept at once. A file read (a PDF, a book) becomes his own document the moment he edits it. */
  const change = (next: Doc, repaint = true) => {
    hist!.push(next.kind === 'read' ? { ...next, kind: 'document' } : next);
    keep(doc());
    if (repaint) render();
    else paintState();
  };
  const paintState = () => {
    const d = doc();
    docsState.view = 'doc';
    docsState.title = d.title;
    docsState.blocks = d.blocks.length;
    docsState.text = d.blocks.map(textOf).join('\n\n').slice(0, 4000);
    docsState.suggestions = suggestions.map((s) => ({ old: s.old, new: s.new }));
    const c = counts(d);
    docsState.words = c.words;
    docsState.chars = c.chars;
    // the pages are a whole layout of the document: a long one is counted once he pauses, so a key or a tick stays quick
    clearTimeout(pagesTimer);
    if (d.blocks.length < 200) docsState.pages = pageCount(d);
    else
      pagesTimer = window.setTimeout(() => {
        if (hist?.doc !== d) return;
        docsState.pages = pageCount(d);
        paintMeta();
      }, 700);
    docsState.json = JSON.stringify(d);
    paintMeta();
  };
  let pagesTimer = 0;
  const metaEl = h('p.dcmeta');
  const savedEl = h('small.dcsaved', { 'aria-live': 'polite' });
  const paintMeta = () => {
    const d = doc();
    const pg = pageOf(d);
    const mins = Math.max(1, Math.round(docsState.words / 200));
    metaEl.textContent = `${docsState.words.toLocaleString('en-GB')} word${docsState.words === 1 ? '' : 's'} · ${docsState.chars.toLocaleString('en-GB')} characters · ${docsState.pages} page${docsState.pages === 1 ? '' : 's'} (${pg.size === 'a4' ? 'A4' : 'Letter'}${pg.landscape ? ', landscape' : ''}) · about ${mins} min to read`;
    savedEl.textContent = blocked ? 'NOT KEPT · THIS PHONE’S STORAGE IS BLOCKED' : getDoc(d.id) ? `KEPT ON THIS PHONE · ${new Date(d.at).toLocaleTimeString('en-GB')}` : 'READ FROM A FILE · NOT KEPT UNTIL YOU CHANGE IT';
  };

  const page = h('div.dcpage', { role: 'region', 'aria-label': 'The document: tap a paragraph to edit it' });
  const sugBox = h('div.dcsugs', { 'aria-live': 'polite' });
  const findBox = h('div.dcfind');
  const contentsBox = h('div.dccontents');
  findBox.hidden = true;
  contentsBox.hidden = true;

  interface Marks {
    b: boolean;
    i: boolean;
    u: boolean;
    s: boolean;
    hl: boolean;
    href: string;
  }
  const safeLink = (u: string): string => {
    const t = u.trim();
    if (!t) return '';
    if (/^(?:https?:|mailto:|tel:)/i.test(t)) return t;
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return '';
    return /@/.test(t) && !/\s|\//.test(t) ? `mailto:${t}` : `https://${t}`;
  };
  function runsOf(node: Node, st: Marks = { b: false, i: false, u: false, s: false, hl: false, href: '' }, out: Run[] = []): Run[] {
    const mk = (text: string, m: Marks): Run => ({ text, ...(m.b ? { b: true } : {}), ...(m.i ? { i: true } : {}), ...(m.u && !m.href ? { u: true } : {}), ...(m.s ? { s: true } : {}), ...(m.hl ? { hl: true } : {}), ...(m.href ? { href: m.href } : {}) });
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(mk(n.textContent ?? '', st));
      else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const tag = el.tagName;
        if (tag === 'BR') out.push({ text: '\n' });
        else if (tag === 'DIV' || tag === 'P') {
          if (out.length && !out[out.length - 1]!.text.endsWith('\n')) out.push({ text: '\n' });
          runsOf(el, st, out);
        } else
          runsOf(el, {
            b: st.b || tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(el.style.fontWeight),
            i: st.i || tag === 'I' || tag === 'EM' || el.style.fontStyle === 'italic',
            u: st.u || tag === 'U' || /underline/.test(el.style.textDecorationLine || el.style.textDecoration),
            s: st.s || tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/.test(el.style.textDecorationLine || el.style.textDecoration),
            hl: st.hl || tag === 'MARK',
            href: tag === 'A' ? safeLink(el.getAttribute('href') ?? '') : st.href,
          }, out);
      }
    });
    return out;
  }
  const readRuns = (el: HTMLElement): Run[] => {
    const r = tidyRuns(runsOf(el));
    const last = r[r.length - 1];
    if (last) last.text = last.text.replace(/\n+$/, '');
    return tidyRuns(r);
  };
  /** How many letters come before the caret in this block (a line break counts one). */
  const caretAt = (el: HTMLElement): number => {
    const sel = getSelection();
    if (!sel?.rangeCount) return 0;
    const r = sel.getRangeAt(0).cloneRange();
    r.setStart(el, 0);
    const box = document.createElement('div');
    box.append(r.cloneContents());
    return readRuns(box).reduce((n, x) => n + x.text.length, 0);
  };
  const placeCaret = (el: HTMLElement, at: number) => {
    let left = at;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    const r = document.createRange();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (left <= len) {
        r.setStart(node, left);
        break;
      }
      left -= len;
      node = walker.nextNode();
    }
    if (node) r.collapse(true);
    else {
      r.selectNodeContents(el);
      r.collapse(false);
    }
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  };
  const splitRuns = (runs: Run[], at: number): [Run[], Run[]] => {
    const a: Run[] = [];
    const z: Run[] = [];
    let n = 0;
    for (const r of runs) {
      if (n + r.text.length <= at) a.push(r);
      else if (n >= at) z.push(r);
      else {
        a.push({ ...r, text: r.text.slice(0, at - n) });
        z.push({ ...r, text: r.text.slice(at - n) });
      }
      n += r.text.length;
    }
    return [tidyRuns(a), tidyRuns(z)];
  };
  const elOf = (id: string) => page.querySelector<HTMLElement>(`[data-id="${id}"]`);
  /** The words of one paragraph kept (a table's cells and a picture are kept by their own). */
  const sync = (el: HTMLElement) => {
    const tbl = el.closest<HTMLElement>('.dctable');
    if (tbl) return syncTable(tbl);
    const id = el.dataset.id;
    // a paragraph already drawn again (a repaint took it off the page) has nothing newer to say
    if (!id || !el.isConnected || !el.isContentEditable) return;
    const runs = readRuns(el);
    const b = doc().blocks.find((x) => x.id === id);
    if (!b || !plainBlock(b) || JSON.stringify(b.runs) === JSON.stringify(runs)) return;
    change(withBlock(doc(), id, (x) => ({ ...x, runs })), false);
  };
  const syncTable = (tbl: HTMLElement) => {
    const id = tbl.dataset.id!;
    const b = doc().blocks.find((x) => x.id === id);
    if (!b?.rows) return;
    const rows = b.rows.map((r, ri) => r.map((c, ci) => {
      const cell = tbl.querySelector<HTMLElement>(`[data-r="${ri}"][data-c="${ci}"]`);
      return cell ? readRuns(cell) : c;
    }));
    if (JSON.stringify(rows) === JSON.stringify(b.rows)) return;
    change(withBlock(doc(), id, (x) => ({ ...x, rows })), false);
  };
  /** Whatever he was typing in is kept at once (leaving the screen or the app must not lose the last words). */
  const flush = () => {
    clearTimeout(timer);
    const a = document.activeElement as HTMLElement | null;
    if (a && page.contains(a) && hist) sync(a);
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  const later = (el: HTMLElement) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => sync(el), 450);
  };

  // the words chosen are remembered for the link's own field (a field takes the focus)
  let lastRange: Range | null = null;
  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    if (sel?.rangeCount && page.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
    // the choice let go of (nothing chosen anywhere): a key must not act on words chosen before
    else if (!sel?.rangeCount) lastRange = null;
  });

  let cell = { id: '', r: 0, c: 0 };
  const focusOn = (id: string) => {
    focused = id;
    docsState.focus = id;
    paintContext();
  };

  /** Where new things go: after the block he is in (at the end when he is in none), a paragraph kept after the last. */
  const insertAfter = (blocks: Block[]) => {
    const d = doc();
    const at = d.blocks.findIndex((x) => x.id === focused);
    const list = at < 0 ? [...d.blocks, ...blocks] : [...d.blocks.slice(0, at + 1), ...blocks, ...d.blocks.slice(at + 1)];
    const last = list[list.length - 1];
    if (last && !plainBlock(last)) list.push(block('p', ''));
    change({ ...d, blocks: list });
    const target = blocks[blocks.length - 1]!;
    focusOn(target.id);
  };

  const blockEl = (b: Block): HTMLElement => {
    if (b.t === 'pb') {
      const el = h('hr.dcb.dcpb', { tabIndex: 0, role: 'separator', 'aria-label': 'Page break', dataset: { id: b.id, t: 'pb' } });
      el.addEventListener('focus', () => focusOn(b.id));
      el.addEventListener('keydown', (e) => (e.key === 'Backspace' || e.key === 'Delete') && removeBlock(b.id));
      return el;
    }
    if (b.t === 'img') {
      const src = b.img ? imageNow(b.img) : null;
      const img = h('img', { alt: b.alt ?? '', draggable: false, ...(src ? { src } : {}) }) as HTMLImageElement;
      img.style.width = `${b.w ?? 60}%`;
      const fig = h('figure.dcb.dcimg', { tabIndex: 0, 'aria-label': b.alt ? `Picture: ${b.alt}` : 'Picture (tap to size it or describe it)', dataset: { id: b.id, t: 'img', ...(b.align && b.align !== 'left' ? { align: b.align } : {}) } }, img);
      if (!src) fig.classList.add('wait');
      fig.addEventListener('click', () => fig.focus());
      fig.addEventListener('focus', () => focusOn(b.id));
      fig.addEventListener('keydown', (e) => (e.key === 'Backspace' || e.key === 'Delete') && removeBlock(b.id));
      return fig;
    }
    if (b.t === 'table') {
      const rows = b.rows ?? [];
      const t = h('table');
      rows.forEach((r, ri) => {
        const tr = h('tr');
        r.forEach((runs, ci) => {
          const head = !!b.head && ri === 0;
          const td = h(head ? 'th' : 'td', { contentEditable: 'true', spellcheck: true, role: head ? 'columnheader' : 'cell', 'aria-label': `Row ${ri + 1}, column ${ci + 1}`, dataset: { r: String(ri), c: String(ci) } });
          fillRuns(td, runs);
          td.addEventListener('focus', () => {
            cell = { id: b.id, r: ri, c: ci };
            focusOn(b.id);
          });
          td.addEventListener('input', () => later(td));
          td.addEventListener('blur', () => {
            clearTimeout(timer);
            sync(td);
          });
          td.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              document.execCommand('insertLineBreak');
            } else if (e.key === 'Tab') {
              e.preventDefault();
              const all = [...(td.closest('table')!.querySelectorAll<HTMLElement>('td,th'))];
              all[(all.indexOf(td) + (e.shiftKey ? all.length - 1 : 1)) % all.length]?.focus();
            }
          });
          tr.append(td);
        });
        t.append(tr);
      });
      return h('div.dcb.dctable', { dataset: { id: b.id, t: 'table' } }, t);
    }
    const tag = b.t === 'h1' ? 'h2' : b.t === 'h2' ? 'h3' : b.t === 'h3' ? 'h4' : b.t === 'quote' ? 'blockquote' : b.t === 'ul' || b.t === 'ol' ? 'li' : 'p';
    if (b.t === 'todo') {
      const el = editableEl(b, 'p');
      const box = h('button.dcbox', { type: 'button', role: 'checkbox', 'aria-checked': String(!!b.ticked), 'aria-label': `${b.ticked ? 'Done' : 'To do'}: ${textOf(b).slice(0, 40) || 'an empty item'}` }, b.ticked ? '✓' : '');
      const row = h(`div.dctodo${b.ticked ? '.ticked' : ''}` as 'div', box, el);
      box.addEventListener('click', () => {
        clearTimeout(timer);
        const runs = readRuns(el);
        const on = !doc().blocks.find((x) => x.id === b.id)?.ticked;
        // kept at once, and only this item drawn again (a long document is not repainted for a tick)
        change(withBlock(doc(), b.id, (x) => ({ ...x, runs, ticked: on ? true : undefined })), false);
        box.setAttribute('aria-checked', String(on));
        box.setAttribute('aria-label', `${on ? 'Done' : 'To do'}: ${runs.map((r) => r.text).join('').slice(0, 40) || 'an empty item'}`);
        box.textContent = on ? '✓' : '';
        row.classList.toggle('ticked', on);
        say(on ? 'Ticked. UNDO takes it back.' : 'Not done yet.');
      });
      return row;
    }
    return editableEl(b, tag);
  };
  const editableEl = (b: Block, tag: string): HTMLElement => {
    const el = h(`${tag}.dcb` as 'p', { contentEditable: 'true', spellcheck: true, dataset: { id: b.id, t: b.t, ...(b.align && b.align !== 'left' ? { align: b.align } : {}) } });
    if (b.t === 'right') el.classList.add('right');
    fillRuns(el, b.runs);
    el.addEventListener('focus', () => focusOn(b.id));
    el.addEventListener('input', () => later(el));
    el.addEventListener('blur', () => {
      clearTimeout(timer);
      sync(el);
    });
    el.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' && ke.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
        return;
      }
      if (ke.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        const runs = readRuns(el);
        const [a, z] = splitRuns(runs, caretAt(el));
        // Enter on an empty list or checklist item ends the list (as Pages and Word do)
        if ((b.t === 'ul' || b.t === 'ol' || b.t === 'todo') && !runs.some((r) => r.text.trim())) {
          change(withBlock(doc(), b.id, (x) => ({ ...x, t: 'p', runs: [], ticked: undefined })));
          elOf(b.id)?.focus();
          return;
        }
        const next: Block = { ...block(b.t === 'ul' || b.t === 'ol' || b.t === 'todo' ? b.t : 'p', z), ...(b.align ? { align: b.align } : {}) };
        const d = doc();
        const k = d.blocks.findIndex((x) => x.id === b.id);
        change({ ...d, blocks: [...d.blocks.slice(0, k), { ...b, runs: a }, next, ...d.blocks.slice(k + 1)] });
        const ne = elOf(next.id);
        ne?.focus();
        if (ne) placeCaret(ne, 0);
        return;
      }
      if (ke.key === 'Backspace' && getSelection()?.isCollapsed && caretAt(el) === 0) {
        const d = doc();
        const k = d.blocks.findIndex((x) => x.id === b.id);
        if (k <= 0) return;
        const prev = d.blocks[k - 1]!;
        e.preventDefault();
        clearTimeout(timer);
        if (!plainBlock(prev)) {
          // a picture, a table or a page break before it: the empty paragraph goes, a paragraph with words stays
          if (!textOf(b).trim()) change({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) });
          elOf(prev.id)?.focus();
          return;
        }
        const at = textOf(prev).length;
        change({ ...d, blocks: [...d.blocks.slice(0, k - 1), { ...prev, runs: tidyRuns([...prev.runs, ...readRuns(el)]) }, ...d.blocks.slice(k + 1)] });
        const pe = elOf(prev.id);
        pe?.focus();
        if (pe) placeCaret(pe, at);
      }
    });
    return el;
  };
  function fillRuns(el: HTMLElement, runs: Run[]): void {
    for (const r of runs) {
      r.text.split('\n').forEach((p, k) => {
        if (k) el.append(h('br'));
        if (!p) return;
        let node: Node = document.createTextNode(p);
        if (r.i) node = h('em', node);
        if (r.b) node = h('strong', node);
        if (r.u) node = h('u', node);
        if (r.s) node = h('s', node);
        if (r.hl) node = h('mark.dchl', node);
        if (r.href) node = h('a', { href: r.href, rel: 'noopener', target: '_blank' }, node);
        el.append(node);
      });
    }
  }

  const paintPage = () => {
    const d = doc();
    page.dir = d.rtl ? 'rtl' : 'ltr';
    page.lang = d.lang ? langCode(d.lang) : 'en-GB';
    const kids: HTMLElement[] = [];
    let list: HTMLElement | null = null;
    for (const b of d.blocks) {
      if (b.t === 'ul' || b.t === 'ol') {
        if (!list || list.tagName.toLowerCase() !== b.t) {
          list = h(b.t === 'ul' ? 'ul.dcl' : 'ol.dcl');
          kids.push(list);
        }
        list.append(blockEl(b));
        continue;
      }
      list = null;
      kids.push(blockEl(b));
    }
    clear(page, ...kids);
    if (focused) {
      const f = elOf(focused);
      if (!f) focused = '';
    }
  };
  /** The pictures of the document are read from the phone's database and put on the page (a missing one said). */
  const hydrate = async (d: Doc) => {
    const ids = d.blocks.flatMap((b) => (b.img ? [b.img] : []));
    if (!ids.length) return;
    const missing = await loadImages(ids);
    if (hist?.doc.id !== d.id) return;
    paintImages();
    if (missing.length) say(`${missing.length} picture${missing.length === 1 ? ' is' : 's are'} not on this phone any more (the Word file or the PDF would leave ${missing.length === 1 ? 'it' : 'them'} out).`);
  };
  const paintImages = () => {
    for (const fig of page.querySelectorAll<HTMLElement>('figure.dcimg')) {
      const b = doc().blocks.find((x) => x.id === fig.dataset.id);
      const src = b?.img ? imageNow(b.img) : null;
      const img = fig.querySelector('img');
      if (src && img) {
        img.src = src;
        fig.classList.remove('wait');
      }
    }
  };

  const setType = (t: BlockType | 'toggle', kind?: BlockType) => {
    const id = focused;
    const b = doc().blocks.find((x) => x.id === id);
    if (!b || !plainBlock(b)) return say('Tap a paragraph first.');
    const el = elOf(id);
    const runs = el ? readRuns(el) : b.runs;
    const to = (kind ?? t) as BlockType;
    change(withBlock(doc(), id, (x) => ({ ...x, runs, t: x.t === to && to !== 'p' ? 'p' : to })));
    elOf(id)?.focus();
  };
  const setAlign = (a: Align) => {
    const id = focused;
    const b = doc().blocks.find((x) => x.id === id);
    if (!b || b.t === 'table' || b.t === 'pb') return say('Tap a paragraph or a picture first.');
    const el = elOf(id);
    const runs = el && plainBlock(b) ? readRuns(el) : b.runs;
    change(withBlock(doc(), id, (x) => ({ ...x, runs, ...(a === 'left' ? { align: undefined } : { align: a }) })));
    elOf(id)?.focus();
  };
  const mark = (cmd: 'bold' | 'italic' | 'underline') => {
    const el = elOf(focused) ?? (cell.id === focused ? page.querySelector<HTMLElement>(`[data-id="${focused}"] [data-r="${cell.r}"][data-c="${cell.c}"]`) : null);
    if (!el || !el.isContentEditable) {
      const c = document.activeElement as HTMLElement | null;
      if (c && page.contains(c) && c.isContentEditable) {
        document.execCommand(cmd);
        return sync(c);
      }
      return say('Choose the words first.');
    }
    document.execCommand(cmd);
    sync(el);
  };
  /** Where a point inside a paragraph falls, as a count of its letters. */
  const offsetIn = (el: HTMLElement, node: Node, off: number): number => {
    const r = document.createRange();
    r.setStart(el, 0);
    r.setEnd(node, off);
    const box = document.createElement('div');
    box.append(r.cloneContents());
    return readRuns(box).reduce((n, x) => n + x.text.length, 0);
  };
  const pointIn = (el: HTMLElement, at: number): [Node, number] => {
    let left = at;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let last: Node | null = null;
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (left <= len) return [node, left];
      left -= len;
      last = node;
      node = walker.nextNode();
    }
    return last ? [last, last.textContent?.length ?? 0] : [el, el.childNodes.length];
  };
  /** STRIKE and HIGHLIGHT: the chosen words get the mark (or lose it, when they all have it), and stay chosen. */
  const markWords = (what: 's' | 'hl') => {
    const sel = getSelection();
    const live = sel?.rangeCount && page.contains(sel.anchorNode) ? sel.getRangeAt(0) : lastRange;
    const host = live ? (live.startContainer.nodeType === Node.ELEMENT_NODE ? (live.startContainer as HTMLElement) : live.startContainer.parentElement)?.closest<HTMLElement>('.dcb[data-id]') : null;
    const b = host ? doc().blocks.find((x) => x.id === host.dataset.id) : undefined;
    if (!live || live.collapsed || !host || !host.isConnected || !b || !plainBlock(b) || !host.contains(live.endContainer)) return say(host?.closest('.dctable') ? 'Strike and highlight work on a paragraph’s words; a table cell keeps bold, italic and underline.' : 'Choose the words first (press and hold, then drag).');
    clearTimeout(timer);
    const start = offsetIn(host, live.startContainer, live.startOffset);
    const end = offsetIn(host, live.endContainer, live.endOffset);
    const words = readRuns(host);
    host.blur();
    const [a, rest] = splitRuns(words, start);
    const [m, z] = splitRuns(rest, end - start);
    const all = m.length > 0 && m.every((r) => r[what]);
    const marked = m.map((r) => ({ ...r, [what]: all ? undefined : true }));
    change(withBlock(doc(), b.id, (x) => ({ ...x, runs: tidyRuns([...a, ...marked, ...z]) })));
    const el = elOf(b.id);
    if (el) {
      el.focus();
      const r = document.createRange();
      r.setStart(...pointIn(el, start));
      r.setEnd(...pointIn(el, end));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
    }
    say(`${what === 's' ? (all ? 'Strike taken off' : 'Struck through') : all ? 'Highlight taken off' : 'Highlighted'}. UNDO puts it back.`);
  };
  const removeBlock = (id: string) => {
    const d = doc();
    const k = d.blocks.findIndex((x) => x.id === id);
    if (k < 0) return;
    const rest = d.blocks.filter((x) => x.id !== id);
    change({ ...d, blocks: rest.length ? rest : [block('p', '')] });
    focused = '';
    const near = rest[Math.min(k, rest.length - 1)];
    if (near) elOf(near.id)?.focus();
    paintContext();
  };

  // ---------------------------------------------------------------- the formatting keys: WRITE, INSERT, PAGE, LINK
  const key = (label: string, run: () => void, cls = '', name = '') => {
    const b = button(label, run, cls);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  const linkIn = h('input', { type: 'url', placeholder: 'https://… or an email address', 'aria-label': 'The address to link to', autocomplete: 'off', autocapitalize: 'none', enterKeyHint: 'done' }) as HTMLInputElement;
  const linkBox = h('div.dcrow.dclink');
  linkBox.hidden = true;
  const applyLink = () => {
    const href = safeLink(linkIn.value);
    if (!href) return say('That is not an address I can link to: use https://…, an email address or tel:.');
    const sel = getSelection();
    if (!lastRange || lastRange.collapsed) return say('Choose the words to link first, then LINK.');
    const host = (lastRange.startContainer.parentElement ?? lastRange.startContainer) as HTMLElement;
    const el = host.closest<HTMLElement>('[contenteditable="true"]');
    if (!el) return say('Choose the words to link first.');
    el.focus();
    sel?.removeAllRanges();
    sel?.addRange(lastRange);
    document.execCommand('createLink', false, href);
    sync(el);
    linkBox.hidden = true;
    linkIn.value = '';
    say(`Linked to ${href}.`);
  };
  const removeLink = () => {
    const sel = getSelection();
    if (!lastRange) return say('Tap the linked words first.');
    const host = (lastRange.startContainer.parentElement ?? lastRange.startContainer) as HTMLElement;
    const el = host.closest<HTMLElement>('[contenteditable="true"]');
    if (!el) return say('Tap the linked words first.');
    el.focus();
    sel?.removeAllRanges();
    sel?.addRange(lastRange);
    if (lastRange.collapsed) {
      const a = (lastRange.startContainer.parentElement ?? el).closest('a');
      if (a) {
        const r = document.createRange();
        r.selectNodeContents(a);
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
    }
    document.execCommand('unlink');
    sync(el);
    linkBox.hidden = true;
    say('The link is taken off the words.');
  };
  clear(linkBox, linkIn, key('APPLY', applyLink, 'on'), key('REMOVE LINK', removeLink), key('CANCEL', () => (linkBox.hidden = true)));
  linkIn.addEventListener('keydown', (e) => e.key === 'Enter' && applyLink());

  const photoIn = h('input', { type: 'file', hidden: true, accept: 'image/*', 'aria-label': 'Choose a photo to put in the document' }) as HTMLInputElement;
  photoIn.addEventListener('change', async () => {
    const f = photoIn.files?.[0];
    photoIn.value = '';
    if (!f) return;
    say('Putting the photo in…');
    try {
      const p = await addPhoto(f);
      insertAfter([{ id: blockId(), t: 'img', runs: [], img: p.id, iw: p.iw, ih: p.ih, w: 60, align: 'center' }]);
      paintImages();
      say(`Photo added (${p.iw} × ${p.ih}, kept on this phone only). SMALLER and LARGER size it; describe it for people who cannot see it.`);
    } catch (e) {
      say(sayError(e, 'add it'));
    }
  });
  const grid = { rows: 3, cols: 3 };
  const gridSaid = h('b.dcnum', { 'aria-live': 'polite' });
  const paintGrid = () => (gridSaid.textContent = `${grid.rows} × ${grid.cols}`);
  paintGrid();
  const step = (k: 'rows' | 'cols', by: number) => {
    grid[k] = Math.max(1, Math.min(k === 'rows' ? 12 : 8, grid[k] + by));
    paintGrid();
  };
  const tableOp = (op: 'row+' | 'col+' | 'row-' | 'col-' | 'head' | 'drop') => {
    const d = doc();
    const b = d.blocks.find((x) => x.id === focused);
    if (!b || b.t !== 'table' || !b.rows) return say('Tap a cell of the table first.');
    syncTable(elOf(b.id)!);
    const t = doc().blocks.find((x) => x.id === b.id)!;
    let rows = (t.rows ?? []).map((r) => r.map((c) => [...c]));
    const r0 = cell.id === b.id ? Math.min(cell.r, rows.length - 1) : rows.length - 1;
    const c0 = cell.id === b.id ? Math.min(cell.c, (rows[0]?.length ?? 1) - 1) : (rows[0]?.length ?? 1) - 1;
    if (op === 'drop') return removeBlock(b.id);
    if (op === 'head') return change(withBlock(doc(), b.id, (x) => ({ ...x, head: !x.head })));
    if (op === 'row+') rows.splice(r0 + 1, 0, Array.from({ length: rows[0]?.length ?? 1 }, () => []));
    else if (op === 'col+') rows = rows.map((r) => [...r.slice(0, c0 + 1), [], ...r.slice(c0 + 1)]);
    else if (op === 'row-') {
      if (rows.length <= 1) return say('A table keeps at least one row: DELETE TABLE takes it away.');
      rows.splice(r0, 1);
    } else if (op === 'col-') {
      if ((rows[0]?.length ?? 1) <= 1) return say('A table keeps at least one column: DELETE TABLE takes it away.');
      rows = rows.map((r) => r.filter((_, i) => i !== c0));
    }
    change(withBlock(doc(), b.id, (x) => ({ ...x, rows })));
    say(op === 'row+' ? 'A row added below.' : op === 'col+' ? 'A column added to the right.' : op === 'row-' ? 'The row is deleted.' : 'The column is deleted.');
  };
  const sizePic = (by: number) => {
    const b = doc().blocks.find((x) => x.id === focused);
    if (!b || b.t !== 'img') return say('Tap the picture first.');
    const w = Math.max(10, Math.min(100, (b.w ?? 60) + by));
    change(withBlock(doc(), b.id, (x) => ({ ...x, w })));
    elOf(b.id)?.focus();
    say(`The picture is ${w}% of the page’s width.`);
  };
  const altIn = h('input', { type: 'text', placeholder: 'Describe the picture', 'aria-label': 'Describe the picture', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const setAlt = () => {
    const b = doc().blocks.find((x) => x.id === focused);
    if (!b || b.t !== 'img') return say('Tap the picture first.');
    change(withBlock(doc(), b.id, (x) => ({ ...x, alt: altIn.value.trim() })));
    say('The picture’s description is kept (Word reads it out to people who cannot see it).');
  };
  altIn.addEventListener('keydown', (e) => e.key === 'Enter' && setAlt());
  const ctxTable = h('div.dcrow.dcctx', key('+ ROW', () => tableOp('row+'), '', 'Add a row below'), key('+ COLUMN', () => tableOp('col+'), '', 'Add a column to the right'), key('− ROW', () => tableOp('row-'), '', 'Delete this row'), key('− COLUMN', () => tableOp('col-'), '', 'Delete this column'), key('HEADER ROW', () => tableOp('head')), key('DELETE TABLE', () => tableOp('drop')));
  const ctxImg = h('div.dcrow.dcctx', key('SMALLER', () => sizePic(-10)), key('LARGER', () => sizePic(10)), altIn, key('SET', setAlt), key('DELETE PICTURE', () => focused && removeBlock(focused)));
  const paintContext = () => {
    const b = hist?.doc.blocks.find((x) => x.id === focused);
    ctxTable.hidden = b?.t !== 'table';
    ctxImg.hidden = b?.t !== 'img';
    if (b?.t === 'img') altIn.value = b.alt ?? '';
    pbDrop.hidden = b?.t !== 'pb';
  };
  const pbDrop = key('DELETE PAGE BREAK', () => focused && removeBlock(focused));
  pbDrop.hidden = true;

  const pageIn = (patch: Partial<PageSetup>) => {
    const next: PageSetup = { ...pageOf(doc()), ...patch };
    change({ ...doc(), page: next }, false);
    say(`Page set: ${next.size === 'a4' ? 'A4' : 'Letter'}, ${next.margin} margins, ${next.landscape ? 'landscape' : 'portrait'}, page numbers ${next.numbers ? 'on' : 'off'}. ${docsState.pages} page${docsState.pages === 1 ? '' : 's'}.`);
  };
  const sizeSel = h('select', { 'aria-label': 'Paper size' }, h('option', { value: 'a4' }, 'A4'), h('option', { value: 'letter' }, 'Letter')) as HTMLSelectElement;
  const marginSel = h('select', { 'aria-label': 'Margins' }, h('option', { value: 'normal' }, 'Normal margins (2.5 cm)'), h('option', { value: 'narrow' }, 'Narrow margins (1.3 cm)'), h('option', { value: 'wide' }, 'Wide margins (3.8 cm)')) as HTMLSelectElement;
  sizeSel.addEventListener('change', () => pageIn({ size: sizeSel.value as PageSetup['size'] }));
  marginSel.addEventListener('change', () => pageIn({ margin: marginSel.value as PageSetup['margin'] }));
  const headIn = h('input', { type: 'text', placeholder: 'A line at the head of every page', 'aria-label': 'Header line', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const footIn = h('input', { type: 'text', placeholder: 'A line at the foot of every page', 'aria-label': 'Footer line', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  headIn.addEventListener('change', () => pageIn({ header: headIn.value.trim() }));
  footIn.addEventListener('change', () => pageIn({ footer: footIn.value.trim() }));
  const orient = key('PORTRAIT', () => pageIn({ landscape: !pageOf(doc()).landscape }));
  const nums = key('PAGE NUMBERS', () => pageIn({ numbers: !pageOf(doc()).numbers }));
  const paintPageKeys = () => {
    const pg = pageOf(doc());
    sizeSel.value = pg.size;
    marginSel.value = pg.margin;
    headIn.value = pg.header ?? '';
    footIn.value = pg.footer ?? '';
    orient.textContent = pg.landscape ? 'LANDSCAPE' : 'PORTRAIT';
    orient.setAttribute('aria-pressed', String(!!pg.landscape));
    nums.setAttribute('aria-pressed', String(pg.numbers));
  };

  const panels: Record<string, HTMLElement> = {
    write: h('div.dcpanel', { role: 'tabpanel', 'aria-label': 'Write' },
      h('div.dcrow', key('TEXT', () => setType('p'), '', 'Plain paragraph'), key('H1', () => setType('h1'), '', 'Heading 1'), key('H2', () => setType('h2'), '', 'Heading 2'), key('H3', () => setType('h3'), '', 'Heading 3'), key('QUOTE', () => setType('quote'))),
      h('div.dcrow', key('B', () => mark('bold'), 'dcbold', 'Bold'), key('I', () => mark('italic'), 'dcital', 'Italic'), key('U', () => mark('underline'), 'dcund', 'Underline'), key('S', () => markWords('s'), 'dcstrike', 'Strikethrough'), key('MARK', () => markWords('hl'), 'dcmark', 'Highlight'), key('LINK', () => {
        linkBox.hidden = !linkBox.hidden;
        if (!linkBox.hidden) linkIn.focus();
      })),
      linkBox,
      h('div.dcrow', key('• LIST', () => setType('ul')), key('1. LIST', () => setType('ol')), key('☐ CHECKLIST', () => setType('todo'), '', 'Checklist')),
      h('div.dcrow', key('LEFT', () => setAlign('left'), '', 'Align left'), key('CENTRE', () => setAlign('center'), '', 'Centre'), key('RIGHT', () => setAlign('right'), '', 'Align right'), key('JUSTIFY', () => setAlign('justify'))),
    ),
    insert: h('div.dcpanel', { role: 'tabpanel', 'aria-label': 'Insert' },
      h('div.dcrow', key('PHOTO', () => photoIn.click(), '', 'Add a photo from your photos'), key('PAGE BREAK', () => insertAfter([{ id: blockId(), t: 'pb', runs: [] }])), pbDrop),
      ctxImg,
      h('div.dcrow.dcgrid', key('ROWS −', () => step('rows', -1)), key('ROWS +', () => step('rows', 1)), gridSaid, key('COLUMNS −', () => step('cols', -1)), key('COLUMNS +', () => step('cols', 1)), key('INSERT TABLE', () => {
        insertAfter([newTable(grid.rows, grid.cols)]);
        say(`A ${grid.rows} × ${grid.cols} table, its first row the header. Tab moves to the next cell.`);
        (page.querySelector(`[data-id="${focused}"] th, [data-id="${focused}"] td`) as HTMLElement | null)?.focus();
      }, 'on')),
      ctxTable,
    ),
    page: h('div.dcpanel', { role: 'tabpanel', 'aria-label': 'Page' },
      h('div.dcrow', sizeSel, marginSel),
      h('div.dcrow', orient, nums),
      h('div.dcrow', headIn),
      h('div.dcrow', footIn),
    ),
  };
  const showPanel = (id: string) => {
    docsState.panel = id;
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== id;
    for (const b of pills.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.panel === id));
    if (id === 'page') paintPageKeys();
    paintContext();
  };
  const pills = h('div.dcpills', { role: 'tablist', 'aria-label': 'Editing keys' }, ...(['write', 'insert', 'page'] as const).map((id) => {
    const b = button(id.toUpperCase(), () => showPanel(id), 'dcpill');
    b.dataset.panel = id;
    b.setAttribute('role', 'tab');
    return b;
  }));

  // ---------------------------------------------------------------- reading aloud
  let reading = false;
  function stopReading(): void {
    if (!reading) return;
    reading = false;
    speechSynthesis?.cancel();
    page.querySelectorAll('.reading').forEach((e) => e.classList.remove('reading'));
    docsState.reading = '';
  }
  const readAloud = (btn: HTMLButtonElement) => {
    if (reading) {
      stopReading();
      btn.textContent = 'READ IT TO ME';
      return;
    }
    if (typeof speechSynthesis === 'undefined') return say('This phone’s browser has no voice to read with.');
    const d = doc();
    const list = d.blocks.filter((b) => textOf(b).trim());
    reading = true;
    btn.textContent = 'STOP READING';
    const lang = d.lang ? langCode(d.lang) : 'en-GB';
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    const next = (k: number) => {
      page.querySelectorAll('.reading').forEach((e) => e.classList.remove('reading'));
      if (!reading || k >= list.length) {
        stopReading();
        btn.textContent = 'READ IT TO ME';
        return;
      }
      const b = list[k]!;
      const el = elOf(b.id);
      el?.classList.add('reading');
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const words = k === 0 ? `${d.title}. ${textOf(b)}` : textOf(b);
      docsState.reading = words;
      const u = new SpeechSynthesisUtterance(words);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.onend = () => next(k + 1);
      u.onerror = () => next(list.length);
      speechSynthesis.speak(u);
    };
    say(`Reading it to you in this phone’s voice${voice ? ` (${voice.name})` : ''}.`);
    next(0);
  };

  // ---------------------------------------------------------------- find and replace
  const findIn_ = h('input', { type: 'search', placeholder: 'Find', 'aria-label': 'Find in the document', enterKeyHint: 'search' }) as HTMLInputElement;
  const replaceIn = h('input', { type: 'text', placeholder: 'Replace with', 'aria-label': 'Replace with', autocomplete: 'off' }) as HTMLInputElement;
  const findSaid = h('small.dcfound', { 'aria-live': 'polite' });
  let findAt = 0;
  const paintFind = () => {
    page.querySelectorAll('.found').forEach((e) => e.classList.remove('found'));
    const hits = findIn(doc(), findIn_.value.trim());
    hits.forEach((x) => elOf(x.id)?.classList.add('found'));
    const n = hits.reduce((a, x) => a + x.count, 0);
    findSaid.textContent = findIn_.value.trim() ? (n ? `${n} found, in ${hits.length} paragraph${hits.length === 1 ? '' : 's'}` : 'Not found') : '';
    return hits;
  };
  findIn_.addEventListener('input', () => {
    findAt = 0;
    paintFind();
  });
  const findNext = () => {
    const hits = paintFind();
    if (!hits.length) return;
    const el = elOf(hits[findAt % hits.length]!.id);
    findAt++;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  findIn_.addEventListener('keydown', (e) => e.key === 'Enter' && findNext());
  clear(findBox,
    h('div.dcrow', findIn_, button('NEXT', findNext)),
    h('div.dcrow', replaceIn, button('REPLACE ALL', () => {
      const r = replaceAll(doc(), findIn_.value.trim(), replaceIn.value);
      if (!r.count) return say(r.skipped ? 'Those words cross from plain into bold or italic: change them by hand.' : 'Nothing found to replace.');
      change(r.doc);
      say(`Replaced ${r.count} time${r.count === 1 ? '' : 's'}${r.skipped ? `; ${r.skipped} more cross into bold or italic and are left` : ''}. UNDO puts it back.`);
    })),
    findSaid,
  );

  // ---------------------------------------------------------------- the brain's edits, as suggestions
  const paintSuggestions = () => {
    docsState.suggestions = suggestions.map((s) => ({ old: s.old, new: s.new }));
    if (!suggestions.length) return clear(sugBox);
    clear(sugBox,
      h('div.dcsughead', h('b', `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`), h('small', 'The old words struck, the new beside them. Nothing changes until you accept it.'),
        h('div.dcrow', button('ACCEPT ALL', () => {
          let d = doc();
          for (const s of suggestions) d = accept(d, s);
          docsState.accepted += suggestions.length;
          suggestions = [];
          change(d);
        }), button('REJECT ALL', () => {
          suggestions = [];
          paintSuggestions();
        }))),
      ...suggestions.map((s) => h('div.dcsug',
        h('p.dcdiff', ...wordDiff(s.old, s.new).map((x) => (x.gone !== undefined ? h('del', x.gone) : x.came !== undefined ? h('ins', x.came) : document.createTextNode(x.same ?? '')))),
        h('div.dcrow',
          button('ACCEPT', () => {
            suggestions = suggestions.filter((x) => x !== s);
            docsState.accepted++;
            change(accept(doc(), s));
            say('Accepted. UNDO takes it back.');
          }, 'on'),
          button('REJECT', () => {
            suggestions = suggestions.filter((x) => x !== s);
            paintSuggestions();
          }),
        ),
      )),
    );
  };
  /** A change the brain's `document` tool proposed: marked in the page with the others, nothing applied; his ACCEPT or REJECT decides. */
  const proposeHere = (args: Record<string, unknown>): string => {
    const f = hist ? proposalFrom(doc(), args) : 'No document is open.';
    if (typeof f === 'string') {
      say(f);
      return f;
    }
    suggestions = [...suggestions.filter((x) => x.id !== f.id), f];
    paintSuggestions();
    const words = `Ghosty marked ${f.append ? 'words to add at the end' : 'a change'} in the page: ACCEPT applies it, REJECT leaves your words as they were.`;
    say(words);
    return words;
  };
  const askEdit = async (kind: EditKind) => {
    const el = elOf(focused);
    if (el) sync(el);
    say(`Asking my brain: ${EDITS[kind].label.toLowerCase()}. Your words go to it as this message's data; nothing changes until you accept.`);
    try {
      const r = await suggestEdits(doc(), kind);
      suggestions = r.list;
      paintSuggestions();
      say(r.list.length ? `${r.list.length} suggestion${r.list.length === 1 ? '' : 's'} from ${r.where === 'phone' ? 'the brain on this phone' : 'my brain'}: accept or reject each one.` : 'My brain suggested no changes.');
    } catch (e) {
      say(sayError(e, 'ask'));
    }
  };

  // ---------------------------------------------------------------- translation and letters, side by side
  const showPair = (left: Doc, right: Doc, note: string, label = right.lang ? right.lang.toUpperCase() : 'LATIN LETTERS') => {
    setLiveDoc(null);
    stopReading();
    docsState.view = 'pair';
    docsState.pair = { left: left.blocks.map(textOf).join('\n'), right: right.blocks.map(textOf).join('\n'), rtl: !!right.rtl, lang: right.lang ?? '' };
    const col = (d: Doc, label: string) => h('div.dccol', { dir: d.rtl ? 'rtl' : 'ltr', lang: d.lang ? langCode(d.lang) : 'en-GB' }, h('small.dccolh', label), ...d.blocks.map((b) => h(isHeading(b.t) ? 'h4' : 'p', { className: b.t === 'ul' || b.t === 'ol' ? 'dcitem' : b.t === 'right' ? 'right' : '' }, textOf(b))));
    clear(view,
      h('div.dcrow', button('BACK TO THE DOCUMENT', () => showDoc(left)), button('KEEP IT', () => {
        saveDoc(right);
        say(`Kept in My documents: “${right.title}”.`);
      }, 'on'), button('OPEN IT TO EDIT', () => {
        saveDoc(right);
        showDoc(right);
      })),
      h('p.dcnote', note),
      h('div.dcpair', col(left, 'ORIGINAL'), col(right, label)),
      exportRow(() => right),
    );
  };
  const langPick = h('select', { 'aria-label': 'The language to translate into' }, ...LANGUAGES.map((l) => h('option', { value: l }, l)), h('option', { value: '' }, 'Another…')) as HTMLSelectElement;
  const langOther = h('input', { type: 'text', placeholder: 'Any language, by name', 'aria-label': 'Another language, by name', autocomplete: 'off', hidden: true }) as HTMLInputElement;
  langPick.addEventListener('change', () => (langOther.hidden = langPick.value !== ''));
  const translate = async (language?: string) => {
    const lang = (language ?? (langPick.value || langOther.value)).trim();
    if (!lang) return say('Pick a language, or type its name.');
    const el = elOf(focused);
    if (el) sync(el);
    say(`Translating into ${lang}, paragraph by paragraph…`);
    try {
      const r = await translateDoc(doc(), lang, (done, of) => say(`Translating into ${lang}: ${done} of ${of} paragraphs…`));
      showPair(doc(), r.doc, `${r.where === 'phone' ? 'Translated by the brain on this phone (rough: a small model).' : 'Translated by my brain.'} Any language my brain writes can be asked for by name.${r.missing ? ` ${r.missing} paragraph${r.missing === 1 ? ' was' : 's were'} not translated and ${r.missing === 1 ? 'is' : 'are'} kept as ${r.missing === 1 ? 'it was' : 'they were'}.` : ''}`);
      say(`Translated into ${lang}.`);
    } catch (e) {
      say(sayError(e, 'translate it'));
    }
  };
  const scriptPick = h('select', { 'aria-label': 'The script' }, ...SCRIPTS.map((s) => h('option', { value: s.id }, s.name))) as HTMLSelectElement;
  const letters = (dir: 'to' | 'from') => {
    const d = doc();
    const sc = (SCRIPTS.find((s) => s.id === scriptPick.value) ?? scriptOf(d.blocks.map(textOf).join(' '))) as Script;
    if (dir === 'from' && !sc.back) return say(`${sc.name} does not come back from Latin letters one to one, so I only go the other way.`);
    const conv = (t: string) => (dir === 'to' ? toLatin(t, sc.id) : fromLatin(t, sc.id) ?? t);
    const out = newDoc(`${conv(d.title)}`, d.blocks.map((b) => ({ ...b, id: `${b.id}l`, runs: b.runs.map((r) => ({ ...r, text: conv(r.text) })) })), 'translation', d.title);
    const shown: Doc = dir === 'from' && (sc.id === 'arabic' || sc.id === 'urdu' || sc.id === 'hebrew') ? { ...out, rtl: true } : out;
    showPair(d, shown, `${THE_LINE} ${dir === 'to' ? `${sc.name} to Latin letters` : `Latin letters to ${sc.name}`}, by its table.`, dir === 'to' ? 'LATIN LETTERS' : sc.name.toUpperCase());
  };

  // ---------------------------------------------------------------- export
  const exportRow = (get: () => Doc) => {
    const out = h('div.dcouts');
    const made = (blob: Blob, name: string) => {
      docsState.exported.push({ name, size: blob.size, type: blob.type });
      clear(out, h('div.cvout', h('div.cvoutt', h('b', name), h('small', sizeWords(blob.size))), h('div.cvbtns', button('SAVE', () => saveBlob(blob, name)), button('SHARE', () => void shareOrSave(blob, name)))));
      say(`Made on this phone: ${name}, ${sizeWords(blob.size)}.`);
    };
    const file = (ext: string) => `${get().title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'Document'}.${ext}`;
    /** The document's pictures are in memory before a file is made. */
    const ready = async (): Promise<Doc> => {
      flush();
      const d = get();
      await loadImages(d.blocks.flatMap((b) => (b.img ? [b.img] : [])));
      return d;
    };
    const go = (make: (d: Doc) => Promise<Blob> | Blob, ext: string) => {
      say(`Making your ${ext === 'docx' ? 'Word file' : ext === 'md' ? 'Markdown file' : ext === 'html' ? 'web page' : 'PDF'} on this phone…`);
      void ready().then(make).then((blob) => made(blob, file(ext)), (e: Error) => say(sayError(e, 'make that file')));
    };
    return h('div.dcexport',
      h('small.cvgh', 'EXPORT'),
      h('div.cvbtns',
        button('PDF', () => {
          go(async (d) => new Blob([(await pdfOfDocAnyScript(d, say)) as BlobPart], { type: 'application/pdf' }), 'pdf');
        }),
        button('WORD', () => go((d) => new Blob([docxFrom(d, myName(), imageBytes) as BlobPart], { type: MIME.docx }), 'docx')),
        button('MARKDOWN', () => go((d) => new Blob([toMarkdown(d, imageNow)], { type: 'text/markdown;charset=utf-8' }), 'md')),
        cased(button('HTML', () => go((d) => new Blob([toHtml(d, true, imageNow)], { type: 'text/html;charset=utf-8' }), 'html'))),
      ),
      out,
    );
  };

  // ---------------------------------------------------------------- Ghosty writing into the page
  const askIn = h('input', { type: 'text', placeholder: 'What should Ghosty write? (“a paragraph asking for a refund”)', 'aria-label': 'What Ghosty should write into the document', autocomplete: 'off', enterKeyHint: 'send' }) as HTMLInputElement;
  const writeInto = async () => {
    const what = askIn.value.trim();
    if (!what) return say('Say what to write first.');
    flush();
    const after = doc().blocks.find((x) => x.id === focused);
    say('Asking my brain to write it. Your document’s words go to it as this message’s data; the new words are laid out after the paragraph you are in.');
    try {
      const r = await askBrain(writeMessage(doc(), what, after && plainBlock(after) ? textOf(after) : ''));
      const blocks = writtenBlocks(r.text);
      if (!blocks.length) return say('My brain wrote nothing I could lay out.');
      insertAfter(blocks);
      askIn.value = '';
      say(`${blocks.length} paragraph${blocks.length === 1 ? '' : 's'} written into the page by ${r.where === 'phone' ? 'the brain on this phone' : 'my brain'}. UNDO takes them out again.`);
    } catch (e) {
      say(sayError(e, 'ask'));
    }
  };
  const rewriteHere = async () => {
    flush();
    const b = doc().blocks.find((x) => x.id === focused);
    if (!b || !plainBlock(b) || !textOf(b).trim()) return say('Tap the paragraph to rewrite first.');
    say('Asking my brain to rewrite this paragraph; nothing changes until you accept.');
    try {
      const r = await askBrain(rewriteMessage(textOf(b), askIn.value));
      const words = writtenBlocks(r.text).map(textOf).join(' ').trim();
      if (!words || words === textOf(b).trim()) return say('My brain would keep it as it is.');
      suggestions = [{ id: `r-${b.id}`, blockId: b.id, old: textOf(b), new: words }];
      paintSuggestions();
      say('One suggestion: accept or reject it.');
    } catch (e) {
      say(sayError(e, 'ask'));
    }
  };
  const tellHere = async () => {
    const what = askIn.value.trim();
    if (!what) return say('Say what to change first (“make the second paragraph shorter”).');
    flush();
    say('Asking my brain. It reads this document as the message’s data and can only mark a change here; nothing changes until you accept it.');
    try {
      const r = await tellGhosty(what, openDocData(doc()), (a) => void proposeHere(a));
      askIn.value = '';
      say(r.proposed ? `${r.proposed} change${r.proposed === 1 ? '' : 's'} marked in the page: accept or reject ${r.proposed === 1 ? 'it' : 'each'}.${r.text ? ` ${r.text}` : ''}` : r.text || 'My brain made no change.');
    } catch (e) {
      say(sayError(e, 'ask'));
    }
  };
  askIn.addEventListener('keydown', (e) => e.key === 'Enter' && void writeInto());

  // ---------------------------------------------------------------- the document view
  function render(): void {
    const d = doc();
    paintState();
    paintPage();
    const title = h('input.dctitle', { type: 'text', value: d.title, 'aria-label': 'The document’s title' }) as HTMLInputElement;
    title.addEventListener('change', () => change({ ...doc(), title: title.value.trim() || 'Untitled' }, false));
    const tools = h('div.dctools', { role: 'toolbar', 'aria-label': 'Editing' },
      button('CONTENTS', () => {
        contentsBox.hidden = !contentsBox.hidden;
        const c = contents(doc());
        clear(contentsBox, ...(c.length ? c.map((x) => button(x.text, () => elOf(x.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), `dclevel${x.level}`)) : [h('small', 'No headings in it.')]));
      }),
      button('READ IT TO ME', (b) => readAloud(b)),
      button('FIND', () => {
        findBox.hidden = !findBox.hidden;
        if (!findBox.hidden) findIn_.focus();
      }),
      button('UNDO', () => {
        if (!hist!.canUndo) return say('Nothing to undo.');
        flush();
        hist!.undo();
        keep(doc());
        render();
      }),
      button('REDO', () => {
        if (!hist!.canRedo) return say('Nothing to redo.');
        hist!.redo();
        keep(doc());
        render();
      }),
    );
    // the keys keep the words chosen (a tap on them does not take the focus off the paragraph)
    for (const bar of [tools, pills, ...Object.values(panels)]) {
      bar.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      });
    }
    const asks = h('div.dcasks', h('small.cvgh', 'ASK ME TO'), h('div.cvbtns', ...(Object.keys(EDITS) as EditKind[]).map((k) => cased(button(EDITS[k].label, () => void askEdit(k))))));
    const write = h('div.dcasks.dcwrite', h('small.cvgh', 'GHOSTY WRITES IN IT'), h('div.dcrow', askIn), h('div.cvbtns', button('WRITE INTO IT', () => void writeInto(), 'on'), button('REWRITE THIS PARAGRAPH', () => void rewriteHere()), button('ASK GHOSTY', () => void tellHere())));
    const trans = h('div.dcasks', h('small.cvgh', 'TRANSLATE'), h('div.dcrow', langPick, langOther, button('TRANSLATE', () => void translate(), 'on')));
    const sc = scriptOf(d.blocks.map(textOf).join(' '));
    if (sc) scriptPick.value = sc.id;
    const lets = h('div.dcasks', h('small.cvgh', 'LETTERS'), h('div.dcrow', scriptPick, cased(button('TO LATIN', () => letters('to')), 'To Latin'), cased(button('FROM LATIN', () => letters('from')), 'From Latin')), h('small.dcnote', THE_LINE));
    clear(view, title, metaEl, savedEl, tools, findBox, contentsBox, pills, ...Object.values(panels), photoIn, sugBox, page, asks, write, trans, lets, exportRow(doc), h('div.dcrow', button('REMOVE FROM MY DOCUMENTS', () => {
      removeDoc(doc().id);
      say(`Removed “${doc().title}” from this phone.`);
      showList();
    })));
    showPanel(docsState.panel in panels ? docsState.panel : 'write');
    paintSuggestions();
    if (focused) {
      const f = elOf(focused);
      if (f && document.activeElement !== f && f.matches('figure,hr')) f.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------- open
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    say(`Reading ${f.name} on this phone…`);
    try {
      const d = await readDocBytes(new Uint8Array(await f.arrayBuffer()), f.name);
      const word = /\.docx$/i.test(f.name);
      if (word) saveDoc(d);
      showDoc(d);
      docsState.lost = word ? [...readNotes.lost] : [];
      say(`${d.title}: ${readingWords(d)}. Read here; nothing was sent.${word ? ' Kept in My documents to edit.' : ''}${docsState.lost.length ? ` Left out of the page: ${docsState.lost.join(', ')}.` : ''}`);
    } catch (e) {
      say(sayError(e, 'read it'));
    }
  });
  const bar = h('div.dcbar', button('MY DOCUMENTS', showList), button('NEW', () => {
    const d = newDoc('New document', [block('p', '')], 'document', 'written on this phone');
    saveDoc(d);
    showDoc(d);
    (page.querySelector('.dcb') as HTMLElement | null)?.focus();
  }), button('OPEN A FILE', () => fileIn.click()), fileIn);
  const root = h('div.dcsheet', bar, status, view);
  const start = async (o: DocsAsk) => {
    if (o.doc) {
      showDoc(o.doc);
      keep(o.doc);
    } else if (o.reply) {
      const text = replyText(o.reply);
      if (!text) {
        showList();
        say('That reply is no longer on this phone.');
      } else {
        const d = docFromReply(text, o.ask ?? '', { name: myName(), date: letterDate() });
        saveDoc(d);
        showDoc(d);
        say(`Laid out as a ${d.kind === 'letter' ? 'letter' : 'document'} and kept in My documents.${d.kind === 'letter' && !myName() ? ' Your name isn’t set (Settings → your name), so “[Your name]” stays for you to fill in.' : ''}`);
      }
    } else if (o.id && getDoc(o.id)) showDoc(getDoc(o.id)!);
    else if (o.what === 'new') (bar.children[1] as HTMLButtonElement).click();
    else if (o.what === 'open') {
      showList();
      say('Choose the document to read: PDF, Word, EPUB, a web page, Markdown or text.');
      fileIn.click();
    } else if ((o.what === 'translate' || o.what === 'letters') && listDocs()[0]) {
      showDoc(listDocs()[0]!);
      if (o.what === 'translate' && o.language) void translate(o.language);
      else letters('to');
    } else showList();
  };
  return {
    el: root,
    start,
    stop: () => {
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      setLiveDoc(null);
      stopReading();
    },
  };
}

