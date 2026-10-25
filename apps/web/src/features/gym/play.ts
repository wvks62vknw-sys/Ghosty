/**
 * PLAY HIM on the bigger boards (checkers, chess, Go): the rules come from the light board files (no
 * engine — his moves come from the worker). Each board here says how a game starts, how a tap works
 * (pick a piece: its legal squares light up; tap one to move; a pawn reaching the end asks what it
 * becomes; Go: tap a point, or PASS), how his move is applied, and when the game is over.
 */
import { ckFrame, ckFrom, ckState, legalCk, moveText, playCk, resultCk, sqOfCell as ckSqOfCell, startCk } from '../../gym/ckboard';
import { cellOf, chessFrame, fromFen, fromPageMove, inCheck, legal, make, mFrom, mPromo, mTo, pageMove, posFrom, posState, san, sq64, sqOfCell, START, status, STATUS_WORDS } from '../../gym/chessboard';
import type { Frame } from '../../gym/core';
import { goFrame, goFrom, goState, inner, KOMI, legalAt, margin, newGo, over, pass, playAt, ptName } from '../../gym/goboard';

/** What the owner has picked so far: a checkers path (squares), a chess square (and, for a promotion, the target), or nothing. */
export interface Sel {
  path: number[];
  promo?: number;
}

export interface Tap {
  /** The new board after the owner's move (then he answers), or unchanged. */
  state?: number[];
  sel: Sel;
  caption?: string;
  /** Choices to offer (a promotion): label → page move code. */
  choices?: [string, number][];
}

export interface BoardPlay {
  start(): number[];
  frame(state: number[], sel: Sel, caption: string, last?: number[]): Frame;
  tap(state: number[], sel: Sel, cell: number): Tap;
  /** Apply a move code (his, or a chosen promotion); returns the new board and words for it. */
  apply(state: number[], move: number): { state: number[]; said: string; cells: number[] };
  /** '' while playing; otherwise the result ("You win.", "I win.", "A draw."). */
  over(state: number[]): string;
  /** Extra button (Go: PASS): its label and the move code it plays. */
  extra?: { label: string; move: number };
  hello: string;
}

const ownerWins = (w: boolean | null) => (w == null ? 'A draw.' : w ? 'You win.' : 'I win.');

// ---- checkers: the owner is Black (moves first, down the board) -----------------------------------------------------

const checkers: BoardPlay = {
  hello: 'Your move: you are Black (cyan) and move down the board. Captures are compulsory.',
  start: () => ckState(startCk()),
  frame(state, sel, caption, last = []) {
    const p = ckFrom(state);
    const marks: Record<number, string> = {};
    for (const s of last) marks[s] = 'new';
    if (sel.path.length) {
      marks[sel.path[sel.path.length - 1]!] = 'sel';
      for (const m of legalCk(p)) if (sel.path.every((s, i) => m.path[i] === s) && m.path.length > sel.path.length) marks[m.path[sel.path.length]!] = 'tgt';
    }
    // The checkers frame marks by square; the picture's cells follow.
    return ckFrame(p, caption, marks);
  },
  tap(state, sel, cell) {
    const p = ckFrom(state);
    const sq = ckSqOfCell(cell);
    if (sq < 0 || p.side !== 1) return { sel };
    const moves = legalCk(p);
    const ext = sel.path.length ? moves.filter((m) => sel.path.every((s, i) => m.path[i] === s) && m.path[sel.path.length] === sq) : [];
    if (ext.length) {
      const path = [...sel.path, sq];
      const done = ext.find((m) => m.path.length === path.length);
      if (done && ext.length === 1) {
        playCk(p, done);
        return { state: ckState(p), sel: { path: [] }, caption: `You played ${moveText(done)}.` };
      }
      return { sel: { path }, caption: 'Keep jumping: tap the next square.' };
    }
    if (moves.some((m) => m.path[0] === sq)) return { sel: { path: [sq] }, caption: 'Tap where it goes.' };
    return { sel: { path: [] }, caption: moves.some((m) => m.caps.length) ? 'You must capture: pick a piece that can jump.' : 'Pick one of your pieces that can move.' };
  },
  apply(state, move) {
    const p = ckFrom(state);
    const m = legalCk(p)[move];
    if (!m) return { state, said: '', cells: [] };
    playCk(p, m);
    return { state: ckState(p), said: moveText(m), cells: m.path };
  },
  over(state) {
    const r = resultCk(ckFrom(state));
    return r === 0 ? '' : r === 0.5 ? 'A draw (40 moves each with no capture).' : ownerWins(r === 1);
  },
};

// ---- chess: the owner is White -------------------------------------------------------------------------------------

const chess: BoardPlay = {
  hello: 'Your move: you are White. Tap a piece, then where it goes.',
  start: () => posState(fromFen(START)),
  frame(state, sel, caption, last = []) {
    const p = posFrom(state);
    const marks: Record<number, string> = {};
    for (const s of last) marks[cellOf(s)] = 'new';
    if (inCheck(p)) marks[cellOf(sq64(p.kings[p.side > 0 ? 0 : 1]))] = 'chk';
    if (sel.path.length) {
      const from = sel.path[0]!;
      marks[cellOf(from)] = 'sel';
      for (const m of legal(p)) if (sq64(mFrom(m)) === from) marks[cellOf(sq64(mTo(m)))] = 'tgt';
    }
    return chessFrame(p, caption, marks);
  },
  tap(state, sel, cell) {
    const p = posFrom(state);
    if (p.side !== 1) return { sel };
    const sq = sqOfCell(cell);
    const moves = legal(p);
    if (sel.path.length) {
      const from = sel.path[0]!;
      const to = moves.filter((m) => sq64(mFrom(m)) === from && sq64(mTo(m)) === sq);
      if (to.length > 1) {
        // A pawn reaching the last rank: the owner picks what it becomes.
        return { sel, caption: 'Your pawn is promoted: pick a piece.', choices: to.map((m) => [['', '', 'KNIGHT', 'BISHOP', 'ROOK', 'QUEEN'][mPromo(m)]!, pageMove(m)] as [string, number]).reverse() };
      }
      if (to.length === 1) {
        const said = san(p, to[0]!);
        make(p, to[0]!);
        return { state: posState(p), sel: { path: [] }, caption: `You played ${said}.` };
      }
    }
    if (moves.some((m) => sq64(mFrom(m)) === sq)) return { sel: { path: [sq] }, caption: 'Tap where it goes.' };
    return { sel: { path: [] }, caption: inCheck(p) ? 'You are in check: pick a move that gets out of it.' : 'Pick one of your pieces that can move.' };
  },
  apply(state, move) {
    const p = posFrom(state);
    const m = fromPageMove(p, move);
    if (m < 0) return { state, said: '', cells: [] };
    const said = san(p, m);
    make(p, m);
    return { state: posState(p), said, cells: [sq64(mFrom(m)), sq64(mTo(m))] };
  },
  over(state) {
    const p = posFrom(state);
    const st = status(p);
    if (!st) return '';
    if (st === 'mate') return `Checkmate — ${ownerWins(p.side < 0)}`;
    return `${STATUS_WORDS[st]![0]!.toUpperCase()}${STATUS_WORDS[st]!.slice(1)}.`;
  },
};

// ---- Go: the owner is Black ------------------------------------------------------------------------------------------

const go: BoardPlay = {
  hello: `Your move: you are Black. Tap a point; PASS when you are done (two passes end the game; area scoring, komi ${KOMI}).`,
  start: () => goState(newGo(9)),
  frame(state, _sel, caption, last = []) {
    const g = goFrom(state);
    const marks: Record<number, string> = {};
    // On the owner's turn, every point he may play is marked.
    if (g.side === 1 && !over(g)) for (let pt = 0; pt < g.n * g.n; pt++) if (legalAt(g, inner(g, pt))) marks[pt] = 'tgt';
    for (const s of last) marks[s] = 'new';
    return goFrame(g, caption, marks);
  },
  tap(state, sel, cell) {
    const g = goFrom(state);
    if (g.side !== 1 || over(g)) return { sel };
    const i = inner(g, cell);
    if (!legalAt(g, i)) return { sel, caption: g.b[i] ? 'That point is taken.' : i === g.ko ? 'Ko: you cannot take back at once — play elsewhere first.' : 'That would be suicide: not allowed.' };
    playAt(g, i);
    return { state: goState(g), sel, caption: `You played ${ptName(g, cell)}.` };
  },
  apply(state, move) {
    const g = goFrom(state);
    if (move < 0) {
      pass(g);
      return { state: goState(g), said: 'pass', cells: [] };
    }
    if (!playAt(g, inner(g, move))) return { state, said: '', cells: [] };
    return { state: goState(g), said: ptName(g, move), cells: [move] };
  },
  over(state) {
    const g = goFrom(state);
    if (!over(g)) return '';
    const m = margin(g);
    return `Game over: ${m > 0 ? 'Black' : m < 0 ? 'White' : 'nobody'}${m ? ` by ${Math.abs(m)}` : ' — a draw'} (area, komi ${KOMI}). ${ownerWins(m === 0 ? null : m > 0)}`;
  },
  extra: { label: 'PASS', move: -1 },
};

export const BOARDS: Record<string, BoardPlay> = { checkers, chess, go };

