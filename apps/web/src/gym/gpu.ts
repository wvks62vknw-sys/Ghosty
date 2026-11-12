/**
 * THE GYM'S SUMS, ON THE GRAPHICS CHIP WHEN THE PHONE HAS ONE (BRIEF-PHONE-HARDWARE, item 3): the heavy part of training a network is
 * matrix multiplication, and WebGPU does it in parallel. Two backends with the same shape, chosen by what the phone can do when the run
 * starts, never by a setting: `webgpu` (a compute shader) and `cpu` (the plain loops, which every browser has and which are the way it
 * has always been). If WebGPU is missing, or the device cannot be had, or it fails half-way, the sums go to the processor and the words
 * say which and why. Nothing here is a package: WebGPU is the browser's own.
 *
 * The browser's gpu object is passed in (`nav`), so tests/phonehw.spec.mjs runs both paths on fakes: a fake that does the multiply in
 * plain code, one that has no adapter, one whose device throws.
 */

import { sayError } from '../ui/hisWords';

export type Path = 'webgpu' | 'cpu';

export interface Backend {
  path: Path;
  /** C (m×n) = A (m×k) · B (k×n), row-major. */
  matmul(a: Float32Array, b: Float32Array, m: number, k: number, n: number): Promise<Float32Array>;
  close(): void;
}

export const cpuBackend: Backend = {
  path: 'cpu',
  async matmul(a, b, m, k, n) {
    const c = new Float32Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let p = 0; p < k; p++) {
        const av = a[i * k + p]!;
        if (av === 0) continue;
        const row = p * n;
        const out = i * n;
        for (let j = 0; j < n; j++) c[out + j]! += av * b[row + j]!;
      }
    }
    return c;
  },
  close() {},
};

const SHADER = /* wgsl */ `
struct Dims { m: u32, k: u32, n: u32, pad: u32 };
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;
@group(0) @binding(3) var<uniform> d: Dims;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.y; let col = id.x;
  if (row >= d.m || col >= d.n) { return; }
  var s: f32 = 0.0;
  for (var p: u32 = 0u; p < d.k; p = p + 1u) { s = s + a[row * d.k + p] * b[p * d.n + col]; }
  c[row * d.n + col] = s;
}`;

/** The slice of the WebGPU API this file uses (untyped here: the browser's own types are not in the build's libs). */
interface Gpu {
  requestAdapter(): Promise<{ requestDevice(): Promise<Dev> } | null>;
}
interface Buf {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}
interface Dev {
  createShaderModule(d: { code: string }): unknown;
  createComputePipeline(d: unknown): { getBindGroupLayout(i: number): unknown };
  createBuffer(d: { size: number; usage: number }): Buf;
  createBindGroup(d: unknown): unknown;
  createCommandEncoder(): { beginComputePass(): { setPipeline(p: unknown): void; setBindGroup(i: number, g: unknown): void; dispatchWorkgroups(x: number, y: number): void; end(): void }; copyBufferToBuffer(a: Buf, ao: number, b: Buf, bo: number, size: number): void; finish(): unknown };
  queue: { writeBuffer(b: Buf, o: number, d: ArrayBufferView): void; submit(c: unknown[]): void };
  destroy?(): void;
}
// the flags WebGPU defines for buffers and mapping
const USAGE = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, STORAGE: 128 };

/** A WebGPU backend; throws, in plain words, when there is no adapter or device. */
export async function webgpuBackend(gpu: Gpu | undefined): Promise<Backend> {
  if (!gpu) throw new Error('this browser has no WebGPU');
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU is here but this phone's graphics chip is not available to it");
  const dev = await adapter.requestDevice();
  const pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: dev.createShaderModule({ code: SHADER }), entryPoint: 'main' } });
  return {
    path: 'webgpu',
    async matmul(a, b, m, k, n) {
      const mk = (size: number, usage: number) => dev.createBuffer({ size: Math.max(16, size), usage });
      const A = mk(a.byteLength, USAGE.STORAGE | USAGE.COPY_DST);
      const B = mk(b.byteLength, USAGE.STORAGE | USAGE.COPY_DST);
      const C = mk(m * n * 4, USAGE.STORAGE | USAGE.COPY_SRC);
      const D = mk(16, USAGE.UNIFORM | USAGE.COPY_DST);
      const R = mk(m * n * 4, USAGE.MAP_READ | USAGE.COPY_DST);
      try {
        dev.queue.writeBuffer(A, 0, a);
        dev.queue.writeBuffer(B, 0, b);
        dev.queue.writeBuffer(D, 0, new Uint32Array([m, k, n, 0]));
        const group = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [A, B, C, D].map((buffer, binding) => ({ binding, resource: { buffer } })) });
        const enc = dev.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipe);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(n / 8), Math.ceil(m / 8));
        pass.end();
        enc.copyBufferToBuffer(C, 0, R, 0, m * n * 4);
        dev.queue.submit([enc.finish()]);
        await R.mapAsync(1);
        const out = new Float32Array(R.getMappedRange().slice(0, m * n * 4));
        R.unmap();
        return out;
      } finally {
        for (const x of [A, B, C, D, R]) x.destroy();
      }
    },
    close() {
      dev.destroy?.();
    },
  };
}

export interface Choice {
  path: Path;
  backend: Backend;
  /** One plain line for the GYM: which path it took, and why when it is the processor. */
  message: string;
  /** Why the processor was taken (empty on the graphics chip). */
  why: string;
}

/** The words, in one place (tests/phonehw.spec.mjs holds them). */
export const WORDS = {
  gpu: 'Training on the graphics chip (WebGPU).',
  cpu: (why: string) => `Training on the processor: ${why}.`,
  stopped: (why: string) => `Training moved to the processor: WebGPU stopped (${why}).`,
};

/**
 * Choose the path for a run: the graphics chip when the phone has WebGPU and a device comes up, else the processor. `make` is the
 * WebGPU constructor (tests pass fakes). A GPU backend that throws during a run switches itself to the processor for the rest
 * (`onFallback` hears it once).
 */
export async function chooseBackend(gpu: Gpu | undefined, make: (g: Gpu | undefined) => Promise<Backend> = webgpuBackend, onFallback?: (message: string) => void): Promise<Choice> {
  let fast: Backend;
  try {
    fast = await make(gpu);
  } catch (e) {
    const why = sayError(e, 'use the graphics chip').replace(/\.$/, '');
    return { path: 'cpu', backend: cpuBackend, message: WORDS.cpu(why), why };
  }
  const out: Choice = { path: 'webgpu', message: WORDS.gpu, why: '', backend: fast };
  let broken = false;
  out.backend = {
    get path() {
      return broken ? 'cpu' : 'webgpu';
    },
    async matmul(a, b, m, k, n) {
      if (!broken) {
        try {
          return await fast.matmul(a, b, m, k, n);
        } catch (e) {
          broken = true;
          const why = sayError(e, 'use the graphics chip').replace(/\.$/, '');
          out.path = 'cpu';
          out.why = why;
          out.message = WORDS.stopped(why);
          try {
            fast.close();
          } catch {
            /* already gone */
          }
          onFallback?.(out.message);
        }
      }
      return cpuBackend.matmul(a, b, m, k, n);
    },
    close() {
      if (!broken) fast.close();
    },
  } as Backend;
  return out;
}
