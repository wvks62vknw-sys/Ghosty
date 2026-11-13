/**
 * THE 3D STUDIO'S WORDS (BRIEF-QUALITY-MAKE): the lines the studio says in his voice, in one place and with no DOM, so the spec reads the
 * very words the page is built from. A licence's name is the licence's own name; nothing else on a card is renamed.
 */

/** The first open, said once: three.js comes in, then the first scene. */
export const LOADING = 'Loading the studio…';

/** A model's size where the card knows it (kilobytes): "800 KB", "2.4 MB"; null when it is not known until it is packed. */
export function sizeWords(kb: number): string | null {
  if (!(kb > 0)) return null;
  return kb < 1000 ? `${Math.round(kb)} KB` : `${(kb / 1000).toFixed(1)} MB`;
}

/** A model's fetch, with its size when the card knows it: "Fetching “Oak chair”, 2.4 MB…". */
export function fetchWords(name: string, kb: number): string {
  const size = sizeWords(kb);
  return `Fetching “${name}”${size ? `, ${size}` : ''}…`;
}

/** A card's credit and licence in one plain line: the author, then the licence's own name. */
export const cardCredit = (it: { author: string; licence: string }): string => `by ${it.author} · ${it.licence}`;

/** A search that found nothing: what was typed, and what to try. */
export function noHitWords(q: string, shelf = ''): string {
  const said = q.trim().replace(/\s+/g, ' ').slice(0, 28);
  return `I can’t find “${said}”${shelf ? ` on the ${shelf} shelf` : ''}. Try a plainer word, like “chair”${shelf ? ', or pick EVERY SHELF' : ''}. MAKE · PHOTO can make one.`;
}

/** The catalogue could not be read at all: no signal, or its list would not come. */
export const CATALOGUE_DOWN = 'I can’t open the catalogue just now. The samples below still work. Try again in a moment.';
export const CATALOGUE_OFFLINE = 'No signal, so I can’t open the catalogue. The samples below still work.';

/** A model that will not open, in his words, with the card's way out (TRY AGAIN, and its own page). */
export function openFailWords(name: string, why: string): string {
  return `I couldn’t open “${name}”. ${why}`;
}
export const OPEN_FAIL_TRY = 'TRY AGAIN';

/** This phone cannot draw 3-D (no WebGL): said without the word. */
export const NO_3D = 'I can’t draw 3-D on this phone right now. Close other apps, then open the studio again.';

/** MAKE · PHOTO with no photo chosen yet: the one next thing. */
export const NO_PHOTO = 'No photo yet. Choose one, then tap MAKE 3-D.';

/** MAKE · PHOTO and MAKE ANYTHING, said in a line each; the rest folds under "How it works". */
export const MAKE_NOTE = 'Type one thing. I open a real model if the catalogue has a good one, or a free maker draws it in 3-D.';
export const PHOTO_NOTE = 'A photo of one object works best. I take the background out and make a model with its colours.';
export const MAKE_MORE = [
  'A few a day are free. A free Hugging Face account’s token in System, then Keys, gives more; a token from an account that can pay is never used, so nothing is ever charged.',
  'If the makers are busy, you get a simple stand-in at once, and I say why.',
  'Made models are kept 24 hours on my brain and, after that, on this phone.',
];

/** The two long waits, said in a breath: what is happening, how long, what to do. */
export const MAKE_WAIT = 'Nothing real by that name, so I’m making one: a picture first, then 3-D. About two minutes, sometimes five. Keep Ghosty open.';
export const PHOTO_WAIT = 'Sending the photo. About a minute, sometimes five. Keep Ghosty open.';
export const PHOTO_OFFLINE = 'No signal, so I can’t make it. Your photo stays here for when you have one.';

/** VIEW (FINAL ROUND, MAKE lane): the three ways the studio draws a model, as every 3-D app offers them, and what each is for. */
export const SHADINGS: ['solid' | 'wire' | 'xray', string][] = [['solid', 'SOLID'], ['wire', 'WIREFRAME'], ['xray', 'X-RAY']];
export const SHADING_NOTE: Record<'solid' | 'wire' | 'xray', string> = {
  solid: 'Solid: the model as it was made, its colours and its light.',
  wire: 'Wireframe: every triangle as a line, to see how it is built.',
  xray: 'X-ray: see-through, so the parts inside show.',
};
