/**
 * GHOSTY BUILDS WHAT YOU SAY, with no model: a fixed vocabulary in code. One line ("build me a big stone castle") is
 * read for a thing (house, castle, tower, bridge, pyramid, wall, pool, garden, maze, statue of a cat, boat,
 * lighthouse), a size (small, big, huge) and a material (stone, wood, glass, brick, gold); a generator of its own
 * lays the thing out block by block, varied by a seed (windows, roofs, the maze's paths, the cat's tail), inside the
 * size's bounds. The player puts it in front of him over a few seconds. Pure: the node test checks every word.
 */
import { AIR, BRICK, GLASS, GOLD, LEAVES, LOG, mulberry32, PLANKS, SAND, SNOW, STONE, WATER } from './world';

export const STRUCTURES = ['house', 'castle', 'tower', 'bridge', 'pyramid', 'wall', 'pool', 'garden', 'maze', 'cat', 'boat', 'lighthouse'] as const;
export type Structure = (typeof STRUCTURES)[number];

/** How Ghosty says each one. */
export const SAY: Record<Structure, string> = {
  house: 'house', castle: 'castle', tower: 'tower', bridge: 'bridge', pyramid: 'pyramid', wall: 'wall',
  pool: 'pool', garden: 'garden', maze: 'maze', cat: 'statue of a cat', boat: 'boat', lighthouse: 'lighthouse',
};
const ALSO: Record<string, Structure> = {
  home: 'house', hut: 'house', cottage: 'house', cabin: 'house', houses: 'house', fort: 'castle', fortress: 'castle', palace: 'castle',
  castles: 'castle', spire: 'tower', towers: 'tower', bridges: 'bridge', pyramids: 'pyramid', walls: 'wall', pond: 'pool',
  pools: 'pool', gardens: 'garden', labyrinth: 'maze', mazes: 'maze', statue: 'cat', kitty: 'cat', kitten: 'cat', cats: 'cat',
  ship: 'boat', yacht: 'boat', sailboat: 'boat', boats: 'boat', lighthouses: 'lighthouse',
};

export const SIZES = ['small', 'big', 'huge'] as const;
export type Size = 'small' | 'normal' | 'big' | 'huge';
const SIZE_ALSO: Record<string, Size> = { little: 'small', tiny: 'small', mini: 'small', large: 'big', giant: 'huge', massive: 'huge', enormous: 'huge', gigantic: 'huge', medium: 'normal' };

export const MATERIALS = { stone: STONE, wood: PLANKS, glass: GLASS, brick: BRICK, gold: GOLD } as const;
export type Material = keyof typeof MATERIALS;
const MAT_ALSO: Record<string, Material> = { wooden: 'wood', golden: 'gold', stones: 'stone', bricks: 'brick', planks: 'wood', timber: 'wood' };

/** Each thing's own material when none is said. */
const DEFAULT: Record<Structure, number> = {
  house: PLANKS, castle: STONE, tower: STONE, bridge: PLANKS, pyramid: SAND, wall: STONE,
  pool: STONE, garden: BRICK, maze: LEAVES, cat: STONE, boat: PLANKS, lighthouse: BRICK,
};

/** Each size's box: x within ±(w − 1)/2, z from 0 to w − 1, y from 0 to h − 1 (and a foundation down to −10). */
export const BOUNDS: Record<Size, { w: number; h: number }> = { small: { w: 9, h: 12 }, normal: { w: 15, h: 20 }, big: { w: 23, h: 28 }, huge: { w: 31, h: 38 } };
export const FOUNDATION = -10;

export interface BuildAsk {
  what: Structure;
  size: Size;
  material: Material | null;
}

/** The thing, size and material in a line (null: no thing he can build is named). */
export function parseBuild(line: string): BuildAsk | null {
  const words = line.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let what: Structure | null = null;
  let size: Size = 'normal';
  let material: Material | null = null;
  for (const w of words) {
    if (!what) what = (STRUCTURES as readonly string[]).includes(w) ? (w as Structure) : ALSO[w] ?? null;
    if ((SIZES as readonly string[]).includes(w)) size = w as Size;
    else if (SIZE_ALSO[w]) size = SIZE_ALSO[w];
    if (w in MATERIALS) material = w as Material;
    else if (MAT_ALSO[w]) material = MAT_ALSO[w];
  }
  return what ? { what, size, material } : null;
}

/** What Ghosty says to a word he does not know. */
export const VOCABULARY_LINE = `I can build these: ${STRUCTURES.map((s) => SAY[s]).join(', ')}. Say small, big or huge, and stone, wood, glass, brick or gold.`;

export interface Block {
  x: number;
  y: number;
  z: number;
  k: number;
  /** Only into air or water (a foundation, a bridge's pier): never over the ground. */
  fill?: boolean;
}

export interface Plan {
  ask: BuildAsk;
  /** The kind the thing is mostly made of. */
  kind: number;
  /** The blocks in the order they go in: what clears the space first, then from the bottom up, the middle out. */
  blocks: Block[];
  /** How far it sits into the ground (a boat floats one block deep, a pool is dug). */
  sink: number;
  /** "a big stone castle" */
  name: string;
}

/** The blocks of a plan as they are laid out (later writes win). */
class Vox {
  m = new Map<number, Block>();
  set(x: number, y: number, z: number, k: number, fill = false): void {
    this.m.set(((x + 128) << 16) | ((y + 128) << 8) | (z + 128), { x, y, z, k, fill });
  }
  get(x: number, y: number, z: number): number | undefined {
    return this.m.get(((x + 128) << 16) | ((y + 128) << 8) | (z + 128))?.k;
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, k: number): void {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, k);
  }
  /** The four walls of a box (no top or bottom). */
  walls(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, k: number): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.set(x, y, z0, k), this.set(x, y, z1, k);
      for (let z = z0; z <= z1; z++) this.set(x0, y, z, k), this.set(x1, y, z, k);
    }
  }
  /** Battlements along a box's top edge: every other block one higher. */
  crenels(x0: number, y: number, z0: number, x1: number, z1: number, k: number): void {
    for (let x = x0; x <= x1; x++) if ((x - x0) % 2 === 0) this.set(x, y, z0, k), this.set(x, y, z1, k);
    for (let z = z0; z <= z1; z++) if ((z - z0) % 2 === 0) this.set(x0, y, z, k), this.set(x1, y, z, k);
  }
  /** A ring (round) of radius r round (cx, cz) on one level: ring cells only, or the whole disc. */
  ring(cx: number, y: number, cz: number, r: number, k: number, disc = false): void {
    const lo = (r - 0.5) * (r - 0.5), hi = (r + 0.5) * (r + 0.5);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 <= hi && (disc || d2 >= lo)) this.set(cx + dx, y, cz + dz, k);
      }
    }
  }
  list(): Block[] {
    return [...this.m.values()];
  }
}

const SI: Record<Size, number> = { small: 0, normal: 1, big: 2, huge: 3 };

type Gen = (v: Vox, s: number, k: number, r: () => number) => void;

const GEN: Record<Structure, Gen> = {
  house(v, s, k, r) {
    const w = [5, 7, 9, 13][s]!, d = [5, 7, 11, 15][s]!, hw = [3, 4, 4, 5][s]!;
    const x0 = -(w - 1) / 2, x1 = (w - 1) / 2, z0 = 1, z1 = d;
    const roof = k === PLANKS ? BRICK : k;
    const layers = (w + 3) / 2;
    v.box(x0 + 1, 1, z0 + 1, x1 - 1, hw + layers, z1 - 1, AIR);
    v.box(x0, 0, z0, x1, 0, z1, k);
    v.walls(x0, 1, z0, x1, hw, z1, k);
    if (k === PLANKS && s >= 2) for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) for (let y = 1; y <= hw; y++) v.set(x, y, z, LOG);
    // windows along the sides and the back, a door in front
    const glass = k === GLASS ? PLANKS : GLASS;
    for (let z = z0 + 2; z <= z1 - 2; z += 2 + (r() < 0.3 ? 1 : 0)) v.set(x0, 2, z, glass), v.set(x1, 2, z, glass);
    if (w >= 7) v.set(x0 + 2, 2, z0, glass), v.set(x1 - 2, 2, z0, glass), v.set(0, 2, z1, glass);
    v.set(0, 1, z0, AIR);
    v.set(0, 2, z0, AIR);
    if (s >= 3) v.set(-1, 1, z0, AIR), v.set(-1, 2, z0, AIR);
    if (r() < 0.3 && k !== PLANKS) {
      // a flat roof with a low wall round it
      v.box(x0, hw + 1, z0, x1, hw + 1, z1, roof);
      v.crenels(x0, hw + 2, z0, x1, z1, k);
      return;
    }
    // a pitched roof, the ridge running front to back, the gable ends filled
    for (let i = 0; i < layers; i++) {
      const y = hw + 1 + i, a = x0 - 1 + i, b = x1 + 1 - i;
      for (let z = z0 - 1; z <= z1 + 1; z++) v.set(a, y, z, roof), v.set(b, y, z, roof);
      for (let x = a + 1; x < b; x++) v.set(x, y, z0, k), v.set(x, y, z1, k);
    }
    if (r() < 0.6) for (let y = hw + 1; y <= hw + layers; y++) v.set(x1 - 1, y, z1 - 1, BRICK);
  },
  castle(v, s, k, r) {
    const W = [9, 15, 23, 31][s]!, wh = [4, 5, 7, 9][s]!, ts = [3, 3, 5, 5][s]!, th = wh + [2, 3, 4, 5][s]!;
    const x0 = -(W - 1) / 2, x1 = (W - 1) / 2, z0 = 0, z1 = W - 1;
    const thick = s >= 2 ? 2 : 1;
    v.box(x0, 0, z0, x1, th + 2, z1, AIR);
    for (let t = 0; t < thick; t++) v.walls(x0 + t, 0, z0 + t, x1 - t, wh - 1, z1 - t, k);
    v.crenels(x0, wh, z0, x1, z1, k);
    const round = r() < 0.4;
    const towerAt = (cx: number, cz: number, hgt: number) => {
      const half = (ts - 1) / 2;
      for (let y = 0; y < hgt; y++) {
        if (round && ts >= 5) v.ring(cx, y, cz, half, k);
        else v.walls(cx - half, y, cz - half, cx + half, y, cz + half, k);
      }
      v.box(cx - half + 1, 0, cz - half + 1, cx + half - 1, hgt - 1, cz + half - 1, AIR);
      v.box(cx - half, hgt - 1, cz - half, cx + half, hgt - 1, cz + half, k);
      v.crenels(cx - half, hgt, cz - half, cx + half, cz + half, k);
      for (let y = 2; y < hgt - 1; y += 3) v.set(cx, y, cz - half, GLASS === k ? STONE : GLASS);
      v.set(cx, hgt, cz, LOG);
      v.set(cx, hgt + 1, cz, k === GOLD ? BRICK : GOLD);
    };
    const h2 = (ts - 1) / 2;
    for (const [cx, cz] of [[x0 + h2, z0 + h2], [x1 - h2, z0 + h2], [x0 + h2, z1 - h2], [x1 - h2, z1 - h2]] as const) towerAt(cx, cz, th);
    // the gate
    const gw = s >= 2 ? 1 : 0, gh = s >= 1 ? 3 : 2;
    for (let t = 0; t < thick; t++) v.box(-gw, 0, z0 + t, gw, gh - 1, z0 + t, AIR);
    if (s >= 2) {
      // the keep
      const kw = [0, 0, 7, 9][s]!, kh = th + 2;
      const kz = Math.floor((z0 + z1) / 2);
      const a = -(kw - 1) / 2, b = (kw - 1) / 2;
      v.walls(a, 0, kz - b, b, kh - 1, kz + b, k);
      v.box(a, kh - 1, kz - b, b, kh - 1, kz + b, k);
      v.crenels(a, kh, kz - b, b, kz + b, k);
      v.set(0, 0, kz - b, AIR);
      v.set(0, 1, kz - b, AIR);
      for (let y = 3; y < kh - 1; y += 3) for (const x of [a + 2, b - 2]) v.set(x, y, kz - b, GLASS === k ? STONE : GLASS);
    }
  },
  tower(v, s, k, r) {
    const rad = [2, 3, 4, 5][s]!, ht = [8, 14, 21, 31][s]!;
    const cz = rad + 1;
    v.box(-rad - 1, 0, 0, rad + 1, ht + 2, 2 * rad + 2, AIR);
    for (let y = 0; y < ht; y++) v.ring(0, y, cz, rad, k);
    for (let y = 0; y < ht; y += 5) v.ring(0, y, cz, rad - 1, k, true);
    // windows climbing round it
    const win = k === GLASS ? STONE : GLASS;
    let a = r() * Math.PI * 2;
    for (let y = 3; y < ht - 1; y += 3) {
      v.set(Math.round(Math.sin(a) * rad), y, cz + Math.round(Math.cos(a) * rad), win);
      a += Math.PI / 2.5;
    }
    v.set(0, 1, cz - rad, AIR);
    v.set(0, 2, cz - rad, AIR);
    // the top: a wider floor, battlements round it
    v.ring(0, ht, cz, rad + 1, k, true);
    const lo = (rad + 0.5) * (rad + 0.5), hi = (rad + 1.5) * (rad + 1.5);
    for (let dz = -rad - 1; dz <= rad + 1; dz++) {
      for (let dx = -rad - 1; dx <= rad + 1; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > lo && d2 <= hi && (dx + dz) % 2 === 0) v.set(dx, ht + 1, cz + dz, k);
      }
    }
  },
  bridge(v, s, k) {
    const L = [9, 15, 23, 31][s]!, bw = [3, 3, 5, 7][s]!, rise = [1, 2, 3, 4][s]!;
    const x0 = -(bw - 1) / 2, x1 = (bw - 1) / 2;
    for (let z = 0; z < L; z++) {
      const y = Math.min(z, rise, L - 1 - z);
      v.box(x0, y + 1, z, x1, y + 3, z, AIR);
      for (let x = x0; x <= x1; x++) v.set(x, y, z, k);
      if (z % 2 === 0 || y === rise) v.set(x0 - 1, y + 1, z, k), v.set(x1 + 1, y + 1, z, k);
      if (y === rise && z % 6 === 3) {
        for (let d = 1; d <= 9; d++) v.set(x0, y - d, z, k, true), v.set(x1, y - d, z, k, true);
        if (s >= 2) for (const x of [x0 - 1, x1 + 1]) v.set(x, y + 2, z, LOG), v.set(x, y + 3, z, k === GOLD ? GLASS : GOLD);
      }
    }
  },
  pyramid(v, s, k) {
    const B = [7, 13, 21, 29][s]!;
    const half = (B - 1) / 2;
    const hollow = s >= 2;
    for (let i = 0; i <= half; i++) {
      for (let z = i; z <= B - 1 - i; z++) {
        for (let x = -half + i; x <= half - i; x++) {
          const edge = x === -half + i || x === half - i || z === i || z === B - 1 - i;
          v.set(x, i, z, hollow && !edge && i > 0 && i < half ? AIR : k);
        }
      }
    }
    v.set(0, half, half, k === GOLD ? GLASS : GOLD);
    // a way in
    for (let z = 0; z <= (hollow ? 2 : 1); z++) v.set(0, 1, z, AIR), v.set(0, 2, z, AIR);
  },
  wall(v, s, k) {
    const W = [9, 15, 23, 31][s]!, wh = [3, 4, 6, 8][s]!;
    const x0 = -(W - 1) / 2, x1 = (W - 1) / 2;
    const thick = s >= 2 ? 2 : 1;
    v.box(x0, 0, 2, x1, wh + 3, 2 + thick, AIR);
    v.box(x0, 0, 2, x1, wh - 1, 1 + thick, k);
    for (let x = x0; x <= x1; x += 2) v.set(x, wh, 2, k), v.set(x, wh, 1 + thick, k);
    if (s >= 2) {
      for (let x = x0; x <= x1; x += 8) v.box(x - 1, 0, 1, x + 1, wh + 1, 2 + thick, k), v.set(x, wh + 2, 1, k), v.set(x, wh + 2, 2 + thick, k);
      v.box(-1, 0, 2, 1, 2, 1 + thick, AIR);
    }
  },
  pool(v, s, k) {
    const w = [5, 7, 11, 15][s]!, d = [7, 9, 13, 19][s]!;
    const x0 = -(w - 1) / 2, x1 = (w - 1) / 2, z0 = s >= 2 ? 3 : 1, z1 = z0 + d - 1;
    // a paved deck round the bigger pools, two blocks wide, set into the ground
    if (s >= 2) for (let t = 1; t <= 2; t++) v.walls(x0 - t, -1, z0 - t, x1 + t, -1, z1 + t, k);
    v.box(x0, 1, z0, x1, 3, z1, AIR);
    v.walls(x0, 0, z0, x1, 0, z1, k);
    v.box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, AIR);
    v.walls(x0, -3, z0, x1, -1, z1, k);
    v.box(x0 + 1, -3, z0 + 1, x1 - 1, -3, z1 - 1, k);
    v.box(x0 + 1, -2, z0 + 1, x1 - 1, -1, z1 - 1, WATER);
    if (s >= 2) {
      // a deep end, lights in the walls, a board to dive from
      v.box(x0 + 1, -4, Math.ceil((z0 + z1) / 2), x1 - 1, -4, z1 - 1, k);
      v.box(x0 + 1, -3, Math.ceil((z0 + z1) / 2), x1 - 1, -3, z1 - 1, WATER);
      for (let z = z0 + 2; z < z1; z += 3) v.set(x0, -2, z, k === GOLD ? GLASS : GOLD), v.set(x1, -2, z, k === GOLD ? GLASS : GOLD);
      for (let z = z1; z >= z1 - 2; z--) v.set(0, 1, z, PLANKS);
    }
  },
  garden(v, s, k, r) {
    const W = [7, 11, 17, 23][s]!;
    const half = (W - 1) / 2, x0 = -half, x1 = half, z0 = 0, z1 = W - 1, cz = half;
    v.box(x0, 0, z0, x1, 4, z1, AIR);
    v.walls(x0, 0, z0, x1, 0, z1, k);
    const pw = s >= 1 ? 1 : 0;
    v.box(-pw, 0, z0, pw, 0, z0, AIR);
    // paths set into the ground, a cross from the gate
    v.box(-pw, -1, z0, pw, -1, z1 - 1, k);
    v.box(x0 + 1, -1, cz - pw, x1 - 1, -1, cz + pw, k);
    // the fountain
    const fr = s >= 2 ? 2 : 1;
    v.walls(-fr, 0, cz - fr, fr, 0, cz + fr, k);
    v.box(-fr + 1, 0, cz - fr + 1, fr - 1, 0, cz + fr - 1, WATER);
    if (s >= 2) v.set(0, 0, cz, k), v.set(0, 1, cz, k), v.set(0, 2, cz, k === GOLD ? GLASS : GOLD);
    // the beds: hedges along the walls, flowers, a tree in each corner (bigger gardens)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const bx = sx < 0 ? x0 + 1 : x1 - 1;
      const bz = sz < 0 ? z0 + 1 : z1 - 1;
      for (let i = 0; i < Math.max(1, half - fr - 2); i++) {
        v.set(bx - sx * i, 0, bz, LEAVES);
        if (r() < 0.25) v.set(bx - sx * i, 1, bz, r() < 0.5 ? GOLD : BRICK);
      }
      if (s >= 1) {
        const tx = bx - sx * 2, tz = bz - sz * 2;
        for (let y = 0; y < 3; y++) v.set(tx, y, tz, LOG);
        v.box(tx - 1, 3, tz - 1, tx + 1, 3, tz + 1, LEAVES);
        v.set(tx, 4, tz, LEAVES);
      }
    }
  },
  maze(v, s, k, r) {
    const n = [3, 5, 9, 13][s]!, wh = [2, 3, 3, 4][s]!;
    const W = 2 * n + 1, half = (W - 1) / 2;
    const open = new Uint8Array(W * W);
    const cell = (cx: number, cz: number) => (2 * cz + 1) * W + 2 * cx + 1;
    // a seeded walk that never crosses itself (recursive backtracking)
    const seen = new Uint8Array(n * n);
    const stack: [number, number][] = [[0, 0]];
    seen[0] = 1;
    open[cell(0, 0)] = 1;
    while (stack.length) {
      const [cx, cz] = stack[stack.length - 1]!;
      const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([dx, dz]) => cx + dx >= 0 && cx + dx < n && cz + dz >= 0 && cz + dz < n && !seen[(cz + dz) * n + cx + dx]);
      if (!next.length) {
        stack.pop();
        continue;
      }
      const [dx, dz] = next[Math.floor(r() * next.length)]!;
      seen[(cz + dz) * n + cx + dx] = 1;
      open[(2 * cz + 1 + dz) * W + 2 * cx + 1 + dx] = 1;
      open[cell(cx + dx, cz + dz)] = 1;
      stack.push([cx + dx, cz + dz]);
    }
    open[1] = 1; // the way in, at the front
    open[(W - 1) * W + W - 2] = 1; // the way out, at the back
    for (let z = 0; z < W; z++) {
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < wh + 1; y++) v.set(x - half, y, z, open[z * W + x] || y === wh ? AIR : k);
      }
    }
    const c = Math.floor(n / 2);
    v.set(2 * c + 1 - half, 0, 2 * c + 1, k === GOLD ? GLASS : GOLD);
  },
  cat(v, s, k, r) {
    const u = [0.8, 1.1, 1.7, 2.6][s]!;
    const side = r() < 0.5 ? 1 : -1;
    const bz = 4.5 * u;
    const inE = (x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) =>
      ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
    const X = Math.ceil(3.2 * u) + 1, Y = Math.ceil(9.6 * u), Z = Math.ceil(bz + 3.4 * u) + 1;
    const plinth = s >= 2 ? 1 : 0;
    for (let y = 0; y <= Y; y++) {
      for (let z = 0; z <= Z; z++) {
        for (let x = -X; x <= X; x++) {
          const px = x, py = y + 0.5 - plinth, pz = z + 0.5;
          let hit = inE(px, py, pz, 0, 2.6 * u, bz, 2.1 * u, 2.7 * u, 2.4 * u) || inE(px, py, pz, 0, 6.3 * u, bz - 1.2 * u, 1.9 * u, 1.75 * u, 1.75 * u);
          // ears: little pyramids on the head
          for (const ex of [-1.05 * u, 1.05 * u]) {
            const t = (py - 7.6 * u) / (1.6 * u);
            if (t >= 0 && t <= 1 && Math.abs(px - ex) <= (1 - t) * 0.75 * u + 0.35 && Math.abs(pz - (bz - 1.2 * u)) <= (1 - t) * 0.5 * u + 0.35) hit = true;
          }
          // front legs
          for (const lx of [-0.9 * u, 0.9 * u]) if (py < 2.4 * u && (px - lx) ** 2 + (pz - (bz - 1.9 * u)) ** 2 <= (0.55 * u) ** 2 + 0.2) hit = true;
          // the tail, curled round the body on the ground
          for (let a = 0; a <= 1; a += 0.05) {
            const ang = Math.PI * (0.15 + 0.9 * a);
            const tx = side * Math.cos(ang - Math.PI / 2) * 2.7 * u, tz = bz + Math.sin(ang - Math.PI / 2) * -2.7 * u, ty = 0.5 * u + a * a * 0.8 * u;
            if ((px - tx) ** 2 + (py - ty) ** 2 + (pz - tz) ** 2 <= (0.48 * u) ** 2 + 0.15) hit = true;
          }
          if (hit) v.set(x, y, z, k);
        }
      }
    }
    if (plinth) v.box(-X, 0, 0, X, 0, Z, k);
    // eyes and a nose on the face (the face looks towards him)
    const fz = Math.floor(bz - 1.2 * u - 1.75 * u + 0.5);
    const ey = Math.round(6.5 * u - 0.5 + plinth);
    const ex = Math.max(1, Math.round(0.75 * u));
    v.set(-ex, ey, fz, LEAVES);
    v.set(ex, ey, fz, LEAVES);
    v.set(0, Math.round(5.8 * u - 0.5 + plinth), fz, k === BRICK ? GOLD : BRICK);
  },
  boat(v, s, k) {
    const L = [7, 11, 17, 25][s]!, B = [3, 5, 7, 9][s]!, hh = [1, 2, 2, 3][s]!;
    const half = (B - 1) / 2;
    const hwAt = (z: number) => {
      const bow = (L - 1 - z) / (L * 0.35);
      const stern = z / (L * 0.12);
      return Math.max(0, Math.round(half * Math.min(1, bow, stern + 0.6)));
    };
    for (let z = 0; z < L; z++) {
      const hw = hwAt(z);
      for (let x = -hw; x <= hw; x++) {
        v.set(x, 0, z, Math.abs(x) <= Math.max(0, hw - 1) || hw === 0 ? k : k);
        for (let y = 1; y <= hh; y++) v.set(x, y, z, Math.abs(x) === hw || z === 0 || hwAt(z + 1) < Math.abs(x) ? k : y === hh ? k : AIR);
      }
    }
    // the mast and a sail
    const mz = Math.floor(L / 2), mh = [4, 6, 9, 13][s]!;
    for (let y = hh + 1; y <= hh + mh; y++) v.set(0, y, mz, LOG);
    for (let y = hh + 2; y < hh + mh; y++) {
      const span = Math.floor(((hh + mh - y) / (mh - 1)) * (mz - 1));
      for (let z = mz - span; z < mz; z++) v.set(0, y, z, SNOW);
    }
    if (s >= 2) {
      const cz = Math.max(1, mz - 4);
      v.walls(-1, hh + 1, cz, 1, hh + 2, cz + 2, PLANKS);
      v.set(-1, hh + 2, cz + 1, GLASS);
      v.set(1, hh + 2, cz + 1, GLASS);
      v.box(-1, hh + 3, cz, 1, hh + 3, cz + 2, k);
    }
  },
  lighthouse(v, s, k) {
    const rad = [1, 2, 2, 3][s]!, ht = [7, 11, 17, 25][s]!;
    const cz = rad + 2;
    v.box(-rad - 1, 0, 0, rad + 1, ht + 8, 2 * rad + 4, AIR);
    for (let y = 0; y < ht; y++) v.ring(0, y, cz, rad, y % 5 < 3 ? k : SNOW);
    v.ring(0, 0, cz, rad, k, true);
    v.set(0, 1, cz - rad, AIR);
    v.set(0, 2, cz - rad, AIR);
    // the gallery, its rail, the lantern with its light, the roof
    v.ring(0, ht, cz, rad + 1, k, true);
    v.ring(0, ht + 1, cz, rad + 1, k);
    const lr = Math.max(1, rad - 1 + (s >= 2 ? 1 : 0));
    const lh = s >= 2 ? 3 : 2;
    for (let y = ht + 1; y <= ht + lh; y++) {
      v.ring(0, y, cz, lr, GLASS);
      v.set(0, y, cz, GOLD);
    }
    for (let i = 0; i <= lr; i++) v.ring(0, ht + lh + 1 + i, cz, lr - i, k === BRICK ? STONE : BRICK, true);
  },
};

/** The plan for a line he said, varied by the seed, inside its size's bounds. */
export function plan(ask: BuildAsk, seed: number): Plan {
  const k = ask.material ? MATERIALS[ask.material] : DEFAULT[ask.what];
  const v = new Vox();
  const r = mulberry32((seed ^ Math.imul(STRUCTURES.indexOf(ask.what) + 1, 0x9e3779b1)) >>> 0);
  GEN[ask.what](v, SI[ask.size], k, r);
  const b = BOUNDS[ask.size];
  const half = (b.w - 1) / 2;
  const blocks = v.list().filter((p) => Math.abs(p.x) <= half && p.z >= 0 && p.z < b.w && p.y >= FOUNDATION && p.y < b.h);
  // air first (it clears the space), then foundations, then the rest from the bottom up and the middle out
  const rank = (p: Block) => (p.k === AIR ? 0 : p.fill ? 1 : 2);
  const cz = b.w / 3;
  blocks.sort((p, q) => rank(p) - rank(q) || (p.fill ? q.y - p.y : p.y - q.y) || Math.hypot(p.x, p.z - cz) - Math.hypot(q.x, q.z - cz));
  const mat = ask.material ?? '';
  const name = `${ask.size === 'normal' ? 'a' : `a ${ask.size}`}${mat ? ` ${mat}` : ''} ${SAY[ask.what]}`;
  return { ask, kind: k, blocks, sink: ask.what === 'boat' ? 1 : 0, name };
}

/** Ghosty's line as the thing goes up. */
export const startLine = (p: Plan): string => `${p.name[0]!.toUpperCase()}${p.name.slice(1)} coming up. Give me a moment.`;
/** And when it is done. */
export const doneLine = (p: Plan, n: number): string => `There's your ${SAY[p.ask.what]}: ${n.toLocaleString('en-GB')} blocks.`;
