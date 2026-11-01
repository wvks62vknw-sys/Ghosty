/**
 * THE HOME ASSISTANT BRIDGE (BRIEF-REST-D 2): the Worker is the only thing that talks to his house, through his own free
 * Home Assistant box, never a paid cloud. His box's HTTPS address and a long-lived token live in the vault as one key
 * (`homeassistant`: the address on its first line, the token on its second, pasted in SYSTEM → KEYS → HOME ASSISTANT);
 * neither is ever put in a response, an error or a log, and the phone never sees them.
 *
 *   GET  /house[?fresh=1]                          → { linked, entities, line, marked, at, error? }
 *   POST /house/act  { entity, service, data, origin: 'tap'|'chat', confirm?, why? } → { ok, text, needs?, refused? }
 *   POST /house/mark { entity, on }                → { marked }  (a switch that needs his word)
 *
 * The states come from /api/states, the rooms from Home Assistant's own areas through /api/template where it gives them
 * (a room is guessed from a name where it does not), kept ten seconds so the sheet is quick. A call goes through the
 * allowlist and the guarded set (packages/shared/src/house.ts `policy`): a lock, an alarm, a garage door or gate, a switch he
 * marked, only from his tap with a confirm and never from a job; a domain off the list refused with its name. Every action
 * (and every refusal of a job) is kept in the WHY ledger, which "what did you do today" reads (why.ts).
 *
 * A scheduled task whose words are a house action ("turn off the hall light", a standing rule he set in his own words) is
 * acted here as a job (`houseJob`), and the guarded set refused. A brain turn about the house gets its state as a fact for
 * that turn only (`houseTurnFacts`); the morning's piece may carry one line (`morningHouseLine`). No model is asked here.
 */
import { houseAsked, houseFacts, houseLine, isGuarded, morningHouse, NOT_LINKED, policy, resolveAsk, shapeCall, doneWords, domainOf, toEntity, trailTool, HOUSE_WORDS, type HaState, type HouseEntity, type Origin } from '../../../packages/shared/src/house';
import type { Vault } from './kernel/vault';
import { keepTrail } from './why';

export const HOUSE_VAULT = 'homeassistant';
const MARKED_KEY = 'house:marked';
const TTL = 10_000;
const AREA_TTL = 10 * 60_000;

export interface HouseDeps {
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  fetch?: typeof fetch;
  now?: () => number;
}
interface Link {
  url: string;
  token: string;
}

const nowOf = (d: Pick<HouseDeps, 'now'>) => (d.now ? d.now() : Date.now());
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** The key as he pasted it: his box's https:// address (its origin) and the long-lived token, on two lines (either order). */
export function parseHouseKey(value: string): Link | null {
  const parts = String(value ?? '').split(/[\s]+/).map((x) => x.replace(/^(?:url|address|token)\s*:\s*/i, '').trim()).filter(Boolean);
  let url = '';
  for (const p of parts) {
    if (!/^https:\/\//i.test(p)) continue;
    try {
      url = new URL(p).origin;
      break;
    } catch {
      /* not an address */
    }
  }
  const token = parts.filter((p) => !/^https?:\/\//i.test(p) && /^[A-Za-z0-9._-]{20,}$/.test(p)).sort((a, b) => b.length - a.length)[0] ?? '';
  return url && token ? { url, token } : null;
}

export class HouseError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

async function linkOf(d: HouseDeps): Promise<Link | null> {
  const v = await d.vault.get(HOUSE_VAULT).catch(() => null);
  return v ? parseHouseKey(v) : null;
}

/** One call to his box. Every error in plain words, never with the address or the token in it. */
async function call(d: Pick<HouseDeps, 'fetch'>, link: Link, method: string, path: string, body?: unknown): Promise<unknown> {
  const f = d.fetch ?? fetch;
  let r: Response;
  try {
    r = await f(`${link.url}${path}`, { method, headers: { authorization: `Bearer ${link.token}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HouseError('I couldn’t reach your Home Assistant just now: is it on, and reachable over HTTPS from outside your house?');
  }
  if (r.status === 401 || r.status === 403) throw new HouseError('Your Home Assistant turned the token away: make a new long-lived token in your profile there and paste it in SYSTEM → KEYS → HOME ASSISTANT.', r.status);
  if (r.status === 404) throw new HouseError('Your Home Assistant has nothing by that name (was it renamed?).', 404);
  if (!r.ok) throw new HouseError(`Your Home Assistant answered ${r.status}: try again in a minute.`, r.status);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Home Assistant's rooms, by entity, from its own areas (a template it renders); {} where it cannot. */
const AREA_TEMPLATE = "{% set ns = namespace(out=[]) %}{% for s in states %}{% set a = area_name(s.entity_id) %}{% if a %}{% set ns.out = ns.out + [[s.entity_id, a]] %}{% endif %}{% endfor %}{{ ns.out | tojson }}";
let areaCache: { url: string; at: number; map: Record<string, string> } | null = null;
async function areasOf(d: HouseDeps, link: Link): Promise<Record<string, string>> {
  const now = nowOf(d);
  if (areaCache && areaCache.url === link.url && now - areaCache.at < AREA_TTL) return areaCache.map;
  let map: Record<string, string> = {};
  try {
    const out = await call(d, link, 'POST', '/api/template', { template: AREA_TEMPLATE });
    const pairs = (typeof out === 'string' ? JSON.parse(out) : out) as unknown;
    if (Array.isArray(pairs)) map = Object.fromEntries(pairs.filter((p): p is [string, string] => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string'));
  } catch {
    /* an older box, or templates off: rooms from names */
  }
  areaCache = { url: link.url, at: now, map };
  return map;
}

export const loadMarked = async (storage: DurableObjectStorage): Promise<string[]> => ((await storage.get<string[]>(MARKED_KEY).catch(() => undefined)) ?? []).filter((x) => typeof x === 'string');

export interface HouseView {
  linked: boolean;
  entities: HouseEntity[];
  marked: string[];
  at: number;
  error?: string;
}
let cache: { url: string; at: number; view: HouseView } | null = null;
/** Forget what was read (a test; an action changes the house). */
export function resetHouseCache(): void {
  cache = null;
  areaCache = null;
  downUntil = 0;
}

/** His house now: his things in plain fields, each marked guarded where it is (kept ten seconds unless `fresh`). */
export async function readHouse(d: HouseDeps, fresh = false): Promise<HouseView> {
  const link = await linkOf(d);
  const marked = await loadMarked(d.storage);
  if (!link) return { linked: false, entities: [], marked, at: nowOf(d) };
  const now = nowOf(d);
  if (!fresh && cache && cache.url === link.url && now - cache.at < TTL) return { ...cache.view, marked, entities: cache.view.entities.map((e) => ({ ...e, guarded: isGuarded(e, marked) })) };
  const states = await call(d, link, 'GET', '/api/states');
  if (!Array.isArray(states)) throw new HouseError('Your Home Assistant gave back something I could not read.');
  const areas = await areasOf(d, link);
  const entities = (states as HaState[])
    .map((s) => toEntity(s, areas[s.entity_id] ?? ''))
    .filter((e): e is HouseEntity => !!e)
    .slice(0, 400)
    .map((e) => ({ ...e, guarded: isGuarded(e, marked) }));
  const view: HouseView = { linked: true, entities, marked, at: now };
  cache = { url: link.url, at: now, view };
  return view;
}

export interface ActResult {
  ok: boolean;
  text: string;
  /** Not done: it needs his tap with a confirm. */
  needs?: 'confirm';
  /** Not done, and never will be from here (off the list, a sensor, the guarded set from a job). */
  refused?: boolean;
  entity?: string;
}

const WHY_OF: Record<Origin, string> = { tap: 'a tap on the HOUSE sheet', chat: 'your words in the chat', job: 'a scheduled job' };

/** One action on his house: the allowlist and the guarded set first, then the call, then the WHY ledger. */
export async function houseAct(d: HouseDeps, req: { entity: string; service: string; data?: Record<string, unknown>; origin: Origin; confirm?: boolean; why?: string }): Promise<ActResult> {
  const link = await linkOf(d);
  if (!link) return { ok: false, text: NOT_LINKED };
  const id = String(req.entity ?? '');
  const service = String(req.service ?? '');
  const domain = domainOf(id);
  let view: HouseView | null = null;
  try {
    view = await readHouse(d);
  } catch (e) {
    return { ok: false, text: e instanceof HouseError ? e.message : 'I couldn’t read your house just now.' };
  }
  const e: HouseEntity = view.entities.find((x) => x.id === id) ?? { id, domain, name: id.split('.')[1]?.replace(/_/g, ' ') ?? id, area: '', state: '', changed: 0 };
  const asked = (req.why ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || WHY_OF[req.origin];
  const v = policy(e, service, { marked: view.marked, origin: req.origin, confirm: req.confirm === true });
  if (!v.ok) {
    // a job turned away is kept, so WHY and his day say so; a chat's "needs your tap" is only an offer
    if (!v.needs) await keepTrail(d.storage, { at: nowOf(d), asked, steps: [{ tool: trailTool(e), args: `${e.name}: ${service.replace(/_/g, ' ')}`, ok: false, note: `refused: ${v.why}` }] }).catch(() => undefined);
    return { ok: false, text: v.why, ...(v.needs ? { needs: v.needs } : { refused: true }) };
  }
  if (!view.entities.some((x) => x.id === id)) return { ok: false, text: 'I can’t find that in your house.' };
  const shaped = shapeCall(domain, service, id, req.data ?? {}, e);
  if ('error' in shaped) return { ok: false, text: shaped.error };
  const step = { tool: trailTool(e), args: `${e.name}: ${doneWords(e, service, shaped.body).replace(/^the .+? is /, '')}` };
  try {
    await call(d, link, 'POST', shaped.path, shaped.body);
  } catch (err) {
    const text = err instanceof HouseError ? err.message : 'Your Home Assistant didn’t answer.';
    await keepTrail(d.storage, { at: nowOf(d), asked, steps: [{ ...step, ok: false, note: text }] }).catch(() => undefined);
    return { ok: false, text };
  }
  cache = null;
  await keepTrail(d.storage, { at: nowOf(d), asked, steps: [{ ...step, ok: true }] }).catch(() => undefined);
  const done = doneWords(e, service, shaped.body);
  return { ok: true, text: `Done: ${done}.`, entity: id };
}

/**
 * A scheduled task's words, when they are a house action: acted as a job (the guarded set refused, said and kept in WHY);
 * null when the words are not a house action, so the task runs as ever.
 */
export async function houseJob(d: HouseDeps, job: { text: string; title: string }): Promise<string | null> {
  const ask = houseAsked(job.text);
  if (!ask || ask.kind === 'sheet' || ask.kind === 'is' || ask.kind === 'temp') return null;
  if (!(await linkOf(d))) return `“${job.title}” is for your house, and your Home Assistant isn’t linked: ${NOT_LINKED}`;
  let view: HouseView;
  try {
    view = await readHouse(d);
  } catch (e) {
    return e instanceof HouseError ? e.message : 'I couldn’t read your house just now.';
  }
  const r = resolveAsk(ask, view.entities, view.marked, nowOf(d));
  if (r.kind !== 'act') return `“${job.title}”: ${r.text} Nothing was done.`;
  const out = await houseAct(d, { entity: r.entity.id, service: r.service, data: r.data, origin: 'job', why: `your scheduled job “${job.title.slice(0, 80)}”` });
  return out.text;
}

/** When his box last failed to answer a turn's read: a turn does not wait on it again for a minute. */
let downUntil = 0;
/**
 * His house's state as a fact for one brain turn, when his words are about it and the box is linked ('' otherwise). A turn
 * waits at most 2.5 s for it; a box that did not answer is not asked again by a turn for a minute.
 */
export async function houseTurnFacts(d: HouseDeps, text: string): Promise<string> {
  if (!HOUSE_WORDS.test(text) || nowOf(d) < downUntil || !(await linkOf(d))) return '';
  try {
    const view = await Promise.race([readHouse(d), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
    if (!view) throw new HouseError('slow');
    return view.entities.length ? houseFacts(view.entities) : '';
  } catch {
    downUntil = nowOf(d) + 60_000;
    return '';
  }
}

/** The morning's one house line (the coldest room and the heating), when linked; null otherwise. */
export async function morningHouseLine(d: HouseDeps): Promise<string | null> {
  if (!(await linkOf(d))) return null;
  try {
    return morningHouse((await readHouse(d)).entities);
  } catch {
    return null;
  }
}

/** SYSTEM → KEYS: the key checked by asking his box for its API (the address and token never in the answer). */
export async function testHouse(value: string, f: typeof fetch = fetch): Promise<{ ok: boolean; info: string }> {
  const link = parseHouseKey(value);
  if (!link) return { ok: false, info: 'paste two lines: your Home Assistant’s https:// address (from DuckDNS), then the long-lived token from your profile there' };
  try {
    const r = (await call({ fetch: f }, link, 'GET', '/api/')) as { message?: unknown };
    resetHouseCache();
    return { ok: true, info: `works ✓ · your Home Assistant answered${typeof r?.message === 'string' ? ` (“${r.message.slice(0, 40)}”)` : ''}` };
  } catch (e) {
    return { ok: false, info: e instanceof HouseError ? e.message : 'could not reach your Home Assistant' };
  }
}

/** The routes the phone calls (its words and taps; a job never comes this way). */
export async function houseRoute(req: Request, path: string, method: string, d: HouseDeps): Promise<Response> {
  const url = new URL(req.url);
  if (path === '/house' && method === 'GET') {
    try {
      const v = await readHouse(d, url.searchParams.get('fresh') === '1');
      return json({ ...v, line: v.linked ? houseLine(v.entities) : '' });
    } catch (e) {
      return json({ linked: true, entities: [], marked: await loadMarked(d.storage), at: nowOf(d), line: '', error: e instanceof HouseError ? e.message : 'I couldn’t read your house just now.' });
    }
  }
  if (path === '/house/act' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // from the phone: his tap or his words, never a job
    const origin: Origin = b.origin === 'tap' ? 'tap' : 'chat';
    const data = b.data && typeof b.data === 'object' && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : {};
    return json(await houseAct(d, { entity: String(b.entity ?? ''), service: String(b.service ?? ''), data, origin, confirm: b.confirm === true, why: typeof b.why === 'string' ? b.why : '' }));
  }
  if (path === '/house/mark' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { entity?: unknown; on?: unknown };
    const id = String(b.entity ?? '');
    if (!/^(?:switch|input_boolean)\.[a-z0-9_]+$/.test(id)) return json({ error: 'only a switch can need your word' }, 400);
    const now = await loadMarked(d.storage);
    const next = b.on === false ? now.filter((x) => x !== id) : [...new Set([...now, id])];
    await d.storage.put(MARKED_KEY, next.slice(0, 200));
    return json({ marked: next });
  }
  return json({ error: 'not found' }, 404);
}
