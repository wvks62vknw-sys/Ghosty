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
import { dayWord, stampOf, daysAgo, gistAsk, matchGists, RECALL_DAYS, RECALL_LINES, RECALL_WEEK, replyGist, type Gist, type RecallHit } from '../../../packages/shared/src/recall';
import type { ChatTurn } from '../../../packages/shared/src/protocol';
import { EMBED_MODEL } from './library/store';
import { cost, neurons } from './neurons';

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
  // A pinned turn (memory.u11) stays past the 30 days AND past the caps: the pins are kept apart (the newest MAX_PINS), and only the
  // unpinned gists are bounded, by count and then by bytes with the pins' bytes counted. (A pinned turn is the oldest by nature, so
  // bounding them together let a PIN go first.)
  const pinned = list.filter((g) => g.pinned).sort((a, b) => a.at - b.at).slice(-MAX_PINS);
  let rest = list.filter((g) => !g.pinned && g.at >= now - RECALL_DAYS * DAY).sort((a, b) => a.at - b.at).slice(-Math.max(0, MAX_GISTS - pinned.length));
  const pinBytes = JSON.stringify(pinned).length;
  while (rest.length > 1 && pinBytes + JSON.stringify(rest).length > MAX_BYTES) rest = rest.slice(Math.ceil(rest.length / 10));
  return [...pinned, ...rest].sort((a, b) => a.at - b.at);
}
/** At most this many pinned turns (each a short line: well inside the bytes). */
export const MAX_PINS = 100;

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
    // (the same moment AND the same words: two messages a second apart are never mixed up)
    const head = g.q.replace(/…$/, '').slice(0, 40).toLowerCase();
    const i = turns.findIndex((t) => t.role === 'user' && Math.abs(t.at - g.at) < 5000 && t.text.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(head));
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

/**
 * MEMORY → FORGET on a turn: it leaves the gists (the caller keeps it for UNDO). The gist that went, or null. `at` is the turn's time
 * as the asker knows it: the phone stamps a message a moment before the brain notes it, so the nearest gist within two minutes is it.
 */
export async function forgetGist(storage: DurableObjectStorage, at: number): Promise<Gist | null> {
  const list = await loadGists(storage);
  const g = list.filter((x) => Math.abs(x.at - at) <= 120_000).sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at))[0];
  if (!g) return null;
  await storage.put(GISTS_KEY, list.filter((x) => x !== g));
  return g;
}

/** [recall] memory.u11: PIN or UNPIN a turn (the nearest gist within two minutes of the time the asker knows). The gist, or null. */
export async function pinGist(storage: DurableObjectStorage, at: number, pinned: boolean): Promise<Gist | null> {
  const list = await loadGists(storage);
  const g = list.filter((x) => Math.abs(x.at - at) <= 120_000).sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at))[0];
  if (!g) return null;
  if (pinned) g.pinned = true;
  else delete g.pinned;
  await storage.put(GISTS_KEY, list);
  return g;
}

/** UNDO: the gist back in its place. */
export async function restoreGist(storage: DurableObjectStorage, g: Gist, now = Date.now()): Promise<void> {
  const list = (await loadGists(storage)).filter((x) => x.at !== g.at);
  list.push(g);
  await storage.put(GISTS_KEY, boundGists(list, now));
}

/**
 * [recall] memory.u1: recall by meaning on the brain (Telegram, or a cold phone): his words and the newest 150 turns through the same free
 * Workers AI embedding the library uses, only while the day's shared allowance has room (neurons.ts); none, or no room: [] (words stand).
 */
export async function meaningSearch(env: { AI?: { run(model: string, input: unknown): Promise<unknown> } }, storage: DurableObjectStorage, about: string, now: number, tz: string, k = 3): Promise<RecallHit[]> {
  if (!env.AI || !about.trim()) return [];
  const list = (await gistsNow(storage, now)).slice(-150);
  if (!list.length) return [];
  const texts = [about, ...list.map((g) => `${g.q}${g.a ? ` ${g.a}` : ''}`.slice(0, 300))];
  const n = cost.embed(texts.reduce((s, t) => s + t.length, 0));
  if (!(await neurons().room('embed', n))) return [];
  await neurons().charge('embed', n);
  try {
    const r = (await env.AI.run(EMBED_MODEL, { text: texts, pooling: 'cls' })) as { data?: number[][] };
    if (!Array.isArray(r?.data) || r.data.length !== texts.length) return [];
    const unit = (v: number[]) => {
      const m = Math.hypot(...v) || 1;
      return v.map((x) => x / m);
    };
    const q = unit(r.data[0]!);
    const scored = list.map((g, i) => ({ g, c: unit(r.data![i + 1]!).reduce((s, x, j) => s + x * q[j]!, 0) }));
    return scored
      .filter((x) => x.c >= 0.72)
      .sort((a, b) => b.c - a.c)
      .slice(0, k)
      .map(({ g, c }) => ({ ...g, day: dayWord(g.at, now, tz), stamp: stampOf(g.at, g.via, tz), score: c }));
  } catch {
    return [];
  }
}
