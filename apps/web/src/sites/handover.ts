/**
 * PUT IT ON MY SITES, for a document or a deck (NEXT ROUND sites.s4, with s3). The editor makes one clean read-only page of what is
 * open, here on the phone, and hands it to the brain to WAIT (apps/edge/src/sitepage.ts): nothing is published by the key. Then it
 * asks in the chat, "Publish <title> as a page", and the page goes up only after his APPROVE there, through the same check as every
 * page on his sites.
 */
import { headers } from '../api/brain';
import { inHisWords, sayError } from '../ui/hisWords';

export const MAX_PAGE = 400_000;
export const askWords = (title: string): string => `Publish ${title} as a page`;
/** The sentence each editor shows by its key. */
export const pageLine = (what: 'document' | 'deck'): string => `Put this ${what} on your sites as a read-only page at its own link. I ask your APPROVE in the chat first.`;

/** Hand the page over and ask in the chat; what to say back, in his words. */
export async function putOnSites(title: string, html: string, kind: 'document' | 'deck'): Promise<{ ok: true; said: string } | { ok: false; said: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, said: 'You are offline. Putting it on your sites waits for a connection.' };
  if (html.length > MAX_PAGE) return { ok: false, said: `It is ${Math.round(html.length / 1024)} KB as a page, over the ${Math.round(MAX_PAGE / 1024)} KB a page on your sites holds. Make its pictures smaller, or split it.` };
  try {
    const r = await fetch('/api/sites/page', { method: 'POST', credentials: 'same-origin', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ title, html, kind }) });
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    if (!r.ok) throw typeof j?.error === 'string' ? inHisWords(j.error) : new Error(`the brain answered ${r.status}`);
  } catch (e) {
    return { ok: false, said: sayError(e, 'hand it to my brain') };
  }
  const [{ send }, { openChat }] = await Promise.all([import('../assistant/session'), import('../shell/launcher')]);
  openChat();
  void send(askWords(title));
  return { ok: true, said: `“${title}” is with me, waiting for your word. I’ve asked in the chat: tap APPROVE there and I’ll give you its link.` };
}
