/**
 * GROWN UP'S HOME (BRIEF-GROWN-UP-HUD 2; the design fixed by docs/build-plan/mockups/directions/d3/home-440.png): today's Home with the
 * overcrowding taken out. The stamp line (the shell's one source) and the avatar at the top; `Good evening, Boss.` and my one sentence under it
 * (a reply's words replace the sentence, as in ONE INK); the orb, Mind, as the hero with ONE ring on it (what is left of today's free answers:
 * the one gauge kept, read from the source the four gauges read, features/core/home.ts `freeAnswers`) and the line that says it; THE HOUR'S CARD
 * (tonight's thing from ink/home.ts's one source: `Carry on reading`, else the agenda's next, else the Brief) as one glass card with its reading and
 * one key; ONE ROW of chips: his recents then his favourites as the deck knows them, each its name (a tap opens it, a long press pins or unpins it
 * as the deck does) and the three dots for the rest. The capsule is the dock's (shell/capsule.ts), as on every screen. The four gauges, the second bar,
 * the weather and the Today cards are not drawn in this world: nothing is removed from the app, each is one tap away (the Brief, the agenda, the field).
 *
 * The real orb is Mind's: Home's hero wrap is taken into the page as it is, and given back when the look is another. Nothing is invented: a reading the
 * phone does not have is left out and the ring says so. Drawn only on a phone; Glass's Home, THE SCAN's, ONE INK's, THE MAP's and ORBIT's are not touched.
 */
import { clear, h, icon, svgEl } from '../../../core/dom';
import { greeting, navTo, pinnedAndRecent, toolName } from '../../../shell/areas';
import { pinOnHold } from '../../../shell/favourites';
import { openChat } from '../../../shell/launcher';
import { thingLine } from '../../../shell/inventory';
import { housePlan } from '../../../shell/house';
import { settings } from '../../../state/app';
import { currentMind } from '../mind';
import { decide } from '../scan/place';
import { bookNow, sayTwo, whenWord } from '../scan/home';
import { hourWord, tonightEntry, type Entry } from '../ink/home';
import { freeAnswers } from '../home';

const MORE = '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const BOOK = '<path d="M5 4.5h11.5a2 2 0 012 2V19a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19z"/><path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h3.5"/>';
const CAL = '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>';
const LISTEN = '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10"/>';
const GLYPH: Record<string, string> = { book: BOOK, agenda: CAL, todo: CAL, brief: BOOK };
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;
/** The row holds this many things before its three dots (the field and THE ROOMS layer have the rest). */
export const CHIPS_MAX = 3;

/** What Home is doing, for the checks and the console (window.__ghosty.grownHome). */
export const grownHomeState = {
  on: false,
  /** The one sentence under the greeting, as it is said now. */
  line: '',
  /** The ring: what it measures and the line that says it. */
  ring: { frac: null as number | null, says: '' },
  /** The row of chips, in order: recents then favourites. */
  chips: [] as { id: string; kind: 'recent' | 'favourite' }[],
  /** The hour's card: its kind and kicker. */
  tonight: { kind: '', kicker: '' },
  /** A check's clock for the hour's words (ms since the epoch), else the phone's. */
  clock: null as null | (() => number),
};
const now = () => grownHomeState.clock?.() ?? Date.now();

export interface GrownHome {
  el: HTMLElement;
  /** Home came on screen: take the parts, draw the page. */
  enter(): void;
  leave(): void;
  /** Something Home reads changed (the next event arrived): the words are written again. */
  refresh(): void;
}

/** The ring's geometry is the free-answers arc's own (features/core/home.ts): open at the bottom, 135 degrees round to 405. */
const A0 = 135;
const SPAN = 270;
const P = (r: number, a: number): [number, number] => [100 + r * Math.cos((a * Math.PI) / 180), 100 + r * Math.sin((a * Math.PI) / 180)];
const arcD = (r: number, a0: number, a1: number): string => {
  const [x0, y0] = P(r, a0);
  const [x1, y1] = P(r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

/** The line under the ring, from the same reading the ring draws (never a number the phone does not have). */
export function freeWords(): { frac: number | null; says: string } {
  const { f, offline, at } = freeAnswers;
  if (!f) return { frac: null, says: at ? (offline ? 'I can’t count today’s free answers: my brain is out of reach.' : 'I can’t count today’s free answers right now.') : 'I’m counting today’s free answers.' };
  if (f.frac == null) return { frac: null, says: 'I haven’t measured today’s free answers yet.' };
  if (f.value === 'None') return { frac: 0, says: 'I have no AI key yet. Add one in System and I can answer.' };
  if (f.unit !== '%') return { frac: f.frac, says: f.value === 'Open' ? 'Today’s free answers have no daily cap.' : 'Today’s free answers are used up. Room comes back soon.' };
  return { frac: f.frac, says: f.tone === 'warn' ? `Only ${f.value}% of today’s free answers are left.` : `I have ${f.value}% of today’s free answers left.` };
}

/**
 * Build Home (once, at Core's mount). `orbWrap`: the hero's wrap holding the 2-D reactor canvas the orb is drawn over (Mind's anchor);
 * `stamp`: Home's stamp line; `caption`: the latest reply's line (read, not moved); `nextUp`: Core's next event.
 */
export function grownHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; nextUp: () => string }): GrownHome {
  const mast = h('header.gnmast', { dataset: { case: 'keep' } });
  const say = h('h1.gnsay', { dataset: { case: 'keep' } });
  const say2 = h('p.gnsay2', { dataset: { case: 'keep' } });
  // the hero: the orb with its one ring (the free answers left today), and what the ring says under it
  const ring = svgEl('svg', { viewBox: '0 0 200 200', class: 'gnring', 'aria-hidden': 'true', focusable: 'false' });
  const track = svgEl('path', { d: arcD(94, A0, A0 + SPAN), class: 'gntrack' });
  const arc = svgEl('path', { d: arcD(94, A0, A0 + SPAN), class: 'gnarc', pathLength: 100, 'stroke-dasharray': '0 100' });
  const dot = svgEl('circle', { r: 3.4, class: 'gndot' });
  ring.append(track, arc, dot);
  const host = h('div.gnhost', { role: 'button', tabindex: '0', 'aria-label': 'Talk to me', dataset: { case: 'keep' } });
  const hero = h('div.gnhero', h('div.gnplace', ring, host));
  const free = h('p.gnfree', { dataset: { case: 'keep' } });
  const hour = h('section.gnhour', { 'aria-label': 'The one thing' });
  const chips = h('div.gnchips', { role: 'group', 'aria-label': 'At hand: your recent things, then your favourites', dataset: { case: 'keep' } });
  const el = h('div.gnframe', mast, say, say2, hero, free, hour, chips);

  const talk = () => {
    currentMind()?.poke();
    document.querySelector<HTMLButtonElement>('#cbar #mic')?.click();
  };
  host.addEventListener('click', talk);
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    talk();
  });
  // the second line, once it holds a reply, is the way into the conversation
  say2.addEventListener('click', () => el.dataset.reply === 'true' && openChat());

  // the parts of today's Home this page takes (and gives back when the look is another)
  const taken: { el: HTMLElement; into: HTMLElement; parent: HTMLElement | null; next: Node | null }[] = [
    { el: o.stamp, into: mast, parent: null, next: null },
    { el: o.orbWrap, into: host, parent: null, next: null },
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

  // ---------------------------------------------------------------- the ring and its line
  const paintRing = () => {
    const w = freeWords();
    grownHomeState.ring = w;
    const f = w.frac == null ? 0 : Math.max(0, Math.min(1, w.frac));
    arc.setAttribute('stroke-dasharray', `${(f * 100).toFixed(2)} 100`);
    arc.style.opacity = f > 0.003 ? '' : '0';
    track.style.opacity = w.frac == null ? '.4' : '';
    const [x, y] = P(94, A0 + SPAN * f);
    dot.setAttribute('cx', x.toFixed(1));
    dot.setAttribute('cy', y.toFixed(1));
    dot.style.opacity = f > 0.003 ? '' : '0';
    hero.dataset.tone = freeAnswers.f?.tone ?? 'idle';
    if (free.textContent !== w.says) free.textContent = w.says;
  };

  // ---------------------------------------------------------------- the hour's card (the same source as ONE INK's entry)
  const tonight = (): Entry & { kicker: string; pct: number | null; meta: string } => {
    const e = tonightEntry(o.nextUp);
    const book = e.kind === 'book' ? bookNow() : null;
    return {
      ...e,
      kicker: e.kind === 'book' ? 'Carry on reading' : e.kind === 'agenda' ? `${hourWord(new Date(now()))} · next on your agenda` : e.kind === 'todo' ? `${hourWord(new Date(now()))} · on your to-do list` : 'The Brief',
      pct: book ? Math.max(0, Math.min(1, book.pct)) : null,
      // (the card's own line, as the mock says it: where he is in the book and when he was last there)
      meta: book ? [book.page ? `Page ${book.page}` : '', `${Math.round(book.pct * 100)}% read`, `you were here ${whenWord(book.at)}`].filter(Boolean).join(' · ') : e.line,
    };
  };
  let hourKey = '';
  const paintHour = () => {
    const e = tonight();
    const sig = `${e.kind}|${e.name}|${e.meta}|${e.kicker}`;
    grownHomeState.tonight = { kind: e.kind, kicker: e.kicker };
    if (sig === hourKey) return;
    hourKey = sig;
    const main = h('button.gnhourmain', { type: 'button', 'aria-label': `${e.fill.label}: ${e.name}`, dataset: { case: 'keep', act: 'fill' } },
      h('span.gnglyph', icon(GLYPH[e.kind] ?? BOOK)),
      h('span.gnhourtext',
        h('span.gnkick', e.kicker),
        h('b.gnname', e.name),
        e.pct != null ? h('i.gnprog', { role: 'progressbar', 'aria-label': 'How far you are', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(e.pct * 100)) }, h('i', { style: `width:${(e.pct * 100).toFixed(1)}%` })) : null,
        h('span.gnmeta', e.meta)));
    main.addEventListener('click', e.fill.run);
    const go2 = h('button.gnhourgo', { type: 'button', 'aria-label': e.ghost.label, title: e.ghost.label, dataset: { case: 'keep', act: 'ghost' } }, e.ghost.glyph ? icon(e.ghost.glyph) : h('span', e.ghost.word));
    go2.addEventListener('click', e.ghost.run);
    clear(hour, main, go2);
    hour.dataset.kind = e.kind;
  };

  // ---------------------------------------------------------------- the row: recents, then favourites, then three dots
  const chip = (t: { id: string; cardTo?: string; title: string }, kind: 'recent' | 'favourite') => {
    const name = toolName(t as never);
    const line = thingLine(t.id);
    const b = h('button.gnchip', { type: 'button', dataset: { id: t.id, kind, case: 'keep' }, 'aria-label': `${name}${kind === 'favourite' ? ', starred' : ', recent'}${line ? `: ${line}` : ''}`, title: line || name },
      icon(kind === 'favourite' ? STAR : CLOCK, 'ic gnmark'), h('span', name));
    b.addEventListener('click', () => navTo(t.cardTo ?? t.id, 'push'));
    // a long press pins or unpins it, as the deck does (a tap is the tap; the lift that ends the press opens nothing)
    pinOnHold(b, t.id);
    return b;
  };
  let chipKey = '';
  const paintChips = () => {
    const { pinned, lately } = pinnedAndRecent();
    const all = [...lately.map((t) => ({ t, kind: 'recent' as const })), ...pinned.map((t) => ({ t, kind: 'favourite' as const }))];
    // (the mock's mix: the newest recent first, then his favourites, three in all; with no favourites the recents fill the row)
    const favs = all.filter((x) => x.kind === 'favourite').slice(0, CHIPS_MAX - 1);
    const shown = [...all.filter((x) => x.kind === 'recent').slice(0, CHIPS_MAX - favs.length), ...favs];
    grownHomeState.chips = all.map((x) => ({ id: x.t.id, kind: x.kind }));
    const sig = shown.map((x) => `${x.t.id}:${x.kind}`).join('|') + `|${all.length}`;
    if (sig === chipKey) return;
    chipKey = sig;
    chips.dataset.count = String(all.length);
    const dots = h('button.gnmore', { type: 'button', 'aria-label': 'Everything else: every screen, by room', title: 'Everything else' }, icon(MORE));
    dots.addEventListener('click', () => housePlan()?.open());
    clear(chips, ...(shown.length ? shown.map((x) => chip(x.t, x.kind)) : [h('p.gnnone', { dataset: { case: 'keep' } }, 'Nothing opened yet. The last things you open wait here; hold one to star it.')]), dots);
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
    grownHomeState.line = text;
  };
  const paintWords = () => {
    const d = new Date(now());
    const g = `${greeting(d)}.`;
    if (say.textContent !== g) say.textContent = g;
    sentence = sayTwo(decide(now()), d.getHours());
    paintLine();
    paintRing();
    paintHour();
    paintChips();
  };
  new MutationObserver(() => grownHomeState.on && paintLine()).observe(o.caption, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('ghosty:freeai', () => grownHomeState.on && paintRing());

  let minute = 0;
  let wanted = false;
  const api: GrownHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      grownHomeState.on = true;
      document.body.classList.add('grownhome');
      take();
      paintWords();
      // the orb is drawn in his colour with its glow: the Mind reads its light again now that the page is on
      currentMind()?.recolour();
      // (the first reading of the free answers may not be in yet: the ring says so until it is)
      clearInterval(minute);
      minute = window.setInterval(paintWords, 30_000);
    },
    leave() {
      wanted = false;
      if (!grownHomeState.on) return;
      grownHomeState.on = false;
      document.body.classList.remove('grownhome');
      giveBack();
      clearInterval(minute);
      currentMind()?.recolour();
    },
    refresh() {
      if (grownHomeState.on) paintWords();
    },
  };
  addEventListener('resize', () => {
    if (wanted && phone() && !grownHomeState.on) api.enter();
    else if (grownHomeState.on && !phone()) {
      api.leave();
      wanted = true;
    }
  });
  // his pins and his name change the page where it stands
  settings.subscribe((s, p) => grownHomeState.on && (s.favourites !== p.favourites || s.name !== p.name) && api.refresh());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.grownHome = grownHomeState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return api;
}
