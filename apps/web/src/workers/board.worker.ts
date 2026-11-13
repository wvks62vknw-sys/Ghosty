/**
 * The board games' Worker: Ghosty's search runs here so the board never freezes while he thinks. One message in
 * ({ id, game, state, level, seed, ms, weights? }), one out ({ id, move, iters, value, depth }). Nothing is fetched and nothing
 * is kept: the page owns the game.
 */
import { type AskMsg, decide } from '../arcade/games/board/engine';
import { sayError } from '../ui/hisWords';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<AskMsg>) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const m = e.data;
  try {
    ctx.postMessage({ id: m.id, ...decide(m) });
  } catch (err) {
    ctx.postMessage({ id: m.id, error: sayError(err, 'think of a move') });
  }
};
