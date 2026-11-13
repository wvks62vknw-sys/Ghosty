/**
 * THE FILM FOR THE EYE (BRIEF-EYE-HUD-2 item 2; shell/boot.ts's storyboard, the eye's branch only): the boot in THE EYE ends as the eye. In the last
 * second of the cut the wall resolves from the grain the floor has already settled into: each feed of Home's wall (the very rectangles Home lays out,
 * and each feed's own picture, copied from its canvas: the same pixels, so Home's first frame is this one's last) comes up in its dotted frame a
 * little after the one before; then ONE feed, tonight's, sharpens into the accent box (its grain clears, the box is drawn round it); then the line
 * of sight is drawn from the orb up to it; and the ground fades onto the real Home with no cut. Reduce Motion lands on the still wall (the one frame,
 * whole). Nothing here draws a word: the words are Home's, which arrive as the ground goes. It is a canvas in the boot's own ground layer (so it
 * goes with it), redrawn only when its progress changes, at most sixty-odd times in the whole cut, and costs nothing in the other worlds (the boot
 * creates it only for the eye).
 */
import { drawGrain, inkOf } from './grain';

const clamp = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3);

/** What the shot shows, for tests/eyehud2.spec.mjs and the console (window.__bootState.eyewall). */
export interface EyeShotState {
  /** The wall's progress: 0 nothing, 1 whole. */
  k: number;
  /** How many feeds are drawn in their frames, and whether the sharp one is boxed and the line of sight drawn. */
  feeds: number;
  sharp: boolean;
  sight: boolean;
  /** Home's own rectangles the shot copied (the sharp feed's, the line's), in CSS px; empty until Home's wall is laid out. */
  sharpRect: number[];
  sightRect: number[];
  accent: string;
}

export interface EyeShot {
  state: EyeShotState;
  canvas: HTMLCanvasElement;
  /** Draw the moment T (ms of the cut). `tl`: when the cut's own beats fall. `manual`: a check steps the clock by hand (no real-time ramp). */
  frame(T: number, tl: { end: number; land: number; orb: number; recognise: number }, o: { calm: boolean; manual: boolean }): void;
}

export function eyeShot(host: HTMLElement, vw: number, vh: number, dpr: number, accent: string): EyeShot {
  const canvas = document.createElement('canvas');
  canvas.className = 'bwall';
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const g = canvas.getContext('2d');
  // (tonight's feed has no picture of its own once it is sharp; before that it is grain like the rest: a scratch canvas draws it)
  const scratch = document.createElement('canvas');
  scratch.className = 'bwallpic';
  scratch.setAttribute('aria-hidden', 'true');
  host.append(scratch);
  const state: EyeShotState = { k: 0, feeds: 0, sharp: false, sight: false, sharpRect: [], sightRect: [], accent };
  let key = '';
  let seenAt = 0;
  const cs = getComputedStyle(host);
  const canvasRgb = () => cs.getPropertyValue('--g-canvas-rgb').trim() || '0, 0, 0';
  const faint = () => cs.getPropertyValue('--g-line-faint').trim() || 'rgba(255,255,255,.18)';

  const frame: EyeShot['frame'] = (T, tl, o) => {
    if (!g) return;
    const from = tl.end - 1000;
    const sharpAt = tl.land - 360;
    const sightAt = tl.land - 200;
    const feedsEls = [...document.querySelectorAll<HTMLElement>('.eyewall .eyefeed')];
    const laid = feedsEls.length > 0 && feedsEls.every((e) => e.getClientRects().length) && document.body.classList.contains('eyehome');
    let k = o.calm ? (T >= tl.recognise ? 1 : 0) : clamp((T - from) / (tl.land - from));
    let sharpP = o.calm ? (k >= 1 ? 1 : 0) : clamp((T - sharpAt) / 360);
    let sightP = o.calm ? (k >= 1 ? 1 : 0) : clamp((T - sightAt) / 200);
    if (laid && !seenAt) seenAt = performance.now();
    // (Home's wall is laid out a little after the cut starts on a slow phone: the shot then comes up from the moment it can, never as a jump)
    if (!o.manual && !o.calm && laid) {
      const ramp = clamp((performance.now() - seenAt) / 700);
      k = Math.min(k, ramp);
      sharpP = Math.min(sharpP, clamp((performance.now() - seenAt - 400) / 360));
      sightP = Math.min(sightP, clamp((performance.now() - seenAt - 560) / 200));
    }
    if (!laid) {
      k = 0;
      sharpP = 0;
      sightP = 0;
    }
    const nk = `${Math.round(k * 60)}:${Math.round(sharpP * 30)}:${Math.round(sightP * 20)}:${feedsEls.length}`;
    if (nk === key) return;
    key = nk;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    state.k = Math.round(k * 1000) / 1000;
    state.feeds = 0;
    state.sharp = false;
    state.sight = false;
    if (k <= 0) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = inkOf();
    const bg = canvasRgb();
    const line = faint();
    let i = 0;
    for (const f of feedsEls) {
      const r = f.getBoundingClientRect();
      const isSharp = f.classList.contains('sharp');
      // each feed a little after the one before (in the wall's own order: tonight's is first in the DOM, the rest follow)
      const p = easeOut((k - Math.min(0.5, i * 0.035)) / 0.5);
      i++;
      if (p <= 0 || r.width < 4) continue;
      state.feeds++;
      g.globalAlpha = 1;
      g.fillStyle = `rgba(${bg}, ${(0.55 * p).toFixed(3)})`;
      g.fillRect(r.left, r.top, r.width, r.height);
      let pic = f.querySelector<HTMLCanvasElement>('canvas.eyepic');
      if (isSharp) {
        // tonight's feed: grain first (a picture of its own, seeded from its name), the grain clearing as the box sharpens
        scratch.style.cssText = `position:absolute;left:0;top:0;width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;visibility:hidden;pointer-events:none`;
        scratch.dataset.drawn = '';
        drawGrain(scratch, f.dataset.kind ?? 'tonight', ink);
        pic = scratch;
      }
      if (pic && pic.width > 8 && pic.height > 8) {
        g.globalAlpha = p * (isSharp ? 1 - sharpP : 1);
        g.drawImage(pic, r.left, r.top, r.width, r.height);
        g.globalAlpha = 1;
      }
      if (isSharp) {
        // the grain clears into the sharp ground, and the accent box is drawn round it, from its top-left corner, all the way round
        g.fillStyle = `rgba(${bg}, ${(0.94 * sharpP).toFixed(3)})`;
        g.fillRect(r.left, r.top, r.width, r.height);
        if (sharpP > 0) {
          const per = 2 * (r.width + r.height);
          g.strokeStyle = accent;
          g.lineWidth = 1.5;
          g.setLineDash([per * easeOut(sharpP), per]);
          g.strokeRect(r.left + 0.75, r.top + 0.75, r.width - 1.5, r.height - 1.5);
          g.setLineDash([]);
        }
        state.sharp = sharpP >= 1;
        state.sharpRect = [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
        if (sharpP < 1) {
          g.strokeStyle = line;
          g.setLineDash([1, 2]);
          g.lineWidth = 1;
          g.globalAlpha = p * (1 - sharpP);
          g.strokeRect(r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1);
          g.setLineDash([]);
          g.globalAlpha = 1;
        }
      } else {
        g.strokeStyle = line;
        g.lineWidth = 1;
        g.globalAlpha = p;
        g.setLineDash(f.classList.contains('free') || f.dataset.kind === 'room' || f.dataset.kind === 'abilities' ? [1, 2] : [1, 2]);
        g.strokeRect(r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1);
        g.setLineDash([]);
        g.globalAlpha = 1;
      }
    }
    // the line of sight: from the orb up to the sharp feed, dashed, in the accent, drawn upward
    const sight = document.querySelector<HTMLElement>('.eyewall .eyesight');
    const sr = sight?.getBoundingClientRect();
    if (sr && sr.height > 4 && sightP > 0) {
      g.strokeStyle = accent;
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      const x = sr.left + 0.75;
      const len = sr.height * easeOut(sightP);
      g.beginPath();
      g.moveTo(x, sr.bottom);
      g.lineTo(x, sr.bottom - len);
      g.stroke();
      g.setLineDash([]);
      state.sight = sightP >= 1;
      state.sightRect = [sr.left, sr.top, sr.width, sr.height].map((v) => Math.round(v * 10) / 10);
    }
  };
  return { state, canvas, frame };
}
