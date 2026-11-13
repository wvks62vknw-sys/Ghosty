/**
 * THE NATURE DIARY (BRIEF-OCT-IDEAS-3 item 9): the Lens's living-things cards kept in the library as a diary ("seen: a robin, 24 Oct, 1.2 km
 * north-east of Birmingham"), only when he taps KEEP on the card, never by itself. Each entry keeps where he was when he kept it, from
 * his own position at that moment: on this phone only (`ghosty.diary`), as a saved place of its own, never sent to the brain.
 * A person is never kept: the Lens does not name one. The diary is read in the Library (features/library/diary.ts).
 */
import { aName, type Living } from '../../../../packages/shared/src/living';

export const DIARY_KEY = 'ghosty.diary';
export const MAX_ENTRIES = 500;

export interface DiaryEntry {
  id: string;
  at: number;
  /** "a robin" */
  name: string;
  /** The Latin name when it differs. */
  latin: string;
  kind: string;
  /** How sure, in words ("about 70 % sure", "probably"). */
  sure: string;
  /** Where he was (his own position at the time), or null when the phone could not say (said on the page). */
  at2: { lat: number; lon: number } | null;
  /** The place in words: a saved place within 400 m, or how far and which way from home. */
  near: string;
}

const rad = Math.PI / 180;
/** Metres between two points (haversine). */
export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(x)));
}
/** The compass point from a to b ("north-east"). */
export function compass(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  const deg = ((Math.atan2(y, x) / rad) + 360) % 360;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8]!;
}

/** Where, in words: a saved place within 400 m ("at Work"), else how far and which way from home ("1.2 km north-east of Birmingham"). */
export function nearWords(at: { lat: number; lon: number }, places: { label: string; lat: number; lon: number }[], home: { name: string; lat: number; lon: number } | null): string {
  const close = places.map((p) => ({ p, d: metres(at, p) })).sort((a, b) => a.d - b.d)[0];
  if (close && close.d <= 400) return `at ${close.p.label}`;
  if (!home) return `${at.lat.toFixed(3)}, ${at.lon.toFixed(3)}`;
  const d = metres(home, at);
  if (d < 150) return `at ${home.name || 'home'}`;
  return `${d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(d < 10_000 ? 1 : 0)} km`} ${compass(home, at)} of ${home.name || 'home'}`;
}

const day = (t: number) => `${new Date(t).getDate()} ${new Date(t).toLocaleString('en-GB', { month: 'short' }).replace(/\.$/, '')}`;
/** "seen: a robin, 24 Oct, 1.2 km north-east of Birmingham". */
export const entryLine = (e: DiaryEntry): string => `seen: ${e.name}, ${day(e.at)}${e.near ? `, ${e.near}` : ''}`;

export function loadDiary(): DiaryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(DIARY_KEY) ?? '[]') as DiaryEntry[];
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}
const listeners = new Set<() => void>();
export const onDiary = (f: () => void): (() => void) => (listeners.add(f), () => listeners.delete(f));
export function saveDiary(list: DiaryEntry[]): boolean {
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    return false;
  }
  for (const f of listeners) f();
  return true;
}

/** His position now, asked once for this KEEP (a granted permission answers at once; a refusal or a wait of four seconds is null). */
export function whereNow(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null), { maximumAge: 120_000, timeout: 4000 });
  });
}

/** KEEP on a living card: the entry, with where he is (null when he could not be placed), kept on this phone. A person is never kept. */
export function entryFor(l: Living, where: { lat: number; lon: number } | null, places: { label: string; lat: number; lon: number }[], home: { name: string; lat: number; lon: number } | null, now = Date.now()): DiaryEntry | null {
  if (l.kind === 'person' || l.kind === 'none') return null;
  const common = l.common || l.species;
  if (!common) return null;
  return {
    id: `n${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    at: now,
    name: aName(l),
    latin: l.species && l.species !== common ? l.species : '',
    kind: l.kind,
    sure: l.level === 'sure' ? 'sure' : l.score != null ? `about ${Math.round(l.score * 100)} % sure` : l.level,
    at2: where,
    near: where ? nearWords(where, places, home) : '',
  };
}

/** KEEP's word for the card, said plainly (the place is on this phone only). */
export const keptWords = (e: DiaryEntry): string => `Kept in the Library’s nature diary: ${entryLine(e)}${e.at2 ? '. Where you were is on this phone only.' : '. I couldn’t place you, so no place was kept.'}`;
