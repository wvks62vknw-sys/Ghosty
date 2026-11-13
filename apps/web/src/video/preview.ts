/**
 * THE SCREEN'S PLAYER (BRIEF-EDITOR-VIDEO): the picture through the phone's own `<video>` elements, one a source, seeking as the
 * playhead moves and drawn into one WebGL2 canvas (gpu.ts) at the screen's size; play uses the elements' own clocks, kept within
 * 40 ms of the playhead where the phone lets them be, and the sound is WebAudio (mix.ts). Scrubbing lands on the nearest frame the
 * phone's seek gives. The export drives the same player at its own size (export.ts).
 */
import { Gpu } from './gpu';
import { trail } from '../ui/hisWords';
import { buildMix, decodeAudio, type Buffers, type Built } from './mix';
import { buildSpec, endOf, paintText, planFrame, type FramePlan } from './compose';
import { shape, type Project, type Source } from './model';
import { lutBytes, type Lut } from './lut';
import { speedNow } from './math';

export const CODEC_LINE = 'Your phone can’t read this clip’s codec; a copy from Photos usually works.';

interface El {
  v: HTMLVideoElement;
  url: string;
  w: number;
  h: number;
  dur: number;
}

const once = (el: EventTarget, ok: string, bad = 'error', ms = 8000): Promise<void> =>
  new Promise((res, rej) => {
    const t = setTimeout(() => done(new Error('timeout')), ms);
    const done = (e?: Error) => {
      clearTimeout(t);
      el.removeEventListener(ok, onOk);
      el.removeEventListener(bad, onBad);
      e ? rej(e) : res();
    };
    const onOk = () => done();
    const onBad = () => done(new Error(bad));
    el.addEventListener(ok, onOk);
    el.addEventListener(bad, onBad);
  });

/** A clip's `<video>` element ready at its first frame (null from `open` when the phone cannot read it). */
export class Feeder {
  private els = new Map<string, El>();
  readonly root: HTMLElement;
  constructor(root?: HTMLElement) {
    this.root = root ?? (() => {
      const d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
      document.body.append(d);
      return d;
    })();
  }
  async open(id: string, blob: Blob): Promise<{ w: number; h: number; dur: number }> {
    const old = this.els.get(id);
    if (old) return old;
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('playsinline', '');
    const url = URL.createObjectURL(blob);
    v.src = url;
    this.root.append(v);
    try {
      await once(v, 'loadeddata', 'error', 20000);
    } catch (e) {
      trail(v.error ?? e, 'open a clip in the preview'); // (the why goes to the WHY trail, never the screen)
      v.remove();
      URL.revokeObjectURL(url);
      throw new Error(CODEC_LINE);
    }
    // a recorder's file may not know its length until it is played to the end
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e9;
      await once(v, 'seeked', 'error', 4000).catch(() => undefined);
      v.currentTime = 0;
      await once(v, 'seeked', 'error', 4000).catch(() => undefined);
    }
    const e: El = { v, url, w: v.videoWidth, h: v.videoHeight, dur: Math.round(v.duration * 1000) };
    if (!e.w || !e.h) {
      this.drop(id);
      throw new Error(CODEC_LINE);
    }
    this.els.set(id, e);
    return e;
  }
  has = (id: string): boolean => this.els.has(id);
  get(id: string): El | undefined {
    return this.els.get(id);
  }
  /** Seek an element to `ms` of its source and wait for the frame (unless it is already within half a frame). */
  async seek(id: string, ms: number): Promise<void> {
    const e = this.els.get(id);
    if (!e) return;
    const want = Math.min(Math.max(0, ms / 1000), Math.max(0, e.v.duration - 0.001));
    if (!e.v.seeking && Math.abs(e.v.currentTime - want) < 0.012 && e.v.readyState >= 2) return;
    e.v.currentTime = want;
    await once(e.v, 'seeked', 'error', 5000).catch(() => undefined);
  }
  drop(id: string): void {
    const e = this.els.get(id);
    if (!e) return;
    e.v.pause();
    e.v.remove();
    URL.revokeObjectURL(e.url);
    this.els.delete(id);
  }
  pauseAll(except?: Set<string>): void {
    for (const [id, e] of this.els) if (!except?.has(id) && !e.v.paused) e.v.pause();
  }
  dispose(): void {
    for (const id of [...this.els.keys()]) this.drop(id);
  }
}

/** What a file is as a clip: its length and size, a poster frame, and whether it has sound the phone can read. */
export async function probe(file: Blob, name: string, id: string): Promise<{ src: Source; poster: Blob | null }> {
  const f = new Feeder();
  try {
    const m = await f.open(id, file);
    const e = f.get(id)!;
    await f.seek(id, Math.min(1000, m.dur / 3));
    const c = document.createElement('canvas');
    const k = 192 / Math.max(m.w, m.h);
    c.width = Math.max(2, Math.round(m.w * k));
    c.height = Math.max(2, Math.round(m.h * k));
    c.getContext('2d')!.drawImage(e.v, 0, 0, c.width, c.height);
    const poster = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.7));
    let hasAudio = false;
    const ac = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    try {
      hasAudio = file.size < 400_000_000 && !!(await decodeAudio(ac, file));
    } finally {
      void ac.close();
    }
    return { src: { id, name, kind: 'video', size: file.size, dur: m.dur, w: m.w, h: m.h, fps: 30, hasAudio }, poster };
  } finally {
    f.dispose();
    f.root.remove();
  }
}

export interface PlayerOptions {
  /** Sound in play (the screen); the export draws silent and records the mix another way. */
  audio?: boolean;
  /** The audio context to use (the real-time export makes it first, to tap its sound). */
  ctx?: AudioContext;
  /** Where the sound goes besides (or instead of) the speakers: the real-time export's recorder. */
  tap?: MediaStreamAudioDestinationNode;
  /** Reduced motion: a transition is a cut at its middle. */
  still?: boolean;
  onTick?(t: number): void;
  onEnd?(): void;
  /** The context was lost. */
  onLost?(): void;
  /** A reversed clip is playing: the preview seeks backwards and is rough (said once). */
  onRough?(): void;
}

export class Player {
  readonly gpu: Gpu;
  private text: HTMLCanvasElement;
  project: Project;
  t = 0;
  playing = false;
  buffers: Buffers = new Map();
  private ac: AudioContext | null = null;
  built: Built | null = null;
  private w0 = 0;
  private t0 = 0;
  private raf = 0;
  lastPlan: FramePlan | null = null;
  /** Held down on the picture: every clip drawn as it was shot (no grade, no LUT). */
  ungraded = false;
  /** The picture plays without its sound (a voice-over being recorded over it). */
  silent = false;
  drawn = 0;
  private roughSaid = false;
  /** The luts already sent to the GPU. */
  private lutDone = new Set<string>();

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly feeder: Feeder,
    p: Project,
    private o: PlayerOptions = {},
  ) {
    this.gpu = new Gpu(canvas);
    this.gpu.onLost = () => o.onLost?.();
    this.text = document.createElement('canvas');
    this.project = p;
    this.resize();
  }

  /** The canvas's size for this project: the long side `long` pixels at the project's shape. */
  resize(long = Math.min(960, Math.max(this.canvas.width, this.canvas.height, 480))): void {
    const s = shape(this.project, long);
    if (this.canvas.width !== s.w || this.canvas.height !== s.h) {
      this.canvas.width = s.w;
      this.canvas.height = s.h;
    }
    this.text.width = s.w;
    this.text.height = s.h;
  }
  setSize(long: number): void {
    const s = shape(this.project, long);
    this.canvas.width = s.w;
    this.canvas.height = s.h;
    this.text.width = s.w;
    this.text.height = s.h;
  }

  setProject(p: Project): void {
    this.project = p;
    for (const [id, l] of Object.entries(p.luts)) {
      if (this.lutDone.has(id)) continue;
      this.lutDone.add(id);
      const lut: Lut = { title: l.name, size: l.size, data: Float32Array.from(l.data) };
      this.gpu.setLut(id, l.size, lutBytes(lut));
    }
    if (this.playing) this.restartAudio();
  }

  get end(): number {
    return endOf(this.project);
  }

  private get still(): boolean {
    return !!this.o.still;
  }

  private spec(plan: FramePlan) {
    const text = paintText(this.text, this.project, plan.t) ? this.text : null;
    const s = buildSpec(plan, this.project, (id) => {
      const e = this.feeder.get(id);
      return e ? { el: e.v, w: e.w, h: e.h } : null;
    }, text);
    if (this.ungraded) {
      const bare = (l: typeof s.main | undefined) => (l ? { ...l, grade: undefined, lut: undefined } : l);
      s.main = bare(s.main) ?? null;
      s.mainB = bare(s.mainB) ?? null;
      s.overlays = s.overlays.map((o) => bare(o)!);
    }
    if (this.still && s.tr && s.mainB) {
      const second = s.tr.p >= 0.5;
      return { ...s, main: second ? s.mainB : s.main, mainB: null, tr: null };
    }
    return s;
  }

  /** Draw the frame at the current time from what the elements show now. */
  draw(): void {
    if (this.gpu.lost) return;
    const plan = planFrame(this.project, this.t);
    this.lastPlan = plan;
    this.gpu.draw(this.spec(plan));
    this.drawn++;
  }

  /** Put the playhead at `ms`, bring every needed element to its frame and draw. */
  private seekSeq = 0;
  async seek(ms: number): Promise<void> {
    const mine = ++this.seekSeq;
    this.t = Math.min(Math.max(0, ms), Math.max(0, this.end));
    const plan = planFrame(this.project, this.t);
    await Promise.all(plan.layers.map((l) => this.feeder.seek(l.clip.src, l.srcMs)));
    // (a seek made after this one has the picture now: an earlier one finishing late must not draw over it)
    if (mine !== this.seekSeq) return;
    // (the second half of a transition's elements are not playing: they are held on their frame)
    this.draw();
  }

  // ------------------------------------------------------------ sound
  async loadSound(): Promise<void> {
    if (!this.o.audio && !this.o.tap) return;
    this.ac ??= this.o.ctx ?? new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const need = new Set<string>();
    for (const c of this.project.main) if (this.project.sources[c.src]?.hasAudio) need.add(c.src);
    for (const a of [...this.project.music, ...this.project.voice]) need.add(a.src);
    for (const id of need) {
      if (this.buffers.has(id)) continue;
      const b = await this.blobOf?.(id);
      const buf = b ? await decodeAudio(this.ac, b) : null;
      if (buf) this.buffers.set(id, buf);
    }
  }
  blobOf?: (src: string) => Promise<Blob | null>;

  private startAudio(): void {
    if (!this.ac || this.silent || (!this.o.audio && !this.o.tap)) return;
    void this.ac.resume();
    this.built?.stop();
    this.built = buildMix(this.ac, this.project, this.buffers, this.t, this.ac.currentTime + 0.05, this.o.tap ?? this.ac.destination);
  }
  private restartAudio(): void {
    this.t = this.t0 + (performance.now() - this.w0);
    this.t0 = this.t;
    this.w0 = performance.now();
    this.startAudio();
  }
  /** The live gain of the first node of a kind (the mixer's node values, read by the spec). */
  nodeGain(kind: 'clip' | 'music' | 'voice'): number | null {
    const n = this.built?.nodes.find((x) => x.strand.kind === kind);
    return n ? n.gain.gain.value : null;
  }

  // ------------------------------------------------------------ play
  play(): void {
    if (this.playing) return;
    if (this.t >= this.end - 30) this.t = 0;
    this.playing = true;
    this.t0 = this.t;
    this.w0 = performance.now();
    this.startAudio();
    const loop = () => {
      if (!this.playing) return;
      this.t = this.t0 + (performance.now() - this.w0);
      if (this.t >= this.end) {
        this.t = this.end;
        this.pause();
        void this.seek(Math.max(0, this.end - 1)).then(() => this.o.onEnd?.());
        return;
      }
      const plan = planFrame(this.project, this.t);
      const keep = new Set<string>();
      for (const l of plan.layers) {
        const e = this.feeder.get(l.clip.src);
        if (!e) continue;
        keep.add(l.clip.src);
        const want = l.srcMs / 1000;
        if (l.clip.reverse) {
          // a phone's player cannot play backwards: it is held and sought to each picture (rough, and said once); the export is exact
          if (!e.v.paused) e.v.pause();
          if (!this.roughSaid) {
            this.roughSaid = true;
            this.o.onRough?.();
          }
          if (!e.v.seeking && Math.abs(e.v.currentTime - want) > 0.03) e.v.currentTime = want;
          continue;
        }
        const rate = Math.min(16, Math.max(0.25, speedNow(l.clip, l.tIn)));
        if (Math.abs(e.v.playbackRate - rate) > 0.01) e.v.playbackRate = rate;
        if (e.v.paused || Math.abs(e.v.currentTime - want) > 0.12) {
          e.v.currentTime = want;
          void e.v.play().catch(() => undefined);
        }
      }
      this.feeder.pauseAll(keep);
      this.lastPlan = plan;
      this.gpu.draw(this.spec(plan));
      this.drawn++;
      this.o.onTick?.(this.t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.built?.stop();
    this.built = null;
    this.feeder.pauseAll();
  }

  dispose(): void {
    this.pause();
    cancelAnimationFrame(this.raf);
    if (this.ac && this.ac.state !== 'closed') void this.ac.close().catch(() => undefined);
    this.gpu.dispose();
  }
}
