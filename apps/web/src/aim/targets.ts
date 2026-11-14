/**
 * What AIM labels, from the feeds' own shapes: aircraft (adsb.lol / airplanes.live point query),
 * ships (/api/ships), buses and trams (/api/transit), places (/api/aim/places) and the space
 * station (/api/aim/iss). Pure: the Lens mode fetches, this turns answers into targets, and the
 * brain's tests run it without a browser. Nothing here identifies a person: an aircraft is its
 * callsign and registration as broadcast, a ship its broadcast name. The night sky (sky.ts) is
 * fetched from nowhere: the phone works it out, and skySeen turns it into labels.
 */
import { compassPoint as compassPointOf, direction, distanceText, look, type LatLonAlt } from './project';
import { brightnessWords, farText, whereToLook, type SkyBody, type SkyKind } from './sky';

// the sky's arithmetic rides in this module's test bundle (test/.build/aim/targets.mjs)
export * from './sky';

export type AimKind = 'plane' | 'ship' | 'transit' | 'place' | 'space' | 'sky';
export const AIM_KINDS: readonly AimKind[] = ['plane', 'ship', 'transit', 'place', 'space', 'sky'];
export const KIND_LABEL: Record<AimKind, string> = { plane: 'PLANES', ship: 'SHIPS', transit: 'TRANSIT', place: 'PLACES', space: 'SPACE', sky: 'SKY' };
export const KIND_GLYPH: Record<AimKind, string> = { plane: '✈', ship: '⛴', transit: '▣', place: '⌖', space: '✦', sky: '★' };

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
  /** A sky label: the Sun, the Moon, a planet or a star. */
  body?: SkyKind;
  /** A sky label's brightness (magnitude: smaller is brighter). */
  mag?: number;
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

/** How far away a sky label is drawn as being: as good as endless (it lies at a bearing and a height, not at a place). */
export const SKY_RANGE = 1e13;

/** The words on a sky body's card: what it is, and for the Sun the warning, for the Moon its phase. */
function skyFacts(b: SkyBody): [string, string][] {
  if (b.body === 'sun') return [['What', 'the Sun'], ['Careful', 'Never look at the Sun, by eye or through the camera: it can blind you.']];
  const facts: [string, string][] = [];
  if (b.body === 'moon') {
    facts.push(['What', 'the Moon']);
    if (b.phase) facts.push(['Phase', b.phase.words]);
  } else if (b.body === 'planet') facts.push(['What', 'a planet']);
  else facts.push(['What', b.id === 'star:polaris' ? 'the Pole Star, in Ursa Minor: it marks due north' : `a star in ${b.con ?? 'the sky'}`]);
  if (b.mag != null && b.body !== 'moon') facts.push(['Brightness', brightnessWords(b.mag)]);
  if (b.km != null) facts.push(['Distance', farText(b.km)]);
  return facts;
}

/**
 * Sky bodies as seen targets for AIM: each at its own bearing and height (worked out on the phone),
 * standing at the owner's own spot with an endless range, so the drawing treats it like anything
 * else and nothing about it is ever asked of a feed.
 */
export function skySeen(bodies: SkyBody[], obs: { lat: number; lon: number }): Seen[] {
  return bodies.map((b) => ({
    id: b.id,
    kind: 'sky' as const,
    body: b.body,
    lat: obs.lat,
    lon: obs.lon,
    alt: null,
    title: b.name,
    tag: b.body === 'sun' ? 'never look at it' : b.body === 'moon' ? `${Math.round((b.phase?.lit ?? 0) * 100)}% lit` : b.body === 'planet' ? 'planet' : (b.con ?? 'star'),
    facts: skyFacts(b),
    ...(b.mag != null ? { mag: b.mag } : {}),
    bearing: b.az,
    elevation: b.el,
    range: SKY_RANGE,
    ground: SKY_RANGE,
    dir: direction(b.az, b.el),
  }));
}

/** Where a target lies, in words for the card: a sky body by its direction and height, anything else by bearing, angle and distance. */
export function whereLine(t: Seen): string {
  if (t.kind === 'sky') return whereToLook(t.bearing, t.elevation);
  return `${Math.round(t.bearing)}° ${compassPointOf(t.bearing)} · ${t.elevation >= 0 ? `${t.elevation.toFixed(1)}° up` : `${(-t.elevation).toFixed(1)}° down`} · ${distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)}`;
}

/** The second line of a label: the kind's facts, then how far (a sky body: how high). */
export function labelLine(t: Seen): string {
  if (t.kind === 'sky') return [t.tag, `${Math.round(t.elevation)}° up`].filter(Boolean).join(' · ');
  return [t.tag, distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)].filter(Boolean).join(' · ');
}

/** One line about a target for the brain (`seen`): what it is, where it lies, its facts — data, not instructions. */
export function describeTarget(t: Seen): string {
  if (t.kind === 'sky') {
    const what = t.body === 'planet' ? `the planet "${t.title}"` : t.body === 'star' ? `the star "${t.title}"` : `the ${t.title}`;
    return `aimed at ${what} in the night sky (${Math.round(t.bearing)}° from north, ${t.elevation.toFixed(1)}° up, worked out on the phone; ${t.facts.map(([k, v]) => `${k}: ${v}`).join('; ')})`;
  }
  const where = `${Math.round(t.bearing)}° from north, ${t.elevation >= 0 ? `${t.elevation.toFixed(1)}° up` : `${(-t.elevation).toFixed(1)}° down`}, ${distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)} away`;
  const facts = t.facts.map(([k, v]) => `${k}: ${v}`).join('; ');
  const kind = { plane: 'aircraft', ship: 'ship', transit: 'bus or tram', place: 'place', space: 'satellite', sky: 'thing in the sky' }[t.kind];
  return `aimed at a ${kind} "${t.title}" (${where}; ${facts})`;
}
