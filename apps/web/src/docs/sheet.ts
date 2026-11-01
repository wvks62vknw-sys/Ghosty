/**
 * THE DOCUMENTS SHEET (BRIEF-REST-E part 2; MAKE → DOCUMENTS, "my documents", a reply's "laid out" card): MY DOCUMENTS
 * kept on this phone with their dates; a document READ from a file (PDF, Word, EPUB, HTML, Markdown, text) with its
 * CONTENTS, READ IT TO ME in the phone's voice, FIND; WRITTEN by the brain in the chat and laid out here; EDITED here —
 * paragraphs, headings, bold, italic, lists, find and replace, undo — with the brain's edits as SUGGESTIONS accepted or
 * rejected one by one; TRANSLATED paragraph by paragraph (side by side on a wide screen, stacked on the phone); its
 * letters TRANSLITERATED by tables; exported as PDF, Word, Markdown or HTML. All on the phone but the brain's words.
 */
import { h, clear } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { MIME, sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';
import { readDocBytes, pdfOfDocAnyScript } from './read';
import { docxFrom } from './docx';
import { readingWords } from './layout';
import { myName, replyText, suggestEdits, translateDoc } from './ask';
import { getDoc, letterDate, listDocs, removeDoc, saveDoc, whenWords } from './store';
import { fromLatin, scriptOf, SCRIPTS, THE_LINE, toLatin, type Script } from './translit';
import {
  accept, block, contents, docFromReply, EDITS, findIn, History, isHeading, langCode, LANGUAGES, newDoc, replaceAll, textOf, tidyRuns, toHtml, toMarkdown, withBlock, wordDiff,
  type Block, type BlockType, type Doc, type EditKind, type Run, type Suggestion,
} from './model';

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
};
let current: { close(): void } | null = null;
/** A button that shows its words as written ("In plain English", "HTML"), not in the buttons' sentence case. */
const cased = (b: HTMLButtonElement, words = b.textContent ?? ''): HTMLButtonElement => {
  b.dataset.label = words;
  return b;
};

/** The sheet: a document to open (one read here, a chat reply laid out), or MY DOCUMENTS. */
export async function openDocs(o: { doc?: Doc; reply?: number; ask?: string; id?: string; what?: 'list' | 'new' | 'open' | 'translate' | 'letters'; language?: string } = {}): Promise<void> {
  current?.close();
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.docs = docsState;
  docsState.open = true;
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
  const keep = (d: Doc) => {
    if (d.kind === 'read' && !getDoc(d.id)) return;
    if (saveDoc(d)) docsState.kept = listDocs().length;
  };

  // ---------------------------------------------------------------- MY DOCUMENTS
  const showList = () => {
    stopReading();
    docsState.view = 'list';
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
    render();
  };
  const doc = () => hist!.doc;
  const change = (next: Doc, repaint = true) => {
    hist!.push(next);
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
  };

  const page = h('div.dcpage', { role: 'region', 'aria-label': 'The document: tap a paragraph to edit it' });
  const sugBox = h('div.dcsugs', { 'aria-live': 'polite' });
  const findBox = h('div.dcfind');
  const contentsBox = h('div.dccontents');
  findBox.hidden = true;
  contentsBox.hidden = true;

  function runsOf(node: Node, b = false, i = false, out: Run[] = []): Run[] {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out.push({ text: n.textContent ?? '', ...(b ? { b: true } : {}), ...(i ? { i: true } : {}) });
      else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const tag = el.tagName;
        if (tag === 'BR') out.push({ text: '\n' });
        else if (tag === 'DIV' || tag === 'P') {
          if (out.length && !out[out.length - 1]!.text.endsWith('\n')) out.push({ text: '\n' });
          runsOf(el, b, i, out);
        } else runsOf(el, b || tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(el.style.fontWeight), i || tag === 'I' || tag === 'EM' || el.style.fontStyle === 'italic', out);
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
  const sync = (el: HTMLElement) => {
    const id = el.dataset.id!;
    const runs = readRuns(el);
    const b = doc().blocks.find((x) => x.id === id);
    if (!b || JSON.stringify(b.runs) === JSON.stringify(runs)) return;
    change(withBlock(doc(), id, (x) => ({ ...x, runs })), false);
  };

  const blockEl = (b: Block): HTMLElement => {
    const tag = b.t === 'h1' ? 'h2' : b.t === 'h2' ? 'h3' : b.t === 'h3' ? 'h4' : b.t === 'quote' ? 'blockquote' : b.t === 'ul' || b.t === 'ol' ? 'li' : 'p';
    const el = h(`${tag}.dcb` as 'p', { contentEditable: 'true', spellcheck: true, dataset: { id: b.id, t: b.t } });
    if (b.t === 'right') el.classList.add('right');
    for (const r of b.runs) {
      const parts = r.text.split('\n');
      parts.forEach((p, k) => {
        if (k) el.append(h('br'));
        if (!p) return;
        let node: Node = document.createTextNode(p);
        if (r.i) node = h('em', node);
        if (r.b) node = h('strong', node);
        el.append(node);
      });
    }
    el.addEventListener('focus', () => (focused = b.id));
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => sync(el), 450);
    });
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
        const next: Block = { ...block(b.t === 'ul' || b.t === 'ol' ? b.t : 'p', z) };
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
        e.preventDefault();
        clearTimeout(timer);
        const prev = d.blocks[k - 1]!;
        const at = textOf(prev).length;
        change({ ...d, blocks: [...d.blocks.slice(0, k - 1), { ...prev, runs: tidyRuns([...prev.runs, ...readRuns(el)]) }, ...d.blocks.slice(k + 1)] });
        const pe = elOf(prev.id);
        pe?.focus();
        if (pe) placeCaret(pe, at);
      }
    });
    return el;
  };

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
  };

  const setType = (t: BlockType) => {
    const id = focused;
    const b = doc().blocks.find((x) => x.id === id);
    if (!b) return say('Tap a paragraph first.');
    const el = elOf(id);
    const runs = el ? readRuns(el) : b.runs;
    change(withBlock(doc(), id, (x) => ({ ...x, runs, t: x.t === t ? 'p' : t })));
    elOf(id)?.focus();
  };
  const cycleHeading = () => {
    const b = doc().blocks.find((x) => x.id === focused);
    if (!b) return say('Tap a paragraph first.');
    const next: BlockType = b.t === 'h1' ? 'h2' : b.t === 'h2' ? 'h3' : b.t === 'h3' ? 'p' : 'h1';
    setType(next === 'p' ? b.t : next);
  };
  const mark = (cmd: 'bold' | 'italic') => {
    const el = elOf(focused);
    if (!el) return say('Choose the words first.');
    document.execCommand(cmd);
    sync(el);
  };

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
      say(`I couldn’t ask: ${(e as Error).message}.`);
    }
  };

  // ---------------------------------------------------------------- translation and letters, side by side
  const showPair = (left: Doc, right: Doc, note: string, label = right.lang ? right.lang.toUpperCase() : 'LATIN LETTERS') => {
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
      say(`I couldn’t translate it: ${(e as Error).message}.`);
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
    return h('div.dcexport',
      h('small.cvgh', 'EXPORT'),
      h('div.cvbtns',
        button('PDF', () => {
          say('Laying it out as a PDF…');
          void pdfOfDocAnyScript(get(), say).then((pdf) => made(new Blob([pdf as BlobPart], { type: 'application/pdf' }), file('pdf')), (e: Error) => say(`I couldn’t: ${e.message}.`));
        }),
        button('WORD', () => made(new Blob([docxFrom(get(), myName()) as BlobPart], { type: MIME.docx }), file('docx'))),
        button('MARKDOWN', () => made(new Blob([toMarkdown(get())], { type: 'text/markdown;charset=utf-8' }), file('md'))),
        cased(button('HTML', () => made(new Blob([toHtml(get(), true)], { type: 'text/html;charset=utf-8' }), file('html')))),
      ),
      out,
    );
  };

  // ---------------------------------------------------------------- the document view
  function render(): void {
    const d = doc();
    paintState();
    paintPage();
    const title = h('input.dctitle', { type: 'text', value: d.title, 'aria-label': 'The document’s title' }) as HTMLInputElement;
    title.addEventListener('change', () => change({ ...doc(), title: title.value.trim() || 'Untitled' }, false));
    const meta = h('p.dcmeta', `${readingWords(d)} · ${getDoc(d.id) ? `kept on this phone, ${whenWords(doc().at)}` : 'read from a file, not kept'}`);
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
      button('HEADING', cycleHeading),
      button('B', () => mark('bold'), 'dcbold'),
      button('I', () => mark('italic'), 'dcital'),
      button('• LIST', () => setType('ul')),
      button('1. LIST', () => setType('ol')),
      button('UNDO', () => {
        if (!hist!.canUndo) return say('Nothing to undo.');
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
    // the toolbar keeps the words chosen (a tap on it does not take the focus off the paragraph)
    tools.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) e.preventDefault();
    });
    tools.querySelector('.dcbold')?.setAttribute('aria-label', 'Bold');
    tools.querySelector('.dcital')?.setAttribute('aria-label', 'Italic');
    const asks = h('div.dcasks', h('small.cvgh', 'ASK ME TO'), h('div.cvbtns', ...(Object.keys(EDITS) as EditKind[]).map((k) => cased(button(EDITS[k].label, () => void askEdit(k))))));
    const trans = h('div.dcasks', h('small.cvgh', 'TRANSLATE'), h('div.dcrow', langPick, langOther, button('TRANSLATE', () => void translate(), 'on')));
    const sc = scriptOf(d.blocks.map(textOf).join(' '));
    if (sc) scriptPick.value = sc.id;
    const lets = h('div.dcasks', h('small.cvgh', 'LETTERS'), h('div.dcrow', scriptPick, cased(button('TO LATIN', () => letters('to')), 'To Latin'), cased(button('FROM LATIN', () => letters('from')), 'From Latin')), h('small.dcnote', THE_LINE));
    clear(view, title, meta, tools, findBox, contentsBox, sugBox, page, asks, trans, lets, exportRow(doc), h('div.dcrow', button('REMOVE FROM MY DOCUMENTS', () => {
      removeDoc(doc().id);
      say(`Removed “${doc().title}” from this phone.`);
      showList();
    })));
    paintSuggestions();
  }

  // ---------------------------------------------------------------- open
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    say(`Reading ${f.name} on this phone…`);
    try {
      const d = await readDocBytes(new Uint8Array(await f.arrayBuffer()), f.name);
      showDoc(d);
      say(`${d.title}: ${readingWords(d)}. Read here; nothing was sent.`);
    } catch (e) {
      say(`I couldn’t read it: ${(e as Error).message}.`);
    }
  });
  const bar = h('div.dcbar', button('MY DOCUMENTS', showList), button('NEW', () => {
    const d = newDoc('New document', [block('p', '')], 'document', 'written on this phone');
    saveDoc(d);
    showDoc(d);
    (page.querySelector('.dcb') as HTMLElement | null)?.focus();
  }), button('OPEN A FILE', () => fileIn.click()), fileIn);
  const root = h('div.dcsheet', bar, status, view);
  current = modal('DOCUMENTS', root, () => {
    stopReading();
    docsState.open = false;
    current = null;
  });

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
}

