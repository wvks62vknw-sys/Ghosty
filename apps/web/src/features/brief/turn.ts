/** THE BRIEF FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { briefAsked } from './asks';

/** The answer, or null to let the next table (and then the brain) answer. */
export async function briefTurn(text: string): Promise<PackReply | null> {
  const ask = briefAsked(text);
  if (!ask) return null;
  return null;
}
