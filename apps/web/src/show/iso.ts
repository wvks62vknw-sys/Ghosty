/**
 * BOXES IN 3-D, DRAWN WITHOUT A GPU (BRIEF-SHOW-ME-1): the Stage's room and part are boxes (studio/room.ts `Box`), turned about the
 * vertical and seen from a little above, projected orthographically, back faces dropped, the faces sorted far to near and shaded by
 * one light. Pure: it returns polygons; show/stage.ts puts them in an SVG in the world's own ink. In a room the walls nearer the
 * eye than the room's middle are left out (a cutaway), so the inside is seen.
 */
import type { Box } from '../studio/room';

export type Pt = [number, number];
/** What the drawing needs beyond the faces: where a world point lands, the footprint, the ground and the soft shadow. */
export interface Scene {
  /** A world point (metres, y up) to the picture's own point. */
  project: (p: [number, number, number]) => Pt;
  /** How far toward the eye a world point is (the nearer, the bigger). */
  depthOf: (p: [number, number, number]) => number;
  /** The world box the boxes fill, metres. */
  foot: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
  /** The ground the thing stands on, a little wider than its footprint, as a quad (picture points). */
  ground: Pt[];
  /** The light's shadow of what stands on it, thrown on the ground (picture points), or null. */
  shadow: Pt[] | null;
}

export interface Face {
  /** Screen points, x right, y down, in units where 1 = one metre at scale 1. */
  pts: [number, number][];
  /** 0 (away from the light) to 1 (facing it). */
  shade: number;
  depth: number;
  kind: Box['kind'];
  name: string;
}

type V = [number, number, number];

// the faces of a unit cube by corner index (corners are the 8 sign combinations x, y, z), with each face's outward normal
const CORNERS: V[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const QUADS: { q: [number, number, number, number]; n: V }[] = [
  { q: [4, 5, 6, 7], n: [0, 0, 1] },
  { q: [1, 0, 3, 2], n: [0, 0, -1] },
  { q: [5, 1, 2, 6], n: [1, 0, 0] },
  { q: [0, 4, 7, 3], n: [-1, 0, 0] },
  { q: [3, 7, 6, 2], n: [0, 1, 0] },
  { q: [0, 1, 5, 4], n: [0, -1, 0] },
];

const LIGHT: V = (() => {
  const l: V = [-0.45, 0.8, 0.4];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

/** The faces of `boxes` seen at `yaw` (radians about the vertical) and `pitch` (down from the horizon), centred on `centre`. */
export function faces(boxes: Box[], yaw: number, pitch = 0.5, cutaway = false): { faces: Face[]; radius: number; scene: Scene } {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // world → view: turn about the vertical, then tip down; view z is toward the eye, y up
  const view = (p: V): V => {
    const x = p[0] * cy - p[2] * sy;
    const z = p[0] * sy + p[2] * cy;
    return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
  };
  const turnN = (n: V): V => view(n);
  let radius = 0;
  const out: Face[] = [];
  // the middle of the whole thing, for the cutaway and for centring
  const floor = boxes.find((b) => b.kind === 'floor');
  const heart = floor ? view(floor.pos) : ([0, 0, 0] as V);
  const n = boxes.length || 1;
  const mid = view([boxes.reduce((a, b) => a + b.pos[0], 0) / n, boxes.reduce((a, b) => a + b.pos[1], 0) / n, boxes.reduce((a, b) => a + b.pos[2], 0) / n]);
  for (const b of boxes) {
    const cr = Math.cos(b.rotY);
    const sr = Math.sin(b.rotY);
    const place = (c: V): V => {
      const lx = (c[0] * b.size[0]) / 2;
      const ly = (c[1] * b.size[1]) / 2;
      const lz = (c[2] * b.size[2]) / 2;
      return [lx * cr + lz * sr + b.pos[0], ly + b.pos[1], -lx * sr + lz * cr + b.pos[2]];
    };
    if (cutaway && b.kind === 'wall' && view(b.pos)[2] > heart[2] + 0.02) continue;
    if (cutaway && b.kind === 'ceiling') continue;
    const world = CORNERS.map(place);
    const v = world.map(view);
    for (const p of world) radius = Math.max(radius, Math.hypot(p[0], p[1] - 1, p[2]));
    for (const { q, n } of QUADS) {
      const wn: V = [n[0] * cr + n[2] * sr, n[1], -n[0] * sr + n[2] * cr];
      const vn = turnN(wn);
      if (vn[2] <= 0.001) continue;
      const pts = q.map((i) => [v[i]![0] - mid[0], -(v[i]![1] - mid[1])] as [number, number]);
      const depth = q.reduce((s, i) => s + v[i]![2], 0) / 4;
      const shade = Math.max(0, vn[0] * LIGHT[0] + vn[1] * LIGHT[1] + vn[2] * LIGHT[2]);
      out.push({ pts, shade, depth, kind: b.kind, name: b.name });
    }
  }
  out.sort((a, b) => a.depth - b.depth);
  return { faces: out, radius: radius || 1, scene: sceneOf(boxes, view, mid, yaw, pitch) };
}

const hull = (pts: Pt[]): Pt[] => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
};

/** The footprint, the ground and the shadow, seen from the same turn (the light is the viewer's own, above and to the left). */
function sceneOf(boxes: Box[], view: (p: V) => V, mid: V, yaw: number, pitch: number): Scene {
  const corners = (b: Box): V[] => {
    const cr = Math.cos(b.rotY);
    const sr = Math.sin(b.rotY);
    return CORNERS.map((c) => {
      const lx = (c[0] * b.size[0]) / 2;
      const lz = (c[2] * b.size[2]) / 2;
      return [lx * cr + lz * sr + b.pos[0], (c[1] * b.size[1]) / 2 + b.pos[1], -lx * sr + lz * cr + b.pos[2]] as V;
    });
  };
  const all = boxes.flatMap(corners);
  const foot = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const p of all) {
    foot.x0 = Math.min(foot.x0, p[0]);
    foot.x1 = Math.max(foot.x1, p[0]);
    foot.z0 = Math.min(foot.z0, p[2]);
    foot.z1 = Math.max(foot.z1, p[2]);
    foot.y0 = Math.min(foot.y0, p[1]);
    foot.y1 = Math.max(foot.y1, p[1]);
  }
  if (!all.length) Object.assign(foot, { x0: -1, x1: 1, z0: -1, z1: 1, y0: 0, y1: 1 });
  const project = (p: V): Pt => {
    const v = view(p);
    return [v[0] - mid[0], -(v[1] - mid[1])];
  };
  // the ground: the floor's own top if there is a floor, else the lowest point
  const floor = boxes.find((b) => b.kind === 'floor');
  const gy = floor ? floor.pos[1] + floor.size[1] / 2 : foot.y0;
  const pad = 0.12 * Math.max(foot.x1 - foot.x0, foot.z1 - foot.z0) + 0.1;
  const ground = ([[foot.x0 - pad, foot.z0 - pad], [foot.x1 + pad, foot.z0 - pad], [foot.x1 + pad, foot.z1 + pad], [foot.x0 - pad, foot.z1 + pad]] as [number, number][]).map(([x, z]) => project([x, gy, z]));
  // the light, in the viewer's frame, taken back into the world's: undo the tip, then the turn
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y1 = LIGHT[1] * cp + LIGHT[2] * sp;
  const z1 = -LIGHT[1] * sp + LIGHT[2] * cp;
  const lw: V = [LIGHT[0] * cy + z1 * sy, y1, -LIGHT[0] * sy + z1 * cy];
  const lift = Math.max(0.2, lw[1]);
  const standing = boxes.filter((b) => b.kind === 'item');
  const hits = standing.flatMap(corners).map((p) => {
    const d = (p[1] - gy) / lift;
    return project([p[0] - lw[0] * d, gy, p[2] - lw[2] * d]);
  });
  return { project, depthOf: (p) => view(p)[2], foot, ground, shadow: hits.length >= 3 ? hull(hits) : null };
}
