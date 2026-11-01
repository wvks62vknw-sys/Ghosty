/**
 * THE EVERYTHING TAB (BRIEF-EVERYTHING; OWNER-ISSUES 92 ①, his words: "you should be able to like click on every single
 * thing he is able to do in one tab and it like explains it there"). Every single thing Ghosty can do, each with a plain
 * name, one line in his voice, a short explanation, ways to say it, what it needs, where it lives, since when, and TRY IT.
 *
 * GENERATED, never written as a claim: every entry is keyed by the id of an item in a registry the code already runs on —
 * the brain's tools (apps/edge/src/tools/index.ts TOOLS, grouped by TOOL_GROUPS), Telegram's commands and what it does
 * there (telegram.ts), the asks answered with no model (direct.ts), the jobs on the brain's clock (schedule.ts JOB_KINDS);
 * the phone's screens, their panels and their sections (the pills), the deck's YOU CAN lines, the Lens's modes, the GYM's games, SCHOOL's stages, the
 * Workbench's modes, the studio's samples and panes, the chat's own controls and phrases, the Me sheet, the hub cards, the
 * themes and the moods (apps/web/src/abilities/sources.ts). The brain serves its items with GET /api/abilities and the phone
 * keeps them (`ghosty.abilities`), so the tab draws with no model and no signal. apps/edge/test/catalogue.test.mjs diffs
 * this map against every registry both ways: an item with no words fails and is named, and so do words with no item.
 *
 * The words themselves are in catalogue/brain.ts and catalogue/app.ts (one copy for the brain and the phone). A value is
 * either the words of an entry or `{ same: id }`: this registry item is the very thing another entry already says (a deck
 * line that opens the panel it describes), so it is counted and shown once.
 */
import { CATS, type Ability, type AbilityCat } from './abilities';
import { BRAIN_WORDS, GROUP_WHY } from './catalogue/brain';
import { APP_WORDS } from './catalogue/app';

export { GROUP_WHY };

// ---------------------------------------------------------------- the scenes: what he is doing

export type Scene = 'morning' | 'out' | 'camera' | 'making' | 'watching' | 'school' | 'playing' | 'money' | 'talking' | 'phone' | 'behind';
/** The scenes, in the order the tab shows them (a thing may sit in two). The eight CATS are the second way in (chips). */
export const SCENES: { id: Scene; label: string }[] = [
  { id: 'morning', label: 'IN THE MORNING' },
  { id: 'out', label: 'WHEN YOU’RE OUT' },
  { id: 'camera', label: 'WITH THE CAMERA' },
  { id: 'making', label: 'MAKING THINGS' },
  { id: 'watching', label: 'WATCHING OVER YOU' },
  { id: 'school', label: 'LEARNING AND SCHOOL' },
  { id: 'playing', label: 'PLAYING' },
  { id: 'money', label: 'YOUR MONEY AND ADMIN' },
  { id: 'talking', label: 'TALKING TO ME' },
  { id: 'phone', label: 'ON THIS PHONE ONLY' },
  { id: 'behind', label: 'BEHIND THE SCENES' },
];
export { CATS };

// ---------------------------------------------------------------- the registries' items

/** Where an item comes from (its id's first part). The brain serves the first four. */
export type CatKind = 'tool' | 'telegram' | 'say' | 'job' | 'screen' | 'panel' | 'section' | 'deck' | 'lens' | 'game' | 'stage' | 'studio' | 'bench' | 'phrase' | 'chat' | 'me' | 'hub' | 'theme' | 'mood' | 'app';
export const BRAIN_KINDS: CatKind[] = ['tool', 'telegram', 'say', 'job'];

/** What TRY IT does: a screen (and a panel on it), a command of the app, or words for the chat — sent, or left in the box. */
export type CatGo = { open: string; panel?: string } | { run: string; args?: Record<string, unknown> } | { ask: string; send?: boolean };

/** One item of a registry the code runs on. */
export interface CatItem {
  id: string;
  kind: CatKind;
  /** The brain's tool group (tools), or the screen it lives on (the phone's). */
  group?: string;
  screen?: string;
  /** Its place among the eight (the owner's way of thinking: a design pick). */
  cat?: AbilityCat;
  /** What TRY IT does when the words name nothing better (a deck line's own link, a tile's command). */
  go?: CatGo;
  /** Cannot work yet, said honestly ("needs a key: SYSTEM → KEYS → GitHub token"); TRY IT then goes to set it up. */
  off?: string;
  offGo?: CatGo;
  /** When it arrived, when the registry knows (YYYY-MM-DD). */
  since?: string;
}

/** What he might need for it, said once here and shown under WHAT IT NEEDS. */
export type Need =
  | 'key:github' | 'key:tomtom' | 'key:dvsa' | 'key:dvla' | 'key:tfwm' | 'key:bods' | 'key:mapbox' | 'key:kaggle' | 'key:hfwrite' | 'key:huggingface' | 'key:plantnet' | 'key:aisstream' | 'key:ai'
  | 'link:email' | 'link:spotify' | 'link:telegram' | 'link:push'
  | 'wifi' | 'home' | 'work' | 'places' | 'offline' | 'person' | 'camera' | 'mic' | 'location' | 'statement' | 'premium' | 'brain';

export const NEEDS: Record<Need, { words: string; go?: CatGo }> = {
  'key:github': { words: 'A GitHub token: SYSTEM → KEYS → GitHub token.', go: { open: 'system', panel: 'KEYS' } },
  'key:tomtom': { words: 'For more detail, a free TomTom key: SYSTEM → KEYS → TomTom traffic.', go: { open: 'system', panel: 'KEYS' } },
  'key:dvsa': { words: 'A free DVSA MOT history key: SYSTEM → KEYS → DVSA MOT history.', go: { open: 'system', panel: 'KEYS' } },
  'key:dvla': { words: 'For tax status, a free DVLA key: SYSTEM → KEYS → DVLA vehicle enquiry.', go: { open: 'system', panel: 'KEYS' } },
  'key:tfwm': { words: 'For West Midlands buses and trams, a free TfWM key: SYSTEM → KEYS → TfWM transport.', go: { open: 'system', panel: 'KEYS' } },
  'key:bods': { words: 'For any bus in England, a free Bus Open Data key: SYSTEM → KEYS → Bus Open Data.', go: { open: 'system', panel: 'KEYS' } },
  'key:mapbox': { words: 'For the extra map styles, a free Mapbox token: SYSTEM → KEYS → Mapbox token.', go: { open: 'system', panel: 'KEYS' } },
  'key:kaggle': { words: 'A free Kaggle key, for the free GPUs: SYSTEM → KEYS → Kaggle.', go: { open: 'system', panel: 'KEYS' } },
  'key:hfwrite': { words: 'A Hugging Face token from a free account: SYSTEM → KEYS → Hugging Face token (training).', go: { open: 'system', panel: 'KEYS' } },
  'key:huggingface': { words: 'Works without one; with a token from a free Hugging Face account it waits less: SYSTEM → KEYS.', go: { open: 'system', panel: 'KEYS' } },
  'key:plantnet': { words: 'A free Pl@ntNet key: SYSTEM → KEYS → Pl@ntNet.', go: { open: 'system', panel: 'KEYS' } },
  'key:aisstream': { words: 'For live ships, a free AISstream key: SYSTEM → KEYS → AISstream.', go: { open: 'system', panel: 'KEYS' } },
  'key:ai': { words: 'Nothing to start with; another free AI key in SYSTEM → KEYS means less waiting.', go: { open: 'system', panel: 'KEYS' } },
  'link:email': { words: 'Your email linked once, with an app password: LINKS → EMAIL.', go: { open: 'links', panel: 'EMAIL' } },
  'link:spotify': { words: 'Your Spotify linked once: LINKS → SPOTIFY (play, pause and skip need Premium).', go: { open: 'links', panel: 'SPOTIFY' } },
  'link:telegram': { words: 'Your own Telegram bot paired once: LINKS → TELEGRAM.', go: { open: 'links', panel: 'TELEGRAM' } },
  'link:push': { words: 'Notifications allowed on this phone: LINKS → PHONE.', go: { open: 'links', panel: 'PHONE' } },
  wifi: { words: 'Wi-Fi for the first download (it is big); after that it works offline.' },
  home: { words: 'Your home saved: Memory → ME → PLACES, or just tell me your address.', go: { open: 'memory', panel: 'ME' } },
  work: { words: 'Your work saved too: Memory → ME → PLACES.', go: { open: 'memory', panel: 'ME' } },
  places: { words: 'At least one place saved (home, work…): Memory → ME → PLACES.', go: { open: 'memory', panel: 'ME' } },
  offline: { words: 'The offline brain downloaded once, on Wi-Fi: Settings → OFFLINE BRAIN.', go: { open: 'settings', panel: 'OFFLINE BRAIN' } },
  person: { words: 'One person named in Settings → GUARDIAN (by Telegram or your own email).', go: { open: 'settings', panel: 'GUARDIAN' } },
  camera: { words: 'The camera: the phone asks you once.' },
  mic: { words: 'The microphone: the phone asks you once.' },
  location: { words: 'Where you are: the phone asks you once, and it never leaves the phone unless it says so.' },
  statement: { words: 'A bank statement you downloaded (a CSV), added in Agenda → SPENDING. No bank access.', go: { open: 'agenda', panel: 'SPENDING' } },
  premium: { words: 'Spotify Premium, for play, pause and skip (Spotify’s rule).' },
  brain: { words: 'My brain reachable (a signal); everything else on the screen works without it.' },
};

// ---------------------------------------------------------------- the words

/** The words of one entry. */
export interface CatWords {
  /** Plain, three to six words ("Live train times"). */
  name: string;
  /** In his voice, one line, 140 characters at most, starting "I " or "You ". */
  line: string;
  /** Two to four short sentences: what it does, what it does not, the honest edge. */
  more: string;
  /** SAY IT LIKE THIS: ways he could say it or tap it (the first is what TRY IT asks, for a brain tool). */
  say: string[];
  scene: Scene[];
  cat?: AbilityCat;
  needs?: Need[];
  /** TRY IT, when it is not the registry item's own link (or, for a brain tool, the first way of saying it). */
  go?: CatGo;
  /** The words on the TRY IT button, when the made ones would not say it well. */
  tryText?: string;
  /** WHERE IT LIVES, when the registry item does not say (a brain tool that shows on God's Eye). */
  where?: string;
  since?: string;
}
export type CatValue = CatWords | { same: string };

/** Every entry's words, by registry id. */
export const CATALOGUE: Record<string, CatValue> = { ...BRAIN_WORDS, ...APP_WORDS };

export const isSame = (v: CatValue | undefined): v is { same: string } => !!v && 'same' in v;

// ---------------------------------------------------------------- when each arrived (STATUS.md's batch dates; coarse)

/** NEW: arrived within this many days. */
export const NEW_DAYS = 14;
const FIRST = '2026-10-15';
/** The brain's tool groups, by the batch they came in (a group not named is from the first build). */
export const SINCE_GROUP: Record<string, string> = {
  journeys: '2026-10-17', build: '2026-10-17', home: '2026-10-17', gadgets: '2026-10-17', vehicle: '2026-10-17', '3d': '2026-10-17', learn: '2026-10-17', pictures: '2026-10-17', scan: '2026-10-17', projects: '2026-10-17',
  crime: '2026-10-16', roads: '2026-10-16', lens: '2026-10-16', maps: '2026-10-16', recon: '2026-10-16', reverse: '2026-10-16', sites: '2026-10-16',
  school: '2026-10-23', video: '2026-10-25', homeplan: '2026-10-24', photo: '2026-10-24', places: '2026-10-24', spending: '2026-10-24',
  guardian: '2026-10-31', foresight: '2026-10-31', workbench: '2026-10-31',
};
/** The phone's screens, by the batch they came in. */
export const SINCE_SCREEN: Record<string, string> = {
  lens: '2026-10-16', reverse: '2026-10-16', settings: '2026-10-16', learn: '2026-10-17', space: '2026-10-17', studio: '2026-10-17', gym: '2026-10-18',
  school: '2026-10-23', abilities: '2026-10-31', workbench: '2026-10-31',
  'area-ask': '2026-10-28', 'area-see': '2026-10-28', 'area-make': '2026-10-28', 'area-learn': '2026-10-28', 'area-plan': '2026-10-28', 'area-me': '2026-10-28',
};

export function sinceOf(item: CatItem, w?: CatWords): string {
  return w?.since ?? item.since ?? (item.kind === 'tool' ? SINCE_GROUP[item.group ?? ''] : SINCE_SCREEN[item.screen ?? '']) ?? FIRST;
}

/** Arrived within NEW_DAYS of `now`. */
export function isNew(since: string, now = Date.now()): boolean {
  const t = Date.parse(`${since}T00:00:00Z`);
  return Number.isFinite(t) && now - t >= 0 && now - t < NEW_DAYS * 86_400_000;
}

// ---------------------------------------------------------------- the join: registry items → the entries he sees

/** One thing he can do, as the tab shows it. */
export interface CatEntry extends CatWords {
  id: string;
  kind: CatKind;
  /** Every registry item it stands for (more than one when another item is `same`). */
  items: string[];
  cat: AbilityCat;
  since: string;
  /** What TRY IT does, and what its button says. */
  go: CatGo;
  tryLabel: string;
  where: string;
  off?: string;
  /** For a brain tool: WHY I MIGHT USE IT MYSELF (its group's words). */
  why?: string;
  group?: string;
  screen?: string;
}

export interface JoinOpts {
  /** A screen's name as he knows it ("God’s eye"); '' when there is none. */
  screenName(id: string): string;
  /** The words for a command's TRY IT ("Opens the Lens on SCAN"), when there are better ones than "Does it now". */
  runLabel?(go: { run: string; args?: Record<string, unknown> }): string;
}

const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/[\s,;:.—-]+$/, '')}…` : s);

/** The words on TRY IT: what it will do ("Opens System on Keys", "Asks me: “what’s due this week?”"). */
export function tryLabel(go: CatGo, o: JoinOpts): string {
  if ('ask' in go) return go.send === false ? `Puts “${cut(go.ask, 60)}” in the chat box for you` : `Asks me: “${cut(go.ask, 60)}”`;
  if ('run' in go) return o.runLabel?.(go) || 'Does it now';
  const [screen = '', arg = ''] = go.open.split('?');
  const name = o.screenName(screen) || nice(screen);
  if (go.panel) return `Opens ${name} on ${nice(go.panel.replace(/[…?]+$/, ''))}`;
  return arg ? `Opens ${name}: ${nice(arg)}` : `Opens ${name}`;
}

/** WHERE IT LIVES, from the item (or the words' own). */
function whereOf(item: CatItem, w: CatWords, o: JoinOpts): string {
  if (w.where) return w.where;
  const sc = item.screen ? o.screenName(item.screen) || nice(item.screen) : '';
  const tail = item.id.split(':').slice(2).join(':');
  switch (item.kind) {
    case 'tool': return 'In the chat, and on Telegram';
    case 'telegram': return 'On Telegram, once it is paired (LINKS → TELEGRAM)';
    case 'say': return 'In the chat, and on Telegram';
    case 'job': return 'On my own clock, in the brain';
    case 'phrase': return 'In the chat (typed or said)';
    case 'panel': return `${sc} → ${tail.replace(/[…?]+$/, '')}`;
    case 'section': return sc;
    case 'deck': return sc;
    case 'lens': return `Lens → ${item.id.split(':')[1]!.toUpperCase()}`;
    case 'game': return 'Gym';
    case 'stage': return 'School → THE LADDER';
    case 'studio': return '3D studio';
    case 'bench': return `Workbench → ${tail.split(':')[0]!.toUpperCase()}`;
    case 'chat': return 'The chat';
    case 'me': return 'The Me sheet (tap your initial, top right)';
    case 'hub': return sc;
    case 'theme': return 'Settings → THEME';
    case 'mood': return 'The whole screen’s colour, and the Me sheet in words';
    case 'app': return 'Everywhere in the app';
    default: return sc;
  }
}

/** The registry item's own TRY IT, when the words name none. */
function goOf(item: CatItem, w: CatWords): CatGo {
  if (item.off && item.offGo) return item.offGo;
  if (w.go) return w.go;
  if (item.go) return item.go;
  if (item.kind === 'tool' || item.kind === 'say' || item.kind === 'phrase') return { ask: w.say[0] ?? w.name };
  if (item.screen) return { open: item.screen };
  return { open: 'core' };
}

/**
 * The entries he sees, from the registries' items: each item's words (a `same` resolved to the entry it is), the same entry
 * once however many items stand for it; `missing`: items with no words at all (the tab says nothing of them; the test fails).
 */
export function joinCatalogue(items: CatItem[], o: JoinOpts, map: Record<string, CatValue> = CATALOGUE): { entries: CatEntry[]; missing: string[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = new Map<string, CatEntry>();
  const missing: string[] = [];
  for (const item of items) {
    let v = map[item.id];
    let id = item.id;
    for (let hop = 0; isSame(v) && hop < 3; hop++) {
      id = v.same;
      v = map[id];
    }
    if (!v || isSame(v)) {
      missing.push(item.id);
      continue;
    }
    const have = out.get(id);
    if (have) {
      have.items.push(item.id);
      continue;
    }
    // the entry's own item (a `same` points at it) decides where it lives and what it opens; else this one
    const own = byId.get(id) ?? item;
    const go = goOf(own, v);
    out.set(id, {
      ...v,
      id,
      kind: own.kind,
      items: [item.id],
      cat: v.cat ?? own.cat ?? 'do',
      since: sinceOf(own, v),
      go,
      tryLabel: own.off && own.offGo ? `Set it up: ${own.off}` : v.tryText ?? tryLabel(go, o),
      where: whereOf(own, v, o),
      ...(own.off ? { off: own.off } : {}),
      ...(own.kind === 'tool' && own.group && GROUP_WHY[own.group] ? { why: GROUP_WHY[own.group] } : {}),
      ...(own.group ? { group: own.group } : {}),
      ...(own.screen ? { screen: own.screen } : {}),
    });
  }
  return { entries: [...out.values()], missing };
}

/** The count line: "I can do 312 things, 9 of them new in the last two weeks." */
export function countLine(n: number, fresh: number): string {
  return `I can do ${n} things${fresh ? `, ${fresh} of them new in the last two weeks` : ''}.`;
}

/** An entry as the search reads it (the same search as "can you…?": shared/abilities.ts searchAbilities and its synonyms). */
export function searchable(e: CatEntry): Ability {
  // its name counts most, then its line, then the ways to say it and the rest of what it says (a word only there finds it,
  // but is never enough for a "yes": "can you fly a plane?" is not God's eye's "planes" with its "fly to New York")
  return {
    id: e.id,
    cat: e.cat,
    line: e.name,
    asks: [e.line],
    go: e.go,
    words: `${e.say.join(' ')} ${e.more} ${e.where} ${SCENES.filter((s) => e.scene.includes(s.id)).map((s) => s.label.toLowerCase()).join(' ')}`,
    from: BRAIN_KINDS.includes(e.kind) ? 'brain' : 'app',
  };
}

// ---------------------------------------------------------------- the rules his words keep (the test and the tab both use them)

/** A code word: a name_with_underscores (every tool's kind of name), or a bracket or arrow of code. */
const CODE = /\b[a-z]+_[a-z0-9_]+\b|[{}<>]|=>|\(\)/;

/**
 * What is wrong with one entry's words, as plain sentences (none: fine). `tools`: the brain's tool names, never shown.
 */
export function wordProblems(id: string, w: CatWords, tools: string[] = []): string[] {
  const out: string[] = [];
  const shown = [w.name, w.line, w.more, ...w.say, w.tryText ?? '', w.where ?? ''];
  const words = w.name.split(/\s+/).length;
  if (!w.name || words < 3 || words > 6 || w.name.length > 44) out.push(`${id}: the name "${w.name}" is not 3–6 plain words`);
  if (w.line.length > 140) out.push(`${id}: the line is ${w.line.length} characters (140 at most)`);
  if (!/^(?:I|You) /.test(w.line)) out.push(`${id}: the line does not start "I " or "You ": "${w.line}"`);
  if (!w.more || w.more.length < 40) out.push(`${id}: no explanation`);
  if ((w.more.match(/[.!?](?:\s|$)/g) ?? []).length > 5) out.push(`${id}: the explanation is more than four or five sentences`);
  if (!w.say.length || w.say.length > 4) out.push(`${id}: ${w.say.length} ways to say it (1–4)`);
  if (!w.scene.length) out.push(`${id}: in no scene`);
  for (const s of shown) {
    if (CODE.test(s)) out.push(`${id}: a code word in "${s.slice(0, 80)}"`);
    for (const t of tools) if (t.includes('_') && s.toLowerCase().includes(t)) out.push(`${id}: the tool name ${t} in "${s.slice(0, 80)}"`);
    if (/\b(?:the owner|owner's)\b/i.test(s)) out.push(`${id}: "the owner" in "${s.slice(0, 80)}" (he is "you")`);
  }
  return out;
}
