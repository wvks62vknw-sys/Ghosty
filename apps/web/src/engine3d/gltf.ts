/**
 * THE glTF FILE (BRIEF-ENGINE-3D-1): a scene written as glTF 2.0, one .gltf with its buffer embedded, no library. Metres, y up, one
 * node per object (named as he named it, its size in cm and its material in `extras`), one material per palette entry used, the
 * ground as a node of its own. A downloaded model is written as its own shapes and base colours (the view hands them in); its
 * pictures are not carried. The asset says the sizes are first estimates and lists every credit. Pure.
 */
import { creditsOf, ENGINE_CREDIT, ESTIMATE, materialOf, type Scene } from './scene';
import { engineParts, primsOf, triangles, turnRad } from './shapes';

/** A loaded model's shapes in its own metres, with its own size so the object's size can scale it. */
export interface RawMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Base colour, linear 0 to 1, with alpha. */
  colour: [number, number, number, number];
}
export interface RawModel {
  meshes: RawMesh[];
  /** Its own size, metres (its box), and where that box's base-middle is. */
  size: [number, number, number];
  origin: [number, number, number];
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linear = (hex: number): [number, number, number] => [lin(((hex >> 16) & 255) / 255), lin(((hex >> 8) & 255) / 255), lin((hex & 255) / 255)];

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

interface Chunk {
  name: string;
  positions: number[];
  normals: number[];
  indices: number[];
  material: number;
}

export interface Exported {
  /** The file's text. */
  text: string;
  bytes: number;
  nodes: number;
  meshes: number;
  materials: string[];
  triangles: number;
}

/** The scene as a glTF file's text. `models` holds what the page loaded for each model object, by object id. */
export function exportGltf(s: Scene, models: Record<string, RawModel | undefined> = {}, now = new Date()): Exported {
  const mats: { id: string; name: string; hex: number; metal: number; rough: number; alpha: number }[] = [];
  const matIx = (id: string, rgba?: [number, number, number, number]) => {
    const m = materialOf(id);
    const key = rgba ? `${id}:${rgba.map((v) => v.toFixed(3)).join(',')}` : m.id;
    let i = mats.findIndex((x) => x.id === key);
    if (i < 0) {
      mats.push({ id: key, name: rgba ? `${m.name} (model colour)` : m.name, hex: m.hex, metal: m.metal, rough: m.rough, alpha: rgba ? rgba[3] : m.alpha });
      i = mats.length - 1;
    }
    return i;
  };
  const chunks: Chunk[] = [];
  const nodes: Record<string, unknown>[] = [];
  const ground: Chunk = { name: 'Ground', ...triangles([{ t: 'box', c: [0, -0.01, 0], s: [s.ground.w / 100, 0.02, s.ground.d / 100] }]), material: matIx('stone') };
  chunks.push(ground);
  nodes.push({ name: 'Ground', mesh: 0, extras: { cm: { w: s.ground.w, d: s.ground.d } } });
  for (const o of s.objects) {
    const raw = o.kind === 'model' ? models[o.id] : undefined;
    const t = turnRad(o.rot);
    const node: Record<string, unknown> = { name: o.name, extras: { id: o.id, kind: o.kind, cm: { w: o.w, d: o.d, h: o.h }, material: o.mat, turnDeg: o.rot, ...(o.model ? { credit: o.model.credit, licence: o.model.licence } : {}) } };
    node.translation = [o.x / 100, o.y / 100, o.z / 100];
    node.rotation = [0, Math.sin(t / 2), 0, Math.cos(t / 2)];
    if (raw) {
      const k: [number, number, number] = [o.w / 100 / (raw.size[0] || 1), o.h / 100 / (raw.size[1] || 1), o.d / 100 / (raw.size[2] || 1)];
      raw.meshes.forEach((rm, i) => {
        const pos: number[] = [];
        const nor: number[] = [];
        for (let j = 0; j < rm.positions.length; j += 3) {
          pos.push((rm.positions[j]! - raw.origin[0]) * k[0], (rm.positions[j + 1]! - raw.origin[1]) * k[1], (rm.positions[j + 2]! - raw.origin[2]) * k[2]);
          const nx = rm.normals[j]! / k[0];
          const ny = rm.normals[j + 1]! / k[1];
          const nz = rm.normals[j + 2]! / k[2];
          const l = Math.hypot(nx, ny, nz) || 1;
          nor.push(nx / l, ny / l, nz / l);
        }
        chunks.push({ name: `${o.name} ${i + 1}`, positions: pos, normals: nor, indices: Array.from(rm.indices), material: matIx(o.mat, rm.colour) });
        nodes.push({ ...node, name: raw.meshes.length > 1 ? `${o.name} ${i + 1}` : o.name, mesh: chunks.length - 1 });
      });
      continue;
    }
    // the working engine goes out as one named mesh for each of its parts ("Engine: Piston 2"), in the object's material
    if (o.kind === 'engine') {
      for (const part of engineParts(o)) {
        chunks.push({ name: `${o.name}: ${part.name}`, ...triangles(part.prims), material: matIx(o.mat) });
        nodes.push({ ...node, name: `${o.name}: ${part.name}`, mesh: chunks.length - 1, extras: { ...(node.extras as object), part: part.name, credit: ENGINE_CREDIT } });
      }
      continue;
    }
    chunks.push({ name: o.name, ...triangles(primsOf(o)), material: matIx(o.mat) });
    nodes.push({ ...node, mesh: chunks.length - 1 });
  }
  // one buffer: for each chunk its positions, normals and indices, each part aligned to four bytes
  const parts: Uint8Array[] = [];
  const views: Record<string, unknown>[] = [];
  const accessors: Record<string, unknown>[] = [];
  let at = 0;
  const push = (bytes: Uint8Array, target: number): number => {
    const pad = (4 - (at % 4)) % 4;
    if (pad) parts.push(new Uint8Array(pad));
    at += pad;
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.byteLength, target });
    parts.push(bytes);
    at += bytes.byteLength;
    return views.length - 1;
  };
  const meshes = chunks.map((c) => {
    const pos = new Float32Array(c.positions);
    const nor = new Float32Array(c.normals);
    const idx = new Uint32Array(c.indices);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a]!, pos[i + a]!);
      max[a] = Math.max(max[a]!, pos[i + a]!);
    }
    accessors.push({ bufferView: push(new Uint8Array(pos.buffer), 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
    const pa = accessors.length - 1;
    accessors.push({ bufferView: push(new Uint8Array(nor.buffer), 34962), componentType: 5126, count: nor.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: push(new Uint8Array(idx.buffer), 34963), componentType: 5125, count: idx.length, type: 'SCALAR' });
    return { name: c.name, primitives: [{ attributes: { POSITION: pa, NORMAL: pa + 1 }, indices: pa + 2, material: c.material, mode: 4 }] };
  });
  const buf = new Uint8Array(at);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.byteLength;
  }
  const credits = creditsOf(s);
  const doc = {
    asset: { version: '2.0', generator: 'Ghosty 3-D engine', copyright: credits.length ? `Includes: ${credits.join(' | ')}` : 'Made in Ghosty', extras: { note: ESTIMATE, scene: s.name, exported: now.toISOString(), units: 'metres', credits } },
    scene: 0,
    scenes: [{ name: s.name, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: mats.map((m) => {
      const c = linear(m.hex);
      const rgba = m.id.includes(':') ? (m.id.split(':')[1]!.split(',').map(Number) as number[]) : null;
      return { name: m.name, doubleSided: true, alphaMode: m.alpha < 1 ? 'BLEND' : 'OPAQUE', pbrMetallicRoughness: { baseColorFactor: rgba ? [rgba[0], rgba[1], rgba[2], rgba[3]] : [c[0], c[1], c[2], m.alpha], metallicFactor: m.metal, roughnessFactor: m.rough } };
    }),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: buf.byteLength, uri: `data:application/octet-stream;base64,${b64(buf)}` }],
  };
  const text = JSON.stringify(doc);
  return { text, bytes: new TextEncoder().encode(text).byteLength, nodes: nodes.length, meshes: meshes.length, materials: mats.map((m) => m.name), triangles: chunks.reduce((n, c) => n + c.indices.length / 3, 0) };
}
