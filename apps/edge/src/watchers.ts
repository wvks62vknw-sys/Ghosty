/**
 * WATCHERS (BRIEF-OCT-IDEAS-2 7): "tell me when this price drops", "tell me when this page changes", "tell me when there's a strike
 * on my line". A watcher is a public page he names. The brain's hourly beat (the guard job's tick, the same beat that reads the
 * warnings for NEAR HOME: no schedule of its own) reads each one, compares it with the last reading on the rules below, and tells
 * him ONCE when it trips, through the one notify path (the inbox, his phone, his Telegram). A tripped watcher is told and done: it
 * stays on the list (WATCHERS under PLAN, STOP on each) with what it told him, and is never read again.
 *   price   a number down: the page's price (shared/money.ts priceOf) is lower than at the last reading;
 *   page    the page's text changed (scripts, styles and tags left out, the words compared as a hash);
 *   strike  the words "strike" or "industrial action" now on the operator's public status page and not at the last reading.
 * Public pages only. Never a login (a page that asks for one is refused, and one that starts to is stopped), never a private
 * person's page (the social networks' own pages are refused: a watcher is for a shop, a status page, a notice). Nothing here asks
 * a model, and nothing leaves the brain but the page's own address.
 *   GET /guardian/watchers · POST /guardian/watchers { kind, url, label? } · DELETE /guardian/watchers?id=
 */
import { priceOf } from '../../../packages/shared/src/money';
import { guardedFetch } from './netguard';
import { parseTarget } from './integrations/recon';
import type { GuardDeps } from './guardstate';
import type { Vault } from './kernel/vault';
import { listMessages, parseEmailKey } from './integrations/mail';
import { againLine, chaseAt, chaseDueLine, chaseSetLine, parcelCameLine, parcelDueLine, parcelSetLine, repliedLine } from '../../../packages/shared/src/recall';

export const WATCHERS_KEY = 'watchers:list';
export type WatchKind = 'price' | 'page' | 'strike' | 'reply';
/** The page watchers (a `reply` watcher is a chase: no page, set with its own fields; addChase below). */
export const WATCH_KINDS: WatchKind[] = ['price', 'page', 'strike'];
/** At most this many at once (each is one read an hour). */
export const MAX_WATCHERS = 8;
/** The least between two reads of one page, so a beat that runs early (or a manual CHECK) is never a hammering of a shop. */
const MIN_GAP = 50 * 60_000;
/** A page body is read to this size at most. */
const MAX_BYTES = 1_200_000;
const UA = 'Mozilla/5.0 (compatible; Ghosty watcher; +public pages only)';

export interface Watcher {
  id: string;
  kind: WatchKind;
  url: string;
  label: string;
  created: number;
  /** When it was last read (ms), and whether that read was good. */
  checked: number;
  ok: boolean;
  /** What the last good reading said, as much as the rule needs. */
  last: { price?: number; hash?: string; strike?: boolean };
  /** watching: read each hour; told: it tripped (never read again); stopped: it cannot go on (a login appeared). */
  state: 'watching' | 'told' | 'stopped';
  /** When it told him, and what it said. */
  toldAt?: number;
  line?: string;
  /** Why the last read failed, in a plain line. */
  note?: string;
  /**
   * [recall] A chase (kind `reply`, BRIEF-DEPTH-MEMORY 3): the name he used for his own correspondent, what it is about, the
   * thread's message id when the Brief's mail gave one, the morning it is checked (ms), whether a mail account was linked when it
   * was set, and that morning's outcome: `repliedAt` (a reply came) or not. No person is profiled: a name, a thread, a day.
   */
  who?: string;
  /** The address of the mail he means (the Brief's line he named), when the phone knew it: the morning's look is by it. */
  from?: string;
  about?: string;
  thread?: string;
  by?: number;
  mail?: boolean;
  repliedAt?: number;
  /** [recall] memory.u4: the second morning to look when the first found nothing ("and again Monday"); memory.s4: a parcel, settled by a delivery email. */
  again?: number;
  wait?: 'parcel';
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface WatchDeps extends Pick<GuardDeps, 'storage' | 'notify'> {
  fetch?: Fetcher;
  now?: () => number;
  /** [recall] The vault, for the mail account already linked (the Brief's): a chase looks in it on its morning, nothing more. */
  vault?: Pick<Vault, 'get'>;
  /** [recall] For the tests: did a reply come (its time), null for none, undefined when no mail account is linked. */
  replied?(w: Watcher): Promise<number | null | undefined>;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const nowOf = (d: Pick<WatchDeps, 'now'>) => (d.now ? d.now() : Date.now());

// ---------------------------------------------------------------- a chase held for days ([recall])

/** Is a mail account linked (the vault's `email` key, as the Brief's mail reads it)? */
async function mailLinked(d: WatchDeps): Promise<boolean> {
  if (d.replied) return (await d.replied({ kind: 'reply' } as Watcher).catch(() => undefined)) !== undefined;
  return !!(await d.vault?.get('email').catch(() => ''));
}

/** On its morning: the first message from him (by the name he used) since the chase was set, through the mail account already linked. */
async function replyCame(d: WatchDeps, w: Watcher): Promise<number | null | undefined> {
  if (d.replied) return d.replied(w);
  const key = await d.vault?.get('email').catch(() => '');
  if (!key) return undefined;
  const cfg = parseEmailKey(key);
  if (w.wait === 'parcel') {
    // (a delivery email since the wait was set: "delivered", from any sender, in his own inbox)
    const p = await listMessages(cfg, { since: new Date(w.created).toISOString().slice(0, 10), subject: 'delivered', limit: 5 });
    const at = p.messages.map((m) => Date.parse(m.date)).filter((t) => Number.isFinite(t) && t >= w.created).sort((a, b) => a - b)[0];
    return at ?? null;
  }
  const r = await listMessages(cfg, { since: new Date(w.created).toISOString().slice(0, 10), ...(w.from || w.who ? { from: w.from || w.who } : {}), ...(!w.from && !w.who && w.about ? { subject: w.about.slice(0, 60) } : {}), limit: 5 });
  const at = r.messages.map((m) => Date.parse(m.date)).filter((t) => Number.isFinite(t) && t >= w.created).sort((a, b) => a - b)[0];
  return at ?? null;
}

/**
 * "Remind me to chase this if Sam doesn't reply by Thursday": a watcher of kind `reply`, checked once, on that morning at 9 (his
 * zone). Said once, when set (chaseSetLine). Without a mail account it is a plain dated reminder, and says so.
 */
export async function addChase(d: WatchDeps, b: { who?: unknown; day?: unknown; about?: unknown; thread?: unknown; from?: unknown; tz?: unknown; again?: unknown; wait?: unknown }): Promise<{ watcher?: Watcher; said: string; error?: string }> {
  const day = typeof b.day === 'string' ? b.day.toLowerCase().trim() : '';
  if (!/^(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(day)) return { said: '', error: 'say by when: a day like Thursday, or tomorrow' };
  const who = typeof b.who === 'string' ? b.who.replace(/[^\p{L}\p{N} '’.-]/gu, '').trim().slice(0, 40) : '';
  const about = typeof b.about === 'string' ? b.about.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const thread = typeof b.thread === 'string' ? b.thread.slice(0, 200) : '';
  const from = typeof b.from === 'string' && /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}$/.test(b.from.trim()) ? b.from.trim() : '';
  const tz = typeof b.tz === 'string' && b.tz ? b.tz : 'UTC';
  const list = await loadWatchers(d.storage);
  if (list.filter((w) => w.state === 'watching').length >= MAX_WATCHERS) return { said: '', error: `I’m watching ${MAX_WATCHERS} things already: stop one first.` };
  const now = nowOf(d);
  const by = chaseAt(day, now, tz);
  const mail = await mailLinked(d);
  const parcel = b.wait === 'parcel';
  const againDay = typeof b.again === 'string' && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(b.again) ? b.again : '';
  const again = againDay ? chaseAt(againDay, by + 3600_000, tz) : 0;
  const label = parcel ? `The parcel${about ? `: ${about.slice(0, 50)}` : ''}` : `Chase ${who || 'a reply'}${about ? `: ${about.slice(0, 50)}` : ''}`;
  const w: Watcher = { id: shortId(), kind: 'reply', url: '', label, created: now, checked: now, ok: true, last: {}, state: 'watching', ...(who ? { who } : {}), ...(about ? { about } : {}), ...(thread ? { thread } : {}), ...(from ? { from } : {}), by, mail, ...(again ? { again } : {}), ...(parcel ? { wait: 'parcel' as const } : {}) };
  await saveWatchers(d.storage, [...list, w]);
  const said = parcel ? parcelSetLine(by, tz, mail) : chaseSetLine(who, by, tz, mail);
  return { watcher: w, said: again ? `${said} ${againLine(again, tz)}` : said };
}

/** A chase on its morning: the reply looked for once, and the one line that fits told through the one notify path. */
async function chaseTick(d: WatchDeps, w: Watcher, now: number, tz: string): Promise<string | null> {
  if (!w.by || now < w.by) return null;
  let came: number | null | undefined;
  try {
    came = await replyCame(d, w);
  } catch {
    // the mail did not answer: look again on the next beat, for a day; then it is a plain reminder
    if (now - w.by < 86_400_000) {
      w.note = 'I could not reach your mail this time';
      return null;
    }
    came = undefined;
  }
  w.toldAt = now;
  w.checked = now;
  if (came) {
    w.state = 'told';
    w.repliedAt = came;
    w.line = w.wait === 'parcel' ? parcelCameLine(came, tz) : repliedLine(w.who ?? '', came, tz);
  } else {
    w.line = w.wait === 'parcel' ? parcelDueLine(w.about ?? '', came === null) : chaseDueLine(w.who ?? '', w.about ?? '', came === null);
    // "and again Monday": it holds, and looks once more that morning (then it is told and done)
    if (w.again && w.again > now) {
      w.by = w.again;
      delete w.again;
      w.line = `${w.line} ${againLine(w.by, tz)}`;
    } else w.state = 'told';
  }
  await d.notify({ kind: 'reminder', title: came ? (w.wait === 'parcel' ? 'Your parcel' : 'Nothing to chase') : w.wait === 'parcel' ? 'Your parcel' : `Chase ${w.who || 'that reply'}`, text: w.line }).catch(() => undefined);
  return w.line;
}
export const loadWatchers = async (s: DurableObjectStorage): Promise<Watcher[]> => (await s.get<Watcher[]>(WATCHERS_KEY)) ?? [];
export const saveWatchers = (s: DurableObjectStorage, list: Watcher[]) => s.put(WATCHERS_KEY, list);

// ---------------------------------------------------------------- which pages

/** Where a person's own pages live: never watched. */
const PEOPLE_HOSTS = /(^|\.)(facebook|instagram|tiktok|snapchat|linkedin|twitter|x|threads|reddit|whatsapp|pinterest|tumblr|bsky|t\.me|telegram|discord|onlyfans|patreon|mastodon\.social)\.(com|net|me|app|gg|social|org)$/i;

/** Why this address cannot be a watcher, in a plain line, or '' when it can. */
export function whyNot(raw: string): string {
  let host = '';
  try {
    const t = parseTarget(raw);
    host = t.host;
    if (!/^https:\/\//i.test(t.url)) return 'Send the page’s full https:// address and I’ll watch it.';
    if (t.kind === 'ip') return 'I only watch public web pages with a name, never an address on a network.';
  } catch (e) {
    return `${String((e as Error).message).replace(/^recon is /i, '').replace(/ — .*$/, '')}.`.replace(/^./, (c) => c.toUpperCase());
  }
  if (PEOPLE_HOSTS.test(host)) return 'That is a page on someone’s account: I only watch public pages like a shop, a notice or an operator’s status page, never a person’s.';
  return '';
}

// ---------------------------------------------------------------- reading a page

/** The words of a page, scripts, styles and tags left out, in one line of single spaces. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&pound;|&#163;/g, '£')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A short, steady hash of text (FNV-1a over 32 bits, twice with a different start): equal words, equal hash. */
export function hashOf(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

const STRIKE = /\b(strikes?|industrial action)\b/i;
/** The words round the first mention of a strike, for the note he gets ("…services may be affected by strike action on…"). */
export function strikeWords(text: string): string {
  const m = STRIKE.exec(text);
  if (!m) return '';
  const from = Math.max(0, m.index - 70);
  const bit = text.slice(from, m.index + m[0].length + 90).replace(/\s+/g, ' ').trim();
  return `${from > 0 ? '…' : ''}${bit}…`;
}

/** Does the page ask him to sign in: a password field or a sign-in address we were sent to. */
const loginPage = (html: string, finalUrl: string): boolean => /<input[^>]+type=["']?password/i.test(html) || /\/(log-?in|sign-?in|signin|account\/login|auth)\b/i.test(new URL(finalUrl).pathname);

export interface Reading {
  html: string;
  text: string;
  /** The address it ended at after redirects. */
  url: string;
}

/** One read: https only, a body of at most MAX_BYTES, nine seconds, a login or a private address on the way refused. Throws a plain line. */
export async function readPage(fetcher: Fetcher, url: string): Promise<Reading> {
  // [security] each redirect hop is checked BEFORE it is asked (a redirect into a private address is never requested)
  let r: Response;
  try {
    r = await guardedFetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.5' }, signal: AbortSignal.timeout(9000) }, { fetcher });
  } catch (e) {
    if (/redirect/.test(String((e as Error)?.message))) throw new Error('moved');
    throw e;
  }
  if (r.status === 401 || r.status === 403) throw new Error('login');
  if (!r.ok) throw new Error(`the page answered ${r.status}`);
  const end = r.url || url;
  const bad = whyNot(end);
  if (bad) throw new Error('moved');
  let html = '';
  if (r.body) {
    const reader = r.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      parts.push(value);
      size += value.byteLength;
    }
    reader.cancel().catch(() => undefined);
    const all = new Uint8Array(Math.min(size, MAX_BYTES));
    let at = 0;
    for (const p of parts) {
      const piece = p.subarray(0, Math.max(0, all.length - at));
      all.set(piece, at);
      at += piece.length;
    }
    html = new TextDecoder().decode(all);
  } else html = await r.text();
  if (loginPage(html, end)) throw new Error('login');
  return { html, text: pageText(html), url: end };
}

const plainWhy = (e: unknown): string => {
  const m = String((e as Error)?.message ?? e);
  if (m === 'login') return 'it asks for a login, and I never sign in to anything';
  if (m === 'moved') return 'it sends me to a page I will not watch';
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return 'it did not answer in time';
  if (e instanceof TypeError) return 'it could not be reached';
  return m.slice(0, 120);
};

const titleOf = (html: string, url: string): string => {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const clean = (t ?? '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (clean) return clean.slice(0, 70);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
};

const pounds = (n: number) => `£${n.toFixed(2).replace(/\.00$/, '')}`;

// ---------------------------------------------------------------- the rules (pure)

/** What a reading says for this kind: the number, the hash, the word. */
export function readingOf(kind: WatchKind, r: Reading): { price?: number; hash?: string; strike?: boolean } | null {
  if (kind === 'price') {
    const p = priceOf(r.html);
    return p ? { price: p.price } : null;
  }
  if (kind === 'page') return { hash: hashOf(r.text) };
  return { strike: STRIKE.test(r.text) };
}

/**
 * Compare a fresh reading with the last one on the kind's rule: the line he is told when it trips, else null. Pure.
 * A price trips on a drop of a penny or more; a page on any change of its words; a strike on the word appearing where it was not.
 */
export function tripped(w: Pick<Watcher, 'kind' | 'label' | 'last'>, now: { price?: number; hash?: string; strike?: boolean }, r?: Reading): string | null {
  if (w.kind === 'price' && now.price !== undefined && w.last.price !== undefined && now.price <= w.last.price - 0.005) return `${w.label} is ${pounds(now.price)} now, down from ${pounds(w.last.price)}.`;
  if (w.kind === 'page' && now.hash !== undefined && w.last.hash !== undefined && now.hash !== w.last.hash) return `${w.label} has changed since I last looked.`;
  if (w.kind === 'strike' && now.strike && !w.last.strike) return `${w.label} now mentions a strike: ${r ? strikeWords(r.text) : 'see the page'}`;
  return null;
}

const TITLES: Record<WatchKind, string> = { price: 'Price dropped', page: 'Page changed', strike: 'Strike on your line', reply: 'Chase' };

// ---------------------------------------------------------------- the beat

/**
 * One look at every watcher that is due (the guard job's hourly beat; `force` for his own CHECK NOW): each page read, compared,
 * told once when it trips. A page that did not answer changes nothing (a failed look is never a change). Returns the lines told.
 */
export async function watchersTick(d: WatchDeps, o: { force?: boolean } = {}): Promise<string[]> {
  const list = await loadWatchers(d.storage);
  if (!list.some((w) => w.state === 'watching')) return [];
  const fetcher: Fetcher = d.fetch ?? ((u, i) => fetch(u, i));
  const now = nowOf(d);
  const told: string[] = [];
  const tz = (await d.storage.get<{ tz?: string }>('owner:ctx').catch(() => null))?.tz || 'UTC';
  for (const w of list) {
    if (w.state === 'watching' && w.kind === 'reply') {
      const line = await chaseTick(d, w, now, tz);
      if (line) told.push(line);
      continue;
    }
    if (w.state !== 'watching' || (!o.force && now - w.checked < MIN_GAP)) continue;
    try {
      const r = await readPage(fetcher, w.url);
      w.checked = now;
      w.ok = true;
      delete w.note;
      const got = readingOf(w.kind, r);
      if (!got) {
        w.note = w.kind === 'price' ? 'I could not find a price on the page this time' : 'I could not read the page this time';
        continue;
      }
      const line = tripped(w, got, r);
      if (line) {
        w.state = 'told';
        w.toldAt = now;
        w.line = line;
        told.push(line);
        await d.notify({ kind: 'task', title: TITLES[w.kind], text: `${line} ${w.url}` }).catch(() => undefined);
      } else w.last = { ...w.last, ...got };
    } catch (e) {
      w.checked = now;
      w.ok = false;
      w.note = `I could not read it: ${plainWhy(e)}`;
      if ((e as Error)?.message === 'login') w.state = 'stopped';
    }
  }
  await saveWatchers(d.storage, list);
  return told;
}

/** A watcher as the phone lists it (never the hash). */
export const publicWatcher = (w: Watcher) => ({ id: w.id, kind: w.kind, url: w.url, label: w.label, created: w.created, checked: w.checked, ok: w.ok, state: w.state, ...(w.kind === 'reply' ? { ...(w.who ? { who: w.who } : {}), ...(w.about ? { about: w.about } : {}), ...(w.by ? { by: w.by } : {}), mail: !!w.mail, ...(w.repliedAt ? { repliedAt: w.repliedAt } : {}) } : {}), ...(w.toldAt ? { toldAt: w.toldAt } : {}), ...(w.line ? { line: w.line } : {}), ...(w.note ? { note: w.note } : {}), ...(w.last.price !== undefined ? { price: w.last.price } : {}), ...(w.last.strike !== undefined ? { strikeNow: w.last.strike } : {}) });

const shortId = () => [...crypto.getRandomValues(new Uint8Array(5))].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Start a watcher: the page read now (a price must be there, a login refused), its first reading kept; the line he is answered with. */
export async function addWatcher(d: WatchDeps, b: { kind?: unknown; url?: unknown; label?: unknown }): Promise<{ watcher?: Watcher; said: string; error?: string }> {
  const kind = WATCH_KINDS.find((k) => k === b.kind);
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  if (!kind) return { said: '', error: 'say what to watch for: a price, a page or a strike' };
  const bad = whyNot(url);
  if (bad) return { said: '', error: bad };
  const list = await loadWatchers(d.storage);
  if (list.filter((w) => w.state === 'watching').length >= MAX_WATCHERS) return { said: '', error: `I’m watching ${MAX_WATCHERS} pages already: stop one first.` };
  const fetcher: Fetcher = d.fetch ?? ((u, i) => fetch(u, i));
  let r: Reading;
  try {
    r = await readPage(fetcher, parseTarget(url).url);
  } catch (e) {
    return { said: '', error: `I couldn’t read that page: ${plainWhy(e)}.` };
  }
  const got = readingOf(kind, r);
  if (!got) return { said: '', error: kind === 'price' ? 'I couldn’t find a price on that page, so there is nothing to watch. Try the product’s own page.' : 'I couldn’t read any words on that page.' };
  const label = (typeof b.label === 'string' && b.label.trim().slice(0, 70)) || titleOf(r.html, r.url);
  const now = nowOf(d);
  const w: Watcher = { id: shortId(), kind, url: parseTarget(url).url, label, created: now, checked: now, ok: true, last: got, state: 'watching' };
  await saveWatchers(d.storage, [...list.filter((x) => x.url !== w.url || x.kind !== w.kind), w]);
  const said =
    kind === 'price' ? `Watching ${label}: ${pounds(got.price!)} now. I look every hour and tell you once when it drops.`
    : kind === 'page' ? `Watching ${label}. I look every hour and tell you once when its words change. A page with a clock or an advert on it can look changed when it isn’t.`
    : got.strike ? `Watching ${label}. It already mentions a strike today: ${strikeWords(r.text)} I’ll tell you if that goes and one appears again.`
    : `Watching ${label}. I look every hour and tell you once when it mentions a strike or industrial action.`;
  return { watcher: w, said };
}

export async function watchersRoute(req: Request, path: string, method: string, url: URL, d: WatchDeps): Promise<Response> {
  if (path === '/guardian/watchers' && method === 'GET') return json({ watchers: (await loadWatchers(d.storage)).map(publicWatcher), max: MAX_WATCHERS });
  if (path === '/guardian/watchers' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = b.kind === 'reply' ? await addChase(d, b) : await addWatcher(d, b);
    return r.error ? json({ error: r.error }, 400) : json({ watcher: publicWatcher(r.watcher!), said: r.said });
  }
  if (path === '/guardian/watchers' && method === 'DELETE') {
    const id = url.searchParams.get('id') ?? '';
    const list = await loadWatchers(d.storage);
    const left = list.filter((w) => w.id !== id);
    if (left.length === list.length) return json({ removed: false, watchers: list.map(publicWatcher) });
    await saveWatchers(d.storage, left);
    return json({ removed: true, watchers: left.map(publicWatcher) });
  }
  return json({ error: 'not found' }, 404);
}
