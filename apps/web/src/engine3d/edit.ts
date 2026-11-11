/**
 * THE HANDLES (BRIEF-ENGINE-3D-1): where a selected thing's handles are on the screen and what a drag on each one does. MOVE is the
 * thing itself; TURN is a ring round it; SIZE is a knob at the width end, one at the depth end and one at the top. A drag becomes the
 * same change as a typed number: a new object, snapped, in range. Pure: the camera and the touch go in, the object comes out.
 */
import { planeHit, project, rayAt, eye, type Cam } from './camera';
import { place, unplace } from './shapes';
import { snap, tidy, type Obj } from './scene';

export type Tool = 'move' | 'turn' | 'size';
export type HandleKind = 'turn' | 'w' | 'd' | 'h';
export interface Handle {
  kind: HandleKind;
  /** In the scene, metres. */
  at: [number, number, number];
  /** What it says to a screen reader. */
  label: string;
}

/** The ring's radius, metres: just outside the thing's footprint. */
export const ringOf = (o: Pick<Obj, 'w' | 'd'>) => Math.max(o.w, o.d) / 200 + 0.2;

/** The handles the tool shows for this object. */
export function handlesOf(o: Obj, tool: Tool): Handle[] {
  if (tool === 'turn') return [{ kind: 'turn', at: place([ringOf(o), 0.02, 0], o), label: 'Turn handle: drag round the thing' }];
  if (tool === 'size')
    return [
      { kind: 'w', at: place([o.w / 200, o.h / 200, 0], o), label: 'Width handle: drag along the width' },
      { kind: 'd', at: place([0, o.h / 200, o.d / 200], o), label: 'Depth handle: drag along the depth' },
      { kind: 'h', at: place([0, o.h / 100, 0], o), label: 'Height handle: drag up or down' },
    ];
  return [];
}

/** Pixels within which a touch takes a handle: a finger's width. */
export const HANDLE_PX = 28;

/** The handle under a touch, the nearest within HANDLE_PX, or null. */
export function pickHandle(cam: Cam, o: Obj, tool: Tool, px: number, py: number, w: number, h: number, radius = HANDLE_PX): Handle | null {
  let best: { hd: Handle; d: number } | null = null;
  for (const hd of handlesOf(o, tool)) {
    const p = project(cam, hd.at, w, h);
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= radius && (!best || d < best.d)) best = { hd, d };
  }
  return best?.hd ?? null;
}

export interface Grab {
  kind: 'move' | HandleKind;
  /** Where the thing was against the touch when the drag began (cm), for a move. */
  dx: number;
  dz: number;
}

/** The ground point (cm) under a touch at the thing's own height `y` (metres), or null. */
function floorAt(cam: Cam, px: number, py: number, w: number, h: number, y: number) {
  const hit = planeHit(rayAt(cam, px, py, w, h), y);
  return hit ? { x: hit.x * 100, z: hit.z * 100 } : null;
}

/** A grab on the body: the offset that keeps the thing where the finger took it. */
export function grabBody(cam: Cam, o: Obj, px: number, py: number, w: number, h: number): Grab {
  const f = floorAt(cam, px, py, w, h, o.y / 100 + o.h / 200);
  return { kind: 'move', dx: f ? o.x - f.x : 0, dz: f ? o.z - f.z : 0 };
}

/** The object after the finger reaches (px, py) in this grab. */
export function drag(cam: Cam, o: Obj, g: Grab, px: number, py: number, w: number, h: number): Obj {
  switch (g.kind) {
    case 'move': {
      const f = floorAt(cam, px, py, w, h, o.y / 100 + o.h / 200);
      return f ? tidy({ ...o, x: snap(f.x + g.dx), z: snap(f.z + g.dz) }) : o;
    }
    case 'turn': {
      const f = floorAt(cam, px, py, w, h, 0.02);
      if (!f) return o;
      return tidy({ ...o, rot: snap((Math.atan2(f.z - o.z, f.x - o.x) * 180) / Math.PI) });
    }
    case 'w':
    case 'd': {
      const f = floorAt(cam, px, py, w, h, o.y / 100 + o.h / 200);
      if (!f) return o;
      const l = unplace([f.x / 100, o.y / 100 + o.h / 200, f.z / 100], o);
      return g.kind === 'w' ? tidy({ ...o, w: Math.max(5, snap(Math.abs(l[0]) * 200)) }) : tidy({ ...o, d: Math.max(5, snap(Math.abs(l[2]) * 200)) });
    }
    case 'h': {
      // the vertical plane through the thing's middle, facing the eye: where the finger is on it is how high
      const r = rayAt(cam, px, py, w, h);
      const e = eye(cam);
      const n = [e[0] - o.x / 100, 0, e[2] - o.z / 100];
      const nl = Math.hypot(n[0]!, n[2]!) || 1;
      const nx = n[0]! / nl;
      const nz = n[2]! / nl;
      const den = r.d[0] * nx + r.d[2] * nz;
      if (Math.abs(den) < 1e-6) return o;
      const t = ((o.x / 100 - r.o[0]) * nx + (o.z / 100 - r.o[2]) * nz) / den;
      if (t <= 0) return o;
      const y = r.o[1] + r.d[1] * t;
      return tidy({ ...o, h: Math.max(5, snap(y * 100 - o.y)) });
    }
  }
}
