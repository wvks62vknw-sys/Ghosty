/**
 * Street View as if you were standing there. From a spot on God's Eye the camera dives down to
 * the street (low, tilted, the buildings in 3D), and then Google's panorama fades in over the
 * whole screen facing the same way — BACK TO GLOBE lifts you out again, and the maps are a tap
 * away. Reached from a tapped spot, a camera or city card, a pin on either map, the STREET
 * button, and "street view of <place>" in chat.
 *
 * The panorama is Google's own page in a locked frame with its own origin: it can't see Ghosty's
 * page, keys or storage, and no referrer is sent (the security policy in public/_headers lets
 * exactly www.google.com and embed.waze.com be framed).
 */
import { h } from '../core/dom';
import { globe } from '../engine/globe';
import { spotLayer } from '../engine/layers/spot';
import { go } from '../shell/tabs';
import { ui } from '../state/app';
import { button } from './components';
import { streetViewUrl, type MapSpot } from './mapurls';

export interface StreetOptions {
  /** Fly God's Eye down to the spot first (the default); false shows the panorama at once. */
  dive?: boolean;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (deg: number): string => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

let open: { el: HTMLElement; spot: MapSpot } | null = null;
export const streetViewOpen = (): boolean => !!open;
/** The spot on screen right now, if Street View is open. */
export const streetViewSpot = (): MapSpot | null => (open ? { ...open.spot } : null);

/**
 * Resolves when the flight that is running now is over: it arrived, a drag or zoom cut it short,
 * another flight replaced it, or the owner left the tab. It follows the frames, not a clock: at
 * full frame rate that is 1.8 s, on a slow device as long as the flight takes.
 */
const settled = () =>
  new Promise<void>((ok) => {
    const mine = globe.cam.fly;
    const tick = () => (globe.cam.fly !== mine || ui.get().tab !== 'eye' ? ok() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
/** Did the dive actually land on the spot? A drag or a zoom cancels the flight (it also ends it), and so does leaving the tab. */
const arrived = (at: MapSpot) => ui.get().tab === 'eye' && globe.cam.range < 0.6 && Math.abs(globe.cam.lat - at.lat) < 0.002 && Math.abs(((globe.cam.lon - at.lon + 540) % 360) - 180) < 0.003;

export async function openStreetView(spot: MapSpot, opts: StreetOptions = {}): Promise<void> {
  closeStreetView(true);
  const at: MapSpot = { ...spot };
  if (opts.dive !== false) {
    go('eye');
    spotLayer.set({ lat: at.lat, lon: at.lon, name: at.name });
    const cam = globe.cam;
    at.heading ??= cam.hd;
    // Down to the street: close in, tilted like a person standing there, facing the way the
    // camera faced. The 3D buildings switch on by themselves this close.
    cam.flyTo({ lat: at.lat, lon: at.lon, range: 0.35, tilt: 72, hd: at.heading }, 1.8);
    await settled();
    if (open) return; // something else opened meanwhile
    if (!arrived(at)) return; // the owner grabbed the globe or left the tab: the dive is cancelled, the pin stays
  } else at.heading ??= globe.cam.hd;

  const frame = h('iframe.svframe', { title: 'Street View', sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox', allow: 'fullscreen', referrerpolicy: 'no-referrer' });
  frame.src = streetViewUrl(at);
  const openSheet = async (view: 'map' | '3d' | 'traffic') => {
    const { openMapSheet } = await import('./mapsheet');
    openMapSheet(view, at);
  };
  const el = h(
    'div#street',
    { role: 'dialog', 'aria-label': 'Street View' },
    h(
      'div.svbar',
      button('◀ GLOBE', () => closeStreetView(), 'warn'),
      h('div.svwhere', h('b', (at.name || 'STREET VIEW').toUpperCase()), h('small', `${at.lat.toFixed(4)}°, ${at.lon.toFixed(4)}° · facing ${compass(at.heading ?? 0)}`)),
      h('span.sp'),
      button('MAP', () => void openSheet('map')),
      button('3D', () => void openSheet('3d')),
      button('TRAFFIC', () => void openSheet('traffic')),
    ),
    frame,
    h('div.svnote', 'Google Street View — drag to look around, tap the arrows on the road to walk. Photographed on an earlier date: not live.'),
  );
  document.body.append(el);
  open = { el, spot: at };
  // It starts transparent and a touch too large, then settles in (styles.css: #street, #street.in).
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  ui.set({});
}

export function closeStreetView(quiet = false): void {
  if (!open) return;
  const { el, spot } = open;
  open = null;
  el.classList.remove('in');
  setTimeout(() => el.remove(), 450);
  // Back up off the street a little, so it reads as the globe again.
  if (!quiet && ui.get().tab === 'eye') globe.cam.flyTo({ lat: spot.lat, lon: spot.lon, range: 1.6, tilt: 55 }, 1.1);
  ui.set({});
}

// Escape leaves Street View — unless a sheet is open over it, which takes the key first.
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open && !document.querySelector('.modal')) closeStreetView();
});
