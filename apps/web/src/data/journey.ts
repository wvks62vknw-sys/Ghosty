/**
 * Public-transport journeys on the phone (the brain's /api/journey answer and its show_journey
 * command, planned by Transitous — apps/edge/src/integrations/transitous.ts): the shared shapes,
 * the decoder for each leg's encoded polyline, a colour per kind of leg (the operator's own line
 * colour when it has one), and the words and clock times the JOURNEY sheet shows. No network and
 * no DOM here, so apps/edge/test/journey.test.mjs runs it as it is.
 */
import type { Journey, JourneyLeg, JourneyMode } from '../../../../packages/shared/src/protocol';

export type { Journey, JourneyAnswer, JourneyLeg, JourneyMode, JourneyPlace } from '../../../../packages/shared/src/protocol';

/**
 * An encoded polyline (Google's algorithm) → [lat, lon] pairs. `precision` is the number of
 * decimal digits the shape was rounded to: 5 for Google, 6 for OSRM and Valhalla, 7 for MOTIS
 * (Transitous says which in `legGeometry.precision`). Sums are kept as plain numbers rather than
 * 32-bit words, so a seventh digit on a longitude near 180° cannot overflow. A broken string
 * gives what could be read up to the break, never an error.
 */
export function decodePolyline(s: string, precision = 7): [number, number][] {
  const out: [number, number][] = [];
  if (typeof s !== 'string' || !s) return out;
  const scale = 10 ** Math.max(0, Math.min(9, Math.round(precision)));
  let i = 0;
  let lat = 0;
  let lon = 0;
  // One zig-zag varint: five bits a character, low bits first, 0x20 means "more follows".
  const next = (): number | null => {
    let shift = 0;
    let result = 0;
    for (;;) {
      if (i >= s.length) return null;
      const b = s.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) return null;
      result += (b & 0x1f) * 2 ** shift;
      shift += 5;
      if (b < 0x20) break;
      if (shift > 60) return null;
    }
    return result % 2 ? -(result + 1) / 2 : result / 2;
  };
  while (i < s.length) {
    const dLat = next();
    if (dLat === null) break;
    const dLon = next();
    if (dLon === null) break;
    lat += dLat;
    lon += dLon;
    const y = lat / scale;
    const x = lon / scale;
    if (Math.abs(y) > 90 || Math.abs(x) > 180) break;
    out.push([y, x]);
  }
  return out;
}

/** The colour of a leg by kind: walks grey and dashed, the rest bright enough for the dark map. */
export const MODE_COLORS: Record<JourneyMode, string> = {
  walk: '#9fb3c8',
  bus: '#ffb23e',
  tram: '#5ae6ff',
  rail: '#ff6b6b',
  subway: '#b388ff',
  ferry: '#4fe3a8',
  other: '#e8f1f6',
};

/** The line's own colour when the operator publishes one (never for a walk), else the kind's. */
export const legColor = (l: Pick<JourneyLeg, 'mode' | 'color'>): string => (l.mode !== 'walk' && /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : MODE_COLORS[l.mode]);

/** Black or white, whichever reads on `bg` ("#rrggbb"). */
export function textOn(bg: string): '#000' | '#fff' {
  const m = bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#fff';
  const lum = (0.2126 * parseInt(m[1]!, 16) + 0.7152 * parseInt(m[2]!, 16) + 0.0722 * parseInt(m[3]!, 16)) / 255;
  return lum > 0.55 ? '#000' : '#fff';
}

const WORDS: Record<JourneyMode, string> = { walk: 'walk', bus: 'bus', tram: 'tram', rail: 'train', subway: 'metro', ferry: 'ferry', other: 'ride' };

/** "bus", "train", "coach"… for a leg. */
export function modeWord(l: Pick<JourneyLeg, 'mode' | 'kind'>): string {
  if (l.kind === 'COACH') return 'coach';
  if (l.mode === 'other') return l.kind.toLowerCase().replace(/_/g, ' ') || 'ride';
  return WORDS[l.mode];
}

/** "08:12" in `tz` (the phone's own zone when none is given or it is not known). */
export function hhmm(isoTime: string, tz?: string): string {
  const t = Date.parse(isoTime);
  if (!Number.isFinite(t)) return '--:--';
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  try {
    return new Intl.DateTimeFormat('en-GB', tz ? { ...opts, timeZone: tz } : opts).format(new Date(t));
  } catch {
    return new Intl.DateTimeFormat('en-GB', opts).format(new Date(t));
  }
}

/** "39 min", "1 h 12 min". */
export const mins = (s: number): string => {
  const m = Math.max(0, Math.round(s / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

/** "535 m", "1.2 km". */
export const metres = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** For a live leg: seconds late (negative: early) and the words; '' when the leg is not live. */
export function delayOf(l: Pick<JourneyLeg, 'realTime' | 'start' | 'scheduledStart'>): { s: number; text: string } {
  if (!l.realTime) return { s: 0, text: '' };
  const a = Date.parse(l.start);
  const b = Date.parse(l.scheduledStart);
  const s = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 1000) : 0;
  if (Math.abs(s) < 60) return { s, text: 'on time' };
  return { s, text: `${Math.round(Math.abs(s) / 60)} min ${s > 0 ? 'late' : 'early'}` };
}

/** The leg's shape to draw: its polyline, or, when the brain left that out, straight lines from stop to stop. */
export function legPath(l: JourneyLeg): [number, number][] {
  const decoded = l.points ? decodePolyline(l.points, l.precision) : [];
  if (decoded.length >= 2) return decoded;
  const pts: [number, number][] = [l.from, ...l.stops, l.to].filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)).map((p) => [p.lat, p.lon]);
  return pts.length >= 2 ? pts : [];
}

/** [[south, west], [north, east]] around every leg, or null when nothing has a place. */
export function journeyBounds(j: Journey): [[number, number], [number, number]] | null {
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const l of j.legs) {
    for (const [y, x] of legPath(l)) {
      s = Math.min(s, y);
      n = Math.max(n, y);
      w = Math.min(w, x);
      e = Math.max(e, x);
    }
  }
  return Number.isFinite(s) ? [[s, w], [n, e]] : null;
}

/** "walk all the way", "no changes", "1 change", "3 changes". */
export const changesText = (j: Journey): string => (j.direct ? 'walk all the way' : j.transfers === 0 ? 'no changes' : j.transfers === 1 ? '1 change' : `${j.transfers} changes`);

/** The legs that are rides (not walks). */
export const ridesOf = (j: Journey): JourneyLeg[] => j.legs.filter((l) => l.mode !== 'walk');

/** What the boarding point is called: a platform for a train, a stop for the rest. */
export const standWord = (l: Pick<JourneyLeg, 'mode'>): string => (l.mode === 'rail' || l.mode === 'subway' ? 'platform' : 'stop');

/** "12 stops" — the stops ridden through plus the one to get off at. */
export const stopsText = (l: JourneyLeg): string => {
  const n = l.stops.length + 1;
  return `${n} stop${n === 1 ? '' : 's'}`;
};
