/**
 * The 3D STUDIO's tool. make_3d turns a described object or a picture into a 3-D model and opens
 * it in the studio. A described object is handed to the studio (`open_studio {make}`), which looks
 * in the catalogue of real, freely licensed models first and only then asks the brain to make one:
 * searching thousands of models costs far more CPU than a Durable Object has on the free plan, and
 * the phone does it in a moment. With `fresh` (or a picture) the brain makes one here: drawn first
 * (Workers AI's FLUX, as make_picture) and made 3-D by the free makers on Hugging Face in turn
 * (model3d.ts `makeTextured`: TRELLIS.2 with the owner's free token, then Stable Fast 3D). With no
 * picture or words it just opens the studio (the interface's `open_studio` command) on a sample,
 * a model, a room built from measurements, or a Spline scene the owner pasted. One tool, not two:
 * every tool group's tool names are in every plain turn's prompt, which has a hard size budget.
 */
import { imageResponse, isImageId, LensError, PICTURE_TTL_S, PICTURES_PER_DAY, storeImage } from '../lens';
import { drawObject, objectPrompt } from '../gen3d';
import { keepModel, makeTextured, Model3dError, startAttempt } from '../model3d';
import { PICTURE_COUNT } from './pictures';
import { arg, type Tool } from './types';

export { objectPrompt };

/** The kept picture's id in a /i/<id> link or a bare id, else null. Ids may start or end with "-" or "_", so the
 * end of the id is "no further id character", not a word boundary (which a trailing "-" never has). */
export function pictureIdOf(ref: string): string | null {
  return ref.match(/\/i\/([A-Za-z0-9_-]{16})(?![A-Za-z0-9_-])/)?.[1] ?? (isImageId(ref.trim()) ? ref.trim() : null);
}

/** A picture Ghosty made or the owner shared (/i/<id> link or bare id), or a public picture address (also photo_tool's). */
export async function pictureBytes(ref: string, kv: NonNullable<Parameters<Tool['run']>[1]['env']['SITES']>): Promise<ArrayBuffer> {
  const id = pictureIdOf(ref);
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
      "3D STUDIO (turn, take apart, section, measure). `prompt` = ONE object in words: the studio opens a real CC0/CC BY model from its catalogue of thousands (furniture, everyday things) when one fits, else makes one; `fresh` true makes a new one here. `picture` (a /i/… link or https picture) → a model with its colours. Free, best effort (Hugging Face's Stable Fast 3D, TRELLIS.2 with a free Hugging Face token; a few a day); kept 24 h. With nothing to make it just opens the studio on `sample`, `room` (cm) or `spline` (a my.spline.design link the owner gave).",
    parameters: {
      type: 'object',
      properties: {
        picture: { type: 'string', description: 'the picture: a /i/<id> link or an https picture address' },
        prompt: { type: 'string', description: 'when there is no picture: the one object, in English' },
        fresh: { type: 'boolean', description: 'make a new model even when the catalogue has one' },
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
      // A real model beats a generated one: the studio looks in its catalogue first (on the phone), unless a new one was asked for.
      if (!ref && a.fresh !== true) {
        ctx.emit({ t: 'client', name: 'open_studio', args: { make: prompt.slice(0, 200) } });
        return `Opened the 3D STUDIO on "${prompt.slice(0, 80)}": it opens a real model from its catalogue when one fits (with its maker's credit), else makes one there (a picture first, then 3-D; usually under 2 minutes, up to about 5 when the free queue is long). Tell the owner in one line; if they want a new one made even so, call make_3d again with fresh: true.`;
      }
      if (!kv) throw new Error('keeping 3-D models needs the SITES KV namespace (wrangler.jsonc)');
      // Counted before anything is drawn or asked: a try that fails counts too.
      await startAttempt(kv);
      const token = await ctx.vault.get('huggingface').catch(() => null);
      let bytes: ArrayBuffer;
      let drawn = '';
      if (ref) bytes = await pictureBytes(ref, kv);
      else {
        let pic: Awaited<ReturnType<typeof drawObject>>;
        try {
          pic = await drawObject({ fetch, token, progress: ctx.progress, signal: AbortSignal.timeout(90_000), ai: ctx.env.AI }, prompt);
        } catch (e) {
          throw new Error(e instanceof Model3dError ? `${e.message} — give a picture link instead` : String((e as Error)?.message ?? e));
        }
        bytes = pic.bytes;
        // The drawing is kept like any picture Ghosty makes, so the owner sees what was modelled.
        try {
          const kept = await storeImage(kv, bytes, pic.type, { ttl: PICTURE_TTL_S, counter: PICTURE_COUNT, limit: PICTURES_PER_DAY, noun: 'picture', verb: 'made' });
          drawn = `${ctx.origin || ''}/i/${kept.id}`;
        } catch (e) {
          if (!(e instanceof LensError)) throw e;
        }
      }
      const title = arg.str(a, 'title', false).trim() || prompt.slice(0, 60) || 'From a picture';
      try {
        const made = await makeTextured({ fetch, token, progress: ctx.progress }, bytes);
        ctx.progress('keeping it…');
        const info = await keepModel(kv, made.glb, title, made.faces, Date.now(), made, true);
        ctx.emit({ t: 'client', name: 'open_studio', args: { model: info.id, title: info.title } });
        const what = [made.faces ? `${made.faces.toLocaleString('en-GB')} faces` : '', made.textured ? 'with its colours' : 'untextured clay'].filter(Boolean).join(', ');
        return `3-D model made (${what}) and opened in the 3D STUDIO tab, kept 24 hours. Made by ${made.maker} (free, on Hugging Face)${drawn ? `; drawn first from the picture ${drawn}` : ''}. Tell the owner in one line; they can turn it, TAKE APART, SECTION and MEASURE it there.`;
      } catch (e) {
        if (e instanceof Model3dError) throw new Error(`${e.message}${drawn ? ` (the picture was drawn: ${drawn})` : ''}`);
        throw e;
      }
    },
  },
];
