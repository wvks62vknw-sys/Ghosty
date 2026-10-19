/**
 * The chess board on its own: the full rules (castling, en passant, promotion, check, checkmate,
 * stalemate, the 50-move rule, threefold repetition, too little material to mate), and no engine. This is
 * what the GYM's page needs to let the owner play, and what the engine (chess.ts) builds on. The move
 * generator is checked by perft counts on the standard test positions (gym2.test.mjs).
 *
 * Inside: a 0x88 board (square = rank × 16 + file, a1 = 0); pieces 1 pawn … 6 king, positive White,
 * negative Black. Outside (the page, problems): squares 0–63, a1 = 0, h8 = 63.
 */
import type { Cell, Frame } from './core';

export const P = 1;
export const N = 2;
export const B = 3;
export const R = 4;
export const Q = 5;
export const K = 6;

/** A move: from and to (0x88), the promotion piece (2–5, 0 if none), and flags (1 capture, 2 en passant, 4 castle, 8 pawn double step). */
export const mv = (from: number, to: number, promo = 0, flags = 0) => from | (to << 7) | (promo << 14) | (flags << 17);
export const mFrom = (m: number) => m & 127;
export const mTo = (m: number) => (m >> 7) & 127;
export const mPromo = (m: number) => (m >> 14) & 7;
export const mFlags = (m: number) => m >> 17;

const KN = [33, 31, 18, 14, -33, -31, -18, -14];
const KG = [1, -1, 16, -16, 17, 15, -17, -15];
const DIAG = [17, 15, -17, -15];
const ORTH = [1, -1, 16, -16];

// Hash keys (two parts, so the key is an exact number).
const ZR = (() => {
  let a = 0x2545f491;
  const r = () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return a >>> 0;
  };
  return Array.from({ length: 13 * 128 + 16 + 128 + 1 }, () => [r(), r() & 0x1fffff] as [number, number]);
})();
const zp = (pc: number, sq: number) => ZR[(pc + 6) * 128 + sq]!;
const zc = (c: number) => ZR[13 * 128 + c]!;
const ze = (sq: number) => ZR[13 * 128 + 16 + sq]!;
const zs = ZR[13 * 128 + 16 + 128]!;

export interface Pos {
  b: Int8Array;
  /** 1 White to move, −1 Black. */
  side: number;
  /** Castling rights: 1 White short, 2 White long, 4 Black short, 8 Black long. */
  castle: number;
  /** En-passant target square (0x88) or −1. */
  ep: number;
  half: number;
  full: number;
  kings: [number, number];
  ha: number;
  hb: number;
  /** Hashes of earlier positions (for repetition). */
  hist: number[];
  undo: number[][];
}

export const sq64 = (s: number) => (s >> 4) * 8 + (s & 7);
export const sq88 = (i: number) => ((i >> 3) << 4) | (i & 7);
export const sqName = (s88: number) => 'abcdefgh'[s88 & 7]! + ((s88 >> 4) + 1);
export const hashOf = (p: Pos) => p.ha + p.hb * 4294967296;

function rehash(p: Pos) {
  let a = 0;
  let b = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88 || !p.b[s]) continue;
    const z = zp(p.b[s]!, s);
    a ^= z[0];
    b ^= z[1];
  }
  const c = zc(p.castle);
  a ^= c[0];
  b ^= c[1];
  if (p.ep >= 0) {
    const e = ze(p.ep);
    a ^= e[0];
    b ^= e[1];
  }
  if (p.side < 0) {
    a ^= zs[0];
    b ^= zs[1];
  }
  p.ha = a >>> 0;
  p.hb = b;
}

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function fromFen(fen: string): Pos {
  const [board, side, castle, ep, half, full] = fen.trim().split(/\s+/) as string[];
  const b = new Int8Array(128);
  const kings: [number, number] = [-1, -1];
  board!.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1;
        const s = ((7 - i) << 4) | f;
        b[s] = ch === ch.toUpperCase() ? t : -t;
        if (t === K) kings[ch === ch.toUpperCase() ? 0 : 1] = s;
        f++;
      }
    }
  });
  let c = 0;
  if (castle?.includes('K')) c |= 1;
  if (castle?.includes('Q')) c |= 2;
  if (castle?.includes('k')) c |= 4;
  if (castle?.includes('q')) c |= 8;
  const e = ep && ep !== '-' ? ((Number(ep[1]) - 1) << 4) | 'abcdefgh'.indexOf(ep[0]!) : -1;
  const p: Pos = { b, side: side === 'b' ? -1 : 1, castle: c, ep: e, half: Number(half ?? 0) || 0, full: Number(full ?? 1) || 1, kings, ha: 0, hb: 0, hist: [], undo: [] };
  rehash(p);
  return p;
}

export function toFen(p: Pos): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let s = '';
    let gap = 0;
    for (let f = 0; f < 8; f++) {
      const x = p.b[(r << 4) | f]!;
      if (!x) {
        gap++;
        continue;
      }
      if (gap) (s += gap), (gap = 0);
      const ch = ' pnbrqk'[Math.abs(x)]!;
      s += x > 0 ? ch.toUpperCase() : ch;
    }
    if (gap) s += gap;
    rows.push(s);
  }
  const c = (p.castle & 1 ? 'K' : '') + (p.castle & 2 ? 'Q' : '') + (p.castle & 4 ? 'k' : '') + (p.castle & 8 ? 'q' : '') || '-';
  return `${rows.join('/')} ${p.side > 0 ? 'w' : 'b'} ${c} ${p.ep >= 0 ? sqName(p.ep) : '-'} ${p.half} ${p.full}`;
}

export const copyPos = (p: Pos): Pos => ({ ...p, b: p.b.slice(), kings: [p.kings[0], p.kings[1]], hist: p.hist.slice(), undo: [] });

/** Is square s attacked by side `by` (1 White, −1 Black)? */
export function attacked(p: Pos, s: number, by: number): boolean {
  const b = p.b;
  // Pawns.
  const pr = by > 0 ? -15 : 15;
  const pl = by > 0 ? -17 : 17;
  let t = s + pr;
  if (!(t & 0x88) && b[t] === by * P) return true;
  t = s + pl;
  if (!(t & 0x88) && b[t] === by * P) return true;
  for (const d of KN) {
    t = s + d;
    if (!(t & 0x88) && b[t] === by * N) return true;
  }
  for (const d of KG) {
    t = s + d;
    if (!(t & 0x88) && b[t] === by * K) return true;
  }
  for (const d of DIAG) {
    for (t = s + d; !(t & 0x88); t += d) {
      const x = b[t]!;
      if (!x) continue;
      if (x === by * B || x === by * Q) return true;
      break;
    }
  }
  for (const d of ORTH) {
    for (t = s + d; !(t & 0x88); t += d) {
      const x = b[t]!;
      if (!x) continue;
      if (x === by * R || x === by * Q) return true;
      break;
    }
  }
  return false;
}

export const inCheck = (p: Pos) => attacked(p, p.kings[p.side > 0 ? 0 : 1], -p.side);

/** Every pseudo-legal move (the king may be left in check; `legal` filters). `capsOnly`: captures and promotions. */
export function pseudo(p: Pos, capsOnly = false): number[] {
  const out: number[] = [];
  const b = p.b;
  const me = p.side;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const x = b[s]! * me;
    if (x <= 0) continue;
    if (x === P) {
      const fwd = me > 0 ? 16 : -16;
      const rank = s >> 4;
      const last = me > 0 ? rank === 6 : rank === 1;
      const home = me > 0 ? rank === 1 : rank === 6;
      const t = s + fwd;
      if (!(t & 0x88) && !b[t]) {
        if (last) for (const pr of [Q, R, B, N]) out.push(mv(s, t, pr));
        else if (!capsOnly) {
          out.push(mv(s, t));
          if (home && !b[t + fwd]) out.push(mv(s, t + fwd, 0, 8));
        }
      }
      for (const side of [-1, 1]) {
        const c = t + side;
        if (c & 0x88) continue;
        if (b[c]! * me < 0) {
          if (last) for (const pr of [Q, R, B, N]) out.push(mv(s, c, pr, 1));
          else out.push(mv(s, c, 0, 1));
        } else if (c === p.ep) out.push(mv(s, c, 0, 3));
      }
      continue;
    }
    if (x === N || x === K) {
      for (const d of x === N ? KN : KG) {
        const t = s + d;
        if (t & 0x88) continue;
        const y = b[t]! * me;
        if (y > 0) continue;
        if (y < 0) out.push(mv(s, t, 0, 1));
        else if (!capsOnly) out.push(mv(s, t));
      }
      if (x === K && !capsOnly) {
        // Castling: rights, empty squares between, and no square the king crosses attacked.
        const home = me > 0 ? 4 : 0x74;
        if (s === home) {
          const short = me > 0 ? 1 : 4;
          const long = me > 0 ? 2 : 8;
          if (p.castle & short && !b[s + 1] && !b[s + 2] && b[s + 3] === me * R && !attacked(p, s, -me) && !attacked(p, s + 1, -me) && !attacked(p, s + 2, -me)) out.push(mv(s, s + 2, 0, 4));
          if (p.castle & long && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === me * R && !attacked(p, s, -me) && !attacked(p, s - 1, -me) && !attacked(p, s - 2, -me)) out.push(mv(s, s - 2, 0, 4));
        }
      }
      continue;
    }
    const dirs = x === B ? DIAG : x === R ? ORTH : KG;
    for (const d of dirs) {
      for (let t = s + d; !(t & 0x88); t += d) {
        const y = b[t]! * me;
        if (y > 0) break;
        if (y < 0) {
          out.push(mv(s, t, 0, 1));
          break;
        }
        if (!capsOnly) out.push(mv(s, t));
      }
    }
  }
  return out;
}

const CASTLE_MASK = (() => {
  const m = new Uint8Array(128).fill(15);
  m[0] = 15 & ~2;
  m[7] = 15 & ~1;
  m[4] = 15 & ~3;
  m[0x70] = 15 & ~8;
  m[0x77] = 15 & ~4;
  m[0x74] = 15 & ~12;
  return m;
})();

function xor(p: Pos, z: [number, number]) {
  p.ha = (p.ha ^ z[0]) >>> 0;
  p.hb ^= z[1];
}

/** Make a move (no legality check). */
export function make(p: Pos, m: number): void {
  const from = mFrom(m);
  const to = mTo(m);
  const fl = mFlags(m);
  const pc = p.b[from]!;
  const cap = fl & 2 ? -pc / Math.abs(pc) : p.b[to]!;
  p.undo.push([m, cap, p.castle, p.ep, p.half, p.ha, p.hb]);
  p.hist.push(hashOf(p));
  xor(p, zc(p.castle));
  if (p.ep >= 0) xor(p, ze(p.ep));
  xor(p, zp(pc, from));
  if (p.b[to]) xor(p, zp(p.b[to]!, to));
  p.b[from] = 0;
  let put = pc;
  const promo = mPromo(m);
  if (promo) put = pc > 0 ? promo : -promo;
  p.b[to] = put;
  xor(p, zp(put, to));
  if (fl & 2) {
    // En passant: the captured pawn is behind the target square.
    const cs = to + (pc > 0 ? -16 : 16);
    xor(p, zp(p.b[cs]!, cs));
    p.b[cs] = 0;
  }
  if (fl & 4) {
    const short = to > from;
    const rf = short ? from + 3 : from - 4;
    const rt = short ? from + 1 : from - 1;
    const rk = p.b[rf]!;
    xor(p, zp(rk, rf));
    xor(p, zp(rk, rt));
    p.b[rt] = rk;
    p.b[rf] = 0;
  }
  if (Math.abs(pc) === K) p.kings[pc > 0 ? 0 : 1] = to;
  p.castle &= CASTLE_MASK[from]! & CASTLE_MASK[to]!;
  p.ep = fl & 8 ? (from + to) >> 1 : -1;
  xor(p, zc(p.castle));
  if (p.ep >= 0) xor(p, ze(p.ep));
  p.half = Math.abs(pc) === P || cap ? 0 : p.half + 1;
  if (p.side < 0) p.full++;
  p.side = -p.side;
  xor(p, zs);
}

export function unmake(p: Pos): void {
  const [m, cap, castle, ep, half, ha, hb] = p.undo.pop()!;
  p.hist.pop();
  const from = mFrom(m!);
  const to = mTo(m!);
  const fl = mFlags(m!);
  p.side = -p.side;
  if (p.side < 0) p.full--;
  let pc = p.b[to]!;
  if (mPromo(m!)) pc = pc > 0 ? P : -P;
  p.b[from] = pc;
  if (fl & 2) {
    p.b[to] = 0;
    p.b[to + (pc > 0 ? -16 : 16)] = cap!;
  } else p.b[to] = cap!;
  if (fl & 4) {
    const short = to > from;
    const rf = short ? from + 3 : from - 4;
    const rt = short ? from + 1 : from - 1;
    p.b[rf] = p.b[rt]!;
    p.b[rt] = 0;
  }
  if (Math.abs(pc) === K) p.kings[pc > 0 ? 0 : 1] = from;
  p.castle = castle!;
  p.ep = ep!;
  p.half = half!;
  p.ha = ha!;
  p.hb = hb!;
}

/** The legal moves. */
export function legal(p: Pos, capsOnly = false): number[] {
  const out: number[] = [];
  for (const m of pseudo(p, capsOnly)) {
    make(p, m);
    if (!attacked(p, p.kings[p.side > 0 ? 1 : 0], p.side)) out.push(m);
    unmake(p);
  }
  return out;
}

/** Positions `depth` moves on (perft): the standard check on a move generator. */
export function perft(p: Pos, depth: number): number {
  if (!depth) return 1;
  let n = 0;
  for (const m of pseudo(p)) {
    make(p, m);
    if (!attacked(p, p.kings[p.side > 0 ? 1 : 0], p.side)) n += depth === 1 ? 1 : perft(p, depth - 1);
    unmake(p);
  }
  return n;
}

/** How many times this position has stood before (same pieces, side, rights and en passant). */
export function repeats(p: Pos): number {
  const h = hashOf(p);
  let n = 0;
  // Only positions since the last capture or pawn move can repeat.
  for (let i = p.hist.length - 2, k = 0; i >= 0 && k < p.half; i -= 2, k += 2) if (p.hist[i] === h) n++;
  return n;
}

/** Neither side can possibly mate: kings alone, or with one minor piece. */
export function tooLittle(p: Pos): boolean {
  let minors = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) continue;
    const x = Math.abs(p.b[s]!);
    if (!x || x === K) continue;
    if (x === N || x === B) minors++;
    else return false;
  }
  return minors <= 1;
}

/** The game's state: 'mate' (side to move is mated), 'stalemate', 'fifty', 'repetition', 'material', or '' (playing on). */
export function status(p: Pos, moves = legal(p)): string {
  if (!moves.length) return inCheck(p) ? 'mate' : 'stalemate';
  if (p.half >= 100) return 'fifty';
  if (repeats(p) >= 2) return 'repetition';
  if (tooLittle(p)) return 'material';
  return '';
}

export const STATUS_WORDS: Record<string, string> = {
  mate: 'checkmate',
  stalemate: 'stalemate — a draw',
  fifty: 'a draw by the 50-move rule',
  repetition: 'a draw by threefold repetition',
  material: 'a draw: too little material to mate',
};

/** A move in long algebraic form for people: e2-e4, e7xe8=Q, O-O. */
export function moveName(p: Pos, m: number): string {
  const fl = mFlags(m);
  if (fl & 4) return mTo(m) > mFrom(m) ? 'O-O' : 'O-O-O';
  const pc = Math.abs(p.b[mFrom(m)]!);
  const pr = mPromo(m);
  return `${pc === P ? '' : ' NBRQK'[pc - 1]!.trim()}${sqName(mFrom(m))}${fl & 1 ? 'x' : '-'}${sqName(mTo(m))}${pr ? `=${' PNBRQ'[pr]}` : ''}`;
}
/** Standard algebraic notation: e4, Nf3, exd5, O-O, e8=Q, Rad1, Qxf7# (check and mate marked). */
export function san(p: Pos, m: number): string {
  const fl = mFlags(m);
  const from = mFrom(m);
  const to = mTo(m);
  const pc = Math.abs(p.b[from]!);
  let s: string;
  if (fl & 4) s = to > from ? 'O-O' : 'O-O-O';
  else if (pc === P) s = `${fl & 1 ? `${sqName(from)[0]}x` : ''}${sqName(to)}${mPromo(m) ? `=${' PNBRQ'[mPromo(m)]}` : ''}`;
  else {
    // Another piece of the same kind that could go there: name the file, the rank, or both.
    const others = legal(p).filter((o) => o !== m && mTo(o) === to && Math.abs(p.b[mFrom(o)]!) === pc && mFrom(o) !== from);
    let dis = '';
    if (others.length) {
      const sameFile = others.some((o) => (mFrom(o) & 7) === (from & 7));
      const sameRank = others.some((o) => mFrom(o) >> 4 === from >> 4);
      dis = !sameFile ? sqName(from)[0]! : !sameRank ? sqName(from)[1]! : sqName(from);
    }
    s = `${' PNBRQK'[pc]}${dis}${fl & 1 ? 'x' : ''}${sqName(to)}`;
  }
  make(p, m);
  const st = inCheck(p) ? (legal(p).length ? '+' : '#') : '';
  unmake(p);
  return s + st;
}

/** UCI form: e2e4, e7e8q. */
export const uci = (m: number) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? ' pnbrq'[mPromo(m)]! : '');

/** The page's view of a position: 64 squares (a1 = 0), side, castling, en passant (0–63 or −1), the 50-move count, the move number, then earlier positions' hashes. */
export function posState(p: Pos): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) out.push(p.b[sq88(i)]!);
  out.push(p.side, p.castle, p.ep >= 0 ? sq64(p.ep) : -1, p.half, p.full, ...p.hist);
  return out;
}
export function posFrom(s: number[]): Pos {
  const b = new Int8Array(128);
  const kings: [number, number] = [-1, -1];
  for (let i = 0; i < 64; i++) {
    const x = s[i] ?? 0;
    b[sq88(i)] = x;
    if (x === K) kings[0] = sq88(i);
    if (x === -K) kings[1] = sq88(i);
  }
  const p: Pos = { b, side: s[64] ?? 1, castle: s[65] ?? 0, ep: (s[66] ?? -1) >= 0 ? sq88(s[66]!) : -1, half: s[67] ?? 0, full: s[68] ?? 1, kings, ha: 0, hb: 0, hist: s.slice(69), undo: [] };
  rehash(p);
  return p;
}
/** The page's move: from + to × 64 + promotion × 4096 (squares 0–63). */
export const pageMove = (m: number) => sq64(mFrom(m)) + sq64(mTo(m)) * 64 + mPromo(m) * 4096;
export const fromPageMove = (p: Pos, x: number) => legal(p).find((m) => pageMove(m) === x) ?? -1;

const GLYPH = ['', '♙', '♘', '♗', '♖', '♕', '♔'];
const GLYPHB = ['', '♟', '♞', '♝', '♜', '♛', '♚'];
/** The board as a picture, White at the bottom. `marks`: cell (0–63, top-left first) → class (sel, tgt, new, chk). */
export function chessFrame(p: Pos, caption: string, marks: Record<number, string> = {}): Frame {
  const cells: Cell[] = [];
  for (let r = 7; r >= 0; r--)
    for (let f = 0; f < 8; f++) {
      const x = p.b[(r << 4) | f]!;
      const cell = (7 - r) * 8 + f;
      // U+FE0E keeps iPhones from drawing the pieces as emoji.
      cells.push({ t: x ? `${(x > 0 ? GLYPH : GLYPHB)[Math.abs(x)]}︎` : '', c: [(r + f) % 2 ? 'lt' : 'dk', x > 0 ? 'wp' : x < 0 ? 'bp' : '', marks[cell] ?? ''].filter(Boolean).join(' ') });
    }
  return { grid: { w: 8, h: 8, cells }, caption };
}
/** Board cell (0–63, top-left first) ↔ square (0–63, a1 = 0). */
export const cellOf = (i: number) => (7 - (i >> 3)) * 8 + (i & 7);
export const sqOfCell = (cell: number) => (7 - (cell >> 3)) * 8 + (cell & 7);

export function posText(p: Pos): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let s = `${r + 1} `;
    for (let f = 0; f < 8; f++) {
      const x = p.b[(r << 4) | f]!;
      s += x ? (x > 0 ? ' PNBRQK'[x]! : ' pnbrqk'[-x]!) : '.';
    }
    rows.push(s);
  }
  rows.push('  abcdefgh');
  return `Chess (FEN ${toFen(p)}). Upper case White, lower case Black:\n${rows.join('\n')}\n${p.side > 0 ? 'White' : 'Black'} to move.`;
}
