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
  /** The last minute: [when, tokens, answered (1) or not (0)] per call, oldest first. */
  m: [number, number, number][];
  /** The last day: [hour index, requests, tokens] per hour with calls, oldest first. */
  h: [number, number, number][];
  /** Calls running now: memory only, never saved (a brain that restarts mid-call has none running). */
  run?: number;
}
type Field = 'rpm' | 'tpm' | 'rpd' | 'tpd';
const FIELDS: Field[] = ['rpm', 'tpm', 'rpd', 'tpd'];
/** One learned number and when it was learned (each field ages on its own). */
interface Stated {
  v: number;
  at: number;
}
interface Learned {
  /** What the provider's own headers state: replaces the configured number while fresh. */
  hdr?: Partial<Record<Field, Stated>>;
  /** What a 429 showed: lowers the limit until LEARN_TTL after the 429 (a header never refreshes it). */
  low?: Partial<Record<Field, Stated>>;
  /** Nothing is sent before this (a header said 0 left, or a 429 said wait). */
  hold?: number;
}
interface Saved {
  c: Record<string, Pick<Counter, 'm' | 'h'>>;
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
        // (`run` is never saved; an older save may still carry it: a call from before a restart is not running now.)
        if (s?.c) this.c = { ...Object.fromEntries(Object.entries(s.c).map(([k, c]) => [k, { m: c.m ?? [], h: c.h ?? [] }])), ...this.c };
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
      const c = Object.fromEntries(Object.entries(this.c).map(([k, x]) => [k, { m: x.m, h: x.h }]));
      await this.storage.put(Q_KEY, { c, l: this.l } satisfies Saved);
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
    for (const [k, l] of Object.entries(this.l)) {
      for (const part of [l.hdr, l.low]) for (const f of FIELDS) if (part?.[f] && !this.fresh(part[f])) delete part[f];
      if ((l.hold ?? 0) < t) delete l.hold;
      if (!l.hold && !FIELDS.some((f) => l.hdr?.[f] || l.low?.[f])) delete this.l[k];
    }
  }

  private fresh(s: Stated | undefined): s is Stated {
    return !!s && s.at > this.now() - LEARN_TTL;
  }

  private counter(key: string): Counter {
    const c = (this.c[key] ??= { m: [], h: [] });
    const t = this.now();
    while (c.m.length && c.m[0]![0] <= t - MINUTE) c.m.shift();
    return c;
  }

  /** The limits in force: what the provider's headers state (else the configured number), lowered by what a recent 429 showed. */
  limits(key: string, base: Limits): Limits {
    const l = this.l[key];
    if (!l) return base;
    const out: Limits = { ...base };
    for (const f of FIELDS) {
      const hdr = l.hdr?.[f];
      const low = l.low?.[f];
      let v = this.fresh(hdr) ? hdr.v : base[f];
      if (this.fresh(low)) v = v === undefined ? low.v : Math.min(v, low.v);
      if (v === undefined) delete out[f];
      else out[f] = v;
    }
    return out;
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
    // Bigger than this lane may ever send in a minute (or a day): never, not "later" — the router moves on.
    // (Background work has only its share: a 6,000-token request never fits Groq's 5,600 background tokens.)
    if (L.tpm && tokens > share(L.tpm)) return { ok: false, waitMs: Infinity, load: 1, why: 'request bigger than a minute allows' };
    if (L.tpd && tokens > share(L.tpd)) return { ok: false, waitMs: Infinity, load: 1, why: 'request bigger than a day allows' };
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

  /**
   * Count one call now (before it is sent, so calls started together see each other). Returns a
   * settle function: the real token count, and whether the provider answered (only answered calls
   * count as "got through" when a 429 teaches a per-minute limit).
   */
  take(keys: string[], tokens: number): (realTokens?: number, answered?: boolean) => void {
    const t = this.now();
    const hr = Math.floor(t / HOUR);
    const entries: { m: [number, number, number]; h: [number, number, number] }[] = [];
    for (const key of keys) {
      const c = this.counter(key);
      const m: [number, number, number] = [t, tokens, 0];
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
    return (real, answered = false) => {
      if (done) return;
      done = true;
      keys.forEach((key, i) => {
        const c = this.c[key];
        if (c) c.run = Math.max(0, (c.run ?? 1) - 1);
        const e = entries[i]!;
        if (answered) e.m[2] = 1;
        if (real !== undefined && Number.isFinite(real) && real >= 0) {
          e.h[2] += real - e.m[1];
          e.m[1] = real;
        }
      });
      this.touch();
    };
  }

  /** Record learned numbers: `hdr` (stated by headers) replaces the field; `low` (from a 429) only ever lowers a fresh one. */
  private learn(key: string, patch: { hdr?: Partial<Record<Field, number>>; low?: Partial<Record<Field, number>>; hold?: number }): void {
    const l = (this.l[key] ??= {});
    const at = this.now();
    for (const f of FIELDS) {
      const h = patch.hdr?.[f];
      if (h !== undefined) (l.hdr ??= {})[f] = { v: h, at };
      const lo = patch.low?.[f];
      if (lo !== undefined) {
        const cur = l.low?.[f];
        (l.low ??= {})[f] = { v: this.fresh(cur) ? Math.min(cur.v, lo) : lo, at };
      }
    }
    if (patch.hold) l.hold = Math.max(l.hold ?? 0, patch.hold);
    this.touch();
  }

  /**
   * Rate-limit headers, as the providers send them:
   *   Groq        x-ratelimit-{limit,remaining,reset}-{requests,tokens}  (requests = per day, tokens = per minute)
   *   Cerebras    x-ratelimit-{limit,remaining,reset}-{requests,tokens}-{minute,day}
   *   OpenRouter  x-ratelimit-{limit,remaining,reset}                     (requests per minute; reset = epoch ms)
   *   Mistral     x-ratelimit-{limit,remaining}-{req,tokens}-minute, x-ratelimitbysize-*-minute
   * A stated limit is the provider's own word: it replaces ours (up or down) while fresh, but never
   * refreshes what a 429 taught; nothing left holds the counter until the stated reset.
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
    const hdr: Partial<Record<Field, number>> = {};
    let hold = 0;
    for (const [slotName, s] of Object.entries(slots)) {
      const [what, win] = slotName.split('-') as ['requests' | 'tokens', 'minute' | 'day'];
      const field = `${what === 'requests' ? 'r' : 't'}p${win === 'minute' ? 'm' : 'd'}` as Field;
      if (s.limit && s.limit > 0) hdr[field] = s.limit;
      // Nothing left (or not even a small request's tokens): wait for the stated reset.
      const empty = s.remaining !== undefined && (what === 'requests' ? s.remaining < 1 : s.remaining < 300);
      if (empty) hold = Math.max(hold, this.now() + Math.min(s.reset || (win === 'minute' ? MINUTE : HOUR), DAY));
    }
    if (Object.keys(hdr).length || hold) this.learn(key, { hdr, ...(hold ? { hold } : {}) });
  }

  /**
   * A 429 the counters did not see coming. A stated wait holds the model that bounced (holdKey).
   * `perMinute`: the 429 is about requests a minute (not tokens a minute, not an upstream model's own
   * limit): then the per-minute limit of `key` becomes the calls that were ANSWERED in the last minute.
   * `daily`: the day's allowance is gone (its limit in the message, when it says one).
   */
  learn429(key: string, waitMs: number, opts: { daily?: boolean; dayLimit?: number; holdKey?: string; perMinute?: boolean } = {}): void {
    const holdKey = opts.holdKey ?? key;
    if (waitMs > 0) this.learn(holdKey, { hold: this.now() + Math.min(waitMs, DAY) });
    const low: Partial<Record<Field, number>> = {};
    if (opts.daily) {
      if (opts.dayLimit && opts.dayLimit > 0) low.rpd = opts.dayLimit;
    } else if (opts.perMinute !== false) {
      // A first call bouncing, or a wait of a few seconds, is a per-second blip or another limit: only the hold applies.
      const got = this.counter(key).m.filter((e) => e[2] === 1).length;
      if (got >= 1 && !(waitMs > 0 && waitMs <= 5000)) low.rpm = got;
    }
    if (Object.keys(low).length) this.learn(key, { low });
  }

  /** What is learned and still in force for a counter (tests and the gauge): each field's number, and any hold. */
  learned(key: string): Partial<Record<Field | 'hold', number>> | undefined {
    const l = this.l[key];
    if (!l) return undefined;
    const out: Partial<Record<Field | 'hold', number>> = {};
    for (const f of FIELDS) {
      const h = this.fresh(l.hdr?.[f]) ? l.hdr![f]!.v : undefined;
      const lo = this.fresh(l.low?.[f]) ? l.low![f]!.v : undefined;
      const v = lo === undefined ? h : h === undefined ? lo : Math.min(h, lo);
      if (v !== undefined) out[f] = v;
    }
    if ((l.hold ?? 0) > this.now()) out.hold = l.hold!;
    return out;
  }

  /** Forget everything learned and any call counted as running (RE-CHECK MODELS): the counts stay, they are facts. */
  forget(): void {
    this.l = {};
    for (const c of Object.values(this.c)) c.run = 0;
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
