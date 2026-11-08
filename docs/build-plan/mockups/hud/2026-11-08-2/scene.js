/* THE SCAN IN REAL 3-D (BRIEF-HUD-MOCKS-2 1 and 2: "real motion, the scan assembling with depth and parallax"; his words in 157:
   "straight out of a high-production Hollywood movie").

   Round one drew W1's room with a raymarcher (scan.js) that photographs one moment in about six seconds; a film needs thirty
   frames a second and a camera that moves. So the same room is here as what the Machine actually keeps of it: a POINT CLOUD. Every
   surface is sampled into points on the same jittered lattice as scan.js (walls .05–.06 m apart, a thing .016, a page .009), every
   edge is one hairline, each point remembers the order the scan reached it in (buildAt: from the back-left corner forward, up and
   across), how the orb lights it and how the hour's light from the window lights it. The camera is a real camera (three.js, the
   app's own vendored build, as the orb is drawn), so a dolly-in gives parallax between the desk, the shelf, the back wall and the
   city outside the window, and a Home frame at CAM_HOME is the same picture as round one's to the token.

   What moves per frame costs nothing: the sampling front (uBuild), the edges drawing in (uEdge), the orb's light (uOrbLit), the
   recognition's ping (a wave of light through the points from the orb), the breathing of the points (uDrift), a point re-read now
   and then (the sparkle), the city's lights, the land outside a train window sliding past (uScroll). The same module draws the
   room, the street and the carriage: three places, one language. Nothing here ships; the real HUD is the shell's. */
import * as THREE from '../../../../../apps/web/public/vendor/three/three.module.min.js';

const SAT = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fract = (x) => x - Math.floor(x);
function hash11(p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
function hash12(x, y) { let px = fract(x * 0.1031), py = fract(y * 0.1030), pz = fract(x * 0.0973); const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33); px += d; py += d; pz += d; return fract((px + py) * pz); }
function hash22(x, y) { let px = fract(x * 0.1031), py = fract(y * 0.1030), pz = fract(x * 0.0973); const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33); px += d; py += d; pz += d; return [fract((px + px) * pz), fract((px + py) * py)]; }

const POINT_VS = `
attribute float aOrder, aAmb, aOrb, aPat, aLit, aRad, aSeed, aFar;
uniform float uBuild, uOrbLit, uAmbient, uTime, uDrift, uPing, uPingA, uFade, uScale, uDpr, uBase, uFreshA, uScroll, uFar, uSparkle, uFog;
uniform vec3 uOrbPos, uBone, uAccent, uAccentMix, uTint, uTintFar;
varying float vA; varying vec3 vC;
void main() {
  vec3 p = position;
  // the land outside a train window slides past (the carriage); the room's points breathe
  p.z += uScroll * aFar;
  p += normal * 0.006 * uDrift * sin(uTime * 0.9 + aSeed * 6.2831);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float dist = -mv.z;
  gl_Position = projectionMatrix * mv;
  float fr = uBuild * 1.2 - aOrder;                       // where the sampling front is, relative to this point
  float on = fr < 0. ? 0. : 1.;
  float fresh = smoothstep(.12, 0., fr) * uFreshA;        // a brighter front where the scan is now
  float li = aAmb * uAmbient + aOrb * uOrbLit;
  float fog = exp(-max(dist - 1.5, 0.) * uFog);
  float sparkle = 1. + uSparkle * step(.993, fract(sin(aSeed * 91.7 + floor(uTime * 3.)) * 4375.3));  // a point re-read
  float a = aPat * li * (1. + 4. * fresh) * mix(fog, 2.2, aFar) * uFade * on * sparkle;
  float dp = length(p - uOrbPos);
  float ping = exp(-pow((dp - uPing) / .2, 2.)) * uPingA * on;
  vec3 c = mix(uBone, uAccentMix, aLit) * mix(uTint, uTintFar, aFar);
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
uniform float uBuild, uEdge, uFade, uScroll, uAmbient, uOrbLit, uFog;
uniform vec3 uBone, uTint;
varying float vA; varying vec3 vC; varying float vOrder;
void main() {
  vec3 p = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
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

/** One place the Machine keeps as points: the room, the street or the carriage. */
export class Scan {
  constructor(canvas, { dpr = 2 } = {}) {
    this.canvas = canvas;
    this.dpr = dpr;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 440 / 956, 0.05, 900);
    this.u = {
      uBuild: { value: 1 }, uEdge: { value: 1 }, uOrbLit: { value: 1 }, uAmbient: { value: 1 }, uTime: { value: 0 }, uDrift: { value: 0 },
      uPing: { value: -9 }, uPingA: { value: 0 }, uFade: { value: 1 }, uScale: { value: 1 }, uDpr: { value: dpr }, uBase: { value: 0.9 }, uFreshA: { value: 1 },
      uScroll: { value: 0 }, uFar: { value: 0 }, uSparkle: { value: 0.6 }, uFog: { value: 0.08 },
      uOrbPos: { value: new THREE.Vector3(0, -9, 0) }, uBone: { value: new THREE.Color(1, 1, 1) }, uAccent: { value: new THREE.Color(0.4, 0.8, 1) },
      uAccentMix: { value: new THREE.Color(0.6, 0.9, 1) }, uTint: { value: new THREE.Color(1, 1, 1) }, uTintFar: { value: new THREE.Color(1, 1, 1) },
    };
    this.readTokens();
  }

  /** The system's own colours from the page's tokens (bone, the accent and its pale), as scan.js read them. */
  readTokens(el = document.documentElement) {
    const cs = getComputedStyle(el);
    const rgb = (n, fb) => { const m = cs.getPropertyValue(n).match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); return m ? new THREE.Color(+m[1] / 255, +m[2] / 255, +m[3] / 255) : new THREE.Color(fb); };
    const bone = rgb('--g-bone-rgb', 0xece8df), acc = rgb('--g-accent-rgb', 0x64d2ff), pale = rgb('--g-accent-pale-rgb', 0xbff0ff);
    this.u.uBone.value.copy(bone);
    this.u.uAccent.value.copy(acc);
    this.u.uAccentMix.value.copy(acc).lerp(pale, 0.35);
  }

  size(w, h) {
    this.W = w; this.H = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** The camera as gl.js has it: pos, tgt, fov in degrees. uScale is the pixels a metre covers at one metre. */
  setCamera(pos, tgt, fov) {
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(tgt[0], tgt[1], tgt[2]);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const f = 0.5 / Math.tan((fov * Math.PI) / 360);
    this.u.uScale.value = this.H * f;
    this.cam = { pos: [...pos], tgt: [...tgt], fov };
  }

  /** A world point to CSS px on the screen (null behind the eye). */
  project(p) {
    const v = new THREE.Vector3(p[0], p[1], p[2]);
    const d = v.clone().sub(this.camera.position);
    const fw = new THREE.Vector3(); this.camera.getWorldDirection(fw);
    const z = d.dot(fw);
    if (z <= 0.02) return null;
    v.project(this.camera);
    return [((v.x + 1) / 2) * this.W, ((1 - v.y) / 2) * this.H, z];
  }

  /** A thing's bounds (x0 y0 z0 x1 y1 z1) to its box on screen, grown by pad, never under min: gl.js's data-box. */
  box(b, pad = 0, min = 0) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const p = this.project([i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]]);
      if (!p) continue;
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
    if (y1 - y0 < min) { const c = (y0 + y1) / 2; y0 = c - min / 2; y1 = c + min / 2; }
    return { left: Math.max(2, x0), top: Math.max(2, y0), right: Math.min(this.W - 2, x1), bottom: Math.min(this.H - 2, y1) };
  }

  /** The orb where the screen needs it (gl.js orbAt): [x px, y px, depth m, radius px] at the camera set now → world centre and radius. */
  orbWorld([sx, sy, dd, rp]) {
    const { pos, tgt, fov } = this.cam;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const fw = norm(sub(tgt, pos)), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
    const f = 0.5 / Math.tan((fov * Math.PI) / 360);
    const u = (sx - this.W / 2) / this.H, v = (this.H / 2 - sy) / this.H;
    const dir = norm([fw[0] * f + rt[0] * u + up[0] * v, fw[1] * f + rt[1] * u + up[1] * v, fw[2] * f + rt[2] * u + up[2] * v]);
    const along = dd / dot(dir, fw);
    return { c: [pos[0] + dir[0] * along, pos[1] + dir[1] * along, pos[2] + dir[2] * along], r: ((rp / this.H) * dd) / f };
  }

  /** Build the place. desc: { bounds: [hw, h, zb, zf] (the order the scan samples in), light, orb: {c, r}, parts: [...] } */
  build(desc) {
    for (const c of [...this.scene.children]) this.scene.remove(c);
    this.desc = desc;
    this.pts = { pos: [], nrm: [], order: [], amb: [], orb: [], pat: [], lit: [], rad: [], seed: [], far: [] };
    this.lns = { pos: [], order: [], li: [], wall: [] };
    this.occ = [];
    this.orb = desc.orb;
    this.light = desc.light;
    this.u.uOrbPos.value.set(desc.orb.c[0], desc.orb.c[1], desc.orb.c[2]);
    this.u.uTint.value.setRGB(...desc.light.tint);
    this.u.uTintFar.value.setRGB(...(desc.light.tintFar || desc.light.tint));
    this.u.uAmbient.value = desc.light.ambient;
    this.u.uFog.value = desc.light.fog ?? 0.08;
    const B = desc.bounds;
    this.buildAt = desc.buildAt || ((p) => SAT((p[2] - B[2]) / (B[3] - B[2])) * 0.45 + SAT((p[0] + B[0]) / (2 * B[0])) * 0.35 + SAT(p[1] / B[1]) * 0.2);
    for (const part of desc.parts) this[part.type](part);
    this.commit();
  }

  // ---- the light on a point: the orb's (scan.js lightAt), then the hour's from the window (directional, coloured by the hour)
  lightAt(p, n) {
    const o = this.orb.c;
    const L = [o[0] - p[0], o[1] - p[1], o[2] - p[2]];
    const d = Math.hypot(...L);
    const dif = Math.max((L[0] * n[0] + L[1] * n[1] + L[2] * n[2]) / d, 0);
    const orb = ((0.16 + 0.84 * dif) * 1.9) / (1 + 0.55 * d * d);
    let amb = 0.55 + 0.45 * dif;
    const w = this.light.window; // { at: [x,y,z], dir: [x,y,z] unit towards the room, strength }
    if (w) {
      const V = [w.at[0] - p[0], w.at[1] - p[1], w.at[2] - p[2]];
      const dw = Math.hypot(...V);
      const dd = Math.max((V[0] * n[0] + V[1] * n[1] + V[2] * n[2]) / dw, 0);
      amb += (w.strength * (0.3 + 0.7 * dd)) / (1 + 0.25 * dw * dw);
    }
    if (this.light.sky) amb += this.light.sky * (0.4 + 0.6 * Math.max(n[1], 0)); // daylight from above
    return { orb, amb };
  }

  push(p, n, order, pat, lit, rad, far = 0) {
    const l = this.lightAt(p, n);
    const P = this.pts;
    P.pos.push(p[0], p[1], p[2]); P.nrm.push(n[0], n[1], n[2]); P.order.push(order); P.amb.push(l.amb); P.orb.push(l.orb);
    P.pat.push(pat); P.lit.push(lit); P.rad.push(rad); P.seed.push(hash12(p[0] * 31.7 + p[2] * 7.1, p[1] * 17.3)); P.far.push(far);
  }

  line(a, b, li = 1, wall = 0) {
    const L = this.lns;
    L.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    L.order.push(this.buildAt(a), this.buildAt(b));
    L.li.push(li, li); L.wall.push(wall, wall);
  }

  /** Sample one face: centre c, normal n, axes u and v with half extents hu, hv, spacing s; pattern(uu, vv) → alpha (0 skips). */
  face(c, n, u, v, hu, hv, s, { pat = () => 1, lit = 0, rad = 0.05, skip = null, far = 0, base = 1 } = {}) {
    const nu = Math.ceil((2 * hu) / s), nv = Math.ceil((2 * hv) / s);
    const seedX = Math.round((c[0] * 13 + c[2] * 7 + n[0] * 3) * 100), seedY = Math.round((c[1] * 11 + n[1] * 5 + n[2] * 2) * 100);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const h = hash22(i + seedX, j + seedY);
      const uu = -hu + (i + 0.2 + 0.6 * h[0]) * s, vv = -hv + (j + 0.2 + 0.6 * h[1]) * s;
      if (uu > hu || vv > hv) continue;
      const p = [c[0] + u[0] * uu + v[0] * vv, c[1] + u[1] * uu + v[1] * vv, c[2] + u[2] * uu + v[2] * vv];
      if (skip && skip(p)) continue;
      const a = pat(uu, vv, p) * base;
      if (a <= 0) continue;
      this.push(p, n, this.buildAt(p), a, lit, rad * s, far);
    }
  }

  /** A box: centre c, half size h, kind (scan.js's: 0 plain, 1 book, 2 paper, 3 notebook, 5 chessboard, 6 calendar, 7 shelf, 8 arcade, 9 keyboard), lit 0/1. */
  thing({ c, h, kind = 0, lit = 0, edges = true, occlude = true, faces = null, s = null, base = 1 }) {
    const sp = s ?? (kind === 1 || kind === 2 || kind === 3 ? 0.009 : 0.016);
    const F = [
      ['+x', [1, 0, 0], [0, 0, 1], [0, 1, 0], h[2], h[1]], ['-x', [-1, 0, 0], [0, 0, 1], [0, 1, 0], h[2], h[1]],
      ['+y', [0, 1, 0], [1, 0, 0], [0, 0, 1], h[0], h[2]], ['-y', [0, -1, 0], [1, 0, 0], [0, 0, 1], h[0], h[2]],
      ['+z', [0, 0, 1], [1, 0, 0], [0, 1, 0], h[0], h[1]], ['-z', [0, 0, -1], [1, 0, 0], [0, 1, 0], h[0], h[1]],
    ];
    for (const [name, n, u, v, hu, hv] of F) {
      if (faces && !faces.includes(name)) continue;
      if (hu < 0.004 || hv < 0.004) continue;
      const fc = [c[0] + n[0] * h[0], c[1] + n[1] * h[1], c[2] + n[2] * h[2]];
      const pat = this.pattern(kind, name, h);
      this.face(fc, n, u, v, hu, hv, sp, { pat, lit, rad: 0.05, base });
    }
    if (edges) {
      const X = [c[0] - h[0], c[0] + h[0]], Y = [c[1] - h[1], c[1] + h[1]], Z = [c[2] - h[2], c[2] + h[2]];
      const P = (i) => [X[i & 1], Y[(i >> 1) & 1], Z[(i >> 2) & 1]];
      const li = this.lightAt(c, [0, 1, 0]); const l = li.amb * 0.6 + li.orb * 0.6;
      for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.line(P(a), P(b), Math.min(1, l), 0);
    }
    if (occlude) this.occ.push({ c, h });
  }

  /** The face of a thing carries what it is (scan.js): a book's lines, the chessboard, the calendar's days, the shelf's spines, the keys. */
  pattern(kind, face, h) {
    if (kind === 1 && face === '+y') return (uu, vv) => { // the open book: two pages of lines, the gutter dark
      const row = fract((vv + h[2]) / 0.016); const side = Math.abs(uu);
      if (side < 0.006) return 0;
      const inside = side > 0.02 && side < h[0] - 0.02 && Math.abs(vv) < h[2] - 0.02;
      return inside ? (row < 0.55 ? 1 : 0.12) : 0.5;
    };
    if (kind === 2 && face === '+y') return (uu, vv) => (fract((vv + h[2]) / 0.014) < 0.5 && Math.abs(uu) < h[0] - 0.015 ? 1 : 0.25); // a folded paper: its lines
    if (kind === 3 && face === '+y') return (uu, vv) => (fract((vv + h[2]) / 0.012) < 0.4 ? 0.9 : 0.3); // the notebook: ruled
    if (kind === 5 && face === '+y') return (uu, vv) => { const sx = Math.floor((uu + h[0]) / (h[0] / 4)), sy = Math.floor((vv + h[2]) / (h[2] / 4)); return (sx + sy) % 2 === 0 ? 1 : 0.25; };
    if (kind === 6 && face === '+z') return (uu, vv) => { // the calendar: a month of days, one ringed
      const gx = ((uu + h[0]) / (2 * h[0])) * 7, gy = ((vv + h[1]) / (2 * h[1])) * 6;
      const fx = Math.abs(fract(gx) - 0.5), fy = Math.abs(fract(gy) - 0.5);
      if (gy > 5) return 0.9;
      if (Math.floor(gx) === 5 && Math.floor(gy) === 3) { const r = Math.hypot(fract(gx) - 0.5, fract(gy) - 0.5); if (r > 0.3 && r < 0.46) return 1.6; }
      return Math.max(fx, fy) > 0.44 ? 1 : 0.3;
    };
    if (kind === 7 && face === '+z') return (uu, vv) => { // the shelf: the books standing on it
      const sh = ((vv + h[1]) / (2 * h[1])) * 5; const fy = fract(sh); const sx = (uu + h[0]) / 0.028; const sid = Math.floor(sx) + Math.floor(sh) * 40;
      const tall = 0.55 + 0.4 * hash11(sid);
      return fy < 0.06 ? 1 : fy < tall ? (fract(sx) < 0.12 ? 0.15 : 0.9) : 0.08;
    };
    if (kind === 9 && face === '+y') return (uu, vv) => { const kx = fract((uu + h[0]) / 0.024); return kx < 0.14 ? 0.1 : 1; };
    if (kind === 8 && face === '+z') return (uu, vv) => (Math.abs(uu) < h[0] - 0.03 && vv > -0.05 ? 1.3 : 0.8);
    if (kind === 10 && face === '+y') return (uu, vv) => (Math.abs(uu) < h[0] - 0.02 && Math.abs(vv) < h[2] - 0.02 ? 0.35 : 1); // a seat: its edge
    return () => 1;
  }

  /** The room: half width, height, back z, front z; the window on the back wall x0 y0 x1 y1 (none if x1 <= x0). */
  room({ hw, hgt, zb, zf, win = null, floorS = 0.05, wallS = 0.06, ceiling = true, sides = true }) {
    const zc = (zb + zf) / 2, hz = (zf - zb) / 2;
    const hole = win && win[2] > win[0] ? (p) => p[0] > win[0] && p[0] < win[2] && p[1] > win[1] && p[1] < win[3] : null;
    this.face([0, 0, zc], [0, 1, 0], [1, 0, 0], [0, 0, 1], hw, hz, floorS, { base: 0.6, rad: 0.05 });
    if (ceiling) this.face([0, hgt, zc], [0, -1, 0], [1, 0, 0], [0, 0, 1], hw, hz, wallS, { base: 0.42 });
    if (sides) {
      this.face([-hw, hgt / 2, zc], [1, 0, 0], [0, 0, 1], [0, 1, 0], hz, hgt / 2, wallS, { base: 0.42 });
      this.face([hw, hgt / 2, zc], [-1, 0, 0], [0, 0, 1], [0, 1, 0], hz, hgt / 2, wallS, { base: 0.42 });
    }
    this.face([0, hgt / 2, zb], [0, 0, 1], [1, 0, 0], [0, 1, 0], hw, hgt / 2, wallS, { base: 0.42, skip: hole });
    // where two walls meet, and the window's frame
    const E = [[[-hw, 0, zb], [hw, 0, zb]], [[-hw, hgt, zb], [hw, hgt, zb]], [[-hw, 0, zb], [-hw, hgt, zb]], [[hw, 0, zb], [hw, hgt, zb]],
      [[-hw, 0, zb], [-hw, 0, zf]], [[hw, 0, zb], [hw, 0, zf]], [[-hw, hgt, zb], [-hw, hgt, zf]], [[hw, hgt, zb], [hw, hgt, zf]]];
    for (const [a, b] of E) this.line(a, b, 0.8, 1);
    if (hole) {
      const [x0, y0, x1, y1] = win;
      for (const [a, b] of [[[x0, y0, zb], [x1, y0, zb]], [[x1, y0, zb], [x1, y1, zb]], [[x1, y1, zb], [x0, y1, zb]], [[x0, y1, zb], [x0, y0, zb]]]) this.line(a, b, 1, 1);
      // the back wall occludes the city except through the window
      this.occ.push({ c: [0, (y0) / 2, zb - 0.02], h: [hw, y0 / 2, 0.01] });
      this.occ.push({ c: [0, (y1 + hgt) / 2, zb - 0.02], h: [hw, (hgt - y1) / 2, 0.01] });
      this.occ.push({ c: [(-hw + x0) / 2, hgt / 2, zb - 0.02], h: [(x0 + hw) / 2, hgt / 2, 0.01] });
      this.occ.push({ c: [(hw + x1) / 2, hgt / 2, zb - 0.02], h: [(hw - x1) / 2, hgt / 2, 0.01] });
    }
  }

  /** Birmingham through the window at night (scan.js skyline): three rows of towers far off, each facade a grid of window points, a few lit; a hairline along each roof. */
  skyline({ lit = 0.42, accentLit = 0.1, night = true, zOff = 0, rise = 26 }) {
    for (let layer = 0; layer < 3; layer++) {
      const z = -140 - layer * 120 + zOff;
      const w = 9 + 3 * layer;
      for (let cx = -14; cx <= 14; cx++) {
        const cxo = cx + Math.floor(hash11(layer));
        let hgt = rise - 45 + (10 + 40 * Math.pow(hash11(cxo * 1.7 + layer * 31), 2));
        if (hash11(cxo + 3.1 + layer) > 0.86) hgt += 45 * hash11(cxo + 8);
        const xl = (cxo - hash11(layer)) * w, xr = xl + w;
        const sx = 1.7 + layer * 0.4, sy = 2.2 + layer * 0.4;
        const y0 = rise - 120;
        // the facade's windows
        for (let yy = y0; yy < hgt; yy += sy) for (let xx = xl; xx < xr - 0.5; xx += sx) {
          const on = hash12(Math.round(xx / sx) + layer * 9, Math.round(yy / sy)) > 1 - lit;
          const a = (0.12 + 0.88 * (on ? 1 : 0)) / (1 + layer * 0.7);
          const isAcc = on && hash12(Math.round(xx / sx) + 5, Math.round(yy / sy) + 5) > 1 - accentLit;
          this.push([xx + sx / 2, yy + sy / 2, z], [0, 0, 1], 0, night ? a * 0.9 : a * 0.5, isAcc ? 1 : 0, 0.0, 1);
        }
        // the roof and the sides, as lines
        this.lns.pos.push(xl, hgt, z, xr, hgt, z, xl, y0, z, xl, hgt, z);
        this.lns.order.push(0, 0, 0, 0); this.lns.li.push(0.8, 0.8, 0.25, 0.25); this.lns.wall.push(0, 0, 0, 0);
      }
    }
    // two aircraft over the city: one light each
    this.push([-22, 38 + rise, -300], [0, 0, 1], 0, 2.5, 0, 0.0, 1);
    this.push([30, 52 + rise, -300], [0, 0, 1], 0, 2.5, 0, 0.0, 1);
  }

  /** THE MAP (OUT and ON THE WAY): W1's own city (scan.js's street(), bH(), the walk and the train), the Stage he saw through the
      window in round two, now the whole stage of Home when he is not at home: the blocks round New Street, the ring road, the
      walk dotted and the train solid in his colour, a ring where he stands or a lit point where the train is. Model units: 1 = 60 px
      of the old map. The Machine's God's eye of the city, which is what it keeps of a place that is not a room. */
  map({ route = [], me = null, train = null, extent = 3.8 }) {
    const n2 = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
    const A = n2(1, 1.25), B = n2(1, -0.8);
    const street = (x, y) => Math.min(Math.abs(y - 0.5), Math.abs(x + 1.6), Math.abs(x), Math.abs(y + 1.4), Math.abs(x - 1.9), Math.abs(y - 1.9),
      Math.abs(x * A[0] + y * A[1] - 0.9), Math.abs(x * B[0] + y * B[1] + 1.1), Math.abs(Math.hypot(x - 0.1, y - 0.1) - 2.6));
    const segD = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay; const h = SAT(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)); return Math.hypot(px - ax - vx * h, py - ay - vy * h); };
    const routeD = (x, y) => { let d = 1e3; for (let i = 0; i < route.length - 1; i++) d = Math.min(d, segD(x, y, route[i][0], route[i][1], route[i + 1][0], route[i + 1][1])); return d; };
    const bH = (i, j) => {
      const cx = (i + 0.5) * 0.2, cz = (j + 0.5) * 0.2;
      if (street(cx, cz) < 0.13 || routeD(cx, cz) < 0.12 || Math.hypot(cx, cz) > 3.6) return 0;
      const nr = Math.hypot(cx, cz);
      let h = 0.03 + 0.1 * Math.pow(hash12(i, j), 3) + 0.62 * Math.exp(-nr * nr * 0.35) * Math.pow(hash12(i + 7, j + 7), 4) + 0.05 * (hash12(i + 2, j + 2) > 0.8 ? 1 : 0);
      if (Math.abs(cx) < 0.5 && Math.abs(cz) < 0.14) h = 0.07; // New Street: the station's long roof
      return h;
    };
    // the ground, sparse; the streets a shade brighter
    this.face([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1], extent, extent, 0.05, { base: 0.35, rad: 0.05, pat: (u, v) => (Math.hypot(u, v) > extent ? 0 : street(u, v) < 0.13 ? 1.25 : 1) });
    // the buildings, denser, their edges drawn
    for (let i = -19; i < 19; i++) for (let j = -19; j < 19; j++) {
      const h = bH(i, j);
      if (h <= 0) continue;
      this.thing({ c: [(i + 0.5) * 0.2, h / 2, (j + 0.5) * 0.2], h: [0.078, h / 2, 0.078], kind: 11, s: 0.028, faces: ['+x', '-x', '+z', '-z', '+y'], base: 0.8 });
    }
    // the way: the walk dotted, the train solid, in his colour; rings at home, New Street and the line's end
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const walk = i < 5; const step = walk ? 0.03 : 0.012; const nn = Math.max(1, Math.round(len / step));
      for (let k = 0; k <= nn; k++) { const t = k / nn; if (walk && (k % 3) === 2) continue; this.push([a[0] + (b[0] - a[0]) * t, 0.012, a[1] + (b[1] - a[1]) * t], [0, 1, 0], 0, walk ? 1.6 : 1.3, 1, walk ? 0.012 : 0.007); }
    }
    const ring = (c, r, lit, a) => { for (let k = 0; k < 48; k++) { const q = (k / 48) * Math.PI * 2; this.push([c[0] + r * Math.cos(q), 0.012, c[1] + r * Math.sin(q)], [0, 1, 0], 0, a, lit, 0.006); } };
    if (route.length > 10) { ring(route[0], 0.1, 0, 1.2); ring(route[5], 0.17, 1, 1.4); ring(route[10], 0.1, 0, 1.2); }
    if (me) { ring(me, 0.12, 1, 1.8); this.push([me[0], 0.03, me[1]], [0, 1, 0], 0, 2.4, 1, 0.03); }
    if (train) { this.push([train[0], 0.04, train[1]], [0, 1, 0], 0, 3.2, 1, 0.04); for (let k = 1; k < 8; k++) this.push([train[0] - train[2] * k * 0.018, 0.03, train[1] - train[3] * k * 0.018], [0, 1, 0], 0, 1.6 - k * 0.18, 1, 0.02 - k * 0.002); }
  }

  commit() {
    const P = this.pts, L = this.lns;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nrm, 3));
    for (const [k, a] of [['aOrder', P.order], ['aAmb', P.amb], ['aOrb', P.orb], ['aPat', P.pat], ['aLit', P.lit], ['aRad', P.rad], ['aSeed', P.seed], ['aFar', P.far]]) g.setAttribute(k, new THREE.Float32BufferAttribute(a, 1));
    const pm = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    this.points = new THREE.Points(g, pm);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
    lg.setAttribute('aOrder', new THREE.Float32BufferAttribute(L.order, 1));
    lg.setAttribute('aLi', new THREE.Float32BufferAttribute(L.li, 1));
    lg.setAttribute('aWall', new THREE.Float32BufferAttribute(L.wall, 1));
    const lm = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    this.lines = new THREE.LineSegments(lg, lm);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;
    // the occluders: a thing hides what is behind it (depth only, no colour), pushed back a hair so its own surface's points win
    const om = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
    const occ = new THREE.Group();
    for (const o of this.occ) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.h[0] * 2, o.h[1] * 2, o.h[2] * 2), om);
      m.position.set(o.c[0], o.c[1], o.c[2]);
      occ.add(m);
    }
    occ.renderOrder = 0;
    this.scene.add(occ, this.lines, this.points);
    this.count = { points: P.order.length, lines: L.order.length / 2, occluders: this.occ.length };
  }

  /** Draw one moment. u: any of the uniforms by name (uBuild, uEdge, uOrbLit, uTime, uDrift, uPing, uPingA, uFade, uFreshA, uScroll, uSparkle, uAmbient). */
  render(u = {}) {
    for (const [k, v] of Object.entries(u)) if (this.u[k]) this.u[k].value = v;
    this.renderer.render(this.scene, this.camera);
  }
}

/** Small easings, shared by the film and the ambient Homes (a title designer's three: out, in-out, and the lock's own curve). */
export const E = {
  clamp: SAT,
  out: (k) => 1 - Math.pow(1 - SAT(k), 3),
  outQuad: (k) => 1 - Math.pow(1 - SAT(k), 2),
  inOut: (k) => { const x = SAT(k); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  inOutQuint: (k) => { const x = SAT(k); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; },
  lock: (k) => { const x = SAT(k); return x * x * (3 - 2 * x); },  // cubic-bezier(.4, 0, .2, 1) near enough
  seg: (t, a, b) => SAT((t - a) / (b - a)),
  lerp: (a, b, k) => a + (b - a) * k,
  v3: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
};
