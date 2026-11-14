/**
 * THE ARCADE's record of play, kept on this phone only (APPS ROUND, the console-class Arcade): for each game, how often and
 * how long he played, when he first and last did, and up to four screenshots taken as he played. CONTINUE PLAYING, the
 * game pages and the TROPHY ROOM read it; nothing here is ever sent anywhere.
 */

export const STATS_KEY = 'ghosty.arcade.stats';
export const SHOTS_KEY = 'ghosty.arcade.shots';
/** The most screenshots kept for one game (the newest stay). */
export const SHOTS_EACH = 4;

export interface PlayStat {
  /** The game's title as the shelf says it. */
  title: string;
  /** Sittings played. */
  plays: number;
  /** Seconds played, every sitting together. */
  seconds: number;
  /** When he first played it, and when he last did (ms). */
  first: number;
  last: number;
  /** A game he made in the game studio. */
  mine?: boolean;
}

export interface Shot {
  /** A small JPEG, as a data address. */
  src: string;
  at: number;
}

const read = <T>(key: string): Record<string, T> => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
  } catch {
    return {};
  }
};
const write = (key: string, v: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false; // full or blocked: this visit only
  }
};

export const allStats = (): Record<string, PlayStat> => read<PlayStat>(STATS_KEY);
export const statOf = (id: string): PlayStat | undefined => allStats()[id];

/** A sitting played: one more play, its seconds added. A sitting under two seconds (a mistaken tap) is not counted. */
export function recordPlay(id: string, title: string, seconds: number, opts: { mine?: boolean; now?: number } = {}): PlayStat | null {
  if (!(seconds >= 2)) return null;
  const now = opts.now ?? Date.now();
  const all = allStats();
  const was = all[id];
  const next: PlayStat = {
    title,
    plays: (was?.plays ?? 0) + 1,
    seconds: Math.round((was?.seconds ?? 0) + seconds),
    first: was?.first ?? now,
    last: now,
    ...(opts.mine || was?.mine ? { mine: true } : {}),
  };
  all[id] = next;
  write(STATS_KEY, all);
  const today = new Date(now).toISOString().slice(0, 10);
  const days = playDays();
  if (!days.includes(today)) write(DAYS_KEY, [...days, today].slice(-400));
  return next;
}

/** The different days he played anything (for the TROPHY ROOM's Seven days), as YYYY-MM-DD, the last 400. */
export const DAYS_KEY = 'ghosty.arcade.days';
export function playDays(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DAYS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

/** The games played, the most recent first (CONTINUE PLAYING). */
export function recent(stats: Record<string, PlayStat> = allStats(), n = 6): [string, PlayStat][] {
  return Object.entries(stats).sort((a, b) => b[1].last - a[1].last).slice(0, n);
}

/** Forget one game's record and screenshots (his scores stay in scores.ts). */
export function forgetStats(id: string): void {
  const all = allStats();
  delete all[id];
  write(STATS_KEY, all);
  const shots = read<Shot[]>(SHOTS_KEY);
  delete shots[id];
  write(SHOTS_KEY, shots);
}

export const shotsOf = (id: string): Shot[] => {
  const v = read<Shot[]>(SHOTS_KEY)[id];
  return Array.isArray(v) ? v.filter((s) => s && typeof s.src === 'string' && s.src.startsWith('data:image/')) : [];
};

/** Keep a screenshot: the newest four stay. When the phone's storage is full, the oldest of every game go first. */
export function addShot(id: string, src: string, now = Date.now()): boolean {
  if (!src.startsWith('data:image/')) return false;
  const all = read<Shot[]>(SHOTS_KEY);
  all[id] = [...(Array.isArray(all[id]) ? all[id] : []), { src, at: now }].slice(-SHOTS_EACH);
  for (let tries = 0; tries < 8; tries++) {
    if (write(SHOTS_KEY, all)) return true;
    // make room: drop the oldest screenshot anywhere
    let oldest: { k: string; i: number; at: number } | null = null;
    for (const [k, list] of Object.entries(all)) list.forEach((s, i) => (!oldest || s.at < oldest.at ? (oldest = { k, i, at: s.at }) : null));
    if (!oldest) return false;
    const o: { k: string; i: number } = oldest;
    all[o.k]?.splice(o.i, 1);
  }
  return false;
}

/**
 * A screenshot of a game's canvas, small enough to keep: 320 wide at most, as a JPEG. Null when the canvas cannot be read or
 * is one flat colour (a WebGL frame already cleared, a black loading screen), so a blank picture is never kept.
 */
export function grab(canvas: HTMLCanvasElement): string | null {
  try {
    if (!canvas.width || !canvas.height) return null;
    const w = Math.min(320, canvas.width);
    const hgt = Math.max(1, Math.round((canvas.height / canvas.width) * w));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hgt;
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(canvas, 0, 0, w, hgt);
    const px = g.getImageData(0, 0, w, hgt).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i + 2 < px.length; i += 4 * 97) {
      const v = ((px[i] ?? 0) + (px[i + 1] ?? 0) + (px[i + 2] ?? 0)) / 3;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max - min < 12) return null;
    return c.toDataURL('image/jpeg', 0.6);
  } catch {
    return null; // a canvas that will not be read
  }
}

/** "3 h 20 min", "12 min", "40 s": play time in his words. */
export const playTime = (s: number): string =>
  s >= 3600 ? `${Math.floor(s / 3600)} h${Math.round((s % 3600) / 60) ? ` ${Math.round((s % 3600) / 60)} min` : ''}` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.max(0, Math.round(s))} s`;

/** "today", "yesterday", "3 days ago", "12 Oct": when he last played. */
export function whenWords(t: number, now = Date.now()): string {
  const day = (x: number) => Math.floor((x - new Date(x).getTimezoneOffset() * 60_000) / 86_400_000);
  const d = day(now) - day(t);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
