/**
 * WHEN HE WAS LAST HERE (BRIEF-OCT-IDEAS-2 3): the one stamp "WHAT DID I MISS?" measures its gap from, in the shape of THE SCAN's
 * ABSENCE_MS (features/core/scan/home.ts) but its own: the Scan's stamp is written only while its frame is on, and this one is
 * written on every leaving and every minute of an open, whatever screen he is on. `previousOpen` is read once, when this module
 * loads (main.ts imports it first), BEFORE this open writes its own stamp: it is the moment the open before this one last saw him.
 * Kept on this phone only; nothing of it is sent.
 */
export const OPEN_KEY = 'ghosty.lastopen';
/** An absence this long (ms) is a gap worth a card (the Scan's ABSENCE_MS is twenty minutes; "what did I miss" is for a day away). */
export const MISS_GAP_MS = 20 * 3_600_000;

const read = (): number => {
  try {
    const n = Number(localStorage.getItem(OPEN_KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

/** When the open before this one last saw him (ms; 0 on a first open ever). */
export const previousOpen: number = read();

const stamp = (): void => {
  try {
    localStorage.setItem(OPEN_KEY, String(Date.now()));
  } catch {
    /* no storage: no gap is ever measured */
  }
};

let started = false;
/** From now on this open keeps its stamp fresh: a minute at a time while it is on screen, and the moment it is left. */
export function keepStamp(): void {
  if (started) return;
  started = true;
  stamp();
  setInterval(() => !document.hidden && stamp(), 60_000);
  document.addEventListener('visibilitychange', () => document.hidden && stamp());
  addEventListener('pagehide', stamp);
}
