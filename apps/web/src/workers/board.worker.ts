/**
 * The board games' Worker: Ghosty's search runs here so the board never freezes while he thinks. One message in
 * ({ id, game, state, level, seed, ms, weights? }), one out ({ id, move, iters, value, depth }); poker and the word game ask the
 * same way with a `kind` (the word game's list is sent once, as `lex`). Nothing is fetched and nothing
 * is kept: the page owns the game.
 */
import { decide, decidePoker, decideWords, setLex, type WorkerMsg } from '../arcade/games/board/engine';
import { sayError } from '../ui/hisWords';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<WorkerMsg>) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.kind === 'lex') {
      setLex(m.bytes);
      ctx.postMessage({ id: m.id, ok: true });
    } else if (m.kind === 'poker') ctx.postMessage({ id: m.id, ...decidePoker(m) });
    else if (m.kind === 'words') ctx.postMessage({ id: m.id, result: decideWords(m) });
    else ctx.postMessage({ id: m.id, ...decide(m) });
  } catch (err) {
    ctx.postMessage({ id: m.id, error: sayError(err, 'think of a move') });
  }
};
