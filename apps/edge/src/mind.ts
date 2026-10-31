/**
 * THE ONE SHARED MIND (OWNER-ISSUES 74, the keystone). Forty features each knew a slice of him; this is the one picture
 * every feature reads: who the owner is (the nightly reflection's summary and top lines, the facts he relies on, batch 2's
 * rules, principles and mood when they are stored), when and where he is (and which saved place that is), what is left
 * of today and what comes next, what he is in the middle of, what happened earlier, and the tool groups on.
 *
 * `mindSnapshot` builds it once per turn or alarm. The chat's CONTEXT block is rendered from it (prompt.ts contextLines),
 * Telegram's turn runs the same loop, the background tasks' prompts carry it, and the Brief's YOUR DAY and morning line
 * read it (GET /api/mind) — so the chat and the Brief agree about "today": they read one thing.
 *
 * `observe` is the one write path for what happened — a turn's gist, a tool's outcome, a game, a paper, a thing built —
 * into the DAY LOG (`mind:log`), which the nightly reflection consolidates (profile.ts).
 */
import type { DayLine, Episode, EpisodeKind, MindSnapshot } from '../../../packages/shared/src/mind';
import { findPlates, mentionsPlate, redactPlates } from '../../../packages/shared/src/plates';
import { SUBJECT_LABEL } from '../../../packages/shared/src/school';
import type { Vault } from './kernel/vault';
import { loadLessons } from './knowledge';
import { loadStudy } from './library/study';
import { guardianMind } from './guardstate'; // [guardian] (its light half: no Telegram, no feeds)
import { loadPlaces } from './places';
import { loadProfile, looksSecret, profileLines } from './profile';
import { baseMind, type ClientContext } from './prompt';
import { agenda, loadEvents, loadJobs, type AgendaEvent, type Job } from './schedule';
import { stageName } from './school/papers';
import { loadState as loadSchool } from './school/state';
import { spendFlag } from './spending';
import { isoLocal, safeTz, startOfDay, validTz, zoned } from './time';
import { loadMemory } from './tools/memory';

export type { DayLine, Episode, EpisodeKind, MindSnapshot };

/** The day log: what happened, newest last (the nightly reflection folds old days into the diary). */
export const LOG_KEY = 'mind:log';
/** Batch 2's stored state, read here when present (written there). */
export const MOOD_KEY = 'mood';
export const PRINCIPLES_KEY = 'principles';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** The log stays well inside a storage value's 128 KB, whatever happens. */
const LOG_MAX = 600;
const LOG_BYTES = 100_000;
/** What "ahead" covers. */
const AHEAD = 6 * HOUR;

export async function loadLog(storage: DurableObjectStorage): Promise<Episode[]> {
  const v = await storage.get<Episode[]>(LOG_KEY);
  return Array.isArray(v) ? v : [];
}

/** Keep a log within its bounds (the oldest go first). */
export function boundLog(log: Episode[]): Episode[] {
  let out = log.slice(-LOG_MAX);
  while (out.length > 1 && JSON.stringify(out).length > LOG_BYTES) out = out.slice(Math.ceil(out.length / 10));
  return out;
}

/**
 * One thing that happened, into the day log: one plain line (at most 140 characters), never a secret. Every feature
 * writes through here; nothing else writes the log but the nightly consolidation.
 */
export async function observe(storage: DurableObjectStorage, ev: { kind: EpisodeKind; text: string; via?: string; at?: number }, now = Date.now()): Promise<Episode | null> {
  let text = String(ev.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!text || looksSecret(text)) return null;
  // A number plate is never kept for later (integrations/vehicle.ts): "[plate]", as the history has it once a check runs.
  if (mentionsPlate(text)) text = redactPlates(text, findPlates(text.toUpperCase()));
  const e: Episode = { at: ev.at ?? now, kind: ev.kind, text, ...(ev.via ? { via: ev.via } : {}) };
  const log = await loadLog(storage);
  log.push(e);
  log.sort((a, b) => a.at - b.at);
  await storage.put(LOG_KEY, boundLog(log));
  return e;
}

/** A turn's gist for the day log: what he asked, in his words, cut short. */
export const turnGist = (words: string): string => {
  const w = words.replace(/\s+/g, ' ').trim();
  return w ? `asked: "${w.length > 110 ? `${w.slice(0, 109)}…` : w}"` : '';
};

const str = (a: Record<string, unknown>, k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim() : '');

/**
 * What a tool did, as a line for the day log — only the tools that change something (what he did, not what he looked
 * up), and only from his own words in the call, never from what a tool read elsewhere. '' for every other tool.
 */
export function toolEpisode(name: string, args: Record<string, unknown>): { kind: EpisodeKind; text: string } | null {
  const said = (verb: string, k: string) => (str(args, k) ? `${verb}: ${str(args, k)}` : '');
  const text =
    name === 'set_reminder'
      ? said('set a reminder', 'text')
      : name === 'add_event'
        ? said('put in the diary', 'title')
        : name === 'remember'
          ? said('remembered', 'text')
          : name === 'schedule_task'
            ? said('scheduled a task', 'text')
            : name === 'set_budget'
              ? said('set a budget', 'words')
              : name === 'build_app'
                ? str(args, 'title') ? `built an app: ${str(args, 'title')}` : 'built an app'
                : name === 'publish_site'
                  ? str(args, 'title') || str(args, 'name') ? `published a website: ${str(args, 'title') || str(args, 'name')}` : 'published a website'
                  : name === 'create_widget'
                    ? said('made a widget', 'name')
                    : name === 'start_project'
                      ? said('started a project', 'title')
                      : '';
  if (!text) return null;
  return { kind: /^(built|published|made|started)/.test(text) ? 'built' : 'tool', text };
}

/**
 * The rest of a day, as the Brief shows it: diary events not yet over (all day, on now, or to come) and reminders and
 * tasks still to go off before `to`, in time order. A diary event's own reminder is the same thing twice: only the
 * event is listed. Times in his zone.
 */
export function dayLines(events: AgendaEvent[], jobs: Job[], now: number, to: number, tz: string, from = now): DayLine[] {
  const hm = (t: number) => isoLocal(t, tz).slice(11);
  const dayStart = startOfDay(from, tz);
  // (an all-day event with no end lasts its day)
  const endOf = (e: AgendaEvent) => e.end ?? (e.allDay ? startOfDay(startOfDay(e.start, tz) + 30 * HOUR, tz) : e.start);
  const evs = events
    .filter((e) => endOf(e) > from && e.start < to)
    .map((e): DayLine => {
      const allDay = !!e.allDay;
      const line: DayLine = { at: allDay ? Math.max(e.start, dayStart) : e.start, when: allDay ? 'All day' : e.start <= now ? 'Now' : hm(e.start), title: e.title, kind: 'event' };
      if (e.location) line.where = e.location;
      if (e.end || allDay) line.end = endOf(e);
      if (allDay) line.allDay = true;
      if (e.source && e.source !== 'mine') line.from = e.source;
      return line;
    });
  const own = new Set(events.map((e) => e.id));
  const rem = jobs
    .filter((j) => (j.kind === 'reminder' || j.kind === 'task') && j.next >= from && j.next < to && !(j.eventId && own.has(j.eventId)))
    .map((j): DayLine => ({ at: j.next, when: hm(j.next), title: j.title || j.text, kind: 'reminder' }));
  return [...evs, ...rem].sort((a, b) => a.at - b.at);
}

/** A line from another day, said with its weekday ("Tue 08:00", "Tue" for all day). */
function laterDay(x: DayLine, tz: string): DayLine {
  const wd = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: tz }).format(x.at);
  return { ...x, when: x.allDay ? wd : `${wd} ${isoLocal(x.at, tz).slice(11)}` };
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** A source that fails never takes the picture down: it is left out. */
const tryOr = async <T>(p: () => Promise<T>, or: T): Promise<T> => {
  try {
    return await p();
  } catch {
    return or;
  }
};

export interface MindOptions {
  /** What the client told us this turn (or what it last told us: owner:ctx). */
  client: ClientContext;
  /** The vault, for the calendar feeds' links (none: his own events only). */
  vault?: Vault;
  /** The tool groups on this turn. */
  can?: string[];
  now?: number;
  /** How long the calendar feeds may take before his own events are used alone (a turn waits little; the Brief more). */
  waitMs?: number;
}

/** The one shared mind, built once: every part from its own store, each one optional. */
export async function mindSnapshot(storage: DurableObjectStorage, o: MindOptions): Promise<MindSnapshot> {
  const now = o.now ?? Date.now();
  const stored = await tryOr(async () => (await storage.get<ClientContext>('owner:ctx')) ?? {}, {} as ClientContext);
  const client: ClientContext = { ...o.client, tz: validTz(o.client.tz) ? o.client.tz : safeTz(stored.tz), name: o.client.name || stored.name };
  if (!client.location && stored.location) client.location = stored.location;
  const m = baseMind(client, now);
  const tz = m.now.tz;
  m.can = o.can ?? [];

  // who he is
  const profile = await tryOr(() => loadProfile(storage), null);
  if (profile) {
    m.owner.summary = profile.summary;
    m.owner.lines = profileLines({ ...profile, summary: '' }, 6);
  }
  const facts = await tryOr(() => loadMemory(storage), []);
  m.owner.facts = [...facts].sort((a, b) => b.at - a.at).slice(0, 8).map((f) => f.text);
  // batch 2's state, when it is there (feature-detected: never written here)
  const lessons = await tryOr(() => loadLessons(storage), []);
  m.owner.rules = lessons.filter((l) => (l as { kind?: unknown }).kind === 'conduct').slice(-6).map((l) => l.text);
  const principles = await tryOr(() => storage.get<unknown>(PRINCIPLES_KEY), undefined);
  const plines = Array.isArray(principles) ? principles : principles && typeof principles === 'object' && Array.isArray((principles as { lines?: unknown }).lines) ? (principles as { lines: unknown[] }).lines : [];
  m.owner.principles = plines.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 6);
  const mood = await tryOr(() => storage.get<{ kind?: unknown; until?: unknown; cause?: unknown }>(MOOD_KEY), undefined);
  if (mood && typeof mood.kind === 'string' && mood.kind && !(typeof mood.until === 'number' && mood.until <= now)) m.owner.mood = typeof mood.cause === 'string' && mood.cause ? `${mood.kind} (${mood.cause})` : mood.kind;

  // where he is: which saved place that is
  const loc = client.location;
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
    const near = (await tryOr(() => loadPlaces(storage), [])).map((p) => ({ p, d: km(loc, p) })).filter((x) => x.d <= 0.3).sort((a, b) => a.d - b.d)[0];
    if (near) m.now.place = near.p.label;
  }

  // his day: what is left of today, what comes next, the next six hours
  const start = startOfDay(now, tz);
  const end = startOfDay(start + 30 * HOUR, tz);
  const after = startOfDay(end + 30 * HOUR, tz);
  const mine = async () => ({ events: (await loadEvents(storage)).filter((e) => (e.end ?? e.start + 1) > start && e.start < after) });
  const feeds = o.vault ? Promise.race([agenda(storage, o.vault, start, after, tz), new Promise<null>((ok) => setTimeout(() => ok(null), o.waitMs ?? 1500))]).catch(() => null) : Promise.resolve(null);
  const events = ((await feeds) ?? (await tryOr(mine, { events: [] }))).events;
  const jobs = await tryOr(() => loadJobs(storage), []);
  m.today.items = dayLines(events, jobs, now, end, tz);
  if (!m.today.items.length) {
    const next = events.filter((e) => e.start >= end).sort((a, b) => a.start - b.start)[0];
    if (next) m.today.next = laterDay(dayLines([next], [], now, after, tz, end)[0]!, tz);
  }
  // (past midnight within the six hours: tomorrow's first things too, only those that start after it)
  const tomorrow = now + AHEAD > end ? dayLines(events, jobs, now, Math.min(after, now + AHEAD), tz, end).filter((x) => x.at >= end) : [];
  m.ahead = [...m.today.items.filter((x) => x.at < now + AHEAD), ...tomorrow.map((x) => laterDay(x, tz))];

  // what he is in the middle of
  const school = await tryOr(() => loadSchool({ storage }), null);
  const open = school?.open?.[0];
  if (open) m.today.doing.push(`your offline brain is sitting ${stageName(open.stage)} ${(SUBJECT_LABEL[open.subject] ?? open.subject).toLowerCase()}`);
  const study = await tryOr(() => loadStudy(storage), null);
  if (study && study.day === new Date(now).toISOString().slice(0, 10) && study.today.reads > 0) m.today.doing.push(`your library read ${study.today.reads} topic${study.today.reads === 1 ? '' : 's'} today`);
  const z = zoned(now, tz);
  const spend = await tryOr(() => spendFlag(storage, `${z.y}-${String(z.m).padStart(2, '0')}`), '');
  if (spend) m.today.doing.push(spend);
  // [guardian] what is active near his places and a walk home under way (guardstate.ts): in what he is doing, and the walk's
  // "Home?" (or a warning that starts later) in what is ahead
  const guard = await tryOr(() => guardianMind(storage, now, tz), { doing: [] as string[], ahead: [] as DayLine[] });
  m.today.doing.push(...guard.doing);
  if (guard.ahead.length) m.ahead = [...m.ahead, ...guard.ahead.filter((x) => x.at < now + AHEAD)].sort((a, b) => a.at - b.at);

  // what happened: the day log's last day
  m.recent = (await tryOr(() => loadLog(storage), [])).filter((e) => e.at > now - DAY && e.at <= now).slice(-8);
  return m;
}
