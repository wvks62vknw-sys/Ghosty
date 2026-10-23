// The hero kit: one small WebGL stage that any of the hero options (core, mind, gyro) plugs into.
// It is written the way the app would run it (apps/web/src/features/core/reactor.ts):
//   - one WebGL context, a transparent canvas over the page, true black stays the page's;
//   - real lighting: a studio environment for reflections (RoomEnvironment) and the object's own cyan light;
//   - states: idle (slow breathing), listen (opens and brightens), think (ripples or pulses), study (steady pulse);
//   - battery sense: 30 fps when idle, 60 when active, paused while the page is hidden, one still frame when the
//     owner asks for reduced motion.
// For the mock-ups the same code draws ONE frame at a chosen time (?t=) and state (?state=), then says it is ready.
import * as THREE from '../../../../apps/web/public/vendor/three/three.module.min.js';
import { RoomEnvironment } from '../../../../apps/web/public/vendor/three/addons/environments/RoomEnvironment.js';

export { THREE };
export const CYAN = new THREE.Color('#64d2ff');

/** A small seeded random generator, so every still is the same each time it is drawn. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft round light, drawn once into a canvas: the glow, the volumetric haze and the node sprites use it. */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
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
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** An additive glow sprite of a colour and size. */
export function glow(color = CYAN, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

/** A view-dependent rim light (Fresnel): what makes a glass shell or a hologram read as a solid volume. */
export function fresnelMaterial(color = CYAN, { power = 2.4, strength = 1, base = 0.0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength }, uBase: { value: base } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower; uniform float uStrength; uniform float uBase; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); float a = clamp(uBase + f * uStrength, 0.0, 1.0); gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** The states, as numbers a scene can use: how open, how bright, how fast, how much pulse. */
export function stateParams(state) {
  return {
    idle: { open: 0, bright: 1, speed: 1, pulse: 0, ripple: 0 },
    listen: { open: 1, bright: 1.55, speed: 1.4, pulse: 0, ripple: 0 },
    think: { open: 0.35, bright: 1.25, speed: 2.2, pulse: 0, ripple: 1 },
    study: { open: 0.2, bright: 1.15, speed: 1.2, pulse: 1, ripple: 0 },
  }[state] ?? { open: 0, bright: 1, speed: 1, pulse: 0, ripple: 0 };
}

/**
 * Mount a hero option on a canvas. `opts`: { option, state, t (seconds), live (animate), view (camera framing) }.
 * Returns { render(t, state), dispose() }.
 */
export async function mount(canvas, opts) {
  const { option, state = 'idle', t = 12.5, live = false } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power', preserveDrawingBuffer: !live });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.25;

  // The object's radius is 1. The camera frames it so that radius 1 fills `fill` of the canvas half-width.
  const fill = opts.fill ?? 0.66;
  const fov = 30;
  const camera = new THREE.PerspectiveCamera(fov, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  const dist = 1 / (Math.tan((fov / 2) * Math.PI / 180) * fill);
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);

  const mod = await import(`./${option}/scene.js`);
  const hero = mod.build({ THREE, scene, camera, renderer, glow, glowTexture, fresnelMaterial, stateParams, rng, CYAN });
  scene.add(hero.object);

  const draw = (time, st) => {
    hero.update(time, st, stateParams(st));
    renderer.render(scene, camera);
  };

  // A still for the mock-ups (and for "reduce motion" in the app).
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!live || reduce) {
    draw(t, state);
    return { render: draw, dispose: () => renderer.dispose() };
  }
  // Live: 30 fps when idle, 60 when active; nothing while the page is hidden.
  let cur = state, last = 0, raf = 0;
  const loop = (ms) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const fps = cur === 'idle' ? 30 : 60;
    if (ms - last < 1000 / fps - 1) return;
    last = ms;
    draw(ms / 1000, cur);
  };
  raf = requestAnimationFrame(loop);
  return { render: draw, set: (s) => (cur = s), dispose: () => { cancelAnimationFrame(raf); renderer.dispose(); } };
}

/** For the mock-up pages: mount every canvas[data-hero] on the page, then flag ready for the renderer. */
export async function mountAll() {
  const q = new URLSearchParams(location.search);
  const list = [...document.querySelectorAll('canvas[data-hero]')];
  for (const c of list) {
    await mount(c, { option: c.dataset.hero, state: c.dataset.state ?? q.get('state') ?? 'idle', t: Number(c.dataset.t ?? q.get('t') ?? 12.5), fill: Number(c.dataset.fill ?? 0.66) });
  }
  window.__heroReady = true;
}
