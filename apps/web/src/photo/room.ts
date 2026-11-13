/**
 * THE PHOTO STORE'S ROOM (BRIEF-EDITOR-PHOTO), pure: ten originals at full size at most and about 150 megabytes, the oldest let go first,
 * and `room()` says it in his words before anything goes. photo/store.ts keeps the photos; this file only decides and says.
 */
export const MAX_PHOTOS = 10;
export const MAX_BYTES = 150_000_000;

export interface Kept {
  id: string;
  name: string;
  /** When it was last edited (ms). */
  at: number;
  /** The original's bytes. */
  bytes: number;
}

export const megabytes = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1).replace(/\.0$/, '')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export interface Room {
  /** True when the photo fits with nothing let go. */
  fits: boolean;
  /** The photos that would go, oldest first. */
  drop: Kept[];
  /** True when even an empty store could not hold it. */
  tooBig: boolean;
  words: string;
}

/** What it takes to keep one more photo of `incoming` bytes next to `kept`, and what it says. */
export function room(kept: Kept[], incoming: number): Room {
  if (incoming > MAX_BYTES) return { fits: false, drop: [], tooBig: true, words: `This photo is ${megabytes(incoming)}: more than I can keep (${megabytes(MAX_BYTES)} at most). Nothing is lost; it just cannot be edited here.` };
  const byAge = [...kept].sort((a, b) => a.at - b.at);
  const drop: Kept[] = [];
  let count = kept.length;
  let bytes = kept.reduce((n, k) => n + k.bytes, 0);
  while ((count + 1 > MAX_PHOTOS || bytes + incoming > MAX_BYTES) && byAge.length) {
    const g = byAge.shift()!;
    drop.push(g);
    count--;
    bytes -= g.bytes;
  }
  if (!drop.length) {
    const left = MAX_PHOTOS - kept.length - 1;
    const used = kept.reduce((n, k) => n + k.bytes, 0) + incoming;
    return { fits: true, drop, tooBig: false, words: left > 0 ? `Room for ${left} more photo${left === 1 ? '' : 's'} (${megabytes(MAX_BYTES - used)} left).` : `That is the last place I have: the next one lets the oldest go (${megabytes(MAX_BYTES - used)} left).` };
  }
  const names = drop.map((d) => `“${d.name}”`);
  const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return { fits: false, drop, tooBig: false, words: `I am full: I keep ${MAX_PHOTOS} photos or ${megabytes(MAX_BYTES)}. To keep this one, ${who} ${drop.length === 1 ? 'goes' : 'go'}, the oldest. Your own camera roll still has ${drop.length === 1 ? 'it' : 'them'}; I only lose my edit${drop.length === 1 ? '' : 's'}.` };
}
