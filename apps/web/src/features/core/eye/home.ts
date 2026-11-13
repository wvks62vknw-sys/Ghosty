/**
 * THE EYE'S HOME (BRIEF-EYE-HUD 2; the design is round one's W3 and round three's wall: docs/build-plan/mockups/directions-2/w3/home-440.png,
 * docs/build-plan/mockups/hud/2026-11-08-3/wall.png). Attention is the material: Home is the wall of what the Machine watches, every feed in
 * grain but one. Tonight's thing is the one sharp feed in the accent box with the line of sight from the orb up to it; his recents sit
 * at the edge of its attention (clocked) and his favourites in bracket corners (starred), each a feed with its name and its one true
 * reading (shell/inventory.ts thingLine); the rooms are feeds with `N screens`. The stamp line is the shell's, my words come from the
 * sources the other Homes read (shell/areas.ts greeting, scan/home.ts sayTwo, ink/home.ts tonightEntry: the book, else the agenda's
 * next, else the Brief), the ask line is the jump bar with the mic. God's Eye's globe turns under it in grain (eye/ground.ts), and
 * the instruments along the bottom are the shared house (shell/house.ts eyeOn; styles.css). It takes the stamp line and the orb's wrap
 * from Core as they are and gives them back when the look is another. Drawn only on a phone; the other Homes are not touched, and
 * nothing here is a `<nav>` (the dock is the first one on the page).
 */
import { h, icon } from '../../../core/dom';
import { greeting, navTo, pinnedAndRecent, toolName } from '../../../shell/areas';
import { pinOnHold } from '../../../shell/favourites';
import { openThing } from '../../../shell/house';
import { openChat } from '../../../shell/launcher';
import { ROOMS, THINGS } from '../../../shell/rooms';
import { togglePalette } from '../../../commands/registry';
import { settings } from '../../../state/app';
import { currentMind } from '../mind';
import { decide } from '../scan/place';
import { sayTwo } from '../scan/home';
import { hourWord, tonightEntry } from '../ink/home';
import { openAbilities } from './abilities';
import { drawGrain, inkOf } from './grain';
import { startGround, stopGround } from './ground';
import { readingOf } from './reading';
import { ABILITIES_LINE, LIGHTING } from './words';
import { freeSquare } from '../todaywords';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;

/** What Home is doing, for the checks and the console (window.__ghosty.eyehome). */
export const eyeState = {
  on: false,
  /** When Home was last put on screen (the globe starts well after it). */
  shownAt: 0,
  /** The thing of the hour: its kind, its name, its one line and the word on its tag. */
  tonight: { kind: '', name: '', line: '', tag: '' },
  /** The second line under the greeting, as it is said now. */
  line: '',
  /** The rooms as feeds: the room and the count. */
  rooms: [] as { room: string; count: number }[],
  /** The side feeds in the order drawn: 'recent', 'favourite' or 'free', with the id of what is in them. */
  cells: [] as { kind: string; id: string }[],
  /** How many feeds are in grain and how many are sharp (exactly one). */
  grain: 0,
  sharp: 0,
  clock: null as null | (() => number),
};
const now = () => eyeState.clock?.() ?? Date.now();

export interface EyeHome {
  el: HTMLElement;
  enter(): void;
  leave(): void;
  refresh(): void;
}

/** Where the side feeds sit round the focus: a recent at the head of each side, then the favourites, alternating sides. */
const SLOTS = ['a', 'd', 'b', 'e', 'c', 'f'] as const;

export function eyeHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; mic: () => void; nextUp: () => string; onBack: () => void }): EyeHome {
  const mast = h('header.eyemast', { dataset: { case: 'keep' } });
  // the stamp's own small line while the ground starts (eye/ground.ts shows it only where the start is slow: a software GL)
  const light = h('p.eyelight.g-truth', { hidden: true, role: 'status', dataset: { case: 'keep' } }, LIGHTING);
  mast.append(light);
  const say = h('p.eyesay', { dataset: { case: 'keep' } });
  const say2 = h('p.eyesay2', { dataset: { case: 'keep' } });
  const orbHost = h('div.eyeorbhost');
  const orb = h('div.eyeorb', h('i.eyesight', { 'aria-hidden': 'true' }), orbHost);
  const wall = h('section.eyewall', { 'aria-label': 'The wall', dataset: { case: 'keep' } }, orb);
  const focusWord = h('b', 'Tonight');
  const edgeWord = h('b', 'Starred');
  const edgeLead = h('span', ' · At the edge: ');
  const legend = h('p.eyelegend.g-truth', { dataset: { case: 'keep' } }, 'In focus: ', focusWord, edgeLead, edgeWord);
  const field = h('button.eyefield', { type: 'button', 'aria-label': 'Ask, or say what to look at', dataset: { case: 'keep' } }, 'Ask, or say what to look at');
  const speak = h('button.eyespeak', { type: 'button', 'aria-label': 'Talk to me' }, icon(MIC));
  const ask = h('div.eyeask', field, speak);
  const veil = h('div.eyeveil', { 'aria-hidden': 'true' });
  const el = h('div.eyeframe', veil, mast, say, say2, wall, legend, ask);

  field.addEventListener('click', () => togglePalette());
  speak.addEventListener('click', () => o.mic());
  say2.addEventListener('click', () => el.dataset.reply === 'true' && openChat());
  orbHost.addEventListener('click', () => {
    currentMind()?.poke();
    o.onBack();
  });
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

  // ---------------------------------------------------------------- the grain: each feed's picture is drawn once it is laid out
  let ink = '';
  let drawing = 0;
  const grain = () => {
    cancelAnimationFrame(drawing);
    drawing = requestAnimationFrame(() => {
      if (!eyeState.on) return;
      ink = inkOf();
      for (const cv of wall.querySelectorAll<HTMLCanvasElement>('canvas.eyepic')) drawGrain(cv, cv.dataset.feed ?? '', ink);
    });
  };
  const pic = (id: string) => h('canvas.eyepic', { 'aria-hidden': 'true', dataset: { feed: id } });
  const tag = (glyph: string | null, words: string) => h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, ...(glyph ? [icon(glyph, 'ic eyeic')] : []), h('span', words));

  // ---------------------------------------------------------------- the rooms as feeds (SEE, MAKE, LEARN, PLAN across the top; LIFE, ME and every screen across the foot)
  const roomFeeds = new Map<string, HTMLElement>();
  let roomKey = '';
  const paintRooms = () => {
    const rooms = ROOMS.filter((r) => r.key !== 'home');
    const sig = rooms.map((r) => `${r.key}${r.things.length}`).join();
    if (sig === roomKey) return;
    roomKey = sig;
    eyeState.rooms = rooms.map((r) => ({ room: r.key, count: r.things.length }));
    for (const f of roomFeeds.values()) f.remove();
    roomFeeds.clear();
    const order = ['see', 'make', 'learn', 'plan', 'life', 'me'];
    for (const r of rooms) {
      const slot = `r-${r.key}`;
      const name = r.title;
      const b = h('button.eyefeed.room', { type: 'button', dataset: { room: r.key, slot, kind: 'room', case: 'keep' }, 'aria-label': `${name.charAt(0)}${name.slice(1).toLowerCase()}: ${r.things.length} screens. Open the room` },
        pic(r.key), tag(null, name), h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, `${r.things.length} screens`));
      b.style.setProperty('--slot', String(order.indexOf(r.key)));
      b.addEventListener('click', () => navTo(r.screen, 'switch'));
      roomFeeds.set(r.key, b);
      wall.append(b);
    }
    const all = h('button.eyefeed.room.every', { type: 'button', dataset: { room: 'screens', slot: 'r-screens', kind: 'room', case: 'keep' }, 'aria-label': `Every screen: all ${THINGS.length}. Open the list` },
      pic('screens'), tag(null, 'Screens'), h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, `All ${THINGS.length}`));
    all.addEventListener('click', () => openThing({ id: 'deck', name: 'Every screen', screen: null, n: 0 }));
    roomFeeds.set('screens', all);
    wall.append(all);
    // ABILITIES: what I can do, as a wall of its own (eye/abilities.ts); one small feed beside Every screen
    const abil = h('button.eyefeed.abil', { type: 'button', dataset: { slot: 'x', kind: 'abilities', case: 'keep' }, 'aria-label': 'Abilities: what I can do. Open the wall' },
      pic('abilities'), tag(null, 'Abilities'), h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, ABILITIES_LINE));
    abil.addEventListener('click', () => void openAbilities('home'));
    roomFeeds.set('abilities', abil);
    wall.append(abil);
    grain();
  };

  // ---------------------------------------------------------------- the focus (tonight, the one sharp feed) and the feeds at its edge (recents, favourites)
  let sideKey = '';
  let sideEls: HTMLElement[] = [];
  const paintSide = () => {
    const e = tonightEntry(o.nextUp);
    const word = hourWord();
    const { pinned, lately } = pinnedAndRecent();
    eyeState.tonight = { kind: e.kind, name: e.name, line: e.line, tag: word };
    // (the legend says what is true: the hour's own word, and whether anything is starred yet)
    const edge = pinned.length ? 'Starred' : 'Hold a feed to pin it';
    if (focusWord.textContent !== word) focusWord.textContent = word;
    if (edgeWord.textContent !== edge) edgeWord.textContent = edge;
    edgeLead.textContent = pinned.length ? ' · At the edge: ' : ' · ';
    const recents = lately.slice(0, 2);
    const favs = pinned.slice(0, 4);
    // (a feed's reading: the card's own; offline, a feed that needs the signal says its last reading and its age: eye/reading.ts)
    const lines = (id: string) => readingOf(id);
    const sig = `${e.kind}|${e.name}|${e.line}|${word}|${recents.map((t) => t.id).join()}|${favs.map((t) => t.id).join()}|${recents.concat(favs).map((t) => lines(t.id)).join('|')}`;
    if (sig === sideKey) return;
    sideKey = sig;
    for (const n of sideEls) n.remove();
    const cells: { kind: string; id: string }[] = [];
    const tb = h('button.eyefeed.sharp', { type: 'button', dataset: { slot: 't', kind: 'tonight', what: e.kind, case: 'keep' }, 'aria-label': `${word}: ${e.name}. ${e.fill.label}` },
      h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, icon(CLOCK, 'ic eyeic'), h('span', word)),
      h('span.eyename', { dataset: { case: 'keep' } }, e.name),
      h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, e.line));
    tb.addEventListener('click', () => e.fill.run());
    cells.push({ kind: 'tonight', id: e.kind });
    // (recents first, at the head of each side; favourites after, in the order SLOTS gives)
    const placed: ({ t: (typeof recents)[number]; kind: string } | null)[] = SLOTS.map(() => null);
    recents.forEach((t, i) => (placed[i] = { t, kind: 'recent' }));
    favs.forEach((t, i) => (placed[2 + i] = { t, kind: 'favourite' }));
    const out: HTMLElement[] = [tb];
    SLOTS.forEach((slot, i) => {
      const it = placed[i];
      if (!it) {
        // [planlane:home] /* state: core.home empty */ a free feed says what fills it (once), not "nothing yet" in each
        // (slots 0-1 are the recents', 2 and up the pins': the words say what will really fill this one)
        const role = i < 2 ? 'recent' : 'pin';
        const say = freeSquare(role, !placed.some((q, j) => !q && j < i && j < 2 === i < 2));
        cells.push({ kind: 'free', id: '' });
        out.push(h('div.eyefeed.free', { dataset: { slot, kind: 'free', role, case: 'keep' } }, h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, h('span', 'Free')), say ? h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, say) : null));
        return;
      }
      const { t, kind } = it;
      cells.push({ kind, id: t.id });
      const name = toolName(t);
      const b = h('button.eyefeed', { type: 'button', dataset: { slot, kind, id: t.id, case: 'keep' }, 'aria-label': `${name}, ${kind === 'recent' ? 'recent' : 'pinned'}` },
        pic(t.id), tag(kind === 'recent' ? CLOCK : STAR, name), h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, lines(t.id)));
      b.addEventListener('click', () => navTo(t.cardTo ?? t.id, 'push'));
      // a long press on a feed pins or unpins it, as the deck does (a tap is the tap)
      pinOnHold(b, t.id);
      out.push(b);
    });
    eyeState.cells = cells;
    sideEls = out;
    wall.prepend(...out);
    grain();
  };

  // ---------------------------------------------------------------- the words
  let sentence = '';
  const paintLine = () => {
    const live = (o.caption.firstElementChild?.textContent ?? '').trim();
    const reply = !!live && !o.caption.classList.contains('fade');
    const text = reply ? live : sentence;
    if (say2.textContent !== text) say2.textContent = text;
    el.dataset.reply = String(reply);
    if (reply) say2.setAttribute('role', 'button');
    else say2.removeAttribute('role');
    eyeState.line = text;
  };
  const count = () => {
    eyeState.sharp = wall.querySelectorAll('.eyefeed.sharp').length;
    eyeState.grain = wall.querySelectorAll('.eyefeed:not(.sharp)').length;
  };
  const paintWords = () => {
    const d = new Date(now());
    const g = `${greeting(d)}.`;
    if (say.textContent !== g) say.textContent = g;
    sentence = sayTwo(decide(now()), d.getHours());
    paintLine();
    paintRooms();
    paintSide();
    count();
  };
  new MutationObserver(() => eyeState.on && paintLine()).observe(o.caption, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  let minute = 0;
  let wanted = false;
  const api: EyeHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      eyeState.on = true;
      eyeState.shownAt = Date.now();
      document.body.classList.add('eyehome');
      take();
      paintWords();
      grain();
      startGround(light);
      clearInterval(minute);
      minute = window.setInterval(paintWords, 30_000);
    },
    leave() {
      wanted = false;
      if (!eyeState.on) return;
      eyeState.on = false;
      document.body.classList.remove('eyehome');
      stopGround();
      giveBack();
      clearInterval(minute);
    },
    refresh() {
      if (eyeState.on) paintWords();
    },
  };
  // (offline and back: a feed that needs the signal changes its line at once)
  for (const ev of ['offline', 'online']) addEventListener(ev, () => eyeState.on && api.refresh());
  addEventListener('resize', () => {
    if (wanted && phone() && !eyeState.on) api.enter();
    else if (eyeState.on && !phone()) {
      api.leave();
      wanted = true;
    } else if (eyeState.on) grain();
  });
  settings.subscribe((s, p) => eyeState.on && (s.favourites !== p.favourites || s.name !== p.name) && api.refresh());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.eyehome = eyeState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return api;
}
