/**
 * THE WIND TUNNEL's flow (OWNER-ISSUES 61b, "the wind tunnel on his phone"): a D2Q9 lattice-Boltzmann solver in plain typed
 * arrays — pure, deterministic, no packages. The BGK collision with relaxation time τ (viscosity ν = (τ − ½)/3); an
 * equilibrium velocity inlet on the left, a zero-gradient outlet on the right, free-slip (mirror) walls at the top and the
 * bottom, half-way bounce-back on the obstacle; the force on the obstacle by momentum exchange on its boundary links, as lift
 * and drag coefficients normalised by its chord and the inlet speed, with the Reynolds number the lattice stands for.
 *
 * A stability guard: τ is held at 0.52 or more and the inlet at 0.1 lattice units or less, and it says what it clamped. The
 * streaming reads come from a table built once per obstacle (`src`), so the walls, the inlet and the obstacle cost nothing in
 * the inner loop. The lattice's own numbers are lattice units; the screen scales them, and says it does.
 */

/** D2Q9: rest, the four sides, the four corners. */
export const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const WT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
/** The opposite direction, and the mirror image across a horizontal wall. */
export const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const MIRROR_Y = [0, 1, 4, 3, 2, 8, 7, 6, 5];

export const TAU_MIN = 0.52;
export const INLET_MAX = 0.1;

export interface FlowOpts {
  nx: number;
  ny: number;
  /** Inlet speed, lattice units per step. */
  inlet: number;
  /** Relaxation time. */
  tau: number;
}

export interface FlowForce {
  /** Lattice force on the obstacle (per unit depth). */
  fx: number;
  fy: number;
  cd: number;
  cl: number;
}

export interface Flow {
  readonly nx: number;
  readonly ny: number;
  readonly inlet: number;
  readonly tau: number;
  readonly nu: number;
  /** What the stability guard changed, in words (empty when nothing). */
  readonly clamped: string[];
  /** Steps taken since the start (or the last reset). */
  steps: number;
  /** The obstacle: 1 where solid; its chord in cells (the reference length) and how many cells it holds. */
  setObstacle(mask: Uint8Array, chord?: number): void;
  readonly mask: Uint8Array;
  readonly chord: number;
  step(n?: number): void;
  /** Speed |u| per cell, in units of the inlet speed (0 inside the obstacle). */
  velocity(out?: Float32Array): Float32Array;
  /** Vorticity ∂uy/∂x − ∂ux/∂y per cell, in units of inlet ÷ chord. */
  vorticity(out?: Float32Array): Float32Array;
  /** The force of the last step and its coefficients. */
  force(): FlowForce;
  /** The force averaged over the recent steps (an exponential average over about the last 100). */
  meanForce(): FlowForce;
  /** The Reynolds number the lattice stands for: inlet × chord ÷ ν. */
  reynolds(): number;
  /** Every number finite and every speed below the lattice's limit. */
  stable(): boolean;
  /** Back to a uniform stream at the inlet speed. */
  reset(): void;
  /** Velocity components (for dye and a test), lattice units. */
  readonly ux: Float64Array;
  readonly uy: Float64Array;
}

/** The equilibrium populations at density rho and velocity (ux, uy), into `out` from `at`. */
function equilibrium(out: Float64Array, at: number, rho: number, ux: number, uy: number): void {
  const usq = 1.5 * (ux * ux + uy * uy);
  for (let i = 0; i < 9; i++) {
    const eu = 3 * (EX[i]! * ux + EY[i]! * uy);
    out[at + i] = WT[i]! * rho * (1 + eu + 0.5 * eu * eu - usq);
  }
}

export function createFlow(o: FlowOpts): Flow {
  const nx = Math.max(8, Math.floor(o.nx));
  const ny = Math.max(8, Math.floor(o.ny));
  const clamped: string[] = [];
  let tau = Number.isFinite(o.tau) ? o.tau : 0.6;
  let inlet = Number.isFinite(o.inlet) ? o.inlet : 0.05;
  if (tau < TAU_MIN) {
    clamped.push(`τ raised from ${tau.toFixed(3)} to ${TAU_MIN}: below it the lattice is unstable`);
    tau = TAU_MIN;
  }
  if (inlet > INLET_MAX) {
    clamped.push(`inlet slowed from ${inlet.toFixed(3)} to ${INLET_MAX} lattice units: faster breaks the low-Mach assumption`);
    inlet = INLET_MAX;
  }
  if (inlet < 0) inlet = 0;
  const omega = 1 / tau;
  const nu = (tau - 0.5) / 3;
  const N = nx * ny;
  let f = new Float64Array(9 * N);
  let g = new Float64Array(9 * N);
  const ux = new Float64Array(N);
  const uy = new Float64Array(N);
  let mask = new Uint8Array(N);
  let chord = 1;
  /** Where each population is read from when streaming (an index into f), or −1: the inlet's equilibrium. */
  const src = new Int32Array(9 * N);
  /** 1 where the read is a bounce-back off the obstacle (its momentum counts towards the force). */
  const bb = new Uint8Array(9 * N);
  let fluid = new Int32Array(0);
  const inletEq = new Float64Array(9);
  equilibrium(inletEq, 0, 1, inlet, 0);
  let last: FlowForce = { fx: 0, fy: 0, cd: 0, cl: 0 };
  let mean: FlowForce = { fx: 0, fy: 0, cd: 0, cl: 0 };
  let meanN = 0;

  const build = () => {
    const list: number[] = [];
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const c = y * nx + x;
        const k0 = 9 * c;
        if (mask[c]) {
          // a solid cell keeps what it has (nothing reads it but its own bounce-backs)
          for (let i = 0; i < 9; i++) {
            src[k0 + i] = k0 + i;
            bb[k0 + i] = 0;
          }
          continue;
        }
        list.push(c);
        for (let i = 0; i < 9; i++) {
          const k = k0 + i;
          bb[k] = 0;
          if (x === 0) {
            src[k] = -1; // the inlet: set to its equilibrium after streaming
            continue;
          }
          let sx = x - EX[i]!;
          let sy = y - EY[i]!;
          let di = i;
          if (sy < 0 || sy >= ny) {
            // a free-slip wall: what arrives is the mirror image of what left towards the wall
            sy = y;
            di = MIRROR_Y[i]!;
          }
          // the outlet: what would come in from beyond the last column is that column's own (after streaming, the
          // value its neighbour got: a zero-gradient outlet)
          if (sx >= nx) sx = nx - 1;
          if (sx < 0) sx = 0;
          const s = sy * nx + sx;
          if (mask[s]) {
            // bounce-back: the population that went into the obstacle comes back the other way
            src[k] = k0 + OPP[i]!;
            bb[k] = 1;
            continue;
          }
          src[k] = 9 * s + di;
        }
      }
    }
    fluid = Int32Array.from(list);
  };

  const reset = () => {
    for (let c = 0; c < N; c++) {
      if (mask[c]) {
        f.fill(0, 9 * c, 9 * c + 9);
        ux[c] = 0;
        uy[c] = 0;
      } else {
        equilibrium(f, 9 * c, 1, inlet, 0);
        ux[c] = inlet;
        uy[c] = 0;
      }
    }
    g.set(f);
    flow.steps = 0;
    last = { fx: 0, fy: 0, cd: 0, cl: 0 };
    mean = { fx: 0, fy: 0, cd: 0, cl: 0 };
    meanN = 0;
  };

  const coeff = (fx: number, fy: number): FlowForce => {
    const q = 0.5 * inlet * inlet * Math.max(chord, 1e-9);
    return { fx, fy, cd: q > 0 ? fx / q : 0, cl: q > 0 ? fy / q : 0 };
  };

  const stepOnce = () => {
    // streaming (pull), with the force from every bounce-back link
    let fx = 0;
    let fy = 0;
    let k = 0;
    for (let c = 0; c < N; c++) {
      for (let i = 0; i < 9; i++, k++) {
        const s = src[k]!;
        if (s < 0) {
          g[k] = inletEq[i]!;
          continue;
        }
        const v = f[s]!;
        g[k] = v;
        if (bb[k]) {
          // the population heading into the solid along −e_i, reflected: 2·f·(−e_i) of momentum given to it
          fx -= 2 * v * EX[i]!;
          fy -= 2 * v * EY[i]!;
        }
      }
    }
    // collision (BGK) on every fluid cell
    const n = fluid.length;
    for (let j = 0; j < n; j++) {
      const c = fluid[j]!;
      const k = 9 * c;
      const f0 = g[k]!, f1 = g[k + 1]!, f2 = g[k + 2]!, f3 = g[k + 3]!, f4 = g[k + 4]!, f5 = g[k + 5]!, f6 = g[k + 6]!, f7 = g[k + 7]!, f8 = g[k + 8]!;
      const rho = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
      const ir = rho > 0 ? 1 / rho : 0;
      const u = (f1 - f3 + f5 - f6 - f7 + f8) * ir;
      const v = (f2 - f4 + f5 + f6 - f7 - f8) * ir;
      ux[c] = u;
      uy[c] = v;
      const usq = 1.5 * (u * u + v * v);
      const a = 4 / 9 * rho;
      const b = 1 / 9 * rho;
      const d = 1 / 36 * rho;
      let eu: number;
      g[k] = f0 + omega * (a * (1 - usq) - f0);
      eu = 3 * u;
      g[k + 1] = f1 + omega * (b * (1 + eu + 0.5 * eu * eu - usq) - f1);
      eu = 3 * v;
      g[k + 2] = f2 + omega * (b * (1 + eu + 0.5 * eu * eu - usq) - f2);
      eu = -3 * u;
      g[k + 3] = f3 + omega * (b * (1 + eu + 0.5 * eu * eu - usq) - f3);
      eu = -3 * v;
      g[k + 4] = f4 + omega * (b * (1 + eu + 0.5 * eu * eu - usq) - f4);
      eu = 3 * (u + v);
      g[k + 5] = f5 + omega * (d * (1 + eu + 0.5 * eu * eu - usq) - f5);
      eu = 3 * (-u + v);
      g[k + 6] = f6 + omega * (d * (1 + eu + 0.5 * eu * eu - usq) - f6);
      eu = 3 * (-u - v);
      g[k + 7] = f7 + omega * (d * (1 + eu + 0.5 * eu * eu - usq) - f7);
      eu = 3 * (u - v);
      g[k + 8] = f8 + omega * (d * (1 + eu + 0.5 * eu * eu - usq) - f8);
    }
    const t = f;
    f = g;
    g = t;
    flow.steps++;
    last = coeff(fx, fy);
    // an exponential average over about 100 steps (the first ones weighted as a plain mean)
    meanN = Math.min(meanN + 1, 100);
    const w = 1 / meanN;
    mean = coeff(mean.fx + w * (fx - mean.fx), mean.fy + w * (fy - mean.fy));
  };

  const flow: Flow = {
    nx,
    ny,
    inlet,
    tau,
    nu,
    clamped,
    steps: 0,
    get mask() {
      return mask;
    },
    get chord() {
      return chord;
    },
    ux,
    uy,
    setObstacle(m, c) {
      const was = mask;
      mask = new Uint8Array(N);
      for (let i = 0; i < N && i < m.length; i++) mask[i] = m[i] ? 1 : 0;
      // the inlet column stays open: the stream must be able to come in
      for (let y = 0; y < ny; y++) mask[y * nx] = 0;
      let x0 = nx;
      let x1 = -1;
      for (let i = 0; i < N; i++) {
        if (!mask[i]) continue;
        const x = i % nx;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
      chord = c && c > 0 ? c : x1 >= x0 ? x1 - x0 + 1 : 1;
      // cells that were solid and are now open start as the stream at rest; cells now solid are emptied
      for (let i = 0; i < N; i++) {
        if (was[i] && !mask[i]) {
          equilibrium(f, 9 * i, 1, 0, 0);
          ux[i] = 0;
          uy[i] = 0;
        } else if (mask[i]) {
          f.fill(0, 9 * i, 9 * i + 9);
          ux[i] = 0;
          uy[i] = 0;
        }
      }
      build();
      meanN = 0;
    },
    step(n = 1) {
      for (let s = 0; s < n; s++) stepOnce();
    },
    velocity(out = new Float32Array(N)) {
      const k = inlet > 0 ? 1 / inlet : 1;
      for (let c = 0; c < N; c++) out[c] = mask[c] ? 0 : Math.sqrt(ux[c]! * ux[c]! + uy[c]! * uy[c]!) * k;
      return out;
    },
    vorticity(out = new Float32Array(N)) {
      const k = inlet > 0 ? chord / inlet : 1;
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const c = y * nx + x;
          if (mask[c] || x === 0 || y === 0 || x === nx - 1 || y === ny - 1) {
            out[c] = 0;
            continue;
          }
          out[c] = ((uy[c + 1]! - uy[c - 1]!) / 2 - (ux[c + nx]! - ux[c - nx]!) / 2) * k;
        }
      }
      return out;
    },
    force: () => last,
    meanForce: () => mean,
    reynolds: () => (nu > 0 ? (inlet * chord) / nu : 0),
    stable() {
      for (let c = 0; c < N; c++) {
        const u = ux[c]!;
        const v = uy[c]!;
        if (!Number.isFinite(u) || !Number.isFinite(v) || u * u + v * v > 0.3) return false;
      }
      return Number.isFinite(last.fx) && Number.isFinite(last.fy);
    },
    reset,
  };
  build();
  reset();
  return flow;
}
