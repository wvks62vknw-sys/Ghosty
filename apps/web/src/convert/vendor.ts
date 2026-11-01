/**
 * The converter's vendored libraries, loaded on first use from this site only (never a CDN): pdf.js (vendor/pdfjs,
 * Apache-2.0) as a module with its worker, SheetJS (vendor/sheetjs, Apache-2.0), mammoth (vendor/mammoth, BSD-2) and
 * LAME (vendor/lamejs, LGPL-3.0) as scripts; and the phone's own compressor for pictures in a PDF.
 */
import type { Lame } from './audio';
import type { Deflate } from './pdfwrite';
import type { SheetJs } from './table';

const VENDOR = '/vendor';

// ---------------------------------------------------------------- the vendored libraries, loaded once
const scripts = new Map<string, Promise<void>>();
function script(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((ok, no) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        scripts.delete(src);
        no(new Error(`couldn’t load ${src.split('/').slice(-2, -1)[0]} (is the app fully downloaded?)`));
      };
      document.head.append(s);
    });
    scripts.set(src, p);
  }
  return p;
}
type Win = Window & { XLSX?: SheetJs; lamejs?: Lame; mammoth?: { convertToHtml(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> } };
export async function sheetJs(): Promise<SheetJs> {
  await script(`${VENDOR}/sheetjs/xlsx.mini.min.js`);
  return (window as Win).XLSX!;
}
export async function lame(): Promise<Lame> {
  await script(`${VENDOR}/lamejs/lame.min.js`);
  return (window as Win).lamejs!;
}
export async function mammoth(): Promise<NonNullable<Win['mammoth']>> {
  await script(`${VENDOR}/mammoth/mammoth.browser.min.js`);
  return (window as Win).mammoth!;
}

export interface PdfJsPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: { str: string; hasEOL?: boolean; transform: number[]; height: number }[] }>;
  cleanup(): void;
}
export interface PdfJsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfJsPage>;
  getMetadata(): Promise<{ info: { Title?: string } }>;
}
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: Record<string, unknown>): { promise: Promise<PdfJsDoc>; destroy(): Promise<void> };
}
let pdfjsP: Promise<PdfJs> | null = null;
/** pdf.js (vendor/pdfjs, Apache-2.0): its module and its worker, both from this site. */
export function pdfjs(): Promise<PdfJs> {
  pdfjsP ??= (async () => {
    const url: string = `${VENDOR}/pdfjs/pdf.min.mjs`;
    const m = (await import(/* @vite-ignore */ url)) as PdfJs;
    m.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdfjs/pdf.worker.min.mjs`;
    return m;
  })().catch((e: unknown) => {
    pdfjsP = null;
    throw e;
  });
  return pdfjsP;
}
/** A PDF opened by pdf.js; `done()` lets it go. A locked one is said in words. */
export async function openPdf(bytes: Uint8Array): Promise<{ doc: PdfJsDoc; done: () => Promise<void> }> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  try {
    return { doc: await task.promise, done: () => task.destroy() };
  } catch (e) {
    if (/password/i.test(String((e as Error)?.message ?? e))) throw new Error('this PDF is locked with a password');
    throw e;
  }
}

/** The phone's compressor (zlib), for pictures in a PDF; stored blocks where it has none. */
export const phoneDeflate: Deflate = async (data) => {
  if (typeof CompressionStream === 'undefined') return (await import('./pdfwrite')).storedDeflate(data);
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate')));
  return new Uint8Array(await out.arrayBuffer());
};
