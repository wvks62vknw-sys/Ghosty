/**
 * The vision models, loaded lazily from this site (public/vendor: MediaPipe Tasks Vision and
 * three small models) and kept warm: the object detector (80 everyday things), the image
 * classifier (1,000 kinds of thing) and the hand gesture recogniser. Every load reports its
 * progress in words and a fraction; the GPU is tried first and the CPU is the fallback. A phone
 * without WebAssembly SIMD gets a plain message instead of an exception.
 */
export type Progress = (status: string, frac?: number) => void;

export interface MPCategory {
  categoryName?: string;
  displayName?: string;
  score?: number;
}
export interface MPDetectorResult {
  detections?: { boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: MPCategory[] }[];
}
export interface MPClassifierResult {
  classifications?: { categories?: MPCategory[] }[];
}
export interface MPLandmark {
  x: number;
  y: number;
  z: number;
}
export interface MPGestureResult {
  gestures?: MPCategory[][];
  landmarks?: MPLandmark[][];
  handedness?: MPCategory[][];
}
/** What the models can look at. */
export type Frame = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap;

export interface ObjectDetectorLike {
  detectForVideo(frame: Frame, timestampMs: number): MPDetectorResult;
  close(): void;
}
export interface ImageClassifierLike {
  classifyForVideo(frame: Frame, timestampMs: number): MPClassifierResult;
  close(): void;
}
export interface GestureRecognizerLike {
  recognizeForVideo(frame: Frame, timestampMs: number): MPGestureResult;
  close(): void;
}

interface TaskClass<T> {
  createFromOptions(files: unknown, options: Record<string, unknown>): Promise<T>;
}
interface VisionNS {
  FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
  ObjectDetector: TaskClass<ObjectDetectorLike>;
  ImageClassifier: TaskClass<ImageClassifierLike>;
  GestureRecognizer: TaskClass<GestureRecognizerLike>;
}

const VENDOR = '/vendor/mediapipe';
export const MODELS = {
  detector: '/vendor/models/efficientdet_lite0.tflite',
  classifier: '/vendor/models/efficientnet_lite0.tflite',
  gestures: '/vendor/models/gesture_recognizer.task',
} as const;

/** WebAssembly SIMD: the vendored runtime is the SIMD build (iOS 16.4+, Chrome 91+, Firefox 89+). */
export function simdSupported(): boolean {
  try {
    // A module with one v128 instruction: valid only where SIMD exists.
    return typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
}

/** Can this device run the models at all? A plain reason when not. */
export function visionSupport(): { ok: true } | { ok: false; why: string } {
  if (typeof WebAssembly !== 'object') return { ok: false, why: 'This browser has no WebAssembly, so the models cannot run here' };
  if (!simdSupported()) return { ok: false, why: 'This device cannot run the vision models: it needs iOS 16.4 or newer (or a current Chrome or Firefox)' };
  return { ok: true };
}

let runtime: Promise<{ ns: VisionNS; files: unknown }> | null = null;

/** The MediaPipe module and its WebAssembly runtime, loaded once from this site (never bundled, never from a CDN). */
function loadRuntime(progress: Progress): Promise<{ ns: VisionNS; files: unknown }> {
  runtime ??= (async () => {
    const support = visionSupport();
    if (!support.ok) throw new Error(support.why);
    progress('loading the vision runtime…');
    // A module served next to the app; its address is a plain string so neither the bundler nor
    // the type checker tries to follow it (see ui/map3d.ts for the same with MapLibre).
    const url: string = `${VENDOR}/vision_bundle.mjs`;
    const mod = (await import(url)) as Partial<VisionNS>;
    if (!mod.FilesetResolver || !mod.ObjectDetector) throw new Error('The vision runtime did not load');
    const files = await mod.FilesetResolver.forVisionTasks(`${VENDOR}/wasm`);
    return { ns: mod as VisionNS, files };
  })().catch((e: unknown) => {
    runtime = null;
    throw e;
  });
  return runtime;
}

const modelBytes = new Map<string, Promise<Uint8Array>>();

/** A model file from this site, with real download progress (kept in memory afterwards). */
export function fetchModel(url: string, progress: Progress, label = 'model'): Promise<Uint8Array> {
  let p = modelBytes.get(url);
  if (p) return p;
  p = (async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not load the ${label} (HTTP ${r.status})`);
    const total = Number(r.headers.get('content-length')) || 0;
    if (!r.body) return new Uint8Array(await r.arrayBuffer());
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      progress(`loading ${label}${total ? ` ${Math.round((got / total) * 100)}%` : ` ${Math.round(got / 1024)} KB`}`, total ? got / total : undefined);
    }
    const out = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  })().catch((e: unknown) => {
    modelBytes.delete(url);
    throw e;
  });
  modelBytes.set(url, p);
  return p;
}

/**
 * One task, created on first use and shared by every mode. GPU first, then CPU — except for a
 * model that asks for the CPU: the int8 classifier runs but fails on every frame on the GPU
 * delegate (an error at run time, not at creation, so a creation-time fallback never sees it).
 */
class Lazy<T extends { close(): void }> {
  private p: Promise<T> | null = null;
  loaded: T | null = null;
  constructor(
    private label: string,
    private model: string,
    private make: (ns: VisionNS, files: unknown, base: Record<string, unknown>) => Promise<T>,
    private delegate: 'GPU' | 'CPU' = 'GPU',
  ) {}

  get(progress: Progress = () => undefined): Promise<T> {
    this.p ??= (async () => {
      const { ns, files } = await loadRuntime(progress);
      const bytes = await fetchModel(this.model, progress, this.label);
      progress(`starting the ${this.label}…`);
      let task: T;
      if (this.delegate === 'CPU') task = await this.make(ns, files, { modelAssetBuffer: bytes, delegate: 'CPU' });
      else {
        try {
          task = await this.make(ns, files, { modelAssetBuffer: bytes, delegate: 'GPU' });
        } catch {
          task = await this.make(ns, files, { modelAssetBuffer: bytes, delegate: 'CPU' });
        }
      }
      this.loaded = task;
      progress(`${this.label} ready`, 1);
      return task;
    })().catch((e: unknown) => {
      this.p = null;
      throw e;
    });
    return this.p;
  }

  close(): void {
    try {
      this.loaded?.close();
    } catch {
      /* already closed */
    }
    this.loaded = null;
    this.p = null;
  }
}

export const detector = new Lazy<ObjectDetectorLike>('object detector', MODELS.detector, (ns, files, baseOptions) => ns.ObjectDetector.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', scoreThreshold: 0.45, maxResults: 12 }));
export const classifier = new Lazy<ImageClassifierLike>('scene classifier', MODELS.classifier, (ns, files, baseOptions) => ns.ImageClassifier.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', maxResults: 5 }), 'CPU');
export const gestures = new Lazy<GestureRecognizerLike>('hand recogniser', MODELS.gestures, (ns, files, baseOptions) => ns.GestureRecognizer.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', numHands: 2 }));

/** Free every model (GPU memory); the next use loads them again from the cached bytes. */
export function closeAll(): void {
  detector.close();
  classifier.close();
  gestures.close();
}

/** MediaPipe wants a timestamp that only ever grows, even across a frozen frame or a re-created task. */
let lastStamp = 0;
export function nextStamp(now: number): number {
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}
