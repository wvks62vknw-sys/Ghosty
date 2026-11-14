/** A film diary site's export zip (diary.csv, or watched.csv without a diary): every film he logged and his rating. */
import { csvObjects, col } from './csv';
import { num, parseDay, type Rec } from './input';

/** The diary first; the watched list only when there is no diary. */
export const filmAccept = (name: string): boolean => /(^|\/)(diary|watched)\.csv$/.test(name) || (!name.includes('/') && name.endsWith('.csv'));

export function filmRecords(files: { name: string; text: string }[]): Rec[] {
  const diary = files.find((f) => /diary\.csv$/i.test(f.name)) ?? files.find((f) => /watched\.csv$/i.test(f.name)) ?? files[0];
  if (!diary) return [];
  const out: Rec[] = [];
  for (const r of csvObjects(diary.text)) {
    const title = col(r, 'Name');
    if (!title) continue;
    const date = parseDay(col(r, 'Watched Date', 'Date'));
    const year = num(col(r, 'Year'));
    const rec: Rec = { _key: `${date}|${title}|${year || ''}`, title };
    if (year > 0) rec.year = year;
    if (date) rec.date = date;
    const stars = num(col(r, 'Rating'));
    if (stars > 0) rec.stars = stars;
    if (/yes|true/i.test(col(r, 'Rewatch'))) rec.rewatch = true;
    const tags = col(r, 'Tags');
    if (tags) rec.tags = tags;
    out.push(rec);
  }
  return out;
}
