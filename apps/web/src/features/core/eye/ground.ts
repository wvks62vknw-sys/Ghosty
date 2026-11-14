/**
 * THE EYE'S GROUND (BRIEF-EYE-HUD 2): God's Eye's globe, the engine's own, turning slowly under Home's wall as its living ground.
 * It is the shared canvas the page already owns (engine/gfx.ts, one scene at a time, set by the tab) with the globe scene wrapped so that:
 *  - it starts only after Home has been on screen for a while and the world pack is in (never before the first paint: the first screen
 *    and the look page keep their budgets), and costs nothing before that;
 *  - it draws at a few frames a second, fewer the busier the phone is (the scheduler's own frame rate, and how long a draw just took),
 *    nothing at all while the conversation, the jump bar, the plan or the keyboard stand over it, and one still frame under Reduce Motion
 *    or MOTION calm;
 *  - God's Eye's camera is put back as it was when Home lets go, so the God's Eye screen opens exactly as it did.
 * The grain over it is CSS (styles.css THE EYE). No GPS, no network of its own: the world pack is the site's own file.
 */
import { backdrop } from '../../../engine/backdrop';
import { gfx } from '../../../engine/gfx';
import { globe } from '../../../engine/globe';
import { setScene, stats } from '../../../engine/scheduler';
import { World } from '../../../engine/world';

/** What the ground is doing, for the checks and the console (window.__ghosty.eyeground). */
export const groundState = {
  on: false,
  still: false,
  draws: 0,
  interval: 0,
  cost: 0,
  since: 0,
  /** The stamp's small line "Lighting the ground…": whether it is showing now, and how many times it has shown (once a start, on a software GL only). */
  lighting: false,
  said: 0,
  /** The phone's GL is software (the start is a silent ~2 s there; a phone's GPU is tens of ms and never shows the line). */
  soft: false,
  /** On a software GL: how long the frame after a draw waited for it (ms, smoothed), what the draws are spaced by. */
  gpu: 0,
  /** God's Eye's camera as it stands now (the checks: it is as it was once Home has let go). */
  cam: (): { lat: number; lon: number; range: number; tilt: number; hd: number } => ({ lat: globe.cam.lat, lon: globe.cam.lon, range: globe.cam.range, tilt: globe.cam.tilt, hd: globe.cam.hd }),
};

interface Saved {
  lat: number;
  lon: number;
  range: number;
  hd: number;
  tilt: number;
  spin: boolean;
  target: typeof globe.cam.target;
  follow: typeof globe.cam.follow;
}
let saved: Saved | null = null;
let timer = 0;
let tries = 0;
/** The page's own wait before the globe starts (ms). */
const AFTER_SHOWN = 1800;

const calm = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
/** Something stands over the ground (nobody sees it drawn). */
const covered = (): boolean => !!document.querySelector('.hud.core.logopen, #palette.on, body.planned, body.kb, #deck.on, #thestage') || document.hidden;

/** The last time a finger or a key touched the page: the globe never starts under one (its first draw compiles the shaders) and draws nothing for a moment after one (the tap's own frames come first). */
let lastInput = 0;
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => (lastInput = Date.now()), { passive: true, capture: true });
/** The ground is drawn small and thrown to grain by the CSS over it: the engine's resolution is held at this while it is the scene. */
const SCALE = 0.55;
/** [consistency] On a software GL (no GPU: CI's runners, an old laptop) the globe's frame is drawn by the CPU in the GPU process,
 *  1 to 1.5 s a draw (measured: the same at 1x and 2x pixels, and with every layer over it hidden), and a tap waits for the frame in
 *  flight: the jump bar opened in 1.2 to 2.5 s and a long press missed its moment. There the ground is drawn smaller, holds still
 *  for SOFT_HOLD after any touch or key, and its draws are spaced by what they cost (SOFT_GAP of them, SOFT_MS to SOFT_MAX). */
const SCALE_SOFT = 0.35;
const SOFT_MS = 1500;
const SOFT_MAX = 6000;
const SOFT_GAP = 6;
const SOFT_HOLD = 4000;
let scaleWas = 1;

/** Is the engine's GL software (SwiftShader, llvmpipe, a basic renderer)? Read from the context the engine already holds; unknown is a GPU. */
function softGL(): boolean {
  try {
    const gl = gfx.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return !!ext && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)));
  } catch {
    return false;
  }
}
/** The stamp's small line (Home's own element, handed in at the start). */
let light: HTMLElement | null = null;
const lamp = (on: boolean) => {
  if (groundState.lighting === on) return;
  groundState.lighting = on;
  if (on) groundState.said++;
  if (light) light.hidden = !on;
};

const scene = {
  acc: 0,
  last: 0,
  update(dt: number): void {
    this.acc += dt;
  },
  draw(): void {
    const now = performance.now();
    if (covered()) {
      this.acc = 0;
      return;
    }
    if (groundState.still && groundState.draws > 0) return;
    if (Date.now() - lastInput < (groundState.soft ? SOFT_HOLD : 1200)) return;
    const base = groundState.soft ? Math.min(SOFT_MAX, Math.max(SOFT_MS, groundState.gpu * SOFT_GAP)) : stats.fps < 20 ? 250 : stats.fps < 40 ? 125 : 83;
    groundState.interval = Math.round(Math.max(base, groundState.cost * 7));
    if (now - this.last < groundState.interval) return;
    this.last = now;
    const dt = Math.min(0.5, this.acc);
    this.acc = 0;
    const scale = groundState.soft ? SCALE_SOFT : SCALE;
    if (gfx.scale > scale) {
      gfx.scale = scale;
      gfx.resize();
    }
    globe.update(dt);
    globe.draw();
    groundState.draws++;
    lamp(false);
    groundState.cost = groundState.cost * 0.7 + (performance.now() - now) * 0.3;
    // (what the GPU took: the next frame waits for this one)
    if (groundState.soft) requestAnimationFrame(() => (groundState.gpu = groundState.gpu ? groundState.gpu * 0.5 + (performance.now() - now) * 0.5 : performance.now() - now));
  },
};

function begin(): void {
  timer = 0;
  if (!document.body.classList.contains('eyehome') || groundState.on) return;
  if (Date.now() - lastInput < 2500) {
    timer = window.setTimeout(begin, 700);
    return;
  }
  if (!gfx.ready || !World.ready) {
    if (++tries < 40) timer = window.setTimeout(begin, 1000);
    return;
  }
  groundState.soft = softGL();
  // a software GL compiles the globe's shaders in one silent ~2 s: the stamp says so once, and the work waits a frame or two for it to be seen
  if (groundState.soft) {
    lamp(true);
    requestAnimationFrame(() => (timer = window.setTimeout(light_, 30)));
    return;
  }
  light_();
}

function light_(): void {
  timer = 0;
  if (!document.body.classList.contains('eyehome') || groundState.on) return lamp(false);
  const c = globe.cam;
  saved = { lat: c.lat, lon: c.lon, range: c.range, hd: c.hd, tilt: c.tilt, spin: c.autoSpin, target: { ...c.target }, follow: c.follow };
  globe.init();
  c.fly = null;
  c.follow = null;
  c.lat = 22;
  c.lon = -18;
  c.range = 15000;
  c.hd = 0;
  c.tilt = 0;
  c.target = { lat: 22, lon: -18, range: 15000, hd: 0, tilt: 0 };
  groundState.still = calm();
  c.autoSpin = !groundState.still;
  groundState.on = true;
  groundState.draws = 0;
  groundState.since = Date.now();
  scene.acc = 0;
  scene.last = 0;
  scaleWas = gfx.scale;
  setScene(scene);
  document.body.classList.add('eyeground');
}

/** Home came on screen in the eye: the globe starts once the page has settled. */
export function startGround(line?: HTMLElement): void {
  if (line) light = line;
  if (groundState.on || timer) return;
  tries = 0;
  timer = window.setTimeout(begin, AFTER_SHOWN);
}

/** Home let go: the camera goes back as it was; the next screen sets its own scene. */
export function stopGround(): void {
  clearTimeout(timer);
  timer = 0;
  lamp(false);
  document.body.classList.remove('eyeground');
  if (!groundState.on) return;
  groundState.on = false;
  // (Home's own scene is the quiet room; any other screen sets its own right after)
  setScene(backdrop);
  if (gfx.scale < scaleWas) {
    gfx.scale = scaleWas;
    gfx.resize();
  }
  const c = globe.cam;
  if (saved) {
    c.fly = null;
    c.lat = saved.lat;
    c.lon = saved.lon;
    c.range = saved.range;
    c.hd = saved.hd;
    c.tilt = saved.tilt;
    c.autoSpin = saved.spin;
    c.target = saved.target;
    c.follow = saved.follow;
  }
  saved = null;
}

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.eyeground = groundState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
