/**
 * A PICTURE ON TELEGRAM (BRIEF-POLISH-2 item 7): when a reply would draw a Stage on the phone, the Telegram reply sends the same picture
 * as an image after the sentence. The brain has no browser and no renderer for SVG, so this draws the picture itself, in plain pixels
 * (a 5x7 bitmap face scaled up, filled polygons, lines) and writes the PNG (a zlib stream through the platform's own CompressionStream).
 * Nothing here is a model, a key or a cost: the chart is drawn from the reply's own numbers, the page from the reply's own words, the
 * room and the part from the parameters in his words, and the map from the free tile source the app already uses (tile.openstreetmap.org,
 * the same tiles the phone fetches) with the pin drawn on it. A picture that cannot be drawn is none: the sentence goes alone, once.
 *
 * The colours are The Scan's own (graphite, bone, the accent and the sequence), the same the phone draws the Stage in.
 */
import { chartTitle, figure, humanLabel, niceTicks, seriesFrom, tickText, type Series } from '../../../packages/shared/src/chart';
import { docFromReply, writeAsked } from '../../web/src/docs/model';
import { faces } from '../../web/src/show/iso';
import { lengthIn, partAsked, partBoxes, roomAsked, roomBoxesOf, roomPlanFor, type PartKind } from '../../web/src/show/parts';

type RGB = [number, number, number];
const BG: RGB = [16, 19, 23];
const PLATE: RGB = [23, 27, 32];
const INK: RGB = [236, 232, 223];
const INK3: RGB = [168, 165, 158];
const LINE: RGB = [117, 116, 111];
const SEQUENCE: RGB[] = [[100, 210, 255], INK, [255, 179, 64], [48, 209, 88]];

// ---------------------------------------------------------------- the 5x7 face

/** The 5x7 face as column bytes (bit 0 is the top row; the descenders use bit 7), ASCII 32 to 126. */
const FACE: number[][] = '00 00 00 00 00|00 00 5F 00 00|00 07 00 07 00|14 7F 14 7F 14|24 2A 7F 2A 12|23 13 08 64 62|36 49 56 20 50|00 08 07 03 00|00 1C 22 41 00|00 41 22 1C 00|2A 1C 7F 1C 2A|08 08 3E 08 08|00 80 70 30 00|08 08 08 08 08|00 00 60 60 00|20 10 08 04 02|3E 51 49 45 3E|00 42 7F 40 00|72 49 49 49 46|21 41 49 4D 33|18 14 12 7F 10|27 45 45 45 39|3C 4A 49 49 31|41 21 11 09 07|36 49 49 49 36|46 49 49 29 1E|00 00 14 00 00|00 40 34 00 00|00 08 14 22 41|14 14 14 14 14|00 41 22 14 08|02 01 51 09 06|3E 41 5D 59 4E|7E 11 11 11 7E|7F 49 49 49 36|3E 41 41 41 22|7F 41 41 41 3E|7F 49 49 49 41|7F 09 09 09 01|3E 41 41 51 73|7F 08 08 08 7F|00 41 7F 41 00|20 40 41 3F 01|7F 08 14 22 41|7F 40 40 40 40|7F 02 1C 02 7F|7F 04 08 10 7F|3E 41 41 41 3E|7F 09 09 09 06|3E 41 51 21 5E|7F 09 19 29 46|26 49 49 49 32|03 01 7F 01 03|3F 40 40 40 3F|1F 20 40 20 1F|3F 40 38 40 3F|63 14 08 14 63|03 04 78 04 03|61 51 49 45 43|00 7F 41 41 00|02 04 08 10 20|00 41 41 7F 00|04 02 01 02 04|40 40 40 40 40|00 01 02 04 00|20 54 54 54 78|7F 48 44 44 38|38 44 44 44 20|38 44 44 48 7F|38 54 54 54 18|08 7E 09 01 02|18 A4 A4 A4 7C|7F 08 04 04 78|00 44 7D 40 00|20 40 44 3D 00|7F 10 28 44 00|00 41 7F 40 00|7C 04 78 04 78|7C 08 04 04 78|38 44 44 44 38|FC 18 24 24 18|18 24 24 18 FC|7C 08 04 04 08|48 54 54 54 20|04 3F 44 40 20|3C 40 40 20 7C|1C 20 40 20 1C|3C 40 30 40 3C|44 28 10 28 44|4C 90 90 90 7C|44 64 54 4C 44|00 08 36 41 00|00 00 77 00 00|00 41 36 08 00|02 01 02 04 02'.split('|').map((g) => g.split(' ').map((x) => parseInt(x, 16)));

/** The glyph for a character as five column bytes; characters the face lacks are drawn as their plainest cousin or a question mark. */
function glyph(ch: string): number[] {
  const map: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '·': '.', '•': '-', '…': '.', '×': 'x', '€': 'E', '\u00a0': ' ' };
  const c = map[ch] ?? ch;
  if (c === '£') return [0x48, 0x7e, 0x49, 0x41, 0x42];
  if (c === '°') return [0x00, 0x06, 0x09, 0x06, 0x00];
  const code = c.charCodeAt(0);
  if (code < 32 || code > 126) return glyph('?');
  return FACE[code - 32] ?? glyph('?');
}

// ---------------------------------------------------------------- the canvas

export class Img {
  readonly px: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg: RGB = BG) {
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) this.px.set(bg, i * 3);
  }
  set(x: number, y: number, c: RGB, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    if (a >= 1) this.px.set(c, i);
    else for (let k = 0; k < 3; k++) this.px[i + k] = Math.round(this.px[i + k]! * (1 - a) + c[k]! * a);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    for (let j = Math.max(0, Math.round(y)); j < Math.min(this.h, Math.round(y + h)); j++) for (let i = Math.max(0, Math.round(x)); i < Math.min(this.w, Math.round(x + w)); i++) this.set(i, j, c, a);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 2, a = 1): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.rect(x - t / 2, y - t / 2, t, t, c, a);
    }
  }
  /** A filled polygon (even-odd, scanline), blended at `a`. */
  poly(pts: [number, number][], c: RGB, a = 1): void {
    if (pts.length < 3) return;
    const ys = pts.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(this.h - 1, Math.ceil(Math.max(...ys))); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k]!)); x < Math.min(this.w, Math.round(xs[k + 1]!)); x++) this.set(x, y, c, a);
    }
  }
  outline(pts: [number, number][], c: RGB, t = 1): void {
    for (let i = 0; i < pts.length; i++) this.line(pts[i]![0], pts[i]![1], pts[(i + 1) % pts.length]![0], pts[(i + 1) % pts.length]![1], c, t);
  }
  /** Text at `scale` (a character is 6 × scale wide, 8 × scale tall); `anchor` is where x is. */
  text(x: number, y: number, s: string, c: RGB, scale = 2, anchor: 'start' | 'middle' | 'end' = 'start'): void {
    const w = textWidth(s, scale);
    let px = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w;
    for (const ch of s) {
      const g = glyph(ch);
      for (let col = 0; col < 5; col++) for (let row = 0; row < 8; row++) if (g[col]! & (1 << row)) this.rect(px + col * scale, y + row * scale, scale, scale, c);
      px += 6 * scale;
    }
  }
}

export const textWidth = (s: string, scale = 2): number => [...s].length * 6 * scale;

// ---------------------------------------------------------------- the PNG

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const adler32 = (b: Uint8Array): number => {
  let a = 1;
  let s = 0;
  for (const x of b) {
    a = (a + x) % 65521;
    s = (s + a) % 65521;
  }
  return ((s << 16) | a) >>> 0;
};
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** zlib, through the platform's CompressionStream when it has one, else stored blocks (larger, always valid). */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'function') {
    try {
      const out = new Response(new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream('deflate')));
      return new Uint8Array(await out.arrayBuffer());
    } catch {
      /* stored below */
    }
  }
  const parts: number[] = [0x78, 0x01];
  for (let i = 0; i < data.length || i === 0; i += 65535) {
    const chunk = data.subarray(i, Math.min(data.length, i + 65535));
    const last = i + 65535 >= data.length;
    parts.push(last ? 1 : 0, chunk.length & 255, chunk.length >>> 8, ~chunk.length & 255, (~chunk.length >>> 8) & 255);
    for (const x of chunk) parts.push(x);
  }
  parts.push(...be32(adler32(data)));
  return Uint8Array.from(parts);
}

/** An image as a PNG (8-bit RGB, no filtering: the drawings are flat, so the compressor does the rest). */
export async function png(img: Img): Promise<Uint8Array> {
  const raw = new Uint8Array((img.w * 3 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 3 + 1)] = 0;
    raw.set(img.px.subarray(y * img.w * 3, (y + 1) * img.w * 3), y * (img.w * 3 + 1) + 1);
  }
  const chunk = (type: string, body: Uint8Array): number[] => {
    const t = Uint8Array.from([...type].map((c) => c.charCodeAt(0)));
    const both = new Uint8Array(t.length + body.length);
    both.set(t);
    both.set(body, t.length);
    return [...be32(body.length), ...both, ...be32(crc32(both))];
  };
  const ihdr = Uint8Array.from([...be32(img.w), ...be32(img.h), 8, 2, 0, 0, 0]);
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', await deflate(raw)), ...chunk('IEND', new Uint8Array())]);
}

/** A PNG's pixels (8-bit grey, grey+alpha, RGB, palette or RGBA, not interlaced), as RGB; null for anything else. */
export async function decodePng(b: Uint8Array): Promise<{ w: number; h: number; rgb: Uint8Array } | null> {
  if (b.length < 33 || b[0] !== 0x89 || b[1] !== 0x50) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let plte: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= b.length; ) {
    const len = dv.getUint32(at);
    const name = String.fromCharCode(b[at + 4]!, b[at + 5]!, b[at + 6]!, b[at + 7]!);
    const body = b.subarray(at + 8, at + 8 + len);
    if (name === 'IHDR') {
      w = dv.getUint32(at + 8);
      h = dv.getUint32(at + 12);
      depth = b[at + 16]!;
      type = b[at + 17]!;
      interlace = b[at + 20]!;
    } else if (name === 'PLTE') plte = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    at += 12 + len;
  }
  if (!w || !h || interlace || (depth !== 8 && !(type === 3 && depth <= 8))) return null;
  const channels = type === 0 ? 1 : type === 2 ? 3 : type === 3 ? 1 : type === 4 ? 2 : type === 6 ? 4 : 0;
  if (!channels) return null;
  const all = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of idat) {
    all.set(p, o);
    o += p.length;
  }
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await new Response(new Blob([all as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  } catch {
    return null;
  }
  const bits = depth * channels;
  const stride = Math.ceil((w * bits) / 8);
  const bpp = Math.max(1, bits >> 3);
  if (raw.length < (stride + 1) * h) return null;
  const rows = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= bpp ? rows[y * stride + x - bpp]! : 0;
      const up = y ? rows[(y - 1) * stride + x]! : 0;
      const c = x >= bpp && y ? rows[(y - 1) * stride + x - bpp]! : 0;
      const pa = Math.abs(up - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + up - 2 * c);
      rows[y * stride + x] = (v + (f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? up : c)) & 255;
    }
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (type === 3) {
        const idx = depth === 8 ? rows[y * stride + x]! : (rows[y * stride + ((x * depth) >> 3)]! >> (8 - depth - ((x * depth) & 7))) & ((1 << depth) - 1);
        if (!plte) return null;
        rgb[i] = plte[idx * 3] ?? 0;
        rgb[i + 1] = plte[idx * 3 + 1] ?? 0;
        rgb[i + 2] = plte[idx * 3 + 2] ?? 0;
      } else {
        const p = y * stride + x * channels;
        if (type === 0 || type === 4) rgb.fill(rows[p]!, i, i + 3);
        else {
          rgb[i] = rows[p]!;
          rgb[i + 1] = rows[p + 1]!;
          rgb[i + 2] = rows[p + 2]!;
        }
      }
    }
  }
  return { w, h, rgb };
}

// ---------------------------------------------------------------- the chart

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}.` : s);

/** The chart as the Stage draws it: the title in his words, the unit once, round ticks, the last value written, the sequence of colours. */
export function chartImage(ask: string, s: Series): Img {
  const lanes = [{ name: s.name ?? '', values: s.points.map((p) => p.value) }, ...(s.more ?? [])].slice(0, 4);
  const labels = s.points.map((p) => humanLabel(p.label));
  const W = 720;
  const head = 96;
  const all = lanes.flatMap((l) => l.values);
  const unit = s.unit ? (s.before ? s.unit : s.unit.toUpperCase()) : '';
  if (s.kind === 'bars') {
    const k = lanes.length;
    const row = k === 1 ? 44 : k * 14 + 18;
    const t = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
    const capChars = Math.min(14, Math.max(...labels.map((l) => l.length)));
    const x0 = 28 + capChars * 12 + 16;
    const figW = Math.max(...lanes.flatMap((l) => l.values.map((v) => figure(v, s).length))) * 12 + 20;
    const room = W - x0 - figW - 28;
    const H = head + labels.length * row + 90 + (k > 1 ? 40 : 0);
    const img = new Img(W, H);
    img.text(28, 28, clip(chartTitle(ask), 44), INK, 3);
    if (unit) img.text(28, 66, unit, INK3, 2);
    const xz = (v: number) => x0 + ((v - t.lo) / (t.hi - t.lo || 1)) * room;
    for (const tk of t.ticks) img.line(xz(tk), head - 6, xz(tk), head + labels.length * row, tk === 0 ? LINE : LINE, tk === 0 ? 2 : 1, tk === 0 ? 1 : 0.5);
    labels.forEach((l, i) => {
      const y = head + i * row;
      img.text(28, y + (row - 16) / 2, clip(l.toUpperCase(), 14), INK3, 2);
      lanes.forEach((lane, j) => {
        const v = lane.values[i]!;
        const bh = k === 1 ? 26 : 12;
        const by = y + 6 + j * (bh + 2);
        img.rect(Math.min(xz(0), xz(v)), by, Math.max(3, Math.abs(xz(v) - xz(0))), bh, SEQUENCE[j]!);
        img.text((v >= 0 ? xz(v) : xz(0)) + 10, by + (bh - 16) / 2 + 1, figure(v, s), INK, 2);
      });
    });
    const yb = head + labels.length * row + 12;
    const gap = room / Math.max(1, t.ticks.length - 1);
    const stride = Math.max(1, Math.ceil((Math.max(...t.ticks.map((v) => tickText(v).length)) * 12 + 14) / gap));
    t.ticks.forEach((tk, i) => (t.ticks.length - 1 - i) % stride === 0 && img.text(xz(tk), yb, tickText(tk), INK3, 2, 'middle'));
    if (k > 1) lanes.forEach((l, j) => (img.rect(28 + j * 170, yb + 44, 14, 14, SEQUENCE[j]!), img.text(48 + j * 170, yb + 43, clip((l.name || `SERIES ${j + 1}`).toUpperCase(), 11), INK3, 2)));
    return img;
  }
  const H = 520;
  const t = niceTicks(Math.min(...all) < 0 || Math.min(...all) <= Math.max(...all) * 0.6 ? Math.min(0, ...all) : Math.min(...all), Math.max(0, ...all), 4);
  const left = Math.max(...t.ticks.map((v) => tickText(v).length)) * 12 + 44;
  const right = W - 40;
  const top = head + 20;
  const bottom = H - 70;
  const img = new Img(W, H);
  img.text(28, 28, clip(chartTitle(ask), 44), INK, 3);
  if (unit) img.text(28, 66, unit, INK3, 2);
  const px = (i: number) => left + (i * (right - left)) / Math.max(1, labels.length - 1);
  const py = (v: number) => top + (1 - (v - t.lo) / (t.hi - t.lo || 1)) * (bottom - top);
  for (const tk of t.ticks) {
    img.line(left, py(tk), right, py(tk), LINE, tk === 0 ? 2 : 1, tk === 0 ? 1 : 0.5);
    img.text(left - 12, py(tk) - 8, tickText(tk), INK3, 2, 'end');
  }
  lanes.forEach((lane, j) => {
    lane.values.forEach((v, i) => i && img.line(px(i - 1), py(lane.values[i - 1]!), px(i), py(v), SEQUENCE[j]!, 4));
    lane.values.forEach((v, i) => img.rect(px(i) - 5, py(v) - 5, 10, 10, SEQUENCE[j]!));
  });
  const last = lanes[0]!.values.length - 1;
  const f = figure(lanes[0]!.values[last]!, s);
  img.text(Math.min(W - 12, px(last) + 8), py(lanes[0]!.values[last]!) - 30, f, INK, 2, 'end');
  const lw = Math.max(...labels.map((l) => l.length)) * 12 + 16;
  const stride = Math.max(1, Math.ceil(lw / ((right - left) / Math.max(1, labels.length - 1))));
  labels.forEach((l, i) => (labels.length - 1 - i) % stride === 0 && img.text(Math.max(left - 20, Math.min(W - 12 - textWidth(l.toUpperCase()) / 2, px(i))), bottom + 22, l.toUpperCase(), INK3, 2, 'middle'));
  if (lanes.length > 1) lanes.forEach((l, j) => (img.rect(28 + j * 170, H - 34, 14, 14, SEQUENCE[j]!), img.text(48 + j * 170, H - 35, clip((l.name || `SERIES ${j + 1}`).toUpperCase(), 11), INK3, 2)));
  return img;
}

// ---------------------------------------------------------------- the page

/** A letter or a plan as a page: margins, the title, the words wrapped, the rest of a long one cut with an ellipsis. */
export function pageImage(title: string, blocks: { t: string; text: string }[]): Img {
  const W = 720;
  const M = 56;
  const cols = Math.floor((W - 2 * M) / 12);
  const lines: { text: string; kind: 'title' | 'head' | 'body' }[] = [{ text: title, kind: 'title' }];
  for (const b of blocks.filter((x, i) => !(i === 0 && x.text.trim() === title.trim()))) {
    const head = b.t === 'h1' || b.t === 'h2' || b.t === 'h3';
    const text = b.t === 'ul' ? `- ${b.text}` : b.text;
    let row = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if ((row ? row.length + 1 : 0) + word.length > cols) {
        lines.push({ text: row, kind: head ? 'head' : 'body' });
        row = '';
      }
      row = row ? `${row} ${word}` : word;
    }
    if (row) lines.push({ text: row, kind: head ? 'head' : 'body' });
    lines.push({ text: '', kind: 'body' });
  }
  const maxLines = 40;
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = { text: '...', kind: 'body' };
  const H = M * 2 + shown.length * 26 + 20;
  const img = new Img(W, H, INK);
  let y = M;
  for (const l of shown) {
    if (l.kind === 'title') {
      img.text(M, y, clip(l.text, 36), BG, 3);
      img.text(M + 1, y, clip(l.text, 36), BG, 3);
      y += 44;
    } else {
      img.text(M, y, l.text, l.kind === 'head' ? BG : PLATE, 2);
      if (l.kind === 'head') img.text(M + 1, y, l.text, BG, 2);
      y += 26;
    }
  }
  return img;
}

// ---------------------------------------------------------------- the room and the part

/** Boxes in 3-D lit from above and to the left, a soft shadow on the ground, the sizes on the edges in the unit he used. */
export function isoImage(title: string, boxes: ReturnType<typeof partBoxes>, room: boolean, sizes: { unit: Parameters<typeof lengthIn>[1]; w: number; d: number; h: number }): Img {
  const W = 720;
  const H = 600;
  const img = new Img(W, H);
  img.text(28, 28, clip(title, 44), INK, 3);
  const yaw = 0.7;
  const { faces: fs, radius, scene } = faces(boxes, yaw, 0.5, room);
  const scale = (room ? 240 : 200) / radius;
  const at = (p: [number, number]): [number, number] => [W / 2 + p[0] * scale, 340 + p[1] * scale];
  img.poly(scene.ground.map(at), PLATE);
  if (scene.shadow) {
    // soft: the shadow's hull grown a little, three times, each faint
    const cx = scene.shadow.reduce((a, p) => a + p[0], 0) / scene.shadow.length;
    const cy = scene.shadow.reduce((a, p) => a + p[1], 0) / scene.shadow.length;
    for (const k of [1.12, 1.06, 1]) img.poly(scene.shadow.map((p) => at([cx + (p[0] - cx) * k, cy + (p[1] - cy) * k])), INK, 0.07);
  }
  for (const f of fs) {
    const pts = f.pts.map(at);
    img.poly(pts, INK, f.kind === 'floor' ? 0.06 + f.shade * 0.08 : 0.1 + f.shade * 0.34);
    img.outline(pts, LINE, 1);
  }
  // the sizes on the three edges nearest the eye
  const { x0, x1, z0, z1, y0, y1 } = scene.foot;
  const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const depth = corners.map(([x, z]) => scene.depthOf([x, y0, z]));
  const near = depth.indexOf(Math.max(...depth));
  const centre = at(scene.project([(x0 + x1) / 2, y0, (z0 + z1) / 2]));
  const tag = (a: [number, number], b: [number, number], v: number) => {
    const m = at(scene.project([(a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2]));
    const n = Math.hypot(m[0] - centre[0], m[1] - centre[1]) || 1;
    const x = Math.max(60, Math.min(W - 60, m[0] + ((m[0] - centre[0]) / n) * 40));
    const y = Math.max(70, Math.min(H - 30, m[1] + ((m[1] - centre[1]) / n) * 30));
    img.text(x, y - 8, lengthIn(v, sizes.unit), INK, 2, 'middle');
  };
  for (const j of [(near + 1) % 4, (near + 3) % 4]) tag(corners[near]!, corners[j]!, corners[near]![1] === corners[j]![1] ? sizes.w : sizes.d);
  const base = at(scene.project([corners[near]![0], y0, corners[near]![1]]));
  const top = at(scene.project([corners[near]![0], y1, corners[near]![1]]));
  const side = (base[0] + top[0]) / 2 >= centre[0] ? 1 : -1;
  img.text(Math.max(60, Math.min(W - 60, (base[0] + top[0]) / 2 + side * 46)), (base[1] + top[1]) / 2 - 8, lengthIn(sizes.h, sizes.unit), INK, 2, 'middle');
  img.text(28, H - 36, room ? 'BUILT FROM YOUR WORDS · NOT TO SCALE FOR BUILDING' : 'BUILT FROM YOUR SIZES · A FIRST ESTIMATE', INK3, 2);
  return img;
}

// ---------------------------------------------------------------- the map

const TILE_HOST = 'https://tile.openstreetmap.org';

/** OpenStreetMap's own tiles round a place, the pin drawn in the Machine's mark with the name beside it; null when a tile cannot be had. */
export async function mapImage(lat: number, lon: number, zoom: number, name: string, get: (url: string) => Promise<Uint8Array | null>): Promise<Img | null> {
  const z = Math.max(3, Math.min(18, Math.round(zoom)));
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  const wx = ((lon + 180) / 360) * n;
  const wy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  const cx = Math.floor(wx);
  const cy = Math.floor(wy);
  const big = new Img(768, 768, PLATE);
  const jobs: Promise<void>[] = [];
  let failed = false;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ty = cy + dy;
      if (ty < 0 || ty >= n) continue;
      const tx = (((cx + dx) % n) + n) % n;
      jobs.push(
        (async () => {
          const bytes = await get(`${TILE_HOST}/${z}/${tx}/${ty}.png`).catch(() => null);
          const t = bytes ? await decodePng(bytes) : null;
          if (!t || t.w !== 256 || t.h !== 256) {
            failed = true;
            return;
          }
          for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) big.set((dx + 1) * 256 + x, (dy + 1) * 256 + y, [t.rgb[(y * 256 + x) * 3]!, t.rgb[(y * 256 + x) * 3 + 1]!, t.rgb[(y * 256 + x) * 3 + 2]!]);
        })(),
      );
    }
  }
  await Promise.all(jobs);
  if (failed) return null;
  const px = 256 + (wx - cx) * 256;
  const py = 256 + (wy - cy) * 256;
  const W = 512;
  const H = 352;
  const out = new Img(W, H);
  const ox = Math.round(px - W / 2);
  const oy = Math.round(py - H / 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.set(x, y, [big.px[((oy + y) * 768 + ox + x) * 3]!, big.px[((oy + y) * 768 + ox + x) * 3 + 1]!, big.px[((oy + y) * 768 + ox + x) * 3 + 2]!]);
  // the pin: the Machine's square mark and its core, with the name beside it on a plate, never over it
  const [mx, my] = [W / 2, H / 2];
  out.frame(mx - 16, my - 16, 32, 32, SEQUENCE[0]!, 3);
  out.rect(mx - 5, my - 5, 10, 10, SEQUENCE[0]!);
  const label = clip(name, 22);
  out.rect(mx + 26, my - 14, textWidth(label) + 16, 28, PLATE);
  out.text(mx + 34, my - 8, label, INK, 2);
  out.rect(W - 230, H - 24, 230, 24, PLATE);
  out.text(W - 222, H - 18, '(C) OPENSTREETMAP', INK, 2);
  return out;
}

// ---------------------------------------------------------------- what a reply draws

export interface PicFacts {
  ask: string;
  reply: string;
  /** A place a screen command named (show_map): the only place that is ever drawn here, as a named place. */
  place?: { name: string; lat: number; lon: number; zoom: number };
  /** Tile bytes by address (the tiles the app already fetches), or null; absent: no map. */
  tile?: (url: string) => Promise<Uint8Array | null>;
}

/** The picture a reply would have drawn on the Stage, as a PNG; null when there is nothing to draw or it cannot be. */
export async function pictureFor(f: PicFacts): Promise<{ kind: 'chart' | 'document' | 'room' | 'part' | 'map'; png: Uint8Array } | null> {
  const ask = f.ask.trim();
  const reply = f.reply.trim();
  if (!ask || !reply) return null;
  try {
    if (f.place && f.tile && Number.isFinite(f.place.lat) && Number.isFinite(f.place.lon) && Math.abs(f.place.lat) <= 90 && Math.abs(f.place.lon) <= 180) {
      const m = await mapImage(f.place.lat, f.place.lon, f.place.zoom, f.place.name, f.tile);
      if (m) return { kind: 'map', png: await png(m) };
    }
    const room = roomAsked(ask);
    if (room) {
      const plan = roomPlanFor(room);
      const boxes = roomBoxesOf(plan, plan.items!.map((i) => (i as unknown as { kind: PartKind }).kind)).boxes;
      return { kind: 'room', png: await png(isoImage(`Room ${room.w / 100} x ${room.d / 100} m`, boxes, true, { unit: room.unit, w: room.w, d: room.d, h: plan.room.h ?? 240 })) };
    }
    const part = partAsked(ask);
    if (part) return { kind: 'part', png: await png(isoImage(`${part.name} ${part.dims.w} x ${part.dims.d} x ${part.dims.h} cm`, partBoxes(part.kind, part.dims), false, { unit: part.unit, w: part.dims.w, d: part.dims.d, h: part.dims.h })) };
    if (reply.length > 60 && writeAsked(ask)) {
      const doc = docFromReply(reply, ask, {});
      const blocks = doc.blocks.slice(0, 24).map((b) => ({ t: b.t, text: b.runs.map((r) => r.text).join('') })).filter((b) => b.text.trim());
      if (blocks.length >= 2) return { kind: 'document', png: await png(pageImage(doc.title.slice(0, 60), blocks)) };
    }
    const series = seriesFrom(reply);
    if (series) return { kind: 'chart', png: await png(chartImage(ask, series)) };
  } catch {
    return null;
  }
  return null;
}
