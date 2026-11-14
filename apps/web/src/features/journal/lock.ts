/**
 * JOURNAL's lock: a passkey made on this phone (Face ID or Touch ID through the platform authenticator), asked for each time the journal
 * opens. Nothing leaves the phone: the passkey is the phone's own, and its id is all the journal keeps. Where the phone cannot make one,
 * the lock says so and stays off.
 */
const b64 = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export const canLock = (): boolean => typeof PublicKeyCredential !== 'undefined' && !!navigator.credentials?.create;

/** Make the passkey: its id, or null (cancelled, or the phone cannot). */
export async function makeKey(): Promise<string | null> {
  if (!canLock()) return null;
  try {
    const c = (await navigator.credentials.create({
      publicKey: {
        challenge: rnd(32),
        rp: { name: 'Ghosty journal', id: location.hostname },
        user: { id: rnd(16), name: 'journal', displayName: 'Your journal' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return c ? b64(c.rawId) : null;
  } catch {
    return null;
  }
}

/** Ask for it: true when Face ID / Touch ID (or the phone's passcode) said yes. */
export async function unlock(id: string): Promise<boolean> {
  if (!canLock()) return false;
  try {
    const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(id) as BufferSource }], userVerification: 'required', timeout: 60_000 } });
    return !!a;
  } catch {
    return false;
  }
}
