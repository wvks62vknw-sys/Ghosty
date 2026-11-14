/**
 * A streaming service's viewing history: the simple list (Title, Date) or the full data download's ViewingActivity.csv.
 * Titles like "Show: Season 1: Episode" are split into the show and the episode. The full download holds every
 * profile on the account, so each row keeps its profile in _who and he picks his own before anything is kept.
 */
import { csvObjects, col } from './csv';
import { localDay, localTime, parseDay, type Rec } from './input';

export const watchAccept = (name: string): boolean => /viewing ?(history|activity)[^/]*\.csv$/i.test(name) || name.endsWith('.csv');

/** Splits "Show: Season 2: The Episode" → show and episode. */
export function splitTitle(t: string): { show: string; episode: string } {
  const parts = t.split(': ');
  if (parts.length >= 3) return { show: parts[0]!, episode: parts.slice(2).join(': ') };
  if (parts.length === 2 && /season|series|part|volume|chapter|limited/i.test(parts[1]!)) return { show: parts[0]!, episode: '' };
  return { show: t, episode: '' };
}

/** Rows of either file as records: date, time, title, show, episode, kind (Film or Series), mins. */
export function watchRecords(text: string, order: 'dmy' | 'mdy' = 'mdy'): Rec[] {
  const rows = csvObjects(text);
  const out: Rec[] = [];
  for (const r of rows) {
    const title = col(r, 'Title');
    if (!title) continue;
    const kind = col(r, 'Supplemental Video Type');
    if (kind && kind !== 'NONE') continue; // trailers and previews
    const startRaw = col(r, 'Start Time');
    let date = '', time = '';
    if (startRaw) {
      const d = new Date(`${startRaw.replace(' ', 'T')}Z`);
      if (!Number.isNaN(+d)) { date = localDay(d); time = localTime(d); }
    } else date = parseDay(col(r, 'Date'), order);
    if (!date) continue;
    const { show, episode } = splitTitle(title);
    const rec: Rec = { _key: `${date}|${time}|${title}`, date, title, show, kind: episode || /season|series/i.test(title) ? 'Series' : 'Film' };
    if (episode) rec.episode = episode;
    if (time) rec.time = time;
    const dur = /^(\d+):(\d{2}):(\d{2})$/.exec(col(r, 'Duration'));
    if (dur) rec.mins = +dur[1]! * 60 + +dur[2]! + Math.round(+dur[3]! / 60);
    const who = col(r, 'Profile Name');
    if (who) rec._who = who;
    out.push(rec);
  }
  return out;
}
