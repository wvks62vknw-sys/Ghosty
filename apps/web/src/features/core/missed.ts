/**
 * WHAT DID I MISS? (BRIEF-OCT-IDEAS-2 3). One card from his own data only, for the time he was away: the Brief's headlines he did
 * not see, agenda items that came and went, spending he added since, the school's and the training's notices, the count of what I
 * sent him that he has not read. It is put together on this phone from the shared mind and the local stores (the brain's mind, its
 * agenda, its inbox and his spending summary: his own records, and no model is asked). It stands on Home's wall when the last open
 * was more than twenty hours ago (state/lastopen.ts), is dismissed with one tap and never comes back for the same gap; and "what
 * did I miss" in the ask line draws the same card, whatever the gap, or says honestly that nothing came.
 */
import { card, type Card } from '../../../../../packages/shared/src/cards';
import { missedLines, whenWords, type MissedInput } from '../../../../../packages/shared/src/lifeeasier';
import { brain, headers } from '../../api/brain';
import { inbox } from '../../assistant/notices';
import { chat } from '../../assistant/session';
import { createStore } from '../../core/store';
import { news } from '../../data/news';
import { MISS_GAP_MS, previousOpen } from '../../state/lastopen';
import { isoDay } from '../brief/day';

/** The gaps he has answered with GOT IT (the open before it, as a time), so the same gap never draws twice. */
const DONE = 'ghosty.missed.done';
/** The headlines the Brief has shown him (the last 80 titles): what is not in it he has not seen. */
const SEEN = 'ghosty.brief.seen';

const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function list(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
const keep = (key: string, v: string[], n: number) => {
  try {
    localStorage.setItem(key, JSON.stringify(v.slice(-n)));
  } catch {
    /* no storage: remembered for this open only */
  }
};

/** The Brief shows these headlines: they are seen. */
export function markSeen(titles: string[]): void {
  if (titles.length) keep(SEEN, [...new Set([...list(SEEN), ...titles.map((t) => t.trim()).filter(Boolean)])], 80);
}

/** For the specs and the console: window.__ghosty.missed. */
export const missedState = { gap: 0, card: '' as string, lines: [] as string[], since: 0, shown: 0, dismissed: 0 };

/** The card that Home's wall repaints from (one at a time). */
export const missed = createStore({ card: null as Card | null });

const within = <T>(p: Promise<T>, ms = 4500): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

const SCHOOL = /\b(school|paper|exam|stage|subjects?|marks?|marked|gcse|a-?levels?|revision)\b/i;
const TRAINING = /\b(learn(?:ed|t)|training|trained|my brain|offline brain|report card|week \d+)\b/i;

/** What came to be missed since `since`, from his own records; every source that cannot be reached is simply left out. */
export async function collect(since: number, now = Date.now()): Promise<{ input: MissedInput; reached: number }> {
  let reached = 0;
  const agendaP = within(
    fetch(`/api/agenda?days=2&from=${since}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, { headers: headers(), credentials: 'same-origin' }).then((r) => (r.ok ? (r.json() as Promise<{ events: { title: string; start: number; allDay?: boolean }[] }>) : null)),
  );
  const [ag, ib, sp] = await Promise.all([agendaP, within(brain.inbox()), within(brain.spending(undefined, isoDay(new Date(now))))]);
  news.start();
  const feed = news.data ?? (await within(news.refresh(), 2500)) ?? [];
  const seen = new Set(list(SEEN));
  const headlines = feed.slice(0, 6).map((x) => x.title).filter((t) => !seen.has(t.trim()));
  if (feed.length) reached++;
  const passed = (ag?.events ?? []).filter((e) => !e.allDay && e.start >= since && e.start < now).sort((a, b) => a.start - b.start).map((e) => ({ at: e.start, title: e.title }));
  if (ag) reached++;
  const notices = (ib?.items ?? inbox.get().items).filter((i) => i.at > since && i.kind !== 'reminder');
  if (ib) reached++;
  const school = notices.filter((i) => SCHOOL.test(`${i.title} ${i.text}`)).map((i) => firstSentence(i.text || i.title));
  const training = notices.filter((i) => !SCHOOL.test(`${i.title} ${i.text}`) && TRAINING.test(`${i.title} ${i.text}`)).map((i) => firstSentence(i.text || i.title));
  const spend = sp?.last && sp.last.at > since && sp.last.added > 0 ? { rows: sp.last.added } : null;
  if (sp) reached++;
  return { input: { since, now, headlines, passed, spend, school, training, inbox: ib?.unread ?? inbox.get().unread }, reached };
}

const firstSentence = (t: string): string => (t.replace(/\s+/g, ' ').trim().match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t.replace(/\s+/g, ' ').trim()).slice(0, 140);

/** The card for a gap, or null when nothing came (said honestly by the caller). */
export function cardOf(input: MissedInput): Card | null {
  const lines = missedLines(input, clock);
  if (!lines.length) return null;
  return card({
    id: `missed:${input.since}`,
    kind: 'brief',
    at: input.now,
    title: 'While you were away',
    line: `You were last here ${whenWords(input.since, input.now, clock)}.`,
    lines,
    brief: { icon: 'morning' },
    acts: [{ label: 'GOT IT', dismiss: `missed:${input.since}` }],
  });
}

const doneGaps = (): string[] => list(DONE);
export const gapDone = (since: number): boolean => doneGaps().includes(String(since));

let held: { since: number; at: number; card: Card | null } | null = null;

/**
 * Home's wall asks: the card, when the last open was more than twenty hours ago and he has not said GOT IT to it. Looked up
 * once for the gap (every few minutes at most while nothing came), never twice drawn for it.
 */
export async function wallMissed(now = Date.now()): Promise<Card | null> {
  const since = previousOpen;
  missedState.since = since;
  missedState.gap = since ? now - since : 0;
  if (!since || now - since < MISS_GAP_MS || gapDone(since)) return null;
  if (held && held.since === since && (held.card || now - held.at < 300_000)) return held.card && !gapDone(since) ? held.card : null;
  const { input } = await collect(since, now);
  const c = cardOf(input);
  held = { since, at: now, card: c };
  if (c) {
    missedState.card = c.id;
    missedState.lines = c.lines ?? [];
    missedState.shown++;
    missed.set({ card: c });
  }
  return c;
}

/** GOT IT: this gap is answered for good; the card goes from the wall and from the conversation. */
export function dismiss(id: string): void {
  const since = id.replace(/^missed:/, '');
  keep(DONE, [...doneGaps().filter((g) => g !== since), since], 40);
  missedState.dismissed++;
  held = null;
  chat.set((s) => ({ entries: s.entries.filter((e) => !(e.kind === 'card' && e.card.id === id)) }));
  missed.set({ card: null });
}

/** The ask line: "what did I miss?": the same card for the time since he was last here, or the honest reason there is none. */
export async function ask(now = Date.now()): Promise<{ reply: string; card: Card | null }> {
  const since = previousOpen;
  if (!since) return { reply: 'This is the first time you have opened me on this phone, so there is nothing you could have missed.', card: null };
  const away = whenWords(since, now, clock);
  const { input, reached } = await collect(since, now);
  const c = cardOf(input);
  if (c) return { reply: `Here is what came while you were away: you were last here ${away}.`, card: c };
  if (!reached) return { reply: `I couldn’t reach my brain just now, so I can’t say what came since you were last here ${away}. Ask me again when I’m back online.`, card: null };
  return { reply: `Nothing came that you haven’t seen since you were last here ${away}.`, card: null };
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.missed = missedState;
  }, 2500);
}
