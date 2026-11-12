/**
 * THE VOICE MODEL, KEPT ON THE PHONE (STARS 171): the model that tells voices apart, a pack by the pack rule (offline/pack.ts): offered in
 * Settings with its size said before the tap, fetched only on his tap, on Wi-Fi, STOP at any moment, DELETE in one tap with UNDO. It is
 * this site's own /vendor files (no key, no cost, no other address). It shares the runtime and the cache with the Lens's packs
 * (ghosty-eyes-v1): what another pack holds already is not fetched again, and DELETE keeps what another still needs. What the phone's
 * own features can do alone stays as it is; this only makes it better, and is never needed.
 */
import { EYES_CACHE } from './eyes';
import { WORKER_RUNTIME } from './eyesfiles';
import { VOICE_MODEL_ROWS, VOICE_PACK_BYTES } from './speakerfiles';
import type { PackDef, PackFile } from './pack';

export const SPEAKER_PACK: PackDef = {
  id: 'voice-model',
  cache: EYES_CACHE,
  name: 'The voice model',
  what: 'Tells voices apart better than the phone’s own sound features: 27 MB of it is the model itself. Used only to know it is you, or someone you introduced. Never a lock, and never a name for a stranger.',
  licence: 'CC BY 4.0, a free model with no key (the licence file in public/vendor/speaker)',
  month: 'November 2026',
  bytes: VOICE_PACK_BYTES,
  parallel: 2,
  shared: true,
  plan: async (): Promise<PackFile[]> => [...WORKER_RUNTIME, ...VOICE_MODEL_ROWS].map(([url, bytes]) => ({ url, bytes })),
  note: 'Shares its runtime with the Lens’s packs: what is here already is not fetched again. Without it the phone still knows your voice, a little less well.',
};

/** Who wants to know when the pack is fetched or deleted (the engine forgets what it knew; the MY VOICE screen repaints). */
const listeners = new Set<() => void>();
export const onSpeakerPack = (f: () => void): void => void listeners.add(f);
/** Called by Settings after a GET or a DELETE of any pack: only this pack's id matters. */
export function packChanged(id: string): void {
  if (id === SPEAKER_PACK.id) listeners.forEach((f) => f());
}
