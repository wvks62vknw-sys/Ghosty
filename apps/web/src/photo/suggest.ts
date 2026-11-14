/**
 * GHOSTY'S PHOTO CHANGES, ONE BY ONE (NEXT ROUND, editors.u7): an ask in plain words ("make this photo warmer and crop it to 4:5", "a bit
 * brighter with more contrast", "fix it") becomes a short list of marked changes, each named the way the sliders name it ("warmer +600 K",
 * "+0.3 exposure", "crop to 4:5"), that he accepts or rejects one at a time inside the Photo editor. Each change is applied on its own to
 * whatever the recipe is when he accepts it, so the order he accepts them in never matters. Pure: no DOM, no storage, no model; the brain
 * test (apps/edge/test/photoedit.test.mjs) proves it on numbers.
 */
import { cloneRecipe, fitCrop, frameSize, NEUTRAL_K, sameRecipe, type Recipe } from './recipe';

export interface Change {
  /** What part of the recipe it changes (two changes to one part: the last one asked wins). */
  id: string;
  /** In the sliders' own words: "+0.3 exposure", "warmer +600 K", "crop to 4:5". */
  label: string;
  /** This change alone, onto a recipe (a copy: the recipe given is never changed). */
  apply(r: Recipe, w: number, h: number): Recipe;
}

/** The picture's own numbers that FIX IT reads: its mean light 0..1, its 2nd and 98th percentiles, and red minus blue (a warm cast > 0). */
export interface PhotoStats {
  mean: number;
  lo: number;
  hi: number;
  cast: number;
}

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const round = (x: number, k = 1): number => Math.round((Math.round(x / k + Math.sign(x) * 1e-9) * k) * 1e6) / 1e6;
const signedNum = (v: number, dp = 0): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}`;
const thou = (n: number): string => Math.round(n).toLocaleString('en-GB');

const edit = (fn: (r: Recipe) => void) => (r: Recipe): Recipe => {
  const out = cloneRecipe(r);
  fn(out);
  return out;
};

/** One exposure step (stops, ±2 at most). */
export const exposure = (d: number): Change => ({ id: 'exposure', label: `${signedNum(d, 1)} exposure`, apply: edit((r) => (r.light.exposure = round(clamp(r.light.exposure + d, -2, 2), 0.05))) });
/** One temperature step, in kelvin (2,500..10,000). */
export const warmth = (dK: number): Change => ({ id: 'temp', label: `${dK > 0 ? 'warmer' : 'cooler'} ${signedNum(dK)} K`, apply: edit((r) => (r.wb.temp = round(clamp(r.wb.temp + dK, 2500, 10000), 50))) });
const light = (key: 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks', d: number): Change => ({ id: key, label: `${signedNum(d)} ${key}`, apply: edit((r) => (r.light[key] = round(clamp(r.light[key] + d, -100, 100)))) });
const colour = (key: 'vibrance' | 'saturation', d: number): Change => ({ id: key, label: `${signedNum(d)} ${key}`, apply: edit((r) => (r.color[key] = round(clamp(r.color[key] + d, -100, 100)))) });
const mono: Change = { id: 'saturation', label: 'black and white', apply: edit((r) => (r.color.saturation = -100)) };
const sharpen = (d: number): Change => ({ id: 'sharpen', label: `${signedNum(d)} sharpening`, apply: edit((r) => (r.detail.amount = round(clamp(r.detail.amount + d, 0, 150)))) });
const vignette = (d: number): Change => ({ id: 'vignette', label: `${signedNum(d * 100)} vignette`, apply: edit((r) => (r.effects.vignette = round(clamp(r.effects.vignette + d, -1, 1), 0.01))) });
const grain = (d: number): Change => ({ id: 'grain', label: `${signedNum(d * 100)} grain`, apply: edit((r) => (r.effects.grain = round(clamp(r.effects.grain + d, 0, 1), 0.01))) });

/** A crop to a ratio, as large as fits, kept on the middle of what is there now. */
export const cropTo = (ratio: string, wr: number, hr: number): Change => ({
  id: 'crop',
  label: ratio === '1:1' ? 'crop to square' : `crop to ${ratio}`,
  apply: (r, w, h) => {
    const out = cloneRecipe(r);
    const f = frameSize(w, h, r.crop.quarter);
    const at = { x: r.crop.x + r.crop.w / 2, y: r.crop.y + r.crop.h / 2 };
    const c = fitCrop(f.w, f.h, r.crop.angle, wr / hr, at);
    out.crop = { ...out.crop, ...c, ratio };
    return out;
  },
});

const RATIOS: [RegExp, string, number, number][] = [
  [/\b(?:square|1\s*[:x×]\s*1)\b/, '1:1', 1, 1],
  [/\b4\s*[:x×]\s*5\b|\bportrait post\b/, '4:5', 4, 5],
  [/\b5\s*[:x×]\s*4\b/, '5:4', 5, 4],
  [/\b3\s*[:x×]\s*2\b/, '3:2', 3, 2],
  [/\b2\s*[:x×]\s*3\b/, '2:3', 2, 3],
  [/\b4\s*[:x×]\s*3\b/, '4:3', 4, 3],
  [/\b3\s*[:x×]\s*4\b/, '3:4', 3, 4],
  [/\b16\s*[:x×]\s*9\b|\bwidescreen\b/, '16:9', 16, 9],
  [/\b9\s*[:x×]\s*16\b|\b(?:a )?story\b/, '9:16', 9, 16],
];

/** "a bit", "slightly" halve a step; "much", "a lot", "really", "very" double it. */
const strength = (t: string): number => (/\b(?:a (?:little|touch|tad)|slightly|a bit|bit)\b/.test(t) ? 0.5 : /\b(?:much|a lot|lots|really|very|way|loads)\b/.test(t) ? 2 : 1);

/**
 * The changes an ask names, in the order they are said; the same part named twice keeps the last. `stats` lets FIX IT read the
 * picture; without it, FIX IT is a gentle lift. Nothing understood: an empty list.
 */
export function changesFor(text: string, stats: PhotoStats | null = null, r: Recipe | null = null): Change[] {
  const t = ` ${text.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ')} `;
  const k = strength(t);
  const found: { at: number; c: Change }[] = [];
  const add = (re: RegExp, c: Change | (() => Change)) => {
    const m = re.exec(t);
    if (m) found.push({ at: m.index, c: typeof c === 'function' ? c() : c });
  };
  add(/\b(?:warm(?:er)?|golden|cosier|cozier)\b/, () => warmth(round(600 * k, 50)));
  add(/\b(?:cool(?:er)?|cold(?:er)?|blu(?:e|er)|icier)\b/, () => warmth(-round(600 * k, 50)));
  add(/\b(?:bright(?:er|en)?|light(?:er|en)(?! the shadows))\b/, () => exposure(round(0.3 * k, 0.1)));
  add(/\b(?:dark(?:er|en)?|dim(?:mer)?|moodier|moody)\b/, () => exposure(-round(0.3 * k, 0.1)));
  add(/\b(?:more contrast|punch(?:y|ier)?|pop|higher contrast|contrastier)\b/, () => light('contrast', round(15 * k)));
  add(/\b(?:less contrast|flat(?:ter)?|softer|lower contrast)\b/, () => light('contrast', -round(15 * k)));
  add(/\b(?:lift(?: the)? shadows|brighter shadows|open(?: up)?(?: the)? shadows|lighten the shadows)\b/, () => light('shadows', round(25 * k)));
  add(/\b(?:highlights?|blown|the sky|bring back the sky|recover)\b/, () => light('highlights', -round(25 * k)));
  add(/\b(?:vivid|vibrant|colou?rful|more colou?r|saturat(?:e|ed)|richer)\b/, () => colour('vibrance', round(20 * k)));
  add(/\b(?:mut(?:e|ed)|less colou?r|desaturat\w*|washed)\b/, () => colour('saturation', -round(20 * k)));
  add(/\b(?:black and white|b ?& ?w|mono(?:chrome)?|greyscale|grayscale)\b/, mono);
  add(/\b(?:crisp(?:er)?|sharpen|sharper)\b/, () => sharpen(round(30 * k)));
  add(/\bvignette\b/, () => vignette(round(0.25 * k, 0.05)));
  add(/\b(?:grain(?:y)?|film(?:ic)?)\b/, () => grain(round(0.25 * k, 0.05)));
  if (/\b(?:crop|square|ratio)\b/.test(t)) for (const [re, ratio, a, b] of RATIOS) {
    const m = re.exec(t);
    if (m) {
      found.push({ at: m.index, c: cropTo(ratio, a, b) });
      break;
    }
  }
  if (/\b(?:fix (?:it|this|the photo|the picture)|enhance|auto(?:matic)?|improve|look better|nicer|make it good)\b/.test(t)) for (const c of autoChanges(stats, r)) found.push({ at: 1e6, c });
  found.sort((a, b) => a.at - b.at);
  const byId = new Map<string, Change>();
  for (const f of found) {
    byId.delete(f.c.id);
    byId.set(f.c.id, f.c);
  }
  return [...byId.values()];
}

/** FIX IT: from the picture's own numbers, an exposure toward a middle grey, contrast where the tones are bunched, and the colour cast evened. */
export function autoChanges(s: PhotoStats | null, r: Recipe | null = null): Change[] {
  if (!s) return [exposure(0.2), light('contrast', 10), colour('vibrance', 12)];
  const out: Change[] = [];
  const target = 0.46;
  if (Math.abs(s.mean - target) > 0.05) out.push(exposure(round(clamp(Math.log2(target / Math.max(0.02, s.mean)) * 0.8, -1, 1), 0.1)));
  const range = s.hi - s.lo;
  if (range < 0.8) out.push(light('contrast', round(clamp((0.8 - range) * 60, 5, 30))));
  if (s.hi > 0.97) out.push(light('highlights', -20));
  if (s.lo < 0.03) out.push(light('shadows', 20));
  if (Math.abs(s.cast) > 0.04) out.push(warmth(-round(clamp(s.cast * 6000, -1200, 1200), 50)));
  out.push(colour('vibrance', 12));
  // already where FIX IT would put it: say so by giving nothing
  return out.filter((c) => !r || !sameRecipe(c.apply(r, 1, 1), r));
}

/** The picture's own numbers from its pixels (RGBA, any small size). */
export function statsOf(px: Uint8ClampedArray | Uint8Array): PhotoStats {
  const hist = new Uint32Array(256);
  let sum = 0;
  let rb = 0;
  let n = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    const y = Math.round(0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!);
    hist[y]!++;
    sum += y;
    rb += px[i]! - px[i + 2]!;
    n++;
  }
  if (!n) return { mean: 0.5, lo: 0, hi: 1, cast: 0 };
  const at = (q: number) => {
    let c = 0;
    for (let v = 0; v < 256; v++) if ((c += hist[v]!) >= q * n) return v / 255;
    return 1;
  };
  return { mean: sum / n / 255, lo: at(0.02), hi: at(0.98), cast: rb / n / 255 };
}

/** The line that heads the list: how many, and what to do, in his words. */
export function changesLine(n: number): string {
  if (!n) return 'I could not turn that into a change here. Try “warmer”, “brighter”, “more contrast”, “black and white” or “crop to 4:5”.';
  return `I suggest ${n === 1 ? 'one change' : `${n} changes`}. Accept or reject each; nothing changes the photo until you accept it.`;
}

/** The temperature said back the way the slider says it ("6,500 K → 7,100 K"), for the change's longer name. */
export const tempWords = (from: number, to: number): string => `${thou(from)} K → ${thou(to)} K`;
export { NEUTRAL_K };
