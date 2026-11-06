/**
 * MIND AS THE MACHINE'S EYE (BRIEF-DESIGN-SYSTEM 3; his pick, W1 THE SCAN): the orb as the mock draws it
 * (docs/build-plan/mockups/directions-2/lib/gl.js `mindOrb`), as one fragment shader: a sphere of points sampled on rings (the
 * far side fainter), the constellation of what Ghosty knows inside it (a few nodes lit in the accent), a small hard core in
 * the accent with a bone middle, one hairline where the points thin out at its edge, and NO glow halo. It turns slowly; while
 * it listens it breathes (the core and the points swell and settle about every two and a half seconds). Reduce Motion: one
 * still frame, never breathing. The accent is the theme's (`--g-accent-rgb`, tokens.css), read again on every theme change.
 *
 * Light on the battery: it draws only while it is on screen and the page is visible (an IntersectionObserver and
 * visibilitychange), at 30 frames a second while listening and 15 while idle, into a canvas at most twice the CSS size; a
 * browser with no WebGL gets the eye drawn flat (ui/machine.ts eyeGlyph) and says so. Today it lives on Settings → THE LOOK;
 * Home's hero, the switcher and the boot keep today's Mind until the shell pass moves them onto this one.
 */
import { h } from '../core/dom';
import { themeEvents } from '../state/theme';
import { eyeGlyph } from './machine';

export type EyeState = 'idle' | 'listening';

/** What the eye is doing, for THE LOOK's words and the checks (window.__ghosty.look.eye). */
export interface EyeInfo {
  mode: 'gl' | 'flat' | '';
  state: EyeState;
  breathing: boolean;
  still: boolean;
  frames: number;
  accent: string;
}

export interface Eye {
  el: HTMLElement;
  info: EyeInfo;
  set(s: EyeState): void;
  /** Stop drawing for good (the screen is gone). */
  stop(): void;
}

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }';

// The orb in its own space: centre 0, radius 1, seen from z = 3.2. Ported from the mock's mindOrb (the same rings of
// points, the same constellation cells and the same core), with the halo taken out and the turn and the breath added.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uSpin, uBreath, uLit;
uniform vec3 uAccent, uBone;
#define PI 3.14159265
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
mat3 frame(float spin) {
  float a = .5 + spin, b = .42;
  mat3 ry = mat3(cos(a), 0., -sin(a), 0., 1., 0., sin(a), 0., cos(a));
  mat3 rx = mat3(1., 0., 0., 0., cos(b), sin(b), 0., -sin(b), cos(b));
  return rx * ry;
}
float sphereDots(vec3 q) {
  float th = acos(clamp(q.y, -1., 1.)), ph = atan(q.z, q.x);
  float rings = 40., dth = PI / rings, best = 9.;
  float i0 = floor(th / dth + .5);
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k);
    if (i < 0. || i > rings) continue;
    float t = i * dth; float n = max(1., floor(2. * PI * sin(t) / dth + .5));
    float j = floor(ph / (2. * PI / n) + .5 + .5 * mod(i, 2.)) - .5 * mod(i, 2.);
    float pp = j * 2. * PI / n;
    vec3 s = vec3(sin(t) * cos(pp), cos(t), sin(t) * sin(pp));
    best = min(best, length(s - q));
  }
  return best;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float scale = 1. + .018 * uBreath;
  // (the silhouette, asin(1 / 3.2) seen from z = 3.2, lands 0.44 of the canvas from its centre: the orb fills 88 % of it)
  vec3 ro = vec3(0., 0., 3.2), rd = normalize(vec3(uv * 1.99, -2.66));
  ro /= scale;
  float px = 2.3 / uRes.y / scale;
  mat3 F = frame(uSpin); vec3 o = F * ro, d = F * rd;
  vec3 col = vec3(0.); float cov = 0.;
  float b = dot(o, d), c = dot(o, o) - 1.; float hh = b * b - c;
  float miss = sqrt(max(c - b * b + 1., 0.));
  float sil = smoothstep(px * 1.6, 0., abs(miss - 1.)) * .65;
  col += uBone * sil; cov = max(cov, sil);
  if (hh > 0.) {
    float t0 = -b - sqrt(hh), t1 = -b + sqrt(hh);
    vec3 pf = o + d * t0, pb = o + d * t1;
    float rr = px * 1.1 + .009 * (1. + .25 * uBreath);
    float df = sphereDots(normalize(pf)), db = sphereDots(normalize(pb));
    float edge = pow(1. - abs(dot(normalize(pf), d)), 2.);
    float front = smoothstep(rr, rr - px * 1.5, df) * (.72 + .5 * edge) * (.9 + .1 * uBreath);
    float back = smoothstep(rr * .8, rr * .8 - px * 1.5, db) * .3;
    vec3 inner = vec3(0.);
    for (int i = 0; i < 22; i++) {
      float t = mix(t0, t1, (float(i) + .5) / 22.);
      vec3 q = o + d * t; vec3 g = q * 3.2; vec3 id = floor(g); vec3 f = fract(g) - .5;
      float hs = hash13(id + 4.);
      if (hs > .55 && length(q) < .92) {
        vec3 off = (vec3(hash13(id + 1.), hash13(id + 2.), hash13(id + 3.)) - .5) * .55;
        float dd = length((f - off) - d * dot(f - off, d)) / 3.2;
        float node = smoothstep(px * 1.8 + .012, 0., dd);
        vec3 nc = hs > .8 ? uAccent * 1.6 : uBone * .9;
        inner += nc * node * .5;
      }
    }
    float dc = length(o - d * dot(o, d));
    float lit = uLit * (1. + .35 * uBreath);
    float core = exp(-dc * dc * 120.) * 1.4 + exp(-dc * dc * 18.) * .3;
    inner += mix(uAccent, vec3(1.), .5) * core * lit;
    col += uBone * (front + back) + inner;
    cov = max(cov, max(max(front, back), clamp(length(inner), 0., 1.)));
  }
  col = min(col, vec3(1.));
  gl_FragColor = vec4(col, clamp(cov, 0., 1.));
}
`;

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const triplet = (el: Element, name: string, fallback: [number, number, number]): [number, number, number] => {
  const v = getComputedStyle(el).getPropertyValue(name).split(',').map((x) => parseFloat(x));
  return v.length === 3 && v.every((x) => Number.isFinite(x)) ? (v.map((x) => x / 255) as [number, number, number]) : fallback;
};

/** The eye at `size` CSS px, named for VoiceOver with its state ("My eye: listening"). */
export function machineEye(size: number, o: { label?: string } = {}): Eye {
  const info: EyeInfo = { mode: '', state: 'idle', breathing: false, still: still(), frames: 0, accent: '' };
  const el = h('div.g-orb', { role: 'img', dataset: { g: 'eye' }, style: { width: `${size}px`, height: `${size}px` } });
  const name = () => el.setAttribute('aria-label', `${o.label ?? 'My eye'}: ${info.state === 'listening' ? (info.still ? 'listening, held still' : 'listening, breathing') : 'idle'}`);
  const canvas = h('canvas', { 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const gl = (() => {
    try {
      return canvas.getContext('webgl', { premultipliedAlpha: false, antialias: true, alpha: true }) as WebGLRenderingContext | null;
    } catch {
      return null;
    }
  })();
  let prog: WebGLProgram | null = null;
  const U: Record<string, WebGLUniformLocation | null> = {};
  if (gl) {
    try {
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
        return s;
      };
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const at = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uRes', 'uTime', 'uSpin', 'uBreath', 'uLit', 'uAccent', 'uBone']) U[n] = gl.getUniformLocation(prog, n);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } catch (e) {
      console.warn('eye', e);
      prog = null;
    }
  }
  if (gl && prog) {
    info.mode = 'gl';
    el.append(canvas);
  } else {
    info.mode = 'flat';
    // drawn flat it neither turns nor breathes: it is still, and its name says so
    info.still = true;
    el.append(eyeGlyph(size));
  }

  const t0 = performance.now();
  let raf = 0;
  let timer = 0;
  let seen = false;
  let alive = true;
  let colours = { a: [0.39, 0.82, 1] as [number, number, number], b: [0.925, 0.91, 0.875] as [number, number, number] };
  const readColours = () => {
    colours = { a: triplet(el, '--g-accent-rgb', [0.39, 0.82, 1]), b: triplet(el, '--g-bone-rgb', [0.925, 0.91, 0.875]) };
    info.accent = getComputedStyle(el).getPropertyValue('--g-accent').trim();
  };
  const draw = () => {
    if (!gl || !prog) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(el.clientWidth * dpr));
    if (canvas.width !== w || canvas.height !== w) {
      canvas.width = w;
      canvas.height = w;
    }
    gl.viewport(0, 0, w, w);
    const t = (performance.now() - t0) / 1000;
    const moving = !info.still;
    // the turn: slow (a full turn in about three minutes); the breath: only while listening, never with Reduce Motion
    const spin = moving ? t * 0.035 : 0;
    const breath = moving && info.state === 'listening' ? 0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / 2.6) : 0;
    info.breathing = breath > 0 || (moving && info.state === 'listening');
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes!, w, w);
    gl.uniform1f(U.uTime!, t);
    gl.uniform1f(U.uSpin!, spin);
    gl.uniform1f(U.uBreath!, breath);
    gl.uniform1f(U.uLit!, info.state === 'listening' ? 1.15 : 1);
    gl.uniform3f(U.uAccent!, ...colours.a);
    gl.uniform3f(U.uBone!, ...colours.b);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    info.frames++;
  };
  const loop = () => {
    raf = 0;
    if (!alive || !seen || document.hidden) return;
    draw();
    if (info.still) return; // Reduce Motion: one still frame for each change
    timer = window.setTimeout(() => (raf = requestAnimationFrame(loop)), info.state === 'listening' ? 1000 / 30 : 1000 / 15);
  };
  const kick = () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver((es) => {
    seen = es.some((e) => e.isIntersecting);
    if (seen) kick();
  });
  io.observe(el);
  const vis = () => !document.hidden && seen && kick();
  document.addEventListener('visibilitychange', vis);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    info.still = motion.matches || info.mode === 'flat';
    name();
    kick();
  };
  motion.addEventListener?.('change', onMotion);
  const offTheme = themeEvents.on('change', () => {
    readColours();
    kick();
  });
  requestAnimationFrame(readColours);
  name();
  return {
    el,
    info,
    set(s) {
      info.state = s;
      info.breathing = s === 'listening' && !info.still;
      el.dataset.state = s;
      name();
      kick();
    },
    stop() {
      alive = false;
      io.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
      motion.removeEventListener?.('change', onMotion);
      if (typeof offTheme === 'function') offTheme();
    },
  };
}
