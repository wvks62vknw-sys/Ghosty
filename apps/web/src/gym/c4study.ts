/**
 * Learning from the owner's Connect 4 games (worker only). After a game the owner won, the exact solver goes
 * back through it: the first of Ghosty's moves it can prove threw the result away (and what would have held),
 * and the owner's winning idea in plain words — a double threat, two threats stacked in one column, a threat on
 * the row the end of the game hands him (odd or even), or a plain four. The network is trained on the
 * positions the solver labelled, and the position where it went wrong goes into his book as a lesson, so the
 * same line is played right next time. While the GYM is idle, `ponder` solves positions from the owner's games a
 * slice at a time, the deepest it can first, and keeps the results in the book.
 */
import { COLS, copyPos, legal, newPos, play, ROWS, turn, wonAt, type Pos } from './c4board';
import { bookKey } from './c4play';
import { bitsOf, parity, scoreMoves, searchAhead, threatSquares, WIN } from './c4solve';

/** What a study found (kept on the phone with the game, and the words said from it). */
export interface Study {
  /** Stones on the board when the owner's winning stone landed (his "move 23"), 0 if the owner did not win. */
  wonAt: number;
  /** The owner's winning idea in words ("a double threat on columns 3 and 5"). */
  idea: string;
  kind: 'double' | 'stacked' | 'odd' | 'even' | 'under' | 'four' | 'none';
  /** Ghosty's first move proved to give the result away: its stone number, the column he played, the columns that held, and what they held (1 win, 0 draw; null: not lost by force, the rest not proved). */
  turn: { at: number; played: number; held: number[]; value: number | null } | null;
  /** Positions the solver labelled (and how many of them the network trained on). */
  labelled: number;
  /** True when every position up to the turning point was solved (so nothing earlier went wrong unseen). */
  complete: boolean;
}

const col = (c: number) => c + 1;
const cols = (cs: number[]) => (cs.length === 1 ? `column ${col(cs[0]!)}` : `columns ${cs.slice(0, -1).map(col).join(', ')} and ${col(cs.at(-1)!)}`);
const ordinal = (n: number) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][n - 1] ?? `${n}th`;

/** Replay a list of columns from the empty board (the positions before each stone). */
function replay(moves: number[]): Pos[] {
  const p = newPos();
  const out: Pos[] = [];
  for (const c of moves) {
    out.push(copyPos(p));
    play(p, c);
  }
  out.push(copyPos(p));
  return out;
}

/** The squares where `who` could make four and that are playable now. */
function playable(p: Pos, who: number): number[] {
  return threatSquares(p.b, who).filter((s) => p.h[Math.floor(s / ROWS)] === s % ROWS);
}

/**
 * The owner's winning idea, from the game's last moves: what Ghosty faced when he could no longer stop it.
 * `owner` is 1 (he moved first) or 2.
 */
export function ideaOf(moves: number[], owner: number): { idea: string; kind: Study['kind']; at: number } {
  const ps = replay(moves);
  const end = ps.at(-1)!;
  const lastC = moves.at(-1)!;
  const lastSq = lastC * ROWS + end.h[lastC]! - 1;
  if (end.b[lastSq] !== owner || !wonAt(end, lastSq)) return { idea: '', kind: 'none', at: 0 };
  const at = moves.length;
  // The position before Ghosty's last move: what did he face?
  const before = ps[moves.length - 2];
  if (before) {
    const threats = playable(before, owner);
    const tcols = [...new Set(threats.map((s) => Math.floor(s / ROWS)))].sort((a, b) => a - b);
    if (tcols.length >= 2) return { idea: `a double threat on ${cols(tcols)}`, kind: 'double', at };
    if (tcols.length === 1) {
      const c = tcols[0]!;
      const all = threatSquares(before.b, owner);
      if (all.includes(c * ROWS + before.h[c]! + 1)) return { idea: `two threats stacked in column ${col(c)}`, kind: 'stacked', at };
    }
    // He had to play under the owner's threat: the winning square sat right above his last stone.
    const gc = moves[moves.length - 2]!;
    if (gc === lastC) {
      const row = lastSq % ROWS + 1;
      // The first player wins the odd rows when the board fills, the second the even rows.
      const good = (row % 2 === 1) === (owner === 1);
      return good
        ? { idea: `the ${row % 2 ? 'odd' : 'even'} threat on the ${ordinal(row)} row of column ${col(lastC)}`, kind: row % 2 ? 'odd' : 'even', at }
        : { idea: `your threat on the ${ordinal(row)} row of column ${col(lastC)}: I played under it`, kind: 'under', at };
    }
  }
  // A plain four (Ghosty missed a single threat).
  return { idea: `four in a row through column ${col(lastC)}`, kind: 'four', at };
}

/** Each column's proved result for the side to move as the book writes it ('W' 'D' 'L', '.' not playable; a lesson may hold '?' for not known), or null if not all were solved. */
export function valuesOf(p: Pos, nodes: number): string | null {
  const sc = scoreMoves(bitsOf(p.b), { nodes }, true);
  let out = '';
  for (let c = 0; c < COLS; c++) {
    if (p.h[c]! >= ROWS) out += '.';
    else if (sc[c] == null) return null;
    else out += sc[c]! > 0 ? 'W' : sc[c]! < 0 ? 'L' : 'D';
  }
  return out;
}
const rank = (ch: string) => (ch === 'W' ? 1 : ch === 'D' ? 0 : ch === 'L' ? -1 : -2);

/**
 * Study one game. `moves`: the columns played, from the empty board; `ghosty`: his side (1 or 2). Positions are
 * solved from the end backwards (the late ones are quick) while each takes at most `perPos` nodes; the
 * results go into `book` and are returned for training. `train(pos, z)` teaches the network that the position's
 * value for the first player is z (−1…1).
 */
export function study(moves: number[], ghosty: number, book: Record<string, string>, train: (p: Pos, z: number) => void, perPos = 3_000_000): Study {
  const owner = ghosty === 1 ? 2 : 1;
  const idea = ideaOf(moves, owner);
  const ps = replay(moves);
  let turnPt: Study['turn'] = null;
  let labelled = 0;
  let complete = true;
  const samples: [Pos, number][] = [];
  for (let k = moves.length - 1; k >= 0; k--) {
    const p = ps[k]!;
    if (turn(p) !== ghosty) continue;
    const v = complete ? valuesOf(p, perPos) : null;
    if (v == null) {
      // Too early to solve outright: the search ahead may still prove his move lost by force while another was not.
      complete = false;
      const ahead = searchAhead(bitsOf(p.b), parity, { nodes: Math.round(perPos / 4) }, 0, 16);
      const vals = ahead.values;
      const played = vals[moves[k]!];
      const held = legal(p).filter((c) => vals[c] != null && vals[c]! > -WIN);
      if (played != null && played < -WIN && held.length) {
        turnPt = { at: k + 1, played: moves[k]!, held, value: null };
        // a lesson: the columns proved to lose are marked, the rest not known yet ('?')
        const v2 = Array.from({ length: COLS }, (_, c) => (p.h[c]! >= ROWS ? '.' : vals[c] != null && vals[c]! < -WIN ? 'L' : vals[c] != null && vals[c]! > WIN ? 'W' : '?')).join('');
        const { key, flipped } = bookKey(p.b);
        book[key] = `${flipped ? [...v2].reverse().join('') : v2}!`;
        for (const c of legal(p)) {
          if (vals[c] == null || vals[c]! > -WIN) continue;
          const q = copyPos(p);
          play(q, c);
          samples.push([q, ghosty === 1 ? -1 : 1]);
        }
      } else if (!held.length) continue;
      else if (played != null && played > -WIN) break; // nothing provable before this
      continue;
    }
    labelled++;
    // what each column leads to, as training: the child's value for the first player
    for (const c of legal(p)) {
      const q = copyPos(p);
      const s = play(q, c);
      if (wonAt(q, s)) continue;
      const r = rank(v[c]!);
      samples.push([q, ghosty === 1 ? r : -r]);
    }
    const best = Math.max(...[...v].map(rank));
    const got = rank(v[moves[k]!]!);
    if (got < best) {
      turnPt = { at: k + 1, played: moves[k]!, held: [...v].map((ch, c) => (rank(ch) === best ? c : -1)).filter((c) => c >= 0), value: best };
      // the position where it went wrong: a lesson (the book plays it right from now on)
      const { key, flipped } = bookKey(p.b);
      book[key] = `${flipped ? [...v].reverse().join('') : v}!`;
    } else if (42 - p.n >= 26) {
      // a deep position solved: worth keeping (the move's own time would not settle it)
      const { key, flipped } = bookKey(p.b);
      book[key] ??= flipped ? [...v].reverse().join('') : v;
    }
  }
  // Train on what the solver proved: several passes, the latest positions too.
  for (let pass = 0; pass < 40; pass++) for (const [q, z] of samples) train(q, z);
  return { wonAt: idea.at, idea: idea.idea, kind: idea.kind, turn: turnPt, labelled: samples.length, complete };
}

/**
 * Idle work: solve, a slice at a time, the positions from the owner's games the book does not hold yet — the
 * ones the move's own time cannot settle (26 empty squares or more), shallowest first, so the book grows
 * towards the opening. Returns the position being worked on, or null when there is nothing left to try.
 */
export class Ponder {
  /** Positions given up on this session (too deep for now). */
  private skip = new Set<string>();
  private cur: { key: string; flipped: boolean; p: Pos; spent: number } | null = null;
  solved = 0;
  constructor(private book: Record<string, string>) {}
  /** The next position to work on from these games (columns from the empty board), or null. */
  next(games: number[][], ghosty = 2): { key: string; flipped: boolean; p: Pos; spent: number } | null {
    let pick: { key: string; flipped: boolean; p: Pos; spent: number } | null = null;
    for (const g of games) {
      const ps = replay(g);
      for (const p of ps) {
        if (turn(p) !== ghosty) continue;
        const e = 42 - p.n;
        if (e < 26 || e > 34) continue;
        const { key, flipped } = bookKey(p.b);
        if (this.book[key] || this.skip.has(key)) continue;
        if (!pick || p.n > pick.p.n) pick = { key, flipped, p, spent: 0 };
      }
    }
    return pick;
  }
  /** Work for about `nodes` positions searched. Returns the key solved, or '' (still working), or null (nothing to do). */
  step(games: number[][], nodes: number, cap = 400_000_000): string | null {
    this.cur ??= this.next(games);
    const cur = this.cur;
    if (!cur) return null;
    const v = valuesOf(cur.p, nodes);
    cur.spent += nodes;
    if (v != null) {
      this.book[cur.key] ??= cur.flipped ? [...v].reverse().join('') : v;
      this.cur = null;
      this.solved++;
      return cur.key;
    }
    if (cur.spent > cap) {
      this.skip.add(cur.key);
      this.cur = null;
    }
    return '';
  }
}

