/**
 * THE RECIPE (BRIEF-EDITOR-PHOTO): an edit is a recipe over an untouched original. Pure data and pure functions: no DOM, no storage, so the
 * brain test (apps/edge/test/photoedit.test.mjs) proves it on numbers. Everything is stored as plain JSON; a brush's alpha picture is
 * kept beside it under an id (photo/alpha.ts) and the recipe only names it.
 *
 * Coordinates: a mask, a heal and the layer are anchored in the ORIGINAL's own frame, 0..1 across and down, so they stay on the sky or the
 * blemish when the crop, the angle or the perspective changes afterwards. The crop is in the quarter-turned frame (a quarter turn swaps
 * its width and height), 0..1 as well.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A tone curve: points from (0, y) to (1, y), at most six, x strictly rising. */
export type CurvePts = [number, number][];
export interface Curves {
  l: CurvePts;
  r: CurvePts;
  g: CurvePts;
  b: CurvePts;
}

/** One of the eight colour bands: how far its hue is turned, how much colour it has and how light it is, each -100..100. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** What a mask changes where it holds, each -100..100 (exposure ±100 is ±2 stops, temperature ±100 is about ±3,000 K). */
export interface MaskGrade {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temp: number;
  tint: number;
  saturation: number;
  vibrance: number;
}

export type MaskKind = 'linear' | 'radial' | 'brush' | 'subject';
export interface Mask {
  id: string;
  kind: MaskKind;
  /** The name in his list: "Sky", "Mask 2". */
  name: string;
  invert: boolean;
  /** Linear: from where it holds to where it is gone. */
  a: Pt;
  b: Pt;
  /** Radial: the centre, the two radii (a fraction of the long side) and the turn in degrees; feather 0..1 is how much of the edge is soft. */
  c: Pt;
  rx: number;
  ry: number;
  angle: number;
  feather: number;
  /** A brush's or the subject's alpha picture (photo/alpha.ts), or '' when nothing is painted yet. */
  alpha: string;
  adj: MaskGrade;
  /** SUBJECT only: which cut this is, "model" (the cut-out model) or "depth" (the first cut from depth and the finder). An old mask has none. */
  cut?: 'model' | 'depth';
}

export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight';
export const BLENDS: Blend[] = ['normal', 'multiply', 'screen', 'overlay', 'softlight'];
export interface Layer {
  /** The second photo, kept in the store under this id. */
  photo: string;
  name: string;
  blend: Blend;
  /** 0..100. */
  opacity: number;
  /** An optional mask over the layer, the same shapes a mask has (no grade of its own). */
  mask: Mask | null;
}

export interface Heal {
  /** The blemish, in the original's frame. */
  x: number;
  y: number;
  /** Its radius as a fraction of the long side. */
  r: number;
  /** Where the clean skin or sky is taken from, as an offset in the same frame. */
  dx: number;
  dy: number;
  /** 0..1: how much of the edge is feathered. */
  feather: number;
}

/**
 * A part of the photo filled by the erase model (BRIEF-EDITOR-PHOTO-2): a rectangle of the original's frame (0..1) and the picture that
 * lies in it, kept under an id (photo/patch.ts). An old recipe has none.
 */
export interface Patch {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Crop {
  /** The rectangle, in the quarter-turned frame, 0..1. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, -45..45: the straighten dial. */
  angle: number;
  /** Quarter turns clockwise, 0..3. */
  quarter: number;
  flip: boolean;
  /** The ratio held while dragging: 'free' or 'w:h' ("1:1", "4:5"). */
  ratio: string;
}

export interface Recipe {
  v: 1;
  crop: Crop;
  /** Perspective: how far each corner (top left, top right, bottom right, bottom left) is pulled, in the frame's fraction. */
  persp: [number, number][];
  /** Barrel (+) or pincushion (-), -100..100. */
  lens: number;
  light: { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number };
  /** Kelvin (2,500..10,000) and tint (-100..100). */
  wb: { temp: number; tint: number };
  curves: Curves;
  color: { vibrance: number; saturation: number; hsl: Hsl[] };
  detail: { amount: number; radius: number; threshold: number; noise: number };
  effects: { vignette: number; grain: number; grainSize: number; seed: number; fade: number };
  masks: Mask[];
  layer: Layer | null;
  heals: Heal[];
  /** The erase model's fills (BRIEF-EDITOR-PHOTO-2), laid over the original before anything else. Absent in a recipe from before. */
  patches?: Patch[];
}

export const NEUTRAL_K = 6500;
export const HSL_NAMES = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'AQUA', 'BLUE', 'PURPLE', 'MAGENTA'];
export const MAX_MASKS = 4;
export const MAX_HEALS = 16;
export const MAX_CURVE_POINTS = 6;
export const HISTORY_DEPTH = 60;

export const identityCurve = (): CurvePts => [[0, 0], [1, 1]];
export const zeroGrade = (): MaskGrade => ({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, temp: 0, tint: 0, saturation: 0, vibrance: 0 });

export function newRecipe(): Recipe {
  return {
    v: 1,
    crop: { x: 0, y: 0, w: 1, h: 1, angle: 0, quarter: 0, flip: false, ratio: 'free' },
    persp: [[0, 0], [0, 0], [0, 0], [0, 0]],
    lens: 0,
    light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
    wb: { temp: NEUTRAL_K, tint: 0 },
    curves: { l: identityCurve(), r: identityCurve(), g: identityCurve(), b: identityCurve() },
    color: { vibrance: 0, saturation: 0, hsl: HSL_NAMES.map(() => ({ h: 0, s: 0, l: 0 })) },
    detail: { amount: 0, radius: 1, threshold: 0, noise: 0 },
    effects: { vignette: 0, grain: 0, grainSize: 30, seed: 1, fade: 0 },
    masks: [],
    layer: null,
    heals: [],
  };
}

export const cloneRecipe = (r: Recipe): Recipe => JSON.parse(JSON.stringify(r)) as Recipe;
export const sameRecipe = (a: Recipe, b: Recipe): boolean => JSON.stringify(a) === JSON.stringify(b);

export function newMask(kind: MaskKind, n: number): Mask {
  const names: Record<MaskKind, string> = { linear: 'Gradient', radial: 'Circle', brush: 'Brush', subject: 'Subject' };
  return {
    id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind,
    name: `${names[kind]} ${n}`,
    invert: false,
    a: { x: 0.5, y: 0.05 },
    b: { x: 0.5, y: 0.5 },
    c: { x: 0.5, y: 0.5 },
    rx: 0.3,
    ry: 0.22,
    angle: 0,
    feather: 0.6,
    alpha: '',
    adj: zeroGrade(),
  };
}

/** True when the curve is the straight line (nothing to apply). */
export const curveIsIdentity = (c: CurvePts): boolean => c.length === 2 && c[0]![0] === 0 && c[0]![1] === 0 && c[1]![0] === 1 && c[1]![1] === 1;

/** Does the recipe change the photo at all? (EXPORT of an untouched photo says so.) */
export function isUntouched(r: Recipe): boolean {
  const n = newRecipe();
  // a recipe with an empty list of erase fills is as untouched as one from before there were any
  return sameRecipe({ ...r, patches: r.patches?.length ? r.patches : undefined, effects: { ...r.effects, seed: 1 } }, { ...n, effects: { ...n.effects, seed: 1 } });
}

// ----------------------------------------------------------------- the history

export interface Step {
  label: string;
  at: number;
  recipe: Recipe;
}

/** Sixty steps deep: UNDO, REDO, and a jump to any step (HISTORY). The first step is the photo as it was opened. */
export class RecipeHistory {
  steps: Step[];
  at = 0;
  constructor(start: Recipe, readonly depth = HISTORY_DEPTH) {
    this.steps = [{ label: 'Opened', at: Date.now(), recipe: cloneRecipe(start) }];
  }
  get recipe(): Recipe {
    return cloneRecipe(this.steps[this.at]!.recipe);
  }
  get canUndo(): boolean {
    return this.at > 0;
  }
  get canRedo(): boolean {
    return this.at < this.steps.length - 1;
  }
  /** A change made: kept as a step (the redo steps beyond it go); nothing is kept when it changed nothing. */
  push(label: string, r: Recipe): boolean {
    if (sameRecipe(this.steps[this.at]!.recipe, r)) return false;
    this.steps = this.steps.slice(0, this.at + 1);
    this.steps.push({ label, at: Date.now(), recipe: cloneRecipe(r) });
    // the oldest step goes first, but the first is always the photo as opened
    while (this.steps.length > this.depth + 1) this.steps.splice(1, 1);
    this.at = this.steps.length - 1;
    return true;
  }
  undo(): Recipe | null {
    if (!this.canUndo) return null;
    this.at--;
    return this.recipe;
  }
  redo(): Recipe | null {
    if (!this.canRedo) return null;
    this.at++;
    return this.recipe;
  }
  jump(i: number): Recipe | null {
    if (i < 0 || i >= this.steps.length) return null;
    this.at = i;
    return this.recipe;
  }
}

// ----------------------------------------------------------------- presets

/** A look: the parts of a recipe that are about how a photo FEELS, never where its edges are or what is painted on it. */
export interface Preset {
  name: string;
  /** One line in his words. */
  line: string;
  /** A look of his own, saved with a name (false: one of the eight). */
  mine?: boolean;
  look: Pick<Recipe, 'light' | 'wb' | 'curves' | 'color' | 'detail' | 'effects'>;
}

export function presetOf(r: Recipe, name: string, line = ''): Preset {
  const c = cloneRecipe(r);
  return { name, line, mine: true, look: { light: c.light, wb: c.wb, curves: c.curves, color: c.color, detail: c.detail, effects: c.effects } };
}

/** A preset onto a recipe: the look replaces the look, and the crop, the angle, the perspective, the masks, the heals and the layer stay as they were. */
export function applyPreset(r: Recipe, p: Preset): Recipe {
  const out = cloneRecipe(r);
  const l = JSON.parse(JSON.stringify(p.look)) as Preset['look'];
  out.light = l.light;
  out.wb = l.wb;
  out.curves = l.curves;
  out.color = l.color;
  out.detail = l.detail;
  // the grain's seed stays this photo's own
  out.effects = { ...l.effects, seed: r.effects.seed };
  return out;
}

/** The eight looks, in his words, never a brand's name. Each is a recipe's worth of numbers. */
export const LOOKS: Preset[] = (() => {
  const mk = (name: string, line: string, f: (r: Recipe) => void): Preset => {
    const r = newRecipe();
    f(r);
    const p = presetOf(r, name, line);
    delete p.mine;
    return p;
  };
  const curve = (...pts: [number, number][]): CurvePts => pts;
  return [
    mk('GOLDEN HOUR', 'Warm, soft light, the shadows a little lifted.', (r) => {
      r.wb = { temp: 7600, tint: 6 };
      r.light = { exposure: 0.15, contrast: 8, highlights: -18, shadows: 22, whites: 0, blacks: 0 };
      r.color.vibrance = 22;
      r.color.hsl[1] = { h: 0, s: 18, l: 6 };
      r.effects.vignette = 0.18;
    }),
    mk('COOL MORNING', 'Clean and a little blue, like early light.', (r) => {
      r.wb = { temp: 5200, tint: -4 };
      r.light = { exposure: 0.1, contrast: 6, highlights: -12, shadows: 10, whites: 6, blacks: 0 };
      r.color.vibrance = 10;
      r.color.hsl[5] = { h: 0, s: 14, l: -6 };
    }),
    mk('FADED FILM', 'Lifted blacks, softer colour, a little grain.', (r) => {
      r.light = { exposure: 0.05, contrast: -8, highlights: -10, shadows: 10, whites: -6, blacks: 18 };
      r.color.saturation = -14;
      r.curves.l = curve([0, 0.06], [0.5, 0.52], [1, 0.94]);
      r.effects.fade = 0.18;
      r.effects.grain = 0.3;
      r.effects.grainSize = 40;
    }),
    mk('BLACK AND WHITE', 'No colour, strong middle tones.', (r) => {
      r.color.saturation = -100;
      r.light = { exposure: 0, contrast: 22, highlights: -10, shadows: 8, whites: 8, blacks: -8 };
      r.curves.l = curve([0, 0], [0.28, 0.22], [0.72, 0.8], [1, 1]);
      r.effects.grain = 0.18;
    }),
    mk('BRIGHT AND AIRY', 'Light, open and gentle.', (r) => {
      r.light = { exposure: 0.45, contrast: -10, highlights: -22, shadows: 30, whites: 12, blacks: 10 };
      r.wb = { temp: 6800, tint: 0 };
      r.color.vibrance = 8;
      r.color.saturation = -6;
    }),
    mk('MOODY', 'Dark and rich, the light kept in the middle.', (r) => {
      r.light = { exposure: -0.35, contrast: 24, highlights: -26, shadows: -8, whites: 0, blacks: -14 };
      r.color.saturation = -8;
      r.color.hsl[3] = { h: 0, s: -22, l: -10 };
      r.effects.vignette = 0.42;
    }),
    mk('VIVID', 'Strong, clean colour.', (r) => {
      r.light = { exposure: 0.05, contrast: 14, highlights: -8, shadows: 8, whites: 4, blacks: -4 };
      r.color.vibrance = 38;
      r.color.saturation = 14;
      r.detail = { amount: 30, radius: 1, threshold: 0, noise: 0 };
    }),
    mk('GRAIN AND SHADOW', 'Hard shadows, coarse grain, old and honest.', (r) => {
      r.light = { exposure: -0.1, contrast: 30, highlights: -14, shadows: -12, whites: 6, blacks: -20 };
      r.color.saturation = -30;
      r.effects.grain = 0.6;
      r.effects.grainSize = 55;
      r.effects.vignette = 0.3;
    }),
  ];
})();

// ----------------------------------------------------------------- the geometry's own questions

/** The size of the quarter-turned frame, in the original's pixels. */
export const frameSize = (w: number, h: number, quarter: number): { w: number; h: number } => (quarter % 2 ? { w: h, h: w } : { w, h });

/** The output picture's size in pixels for a recipe over a w × h original: the crop, at the original's own pixels. */
export function outputSize(r: Recipe, w: number, h: number): { w: number; h: number } {
  const f = frameSize(w, h, r.crop.quarter);
  return { w: Math.max(1, Math.round(r.crop.w * f.w)), h: Math.max(1, Math.round(r.crop.h * f.h)) };
}

/** A ratio "w:h" as a number (width over height), or 0 for free. */
export function ratioOf(s: string): number {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(s);
  return m ? Number(m[1]) / Number(m[2]) : 0;
}

/**
 * The largest crop of a frame, at this angle and this ratio, that still sits wholly inside the turned picture (no empty corners), centred
 * where `at` is (the middle by default). `ratio` is the crop's width over its height in pixels (0: the picture's own).
 */
export function fitCrop(fw: number, fh: number, angleDeg: number, ratio = 0, at: { x: number; y: number } = { x: 0.5, y: 0.5 }): { x: number; y: number; w: number; h: number } {
  const a = (Math.abs(angleDeg) * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const R = ratio > 0 ? ratio : fw / fh;
  // the biggest w × (w / R) rectangle inside a rotated fw × fh one: each corner of the crop (±w/2, ±h/2) turned back must sit within (±fw/2, ±fh/2)
  const wMax = Math.min(fw / (c + s / R), fh / (s + c / R));
  let w = ratio > 0 ? wMax : Math.min(fw, fh * R, wMax);
  w = Math.min(w, fw, fh * R);
  const h = w / R;
  const x = Math.min(1 - w / fw, Math.max(0, at.x - w / fw / 2));
  const y = Math.min(1 - h / fh, Math.max(0, at.y - h / fh / 2));
  return { x, y, w: w / fw, h: h / fh };
}
