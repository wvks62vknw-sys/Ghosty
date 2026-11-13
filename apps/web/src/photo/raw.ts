/**
 * OPEN RAW (BRIEF-EDITOR-PHOTO-2): a camera RAW (CR2, CR3, NEF, ARW, DNG, RAF, ORF and the rest LibRaw reads) opened through the RAW reader, a
 * separately fetched WebAssembly build of a free RAW decoder (public/vendor/raw, kept on the phone on his tap: offline/eyes.ts EYES_RAW),
 * in a worker of its own. The reader demosaics to a 16-bit picture with the camera's own white balance (the numbers written in the file);
 * that picture is kept losslessly beside the RAW's bytes (photo/png16.ts, the RAW untouched as the original of record, so EXPORT ORIGINAL
 * gives it back byte-equal), and the editor works on a developed eight-bit copy with a soft shoulder, so the brightest parts the sensor held
 * are still there for the highlights to pull back (a RAW is exposed for them to be). Nothing leaves the phone.
 */
import { decodePng16, encodePng16 } from './png16';
import { trail } from '../ui/hisWords';

/** What the worker answers (public/vendor/raw/worker.mjs). */
export interface RawRead {
  w: number;
  h: number;
  colors: number;
  data: Uint16Array;
  half: boolean;
  make: string;
  model: string;
}
export interface RawInfo {
  make: string;
  model: string;
  /** Read at half size (a sensor over 40 megapixels: the phone's memory is the limit). */
  half: boolean;
  /** The picture the editor works on: how much the baseline brightened it, in stops. */
  stops: number;
  /** The reading took this long (ms), 0 when the kept picture was read back. */
  ms: number;
}

/** The words for a file the reader could not open (`code` is LibRaw's own; `name` the file's). Pure. */
export function rawRefusal(code: number, name: string): string {
  if (code === -2 || code === -100009 || code === -100008 || code === -1) return `I could not open ${name} as a RAW: it is not a RAW file I know, or it is cut short. A JPEG or HEIC of it works.`;
  if (code === -3) return `I can’t read that kind of RAW yet (${name}): it uses a compression this reader does not have. A JPEG or HEIC of it works.`;
  if (code === -100007 || code === -100006) return `This phone ran out of memory reading ${name}. Close other apps and try again, or use a JPEG or HEIC of it.`;
  if (code === -100005) return `${name} stopped partway: it may be cut short. A JPEG or HEIC of it works.`;
  return `I could not read ${name} as a RAW (the reader said ${code}). A JPEG or HEIC of it works.`;
}

/** The reader's plain refusal, with LibRaw's code kept for the words. */
export class RawError extends Error {
  /** Its words are written in his voice on purpose (rawRefusal), so the one error voice says them whole. */
  readonly said = true;
  constructor(
    readonly code: number,
    words: string,
  ) {
    super(words);
    this.name = 'RawError';
  }
}
/** The reader is not on this phone: the line offers it with its size. */
export class RawNeedsReader extends Error {
  constructor(words: string) {
    super(words);
    this.name = 'RawNeedsReader';
  }
}

const sRGBtoLin = (v: number): number => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linToSRGB = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
/** Linear light up to 0.7 as it is, then a soft shoulder that never reaches 1: what the sensor held beyond white is still there. */
export const shoulder = (x: number): number => (x <= 0.7 ? x : 0.7 + 0.3 * (1 - Math.exp(-(x - 0.7) / 0.3)));

/**
 * The 16-bit picture (sRGB-encoded, three channels) developed to eight bits: brightened so a middle grey sits where a photo's does (at most
 * four stops, at least none, and never past where the brightest one percent still fits under the shoulder), the shoulder on top. Returns RGBA and how many stops it brightened. Pure.
 */
export function develop16(data: Uint16Array, w: number, h: number): { rgba: Uint8ClampedArray; stops: number } {
  // the median brightness of a spread sample, in linear light
  const sample: number[] = [];
  const step = Math.max(1, Math.floor((w * h) / 4096));
  for (let i = 0; i < w * h; i += step) {
    const r = sRGBtoLin(data[i * 3]! / 65535);
    const g = sRGBtoLin(data[i * 3 + 1]! / 65535);
    const b = sRGBtoLin(data[i * 3 + 2]! / 65535);
    sample.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }
  sample.sort((a, b) => a - b);
  const med = Math.max(1e-4, sample[Math.floor(sample.length / 2)] ?? 0.18);
  // bright enough for a middle grey to sit where a photo's does, but never so bright that the top percent (the sky, a lamp) goes past what the shoulder holds
  const top = Math.max(1e-4, sample[Math.floor(sample.length * 0.99)] ?? 1);
  const gain = Math.min(16, Math.max(1, Math.min(0.18 / med, 1.6 / top)));
  const lut = new Uint8ClampedArray(65536);
  for (let v = 0; v < 65536; v++) lut[v] = Math.round(linToSRGB(shoulder(sRGBtoLin(v / 65535) * gain)) * 255);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = lut[data[i * 3]!]!;
    rgba[i * 4 + 1] = lut[data[i * 3 + 1]!]!;
    rgba[i * 4 + 2] = lut[data[i * 3 + 2]!]!;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, stops: Math.round(Math.log2(gain) * 10) / 10 };
}

/** Read a RAW's bytes in the reader's worker (which is ended afterwards: it gives the WebAssembly memory back). */
export function readRawBytes(bytes: ArrayBuffer, name: string): Promise<RawRead> {
  return new Promise((ok, bad) => {
    if (typeof Worker === 'undefined' || typeof WebAssembly !== 'object') return bad(new RawError(0, 'This browser cannot run the RAW reader (no WebAssembly or workers). A JPEG or HEIC of it works.'));
    const w = new Worker('/vendor/raw/worker.mjs', { type: 'module' });
    const end = () => w.terminate();
    w.onmessage = (ev: MessageEvent<{ t: string; code?: number; message?: string } & Partial<RawRead>>) => {
      end();
      const m = ev.data;
      if (m.t === 'done') ok(m as unknown as RawRead);
      else bad(new RawError(m.code ?? 0, rawRefusal(m.code ?? 0, name)));
    };
    w.onerror = (ev) => {
      ev.preventDefault();
      end();
      // (the worker's own reason goes to the WHY trail: the words said are his)
      trail(ev.message || 'no reason given', 'the RAW reader');
      bad(new RawError(0, 'The RAW reader would not start. A JPEG or HEIC of it works.'));
    };
    w.postMessage({ id: 1, op: 'read', bytes }, [bytes]);
  });
}

export interface RawOpened {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  info: RawInfo;
  /** The lossless 16-bit picture, to be kept beside the RAW (null when it is too big to keep: the RAW is read again next time). */
  decoded: Blob | null;
}

/** The most a kept picture may weigh (bytes): a bigger one is read from the RAW again when the photo is opened. */
export const KEEP_DECODED_MAX = 90_000_000;

function canvasOf(rgba: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('This phone would not give me a canvas.');
  g.putImageData(new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return c;
}

/**
 * Open a RAW. With the picture kept beside it (`decoded`) that is read back; otherwise the reader reads the RAW (it must be on this phone:
 * RawNeedsReader says so with the size, never a silent failure). `say` hears the wait.
 */
export async function openRaw(file: Blob, name: string, o: { decoded?: Blob | null; readerHere: () => Promise<boolean>; readerWords: () => string; say?: (w: string) => void }): Promise<RawOpened> {
  if (o.decoded) {
    try {
      const p = await decodePng16(o.decoded);
      const d = develop16(p.data, p.w, p.h);
      return { canvas: canvasOf(d.rgba, p.w, p.h), w: p.w, h: p.h, info: { make: '', model: '', half: false, stops: d.stops, ms: 0 }, decoded: o.decoded };
    } catch {
      /* the kept picture is unreadable: read the RAW again */
    }
  }
  if (!(await o.readerHere())) throw new RawNeedsReader(o.readerWords());
  const mb = Math.max(1, Math.round(file.size / 1e6));
  o.say?.(`Reading the RAW… ${mb} MB`);
  const t0 = performance.now();
  const r = await readRawBytes(await file.arrayBuffer(), name);
  if (r.colors !== 3) throw new RawError(-3, `I can’t read that kind of RAW yet (${name}): it has ${r.colors} colour channels. A JPEG or HEIC of it works.`);
  const ms = performance.now() - t0;
  const d = develop16(r.data, r.w, r.h);
  const canvas = canvasOf(d.rgba, r.w, r.h);
  let decoded: Blob | null = null;
  if (r.w * r.h * 6 < KEEP_DECODED_MAX * 2) {
    try {
      const png = await encodePng16(r.data, r.w, r.h);
      decoded = png.size <= KEEP_DECODED_MAX ? png : null;
    } catch {
      decoded = null;
    }
  }
  return { canvas, w: r.w, h: r.h, info: { make: r.make, model: r.model, half: r.half, stops: d.stops, ms }, decoded };
}
