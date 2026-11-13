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

/** THE SLEEP TIMER's choices, in minutes (a 44 pt key each), and its line in his words. */
export const SLEEP_CHOICES = [15, 30, 45, 60, 90] as const;
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** "Sleep timer: off" / "Goes quiet at 23:10 (in 30 min)". `now` is passed so the spec can read it at a fixed time. */
export function sleepLine(at: number, now: number): string {
  if (!at || at <= now) return 'Sleep timer: off. Pick when the radio should stop.';
  const m = Math.max(1, Math.round((at - now) / 60_000));
  return `Goes quiet at ${hhmm(at)} (in ${m} min), then stops.`;
}
export const SLEEP_OFF = 'TIMER OFF';
export const sleepKey = (min: number) => (min === 60 ? '1 HOUR' : `${min} MIN`);
/** The toast when he sets it. */
export const sleepSet = (min: number) => `Sleep timer set: the radio stops in ${min === 60 ? 'an hour' : `${min} minutes`}.`;

/** RECENT: what he played lately, kept on this phone. */
export const RECENT_EMPTY = { head: 'Nothing played yet', line: 'Stations you play show here, newest first.' };
