/**
 * THE MAP'S HOME (BRIEF-MAP-EYE-HUDS 2; the design is round one's W2: docs/build-plan/mockups/directions-2/w2/home-440.png).
 * The Machine's own map of what it watches: a plotting grid in perspective as the ground (drawn by styles.css from the world's floor
 * tokens, no per-frame code), the rooms as districts on it (dashed borders, their name and `N SCREENS`, a pin for each thing in
 * them), and round the orb THE SQUARE OF NINE: tonight's thing in the accent box, then his recents, then his favourites, each cell its
 * name and its one true reading (shell/inventory.ts thingLine), a free square saying nothing yet. The stamp line is the shell's, my
 * words come from the sources the other Homes read (shell/areas.ts greeting, scan/home.ts sayTwo, ink/home.ts tonightEntry), the ask
 * line is the jump bar (`Type a word, and I'll fly there`) with the mic. The scale along the bottom is the shared house drawn as a
 * ruler (shell/house.ts scaleOn; styles.css). It takes the stamp line and the orb's wrap from Core as they are and gives them back
 * when the look is another. Drawn only on a phone; Glass's, The Scan's and ONE INK's Homes are not touched.
 */
import { h, icon } from '../../../core/dom';
import { greeting, navTo, pinnedAndRecent, toolName } from '../../../shell/areas';
import { pinOnHold } from '../../../shell/favourites';
import { openChat } from '../../../shell/launcher';
import { ROOMS } from '../../../shell/rooms';
import { thingLine } from '../../../shell/inventory';
import { togglePalette } from '../../../commands/registry';
import { settings } from '../../../state/app';
import { currentMind } from '../mind';
import { decide } from '../scan/place';
import { sayTwo } from '../scan/home';
import { hourWord, tonightEntry } from '../ink/home';
import { freeSquare, mapFreeRoles } from '../todaywords';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;

/** What Home is doing, for the checks and the console (window.__ghosty.map). */
export const mapState = {
  on: false,
  /** The thing of the hour: its kind, its name, its one line and the word on its tag. */
  tonight: { kind: '', name: '', line: '', tag: '' },
  /** The second line under the greeting, as it is said now. */
  line: '',
  /** The districts as drawn: the room and the count. */
  districts: [] as { room: string; count: number }[],
  /** The square of nine's cells in the order drawn: 'tonight', 'recent', 'favourite' or 'free', with the id of what is in them. */
  cells: [] as { kind: string; id: string }[],
  clock: null as null | (() => number),
};
const now = () => mapState.clock?.() ?? Date.now();

export interface MapHome {
  el: HTMLElement;
  enter(): void;
  leave(): void;
  refresh(): void;
}

/** Where the cells sit round the orb (the middle of the three-by-three), in the order they fill: tonight above it, then the recents at the corners, then the favourites at its sides and foot. */
const AREAS = ['a', 'c', 'i', 'd', 'e', 'f', 'g'] as const;

export function mapHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; mic: () => void; nextUp: () => string; onBack: () => void }): MapHome {
  const mast = h('header.mapmast', { dataset: { case: 'keep' } });
  const say = h('p.mapsay', { dataset: { case: 'keep' } });
  const say2 = h('p.mapsay2', { dataset: { case: 'keep' } });
  const districts = h('div.mapdistricts', { role: 'navigation', 'aria-label': 'The districts' });
  const orbHost = h('div.maporbhost');
  const orb = h('div.maporb', orbHost);
  const nine = h('section.mapnine', { 'aria-label': 'At hand' }, orb);
  const handTag = h('p.maphand.g-truth', { dataset: { case: 'keep' } }, 'At hand');
  const field = h('button.mapfield', { type: 'button', 'aria-label': 'Type a word, and I’ll fly there', dataset: { case: 'keep' } }, 'Type a word, and I’ll fly there');
  const speak = h('button.mapspeak', { type: 'button', 'aria-label': 'Talk to me' }, icon(MIC));
  const ask = h('div.mapask', field, speak);
  const plane = h('div.mapplane', { 'aria-hidden': 'true' }, h('i.mapgrid'));
  const el = h('div.maphudframe', plane, mast, say, say2, districts, handTag, nine, ask);

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

  // ---------------------------------------------------------------- the districts: every room but Home, as the Machine's map of them
  let districtKey = '';
  const paintDistricts = () => {
    const rooms = ROOMS.filter((r) => r.key !== 'home');
    const sig = rooms.map((r) => `${r.key}${r.things.length}`).join();
    if (sig === districtKey) return;
    districtKey = sig;
    mapState.districts = rooms.map((r) => ({ room: r.key, count: r.things.length }));
    districts.replaceChildren(
      ...rooms.map((r) => {
        const name = r.title;
        const b = h('button.mapdistrict', { type: 'button', dataset: { room: r.key, case: 'keep' }, 'aria-label': `${name.charAt(0)}${name.slice(1).toLowerCase()}: ${r.things.length} screens. Open the room` },
          h('span.mdname', { dataset: { case: 'keep' } }, name),
          h('span.mdcount.g-truth', { dataset: { case: 'keep' } }, `${r.things.length} screens`),
          h('span.mdpins', { 'aria-hidden': 'true' }, ...r.things.map(() => h('i'))));
        b.addEventListener('click', () => navTo(r.screen, 'switch'));
        return b;
      }));
  };

  // ---------------------------------------------------------------- the square of nine (tonight, his recents, his favourites)
  let nineKey = '';
  const paintNine = () => {
    const e = tonightEntry(o.nextUp);
    const word = hourWord();
    const { pinned, lately } = pinnedAndRecent();
    mapState.tonight = { kind: e.kind, name: e.name, line: e.line, tag: word };
    const recents = lately.slice(0, 3);
    const favs = pinned.slice(0, 4);
    const lines = (id: string) => {
      try {
        return thingLine(id);
      } catch {
        return '';
      }
    };
    const sig = `${e.kind}|${e.name}|${e.line}|${word}|${recents.map((t) => t.id).join()}|${favs.map((t) => t.id).join()}|${recents.concat(favs).map((t) => lines(t.id)).join('|')}`;
    if (sig === nineKey) return;
    nineKey = sig;
    const cells: { kind: string; id: string }[] = [];
    const tb = h('button.mapcell.lit', { type: 'button', dataset: { slot: 't', kind: 'tonight', what: e.kind, case: 'keep' }, 'aria-label': `${word}: ${e.name}. ${e.fill.label}` },
      h('span.g-truth.mctag', { dataset: { case: 'keep' } }, word),
      h('span.mcname', { dataset: { case: 'keep' } }, e.name),
      h('span.mcline.g-truth', { dataset: { case: 'keep' } }, e.line));
    tb.addEventListener('click', () => e.fill.run());
    cells.push({ kind: 'tonight', id: e.kind });
    const items = [...recents.map((t) => ({ t, kind: 'recent' })), ...favs.map((t) => ({ t, kind: 'favourite' }))];
    const out: HTMLElement[] = [tb];
    AREAS.forEach((area, i) => {
      const it = items[i];
      if (!it) {
        // [planlane:home] /* state: core.home empty */ a free square says what fills it (once), not "nothing yet" in each
        const role = mapFreeRoles(recents.length, favs.length)[cells.filter((c) => c.kind === 'free').length] ?? 'none';
        const say = freeSquare(role, true);
        cells.push({ kind: 'free', id: '' });
        out.push(h('div.mapcell.free', { dataset: { slot: area, kind: 'free', role, case: 'keep' } }, h('span.g-truth.mctag', { dataset: { case: 'keep' } }, 'Free'), say ? h('span.mcline.g-truth', { dataset: { case: 'keep' } }, say) : null));
        return;
      }
      const { t, kind } = it;
      cells.push({ kind, id: t.id });
      const name = toolName(t);
      const b = h('button.mapcell', { type: 'button', dataset: { slot: area, kind, id: t.id, case: 'keep' }, 'aria-label': `${name}, ${kind === 'recent' ? 'recent' : 'pinned'}` },
        h('span.g-truth.mctag', { dataset: { case: 'keep' } }, kind === 'recent' ? 'Recent' : 'Pinned'),
        h('span.mcname', { dataset: { case: 'keep' } }, name),
        h('span.mcline.g-truth', { dataset: { case: 'keep' } }, lines(t.id)));
      b.addEventListener('click', () => navTo(t.cardTo ?? t.id, 'push'));
      // a long press on a cell pins or unpins it, as the deck does (a tap is the tap)
      pinOnHold(b, t.id);
      out.push(b);
    });
    mapState.cells = cells;
    // (the orb stays where it is: only the cells round it are drawn again)
    for (const c of nine.querySelectorAll('.mapcell')) c.remove();
    nine.prepend(...out);
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
    mapState.line = text;
  };
  const paintWords = () => {
    const d = new Date(now());
    const g = `${greeting(d)}.`;
    if (say.textContent !== g) say.textContent = g;
    sentence = sayTwo(decide(now()), d.getHours());
    paintLine();
    paintDistricts();
    paintNine();
  };
  new MutationObserver(() => mapState.on && paintLine()).observe(o.caption, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  let minute = 0;
  let wanted = false;
  const api: MapHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      mapState.on = true;
      document.body.classList.add('maphome');
      take();
      paintWords();
      clearInterval(minute);
      minute = window.setInterval(paintWords, 30_000);
    },
    leave() {
      wanted = false;
      if (!mapState.on) return;
      mapState.on = false;
      document.body.classList.remove('maphome');
      giveBack();
      clearInterval(minute);
    },
    refresh() {
      if (mapState.on) paintWords();
    },
  };
  addEventListener('resize', () => {
    if (wanted && phone() && !mapState.on) api.enter();
    else if (mapState.on && !phone()) {
      api.leave();
      wanted = true;
    }
  });
  settings.subscribe((s, p) => mapState.on && (s.favourites !== p.favourites || s.name !== p.name) && api.refresh());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.map = mapState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return api;
}
