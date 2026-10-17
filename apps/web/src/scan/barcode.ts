/**
 * Reading barcodes and QR codes in a picture, on the phone. The browser's own BarcodeDetector
 * where it has one (Chrome on Android, desktop Chrome on a Mac; not iOS Safari), else ZXing-C++
 * compiled to WebAssembly (zxing-wasm, vendored in /vendor/zxing/: the reader-only build, ~1 MB,
 * loaded on the first scan and let go when SCAN is left). Its WebAssembly is fetched from this
 * site only: the vendored module's default CDN address is replaced, and locateFile says so too.
 */
import type { Pt } from './page';

export interface FoundCode {
  text: string;
  /** The format as the reader names it ("QRCode", "EAN13", "qr_code", …). */
  format: string;
  /** The code's corners in the picture's pixels (top-left first), when the reader gives them. */
  points: Pt[];
}

const VENDOR = '/vendor/zxing';
/** The kinds worth reading: retail and book barcodes, QR and the other square codes, common shipping codes. */
const ZX_FORMATS = ['QRCode', 'MicroQRCode', 'EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'ITF', 'DataMatrix', 'Aztec', 'PDF417'];
const NATIVE_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'data_matrix', 'aztec', 'pdf417'];

interface ZxPoint {
  x: number;
  y: number;
}
interface ZxResult {
  isValid: boolean;
  text: string;
  format: string;
  position?: { topLeft: ZxPoint; topRight: ZxPoint; bottomRight: ZxPoint; bottomLeft: ZxPoint };
}
interface ZxModule {
  prepareZXingModule(o: { overrides?: Record<string, unknown>; fireImmediately?: boolean }): Promise<unknown> | void;
  readBarcodes(input: ImageData | Blob, options?: Record<string, unknown>): Promise<ZxResult[]>;
  purgeZXingModule(): void;
}
interface NativeDetector {
  detect(src: CanvasImageSource | ImageData): Promise<{ rawValue: string; format: string; cornerPoints?: ZxPoint[] }[]>;
}
interface NativeCtor {
  new (o?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?(): Promise<string[]>;
}

let zx: Promise<ZxModule> | null = null;
let native: Promise<NativeDetector | null> | null = null;

/** The browser's own detector, when it has one that reads QR codes and EAN-13 (never on iOS). */
function nativeDetector(): Promise<NativeDetector | null> {
  native ??= (async () => {
    const Ctor = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      const have = (await Ctor.getSupportedFormats?.()) ?? [];
      if (!have.includes('qr_code') || !have.includes('ean_13')) return null;
      return new Ctor({ formats: NATIVE_FORMATS.filter((f) => have.includes(f)) });
    } catch {
      return null;
    }
  })();
  return native;
}

function zxing(): Promise<ZxModule> {
  zx ??= (async () => {
    // Same-origin module, plain string address: not bundled (see vision/ocr.ts).
    const url: string = `${VENDOR}/zxing-reader.mjs`;
    const mod = (await import(url)) as ZxModule;
    await mod.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `${VENDOR}/${path}` : prefix + path) }, fireImmediately: true });
    return mod;
  })().catch((e: unknown) => {
    zx = null;
    throw e;
  });
  return zx;
}

/** Which reader is in use, for the status line. */
export async function readerName(): Promise<string> {
  return (await nativeDetector()) ? "the phone's own barcode reader" : 'ZXing (on the phone)';
}

/** Load the reader now so the first look is quick. */
export async function warmBarcodes(): Promise<void> {
  if (!(await nativeDetector())) await zxing();
}

/** Every code in a picture (most often none or one). `hard` tries harder: slower, for a still photo. */
export async function readCodes(c: HTMLCanvasElement, hard = false): Promise<FoundCode[]> {
  const nat = await nativeDetector();
  if (nat) {
    const found = await nat.detect(c);
    return found.map((f) => ({ text: f.rawValue, format: f.format, points: (f.cornerPoints ?? []).map((p) => ({ x: p.x, y: p.y })) }));
  }
  const mod = await zxing();
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [];
  const results = await mod.readBarcodes(g.getImageData(0, 0, c.width, c.height), { formats: ZX_FORMATS, tryHarder: hard, tryRotate: true, tryInvert: hard, maxNumberOfSymbols: 4 });
  return results
    .filter((r) => r.isValid && r.text)
    .map((r) => ({ text: r.text, format: r.format, points: r.position ? [r.position.topLeft, r.position.topRight, r.position.bottomRight, r.position.bottomLeft].map((p) => ({ x: p.x, y: p.y })) : [] }));
}

/** Let go of the WebAssembly reader (its memory) until the next scan. */
export function freeBarcodes(): void {
  const z = zx;
  zx = null;
  if (z) void z.then((m) => m.purgeZXingModule()).catch(() => undefined);
}
