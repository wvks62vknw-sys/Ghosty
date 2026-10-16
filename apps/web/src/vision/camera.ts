/**
 * The phone's camera for the Lens: getUserMedia with a facing side (rear by default, FLIP to the
 * front), the torch where the device has one, capture to a canvas and
 * JPEG downscaling for what the owner chooses to send. Plain words for every camera error.
 * Nothing here sends anything anywhere.
 */
import type { Size } from './boxes';

export type Facing = 'environment' | 'user';

/** A camera error in plain words (what to do about it when there is something to do). */
export function cameraMessage(e: unknown): string {
  const name = String((e as { name?: unknown })?.name ?? '');
  const msg = String((e as { message?: unknown })?.message ?? (typeof e === 'string' ? e : '') ?? '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'Camera not allowed: Settings → Safari → Camera (or the site settings in your browser), then try again';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'No camera on this device';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'The camera is busy in another app';
  if (/secure context|insecure|https/i.test(msg)) return 'The camera only works over https';
  if (/getUserMedia|mediaDevices|not supported|not a function|undefined/i.test(msg) || name === 'TypeError') return 'This browser cannot open the camera';
  return `Camera error: ${msg || name || 'unknown'}`;
}

export const cameraSupported = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

export class Camera {
  readonly video: HTMLVideoElement;
  stream: MediaStream | null = null;
  facing: Facing = 'environment';
  /** Bumped by stop() and start(): a start still waiting on the browser can tell it was overtaken. */
  private gen = 0;

  constructor(video?: HTMLVideoElement) {
    this.video = video ?? document.createElement('video');
    // iOS plays inline (not full screen) only with these; muted lets autoplay happen.
    this.video.setAttribute('playsinline', '');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
  }

  get on(): boolean {
    return !!this.stream && this.video.videoWidth > 0;
  }

  /** Frame size in camera pixels. */
  get size(): Size {
    return { w: this.video.videoWidth, h: this.video.videoHeight };
  }

  private track(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  /**
   * Open the camera on one side; resolves once frames arrive. Throws a DOMException the message
   * helper understands. If stop() (or another start) runs while the browser is still opening the
   * camera, the stream it then hands over is stopped at once, not kept: it resolves with `on` false.
   */
  async start(facing: Facing = this.facing): Promise<void> {
    if (!cameraSupported()) throw new TypeError('getUserMedia is not supported');
    this.stop();
    const gen = ++this.gen;
    this.facing = facing;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (gen !== this.gen) {
      // overtaken while opening: nobody wants this stream any more (the camera light would stay on)
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    const settings = this.track()?.getSettings?.();
    if (settings?.facingMode === 'user' || settings?.facingMode === 'environment') this.facing = settings.facingMode;
    await this.video.play().catch(() => undefined);
    if (this.video.videoWidth === 0) {
      await new Promise<void>((ok, bad) => {
        const timer = setTimeout(() => bad(new Error('The camera did not start sending pictures')), 12_000);
        const done = () => {
          clearTimeout(timer);
          ok();
        };
        this.video.addEventListener('loadedmetadata', done, { once: true });
        this.video.addEventListener('playing', done, { once: true });
      });
    }
  }

  async flip(): Promise<void> {
    await this.start(this.facing === 'environment' ? 'user' : 'environment');
  }

  get torchAvailable(): boolean {
    const caps = (this.track() as { getCapabilities?: () => { torch?: boolean } } | null)?.getCapabilities?.();
    return !!caps?.torch;
  }

  /** The torch on or off; false when this camera has none. */
  async torch(on: boolean): Promise<boolean> {
    const t = this.track();
    if (!t || !this.torchAvailable) return false;
    try {
      await t.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.gen++;
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    this.video.srcObject = null;
  }

  /** The frame on screen now as a canvas (full camera size, or at most `maxSide` on the long side); null with no camera. */
  capture(maxSide = 0): HTMLCanvasElement | null {
    if (!this.on) return null;
    return drawScaled(this.video, this.size, maxSide);
  }
}

/** Draw a video, canvas or image into a new canvas, scaled so the long side is at most `maxSide` (0: as is). */
export function drawScaled(src: CanvasImageSource, size: Size, maxSide = 0): HTMLCanvasElement {
  const k = maxSide > 0 ? Math.min(1, maxSide / Math.max(size.w, size.h)) : 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(size.w * k));
  c.height = Math.max(1, Math.round(size.h * k));
  c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** A part of a canvas as its own canvas. */
export function cropCanvas(src: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w));
  c.height = Math.max(1, Math.round(r.h));
  c.getContext('2d')?.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

/** A JPEG data URL of a canvas, at most `maxSide` px on the long side (what ASK GHOSTY sends). */
export function toJpegDataUrl(src: HTMLCanvasElement, maxSide = 1024, quality = 0.8): string {
  const c = Math.max(src.width, src.height) > maxSide ? drawScaled(src, { w: src.width, h: src.height }, maxSide) : src;
  return c.toDataURL('image/jpeg', quality);
}

const blobOf = (c: HTMLCanvasElement, q: number): Promise<Blob | null> => new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));

/** A JPEG blob under `maxBytes`: lower quality first, then a smaller picture. */
export async function toJpegBlob(src: HTMLCanvasElement, maxBytes = 1_500_000, maxSide = 1600): Promise<Blob> {
  let c = Math.max(src.width, src.height) > maxSide ? drawScaled(src, { w: src.width, h: src.height }, maxSide) : src;
  for (let round = 0; round < 6; round++) {
    for (const q of [0.85, 0.7, 0.55]) {
      const b = await blobOf(c, q);
      if (b && b.size <= maxBytes) return b;
    }
    c = drawScaled(c, { w: c.width, h: c.height }, Math.round(Math.max(c.width, c.height) * 0.7));
  }
  const last = await blobOf(c, 0.5);
  if (!last) throw new Error('Could not make a JPEG of the picture');
  return last;
}

/** A picked photo (camera roll) as a canvas, the right way up, at most `maxSide` px. */
export async function loadImageFile(file: Blob, maxSide = 2048): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      const c = drawScaled(bmp, { w: bmp.width, h: bmp.height }, maxSide);
      bmp.close();
      return c;
    } catch {
      /* fall through to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error('That file is not a picture this browser can open'));
      img.src = url;
    });
    return drawScaled(img, { w: img.naturalWidth, h: img.naturalHeight }, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}
