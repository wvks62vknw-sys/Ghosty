/**
 * THE BLOCK WORLD's ground: blocks of our own palette in chunks of 16 × 16 × 64, made from a seed (hills, mountains
 * with snow, lakes with sandy shores, trees, and caves near the surface), the same blocks every time for the same seed
 * and chunk whatever order the chunks are made in. Every block he changes is kept as an edit (what a saved world is),
 * laid over the chunk whenever it is made again. Pure: no DOM, no three.js (the node test holds it to its numbers).
 */

export const CX = 16;
export const CY = 64;
/** The water line. */
export const SEA = 22;

export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7, SNOW = 8;
/** The building materials (stone is the ground's own). */
export const PLANKS = 9, BRICK = 10, GLASS = 11, GOLD = 12;
export const KINDS = 13;

/** The eight kinds the ground is made of. */
export const NATURAL = [GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, SNOW] as const;

export const KIND_NAMES = ['air', 'grass', 'dirt', 'stone', 'sand', 'water', 'log', 'leaves', 'snow', 'wood', 'brick', 'glass', 'gold'] as const;

/** Each kind's colours (sRGB hex): top, sides, bottom. Ours: soft, flat, a little warm. */
export const COLOURS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0x79c95a, 0x8b7a4e, 0x8f6542],
  [0x9a6b46, 0x936440, 0x8a5d3b],
  [0x9a9fa8, 0x8e939c, 0x81868f],
  [0xead49c, 0xe2ca91, 0xd9bf86],
  [0x3a8ad6, 0x3482cf, 0x2e78c4],
  [0xc09562, 0x8a5c36, 0xc09562],
  [0x46a253, 0x3f984b, 0x388b44],
  [0xf4f7fb, 0xe6ecf3, 0xd9e0e8],
  [0xd09a58, 0xc58e4f, 0xb98447],
  [0xbd5a40, 0xb4513a, 0xa94b35],
  [0xd8f2fb, 0xcdeaf6, 0xc2e1f0],
  [0xf6cb3a, 0xeebf2c, 0xe2b324],
];

/** It hides what is behind it (and darkens the corners next to it). */
export const OPAQUE: readonly boolean[] = [false, true, true, true, true, false, true, true, true, true, true, false, true];
/** It stops the player (water does not). */
export const SOLID: readonly boolean[] = OPAQUE.map((o, k) => o || k === GLASS);

export const idx = (x: number, y: number, z: number) => (y * CX + z) * CX + x;
export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;

// ---------------------------------------------------------------- seeded numbers

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [0, 1) for a point of the world (the same every time). */
export function hash01(seed: number, x: number, z: number, salt = 0): number {
  let hsh = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((seed ^ salt) | 0, 1274126177);
  hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
  hsh ^= hsh >>> 16;
  return (hsh >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function g2(hsh: number, dx: number, dy: number): number {
  switch (hsh & 7) {
    case 0: return dx + dy;
    case 1: return -dx + dy;
    case 2: return dx - dy;
    case 3: return -dx - dy;
    case 4: return dx;
    case 5: return -dx;
    case 6: return dy;
    default: return -dy;
  }
}
function g3(hsh: number, a: number, b: number, c: number): number {
  const hh = hsh & 15;
  const u = hh < 8 ? a : b;
  const v = hh < 4 ? b : hh === 12 || hh === 14 ? a : c;
  return ((hh & 1) === 0 ? u : -u) + ((hh & 2) === 0 ? v : -v);
}

/** Improved gradient noise from a seed's own shuffle. */
export class Noise {
  private p = new Uint8Array(512);
  constructor(seed: number) {
    const r = mulberry32(seed);
    const a = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255]!;
  }
  n2(x: number, y: number): number {
    const p = this.p;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[X]! + Y]!, ab = p[p[X]! + Y + 1]!, ba = p[p[X + 1]! + Y]!, bb = p[p[X + 1]! + Y + 1]!;
    return lerp(lerp(g2(aa, xf, yf), g2(ba, xf - 1, yf), u), lerp(g2(ab, xf, yf - 1), g2(bb, xf - 1, yf - 1), u), v) * 0.75;
  }
  n3(x: number, y: number, z: number): number {
    const p = this.p;
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const A = p[X]! + Y, AA = p[A]! + Z, AB = p[A + 1]! + Z, B = p[X + 1]! + Y, BA = p[B]! + Z, BB = p[B + 1]! + Z;
    return lerp(
      lerp(lerp(g3(p[AA]!, xf, yf, zf), g3(p[BA]!, xf - 1, yf, zf), u), lerp(g3(p[AB]!, xf, yf - 1, zf), g3(p[BB]!, xf - 1, yf - 1, zf), u), v),
      lerp(lerp(g3(p[AA + 1]!, xf, yf, zf - 1), g3(p[BA + 1]!, xf - 1, yf, zf - 1), u), lerp(g3(p[AB + 1]!, xf, yf - 1, zf - 1), g3(p[BB + 1]!, xf - 1, yf - 1, zf - 1), u), v),
      w,
    );
  }
}

const noises = new Map<number, Noise[]>();
const noisesOf = (seed: number): Noise[] => {
  let n = noises.get(seed);
  if (!n) {
    n = [0, 1, 2, 3].map((k) => new Noise((seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0));
    if (noises.size > 8) noises.clear();
    noises.set(seed, n);
  }
  return n;
};

// ---------------------------------------------------------------- the ground

/** The ground's height at a column (the top solid block's y). */
export function heightAt(seed: number, x: number, z: number): number {
  const [a, b, c] = noisesOf(seed) as [Noise, Noise, Noise, Noise];
  // rolling hills on low land and high (a fifth of the world is under water), mountains rising out of a third of it
  // with snow on the tallest few in a hundred
  let hills = 0, amp = 1, f = 1 / 80;
  for (let o = 0; o < 4; o++) {
    hills += a.n2(x * f, z * f) * amp;
    amp *= 0.5;
    f *= 2;
  }
  const land = c.n2(x / 320 - 7.1, z / 320 + 3.3);
  const m = b.n2(x / 220 + 31.7, z / 220 - 11.3);
  const mount = Math.pow(Math.max(0, m - 0.08), 1.3) * 120;
  return Math.max(3, Math.min(CY - 8, Math.round(24 + hills * 6.5 + land * 12 + mount)));
}

/** Where a tree stands in a 5 × 5 cell of the world, if one does: its column and trunk height. */
function treeIn(seed: number, gx: number, gz: number, forest: Noise): { x: number; z: number; t: number } | null {
  const f = forest.n2(gx / 9, gz / 9);
  const chance = 0.18 + Math.max(0, f) * 0.9;
  if (hash01(seed, gx, gz, 11) > chance) return null;
  const x = gx * 5 + 1 + Math.floor(hash01(seed, gx, gz, 12) * 3);
  const z = gz * 5 + 1 + Math.floor(hash01(seed, gx, gz, 13) * 3);
  return { x, z, t: 4 + Math.floor(hash01(seed, gx, gz, 14) * 3) };
}

/** A chunk's blocks, made from the seed alone (edits are laid over by the World). */
export function generateChunk(seed: number, cx: number, cz: number): Uint8Array {
  const out = new Uint8Array(CX * CY * CX);
  const [, , , d] = noisesOf(seed) as [Noise, Noise, Noise, Noise];
  const x0 = cx * CX, z0 = cz * CX;
  // heights with a one-block border (for the slopes)
  const H = new Int16Array(18 * 18);
  for (let z = -1; z <= CX; z++) for (let x = -1; x <= CX; x++) H[(z + 1) * 18 + x + 1] = heightAt(seed, x0 + x, z0 + z);
  const hAt = (x: number, z: number) => H[(z + 1) * 18 + x + 1]!;
  for (let z = 0; z < CX; z++) {
    for (let x = 0; x < CX; x++) {
      const hgt = hAt(x, z);
      const slope = Math.abs(hAt(x + 1, z) - hAt(x - 1, z)) + Math.abs(hAt(x, z + 1) - hAt(x, z - 1));
      const wet = hgt <= SEA + 1;
      const top = wet ? SAND : hgt >= 47 ? SNOW : slope > 5 ? STONE : GRASS;
      const under = wet ? SAND : top === GRASS ? DIRT : STONE;
      for (let y = 0; y <= hgt; y++) out[idx(x, y, z)] = y === hgt ? top : y >= hgt - 3 ? under : STONE;
      for (let y = hgt + 1; y <= SEA; y++) out[idx(x, y, z)] = WATER;
      // caves near the surface: where two noises both cross zero (tunnels), in the top 16 blocks, never under water
      if (hgt > SEA + 2) {
        const wx = x0 + x, wz = z0 + z;
        for (let y = Math.max(3, hgt - 16); y <= hgt; y++) {
          if (y === hgt && slope < 3) continue; // a mouth only on a slope
          const n1 = d.n3(wx / 19, y / 11, wz / 19);
          if (n1 > 0.085 || n1 < -0.085) continue;
          const n2 = d.n3(wx / 19 + 71.3, y / 11 + 13.1, wz / 19 - 47.9);
          if (n2 > 0.1 || n2 < -0.1) continue;
          out[idx(x, y, z)] = AIR;
        }
      }
    }
  }
  // trees, from every 5 × 5 cell that can reach this chunk
  const forest = noisesOf(seed)[1]!;
  for (let gz = Math.floor((z0 - 3) / 5); gz <= Math.floor((z0 + CX + 2) / 5); gz++) {
    for (let gx = Math.floor((x0 - 3) / 5); gx <= Math.floor((x0 + CX + 2) / 5); gx++) {
      const t = treeIn(seed, gx, gz, forest);
      if (!t) continue;
      const hgt = heightAt(seed, t.x, t.z);
      if (hgt <= SEA + 1 || hgt >= 44) continue;
      const lx = t.x - x0, lz = t.z - z0;
      // it stands on grass (the column's own top, as made above, from the seed alone)
      const nb = [heightAt(seed, t.x + 1, t.z), heightAt(seed, t.x - 1, t.z), heightAt(seed, t.x, t.z + 1), heightAt(seed, t.x, t.z - 1)];
      if (Math.abs(nb[0]! - nb[1]!) + Math.abs(nb[2]! - nb[3]!) > 5) continue;
      const topY = hgt + t.t;
      for (let y = topY - 2; y <= topY + 1; y++) {
        const r = y >= topY ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const corner = Math.abs(dx) === r && Math.abs(dz) === r;
            if (corner && (r === 1 ? y === topY + 1 : hash01(seed, t.x + dx, t.z + dz, y) < 0.6)) continue;
            const x = lx + dx, z = lz + dz;
            if (x < 0 || x >= CX || z < 0 || z >= CX || y >= CY) continue;
            if (out[idx(x, y, z)] === AIR) out[idx(x, y, z)] = LEAVES;
          }
        }
      }
      if (lx >= 0 && lx < CX && lz >= 0 && lz < CX) for (let y = hgt + 1; y < topY && y < CY; y++) out[idx(lx, y, lz)] = LOG;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the world: chunks, edits, a ray

export interface Hit {
  x: number;
  y: number;
  z: number;
  /** The face it was hit on (where a placed block goes: x + nx …). */
  nx: number;
  ny: number;
  nz: number;
  kind: number;
}

export class World {
  readonly chunks = new Map<string, Uint8Array>();
  /** Every changed block: "x,y,z" → kind. */
  readonly edits = new Map<string, number>();
  private byChunk = new Map<string, Map<number, number>>();
  constructor(readonly seed: number, edits: ArrayLike<number> = []) {
    for (let i = 0; i + 3 < edits.length; i += 4) this.record(edits[i]!, edits[i + 1]!, edits[i + 2]!, edits[i + 3]!);
  }
  private record(x: number, y: number, z: number, k: number): void {
    this.edits.set(`${x},${y},${z}`, k);
    const cx = Math.floor(x / CX), cz = Math.floor(z / CX);
    const key = chunkKey(cx, cz);
    let m = this.byChunk.get(key);
    if (!m) this.byChunk.set(key, (m = new Map()));
    m.set(idx(x - cx * CX, y, z - cz * CX), k);
  }
  has(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz));
  }
  /** A chunk's blocks (made now if they are not yet). */
  chunk(cx: number, cz: number): Uint8Array {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = generateChunk(this.seed, cx, cz);
      const m = this.byChunk.get(key);
      if (m) for (const [i, k] of m) c[i] = k;
      this.chunks.set(key, c);
    }
    return c;
  }
  drop(cx: number, cz: number): void {
    this.chunks.delete(chunkKey(cx, cz));
  }
  get(x: number, y: number, z: number): number {
    if (y < 0) return STONE;
    if (y >= CY) return AIR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CX);
    return this.chunk(cx, cz)[idx(x - cx * CX, y, z - cz * CX)]!;
  }
  /** Change a block; says which chunks must be drawn again ([] when nothing changed). */
  set(x: number, y: number, z: number, k: number): string[] {
    if (y < 0 || y >= CY) return [];
    const cx = Math.floor(x / CX), cz = Math.floor(z / CX);
    const c = this.chunk(cx, cz);
    const lx = x - cx * CX, lz = z - cz * CX;
    const i = idx(lx, y, lz);
    if (c[i] === k) return [];
    c[i] = k;
    this.record(x, y, z, k);
    const keys = [chunkKey(cx, cz)];
    if (lx === 0) keys.push(chunkKey(cx - 1, cz));
    if (lx === CX - 1) keys.push(chunkKey(cx + 1, cz));
    if (lz === 0) keys.push(chunkKey(cx, cz - 1));
    if (lz === CX - 1) keys.push(chunkKey(cx, cz + 1));
    return keys;
  }
  /** The y of the top block that is not air in a column (water counts: a boat floats). */
  surface(x: number, z: number): number {
    for (let y = CY - 1; y >= 0; y--) if (this.get(x, y, z) !== AIR) return y;
    return 0;
  }
  /** The edits as a flat list: x, y, z, kind, … (what a save keeps). */
  editList(): number[] {
    const out: number[] = [];
    for (const [k, v] of this.edits) {
      const [x, y, z] = k.split(',').map(Number) as [number, number, number];
      out.push(x, y, z, v);
    }
    return out;
  }
  /**
   * The first block a ray meets within `max` blocks, water passed through (a voxel walk, cell by cell: Amanatides
   * and Woo's), with the face it entered by.
   */
  ray(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max = 6): Hit | null {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= max) {
      const k = this.get(x, y, z);
      if (k !== AIR && k !== WATER && t > 0) return { x, y, z, nx, ny, nz, kind: k };
      if (tx < ty && tx < tz) {
        x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0;
      } else if (ty < tz) {
        y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0;
      } else {
        z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz;
      }
      if (y < 0 || y >= CY) return null;
    }
    return null;
  }
}

// ---------------------------------------------------------------- a saved world

export interface WorldSave {
  v: 1;
  name: string;
  seed: number;
  created: string;
  played: string;
  /** The time of day, 0…1 (0: sunrise). */
  time: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; fly: boolean };
  /** x, y, z, kind, … */
  edits: number[];
  placed: number;
  dug: number;
}

export const encodeSave = (s: WorldSave): Uint8Array => new TextEncoder().encode(JSON.stringify(s));
export function decodeSave(b: Uint8Array | null): WorldSave | null {
  if (!b) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(b)) as WorldSave;
    return s && s.v === 1 && Number.isFinite(s.seed) && Array.isArray(s.edits) && typeof s.name === 'string' ? s : null;
  } catch {
    return null;
  }
}
