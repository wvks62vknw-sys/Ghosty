/**
 * The 3D STUDIO's catalogue, the brain's small part of it (the catalogue itself, its search and the
 * GLB packing live on the phone: packages/shared/src/models3d.ts). A Durable Object on the free
 * plan has about 10 ms of CPU a request, so the brain never reads the catalogue, never searches it
 * and never packs a model; it only passes bytes through:
 *  - Poly Haven's model list (CC0, a public API with no key), kept as text in KV `m3d:cat:ph:raw`
 *    and asked again once a week (the old copy while Poly Haven does not answer) — never parsed here;
 *  - a Poly Haven model's files (its file list, .gltf, .bin and 1k pictures), streamed through
 *    unread, each at most 10 MB, because the app's security policy lets the phone fetch only this
 *    site and Hugging Face; the phone packs them into one GLB;
 *  - thumbnails from Poly Haven's and Sketchfab's picture hosts (the app's img-src does not list them).
 * The Objaverse index is a static file the phone fetches (public/data/models3d.json), built once off
 * the brain by tools/build-models3d.py.
 */
import { Model3dError } from './gradio';

export * from '../../../packages/shared/src/models3d';

type Kv = { get(k: string, type: 'text'): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> };

export const PH_API = 'https://api.polyhaven.com';
/** Poly Haven asks API users to say who they are. */
const UA = { 'User-Agent': 'Ghosty/1 (a personal assistant: 3D studio catalogue)' };
export const CATALOG_KEY = 'm3d:cat:ph:raw';
const CATALOG_AT = 'm3d:cat:ph:at';
/** Asked again after a week; the copy is kept a month so an outage never empties the shelf. */
export const CATALOG_FRESH_MS = 7 * 86_400_000;
/** Poly Haven's whole list is about 0.6 MB; anything far bigger is not what was asked for. */
const MAX_LIST_BYTES = 3_000_000;
/** One Poly Haven file passed through to the phone at most (its 1k pictures are well under 1 MB). */
export const MAX_PH_FILE_BYTES = 10_000_000;

/** Poly Haven's list as Poly Haven sent it (text, unread), from KV while fresh. */
export async function polyHavenList(kv: Kv | undefined, f: typeof fetch, now = Date.now()): Promise<{ text: string; at: number; stale?: boolean }> {
  const [text, at] = kv ? await Promise.all([kv.get(CATALOG_KEY, 'text').catch(() => null), kv.get(CATALOG_AT, 'text').catch(() => null)]) : [null, null];
  const kept = typeof text === 'string' && text.startsWith('{') ? { text, at: Number(at) || 0 } : null;
  if (kept && now - kept.at < CATALOG_FRESH_MS) return kept;
  try {
    const r = await f(`${PH_API}/assets?t=models`, { headers: UA });
    if (!r.ok) throw new Error(`Poly Haven answered ${r.status}`);
    if (Number(r.headers.get('content-length')) > MAX_LIST_BYTES) throw new Error('the list is far bigger than it should be');
    const fresh = await r.text();
    if (!fresh.startsWith('{') || fresh.length > MAX_LIST_BYTES) throw new Error('Poly Haven sent something that is not its list');
    if (kv) {
      await kv.put(CATALOG_KEY, fresh, { expirationTtl: 30 * 86_400 }).catch(() => undefined);
      await kv.put(CATALOG_AT, String(now), { expirationTtl: 30 * 86_400 }).catch(() => undefined);
    }
    return { text: fresh, at: now };
  } catch (e) {
    if (kept) return { ...kept, stale: true };
    throw new Model3dError(502, `Poly Haven's model list could not be read (${String((e as Error)?.message ?? e).slice(0, 100)}) — the other catalogue still works`);
  }
}

/** The only Poly Haven addresses passed through: a model's file list and its glTF files. */
export const PH_FILE_PREFIXES = [`${PH_API}/files/`, 'https://dl.polyhaven.org/file/ph-assets/Models/'];

/** A body passed through unread, cut off (an error) past `max` bytes. */
function capped(body: ReadableStream<Uint8Array>, max: number): ReadableStream<Uint8Array> {
  let n = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, c) {
        n += chunk.byteLength;
        if (n > max) c.error(new Error('too big for a phone'));
        else c.enqueue(chunk);
      },
    }),
  );
}

/** One Poly Haven file for the phone, streamed through unread (≤ 10 MB). */
export async function polyHavenFile(u: string, f: typeof fetch): Promise<Response> {
  const none = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return none(400, 'not an address');
  }
  if (!PH_FILE_PREFIXES.some((p) => url.href.startsWith(p)) || url.username || url.password || url.port || /\.\.|%2e%2e/i.test(url.pathname)) return none(403, 'only Poly Haven model files are passed through');
  const r = await f(url.href, { headers: UA }).catch(() => null);
  if (!r || !r.ok || !r.body) return none(r?.status === 404 ? 404 : 502, `Poly Haven did not send the file (${r?.status ?? 'no answer'}) — try again in a minute`);
  if (Number(r.headers.get('content-length')) > MAX_PH_FILE_BYTES) return none(413, 'that file is too big for a phone');
  const type = (r.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!.trim();
  return new Response(capped(r.body, MAX_PH_FILE_BYTES), { headers: { 'content-type': /^(?:application\/json|model\/gltf\+json|application\/octet-stream|image\/(?:jpeg|png|webp))$/.test(type) ? type : 'application/octet-stream', 'cache-control': 'private, max-age=604800', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
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
  if (!r || !r.ok || !r.body || !/^image\/(?:png|jpeg|webp)$/.test(type)) return none(r && r.status === 404 ? 404 : 502);
  if (Number(r.headers.get('content-length')) > 400_000) return none(413);
  return new Response(capped(r.body, 400_000), { headers: { 'content-type': type, 'cache-control': 'private, max-age=604800', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
}
