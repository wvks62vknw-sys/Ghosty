/**
 * HAS THIS PASSWORD LEAKED? (security.s2): the password's SHA-1 fingerprint is made on this phone; only its first five characters
 * go to the brain, which asks the free public list of leaked passwords for every fingerprint starting that way. The rest is
 * compared here. The password and its whole fingerprint never leave the phone, and nothing is kept.
 */
export async function sha1Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** How many leaks the list counts for this fingerprint (0: not in it). `list` is the range's "REST:COUNT" lines. */
export function leakCount(fingerprint: string, list: string): number {
  const rest = fingerprint.slice(5).toUpperCase();
  for (const line of list.split(/\r?\n/)) {
    const [r, n] = line.trim().split(':');
    if (r === rest) return Number(n) || 0;
  }
  return 0;
}

/** What the check says, in his words. */
export function leakWords(n: number): string {
  if (n > 0) return `Found in the public list of leaked passwords ${n.toLocaleString('en-GB')} time${n === 1 ? '' : 's'}. Change it everywhere you use it, and never use it again.`;
  return 'Not in the public list of leaked passwords. That alone does not make it strong: a long, random one, different for each place, is what keeps you safe.';
}
