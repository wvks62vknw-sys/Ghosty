/**
 * The Go board on its own (any size; the GYM plays 9×9, its puzzles are smaller): stones, captures,
 * suicide (illegal), simple ko (no retaking a single stone at once), passing, and area scoring (stones
 * plus empty points surrounded by one colour only; komi 7 for White). No engine here: this is what the
 * GYM's page needs to let the owner play, and what the engine (go.ts) builds on.
 *
 * Inside: an (n+2)² array with a border (3); points are numbered row by row from the top-left, 0 … n²−1,
 * outside. Stones: 1 Black, 2 White. Black plays first.
 */
import type { Cell, Frame } from './core';

export interface Go {
  n: number;
  /** (n+2)² cells: 0 empty, 1 Black, 2 White, 3 off the board. */
  b: Int8Array;
  /** 1 Black to move, 2 White. */
  side: number;
  /** The point that may not be played now (simple ko), as an inner index, or −1. */
  ko: number;
  /** Passes in a row (two end the game). */
  passes: number;
  moves: number;
  /** Stones each side has captured. */
  caps: [number, number];
}

export const KOMI = 7;
export const inner = (g: Go, pt: number) => (Math.floor(pt / g.n) + 1) * (g.n + 2) + (pt % g.n) + 1;
export const outer = (g: Go, i: number) => (Math.floor(i / (g.n + 2)) - 1) * g.n + ((i % (g.n + 2)) - 1);

export function newGo(n = 9): Go {
  const W = n + 2;
  const b = new Int8Array(W * W).fill(3);
  for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) b[r * W + c] = 0;
  return { n, b, side: 1, ko: -1, passes: 0, moves: 0, caps: [0, 0] };
}
export const copyGo = (g: Go): Go => ({ ...g, b: g.b.slice(), caps: [g.caps[0], g.caps[1]] });

const nbrs = (g: Go, i: number) => [i - 1, i + 1, i - g.n - 2, i + g.n + 2];

/** The stones of the group at i and how many liberties it has (flood fill). */
export function group(g: Go, i: number, stamp?: Uint8Array): { stones: number[]; libs: number } {
  const c = g.b[i]!;
  const seen = stamp ?? new Uint8Array(g.b.length);
  const libSeen = new Uint8Array(g.b.length);
  const stones = [i];
  seen[i] = 1;
  let libs = 0;
  for (let k = 0; k < stones.length; k++) {
    for (const j of nbrs(g, stones[k]!)) {
      const x = g.b[j]!;
      if (x === 0) {
        if (!libSeen[j]) (libSeen[j] = 1), libs++;
      } else if (x === c && !seen[j]) (seen[j] = 1), stones.push(j);
    }
  }
  return { stones, libs };
}

/** Is i an eye of colour c: all four neighbours c (or the edge), and the diagonals mostly c too. Filling one's own eye is never useful. */
export function isEye(g: Go, i: number, c: number): boolean {
  if (g.b[i] !== 0) return false;
  for (const j of nbrs(g, i)) if (g.b[j] !== c && g.b[j] !== 3) return false;
  const W = g.n + 2;
  let bad = 0;
  let edge = 0;
  for (const j of [i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
    const x = g.b[j]!;
    if (x === 3) edge = 1;
    else if (x !== c && x !== 0) bad++;
  }
  return bad + edge < 2;
}

/** Play at inner index i for the side to move; false (and nothing changes) if illegal. */
export function playAt(g: Go, i: number): boolean {
  if (g.b[i] !== 0 || i === g.ko) return false;
  const me = g.side;
  const opp = 3 - me;
  g.b[i] = me;
  let taken = 0;
  let lastTaken = -1;
  for (const j of nbrs(g, i)) {
    if (g.b[j] !== opp) continue;
    const gr = group(g, j);
    if (gr.libs === 0) {
      for (const s of gr.stones) g.b[s] = 0;
      taken += gr.stones.length;
      lastTaken = j;
    }
  }
  const mine = group(g, i);
  if (mine.libs === 0) {
    // Suicide: not allowed.
    g.b[i] = 0;
    return false;
  }
  g.ko = taken === 1 && mine.stones.length === 1 && mine.libs === 1 ? lastTaken : -1;
  g.caps[me - 1] = g.caps[me - 1]! + taken;
  g.side = opp;
  g.passes = 0;
  g.moves++;
  return true;
}
export function pass(g: Go): void {
  g.side = 3 - g.side;
  g.ko = -1;
  g.passes++;
  g.moves++;
}
/** Would a move at i be legal (without changing the position)? */
export function legalAt(g: Go, i: number): boolean {
  if (g.b[i] !== 0 || i === g.ko) return false;
  for (const j of nbrs(g, i)) if (g.b[j] === 0) return true;
  const c = copyGo(g);
  return playAt(c, i);
}
/** Every legal point (inner indices). */
export function legalPoints(g: Go): number[] {
  const out: number[] = [];
  const W = g.n + 2;
  for (let r = 1; r <= g.n; r++) for (let c = 1; c <= g.n; c++) if (legalAt(g, r * W + c)) out.push(r * W + c);
  return out;
}
export const over = (g: Go) => g.passes >= 2;

/** Area score: Black's stones and territory minus White's (komi not included), and who owns each point (1, 2, or 0 for neither). */
export function area(g: Go): { diff: number; owner: Int8Array } {
  const owner = new Int8Array(g.b.length);
  const seen = new Uint8Array(g.b.length);
  let diff = 0;
  for (let i = 0; i < g.b.length; i++) {
    const x = g.b[i]!;
    if (x === 1 || x === 2) {
      owner[i] = x;
      diff += x === 1 ? 1 : -1;
    }
  }
  for (let i = 0; i < g.b.length; i++) {
    if (g.b[i] !== 0 || seen[i]) continue;
    const region = [i];
    seen[i] = 1;
    let touch = 0;
    for (let k = 0; k < region.length; k++) {
      for (const j of nbrs(g, region[k]!)) {
        const x = g.b[j]!;
        if (x === 0 && !seen[j]) (seen[j] = 1), region.push(j);
        else if (x === 1 || x === 2) touch |= x;
      }
    }
    if (touch === 1 || touch === 2) {
      for (const j of region) owner[j] = touch;
      diff += touch === 1 ? region.length : -region.length;
    }
  }
  return { diff, owner };
}
/** The result with komi: Black's score minus White's (positive: Black wins; 0: a draw). */
export const margin = (g: Go) => area(g).diff - (g.n >= 9 ? KOMI : 0);

const COLS = 'ABCDEFGHJ';
export const ptName = (g: Go, pt: number) => (pt < 0 ? 'pass' : `${COLS[pt % g.n]}${g.n - Math.floor(pt / g.n)}`);

export function goText(g: Go): string {
  const rows: string[] = [];
  const W = g.n + 2;
  for (let r = 1; r <= g.n; r++) {
    let s = `${String(g.n - r + 1).padStart(2)} `;
    for (let c = 1; c <= g.n; c++) s += '.XO'[g.b[r * W + c]!]!;
    rows.push(s);
  }
  rows.push(`   ${COLS.slice(0, g.n)}`);
  return `Go ${g.n}×${g.n} (X Black, O White, area scoring${g.n >= 9 ? `, komi ${KOMI}` : ''}; columns A–${COLS[g.n - 1]} skip I):\n${rows.join('\n')}\n${g.side === 1 ? 'Black (X)' : 'White (O)'} to play.`;
}

/** The page's board: n, then the (n+2)² cells, side, ko, passes, moves. */
export const goState = (g: Go): number[] => [g.n, ...g.b, g.side, g.ko, g.passes, g.moves];
export function goFrom(s: number[]): Go {
  const n = s[0] ?? 9;
  const L = (n + 2) * (n + 2);
  return { n, b: Int8Array.from(s.slice(1, 1 + L)), side: s[1 + L] ?? 1, ko: s[2 + L] ?? -1, passes: s[3 + L] ?? 0, moves: s[4 + L] ?? 0, caps: [0, 0] };
}

/** The board as a picture: stones, the last move, and `marks` (point → class: tgt for legal points, own-b / own-w for territory). */
export function goFrame(g: Go, caption: string, marks: Record<number, string> = {}): Frame {
  const cells: Cell[] = [];
  const W = g.n + 2;
  for (let r = 1; r <= g.n; r++)
    for (let c = 1; c <= g.n; c++) {
      const pt = (r - 1) * g.n + (c - 1);
      const x = g.b[r * W + c]!;
      cells.push({ c: ['gob', x === 1 ? 'bs' : x === 2 ? 'ws' : '', marks[pt] ?? ''].filter(Boolean).join(' ') });
    }
  return { grid: { w: g.n, h: g.n, cells }, caption };
}
