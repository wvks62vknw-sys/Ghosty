/**
 * A DOCUMENT OR A DECK AT ITS OWN LINK (NEXT ROUND sites.s4, with s3). The document or the deck open on his phone is made into one
 * clean read-only page there (a document as its own page; a deck as its slides one under another, swiped like a book, with no script)
 * and handed to the brain to WAIT (POST /api/sites/page, signed in): kept for two hours, published by nothing. "Publish it as a page"
 * in the chat runs publish_site with from_phone, which goes through the same check and the same APPROVE as every page he publishes,
 * and serves it like every other page: framed, sandboxed, no network.
 */
import type { Env } from './env';
import { durableDelete, durableGet, durablePut } from './kv';

export const PAGE_WAITING = 'sitepage:waiting';
export const PAGE_WAIT_MS = 2 * 3600_000;
export const MAX_PAGE = 400_000;

export interface WaitingPage {
  title: string;
  html: string;
  kind: 'document' | 'deck';
  at: number;
}
interface Store {
  env: Pick<Env, 'SITES'>;
  storage?: DurableObjectStorage;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** The page waiting from his phone: the brain's own storage first (written last, everywhere), KV while it is paused. */
export async function waitingPage(s: Store): Promise<WaitingPage | undefined> {
  let w: WaitingPage | undefined;
  if (s.storage) {
    try {
      w = await s.storage.get<WaitingPage>(PAGE_WAITING);
    } catch {
      w = await durableGet<WaitingPage>(s.env, undefined, PAGE_WAITING).catch(() => undefined);
    }
  } else w = await durableGet<WaitingPage>(s.env, undefined, PAGE_WAITING).catch(() => undefined);
  return w && Date.now() - w.at < PAGE_WAIT_MS ? w : undefined;
}
export const dropWaitingPage = (s: Store) => durableDelete(s.env, s.storage, PAGE_WAITING).catch(() => undefined);

/** /sites/page in the brain (agent.ts, behind his sign-in): POST { title, html, kind } to wait; GET what waits; DELETE forgets it. */
export async function pageUpload(req: Request, s: Store): Promise<Response> {
  if (req.method === 'GET') {
    const w = await waitingPage(s);
    return json(w ? { title: w.title, kind: w.kind, bytes: w.html.length, at: w.at } : { title: null });
  }
  if (req.method === 'DELETE') {
    await dropWaitingPage(s);
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'not here' }, 405);
  const text = await req.text();
  if (text.length > MAX_PAGE * 1.2) return json({ error: `That is too big for one page on your sites (${Math.round(text.length / 1024)} KB; ${Math.round(MAX_PAGE / 1024)} KB at most). Make the pictures smaller or split it.` }, 413);
  let b: { title?: unknown; html?: unknown; kind?: unknown };
  try {
    b = JSON.parse(text) as typeof b;
  } catch {
    return json({ error: 'I could not read that.' }, 400);
  }
  const html = typeof b.html === 'string' ? b.html : '';
  const title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  if (!/^<!doctype html>/i.test(html.trimStart()) || !title) return json({ error: 'That is not a page I can put on your sites.' }, 422);
  if (html.length > MAX_PAGE) return json({ error: `That is too big for one page on your sites (${Math.round(html.length / 1024)} KB; ${Math.round(MAX_PAGE / 1024)} KB at most). Make the pictures smaller or split it.` }, 413);
  const kind = b.kind === 'deck' ? 'deck' : 'document';
  try {
    await durablePut(s.env, s.storage, PAGE_WAITING, { title, html, kind, at: Date.now() } satisfies WaitingPage);
  } catch {
    return json({ error: 'I could not keep it just now (my free storage said no). Try again in a minute.' }, 503);
  }
  return json({ ok: true, title, kind, bytes: html.length });
}
