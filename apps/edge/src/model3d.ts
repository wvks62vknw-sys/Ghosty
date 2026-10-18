/**
 * Pictures into 3-D models, for the 3D STUDIO. There is no free 3-D generation API with a key to
 * sign up for, so the brain asks the free makers on Hugging Face (gen3d.ts: TRELLIS.2 with the
 * owner's free token, then Stable Fast 3D) the way their own pages do (gradio.ts). Best effort and
 * never billed: the owner's token is only sent when Hugging Face says its account cannot be charged
 * (`spaceToken`), and every attempt — made or not — counts against Ghosty's own cap of
 * MODELS_PER_DAY a day.
 *
 * The model (a GLB) is kept in the SITES KV namespace for 24 hours under `m3d:<id>` — never in
 * the brain's database — and served to the owner only at /api/m3d/<id>: unlike a shared picture
 * (/i/<id>, public because reverse-image engines must fetch it), nobody else needs to load it.
 * The phone keeps the ones it opens for good (IndexedDB).
 */
import type { Env } from './env';
import { fileFrom as fileOn, isGlb, Model3dError, spaceToken } from './gradio';
import { imageId, isImageId, sniffImage } from './lens';
import { polyHavenFile, polyHavenList, thumbResponse } from './catalog3d';
import { drawObject, fastModel, trellisModel, type Made, type PictureAi } from './gen3d';

export { failureText, findFn, GradioApp, isGlb, MAX_MODEL_BYTES, Model3dError, parseSse, retryIn, spaceToken, type GradioEvent } from './gradio';
export * from './catalog3d';
export * from './gen3d';

/**
 * The Hunyuan3D-2 Space, whose real answers the Gradio protocol fixtures were captured from
 * (test/model3d.fixture.json). It is no longer asked: its licence does not apply in the UK.
 */
export const SPACE = 'https://tencent-hunyuan3d-2.hf.space';
/** The first file in a Gradio answer, as an address on a Space (the fixtures' Space unless another is named). */
export const fileFrom = (data: unknown, root = SPACE, ext = ''): string | null => fileOn(data, root, ext);

/** How long a model stays (seconds): a day, like a shared picture. */
export const MODEL_TTL_S = 86_400;
/** Our own cap per day, counting every attempt (the Spaces' allowance usually runs out first). */
export const MODELS_PER_DAY = 10;
/** The largest picture sent (the phone sends a downscaled JPEG well under this). */
export const MAX_PICTURE_BYTES = 5_000_000;

const PREFIX = 'm3d:';
const LIST = 'm3d:list';
const COUNT = 'm3d:count:';

export type ModelKv = NonNullable<Env['SITES']>;

/** A model made today, as the studio lists it. */
export interface ModelInfo {
  id: string;
  title: string;
  at: number;
  bytes: number;
  /** Faces in the kept copy, when the Space said. */
  faces?: number;
  /** Which free maker made it, whether it has its colours, and the credit the studio shows. */
  maker?: string;
  textured?: boolean;
  credit?: string;
}

export interface MakeDeps {
  fetch: typeof fetch;
  /** The owner's Hugging Face token (optional): sent only when `spaceToken` says it cannot be charged. */
  token?: string | null;
  progress?: (label: string) => void;
}

// ---------------------------------------------------------------- the free makers in turn

/**
 * A picture → the best model a free maker will make right now: TRELLIS.2 when the owner has a free
 * Hugging Face token (the newest, textured), then Stable Fast 3D (textured, seconds). Each failure
 * is said and the next one tried; when every one fails the owner hears each reason. There is no
 * shape-only fallback here any more (Hunyuan3D-2's licence leaves out the UK): the studio shows a
 * stand-in built from shapes instead.
 */
export async function makeTextured(deps: MakeDeps, picture: ArrayBuffer): Promise<Made> {
  const type = sniffImage(picture);
  if (!type) throw new Model3dError(415, 'that is not a JPEG, PNG or WebP picture');
  if (picture.byteLength > MAX_PICTURE_BYTES) throw new Model3dError(413, 'the picture is too big (5 MB at most)');
  const progress = deps.progress ?? (() => undefined);
  const safe = await spaceToken(deps.token, deps.fetch);
  if (safe.why) progress(safe.why);
  const g = (ms: number) => ({ fetch: deps.fetch, token: safe.token, progress, signal: AbortSignal.timeout(ms) });
  const makers: { name: string; run: () => Promise<Made> }[] = [
    ...(safe.token ? [{ name: 'TRELLIS.2', run: () => trellisModel(g(240_000), picture, type) }] : []),
    { name: 'Stable Fast 3D', run: () => fastModel(g(180_000), picture, type) },
  ];
  const failed: Model3dError[] = [];
  for (const [i, m] of makers.entries()) {
    try {
      return await m.run();
    } catch (e) {
      const err =
        e instanceof Model3dError
          ? e
          : e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
            ? new Model3dError(504, `${m.name} took too long (its queue may be long)`, 'busy')
            : new Model3dError(502, `${m.name} could not be reached (${String((e as Error)?.message ?? e).slice(0, 100)})`, 'busy');
      failed.push(err);
      if (i < makers.length - 1) progress(`${m.name} could not make it (${err.message.slice(0, 90)}) — trying ${makers[i + 1]!.name}…`);
    }
  }
  const quota = failed.find((e) => e.code === 'quota');
  const busy = failed.some((e) => e.code === 'busy' || e.code === 'quota');
  const why = failed.map((e, i) => `${makers[i]!.name}: ${e.message}`).join(' · ');
  throw new Model3dError(quota ? 429 : busy ? 503 : 502, `${busy ? 'the free 3-D generators are busy right now — try again in a minute' : 'none of the free 3-D generators could make it'}. ${why}`, quota ? 'quota' : busy ? 'busy' : 'failed');
}

// ---------------------------------------------------------------- keeping models (KV only)

const dayKey = (now: number) => `${COUNT}${new Date(now).toISOString().slice(0, 10)}`;

/** Today's models, newest first (only the ones still within their day). */
export async function listModels(kv: ModelKv, now = Date.now()): Promise<ModelInfo[]> {
  const v = await kv.get(LIST, 'json').catch(() => null);
  return (Array.isArray(v) ? (v as ModelInfo[]) : []).filter((m) => m && isImageId(m.id) && now - m.at < MODEL_TTL_S * 1000);
}

/** Refuse before the Space is asked when today's own cap is reached (a count that cannot be read is refused too). */
export async function checkAllowance(kv: ModelKv, now = Date.now()): Promise<number> {
  let n: unknown;
  try {
    n = await kv.get(dayKey(now), 'json');
  } catch {
    throw new Model3dError(503, "could not read today's model count (the store did not answer) — try again later");
  }
  const count = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (count >= MODELS_PER_DAY) throw new Model3dError(429, `${MODELS_PER_DAY} models have been made today, which is Ghosty's own daily limit; more tomorrow`);
  return count;
}

/** Count one try at making a model, before any Space is asked (a try that fails counts too). */
export async function startAttempt(kv: ModelKv, now = Date.now()): Promise<void> {
  const count = await checkAllowance(kv, now);
  await kv.put(dayKey(now), String(count + 1), { expirationTtl: 2 * 86_400 });
}

/** Keep a model for 24 hours and list it (`counted`: its try was already counted by startAttempt). */
export async function keepModel(kv: ModelKv, glb: ArrayBuffer, title: string, faces: number | undefined, now = Date.now(), made: Partial<Pick<ModelInfo, 'maker' | 'textured' | 'credit'>> = {}, counted = false): Promise<ModelInfo> {
  const count = counted ? 0 : await checkAllowance(kv, now);
  const info: ModelInfo = { id: imageId(), title: title.replace(/\s+/g, ' ').trim().slice(0, 80) || '3-D model', at: now, bytes: glb.byteLength, ...(faces ? { faces } : {}), ...(made.maker ? { maker: made.maker } : {}), ...(made.textured !== undefined ? { textured: made.textured } : {}), ...(made.credit ? { credit: made.credit.slice(0, 160) } : {}) };
  await kv.put(PREFIX + info.id, glb, { expirationTtl: MODEL_TTL_S });
  if (!counted) await kv.put(dayKey(now), String(count + 1), { expirationTtl: 2 * 86_400 });
  // The list is a convenience: a failed write never loses the model itself.
  const list = [info, ...(await listModels(kv, now))].slice(0, 20);
  await kv.put(LIST, JSON.stringify(list), { expirationTtl: MODEL_TTL_S }).catch(() => undefined);
  return info;
}

/** Remove a model before its day is up. */
export async function forgetModel(kv: ModelKv, id: string, now = Date.now()): Promise<boolean> {
  if (!isImageId(id)) return false;
  const had = !!(await kv.get(PREFIX + id, 'arrayBuffer').catch(() => null));
  await kv.delete(PREFIX + id);
  const list = (await listModels(kv, now)).filter((m) => m.id !== id);
  await kv.put(LIST, JSON.stringify(list), { expirationTtl: MODEL_TTL_S }).catch(() => undefined);
  return had;
}

/** The model's bytes for the owner's studio (behind the owner sign-in like every /api route). */
export async function modelResponse(kv: ModelKv, id: string): Promise<Response> {
  const bytes = isImageId(id) ? await kv.get(PREFIX + id, 'arrayBuffer').catch(() => null) : null;
  if (!bytes || !isGlb(bytes)) return new Response(JSON.stringify({ error: 'that model is gone (models are kept 24 hours)' }), { status: 404, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  return new Response(bytes, {
    headers: {
      'content-type': 'model/gltf-binary',
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': `inline; filename="ghosty-${id}.glb"`,
    },
  });
}

// ---------------------------------------------------------------- the route

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export interface Model3dRouteDeps {
  kv: ModelKv | undefined;
  token: () => Promise<string | null>;
  fetch?: typeof fetch;
  /** Workers AI, passed by the brain: draws the object for "make anything" (else a free Space does). */
  ai?: PictureAi | null;
}

/** A small picture as a data: address for the studio (none when it is large). */
function dataUrl(bytes: ArrayBuffer, type: string): string | undefined {
  const b = new Uint8Array(bytes);
  if (b.byteLength > 400_000) return undefined;
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}

/**
 * A long job as a stream of JSON lines, so the studio can show each step and place in the queue:
 * `{"step": "…"}` lines, then `{"model": {...}}` or `{"error": "…", "status": n, "code": "busy"}`.
 */
function lines(run: (send: (o: Record<string, unknown>) => void) => Promise<void>): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const w = writable.getWriter();
  const enc = new TextEncoder();
  const send = (o: Record<string, unknown>) => void w.write(enc.encode(`${JSON.stringify(o)}\n`)).catch(() => undefined);
  void (async () => {
    try {
      await run(send);
    } catch (e) {
      if (e instanceof Model3dError) send({ error: e.message, status: e.status, code: e.code });
      else send({ error: `the model could not be made (${String((e as Error)?.message ?? e).slice(0, 120)})`, status: 500, code: 'failed' });
    } finally {
      await w.close().catch(() => undefined);
    }
  })();
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}

/**
 * /api/m3d — GET: today's models; GET /<id>: the GLB; POST (a picture's bytes, `x-title` naming
 * it; `?stream=1` for step-by-step lines): make a model now; DELETE /<id>: forget it.
 * GET /catalog: Poly Haven's model list as it sent it; GET /phfile?u=: one Poly Haven model file;
 * GET /thumb?u=: a catalogue thumbnail; POST /generate {prompt, title}: words → a picture → a
 * model, as lines. Nothing here parses the catalogue or packs a model (the phone does).
 */
export async function model3dRoute(req: Request, path: string, method: string, deps: Model3dRouteDeps): Promise<Response> {
  const kv = deps.kv;
  if (!kv) return json({ error: 'keeping 3-D models needs the SITES KV namespace (wrangler.jsonc)' }, 503);
  const id = path.match(/^\/m3d\/([A-Za-z0-9_-]{16})(?:\.glb)?$/)?.[1];
  const f = deps.fetch ?? fetch;
  try {
    if (path === '/m3d' && method === 'GET') return json({ models: await listModels(kv) });
    if (id && method === 'GET') return await modelResponse(kv, id);
    if (id && method === 'DELETE') return json({ removed: await forgetModel(kv, id) });
    if (path === '/m3d/catalog' && method === 'GET') {
      const list = await polyHavenList(kv as never, f);
      return new Response(list.text, { headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=86400', 'x-catalog-at': String(list.at), ...(list.stale ? { 'x-catalog-stale': '1' } : {}) } });
    }
    if (path === '/m3d/phfile' && method === 'GET') return await polyHavenFile(new URL(req.url).searchParams.get('u') ?? '', f);
    if (path === '/m3d/thumb' && method === 'GET') return await thumbResponse(new URL(req.url).searchParams.get('u') ?? '', f);
    if (path === '/m3d' && method === 'POST') {
      const bytes = await req.arrayBuffer();
      const title = decodeURIComponent(req.headers.get('x-title') ?? '').slice(0, 80) || 'From a picture';
      // Counted before any Space is asked: a failed try counts too.
      await startAttempt(kv);
      const token = await deps.token().catch(() => null);
      const make = async (progress?: (l: string) => void) => {
        const made = await makeTextured({ fetch: f, token, progress }, bytes);
        return { made, model: await keepModel(kv, made.glb, title, made.faces, Date.now(), made, true) };
      };
      if (new URL(req.url).searchParams.get('stream') === '1')
        return lines(async (send) => {
          const { made, model } = await make((step) => send({ step }));
          send({ model, ...(made.cutout ? { cutout: made.cutout } : {}) });
        });
      return json({ model: (await make()).model });
    }
    if (path === '/m3d/generate' && method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; title?: unknown };
      const prompt = String(body.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!prompt) return json({ error: 'say what to make' }, 400);
      await startAttempt(kv);
      const token = await deps.token().catch(() => null);
      const title = String(body.title ?? '').trim().slice(0, 80) || prompt.slice(0, 60);
      return lines(async (send) => {
        const progress = (step: string) => send({ step });
        const pic = await drawObject({ fetch: f, token, progress, signal: AbortSignal.timeout(90_000), ai: deps.ai }, prompt);
        const shown = dataUrl(pic.bytes, pic.type);
        send({ step: `drawn by ${pic.by}; now making it 3-D…`, ...(shown ? { picture: shown } : {}) });
        const made = await makeTextured({ fetch: f, token, progress }, pic.bytes);
        const model = await keepModel(kv, made.glb, title, made.faces, Date.now(), { ...made, credit: `${made.credit}; drawn first by ${pic.by}` }, true);
        send({ model, ...(made.cutout ? { cutout: made.cutout } : {}) });
      });
    }
  } catch (e) {
    if (e instanceof Model3dError) return json({ error: e.message, code: e.code }, e.status);
    return json({ error: `the model could not be kept (${String((e as Error)?.message ?? e).slice(0, 120)})` }, 500);
  }
  return json({ error: 'not found' }, 404);
}
