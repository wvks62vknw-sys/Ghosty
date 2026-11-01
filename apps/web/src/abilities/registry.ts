/**
 * ABILITIES on the phone (OWNER-ISSUES 68): the brain's abilities (GET /api/abilities, made from its tool registry; kept on
 * this phone for when the brain cannot be reached) joined with the app's own, made from the registries the app already
 * has — the deck's screens and their YOU CAN lines (shell/deckcopy.ts, every line already checked against what the app
 * does), the GYM's games (gym/meta.ts), the Lens's modes (features/lens/index.ts TILES) and SCHOOL's stages
 * (packages/shared/src/school.ts). Nothing here is written as a claim of its own: a screen, a game or a mode that is not
 * in one of those lists is not listed, and one added later appears by itself.
 *
 * `go(a, ask?)`: GO — the screen (and its panel) through the deck's own deep links, a command of the app, or the example
 * put into the chat box for him to finish and send.
 *
 * THE EVERYTHING TAB (BRIEF-EVERYTHING) reads its entries here too: `catalogue()` joins every registry item (the brain's as
 * it last told this phone, `catalogueItems`; the phone's from abilities/sources.ts) with the catalogue's words
 * (packages/shared/src/catalogue.ts); `tryIt` does what an entry's TRY IT says, `runLabel` says it for a command.
 */
import type { Ability, AbilitiesInfo, AbilityGo } from '../../../../packages/shared/src/abilities';
import { BRAIN_KINDS, CATALOGUE, joinCatalogue, type CatEntry, type CatGo, type CatItem, type CatKind } from '../../../../packages/shared/src/catalogue';
import { STAGES } from '../../../../packages/shared/src/school';
import { brain } from '../api/brain';
import { allCommands } from '../commands/registry';
import { createStore } from '../core/store';
import { TILES } from '../features/lens/tiles';
import { SAMPLES } from '../features/studio/samples';
import { META as GAMES } from '../gym/meta';
import { DECK, type DeckAct } from '../shell/deckcopy';
import { openChat, perform } from '../shell/launcher';
import { navTo } from '../shell/areas';
import { tabs } from '../shell/tabs';
import { appItems, SCREEN_CAT } from './sources';

export { SCREEN_CAT };

/** An app ability: what each of its asks does when tapped (the deck's own deep links), alongside the asks. */
export interface AppAbility extends Ability {
  acts: DeckAct[];
}

/** The verb after "he", said by him: "names" → "name", "teaches" → "teach", "has" → "have". */
const plainVerb = (v: string) =>
  ({ has: 'have', is: 'am', does: 'do', goes: 'go', was: 'was' } as Record<string, string>)[v] ?? (/(?:ches|shes|sses|xes|zes)$/.test(v) ? v.slice(0, -2) : /[^s]s$/.test(v) ? v.slice(0, -1) : v);

/** The deck's words about Ghosty ("he names what he sees", "play him at chess"), said by him ("I name what I see", "play me at chess"). */
export function meVoice(s: string): string {
  return s
    .replace(/\b[Hh]e (\w+)/g, (_m, v: string) => `I ${plainVerb(v)}`)
    .replace(/\bhimself\b/g, 'myself')
    .replace(/\bhim\b/g, 'me')
    .replace(/\bhis\b/g, 'my')
    .replace(/\bHis\b/g, 'My');
}

const dot = (s: string) => (/[.!?…”]$/.test(s) ? s : `${s}.`);
const goOf = (a: DeckAct): AbilityGo => ('ask' in a ? { ask: a.ask } : 'chat' in a ? { open: 'core' } : 'run' in a ? { run: a.run } : { open: a.open, ...(a.panel ? { panel: a.panel } : {}) });

/** The app's own abilities, from its registries. */
export function appAbilities(): AppAbility[] {
  const out: AppAbility[] = [];
  const have = new Set(tabs().map((t) => t.id));
  // every screen in the deck that this build really has: its promise, its YOU CAN lines as the asks, each with its link
  for (const [id, d] of Object.entries(DECK)) {
    // (this screen is the list itself, not one of the things on it)
    if (id === 'abilities' || (have.size && !have.has(id))) continue;
    out.push({
      id: `s:${id}`,
      cat: SCREEN_CAT[id] ?? 'do',
      line: dot(meVoice(d.promise)),
      asks: d.can.map((l) => meVoice(l.text)),
      acts: d.can.map((l) => l.act),
      go: { open: id },
      words: `${d.name} ${id} ${d.dyk ?? ''}`,
      from: 'app',
    });
  }
  // the GYM: every game, the ones he can be played at first
  const games = [...GAMES].sort((a, b) => Number(!!b.play) - Number(!!a.play));
  out.push({
    id: 'gym:games',
    cat: 'play',
    line: `I teach myself by playing ${GAMES.length} games, and you can play me at ${games.filter((g) => g.play).length} of them.`,
    asks: games.map((g) => `${g.play ? 'Play me at' : 'Watch me learn'} ${niceName(g.title)}`),
    acts: games.map((g) => ({ run: 'open_gym', args: { game: g.id } })),
    go: { open: 'gym' },
    words: games.map((g) => `${g.title} ${g.blurb} ${g.learns}`).join(' '),
    from: 'app',
  });
  // the Lens: each mode on its tile
  out.push({
    id: 'lens:modes',
    cat: 'see',
    line: `I see through your camera, on this phone, in ${TILES.length} ways.`,
    asks: TILES.map((t) => `${niceName(t.label)}: ${t.hint}`),
    acts: TILES.map((t) => ({ run: 'open_lens', args: { mode: t.id } })),
    go: { open: 'lens' },
    words: 'lens camera photo point picture',
    from: 'app',
  });
  // SCHOOL: the stages he goes through
  const stages = STAGES.map((s) => s.label);
  out.push({
    id: 'school:stages',
    cat: 'learn',
    line: `I go to school and sit real exams, stage by stage: ${stages.slice(0, -1).join(', ')}, then ${stages.at(-1)!.toLowerCase()}.`,
    asks: ['Watch me sit a paper', 'See my results'],
    acts: [{ open: 'school', panel: 'THIS STAGE' }, { open: 'school', panel: 'RESULTS' }],
    go: { open: 'school' },
    words: STAGES.map((s) => `${s.label} ${s.years} ${s.exams}`).join(' '),
    from: 'app',
  });
  return out;
}

/** "CODE BREAKER" → "Code breaker", "TIC-TAC-TOE" → "Tic-tac-toe", "GO" → "Go". */
function niceName(t: string): string {
  const w = t.toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ---------------------------------------------------------------- the brain's, kept on this phone

const EMPTY: AbilitiesInfo = { abilities: [], goals: [], roadmap: { goal: '', steps: [] }, offered: [], used: [] };
/** The brain's last answer, kept on this phone (so the list and "can you…?" still work with no signal); `at`: when it came. */
export const brainSide = createStore({ info: EMPTY, at: 0 }, { persist: 'ghosty.abilities' });

let loading: Promise<AbilitiesInfo | null> | null = null;
/** Ask the brain again (at most once at a time); null when it cannot be reached (the kept copy stands). */
export function loadBrainSide(): Promise<AbilitiesInfo | null> {
  loading ??= brain
    .abilities()
    .then((info) => {
      brainSide.set({ info, at: Date.now() });
      return info;
    })
    .catch(() => null)
    .finally(() => (loading = null));
  return loading;
}

/** Everything he can do: the brain's (as last heard) and the app's. */
export function allAbilities(): (Ability | AppAbility)[] {
  return [...brainSide.get().info.abilities, ...appAbilities()];
}

// ---------------------------------------------------------------- GO

/** The example in the chat box, for him to finish and send (never sent for him). */
export function intoChat(words: string): void {
  openChat();
  let tries = 0;
  const put = () => {
    const box = document.querySelector<HTMLInputElement>('#cin');
    if (!box) return void (++tries < 12 && setTimeout(put, 150));
    box.value = words;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
  };
  setTimeout(put, 200);
}

/** Where GO goes, in words a spec can read: "open:lens", "open:system/KEYS", "run:open_gym", "ask". */
export function goKey(a: Ability, ask = -1): string {
  const act = ask >= 0 ? (a as AppAbility).acts?.[ask] : undefined;
  const g: AbilityGo | DeckAct = act ?? a.go;
  return 'ask' in g ? 'ask' : 'chat' in g ? 'open:core' : 'run' in g ? `run:${g.run}` : `open:${g.open}${g.panel ? `/${g.panel}` : ''}`;
}

// ---------------------------------------------------------------- THE EVERYTHING TAB (BRIEF-EVERYTHING)

/** A screen's name as he knows it: the deck's ("God’s eye", "3D studio"), else its title in sentence case. */
export function screenName(id: string): string {
  if (id === 'core') return 'Home';
  const area = /^area-(\w+)$/.exec(id)?.[1];
  if (area) return `the ${area.toUpperCase()} area`;
  const d = DECK[id]?.name;
  if (d) return d;
  const t = tabs().find((x) => x.id === id)?.title ?? id;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const LENS_NAME: Record<string, string> = { translate: 'SCAN → TRANSLATE' };
/** What a command's TRY IT will do, in words ("Opens the Lens on SCAN"). */
export function runLabel(g: { run: string; args?: Record<string, unknown> }): string {
  const a = g.args ?? {};
  switch (g.run) {
    case 'open_lens': return `Opens the Lens on ${LENS_NAME[String(a.mode)] ?? String(a.mode ?? 'SEE').toUpperCase()}`;
    case 'open_gym': return `Opens the Gym on ${niceName(GAMES.find((x) => x.id === a.game)?.title ?? String(a.game ?? 'its games'))}`;
    case 'open_studio': return a.sample ? `Opens the 3D studio on the ${(SAMPLES.find((s) => s.id === a.sample)?.title ?? String(a.sample)).toLowerCase()}` : a.make ? `Opens the 3D studio and finds “${String(a.make)}”` : 'Opens the 3D studio';
    case 'open_learn': return 'Opens your flashcards';
    case 'open_systems': return 'Opens every screen at once';
    case 'open_me': return 'Opens the Me sheet';
    case 'show_cameras': return 'Shows the road cameras nearest home';
    case 'journey_planner': return 'Opens the journey planner';
    case 'vehicle_check': return 'Opens the vehicle check: you type the plate';
    case 'open_photo_tools': return 'Opens the photo tools';
    default: {
      const c = allCommands().find((x) => x.id === g.run);
      return c ? `Does it now: ${c.title}` : 'Does it now';
    }
  }
}

/**
 * Every item of every registry, brain and phone: the brain's as it last told this phone (GET /api/abilities `catalogue`,
 * kept here), or — before it ever answered — the brain's items as this build knows them, from the catalogue's own keys
 * (the catalogue's test holds those to the brain's registries); and the phone's own (abilities/sources.ts).
 */
export function catalogueItems(hubs: string[]): CatItem[] {
  const kept = brainSide.get().info.catalogue;
  const brainItems: CatItem[] = kept?.length
    ? kept
    : Object.keys(CATALOGUE).flatMap((id): CatItem[] => {
        const kind = id.split(':')[0] as CatKind;
        return BRAIN_KINDS.includes(kind) ? [{ id, kind }] : [];
      });
  return [...brainItems, ...appItems({ tabs: tabs(), hubs })];
}

/** The entries he sees (and any registry item with no words, which the tab leaves out and its spec reports). */
export function catalogue(hubs: string[]): { entries: CatEntry[]; missing: string[]; items: number } {
  const items = catalogueItems(hubs);
  return { ...joinCatalogue(items, { screenName, runLabel }), items: items.length };
}

/** Where a TRY IT goes, in words a spec can read: "open:lens", "open:system/KEYS", "run:open_gym", "ask", "fill". */
export function tryKey(g: CatGo): string {
  return 'ask' in g ? (g.send === false ? 'fill' : 'ask') : 'run' in g ? `run:${g.run}` : `open:${g.open}${g.panel ? `/${g.panel}` : ''}`;
}

/** TRY IT: the real thing — a screen and its panel, a command, or words for the chat (sent, or left in the box). */
export function tryIt(g: CatGo): void {
  if ('ask' in g) return g.send === false ? intoChat(g.ask) : perform({ ask: g.ask });
  if ('run' in g) return perform({ run: g.run, args: g.args ?? {} });
  if (g.open === 'abilities' && g.panel?.startsWith('CAN YOU')) {
    navTo('abilities', 'push');
    setTimeout(() => document.querySelector<HTMLInputElement>('#pg-abilities .canin')?.focus(), 350);
    return;
  }
  perform({ open: g.open, ...(g.panel ? { panel: g.panel } : {}) });
}

/** GO: the ability's own place, or (`ask` ≥ 0) where that example of it goes. */
export function go(a: Ability, ask = -1): void {
  const act = ask >= 0 ? (a as AppAbility).acts?.[ask] : undefined;
  if (act) return void ('ask' in act ? intoChat(act.ask) : perform(act));
  if (ask >= 0 && a.from === 'brain') return intoChat(a.asks[ask] ?? a.asks[0] ?? '');
  const g = a.go;
  if ('ask' in g) return intoChat(g.ask);
  if ('run' in g) return perform({ run: g.run, args: g.args ?? {} });
  if (g.open === 'abilities' && g.panel === 'CAN YOU') {
    navTo('abilities', 'push');
    setTimeout(() => document.querySelector<HTMLInputElement>('#pg-abilities .canin')?.focus(), 350);
    return;
  }
  perform({ open: g.open, ...(g.panel ? { panel: g.panel } : {}) });
}
