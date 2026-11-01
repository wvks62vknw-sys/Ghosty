/**
 * THE FIRST RUN on a fresh deployment (BRIEF-REST-B part 4; docs/DEPLOY-YOUR-OWN.md): when the brain says it has no owner
 * yet (`/api/health` secured: false), a short wizard makes the owner KEY on this phone, shows the key's fingerprint to put in
 * Cloudflare as OWNER_KEY_HASH (the key itself is never sent anywhere), pairs this phone with the pairing code the app
 * already has (api/brain.ts ownerKey, brain.status), names the owner, saves Home, and says three things to try. Nothing of
 * the first owner is carried over: the brain it signs in to is empty, and the first owner's key is not in it.
 * This file is the pure part — the steps as a state machine, the key, its fingerprint — and apps/edge/test/restb.test.mjs runs
 * it; firstrunui.ts draws it.
 */

export type Step = 'welcome' | 'key' | 'name' | 'home' | 'try' | 'done';
export const STEPS: Step[] = ['welcome', 'key', 'name', 'home', 'try', 'done'];

/** What the wizard has so far. The key is kept (on this phone only) until it is paired, so a reload in the dashboard does not lose it. */
export interface FirstRun {
  v: 1;
  step: Step;
  /** The key, once made (until it is paired: then it is the app's owner key, and this copy is cleared). */
  key: string;
  /** Its SHA-256, the value for OWNER_KEY_HASH. */
  hash: string;
  paired: boolean;
  name: string;
  home: boolean;
}

export const newFirstRun = (): FirstRun => ({ v: 1, step: 'welcome', key: '', hash: '', paired: false, name: '', home: false });

/** The variable the Worker reads the owner's fingerprint from (apps/edge/src/kernel/auth.ts). */
export const HASH_VARIABLE = 'OWNER_KEY_HASH';

/** The brain accepts keys of 24 to 256 characters (kernel/auth.ts). */
export const validKey = (k: string): boolean => k.length >= 24 && k.length <= 256 && !/\s/.test(k);

/** Letters and digits with nothing that looks like another (no 0 O 1 l I). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A key of 32 characters (about 158 bits) from random bytes: bytes that would make some characters likelier are thrown away. */
export function makeKey(random: (n: number) => Uint8Array): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < 32) for (const b of random(32)) if (b < limit && out.length < 32) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** SHA-256 of a string, as the lower-case hex the brain compares (kernel/auth.ts sha256Hex). */
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Does this brain say it has no owner yet? (A preview of a proposed change, or one behind Cloudflare Access, is never first-run.) */
export const needsFirstRun = (health: { secured?: boolean; access?: boolean; preview?: boolean } | null | undefined): boolean => !!health && health.secured === false && !health.access && !health.preview;

export type Event =
  | { t: 'start' }
  | { t: 'back' }
  | { t: 'made'; key: string; hash: string }
  | { t: 'paired' }
  | { t: 'named'; name: string }
  | { t: 'skipName' }
  | { t: 'homed' }
  | { t: 'skipHome' }
  | { t: 'finish' };

/** One step of the wizard: the new state, or the same one and why not. */
export function advance(s: FirstRun, e: Event): { state: FirstRun; error?: string } {
  const no = (error: string) => ({ state: s, error });
  switch (e.t) {
    case 'start':
      return s.step === 'welcome' ? { state: { ...s, step: 'key' } } : no('already started');
    case 'back':
      // only before there is a key in play: a made key is not thrown away by a back button
      return s.step === 'key' && !s.key && !s.paired ? { state: { ...s, step: 'welcome' } } : no('cannot go back from here');
    case 'made':
      if (s.step !== 'key') return no('the key is made on the key step');
      if (s.paired) return no('this phone is already paired');
      if (!validKey(e.key)) return no('that is not a key the brain would accept (24 to 256 characters, no spaces)');
      if (!/^[0-9a-f]{64}$/.test(e.hash)) return no('its fingerprint is not a SHA-256');
      return { state: { ...s, key: e.key, hash: e.hash } };
    case 'paired':
      if (s.step !== 'key') return no('pairing happens on the key step');
      if (!validKey(s.key) || !s.hash) return no('there is no key to pair with yet');
      return { state: { ...s, step: 'name', paired: true, key: '' } };
    case 'named': {
      if (s.step !== 'name' || !s.paired) return no('this phone is not paired yet');
      const name = e.name.trim().replace(/\s+/g, ' ');
      return name && name.length <= 60 ? { state: { ...s, step: 'home', name } } : no('a name of 1 to 60 characters');
    }
    case 'skipName':
      return s.step === 'name' && s.paired ? { state: { ...s, step: 'home' } } : no('this phone is not paired yet');
    case 'homed':
      return s.step === 'home' && s.paired ? { state: { ...s, step: 'try', home: true } } : no('not at the home step');
    case 'skipHome':
      return s.step === 'home' && s.paired ? { state: { ...s, step: 'try' } } : no('not at the home step');
    case 'finish':
      return s.step === 'try' && s.paired ? { state: { ...s, step: 'done' } } : no('not at the last step');
  }
}

/** The three things to try, in his voice (the wizard's last screen). */
export const THREE_THINGS: string[] = [
  'Say or type “what can you do?” — I answer that on your phone, with nothing to set up.',
  'Open the Everything tab and tap anything in it: each has a plain explanation and a TRY IT.',
  'Tell me one thing to remember about you, like “I take the 8:15 bus”: I keep it, and you can read or delete it in Memory.',
];

/** Where the wizard's progress is kept on this phone (the key only until it is paired). */
export const STORE_KEY = 'ghosty.setup.progress';

export function parseFirstRun(raw: unknown): FirstRun {
  const s = raw as Partial<FirstRun> | null;
  if (!s || s.v !== 1 || !STEPS.includes(s.step as Step)) return newFirstRun();
  return { ...newFirstRun(), ...s, key: typeof s.key === 'string' ? s.key : '', hash: typeof s.hash === 'string' ? s.hash : '' } as FirstRun;
}
export function loadFirstRun(): FirstRun {
  try {
    return parseFirstRun(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'));
  } catch {
    return newFirstRun();
  }
}
export function saveFirstRun(s: FirstRun): void {
  try {
    if (s.step === 'done') localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* no storage: the wizard carries on from memory */
  }
}
