/**
 * The camera behind a photo, from its EXIF (pure, unit-tested in apps/edge/test/measure.test.mjs):
 * the make and model, the focal length (real and "35 mm equivalent") and the picture's own size,
 * read straight from the JPEG's bytes. MEASURE turns that into the camera's focal length in
 * pixels — how many pixels one metre spans at one metre away — which is what makes a size from
 * a depth map come out in real units.
 *
 * The 35 mm equivalent is the one that matters: phones (iPhone included) write it against the
 * 43.27 mm diagonal of a 36 × 24 mm frame, so focal (px) = f35 × the picture's diagonal (px) /
 * 43.27. An iPhone 13's main camera (26 mm) gives about 3,030 px across a 4032 × 3024 photo, a
 * 67° view across the long side. A picture without EXIF (a screenshot, a frame from the live
 * camera, a photo an app stripped) falls back to the iPhone 13 main camera's 69°, and says so.
 */

export interface Exif {
  make?: string;
  model?: string;
  lens?: string;
  /** The real focal length, mm. */
  focalMm?: number;
  /** The 35 mm-equivalent focal length, mm. */
  focal35?: number;
  /** The picture's size as the camera wrote it (before any rotation). */
  width?: number;
  height?: number;
  /** 1 = upright; 6/8 = turned a quarter (the browser shows it turned already). */
  orientation?: number;
}

/** The diagonal of a 36 × 24 mm frame, mm. */
export const FULL_FRAME_DIAGONAL = Math.hypot(36, 24);
/** The iPhone 13 wide (main) camera's view across the long side, degrees (as measure/geom.ts). */
const DEFAULT_LONG_FOV = 69;

/**
 * EXIF from a JPEG's bytes; null when there is none (not a JPEG, no APP1 Exif block, or a broken one).
 * Only the few tags MEASURE needs are read; everything else is skipped.
 */
export function readExif(bytes: Uint8Array): Exif | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xd9 || marker === 0xda) return null; // end of picture / start of the pixels: no EXIF before them
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2) return null;
    if (marker === 0xe1 && len >= 8 && ascii(bytes, i + 4, 6) === 'Exif\0\0') {
      try {
        return readTiff(bytes, i + 10, Math.min(bytes.length, i + 2 + len));
      } catch {
        return null;
      }
    }
    i += 2 + len;
  }
  return null;
}

function ascii(b: Uint8Array, at: number, n: number): string {
  let s = '';
  for (let k = 0; k < n && at + k < b.length; k++) s += String.fromCharCode(b[at + k]!);
  return s;
}

/** The TIFF block inside APP1: header, IFD0, then the Exif sub-IFD. */
function readTiff(b: Uint8Array, start: number, end: number): Exif | null {
  const little = ascii(b, start, 2) === 'II';
  if (!little && ascii(b, start, 2) !== 'MM') return null;
  const u16 = (o: number) => {
    const p = start + o;
    if (p + 2 > end) throw new Error('short');
    return little ? b[p]! | (b[p + 1]! << 8) : (b[p]! << 8) | b[p + 1]!;
  };
  const u32 = (o: number) => {
    const p = start + o;
    if (p + 4 > end) throw new Error('short');
    return little ? (b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16)) + b[p + 3]! * 0x1000000 : b[p]! * 0x1000000 + ((b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!);
  };
  if (u16(2) !== 42) return null;
  const out: Exif = {};
  /** One tag's value: type 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL (the first value only). */
  const value = (entry: number): string | number | undefined => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const size = ({ 2: 1, 3: 2, 4: 4, 5: 8 } as Record<number, number>)[type];
    if (!size || count < 1) return undefined;
    const at = size * count <= 4 ? entry + 8 : u32(entry + 8);
    if (type === 2) return ascii(b, start + at, Math.min(count, 200)).replace(/\0.*$/s, '').trim() || undefined;
    if (type === 3) return u16(at);
    if (type === 4) return u32(at);
    const den = u32(at + 4);
    return den ? u32(at) / den : undefined;
  };
  const walk = (ifd: number, f: (tag: number, entry: number) => void) => {
    const n = u16(ifd);
    if (n > 500) throw new Error('not an IFD');
    for (let k = 0; k < n; k++) f(u16(ifd + 2 + k * 12), ifd + 2 + k * 12);
  };
  let exifIfd = 0;
  walk(u32(4), (tag, e) => {
    if (tag === 0x010f) out.make = value(e) as string | undefined;
    else if (tag === 0x0110) out.model = value(e) as string | undefined;
    else if (tag === 0x0112) out.orientation = value(e) as number | undefined;
    else if (tag === 0x8769) exifIfd = Number(value(e)) || 0;
  });
  if (exifIfd) {
    walk(exifIfd, (tag, e) => {
      const v = value(e);
      if (tag === 0x920a && typeof v === 'number' && v > 0) out.focalMm = v;
      else if (tag === 0xa405 && typeof v === 'number' && v > 0) out.focal35 = v;
      else if (tag === 0xa002 && typeof v === 'number' && v > 0) out.width = v;
      else if (tag === 0xa003 && typeof v === 'number' && v > 0) out.height = v;
      else if (tag === 0xa434 && typeof v === 'string') out.lens = v;
    });
  }
  for (const k of Object.keys(out) as (keyof Exif)[]) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : null;
}

/** The camera's pinhole model for a picture: focal length and centre in that picture's pixels. */
export interface Intrinsics {
  /** Focal length, pixels of the picture being measured. */
  f: number;
  cx: number;
  cy: number;
  /** Where the focal length came from, in words for the owner. */
  source: string;
  /** 'exif': read from the photo; 'default': the iPhone 13 main camera assumed. */
  kind: 'exif' | 'default';
  /** The view across the long side, degrees (for the status line). */
  longFov: number;
}

/**
 * The intrinsics of a picture `frame` px in size (as shown: after the browser turned it upright
 * and after any downscaling). The 35 mm equivalent describes the whole frame the camera saw, so
 * it is applied to this picture's diagonal; a picture whose shape does not match the camera's
 * own (cropped afterwards) still gets an answer but says it may be off.
 */
export function intrinsicsFor(frame: { w: number; h: number }, exif: Exif | null): Intrinsics {
  const cx = frame.w / 2;
  const cy = frame.h / 2;
  const long = Math.max(frame.w, frame.h);
  const fov = (f: number) => (2 * Math.atan(long / 2 / f) * 180) / Math.PI;
  const f35 = exif?.focal35;
  if (f35 && f35 >= 8 && f35 <= 400) {
    let f = (f35 * Math.hypot(frame.w, frame.h)) / FULL_FRAME_DIAGONAL;
    const camera = [exif?.make, exif?.model].filter(Boolean).join(' ').replace(/^(\w+) \1/i, '$1');
    let source = `${camera || 'the camera'}, ${Math.round(f35)} mm lens (from the photo)`;
    const ew = exif?.width;
    const eh = exif?.height;
    if (ew && eh) {
      const a = Math.max(ew, eh) / Math.min(ew, eh);
      const b = long / Math.min(frame.w, frame.h);
      if (Math.abs(a - b) / a > 0.02) {
        // cropped after it was taken: the pixels kept their scale, so use the camera's own diagonal, scaled to this picture's long side
        f = ((f35 * Math.hypot(ew, eh)) / FULL_FRAME_DIAGONAL) * (long / Math.max(ew, eh));
        source += ', cropped since: a little less sure';
      }
    }
    return { f, cx, cy, source, kind: 'exif', longFov: fov(f) };
  }
  const f = long / 2 / Math.tan(((DEFAULT_LONG_FOV / 2) * Math.PI) / 180);
  return { f, cx, cy, source: 'no camera details in the picture: an iPhone main camera assumed', kind: 'default', longFov: DEFAULT_LONG_FOV };
}
