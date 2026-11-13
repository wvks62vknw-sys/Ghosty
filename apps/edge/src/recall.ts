/**
 * MEMORY AND RECALL on the brain (BRIEF-DEPTH-MEMORY 1 and 2c): every turn's gist kept for 30 days (`recall:gists`), apart from
 * the day log, which the nightly reflection still folds into the diary after two weeks as before. A gist is HIS words (what he
 * asked, cut short, as the day log has them) and the first sentence of what Ghosty answered (filled in from the chat history the
 * brain already keeps). Nothing about anyone else is written into it beyond what he himself said.
 *
 *  - `noteGist`: written by `observe` (mind.ts) for every turn, from the app and Telegram alike;
 *  - `recallFor`: the RECALL block a reply's context gets (mind.ts mindSnapshot → prompt.ts contextLines): turns from the last seven
 *    days that match the current ask by their words, then today's earlier ones, at most four;
 *  - `recallSearch`: the `recall` tool's answer (tools/memory.ts) over the whole 30 days;
 *  - `forgetGist` / `restoreGist`: MEMORY → FORGET on a turn (memories.ts changeMemory, id `t:<at>`), with UNDO.
 * Words only, no model: the brain asks nothing new of anyone.
 */
import { daysAgo, gistAsk, matchGists, RECALL_DAYS, RECALL_LINES, RECALL_WEEK, replyGist, type Gist, type RecallHit } from '../../../packages/shared/src/recall';
import type { ChatTurn } from '../../../packages/shared/src/protocol';

export const GISTS_KEY = 'recall:gists';
const TURNS_KEY = 'turns';
const DAY = 86_400_000;
/** Well inside a storage value's 128 KB. */
const MAX_GISTS = 1200;
const MAX_BYTES = 110_000;

export async function loadGists(storage: DurableObjectStorage): Promise<Gist[]> {
  const v = await storage.get<Gist[]>(GISTS_KEY);
  return Array.isArray(v) ? v.filter((g) => g && typeof g.at === 'number' && typeof g.q === 'string') : [];
}

/** The gists within their 30 days and their bounds (the oldest go first). */
export function boundGists(list: Gist[], now: number): Gist[] {
  let out = list.filter((g) => g.at >= now - RECALL_DAYS * DAY).sort((a, b) => a.at - b.at).slice(-MAX_GISTS);
  while (out.length > 1 && JSON.stringify(out).length > MAX_BYTES) out = out.slice(Math.ceil(out.length / 10));
  return out;
}

/** One turn's gist, from the day log's line for it (`asked: "…"`). Nothing else is kept. */
export async function noteGist(storage: DurableObjectStorage, ep: { at: number; text: string; via?: string }): Promise<void> {
  const q = gistAsk(ep.text);
  if (!q) return;
  const list = await loadGists(storage);
  list.push({ at: ep.at, via: ep.via === 'telegram' ? 'telegram' : 'app', q });
  await storage.put(GISTS_KEY, boundGists(list, ep.at));
}

/** Fill in what Ghosty answered, from the chat history the brain already keeps (the reply that followed within ten minutes). */
function withAnswers(list: Gist[], turns: ChatTurn[]): boolean {
  let changed = false;
  for (const g of list) {
    if (g.a !== undefined) continue;
    const i = turns.findIndex((t) => t.role === 'user' && Math.abs(t.at - g.at) < 5000);
    if (i < 0) continue;
    const r = turns.slice(i + 1).find((t) => t.role === 'assistant' || t.role === 'user');
    if (!r || r.role !== 'assistant' || r.at - g.at > 10 * 60_000) continue;
    g.a = replyGist(r.text);
    changed = true;
  }
  return changed;
}

/** The gists, pruned to their 30 days, with the answers filled in where the history has them (saved when anything changed). */
export async function gistsNow(storage: DurableObjectStorage, now: number): Promise<Gist[]> {
  const [list, turns] = await Promise.all([loadGists(storage), storage.get<ChatTurn[]>(TURNS_KEY)]);
  const kept = boundGists(list, now);
  const filled = withAnswers(kept, turns ?? []);
  if (filled || kept.length !== list.length) await storage.put(GISTS_KEY, kept);
  return kept;
}

/**
 * The RECALL block for a reply: the newest gist is the ask in hand (observe ran just before); from the seven days before it, the
 * turns that match it by words, best first, then today's earlier turns (newest first), at most four in all.
 */
export async function recallFor(storage: DurableObjectStorage, now: number, tz: string): Promise<RecallHit[]> {
  const list = await gistsNow(storage, now);
  const ask = list[list.length - 1];
  if (!ask || now - ask.at > 5 * 60_000) return [];
  const skip = (g: Gist) => g === ask || g.at >= ask.at;
  const hits = matchGists(ask.q, list, { now, tz, since: now - RECALL_WEEK * DAY, skip, k: RECALL_LINES });
  const seen = new Set(hits.map((h) => h.at));
  const earlier = list
    .filter((g) => !skip(g) && !seen.has(g.at) && daysAgo(g.at, now, tz) === 0 && now - g.at > 30 * 60_000)
    .slice(-RECALL_LINES)
    .reverse()
    .map((g) => ({ ...g, day: 'today', stamp: '', score: 0 }));
  return [...hits, ...earlier].slice(0, RECALL_LINES);
}

/** The `recall` tool's search: every kept turn of the 30 days that matches his words, best first. */
export async function recallSearch(storage: DurableObjectStorage, about: string, now: number, tz: string, k = 6): Promise<RecallHit[]> {
  const list = await gistsNow(storage, now);
  return matchGists(about, list, { now, tz, k });
}

/** MEMORY → FORGET on a turn: it leaves the gists (the caller keeps it for UNDO). The gist that went, or null. */
export async function forgetGist(storage: DurableObjectStorage, at: number): Promise<Gist | null> {
  const list = await loadGists(storage);
  const g = list.find((x) => x.at === at);
  if (!g) return null;
  await storage.put(GISTS_KEY, list.filter((x) => x !== g));
  return g;
}

/** UNDO: the gist back in its place. */
export async function restoreGist(storage: DurableObjectStorage, g: Gist, now = Date.now()): Promise<void> {
  const list = (await loadGists(storage)).filter((x) => x.at !== g.at);
  list.push(g);
  await storage.put(GISTS_KEY, boundGists(list, now));
}
