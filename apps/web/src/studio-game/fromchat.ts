/**
 * A GAME THE BRAIN BUILT (BRIEF-KERNEL-3 item 4): what the `game` tool's `make` sends. Read back with the studio's own reader and
 * kept in the studio's library (the games on this phone, nowhere else), then the studio opens on it for him to edit and play from
 * the ARCADE. Nothing is published here and nothing leaves the phone.
 */
import { readGame, hardProblems } from './model';
import { putGame } from './store';
import { ask } from './hub';

export async function openMadeGame(args: Record<string, unknown>): Promise<string> {
  const r = readGame(args.game);
  if (!r) return 'The brain sent a game I could not read, so I made nothing.';
  const stop = hardProblems(r.game)[0];
  if (stop) return `The brain’s game would not play yet (${stop.text}), so I made nothing.`;
  const kept = await putGame(r.game);
  ask({ what: 'open', id: r.game.id });
  const { go } = await import('../shell/tabs');
  go('gamestudio');
  return kept.kept ? `“${r.game.name}” is in your studio: edit it there, or play it from the ARCADE.` : `“${r.game.name}” is open in the studio, but this phone is not keeping games (its storage is blocked), so it will be gone when you leave.`;
}
