/** THE RADIO's words, pure (the spec imports this file): the wait while a station tunes in, the wait while the list is found, and the way on from a dead station. */
export const TUNING = 'Tuning…';
export const FINDING = 'Finding stations…';
export const TRY_ANOTHER = 'TRY ANOTHER';
export const NO_OTHER = 'There is no other station in the list. Search for one above.';

/** The station after the dead one in the list (the first one when it is not in it); null when there is no other. */
export function nextStation<T extends { url: string }>(list: readonly T[], current: string | undefined): T | null {
  const seen = new Set<string>();
  const uniq = list.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  const others = uniq.filter((s) => s.url !== current);
  if (!others.length) return null;
  const at = uniq.findIndex((s) => s.url === current);
  if (at < 0) return others[0]!;
  return uniq.slice(at + 1).find((s) => s.url !== current) ?? others[0]!;
}
