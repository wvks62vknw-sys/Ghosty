/**
 * OUR OWN PDF WRITER (BRIEF-REST-E part 1): pages of pictures and of words, nothing else, and no library. A JPEG goes in
 * as it is (/DCTDecode: a page costs the photo's own bytes); a PNG as a Flate stream — its own compressed data with the
 * PNG predictor when it is plain 8-bit grey or colour, else its pixels taken out here (with its transparency as a soft
 * mask). Words are set in the standard fonts every reader has (fonts.ts), WinAnsi-encoded. The cross-reference table
 * gives every object's exact byte offset. Pure: the PDF it makes is read back by pdf.js in apps/edge/test/reste.test.mjs.
 */
import { adler32, concat, utf8 } from './bytes';
import { ansiBytes, type PdfFont } from './fonts';
import { inflate, zlibStored } from './inflate';

/** A4 in points (1/72 inch). */
export const A4 = { w: 595.28, h: 841.89 } as const;

export interface PdfImage {
  w: number;
  h: number;
  filter: 'DCTDecode' | 'FlateDecode';
  data: Uint8Array;
  space: 'DeviceRGB' | 'DeviceGray' | 'DeviceCMYK';
  /** /DecodeParms, as PDF words (the PNG predictor). */
  parms?: string;
  /** /Decode, as PDF words (an Adobe CMYK JPEG is stored inverted). */
  decode?: string;
  /** Its transparency, a grey picture of the same size. */
  smask?: PdfImage;
}
export interface PdfRun {
  x: number;
  y: number;
  text: string;
  font: PdfFont;
  size: number;
  /** 0–1 each; black when left out. */
  rgb?: [number, number, number];
}
export interface PdfPage {
  w: number;
  h: number;
  images?: { img: PdfImage; x: number; y: number; w: number; h: number }[];
  runs?: PdfRun[];
  /** Straight lines (a rule under a heading, an underline): from, to, thickness. */
  lines?: { x1: number; y1: number; x2: number; y2: number; width: number; rgb?: [number, number, number] }[];
}

const num = (n: number): string => (Math.round(n * 1000) / 1000).toString();
const rgbOp = (c: [number, number, number] | undefined, stroke: boolean) => `${(c ?? [0, 0, 0]).map(num).join(' ')} ${stroke ? 'RG' : 'rg'}`;

/** A PDF literal string's bytes for WinAnsi text: ( \ ) escaped, the high letters as octal. */
function literal(text: string): string {
  let s = '(';
  for (const b of ansiBytes(text)) {
    if (b === 40 || b === 41 || b === 92) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}

/** A text string for the document's information (title, author): UTF-16 with its byte-order mark, in hex. */
function textString(t: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < t.length; i++) hex += t.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

/** Where a picture sits in a box: as big as fits, centred. */
export function fitBox(w: number, h: number, box: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  const k = Math.min(box.w / w, box.h / h);
  return { x: box.x + (box.w - w * k) / 2, y: box.y + (box.h - h * k) / 2, w: w * k, h: h * k };
}

/**
 * A page for one picture: A4 (turned to suit the picture, with a small margin) or the picture's own shape (its long side
 * as long as A4's, no margin).
 */
export function picturePage(img: PdfImage, size: 'a4' | 'fit' = 'a4', margin = 24): PdfPage {
  const wide = img.w > img.h;
  if (size === 'fit') {
    const k = A4.h / Math.max(img.w, img.h);
    const w = img.w * k;
    const h = img.h * k;
    return { w, h, images: [{ img, x: 0, y: 0, w, h }] };
  }
  const page = wide ? { w: A4.h, h: A4.w } : { w: A4.w, h: A4.h };
  return { ...page, images: [{ img, ...fitBox(img.w, img.h, { x: margin, y: margin, w: page.w - 2 * margin, h: page.h - 2 * margin }) }] };
}

/** The PDF of these pages. */
export function writePdf(pages: PdfPage[], info: { title?: string; author?: string } = {}): Uint8Array {
  const objs: (string | Uint8Array)[] = [];
  const add = (body: string | Uint8Array): number => objs.push(body);
  const stream = (dict: string, data: Uint8Array): Uint8Array => concat([utf8.encode(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, utf8.encode('\nendstream')]);
  // 1 the catalogue, 2 the page tree: filled in at the end
  add('');
  add('');
  const fonts = new Map<PdfFont, number>();
  const fontRef = (f: PdfFont) => {
    let n = fonts.get(f);
    if (!n) {
      n = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
      fonts.set(f, n);
    }
    return n;
  };
  const images = new Map<PdfImage, number>();
  const imageRef = (img: PdfImage): number => {
    let n = images.get(img);
    if (n) return n;
    const sm = img.smask ? imageRef(img.smask) : 0;
    const dict = `/Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /${img.space} /BitsPerComponent 8 /Filter /${img.filter}${img.parms ? ` /DecodeParms ${img.parms}` : ''}${img.decode ? ` /Decode ${img.decode}` : ''}${sm ? ` /SMask ${sm} 0 R` : ''}`;
    n = add(stream(dict, img.data));
    images.set(img, n);
    return n;
  };
  const kids: number[] = [];
  for (const p of pages) {
    const ops: string[] = [];
    const xo: string[] = [];
    for (const [i, im] of (p.images ?? []).entries()) {
      const ref = imageRef(im.img);
      xo.push(`/Im${i} ${ref} 0 R`);
      ops.push(`q ${num(im.w)} 0 0 ${num(im.h)} ${num(im.x)} ${num(im.y)} cm /Im${i} Do Q`);
    }
    for (const l of p.lines ?? []) ops.push(`q ${rgbOp(l.rgb, true)} ${num(l.width)} w ${num(l.x1)} ${num(l.y1)} m ${num(l.x2)} ${num(l.y2)} l S Q`);
    const used: PdfFont[] = [];
    if (p.runs?.length) {
      ops.push('BT');
      let font = '';
      let colour = '';
      for (const r of p.runs) {
        if (!used.includes(r.font)) used.push(r.font);
        const f = `/F${used.indexOf(r.font) + 1} ${num(r.size)} Tf`;
        if (f !== font) ops.push((font = f));
        const c = rgbOp(r.rgb, false);
        if (c !== colour) ops.push((colour = c));
        ops.push(`1 0 0 1 ${num(r.x)} ${num(r.y)} Tm ${literal(r.text)} Tj`);
      }
      ops.push('ET');
    }
    const content = add(stream('', utf8.encode(ops.join('\n'))));
    const res = [
      used.length ? `/Font << ${used.map((f, i) => `/F${i + 1} ${fontRef(f)} 0 R`).join(' ')} >>` : '',
      xo.length ? `/XObject << ${xo.join(' ')} >>` : '',
    ].filter(Boolean).join(' ');
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] /Resources << /ProcSet [/PDF /Text /ImageB /ImageC] ${res} >> /Contents ${content} 0 R >>`));
  }
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const infoRef = add(`<< /Producer ${textString('Ghosty, on the phone')}${info.title ? ` /Title ${textString(info.title)}` : ''}${info.author ? ` /Author ${textString(info.author)}` : ''} >>`);
  // the file: header, the objects at known offsets, the table of those offsets, the trailer
  const parts: Uint8Array[] = [utf8.encode('%PDF-1.4\n'), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let at = parts[0]!.length + parts[1]!.length;
  const offsets: number[] = [];
  for (const [i, body] of objs.entries()) {
    const chunk = concat([utf8.encode(`${i + 1} 0 obj\n`), typeof body === 'string' ? utf8.encode(body) : body, utf8.encode('\nendobj\n')]);
    offsets.push(at);
    parts.push(chunk);
    at += chunk.length;
  }
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  parts.push(utf8.encode(`${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoRef} 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return concat(parts);
}

// ---------------------------------------------------------------- pictures in

/** A JPEG's size, colours and the way up its camera recorded (EXIF orientation 1–8; 1 when none). */
export function jpegInfo(b: Uint8Array): { w: number; h: number; comps: number; adobe: boolean; orientation: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let p = 2;
  let adobe = false;
  let orientation = 1;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) {
      p++;
      continue;
    }
    const m = b[p + 1]!;
    if (m === 0xff) {
      p++;
      continue;
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      p += 2;
      continue;
    }
    const len = (b[p + 2]! << 8) | b[p + 3]!;
    if (m === 0xee && String.fromCharCode(...b.subarray(p + 4, p + 9)) === 'Adobe') adobe = true;
    if (m === 0xe1 && String.fromCharCode(...b.subarray(p + 4, p + 8)) === 'Exif') orientation = exifOrientation(b.subarray(p + 10, p + 2 + len));
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: (b[p + 5]! << 8) | b[p + 6]!, w: (b[p + 7]! << 8) | b[p + 8]!, comps: b[p + 9]!, adobe, orientation };
    }
    if (m === 0xda) break;
    p += 2 + len;
  }
  return null;
}

/** The orientation tag (0x0112) of an EXIF block's first directory (its TIFF header first). */
function exifOrientation(t: Uint8Array): number {
  if (t.length < 8) return 1;
  const le = t[0] === 0x49;
  const u16 = (o: number) => (le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
  const u32 = (o: number) => (le ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0 : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0);
  const ifd = u32(4);
  if (ifd + 2 > t.length) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) break;
    if (u16(e) === 0x0112) return u16(e + 8) || 1;
  }
  return 1;
}

/** A JPEG for the PDF, as it is (null: not one a PDF can hold: no size found). */
export function jpegImage(b: Uint8Array): PdfImage | null {
  const j = jpegInfo(b);
  if (!j || !j.w || !j.h) return null;
  const space = j.comps === 1 ? 'DeviceGray' : j.comps === 4 ? 'DeviceCMYK' : 'DeviceRGB';
  return { w: j.w, h: j.h, filter: 'DCTDecode', data: b, space, ...(j.comps === 4 && j.adobe ? { decode: '[1 0 1 0 1 0 1 0]' } : {}) };
}

/** A PNG's header and its compressed picture data (IDAT, joined). */
export function pngInfo(b: Uint8Array): { w: number; h: number; depth: number; type: number; interlace: number; idat: Uint8Array; plte?: Uint8Array; trns?: Uint8Array } | null {
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  let head: { w: number; h: number; depth: number; type: number; interlace: number } | null = null;
  const idat: Uint8Array[] = [];
  let plte: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  while (p + 8 <= b.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(...b.subarray(p + 4, p + 8));
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') head = { w: dv.getUint32(p + 8), h: dv.getUint32(p + 12), depth: b[p + 16]!, type: b[p + 17]!, interlace: b[p + 20]! };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  return head ? { ...head, idat: concat(idat), ...(plte ? { plte } : {}), ...(trns ? { trns } : {}) } : null;
}

/** PNG scanlines with their filters undone (8-bit samples, `bpp` bytes a pixel). */
export function unfilter(raw: Uint8Array, w: number, h: number, bpp: number): Uint8Array {
  const stride = w * bpp;
  const out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = out.subarray(y * stride, (y + 1) * stride);
    const up = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp]! : 0;
      const bb = up ? up[x]! : 0;
      const c = up && x >= bpp ? up[x - bpp]! : 0;
      let v = src[x]!;
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - bb);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
      }
      row[x] = v & 0xff;
    }
  }
  return out;
}

/** zlib data from bytes: the phone's compressor when it has one (CompressionStream), else stored blocks. */
export type Deflate = (data: Uint8Array) => Promise<Uint8Array>;
export const storedDeflate: Deflate = async (d) => zlibStored(d, adler32(d));

/**
 * A PNG for the PDF: its own compressed data with the PNG predictor when it is 8-bit grey or colour and not interlaced
 * (nothing decoded at all); 8-bit palette, grey-and-alpha and colour-and-alpha pictures are decoded here and their
 * transparency kept as a soft mask. Null for 16-bit and interlaced PNGs (the phone draws those on a canvas instead).
 */
export async function pngImage(b: Uint8Array, deflate: Deflate = storedDeflate): Promise<PdfImage | null> {
  const p = pngInfo(b);
  if (!p || p.depth !== 8 || p.interlace) return null;
  if (p.type === 0 || p.type === 2) {
    const colors = p.type === 2 ? 3 : 1;
    return { w: p.w, h: p.h, filter: 'FlateDecode', data: p.idat, space: colors === 3 ? 'DeviceRGB' : 'DeviceGray', parms: `<< /Predictor 15 /Colors ${colors} /BitsPerComponent 8 /Columns ${p.w} >>` };
  }
  const bpp = p.type === 6 ? 4 : p.type === 4 ? 2 : p.type === 3 ? 1 : 0;
  if (!bpp) return null;
  const px = unfilter(inflate(p.idat, (p.w * bpp + 1) * p.h), p.w, p.h, bpp);
  const n = p.w * p.h;
  const colour = new Uint8Array(n * (p.type === 4 ? 1 : 3));
  const alpha = new Uint8Array(n);
  let opaque = true;
  for (let i = 0; i < n; i++) {
    if (p.type === 6) {
      colour.set(px.subarray(i * 4, i * 4 + 3), i * 3);
      alpha[i] = px[i * 4 + 3]!;
    } else if (p.type === 4) {
      colour[i] = px[i * 2]!;
      alpha[i] = px[i * 2 + 1]!;
    } else {
      const k = px[i]!;
      colour[i * 3] = p.plte?.[k * 3] ?? 0;
      colour[i * 3 + 1] = p.plte?.[k * 3 + 1] ?? 0;
      colour[i * 3 + 2] = p.plte?.[k * 3 + 2] ?? 0;
      alpha[i] = p.trns && k < p.trns.length ? p.trns[k]! : 255;
    }
    if (alpha[i] !== 255) opaque = false;
  }
  const grey = p.type === 4;
  const img: PdfImage = { w: p.w, h: p.h, filter: 'FlateDecode', data: await deflate(colour), space: grey ? 'DeviceGray' : 'DeviceRGB' };
  if (!opaque) img.smask = { w: p.w, h: p.h, filter: 'FlateDecode', data: await deflate(alpha), space: 'DeviceGray' };
  return img;
}

/** Pixels a canvas gave (RGBA) for the PDF: the colour, and the transparency as a soft mask when there is any. */
export async function rgbaImage(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, deflate: Deflate = storedDeflate): Promise<PdfImage> {
  const n = w * h;
  const colour = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let opaque = true;
  for (let i = 0; i < n; i++) {
    colour[i * 3] = rgba[i * 4]!;
    colour[i * 3 + 1] = rgba[i * 4 + 1]!;
    colour[i * 3 + 2] = rgba[i * 4 + 2]!;
    alpha[i] = rgba[i * 4 + 3]!;
    if (alpha[i] !== 255) opaque = false;
  }
  const img: PdfImage = { w, h, filter: 'FlateDecode', data: await deflate(colour), space: 'DeviceRGB' };
  if (!opaque) img.smask = { w, h, filter: 'FlateDecode', data: await deflate(alpha), space: 'DeviceGray' };
  return img;
}
