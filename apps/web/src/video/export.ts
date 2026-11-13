/**
 * THE EXPORT (BRIEF-EDITOR-VIDEO): two paths, the first chosen when the phone has it. (1) WebCodecs: each frame drawn by the GPU
 * pipeline at the export's size is encoded as H.264 and the mix, rendered offline, as AAC, and the app's own muxer (mp4.ts) writes
 * the flat .mp4. (2) MediaRecorder on the canvas's captureStream with the mix as its audio track, in real time, in the type the
 * phone's recorder writes (mp4 first, else webm). Both say the size before (an estimate from bit rate and length, "about") and
 * after (measured). The originals are never touched, and a proxy is never used here. Where the H.264 encoder takes its settings and
 * then cannot be made, the export falls back to (2) and says so in one line (FELL_BACK).
 */
import { shape, type Aspect, type Project } from './model';
import { endOf } from './compose';
import { Feeder, Player } from './preview';
import { Gpu } from './gpu';
import { lutBytes } from './lut';
import { Reader } from './reader';
import { buildSpec, paintText, planFrame, type LayerPlan } from './compose';
import { renderMix, type Buffers, decodeAudio } from './mix';
import { muxMp4, type AudioSample, type VideoSample } from './mp4';
import { sizeWords } from '../convert/bytes';

/** The places a video goes, by shape (never by a company's name). */
export const PRESETS: { id: string; label: string; line: string; aspect: Aspect; long: number | 'source' }[] = [
  { id: 'story', label: 'Tall story', line: '9:16, 1080 × 1920', aspect: '9:16', long: 1920 },
  { id: 'post', label: 'Square post', line: '1:1, 1080 × 1080', aspect: '1:1', long: 1080 },
  { id: 'wide', label: 'Wide 1080p', line: '16:9, 1920 × 1080', aspect: '16:9', long: 1920 },
  { id: 'source', label: 'As it is', line: 'the video’s own shape and size', aspect: 'project', long: 'source' },
];
export const QUALITIES = [
  { id: 'small', label: 'Smaller', k: 0 },
  { id: 'good', label: 'Good', k: 1 },
  { id: 'best', label: 'Best', k: 2 },
];

/** The bit rate (bits a second) from a table by size and the quality picked, at 30 frames a second. */
export function videoBitrate(w: number, h: number, fps: number, quality: number): number {
  const long = Math.max(w, h);
  const row = long <= 854 ? [1_000_000, 1_800_000, 3_000_000] : long <= 1280 ? [2_000_000, 3_500_000, 6_000_000] : long <= 1920 ? [4_000_000, 7_000_000, 12_000_000] : [8_000_000, 14_000_000, 24_000_000];
  return Math.round((row[Math.min(2, Math.max(0, quality))]! * fps) / 30 / 1000) * 1000;
}
export const AUDIO_BITRATE = 128_000;
/** "About 52 MB": bit rate and length, the word "about". */
export function estimateBytes(durMs: number, w: number, h: number, fps: number, quality: number, sound = true): number {
  return Math.round(((videoBitrate(w, h, fps, quality) + (sound ? AUDIO_BITRATE : 0)) * durMs) / 8000);
}
/** The size said before the tap on the recorder path: the rates passed to the recorder (videoBitsPerSecond plus audioBitsPerSecond) times the length. */
export const recorderBytes = (durMs: number, w: number, h: number, fps: number, quality: number): number => Math.round(((videoBitrate(w, h, fps, quality) + AUDIO_BITRATE) * durMs) / 8000);
export const aboutSize = (n: number): string => `about ${sizeWords(n < 10_000 ? n : Math.round(n / 100_000) * 100_000)}`;

export interface PathInfo {
  path: 'webcodecs' | 'recorder';
  /** The H.264 string the encoder accepted. */
  codec?: string;
  /** The recorder's type. */
  mime?: string;
  /** Why not WebCodecs, when it is the recorder. */
  why: string;
  /** Whether the audio encoder was there. */
  audioEncoder: boolean;
  videoEncoder: boolean;
}

const encoders = () => {
  const w = globalThis as unknown as { VideoEncoder?: typeof VideoEncoder; AudioEncoder?: typeof AudioEncoder; MediaRecorder?: typeof MediaRecorder };
  return w;
};

/** How many pictures a reversed clip's cache holds: about 96 MB of them, from eight to ninety. */
export const reverseChunk = (w: number, h: number): number => Math.max(8, Math.min(90, Math.floor((96 * 1024 * 1024) / Math.max(1, w * h * 4))));

/** Which path this phone takes, checked once (VideoEncoder and AudioEncoder `isConfigSupported`, then the recorder's types). */
let chosen: Promise<PathInfo> | null = null;
export function choosePath(w = 1920, h = 1080, fps = 30): Promise<PathInfo> {
  chosen ??= (async () => {
    const E = encoders();
    const videoEncoder = !!E.VideoEncoder;
    const audioEncoder = !!E.AudioEncoder;
    let codec: string | undefined;
    let aac = false;
    try {
      if (E.VideoEncoder) {
        for (const c of ['avc1.64002a', 'avc1.42002a', 'avc1.42001f']) {
          const r = await E.VideoEncoder.isConfigSupported({ codec: c, width: Math.max(2, w), height: Math.max(2, h), bitrate: 4_000_000, framerate: fps, avc: { format: 'avc' } } as VideoEncoderConfig);
          if (r.supported) {
            codec = c;
            break;
          }
        }
      }
      if (E.AudioEncoder) aac = !!(await E.AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 2, bitrate: AUDIO_BITRATE })).supported;
    } catch {
      /* treated as not there */
    }
    if (codec && aac) return { path: 'webcodecs', codec, why: '', audioEncoder, videoEncoder } satisfies PathInfo;
    const mime = recorderMime();
    return {
      path: 'recorder',
      ...(mime ? { mime } : {}),
      why: !videoEncoder ? 'this phone’s browser has no video encoder' : !codec ? 'this phone’s video encoder does not write H.264' : !audioEncoder ? 'this phone’s browser has no AAC encoder' : 'this phone’s AAC encoder is not there',
      audioEncoder,
      videoEncoder,
      ...(codec ? { codec } : {}),
    } satisfies PathInfo;
  })();
  return chosen;
}

/** The recorder's type: mp4 first, else webm. */
const recorderMime = (): string | undefined => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => encoders().MediaRecorder?.isTypeSupported(t));

/**
 * The H.264 encoder said yes to its settings (`isConfigSupported`) and then would not start ("Encoder creation error": a browser
 * built without the codec, as a stock test browser is). The export goes the recorder's way instead and says so in one line.
 */
class EncoderWontStart extends Error {
  constructor() {
    super('the video encoder would not start');
  }
}
/** The one line the owner reads when that happened. */
export const FELL_BACK = 'This phone’s H.264 encoder would not start, so I made the file in real time instead.';

/** One sentence for the export sheet: which path this phone takes. */
export function pathWords(i: PathInfo, durMs: number): string {
  if (i.path === 'webcodecs') return 'This phone writes the file itself, frame by frame, as H.264 and AAC in an .mp4: it plays anywhere.';
  const secs = Math.max(1, Math.round(durMs / 1000));
  const type = i.mime?.startsWith('video/mp4') ? '.mp4' : '.webm';
  return `Made in real time: about ${secs} seconds, as ${type} (${i.why}).`;
}

export interface ExportOptions {
  preset: string;
  quality: number;
  /** Force a path (the spec's own proof of the muxer where the AAC encoder is missing). */
  path?: PathInfo['path'];
  /** Leave the sound out (that same proof). */
  silent?: boolean;
  fps?: number;
  /** The export's long side in pixels, to replace the preset's (the proxy and the spec's small runs). */
  long?: number;
  bitrate?: number;
  blobOf(src: string): Promise<Blob | null>;
  onProgress?(p: { frames: number; of: number; frac: number; left: number; words: string }): void;
  cancel?: { cancelled: boolean };
}
export interface Exported {
  blob: Blob;
  ext: 'mp4' | 'webm';
  mime: string;
  bytes: number;
  frames: number;
  audioPackets: number;
  path: PathInfo['path'];
  seconds: number;
  w: number;
  h: number;
  fps: number;
  durationMs: number;
  /** Said when the frame-by-frame path could not start its encoder and the recorder made the file instead (FELL_BACK). */
  fellBack?: string;
}
export class Cancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

const leftWords = (s: number): string => (s < 1.5 ? 'a moment left' : s < 90 ? `about ${Math.round(s)} s left` : `about ${Math.round(s / 60)} min left`);

async function prepare(p: Project, o: ExportOptions) {
  const pre = PRESETS.find((x) => x.id === o.preset) ?? PRESETS[2]!;
  const src = Object.values(p.sources).reduce((m, s) => Math.max(m, s.w, s.h), 0) || 1920;
  const long = o.long ?? (pre.long === 'source' ? src : pre.long);
  const q: Project = { ...p, aspect: pre.aspect };
  const s = shape(q, long);
  const canvas = document.createElement('canvas');
  const feeder = new Feeder();
  for (const id of new Set(p.main.map((c) => c.src).concat(p.overlays.flatMap((x) => (x.clip ? [x.clip.src] : []))))) {
    const b = await o.blobOf(id);
    if (b) await feeder.open(id, b);
  }
  return { q, s, canvas, feeder };
}

export async function exportVideo(p: Project, o: ExportOptions): Promise<Exported> {
  const info = await choosePath();
  const path = o.path ?? info.path;
  const t0 = performance.now();
  const { q, s, canvas, feeder } = await prepare(p, o);
  const fps = o.fps ?? p.fps;
  const dur = endOf(p);
  try {
    if (path === 'webcodecs') {
      const codec = info.codec ?? 'avc1.42002a';
      try {
        return await viaWebCodecs(q, o, { s, canvas, feeder, fps, dur, codec, t0 });
      } catch (e) {
        if (!(e instanceof EncoderWontStart)) throw e;
        // from now on this phone takes the recorder's path, and the export sheet says why
        const mime = info.mime ?? recorderMime();
        chosen = Promise.resolve({ ...info, path: 'recorder', ...(mime ? { mime } : {}), why: 'this phone’s video encoder would not start' } satisfies PathInfo);
        const r = await viaRecorder(q, o, { s, canvas: document.createElement('canvas'), feeder, fps, dur, mime: mime ?? 'video/webm', t0 });
        return { ...r, fellBack: FELL_BACK };
      }
    }
    return await viaRecorder(q, o, { s, canvas, feeder, fps, dur, mime: info.mime ?? 'video/webm', t0 });
  } finally {
    feeder.dispose();
    feeder.root.remove();
  }
}

interface Ctx {
  s: { w: number; h: number };
  canvas: HTMLCanvasElement;
  feeder: Feeder;
  fps: number;
  dur: number;
  t0: number;
}

/** The export's frames: a clip's own reader (WebCodecs decode, in turn) where its file can be read that way, else the phone's player seeking. */
class Pull {
  private readers = new Map<string, Reader | null>();
  /** A reversed clip's frames: the chunk of the source before the time asked for, kept as bitmaps and handed out backwards. */
  private revs = new Map<string, { lo: number; hi: number; maps: ImageBitmap[] }>();
  constructor(private blobOf: (src: string) => Promise<Blob | null>, private feeder: Feeder, private step = 33) {}
  private async reversed(l: LayerPlan, r: Reader): Promise<{ el: CanvasImageSource; w: number; h: number; done(): void }> {
    let c = this.revs.get(l.clip.id);
    const ms = l.srcMs;
    if (!c || ms < c.lo || ms > c.hi) {
      for (const m of c?.maps ?? []) m.close();
      // the cache holds what room it has: about 96 MB of bitmaps, never fewer than eight pictures
      const n = reverseChunk(r.w, r.h);
      const hi = Math.min(l.clip.out, ms + this.step);
      const lo = Math.max(l.clip.in, hi - n * this.step);
      const maps: ImageBitmap[] = [];
      for (let t = lo; t <= hi + 0.5; t += this.step) {
        const f = await r.frameAt(t);
        maps.push(await createImageBitmap(f as unknown as ImageBitmapSource));
        f.close();
      }
      c = { lo, hi, maps };
      this.revs.set(l.clip.id, c);
    }
    const i = Math.min(c.maps.length - 1, Math.max(0, Math.round((ms - c.lo) / this.step)));
    return { el: c.maps[i]!, w: r.w, h: r.h, done: () => undefined };
  }
  async layer(l: LayerPlan): Promise<{ el: CanvasImageSource; w: number; h: number; done(): void }> {
    let r = this.readers.get(l.clip.id);
    if (r === undefined) {
      const b = await this.blobOf(l.clip.src);
      r = b ? await Reader.open(b) : null;
      this.readers.set(l.clip.id, r);
    }
    if (r && l.clip.reverse) return this.reversed(l, r);
    if (r) {
      const f = await r.frameAt(l.srcMs);
      return { el: f as unknown as CanvasImageSource, w: r.w, h: r.h, done: () => f.close() };
    }
    await this.feeder.seek(l.clip.src, l.srcMs);
    const e = this.feeder.get(l.clip.src)!;
    return { el: e.v, w: e.w, h: e.h, done: () => undefined };
  }
  /** Let go of the readers of clips that are no longer showing. */
  keep(ids: Set<string>): void {
    for (const [id, r] of this.readers) if (!ids.has(id) && r) {
      r.close();
      this.readers.set(id, null);
      for (const m of this.revs.get(id)?.maps ?? []) m.close();
      this.revs.delete(id);
    }
  }
  dispose(): void {
    for (const r of this.readers.values()) r?.close();
    this.readers.clear();
    for (const c of this.revs.values()) for (const m of c.maps) m.close();
    this.revs.clear();
  }
  /** How many clips were read by WebCodecs. */
  get decoded(): number {
    return [...this.readers.values()].filter(Boolean).length;
  }
}

async function viaWebCodecs(p: Project, o: ExportOptions, c: Ctx & { codec: string }): Promise<Exported> {
  const E = encoders();
  const gpu = new Gpu(c.canvas);
  c.canvas.width = c.s.w;
  c.canvas.height = c.s.h;
  for (const [id, l] of Object.entries(p.luts)) gpu.setLut(id, l.size, lutBytes({ title: l.name, size: l.size, data: Float32Array.from(l.data) }));
  const text = document.createElement('canvas');
  text.width = c.s.w;
  text.height = c.s.h;
  const pull = new Pull(o.blobOf, c.feeder, 1000 / Math.max(10, c.fps));
  const n = Math.max(1, Math.round((c.dur / 1000) * c.fps));
  const quality = o.quality;
  const vsamples: VideoSample[] = [];
  let avcC: Uint8Array | null = null;
  /** The video encoder's error, and the sound's (an AAC failure is never taken for the video encoder not starting). */
  let error: Error | null = null;
  let aerror: Error | null = null;
  const venc = new E.VideoEncoder!({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      vsamples.push({ data, dur: Math.round(1e6 / c.fps), key: chunk.type === 'key' });
      const d = meta?.decoderConfig?.description;
      if (d && !avcC) avcC = new Uint8Array(d instanceof ArrayBuffer ? d : (d as ArrayBufferView).buffer.slice((d as ArrayBufferView).byteOffset, (d as ArrayBufferView).byteOffset + (d as ArrayBufferView).byteLength));
    },
    error: (e) => (error = e),
  });
  venc.configure({ codec: c.codec, width: c.s.w, height: c.s.h, bitrate: o.bitrate ?? videoBitrate(c.s.w, c.s.h, c.fps, quality), framerate: c.fps, avc: { format: 'avc' }, latencyMode: 'quality' } as VideoEncoderConfig);
  // the encoder is made when its settings are taken: an empty flush waits for that, and fails if it could not be made
  const wontStart = () => {
    if (venc.state !== 'closed') venc.close();
    pull.dispose();
    gpu.dispose();
    return new EncoderWontStart();
  };
  try {
    await venc.flush();
  } catch {
    throw wontStart();
  }
  if (error) throw wontStart();

  // the sound first, rendered offline: it is quick, and its failure should come before the long part
  const asamples: AudioSample[] = [];
  let aconfig: Uint8Array | null = null;
  if (!o.silent) {
    const ac = new OfflineAudioContext(1, 1, 48_000);
    const buffers: Buffers = new Map();
    const need = new Set<string>();
    for (const cl of p.main) if (p.sources[cl.src]?.hasAudio) need.add(cl.src);
    for (const a of [...p.music, ...p.voice]) need.add(a.src);
    for (const id of need) {
      const b = await o.blobOf(id);
      const buf = b ? await decodeAudio(ac, b) : null;
      if (buf) buffers.set(id, buf);
    }
    const mixed = await renderMix(p, buffers);
    const aenc = new E.AudioEncoder!({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        asamples.push({ data, dur: 1024 });
        const d = meta?.decoderConfig?.description;
        if (d && !aconfig) aconfig = new Uint8Array(d instanceof ArrayBuffer ? d : (d as ArrayBufferView).buffer.slice((d as ArrayBufferView).byteOffset, (d as ArrayBufferView).byteOffset + (d as ArrayBufferView).byteLength));
      },
      error: (e) => (aerror = e),
    });
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 2, bitrate: AUDIO_BITRATE });
    const L = mixed.getChannelData(0);
    const R = mixed.numberOfChannels > 1 ? mixed.getChannelData(1) : L;
    const total = Math.min(mixed.length, Math.round((c.dur / 1000) * 48_000));
    const step = 48_000;
    for (let i = 0; i < total; i += step) {
      const len = Math.min(step, total - i);
      const planar = new Float32Array(len * 2);
      planar.set(L.subarray(i, i + len), 0);
      planar.set(R.subarray(i, i + len), len);
      const data = new AudioData({ format: 'f32-planar', sampleRate: 48_000, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((i / 48_000) * 1e6), data: planar });
      aenc.encode(data);
      data.close();
    }
    await aenc.flush();
    aenc.close();
    if (aerror) throw aerror;
  }

  const tStart = performance.now();
  for (let i = 0; i < n; i++) {
    if (o.cancel?.cancelled) {
      venc.close();
      pull.dispose();
      throw new Cancelled();
    }
    if (error) throw vsamples.length ? error : wontStart();
    const t = (i * 1000) / c.fps;
    const plan = planFrame(p, t);
    pull.keep(new Set(plan.layers.map((l) => l.clip.id)));
    const got = new Map<string, Awaited<ReturnType<Pull['layer']>>>();
    for (const l of plan.layers) got.set(l.clip.id, await pull.layer(l));
    const spec = buildSpec(plan, p, (_src, id) => got.get(id) ?? null, paintText(text, p, t) ? text : null);
    gpu.draw(spec);
    for (const g of got.values()) g.done();
    const frame = new VideoFrame(c.canvas, { timestamp: Math.round((i * 1e6) / c.fps), duration: Math.round(1e6 / c.fps) });
    venc.encode(frame, { keyFrame: i % (c.fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (i % 3 === 0 || i === n - 1) {
      const per = (performance.now() - tStart) / (i + 1);
      const left = (per * (n - i - 1)) / 1000;
      o.onProgress?.({ frames: i + 1, of: n, frac: (i + 1) / n, left, words: `${i + 1} of ${n} frames, ${leftWords(left)}` });
    }
  }
  try {
    await venc.flush();
  } catch (e) {
    throw vsamples.length ? e : wontStart();
  }
  venc.close();
  if (error) throw vsamples.length ? error : wontStart();
  const read = pull.decoded;
  pull.dispose();
  gpu.dispose();
  if (!avcC || !vsamples.length) throw new Error('this phone’s encoder gave nothing');
  const out = muxMp4({ width: c.s.w, height: c.s.h, avcC, samples: vsamples }, o.silent || !aconfig ? null : { rate: 48_000, channels: 2, config: aconfig, samples: asamples });
  const blob = new Blob(out.parts as BlobPart[], { type: 'video/mp4' });
  void read;
  return { blob, ext: 'mp4', mime: 'video/mp4', bytes: blob.size, frames: vsamples.length, audioPackets: asamples.length, path: 'webcodecs', seconds: (performance.now() - c.t0) / 1000, w: c.s.w, h: c.s.h, fps: c.fps, durationMs: c.dur };
}

async function viaRecorder(p: Project, o: ExportOptions, c: Ctx & { mime: string }): Promise<Exported> {
  const ctx = new AudioContext();
  const tap = ctx.createMediaStreamDestination();
  const player = new Player(c.canvas, c.feeder, p, { audio: !o.silent, ctx, tap, stay: true });
  player.blobOf = o.blobOf;
  player.setSize(Math.max(c.s.w, c.s.h));
  player.setProject(p);
  await player.loadSound();
  const stream = new MediaStream([...c.canvas.captureStream(c.fps).getVideoTracks(), ...tap.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: c.mime, videoBitsPerSecond: o.bitrate ?? videoBitrate(c.s.w, c.s.h, c.fps, o.quality), audioBitsPerSecond: AUDIO_BITRATE });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const stopped = new Promise<void>((ok) => (rec.onstop = () => ok()));
  await player.seek(0);
  rec.start(1000);
  const tStart = performance.now();
  const ended = new Promise<void>((ok) => {
    (player as unknown as { o: { onEnd?: () => void; onTick?: (t: number) => void } }).o.onEnd = ok;
    (player as unknown as { o: { onTick?: (t: number) => void } }).o.onTick = (t) => {
      const left = Math.max(0, (c.dur - t) / 1000);
      o.onProgress?.({ frames: player.drawn, of: Math.round((c.dur / 1000) * c.fps), frac: Math.min(1, t / c.dur), left, words: `${Math.round(t / 1000)} of ${Math.round(c.dur / 1000)} s, ${leftWords(left)}` });
      if (o.cancel?.cancelled) ok();
    };
  });
  const playedAt = performance.now();
  player.play();
  // [ci] The file ends at the last picture the recorder's encoder has handed on when it is stopped, and an encoder hands a picture on
  // only once the next one has come in: the last picture drawn is lost. With the player drawing three pictures a second (CI's
  // software GPU, or a slow phone) that cost the file up to a third of a second (54797 ms against 54902: FINAL-CI 2). So the timeline's
  // last picture is drawn at the timeline's own length after the start, and the same picture twice more, 40 ms apart, to push it
  // through; where nothing is held back, the file runs at most 80 ms over. Then two frames and 150 ms for it to arrive.
  const atEnd = new Promise<void>((ok) => setTimeout(ok, Math.max(0, playedAt + c.dur - performance.now())));
  await Promise.race([ended, atEnd]);
  player.pause();
  player.t = Math.min(player.t, Math.max(0, c.dur - 1));
  for (let k = 0; k < 3; k++) {
    await new Promise((r) => setTimeout(r, Math.max(0, playedAt + c.dur + k * 40 - performance.now())));
    player.draw();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
  const drawnAt = performance.now();
  for (let k = 0; k < 2; k++) await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  await new Promise((r) => setTimeout(r, Math.max(0, drawnAt + 150 - performance.now())));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  const frames = player.drawn;
  player.dispose();
  if (ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  void tStart;
  if (o.cancel?.cancelled) throw new Cancelled();
  const mime = c.mime.split(';')[0]!;
  const blob = new Blob(parts, { type: mime });
  return { blob, ext: mime.includes('mp4') ? 'mp4' : 'webm', mime, bytes: blob.size, frames, audioPackets: 0, path: 'recorder', seconds: (performance.now() - c.t0) / 1000, w: c.s.w, h: c.s.h, fps: c.fps, durationMs: c.dur };
}
