/**
 * THE PACKS on the phone (BRIEF-PACKS-1): what the chat does here, with no model, for the money, body and kitchen packs —
 * the tables are assistant/phrases.ts LOCAL_ASKS, and assistant/local.ts writes the chat from what these return.
 *  - MONEY: a statement pasted in the chat (its CSV, or the text copied out of its PDF) goes to his own brain's SPENDING
 *    with the rule table only (no model sees it, not even the shops' names), and comes back as the month's card: the top
 *    five categories and what changed. The chat shows "a statement pasted (N lines)", never the statement itself.
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { monthCard, monthWords } from '../../../../packages/shared/src/money';
import { brain } from '../api/brain';

/** What local.ts writes: his message as the chat shows it, the reply, the cards, and the GO chips under it. */
export interface PackReply {
  said: string;
  reply: string;
  cards?: Card[];
  go?: { id: string; ask: number; label: string; open?: string; run?: string; args?: Record<string, unknown>; words?: string }[];
}

const prevMonth = (m: string) => (m.slice(5, 7) === '01' ? `${+m.slice(0, 4) - 1}-12` : `${m.slice(0, 4)}-${String(+m.slice(5, 7) - 1).padStart(2, '0')}`);

export async function statementTurn(text: string): Promise<PackReply> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const said = `A statement pasted (${lines} lines): read in code on its way to my brain, never shown to a model.`;
  try {
    const r = await brain.spendingImport(text, true);
    const v = r.view;
    if (!v) return { said, reply: 'I read it, but there were no payments in it I could keep.' };
    const res = r.result;
    const moves = r.moves ?? [];
    const head = `Read ${res.added} payment${res.added === 1 ? '' : 's'}${res.duplicates ? ` (${res.duplicates} I had already)` : ''}${res.unplaced ? `; ${res.unplaced} the rules couldn’t place are under “other” — a tap files them in Agenda → SPENDING` : ''}.`;
    return {
      said,
      reply: `${head} ${monthWords(v, moves, r.months.includes(prevMonth(v.month)))} Kept in your brain only; no bank access.`,
      cards: [monthCard(v, moves)],
      go: [{ id: 'spending', ask: -1, label: 'Open spending', open: 'agenda' }],
    };
  } catch (e) {
    const why = (e as Error).message || 'my brain did not answer';
    return { said, reply: `I couldn’t keep that statement: ${why}. Nothing was sent anywhere else.` };
  }
}
