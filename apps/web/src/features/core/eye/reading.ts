/**
 * A FEED'S ONE TRUE READING (BRIEF-EYE-HUD-2 item 4, found-not-fixed 4): the line a feed carries is the card's own (shell/inventory.ts thingLine, the
 * facts of shell/hubcards.ts). Online it is read as it stands and, when it says something, kept on this phone with the time. Offline, a feed whose
 * reading needs the signal shows its LAST reading and how old it is, in one line (POLISH 1's offline voice), never a blank feed; with nothing kept
 * it says so. The feeds that do not need the signal (the gym, the library, the documents: all on this phone) read as ever, offline or not.
 * Nothing here is invented: the kept line is a line the card said.
 */
import { thingLine } from '../../../shell/inventory';
import { lastReading, NO_READING } from './words';

/** The screens whose reading is live data (feeds, the brain, the network): their last reading is what stands offline. */
export const NEEDS_SIGNAL = new Set(['eye', 'markets', 'threats', 'radio', 'outside', 'house', 'social', 'brief', 'interpreter']);

const KEY = 'ghosty.eyereads';
type Kept = Record<string, { line: string; at: number }>;
let kept: Kept | null = null;
let savedAt = 0;
const load = (): Kept => {
  if (kept) return kept;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Kept;
    kept = raw && typeof raw === 'object' ? raw : {};
  } catch {
    kept = {};
  }
  return kept;
};
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept ?? {}));
  } catch {
    /* storage unavailable: the readings are kept for this visit only */
  }
};

export const offlineNow = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/** What the card says now ('' when it could not be read). */
const said = (id: string): string => {
  try {
    return thingLine(id);
  } catch {
    return '';
  }
};

/** The reading a feed carries: the card's own line; offline, for a feed that needs the signal, the last one kept and its age. */
export function readingOf(id: string, now = Date.now()): string {
  const k = load();
  if (NEEDS_SIGNAL.has(id)) {
    if (offlineNow()) {
      const e = k[id];
      return e ? lastReading(e.line, now - e.at) : NO_READING;
    }
    const line = said(id);
    // (the age is how long ago the card last said this line: read again and unchanged, it is as young as that read; written at most every 20 s)
    if (line) {
      const changed = k[id]?.line !== line;
      k[id] = { line, at: now };
      if (changed || now - savedAt > 20_000) {
        savedAt = now;
        save();
      }
    }
    return line || (k[id] ? k[id]!.line : '');
  }
  return said(id);
}
