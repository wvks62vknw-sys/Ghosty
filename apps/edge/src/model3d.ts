/**
 * Pictures into 3-D models, for the 3D STUDIO. There is no free 3-D generation API with a key to
 * sign up for, so this asks the public Hunyuan3D-2 demo on Hugging Face (tencent/Hunyuan3D-2, a
 * Gradio app on free ZeroGPU hardware) the way its own web page does: upload the picture, join
 * the queue for `shape_generation`, read the queue's event stream until the model is made, then
 * ask its `on_export_click` step for a lighter copy (about 20,000 faces instead of ~760,000: a
 * 12 MB file becomes ~0.4 MB, which a phone can turn around smoothly). Best effort and never paid:
 * ZeroGPU gives visitors without an account about 2 minutes of GPU and 3 runs a day, shared by
 * everyone behind the same address — so a free Hugging Face token (SYSTEM → KEYS, optional)
 * makes it far more reliable. When the allowance is used up the owner is told when to try again.
 *
 * The model (a GLB) is kept in the SITES KV namespace for 24 hours under `m3d:<id>` — never in
 * the brain's database — and served to the owner only at /api/m3d/<id>: unlike a shared picture
 * (/i/<id>, public because reverse-image engines must fetch it), nobody else needs to load it.
 * Calls made: ~7 outbound requests per model (config, upload, join, stream, export join, export
 * stream, download), well under the Worker's 50.
 */
import type { Env } from './env';
import { failureText, fileFrom as fileOn, findFn, isGlb, MAX_MODEL_BYTES, Model3dError, readQueue, sessionHash, type GradioEvent } from './gradio';
import { imageId, isImageId, sniffImage } from './lens';
import { polyHavenCatalog, polyHavenGlb, thumbResponse } from './catalog3d';
import { drawObject, fastModel, trellisModel, type Made, type PictureAi } from './gen3d';

export { failureText, findFn, GradioApp, isGlb, MAX_MODEL_BYTES, Model3dError, parseSse, retryIn, type GradioEvent } from './gradio';
export * from './catalog3d';
export * from './gen3d';

/** The first file in a Gradio answer, as an address on the Space (Hunyuan3D-2's, unless another is named). */
export const fileFrom = (data: unknown, root = SPACE, ext = ''): string | null => fileOn(data, root, ext);

/** The Space, its own address (it answers its Gradio API there). */
export const SPACE = 'https://tencent-hunyuan3d-2.hf.space';
/** How long a model stays (seconds): a day, like a shared picture. */
export const MODEL_TTL_S = 86_400;
/** Our own cap per day — the Space's allowance runs out well before this. */
export const MODELS_PER_DAY = 10;
/** The largest picture sent (the phone sends a downscaled JPEG well under this). */
export const MAX_PICTURE_BYTES = 5_000_000;
/** Faces in the lightened copy: plenty for a phone to explode, turn and section. */
export const TARGET_FACES = 20_000;

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
  /** A Hugging Face token (optional): the owner's own ZeroGPU allowance. Never logged or returned. */
  token?: string | null;
  progress?: (label: string) => void;
  /** Gives up after this long in all (default 3 minutes). */
  timeoutMs?: number;
}

/**
 * Picture bytes → a GLB. Throws Model3dError with words for the owner on every failure
 * (quota, a busy queue, a picture it could not use, a dead Space).
 */
export async function makeModel(deps: MakeDeps, picture: ArrayBuffer): Promise<{ glb: ArrayBuffer; faces?: number }> {
  const type = sniffImage(picture);
  if (!type) throw new Model3dError(415, 'that is not a JPEG, PNG or WebP picture');
  if (picture.byteLength > MAX_PICTURE_BYTES) throw new Model3dError(413, 'the picture is too big (5 MB at most)');
  const progress = deps.progress ?? (() => undefined);
  const signal = AbortSignal.timeout(deps.timeoutMs ?? 180_000);
  const auth: Record<string, string> = deps.token ? { Authorization: `Bearer ${deps.token}` } : {};
  // Called bare, never as deps.fetch(…): the Workers runtime refuses a fetch bound to another object.
  const f = deps.fetch;
  const get = (url: string) => f(url, { headers: auth, signal });
  const post = (url: string, body: BodyInit, headers: Record<string, string> = {}) => f(url, { method: 'POST', headers: { ...auth, ...headers }, body, signal });
  const ask = async (fnIndex: number, triggerId: number | null, data: unknown[], what: string): Promise<GradioEvent> => {
    const session = sessionHash();
    const j = await post(`${SPACE}/queue/join`, JSON.stringify({ data, fn_index: fnIndex, trigger_id: triggerId, session_hash: session, event_data: null }), { 'content-type': 'application/json' });
    if (j.status === 429) throw new Model3dError(429, 'the free 3-D model maker is turning visitors away right now — try again in a few minutes', 'busy');
    if (!j.ok) throw new Model3dError(502, `the 3-D model maker did not take the job (${j.status})`);
    return readQueue(await get(`${SPACE}/queue/data?session_hash=${session}`), progress, what);
  };

  try {
    progress('reaching the 3-D model maker…');
    const cr = await get(`${SPACE}/config`);
    if (!cr.ok) throw new Model3dError(503, `the 3-D model maker is not running right now (${cr.status}) — it sleeps when nobody uses it; try again in a few minutes`, 'busy');
    const config = (await cr.json()) as unknown;
    const shape = findFn(config, 'shape_generation');
    if (!shape) throw new Model3dError(502, 'the 3-D model maker has changed and no longer offers shape generation');
    const lighten = findFn(config, 'on_export_click');

    progress('sending the picture…');
    const form = new FormData();
    form.append('files', new Blob([picture], { type }), `picture.${type.slice(6)}`);
    const up = await post(`${SPACE}/upload`, form);
    if (!up.ok) throw new Model3dError(502, `the 3-D model maker would not take the picture (${up.status})`);
    const paths = (await up.json()) as unknown;
    const path = Array.isArray(paths) && typeof paths[0] === 'string' ? paths[0] : null;
    if (!path) throw new Model3dError(502, 'the 3-D model maker did not keep the picture');
    const file = (p: string) => ({ path: p, meta: { _type: 'gradio.FileData' } });

    // caption, image, four multi-view pictures, steps, guidance, seed, octree resolution,
    // remove background, chunks, random seed — the Space's own defaults.
    const made = await ask(shape.fnIndex, shape.triggerId, ['', file(path), null, null, null, null, 30, 5, 1234, 256, true, 8000, true], 'shaping the model');
    if (made.msg !== 'process_completed' || made.success === false) {
      const f = failureText(made, !!deps.token);
      throw new Model3dError(f.status, f.text, f.code);
    }
    const out = made.output?.data ?? [];
    let url = fileFrom(out);
    if (!url) throw new Model3dError(502, 'the 3-D model maker finished but returned no model');
    const stats = out.find((v) => v && typeof v === 'object' && 'number_of_faces' in v) as { number_of_faces?: number } | undefined;
    let faces = typeof stats?.number_of_faces === 'number' ? stats.number_of_faces : undefined;

    // A lighter copy (CPU only, no GPU allowance used); the full model is the fallback.
    if (lighten) {
      try {
        const raw = url.slice(url.indexOf('/file=') + 6);
        const light = await ask(lighten.fnIndex, lighten.triggerId, [file(raw), null, 'glb', true, false, TARGET_FACES], 'lightening it for the phone');
        const lurl = light.success !== false ? fileFrom(light.output?.data ?? []) : null;
        if (lurl) {
          url = lurl;
          faces = Math.min(faces ?? TARGET_FACES, TARGET_FACES);
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'TimeoutError') throw e;
      }
    }

    progress('fetching the model…');
    const res = await get(url);
    if (!res.ok) throw new Model3dError(502, `the model could not be fetched (${res.status})`);
    const glb = await res.arrayBuffer();
    if (!isGlb(glb)) throw new Model3dError(502, 'the 3-D model maker returned something that is not a GLB model');
    if (glb.byteLength > MAX_MODEL_BYTES) throw new Model3dError(413, `the model is too big to keep (${(glb.byteLength / 1e6).toFixed(1)} MB)`);
    return { glb, faces };
  } catch (e) {
    if (e instanceof Model3dError) throw e;
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Model3dError(504, 'the 3-D model maker took more than 3 minutes (its queue may be long) — try again later');
    throw new Model3dError(502, `could not reach the 3-D model maker (${String((e as Error)?.message ?? e).slice(0, 120)})`);
  }
}


// ---------------------------------------------------------------- the free makers in turn

/** Hunyuan3D-2 (above) as one of the makers: shape only. */
const HUNYUAN = { maker: 'Hunyuan3D-2', textured: false, credit: 'Made from a picture by Hunyuan3D-2 (Tencent), via Hugging Face — shape only' };

/**
 * A picture → the best model a free maker will make right now: TRELLIS.2 when the owner has a
 * Hugging Face token (the newest, textured; ZeroGPU), then Stable Fast 3D (textured, seconds, no
 * account needed), then Hunyuan3D-2 (shape only). Each failure is said and the next one tried;
 * when every one fails the owner hears each reason.
 */
export async function makeTextured(deps: MakeDeps, picture: ArrayBuffer): Promise<Made> {
  const type = sniffImage(picture);
  if (!type) throw new Model3dError(415, 'that is not a JPEG, PNG or WebP picture');
  if (picture.byteLength > MAX_PICTURE_BYTES) throw new Model3dError(413, 'the picture is too big (5 MB at most)');
  const progress = deps.progress ?? (() => undefined);
  const g = (ms: number) => ({ fetch: deps.fetch, token: deps.token, progress, signal: AbortSignal.timeout(ms) });
  const makers: { name: string; run: () => Promise<Made> }[] = [
    ...(deps.token ? [{ name: 'TRELLIS.2', run: () => trellisModel(g(150_000), picture, type) }] : []),
    { name: 'Stable Fast 3D', run: () => fastModel(g(90_000), picture, type) },
    { name: 'Hunyuan3D-2', run: async () => ({ ...(await makeModel({ ...deps, progress }, picture)), ...HUNYUAN }) },
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

/** Keep a model for 24 hours and list it. */
export async function keepModel(kv: ModelKv, glb: ArrayBuffer, title: string, faces: number | undefined, now = Date.now(), made: Partial<Pick<ModelInfo, 'maker' | 'textured' | 'credit'>> = {}): Promise<ModelInfo> {
  const count = await checkAllowance(kv, now);
  const info: ModelInfo = { id: imageId(), title: title.replace(/\s+/g, ' ').trim().slice(0, 80) || '3-D model', at: now, bytes: glb.byteLength, ...(faces ? { faces } : {}), ...(made.maker ? { maker: made.maker } : {}), ...(made.textured !== undefined ? { textured: made.textured } : {}), ...(made.credit ? { credit: made.credit.slice(0, 160) } : {}) };
  await kv.put(PREFIX + info.id, glb, { expirationTtl: MODEL_TTL_S });
  await kv.put(dayKey(now), String(count + 1), { expirationTtl: 2 * 86_400 });
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
  /** Workers AI, when the brain passes it: draws the object for "make anything" (else a free Space does). */
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

const GLB_HEADERS = { 'content-type': 'model/gltf-binary', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" };

type EdgeCache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> };
/** The Worker's own cache (free), when there is one. */
const edgeCache = (): EdgeCache | null => (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;

/**
 * /api/m3d — GET: today's models; GET /<id>: the GLB; POST (a picture's bytes, `x-title` naming
 * it; `?stream=1` for step-by-step lines): make a model now; DELETE /<id>: forget it.
 * GET /catalog: Poly Haven's models; GET /ph/<id>: one as a GLB; GET /thumb?u=: a catalogue
 * thumbnail; POST /generate {prompt, title}: words → a picture → a model, as lines.
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
    if (path === '/m3d/catalog' && method === 'GET') return json(await polyHavenCatalog(kv, f));
    if (path === '/m3d/thumb' && method === 'GET') return await thumbResponse(new URL(req.url).searchParams.get('u') ?? '', f);
    const ph = path.match(/^\/m3d\/ph\/([A-Za-z0-9_-]{1,80})$/)?.[1];
    if (ph && method === 'GET') {
      const key = `https://ghosty-cache.invalid/m3d/ph/${ph}`;
      const cache = edgeCache();
      const hit = await cache?.match(key).catch(() => undefined);
      if (hit) return hit;
      const glb = await polyHavenGlb(ph, f);
      await cache?.put(key, new Response(glb.slice(0), { headers: { ...GLB_HEADERS, 'cache-control': 'public, max-age=2592000' } })).catch(() => undefined);
      return new Response(glb, { headers: { ...GLB_HEADERS, 'cache-control': 'private, max-age=86400', 'content-length': String(glb.byteLength) } });
    }
    if (path === '/m3d' && method === 'POST') {
      await checkAllowance(kv);
      const bytes = await req.arrayBuffer();
      const title = decodeURIComponent(req.headers.get('x-title') ?? '').slice(0, 80) || 'From a picture';
      const token = await deps.token().catch(() => null);
      const make = async (progress?: (l: string) => void) => {
        const made = await makeTextured({ fetch: f, token, progress }, bytes);
        return { made, model: await keepModel(kv, made.glb, title, made.faces, Date.now(), made) };
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
      await checkAllowance(kv);
      const token = await deps.token().catch(() => null);
      const title = String(body.title ?? '').trim().slice(0, 80) || prompt.slice(0, 60);
      return lines(async (send) => {
        const progress = (step: string) => send({ step });
        const pic = await drawObject({ fetch: f, token, progress, signal: AbortSignal.timeout(90_000), ai: deps.ai }, prompt);
        const shown = dataUrl(pic.bytes, pic.type);
        send({ step: `drawn by ${pic.by}; now making it 3-D…`, ...(shown ? { picture: shown } : {}) });
        const made = await makeTextured({ fetch: f, token, progress }, pic.bytes);
        const model = await keepModel(kv, made.glb, title, made.faces, Date.now(), { ...made, credit: `${made.credit}; drawn first by ${pic.by}` });
        send({ model, ...(made.cutout ? { cutout: made.cutout } : {}) });
      });
    }
  } catch (e) {
    if (e instanceof Model3dError) return json({ error: e.message }, e.status);
    return json({ error: `the model could not be kept (${String((e as Error)?.message ?? e).slice(0, 120)})` }, 500);
  }
  return json({ error: 'not found' }, 404);
}
