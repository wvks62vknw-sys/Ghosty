/** A reading site's library export (CSV): every book on his shelves, with his rating, dates and review. */
import { csvObjects, col } from './csv';
import { num, parseDay, type Rec } from './input';

const SHELF: Record<string, string> = { read: 'Read', 'currently-reading': 'Reading', 'to-read': 'To read' };

export function readingRecords(text: string): Rec[] {
  const out: Rec[] = [];
  for (const r of csvObjects(text)) {
    const title = col(r, 'Title');
    if (!title) continue;
    const id = col(r, 'Book Id') || `${title}|${col(r, 'Author')}`;
    const rec: Rec = { _key: id, title, author: col(r, 'Author'), shelf: SHELF[col(r, 'Exclusive Shelf')] ?? 'Read' };
    const rating = num(col(r, 'My Rating'));
    if (rating >= 1) rec.rating = rating;
    const pages = num(col(r, 'Number of Pages'));
    if (pages > 0) rec.pages = pages;
    const year = num(col(r, 'Original Publication Year', 'Year Published'));
    if (year > 0) rec.year = year;
    const read = parseDay(col(r, 'Date Read'));
    if (read) rec.read = read;
    const added = parseDay(col(r, 'Date Added'));
    if (added) rec.added = added;
    const review = col(r, 'My Review').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').trim();
    if (review) rec.review = review;
    out.push(rec);
  }
  return out;
}
