/**
 * A PHOTO OPENED (BRIEF-EDITOR-PHOTO): the picked file or a shared one decoded on the phone with its way up (the converter's own
 * decodePicture: createImageBitmap, 'from-image', then an <img>), the HEIC and RAW lines in his words, and the bytes kept exactly as they
 * came. A RAW needs a decoder the app does not have; it is said, never guessed at.
 */
import { decodePicture } from '../convert/run';
import { sniff, type Kind } from '../convert/bytes';
import type { RawInfo } from './raw';

const RAW_EXT = /\.(dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|3fr|erf|kdc|mef|mos|mrw|x3f)$/i;

/** True when the file is a camera RAW (by its name, or the TIFF-style header a RAW starts with and its extension). */
export function isRaw(name: string, head: Uint8Array): boolean {
  if (RAW_EXT.test(name)) return true;
  // Canon's CR3 is an ISO box file whose brand is "crx "
  return head.length >= 12 && String.fromCharCode(...head.subarray(4, 12)) === 'ftypcrx ';
}

/** A RAW shared in with no reader kept: the size and GET (the shelf and the editor draw the button). */
export const rawNeedsWords = (size: string): string => `This is a RAW. To open it I need the RAW reader (${size}): GET`;
/** The line for a RAW this phone cannot open at all (no WebAssembly or workers): with the reader kept, a RAW opens (photo/raw.ts). */
export const RAW_LINE = 'I can’t open RAW yet; a JPEG or HEIC of it works.';

export interface Opened {
  canvas: HTMLCanvasElement;
  /** The photo's own size, the right way up. */
  w: number;
  h: number;
  kind: Kind;
  /** A RAW opened through the RAW reader: what it said, and the lossless picture to keep beside the RAW's bytes (photo/raw.ts). */
  raw?: RawInfo;
  decoded?: Blob | null;
}

export interface OpenOpts {
  /** The picture kept beside a RAW (the store has it): read back instead of reading the RAW again. */
  decoded?: Blob | null;
  /** Hears the wait ("Reading the RAW… 28 MB"). */
  say?: (words: string) => void;
}

/** A photo as a canvas at its full size, or an error in his words. */
export async function openPhoto(file: Blob, name: string, o: OpenOpts = {}): Promise<Opened> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (isRaw(name, head)) {
    // the RAW reader is a download kept on his tap: with it the RAW opens, without it the line says its size and offers GET
    if (typeof Worker === 'undefined' || typeof WebAssembly !== 'object') throw new Error(RAW_LINE);
    const [{ openRaw }, { packHere, packSize }] = await Promise.all([import('./raw'), import('./packget')]);
    const r = await openRaw(file, name, { decoded: o.decoded, say: o.say, readerHere: () => packHere('raw'), readerWords: () => rawNeedsWords(packSize('raw')) });
    return { canvas: r.canvas, w: r.w, h: r.h, kind: 'tiff', raw: r.info, decoded: r.decoded };
  }
  const kind = sniff(head, name, file.type);
  if (!['jpg', 'png', 'webp', 'heic', 'gif', 'bmp', 'tiff'].includes(kind)) throw new Error(kind === 'unknown' ? 'That is not a picture I can open here.' : `That is ${kind === 'pdf' ? 'a PDF' : 'not a picture'}: I edit photos here (JPEG, PNG, WebP, and HEIC where this phone opens it).`);
  const pic = await decodePicture(file, kind);
  try {
    const c = document.createElement('canvas');
    c.width = pic.w;
    c.height = pic.h;
    const g = c.getContext('2d');
    if (!g) throw new Error('This phone would not give me a canvas.');
    g.drawImage(pic.img, 0, 0);
    return { canvas: c, w: pic.w, h: pic.h, kind };
  } finally {
    pic.close();
  }
}
