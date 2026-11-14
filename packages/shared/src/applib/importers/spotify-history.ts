/**
 * A music service's streaming history (the account data download: StreamingHistory*.json, or the extended
 * Streaming_History_Audio_*.json), folded into one record per track per day so a year of listening stays small.
 * Plays under 30 seconds are skips and are left out. Podcast episodes are kept apart from music.
 */
import { localDay, round, type Rec } from './input';

export const listeningAccept = (name: string): boolean => /streaming_?history[^/]*\.json$/i.test(name) || /endsong[^/]*\.json$/i.test(name);

interface Play { at: number; track: string; artist: string; album: string; ms: number; podcast: boolean }

/** The plays in one history file, either layout. */
export function listeningPlays(text: string): Play[] {
  let rows: unknown;
  try { rows = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  const out: Play[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
    if ('ts' in r) {
      const episode = s('episode_name');
      const track = episode || s('master_metadata_track_name');
      if (!track) continue;
      out.push({ at: Date.parse(s('ts')), track, artist: episode ? s('episode_show_name') : s('master_metadata_album_artist_name'), album: episode ? '' : s('master_metadata_album_album_name'), ms: Number(r.ms_played) || 0, podcast: !!episode });
    } else if ('endTime' in r) {
      const track = s('trackName') || s('episodeName');
      if (!track) continue;
      // the short history writes UTC as "2026-11-14 10:00"
      out.push({ at: Date.parse(`${s('endTime').replace(' ', 'T')}Z`), track, artist: s('artistName') || s('podcastName'), album: '', ms: Number(r.msPlayed) || 0, podcast: !s('artistName') && !!(s('podcastName') || s('episodeName')) });
    }
  }
  return out.filter((p) => Number.isFinite(p.at));
}

/** Plays folded into records: date, track, artist, album, kind (Music or Podcast), plays, minutes. */
export function listeningRecords(plays: Play[]): Rec[] {
  const m = new Map<string, Rec>();
  for (const p of plays) {
    if (p.ms < 30000) continue;
    const day = localDay(new Date(p.at));
    const key = `${day}|${p.artist}|${p.track}`;
    const r = m.get(key);
    if (r) { r.plays = (r.plays as number) + 1; r.minutes = round((r.minutes as number) + p.ms / 60000, 1); }
    else m.set(key, { _key: key, date: day, track: p.track, artist: p.artist, album: p.album, kind: p.podcast ? 'Podcast' : 'Music', plays: 1, minutes: round(p.ms / 60000, 1) });
  }
  return [...m.values()];
}
