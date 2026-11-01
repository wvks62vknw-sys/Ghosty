/**
 * THE APPROVAL QUEUE (BRIEF-SOCIAL item 2), shared by every account: any post anywhere is a DRAFT first — a card in the chat
 * (and Telegram) with the words, the account, APPROVE · EDIT · NO — and nothing goes out without APPROVE, pressed by him
 * on his phone or in his own Telegram chat. A draft is gone after 24 hours; NO drops it; EDIT changes its words (still a
 * draft); APPROVE sends it ONCE (a press while it is sending, or after it went, sends nothing more). A follow and an
 * unfollow are drafts too. Every post sent is recorded, so WHY (why.ts) and "what did you do today" (today.ts) list it.
 * Nothing here talks to an account: the sending is the caller's (social/index.ts), behind this gate.
 */
import { DRAFT_TTL_MS, MAX_DRAFTS, accountName, type Account, type Draft, type DraftKind } from '../../../../packages/shared/src/social';
import { keepTrail } from '../why';

export const DRAFTS_KEY = 'social:drafts';
export const SENT_KEY = 'social:sent';
/** The sent log keeps a week (what he did today reads it; WHY keeps its own two days). */
const KEEP_SENT_MS = 7 * 86_400_000;

/** One thing that went out, with his APPROVE: where, what, when, and where he pressed it. */
export interface Sent {
  at: number;
  account: Account;
  kind: DraftKind;
  text: string;
  who?: string;
  link?: string;
  draft: string;
  on: 'phone' | 'telegram';
}

const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
/** Eight letters and digits (Telegram's signed buttons carry it). */
export function draftId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((b) => ALPHA[b % ALPHA.length]).join('');
}

/** The drafts, newest last; one still waiting past its 24 hours reads as expired. */
export async function loadDrafts(storage: DurableObjectStorage, now = Date.now()): Promise<Draft[]> {
  const list = (await storage.get<Draft[]>(DRAFTS_KEY).catch(() => undefined)) ?? [];
  return list.map((d) => (d.state === 'waiting' && now > d.expires ? { ...d, state: 'expired' as const } : d));
}
const saveDrafts = (storage: DurableObjectStorage, list: Draft[]) => storage.put(DRAFTS_KEY, list.slice(-MAX_DRAFTS));

export async function findDraft(storage: DurableObjectStorage, id: string, now = Date.now()): Promise<Draft | null> {
  return (await loadDrafts(storage, now)).find((d) => d.id === id) ?? null;
}

async function update(storage: DurableObjectStorage, id: string, f: (d: Draft) => Draft, now: number): Promise<Draft | null> {
  const list = await loadDrafts(storage, now);
  const i = list.findIndex((d) => d.id === id);
  if (i < 0) return null;
  list[i] = f(list[i]!);
  await saveDrafts(storage, list);
  return list[i]!;
}

/** A new draft, waiting 24 hours for his APPROVE. */
export async function addDraft(storage: DurableObjectStorage, d: Pick<Draft, 'account' | 'kind' | 'text' | 'from'> & Partial<Pick<Draft, 'who' | 'image' | 'rkey'>>, now = Date.now()): Promise<Draft> {
  const draft: Draft = { id: draftId(), account: d.account, kind: d.kind, text: d.text.trim(), ...(d.who ? { who: d.who } : {}), ...(d.image ? { image: d.image } : {}), ...(d.rkey ? { rkey: d.rkey } : {}), from: d.from, at: now, expires: now + DRAFT_TTL_MS, state: 'waiting' };
  await saveDrafts(storage, [...(await loadDrafts(storage, now)), draft]);
  return draft;
}

/** Why a draft cannot be answered now, in his words; null when it can (waiting, or failed and waiting again). */
function closed(d: Draft | null, now: number): string | null {
  if (!d) return 'That draft is gone: drafts last 24 hours. Ask me again.';
  if (d.state === 'expired' || (d.state === 'waiting' && now > d.expires)) return 'That draft expired after 24 hours: nothing went out. Ask me again.';
  if (d.state === 'no') return 'You said no to that one: nothing went out.';
  if (d.state === 'sent') return `Already done${d.link ? `: ${d.link}` : '.'}`;
  if (d.state === 'sending') return 'Sending it already.';
  return null;
}

/** EDIT: new words (and the picture's words) for a draft still waiting; it stays a draft, waiting for APPROVE. */
export async function editDraft(storage: DurableObjectStorage, id: string, change: { text?: string; alt?: string }, now = Date.now()): Promise<Draft | { error: string }> {
  const why = closed(await findDraft(storage, id, now), now);
  if (why) return { error: why };
  const d = await update(storage, id, (x) => ({ ...x, ...(change.text !== undefined && x.kind === 'post' ? { text: change.text.trim() } : {}), ...(change.alt !== undefined && x.image ? { image: { ...x.image, alt: change.alt.trim() } } : {}), state: 'waiting', edited: now, fault: undefined }), now);
  return d ?? { error: 'That draft is gone.' };
}

/** NO: dropped; nothing goes out. */
export async function refuseDraft(storage: DurableObjectStorage, id: string, now = Date.now()): Promise<Draft | { error: string }> {
  const why = closed(await findDraft(storage, id, now), now);
  if (why) return { error: why };
  const d = await update(storage, id, (x) => ({ ...x, state: 'no', answered: now }), now);
  return d ?? { error: 'That draft is gone.' };
}

/** Drafts being sent now, in this brain: a second APPROVE while the first is on its way sends nothing. */
const inFlight = new Set<string>();

/**
 * APPROVE: the draft is sent ONCE by `send` (the account's own call), recorded (the sent log, and a trail for WHY), and
 * comes back sent with its link; a failure is said in plain words and the draft waits for APPROVE again. Anything not
 * waiting (gone, expired, refused, sent, sending) sends nothing.
 */
export async function approveDraft(
  storage: DurableObjectStorage,
  id: string,
  send: (d: Draft) => Promise<{ link?: string }>,
  o: { on: 'phone' | 'telegram'; now?: () => number },
): Promise<{ draft: Draft; said: string } | { error: string; draft?: Draft }> {
  const now = o.now ?? (() => Date.now());
  if (inFlight.has(id)) return { error: 'Sending it already.' };
  inFlight.add(id);
  try {
    const d = await findDraft(storage, id, now());
    const why = closed(d, now());
    if (why || !d) return { error: why ?? 'That draft is gone.', ...(d ? { draft: d } : {}) };
    await update(storage, id, (x) => ({ ...x, state: 'sending', fault: undefined }), now());
    let link: string | undefined;
    try {
      link = (await send(d)).link;
    } catch (e) {
      const error = String((e as Error)?.message ?? e).replace(/\s+/g, ' ').slice(0, 240);
      const back = await update(storage, id, (x) => ({ ...x, state: 'failed', fault: error }), now());
      return { error: `Not sent: ${error}`, ...(back ? { draft: back } : {}) };
    }
    const at = now();
    const sent = (await update(storage, id, (x) => ({ ...x, state: 'sent', answered: at, ...(link ? { link } : {}) }), at)) ?? { ...d, state: 'sent' as const, answered: at };
    const log = ((await storage.get<Sent[]>(SENT_KEY).catch(() => undefined)) ?? []).filter((s) => at - s.at <= KEEP_SENT_MS);
    log.push({ at, account: d.account, kind: d.kind, text: d.text.slice(0, 300), ...(d.who ? { who: d.who } : {}), ...(link ? { link } : {}), draft: d.id, on: o.on });
    await storage.put(SENT_KEY, log.slice(-100));
    const said = sentWords(sent);
    // WHY: the approval as a turn of its own — what he pressed, what went out, where
    await keepTrail(storage, { at, asked: `APPROVE (${o.on === 'telegram' ? 'on Telegram' : 'on the card'}): ${d.kind === 'post' ? `post on ${accountName(d.account)}` : `${d.kind} ${d.who ?? ''} on ${accountName(d.account)}`}`, steps: [{ tool: 'social', args: `${d.kind} on ${accountName(d.account)}: “${d.kind === 'post' ? d.text.slice(0, 80) : d.who ?? ''}”`, ok: true }], said }, at).catch(() => undefined);
    return { draft: sent, said };
  } finally {
    inFlight.delete(id);
  }
}

/** "Posted on Bluesky: https://…", "Followed @sam on Mastodon." */
export function sentWords(d: Draft): string {
  const where = accountName(d.account);
  if (d.kind === 'post') return `Posted on ${where}${d.link ? `: ${d.link}` : '.'}`;
  return `${d.kind === 'follow' ? 'Followed' : 'Unfollowed'} ${d.who ?? ''} on ${where}.`.replace(/\s+/g, ' ');
}

/** What went out since `from` (ms), oldest first. */
export async function sentSince(storage: DurableObjectStorage, from: number): Promise<Sent[]> {
  return ((await storage.get<Sent[]>(SENT_KEY).catch(() => undefined)) ?? []).filter((s) => s.at >= from);
}

/** "Posted on Bluesky (you approved it): “…”", for what he did today. */
export const sentLine = (s: Sent): string =>
  s.kind === 'post' ? `Posted on ${accountName(s.account)} (you approved it): “${s.text.slice(0, 120)}”` : `${s.kind === 'follow' ? 'Followed' : 'Unfollowed'} ${s.who ?? ''} on ${accountName(s.account)} (you approved it)`;
