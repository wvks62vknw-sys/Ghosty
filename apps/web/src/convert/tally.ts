/**
 * What the converter and the documents have done on this phone, for their hub cards (shell/hubcards.ts): how many
 * conversions, the last one, how many documents kept. Kept in this phone's storage only; a blocked storage reads as none.
 */
const KEY = 'ghosty.convert.tally';

export interface Tally {
  n: number;
  last: string;
  at: number;
}

export function convertTally(): Tally | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Tally | null;
    return t && typeof t.n === 'number' ? t : null;
  } catch {
    return null;
  }
}

/** One more conversion done ("JPG to PDF"). */
export function noteConverted(what: string): void {
  try {
    const t = convertTally();
    localStorage.setItem(KEY, JSON.stringify({ n: (t?.n ?? 0) + 1, last: what.slice(0, 40), at: Date.now() }));
  } catch {
    /* a phone that keeps nothing still converts */
  }
}
