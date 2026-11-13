/**
 * THE MARKETS' words, pure (the spec imports this file): a price is never bare, it has the time it was read and, when it is old,
 * how old; a panel with nothing says what it is waiting for and offers RETRY; a gold or currency row not read yet says so.
 */
export const clockOf = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** How old a reading is, as he says it: "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function ageWords(at: number, now: number): string {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(m / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const d = Math.floor(hrs / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** The time a price was read: "As of 14:02." while it is current, "As of 14:02, 12 minutes ago." when it is not. */
export const asOfLine = (at: number, now: number, live: boolean): string => `As of ${clockOf(at)}${live ? '' : `, ${ageWords(at, now)}`}.`;

/** The coin sheet's line: why the price is old (if it is), when it was read, and where from. */
export function sheetAsOf(live: boolean, why: string, at: number, now: number): string {
  return `${live ? '' : `${why || 'Not updated since'} · `}${asOfLine(at, now, live).replace(/\.$/, '')} · from CoinGecko`;
}

/** A coin whose week is not there yet. */
export const WEEK_EMPTY = 'I have not read a week of prices for this one yet. It fills in as I read more.';
/** A gold, silver or currency row the rates have not filled yet. */
export const NOT_READ = 'not read yet';
export const RETRY = 'RETRY';
export const RETRYING = 'Asking again…';
