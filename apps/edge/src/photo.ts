/**
 * PHOTO TOOLS on the brain: remove the background, make a photo sharper (twice the size), erase a
 * thing under a mask the owner drew with a finger. Every job is a free public Space on Hugging Face,
 * asked the way its own page asks it (gradio.ts, the 3D studio's client; the eraser's app has a
 * plain HTTP API instead) — never a paid service and never a paid fallback. A Space that is asleep,
 * busy or over its free limit is said so in plain words, with "try again in a minute".
 *
 * NEVER BILLED: the owner's Hugging Face token goes only to the ZeroGPU Spaces, and only after
 * `spaceToken` (gradio.ts, checked in `GradioApp.open`) has asked Hugging Face that it belongs to a
 * free account that cannot pay. The CPU Spaces are asked without it: they have no allowance to spend.
 *
 * The Spaces, pinned by name, and their licences (checked October 2026; none leaves out the UK):
 *  - background: BiRefNet (ZhengPeng7/BiRefNet_demo, the authors' own demo; code and weights MIT) on
 *    ZeroGPU — a few runs a day without a token (tried for real: the shared address was over its
 *    limit), more with a free one. When it is asleep, busy or over its limit: BRIA RMBG-1.4
 *    (briaai/BRIA-RMBG-1.4, BRIA's own demo on a free CPU: no daily limit, a few seconds; weights
 *    under the bria-rmbg-1.4 licence, Creative Commons non-commercial — a personal assistant is
 *    non-commercial use). It hands back a PNG with the background transparent.
 *  - sharper: Real-ESRGAN ×2 (Nick088/Real-ESRGAN_Pytorch, Apache 2.0, with ai-forever's Real-ESRGAN
 *    weights, BSD 3-Clause) on ZeroGPU; ~2 s of GPU a photo. A general upscaler: no face-restoration
 *    model (GFPGAN, CodeFormer and the like are never used).
 *  - erase: LaMa inpainting (Sanster/iopaint-lama: IOPaint by its own author, Apache 2.0; LaMa
 *    weights Apache 2.0) on a free CPU: no daily limit; POST /api/v1/inpaint {image, mask} as data:
 *    addresses → the picture as PNG. The mask is a PNG of the photo's own size: white = erase.
 * No face recognition and no face editing of any kind: nothing here looks for, changes or swaps a face.
 *
 * Results are kept like the pictures Ghosty makes for websites: in the SITES KV namespace at
 * /i/<id> for 10 years (a link the owner can keep), PHOTOS_PER_DAY a day.
 */
import { fileData, fileFrom, GradioApp, Model3dError, type GradioDeps } from './gradio';
import { LensError, MAX_IMAGE_BYTES, sniffImage, storeImage, type ImageKv, type ImageType } from './lens';
import { PHOTO_JOB_WORDS, photoJobFor, photoJobOf, type PhotoJob } from '../../../packages/shared/src/photo';

export { photoJobFor, photoJobOf, type PhotoJob };

export const BIREFNET = 'https://zhengpeng7-birefnet-demo.hf.space';
export const RMBG = 'https://briaai-bria-rmbg-1-4.hf.space';
export const ESRGAN = 'https://nick088-real-esrgan-pytorch.hf.space';
export const LAMA = 'https://sanster-iopaint-lama.hf.space';

/** Each Space as the owner hears of it: its name, where it lives, its licence and its free limit. */
export const PHOTO_SPACES = {
  birefnet: { name: 'BiRefNet', space: 'ZhengPeng7/BiRefNet_demo', licence: 'MIT', limit: "Hugging Face's free GPU: a few a day, more with a free Hugging Face token" },
  rmbg: { name: 'BRIA RMBG-1.4', space: 'briaai/BRIA-RMBG-1.4', licence: 'BRIA RMBG-1.4 licence, non-commercial', limit: 'a free computer: no daily limit, slower' },
  esrgan: { name: 'Real-ESRGAN', space: 'Nick088/Real-ESRGAN_Pytorch', licence: 'Apache 2.0; weights BSD 3-Clause', limit: "Hugging Face's free GPU: a few a day, more with a free Hugging Face token" },
  lama: { name: 'LaMa (IOPaint)', space: 'Sanster/iopaint-lama', licence: 'Apache 2.0', limit: 'a free computer: no daily limit' },
} as const;
type SpaceKey = keyof typeof PHOTO_SPACES;

/** Results stay at their link for 10 years, like the pictures made for websites. */
export const PHOTO_TTL_S = 10 * 365 * 86_400;
/** Photos kept a day (their own counter, next to the Lens's shares and the pictures Ghosty makes). */
export const PHOTOS_PER_DAY = 30;
export const PHOTO_COUNT = 'photo:count:';
/** The plain words every "not now" ends with. */
export const AGAIN = 'try again in a minute';

/** A refusal or failure, in words for the owner, with the status the route answers with. */
export class PhotoError extends Error {
  constructor(
    public status: number,
    message: string,
    /** asleep / busy / limit: the Space, not the photo — try again in a minute. */
    public code: 'asleep' | 'busy' | 'limit' | 'failed' | 'too_big' | 'bad_input' = 'failed',
  ) {
    super(message);
  }
}

/** A finished job: the new picture, who made it and the credit shown under it. */
export interface Done {
  bytes: ArrayBuffer;
  type: ImageType;
  by: string;
  credit: string;
}

export interface PhotoDeps {
  fetch: typeof fetch;
  /** The owner's Hugging Face token (optional): sent to a ZeroGPU Space only when `spaceToken` says it cannot be charged. */
  token?: string | null;
  progress?: (step: string) => void;
}

const credit = (k: SpaceKey) => `${PHOTO_SPACES[k].name} (${PHOTO_SPACES[k].space} on Hugging Face, ${PHOTO_SPACES[k].licence}), free`;
const mb = (n: number) => (n / 1e6).toFixed(1);

const asleep = (label: string) => new PhotoError(503, `${label} is asleep (free Spaces sleep when nobody uses them) and is waking up — ${AGAIN}`, 'asleep');

/** Any failure as the owner hears it: asleep, busy, over its free limit, or what went wrong. */
export function photoWords(e: unknown, label: string): PhotoError {
  if (e instanceof PhotoError) return e;
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return new PhotoError(504, `${label} took too long (its queue may be long) — ${AGAIN}`, 'busy');
  if (e instanceof Model3dError) {
    if (e.code === 'quota') return new PhotoError(429, `${label} is over its free limit for now (Hugging Face's free GPU time) — ${AGAIN}; if it still says so, later today. Nothing paid is ever used`, 'limit');
    if (/not running right now/.test(e.message)) return asleep(label);
    if (e.code === 'busy') return new PhotoError(503, `${label} is busy with other people's pictures — ${AGAIN}`, 'busy');
    return new PhotoError(502, e.message.replace(/ — try a clear photo of one object[^]*$/, ''), 'failed');
  }
  return new PhotoError(502, `${label} could not be reached (${String((e as Error)?.message ?? e).slice(0, 100)}) — ${AGAIN}`, 'busy');
}

/** A picture's size from its header (PNG, JPEG, WebP), or null when it cannot tell. */
export function imageSize(bytes: ArrayBuffer | Uint8Array): { w: number; h: number } | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const type = sniffImage(b);
  const be16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const le16 = (i: number) => b[i]! | (b[i + 1]! << 8);
  if (type === 'image/png' && b.length >= 24) return { w: ((b[16]! << 24) | (b[17]! << 16) | (b[18]! << 8) | b[19]!) >>> 0, h: ((b[20]! << 24) | (b[21]! << 16) | (b[22]! << 8) | b[23]!) >>> 0 };
  if (type === 'image/jpeg') {
    // Walk the segments to the frame header (SOF0–SOF15, not DHT/JPG/DAC): height then width.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1]!;
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: be16(i + 7), h: be16(i + 5) };
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) i += 2;
      else i += 2 + be16(i + 2);
    }
    return null;
  }
  if (type === 'image/webp' && b.length >= 30) {
    const kind = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (kind === 'VP8 ') return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    if (kind === 'VP8L') {
      const v = (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
      return { w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') return { w: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), h: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  }
  return null;
}

/** The eraser's mask: a PNG of the photo's own size (white = erase). Throws in words otherwise. */
export function checkMask(picture: ArrayBuffer, mask: ArrayBuffer): void {
  if (sniffImage(mask) !== 'image/png') throw new PhotoError(400, 'the eraser needs the mask as a PNG (white where to erase, black elsewhere)', 'bad_input');
  if (mask.byteLength > MAX_IMAGE_BYTES) throw new PhotoError(413, 'the mask is too big (1.5 MB at most)', 'too_big');
  const a = imageSize(picture);
  const m = imageSize(mask);
  if (a && m && (a.w !== m.w || a.h !== m.h)) throw new PhotoError(400, `the mask (${m.w} × ${m.h}) is not the size of the photo (${a.w} × ${a.h})`, 'bad_input');
}

/** Bytes as base64, in pieces (a large spread would overflow the call stack). */
function b64(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** What IOPaint's /api/v1/inpaint takes: the photo and the mask as data: addresses (its other settings keep their defaults). */
export function inpaintBody(picture: ArrayBuffer, type: string, mask: ArrayBuffer): string {
  return JSON.stringify({ image: `data:${type};base64,${b64(picture)}`, mask: `data:image/png;base64,${b64(mask)}` });
}

/** A picture a Space sent back, checked: a real JPEG/PNG/WebP that the picture store can keep. */
function checked(bytes: ArrayBuffer, label: string): { bytes: ArrayBuffer; type: ImageType } {
  const type = sniffImage(bytes);
  if (!type) throw new PhotoError(502, `${label} sent back something that is not a picture — ${AGAIN}`, 'failed');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new PhotoError(413, `the result is too big to keep (${mb(bytes.byteLength)} MB; 1.5 MB at most) — try a smaller photo`, 'too_big');
  return { bytes, type };
}

async function fetchResult(app: GradioApp, url: string | null, progress: (l: string) => void): Promise<{ bytes: ArrayBuffer; type: ImageType }> {
  if (!url) throw new PhotoError(502, `${app.label} finished but sent no picture back — ${AGAIN}`, 'failed');
  progress('fetching the result…');
  const r = await app.get(url);
  if (!r.ok) throw new PhotoError(502, `${app.label}'s picture could not be fetched (${r.status}) — ${AGAIN}`, 'busy');
  return checked(await r.arrayBuffer(), app.label);
}

/** The "after" half of an image slider's answer ([before, after], or an update wrapping it), as an address on the Space. */
export function sliderAfter(data: unknown[], app: { base: string; root: string }): string | null {
  const v = data[0];
  const pair = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { value?: unknown }).value) ? ((v as { value: unknown[] }).value as unknown[]) : null;
  if (!pair || pair.length < 2) return null;
  return fileFrom([pair[1]], app.base) ?? fileFrom([pair[1]], app.root);
}

const typeName = (type: string) => `photo.${type.slice(6) || 'jpg'}`;

/** BiRefNet (ZeroGPU): the authors' demo, at its suggested 1024 × 1024 with the General weights. */
export async function birefnet(d: GradioDeps, picture: ArrayBuffer, type: string): Promise<Done> {
  const progress = d.progress ?? (() => undefined);
  const app = new GradioApp(BIREFNET, d, 'BiRefNet');
  progress('reaching BiRefNet…');
  await app.open(['image']);
  progress('sending the photo…');
  const path = await app.upload(picture, type, typeName(type));
  const out = await app.call('image', [fileData(path), '1024x1024', 'General'], PHOTO_JOB_WORDS.background.doing);
  return { ...(await fetchResult(app, sliderAfter(out, app), progress)), by: 'BiRefNet', credit: credit('birefnet') };
}

/** BRIA RMBG-1.4 (a free CPU): its second answer is the PNG with the background transparent. */
export async function rmbg(d: GradioDeps, picture: ArrayBuffer, type: string): Promise<Done> {
  const progress = d.progress ?? (() => undefined);
  const app = new GradioApp(RMBG, d, 'BRIA RMBG-1.4');
  progress('reaching BRIA RMBG-1.4 on a free computer…');
  await app.open(['run']);
  progress('sending the photo…');
  const path = await app.upload(picture, type, typeName(type));
  const out = await app.call('run', [fileData(path)], PHOTO_JOB_WORDS.background.doing);
  return { ...(await fetchResult(app, app.fileUrl(out, '.png'), progress)), by: 'BRIA RMBG-1.4', credit: credit('rmbg') };
}

/** Real-ESRGAN ×2 (ZeroGPU). */
export async function esrgan(d: GradioDeps, picture: ArrayBuffer, type: string): Promise<Done> {
  const progress = d.progress ?? (() => undefined);
  const app = new GradioApp(ESRGAN, d, 'Real-ESRGAN');
  progress('reaching Real-ESRGAN…');
  await app.open(['predict']);
  progress('sending the photo…');
  const path = await app.upload(picture, type, typeName(type));
  const out = await app.call('predict', [fileData(path), 2], PHOTO_JOB_WORDS.sharper.doing);
  return { ...(await fetchResult(app, app.fileUrl(out), progress)), by: 'Real-ESRGAN', credit: credit('esrgan') };
}

/** LaMa through IOPaint's own API (a free CPU, no queue): the photo and the mask in, the picture out. */
export async function lama(d: GradioDeps, picture: ArrayBuffer, type: string, mask: ArrayBuffer): Promise<Done> {
  const progress = d.progress ?? (() => undefined);
  const label = PHOTO_SPACES.lama.name;
  progress('erasing it on a free computer (LaMa)… usually 10–40 seconds');
  // Called bare, never as d.fetch(…): the Workers runtime refuses a fetch bound to another object.
  const f = d.fetch;
  const r = await f(`${LAMA}/api/v1/inpaint`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'image/*' }, body: inpaintBody(picture, type, mask), signal: d.signal });
  const ct = (r.headers.get('content-type') ?? '').toLowerCase();
  if (r.status === 429) throw new PhotoError(429, `${label} is turning visitors away for now (over its free limit) — ${AGAIN}`, 'limit');
  if (r.status === 206 || r.status === 503 || r.status === 502 || r.status === 404 || ct.startsWith('text/html')) throw asleep(label);
  if (!r.ok) {
    const why = await r.text().catch(() => '');
    throw new PhotoError(502, `${label} could not erase it (${r.status}${why ? `: ${why.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}` : ''})`, 'failed');
  }
  return { ...checked(await r.arrayBuffer(), label), by: label, credit: credit('lama') };
}

/**
 * Run one job on a photo (a JPEG, PNG or WebP of at most 1.5 MB; for erase, the mask too). Background:
 * BiRefNet, then BRIA RMBG-1.4 when BiRefNet is asleep, busy or over its limit (each reason said).
 * Throws a PhotoError in words.
 */
export async function runPhotoJob(d: PhotoDeps, job: PhotoJob, picture: ArrayBuffer, mask?: ArrayBuffer | null): Promise<Done> {
  const type = sniffImage(picture);
  if (!type) throw new PhotoError(415, 'that is not a JPEG, PNG or WebP picture', 'bad_input');
  if (picture.byteLength > MAX_IMAGE_BYTES) throw new PhotoError(413, `the photo is too big (${mb(picture.byteLength)} MB; 1.5 MB at most)`, 'too_big');
  const progress = d.progress ?? (() => undefined);
  const g = (ms: number, token: string | null = d.token ?? null): GradioDeps => ({ fetch: d.fetch, token, progress, signal: AbortSignal.timeout(ms) });
  if (job === 'erase') {
    if (!mask) throw new PhotoError(400, 'draw over what to erase first', 'bad_input');
    checkMask(picture, mask);
    try {
      return await lama(g(120_000, null), picture, type, mask);
    } catch (e) {
      throw photoWords(e, PHOTO_SPACES.lama.name);
    }
  }
  if (job === 'sharper') {
    try {
      return await esrgan(g(150_000), picture, type);
    } catch (e) {
      throw photoWords(e, 'Real-ESRGAN');
    }
  }
  const tries: { label: string; run: () => Promise<Done> }[] = [
    { label: 'BiRefNet', run: () => birefnet(g(120_000), picture, type) },
    // A CPU Space has no allowance to spend: never sent the token.
    { label: 'BRIA RMBG-1.4', run: () => rmbg(g(150_000, null), picture, type) },
  ];
  const failed: PhotoError[] = [];
  for (const [i, t] of tries.entries()) {
    try {
      return await t.run();
    } catch (e) {
      const err = photoWords(e, t.label);
      if (err.code === 'too_big') throw err;
      failed.push(err);
      if (i < tries.length - 1) progress(`${err.message.replace(` — ${AGAIN}`, '').replace(/[;.] .*$/, '')} — trying ${tries[i + 1]!.label} on a free computer instead…`);
    }
  }
  const last = failed[failed.length - 1]!;
  const notNow = failed.every((e) => e.code === 'asleep' || e.code === 'busy' || e.code === 'limit');
  throw new PhotoError(last.status, `${notNow ? `the free background removers are busy right now — ${AGAIN}` : 'neither free background remover could do it'}. ${failed.map((e) => e.message).join(' · ')}`, notNow ? last.code : 'failed');
}

/** Keep a result at /i/<id> for 10 years (PHOTOS_PER_DAY a day). */
export async function keepPhoto(kv: ImageKv, done: Pick<Done, 'bytes' | 'type'>, now = Date.now()): Promise<{ id: string; type: ImageType; expires: number }> {
  try {
    return await storeImage(kv, done.bytes, done.type, { ttl: PHOTO_TTL_S, counter: PHOTO_COUNT, limit: PHOTOS_PER_DAY, noun: 'photo', verb: 'made with the photo tools' }, now);
  } catch (e) {
    if (e instanceof LensError) throw new PhotoError(e.status, e.message, e.status === 429 ? 'limit' : e.status === 413 ? 'too_big' : 'failed');
    throw e;
  }
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export interface PhotoRouteDeps {
  kv: ImageKv;
  token: () => Promise<string | null>;
  fetch?: typeof fetch;
}

/**
 * POST /api/m3d/photo (beside the 3D studio's own Hugging Face routes): a form with `job`
 * (background, sharper, erase), `picture` and, for erase, `mask` → JSON lines: `{"step": "…"}` as
 * it goes (place in the queue, waking up), then `{"photo": {id, url, type, expires, by, credit}}` or
 * `{"error": "…", "status": n, "code": "asleep" | "busy" | "limit" | …}`.
 */
export async function photoRoute(req: Request, deps: PhotoRouteDeps): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: 'send the photo as a form: job, picture and, to erase, the mask' }, 400);
  const job = photoJobOf(String(form.get('job') ?? ''));
  if (!job) return json({ error: 'the job must be background, sharper or erase' }, 400);
  const pic = form.get('picture');
  const mask = form.get('mask');
  if (!pic || typeof pic === 'string') return json({ error: 'no photo came with it' }, 400);
  const picture = await pic.arrayBuffer();
  const maskBytes = mask && typeof mask !== 'string' ? await mask.arrayBuffer() : null;
  const token = await deps.token().catch(() => null);
  const f = deps.fetch ?? fetch;
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const w = writable.getWriter();
  const enc = new TextEncoder();
  const send = (o: Record<string, unknown>) => void w.write(enc.encode(`${JSON.stringify(o)}\n`)).catch(() => undefined);
  void (async () => {
    try {
      const done = await runPhotoJob({ fetch: f, token, progress: (step) => send({ step }) }, job, picture, maskBytes);
      send({ step: 'keeping it…' });
      const kept = await keepPhoto(deps.kv, done);
      send({ photo: { id: kept.id, url: `/i/${kept.id}`, type: kept.type, expires: kept.expires, by: done.by, credit: done.credit } });
    } catch (e) {
      const err = e instanceof PhotoError ? e : photoWords(e, 'the photo tools');
      send({ error: err.message, status: err.status, code: err.code });
    } finally {
      await w.close().catch(() => undefined);
    }
  })();
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
