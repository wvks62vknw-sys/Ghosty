/**
 * Maps on top of God's Eye, in one sheet with four views — all free, no key, nothing to set up:
 * MAP (the flat map: OpenStreetMap, CARTO, OpenTopoMap, CyclOSM and Esri tiles with overlays,
 * tap-for-what-is-here, routes and measuring — ui/flatmap.ts), Google Street View (look around
 * and walk the street), Google satellite imagery, and the Waze live map (jams, hazards and
 * crashes drivers report right now). Google's and Waze's pages run in a frame with its own
 * origin, so they can't see Ghosty's page, keys or storage; the app's security policy
 * (public/_headers) lets exactly those two hosts be framed and nothing else. No referrer is sent.
 */
import { h } from '../core/dom';
import { button, modal } from './components';
import { createFlatMap, type FlatMap, type FlatMapOptions } from './flatmap';

export type MapView = 'map' | 'street' | 'satellite' | 'traffic';
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
export const mapUrl = (view: Exclude<MapView, 'map'>, s: MapSpot): string => (view === 'street' ? streetViewUrl(s) : view === 'satellite' ? satelliteUrl(s) : wazeUrl(s));

export const MAP_VIEWS: [MapView, string, string][] = [
  ['map', 'MAP', 'OpenStreetMap, OpenTopoMap, CyclOSM and Esri, free. Tap the map for the address, Street View, a route, the elevation and nearby landmarks; MEASURE for distances.'],
  ['street', 'STREET VIEW', 'Google Street View — drag to look around, tap the arrows on the road to move. Photographed on an earlier date: not live.'],
  ['satellite', 'SATELLITE', 'Google satellite imagery — pinch to zoom, drag to move.'],
  ['traffic', 'LIVE TRAFFIC', 'Waze live map — red and orange roads are slow or jammed right now; the icons are hazards, crashes and police that drivers reported.'],
];

let open: { close(): void } | null = null;

/** Open the sheet on a spot (or move it there), showing one of the views; the tabs switch between them. */
export function openMapSheet(view: MapView, spot: MapSpot, opts: FlatMapOptions = {}): { close(): void } {
  open?.close();
  let at: MapSpot = { ...spot };
  let frame: HTMLIFrameElement | null = null;
  let flat: FlatMap | null = null;
  const flatHost = h('div.flathost');
  flatHost.hidden = true;
  const note = h('div.mapnote');
  const tabs = h('div.maptabs');
  const where = h('div.mapwhere');
  const place = () => (where.textContent = `${at.lat.toFixed(4)}°, ${at.lon.toFixed(4)}°`);
  const sheet = h('div.mapsheet', h('div.mapbar', tabs, where), flatHost, note);
  const hooks = {
    streetView: (s: MapSpot) => {
      at = { ...s };
      show('street');
    },
    traffic: (s: MapSpot) => {
      at = { ...s };
      show('traffic');
    },
    close: () => open?.close(),
  };
  flatHost.addEventListener('flatmap:move', (e) => {
    const d = (e as CustomEvent<{ lat: number; lon: number }>).detail;
    at = { ...at, lat: d.lat, lon: d.lon, name: undefined };
    place();
  });
  const show = (v: MapView) => {
    const def = MAP_VIEWS.find((x) => x[0] === v)!;
    note.textContent = def[2];
    for (const b of tabs.children) b.classList.toggle('on', (b as HTMLElement).dataset.view === v);
    // Google's and Waze's frames are made fresh each time and dropped when not shown, so a
    // panorama never keeps running behind the map.
    frame?.remove();
    frame = null;
    if (v === 'map') {
      flatHost.hidden = false;
      if (flat) {
        // Back from Street View or the traffic map: the owner's view, style, overlays, pins and
        // measurements are still there — only the size needs a refresh.
        flat.invalidate();
      } else {
        flat = createFlatMap(flatHost, hooks);
        void flat.open(at, opts).then(() => flat?.invalidate());
      }
    } else {
      if (flat && !flatHost.hidden) at = { ...flat.spot(), name: at.name };
      flatHost.hidden = true;
      frame = h('iframe.mapframe', { title: def[1], sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox', allow: 'fullscreen', referrerpolicy: 'no-referrer' });
      frame.src = mapUrl(v, at);
      flatHost.after(frame);
    }
    place();
  };
  for (const [v, label] of MAP_VIEWS) {
    const b = button(label, () => show(v));
    b.dataset.view = v;
    tabs.append(b);
  }
  open = modal((spot.name || 'GOD’S EYE').toUpperCase(), sheet, () => {
    flat?.destroy();
    open = null;
  });
  show(view);
  return { close: () => open?.close() };
}
