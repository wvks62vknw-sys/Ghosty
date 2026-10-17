/**
 * Splitting one mesh into the pieces it is really made of (connected components), so even a
 * model that arrives as a single mesh can be taken apart. Pure numbers, unit-tested in Node.
 *
 * glTF files cut vertices at every texture seam and hard edge, so two triangles of the same
 * piece often share a corner position but not a vertex number. Corners are therefore welded by
 * position first (to a tolerance relative to the model's size), then triangles that share a
 * welded corner are joined (union-find). Tiny crumbs — screws, decals, stray triangles — are
 * folded into the nearest real piece so a busy model gives a part list a person can use.
 */

/** The triangles (by number) of each piece, biggest piece first. */
export type Pieces = Uint32Array[];

function find(p: Int32Array, x: number): number {
  while (p[x]! !== x) {
    p[x] = p[p[x]!]!;
    x = p[x]!;
  }
  return x;
}

/**
 * Connected pieces of a triangle mesh. `pos` is x,y,z per vertex; `index` three vertex numbers
 * per triangle (null: every three vertices are a triangle). At most `maxParts` pieces come back
 * (default 48); pieces under `minShare` of the triangles (default 0.2 %) join their nearest piece.
 */
export function splitPieces(pos: ArrayLike<number>, index: ArrayLike<number> | null, opts: { maxParts?: number; minShare?: number } = {}): Pieces {
  const nv = Math.floor(pos.length / 3);
  const tris = index ? Math.floor(index.length / 3) : Math.floor(nv / 3);
  if (!tris) return [];
  const vi = (t: number, k: number) => (index ? index[t * 3 + k]! : t * 3 + k);

  // Weld corners by position: a grid of cells the tolerance wide.
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i * 3 + k]!;
      if (v < lo[k]!) lo[k] = v;
      if (v > hi[k]!) hi[k] = v;
    }
  }
  if (!Number.isFinite(lo[0]!)) lo = hi = [0, 0, 0];
  const diag = Math.hypot(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) || 1;
  const tol = diag * 1e-5;
  const weld = new Int32Array(nv);
  const cells = new Map<string, number>();
  for (let i = 0; i < nv; i++) {
    const key = `${Math.round(pos[i * 3]! / tol)},${Math.round(pos[i * 3 + 1]! / tol)},${Math.round(pos[i * 3 + 2]! / tol)}`;
    const had = cells.get(key);
    if (had === undefined) {
      cells.set(key, i);
      weld[i] = i;
    } else weld[i] = had;
  }

  // Join the corners of every triangle.
  const parent = new Int32Array(nv);
  for (let i = 0; i < nv; i++) parent[i] = i;
  const union = (x: number, y: number) => {
    const rx = find(parent, x);
    const ry = find(parent, y);
    if (rx !== ry) parent[ry] = rx;
  };
  for (let t = 0; t < tris; t++) {
    const a = weld[vi(t, 0)]!;
    union(a, weld[vi(t, 1)]!);
    union(a, weld[vi(t, 2)]!);
  }

  // Triangles by piece.
  const byRoot = new Map<number, number[]>();
  for (let t = 0; t < tris; t++) {
    const r = find(parent, weld[vi(t, 0)]!);
    let list = byRoot.get(r);
    if (!list) byRoot.set(r, (list = []));
    list.push(t);
  }
  const groups = [...byRoot.values()].sort((x, y) => y.length - x.length);
  if (groups.length === 1) return [Uint32Array.from(groups[0]!)];

  // Fold crumbs (and anything past maxParts) into the nearest kept piece, by centre.
  const maxParts = Math.max(1, opts.maxParts ?? 48);
  const minTris = Math.max(1, Math.ceil(tris * (opts.minShare ?? 0.002)));
  const centre = (g: number[]): [number, number, number] => {
    const c: [number, number, number] = [0, 0, 0];
    for (const t of g) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) c[a] = c[a]! + pos[vi(t, k) * 3 + a]!;
    const n = g.length * 3;
    return [c[0] / n, c[1] / n, c[2] / n];
  };
  const keep = groups.filter((g, i) => i < maxParts && (g.length >= minTris || i === 0));
  const rest = groups.slice(keep.length);
  const centres = keep.map(centre);
  for (const g of rest) {
    const c = centre(g);
    let best = 0;
    let bd = Infinity;
    centres.forEach((k, i) => {
      const d = (k[0] - c[0]) ** 2 + (k[1] - c[1]) ** 2 + (k[2] - c[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    keep[best]!.push(...g);
  }
  return keep.map((g) => Uint32Array.from(g.sort((x, y) => x - y)));
}

/**
 * One piece as its own small mesh: which old vertices it uses (in order) and its triangles
 * renumbered to those. The viewer copies every vertex attribute through `vertices`.
 */
export function subsetIndex(index: ArrayLike<number> | null, tris: ArrayLike<number>): { vertices: Uint32Array; index: Uint32Array } {
  const map = new Map<number, number>();
  const verts: number[] = [];
  const out = new Uint32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i]!;
    for (let k = 0; k < 3; k++) {
      const old = index ? index[t * 3 + k]! : t * 3 + k;
      let n = map.get(old);
      if (n === undefined) {
        n = verts.length;
        map.set(old, n);
        verts.push(old);
      }
      out[i * 3 + k] = n;
    }
  }
  return { vertices: Uint32Array.from(verts), index: out };
}
