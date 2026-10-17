/**
 * Pictures Ghosty makes: a description → an image from Workers AI's flux-1-schnell (free, no
 * key, a few seconds), kept for a week in the SITES KV namespace under the same /i/<id>
 * address the Lens uses for shared crops (lens.ts). The chat shows the picture itself,
 * Telegram sends it as a photo, and anyone with the link can open it. 40 a day.
 */
import { LensError, PICTURE_TTL_S, PICTURES_PER_DAY, storeImage } from '../lens';
import { fromBase64 } from '../speech';
import { arg, type Tool } from './types';

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
/** Pictures made are counted apart from Lens shares (`img:count:`). */
export const PICTURE_COUNT = 'pic:count:';

export const picturesTools: Tool[] = [
  {
    name: 'make_picture',
    description:
      "Make a picture — an illustration, artwork, logo, poster, wallpaper, sketch or photo-like render — from a description. Write the prompt yourself as one full English description of the scene: subject, setting, style, lighting, colours, composition, mood (the owner's few words are not enough). Takes a few seconds; the picture is kept 7 days at a link the chat shows as the picture itself and Telegram sends as a photo. Free, about 40 a day. Never a real person's likeness.",
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'what to draw, in full (up to 600 characters)' },
        steps: { type: 'number', description: 'detail: 1 to 8, default 4 (more is slower)' },
      },
      required: ['prompt'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const prompt = arg.str(a, 'prompt').trim().slice(0, 600);
      const steps = Math.max(1, Math.min(8, Math.round(arg.num(a, 'steps', 4))));
      const ai = ctx.env.AI;
      if (!ai) throw new Error('Pictures need Workers AI (free, always there once Ghosty is on Cloudflare)');
      const kv = ctx.env.SITES;
      if (!kv) throw new Error('keeping a picture needs the SITES KV namespace (wrangler.jsonc)');
      ctx.progress('drawing…');
      let r: { image?: unknown } | null;
      try {
        r = (await ai.run(MODEL, { prompt, steps })) as { image?: unknown } | null;
      } catch (e) {
        throw new Error(`the picture model did not answer: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
      }
      if (!r || typeof r.image !== 'string' || !r.image) throw new Error('the picture model returned nothing');
      ctx.progress('keeping it…');
      let kept: { id: string };
      try {
        kept = await storeImage(kv, fromBase64(r.image), 'image/jpeg', { ttl: PICTURE_TTL_S, counter: PICTURE_COUNT, limit: PICTURES_PER_DAY, noun: 'picture', verb: 'made' });
      } catch (e) {
        if (e instanceof LensError && e.status === 415) throw new Error('the picture model returned something that is not a picture');
        throw e;
      }
      return `Picture made: ${ctx.origin || ''}/i/${kept.id} (kept 7 days). Tell the owner what it shows in one line and give them the link.`;
    },
  },
];
