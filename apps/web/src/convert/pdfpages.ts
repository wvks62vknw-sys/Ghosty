/**
 * A PDF's pages split out or several PDFs joined, on the phone (BRIEF-REST-E part 1), with no library: the file is read
 * as PDF objects (its cross-reference table or stream, following earlier ones; compressed object streams too; a damaged
 * table is rebuilt by finding every "n 0 obj"), each chosen page is copied with everything it uses, renumbered, and a new
 * file is written around them. Pages keep what they inherit from their tree (resources, size, rotation). A locked
 * (encrypted) PDF is refused in words. Pure and synchronous.
 */
import { concat, utf8 } from './bytes';
import { inflate } from './inflate';

class Name {
  constructor(readonly n: string) {}
}
class Str {
  constructor(readonly b: Uint8Array) {}
}
class Ref {
  constructor(readonly num: number, readonly gen: number) {}
}
class Dict {
  constructor(readonly m: Map<string, Val>, public stream?: Uint8Array) {}
  get(k: string): Val | undefined {
    return this.m.get(k);
  }
}
type Val = null | boolean | number | Name | Str | Ref | Dict | Val[];

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const ascii = (b: Uint8Array, a: number, z: number) => String.fromCharCode(...b.subarray(a, z));

/** The PDF syntax over some bytes: a file, or the inside of an object stream. */
class Lexer {
  constructor(readonly b: Uint8Array) {}
  /** An indirect value as its object (a plain lexer has none to look up). */
  resolve(v: Val): Val {
    return v;
  }

  // ---------------------------------------------------------------- the lexer
  protected skip(p: number): number {
    const b = this.b;
    for (;;) {
      while (p < b.length && WS.has(b[p]!)) p++;
      if (b[p] !== 37) return p;
      while (p < b.length && b[p] !== 10 && b[p] !== 13) p++;
    }
  }
  protected word(p: number): [string, number] {
    const b = this.b;
    const s = p;
    while (p < b.length && !WS.has(b[p]!) && !DELIM.has(b[p]!)) p++;
    return [ascii(b, s, p), p];
  }
  /** The value at p, and where it ends. */
  value(p: number): [Val, number] {
    const b = this.b;
    p = this.skip(p);
    const c = b[p];
    if (c === 47) {
      const [w, q] = this.word(p + 1);
      return [new Name(w.replace(/#([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))), q];
    }
    if (c === 40) return this.literal(p + 1);
    if (c === 60 && b[p + 1] === 60) return this.dict(p + 2);
    if (c === 60) {
      let q = p + 1;
      let hex = '';
      while (q < b.length && b[q] !== 62) {
        if (!WS.has(b[q]!)) hex += String.fromCharCode(b[q]!);
        q++;
      }
      if (hex.length % 2) hex += '0';
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
      return [new Str(out), q + 1];
    }
    if (c === 91) {
      const arr: Val[] = [];
      let q = p + 1;
      for (;;) {
        q = this.skip(q);
        if (q >= b.length) throw new Error('an array runs off the end');
        if (b[q] === 93) return [arr, q + 1];
        const [v, r] = this.value(q);
        arr.push(v);
        q = r;
      }
    }
    const [w, q] = this.word(p);
    if (!w) throw new Error(`unreadable PDF at byte ${p}`);
    if (w === 'true' || w === 'false') return [w === 'true', q];
    if (w === 'null') return [null, q];
    const n = Number(w);
    if (!Number.isFinite(n)) throw new Error(`unreadable PDF word "${w.slice(0, 20)}"`);
    // "12 0 R": a reference
    if (/^\d+$/.test(w)) {
      const r1 = this.skip(q);
      const [g, r2] = this.word(r1);
      if (/^\d+$/.test(g)) {
        const r3 = this.skip(r2);
        if (b[r3] === 82 && (r3 + 1 >= b.length || WS.has(b[r3 + 1]!) || DELIM.has(b[r3 + 1]!))) return [new Ref(n, Number(g)), r3 + 1];
      }
    }
    return [n, q];
  }
  protected literal(p: number): [Str, number] {
    const b = this.b;
    const out: number[] = [];
    let depth = 1;
    while (p < b.length) {
      const c = b[p++]!;
      if (c === 92) {
        const e = b[p++]!;
        const map: Record<number, number> = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12, 40: 40, 41: 41, 92: 92 };
        if (map[e] !== undefined) out.push(map[e]!);
        else if (e >= 48 && e <= 55) {
          let v = e - 48;
          for (let k = 0; k < 2 && b[p]! >= 48 && b[p]! <= 55; k++) v = v * 8 + (b[p++]! - 48);
          out.push(v & 0xff);
        } else if (e === 13) {
          if (b[p] === 10) p++;
        } else if (e !== 10) out.push(e);
      } else if (c === 40) {
        depth++;
        out.push(c);
      } else if (c === 41) {
        if (!--depth) break;
        out.push(c);
      } else out.push(c);
    }
    return [new Str(new Uint8Array(out)), p];
  }
  protected dict(p: number): [Dict, number] {
    const b = this.b;
    const m = new Map<string, Val>();
    for (;;) {
      p = this.skip(p);
      if (p >= b.length) throw new Error('a dictionary runs off the end');
      if (b[p] === 62 && b[p + 1] === 62) {
        p += 2;
        break;
      }
      const [k, q] = this.value(p);
      if (!(k instanceof Name)) throw new Error('a dictionary key is not a name');
      const [v, r] = this.value(q);
      m.set(k.n, v);
      p = r;
    }
    const d = new Dict(m);
    const q = this.skip(p);
    if (ascii(b, q, q + 6) === 'stream') {
      let s = q + 6;
      if (b[s] === 13) s++;
      if (b[s] === 10) s++;
      let len = this.resolve(m.get('Length') ?? null);
      const okLen = typeof len === 'number' && len >= 0 && s + len <= b.length && /^\s*endstream/.test(ascii(b, s + len, Math.min(b.length, s + len + 20)));
      if (!okLen) {
        const e = this.find('endstream', s);
        if (e < 0) throw new Error('a stream has no end');
        len = e - s;
        while (len > 0 && (b[s + len - 1] === 10 || b[s + len - 1] === 13)) len--;
      }
      d.stream = b.subarray(s, s + (len as number));
      return [d, s + (len as number) + 9];
    }
    return [d, p];
  }
  protected find(word: string, from: number): number {
    const w = utf8.encode(word);
    outer: for (let i = from; i <= this.b.length - w.length; i++) {
      for (let k = 0; k < w.length; k++) if (this.b[i + k] !== w[k]) continue outer;
      return i;
    }
    return -1;
  }

}

/** One PDF, read lazily: its objects by number. */
class Pdf extends Lexer {
  private xref = new Map<number, { off?: number; stm?: number; idx?: number }>();
  private cache = new Map<number, Val>();
  private stms = new Map<number, Val[]>();
  trailer = new Dict(new Map());

  constructor(b: Uint8Array) {
    super(b);
    if (ascii(b, 0, 1024).indexOf('%PDF-') < 0) throw new Error('this is not a PDF');
    try {
      this.readXref();
      if (!(this.trailer.get('Root') instanceof Ref)) throw new Error('no root');
    } catch {
      this.rebuild();
    }
    if (this.trailer.get('Encrypt')) throw new Error('this PDF is locked with a password, so I can’t take its pages apart');
  }

  // ---------------------------------------------------------------- the objects
  private objAt(off: number): Val {
    const [, p1] = this.value(off);
    const [, p2] = this.value(p1);
    const p3 = this.skip(p2);
    if (ascii(this.b, p3, p3 + 3) !== 'obj') throw new Error(`no object at byte ${off}`);
    return this.value(p3 + 3)[0];
  }
  /** Object `num` (null when it is not there). */
  get(num: number): Val {
    if (this.cache.has(num)) return this.cache.get(num)!;
    const e = this.xref.get(num);
    let v: Val = null;
    try {
      if (e?.off !== undefined) v = this.objAt(e.off);
      else if (e?.stm !== undefined) v = this.fromStream(e.stm, e.idx ?? 0);
    } catch {
      v = null;
    }
    this.cache.set(num, v);
    return v;
  }
  override resolve(v: Val): Val {
    for (let i = 0; i < 32 && v instanceof Ref; i++) v = this.get(v.num);
    return v;
  }
  private fromStream(stm: number, idx: number): Val {
    let list = this.stms.get(stm);
    if (!list) {
      const s = this.resolve(new Ref(stm, 0));
      if (!(s instanceof Dict) || !s.stream) throw new Error('no object stream');
      const data = decodeStream(s, this);
      const n = Number(this.resolve(s.get('N') ?? 0));
      const first = Number(this.resolve(s.get('First') ?? 0));
      const sub = new Lexer(data);
      const offs: number[] = [];
      let p = 0;
      for (let i = 0; i < n; i++) {
        const [, a] = sub.value(p);
        const [o, z] = sub.value(a);
        offs.push(Number(o));
        p = z;
      }
      list = offs.map((o) => {
        try {
          return sub.value(first + o)[0];
        } catch {
          return null;
        }
      });
      this.stms.set(stm, list);
    }
    return list[idx] ?? null;
  }

  // ---------------------------------------------------------------- the cross-reference
  private readXref(): void {
    const tail = ascii(this.b, Math.max(0, this.b.length - 2048), this.b.length);
    const m = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(tail) ?? /startxref\s+(\d+)/.exec(tail);
    if (!m) throw new Error('no startxref');
    let off: number | null = Number(m[1]);
    const seen = new Set<number>();
    let first = true;
    while (off !== null && !seen.has(off) && off < this.b.length) {
      seen.add(off);
      const p = this.skip(off);
      let dict: Dict;
      if (ascii(this.b, p, p + 4) === 'xref') dict = this.table(p + 4);
      else {
        const v = this.objAt(p);
        if (!(v instanceof Dict) || !v.stream) throw new Error('no cross-reference here');
        this.xrefStream(v);
        dict = v;
      }
      if (first) {
        this.trailer = dict;
        first = false;
      }
      const stm = dict.get('XRefStm');
      if (typeof stm === 'number' && !seen.has(stm)) {
        const v = this.objAt(stm);
        if (v instanceof Dict && v.stream) this.xrefStream(v);
      }
      const prev = dict.get('Prev');
      off = typeof prev === 'number' ? prev : null;
    }
  }
  private table(p: number): Dict {
    for (;;) {
      p = this.skip(p);
      const [w, q] = this.word(p);
      if (w === 'trailer') return this.value(q)[0] as Dict;
      const [c, r] = this.word(this.skip(q));
      let start = Number(w);
      const count = Number(c);
      if (!Number.isFinite(start) || !Number.isFinite(count)) throw new Error('bad xref table');
      p = r;
      for (let i = 0; i < count; i++, start++) {
        p = this.skip(p);
        const [o, a] = this.word(p);
        const [, z] = this.word(this.skip(a));
        const [t, y] = this.word(this.skip(z));
        p = y;
        if (t === 'n' && !this.xref.has(start)) this.xref.set(start, { off: Number(o) });
        else if (!this.xref.has(start)) this.xref.set(start, {});
      }
    }
  }
  private xrefStream(d: Dict): void {
    const data = decodeStream(d, this);
    const w = (this.resolve(d.get('W') ?? null) as Val[]).map(Number);
    const size = Number(this.resolve(d.get('Size') ?? 0));
    const index = (this.resolve(d.get('Index') ?? null) as Val[] | null)?.map(Number) ?? [0, size];
    const rec = w[0]! + w[1]! + w[2]!;
    let p = 0;
    const field = (n: number, dflt: number) => {
      if (!n) return dflt;
      let v = 0;
      for (let k = 0; k < n; k++) v = v * 256 + (data[p++] ?? 0);
      return v;
    };
    for (let s = 0; s + 1 < index.length; s += 2) {
      for (let i = 0; i < index[s + 1]! && p + rec <= data.length; i++) {
        const num = index[s]! + i;
        const type = field(w[0]!, 1);
        const a = field(w[1]!, 0);
        const c = field(w[2]!, 0);
        if (this.xref.has(num)) continue;
        if (type === 1) this.xref.set(num, { off: a });
        else if (type === 2) this.xref.set(num, { stm: a, idx: c });
        else this.xref.set(num, {});
      }
    }
  }
  /** A damaged table: every "n g obj" in the file, the last of each number winning; the trailer from the last one seen. */
  private rebuild(): void {
    this.xref.clear();
    this.cache.clear();
    const text = ascii(this.b, 0, this.b.length);
    for (const m of text.matchAll(/(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj\b/g)) this.xref.set(Number(m[1]), { off: m.index! + m[0].indexOf(m[1]!) });
    const t = text.lastIndexOf('trailer');
    let root: Val = null;
    if (t >= 0) {
      try {
        const d = this.value(t + 7)[0];
        if (d instanceof Dict) {
          this.trailer = d;
          root = d.get('Root') ?? null;
        }
      } catch {
        /* no usable trailer */
      }
    }
    if (!(root instanceof Ref)) {
      for (const [num] of this.xref) {
        const v = this.get(num);
        if (v instanceof Dict && v.stream && (v.get('Type') as Name | undefined)?.n === 'XRef') {
          for (const k of ['Root', 'Info', 'Encrypt']) if (v.get(k)) this.trailer.m.set(k, v.get(k)!);
        }
        if (v instanceof Dict && (v.get('Type') as Name | undefined)?.n === 'Catalog') this.trailer.m.set('Root', new Ref(num, 0));
      }
    }
    if (!(this.trailer.get('Root') instanceof Ref)) throw new Error('I couldn’t find this PDF’s pages: it may be damaged');
  }

  /** Every page, in order, each with what it inherits from the tree it sits in. */
  pages(): { num: number; dict: Dict }[] {
    const out: { num: number; dict: Dict }[] = [];
    const cat = this.resolve(this.trailer.get('Root') ?? null);
    if (!(cat instanceof Dict)) throw new Error('this PDF has no page list');
    const seen = new Set<number>();
    const walk = (ref: Val, inherit: Map<string, Val>) => {
      if (!(ref instanceof Ref) || seen.has(ref.num)) return;
      seen.add(ref.num);
      const node = this.resolve(ref);
      if (!(node instanceof Dict)) return;
      const here = new Map(inherit);
      for (const k of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) if (node.get(k) !== undefined) here.set(k, node.get(k)!);
      const kids = this.resolve(node.get('Kids') ?? null);
      if (Array.isArray(kids) && (node.get('Type') as Name | undefined)?.n !== 'Page') for (const k of kids) walk(k, here);
      else {
        const m = new Map(node.m);
        for (const [k, v] of here) if (!m.has(k)) m.set(k, v);
        out.push({ num: ref.num, dict: new Dict(m, node.stream) });
      }
    };
    walk(cat.get('Pages') ?? null, new Map());
    if (!out.length) throw new Error('this PDF has no pages I can find');
    return out;
  }
}

/** A stream's data with its filters undone: Flate (with the PNG or TIFF predictors) only, which is all the tables use. */
function decodeStream(d: Dict, pdf: Pdf): Uint8Array {
  const f = pdf.resolve(d.get('Filter') ?? null);
  const filters = (Array.isArray(f) ? f : f ? [f] : []).map((x) => (x instanceof Name ? x.n : ''));
  let data = d.stream ?? new Uint8Array();
  for (const name of filters) {
    if (name !== 'FlateDecode' && name !== 'Fl') throw new Error(`a ${name} stream I can't read`);
    data = inflate(data);
  }
  const parms = pdf.resolve(d.get('DecodeParms') ?? null);
  const p = Array.isArray(parms) ? pdf.resolve(parms[0] ?? null) : parms;
  if (p instanceof Dict) {
    const pred = Number(pdf.resolve(p.get('Predictor') ?? 1));
    if (pred >= 10) {
      const cols = Number(pdf.resolve(p.get('Columns') ?? 1));
      const colors = Number(pdf.resolve(p.get('Colors') ?? 1));
      const bpc = Number(pdf.resolve(p.get('BitsPerComponent') ?? 8));
      const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
      const stride = Math.ceil((cols * colors * bpc) / 8);
      const rows = Math.floor(data.length / (stride + 1));
      const out = new Uint8Array(rows * stride);
      for (let y = 0; y < rows; y++) {
        const t = data[y * (stride + 1)]!;
        for (let x = 0; x < stride; x++) {
          const raw = data[y * (stride + 1) + 1 + x]!;
          const a = x >= bpp ? out[y * stride + x - bpp]! : 0;
          const b = y ? out[(y - 1) * stride + x]! : 0;
          const c = y && x >= bpp ? out[(y - 1) * stride + x - bpp]! : 0;
          let v = raw;
          if (t === 1) v += a;
          else if (t === 2) v += b;
          else if (t === 3) v += (a + b) >> 1;
          else if (t === 4) {
            const pp = a + b - c;
            const pa = Math.abs(pp - a);
            const pb = Math.abs(pp - b);
            const pc = Math.abs(pp - c);
            v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          }
          out[y * stride + x] = v & 0xff;
        }
      }
      data = out;
    }
  }
  return data;
}

// ---------------------------------------------------------------- writing
function nameOut(n: string): string {
  let s = '/';
  for (const ch of n) {
    const c = ch.charCodeAt(0);
    s += c < 0x21 || c > 0x7e || '()<>[]{}/%#'.includes(ch) ? `#${c.toString(16).padStart(2, '0')}` : ch;
  }
  return s;
}
function numOut(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
}

/** These pages of these PDFs, in this order, as one new PDF. `pages` are 1-based; every page when left out. */
export function pickPages(list: { bytes: Uint8Array; pages?: number[] }[]): Uint8Array {
  const out: Uint8Array[] = [];
  const kids: number[] = [];
  let next = 3; // 1: the catalogue, 2: the page tree
  const bodies = new Map<number, Uint8Array>();
  for (const src of list) {
    const pdf = new Pdf(src.bytes);
    const all = pdf.pages();
    const want = (src.pages ?? all.map((_, i) => i + 1)).filter((n) => n >= 1 && n <= all.length);
    const chosen = new Set(want.map((n) => all[n - 1]!.num));
    const pageNums = new Set(all.map((p) => p.num));
    const map = new Map<number, number>();
    const todo: number[] = [];
    const ref = (num: number): string => {
      if (pageNums.has(num) && !chosen.has(num)) return 'null';
      let n = map.get(num);
      if (!n) {
        n = next++;
        map.set(num, n);
        todo.push(num);
      }
      return `${n} 0 R`;
    };
    const ser = (v: Val, drop?: Set<string>): string => {
      if (v === null) return 'null';
      if (typeof v === 'boolean') return String(v);
      if (typeof v === 'number') return numOut(v);
      if (v instanceof Name) return nameOut(v.n);
      if (v instanceof Str) return `<${[...v.b].map((x) => x.toString(16).padStart(2, '0')).join('')}>`;
      if (v instanceof Ref) return ref(v.num);
      if (Array.isArray(v)) return `[${v.map((x) => ser(x)).join(' ')}]`;
      const parts: string[] = [];
      for (const [k, x] of v.m) if (!drop?.has(k) && !(v.stream && k === 'Length')) parts.push(`${nameOut(k)} ${ser(x)}`);
      if (v.stream) parts.push(`/Length ${v.stream.length}`);
      return `<< ${parts.join(' ')} >>`;
    };
    const body = (v: Val, drop?: Set<string>): Uint8Array => {
      const head = utf8.encode(ser(v, drop));
      return v instanceof Dict && v.stream ? concat([head, utf8.encode('\nstream\n'), v.stream, utf8.encode('\nendstream')]) : head;
    };
    const PAGE_DROP = new Set(['Parent', 'StructParents', 'B', 'Thumb']);
    // the chosen pages first, so a link from one to another lands on its copy (never on the old file's page tree)
    for (const n of want) if (!map.has(all[n - 1]!.num)) map.set(all[n - 1]!.num, next++);
    const written = new Set<number>();
    for (const n of want) {
      const p = all[n - 1]!;
      // the same page twice is copied twice, the second under a number of its own
      const num = written.has(p.num) ? next++ : map.get(p.num)!;
      written.add(p.num);
      const kept = new Dict(new Map([...p.dict.m].filter(([k]) => !PAGE_DROP.has(k))));
      // its parent is the new file's page tree, written by hand
      bodies.set(num, utf8.encode(ser(kept).replace(/^<< /, '<< /Parent 2 0 R ')));
      kids.push(num);
    }
    // then everything the pages use, and everything that uses
    while (todo.length) {
      const o = todo.shift()!;
      if (!chosen.has(o)) bodies.set(map.get(o)!, body(pdf.get(o)));
    }
  }
  if (!kids.length) throw new Error('no pages were chosen');
  bodies.set(1, utf8.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  bodies.set(2, utf8.encode(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`));
  out.push(utf8.encode('%PDF-1.7\n'), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  let at = out[0]!.length + out[1]!.length;
  const size = next;
  const offsets: number[] = new Array(size).fill(-1);
  for (let n = 1; n < size; n++) {
    const b = bodies.get(n) ?? utf8.encode('null');
    const chunk = concat([utf8.encode(`${n} 0 obj\n`), b, utf8.encode('\nendobj\n')]);
    offsets[n] = at;
    out.push(chunk);
    at += chunk.length;
  }
  const xref = `xref\n0 ${size}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out.push(utf8.encode(`${xref}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return concat(out);
}

/** How many pages a PDF has. */
export const pdfPageCount = (bytes: Uint8Array): number => new Pdf(bytes).pages().length;
/** These pages (1-based) of one PDF, as a PDF of their own. */
export const splitPdf = (bytes: Uint8Array, pages: number[]): Uint8Array => pickPages([{ bytes, pages }]);
/** Several PDFs, one after another, as one. */
export const joinPdfs = (list: Uint8Array[]): Uint8Array => pickPages(list.map((bytes) => ({ bytes })));

/** "1-3, 5, 8-" → pages 1, 2, 3, 5 and 8 to the last (`count`); none when it names no page. */
export function pageList(words: string, count: number): number[] {
  const out: number[] = [];
  for (const part of words.split(/[,;\s]+(?:and\s+)?|\s+and\s+/i)) {
    const m = /^(\d+)?\s*(?:-|–|to)\s*(\d+)?$/i.exec(part.trim()) ?? /^(\d+)$/.exec(part.trim());
    if (!m) continue;
    const a = m[1] ? Number(m[1]) : 1;
    const z = m[0].match(/-|–|to/i) ? (m[2] ? Number(m[2]) : count) : a;
    for (let n = Math.max(1, a); n <= Math.min(count, z); n++) out.push(n);
  }
  return out;
}
