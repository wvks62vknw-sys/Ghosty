/**
 * The areas of the calm looks (Graphite, Reactor): ASK · SEE · MAKE · LEARN · PLAN, and ME.
 * Every tab belongs to one area. The tab bar shows the five; ME is the avatar at the top right,
 * which opens the "Me" sheet (Memory, Settings, System, Links, every screen). An area opens on
 * its hub: a large title, a hero "continue" card, its tools and the recent screens.
 * Every tab keeps its own id and hash (#gym still opens the GYM); hubs are tabs too (#area-learn).
 * The classic looks keep the old dock and never see any of this.
 */
import { addPaletteDecor, togglePalette, type Command } from '../commands/registry';
import { clear, fmt, h, icon } from '../core/dom';
import { brain, ownerKey } from '../api/brain';
import { BUILD } from '../state/build';
import { statusDials } from '../ui/statusdials';
import { settings, ui } from '../state/app';
import { THEMES } from '../state/theme';
import { go, tabs, type TabDef } from './tabs';
import { listRow, niceCase } from '../ui/components';

export interface Area {
  id: string;
  title: string;
  /** One line under the hub's title. */
  sub: string;
  icon: string;
  /** Its tabs, in order; the first is where the tab bar goes when the area has no hub (ASK → the reactor). */
  tabs: string[];
  /** The area's own colour (its tab-bar glyph never uses it: tools are coloured by what they do, see TINT). */
  tint: string;
}

export const AREAS: Area[] = [
  { id: 'ask', title: 'Ask', sub: 'Talk to Ghosty, or get the day in one look.', icon: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>', tabs: ['core', 'brief'], tint: '#3fc3ff' },
  { id: 'see', title: 'See', sub: 'The world live, and the camera that understands it.', icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>', tabs: ['eye', 'lens'], tint: '#0a84ff' },
  { id: 'make', title: 'Make', sub: 'Build, take apart and plan real things.', icon: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>', tabs: ['studio', 'workshop', 'reverse', 'space'], tint: '#ff9f0a' },
  { id: 'learn', title: 'Learn', sub: 'Courses for you, games and a library for him.', icon: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2M21.5 9.5v5"/>', tabs: ['learn', 'gym', 'school', 'library'], tint: '#30d158' },
  { id: 'plan', title: 'Plan', sub: 'Your days, the markets, the world’s alerts and the radio.', icon: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>', tabs: ['agenda', 'markets', 'threats', 'radio'], tint: '#ff375f' },
  { id: 'me', title: 'Me', sub: 'What Ghosty knows, how he looks and what he is linked to.', icon: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>', tabs: ['memory', 'settings', 'system', 'links'], tint: '#8e8e93' },
];

/**
 * The old per-tool colours. The one icon language (OWNER-ISSUES 32) no longer draws them: every glyph is a bare
 * thin line in the secondary ink, the accent only for the live or selected one (styles.css "icon language").
 * Kept for the callers that still pass a colour along (Search's decor).
 */
export const TINT: Record<string, string> = {
  core: '#64d2ff', brief: '#5e5ce6', eye: '#0a84ff', lens: '#bf5af2',
  studio: '#ff9f0a', workshop: '#8e8e93', reverse: '#40c8e0', space: '#ac8e68',
  learn: '#30d158', gym: '#ff375f', school: '#ffd60a', library: '#a2845e',
  agenda: '#ff453a', markets: '#00c7be', threats: '#ffd60a', radio: '#ff6482',
  memory: '#5ac8fa', settings: '#8e8e93', system: '#98989d', links: '#0a84ff',
};
export const tintOf = (id: string) => TINT[id] ?? '#8e8e93';

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

/** A tool's glyph: a bare thin line, no tile behind it (the id is kept so callers need not change). */
export const squircle = (_id: string, glyph: string, cls = 'sq') => h(`span.${cls}` as 'span', icon(glyph));

/** A tool's tile: its glyph square, its name and what it is for. */
function tile(t: TabDef, cls = 'hubtile', note = ''): HTMLElement {
  return h(`button.${cls}` as 'button', { type: 'button', dataset: { id: t.id }, onclick: () => navTo(t.id, 'push') },
    squircle(t.id, t.icon),
    cls === 'hubhero' ? h('small.hubkick', note || 'Continue') : null,
    h('b', toolName(t)),
    cls !== 'recent' ? h('small', t.blurb ?? '') : null,
  );
}

/** ASK's third tool: talk by voice — the reactor screen, listening. */
function voiceTile(): HTMLElement {
  return h('button.hubtile', { type: 'button', onclick: () => {
    navTo('core', 'pop');
    setTimeout(() => document.querySelector<HTMLButtonElement>('#mic')?.click(), 350);
  } },
    squircle('core', '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'),
    h('b', 'Voice'),
    h('small', 'Talk, and he answers out loud'),
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
      const wrap = h('div.hub',
        h('p.hubsub', a.sub),
        h('button.cmdbar', { type: 'button', onclick: togglePalette, 'aria-label': 'Ask or jump anywhere' }, icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'), h('span', 'Ask or jump anywhere')),
        h('section.hubsec', h('h2', 'Tools'), grid),
        recentBox,
      );
      root.append(wrap);
      const paint = () => {
        const list = a.tabs.map(def).filter((t): t is TabDef => !!t);
        // An odd number of tools: the one used last (or the first) leads as a full-width "Continue" card.
        const tiles: HTMLElement[] = list.map((t) => tile(t));
        if (a.id === 'ask') tiles.push(voiceTile());
        if (tiles.length % 2) {
          const last = recents.find((id) => a.tabs.includes(id));
          const lead = list.find((t) => t.id === last) ?? list[0]!;
          const i = list.indexOf(lead);
          tiles.splice(i, 1);
          tiles.unshift(tile(lead, 'hubhero', last ? 'Continue' : 'Start here'));
        }
        clear(grid, ...tiles);
        // recent screens of this area: shown once there are a few
        const rec = recents.filter((id) => a.tabs.includes(id)).map(def).filter((t): t is TabDef => !!t).slice(0, 6);
        recentBox.hidden = rec.length < 3;
        clear(recentRow, ...rec.map((t) => tile(t, 'recent')));
      };
      return { enter: paint, describe: () => `${a.title}: ${a.tabs.join(', ')}` };
    },
  };
}

export const HUB_TABS: TabDef[] = AREAS.map(hubTab);

// ---------- Search wears the same icons: a coloured square per result, recent screens when nothing is typed
const GROUP_TINT: Record<string, string> = { ASK: '#64d2ff', FLY: '#0a84ff', THEME: '#bf5af2', SYSTEM: '#8e8e93', EYE: '#0a84ff', MEDIA: '#ff375f', TOOLS: '#ff9f0a', GO: '#8e8e93' };
addPaletteDecor({
  look: (c: Command) => {
    const id = c.id.replace(/^(tab|open)_/, '');
    const t = /^(tab|open)_/.test(c.id) ? def(id) : undefined;
    return t ? { tint: tintOf(t.id), glyph: t.icon } : { tint: GROUP_TINT[c.group ?? ''] ?? '#8e8e93', glyph: null };
  },
  recents: () =>
    recents.slice(0, 4).map(def).filter((t): t is TabDef => !!t && !t.hub).map((t) => ({ id: `tab_${t.id}`, title: toolName(t), group: 'RECENT', run: () => void navTo(t.id, 'push') })),
});

// ---------- the "Me" sheet: the avatar's menu (iOS's account sheet); route C (mockups/c/settings.png):
// you, then the Status card first (three dials and four lines, all read from the brain and this phone),
// then the screens as grouped rows, then which build this is.
const ME_ROWS: [string, string, string][] = [
  ['memory', 'Memory', 'What I know about you'],
  ['settings', 'Settings', 'Look, voice, home and about'],
  ['system', 'System', 'Keys, models, storage and backups'],
];
const DECK_GLYPH = '<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>';
const MEMORY_GLYPH = '<path d="M12 4.5c-1.2-1.3-3.6-1.4-4.8.1-1.3-.1-2.6 1-2.5 2.5C3.4 7.8 3 9.6 4 10.8c-.9 1.2-.6 3 .7 3.7-.2 1.6 1 3 2.6 2.9.6 1.5 2.6 2.1 3.9 1.1.3.1.5.1.8 0V4.5z"/><path d="M12 4.5c1.2-1.3 3.6-1.4 4.8.1 1.3-.1 2.6 1 2.5 2.5 1.3.7 1.7 2.5.7 3.7.9 1.2.6 3-.7 3.7.2 1.6-1 3-2.6 2.9-.6 1.5-2.6 2.1-3.9 1.1"/>';
const SETTINGS_GLYPH = '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>';
const SYSTEM_GLYPH = '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>';
const LINKS_GLYPH = '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>';
const GLYPHS: Record<string, string> = { memory: MEMORY_GLYPH, settings: SETTINGS_GLYPH, system: SYSTEM_GLYPH, links: LINKS_GLYPH, deck: DECK_GLYPH };
let sheet: HTMLElement | null = null;
/** What the Me sheet shows, for specs (window.__ghosty.me): the order of its parts and the dials' readings. */
export const meState = { parts: [] as string[], dials: {} as Record<string, string>, ok: '' };
export function openMe(openDeck: () => void): void {
  sheet?.remove();
  const s = settings.get();
  const close = () => {
    if (!sheet) return;
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
  const lines = { ghosty: h('span.v', '…'), self: h('span.v', '…'), phone: h('span.v', ownerKey.get() ? 'Paired with your owner key' : 'Signed in with Cloudflare Access'), version: h('span.v', '…') };
  const status = h('section.rccard.mestatus', { dataset: { part: 'status' } },
    h('div.mesth', h('b', 'Status'), okLine),
    dials.el,
    h('div.merows',
      h('div.mer', h('span.k', 'Ghosty'), lines.ghosty),
      h('div.mer', h('span.k', 'Self-edit'), lines.self),
      h('div.mer', h('span.k', 'This phone'), lines.phone),
      h('div.mer', h('span.k', 'Version'), lines.version),
    ),
  );
  const build = h('p.mebuild', `Ghosty ${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at)).replace(/^(\d+)m ago$/, '$1 minutes ago').replace(/^(\d+)h ago$/, '$1 hours ago').replace(/^(\d+)d ago$/, '$1 days ago')}` : ''}`);
  const box = h('div.mebox', { role: 'dialog', 'aria-label': 'Me' },
    h('i.megrab', { 'aria-hidden': 'true' }),
    h('div.mehead', { dataset: { part: 'head' } },
      h('span.meav', (s.name.trim()[0] ?? 'B').toUpperCase()),
      h('span.mertxt', h('b', { dataset: { case: 'keep' } }, s.name), h('small', `${THEMES[s.theme]?.label ?? 'Ghosty'} · ${s.units === 'metric' ? '°C, km' : '°F, miles'}`)),
      h('button.meclose', { type: 'button', 'aria-label': 'Close', onclick: close }, icon('<path d="M7 7l10 10M17 7L7 17"/>')),
    ),
    status,
    h('div.megroup.rcgroup', { dataset: { part: 'screens' } }, ...ME_ROWS.map(([id, label, sub]) => row(id, label, sub, () => navTo(id, 'push')))),
    h('div.megroup.rcgroup', { dataset: { part: 'more' } },
      row('links', 'Links', 'Email, Spotify and your phone', () => navTo('links', 'push')),
      row('deck', 'Every screen', 'All of Ghosty at once', openDeck),
    ),
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

/** The calm looks' tab bar: five areas in a frosted capsule; the avatar ("Me") sits at the top right of the navigation bar. */
export function buildTabBar(dock: HTMLElement, openDeck: () => void): () => void {
  const cap = h('div.tabcap', { role: 'tablist' });
  for (const a of AREAS.slice(0, 5)) {
    // data-id is the area's main tab, so hooks that look for #dock button[data-id="core"] or the agenda badge still find it.
    const b = h('button', { type: 'button', role: 'tab', dataset: { id: a.id === 'ask' ? 'core' : a.tabs[0]!, area: a.id }, title: a.title }, icon(a.icon), h('span', a.title));
    b.addEventListener('click', () => tap(a));
    cap.append(b);
  }
  const you = h('button.you', { type: 'button', dataset: { area: 'me' }, title: 'Me', 'aria-label': 'Me: memory, settings and system' }, h('span.av'));
  you.addEventListener('click', () => {
    if (press === -1) return void (press = 0);
    openMe(openDeck);
  });
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
    for (const b of dock.querySelectorAll<HTMLElement>('button[data-area]')) b.classList.toggle('on', b.dataset.area === a?.id);
    you.classList.toggle('on', a?.id === 'me');
    (you.firstChild as HTMLElement).textContent = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
  };
  paint();
  return paint;
}

/** "Good evening, Boss": the reactor screen's large title. */
export function greeting(d = new Date()): string {
  const hr = d.getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${settings.get().name}`;
}

/**
 * The calm looks' navigation bar for a tab. Roots (the reactor, the hubs, Memory and Settings
 * from the Me sheet) have a large title and no back button; every other screen has
 * "‹ <where it came from>" and its name.
 */
export function navInfo(tab: string): { back: string; backTo: string; title: string } | null {
  const a = areaOf(tab);
  const t = def(tab);
  if (!t) return null;
  if (tab === 'core') return { back: '', backTo: '', title: greeting() };
  if (isHub(tab)) return { back: '', backTo: '', title: a?.title ?? t.title };
  if (tab === 'memory' || tab === 'settings') return { back: '', backTo: '', title: niceCase(t.title) };
  if (tab === 'system' || tab === 'links') return { back: 'Settings', backTo: 'settings', title: niceCase(t.title) };
  return { back: a?.title ?? 'Home', backTo: a ? hubId(a) : 'core', title: ALIAS[t.id] ?? t.title };
}
