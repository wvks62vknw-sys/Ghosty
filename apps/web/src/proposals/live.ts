/**
 * THE EDITOR OPEN ON HIS PHONE, for the chat (BRIEF-KERNEL-3). The deck, the video project, the workspace and the game each register
 * here while they are open (the same shape as docs/live.ts for the document); the chat sends what is open with his message as the
 * turn's data (packages/shared/src/openwork.ts), and what the brain's `slides`, `videoedit`, `workspace` and `game` tools propose
 * comes back here to be marked in that editor, for his tap to accept or reject. A tiny module on purpose: the chat asks it on every
 * message and loads nothing of any editor to do so.
 */
import { WORK_WHEN, type WorkKind } from '../../../../packages/shared/src/openwork';

export interface LiveWork {
  /** The open editor's reading as a message's data ('' when it has nothing to say). */
  data(): string;
  /** What the brain's tool proposed: shown as a marked change, and said in words. */
  propose(args: Record<string, unknown>): string;
  /** [sites] Anything the brain needs before these words reach it (the game studio hands its game over for "on my sites"). */
  ready?(words: string): Promise<void>;
}
const live = new Map<WorkKind, LiveWork>();
export const setLiveWork = (kind: WorkKind, l: LiveWork | null): void => {
  if (l) live.set(kind, l);
  else live.delete(kind);
};
/** The words that send an open editor with a message from the chat (the editor's own ASK GHOSTY box always sends it): the tool's words, and a few more for the editor in hand. */
const SEND: Record<WorkKind, RegExp> = {
  slides: WORK_WHEN.slides,
  video: WORK_WHEN.video,
  workspace: new RegExp(`${WORK_WHEN.workspace.source}|\\b(?:pages?|notes?)\\b`, 'i'),
  game: new RegExp(`${WORK_WHEN.game.source}|\\b(?:rooms?|(?:the )?person)\\b`, 'i'),
};
/** What to add after his message: the open editors his words call for, as data, or ''. */
export const openWorkData = (words = ''): string =>
  [...live.entries()].filter(([k]) => SEND[k].test(words)).map(([, l]) => l.data()).join('');
/** [sites] What the open editors must hand over before his words go (never more than a few seconds; a miss is the brain's to say). */
export const readyWork = async (words = ''): Promise<void> => {
  const all = [...live.values()].map((l) => l.ready?.(words));
  await Promise.race([Promise.allSettled(all), new Promise((r) => setTimeout(r, 8000))]);
};
/** The brain's proposal, to the open editor of that kind; the words that say what happened. */
export const proposeToWork = (kind: WorkKind, args: Record<string, unknown>): string =>
  live.get(kind)?.propose(args) ?? 'The brain proposed a change, but that editor is not open here any more.';
/** The event name each kind's tool sends. */
export const EVENT: Record<WorkKind, string> = { slides: 'slides', video: 'videoedit', workspace: 'workspace', game: 'game' };
