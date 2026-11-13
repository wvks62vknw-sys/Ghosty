/**
 * A ROOM IS THE WALL (BRIEF-EYE-HUD-2 item 1; docs/build-plan/mockups/directions-2/w3/hub-440.png and its README): in THE EYE each room's hub is drawn
 * as the wall, not as The Scan's dotted plates. The room's things are grain feeds (each card of shell/hubcards.ts a feed with its tag and its one true
 * reading, features/core/eye/reading.ts; the EDITORS card a feed whose seven pills are seven small feeds inside it); the thing he used last in the
 * room is the ONE sharp feed in the accent box (else the first he starred, else the room's first), standing just above the instruments with the
 * line of sight drawn from their lit key up to it; `LOOKING AT <ROOM> · N FEEDS` is the kick row; his favourites in the room carry bracket corners;
 * a tap on a feed opens the thing, a long press pins it (shell/favourites.ts); the room's own ABILITIES are one feed more (abilities.ts). Nothing is
 * invented: the readings are the cards' own and the grain is grain.ts's. The other worlds' hubs are not touched: shell/areas.ts picks this drawing
 * only while the world is the eye (shell/house.ts eyeOn). This file takes what it needs from the hub as options, so it imports no screen.
 */
import { h, icon } from '../../../core/dom';
import { settings } from '../../../state/app';
import { favourites, pinOnHold } from '../../../shell/favourites';
import { atHand, worksLine } from '../../../shell/inventory';
import type { Room } from '../../../shell/rooms';
import { drawGrain, inkOf } from './grain';
import { abilitiesOf, openAbilities, registry } from './abilities';
import { readingOf } from './reading';
import { looking, WHY } from './words';
import { sight } from './abilities';

const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const EYE_ABIL = '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>';

/** One card of the room, as the hub holds it. */
export interface EyeCard {
  id: string;
  name: string;
  glyph: string;
  /** A screen can be pinned; the EDITORS fold, the origin and Every screen cannot. */
  pin: boolean;
  tap(): void;
}
export interface EyeRoomOpts {
  room: Room;
  /** The room's things as the hub draws them (shell/rooms.ts hubThings): their order is the room's. */
  order: string[];
  card(id: string): EyeCard | undefined;
  /** The EDITORS fold's pills (shell/areadefs.ts) and where each opens. */
  fold?: { id: string; pills: { id: string; pill: string; open(): void }[] };
}

/** What the room's wall is drawing, for the checks and the console (window.__ghosty.eyeroom). */
export const roomState = {
  room: '',
  kick: '',
  feeds: [] as { id: string; kind: string; sharp: boolean; fav: boolean; line: string; tag: string }[],
  sharp: 0,
  pills: [] as string[],
};

export interface EyeRoom {
  el: HTMLElement;
  /** Draw (or redraw what changed) from the state now; `force` after the world or the room's look changed. */
  paint(force?: boolean): void;
  /** The line of sight and the grain, once the wall is on screen. */
  settle(): void;
}

export function eyeRoom(o: EyeRoomOpts): EyeRoom {
  const kick = h('p.eyekick.g-truth', { dataset: { case: 'keep' } });
  const grid = h('div.eyegrid');
  const focus = h('div.eyefocus');
  const el = h('div.eyehub.eyeroom', { dataset: { room: o.room.key } }, kick, grid, focus);
  let drawn = '';
  let ink = '';
  let raf = 0;
  const grain = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!el.isConnected || !el.getClientRects().length) return;
      ink = inkOf();
      for (const cv of el.querySelectorAll<HTMLCanvasElement>('canvas.eyepic')) drawGrain(cv, cv.dataset.feed ?? '', ink, cv.closest('.mini') ? 3 : 4);
      sight(el);
    });
  };
  const pic = (id: string) => h('canvas.eyepic', { 'aria-hidden': 'true', dataset: { feed: id } });
  const tag = (glyph: string | null, words: string, extra: (Node | null)[] = []) => h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, ...(glyph ? [icon(glyph, 'ic eyeic')] : []), h('span', words), ...extra);
  const lineEls = new Map<string, HTMLElement>();
  let abilLine: HTMLElement | null = null;

  /** Which feed the eye is on: the last he used here, else the first he starred, else the room's first. */
  const sharpId = (cards: EyeCard[]): { id: string; why: 'recent' | 'starred' | 'first' } => {
    const mine = atHand(o.room);
    // (an editor used last is the EDITORS fold, once)
    const cardFor = (id: string) => (o.fold?.pills.some((p) => p.id === id) ? o.fold.id : id);
    const r = mine.find((m) => m.why === 'recent' && cards.some((c) => c.id === cardFor(m.id)));
    if (r) return { id: cardFor(r.id), why: 'recent' };
    const s = mine.find((m) => m.why === 'starred' && cards.some((c) => c.id === cardFor(m.id)));
    if (s) return { id: cardFor(s.id), why: 'starred' };
    return { id: cards[0]!.id, why: 'first' };
  };

  const build = () => {
    const cards = o.order.map((id) => o.card(id)).filter((c): c is EyeCard => !!c);
    if (!cards.length) return;
    const pinned = new Set(favourites());
    const { id: sid, why } = sharpId(cards);
    lineEls.clear();
    const out: HTMLElement[] = [];
    let sharpEl: HTMLElement | null = null;
    const feeds: typeof roomState.feeds = [];
    for (const c of cards) {
      const isSharp = c.id === sid;
      const fav = pinned.has(c.id);
      const works = worksLine(c.id);
      const line = h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, readingOf(c.id));
      lineEls.set(c.id, line);
      const mark = isSharp ? WHY[why] : '';
      const label = `${c.name}${mark ? `, ${mark.toLowerCase()}` : ''}${fav ? ', pinned' : ''}${works ? `, in the works: ${works}` : ''}`;
      const works0 = works ? h('i.eyeworks', { 'aria-hidden': 'true' }) : null;
      const common = { id: c.id, in: o.room.key, case: 'keep', kind: isSharp ? (why === 'recent' ? 'last' : why) : fav ? 'favourite' : 'thing', ...(fav ? { fav: 'true' } : {}), ...(works ? { works: 'true' } : {}) };
      const isFold = !!o.fold && c.id === o.fold.id;
      let b: HTMLElement;
      if (isFold) {
        // the one feed that holds feeds: a group, not one button (its body opens the editor he used last; each small feed opens one editor)
        const minis = o.fold!.pills.map((p) => {
          const m = h('button.eyefeed.mini', { type: 'button', dataset: { editor: p.id, case: 'keep', feed: p.id }, 'aria-label': `Open ${p.pill.toLowerCase()}` }, pic(p.id), h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, h('span', p.pill)));
          m.addEventListener('click', (ev) => {
            ev.stopPropagation();
            p.open();
          });
          pinOnHold(m, p.id);
          return m;
        });
        roomState.pills = o.fold!.pills.map((p) => p.pill);
        b = h(`div.eyefeed.fold${isSharp ? '.sharp' : ''}` as 'div', { role: 'group', 'aria-label': `${label}: ${o.fold!.pills.map((p) => p.pill.toLowerCase()).join(', ')}`, dataset: common },
          ...(isSharp ? [] : [pic(c.id)]),
          h('button.eyefoldhead', { type: 'button', 'aria-label': `${c.name}: open the editor I used last` }, tag(c.glyph, isSharp ? `${c.name} · ${WHY[why]}` : c.name, [works0, fav ? icon(STAR, 'ic eyeic eyestar') : null]), line),
          h('span.eyepills', { role: 'group', 'aria-label': 'The editors' }, ...minis));
        b.querySelector('.eyefoldhead')!.addEventListener('click', () => c.tap());
      } else {
        b = h(`button.eyefeed${isSharp ? '.sharp' : ''}` as 'button', { type: 'button', dataset: common, 'aria-label': `${label}: ${readingOf(c.id)}`, ...(works ? { 'aria-description': `In the works: ${works}` } : {}) },
          ...(isSharp ? [] : [pic(c.id)]),
          tag(isSharp ? CLOCK : c.glyph, isSharp ? WHY[why] : c.name, [works0, fav ? icon(STAR, 'ic eyeic eyestar') : null]),
          ...(isSharp ? [h('span.eyename', { dataset: { case: 'keep' } }, c.name)] : []),
          line);
        b.addEventListener('click', () => c.tap());
        if (c.pin) pinOnHold(b, c.id);
      }
      feeds.push({ id: c.id, kind: String(common.kind), sharp: isSharp, fav, line: line.textContent ?? '', tag: b.querySelector('.eyetag')?.textContent?.trim() ?? '' });
      if (isSharp) sharpEl = b;
      else out.push(b);
    }
    // the room's own abilities: one feed more, whose count is read once the registry is in
    const ab = h('button.eyefeed.abil', { type: 'button', dataset: { in: o.room.key, kind: 'abilities', case: 'keep' }, 'aria-label': 'What I can do here. Open the wall of abilities' },
      pic(`abilities:${o.room.key}`), tag(EYE_ABIL, 'Abilities'), (abilLine = h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, 'What I can do here')));
    ab.addEventListener('click', () => void openAbilities(o.room.key));
    out.push(ab);
    void registry().then(() => {
      const n = abilitiesOf(o.room.key).length;
      if (abilLine) abilLine.textContent = n ? `${n} things I can do here` : 'What I can do here';
      ab.dataset.count = String(n);
    });
    grid.replaceChildren(...out);
    focus.replaceChildren(...(sharpEl ? [sharpEl, h('i.eyesight', { 'aria-hidden': 'true' })] : []));
    kick.textContent = looking(o.room.title, cards.length);
    roomState.room = o.room.key;
    roomState.kick = kick.textContent;
    roomState.feeds = feeds;
    roomState.sharp = sharpEl ? 1 : 0;
    grain();
  };

  const paint = (force = false) => {
    const cards = o.order.map((id) => o.card(id)).filter((c): c is EyeCard => !!c);
    const { id: sid, why } = sharpId(cards);
    const sig = `${cards.map((c) => c.id).join()}|${sid}:${why}|${favourites().join()}|${cards.map((c) => worksLine(c.id)).join('')}`;
    if (force || sig !== drawn) {
      drawn = sig;
      build();
      return;
    }
    // the same feeds: only the readings are read again (a line is written when it changed)
    for (const [id, l] of lineEls) {
      const t = readingOf(id);
      if (l.textContent !== t) l.textContent = t;
    }
    roomState.feeds = roomState.feeds.map((f) => ({ ...f, line: lineEls.get(f.id)?.textContent ?? f.line }));
  };
  // a pin or an unpin redraws the wall at once (the bracket corners follow his favourites)
  settings.subscribe((s, p) => s.favourites !== p.favourites && el.isConnected && paint());
  return { el, paint, settle: grain };
}

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.eyeroom = roomState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
