/**
 * The six areas of the calm looks (Graphite, Reactor): ASK · SEE · MAKE · LEARN · PLAN · ME.
 * Every tab belongs to one area. The tab bar shows the first five plus a round "you" button
 * (ME); an area opens on its hub: a large title, the command bar, recent screens and its tools.
 * Every tab keeps its own id and hash (#gym still opens the GYM); hubs are tabs too (#area-learn).
 * The classic looks keep the old dock and never see any of this.
 */
import { togglePalette } from '../commands/registry';
import { clear, h, icon } from '../core/dom';
import { settings, ui } from '../state/app';
import { go, tabs, type TabDef } from './tabs';
import { niceCase } from '../ui/components';

export interface Area {
  id: string;
  title: string;
  /** One line under the hub's title. */
  sub: string;
  icon: string;
  /** Its tabs, in order; the first is where the tab bar goes when the area has no hub (ASK → the reactor). */
  tabs: string[];
  /** iOS system colour for its tools' icon squares. */
  tint: string;
}

export const AREAS: Area[] = [
  { id: 'ask', title: 'Ask', sub: 'Talk to Ghosty, or get the day in one look.', icon: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>', tabs: ['core', 'brief'], tint: '#3fc3ff' },
  { id: 'see', title: 'See', sub: 'The world live, and the camera that understands it.', icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>', tabs: ['eye', 'lens'], tint: '#0a84ff' },
  { id: 'make', title: 'Make', sub: 'Build, take apart and plan real things.', icon: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>', tabs: ['studio', 'workshop', 'reverse', 'space'], tint: '#ff9f0a' },
  { id: 'learn', title: 'Learn', sub: 'Courses for you, games and a library for him.', icon: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2M21.5 9.5v5"/>', tabs: ['learn', 'gym', 'library'], tint: '#30d158' },
  { id: 'plan', title: 'Plan', sub: 'Your days, the markets, the world’s alerts and the radio.', icon: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>', tabs: ['agenda', 'markets', 'threats', 'radio'], tint: '#ff375f' },
  { id: 'me', title: 'Me', sub: 'What Ghosty knows, how he looks and what he is linked to.', icon: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>', tabs: ['memory', 'settings', 'system', 'links'], tint: '#8e8e93' },
];

const hubId = (a: Area) => `area-${a.id}`;
export const areaOf = (tab: string): Area | undefined => AREAS.find((a) => a.tabs.includes(tab) || hubId(a) === tab);
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
const ALIAS: Record<string, string> = { learn: 'Courses' };
export const toolName = (t: TabDef) => ALIAS[t.id] ?? niceCase(t.title);

/** A tool's tile: the tab's own glyph in a tinted squircle, its name and what it is for. */
function tile(t: TabDef, a: Area, cls = 'hubtile'): HTMLElement {
  return h(`button.${cls}` as 'button', { type: 'button', dataset: { id: t.id }, style: `--tint:${a.tint}`, onclick: () => navTo(t.id, 'push') },
    h('span.sq', icon(t.icon)),
    h('b', toolName(t)),
    cls === 'hubtile' ? h('small', t.blurb ?? '') : null,
  );
}

/** ASK's third tool: talk by voice — the reactor screen, listening. */
function voiceTile(a: Area): HTMLElement {
  return h('button.hubtile', { type: 'button', style: `--tint:${a.tint}`, onclick: () => {
    navTo('core', 'pop');
    setTimeout(() => document.querySelector<HTMLButtonElement>('#mic')?.click(), 350);
  } },
    h('span.sq', icon('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>')),
    h('b', 'Voice'),
    h('small', 'talk and he answers out loud'),
  );
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
      const recentRow = h('div.hubrecent');
      const recentBox = h('section.hubsec', h('h2', 'Recent'), recentRow);
      const grid = h('div.hubgrid');
      const wrap = h('div.hub', { style: `--tint:${a.tint}` },
        h('p.hubsub', a.sub),
        h('button.cmdbar', { type: 'button', onclick: togglePalette, 'aria-label': 'Ask or jump anywhere' }, icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'), h('span', 'Ask or jump anywhere')),
        h('section.hubsec', h('h2', 'Tools'), grid),
        recentBox,
      );
      root.append(wrap);
      const paint = () => {
        clear(grid, ...a.tabs.map(def).filter((t): t is TabDef => !!t).map((t) => tile(t, a)), a.id === 'ask' ? voiceTile(a) : null);
        // recent screens of this area only
        const rec = recents.filter((id) => a.tabs.includes(id)).map(def).filter((t): t is TabDef => !!t).slice(0, 6);
        recentBox.hidden = !rec.length;
        clear(recentRow, ...rec.map((t) => tile(t, areaOf(t.id) ?? a, 'recent')));
      };
      return { enter: paint, describe: () => `${a.title}: ${a.tabs.join(', ')}` };
    },
  };
}

export const HUB_TABS: TabDef[] = AREAS.map(hubTab);

/** The calm looks' tab bar: a frosted capsule with five areas, and a round "you" button for ME. */
export function buildTabBar(dock: HTMLElement, openDeck: () => void): () => void {
  const cap = h('div.tabcap', { role: 'tablist' });
  for (const a of AREAS.slice(0, 5)) {
    // data-id is the area's main tab, so hooks that look for #dock button[data-id="core"] or the agenda badge still find it.
    const b = h('button', { type: 'button', role: 'tab', dataset: { id: a.id === 'ask' ? 'core' : a.tabs[0]!, area: a.id }, title: a.title }, icon(a.icon), h('span', a.title));
    b.addEventListener('click', () => tap(a));
    cap.append(b);
  }
  const me = AREAS[5]!;
  const you = h('button.you', { type: 'button', dataset: { id: 'memory', area: 'me' }, title: 'Me', 'aria-label': 'Me' }, h('span.av'));
  you.addEventListener('click', () => tap(me));
  // a long press on "you" opens every screen at once (the home-screen grid)
  let press = 0;
  you.addEventListener('pointerdown', () => (press = window.setTimeout(() => ((press = -1), openDeck()), 550)));
  you.addEventListener('pointerup', () => press > 0 && clearTimeout(press));
  clear(dock, cap);
  // "you" sits at the top right of the navigation bar (iOS's account button), not beside the tab bar
  document.querySelector('#top .cmd')?.after(you);
  const tap = (a: Area) => {
    if (press === -1) return void (press = 0);
    const cur = ui.get().tab;
    const inside = areaOf(cur) === a;
    // ASK: the reactor; tapped again there, the Ask hub (the briefing lives there).
    if (a.id === 'ask') return void (cur === 'core' ? navTo(hubId(a), 'push') : navTo('core', inside ? 'pop' : 'switch'));
    // In the area already: back to its hub, as iOS pops to the root; else to the area.
    if (cur !== hubId(a)) navTo(hubId(a), inside ? 'pop' : 'switch');
  };
  const paint = () => {
    const a = areaOf(ui.get().tab);
    for (const b of dock.querySelectorAll<HTMLElement>('button[data-area]')) b.classList.toggle('on', b.dataset.area === a?.id);
    (you.firstChild as HTMLElement).textContent = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
  };
  paint();
  return paint;
}

/** The calm looks' navigation bar: back to the area ("‹ Learn") and where you are, as a large title. */
export function navInfo(tab: string): { back: string; backTo: string; title: string } | null {
  const a = areaOf(tab);
  const t = def(tab);
  if (!t) return null;
  if (tab === 'core') return null;
  if (isHub(tab)) return { back: '', backTo: '', title: a?.title ?? t.title };
  return { back: a?.title ?? 'Home', backTo: a ? hubId(a) : 'core', title: ALIAS[t.id] ?? t.title };
}
