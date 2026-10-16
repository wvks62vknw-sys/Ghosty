/**
 * The 3D map: MapLibre GL (vendored, loaded on demand) drawing OpenFreeMap's free vector tiles —
 * streets, labels, relief shading and the buildings in 3D; pinch to zoom, two fingers to rotate
 * and tilt — with no key and nothing to set up. With the owner's free public Mapbox token
 * (System → Keys), Mapbox's live-traffic, satellite and night styles join the list.
 *
 * Tap anywhere: a pin, the address, and buttons for Street View, live traffic, the flat map and
 * flying the globe there. Overlays for railways and rain radar; GPS; GLOBE HERE. The style
 * sheets, tiles, fonts and sprites come straight from tiles.openfreemap.org (allowed in the
 * security policy); the address lookup goes through the brain's caching proxy.
 */
import { brain } from '../api/brain';
import { fetchJson } from '../api/feed';
import { clear, h } from '../core/dom';
import { reverseAddress, shortName, whatIs } from '../data/places';
import { globe } from '../engine/globe';
import { RAD } from '../engine/math';
import { settings } from '../state/app';
import { button, toast } from './components';
import type { MapPoint } from './flatmap';
import type { MapLibreNS, MLLayerSpec, MLMap, MLMarker, MLStyleSpec } from './maplibre';
import type { MapSpot } from './mapurls';

export type Style3dId = 'dark' | 'liberty' | 'bright' | 'positron' | 'fiord' | 'mbtraffic' | 'mbsat' | 'mbnight';
export type Overlay3dId = 'rail' | 'rain';
export interface Map3dOptions {
  style?: Style3dId;
  overlays?: Overlay3dId[];
  points?: MapPoint[];
  /** Join the points with a line. */
  line?: boolean;
  zoom?: number;
  /** Tilt in degrees (0 flat, up to 70). */
  pitch?: number;
  /** Buildings in 3D (on by default). */
  buildings?: boolean;
}
export interface Map3dHooks {
  streetView(spot: MapSpot): void;
  traffic(spot: MapSpot): void;
  flat(spot: MapSpot): void;
  close(): void;
}
export interface Map3d {
  open(spot: MapSpot, opts?: Map3dOptions): Promise<void>;
  spot(): MapSpot;
  /** The host was resized or shown: redraw to fit. */
  invalidate(): void;
  destroy(): void;
}

const OFM = 'https://tiles.openfreemap.org';
const MAPBOX_CREDIT = '© Mapbox © OpenStreetMap';
interface Style3d {
  id: Style3dId;
  label: string;
  /** Needs the owner's Mapbox token. */
  mapbox?: boolean;
  style: (token: string) => string | MLStyleSpec;
}
/** Mapbox's styles as raster tiles (the Static Tiles API works with a public token), with OpenFreeMap's vector tiles underneath for the 3D buildings. */
const mapboxRaster = (id: string, token: string): MLStyleSpec => ({
  version: 8,
  sources: {
    mb: { type: 'raster', tiles: [`https://api.mapbox.com/styles/v1/mapbox/${id}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`], tileSize: 512, maxzoom: 20, attribution: MAPBOX_CREDIT },
    openmaptiles: { type: 'vector', url: `${OFM}/planet` },
  },
  layers: [{ id: 'mb', type: 'raster', source: 'mb' }],
});
export const STYLES3D: Style3d[] = [
  { id: 'dark', label: 'DARK', style: () => `${OFM}/styles/dark` },
  { id: 'liberty', label: 'LIBERTY', style: () => `${OFM}/styles/liberty` },
  { id: 'bright', label: 'BRIGHT', style: () => `${OFM}/styles/bright` },
  { id: 'positron', label: 'POSITRON', style: () => `${OFM}/styles/positron` },
  { id: 'fiord', label: 'FIORD', style: () => `${OFM}/styles/fiord` },
  { id: 'mbtraffic', label: 'LIVE TRAFFIC', mapbox: true, style: (t) => mapboxRaster('traffic-night-v2', t) },
  { id: 'mbsat', label: 'MAPBOX SAT', mapbox: true, style: (t) => mapboxRaster('satellite-streets-v12', t) },
  { id: 'mbnight', label: 'NAV NIGHT', mapbox: true, style: (t) => mapboxRaster('navigation-night-v1', t) },
];
const OVERLAYS: { id: Overlay3dId; label: string }[] = [
  { id: 'rail', label: 'RAIL' },
  { id: 'rain', label: 'RAIN' },
];
/** Buildings in 3D from OpenMapTiles' building layer (render_height is metres), lit by a vertical gradient. */
const buildingsLayer = (): MLLayerSpec => ({
  id: 'ghosty-buildings',
  type: 'fill-extrusion',
  source: 'openmaptiles',
  'source-layer': 'building',
  minzoom: 13,
  paint: {
    'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#243447', 40, '#355173', 120, '#4e7aa3', 300, '#7fb3dd'],
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 8]],
    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_min_height'], 0]],
    'fill-extrusion-opacity': 0.9,
    'fill-extrusion-vertical-gradient': true,
  },
});

let lib: Promise<MapLibreNS> | null = null;
/** MapLibre, loaded once from this site (public/vendor/maplibre) — never bundled, never from a CDN. */
export function loadMapLibre(): Promise<MapLibreNS> {
  lib ??= (async () => {
    if (!document.querySelector('link[href="/vendor/maplibre/maplibre-gl.css"]')) document.head.append(h('link', { rel: 'stylesheet', href: '/vendor/maplibre/maplibre-gl.css' }));
    // A module served next to the app; its address is a plain string so neither the bundler nor
    // the type checker tries to follow it (the types are in maplibre.d.ts).
    const url: string = '/vendor/maplibre/maplibre-gl.mjs';
    const mod = (await import(url)) as { default?: MapLibreNS } & Partial<MapLibreNS>;
    const ml = mod.default ?? (mod as MapLibreNS);
    if (typeof ml.Map !== 'function') throw new Error('MapLibre did not load');
    return ml;
  })();
  return lib;
}

const valid = (p: MapPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lon);

export function createMap3d(host: HTMLElement, hooks: Map3dHooks): Map3d {
  let ML: MapLibreNS | null = null;
  let map: MLMap | null = null;
  let token = '';
  let styleId: Style3dId = 'dark';
  let buildings = true;
  let current: MapSpot = { lat: 0, lon: 0 };
  const overlays = new Set<Overlay3dId>();
  let rainPath: string | null = null;
  let pinned: { points: MapPoint[]; line: boolean } = { points: [], line: false };
  let markers: MLMarker[] = [];
  let pin: MLMarker | null = null;

  const styleRow = h('div.fmchips');
  const toolRow = h('div.fmchips');
  const info = h('div.fminfo');
  const canvasHost = h('div.map3d');
  host.append(h('div.fmbar', styleRow, toolRow), canvasHost, info);

  const mark = (row: HTMLElement, on: (b: HTMLButtonElement) => boolean) => {
    for (const b of row.querySelectorAll('button')) b.classList.toggle('on', on(b));
  };
  const styleFor = (id: Style3dId) => STYLES3D.find((s) => s.id === id)!.style(token);

  // ---------- what every style gets: buildings, overlays, the line between pins ----------
  const firstLabel = () => map?.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  const decorate = () => {
    if (!map) return;
    // Liberty draws its own 3D buildings; ours replace them so the switch works the same everywhere.
    if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', 'none');
    if (buildings && !map.getLayer('ghosty-buildings')) map.addLayer(buildingsLayer(), firstLabel());
    for (const o of overlays) addOverlay(o);
    paintLine();
  };
  const addOverlay = (o: Overlay3dId) => {
    if (!map || map.getLayer(`ov-${o}`)) return;
    if (o === 'rail') {
      map.addSource('ov-rail', { type: 'raster', tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`), tileSize: 256, maxzoom: 19, attribution: '© OpenRailwayMap' });
      map.addLayer({ id: 'ov-rail', type: 'raster', source: 'ov-rail', paint: { 'raster-opacity': 0.85 } }, firstLabel());
    } else if (o === 'rain' && rainPath) {
      map.addSource('ov-rain', { type: 'raster', tiles: [`https://tilecache.rainviewer.com${rainPath}/256/{z}/{x}/{y}/2/1_1.png`], tileSize: 256, maxzoom: 12, attribution: 'rain © RainViewer' });
      map.addLayer({ id: 'ov-rain', type: 'raster', source: 'ov-rain', paint: { 'raster-opacity': 0.7 } }, firstLabel());
    }
  };
  const removeOverlay = (o: Overlay3dId) => {
    if (!map) return;
    if (map.getLayer(`ov-${o}`)) map.removeLayer(`ov-${o}`);
    if (map.getSource(`ov-${o}`)) map.removeSource(`ov-${o}`);
  };
  const toggleOverlay = async (o: Overlay3dId) => {
    if (overlays.has(o)) {
      overlays.delete(o);
      removeOverlay(o);
    } else {
      if (o === 'rain' && !rainPath) {
        const j = await fetchJson<{ radar?: { past?: { path: string }[] } }>('https://api.rainviewer.com/public/weather-maps.json', 300).catch(() => null);
        rainPath = j?.radar?.past?.at(-1)?.path ?? null;
        if (!rainPath) return void toast('Rain radar is not reachable right now', 'warn');
      }
      overlays.add(o);
      addOverlay(o);
    }
    mark(toolRow, (b) => (b.dataset.overlay ? overlays.has(b.dataset.overlay as Overlay3dId) : b.classList.contains('on')));
  };
  const paintLine = () => {
    if (!map) return;
    const pts = pinned.points;
    const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: pinned.line && pts.length > 1 ? pts.map((p) => [p.lon, p.lat]) : [] }, properties: {} };
    const src = map.getSource('ghosty-line');
    if (src) src.setData(data);
    else {
      map.addSource('ghosty-line', { type: 'geojson', data });
      map.addLayer({ id: 'ghosty-line', type: 'line', source: 'ghosty-line', paint: { 'line-color': '#ffd84a', 'line-width': 3, 'line-dasharray': [2, 2] } });
    }
  };
  const paintPins = () => {
    if (!ML || !map) return;
    for (const m of markers) m.remove();
    markers = pinned.points.map((p) => {
      const el = h('div.m3pin', h('i'), ...(p.label ? [h('span', p.label)] : []));
      return new ML!.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(map!);
    });
  };

  // ---------- the pin and what is there ----------
  const dropPin = async (lat: number, lon: number, name?: string) => {
    if (!ML || !map) return;
    // The pin's own spot: the buttons act on it even after the map has been moved (`current`
    // follows the view, and the popup itself pans the map to come into view).
    const here: MapSpot = { lat, lon, name };
    current = here;
    pin?.remove();
    const body = h('div.m3pop');
    const title = h('b', name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    const status = h('div.m3addr', name ? '' : 'Looking up the address…');
    const row = h(
      'div.fmbtns',
      button('STREET VIEW', () => hooks.streetView({ ...here })),
      button('TRAFFIC', () => hooks.traffic({ ...here })),
      button('FLAT MAP', () => hooks.flat({ ...here })),
      button('GLOBE', () => {
        hooks.close();
        globe.cam.flyTo({ lat, lon, range: 2, tilt: 55 });
      }),
    );
    body.append(title, status, row);
    const popup = new ML.Popup({ closeButton: true, closeOnClick: false, maxWidth: '300px', className: 'm3popup', offset: 30 }).setDOMContent(body);
    pin = new ML.Marker({ element: h('div.m3pin.me', h('i')), anchor: 'bottom' }).setLngLat([lon, lat]).setPopup(popup).addTo(map);
    pin.togglePopup();
    try {
      const r = await reverseAddress(lat, lon);
      if (!name && r.name) title.textContent = r.name;
      status.textContent = [whatIs(r), r.display_name].filter(Boolean).join(' — ') || 'No address known here';
      here.name = shortName(r) || here.name;
    } catch {
      status.textContent = 'The address service is not reachable right now.';
    }
  };

  const onMove = () => {
    if (!map) return;
    const c = map.getCenter();
    current = { lat: c.lat, lon: c.lng, name: current.name };
    host.dispatchEvent(new CustomEvent('map3d:move', { detail: { lat: c.lat, lon: c.lng } }));
  };

  // ---------- the chips ----------
  const paintChips = () => {
    clear(
      styleRow,
      ...STYLES3D.filter((s) => !s.mapbox || token).map((s) => {
        const b = button(s.label, () => void setStyle(s.id), 'fmchip');
        b.dataset.style = s.id;
        return b;
      }),
      ...(token ? [] : [h('span.fmchip.fmhint', '+ Mapbox styles with your free token (System → Keys)')]),
    );
    mark(styleRow, (b) => b.dataset.style === styleId);
    const tilt = button('TILT', () => {
      if (!map) return;
      const up = map.getPitch() < 20;
      map.easeTo({ pitch: up ? 60 : 0, duration: 600 });
      tilt.classList.toggle('on', up);
    }, 'fmchip');
    const bld = button('BUILDINGS', () => {
      buildings = !buildings;
      if (map) {
        if (!buildings && map.getLayer('ghosty-buildings')) map.removeLayer('ghosty-buildings');
        else if (buildings) decorate();
      }
      bld.classList.toggle('on', buildings);
    }, 'fmchip');
    bld.classList.toggle('on', buildings);
    const ovs = OVERLAYS.map((o) => {
      const b = button(o.label, () => void toggleOverlay(o.id), 'fmchip');
      b.dataset.overlay = o.id;
      b.classList.toggle('on', overlays.has(o.id));
      return b;
    });
    const gps = button('GPS', () => {
      if (!navigator.geolocation) return void toast('No location on this device', 'warn');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          map?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), 15), duration: 800 });
          void dropPin(p.coords.latitude, p.coords.longitude, 'You');
        },
        () => toast('Location unavailable', 'warn'),
        { timeout: 8000 },
      );
    }, 'fmchip');
    const here = button('GLOBE HERE', () => {
      if (!map) return;
      const c = map.getCenter();
      const km = ((40075 * Math.cos(c.lat * RAD)) / 2 ** map.getZoom()) * (canvasHost.clientWidth / 256);
      hooks.close();
      globe.cam.flyTo({ lat: c.lat, lon: c.lng, range: Math.max(0.5, km * 1.1), tilt: Math.min(60, map.getPitch()), hd: map.getBearing() });
    }, 'fmchip');
    const flat = button('FLAT MAP', () => hooks.flat(current), 'fmchip');
    clear(toolRow, tilt, bld, ...ovs, gps, here, flat);
    if (map) tilt.classList.toggle('on', map.getPitch() >= 20);
  };
  const setStyle = async (id: Style3dId) => {
    styleId = id;
    mark(styleRow, (b) => b.dataset.style === styleId);
    map?.setStyle(styleFor(id)); // 'style.load' decorates it again
  };

  const open = async (spot: MapSpot, opts: Map3dOptions = {}) => {
    current = { ...spot };
    try {
      ML = await loadMapLibre();
    } catch {
      info.textContent = 'The 3D map could not load (its library is missing from this site).';
      return;
    }
    token = (await brain.publicKeys()).mapbox ?? '';
    if (opts.style && STYLES3D.some((s) => s.id === opts.style && (!s.mapbox || token))) styleId = opts.style;
    if (opts.buildings !== undefined) buildings = opts.buildings;
    for (const o of opts.overlays ?? []) overlays.add(o);
    pinned = { points: (opts.points ?? []).filter(valid), line: !!opts.line };
    const zoom = opts.zoom ?? 15.5;
    const pitch = opts.pitch ?? (zoom >= 13 ? 50 : 0);
    if (!map) {
      try {
        map = new ML.Map({ container: canvasHost, style: styleFor(styleId), center: [spot.lon, spot.lat], zoom, pitch, bearing: 0, maxPitch: 70, attributionControl: { compact: false }, fadeDuration: 150, failIfMajorPerformanceCaveat: false });
      } catch (e) {
        info.textContent = `This browser can't draw the 3D map: ${(e as Error).message}`;
        return;
      }
      map.addControl(new ML.NavigationControl({ visualizePitch: true, showZoom: false }), 'top-right');
      map.addControl(new ML.ScaleControl({ maxWidth: 90, unit: settings.get().units === 'imperial' ? 'imperial' : 'metric' }), 'bottom-left');
      map.on('style.load', decorate);
      map.on('click', (e) => void dropPin(e.lngLat.lat, e.lngLat.lng));
      map.on('moveend', onMove);
      map.on('error', (e) => {
        const m = e.error?.message ?? '';
        if (/style|fetch|network|load/i.test(m)) info.textContent = 'Map tiles are not reachable right now.';
      });
      map.once('load', () => (info.textContent = ''));
      info.textContent = 'Loading the map…';
    } else {
      map.setStyle(styleFor(styleId));
      map.jumpTo({ center: [spot.lon, spot.lat], zoom: opts.zoom ?? map.getZoom(), pitch: opts.pitch ?? map.getPitch() });
    }
    paintPins();
    if (pinned.points.length > 1) {
      let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
      for (const p of pinned.points) {
        w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat);
      }
      map.fitBounds([[w, s], [e, n]], { padding: 40, maxZoom: opts.zoom ?? 16, duration: 0, pitch: 0 });
    }
    paintChips();
  };

  return {
    open,
    spot: () => ({ ...current }),
    invalidate: () => map?.resize(),
    destroy: () => {
      map?.remove();
      map = null;
      markers = [];
      pin = null;
    },
  };
}
