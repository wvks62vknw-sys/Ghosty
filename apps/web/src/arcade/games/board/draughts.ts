/**
 * DRAUGHTS (English: 8 × 8, men step one square forward on the diagonal, a capture is compulsory and must be finished, a man
 * that reaches the far row is crowned and the move ends, kings go both ways). The rules are the GYM's own light board file
 * (gym/ckboard.ts); what is new here is Ghosty's hand-written value: material, kings, how far the men have come, the back
 * row, the middle of the board and how many moves each side has.
 */
import { type Ck, type CkMove, ckFrom, ckState, cellOfSq, copyCk, legalCk, playCk, resultCk, startCk } from '../../../gym/ckboard';
import type { BoardGame, Result, Side } from './kit';

export type DraughtsState = Ck;
export type DraughtsMove = CkMove;

const memo = new WeakMap<Ck, CkMove[]>();
const movesOf = (s: Ck): CkMove[] => {
  let m = memo.get(s);
  if (!m) memo.set(s, (m = legalCk(s)));
  return m;
};
/** Black (the first to move, side 1) comes down the board from row 0; White (side 2) up from row 7. */
const sideOf = (s: Ck): Side => (s.side === 1 ? 1 : 2);

function features(s: Ck, side: Side): number[] {
  const mine = side === 1 ? 1 : -1;
  let men = 0;
  let kings = 0;
  let adv = 0;
  let guard = 0;
  let centre = 0;
  for (let i = 0; i < 32; i++) {
    const v = s.b[i]!;
    if (!v) continue;
    const sign = Math.sign(v) === mine ? 1 : -1;
    const row = i >> 2;
    const col = row % 2 === 0 ? 2 * (i & 3) + 1 : 2 * (i & 3);
    if (Math.abs(v) === 2) kings += sign;
    else {
      men += sign;
      const progress = v > 0 ? row : 7 - row;
      adv += sign * (progress / 7);
      if ((v > 0 && row === 0) || (v < 0 && row === 7)) guard += sign;
    }
    if (row >= 2 && row <= 5 && col >= 2 && col <= 5) centre += sign;
  }
  const mob = movesOf(s).length;
  const mobility = s.side === mine ? Math.min(mob, 10) / 10 : -Math.min(mob, 10) / 10;
  return [men / 12, kings / 6, adv / 6, guard / 4, centre / 8, mobility * 0.5];
}

export const draughts: BoardGame<DraughtsState, DraughtsMove> = {
  id: 'draughts',
  name: 'Draughts',
  start: () => startCk(),
  side: sideOf,
  legal: (s) => movesOf(s),
  apply: (s, m) => {
    const p = copyCk(s);
    playCk(p, m);
    return p;
  },
  result: (s): Result => {
    const r = resultCk(s, movesOf(s));
    return r === 0 ? 0 : r === 0.5 ? 3 : r === 1 ? 1 : 2;
  },
  features,
  hand: [2.6, 3.4, 0.9, 0.5, 0.6, 0.5],
  key: (m) => m.path.join('>'),
  from: (m) => cellOfSq(m.path[0]!),
  to: (m) => cellOfSq(m.path[m.path.length - 1]!),
  words: { first: 'Black', second: 'White' },
};
export { ckFrom, ckState };
