/**
 * THE WORKER'S CLIENT (BRIEF-EDITOR-VIDEO-2): one worker (public build: steady.worker.js) for STEADY's block matching, BEST CLIPS'
 * scores and ON THE BEAT's spectrum, and the one way the three read a clip's frames: in turn through the app's own reader where the
 * file can be read that way, else the phone's player seeking. A dead worker says so (the screen offers RETRY); nothing is
 * downloaded and nothing leaves the phone.
 */
import type { CrunchAsk, CrunchReply } from '../workers/steady.worker';
import { Reader } from './reader';
import type { Feeder } from './preview';
import { ANALYSIS_W, toGrey } from './steadymath';

export class Crunch {
  private w: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, { ok(r: CrunchReply): void; bad(e: Error): void }>();
  dead = '';
  constructor(private url = '/steady.worker.js') {}
  private start(): Worker {
    if (this.w) return this.w;
    const w = new Worker(this.url);
    w.onmessage = (ev: MessageEvent<CrunchReply>) => {
      const c = this.waiting.get(ev.data.id);
      this.waiting.delete(ev.data.id);
      if (!c) return;
      if (ev.data.error) c.bad(new Error(ev.data.error));
      else c.ok(ev.data);
    };
    w.onerror = () => this.fail('The helper that does this arithmetic stopped.');
    this.w = w;
    return w;
  }
  private fail(why: string): void {
    this.dead = why;
    for (const c of this.waiting.values()) c.bad(new Error(why));
    this.waiting.clear();
    this.w?.terminate();
    this.w = null;
  }
  /** Start again after a dead worker (the screen's RETRY). */
  revive(): void {
    this.dead = '';
  }
  ask(a: DistributiveOmit<CrunchAsk, 'id'>, transfer: Transferable[] = []): Promise<CrunchReply> {
    if (this.dead) return Promise.reject(new Error(this.dead));
    let w: Worker;
    try {
      w = this.start();
    } catch (e) {
      this.fail('This phone would not start the helper that does the arithmetic.');
      return Promise.reject(new Error(this.dead));
    }
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.waiting.set(id, { ok, bad });
      try {
        w.postMessage({ ...a, id }, transfer);
      } catch (e) {
        this.waiting.delete(id);
        bad(e as Error);
      }
    });
  }
  close(): void {
    this.w?.terminate();
    this.w = null;
    for (const c of this.waiting.values()) c.bad(new Error('closed'));
    this.waiting.clear();
  }
}
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export interface Grabbed {
  /** The grey frame at the analysis size, and the same frame's RGBA at 32 × 18 (for the colour histogram). */
  grey: Uint8Array;
  small: Uint8ClampedArray;
  w: number;
  h: number;
}
/** Reads a clip's frames at the times asked (in order, forwards), each as grey at about 160 px wide. */
export class Frames {
  private cv = document.createElement('canvas');
  private tiny = document.createElement('canvas');
  w = ANALYSIS_W;
  h = 90;
  private constructor(private reader: Reader | null, private feeder: Feeder, private src: string) {}
  static async open(blob: Blob | null, feeder: Feeder, src: string): Promise<Frames> {
    const f = new Frames(blob ? await Reader.open(blob) : null, feeder, src);
    const e = feeder.get(src);
    const aw = f.reader?.w ?? e?.w ?? 16;
    const ah = f.reader?.h ?? e?.h ?? 9;
    f.w = ANALYSIS_W;
    f.h = Math.max(48, Math.round((ANALYSIS_W * ah) / aw / 2) * 2);
    f.cv.width = f.w;
    f.cv.height = f.h;
    f.tiny.width = 32;
    f.tiny.height = 18;
    return f;
  }
  get read(): boolean {
    return !!this.reader;
  }
  async at(ms: number): Promise<Grabbed> {
    const g = this.cv.getContext('2d', { willReadFrequently: true })!;
    const t = this.tiny.getContext('2d', { willReadFrequently: true })!;
    if (this.reader) {
      const f = await this.reader.frameAt(ms);
      g.drawImage(f as unknown as CanvasImageSource, 0, 0, this.w, this.h);
      t.drawImage(f as unknown as CanvasImageSource, 0, 0, 32, 18);
      f.close();
    } else {
      await this.feeder.seek(this.src, ms);
      const e = this.feeder.get(this.src);
      if (!e) throw new Error('I can’t read that clip’s picture.');
      g.drawImage(e.v, 0, 0, this.w, this.h);
      t.drawImage(e.v, 0, 0, 32, 18);
    }
    const px = g.getImageData(0, 0, this.w, this.h).data;
    return { grey: toGrey(px, this.w, this.h), small: t.getImageData(0, 0, 32, 18).data, w: this.w, h: this.h };
  }
  /** The phone's own player's frame at `ms`, as grey at the same size (the picture the screen and the export's fallback show). */
  async elementAt(ms: number): Promise<Uint8Array | null> {
    const e = this.feeder.get(this.src);
    if (!e) return null;
    await this.feeder.seek(this.src, ms);
    const g = this.cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(e.v, 0, 0, this.w, this.h);
    return toGrey(g.getImageData(0, 0, this.w, this.h).data, this.w, this.h);
  }
  close(): void {
    this.reader?.close();
  }
}

/**
 * Where the phone's player puts a frame against where the app's own reader puts it: an mp4's edit list, which the reader does not
 * read, can hold the picture back by a frame or two. Keys that follow each frame's own shake must land on the same frame, so the
 * offset is measured: the player's frame at a few times against the reader's frames a few steps either side, the offset with the least
 * difference wins (and only when it clearly beats the rest). Returns the player's time minus the reader's for the same picture, ms.
 */
export async function playerLag(frames: Frames, from: number, to: number, step = 1000 / 30): Promise<number> {
  if (!frames.read) return 0;
  const reach = 3;
  const cost = new Array<number>(2 * reach + 1).fill(0);
  const probes = 3;
  for (let k = 0; k < probes; k++) {
    const t = from + ((k + 0.5) / probes) * (to - from);
    const el = await frames.elementAt(t);
    if (!el) return 0;
    for (let j = -reach; j <= reach; j++) {
      const r = await frames.at(Math.max(0, t + j * step));
      let d = 0;
      for (let i = 0; i < el.length; i += 3) d += Math.abs(el[i]! - r.grey[i]!);
      cost[j + reach]! += d / Math.ceil(el.length / 3);
    }
  }
  let best = 0;
  for (let j = 1; j < cost.length; j++) if (cost[j]! < cost[best]!) best = j;
  const sorted = [...cost].sort((a, b) => a - b);
  const clear = sorted[0]! < 0.85 * sorted[1]! || sorted[0]! < 0.5;
  return clear ? -(best - reach) * step : 0;
}
