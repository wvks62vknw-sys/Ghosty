/**
 * What the two games made by us share: three.js loaded from this site only when a game starts (the vendored build the
 * 3D studio uses, public/vendor/three, never bundled: hand-written types for exactly what the games call), a small
 * geometry builder (coloured boxes and cylinders merged into one mesh, so a whole street is one draw call), the flat
 * shader (flat colours, a soft sun and sky light, fog), the sky (a gradient with a sun, a moon and stars), the frame
 * clock with its statistics and the resolution it holds 60 fps at, and the overlay's pieces (menus at 44 pt, Ghosty's
 * line, haptics). Our own look only: no textures, no fonts, no art of anyone else's.
 */
import { h } from '../../core/dom';
import type { Engine } from '../engines/types';
import { type Intent, touchMove } from '../input';

// ---------------------------------------------------------------- the games' ids and engine shape

export type GameId = 'voxel' | 'runner';
/** The three that followed (BRIEF-GAMES-3): the kart racer, the hopper and the arena (the merge adds them to Engine's id too). */
export type Game3Id = 'kart' | 'hopper' | 'arena';
/** An Engine whose id is one of ours (the merge adds 'voxel' | 'runner', then Game3Id, to Engine's id). */
export interface GameEngine<I extends string = GameId> extends Omit<Engine, 'id'> {
  id: I;
}

// ---------------------------------------------------------------- three.js, typed for what we use

export interface V3 {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): V3;
}
export interface Col {
  r: number;
  g: number;
  b: number;
  setRGB(r: number, g: number, b: number): Col;
}
export interface Attr {
  count: number;
  needsUpdate: boolean;
  setUsage(u: number): Attr;
}
export interface Geom {
  setAttribute(name: string, a: Attr): Geom;
  setIndex(a: Attr | null): Geom;
  computeBoundingSphere(): void;
  dispose(): void;
}
export interface Mat {
  dispose(): void;
  uniforms: Record<string, { value: unknown }>;
}
export interface Obj3 {
  position: V3;
  rotation: V3;
  scale: V3;
  visible: boolean;
  frustumCulled: boolean;
  renderOrder: number;
  matrix: unknown;
  children: Obj3[];
  add(...o: Obj3[]): void;
  remove(...o: Obj3[]): void;
  updateMatrix(): void;
  lookAt(x: number, y: number, z: number): void;
}
export interface Mesh extends Obj3 {
  geometry: Geom;
  material: Mat;
}
export interface IMesh extends Mesh {
  count: number;
  instanceMatrix: Attr;
  instanceColor: Attr | null;
  setMatrixAt(i: number, m: unknown): void;
  setColorAt(i: number, c: Col): void;
}
export interface Cam extends Obj3 {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  updateProjectionMatrix(): void;
}
export interface Renderer {
  setPixelRatio(r: number): void;
  setSize(w: number, h: number, style?: boolean): void;
  render(scene: Obj3, cam: Cam): void;
  dispose(): void;
  forceContextLoss(): void;
  info: { render: { calls: number; triangles: number } };
}
type TArr = Float32Array | Uint8Array | Uint16Array | Uint32Array;
interface ShaderOpts {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
  transparent?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  side?: number;
  blending?: number;
}
export interface ThreeNS {
  WebGLRenderer: new (o: { canvas: HTMLCanvasElement; antialias?: boolean; alpha?: boolean; powerPreference?: string; stencil?: boolean }) => Renderer;
  Scene: new () => Obj3;
  Group: new () => Obj3;
  Object3D: new () => Obj3;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => Cam;
  Mesh: new (g: Geom, m: Mat) => Mesh;
  InstancedMesh: new (g: Geom, m: Mat, n: number) => IMesh;
  LineSegments: new (g: Geom, m: Mat) => Mesh;
  BufferGeometry: new () => Geom;
  BufferAttribute: new (a: TArr, size: number, normalized?: boolean) => Attr;
  ShaderMaterial: new (o: ShaderOpts) => Mat;
  LineBasicMaterial: new (o: { color: number; transparent?: boolean; opacity?: number; depthTest?: boolean }) => Mat;
  Color: new (c?: number) => Col;
  BackSide: number;
  DoubleSide: number;
  DynamicDrawUsage: number;
  AdditiveBlending: number;
}

let lib: Promise<ThreeNS> | null = null;
/** three.js, from this site, the first time a game starts (the same file, and so the same module, as the studio's). */
export function loadThree(): Promise<ThreeNS> {
  lib ??= (async () => {
    // a plain string, so neither the bundler nor the type checker follows it (the types are above)
    const url: string = '/vendor/three/three.module.min.js';
    const T = (await import(url)) as ThreeNS;
    if (typeof T.WebGLRenderer !== 'function') throw new Error('three.js did not load');
    return T;
  })();
  lib.catch(() => (lib = null));
  return lib;
}

/** A renderer on the player's canvas: no antialiasing (blocks and flat colours do not need it at a phone's density). */
export function makeRenderer(T: ThreeNS, canvas: HTMLCanvasElement): Renderer {
  return new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
}

// ---------------------------------------------------------------- the geometry builder

/** sRGB hex → 0…255 channels. */
export const rgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/**
 * Coloured shapes merged into one indexed geometry: positions, normals and a colour per vertex whose alpha says how
 * much it glows (0: lit by the sun and sky; 255: its own light, for windows, lamps and coins).
 */
export class Geo {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  private quad(p: number[][], n: [number, number, number], c: [number, number, number], glow: number) {
    const b = this.pos.length / 3;
    for (const v of p) {
      this.pos.push(v[0]!, v[1]!, v[2]!);
      this.nor.push(...n);
      this.col.push(c[0], c[1], c[2], glow);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  /** An axis-aligned box from its centre and size; `faces` leaves faces out (a bitmask: 1 +x, 2 −x, 4 +y, 8 −y, 16 +z, 32 −z). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: number, glow = 0, skip = 0): this {
    const c = rgb(hex);
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    if (!(skip & 1)) this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], c, glow);
    if (!(skip & 2)) this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], c, glow);
    if (!(skip & 4)) this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], c, glow);
    if (!(skip & 8)) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], c, glow);
    if (!(skip & 16)) this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], c, glow);
    if (!(skip & 32)) this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], c, glow);
    return this;
  }
  /** An upright cylinder (n sides) from its centre, radius and height; `axis` 'z' lays it along z, 'x' along x. */
  cyl(cx: number, cy: number, cz: number, r: number, hgt: number, hex: number, n = 12, glow = 0, axis: 'y' | 'z' | 'x' = 'y'): this {
    const c = rgb(hex);
    const map = (x: number, y: number, z: number): number[] => (axis === 'y' ? [cx + x, cy + y, cz + z] : axis === 'z' ? [cx + x, cy + z, cz + y] : [cx + y, cy + x, cz + z]);
    const mapN = (x: number, y: number, z: number): [number, number, number] => (axis === 'y' ? [x, y, z] : axis === 'z' ? [x, z, y] : [y, x, z]);
    const y0 = -hgt / 2, y1 = hgt / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const [s0, c0, s1, c1] = [Math.sin(a0) * r, Math.cos(a0) * r, Math.sin(a1) * r, Math.cos(a1) * r];
      this.quad([map(s0, y0, c0), map(s1, y0, c1), map(s1, y1, c1), map(s0, y1, c0)], mapN(Math.sin(am), 0, Math.cos(am)), c, glow);
      // the caps as thin fans of quads (a degenerate fourth corner at the centre)
      this.quad([map(0, y1, 0), map(s0, y1, c0), map(s1, y1, c1), map(0, y1, 0)], mapN(0, 1, 0), c, glow);
      this.quad([map(0, y0, 0), map(s1, y0, c1), map(s0, y0, c0), map(0, y0, 0)], mapN(0, -1, 0), c, glow);
    }
    return this;
  }
  /** A quad whose front faces `out` (the corners in either order). */
  private face(p: number[][], out: [number, number, number], c: [number, number, number], glow: number) {
    // the normal from the diagonals (it holds when a corner collapses, as at a ball's poles)
    const [a, b, cc, d] = [p[0]!, p[1]!, p[2]!, p[3]!];
    const e1 = [cc[0]! - a[0]!, cc[1]! - a[1]!, cc[2]! - a[2]!], e2 = [d[0]! - b[0]!, d[1]! - b[1]!, d[2]! - b[2]!];
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const flip = n[0]! * out[0] + n[1]! * out[1] + n[2]! * out[2] < 0;
    const l = Math.hypot(...out) || 1;
    this.quad(flip ? [p[0]!, p[3]!, p[2]!, p[1]!] : p, [out[0] / l, out[1] / l, out[2] / l], c, glow);
  }
  /** A square bar of width `w` from one point to another (a cable, a girder, a slanted strut). */
  beam(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, hex: number, glow = 0): this {
    const c = rgb(hex);
    const d = [x1 - x0, y1 - y0, z1 - z0];
    const L = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
    const a = d.map((v) => v / L) as [number, number, number];
    const ref = Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [a[1] * ref[2]! - a[2] * ref[1]!, a[2] * ref[0]! - a[0] * ref[2]!, a[0] * ref[1]! - a[1] * ref[0]!];
    const ul = Math.hypot(u[0]!, u[1]!, u[2]!);
    u = u.map((v) => v / ul);
    const v = [a[1] * u[2]! - a[2] * u[1]!, a[2] * u[0]! - a[0] * u[2]!, a[0] * u[1]! - a[1] * u[0]!];
    const h = w / 2;
    const corner = (end: number[], su: number, sv: number) => [end[0]! + (u[0]! * su + v[0]! * sv) * h, end[1]! + (u[1]! * su + v[1]! * sv) * h, end[2]! + (u[2]! * su + v[2]! * sv) * h];
    const p0 = [x0, y0, z0], p1 = [x1, y1, z1];
    const sides: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let i = 0; i < 4; i++) {
      const [su, sv] = sides[i]!, [tu, tv] = sides[(i + 1) % 4]!;
      const out: [number, number, number] = [u[0]! * (su + tu) + v[0]! * (sv + tv), u[1]! * (su + tu) + v[1]! * (sv + tv), u[2]! * (su + tu) + v[2]! * (sv + tv)];
      this.face([corner(p0, su, sv), corner(p0, tu, tv), corner(p1, tu, tv), corner(p1, su, sv)], out, c, glow);
    }
    this.face(sides.map(([su, sv]) => corner(p1, su, sv)), a, c, glow);
    this.face(sides.map(([su, sv]) => corner(p0, su, sv)), [-a[0], -a[1], -a[2]], c, glow);
    return this;
  }
  /** A faceted ball (each face shaded flat: the low-poly look), squashed by `sy`. */
  ball(cx: number, cy: number, cz: number, r: number, hex: number, seg = 10, glow = 0, sy = 1): this {
    const c = rgb(hex);
    const rows = Math.max(3, Math.round(seg * 0.6));
    const pt = (i: number, j: number) => {
      const th = (j / rows) * Math.PI, ph = (i / seg) * Math.PI * 2;
      return [cx + Math.sin(th) * Math.sin(ph) * r, cy + Math.cos(th) * r * sy, cz + Math.sin(th) * Math.cos(ph) * r];
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < seg; i++) {
        const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
        const m = q.reduce((s, p) => [s[0]! + p[0]! - cx, s[1]! + p[1]! - cy, s[2]! + p[2]! - cz], [0, 0, 0]);
        this.face(q, [m[0]!, m[1]!, m[2]!], c, glow);
      }
    }
    return this;
  }
  /** A quad from four corners in order round it, its front facing `out` (give the true normal: it lights the face). */
  quad4(p: number[][], out: [number, number, number], hex: number, glow = 0): this {
    this.face(p, out, rgb(hex), glow);
    return this;
  }
  /** An upright cone (or, with `top`, a frustum) of n sides standing on the centre of its base at height y0. */
  cone(cx: number, y0: number, cz: number, r: number, hgt: number, hex: number, n = 8, glow = 0, top = 0): this {
    const c = rgb(hex);
    const slope = (r - top) / hgt;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const b0 = [cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r], b1 = [cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r];
      const t0 = [cx + Math.sin(a0) * top, y0 + hgt, cz + Math.cos(a0) * top], t1 = [cx + Math.sin(a1) * top, y0 + hgt, cz + Math.cos(a1) * top];
      this.face([b0, b1, t1, t0], [Math.sin(am), slope, Math.cos(am)], c, glow);
      this.face([[cx, y0, cz], b1, b0, [cx, y0, cz]], [0, -1, 0], c, glow);
      if (top > 0) this.face([[cx, y0 + hgt, cz], t0, t1, [cx, y0 + hgt, cz]], [0, 1, 0], c, glow);
    }
    return this;
  }
  get empty(): boolean {
    return this.idx.length === 0;
  }
  build(T: ThreeNS): Geom {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aCol', new T.BufferAttribute(new Uint8Array(this.col), 4, true));
    const n = this.pos.length / 3;
    g.setIndex(new T.BufferAttribute(n < 65536 ? new Uint16Array(this.idx) : new Uint32Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- the flat shader and the sky

export interface Light {
  /** Towards the sun (world, unit). */
  sun: [number, number, number];
  /** The light's colour and strength (1,1,1 at noon). */
  tint: [number, number, number];
  fog: [number, number, number];
  fogNear: number;
  fogFar: number;
  /** A soft second light (from behind the camera, say), so faces turned from the sun are not flat grey. */
  fill?: [number, number, number];
}

const FLAT_V = `
attribute vec4 aCol;
uniform vec3 uSun;
uniform vec3 uFill;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vCol;
varying float vShade;
varying float vFog;
void main() {
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  n = mat3(instanceMatrix) * n;
  #endif
  wp = modelMatrix * wp;
  n = normalize(mat3(modelMatrix) * n);
  vec3 c = aCol.rgb;
  #ifdef USE_INSTANCING_COLOR
  c *= instanceColor;
  #endif
  float lit = 0.62 + 0.18 * n.y + 0.38 * max(dot(n, uSun), 0.0) + 0.26 * max(dot(n, uFill), 0.0);
  vShade = mix(lit, 1.6, aCol.a);
  vCol = c;
  vec4 mv = viewMatrix * wp;
  vFog = smoothstep(uFogNear, uFogFar, length(mv.xyz));
  gl_Position = projectionMatrix * mv;
}`;
const FLAT_F = `
uniform vec3 uTint;
uniform vec3 uFogColor;
uniform float uAlpha;
varying vec3 vCol;
varying float vShade;
varying float vFog;
void main() {
  vec3 c = vCol * vShade * uTint;
  gl_FragColor = vec4(mix(c, uFogColor, vFog), uAlpha);
}`;

/** The flat material: one per look (opaque, see-through, glowing); its light is set each frame by `setLight`. */
export function flatMaterial(T: ThreeNS, o: { alpha?: number; additive?: boolean; side?: number } = {}): Mat {
  const a = o.alpha ?? 1;
  return new T.ShaderMaterial({
    vertexShader: FLAT_V,
    fragmentShader: FLAT_F,
    uniforms: {
      uSun: { value: [0.4, 0.8, 0.3] },
      uFill: { value: [0, 0, 0] },
      uTint: { value: [1, 1, 1] },
      uFogColor: { value: [0.6, 0.7, 0.9] },
      uFogNear: { value: 40 },
      uFogFar: { value: 120 },
      uAlpha: { value: a },
    },
    transparent: a < 1 || !!o.additive,
    depthWrite: a >= 1 && !o.additive,
    ...(o.additive ? { blending: T.AdditiveBlending } : {}),
    ...(o.side !== undefined ? { side: o.side } : {}),
  });
}

/** Sets a material's light from the scene's light (the shader reads plain arrays as vec3). */
export function setLight(m: Mat, l: Light): void {
  const u = m.uniforms;
  if (u.uSun) u.uSun.value = l.sun;
  if (u.uFill && l.fill) u.uFill.value = l.fill;
  if (u.uTint) u.uTint.value = l.tint;
  if (u.uFogColor) u.uFogColor.value = l.fog;
  if (u.uFogNear) u.uFogNear.value = l.fogNear;
  if (u.uFogFar) u.uFogFar.value = l.fogFar;
}

const SKY_V = `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SKY_F = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uMoonDir;
uniform float uStars;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(clamp(y, 0.0, 1.0), 0.5)) : mix(uHorizon, uBottom, clamp(-y * 4.0, 0.0, 1.0));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (smoothstep(0.9985, 0.9992, s) * 1.6 + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.08);
  float m = max(dot(d, uMoonDir), 0.0);
  c = mix(c, vec3(0.86, 0.9, 1.0), smoothstep(0.99935, 0.9996, m) * uStars);
  if (uStars > 0.01 && y > 0.02) {
    vec3 q = floor(d * 150.0);
    c += vec3(step(0.9972, hash(q)) * uStars * smoothstep(0.02, 0.3, y));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export interface SkyColours {
  top: [number, number, number];
  horizon: [number, number, number];
  bottom: [number, number, number];
  sunCol: [number, number, number];
  sunDir: [number, number, number];
  moonDir: [number, number, number];
  stars: number;
}

/** The sky: a big box round the camera (it follows the camera), drawn first and behind everything. */
export function makeSky(T: ThreeNS): Mesh {
  const g = new Geo().box(0, 0, 0, 2, 2, 2, 0xffffff).build(T);
  const m = new T.ShaderMaterial({
    vertexShader: SKY_V,
    fragmentShader: SKY_F,
    uniforms: {
      uTop: { value: [0.2, 0.4, 0.8] },
      uHorizon: { value: [0.7, 0.8, 0.9] },
      uBottom: { value: [0.3, 0.35, 0.4] },
      uSunDir: { value: [0, 0.5, -1] },
      uSunCol: { value: [1, 0.9, 0.7] },
      uMoonDir: { value: [0, -1, 0] },
      uStars: { value: 0 },
    },
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new T.Mesh(g, m);
  mesh.scale.set(250, 250, 250); // its corners (433 away) stay inside the cameras' far plane (500): no black corners
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function setSky(sky: Mesh, c: SkyColours): void {
  const u = sky.material.uniforms;
  u.uTop!.value = c.top;
  u.uHorizon!.value = c.horizon;
  u.uBottom!.value = c.bottom;
  u.uSunCol!.value = c.sunCol;
  u.uSunDir!.value = c.sunDir;
  u.uMoonDir!.value = c.moonDir;
  u.uStars!.value = c.stars;
}

export const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
export const hex3 = (hex: number): [number, number, number] => rgb(hex).map((v) => v / 255) as [number, number, number];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Every geometry and material under `root`, let go (the canvas's memory comes back on quit). */
export function disposeAll(root: Obj3): void {
  const seen = new Set<unknown>();
  const walk = (o: Obj3) => {
    const m = o as Partial<Mesh>;
    if (m.geometry && !seen.has(m.geometry)) seen.add(m.geometry), m.geometry.dispose();
    if (m.material && !seen.has(m.material)) seen.add(m.material), m.material.dispose();
    for (const c of o.children) walk(c);
  };
  walk(root);
}

// ---------------------------------------------------------------- the clock: frame times, first frame, held resolution

/** The last 240 frames' times: what the harness prints and what the resolution follows. */
export class FrameStats {
  private ring = new Float32Array(240);
  private work = new Float32Array(240);
  private n = 0;
  frames = 0;
  push(intervalMs: number, workMs: number): void {
    this.ring[this.n % 240] = intervalMs;
    this.work[this.n % 240] = workMs;
    this.n++;
  }
  private pct(a: Float32Array, p: number, last = 240): number {
    const k = Math.min(this.n, 240, last);
    if (!k) return 0;
    const v: number[] = [];
    for (let i = 0; i < k; i++) v.push(a[(this.n - 1 - i + 2400) % 240]!);
    v.sort((x, y) => x - y);
    return v[Math.min(k - 1, Math.floor(p * k))]!;
  }
  /** The p-th percentile of the frame interval (ms) over the last `last` frames. */
  interval(p: number, last = 240): number {
    return this.pct(this.ring, p, last);
  }
  /** The p-th percentile of our own work per frame (ms): the update and the draw call's submission. */
  workMs(p: number): number {
    return this.pct(this.work, p);
  }
  get count(): number {
    return Math.min(this.n, 240);
  }
  /** Start the window afresh (the harness measures a stretch of play on its own). */
  reset(): void {
    this.n = 0;
  }
}

/**
 * The drawing resolution, held where frames come every 16.7 ms: it starts at the screen's own density (no more than
 * 2×: at 3× the extra pixels cost more than twice the work and no eye sees them on a moving scene), drops a step when
 * the slowest tenth of frames run long, and climbs back a step after a long calm.
 */
export class Resolution {
  scale: number;
  private calm = 0;
  private since = 0;
  constructor(readonly max = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)), readonly min = 1) {
    this.scale = max;
  }
  /** Called once a frame; says when the scale changed. */
  check(stats: FrameStats): boolean {
    if (++this.since < 90 || stats.count < 90) return false;
    this.since = 0;
    const p90 = stats.interval(0.9, 90);
    if (p90 > 21 && this.scale > this.min) {
      this.scale = Math.max(this.min, this.scale - 0.25);
      this.calm = -6; // after a drop, wait longer before trying again
      return true;
    }
    if (p90 < 17.5 && this.scale < this.max && ++this.calm >= 4) {
      this.scale = Math.min(this.max, this.scale + 0.25);
      this.calm = 0;
      return true;
    }
    return false;
  }
}

/** A frame loop that can stop and start without a jump in time. */
export class Loop {
  private raf = 0;
  private last = 0;
  running = false;
  stats = new FrameStats();
  constructor(private frame: (dt: number) => void) {}
  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    // a slow frame still moves the game on by the time it took (each game steps its rules in small steps), up to ¼ s
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 1 / 60;
    const interval = this.last ? now - this.last : 0;
    this.last = now;
    const t0 = performance.now();
    this.frame(dt);
    this.stats.frames++;
    if (interval) this.stats.push(interval, performance.now() - t0);
  };
}

/** What a game's handle tells the harness (and a curious player) about itself. */
export interface GameStats {
  /** Frames drawn since start. */
  frames: number;
  /** ms from start() to the first frame on the screen (null until then). */
  firstFrameMs: number | null;
  /** The frame interval's 50th and 95th percentile over the last 240 frames (ms). */
  p50: number;
  p95: number;
  /** Our own work per frame, 95th percentile (ms). */
  workP95: number;
  /** The drawing resolution (device pixels per CSS pixel) and the drawing buffer's size. */
  scale: number;
  width: number;
  height: number;
  calls: number;
  triangles: number;
  paused: boolean;
  /** 'title' | 'playing' | 'paused' | 'over' … */
  mode: string;
}

// ---------------------------------------------------------------- touch, haptics, the overlay

let tick: HTMLLabelElement | null = null;
/**
 * A short haptic tap: the vibration where the phone has one; on an iPhone, where pages cannot vibrate, the switch
 * control's own tick (Safari 18 gives a switch's toggle a haptic), from inside a touch.
 */
export function haptic(ms = 10): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
      return;
    }
    if (!tick) {
      const input = h('input', { type: 'checkbox', tabIndex: -1 });
      input.setAttribute('switch', '');
      tick = h('label.g2tick', { 'aria-hidden': 'true' }, input);
      document.body.append(tick);
    }
    tick.click();
  } catch {
    /* no haptics here */
  }
}

/** The iPhone tick alone (where the host's onHit already vibrates the others). */
export function hapticIfNoVibrate(): void {
  if (typeof navigator.vibrate !== 'function') haptic();
}

export interface MenuButton {
  label: string;
  /** What VoiceOver says (the label when not given). */
  aria?: string;
  act: () => void;
  primary?: boolean;
  id?: string;
}
export interface MenuSpec {
  title: string;
  /** Ghosty's line. */
  line?: string;
  /** Small lines under it (a best score, a world's size). */
  notes?: string[];
  buttons: MenuButton[];
  /** Anything else the menu holds (the worlds' list, the how-to text). */
  extra?: Node;
  kind?: string;
}

/**
 * The game's overlay: on top of the canvas, in the canvas's own box. It holds the HUD, the touch controls, the menus
 * and Ghosty's line; a game builds its own controls into `layer`.
 */
export class Overlay {
  root: HTMLDivElement;
  layer: HTMLDivElement;
  private menuEl: HTMLDivElement | null = null;
  private sayEl: HTMLDivElement;
  private live: HTMLDivElement;
  private sayTimer = 0;
  private focus = 0;
  private prevMove = 0;
  private prevHeld = new Set<string>();
  menuKind = '';
  constructor(canvas: HTMLCanvasElement, cls: string, label: string) {
    this.layer = h('div.g2layer');
    this.sayEl = h('div.g2say', { 'aria-hidden': 'true' });
    this.live = h('div.g2live', { role: 'status', 'aria-live': 'polite' });
    this.root = h(`div.g2ui.${cls}` as 'div', { role: 'application', 'aria-label': label }, this.layer, this.sayEl, this.live);
    const host = canvas.parentElement ?? document.body;
    if (host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.append(this.root);
  }
  /** Ghosty's line in his bubble, read out by VoiceOver too. */
  say(line: string, ms = 3600): void {
    this.sayEl.textContent = line;
    this.sayEl.classList.add('on');
    this.live.textContent = line;
    clearTimeout(this.sayTimer);
    this.sayTimer = window.setTimeout(() => this.sayEl.classList.remove('on'), ms);
  }
  /** A status line for VoiceOver alone. */
  announce(words: string): void {
    this.live.textContent = words;
  }
  get menuOpen(): boolean {
    return !!this.menuEl;
  }
  menu(spec: MenuSpec): void {
    this.closeMenu();
    const btns = spec.buttons.map((b) =>
      h(`button.g2btn${b.primary ? '.pri' : ''}` as 'button', {
        type: 'button',
        'aria-label': b.aria ?? b.label,
        dataset: { id: b.id ?? b.label.toLowerCase().replace(/[^a-z]+/g, '-') },
        onclick: (ev: Event) => {
          ev.stopPropagation();
          b.act();
        },
      }, b.label),
    );
    const card = h('div.g2card', { role: 'dialog', 'aria-modal': 'true', 'aria-label': spec.title },
      h('h2.g2title', spec.title),
      spec.line ? h('p.g2line', spec.line) : null,
      ...(spec.notes ?? []).map((n) => h('p.g2note', n)),
      spec.extra ?? null,
      h('div.g2btns', ...btns),
    );
    this.menuEl = h(`div.g2menu${spec.kind ? `.${spec.kind}` : ''}` as 'div', card);
    this.menuKind = spec.kind ?? 'menu';
    this.menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.append(this.menuEl);
    this.focus = 0;
    this.root.classList.add('menuopen');
  }
  closeMenu(): void {
    this.menuEl?.remove();
    this.menuEl = null;
    this.menuKind = '';
    this.root.classList.remove('menuopen');
  }
  /** A controller in a menu: up and down move between its buttons (a ring shows which), A presses. */
  menuPad(intent: Intent): void {
    if (!this.menuEl) return;
    const btns = [...this.menuEl.querySelectorAll<HTMLButtonElement>('button')];
    if (!btns.length) return;
    const dir = intent.moveY > 0.6 ? -1 : intent.moveY < -0.6 ? 1 : 0;
    if (dir && dir !== this.prevMove) {
      this.focus = (this.focus + dir + btns.length) % btns.length;
      btns[this.focus]!.focus();
    }
    this.prevMove = dir;
    const pressed = (a: string) => intent.held.has(a as never) && !this.prevHeld.has(a);
    if (pressed('jump') || pressed('use') || pressed('fire')) (document.activeElement && btns.includes(document.activeElement as HTMLButtonElement) ? (document.activeElement as HTMLButtonElement) : btns[this.focus]!).click();
    this.prevHeld = new Set(intent.held);
  }
  destroy(): void {
    clearTimeout(this.sayTimer);
    this.root.remove();
  }
}

/** A button for the HUD (44 pt and up, labelled for VoiceOver). */
export function hudButton(cls: string, label: string, aria: string, onDown: (e: PointerEvent) => void): HTMLButtonElement {
  const b = h(`button.${cls}` as 'button', { type: 'button', 'aria-label': aria }, label);
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      b.setPointerCapture(e.pointerId); // its pointerup comes back here even if the thumb slides off
    } catch {
      /* fine */
    }
    onDown(e);
  });
  // VoiceOver and a keyboard press with a click, not a pointer
  b.addEventListener('click', (e) => {
    if ((e as PointerEvent).pointerType === '' || e.detail === 0) onDown(e as PointerEvent);
  });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

/** The canvas fills its box and takes no scrolling or zooming touches. */
export function fitCanvas(canvas: HTMLCanvasElement): void {
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
}

/** The canvas's CSS size (at least 1 × 1). */
export const cssSize = (canvas: HTMLCanvasElement): { w: number; h: number } => ({ w: Math.max(1, canvas.clientWidth || canvas.width), h: Math.max(1, canvas.clientHeight || canvas.height) });

/** Number words for the HUD: 12,345. */
export const num = (n: number): string => Math.round(n).toLocaleString('en-GB');

// ---------------------------------------------------------------- bits that fly, and a stick under the thumb (BRIEF-GAMES-3)

/**
 * Short-lived bits — sparks, spray, dust, feathers, crumbs: one instanced mesh for all of them (one draw call), each a
 * small shape that flies, falls, spins and shrinks away; when every one is busy the oldest is used again.
 */
export class Bits {
  readonly mesh: IMesh;
  private readonly s: Float32Array; // per bit: x y z vx vy vz left life size spin
  private readonly c: Float32Array; // r g b
  private next = 0;
  private readonly dummy: Obj3;
  private readonly col: Col;
  constructor(T: ThreeNS, readonly n: number, shape: Geom, mat: Mat) {
    this.s = new Float32Array(n * 10);
    this.c = new Float32Array(n * 3);
    this.mesh = new T.InstancedMesh(shape, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new T.Color(0xffffff));
    this.mesh.count = 0;
    this.dummy = new T.Object3D();
    this.col = new T.Color();
  }
  /** One bit at (x, y, z) flying at (vx, vy, vz) m/s for `life` seconds, `size` across, in colour `hex`. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, hex: number): void {
    const i = this.next;
    this.next = (i + 1) % this.n;
    const o = i * 10;
    this.s.set([x, y, z, vx, vy, vz, life, life, size, (Math.random() - 0.5) * 14], o);
    this.c[i * 3] = ((hex >> 16) & 255) / 255;
    this.c[i * 3 + 1] = ((hex >> 8) & 255) / 255;
    this.c[i * 3 + 2] = (hex & 255) / 255;
  }
  /** Moves them on (gravity pulls them down, drag slows them, none goes below `floor`) and draws the live ones. */
  update(dt: number, gravity = 0, drag = 0, floor = -1e9): void {
    const s = this.s, m = this.mesh, d = this.dummy;
    const f = drag ? Math.exp(-drag * dt) : 1;
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      const o = i * 10;
      const left = s[o + 6]! - dt;
      if (left <= 0) {
        s[o + 6] = 0;
        continue;
      }
      s[o + 6] = left;
      const vx = s[o + 3]! * f, vy = (s[o + 4]! - gravity * dt) * f, vz = s[o + 5]! * f;
      s[o + 3] = vx;
      s[o + 4] = vy;
      s[o + 5] = vz;
      const x = s[o]! + vx * dt, z = s[o + 2]! + vz * dt;
      let y = s[o + 1]! + vy * dt;
      if (y < floor) (y = floor), (s[o + 4] = 0);
      s[o] = x;
      s[o + 1] = y;
      s[o + 2] = z;
      const a = left / s[o + 7]!;
      const sc = s[o + 8]! * (0.3 + 0.7 * a);
      const spin = s[o + 9]! * (1 - a);
      d.position.set(x, y, z);
      d.rotation.set(spin, spin * 0.7, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      m.setMatrixAt(k, d.matrix);
      m.setColorAt(k, this.col.setRGB(this.c[i * 3]!, this.c[i * 3 + 1]!, this.c[i * 3 + 2]!));
      k++;
    }
    m.count = k;
    if (k) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  clear(): void {
    for (let i = 0; i < this.n; i++) this.s[i * 10 + 6] = 0;
    this.mesh.count = 0;
  }
}

/**
 * A stick that appears where the thumb lands inside `area` (a touch `accept` turns down is left alone): `base`, with
 * the knob as its first child, is drawn there; x is right and y forward (up the screen), each −1…1 through input.ts's
 * touchMove, so the dead zone and the curve are the arcade's own.
 */
export class ThumbStick {
  x = 0;
  y = 0;
  private id = -1;
  private x0 = 0;
  private y0 = 0;
  constructor(
    private readonly area: HTMLElement,
    private readonly base: HTMLElement,
    private readonly radius = 56,
    private readonly accept: (e: PointerEvent, box: DOMRect) => boolean = () => true,
    private readonly onStart?: () => void,
  ) {
    area.addEventListener('pointerdown', this.down);
    area.addEventListener('pointermove', this.move);
    area.addEventListener('pointerup', this.up);
    area.addEventListener('pointercancel', this.up);
  }
  get active(): boolean {
    return this.id >= 0;
  }
  private down = (e: PointerEvent) => {
    const box = this.area.getBoundingClientRect();
    if (this.id >= 0 || !this.accept(e, box)) return;
    e.preventDefault();
    try {
      this.area.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    this.id = e.pointerId;
    this.x0 = e.clientX;
    this.y0 = e.clientY;
    this.base.style.transform = `translate(${this.x0 - box.left}px, ${this.y0 - box.top}px)`;
    this.base.classList.add('on');
    this.onStart?.();
  };
  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.x0, dy = e.clientY - this.y0;
    const m = touchMove(dx, dy, this.radius);
    this.x = m.moveX;
    this.y = m.moveY;
    const len = Math.hypot(dx, dy), k = len > this.radius ? this.radius / len : 1;
    (this.base.firstElementChild as HTMLElement | null)?.style.setProperty('transform', `translate(${dx * k}px, ${dy * k}px)`);
  };
  private up = (e: PointerEvent) => {
    if (e.pointerId === this.id) this.reset();
  };
  reset(): void {
    this.id = -1;
    this.x = this.y = 0;
    this.base.classList.remove('on');
    (this.base.firstElementChild as HTMLElement | null)?.style.removeProperty('transform');
  }
}

/** Ghosty's colour from the theme (the games give it to his kart, his hopper and his cells). */
export function accentHex(fallback = 0x64d2ff): number {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--c').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
  } catch {
    /* no styles: the default */
  }
  return fallback;
}

/** A seeded random number generator (0…1), the same numbers for the same seed. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Where a point lands on the screen (CSS px from the canvas's top left) for a camera at `eye` looking at `at`, with
 *  vertical field of view `fov` (degrees) and aspect w/h; null behind the camera. No matrices needed. */
export function project(eye: readonly number[], at: readonly number[], fov: number, w: number, hgt: number, p: readonly number[]): { x: number; y: number; d: number } | null {
  let fx = at[0]! - eye[0]!, fy = at[1]! - eye[1]!, fz = at[2]! - eye[2]!;
  const fl = Math.hypot(fx, fy, fz) || 1;
  (fx /= fl), (fy /= fl), (fz /= fl);
  // right = forward × up; up' = right × forward
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  (rx /= rl), (rz /= rl);
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = p[0]! - eye[0]!, dy = p[1]! - eye[1]!, dz = p[2]! - eye[2]!;
  const zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const t = Math.tan((fov * Math.PI) / 360);
  const xn = (dx * rx + dz * rz) / (zc * t * (w / hgt)), yn = (dx * ux + dy * uy + dz * uz) / (zc * t);
  return { x: (xn * 0.5 + 0.5) * w, y: (0.5 - yn * 0.5) * hgt, d: zc };
}
