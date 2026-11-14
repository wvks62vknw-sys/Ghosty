/**
 * THE CLOCK's places (APPS ROUND): cities and their time zones, kept in the app so it works with no signal, and the time in
 * each worked out on the phone from the zone (summer time included, as the phone's own clock knows it). Pure.
 */

/** Cities he can add, with their zone. Lower case for matching; the name as shown is the first word list's. */
export const CITIES: [string, string][] = [
  ['London', 'Europe/London'], ['Birmingham', 'Europe/London'], ['Manchester', 'Europe/London'], ['Edinburgh', 'Europe/London'],
  ['Dublin', 'Europe/Dublin'], ['Lisbon', 'Europe/Lisbon'], ['Paris', 'Europe/Paris'], ['Madrid', 'Europe/Madrid'],
  ['Barcelona', 'Europe/Madrid'], ['Rome', 'Europe/Rome'], ['Berlin', 'Europe/Berlin'], ['Amsterdam', 'Europe/Amsterdam'],
  ['Brussels', 'Europe/Brussels'], ['Zurich', 'Europe/Zurich'], ['Vienna', 'Europe/Vienna'], ['Prague', 'Europe/Prague'],
  ['Warsaw', 'Europe/Warsaw'], ['Stockholm', 'Europe/Stockholm'], ['Oslo', 'Europe/Oslo'], ['Copenhagen', 'Europe/Copenhagen'],
  ['Helsinki', 'Europe/Helsinki'], ['Athens', 'Europe/Athens'], ['Istanbul', 'Europe/Istanbul'], ['Moscow', 'Europe/Moscow'],
  ['Cairo', 'Africa/Cairo'], ['Lagos', 'Africa/Lagos'], ['Nairobi', 'Africa/Nairobi'], ['Johannesburg', 'Africa/Johannesburg'],
  ['Dubai', 'Asia/Dubai'], ['Riyadh', 'Asia/Riyadh'], ['Tehran', 'Asia/Tehran'], ['Karachi', 'Asia/Karachi'],
  ['Lahore', 'Asia/Karachi'], ['Islamabad', 'Asia/Karachi'], ['Delhi', 'Asia/Kolkata'], ['Mumbai', 'Asia/Kolkata'],
  ['Dhaka', 'Asia/Dhaka'], ['Bangkok', 'Asia/Bangkok'], ['Singapore', 'Asia/Singapore'], ['Hong Kong', 'Asia/Hong_Kong'],
  ['Beijing', 'Asia/Shanghai'], ['Shanghai', 'Asia/Shanghai'], ['Seoul', 'Asia/Seoul'], ['Tokyo', 'Asia/Tokyo'],
  ['Sydney', 'Australia/Sydney'], ['Melbourne', 'Australia/Melbourne'], ['Perth', 'Australia/Perth'], ['Auckland', 'Pacific/Auckland'],
  ['Honolulu', 'Pacific/Honolulu'], ['Los Angeles', 'America/Los_Angeles'], ['San Francisco', 'America/Los_Angeles'],
  ['Vancouver', 'America/Vancouver'], ['Denver', 'America/Denver'], ['Chicago', 'America/Chicago'], ['Mexico City', 'America/Mexico_City'],
  ['Toronto', 'America/Toronto'], ['New York', 'America/New_York'], ['Washington', 'America/New_York'], ['Miami', 'America/New_York'],
  ['Bogotá', 'America/Bogota'], ['Lima', 'America/Lima'], ['Santiago', 'America/Santiago'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
  ['São Paulo', 'America/Sao_Paulo'], ['Rio de Janeiro', 'America/Sao_Paulo'], ['Reykjavik', 'Atlantic/Reykjavik'],
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** The cities whose names start with what he typed (or contain it, after those). */
export function findCity(q: string, n = 6): [string, string][] {
  const f = fold(q);
  if (!f) return [];
  const starts = CITIES.filter(([c]) => fold(c).startsWith(f));
  const has = CITIES.filter(([c]) => !fold(c).startsWith(f) && fold(c).includes(f));
  return [...starts, ...has].slice(0, n);
}

/** Minutes a zone is ahead of UTC at that moment. */
export function offsetMin(zone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(at));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
  return Math.round((asUtc - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** "14:05" in that zone. */
export const timeIn = (zone: string, at: number): string => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));

/** How that zone stands to here: "Same time", "5 h ahead", "8 h behind", "5 h 30 min ahead", with "tomorrow" or "yesterday" when the day differs. */
export function against(zone: string, here: string, at: number): string {
  const d = offsetMin(zone, at) - offsetMin(here, at);
  const day = (z: string) => new Intl.DateTimeFormat('en-GB', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  const when = day(zone) === day(here) ? 'Today' : d > 0 ? 'Tomorrow' : 'Yesterday';
  if (!d) return `${when}, same time`;
  const h = Math.floor(Math.abs(d) / 60);
  const m = Math.abs(d) % 60;
  return `${when}, ${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} ${d > 0 ? 'ahead' : 'behind'}`;
}

/** "1:02:03.4" / "2:03.45": a stopwatch's reading. */
export function lapWords(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 10));
  const cs = t % 100;
  const s = Math.floor(t / 100) % 60;
  const m = Math.floor(t / 6000) % 60;
  const h = Math.floor(t / 360000);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}.${two(cs)}` : `${m}:${two(s)}.${two(cs)}`;
}

/** "5:00": a timer's time left, rounded up to the second. */
export function leftWords(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}
