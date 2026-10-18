/**
 * The quota engine: how much of each free allowance is used, so a call goes where there is room.
 *
 * Free AI allowances are mostly per minute (requests and tokens), with a daily cap on top. A burst
 * of work sent down a fixed list hammers the first provider until it answers 429 and then sits out
 * its cool-down; with the counts in hand the router spreads the same work over every provider with
 * room and never sends a call the counts say will bounce.
 *
 * - Counters: a sliding minute (one entry per call: when, tokens) and hourly buckets for the day,
 *   per counter key (a provider's whole key, or one model of it). In memory, shared by every Router
 *   on the same Durable Object storage, and saved to that storage at most every SAVE_MS (no write storm).
 * - Two lanes: 'chat' (the owner is waiting) may use everything; 'background' (study, projects,
 *   scheduled jobs…) only what is left above CHAT_RESERVE of each allowance, and queues for it.
 * - Learning: rate-limit headers (Groq, Cerebras, OpenRouter, Mistral…) lower a limit or hold a
 *   counter until its stated reset; a 429 lowers the per-minute limit to what got through.
 */
import { resetDelay, type Limits, type Provider } from './providers';

export type Priority = 'chat' | 'background';

/** Share of each allowance kept for the owner's chat: background work never takes it. */
export const CHAT_RESERVE = 0.3;
/** Counters reach the database at most this often. */
export const SAVE_MS = 5_000;
const MINUTE = 60_000;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** What is learned from a 429 or a header is forgotten after this (limits come back). */
const LEARN_TTL = 6 * HOUR;
export const Q_KEY = 'llm:quota';

interface Counter {
  /** The last minute: [when, tokens] per call, oldest first. */
  m: [number, number][];
  /** The last day: [hour index, requests, tokens] per hour with calls, oldest first. */
  h: [number, number, number][];
  /** Calls running now (not saved). */
  run?: number;
}
interface Learned {
  rpm?: number;
  tpm?: number;
  rpd?: number;
  tpd?: number;
  /** Nothing is sent before this (a header said 0 left, or a 429 said wait). */
  hold?: number;
  at: number;
}
interface Saved {
  c: Record<string, Counter>;
  l: Record<string, Learned>;
}

/** Why a counter has no room, and how long until it has. */
export interface Room {
  ok: boolean;
  /** ms until there is room (Infinity: this call can never fit, e.g. bigger than a minute's tokens). */
  waitMs: number;
  /** How full the tightest per-minute allowance is after this call: 0 empty … 1 full (for spreading). */
  load: number;
  why?: string;
}

/** The background lane's share of an allowance (at least one call where the allowance has two or more). */
export const backgroundShare = (n: number): number => (n >= 2 ? Math.max(1, Math.floor(n * (1 - CHAT_RESERVE))) : n);

const parseDur = (s: string): number => {
  let t = 0;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/g)) t += parseFloat(m[1]!) * ({ ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 'ms'] ?? 1);
  return t * 1000;
};
/** A reset header: a duration ("2m59.56s"), seconds ("7.66"), or a moment (epoch seconds or ms). In ms from now. */
export function resetIn(v: string, now = Date.now()): number {
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 1e12) return Math.max(0, n - now);
    if (n > 1e9) return Math.max(0, n * 1000 - now);
    return n * 1000;
  }
  return parseDur(s);
}

export class Quota {
  private c: Record<string, Counter> = {};
  private l: Record<string, Learned> = {};
  private loaded: Promise<void> | null = null;
  private lastSave = 0;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: DurableObjectStorage | null,
    public now: () => number = Date.now,
  ) {}

  /** Counters from the last save (once per brain). A paused database just starts from empty. */
  load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const s = await this.storage?.get<Saved>(Q_KEY);
        if (s?.c) this.c = { ...s.c, ...this.c };
        if (s?.l) this.l = { ...s.l, ...this.l };
      } catch {
        /* database paused: counting from now */
      }
    })();
    return this.loaded;
  }

  /** Save if the last save is old enough; otherwise once, a little later. Never more often than SAVE_MS. */
  private touch(): void {
    this.dirty = true;
    if (!this.storage) return;
    const wait = this.lastSave + SAVE_MS - this.now();
    if (wait <= 0) return void this.flush();
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, wait);
    (this.timer as { unref?: () => void }).unref?.();
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.storage) return;
    this.dirty = false;
    this.lastSave = this.now();
    this.prune();
    try {
      await this.storage.put(Q_KEY, { c: this.c, l: this.l } satisfies Saved);
    } catch {
      /* database paused: the counts live on in memory */
    }
  }

  private prune(): void {
    const t = this.now();
    for (const [k, c] of Object.entries(this.c)) {
      c.m = c.m.filter((e) => e[0] > t - MINUTE);
      c.h = c.h.filter((e) => e[0] > Math.floor((t - DAY) / HOUR));
      if (!c.m.length && !c.h.length && !c.run) delete this.c[k];
    }
    for (const [k, l] of Object.entries(this.l)) if (l.at < t - LEARN_TTL && (l.hold ?? 0) < t) delete this.l[k];
  }

  private counter(key: string): Counter {
    const c = (this.c[key] ??= { m: [], h: [] });
    const t = this.now();
    while (c.m.length && c.m[0]![0] <= t - MINUTE) c.m.shift();
    return c;
  }

  /** The limits in force: the configured ones, lowered by anything learned. */
  limits(key: string, base: Limits): Limits {
    const l = this.l[key];
    if (!l || (l.at < this.now() - LEARN_TTL && (l.hold ?? 0) < this.now())) return base;
    const low = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
    return { ...base, rpm: low(base.rpm, l.rpm), tpm: low(base.tpm, l.tpm), rpd: low(base.rpd, l.rpd), tpd: low(base.tpd, l.tpd) };
  }

  /** Requests and tokens since the day's reset (a rolling 24 hours when the provider has no fixed reset). */
  day(key: string, p?: Pick<Provider, 'reset'>): { req: number; tok: number } {
    const c = this.counter(key);
    const t = this.now();
    const left = p ? resetDelay(p as Provider, t) : null;
    const since = left === null ? t - DAY : t + left - DAY;
    let req = 0;
    let tok = 0;
    for (const [hr, r, k] of c.h) if ((hr + 1) * HOUR > since) {
      req += r;
      tok += k;
    }
    return { req, tok };
  }

  /** The last minute's requests and tokens. */
  minute(key: string): { req: number; tok: number } {
    const c = this.counter(key);
    return { req: c.m.length, tok: c.m.reduce((n, e) => n + e[1], 0) };
  }

  /** Is there room for one call of `tokens` on this counter, in this lane? */
  room(key: string, base: Limits, tokens: number, lane: Priority, p?: Pick<Provider, 'reset'>): Room {
    const L = this.limits(key, base);
    const c = this.counter(key);
    const t = this.now();
    const share = (n: number) => (lane === 'background' ? backgroundShare(n) : n);
    const hold = this.l[key]?.hold ?? 0;
    if (hold > t) return { ok: false, waitMs: hold - t, load: 1, why: 'told to wait' };
    if (L.tpm && tokens > L.tpm) return { ok: false, waitMs: Infinity, load: 1, why: 'request bigger than a minute allows' };
    if (L.tpd && tokens > L.tpd) return { ok: false, waitMs: Infinity, load: 1, why: 'request bigger than a day allows' };
    let wait = 0;
    let why = '';
    const later = (ms: number, w: string) => {
      if (ms > wait) {
        wait = ms;
        why = w;
      }
    };
    if (L.gapMs && c.m.length) later(c.m[c.m.length - 1]![0] + L.gapMs - t, 'one call at a time');
    if (L.conc && (c.run ?? 0) >= L.conc) later(1000, 'calls running');
    if (L.rpm) {
      const cap = share(L.rpm);
      // The entry whose expiry frees a slot.
      if (c.m.length >= cap) later(c.m[c.m.length - cap]![0] + MINUTE - t, 'requests per minute');
    }
    if (L.tpm) {
      const cap = share(L.tpm);
      let used = c.m.reduce((n, e) => n + e[1], 0);
      if (used + tokens > cap) {
        for (const e of c.m) {
          used -= e[1];
          if (used + tokens <= cap) {
            later(e[0] + MINUTE - t, 'tokens per minute');
            break;
          }
        }
        if (used + tokens > cap) later(MINUTE, 'tokens per minute');
      }
    }
    if (L.rpd || L.tpd) {
      const d = this.day(key, p);
      const full = (L.rpd && d.req + 1 > share(L.rpd)) || (L.tpd && d.tok + tokens > share(L.tpd));
      if (full) {
        const left = p ? resetDelay(p as Provider, t) : null;
        // A rolling day: room comes back as the oldest hour of calls leaves it.
        const oldest = c.h[0] ? (c.h[0][0] + 1) * HOUR + DAY - t : HOUR;
        later(Math.max(1000, left ?? oldest), 'daily allowance');
      }
    }
    const loads = [L.rpm ? (c.m.length + 1) / L.rpm : 0, L.tpm ? (c.m.reduce((n, e) => n + e[1], 0) + tokens) / L.tpm : 0, L.rpd ? (this.day(key, p).req + 1) / L.rpd : 0];
    const load = Math.min(1, Math.max(...loads));
    return wait > 0 ? { ok: false, waitMs: wait, load, why } : { ok: true, waitMs: 0, load };
  }

  /** Count one call now (before it is sent, so calls started together see each other). Returns a settle function for the real token count. */
  take(keys: string[], tokens: number): (realTokens?: number) => void {
    const t = this.now();
    const hr = Math.floor(t / HOUR);
    const entries: { m: [number, number]; h: [number, number, number] }[] = [];
    for (const key of keys) {
      const c = this.counter(key);
      const m: [number, number] = [t, tokens];
      c.m.push(m);
      let h = c.h[c.h.length - 1];
      if (!h || h[0] !== hr) c.h.push((h = [hr, 0, 0]));
      h[1]++;
      h[2] += tokens;
      c.run = (c.run ?? 0) + 1;
      entries.push({ m, h });
    }
    this.touch();
    let done = false;
    return (real) => {
      if (done) return;
      done = true;
      keys.forEach((key, i) => {
        const c = this.c[key];
        if (c) c.run = Math.max(0, (c.run ?? 1) - 1);
        if (real !== undefined && Number.isFinite(real) && real >= 0) {
          const e = entries[i]!;
          e.h[2] += real - e.m[1];
          e.m[1] = real;
        }
      });
      this.touch();
    };
  }

  private learn(key: string, patch: Partial<Learned>): void {
    const cur = this.l[key];
    const fresh = cur && cur.at > this.now() - LEARN_TTL ? cur : { at: 0 };
    const low = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
    this.l[key] = {
      rpm: low(fresh.rpm, patch.rpm),
      tpm: low(fresh.tpm, patch.tpm),
      rpd: low(fresh.rpd, patch.rpd),
      tpd: low(fresh.tpd, patch.tpd),
      hold: Math.max(cur?.hold ?? 0, patch.hold ?? 0) || undefined,
      at: this.now(),
    };
    for (const k of ['rpm', 'tpm', 'rpd', 'tpd', 'hold'] as const) if (this.l[key]![k] === undefined) delete this.l[key]![k];
    this.touch();
  }

  /**
   * Rate-limit headers, as the providers send them:
   *   Groq        x-ratelimit-{limit,remaining,reset}-{requests,tokens}  (requests = per day, tokens = per minute)
   *   Cerebras    x-ratelimit-{limit,remaining,reset}-{requests,tokens}-{minute,day}
   *   OpenRouter  x-ratelimit-{limit,remaining,reset}                     (requests per minute; reset = epoch ms)
   *   Mistral     x-ratelimit-{limit,remaining}-{req,tokens}-minute, x-ratelimitbysize-*-minute
   * A stated limit lowers ours; nothing left holds the counter until the stated reset.
   */
  learnHeaders(key: string, headers: Headers | null | undefined): void {
    if (!headers || typeof headers.forEach !== 'function') return;
    type Slot = { limit?: number; remaining?: number; reset?: number };
    const slots: Record<string, Slot> = {};
    headers.forEach((value, name) => {
      const m = name.toLowerCase().match(/^x-ratelimit(?:bysize)?-(limit|remaining|reset)(?:-(requests|req|tokens))?(?:-(minute|day))?$/);
      if (!m) return;
      const what = m[2] === 'tokens' || /bysize/.test(name.toLowerCase()) ? 'tokens' : 'requests';
      // No window named: Groq's requests are per day and tokens per minute; OpenRouter's (no kind either) per minute.
      const win = m[3] ?? (m[2] === 'requests' ? 'day' : 'minute');
      const slot = (slots[`${what}-${win}`] ??= {});
      const v = m[1] === 'reset' ? resetIn(value, this.now()) : parseFloat(value);
      if (!Number.isFinite(v)) return;
      slot[m[1] as 'limit' | 'remaining' | 'reset'] = v;
    });
    const patch: Partial<Learned> = {};
    for (const [slotName, s] of Object.entries(slots)) {
      const [what, win] = slotName.split('-') as ['requests' | 'tokens', 'minute' | 'day'];
      const field = `${what === 'requests' ? 'r' : 't'}p${win === 'minute' ? 'm' : 'd'}` as 'rpm' | 'tpm' | 'rpd' | 'tpd';
      if (s.limit && s.limit > 0) patch[field] = s.limit;
      // Nothing left (or not even a small request's tokens): wait for the stated reset.
      const empty = s.remaining !== undefined && (what === 'requests' ? s.remaining < 1 : s.remaining < 300);
      if (empty) patch.hold = Math.max(patch.hold ?? 0, this.now() + Math.min(s.reset || (win === 'minute' ? MINUTE : HOUR), DAY));
    }
    if (Object.keys(patch).length) this.learn(key, patch);
  }

  /**
   * A 429 the counters did not see coming: the provider's real per-minute limit is lower than
   * ours, so it becomes what got through in the last minute; a stated wait holds the counter.
   * `daily`: the day's allowance is gone (its limit in the message, when it says one).
   */
  learn429(key: string, waitMs: number, daily = false, dayLimit?: number, holdKey = key): void {
    const patch: Partial<Learned> = {};
    // The wait applies to the model that bounced (holdKey); a lower limit to the counter the provider limits by.
    if (holdKey !== key && waitMs > 0) this.learn(holdKey, { hold: this.now() + Math.min(waitMs, DAY) });
    else if (waitMs > 0) patch.hold = this.now() + Math.min(waitMs, DAY);
    if (daily) {
      if (dayLimit && dayLimit > 0) patch.rpd = dayLimit;
    } else {
      // What got through this minute (this call bounced). A first call bouncing, or a wait of a few
      // seconds, is a per-second blip or another limit, not the per-minute one: only the hold applies.
      const got = this.counter(key).m.length - 1;
      if (got >= 1 && !(waitMs > 0 && waitMs <= 5000)) patch.rpm = got;
    }
    if (Object.keys(patch).length) this.learn(key, patch);
  }

  /** What was learned for a counter (tests and the gauge). */
  learned(key: string): Omit<Learned, 'at'> | undefined {
    const l = this.l[key];
    if (!l) return undefined;
    const { at: _at, ...rest } = l;
    void _at;
    return rest;
  }

  /** Forget everything learned (RE-CHECK MODELS): the counts stay, they are facts. */
  forget(): void {
    this.l = {};
    this.touch();
  }
}

/** One engine per Durable Object storage, so every Router on it (the agent's, the tutor's…) counts together. */
const engines = new WeakMap<object, Quota>();
export function quotaFor(storage: DurableObjectStorage): Quota {
  let q = engines.get(storage);
  if (!q) engines.set(storage, (q = new Quota(storage)));
  return q;
}
