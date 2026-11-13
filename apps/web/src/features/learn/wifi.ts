/**
 * Downloads only on his tap, on Wi-Fi, with the size said (his standing rule). Where the phone cannot tell Wi-Fi from mobile
 * data (the iPhone's browser has no network information), the first tap only says so, with the size, and a second tap within
 * 20 seconds is his yes to fetch it now (13 Nov, the learn lane: the library's books and the arcade's games).
 */
export const netUnknown = (): boolean => typeof navigator !== 'undefined' && !('connection' in navigator);

export const unknownNet = (size: string): string => `I can’t tell Wi-Fi from mobile data on this phone: tap again to fetch it now (${size}), or wait until you’re on Wi-Fi.`;

const armed = new Map<string, number>();
/** True when this is his second tap on the same download within 20 s (his yes); the first tap arms it and returns false. */
export function secondTap(id: string, now = Date.now()): boolean {
  const at = armed.get(id);
  if (at && now - at < 20_000) {
    armed.delete(id);
    return true;
  }
  armed.set(id, now);
  return false;
}
