/**
 * LENS pictures shared by link, for reverse image search. An engine (Google Lens, Bing Visual
 * Search, Yandex Images, TinEye) can only look at a picture it can fetch, so the Lens posts
 * the crop to the brain and gets a public address back: https://<ghosty>/i/<id>. The bytes
 * live in the SITES KV namespace only — never in the brain's database — for 24 hours or until
 * the owner presses FORGET NOW; at most 30 shares a day; and nothing but the bytes of a JPEG,
 * PNG or WebP is ever served (the type comes from the bytes themselves, not from the upload).
 */
import type { Env } from './env';

/** How long a shared picture stays reachable (seconds). */
export const IMAGE_TTL_S = 86_400;
/** The largest picture accepted (the Lens sends a downscaled JPEG well under this). */
export const MAX_IMAGE_BYTES = 1_500_000;
/** Shares allowed per day (the counter lives in KV too). */
export const SHARES_PER_DAY = 30;
/** How long a picture Ghosty made (tools/pictures.ts) stays reachable (seconds): a week. */
export const PICTURE_TTL_S = 7 * 86_400;
/** Pictures Ghosty makes per day (its own counter, next to the shares'). */
export const PICTURES_PER_DAY = 40;

const PREFIX = 'img:';
const COUNT = 'img:count:';
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** The KV namespace a picture lives in (the SITES binding). */
export type ImageKv = NonNullable<Env['SITES']>;
export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** A refusal with the HTTP status the route should answer with. */
export class LensError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The picture's own type from its first bytes (JPEG, PNG or WebP), or null for anything else. */
export function sniffImage(bytes: ArrayBuffer | Uint8Array): ImageType | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** 16 random url-safe characters (96 bits): not guessable, fine in a link. */
export function imageId(): string {
  let s = '';
  for (const x of crypto.getRandomValues(new Uint8Array(16))) s += ID_CHARS[x & 63];
  return s;
}
export const isImageId = (s: string): boolean => /^[A-Za-z0-9_-]{16}$/.test(s);

const dayKey = (counter: string, now: number) => `${counter}${new Date(now).toISOString().slice(0, 10)}`;

/**
 * How many pictures a counter has seen today (UTC). A count that cannot be read (KV's own daily
 * allowance used up, a blip) is refused rather than taken as zero: otherwise the day's limit
 * would stop applying exactly when KV is under strain.
 */
export async function countToday(kv: ImageKv, counter: string, noun: string, now = Date.now()): Promise<number> {
  let v: unknown;
  try {
    v = await kv.get(dayKey(counter, now), 'json');
  } catch {
    throw new LensError(503, `could not read today's ${noun} count (the picture store did not answer, or its own daily allowance is used up), so no picture is ${noun === 'share' ? 'shared' : 'kept'} until it can be read — try again later, or tomorrow`);
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** How many pictures were shared today (UTC). */
export const sharesToday = (kv: ImageKv, now = Date.now()): Promise<number> => countToday(kv, COUNT, 'share', now);

/** Where a kind of picture is counted and for how long it is kept. */
export interface StoreOptions {
  /** Seconds the picture stays reachable. */
  ttl: number;
  /** The day counter's key prefix (a day's count lives under `<counter><YYYY-MM-DD>`). */
  counter: string;
  /** Pictures a day under that counter. */
  limit: number;
  /** For the owner: "share" / "picture", and what happened to them: "shared" / "made". */
  noun: string;
  verb: string;
}

/**
 * Keep a picture under /i/<id>. The bytes must be a JPEG, PNG or WebP whatever the caller
 * claimed, at most 1.5 MB, and within the day's allowance for this kind of picture. Returns
 * the id, the type the bytes really are, and when the link stops working.
 */
export async function storeImage(kv: ImageKv, bytes: ArrayBuffer, claimedType: string, o: StoreOptions, now = Date.now()): Promise<{ id: string; type: ImageType; expires: number }> {
  if (!/^image\/(jpeg|png|webp)$/i.test(claimedType.split(';')[0]!.trim())) throw new LensError(415, 'send the picture itself as image/jpeg, image/png or image/webp');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new LensError(413, `the picture is too big (${(bytes.byteLength / 1e6).toFixed(1)} MB; 1.5 MB at most) — the Lens sends a smaller JPEG`);
  const type = sniffImage(bytes);
  if (!type) throw new LensError(415, 'that is not a JPEG, PNG or WebP picture');
  const n = await countToday(kv, o.counter, o.noun, now);
  if (n >= o.limit) throw new LensError(429, `${o.limit} pictures have been ${o.verb} today, which is the daily limit; more tomorrow`);
  const id = imageId();
  await kv.put(PREFIX + id, bytes, { expirationTtl: o.ttl });
  // The count outlives the day by one, so a late write never starts a fresh count.
  await kv.put(dayKey(o.counter, now), String(n + 1), { expirationTtl: 2 * 86_400 });
  return { id, type, expires: now + o.ttl * 1000 };
}

/** Share a picture from the Lens for 24 hours (30 a day). */
export const shareImage = (kv: ImageKv, bytes: ArrayBuffer, claimedType: string, now = Date.now()): Promise<{ id: string; type: ImageType; expires: number }> =>
  storeImage(kv, bytes, claimedType, { ttl: IMAGE_TTL_S, counter: COUNT, limit: SHARES_PER_DAY, noun: 'share', verb: 'shared' }, now);

const gone = () =>
  new Response('That picture is no longer shared.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });

/**
 * Serve a shared picture to anyone (GET /i/<id>): the bytes with the type they really are,
 * not indexed, cached briefly by the viewer only; 404 once it is gone or was never there.
 * Never anything but image bytes: a record that is not a picture is treated as gone.
 */
export async function imageResponse(kv: ImageKv, id: string, head = false): Promise<Response> {
  if (!isImageId(id)) return gone();
  const bytes = await kv.get(PREFIX + id, 'arrayBuffer').catch(() => null);
  const type = bytes ? sniffImage(bytes) : null;
  if (!bytes || !type) return gone();
  return new Response(head ? null : bytes, {
    headers: {
      'content-type': type,
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, max-age=600',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': `inline; filename="ghosty-lens.${type.slice(6)}"`,
    },
  });
}

/** FORGET NOW: remove a shared picture before its day is up. True if there was one. */
export async function forgetImage(kv: ImageKv, id: string): Promise<boolean> {
  if (!isImageId(id)) return false;
  const had = !!(await kv.get(PREFIX + id, 'arrayBuffer').catch(() => null));
  await kv.delete(PREFIX + id);
  return had;
}

/** The reverse-image engines, each named plainly, for a picture at a public address. */
export function engineLinks(publicUrl: string): { name: string; url: string; note: string }[] {
  const u = encodeURIComponent(publicUrl);
  return [
    { name: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${u}`, note: 'Opens Google Lens (Google) in a new tab' },
    { name: 'Bing Visual Search', url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${u}`, note: 'Opens Bing Visual Search (Microsoft) in a new tab' },
    { name: 'Yandex Images', url: `https://yandex.com/images/search?rpt=imageview&url=${u}`, note: 'Opens Yandex Images (Yandex) in a new tab' },
    { name: 'TinEye', url: `https://tineye.com/search?url=${u}`, note: 'Opens TinEye (TinEye) in a new tab' },
  ];
}
