/**
 * AIM's geometry, kept pure so it can be tested off the phone: where a thing out there (a plane,
 * a ship, a hilltop, the space station) lies from where the owner stands — bearing, elevation
 * above the horizon, distance — with the Earth's curvature included, and where that lands on
 * the screen for the way the phone is held. Also: the phone's pose from its orientation sensor,
 * edge arrows for things off the screen, and label placement that keeps labels from piling up.
 *
 * Directions are in a local east-north-up frame: x east, y north, z up (metres or unit vectors).
 */

export interface LatLonAlt {
  lat: number;
  lon: number;
  /** Metres above sea level. */
  alt: number;
}

export type Vec3 = [number, number, number];

/** Where something lies from the observer. */
export interface Look {
  /** Degrees clockwise from true north, 0–360. */
  bearing: number;
  /** Degrees above (+) or below (−) the observer's horizontal plane. */
  elevation: number;
  /** Metres along the ground (great circle). */
  ground: number;
  /** Metres in a straight line. */
  range: number;
  /** Unit vector to the target, east-north-up at the observer. */
  dir: Vec3;
}

/** The way the camera points: forward, and the screen's right and up, as east-north-up unit vectors. */
export interface Pose {
  f: Vec3;
  r: Vec3;
  u: Vec3;
}

/** The viewfinder: CSS pixels and the camera's focal length in those pixels. */
export interface Viewport {
  w: number;
  h: number;
  focal: number;
}

/** A point on the screen, or the edge arrow for something that is not on it. */
export interface Projected {
  x: number;
  y: number;
  /** In the picture (in front of the camera and inside the viewfinder). */
  on: boolean;
  /** For an off-screen thing: the arrow's direction on the screen, radians (0 = right, π/2 = down). */
  angle: number;
}

/**
 * The iPhone 13's main camera sees about 69° across its long side; the Lens asks for a 16:9
 * picture, which keeps the long side, so the focal length follows from the frame's long side
 * (portrait: about 42° across, less after the viewfinder crops it). ALIGN fixes any heading
 * error; this angle only sets how far apart things are drawn.
 */
export const CAMERA_LONG_FOV_DEG = 69;

const A = 6378137; // WGS-84
const E2 = 6.69437999014e-3;
const R_MEAN = 6371008.8;
export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

/** 0 ≤ d < 360. */
export const wrap360 = (d: number): number => ((d % 360) + 360) % 360;
/** −180 < d ≤ 180: the signed turn from one heading to another (359 → 1 is +2, not −358). */
export const wrap180 = (d: number): number => {
  const x = wrap360(d);
  return x > 180 ? x - 360 : x;
};
export const turn = (from: number, to: number): number => wrap180(to - from);

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Earth-centred coordinates (metres) of a place on the WGS-84 ellipsoid. */
export function ecef(p: LatLonAlt): Vec3 {
  const la = p.lat * RAD;
  const lo = p.lon * RAD;
  const s = Math.sin(la);
  const n = A / Math.sqrt(1 - E2 * s * s);
  return [(n + p.alt) * Math.cos(la) * Math.cos(lo), (n + p.alt) * Math.cos(la) * Math.sin(lo), (n * (1 - E2) + p.alt) * s];
}

/** Metres along the ground between two places (haversine on the mean sphere). */
export function groundDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MEAN * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bearing, elevation and distance from the observer to a target. The straight line between the
 * two points in Earth-centred space, turned into the observer's east-north-up frame, so a far
 * target sits lower than a flat-Earth sum says (a ship 30 km away at sea level is ~0.13° below
 * level for someone standing on the shore) and the space station is below the horizon when the
 * planet is in the way.
 */
export function look(obs: LatLonAlt, tgt: LatLonAlt): Look {
  const o = ecef(obs);
  const t = ecef(tgt);
  const d: Vec3 = [t[0] - o[0], t[1] - o[1], t[2] - o[2]];
  const la = obs.lat * RAD;
  const lo = obs.lon * RAD;
  const sla = Math.sin(la);
  const cla = Math.cos(la);
  const slo = Math.sin(lo);
  const clo = Math.cos(lo);
  const e = -slo * d[0] + clo * d[1];
  const n = -sla * clo * d[0] - sla * slo * d[1] + cla * d[2];
  const u = cla * clo * d[0] + cla * slo * d[1] + sla * d[2];
  const range = Math.hypot(e, n, u);
  return {
    bearing: wrap360(Math.atan2(e, n) * DEG),
    elevation: Math.atan2(u, Math.hypot(e, n)) * DEG,
    ground: groundDistance(obs, tgt),
    range,
    dir: range > 0 ? [e / range, n / range, u / range] : [0, 1, 0],
  };
}

/** True when the target is above the observer's horizon (the space station: show it only then). */
export const aboveHorizon = (obs: LatLonAlt, tgt: LatLonAlt): boolean => look(obs, tgt).elevation > 0;

/** A unit direction from a bearing and an elevation (degrees). */
export function direction(bearing: number, elevation: number): Vec3 {
  const b = bearing * RAD;
  const e = elevation * RAD;
  return [Math.sin(b) * Math.cos(e), Math.cos(b) * Math.cos(e), Math.sin(e)];
}

/** The pose for a heading and a tilt (degrees; pitch up is +, roll clockwise is +): the drag-to-pan mode, and tests. */
export function poseFrom(heading: number, pitch = 0, roll = 0): Pose {
  const f = direction(heading, pitch);
  const h = heading * RAD;
  const r0: Vec3 = [Math.cos(h), -Math.sin(h), 0];
  const u0 = cross(r0, f);
  if (!roll) return { f, r: r0, u: u0 };
  const c = Math.cos(roll * RAD);
  const s = Math.sin(roll * RAD);
  return { f, r: norm([r0[0] * c - u0[0] * s, r0[1] * c - u0[1] * s, r0[2] * c - u0[2] * s]), u: norm([u0[0] * c + r0[0] * s, u0[1] * c + r0[1] * s, u0[2] * c + r0[2] * s]) };
}

/**
 * The camera's pose from a deviceorientation reading (W3C: alpha about up, beta about the
 * phone's side, gamma about its length; the rear camera looks out of the back) and the screen's
 * rotation (screen.orientation.angle). Alpha must be measured from north for the heading to mean
 * anything; iPhones give a relative alpha plus webkitCompassHeading, which `headingTo` applies.
 */
export function poseFromOrientation(alpha: number, beta: number, gamma: number, screenAngle = 0): Pose {
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);
  // columns of the rotation from the phone's axes to east-north-up
  const x: Vec3 = [cA * cG - sA * sB * sG, cG * sA + cA * sB * sG, -cB * sG];
  const y: Vec3 = [-cB * sA, cA * cB, sB];
  const z: Vec3 = [cA * sG + cG * sA * sB, sA * sG - cA * cG * sB, cB * cG];
  const t = screenAngle * RAD;
  const ct = Math.cos(t);
  const st = Math.sin(t);
  return {
    f: [-z[0], -z[1], -z[2]],
    r: [ct * x[0] - st * y[0], ct * x[1] - st * y[1], ct * x[2] - st * y[2]],
    u: [st * x[0] + ct * y[0], st * x[1] + ct * y[1], st * x[2] + ct * y[2]],
  };
}

/** Where the camera points: heading (degrees from north) and pitch (degrees above level). */
export function headingOf(p: Pose): { heading: number; pitch: number } {
  return { heading: wrap360(Math.atan2(p.f[0], p.f[1]) * DEG), pitch: Math.asin(Math.max(-1, Math.min(1, p.f[2]))) * DEG };
}

/** The same pose turned about the vertical by `deg` (clockwise seen from above): the compass fix and ALIGN's offset. */
export function rotatePose(p: Pose, deg: number): Pose {
  if (!deg) return p;
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const rot = (v: Vec3): Vec3 => [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]];
  return { f: rot(p.f), r: rot(p.r), u: rot(p.u) };
}

/** The pose turned so the camera's heading is `heading` (an iPhone's webkitCompassHeading), tilt kept. */
export const headingTo = (p: Pose, heading: number): Pose => rotatePose(p, turn(headingOf(p).heading, heading));

/** Focal length in viewfinder pixels: the frame's long side spans CAMERA_LONG_FOV_DEG, scaled by the viewfinder's cover crop. */
export function focalFor(frame: { w: number; h: number }, scale: number, view: { w: number; h: number }, longFov = CAMERA_LONG_FOV_DEG): number {
  const half = Math.tan((longFov * RAD) / 2);
  if (frame.w > 0 && frame.h > 0 && scale > 0) return ((Math.max(frame.w, frame.h) / 2) * scale) / half;
  // no camera picture: the same 16:9 picture filling the viewfinder's long side
  return Math.max(view.w, view.h) / 2 / half;
}

/**
 * A direction onto the screen. In view: its pixel; otherwise an arrow at the edge (inset by
 * `margin`) pointing the way to turn — for something behind, the side it is nearer to.
 */
export function project(dir: Vec3, pose: Pose, vp: Viewport, margin = 28): Projected {
  const x = dot(dir, pose.r);
  const y = dot(dir, pose.u);
  const z = dot(dir, pose.f);
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  if (z > 1e-6) {
    const sx = cx + (x / z) * vp.focal;
    const sy = cy - (y / z) * vp.focal;
    if (sx >= 0 && sx <= vp.w && sy >= 0 && sy <= vp.h) return { x: sx, y: sy, on: true, angle: Math.atan2(sy - cy, sx - cx) };
  }
  // off the screen: the way to turn, on the screen's plane
  let ax = x;
  let ay = -y;
  if (z <= 0 && Math.hypot(ax, ay) < 1e-6) ax = 1; // straight behind: turn right
  const angle = Math.atan2(ay, ax);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hw = Math.max(1, cx - margin);
  const hh = Math.max(1, cy - margin);
  const k = Math.min(Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity);
  return { x: cx + dx * k, y: cy + dy * k, on: false, angle };
}

/** The screen line of the horizon (elevation 0) for a pose: two points, or null when the horizon is not in view. */
export function horizonLine(pose: Pose, vp: Viewport): { x1: number; y1: number; x2: number; y2: number } | null {
  const { heading } = headingOf(pose);
  // two level directions either side of where the camera points, through the lens without clipping
  const pt = (d: Vec3) => {
    const z = dot(d, pose.f);
    return z > 1e-6 ? { x: vp.w / 2 + (dot(d, pose.r) / z) * vp.focal, y: vp.h / 2 - (dot(d, pose.u) / z) * vp.focal } : null;
  };
  const a = pt(direction(heading - 20, 0));
  const b = pt(direction(heading + 20, 0));
  if (!a || !b || Math.abs(b.x - a.x) < 1e-6) return null;
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  // extended to the screen's edges
  const m = (by - ay) / (bx - ax);
  const y1 = ay + m * (0 - ax);
  const y2 = ay + m * (vp.w - ax);
  if ((y1 < 0 && y2 < 0) || (y1 > vp.h && y2 > vp.h)) return null;
  return { x1: 0, y1, x2: vp.w, y2 };
}

/** A label to place: its anchor (the marker), its size and how near the thing is. */
export interface LabelIn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Metres: nearer things win the space. */
  dist: number;
}

export interface LabelOut extends LabelIn {
  /** Where the label's top-left corner goes. */
  lx: number;
  ly: number;
}

/**
 * Labels that do not overlap: nearest first, each tried above its marker, then stepped further
 * up, then below; one that finds no room is left out (its marker still shows). At most `max`.
 */
export function declutter(labels: LabelIn[], max = 25, bounds?: { w: number; h: number }): LabelOut[] {
  const placed: LabelOut[] = [];
  const hit = (x: number, y: number, w: number, h: number) => placed.some((p) => x < p.lx + p.w && x + w > p.lx && y < p.ly + p.h && y + h > p.ly);
  const sorted = [...labels].filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y)).sort((a, b) => a.dist - b.dist);
  for (const l of sorted) {
    if (placed.length >= max) break;
    let lx = l.x - l.w / 2;
    if (bounds) lx = Math.max(2, Math.min(bounds.w - l.w - 2, lx));
    const tries = [-l.h - 10, -2 * l.h - 14, -3 * l.h - 18, 10, l.h + 14];
    for (const dy of tries) {
      const ly = l.y + dy;
      if (bounds && (ly < 0 || ly + l.h > bounds.h)) continue;
      if (!hit(lx, ly, l.w, l.h)) {
        placed.push({ ...l, lx, ly });
        break;
      }
    }
  }
  return placed;
}

/** "N", "NE", … for a heading. */
export function compassPoint(deg: number): string {
  const P = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return P[Math.round(wrap360(deg) / 22.5) % 16]!;
}

/** A distance in plain words: "850 m", "4.2 km", "38 km". */
export function distanceText(m: number): string {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000).toLocaleString('en-GB')} km`;
}
