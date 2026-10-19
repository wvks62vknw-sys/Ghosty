/**
 * A fast board for play-outs only (9×9 and smaller): groups kept as linked lists with pseudo-liberties
 * (count, sum and sum of squares of liberty points), so captures and atari are found without flood fills.
 * Same rules as goboard.ts: captures, no suicide, simple ko, area scoring.
 */
import type { Go } from './goboard';

export class Fast {
  n = 9;
  W = 11;
  size = 121;
  col = new Int8Array(441);
  head = new Int16Array(441);
  next = new Int16Array(441);
  pl = new Int32Array(441);
  ls = new Int32Array(441);
  ls2 = new Float64Array(441);
  gsize = new Int16Array(441);
  side = 1;
  ko = -1;
  passes = 0;
  moves = 0;
  empties = new Int16Array(441);
  epos = new Int16Array(441);
  ne = 0;
  dirs = [0, 0, 0, 0];

  load(g: Go): this {
    const n = g.n;
    const W = n + 2;
    this.n = n;
    this.W = W;
    this.size = W * W;
    this.dirs = [-1, 1, -W, W];
    this.side = g.side;
    this.ko = g.ko;
    this.passes = g.passes;
    this.moves = g.moves;
    this.ne = 0;
    for (let i = 0; i < this.size; i++) {
      this.col[i] = g.b[i]!;
      this.head[i] = -1;
      if (g.b[i] === 0) this.addEmpty(i);
    }
    for (let i = 0; i < this.size; i++) {
      const c = this.col[i]!;
      if ((c !== 1 && c !== 2) || this.head[i]! >= 0) continue;
      // Flood the group, link it, count pseudo-liberties.
      const st = [i];
      this.head[i] = i;
      let pl = 0;
      let ls = 0;
      let ls2 = 0;
      for (let k = 0; k < st.length; k++) {
        const s = st[k]!;
        for (const d of this.dirs) {
          const j = s + d;
          const x = this.col[j]!;
          if (x === 0) (pl++, (ls += j), (ls2 += j * j));
          else if (x === c && this.head[j]! < 0) (this.head[j] = i), st.push(j);
        }
      }
      for (let k = 0; k < st.length; k++) this.next[st[k]!] = st[(k + 1) % st.length]!;
      this.pl[i] = pl;
      this.ls[i] = ls;
      this.ls2[i] = ls2;
      this.gsize[i] = st.length;
    }
    return this;
  }
  /** Become a copy of another fast board. */
  copyFrom(o: Fast): this {
    this.n = o.n;
    this.W = o.W;
    this.size = o.size;
    this.dirs = o.dirs;
    this.side = o.side;
    this.ko = o.ko;
    this.passes = o.passes;
    this.moves = o.moves;
    this.ne = o.ne;
    const n = o.size;
    this.col.set(o.col.subarray(0, n));
    this.head.set(o.head.subarray(0, n));
    this.next.set(o.next.subarray(0, n));
    this.pl.set(o.pl.subarray(0, n));
    this.ls.set(o.ls.subarray(0, n));
    this.ls2.set(o.ls2.subarray(0, n));
    this.gsize.set(o.gsize.subarray(0, n));
    this.empties.set(o.empties.subarray(0, o.ne));
    this.epos.set(o.epos.subarray(0, n));
    return this;
  }
  /** Legal points that do not fill the mover's own eye, in board order; [−1] (a pass) when there are none. */
  candidates(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.size; i++) if (this.col[i] === 0 && !this.isEye(i, this.side) && this.legal(i)) out.push(i);
    return out.length ? out : [-1];
  }
  /** Play a candidate (−1 = pass). */
  move(i: number): void {
    if (i < 0) this.pass();
    else this.play(i);
  }
  private addEmpty(i: number) {
    this.epos[i] = this.ne;
    this.empties[this.ne++] = i;
  }
  private delEmpty(i: number) {
    const k = this.epos[i]!;
    const last = this.empties[--this.ne]!;
    this.empties[k] = last;
    this.epos[last] = k;
  }
  /** The single liberty of the group with head h, or −1 if it has more (or none). */
  atariLib(h: number): number {
    const pl = this.pl[h]!;
    if (pl <= 0) return -1;
    const ls = this.ls[h]!;
    return ls * ls === pl * this.ls2[h]! ? ls / pl : -1;
  }
  isEye(i: number, c: number): boolean {
    const col = this.col;
    const W = this.W;
    for (const d of this.dirs) {
      const x = col[i + d]!;
      if (x !== c && x !== 3) return false;
    }
    let bad = 0;
    let edge = 0;
    for (const j of [i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
      const x = col[j]!;
      if (x === 3) edge = 1;
      else if (x !== c && x !== 0) bad++;
    }
    return bad + edge < 2;
  }
  legal(i: number): boolean {
    if (this.col[i] !== 0 || i === this.ko) return false;
    const me = this.side;
    for (const d of this.dirs) {
      const j = i + d;
      const x = this.col[j]!;
      if (x === 0) return true;
      if (x === 3) continue;
      const h = this.head[j]!;
      const lib = this.atariLib(h);
      if (x === me) {
        if (lib !== i) return true; // a friendly group with another liberty
      } else if (lib === i) return true; // captures
    }
    return false;
  }
  /** Play a legal move at i (check legal() first). */
  play(i: number): void {
    const me = this.side;
    const opp = 3 - me;
    const col = this.col;
    this.delEmpty(i);
    col[i] = me;
    // The point is no longer a liberty of its neighbours' groups.
    for (const d of this.dirs) {
      const j = i + d;
      const x = col[j]!;
      if (x === 1 || x === 2) {
        const h = this.head[j]!;
        this.pl[h]!--;
        this.ls[h]! -= i;
        this.ls2[h]! -= i * i;
      }
    }
    // A group of one.
    this.head[i] = i;
    this.next[i] = i;
    this.gsize[i] = 1;
    let pl = 0;
    let ls = 0;
    let ls2 = 0;
    for (const d of this.dirs) {
      const j = i + d;
      if (col[j] === 0) (pl++, (ls += j), (ls2 += j * j));
    }
    this.pl[i] = pl;
    this.ls[i] = ls;
    this.ls2[i] = ls2;
    // Merge with friends.
    let h = i;
    for (const d of this.dirs) {
      const j = i + d;
      if (col[j] !== me) continue;
      const hj = this.head[j]!;
      if (hj === h) continue;
      h = this.merge(h, hj);
    }
    // Captures.
    let taken = 0;
    let lastTaken = -1;
    for (const d of this.dirs) {
      const j = i + d;
      if (col[j] !== opp) continue;
      const hj = this.head[j]!;
      if (this.pl[hj] === 0) {
        taken += this.gsize[hj]!;
        lastTaken = j;
        this.remove(hj);
      }
    }
    const hh = this.head[i]!;
    this.ko = taken === 1 && this.gsize[hh] === 1 && this.atariLib(hh) >= 0 ? lastTaken : -1;
    this.side = opp;
    this.passes = 0;
    this.moves++;
  }
  pass() {
    this.side = 3 - this.side;
    this.ko = -1;
    this.passes++;
    this.moves++;
  }
  private merge(a: number, b: number): number {
    // Keep the bigger group's head.
    if (this.gsize[a]! < this.gsize[b]!) [a, b] = [b, a];
    let s = b;
    do {
      this.head[s] = a;
      s = this.next[s]!;
    } while (s !== b);
    const na = this.next[a]!;
    this.next[a] = this.next[b]!;
    this.next[b] = na;
    this.gsize[a]! += this.gsize[b]!;
    this.pl[a]! += this.pl[b]!;
    this.ls[a]! += this.ls[b]!;
    this.ls2[a]! += this.ls2[b]!;
    return a;
  }
  private remove(h: number) {
    const col = this.col;
    let s = h;
    // First empty every stone, then credit the liberties (a stone next to two removed stones counts both).
    do {
      col[s] = 0;
      this.addEmpty(s);
      s = this.next[s]!;
    } while (s !== h);
    s = h;
    do {
      for (const d of this.dirs) {
        const j = s + d;
        const x = col[j]!;
        if (x === 1 || x === 2) {
          const hj = this.head[j]!;
          this.pl[hj]!++;
          this.ls[hj]! += s;
          this.ls2[hj]! += s * s;
        }
      }
      const nx = this.next[s]!;
      this.head[s] = -1;
      s = nx;
    } while (s !== h);
  }
  /** Area score for Black minus White (komi not included), for a finished play-out (or any position). */
  score(): number {
    let d = 0;
    const col = this.col;
    for (let i = 0; i < this.size; i++) {
      const x = col[i]!;
      if (x === 1) d++;
      else if (x === 2) d--;
      else if (x === 0) {
        let t = 0;
        for (const dd of this.dirs) {
          const y = col[i + dd]!;
          if (y === 1 || y === 2) t |= y;
        }
        if (t === 1) d++;
        else if (t === 2) d--;
      }
    }
    return d;
  }
}

/**
 * A play-out to the end from a loaded board: heavy = first answer the last move (capture a group it left in
 * atari, or save one's own it put in atari), else a random legal point that is not one's own eye.
 * Returns Black's margin (area, minus komi). (At the end of a play-out every empty point is an eye, so the
 * simple count is exact.)
 */
export function fastPlayout(f: Fast, r: () => number, heavy: boolean, komi: number): number {
  const cap = f.n * f.n * 3;
  let last = -1;
  while (f.passes < 2 && f.moves < cap) {
    if (heavy && last >= 0) {
      let urgent = -1;
      for (const j of [last - 1, last + 1, last - f.W, last + f.W, last]) {
        const x = f.col[j]!;
        if (x !== 1 && x !== 2) continue;
        const lib = f.atariLib(f.head[j]!);
        if (lib >= 0 && !f.isEye(lib, f.side) && f.legal(lib)) {
          urgent = lib;
          if (x !== f.side) break;
        }
      }
      if (urgent >= 0) {
        f.play(urgent);
        last = urgent;
        continue;
      }
    }
    let moved = false;
    let n = f.ne;
    const e = f.empties;
    // Try empty points in random order (a partial shuffle of the list) until one is legal and not an own eye.
    while (n > 0) {
      const k = Math.floor(r() * n);
      const i = e[k]!;
      if (!f.isEye(i, f.side) && f.legal(i)) {
        f.play(i);
        moved = true;
        last = i;
        break;
      }
      // Move it out of the way (swap with the last untried one, keeping positions right).
      const j = e[n - 1]!;
      e[k] = j;
      e[n - 1] = i;
      f.epos[j] = k;
      f.epos[i] = n - 1;
      n--;
    }
    if (!moved) (f.pass(), (last = -1));
  }
  return f.score() - komi;
}
