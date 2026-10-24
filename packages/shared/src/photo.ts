/**
 * PHOTO TOOLS, the part both halves share: the three jobs, their names for the owner, and the words
 * that ask for one ("remove the background", "make it sharper", "erase the bin"). The brain uses the
 * words to offer its photo_tool (tools/photo.ts); the Lens uses them to open the PHOTO TOOLS sheet
 * on the photo in hand instead of asking the chat. No job changes, finds or swaps a face.
 */

export type PhotoJob = 'background' | 'sharper' | 'erase';
export const PHOTO_JOBS: readonly PhotoJob[] = ['background', 'sharper', 'erase'];

/** Each job as a button and as a verb ("REMOVE THE BACKGROUND", "removing the background"). */
export const PHOTO_JOB_WORDS: Record<PhotoJob, { chip: string; run: string; doing: string }> = {
  background: { chip: 'REMOVE BACKGROUND', run: 'REMOVE THE BACKGROUND', doing: 'removing the background' },
  sharper: { chip: 'SHARPER', run: 'MAKE IT SHARPER', doing: 'making it sharper' },
  erase: { chip: 'ERASE', run: 'ERASE IT', doing: 'erasing it' },
};

/** A job by its name or a near one ("upscale", "remove_background", "inpaint"), else null. */
export function photoJobOf(name: string): PhotoJob | null {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (/^(background|removebackground|backgroundremoval|cutout|nobackground|rmbg)$/.test(n)) return 'background';
  if (/^(sharper|sharpen|upscale|enhance|superresolution|esrgan)$/.test(n)) return 'sharper';
  if (/^(erase|eraser|inpaint|remove|removeobject|lama)$/.test(n)) return 'erase';
  return null;
}

const BACKGROUND = /\b(?:remove|take (?:out|off|away)|get rid of|cut (?:out|away)|lose|delete|clear|drop)\b[\w\s']{0,16}\bbackground\b|\bbackground remov\w*|\bcut ?out\b|\btransparent background\b|\bno background\b|\bwithout (?:the|a|its) background\b/i;
const ERASE = /\b(?:eras(?:e|er|ing)|rub (?:it |that |this )?out|paint (?:it |that |this )?out|remove (?:the|that|this|those|these) [\w' -]{1,40} from (?:the|this|my|that) (?:photo|picture|image|pic))\b/i;
const SHARPER = /\b(?:sharper|sharpen\w*|upscal\w*|unblur\w*|deblur\w*|less blurry|higher resolution|hi-?res|enhance (?:it|this|that|the (?:photo|picture|image))|make (?:it|this|that) bigger|enlarge (?:it|this|that|the (?:photo|picture|image)))\b/i;

/** The job some words ask for (background first: "remove the background from my photo" is not an erase), else null. */
export function photoJobFor(text: string): PhotoJob | null {
  if (BACKGROUND.test(text)) return 'background';
  if (ERASE.test(text)) return 'erase';
  if (SHARPER.test(text)) return 'sharper';
  return null;
}

/** Any of the three, or the sheet by name: when the brain offers photo_tool. */
export const PHOTO_WORDS = new RegExp(`${BACKGROUND.source}|${ERASE.source}|${SHARPER.source}|\\bphoto tools?\\b`, 'i');
