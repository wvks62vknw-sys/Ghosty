/** THE AGENDA FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { agendaAsked } from './asks';

/** The answer, or null to let the next table (and then the brain) answer. */
export async function agendaTurn(text: string): Promise<PackReply | null> {
  const ask = agendaAsked(text);
  if (!ask) return null;
  return null;
}
