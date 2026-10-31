/**
 * THE WORKBENCH: sun and shadow on a building (OWNER-ISSUES 61b), pure and total. The sun's altitude and azimuth for a place,
 * a date and a time by the standard astronomical algorithm (NOAA's solar calculator, after Jean Meeus, Astronomical
 * Algorithms: about ±0.5° and a minute or two, with the usual refraction at the horizon); sunrise and sunset; the length and
 * the direction of the shadow a height throws, at that time and at noon on that day.
 */
import { caveatFor, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
const tan = (d: number) => Math.tan(d * RAD);
const asinD = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / RAD;
const acosD = (x: number) => Math.acos(Math.max(-1, Math.min(1, x))) / RAD;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The sun's declination (°) and the equation of time (minutes) at an instant (NOAA). */
export function sunCoords(at: number): { decl: number; eot: number } {
  const jd = at / 86_400_000 + 2_440_587.5;
  const T = (jd - 2_451_545) / 36_525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const decl = asinD(sin(eps) * sin(lambda));
  const y = tan(eps / 2) ** 2;
  const eot = (4 / RAD) * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  return { decl, eot };
}

/** The usual atmospheric refraction (°) at a true elevation (NOAA's piecewise fit). */
function refraction(el: number): number {
  if (el > 85) return 0;
  const te = tan(el);
  let r: number;
  if (el > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (el > -0.575) r = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)));
  else r = -20.772 / te;
  return r / 3600;
}

/** Where the sun is: altitude above the horizon (°, refraction included) and azimuth (° from true north, clockwise). */
export function sunPosition(lat: number, lon: number, at: number): { altitude: number; azimuth: number; decl: number } {
  const { decl, eot } = sunCoords(at);
  const d = new Date(at);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60_000;
  const tst = mod(minutes + eot + 4 * lon, 1440);
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const zen = acosD(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(ha));
  const el = 90 - zen;
  const sz = sin(zen);
  let az: number;
  if (Math.abs(sz) < 1e-9) az = lat >= decl ? 180 : 0;
  else {
    const a = acosD((sin(lat) * cos(zen) - sin(decl)) / (cos(lat) * sz));
    az = ha > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
  }
  return { altitude: el + refraction(el), azimuth: az, decl };
}

/**
 * Sunrise, solar noon and sunset (ms) on the UTC day that holds `at` near this longitude; `rise`/`set` are null in a polar
 * day or night (`polar` says which).
 */
export function sunTimes(lat: number, lon: number, at: number): { rise: number | null; noon: number; set: number | null; polar?: 'day' | 'night' } {
  // the calendar day at this longitude (local mean time: a late evening in the far west is still the same day), and two
  // passes so the noon is worked out with the sun's coordinates at the noon itself
  const local = new Date(at + (lon / 15) * 3_600_000);
  const mid = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let noon = mid + (720 - 4 * lon) * 60_000;
  for (let i = 0; i < 2; i++) noon = mid + (720 - 4 * lon - sunCoords(noon).eot) * 60_000;
  const { decl } = sunCoords(noon);
  const x = cos(90.833) / (cos(lat) * cos(decl)) - tan(lat) * tan(decl);
  if (x > 1) return { rise: null, noon, set: null, polar: 'night' };
  if (x < -1) return { rise: null, noon, set: null, polar: 'day' };
  const ha = acosD(x);
  return { rise: noon - ha * 4 * 60_000, noon, set: noon + ha * 4 * 60_000 };
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** "south-west" for 225°. */
export const compass = (deg: number) => POINTS[Math.round(mod(deg, 360) / 45) % 8]!;

/** The shadow a height throws with the sun at `altitude`: its length (Infinity at or below the horizon). */
export const shadowLength = (height: number, altitude: number) => (altitude <= 0 ? Infinity : height / tan(altitude));

export interface SunIn {
  lat?: number;
  lon?: number;
  /** The instant, ms (UTC). */
  at?: number;
  /** A building's height, m. */
  height?: number;
  /** His zone, for the clock times. */
  tz?: string;
  /** What the place is called. */
  place?: string;
}

export const SUN_DEFAULTS = { lat: 52.4862, lon: -1.8904, height: 10, place: 'Birmingham' };

const clockIn = (ms: number, tz?: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz || 'UTC' }).format(ms);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(ms);
  }
};

export function solveSun(input: SunIn = {}, system: UnitSystem = 'metric', now = Date.now()): Estimate {
  const title = 'Sun and shadow';
  const used: string[] = [];
  const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const lat = fin(input.lat) ? input.lat : (used.push(`${SUN_DEFAULTS.place}`), SUN_DEFAULTS.lat);
  const lon = fin(input.lon) ? input.lon : SUN_DEFAULTS.lon;
  const at = fin(input.at) ? input.at : (used.push('now'), now);
  const height = fin(input.height) && input.height > 0 ? input.height : (used.push('a 10 m building'), SUN_DEFAULTS.height);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return problemEstimate('sun', title, 'that is not a place on Earth (latitude ±90°, longitude ±180°)');
  if (height > 1000) return problemEstimate('sun', title, 'a height over 1 km is a mountain: the ground around it is not flat');
  const tz = input.tz;
  const pos = sunPosition(lat, lon, at);
  const times = sunTimes(lat, lon, at);
  const noonPos = sunPosition(lat, lon, times.noon);
  const shadow = shadowLength(height, pos.altitude);
  const noonShadow = shadowLength(height, noonPos.altitude);
  const lines: EstLine[] = [
    { label: 'Sun’s height', value: `${num(pos.altitude, 3)}°`, note: pos.altitude > 0 ? 'above the horizon' : 'below the horizon: night' },
    { label: 'Sun’s direction', value: `${num(pos.azimuth, 3)}°`, note: compass(pos.azimuth) },
    pos.altitude > 0
      ? { label: `Shadow of ${show(height, 'length', system)}`, value: show(shadow, 'length', system), note: `pointing ${compass(pos.azimuth + 180)}` }
      : { label: 'Shadow', value: 'none', note: 'the sun is down' },
    times.rise != null && times.set != null
      ? { label: 'Sunrise · sunset', value: `${clockIn(times.rise, tz)} · ${clockIn(times.set, tz)}`, note: `${num((times.set - times.rise) / 3_600_000, 3)} h of daylight` }
      : { label: 'Sunrise · sunset', value: times.polar === 'day' ? 'none: it never sets' : 'none: it never rises' },
    { label: 'At noon that day', value: `${num(noonPos.altitude, 3)}° high`, note: noonPos.altitude > 0 ? `the shadow ${show(noonShadow, 'length', system)} at ${clockIn(times.noon, tz)}` : 'below the horizon all day' },
  ];
  return {
    kind: 'sun',
    title: `${title}: ${input.place ?? (fin(input.lat) ? `${num(lat, 4)}, ${num(lon, 4)}` : SUN_DEFAULTS.place)}`,
    lines,
    assumptions: [...used, 'flat, level ground and nothing else casting a shadow', 'the usual refraction near the horizon; no hills', ...(tz ? [] : ['clock times in UTC'])],
    method: 'NOAA’s solar position algorithm (Meeus): declination and the equation of time → hour angle → altitude and azimuth; shadow = height ÷ tan(altitude)',
    confidence: used.length ? 'fair' : 'good',
    changes: ['a low sun lengthens shadows fast: at 10° a shadow is almost six times the height', 'hills and neighbours block the low sun first', 'summer time moves the clock, not the sun'],
    caveat: caveatFor('sun'),
    values: { altitude: pos.altitude, azimuth: pos.azimuth, decl: pos.decl, shadow, noon: times.noon, noonAltitude: noonPos.altitude, noonShadow, ...(times.rise != null ? { rise: times.rise } : {}), ...(times.set != null ? { set: times.set } : {}) },
  };
}
