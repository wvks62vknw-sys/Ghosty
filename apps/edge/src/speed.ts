/**
 * The brain's stopwatch (SPEED, part 1: measure first, fix the worst after). Every model call
 * the router makes is timed: which provider and model, how long until the reply started to
 * arrive (the router asks without streaming, so "first token" is the first byte of the answer,
 * which for most providers comes when the whole answer is ready), the whole call, tokens a
 * second where the provider counts them, and how long the call waited for free room first.
 * A turn of the owner's chat (one AbortSignal) is timed from its first model call to its answer,
 * split into waiting for room, the model, tools and the rest, so the fixes can be aimed.
 *
 * Tools are timed from the router's side: the gap between a model asking for tools and the next
 * model call of the same turn is the tools' time (plus a few milliseconds of the agent's own
 * bookkeeping). A tool timed alone (or several of the same tool side by side) counts towards
 * that tool's median; a mix of tools only counts in the turn's split.
 *
 * Kept cheaply: one storage key (`speed:ring`) with the last 300 entries, today's samples for the
 * medians (capped) and 14 days of daily medians per provider and per tool; written at most once
 * a minute and never on a timer (a write happens when something is timed or the status is read
 * and the last write is a minute old). Lost on a restart: at most the last minute.
 */

export const SPEED_KEY = 'speed:ring';
/** Entries kept in the ring. */
export const RING = 300;
/** Days of daily medians kept. */
export const KEEP_DAYS = 14;
/** At most one write a minute. */
export const SAVE_MS = 60_000;
/** Today's samples kept per measure (the newest win): enough for an honest median, small enough for one key. */
const CAP = 120;
const CAP_EACH = 40;
const MAX_TOOLS = 25;

/** One timed model call. `first`: until the reply started to arrive; `wait`: the room or cool-down waited out before it. */
export interface ModelLap {
  k: 'm';
  at: number;
  p: string;
  m: string;
  f: number;
  ms: number;
  w: number;
  tps?: number;
  /** The call failed (rate limit, error): kept in the ring, left out of the medians. */
  bad?: 1;
  /** Ghosty's own work rather than the owner's chat. */
  bg?: 1;
}
/** One tool's time (`n`: several of it side by side). */
export interface ToolLap {
  k: 't';
  at: number;
  name: string;
  ms: number;
  n?: number;
}
/** One turn of the chat, from its first model call to its answer, and where the time went. */
export interface TurnLap {
  k: 'r';
  at: number;
  ms: number;
  wait: number;
  model: number;
  tools: number;
  rest: number;
  calls: number;
}
export type Lap = ModelLap | ToolLap | TurnLap;

export interface Stat {
  median: number;
  p90: number;
  n: number;
}
/** Where a turn's time went: averages (they add up to the average turn). */
export interface Split {
  wait: number;
  model: number;
  tools: number;
  rest: number;
}
export interface ProviderSpeed {
  provider: string;
  firstToken: number;
  total: number;
  tps?: number;
  n: number;
}
export interface ToolSpeed {
  name: string;
  median: number;
  n: number;
}
/** A day's (or the week's) medians. */
export interface SpeedDay {
  day: string;
  firstToken: Stat | null;
  reply: Stat | null;
  providers: ProviderSpeed[];
  tools: ToolSpeed[];
  split: Split | null;
}
/** For SYSTEM → STATUS (the SPEED card): today, the week before, and the same in plain words. */
export interface SpeedSummary {
  today: SpeedDay;
  week: SpeedDay | null;
  lines: string[];
  /** The newest entries, newest first (for a "latest" list). */
  recent: Lap[];
}

interface Today {
  day: string;
  first: number[];
  reply: number[];
  split: { wait: number[]; model: number[]; tools: number[]; rest: number[] };
  prov: Record<string, { f: number[]; ms: number[]; tps: number[] }>;
  tools: Record<string, number[]>;
}
interface Saved {
  ring: Lap[];
  today: Today;
  days: SpeedDay[];
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const fresh = (day: string): Today => ({ day, first: [], reply: [], split: { wait: [], model: [], tools: [], rest: [] }, prov: {}, tools: {} });
const push = (a: number[], v: number, cap = CAP) => {
  a.push(Math.round(v));
  if (a.length > cap) a.splice(0, a.length - cap);
};

/** The value with `q` of the samples at or below it (nearest rank): q 0.5 the median, 0.9 the slow end. */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!;
}
export const stat = (xs: number[]): Stat | null => (xs.length ? { median: quantile(xs, 0.5), p90: quantile(xs, 0.9), n: xs.length } : null);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/** A duration in plain words: "84 ms", "0.6 s", "1.4 s", "12 s", "1 min 5 s". */
export function dur(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 95) return `${Math.round(ms)} ms`;
  if (ms < 9_950) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
}
/** A tool's name for the owner: "web_search" → "web search". */
const toolWords = (name: string) => name.replace(/_/g, ' ');

/** Today's samples as medians. */
export function dayStats(t: Today): SpeedDay {
  const providers = Object.entries(t.prov)
    .filter(([, v]) => v.ms.length)
    .map(([provider, v]) => ({ provider, firstToken: quantile(v.f, 0.5), total: quantile(v.ms, 0.5), ...(v.tps.length ? { tps: quantile(v.tps, 0.5) } : {}), n: v.ms.length }))
    .sort((a, b) => a.firstToken - b.firstToken);
  const tools = Object.entries(t.tools)
    .filter(([, v]) => v.length)
    .map(([name, v]) => ({ name, median: quantile(v, 0.5), n: v.length }))
    .sort((a, b) => b.median - a.median);
  const s = t.split;
  return {
    day: t.day,
    firstToken: stat(t.first),
    reply: stat(t.reply),
    providers,
    tools,
    split: s.model.length ? { wait: avg(s.wait), model: avg(s.model), tools: avg(s.tools), rest: avg(s.rest) } : null,
  };
}

/** The middle of the daily values, each day counted as often as it had samples. */
function weighted(pairs: [number, number][]): number {
  const all = pairs.filter(([, n]) => n > 0).sort((a, b) => a[0] - b[0]);
  const total = all.reduce((s, [, n]) => s + n, 0);
  let seen = 0;
  for (const [v, n] of all) if ((seen += n) * 2 >= total) return v;
  return 0;
}

/** Several days as one (the week before today): the middle of the daily medians, weighted by how much each day timed. */
export function combineDays(days: SpeedDay[], label = 'week'): SpeedDay | null {
  if (!days.length) return null;
  const st = (pick: (d: SpeedDay) => Stat | null): Stat | null => {
    const xs = days.map(pick).filter((x): x is Stat => !!x);
    if (!xs.length) return null;
    return { median: weighted(xs.map((x) => [x.median, x.n])), p90: weighted(xs.map((x) => [x.p90, x.n])), n: xs.reduce((s, x) => s + x.n, 0) };
  };
  const prov = new Map<string, ProviderSpeed[]>();
  for (const d of days) for (const p of d.providers) prov.set(p.provider, [...(prov.get(p.provider) ?? []), p]);
  const tools = new Map<string, ToolSpeed[]>();
  for (const d of days) for (const t of d.tools) tools.set(t.name, [...(tools.get(t.name) ?? []), t]);
  const splits = days.filter((d) => d.split && d.reply);
  const sn = splits.reduce((s, d) => s + d.reply!.n, 0);
  const part = (k: keyof Split) => Math.round(splits.reduce((s, d) => s + d.split![k] * d.reply!.n, 0) / (sn || 1));
  return {
    day: label,
    firstToken: st((d) => d.firstToken),
    reply: st((d) => d.reply),
    providers: [...prov].map(([provider, ps]) => {
      const tps = ps.filter((p) => p.tps !== undefined);
      return { provider, firstToken: weighted(ps.map((p) => [p.firstToken, p.n])), total: weighted(ps.map((p) => [p.total, p.n])), ...(tps.length ? { tps: weighted(tps.map((p) => [p.tps!, p.n])) } : {}), n: ps.reduce((s, p) => s + p.n, 0) };
    }).sort((a, b) => a.firstToken - b.firstToken),
    tools: [...tools].map(([name, ts]) => ({ name, median: weighted(ts.map((t) => [t.median, t.n])), n: ts.reduce((s, t) => s + t.n, 0) })).sort((a, b) => b.median - a.median),
    split: sn ? { wait: part('wait'), model: part('model'), tools: part('tools'), rest: part('rest') } : null,
  };
}

/** The plain-words lines for the SPEED card. */
export function speedLines(today: SpeedDay, week: SpeedDay | null): string[] {
  const out: string[] = [];
  const f = today.firstToken;
  if (f) {
    const fast = today.providers.length > 1 ? ` · ${today.providers[0]!.provider} fastest today` : '';
    out.push(`First word in ${dur(f.median)} (median), ${dur(f.p90)} at the slow end${fast}${week?.firstToken ? ` · last week ${dur(week.firstToken.median)}` : ''}`);
  } else out.push(week?.firstToken ? `No model calls timed yet today · last week the first word came in ${dur(week.firstToken.median)}` : 'No model calls timed yet');
  const r = today.reply;
  if (r) out.push(`Replies take ${dur(r.median)} in the brain (today's median, ${r.n} repl${r.n === 1 ? 'y' : 'ies'})${week?.reply ? ` · last week ${dur(week.reply.median)}` : ''}`);
  const s = today.split;
  if (s) out.push(`Where a reply's time goes (average): the model ${dur(s.model)}, tools ${dur(s.tools)}, waiting for free room ${dur(s.wait)}, the rest ${dur(s.rest)}`);
  if (today.tools.length) out.push(`Tools: ${today.tools.slice(0, 6).map((t) => `${toolWords(t.name)} ${dur(t.median)}`).join(', ')}`);
  const tps = today.providers.filter((p) => p.tps).sort((a, b) => b.tps! - a.tps!);
  if (tps.length) out.push(`Writing speed: ${tps.slice(0, 3).map((p) => `${p.provider} ${Math.round(p.tps!)} tokens a second`).join(', ')}`);
  return out;
}

/** A turn of the chat being timed (one per AbortSignal). */
interface Span {
  start: number;
  wait: number;
  model: number;
  tools: number;
  calls: number;
  /** The model asked for tools at this time: the gap to the next call is theirs. */
  asked?: { at: number; names: string[] };
  done?: boolean;
}

export class Stopwatch {
  private ring: Lap[] = [];
  private today: Today;
  private days: SpeedDay[] = [];
  private loaded: Promise<void> | null = null;
  private dirty = false;
  private lastSave = 0;
  private spans = new WeakMap<object, Span>();

  constructor(
    private storage: DurableObjectStorage | null,
    public now: () => number = Date.now,
  ) {
    this.today = fresh(dayOf(this.now()));
  }

  /** What was kept (once per brain); what was timed before it arrived is kept too. A paused database starts from empty. */
  load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const s = await this.storage?.get<Saved>(SPEED_KEY);
        if (!s || typeof s !== 'object') return;
        this.ring = [...(s.ring ?? []), ...this.ring].slice(-RING);
        this.days = [...(s.days ?? []), ...this.days].slice(-KEEP_DAYS);
        const t = s.today;
        if (t?.day === this.today.day) {
          const mine = this.today;
          this.today = t;
          for (const k of ['first', 'reply'] as const) for (const v of mine[k]) push(t[k], v);
          for (const k of ['wait', 'model', 'tools', 'rest'] as const) for (const v of mine.split[k]) push(t.split[k], v);
          for (const [p, v] of Object.entries(mine.prov)) for (const k of ['f', 'ms', 'tps'] as const) for (const x of v[k]) push((t.prov[p] ??= { f: [], ms: [], tps: [] })[k], x, CAP_EACH);
          for (const [n, v] of Object.entries(mine.tools)) for (const x of v) push((t.tools[n] ??= []), x, CAP_EACH);
        } else if (t?.day && t.first) this.fold(t);
      } catch {
        /* database paused: timing from now */
      }
    })();
    return this.loaded;
  }

  /** One model call (the router's hook). `chat`: the owner is waiting on it. */
  model(x: { provider: string; model: string; first: number; ms: number; wait?: number; tokens?: number; ok: boolean; chat: boolean }): void {
    this.roll();
    const tps = x.ok && x.tokens && x.ms > 0 ? Math.round((x.tokens / x.ms) * 10_000) / 10 : undefined;
    const lap: ModelLap = { k: 'm', at: this.now(), p: x.provider, m: x.model.slice(0, 60), f: Math.round(x.first), ms: Math.round(x.ms), w: Math.round(x.wait ?? 0), ...(tps ? { tps } : {}), ...(x.ok ? {} : { bad: 1 as const }), ...(x.chat ? {} : { bg: 1 as const }) };
    this.add(lap);
    if (!x.ok) return;
    if (x.chat) push(this.today.first, x.first);
    const p = (this.today.prov[x.provider] ??= { f: [], ms: [], tps: [] });
    push(p.f, x.first, CAP_EACH);
    push(p.ms, x.ms, CAP_EACH);
    if (tps) push(p.tps, tps, CAP_EACH);
  }

  /** One tool (or `n` of the same tool side by side). */
  tool(name: string, ms: number, n = 1): void {
    this.roll();
    this.add({ k: 't', at: this.now(), name, ms: Math.round(ms), ...(n > 1 ? { n } : {}) });
    const known = this.today.tools[name];
    if (!known && Object.keys(this.today.tools).length >= MAX_TOOLS) return;
    push((this.today.tools[name] ??= []), ms, CAP_EACH);
  }

  /** One finished turn. */
  turn(x: { ms: number; wait: number; model: number; tools: number; calls: number }): void {
    this.roll();
    const rest = Math.max(0, x.ms - x.wait - x.model - x.tools);
    this.add({ k: 'r', at: this.now(), ms: Math.round(x.ms), wait: Math.round(x.wait), model: Math.round(x.model), tools: Math.round(x.tools), rest: Math.round(rest), calls: x.calls });
    push(this.today.reply, x.ms);
    const s = this.today.split;
    push(s.wait, x.wait);
    push(s.model, x.model);
    push(s.tools, x.tools);
    push(s.rest, rest);
  }

  /**
   * The router's hooks for a turn (keyed by the turn's AbortSignal; calls without one are not a
   * turn). `callStart` at the start of each completion: a gap after the model asked for tools is
   * theirs. `callEnd` with what it took and what came back: tool calls keep the turn open, an answer
   * ends it; `fail` drops it (no answer, nothing to time).
   */
  callStart(key: object | undefined): void {
    if (!key) return;
    const now = this.now();
    let s = this.spans.get(key);
    if (s?.done) return; // a check after the answer (cited answers) belongs to no turn
    if (!s) this.spans.set(key, (s = { start: now, wait: 0, model: 0, tools: 0, calls: 0 }));
    if (s.asked) {
      const gap = Math.max(0, now - s.asked.at);
      s.tools += gap;
      const names = new Set(s.asked.names);
      if (names.size === 1) this.tool(s.asked.names[0]!, gap, s.asked.names.length);
      s.asked = undefined;
    }
  }
  callEnd(key: object | undefined, x: { wait: number; model: number; tools?: string[] }): void {
    const s = key ? this.spans.get(key) : undefined;
    if (!s || s.done) return;
    s.wait += x.wait;
    s.model += x.model;
    s.calls++;
    if (x.tools?.length) {
      s.asked = { at: this.now(), names: x.tools };
      return;
    }
    s.done = true;
    this.turn({ ms: this.now() - s.start, wait: s.wait, model: s.model, tools: s.tools, calls: s.calls });
  }
  fail(key: object | undefined): void {
    if (key) this.spans.delete(key);
  }

  summary(): SpeedSummary {
    this.roll();
    const today = dayStats(this.today);
    const since = dayOf(this.now() - 7 * 86_400_000);
    const week = combineDays(this.days.filter((d) => d.day >= since && d.day < this.today.day));
    return { today, week, lines: speedLines(today, week), recent: this.ring.slice(-20).reverse() };
  }

  /** Save when something changed and the last save is a minute old (or `force`). Never on a timer. */
  async flush(force = false): Promise<void> {
    if (!this.dirty || !this.storage) return;
    if (!force && this.now() - this.lastSave < SAVE_MS) return;
    this.lastSave = this.now();
    // What was kept comes first, so a save never writes over it.
    await this.load();
    this.dirty = false;
    try {
      await this.storage.put(SPEED_KEY, { ring: this.ring, today: this.today, days: this.days } satisfies Saved);
    } catch {
      this.dirty = true; // database paused: kept in memory, saved after the reset
    }
  }

  private add(lap: Lap): void {
    this.ring.push(lap);
    if (this.ring.length > RING) this.ring.splice(0, this.ring.length - RING);
    this.dirty = true;
    void this.flush();
  }

  /** A new UTC day: yesterday's samples become yesterday's medians. */
  private roll(): void {
    const d = dayOf(this.now());
    if (d === this.today.day) return;
    this.fold(this.today);
    this.today = fresh(d);
    this.dirty = true;
  }
  private fold(t: Today): void {
    if (!t.first.length && !t.reply.length && !Object.keys(t.prov).length && !Object.keys(t.tools).length) return;
    this.days = [...this.days.filter((x) => x.day !== t.day), dayStats(t)].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-KEEP_DAYS);
  }
}

/** One stopwatch per Durable Object storage, so every Router on it times together. */
const watches = new WeakMap<object, Stopwatch>();
export function speedFor(storage: DurableObjectStorage): Stopwatch {
  let s = watches.get(storage);
  if (!s) watches.set(storage, (s = new Stopwatch(storage)));
  return s;
}

/** For `/status` (the SPEED card): today's and last week's medians, with the plain-words lines. */
export async function speedSummary(storage: DurableObjectStorage): Promise<SpeedSummary> {
  const s = speedFor(storage);
  await s.load();
  const out = s.summary();
  await s.flush();
  return out;
}
