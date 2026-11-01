/**
 * THE KART RACER's lap records, per track, in scores.ts (his own, and Ghosty's from his own driving). scores.ts keeps
 * the bigger number as the best, so a lap is kept there as LAP_CAP_MS less its time in ms: the quickest lap is the best.
 */
import { recordScore, scoreOf } from '../../scores';
import { KART_GHOSTY_LAP_PREFIX, KART_LAP_PREFIX } from '../shelf3';

/** Ten minutes: no lap is slower (a lap this slow is not kept). */
export const LAP_CAP_MS = 600_000;
export const lapKey = (track: string, ghosty = false) => `${ghosty ? KART_GHOSTY_LAP_PREFIX : KART_LAP_PREFIX}${track}`;

/** The record lap on a track (seconds), or null when there is none yet. */
export function lapRecord(track: string, ghosty = false): number | null {
  const s = scoreOf(lapKey(track, ghosty));
  return s && s.best > 0 ? (LAP_CAP_MS - s.best) / 1000 : null;
}

/** Keep a lap (seconds); says whether it is the new record and what the record is now. */
export function recordLap(track: string, seconds: number, ghosty = false): { isBest: boolean; best: number } {
  const ms = Math.round(seconds * 1000);
  if (!(ms > 0 && ms < LAP_CAP_MS)) return { isBest: false, best: lapRecord(track, ghosty) ?? seconds };
  const r = recordScore(lapKey(track, ghosty), LAP_CAP_MS - ms);
  return { isBest: r.isBest, best: (LAP_CAP_MS - r.score.best) / 1000 };
}
