/**
 * HIS OWN PHOTOS ON HIS SITES (NEXT ROUND, sites.u12). He keeps up to 24 photos for his sites (Workshop → PHOTOS FOR YOUR SITES):
 * each is resized on his phone and drawn afresh as a JPEG there (which leaves its location and every other detail behind), and the
 * brain strips any detail block left in it once more before it is kept. A kept photo lives in the free picture store at /i/<id>,
 * public only once a page he approved uses it. "Build a website for my café with my photos" puts them on the site instead of free
 * stock pictures: the first is the main picture, the next two tell the story, the rest are the gallery. Nothing here publishes.
 *
 * Removing a photo takes it off his list; its bytes are deleted too unless a published page still shows it (then they stay, so that
 * page keeps its picture, and he is told which page).
 */
import type { Env } from './env';
import { imageKey, isImageId, LensError, storeImage } from './lens';
import { durableGet, durablePut } from './kv';
import { siteStore } from './tools/sites';
import type { ImageRef } from '../../../packages/shared/src/sitekit/types';
import type { StockSet } from '../../../packages/shared/src/sitekit/stock-data';

export const PHOTOS = 'sitephotos:list';
export const MAX_PHOTOS = 24;
export const PHOTOS_PER_DAY = 40;
const COUNTER = 'img:count:sitephoto:';
/** Kept as long as the pages that use them (ten years, like a picture made for a site). */
const TTL_S = 10 * 365 * 86_400;
const MAX_CAPTION = 120;

export interface SitePhoto {
  id: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  at: number;
}

interface Ctx {
  env: Env;
  storage?: DurableObjectStorage;
  origin?: string;
}

/**
 * A JPEG with every detail block taken out: APP1 to APP15 (where a camera writes the place, the time, the phone and a thumbnail)
 * and comments. The picture itself (and its JFIF header) is untouched. null when it is not a whole JPEG.
 */
export function stripJpeg(input: Uint8Array): Uint8Array | null {
  const b = input;
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // start of scan: the picture data follows to the end, untouched
    if (marker === 0xda) {
      out.push(b.subarray(i));
      break;
    }
    if (marker === 0xd9) {
      out.push(b.subarray(i, i + 2));
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2 || i + 2 + len > b.length) return null;
    const detail = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!detail) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (out.length < 2) return null;
  const total = out.reduce((n, p) => n + p.length, 0);
  const r = new Uint8Array(total);
  let o = 0;
  for (const p of out) {
    r.set(p, o);
    o += p.length;
  }
  return r;
}
/** Does a JPEG still carry a detail block (Exif, XMP, a comment)? */
export const hasDetails = (b: Uint8Array): boolean => {
  const s = stripJpeg(b);
  return !!s && s.length !== b.length;
};

export const listPhotos = async (c: Ctx): Promise<SitePhoto[]> => (await durableGet<SitePhoto[]>(c.env, c.storage, PHOTOS).catch(() => undefined)) ?? [];
const saveList = (c: Ctx, list: SitePhoto[]) => durablePut(c.env, c.storage, PHOTOS, list.slice(0, MAX_PHOTOS));
const cleanCaption = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION) : '');

/** Where a photo is seen: its address on his own server. */
export const photoSrc = (c: Pick<Ctx, 'env' | 'origin'>, id: string): string => `${c.origin || c.env.PUBLIC_ORIGIN || ''}/i/${id}`;

/** The published pages that show a photo, by title. */
export async function pagesUsing(c: Ctx, id: string): Promise<string[]> {
  const store = siteStore(c.env, c.storage);
  const used: string[] = [];
  for (const e of await store.list().catch(() => [])) {
    const s = await store.get(e.name).catch(() => undefined);
    if (s?.html.includes(`/i/${id}`)) used.push(s.title);
  }
  return used;
}

/** Keep one photo (a JPEG from his phone): stripped, checked, counted, kept, listed. */
export async function addPhoto(c: Ctx, data: Uint8Array, o: { caption?: unknown; width?: unknown; height?: unknown }): Promise<SitePhoto> {
  const kv = c.env.SITES;
  if (!kv) throw new LensError(503, 'Your sites have no picture store on this server, so I cannot keep photos for them.');
  const list = await listPhotos(c);
  if (list.length >= MAX_PHOTOS) throw new LensError(409, `You have ${MAX_PHOTOS} photos kept for your sites, the most I keep. Remove one first.`);
  const clean = stripJpeg(data);
  if (!clean) throw new LensError(415, 'That is not a photo I can use (send it from the Workshop, which makes a JPEG of it on your phone).');
  const kept = await storeImage(kv, clean.buffer.slice(clean.byteOffset, clean.byteOffset + clean.byteLength) as ArrayBuffer, 'image/jpeg', { ttl: TTL_S, counter: COUNTER, limit: PHOTOS_PER_DAY, noun: 'photo', verb: 'kept for your sites' });
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(8000, Math.round(v))) : 0);
  const photo: SitePhoto = { id: kept.id, caption: cleanCaption(o.caption), width: num(o.width), height: num(o.height), bytes: clean.length, at: Date.now() };
  await saveList(c, [...list, photo]);
  return photo;
}

/** Remove one from his list; its bytes too, unless a published page still shows it (then that page keeps its picture). */
export async function removePhoto(c: Ctx, id: string): Promise<{ removed: boolean; keptFor: string[] }> {
  const list = await listPhotos(c);
  if (!list.some((p) => p.id === id)) return { removed: false, keptFor: [] };
  await saveList(c, list.filter((p) => p.id !== id));
  const keptFor = await pagesUsing(c, id);
  if (!keptFor.length && c.env.SITES && isImageId(id)) await c.env.SITES.delete(imageKey(id)).catch(() => undefined);
  return { removed: true, keptFor };
}

/** A caption changed, or a photo made the main one (moved first). */
export async function changePhoto(c: Ctx, id: string, o: { caption?: unknown; main?: unknown }): Promise<SitePhoto[]> {
  const list = await listPhotos(c);
  const p = list.find((x) => x.id === id);
  if (!p) throw new LensError(404, 'That photo is not in your list any more.');
  if (o.caption !== undefined) p.caption = cleanCaption(o.caption);
  const next = o.main === true ? [p, ...list.filter((x) => x !== p)] : list;
  await saveList(c, next);
  return next;
}

/** His photos as the website builder's pictures: the first is the main one, the next two the story, the rest the gallery. */
export function photoSet(c: Pick<Ctx, 'env' | 'origin'>, list: SitePhoto[], business = ''): StockSet | null {
  if (!list.length) return null;
  const ref = (p: SitePhoto, n: number): ImageRef => ({
    src: photoSrc(c, p.id),
    ...(p.width ? { width: p.width } : {}),
    ...(p.height ? { height: p.height } : {}),
    alt: p.caption || (business ? `${business}, photo ${n}` : `Photo ${n}`),
  });
  const refs = list.map((p, i) => ref(p, i + 1));
  const [hero, ...rest] = refs;
  return { hero: hero!, story: rest.slice(0, 2), gallery: rest.length > 2 ? rest.slice(2) : rest };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const MAX_BODY = 2_200_000;

/**
 * /sites/photos in the brain (agent.ts, behind his sign-in): GET his list (with each photo's address), POST a photo
 * ({ data: base64 JPEG, caption, width, height }), PATCH { id, caption?, main? }, DELETE ?id=.
 */
export async function photosRoute(req: Request, c: Ctx): Promise<Response> {
  try {
    const shape = async (list: SitePhoto[]) => ({ photos: list.map((p) => ({ ...p, src: photoSrc(c, p.id) })), max: MAX_PHOTOS });
    if (req.method === 'GET') return json(await shape(await listPhotos(c)));
    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id') ?? '';
      const r = await removePhoto(c, id);
      return json({ ...r, ...(await shape(await listPhotos(c))) });
    }
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return json({ error: 'That photo is too big even after resizing. Try another.' }, 413);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: 'That photo is too big even after resizing. Try another.' }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return json({ error: 'I could not read that.' }, 400);
    }
    if (req.method === 'PATCH') return json(await shape(await changePhoto(c, String(body.id ?? ''), body)));
    if (req.method !== 'POST') return json({ error: 'not here' }, 405);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(String(body.data ?? '')), (ch) => ch.charCodeAt(0));
    } catch {
      return json({ error: 'That is not a photo I can use.' }, 415);
    }
    const photo = await addPhoto(c, bytes, body);
    return json({ photo: { ...photo, src: photoSrc(c, photo.id) }, ...(await shape(await listPhotos(c))) });
  } catch (e) {
    if (e instanceof LensError) return json({ error: e.message }, e.status);
    return json({ error: 'I could not keep that just now. Try again in a minute.' }, 503);
  }
}

/** His request asks for his own photos ("with my photos", "use our pictures"). */
export const ASKS_OWN = /\b(?:my|our|his) (?:own )?(?:photos?|pictures?|pics|images)\b/i;
