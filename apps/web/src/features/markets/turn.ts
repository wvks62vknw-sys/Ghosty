/** THE MARKETS FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { marketsAsked } from './asks';

/** The answer, or null to let the next table (and then the brain) answer. */
export async function marketsTurn(text: string): Promise<PackReply | null> {
  const ask = marketsAsked(text);
  if (!ask) return null;
  return null;
}
