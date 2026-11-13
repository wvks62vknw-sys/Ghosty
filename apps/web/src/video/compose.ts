/**
 * COMPOSING A FRAME (BRIEF-EDITOR-VIDEO): what the picture is at timeline time t — which clips show, at which time of their
 * source, with what transform and transition, which overlays, which title and subtitle — worked out once for the screen's player
 * and the export. `planFrame` is pure (the brain test and the spec read it); `buildSpec` turns it into the layers the GPU draws.
 */
import { activeMain, clipLen, fadeFactor, place, shape, sourceTime, type Clip, type Cue, type Overlay, type Project } from './model';
import { clamp, cornerPos, transformAt, transitionProgress } from './math';
import type { FrameSpec, Layer } from './gpu';
import { cueAt } from './subs';

export interface LayerPlan {
  role: 'main' | 'mainB' | 'overlay';
  clip: Clip;
  /** Milliseconds of the source to show, and of the clip's own time. */
  srcMs: number;
  tIn: number;
  ov?: Overlay;
}
export interface FramePlan {
  t: number;
  layers: LayerPlan[];
  tr: { kind: 'crossfade' | 'dip' | 'wipe' | 'slide'; p: number } | null;
}

const srcAt = (c: Clip, tIn: number) => clamp(Math.round(sourceTime(c, tIn)), c.in, Math.max(c.in, c.out - 1));

export function planFrame(p: Project, t: number): FramePlan {
  const layers: LayerPlan[] = [];
  const act = activeMain(p, t);
  let tr: FramePlan['tr'] = null;
  if (act.length === 2 && act[1]!.tin && act[1]!.tin.kind !== 'cut') {
    tr = { kind: act[1]!.tin.kind as 'crossfade', p: transitionProgress(t, act[1]!.start, act[1]!.tin.len) };
    layers.push({ role: 'main', clip: act[0]!.clip, srcMs: srcAt(act[0]!.clip, t - act[0]!.start), tIn: t - act[0]!.start });
    layers.push({ role: 'mainB', clip: act[1]!.clip, srcMs: srcAt(act[1]!.clip, t - act[1]!.start), tIn: t - act[1]!.start });
  } else if (act.length) {
    const x = act[act.length - 1]!;
    layers.push({ role: 'main', clip: x.clip, srcMs: srcAt(x.clip, t - x.start), tIn: t - x.start });
  }
  for (const o of p.overlays) {
    if (!o.clip || t < o.start || t >= o.start + o.len) continue;
    layers.push({ role: 'overlay', clip: o.clip, srcMs: srcAt(o.clip, t - o.start), tIn: t - o.start, ov: o });
  }
  return { t, layers, tr };
}

/** Where each overlay track's items sit: the first track under the second. */
export const overlaysInOrder = (p: Project): Overlay[] => [...p.overlays].sort((a, b) => a.track - b.track);

export type Provider = (src: string, clipId: string) => { el: CanvasImageSource; w: number; h: number } | null;

export function buildSpec(plan: FramePlan, p: Project, get: Provider, text: CanvasImageSource | null): FrameSpec {
  const mk = (l: LayerPlan): Layer | null => {
    const f = get(l.clip.src, l.clip.id);
    if (!f) return null;
    const tr = transformAt(l.clip.tr, l.tIn);
    let { x, y, scale } = tr;
    if (l.ov) {
      const c = cornerPos(l.ov.corner ?? 'br', l.ov.size ?? 0.35);
      x += c.x;
      y += c.y;
      scale *= l.ov.size ?? 0.35;
    }
    return { el: f.el, w: f.w, h: f.h, crop: l.clip.crop, fit: l.clip.fit, x, y, scale, rot: tr.rot, opacity: tr.opacity * (l.role === 'overlay' ? 1 : fadeFactor(l.clip, l.tIn)), grade: l.clip.grade, ...(l.clip.lut ? { lut: l.clip.lut } : {}), ...(l.clip.mask ? { mask: l.clip.mask } : {}), ...(l.clip.chroma ? { chroma: l.clip.chroma } : {}) };
  };
  const main = plan.layers.find((l) => l.role === 'main');
  const b = plan.layers.find((l) => l.role === 'mainB');
  return {
    main: main ? mk(main) : null,
    mainB: b ? mk(b) : null,
    tr: plan.tr,
    overlays: plan.layers.filter((l) => l.role === 'overlay').map(mk).filter((x): x is Layer => !!x),
    text,
  };
}

// ---------------------------------------------------------------- titles and subtitles, painted on a canvas the size of the picture
const FONT = '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", system-ui, "Helvetica Neue", sans-serif';
const EDGE = 300;

/** The title's own animation at time t: its opacity and the rise in fractions of the picture's height. */
export function titleAnim(o: Overlay, t: number): { alpha: number; rise: number } {
  const ti = o.title!;
  const inT = clamp((t - o.start) / EDGE, 0, 1);
  const outT = clamp((o.start + o.len - t) / EDGE, 0, 1);
  const a = ti.appear === 'none' ? 1 : inT;
  const z = ti.leave === 'none' ? 1 : outT;
  const rise = (ti.appear === 'rise' ? (1 - inT) * 0.04 : 0) - (ti.leave === 'rise' ? (1 - outT) * 0.04 : 0);
  return { alpha: a * z, rise };
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const tryLine = line ? `${line} ${w}` : w;
      if (g.measureText(tryLine).width > max && line) {
        out.push(line);
        line = w;
      } else line = tryLine;
    }
    out.push(line);
  }
  return out;
}

/** Paint the titles and the subtitle showing at t; false when nothing shows (the canvas is then left clear). */
export function paintText(c: HTMLCanvasElement | OffscreenCanvas, p: Project, t: number): boolean {
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, c.width, c.height);
  const W = c.width;
  const H = c.height;
  let any = false;
  for (const o of overlaysInOrder(p)) {
    if (!o.title || t < o.start || t >= o.start + o.len || !o.title.text.trim()) continue;
    any = true;
    const { alpha, rise } = titleAnim(o, t);
    const size = Math.round(H * 0.075);
    g.save();
    g.globalAlpha = alpha;
    g.font = `700 ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = wrap(g, o.title.text, W * 0.84);
    const lh = size * 1.18;
    const cy = (o.title.pos === 'top' ? 0.16 : o.title.pos === 'middle' ? 0.5 : 0.78) * H + rise * H;
    lines.forEach((ln, i) => {
      const y = cy + (i - (lines.length - 1) / 2) * lh;
      g.lineWidth = size * 0.12;
      g.strokeStyle = 'rgba(0,0,0,.55)';
      g.lineJoin = 'round';
      g.strokeText(ln, W / 2, y);
      g.fillStyle = '#fff';
      g.fillText(ln, W / 2, y);
    });
    g.restore();
  }
  const cue: Cue | undefined = cueAt(p.subs, t);
  if (cue) {
    any = true;
    const size = Math.round(H * 0.042);
    g.save();
    g.font = `600 ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = wrap(g, cue.text, W * 0.84);
    const lh = size * 1.25;
    const cy = (cue.pos === 'top' ? 0.1 : 0.9) * H - (cue.pos === 'bottom' ? ((lines.length - 1) * lh) / 2 : -((lines.length - 1) * lh) / 2);
    const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + size * 0.9;
    const bh = lines.length * lh + size * 0.4;
    g.fillStyle = 'rgba(0,0,0,.62)';
    const rx = W / 2 - bw / 2;
    const ry = cy - bh / 2 + ((lines.length - 1) * lh) / 2;
    g.beginPath();
    g.roundRect(rx, ry, bw, bh, size * 0.3);
    g.fill();
    g.fillStyle = '#fff';
    lines.forEach((ln, i) => g.fillText(ln, W / 2, cy + i * lh));
    g.restore();
  }
  return any;
}

/** The timeline's end, and what the player and export stop at. */
export const endOf = (p: Project): number => {
  const pl = place(p.main);
  return pl.reduce((m, x) => Math.max(m, x.start + x.len), 0);
};
export { clipLen, shape };
