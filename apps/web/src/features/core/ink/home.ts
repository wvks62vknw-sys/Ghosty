/**
 * ONE INK'S HOME: THE PRINTED PAGE (BRIEF-ONE-INK 2; the design fixed by docs/build-plan/mockups/hud/2026-11-08-2/ink-home.png).
 * Bone ink on the warm ground, rules instead of boxes, my voice in the serif: the stamp line as the masthead with a rule under it,
 * `Good evening, Boss.` at 36 px and my one sentence under it in the italic, the real orb drawn in ink on an equator rule (Mind,
 * its wrap given bone as its accent and no glow: state/theme.ts orbTokens reads body.inkhome), ONE ENTRY (the thing the Machine is
 * looking at tonight, with its two keys), RECENT and FAVOURITES as underlined words on rules, the ask line as a rule with SPEAK at its
 * right, and the rooms as the foot (the shared house, drawn in ink by styles.css: shell/house.ts). Nothing else is on this page.
 *
 * It takes from Core what Core already keeps, as THE SCAN's Home does: the stamp line and the orb's wrap (one of each on Home), and
 * gives them back when the look is another; the latest reply's caption stays where Core keeps it and its words are read, never copied
 * into a second text of their own. The greeting, the sentence, the thing of the hour and the lists come from their one sources
 * (shell/areas.ts greeting and pinnedAndRecent, scan/home.ts sayTwo and bookNow, Core's next event). Drawn only on a phone; Glass's
 * Home and The Scan's are not touched.
 */
import { h } from '../../../core/dom';
import { greeting, navTo, pinnedAndRecent, toolName } from '../../../shell/areas';
import { pinOnHold } from '../../../shell/favourites';
import { openChat } from '../../../shell/launcher';
import { togglePalette } from '../../../commands/registry';
import { brain } from '../../../api/brain';
import { settings } from '../../../state/app';
import { key, tag } from '../../../ui/machine';
import { currentMind } from '../mind';
import { decide } from '../scan/place';
import { ribbon } from '../ribbon';
import { startDay } from '../day';
import { bookName, bookNow, sayTwo, whenWord } from '../scan/home';
import { loadTodos } from '../../agenda/todo';
import { dueToday, dueWords } from '../../agenda/todowords';
import { goToPanel } from '../../../ui/sections';

const LISTEN = '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10"/>';
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;

/** What Home is doing, for the checks and the console (window.__ghosty.ink). */
export const inkState = {
  on: false,
  /** The thing of the hour: its kind, its name, its one line and the word on its tag. */
  tonight: { kind: '', name: '', line: '', tag: '' },
  /** The second line under the greeting, as it is said now. */
  line: '',
  recent: [] as string[],
  favourites: [] as string[],
  /** A check's clock for the hour's words (ms since the epoch), else the phone's. */
  clock: null as null | (() => number),
};
const now = () => inkState.clock?.() ?? Date.now();

export interface InkHome {
  el: HTMLElement;
  /** Home came on screen: take the parts, draw the page. */
  enter(): void;
  leave(): void;
  /** Something Home reads changed (the next event arrived): the words are written again. */
  refresh(): void;
}

/** The word on the entry's tag by the hour (the mock's `Tonight`; this morning's and the afternoon's say their own). */
export const hourWord = (d = new Date(now())): string => {
  const hr = d.getHours();
  return hr >= 17 || hr < 5 ? 'Tonight' : hr < 12 ? 'This morning' : 'Today';
};

/**
 * Which of the three tonight's thing is (ORBIT's lit station and its hour card read it; tonightEntry below draws the same three for ONE INK,
 * THE SCAN's room, THE MAP and THE EYE): the book he is in, else the next thing on his agenda (`next`: Core's next event, "Dentist · 9:30 AM",
 * or nothing), else the Brief. Never invented.
 */
export const tonightKind = (next: string): 'book' | 'agenda' | 'todo' | 'brief' => (bookNow() ? 'book' : next ? 'agenda' : dueToday(loadTodos(), Date.now()).length ? 'todo' : 'brief');

/**
 * [planlane:home] The to-dos due today or late (the agenda's TO-DO, kept on this phone) as the hour's thing, when there is no book and
 * nothing next in the diary: the first one's own words, the day it is due ("Due today", "2 days late") and how many more. Home's hour
 * card, the Today card and the Brief's YOUR DAY all read the same list.
 */
export function todoEntry(): Omit<Entry, 'kind'> & { kind: 'todo' } | null {
  const due = dueToday(loadTodos(), Date.now());
  if (!due.length) return null;
  const more = due.length - 1;
  return {
    kind: 'todo',
    name: due[0]!.text,
    line: [dueWords(due[0]!.due, Date.now()), more ? `${more} more to do` : ''].filter(Boolean).join(' · '),
    right: 'To-do',
    fill: { word: 'Open the to-do list', label: 'Open your to-do list', run: () => goToPanel('agenda', 'TO-DO') },
    ghost: { word: 'Brief me', label: 'Brief me', run: () => navTo('brief', 'push') },
  };
}

export interface Entry {
  kind: 'book' | 'agenda' | 'todo' | 'brief';
  name: string;
  line: string;
  right: string;
  fill: { word: string; label: string; run: () => void };
  ghost: { word: string; label: string; run: () => void; glyph?: string };
}

/** Open the book he is in at his place, or the Shelf where the reader has nothing to open yet; `aloud` starts it reading. */
export async function carryOn(doc: string, aloud: boolean): Promise<void> {
  try {
    const r = await import('../../library/reader');
    const d = r.shelfDocs.get().docs.find((x) => x.id === doc);
    if (d) return void (await r.openBook(d, aloud ? { listen: {} } : {}));
  } catch {
    /* the shelf is the way in */
  }
  navTo('library?shelf', 'push');
}

/** The thing of the hour: the book he is in, else the next thing in his agenda, else the Brief (never invented). ONE INK's page and THE MAP's square share it. */
export function tonightEntry(nextUp: () => string): Entry {
  const book = bookNow();
  if (book) {
    return {
      kind: 'book',
      name: bookName(book.doc),
      line: [book.page ? `Page ${book.page}` : '', `${Math.round(book.pct * 100)} % read`, whenWord(book.at)].filter(Boolean).join(' · '),
      right: 'Reading',
      fill: { word: 'Carry on reading', label: 'Carry on reading', run: () => void carryOn(book.doc, false) },
      ghost: { word: 'Listen', label: 'Listen: I read it to you from your place', run: () => void carryOn(book.doc, true), glyph: LISTEN },
    };
  }
  const next = nextUp();
  if (next) {
    const at = next.lastIndexOf(' · ');
    return {
      kind: 'agenda',
      name: at > 0 ? next.slice(0, at) : next,
      line: at > 0 ? `Next on your agenda · ${next.slice(at + 3)}` : 'Next on your agenda',
      right: 'Agenda',
      fill: { word: 'Open the agenda', label: 'Open the agenda', run: () => navTo('agenda', 'push') },
      ghost: { word: 'Brief me', label: 'Brief me', run: () => navTo('brief', 'push') },
    };
  }
  const todo = todoEntry();
  if (todo) return todo;
  return {
    kind: 'brief',
    name: 'The Brief',
    line: 'Tap to read it',
    right: 'Brief',
    fill: { word: 'Read the brief', label: 'Read the brief', run: () => navTo('brief', 'push') },
    ghost: { word: 'Ask me', label: 'Ask me anything', run: () => togglePalette() },
  };
}

/**
 * Build Home (once, at Core's mount). `orbWrap`: the hero's wrap holding the 2-D reactor canvas the orb is drawn over (Mind's anchor);
 * `stamp`: Home's stamp line; `caption`: the latest reply's line (read, not moved); `mic`: the talk bar's microphone; `nextUp`: Core's
 * next event ("Dentist · 9:30 AM", or nothing).
 */
export function inkHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; mic: () => void; nextUp: () => string; next?: () => string | null; onBack: () => void }): InkHome {
  startDay();
  const mast = h('header.inkmast', { dataset: { case: 'keep' } });
  const say = h('p.inksay', { dataset: { case: 'keep' } });
  const say2 = h('p.inksay2', { dataset: { case: 'keep' } });
  const orbHost = h('div.inkorbhost');
  const orb = h('div.inkorb', h('i.inkequator', { 'aria-hidden': 'true' }), orbHost);
  const entry = h('section.inkentry', { 'aria-label': 'The one thing' });
  const recent = h('div.inkl', { dataset: { list: 'recent' } });
  const pins = h('div.inkl', { dataset: { list: 'favourites' } });
  const lists = h('section.inklists', recent, pins);
  const field = h('button.inkfield', { type: 'button', 'aria-label': 'Ask or find anything', dataset: { case: 'keep' } }, 'Ask or find anything');
  const speak = h('button.inkspeak', { type: 'button', 'aria-label': 'Talk to me', dataset: { case: 'keep' } }, 'Speak');
  const ask = h('div.inkask', field, speak);
  const el = h('div.inkframe', mast, say, say2, orb, entry, lists, ask);
  // THE READOUT RIBBON (BRIEF-OCT-IDEAS-1 1): the same line, set in the serif under the masthead; drawn after the hand-over, never on the first frame
  const rib = ribbon('ink', o.next ?? (() => null));
  let ribTimer = 0;
  let goneAt = 0;
  const armRibbon = () => {
    if (rib.el.isConnected || ribTimer) return;
    const show = () => {
      ribTimer = 0;
      if (!inkState.on) return;
      if (document.getElementById('boot')) ribTimer = window.setTimeout(show, 150);
      else if (!goneAt) {
        goneAt = performance.now();
        ribTimer = window.setTimeout(show, 500);
      } else rib.mount(el, say);
    };
    ribTimer = window.setTimeout(show, 600);
  };

  field.addEventListener('click', () => togglePalette());
  speak.addEventListener('click', () => o.mic());
  // the italic line, once it holds a reply, is the way into the conversation
  say2.addEventListener('click', () => el.dataset.reply === 'true' && openChat());
  // the orb answers a tap as the reactor does (and a poke of the Mind)
  orbHost.addEventListener('click', () => {
    currentMind()?.poke();
    o.onBack();
  });
  // SPEAK says so while the talk bar is listening
  const bodyClass = () => speak.classList.toggle('on', document.body.classList.contains('listening'));
  new MutationObserver(bodyClass).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // the parts of today's Home this page takes (and gives back when the look is another)
  const taken: { el: HTMLElement; into: HTMLElement; parent: HTMLElement | null; next: Node | null }[] = [
    { el: o.stamp, into: mast, parent: null, next: null },
    { el: o.orbWrap, into: orbHost, parent: null, next: null },
  ];
  const take = () => {
    for (const t of taken) {
      if (t.el.parentElement === t.into) continue;
      t.parent = t.el.parentElement;
      t.next = t.el.nextSibling;
      t.into.append(t.el);
    }
  };
  const giveBack = () => {
    for (const t of taken) if (t.parent && t.el.parentElement === t.into) t.parent.insertBefore(t.el, t.next && t.next.parentElement === t.parent ? t.next : null);
  };

  // ---------------------------------------------------------------- the thing of the hour (the same source as THE SCAN's room: tonightEntry above)
  // the shelf's own titles ("Alice’s Adventures in Wonderland"): the entry says the document's id (as THE SCAN's room does) until the shelf
  // has been read, then the real title. The shelf is read when something else has read it (the Library, the LEARN room); when none has by
  // the time the first screen is long done, once, here: a read of his own shelf from his own brain, never on the first screen.
  const titles = new Map<string, string>();
  let unwatch: (() => void) | null = null;
  let askedAt = 0;
  const learnTitles = () =>
    void import('../../library/reader').then((r) => {
      const read = () => {
        let changed = false;
        for (const d of r.shelfDocs.get().docs) if (titles.get(d.id) !== d.title) (titles.set(d.id, d.title), (changed = true));
        if (changed && inkState.on) api.refresh();
      };
      read();
      unwatch ??= r.shelfDocs.subscribe(read);
      const book = bookNow();
      if (book && !titles.has(book.doc) && Date.now() - askedAt > 300_000) {
        askedAt = Date.now();
        setTimeout(() => void brain.library().then((l) => r.shelfDocs.set({ docs: l.docs, at: Date.now() })).catch(() => undefined), 2500);
      }
    }).catch(() => undefined);
  /** The shared entry (tonightEntry), with the book named by its real title once the shelf has been read. */
  const tonight = (): Entry => {
    const e = tonightEntry(o.nextUp);
    const book = e.kind === 'book' ? bookNow() : null;
    const title = book ? titles.get(book.doc) : undefined;
    return title ? { ...e, name: title } : e;
  };

  let entryKey = '';
  const paintEntry = () => {
    const e = tonight();
    const word = hourWord();
    const sig = `${e.kind}|${e.name}|${e.line}|${word}`;
    inkState.tonight = { kind: e.kind, name: e.name, line: e.line, tag: word };
    if (sig === entryKey) return;
    entryKey = sig;
    const fill = key(e.fill.word, e.fill.run, { kind: 'fill', label: e.fill.label });
    const ghost = key(e.ghost.word, e.ghost.run, { kind: 'ghost', label: e.ghost.label, glyph: e.ghost.glyph });
    entry.replaceChildren(
      h('div.kick', h('span.g-index.on', { dataset: { g: 'index', case: 'keep' }, 'aria-label': 'number 1' }, '01'), tag(word, { tone: 'on' }), h('span.g-truth', { dataset: { case: 'keep' } }, e.right)),
      h('h2', { dataset: { case: 'keep' } }, e.name),
      h('p.g-truth.inkline', { dataset: { g: 'truth', case: 'keep' } }, e.line),
      h('div.keys', fill, ghost));
    entry.dataset.kind = e.kind;
  };

  // ---------------------------------------------------------------- RECENT and FAVOURITES (shell/areas.ts: the jump bar's own lists)
  const word = (t: { id: string; cardTo?: string; title: string }, fav: boolean) => {
    const name = toolName(t as never);
    const b = h('button.inkword', { type: 'button', dataset: { id: t.id, case: 'keep', ...(fav ? { fav: 'true' } : {}) }, 'aria-label': `${name}${fav ? ', pinned' : ''}` }, name);
    b.addEventListener('click', () => navTo(t.cardTo ?? t.id, 'push'));
    // a long press on a word pins or unpins it, as the deck does (a tap is the tap; the lift that ends the press opens nothing)
    pinOnHold(b, t.id);
    return b;
  };
  let listKey = '';
  const paintLists = () => {
    const { pinned, lately } = pinnedAndRecent();
    inkState.recent = lately.map((t) => t.id);
    inkState.favourites = pinned.map((t) => t.id);
    const sig = `${inkState.recent.join()}|${inkState.favourites.join()}`;
    if (sig === listKey) return;
    listKey = sig;
    recent.replaceChildren(h('span.g-truth', { dataset: { case: 'keep' } }, 'Recent'), ...(lately.length ? lately.map((t) => word(t, false)) : [h('span.inknone', { dataset: { case: 'keep' } }, 'Nothing opened yet')]));
    pins.replaceChildren(h('span.g-truth', { dataset: { case: 'keep' } }, 'Favourites'), ...(pinned.length ? pinned.map((t) => word(t, true)) : [h('span.inknone', { dataset: { case: 'keep' } }, 'Hold a word to pin it')]));
  };

  // ---------------------------------------------------------------- the words
  let sentence = '';
  /** My one sentence under the greeting: the latest reply's caption when there is one (Core's own text, read as it stands), else the Machine's sentence. */
  const paintLine = () => {
    const live = (o.caption.firstElementChild?.textContent ?? '').trim();
    const reply = !!live && !o.caption.classList.contains('fade');
    const text = reply ? live : sentence;
    if (say2.textContent !== text) say2.textContent = text;
    el.dataset.reply = String(reply);
    if (reply) say2.setAttribute('role', 'button');
    else say2.removeAttribute('role');
    inkState.line = text;
  };
  const paintWords = () => {
    const d = new Date(now());
    const g = `${greeting(d)}.`;
    if (say.textContent !== g) say.textContent = g;
    sentence = sayTwo(decide(now()), d.getHours());
    paintLine();
    paintEntry();
    paintLists();
    rib.paint();
  };
  new MutationObserver(() => inkState.on && paintLine()).observe(o.caption, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  let minute = 0;
  let wanted = false;
  const api: InkHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      inkState.on = true;
      document.body.classList.add('inkhome');
      take();
      armRibbon();
      paintWords();
      learnTitles();
      // the orb is drawn in bone with no glow: the Mind reads its light again now that the page is on
      currentMind()?.recolour();
      clearInterval(minute);
      minute = window.setInterval(paintWords, 30_000);
    },
    leave() {
      wanted = false;
      if (!inkState.on) return;
      inkState.on = false;
      unwatch?.();
      unwatch = null;
      document.body.classList.remove('inkhome');
      giveBack();
      clearInterval(minute);
      clearTimeout(ribTimer);
      ribTimer = 0;
      currentMind()?.recolour();
    },
    refresh() {
      if (inkState.on) paintWords();
    },
  };
  addEventListener('resize', () => {
    if (wanted && phone() && !inkState.on) api.enter();
    else if (inkState.on && !phone()) {
      api.leave();
      wanted = true;
    }
  });
  // his pins and his name change the page where it stands
  settings.subscribe((s, p) => inkState.on && (s.favourites !== p.favourites || s.name !== p.name) && api.refresh());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.ink = inkState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return api;
}
