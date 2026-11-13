/**
 * Two small things the board games, poker and the word game share about keeping a game: a TAKE BACK that takes back a whole
 * turn, and a save that will not read being said instead of quietly becoming a new game. Pure, so a node test holds them.
 */

/** A position to go back to: the state before the first move of one of your turns, and how many moves had been played. */
export interface Undo {
  s: unknown;
  n: number;
  turn: number;
}
/**
 * What identifies one of your turns: in backgammon a turn is several dice (the move counter of the state, which only moves on
 * when the dice change hands), anywhere else every move is a turn of its own.
 */
export const turnKey = (id: string, state: unknown, moves: number): number => (id === 'backgammon' ? (state as { ply: number }).ply : moves);
/** Remember the position before one of your moves, unless an earlier move of the same turn is already remembered: one take-back takes the whole turn. */
export function pushUndo(undos: Undo[], before: unknown, moves: number, turn: number): void {
  if (undos.length && undos[undos.length - 1]!.turn === turn) return;
  undos.push({ s: before, n: moves, turn });
}

export const DAMAGED_SAVE = 'That save was damaged, so this is a new game.';
/**
 * A saved game read back. `ok` says whether what was parsed has the shape of a save. A save that is not there is not damaged;
 * one that is there and will not read (not JSON, not a save, cut short) is, and the caller says so and clears it.
 */
export function readSave<T>(bytes: Uint8Array | ArrayBuffer | null | undefined, ok: (x: unknown) => boolean): { saved: T | null; damaged: boolean } {
  if (!bytes || ('byteLength' in bytes && bytes.byteLength === 0)) return { saved: null, damaged: !!bytes };
  try {
    const x = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return ok(x) ? { saved: x as T, damaged: false } : { saved: null, damaged: true };
  } catch {
    return { saved: null, damaged: true };
  }
}
