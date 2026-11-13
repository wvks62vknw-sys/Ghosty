/** THE BRIEF FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { go } from '../../shell/tabs';
import { briefFacts } from './aloud';
import { briefAsked } from './asks';
import { greeting, summary } from './day';

/** What the chat says when the Brief has nothing yet: what it means and what happens next. */
export const NOTHING_YET = 'I can’t reach the weather or your diary yet. The Brief is open and fills in by itself when I can.';

/**
 * The answer, or null to let the next table (and then the brain) answer. "Good morning", "give me the rundown": the Brief opens and
 * its one-line summary is said from the same facts the page shows (the weather, the diary, his to-dos, the drive), no model.
 */
export async function briefTurn(text: string): Promise<PackReply | null> {
  const ask = briefAsked(text);
  if (!ask) return null;
  const now = Date.now();
  const facts = await briefFacts(now, true);
  go('brief');
  const line = summary(facts);
  return { said: text, reply: line ? `${greeting(new Date(now))}. ${line}` : NOTHING_YET };
}
