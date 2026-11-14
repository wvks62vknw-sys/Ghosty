/**
 * An e-reader's highlights file ("My Clippings.txt", copied off the device over a cable). Each clipping is a title
 * line, a line with its kind, page, location and date, and the words. A highlight that was later stretched is written
 * again, so the longest one at the same place is kept. Bookmarks are left out.
 */
import { parseClock, parseDay, type Rec } from './input';

export const clippingsAccept = (name: string): boolean => /clippings[^/]*\.txt$/i.test(name) || name.endsWith('.txt');

/** "Book Title (Author Name)" → title and author. */
export function titleAuthor(line: string): { book: string; author: string } {
  const m = /^(.*)\(([^()]*)\)\s*$/.exec(line.trim());
  return m ? { book: m[1]!.trim(), author: m[2]!.trim() } : { book: line.trim(), author: '' };
}

export function clippingRecords(text: string): Rec[] {
  const keep = new Map<string, Rec>();
  for (const block of text.replace(/\r/g, '').replace(/﻿/g, '').split(/^==========\s*$/m)) {
    const lines = block.split('\n').map((l) => l.trim());
    while (lines.length && !lines[0]) lines.shift();
    if (lines.length < 2) continue;
    const { book, author } = titleAuthor(lines[0]!);
    const info = lines[1] ?? '';
    if (!/^-/.test(info)) continue;
    const kind = /bookmark|lesezeichen|marcador|signet/i.test(info) ? 'Bookmark' : /note|notiz|nota/i.test(info) ? 'Note' : 'Highlight';
    if (kind === 'Bookmark') continue;
    const quote = lines.slice(2).join('\n').trim();
    if (!quote) continue;
    const page = /page\s+(\d+)/i.exec(info)?.[1];
    const loc = /location\s+(\d+)(?:-(\d+))?/i.exec(info);
    const added = info.split('|').pop() ?? '';
    const date = parseDay(added.replace(/^.*?Added on\s*/i, '').replace(/^[A-Za-z]+,\s*/, ''), 'mdy');
    const at = loc?.[1] ?? page ?? quote.slice(0, 24);
    const key = `${book}|${kind}|${at}`;
    const r: Rec = { _key: key, book, author, kind, quote };
    if (page) r.page = Number(page);
    if (loc) r.location = Number(loc[1]);
    if (date) r.date = date;
    const time = parseClock(added);
    if (time) r.time = time;
    const had = keep.get(key);
    if (!had || String(had.quote).length <= quote.length) keep.set(key, r);
  }
  return [...keep.values()];
}
