/**
 * What AIM labels, from the feeds' own shapes: aircraft (adsb.lol / airplanes.live point query),
 * ships (/api/ships), buses and trams (/api/transit), places (/api/aim/places) and the space
 * station (/api/aim/iss). Pure: the Lens mode fetches, this turns answers into targets, and the
 * brain's tests run it without a browser. Nothing here identifies a person: an aircraft is its
 * callsign and registration as broadcast, a ship its broadcast name.
 */
import { distanceText, look, type LatLonAlt } from './project';

export type AimKind = 'plane' | 'ship' | 'transit' | 'place' | 'space';
export const AIM_KINDS: readonly AimKind[] = ['plane', 'ship', 'transit', 'place', 'space'];
export const KIND_LABEL: Record<AimKind, string> = { plane: 'PLANES', ship: 'SHIPS', transit: 'TRANSIT', place: 'PLACES', space: 'SPACE' };
export const KIND_GLYPH: Record<AimKind, string> = { plane: '✈', ship: '⛴', transit: '▣', place: '⌖', space: '✦' };

export interface Target {
  id: string;
  kind: AimKind;
  lat: number;
  lon: number;
  /** Metres above sea level; null = at ground level where the owner stands (a bus, a church). */
  alt: number | null;
  /** Metres above that ground (a tower's height: its top is what is seen). */
  above?: number;
  /** The label's first line. */
  title: string;
  /** Short facts for the label's second line ("11,000 ft"). */
  tag: string;
  /** The detail card's rows. */
  facts: [string, string][];
  /** The Wikipedia article, for a place. */
  wiki?: string;
  /** Degrees, where it is heading (planes, ships, buses). */
  course?: number;
}

/** A target as seen from the owner: where it lies and how far. */
export interface Seen extends Target {
  bearing: number;
  elevation: number;
  /** Metres in a straight line. */
  range: number;
  ground: number;
  dir: [number, number, number];
}

const EYE_M = 1.5;

/** Where each target lies from the owner (ground-level ones at the owner's own ground height). */
export function locate(targets: Target[], obs: LatLonAlt): Seen[] {
  const ground = obs.alt - EYE_M;
  return targets.map((t) => {
    const l = look(obs, { lat: t.lat, lon: t.lon, alt: (t.alt ?? ground) + (t.above ?? 0) });
    return { ...t, bearing: l.bearing, elevation: l.elevation, range: l.range, ground: l.ground, dir: l.dir };
  });
}

const ft = (n: number) => `${Math.round(n).toLocaleString('en-GB')} ft`;
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const str = (s: unknown, max = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

interface AdsbAc {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  category?: string;
}

/** Aircraft from an ADS-B point answer ({ ac: [...] }): the ones with a position, callsign or hex as the label. */
export function planesFrom(j: unknown): Target[] {
  const out: Target[] = [];
  for (const a of ((j as { ac?: AdsbAc[] })?.ac ?? []).slice(0, 300)) {
    if (!fin(a.lat) || !fin(a.lon) || !a.hex) continue;
    const gnd = a.alt_baro === 'ground';
    const altft = gnd ? 0 : fin(a.alt_baro) ? a.alt_baro : fin(a.alt_geom) ? a.alt_geom : 0;
    const call = str(a.flight, 12) || str(a.r, 12) || a.hex.toUpperCase();
    const facts: [string, string][] = [['Callsign', str(a.flight, 12) || '—']];
    if (a.r) facts.push(['Registration', str(a.r, 12)]);
    if (a.t || a.desc) facts.push(['Type', str(a.desc || a.t, 40)]);
    facts.push(['Altitude', gnd ? 'on the ground' : ft(altft)]);
    if (fin(a.gs)) facts.push(['Speed', `${Math.round(a.gs)} kt (${Math.round(a.gs * 1.852)} km/h)`]);
    if (fin(a.track)) facts.push(['Heading', `${Math.round(a.track)}°`]);
    if (fin(a.baro_rate) && Math.abs(a.baro_rate) >= 300) facts.push(['Climb', `${a.baro_rate > 0 ? 'climbing' : 'descending'} ${Math.abs(Math.round(a.baro_rate)).toLocaleString('en-GB')} ft/min`]);
    if (a.squawk === '7700' || a.squawk === '7600' || a.squawk === '7500') facts.push(['Squawk', `${a.squawk} (emergency code)`]);
    out.push({
      id: `p${a.hex}`,
      kind: 'plane',
      lat: a.lat,
      lon: a.lon,
      alt: gnd ? null : altft * 0.3048,
      title: call,
      tag: [gnd ? 'GND' : ft(altft), a.t ?? ''].filter(Boolean).join(' · '),
      facts,
      ...(fin(a.track) ? { course: a.track } : {}),
    });
  }
  return out;
}

interface ShipIn {
  mmsi?: number;
  name?: string;
  lat?: number;
  lon?: number;
  sog?: number;
  cog?: number;
  dest?: string;
}

/** Ships from /api/ships ({ ships: [...] }). */
export function shipsFrom(j: unknown): Target[] {
  const out: Target[] = [];
  for (const s of ((j as { ships?: ShipIn[] })?.ships ?? []).slice(0, 200)) {
    if (!fin(s.lat) || !fin(s.lon) || s.mmsi == null) continue;
    const name = str(s.name, 30) || `MMSI ${s.mmsi}`;
    const facts: [string, string][] = [['Name', name], ['MMSI', String(s.mmsi)]];
    if (s.dest) facts.push(['Bound for', str(s.dest, 30)]);
    if (fin(s.sog)) facts.push(['Speed', `${s.sog.toFixed(1)} kn`]);
    if (fin(s.cog)) facts.push(['Course', `${Math.round(s.cog)}°`]);
    out.push({ id: `s${s.mmsi}`, kind: 'ship', lat: s.lat, lon: s.lon, alt: null, title: name, tag: fin(s.sog) && s.sog > 0.5 ? `${s.sog.toFixed(0)} kn` : 'moored', facts, ...(fin(s.cog) ? { course: s.cog } : {}) });
  }
  return out;
}

interface VehicleIn {
  id?: string;
  kind?: string;
  line?: string;
  dest?: string;
  operator?: string;
  lat?: number;
  lon?: number;
  bearing?: number | null;
  delayS?: number | null;
}

/** Buses and trams from /api/transit ({ vehicles: [...] }). */
export function transitFrom(j: unknown): Target[] {
  const out: Target[] = [];
  for (const v of ((j as { vehicles?: VehicleIn[] })?.vehicles ?? []).slice(0, 200)) {
    if (!fin(v.lat) || !fin(v.lon) || !v.id) continue;
    const what = v.kind === 'tram' ? 'Tram' : 'Bus';
    const line = str(v.line, 10);
    const facts: [string, string][] = [['Line', line || '—']];
    if (v.dest) facts.push(['To', str(v.dest, 40)]);
    if (v.operator) facts.push(['Operator', str(v.operator, 40)]);
    if (fin(v.delayS)) facts.push(['Running', Math.abs(v.delayS) < 60 ? 'on time' : v.delayS > 0 ? `${Math.round(v.delayS / 60)} min late` : `${Math.round(-v.delayS / 60)} min early`]);
    out.push({ id: `t${v.id}`, kind: 'transit', lat: v.lat, lon: v.lon, alt: null, title: `${what} ${line}`.trim(), tag: str(v.dest, 24), facts, ...(fin(v.bearing) ? { course: v.bearing } : {}) });
  }
  return out;
}

interface PlaceIn {
  id?: string;
  name?: string;
  kind?: string;
  lat?: number;
  lon?: number;
  ele?: number;
  height?: number;
  wiki?: string;
}

const PLACE_WORD: Record<string, string> = { peak: 'hilltop', tower: 'tower', stadium: 'stadium', cathedral: 'cathedral', landmark: 'place' };

/** Places from /api/aim/places ({ places: [...] }): hilltops at their mapped height, towers at their top. */
export function placesFrom(j: unknown): Target[] {
  const out: Target[] = [];
  for (const p of ((j as { places?: PlaceIn[] })?.places ?? []).slice(0, 60)) {
    if (!fin(p.lat) || !fin(p.lon) || !p.name) continue;
    const kind = PLACE_WORD[p.kind ?? ''] ?? 'place';
    const facts: [string, string][] = [['What', kind]];
    if (fin(p.ele)) facts.push(['Height', `${Math.round(p.ele)} m above sea level`]);
    if (fin(p.height)) facts.push(['Tall', `${Math.round(p.height)} m`]);
    out.push({
      id: str(p.id, 40) || `x${p.lat},${p.lon}`,
      kind: 'place',
      lat: p.lat,
      lon: p.lon,
      alt: fin(p.ele) && p.kind === 'peak' ? p.ele : null,
      ...(fin(p.height) && p.kind !== 'peak' ? { above: p.height } : {}),
      title: str(p.name, 40),
      tag: kind,
      facts,
      ...(p.wiki ? { wiki: str(p.wiki, 200) } : {}),
    });
  }
  return out;
}

/** The space station from /api/aim/iss. */
export function issFrom(j: unknown): Target[] {
  const s = j as { lat?: number; lon?: number; altKm?: number; speedKmh?: number; visibility?: string };
  if (!fin(s?.lat) || !fin(s?.lon) || !fin(s?.altKm)) return [];
  const facts: [string, string][] = [['What', 'International Space Station'], ['Height', `${Math.round(s.altKm)} km`]];
  if (fin(s.speedKmh)) facts.push(['Speed', `${Math.round(s.speedKmh).toLocaleString('en-GB')} km/h`]);
  if (s.visibility) facts.push(['Light', s.visibility === 'eclipsed' ? "in the Earth's shadow (not visible)" : 'in sunlight (visible in a dark sky)']);
  return [{ id: 'iss', kind: 'space', lat: s.lat, lon: s.lon, alt: s.altKm * 1000, title: 'ISS', tag: `${Math.round(s.altKm)} km up`, facts, wiki: 'International Space Station' }];
}

/** The second line of a label: the kind's facts, then how far. */
export function labelLine(t: Seen): string {
  return [t.tag, distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)].filter(Boolean).join(' · ');
}

/** One line about a target for the brain (`seen`): what it is, where it lies, its facts — data, not instructions. */
export function describeTarget(t: Seen): string {
  const where = `${Math.round(t.bearing)}° from north, ${t.elevation >= 0 ? `${t.elevation.toFixed(1)}° up` : `${(-t.elevation).toFixed(1)}° down`}, ${distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)} away`;
  const facts = t.facts.map(([k, v]) => `${k}: ${v}`).join('; ');
  const kind = { plane: 'aircraft', ship: 'ship', transit: 'bus or tram', place: 'place', space: 'satellite' }[t.kind];
  return `aimed at a ${kind} "${t.title}" (${where}; ${facts})`;
}
