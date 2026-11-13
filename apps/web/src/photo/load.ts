/**
 * A PHOTO OPENED (BRIEF-EDITOR-PHOTO): the picked file or a shared one decoded on the phone with its way up (the converter's own
 * decodePicture: createImageBitmap, 'from-image', then an <img>), the HEIC and RAW lines in his words, and the bytes kept exactly as they
 * came. A RAW needs a decoder the app does not have; it is said, never guessed at.
 */
import { decodePicture } from '../convert/run';
import { sniff, type Kind } from '../convert/bytes';

const RAW_EXT = /\.(dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|3fr|erf|kdc|mef|mos|mrw|x3f)$/i;

/** True when the file is a camera RAW (by its name, or the TIFF-style header a RAW starts with and its extension). */
export function isRaw(name: string, head: Uint8Array): boolean {
  if (RAW_EXT.test(name)) return true;
  // Canon's CR3 is an ISO box file whose brand is "crx "
  return head.length >= 12 && String.fromCharCode(...head.subarray(4, 12)) === 'ftypcrx ';
}

export const RAW_LINE = 'I can’t open RAW yet; a JPEG or HEIC of it works.';

export interface Opened {
  canvas: HTMLCanvasElement;
  /** The photo's own size, the right way up. */
  w: number;
  h: number;
  kind: Kind;
}

/** A photo as a canvas at its full size, or an error in his words. */
export async function openPhoto(file: Blob, name: string): Promise<Opened> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (isRaw(name, head)) throw new Error(RAW_LINE);
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
