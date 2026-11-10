/**
 * THE LENS'S EYES, OFFLINE (BRIEF-OFFLINE-1, AUDIT-8-NOV item 6): the files the Lens loads from this site (public/vendor), kept on the
 * phone on his tap by the pack rule (offline/pack.ts), in four packs with their sizes said first: THE LENS'S EYES (the vision runtime,
 * the object finder, the scene classifier, the hand recogniser, the reader of printed words and the barcode reader), THE NAMER (what
 * says what things look like), PEOPLE HE KNOWS (the two face models: his own face and the people he introduces, never a stranger;
 * their numbers stay on the phone as they do now) and MEASURE'S DISTANCE (the model that says how far everything in a photo is).
 *
 * Every file is this site's own, at the size pinned here; a pure check in tests/offlineeyes.spec.mjs holds the pins to the files. They
 * are kept in `ghosty-eyes-v1`, which the service worker never clears and which it reads before the network (public/sw.js), so the
 * Lens loads them as it always did, with no signal. Models that read a camera frame run on the phone and nothing about what they see
 * leaves it; what needs the brain or a web service (asking about a picture, a plant, bird or insect name, a meal's contents) cannot
 * run on the phone, and the panel says so (CANNOT).
 *
 * A pack here marks the steps the Lens takes by itself on a phone that has fetched them (his tap on GET THE EYES, on GET THE NAMER),
 * so the next time the Lens opens it loads them from the pack without a signal.
 */
import { DEPTH, FACES, FINDER, CODES, NAMER, READING, RUNTIME, WORKER_RUNTIME, sum, type Row } from './eyesfiles';
import { fromPack, getPack, isHere, keptAll, type PackDef, type PackFile } from './pack';

export const EYES_CACHE = 'ghosty-eyes-v1';

const files = (rows: Row[]): PackFile[] => rows.map(([url, bytes]) => ({ url, bytes }));

const pack = (id: string, name: string, what: string, licence: string, rows: Row[][], note?: string): PackDef => {
  const list = rows.flat();
  return { id, cache: EYES_CACHE, name, what, licence, month: 'November 2026', bytes: sum(...rows), parallel: 2, shared: true, plan: async () => files(list), note };
};

/** The Lens's own reading: what the one view needs to find things, read words and read codes with no signal. */
export const EYES_LENS = pack(
  'eyes-lens',
  'The Lens’s eyes',
  'Finds everyday things, hands and scenes; reads printed words and QR codes and barcodes. All on the phone.',
  'Apache-2.0 and MIT (public/vendor/VISION.md)',
  [RUNTIME, FINDER, READING, CODES],
);
export const EYES_NAMER = pack(
  'eyes-name',
  'The namer',
  'Says what things look like, from a list of 4,600 everyday names. MORE NAMES (another 28,000) needs a signal the first time.',
  'Research and non-commercial use only: his own private assistant (the licence files in public/vendor/clip); the runtime is MIT',
  [WORKER_RUNTIME, NAMER],
);
export const EYES_PEOPLE = pack(
  'eyes-people',
  'People he knows',
  'Finds a face and knows his own and the people he introduces, in person. Their numbers stay on this phone; nobody else is ever named.',
  'Apache-2.0 (the licence files in public/vendor/faces)',
  [RUNTIME, WORKER_RUNTIME, FACES],
  'Shares the vision runtime and the worker runtime with the other packs: what is here already is not fetched again.',
);
export const EYES_MEASURE = pack(
  'eyes-measure',
  'Measure’s distance',
  'Says how far everything in a photo is, so MEASURE can set its own scale.',
  'The licence is stated in public/vendor/depth/README.md',
  [WORKER_RUNTIME, DEPTH],
);

export const EYES_PACKS: PackDef[] = [EYES_LENS, EYES_NAMER, EYES_PEOPLE, EYES_MEASURE];

/** What the Lens cannot do on the phone, said plainly in the panel (never pretended). */
export const CANNOT =
  'Needs a signal, and says so: ASK about a picture, the plant, bird and insect names, a meal’s contents, and translating a sign unless the offline brain is on this phone.';

/** The two keys the Lens keeps once a step has started on this phone (features/lens/one.ts): from then on it loads that step by itself. */
export const HEAVY_FLAG = 'ghosty.lens.heavy';
export const NAMER_FLAG = 'ghosty.lens.namer';

/** Whether a pack's record is on this phone (a quick look at the record; the panel checks the files themselves). */
export const eyesKept = (id: string): boolean => !!keptAll()[id];

/** After a GET: the Lens's steps this pack covers are on the phone now, as if he had tapped them there. */
export function markLens(id: string): void {
  try {
    if (id === EYES_LENS.id) localStorage.setItem(HEAVY_FLAG, '1');
    if (id === EYES_NAMER.id) localStorage.setItem(NAMER_FLAG, '1');
  } catch {
    /* blocked: the Lens asks for its own tap as it did */
  }
}

export const getEyes = (p: PackDef, onProgress?: Parameters<typeof getPack>[1], signal?: AbortSignal): Promise<void> => getPack(p, onProgress, signal);
export const eyesHere = (p: PackDef): Promise<boolean> => isHere(p);
/** A model file as the pack keeps it (the Lens's loader asks here before the network). */
export const kept = (url: string): Promise<Response | undefined> => fromPack(EYES_CACHE, url);
