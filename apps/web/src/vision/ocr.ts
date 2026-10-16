/**
 * Reading text in a picture with Tesseract.js, vendored and run in a Web Worker from this site.
 * One worker is kept warm between captures (the English model loads once); terminate() when the
 * Lens is left. Progress comes from the library's own logger in words and a fraction.
 */
import type { OcrLine, OcrResult, OcrWord } from './ocrtext';
import type { Progress } from './models';

interface TesseractNS {
  createWorker(langs: string, oem: number, options: Record<string, unknown>): Promise<WorkerLike>;
}
interface WorkerLike {
  recognize(image: unknown, options?: Record<string, unknown>, output?: Record<string, unknown>): Promise<{ data: RawData }>;
  terminate(): Promise<unknown>;
}
interface RawBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface RawWord {
  text: string;
  confidence: number;
  bbox: RawBox;
}
interface RawLine {
  text: string;
  confidence: number;
  bbox?: RawBox;
  words?: RawWord[];
}
interface RawData {
  text?: string;
  confidence?: number;
  lines?: RawLine[];
  words?: RawWord[];
  blocks?: { paragraphs?: { lines?: RawLine[] }[] }[] | null;
}

const VENDOR = '/vendor/tesseract';

const STATUS: Record<string, string> = {
  'loading tesseract core': 'loading the reader…',
  'initializing tesseract': 'starting the reader…',
  'loading language traineddata': 'loading the English model…',
  'initializing api': 'preparing…',
  'recognizing text': 'reading…',
};

/** Lines and words from the reader's answer, whichever shape this version gives them in. */
export function flattenRaw(d: RawData): { lines: OcrLine[]; words: OcrWord[] } {
  const lines: OcrLine[] = [];
  const words: OcrWord[] = [];
  const takeLine = (l: RawLine) => {
    lines.push({ text: String(l.text ?? '').replace(/\n$/, ''), confidence: Number(l.confidence) || 0 });
    for (const w of l.words ?? []) words.push({ text: String(w.text ?? ''), confidence: Number(w.confidence) || 0, bbox: w.bbox });
  };
  if (d.lines?.length) {
    for (const l of d.lines) takeLine(l);
    if (!words.length) for (const w of d.words ?? []) words.push({ text: String(w.text ?? ''), confidence: Number(w.confidence) || 0, bbox: w.bbox });
  } else {
    for (const b of d.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) takeLine(l);
  }
  return { lines, words };
}

export class Reader {
  private worker: Promise<WorkerLike> | null = null;
  /** The read in flight hears the library's progress (its bar); between reads, whoever warmed the worker does. */
  private onProgress: Progress | null = null;
  /** Ends the read in flight: the library's own promise never settles once its worker is terminated. */
  private stop: ((e: Error) => void) | null = null;
  busy = false;

  /** Start the worker and load the English model now, so the first capture is quick. */
  warm(progress: Progress = () => undefined): Promise<void> {
    return this.get(progress).then(() => undefined);
  }

  private get(progress: Progress): Promise<WorkerLike> {
    this.worker ??= (async () => {
      progress('loading the reader…');
      // Same-origin module, plain string address: not bundled (see ui/map3d.ts).
      const url: string = `${VENDOR}/tesseract.esm.min.js`;
      // The module's only export is `default`: the Tesseract namespace (createWorker lives on it).
      const mod = (await import(url)) as { default?: Partial<TesseractNS> } & Partial<TesseractNS>;
      const T = mod.default ?? mod;
      if (typeof T.createWorker !== 'function') throw new Error('The reader did not load');
      return T.createWorker('eng', 1, {
        workerPath: `${VENDOR}/worker.min.js`,
        corePath: VENDOR,
        langPath: `${VENDOR}/lang`,
        workerBlobURL: false,
        gzip: true,
        logger: (m: { status?: string; progress?: number }) => {
          const s = String(m.status ?? '');
          (this.onProgress ?? progress)(STATUS[s] ?? s, typeof m.progress === 'number' ? m.progress : undefined);
        },
      });
    })().catch((e: unknown) => {
      this.worker = null;
      throw e;
    });
    return this.worker;
  }

  /** Read the text in a canvas or picture file; rejects with "reader stopped" if terminate() comes first. */
  async read(src: HTMLCanvasElement | Blob, progress: Progress = () => undefined): Promise<OcrResult> {
    if (this.busy) throw new Error('Still reading the last picture');
    this.busy = true;
    let stop: (e: Error) => void = () => undefined;
    const stopped = new Promise<never>((_, bad) => (stop = bad));
    this.stop = stop;
    this.onProgress = progress;
    try {
      const w = await Promise.race([this.get(progress), stopped]);
      progress('reading…', 0);
      const { data } = await Promise.race([w.recognize(src, {}, { text: true, blocks: true }), stopped]);
      const { lines, words } = flattenRaw(data);
      return { text: String(data.text ?? ''), confidence: Number(data.confidence) || 0, lines, words };
    } finally {
      if (this.stop === stop) this.stop = null;
      this.onProgress = null;
      this.busy = false;
    }
  }

  get warmed(): boolean {
    return !!this.worker;
  }

  terminate(): void {
    const w = this.worker;
    this.worker = null;
    this.busy = false;
    this.stop?.(new Error('reader stopped'));
    this.stop = null;
    if (w) void w.then((x) => x.terminate()).catch(() => undefined);
  }
}
