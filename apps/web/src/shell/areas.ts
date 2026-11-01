/**
 * The areas: ASK · SEE · MAKE · LEARN · PLAN, and ME.
 * Every tab belongs to one area. The tab bar shows the five; ME is the avatar at the top right,
 * which opens the "Me" sheet (Memory, Settings, System, Links, every screen). An area opens on
 * its hub: a large title and its tools as instrument cards (shell/hubcards.ts), on one screen with nothing to scroll
 * (six at most; any more in a More row); the recent screens are in Search.
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
import { listRow, niceCase } from '../ui/components';
import { ensureDefs } from '../ui/instruments';
import { CARDS, hubFacts, hubWords, loadHubWords } from './hubcards';
import { buildSwitcher, HOLD_MS, type SwitchItem } from './switcher';
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
  core: '#64d2ff', brief: '#5e5ce6', eye: '#0a84ff', lens: '#bf5af2',
  studio: '#ff9f0a', workshop: '#8e8e93', reverse: '#40c8e0', space: '#ac8e68', workbench: '#ffb340',
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
function toolCard(id: string, name: string, glyph: string, t: TabDef | null, onTap: () => void): { el: HTMLElement; paint(): void; load(): Promise<unknown> } {
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
  const el = h('button.hubtile.inst', { type: 'button', dataset: { id, case: 'keep' }, onclick: onTap },
    ins,
    h('span.kick', icon(glyph), h('span.nm', name), word),
    title, reads, why, line,
  );
  let insKey: Element | null = null;
  const paint = () => {
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
    clear(reads, ...rs.map((r) => h(`span.rd${r.live && r.value != null ? '.lv' : ''}${r.value == null ? '.none' : ''}` as 'span',
      h('em', r.label),
      h('b.tnum', r.value ?? r.none ?? 'Not yet', r.value != null && r.unit ? h('small', r.unit) : null))));
    const w = rs.some((r) => r.value == null) ? c.why?.() ?? '' : '';
    why.textContent = w;
    why.hidden = !w;
    const ln = c.line?.() ?? '';
    if (line.textContent !== ln) line.textContent = ln;
    line.hidden = !ln;
  };
  return { el, paint, load: () => c?.load?.() ?? Promise.resolve() };
}

/** A tool past the sixth: a small instrument, its name and its first reading, in the hub's More row. */
function moreChip(id: string, name: string, t: TabDef | null, onTap: () => void): { el: HTMLElement; paint(): void; load(): Promise<unknown> } {
  const c = CARDS[id];
  const ins = h('span.mins');
  const line = h('small');
  const el = h('button.hubmini', { type: 'button', dataset: { id, case: 'keep' }, onclick: onTap }, ins, h('span.mtx', h('b', name), line), icon('<path d="M9 5l7 7-7 7"/>'));
  const paint = () => {
    if (!c) return;
    const drawn = (t?.instrument ?? c.instrument)?.() ?? null;
    clear(ins, drawn);
    const r = (t?.readouts ?? c.readouts)()[0];
    line.textContent = r ? `${r.label}: ${r.value ?? r.none ?? 'Not yet'}${r.value != null && r.unit ? ` ${r.unit}` : ''}` : '';
  };
  return { el, paint, load: () => c?.load?.() ?? Promise.resolve() };
}

/** At most six cards fit one screen (two columns, three rows, nothing to scroll); the rest go in the More row. */
export const HUB_MAX = 6;

type Tool = [id: string, name: string, glyph: string, t: TabDef | null, tap: () => void];
/** An area's tools in order (ASK adds Voice): its hub's cards and the switcher's arc. */
function areaTools(a: Area): Tool[] {
  const tools: Tool[] = a.tabs.map(def).filter((t): t is TabDef => !!t).map((t) => [t.id, toolName(t), t.icon, t, () => navTo(t.id, 'push')]);
  if (a.id === 'ask') tools.push(['voice', 'Voice', MIC, null, voiceTap]);
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
      const moreRow = h('div.hubmore');
      const sub = h('p.hubsub', a.sub);
      const wrap = h('div.hub',
        sub,
        h('button.cmdbar', { type: 'button', onclick: togglePalette, 'aria-label': 'Ask or jump anywhere' }, icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'), h('span', 'Ask or jump anywhere')),
        grid,
        moreRow,
      );
      root.append(wrap);
      // The cards: made once, painted from the state on entering and every few seconds while the hub is on screen.
      // Six fit the screen as instrument cards in two columns; any beyond six are small instruments in the More row.
      const tools = areaTools(a);
      const cards = tools.slice(0, HUB_MAX).map(([id, name, glyph, t, tap]) => toolCard(id, name, glyph, t, tap));
      const minis = tools.slice(HUB_MAX).map(([id, name, , t, tap]) => moreChip(id, name, t, tap));
      clear(grid, ...cards.map((c) => c.el));
      clear(moreRow, ...(minis.length ? [h('span.mk', h('b', 'More'), h('small', String(minis.length))), ...minis.map((m) => m.el)] : []));
      moreRow.hidden = !minis.length;
      cards.push(...minis);
      // the line under the title: his own (his school stage and rating, his next event and his city's weather, his
      // city, his latest project) where the phone has the reading, else the plain line; never a sample
      const paintSub = () => {
        const w = hubWords(a.id) || a.sub;
        if (sub.textContent !== w) sub.textContent = w;
        sub.dataset.personal = String(w !== a.sub);
      };
      const paintAll = () => {
        for (const c of cards) c.paint();
        paintSub();
      };
      let timer = 0;
      const paint = () => {
        paintAll();
        void Promise.all([...cards.map((c) => c.load()), loadHubWords(a.id)]).then(paintAll);
        clearInterval(timer);
        timer = window.setInterval(() => (ui.get().tab === hubId(a) && !document.hidden ? paintAll() : clearInterval(timer)), 3000);
      };
      return { enter: paint, leave: () => clearInterval(timer), describe: () => `${a.title}: ${a.tabs.join(', ')}` };
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

/** The tab bar: five areas in a frosted capsule; the avatar ("Me") sits at the top right of the navigation bar. */
export function buildTabBar(dock: HTMLElement, openDeck: () => void): () => void {
  const cap = h('div.tabcap', { role: 'tablist' });
  for (const a of AREAS.slice(0, 5)) {
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
  if (tab === 'memory' || tab === 'settings' || tab === 'abilities') return { back: '', backTo: '', title: niceCase(t.title) };
  if (tab === 'system' || tab === 'links') return { back: 'Settings', backTo: 'settings', title: niceCase(t.title) };
  return { back: a?.title ?? 'Home', backTo: a ? hubId(a) : 'core', title: ALIAS[t.id] ?? t.title };
}
