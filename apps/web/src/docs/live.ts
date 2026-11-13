/**
 * THE DOCUMENT OPEN IN THE EDITOR, for the chat (BRIEF-KERNEL-2 item 2). While the editor shows a document (docs/sheet.ts), it
 * registers here; the chat sends that document's words with his message as the turn's data, and the brain's `document` tool
 * answers with proposals, which the editor shows as marked changes he accepts or rejects. A tiny module on purpose: the chat
 * asks it on every message and loads nothing of the editor to do so.
 */
export interface LiveDoc {
  /** The open document's numbered paragraphs as a message's data ('' when it has no words). */
  data(): string;
  /** What the brain's `document` tool proposed (an `edit` or an `append`): shown as a marked change; said in words. */
  propose(args: Record<string, unknown>): string;
}
let live: LiveDoc | null = null;
export const setLiveDoc = (l: LiveDoc | null): void => {
  live = l;
};
/** What to add after his message: the open document as data, or ''. */
export const openDocData = (): string => live?.data() ?? '';
/** The brain's proposal, to the open document; the words that say what happened. */
export const proposeToDoc = (args: Record<string, unknown>): string => live?.propose(args) ?? 'The brain proposed a change to a document, but none is open here any more.';
