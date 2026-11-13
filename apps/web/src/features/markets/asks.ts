/**
 * THE MARKETS BY CHAT (planlane): the words that work this screen from the chat, read on the phone with no model, in many wordings.
 * Pure (no DOM, no storage): the spec and the chat both read this. Returns null when the words are not for this screen, so the next
 * table (and then the brain) gets them. Never take words another table owns ("play music", "open the agenda": the VOICE lane's meanings).
 */
export type MarketsAsk = { what: string; [k: string]: unknown };

export function marketsAsked(_text: string): MarketsAsk | null {
  return null;
}
