/**
 * HOME KNOWS WHERE HE IS (BRIEF-HUD-SCAN-1 5; his words, OWNER-ISSUES 157: "it should know when im home, when im out etc and it
 * changes its design based off that"; 158: on). Three places, each a visibly different Home, each said in one mono line under the
 * stamp, decided HERE, ON THE PHONE, from: his saved place (Settings → Voice & home: HOME), the hour, whether the phone is still or
 * moving and how fast, and the phone's own sense of place ONLY where the browser gives it and he has allowed it already (the
 * permission is never asked for from Home: a `granted` answer is read, nothing else). The rule that cannot bend (131): nothing of
 * it is sent anywhere; the brain never gets live GPS; what reaches it is at most a word (home, out, on the way) and a saved
 * place's name, and only with his question (shell/awareness.ts clientContext: `place`, and Home's own screen line). The stamp's
 * place is a saved place's NAME, never a coordinate. With no sense of place the line says so and never guesses.
 *
 * One switch, ON by default; off, the line says SAVED PLACE ONLY and Home is the home world at every hour. The switch and the
 * sense are kept on this phone (ghosty.settings `placeSense`; the last fix in memory only, never written down).
 */
import { createStore } from '../../../core/store';
import { home, settings } from '../../../state/app';

export type PlaceKind = 'home' | 'out' | 'way' | 'saved';
/** How the phone decided: the saved place matched, the phone's own sense, this phone's speed, the hour alone, or the switch off. */
export type PlaceHow = 'saved' | 'sense' | 'speed' | 'hour' | 'off';

export interface PlaceNow {
  kind: PlaceKind;
  how: PlaceHow;
  /** The nearest saved place's name (never a coordinate). */
  name: string;
  /** The phone's own speed reading, mph, when it is moving; 0 otherwise. Shown, never sent. */
  mph: number;
  /** Whether the browser gave a sense of place at all (allowed and found). */
  sensed: boolean;
  at: number;
}

/** Within this many metres of his saved place, he is at home (a house, its garden and the walk to the corner). */
export const HOME_RADIUS_M = 300;
/** Moving faster than this (metres a second: about 18 mph) he is on the way, not out on foot. */
export const WAY_MS = 8;

const state = createStore<PlaceNow>({ kind: 'home', how: 'hour', name: '', mph: 0, sensed: false, at: 0 });
export const placeNow = state;

/** The phone's own sense, in memory only: the last fix (metres from his saved place, its speed) — never kept, never sent. */
let fix: { lat: number; lon: number; speed: number | null; at: number } | null = null;
let watchId = -1;
/** A check's stand-in for the phone's sense (window.__ghostyPlace: {here: true} at the saved place, {far: true} out, {mph} moving, {none: true} no sense). */
type Fake = { here?: boolean; far?: boolean; mph?: number; none?: boolean } | null;
const fake = (): Fake => (navigator.webdriver ? ((window as unknown as { __ghostyPlace?: Fake }).__ghostyPlace ?? null) : null);

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371e3;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

/** Whether the switch is on (ON by default: 158). */
export const senseOn = (): boolean => settings.get().placeSense !== false;

/** Decide the place now, from what the phone holds; said on the screen, kept here, sent nowhere. */
export function decide(now = Date.now()): PlaceNow {
  const saved = settings.get().home;
  const name = home().name;
  if (!senseOn()) return state.set({ kind: 'saved', how: 'off', name, mph: 0, sensed: false, at: now }), state.get();
  const f = fake();
  if (f) {
    if (f.none) return state.set({ kind: 'home', how: 'hour', name, mph: 0, sensed: false, at: now }), state.get();
    if (f.mph && f.mph > 0) return state.set({ kind: 'way', how: 'speed', name, mph: Math.round(f.mph), sensed: true, at: now }), state.get();
    if (f.far) return state.set({ kind: 'out', how: 'sense', name, mph: 0, sensed: true, at: now }), state.get();
    return state.set({ kind: 'home', how: 'saved', name, mph: 0, sensed: true, at: now }), state.get();
  }
  // no sense of place from the browser (not allowed, or no fix yet, or stale by an hour): the hour and his saved place alone
  if (!fix || now - fix.at > 3_600_000) return state.set({ kind: 'home', how: 'hour', name, mph: 0, sensed: false, at: now }), state.get();
  const speed = fix.speed ?? 0;
  if (speed >= WAY_MS) return state.set({ kind: 'way', how: 'speed', name, mph: Math.round(speed * 2.23694), sensed: true, at: now }), state.get();
  // (no saved place: the phone's sense alone cannot say "home", so a still phone is at home by the hour, a moving one out)
  if (!saved) return state.set({ kind: speed > 1.2 ? 'out' : 'home', how: speed > 1.2 ? 'sense' : 'hour', name, mph: 0, sensed: true, at: now }), state.get();
  const d = metres(fix, saved);
  if (d <= HOME_RADIUS_M) return state.set({ kind: 'home', how: 'saved', name, mph: 0, sensed: true, at: now }), state.get();
  return state.set({ kind: 'out', how: 'sense', name, mph: 0, sensed: true, at: now }), state.get();
}

/**
 * Start reading the phone's own sense of place, only where the browser gives it and he has allowed it before (a `granted`
 * permission is read; nothing is asked). The fix stays in memory. Stops when the switch goes off.
 */
export function startSense(): void {
  if (!senseOn() || watchId >= 0 || typeof navigator === 'undefined' || !navigator.geolocation || navigator.webdriver) return;
  const begin = () => {
    try {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          fix = { lat: p.coords.latitude, lon: p.coords.longitude, speed: Number.isFinite(p.coords.speed ?? NaN) ? p.coords.speed : null, at: Date.now() };
          decide();
        },
        () => undefined,
        { enableHighAccuracy: false, maximumAge: 120_000, timeout: 20_000 },
      );
    } catch {
      watchId = -1;
    }
  };
  // (only an answer already given: Home never puts up the phone's permission sheet)
  const q = navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
  if (q) void q.then((r) => r.state === 'granted' && begin()).catch(() => undefined);
}
export function stopSense(): void {
  if (watchId >= 0) {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch {
      /* gone */
    }
  }
  watchId = -1;
  fix = null;
}

/** The mono line under the stamp, as segments: how the phone knows, and that nothing was sent. */
export function placeLine(p: PlaceNow = state.get()): string[] {
  if (p.how === 'off') return ['Saved place only'];
  if (p.kind === 'way') return ['On the way', `${p.mph} mph`, 'this phone', 'never sent'];
  if (p.kind === 'out') return ['Out', 'from the phone’s own sense', 'never sent'];
  if (p.how === 'saved') return ['At home', 'from your saved place', 'never sent'];
  return ['At home', 'from the hour and your saved place', 'never sent'];
}

/** The word that may ride with his question (and a saved place's name), nothing else: the awareness protocol's `place`. */
export function placeWord(p: PlaceNow = state.get()): { word: 'home' | 'out' | 'on the way'; name: string } | null {
  if (p.how === 'off') return null;
  return { word: p.kind === 'way' ? 'on the way' : p.kind === 'out' ? 'out' : 'home', name: p.name };
}

/** "You are home" / "You are out" / "You are on the way", for the house's kicker. */
export const youAre = (p: PlaceNow = state.get()): string => (p.kind === 'way' ? 'You are on the way' : p.kind === 'out' ? 'You are out' : 'You are home');

settings.subscribe((s, prev) => {
  if (s.placeSense !== prev.placeSense || s.home !== prev.home) {
    if (!senseOn()) stopSense();
    else startSense();
    decide();
  }
});
