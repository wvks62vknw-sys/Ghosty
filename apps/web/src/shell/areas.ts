/**
 * The areas: ASK · SEE · MAKE · LEARN · PLAN · LIFE, and ME.
 * Every tab belongs to one area. The tab bar shows the six; ME is the avatar at the top right,
 * which opens the "Me" sheet (Memory, Settings, System, Links, every screen). An area opens on
 * its hub: a large title and every one of its tools as an instrument card (shell/hubcards.ts); the hub scrolls when they
 * run past the screen (the owner's word on 1 Nov, OWNER-ISSUES 119: findability outranks the old "one screen, six cards
 * and a More row" rule, so nothing hides in a row of small ones); the recent screens are in Search.
 * Every tab keeps its own id and hash (#gym still opens the GYM); hubs are tabs too (#area-learn).
 */
import { addPaletteDecor, register, togglePalette, type Command } from '../commands/registry';
import { clear, fmt, h, icon } from '../core/dom';
import { brain, ownerKey } from '../api/brain';
import { BUILD } from '../state/build';
import { statusDials } from '../ui/statusdials';
import { settings, ui } from '../state/app';
import { THEMES } from '../state/theme';
import { mood, moodShape } from '../state/mood';
import { moodWords } from '../../../../packages/shared/src/mood';
import { go, tabs, type TabDef } from './tabs';
import { empty, listRow, niceCase } from '../ui/components';
import { ensureDefs } from '../ui/instruments';
import { CARDS, hubFacts, hubWords, loadHubWords } from './hubcards';
import { buildSwitcher, HOLD_MS, type SwitchItem } from './switcher';
import { favourites, isFavourite, pinOnHold } from './favourites';
import { jump } from './jump';
import { footOn, houseOn, housePlan, openThing } from './house';
import { atHand, thingForNumber, thingLine } from './inventory';
import { ROOMS } from './rooms';
import { recipeEvents } from '../state/theme';
import { tag } from '../ui/machine';
import { screenSays } from './awareness';
import { gymControl, gymState } from '../features/gym/index';
import { schoolState } from '../features/school/index';
import { offlineBrain } from '../offline/brain';
import { guardian, loadGuardian } from '../state/guardian'; // [guardian]
import { goToPanel } from '../ui/sections'; // [guardian]
import { clockIn, FEED_NAMES, watchLine, type GuardianInfo } from '../../../../packages/shared/src/guardian'; // [guardian]

// (the areas and the Me sheet's rows: pure lists the ABILITIES catalogue reads too, shell/areadefs.ts)
import { AREAS, ME_CARDS, ME_ROWS, type Area } from './areadefs';
import { openOrigin, ORIGIN_ICON } from '../features/me/origin'; // [social] FATHER AND THE ORIGIN
export { AREAS, ME_CARDS, ME_ROWS, type Area };

/**
 * The old per-tool colours. The one icon language (OWNER-ISSUES 32) no longer draws them: every glyph is a bare
 * thin line in the secondary ink, the accent only for the live or selected one (styles.css "icon language").
 * Kept for the callers that still pass a colour along (Search's decor).
 */
export const TINT: Record<string, string> = {
  core: '#64d2ff', brief: '#5e5ce6', eye: '#0a84ff', lens: '#bf5af2', interpreter: '#5ac8fa', lab: '#ffb340', rehearse: '#30d158',
  studio: '#ff9f0a', workshop: '#8e8e93', reverse: '#40c8e0', space: '#ac8e68', workbench: '#ffb340',
  learn: '#30d158', gym: '#ff375f', school: '#ffd60a', library: '#a2845e',
  agenda: '#ff453a', markets: '#00c7be', threats: '#ffd60a', radio: '#ff6482',
  memory: '#5ac8fa', settings: '#8e8e93', system: '#98989d', links: '#0a84ff',
  // [tabs] the screens the sheets became (BRIEF-TABS 2)
  money: '#30d158', body: '#ff375f', kitchen: '#ff9f0a', people: '#5ac8fa', work: '#8e8e93', creative: '#bf5af2', outside: '#34c759', homeadmin: '#ffd60a',
  learning: '#30d158', coach: '#ff9f0a', social: '#0a84ff', convert: '#40c8e0', docs: '#a2845e', house: '#ffb340',
};
export const tintOf = (id: string) => TINT[id] ?? '#8e8e93';

const hubId = (a: Area) => `area-${a.id}`;
/** A screen that is a row of another (THE LOOK, a row of Settings: BRIEF-DESIGN-SYSTEM 5) lights that one's area. */
const ROW_OF: Record<string, string> = { look: 'settings' };
export const areaOf = (tab: string): Area | undefined => {
  const t = ROW_OF[tab] ?? tab;
  return AREAS.find((a) => a.tabs.includes(t) || hubId(a) === t);
};
export const isHub = (tab: string) => tab.startsWith('area-');
/** Where the tab bar's button for an area goes: ASK straight to the reactor, the others to their hub. */
export const areaHome = (a: Area) => (a.id === 'ask' ? 'core' : hubId(a));

// ---------- recents: the last screens opened (this device only)
const KEY = 'ghosty.recents';
let recents: string[] = (() => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).filter((x) => typeof x === 'string').slice(0, 8);
  } catch {
    return [];
  }
})();
export const recentTabs = () => recents;
ui.subscribe((s, p) => {
  if (s.tab === p.tab || isHub(s.tab) || s.tab === 'core') return;
  recents = [s.tab, ...recents.filter((x) => x !== s.tab)].slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(recents));
  } catch {
    /* storage unavailable: recents for this visit only */
  }
});

// ---------- navigation with a direction, for the push / pop / switch transitions
export type NavDir = 'push' | 'pop' | 'switch';
export function navTo(id: string, dir: NavDir): void {
  document.documentElement.dataset.nav = dir;
  go(id);
  // A hash change from anywhere else is a plain switch again.
  setTimeout(() => (document.documentElement.dataset.nav = 'switch'), 700);
}

const def = (id: string) => tabs().find((t) => t.id === id);
/** A tool's name inside its area: LEARN's own course tool is "Courses" there (not "Learn" inside Learn). */
const ALIAS: Record<string, string> = { learn: 'Courses', interpreter: 'Interpret' };
export const toolName = (t: TabDef) => ALIAS[t.id] ?? niceCase(t.title);

/** A tool's glyph: a bare thin line, no tile behind it (the id is kept so callers need not change). */
export const squircle = (_id: string, glyph: string, cls = 'sq') => h(`span.${cls}` as 'span', icon(glyph));

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
/** ASK's third tool: talk by voice — the reactor screen, listening. */
const voiceTap = () => {
  navTo('core', 'pop');
  setTimeout(() => document.querySelector<HTMLButtonElement>('#mic')?.click(), 350);
};

/**
 * A tool's card on its hub (BRIEF-IRON-BUILD step 2; the navigation sheet the owner said yes to, mockups/nav): its
 * instrument, the kicker (bare glyph, name, live dot and status word), one line on what it does for him and two
 * readouts, from shell/hubcards.ts (or the tab's own TabDef.instrument / readouts / status). One button: a tap
 * anywhere opens the tool. `paint()` redraws it from the state in place, so a tap is never lost to a repaint.
 */
/** [tabs] A reading that is a figure ("21", "0.4", "£1,240", "+0.7%", "8°C", "12:30"), set in the mono; anything else is words. */
const isFigure = (v: string) => /^[-+−]?[£$€]?\d[\d.,:/]*(%|°[CF]?)?$/.test(v.trim());

interface ToolCard {
  el: HTMLElement;
  id: string;
  paint(): void;
  load(): Promise<unknown>;
  /** A room's drawing of it (The Scan): its number, why it is at hand, and where it sits. */
  place(o: { n?: number; why?: 'recent' | 'starred' | ''; at: 'hand' | 'rest' }): void;
}

function toolCard(id: string, name: string, glyph: string, t: TabDef | null, onTap: () => void): ToolCard {
  const c = CARDS[id];
  const word = h('em.st');
  const ins = h('span.ins');
  const title = h('span.t');
  const reads = h('span.reads');
  const why = h('span.why');
  // a card's own status line (God's Eye: MACHINE VIEW), which opens somewhere of its own rather than the tool
  const line = h('span.hline', { hidden: true });
  line.addEventListener('click', (e) => {
    if (!c?.lineTo) return;
    e.stopPropagation();
    navTo(c.lineTo, 'push');
  });
  // [tabs] IN THE WORKS: a small label and its one line, on a card whose screen still holds a stand-in or a table written in
  const works = c?.works ? h('span.works', h('b', 'In the works'), h('span', c.works)) : null;
  const pinned = h('i.pinmark', { hidden: true }, 'PINNED');
  // (a room's drawing, in The Scan: the clock or the star beside its name, and its one true line for the rest of the room)
  const mark = h('i.hmark', { hidden: true, 'aria-hidden': 'true' });
  const one = h('span.one', { dataset: { case: 'keep' } });
  const el = h('button.hubtile.inst', { type: 'button', dataset: { id, case: 'keep', ...(c?.works ? { works: 'true' } : {}) }, onclick: onTap, ...(c?.works ? { 'aria-description': `In the works: ${c.works}` } : {}) },
    ins,
    h('span.kick', icon(glyph), h('span.nm', name), mark, word),
    title, works, one, reads, why, line, pinned,
  );
  // a long press pins the screen (FAVOURITES, BRIEF-SHELL): the card of a screen only (Voice is not one)
  const paintPin = () => {
    const on = isFavourite(id);
    pinned.hidden = !on;
    if (on) el.dataset.pinned = 'true';
    else delete el.dataset.pinned;
  };
  if (t) {
    pinOnHold(el, id);
    paintPin();
    settings.subscribe(paintPin);
  }
  let insKey: Element | null = null;
  const paint = () => {
    if (t) paintPin();
    if (el.dataset.at) one.textContent = thingLine(id);
    if (!c) return;
    const st = t?.status?.() ?? c.status();
    el.dataset.status = st.toLowerCase();
    clear(word, st === 'LIVE' || st === 'TRAINING' ? h('i.dot.pulse') : h('i.dot'), st);
    title.textContent = typeof c.title === 'function' ? c.title() : c.title;
    const drawn = (t?.instrument ?? c.instrument)?.() ?? null;
    if (!drawn) ins.hidden = true;
    else if (!insKey || !drawn.isEqualNode(insKey)) {
      ins.hidden = false;
      clear(ins, drawn);
      insKey = drawn.cloneNode(true) as Element;
    }
    const rs = (t?.readouts ?? c.readouts)().slice(0, 2);
    clear(reads, ...rs.map((r) => h(`span.rd${r.live && r.value != null ? '.lv' : ''}${r.value == null ? '.none' : ''}${r.value != null && !isFigure(r.value) ? '.wd' : ''}` as 'span',
      h('em', r.label),
      h('b.tnum', r.value ?? r.none ?? 'Not yet', r.value != null && r.unit ? h('small', r.unit) : null))));
    const w = rs.some((r) => r.value == null) ? c.why?.() ?? '' : '';
    why.textContent = w;
    why.hidden = !w;
    const ln = c.line?.() ?? '';
    if (line.textContent !== ln) line.textContent = ln;
    line.hidden = !ln;
  };
  const place: ToolCard['place'] = (o) => {
    if (o.n) el.dataset.n = String(o.n).padStart(2, '0');
    else delete el.dataset.n;
    el.dataset.at = o.at;
    if (o.why) el.dataset.why = o.why;
    else delete el.dataset.why;
    clear(mark, ...(o.why === 'recent' ? [icon(CLOCK, 'ic')] : o.why === 'starred' ? [icon(STARM, 'ic')] : []));
    mark.hidden = !o.why;
    one.textContent = thingLine(id);
  };
  return { el, id, paint, load: () => c?.load?.() ?? Promise.resolve(), place };
}
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const STARM = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';

type Tool = [id: string, name: string, glyph: string, t: TabDef | null, tap: () => void];
/** An area's tools in order (ASK adds Voice): its hub's cards and the switcher's arc. */
function areaTools(a: Area): Tool[] {
  // (a card opens its screen as he left it, or where the screen asks: the Library's opens on its Shelf, TabDef.cardTo)
  const tools: Tool[] = a.tabs.map(def).filter((t): t is TabDef => !!t).map((t) => [t.id, toolName(t), t.icon, t, () => navTo(t.cardTo ?? t.id, 'push')]);
  if (a.id === 'ask') tools.push(['voice', 'Voice', MIC, null, voiceTap]);
  // ([reste] MAKE's two sheets, the converter and the documents, were added here by hand: since 1 Nov they are screens of
  // their own in MAKE's tabs, with the house: BRIEF-TABS 2)
  return tools;
}

function hubTab(a: Area): TabDef {
  return {
    id: hubId(a),
    title: a.title.toUpperCase(),
    icon: a.icon,
    scene: 'backdrop',
    blurb: a.sub,
    hub: true,
    mount(root) {
      ensureDefs();
      const grid = h('div.hubgrid');
      const sub = h('p.hubsub', a.sub);
      // THE ROOM (The Scan: BRIEF-SHELL-2, learn.png): the band of every thing in it, reticled and numbered, then AT HAND (what is recent and
      // starred, open, with two readings each) and THE REST folded in a grid with one line each. The cards are the same cards: placed here
      // when the house is drawn (shell/house.ts houseOn), put back in the grid when it is not (Glass keeps today's hub exactly).
      const room = ROOMS.find((r) => r.area === a.id)!;
      const band = h('div.roomband', { role: 'group', 'aria-label': `${a.title}: ${room.things.length} things`, dataset: { room: room.key } });
      const handHead = h('div.rhead', tag('At hand', { count: 0 }), h('span.g-truth', 'Recent and starred'));
      const handList = h('div.handlist');
      const handNone = h('div.rnone', { dataset: { case: 'keep' } }, empty('NONE', 'Hold any thing to star it; the ones you open last wait here.', 'Nothing here yet'));
      const hand = h('section.athand', { dataset: { part: 'athand' } }, handHead, handList, handNone);
      const restHead = h('div.rhead', tag('The rest', { count: 0 }), h('span.g-truth', { dataset: { case: 'keep' } }, 'Say a number: “open two”'));
      const restGrid = h('div.restgrid');
      const rest = h('section.therest', { dataset: { part: 'therest' } }, restHead, restGrid);
      const roomEl = h('div.scanroom', band, hand, rest);
      const wrap = h('div.hub',
        sub,
        h('button.cmdbar', { type: 'button', onclick: togglePalette, 'aria-label': 'Ask or jump anywhere' }, icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'), h('span', 'Ask or jump anywhere')),
        grid,
        roomEl,
      );
      root.append(wrap);
      // The cards: made once, painted from the state on entering and every few seconds while the hub is on screen. Every
      // tool of the area is an instrument card, two to a row; the hub scrolls when they run past the screen (BRIEF-TABS 3).
      const cards = areaTools(a).map(([id, name, glyph, t, tap]) => toolCard(id, name, glyph, t, tap));
      // (ME's room also holds two things that are not screens: the origin and Every screen: cards only in the room's drawing)
      const extra = a.id === 'me' ? ROOMS.find((r) => r.key === 'me')!.things.filter((t) => !t.screen).map((t) => toolCard(t.id, t.name, t.id === 'deck' ? DECK_GLYPH : ORIGIN_ICON, null, () => openThing(t))) : [];
      const everyCard = [...cards, ...extra];
      clear(grid, ...cards.map((c) => c.el));
      let drawn = '\0';
      const arrange = () => {
        const on = houseOn();
        wrap.classList.toggle('roomed', on);
        const mine = atHand(room);
        const sig = on ? mine.map((m) => `${m.id}:${m.why}`).join(',') : 'glass';
        if (sig === drawn) return;
        drawn = sig;
        if (!on) return void clear(grid, ...cards.map((c) => c.el));
        const num = new Map(room.things.map((t) => [t.id, t.n]));
        const byN = (x: ToolCard, y: ToolCard) => (num.get(x.id) ?? 99) - (num.get(y.id) ?? 99);
        const inHand = mine.map((m) => ({ c: everyCard.find((x) => x.id === m.id)!, why: m.why })).filter((m) => m.c);
        const others = everyCard.filter((c) => !inHand.some((m) => m.c === c)).sort(byN);
        for (const m of inHand) m.c.place({ n: num.get(m.c.id), why: m.why, at: 'hand' });
        for (const c of others) c.place({ n: num.get(c.id), at: 'rest' });
        clear(handList, ...inHand.map((m) => m.c.el));
        clear(restGrid, ...others.map((c) => c.el));
        clear(handHead, tag('At hand', { count: inHand.length }), h('span.g-truth', 'Recent and starred'));
        clear(restHead, tag('The rest', { count: others.length }), h('span.g-truth', { dataset: { case: 'keep' } }, 'Say a number: “open two”'));
        handNone.hidden = inHand.length > 0;
        handList.hidden = inHand.length === 0;
        hand.dataset.count = String(inHand.length);
        rest.hidden = others.length === 0;
        // the band: every thing, reticled and numbered, left to right in the room's order; the ones at hand lit
        const lit = new Set(inHand.map((m) => m.c.id));
        clear(band, ...room.things.map((t) => {
          const card = everyCard.find((c) => c.id === t.id);
          const b = h(`button.bandret${lit.has(t.id) ? '.on' : ''}` as 'button', { type: 'button', dataset: { id: t.id, n: String(t.n).padStart(2, '0'), case: 'keep' }, 'aria-label': `${String(t.n).padStart(2, '0')} ${t.name}` },
            h('span.g-ret-frame', { 'aria-hidden': 'true' }), icon(def(t.id)?.icon ?? (t.id === 'deck' ? DECK_GLYPH : ORIGIN_ICON), 'ic bandglyph'), h('span.g-index', String(t.n).padStart(2, '0')));
          b.addEventListener('click', () => (card ? card.el.click() : openThing(t)));
          return b;
        }));
      };
      // the line under the title: his own (his school stage and rating, his next event and his city's weather, his
      // city, his latest project) where the phone has the reading, else the plain line; never a sample
      const paintSub = () => {
        const w = hubWords(a.id) || a.sub;
        if (sub.textContent !== w) sub.textContent = w;
        sub.dataset.personal = String(w !== a.sub);
      };
      const paintAll = () => {
        for (const c of everyCard) c.paint();
        paintSub();
        arrange();
      };
      let timer = 0;
      const paint = () => {
        drawn = '\0';
        paintAll();
        void Promise.all([...everyCard.map((c) => c.load()), loadHubWords(a.id)]).then(paintAll);
        clearInterval(timer);
        timer = window.setInterval(() => (ui.get().tab === hubId(a) && !document.hidden ? paintAll() : clearInterval(timer)), 3000);
      };
      recipeEvents.on('change', () => ui.get().tab === hubId(a) && paint());
      return {
        enter: paint,
        leave: () => clearInterval(timer),
        describe: () => `${a.title}: ${a.tabs.join(', ')}`,
        // (BRIEF-SHELL pass 1) a hub says which area it is and how much is in it
        context: () => screenSays(hubId(a), a.title, `the ${a.title.toLowerCase()} hub, ${areaTools(a).length} things to open`, { looking: a.title.toLowerCase() }),
      };
    },
  };
}

export const HUB_TABS: TabDef[] = AREAS.map(hubTab);

/** His FAVOURITES and his RECENT screens as the jump bar lists them (pins first; a recent that is pinned is not listed twice): ONE INK's Home reads the same. */
export function pinnedAndRecent(): { pinned: TabDef[]; lately: TabDef[] } {
  const pinned = favourites().map(def).filter((t): t is TabDef => !!t && !t.hub);
  const lately = recents.map(def).filter((t): t is TabDef => !!t && !t.hub && !pinned.includes(t)).slice(0, 4);
  return { pinned, lately };
}

// ---------- Search wears the same icons: a coloured square per result, recent screens when nothing is typed
const GROUP_TINT: Record<string, string> = { ASK: '#64d2ff', FLY: '#0a84ff', THEME: '#bf5af2', SYSTEM: '#8e8e93', EYE: '#0a84ff', MEDIA: '#ff375f', TOOLS: '#ff9f0a', GO: '#8e8e93' };
addPaletteDecor({
  look: (c: Command) => {
    const id = c.id.replace(/^(tab|open)_/, '');
    const t = /^(tab|open)_/.test(c.id) ? def(id) : undefined;
    return t ? { tint: tintOf(t.id), glyph: t.icon } : { tint: GROUP_TINT[c.group ?? ''] ?? '#8e8e93', glyph: null };
  },
  // FAVOURITES first (up to six, his order), then the last screens opened that are not already pinned: tap the search, tap the row
  recents: () => {
    const row = (t: TabDef, group: string) => ({ id: `tab_${t.id}`, title: toolName(t), group, run: () => void navTo(t.id, 'push') });
    const { pinned, lately } = pinnedAndRecent();
    return [...pinned.map((t) => row(t, 'FAVOURITES')), ...lately.map((t) => row(t, 'RECENT'))];
  },
  hold: (c, el) => pinOnHold(el, c.id.replace(/^tab_/, '')),
  // The Scan's jump bar (shell/jump.ts) and a number said or typed where he is (shell/inventory.ts): both only in the house
  jump,
  typed: (text) => {
    if (!houseOn()) return false;
    // "the plan" typed: the house unfolds (ONE INK has no label row to tap; the words are the way, as on every screen)
    if (/^(?:open |show |show me )?the (?:plan|house)$/i.test(text.trim())) {
      setTimeout(() => housePlan()?.open(), 0);
      return true;
    }
    const t = thingForNumber(text, ui.get().tab);
    if (!t) return false;
    openThing({ id: t.id, name: '', screen: t.screen, n: 0 });
    return true;
  },
});

// ---------- the "Me" sheet: the avatar's menu (iOS's account sheet); route C (mockups/c/settings.png):
// you, then the Status card first (three dials and four lines, all read from the brain and this phone),
// then the screens as grouped rows, then which build this is.
const DECK_GLYPH = '<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>';
const MEMORY_GLYPH = '<path d="M12 4.5c-1.2-1.3-3.6-1.4-4.8.1-1.3-.1-2.6 1-2.5 2.5C3.4 7.8 3 9.6 4 10.8c-.9 1.2-.6 3 .7 3.7-.2 1.6 1 3 2.6 2.9.6 1.5 2.6 2.1 3.9 1.1.3.1.5.1.8 0V4.5z"/><path d="M12 4.5c1.2-1.3 3.6-1.4 4.8.1 1.3-.1 2.6 1 2.5 2.5 1.3.7 1.7 2.5.7 3.7.9 1.2.6 3-.7 3.7.2 1.6-1 3-2.6 2.9-.6 1.5-2.6 2.1-3.9 1.1"/>';
const SETTINGS_GLYPH = '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>';
const SYSTEM_GLYPH = '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>';
const LINKS_GLYPH = '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>';
const GLYPHS: Record<string, string> = { memory: MEMORY_GLYPH, settings: SETTINGS_GLYPH, system: SYSTEM_GLYPH, links: LINKS_GLYPH, deck: DECK_GLYPH, origin: ORIGIN_ICON };
let sheet: HTMLElement | null = null;
/** What the Me sheet shows, for specs (window.__ghosty.me): the order of its parts and the dials' readings. */
export const meState = { parts: [] as string[], dials: {} as Record<string, string>, ok: '' };
export function openMe(openDeck: () => void): void {
  sheet?.remove();
  const s = settings.get();
  const close = () => {
    if (!sheet) return;
    offMood();
    offGuard();
    const el = sheet;
    sheet = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
    removeEventListener('keydown', esc);
  };
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const row = (id: string, label: string, sub: string, run: () => void) => {
    const r = listRow({ id, glyph: GLYPHS[id] ?? def(id)?.icon ?? '', title: label, sub, onClick: () => {
      close();
      run();
    } });
    r.classList.add('merow');
    return r;
  };
  // ---- Status: three dials (free AI today, the database today, the offline brain) and four lines
  const okLine = h('span.meok', { dataset: { tone: 'idle' } }, h('i'), h('span', 'Checking…'));
  const dials = statusDials();
  const lines = { mood: h('span.v.memood'), ghosty: h('span.v', '…'), self: h('span.v', '…'), phone: h('span.v', ownerKey.get() ? 'Paired with your owner key' : 'Signed in with Cloudflare Access'), version: h('span.v', '…') };
  // His mood (OWNER-ISSUES 70b, 63): a shape and the word, why and when — never colour alone (SMALL-GAPS L)
  const paintMood = () => {
    const m = mood.get().now;
    const w = moodWords(m);
    lines.mood.dataset.mood = m.kind;
    clear(lines.mood, moodShape(m.kind), h('b', w.word), ...(w.why ? [h('small', w.why)] : []));
  };
  paintMood();
  const offMood = mood.subscribe(paintMood);
  const status = h('section.rccard.mestatus', { dataset: { part: 'status' } },
    h('div.mesth', h('b', 'Status'), okLine),
    dials.el,
    h('div.merows',
      h('div.mer', h('span.k', 'Mood'), lines.mood),
      h('div.mer', h('span.k', 'Ghosty'), lines.ghosty),
      h('div.mer', h('span.k', 'Self-edit'), lines.self),
      h('div.mer', h('span.k', 'This phone'), lines.phone),
      h('div.mer', h('span.k', 'Version'), lines.version),
    ),
  );
  // [guardian] WATCHING OVER YOU (OWNER-ISSUES 55, 58): the places watched, the three feeds and when each was last looked at,
  // the named person and a walk under way, in his voice; a tap opens THREATS → NEAR HOME
  const gLine = h('p.megline', { dataset: { case: 'keep' } }, 'Checking…');
  const gRows = h('div.merows.megrows');
  const guard = h('button.rccard.meguard', { type: 'button', dataset: { part: 'guardian' }, 'aria-label': 'Watching over you: open NEAR HOME' }, h('div.mesth', h('b', 'Watching over you')), gLine, gRows);
  guard.addEventListener('click', () => {
    close();
    goToPanel('threats', 'NEAR HOME');
  });
  const paintGuard = (info: GuardianInfo | null) => {
    if (!info) return;
    gLine.textContent = watchLine(info);
    const feeds = (['flood', 'weather', 'crime'] as const).map((f) => `${FEED_NAMES[f].source.replace('Environment Agency', 'Floods').replace('Met Office', 'Weather').replace('police.uk', 'Crime')} ${info.failed[f] ? 'unreachable' : info.checked[f] ? clockIn(info.checked[f]!, info.tz) : '—'}`);
    const per = info.person;
    const w = info.walk && info.walk.stage !== 'done' ? info.walk : null;
    clear(gRows,
      h('div.mer', h('span.k', 'Feeds'), h('span.v', feeds.join(' · '))),
      h('div.mer', h('span.k', 'Named person'), h('span.v', per ? `${per.name}${per.via ? ` · ${per.via === 'telegram' ? 'Telegram' : 'email'}` : ' · not reachable yet'}` : 'Nobody yet (Settings → GUARDIAN)')),
      ...(w ? [h('div.mer', h('span.k', 'Walk home'), h('span.v', w.stage === 'walking' ? `Under way · I ask at ${clockIn(w.eta, info.tz)}` : w.stage === 'alerted' ? 'No answer: your named person was messaged' : 'I asked “Home?”'))] : []),
    );
  };
  paintGuard(guardian.get().info);
  const offGuard = guardian.subscribe((st) => paintGuard(st.info));
  void loadGuardian();
  const build = h('p.mebuild', `Ghosty ${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at)).replace(/^(\d+)m ago$/, '$1 minutes ago').replace(/^(\d+)h ago$/, '$1 hours ago').replace(/^(\d+)d ago$/, '$1 days ago')}` : ''}`);
  const box = h('div.mebox', { role: 'dialog', 'aria-label': 'Me' },
    h('i.megrab', { 'aria-hidden': 'true' }),
    h('div.mehead', { dataset: { part: 'head' } },
      h('span.meav', (s.name.trim()[0] ?? 'B').toUpperCase()),
      h('span.mertxt', h('b', { dataset: { case: 'keep' } }, s.name), h('small', `${THEMES[s.theme]?.label ?? 'Ghosty'} · ${s.units === 'metric' ? '°C, km' : '°F, miles'}`)),
      h('button.meclose', { type: 'button', 'aria-label': 'Close', onclick: close }, icon('<path d="M7 7l10 10M17 7L7 17"/>')),
    ),
    // (the cards and the rows from their lists, shell/areadefs.ts: the ABILITIES catalogue reads the same ones)
    ...ME_CARDS.map((c) => ({ status, guardian: guard })[c.id]),
    ...(['screens', 'more'] as const).map((g) => h('div.megroup.rcgroup', { dataset: { part: g } },
      ...ME_ROWS.filter((r) => r.group === g).map((r) => row(r.id, r.label, r.sub, r.id === 'deck' ? openDeck : r.id === 'origin' ? openOrigin : () => navTo(r.id, 'push'))))),
    build,
  );
  sheet = h('div#mesheet', box);
  sheet.addEventListener('click', (e) => e.target === sheet && close());
  addEventListener('keydown', esc);
  document.body.append(sheet);
  meState.parts = [...box.querySelectorAll<HTMLElement>('[data-part]')].map((x) => x.dataset.part!);
  meState.dials = {};
  // ---- the readings (each says when it has none)
  void (async () => {
    const st = await brain.status().catch(() => null);
    const tones = await dials.paint(st);
    meState.dials = dials.read();
    lines.ghosty.replaceChildren(...(st ? [h('i'), 'Connected'] : ['Can’t be reached right now']));
    lines.ghosty.dataset.tone = st ? 'live' : 'warn';
    lines.self.textContent = st?.repoReady ? 'On' : st ? 'Off' : '—';
    let newer = false;
    if (st && /^[0-9a-f]{40}$/.test(BUILD.sha)) {
      const c = await brain.changes().catch(() => null);
      const latest = c?.versions[0];
      newer = !!latest && latest.sha !== BUILD.sha && Date.parse(latest.date) > Date.parse(BUILD.at || '0');
      lines.version.textContent = !c ? 'Can’t check now' : newer ? 'A newer version is ready' : 'Up to date';
    } else lines.version.textContent = /^[0-9a-f]{7,40}$/.test(BUILD.sha) ? 'Can’t check now' : 'Local build';
    const ok = !!st && !tones.includes('warn') && !newer;
    okLine.dataset.tone = ok ? 'live' : 'warn';
    (okLine.lastChild as HTMLElement).textContent = !st ? 'Brain offline' : ok ? 'All good' : 'Needs a look';
    meState.ok = (okLine.lastChild as HTMLElement).textContent ?? '';
  })();
}

/**
 * The tab bar: six areas in a frosted capsule (LIFE joined between Plan and Me on 1 Nov: BRIEF-TABS 1); the avatar ("Me")
 * sits at the top right of the navigation bar, so the seven areas are all one tap away.
 */
export function buildTabBar(dock: HTMLElement, openDeck: () => void): () => void {
  const cap = h('div.tabcap', { role: 'tablist' });
  for (const a of AREAS.filter((x) => x.id !== 'me')) {
    // data-id is the area's main tab, so hooks that look for #dock button[data-id="core"] or the agenda badge still find it.
    // The glyph sits in a small ring of MIND's light (lit on the tab he is in, flared on touch), with a live dot when
    // something runs in that area right now (liveIn below).
    const b = h('button', { type: 'button', role: 'tab', dataset: { id: a.id === 'ask' ? 'core' : a.tabs[0]!, area: a.id }, title: a.title }, h('i.gi', h('i.halo'), icon(a.icon), h('i.live')), h('span', a.title));
    b.addEventListener('click', () => {
      // the lift that ends a long press is not a tap
      if (held) return void (held = false);
      sw.close();
      tap(a);
    });
    b.addEventListener('pointerdown', (e) => holdTab(e, a, b));
    cap.append(b);
  }
  // ---- the quick switcher (shell/switcher.ts): hold a tab, its tools fan out above the bar; slide onto one and let go
  const sw = buildSwitcher();
  // under the tab bar (the held tab stays lit above the dimmed page), over everything else
  dock.before(sw.el);
  let hold = 0;
  let held = false;
  let at = { x: 0, y: 0, id: -1, t: 0 };
  const holdTab = (e: PointerEvent, a: Area, b: HTMLElement) => {
    if (e.button > 0) return;
    held = false;
    clearTimeout(hold);
    sw.close();
    at = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.timeStamp };
    hold = window.setTimeout(() => {
      hold = 0;
      held = true;
      // ONE INK's foot: the eye (the Home key) held unfolds the plan (BRIEF-ONE-INK); the other keys fan their tools out as ever
      if (footOn() && a.id === 'ask') return void housePlan()?.open();
      sw.open(b, a.title, switchItems(a));
    }, HOLD_MS);
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== at.id) return;
    // a finger that wanders off before the hold is not a long press
    if (hold && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 14) {
      clearTimeout(hold);
      hold = 0;
    }
    if (held) sw.hover(e.clientX, e.clientY);
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerId !== at.id) return;
    clearTimeout(hold);
    hold = 0;
    at.id = -1;
    // lifted sooner than the hold by the finger's own clock (a busy phone can run the timer late): a tap after all
    if (held && e.timeStamp - at.t < HOLD_MS) {
      held = false;
      sw.close();
      return;
    }
    if (held) sw.release(e.clientX, e.clientY);
    // (the click that follows, when the lift is on the tab itself, clears `held`)
    if (held) setTimeout(() => (held = false), 0);
  });
  addEventListener('pointercancel', (e) => {
    if (e.pointerId !== at.id) return;
    clearTimeout(hold);
    hold = 0;
    at.id = -1;
    held = false;
    sw.close();
  });
  // (a long press is never the phone's own menu)
  cap.addEventListener('contextmenu', (e) => e.preventDefault());
  const you = h('button.you', { type: 'button', dataset: { area: 'me' }, title: 'Me', 'aria-label': 'Me: memory, settings and system' }, h('span.av'));
  you.addEventListener('click', () => {
    if (press === -1) return void (press = 0);
    openMe(openDeck);
  });
  // the Me sheet as a command too: ABILITIES' TRY IT opens it for what lives there (his mood, the Status card, WATCHING OVER YOU)
  register({ id: 'open_me', title: 'Me', hidden: true, run: () => openMe(openDeck) });
  // a long press on the avatar opens every screen at once (the home-screen grid)
  let press = 0;
  you.addEventListener('pointerdown', () => (press = window.setTimeout(() => ((press = -1), openDeck()), 550)));
  // A touch that becomes a scroll (pointercancel) or slides off the avatar is not a long press either.
  const letGo = () => {
    if (press > 0) {
      clearTimeout(press);
      press = 0;
    }
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) you.addEventListener(ev, letGo);
  clear(dock, h('div.tabblur', { 'aria-hidden': 'true' }), cap);
  document.querySelector('#top .cmd')?.after(you);
  const tap = (a: Area) => {
    const cur = ui.get().tab;
    const inside = areaOf(cur) === a;
    // ASK: the reactor; tapped again there, the Ask hub (the briefing lives there).
    if (a.id === 'ask') return void (cur === 'core' ? navTo(hubId(a), 'push') : navTo('core', inside ? 'pop' : 'switch'));
    // In the area already: back to its hub, as iOS pops to the root; else to the area.
    if (cur !== hubId(a)) navTo(hubId(a), inside ? 'pop' : 'switch');
  };
  const paint = () => {
    const a = areaOf(ui.get().tab);
    for (const b of dock.querySelectorAll<HTMLElement>('button[data-area]')) {
      b.classList.toggle('on', b.dataset.area === a?.id);
      b.setAttribute('aria-selected', String(b.dataset.area === a?.id));
    }
    you.classList.toggle('on', a?.id === 'me');
    (you.firstChild as HTMLElement).textContent = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
    paintLive();
  };
  // The live dots: what is running now, on the area it belongs to (read from the same state the hubs read).
  const paintLive = () => {
    const now = liveIn();
    for (const b of dock.querySelectorAll<HTMLElement>('button[data-area]')) {
      const why = now[b.dataset.area ?? ''] ?? '';
      b.classList.toggle('live', !!why);
      const area = AREAS.find((x) => x.id === b.dataset.area);
      b.title = why ? `${area?.title ?? ''} · ${why}` : area?.title ?? '';
    }
    you.classList.toggle('live', !!now.me);
    you.title = now.me ? `Me · ${now.me}` : 'Me';
  };
  ui.subscribe(paintLive);
  offlineBrain.subscribe(paintLive);
  setInterval(() => !document.hidden && paintLive(), 1500);
  paint();
  return paint;
}

/** An area's tools for the switcher's arc: the lit ones (live or training now) first, then in the hub's order. */
function switchItems(a: Area): SwitchItem[] {
  const list = areaTools(a).map(([id, name, glyph, t, tap]) => {
    const c = CARDS[id];
    const status = t?.status?.() ?? c?.status() ?? 'READY';
    const r = (t?.readouts ?? c?.readouts)?.()[0];
    let drawn: Element | null = null;
    try {
      drawn = (t?.instrument ?? c?.instrument)?.() ?? null;
    } catch {
      drawn = null;
    }
    const line = c ? (typeof c.title === 'function' ? c.title() : c.title) : name;
    // a bare number says what it counts ("19,489 passages", "0 levels"); words and units read as they are
    const reading = !r ? '' : r.value == null ? r.none ?? 'Not yet' : r.unit ? `${r.value} ${r.unit}` : /^[\d,.]+$/.test(r.value) ? `${r.value} ${r.label.toLowerCase()}` : r.value;
    return { id, name, glyph, status, instrument: drawn, reading, line, open: tap };
  });
  const lit = (x: SwitchItem) => x.status === 'LIVE' || x.status === 'TRAINING';
  return [...list.filter(lit), ...list.filter((x) => !lit(x))];
}

/**
 * What runs right now, by area (the tab bar's live dots): a reply being worked out (Ask), the GYM training or a paper
 * being sat (Learn), a reverse report running (Make), the offline brain downloading (Me, on the avatar).
 */
export function liveIn(): Record<string, string> {
  const out: Record<string, string> = {};
  if (ui.get().busy) out.ask = 'I am working on an answer';
  if (gymState.training || gymControl?.allOn()) out.learn = 'the GYM is training';
  else if (schoolState.sitting) out.learn = 'I am sitting a paper';
  if (hubFacts.reverse?.some((j) => j.status === 'running' || j.status === 'queued')) out.make = 'a reverse report is running';
  if (offlineBrain.get().busy === 'download') out.me = 'the offline brain is downloading';
  return out;
}

/** "Good evening, Boss": the reactor screen's large title. */
export function greeting(d = new Date()): string {
  const hr = d.getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${settings.get().name}`;
}

/**
 * The navigation bar for a tab. Roots (the reactor, the hubs, Memory and Settings
 * from the Me sheet) have a large title and no back button; every other screen has
 * "‹ <where it came from>" and its name.
 */
export function navInfo(tab: string): { back: string; backTo: string; title: string } | null {
  const a = areaOf(tab);
  const t = def(tab);
  if (!t) return null;
  if (tab === 'core') return { back: '', backTo: '', title: greeting() };
  if (isHub(tab)) return { back: '', backTo: '', title: a?.title ?? t.title };
  // (SOCIAL, from the Me sheet's row since 1 Nov, is a root like Settings: Me's screens are the Me sheet's rows)
  // (in The Scan the house has ME as a room, and these are things in it: the way back is ‹ ME, to the room)
  if (tab === 'memory' || tab === 'settings' || tab === 'social') return houseOn() ? { back: 'Me', backTo: 'area-me', title: niceCase(t.title) } : { back: '', backTo: '', title: niceCase(t.title) };
  // (THE LOOK, the design system's own screen, is a row of Settings like SYSTEM and LINKS: BRIEF-DESIGN-SYSTEM 5)
  if (tab === 'system' || tab === 'links' || tab === 'look') return { back: 'Settings', backTo: 'settings', title: niceCase(t.title) };
  // (THE READER is a book from the Library's Shelf: back is the Library, two taps from Learn: BRIEF-LIBRARY-READER)
  if (tab === 'reader') return { back: 'Library', backTo: 'library', title: 'Reader' };
  return { back: a?.title ?? 'Home', backTo: a ? hubId(a) : 'core', title: ALIAS[t.id] ?? t.title };
}
