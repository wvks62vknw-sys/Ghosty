/**
 * STRIP LOCATION (BRIEF-REST-E part 1): where a photo was taken taken out of it, and said as what it removes. In a JPEG,
 * the camera's GPS block is emptied in place (every byte of it zeroed, its pointer left to an empty block), so the
 * picture, its way up and its date stay exactly as they were, not re-compressed; the XMP and Photoshop blocks, which can
 * repeat the place, go. In a PNG or WebP, the EXIF and XMP chunks go. Pure.
 */
import { concat } from './bytes';

export interface Stripped {
  bytes: Uint8Array;
  /** What went, in words ("the GPS position (latitude, longitude, altitude)", "an XMP block"). */
  removed: string[];
}

const ascii = (b: Uint8Array, a: number, n: number) => String.fromCharCode(...b.subarray(a, a + n));

/** Empty the GPS directory of an EXIF block (TIFF header first), in place; true when there was one with entries. */
function emptyGps(t: Uint8Array): boolean {
  if (t.length < 8) return false;
  const le = t[0] === 0x49;
  const u16 = (o: number) => (le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
  const u32 = (o: number) => (le ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0 : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0);
  const ifd0 = u32(4);
  if (ifd0 + 2 > t.length) return false;
  const n = u16(ifd0);
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > t.length || u16(e) !== 0x8825) continue;
    const gps = u32(e + 8);
    if (gps + 2 > t.length) return false;
    const count = u16(gps);
    if (!count) return false;
    const SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    for (let k = 0; k < count; k++) {
      const g = gps + 2 + k * 12;
      if (g + 12 > t.length) break;
      const bytes = (SIZE[u16(g + 2)] ?? 1) * u32(g + 4);
      // a value longer than four bytes lives elsewhere in the block: zeroed there too
      if (bytes > 4) {
        const at = u32(g + 8);
        if (at + bytes <= t.length) t.fill(0, at, at + bytes);
      }
    }
    // the directory itself: no entries, no next directory
    t.fill(0, gps, Math.min(t.length, gps + 2 + count * 12 + 4));
    return true;
  }
  return false;
}

/** A JPEG with its location taken out. */
function stripJpeg(b: Uint8Array): Stripped {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  const removed: string[] = [];
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1]!;
    if (m === 0xda || m === 0xd9) break;
    const len = (b[p + 2]! << 8) | b[p + 3]!;
    const seg = b.slice(p, p + 2 + len);
    if (m === 0xe1 && ascii(seg, 4, 6) === 'Exif\0\0') {
      if (emptyGps(seg.subarray(10))) removed.push('the GPS position (latitude, longitude, altitude and direction)');
      out.push(seg);
    } else if (m === 0xe1 && ascii(seg, 4, 28).startsWith('http://ns.adobe.com/xap/1.0/')) removed.push('an XMP block (it can repeat the place)');
    else if (m === 0xed) removed.push('a Photoshop block (it can name the place)');
    else out.push(seg);
    p += 2 + len;
  }
  out.push(b.subarray(p));
  return { bytes: concat(out), removed };
}

/** A PNG without its EXIF, XMP and text chunks (the text can hold a place too). */
function stripPng(b: Uint8Array): Stripped {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Uint8Array[] = [b.subarray(0, 8)];
  const removed = new Set<string>();
  let p = 8;
  while (p + 12 <= b.length) {
    const len = dv.getUint32(p);
    const type = ascii(b, p + 4, 4);
    const end = p + 12 + len;
    if (type === 'eXIf') removed.add('an EXIF block (the camera’s details, the place among them)');
    else if (type === 'iTXt' || type === 'tEXt' || type === 'zTXt') removed.add('text notes (XMP and the like)');
    else out.push(b.subarray(p, end));
    p = end;
    if (type === 'IEND') break;
  }
  return { bytes: concat(out), removed: [...removed] };
}

/** A WebP without its EXIF and XMP chunks, its header's flags and size put right. */
function stripWebp(b: Uint8Array): Stripped {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Uint8Array[] = [];
  const removed: string[] = [];
  let p = 12;
  while (p + 8 <= b.length) {
    const type = ascii(b, p, 4);
    const len = dv.getUint32(p + 4, true);
    const end = p + 8 + len + (len & 1);
    if (type === 'EXIF') removed.push('an EXIF block (the camera’s details, the place among them)');
    else if (type === 'XMP ') removed.push('an XMP block (it can repeat the place)');
    else {
      const c = b.slice(p, end);
      if (type === 'VP8X') c[8] = c[8]! & ~0x0c; // no EXIF, no XMP
      out.push(c);
    }
    p = end;
  }
  const body = concat(out);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  return { bytes: concat([head, body]), removed };
}

/** The picture with where it was taken removed, and what went, in words (nothing: there was no location in it). */
export function stripLocation(b: Uint8Array): Stripped {
  if (b[0] === 0xff && b[1] === 0xd8) return stripJpeg(b);
  if (b[0] === 0x89 && b[1] === 0x50) return stripPng(b);
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return stripWebp(b);
  throw new Error('I can take the location out of JPEG, PNG and WebP pictures (an iPhone HEIC photo: convert it to JPG first, which leaves the location behind)');
}

/** Where a JPEG says it was taken, in degrees (null: it does not say). For the sheet's "it said: 52.48, -1.89". */
export function gpsOf(b: Uint8Array): { lat: number; lon: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1]!;
    if (m === 0xda) break;
    const len = (b[p + 2]! << 8) | b[p + 3]!;
    if (m === 0xe1 && ascii(b, p + 4, 6) === 'Exif\0\0') {
      const t = b.subarray(p + 10, p + 2 + len);
      const le = t[0] === 0x49;
      const u16 = (o: number) => (le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
      const u32 = (o: number) => (le ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0 : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0);
      const ifd0 = u32(4);
      for (let i = 0; i < u16(ifd0); i++) {
        const e = ifd0 + 2 + i * 12;
        if (u16(e) !== 0x8825) continue;
        const gps = u32(e + 8);
        const tags = new Map<number, { at: number; ref: string }>();
        for (let k = 0; k < u16(gps); k++) {
          const g = gps + 2 + k * 12;
          tags.set(u16(g), { at: u32(g + 8), ref: ascii(t, g + 8, 1) });
        }
        const deg = (tag: number) => {
          const x = tags.get(tag);
          if (!x) return null;
          const r = (o: number) => u32(x.at + o * 8) / (u32(x.at + o * 8 + 4) || 1);
          return r(0) + r(1) / 60 + r(2) / 3600;
        };
        const lat = deg(2);
        const lon = deg(4);
        if (lat === null || lon === null) return null;
        return { lat: tags.get(1)?.ref === 'S' ? -lat : lat, lon: tags.get(3)?.ref === 'W' ? -lon : lon };
      }
    }
    p += 2 + len;
  }
  return null;
}
