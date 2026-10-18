/**
 * The 3D STUDIO's catalogue on the brain (the shared search and both sources are in
 * packages/shared/src/models3d.ts):
 *  - Poly Haven's model list (CC0, a public API with no key) kept in KV `m3d:cat:ph` and asked
 *    again once a week (an old copy is used while Poly Haven does not answer);
 *  - a Poly Haven model packed into one GLB at 1k textures (`packGlb`: its .gltf, .bin and
 *    pictures as one file, because the studio reads one file and the security policy lets the
 *    phone fetch only this site and Hugging Face); kept in the Worker's cache for a month;
 *  - thumbnails from Poly Haven's and Sketchfab's picture hosts, passed through (the app's
 *    img-src does not list them), cached a week;
 *  - the static Objaverse index (public/data/models3d.json), read by make_3d through the Worker's
 *    own assets, so a described object is looked for before anything is generated.
 * Building the Objaverse index itself is done once, off the brain (tools/build-models3d.py): its
 * metadata is 160 files of 3–30 MB, far beyond a free Worker's 10 ms of CPU a request.
 */
import { goodMatch, objaverseItems, polyHavenItems, searchCatalog, type CatalogItem, type SearchHit } from '../../../packages/shared/src/models3d';
import { Model3dError } from './gradio';

export * from '../../../packages/shared/src/models3d';

type Kv = { get(k: string, type: 'json'): Promise<unknown>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> };

export const PH_API = 'https://api.polyhaven.com';
const PH_FILES = 'https://dl.polyhaven.org/';
/** Poly Haven asks API users to say who they are. */
const UA = { 'User-Agent': 'Ghosty/1 (a personal assistant: 3D studio catalogue)' };
export const CATALOG_KEY = 'm3d:cat:ph';
/** Asked again after a week; the copy is kept a month so an outage never empties the shelf. */
export const CATALOG_FRESH_MS = 7 * 86_400_000;
/** A packed Poly Haven model larger than this is not sent to a phone. */
export const MAX_PACK_BYTES = 25_000_000;

export interface PolyHavenCatalog {
  at: number;
  items: CatalogItem[];
  /** True when Poly Haven did not answer and the last copy is shown. */
  stale?: boolean;
}

/** Poly Haven's models, from KV while fresh, else asked again (the old copy when it does not answer). */
export async function polyHavenCatalog(kv: Kv | undefined, f: typeof fetch, now = Date.now()): Promise<PolyHavenCatalog> {
  const kept = kv ? ((await kv.get(CATALOG_KEY, 'json').catch(() => null)) as PolyHavenCatalog | null) : null;
  const valid = kept && Array.isArray(kept.items) && typeof kept.at === 'number' ? kept : null;
  if (valid && now - valid.at < CATALOG_FRESH_MS) return valid;
  try {
    const r = await f(`${PH_API}/assets?t=models`, { headers: UA });
    if (!r.ok) throw new Error(`Poly Haven answered ${r.status}`);
    const items = polyHavenItems(await r.json());
    if (!items.length) throw new Error('Poly Haven listed no models');
    const cat: PolyHavenCatalog = { at: now, items };
    await kv?.put(CATALOG_KEY, JSON.stringify(cat), { expirationTtl: 30 * 86_400 }).catch(() => undefined);
    return cat;
  } catch (e) {
    if (valid) return { ...valid, stale: true };
    throw new Model3dError(502, `Poly Haven's model list could not be read (${String((e as Error)?.message ?? e).slice(0, 100)}) — the other catalogue still works`);
  }
}

// ---------------------------------------------------------------- .gltf + files → one .glb

interface Gltf {
  buffers?: { uri?: string; byteLength: number }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string }[];
  [k: string]: unknown;
}

const pad4 = (n: number) => (4 - (n % 4)) % 4;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', ktx2: 'image/ktx2' };

/**
 * A glTF and the files it names → one binary glTF: every buffer and picture becomes part of the
 * one binary chunk, each picture a buffer view with its type. Throws when a named file is missing.
 */
export function packGlb(gltf: Gltf, files: Map<string, ArrayBuffer>): ArrayBuffer {
  const json = structuredClone(gltf) as Gltf;
  const get = (uri: string): Uint8Array => {
    const key = [uri, decodeURIComponent(uri)].find((k) => files.has(k));
    if (!key) throw new Model3dError(502, `the model names a file it did not come with (${uri.slice(0, 60)})`);
    return new Uint8Array(files.get(key)!);
  };
  const parts: Uint8Array[] = [];
  let size = 0;
  const add = (b: Uint8Array): number => {
    const at = size;
    parts.push(b);
    size += b.byteLength;
    const p = pad4(size);
    if (p) {
      parts.push(new Uint8Array(p));
      size += p;
    }
    return at;
  };
  const base: number[] = [];
  for (const b of json.buffers ?? []) {
    if (!b.uri) throw new Model3dError(502, 'the model has a buffer with no file');
    base.push(add(get(b.uri)));
  }
  for (const v of json.bufferViews ?? []) {
    v.byteOffset = (v.byteOffset ?? 0) + (base[v.buffer] ?? 0);
    v.buffer = 0;
  }
  json.bufferViews ??= [];
  for (const img of json.images ?? []) {
    if (!img.uri) continue;
    const bytes = get(img.uri);
    const ext = img.uri.split('?')[0]!.split('.').pop()!.toLowerCase();
    json.bufferViews.push({ buffer: 0, byteOffset: add(bytes), byteLength: bytes.byteLength });
    img.bufferView = json.bufferViews.length - 1;
    img.mimeType = img.mimeType ?? MIME[ext] ?? 'image/png';
    delete img.uri;
  }
  json.buffers = [{ byteLength: size }];
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jl = text.byteLength + pad4(text.byteLength);
  const total = 12 + 8 + jl + 8 + size;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, jl, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.byteLength, 20 + jl);
  let o = 20 + jl;
  v.setUint32(o, size, true);
  v.setUint32(o + 4, 0x004e4942, true);
  o += 8;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out.buffer;
}

const fromPh = (u: unknown): u is string => typeof u === 'string' && u.startsWith(PH_FILES);

/** One Poly Haven model as a GLB with 1k textures (2k when it has no 1k copy). */
export async function polyHavenGlb(id: string, f: typeof fetch): Promise<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Model3dError(404, 'no such Poly Haven model');
  const r = await f(`${PH_API}/files/${encodeURIComponent(id)}`, { headers: UA });
  if (r.status === 404) throw new Model3dError(404, 'Poly Haven has no model by that name any more');
  if (!r.ok) throw new Model3dError(502, `Poly Haven did not answer (${r.status}) — try again in a minute`, 'busy');
  const files = (await r.json()) as { gltf?: Record<string, { gltf?: { url?: unknown; size?: unknown; include?: Record<string, { url?: unknown; size?: unknown }> } }> };
  const g = files.gltf?.['1k']?.gltf ?? files.gltf?.['2k']?.gltf;
  if (!g || !fromPh(g.url)) throw new Model3dError(404, 'Poly Haven has no glTF copy of that model');
  const include = Object.entries(g.include ?? {}).filter(([, v]) => fromPh(v.url));
  const bytes = include.reduce((n, [, v]) => n + (typeof v.size === 'number' ? v.size : 0), 0);
  if (bytes > MAX_PACK_BYTES) throw new Model3dError(413, `that model is too heavy for a phone (${(bytes / 1e6).toFixed(0)} MB)`);
  const gr = await f(g.url, { headers: UA });
  if (!gr.ok) throw new Model3dError(502, `Poly Haven's file did not come (${gr.status})`, 'busy');
  const gltf = (await gr.json()) as Gltf;
  const got = await Promise.all(
    include.map(async ([name, v]) => {
      const x = await f(v.url as string, { headers: UA });
      if (!x.ok) throw new Model3dError(502, `Poly Haven's file did not come (${x.status})`, 'busy');
      return [name, await x.arrayBuffer()] as const;
    }),
  );
  return packGlb(gltf, new Map(got));
}

// ---------------------------------------------------------------- thumbnails

/** The only picture addresses passed through. */
export const THUMB_PREFIXES = ['https://cdn.polyhaven.com/asset_img/', 'https://media.sketchfab.com/models/'];

/** A thumbnail from an allowed host, as a picture response (never anything else). */
export async function thumbResponse(u: string, f: typeof fetch): Promise<Response> {
  const none = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return none(400);
  }
  if (!THUMB_PREFIXES.some((p) => url.href.startsWith(p)) || url.username || url.password || url.port) return none(403);
  const r = await f(url.href, { headers: { ...UA, Accept: 'image/webp,image/png,image/jpeg' } }).catch(() => null);
  const type = (r?.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!r || !r.ok || !/^image\/(?:png|jpeg|webp)$/.test(type)) return none(r && r.status === 404 ? 404 : 502);
  const b = await r.arrayBuffer();
  if (b.byteLength > 400_000) return none(413);
  return new Response(b, { headers: { 'content-type': type, 'cache-control': 'private, max-age=604800', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
}

// ---------------------------------------------------------------- make_3d's look-up

let ovMemo: { at: number; items: CatalogItem[] } | null = null;

/** The Objaverse index through the Worker's own static files (kept for the life of this isolate). */
export async function objaverseCatalog(assets: { fetch(req: Request): Promise<Response> } | undefined, origin: string, now = Date.now()): Promise<CatalogItem[]> {
  if (ovMemo && now - ovMemo.at < 86_400_000) return ovMemo.items;
  if (!assets) return [];
  try {
    const r = await assets.fetch(new Request(`${origin || 'https://ghosty.invalid'}/data/models3d.json`));
    if (!r.ok) return [];
    ovMemo = { at: now, items: objaverseItems(await r.json()) };
    return ovMemo.items;
  } catch {
    return [];
  }
}

/** The best catalogue model for a description, when it is good enough to open instead of generating one. */
export function bestMatch(items: CatalogItem[], what: string): SearchHit | null {
  const hit = searchCatalog(items, what, { limit: 1 })[0];
  return goodMatch(hit) ? hit! : null;
}
