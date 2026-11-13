/**
 * THE PRESENTATIONS SHEET (BRIEF-EDITOR-PRESENTATIONS; MAKE → PRESENTATIONS, "my slides", the Stage's MAKE SLIDES OF IT): the core of
 * PowerPoint on the phone. MY SLIDES kept on this phone; a deck started from a report (a research answer, one of his documents, any
 * reply with headings), blank, or opened from a .pptx; the deck as a vertical film of slides, a tap opening one to edit: its words in
 * a line above it (never a caret on the slide), its layout from a sheet of nine, a picture, a chart from typed numbers or the
 * Stage's last chart, a table, a shape or two, notes, a transition and the builds; the theme from one sheet repainting every slide;
 * reorder by press and drag or MOVE UP and MOVE DOWN; DUPLICATE; DELETE with UNDO; PRESENT with the notes in his hand; EXPORT as
 * .pptx, PDF (with notes pages if he asks) and one slide as a PNG, the size said; autosave said once; reopened where he was.
 * Everything is on the phone; nothing is sent.
 */
import { h, clear } from '../core/dom';
import { button, modal } from '../ui/components';
import { sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';
import { addImageBytes, addPhoto, imageBytes, imageNow, keepOnly, loadImages } from '../docs/images';
import { getDoc, imagesInUse, listDocs } from '../docs/store';
import { myName } from '../docs/ask';
import { block, blockId, newTable, textOf, tidyRuns, type Block, type Doc, type Run } from '../docs/model';
import { deckFromChart, deckFromDoc, deckFromMarkdown } from './fromreport';
import { approx } from './layout';
import {
  ANIMS, LAYOUTS, SHAPE_NAMES, SLOTS, TRANSITIONS, blankDeck, buildOf, duplicateSlide, elements, History, indexOf, insertSlide, moveSlide, newSlide, plainOf, reshape, removeShape, removeSlide, setBuild, setLayout, setMedia, slideName, slideWords, addShape, deckWords, withSlide,
  type Anim, type ChartData, type Deck, type Elem, type Layout, type Slide, type ShapeKind, type Transition,
} from './model';
import { deckPdf, slidePng } from './export';
import { writePptx } from './pptx';
import { lostWords, readPptx } from './pptxread';
import { canvasMeasure, paletteOf, slideSvg } from './render';
import { getDeck, keepWhere, listDecks, removeDeck, saveDeck, where, whenWords } from './store';
import { THEME_KEYS, THEMES } from './themes';
import { bullets, slideTitle } from './model';
import { openWorkBlock, q } from '../../../../packages/shared/src/openwork';
import { setLiveWork } from '../proposals/live';
import { askBox, proposalBar } from '../proposals/bar';

const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const SLIDES_TITLE = 'PRESENTATIONS';
type SlidesAsk = { deck?: Deck; id?: string; what?: 'list' | 'new' | 'report' | 'import'; report?: { text: string; title?: string }; doc?: Doc; chart?: { title?: string; chart: ChartData } };

export const slidesState = {
  open: false,
  view: 'list' as 'list' | 'deck' | 'slide' | 'present',
  title: '',
  theme: '',
  slides: [] as { id: string; layout: string; title: string; body: string[]; body2: string[]; notes: string; media: string; shapes: number; builds: number; transition: string }[],
  at: -1,
  words: 0,
  kept: 0,
  saved: 0,
  savedSaid: 0,
  said: '',
  exported: [] as { name: string; size: number; type: string }[],
  lost: [] as string[],
  focus: '',
  panel: 'words',
  undo: 0,
  json: '',
  proposals: [] as { line: string; old: string; now: string }[],
  present: { on: false, i: 0, step: 0, builds: 0, of: 0, notes: '', next: '', elapsed: 0, transition: '' },
};
let current: { close(): void } | null = null;
const still = (): boolean => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';
const cased = (b: HTMLButtonElement, words = b.textContent ?? ''): HTMLButtonElement => {
  b.dataset.label = words;
  return b;
};

/** The sheet: a deck to open, a report to make slides of, or MY SLIDES. */
export async function openSlides(o: SlidesAsk = {}): Promise<void> {
  current?.close();
  const d = slidesParts();
  slidesState.open = true;
  current = modal(SLIDES_TITLE, d.el, () => {
    d.stop();
    slidesState.open = false;
    current = null;
  });
  await d.start(o);
}

// ---------------------------------------------------------------- words on a line, as runs

interface Marks {
  b: boolean;
  i: boolean;
  u: boolean;
  href: string;
}
const safeLink = (u: string): string => {
  const t = u.trim();
  if (!t) return '';
  if (/^(?:https?:|mailto:|tel:)/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return '';
  return /@/.test(t) && !/\s|\//.test(t) ? `mailto:${t}` : `https://${t}`;
};
function runsOf(node: Node, st: Marks = { b: false, i: false, u: false, href: '' }, out: Run[] = []): Run[] {
  const mk = (text: string, m: Marks): Run => ({ text, ...(m.b ? { b: true } : {}), ...(m.i ? { i: true } : {}), ...(m.u && !m.href ? { u: true } : {}), ...(m.href ? { href: m.href } : {}) });
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
function fillRuns(el: HTMLElement, runs: Run[]): void {
  el.replaceChildren();
  for (const r of runs) {
    r.text.split('\n').forEach((part, k) => {
      if (k) el.append(document.createElement('br'));
      if (!part) return;
      let node: Node = document.createTextNode(part);
      if (r.b) node = h('b', node);
      if (r.i) node = h('i', node);
      if (r.u) node = h('u', node);
      if (r.href) node = h('a', { href: r.href }, node);
      el.append(node);
    });
  }
}
const caretAt = (el: HTMLElement): number => {
  const sel = getSelection();
  if (!sel?.rangeCount) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  r.setStart(el, 0);
  const box = document.createElement('div');
  box.append(r.cloneContents());
  return readRuns(box).reduce((n, x) => n + x.text.length, 0);
};
function placeCaret(el: HTMLElement, at: number): void {
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
}
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

const elapsedWords = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const NEXT_TYPE: Record<string, 'ul' | 'ol' | 'p'> = { ul: 'ol', ol: 'p', p: 'ul' };

/**
 * The presentations' page (the sheet's, and the PRESENTATIONS screen's: features/slides/index.ts): `start` opens what was asked
 * for (a deck, a report made into one, a new one, MY SLIDES, or where he was); `stop` ends a talk and lets the screen sleep again.
 * `onChange`: the screen's line over the page is read again when the decks kept change.
 */
export function slidesParts(hooks: { onChange?: () => void } = {}): { el: HTMLElement; start(o: SlidesAsk): Promise<void>; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.slides = slidesState;
  let hist: History | null = null;
  let curId = '';
  let pick: Elem | null = 'title';
  let panel = 'words';
  let zoom = 1;
  let blocked = false;
  let timer = 0;
  let ticking = 0;
  let wake: { release(): Promise<void> } | null = null;
  let presentEl: HTMLElement | null = null;
  const measure = canvasMeasure();

  const fileIn = h('input', { type: 'file', hidden: true, accept: '.pptx,.ppt,.key,application/vnd.openxmlformats-officedocument.presentationml.presentation', 'aria-label': 'Choose a PowerPoint file to open' }) as HTMLInputElement;
  const photoIn = h('input', { type: 'file', hidden: true, accept: 'image/*', 'aria-label': 'Choose a photo for the slide' }) as HTMLInputElement;
  const status = h('p.slstatus', { 'aria-live': 'polite' });
  const view = h('div.slview');
  const say = (words: string): void => {
    status.textContent = words;
    slidesState.said = words;
  };
  const deck = (): Deck => hist!.deck;
  const slide = (): Slide => deck().slides.find((s) => s.id === curId) ?? deck().slides[0]!;
  const image = (id: string): string | null => imageNow(id);
  const wait = <T>(words: string, f: () => Promise<T>): Promise<T> => {
    say(words);
    return f();
  };

  // ---------------------------------------------------------------- keeping
  const savedEl = h('small.slsaved', { 'aria-live': 'polite' });
  const flash = h('span.slflash', { 'aria-live': 'polite' });
  const metaEl = h('p.slmeta');
  let savedOnce = false;
  const paintMeta = (): void => {
    if (!hist) return;
    const d = deck();
    const n = d.slides.length;
    metaEl.textContent = `${n} slide${n === 1 ? '' : 's'} · ${deckWords(d).toLocaleString('en-GB')} word${deckWords(d) === 1 ? '' : 's'}${d.from ? ` · ${d.from}` : ''}`;
    savedEl.textContent = blocked ? 'NOT KEPT · THIS PHONE’S STORAGE IS BLOCKED' : getDeck(d.id) ? `KEPT ON THIS PHONE · ${new Date(d.at).toLocaleTimeString('en-GB')}` : 'NOT KEPT YET';
  };
  const paintState = (): void => {
    if (!hist) return;
    askEl.hidden = false;
    const d = deck();
    slidesState.title = d.title;
    slidesState.theme = d.palette ? 'file' : d.theme;
    slidesState.words = deckWords(d);
    slidesState.slides = d.slides.map((s) => ({
      id: s.id, layout: s.layout, title: textOf(s.title), body: s.body.map(textOf), body2: s.body2.map(textOf), notes: s.notes, media: s.media?.k ?? '', shapes: s.shapes.length, builds: s.builds.length, transition: s.transition,
    }));
    slidesState.at = d.slides.findIndex((s) => s.id === curId);
    slidesState.undo = hist.depth;
    slidesState.json = JSON.stringify(d);
    paintMeta();
  };
  const keep = (d: Deck): void => {
    if (saveDeck(d)) {
      slidesState.kept = listDecks().length;
      slidesState.saved = Date.now();
      blocked = false;
      hooks.onChange?.();
      keepWhere(d.id, curId);
      if (!savedOnce) {
        savedOnce = true;
        slidesState.savedSaid++;
        flash.textContent = 'SAVED';
        flash.classList.remove('go');
        void flash.offsetWidth;
        flash.classList.add('go');
      }
    } else if (!blocked) {
      blocked = true;
      say('This phone is not letting me keep decks (its storage is blocked or full). You can still edit and export; nothing will be here when you leave.');
    }
  };
  /** A change, kept at once. `then`: repaint all (a new look of the whole page), or only what is drawn (typing keeps its caret). */
  const change = (next: Deck, then: 'all' | 'draw' | 'none' = 'all'): void => {
    hist!.push(next);
    keep(deck());
    paintState();
    if (then === 'all') render();
    else if (then === 'draw') paintStage();
  };
  /** What he was typing is kept at once, in the slide it belongs to, and that editor is let go (a stale one must never write into another slide). */
  const flush = (): void => {
    clearTimeout(timer);
    const all = [...flushers];
    flushers.clear();
    for (const f of all) f();
  };
  const flushers = new Set<() => void>();
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  const ensureImages = async (): Promise<number> => {
    const ids = deck().slides.flatMap((s) => (s.media?.k === 'img' ? [s.media.img] : []));
    const missing = ids.length ? await loadImages(ids) : [];
    return missing.length;
  };
  const tidy = (): void => void keepOnly(imagesInUse()).catch(() => undefined);

  // ---------------------------------------------------------------- MY SLIDES
  const reportBox = h('div.slreport');
  reportBox.hidden = true;
  const startDeck = (d: Deck, words: string): void => {
    deckPanel = '';
    hist = new History(d);
    curId = d.slides[0]?.id ?? '';
    savedOnce = false;
    keep(d);
    showDeck();
    say(words);
  };
  const askAnswer = async (): Promise<string> => {
    try {
      const { chat } = await import('../assistant/session');
      const all = chat.get().entries.filter((e) => e.kind === 'assistant');
      for (const e of all.reverse()) if (e.kind === 'assistant' && /^#{1,3}\s+\S/m.test(e.text)) return e.text;
    } catch {
      /* no chat here */
    }
    return '';
  };
  const showReport = async (): Promise<void> => {
    reportBox.hidden = false;
    const answer = await askAnswer();
    const docs = listDocs();
    const area = h('textarea.slpaste', { rows: 6, placeholder: 'Or paste a report here: its headings become the slides', 'aria-label': 'A report to make slides of' }) as HTMLTextAreaElement;
    const sel = h('select', { 'aria-label': 'One of my documents' }, ...docs.map((d) => h('option', { value: d.id }, d.title))) as HTMLSelectElement;
    const make = (text: string, title: string, from: string): void => {
      const d = deckFromMarkdown(text, { title, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, from);
      if (d.slides.length < 2) return say('There is nothing in that to make slides of. Paste a report with some words in it; headings make the best slides.');
      startDeck(d, `${d.slides.length} slides made on this phone from ${from}. Tap one to change its words.`);
    };
    clear(reportBox,
      h('h3.slh', 'WHICH REPORT?'),
      answer ? button('THE LAST ANSWER WITH HEADINGS', () => make(answer, '', 'the last answer'), 'on') : h('p.slnote', 'There is no answer with headings in the chat yet. Ask me for a report, or pick or paste one.'),
      docs.length ? h('div.slrow', sel, button('MY DOCUMENT', () => {
        const d = getDoc(sel.value);
        if (!d) return say('That document is no longer on this phone.');
        const deck0 = deckFromDoc(d, { date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) });
        startDeck(deck0, `${deck0.slides.length} slides made on this phone from “${d.title}”.`);
      })) : null,
      area,
      button('MAKE SLIDES OF THIS', () => (area.value.trim() ? make(area.value, '', 'a report') : say('Paste a report first, or pick one above.'))),
      button('CANCEL', () => (reportBox.hidden = true)),
    );
    say(answer ? 'Pick the report to make slides of.' : 'Pick or paste the report to make slides of.');
  };
  const startKeys = (): HTMLElement =>
    h('div.slrow.slstart', button('START FROM A REPORT', () => void showReport(), 'on'), button('START BLANK', () => startDeck(blankDeck(), 'A blank deck: a title slide and a slide of bullets. Tap one to type into it.')), button('OPEN A .PPTX', () => fileIn.click()));
  const showList = (): void => {
    flush();
    stopPresent();
    slidesState.view = 'list';
    keepWhere('', '');
    tidy();
    hist = null;
    sync();
    const decks = listDecks();
    slidesState.kept = decks.length;
    reportBox.hidden = true;
    clear(view,
      h('h3.slh', 'MY SLIDES'),
      decks.length
        ? h('div.sllist', ...decks.map((d) => button(h('span.sldeck', h('b', d.title), h('small', `${d.slides.length} slide${d.slides.length === 1 ? '' : 's'} · ${whenWords(d.at)}${d.from ? ` · ${d.from}` : ''}`)), () => openDeck(d.id), 'slopen')))
        : h('p.slnote.slempty', 'No slides yet. Start from a report, or start blank.'),
      startKeys(),
      reportBox,
    );
    say(decks.length ? `${decks.length} deck${decks.length === 1 ? '' : 's'}, kept on this phone only.` : '');
    slidesState.slides = [];
    slidesState.at = -1;
  };
  const openDeck = (id: string, slideId = ''): void => {
    const d = getDeck(id);
    if (!d) return showList();
    deckPanel = '';
    hist = new History(d);
    savedOnce = false;
    curId = d.slides.some((s) => s.id === slideId) ? slideId : d.slides[0]?.id ?? '';
    if (slideId && d.slides.some((s) => s.id === slideId)) showSlide(slideId);
    else showDeck();
  };

  // ---------------------------------------------------------------- import
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    if (/\.ppt$/i.test(f.name)) return say('That is an old PowerPoint file (.ppt). Save it as .pptx from PowerPoint, or share it from Keynote as PowerPoint, and I can open it.');
    if (/\.key$/i.test(f.name)) return say('That is a Keynote file. In Keynote choose Share, Export To, PowerPoint, and I can open that.');
    say(`Reading ${f.name} on this phone…`);
    try {
      const r = await readPptx(new Uint8Array(await f.arrayBuffer()), f.name, (b, m) => addImageBytes(b, m));
      if (!r) return say('I could not open that file. Is it a PowerPoint (.pptx) from PowerPoint or Keynote?');
      slidesState.lost = r.lost;
      startDeck(r.deck, `${r.deck.title}: ${r.deck.slides.length} slide${r.deck.slides.length === 1 ? '' : 's'} read here; nothing was sent. ${lostWords(r.lost)}`.trim());
    } catch {
      say('I could not open that file. Is it a PowerPoint (.pptx) from PowerPoint or Keynote?');
    }
  });

  const key = (label: string, run: () => void, cls = '', name = ''): HTMLButtonElement => {
    const b = button(label, run, cls);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  const render = (): void => (slidesState.view === 'slide' ? showSlide(curId) : showDeck());
  const doUndo = (): void => {
    if (!hist!.canUndo) return say('Nothing to undo.');
    flush();
    hist!.undo();
    if (!deck().slides.some((s) => s.id === curId)) curId = deck().slides[0]?.id ?? '';
    keep(deck());
    paintState();
    render();
    say('Undone.');
  };
  const doRedo = (): void => {
    if (!hist!.canRedo) return say('Nothing to redo.');
    flush();
    hist!.redo();
    if (!deck().slides.some((s) => s.id === curId)) curId = deck().slides[0]?.id ?? '';
    keep(deck());
    paintState();
    render();
  };
  const undoBar = (words: string): void => {
    clear(status, `${words} `, key('UNDO', doUndo, 'on', 'Undo'));
    slidesState.said = words;
  };
  const histKeys = (): HTMLElement => h('div.slrow', key('UNDO', doUndo), key('REDO', doRedo));
  const thumb = (s: Slide, i: number, edit = false): HTMLElement => {
    const el = h('span.slthumb');
    el.innerHTML = slideSvg(deck(), s, { n: i + 1, of: deck().slides.length, image, measure, edit });
    return el;
  };

  // ---------------------------------------------------------------- the deck: a film of slides
  const addSlide = (layout: Layout): void => {
    flush();
    deckPanel = '';
    const at = indexOf(deck(), curId) + 1 || deck().slides.length;
    const s = newSlide(layout);
    curId = s.id;
    change(insertSlide(deck(), at, s), 'none');
    pick = SLOTS[layout].title ? 'title' : null;
    panel = 'words';
    showSlide(s.id);
    say(`A ${LAYOUTS.find((l) => l.id === layout)!.name.toLowerCase()} slide added as number ${at + 1}.`);
  };
  const layoutGrid = (cur: Layout | '', on: (l: Layout) => void): HTMLElement =>
    h('div.sllayouts', ...LAYOUTS.map((l) => {
      const b = h('button.sllayout', { type: 'button', 'aria-label': `${l.name}: ${l.line}`, 'aria-pressed': String(cur === l.id) },
        (() => {
          const t = h('span.slthumb');
          t.innerHTML = slideSvg(deck(), newSlide(l.id), { edit: true, measure: approx });
          return t;
        })(),
        h('span.slcap', h('b', l.name), h('small', l.line)));
      b.addEventListener('click', () => on(l.id));
      return b;
    }));

  const themePanel = (): HTMLElement => {
    const d = deck();
    const cur = d.palette ? 'file' : d.theme;
    const sw = (k: string, name: string, pal: { ground: string; ink: string; accent: string; plate: string }): HTMLElement => {
      const b = h('button.slswatch', { type: 'button', 'aria-pressed': String(cur === k), 'aria-label': `Theme ${name}`, dataset: { theme: k } },
        h('span.slchips', ...[pal.ground, pal.plate, pal.accent, pal.ink].map((c) => h('i', { style: `background:${c}` }))), h('span', name));
      b.addEventListener('click', () => {
        if (k === 'file') return;
        change({ ...deck(), theme: k, palette: undefined });
        say(`${name}: every slide is in it now.`);
      });
      return b;
    };
    const flag = (label: string, on: boolean, set: (v: boolean) => void): HTMLButtonElement => {
      const b = key(label, () => set(!on), '', `${label}: ${on ? 'on' : 'off'}`);
      b.setAttribute('aria-pressed', String(on));
      return b;
    };
    return h('div.slpanel.slthemep',
      h('small.slh', 'THEME'),
      h('div.slswatches', ...(d.palette ? [sw('file', 'From the file', d.palette)] : []), ...THEME_KEYS.map((k) => sw(k, THEMES[k]!.name, THEMES[k]!))),
      h('small.slh', 'ON EVERY SLIDE'),
      h('div.slrow',
        flag('NAME AT THE FOOT', d.master.footer, (v) => change({ ...deck(), master: { ...deck().master, footer: v } })),
        flag('SLIDE NUMBERS', d.master.numbers, (v) => change({ ...deck(), master: { ...deck().master, numbers: v } })),
        key(d.master.align === 'left' ? 'TITLES LEFT' : 'TITLES CENTRED', () => change({ ...deck(), master: { ...deck().master, align: deck().master.align === 'left' ? 'center' : 'left' } })),
      ));
  };

  const exportPanel = (): HTMLElement => {
    const out = h('div.slouts', { 'aria-live': 'polite' });
    let notes = false;
    const made = (blob: Blob, name: string, extra = ''): void => {
      slidesState.exported.push({ name, size: blob.size, type: blob.type });
      clear(out, h('div.cvout', h('div.cvoutt', h('b', name), h('small', `${sizeWords(blob.size)}${extra}`)), h('div.cvbtns', button('SAVE', () => saveBlob(blob, name)), button('SHARE', () => void (async () => (await shareBlob(blob, name)) || saveBlob(blob, name))()))));
      say(`Made on this phone: ${name}, ${sizeWords(blob.size)}.`);
    };
    const file = (ext: string): string => `${deck().title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'Deck'}.${ext}`;
    const ready = async (): Promise<number> => {
      flush();
      return ensureImages();
    };
    const pptx = async (): Promise<void> => {
      const missing = await ready();
      const bytes = writePptx(deck(), { author: myName(), image: imageBytes, measure });
      made(new Blob([bytes as BlobPart], { type: PPTX_TYPE }), file('pptx'), missing ? ` · ${missing} picture${missing === 1 ? ' is' : 's are'} not on this phone, so not in it` : '');
    };
    const sizeNote = h('small.slnote', 'The size of the PowerPoint file is said as soon as it is made.');
    const notesKey = key('NOTES PAGES AFTER THE SLIDES: OFF', () => {
      notes = !notes;
      notesKey.textContent = `NOTES PAGES AFTER THE SLIDES: ${notes ? 'ON' : 'OFF'}`;
      notesKey.setAttribute('aria-pressed', String(notes));
    });
    notesKey.setAttribute('aria-pressed', 'false');
    notesKey.dataset.label = 'Notes pages after the slides: off';
    notesKey.dataset.case = 'keep';
    return h('div.slpanel.slexport',
      h('small.slh', 'EXPORT'),
      h('div.slrow',
        key('POWERPOINT (.PPTX)', () => void wait('Making your PowerPoint file on this phone…', pptx).catch(() => say('I could not make the file. Try again in a moment.'))),
        key('PDF', () => {
          void wait('Making your PDF on this phone…', async () => {
            const missing = await ready();
            const blob = new Blob([(await deckPdf(deck(), { image }, { notes, progress: (n, of) => say(`Making your PDF: slide ${n} of ${of}…`) })) as BlobPart], { type: 'application/pdf' });
            made(blob, file('pdf'), notes ? ' · with the notes pages' : '');
            if (missing) say(`Made, but ${missing} picture${missing === 1 ? ' is' : 's are'} not on this phone, so not in it.`);
          }).catch(() => say('I could not make the PDF. Try again in a moment.'));
        }),
        key('THIS SLIDE AS A PICTURE (.PNG)', () => {
          void wait('Making the picture on this phone…', async () => {
            await ready();
            const i = Math.max(0, indexOf(deck(), curId));
            made(await slidePng(deck(), i, { image }), `${file('png').replace(/\.png$/, '')} slide ${i + 1}.png`);
          }).catch(() => say('I could not make the picture. Try again in a moment.'));
        }),
      ),
      notesKey,
      out,
      h('p.slnote', 'In the PowerPoint file a chart is its numbers, a table on the slide; animations and transitions are not carried. In the PDF and the picture each slide is drawn as a picture, the chart as it looks here.'),
      sizeNote,
    );
  };

  let deckPanel = '';
  const showDeck = (): void => {
    flush();
    stopPresent();
    slidesState.view = 'deck';
    const d = deck();
    keepWhere(d.id, '');
    if (!d.slides.some((s) => s.id === curId)) curId = d.slides[0]?.id ?? '';
    paintState();
    const title = h('input.sltitle', { type: 'text', value: d.title, 'aria-label': 'The deck’s name' }) as HTMLInputElement;
    title.addEventListener('change', () => change({ ...deck(), title: title.value.trim() || 'Untitled deck' }, 'none'));
    const tools = h('div.slrow.sltools', { role: 'toolbar', 'aria-label': 'The deck' });
    let shown: HTMLElement | null = null;
    const makers: Record<string, () => HTMLElement> = {
      new: () => h('div.slpanel', h('small.slh', 'PICK A LAYOUT'), layoutGrid('', addSlide)),
      theme: themePanel,
      export: exportPanel,
    };
    const open = (name: string): void => {
      shown?.remove();
      shown = null;
      deckPanel = name === deckPanel ? '' : name;
      if (deckPanel) {
        shown = makers[deckPanel]!();
        tools.after(shown);
      }
    };
    tools.append(
      key('PRESENT', () => startPresent(0), 'on', 'Present this deck from its first slide'),
      key('NEW SLIDE', () => open('new')),
      key('THEME', () => open('theme')),
      key('EXPORT', () => open('export')),
      key('UNDO', doUndo),
      key('REDO', doRedo),
    );
    const film = h('div.slfilm', { role: 'list', 'aria-label': 'The slides, in order' });
    d.slides.forEach((s, i) => {
      const c = h('button.slcard', { type: 'button', role: 'listitem', 'aria-label': `Slide ${i + 1}: ${slideName(s, i + 1)}. Tap to edit it; press and hold to move it.`, dataset: { id: s.id, n: String(i + 1) } }, thumb(s, i), h('span.slcap', h('b', String(i + 1)), h('span', slideName(s, i + 1))));
      wireDrag(c, i);
      film.append(c);
    });
    clear(view, title, metaEl, h('div.slsavedrow', savedEl, flash), tools, film, h('div.slrow', key('MY SLIDES', showList), key('REMOVE THIS DECK', () => {
      const t = deck().title;
      removeDeck(deck().id);
      hooks.onChange?.();
      showList();
      say(`Removed “${t}” from this phone.`);
    })));
    paintMeta();
    if (deckPanel) {
      const name = deckPanel;
      deckPanel = '';
      open(name);
    }
    void ensureImages().then((missing) => {
      if (slidesState.view !== 'deck') return;
      if (missing) say(`${missing} picture${missing === 1 ? ' is' : 's are'} not on this phone any more; ${missing === 1 ? 'its slide shows' : 'their slides show'} a note instead.`);
      film.querySelectorAll<HTMLElement>('.slcard').forEach((c, i) => c.querySelector('.slthumb')!.innerHTML = slideSvg(deck(), deck().slides[i]!, { n: i + 1, of: deck().slides.length, image, measure }));
    });
  };

  /** Press and hold a slide, then drag it to its new place (the film scrolls when the finger nears its edge); a quick tap opens it. */
  function wireDrag(card: HTMLElement, from: number): void {
    let t = 0;
    let down: { x: number; y: number; id: number } | null = null;
    let live = false;
    let over = from;
    let suppress = false;
    let y = 0;
    let raf = 0;
    const cards = (): HTMLElement[] => [...card.parentElement!.querySelectorAll<HTMLElement>('.slcard')];
    const mark = (): void => cards().forEach((c, i) => c.classList.toggle('slover', live && i === over && i !== from));
    const aim = (): void => {
      const at = cards().findIndex((c) => {
        const r = c.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      over = at < 0 ? cards().length - 1 : Math.min(at > from ? at - 1 : at, cards().length - 1);
      mark();
    };
    const scroller = (): HTMLElement => {
      let e = card.parentElement;
      while (e) {
        const oy = getComputedStyle(e).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
        e = e.parentElement;
      }
      return document.scrollingElement as HTMLElement;
    };
    const tick = (): void => {
      if (!live) return;
      const sc = scroller();
      const r = sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : sc.getBoundingClientRect();
      const top = Math.max(r.top, 0) + 90;
      const bottom = Math.min(r.bottom, innerHeight) - 130;
      const before = sc.scrollTop;
      if (y < top) sc.scrollTop -= Math.min(16, (top - y) / 3 + 4);
      else if (y > bottom) sc.scrollTop += Math.min(16, (y - bottom) / 3 + 4);
      if (sc.scrollTop !== before) aim();
      raf = requestAnimationFrame(tick);
    };
    const end = (drop: boolean): void => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      if (live) {
        suppress = true;
        setTimeout(() => (suppress = false), 350);
        card.classList.remove('slgrab');
        cards().forEach((c) => c.classList.remove('slover'));
        if (drop && over !== from) {
          change(moveSlide(deck(), from, over), 'none');
          say(`Slide ${from + 1} moved to place ${over + 1}.`);
          showDeck();
        }
      }
      live = false;
      down = null;
    };
    card.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      y = e.clientY;
      t = window.setTimeout(() => {
        live = true;
        over = from;
        card.classList.add('slgrab');
        card.setPointerCapture?.(e.pointerId);
        say(`Moving slide ${from + 1}: drag it to its place and let go.`);
        raf = requestAnimationFrame(tick);
      }, 430);
    });
    card.addEventListener('pointermove', (e) => {
      if (!down) return;
      y = e.clientY;
      if (!live) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) end(false);
        return;
      }
      aim();
    });
    card.addEventListener('touchmove', (e) => live && e.cancelable && e.preventDefault(), { passive: false });
    card.addEventListener('pointerup', () => end(true));
    card.addEventListener('pointercancel', () => end(false));
    card.addEventListener('contextmenu', (e) => (live || down) && e.preventDefault());
    card.addEventListener('click', () => {
      if (suppress) return;
      showSlide(card.dataset.id!);
    });
  }

  // ---------------------------------------------------------------- one slide
  let stageBox: HTMLElement;
  const paintStage = (): void => {
    if (!stageBox) return;
    const d = deck();
    const s = slide();
    stageBox.innerHTML = slideSvg(d, s, { edit: true, n: indexOf(d, s.id) + 1, of: d.slides.length, image, measure, pick });
    stageBox.style.width = `${Math.round(zoom * 100)}%`;
  };
  const moveBy = (delta: number): void => {
    flush();
    const i = indexOf(deck(), curId);
    const to = i + delta;
    if (to < 0 || to >= deck().slides.length) return say(delta < 0 ? 'This is the first slide.' : 'This is the last slide.');
    change(moveSlide(deck(), i, to), 'none');
    showSlide(curId);
    say(`Slide moved to place ${to + 1}.`);
  };

  function showSlide(id: string): void {
    flush();
    stopPresent();
    if (!deck().slides.some((s) => s.id === id)) return showDeck();
    curId = id;
    slidesState.view = 'slide';
    keepWhere(deck().id, id);
    paintState();
    const d = deck();
    const s = slide();
    const i = indexOf(d, s.id);
    zoom = 1;
    const zoomer = h('div.slzoom', { role: 'group', 'aria-label': 'The slide: tap a part of it to edit it; pinch to zoom' });
    stageBox = h('div.slbox');
    zoomer.append(stageBox);
    paintStage();
    stageBox.addEventListener('click', (e) => {
      const g = (e.target as Element).closest<SVGElement>('[data-el]');
      if (!g) return;
      const el = g.dataset.el as Elem;
      pick = el;
      slidesState.focus = el;
      if (el === 'title' || el === 'body' || el === 'body2') showPanel('words');
      else showPanel('insert');
      paintStage();
      say(`The ${el === 'media' ? 'picture, chart or table' : el === 'title' ? 'title' : el === 'body' ? 'text' : el === 'body2' ? 'right column' : 'shape'} is chosen.`);
    });
    // a pinch zooms the slide (one to three times); a double tap puts it back
    const ptr = new Map<number, number>();
    const pos = new Map<number, { x: number; y: number }>();
    let base = 0;
    let z0 = 1;
    let tapAt = 0;
    zoomer.addEventListener('pointerdown', (e) => {
      pos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pos.size === 2) {
        const [a, b] = [...pos.values()];
        base = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        z0 = zoom;
      } else if (e.pointerType === 'touch' && Date.now() - tapAt < 320) {
        zoom = zoom > 1 ? 1 : 2;
        paintStage();
      }
      if (pos.size === 1) tapAt = Date.now();
      ptr.set(e.pointerId, 1);
    });
    zoomer.addEventListener('pointermove', (e) => {
      if (!pos.has(e.pointerId)) return;
      pos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pos.size === 2 && base) {
        const [a, b] = [...pos.values()];
        zoom = Math.max(1, Math.min(3, (z0 * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / base));
        stageBox.style.width = `${Math.round(zoom * 100)}%`;
      }
    });
    const lift = (e: PointerEvent): void => {
      pos.delete(e.pointerId);
      ptr.delete(e.pointerId);
      if (pos.size < 2) base = 0;
    };
    zoomer.addEventListener('pointerup', lift);
    zoomer.addEventListener('pointercancel', lift);

    const nav = h('div.slrow.slnav',
      key('ALL SLIDES', showDeck),
      key('PREVIOUS', () => (i > 0 ? showSlide(d.slides[i - 1]!.id) : say('This is the first slide.')), '', 'Previous slide'),
      h('b.slcount', `${i + 1} of ${d.slides.length}`),
      key('NEXT SLIDE', () => (i < d.slides.length - 1 ? showSlide(d.slides[i + 1]!.id) : say('This is the last slide.')), '', 'Next slide'),
      key('PRESENT', () => startPresent(i), 'on', 'Present from this slide'),
    );
    const names: Record<string, string> = { words: 'WORDS', layout: 'LAYOUT', insert: 'INSERT', slide: 'SLIDE', notes: 'NOTES' };
    const pills = h('div.slpills', { role: 'tablist', 'aria-label': 'What to change' }, ...Object.entries(names).map(([k, label]) => h('button.slpill', { type: 'button', role: 'tab', dataset: { panel: k }, 'aria-selected': 'false' }, label)));
    const panels: Record<string, HTMLElement> = { words: wordsPanel(s), layout: layoutPanel(), insert: insertPanel(), slide: slidePanel(), notes: notesPanel() };
    const showPanel = (k: string): void => {
      panel = k in panels ? k : 'words';
      slidesState.panel = panel;
      for (const [n, el] of Object.entries(panels)) el.hidden = n !== panel;
      pills.querySelectorAll<HTMLElement>('.slpill').forEach((p) => p.setAttribute('aria-selected', String(p.dataset.panel === panel)));
    };
    pills.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.slpill');
      if (b) showPanel(b.dataset.panel!);
    });
    for (const bar of [pills, ...Object.values(panels)]) bar.addEventListener('pointerdown', (e) => (e.target as HTMLElement).closest('button') && e.preventDefault());
    slidePanelRefs.show = showPanel;
    clear(view, nav, histKeys(), h('div.slsavedrow', savedEl, flash), zoomer, pills, ...Object.values(panels));
    showPanel(panel);
    paintMeta();
    void ensureImages().then((missing) => {
      if (slidesState.view !== 'slide' || curId !== id) return;
      paintStage();
      if (missing) say('A picture on this deck is not on this phone any more; its slide shows a note instead.');
    });
  }
  const slidePanelRefs: { show: (k: string) => void } = { show: () => undefined };
  const showPanel = (k: string): void => slidePanelRefs.show(k);

  // ---- WORDS
  const defaultKind = (l: Layout): 'ul' | 'p' => (l === 'bullets' || l === 'two' ? 'ul' : 'p');
  /** A column of lines, one a block: Enter adds one, a mark goes on the words chosen. */
  const lineEditor = (get: () => Block[], put: (b: Block[]) => void, o: { single?: boolean; label: string; kind: 'ul' | 'p' | 'title' }): HTMLElement => {
    const box = h('div.sledit', { role: 'group', 'aria-label': o.label });
    let active: HTMLElement | null = null;
    const lines = (): HTMLElement[] => [...box.querySelectorAll<HTMLElement>('.slline')];
    const read = (): Block[] => lines().map((el) => ({ id: el.dataset.id!, t: (el.dataset.t as Block['t']) ?? 'p', runs: readRuns(el) }));
    const mk = (b: Block): HTMLElement => {
      const el = h('div.slline', { contentEditable: 'true', spellcheck: true, role: 'textbox', 'aria-multiline': 'false', 'aria-label': o.label, dataset: { id: b.id, t: b.t } });
      fillRuns(el, b.runs);
      el.addEventListener('focus', () => {
        active = el;
        slidesState.focus = o.label;
      });
      el.addEventListener('input', () => {
        clearTimeout(timer);
        timer = window.setTimeout(sync, 350);
      });
      el.addEventListener('blur', () => {
        clearTimeout(timer);
        sync();
      });
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && ev.shiftKey && !o.single) {
          ev.preventDefault();
          document.execCommand('insertLineBreak');
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          if (o.single) return el.blur();
          const [a, z] = splitRuns(readRuns(el), caretAt(el));
          fillRuns(el, a);
          const next = mk({ id: blockId(), t: el.dataset.t as Block['t'], runs: z });
          el.after(next);
          sync();
          next.focus();
          placeCaret(next, 0);
        } else if (ev.key === 'Backspace' && !o.single && getSelection()?.isCollapsed && caretAt(el) === 0) {
          const prev = el.previousElementSibling as HTMLElement | null;
          if (!prev) return;
          ev.preventDefault();
          const at = readRuns(prev).reduce((n, x) => n + x.text.length, 0);
          fillRuns(prev, tidyRuns([...readRuns(prev), ...readRuns(el)]));
          el.remove();
          prev.focus();
          placeCaret(prev, at);
          sync();
        }
      });
      return el;
    };
    const sync = (): void => {
      clearTimeout(timer);
      const next = read();
      if (JSON.stringify(next.map((b) => [b.t, b.runs])) !== JSON.stringify(get().map((b) => [b.t, b.runs])) && lines().length) put(next);
    };
    flushers.add(sync);
    const blocks = get().length ? get() : [{ id: blockId(), t: (o.kind === 'title' ? 'h1' : o.kind) as Block['t'], runs: [] }];
    box.append(...blocks.map(mk));
    const api = box as HTMLElement & { mark?: (cmd: string, arg?: string) => void; cycle?: () => void; focusEnd?: () => void; selection?: () => Range | null };
    let lastRange: Range | null = null;
    document.addEventListener('selectionchange', () => {
      const sel = getSelection();
      if (sel?.rangeCount && box.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
    });
    api.mark = (cmd, arg) => {
      const el = (active && box.contains(active) ? active : lines()[0])!;
      if (cmd === 'createLink' && lastRange) {
        el.focus();
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(lastRange);
      } else el.focus();
      document.execCommand(cmd, false, arg);
      sync();
    };
    api.cycle = () => {
      const el = active && box.contains(active) ? active : lines()[0]!;
      el.dataset.t = NEXT_TYPE[el.dataset.t ?? 'p'] ?? 'ul';
      sync();
      say(el.dataset.t === 'ul' ? 'This line is a bullet.' : el.dataset.t === 'ol' ? 'This line is numbered.' : 'This line is plain.');
    };
    api.focusEnd = () => {
      const l = lines();
      const el = l[l.length - 1];
      if (el) {
        el.focus();
        placeCaret(el, readRuns(el).reduce((n, x) => n + x.text.length, 0));
      }
    };
    api.selection = () => lastRange;
    return box;
  };

  function wordsPanel(s: Slide): HTMLElement {
    const slots = SLOTS[s.layout];
    const have: ('title' | 'body' | 'body2')[] = [];
    if (slots.title) have.push('title');
    if (slots.body) have.push('body');
    if (slots.body2) have.push('body2');
    const root = h('div.slpanel.slwords');
    if (!have.length) {
      clear(root, h('p.slnote', 'A blank slide has no words of its own. Pick a layout, or add a picture, chart, table or shape from INSERT.'));
      return root;
    }
    const cur = (pick && (have as string[]).includes(pick) ? pick : have[0]!) as 'title' | 'body' | 'body2';
    const labels = { title: s.layout === 'quote' ? 'WHO SAID IT' : 'TITLE', body: s.layout === 'quote' ? 'THE QUOTE' : s.layout === 'picture' ? 'CAPTION' : s.layout === 'title' || s.layout === 'section' ? 'THE LINE UNDER' : 'TEXT', body2: 'RIGHT COLUMN' };
    const inner = (k: 'title' | 'body' | 'body2'): HTMLElement[] => {
      pick = k;
      const sl = slide();
      const mine = (): Slide => deck().slides.find((x) => x.id === sl.id) ?? sl;
      const get = (): Block[] => (k === 'title' ? [mine().title] : k === 'body' ? mine().body : mine().body2);
      const put = (bs: Block[]): void => {
        change(withSlide(deck(), sl.id, (x) => (k === 'title' ? { ...x, title: { ...x.title, runs: bs[0]?.runs ?? [] } } : k === 'body' ? { ...x, body: bs } : { ...x, body2: bs })), 'draw');
      };
      const ed = lineEditor(get, put, { single: k === 'title', label: labels[k], kind: k === 'title' ? 'title' : defaultKind(sl.layout) });
      const e = ed as HTMLElement & { mark: (c: string, a?: string) => void; cycle: () => void; selection: () => Range | null };
      const linkIn = h('input', { type: 'url', placeholder: 'https://… or an email address', 'aria-label': 'The address to link to', autocomplete: 'off', autocapitalize: 'none', enterKeyHint: 'done' }) as HTMLInputElement;
      const linkRow = h('div.slrow.sllink');
      linkRow.hidden = true;
      const apply = (): void => {
        const href = safeLink(linkIn.value);
        if (!href) return say('That is not an address I can link to: use https://…, an email address or tel:.');
        const r = e.selection();
        if (!r || r.collapsed) return say('Choose the words to link first, then LINK.');
        e.mark('createLink', href);
        linkRow.hidden = true;
        linkIn.value = '';
        say(`Linked to ${href}.`);
      };
      clear(linkRow, linkIn, key('APPLY', apply, 'on'), key('REMOVE LINK', () => {
        e.mark('unlink');
        linkRow.hidden = true;
        say('The link is taken off the words.');
      }), key('CANCEL', () => (linkRow.hidden = true)));
      linkIn.addEventListener('keydown', (ev) => ev.key === 'Enter' && apply());
      const marks = h('div.slrow.slmarks', { role: 'toolbar', 'aria-label': 'Marks for the words chosen' },
        key('BOLD', () => e.mark('bold'), '', 'Bold'), key('ITALIC', () => e.mark('italic'), '', 'Italic'), key('UNDERLINE', () => e.mark('underline'), '', 'Underline'),
        key('LINK', () => {
          const r = e.selection();
          if (!r || r.collapsed) return say('Choose the words to link first, then LINK.');
          linkRow.hidden = !linkRow.hidden;
          if (!linkRow.hidden) linkIn.focus();
        }),
        ...(k === 'title' ? [] : [key('LIST', () => e.cycle(), '', 'Bullet, number or plain line')]),
      );
      marks.addEventListener('pointerdown', (ev) => (ev.target as HTMLElement).closest('button') && ev.preventDefault());
      return [marks, linkRow, ed, h('small.slnote', k === 'title' ? 'The title: one line. Enter finishes it.' : 'Enter adds a line; each line is a bullet. The slide shows it as you type.')];
    };
    const tabsFor = (on: 'title' | 'body' | 'body2'): HTMLElement =>
      h('div.slrow', ...have.map((k) => {
        const b = key(labels[k], () => {
          flush();
          clear(root, tabsFor(k), ...inner(k));
          paintStage();
        });
        b.setAttribute('aria-pressed', String(k === on));
        return b;
      }));
    clear(root, tabsFor(cur), ...inner(cur));
    return root;
  }

  // ---- LAYOUT
  function layoutPanel(): HTMLElement {
    return h('div.slpanel', h('small.slh', 'LAYOUT'), layoutGrid(slide().layout, (l) => {
      flush();
      change(withSlide(deck(), curId, (s) => setLayout(s, l)), 'none');
      pick = SLOTS[l].title ? 'title' : null;
      showSlide(curId);
      say(`${LAYOUTS.find((x) => x.id === l)!.name}: the words stay where they were put.`);
    }));
  }

  // ---- INSERT
  let sub = '';
  const photoOn = async (f: File): Promise<void> => {
    say('Putting the photo on the slide…');
    try {
      const p = await addPhoto(f);
      change(withSlide(deck(), curId, (s) => setMedia(s, { k: 'img', img: p.id, alt: '', iw: p.iw, ih: p.ih })), 'none');
      sub = 'picture';
      showSlide(curId);
      say(`Photo added (${p.iw} × ${p.ih}, kept on this phone only). Describe it for people who cannot see it.`);
    } catch {
      say('I could not read that picture. Try another photo.');
    }
  };
  photoIn.addEventListener('change', () => {
    const f = photoIn.files?.[0];
    photoIn.value = '';
    if (f) void photoOn(f);
  });
  function insertPanel(): HTMLElement {
    const s = slide();
    const subEl = h('div.slsub');
    const draw = (): void => {
      const cur = slide();
      if (sub === 'picture') {
        const m = cur.media?.k === 'img' ? cur.media : null;
        const alt = h('input', { type: 'text', value: m?.alt ?? '', placeholder: 'A few words about the picture', 'aria-label': 'What the picture shows', autocomplete: 'off' }) as HTMLInputElement;
        alt.addEventListener('change', () => change(withSlide(deck(), curId, (x) => (x.media?.k === 'img' ? { ...x, media: { ...x.media, alt: alt.value.trim() } } : x)), 'draw'));
        clear(subEl, key(m ? 'CHANGE THE PHOTO' : 'CHOOSE A PHOTO', () => photoIn.click(), 'on'), ...(m ? [alt, key('TAKE THE PICTURE OFF', () => {
          change(withSlide(deck(), curId, (x) => setMedia(x, undefined)), 'none');
          showSlide(curId);
          undoBar('The picture is off the slide.');
        })] : [h('p.slnote', 'Your photos stay on this phone. I shrink each to 1,280 pixels.')]));
      } else if (sub === 'chart') {
        const have = cur.media?.k === 'chart' ? cur.media.chart : null;
        const rows: { label: string; value: string }[] = have ? have.points.map((p) => ({ label: p.label, value: String(p.value) })) : [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }];
        let kind: 'bars' | 'line' = have?.kind ?? 'bars';
        const unit = h('input', { type: 'text', value: have?.unit ?? '', placeholder: 'A unit, such as £ or %', 'aria-label': 'The unit of the numbers', autocomplete: 'off' }) as HTMLInputElement;
        const grid = h('div.slchart');
        const paintRows = (): void => clear(grid, ...rows.map((r, n) => {
          const l = h('input', { type: 'text', value: r.label, placeholder: 'Label', 'aria-label': `Label ${n + 1}`, autocomplete: 'off' }) as HTMLInputElement;
          const v = h('input', { type: 'text', inputMode: 'decimal', value: r.value, placeholder: 'Number', 'aria-label': `Number ${n + 1}`, autocomplete: 'off' }) as HTMLInputElement;
          l.addEventListener('input', () => (r.label = l.value));
          v.addEventListener('input', () => (r.value = v.value));
          return h('div.slrow.slcrow', l, v, key('×', () => {
            rows.splice(n, 1);
            paintRows();
          }, '', `Remove row ${n + 1}`));
        }));
        paintRows();
        const kinds = h('div.slrow', ...(['bars', 'line'] as const).map((k) => {
          const b = key(k === 'bars' ? 'BARS' : 'LINE', () => {
            kind = k;
            kinds.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          });
          b.setAttribute('aria-pressed', String(kind === k));
          return b;
        }));
        const useChart = (c: ChartData): void => {
          change(withSlide(deck(), curId, (x) => setMedia(x, { k: 'chart', chart: c })), 'none');
          showSlide(curId);
          say(`A ${c.kind === 'line' ? 'line' : 'bar'} chart of ${c.points.length} numbers is on the slide.`);
        };
        clear(subEl,
          h('p.slnote', 'Type a label and a number on each row. The chart draws from them.'),
          kinds, unit, grid,
          key('ADD A ROW', () => {
            rows.push({ label: '', value: '' });
            paintRows();
          }),
          key('DRAW THE CHART', () => {
            const good = rows.filter((r) => r.label.trim() && /\d/.test(r.value) && Number.isFinite(Number(r.value.replace(/[£$€,%\s]/g, ''))));
            if (good.length < 2) return say('A chart needs at least two numbers: type a label and a number on each row.');
            const u = unit.value.trim();
            useChart({ kind, points: good.slice(0, 12).map((r) => ({ label: r.label.trim(), value: Number(r.value.replace(/[£$€,%\s]/g, '')) })), unit: u, before: /^[£$€]/.test(u) });
          }, 'on'),
          key('USE THE STAGE’S LAST CHART', () => {
            void import('../show/stage').then(({ stageState }) => {
              const c = (stageState as { lastChart?: { kind: 'bars' | 'line'; points: { label: string; value: number }[]; unit: string; before: boolean } }).lastChart;
              if (!c) return say('There is no chart on the Stage yet. Ask me a question with numbers in the answer and I will draw one.');
              useChart({ kind: c.kind, points: c.points.slice(0, 12), unit: c.unit, before: c.before });
            });
          }),
          ...(have ? [key('TAKE THE CHART OFF', () => {
            change(withSlide(deck(), curId, (x) => setMedia(x, undefined)), 'none');
            showSlide(curId);
            undoBar('The chart is off the slide.');
          })] : []),
        );
      } else if (sub === 'table') {
        const t = cur.media?.k === 'table' ? cur.media.table : null;
        const setTable = (next: Block | undefined): void => {
          change(withSlide(deck(), curId, (x) => setMedia(x, next ? { k: 'table', table: next } : undefined)), 'none');
          showSlide(curId);
        };
        if (!t) {
          clear(subEl, h('p.slnote', 'A table of three rows and three columns to start; add or take away rows and columns after.'), key('ADD A TABLE', () => setTable(newTable(3, 3)), 'on'));
        } else {
          const rows = t.rows ?? [];
          const cols = Math.max(1, ...rows.map((r) => r.length));
          const grid = h('div.sltable', { style: `grid-template-columns: repeat(${cols}, minmax(96px, 1fr))` });
          rows.forEach((r, ri) => {
            for (let ci = 0; ci < cols; ci++) {
              const v = (r[ci] ?? []).map((x) => x.text).join('');
              const inp = h('input', { type: 'text', value: v, 'aria-label': `Row ${ri + 1}, column ${ci + 1}`, autocomplete: 'off' }) as HTMLInputElement;
              inp.addEventListener('change', () => {
                const nr = (deckTable()?.rows ?? rows).map((row, rj) => Array.from({ length: cols }, (_, cj) => (rj === ri && cj === ci ? (inp.value ? [{ text: inp.value }] : []) : row[cj] ?? [])));
                change(withSlide(deck(), curId, (x) => (x.media?.k === 'table' ? { ...x, media: { k: 'table', table: { ...x.media.table, rows: nr } } } : x)), 'draw');
              });
              grid.append(inp);
            }
          });
          const deckTable = (): Block | null => {
            const m = slide().media;
            return m?.k === 'table' ? m.table : null;
          };
          const edit = (f: (rs: Run[][][], n: number) => Run[][][]): void => {
            const live = deckTable() ?? t;
            const lr = live.rows ?? [];
            setTable({ ...live, rows: f(lr, Math.max(1, ...lr.map((r) => r.length))) });
          };
          const head = key(`HEADER ROW: ${t.head ? 'ON' : 'OFF'}`, () => setTable({ ...(deckTable() ?? t), head: !(deckTable() ?? t).head }));
          head.setAttribute('aria-pressed', String(!!t.head));
          head.dataset.case = 'keep';
          clear(subEl, grid,
            h('div.slrow',
              key('ADD A ROW', () => edit((rs, n) => [...rs, Array.from({ length: n }, () => [] as Run[])])),
              key('ADD A COLUMN', () => edit((rs) => rs.map((r) => [...r, [] as Run[]]))),
              key('TAKE A ROW OFF', () => ((deckTable()?.rows ?? rows).length > 1 ? edit((rs) => rs.slice(0, -1)) : say('A table keeps one row at least. Take the table off instead.'))),
              key('TAKE A COLUMN OFF', () => (cols > 1 ? edit((rs, n) => rs.map((r) => Array.from({ length: n - 1 }, (_, i) => r[i] ?? []))) : say('A table keeps one column at least. Take the table off instead.'))),
            ),
            head,
            key('TAKE THE TABLE OFF', () => {
              setTable(undefined);
              undoBar('The table is off the slide.');
            }),
          );
        }
      } else if (sub === 'shape') {
        const kinds: ShapeKind[] = ['rect', 'round', 'ellipse', 'arrow', 'line'];
        const lab: Record<ShapeKind, string> = { rect: 'RECTANGLE', round: 'ROUNDED', ellipse: 'ELLIPSE', arrow: 'ARROW', line: 'LINE' };
        const nudge = (id: string, dx: number, dy: number, dw = 0): void => {
          change(withSlide(deck(), curId, (x) => reshape(x, id, (sh) => ({ ...sh, x: sh.x + dx, y: sh.y + dy, w: sh.w + dw, h: sh.kind === 'line' ? 0 : sh.h + (dw ? (dw * sh.h) / Math.max(1, sh.w) : 0) }))), 'none');
          showSlide(curId);
        };
        clear(subEl,
          h('div.slrow', ...kinds.map((k) => key(lab[k], () => {
            const next = addShape(slide(), k);
            if (!next) return say('A slide holds two shapes at most. Take one off first.');
            change(withSlide(deck(), curId, () => next), 'none');
            showSlide(curId);
            say(`${SHAPE_NAMES[k]} added; its colour comes from the theme.`);
          }, '', `Add a ${SHAPE_NAMES[k].toLowerCase()}`))),
          ...cur.shapes.map((sh, n) => h('div.slshape',
            h('b', `Shape ${n + 1}: ${SHAPE_NAMES[sh.kind]}`),
            h('div.slrow',
              key('NEXT COLOUR', () => {
                change(withSlide(deck(), curId, (x) => reshape(x, sh.id, (z) => ({ ...z, fill: z.fill + 1 }))), 'none');
                showSlide(curId);
              }),
              key('SMALLER', () => nudge(sh.id, 12, 6, -24)),
              key('BIGGER', () => nudge(sh.id, -12, -6, 24)),
            ),
            h('div.slrow',
              key('LEFT', () => nudge(sh.id, -40, 0)), key('RIGHT', () => nudge(sh.id, 40, 0)), key('UP', () => nudge(sh.id, 0, -40)), key('DOWN', () => nudge(sh.id, 0, 40)),
              key('TAKE IT OFF', () => {
                change(withSlide(deck(), curId, (x) => removeShape(x, sh.id)), 'none');
                showSlide(curId);
                undoBar('The shape is off the slide.');
              }),
            ))),
        );
      } else clear(subEl, h('p.slnote', 'Add a photo, a chart from numbers you type, a table or a shape. A slide holds one picture, chart or table, and two shapes.'));
    };
    const keys = h('div.slrow', ...(['picture', 'chart', 'table', 'shape'] as const).map((k) => {
      const b = key(k.toUpperCase(), () => {
        sub = sub === k ? '' : k;
        keys.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b && sub === k)));
        draw();
      }, '', k === 'picture' ? 'A picture' : k === 'chart' ? 'A chart' : k === 'table' ? 'A table' : 'A shape');
      b.setAttribute('aria-pressed', String(sub === k));
      return b;
    }));
    const root = h('div.slpanel', h('small.slh', 'INSERT'), keys, subEl);
    void s;
    draw();
    return root;
  }

  // ---- SLIDE
  function slidePanel(): HTMLElement {
    const d = deck();
    const s = slide();
    const i = indexOf(d, s.id);
    const up = key('MOVE UP', () => moveBy(-1));
    const down = key('MOVE DOWN', () => moveBy(1));
    up.disabled = i === 0;
    down.disabled = i === d.slides.length - 1;
    const trans = h('div.slrow', ...TRANSITIONS.map((t) => {
      const b = key(t === 'none' ? 'NO TRANSITION' : t === 'fade' ? 'FADE' : 'PUSH', () => {
        change(withSlide(deck(), curId, (x) => ({ ...x, transition: t as Transition })), 'none');
        trans.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      b.setAttribute('aria-pressed', String(s.transition === t));
      return b;
    }));
    const names: Record<Elem, string> = { title: 'The title', body: 'The text', body2: 'The right column', media: 'The picture, chart or table', shape0: 'The first shape', shape1: 'The second shape' };
    const builds = h('div.slbuilds', ...elements(s).map((el) => {
      const row = h('div.slbuild', h('span', names[el]));
      const seg = h('div.slrow');
      const opts: (Anim | null)[] = [null, ...ANIMS];
      for (const o of opts) {
        const b = key(o === null ? 'THERE AT FIRST' : o === 'appear' ? 'APPEARS' : o === 'fade' ? 'FADES IN' : 'RISES IN', () => {
          change(withSlide(deck(), curId, (x) => setBuild(x, el, o)), 'none');
          seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          say(o ? `${names[el]} comes in on a tap in the talk.` : `${names[el]} is there from the start.`);
        }, '', `${names[el]}: ${o ?? 'there at first'}`);
        b.setAttribute('aria-pressed', String(buildOf(slide(), el) === o));
        seg.append(b);
      }
      row.append(seg);
      return row;
    }));
    return h('div.slpanel',
      h('small.slh', 'THIS SLIDE'),
      h('div.slrow', up, down,
        key('DUPLICATE', () => {
          flush();
          const r = duplicateSlide(deck(), curId);
          if (!r.copy) return;
          change(r.deck, 'none');
          curId = r.copy.id;
          showSlide(curId);
          say(`Copied: this is slide ${indexOf(deck(), curId) + 1}.`);
        }),
        key('DELETE', () => {
          flush();
          const dd = deck();
          if (dd.slides.length < 2) return say('A deck keeps one slide at least. Change this one, or delete the deck.');
          const at = indexOf(dd, curId);
          change(removeSlide(dd, curId), 'none');
          curId = deck().slides[Math.min(at, deck().slides.length - 1)]!.id;
          showSlide(curId);
          undoBar(`Slide ${at + 1} deleted.`);
        })),
      h('small.slh', 'HOW IT COMES IN'),
      trans,
      h('small.slh', 'ON A TAP IN THE TALK'),
      builds,
      h('p.slnote', 'Transitions and builds show in the talk. The PowerPoint file does not carry them.'),
    );
  }

  // ---- NOTES
  function notesPanel(): HTMLElement {
    const sid = curId;
    let nt = 0;
    const ta = h('textarea.slnotes', { rows: 7, placeholder: 'What I will say on this slide', 'aria-label': 'Speaker notes for this slide' }) as HTMLTextAreaElement;
    ta.value = slide().notes;
    const count = h('small.slnote', '');
    const paint = (): void => void (count.textContent = `${(ta.value.match(/\S+/g)?.length ?? 0).toLocaleString('en-GB')} words · shown to you in the talk, never on the slide`);
    paint();
    const commit = (): void => {
      clearTimeout(nt);
      const s = deck().slides.find((x) => x.id === sid);
      if (s && ta.value !== s.notes) change(withSlide(deck(), sid, (x) => ({ ...x, notes: ta.value })), 'none');
    };
    flushers.add(commit);
    ta.addEventListener('input', () => {
      paint();
      clearTimeout(nt);
      nt = window.setTimeout(commit, 350);
    });
    ta.addEventListener('blur', commit);
    return h('div.slpanel', h('small.slh', 'NOTES'), ta, count);
  }

  // ---------------------------------------------------------------- the talk
  function stopPresent(): void {
    clearInterval(ticking);
    document.removeEventListener('keydown', onPresentKey, true);
    presentEl?.remove();
    presentEl = null;
    void wake?.release().catch(() => undefined);
    wake = null;
    slidesState.present = { ...slidesState.present, on: false };
  }
  function onPresentKey(e: KeyboardEvent): void {
    if (!presentEl) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return exitPresent();
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
      presentGo?.(1);
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
      e.preventDefault();
      presentGo?.(-1);
    }
  }
  let presentGo: ((dir: 1 | -1) => void) | null = null;
  let exitPresent: () => void = () => undefined;

  function startPresent(from: number): void {
    flush();
    stopPresent();
    const d = deck();
    if (!d.slides.length) return;
    slidesState.view = 'present';
    let i = Math.max(0, Math.min(d.slides.length - 1, from));
    let step = 0;
    let ended = false;
    const t0 = Date.now();
    const time = h('b.sltime', '00:00');
    const count = h('span.slcount');
    const holder = h('div.slpbox', { role: 'button', tabIndex: 0, 'aria-label': 'The slide. Tap for the next step; two fingers to go back.' });
    const next = h('p.slnext');
    const notes = h('div.slpnotes', { role: 'region', 'aria-label': 'Your notes for this slide', tabIndex: 0 });
    const backKey = key('BACK', () => go(-1), 'slpkey', 'Back');
    const nextKey = key('NEXT', () => go(1), 'on slpkey', 'Next');
    const ovl = h('div.slpresent', { role: 'dialog', 'aria-label': 'Presenting' },
      h('div.slptop', time, count, key('EXIT', () => exitPresent(), '', 'Stop presenting')),
      h('div.slpstage', holder), next, notes, h('div.slpkeys', backKey, nextKey));
    presentEl = ovl;
    exitPresent = (): void => {
      stopPresent();
      showSlide(deck().slides[i]?.id ?? curId);
      say('The talk is over. You are back at the slide you stopped on.');
    };
    const reveal = (fresh: boolean): void => {
      const s = d.slides[i]!;
      holder.querySelectorAll<SVGElement>('[data-b]').forEach((g) => {
        const b = Number(g.dataset.b);
        g.classList.toggle('slhid', b > step);
        g.classList.remove('slin-appear', 'slin-fade', 'slin-rise');
        if (fresh && b === step && !still()) g.classList.add(`slin-${g.dataset.how}`);
      });
      void s;
    };
    const paint = (fresh: boolean, changed: boolean): void => {
      const s = d.slides[i]!;
      holder.innerHTML = slideSvg(d, s, { n: i + 1, of: d.slides.length, image, measure });
      holder.classList.remove('sltr-fade', 'sltr-push');
      slidesState.present.transition = '';
      if (changed && s.transition !== 'none' && !still()) {
        void holder.offsetWidth;
        holder.classList.add(`sltr-${s.transition}`);
        slidesState.present.transition = s.transition;
      }
      reveal(fresh);
      count.textContent = `${i + 1} of ${d.slides.length}`;
      const nx = d.slides[i + 1];
      next.textContent = ended ? 'THE END OF THE DECK' : nx ? `NEXT: ${slideName(nx, i + 2)}` : step < s.builds.length ? `NEXT: ${s.builds.length - step} more on this slide` : 'THIS IS THE LAST SLIDE';
      notes.textContent = s.notes.trim() || 'No notes on this slide.';
      notes.classList.toggle('none', !s.notes.trim());
      nextKey.disabled = ended;
      backKey.disabled = i === 0 && step === 0 && !ended;
      slidesState.present = { ...slidesState.present, on: true, i, step, builds: s.builds.length, of: d.slides.length, notes: s.notes, next: next.textContent, elapsed: Math.round((Date.now() - t0) / 1000) };
    };
    function go(dir: 1 | -1): void {
      const s = d.slides[i]!;
      if (dir === 1) {
        if (ended) return;
        if (step < s.builds.length) {
          step++;
          paint(true, false);
        } else if (i < d.slides.length - 1) {
          i++;
          step = 0;
          paint(false, true);
        } else {
          ended = true;
          paint(false, false);
          say('That was the last slide. BACK goes back; EXIT leaves the talk.');
        }
      } else if (ended) {
        ended = false;
        paint(false, false);
      } else if (step > 0) {
        step--;
        paint(false, false);
      } else if (i > 0) {
        i--;
        step = d.slides[i]!.builds.length;
        paint(false, true);
      }
    }
    presentGo = go;
    let ignore = 0;
    holder.addEventListener('click', () => {
      if (Date.now() < ignore) return;
      go(1);
    });
    // two fingers touching together and lifting again: back
    let two = 0;
    holder.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) two = Date.now();
    }, { passive: true });
    holder.addEventListener('touchend', (e) => {
      if (two && e.touches.length === 0 && Date.now() - two < 450) {
        two = 0;
        ignore = Date.now() + 500;
        go(-1);
      } else if (e.touches.length === 0) two = 0;
    }, { passive: true });
    document.addEventListener('keydown', onPresentKey, true);
    (document.querySelector('.modal') ?? document.body).append(ovl);
    ticking = window.setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      time.textContent = elapsedWords(s);
      slidesState.present.elapsed = s;
    }, 1000);
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((l) => (wake = l)).catch(() => undefined);
    paint(false, false);
    ovl.querySelector<HTMLElement>('.slpkeys button.on')?.focus();
    say('');
  }

  // ---------------------------------------------------------------- open
  // ---------------------------------------------------------------- Ghosty's marked changes (BRIEF-KERNEL-3): the brain's `slides` tool proposes, his tap decides
  const props = proposalBar(() => {
    slidesState.proposals = props.list();
  }, (words) => say(words));
  const dataOf = (): string => {
    if (!hist) return '';
    const d = deck();
    return openWorkBlock('slides', `deck | title ${q(d.title)} | slides ${d.slides.length} | theme ${d.palette ? 'file' : d.theme}`, d.slides.map((s, i) => `slide ${i + 1} | layout ${s.layout} | title ${q(textOf(s.title))}${s.body.map((b) => ` | b ${q(textOf(b))}`).join('')}`));
  };
  const gone = (): never => {
    throw Object.assign(new Error('That slide is not in the deck any more, so I left it alone.'), { refuse: true });
  };
  const proposeHere = (a: Record<string, unknown>): string => {
    if (!hist) return 'No deck is open.';
    const d = deck();
    const n = typeof a.slide === 'number' ? a.slide : 0;
    const target = d.slides[n - 1];
    const text = typeof a.text === 'string' ? a.text : '';
    const mark = (id: string) => (on: boolean): void => void view.querySelectorAll<HTMLElement>(`.slcard[data-id="${id}"]`).forEach((c) => c.classList.toggle('slprop', on));
    const again = (id: string): Slide => deck().slides.find((x) => x.id === id) ?? gone();
    if (a.change === 'title' && target) {
      const id = target.id;
      props.add({ line: `Slide ${n}'s title`, old: slideTitle(target), now: text, mark: mark(id), accept: () => change(withSlide(deck(), id, (sl) => ({ ...again(id), title: { ...sl.title, runs: [{ text }] } }))) });
    } else if (a.change === 'body' && target) {
      const id = target.id;
      const lines = text.split('\n').filter(Boolean);
      props.add({ line: `Slide ${n}'s words`, old: plainOf(target.body), now: lines.join('\n'), mark: mark(id), accept: () => change(withSlide(deck(), id, (sl) => ({ ...again(id), body: lines.map((l) => block(defaultKind(sl.layout), l)) }))) });
    } else if (a.change === 'remove' && target) {
      const id = target.id;
      props.add({ line: `Take slide ${n} out`, old: slideTitle(target), now: '', mark: mark(id), accept: () => change(removeSlide(deck(), again(id).id)) });
    } else if (a.change === 'add') {
      const after = typeof a.after === 'number' ? Math.max(0, Math.min(d.slides.length, a.after)) : d.slides.length;
      const title = typeof a.title === 'string' ? a.title : '';
      const lines = (typeof a.body === 'string' ? a.body : '').split('\n').filter(Boolean);
      props.add({ line: `A new slide after slide ${after}`, old: '', now: [title, ...lines].filter(Boolean).join('\n'), accept: () => change(insertSlide(deck(), after, newSlide('bullets', { title: block('h1', title), body: bullets(lines) }))) });
    } else if (a.change === 'theme' && typeof a.theme === 'string' && (THEME_KEYS as readonly string[]).includes(a.theme)) {
      const k = a.theme;
      props.add({ line: `The ${THEMES[k]!.name} theme for every slide`, old: THEMES[d.palette ? 'ghosty' : d.theme]?.name ?? d.theme, now: THEMES[k]!.name, accept: () => change({ ...deck(), theme: k, palette: undefined }) });
    } else {
      const f = 'I could not place that change in the deck.';
      say(f);
      return f;
    }
    const words = 'Ghosty marked a change: ACCEPT applies it, REJECT leaves your slides as they were.';
    say(words);
    return words;
  };
  const askEl = askBox('slides', 'the deck', dataOf, proposeHere, (w) => say(w), () => flush());
  const sync = (): void => {
    askEl.hidden = !hist;
    if (!hist) props.clear();
  };
  const root = h('div.slsheet', status, props.el, view, askEl, fileIn, photoIn);
  sync();
  setLiveWork('slides', { data: dataOf, propose: proposeHere });
  const start = async (o: SlidesAsk): Promise<void> => {
    if (o.deck) {
      hist = new History(o.deck);
      curId = o.deck.slides[0]?.id ?? '';
      savedOnce = false;
      keep(o.deck);
      showDeck();
    } else if (o.report) {
      const d = deckFromMarkdown(o.report.text, { title: o.report.title, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, 'a reply');
      if (d.slides.length < 2) {
        showList();
        say('There is nothing in that answer to make slides of.');
      } else startDeck(d, `${d.slides.length} slides made on this phone from that answer. Tap one to change its words.`);
    } else if (o.doc) {
      const d = deckFromDoc(o.doc, { date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) });
      startDeck(d, `${d.slides.length} slides made on this phone from “${o.doc.title}”.`);
    } else if (o.chart) {
      const d = deckFromChart(o.chart.title ?? '', o.chart.chart);
      startDeck(d, 'A deck with the chart on its second slide. Add slides around it.');
    } else if (o.id && getDeck(o.id)) openDeck(o.id);
    else if (o.what === 'new') startDeck(blankDeck(), 'A blank deck: a title slide and a slide of bullets. Tap one to type into it.');
    else if (o.what === 'report') {
      showList();
      void showReport();
    } else if (o.what === 'import') {
      showList();
      say('Choose the PowerPoint file (.pptx) and I open it here.');
      fileIn.click();
    } else if (o.what === 'list') showList();
    else {
      const wh = where();
      if (wh && getDeck(wh.deck)) openDeck(wh.deck, wh.slide);
      else showList();
    }
  };
  return {
    el: root,
    start,
    stop: () => {
      flush();
      stopPresent();
      setLiveWork('slides', null);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    },
  };
}
