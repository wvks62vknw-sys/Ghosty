/**
 * Time-zone helpers built on Intl (no libraries). Everything is stored as UTC
 * milliseconds; these convert to and from the owner's local wall-clock time.
 */

export interface Zoned {
  y: number;
  m: number; // 1–12
  d: number;
  h: number;
  mi: number;
  s: number;
  /** 0 = Sunday … 6 = Saturday */
  wd: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function validTz(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTz(tz: string | undefined | null): string {
  return validTz(tz) ? tz : 'UTC';
}

export function zoned(ms: number, tz: string): Zoned {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    fmtCache.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, s: +p.second!, wd: WD[p.weekday!] ?? 0 };
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (London summer = +3600000). */
export function offsetMs(ms: number, tz: string): number {
  const z = zoned(ms, tz);
  return Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s) - Math.floor(ms / 1000) * 1000;
}

/** Local wall-clock time in `tz` → UTC ms. Out-of-range fields roll over (d: 32 → next month). */
export function fromZoned(y: number, m: number, d: number, h: number, mi: number, tz: string, s = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const o1 = offsetMs(guess, tz);
  let t = guess - o1;
  const o2 = offsetMs(t, tz);
  if (o2 !== o1) t = guess - o2;
  return t;
}

/** Start of the local day containing `ms`. */
export function startOfDay(ms: number, tz: string): number {
  const z = zoned(ms, tz);
  return fromZoned(z.y, z.m, z.d, 0, 0, tz);
}

/**
 * Parse a time the model or the owner gave:
 *  - "2026-10-15T09:30", "2026-10-15 09:30", "2026-10-15" (local to tz)
 *  - ISO with Z or an offset ("…T09:30:00+01:00")
 *  - "09:30" / "9:30" → the next time it is 09:30 locally
 * Returns UTC ms, or null if it can't be understood.
 */
export function parseWhen(input: string, tz: string, now = Date.now()): number | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', se = '0', off] = m;
    if (off) {
      const t = Date.parse(`${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${se.padStart(2, '0')}${off.toUpperCase() === 'Z' ? 'Z' : off.length === 5 ? `${off.slice(0, 3)}:${off.slice(3)}` : off}`);
      return Number.isFinite(t) ? t : null;
    }
    return fromZoned(+y!, +mo!, +d!, +h, +mi, tz, +se);
  }
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const z = zoned(now, tz);
    let t = fromZoned(z.y, z.m, z.d, +m[1]!, +m[2]!, tz);
    if (t <= now) t = fromZoned(z.y, z.m, z.d + 1, +m[1]!, +m[2]!, tz);
    return t;
  }
  return null;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu 15 Oct 09:30" in the owner's time zone. */
export function fmtLocal(ms: number, tz: string, withTime = true): string {
  const z = zoned(ms, tz);
  const date = `${DAY[z.wd]} ${z.d} ${MON[z.m - 1]}`;
  return withTime ? `${date} ${String(z.h).padStart(2, '0')}:${String(z.mi).padStart(2, '0')}` : date;
}

/** "2026-10-15T09:30" local, the format the model is asked to use. */
export function isoLocal(ms: number, tz: string): string {
  const z = zoned(ms, tz);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.y}-${p(z.m)}-${p(z.d)}T${p(z.h)}:${p(z.mi)}`;
}

export type Repeat = 'none' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export const REPEATS: Repeat[] = ['none', 'hourly', 'daily', 'weekdays', 'weekly', 'monthly'];

/**
 * The next time a repeating job is due after `now`, keeping its local wall-clock time
 * across daylight-saving changes. Missed runs (Ghosty asleep) are skipped, not replayed.
 */
export function nextRun(prev: number, repeat: Repeat, tz: string, now = Date.now()): number | null {
  if (repeat === 'none') return null;
  let t = prev;
  for (let i = 0; i < 5000 && t <= now; i++) {
    if (repeat === 'hourly') {
      t += 3600_000;
      continue;
    }
    const z = zoned(t, tz);
    if (repeat === 'daily') t = fromZoned(z.y, z.m, z.d + 1, z.h, z.mi, tz);
    else if (repeat === 'weekly') t = fromZoned(z.y, z.m, z.d + 7, z.h, z.mi, tz);
    else if (repeat === 'monthly') t = fromZoned(z.y, z.m + 1, z.d, z.h, z.mi, tz);
    else if (repeat === 'weekdays') {
      const step = z.wd === 5 ? 3 : z.wd === 6 ? 2 : 1;
      t = fromZoned(z.y, z.m, z.d + step, z.h, z.mi, tz);
    }
  }
  if (repeat === 'hourly' && t <= now) t = now + 3600_000 - ((now - prev) % 3600_000);
  return t > now ? t : null;
}
