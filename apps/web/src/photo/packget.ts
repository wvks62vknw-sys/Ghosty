/**
 * GET, INSIDE PHOTO (BRIEF-EDITOR-PHOTO-2): the pack rule (offline/pack.ts) for the three downloads the photo editor offers (the cut-out
 * model, the erase model, the RAW reader), run from the tool that needs it rather than from Settings: the size said first (the caller
 * says it), fetched only on his tap, on Wi-Fi (on mobile data it waits and says so; with no signal at all it waits and says so),
 * progress with the bytes, STOP at any time, carried on from the files already here. What he gets here is the same pack Settings →
 * offline eyes lists, so REMOVE there frees it.
 */
import { EYES_CUTOUT, EYES_ERASE, EYES_RAW, eyesHere } from '../offline/eyes';
import { getPack, gettingWords, mobileWords, offMobileData, offline, onMobileData, progressLine, sizeSaid, sizeWords, type GetProgress, type PackDef } from '../offline/pack';

export type PhotoPackId = 'cutout' | 'erase' | 'raw';
export const PHOTO_PACKS: Record<PhotoPackId, PackDef> = { cutout: EYES_CUTOUT, erase: EYES_ERASE, raw: EYES_RAW };

/** The size as he reads it ("19 MB"), for the lines that offer a pack. */
export const packSize = (id: PhotoPackId): string => sizeWords(PHOTO_PACKS[id].bytes);
export const packHere = (id: PhotoPackId): Promise<boolean> => eyesHere(PHOTO_PACKS[id]);

/** The words when there is no signal at all: GET waits for it. */
export const noSignalWords = (p: PackDef): string => `No signal right now, and ${p.name} is ${sizeSaid(p)}: GET waits for Wi-Fi and starts by itself when it is back.`;

/** Wait for the browser to say it is online again (or for STOP). */
function backOnline(signal?: AbortSignal): Promise<void> {
  return new Promise((ok, bad) => {
    if (!offline()) return ok();
    const done = () => {
      window.removeEventListener('online', done);
      signal?.removeEventListener('abort', stop);
      ok();
    };
    const stop = () => {
      window.removeEventListener('online', done);
      bad(Object.assign(new Error('stopped'), { name: 'AbortError' }));
    };
    window.addEventListener('online', done);
    signal?.addEventListener('abort', stop, { once: true });
  });
}

/**
 * GET the pack. `say` hears each line (no signal, mobile data, getting, "piece 2 of 5 · 20 MB of 70 MB") and the fraction done.
 * Throws the pack rule's plain words when it cannot go on; a stopped one throws an AbortError and what is stored stays.
 */
export async function getPhotoPack(id: PhotoPackId, say: (line: string, frac: number) => void, signal?: AbortSignal): Promise<void> {
  const p = PHOTO_PACKS[id];
  if (offline()) {
    say(noSignalWords(p), 0);
    await backOnline(signal);
  }
  if (onMobileData()) {
    say(mobileWords(p), 0);
    await offMobileData(signal);
    if (signal?.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
  }
  say(gettingWords(p), 0);
  await getPack(p, (x: GetProgress) => say(progressLine(x.piece, x.of, x.got, x.total), x.total ? Math.min(1, x.got / x.total) : 0), signal);
}
