/**
 * Model router: sends one chat-completion request, trying every reachable free model
 * in order until one answers. Models that hit rate limits are cooled down; models that
 * no longer exist (or reject tool calling) are skipped for 12 hours. All of this state
 * lives in the agent's Durable Object storage, so it survives restarts.
 */
import type { Env } from '../env';
import type { Vault } from '../kernel/vault';
import type { ModelHealth } from '../../../../packages/shared/src/protocol';
import { PROVIDERS, NOT_CHAT, modelScore, type Provider } from './providers';
import { mockComplete } from './mock';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Msg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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
  code?: number | string;
  message: string;
  retryAfter?: string | null;
  net?: boolean;
  timeout?: boolean;
}

const H_KEY = 'llm:health';
const M_KEY = 'llm:models';
const ORDER_KEY = 'llm:order';

const parseDur = (s: string | null | undefined): number => {
  if (!s) return 0;
  let t = 0;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/g)) {
    t += parseFloat(m[1]!) * ({ ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 'ms'] ?? 1);
  }
  if (!t && /^\d+(\.\d+)?$/.test(s)) t = parseFloat(s);
  return t * 1000;
};

/** Decide what a failure means: cool down briefly, skip for hours, or blame the key. */
function classify(e: LlmError): { kind: 'cool' | 'dead' | 'key' | 'net'; ms: number; why: string } {
  const msg = (e.message || '').toLowerCase();
  if (e.net) return { kind: 'net', ms: 45_000, why: 'network' };
  if (e.timeout) return { kind: 'cool', ms: 45_000, why: 'timeout' };
  const c = typeof e.code === 'number' ? e.code : 0;
  if (c === 401 || (c === 403 && /key|auth|permission/.test(msg))) return { kind: 'key', ms: 6 * 3600_000, why: 'key rejected' };
  if (c === 402) return { kind: 'cool', ms: 3600_000, why: 'no credits' };
  if (c === 429) {
    let ms = parseDur(e.retryAfter);
    const m = msg.match(/try again in ([\d.hms ]+)/);
    if (m) ms = Math.max(ms, parseDur(m[1]));
    const daily = /per day|daily|rpd|tpd/.test(msg);
    ms = ms || (daily ? 3600_000 : 60_000);
    return { kind: 'cool', ms: Math.min(ms + 1500, 8 * 3600_000), why: daily ? 'daily limit' : 'rate limit' };
  }
  if (c === 404 || c === 410 || (c === 400 && /(decommission|deprecat|not found|does not exist|unknown model|not supported|does not support tools|tool use|function calling)/.test(msg))) {
    return { kind: 'dead', ms: 12 * 3600_000, why: 'unavailable or no tool support' };
  }
  if (c === 403) return { kind: 'dead', ms: 12 * 3600_000, why: 'no access' };
  if (c === 413) return { kind: 'cool', ms: 60_000, why: 'request too large' };
  if (c >= 500 || c === 408 || c === 409) return { kind: 'cool', ms: 25_000, why: 'server busy' };
  return { kind: 'cool', ms: 30_000, why: 'error' };
}

export class Router {
  constructor(
    private storage: DurableObjectStorage,
    private vault: Vault,
    private env: Env,
  ) {}

  private async health(): Promise<Record<string, Health>> {
    return (await this.storage.get<Record<string, Health>>(H_KEY)) ?? {};
  }

  private async order(): Promise<Provider[]> {
    const pref = (await this.storage.get<string[]>(ORDER_KEY)) ?? [];
    return [...PROVIDERS].sort((a, b) => {
      const ia = pref.indexOf(a.id);
      const ib = pref.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  async setOrder(ids: string[]): Promise<void> {
    await this.storage.put(ORDER_KEY, ids);
  }

  private async models(p: Provider): Promise<string[]> {
    const all = (await this.storage.get<Record<string, { at: number; ids: string[] }>>(M_KEY)) ?? {};
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
    const all = (await this.storage.get<Record<string, { at: number; ids: string[] }>>(M_KEY)) ?? {};
    for (const p of PROVIDERS) {
      if (p.id === 'openrouter') continue; // its catalogue is huge; the free router is enough
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
    await this.storage.put(M_KEY, all);
  }

  async summary(): Promise<ModelHealth[]> {
    const h = await this.health();
    const out: ModelHealth[] = [];
    const now = Date.now();
    for (const p of await this.order()) {
      if (!(await this.vault.has(p.key))) continue;
      if ((h[`key|${p.id}`]?.dead ?? 0) > now) {
        out.push({ provider: p.name, model: '(key)', state: 'dead', info: 'key rejected — replace it in System' });
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
    await this.storage.put(H_KEY, h);
  }

  async resetHealth(): Promise<void> {
    await this.storage.delete(H_KEY);
  }

  /** One completion. Returns the assistant message and which model wrote it. */
  async complete(messages: Msg[], tools: ToolSpec[], signal?: AbortSignal): Promise<{ message: Msg; model: string }> {
    if (this.env.MOCK_LLM === '1') return mockComplete(messages, tools);
    let lastErr: LlmError | null = null;
    let anyKey = false;
    let soonest = Infinity;
    {
      const h = await this.health();
      const now = Date.now();
      for (const p of await this.order()) {
        const key = await this.vault.get(p.key);
        if (!key) continue;
        anyKey = true;
        if ((h[`key|${p.id}`]?.dead ?? 0) > now || (h[`net|${p.id}`]?.cool ?? 0) > now) continue;
        for (const model of await this.models(p)) {
          const s = h[`${p.id}|${model}`] ?? {};
          if ((s.dead ?? 0) > now) continue;
          if ((s.cool ?? 0) > now) {
            soonest = Math.min(soonest, s.cool! - now);
            continue;
          }
          const t0 = Date.now();
          try {
            const message = await this.call(p, key, model, messages, tools, signal);
            await this.mark(`${p.id}|${model}`, { cool: 0, dead: 0, why: '', ms: Date.now() - t0 });
            await this.storage.put('llm:last', `${p.name} · ${model}`);
            return { message, model: `${p.name} · ${model}` };
          } catch (err) {
            if ((err as Error)?.name === 'AbortError') throw err;
            const e = err as LlmError;
            lastErr = e;
            const c = classify(e);
            if (c.kind === 'key') await this.mark(`key|${p.id}`, { dead: Date.now() + c.ms, why: c.why });
            else if (c.kind === 'net') await this.mark(`net|${p.id}`, { cool: Date.now() + c.ms, why: c.why });
            else if (c.kind === 'dead') await this.mark(`${p.id}|${model}`, { dead: Date.now() + c.ms, why: c.why });
            else await this.mark(`${p.id}|${model}`, { cool: Date.now() + c.ms, why: c.why });
            if (c.kind === 'key' || c.kind === 'net') break; // skip the rest of this provider
          }
        }
      }
    }
    if (!anyKey) throw new Error('No AI key is set. Add a free Gemini or Groq key in the System tab.');
    if (!lastErr) {
      const wait = Number.isFinite(soonest) ? ` The first one frees up in about ${Math.ceil(soonest / 1000)} seconds.` : '';
      throw new Error(`Every model I can reach is cooling down after rate limits.${wait}`);
    }
    throw new Error(`Every model I can reach is busy or failing right now (last error: ${lastErr.code ?? ''} ${lastErr.message.slice(0, 160)}).`);
  }

  private async call(p: Provider, key: string, model: string, messages: Msg[], tools: ToolSpec[], signal?: AbortSignal): Promise<Msg> {
    const minimal: Record<string, unknown> = { model, messages, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
    const tuned: Record<string, unknown> = { ...minimal, temperature: 0.4 };
    if (/gpt-oss/.test(model)) Object.assign(tuned, { reasoning_effort: 'low', max_completion_tokens: 6000 });
    else tuned.max_tokens = 4096;
    for (const body of [tuned, minimal]) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 60_000);
      const onAbort = () => ctl.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let r: Response;
      try {
        r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (signal?.aborted) throw e;
        if ((e as Error)?.name === 'AbortError') throw { timeout: true, message: 'no response in 60s' } satisfies LlmError;
        throw { net: true, message: String((e as Error)?.message ?? e) } satisfies LlmError;
      }
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        if (r.status === 400 && body === tuned && !/(not found|does not exist|decommission|tool)/i.test(text)) continue;
        throw { code: r.status, message: text.slice(0, 400), retryAfter: r.headers.get('retry-after') } satisfies LlmError;
      }
      const j = (await r.json()) as { choices?: { message?: Msg }[]; error?: { message?: string } };
      const msg = j.choices?.[0]?.message;
      if (!msg) throw { code: 500, message: j.error?.message ?? 'empty reply' } satisfies LlmError;
      const content = typeof msg.content === 'string' ? msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : null;
      const calls = (msg.tool_calls ?? []).filter((c) => c?.function?.name);
      if (!content && !calls.length) throw { code: 500, message: 'empty reply' } satisfies LlmError;
      return {
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
    }
    throw { code: 400, message: 'bad request' } satisfies LlmError;
  }
}
