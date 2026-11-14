/**
 * PAINT's files: a painting saved and opened again (its layers as PNGs and its recorded steps), the exports (a flat PNG or JPEG,
 * a layered PSD for Photoshop, Procreate and the rest, an OpenRaster file for Krita and GIMP), and the time-lapse: the recorded
 * steps replayed on a fresh painting, shown here and saved as a video.
 */
import { mk, Painting, type Layer, type Op } from './engine';
import { blobOf } from './pages';
import { psdOf } from './pixels';
import type { Body, SavedLayer, Version } from './store';
import { zipStore } from '../../convert/zip';

export async function saveLayers(p: Painting): Promise<SavedLayer[]> {
  const out: SavedLayer[] = [];
  for (const L of p.layers) {
    out.push({ id: L.id, name: L.name, png: await blobOf(L.c), mask: L.mask ? await blobOf(L.mask) : undefined, blend: L.blend, opacity: L.opacity, visible: L.visible, alphaLock: L.alphaLock, reference: L.reference, ...(L.clip ? { clip: true } : {}) });
  }
  return out;
}
export async function bodyOf(p: Painting): Promise<Body> { return { layers: await saveLayers(p), cur: p.cur, log: p.log.slice() }; }

const drawBlob = async (c: HTMLCanvasElement, b: Blob): Promise<void> => {
  const bmp = await createImageBitmap(b);
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close?.();
};

/** Open a saved painting (or one of its versions) as a live painting. */
export async function openBody(w: number, h: number, paper: string, layers: SavedLayer[], log: Op[], cur = 0): Promise<Painting> {
  const p = new Painting(w, h);
  p.paper = paper;
  for (const s of layers) {
    const L: Layer = { id: s.id, name: s.name, c: mk(w, h), blend: s.blend as GlobalCompositeOperation, opacity: s.opacity, visible: s.visible, alphaLock: s.alphaLock, reference: s.reference, ...(s.clip ? { clip: true } : {}), mask: null };
    await drawBlob(L.c, s.png);
    if (s.mask) { L.mask = mk(w, h); await drawBlob(L.mask, s.mask); }
    p.layers.push(L);
  }
  p.cur = Math.max(0, Math.min(cur, p.layers.length - 1));
  p.log = log.slice();
  return p;
}

export const thumbOf = (p: Painting, size = 320): Promise<Blob> => {
  const flat = p.composite();
  const s = size / Math.max(p.w, p.h);
  const c = mk(p.w * s, p.h * s);
  c.getContext('2d')!.drawImage(flat, 0, 0, c.width, c.height);
  return blobOf(c, 'image/jpeg', 0.82);
};
export async function versionOf(p: Painting): Promise<Version> { return { at: Date.now(), layers: await saveLayers(p), thumb: await thumbOf(p, 200) }; }

// ---- exports
export const pngOf = (p: Painting): Promise<Blob> => blobOf(p.composite(mk(p.w, p.h)));
export const jpegOf = (p: Painting): Promise<Blob> => blobOf(p.composite(mk(p.w, p.h), { paper: true }), 'image/jpeg', 0.92);

/** A layered PSD, top layer last as Photoshop keeps them; the paper is its own bottom layer. */
export function psdBlob(p: Painting): Blob {
  const data = (c: HTMLCanvasElement): Uint8ClampedArray => c.getContext('2d')!.getImageData(0, 0, p.w, p.h).data;
  const layers = [];
  if (p.paper !== 'none') {
    const paper = mk(p.w, p.h), g = paper.getContext('2d')!;
    g.fillStyle = p.paper; g.fillRect(0, 0, p.w, p.h);
    layers.push({ name: 'Paper', rgba: data(paper), opacity: 1, visible: true, blend: 'source-over' });
  }
  for (const L of p.layers) {
    let src = L.c;
    if (L.mask) { src = mk(p.w, p.h); const g = src.getContext('2d')!; g.drawImage(L.c, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(L.mask, 0, 0); }
    layers.push({ name: L.name, rgba: data(src), opacity: L.opacity, visible: L.visible, blend: L.blend, clip: !!L.clip });
  }
  const bytes = psdOf(p.w, p.h, layers, data(p.composite(mk(p.w, p.h), { paper: true })));
  return new Blob([bytes as BlobPart], { type: 'image/vnd.adobe.photoshop' });
}

const ORA_BLEND: Record<string, string> = { 'source-over': 'svg:src-over', multiply: 'svg:multiply', screen: 'svg:screen', overlay: 'svg:overlay', darken: 'svg:darken', lighten: 'svg:lighten', 'color-dodge': 'svg:color-dodge', 'color-burn': 'svg:color-burn', 'hard-light': 'svg:hard-light', 'soft-light': 'svg:soft-light', difference: 'svg:difference', exclusion: 'svg:exclusion', hue: 'svg:hue', saturation: 'svg:saturation', color: 'svg:color', luminosity: 'svg:luminosity' };
const xmlSafe = (s: string): string => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** OpenRaster (.ora): a zip of each layer's PNG and a stack listing them, which Krita, GIMP and MyPaint open with layers apart. */
export async function oraBlob(p: Painting, title: string): Promise<Blob> {
  const files: { name: string; data: Uint8Array | string }[] = [{ name: 'mimetype', data: 'image/openraster' }];
  const stack: string[] = [];
  const bytes = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());
  for (let i = p.layers.length - 1; i >= 0; i--) {
    const L = p.layers[i]!;
    const name = `data/layer${i}.png`;
    files.push({ name, data: await bytes(await blobOf(L.c)) });
    stack.push(`  <layer name="${xmlSafe(L.name)}" src="${name}" opacity="${L.opacity.toFixed(3)}" visibility="${L.visible ? 'visible' : 'hidden'}" composite-op="${ORA_BLEND[L.blend] ?? 'svg:src-over'}" x="0" y="0"/>`);
  }
  if (p.paper !== 'none') {
    const paper = mk(p.w, p.h), g = paper.getContext('2d')!;
    g.fillStyle = p.paper; g.fillRect(0, 0, p.w, p.h);
    files.push({ name: 'data/paper.png', data: await bytes(await blobOf(paper)) });
    stack.push('  <layer name="Paper" src="data/paper.png" x="0" y="0"/>');
  }
  files.push({ name: 'stack.xml', data: `<?xml version="1.0" encoding="UTF-8"?>\n<image version="0.0.3" w="${p.w}" h="${p.h}">\n <stack name="${xmlSafe(title)}">\n${stack.join('\n')}\n </stack>\n</image>\n` });
  const flat = await pngOf(p);
  files.push({ name: 'mergedimage.png', data: await bytes(flat) });
  const thumb = mk(Math.min(256, p.w), Math.min(256, p.h) * (p.h / p.w > 1 ? 1 : p.h / p.w));
  thumb.getContext('2d')!.drawImage(p.composite(mk(p.w, p.h)), 0, 0, thumb.width, thumb.height);
  files.push({ name: 'Thumbnails/thumbnail.png', data: await bytes(await blobOf(thumb)) });
  return new Blob([zipStore(files) as BlobPart], { type: 'image/openraster' });
}

// ---- the time-lapse
/** Steps worth a frame: everything that changes the picture. */
const shows = (op: Op): boolean => op.k !== 'prop' || op.key === 'visible' || op.key === 'opacity' || op.key === 'blend';
export const framesIn = (log: Op[]): number => log.filter(shows).length;

/** Replay the recorded steps on a fresh painting, calling `frame` after each one that shows. */
export async function replay(log: Op[], w: number, h: number, paper: string, frame: (p: Painting, i: number, n: number) => Promise<boolean | void> | boolean | void): Promise<Painting> {
  const p = new Painting(w, h);
  p.recording = false;
  p.paper = paper;
  const n = log.length;
  for (let i = 0; i < n; i++) {
    const op = log[i]!;
    if (op.k === 'pixels') await p.placeAsync(op.L, op.png, op.x, op.y, op.w, op.h);
    else p.apply(op);
    if (shows(op) && (await frame(p, i, n)) === false) break;
  }
  return p;
}

/** The video type this phone can record: MP4 on an iPhone, WebM elsewhere; '' when it cannot record a canvas at all. */
export function videoType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return '';
  for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

/** The time-lapse drawn into `view`, about `secs` seconds long; recorded as a video when `record` is set. */
export async function playInto(view: HTMLCanvasElement, log: Op[], w: number, h: number, paper: string, o: { secs?: number; record?: boolean; stop?: () => boolean; progress?: (f: number) => void } = {}): Promise<Blob | null> {
  const g = view.getContext('2d')!;
  const total = Math.max(1, framesIn(log));
  const secs = o.secs ?? Math.max(4, Math.min(30, total / 6));
  const perFrame = Math.max(1, Math.ceil(total / (secs * 30)));
  const type = o.record ? videoType() : '';
  let rec: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  const draw = (p: Painting): void => {
    const flat = p.composite();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = paper === 'none' ? '#ffffff' : paper;
    g.fillRect(0, 0, view.width, view.height);
    const s = Math.min(view.width / w, view.height / h);
    g.drawImage(flat, (view.width - w * s) / 2, (view.height - h * s) / 2, w * s, h * s);
  };
  if (type) {
    const stream = view.captureStream(30);
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(500);
  }
  const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
  let shown = 0;
  const end = await replay(log, w, h, paper, async (p) => {
    shown++;
    if (shown % perFrame) return o.stop?.() ? false : undefined;
    draw(p);
    o.progress?.(shown / total);
    await frame();
    return o.stop?.() ? false : undefined;
  });
  draw(end);
  o.progress?.(1);
  if (!rec) return null;
  // hold the finished picture for a second, then close the video
  for (let i = 0; i < 30; i++) { draw(end); await frame(); }
  const done = new Promise<void>((r) => { rec!.onstop = () => r(); });
  rec.stop();
  await done;
  return chunks.length ? new Blob(chunks, { type: type.split(';')[0] }) : null;
}

/** The layers an OpenRaster file (.ora, from Krita, GIMP or MyPaint) holds, read from its stack.xml as text: each layer's name,
 * picture, place, opacity, visibility and blend mode, bottom layer first. */
export function oraStack(xml: string): { w: number; h: number; layers: { name: string; src: string; x: number; y: number; opacity: number; visible: boolean; blend: string }[] } {
  const attr = (tag: string, n: string): string | undefined => new RegExp(`\\b${n}="([^"]*)"`).exec(tag)?.[1];
  const un = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const img = /<image\b[^>]*>/.exec(xml)?.[0] ?? '';
  const back = Object.fromEntries(Object.entries(ORA_BLEND).map(([k, v]) => [v, k]));
  const layers = [...xml.matchAll(/<layer\b[^>]*>/g)].map((m) => {
    const t = m[0];
    return {
      name: un(attr(t, 'name') ?? 'Layer').slice(0, 40),
      src: attr(t, 'src') ?? '',
      x: Number(attr(t, 'x') ?? 0) || 0,
      y: Number(attr(t, 'y') ?? 0) || 0,
      opacity: Math.max(0, Math.min(1, Number(attr(t, 'opacity') ?? 1))),
      visible: attr(t, 'visibility') !== 'hidden',
      blend: back[attr(t, 'composite-op') ?? ''] ?? 'source-over',
    };
  }).filter((l) => l.src).reverse();
  return { w: Number(attr(img, 'w') ?? 0) || 0, h: Number(attr(img, 'h') ?? 0) || 0, layers };
}
