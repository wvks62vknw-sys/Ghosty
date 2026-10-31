/**
 * ABILITIES (OWNER-ISSUES 68): everything the brain can do, made from the tool registry itself (tools/index.ts
 * TOOL_GROUPS), so it is always true and a tool added later appears by itself. Each group is one ability: its line for the
 * model said as his ("I can …", packages/shared/src/abilities.ts `iCan`), its tools' names as example asks, and — when it
 * cannot work yet because a key or a link is missing — "needs a key: SYSTEM → KEYS", honestly. The phone joins these with
 * the app's own abilities (apps/web/src/abilities/registry.ts) on the ABILITIES screen.
 *
 * Also here: the owner's learning goals ("Want me to learn it?" → YES: an `upgrades:ideas` entry `from: 'owner'` with his
 * words, upgrades.ts `addOwnerGoal`).
 *   GET  /abilities          → AbilitiesInfo (the abilities, his goals, the roadmap's open steps, offered and used)
 *   POST /abilities/learn    {ask} → the goal recorded (the same words twice: the one goal)
 *   POST /abilities/offered  {id}  → remembered (with when): offered in context once, never again; one a day at most
 */
import { askOf, iCan, patternWords, type Ability, type AbilitiesInfo, type AbilityCat, type Offered } from '../../../packages/shared/src/abilities';
import { TOOL_GROUPS, type ToolGroup } from './tools';
import { loadRoadmap } from './tools/evolve';
import { addOwnerGoal, loadIdeas } from './upgrades';

// (the shared words and search, re-exported for the brain's tests: test/abilities.test.mjs)
export { argWords, askOf, bestAsk, canYouAsked, dayLines, didYouKnow, doneOf, iCan, mayOffer, offerFor, patternWords, queryWords, searchAbilities, stem, todayAsked, whatAbout, whyAsked, whyLines } from '../../../packages/shared/src/abilities';

export const OFFERED_KEY = 'abilities:offered';
export const USED_KEY = 'abilities:used';

/**
 * Where each tool group sits among the eight (the owner's way of thinking about it: a design pick, never a claim). A group
 * added later and not named here is under DO FOR YOU until it is placed, so it still appears.
 */
export const GROUP_CAT: Record<string, AbilityCat> = {
  memory: 'know', web: 'know', video: 'know', data: 'know', library: 'know', scan: 'know', vehicle: 'know', gadgets: 'know',
  traffic: 'see', roads: 'see', maps: 'see', lens: 'see',
  widgets: 'build', sites: 'build', build: 'build', pictures: 'build', repo: 'build', reverse: 'build', home: 'build', homeplan: 'build', photo: 'build', '3d': 'build',
  agenda: 'watch', crime: 'watch', recon: 'watch', spending: 'watch', guardian: 'watch',
  media: 'play', spotify: 'play',
  school: 'learn', 'library-admin': 'learn', knowledge: 'learn', evolve: 'learn', learn: 'learn',
  ui: 'do', travel: 'do', journeys: 'do', projects: 'do', places: 'do',
  email: 'talk', notify: 'talk',
};

/**
 * Groups that cannot work until the owner gives a key or links an account: `any` of these vault names is enough, and
 * `where` is the screen that takes it. Each name is checked against keys.ts in the tests (Spotify keeps its link
 * in the vault under 'spotify').
 */
export const GROUP_NEEDS: Record<string, { any: string[]; where: string; open: { open: string; panel: string } }> = {
  email: { any: ['email'], where: 'needs linking: LINKS → EMAIL', open: { open: 'links', panel: 'EMAIL' } },
  spotify: { any: ['spotify'], where: 'needs linking: LINKS → SPOTIFY', open: { open: 'links', panel: 'SPOTIFY' } },
  repo: { any: ['github'], where: 'needs a key: SYSTEM → KEYS → GitHub token', open: { open: 'system', panel: 'KEYS' } },
  reverse: { any: ['github'], where: 'needs a key: SYSTEM → KEYS → GitHub token', open: { open: 'system', panel: 'KEYS' } },
  vehicle: { any: ['dvsa_mot', 'dvla_ves'], where: 'needs a key: SYSTEM → KEYS → DVSA MOT history', open: { open: 'system', panel: 'KEYS' } },
  // [guardian] the walk home's message to his one named person goes by Telegram (his bot) or his own email — never a text
  guardian: { any: ['telegram', 'email'], where: 'needs linking: LINKS → TELEGRAM (or EMAIL) to reach your named person', open: { open: 'links', panel: 'TELEGRAM' } },
};

/** The first sentence of a tool's description, for when a group has no line of its own. */
const firstSentence = (s: string) => (s.split(/(?<=\.)\s/)[0] ?? s).replace(/\.$/, '');

/** One group as an ability: his line, the tools as asks, what turns it on as search words, and whether it can work yet. */
export function groupAbility(g: ToolGroup, has: (name: string) => boolean): Ability {
  const first = g.tools[0];
  const line = iCan(g.about ?? `You can ${firstSentence(first?.description ?? g.name).replace(/^[A-Z]/, (c) => c.toLowerCase())}`);
  const need = GROUP_NEEDS[g.name];
  const off = need && !need.any.some(has) ? need.where : undefined;
  const asks = g.tools.map((t) => askOf(t.name));
  return {
    id: `g:${g.name}`,
    cat: GROUP_CAT[g.name] ?? 'do',
    line,
    asks,
    go: off && need ? need.open : { ask: asks[0] ?? g.name },
    ...(off ? { off } : {}),
    words: [g.name, ...g.tools.map((t) => firstSentence(t.description)), g.when instanceof RegExp ? patternWords(g.when.source) : ''].join(' '),
    from: 'brain',
    tools: g.tools.map((t) => t.name),
  };
}

/**
 * Every tool group with tools, as abilities (an empty group is nothing), and — with the self-upgrade tools there to back
 * it — "I can learn anything you teach me.", whose GO is the "Can you…?" box (the app's).
 */
export function brainAbilities(has: (name: string) => boolean, groups: ToolGroup[] = TOOL_GROUPS): Ability[] {
  // the extras (tools/extra.ts: abilities added since, some by Ghosty himself) are one ability each, in their own words
  const out = groups
    .filter((g) => g.tools.length)
    .flatMap((g) => (g.name === 'extra' ? g.tools.map((t) => ({ ...groupAbility({ name: g.name, tools: [t], when: g.when }, has), id: `g:extra:${t.name}` })) : [groupAbility(g, has)]));
  const evolve = groups.find((g) => g.name === 'evolve' && g.tools.length);
  if (evolve) {
    out.push({
      id: 'g:evolve:learn',
      cat: 'learn',
      line: 'I can learn anything you teach me.',
      asks: ['Can you learn to …?', 'Teach me how you …'],
      go: { open: 'abilities', panel: 'CAN YOU' },
      words: 'learn teach new ability upgrade myself goal',
      from: 'brain',
      tools: evolve.tools.map((t) => t.name),
    });
  }
  return out;
}

export interface AbilitiesDeps {
  storage: DurableObjectStorage;
  /** A key or a link the vault holds (a vault that cannot be read counts as missing). */
  vaultGet(name: string): Promise<string | null>;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** Which of the needed keys the vault holds, read once per request. */
async function keysHeld(d: AbilitiesDeps): Promise<Set<string>> {
  const names = [...new Set(Object.values(GROUP_NEEDS).flatMap((n) => n.any))];
  const got = await Promise.all(names.map((n) => d.vaultGet(n).then((v) => !!v, () => false)));
  return new Set(names.filter((_, i) => got[i]));
}

export async function abilitiesInfo(d: AbilitiesDeps): Promise<AbilitiesInfo> {
  const held = await keysHeld(d);
  const [ideas, road, offered, used] = await Promise.all([
    loadIdeas(d.storage).catch(() => []),
    loadRoadmap(d.storage).catch(() => null),
    loadOffered(d.storage).catch(() => [] as Offered[]),
    d.storage.get<string[]>(USED_KEY).catch(() => undefined),
  ]);
  return {
    abilities: brainAbilities((n) => held.has(n)),
    goals: ideas.filter((i) => i.from === 'owner').map((i) => ({ id: i.id, ask: i.ask ?? i.title, title: i.title, at: i.at })),
    roadmap: { goal: road?.goal ?? '', steps: (road?.steps ?? []).filter((s) => s.status !== 'done').map((s) => s.title) },
    offered,
    used: used ?? [],
  };
}

/** What was offered unprompted, and when (an entry kept before times were kept counts as long ago). */
export async function loadOffered(storage: DurableObjectStorage): Promise<Offered[]> {
  const raw = (await storage.get<(Offered | string)[]>(OFFERED_KEY)) ?? [];
  return raw.map((o) => (typeof o === 'string' ? { id: o, at: 0 } : o)).filter((o) => o && typeof o.id === 'string');
}

/** Remember that an ability was offered unprompted (never again; the day's one): at most 200 kept. */
export async function markOffered(storage: DurableObjectStorage, id: string, now = Date.now()): Promise<Offered[]> {
  const list = await loadOffered(storage);
  if (!list.some((o) => o.id === id)) {
    list.push({ id, at: now });
    await storage.put(OFFERED_KEY, list.slice(-200));
  }
  return list;
}

/** The tool groups used so far (from the tools a turn ran): written only when a new one appears. */
export async function markUsed(storage: DurableObjectStorage, tools: string[]): Promise<void> {
  if (!tools.length) return;
  const groups = TOOL_GROUPS.filter((g) => g.tools.some((t) => tools.includes(t.name))).map((g) => g.name);
  if (!groups.length) return;
  const list = (await storage.get<string[]>(USED_KEY)) ?? [];
  const fresh = groups.filter((g) => !list.includes(g));
  if (fresh.length) await storage.put(USED_KEY, [...list, ...fresh]);
}

export async function abilitiesRoute(req: Request, path: string, method: string, d: AbilitiesDeps): Promise<Response> {
  if (path === '/abilities' && method === 'GET') return json(await abilitiesInfo(d));
  if (path === '/abilities/learn' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { ask?: unknown };
    const ask = typeof b.ask === 'string' ? b.ask.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    if (!ask) return json({ error: 'say what to learn' }, 400);
    const goal = await addOwnerGoal(d.storage, ask);
    return json({ goal: { id: goal.id, ask: goal.ask ?? ask, title: goal.title, at: goal.at } });
  }
  if (path === '/abilities/offered' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof b.id === 'string' ? b.id.slice(0, 80) : '';
    if (!id) return json({ error: 'which ability?' }, 400);
    return json({ offered: await markOffered(d.storage, id) });
  }
  return json({ error: 'not found' }, 404);
}
