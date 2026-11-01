/**
 * THE EVERYTHING TAB's phone side (BRIEF-EVERYTHING): every item of the phone's own registries, each with the id its words
 * have in the catalogue (packages/shared/src/catalogue.ts) and where TRY IT goes. Pure — no DOM, no storage — so
 * apps/edge/test/catalogue.test.mjs bundles this very file and diffs the same lists against the words, both ways.
 *
 * The registries read here are the lists the screens render from: the tabs (`tabs`, passed in: features/index.ts TABS with
 * the hubs), the deck's YOU CAN lines (shell/deckcopy.ts DECK), the Lens's tiles (features/lens/tiles.ts), the GYM's games
 * (gym/meta.ts META), SCHOOL's stages (shared school.ts STAGES), the Workbench's panels and their modes
 * (features/workbench/panels.ts PANELS), the studio's samples and panes (features/studio/samples.ts), the chat's phrases
 * (assistant/phrases.ts), the areas and the Me sheet (shell/areadefs.ts), the hub cards (`hubs`, passed in:
 * shell/hubcards.ts CARDS), the themes (state/theme.ts THEMES) and the moods (shared mood.ts MOOD_KINDS). The screens'
 * panels and their sections (the pills, ui/sections.ts) are made in each screen's mount, so they come from the catalogue's
 * own `panel:` and `section:` keys for the screens this build has; the test checks those keys against the panels and the
 * `sections(root, screen, [...])` lists in the screens' source, both ways. (A section is the panel it opens on: `same`.)
 *
 * Two small lists live here because nothing else lists them: the chat's own controls (CHAT_CONTROLS) and what works on every
 * screen (APP_WIDE). Each names the element it is (`sel`), and the ABILITIES spec checks each is there.
 */
import type { AbilityCat } from '../../../../packages/shared/src/abilities';
import { CATALOGUE, type CatGo, type CatItem } from '../../../../packages/shared/src/catalogue';
import { MOOD_KINDS } from '../../../../packages/shared/src/mood';
import { STAGES } from '../../../../packages/shared/src/school';
import { FIRST_ASKS, LOCAL_ASKS } from '../assistant/phrases';
import { TILES } from '../features/lens/tiles';
import { PANES, SAMPLES } from '../features/studio/samples';
import { PANELS as BENCH } from '../features/workbench/panels';
import { META as GAMES } from '../gym/meta';
import { ME_CARDS, ME_ROWS } from '../shell/areadefs';
import { DECK, type DeckAct } from '../shell/deckcopy';
import { THEMES } from '../state/theme';

/** Where each screen sits among the eight (the owner's way of thinking, a design pick); a screen added since is DO FOR YOU. */
export const SCREEN_CAT: Record<string, AbilityCat> = {
  core: 'talk', brief: 'know', eye: 'see', lens: 'see', studio: 'build', workshop: 'build', reverse: 'build', space: 'build', workbench: 'build', learn: 'learn',
  gym: 'play', school: 'learn', library: 'learn', agenda: 'watch', markets: 'know', threats: 'watch', radio: 'play', memory: 'know',
  settings: 'talk', system: 'do', links: 'talk', abilities: 'talk',
  'area-ask': 'talk', 'area-see': 'see', 'area-make': 'build', 'area-learn': 'learn', 'area-plan': 'do', 'area-me': 'talk',
};

/** The chat's own controls (features/core/index.ts and the reply's buttons), by the element each is. */
export const CHAT_CONTROLS = [
  { id: 'mic', sel: '#cbar #mic' },
  { id: 'here', sel: '#cbar .herebtn' },
  { id: 'cited', sel: '#cbar .citedbtn' },
  { id: 'voice', sel: '#cbar .plusmenu button:not(#lensbtn)' },
  { id: 'camera', sel: '#cbar #lensbtn' },
  { id: 'log', sel: '.logbtn' },
  { id: 'suggest', sel: '#suggest .sugg' },
  { id: 'listen', sel: '.msgact[title="Listen"]' },
  { id: 'copy', sel: '.msgact[title="Copy"]' },
  { id: 'why', sel: '.whybtn' },
  { id: 'rate', sel: '.rateb' },
  { id: 'harder', sel: '.thinkbtn' },
  { id: 'bigbrain', sel: '.bigbrain' },
] as const;

/** What works on every screen. */
export const APP_WIDE = [
  { id: 'undo', sel: '.undo' },
  { id: 'search', sel: '#top .cmd' },
  { id: 'switcher', sel: '#dock button[data-area]' },
  { id: 'offers', sel: '' },
] as const;

/** A deck line's id: its screen and its first words ("deck:lens:translate-a-sign-or-a-menu"). */
export const deckId = (screen: string, text: string) =>
  `deck:${screen}:${text.toLowerCase().replace(/[“”"’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 6).join('-')}`;

const goOf = (a: DeckAct): CatGo => ('ask' in a ? { ask: a.ask } : 'chat' in a ? { open: 'core' } : 'run' in a ? { run: a.run, ...(typeof a.args === 'object' ? { args: a.args } : {}) } : { open: a.open, ...(a.panel ? { panel: a.panel } : {}) });

export interface AppInput {
  /** The screens this build has (its tabs and the hubs). */
  tabs: { id: string }[];
  /** The hub cards (shell/hubcards.ts CARDS). */
  hubs: string[];
}

/** Every item of the phone's registries, for this build's screens. */
export function appItems({ tabs, hubs }: AppInput): CatItem[] {
  const have = new Set(tabs.map((t) => t.id));
  const out: CatItem[] = [];
  const add = (i: CatItem) => out.push(i);
  for (const t of tabs) add({ id: `screen:${t.id}`, kind: 'screen', screen: t.id, cat: SCREEN_CAT[t.id] ?? 'do', go: { open: t.id } });
  // the screens' panels: the catalogue's own keys for the screens this build has (the test checks them against the source)
  for (const key of Object.keys(CATALOGUE)) {
    const m = /^panel:([^:]+):(.+)$/.exec(key);
    if (m && have.has(m[1]!)) add({ id: key, kind: 'panel', screen: m[1], cat: SCREEN_CAT[m[1]!] ?? 'do', go: { open: m[1]!, panel: m[2]!.replace(/[…?]+$/, '') } });
    // a screen's sections (its pills): each is the panel it opens on (`same`), so it is counted once
    const s = /^section:([^:]+):(.+)$/.exec(key);
    if (s && have.has(s[1]!)) add({ id: key, kind: 'section', screen: s[1], cat: SCREEN_CAT[s[1]!] ?? 'do', go: { open: s[1]! } });
  }
  // the Workbench's modes, where a panel has more than one
  if (have.has('workbench')) for (const p of BENCH) if (p.modes.length > 1) for (const m of p.modes) add({ id: `bench:${p.id}:${m.id}`, kind: 'bench', screen: 'workbench', cat: 'build', go: { open: `workbench?${p.id}` } });
  for (const [screen, d] of Object.entries(DECK)) {
    if (!have.has(screen)) continue;
    for (const l of d.can) add({ id: deckId(screen, l.text), kind: 'deck', screen, cat: SCREEN_CAT[screen] ?? 'do', go: goOf(l.act) });
  }
  if (have.has('lens')) for (const t of TILES) add({ id: `lens:${t.id}`, kind: 'lens', screen: 'lens', cat: 'see', go: { run: 'open_lens', args: { mode: t.id } }, ...(t.id === 'people' ? { since: '2026-10-31' } : {}) });
  if (have.has('gym')) for (const g of GAMES) add({ id: `game:${g.id}`, kind: 'game', screen: 'gym', cat: 'play', go: { run: 'open_gym', args: { game: g.id } } });
  if (have.has('school')) for (const s of STAGES) add({ id: `stage:${s.id}`, kind: 'stage', screen: 'school', cat: 'learn', go: { open: 'school', panel: 'THE LADDER' } });
  if (have.has('studio')) {
    for (const s of SAMPLES) add({ id: `studio:sample:${s.id}`, kind: 'studio', screen: 'studio', cat: 'build', go: { run: 'open_studio', args: { sample: s.id } } });
    for (const p of PANES) add({ id: `studio:pane:${p.id}`, kind: 'studio', screen: 'studio', cat: 'build', go: { open: 'studio' } });
  }
  for (const p of [...FIRST_ASKS, ...LOCAL_ASKS]) add({ id: `phrase:${p.id}`, kind: 'phrase', screen: 'core', cat: 'talk' });
  for (const c of CHAT_CONTROLS) add({ id: `chat:${c.id}`, kind: 'chat', screen: 'core', cat: 'talk', go: { open: 'core' } });
  for (const r of ME_ROWS) add({ id: `me:${r.id}`, kind: 'me', cat: 'talk', go: r.id === 'deck' ? { run: 'open_systems' } : { open: r.id } });
  for (const c of ME_CARDS) add({ id: `me:${c.id}`, kind: 'me', cat: c.id === 'guardian' ? 'watch' : 'do', go: { run: 'open_me' } });
  // (the areas' hubs are screens above, by their tabs: area-see, area-make…)
  for (const id of hubs) add({ id: `hub:${id}`, kind: 'hub', screen: have.has(id) ? id : 'core', cat: SCREEN_CAT[id] ?? 'talk', go: { open: have.has(id) ? id : 'core' } });
  for (const id of Object.keys(THEMES)) add({ id: `theme:${id}`, kind: 'theme', screen: 'settings', cat: 'talk', go: { open: 'settings', panel: 'THEME' }, since: '2026-10-18' });
  for (const k of MOOD_KINDS) add({ id: `mood:${k}`, kind: 'mood', cat: 'talk', go: { run: 'open_me' }, since: '2026-10-31' });
  for (const a of APP_WIDE) add({ id: `app:${a.id}`, kind: 'app', cat: 'do' });
  return out;
}
