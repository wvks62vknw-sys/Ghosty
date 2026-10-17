/**
 * The 3D STUDIO's tool. make_3d turns a picture (or a described object, drawn first) into a 3-D
 * model (model3d.ts: the free Hunyuan3D-2 demo on Hugging Face, best effort, a few a day) and
 * opens it in the studio; with no picture it just opens the studio (the interface's
 * `open_studio` command) on a sample, a model, a room built from measurements, or a Spline scene
 * the owner pasted. One tool, not two: every tool group's tool names are in every plain turn's
 * prompt, which has a hard size budget.
 */
import { imageResponse, isImageId, LensError, PICTURE_TTL_S, PICTURES_PER_DAY, storeImage } from '../lens';
import { checkAllowance, keepModel, makeModel, Model3dError } from '../model3d';
import { fromBase64 } from '../speech';
import { PICTURE_COUNT } from './pictures';
import { arg, type Tool } from './types';

const FLUX = '@cf/black-forest-labs/flux-1-schnell';
/** The picture prompt that gives the 3-D maker what it works best from: one whole object, nothing behind it. */
export const objectPrompt = (what: string): string => `${what.trim().replace(/[.\s]+$/, '')}, a single object, whole and centred, three-quarter view, plain white background, soft even studio light, product photo`;

/** A picture Ghosty made or the owner shared (/i/<id> link or bare id), or a public picture address. */
async function pictureBytes(ref: string, kv: NonNullable<Parameters<Tool['run']>[1]['env']['SITES']>): Promise<ArrayBuffer> {
  const id = ref.match(/\/i\/([A-Za-z0-9_-]{16})\b/)?.[1] ?? (isImageId(ref.trim()) ? ref.trim() : null);
  if (id) {
    const r = await imageResponse(kv, id);
    if (!r.ok) throw new Error('that picture is no longer kept (shared pictures last a day, made ones a week) — make or share it again');
    return r.arrayBuffer();
  }
  let u: URL;
  try {
    u = new URL(ref);
  } catch {
    throw new Error('give a picture link (a /i/… link from make_picture or the Lens, or a public https address of a picture)');
  }
  if (u.protocol !== 'https:') throw new Error('only https picture addresses can be used');
  const r = await fetch(u.toString(), { headers: { Accept: 'image/*' } });
  if (!r.ok) throw new Error(`the picture could not be fetched (${r.status})`);
  const b = await r.arrayBuffer();
  if (b.byteLength > 5_000_000) throw new Error('that picture is too big (5 MB at most)');
  return b;
}

export const studioTools: Tool[] = [
  {
    name: 'make_3d',
    description:
      "3D STUDIO (turn, take apart, section, measure). Picture → 3-D model: give `picture` (a /i/… link from make_picture or the Lens, or an https picture address) or `prompt` describing ONE object (drawn first). Free, best effort: Hugging Face's Hunyuan3D-2 demo, 20 s–2 min, about 2–3 a day without a Hugging Face token; untextured clay; kept 24 h. With no picture or prompt it just opens the studio on `sample`, `room` (cm) or `spline` (a my.spline.design link the owner gave).",
    parameters: {
      type: 'object',
      properties: {
        picture: { type: 'string', description: 'the picture: a /i/<id> link or an https picture address' },
        prompt: { type: 'string', description: 'when there is no picture: the one object to draw and then model, in English' },
        title: { type: 'string', description: 'a short name for the model' },
        sample: { type: 'string', enum: ['reactor', 'toycar', 'chair', 'sofa', 'truck'], description: 'open a built-in model' },
        room: { type: 'object', description: 'build a room to walk round, in centimetres', properties: { w: { type: 'number' }, d: { type: 'number' }, h: { type: 'number' } } },
        spline: { type: 'string', description: 'a https://my.spline.design/… public scene link' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const ref = arg.str(a, 'picture', false).trim();
      const prompt = arg.str(a, 'prompt', false).trim().slice(0, 500);
      if (!ref && !prompt) {
        // Nothing to make: open the studio on what was asked for (the interface checks the details).
        const show: Record<string, unknown> = {};
        for (const k of ['sample', 'room', 'spline'] as const) if (a[k] !== undefined && a[k] !== '') show[k] = a[k];
        ctx.emit({ t: 'client', name: 'open_studio', args: show });
        return `Opened the 3D STUDIO${show.sample ? ` on the ${String(show.sample)} sample` : show.room ? ' with the room built' : show.spline ? ' with the Spline scene' : ''}. They can turn it, TAKE APART, SECTION and MEASURE it there.`;
      }
      const kv = ctx.env.SITES;
      if (!kv) throw new Error('keeping 3-D models needs the SITES KV namespace (wrangler.jsonc)');
      // Our own day's cap first, so nothing is drawn for a model that cannot be kept.
      await checkAllowance(kv);
      let bytes: ArrayBuffer;
      let drawn = '';
      if (ref) bytes = await pictureBytes(ref, kv);
      else {
        const ai = ctx.env.AI;
        if (!ai) throw new Error('drawing the picture first needs Workers AI; give a picture link instead');
        ctx.progress('drawing the object first…');
        let r: { image?: unknown } | null;
        try {
          r = (await ai.run(FLUX, { prompt: objectPrompt(prompt), steps: 4 })) as { image?: unknown } | null;
        } catch (e) {
          throw new Error(`the picture model did not answer: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
        }
        if (!r || typeof r.image !== 'string' || !r.image) throw new Error('the picture model returned nothing');
        bytes = fromBase64(r.image);
        // The drawing is kept like any picture Ghosty makes, so the owner sees what was modelled.
        try {
          const kept = await storeImage(kv, bytes, 'image/jpeg', { ttl: PICTURE_TTL_S, counter: PICTURE_COUNT, limit: PICTURES_PER_DAY, noun: 'picture', verb: 'made' });
          drawn = `${ctx.origin || ''}/i/${kept.id}`;
        } catch (e) {
          if (!(e instanceof LensError)) throw e;
        }
      }
      const title = arg.str(a, 'title', false).trim() || prompt.slice(0, 60) || 'From a picture';
      const token = await ctx.vault.get('huggingface').catch(() => null);
      try {
        const made = await makeModel({ fetch, token, progress: ctx.progress }, bytes);
        ctx.progress('keeping it…');
        const info = await keepModel(kv, made.glb, title, made.faces);
        ctx.emit({ t: 'client', name: 'open_studio', args: { model: info.id, title: info.title } });
        return `3-D model made${made.faces ? ` (${made.faces.toLocaleString('en-GB')} faces, untextured clay)` : ''} and opened in the 3D STUDIO tab, kept 24 hours${drawn ? `; drawn first from the picture ${drawn}` : ''}. Tell the owner in one line; they can turn it, TAKE APART, SECTION and MEASURE it there.`;
      } catch (e) {
        if (e instanceof Model3dError) throw new Error(`${e.message}${drawn ? ` (the picture was drawn: ${drawn})` : ''}`);
        throw e;
      }
    },
  },
];
