/**
 * THE 3-D ENGINE'S SCENE (BRIEF-ENGINE-3D-1): what he builds, as plain data in centimetres, and the pure operations on it. A scene
 * is a ground and a list of objects; an object is a primitive, one of the ten parametric parts of the Stage (show/parts.ts) or a
 * downloaded free model, each with a place on the ground, a turn, a size he can type and a material from a small palette. Every
 * operation returns the next scene and changes nothing in place, so undo is a list of scenes. Nothing here touches the page.
 */
import { PARTS, type PartKind } from '../show/parts';

export type PrimKind = 'box' | 'cylinder' | 'sphere' | 'plane';
export type Kind = PrimKind | PartKind | 'model';

export interface Material {
  id: string;
  name: string;
  /** sRGB, 0xRRGGBB. */
  hex: number;
  metal: number;
  rough: number;
  alpha: number;
}

/** The palette: nine materials, enough to dress a room and no more. */
export const MATERIALS: Material[] = [
  { id: 'oak', name: 'Oak', hex: 0xc19a6b, metal: 0, rough: 0.7, alpha: 1 },
  { id: 'walnut', name: 'Walnut', hex: 0x5c4033, metal: 0, rough: 0.65, alpha: 1 },
  { id: 'white', name: 'White paint', hex: 0xeeece6, metal: 0, rough: 0.9, alpha: 1 },
  { id: 'stone', name: 'Stone', hex: 0x9a9a95, metal: 0, rough: 0.85, alpha: 1 },
  { id: 'charcoal', name: 'Charcoal', hex: 0x33363a, metal: 0, rough: 0.8, alpha: 1 },
  { id: 'sage', name: 'Sage fabric', hex: 0x8aa08a, metal: 0, rough: 1, alpha: 1 },
  { id: 'navy', name: 'Navy fabric', hex: 0x2f4468, metal: 0, rough: 1, alpha: 1 },
  { id: 'steel', name: 'Steel', hex: 0xaab2ba, metal: 0.85, rough: 0.35, alpha: 1 },
  { id: 'glass', name: 'Glass', hex: 0xbfdde8, metal: 0, rough: 0.05, alpha: 0.35 },
];
export const materialOf = (id: string): Material => MATERIALS.find((m) => m.id === id) ?? MATERIALS[2]!;

/** What a library card stands for: its words, its default size in cm and the material it starts in. */
export interface Product {
  kind: Kind;
  name: string;
  w: number;
  d: number;
  h: number;
  mat: string;
}

export const PRIMITIVES: Product[] = [
  { kind: 'box', name: 'Box', w: 60, d: 60, h: 60, mat: 'white' },
  { kind: 'cylinder', name: 'Cylinder', w: 50, d: 50, h: 80, mat: 'white' },
  { kind: 'sphere', name: 'Sphere', w: 50, d: 50, h: 50, mat: 'white' },
  { kind: 'plane', name: 'Plane', w: 200, d: 200, h: 1, mat: 'stone' },
];
const PART_MAT: Partial<Record<PartKind, string>> = { sofa: 'sage', bed: 'white', wardrobe: 'white', cabinet: 'white', chair: 'oak', stool: 'oak', bench: 'oak', shelf: 'oak', desk: 'oak', table: 'oak' };
export const PARAMETRIC: Product[] = PARTS.map((p) => ({ kind: p.kind, name: p.name, w: p.dims.w, d: p.dims.d, h: p.dims.h, mat: PART_MAT[p.kind] ?? 'oak' }));
/** The working engine (BRIEF-WORKING-ENGINE): the car's own engine model (car/engine.ts) as a thing of the tray: one stands on the ground, with its parts named, and goes out in the glTF file. */
export const WORKING: Product[] = [{ kind: 'engine', name: 'Engine', w: 120, d: 60, h: 70, mat: 'steel' }];
export const PRODUCTS: Product[] = [...PRIMITIVES, ...PARAMETRIC, ...WORKING];
export const productOf = (kind: string): Product | undefined => PRODUCTS.find((p) => p.kind === kind);

export interface ModelRef {
  /** The catalogue's id ('ov:…'). */
  id: string;
  title: string;
  credit: string;
  licence: string;
  /** What was fetched, in kB. */
  kb: number;
}

export interface Obj {
  id: string;
  kind: Kind;
  name: string;
  /** The centre of its footprint, cm from the ground's middle. */
  x: number;
  z: number;
  /** Its base above the ground, cm. */
  y: number;
  /** Degrees about the vertical, 0 to 360, clockwise seen from above. */
  rot: number;
  w: number;
  d: number;
  h: number;
  mat: string;
  model?: ModelRef;
}

export interface Scene {
  v: 1;
  name: string;
  ground: { w: number; d: number };
  objects: Obj[];
}

export const LIMITS = { min: 1, max: 2000, reach: 5000, objects: 300 };
const KINDS = new Set<string>([...PRODUCTS.map((p) => p.kind), 'model']);

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const r1 = (v: number) => Math.round(v * 10) / 10;
/** To the nearest step (cm, or degrees). */
export const snap = (v: number, step = 5) => Math.round(v / step) * step;
export const turnOf = (deg: number) => r1(((deg % 360) + 360) % 360);

export function newScene(w = 500, d = 400, name = 'Untitled scene'): Scene {
  return { v: 1, name, ground: { w: clamp(w, 100, LIMITS.max), d: clamp(d, 100, LIMITS.max) }, objects: [] };
}

export function nextId(s: Scene): string {
  let n = 0;
  for (const o of s.objects) n = Math.max(n, Number(/^o(\d+)$/.exec(o.id)?.[1] ?? 0));
  return `o${n + 1}`;
}

const sized = (v: unknown, fallback: number) => clamp(r1(Number.isFinite(Number(v)) ? Number(v) : fallback), LIMITS.min, LIMITS.max);
const placed = (v: unknown, fallback: number) => clamp(r1(Number.isFinite(Number(v)) ? Number(v) : fallback), -LIMITS.reach, LIMITS.reach);

/** An object with every number put in range. */
export function tidy(o: Obj): Obj {
  return { ...o, x: placed(o.x, 0), z: placed(o.z, 0), y: clamp(r1(Number.isFinite(o.y) ? o.y : 0), 0, 1000), rot: turnOf(Number.isFinite(o.rot) ? o.rot : 0), w: sized(o.w, 60), d: sized(o.d, 60), h: sized(o.h, 60), name: String(o.name || 'Thing').slice(0, 40), mat: MATERIALS.some((m) => m.id === o.mat) ? o.mat : 'white' };
}

/** Add a thing of `kind` with its middle at (x, z); the scene, and the id it got. */
export function addObject(s: Scene, kind: Kind, at: { x: number; z: number }, over: Partial<Obj> = {}): { scene: Scene; id: string } {
  const p = productOf(kind);
  const id = nextId(s);
  const same = s.objects.filter((o) => o.kind === kind).length;
  const base: Obj = { id, kind, name: `${over.name ?? p?.name ?? 'Model'}${over.name ? '' : same ? ` ${same + 1}` : ''}`, x: at.x, z: at.z, y: 0, rot: 0, w: p?.w ?? 60, d: p?.d ?? 60, h: p?.h ?? 60, mat: p?.mat ?? 'white' };
  const o = tidy({ ...base, ...over, id, kind });
  if (s.objects.length >= LIMITS.objects) return { scene: s, id: '' };
  return { scene: { ...s, objects: [...s.objects, o] }, id };
}

/** Change one thing; unknown ids change nothing. Every number is put in range. */
export function patch(s: Scene, id: string, p: Partial<Omit<Obj, 'id' | 'kind'>>): Scene {
  if (!s.objects.some((o) => o.id === id)) return s;
  return { ...s, objects: s.objects.map((o) => (o.id === id ? tidy({ ...o, ...p }) : o)) };
}

export function remove(s: Scene, id: string): Scene {
  return s.objects.some((o) => o.id === id) ? { ...s, objects: s.objects.filter((o) => o.id !== id) } : s;
}

/** A copy a hand's breadth along from the original. */
export function duplicate(s: Scene, id: string): { scene: Scene; id: string } {
  const o = s.objects.find((x) => x.id === id);
  if (!o) return { scene: s, id: '' };
  return addObject(s, o.kind, { x: o.x + 20, z: o.z + 20 }, { ...o, name: o.name.replace(/ copy$/, '') + ' copy' });
}

export const rename = (s: Scene, name: string): Scene => ({ ...s, name: String(name).trim().slice(0, 40) || 'Untitled scene' });

export function resizeGround(s: Scene, w: number, d: number): Scene {
  return { ...s, ground: { w: clamp(r1(w), 100, LIMITS.max), d: clamp(r1(d), 100, LIMITS.max) } };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A scene from storage or a file, or null: unknown kinds dropped, every number in range, at most 300 things. */
export function readScene(raw: unknown): Scene | null {
  let j: unknown = raw;
  if (typeof raw === 'string') {
    try {
      j = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const s = j as { v?: unknown; name?: unknown; ground?: { w?: unknown; d?: unknown }; objects?: unknown } | null;
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.objects)) return null;
  const gw = num(s.ground?.w);
  const gd = num(s.ground?.d);
  const out = newScene(gw ?? 500, gd ?? 400, String(s.name ?? 'Untitled scene').slice(0, 40) || 'Untitled scene');
  const seen = new Set<string>();
  for (const r of s.objects.slice(0, LIMITS.objects * 2)) {
    const o = r as Partial<Obj> | null;
    if (!o || typeof o !== 'object' || typeof o.kind !== 'string' || !KINDS.has(o.kind)) continue;
    let id = typeof o.id === 'string' && /^[\w-]{1,16}$/.test(o.id) ? o.id : '';
    if (!id || seen.has(id)) id = nextId({ ...out, objects: [...out.objects] });
    seen.add(id);
    const m = o.model as Partial<ModelRef> | undefined;
    const model = o.kind === 'model' && m && typeof m.id === 'string' ? { id: m.id.slice(0, 80), title: String(m.title ?? '').slice(0, 80), credit: String(m.credit ?? '').slice(0, 240), licence: String(m.licence ?? '').slice(0, 24), kb: Number(m.kb) || 0 } : undefined;
    if (o.kind === 'model' && !model) continue;
    out.objects.push(tidy({ id, kind: o.kind as Kind, name: String(o.name ?? ''), x: Number(o.x) || 0, z: Number(o.z) || 0, y: Number(o.y) || 0, rot: Number(o.rot) || 0, w: Number(o.w), d: Number(o.d), h: Number(o.h), mat: String(o.mat ?? 'white'), ...(model ? { model } : {}) }));
    if (out.objects.length >= LIMITS.objects) break;
  }
  return out;
}

export const sizeWords = (o: Pick<Obj, 'w' | 'd' | 'h'>) => `${r1(o.w)} × ${r1(o.d)} × ${r1(o.h)} cm`;

/** Size in words: kilobytes below a megabyte, megabytes above. */
export function bytesWords(kb: number): string {
  if (!kb) return 'size not stated';
  return kb < 1000 ? `${Math.round(kb)} kB` : `${(kb / 1000).toFixed(kb < 10_000 ? 1 : 0)} MB`;
}

/** Every credit in the scene, once each (a model's own line). */
export function creditsOf(s: Scene): string[] {
  return [...new Set(s.objects.flatMap((o) => (o.model?.credit ? [o.model.credit] : [])))];
}

export const ESTIMATE = 'Every size here is a first estimate, never certified.';

/** The working engine's credit line (it goes with its parts into the exported file): drawn here from simple shapes, typical, not anyone's exact engine. */
export const ENGINE_CREDIT = 'A typical engine drawn by Ghosty from simple shapes: a first estimate, not your exact engine';
