/**
 * Client for Ghosty's brain (apps/edge), reached through /api on the same site.
 * Authentication: Cloudflare Access cookies go along automatically; if Access is not set
 * up, the owner key saved on this device is sent as `x-ghosty-key`.
 */
import { createStore } from '../core/store';
import { agendaWithOutbox, armBrainReminders, enqueue, factsWithOutbox, flushOutbox, offline, offlineContext } from './offline';
import { keepForever, mirrorLibrary, passagesFor, pendingDocs, removeDoc, removedHere, searchLocal, shelf, syncLocalDocs } from '../library/local';
import type { AgendaEventInfo, BrainStatus, ChangeSummary, ChatEvent, ChatTurn, EmailStatus, FeedInfo, InboxEntry, JobInfo, Lesson, LibraryDoc, LibraryHit, MemoryFact, PublishedSite, Roadmap, SpotifyStatus, VersionSummary, Widget } from '../../../../packages/shared/src/protocol';

/** Ghosty's self-study (library/study.ts in the brain): its state, and a summary for the Library tab. */
export interface StudySummary {
  topics: number;
  read: number;
  digested: number;
  domains: { id: string; name: string; topics: number; read: number; digested: number; focus: boolean }[];
  today: { reads: number; digests: number; drills: number; ai: number };
  drills: { asked: number; right: number; skills: { skill: string; n: number; right: number }[] };
  pending: number;
}
export interface StudyInfo {
  on: boolean;
  i: number;
  gaps: string[];
  sessions: number;
  last?: { at: number; topic: string; title?: string; passages?: number; error?: string; kind?: 'read' | 'digest' | 'drill' };
  next?: number | null;
  topics?: number;
  focus: string[];
  summary: StudySummary;
  /** After STUDY NOW: what that session did. */
  did?: { reads: number; digests: number; drills: number };
}
/** One export of the library to the `library` branch of Ghosty's repository (library/export.ts). */
export interface ExportInfo {
  branch: string;
  files: number;
  passages: number;
  left: number;
  url: string;
}

/** This device's time zone; the brain uses it for reminders and the agenda. */
export interface ReverseJobInfo {
  id: string;
  target: string;
  kind: string;
  question: string;
  at: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  runUrl?: string;
  error?: string;
  finishedAt?: number;
  reportChars?: number;
}

export const TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

const KEY_STORE = 'ghosty.ownerKey';

export const ownerKey = {
  get(): string {
    try {
      return localStorage.getItem(KEY_STORE) ?? '';
    } catch {
      return '';
    }
  },
  set(v: string) {
    try {
      if (v) localStorage.setItem(KEY_STORE, v);
      else localStorage.removeItem(KEY_STORE);
    } catch {
      /* ignore */
    }
  },
};

export class AuthError extends Error {}

/**
 * This device's encrypted copy of the owner's keys (sealed by the brain with the owner key).
 * It goes with every request, and the brain uses it whenever its database can't be read, so a
 * key given once keeps working, paused or not. Refreshed at start-up and after keys change.
 */
export const keyCopy = createStore({ sealed: '' }, { persist: 'ghosty.vault.copy' });

/** Every brain request carries `x-ghosty: 1`; the brain refuses state changes without it (blocks cross-site forgery). */
export function headers(extra: Record<string, string> = {}): Record<string, string> {
  const k = ownerKey.get();
  const sealed = k ? keyCopy.get().sealed : '';
  return { 'x-ghosty': '1', ...(k ? { 'x-ghosty-key': k } : {}), ...(sealed ? { 'x-ghosty-vault': sealed } : {}), ...extra };
}

/**
 * The last answer to each read, kept on this device: while the brain's database is paused (or
 * the network is down) every tab shows what it last knew instead of going blank. Not used for
 * searches, the conversation history (kept by assistant/session.ts) or the key copy.
 */
const READ_CACHE = 'ghosty.read:';
const cacheable = (path: string) => !/search|\/vault\/|^\/history|^\/status|^\/ships|^\/stt|^\/library$|\/passages/.test(path);
function remember(path: string, j: unknown): void {
  // "Not known right now" (database paused, no copy of a key reachable) must not replace the last good answer.
  if (j && typeof j === 'object' && (j as { unknown?: boolean }).unknown) return;
  try {
    const text = JSON.stringify(j);
    if (text.length < 300_000) localStorage.setItem(READ_CACHE + path, text);
  } catch {
    /* storage full or blocked */
  }
}
function recall<T>(path: string): T | undefined {
  try {
    const t = localStorage.getItem(READ_CACHE + path);
    return t ? (JSON.parse(t) as T) : undefined;
  } catch {
    return undefined;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (method !== 'GET' || !cacheable(path)) return send<T>(method, path, body);
  try {
    const j = await send<T>(method, path, body);
    remember(path, j);
    return j;
  } catch (e) {
    const kept = unreachable(e) ? recall<T>(path) : undefined;
    if (kept !== undefined) return kept;
    throw e;
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const text = await r.text();
  let j: unknown = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (r.status === 401 || r.status === 503) throw new AuthError((j as { error?: string })?.error ?? 'not authorised');
  const err = (j as { error?: string })?.error;
  if (!r.ok && err && PAUSED_TEXT.test(err)) {
    memoryPaused.set({ on: true, since: memoryPaused.get().since || Date.now() });
    throw new PausedError();
  }
  if (!r.ok) throw Object.assign(new Error(err ?? `HTTP ${r.status}`), { status: r.status });
  return j as T;
}

/**
 * The brain's database is paused (Cloudflare's free daily allowance used up, until midnight UTC).
 * Shown once as a small MEMORY PAUSED tag in the top bar — never as a pop-up per tab.
 */
const PAUSED_TEXT = /free daily allowance|database is paused/i;
export const memoryPaused = createStore({ on: false, since: 0 });
/** Midnight UTC after `t` — when Cloudflare's free daily allowance resets. */
export const pauseEndsAt = (t: number) => Math.floor(t / 86_400_000) * 86_400_000 + 86_400_000;
// The pause ends at midnight UTC: clear the tag then (and re-check with the brain), instead of
// leaving a stale "paused" badge on a phone that was never reloaded.
if (typeof document !== 'undefined') {
  setInterval(() => {
    const m = memoryPaused.get();
    if (m.on && Date.now() >= pauseEndsAt(m.since)) memoryPaused.set({ on: false, since: 0 });
  }, 30_000);
}
/** When the pause ends, in the owner's local time (midnight UTC). */
export const pauseEndsText = () => new Date(pauseEndsAt(memoryPaused.get().since || Date.now())).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export class PausedError extends Error {
  readonly paused = true;
  constructor() {
    super(`memory paused until ${pauseEndsText()}`);
  }
}
export const isPaused = (e: unknown) => !!(e as { paused?: boolean })?.paused;

/** Stream newline-delimited ChatEvents from a POST (the chat, approvals, and the Lens's question with a picture — vision/ask.ts). */
export async function streamEvents(path: string, body: unknown, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const r = await fetch(`/api${path}`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body), signal });
  if (r.status === 401 || r.status === 503) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new AuthError(j.error ?? 'not authorised');
  }
  if (!r.ok || !r.body) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${r.status}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as ChatEvent);
        } catch {
          /* skip bad line */
        }
      }
    }
  }
}

export const brain = {
  health: () => fetch('/api/health').then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; secured: boolean; access: boolean; preview?: boolean }>) : null)).catch(() => null),
  status: () =>
    req<BrainStatus>('GET', '/status').then((s) => {
      memoryPaused.set({ on: !!s.paused, since: s.paused ? memoryPaused.get().since || Date.now() : 0 });
      return s;
    }),
  /** Keys that are public by design (a Mapbox "pk." token goes in the map's tile addresses); nothing else ever comes this way. */
  publicKeys: () => req<{ mapbox?: string }>('GET', '/keys/public').catch(() => ({}) as { mapbox?: string }),
  /** `recent`: the last turns on screen, so Ghosty can follow the conversation even while its database is paused. */
  chat: (message: string, context: Record<string, unknown>, onEvent: (e: ChatEvent) => void, signal?: AbortSignal, recent?: { role: 'user' | 'assistant'; text: string }[]) =>
    // `offline`: memory, agenda and the owner's documents most related to the message, kept on this
    // device, so Ghosty still knows them if its database is paused.
    passagesFor(message)
      .catch(() => [])
      .then((library) => streamEvents('/chat', { message, context, recent, offline: { ...offlineContext(), library } }, onEvent, signal)),
  approve: (id: string, allow: boolean, onEvent: (e: ChatEvent) => void) => streamEvents('/approve', { id, allow }, onEvent),
  stop: () => req<{ ok: boolean }>('POST', '/stop'),
  history: () => req<{ turns: ChatTurn[]; pending: { id: string; name: string; args: Record<string, unknown> } | null }>('GET', '/history'),
  clearHistory: () => req('DELETE', '/history'),
  addTurns: (turns: ChatTurn[]) => req<{ added: number }>('POST', '/history', { turns }),
  memory: () => req<{ facts: MemoryFact[] }>('GET', '/memory'),
  addMemory: (text: string) => req('POST', '/memory', { text }),
  forget: (id: string) => req('DELETE', `/memory/${encodeURIComponent(id)}`),
  lessons: () => req<{ lessons: Lesson[] }>('GET', '/lessons'),
  roadmap: () => req<{ roadmap: Roadmap | null }>('GET', '/roadmap'),
  training: () => req<{ exercises: { id: string; title: string; level: number; topic: string }[]; records: Record<string, { solved: boolean; attempts: number; at: number; model?: string; firstSolve?: number }> }>('GET', '/train'),
  trainingExercise: (id: string) => req<{ id: string; title: string; level: number; topic: string; prompt: string; entry: string; tests: { args: unknown[]; expect: unknown; note?: string }[] }>('GET', `/train/exercise/${encodeURIComponent(id)}`),
  trainingAttempt: (id: string, history: { code: string; report: string }[]) => req<{ code: string; model: string }>('POST', '/train/attempt', { id, history }),
  trainingResult: (r: { id: string; solved: boolean; attempts: number; code: string; model: string; firstReport?: string }) => req<{ lesson: string }>('POST', '/train/result', r),
  library: () => req<{ docs: LibraryDoc[]; stats: { docs: number; passages: number; chars: number; bytes: number; vectors: number }; starterReady: boolean; vectors: boolean; spare?: boolean }>('GET', '/library'),
  librarySearch: (q: string, k = 8) => req<{ hits: LibraryHit[] }>('GET', `/library/search?k=${k}&q=${encodeURIComponent(q)}`),
  libraryCreate: (doc: { title: string; source: string; kind: string; pages: number }) => req<{ doc: LibraryDoc }>('POST', '/library/docs', doc),
  libraryAdd: (id: string, passages: { text: string; heading?: string; page?: number }[]) => req<{ added: number }>('POST', `/library/docs/${encodeURIComponent(id)}/passages`, { passages }),
  libraryDone: (id: string) => req<{ doc: LibraryDoc }>('POST', `/library/docs/${encodeURIComponent(id)}/done`, {}),
  studyStatus: () => req<StudyInfo>('GET', '/library/study'),
  /** `focus`: the owner's words for the domains to put first ("physics and finance"; "none" clears it). */
  study: (p: { on?: boolean; now?: boolean; focus?: string }) => req<StudyInfo>('POST', '/library/study', p),
  /** Write the next batch of Ghosty's notebooks as Markdown to the `library` branch of its repository. */
  libraryExport: (offset = 0) => req<ExportInfo>('POST', '/library/export', { offset }),
  libraryRemove: (id: string) => req('DELETE', `/library/docs/${encodeURIComponent(id)}`),
  libraryPassages: (id: string, after = 0) => req<{ passages: { rid: number; text: string; heading: string; page: number | null }[]; next: number | null }>('GET', `/library/docs/${encodeURIComponent(id)}/passages?after=${after}&limit=300`),
  libraryImport: (source: string, offset = 0) => req<{ doc: LibraryDoc; passages: number; note: string; next?: number | null }>('POST', '/library/import', { source, offset }),
  /** Ask the brain to turn a document the browser can't read into text (Workers AI, no key). */
  libraryConvert: async (file: File): Promise<string> => {
    const r = await fetch(`/api/library/convert?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: headers({ 'content-type': file.type || 'application/octet-stream' }), body: file, credentials: 'same-origin' });
    const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!r.ok || !j.text) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j.text;
  },
  clearRoadmap: () => req('DELETE', '/roadmap'),
  forgetLesson: (id: string) => req('DELETE', `/lessons/${encodeURIComponent(id)}`),
  setKey: (name: string, value: string) => req('POST', '/keys', { name, value }) as Promise<{ ok: boolean; works?: boolean; info?: string; waiting?: number }>,
  resetModels: () => req('POST', '/models/reset'),
  setOrder: (order: string[]) => req('POST', '/models/order', { order }),
  widgets: () => req<{ widgets: Widget[] }>('GET', '/widgets'),
  /** The pages Ghosty published, and the address they live at. */
  sites: () => req<{ sites: PublishedSite[]; origin: string }>('GET', '/sites'),
  unpublishSite: (name: string) => req<{ removed: boolean }>('DELETE', `/sites/${encodeURIComponent(name)}`),
  saveWidget: (w: Widget) => req<{ widget: Widget }>('POST', '/widgets', w),
  deleteWidget: (name: string) => req('DELETE', `/widgets/${encodeURIComponent(name)}`),
  changes: () => req<{ ready: boolean; changes: ChangeSummary[]; versions: VersionSummary[] }>('GET', '/changes'),
  ship: (n: number, sha: string) => req<{ result: string }>('POST', `/changes/${n}/ship`, { sha }),
  discard: (n: number) => req<{ result: string }>('POST', `/changes/${n}/discard`),
  restore: (sha: string) => req<{ result: string }>('POST', `/versions/${sha}/restore`),
  agenda: (days = 14) => req<{ tz: string; events: AgendaEventInfo[]; errors: string[]; jobs: JobInfo[]; feeds: FeedInfo[] }>('GET', `/agenda?days=${days}&tz=${encodeURIComponent(TZ)}`),
  addEvent: (e: { title: string; start: number; end?: number; allDay?: boolean; location?: string; remindMin?: number | null }) => req<{ event: AgendaEventInfo }>('POST', '/agenda/events', { ...e, tz: TZ }),
  deleteEvent: (id: string) => req('DELETE', `/agenda/events/${encodeURIComponent(id)}`),
  addJob: (j: { kind: 'reminder' | 'task'; title?: string; text: string; at: number; repeat: JobInfo['repeat'] }) => req<{ job: JobInfo }>('POST', '/jobs', { ...j, tz: TZ }),
  deleteJob: (id: string) => req('DELETE', `/jobs/${encodeURIComponent(id)}`),
  runJob: (id: string) => req<{ item: InboxEntry }>('POST', `/jobs/${encodeURIComponent(id)}/run`),
  inbox: () => req<{ items: InboxEntry[]; unread: number }>('GET', '/inbox'),
  markRead: (ids?: string[]) => req('POST', '/inbox/read', ids ? { ids } : {}),
  addFeed: (name: string, url: string) => req<{ feed: FeedInfo }>('POST', '/feeds', { name, url, tz: TZ }),
  deleteFeed: (id: string) => req('DELETE', `/feeds/${encodeURIComponent(id)}`),
  pushKey: () => req<{ key: string }>('GET', '/push/key'),
  pushSubscribe: (sub: PushSubscriptionJSON, label: string) => req<{ id: string }>('POST', '/push/subscribe', { ...sub, label }),
  pushUnsubscribe: (endpoint: string) => req('POST', '/push/unsubscribe', { endpoint }),
  pushDevices: () => req<{ devices: { id: string; label: string; at: number; endpoint: string }[] }>('GET', '/push/devices'),
  pushRemove: (id: string) => req('DELETE', `/push/devices/${encodeURIComponent(id)}`),
  pushTest: () => req<{ sent: number }>('POST', '/push/test'),
  trafficStatus: () => req<{ ready: boolean }>('GET', '/traffic/status'),
  emailStatus: () => req<EmailStatus>('GET', '/email/status'),
  spotifyStatus: () => req<SpotifyStatus>('GET', '/spotify/status'),
  spotifyLink: (p: { code: string; verifier: string; redirectUri: string; clientId: string }) => req<{ ok: boolean; name: string; product: string }>('POST', '/spotify/link', p),
  spotifyUnlink: () => req<{ ok: boolean }>('POST', '/spotify/unlink'),
  kernel: (minutes: number) => req<{ kernelUnlockedUntil: number }>('POST', '/kernel', { minutes }),
  reverseJobs: () => req<{ jobs: ReverseJobInfo[] }>('GET', '/reverse'),
  reverseStart: (p: { target: string; kind: string; question: string }) => req<{ job: ReverseJobInfo }>('POST', '/reverse', p),
  reverseJob: (id: string) => req<{ job: ReverseJobInfo & { report?: string } }>('GET', `/reverse/${encodeURIComponent(id)}`),
  async stt(audio: Blob): Promise<string> {
    const r = await fetch('/api/stt', { method: 'POST', headers: headers({ 'content-type': audio.type || 'audio/webm' }), body: audio });
    const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j.text ?? '';
  },
};

// ---------------------------------------------------------------------------------------
// Memory and agenda keep working while the brain's database is paused (or the network is
// down): reads fall back to the copy on this device, changes are queued and sent later.
// See api/offline.ts.
// ---------------------------------------------------------------------------------------

/** The brain can't be used right now, but will be: database paused, or no connection. */
export const unreachable = (e: unknown) => isPaused(e) || e instanceof TypeError;
/** A queued change is dropped only when the brain clearly refused it (a 4xx); anything else is retried. */
function keepForLater(e: unknown): boolean {
  const status = (e as { status?: unknown })?.status;
  return unreachable(e) || e instanceof AuthError || typeof status !== 'number' || status >= 500 || status === 408 || status === 429;
}

const raw = { addTurns: brain.addTurns, library: brain.library, librarySearch: brain.librarySearch, libraryRemove: brain.libraryRemove, memory: brain.memory, addMemory: brain.addMemory, forget: brain.forget, agenda: brain.agenda, addEvent: brain.addEvent, deleteEvent: brain.deleteEvent, addJob: brain.addJob, deleteJob: brain.deleteJob, inbox: brain.inbox };

brain.memory = async () => {
  try {
    const r = await raw.memory();
    offline.set({ memory: r.facts });
    return { facts: factsWithOutbox(r.facts) };
  } catch (e) {
    const kept = offline.get().memory;
    if (unreachable(e) && kept) return { facts: factsWithOutbox(kept) };
    throw e;
  }
};
brain.agenda = async (days = 14) => {
  try {
    const r = await raw.agenda(days);
    offline.set({ agenda: r });
    return agendaWithOutbox(r);
  } catch (e) {
    const kept = offline.get().agenda;
    if (unreachable(e) && kept) return agendaWithOutbox(kept);
    throw e;
  }
};
brain.inbox = async () => {
  try {
    const r = await raw.inbox();
    offline.set({ inbox: r });
    return r;
  } catch (e) {
    const kept = offline.get().inbox;
    if (unreachable(e) && kept) return kept;
    throw e;
  }
};

// The library: documents kept on this device are part of it (library/local.ts).
brain.library = async () => {
  let r: Awaited<ReturnType<typeof raw.library>>;
  try {
    r = await raw.library();
  } catch (e) {
    if (!unreachable(e)) throw e;
    // Paused or offline: the shelf from this device's copy of the library.
    const here = await shelf();
    if (!here.docs.length) throw e;
    return { ...here, starterReady: true, vectors: false };
  }
  const [mine, gone] = await Promise.all([pendingDocs(), removedHere()]);
  return { ...r, docs: [...mine, ...r.docs.filter((d) => !gone.has(d.id))] };
};

/**
 * Keep this device's copy of the whole library up to date (new and changed documents, a few
 * thousand passages at a time). Runs at start-up, every half hour, when the Library tab opens
 * and when the brain's database is back.
 */
let mirrorRun: Promise<void> | null = null;
export function mirrorLibraryNow(): Promise<void> {
  mirrorRun ??= (async () => {
    keepForever();
    try {
      for (let round = 0; round < 50; round++) {
        if (memoryPaused.get().on) break;
        const lib = await raw.library();
        // The brain says the day's database allowance is running low: copying can wait for tomorrow.
        if (lib.spare === false) break;
        const r = await mirrorLibrary({ docs: async () => lib.docs, passages: (id, after) => brain.libraryPassages(id, after) });
        if (!r.left) break;
        await new Promise((ok) => setTimeout(ok, 1500));
      }
    } catch {
      /* paused or offline: carry on next time */
    } finally {
      mirrorRun = null;
    }
  })();
  return mirrorRun;
}
brain.librarySearch = async (q, k = 8) => {
  try {
    const r = await raw.librarySearch(q, k);
    // The brain has every document it was sent; add the ones only this device has (all of them while paused).
    const local = await searchLocal(q, k, !(r as { paused?: boolean }).paused);
    return { hits: [...local, ...r.hits].sort((a, b) => b.score - a.score).slice(0, k) };
  } catch (e) {
    if (unreachable(e)) return { hits: await searchLocal(q, k) };
    throw e;
  }
};
brain.libraryRemove = async (id: string) => {
  if (isLocal(id)) return removeDoc(id);
  try {
    const r = await raw.libraryRemove(id);
    await removeDoc(id);
    return r;
  } catch (e) {
    if (!unreachable(e)) throw e;
    await removeDoc(id, true); // hidden now, removed from the brain when it's back
    return { queued: true };
  }
};

/** Try the brain; if it can't be reached, queue the change on this device instead. */
async function orQueue<T>(isLocal: boolean, call: () => Promise<T>, queue: () => T): Promise<T> {
  if (isLocal) return queue(); // only exists on this device: just change the queue
  try {
    return await call();
  } catch (e) {
    if (unreachable(e)) return queue();
    throw e;
  }
}
const isLocal = (id: string) => id.startsWith('local-');

brain.addMemory = (text: string) => orQueue(false, () => raw.addMemory(text), () => (enqueue({ kind: 'addMemory', text }), { queued: true }));
brain.forget = (id: string) => orQueue(isLocal(id), () => raw.forget(id), () => (enqueue({ kind: 'forget', factId: id }), { queued: true }));
brain.addEvent = (e) =>
  orQueue(false, () => raw.addEvent(e), () => {
    const op = enqueue({ kind: 'addEvent', event: e });
    return { event: { id: op.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, source: 'this device (not saved yet)' } };
  });
brain.deleteEvent = (id: string) => orQueue(isLocal(id), () => raw.deleteEvent(id), () => (enqueue({ kind: 'deleteEvent', eventId: id }), { queued: true }));
brain.addJob = (j) =>
  orQueue(false, () => raw.addJob(j), () => {
    const op = enqueue({ kind: 'addJob', job: j });
    return { job: { id: op.id, kind: j.kind, title: j.title ?? j.text.slice(0, 120), text: j.text, next: j.at, repeat: j.repeat, tz: TZ } };
  });
brain.deleteJob = (id: string) => orQueue(isLocal(id), () => raw.deleteJob(id), () => (enqueue({ kind: 'deleteJob', jobId: id }), { queued: true }));

/** Fetch a fresh copy of the keys (also writes keys saved while paused to the brain's database). */
export async function refreshKeyCopy(): Promise<void> {
  if (!ownerKey.get()) return; // signed in with Cloudflare Access: no owner key to seal with
  try {
    const r = await req<{ backup: string; complete: boolean }>('GET', '/vault/backup');
    // Partial (database paused, keys not in memory): keep the fuller copy we have.
    if (r.backup && (r.complete || !keyCopy.get().sealed)) keyCopy.set({ sealed: r.backup });
  } catch {
    /* try again next time */
  }
}
const rawSetKey = brain.setKey;
brain.setKey = async (name, value) => {
  const r = await rawSetKey(name, value);
  await refreshKeyCopy();
  return r;
};
const rawLink = brain.spotifyLink;
const rawUnlink = brain.spotifyUnlink;
brain.spotifyLink = async (p) => {
  const r = await rawLink(p);
  await refreshKeyCopy();
  return r;
};
brain.spotifyUnlink = async () => {
  const r = await rawUnlink();
  await refreshKeyCopy();
  return r;
};

/** Send changes queued while the brain was unreachable. Runs when memory is back and every 2 min while anything waits. */
export async function sendQueued(): Promise<number> {
  const sent = offline.get().outbox.length ? await flushOutbox(raw, keepForLater) : 0;
  const docs = await syncLocalDocs({
    upload: async (d, passages) => {
      const { doc } = await brain.libraryCreate({ title: d.title, source: d.source, kind: d.kind, pages: d.pages });
      try {
        for (let i = 0; i < passages.length; i += 30) await brain.libraryAdd(doc.id, passages.slice(i, i + 30));
      } catch (e) {
        await raw.libraryRemove(doc.id).catch(() => undefined);
        throw e;
      }
      return (await brain.libraryDone(doc.id)).doc;
    },
    remove: (id) => raw.libraryRemove(id),
  }).catch(() => 0);
  return sent + docs;
}
/**
 * While the tag shows, keep asking the brain whether its database is back (every minute, and
 * whenever Ghosty comes back to the screen or the network returns), so the tag clears by
 * itself after the reset even if Ghosty was left open.
 */
let pauseCheck: ReturnType<typeof setInterval> | null = null;
const recheckPause = () => {
  if (memoryPaused.get().on) void brain.status().catch(() => undefined);
};
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && recheckPause());
if (typeof window !== 'undefined') window.addEventListener?.('online', recheckPause);
memoryPaused.subscribe((m, prev) => {
  if (m.on && !pauseCheck) pauseCheck = setInterval(recheckPause, 60_000);
  if (!m.on && pauseCheck) {
    clearInterval(pauseCheck);
    pauseCheck = null;
  }
  if (m.on !== prev.on) armBrainReminders(m.on);
  if (prev.on && !m.on) {
    void sendQueued();
    void refreshKeyCopy();
    void mirrorLibraryNow();
  }
});
