/**
 * THE BRAIN'S HEALTH (BRIEF-RELIABILITY): what the phone needs to put a mark on every ability and to tell him how the brain is.
 *
 *   GET  /guardian/health   → BrainHealth: per tool group the last success and the last failure (the time and the KIND of the
 *                             error, never its text), from the trail the agent already writes (why.ts, read here, not changed);
 *                             the keys by NAME with whether the brain has them (a value never leaves the vault and is never in
 *                             this answer); each feed's last good read; each kind of job with its last run; the GPU job's quota;
 *                             how many "that felt off" moments this week
 *   POST /guardian/feltoff  {screen, did, text, marks, hour, words?, reply?} → the moment kept (the last 300)
 *   GET  /guardian/feltoff  → FeltList (the moments newest first, the week's count, the screen with the most)
 *
 * A moment holds words only: the screen, what he had just done, the visible text trimmed to 600 characters, the marks, the hour and
 * one line of his own. It is built from an allow-list, so a picture, a face or the camera cannot be kept by any field.
 * Mounted by guardian.ts (`/guardian/health`, `/guardian/feltoff`).
 */
import { FELT_MAX, FELT_TEXT, MARKS, failKind, groupsFromTrails, type BrainHealth, type FeedHealth, type FeltList, type FeltMoment, type JobHealth, type Mark } from '../../../packages/shared/src/health';
import { GROUP_NEEDS } from './abilities';
import { keyDefs } from './keys';
import { loadWatch } from './guardstate';
import { loadJobs } from './schedule';
import { loadTrails } from './why';
import { TOOL_GROUPS } from './tools';
import { FEED_NAMES, type FeedId } from '../../../packages/shared/src/guardian';

export const FELT_KEY = 'feltoff:list';
const WEEK = 7 * 86_400_000;

export interface HealthDeps {
  storage: DurableObjectStorage;
  vault: { get(name: string): Promise<string | null> };
  env?: { GITHUB_REPO?: string };
  now?: () => number;
}
const nowOf = (d: Pick<HealthDeps, 'now'>) => (d.now ? d.now() : Date.now());
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// ---------------------------------------------------------------- felt off

const clean = (s: unknown, n: number): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** A moment from what the phone sent: only the words it is allowed to hold (an allow-list, never a pass-through). */
export function momentOf(raw: unknown, now = Date.now()): FeltMoment | null {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const screen = clean(b.screen, 40);
  if (!screen) return null;
  const marks: Record<string, Mark> = {};
  if (b.marks && typeof b.marks === 'object') {
    for (const [k, v] of Object.entries(b.marks as Record<string, unknown>).slice(0, 200)) if (MARKS.includes(v as Mark)) marks[clean(k, 60)] = v as Mark;
  }
  const hour = Number(b.hour);
  const words = clean(b.words, 300);
  const reply = clean(b.reply, 120);
  return {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    screen,
    did: (Array.isArray(b.did) ? b.did : []).map((x) => clean(x, 120)).filter(Boolean).slice(0, 3),
    text: clean(b.text, FELT_TEXT),
    marks,
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : new Date(now).getUTCHours(),
    ...(words ? { words } : {}),
    ...(reply ? { reply } : {}),
  };
}

export async function loadFelt(storage: DurableObjectStorage): Promise<FeltMoment[]> {
  const v = await storage.get<FeltMoment[]>(FELT_KEY);
  return Array.isArray(v) ? v : [];
}

/** Keep a moment (the last 300). */
export async function addFelt(storage: DurableObjectStorage, raw: unknown, now = Date.now()): Promise<FeltMoment | null> {
  const m = momentOf(raw, now);
  if (!m) return null;
  const list = await loadFelt(storage);
  list.push(m);
  await storage.put(FELT_KEY, list.slice(-FELT_MAX));
  return m;
}

/** The moments newest first, this week's count and the screen with the most this week (for the Sunday note). */
export async function feltList(storage: DurableObjectStorage, now = Date.now()): Promise<FeltList> {
  const all = await loadFelt(storage);
  const week = all.filter((m) => now - m.at <= WEEK);
  const by = new Map<string, number>();
  for (const m of week) by.set(m.screen, (by.get(m.screen) ?? 0) + 1);
  const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
  return { moments: [...all].reverse(), week: week.length, ...(top ? { top: { screen: top[0], n: top[1] } } : {}) };
}

/** The Sunday note's line: "7 moments felt off this week; the most on the Agenda." ('' when none). */
export function feltLine(l: Pick<FeltList, 'week' | 'top'>, nameOf: (screen: string) => string = (s) => s): string {
  if (!l.week) return '';
  return `${l.week} moment${l.week === 1 ? '' : 's'} felt off this week${l.top ? `; the most on ${nameOf(l.top.screen)}` : ''}.`;
}

// ---------------------------------------------------------------- the brain's health

/** The group a tool belongs to (the first group that has it). */
function groupOfTool(): (tool: string) => string | undefined {
  const m = new Map<string, string>();
  for (const g of TOOL_GROUPS) for (const t of g.tools) if (!m.has(t.name)) m.set(t.name, g.name);
  return (t) => m.get(t);
}

const FEED_ORDER: FeedId[] = ['flood', 'weather', 'crime'];

export async function buildHealth(d: HealthDeps, now = nowOf(d)): Promise<BrainHealth> {
  const [trails, watch, jobs, felt] = await Promise.all([
    loadTrails(d.storage).catch(() => []),
    loadWatch(d.storage).catch(() => null),
    loadJobs(d.storage).catch(() => []),
    feltList(d.storage, now).catch(() => ({ moments: [], week: 0 }) as FeltList),
  ]);
  // keys by name only: the vault's value is turned into a yes or a no at once and goes no further
  const defs = keyDefs(d.env?.GITHUB_REPO);
  const names = [...new Set([...defs.map((k) => k.name), ...Object.values(GROUP_NEEDS).flatMap((n) => n.any)])];
  const has = await Promise.all(names.map((n) => d.vault.get(n).then((v) => !!v, () => false)));
  const held = new Map(names.map((n, i) => [n, has[i]!]));
  const labelOf = new Map(defs.map((k) => [k.name, k.label]));
  const feeds: FeedHealth[] = FEED_ORDER.map((id) => ({
    id,
    name: FEED_NAMES[id].name,
    at: watch?.checked?.[id] ?? 0,
    ...(watch?.failed?.[id] ? { failed: failKind(watch.failed[id]) } : {}),
  }));
  // each kind of job once: the one that ran last
  const byKind = new Map<string, JobHealth>();
  for (const j of jobs) {
    const failed = !!j.lastResult && /^(?:error|failed|could not|couldn.t)|\bfailed\b|\berror:/i.test(j.lastResult);
    const row: JobHealth = { kind: j.kind, title: j.title, ...(j.lastRun ? { lastRun: j.lastRun } : {}), ...(j.lastRun ? { ok: !failed } : {}), ...(failed ? { kindOf: failKind(j.lastResult) } : {}), next: j.next };
    const was = byKind.get(j.kind);
    if (!was || (row.lastRun ?? 0) > (was.lastRun ?? 0)) byKind.set(j.kind, row);
  }
  let gpu: BrainHealth['gpu'];
  try {
    const st = await d.storage.get<{ gpu?: { left: number; total: number }; pushedAt?: number; phase?: string }>('train:state');
    if (st?.gpu) gpu = { left: st.gpu.left, total: st.gpu.total, ...(st.pushedAt ? { at: st.pushedAt } : {}), ...(st.phase ? { phase: String(st.phase) } : {}) };
  } catch {
    /* no training state: no GPU line */
  }
  return {
    at: now,
    groups: groupsFromTrails(trails, groupOfTool()),
    keys: names.map((n) => ({ name: n, label: labelOf.get(n) ?? n, set: held.get(n) === true })),
    feeds,
    jobs: [...byKind.values()].sort((a, b) => (a.next ?? 0) - (b.next ?? 0)),
    ...(gpu ? { gpu } : {}),
    felt: { week: felt.week, total: felt.moments.length, ...(felt.top ? { top: felt.top.screen } : {}) },
  };
}

export async function healthRoute(req: Request, path: string, method: string, d: HealthDeps): Promise<Response> {
  if (path === '/guardian/health' && method === 'GET') return json(await buildHealth(d));
  if (path === '/guardian/feltoff' && method === 'POST') {
    const m = await addFelt(d.storage, await req.json().catch(() => null), nowOf(d));
    return m ? json({ ok: true, id: m.id }) : json({ error: 'say which screen' }, 400);
  }
  if (path === '/guardian/feltoff' && method === 'GET') return json(await feltList(d.storage, nowOf(d)));
  return json({ error: 'not found' }, 404);
}
