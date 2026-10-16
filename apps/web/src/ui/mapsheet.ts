/**
 * Maps on top of God's Eye, in one sheet with four views — all free, no key, nothing to set up:
 * MAP (the flat map: OpenStreetMap, OpenTopoMap, CyclOSM and Esri tiles with overlays,
 * tap-for-what-is-here, routes and measuring — ui/flatmap.ts), 3D (MapLibre GL over OpenFreeMap's
 * vector tiles: buildings in 3D, rotate and tilt — ui/map3d.ts; Mapbox's styles too with the
 * owner's token), Google satellite imagery, and the Waze live map (jams, hazards and crashes
 * drivers report right now). Google's and Waze's pages run in a frame with its own origin, so they
 * can't see Ghosty's page, keys or storage; the app's security policy (public/_headers) lets exactly
 * those two hosts be framed and nothing else. No referrer is sent.
 *
 * Street View is not a tab here: it is the immersive view (ui/streetview.ts) that dives in from the
 * globe, and every pin's STREET VIEW button goes there.
 */
import { h } from '../core/dom';
import { button, modal } from './components';
import { createFlatMap, type FlatMap, type FlatMapOptions } from './flatmap';
import { createMap3d, type Map3d, type Map3dOptions } from './map3d';
import { openStreetView } from './streetview';
import { satelliteUrl, wazeUrl, type MapSpot } from './mapurls';

export type { MapSpot } from './mapurls';
export { satelliteUrl, streetViewUrl, wazeUrl } from './mapurls';

export type MapView = 'map' | '3d' | 'satellite' | 'traffic';
export interface MapSheetOptions extends FlatMapOptions {
  /** Options for the 3D view (style, pitch, buildings…); pins and lines come from the flat-map fields. */
  map3d?: Map3dOptions;
}

export const mapUrl = (view: 'satellite' | 'traffic', s: MapSpot): string => (view === 'satellite' ? satelliteUrl(s) : wazeUrl(s));

export const MAP_VIEWS: [MapView, string, string][] = [
  ['map', 'MAP', 'OpenStreetMap, OpenTopoMap, CyclOSM and Esri, free. Tap the map for the address, Street View, a route, the elevation and nearby landmarks; MEASURE for distances.'],
  ['3d', '3D', 'MapLibre over OpenFreeMap — free vector maps with the buildings in 3D. Pinch to zoom, two fingers to rotate and tilt, tap for the address. With your Mapbox token: live traffic colours, satellite and night styles.'],
  ['satellite', 'SATELLITE', 'Google satellite imagery — pinch to zoom, drag to move.'],
  ['traffic', 'LIVE TRAFFIC', 'Waze live map — red and orange roads are slow or jammed right now; the icons are hazards, crashes and police that drivers reported.'],
];

let open: { close(): void } | null = null;

/** Open the sheet on a spot (or move it there), showing one of the views; the tabs switch between them. */
export function openMapSheet(view: MapView, spot: MapSpot, opts: MapSheetOptions = {}): { close(): void } {
  open?.close();
  let at: MapSpot = { ...spot };
  let frame: HTMLIFrameElement | null = null;
  let flat: FlatMap | null = null;
  let map3d: Map3d | null = null;
  const flatHost = h('div.flathost');
  flatHost.hidden = true;
  const host3d = h('div.flathost.m3host');
  host3d.hidden = true;
  const note = h('div.mapnote');
  const tabs = h('div.maptabs');
  const where = h('div.mapwhere');
  const place = () => (where.textContent = `${at.lat.toFixed(4)}°, ${at.lon.toFixed(4)}°`);
  const sheet = h('div.mapsheet', h('div.mapbar', tabs, where), flatHost, host3d, note);
  const close = () => open?.close();
  const hooks = {
    streetView: (s: MapSpot) => {
      // The immersive view: the sheet goes, the globe dives, the panorama takes over.
      close();
      void openStreetView({ ...s });
    },
    traffic: (s: MapSpot) => {
      at = { ...s };
      show('traffic');
    },
    flat: (s: MapSpot) => {
      at = { ...s };
      show('map');
    },
    close,
  };
  const moved = (e: Event) => {
    const d = (e as CustomEvent<{ lat: number; lon: number }>).detail;
    at = { ...at, lat: d.lat, lon: d.lon, name: undefined };
    place();
  };
  flatHost.addEventListener('flatmap:move', moved);
  host3d.addEventListener('map3d:move', moved);
  /** Where the map that is showing has been moved to, so the next view opens there. */
  const leave = () => {
    if (flat && !flatHost.hidden) at = { ...flat.spot(), name: at.name };
    if (map3d && !host3d.hidden) at = { ...map3d.spot(), name: at.name };
  };
  const show = (v: MapView) => {
    const def = MAP_VIEWS.find((x) => x[0] === v)!;
    note.textContent = def[2];
    for (const b of tabs.children) b.classList.toggle('on', (b as HTMLElement).dataset.view === v);
    leave();
    // Google's and Waze's frames are made fresh each time and dropped when not shown, so a
    // page never keeps running behind a map.
    frame?.remove();
    frame = null;
    flatHost.hidden = v !== 'map';
    host3d.hidden = v !== '3d';
    if (v === 'map') {
      if (flat) {
        // Back from another view: the owner's view, style, overlays, pins and measurements are
        // still there — only the size needs a refresh.
        flat.invalidate();
      } else {
        flat = createFlatMap(flatHost, hooks);
        void flat.open(at, opts).then(() => flat?.invalidate());
      }
    } else if (v === '3d') {
      if (map3d) map3d.invalidate();
      else {
        map3d = createMap3d(host3d, hooks);
        void map3d.open(at, { points: opts.points, line: opts.line, zoom: opts.zoom, ...opts.map3d }).then(() => map3d?.invalidate());
      }
    } else {
      frame = h('iframe.mapframe', { title: def[1], sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox', allow: 'fullscreen', referrerpolicy: 'no-referrer' });
      frame.src = mapUrl(v, at);
      host3d.after(frame);
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
    map3d?.destroy();
    open = null;
  });
  show(view);
  return { close: () => open?.close() };
}
