/**
 * One source of truth for "where is the viewer": the pointer on a computer, the way the
 * phone is tilted (gyroscope) on a phone. The 3D backdrop steers its camera from it and
 * the holographic panes shift with it through two CSS variables (--px, --py, in -1..1),
 * so the glass and the scene behind it move as one volume.
 *
 * iOS needs a tap before it hands over motion data: the first touch asks once.
 */
import { Emitter } from '../core/store';

export const view = {
  /** Raw target, -1..1. */
  x: 0,
  y: 0,
  /** Smoothed value the renderers use. */
  sx: 0,
  sy: 0,
  /** 'pointer' | 'motion' | 'none' */
  source: 'none' as 'pointer' | 'motion' | 'none',
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

export const spaceEvents = new Emitter<{ motion: boolean }>();

let base: { beta: number; gamma: number } | null = null;

function onOrientation(e: DeviceOrientationEvent): void {
  if (e.beta == null || e.gamma == null) return;
  // The first reading is "level": tilting away from it moves the view.
  if (!base) base = { beta: e.beta, gamma: e.gamma };
  const landscape = Math.abs(window.orientation ?? (screen.orientation?.angle ?? 0)) === 90;
  const dx = landscape ? e.beta - base.beta : e.gamma - base.gamma;
  const dy = landscape ? -(e.gamma - base.gamma) : e.beta - base.beta;
  view.x = Math.max(-1, Math.min(1, dx / 22));
  view.y = Math.max(-1, Math.min(1, dy / 22));
  // Drift the level point slowly so holding the phone at a new angle settles back to centre.
  base.beta += (e.beta - base.beta) * 0.004;
  base.gamma += (e.gamma - base.gamma) * 0.004;
  view.source = 'motion';
}

let askedMotion = false;
/** Ask for gyroscope access (iOS shows a prompt). Safe to call many times. */
export async function enableMotion(): Promise<boolean> {
  if (askedMotion || view.reduced) return view.source === 'motion';
  askedMotion = true;
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  try {
    if (typeof D.requestPermission === 'function') {
      if ((await D.requestPermission()) !== 'granted') return false;
    }
    addEventListener('deviceorientation', onOrientation, { passive: true });
    spaceEvents.emit('motion', true);
    return true;
  } catch {
    return false;
  }
}

const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
if (!view.reduced) {
  if (coarse) {
    // Phones/tablets: motion after the first touch (iOS permission needs a user gesture).
    const once = () => {
      void enableMotion();
      removeEventListener('touchend', once);
    };
    addEventListener('touchend', once, { passive: true });
  } else {
    addEventListener('pointermove', (e) => {
      if (view.source === 'motion') return;
      view.x = (e.clientX / innerWidth) * 2 - 1;
      view.y = (e.clientY / innerHeight) * 2 - 1;
      view.source = 'pointer';
    }, { passive: true });
    addEventListener('pointerleave', () => {
      view.x = 0;
      view.y = 0;
    });
  }
}

const root = document.documentElement.style;
let last = '';
/** Smooth towards the target and publish to CSS. Called once per frame by the scheduler. */
export function stepView(dt: number): void {
  const k = Math.min(1, dt * (view.source === 'motion' ? 5 : 3));
  view.sx += (view.x - view.sx) * k;
  view.sy += (view.y - view.sy) * k;
  const key = `${view.sx.toFixed(3)},${view.sy.toFixed(3)}`;
  if (key === last) return;
  last = key;
  root.setProperty('--px', view.sx.toFixed(3));
  root.setProperty('--py', view.sy.toFixed(3));
}
