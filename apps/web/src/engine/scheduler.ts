/**
 * The ONE animation loop. Everything that animates registers here instead of starting its
 * own requestAnimationFrame. Pauses when the tab is hidden; lowers render resolution if
 * the frame rate stays low, and raises it again when there is headroom.
 *
 * Timing: animation steps use dt capped at 0.1 s (so a stall doesn't make things jump),
 * while the frame-rate meter and periodic tasks (`every`) use real elapsed time, so they
 * keep working on slow devices.
 */
import { gfx } from './gfx';

export interface FrameTask {
  /** Called every frame, or every `every` seconds of real time if set. dt in seconds. */
  run: (dt: number, now: number) => void;
  every?: number;
  last?: number;
}

const tasks = new Set<FrameTask>();
let scene: { update(dt: number): void; draw(): void } | null = null;
let last = 0;
let fpsStart = 0;
let fpsFrames = 0;
let low = 0;
let high = 0;
export const stats = { fps: 60, scale: 1 };

export function setScene(s: { update(dt: number): void; draw(): void } | null): void {
  scene = s;
}

export function onFrame(run: FrameTask['run'], every?: number): () => void {
  const t: FrameTask = { run, every, last: 0 };
  tasks.add(t);
  return () => tasks.delete(t);
}

function governor(now: number): void {
  fpsFrames++;
  if (!fpsStart) fpsStart = now;
  const span = (now - fpsStart) / 1000;
  if (span < 1.5) return;
  stats.fps = fpsFrames / span;
  fpsStart = now;
  fpsFrames = 0;
  if (stats.fps < 28 && gfx.scale > 0.5) {
    if (++low >= (stats.fps < 12 ? 1 : 2)) {
      gfx.scale = Math.max(0.5, gfx.scale - (stats.fps < 12 ? 0.25 : 0.15));
      gfx.resize();
      low = 0;
    }
  } else low = 0;
  if (stats.fps > 56 && gfx.scale < 1) {
    if (++high >= 4) {
      gfx.scale = Math.min(1, gfx.scale + 0.1);
      gfx.resize();
      high = 0;
    }
  } else high = 0;
  stats.scale = gfx.scale;
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (document.hidden) {
    last = now;
    fpsStart = 0;
    fpsFrames = 0;
    return;
  }
  const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
  last = now;
  gfx.time += dt;
  gfx.post.flash *= Math.pow(0.015, dt);
  try {
    if (scene && gfx.ready) {
      scene.update(dt);
      scene.draw();
    }
  } catch (e) {
    console.error('render', e);
    scene = null;
  }
  for (const t of tasks) {
    if (t.every) {
      if (now - (t.last ?? 0) < t.every * 1000) continue;
      t.last = now;
    }
    try {
      t.run(dt, now);
    } catch (e) {
      console.error('frame task', e);
    }
  }
  governor(now);
}

export function startLoop(): void {
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
}
