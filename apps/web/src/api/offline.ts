/**
 * Ghosty's memory and agenda on this device, for when the brain's database is paused
 * (Cloudflare's free daily allowance used up, until midnight UTC):
 *  - a copy of the latest memory facts, agenda and inbox is kept here every time they load;
 *  - changes made while paused (remember, forget, events, reminders, deletions) go in an
 *    outbox, show at once, and are sent to the brain in order as soon as it answers again;
 *  - reminders set while paused also go off from this device (while Ghosty is open).
 * brain.ts routes the memory/agenda calls through here (withMirror / queueOr).
 */
import type { AgendaEventInfo, ChatTurn, FeedInfo, InboxEntry, JobInfo, MemoryFact } from '../../../../packages/shared/src/protocol';
import { createStore } from '../core/store';

export type AgendaData = { tz: string; events: AgendaEventInfo[]; errors: string[]; jobs: JobInfo[]; feeds: FeedInfo[] };
export type NewEvent = { title: string; start: number; end?: number; allDay?: boolean; location?: string; remindMin?: number | null };
export type NewJob = { kind: 'reminder' | 'task'; title?: string; text: string; at: number; repeat: JobInfo['repeat'] };

export type Op =
  | { id: string; at: number; kind: 'addMemory'; text: string }
  | { id: string; at: number; kind: 'forget'; factId: string }
  | { id: string; at: number; kind: 'addEvent'; event: NewEvent; fired?: boolean }
  | { id: string; at: number; kind: 'deleteEvent'; eventId: string }
  | { id: string; at: number; kind: 'addJob'; job: NewJob; fired?: boolean }
  | { id: string; at: number; kind: 'deleteJob'; jobId: string }
  | { id: string; at: number; kind: 'addTurns'; turns: ChatTurn[] };
type OpInput = Op extends infer O ? (O extends Op ? Omit<O, 'id' | 'at'> : never) : never;

export const offline = createStore(
  { memory: null as MemoryFact[] | null, agenda: null as AgendaData | null, inbox: null as { items: InboxEntry[]; unread: number } | null, outbox: [] as Op[] },
  { persist: 'ghosty.offline' },
);

const LOCAL = 'local-';
const newId = () => `${LOCAL}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------------------------------------------------------------------------------------
// Reading: the brain's answer (or the copy here), with changes not yet sent laid on top.
// ---------------------------------------------------------------------------------------

export function factsWithOutbox(facts: MemoryFact[]): MemoryFact[] {
  let out = [...facts];
  for (const op of offline.get().outbox) {
    if (op.kind === 'addMemory' && !out.some((f) => f.text.toLowerCase() === op.text.toLowerCase())) out.push({ id: op.id, text: op.text, at: op.at });
    if (op.kind === 'forget') out = out.filter((f) => f.id !== op.factId);
  }
  return out;
}

export function agendaWithOutbox(a: AgendaData): AgendaData {
  let events = [...a.events];
  let jobs = [...a.jobs];
  for (const op of offline.get().outbox) {
    if (op.kind === 'addEvent') events.push({ id: op.id, title: op.event.title, start: op.event.start, end: op.event.end, allDay: op.event.allDay, location: op.event.location, source: 'this device (not saved yet)' });
    if (op.kind === 'deleteEvent') events = events.filter((e) => e.id !== op.eventId);
    if (op.kind === 'addJob') jobs.push({ id: op.id, kind: op.job.kind, title: op.job.title ?? op.job.text.slice(0, 120), text: op.job.text, next: op.job.at, repeat: op.job.repeat, tz: a.tz });
    if (op.kind === 'deleteJob') jobs = jobs.filter((j) => j.id !== op.jobId);
  }
  return { ...a, events: events.sort((x, y) => x.start - y.start), jobs: jobs.sort((x, y) => x.next - y.next) };
}

// ---------------------------------------------------------------------------------------
// Writing while paused
// ---------------------------------------------------------------------------------------

/** Queue a change (deleting something that only exists here just drops it from the queue). */
export function enqueue(input: OpInput): Op {
  const del = input.kind === 'forget' ? input.factId : input.kind === 'deleteEvent' ? input.eventId : input.kind === 'deleteJob' ? input.jobId : null;
  if (del?.startsWith(LOCAL)) {
    offline.set((s) => ({ outbox: s.outbox.filter((o) => o.id !== del) }));
    timers.get(del) && clearTimeout(timers.get(del));
    return { ...(input as Op), id: del, at: Date.now() };
  }
  const op = { ...input, id: newId(), at: Date.now() } as Op;
  offline.set((s) => ({ outbox: [...s.outbox, op] }));
  armLocalReminder(op);
  return op;
}

// ---------------------------------------------------------------------------------------
// Reminders set while paused go off from this device (the brain can't run its alarm)
// ---------------------------------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let ring: ((title: string, text: string) => void) | null = null;
/** How a local reminder is shown (set by the interface: toast + notification + voice). */
export function onLocalReminder(fn: (title: string, text: string) => void): void {
  ring = fn;
  for (const op of offline.get().outbox) armLocalReminder(op);
}
function alarmOf(op: Op): { at: number; title: string; text: string; stale: number } | null {
  if (op.kind === 'addJob' && op.job.kind === 'reminder') return { at: op.job.at, title: op.job.title ?? 'Reminder', text: op.job.text, stale: Infinity };
  if (op.kind === 'addEvent' && op.event.remindMin != null) {
    const start = op.event.allDay ? op.event.start + 9 * 3600_000 : op.event.start;
    // An event reminder is only worth ringing late until the event is well under way.
    return { at: start - op.event.remindMin * 60_000, title: op.event.title, text: op.event.title, stale: start + 3600_000 };
  }
  return null;
}
/** Ring it once and note that it rang (so it isn't set again in the brain). */
function fire(id: string, title: string, text: string, late: boolean): void {
  timers.delete(id);
  offline.set((s) => ({ outbox: s.outbox.map((o) => (o.id === id && (o.kind === 'addJob' || o.kind === 'addEvent') ? { ...o, fired: true } : o)) }));
  if (!late) ring?.(title, text);
}
function armLocalReminder(op: Op): void {
  const a = alarmOf(op);
  if (!a || !ring || timers.has(op.id) || ('fired' in op && op.fired)) return;
  const wait = a.at - Date.now();
  if (wait > 24 * 3600_000) return; // armed again on a later load or flush
  // Missed while Ghosty was closed: ring now, once (unless the moment has long gone).
  timers.set(op.id, setTimeout(() => fire(op.id, a.title, a.text, Date.now() > a.stale), Math.max(0, wait)));
}

/**
 * While the brain's database is paused its own alarm can't run, so the reminders it holds (in the
 * agenda copy here) ring from this device instead. A one-off reminder that rang here is then
 * removed from the brain's agenda (queued), so it doesn't ring again when the brain is back.
 */
export function armBrainReminders(on: boolean): void {
  for (const [k, t] of timers) {
    if (!k.startsWith('brain:')) continue;
    clearTimeout(t);
    timers.delete(k);
  }
  if (!on || !ring) return;
  for (const j of offline.get().agenda?.jobs ?? []) {
    if (j.kind !== 'reminder' || j.id.startsWith(LOCAL)) continue;
    const key = `brain:${j.id}`;
    const wait = j.next - Date.now();
    if (wait < -60_000 || wait > 24 * 3600_000) continue; // due before the pause: the brain sends it when it's back
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        ring?.(j.title || 'Reminder', j.text);
        if (j.repeat === 'none') enqueue({ kind: 'deleteJob', jobId: j.id });
      }, Math.max(0, wait)),
    );
  }
}

// ---------------------------------------------------------------------------------------
// Sending the queue once the brain answers again
// ---------------------------------------------------------------------------------------

export interface OutboxApi {
  addMemory(text: string): Promise<unknown>;
  forget(id: string): Promise<unknown>;
  addEvent(e: NewEvent): Promise<unknown>;
  deleteEvent(id: string): Promise<unknown>;
  addJob(j: NewJob): Promise<unknown>;
  deleteJob(id: string): Promise<unknown>;
  addTurns(turns: ChatTurn[]): Promise<unknown>;
}

let flushing = false;
/**
 * Send queued changes in order. Stops at the first one the brain can't take yet (still
 * paused); a change the brain refuses outright is dropped so it can't block the rest.
 * Returns how many were sent.
 */
export async function flushOutbox(api: OutboxApi, keepForLater: (e: unknown) => boolean): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const op of [...offline.get().outbox]) {
      try {
        if (op.kind === 'addMemory') await api.addMemory(op.text);
        else if (op.kind === 'forget') await api.forget(op.factId);
        else if (op.kind === 'addEvent') await api.addEvent(op.event);
        else if (op.kind === 'deleteEvent') await api.deleteEvent(op.eventId);
        else if (op.kind === 'addJob') {
          // A one-off reminder that already rang here doesn't need setting again (read now: it may have rung during this flush).
          const live = offline.get().outbox.find((o) => o.id === op.id);
          const rang = !!(live && 'fired' in live && live.fired);
          if (!(op.job.kind === 'reminder' && op.job.repeat === 'none' && rang)) await api.addJob(op.job);
        } else if (op.kind === 'deleteJob') await api.deleteJob(op.jobId);
        else if (op.kind === 'addTurns') await api.addTurns(op.turns);
        sent++;
      } catch (e) {
        if (keepForLater(e)) break; // paused, offline, signed out or a server error: try again later
        // refused outright (e.g. already deleted): drop it
      }
      offline.set((s) => ({ outbox: s.outbox.filter((o) => o.id !== op.id) }));
      const t = timers.get(op.id);
      if (t) {
        clearTimeout(t);
        timers.delete(op.id);
      }
    }
  } finally {
    flushing = false;
  }
  for (const op of offline.get().outbox) armLocalReminder(op);
  return sent;
}

/** What the brain gets with each chat message, so it still knows the owner while paused. */
export function offlineContext(): { facts: string[]; agenda: string[] } {
  const { memory, agenda } = offline.get();
  const facts = factsWithOutbox(memory ?? []).map((f) => f.text).slice(-80);
  const a = agenda ? agendaWithOutbox(agenda) : null;
  const soon = Date.now() + 14 * 86400_000;
  const items = a
    ? [
        ...a.events.filter((e) => e.start < soon && (e.end ?? e.start) > Date.now() - 3600_000).map((e) => `event "${e.title}" ${new Date(e.start).toISOString()}${e.location ? ` at ${e.location}` : ''}`),
        ...a.jobs.filter((j) => j.kind === 'reminder' && j.next < soon).map((j) => `reminder "${j.text}" ${new Date(j.next).toISOString()}${j.repeat !== 'none' ? ` (${j.repeat})` : ''}`),
      ].slice(0, 40)
    : [];
  return { facts, agenda: items };
}
