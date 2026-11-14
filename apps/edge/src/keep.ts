/**
 * A MEMORY THAT KEEPS YOUR WORD, on the brain (NEXT ROUND, MEMORY lane). One small store, `keep:items`, of HIS own word, caught from
 * every turn he types or says (the app's and Telegram's alike, through mind.ts observe → `captureTurn`):
 *  - promise: "I'll send Jo the photos tomorrow": nudged once on its day at 9 (no day: two days later), through the one notify path
 *    (the inbox, his phone's Web Push, Telegram), so it reaches a locked phone; "I sent Jo the photos" closes it;
 *  - where: "the spare key is in the blue tin" (the phone also answers "where's the spare key?" from its copy, offline);
 *  - why: "I picked the canal flat because it's quieter".
 * The Sunday card (6 pm, his zone, once a week): what he asked about most, what he finished, what is still open, the questions that
 * never got a real answer. Read from his own turns' gists (recall.ts), this store and the day log.
 *
 * Nothing here asks a model or anyone else. A name in a promise is only the word he used.
 *   GET /profile/keep → { items, week, lines } · POST /profile/keep { op: add|done|drop|reopen|snooze|forget|restore|pin|unpin, … }
 */
import { daysAgo } from '../../../packages/shared/src/recall';
import { doneWith, promiseIn, remindAtFor, dueWords, topicsOf, unanswered, weekLines, whereIn, whyIn, type KeepItem, type WeekReview } from '../../../packages/shared/src/keep';
import { gistsNow } from './recall';
import { loadLog } from './mind';
import { loadWatchers } from './watchers';

export type { KeepItem, WeekReview };
export const KEEP_KEY = 'keep:items';
const WEEK_SENT = 'keep:week';
const GONE_KEY = 'keep:gone';
const MAX_ITEMS = 400;
const DAY = 86_400_000;
/** What is done or let go is kept this long, then cleared (a pinned one stays). */
const DONE_KEEP = 60 * DAY;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const shortId = () => [...crypto.getRandomValues(new Uint8Array(5))].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function loadKeep(storage: DurableObjectStorage): Promise<KeepItem[]> {
  const v = await storage.get<KeepItem[]>(KEEP_KEY);
  return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.what === 'string') : [];
}

/** Within bounds: what is done or let go for two months goes; then the oldest unpinned go first. */
function bound(list: KeepItem[], now: number): KeepItem[] {
  let out = list.filter((x) => x.pinned || x.kind !== 'promise' || x.state === 'open' || now - (x.doneAt ?? x.at) < DONE_KEEP);
  while (out.length > MAX_ITEMS) {
    const i = out.findIndex((x) => !x.pinned && !(x.kind === 'promise' && x.state === 'open'));
    out.splice(i < 0 ? 0 : i, 1);
  }
  return out;
}
const save = (storage: DurableObjectStorage, list: KeepItem[], now: number) => storage.put(KEEP_KEY, bound(list, now));
const tzOf = async (storage: DurableObjectStorage): Promise<string> => (await storage.get<{ tz?: string }>('owner:ctx').catch(() => null))?.tz || 'UTC';

/**
 * One turn of his, read for his word: a promise (with its nudge time), a place he put something, a reason he chose something, and a
 * promise his words say is done. Returns what changed. The same thing said twice is kept once (a "where" is updated to the new place).
 */
export async function captureTurn(storage: DurableObjectStorage, words: string, o: { at: number; via?: string; tz?: string }): Promise<{ added: KeepItem[]; done: KeepItem[] }> {
  const text = String(words ?? '').replace(/\s+/g, ' ').trim();
  const out = { added: [] as KeepItem[], done: [] as KeepItem[] };
  if (!text || text.length > 400) return out;
  const p = promiseIn(text);
  const w = whereIn(text);
  const y = whyIn(text);
  const list = await loadKeep(storage);
  const open = list.filter((x) => x.kind === 'promise' && x.state === 'open');
  const doneId = !p ? doneWith(text, open) : null;
  if (!p && !w && !y && !doneId) return out;
  const tz = o.tz ?? (await tzOf(storage));
  const via = o.via === 'telegram' ? 'telegram' : o.via === 'phone' ? 'phone' : 'app';
  const base = { at: o.at, via, text: text.slice(0, 160) };
  if (p && !open.some((x) => x.what.toLowerCase() === p.what.toLowerCase())) {
    const item: KeepItem = { id: shortId(), kind: 'promise', ...base, what: p.what, ...(p.due ? { due: p.due } : {}), remindAt: remindAtFor(p.due, o.at, tz), state: 'open' };
    list.push(item);
    out.added.push(item);
  }
  if (w) {
    const same = list.find((x) => x.kind === 'where' && x.what.replace(/^(?:the|my|our) /i, '').toLowerCase() === w.what.replace(/^(?:the|my|our) /i, '').toLowerCase());
    if (same) Object.assign(same, { ...base, detail: w.where });
    else list.push({ id: shortId(), kind: 'where', ...base, what: w.what, detail: w.where });
    out.added.push(same ?? list[list.length - 1]!);
  }
  if (y) {
    const item: KeepItem = { id: shortId(), kind: 'why', ...base, what: y.what, detail: y.why };
    list.push(item);
    out.added.push(item);
  }
  if (doneId) {
    const d = list.find((x) => x.id === doneId)!;
    d.state = 'done';
    d.doneAt = o.at;
    out.done.push(d);
  }
  await save(storage, list, o.at);
  return out;
}

/** The week's review: Monday 00:00 to now, his zone. */
export async function weekReview(storage: DurableObjectStorage, now: number, tz: string): Promise<WeekReview> {
  const dow = (new Date(new Date(now).toLocaleDateString('en-CA', { timeZone: tz })).getUTCDay() + 6) % 7;
  const [gists, items, log, watchers] = await Promise.all([gistsNow(storage, now), loadKeep(storage), loadLog(storage).catch(() => []), loadWatchers(storage).catch(() => [])]);
  const mine = gists.filter((g) => daysAgo(g.at, now, tz) <= dow && g.at <= now);
  const week = mine[0] ? mine[0].at - (mine[0].at % 60_000) : now;
  const inWeek = (at?: number) => !!at && daysAgo(at, now, tz) <= dow && at <= now;
  const finished = [
    ...items.filter((x) => x.kind === 'promise' && x.state === 'done' && inWeek(x.doneAt)).map((x) => x.what),
    ...log.filter((e) => e.kind === 'built' && inWeek(e.at)).map((e) => e.text.replace(/^(?:built|published|made|started) (?:an? )?/, '')),
  ];
  const open = [
    ...items.filter((x) => x.kind === 'promise' && x.state === 'open').map((x) => `${x.what}${x.due ? ` (${dueWords(x.due)})` : ''}`),
    ...watchers.filter((w) => w.kind === 'reply' && w.state === 'watching').map((w) => `the chase of ${w.who || 'a reply'}`),
  ];
  return {
    week,
    asks: mine.length,
    topics: topicsOf(mine.map((g) => g.q)),
    finished,
    open,
    unanswered: mine.filter((g) => g.a !== undefined && unanswered(g.a)).map((g) => ({ at: g.at, q: g.q })).slice(-5),
  };
}

/**
 * The hourly beat (guardian.ts, beside the watchers): each open promise whose time has come is told once; on Sunday from 6 pm the
 * week's card is told once. Returns the lines told.
 */
export async function keepTick(d: { storage: DurableObjectStorage; notify(item: { kind: 'reminder' | 'task' | 'error'; title: string; text: string }): Promise<unknown>; now?: () => number }): Promise<string[]> {
  const now = d.now ? d.now() : Date.now();
  const told: string[] = [];
  const list = await loadKeep(d.storage);
  let changed = false;
  for (const p of list) {
    if (p.kind !== 'promise' || p.state !== 'open' || p.nudged || !p.remindAt || p.remindAt > now) continue;
    p.nudged = now;
    changed = true;
    const line = `You said you'd ${p.what}${p.due ? ` ${dueWords(p.due) === 'tonight' ? 'tonight' : `by ${dueWords(p.due)}`}` : ''}. Done? Say "I did" or tap DONE in Memory.`;
    told.push(line);
    await d.notify({ kind: 'reminder', title: 'Your word', text: line }).catch(() => undefined);
  }
  if (changed) await save(d.storage, list, now);
  const tz = await tzOf(d.storage);
  const local = new Date(now).toLocaleString('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', hour12: false });
  const sunday = /^Sun/.test(local) && Number(local.replace(/\D/g, '')) >= 18;
  if (sunday) {
    const stamp = new Date(now).toLocaleDateString('en-CA', { timeZone: tz });
    if ((await d.storage.get<string>(WEEK_SENT)) !== stamp) {
      await d.storage.put(WEEK_SENT, stamp);
      const lines = weekLines(await weekReview(d.storage, now, tz));
      told.push(lines.join(' '));
      await d.notify({ kind: 'task', title: 'Your week', text: lines.join('\n') }).catch(() => undefined);
    }
  }
  return told;
}

/** What the `recall` tool says of his word when his words ask for it: promises, a place, a reason. '' when nothing fits. */
export async function keepAnswer(storage: DurableObjectStorage, about: string): Promise<string> {
  const q = about.toLowerCase();
  const list = await loadKeep(storage);
  if (/\b(?:promis|said i'?d|i would do|owe|to-?do|my word)\w*/.test(q)) {
    const open = list.filter((x) => x.kind === 'promise' && x.state === 'open');
    return open.length ? `He said he'd: ${open.map((x) => `${x.what}${x.due ? ` (${dueWords(x.due)})` : ''}`).join('; ')}.` : 'No open promises of his.';
  }
  const terms = q.match(/[a-z][a-z'-]{2,}/g)?.filter((w) => !/^(?:the|my|our|where|why|did|pick|chose|choose|put|is|are|what)$/.test(w)) ?? [];
  if (!terms.length) return '';
  const hit = list.filter((x) => x.kind !== 'promise' && terms.some((t) => x.what.toLowerCase().includes(t)));
  return hit.map((x) => (x.kind === 'where' ? `He said ${x.what} is ${x.detail}.` : `He chose ${x.what} because ${x.detail}.`)).join('\n');
}

interface Gone { item: KeepItem; gone: number }

/** Memory → YOUR WORD's routes. */
export async function keepRoute(req: Request, path: string, method: string, storage: DurableObjectStorage): Promise<Response | null> {
  if (path !== '/profile/keep') return null;
  const now = Date.now();
  if (method === 'GET') {
    const tz = await tzOf(storage);
    const week = await weekReview(storage, now, tz);
    return json({ items: await loadKeep(storage), week, lines: weekLines(week) });
  }
  if (method !== 'POST') return json({ error: 'not found' }, 404);
  // [security] a kept line is short: a body past 16 KB is not read whole
  const b = (Number(req.headers.get('content-length') ?? 0) > 16_000 ? {} : await req.json().catch(() => ({}))) as { op?: unknown; id?: unknown; text?: unknown; via?: unknown; days?: unknown };
  const op = String(b.op ?? '');
  const list = await loadKeep(storage);
  if (op === 'add') {
    // his own words from the phone ("the spare key is in the blue tin", said with no signal and sent when it came back)
    const words = typeof b.text === 'string' ? b.text.slice(0, 400) : '';
    const r = await captureTurn(storage, words, { at: now, via: 'phone' });
    return json({ added: r.added, done: r.done, items: await loadKeep(storage) });
  }
  const id = String(b.id ?? '');
  if (op === 'restore') {
    const gone = (await storage.get<Gone[]>(GONE_KEY)) ?? [];
    const g = gone.find((x) => x.item.id === id && now - x.gone < DAY);
    if (!g) return json({ error: 'nothing to undo: it was forgotten too long ago' }, 404);
    await storage.put(GONE_KEY, gone.filter((x) => x !== g));
    await save(storage, [...list.filter((x) => x.id !== id), g.item], now);
    return json({ item: g.item, items: await loadKeep(storage) });
  }
  const it = list.find((x) => x.id === id);
  if (!it) return json({ error: 'that is not there any more' }, 404);
  if (op === 'forget') {
    const gone = ((await storage.get<Gone[]>(GONE_KEY)) ?? []).filter((x) => now - x.gone < DAY);
    gone.push({ item: { ...it }, gone: now });
    await storage.put(GONE_KEY, gone.slice(-50));
    await save(storage, list.filter((x) => x !== it), now);
    return json({ item: null, items: await loadKeep(storage) });
  }
  if (op === 'done' || op === 'drop') Object.assign(it, { state: op === 'done' ? 'done' : 'dropped', doneAt: now });
  else if (op === 'reopen') Object.assign(it, { state: 'open', doneAt: undefined, nudged: undefined });
  else if (op === 'snooze') {
    const days = Math.min(14, Math.max(1, Number(b.days) || 1));
    Object.assign(it, { remindAt: remindAtFor(undefined, now, await tzOf(storage)) - 2 * DAY + days * DAY, nudged: undefined });
  } else if (op === 'pin' || op === 'unpin') it.pinned = op === 'pin';
  else return json({ error: 'unknown change' }, 400);
  await save(storage, list, now);
  return json({ item: it, items: await loadKeep(storage) });
}
