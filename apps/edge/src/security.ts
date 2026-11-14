/**
 * [security] SAFE, PRIVATE AND IN YOUR HANDS (NEXT ROUND, lane SECURITY): what the phone's SECURITY screen reads from the brain.
 *  - Every APPROVE and NOT NOW, from the phone or Telegram, kept as a short list: what, when, where from, and the page whose words
 *    came before it when there was one (security.u4, security.u6). Only the plain description is kept, never a key or a body.
 *  - The brain's own locks, as yes/no facts the phone colours green, amber or red (security.u1): is VAULT_KEY a secret, is the
 *    public demo open, are change previews on. No secret, no key and no length of one ever leaves here.
 */
import type { Env } from './env';

export const APPROVALS_KEY = 'security:approvals';
export const MAX_APPROVALS = 100;

export interface ApprovalEntry {
  /** The tool's plain name ("send_email"). */
  tool: string;
  /** The card's own line ("Send an email to sam@…"), clipped. */
  what: string;
  allow: boolean;
  from: 'phone' | 'telegram';
  at: number;
  /** The page or feed whose words came before the card this turn, when there was one. */
  after?: string;
}

/** Keep one answer, newest first, at most MAX_APPROVALS. Never throws (a full or paused database just keeps nothing). */
export async function logApproval(storage: Pick<DurableObjectStorage, 'get' | 'put'>, e: ApprovalEntry): Promise<void> {
  try {
    const list = (await storage.get<ApprovalEntry[]>(APPROVALS_KEY)) ?? [];
    const clean: ApprovalEntry = { tool: e.tool.slice(0, 60), what: e.what.replace(/\s+/g, ' ').trim().slice(0, 200), allow: !!e.allow, from: e.from === 'telegram' ? 'telegram' : 'phone', at: e.at, ...(e.after ? { after: e.after.slice(0, 160) } : {}) };
    await storage.put(APPROVALS_KEY, [clean, ...list].slice(0, MAX_APPROVALS));
  } catch {
    /* nothing kept is better than a turn that fails */
  }
}

export async function loadApprovals(storage: Pick<DurableObjectStorage, 'get'>): Promise<ApprovalEntry[]> {
  try {
    return (await storage.get<ApprovalEntry[]>(APPROVALS_KEY)) ?? [];
  } catch {
    return [];
  }
}

/** The brain's locks, as facts. */
export interface BrainLocks {
  /** VAULT_KEY is a Cloudflare secret (without it the vault's key sits beside the vault). */
  vaultKey: boolean;
  /** The public demo is open (DEMO_OFF is not 1). */
  demoOpen: boolean;
  /** Where change previews appear, or null when there are none. */
  previews: string | null;
  /** Signed in by Cloudflare Access is set up as well as, or instead of, the owner key. */
  access: boolean;
  /** The owner key is checked by its fingerprint (OWNER_KEY_HASH) rather than kept as the key itself. */
  keyByHash: boolean;
}

export function brainLocks(env: Env, previews: string | null): BrainLocks {
  const e = env as unknown as Record<string, string | undefined>;
  return {
    vaultKey: !!e.VAULT_KEY,
    demoOpen: e.DEMO_OFF !== '1',
    previews,
    access: !!(e.OWNER_EMAIL && e.ACCESS_TEAM && e.ACCESS_AUD),
    keyByHash: /^[0-9a-f]{64}$/i.test(e.OWNER_KEY_HASH ?? ''),
  };
}

const PENDING_KEY = 'pending';
const PUSHED_KEY = 'security:pushed';

/**
 * A waiting APPROVE as a phone notification (security.s10), sent once per approval when he walks away from the card (the app
 * asks, as it asks for Telegram). Only the approval really waiting, under that id, is ever put to him; a tap opens the chat at
 * the card, and he answers there (iPhone notifications from a web app carry no buttons, and the answer is always his tap).
 */
export async function askOnPhone(storage: Pick<DurableObjectStorage, 'get' | 'put'>, id: string, push: (msg: { title: string; body: string; tag: string; url: string }) => Promise<number>): Promise<{ sent: number; already?: boolean; error?: string }> {
  const pending = await storage.get<{ id: string; reason?: string; calls: { function: { name: string } }[] }>(PENDING_KEY).catch(() => undefined);
  if (!pending || pending.id !== id || !pending.calls?.[0]) return { sent: 0, error: 'nothing is waiting for approval' };
  const pushed = (await storage.get<string[]>(PUSHED_KEY).catch(() => undefined)) ?? [];
  if (pushed.includes(id)) return { sent: 0, already: true };
  const what = (pending.reason ?? `Allow ${pending.calls[0].function.name.replace(/_/g, ' ')}?`).replace(/\s+/g, ' ').trim().slice(0, 140);
  const sent = await push({ title: 'Waiting for your APPROVE', body: `${what} Open Ghosty to answer.`, tag: `approve-${id}`, url: '/#core' }).catch(() => 0);
  await storage.put(PUSHED_KEY, [...pushed, id].slice(-20)).catch(() => undefined);
  return { sent };
}

/**
 * HAS THIS PASSWORD LEAKED? (security.s2): the phone sends only the first five characters of the password's SHA-1 fingerprint;
 * the brain asks the free public list of leaked passwords (Have I Been Pwned's range door, keyless, padded so even the answer's
 * size says nothing) for every fingerprint that starts that way, and hands the list back. The phone compares the rest itself:
 * the password, and its whole fingerprint, never leave the phone.
 */
export const PWNED_RANGE = 'https://api.pwnedpasswords.com/range/';
export async function pwnedRange(prefix: string, fetcher: (url: string, init?: RequestInit) => Promise<Response>): Promise<{ list: string } | { error: string }> {
  if (!/^[0-9A-F]{5}$/.test(prefix)) return { error: 'send the first five characters of the fingerprint, nothing else' };
  try {
    const r = await fetcher(`${PWNED_RANGE}${prefix}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'Ghosty personal assistant' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { error: 'the list of leaked passwords did not answer' };
    const text = (await r.text()).slice(0, 2_000_000);
    // only the lines that are a fingerprint's rest and a count, nothing else passed on
    const list = text.split(/\r?\n/).filter((l) => /^[0-9A-F]{35}:\d+$/.test(l.trim())).join('\n');
    return { list };
  } catch {
    return { error: 'the list of leaked passwords can’t be reached right now' };
  }
}

/**
 * ONE TAP TO LOCK EVERYTHING (security.u11): Telegram unpaired, and nothing that publishes, sends, pays or ships runs, until he
 * unlocks with his key. Kept in the brain. (The public demo is left as it is: it never touches his data or his KV, a rule of its
 * own, and DEMO_OFF=1 in Cloudflare closes it.)
 */
export const LOCK_KEY = 'security:lockdown';
/** The tools that stay still while locked: everything that leaves (the brain's own SENSITIVE words) and changes to Ghosty itself. */
export const LOCKED_TOOLS = /(send|email|message|post|publish|pay|purchase|buy|transfer|book|ship|social|propose_change|update_change|build_app|restore_version|schedule_task)/i;
export const LOCKED_WORDS = 'Ghosty is locked: nothing that publishes, sends, pays or ships runs until you unlock it in Settings → Security.';

export async function lockedAt(storage: Pick<DurableObjectStorage, 'get'>): Promise<number | null> {
  try {
    const v = await storage.get<{ at: number }>(LOCK_KEY);
    return v && v.at ? v.at : null;
  } catch {
    return null;
  }
}

export async function setLocked(storage: Pick<DurableObjectStorage, 'put' | 'delete'>, on: boolean, now = Date.now()): Promise<void> {
  if (on) await storage.put(LOCK_KEY, { at: now });
  else await storage.delete(LOCK_KEY);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** GET /security: the locks and the approvals list. DELETE /security/approvals: clear the list (his own history). */
export async function securityRoute(path: string, method: string, d: { env: Env; storage: Pick<DurableObjectStorage, 'get' | 'put' | 'delete'>; previews: string | null; push?: (msg: { title: string; body: string; tag: string; url: string }) => Promise<number>; fetcher?: (url: string, init?: RequestInit) => Promise<Response>; unpairTelegram?: () => Promise<unknown>; checkLink?: (text: string) => Promise<{ verdict: string; words: string; links: string[] }>; body?: () => Promise<Record<string, unknown> | null> }): Promise<Response> {
  const ask = path.match(/^\/security\/ask\/([\w-]{1,16})$/);
  if (ask && method === 'POST') return json(d.push ? await askOnPhone(d.storage, ask[1]!, d.push) : { sent: 0, error: 'notifications are not set up' });
  const range = path.match(/^\/security\/pwned\/([0-9A-F]{5})$/);
  if (range && method === 'GET') {
    const out = await pwnedRange(range[1]!, d.fetcher ?? ((u, i) => fetch(u, i)));
    return json(out, 'error' in out ? 502 : 200);
  }
  // CHECK A LINK (security.u9): the guardian's own scam check from public records (no model, no key), for a pasted link or message
  if (path === '/security/linkcheck' && method === 'POST' && d.checkLink) {
    const raw = d.body ? await d.body() : null;
    const text = typeof raw?.text === 'string' ? raw.text.slice(0, 4000) : '';
    if (!/https?:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(text)) return json({ error: 'paste a link, or a message with a link in it' }, 400);
    const c = await d.checkLink(text);
    return json({ verdict: c.verdict, words: c.words, links: c.links.slice(0, 5) });
  }
  if (path === '/security/lock' && method === 'POST') {
    await setLocked(d.storage, true);
    const telegram = d.unpairTelegram ? await d.unpairTelegram().then(() => true, () => false) : false;
    return json({ locked: true, at: await lockedAt(d.storage), telegram });
  }
  if (path === '/security/unlock' && method === 'POST') {
    await setLocked(d.storage, false);
    return json({ locked: false });
  }
  if (path === '/security' && method === 'GET') return json({ locks: brainLocks(d.env, d.previews), approvals: await loadApprovals(d.storage), lockedAt: await lockedAt(d.storage) });
  if (path === '/security/approvals' && method === 'DELETE') {
    await d.storage.delete(APPROVALS_KEY).catch(() => undefined);
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}
