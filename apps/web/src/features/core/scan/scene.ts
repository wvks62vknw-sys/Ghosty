/**
 * THE SCAN'S SCENE (BRIEF-HUD-SCAN-1 1, 2; the math lifted from docs/build-plan/mockups/hud/2026-11-08-3/scene3.js, nothing of
 * its pipeline): what the Machine keeps of his world as a point cloud. A wall every 6 cm, a thing every 1.6 cm, a page every
 * 9 mm, on a jittered lattice; every edge one hairline; a face's points carry the ORDER the scan reaches them in (the boot's
 * sampling front, the brighter leading edge and the edges drawing a step behind cost nothing per frame), how the orb lights
 * them (`aOrb`), the room's own light (`aAmb`) and HOW WARM AND HOW COOL each is lit (`aWarm`: the lamp, the street lamps, the
 * windows across the way; `aCool`: the city through the window), so the evening is in the light on the points and never a wash
 * over the type (the room's diagnosis, round three). The lamp is a point light with a downward cone; the lamp itself a base, a
 * stem, a cone of points and one bright bulb, see-through as a scan is. A point sits a hair nearer the camera than its face
 * (`uBias`, 4 mm), so its own occluder never swallows it close up.
 *
 * It draws in Home's ONE WebGL context (features/core/mind.ts: the Mind's renderer, staged full-screen; the orb drawn after it
 * into its own viewport), never a second. The camera is this file's own small matrix (`Cam`), pure, so the marks are placed
 * from the same projection with no 3-D at all (an automated check, a browser with no WebGL): the reticles land where the
 * things are whether or not the points are drawn. Every colour is read from the page's tokens (bone, the accent, its pale,
 * the amber): nothing here names one.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
export type V3 = [number, number, number];

const SAT = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fract = (x: number) => x - Math.floor(x);
export function hash11(p: number): number {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
export function hash12(x: number, y: number): number {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.103);
  let pz = fract(x * 0.0973);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}
function hash22(x: number, y: number): [number, number] {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.103);
  let pz = fract(x * 0.0973);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return [fract((px + px) * pz), fract((px + py) * py)];
}

const POINT_VS = `
attribute float aOrder, aAmb, aOrb, aPat, aLit, aRad, aSeed, aFar, aWarm, aCool, aShow;
uniform float uBuild, uOrbLit, uAmbient, uTime, uDrift, uPing, uPingA, uFade, uScale, uDpr, uBase, uFreshA, uFar, uSparkle, uFog, uBias, uSky, uShow, uWarmA, uCoolA;
uniform vec3 uOrbPos, uBone, uAccent, uAccentMix, uTint, uTintFar, uWarm, uCool;
varying float vA; varying vec3 vC;
void main() {
  vec3 p = position;
  p += normal * 0.006 * uDrift * sin(uTime * 0.9 + aSeed * 6.2831);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  mv.z += uBias;
  float dist = -mv.z;
  gl_Position = projectionMatrix * mv;
  float fr = uBuild * 1.2 - aOrder;
  float on = fr < 0. ? 0. : 1.;
  // a part shown only in one place (him on the walk: 1; the train and its line: 2): aShow 0 is always there
  on *= (aShow < .5 || abs(aShow - uShow) < .5) ? 1. : 0.;
  float fresh = smoothstep(.12, 0., fr) * uFreshA;
  float li = aAmb * uAmbient + aOrb * uOrbLit + uSky * (0.4 + 0.6 * max(normal.y, 0.));
  float fog = exp(-max(dist - 1.5, 0.) * uFog);
  float sparkle = 1. + uSparkle * step(.993, fract(sin(aSeed * 91.7 + floor(uTime * 3.)) * 4375.3));
  float a = aPat * li * (1. + 4. * fresh) * mix(fog, 2.2, aFar) * uFade * on * sparkle;
  float dp = length(p - uOrbPos);
  float ping = exp(-pow((dp - uPing) / .2, 2.)) * uPingA * on;
  vec3 c = mix(uBone, uAccentMix, aLit) * mix(uTint, uTintFar, aFar);
  c *= mix(vec3(1.), uWarm, min(aWarm * uWarmA, 1.));
  c *= mix(vec3(1.), uCool, min(aCool * uCoolA, 1.));
  vC = c * a + uAccent * ping;
  vA = min(1., a + ping);
  gl_PointSize = max(1., (uBase + .8 * aFar + aRad * uScale / dist) * uDpr);
}`;
const POINT_FS = `
precision highp float;
varying float vA; varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - .5);
  float k = smoothstep(.5, .22, d);
  gl_FragColor = vec4(vC * k, vA * k);
}`;
const LINE_VS = `
attribute float aOrder, aLi, aWall;
uniform float uBuild, uEdge, uFade, uAmbient, uOrbLit, uFog;
uniform vec3 uBone, uTint;
varying float vA; varying vec3 vC; varying float vOrder;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  float dist = -mv.z;
  gl_Position = projectionMatrix * mv;
  vOrder = aOrder;
  float fog = exp(-max(dist - 1.5, 0.) * uFog);
  float li = aLi * (.55 * uAmbient + .45 * uOrbLit);
  vA = (aWall > .5 ? .5 : .95) * (.45 + .55 * li) * fog * uFade;
  vC = uBone * uTint;
}`;
const LINE_FS = `
precision highp float;
varying float vA; varying vec3 vC; varying float vOrder;
uniform float uBuild, uEdge;
void main() {
  float drawn = step(vOrder, uEdge * 1.2) * smoothstep(0., .14, uBuild * 1.2 - vOrder);
  float a = vA * drawn;
  gl_FragColor = vec4(vC * a, a);
}`;

/** The scene's lights: the tints (near and far), the room's ambient, the sky from above, the window (cool) and the lamps (warm). */
export interface Light {
  tint: V3;
  tintFar?: V3;
  ambient: number;
  sky?: number;
  window?: { at: V3; strength: number; cool?: number } | null;
  lamps?: { at: V3; strength: number; warm?: number; cone?: number; fall?: number }[];
  fog?: number;
}

export interface Thing {
  type: 'thing';
  c: V3;
  h: V3;
  kind?: number;
  lit?: number;
  edges?: boolean;
  occlude?: boolean;
  faces?: string[] | null;
  s?: number | null;
  base?: number;
  extra?: { warm?: number; cool?: number } | null;
  show?: number;
}
export type Part =
  | Thing
  | { type: 'room'; hw: number; hgt: number; zb: number; zf: number; win?: number[] | null; floorS?: number; wallS?: number; ceiling?: boolean; sides?: boolean; solid?: boolean; back?: boolean }
  | { type: 'lamp'; at: V3; h?: number; base?: number; shade?: number; shadeH?: number }
  | { type: 'cyl'; c: V3; r: number; h: number; s?: number; lit?: number; extra?: { warm?: number; cool?: number } | null; handle?: boolean }
  | { type: 'skyline'; lit?: number; accentLit?: number; night?: boolean; zOff?: number; rise?: number }
  | { type: 'house'; hw?: number; depth?: [number, number]; hgt?: number; ridge?: number }
  | { type: 'street'; z0?: number; z1?: number; x0?: number; x1?: number; lamps?: number; lampH?: number; houses?: boolean; hx?: number; hstep?: number; hw?: number; hz?: number; hgt?: number; roof?: number; win?: [number, number][]; winS?: [number, number]; winSp?: number }
  | { type: 'town'; z0?: number; z1?: number; x0?: number; x1?: number; pitch?: number; centre?: V3; lit?: number; k?: number; tower?: number; edgeFade?: number; camZ?: number; every?: number }
  | { type: 'aircraft'; list: [number, number, number, number, number][]; step?: number }
  | { type: 'ring'; c: V3; r: number; lit?: number; a?: number; show?: number; n?: number }
  | { type: 'trail'; from: V3; to: V3; step?: number; a?: number; lit?: number; show?: number; head?: boolean; rad?: number };

/** What the scene is built from. `buildAt`: a point's order in the scan (0..1), from its place; `orb`: where the eye is at build. */
export interface SceneDesc {
  bounds: [number, number, number, number];
  light: Light;
  orb: { c: V3; r: number };
  parts: Part[];
  buildAt?: (p: V3) => number;
  /** The lean world (the phone that cannot keep up): said, so Home keeps it. */
  lean?: boolean;
}

/** A camera: where it stands, what it looks at, its field of view in degrees. */
export interface CamPose {
  pos: V3;
  tgt: V3;
  fov: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The camera as pure arithmetic (no three.js): its basis, the projection of a point onto a W × H viewport, the world point
 * a screen place names at a depth (where the orb hangs), and the box round a thing. three.js's camera is set from the same
 * pose when the scene is drawn, so what is drawn and where a mark lands are one projection.
 */
export class Cam {
  pos: V3 = [0, 0, 0];
  tgt: V3 = [0, 0, -1];
  fov = 60;
  W = 440;
  H = 956;
  private fw: V3 = [0, 0, -1];
  private rt: V3 = [1, 0, 0];
  private up: V3 = [0, 1, 0];
  private f = 1;

  set(pose: CamPose, W = this.W, H = this.H): void {
    this.pos = [...pose.pos] as V3;
    this.tgt = [...pose.tgt] as V3;
    this.fov = pose.fov;
    this.W = W;
    this.H = H;
    this.fw = norm(sub(this.tgt, this.pos));
    this.rt = norm(cross(this.fw, [0, 1, 0]));
    this.up = cross(this.rt, this.fw);
    this.f = 0.5 / Math.tan((this.fov * Math.PI) / 360);
  }

  /** The focal length in viewport heights (a point's size on screen = its radius × H × f / depth). */
  get focal(): number {
    return this.f;
  }

  /** A world point on the viewport: [x, y, depth] in CSS px, or null behind the camera. */
  project(p: V3): [number, number, number] | null {
    const d = sub(p, this.pos);
    const z = dot(d, this.fw);
    if (z <= 0.02) return null;
    const x = dot(d, this.rt) / z;
    const y = dot(d, this.up) / z;
    return [this.W / 2 + x * this.f * this.H, this.H / 2 - y * this.f * this.H, z];
  }

  /** The world point at screen (sx, sy), `dd` along the view, and the world radius that `rp` px would be there. */
  unproject(sx: number, sy: number, dd: number, rp: number): { c: V3; r: number } {
    const u = (sx - this.W / 2) / this.H;
    const v = (this.H / 2 - sy) / this.H;
    const dir = norm([this.fw[0] * this.f + this.rt[0] * u + this.up[0] * v, this.fw[1] * this.f + this.rt[1] * u + this.up[1] * v, this.fw[2] * this.f + this.rt[2] * u + this.up[2] * v]);
    const along = dd / dot(dir, this.fw);
    return { c: [this.pos[0] + dir[0] * along, this.pos[1] + dir[1] * along, this.pos[2] + dir[2] * along], r: ((rp / this.H) * dd) / this.f };
  }

  /** The screen box round a world box [x0 y0 z0 x1 y1 z1], padded, never smaller than `min` (the 44 pt target), inside the viewport. */
  box(b: number[], pad = 0, min = 0): { left: number; top: number; right: number; bottom: number; depth: number } | null {
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    let depth = 0;
    let n = 0;
    for (let i = 0; i < 8; i++) {
      const p = this.project([i & 1 ? b[3]! : b[0]!, i & 2 ? b[4]! : b[1]!, i & 4 ? b[5]! : b[2]!]);
      if (!p) continue;
      n++;
      depth += p[2];
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    if (!n) return null;
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    if (x1 - x0 < min) {
      const c = (x0 + x1) / 2;
      x0 = c - min / 2;
      x1 = c + min / 2;
    }
    if (y1 - y0 < min) {
      const c = (y0 + y1) / 2;
      y0 = c - min / 2;
      y1 = c + min / 2;
    }
    // (inside the viewport by a hair, as the mock held it: a tag at the box's edge stays on the screen)
    return { left: Math.max(2, x0), top: Math.max(2, y0), right: Math.min(this.W - 2, x1), bottom: Math.min(this.H - 2, y1), depth: depth / n };
  }
}

/** The lerp of two poses (the camera crossing the room, the descent). */
export const lerpPose = (a: CamPose, b: CamPose, k: number): CamPose => ({
  pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k],
  tgt: [a.tgt[0] + (b.tgt[0] - a.tgt[0]) * k, a.tgt[1] + (b.tgt[1] - a.tgt[1]) * k, a.tgt[2] + (b.tgt[2] - a.tgt[2]) * k],
  fov: a.fov + (b.fov - a.fov) * k,
});

/** The uniforms a frame may set (each 0..1 unless said). */
export interface Uniforms {
  uBuild?: number;
  uEdge?: number;
  uPing?: number;
  uPingA?: number;
  uOrbLit?: number;
  uAmbient?: number;
  uTime?: number;
  uDrift?: number;
  uFreshA?: number;
  uSparkle?: number;
  uFade?: number;
  uFog?: number;
  uSky?: number;
  uShow?: number;
  uWarmA?: number;
  uCoolA?: number;
  uBase?: number;
  /** How lit the far things are (the city's windows coming up as the feeds answer): the far tint's brightness, 0..1. */
  far?: number;
}

/** What the scene is, for the checks (window.__ghosty.scan.scene). */
export interface SceneCount {
  points: number;
  lines: number;
  occluders: number;
  buildMs: number;
}

/**
 * The point cloud. `build(desc)` samples every part once into one points buffer, one lines buffer and the occluders (the
 * same buffers at every altitude: nothing is rebuilt on a pinch); `render(T, renderer, pose, W, H, u)` draws it with
 * three.js into the renderer it is given (Mind's: the one context). Without three.js it still projects (the camera is
 * pure), so the marks are placed on a browser that cannot draw it.
 */
export class Scan {
  readonly cam = new Cam();
  count: SceneCount = { points: 0, lines: 0, occluders: 0, buildMs: 0 };
  /** Whether the lean world is what was built. */
  lean = false;
  /** The built buffers (plain arrays until three.js takes them). */
  private pts = { pos: [] as number[], nrm: [] as number[], order: [] as number[], amb: [] as number[], orb: [] as number[], pat: [] as number[], lit: [] as number[], rad: [] as number[], seed: [] as number[], far: [] as number[], warm: [] as number[], cool: [] as number[], show: [] as number[] };
  private lns = { pos: [] as number[], order: [] as number[], li: [] as number[], wall: [] as number[] };
  private occ: { c: V3; h: V3 }[] = [];
  private off: V3 = [0, 0, 0];
  private sky = 0;
  private noLamp = false;
  private show = 0;
  private light!: Light;
  private orbAt!: { c: V3; r: number };
  private buildAt: (p: V3) => number = () => 0;
  /** three.js's side, made on the first draw: the scene, the camera, the materials' uniforms. */
  private gl: { T: Any; scene: Any; camera: Any; u: Record<string, { value: Any }>; points: Any; lines: Any } | null = null;
  readonly u: Record<string, { value: number }> = {
    uBuild: { value: 1 }, uEdge: { value: 1 }, uOrbLit: { value: 1 }, uAmbient: { value: 1 }, uTime: { value: 0 }, uDrift: { value: 0 }, uPing: { value: -9 }, uPingA: { value: 0 }, uFade: { value: 1 },
    uScale: { value: 1 }, uDpr: { value: 2 }, uBase: { value: 0.9 }, uFreshA: { value: 1 }, uFar: { value: 0 }, uSparkle: { value: 0.6 }, uFog: { value: 0.08 }, uBias: { value: 0.004 }, uSky: { value: 0 }, uShow: { value: 0 }, uWarmA: { value: 1 }, uCoolA: { value: 1 },
  };

  /** The orb's place in the world (the eye the points were lit by). */
  get orb(): { c: V3; r: number } {
    return this.orbAt;
  }

  /** A point's order in the scan (0..1): when the sampling front reaches it, from the eye outward. */
  orderOf(p: V3, _eye: V3 = this.orbAt.c): number {
    return this.buildAt(p);
  }

  build(desc: SceneDesc): void {
    const t0 = performance.now();
    this.pts = { pos: [], nrm: [], order: [], amb: [], orb: [], pat: [], lit: [], rad: [], seed: [], far: [], warm: [], cool: [], show: [] };
    this.lns = { pos: [], order: [], li: [], wall: [] };
    this.occ = [];
    this.orbAt = desc.orb;
    this.light = desc.light;
    this.lean = !!desc.lean;
    this.u.uAmbient!.value = desc.light.ambient;
    this.u.uFog!.value = desc.light.fog ?? 0.08;
    const B = desc.bounds;
    this.buildAt = desc.buildAt ?? ((p) => SAT((p[2] - B[2]) / (B[3] - B[2])) * 0.45 + SAT((p[0] + B[0]) / (2 * B[0])) * 0.35 + SAT(p[1] / B[1]) * 0.2);
    for (const part of desc.parts) {
      this.off = [0, 0, 0];
      this.sky = desc.light.sky ?? 0;
      this.noLamp = false;
      this.show = (part as { show?: number }).show ?? 0;
      (this as Any)[part.type](part);
    }
    this.show = 0;
    this.count = { points: this.pts.order.length, lines: this.lns.order.length / 2, occluders: this.occ.length, buildMs: Math.round(performance.now() - t0) };
    if (this.gl) {
      // (built again with three.js already in: the old buffers go, the new take their place on the next draw)
      this.gl.scene.remove(...this.gl.scene.children);
      this.gl.points = this.gl.lines = null;
    }
  }

  /** The light on a point: the orb's, the hour's from the window (cool), the lamp's (warm, a cone downward), the sky's. */
  private lightAt(p: V3, n: V3): { orb: number; amb: number; warm: number; cool: number } {
    const o = this.orbAt.c;
    const L: V3 = [o[0] - p[0], o[1] - p[1], o[2] - p[2]];
    const d = Math.hypot(...L) || 1;
    const dif = Math.max((L[0] * n[0] + L[1] * n[1] + L[2] * n[2]) / d, 0);
    const orb = this.orbAt.r > 0 ? ((0.16 + 0.84 * dif) * 1.9) / (1 + 0.55 * d * d) : 0;
    let amb = 0.55 + 0.45 * dif;
    let warm = 0;
    let cool = 0;
    const w = this.light.window;
    if (w) {
      const V: V3 = [w.at[0] - p[0], w.at[1] - p[1], w.at[2] - p[2]];
      const dw = Math.hypot(...V) || 1;
      const dd = Math.max((V[0] * n[0] + V[1] * n[1] + V[2] * n[2]) / dw, 0);
      const l = (w.strength * (0.3 + 0.7 * dd)) / (1 + 0.25 * dw * dw);
      amb += l;
      cool += l * (w.cool ?? 0) * 2.2;
    }
    if (!this.noLamp)
      for (const lp of this.light.lamps ?? []) {
        const V: V3 = [lp.at[0] - p[0], lp.at[1] - p[1], lp.at[2] - p[2]];
        const dl = Math.hypot(...V) || 1;
        const dd = Math.max((V[0] * n[0] + V[1] * n[1] + V[2] * n[2]) / dl, 0);
        // the shade points down: full light below the bulb, none above it
        const cone = SAT((V[1] / dl - (lp.cone ?? 0.25)) / 0.45);
        const l = (lp.strength * (0.25 + 0.75 * dd) * cone) / (1 + (lp.fall ?? 2.4) * dl * dl);
        amb += l;
        warm += l * (lp.warm ?? 1) * 1.6;
      }
    if (this.sky) amb += this.sky * (0.4 + 0.6 * Math.max(n[1], 0));
    return { orb, amb, warm: SAT(warm), cool: SAT(cool) };
  }

  private push(p0: V3, n: V3, order: number, pat: number, lit: number, rad: number, far = 0, extra: { warm?: number; cool?: number } | null = null): void {
    const p: V3 = [p0[0] + this.off[0], p0[1] + this.off[1], p0[2] + this.off[2]];
    const l = this.lightAt(p, n);
    const P = this.pts;
    P.pos.push(p[0], p[1], p[2]);
    P.nrm.push(n[0], n[1], n[2]);
    P.order.push(order);
    P.amb.push(l.amb);
    P.orb.push(l.orb);
    P.pat.push(pat);
    P.lit.push(lit);
    P.rad.push(rad);
    P.seed.push(hash12(p[0] * 31.7 + p[2] * 7.1, p[1] * 17.3));
    P.far.push(far);
    P.warm.push(SAT(l.warm + (extra?.warm ?? 0)));
    P.cool.push(SAT(l.cool + (extra?.cool ?? 0)));
    P.show.push(this.show);
  }

  private line(a0: V3, b0: V3, li = 1, wall = 0): void {
    const a: V3 = [a0[0] + this.off[0], a0[1] + this.off[1], a0[2] + this.off[2]];
    const b: V3 = [b0[0] + this.off[0], b0[1] + this.off[1], b0[2] + this.off[2]];
    const L = this.lns;
    L.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    L.order.push(this.buildAt(a), this.buildAt(b));
    L.li.push(li, li);
    L.wall.push(wall, wall);
  }

  private occlude(c: V3, h: V3): void {
    this.occ.push({ c: [c[0] + this.off[0], c[1] + this.off[1], c[2] + this.off[2]], h });
  }

  private face(c: V3, n: V3, u: V3, v: V3, hu: number, hv: number, s: number, o: { pat?: (uu: number, vv: number, p: V3) => number; lit?: number; rad?: number; skip?: ((p: V3) => boolean) | null; far?: number; base?: number; extra?: { warm?: number; cool?: number } | null } = {}): void {
    const { pat = () => 1, lit = 0, rad = 0.05, skip = null, far = 0, base = 1, extra = null } = o;
    const nu = Math.ceil((2 * hu) / s);
    const nv = Math.ceil((2 * hv) / s);
    const seedX = Math.round((c[0] * 13 + c[2] * 7 + n[0] * 3) * 100);
    const seedY = Math.round((c[1] * 11 + n[1] * 5 + n[2] * 2) * 100);
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const hh = hash22(i + seedX, j + seedY);
        const uu = -hu + (i + 0.2 + 0.6 * hh[0]) * s;
        const vv = -hv + (j + 0.2 + 0.6 * hh[1]) * s;
        if (uu > hu || vv > hv) continue;
        const p: V3 = [c[0] + u[0] * uu + v[0] * vv, c[1] + u[1] * uu + v[1] * vv, c[2] + u[2] * uu + v[2] * vv];
        if (skip && skip(p)) continue;
        const a = pat(uu, vv, p) * base;
        if (a <= 0) continue;
        this.push(p, n, this.buildAt([p[0] + this.off[0], p[1] + this.off[1], p[2] + this.off[2]]), a, lit, rad * s, far, extra);
      }
  }

  private thing(t: Thing): void {
    const { c, h, kind = 0, lit = 0, edges = true, occlude = true, faces = null, s = null, base = 1, extra = null } = t;
    const sp = s ?? (kind === 1 || kind === 2 || kind === 3 ? 0.009 : 0.016);
    const F: [string, V3, V3, V3, number, number][] = [
      ['+x', [1, 0, 0], [0, 0, 1], [0, 1, 0], h[2], h[1]], ['-x', [-1, 0, 0], [0, 0, 1], [0, 1, 0], h[2], h[1]],
      ['+y', [0, 1, 0], [1, 0, 0], [0, 0, 1], h[0], h[2]], ['-y', [0, -1, 0], [1, 0, 0], [0, 0, 1], h[0], h[2]],
      ['+z', [0, 0, 1], [1, 0, 0], [0, 1, 0], h[0], h[1]], ['-z', [0, 0, -1], [1, 0, 0], [0, 1, 0], h[0], h[1]],
    ];
    for (const [name, n, u, v, hu, hv] of F) {
      if (faces && !faces.includes(name)) continue;
      if (hu < 0.004 || hv < 0.004) continue;
      const fc: V3 = [c[0] + n[0] * h[0], c[1] + n[1] * h[1], c[2] + n[2] * h[2]];
      this.face(fc, n, u, v, hu, hv, sp, { pat: this.pattern(kind, name, h), lit, rad: 0.05, base, extra });
    }
    if (edges) {
      const X = [c[0] - h[0], c[0] + h[0]];
      const Y = [c[1] - h[1], c[1] + h[1]];
      const Z = [c[2] - h[2], c[2] + h[2]];
      const P = (i: number): V3 => [X[i & 1]!, Y[(i >> 1) & 1]!, Z[(i >> 2) & 1]!];
      const li = this.lightAt([c[0] + this.off[0], c[1] + this.off[1], c[2] + this.off[2]], [0, 1, 0]);
      const l = li.amb * 0.6 + li.orb * 0.6;
      for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.line(P(a!), P(b!), Math.min(1, l), 0);
    }
    if (occlude) this.occlude(c, h);
  }

  /** How a face is sampled by what the thing is: a book's page and spine (1), a paper (2), a card (3), a board (5), a calendar (6), a shelf (7), a page (8), a keyboard (9), a seat (10), a chair's back (12). */
  private pattern(kind: number, face: string, h: V3): (uu: number, vv: number) => number {
    if (kind === 1 && face === '+y')
      return (uu, vv) => {
        const row = fract((vv + h[2]) / 0.016);
        const side = Math.abs(uu);
        if (side < 0.006) return 0;
        const inside = side > 0.02 && side < h[0] - 0.02 && Math.abs(vv) < h[2] - 0.02;
        return inside ? (row < 0.55 ? 1 : 0.12) : 0.5;
      };
    if (kind === 2 && face === '+y') return (uu, vv) => (fract((vv + h[2]) / 0.014) < 0.5 && Math.abs(uu) < h[0] - 0.015 ? 1 : 0.25);
    if (kind === 3 && face === '+y') return (_uu, vv) => (fract((vv + h[2]) / 0.012) < 0.4 ? 0.9 : 0.3);
    if (kind === 5 && face === '+y')
      return (uu, vv) => {
        const sx = Math.floor((uu + h[0]) / (h[0] / 4));
        const sy = Math.floor((vv + h[2]) / (h[2] / 4));
        return (sx + sy) % 2 === 0 ? 1 : 0.25;
      };
    if (kind === 6 && face === '+z')
      return (uu, vv) => {
        const gx = ((uu + h[0]) / (2 * h[0])) * 7;
        const gy = ((vv + h[1]) / (2 * h[1])) * 6;
        const fx = Math.abs(fract(gx) - 0.5);
        const fy = Math.abs(fract(gy) - 0.5);
        if (gy > 5) return 0.9;
        if (Math.floor(gx) === 5 && Math.floor(gy) === 3) {
          const r = Math.hypot(fract(gx) - 0.5, fract(gy) - 0.5);
          if (r > 0.3 && r < 0.46) return 1.6;
        }
        return Math.max(fx, fy) > 0.44 ? 1 : 0.3;
      };
    if (kind === 7 && face === '+z')
      return (uu, vv) => {
        const sh = ((vv + h[1]) / (2 * h[1])) * 5;
        const fy = fract(sh);
        const sx = (uu + h[0]) / 0.028;
        const sid = Math.floor(sx) + Math.floor(sh) * 40;
        const tall = 0.55 + 0.4 * hash11(sid);
        return fy < 0.06 ? 1 : fy < tall ? (fract(sx) < 0.12 ? 0.15 : 0.9) : 0.08;
      };
    if (kind === 9 && face === '+y') return (uu) => (fract((uu + h[0]) / 0.024) < 0.14 ? 0.1 : 1);
    if (kind === 8 && face === '+z') return (uu, vv) => (Math.abs(uu) < h[0] - 0.03 && vv > -0.05 ? 1.3 : 0.8);
    if (kind === 10 && face === '+y') return (uu, vv) => (Math.abs(uu) < h[0] - 0.02 && Math.abs(vv) < h[2] - 0.02 ? 0.35 : 1);
    if (kind === 12 && face === '+z') return (uu, vv) => (Math.abs(uu) < h[0] - 0.03 && Math.abs(vv) < h[1] - 0.03 ? 0.3 : 1);
    return () => 1;
  }

  /** The room; `solid: false` leaves the back wall's occluders out, so what is behind it shows between its points (the world from above). */
  private room(o: Extract<Part, { type: 'room' }>): void {
    const { hw, hgt, zb, zf, win = null, floorS = 0.05, wallS = 0.06, ceiling = true, sides = true, solid = true, back = true } = o;
    const zc = (zb + zf) / 2;
    const hz = (zf - zb) / 2;
    const hole = win && win[2]! > win[0]! ? (p: V3) => p[0] > win[0]! && p[0] < win[2]! && p[1] > win[1]! && p[1] < win[3]! : null;
    this.face([0, 0, zc], [0, 1, 0], [1, 0, 0], [0, 0, 1], hw, hz, floorS, { base: 0.6, rad: 0.05 });
    if (ceiling) this.face([0, hgt, zc], [0, -1, 0], [1, 0, 0], [0, 0, 1], hw, hz, wallS, { base: 0.42 });
    if (sides) {
      this.face([-hw, hgt / 2, zc], [1, 0, 0], [0, 0, 1], [0, 1, 0], hz, hgt / 2, wallS, { base: 0.42 });
      this.face([hw, hgt / 2, zc], [-1, 0, 0], [0, 0, 1], [0, 1, 0], hz, hgt / 2, wallS, { base: 0.42 });
    }
    if (back) this.face([0, hgt / 2, zb], [0, 0, 1], [1, 0, 0], [0, 1, 0], hw, hgt / 2, wallS, { base: 0.42, skip: hole });
    const E: [V3, V3][] = [[[-hw, 0, zb], [hw, 0, zb]], [[-hw, hgt, zb], [hw, hgt, zb]], [[-hw, 0, zb], [-hw, hgt, zb]], [[hw, 0, zb], [hw, hgt, zb]], [[-hw, 0, zb], [-hw, 0, zf]], [[hw, 0, zb], [hw, 0, zf]], [[-hw, hgt, zb], [-hw, hgt, zf]], [[hw, hgt, zb], [hw, hgt, zf]]];
    for (const [a, b] of E) this.line(a, b, 0.8, 1);
    if (hole && win) {
      const [x0, y0, x1, y1] = win as [number, number, number, number];
      for (const [a, b] of [[[x0, y0, zb], [x1, y0, zb]], [[x1, y0, zb], [x1, y1, zb]], [[x1, y1, zb], [x0, y1, zb]], [[x0, y1, zb], [x0, y0, zb]]] as [V3, V3][]) this.line(a, b, 1, 1);
      if (solid) {
        this.occlude([0, y0 / 2, zb - 0.02], [hw, y0 / 2, 0.01]);
        this.occlude([0, (y1 + hgt) / 2, zb - 0.02], [hw, (hgt - y1) / 2, 0.01]);
        this.occlude([(-hw + x0) / 2, hgt / 2, zb - 0.02], [(x0 + hw) / 2, hgt / 2, 0.01]);
        this.occlude([(hw + x1) / 2, hgt / 2, zb - 0.02], [(hw - x1) / 2, hgt / 2, 0.01]);
      }
    }
  }

  /** A desk lamp: the base, the stem, the shade (a cone of points, open below), the bulb (one bright warm point). */
  private lamp(o: Extract<Part, { type: 'lamp' }>): void {
    const { at, h = 0.42, base = 0.075, shade = 0.11, shadeH = 0.12 } = o;
    const [x, y, z] = at;
    this.cyl({ type: 'cyl', c: [x, y + 0.008, z], r: base, h: 0.016, s: 0.012, extra: { warm: 0.4 } });
    this.thing({ type: 'thing', c: [x, y + h / 2, z], h: [0.011, h / 2, 0.011], edges: false, occlude: false, s: 0.011, base: 1.4, extra: { warm: 0.5 } });
    const top = y + h;
    const n = 18;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const r = 0.035 + (shade - 0.035) * t;
      const yy = top + shadeH * 0.3 - shadeH * t;
      const m = Math.max(10, Math.round((2 * Math.PI * r) / 0.009));
      for (let i = 0; i < m; i++) {
        const q = (i / m) * Math.PI * 2 + 0.3 * t;
        const px = x + r * Math.cos(q);
        const pz = z + r * Math.sin(q);
        this.push([px, yy, pz], [Math.cos(q), 0.3, Math.sin(q)], this.buildAt([px, yy, pz]), 1.3, 0, 0.0007, 0, { warm: 0.85 });
      }
    }
    for (let i = 0; i < 24; i++) {
      const q = (i / 24) * Math.PI * 2;
      this.line([x + shade * Math.cos(q), top - shadeH * 0.7, z + shade * Math.sin(q)], [x + shade * Math.cos(q + Math.PI / 12), top - shadeH * 0.7, z + shade * Math.sin(q + Math.PI / 12)], 0.9, 0);
    }
    this.push([x, top - 0.03, z], [0, -1, 0], this.buildAt(at), 4.5, 0, 0.03, 0, { warm: 1 });
  }

  /** A cylinder standing on its base: his mug, a lamp's base. */
  private cyl(o: Extract<Part, { type: 'cyl' }>): void {
    const { c, r, h, s = 0.008, lit = 0, extra = null, handle = false } = o;
    const [x, y, z] = c;
    const m = Math.max(12, Math.round((2 * Math.PI * r) / s));
    const rows = Math.max(2, Math.round(h / s));
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < m; i++) {
        const hh = hash22(i + 7, j + 3);
        const q = ((i + 0.6 * hh[0]) / m) * Math.PI * 2;
        const yy = y + (j + 0.5 + 0.4 * hh[1]) * (h / rows);
        const p: V3 = [x + r * Math.cos(q), yy, z + r * Math.sin(q)];
        this.push(p, [Math.cos(q), 0, Math.sin(q)], this.buildAt(p), 1, lit, 0.05 * s, 0, extra);
      }
    for (let i = 0; i < m; i++) {
      const q = (i / m) * Math.PI * 2;
      const p: V3 = [x + r * Math.cos(q), y + h, z + r * Math.sin(q)];
      this.push(p, [0, 1, 0], this.buildAt(p), 1.2, lit, 0.05 * s, 0, extra);
    }
    if (handle)
      for (let i = 0; i <= 10; i++) {
        const q = -Math.PI / 2 + (i / 10) * Math.PI;
        const p: V3 = [x + r + 0.028 + 0.028 * Math.cos(q), y + h / 2 + 0.03 * Math.sin(q), z];
        this.push(p, [0, 0, 1], this.buildAt(p), 1, lit, 0.05 * s, 0, extra);
      }
    this.occlude([x, y + h / 2, z], [r, h / 2, r]);
  }

  /** The far city at night: three rows of towers, each facade a grid of window points, a few lit. */
  private skyline(o: Extract<Part, { type: 'skyline' }>): void {
    const { lit = 0.42, accentLit = 0.1, night = true, zOff = 0, rise = 26 } = o;
    for (let layer = 0; layer < 3; layer++) {
      const z = -140 - layer * 120 + zOff;
      const w = 9 + 3 * layer;
      for (let cx = -14; cx <= 14; cx++) {
        const cxo = cx + Math.floor(hash11(layer));
        let hgt = rise - 45 + (10 + 40 * Math.pow(hash11(cxo * 1.7 + layer * 31), 2));
        if (hash11(cxo + 3.1 + layer) > 0.86) hgt += 45 * hash11(cxo + 8);
        const xl = (cxo - hash11(layer)) * w;
        const xr = xl + w;
        const sx = 1.7 + layer * 0.4;
        const sy = 2.2 + layer * 0.4;
        const y0 = rise - 120;
        for (let yy = y0; yy < hgt; yy += sy)
          for (let xx = xl; xx < xr - 0.5; xx += sx) {
            const on = hash12(Math.round(xx / sx) + layer * 9, Math.round(yy / sy)) > 1 - lit;
            const a = (0.12 + 0.88 * (on ? 1 : 0)) / (1 + layer * 0.7);
            const isAcc = on && hash12(Math.round(xx / sx) + 5, Math.round(yy / sy) + 5) > 1 - accentLit;
            this.push([xx + sx / 2, yy + sy / 2, z], [0, 0, 1], 0, night ? a * 0.9 : a * 0.5, isAcc ? 1 : 0, 0, 1, { warm: on ? 0.35 : 0 });
          }
        this.lns.pos.push(xl + this.off[0], hgt + this.off[1], z + this.off[2], xr + this.off[0], hgt + this.off[1], z + this.off[2], xl + this.off[0], y0 + this.off[1], z + this.off[2], xl + this.off[0], hgt + this.off[1], z + this.off[2]);
        this.lns.order.push(0, 0, 0, 0);
        this.lns.li.push(0.8, 0.8, 0.25, 0.25);
        this.lns.wall.push(0, 0, 0, 0);
      }
    }
    this.push([-22, 38 + rise, -300], [0, 0, 1], 0, 2.5, 0, 0, 1);
    this.push([30, 52 + rise, -300], [0, 0, 1], 0, 2.5, 0, 0, 1);
  }

  /** A hairline box: the Machine's guess of a building it has not been inside. */
  private lineBox(c: V3, h: V3, li = 0.6, wall = 1): void {
    const X = [c[0] - h[0], c[0] + h[0]];
    const Y = [c[1] - h[1], c[1] + h[1]];
    const Z = [c[2] - h[2], c[2] + h[2]];
    const P = (i: number): V3 => [X[i & 1]!, Y[(i >> 1) & 1]!, Z[(i >> 2) & 1]!];
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.line(P(a!), P(b!), li, wall);
  }

  /** His house round the room (metres): the outer walls and the roof's ridge as hairlines; the Machine has only been inside one room. */
  private house(o: Extract<Part, { type: 'house' }>): void {
    const { hw = 4.4, depth = [-2.5, 5.6], hgt = 5.6, ridge = 7.6 } = o;
    const [zb, zf] = depth;
    this.lineBox([0, hgt / 2, (zb + zf) / 2], [hw, hgt / 2, (zf - zb) / 2], 0.7, 1);
    for (const z of [zb, zf]) {
      this.line([-hw, hgt, z], [0, ridge, z], 0.7, 1);
      this.line([hw, hgt, z], [0, ridge, z], 0.7, 1);
    }
    this.line([0, ridge, zb], [0, ridge, zf], 0.7, 1);
    this.lineBox([2.6, 1.05, zb], [0.5, 1.05, 0.02], 0.6, 1);
  }

  /** The street in front of his house (metres): the kerbs, the lamps (warm points on poles), the houses across the way with a few lit windows. */
  private street(o: Extract<Part, { type: 'street' }>): void {
    const { z0 = -6, z1 = -13, x0 = -70, x1 = 70, lamps = 12, lampH = 5.2, houses = true, hx = 45, hstep = 9.5, hw = 3.8, hz = 4.2, hgt = 5.4, roof = 1.8, win = [[-2, 1.6], [2, 1.6], [-2, 4], [2, 4]], winS = [0.5, 0.6], winSp = 0.18 } = o;
    for (const z of [z0, z1]) this.line([x0, 0, z], [x1, 0, z], 0.5, 1);
    for (let x = x0; x < x1; x += 4) this.line([x, 0, (z0 + z1) / 2], [x + 1.6, 0, (z0 + z1) / 2], 0.35, 1);
    for (let x = x0 + 2; x <= x1; x += lamps) {
      const side = Math.round(x / lamps) % 2 ? z0 + 0.6 : z1 - 0.6;
      this.line([x, 0, side], [x, lampH, side], 0.5, 0);
      this.push([x, lampH + 0.1, side], [0, -1, 0], 0, 5.5, 0, 0.05, 0, { warm: 1 });
      for (let k = 0; k < 14; k++) {
        const q = (k / 14) * Math.PI * 2;
        const p: V3 = [x + 0.42 * lampH * Math.cos(q), 0.02, side + 0.3 * lampH * Math.sin(q)];
        this.push(p, [0, 1, 0], 0, 0.9, 0, 0.02, 0, { warm: 0.9 });
      }
    }
    this.face([0, 0, z0 + 1.2], [0, 1, 0], [1, 0, 0], [0, 0, 1], (x1 - x0) / 2, 1.2, 0.9, { base: 0.25, rad: 0.02 });
    if (houses)
      for (let x = -hx; x <= hx; x += hstep) {
        const h = hgt + 0.3 * hgt * hash11(x * 0.37);
        const zc = z1 - hz - 1.3;
        this.lineBox([x, h / 2, zc], [hw, h / 2, hz], 0.3, 1);
        this.line([x - hw, h, zc + hz], [x, h + roof, zc + hz], 0.3, 1);
        this.line([x + hw, h, zc + hz], [x, h + roof, zc + hz], 0.3, 1);
        for (const [wx, wy] of win) if (hash12(x + wx, wy) > 0.5) this.face([x + wx, wy, zc + hz + 0.02], [0, 0, 1], [1, 0, 0], [0, 1, 0], winS[0], winS[1], winSp, { base: 0.9, rad: 0.05, extra: { warm: 0.8 } });
      }
  }

  /** The city (the world from above): hairline blocks on a street grid, each facade a few lit windows, the towers round the station tallest; k scales every length (the Machine's 1:6 miniature). `every`: the lean world lights one block in `every` (the far towers alone keep their windows). */
  private town(o: Extract<Part, { type: 'town' }>): void {
    const { z0 = -40, z1 = -480, x0 = -300, x1 = 300, pitch = 28, centre = [30, 0, -250] as V3, lit = 0.3, k = 1, tower = 80, edgeFade = 0, camZ = 0, every = 1 } = o;
    let n = 0;
    for (let z = z0; z > z1; z -= pitch)
      for (let x = x0; x < x1; x += pitch) {
        const i = Math.round(x / pitch);
        const j = Math.round(z / pitch);
        const dC = Math.hypot(x - centre[0], z - centre[2]);
        const near = Math.exp(-(dC * dC) / (2 * (70 * k) * (70 * k)));
        let hgt = (6 + 10 * Math.pow(hash12(i, j), 2) + tower * near * Math.pow(hash12(i + 7, j + 7), 2.5)) * k;
        if (hash12(i + 3, j + 5) > 0.93) hgt += 18 * k * hash11(i * 3.1 + j);
        const w = (8 + 4 * hash12(i + 1, j + 2)) * k;
        const d = (8 + 4 * hash12(i + 2, j + 1)) * k;
        const cx = x + pitch / 2 + 3 * k * (hash12(i, j + 9) - 0.5);
        const cz = z - pitch / 2 + 3 * k * (hash12(i + 9, j) - 0.5);
        const far = edgeFade ? Math.exp(-Math.max(camZ - cz, 0) / edgeFade) : 1;
        if (far > 0.08) this.lineBox([cx, hgt / 2, cz], [w, hgt / 2, d], (0.55 + 0.3 * near) * far, 1);
        // (the lean world: the windows of one block in `every`, the towers always)
        if (every > 1 && n++ % every && near < 0.5) continue;
        const sy = 3.2 * k;
        const sx = 3.0 * k;
        for (let yy = 1.6 * k; yy < hgt; yy += sy) {
          for (let xx = -w + 1.5 * k; xx < w; xx += sx) {
            const on = hash12(Math.round((cx + xx) / sx) + j * 9, Math.round(yy / sy) + i) > 1 - lit;
            if (!on) continue;
            this.push([cx + xx, yy, cz + d], [0, 0, 1], 0, 1.3, hash12(xx + i, yy + j) > 0.9 ? 1 : 0, 0, 0, { warm: 0.45 });
          }
          const sideX = cx > 0 ? cx - w : cx + w;
          for (let zz = -d + 1.5 * k; zz < d; zz += sx) {
            const on = hash12(Math.round((cz + zz) / sx) + i * 7, Math.round(yy / sy) + j * 3) > 1 - lit * 0.8;
            if (!on) continue;
            this.push([sideX, yy, cz + zz], [cx > 0 ? -1 : 1, 0, 0], 0, 1.0, 0, 0, 0, { warm: 0.45 });
          }
        }
      }
    this.face([(x0 + x1) / 2, 0, (z0 + z1) / 2], [0, 1, 0], [1, 0, 0], [0, 0, 1], (x1 - x0) / 2, (z0 - z1) / 2, 1.5, { base: 0.18, rad: 0.01, pat: (u, v) => (Math.abs(fract((u + 3000) / pitch) - 0.5) < 0.05 || Math.abs(fract((v + 3000) / pitch) - 0.5) < 0.05 ? 1 : 0) });
  }

  /** Aircraft over the city: each a bright point with a short trail behind it, on its heading (no trail with step 0: the lean world's three points). */
  private aircraft(o: Extract<Part, { type: 'aircraft' }>): void {
    const { list, step = 5 } = o;
    for (const [x, y, z, dx, dz] of list) {
      this.push([x, y, z], [0, -1, 0], 0, 5, 1, 0.08, 0);
      if (step > 0) for (let k = 1; k < 9; k++) this.push([x - dx * k * step, y, z - dz * k * step], [0, -1, 0], 0, 1.4 - k * 0.15, 1, 0.03, 0);
    }
  }

  /** A ring of points on the ground: him on the walk (OUT), a stop on the line. */
  private ring(o: Extract<Part, { type: 'ring' }>): void {
    const { c, r, lit = 1, a = 1.6, n = 48 } = o;
    for (let k = 0; k < n; k++) {
      const q = (k / n) * Math.PI * 2;
      this.push([c[0] + r * Math.cos(q), c[1], c[2] + r * Math.sin(q)], [0, 1, 0], 0, a, lit, 0.06 * r);
    }
    this.push([c[0], c[1] + 0.02, c[2]], [0, 1, 0], 0, 2.6, lit, 0.2 * r);
  }

  /** A line of points from one place to another (the train line through the city; the trail behind the train), the head a bright point. */
  private trail(o: Extract<Part, { type: 'trail' }>): void {
    const { from, to, step = 0.4, a = 1.2, lit = 1, head = false, rad = 0.1 } = o;
    const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p: V3 = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
      this.push(p, [0, 1, 0], 0, head ? a * (0.3 + 0.7 * t) : a, lit, head ? rad * (0.6 + 1.4 * t) : rad);
    }
    if (head) this.push(to, [0, 1, 0], 0, 3.4, lit, rad * 4);
  }

  /** three.js takes the buffers (once per build), in the renderer it is given. */
  private take(T: Any): void {
    const P = this.pts;
    const L = this.lns;
    if (!this.gl) {
      const u: Record<string, { value: Any }> = { ...this.u, uOrbPos: { value: new T.Vector3(0, -9, 0) }, uBone: { value: new T.Color(1, 1, 1) }, uAccent: { value: new T.Color(0.4, 0.8, 1) }, uAccentMix: { value: new T.Color(0.6, 0.9, 1) }, uTint: { value: new T.Color(1, 1, 1) }, uTintFar: { value: new T.Color(1, 1, 1) }, uWarm: { value: new T.Color(1.06, 0.86, 0.6) }, uCool: { value: new T.Color(0.78, 0.88, 1.04) } };
      this.gl = { T, scene: new T.Scene(), camera: new T.PerspectiveCamera(60, 440 / 956, 0.05, 1500), u, points: null, lines: null };
    }
    const { scene, u } = this.gl;
    u.uOrbPos!.value.set(this.orbAt.c[0], this.orbAt.c[1], this.orbAt.c[2]);
    u.uTint!.value.setRGB(...this.light.tint);
    u.uTintFar!.value.setRGB(...(this.light.tintFar ?? this.light.tint));
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(P.nrm, 3));
    for (const [k, a] of [['aOrder', P.order], ['aAmb', P.amb], ['aOrb', P.orb], ['aPat', P.pat], ['aLit', P.lit], ['aRad', P.rad], ['aSeed', P.seed], ['aFar', P.far], ['aWarm', P.warm], ['aCool', P.cool], ['aShow', P.show]] as [string, number[]][]) g.setAttribute(k, new T.Float32BufferAttribute(a, 1));
    const blend = { transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor };
    const pm = new T.ShaderMaterial({ uniforms: u, vertexShader: POINT_VS, fragmentShader: POINT_FS, ...blend });
    const points = new T.Points(g, pm);
    points.frustumCulled = false;
    points.renderOrder = 2;
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(L.pos, 3));
    lg.setAttribute('aOrder', new T.Float32BufferAttribute(L.order, 1));
    lg.setAttribute('aLi', new T.Float32BufferAttribute(L.li, 1));
    lg.setAttribute('aWall', new T.Float32BufferAttribute(L.wall, 1));
    const lm = new T.ShaderMaterial({ uniforms: u, vertexShader: LINE_VS, fragmentShader: LINE_FS, ...blend });
    const lines = new T.LineSegments(lg, lm);
    lines.frustumCulled = false;
    lines.renderOrder = 1;
    const om = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
    const occ = new T.Group();
    for (const o of this.occ) {
      const m = new T.Mesh(new T.BoxGeometry(o.h[0] * 2, o.h[1] * 2, o.h[2] * 2), om);
      m.position.set(o.c[0], o.c[1], o.c[2]);
      occ.add(m);
    }
    occ.renderOrder = 0;
    scene.add(occ, lines, points);
    this.gl.points = points;
    this.gl.lines = lines;
    // the buffers are three.js's now: the arrays go (the scene holds 72,000 points once, not twice)
    this.pts = { pos: [], nrm: [], order: [], amb: [], orb: [], pat: [], lit: [], rad: [], seed: [], far: [], warm: [], cool: [], show: [] };
    this.lns = { pos: [], order: [], li: [], wall: [] };
  }

  /** The system's own colours from the page's tokens (bone, the accent, its pale, amber for the lamp's warmth), read on each draw's first frame and when the theme changes. */
  readTokens(): void {
    if (!this.gl) return;
    const T = this.gl.T;
    const cs = getComputedStyle(document.documentElement);
    const rgb = (n: string, fb: number) => {
      const m = cs.getPropertyValue(n).match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      return m ? new T.Color(+m[1]! / 255, +m[2]! / 255, +m[3]! / 255) : new T.Color(fb);
    };
    const bone = rgb('--g-room-points-rgb', 0xece8df);
    const acc = rgb('--g-accent-rgb', 0x64d2ff);
    const pale = rgb('--g-accent-pale-rgb', 0xbff0ff);
    const amber = rgb('--g-amber-rgb', 0xffb340);
    const u = this.gl.u;
    u.uBone!.value.copy(bone);
    u.uAccent!.value.copy(acc);
    u.uAccentMix!.value.copy(acc).lerp(pale, 0.35);
    u.uWarm!.value.set(0.55 + 0.5 * amber.r, 0.55 + 0.5 * amber.g, 0.55 + 0.5 * amber.b).multiplyScalar(1.1);
    u.uCool!.value.set(0.6 + 0.4 * pale.r, 0.6 + 0.4 * pale.g, 0.6 + 0.4 * pale.b).multiplyScalar(1.04);
  }

  /** Whether three.js holds the scene (it has been drawn at least once). */
  get drawn(): boolean {
    return !!this.gl?.points;
  }

  /** Draw one frame into `renderer` (Mind's) from `pose` on a W × H viewport at `dpr`, with the uniforms of this moment. */
  render(T: Any, renderer: Any, pose: CamPose, W: number, H: number, dpr: number, u: Uniforms = {}): void {
    if (!this.gl || !this.gl.points) {
      this.take(T);
      this.readTokens();
    }
    const G = this.gl!;
    this.cam.set(pose, W, H);
    for (const [k, v] of Object.entries(u)) if (G.u[k] && v !== undefined) G.u[k]!.value = v;
    if (u.far !== undefined) {
      const far = this.light.tintFar ?? this.light.tint;
      G.u.uTintFar!.value.setRGB(far[0] * u.far, far[1] * u.far, far[2] * u.far);
    }
    G.u.uScale!.value = H * this.cam.focal;
    G.u.uDpr!.value = dpr;
    const c = G.camera;
    c.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    c.up.set(0, 1, 0);
    c.lookAt(pose.tgt[0], pose.tgt[1], pose.tgt[2]);
    c.fov = pose.fov;
    c.aspect = W / H;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    renderer.render(G.scene, c);
  }
}
