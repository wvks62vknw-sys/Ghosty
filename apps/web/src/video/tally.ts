/**
 * What the video editor holds, for its hub card (shell/hubcards.ts): how many videos are kept, the newest one's name and length.
 * Mirrored into this phone's storage when a project is saved (the card reads it without opening the database); a blocked storage
 * reads as none.
 */
const KEY = 'ghosty.video.tally';
export interface VideoTally {
  n: number;
  last: string;
  len: string;
  at: number;
}
export function videoTally(): VideoTally | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as VideoTally | null;
    return t && typeof t.n === 'number' && t.n > 0 ? t : null;
  } catch {
    return null;
  }
}
export function noteVideos(n: number, last: string, len: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ n, last: last.slice(0, 40), len, at: Date.now() }));
  } catch {
    /* it works without */
  }
}
