/**
 * FILES' WORDS (THE APPS ROUND, lane BOOT): every line the Files app shows that is not his own data, as pure functions, so the screen and
 * tests/files.spec.mjs read one source. Plain English, one sentence each.
 */

/** What kind of thing an item is, as the list and the filter chips name it. */
export type Kind = 'Document' | 'Spreadsheet' | 'Presentation' | 'Photo' | 'Video' | 'Game' | 'Comic' | 'File';
export const KINDS: Kind[] = ['Document', 'Spreadsheet', 'Presentation', 'Photo', 'Video', 'Game', 'Comic', 'File'];
/** The chips' plural names. */
export const KIND_PLURAL: Record<Kind, string> = { Document: 'Documents', Spreadsheet: 'Spreadsheets', Presentation: 'Presentations', Photo: 'Photos', Video: 'Videos', Game: 'Games', Comic: 'Comics', File: 'Your files' };

/** A size in plain units: "820 bytes", "14 KB", "3.2 MB", "1.1 GB". */
export function sizeWords(n: number): string {
  if (!(n > 0)) return '0 KB';
  if (n < 1000) return `${n} bytes`;
  if (n < 1_000_000) return `${Math.round(n / 1000)} KB`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${(n / 1_000_000_000).toFixed(1)} GB`;
}

/** "Today 14:05", "Yesterday", "3 Nov", "3 Nov 2025". */
export function whenWords(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const n = new Date(now);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86_400_000);
  if (diff === 0) return `Today ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === n.getFullYear() ? {} : { year: 'numeric' }) });
}

/** The bin keeps a thing this many days, then lets it go. */
export const BIN_DAYS = 30;
export const binLeft = (deletedAt: number, now = Date.now()): string => {
  const left = Math.max(0, BIN_DAYS - Math.floor((now - deletedAt) / 86_400_000));
  return left <= 0 ? 'Goes today' : left === 1 ? '1 day left' : `${left} days left`;
};

/** The words inside a thing, for search: every string in it longer than one letter, ids and settings left out. */
const SKIP = new Set(['id', 'kind', 'theme', 'layout', 'align', 'sel', 'from', 't', 'type', 'img', 'k', 'transition', 'font', 'colour', 'color', 'fmt', 'style']);
export function wordsIn(x: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 12 || out.length > 4000) return out;
  if (typeof x === 'string') {
    if (x.length > 1 && !/^[a-z0-9_-]{16,}$/i.test(x)) out.push(x);
  } else if (Array.isArray(x)) for (const v of x) wordsIn(v, out, depth + 1);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!SKIP.has(k)) wordsIn(v, out, depth + 1);
  return out;
}

/** Does an item match the search (its name, its tags, the words inside)? With a short line around the first match in the words. */
export function matchOf(q: string, it: { name: string; tags: string[]; text: string }): { hit: boolean; where: 'name' | 'tag' | 'inside' | ''; snippet: string } {
  const s = q.trim().toLowerCase();
  if (!s) return { hit: true, where: '', snippet: '' };
  if (it.name.toLowerCase().includes(s)) return { hit: true, where: 'name', snippet: '' };
  if (it.tags.some((t) => t.toLowerCase().includes(s))) return { hit: true, where: 'tag', snippet: '' };
  const i = it.text.toLowerCase().indexOf(s);
  if (i < 0) return { hit: false, where: '', snippet: '' };
  const a = Math.max(0, i - 30);
  const b = Math.min(it.text.length, i + s.length + 40);
  return { hit: true, where: 'inside', snippet: `${a > 0 ? '…' : ''}${it.text.slice(a, b).replace(/\s+/g, ' ').trim()}${b < it.text.length ? '…' : ''}` };
}

/** A tag as he typed it, cleaned: lower case, no #, letters, digits, spaces and hyphens, at most 24 characters. */
export const cleanTag = (t: string): string => t.trim().replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, ' ').slice(0, 24).trim();
/** A folder's name as he typed it: at most 40 characters, no slashes. */
export const cleanFolder = (f: string): string => f.trim().replace(/[/\\]+/g, ' ').replace(/\s+/g, ' ').slice(0, 40).trim();

export const EMPTY = {
  all: 'Nothing here yet. What you make in Documents, Spreadsheets, Presentations, Photo, Video, Game Studio and Comic appears here, and IMPORT brings in files from your phone.',
  search: (q: string) => `Nothing matches “${q}”, in a name, a tag or the words inside.`,
  recents: 'Nothing opened or changed yet.',
  favourites: 'No favourites yet. Tap the star on anything to keep it here.',
  bin: 'Recently deleted is empty. Things you delete wait here for 30 days, so you can put them back.',
  folder: (f: string) => `${f} is empty. MOVE puts things here.`,
};
export const SUB = 'Everything Ghosty keeps, in one place: your documents, sheets, decks, photos, videos, games, comics and the files you bring in. All of it stays on this phone.';
