/**
 * THE HOUSE ON EVERY SCREEN (BRIEF-SHELL-2; OWNER-ISSUES 143, 155): when the world is The Scan or ONE INK (a phone), the tab bar is the house
 * the Scan's Home draws, on every screen: `THE HOUSE · 7 ROOMS` at the left, `YOU ARE IN <ROOM>` at the right, the seven rooms
 * HOME SEE MAKE LEARN PLAN LIFE ME as one plate of keys with the one he is in lit, and the ask line under it (a tap into it raises
 * the jump bar: shell/jump.ts). One tap on THE HOUSE unfolds THE PLAN: every room with its things numbered, the room he is in lit,
 * his favourites starred, his recents clocked, what is IN THE WORKS dotted amber, all from shell/rooms.ts (the deck's list and the
 * finding test's list: one source). Glass keeps today's bar: nothing here is drawn there (`body.housed` is the house's own class).
 * In ONE INK the house is the FOOT (BRIEF-ONE-INK): the same seven keys and the same YOU ARE IN state in another drawing, with no
 * label row and no second ask line (the field is the jump bar, reached from Home's ask line, ⌘K and /); the plan opens from a long
 * press on the foot's eye (the Home key) and from the jump bar's words "the plan". In ORBIT (BRIEF-ORBIT-HUD) there is no bar at all: the plan
 * opens from the left end of the orb's line (shell/orbit.ts) and draws the same seven rooms as stations along an orbit.
 * Home draws its own house (features/core/scan/home.ts) with the same words; this piece gives it THE HOUSE's tap.
 */
import { h, icon } from '../core/dom';
import { sfx } from '../assistant/sfx';
import { ui } from '../state/app';
import { recipeEvents } from '../state/theme';
import { togglePalette } from '../commands/registry';
import { dur } from '../ui/machine';
import { favourites, pinOnHold } from './favourites';
import { areaOf, navTo, pinnedAndRecent, recentTabs, toolName } from './areas';
import { AREAS } from './areadefs';
import { ROOMS, roomOf, type Room, type Thing } from './rooms';
import { worksLine } from './inventory';
import { tabs } from './tabs';
import { deckState } from './launcher';
import { changedLines, refreshChanged, type ChangeLine } from '../further/changed';

const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';

/** What the house and the plan show, for specs and the console (window.__ghosty.house). */
export const houseState = { planOpen: false, room: '', says: '' };

/** The house is drawn: the Scan's world or ONE INK's, on a phone. */
// (the width is read on a resize, not at every call: `innerWidth` makes the page lay itself out first, and the house asks on every screen
// it enters, straight after the screen's own classes changed)
let narrow = innerWidth < 900;
addEventListener('resize', () => (narrow = innerWidth < 900));
export const houseOn = (): boolean => narrow && ['scan', 'ink', 'map', 'eye', 'orbit'].includes(document.documentElement.dataset.world ?? '');
/** The house is drawn as THE MAP's scale: the same seven keys as ticks on a ruler, the plan as its districts (BRIEF-MAP-EYE-HUDS). */
export const scaleOn = (): boolean => narrow && document.documentElement.dataset.world === 'map';
/** The house is drawn as THE EYE's instruments: the same seven keys as seven small feeds, the one he is in the one sharp feed (BRIEF-EYE-HUD). */
export const eyeOn = (): boolean => narrow && document.documentElement.dataset.world === 'eye';
/** The house's own name on its kick and the plan's head: the map calls the rooms districts, the eye calls them feeds on its wall. */
const houseName = (): string => (scaleOn() ? 'The map · 7 districts' : eyeOn() ? 'The wall · 7 feeds' : 'The house · 7 rooms');
/** What the kick says he is doing: the eye is looking at a room, the others are in it. */
const youWords = (title: string): string => (eyeOn() ? `Looking at ${title}` : `You are in ${title}`);
/** The house is drawn as ONE INK's foot (the same house in another drawing: no label row, no ask line). */
export const footOn = (): boolean => narrow && document.documentElement.dataset.world === 'ink';
/** ORBIT is drawn (a phone): no bar, the orb is the way in; the house is its rooms on a ring and the plan opens from the line's left end (shell/orbit.ts). */
export const orbitOn = (): boolean => narrow && document.documentElement.dataset.world === 'orbit';
/**
 * GROWN UP is drawn (a phone): one glass capsule at the foot of every screen (shell/capsule.ts) in place of the tab bar and the ask bar. It is Glass's own
 * look with less on it, so the house's Scan drawing (`body.housed`) is not used: the dock is measured as the house's is (--dockh), and THE ROOMS layer
 * (the plan, below) is the deck folded in.
 */
export const grownOn = (): boolean => narrow && document.documentElement.dataset.world === 'grown';

/** The room he is in: the house's key lit and the words at the right ("LEARN"). Every screen has one; Every screen is under ME. */
export function roomNow(): Room {
  if (deckState.open) return ROOMS.find((r) => r.key === 'me')!;
  return roomOf(ui.get().tab) ?? ROOMS[0]!;
}

/** The field's words on this screen (the mocks': a room, Settings, and the rest). */
export function fieldWords(): string {
  const tab = ui.get().tab;
  if (deckState.open) return 'A number, a word, or a question';
  if (tab === 'settings') return 'Find a setting';
  if (tab.startsWith('area-') && tab !== 'area-ask') return `Find anything in ${roomNow().title.charAt(0)}${roomNow().title.slice(1).toLowerCase()}`;
  // (GROWN UP's one field: what is on the Stage is asked about or changed; everywhere else it is the mock's own words)
  // (offline, the field still jumps; a sentence waits for the signal, and it says so)
  if (grownOn()) return document.body.classList.contains('staged') ? 'Ask about it, or change it' : ui.get().connected === false ? 'Jump anywhere. Asking waits for signal' : 'Ask or jump anywhere';
  return 'A number, a word, or a question';
}

export interface House {
  paint(): void;
  plan: { open(): void; close(): void; toggle(): void; isOpen(): boolean };
}

let deckOpener: () => void = () => undefined;
let thePlan: House['plan'] | null = null;
/** The plan, once the house is built (Home's THE HOUSE key opens it too). */
export const housePlan = (): House['plan'] | null => thePlan;

export function buildHouse(dock: HTMLElement, openDeck: () => void): House {
  deckOpener = () => (grownOn() ? thePlan?.open() : openDeck());
  const cap = dock.querySelector<HTMLElement>('.tabcap');
  // the seventh room: ME is a key of the house (the avatar at the top still opens the Me sheet)
  const meKey = h('button.scanme', { type: 'button', role: 'tab', dataset: { area: 'me', case: 'keep' }, title: 'Me' }, h('span', 'Me'));
  meKey.addEventListener('click', () => {
    if (deckState.open) document.querySelector<HTMLElement>('#deck .dkclose')?.click();
    if (ui.get().tab !== 'area-me') navTo('area-me', areaOf(ui.get().tab)?.id === 'me' ? 'pop' : 'switch');
  });
  const left = h('button.housebtn', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'The house: seven rooms. Open the plan', dataset: { case: 'keep' } }, h('span.g-truth', houseName()));
  const where = h('span.g-truth.housewhere', { dataset: { case: 'keep' } });
  const kick = h('div.housekick', { dataset: { case: 'keep' } }, left, where);
  const words = h('span.housewords');
  const field = h('button.housefield', { type: 'button', 'aria-label': 'Ask, or jump to a screen' }, words);
  const mic = h('button.housemic', { type: 'button', 'aria-label': 'Say it' }, icon(MIC));
  const ask = h('div.houseask', { dataset: { case: 'keep' } }, field, mic);
  cap?.before(kick);
  dock.append(ask);
  field.addEventListener('click', () => {
    plan.close();
    togglePalette();
  });
  mic.addEventListener('click', () => {
    plan.close();
    void import('./jump').then((j) => j.openWithMic());
  });

  // ---------------------------------------------------------------- THE PLAN
  let el: HTMLElement | null = null;
  let offKey: (() => void) | null = null;
  const lit = (r: Room) => r.key === roomNow().key;
  const thingBtn = (r: Room, t: Thing, starred: Set<string>, recent: Set<string>) => {
    const works = !!worksLine(t.id);
    const b = h('button.planthing', {
      type: 'button',
      dataset: { id: t.id, n: String(t.n), room: r.key, case: 'keep', ...(starred.has(t.id) ? { starred: 'true' } : {}), ...(recent.has(t.id) ? { recent: 'true' } : {}), ...(works ? { works: 'true' } : {}) },
      'aria-label': `${String(t.n).padStart(2, '0')} ${t.name}, in ${r.title.charAt(0)}${r.title.slice(1).toLowerCase()}${starred.has(t.id) ? ', starred' : ''}${recent.has(t.id) ? ', recent' : ''}${works ? ', in the works' : ''}`,
    },
      h('span.g-index', String(t.n).padStart(2, '0')),
      h('span.ptname', t.name),
      starred.has(t.id) ? icon(STAR, 'ic ptmark') : recent.has(t.id) ? icon(CLOCK, 'ic ptmark') : null,
      works ? h('i.ptdot', { 'aria-hidden': 'true' }) : null);
    // [further] a long press on a thing in the plan walks him through it (WALK ME THROUGH IT: features/further/walk.ts); a tap opens it as ever
    let held = false;
    let timer = 0;
    let from = { x: 0, y: 0 };
    if (t.screen) {
      b.addEventListener('pointerdown', (e) => {
        held = false;
        from = { x: e.clientX, y: e.clientY };
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          held = true;
          close();
          void import('../features/further/walk').then((m) => m.startWalk(t.id)).catch(() => undefined);
        }, 650);
      });
      b.addEventListener('pointermove', (e) => Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10 && clearTimeout(timer));
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(timer));
      b.addEventListener('contextmenu', (e) => held && e.preventDefault());
    }
    b.addEventListener('click', () => {
      if (held) return void (held = false);
      close();
      openThing(t);
    });
    return b;
  };
  /** WHAT CHANGED SINCE YESTERDAY (further/changed.ts): one line under a room that has something new; a room with nothing new says nothing. */
  const paintChanges = (lines: ChangeLine[] = changedLines()) => {
    if (!el) return;
    for (const sec of el.querySelectorAll<HTMLElement>('.planroom')) {
      sec.querySelector('.planchg')?.remove();
      const l = lines.find((x) => x.room === sec.dataset.room);
      if (l) sec.querySelector('.planroomhead')?.after(h('p.planchg', { dataset: { room: l.room, case: 'keep' } }, l.text));
    }
  };
  // ---------------------------------------------------------------- GROWN UP'S ROOMS LAYER: the plan, and the deck folded in (d3/nav-440.png)
  // Recent and starred on top (one tap each), then every room with its screens as chips under it: a screen is two taps from anywhere (the capsule's
  // first key, the chip). A room's name opens its hub. `Every screen` is this layer, so it is not a chip on itself.
  const layerChip = (t: { id: string; name: string; screen: string | null }, mark: 'recent' | 'starred' | null, works: boolean, room: string) => {
    const b = h('button.glychip', {
      type: 'button',
      dataset: { id: t.id, room, case: 'keep', ...(mark ? { mark } : {}), ...(works ? { works: 'true' } : {}) },
      'aria-label': `${t.name}${mark ? `, ${mark}` : ''}${works ? ', in the works' : ''}`,
    }, mark ? icon(mark === 'starred' ? STAR : CLOCK, 'ic glymark') : null, h('span', t.name), works ? h('i.glydot', { 'aria-hidden': 'true' }) : null);
    return b;
  };
  const drawLayer = () => {
    const { pinned, lately } = pinnedAndRecent();
    const starred = new Set(favourites());
    const recent = new Set(recentTabs());
    const here = roomNow();
    const close0 = h('button.glyclose', { type: 'button', 'aria-label': 'Close', dataset: { case: 'keep' } }, icon('<path d="M6 6l12 12M18 6L6 18"/>'));
    close0.addEventListener('click', () => close());
    const head = h('div.glyhead', { dataset: { case: 'keep' } },
      h('div.glykick', h('span.g-truth', houseName()), h('span.g-truth.glyhere', `You are in ${here.title}`)),
      h('div.glytitle', h('h2', 'Go to'), close0));
    const hand = [...lately.map((t) => ({ t, mark: 'recent' as const })), ...pinned.map((t) => ({ t, mark: 'starred' as const }))];
    const handEl = h('section.glysect.glyhand', { dataset: { part: 'hand' } }, h('h3.glylabel', 'Recent and starred'),
      hand.length
        ? h('div.glychips', ...hand.map(({ t, mark }) => {
            const b = layerChip({ id: t.id, name: toolName(t), screen: t.id }, mark, !!worksLine(t.id), roomOf(t.id)?.key ?? '');
            b.addEventListener('click', () => {
              close();
              navTo(t.cardTo ?? t.id, 'push');
            });
            pinOnHold(b, t.id);
            return b;
          }))
        : h('p.glynone', { dataset: { case: 'keep' } }, 'Nothing opened yet. The last things you open wait here; hold any thing to star it.'));
    const rooms = ROOMS.map((r) => {
      const a = AREAS.find((x) => x.id === r.area)!;
      const things = r.things.filter((t) => t.id !== 'deck');
      const n = things.length;
      const title = h('button.glyroomhead', { type: 'button', dataset: { room: r.key, case: 'keep' }, 'aria-label': `${r.title.charAt(0)}${r.title.slice(1).toLowerCase()}: open the room` },
        icon(a.icon, 'ic glyic'),
        h('span.glyname', `${r.title.charAt(0)}${r.title.slice(1).toLowerCase()}`),
        h('span.glycount', r.key === 'home' ? 'the reactor' : `${n} ${n === 1 ? 'screen' : 'screens'}${r.key === here.key ? ' · you are here' : ''}`),
        icon('<path d="M9 5l7 7-7 7"/>', 'ic glychev'));
      title.addEventListener('click', () => {
        close();
        if (ui.get().tab !== r.screen) navTo(r.screen, 'switch');
      });
      const chips = things.map((t) => {
        const b = layerChip(t, starred.has(t.id) ? 'starred' : recent.has(t.id) ? 'recent' : null, !!worksLine(t.id), r.key);
        b.addEventListener('click', () => {
          close();
          openThing(t);
        });
        return b;
      });
      return h(`section.glyroom${r.key === here.key ? '.lit' : ''}` as 'section', { dataset: { room: r.key } }, title, chips.length ? h('div.glychips', ...chips) : null);
    });
    const body = h('div.glybody', handEl, h('h3.glylabel', 'Every screen, by room'), ...rooms);
    return h('div#plan.glayer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Go to: every room and the screens in it' }, h('i.glygrab', { 'aria-hidden': 'true' }), head, body);
  };
  const draw = () => {
    if (grownOn()) return drawLayer();
    const starred = new Set(favourites());
    const recent = new Set(recentTabs());
    const head = h('button.planhead', { type: 'button', 'aria-label': 'Fold the plan', dataset: { case: 'keep' } }, h('span.g-truth', houseName()), h('span.g-truth', youWords(roomNow().title)));
    head.addEventListener('click', () => close());
    const rooms = ROOMS.map((r) => {
      const title = h('button.planroomhead', { type: 'button', dataset: { room: r.key, case: 'keep' }, 'aria-label': `${r.title}: open the room` }, h('span.rtitle', r.title), h('span.rcount', String(r.things.length)));
      title.addEventListener('click', () => {
        close();
        if (ui.get().tab !== r.screen) navTo(r.screen, 'switch');
      });
      return h(`section.planroom${r.key === 'home' ? '.wide' : ''}${lit(r) ? '.lit' : ''}` as 'section', { dataset: { room: r.key } }, title, ...r.things.map((t) => thingBtn(r, t, starred, recent)));
    });
    return h('div#plan', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The house: every room and the things in it' }, head, h('div.plangrid', ...rooms));
  };
  const open = () => {
    if (el || !(houseOn() || grownOn())) return;
    el = draw();
    const topEl = document.getElementById('top');
    // (Home's ask line is its own, the talk line: scan/home.ts; in ONE INK, THE MAP and THE EYE the plan stands on the foot's, the scale's or the instruments' keys; in GROWN UP on the capsule; in ORBIT on the orb's line)
    const askEl = footOn() || scaleOn() || eyeOn() ? cap : grownOn() ? dock.querySelector<HTMLElement>('.gcap') : orbitOn() ? dock.querySelector<HTMLElement>('.orbline') : document.querySelector<HTMLElement>('body.scanhome .scanask') ?? dock.querySelector<HTMLElement>('.houseask');
    // (a line that is not on screen, ORBIT's on Home, has no top to stand on: the plan then ends at the foot)
    const askRect = askEl && askEl.getClientRects().length ? askEl.getBoundingClientRect() : null;
    el.style.setProperty('--plan-top', `${Math.round(topEl ? topEl.getBoundingClientRect().bottom : 0)}px`);
    el.style.setProperty('--plan-bottom', `${Math.round(askRect ? innerHeight - askRect.top : 0) + 8}px`);
    document.getElementById('app')!.append(el);
    paintChanges();
    // (the rooms' own readings are read again, and what is new said as soon as they are in)
    void refreshChanged().then((l) => paintChanges(l)).catch(() => undefined);
    document.body.classList.add('planned');
    left.setAttribute('aria-expanded', 'true');
    houseState.planOpen = true;
    sfx('open');
    // it unfolds on the tokens' curve (--g-dur-bring); with Reduce Motion it is there at once
    const ms = dur('bring');
    if (ms) el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: ms, easing: getComputedStyle(document.documentElement).getPropertyValue('--g-ease-bring').trim() || 'ease-out' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    offKey = () => removeEventListener('keydown', onKey);
    el.querySelector<HTMLElement>('.planroom.lit .planthing, .planroom.lit .planroomhead, .glyroom.lit .glyroomhead')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => {
    if (!el) return;
    el.remove();
    el = null;
    offKey?.();
    offKey = null;
    document.body.classList.remove('planned');
    left.setAttribute('aria-expanded', 'false');
    houseState.planOpen = false;
  };
  const plan = { open, close, toggle: () => (el ? close() : open()), isOpen: () => !!el };
  thePlan = plan;
  left.addEventListener('click', () => plan.toggle());
  ui.subscribe((s, p) => s.tab !== p.tab && close());

  const paint = () => {
    const on = houseOn();
    document.body.classList.toggle('housed', on);
    document.body.classList.toggle('grown', grownOn());
    // (the ME key is in the bar only in the house: Glass's bar has its six keys and nothing else in the DOM)
    if (on) {
      if (!meKey.isConnected) cap?.append(meKey);
    } else meKey.remove();
    const r = roomNow();
    houseState.room = r.key;
    houseState.says = youWords(r.title);
    // (words are written only when they changed: a write makes the dock lay itself out again)
    if (where.textContent !== houseState.says) where.textContent = houseState.says;
    const kw = houseName();
    const kt = left.firstElementChild;
    if (kt && kt.textContent !== kw) kt.textContent = kw;
    const fw = fieldWords();
    if (words.textContent !== fw) words.textContent = fw;
    // the Ask key reads HOME in the house (Home is the room it opens)
    // (named Home for VoiceOver while the house is drawn: in ONE INK its word is not drawn, the eye is)
    const askBtn = cap?.querySelector<HTMLElement>('button[data-area="ask"]');
    if (askBtn) {
      if (on && askBtn.getAttribute('aria-label') !== 'Home') askBtn.setAttribute('aria-label', 'Home');
      else if (!on && askBtn.hasAttribute('aria-label')) askBtn.removeAttribute('aria-label');
    }
    const askKey = cap?.querySelector<HTMLElement>('button[data-area="ask"] span');
    const askWord = on ? 'Home' : 'Ask';
    if (askKey && askKey.textContent !== askWord) askKey.textContent = askWord;
    if (!on && !grownOn()) close();
    // the key of the room he is in (the tab bar lights the area; Every screen is under ME)
    if (on && deckState.open) for (const b of dock.querySelectorAll<HTMLElement>('button[data-area]')) {
      const me = b.dataset.area === 'me';
      b.classList.toggle('on', me);
      b.setAttribute('aria-selected', String(me));
    }
  };
  recipeEvents.on('change', paint);
  addEventListener('resize', paint);
  // the page ends where the house begins: its measured height is --dockh (the keys, the ask line and the home indicator's room)
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      const bs = document.body.style;
      const h = Math.round(dock.getBoundingClientRect().height);
      if ((houseOn() || grownOn()) && h > 0) bs.setProperty('--dockh', `${h}px`);
      else bs.removeProperty('--dockh');
    }).observe(dock);
  }
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.house = houseState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  paint();
  return { paint, plan };
}

/** A thing opened: its screen (as a card on its hub opens it), the origin, or Every screen. */
export function openThing(t: Thing): void {
  // (GROWN UP's deck is THE ROOMS layer: every screen, by room, from the capsule's first key)
  if (t.id === 'deck') return grownOn() ? thePlan?.open() : deckOpener();
  if (t.id === 'origin') return void import('../features/me/origin').then((m) => m.openOrigin());
  if (!t.screen) return;
  const def = tabs().find((x) => x.id === t.screen);
  navTo(def?.cardTo ?? t.screen, 'push');
}
