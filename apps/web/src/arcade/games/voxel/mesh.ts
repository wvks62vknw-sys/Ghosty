/**
 * The greedy mesher: a chunk's visible faces, side by side faces of one kind merged into one rectangle, so a flat
 * field is two triangles instead of five hundred. Each corner carries its own shade (the face's direction, and the
 * blocks round the corner darkening it: ambient occlusion), and faces whose four corners differ stay one block wide
 * (a stretched shade would smear). Water and glass come out apart (drawn after, see-through). Pure: typed arrays in,
 * typed arrays out, flat index arithmetic in the loops (a chunk in a millisecond or two on a phone).
 */
import { COLOURS, CX, CY, GLASS, KINDS, OPAQUE, WATER } from './world';

/** The padded chunk: 18 × 66 × 18 — the neighbours' edge blocks round it, the world's floor under it, air over it. */
export const PX = CX + 2;
export const PY = CY + 2;
/** What lies under the world: it hides the faces turned to it, and darkens no corner. */
export const FLOOR = 255;
export const pidx = (x: number, y: number, z: number) => ((y + 1) * PX + (z + 1)) * PX + (x + 1);

/** Build the padded copy from a chunk and its four neighbours (null: air). */
export function padChunk(c: Uint8Array, nx: Uint8Array | null, px: Uint8Array | null, nz: Uint8Array | null, pz: Uint8Array | null): Uint8Array {
  const out = new Uint8Array(PX * PY * PX);
  out.fill(FLOOR, 0, PX * PX);
  for (let y = 0; y < CY; y++) {
    for (let z = 0; z < CX; z++) {
      const row = (y * CX + z) * CX;
      out.set(c.subarray(row, row + CX), pidx(0, y, z));
      if (nx) out[pidx(-1, y, z)] = nx[row + CX - 1]!;
      if (px) out[pidx(CX, y, z)] = px[row]!;
    }
    for (let x = 0; x < CX; x++) {
      if (nz) out[pidx(x, y, -1)] = nz[(y * CX + CX - 1) * CX + x]!;
      if (pz) out[pidx(x, y, CX)] = pz[y * CX * CX + x]!;
    }
  }
  return out;
}

export interface Part {
  /** Chunk-local positions, 3 a vertex. */
  pos: Float32Array;
  /** r, g, b, and the face's direction (0…5) plus 8 for glass, 4 a vertex (normalised bytes). */
  col: Uint8Array;
  idx: Uint16Array | Uint32Array;
  quads: number;
}
export interface MeshData {
  opaque: Part;
  clear: Part;
}

/** Hides a face turned to it; darkens a corner next to it. */
const HIDES = new Uint8Array(256);
const DARKENS = new Uint8Array(256);
for (let k = 0; k < KINDS; k++) (HIDES[k] = OPAQUE[k] ? 1 : 0), (DARKENS[k] = OPAQUE[k] ? 1 : 0);
HIDES[FLOOR] = 1;

/** Each direction's light: +x, −x, +y, −y, +z, −z. */
const SHADE = [0.84, 0.78, 1, 0.56, 0.72, 0.9];
const AO = [0.52, 0.68, 0.84, 1];
/** For each axis, the two axes along its faces (u × v points along the axis). */
const UAX = [1, 2, 0];
const VAX = [2, 0, 1];
/** Index steps in the padded array along x, y, z. */
const STEP = [1, PX * PX, PX];
const DIM = [CX, CY, CX];
/** Each kind's three colours, as bytes: [kind][face 0 top, 1 side, 2 bottom][r, g, b]. */
const RGB = COLOURS.map((c) => c.map((hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]));

class Buf {
  pos = new Float32Array(4096 * 12);
  col = new Uint8Array(4096 * 16);
  idx = new Uint32Array(4096 * 6);
  n = 0;
  grow() {
    const p = new Float32Array(this.pos.length * 2);
    p.set(this.pos);
    const c = new Uint8Array(this.col.length * 2);
    c.set(this.col);
    const i = new Uint32Array(this.idx.length * 2);
    i.set(this.idx);
    this.pos = p;
    this.col = c;
    this.idx = i;
  }
  done(): Part {
    const v = this.n * 4;
    return {
      pos: this.pos.slice(0, v * 3),
      col: this.col.slice(0, v * 4),
      idx: v < 65536 ? Uint16Array.from(this.idx.subarray(0, this.n * 6)) : this.idx.slice(0, this.n * 6),
      quads: this.n,
    };
  }
}
const opaqueBuf = new Buf();
const clearBuf = new Buf();
const mask = new Int32Array(CY * CX);

/** The faces of one padded chunk, merged. */
export function meshChunk(pad: Uint8Array): MeshData {
  opaqueBuf.n = 0;
  clearBuf.n = 0;
  const o0 = pidx(0, 0, 0);
  for (let axis = 0; axis < 3; axis++) {
    const u = UAX[axis]!, v = VAX[axis]!;
    const du = DIM[u]!, dv = DIM[v]!;
    const Sa = STEP[axis]!, Su = STEP[u]!, Sv = STEP[v]!;
    for (let sgn = 1; sgn >= -1; sgn -= 2) {
      const dir = axis * 2 + (sgn > 0 ? 0 : 1);
      const fwd = sgn * Sa;
      for (let s = 0; s < DIM[axis]!; s++) {
        let any = false;
        const sb = o0 + s * Sa;
        for (let j = 0; j < dv; j++) {
          let at = sb + j * Sv;
          const row = j * du;
          for (let i = 0; i < du; i++, at += Su) {
            const a = pad[at]!;
            let key = 0;
            if (a !== 0) {
              const b = pad[at + fwd]!;
              if (!HIDES[b] && a !== b) {
                // the four corners' shade from the layer in front: (0,0) (1,0) (1,1) (0,1) in (u, v)
                const f = at + fwd;
                const um = DARKENS[pad[f - Su]!]!, up = DARKENS[pad[f + Su]!]!, vm = DARKENS[pad[f - Sv]!]!, vp = DARKENS[pad[f + Sv]!]!;
                const a0 = um && vm ? 0 : 3 - (um + vm + DARKENS[pad[f - Su - Sv]!]!);
                const a1 = up && vm ? 0 : 3 - (up + vm + DARKENS[pad[f + Su - Sv]!]!);
                const a2 = up && vp ? 0 : 3 - (up + vp + DARKENS[pad[f + Su + Sv]!]!);
                const a3 = um && vp ? 0 : 3 - (um + vp + DARKENS[pad[f - Su + Sv]!]!);
                key = 1 + a + 16 * (a0 | (a1 << 2) | (a2 << 4) | (a3 << 6));
                any = true;
              }
            }
            mask[row + i] = key;
          }
        }
        if (!any) continue;
        // merge: the widest run along u, then as many rows along v as match it (evenly shaded faces only)
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du; ) {
            const key = mask[j * du + i]!;
            if (!key) {
              i++;
              continue;
            }
            const ao = (key - 1) >> 4;
            let w = 1, hh = 1;
            if (ao === 0 || ao === 255 || ao === 85 || ao === 170) {
              while (i + w < du && mask[j * du + i + w] === key) w++;
              outer: while (j + hh < dv) {
                const r = (j + hh) * du + i;
                for (let k = 0; k < w; k++) if (mask[r + k] !== key) break outer;
                hh++;
              }
            }
            for (let jj = 0; jj < hh; jj++) mask.fill(0, (j + jj) * du + i, (j + jj) * du + i + w);
            const kind = (key - 1) & 15;
            const clear = kind === WATER || kind === GLASS;
            emit(clear ? clearBuf : opaqueBuf, axis, u, v, s + (sgn > 0 ? 1 : 0), i, j, w, hh, sgn, dir, kind, ao, kind === WATER && dir === 2);
            i += w;
          }
        }
      }
    }
  }
  return { opaque: opaqueBuf.done(), clear: clearBuf.done() };
}

const vtx = [0, 0, 0];
function emit(b: Buf, axis: number, u: number, v: number, plane: number, i: number, j: number, w: number, hh: number, sgn: number, dir: number, kind: number, ao: number, lowered: boolean): void {
  if ((b.n + 1) * 12 > b.pos.length) b.grow();
  const base = b.n * 4;
  const rgb = RGB[kind]![axis === 1 ? (sgn > 0 ? 0 : 2) : 1]!;
  const sh = SHADE[dir]!;
  const alpha = dir + (kind === GLASS ? 8 : 0);
  let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
  for (let n = 0; n < 4; n++) {
    // corners (0,0) (w,0) (w,h) (0,h); turned the other way, the same corners the other way round
    const c = sgn > 0 ? n : (4 - n) & 3;
    vtx[axis] = plane;
    vtx[u] = i + (c === 1 || c === 2 ? w : 0);
    vtx[v] = j + (c >= 2 ? hh : 0);
    const p = (base + n) * 3;
    b.pos[p] = vtx[0]!;
    b.pos[p + 1] = lowered ? vtx[1]! - 0.12 : vtx[1]!;
    b.pos[p + 2] = vtx[2]!;
    const a = (ao >> (2 * c)) & 3;
    if (n === 0) a0 = a;
    else if (n === 1) a1 = a;
    else if (n === 2) a2 = a;
    else a3 = a;
    const f = sh * AO[a]!;
    const o = (base + n) * 4;
    b.col[o] = rgb[0]! * f;
    b.col[o + 1] = rgb[1]! * f;
    b.col[o + 2] = rgb[2]! * f;
    b.col[o + 3] = alpha;
  }
  // split along the brighter diagonal (no dark seam across a lit corner)
  const x = b.n * 6;
  if (a0 + a2 < a1 + a3) {
    b.idx[x] = base + 1; b.idx[x + 1] = base + 2; b.idx[x + 2] = base + 3;
    b.idx[x + 3] = base + 1; b.idx[x + 4] = base + 3; b.idx[x + 5] = base;
  } else {
    b.idx[x] = base; b.idx[x + 1] = base + 1; b.idx[x + 2] = base + 2;
    b.idx[x + 3] = base; b.idx[x + 4] = base + 2; b.idx[x + 5] = base + 3;
  }
  b.n++;
}
