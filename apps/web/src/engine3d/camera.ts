/**
 * THE ENGINE'S CAMERA (BRIEF-ENGINE-3D-1): an orbit camera as five numbers, turned, panned and zoomed by what a finger does, and
 * the maths that goes with it: a point to the screen and a touch to a ray, so a tap can find a thing and a drag can follow a
 * handle. Metres, y up. Pure; the page sets three.js's camera from `eye` and `target` and the two agree because the
 * projection here is the plain perspective one three.js uses.
 */
import type { Ray } from './shapes';
import type { Scene } from './scene';

export interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
  /** Vertical field of view, degrees. */
  fov: number;
}

export const PITCH = { min: (6 * Math.PI) / 180, max: (86 * Math.PI) / 180 };
export const DIST = { min: 0.5, max: 60 };

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const startCam = (): Cam => ({ yaw: 0.6, pitch: 0.7, dist: 7, tx: 0, ty: 0.4, tz: 0, fov: 45 });

export function eye(c: Cam): V {
  return [c.tx + c.dist * Math.sin(c.yaw) * Math.cos(c.pitch), c.ty + c.dist * Math.sin(c.pitch), c.tz + c.dist * Math.cos(c.yaw) * Math.cos(c.pitch)];
}

/** Right, up and forward (the way it looks) as unit vectors. */
export function basis(c: Cam): { right: V; up: V; fwd: V } {
  const fwd = norm(sub([c.tx, c.ty, c.tz], eye(c)));
  const right = norm(cross(fwd, [0, 1, 0]));
  return { right, up: cross(right, fwd), fwd };
}

/** One finger's drag turns the view: across turns it about the vertical, down tips it. */
export function orbit(c: Cam, dx: number, dy: number): Cam {
  return { ...c, yaw: c.yaw - dx * 0.008, pitch: clamp(c.pitch + dy * 0.006, PITCH.min, PITCH.max) };
}

/** Two fingers' drag slides the target along the ground, so the thing under the fingers stays under them. */
export function pan(c: Cam, dx: number, dy: number, viewH: number): Cam {
  const k = (2 * c.dist * Math.tan((c.fov * Math.PI) / 360)) / Math.max(1, viewH);
  const right = basis(c).right;
  const fwdFlat = norm([-Math.sin(c.yaw), 0, -Math.cos(c.yaw)]);
  return { ...c, tx: clamp(c.tx - right[0] * dx * k - fwdFlat[0] * dy * k, -60, 60), tz: clamp(c.tz - right[2] * dx * k - fwdFlat[2] * dy * k, -60, 60) };
}

/** A pinch or a wheel: `k` above 1 brings it nearer. */
export function zoom(c: Cam, k: number): Cam {
  return { ...c, dist: clamp(c.dist / clamp(k, 0.2, 5), DIST.min, DIST.max) };
}

/** The view that fits the whole scene (its ground and every thing), seen from the front corner. */
export function frame(c: Cam, s: Scene): Cam {
  let r = Math.hypot(s.ground.w, s.ground.d) / 200;
  let top = 0;
  for (const o of s.objects) {
    r = Math.max(r, Math.hypot(o.x, o.z) / 100 + Math.hypot(o.w, o.d) / 200);
    top = Math.max(top, (o.y + o.h) / 100);
  }
  const half = (c.fov * Math.PI) / 360;
  const dist = clamp(((r + top * 0.3) / Math.sin(half)) * 0.92, DIST.min, DIST.max);
  return { ...c, tx: 0, ty: Math.min(1.2, top / 3), tz: 0, dist };
}

/** A point in the scene to the screen (pixels, y down) and its depth, or null behind the eye. */
export function project(c: Cam, p: V, w: number, h: number): { x: number; y: number; depth: number } | null {
  const { right, up, fwd } = basis(c);
  const v = sub(p, eye(c));
  const z = dot(v, fwd);
  if (z <= 0.01) return null;
  const f = 1 / Math.tan((c.fov * Math.PI) / 360);
  return { x: w / 2 + ((dot(v, right) * f) / z) * (h / 2), y: h / 2 - ((dot(v, up) * f) / z) * (h / 2), depth: z };
}

/** The ray a touch at (px, py) makes into the scene. */
export function rayAt(c: Cam, px: number, py: number, w: number, h: number): Ray {
  const { right, up, fwd } = basis(c);
  const t = Math.tan((c.fov * Math.PI) / 360);
  const sx = ((px - w / 2) / (h / 2)) * t;
  const sy = (-(py - h / 2) / (h / 2)) * t;
  return { o: eye(c), d: norm([fwd[0] + right[0] * sx + up[0] * sy, fwd[1] + right[1] * sx + up[1] * sy, fwd[2] + right[2] * sx + up[2] * sy]) };
}

/** Where a ray meets the horizontal plane at height `y` (metres): x and z, or null when it looks away from it. */
export function planeHit(r: Ray, y = 0): { x: number; z: number } | null {
  if (Math.abs(r.d[1]) < 1e-6) return null;
  const t = (y - r.o[1]) / r.d[1];
  if (t <= 0) return null;
  return { x: r.o[0] + r.d[0] * t, z: r.o[2] + r.d[2] * t };
}

/** Where a touch lands on the ground (cm from its middle), or null above the horizon. */
export function groundAt(c: Cam, px: number, py: number, w: number, h: number, y = 0): { x: number; z: number } | null {
  const hit = planeHit(rayAt(c, px, py, w, h), y);
  return hit ? { x: hit.x * 100, z: hit.z * 100 } : null;
}
