/**
 * ORBIT'S HOME: THE ORBIT (BRIEF-ORBIT-HUD 2; the design fixed by docs/build-plan/mockups/directions/d1/home-440.png). The orb at the centre of
 * its own sky: the stamp line at the top (the shell's one source), `Good evening, Boss.` and my one sentence under it (a reply's words
 * replace the sentence, as in ONE INK), the SIX STATIONS (See, Make, Learn, Plan, Life, Me) on a ring round the orb, each a 44 pt disc with
 * its word, the one that matters tonight lit in his colour (the room of tonight's thing: ink/home.ts `tonightKind`, the one source); under
 * it THE CAPSULE (his recents, then his favourites, each its name and one true reading from the inventory; a tap opens, a long press pins or
 * unpins as the deck does) and THE HINT LINE (`Press me to ask, or to find anything.`, until the orb has been pressed ten times, counted on
 * this phone). The hour's card closes the page (`Carry on reading`, the book and where he is in it). A press on the orb opens the typed word
 * (the jump bar); a tap on a station opens that room's hub. The four gauges, the tab bar and the separate ask bar are not drawn here.
 *
 * The real orb is Mind's: Home's hero wrap is taken into the sky as it is, and given back when the look is another. Nothing is invented:
 * a reading the phone does not have is left out, the capsule says what to do when it is empty. Drawn only on a phone; Glass's Home, THE
 * SCAN's and ONE INK's are not touched.
 */
import { clear, h, icon } from '../../../core/dom';
import { greeting, navTo, pinnedAndRecent, toolName } from '../../../shell/areas';
import { revealSection } from '../../../ui/sections';
import { pinOnHold } from '../../../shell/favourites';
import { openChat } from '../../../shell/launcher';
import { thingLine } from '../../../shell/inventory';
import { roomOf } from '../../../shell/rooms';
import { hintOn, ORBIT_ROOMS, pressOrb, roomHub } from '../../../shell/orbit';
import { togglePalette } from '../../../commands/registry';
import { settings } from '../../../state/app';
import { currentMind } from '../mind';
import { decide } from '../scan/place';
import { bookName, bookNow, sayTwo, whenWord } from '../scan/home';
import { hourWord, todoEntry, tonightKind, type Entry } from '../ink/home';

const LISTEN = '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10"/>';
const MORE = '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;
/** The capsule holds this many things before its three dots (the typed word has the rest). */
export const CAPSULE_MAX = 3;

/** What Home is doing, for the checks and the console (window.__ghosty.orbitHome). */
export const orbitHomeState = {
  on: false,
  /** The one sentence under the greeting, as it is said now. */
  line: '',
  /** The six stations in order, and the one lit. */
  stations: [] as string[],
  lit: '',
  /** The capsule, in order: recents then favourites. */
  capsule: [] as { id: string; kind: 'recent' | 'favourite' }[],
  /** The hint line is showing. */
  hint: true,
  /** The hour's card: its kind and kicker. */
  tonight: { kind: '', kicker: '' },
  /** A check's clock for the hour's words (ms since the epoch), else the phone's. */
  clock: null as null | (() => number),
};
const now = () => orbitHomeState.clock?.() ?? Date.now();

export interface OrbitHome {
  el: HTMLElement;
  /** Home came on screen: take the parts, draw the sky. */
  enter(): void;
  leave(): void;
  /** Something Home reads changed (the next event arrived): the words are written again. */
  refresh(): void;
}

/** Where a station stands on the ring: its angle in degrees (0 to the right, clockwise), as the mock places them: See upper right, round to Me upper left. */
export const STATION_ANGLE: Record<string, number> = { see: -60, make: 0, learn: 60, plan: 120, life: 180, me: -120 };

/** The room that matters tonight, by the kind of tonight's thing (the book is in LEARN; the agenda and the Brief are the day: PLAN). */
export const roomTonight = (kind: 'book' | 'agenda' | 'todo' | 'brief'): string => (kind === 'book' ? roomOf('library')?.area : roomOf('agenda')?.area) ?? 'plan';

/**
 * Build Home (once, at Core's mount). `orbWrap`: the hero's wrap holding the 2-D reactor canvas the orb is drawn over (Mind's anchor);
 * `stamp`: Home's stamp line; `caption`: the latest reply's line (read, not moved); `nextUp`: Core's next event.
 */
export function orbitHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; nextUp: () => string; onBack: () => void }): OrbitHome {
  const mast = h('header.orbmast', { dataset: { case: 'keep' } });
  const say = h('h1.orbsay', { dataset: { case: 'keep' } });
  const say2 = h('p.orbsay2', { dataset: { case: 'keep' } });
  // the sky: the ring (drawn in SVG, drifting a little), the orb at its centre, the six stations on it
  const ring = h('div.orbplace');
  ring.innerHTML = '<svg class="orbrings" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><circle class="orbtrack" r="82"/><circle class="orbticks" r="82"/><circle class="orbinner" r="60"/></svg>';
  const host = h('div.orbhost', { role: 'button', tabindex: '0', 'aria-label': 'Type a word', dataset: { case: 'keep' } }, h('i.orbpress', { 'aria-hidden': 'true' }));
  const stations = ORBIT_ROOMS.map((a) => {
    const ang = ((STATION_ANGLE[a.id] ?? 0) * Math.PI) / 180;
    const b = h('button.orbst', { type: 'button', dataset: { room: a.id, case: 'keep' }, 'aria-label': `${a.title}: ${a.sub}` }, h('span.orbdisc', icon(a.icon)), h('span.orbnm', a.title));
    // (two variables: where it stands on the ring, as the cosine and sine of its angle; styles.css reads them against the ring's own size)
    b.style.setProperty('--ox', Math.cos(ang).toFixed(4));
    b.style.setProperty('--oy', Math.sin(ang).toFixed(4));
    b.addEventListener('click', () => navTo(roomHub(a), 'push'));
    return { a, b };
  });
  ring.append(host, ...stations.map((s) => s.b));
  const sky = h('div.orbsky', ring);
  const hint = h('p.orbhint', { dataset: { case: 'keep' } }, 'Press me to ask, or to find anything.');
  const capsule = h('div.orbcap', { role: 'group', 'aria-label': 'At hand: your recent things, then your favourites', dataset: { case: 'keep' } });
  const hour = h('section.orbhour', { 'aria-label': 'The one thing' });
  const el = h('div.orbframe', mast, say, say2, sky, hint, capsule, hour);

  const press = () => {
    currentMind()?.poke();
    pressOrb();
  };
  host.addEventListener('click', press);
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    press();
  });
  // the italic line, once it holds a reply, is the way into the conversation
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

  // ---------------------------------------------------------------- the stations: the one that matters tonight is lit
  const paintStations = (kind: 'book' | 'agenda' | 'todo' | 'brief') => {
    const lit = roomTonight(kind);
    orbitHomeState.lit = lit;
    orbitHomeState.stations = stations.map((s) => s.a.id);
    for (const s of stations) {
      const on = s.a.id === lit;
      s.b.classList.toggle('hot', on);
      if (on) s.b.setAttribute('aria-current', 'true');
      else s.b.removeAttribute('aria-current');
    }
  };

  // ---------------------------------------------------------------- the hour's card (the same source as ONE INK's entry)
  const tonight = (): Entry & { kicker: string } => {
    const kind = tonightKind(o.nextUp());
    if (kind === 'book') {
      const book = bookNow()!;
      return {
        kind,
        kicker: 'Carry on reading',
        name: bookName(book.doc),
        line: [book.page ? `Page ${book.page}` : '', `${Math.round(book.pct * 100)} % read`, `you were here ${whenWord(book.at)}`].filter(Boolean).join(' · '),
        right: 'Reading',
        fill: { word: 'Carry on reading', label: 'Carry on reading', run: () => void carryOn(book.doc, false) },
        ghost: { word: 'Listen', label: 'Listen: I read it to you from your place', run: () => void carryOn(book.doc, true), glyph: LISTEN },
      };
    }
    const next = o.nextUp();
    if (kind === 'agenda') {
      const at = next.lastIndexOf(' · ');
      return {
        kind,
        kicker: `${hourWord(new Date(now()))} · next on your agenda`,
        name: at > 0 ? next.slice(0, at) : next,
        line: at > 0 ? next.slice(at + 3) : 'On your agenda',
        right: 'Agenda',
        fill: { word: 'Open the agenda', label: 'Open the agenda', run: () => (navTo('agenda', 'push'), revealSection('agenda', 'DIARY')) },
        ghost: { word: 'Brief me', label: 'Brief me', run: () => navTo('brief', 'push') },
      };
    }
    // [planlane:home] the to-dos due today, when there is no book and nothing next in the diary (ink/home.ts todoEntry, the one source)
    const todo = kind === 'todo' ? todoEntry() : null;
    if (todo) return { ...todo, kicker: `${hourWord(new Date(now()))} · on your to-do list` };
    return {
      kind: 'brief',
      kicker: 'The Brief',
      name: 'The Brief',
      line: 'Tap to read it',
      right: 'Brief',
      fill: { word: 'Read the brief', label: 'Read the brief', run: () => navTo('brief', 'push') },
      ghost: { word: 'Ask me', label: 'Ask me anything', run: () => togglePalette() },
    };
  };
  let hourKey = '';
  const paintHour = () => {
    const e = tonight();
    paintStations(e.kind);
    const sig = `${e.kind}|${e.name}|${e.line}|${e.kicker}`;
    orbitHomeState.tonight = { kind: e.kind, kicker: e.kicker };
    if (sig === hourKey) return;
    hourKey = sig;
    const main = h('button.orbhourmain', { type: 'button', 'aria-label': `${e.fill.label}: ${e.name}`, dataset: { case: 'keep', act: 'fill' } },
      h('span.orbkick', e.kicker),
      h('b.orbname', e.name),
      h('span.orbhourline', e.line));
    main.addEventListener('click', e.fill.run);
    const go2 = h('button.orbhourgo', { type: 'button', 'aria-label': e.ghost.label, title: e.ghost.label, dataset: { case: 'keep', act: 'ghost' } }, e.ghost.glyph ? icon(e.ghost.glyph) : h('span', e.ghost.word));
    go2.addEventListener('click', e.ghost.run);
    clear(hour, main, go2);
    hour.dataset.kind = e.kind;
  };

  // ---------------------------------------------------------------- the capsule: recents, then favourites, then three dots (the typed word has the rest)
  const thing = (t: { id: string; cardTo?: string; title: string }, kind: 'recent' | 'favourite') => {
    const name = toolName(t as never);
    const line = thingLine(t.id);
    const b = h('button.orbitem', { type: 'button', dataset: { id: t.id, kind, case: 'keep' }, 'aria-label': `${name}${kind === 'favourite' ? ', starred' : ', recent'}${line ? `: ${line}` : ''}`, title: line || name },
      h('span.orbitem-top', icon(kind === 'favourite' ? STAR : CLOCK, 'ic orbmark'), h('b', name)),
      line ? h('small', line) : null);
    b.addEventListener('click', () => navTo(t.cardTo ?? t.id, 'push'));
    // a long press pins or unpins it, as the deck does (a tap is the tap; the lift that ends the press opens nothing)
    pinOnHold(b, t.id);
    return b;
  };
  let capKey = '';
  const paintCapsule = () => {
    const { pinned, lately } = pinnedAndRecent();
    const all = [...lately.map((t) => ({ t, kind: 'recent' as const })), ...pinned.map((t) => ({ t, kind: 'favourite' as const }))];
    // (the mock's mix: the newest recent first, then his favourites, three in all; with no favourites the recents fill the capsule)
    const favs = all.filter((x) => x.kind === 'favourite').slice(0, CAPSULE_MAX - 1);
    const shown = [...all.filter((x) => x.kind === 'recent').slice(0, CAPSULE_MAX - favs.length), ...favs];
    orbitHomeState.capsule = all.map((x) => ({ id: x.t.id, kind: x.kind }));
    const sig = shown.map((x) => `${x.t.id}:${x.kind}:${thingLine(x.t.id)}`).join('|') + `|${all.length}`;
    if (sig === capKey) return;
    capKey = sig;
    capsule.dataset.count = String(all.length);
    if (!shown.length) {
      clear(capsule, h('p.orbnone', { dataset: { case: 'keep' } }, 'Nothing opened yet. The last things you open wait here; hold one to star it.'));
      return;
    }
    const dots = h('button.orbmore', { type: 'button', 'aria-label': 'Everything else: type a word', title: 'Everything else' }, icon(MORE));
    dots.addEventListener('click', press);
    clear(capsule, ...shown.map((x) => thing(x.t, x.kind)), dots);
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
    orbitHomeState.line = text;
  };
  const paintHint = () => {
    const on = hintOn();
    hint.hidden = !on;
    orbitHomeState.hint = on;
  };
  const paintWords = () => {
    const d = new Date(now());
    const g = `${greeting(d)}.`;
    if (say.textContent !== g) say.textContent = g;
    sentence = sayTwo(decide(now()), d.getHours());
    paintLine();
    paintHour();
    paintCapsule();
    paintHint();
  };
  new MutationObserver(() => orbitHomeState.on && paintLine()).observe(o.caption, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('ghosty:orbitpress', () => paintHint());

  let minute = 0;
  let wanted = false;
  const api: OrbitHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      orbitHomeState.on = true;
      document.body.classList.add('orbithome');
      take();
      paintWords();
      // the orb is drawn in his colour with its glow: the Mind reads its light again now that the page is on
      currentMind()?.recolour();
      clearInterval(minute);
      minute = window.setInterval(paintWords, 30_000);
    },
    leave() {
      wanted = false;
      if (!orbitHomeState.on) return;
      orbitHomeState.on = false;
      document.body.classList.remove('orbithome');
      giveBack();
      clearInterval(minute);
      currentMind()?.recolour();
    },
    refresh() {
      if (orbitHomeState.on) paintWords();
    },
  };
  addEventListener('resize', () => {
    if (wanted && phone() && !orbitHomeState.on) api.enter();
    else if (orbitHomeState.on && !phone()) {
      api.leave();
      wanted = true;
    }
  });
  // his pins and his name change the page where it stands
  settings.subscribe((s, p) => orbitHomeState.on && (s.favourites !== p.favourites || s.name !== p.name) && api.refresh());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.orbitHome = orbitHomeState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return api;
}

/** Open the book he is in at his place, or the Shelf where the reader has nothing to open yet; `aloud` starts it reading. */
async function carryOn(doc: string, aloud: boolean): Promise<void> {
  try {
    const r = await import('../../library/reader');
    const d = r.shelfDocs.get().docs.find((x) => x.id === doc);
    if (d) return void (await r.openBook(d, aloud ? { listen: {} } : {}));
  } catch {
    /* the shelf is the way in */
  }
  navTo('library?shelf', 'push');
}
