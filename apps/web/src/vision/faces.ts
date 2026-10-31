/**
 * THE FACE MODULE (OWNER-ISSUES 55, 56: "recognise who I am instantly", the people he introduces). Two small free models
 * run on the phone: MediaPipe's BlazeFace (short range, 230 KB, Apache-2.0) finds faces and their eyes, nose and mouth,
 * and OpenCV's SFace (a MobileFaceNet, int8, 9.9 MB, Apache-2.0) turns one lined-up face into 128 numbers — in the NAME
 * mode's ONNX Runtime (WebAssembly, its own worker, ended when PEOPLE closes). Both are served from this site and kept
 * by the service worker after the first use, downloaded only when he opens PEOPLE or taps ENROL.
 *
 * ITS ONLY INPUT IS A LIVE FRAME FROM THE DEVICE CAMERA: every way in takes the Lens's live camera (a MediaStream from
 * getUserMedia with a live video track, playing in its own video element) and refuses anything else — no URL, no blob,
 * no file, no picture, no canvas, no screenshot, no photo from the library or from Telegram (apps/edge/test/faces.test.mjs
 * reads this file's surface to be sure; the spec tries a picture and is refused). Nothing here sends anything anywhere:
 * the only requests are for its own two model files and the runtime, and the numbers it makes stay on the phone
 * (vision/facestore.ts).
 *
 * The specs stand the two models in (window.__ghostyFaceEngine, honoured only under a test runner), the way the offline
 * brain's specs do: everything else — the live camera check, the lining up, the matching, the boxes, the words — is real.
 */
import { drawScaled } from './camera';
import { FACE_SIZE, FACE_TEMPLATE, normalize, rgbaToRgbChw, similarity } from './facemath';
import { fetchModel, nextStamp, simdSupported, visionRuntime, type Progress } from './models';

export const FACE_FILES = {
  detector: '/vendor/faces/blaze_face_short_range.tflite',
  model: '/vendor/faces/face_recognition_sface_2021dec_int8.onnx',
  worker: '/vendor/faces/worker.mjs',
} as const;
/** What the first use costs, in words (the detector and the face model; the runtime is NAME's, shared). */
export const FACES_SIZE = '10 MB';

/** The live camera: the one thing the face module looks at (the Lens's Camera is one). */
export interface LiveCamera {
  readonly video: HTMLVideoElement;
  readonly stream: MediaStream | null;
}

/** A face in one frame: where (frame pixels), its eyes, nose and mouth, how sure the detector is, and its numbers if asked. */
export interface FaceSeen {
  box: { x: number; y: number; w: number; h: number };
  /** The detector's points in frame pixels: [0] and [1] the eyes, [2] the nose, [3] the mouth (then the ears). */
  points: [number, number][];
  score: number;
  emb?: number[];
}

export interface FaceLook {
  faces: FaceSeen[];
  frame: { w: number; h: number };
  at: number;
}

/** The two models as the specs may stand them in (only under a test runner): the frame's size in, faces and numbers out. */
interface FaceModels {
  detect(frame: { w: number; h: number }): { box: FaceSeen['box']; points: [number, number][]; score: number }[];
  embed(face: { box: FaceSeen['box']; points: [number, number][] }): number[];
}

const NOT_LIVE = 'I only look at faces through the live camera, never at a picture';

/**
 * Is this the live camera? A MediaStream from the device (not a file playing, not a picture), with a live video track,
 * playing in this very video element, with frames.
 */
export function isLive(cam: LiveCamera): boolean {
  const s = cam?.stream;
  if (!s || typeof MediaStream === 'undefined' || !(s instanceof MediaStream)) return false;
  if (cam.video.srcObject !== s || cam.video.getAttribute('src')) return false;
  const track = s.getVideoTracks()[0];
  // a picture drawn into a stream (a canvas's capture) is not a camera
  if (!track || (typeof CanvasCaptureMediaStreamTrack !== 'undefined' && track instanceof CanvasCaptureMediaStreamTrack)) return false;
  return track.kind === 'video' && track.readyState === 'live' && cam.video.videoWidth > 0;
}

/** The specs' stand-in for the two models, only ever under a test runner. */
function standIn(): FaceModels | null {
  const w = window as unknown as { __ghostyFaceEngine?: FaceModels };
  return navigator.webdriver && w.__ghostyFaceEngine ? w.__ghostyFaceEngine : null;
}

interface DetectorLike {
  detectForVideo(frame: HTMLCanvasElement, ts: number): { detections?: { boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: { score?: number }[]; keypoints?: { x: number; y: number }[] }[] };
  close(): void;
}
type Reply = { id: number; t: 'done' | 'error'; message?: string; data?: Float32Array };

class FaceEngine {
  private detector: DetectorLike | null = null;
  private worker: Worker | null = null;
  private loading: Promise<void> | null = null;
  private seq = 0;
  private calls = new Map<number, { ok: (r: Reply) => void; bad: (e: Error) => void }>();
  /** The models are loaded (or stood in). */
  get ready(): boolean {
    return !!standIn() || (!!this.detector && !!this.worker);
  }

  /** Load the two models once (progress in words); the stand-in needs nothing. */
  load(progress: Progress = () => undefined): Promise<void> {
    if (standIn()) return Promise.resolve();
    this.loading ??= (async () => {
      if (!simdSupported()) throw new Error('This device cannot run the face models: it needs iOS 16.4 or newer (or a current Chrome or Firefox)');
      const { ns, files } = await visionRuntime(progress);
      const FaceDetector = (ns as { FaceDetector?: { createFromOptions(f: unknown, o: Record<string, unknown>): Promise<DetectorLike> } }).FaceDetector;
      if (!FaceDetector) throw new Error('The vision runtime has no face detector');
      const det = await fetchModel(FACE_FILES.detector, progress, 'face finder');
      const make = (delegate: 'GPU' | 'CPU') => FaceDetector.createFromOptions(files, { baseOptions: { modelAssetBuffer: det, delegate }, runningMode: 'VIDEO', minDetectionConfidence: 0.6 });
      this.detector = await make('GPU').catch(() => make('CPU'));
      const bytes = await fetchModel(FACE_FILES.model, progress, `face model (${FACES_SIZE}, once)`);
      this.worker = new Worker(FACE_FILES.worker, { type: 'module' });
      this.worker.onmessage = (ev: MessageEvent<Reply>) => {
        const c = this.calls.get(ev.data.id);
        if (!c) return;
        this.calls.delete(ev.data.id);
        if (ev.data.t === 'error') c.bad(new Error(ev.data.message ?? 'the face model failed'));
        else c.ok(ev.data);
      };
      this.worker.onerror = (ev) => {
        ev.preventDefault();
        for (const c of this.calls.values()) c.bad(new Error(ev.message || 'The face model did not load'));
        this.calls.clear();
      };
      progress('starting the face model…');
      await this.call('load', { model: bytes.slice().buffer }, []);
      progress('face model ready', 1);
    })().catch((e: unknown) => {
      this.release();
      throw e;
    });
    return this.loading;
  }

  private call(op: string, payload: Record<string, unknown>, transfer: Transferable[]): Promise<Reply> {
    const w = this.worker;
    if (!w) return Promise.reject(new Error('the face model is not loaded'));
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.calls.set(id, { ok, bad });
      w.postMessage({ id, op, ...payload }, transfer);
    });
  }

  /**
   * One look through the live camera: the faces in this frame, and the numbers of those `pick` chooses (by index), all
   * from the same frame. Refuses anything that is not the live camera.
   */
  async look(cam: LiveCamera, pick: (faces: FaceSeen[]) => number[] = () => []): Promise<FaceLook> {
    if (!isLive(cam)) throw new Error(NOT_LIVE);
    const size = { w: cam.video.videoWidth, h: cam.video.videoHeight };
    const at = performance.now();
    const fake = standIn();
    if (fake) {
      const faces: FaceSeen[] = fake.detect(size).map((f) => ({ box: f.box, points: f.points, score: f.score }));
      for (const i of pick(faces)) if (faces[i]) faces[i]!.emb = normalize(fake.embed(faces[i]!));
      return { faces, frame: size, at };
    }
    if (!this.detector || !this.worker) await this.load();
    // one frame, drawn here from the live video: the detector and the face model both read this same picture
    const frame = drawScaled(cam.video, size, 960);
    const k = frame.width / size.w;
    const res = this.detector!.detectForVideo(frame, nextStamp(at));
    const faces: FaceSeen[] = (res.detections ?? []).flatMap((d) => {
      const b = d.boundingBox;
      if (!b) return [];
      const points = (d.keypoints ?? []).map((p) => [p.x * frame.width, p.y * frame.height] as [number, number]);
      return [{ box: { x: b.originX, y: b.originY, w: b.width, h: b.height }, points, score: d.categories?.[0]?.score ?? 0 }];
    });
    for (const i of pick(faces)) {
      const f = faces[i];
      if (!f || f.points.length < 4) continue;
      f.emb = await this.embed(frame, f);
    }
    // back to camera pixels for the caller
    for (const f of faces) {
      f.box = { x: f.box.x / k, y: f.box.y / k, w: f.box.w / k, h: f.box.h / k };
      f.points = f.points.map(([x, y]) => [x / k, y / k]);
    }
    return { faces, frame: size, at };
  }

  /** One face lined up on SFace's template (eyes, nose, mouth) in 112 × 112, and its 128 numbers. */
  private async embed(frame: HTMLCanvasElement, f: FaceSeen): Promise<number[]> {
    let [e1, e2, nose, mouth] = f.points as [[number, number], [number, number], [number, number], [number, number]];
    // left and right as seen in the picture
    if (e1[0] > e2[0]) [e1, e2] = [e2, e1];
    const t = similarity([e1, e2, nose, mouth], FACE_TEMPLATE);
    const c = document.createElement('canvas');
    c.width = c.height = FACE_SIZE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser cannot draw the face');
    ctx.setTransform(t.a, t.b, -t.b, t.a, t.tx, t.ty);
    ctx.drawImage(frame, 0, 0);
    const px = ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE).data;
    const input = rgbaToRgbChw(px, FACE_SIZE, FACE_SIZE);
    const r = await this.call('run', { input }, [input.buffer]);
    if (!r.data) throw new Error('The face model gave no answer');
    return normalize(r.data);
  }

  /** Let the models go (leaving PEOPLE): the worker's memory comes back; the files stay in the cache. */
  release(): void {
    try {
      this.detector?.close();
    } catch {
      /* already closed */
    }
    this.detector = null;
    this.worker?.terminate();
    this.worker = null;
    for (const c of this.calls.values()) c.bad(new Error('the face model was closed'));
    this.calls.clear();
    this.loading = null;
  }
}

/** The one face engine. */
export const faces = new FaceEngine();
