/**
 * Inflate (RFC 1951, and the zlib wrapper of RFC 1950) in plain code, synchronous: the converter reads zip files (Word,
 * e-books) and takes PDFs apart with it, on any phone and in Node's tests alike. A canonical-Huffman decoder after
 * Mark Adler's "puff": slow-and-sure, ample for documents.
 */

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huff {
  count: Uint16Array;
  symbol: Uint16Array;
}

function huff(lengths: ArrayLike<number>, n: number): Huff {
  const count = new Uint16Array(16);
  const symbol = new Uint16Array(n);
  for (let s = 0; s < n; s++) count[lengths[s]!]!++;
  const offs = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len]! + count[len]!;
  for (let s = 0; s < n; s++) if (lengths[s]) symbol[offs[lengths[s]!]!++] = s;
  return { count, symbol };
}

let FIXED: { lit: Huff; dist: Huff } | null = null;
function fixed(): { lit: Huff; dist: Huff } {
  if (FIXED) return FIXED;
  const l = new Uint8Array(288);
  l.fill(8, 0, 144);
  l.fill(9, 144, 256);
  l.fill(7, 256, 280);
  l.fill(8, 280, 288);
  FIXED = { lit: huff(l, 288), dist: huff(new Uint8Array(30).fill(5), 30) };
  return FIXED;
}

/** Raw deflate data, inflated. Throws on data that is not deflate. */
export function inflateRaw(src: Uint8Array, sizeHint = 0): Uint8Array {
  let out = new Uint8Array(Math.max(1024, sizeHint || src.length * 4));
  let op = 0;
  let ip = 0;
  let bitbuf = 0;
  let bitcnt = 0;
  const need = (n: number) => {
    if (op + n <= out.length) return;
    let size = out.length * 2;
    while (size < op + n) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(out.subarray(0, op));
    out = grown;
  };
  const bits = (n: number): number => {
    let v = bitbuf;
    while (bitcnt < n) {
      if (ip >= src.length) throw new Error('deflate data ends too soon');
      v |= src[ip++]! << bitcnt;
      bitcnt += 8;
    }
    bitbuf = v >>> n;
    bitcnt -= n;
    return v & ((1 << n) - 1);
  };
  const decode = (h: Huff): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len]!;
      if (code - c < first) return h.symbol[index + (code - first)]!;
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error('bad deflate code');
  };
  const codes = (lit: Huff, dist: Huff) => {
    for (;;) {
      let sym = decode(lit);
      if (sym < 256) {
        need(1);
        out[op++] = sym;
      } else if (sym === 256) return;
      else {
        sym -= 257;
        if (sym >= 29) throw new Error('bad deflate length');
        const len = LBASE[sym]! + bits(LEXT[sym]!);
        const ds = decode(dist);
        if (ds >= 30) throw new Error('bad deflate distance');
        const d = DBASE[ds]! + bits(DEXT[ds]!);
        if (d > op) throw new Error('deflate distance too far back');
        need(len);
        for (let k = 0; k < len; k++, op++) out[op] = out[op - d]!;
      }
    }
  };
  let last = 0;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitbuf = 0;
      bitcnt = 0;
      if (ip + 4 > src.length) throw new Error('deflate data ends too soon');
      const len = src[ip]! | (src[ip + 1]! << 8);
      ip += 4;
      if (ip + len > src.length) throw new Error('deflate data ends too soon');
      need(len);
      out.set(src.subarray(ip, ip + len), op);
      op += len;
      ip += len;
    } else if (type === 1) {
      const f = fixed();
      codes(f.lit, f.dist);
    } else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      const lengths = new Uint8Array(320);
      for (let k = 0; k < ncode; k++) lengths[ORDER[k]!] = bits(3);
      const lencode = huff(lengths, 19);
      lengths.fill(0);
      let idx = 0;
      while (idx < nlen + ndist) {
        let sym = decode(lencode);
        if (sym < 16) lengths[idx++] = sym;
        else {
          let len = 0;
          let rep = 0;
          if (sym === 16) {
            if (!idx) throw new Error('bad deflate repeat');
            len = lengths[idx - 1]!;
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (idx + rep > nlen + ndist) throw new Error('bad deflate lengths');
          while (rep--) lengths[idx++] = len;
          sym = 0;
        }
      }
      codes(huff(lengths.subarray(0, nlen), nlen), huff(lengths.subarray(nlen, nlen + ndist), ndist));
    } else throw new Error('bad deflate block');
  } while (!last);
  return out.slice(0, op);
}

/** zlib-wrapped deflate (a PDF's /FlateDecode, a PNG's IDAT), inflated; raw deflate is taken too. */
export function inflate(src: Uint8Array, sizeHint = 0): Uint8Array {
  const zlib = src.length > 2 && (src[0]! & 0x0f) === 8 && ((src[0]! << 8) | src[1]!) % 31 === 0;
  return inflateRaw(zlib ? src.subarray(2) : src, sizeHint);
}

/**
 * zlib data with no compression at all ("stored" blocks): valid wherever deflate is read, and what a picture made here
 * needs when the phone has no compressor to hand (the PNG of a QR code is mostly the same few bytes anyway).
 */
export function zlibStored(data: Uint8Array, adler: number): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 65535));
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blocks; b++) {
    const part = data.subarray(b * 65535, Math.min(data.length, (b + 1) * 65535));
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = part.length & 0xff;
    out[o++] = part.length >>> 8;
    out[o++] = ~part.length & 0xff;
    out[o++] = (~part.length >>> 8) & 0xff;
    out.set(part, o);
    o += part.length;
  }
  out[o++] = adler >>> 24;
  out[o++] = (adler >>> 16) & 0xff;
  out[o++] = (adler >>> 8) & 0xff;
  out[o++] = adler & 0xff;
  return out;
}
