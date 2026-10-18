/**
 * Which phone notifications the owner wants, kind by kind (LINKS → NOTIFICATIONS). Every push the
 * brain sends goes through `pushIfWanted`, which looks at the owner's choice for that kind first.
 * Only the push is held back: the item still goes in the Agenda inbox.
 *
 * Kinds the owner cannot switch off: what they asked for there and then (push_to_phone, SEND A TEST),
 * finished background tasks and projects, and things that went wrong.
 */
import { pushAll } from './push';

export const NOTIFY_KINDS = [
  { id: 'reminders', label: 'REMINDERS', hint: 'reminders you set ("remind me at 6 to call Mum")' },
  { id: 'brief', label: 'MORNING BRIEF', hint: 'your scheduled morning briefing' },
  { id: 'flashcards', label: 'FLASHCARDS DUE', hint: 'when cards in LEARN are due for revision' },
  { id: 'model3d', label: '3D MODEL READY', hint: 'when a 3D model from 3D STUDIO is ready' },
  { id: 'prices', label: 'PRICE DROPS', hint: 'when something you watch gets cheaper (coming later)' },
  { id: 'upgrades', label: 'UPGRADE IDEAS', hint: "Ghosty's daily ideas for improving itself" },
] as const;

export type NotifyKind = (typeof NOTIFY_KINDS)[number]['id'];
export type NotifyPrefs = Record<NotifyKind, boolean>;

const PREFS = 'notify:prefs';
const isKind = (k: string): k is NotifyKind => NOTIFY_KINDS.some((x) => x.id === k);
const DEFAULTS = (): NotifyPrefs => Object.fromEntries(NOTIFY_KINDS.map((k) => [k.id, true])) as NotifyPrefs;

export async function loadPrefs(storage: DurableObjectStorage): Promise<NotifyPrefs> {
  const saved = (await storage.get<Partial<NotifyPrefs>>(PREFS)) ?? {};
  const out = DEFAULTS();
  for (const [k, v] of Object.entries(saved)) if (isKind(k) && typeof v === 'boolean') out[k] = v;
  return out;
}

export async function savePrefs(storage: DurableObjectStorage, patch: Record<string, unknown>): Promise<NotifyPrefs> {
  const prefs = await loadPrefs(storage);
  for (const [k, v] of Object.entries(patch ?? {})) if (isKind(k) && typeof v === 'boolean') prefs[k] = v;
  await storage.put(PREFS, prefs);
  return prefs;
}

/**
 * Which switch an inbox item (agent.ts notify) falls under, or null for those that always go out.
 * Reminders by their kind; the others by the titles their senders give them (tutor.ts "Cards to
 * revise", upgrades.ts "Upgrade idea", a scheduled task named like "Morning briefing").
 */
export function pushKindOf(item: { kind: string; title: string }): NotifyKind | null {
  if (item.kind === 'reminder') return 'reminders';
  if (item.kind !== 'task') return null;
  const t = item.title;
  if (/^cards to revise\b/i.test(t)) return 'flashcards';
  if (/^upgrade ideas?\b/i.test(t)) return 'upgrades';
  if (/\b3-?d model\b.*\bready\b/i.test(t)) return 'model3d';
  if (/\bprice (drop|alert)s?\b|\bcheaper\b/i.test(t)) return 'prices';
  if (/\bbrief(ing)?\b/i.test(t)) return 'brief';
  return null;
}

/** Is a push of this kind wanted? A database that cannot be read (paused) never silences anything. */
export async function pushWanted(storage: DurableObjectStorage, kind: NotifyKind | null): Promise<boolean> {
  if (!kind) return true;
  try {
    return (await loadPrefs(storage))[kind];
  } catch {
    return true;
  }
}

/** The one way the brain sends a push: only when the owner wants this kind. Returns how many devices got it. */
export async function pushIfWanted(storage: DurableObjectStorage, kind: NotifyKind | null, msg: { title: string; body: string; tag?: string; url?: string }, contact?: string): Promise<number> {
  if (!(await pushWanted(storage, kind))) return 0;
  return pushAll(storage, msg, contact);
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** /api/push/prefs — GET: every switch and its state; POST {kind: true|false, …}: change some. */
export async function notifyPrefsRoute(req: Request, method: string, storage: DurableObjectStorage): Promise<Response> {
  if (method === 'GET') return json({ prefs: await loadPrefs(storage), kinds: NOTIFY_KINDS });
  if (method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return json({ prefs: await savePrefs(storage, body && typeof body === 'object' ? body : {}) });
  }
  return json({ error: 'not found' }, 404);
}
