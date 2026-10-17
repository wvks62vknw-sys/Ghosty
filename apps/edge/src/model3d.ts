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
import { imageId, isImageId, sniffImage } from './lens';

/** The Space, its own address (it answers its Gradio API there). */
export const SPACE = 'https://tencent-hunyuan3d-2.hf.space';
/** How long a model stays (seconds): a day, like a shared picture. */
export const MODEL_TTL_S = 86_400;
/** Our own cap per day — the Space's allowance runs out well before this. */
export const MODELS_PER_DAY = 10;
/** The largest model kept (KV takes 25 MiB a value; a lightened model is far smaller). */
export const MAX_MODEL_BYTES = 20_000_000;
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
}

/** A refusal or failure with the status the route answers with, in words for the owner. */
export class Model3dError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- the Gradio queue, as data

/** One message from a Gradio queue stream (`data: {...}` lines). */
export interface GradioEvent {
  msg: string;
  event_id?: string | null;
  rank?: number;
  queue_size?: number;
  rank_eta?: number;
  eta?: number;
  success?: boolean;
  output?: { data?: unknown[]; error?: string | null; title?: string | null };
}

/** Every `data:` message in an event-stream text (a partial last line is left out). */
export function parseSse(text: string): GradioEvent[] {
  const out: GradioEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try {
      const v = JSON.parse(line.slice(5).trim()) as unknown;
      if (v && typeof v === 'object' && typeof (v as GradioEvent).msg === 'string') out.push(v as GradioEvent);
    } catch {
      // a line cut in half, or not JSON: skip it
    }
  }
  return out;
}

/** A Gradio app's function by its API name: its index and the click that triggers it (from /config). */
export function findFn(config: unknown, apiName: string): { fnIndex: number; triggerId: number | null } | null {
  const deps = (config as { dependencies?: unknown })?.dependencies;
  if (!Array.isArray(deps)) return null;
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i] as { id?: unknown; api_name?: unknown; targets?: unknown };
    if (d?.api_name !== apiName) continue;
    const t = Array.isArray(d.targets) && Array.isArray(d.targets[0]) ? d.targets[0][0] : null;
    return { fnIndex: typeof d.id === 'number' ? d.id : i, triggerId: typeof t === 'number' ? t : null };
  }
  return null;
}

/** The first file in a Gradio answer (a FileData, or an update wrapping one), as an address on the Space. */
export function fileFrom(data: unknown, root = SPACE): string | null {
  if (!Array.isArray(data)) return null;
  for (const v of data) {
    const f = (v && typeof v === 'object' && 'value' in v ? (v as { value: unknown }).value : v) as { url?: unknown; path?: unknown } | null;
    if (!f || typeof f !== 'object') continue;
    if (typeof f.url === 'string' && f.url.startsWith(`${root}/`)) return f.url;
    if (typeof f.path === 'string' && f.path) return `${root}/file=${f.path}`;
  }
  return null;
}

/** "Try again in 13:46:29" → "about 13 h 46 min"; null when the message names no time. */
export function retryIn(message: string): string | null {
  const m = message.match(/try again in (\d+):(\d{2}):(\d{2})/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  // "0:00:00" is what the runs-a-day cap says (it has no clock of its own): no time to name.
  if (!h && !min) return null;
  return `about ${h ? `${h} h ` : ''}${min} min`.replace(/ 0 min$/, '');
}

/** The owner-facing reason a queue run failed. */
export function failureText(ev: GradioEvent | null, hasToken: boolean): { status: number; text: string } {
  const raw = String(ev?.output?.error ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = String(ev?.output?.title ?? '');
  if (ev?.msg === 'queue_full') return { status: 503, text: 'the free 3-D model maker is full right now — try again in a few minutes' };
  if (/quota|runn+ing out of daily/i.test(`${title} ${raw}`)) {
    const when = retryIn(raw);
    const tip = hasToken
      ? ''
      : ' Without a Hugging Face account it allows only about 2–3 models a day, shared with everyone on the same network; a free Hugging Face token (SYSTEM → KEYS → Hugging Face) gives Ghosty its own daily allowance.';
    return { status: 429, text: `the free 3-D model maker (Hugging Face ZeroGPU) has used up today's GPU allowance${when ? ` — try again in ${when}` : ' — try again later today or tomorrow'}.${tip}` };
  }
  if (raw) return { status: 502, text: `the 3-D model maker could not do it: ${raw.slice(0, 200)}` };
  return { status: 502, text: 'the 3-D model maker failed on this picture without saying why — try a clear photo of one object on a plain background, or again in a few minutes' };
}

// ---------------------------------------------------------------- the run itself

export interface MakeDeps {
  fetch: typeof fetch;
  /** A Hugging Face token (optional): the owner's own ZeroGPU allowance. Never logged or returned. */
  token?: string | null;
  progress?: (label: string) => void;
  /** Gives up after this long in all (default 3 minutes). */
  timeoutMs?: number;
}

const sessionHash = () => imageId().replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 11) || 'ghosty';

/** Read a queue stream until its function finishes; reports place in the queue on the way. */
async function readQueue(res: Response, progress: (l: string) => void, what: string): Promise<GradioEvent> {
  if (!res.ok || !res.body) throw new Model3dError(502, `the 3-D model maker did not answer (${res.status})`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let last: GradioEvent | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += value;
      // Whole messages only: everything up to the last blank line.
      const cut = buf.lastIndexOf('\n\n');
      if (cut >= 0) {
        for (const ev of parseSse(buf.slice(0, cut))) {
          last = ev;
          if (ev.msg === 'estimation' && typeof ev.rank === 'number') progress(ev.rank > 0 ? `${what}: number ${ev.rank + 1} in the queue…` : `${what}: next in the queue…`);
          else if (ev.msg === 'process_starts') progress(`${what}…`);
          else if (ev.msg === 'process_completed' || ev.msg === 'queue_full' || ev.msg === 'unexpected_error') return ev;
        }
        buf = buf.slice(cut + 2);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  for (const ev of parseSse(buf)) last = ev;
  if (last && (last.msg === 'process_completed' || last.msg === 'queue_full')) return last;
  throw new Model3dError(502, 'the 3-D model maker stopped answering before the model was ready — try again in a few minutes');
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
    if (j.status === 429) throw new Model3dError(429, 'the free 3-D model maker is turning visitors away right now — try again in a few minutes');
    if (!j.ok) throw new Model3dError(502, `the 3-D model maker did not take the job (${j.status})`);
    return readQueue(await get(`${SPACE}/queue/data?session_hash=${session}`), progress, what);
  };

  try {
    progress('reaching the 3-D model maker…');
    const cr = await get(`${SPACE}/config`);
    if (!cr.ok) throw new Model3dError(503, `the 3-D model maker is not running right now (${cr.status}) — it sleeps when nobody uses it; try again in a few minutes`);
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
      throw new Model3dError(f.status, f.text);
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

/** A binary glTF starts with "glTF" and version 2. */
export function isGlb(b: ArrayBuffer): boolean {
  const v = new DataView(b);
  return b.byteLength > 20 && v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2;
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
export async function keepModel(kv: ModelKv, glb: ArrayBuffer, title: string, faces: number | undefined, now = Date.now()): Promise<ModelInfo> {
  const count = await checkAllowance(kv, now);
  const info: ModelInfo = { id: imageId(), title: title.replace(/\s+/g, ' ').trim().slice(0, 80) || '3-D model', at: now, bytes: glb.byteLength, ...(faces ? { faces } : {}) };
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
}

/**
 * /api/m3d — GET: today's models; GET /<id>: the GLB; POST (a picture's bytes, `x-title` naming
 * it): make a model now (20 s to 2 min); DELETE /<id>: forget it.
 */
export async function model3dRoute(req: Request, path: string, method: string, deps: Model3dRouteDeps): Promise<Response> {
  const kv = deps.kv;
  if (!kv) return json({ error: 'keeping 3-D models needs the SITES KV namespace (wrangler.jsonc)' }, 503);
  const id = path.match(/^\/m3d\/([A-Za-z0-9_-]{16})(?:\.glb)?$/)?.[1];
  try {
    if (path === '/m3d' && method === 'GET') return json({ models: await listModels(kv) });
    if (id && method === 'GET') return await modelResponse(kv, id);
    if (id && method === 'DELETE') return json({ removed: await forgetModel(kv, id) });
    if (path === '/m3d' && method === 'POST') {
      await checkAllowance(kv);
      const bytes = await req.arrayBuffer();
      const title = decodeURIComponent(req.headers.get('x-title') ?? '').slice(0, 80) || 'From a picture';
      const token = await deps.token().catch(() => null);
      const made = await makeModel({ fetch: deps.fetch ?? fetch, token }, bytes);
      return json({ model: await keepModel(kv, made.glb, title, made.faces) });
    }
  } catch (e) {
    if (e instanceof Model3dError) return json({ error: e.message }, e.status);
    return json({ error: `the model could not be kept (${String((e as Error)?.message ?? e).slice(0, 120)})` }, 500);
  }
  return json({ error: 'not found' }, 404);
}
