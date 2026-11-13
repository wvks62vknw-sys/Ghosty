/**
 * FRAMES BY WEBCODECS (BRIEF-EDITOR-VIDEO): the export's way of getting a clip's frames. The app's own reader (demux.ts) finds each
 * sample in the file, the phone's VideoDecoder decodes them in turn, and `frameAt` gives the frame showing at a time, so a clip
 * is read once from where the export enters it, not sought for every frame. A file it cannot read (another codec, no decoder) gives
 * null from `open` and the export uses the phone's own player for that clip.
 */
import { demuxMp4, type Sample, type VideoTrackInfo } from './demux';

export const MAX_READ_BYTES = 250 * 1024 * 1024;

export class Reader {
  readonly w: number;
  readonly h: number;
  private dec!: VideoDecoder;
  private queue: VideoFrame[] = [];
  private next = 0;
  private fed = 0;
  private err: Error | null = null;
  private waiters: (() => void)[] = [];
  /** Presentation times start at the earliest sample's. */
  private base: number;
  private order: Sample[];
  private done = false;

  private constructor(private bytes: Uint8Array, private t: VideoTrackInfo) {
    this.w = t.w;
    this.h = t.h;
    this.order = t.samples;
    this.base = Math.min(...t.samples.map((s) => s.cts));
    this.make();
  }

  /** The reader for a clip's file, or null when this phone or this file cannot be read this way. */
  static async open(blob: Blob): Promise<Reader | null> {
    const D = (globalThis as unknown as { VideoDecoder?: typeof VideoDecoder }).VideoDecoder;
    if (!D || blob.size > MAX_READ_BYTES) return null;
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const t = demuxMp4(bytes);
      if (!t) return null;
      const ok = await D.isConfigSupported({ codec: t.codec, description: t.description });
      return ok.supported ? new Reader(bytes, t) : null;
    } catch {
      return null;
    }
  }

  private make(): void {
    this.dec = new VideoDecoder({
      output: (f) => {
        this.queue.push(f);
        this.queue.sort((a, b) => a.timestamp - b.timestamp);
        this.wake();
      },
      error: (e) => {
        this.err = e;
        this.wake();
      },
    });
    this.dec.configure({ codec: this.t.codec, description: this.t.description });
  }
  private wake(): void {
    for (const w of this.waiters.splice(0)) w();
  }
  private pts(s: Sample): number {
    return Math.round(((s.cts - this.base) * 1e6) / this.t.timescale);
  }
  private startFor(us: number): number {
    // the last sync sample at or before the time, in decode order
    let k = 0;
    for (let i = 0; i < this.order.length; i++) {
      if (this.order[i]!.key && this.pts(this.order[i]!) <= us) k = i;
      if (this.pts(this.order[i]!) > us && this.order[i]!.key) break;
    }
    return k;
  }
  private restart(from: number): void {
    for (const f of this.queue) f.close();
    this.queue = [];
    try {
      this.dec.close();
    } catch {
      /* closed already */
    }
    this.make();
    this.next = from;
    this.fed = 0;
    this.done = false;
    this.lastTs = -1;
  }
  private feed(n: number): void {
    for (let i = 0; i < n && this.next < this.order.length; i++, this.next++) {
      const s = this.order[this.next]!;
      this.dec.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: this.pts(s), data: this.bytes.subarray(s.offset, s.offset + s.size) }));
      this.fed++;
    }
    if (this.next >= this.order.length && !this.done) {
      this.done = true;
      void this.dec.flush().catch(() => undefined).then(() => this.wake());
    }
  }

  private started = false;
  private lastTs = -1;
  /** The frame showing at `ms` of the clip's source (the last one at or before it). The caller closes it with `close()`. */
  async frameAt(ms: number): Promise<VideoFrame> {
    const us = Math.max(0, Math.round(ms * 1000));
    // the first call, or a time before the one last given (going back): start again from the key frame before it
    if (!this.started || us < this.lastTs) {
      this.restart(this.startFor(us));
      this.started = true;
    }
    for (let spins = 0; ; spins++) {
      if (this.err) throw this.err;
      const after = this.queue.findIndex((f) => f.timestamp > us);
      // the right frame is known once one after it has come (or the clip has ended)
      if ((after >= 0 || (this.done && this.dec.decodeQueueSize === 0)) && this.queue.length) {
        const idx = after < 0 ? this.queue.length - 1 : Math.max(0, after - 1);
        for (let i = 0; i < idx; i++) this.queue[i]!.close();
        this.queue.splice(0, idx);
        this.lastTs = this.queue[0]!.timestamp;
        const out = this.queue[0]!.clone();
        // (the decoder works on while the caller works on this frame: a few more samples are fed now, as long as the pictures waiting are few)
        if (this.dec.decodeQueueSize < 8 && this.queue.length < 24 && this.next < this.order.length) this.feed(4);
        return out;
      }
      if (this.dec.decodeQueueSize < 12 && this.next < this.order.length) this.feed(6);
      if (spins > 4000) throw new Error('the decoder gave no frame');
      await new Promise<void>((ok) => {
        this.waiters.push(ok);
        setTimeout(ok, 30);
      });
    }
  }

  close(): void {
    for (const f of this.queue) f.close();
    this.queue = [];
    try {
      this.dec.close();
    } catch {
      /* closed already */
    }
  }
}
