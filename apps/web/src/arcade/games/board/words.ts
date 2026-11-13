/**
 * WORDS, a word game of our own (not any maker's): a 15 × 15 board with a bonus layout of our own, seven tiles on a rack, a bag
 * of exactly one hundred tiles whose letter counts and points are written in one table (TILES), and no blank tile. A word is
 * placed in one row or one column, joined to the words already there, and EVERY word it makes has to be in the list: nothing
 * is challenged, a made-up word is refused at once ("Not in my list."). The score says its bonuses. The game ends when the bag
 * is empty and a rack is out, or after six turns in a row that scored nothing; what is left on a rack comes off.
 *
 * THE LIST is a public-domain English word list (ENABLE), packed as the app's own minimal DAWG (tools/pack-words.mjs): words
 * only, no definitions and no proper nouns. `Lex` reads the packed file as it is, three bytes an edge.
 *
 * GHOSTY'S PLAY (in the board Worker): every placement from his rack through the list (Appel and Jacobson's anchors and cross-
 * checks on the packed DAWG), each scored; he chooses by score plus the worth of the tiles he keeps (S and the balance of
 * vowels and consonants) minus what the move opens for you (double and triple word squares reached), the weights rising with
 * his level; from level 9 he also deals you racks from the unseen tiles and takes off your best reply to his best few moves,
 * for as many as his thinking time allows. At level 1 he plays short words; at the top he plays the best he finds.
 */
import { rngAt, rngOf } from './kit';

export const N = 15;
export const RACK = 7;
export const BINGO = 40;
const CENTRE = 7 * N + 7;

/** The letters: how many of each in the bag (one hundred in all) and what each is worth. Ours. No blank tiles. */
export const TILES: { ch: string; n: number; pts: number }[] = [
  { ch: 'a', n: 9, pts: 1 }, { ch: 'b', n: 2, pts: 4 }, { ch: 'c', n: 2, pts: 3 }, { ch: 'd', n: 4, pts: 2 }, { ch: 'e', n: 12, pts: 1 },
  { ch: 'f', n: 2, pts: 4 }, { ch: 'g', n: 3, pts: 3 }, { ch: 'h', n: 2, pts: 4 }, { ch: 'i', n: 9, pts: 1 }, { ch: 'j', n: 1, pts: 9 },
  { ch: 'k', n: 1, pts: 5 }, { ch: 'l', n: 4, pts: 2 }, { ch: 'm', n: 2, pts: 3 }, { ch: 'n', n: 6, pts: 1 }, { ch: 'o', n: 8, pts: 1 },
  { ch: 'p', n: 2, pts: 3 }, { ch: 'q', n: 1, pts: 10 }, { ch: 'r', n: 6, pts: 1 }, { ch: 's', n: 6, pts: 1 }, { ch: 't', n: 6, pts: 1 },
  { ch: 'u', n: 4, pts: 2 }, { ch: 'v', n: 2, pts: 5 }, { ch: 'w', n: 2, pts: 4 }, { ch: 'x', n: 1, pts: 8 }, { ch: 'y', n: 2, pts: 4 },
  { ch: 'z', n: 1, pts: 10 },
];
export const PTS = TILES.map((t) => t.pts);
export const letterOf = (l: number): string => TILES[l]!.ch.toUpperCase();
export const indexOf = (ch: string): number => ch.toLowerCase().charCodeAt(0) - 97;
const VOWEL = new Set([0, 4, 8, 14, 20]);

// ---------------------------------------------------------------- the bonus layout, ours

export type Bonus = '' | 'd' | 't' | 'D' | 'T';
/** One eighth of the board, mirrored every way: D double word, T triple word, d double letter, t triple letter. */
const OCT: Record<'D' | 'T' | 'd' | 't', [number, number][]> = {
  T: [[0, 0]],
  D: [[0, 7], [1, 1], [2, 2], [3, 3], [7, 7]],
  t: [[0, 3], [2, 6], [5, 5], [4, 4]],
  d: [[1, 5], [3, 7], [6, 6]],
};
export const LAYOUT: Bonus[] = (() => {
  const g = new Array<Bonus>(N * N).fill('');
  for (const [k, list] of Object.entries(OCT) as ['D' | 'T' | 'd' | 't', [number, number][]][])
    for (const [r, c] of list) for (const [a, b] of [[r, c], [c, r], [N - 1 - r, c], [r, N - 1 - c], [N - 1 - r, N - 1 - c], [c, N - 1 - r], [N - 1 - c, r], [N - 1 - c, N - 1 - r]] as [number, number][]) g[a * N + b] = k;
  return g;
})();
export const BONUS_NAME: Record<string, string> = { d: 'double letter', t: 'triple letter', D: 'double word', T: 'triple word' };

// ---------------------------------------------------------------- the list

/** Where the packed list is served from, where the phone keeps it, and its size in bytes (the size is said before a byte is taken; a test holds it to the file). */
export const LIST_URL = '/data/words-en.dawg';
export const LIST_CACHE = 'ghosty-words-v1';
export const LIST_BYTES = 361_924;
/** 362 KB, 1.2 MB: a size in words. */
export const kbWords = (b: number): string => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
/** Over 300 KB packed, so it is a download on his tap and not part of the app. */
export const BUNDLE_LIMIT = 300_000;
export const LIST_SIZE_LINE = `The word list is a ${kbWords(LIST_BYTES)} download, once, on Wi-Fi.`;

const LAST = 1 << 17;
const EOW = 1 << 18;
export class Lex {
  private b: Uint8Array;
  root: number;
  edges: number;
  words: number;
  constructor(bytes: ArrayBuffer | Uint8Array) {
    this.b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const m = String.fromCharCode(this.b[0]!, this.b[1]!, this.b[2]!, this.b[3]!);
    if (m !== 'GWL1') throw new Error('That is not the word list.');
    const dv = new DataView(this.b.buffer, this.b.byteOffset, this.b.byteLength);
    this.edges = dv.getUint32(4, true);
    this.words = dv.getUint32(8, true);
    this.root = dv.getUint32(12, true);
    if (this.b.length < 16 + this.edges * 3) throw new Error('The word list is cut short.');
  }
  /** An edge's 24 bits: 17 of child, last-of-node, word-ends, 5 of letter. */
  e(i: number): number {
    const o = 16 + i * 3;
    return this.b[o]! | (this.b[o + 1]! << 8) | (this.b[o + 2]! << 16);
  }
  /** The edge for `letter` among a node's edges, or -1 (a node of 0 has none). */
  find(node: number, letter: number): number {
    if (!node) return -1;
    for (let i = node; ; i++) {
      const v = this.e(i);
      const l = v >>> 19;
      if (l === letter) return i;
      if (l > letter || v & LAST) return -1;
    }
  }
  child(i: number): number {
    return this.e(i) & 0x1ffff;
  }
  eow(i: number): boolean {
    return (this.e(i) & EOW) !== 0;
  }
  has(word: string): boolean {
    if (word.length < 2) return false;
    let node = this.root;
    let e = -1;
    for (let i = 0; i < word.length; i++) {
      const l = word.charCodeAt(i) - 97;
      if (l < 0 || l > 25) return false;
      e = this.find(node, l);
      if (e < 0) return false;
      node = this.child(e);
    }
    return this.eow(e);
  }
}

// ---------------------------------------------------------------- the game

export interface WState {
  seed: number;
  board: Int8Array;
  racks: [number[], number[]];
  bag: number[];
  scores: [number, number];
  turn: 0 | 1;
  /** Turns in a row that scored nothing (a pass or a swap). */
  scoreless: number;
  over: boolean;
  /** 0 you, 1 Ghosty, 2 a draw; -1 while it is on. */
  winner: -1 | 0 | 1 | 2;
  ply: number;
  /** Who went out (-1 nobody) and what each lost at the end. */
  out: -1 | 0 | 1;
  left: [number, number];
}
export type Tile = [number, number, number]; // row, column, letter
export type WMove = { t: 'play'; tiles: Tile[] } | { t: 'swap'; letters: number[] } | { t: 'pass' };

const clone = (s: WState): WState => ({ ...s, board: s.board.slice(), racks: [s.racks[0].slice(), s.racks[1].slice()], bag: s.bag.slice(), scores: [s.scores[0], s.scores[1]], left: [s.left[0], s.left[1]] });
const shuffleIn = (a: number[], rnd: () => number): void => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
};
/** A new game: the bag shuffled from the seed, seven tiles each, `first` to move. `bag` cuts the bag down to that many tiles after the racks are dealt (a short game, for a test's sake). */
export function newGame(seed: number, first: 0 | 1 = 0, cut?: number): WState {
  const bag: number[] = [];
  TILES.forEach((t, l) => {
    for (let i = 0; i < t.n; i++) bag.push(l);
  });
  shuffleIn(bag, rngOf(seed));
  const s: WState = { seed, board: new Int8Array(N * N).fill(-1), racks: [[], []], bag, scores: [0, 0], turn: first, scoreless: 0, over: false, winner: -1, ply: 0, out: -1, left: [0, 0] };
  for (let i = 0; i < RACK; i++) for (const p of [0, 1] as const) s.racks[p].push(s.bag.pop()!);
  if (cut !== undefined && cut >= 0) s.bag.length = Math.min(s.bag.length, Math.floor(cut));
  return s;
}
export const boardEmpty = (b: Int8Array): boolean => b[CENTRE] === -1;

export interface Made {
  word: string;
  pts: number;
  bonus: string[];
}
export interface Checked {
  ok: boolean;
  reason?: string;
  score: number;
  words: Made[];
  bingo: boolean;
}
const none = (reason: string): Checked => ({ ok: false, reason, score: 0, words: [], bingo: false });

/** The words a placement makes and what they score (the placement is taken as it is: no rules are checked here). */
export function scorePlay(board: Int8Array, tiles: readonly Tile[]): { score: number; words: Made[]; runs: string[]; bingo: boolean } {
  const put = new Map<number, number>();
  for (const [r, c, l] of tiles) put.set(r * N + c, l);
  const at = (r: number, c: number): number => (r < 0 || c < 0 || r >= N || c >= N ? -1 : (put.get(r * N + c) ?? board[r * N + c]!));
  const seen = new Set<string>();
  const words: Made[] = [];
  const runs: string[] = [];
  let total = 0;
  for (const [r, c] of tiles) {
    for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
      let r0 = r;
      let c0 = c;
      while (at(r0 - dr, c0 - dc) >= 0) (r0 -= dr, (c0 -= dc));
      let r1 = r;
      let c1 = c;
      while (at(r1 + dr, c1 + dc) >= 0) (r1 += dr, (c1 += dc));
      if (r0 === r1 && c0 === c1) continue;
      const key = `${r0},${c0},${dr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let w = '';
      let sum = 0;
      let mult = 1;
      const bonus: string[] = [];
      for (let rr = r0, cc = c0; rr <= r1 && cc <= c1; rr += dr, cc += dc) {
        const l = at(rr, cc);
        w += TILES[l]!.ch;
        let p = PTS[l]!;
        if (put.has(rr * N + cc)) {
          const bn = LAYOUT[rr * N + cc]!;
          if (bn === 'd') (p *= 2, bonus.push(`${letterOf(l)} on a double letter`));
          else if (bn === 't') (p *= 3, bonus.push(`${letterOf(l)} on a triple letter`));
          else if (bn === 'D') (mult *= 2, bonus.push('double word'));
          else if (bn === 'T') (mult *= 3, bonus.push('triple word'));
        }
        sum += p;
      }
      const pts = sum * mult;
      total += pts;
      words.push({ word: w, pts, bonus });
      runs.push(w);
    }
  }
  const bingo = tiles.length === RACK;
  if (bingo) total += BINGO;
  return { score: total, words, runs, bingo };
}

/** Whether a placement is allowed, and what it would score. Every rule, and every word through the list. */
export function checkPlay(board: Int8Array, tiles: readonly Tile[], lex: Lex): Checked {
  if (!tiles.length) return none('Place a tile first.');
  const seenAt = new Set<number>();
  for (const [r, c] of tiles) {
    if (r < 0 || c < 0 || r >= N || c >= N || board[r * N + c]! >= 0 || seenAt.has(r * N + c)) return none('That square is taken.');
    seenAt.add(r * N + c);
  }
  const sameRow = tiles.every((t) => t[0] === tiles[0]![0]);
  const sameCol = tiles.every((t) => t[1] === tiles[0]![1]);
  if (!sameRow && !sameCol) return none('Tiles go in one row or one column.');
  const first = boardEmpty(board);
  // no gaps: between the first and the last, every square is a tile or already there
  if (tiles.length > 1) {
    const lo = sameRow ? Math.min(...tiles.map((t) => t[1])) : Math.min(...tiles.map((t) => t[0]));
    const hi = sameRow ? Math.max(...tiles.map((t) => t[1])) : Math.max(...tiles.map((t) => t[0]));
    for (let k = lo; k <= hi; k++) {
      const r = sameRow ? tiles[0]![0] : k;
      const c = sameRow ? k : tiles[0]![1];
      if (!seenAt.has(r * N + c) && board[r * N + c]! < 0) return none('There is a gap in the word.');
    }
  }
  if (first) {
    if (!seenAt.has(CENTRE)) return none('The first word goes through the star in the middle.');
    if (tiles.length < 2) return none('The first word needs two tiles.');
  } else {
    let joins = false;
    for (const [r, c] of tiles) for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < N && cc < N && board[rr * N + cc]! >= 0) joins = true;
    }
    if (!joins) return none('It has to join a word already there.');
  }
  const sc = scorePlay(board, tiles);
  if (!sc.words.length) return none('That makes no word.');
  for (const w of sc.runs) if (!lex.has(w)) return none('Not in my list.');
  return { ok: true, score: sc.score, words: sc.words, bingo: sc.bingo };
}

/** What one play says, in words: "PLANT 22 (double word)" and a word or two more. */
export function playWords(c: Checked): string {
  const parts = c.words.map((w) => `${w.word.toUpperCase()} ${w.pts}${w.bonus.length ? ` (${w.bonus.join(', ')})` : ''}`);
  return `${parts.join(' · ')}${c.bingo ? ` · all seven tiles, ${BINGO} more` : ''} · ${c.score} points`;
}

const rackWithout = (rack: number[], tiles: readonly Tile[]): number[] | null => {
  const r = rack.slice();
  for (const t of tiles) {
    const i = r.indexOf(t[2]);
    if (i < 0) return null;
    r.splice(i, 1);
  }
  return r;
};
const pts = (rack: readonly number[]): number => rack.reduce((s, l) => s + PTS[l]!, 0);

function finish(s: WState, byGoingOut: boolean): void {
  s.over = true;
  const who = s.turn;
  s.left = [pts(s.racks[0]), pts(s.racks[1])];
  s.scores[0] -= s.left[0];
  s.scores[1] -= s.left[1];
  if (byGoingOut) {
    s.out = who;
    s.scores[who] += s.left[(1 - who) as 0 | 1];
  }
  s.winner = s.scores[0] > s.scores[1] ? 0 : s.scores[0] < s.scores[1] ? 1 : 2;
}
/** The game after a move (a new state; the move must be legal: a play is checked by `checkPlay`, a swap needs seven in the bag). */
export function apply(st: WState, m: WMove): WState {
  const s = clone(st);
  const me = s.turn;
  if (m.t === 'play') {
    const rest = rackWithout(s.racks[me], m.tiles);
    if (!rest) throw new Error('Those tiles are not on the rack.');
    for (const [r, c, l] of m.tiles) s.board[r * N + c] = l;
    s.scores[me] += scorePlay(st.board, m.tiles).score;
    s.racks[me] = rest;
    while (s.racks[me].length < RACK && s.bag.length) s.racks[me].push(s.bag.pop()!);
    s.scoreless = 0;
    s.ply++;
    if (!s.racks[me].length && !s.bag.length) return (finish(s, true), s);
  } else if (m.t === 'swap') {
    if (s.bag.length < RACK) throw new Error('There have to be seven tiles in the bag to swap.');
    const rest = rackWithout(s.racks[me], m.letters.map((l) => [0, 0, l] as Tile));
    if (!rest) throw new Error('Those tiles are not on the rack.');
    const fresh: number[] = [];
    for (let i = 0; i < m.letters.length; i++) fresh.push(s.bag.pop()!);
    s.bag.push(...m.letters);
    shuffleIn(s.bag, rngAt(s.seed, st.ply + 1));
    s.racks[me] = [...rest, ...fresh];
    s.scoreless++;
    s.ply++;
  } else {
    s.scoreless++;
    s.ply++;
  }
  if (s.scoreless >= 6) return (finish(s, false), s);
  s.turn = (1 - me) as 0 | 1;
  return s;
}
/** The tiles nobody has seen from `side`'s point of view: the bag and the other rack. */
export function unseen(s: WState, side: 0 | 1): number[] {
  const left = TILES.map((t) => t.n);
  for (let i = 0; i < N * N; i++) if (s.board[i]! >= 0) left[s.board[i]!]!--;
  for (const l of s.racks[side]) left[l]!--;
  const out: number[] = [];
  left.forEach((n, l) => {
    for (let i = 0; i < n; i++) out.push(l);
  });
  return out;
}

// ---------------------------------------------------------------- every placement

const ALL = (1 << 26) - 1;
export interface Cand {
  tiles: Tile[];
  score: number;
}
/** Every legal placement from a rack, with its score (both directions; the first move through the star). */
export function moves(board: Int8Array, rack: readonly number[], lex: Lex): Cand[] {
  const out: Cand[] = [];
  const first = boardEmpty(board);
  const run = (b: Int8Array, flip: boolean) => {
    const cnt = new Int8Array(26);
    for (const l of rack) cnt[l]!++;
    const cross = new Int32Array(N * N).fill(ALL);
    const anchor = new Uint8Array(N * N);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        if (b[i]! >= 0) continue;
        let up = '';
        let rr = r - 1;
        while (rr >= 0 && b[rr * N + c]! >= 0) up = TILES[b[rr-- * N + c]!]!.ch + up;
        let down = '';
        rr = r + 1;
        while (rr < N && b[rr * N + c]! >= 0) down += TILES[b[rr++ * N + c]!]!.ch;
        const near = up || down || (c > 0 && b[i - 1]! >= 0) || (c < N - 1 && b[i + 1]! >= 0);
        if (near) anchor[i] = 1;
        if (up || down) {
          let mask = 0;
          for (let l = 0; l < 26; l++) if (lex.has(up + TILES[l]!.ch + down)) mask |= 1 << l;
          cross[i] = mask;
        }
      }
    if (first) {
      anchor.fill(0);
      anchor[CENTRE] = 1;
    }
    const emit = (r: number, left: number[], ac: number, right: [number, number][]) => {
      const tiles: Tile[] = [];
      left.forEach((l, k) => tiles.push(flip ? [ac - left.length + k, r, l] : [r, ac - left.length + k, l]));
      for (const [c, l] of right) tiles.push(flip ? [c, r, l] : [r, c, l]);
      out.push({ tiles, score: 0 });
    };
    const extend = (r: number, node: number, complete: boolean, col: number, left: number[], ac: number, right: [number, number][]) => {
      if (col >= N || b[r * N + col]! < 0) {
        if (complete && right.length) emit(r, left, ac, right);
        if (col < N && node) {
          for (let i = node; ; i++) {
            const v = lex.e(i);
            const l = v >>> 19;
            if (cnt[l]! > 0 && (cross[r * N + col]! >> l) & 1) {
              cnt[l]!--;
              right.push([col, l]);
              extend(r, v & 0x1ffff, (v & EOW) !== 0, col + 1, left, ac, right);
              right.pop();
              cnt[l]!++;
            }
            if (v & LAST) break;
          }
        }
      } else {
        const e = lex.find(node, b[r * N + col]!);
        if (e >= 0) extend(r, lex.child(e), lex.eow(e), col + 1, left, ac, right);
      }
    };
    const leftPart = (r: number, node: number, limit: number, left: number[], ac: number) => {
      extend(r, node, false, ac, left, ac, []);
      if (limit > 0 && node) {
        for (let i = node; ; i++) {
          const v = lex.e(i);
          const l = v >>> 19;
          if (cnt[l]! > 0) {
            cnt[l]!--;
            left.push(l);
            leftPart(r, v & 0x1ffff, limit - 1, left, ac);
            left.pop();
            cnt[l]!++;
          }
          if (v & LAST) break;
        }
      }
    };
    for (let r = 0; r < N; r++)
      for (let ac = 0; ac < N; ac++) {
        if (!anchor[r * N + ac]) continue;
        if (ac > 0 && b[r * N + ac - 1]! >= 0) {
          let s0 = ac - 1;
          while (s0 > 0 && b[r * N + s0 - 1]! >= 0) s0--;
          let node = lex.root;
          let ok = true;
          for (let c = s0; c < ac; c++) {
            const e = lex.find(node, b[r * N + c]!);
            if (e < 0) {
              ok = false;
              break;
            }
            node = lex.child(e);
          }
          if (ok) extend(r, node, false, ac, [], ac, []);
        } else {
          let limit = 0;
          for (let c = ac - 1; c >= 0 && b[r * N + c]! < 0 && !anchor[r * N + c]; c--) limit++;
          leftPart(r, lex.root, Math.min(limit, RACK - 1), [], ac);
        }
      }
  };
  run(board, false);
  if (!first) {
    const t = new Int8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) t[c * N + r] = board[r * N + c]!;
    run(t, true);
  }
  // a single tile is the same placement across and down: kept once
  const once = new Set<number>();
  const uniq = out.filter((m) => {
    if (m.tiles.length > 1) return true;
    const k = (m.tiles[0]![0] * N + m.tiles[0]![1]) * 26 + m.tiles[0]![2];
    if (once.has(k)) return false;
    once.add(k);
    return true;
  });
  for (const m of uniq) m.score = scorePlay(board, m.tiles).score;
  return uniq;
}

// ---------------------------------------------------------------- his play

const LEAVE = [0.5, -2, -0.5, 0, 1.5, -2, -2, 0.5, -0.5, -3, -2, 0.5, 0, 0.5, -1, -0.5, -7, 1, 7, 0.5, -3, -5, -3, 3, -1.5, 2];
/** What the tiles he keeps are worth, in points: S and the balance of vowels and consonants, minus duplicates and the awkward. */
export function leaveValue(rack: readonly number[]): number {
  let v = 0;
  const cnt = new Int8Array(26);
  let vowels = 0;
  for (const l of rack) {
    v += LEAVE[l]!;
    if (cnt[l]!++ > 0) v -= 3;
    if (VOWEL.has(l)) vowels++;
  }
  const cons = rack.length - vowels;
  if (rack.length >= 4 && (vowels === 0 || cons === 0)) v -= 6;
  else if (vowels > 4 || cons > 5) v -= 3;
  return v;
}
/** What a move opens for the other side: the double and triple word squares newly next to a tile. */
function opens(board: Int8Array, tiles: readonly Tile[]): number {
  let pen = 0;
  const own = new Set(tiles.map((t) => t[0] * N + t[1]));
  const seen = new Set<number>();
  for (const [r, c] of tiles)
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const i = rr * N + cc;
      if (board[i]! >= 0 || own.has(i) || seen.has(i)) continue;
      seen.add(i);
      const b = LAYOUT[i];
      if (b === 'T') pen += 6;
      else if (b === 'D') pen += 2.5;
    }
  // a word-bonus square within one empty square of a tile in its line is reached too
  for (const [r, c] of tiles)
    for (const [dr, dc] of [[0, 2], [2, 0], [0, -2], [-2, 0]] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const i = rr * N + cc;
      if (board[i]! >= 0 || own.has(i) || seen.has(i)) continue;
      seen.add(i);
      if (LAYOUT[i] === 'T') pen += 3;
    }
  return pen;
}
const gauss = (r: () => number): number => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += r();
  return (s - 3) / 0.7071;
};
export interface WChoice {
  move: WMove;
  /** The best move he found by score alone, for the hint's words, and how many placements he had. */
  score: number;
  count: number;
  /** How many of your racks he dealt to take off your best reply (0 below level 9). */
  replies: number;
}
const mainLength = (c: Cand): number => c.tiles.length;
/**
 * His move. `o.ms` is his thinking time and `o.samples` a count of dealt racks instead (the node tests); at level 1 he plays
 * short words, and the weight he puts on keeping good tiles and on not opening the board rises to its full size by level 10.
 */
export function botPlay(st: WState, level: number, seed: number, lex: Lex, o: { ms?: number; samples?: number } = {}): WChoice {
  const rnd = rngOf(seed);
  const me = st.turn;
  const rack = st.racks[me];
  const all = moves(st.board, rack, lex);
  const swapOk = st.bag.length >= RACK;
  if (!all.length) {
    if (swapOk) {
      // keep the best-looking tiles, put the rest back
      const keep = rack.slice().sort((a, b) => LEAVE[b]! - LEAVE[a]!).slice(0, 3);
      const give = rack.slice();
      for (const k of keep) give.splice(give.indexOf(k), 1);
      return { move: { t: 'swap', letters: give }, score: 0, count: 0, replies: 0 };
    }
    return { move: { t: 'pass' }, score: 0, count: 0, replies: 0 };
  }
  const lam = Math.min(1, 0.1 * level);
  const mu = Math.min(1, 0.1 * level);
  const sigma = Math.max(0, 9 - 1.1 * level);
  let pool = all;
  if (level <= 2) {
    const cap = level === 1 ? 3 : 4;
    const short = all.filter((c) => mainLength(c) <= cap);
    if (short.length) pool = short;
  }
  const val = pool.map((c) => {
    const rest = rackWithout(rack, c.tiles)!;
    return { c, v: c.score + lam * leaveValue(rest) - mu * opens(st.board, c.tiles) + (sigma ? gauss(rnd) * sigma : 0), rest };
  });
  val.sort((a, b) => b.v - a.v);
  let best = val[0]!;
  let replies = 0;
  const bestScore = Math.max(...all.map((c) => c.score));
  if (level >= 9 && val.length > 1) {
    // his best few, each against racks dealt to you from what he has not seen
    const k = Math.min(val.length, 4 + Math.min(level, 20));
    const top = val.slice(0, k);
    const sums = new Array<number>(k).fill(0);
    const counts = new Array<number>(k).fill(0);
    const until = o.ms ? Date.now() + o.ms * 0.7 : Infinity;
    const rounds = o.samples ?? 24;
    const hidden = unseen(st, me);
    for (let round = 0; round < rounds && (round < 2 || Date.now() < until); round++) {
      const h = hidden.slice();
      shuffleIn(h, rnd);
      const theirs = h.slice(0, RACK);
      for (let i = 0; i < k; i++) {
        const b2 = st.board.slice();
        for (const [r, c, l] of top[i]!.c.tiles) b2[r * N + c] = l;
        const reply = moves(b2, theirs, lex);
        let m = 0;
        for (const x of reply) if (x.score > m) m = x.score;
        sums[i]! += m;
        counts[i]!++;
      }
      replies++;
    }
    const rho = Math.min(1, 0.5 + 0.05 * (level - 8));
    let bv = -Infinity;
    for (let i = 0; i < k; i++) {
      const v = top[i]!.v - rho * (sums[i]! / Math.max(1, counts[i]!));
      if (v > bv) ((bv = v), (best = top[i]!));
    }
  }
  // at a poor best, a higher level changes tiles when it can
  if (level >= 6 && swapOk && best.c.score < 8 && leaveValue(rack) < -2) {
    const keep = rack.slice().sort((a, b) => LEAVE[b]! - LEAVE[a]!).slice(0, 3);
    const give = rack.slice();
    for (const x of keep) give.splice(give.indexOf(x), 1);
    return { move: { t: 'swap', letters: give }, score: bestScore, count: all.length, replies };
  }
  return { move: { t: 'play', tiles: best.c.tiles }, score: bestScore, count: all.length, replies };
}

/** The hint for you: the best placement by score alone, with the words it makes. */
export function bestFor(st: WState, side: 0 | 1, lex: Lex): { tiles: Tile[]; score: number } | null {
  const all = moves(st.board, st.racks[side], lex);
  let best: Cand | null = null;
  for (const c of all) if (!best || c.score > best.score) best = c;
  return best ? { tiles: best.tiles, score: best.score } : null;
}
