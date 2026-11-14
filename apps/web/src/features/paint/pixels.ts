/**
 * PAINT's pixel work (pure, on RGBA arrays, read by the brain's test): the fill bucket that stops at lines, his photo turned into
 * a colouring page's outlines, and the PSD writer that keeps every layer, its name, blend mode, opacity and visibility.
 */

/** Flood fill from (x, y): every pixel within `tol` (0..255) of the start colour, grown by `grow` pixels to tuck under the lines'
 * soft edges. Returns a mask (255 filled) and the box it covers. */
export function floodMask(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, tol: number, grow = 1): { mask: Uint8Array; box: { x: number; y: number; w: number; h: number } } | null {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const i0 = (y * w + x) * 4;
  const r0 = src[i0]!, g0 = src[i0 + 1]!, b0 = src[i0 + 2]!, a0 = src[i0 + 3]!;
  const near = (i: number): boolean => {
    const j = i * 4;
    return Math.abs(src[j]! - r0) <= tol && Math.abs(src[j + 1]! - g0) <= tol && Math.abs(src[j + 2]! - b0) <= tol && Math.abs(src[j + 3]! - a0) <= tol;
  };
  const mask = new Uint8Array(w * h);
  const stack = [y * w + x];
  let x0 = x, x1 = x, y0 = y, y1 = y;
  while (stack.length) {
    const i = stack.pop()!;
    const yy = (i / w) | 0;
    let l = i, r = i;
    const rowStart = yy * w, rowEnd = rowStart + w - 1;
    while (l > rowStart && !mask[l - 1] && near(l - 1)) l--;
    while (r < rowEnd && !mask[r + 1] && near(r + 1)) r++;
    if (mask[i] || !near(i)) continue;
    for (let k = l; k <= r; k++) {
      mask[k] = 255;
      if (yy > 0 && !mask[k - w] && near(k - w)) stack.push(k - w);
      if (yy < h - 1 && !mask[k + w] && near(k + w)) stack.push(k + w);
    }
    x0 = Math.min(x0, l - rowStart); x1 = Math.max(x1, r - rowStart); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
  }
  for (let g = 0; g < grow; g++) {
    const prev = mask.slice();
    for (let yy = Math.max(0, y0 - 1); yy <= Math.min(h - 1, y1 + 1); yy++) {
      for (let xx = Math.max(0, x0 - 1); xx <= Math.min(w - 1, x1 + 1); xx++) {
        const i = yy * w + xx;
        if (prev[i]) continue;
        if ((xx > 0 && prev[i - 1]) || (xx < w - 1 && prev[i + 1]) || (yy > 0 && prev[i - w]) || (yy < h - 1 && prev[i + w])) mask[i] = 255;
      }
    }
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(w - 1, x1 + 1); y1 = Math.min(h - 1, y1 + 1);
  }
  return { mask, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

/** His photo as a colouring page: soft grey, the edges found (a difference of two blurs), then clean black lines on clear. */
export function outlinesOf(rgba: Uint8ClampedArray, w: number, h: number, detail = 0.5): Uint8ClampedArray {
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  const blur = (src: Float32Array, r: number): Float32Array => {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, k))]!;
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / n;
        s += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]!;
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s / n;
        s += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
      }
    }
    return out;
  };
  const scale = Math.max(1, Math.round(Math.min(w, h) / 500));
  const a = blur(grey, scale), b = blur(grey, scale * 3);
  const out = new Uint8ClampedArray(w * h * 4);
  const cut = 9 - detail * 6;
  for (let i = 0; i < w * h; i++) {
    const d = b[i]! - a[i]!;
    // a dark line where the small blur is darker than its neighbourhood, softened over a few grey levels
    const v = Math.max(0, Math.min(1, (d - cut) / 6));
    out[i * 4 + 3] = Math.round(v * 255);
  }
  return out;
}

/** His photo as inked comic art: its colours flattened to a few bold tones (a little brighter and richer), with the outlines
 * inked over them in black. */
export function comicArtOf(rgba: Uint8ClampedArray, w: number, h: number, levels = 5): Uint8ClampedArray {
  const lines = outlinesOf(rgba, w, h, 0.6);
  const out = new Uint8ClampedArray(rgba.length);
  const step = 255 / (levels - 1);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4]!, g = rgba[i * 4 + 1]!, b = rgba[i * 4 + 2]!;
    const grey = (r + g + b) / 3;
    const ink = lines[i * 4 + 3]! / 255;
    for (let c = 0; c < 3; c++) {
      const v = [r, g, b][c]!;
      const rich = Math.max(0, Math.min(255, grey + (v - grey) * 1.35 + 12));
      const flat = Math.round(rich / step) * step;
      out[i * 4 + c] = Math.round(flat * (1 - ink));
    }
    out[i * 4 + 3] = 255;
  }
  return out;
}

// ---- PSD (Adobe Photoshop's own format), PackBits-packed, 8 bits, RGB, every layer kept with its name and blend mode
export type PsdLayer = { name: string; rgba: Uint8ClampedArray; opacity: number; visible: boolean; blend: string };

export const PSD_BLEND: Record<string, string> = {
  'source-over': 'norm', multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite', 'color-dodge': 'div ',
  'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit', difference: 'diff', exclusion: 'smud', hue: 'hue ', saturation: 'sat ',
  color: 'colr', luminosity: 'lum ',
};

class Out {
  private parts: Uint8Array[] = [];
  size = 0;
  bytes(b: Uint8Array): void { this.parts.push(b); this.size += b.length; }
  u8(v: number): void { this.bytes(Uint8Array.of(v & 255)); }
  u16(v: number): void { this.bytes(Uint8Array.of((v >>> 8) & 255, v & 255)); }
  i16(v: number): void { this.u16(v < 0 ? v + 65536 : v); }
  u32(v: number): void { this.bytes(Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)); }
  ascii(s: string): void { this.bytes(Uint8Array.from(s, (c) => c.charCodeAt(0) & 127)); }
  all(): Uint8Array { const o = new Uint8Array(this.size); let at = 0; for (const p of this.parts) { o.set(p, at); at += p.length; } return o; }
}

const channel = (rgba: Uint8ClampedArray, c: number): Uint8Array => {
  const n = rgba.length / 4, o = new Uint8Array(n);
  for (let i = 0; i < n; i++) o[i] = rgba[i * 4 + c]!;
  return o;
};

/** PackBits, Photoshop's own run-length packing, one row at a time: a 1200 × 1600 painting's PSD shrinks from tens of megabytes
 * to a few, since most of a layer is clear. */
export function packBits(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = row.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 3) { out.push(257 - run, row[i]!); i += run; continue; }
    const start = i;
    let lit = 0;
    while (i < n && lit < 128) {
      if (i + 2 < n && row[i] === row[i + 1] && row[i] === row[i + 2]) break;
      i++; lit++;
    }
    out.push(lit - 1);
    for (let k = start; k < start + lit; k++) out.push(row[k]!);
  }
  return Uint8Array.from(out);
}
export function unpackBits(b: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let i = 0, o = 0;
  while (i < b.length && o < size) {
    const c = b[i++]!;
    if (c < 128) { out.set(b.subarray(i, i + c + 1), o); o += c + 1; i += c + 1; }
    else if (c > 128) { out.fill(b[i++]!, o, o + 257 - c); o += 257 - c; }
  }
  return out;
}
/** One channel packed row by row: compression 1, then each row's byte count, then the rows. */
function packed(ch: Uint8Array, w: number, h: number, counts: Out, body: Out): void {
  for (let y = 0; y < h; y++) { const r = packBits(ch.subarray(y * w, (y + 1) * w)); counts.u16(r.length); body.bytes(r); }
}

/** A layered PSD: Photoshop, Procreate, Affinity, Krita and Photopea all open it with the layers apart. */
export function psdOf(w: number, h: number, layers: PsdLayer[], merged: Uint8ClampedArray): Uint8Array {
  const o = new Out();
  o.ascii('8BPS'); o.u16(1); o.bytes(new Uint8Array(6)); o.u16(3); o.u32(h); o.u32(w); o.u16(8); o.u16(3);
  o.u32(0); // colour mode data
  o.u32(0); // image resources
  // layer and mask information
  const li = new Out();
  li.i16(layers.length);
  const chans: Uint8Array[][] = [];
  for (const L of layers) {
    li.u32(0); li.u32(0); li.u32(h); li.u32(w); // top, left, bottom, right
    li.u16(4);
    const cs = [channel(L.rgba, 3), channel(L.rgba, 0), channel(L.rgba, 1), channel(L.rgba, 2)].map((c) => {
      const counts = new Out(), body = new Out();
      counts.u16(1);
      packed(c, w, h, counts, body);
      counts.bytes(body.all());
      return counts.all();
    });
    chans.push(cs);
    for (const [id, c] of [[-1, cs[0]!], [0, cs[1]!], [1, cs[2]!], [2, cs[3]!]] as const) { li.i16(id); li.u32(c.length); }
    li.ascii('8BIM'); li.ascii(PSD_BLEND[L.blend] ?? 'norm');
    li.u8(Math.round(Math.max(0, Math.min(1, L.opacity)) * 255)); li.u8(0); li.u8(L.visible ? 0 : 2); li.u8(0);
    const name = Uint8Array.from(L.name.slice(0, 200), (c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63));
    const nameLen = 1 + name.length, padded = Math.ceil(nameLen / 4) * 4;
    li.u32(4 + 4 + padded);
    li.u32(0); li.u32(0); // mask, blending ranges
    li.u8(name.length); li.bytes(name); li.bytes(new Uint8Array(padded - nameLen));
  }
  for (const cs of chans) for (const c of cs) li.bytes(c);
  if (li.size % 2) li.u8(0);
  const liBytes = li.all();
  o.u32(liBytes.length + 4 + 4); o.u32(liBytes.length); o.bytes(liBytes); o.u32(0);
  // the merged picture, for apps that only show one: every row's count for all three channels, then the rows
  o.u16(1);
  const counts = new Out(), body = new Out();
  for (const c of [0, 1, 2]) packed(channel(merged, c), w, h, counts, body);
  o.bytes(counts.all()); o.bytes(body.all());
  return o.all();
}

/** Read the header and layer names back (for the test, and to say what a PSD holds). */
export function psdInfo(b: Uint8Array): { w: number; h: number; layers: string[]; blends: string[] } | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) !== '8BPS') return null;
  const h = v.getUint32(14), w = v.getUint32(18);
  let at = 26;
  at += 4 + v.getUint32(at);
  at += 4 + v.getUint32(at);
  at += 4; // layer and mask length
  at += 4; // layer info length
  const n = Math.abs(v.getInt16(at)); at += 2;
  const layers: string[] = [], blends: string[] = [];
  for (let i = 0; i < n; i++) {
    at += 16;
    const nc = v.getUint16(at); at += 2 + nc * 6;
    at += 4; blends.push(String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!)); at += 4;
    at += 4;
    const extra = v.getUint32(at); at += 4;
    const end = at + extra;
    at += 4 + v.getUint32(at);
    at += 4 + v.getUint32(at);
    const nl = b[at]!; layers.push(String.fromCharCode(...b.subarray(at + 1, at + 1 + nl)));
    at = end;
  }
  return { w, h, layers, blends };
}
