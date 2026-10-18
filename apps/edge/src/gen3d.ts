/**
 * Free 3-D generators on Hugging Face, for pictures with their colours (textured models) and for
 * "type anything": every one a public Gradio app asked like its own page (gradio.ts), never paid.
 *
 *  - Stable Fast 3D (stabilityai/stable-fast-3d): the picture's background removed, then a
 *    textured, UV-unwrapped model in a few seconds (tried for real in October 2026: ~3 s for a
 *    1.2 MB GLB with no account). It runs on ZeroGPU too, so a visitor without an account gets
 *    only a few a day per address (the next try from the same address was refused for the day's
 *    allowance); the owner's free Hugging Face token gives Ghosty its own. Its outputs are under
 *    the Stability AI Community Licence (free for people and small businesses).
 *  - TRELLIS.2 (microsoft/TRELLIS.2, the newest open image-to-3D model): textured, more detail,
 *    on ZeroGPU — only with the owner's free Hugging Face token, since a visitor without one gets
 *    about a minute of GPU a day, less than one model needs.
 *  - FLUX.1 schnell (black-forest-labs/FLUX.1-schnell, ZeroGPU): draws the object first when only
 *    words were given and Workers AI's own FLUX (make_picture) is not at hand.
 * The shape-only Hunyuan3D-2 maker stays in model3d.ts as the last free fallback.
 */
import { fileData, GradioApp, isGlb, MAX_MODEL_BYTES, Model3dError, type GradioDeps } from './gradio';
import { fromBase64 } from './speech';

export const SF3D = 'https://stabilityai-stable-fast-3d.hf.space';
export const TRELLIS2 = 'https://microsoft-trellis-2.hf.space';
export const FLUX_SPACE = 'https://black-forest-labs-flux-1-schnell.hf.space';

/** A model a generator made. */
export interface Made {
  glb: ArrayBuffer;
  faces?: number;
  /** With its colours (a texture), not plain clay. */
  textured: boolean;
  maker: string;
  /** The credit shown under it in the studio. */
  credit: string;
  /** The picture with its background removed, as a small data: address, when the maker showed one. */
  cutout?: string;
}

/** The picture prompt that gives a 3-D maker what it works best from: one whole object, nothing behind it. */
export const objectPrompt = (what: string): string => `${what.trim().replace(/[.\s]+$/, '')}, a single object, whole and centred, three-quarter view, plain white background, soft even studio light, product photo`;

const typeName = (type: string) => `picture.${type.slice(6) || 'png'}`;

/** Fetch a model a Space made and check it is a GLB a phone can hold. */
async function fetchGlb(app: GradioApp, url: string | null, progress: (l: string) => void): Promise<ArrayBuffer> {
  if (!url) throw new Model3dError(502, `${app.label} finished but returned no model`);
  progress('fetching the model…');
  const res = await app.get(url);
  if (!res.ok) throw new Model3dError(502, `the model could not be fetched (${res.status})`);
  const glb = await res.arrayBuffer();
  if (!isGlb(glb)) throw new Model3dError(502, `${app.label} returned something that is not a GLB model`);
  if (glb.byteLength > MAX_MODEL_BYTES) throw new Model3dError(413, `the model is too big to keep (${(glb.byteLength / 1e6).toFixed(1)} MB)`);
  return glb;
}

/** A small picture from a Space as a data: address (the studio's security policy shows data: pictures), or undefined. */
async function smallPicture(app: GradioApp, url: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const r = await app.get(url);
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!r.ok || !/^image\/(?:png|jpeg|webp)$/.test(type)) return undefined;
    const b = new Uint8Array(await r.arrayBuffer());
    if (b.byteLength > 400_000) return undefined;
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(s)}`;
  } catch {
    return undefined;
  }
}

/** Stable Fast 3D: background removed, then a textured model (≈3 s on its own GPU). */
export async function fastModel(d: GradioDeps, picture: ArrayBuffer, type: string): Promise<Made> {
  const progress = d.progress ?? (() => undefined);
  const app = new GradioApp(SF3D, d, 'Stable Fast 3D');
  progress('reaching Stable Fast 3D…');
  await app.open(['requires_bg_remove', 'run_button']);
  progress('sending the picture…');
  const path = await app.upload(picture, type, typeName(type));
  // Its page cuts the background out as soon as a picture is chosen; the model step reads that from the session.
  const cut = await app.call('requires_bg_remove', [fileData(path), 0.85], 'removing the background');
  const cutout = await smallPicture(app, app.fileUrl(cut));
  const out = await app.call('run_button', ['Run', fileData(path), null, 0.85, 'None', -1, 1024], 'shaping and painting the model');
  const glb = await fetchGlb(app, app.fileUrl(out, '.glb'), progress);
  return { glb, textured: true, maker: 'Stable Fast 3D', credit: 'Made from a picture by Stable Fast 3D (Stability AI, Community Licence), via Hugging Face', ...(cutout ? { cutout } : {}) };
}

/** TRELLIS.2: background removed, shaped, then painted and packed as a GLB (ZeroGPU: the owner's token). */
export async function trellisModel(d: GradioDeps, picture: ArrayBuffer, type: string, faces = 100_000): Promise<Made> {
  const progress = d.progress ?? (() => undefined);
  const app = new GradioApp(TRELLIS2, d, 'TRELLIS.2');
  progress('reaching TRELLIS.2…');
  await app.open(['start_session', 'preprocess_image', 'image_to_3d', 'extract_glb']);
  // Its page opens a session first (a folder on the Space for this visitor's files).
  await app.call('start_session', [], 'starting');
  progress('sending the picture…');
  const path = await app.upload(picture, type, typeName(type));
  const pre = await app.call('preprocess_image', [fileData(path)], 'removing the background');
  const p0 = pre[0] as { path?: unknown } | null;
  const clean = p0 && typeof p0.path === 'string' ? p0.path : path;
  const cutout = await smallPicture(app, app.fileUrl(pre));
  // seed, resolution, then the three stages' guidance / rescale / steps / rescale-t — the Space's defaults
  await app.call('image_to_3d', [fileData(clean), 0, '1024', 7.5, 0.7, 12, 5, 7.5, 0.5, 12, 3, 1, 0, 12, 3], 'shaping the model');
  const out = await app.call('extract_glb', [null, faces, 1024], 'painting it and packing it for the phone');
  const glb = await fetchGlb(app, app.fileUrl(out, '.glb'), progress);
  return { glb, faces, textured: true, maker: 'TRELLIS.2', credit: 'Made from a picture by TRELLIS.2 (Microsoft, MIT licence), via Hugging Face', ...(cutout ? { cutout } : {}) };
}

/** Workers AI, the part this file needs (the brain's own FLUX, as make_picture uses). */
export interface PictureAi {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

const FLUX = '@cf/black-forest-labs/flux-1-schnell';

/**
 * Draw one object for a 3-D maker: Workers AI's FLUX when the brain has it (free daily allowance),
 * else the FLUX.1 schnell Space. Throws `no_picture` when neither can.
 */
export async function drawObject(d: GradioDeps & { ai?: PictureAi | null }, what: string): Promise<{ bytes: ArrayBuffer; type: string; by: string }> {
  const progress = d.progress ?? (() => undefined);
  const prompt = objectPrompt(what);
  const why: string[] = [];
  if (d.ai) {
    progress('drawing the object first…');
    try {
      const r = (await d.ai.run(FLUX, { prompt, steps: 4 })) as { image?: unknown } | null;
      if (r && typeof r.image === 'string' && r.image) return { bytes: fromBase64(r.image), type: 'image/jpeg', by: 'FLUX.1 schnell (Workers AI)' };
      why.push('the picture model returned nothing');
    } catch (e) {
      why.push(`the picture model did not answer (${String((e as Error)?.message ?? e).slice(0, 100)})`);
    }
  }
  else why.push('Workers AI is not available here');
  try {
    const app = new GradioApp(FLUX_SPACE, d, 'the free picture maker FLUX.1 schnell');
    progress('drawing the object first (FLUX.1 schnell on Hugging Face)…');
    await app.open(['infer']);
    const out = await app.call('infer', [prompt, 0, true, 768, 768, 4], 'drawing the object first');
    const url = app.fileUrl(out);
    if (!url) throw new Model3dError(502, 'the free picture maker returned no picture');
    const r = await app.get(url);
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!r.ok || !/^image\/(?:png|jpeg|webp)$/.test(type)) throw new Model3dError(502, `the free picture maker's picture could not be fetched (${r.status})`);
    return { bytes: await r.arrayBuffer(), type, by: 'FLUX.1 schnell (Hugging Face)' };
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw e;
    why.push(e instanceof Model3dError ? e.message : `the free picture maker could not be reached (${String((e as Error)?.message ?? e).slice(0, 100)})`);
  }
  throw new Model3dError(503, `nothing could draw the object first: ${why.join('; ')}`, 'no_picture');
}
