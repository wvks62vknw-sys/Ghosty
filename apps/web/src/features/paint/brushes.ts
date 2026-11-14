/**
 * PAINT's brushes (APPS ROUND, lane COMIC). Each is a dab-stamping brush: a tip picture is stamped along the stroke every
 * `spacing` of its size, its size and opacity following the pencil's pressure (or the finger's speed), its angle the pencil's
 * tilt. Pure data, so the brain's test reads it and the time-lapse replays every stroke the same way.
 */
export type TipKind = 'round' | 'grain' | 'soft' | 'flat' | 'bristle' | 'spray';

export interface Brush {
  id: string;
  name: string;
  /** what it is for, in his words */
  says: string;
  tip: TipKind;
  /** 0..1: how hard the tip's edge is */
  hardness: number;
  /** a dab every spacing × size */
  spacing: number;
  /** size in canvas pixels at full pressure */
  size: number;
  /** stroke opacity (the most a stroke reaches) */
  opacity: number;
  /** each dab's own opacity: low flow builds up softly */
  flow: number;
  /** 0..1: how much pressure shrinks the size */
  pSize: number;
  /** 0..1: how much pressure lightens the opacity */
  pAlpha: number;
  /** tilt widens and lightens the tip (a pencil laid on its side) */
  tilt: number;
  /** 0..1: the stroke is smoothed this much by default */
  smooth: number;
  /** dabs build up within one stroke (airbrush) rather than stopping at the stroke's opacity */
  buildUp: boolean;
  /** how the stroke lands on the layer */
  mode: 'normal' | 'multiply';
  /** picks up the colour already on the layer (oils) */
  mix: number;
  /** a darker rim where the stroke dries (watercolour) */
  wetEdge: number;
  /** thin start and end, in canvas pixels */
  taper: number;
  /** random spread of each dab, as a share of its size */
  scatter: number;
  /** the nib's own squash (1 is round) */
  roundness: number;
  /** liquify only: push the picture along, twirl it round, pinch it in or swell it out */
  lq?: Liquify;
}
export type Liquify = 'push' | 'twirl' | 'pinch' | 'expand';
export const LIQUIFY_NAMES: Record<Liquify, string> = { push: 'Push', twirl: 'Twirl', pinch: 'Pinch', expand: 'Expand' };

/** His own tweaks of a brush (streamline, how much pressure changes size and opacity, the taper), kept on this phone. */
export type Tweak = Partial<Pick<Brush, 'smooth' | 'pSize' | 'pAlpha' | 'taper' | 'spacing'>>;
export const tweaks = (): Record<string, Tweak> => {
  try { const t = JSON.parse(localStorage.getItem('ghosty.paint.tweaks') ?? '{}') as Record<string, Tweak>; return t && typeof t === 'object' ? t : {}; } catch { return {}; }
};
export const keepTweak = (id: string, t: Tweak): void => { try { localStorage.setItem('ghosty.paint.tweaks', JSON.stringify({ ...tweaks(), [id]: { ...(tweaks()[id] ?? {}), ...t } })); } catch { /* kept for this visit only */ } };
export const forgetTweak = (id: string): void => { try { const all = tweaks(); delete all[id]; localStorage.setItem('ghosty.paint.tweaks', JSON.stringify(all)); } catch { /* nothing kept */ } };

const B = (b: Partial<Brush> & Pick<Brush, 'id' | 'name' | 'says' | 'tip'>): Brush => ({
  hardness: 0.9, spacing: 0.12, size: 12, opacity: 1, flow: 1, pSize: 0.6, pAlpha: 0.2, tilt: 0, smooth: 0.35,
  buildUp: false, mode: 'normal', mix: 0, wetEdge: 0, taper: 0, scatter: 0, roundness: 1, ...b,
});

export const BRUSHES: Brush[] = [
  B({ id: 'pencil', name: 'Pencil', says: 'Grainy graphite for sketching. Tilt the Apple Pencil to shade.', tip: 'grain', size: 6, hardness: 0.7, spacing: 0.08, opacity: 0.9, flow: 0.55, pSize: 0.35, pAlpha: 0.8, tilt: 1, smooth: 0.15 }),
  B({ id: 'ink', name: 'Ink', says: 'A clean inking pen that swells with pressure and tapers at both ends.', tip: 'round', size: 9, hardness: 1, spacing: 0.06, pSize: 0.9, pAlpha: 0, smooth: 0.55, taper: 18, roundness: 0.85 }),
  B({ id: 'marker', name: 'Marker', says: 'A flat felt marker: even colour, and darker where strokes cross.', tip: 'flat', size: 22, hardness: 0.85, spacing: 0.08, opacity: 0.55, pSize: 0.15, pAlpha: 0, mode: 'multiply', smooth: 0.3, roundness: 0.45 }),
  B({ id: 'watercolour', name: 'Watercolour', says: 'Soft washes that pool darker at their edges as they dry.', tip: 'soft', size: 48, hardness: 0.55, spacing: 0.1, opacity: 0.32, flow: 0.35, pSize: 0.5, pAlpha: 0.4, mode: 'multiply', wetEdge: 1, smooth: 0.4 }),
  B({ id: 'oils', name: 'Oils', says: 'Thick bristle paint that pulls the colour under it along.', tip: 'bristle', size: 30, hardness: 0.8, spacing: 0.07, flow: 0.8, pSize: 0.4, pAlpha: 0.2, mix: 0.55, smooth: 0.3, roundness: 0.7 }),
  B({ id: 'airbrush', name: 'Airbrush', says: 'A soft spray that builds up the longer you go over it.', tip: 'soft', size: 70, hardness: 0, spacing: 0.06, flow: 0.06, pSize: 0.2, pAlpha: 0.7, buildUp: true, smooth: 0.2 }),
];

export const ERASER: Brush = B({ id: 'eraser', name: 'Eraser', says: 'Rubs out on this layer.', tip: 'soft', size: 30, hardness: 0.7, spacing: 0.08, pSize: 0.4, pAlpha: 0.3, smooth: 0.2 });
export const SMUDGE: Brush = B({ id: 'liquify', name: 'Liquify', says: 'Push the picture like wet paint.', tip: 'soft', size: 60, hardness: 0.3, spacing: 0.15, flow: 0.7, pSize: 0.2, pAlpha: 0.3, smooth: 0.3 });

export const brushOf = (id: string): Brush => [...BRUSHES, ERASER, SMUDGE].find((b) => b.id === id) ?? BRUSHES[1]!;

/** His pressure curve: soft reaches full ink with a light touch, firm needs a firmer press. */
export type Curve = 'soft' | 'even' | 'firm';
export const curveOf = (p: number, c: Curve): number => {
  const v = Math.max(0, Math.min(1, p));
  return c === 'soft' ? Math.pow(v, 0.55) : c === 'firm' ? Math.pow(v, 1.8) : v;
};

/** A dab's size and opacity for this pressure and tilt (altitude 0 is flat on the glass, π/2 upright). */
export function dabOf(b: Brush, size: number, opacity: number, p: number, altitude = Math.PI / 2): { r: number; a: number; stretch: number } {
  const lay = b.tilt ? Math.max(0, 1 - altitude / (Math.PI / 2)) * b.tilt : 0;
  const r = Math.max(0.5, (size / 2) * (1 - b.pSize + b.pSize * p) * (1 + lay * 2.2));
  const a = Math.max(0, Math.min(1, opacity * (1 - b.pAlpha + b.pAlpha * p) * (1 - lay * 0.6)));
  return { r, a, stretch: 1 + lay * 1.6 };
}

/** A small seeded random, so a stroke's scatter and grain replay the same in the time-lapse. */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Professional palettes to start from (named plainly). */
export const PALETTES: { name: string; colours: string[] }[] = [
  { name: 'Ink and paper', colours: ['#111111', '#3a3a3a', '#7a7a7a', '#bdbdbd', '#f4f1ea', '#ffffff'] },
  { name: 'Comic', colours: ['#111111', '#e63946', '#1d6fd8', '#f1c40f', '#2a9d8f', '#f4a261', '#ffffff', '#f6d3b3'] },
  { name: 'Sunset', colours: ['#2b1d3a', '#5b2a5e', '#a63a50', '#e86a4a', '#f6a95b', '#fbe3a1'] },
  { name: 'Forest', colours: ['#1b2a1e', '#2f4b2a', '#4f7a3a', '#8fb35a', '#d8d48a', '#6b4a2b'] },
  { name: 'Sea', colours: ['#0b1d33', '#12406b', '#1d6fa0', '#4fa3c7', '#a7dbe8', '#f2efe6'] },
  { name: 'Skin tones', colours: ['#f6d3b3', '#f1c6a0', '#e8b48f', '#c98e62', '#9a6440', '#6e4428'] },
];
