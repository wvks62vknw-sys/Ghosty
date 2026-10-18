/**
 * Model router: sends one chat-completion request, trying every reachable free model
 * in order until one answers. Models that hit rate limits are cooled down; models that
 * no longer exist (or reject tool calling) are skipped for 12 hours. All of this state
 * lives in the agent's Durable Object storage, so it survives restarts.
 */
import type { Env } from '../env';
import type { Vault } from '../kernel/vault';
import type { ModelHealth } from '../../../../packages/shared/src/protocol';
import type { AiCapacity, ProviderRoom } from '../../../../packages/shared/src/protocol';
import { PROVIDERS, NOT_CHAT, cheapScore, codeScore, modelScore, resetDelay, visionScore, type Provider } from './providers';
import { mockComplete } from './mock';
import { hasImage, IMAGE_TOKENS, textOf, type Content } from './content';
import { cost, neurons } from '../neurons';
import { quotaFor, type Priority, type Quota, type Room } from './quota';
import { CHARACTER_MARK, polish } from '../../../../packages/shared/src/persona';
export { resetDelay } from './providers';
export { quotaFor, CHAT_RESERVE } from './quota';
export type { Priority } from './quota';
export { hasImage, imagesIn, markPhotos, ownerWords, stripImages, textOf, withImages, type Content, type ContentPart } from './content';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Msg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Text; parts (text, then pictures as data URLs) when the owner sent a photo; null for a reply that is only tool calls. */
  content: Content;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Ghosty speaking as himself (the system prompt carries the CHARACTER, persona.ts): whichever
 * free model answered, its words go through `polish`, so the stock chatbot phrases never reach
 * the owner — in the app, on Telegram or in a notification. Calls with their own prompt (JSON
 * plans, checks, grading) are left exactly as the model wrote them.
 */
export function inCharacter<T extends { message: Msg }>(messages: Msg[], r: T): T {
  const sys = messages[0]?.role === 'system' ? textOf(messages[0].content) : '';
  if (!sys.includes(CHARACTER_MARK) || typeof r.message.content !== 'string' || !r.message.content) return r;
  return { ...r, message: { ...r.message, content: polish(r.message.content) } };
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

interface Health {
  cool?: number;
  dead?: number;
  why?: string;
  ms?: number;
}

interface LlmError {
  /** HTTP status, or 'too-big' when a request can't be slimmed to a provider's limit. */
  code?: number | string;
  message: string;
  retryAfter?: string | null;
  net?: boolean;
  timeout?: boolean;
}

/** The agent looks for this wording to answer a photo in text instead. */
const NO_VISION = 'no vision model reachable: none of the models I can reach right now can look at a picture (a free Gemini key in the System tab adds several).';

const H_KEY = 'llm:health';
const M_KEY = 'llm:models';
const ORDER_KEY = 'llm:order';

/** A wait this short is sat through (for the best model, or a 429's Retry-After) rather than falling to a worse model. */
const SHORT_WAIT_MS = 8_000;

/** No model answered: the message for the owner, and how long until the first one is back (Infinity when none is coming back). */
export class RouterError extends Error {
  constructor(
    message: string,
    public waitMs: number,
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

/** A pause that ends early when the turn is stopped. */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((ok) => {
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      ok();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });

const parseDur = (s: string | null | undefined): number => {
  if (!s) return 0;
  let t = 0;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/g)) {
    t += parseFloat(m[1]!) * ({ ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 'ms'] ?? 1);
  }
  if (!t && /^\d+(\.\d+)?$/.test(s)) t = parseFloat(s);
  return t * 1000;
};

/** The wait a rate limit asks for: the Retry-After header, or "retry in 2.5s" in the body (0 when it says nothing). */
function statedWait(e: LlmError): number {
  let ms = parseDur(e.retryAfter);
  const m = (e.message || '').toLowerCase().match(/(?:try again|retry) in ([\d.hms ]+)/);
  if (m) ms = Math.max(ms, parseDur(m[1]));
  return ms;
}

/** Decide what a failure means: cool down briefly, skip for hours, or blame the key. `daily`: the provider's whole allowance is gone until it resets. */
function classify(e: LlmError): { kind: 'cool' | 'dead' | 'key' | 'net'; ms: number; why: string; daily?: boolean } {
  const msg = (e.message || '').toLowerCase();
  if (e.net) return { kind: 'net', ms: 45_000, why: 'network' };
  if (e.timeout) return { kind: 'cool', ms: 45_000, why: 'timeout' };
  const c = typeof e.code === 'number' ? e.code : 0;
  if (c === 401 || (c === 403 && /key|auth|permission/.test(msg))) return { kind: 'key', ms: 6 * 3600_000, why: 'key rejected' };
  if (c === 402) {
    // An open endpoint's per-address pacing (Pollinations: one reply every 30 s, with Retry-After) is a short wait, not a bill.
    const ra = parseDur(e.retryAfter);
    if (ra || /free limit|free_limit|wait \d+ ?s/.test(msg)) return { kind: 'cool', ms: Math.min((ra || 30_000) + 1500, 10 * 60_000), why: 'free limit · one reply every 30 s' };
    return { kind: 'cool', ms: 3600_000, why: 'no credits', daily: true };
  }
  if (c === 429) {
    let ms = statedWait(e);
    // The day's allowance, not a per-minute limit: Gemini says "quota" for both, so only a named
    // per-day metric (…PerDay…, RPD/TPD, Workers AI's neurons) or a stated wait of over an hour counts.
    const daily = /per[- ]?day|daily|rpd|tpd|neuron/.test(msg) || ms > 3600_000;
    ms = ms || (daily ? 3600_000 : 60_000);
    return { kind: 'cool', ms: Math.min(ms + 1500, 8 * 3600_000), why: daily ? 'daily limit' : 'rate limit', daily };
  }
  if (c === 404 || c === 410 || (c === 400 && /(decommission|deprecat|not found|does not exist|unknown model|not supported|does not support tools|tool use|function calling)/.test(msg))) {
    return { kind: 'dead', ms: 12 * 3600_000, why: 'unavailable or no tool support' };
  }
  if (c === 403) return { kind: 'dead', ms: 12 * 3600_000, why: 'no access' };
  if (c === 413) return { kind: 'cool', ms: 60_000, why: 'request too large' };
  if (c >= 500 || c === 408 || c === 409) return { kind: 'cool', ms: 25_000, why: 'server busy' };
  return { kind: 'cool', ms: 30_000, why: 'error' };
}

/**
 * What a caller says about a call. `priority`: 'chat' (the owner is waiting; the default) or
 * 'background' (Ghosty's own work: study, projects, scheduled jobs, tutor and upgrade writing, the
 * cited-answer checks), which only uses room above the chat reserve and waits for it rather than
 * failing. `tier`: 'small' for easy internal steps (summaries, extraction, titles, classification,
 * claim checks: the fast, generously rationed models), 'big' (the default) for the best model.
 * `onWait`: told "waiting for free AI room · 12 s" while every capable provider is full.
 */
export interface CallOptions {
  code?: boolean;
  /** Longest total wait for room or a cool-down (0: never wait). Default 45 s for chat, 90 s for background. */
  maxWaitMs?: number;
  /** The same as tier 'small' (older callers). */
  cheap?: boolean;
  tier?: 'small' | 'big';
  priority?: Priority;
  onWait?: (text: string) => void;
}

/** A reply leaves this many tokens counted before the provider says the real number. */
const REPLY_TOKENS = 600;

/** The two counters a call uses: the whole key, and the model (limited on its own when the provider limits models one by one; a wait a 429 asks for always holds just the model). */
const keysOf = (p: Provider, model: string): [string, string] => [p.id, `${p.id}|${model}`];
/**
 * Is a 429 about the number of requests a minute? Not when it names tokens (Groq: "tokens per minute
 * (TPM) … try again in 7.66s") or is an upstream model's own limit (OpenRouter: "temporarily
 * rate-limited upstream"): those must not lower the requests-a-minute limit.
 */
export const perMinuteLimit = (msg: string | undefined): boolean => !/token|\btpm\b|upstream|provider returned error/i.test(msg ?? '');

/** The counter the provider's limits (and its rate-limit headers) are about. */
const limitKey = (p: Provider, model: string): string => (p.modelLimits ? `${p.id}|${model}` : p.id);

export class Router {
  private quota: Quota;
  constructor(
    private storage: DurableObjectStorage,
    private vault: Vault,
    private env: Env,
  ) {
    this.quota = quotaFor(storage);
  }

  /** Is there room for `tokens` on this provider and model in this lane (both counters)? */
  private room(p: Provider, model: string, tokens: number, lane: Priority): Room {
    const a = this.quota.room(p.id, p.limits ?? {}, tokens, lane, p);
    const b = this.quota.room(`${p.id}|${model}`, p.modelLimits?.(model) ?? {}, tokens, lane, p);
    if (!a.ok || !b.ok) {
      const worse = !a.ok && (b.ok || a.waitMs >= b.waitMs) ? a : b;
      return { ok: false, waitMs: Math.max(a.ok ? 0 : a.waitMs, b.ok ? 0 : b.waitMs), load: Math.max(a.load, b.load), why: worse.why };
    }
    return { ok: true, waitMs: 0, load: Math.max(a.load, b.load) };
  }

  /**
   * Storage that never stops the AI: values are mirrored in memory, and if the database is
   * unavailable (e.g. the free plan's daily allowance is used up) reads fall back to the
   * mirror and writes are skipped, so models keep answering.
   */
  private mem = new Map<string, unknown>();
  private async sget<T>(k: string): Promise<T | undefined> {
    try {
      const v = await this.storage.get<T>(k);
      this.mem.set(k, v);
      return v;
    } catch {
      return this.mem.get(k) as T | undefined;
    }
  }
  private async sput(k: string, v: unknown): Promise<void> {
    this.mem.set(k, v);
    try {
      await this.storage.put(k, v);
    } catch {
      /* database paused: keep going from memory */
    }
  }

  private async health(): Promise<Record<string, Health>> {
    return (await this.sget<Record<string, Health>>(H_KEY)) ?? {};
  }

  private async order(): Promise<Provider[]> {
    const pref = (await this.sget<string[]>(ORDER_KEY)) ?? [];
    return [...PROVIDERS].sort((a, b) => {
      const ia = pref.indexOf(a.id);
      const ib = pref.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  /** The provider's key, '' for a keyless provider that is available, or null if unusable. */
  private async keyFor(p: Provider): Promise<string | null> {
    if (p.transport === 'workers-ai') return this.env.AI ? '' : null;
    // Open endpoints need nothing; KEYLESS_MODELS=0 switches them off (tests, or an owner who prefers only their own keys).
    if (p.keyless) return this.env.KEYLESS_MODELS === '0' ? null : '';
    // Google Gemma: its own key when the owner saved one, else the Gemini key (the same Google project allowance page).
    return (await this.vault.get(p.key)) || (p.keyFallback ? (await this.vault.get(p.keyFallback)) || null : null);
  }

  async setOrder(ids: string[]): Promise<void> {
    await this.sput(ORDER_KEY, ids);
  }

  private async models(p: Provider): Promise<string[]> {
    const all = (await this.sget<Record<string, { at: number; ids: string[] }>>(M_KEY)) ?? {};
    const found = all[p.id]?.ids ?? [];
    const extra = found
      .filter((id) => !p.seed.includes(id) && !NOT_CHAT.test(id) && (!p.accept || p.accept(id)))
      .sort((a, b) => modelScore(b) - modelScore(a))
      .slice(0, 6);
    const seeds = found.length ? p.seed.filter((id) => found.includes(id) || id === 'openrouter/free') : p.seed;
    return [...extra.filter((id) => modelScore(id) >= 2), ...seeds, ...extra.filter((id) => modelScore(id) < 2)];
  }

  /** Refresh the list of models each key can reach (small providers only). */
  async discover(force = false): Promise<void> {
    const all = (await this.sget<Record<string, { at: number; ids: string[] }>>(M_KEY)) ?? {};
    for (const p of PROVIDERS) {
      if (p.id === 'openrouter' || p.noDiscovery) continue; // huge or fixed catalogues: the seeds are enough
      const key = await this.vault.get(p.key);
      if (!key) continue;
      if (!force && all[p.id] && Date.now() - all[p.id]!.at < 12 * 3600_000) continue;
      try {
        const r = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${key}` } });
        if (!r.ok) continue;
        const j = (await r.json()) as { data?: { id: string }[] };
        const ids = (j.data ?? []).map((m) => m.id.replace(/^models\//, ''));
        if (ids.length) all[p.id] = { at: Date.now(), ids };
      } catch {
        /* keep previous list */
      }
    }
    await this.sput(M_KEY, all);
  }

  async summary(): Promise<ModelHealth[]> {
    const h = await this.health();
    const out: ModelHealth[] = [];
    const now = Date.now();
    for (const p of await this.order()) {
      if ((await this.keyFor(p)) === null) continue;
      if ((h[`key|${p.id}`]?.dead ?? 0) > now) {
        out.push({ provider: p.name, model: '(key)', state: 'dead', info: 'key rejected — replace it in System' });
        continue;
      }
      const limit = h[`cool|${p.id}`];
      if ((limit?.cool ?? 0) > now) {
        const back = new Date(limit!.cool!);
        out.push({ provider: p.name, model: '(all)', state: 'cool', info: `${limit!.why ?? 'daily limit'} · back ${back.toISOString().slice(11, 16)} UTC` });
        continue;
      }
      for (const m of await this.models(p)) {
        const s = h[`${p.id}|${m}`] ?? {};
        const state = (s.dead ?? 0) > now ? 'dead' : (s.cool ?? 0) > now ? 'cool' : 'ok';
        const info =
          state === 'dead'
            ? s.why ?? 'unavailable'
            : state === 'cool'
              ? `${s.why ?? 'cooling'} · ${Math.ceil(((s.cool ?? now) - now) / 1000)}s`
              : s.ms
                ? `${Math.round(s.ms)} ms`
                : 'ready';
        out.push({ provider: p.name, model: m, state, info });
      }
    }
    return out;
  }

  private async mark(key: string, patch: Health): Promise<void> {
    const h = await this.health();
    h[key] = { ...(h[key] ?? {}), ...patch };
    await this.sput(H_KEY, h);
  }

  /** Forget what went wrong. `keepLimits`: a provider known to be out of allowance for the day stays known (a new key for another provider does not reopen it). */
  async resetHealth(keepLimits = false): Promise<void> {
    const h = keepLimits ? await this.health() : {};
    const kept: Record<string, Health> = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(h)) if (k.startsWith('cool|') && (v.cool ?? 0) > now) kept[k] = v;
    this.mem.delete(H_KEY); // else a paused database would keep serving the old health
    if (!keepLimits) this.quota.forget(); // RE-CHECK MODELS: limits learned from 429s and headers are asked afresh
    await this.storage.delete(H_KEY).catch(() => undefined);
    if (Object.keys(kept).length) await this.sput(H_KEY, kept);
  }

  /**
   * One completion. Returns the assistant message and which model wrote it.
   * `code`: this turn writes code — try strong models before small ones (across every
   * provider, keeping the owner's provider order within each group), with a lower
   * temperature and room for longer replies.
   */
  async complete(messages: Msg[], tools: ToolSpec[], signal?: AbortSignal, opts: CallOptions = {}): Promise<{ message: Msg; model: string }> {
    if (this.env.MOCK_LLM === '1') return inCharacter(messages, await mockComplete(messages, tools));
    await this.quota.load();
    const lane: Priority = opts.priority ?? 'chat';
    const small = opts.tier ? opts.tier === 'small' : !!opts.cheap;
    // When every capable provider is full or only briefly rate-limited, wait for the soonest one (up to
    // maxWait in all) and try again, instead of failing halfway through a long task. 0 never waits.
    const maxWait = opts.maxWaitMs ?? (lane === 'background' ? 90_000 : 45_000);
    const deadline = Date.now() + maxWait;
    for (let round = 0; ; round++) {
      const r = await this.attempt(messages, tools, signal, !!opts.code, small, Math.min(maxWait, SHORT_WAIT_MS), lane);
      if ('message' in r) return inCharacter(messages, r);
      const left = deadline - Date.now();
      if (round >= 12 || r.waitMs > left || signal?.aborted) throw new RouterError(r.error, r.waitMs);
      // The soonest window (or cool-down), with a countdown each second: the owner sees it in chat, and
      // background work uses the tick to deliver reminders that fall due meanwhile.
      let ms = r.waitMs + (r.full ? 50 : 500);
      while (ms > 0 && !signal?.aborted) {
        opts.onWait?.(`waiting for free AI room · ${Math.max(1, Math.round(ms / 1000))} s`);
        const step = Math.min(ms, 1000);
        await sleep(step, signal);
        ms -= step;
      }
      if (signal?.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
    }
  }

  /**
   * The gauge for the SYSTEM tab: per usable provider, the room it has this minute, what it used
   * today against its daily allowance, and when that resets; with one line for the whole lot.
   */
  async capacity(): Promise<AiCapacity> {
    await this.quota.load();
    const h = await this.health();
    const now = Date.now();
    const out: ProviderRoom[] = [];
    for (const p of await this.order()) {
      if ((await this.keyFor(p)) === null || (h[`key|${p.id}`]?.dead ?? 0) > now) continue;
      const kl = this.quota.limits(p.id, p.limits ?? {});
      // Models it can use now (not marked unavailable); for a provider limited model by model, each is its own allowance.
      const models = (await this.models(p)).filter((m) => (h[`${p.id}|${m}`]?.dead ?? 0) <= now);
      // Per minute: the key's own allowance, else the sum of its models'.
      let perMinute = kl.rpm ?? null;
      let roomNow = perMinute === null ? null : Math.max(0, perMinute - this.quota.minute(p.id).req);
      const usedToday = this.quota.day(p.id, p).req;
      const perDay = kl.rpd ?? null;
      let dayLeft: number | undefined;
      let modelsOut = 0;
      if (p.modelLimits && models.length) {
        let pm = 0;
        let rn = 0;
        for (const m of models) {
          const ml = this.quota.limits(`${p.id}|${m}`, p.modelLimits(m));
          pm += ml.rpm ?? 0;
          rn += Math.max(0, (ml.rpm ?? 0) - this.quota.minute(`${p.id}|${m}`).req);
          if (ml.rpd) {
            const left = Math.max(0, ml.rpd - this.quota.day(`${p.id}|${m}`, p).req);
            dayLeft = Math.max(dayLeft ?? 0, left);
            if (!left) modelsOut++;
          }
        }
        if (pm && perMinute === null) {
          perMinute = pm;
          roomNow = rn;
        } else if (pm && roomNow !== null) roomNow = Math.min(roomNow, rn);
      }
      const resetIn = resetDelay(p, now);
      const day = h[`cool|${p.id}`];
      // Full only when no model has room now (each checked with both its counters); back when the soonest one is.
      const rooms = (models.length ? models : [p.seed[0] ?? '']).map((m) => this.room(p, m, 1000, 'chat'));
      const anyRoom = rooms.some((r) => r.ok);
      const soonestRoom = Math.min(...rooms.map((r) => (r.ok ? 0 : r.waitMs)));
      let state: ProviderRoom['state'] = 'ready';
      let backAt: number | undefined;
      if ((day?.cool ?? 0) > now || (perDay !== null && usedToday >= perDay) || (models.length > 0 && modelsOut === models.length)) {
        state = 'out';
        backAt = Math.max(day?.cool ?? 0, resetIn !== null ? now + resetIn : 0) || undefined;
      } else if (!anyRoom) {
        state = 'full';
        backAt = now + (Number.isFinite(soonestRoom) ? Math.min(soonestRoom, 24 * 3600_000) : 60_000);
      } else if (perMinute && roomNow !== null && roomNow < perMinute / 2) state = 'busy';
      out.push({
        provider: p.name,
        state,
        roomNow,
        perMinute,
        usedToday,
        perDay,
        resetAt: resetIn === null ? null : now + resetIn,
        ...(backAt ? { backAt } : {}),
        ...(p.modelLimits && models.length ? { models: models.length, modelsOut, ...(dayLeft !== undefined ? { dayLeft } : {}) } : {}),
        ...(p.smallOnly ? { smallOnly: true } : {}),
      });
    }
    // The summary is about the owner's chat: a provider only for small jobs (Gemma) is not counted as ready.
    const main = out.filter((x) => !x.smallOnly);
    const ready = main.filter((x) => x.state === 'ready' || x.state === 'busy').length;
    const busy = main.filter((x) => x.state === 'busy').length;
    const soonest = Math.min(...main.map((x) => x.backAt ?? Infinity));
    const n = (k: number) => `${k} provider${k === 1 ? '' : 's'}`;
    const summary = !main.length
      ? 'No AI provider yet · add a free key below'
      : !ready
        ? `No room right now · ${Number.isFinite(soonest) ? `room again in ${Math.max(1, Math.ceil((soonest - now) / 1000))} s` : 'every provider is out for today'}`
        : busy * 2 > ready || ready * 2 < main.length
          ? `Getting busy · ${n(ready)} with room`
          : `Plenty of room · ${n(ready)} ready`;
    return { summary, providers: out };
  }

  /**
   * How long until the first usable model is free: 0 when one is free now, ms otherwise, null when
   * no model is usable at all (no keys, or every one marked unavailable). For the owner's "back at".
   */
  async nextFree(): Promise<number | null> {
    const h = await this.health();
    const now = Date.now();
    let soonest: number | null = null;
    for (const p of await this.order()) {
      // For the owner's chat: a small-tier-only provider (Gemma) never answers it.
      if (p.smallOnly || (await this.keyFor(p)) === null || (h[`key|${p.id}`]?.dead ?? 0) > now) continue;
      const provider = Math.max(0, (h[`net|${p.id}`]?.cool ?? 0) - now, (h[`cool|${p.id}`]?.cool ?? 0) - now);
      for (const m of await this.models(p)) {
        const s = h[`${p.id}|${m}`] ?? {};
        if ((s.dead ?? 0) > now) continue;
        const ms = Math.max(provider, (s.cool ?? 0) - now);
        soonest = soonest === null ? ms : Math.min(soonest, ms);
      }
    }
    return soonest;
  }

  /**
   * One pass over every usable model: the answer, or why none answered and how long until one frees
   * up. `shortWait`: a model this close to free is waited for (once per pass) rather than skipped for
   * a worse one, and a 429 asking for a wait this short gets one retry of the same model.
   */
  private async attempt(messages: Msg[], tools: ToolSpec[], signal: AbortSignal | undefined, code: boolean, cheap = false, shortWait = 0, lane: Priority = 'chat'): Promise<{ message: Msg; model: string } | { error: string; waitMs: number; full?: boolean }> {
    const opts = { code };
    let lastErr: LlmError | null = null;
    let anyKey = false;
    let soonest = Infinity;
    const h = await this.health();
    const now = Date.now();
    const candidates: { p: Provider; key: string; model: string }[] = [];
    // A picture in the conversation: only a model that can see it may answer (same order otherwise).
    const vision = hasImage(messages);
    // What this call counts against each allowance before the provider says the real number.
    const est = tokensOf(messages) + tokensOf(tools) + (code ? 3 * REPLY_TOKENS : REPLY_TOKENS);
    for (const p of await this.order()) {
      const key = await this.keyFor(p);
      if (key === null) continue;
      if (p.codeOnly && !opts.code) continue; // keep small free allowances for writing code
      // Small-tier-only providers (Gemma) never take the owner's main chat; no-tool ones only tool-less requests.
      if ((p.smallOnly && !cheap) || (p.noTools && tools.length)) continue;
      anyKey = true;
      // A picture never goes to an open endpoint (no account, shared cached answers): only the owner's own keys or Cloudflare's binding may see it.
      if (vision && p.keyless && p.transport !== 'workers-ai') continue;
      if ((h[`key|${p.id}`]?.dead ?? 0) > now || (h[`net|${p.id}`]?.cool ?? 0) > now) continue;
      // Out of allowance for the day: not tried again until it resets.
      if ((h[`cool|${p.id}`]?.cool ?? 0) > now) {
        soonest = Math.min(soonest, h[`cool|${p.id}`]!.cool! - now);
        continue;
      }
      for (const model of await this.models(p)) if (!vision || visionScore(model) > 0) candidates.push({ p, key, model });
    }
    // No model that can see, and none merely cooling down: say so. (A cooling one falls through to
    // the usual "back in N seconds" answer below, rather than "add a key" to an owner who has one.)
    if (vision && anyKey && !candidates.length && !Number.isFinite(soonest)) return { error: NO_VISION, waitMs: Infinity };
    // Chat: the owner's keys, then Workers AI, then open endpoints. Code: the best coders first.
    // Ghosty's own small jobs (cheap): the small, generously rationed models first.
    if (cheap) candidates.sort((a, b) => cheapScore(b.model, b.p) - cheapScore(a.model, a.p));
    else if (opts.code) candidates.sort((a, b) => codeScore(b.model) - codeScore(a.model)); // stable: provider order breaks ties
    else candidates.sort((a, b) => (a.p.tier ?? 0) - (b.p.tier ?? 0));
    // Background work spreads: the next one tried is the one with the most room this minute (in quarters,
    // so the order above still decides between ones about as free), chosen at the moment of trying so
    // calls started together see each other's counts. The owner's chat keeps the best model first.
    const level = (c: { p: Provider; model: string }) => Math.floor(this.room(c.p, c.model, est, lane).load * 4);
    const queue = [...candidates];
    const next = () => {
      if (lane !== 'background' || queue.length < 2) return queue.shift()!;
      let best = 0;
      let bestLevel = level(queue[0]!);
      for (let i = 1; i < queue.length && bestLevel > 0; i++) {
        const l = level(queue[i]!);
        if (l < bestLevel) [best, bestLevel] = [i, l];
      }
      return queue.splice(best, 1)[0]!;
    };
    const skipProvider = new Set<string>();
    const tooBig = new Set<string>();
    let tried = 0;
    let waited = false;
    let roomWait = Infinity;
    let fits = false;
    while (queue.length) {
      const { p, key, model } = next();
      if (skipProvider.has(p.id)) continue;
      const s = h[`${p.id}|${model}`] ?? {};
      if ((s.dead ?? 0) > now) continue;
      const left = (s.cool ?? 0) - Date.now();
      if (left > 0) {
        // The best model left is nearly free: wait for it (once per pass) rather than take a worse one.
        if (left <= shortWait && !waited && !signal?.aborted) {
          waited = true;
          await sleep(left + 200, signal);
          if (signal?.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
        } else {
          soonest = Math.min(soonest, left);
          continue;
        }
      }
      let retried = false;
      for (;;) {
        // The counters first: a call they say would bounce is not sent. Checked and counted with no
        // pause in between, so calls started together never all pick the same last free slot.
        const room = this.room(p, model, est, lane);
        if (!room.ok) {
          if (Number.isFinite(room.waitMs)) {
            fits = true;
            roomWait = Math.min(roomWait, room.waitMs);
          } else tooBig.add(`${p.id}|${model}`);
          break;
        }
        fits = true;
        const settle = this.quota.take(keysOf(p, model), est);
        if (!retried) tried++;
        const t0 = Date.now();
        try {
          const { message, tokens } = await this.call(p, key, model, messages, tools, signal, !!opts.code, lane);
          settle(tokens, true);
          await this.mark(`${p.id}|${model}`, { cool: 0, dead: 0, why: '', ms: Date.now() - t0 });
          await this.sput('llm:last', `${p.name} · ${model}`);
          return { message, model: `${p.name} · ${model}` };
        } catch (err) {
          const e = err as LlmError;
          // A request that never reached the provider costs nothing; anything else keeps its count.
          settle(e?.code === 'too-big' || e?.net ? 0 : undefined);
          if ((err as Error)?.name === 'AbortError') throw err;
          if (e.code === 'too-big') {
            tooBig.add(`${p.id}|${model}`);
            break; // this model's free tier can't take a request this size; not its fault
          }
          // A per-second limit with a short stated wait: sit it out and ask the same model once more.
          const again = e.code === 429 ? statedWait(e) : 0;
          if (e.code === 429) {
            // The counters let this through, so the real limit is lower: learn it.
            const c = classify(e);
            const dayLimit = Number((e.message || '').match(/limit:\s*(\d+)/i)?.[1]) || undefined;
            this.quota.learn429(limitKey(p, model), again, { daily: !!c.daily, dayLimit, holdKey: `${p.id}|${model}`, perMinute: perMinuteLimit(e.message) });
          }
          // One short wait per pass (shared with the cooling wait above): several rate-limited models must not add up to a minute of silence.
          if (!retried && !waited && again > 0 && again <= shortWait && !signal?.aborted) {
            retried = true;
            waited = true;
            await sleep(again + 200, signal);
            if (signal?.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
            continue;
          }
          lastErr = e;
          const c = classify(e);
          if (c.kind === 'key') await this.mark(`key|${p.id}`, { dead: Date.now() + c.ms, why: c.why });
          else if (c.kind === 'net') await this.mark(`net|${p.id}`, { cool: Date.now() + c.ms, why: c.why });
          else if (c.kind === 'dead') await this.mark(`${p.id}|${model}`, { dead: Date.now() + c.ms, why: c.why });
          else if (c.daily) {
            // The whole provider's allowance is gone: remember it until the reset, and stop asking its other models today.
            await this.mark(`cool|${p.id}`, { cool: Date.now() + (resetDelay(p) ?? c.ms), why: c.why });
            skipProvider.add(p.id);
          } else await this.mark(`${p.id}|${model}`, { cool: Date.now() + c.ms, why: c.why });
          if (c.kind === 'key' || c.kind === 'net') skipProvider.add(p.id); // skip the rest of this provider
          break;
        }
      }
    }
    if (!anyKey) return { error: 'No AI model is available. Add a free Gemini or Groq key in the System tab.', waitMs: Infinity };
    // Every model that can see is marked unavailable (none is merely cooling): say so, rather than "rate limits".
    if (vision && !tried && !Number.isFinite(soonest)) return { error: NO_VISION, waitMs: Infinity };
    // How long until the first model is usable again (including ones that just failed).
    const after = await this.health();
    const t = Date.now();
    for (const { p, model } of candidates) {
      const s = after[`${p.id}|${model}`] ?? {};
      if ((s.dead ?? 0) > t || (after[`key|${p.id}`]?.dead ?? 0) > t || tooBig.has(`${p.id}|${model}`)) continue;
      const r = this.room(p, model, est, lane);
      if (!Number.isFinite(r.waitMs)) continue;
      soonest = Math.min(soonest, Math.max(r.ok ? 0 : r.waitMs, (s.cool ?? 0) - t, (after[`net|${p.id}`]?.cool ?? 0) - t, (after[`cool|${p.id}`]?.cool ?? 0) - t));
    }
    const wait = Number.isFinite(soonest) ? ` The first one frees up in about ${Math.ceil(soonest / 1000)} seconds.` : '';
    // Nothing was sent because the counters say every capable provider is full: a wait for the soonest window.
    if (!tried && !lastErr && Number.isFinite(roomWait)) {
      const more = lane === 'background' ? ' (the room kept for your chat is not used by background work)' : '';
      return { error: `Every model I can reach is full for now (free limits)${more}.${wait} Another free key in the System tab gives me more room.`, waitMs: Number.isFinite(soonest) ? soonest : roomWait, full: true };
    }
    if (!tried && !lastErr && !fits && tooBig.size) return { error: 'Every model I can reach is too small for a request this big on its free plan. Try a shorter message, or start a new chat.', waitMs: Infinity };
    if (!lastErr) return { error: `Every model I can reach is cooling down after rate limits.${wait} Another free key in the System tab gives me more room.`, waitMs: soonest };
    return { error: `Every model I can reach is busy or failing right now (last error: ${lastErr.code ?? ''} ${lastErr.message.slice(0, 160)}).${wait}`, waitMs: soonest };
  }

  /** One request to one model: its reply, and the tokens the provider says it used (for the counters). */
  private async call(p: Provider, key: string, model: string, messagesIn: Msg[], toolsIn: ToolSpec[], signal?: AbortSignal, code = false, lane: Priority = 'chat'): Promise<{ message: Msg; tokens?: number }> {
    let messages = messagesIn;
    let tools = toolsIn;
    if (p.maxIn) {
      const slim = slimToFit(messagesIn, toolsIn, p.maxIn - (code ? 400 : 200));
      if (!slim) throw { code: 'too-big', message: 'request too large for this free tier' } satisfies LlmError;
      ({ messages, tools } = slim);
    }
    if (p.noSystem) messages = foldSystem(messages);
    if (p.transport === 'workers-ai') return { message: await this.callWorkersAi(model, messages, tools, code, lane) };
    const minimal: Record<string, unknown> = { model, messages, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
    const tuned: Record<string, unknown> = { ...minimal, temperature: code ? 0.2 : 0.4 };
    // Code needs room: a reply cut off mid-edit breaks the tool call's arguments.
    const out = code ? (p.maxOut ?? 8192) : 4096;
    if (/gpt-oss/.test(model)) Object.assign(tuned, { reasoning_effort: code ? 'medium' : 'low', max_completion_tokens: out + 2000 });
    else tuned.max_tokens = out;
    const limit = p.timeoutMs ?? 60_000;
    for (const body of [tuned, minimal]) {
      if (signal?.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), limit);
      const onAbort = () => ctl.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let r: Response;
      try {
        r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (signal?.aborted) throw e;
        if ((e as Error)?.name === 'AbortError') throw { timeout: true, message: `no response in ${Math.round(limit / 1000)}s` } satisfies LlmError;
        throw { net: true, message: String((e as Error)?.message ?? e) } satisfies LlmError;
      }
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      // What the provider says about its limits (both on answers and on refusals) tunes the counters.
      // Headers describe the counter the provider limits by: the model's when it limits models one by one.
      this.quota.learnHeaders(limitKey(p, model), r.headers);
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        if (r.status === 400 && body === tuned && !/(not found|does not exist|decommission|tool)/i.test(text)) continue;
        throw { code: r.status, message: text.slice(0, 400), retryAfter: r.headers.get('retry-after') } satisfies LlmError;
      }
      const j = (await r.json()) as { choices?: { message?: Msg }[]; error?: { message?: string }; usage?: { total_tokens?: number } };
      const msg = j.choices?.[0]?.message;
      if (!msg) throw { code: 500, message: j.error?.message ?? 'empty reply' } satisfies LlmError;
      const content = typeof msg.content === 'string' ? msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : null;
      const calls = (msg.tool_calls ?? []).filter((c) => c?.function?.name);
      if (!content && !calls.length) throw { code: 500, message: 'empty reply' } satisfies LlmError;
      const message: Msg = {
        role: 'assistant',
        content: content || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c, i) => ({
                id: c.id || `call_${Date.now()}_${i}`,
                type: 'function' as const,
                function: { name: c.function.name, arguments: c.function.arguments || '{}' },
              })),
            }
          : {}),
      };
      const used = j.usage?.total_tokens;
      return { message, ...(typeof used === 'number' && used > 0 ? { tokens: used } : {}) };
    }
    throw { code: 400, message: 'bad request' } satisfies LlmError;
  }

  /** Cloudflare Workers AI through the AI binding. Replies come in a few shapes; all are normalised. */
  private async callWorkersAi(model: string, messages: Msg[], tools: ToolSpec[], code: boolean, lane: Priority = 'chat'): Promise<Msg> {
    const ai = this.env.AI;
    if (!ai) throw { code: 401, message: 'no AI binding' } satisfies LlmError;
    // The day's Workers AI allowance is shared (neurons.ts): this call must leave hearing its reserve.
    // Background work (study, projects, the weekly self-training factory) leaves more: the owner's chat, hearing and the voices come first.
    const use = lane === 'background' ? 'background' : 'chat';
    const asked = tokensOf(messages) + (code ? 2000 : 600);
    if (!(await neurons().room(use, cost.chat(asked)))) throw { code: 429, message: "today's free Workers AI is nearly used up (the rest is kept for hearing the owner)", retryAfter: '3600' } satisfies LlmError;
    let res: unknown;
    try {
      res = await ai.run(model, {
        messages: messages.map((m) => (m.role === 'tool' ? { role: 'tool', tool_call_id: m.tool_call_id, content: textOf(m.content) } : m)),
        ...(tools.length ? { tools } : {}),
        max_tokens: code ? 8192 : 4096,
        temperature: code ? 0.2 : 0.4,
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      const daily = /(neuron|daily|quota)/i.test(msg);
      const rate = daily || /(429|too many|rate.?limit|limit)/i.test(msg); // a short limit: cool down briefly, not for an hour
      throw { code: rate ? 429 : /not found|no such model|invalid model/i.test(msg) ? 404 : 500, message: msg.slice(0, 300), retryAfter: daily ? '3600' : null } satisfies LlmError;
    }
    const msg = normaliseWorkersAi(res, new Set(tools.map((t) => t.function.name)));
    await neurons().charge(use, cost.chat(tokensOf(messages) + (msg ? tokensOf(msg) : 0)));
    if (!msg) throw { code: 500, message: 'empty reply' } satisfies LlmError;
    return msg;
  }
}

/** For a model with no system instructions (Gemma): the system text goes in front of the first owner message. */
export function foldSystem(messages: Msg[]): Msg[] {
  if (messages[0]?.role !== 'system') return messages;
  const sys = textOf(messages[0].content);
  const rest = messages.slice(1);
  const i = rest.findIndex((m) => m.role === 'user');
  if (i < 0) return [{ role: 'user', content: sys }, ...rest];
  const u = rest[i]!;
  const content: Content = Array.isArray(u.content) ? [{ type: 'text', text: `${sys}\n\n` }, ...u.content] : `${sys}\n\n${textOf(u.content)}`;
  return [...rest.slice(0, i), { ...u, content }, ...rest.slice(i + 1)];
}

/** Rough token count (≈3.6 characters per token for English, code and JSON); a picture counts as IMAGE_TOKENS, not as its data URL. */
function tokensOf(x: unknown): number {
  if (Array.isArray(x)) return x.reduce((n: number, y) => n + tokensOf(y), 0);
  const m = x as Msg | null;
  if (m && typeof m === 'object' && Array.isArray(m.content)) {
    const images = m.content.filter((p) => p.type === 'image_url').length;
    return tokensOf({ ...m, content: textOf(m.content) }) + images * IMAGE_TOKENS;
  }
  return Math.ceil(JSON.stringify(x).length / 3.6);
}

/** Tools that matter when writing code — everything else is dropped to fit a small request. */
const CORE_CODE_TOOLS = /^(study|repo_|propose_change|update_change|change_status|wait_for_checks|discard_change|list_changes|learn_lesson|self_audit|plan_upgrade|roadmap|update_step|web_search|web_fetch|remember|reload_interface|create_widget)/;

/**
 * Fit a request into `budget` tokens: first keep only coding tools, then shorten old
 * tool outputs, then drop the oldest turns (never the system prompt or the latest
 * owner message). Returns null if it still can't fit.
 */
export function slimToFit(messages: Msg[], tools: ToolSpec[], budget: number): { messages: Msg[]; tools: ToolSpec[] } | null {
  if (tokensOf(messages) + tokensOf(tools) <= budget) return { messages, tools };
  let t = tools.filter((x) => CORE_CODE_TOOLS.test(x.function.name)).map((x) => ({ ...x, function: { ...x.function, description: x.function.description.slice(0, 220) } }));
  const sys = messages[0]?.role === 'system' ? messages[0] : null;
  let rest = (sys ? messages.slice(1) : messages).map((m, i, arr) => (m.role === 'tool' && i < arr.length - 2 && typeof m.content === 'string' && m.content.length > 900 ? { ...m, content: `${m.content.slice(0, 900)}…[shortened]` } : m));
  let system = sys ? { ...sys, content: textOf(sys.content).slice(0, 9000) } : null;
  const size = () => tokensOf(rest) + tokensOf(t) + (system ? tokensOf(system) : 0);
  // drop oldest turns, keeping tool results attached to their call
  while (size() > budget && rest.length > 2) {
    rest = rest.slice(1);
    while (rest.length && rest[0]!.role === 'tool') rest = rest.slice(1);
  }
  if (size() > budget && system) system = { ...system, content: textOf(system.content).slice(0, Math.max(1500, (budget - tokensOf(rest) - tokensOf(t)) * 3)) };
  if (size() > budget) t = t.filter((x) => /^(repo_read|propose_change|update_change|wait_for_checks)$/.test(x.function.name));
  if (size() > budget) return null;
  return { messages: system ? [system, ...rest] : rest, tools: t };
}

/** Workers AI replies: OpenAI-style `choices`, the classic `{response, tool_calls}`, or Responses-style `output`. */
export function normaliseWorkersAi(res: unknown, toolNames: Set<string> = new Set()): Msg | null {
  const r = (res ?? {}) as Record<string, unknown>;
  const toCalls = (list: { id?: string; call_id?: string; name?: string; arguments?: unknown; function?: { name?: string; arguments?: unknown } }[]) =>
    list
      .map((c, i) => {
        const name = c.function?.name ?? c.name;
        const args = c.function?.arguments ?? c.arguments ?? {};
        return name ? { id: c.id || c.call_id || `call_${Date.now()}_${i}`, type: 'function' as const, function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } } : null;
      })
      .filter((x): x is ToolCall => !!x);
  const clean = (t: unknown) => (typeof t === 'string' ? t.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '');
  let content = '';
  let calls: ToolCall[] = [];
  const choice = (r.choices as { message?: { content?: unknown; tool_calls?: [] } }[] | undefined)?.[0]?.message;
  if (choice) {
    content = clean(choice.content);
    calls = toCalls(choice.tool_calls ?? []);
  } else if (Array.isArray(r.output)) {
    for (const item of r.output as { type?: string; content?: { text?: string }[]; name?: string; arguments?: string; call_id?: string }[]) {
      if (item.type === 'message') content += (item.content ?? []).map((c) => c.text ?? '').join('');
      if (item.type === 'function_call') calls.push(...toCalls([item]));
    }
    content = clean(content);
  } else {
    content = clean(r.response);
    calls = toCalls((r.tool_calls as []) ?? []);
  }
  // Some models write the call as JSON text instead: {"name": "weather", "parameters": {...}}
  if (!calls.length && toolNames.size && /^\s*(```(json)?\s*)?[[{]/.test(content)) {
    try {
      const v = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')) as unknown;
      const list = (Array.isArray(v) ? v : [v]) as { name?: string; parameters?: unknown; arguments?: unknown }[];
      const found = list.filter((x) => x && typeof x.name === 'string' && toolNames.has(x.name));
      if (found.length) {
        calls = toCalls(found.map((x) => ({ name: x.name, arguments: x.parameters ?? x.arguments ?? {} })));
        content = '';
      }
    } catch {
      /* ordinary text that happens to start with a bracket */
    }
  }
  if (!content && !calls.length) return null;
  return { role: 'assistant', content: content || null, ...(calls.length ? { tool_calls: calls } : {}) };
}
