/**
 * Client for Ghosty's brain (apps/edge), reached through /api on the same site.
 * Authentication: Cloudflare Access cookies go along automatically; if Access is not set
 * up, the owner key saved on this device is sent as `x-ghosty-key`.
 */
import type { AgendaEventInfo, BrainStatus, ChangeSummary, ChatEvent, ChatTurn, FeedInfo, InboxEntry, JobInfo, MemoryFact, VersionSummary, Widget } from '../../../../packages/shared/src/protocol';

/** This device's time zone; the brain uses it for reminders and the agenda. */
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

/** Every brain request carries `x-ghosty: 1`; the brain refuses state changes without it (blocks cross-site forgery). */
export function headers(extra: Record<string, string> = {}): Record<string, string> {
  const k = ownerKey.get();
  return { 'x-ghosty': '1', ...(k ? { 'x-ghosty-key': k } : {}), ...extra };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
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
  if (!r.ok) throw new Error((j as { error?: string })?.error ?? `HTTP ${r.status}`);
  return j as T;
}

/** Stream newline-delimited ChatEvents from a POST. */
async function streamEvents(path: string, body: unknown, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
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
  status: () => req<BrainStatus>('GET', '/status'),
  chat: (message: string, context: Record<string, unknown>, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) => streamEvents('/chat', { message, context }, onEvent, signal),
  approve: (id: string, allow: boolean, onEvent: (e: ChatEvent) => void) => streamEvents('/approve', { id, allow }, onEvent),
  stop: () => req<{ ok: boolean }>('POST', '/stop'),
  history: () => req<{ turns: ChatTurn[]; pending: { id: string; name: string; args: Record<string, unknown> } | null }>('GET', '/history'),
  clearHistory: () => req('DELETE', '/history'),
  memory: () => req<{ facts: MemoryFact[] }>('GET', '/memory'),
  addMemory: (text: string) => req('POST', '/memory', { text }),
  forget: (id: string) => req('DELETE', `/memory/${encodeURIComponent(id)}`),
  setKey: (name: string, value: string) => req('POST', '/keys', { name, value }) as Promise<{ ok: boolean; works?: boolean; info?: string }>,
  resetModels: () => req('POST', '/models/reset'),
  setOrder: (order: string[]) => req('POST', '/models/order', { order }),
  widgets: () => req<{ widgets: Widget[] }>('GET', '/widgets'),
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
  kernel: (minutes: number) => req<{ kernelUnlockedUntil: number }>('POST', '/kernel', { minutes }),
  async stt(audio: Blob): Promise<string> {
    const r = await fetch('/api/stt', { method: 'POST', headers: headers({ 'content-type': audio.type || 'audio/webm' }), body: audio });
    const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j.text ?? '';
  },
};
