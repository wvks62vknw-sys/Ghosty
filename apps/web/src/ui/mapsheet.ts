/**
 * Street level and live traffic on top of God's Eye, from Google's and Waze's own embeddable
 * pages — free, no key, no account, nothing to set up: Google Street View (look around and
 * walk the street), Google satellite imagery, and the Waze live map (jams, hazards and crashes
 * drivers report right now). Each page runs in a frame with its own origin, so it can't see
 * Ghosty's page, keys or storage; the app's security policy (public/_headers) lets exactly
 * these two hosts be framed and nothing else. No referrer is sent to them.
 */
import { h } from '../core/dom';
import { button, modal } from './components';

export type MapView = 'street' | 'satellite' | 'traffic';
export interface MapSpot {
  lat: number;
  lon: number;
  name?: string;
  /** Compass heading to face in Street View (degrees). */
  heading?: number;
  /** Up/down in Street View (degrees, positive looks up). */
  pitch?: number;
}

const f = (n: number) => Number(n.toFixed(6));
/** Google Street View at a spot: Google snaps to the nearest panorama (and says when there is none). */
export const streetViewUrl = (s: MapSpot): string => `https://www.google.com/maps/embed?origin=mfe&pb=!6m7!1m6!2m2!1d${f(s.lat)}!2d${f(s.lon)}!3f${Math.round(s.heading ?? 0)}!4f${-Math.round(s.pitch ?? 0)}!5f1`;
export const satelliteUrl = (s: MapSpot, zoom = 17): string => `https://www.google.com/maps/embed?origin=mfe&pb=!1m4!2m1!1s${f(s.lat)},${f(s.lon)}!5e1!6i${zoom}`;
export const wazeUrl = (s: MapSpot, zoom = 14): string => `https://embed.waze.com/iframe?zoom=${zoom}&lat=${f(s.lat)}&lon=${f(s.lon)}&ct=livemap&pin=1`;
export const mapUrl = (view: MapView, s: MapSpot): string => (view === 'street' ? streetViewUrl(s) : view === 'satellite' ? satelliteUrl(s) : wazeUrl(s));

export const MAP_VIEWS: [MapView, string, string][] = [
  ['street', 'STREET VIEW', 'Google Street View — drag to look around, tap the arrows on the road to move. Photographed on an earlier date: not live.'],
  ['satellite', 'SATELLITE', 'Google satellite imagery — pinch to zoom, drag to move.'],
  ['traffic', 'LIVE TRAFFIC', 'Waze live map — red and orange roads are slow or jammed right now; the icons are hazards, crashes and police that drivers reported.'],
];

let open: { close(): void } | null = null;

/** Open the sheet on a spot (or move it there), showing one of the three views; the tabs switch between them. */
export function openMapSheet(view: MapView, spot: MapSpot): HTMLIFrameElement {
  open?.close();
  const frame = h('iframe.mapframe', { title: 'Map', sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox', allow: 'fullscreen', referrerpolicy: 'no-referrer' });
  const note = h('div.mapnote');
  const tabs = h('div.maptabs');
  const show = (v: MapView) => {
    const def = MAP_VIEWS.find((x) => x[0] === v)!;
    frame.src = mapUrl(v, spot);
    frame.title = def[1];
    note.textContent = def[2];
    for (const b of tabs.children) b.classList.toggle('on', (b as HTMLElement).dataset.view === v);
  };
  for (const [v, label] of MAP_VIEWS) {
    const b = button(label, () => show(v));
    b.dataset.view = v;
    tabs.append(b);
  }
  const where = h('div.mapwhere', `${spot.lat.toFixed(4)}°, ${spot.lon.toFixed(4)}°`);
  const sheet = h('div.mapsheet', h('div.mapbar', tabs, where), frame, note);
  open = modal((spot.name || 'GOD’S EYE').toUpperCase(), sheet, () => (open = null));
  show(view);
  return frame;
}
