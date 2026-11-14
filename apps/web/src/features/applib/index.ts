/**
 * APPS: THE APP LIBRARY's screen (docs/build-plan/APPLIB.md, ENGINE 3), an app store on the phone. Featured apps, the families,
 * search as he types, every app A to Z at the foot of the front page (a key for each letter), each app's page (its icon, name,
 * pitch and what it keeps) with OPEN, PIN TO HOME and MAKE MY OWN, recently
 * used, and his pinned apps as Home cards. An app opens at #apps/<id> (by a tap, the Jump bar, or "open wine cellar" said or typed,
 * found on the phone with no brain), drawn by the engine (engine.ts) on THE APP KIT. Nothing here leaves the phone.
 */
import type { TabDef, TabInstance } from '../../shell/tabs';
import { h, icon } from '../../core/dom';
import { key } from '../../ui/machine';
import { homeCard } from '../../ui/appkit';
import { FAMILIES, LIBRARY, type AppDef, type Family } from '../../../../../packages/shared/src/applib/index';
import { engineState, extra, mountApp } from './engine';
import { glyphOf } from './glyphs';
import { iconRect, identity, openFrame, proState, tileOf, type Frame } from './pro';
import { extraApps, loadLaneFiles, makerFn, registerAppSource } from './registry';
import { register } from '../../commands/registry';

export const APPS_ICON = '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><path d="M16.5 13.5v6M13.5 16.5h6"/>';
const BACK = '<path d="M14.5 5.5L8 12l6.5 6.5"/>';
const SEARCH = '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>';

/** Every app the Library holds: LIBRARY, then the ones he made. */
export const allApps = (): AppDef[] => {
  const seen = new Set<string>();
  return [...LIBRARY, ...extraApps()].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
};
export const appById = (id: string) => allApps().find((d) => d.id === id);

// ── pinned and recently used (this phone only) ─────────────────────────────────────────────

const pins = extra<string[]>('library', 'pins', []);
const recent = extra<string[]>('library', 'recent', []);
export const pinned = () => pins.get().filter((id) => appById(id));
export const isPinned = (id: string) => pins.get().includes(id);
export function togglePin(id: string): boolean {
  const on = !isPinned(id);
  pins.set(on ? [id, ...pins.get().filter((x) => x !== id)].slice(0, 24) : pins.get().filter((x) => x !== id));
  return on;
}
const used = (id: string) => recent.set([id, ...recent.get().filter((x) => x !== id)].slice(0, 12));

/** The line under a pinned app's Home card: its first number, or its pitch. */
export function cardLine(d: AppDef): string {
  try {
    const kept = JSON.parse(localStorage.getItem(`ghosty.app.${d.id}`) ?? 'null') as { items?: unknown[] } | null;
    const n = kept?.items?.length ?? 0;
    if (d.archetype === 'log' && n) return `${n} ${n === 1 ? 'entry' : 'entries'}`;
    if (d.archetype === 'checklist' && kept?.items) { const done = (kept.items as { done?: boolean }[]).filter((x) => x.done).length; return `${done} of ${n} done`; }
  } catch {
    // (nothing kept yet)
  }
  return d.pitch;
}

/** His pinned apps as Home cards (for the Library's top and any Home that shows them). */
export function pinnedCards(): HTMLElement[] {
  return pinned().map((id) => {
    const d = appById(id)!;
    return homeCard({ name: d.name, glyph: glyphOf(d.glyph), line: cardLine(d), onTap: () => openApp(d.id) });
  });
}

// ── finding an app by his words ────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Apps for words, best first: the name, then a name that starts so, then keywords, then the pitch. */
export function search(q: string, list = allApps()): AppDef[] {
  const w = norm(q);
  if (!w) return [];
  const terms = w.split(' ');
  const scored = list.map((d) => {
    const name = norm(d.name);
    const kw = d.keywords.map(norm);
    const hay = `${name} ${kw.join(' ')} ${norm(d.pitch)} ${norm(FAMILIES[d.family])}`;
    let s = 0;
    if (name === w) s += 100;
    else if (name.startsWith(w)) s += 60;
    else if (kw.includes(w)) s += 50;
    else if (name.includes(w)) s += 40;
    if (terms.every((t) => hay.includes(t))) s += 10 + terms.filter((t) => name.includes(t) || kw.some((k) => k.includes(t))).length * 5;
    return { d, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.d.name.localeCompare(b.d.name)).map((x) => x.d);
}

/** "open wine cellar", "launch the packing list app": the app it names, if one is named exactly (else null, for the next table). */
export function appForSentence(text: string): AppDef | null {
  const m = /^(?:(?:ok(?:ay)?|please|hey ghosty|ghosty)[, ]+)?(?:open|launch|start|show me|go to|take me to|run)\s+(?:up\s+)?(?:the\s+|my\s+)?(.{2,40}?)(?:\s+app)?(?:\s+please)?[.!?]*$/i.exec(text.trim());
  if (!m) return null;
  const w = norm(m[1]!);
  const list = allApps().filter((d) => d.archetype !== 'screen');
  return list.find((d) => norm(d.name) === w) ?? list.find((d) => d.id === w.replace(/ /g, '-')) ?? null;
}

// ── the screen ─────────────────────────────────────────────────────────────────────────────

/** For the spec and the console: where the Library is. */
export const libraryState = { view: 'home', app: '', q: '', shown: 0, family: '' };

let goTo: ((arg: string) => void) | null = null;
/** Open an app by id (from anywhere: a Home card, the Jump bar, his words). */
export function openApp(id: string): void {
  const d = appById(id);
  if (d?.archetype === 'screen' && d.screen) {
    used(id);
    location.hash = `#${d.screen.hash}`;
    return;
  }
  if (goTo && document.querySelector('#pg-apps.on')) goTo(id);
  else location.hash = `#apps/${id}`;
}

const familyOrder = Object.keys(FAMILIES) as Family[];

/** Today's featured apps: one from each family that has some, turning with the day so the shop window changes. */
function featured(list: AppDef[], n = 6): AppDef[] {
  const day = Math.floor(Date.now() / 86_400_000);
  const own = list.filter((d) => d.archetype !== 'screen');
  const from = own.length >= 3 ? own : list;
  const picks = familyOrder.map((f) => from.filter((d) => d.family === f)).filter((x) => x.length).map((xs, i) => xs[(day + i * 7) % xs.length]!);
  const at = picks.length ? day % picks.length : 0;
  return [...picks.slice(at), ...picks.slice(0, at)].slice(0, n);
}

// ── the A–Z: every app, once, under its first letter ───────────────────────────────────────────

/** The letter an app is filed under: its name's first letter (no accent), or # for a number or a symbol. */
const initial = (name: string): string => {
  const c = name.normalize('NFD').replace(/\p{M}/gu, '').trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
};

/** The apps by name, under their letters: A to Z, then # (numbers and symbols) last. */
function azGroups(list: AppDef[]): { letter: string; apps: AppDef[] }[] {
  const by = new Map<string, AppDef[]>();
  for (const d of [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id))) {
    const l = initial(d.name);
    const g = by.get(l);
    if (g) g.push(d);
    else by.set(l, [d]);
  }
  return [...by].map(([letter, apps]) => ({ letter, apps })).sort((a, b) => (a.letter === '#' ? 1 : b.letter === '#' ? -1 : a.letter < b.letter ? -1 : 1));
}

/** Scroll smoothly, unless he has asked for less motion. */
const smooth = (): ScrollBehavior => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; } catch { return 'auto'; }
};

function tile(d: AppDef, onTap: () => void): HTMLElement {
  const b = h('button.al-tile.al-apptile', { type: 'button', 'aria-label': `${d.name}: ${d.pitch}`, dataset: { app: d.id } }, tileOf(d, 'l'), h('b', d.name));
  b.addEventListener('click', onTap);
  return b;
}

function row(d: AppDef, onTap: () => void, onOpen: () => void): HTMLElement {
  const main = h('button.al-approw', { type: 'button', dataset: { app: d.id } }, tileOf(d, 'm'), h('span.al-approwwords', h('b', d.name), h('small', d.pitch)));
  main.addEventListener('click', onTap);
  const open = h('button.al-pro-get', { type: 'button', 'aria-label': `Open ${d.name}` }, 'Open');
  open.addEventListener('click', onOpen);
  return identity(h('div.al-appline', { role: 'listitem' }, main, open), d);
}

/** What an app keeps, said plainly for its page. */
function keeps(d: AppDef): string[] {
  const log = d.log ?? d.importer?.log;
  if (log) return [log.fields.map((f) => f.label).join(', '), ...(log.stats?.length ? [`Works out ${log.stats.map((s) => s.label.toLowerCase()).join(', ')}.`] : []), ...(log.views && log.views.length > 1 ? [`Seen as a ${log.views.join(', a ').replace(/, a ([a-z]+)$/, ' or a $1')}.`] : [])];
  if (d.calc) return [`From ${d.calc.inputs.map((i) => i.label.toLowerCase()).join(', ')}.`, `Gives ${d.calc.outputs.map((o) => o.label.toLowerCase()).join(', ')}.`, ...(d.calc.source ? [`Source: ${d.calc.source}.`] : []), ...(d.calc.estimate ? ['A first estimate, never certified.'] : [])];
  if (d.checklist) return [`${d.checklist.sections.reduce((a, s) => a + s.items.length, 0)} items in ${d.checklist.sections.map((s) => s.name).join(', ')}.`, d.checklist.repeat === 'never' ? 'Kept until you clear it.' : `A fresh list each ${d.checklist.repeat === 'daily' ? 'day' : 'week'}.`];
  if (d.timer) return [d.timer.steps.map((s) => s.name).join(', '), `${d.timer.rounds} ${d.timer.rounds === 1 ? 'round' : 'rounds'}, a chime at each step.`];
  if (d.deck) return [`${d.deck.cards.length} cards`, d.deck.mode === 'srs' ? 'Spaced repetition: each card comes back just before you would forget it.' : 'A quiz that keeps your score.'];
  if (d.counter) return [d.counter.names.join(', '), d.counter.reset === 'never' ? 'Kept until you reset it.' : `Starts again each ${d.counter.reset === 'daily' ? 'day' : 'week'}.`];
  if (d.guide) return [`${d.guide.sections.length} sections, searchable, offline.`, `Source: ${d.guide.source.name}.`];
  if (d.importer) return ['Reads your own export on this phone.'];
  if (d.screen) return ['One of Ghosty’s own screens.'];
  return [];
}

export const appsTab: TabDef = {
  id: 'apps',
  title: 'APPS',
  icon: APPS_ICON,
  scene: 'backdrop',
  blurb: 'every app, kept on this phone · open by name',
  now: () => {
    const n = pinned().length;
    return n ? `${n} pinned` : `${allApps().length} apps`;
  },
  mount(root): TabInstance {
    const shell = h('section.al-lib', { dataset: { view: 'home' } });
    root.append(shell);
    let stopApp: (() => void) | null = null;
    let q = '';
    let at = 'home';
    // where the front page was scrolled to when he left it for another page, so Back is to the same place (the A–Z list is long)
    let homeY = 0;
    // THE PRO ROUND: an app opens in its own full-screen frame over the Library (pro.ts); the Library page stays drawn under it
    let frame: Frame | null = null;
    let appStop: (() => void) | null = null;
    let under: { at: string; view: string; family: string; app: string } = { at: 'home', view: 'home', family: '', app: '' };

    const setHash = (arg: string) => {
      try { history.replaceState(null, '', arg ? `#apps/${arg}` : '#apps'); } catch { /* (a sandbox without history) */ }
    };
    const leaveApp = () => { stopApp?.(); stopApp = null; };
    /** Close the open app: it shrinks into its icon (or slides away after a swipe), and the Library page under it is where he is. */
    const closeFrame = (how?: 'icon' | 'swipe' | 'now') => {
      const f = frame, stop = appStop;
      frame = null;
      appStop = null;
      if (!f) return;
      at = under.at;
      shell.dataset.view = under.view;
      Object.assign(libraryState, { view: under.view, family: under.family, app: under.app });
      void f.close(how).finally(() => stop?.());
    };
    /** The app's back (the chevron and the edge swipe): the history entry its open pushed, or straight to the Library page. */
    const backFrom = (id: string) => {
      const st = history.state as { alApp?: string } | null;
      if (st?.alApp === id) history.back();
      else { setHash(under.at === 'home' ? '' : under.at); closeFrame(); }
    };
    const backKey = (to: () => void, words = 'Back to Apps') => {
      const b = h('button.ak-hkey.al-back', { type: 'button', 'aria-label': words }, icon(BACK));
      b.addEventListener('click', to);
      return b;
    };

    // the frame of the Library's own pages: a header that stays, and one scroll area
    const page = (title: string, kids: (Node | null)[], o: { back?: () => void; find?: boolean } = {}) => {
      // (the front page's name is the shell's own title, "Apps"; a page inside it says where it is, with the way back)
      const head = o.back ? h('header.al-libhead', backKey(o.back), h('h2.al-libtitle', title)) : null;
      const body = h('div.al-libbody', ...kids);
      const parts: HTMLElement[] = head ? [head] : [];
      if (o.find) {
        const inp = h('input.al-find', { type: 'search', placeholder: `Search ${allApps().length} apps`, 'aria-label': 'Search apps', value: q, enterKeyHint: 'search' }) as HTMLInputElement;
        inp.addEventListener('input', () => { q = inp.value; libraryState.q = q; drawResults(body); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const top = search(q)[0]; if (top) openApp(top.id); } });
        parts.push(h('label.al-findrow', icon(SEARCH, 'ic al-findic'), inp));
      }
      parts.push(body);
      shell.replaceChildren(...parts);
      return body;
    };

    const drawResults = (body: HTMLElement) => {
      if (!q.trim()) return body.replaceChildren(...homeParts());
      const hits = search(q);
      libraryState.shown = hits.length;
      body.replaceChildren(hits.length
        ? h('div.al-results', { role: 'list', 'aria-label': `${hits.length} apps found` }, ...hits.slice(0, 60).map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id))))
        : h('div.ak-state.ak-empty', { role: 'status' }, h('p', `No app matches “${q.trim()}”.`), makerFn() ? key('Make my own', () => show('make'), { kind: 'fill' }) : null));
    };

    const section = (shelf: string, title: string, kids: (Node | null)[], right?: HTMLElement | null) =>
      h('section.al-shelf.al-pro-section', { dataset: { shelf } }, h('div.al-head.al-pro-sechead', h('h3', title), right ?? null), ...kids);

    /** THE A–Z: every app the Library holds, once, under its first letter, with a key for each letter that goes to it. */
    const azShelf = (list: AppDef[]): HTMLElement => {
      const groups = azGroups(list);
      const said = (letter: string) => (letter === '#' ? 'a number or a symbol' : letter);
      const blocks = groups.map(({ letter, apps }) => h('div.al-azgroup', { dataset: { letter } },
        h('h4.al-azletter', letter),
        h('div.al-azlist.al-pro-store', { role: 'list', 'aria-label': `Apps starting with ${said(letter)}` },
          ...apps.map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id))))));
      const keys = groups.map(({ letter }, i) => {
        const k = h('button.al-chip.al-azkey', { type: 'button', dataset: { letter }, 'aria-label': `Jump to apps starting with ${said(letter)}` }, letter);
        k.addEventListener('click', () => blocks[i]!.scrollIntoView({ block: 'start', behavior: smooth() }));
        return k;
      });
      return h('section.al-shelf.al-azshelf', { dataset: { shelf: 'all' } },
        h('div.al-head.al-pro-sechead', h('h3', 'All apps'), h('small', String(list.length))),
        h('nav.al-azindex', { 'aria-label': 'Jump to a letter' }, ...keys),
        ...blocks);
    };

    const homeParts = (): HTMLElement[] => {
      const list = allApps();
      const lead = list.filter((d) => d.tier !== 'more');
      const more = list.filter((d) => d.tier === 'more');
      const out: HTMLElement[] = [];
      // every app, A to Z, at the foot of the page; "Browse A–Z" in the Families heading goes straight to it
      const az = list.length ? azShelf(list) : null;
      let browse: HTMLElement | null = null;
      if (az) {
        browse = h('button.al-pro-seeall', { type: 'button' }, 'Browse A–Z');
        browse.addEventListener('click', () => az.scrollIntoView({ block: 'start', behavior: smooth() }));
      }
      const feat = featured(lead.length >= 3 ? lead : list, 5);
      if (feat.length) {
        const hero = feat[0]!;
        const heroEl = identity(h('button.al-hero.al-pro-feature', { type: 'button', dataset: { app: hero.id }, 'aria-label': `Featured: ${hero.name}. ${hero.pitch}` },
          h('small.al-kicker.al-pro-kicker', `Featured · ${FAMILIES[hero.family]}`),
          h('span.al-pro-featurerow', tileOf(hero, 'xl'), h('span.al-pro-featurewords', h('b', hero.name), h('span.al-pro-featurepitch', hero.pitch))),
          h('span.al-pro-featureget', 'View')), hero);
        heroEl.addEventListener('click', () => show(`about/${hero.id}`));
        out.push(h('section.al-shelf.al-pro-section', { dataset: { shelf: 'featured' } }, heroEl,
          feat.length > 1 ? h('div.al-head.al-pro-sechead', h('h3', 'Today’s picks')) : null,
          h('div.al-tiles.al-pro-tiles', ...feat.slice(1, 5).map((d) => tile(d, () => show(`about/${d.id}`))))));
      }
      const pc = pinnedCards();
      if (pc.length) out.push(section('pinned', 'Pinned', [h('div.al-cardgrid', ...pc)]));
      const rec = recent.get().map(appById).filter((d): d is AppDef => !!d).slice(0, 4);
      if (rec.length) out.push(section('recent', 'Recently used', [h('div.al-tiles.al-pro-tiles', ...rec.map((d) => tile(d, () => openApp(d.id))))]));
      const fams = familyOrder.map((f) => ({ f, apps: list.filter((d) => d.family === f), lead: lead.filter((d) => d.family === f) })).filter((x) => x.apps.length);
      if (fams.length) {
        out.push(section('families', 'Families', [h('div.al-chips', ...fams.map(({ f, apps }) => {
          const b = h('button.al-chip', { type: 'button', dataset: { family: f } }, `${FAMILIES[f]} `, h('small', String(apps.length)));
          identity(b, { family: f });
          b.addEventListener('click', () => show(`family/${f}`));
          return b;
        }))], browse));
        for (const { f, apps, lead: top } of fams) {
          const shown = (top.length ? top : apps).slice(0, 4);
          const all = h('button.al-pro-seeall', { type: 'button', 'aria-label': `See all ${apps.length} ${FAMILIES[f]} apps` }, 'See all');
          all.addEventListener('click', () => show(`family/${f}`));
          out.push(section(f, FAMILIES[f], [h('div.al-results.al-pro-store', { role: 'list' }, ...shown.map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id))))], apps.length > shown.length ? all : null));
        }
      }
      if (more.length) {
        const all = key(`See all ${more.length} more apps`, () => show('more'), { label: `See all ${more.length} more apps` });
        out.push(section('more', 'More apps', [h('p.al-keeps', `${more.length} more apps, each kept on this phone, from every family.`),
          h('div.al-results.al-pro-store', { role: 'list' }, ...more.slice(0, 3).map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id)))), all]));
      }
      const others = list.filter((d) => d.archetype === 'screen');
      if (others.length && !fams.some((x) => x.apps.some((d) => d.archetype === 'screen'))) out.push(section('own', 'Ghosty’s own', [h('div.al-tiles.al-pro-tiles', ...others.slice(0, 6).map((d) => tile(d, () => openApp(d.id))))]));
      if (!list.length) out.push(h('div.ak-state.ak-empty', { role: 'status' }, h('p', 'The Library is filling up. Apps arrive here as they are made.')));
      if (makerFn()) out.push(h('section.al-shelf.al-makeshelf.al-pro-section', h('p', 'Nothing quite right? Make your own app: pick what it keeps, and it is drawn like every app here.'), key('Make my own', () => show('make'), { kind: 'fill' })));
      if (az) out.push(az);
      return out;
    };

    /** The app's page: a picture of it at work, drawn in its own skin from what it keeps. */
    const shot = (d: AppDef): HTMLElement => {
      const lines: string[] = [];
      const log = d.log ?? d.importer?.log;
      if (log && d.sample) for (const r of d.sample.slice(0, 3)) lines.push(String((r as Record<string, unknown>)[log.title.replace(/[{}]/g, '').split(/[ (]/)[0]!] ?? ''));
      if (d.calc) lines.push(...d.calc.outputs.slice(0, 3).map((o) => o.label));
      if (d.checklist) lines.push(...d.checklist.sections.flatMap((x) => x.items).slice(0, 3));
      if (d.deck) lines.push(...d.deck.cards.slice(0, 3).map((c) => c.q));
      if (d.counter) lines.push(...d.counter.names.slice(0, 3));
      if (d.timer) lines.push(...d.timer.steps.slice(0, 3).map((x) => x.name));
      if (d.guide) lines.push(...d.guide.sections.slice(0, 3).map((x) => x.title));
      const rows = lines.filter(Boolean).slice(0, 3);
      return identity(h('div.al-pro-shot', { 'aria-label': `${d.name} at work`, role: 'img' },
        h('div.al-pro-shothead', tileOf(d, 's'), h('b', d.name)),
        h('div.al-pro-shothero', h('small', FAMILIES[d.family]), h('b', d.pitch.split(/[.,:]/)[0]!)),
        ...rows.map((t) => h('div.al-pro-shotrow', h('i'), h('span', t)))), d);
    };

    const show = (arg: string, force = false) => {
      const [what, rest] = arg.includes('/') ? [arg.slice(0, arg.indexOf('/')), arg.slice(arg.indexOf('/') + 1)] : [arg, ''];
      const isApp = !!what && !['home', 'family', 'make', 'about', 'more'].includes(what);
      // an app open and the Library asked for: close it into its icon; the page under it is kept as he left it (its scroll too)
      if (frame && !(isApp && what === proState.open)) {
        const same = (arg || 'home') === under.at && shell.childElementCount;
        closeFrame();
        if (same && !isApp && !force) return;
      } else if (frame && !force) return;
      // leaving the front page for another page: note where it was scrolled to (Back draws it again there)
      if (!isApp && what && what !== 'home' && libraryState.view === 'home') homeY = shell.querySelector<HTMLElement>('.al-libbody')?.scrollTop ?? 0;
      leaveApp();
      if (!isApp) {
        at = arg || 'home';
        shell.dataset.view = what || 'home';
        Object.assign(libraryState, { view: what || 'home', app: '', family: '' });
      }
      const home = () => show('');
      if (!arg || what === 'home') {
        setHash('');
        const body = page('Apps', [], { find: true });
        drawResults(body);
        if (homeY) { body.scrollTop = homeY; homeY = 0; }
        return;
      }
      if (what === 'family' || what === 'more') {
        const f = rest as Family;
        const apps = what === 'more' ? allApps().filter((d) => d.tier === 'more') : allApps().filter((d) => d.family === f);
        const top = apps.filter((d) => d.tier !== 'more'), rest_ = apps.filter((d) => d.tier === 'more');
        libraryState.family = what === 'more' ? '' : f;
        setHash(arg);
        const list = (xs: AppDef[]) => h('div.al-results.al-pro-store', { role: 'list' }, ...xs.map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id))));
        page(what === 'more' ? 'More apps' : FAMILIES[f] ?? 'Apps', what === 'more' || !top.length || !rest_.length ? [list(apps)] : [list(top), section('more', 'More apps', [list(rest_)])], { back: home });
        return;
      }
      if (what === 'make') {
        const m = makerFn();
        setHash(arg);
        const body = page('Make my own', [], { back: home });
        if (!m) { body.append(h('div.ak-state.ak-empty', { role: 'status' }, h('p', 'App Maker is still being built. It will open here once it lands.'))); return; }
        const r = m(body, rest ? appById(rest) : undefined);
        if (typeof r === 'function') stopApp = r;
        return;
      }
      if (what === 'about') {
        const d = appById(rest);
        if (!d) { setHash(''); page('Apps', [h('div.ak-state.ak-empty', { role: 'status' }, h('p', 'That app is not in the Library.'), key('All apps', home, { kind: 'fill' }))], { back: home }); return; }
        libraryState.app = d.id;
        setHash(arg);
        const pin = key(isPinned(d.id) ? 'Unpin' : 'Pin to Home', () => {
          const on = togglePin(d.id);
          pin.querySelector('span')!.textContent = on ? 'Unpin' : 'Pin to Home';
          said.textContent = on ? `${d.name} is pinned to Home.` : `${d.name} is off Home.`;
        }, { label: `Pin ${d.name} to Home` });
        const said = h('p.al-said', { role: 'status', 'aria-live': 'polite' });
        page(d.name, [
          identity(h('div.al-about.al-pro-about', { dataset: { app: d.id } },
            h('span.al-bigicon', tileOf(d, 'xl')),
            h('div.al-aboutwords', h('h3', d.name), h('small', FAMILIES[d.family]), h('p', d.pitch))), d),
          identity(h('div.al-sheetkeys.al-aboutkeys', key('Open', () => openApp(d.id), { kind: 'fill', label: `Open ${d.name}` }), pin, makerFn() && d.archetype !== 'screen' ? key('Make my own', () => show(`make/${d.id}`), { label: `Make my own from ${d.name}` }) : null), d),
          said,
          shot(d),
          section('keeps', 'What it keeps', keeps(d).map((l) => h('p.al-keeps', l))),
          section('how', 'How it works', [h('ol.al-how', ...d.tour.map((t) => h('li', t)))]),
          h('p.al-keeps.al-fine', d.archetype === 'screen' ? 'Part of Ghosty.' : `Kept on this phone only. Nothing it holds is sent anywhere.`),
        ], { back: home });
        return;
      }
      // an app, opened: full screen, grown from its icon, one history entry
      const d = appById(what);
      if (!d) { show(''); return; }
      if (d.archetype === 'screen' && d.screen) { openApp(d.id); return; }
      used(d.id);
      if (!shell.childElementCount) { const body = page('Apps', [], { find: true }); drawResults(body); at = 'home'; Object.assign(libraryState, { view: 'home', app: '', family: '' }); shell.dataset.view = 'home'; }
      under = { at, view: libraryState.view, family: libraryState.family, app: libraryState.app };
      const from = iconRect(d.id);
      try {
        if (location.hash !== `#apps/${d.id}`) history.pushState({ alApp: d.id }, '', `#apps/${d.id}`);
      } catch { /* (a sandbox without history) */ }
      libraryState.app = d.id;
      libraryState.view = 'app';
      const f = openFrame(d, from);
      frame = f;
      const m = mountApp(f.host, d);
      appStop = m.stop;
      f.dress(m.k, {
        back: () => backFrom(d.id),
        pin: { on: () => isPinned(d.id), toggle: () => togglePin(d.id) },
        make: makerFn() ? () => { closeFrame('now'); show(`make/${d.id}`); } : undefined,
      });
    };
    goTo = show;
    // phone back and #apps typed: the open app closes into the Library page under it (or the page the address names)
    const follow = () => {
      if (!document.querySelector('#pg-apps.on') || !location.hash.startsWith('#apps')) return;
      const arg = location.hash.replace(/^#apps\/?/, '');
      if (frame ? arg !== proState.open : (arg || 'home') !== at) show(arg);
    };
    addEventListener('hashchange', follow);
    addEventListener('popstate', follow);
    // the lanes' renderers and App Maker (registry.ts), then the screen drawn again with them
    // (also an app or App Maker opened before the lane files had loaded, a cold deep link to #apps/<game>: drawn again with them)
    void loadLaneFiles().then(() => {
      if (frame && engineState.error === 'no renderer') { const id = proState.open; closeFrame('now'); show(id, true); return; }
      if (frame) return;
      const early = libraryState.view === 'make' && !stopApp;
      if (early || (!stopApp && libraryState.view === 'home')) {
        // (the front page drawn again with the lanes in: where he had scrolled to is kept)
        if (at === 'home' && libraryState.view === 'home') homeY = shell.querySelector<HTMLElement>('.al-libbody')?.scrollTop ?? 0;
        show(at === 'home' ? '' : at, true);
      }
    });
    show('');
    return {
      open: (arg) => show(arg),
      leave: () => { closeFrame('now'); leaveApp(); },
      enter: () => {},
      describe: () => (libraryState.app ? `Apps: ${appById(libraryState.app)?.name ?? ''}` : 'Apps: the Library'),
    };
  },
};

// the Jump bar finds every app by its name and words ("wine cellar", "bottles"), and opens it on the phone with no brain
register(...LIBRARY.filter((d) => d.archetype !== 'screen').map((d) => ({ id: `app_${d.id}`, title: d.name, group: 'APPS', words: `open ${d.name.toLowerCase()} · ${d.keywords.join(' ')} ${d.pitch} app`, run: () => openApp(d.id) })));

// for the spec and the console (window.__ghosty.applib): where the Library is, and any AppDef tried out without a catalogue
const tried: AppDef[] = (() => {
  try { return JSON.parse(sessionStorage.getItem('ghosty.applib.tried') ?? '[]') as AppDef[]; } catch { return []; }
})();
registerAppSource(() => tried);
const g = globalThis as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0): unknown =>
  g.__ghosty
    ? (g.__ghosty.applib = {
      library: libraryState,
      engine: engineState,
      count: () => allApps().length,
      ids: () => allApps().map((d) => d.id),
      search: (q: string) => search(q).map((d) => d.id),
      sentence: (t: string) => appForSentence(t)?.id ?? null,
      try: (d: AppDef) => { const i = tried.findIndex((x) => x.id === d.id); if (i >= 0) tried.splice(i, 1); tried.push(d); try { sessionStorage.setItem('ghosty.applib.tried', JSON.stringify(tried)); } catch { /* (private window) */ } location.hash = `#apps/${d.id}`; },
      open: openApp,
      pin: togglePin,
      pro: proState,
      defs: () => allApps().map((d) => ({ id: d.id, name: d.name, family: d.family, archetype: d.archetype, tier: d.tier ?? 'essential', skin: d.skin ?? d.family, hue: d.hue ?? null })),
    })
    : n < 150 && setTimeout(() => attach(n + 1), 100);
attach();
