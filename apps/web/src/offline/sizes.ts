/**
 * The second size of the Lens's eyes (BRIEF-PHONE-HARDWARE, item 2): where a larger model of the same job exists on this site, it is a
 * pack of its own beside the standard one in OFFLINE EYES ("larger, N MB, for a newer phone"), fetched only on his tap on Wi-Fi with
 * the size said, and used by itself only when the phone reports what it needs (offline/capability.ts) or when he chose it.
 *
 * LARGER is empty: no larger free, licence-clear model is vendored on this site, and none was made for this pass (a model cannot be
 * judged without a phone to run it on). Each entry is `{ of, pack, need }`: the standard pack it stands beside, the pack of files
 * (the parts split under the host's 25 MiB per-file limit, as the depth model is), and what it asks of the phone. Adding a row here
 * is all it takes for the panel to offer it; the choice and its fallback are built and tested with a stand-in
 * (`window.__ghostyEyesLarger`, tests only).
 */
import { chooseSize, LARGER_NEED, type Caps, type Need, type SizeChoice } from './capability';
import { EYES_CACHE } from './eyes';
import type { PackDef } from './pack';

export interface Larger {
  /** The standard pack's id (eyes-lens, eyes-name, eyes-people, eyes-measure). */
  of: string;
  pack: PackDef;
  need?: Need;
}

export const LARGER: Larger[] = [];

/** The sizes on offer: the real ones, plus a stand-in a test puts on the window as [[of, name, bytes, urls]]. */
export function largerList(): Larger[] {
  const t = (globalThis as { __ghostyEyesLarger?: [string, string, number, string[]][] }).__ghostyEyesLarger;
  if (!t) return LARGER;
  return t.map(([of, name, bytes, urls]) => ({
    of,
    need: LARGER_NEED,
    pack: { id: `${of}-large`, cache: EYES_CACHE, name, what: 'The same job with a larger model, for a newer phone.', licence: 'Stand-in for a test', month: 'November 2026', bytes, parallel: 2, shared: true, plan: async () => urls.map((url) => ({ url, bytes: Math.round(bytes / urls.length) })) },
  }));
}

const key = (of: string) => `ghosty.eyessize.${of}`;
export function sizeChoice(of: string): SizeChoice {
  try {
    const v = localStorage.getItem(key(of));
    return v === 'standard' || v === 'larger' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
export function setSizeChoice(of: string, v: SizeChoice): void {
  try {
    if (v === 'auto') localStorage.removeItem(key(of));
    else localStorage.setItem(key(of), v);
  } catch {
    /* blocked: the choice lasts until the page closes */
  }
}

/** The size a loader should use for the standard pack `of`: `larger` only when chosen (by hand or by the phone) and on the phone. */
export function sizeInUse(of: string, caps: Caps, hereLarger: boolean): { size: 'standard' | 'larger'; why: string } {
  const l = largerList().find((x) => x.of === of);
  return chooseSize(sizeChoice(of), caps, l ? { here: hereLarger, need: l.need } : null);
}
