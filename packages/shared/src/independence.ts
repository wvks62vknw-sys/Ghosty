/**
 * THE INDEPENDENCE METER (OWNER-ISSUES 78): how much of what he asks his own brains already answer. Every answered turn is
 * counted by WHERE it was answered — the phone's own brain, the library on the phone, THINK HARDER, the website kit, or the
 * cloud (and which provider) — read from the answer's own line (apps/web/src/assistant/session.ts: "On this phone ·
 * offline", "Library on this device · offline", "On this phone · THINK HARDER", "On this phone · website kit", or a cloud
 * model's "groq · llama-…"). The phone keeps the days (apps/web/src/core/independence.ts); the brain keeps a copy of them
 * for the weeks (selftrain/cycle.ts POST /training/meter: counts only — never words, never a task kept on the phone).
 * Pure, shared by both.
 */

export type Where = 'phone' | 'library' | 'think' | 'kit' | 'cloud';
/** His own brains: everything that answers on the phone. */
export const OWN_BRAINS: Where[] = ['phone', 'library', 'think', 'kit'];
const WHERE_WORDS: Record<Where, string> = { phone: 'phone', library: 'library', think: 'THINK HARDER', kit: 'website kit', cloud: 'the cloud' };
/** What the cloud was asked for: live facts (a tool ran), long writing (a long reply), or conversation. */
export type Ask = 'live' | 'long' | 'chat';
const ASK_WORDS: Record<Ask, string> = { live: 'live facts', long: 'long writing', chat: 'conversation' };

export interface MeterDay {
  /** The phone's day, YYYY-MM-DD. */
  d: string;
  /** Answers, by where they were answered. */
  n: Partial<Record<Where, number>>;
  /** Of them, the ones kept on the phone (a private task): never in the brain's copy. */
  k?: Partial<Record<Where, number>>;
  /** The cloud's answers by provider ("groq", "gemini" …) and by what they were for. */
  c: Record<string, number>;
  a: Partial<Record<Ask, number>>;
}

export interface MeterWeek {
  total: number;
  by: Record<Where, number>;
  cloud: Record<string, number>;
  asks: Record<Ask, number>;
}

/** Days kept on the phone (and in the brain's copy). */
export const KEEP_DAYS = 120;
const DAY = 86_400_000;

/** Where an answer came from, by its model line; a cloud answer's provider is the line's first part. */
export function whereFrom(model = ''): { where: Where; provider?: string } {
  const m = model.trim();
  if (/^On this phone · THINK HARDER/i.test(m)) return { where: 'think' };
  if (/^On this phone · website kit/i.test(m)) return { where: 'kit' };
  if (/^On this phone/i.test(m)) return { where: 'phone' };
  if (/^Library on this device/i.test(m)) return { where: 'library' };
  return { where: 'cloud', provider: (m.split(' · ')[0] ?? '').trim().toLowerCase().slice(0, 40) || 'unknown' };
}

/** What a cloud answer was for: a tool ran (live facts), a long reply (600 characters or more), or conversation. */
export const askOf = (o: { tool?: boolean; length?: number }): Ask => (o.tool ? 'live' : (o.length ?? 0) >= 600 ? 'long' : 'chat');

/** One answer into the days (a new list; the day made when it is its first), the oldest dropped past KEEP_DAYS. */
export function addAnswer(days: MeterDay[], day: string, model: string | undefined, o: { kept?: boolean; tool?: boolean; length?: number } = {}): MeterDay[] {
  const { where, provider } = whereFrom(model);
  const out = days.map((x) => (x.d === day ? { ...x, n: { ...x.n }, k: { ...(x.k ?? {}) }, c: { ...x.c }, a: { ...x.a } } : x));
  let t = out.find((x) => x.d === day);
  if (!t) out.push((t = { d: day, n: {}, k: {}, c: {}, a: {} }));
  t.n[where] = (t.n[where] ?? 0) + 1;
  if (o.kept) t.k![where] = (t.k![where] ?? 0) + 1;
  if (where === 'cloud') {
    t.c[provider!] = (t.c[provider!] ?? 0) + 1;
    const ask = askOf(o);
    t.a[ask] = (t.a[ask] ?? 0) + 1;
  }
  return out.sort((a, b) => a.d.localeCompare(b.d)).slice(-KEEP_DAYS);
}

const noon = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** The seven days ending `day` (YYYY-MM-DD), `ago` weeks back. */
export function weekOf(days: MeterDay[], day: string, ago = 0): MeterWeek {
  const end = noon(day) - ago * 7 * DAY;
  const w: MeterWeek = { total: 0, by: { phone: 0, library: 0, think: 0, kit: 0, cloud: 0 }, cloud: {}, asks: { live: 0, long: 0, chat: 0 } };
  for (const x of days) {
    const t = noon(x.d);
    if (!(t <= end && t > end - 7 * DAY)) continue;
    for (const [k, v] of Object.entries(x.n) as [Where, number][]) if (k in w.by && v > 0) (w.by[k] += v), (w.total += v);
    for (const [k, v] of Object.entries(x.c)) w.cloud[k] = (w.cloud[k] ?? 0) + v;
    for (const [k, v] of Object.entries(x.a) as [Ask, number][]) if (k in w.asks) w.asks[k] += v;
  }
  return w;
}

/** Whole per cent for each part, adding up to exactly 100 (the leftover points go to the largest remainders). */
export function shares(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0);
  if (!total) return parts.map(() => 0);
  const raw = parts.map((p) => (p * 100) / total);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  for (const [, i] of raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])) {
    if (left-- <= 0) break;
    out[i]!++;
  }
  return out;
}

/** His own brains' share of a week, in whole per cent (null: nothing asked). */
export function ownShare(w: MeterWeek): number | null {
  if (!w.total) return null;
  return shares([...OWN_BRAINS, 'cloud' as Where].map((p) => w.by[p])).slice(0, OWN_BRAINS.length).reduce((a, b) => a + b, 0);
}

/**
 * The week in his voice: "This week 71% of what you asked was answered on your own brains (phone 54%, library 17%). The
 * cloud did 29%: mostly live facts and long writing." Every per cent is whole and they add up to 100.
 */
export function meterLine(w: MeterWeek): string {
  if (!w.total) return 'Nothing asked this week yet: the meter starts with your next question.';
  const pct = shares([...OWN_BRAINS, 'cloud' as Where].map((p) => w.by[p]));
  const cloud = pct[OWN_BRAINS.length]!;
  const own = 100 - cloud;
  const parts = OWN_BRAINS.map((p, i) => [WHERE_WORDS[p], pct[i]!] as const).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}%`).join(', ');
  const mostly = (Object.entries(w.asks) as [Ask, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => ASK_WORDS[k]);
  const why = mostly.length ? `: mostly ${mostly.join(' and ')}` : '';
  if (!cloud) return `This week everything you asked was answered on your own brains (${parts}).`;
  if (!own) return `This week the cloud answered everything you asked${why}. None of it was answered on your own brains yet.`;
  return `This week ${own}% of what you asked was answered on your own brains${parts ? ` (${parts})` : ''}. The cloud did ${cloud}%${why}.`;
}

/** His own brains' share, week by week, oldest first (the last `n` weeks ending `day`; null where nothing was asked). */
export function weeksOf(days: MeterDay[], day: string, n = 6): (number | null)[] {
  return Array.from({ length: n }, (_, i) => ownShare(weekOf(days, day, n - 1 - i)));
}

/** The weeks in a line ("Your own brains, week by week: 41% → 58% → 71%."), '' until two weeks have answers. */
export function trendLine(weeks: (number | null)[]): string {
  const seen = weeks.filter((x): x is number => x !== null);
  return seen.length >= 2 ? `Your own brains, week by week: ${seen.map((x) => `${x}%`).join(' → ')}.` : '';
}

/** The brain's copy: counts only, with the tasks kept on the phone taken out (they never leave it, not even as a number). */
export function forBrain(days: MeterDay[]): MeterDay[] {
  return days.map((x) => ({ d: x.d, n: Object.fromEntries((Object.entries(x.n) as [Where, number][]).map(([k, v]) => [k, Math.max(0, v - (x.k?.[k] ?? 0))])), c: x.c, a: x.a }));
}

/** What the brain keeps of a phone's days: well-formed counts only, merged by day (the phone's newer copy wins), KEEP_DAYS at most. */
export function meterDays(raw: unknown, kept: MeterDay[] = []): MeterDay[] {
  const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100_000 ? (v as number) : 0);
  const counts = <K extends string>(o: unknown, keys?: readonly K[]): Partial<Record<K, number>> =>
    Object.fromEntries(Object.entries(o && typeof o === 'object' ? (o as Record<string, unknown>) : {}).filter(([k]) => (keys ? (keys as readonly string[]).includes(k) : /^[a-z0-9 ._-]{1,40}$/.test(k))).slice(0, 24).map(([k, v]) => [k, count(v)])) as Partial<Record<K, number>>;
  const byDay = new Map(kept.map((x) => [x.d, x]));
  for (const x of Array.isArray(raw) ? raw.slice(-KEEP_DAYS) : []) {
    const d = (x as { d?: unknown })?.d;
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    byDay.set(d, { d, n: counts((x as { n?: unknown }).n, ['phone', 'library', 'think', 'kit', 'cloud'] as const), c: counts((x as { c?: unknown }).c) as Record<string, number>, a: counts((x as { a?: unknown }).a, ['live', 'long', 'chat'] as const) });
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-KEEP_DAYS);
}
