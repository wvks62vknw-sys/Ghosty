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
 */
import type { Ability, AbilitiesInfo, AbilityCat, AbilityGo } from '../../../../packages/shared/src/abilities';
import { STAGES } from '../../../../packages/shared/src/school';
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { TILES } from '../features/lens/index';
import { META as GAMES } from '../gym/meta';
import { DECK, type DeckAct } from '../shell/deckcopy';
import { openChat, perform } from '../shell/launcher';
import { navTo } from '../shell/areas';
import { tabs } from '../shell/tabs';

/** Where each screen sits among the eight (the owner's way of thinking, a design pick); a screen added since is DO FOR YOU. */
export const SCREEN_CAT: Record<string, AbilityCat> = {
  core: 'talk', brief: 'know', eye: 'see', lens: 'see', studio: 'build', workshop: 'build', reverse: 'build', space: 'build', learn: 'learn',
  gym: 'play', school: 'learn', library: 'learn', agenda: 'watch', markets: 'know', threats: 'watch', radio: 'play', memory: 'know',
  settings: 'talk', system: 'do', links: 'talk',
};

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
