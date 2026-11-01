/**
 * WIKIPEDIA, OFFLINE (the Library, BRIEF-REST-A 1): the two files Ghosty offers, from the Kiwix library
 * (https://download.kiwix.org/zim/wikipedia/, public and free). Wikipedia's words are CC BY-SA 4.0, packed by Kiwix as
 * ZIM files. Each is fetched only on his tap, on Wi-Fi, its size said first, in pieces into this phone's Cache API
 * (wiki/store.ts), searched and read here by Kiwix's own reader (wiki/zim.ts), and deleted in one tap. The brain never
 * reads them: they are on the phone.
 *
 * The sizes are the files' exact bytes as download.kiwix.org gave them on 1 Nov 2026 (checked again on the phone, piece by
 * piece); a newer month is a new name here (Kiwix keeps the last two months of each file).
 */

export interface WikiFile {
  /** Steady, for the phone's own records. */
  id: string;
  /** Its name in the Kiwix library (download.kiwix.org/zim/wikipedia/<file>). */
  file: string;
  /** Exact size in bytes. */
  bytes: number;
  /** How he knows it. */
  name: string;
  /** One line: what is in it. */
  what: string;
  /** The month Kiwix made it (the file's own date replaces it once it is here). */
  month: string;
}

export const WIKI_FILES: WikiFile[] = [
  {
    id: 'physics',
    file: 'wikipedia_en_physics_mini_2026-10.zim',
    bytes: 53_103_685,
    name: 'Physics on Wikipedia',
    what: 'A taster: the opening of every physics article on English Wikipedia, about 88,000 of them, here in a minute on Wi-Fi.',
    month: 'October 2026',
  },
  {
    id: 'simple',
    file: 'wikipedia_en-simple_all_nopic_2026-09.zim',
    bytes: 1_094_936_257,
    name: 'Simple English Wikipedia',
    what: 'Every Simple English article in full, without pictures: plain words, short sentences.',
    month: 'September 2026',
  },
];

/** Said in the panel, so nobody waits for the rest of it. */
export const WHY_NOT_ALL =
  'Never the whole English Wikipedia: Kiwix’s file of it is 119 GB with pictures, and 13 GB even as the openings alone. Simple English is the whole of a Wikipedia that fits a phone.';

/** The licence, said in the panel and on every article. */
export const LICENCE = 'Wikipedia’s words are CC BY-SA 4.0: free to read and share with credit. The files are packed by Kiwix.';

/** "53 MB", "1.1 GB" (1,000,000 bytes to the MB, as the files are counted). */
export function sizeWords(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A ZIM's Date metadata ("2026-09-28") as he says it ("September 2026"); '' when it is not a date. */
export function monthWords(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date.trim());
  const i = m ? Number(m[2]) - 1 : -1;
  return m && i >= 0 && i < 12 ? `${MONTHS[i]} ${m[1]}` : '';
}

/** "Simple English Wikipedia, September 2026, 1.1 GB on your phone". */
export function keptLine(f: Pick<WikiFile, 'name' | 'month'>, bytes: number, date = ''): string {
  return `${f.name}, ${monthWords(date) || f.month}, ${sizeWords(bytes)} on your phone`;
}
