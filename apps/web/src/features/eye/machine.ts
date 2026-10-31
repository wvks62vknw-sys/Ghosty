/**
 * THE MACHINE VIEW (OWNER-ISSUES 61c) — the pure parts, no screen: what the mode turns on, the words he hears, the radius
 * and the sky's filters, the tags on public vehicles, and the state the specs and the hub card read. machineview.ts is the
 * screen (the camera, the boxes, the line); both are a MODE of God's Eye, not a tab.
 *
 * The count is true: what the phone is tracking now within 25 km of the frame's centre (satellites above 10°), from the
 * feeds it already polls — aircraft and buses are public vehicles, never people.
 */
import type { LayerVisibility } from '../../engine/globe';
import type { Vec3 } from '../../engine/math';
import { clockIn, FEED_NAMES, levelWord, type GuardWarning } from '../../../../../packages/shared/src/guardian';

/** What the count covers, and the view the mode frames. */
export const MACHINE_KM = 25;
export const SAT_MIN_EL = 10;
export const MACHINE_RANGE = 14;
export const MACHINE_TILT = 50;

/**
 * The mode's own layers (never kept in ghosty.eye.layers): what moves, his city's outline and his own pins on; what
 * clutters or costs off (cameras, crime, the enforcement map, radar, map tiles, the world's hazards).
 */
export const MACHINE_LAYERS: Partial<LayerVisibility> = {
  air: true, transit: true, ships: true, sats: true, orbits: false, incidents: true, me: true, spot: true, cities: true, coast: true, borders: true,
  cams: false, crime: false, enforce: false, radar: false, imagery: false,
  traffic: false, buildings: false, quakes: false, events: false, alerts: false, disasters: false, aurora: false, buoys: false, cables: false, dispatch: false, grid: false, adm1: false, airports: false, clouds: false,
};

const said = (text: string) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^(?:(?:hey|hi|so|ok|okay|oi|and|but|ghosty|mate)[,!]?\s+)*/, '')
    .replace(/[\s?!.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "machine view", "show me my city", "what are you watching?", "what can you see?" — the Machine view, no model. */
export function machineAsked(text: string): boolean {
  return /^(?:(?:open |show (?:me )?|go to )?(?:the )?machine(?: view| mode)?|show me my city|what are you watching|what can you see|what are you watching right now|what can you see right now)$/.test(said(text));
}

/** Great-circle distance, km. */
export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The things within `km` of the centre, by where each is now (`pos`: its dead-reckoned position). */
export function within<T>(list: Iterable<T>, c: { lat: number; lon: number }, km = MACHINE_KM, pos: (x: T) => { lat: number; lon: number } = (x) => x as unknown as { lat: number; lon: number }): T[] {
  const out: T[] = [];
  for (const x of list) {
    const p = pos(x);
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon) && kmBetween(c, p) <= km) out.push(x);
  }
  return out;
}

/** The nearest `n`, nearest first. */
export function nearest<T>(list: Iterable<T>, c: { lat: number; lon: number }, n: number, pos: (x: T) => { lat: number; lon: number } = (x) => x as unknown as { lat: number; lon: number }): T[] {
  return [...list]
    .map((x) => ({ x, d: kmBetween(c, pos(x)) }))
    .filter((o) => Number.isFinite(o.d))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((o) => o.x);
}

/** How high a thing at `w` (Earth-centred, km) stands in the sky over the centre, in degrees. */
export function elevation(c: { lat: number; lon: number }, w: Vec3): number {
  const r = Math.PI / 180;
  const R = 6371;
  const up: Vec3 = [Math.cos(c.lat * r) * Math.cos(c.lon * r), Math.cos(c.lat * r) * Math.sin(c.lon * r), Math.sin(c.lat * r)];
  const d: Vec3 = [w[0] - up[0] * R, w[1] - up[1] * R, w[2] - up[2] * R];
  const len = Math.hypot(d[0], d[1], d[2]);
  return len ? (Math.asin(Math.max(-1, Math.min(1, (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / len))) * 180) / Math.PI : -90;
}

/** Satellites above 10° over the centre. */
export const overhead = (sats: { w: Vec3 }[], c: { lat: number; lon: number }, min = SAT_MIN_EL) => sats.filter((s) => elevation(c, s.w) > min).length;

/** The West Midlands, where National Highways' incidents can be placed (God's Eye reads that region only). */
export const inWestMidlands = (c: { lat: number; lon: number }) => c.lat > 52.2 && c.lat < 52.8 && c.lon > -2.5 && c.lon < -1.2;
/** The Baltic, where ships are read with no key (Digitraffic's waters). */
export const nearBaltic = (c: { lat: number; lon: number }) => c.lon >= 9 && c.lon <= 31 && c.lat >= 53 && c.lat <= 66.5;

const thousands = (n: number) => Math.round(n).toLocaleString('en-GB');

/** An aircraft's tag: "BAW123 · 7,400 FT", with its one-word type when the feed gives one. */
export function airTag(a: { call: string; hex: string; altft: number; type?: string; gnd?: boolean }): string {
  const name = (a.call || a.hex).trim().toUpperCase();
  const alt = a.gnd ? 'ON THE GROUND' : `${thousands(Math.round(a.altft / 100) * 100)} FT`;
  const type = (a.type ?? '').trim().toUpperCase();
  return `${name} · ${alt}${type && /^[A-Z0-9-]{2,8}$/.test(type) ? ` · ${type}` : ''}`;
}

/** The nearest bus or tram: "LINE 50 · TOWARDS DRUIDS HEATH". */
export function transitTag(v: { line: string; dest?: string }): string {
  const line = v.line.trim().toUpperCase() || '—';
  return `LINE ${line}${v.dest?.trim() ? ` · TOWARDS ${v.dest.trim().toUpperCase()}` : ''}`;
}

/** The worst active warning first (the feeds' level 1 is the most severe). */
const worst = (ws: GuardWarning[]) => [...ws].sort((a, b) => a.level - b.level || b.since - a.since)[0];

/** A place's box label: "HOME", or "HOME · FLOOD ALERT" while a warning is active there. */
export function placeTag(label: string, active: GuardWarning[] = []): string {
  const w = worst(active);
  return `${label.toUpperCase()}${w ? ` · ${levelWord(w).toUpperCase()}` : ''}`;
}

/** Under the home box while a walk is under way: "WALKING HOME · DUE 23:20". */
export const walkTag = (walk: { stage: string; eta: number } | null | undefined, tz: string) => (walk && walk.stage !== 'done' ? `WALKING HOME · DUE ${clockIn(walk.eta, tz)}` : '');

/** "A flood alert is active near Home (Environment Agency, since 14:05)." */
export function warningSentence(w: GuardWarning, place: string, tz: string): string {
  const what = levelWord(w);
  return `${/^[aeiou]/.test(what) ? 'An' : 'A'} ${what} is active near ${place} (${FEED_NAMES[w.feed].source}, since ${clockIn(w.since, tz)}).`;
}

export interface MachineCounts {
  /** The city the frame is over. */
  city: string;
  air: number;
  /** null: the transit feed has nothing here ("no live buses here"). */
  transit: number | null;
  /** null: no ships feed can be read here. */
  ships: number | null;
  sats: number;
  /** null: outside the West Midlands (the incident feed is regional): left out. */
  incidents: number | null;
}

const n = (x: number, one: string, many: string) => `${thousands(x)} ${x === 1 ? one : many}`;

/**
 * The line in his voice: "Watching Birmingham. 41 aircraft, 188 buses and trams, 2 ships, 9 satellites overhead; 3 road
 * incidents. Nothing active near Home." — a warning said instead when there is one, "No ships feed here." when ships can't
 * be read, and today's first expectation ("I expect rain by 15:00.") when foresight has one.
 */
export function countLine(c: MachineCounts, o: { home?: string; warning?: string; expect?: string } = {}): string {
  const parts = [n(c.air, 'aircraft', 'aircraft'), c.transit === null ? 'no live buses here' : n(c.transit, 'bus or tram', 'buses and trams')];
  if (c.ships) parts.push(n(c.ships, 'ship', 'ships'));
  parts.push(`${n(c.sats, 'satellite', 'satellites')} overhead`);
  let line = `Watching ${c.city || 'here'}. ${parts.join(', ')}`;
  if (c.incidents !== null) line += `; ${c.incidents ? n(c.incidents, 'road incident', 'road incidents') : 'no road incidents'}`;
  line += '.';
  if (o.warning) line += ` ${o.warning}`;
  else if (o.home) line += ` Nothing active near ${o.home}.`;
  if (c.ships === null) line += ' No ships feed here.';
  if (o.expect) line += ` ${o.expect.replace(/\s*\(\d+%\)$/, '').replace(/\.?$/, '.')}`;
  return line;
}

/** The Eye hub card's reading while the mode is on: "WATCHING · 41 AIR · 188 TRANSIT". */
export const hubLine = (c: Pick<MachineCounts, 'air' | 'transit'>) => `WATCHING · ${thousands(c.air)} AIR · ${thousands(c.transit ?? 0)} TRANSIT`;

/** Said on the view when there is no saved home. */
export const NO_HOME = "Save home in Memory → ME → PLACES and I'll watch your city; for now this is the phone's home.";

/** What the view shows, for the hub card, the chat and the specs (window.__ghosty.machine). */
export const machineState = {
  on: false,
  /** The first line has been worked out since the mode came on. */
  ready: false,
  /** Where the mode framed: his saved home, or the phone's home setting. */
  centre: null as null | { lat: number; lon: number; label: string; saved: boolean },
  line: '',
  hub: '',
  counts: null as MachineCounts | null,
  /** The boxes drawn: his places (with a warning), the walk, the tagged aircraft, the tagged bus or tram. */
  places: [] as { label: string; tag: string; warning: boolean }[],
  warnings: [] as string[],
  walk: '',
  aircraft: [] as string[],
  transit: '',
  /** The honest edges said on the view. */
  notes: [] as string[],
  /** The slow drift: on, paused while he touches the globe, or stopped (he zoomed somewhere). */
  drift: 'off' as 'off' | 'on' | 'paused' | 'stopped',
};
