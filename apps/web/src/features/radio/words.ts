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
/** "25 min", "1 h 5 min", "2 hours": how long, short. */
export function inWords(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : h === 1 ? '1 hour' : `${h} hours`;
}
/** "Sleep timer: off" / "Goes quiet at 23:10 (in 30 min)". `now` is passed so the spec can read it at a fixed time. */
export function sleepLine(at: number, now: number): string {
  if (!at || at <= now) return 'Sleep timer: off. Pick when the radio should stop.';
  return `Goes quiet at ${hhmm(at)} (in ${inWords(at - now)}), then stops.`;
}
/** The end of this hour: the next o'clock (23:00 at 22:15), so the radio stops on the hour. */
export function endOfHour(now: number): number {
  const d = new Date(now);
  d.setMinutes(60, 0, 0);
  return d.getTime();
}
/** The next time the clock reads h:m (h 0–23; with no am or pm said, an h of 1–12 is whichever of morning or evening comes first). */
export function nextClock(h: number, m: number, now: number, half: '' | 'am' | 'pm' = ''): number {
  const hours = half === 'am' ? [h % 12] : half === 'pm' ? [(h % 12) + 12] : h >= 1 && h <= 12 ? [h % 12, (h % 12) + 12] : [h % 24];
  let best = 0;
  for (const hh of hours) {
    const d = new Date(now);
    d.setHours(hh, m, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    if (!best || d.getTime() < best) best = d.getTime();
  }
  return best;
}
/** The key for the end of this hour ("AT 23:00"). */
export const hourKey = (now: number) => `AT ${hhmm(endOfHour(now))}`;
/** The toast and the chat's line when he sets a time ("…goes quiet at 23:00 (in 45 min), then stops."). */
export const sleepAtSet = (at: number, now: number) => `Sleep timer set: the radio goes quiet at ${hhmm(at)} (in ${inWords(at - now)}), then stops.`;
/** After a reload: the radio stopped (the browser ends the sound) and its sleep timer went with it. Said once, honestly. */
export const lostLine = (at: number, name: string) => `The page reloaded, so ${name || 'the radio'} stopped and its sleep timer for ${hhmm(at)} went with it. Tap PLAY and set it again if you want it.`;
export const clockWords = hhmm;
export const SLEEP_OFF = 'TIMER OFF';
export const sleepKey = (min: number) => (min === 60 ? '1 HOUR' : `${min} MIN`);
/** The toast when he sets it. */
export const sleepSet = (min: number) => `Sleep timer set: the radio stops in ${min === 60 ? 'an hour' : `${min} minutes`}.`;

/** RECENT: what he played lately, kept on this phone. */
export const RECENT_EMPTY = { head: 'Nothing played yet', line: 'Stations you play show here, newest first.' };

/** FAVOURITES in his own order: the keys that move one up or down. */
export const REORDER = 'REORDER';
export const REORDER_DONE = 'DONE';
export const REORDER_NOTE = 'Move a station up or down. ⏭ and ⏮ on the lock screen, and “play my second favourite”, follow this order.';
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
/** "second" for 2 (past ten, "number 12"). */
export const ordinal = (n: number) => ORD[n - 1] ?? `number ${n}`;

/** NEAR ME: his country's most-listened stations; the country is his to change. */
export const NEAR_ME = 'POPULAR';
export const nearLabel = (country: string) => `popular in ${country === 'UK' || country === 'USA' ? `the ${country}` : country}`;
export const nearSet = (country: string) => `Near me is now ${country}: its stations come first.`;
