/**
 * A QR CODE MADE ON THE PHONE (BRIEF-REST-E part 1): text, a link or Wi-Fi details as a QR code (Model 2, byte mode,
 * versions 1–40, error correction L, M, Q or H; the mask chosen by the standard's penalty rules), drawn as an SVG or a
 * PNG made here. Pure; its codes are read back by ZXing (vendor/zxing) in apps/edge/test/reste.test.mjs.
 */
import { adler32, concat, crc32, utf8 } from './bytes';
import { zlibStored } from './inflate';

export type Ecc = 'L' | 'M' | 'Q' | 'H';
const ECC_ORD: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// error-correction codewords per block, and the number of blocks, by level then version (index 0 unused)
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Modules a version holds for data and error correction (everything but the fixed patterns). */
function rawModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver: number, e: Ecc) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ECC_ORD[e]]![ver]! * BLOCKS[ECC_ORD[e]]![ver]!;

// Reed–Solomon over GF(256), the polynomial 0x11D
function rsMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = rsMul(r[j]!, root);
      if (j + 1 < r.length) r[j] = r[j]! ^ r[j + 1]!;
    }
    root = rsMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data: number[], div: number[]): number[] {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift()!;
    r.push(0);
    div.forEach((c, i) => (r[i] = r[i]! ^ rsMul(c, f)));
  }
  return r;
}

export interface Qr {
  version: number;
  size: number;
  ecc: Ecc;
  mask: number;
  /** [y][x]: true is a dark module. */
  modules: boolean[][];
}

/** The QR code for these words (UTF-8, byte mode) at the smallest version that holds them. Throws when even 40 cannot. */
export function makeQr(text: string, ecc: Ecc = 'M'): Qr {
  const data = utf8.encode(text);
  let ver = 1;
  for (; ver <= 40; ver++) if (4 + (ver < 10 ? 8 : 16) + data.length * 8 <= dataCodewords(ver, ecc) * 8) break;
  if (ver > 40) throw new Error('that is too long for one QR code (about 2,300 letters at most)');
  // the bits: mode (byte), count, the bytes, a terminator, then padding to the capacity
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(4, 4);
  put(data.length, ver < 10 ? 8 : 16);
  for (const b of data) put(b, 8);
  const cap = dataCodewords(ver, ecc) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  // blocks, their error correction, interleaved
  const nb = BLOCKS[ECC_ORD[ecc]]![ver]!;
  const eccLen = ECC_PER_BLOCK[ECC_ORD[ecc]]![ver]!;
  const raw = Math.floor(rawModules(ver) / 8);
  const shortLen = Math.floor(raw / nb);
  const shorts = nb - (raw % nb);
  const div = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = words.slice(k, k + shortLen - eccLen + (i < shorts ? 0 : 1));
    k += dat.length;
    const e = rsRemainder(dat, div);
    if (i < shorts) dat.push(0);
    blocks.push([...dat, ...e]);
  }
  const all: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) blocks.forEach((b, j) => i !== shortLen - eccLen || j >= shorts ? all.push(b[i]!) : undefined);
  // the matrix: the fixed patterns, then the data in its zigzag, then the best mask
  const size = ver * 4 + 17;
  const dark: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, v: boolean) => {
    dark[y]![x] = v;
    fixed[y]![x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align: number[] = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
  }
  for (let i = 0; i < align.length; i++)
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(align[i]! + dx, align[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const formatAt = (mask: number) => {
    const d = (FORMAT_BITS[ecc] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  formatAt(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const v = ((b >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, v);
      set(c, a, v);
    }
  }
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fixed[y]![x] && i < all.length * 8) {
          dark[y]![x] = ((all[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
  }
  const flip = (mask: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (fixed[y]![x]) continue;
        const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask];
        if (inv) dark[y]![x] = !dark[y]![x];
      }
  };
  let best = 0;
  let low = Infinity;
  for (let m = 0; m < 8; m++) {
    flip(m);
    formatAt(m);
    const p = penalty(dark);
    if (p < low) {
      low = p;
      best = m;
    }
    flip(m);
  }
  flip(best);
  formatAt(best);
  return { version: ver, size, ecc, mask: best, modules: dark };
}

/** The standard's four penalty rules (runs, blocks, finder-like patterns, the dark share): lower reads better. */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      let bits = 0;
      for (let b = 0; b < n; b++) {
        const v = get(a, b);
        bits = ((bits << 1) | (v ? 1 : 0)) & 0x7ff;
        if (b > 0 && v === get(a, b - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else run = 1;
        // 1011101 with four light either side
        if (b >= 10 && (bits === 0b10111010000 || bits === 0b00001011101)) score += 40;
      }
    }
  };
  lines((y, x) => m[y]![x]!);
  lines((x, y) => m[y]![x]!);
  let dark = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (m[y]![x]) dark++;
      if (x < n - 1 && y < n - 1) {
        const c = m[y]![x];
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
      }
    }
  score += Math.floor(Math.abs((dark * 20) / (n * n) - 10)) * 10;
  return score;
}

/** Wi-Fi details in the form phones' cameras read ("WIFI:T:WPA;S:Home;P:secret;;"), with its special letters escaped. */
export function wifiText(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass' = password ? 'WPA' : 'nopass', hidden = false): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  return `WIFI:T:${security};S:${esc(ssid)};${security === 'nopass' ? '' : `P:${esc(password)};`}${hidden ? 'H:true;' : ''};`;
}

/** The code as an SVG (dark modules on white, a quiet zone of four). */
export function qrSvg(q: Qr, scale = 8): string {
  const n = q.size + 8;
  let d = '';
  q.modules.forEach((row, y) => row.forEach((v, x) => (v ? (d += `M${x + 4} ${y + 4}h1v1h-1z`) : undefined)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * scale}" height="${n * scale}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** The code's pixels (RGBA), `scale` pixels a module and the quiet zone around: what a camera, or ZXing, reads. */
export function qrPixels(q: Qr, scale = 6): { data: Uint8ClampedArray; width: number; height: number } {
  const w = (q.size + 8) * scale;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++) {
      if (!q.modules[y]![x]) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = (((y + 4) * scale + dy) * w + (x + 4) * scale + dx) * 4;
          data[o] = data[o + 1] = data[o + 2] = 0;
        }
    }
  return { data, width: w, height: w };
}

/** A greyscale PNG of these pixels, made here (its picture data stored, not squeezed: a QR code is small). */
export function greyPng(grey: Uint8Array, w: number, h: number): Uint8Array {
  const raw = new Uint8Array((w + 1) * h);
  for (let y = 0; y < h; y++) raw.set(grey.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const chunk = (type: string, body: Uint8Array) => {
    const t = utf8.encode(type);
    const out = new Uint8Array(12 + body.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, body.length);
    out.set(t, 4);
    out.set(body, 8);
    dv.setUint32(8 + body.length, crc32(concat([t, body])));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return concat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw, adler32(raw))), chunk('IEND', new Uint8Array())]);
}

/** The code as a PNG file. */
export function qrPng(q: Qr, scale = 8): Uint8Array {
  const px = qrPixels(q, scale);
  const grey = new Uint8Array(px.width * px.height);
  for (let i = 0; i < grey.length; i++) grey[i] = px.data[i * 4]!;
  return greyPng(grey, px.width, px.height);
}
