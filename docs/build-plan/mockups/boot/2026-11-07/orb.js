// THE ORB, for the storyboard: apps/web/src/features/core/mind.ts (the hologram: a sphere of light holding the slowly turning
// constellation of his library) ported line for line to a plain module that draws ONE frame of it with the app's own vendored
// three.js, so the storyboard's frames are the real orb and not a drawing of it. The boot's `BootLook` (gather, links, sphere,
// haze, mer, rim, scale, core, turn, push, sweep, trails, refract) and the five states' numbers (TARGET) are mind.ts's.
//
// "A LITTLE BETTER" (BRIEF-ORB-AND-BOOT; OWNER-ISSUES 142: "if you can make it a little better"), each marked BETTER below:
//   1. sharper where it is sharp: the lit nodes' cores and the unlit nodes are drawn with a crisp point texture (a hard edge
//      and a one-pixel feather) instead of the soft glow texture; the crisp rim's Fresnel is a little tighter (power 9, not 7)
//      so the edge reads as one line; the halos stay soft.
//   2. lit in the accent, from the tokens: every colour is read from --g-accent / --g-accent-pale on <html> (the design
//      system's tokens.css), never from a constant; the near-white of the unlit nodes is tinted from the same accent.
//   3. the glow follows the world: the halos (h2, h3, the nodes' haloes) are scaled by --g-glow × --g-room-glow, which is what
//      state/theme.ts's glowNow() returns; GLOW off or One Ink leaves the orb its crisp parts and no haze round them.
// Everything else is mind.ts as it is today, so run two can port the three changes back into it.
import * as THREE from '../../../../../apps/web/public/vendor/three/three.module.min.js';

export const PER_NODE = 20;
export const MAX_NODES = 600;
const MERIDIANS = 6;
const TRAIL = 0.07;
const GREY = 0x8a949a;

/** The numbers each state sets (mind.ts TARGET): how open, how bright the rim and the nodes, how fast, how many pulses. */
export const TARGET = {
  idle: { open: 0, rim: 1, bright: 1, spin: 0.09, pulses: 4, pace: 0.22, busy: 0, grey: 0 },
  listening: { open: 1, rim: 1.6, bright: 1.25, spin: 0.12, pulses: 6, pace: 0.3, busy: 0, grey: 0 },
  thinking: { open: 0.3, rim: 1.25, bright: 1.15, spin: 0.2, pulses: 36, pace: 1.5, busy: 0, grey: 0 },
  speaking: { open: 0.45, rim: 1.35, bright: 1.2, spin: 0.12, pulses: 10, pace: 0.5, busy: 0, grey: 0 },
  busy: { open: 0.15, rim: 1.1, bright: 1.05, spin: 0.1, pulses: 8, pace: 0.35, busy: 1, grey: 0 },
  offline: { open: 0, rim: 0.6, bright: 0.55, spin: 0.04, pulses: 0, pace: 0.2, busy: 0, grey: 1 },
  // NEW for the five states (BRIEF-ORB-AND-BOOT): attending, the reticle has landed on a thing: it holds nearly still (the turn
  // to a third of idle's) and its core brightens a step; the box in the accent is the mark that says so. 'saying' is 'speaking'.
  attending: { open: 0.2, rim: 1.2, bright: 1.1, spin: 0.03, pulses: 6, pace: 0.3, busy: 0, grey: 0 },
};
TARGET.saying = TARGET.speaking;
/** The whole of Mind, as Home draws it. */
export const BOOT_DONE = { gather: 1, links: 1, sphere: 1, haze: 1, mer: 1, rim: 1, scale: 1, core: 1, turn: 0, push: 1, sweep: NaN, trails: 0, refract: 0 };

/** Today's library, as the brain reports it (the sample the hero mock-ups used: 4,186 passages, 1,312 studied, eight fields). */
export const SAMPLE = {
  passages: 4186,
  fields: [
    ['Maths', 34, 14], ['Science', 38, 12], ['English', 30, 11], ['History', 22, 6],
    ['Geography', 20, 5], ['Computing', 26, 9], ['Reading', 24, 7], ['General', 15, 2],
  ].map(([name, topics, read]) => ({ name, topics, read })),
};

export function plan(d) {
  const want = Math.round(Math.max(0, d.passages) / PER_NODE);
  const total = Math.min(MAX_NODES, want);
  const perNode = total && want > MAX_NODES ? Math.ceil(d.passages / MAX_NODES) : PER_NODE;
  const fields = d.fields.filter((f) => f.topics > 0).sort((a, b) => b.topics - a.topics);
  const out = [];
  if (!total) return { fields: [], nodes: 0, lit: 0, perNode };
  if (!fields.length) out.push({ name: 'Library', nodes: total, lit: 0 });
  else {
    const all = fields.reduce((n, f) => n + f.topics, 0);
    let left = total;
    for (const [i, f] of fields.entries()) {
      if (left <= 0) break;
      const share = i === fields.length - 1 ? left : Math.max(1, Math.round((total * f.topics) / all));
      const n = Math.min(left, share);
      left -= n;
      out.push({ name: f.name, nodes: n, lit: Math.min(n, Math.round((n * Math.min(f.read, f.topics)) / f.topics)) });
    }
  }
  return { fields: out, nodes: out.reduce((n, f) => n + f.nodes, 0), lit: out.reduce((n, f) => n + f.lit, 0), perNode };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash3 = (x, y, z) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
function gathered(a, i, x, y, z, g) {
  const r = hash3(x, y, z);
  const k = ease((g - 0.35 * r) / 0.65);
  const sw = (1 - k) * (1.4 + r * 1.6);
  const c = Math.cos(sw);
  const s = Math.sin(sw);
  a[i] = (x * c - z * s) * k;
  a[i + 1] = y * k + (1 - k) * (r - 0.5) * 0.12 * Math.sin(k * Math.PI);
  a[i + 2] = (x * s + z * c) * k;
}

/** The accent and its pale tint from the tokens on <html> (BETTER 2), and the glow the world allows (BETTER 3: glowNow()). */
export function tokens(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const rgb = (name, fb) => {
    const v = cs.getPropertyValue(name).trim();
    const m = v.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? new THREE.Color(+m[1] / 255, +m[2] / 255, +m[3] / 255) : new THREE.Color(fb);
  };
  const num = (name, fb) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fb;
  };
  return { c: rgb('--g-accent-rgb', 0x64d2ff), pale: rgb('--g-accent-pale-rgb', 0xbff0ff), glow: num('--g-glow', 1) * num('--g-room-glow', 1) };
}

export class Orb {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.parts = {};
    this.pulses = [];
    this.links = [];
    this.p = { ...TARGET.idle };
    this.level = opts.level ?? 0;
    this.st = 'idle';
    this.boot = null;
    this.tok = tokens(opts.tokensFrom);
    this.colours();
    this.build();
    this.setData(opts.data ?? SAMPLE);
  }

  /** The accent from the theme's tokens, and its tints (mind.ts colours()). */
  colours() {
    const c = this.tok.c.clone();
    const pale = this.tok.pale.clone();
    this.col = { c, pale, soft: c.clone().lerp(pale, 0.55), dimLink: c.clone().lerp(new THREE.Color(0xd2dbe1), 0.6), dimNode: c.clone().lerp(new THREE.Color(0xe8ecef), 0.85) };
  }

  /** Draw at `w` × `h` CSS pixels (mind.ts size()): the sphere fills about as much of the box as the 2-D reactor's housing did. */
  size(w, h, dpr = Math.min(2, devicePixelRatio || 1)) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const fill = 0.74;
    this.camera.aspect = aspect;
    this.camZ = 1 / (Math.tan((15 * Math.PI) / 180) * fill * Math.min(1, aspect));
    this.camera.position.set(0, 0, this.camZ);
    this.camera.updateProjectionMatrix();
  }

  build() {
    const T = THREE;
    const r = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
    r.setClearColor(0x000000, 0);
    r.toneMapping = T.NeutralToneMapping ?? T.ACESFilmicToneMapping;
    r.outputColorSpace = T.SRGBColorSpace;
    this.renderer = r;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 5);
    this.camZ = 5;
    this.root = new T.Group();
    this.spin = new T.Group();
    this.root.add(this.spin);
    this.scene.add(this.root);
    this.root.scale.setScalar(0.9);
    const P = this.parts;
    const C = this.col.c.getHex();
    const PALE = this.col.pale.getHex();

    P.rimSoft = new T.Mesh(new T.SphereGeometry(1, 96, 64), this.fresnel(C, 2.4, 0.5, T.DoubleSide));
    // BETTER 1: the crisp rim a little tighter (9, not 7), so the edge reads as one line
    P.rimCrisp = new T.Mesh(new T.SphereGeometry(1.002, 96, 64), this.fresnel(PALE, 9, 0.95, T.FrontSide));
    P.haze = new T.Mesh(new T.SphereGeometry(0.96, 48, 32), this.hazeMat());
    this.root.add(P.haze, P.rimSoft, P.rimCrisp);
    const lineMat = (P.lineMat = new T.LineBasicMaterial({ color: C, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false }));
    const circle = (rad, n = 128) => new T.BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, i) => new T.Vector3(Math.cos((i / n) * Math.PI * 2) * rad, Math.sin((i / n) * Math.PI * 2) * rad, 0)));
    P.merMats = [];
    for (let i = 0; i < MERIDIANS; i++) {
      const mat = lineMat.clone();
      P.merMats.push(mat);
      const m = new T.Line(circle(1), mat);
      m.rotation.y = (i / MERIDIANS) * Math.PI;
      this.spin.add(m);
    }
    for (const lat of [-0.62, -0.31, 0.31, 0.62]) {
      const m = new T.Line(circle(Math.cos(lat)), lineMat);
      m.rotation.x = Math.PI / 2;
      m.position.y = Math.sin(lat);
      this.spin.add(m);
    }
    const eq = new T.Group();
    P.eqMat = new T.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    eq.add(new T.Mesh(new T.TorusGeometry(1.06, 0.004, 6, 200), P.eqMat));
    const tp = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const l = i % 10 === 0 ? 0.06 : 0.025;
      tp.push(new T.Vector3(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0), new T.Vector3(Math.cos(a) * (1.06 + l), Math.sin(a) * (1.06 + l), 0));
    }
    P.tickMat = new T.LineBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
    P.tickGeo = new T.BufferGeometry().setFromPoints(tp);
    eq.add(new T.LineSegments(P.tickGeo, P.tickMat));
    eq.rotation.x = Math.PI / 2 - 0.42;
    this.root.add(eq);
    P.eq = eq;
    P.tilt = new T.Mesh(new T.TorusGeometry(1.13, 0.0025, 6, 200), new T.MeshBasicMaterial({ color: C, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false }));
    P.tilt.rotation.set(1.15, 0.5, 0);
    this.root.add(P.tilt);
    P.ear = new T.Mesh(new T.TorusGeometry(1.0, 0.006, 8, 200), new T.MeshBasicMaterial({ color: PALE, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.root.add(P.ear);
    P.sweep = new T.Mesh(new T.TorusGeometry(1, 0.005, 6, 160), new T.MeshBasicMaterial({ color: PALE, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    P.sweep.rotation.x = Math.PI / 2;
    P.sweep.visible = false;
    this.spin.add(P.sweep);
    P.sweep2 = new T.Mesh(new T.TorusGeometry(1, 0.004, 6, 160), new T.MeshBasicMaterial({ color: C, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    P.sweep2.rotation.set(Math.PI / 2 + 0.16, 0, 0.05);
    P.sweep2.visible = false;
    this.spin.add(P.sweep2);
    P.flare = this.glow(PALE, 1, 0);
    P.flare.scale.set(2.5, 0.07, 1);
    P.flare.visible = false;
    this.root.add(P.flare);
    P.nucleus = new T.Mesh(new T.SphereGeometry(0.06, 32, 16), new T.MeshBasicMaterial({ color: 0xffffff }));
    this.spin.add(P.nucleus);
    P.h1 = this.glow(0xffffff, 0.3, 0.85);
    P.h2 = this.glow(C, 0.95, 0.45);
    P.h3 = this.glow(C, 2.8, 0.12);
    this.root.add(P.h3, P.h2, P.h1);
  }

  /** The soft round light (mind.ts glowTexture()): the halos and the haze sprites. */
  glowTexture() {
    if (this.glowTex) return this.glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    this.glowTex = new THREE.CanvasTexture(c);
    this.glowTex.colorSpace = THREE.SRGBColorSpace;
    return this.glowTex;
  }
  /** BETTER 1: a crisp point (a hard edge, one pixel of feather) for the nodes themselves; the halos keep the soft light. */
  pointTexture() {
    if (this.pointTex) return this.pointTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(0.62, 'rgba(255,255,255,0.35)');
    grd.addColorStop(0.72, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.pointTex = new THREE.CanvasTexture(c);
    this.pointTex.colorSpace = THREE.SRGBColorSpace;
    return this.pointTex;
  }
  glow(color, size, opacity) {
    const T = THREE;
    const s = new T.Sprite(new T.SpriteMaterial({ map: this.glowTexture(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.scale.setScalar(size);
    return s;
  }
  fresnel(color, power, strength, side) {
    const T = THREE;
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPower; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); float a = clamp(f * uStrength, 0.0, 1.0); gl_FragColor = vec4(uColor * a, a); }',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side,
    });
  }
  hazeMat() {
    const T = THREE;
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: this.col.c.clone() }, uStrength: { value: 0.07 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = f * uStrength; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.BackSide,
    });
  }

  setData(d) {
    const pl = plan(d);
    this.plan = pl;
    this.buildStars(pl.fields);
  }

  /** The constellation (mind.ts buildStars()): one cluster per field round a shell inside the sphere, nodes, links, pulses. */
  buildStars(fields) {
    const T = THREE;
    if (this.stars) this.spin.remove(this.stars);
    const g = new T.Group();
    this.stars = g;
    this.spin.add(g);
    this.pulses = [];
    this.links = [];
    const n = fields.length;
    if (!n) return;
    const rand = rng(42 + n);
    const gauss = () => {
      let u = 0;
      let v = 0;
      while (!u) u = rand();
      while (!v) v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const shell = n === 1 ? 0 : n < 6 ? 0.56 : 0.64;
    const hubs = fields.map((_, i) => {
      if (n === 1) return new T.Vector3(0, 0, 0);
      const y = 1 - ((i + 0.5) * 2) / n;
      const rr = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return new T.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(shell);
    });
    const nodes = [];
    fields.forEach((f, i) => {
      const sigma = n === 1 ? 0.3 : Math.min(0.1, 0.03 + 0.012 * Math.sqrt(f.nodes));
      for (let j = 0; j < f.nodes; j++) {
        const p = hubs[i].clone().add(new T.Vector3(gauss(), gauss(), gauss()).multiplyScalar(sigma));
        if (p.length() > 0.9) p.multiplyScalar(0.9 / p.length());
        nodes.push({ p, f: i, lit: j < f.lit });
      }
    });
    const C = this.col.c.getHex();
    fields.forEach((f, i) => {
      const s = this.glow(f.lit ? C : 0xcfe3ec, 0.22 + 0.06 * Math.sqrt(f.nodes), f.lit ? 0.24 : 0.09);
      s.position.copy(hubs[i]);
      s.userData.base = s.material.opacity;
      s.userData.lit = !!f.lit;
      g.add(s);
    });
    const pts = (list, size, color, opacity, crisp) => {
      const m = new T.PointsMaterial({ map: crisp ? this.pointTexture() : this.glowTexture(), color, size, sizeAttenuation: true, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
      const o = new T.Points(new T.BufferGeometry().setFromPoints(list.map((x) => x.p)), m);
      o.userData.home = Float32Array.from(o.geometry.attributes.position.array);
      o.userData.at = 1;
      g.add(o);
      return o;
    };
    const lit = nodes.filter((x) => x.lit);
    const dim = nodes.filter((x) => !x.lit);
    // BETTER 1: the nodes themselves crisp (dim, litCore); the halo round a lit node stays soft
    this.parts.dim = pts(dim, 0.05, 0xcfe3ec, 0.5, true);
    this.parts.halo = pts(lit, 0.3, C, 0.16, false);
    this.parts.lit = pts(lit, 0.15, C, 0.95, false);
    this.parts.litCore = pts(lit, 0.045, 0xffffff, 1, true);
    {
      const all = [...lit, ...dim];
      const home = Float32Array.from(all.flatMap((x) => [x.p.x, x.p.y, x.p.z]));
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(all.length * 12), 3));
      const col = new Float32Array(all.length * 12);
      all.forEach((x, j) => {
        const v = x.lit ? 1 : 0.45;
        [0, 0.35 * v, 0.35 * v, v].forEach((c, q) => col.set([c, c, c], j * 12 + q * 3));
      });
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.LineBasicMaterial({ color: C, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const tr = new T.LineSegments(geo, m);
      tr.userData.home = home;
      tr.visible = false;
      tr.frustumCulled = false;
      g.add(tr);
      this.parts.trails = tr;
    }
    const near = (a, list, k) => list.filter((b) => b !== a).sort((x, y) => x.distanceTo(a) - y.distanceTo(a)).slice(0, k);
    const segDim = [];
    const segLit = [];
    fields.forEach((_, i) => {
      const mine = nodes.filter((x) => x.f === i);
      for (const a of mine)
        for (const bp of near(a.p, mine.map((x) => x.p), 2)) {
          const b = mine.find((x) => x.p === bp);
          const bright = a.lit || b.lit;
          (bright ? segLit : segDim).push(a.p, b.p);
          this.links.push([a.p, b.p, bright]);
        }
      if (n > 1) {
        for (const hb of near(hubs[i], hubs, 2)) {
          segDim.push(hubs[i], hb);
          this.links.push([hubs[i], hb, false]);
        }
        const z = new T.Vector3();
        (fields[i].lit ? segLit : segDim).push(z, hubs[i]);
        this.links.push([z, hubs[i], !!fields[i].lit]);
      }
    });
    const lm = (color, opacity, list) => {
      const m = new T.LineBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
      g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(list), m));
      return m;
    };
    this.parts.linkDim = lm(0x9fd8ee, 0.12, segDim);
    this.parts.linkLit = lm(C, 0.38, segLit);
    const pool = this.links.filter((l) => l[2]).length ? this.links.filter((l) => l[2]) : this.links;
    for (let i = 0; i < 36 && pool.length; i++) {
      const s = this.glow(0xffffff, 0.08, 0);
      const l = pool[Math.floor(rand() * pool.length)];
      this.pulses.push({ s, link: [l[0], l[1]], off: rand(), sp: 0.6 + rand() * 0.8 });
      g.add(s);
    }
  }

  gatherAt(g) {
    for (const key of ['dim', 'halo', 'lit', 'litCore']) {
      const o = this.parts[key];
      const pos = o?.geometry?.attributes?.position;
      const home = o?.userData?.home;
      if (!pos || !home) continue;
      if (g >= 1 && o.userData.at === 1) continue;
      o.userData.at = g >= 1 ? 1 : g;
      const a = pos.array;
      for (let i = 0; i < a.length; i += 3) gathered(a, i, home[i], home[i + 1], home[i + 2], g);
      pos.needsUpdate = true;
    }
    const tr = this.parts.trails;
    const tpos = tr?.geometry?.attributes?.position;
    const th = tr?.userData?.home;
    if (!tpos || !th) return;
    tr.visible = !!this.boot && this.boot.trails > 0 && g > 0 && g < 1;
    if (!tr.visible) return;
    const a = tpos.array;
    for (let j = 0, n = th.length / 3; j < n; j++) {
      const x = th[j * 3];
      const y = th[j * 3 + 1];
      const z = th[j * 3 + 2];
      const o = j * 12;
      gathered(a, o, x, y, z, g - TRAIL);
      gathered(a, o + 3, x, y, z, g - TRAIL / 2);
      a.copyWithin(o + 6, o + 3, o + 6);
      gathered(a, o + 9, x, y, z, g);
    }
    tpos.needsUpdate = true;
  }

  /**
   * One frame: `t` seconds on the orb's clock, `state` one of TARGET's (its numbers taken whole: a still, as Reduce Motion draws
   * one), `look` the boot's BootLook for this frame (null: Home's whole Mind), `kick` the warm return's breath.
   */
  draw(t, state = 'idle', look = null, kick = 0) {
    const T = THREE;
    const P = this.parts;
    this.st = state;
    this.p = { ...TARGET[state] };
    const p = this.p;
    this.boot = look;
    const breath = 1 + 0.06 * Math.sin(t * 1.6) + 0.25 * kick;
    const b = look ?? BOOT_DONE;
    this.gatherAt(b.gather);
    this.camera.position.z = this.camZ * b.push;
    const C = this.col;
    const tint = (c) => (typeof c === 'number' ? new T.Color(c) : c.clone()).lerp(new T.Color(GREY), p.grey);
    this.spin.rotation.y = t * p.spin + b.turn;
    this.spin.rotation.x = 0.28;
    this.root.rotation.z = 0.08;
    P.eq.rotation.z = -t * 0.04;
    P.tilt.rotation.z = t * 0.03;
    this.spin.scale.setScalar(1 + 0.08 * p.open);
    P.rimSoft.material.uniforms.uStrength.value = 0.5 * p.rim * breath * b.sphere * b.rim;
    P.rimSoft.material.uniforms.uColor.value.copy(tint(C.c));
    P.rimCrisp.material.uniforms.uStrength.value = 0.9 * Math.min(1.4, p.rim) * b.sphere * b.rim;
    P.haze.material.uniforms.uStrength.value = 0.07 * b.sphere * b.haze;
    P.lineMat.opacity = 0.05 * b.sphere;
    P.merMats.forEach((m, i) => {
      const x = b.mer * (MERIDIANS + 1) - i;
      const lit = x <= 0 ? 0 : x >= 1 ? 1 : x;
      const caught = x > 0 && x < 1.6 ? Math.sin((Math.PI * x) / 1.6) : 0;
      m.opacity = 0.05 * b.sphere * lit + 0.34 * caught;
      m.color.copy(tint(C.c)).lerp(tint(C.pale), Math.min(1, caught));
    });
    P.tilt.material.opacity = 0.32 * b.sphere;
    P.eqMat.opacity = 0.7 * Math.min(1, b.scale * 2);
    P.tickGeo.setDrawRange(0, look ? 2 * Math.round(120 * b.scale) : Infinity);
    P.sweep.visible = Number.isFinite(b.sweep) && Math.abs(b.sweep) < 1;
    if (P.sweep.visible) {
      P.sweep.position.y = b.sweep;
      P.sweep.scale.setScalar(Math.sqrt(1 - b.sweep * b.sweep) * (0.45 + 0.4 * b.gather));
      P.sweep.material.opacity = 0.7 * (1 - Math.abs(b.sweep));
      P.sweep.material.color.copy(tint(C.pale));
    }
    const flare = Number.isFinite(b.sweep) ? b.refract * Math.max(0, 1 - Math.abs(b.sweep) / 0.16) : 0;
    P.flare.visible = flare > 0.01;
    if (P.flare.visible) {
      P.flare.material.opacity = 0.85 * flare;
      P.flare.material.color.copy(tint(C.pale));
      P.sweep.material.opacity *= 1 + 0.9 * flare;
    }
    const y2 = Number.isFinite(b.sweep) && b.sweep < 0 ? b.sweep * 1.22 : NaN;
    P.sweep2.visible = b.refract > 0 && Number.isFinite(y2) && y2 > -1;
    if (P.sweep2.visible) {
      P.sweep2.position.y = y2;
      P.sweep2.scale.setScalar(Math.sqrt(1 - y2 * y2) * (0.45 + 0.4 * b.gather));
      P.sweep2.material.opacity = b.refract * 0.42 * (1 - Math.abs(y2)) * Math.min(1, -b.sweep / 0.12);
      P.sweep2.material.color.copy(tint(C.c));
    }
    if (P.trails?.visible) {
      P.trails.material.opacity = 0.5 * b.trails;
      P.trails.material.color.copy(tint(C.c));
    }
    P.rimCrisp.material.uniforms.uColor.value.copy(tint(C.pale));
    P.haze.material.uniforms.uColor.value.copy(tint(C.c));
    P.eqMat.color.copy(tint(C.soft));
    P.tickMat.color.copy(tint(C.soft));
    P.ear.material.color.copy(tint(C.pale));
    P.tilt.material.color.copy(tint(C.c));
    P.lineMat.color.copy(tint(C.c));
    const lv = state === 'listening' ? Math.min(1, this.level * 1.6) : 0;
    P.ear.scale.setScalar(1.02 + 0.22 * lv + 0.04 * p.open * Math.sin(t * 2.4));
    P.ear.material.opacity = 0.5 * p.open * (0.4 + 0.6 * lv);
    P.h1.scale.setScalar(0.3 * (1 + 0.6 * p.open) * breath);
    P.h2.scale.setScalar(0.95 * (1 + 0.3 * p.open) * breath);
    P.h1.material.color.copy(tint(0xffffff));
    P.h2.material.color.copy(tint(C.c));
    P.h3.material.color.copy(tint(C.c));
    P.h1.material.opacity = 0.85 * b.core;
    // BETTER 3: the halos glow as much as the world does (glowNow(): --g-glow × --g-room-glow)
    const halo = this.tok.glow;
    P.h2.material.opacity = 0.45 * p.bright * b.core * halo;
    P.h3.material.opacity = 0.12 * p.bright * Math.max(b.sphere, 0.4 * b.core) * halo;
    P.nucleus.visible = b.core > 0.02;
    P.nucleus.material.color.copy(tint(0xffffff));
    const beat = p.busy ? 1 + 0.35 * p.busy * Math.sin(t * 2.2) : 1;
    const seen = Math.min(1, b.gather * 4);
    if (P.lit) {
      P.lit.material.size = 0.15 * (1 + 0.2 * p.open) * beat;
      P.lit.material.opacity = Math.min(1, 0.85 * p.bright) * seen;
      P.lit.material.color.copy(tint(C.c));
      P.litCore.material.opacity = seen;
      P.halo.material.opacity = 0.16 * p.bright * beat * seen * halo;
      P.halo.material.color.copy(tint(C.c));
      P.linkLit.opacity = 0.34 * p.bright * b.links;
      P.linkLit.color.copy(tint(C.c));
      P.dim.material.opacity = 0.5 * (1 - 0.3 * p.grey) * seen;
      P.dim.material.color.copy(tint(C.dimNode));
      if (P.linkDim) {
        P.linkDim.color.copy(tint(C.dimLink));
        P.linkDim.opacity = 0.12 * b.links;
      }
    }
    for (const c of this.stars?.children ?? []) {
      if (c.isSprite && c.userData.base !== undefined) {
        c.material.opacity = c.userData.base * (c.userData.lit ? p.bright * beat : 1) * b.links;
        c.material.color.copy(tint(c.userData.lit ? C.c : C.dimNode));
      }
    }
    const shown = Math.round(p.pulses);
    this.pulses.forEach((q, i) => {
      const f = (q.off + t * q.sp * p.pace) % 1;
      q.s.position.copy(q.link[0]).lerp(q.link[1], f);
      q.s.material.opacity = i < shown ? Math.sin(f * Math.PI) * (1 - p.grey) * b.links : 0;
      q.s.material.color.copy(tint(C.pale));
    });
    this.renderer.render(this.scene, this.camera);
  }
}
