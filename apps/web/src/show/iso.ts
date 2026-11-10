/**
 * BOXES IN 3-D, DRAWN WITHOUT A GPU (BRIEF-SHOW-ME-1): the Stage's room and part are boxes (studio/room.ts `Box`), turned about the
 * vertical and seen from a little above, projected orthographically, back faces dropped, the faces sorted far to near and shaded by
 * one light. Pure: it returns polygons; show/stage.ts puts them in an SVG in the world's own ink. In a room the walls nearer the
 * eye than the room's middle are left out (a cutaway), so the inside is seen.
 */
import type { Box } from '../studio/room';

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
export function faces(boxes: Box[], yaw: number, pitch = 0.5, cutaway = false): { faces: Face[]; radius: number } {
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
  return { faces: out, radius: radius || 1 };
}
