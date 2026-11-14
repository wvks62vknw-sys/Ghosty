/**
 * APPS: THE APP LIBRARY's screen (docs/build-plan/APPLIB.md, ENGINE 3), an app store on the phone. Featured apps, the families,
 * search as he types, each app's page (its icon, name, pitch and what it keeps) with OPEN, PIN TO HOME and MAKE MY OWN, recently
 * used, and his pinned apps as Home cards. An app opens at #apps/<id> (by a tap, the Jump bar, or "open wine cellar" said or typed,
 * found on the phone with no brain), drawn by the engine (engine.ts) on THE APP KIT. Nothing here leaves the phone.
 */
import type { TabDef, TabInstance } from '../../shell/tabs';
import { h, icon } from '../../core/dom';
import { key } from '../../ui/machine';
import { homeCard } from '../../ui/appkit';
import { FAMILIES, LIBRARY, type AppDef, type Family } from '../../../../../packages/shared/src/applib/index';
import { appIcon, engineState, extra, mountApp } from './engine';
import { glyphOf } from './glyphs';
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

function tile(d: AppDef, onTap: () => void): HTMLElement {
  const b = h('button.al-tile.al-apptile', { type: 'button', 'aria-label': `${d.name}: ${d.pitch}`, dataset: { app: d.id } }, h('span.al-tileicon', appIcon(d)), h('b', d.name));
  b.addEventListener('click', onTap);
  return b;
}

function row(d: AppDef, onTap: () => void, onOpen: () => void): HTMLElement {
  const main = h('button.al-approw', { type: 'button', dataset: { app: d.id } }, h('span.al-tileicon', appIcon(d)), h('span.al-approwwords', h('b', d.name), h('small', d.pitch)));
  main.addEventListener('click', onTap);
  return h('div.al-appline', { role: 'listitem' }, main, key('Open', onOpen, { label: `Open ${d.name}` }));
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

    const setHash = (arg: string) => {
      try { history.replaceState(null, '', arg ? `#apps/${arg}` : '#apps'); } catch { /* (a sandbox without history) */ }
    };
    const leaveApp = () => { stopApp?.(); stopApp = null; };
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

    const homeParts = (): HTMLElement[] => {
      const list = allApps();
      const out: HTMLElement[] = [];
      const pc = pinnedCards();
      if (pc.length) out.push(h('section.al-shelf', { dataset: { shelf: 'pinned' } }, h('div.al-head', h('h3', 'Pinned')), h('div.al-cardgrid', ...pc)));
      const rec = recent.get().map(appById).filter((d): d is AppDef => !!d).slice(0, 4);
      if (rec.length) out.push(h('section.al-shelf', { dataset: { shelf: 'recent' } }, h('div.al-head', h('h3', 'Recently used')), h('div.al-tiles', ...rec.map((d) => tile(d, () => openApp(d.id))))));
      const feat = featured(list, 5);
      if (feat.length) {
        const hero = feat[0]!;
        const heroEl = h('button.al-hero', { type: 'button', dataset: { app: hero.id }, 'aria-label': `Featured: ${hero.name}. ${hero.pitch}` },
          h('small.al-kicker', `Featured · ${FAMILIES[hero.family]}`), h('span.al-heroicon', appIcon(hero)), h('b', hero.name), h('p', hero.pitch));
        heroEl.addEventListener('click', () => show(`about/${hero.id}`));
        out.push(h('section.al-shelf', { dataset: { shelf: 'featured' } }, heroEl, h('div.al-tiles', ...feat.slice(1, 5).map((d) => tile(d, () => show(`about/${d.id}`))))));
      }
      const fams = familyOrder.map((f) => ({ f, apps: list.filter((d) => d.family === f) })).filter((x) => x.apps.length);
      if (fams.length) {
        out.push(h('section.al-shelf', { dataset: { shelf: 'families' } }, h('div.al-head', h('h3', 'Families')), h('div.al-chips', ...fams.map(({ f, apps }) => {
          const b = h('button.al-chip', { type: 'button', dataset: { family: f } }, `${FAMILIES[f]} `, h('small', String(apps.length)));
          b.addEventListener('click', () => show(`family/${f}`));
          return b;
        }))));
        for (const { f, apps } of fams) {
          const more = key(`See all ${apps.length}`, () => show(`family/${f}`), { label: `See all ${apps.length} ${FAMILIES[f]} apps` });
          out.push(h('section.al-shelf', { dataset: { shelf: f } }, h('div.al-head', h('h3', FAMILIES[f]), apps.length > 8 ? more : null), h('div.al-tiles', ...apps.slice(0, 8).map((d) => tile(d, () => show(`about/${d.id}`))))));
        }
      }
      const others = list.filter((d) => d.archetype === 'screen');
      if (others.length && !fams.some((x) => x.apps.some((d) => d.archetype === 'screen'))) out.push(h('section.al-shelf', h('div.al-head', h('h3', 'Ghosty’s own')), h('div.al-tiles', ...others.slice(0, 6).map((d) => tile(d, () => openApp(d.id))))));
      if (!list.length) out.push(h('div.ak-state.ak-empty', { role: 'status' }, h('p', 'The Library is filling up. Apps arrive here as they are made.')));
      if (makerFn()) out.push(h('section.al-shelf.al-makeshelf', h('p', 'Nothing quite right? Make your own app: pick what it keeps, and it is drawn like every app here.'), key('Make my own', () => show('make'), { kind: 'fill' })));
      return out;
    };

    const show = (arg: string) => {
      leaveApp();
      const [what, rest] = arg.includes('/') ? [arg.slice(0, arg.indexOf('/')), arg.slice(arg.indexOf('/') + 1)] : [arg, ''];
      at = arg || 'home';
      shell.dataset.view = what || 'home';
      Object.assign(libraryState, { view: what || 'home', app: '', family: '' });
      const home = () => show('');
      if (!arg || what === 'home') {
        setHash('');
        const body = page('Apps', [], { find: true });
        drawResults(body);
        return;
      }
      if (what === 'family') {
        const f = rest as Family;
        const apps = allApps().filter((d) => d.family === f);
        libraryState.family = f;
        setHash(arg);
        page(FAMILIES[f] ?? 'Apps', [h('div.al-results', { role: 'list' }, ...apps.map((d) => row(d, () => show(`about/${d.id}`), () => openApp(d.id))))], { back: home });
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
          h('div.al-about', { dataset: { app: d.id } },
            h('span.al-bigicon', appIcon(d)),
            h('div.al-aboutwords', h('h3', d.name), h('small', FAMILIES[d.family]), h('p', d.pitch))),
          h('div.al-sheetkeys.al-aboutkeys', key('Open', () => openApp(d.id), { kind: 'fill', label: `Open ${d.name}` }), pin, makerFn() && d.archetype !== 'screen' ? key('Make my own', () => show(`make/${d.id}`), { label: `Make my own from ${d.name}` }) : null),
          said,
          h('section.al-shelf', h('div.al-head', h('h3', 'What it keeps')), ...keeps(d).map((l) => h('p.al-keeps', l))),
          h('section.al-shelf', h('div.al-head', h('h3', 'How it works')), h('ol.al-how', ...d.tour.map((t) => h('li', t)))),
          h('p.al-keeps.al-fine', d.archetype === 'screen' ? 'Part of Ghosty.' : `Kept on this phone only. Nothing it holds is sent anywhere.`),
        ], { back: home });
        return;
      }
      // an app, opened
      const d = appById(what);
      if (!d) { show(''); return; }
      if (d.archetype === 'screen' && d.screen) { openApp(d.id); return; }
      used(d.id);
      libraryState.app = d.id;
      libraryState.view = 'app';
      shell.dataset.view = 'app';
      setHash(d.id);
      const host = h('div.al-host');
      shell.replaceChildren(host);
      const m = mountApp(host, d);
      m.k.el.querySelector('.ak-head')?.prepend(backKey(home));
      stopApp = m.stop;
    };
    goTo = show;
    // (#apps typed or gone back to while an app is open: the Library's front again)
    addEventListener('hashchange', () => { if (location.hash === '#apps' && at !== 'home' && document.querySelector('#pg-apps.on')) show(''); });
    // the lanes' renderers and App Maker (registry.ts), then the screen drawn again with them
    void loadLaneFiles().then(() => { if (!stopApp && libraryState.view === 'home') show(at === 'home' ? '' : at); });
    show('');
    return {
      open: (arg) => show(arg),
      leave: () => leaveApp(),
      enter: () => { if (libraryState.view === 'app' && !stopApp) show(at); },
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
    })
    : n < 150 && setTimeout(() => attach(n + 1), 100);
attach();
