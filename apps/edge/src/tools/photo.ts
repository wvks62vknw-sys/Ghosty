/**
 * PHOTO TOOLS from the chat (and Telegram): photo_tool { job, picture, mask? } runs one of the three
 * jobs on a picture Ghosty already holds (/i/<id>) or a public https picture, on the brain (photo.ts:
 * free Hugging Face Spaces, never paid), keeps the result at /i/<id> for 10 years and opens the PHOTO
 * TOOLS sheet on the phone with before and after (the `open_photo_tools` client command). ERASE needs a
 * mask drawn with a finger, so without one it only opens the sheet on the picture. One tool, so the
 * plain-turn prompt (which names every group's tools) stays within its budget. Never for faces.
 *
 * Registered as its own keyword group in tools/index.ts (protected), like homeplan:
 *   import { photoTools, PHOTO_ABOUT, PHOTO_WHEN } from './photo'; // [photo]
 *   …, ...photoTools in CORE
 *   { name: 'photo', tools: photoTools, when: PHOTO_WHEN, about: PHOTO_ABOUT },
 */
import { isImageId, shareImage, LensError } from '../lens';
import { keepPhoto, PhotoError, runPhotoJob } from '../photo';
import { PHOTO_JOB_WORDS, PHOTO_WORDS, photoJobOf } from '../../../../packages/shared/src/photo';
import { pictureBytes, pictureIdOf } from './studio';
import { arg, type Tool } from './types';

/** When the photo group is offered: "remove the background", "make it sharper", "erase the bin", "photo tools". */
export const PHOTO_WHEN = PHOTO_WORDS;
export const PHOTO_ABOUT = 'You can edit a photo with free Hugging Face Spaces (photo_tool: background removed, sharper, or a thing erased; erase without a mask opens PHOTO TOOLS on the phone to draw over it). Never faces.';

const DONE = { background: 'Background removed', sharper: 'Made sharper (2× larger)', erase: 'Erased' } as const;

export const photoTools: Tool[] = [
  {
    name: 'photo_tool',
    description:
      'PHOTO TOOLS on `picture` (a /i/… link or https picture): `job` background (cut the background out), sharper (2× larger and sharper) or erase (remove what `mask` covers: a /i/… PNG, white = erase). Free Hugging Face Spaces, best effort; the result is kept 10 years at a /i/ link and opens on the phone with before and after. erase without a mask, or no picture, opens the PHOTO TOOLS sheet for the owner. No face editing.',
    parameters: {
      type: 'object',
      properties: {
        job: { type: 'string', enum: ['background', 'sharper', 'erase'] },
        picture: { type: 'string', description: 'a /i/<id> link or an https picture address' },
        mask: { type: 'string', description: 'erase only: a /i/<id> PNG of the same size, white where to erase' },
      },
      required: ['job'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const job = photoJobOf(arg.str(a, 'job'));
      if (!job) throw new Error('job must be background, sharper or erase');
      const ref = arg.str(a, 'picture', false).trim();
      const maskRef = arg.str(a, 'mask', false).trim();
      const kv = ctx.env.SITES;
      const id = ref ? pictureIdOf(ref) : null;
      // Nothing to work on here, or a mask still to draw: the sheet on the phone, on the picture when there is one.
      if (!ref || (job === 'erase' && !maskRef)) {
        let picture = id ? `/i/${id}` : '';
        if (ref && !id && kv) {
          // A picture from the web: the phone can only show Ghosty's own (its security policy), so a 24-hour copy, like a Lens share.
          try {
            picture = `/i/${(await shareImage(kv, await pictureBytes(ref, kv), 'image/jpeg')).id}`;
          } catch (e) {
            if (!(e instanceof LensError)) throw e;
          }
        }
        ctx.emit({ t: 'client', name: 'open_photo_tools', args: { job, ...(picture ? { picture } : {}) } });
        if (!picture) return `Opened PHOTO TOOLS on ${PHOTO_JOB_WORDS[job].chip}: the owner picks or takes the photo there. Tell them in one line.`;
        return job === 'erase'
          ? 'Opened PHOTO TOOLS on the picture: the owner draws over what to erase with a finger and presses ERASE IT (LaMa, free on Hugging Face). Tell them in one line.'
          : `Opened PHOTO TOOLS on the picture: the owner presses ${PHOTO_JOB_WORDS[job].run}. Tell them in one line.`;
      }
      if (!kv) throw new Error('keeping the result needs the SITES KV namespace (wrangler.jsonc)');
      const picture = await pictureBytes(ref, kv);
      let mask: ArrayBuffer | null = null;
      if (job === 'erase') {
        const mid = pictureIdOf(maskRef);
        if (!mid || !isImageId(mid)) throw new Error('the mask must be one of Ghosty’s own /i/… pictures (the PHOTO TOOLS sheet makes it)');
        mask = await pictureBytes(mid, kv);
      }
      const token = await ctx.vault.get('huggingface').catch(() => null);
      try {
        const done = await runPhotoJob({ fetch, token, progress: ctx.progress }, job, picture, mask);
        ctx.progress('keeping it…');
        const kept = await keepPhoto(kv, done);
        ctx.emit({ t: 'client', name: 'open_photo_tools', args: { job, ...(id ? { picture: `/i/${id}` } : {}), result: `/i/${kept.id}`, by: done.by } });
        return `${DONE[job]}: ${ctx.origin || ''}/i/${kept.id} — kept 10 years; opened on the phone with before and after (SAVE TO PHOTOS, SHARE). Made by ${done.credit}. Tell the owner in one line and give the link.`;
      } catch (e) {
        if (e instanceof PhotoError) throw new Error(e.message);
        throw e;
      }
    },
  },
];
