/**
 * Which phone notifications the owner wants, kind by kind (LINKS → NOTIFICATIONS). Every push the
 * brain sends goes through `pushIfWanted`, which looks at the owner's choice for that kind first.
 * The item still goes in the Agenda inbox either way.
 *
 * Each sender says which switch it falls under (agent.ts notify's `pushKind`): a reminder going off,
 * the tutor's "cards to revise" (tutor.ts), an upgrade idea (upgrades.ts). Nothing is worked out from
 * the words in a title. Everything else always goes: what the owner asked for there and then
 * (push_to_phone, SEND A TEST), finished background tasks and projects, and things that went wrong.
 * A switched-off kind is held back everywhere: no push, no Telegram message, no alert in the app.
 */
import { pushAll } from './push';

export const NOTIFY_KINDS = [
  { id: 'reminders', label: 'REMINDERS', hint: 'reminders you set ("remind me at 6 to call Mum")' },
  { id: 'flashcards', label: 'FLASHCARDS DUE', hint: 'when cards in LEARN are due for revision' },
  { id: 'upgrades', label: 'UPGRADE IDEAS', hint: "Ghosty's daily ideas for improving itself" },
] as const;
/**
 * Switches with nothing that sends them yet (a morning brief, a 3D model ready, price drops): not
 * shown. A choice already stored for one is kept as it is, ready for when a sender comes.
 */
export const LATER_KINDS = ['brief', 'model3d', 'prices'] as const;

export type NotifyKind = (typeof NOTIFY_KINDS)[number]['id'];
export type NotifyPrefs = Record<NotifyKind, boolean>;

const PREFS = 'notify:prefs';
const isKind = (k: string): k is NotifyKind => NOTIFY_KINDS.some((x) => x.id === k);
const DEFAULTS = (): NotifyPrefs => Object.fromEntries(NOTIFY_KINDS.map((k) => [k.id, true])) as NotifyPrefs;

export async function loadPrefs(storage: DurableObjectStorage): Promise<NotifyPrefs> {
  const saved = (await storage.get<Record<string, unknown>>(PREFS)) ?? {};
  const out = DEFAULTS();
  for (const [k, v] of Object.entries(saved)) if (isKind(k) && typeof v === 'boolean') out[k] = v;
  return out;
}

export async function savePrefs(storage: DurableObjectStorage, patch: Record<string, unknown>): Promise<NotifyPrefs> {
  // Written over what is stored, so choices for kinds not shown today are kept.
  const saved = (await storage.get<Record<string, unknown>>(PREFS)) ?? {};
  const next: Record<string, unknown> = { ...(await loadPrefs(storage)), ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => !isKind(k) && typeof v === 'boolean')) };
  for (const [k, v] of Object.entries(patch ?? {})) if (isKind(k) && typeof v === 'boolean') next[k] = v;
  await storage.put(PREFS, next);
  return loadPrefs(storage);
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
