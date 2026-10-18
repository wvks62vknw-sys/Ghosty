/**
 * Ghosty's diary and alarm clock, all kept in the brain's Durable Object storage:
 *
 *  - events    the owner's own agenda entries
 *  - feeds     read-only calendar subscriptions (.ics links, e.g. Google Calendar's
 *              "secret address"); the link itself is kept encrypted in the vault
 *  - jobs      reminders (just a notification) and tasks (Ghosty runs a prompt on its
 *              own and reports back), one-off or repeating
 *  - inbox     what Ghosty told the owner while they were away
 *
 * One Durable Object alarm is always set for the soonest job; agent.ts handles it.
 */
import type { NotifyKind } from './notifyprefs';
import type { Vault } from './kernel/vault';
import { fromZoned, nextRun, safeTz, zoned, type Repeat } from './time';

export interface Job {
  id: string;
  /**
   * reminder = notify; task = Ghosty runs a prompt; verify = internal check of a shipped change;
   * study = self-study session (no AI); reflect = the nightly look back at the day's conversation
   * (profile.ts); digest = the morning gathering of fresh knowledge (library/digest.ts);
   * project = one step of a project that runs for days (projects.ts; `text` is the project's id);
   * upgrade = the daily upgrade ideas (upgrades.ts); train = the offline brain's weekly self-training (selftrain/cycle.ts)
   */
  kind: 'reminder' | 'task' | 'verify' | 'study' | 'reflect' | 'digest' | 'project' | 'upgrade' | 'revise' | 'train';
  title: string;
  /** Reminder text, or the task prompt Ghosty runs. */
  text: string;
  next: number;
  repeat: Repeat;
  tz: string;
  createdAt: number;
  /** Set when the job belongs to an agenda event (deleted with it). */
  eventId?: string;
  lastRun?: number;
  lastResult?: string;
  runs?: number;
}

export interface InboxItem {
  id: string;
  at: number;
  kind: 'reminder' | 'task' | 'error';
  title: string;
  text: string;
  read?: boolean;
  /** Which NOTIFICATIONS switch it falls under, as its sender says (notifyprefs.ts); none: always sent. */
  pushKind?: NotifyKind;
  /** That switch was off when it came: kept here only (no push, no Telegram, no alert in the app). */
  quiet?: boolean;
}

export interface AgendaEvent {
  id: string;
  title: string;
  start: number;
  end?: number;
  allDay?: boolean;
  location?: string;
  notes?: string;
  /** "mine" or the calendar feed's name. */
  source: string;
}

export interface Feed {
  id: string;
  name: string;
  at: number;
}

const JOBS = 'jobs';
const INBOX = 'inbox';
const EVENTS = 'events';
const FEEDS = 'feeds';
const MAX_JOBS = 200;
const MAX_EVENTS = 2000;

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);

// ── jobs ─────────────────────────────────────────────────────────────────────────

export async function loadJobs(storage: DurableObjectStorage): Promise<Job[]> {
  return (await storage.get<Job[]>(JOBS)) ?? [];
}

/**
 * Every change to the job list goes through here, one at a time per brain. Each change reads the whole list and
 * writes it back: a reminder delivered while a background job waits for AI room would otherwise save over the
 * job's own update (or the other way round), bringing a reminder back or losing a task's next time.
 */
const jobQueues = new WeakMap<DurableObjectStorage, Promise<unknown>>();
function withJobs<T>(storage: DurableObjectStorage, change: () => Promise<T>): Promise<T> {
  const run = (jobQueues.get(storage) ?? Promise.resolve()).then(change, change);
  jobQueues.set(storage, run.catch(() => undefined));
  return run;
}

async function saveJobs(storage: DurableObjectStorage, jobs: Job[]): Promise<void> {
  jobs.sort((a, b) => a.next - b.next);
  await storage.put(JOBS, jobs);
  await rearm(storage, jobs);
}

/** Point the Durable Object alarm at the soonest job. */
export async function rearm(storage: DurableObjectStorage, jobs?: Job[]): Promise<void> {
  const list = jobs ?? (await loadJobs(storage));
  if (!list.length) return;
  const soonest = Math.min(...list.map((j) => j.next));
  const current = await storage.getAlarm();
  if (current === null || current > soonest || current < Date.now() - 60_000) await storage.setAlarm(Math.max(soonest, Date.now() + 1000));
}

export async function addJob(
  storage: DurableObjectStorage,
  j: { kind: Job['kind']; title: string; text: string; next: number; repeat?: Repeat; tz: string; eventId?: string },
): Promise<Job> {
  const tz = safeTz(j.tz);
  const repeat = j.repeat ?? 'none';
  let next = j.next;
  if (!Number.isFinite(next)) throw new Error('that time could not be understood');
  if (next < Date.now() - 60_000) {
    if (repeat === 'none') throw new Error('that time is in the past');
    next = nextRun(next, repeat, tz) ?? next;
  }
  if (repeat === 'weekdays') {
    const z = zoned(next, tz);
    if (z.wd === 0 || z.wd === 6) next = fromZoned(z.y, z.m, z.d + (z.wd === 6 ? 2 : 1), z.h, z.mi, tz);
  }
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    if (jobs.length >= MAX_JOBS) throw new Error(`there are already ${MAX_JOBS} reminders and tasks; cancel some first`);
    const job: Job = {
      id: newId(),
      kind: j.kind,
      title: j.title.trim().slice(0, 120) || (j.kind === 'task' ? 'Task' : 'Reminder'),
      text: j.text.trim().slice(0, 4000),
      next,
      repeat,
      tz,
      createdAt: Date.now(),
      ...(j.eventId ? { eventId: j.eventId } : {}),
    };
    jobs.push(job);
    await saveJobs(storage, jobs);
    return job;
  });
}

/**
 * A job Ghosty keeps for itself (the nightly reflection, the morning digest): exactly one of
 * its kind, first due at the given wall-clock time in `tz`. Already there: it is kept as it is
 * (re-timed when the owner's time zone has changed) and any extra of the same kind goes, so
 * this is safe to call on every request.
 */
export async function ensureJob(storage: DurableObjectStorage, j: { kind: Job['kind']; title: string; text: string; hour: number; minute: number; tz: string; repeat: Repeat }): Promise<Job> {
  const tz = safeTz(j.tz);
  const now = Date.now();
  const z = zoned(now, tz);
  let next = fromZoned(z.y, z.m, z.d, j.hour, j.minute, tz);
  if (next <= now) next = fromZoned(z.y, z.m, z.d + 1, j.hour, j.minute, tz);
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    const mine = jobs.filter((x) => x.kind === j.kind);
    if (mine.length) {
      // The standing job stays: the one due at the asked wall-clock time (a stray duplicate from a merge or a second
      // brain is usually due at some other time), the oldest of those, since jobs are listed by due time.
      const onTime = (x: Job) => {
        const w = zoned(x.next, tz);
        return w.h === j.hour && w.mi === j.minute;
      };
      const keep = [...mine].sort((a, b) => Number(onTime(b)) - Number(onTime(a)) || a.createdAt - b.createdAt)[0]!;
      const extras = new Set(mine.filter((x) => x !== keep));
      let changed = extras.size > 0;
      if (keep.tz !== tz) {
        keep.tz = tz;
        keep.next = next;
        changed = true;
      }
      if (changed) await saveJobs(storage, jobs.filter((x) => !extras.has(x)));
      return keep;
    }
    if (jobs.length >= MAX_JOBS) throw new Error(`there are already ${MAX_JOBS} reminders and tasks; cancel some first`);
    const job: Job = { id: newId(), kind: j.kind, title: j.title.trim().slice(0, 120), text: j.text.trim().slice(0, 4000), next, repeat: j.repeat, tz, createdAt: now };
    jobs.push(job);
    await saveJobs(storage, jobs);
    return job;
  });
}

export async function removeJob(storage: DurableObjectStorage, id: string): Promise<boolean> {
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    const keep = jobs.filter((j) => j.id !== id);
    if (keep.length === jobs.length) return false;
    await saveJobs(storage, keep);
    return true;
  });
}

/** After a job ran: move a repeating job to its next time, or delete a one-off. */
export async function finishJob(storage: DurableObjectStorage, id: string, result?: string): Promise<void> {
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    const nxt = nextRun(j.next, j.repeat, j.tz);
    if (nxt === null) {
      await saveJobs(storage, jobs.filter((x) => x.id !== id));
      return;
    }
    j.next = nxt;
    j.lastRun = Date.now();
    j.runs = (j.runs ?? 0) + 1;
    if (result !== undefined) j.lastResult = result.slice(0, 600);
    await saveJobs(storage, jobs);
  });
}

/** Run a job at a time of its own choosing next (a study session that wants to come back sooner or later). */
export async function setNext(storage: DurableObjectStorage, id: string, at: number): Promise<void> {
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    j.next = Math.max(Date.now() + 1000, at);
    await saveJobs(storage, jobs);
  });
}

export async function deferJob(storage: DurableObjectStorage, id: string, ms: number): Promise<void> {
  return withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    j.next = Date.now() + ms;
    await saveJobs(storage, jobs);
  });
}

// ── inbox ────────────────────────────────────────────────────────────────────────

export async function loadInbox(storage: DurableObjectStorage): Promise<InboxItem[]> {
  return (await storage.get<InboxItem[]>(INBOX)) ?? [];
}

export async function addInbox(storage: DurableObjectStorage, item: Omit<InboxItem, 'id' | 'at'>): Promise<InboxItem> {
  const list = await loadInbox(storage);
  const it: InboxItem = { id: newId(), at: Date.now(), ...item, title: item.title.slice(0, 120), text: item.text.slice(0, 4000) };
  list.push(it);
  await storage.put(INBOX, list.slice(-150));
  return it;
}

export async function markRead(storage: DurableObjectStorage, ids: string[] | 'all'): Promise<void> {
  const list = await loadInbox(storage);
  for (const it of list) if (ids === 'all' || ids.includes(it.id)) it.read = true;
  await storage.put(INBOX, list);
}

// ── events ───────────────────────────────────────────────────────────────────────

export async function loadEvents(storage: DurableObjectStorage): Promise<AgendaEvent[]> {
  return (await storage.get<AgendaEvent[]>(EVENTS)) ?? [];
}

export async function addEvent(storage: DurableObjectStorage, e: Omit<AgendaEvent, 'id' | 'source'>): Promise<AgendaEvent> {
  if (!Number.isFinite(e.start)) throw new Error('the start time could not be understood');
  const list = (await loadEvents(storage)).filter((x) => (x.end ?? x.start) > Date.now() - 180 * 86400_000); // keep ~6 months of history
  if (list.length >= MAX_EVENTS) throw new Error('the agenda is full');
  const ev: AgendaEvent = {
    id: newId(),
    title: e.title.trim().slice(0, 200) || 'Event',
    start: e.start,
    ...(e.end && e.end > e.start ? { end: e.end } : {}),
    ...(e.allDay ? { allDay: true } : {}),
    ...(e.location ? { location: e.location.slice(0, 200) } : {}),
    ...(e.notes ? { notes: e.notes.slice(0, 2000) } : {}),
    source: 'mine',
  };
  list.push(ev);
  list.sort((a, b) => a.start - b.start);
  await storage.put(EVENTS, list);
  return ev;
}

export async function removeEvent(storage: DurableObjectStorage, id: string): Promise<AgendaEvent | null> {
  const list = await loadEvents(storage);
  const ev = list.find((x) => x.id === id);
  if (!ev) return null;
  await storage.put(EVENTS, list.filter((x) => x.id !== id));
  await withJobs(storage, async () => {
    const jobs = await loadJobs(storage);
    if (jobs.some((j) => j.eventId === id)) await saveJobs(storage, jobs.filter((j) => j.eventId !== id));
  });
  return ev;
}

// ── calendar feeds (.ics) ────────────────────────────────────────────────────────

export async function loadFeeds(storage: DurableObjectStorage): Promise<Feed[]> {
  return (await storage.get<Feed[]>(FEEDS)) ?? [];
}

export function checkFeedUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'));
  } catch {
    throw new Error('that is not a valid link');
  }
  if (u.protocol !== 'https:') throw new Error('calendar links must start with https:// (or webcal://)');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || /^(\d+\.){3}\d+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('that address is not allowed');
  }
  return u.toString();
}

export async function addFeed(storage: DurableObjectStorage, vault: Vault, name: string, url: string): Promise<Feed> {
  const clean = checkFeedUrl(url);
  const feeds = await loadFeeds(storage);
  if (feeds.length >= 12) throw new Error('up to 12 calendars can be connected');
  const feed: Feed = { id: newId(), name: name.trim().slice(0, 60) || 'Calendar', at: Date.now() };
  await vault.set(`cal:${feed.id}`, clean);
  feeds.push(feed);
  await storage.put(FEEDS, feeds);
  await storage.delete(`feedcache:${feed.id}`);
  return feed;
}

export async function removeFeed(storage: DurableObjectStorage, vault: Vault, id: string): Promise<boolean> {
  const feeds = await loadFeeds(storage);
  if (!feeds.some((f) => f.id === id)) return false;
  await storage.put(FEEDS, feeds.filter((f) => f.id !== id));
  await vault.set(`cal:${id}`, '');
  await storage.delete(`feedcache:${id}`);
  return true;
}

/** A calendar feed boiled down to what Ghosty needs (small enough to cache). */
interface FeedCache {
  at: number;
  series: Series[];
  error?: string;
}

/** Parsed feed events, re-fetched every 15 minutes. */
async function feedSeries(storage: DurableObjectStorage, vault: Vault, f: Feed, tz: string, force = false): Promise<FeedCache> {
  const key = `feedcache:${f.id}`;
  const cached = await storage.get<FeedCache>(key);
  if (cached && !force && Date.now() - cached.at < 15 * 60_000) return cached;
  const url = await vault.get(`cal:${f.id}`);
  if (!url) return { at: Date.now(), series: [], error: 'link missing' };
  try {
    const r = await fetch(url, { headers: { Accept: 'text/calendar, text/plain, */*', 'User-Agent': 'Ghosty/2.0 (personal calendar reader)' }, redirect: 'follow' });
    if (!r.ok) throw new Error(`calendar answered ${r.status}`);
    if (r.url) checkFeedUrl(r.url);
    const text = (await r.text()).slice(0, 3_000_000);
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('that link does not return a calendar (.ics)');
    // Keep repeating series and anything from two weeks ago to a year ahead.
    const now = Date.now();
    let series = parseIcs(text, tz).filter((x) => (x.rule ? ruleEnd(x) > now - 14 * 86400_000 : x.start + x.dur > now - 14 * 86400_000 && x.start < now + 400 * 86400_000));
    series.sort((a, b) => Math.abs(a.start - now) - Math.abs(b.start - now));
    // Durable Object values are limited to 128 KB.
    while (series.length && JSON.stringify(series).length > 110_000) series = series.slice(0, Math.floor(series.length * 0.8));
    const out: FeedCache = { at: now, series };
    await storage.put(key, out);
    return out;
  } catch (e) {
    // Cache the failure too, so a broken or hostile feed isn't re-fetched on every request.
    const out: FeedCache = { at: Date.now(), series: cached?.series ?? [], error: String((e as Error)?.message ?? e).slice(0, 160) };
    await storage.put(key, out).catch(() => undefined);
    return out;
  }
}

/** All events (own + every calendar feed) overlapping [from, to), sorted. */
export async function agenda(
  storage: DurableObjectStorage,
  vault: Vault,
  from: number,
  to: number,
  tz: string,
): Promise<{ events: AgendaEvent[]; errors: string[] }> {
  const mine = (await loadEvents(storage)).filter((e) => (e.end ?? e.start + 1) > from && e.start < to);
  const errors: string[] = [];
  const out = [...mine];
  for (const f of await loadFeeds(storage)) {
    const c = await feedSeries(storage, vault, f, tz);
    if (c.error) errors.push(`${f.name}: ${c.error}`);
    out.push(...expandSeries(c.series, from, to, f.name));
  }
  out.sort((a, b) => a.start - b.start);
  return { events: out.slice(0, 500), errors };
}

// ── .ics parsing ─────────────────────────────────────────────────────────────────

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function parseProp(line: string): Prop | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [name, ...ps] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v] = p.split('=');
    if (k && v !== undefined) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  }
  return { name: name!.toUpperCase(), params, value: line.slice(i + 1) };
}

const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** One date/time value → UTC ms (+ whether it is a whole-day date). */
export function icsTime(value: string, params: Record<string, string>, tz: string): { t: number; allDay: boolean } | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m || params.VALUE === 'DATE') {
    m = m ?? v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { t: fromZoned(+m[1]!, +m[2]!, +m[3]!, 0, 0, tz), allDay: true };
  }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '0', z] = m;
  if (z) return { t: Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s), allDay: false };
  const zone = params.TZID && safeTz(params.TZID) !== 'UTC' ? params.TZID : windowsZone(params.TZID) ?? tz;
  return { t: fromZoned(+y!, +mo!, +d!, +h!, +mi!, zone, +s), allDay: false };
}

/** Outlook calendars often use Windows zone names. */
function windowsZone(name?: string): string | undefined {
  if (!name) return undefined;
  const map: Record<string, string> = {
    'GMT Standard Time': 'Europe/London',
    'Greenwich Standard Time': 'Etc/GMT',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Romance Standard Time': 'Europe/Paris',
    'Central Europe Standard Time': 'Europe/Budapest',
    'Eastern Standard Time': 'America/New_York',
    'Central Standard Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver',
    'Pacific Standard Time': 'America/Los_Angeles',
    'India Standard Time': 'Asia/Kolkata',
    'Arabian Standard Time': 'Asia/Dubai',
    'Pakistan Standard Time': 'Asia/Karachi',
    'China Standard Time': 'Asia/Shanghai',
    'Tokyo Standard Time': 'Asia/Tokyo',
    'AUS Eastern Standard Time': 'Australia/Sydney',
    UTC: 'UTC',
  };
  return map[name];
}

function parseDuration(s: string): number {
  const m = s.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Occurrence start times of an RRULE within [from, to). */
function expandRule(start: number, rule: string, tz: string, from: number, to: number, exdates: Set<number>, duration: number): number[] {
  const r: Record<string, string> = {};
  for (const part of rule.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) r[k.toUpperCase()] = v;
  }
  const freq = r.FREQ;
  const interval = Math.max(1, parseInt(r.INTERVAL ?? '1', 10) || 1);
  const count = r.COUNT ? Math.min(2000, Math.max(0, parseInt(r.COUNT, 10) || 0)) : Infinity;
  const until = r.UNTIL ? icsTime(r.UNTIL, {}, tz)?.t ?? Infinity : Infinity;
  const z0 = zoned(start, tz);
  const byday = [...new Set((r.BYDAY ?? '').split(',').filter(Boolean))].slice(0, 14).map((d) => {
    const mm = d.match(/^([+-]?\d+)?([A-Z]{2})$/);
    return mm ? { n: mm[1] ? parseInt(mm[1], 10) : 0, wd: BYDAY[mm[2]!] ?? 0 } : null;
  }).filter((x): x is { n: number; wd: number } => !!x);
  const bymonthday = [...new Set((r.BYMONTHDAY ?? '').split(',').filter(Boolean).map((x) => parseInt(x, 10)))].filter((x) => x >= -31 && x <= 31 && x !== 0).slice(0, 31);
  const out: number[] = [];
  let n = 0;
  const emit = (t: number): boolean => {
    if (t < start) return true;
    if (t > until || n >= count) return false;
    n++;
    if (t + duration > from && t < to && !exdates.has(t)) out.push(t);
    return t < to;
  };
  const at = (y: number, m: number, d: number) => fromZoned(y, m, d, z0.h, z0.mi, tz, z0.s);
  // Without COUNT, jump close to the window instead of walking from a start date that may
  // be decades ago. Period estimates err long (31-day months), so we never jump too far.
  const DAY = 86400_000;
  const per = ({ DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366 } as Record<string, number>)[freq ?? ''];
  const i0 = count === Infinity && per && from > start ? Math.max(0, Math.floor((from - start) / (per * interval * DAY)) - 2) : 0;
  for (let i = i0; i < i0 + (count === Infinity ? 400 : 2000); i++) {
    if (freq === 'DAILY') {
      if (!emit(at(z0.y, z0.m, z0.d + i * interval))) break;
    } else if (freq === 'WEEKLY') {
      const days = [...new Set(byday.length ? byday.map((b) => b.wd) : [z0.wd])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const weekStart = z0.d - ((z0.wd - 1 + 7) % 7) + i * 7 * interval; // Monday of this week
      let more = true;
      for (const wd of days) {
        if (!emit(at(z0.y, z0.m, weekStart + ((wd - 1 + 7) % 7)))) {
          more = false;
          break;
        }
      }
      if (!more) break;
    } else if (freq === 'MONTHLY') {
      const mIdx = z0.m - 1 + i * interval;
      const y = z0.y + Math.floor(mIdx / 12);
      const mo = (mIdx % 12) + 1;
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const days: number[] = [];
      if (byday.length) {
        for (const b of byday) {
          const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
          const all: number[] = [];
          for (let d = 1 + ((b.wd - first + 7) % 7); d <= dim; d += 7) all.push(d);
          if (b.n > 0 && all[b.n - 1]) days.push(all[b.n - 1]!);
          else if (b.n < 0 && all[all.length + b.n]) days.push(all[all.length + b.n]!);
          else if (b.n === 0) days.push(...all);
        }
      } else if (bymonthday.length) {
        for (const d of bymonthday) days.push(d < 0 ? dim + d + 1 : d);
      } else days.push(z0.d);
      let more = true;
      for (const d of [...new Set(days)].filter((x) => x >= 1 && x <= dim).sort((a, b) => a - b)) {
        if (!emit(at(y, mo, d))) {
          more = false;
          break;
        }
      }
      if (!more) break;
    } else if (freq === 'YEARLY') {
      if (!emit(at(z0.y + i * interval, z0.m, z0.d))) break;
    } else break;
  }
  return out;
}

/** One VEVENT: a single event, or a repeating series (rule) in its own time zone. */
export interface Series {
  uid: string;
  title: string;
  start: number;
  dur: number;
  allDay?: boolean;
  loc?: string;
  rule?: string;
  zone?: string;
  ex?: number[];
}

export function parseIcs(ics: string, tz: string): Series[] {
  const lines = unfold(ics);
  const overrides = new Map<string, number[]>();
  const events: Prop[][] = [];
  let cur: Prop[] | null = null;
  for (const line of lines) {
    if (events.length >= 6000) break; // enough for any personal calendar
    if (/^BEGIN:VEVENT/i.test(line)) cur = [];
    else if (/^END:VEVENT/i.test(line)) {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const p = parseProp(line);
      if (p) cur.push(p);
    }
  }
  // Instances that were moved or cancelled individually replace their slot in the series.
  for (const ev of events) {
    const rid = ev.find((p) => p.name === 'RECURRENCE-ID');
    const uid = ev.find((p) => p.name === 'UID')?.value ?? '';
    if (rid) {
      const t = icsTime(rid.value, rid.params, tz);
      if (t) {
        const list = overrides.get(uid);
        if (list) {
          if (list.length < 500) list.push(t.t);
        } else overrides.set(uid, [t.t]);
      }
    }
  }
  const out: Series[] = [];
  for (const ev of events) {
    const get = (n: string) => ev.find((p) => p.name === n);
    if (/CANCELLED/i.test(get('STATUS')?.value ?? '')) continue;
    const ds = get('DTSTART');
    if (!ds) continue;
    const st = icsTime(ds.value, ds.params, tz);
    if (!st) continue;
    const de = get('DTEND');
    const en = de ? icsTime(de.value, de.params, tz) : null;
    const dur = en ? Math.max(0, en.t - st.t) : get('DURATION') ? Math.max(0, parseDuration(get('DURATION')!.value)) : st.allDay ? 86400_000 : 0;
    const uid = get('UID')?.value ?? `${st.t}`;
    const s: Series = { uid: uid.slice(0, 120), title: unescapeText(get('SUMMARY')?.value ?? 'Busy').slice(0, 160), start: st.t, dur };
    if (st.allDay) s.allDay = true;
    const loc = get('LOCATION');
    if (loc?.value) s.loc = unescapeText(loc.value).slice(0, 160);
    const rule = get('RRULE');
    if (rule && !get('RECURRENCE-ID')) {
      s.rule = rule.value;
      s.zone = st.allDay ? tz : ds.params.TZID && safeTz(ds.params.TZID) !== 'UTC' ? ds.params.TZID : windowsZone(ds.params.TZID) ?? (/Z$/.test(ds.value) ? 'UTC' : tz);
      const ex = [...(overrides.get(uid) ?? [])];
      for (const p of ev.filter((x) => x.name === 'EXDATE')) {
        for (const v of p.value.split(',').slice(0, 500)) {
          const t = icsTime(v, p.params, tz);
          if (t) ex.push(t.t);
        }
      }
      if (ex.length) s.ex = ex;
    }
    out.push(s);
  }
  return out;
}

/** Latest time a repeating series can still produce an event (Infinity if open-ended). */
export function ruleEnd(s: Series): number {
  const r = Object.fromEntries((s.rule ?? '').split(';').map((p) => p.split('=') as [string, string]).map(([k, v]) => [k?.toUpperCase(), v]));
  let end = Infinity;
  if (r.UNTIL) end = Math.min(end, icsTime(r.UNTIL, {}, s.zone ?? 'UTC')?.t ?? Infinity);
  if (r.COUNT) {
    const per = ({ DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366 } as Record<string, number>)[r.FREQ ?? ''] ?? 366;
    end = Math.min(end, s.start + (parseInt(r.COUNT, 10) || 0) * per * Math.max(1, parseInt(r.INTERVAL ?? '1', 10) || 1) * 86400_000 + s.dur);
  }
  return end;
}

export function expandSeries(series: Series[], from: number, to: number, source: string): AgendaEvent[] {
  const out: AgendaEvent[] = [];
  for (const s of series) {
    if (out.length >= 800) break;
    const starts = s.rule ? expandRule(s.start, s.rule, s.zone ?? 'UTC', from, to, new Set(s.ex ?? []), s.dur) : s.start + Math.max(s.dur, 1) > from && s.start < to ? [s.start] : [];
    for (const t of starts) {
      const e: AgendaEvent = { id: `${source}:${s.uid}:${t}`.slice(0, 200), title: s.title, start: t, source };
      if (s.dur) e.end = t + s.dur;
      if (s.allDay) e.allDay = true;
      if (s.loc) e.location = s.loc;
      out.push(e);
    }
  }
  return out;
}

export function expandIcs(ics: string, from: number, to: number, tz: string, source: string): AgendaEvent[] {
  return expandSeries(parseIcs(ics, tz), from, to, source);
}
