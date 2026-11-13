/**
 * PUT IT ON MY SITES (BRIEF-KERNEL-3 item 6; the owner's yes, FINAL-ROUND 13 Nov). The studio never publishes: it hands the open
 * game to the brain to WAIT (POST /api/sites/game: kept for two hours, published by nothing), and the chat turn "put <name> on my
 * sites" asks his APPROVE, as every page of his sites does. On his yes the game is at /s/<name>/: an installable page that plays
 * offline and keeps its saves (apps/edge/src/gamesite.ts). The hand-over goes before the words, so the brain has the game he means.
 */
import { headers } from '../api/brain';
import { sayError } from '../ui/hisWords';
import { addressOf } from './app';
import type { Game } from './model';

/** The key's sentence: what starts the chat turn. */
export const sitesLine = (name: string): string => `Ask me in the chat: “put ${name} on my sites” and I’ll ask your APPROVE.`;
/** The words in the chat that mean "put it on my sites" (the brain's tool is publish_game). */
export const ON_SITES = /\b(?:on|onto|to)\s+(?:my|his|your)\s+(?:web\s*)?sites?\b|\bmy (?:web\s*)?sites\b/i;
export const askWords = (g: Pick<Game, 'name'>): string => `Put ${g.name} on my sites`;

/** The game to the brain to wait for his word; the address it would have, or why not, in his words. */
export async function handOver(g: Game): Promise<{ link: string } | { error: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { error: 'You are offline. Putting it on your sites waits for a connection: try again when you are back online.' };
  try {
    const r = await fetch('/api/sites/game', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ game: g }), credentials: 'same-origin' });
    const j = (await r.json().catch(() => null)) as { error?: string; link?: string } | null;
    if (!r.ok) return { error: typeof j?.error === 'string' && j.error ? j.error.slice(0, 240) : `My brain did not take the game (it answered ${r.status}). Try again in a minute.` };
    return { link: j?.link ? `/s/${j.link}/` : addressOf(g) };
  } catch (e) {
    return { error: sayError(e, 'hand the game to my brain') };
  }
}
