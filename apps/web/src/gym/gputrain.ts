/**
 * A network trained by whole-batch gradient steps, every multiplication through a backend (gym/gpu.ts): the same sums on the graphics
 * chip or on the processor, so what one path learns the other learns (tests/phonehw.spec.mjs holds them to each other). It is the
 * GYM's TRAINING SPEED check and the bigger practice the lab can ask of the chip: a layer of 128 over 4,096 points is a real job for
 * a GPU and a slow one for a phone's processor loops. Pure given its backend.
 */
import type { Backend } from './gpu';

export interface Problem {
  /** n × d, row-major. */
  x: Float32Array;
  /** n class numbers. */
  y: Int32Array;
  n: number;
  d: number;
  classes: number;
}

/** A small repeatable problem: `classes` blobs in `d` dimensions, from a seed. */
export function blobs(n: number, d: number, classes: number, seed: number): Problem {
  let s = seed >>> 0 || 1;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  const centres = Array.from({ length: classes }, () => Float32Array.from({ length: d }, () => gauss() * 1.6));
  const x = new Float32Array(n * d);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % classes;
    y[i] = c;
    for (let j = 0; j < d; j++) x[i * d + j] = centres[c]![j]! + gauss() * 0.7;
  }
  return { x, y, n, d, classes };
}

const transpose = (a: Float32Array, rows: number, cols: number): Float32Array => {
  const t = new Float32Array(a.length);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) t[j * rows + i] = a[i * cols + j]!;
  return t;
};

export interface Trained {
  loss: number;
  accuracy: number;
  ms: number;
}

/** Train tanh layers of the given widths with softmax on top; returns the last loss and the accuracy on the same points. */
export async function trainMlp(be: Backend, p: Problem, hidden: number[], epochs: number, lr: number, seed: number, between?: () => Promise<void>): Promise<Trained> {
  const t0 = performance.now();
  let s = seed >>> 0 || 1;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) - 0.5;
  const sizes = [p.d, ...hidden, p.classes];
  const W = sizes.slice(1).map((o, i) => Float32Array.from({ length: sizes[i]! * o }, () => r() * 2 * Math.sqrt(1 / sizes[i]!)));
  const B = sizes.slice(1).map((o) => new Float32Array(o));
  const L = W.length;
  let loss = 0;
  let correct = 0;
  for (let e = 0; e < epochs; e++) {
    const acts: Float32Array[] = [p.x];
    for (let l = 0; l < L; l++) {
      const z = await be.matmul(acts[l]!, W[l]!, p.n, sizes[l]!, sizes[l + 1]!);
      const o = sizes[l + 1]!;
      for (let i = 0; i < p.n; i++) for (let j = 0; j < o; j++) z[i * o + j]! += B[l]![j]!;
      if (l < L - 1) for (let i = 0; i < z.length; i++) z[i] = Math.tanh(z[i]!);
      acts.push(z);
    }
    // softmax and its gradient: (p - one-hot) / n
    const out = acts[L]!;
    const c = p.classes;
    let delta: Float32Array = new Float32Array(out.length);
    loss = 0;
    correct = 0;
    for (let i = 0; i < p.n; i++) {
      let mx = -Infinity;
      let arg = 0;
      for (let j = 0; j < c; j++) if (out[i * c + j]! > mx) (mx = out[i * c + j]!), (arg = j);
      let sum = 0;
      for (let j = 0; j < c; j++) sum += Math.exp(out[i * c + j]! - mx);
      for (let j = 0; j < c; j++) {
        const pr = Math.exp(out[i * c + j]! - mx) / sum;
        delta[i * c + j] = (pr - (j === p.y[i] ? 1 : 0)) / p.n;
        if (j === p.y[i]) loss -= Math.log(Math.max(1e-9, pr)) / p.n;
      }
      if (arg === p.y[i]) correct++;
    }
    for (let l = L - 1; l >= 0; l--) {
      const o = sizes[l + 1]!;
      const i0 = sizes[l]!;
      const dW = await be.matmul(transpose(acts[l]!, p.n, i0), delta, i0, p.n, o);
      const dB = new Float32Array(o);
      for (let i = 0; i < p.n; i++) for (let j = 0; j < o; j++) dB[j]! += delta[i * o + j]!;
      if (l > 0) {
        const back = await be.matmul(delta, transpose(W[l]!, i0, o), p.n, o, i0);
        const a = acts[l]!;
        for (let i = 0; i < back.length; i++) back[i]! *= 1 - a[i]! * a[i]!;
        delta = back;
      }
      for (let i = 0; i < W[l]!.length; i++) W[l]![i]! -= lr * dW[i]!;
      for (let j = 0; j < o; j++) B[l]![j]! -= lr * dB[j]!;
    }
    if (between) await between();
  }
  return { loss, accuracy: correct / p.n, ms: performance.now() - t0 };
}
