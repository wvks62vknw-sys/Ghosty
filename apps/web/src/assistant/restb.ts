/**
 * THE CHAT'S WORDS FOR BATCH 8 PART B, on the phone with no model (the tables are assistant/phrases.ts LOCAL_ASKS; local.ts
 * writes the chat from what these return): the chess rating (gym/chessrate.ts) and, further down, the coach (coach/).
 */
import { loadBook, ratingAsked, ratingReply } from '../gym/chessrate';
import type { PackReply } from './packs';

export { ratingAsked };

/** "what's my chess rating?": both ratings in words, read from this phone. */
export function chessRatingTurn(text: string): PackReply {
  return { said: text, reply: ratingReply(loadBook(), Date.now()), go: [{ id: 'chess', ask: -1, label: 'Open chess in the GYM', open: 'gym' }] };
}
