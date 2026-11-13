/**
 * A HEAL LAYER FROM THE ERASE MODEL (BRIEF-EDITOR-PHOTO-2): what the erase model made for a hole is kept as a small picture with its
 * own alpha (the feathered hole), named by the recipe's `patches` (a new field: an old recipe has none). The recipe only names it, so
 * UNDO and REDO and the history have the picture before and after, the original is never touched, and the photo the pipeline draws is
 * the original with the patches laid over it (applyPatches), at the original's own pixels, so an export at full size carries them.
 */
import type { Patch } from './recipe';

/** RGBA, straight alpha, as large as the patch's rectangle was filled at (at most the original's own pixels). */
export interface PatchPic {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const bank = new Map<string, PatchPic>();
let counter = 0;

export function putPatch(p: PatchPic, id = ''): string {
  const key = id || `x${Date.now().toString(36)}${(counter++).toString(36)}`;
  bank.set(key, p);
  return key;
}
export const getPatch = (id: string): PatchPic | null => bank.get(id) ?? null;
export const forgetPatches = (keep: Set<string>): void => {
  for (const k of [...bank.keys()]) if (!keep.has(k)) bank.delete(k);
};

/** A patch picture as a canvas (drawn from, not shown). */
function canvasOf(p: PatchPic): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  c.getContext('2d')!.putImageData(new ImageData(p.data as unknown as Uint8ClampedArray<ArrayBuffer>, p.w, p.h), 0, 0);
  return c;
}

/** The ids the patches name, in order (what the editor compares to know the working picture must be made again). */
export const patchKey = (patches: Patch[] | undefined): string => (patches ?? []).map((p) => p.id).join(',');

/**
 * The original with the patches laid over it. With no patch it IS the original (no copy); otherwise a new canvas of the same size
 * (the original's bytes, and its canvas, are never touched).
 */
export function applyPatches(base: HTMLCanvasElement, patches: Patch[] | undefined): HTMLCanvasElement {
  const list = (patches ?? []).filter((p) => getPatch(p.id));
  if (!list.length) return base;
  const c = document.createElement('canvas');
  c.width = base.width;
  c.height = base.height;
  const g = c.getContext('2d', { willReadFrequently: false })!;
  g.drawImage(base, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  for (const p of list) g.drawImage(canvasOf(getPatch(p.id)!), p.x * base.width, p.y * base.height, p.w * base.width, p.h * base.height);
  return c;
}
