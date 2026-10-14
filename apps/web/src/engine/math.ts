/** Small vector/matrix helpers for the WebGL engine (column-major 4x4 matrices). */
export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const M4 = {
  id(): Mat4 {
    const o = new Float32Array(16);
    o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  },
  mul(a: Mat4, b: Mat4, o: Mat4 = new Float32Array(16)): Mat4 {
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
        o[c * 4 + r] = s;
      }
    return o;
  },
  persp(fy: number, asp: number, n: number, f: number, o: Mat4 = new Float32Array(16)): Mat4 {
    const t = 1 / Math.tan(fy / 2);
    o.fill(0);
    o[0] = t / asp;
    o[5] = t;
    o[10] = (f + n) / (n - f);
    o[11] = -1;
    o[14] = (2 * f * n) / (n - f);
    return o;
  },
  trans(x: number, y: number, z: number): Mat4 {
    const o = M4.id();
    o[12] = x;
    o[13] = y;
    o[14] = z;
    return o;
  },
  rotX(a: number): Mat4 {
    const o = M4.id();
    const c = Math.cos(a);
    const s = Math.sin(a);
    o[5] = c;
    o[6] = s;
    o[9] = -s;
    o[10] = c;
    return o;
  },
  rotY(a: number): Mat4 {
    const o = M4.id();
    const c = Math.cos(a);
    const s = Math.sin(a);
    o[0] = c;
    o[2] = -s;
    o[8] = s;
    o[10] = c;
    return o;
  },
  rotZ(a: number): Mat4 {
    const o = M4.id();
    const c = Math.cos(a);
    const s = Math.sin(a);
    o[0] = c;
    o[1] = s;
    o[4] = -s;
    o[5] = c;
    return o;
  },
  /** View matrix from camera right/up/back axes (no translation: camera-relative rendering). */
  basis(r: Vec3, u: Vec3, b: Vec3): Mat4 {
    const o = M4.id();
    o[0] = r[0];
    o[4] = r[1];
    o[8] = r[2];
    o[1] = u[0];
    o[5] = u[1];
    o[9] = u[2];
    o[2] = b[0];
    o[6] = b[1];
    o[10] = b[2];
    return o;
  },
  look(e: Vec3, c: Vec3, up: Vec3): Mat4 {
    const f = V3.norm(V3.sub(c, e));
    const r = V3.norm(V3.cross(f, up));
    const u = V3.cross(r, f);
    const o = M4.basis(r, u, [-f[0], -f[1], -f[2]]);
    o[12] = -V3.dot(r, e);
    o[13] = -V3.dot(u, e);
    o[14] = V3.dot(f, e);
    return o;
  },
};

export const V3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm(a: Vec3): Vec3 {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export function hex2rgb(h: string): Vec3 {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Deterministic random numbers (xorshift) so procedural scenes look the same every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
