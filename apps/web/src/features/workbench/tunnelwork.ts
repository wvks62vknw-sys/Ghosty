/**
 * THE WIND TUNNEL, inside the shared worker (workers/textures.worker.ts sends it messages carrying `tunnel`, the pattern of
 * the GYM and the offline website builder): the lattice flow (packages/shared/src/workbench/flow.ts) stepped as many times a
 * frame as keep about 30 frames a second (measured, adaptive), dye released at the inlet and carried by the flow, and each
 * frame posted back as transferable buffers — the page only draws. A frame waits for the page's ack, so a slow screen is
 * never flooded. Nothing here fetches anything.
 */
import { createFlow, type Flow } from '../../../../../packages/shared/src/workbench/flow';
import { shapeMask, type ShapeSpec } from '../../../../../packages/shared/src/workbench/shapes';

export type TunnelView = 'speed' | 'swirl';

export interface TunnelIn {
  tunnel: 'start' | 'shape' | 'speed' | 'view' | 'pause' | 'resume' | 'reset' | 'stop' | 'ack';
  nx?: number;
  ny?: number;
  shape?: ShapeSpec;
  /** Inlet speed, lattice units (0.02–0.1). */
  inlet?: number;
  tau?: number;
  view?: TunnelView;
}

export interface TunnelOut {
  tunnel: 'frame';
  nx: number;
  ny: number;
  steps: number;
  /** Speed (× the inlet) or swirl (× inlet ÷ chord) per cell, row 0 at the bottom. */
  field: Float32Array;
  /** Dye per cell, 0–255. */
  dye: Uint8Array;
  /** The obstacle, with the first frame after each new shape. */
  mask?: Uint8Array;
  shapeSeq: number;
  shapeName: string;
  cells: number;
  cd: number;
  cl: number;
  re: number;
  chord: number;
  inlet: number;
  tau: number;
  clamped: string[];
  /** Said once, when something had to change (a restart with more viscosity). */
  note?: string;
  /** Steps a frame, and frames a second, as measured. */
  perFrame: number;
  fps: number;
  paused: boolean;
  view: TunnelView;
}

type Post = (o: TunnelOut, transfer: Transferable[]) => void;

const FRAME_MS = 33;
/** Of each frame, this much goes to stepping (the rest to dye, the post and slack). */
const STEP_BUDGET_MS = 22;

let flow: Flow | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let post: Post | null = null;
let nx = 192;
let ny = 96;
let tau = 0.56;
let inlet = 0.08;
let shape: ShapeSpec = { kind: 'naca', code: '2412', alpha: 6 };
let shapeName = '';
let cells = 0;
let shapeSeq = 0;
let maskOut: Uint8Array | null = null;
let view: TunnelView = 'speed';
let paused = false;
let perFrame = 6;
let waiting = false;
let note = '';
let dye = new Float32Array(0);
let dye2 = new Float32Array(0);
let frames: number[] = [];

function applyShape(): void {
  if (!flow) return;
  const s = shapeMask(shape, nx, ny);
  flow.setObstacle(s.mask, s.chord);
  shapeName = s.name;
  cells = s.cells;
  shapeSeq++;
  maskOut = flow.mask.slice();
}

function build(): void {
  flow = createFlow({ nx, ny, inlet, tau });
  dye = new Float32Array(nx * ny);
  dye2 = new Float32Array(nx * ny);
  applyShape();
}

/** Dye carried by the flow (semi-Lagrangian, `dt` steps at a time), fresh dye in bands at the inlet, a slow fade. */
function advectDye(dt: number): void {
  if (!flow) return;
  const { ux, uy, mask } = flow;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const c = y * nx + x;
      if (mask[c]) {
        dye2[c] = 0;
        continue;
      }
      if (x < 2) {
        dye2[c] = y % 8 < 2 ? 1 : 0;
        continue;
      }
      let px = x - ux[c]! * dt;
      let py = y - uy[c]! * dt;
      px = px < 0 ? 0 : px > nx - 1.001 ? nx - 1.001 : px;
      py = py < 0 ? 0 : py > ny - 1.001 ? ny - 1.001 : py;
      const x0 = px | 0;
      const y0 = py | 0;
      const fx = px - x0;
      const fy = py - y0;
      const i = y0 * nx + x0;
      const v = (dye[i]! * (1 - fx) + dye[i + 1]! * fx) * (1 - fy) + (dye[i + nx]! * (1 - fx) + dye[i + nx + 1]! * fx) * fy;
      dye2[c] = v * 0.997;
    }
  }
  const t = dye;
  dye = dye2;
  dye2 = t;
}

function sendFrame(): void {
  if (!flow || !post) return;
  const field = view === 'swirl' ? flow.vorticity() : flow.velocity();
  const d = new Uint8Array(nx * ny);
  for (let i = 0; i < d.length; i++) d[i] = Math.min(255, Math.round(dye[i]! * 255));
  const m = flow.meanForce();
  const now = Date.now();
  frames = frames.filter((t) => now - t < 1000);
  frames.push(now);
  const out: TunnelOut = {
    tunnel: 'frame', nx, ny, steps: flow.steps, field, dye: d, shapeSeq, shapeName, cells,
    cd: m.cd, cl: m.cl, re: flow.reynolds(), chord: flow.chord, inlet: flow.inlet, tau: flow.tau, clamped: flow.clamped,
    perFrame, fps: frames.length, paused, view,
    ...(note ? { note } : {}),
  };
  const transfer: Transferable[] = [field.buffer, d.buffer];
  if (maskOut) {
    out.mask = maskOut;
    transfer.push(maskOut.buffer);
    maskOut = null;
  }
  note = '';
  waiting = true;
  post(out, transfer);
}

function tick(): void {
  timer = setTimeout(tick, FRAME_MS);
  if (!flow || paused) return;
  const t0 = performance.now();
  flow.step(perFrame);
  const per = (performance.now() - t0) / perFrame;
  // as many steps a frame as fit the budget (measured every frame; never fewer than one, never a runaway)
  perFrame = Math.max(1, Math.min(80, Math.round(STEP_BUDGET_MS / Math.max(per, 0.01))));
  if (!flow.stable()) {
    // it blew up: more viscosity, the same shape, from the start (said once)
    const was = tau;
    tau = Math.min(0.9, tau + 0.06);
    build();
    note = `The flow went unstable at τ ${was.toFixed(2)}: restarted with more viscosity (τ ${tau.toFixed(2)}, a lower Reynolds number).`;
    sendFrame();
    return;
  }
  advectDye(perFrame);
  if (!waiting) sendFrame();
}

function stop(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function tunnelMessage(m: TunnelIn, out: Post): void {
  post = out;
  switch (m.tunnel) {
    case 'start':
      nx = Math.max(32, Math.min(400, Math.round(m.nx ?? nx)));
      ny = Math.max(16, Math.min(200, Math.round(m.ny ?? ny)));
      if (m.shape) shape = m.shape;
      if (typeof m.inlet === 'number') inlet = m.inlet;
      if (typeof m.tau === 'number') tau = m.tau;
      if (m.view) view = m.view;
      paused = false;
      waiting = false;
      build();
      stop();
      sendFrame();
      timer = setTimeout(tick, FRAME_MS);
      return;
    case 'shape':
      if (m.shape) shape = m.shape;
      applyShape();
      if (paused || !timer) sendFrame();
      return;
    case 'speed':
      if (typeof m.inlet === 'number') inlet = m.inlet;
      build();
      if (paused || !timer) sendFrame();
      return;
    case 'view':
      if (m.view) view = m.view;
      if (paused) sendFrame();
      return;
    case 'pause':
      paused = true;
      waiting = false;
      sendFrame();
      return;
    case 'resume':
      paused = false;
      return;
    case 'reset':
      build();
      sendFrame();
      return;
    case 'ack':
      waiting = false;
      return;
    case 'stop':
      stop();
      flow = null;
      return;
  }
}
