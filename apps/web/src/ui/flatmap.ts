/**
 * The flat map: Leaflet (vendored, loaded on demand) over free, keyless map tiles — OpenStreetMap
 * streets (and the same tiles filtered dark, Ghosty's own look), OpenTopoMap, CyclOSM and Esri
 * satellite — with rail,
 * sea-mark and rain-radar overlays, Ghosty's live CCTV and ANPR/speed cameras, and, when the owner
 * has set a free Mapbox token, Mapbox's maps with live traffic colours.
 *
 * Tap anywhere: a pin, the address (OpenStreetMap), and buttons for Street View, live traffic,
 * a route there, the elevation, nearby landmarks from Wikipedia, and flying the globe there.
 * MEASURE: tap points for a distance. GPS: where the phone is. Lookups go through the brain's
 * caching proxy; tiles load straight from the map services (allowed in the security policy).
 */
import { brain } from '../api/brain';
import { fetchJson } from '../api/feed';
import { clear, fmt, h } from '../core/dom';
import { globe } from '../engine/globe';
import { routeLayer } from '../engine/layers/route';
import { RAD } from '../engine/math';
import { World } from '../engine/world';
import { home, ui } from '../state/app';
import { cams, type Camera } from '../data/cameras';
import { reverseAddress, shortName, whatIs } from '../data/places';
import { enforce, ENFORCE_LABEL } from '../data/enforce';
import { legColor, legPath, modeWord, type Journey } from '../data/journey';
import { button, toast } from './components';
import type { MapSpot } from './mapurls';

export type StyleId = 'dark' | 'streets' | 'topo' | 'cycle' | 'satellite' | 'traffic' | 'mapbox' | 'night';
export type OverlayId = 'rail' | 'sea' | 'rain' | 'cctv' | 'cameras';
export interface MapPoint {
  lat: number;
  lon: number;
  label?: string;
}
export interface FlatMapOptions {
  style?: StyleId;
  overlays?: OverlayId[];
  points?: MapPoint[];
  /** Join the points with a line (a measured distance, a straight-line path). */
  line?: boolean;
  zoom?: number;
}
export interface FlatMapHooks {
  streetView(spot: MapSpot): void;
  traffic(spot: MapSpot): void;
  close(): void;
}

const OSM = '© OpenStreetMap contributors';
interface Style {
  id: StyleId;
  label: string;
  url: (token: string) => string;
  options: L.TileLayerOptions;
  /** Needs the owner's Mapbox token (System → Keys). */
  mapbox?: boolean;
}
export const STYLES: Style[] = [
  // DARK is OpenStreetMap's own tiles, inverted and hue-rotated by a CSS filter (styles.css .osm-dark):
  // a proper dark map from the same free source, no extra provider.
  { id: 'dark', label: 'DARK', url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options: { maxZoom: 19, attribution: `${OSM} (dark)`, className: 'osm-dark' } },
  { id: 'streets', label: 'STREETS', url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options: { maxZoom: 19, attribution: OSM } },
  { id: 'topo', label: 'TOPO', url: () => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', options: { subdomains: 'abc', maxZoom: 17, attribution: `${OSM}, SRTM · © OpenTopoMap (CC-BY-SA)` } },
  { id: 'cycle', label: 'CYCLE', url: () => 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', options: { subdomains: 'abc', maxZoom: 20, attribution: `${OSM} · CyclOSM` } },
  { id: 'satellite', label: 'SATELLITE', url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 19, attribution: '© Esri, Maxar, Earthstar Geographics' } },
  { id: 'traffic', label: 'LIVE TRAFFIC', mapbox: true, url: (t) => `https://api.mapbox.com/styles/v1/mapbox/traffic-night-v2/tiles/256/{z}/{x}/{y}{r}?access_token=${t}`, options: { maxZoom: 20, attribution: '© Mapbox © OpenStreetMap' } },
  { id: 'mapbox', label: 'MAPBOX', mapbox: true, url: (t) => `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}{r}?access_token=${t}`, options: { maxZoom: 20, attribution: '© Mapbox © OpenStreetMap © Maxar' } },
  { id: 'night', label: 'NAV NIGHT', mapbox: true, url: (t) => `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}{r}?access_token=${t}`, options: { maxZoom: 20, attribution: '© Mapbox © OpenStreetMap' } },
];
const OVERLAYS: { id: OverlayId; label: string }[] = [
  { id: 'rail', label: 'RAIL' },
  { id: 'sea', label: 'SEA MARKS' },
  { id: 'rain', label: 'RAIN' },
  { id: 'cctv', label: 'CCTV' },
  { id: 'cameras', label: 'ANPR / SPEED' },
];

let leaflet: Promise<typeof L> | null = null;
/** Load Leaflet once, from this site (public/vendor/leaflet). */
export function loadLeaflet(): Promise<typeof L> {
  leaflet ??= new Promise((ok, fail) => {
    if (typeof L !== 'undefined') return ok(L);
    if (!document.querySelector('link[href="/vendor/leaflet/leaflet.css"]')) document.head.append(h('link', { rel: 'stylesheet', href: '/vendor/leaflet/leaflet.css' }));
    const s = h('script', { src: '/vendor/leaflet/leaflet.js', async: true });
    s.addEventListener('load', () => (typeof L !== 'undefined' ? ok(L) : fail(new Error('Leaflet did not load'))));
    s.addEventListener('error', () => fail(new Error('Leaflet did not load')));
    document.head.append(s);
  });
  return leaflet;
}

const km = (m: number) => (m < 1000 ? `${Math.round(m)} m` : m < 10000 ? `${(m / 1000).toFixed(2)} km` : `${(m / 1000).toFixed(1)} km`);
const miles = (m: number) => `${(m / 1609.344).toFixed(m < 16000 ? 2 : 1)} mi`;
const dur = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);

interface OsrmRoute {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: { name: string; distance: number; maneuver: { type: string; modifier?: string } }[] }[] }[];
}
interface WikiPage {
  title: string;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
}

export interface FlatMap {
  open(spot: MapSpot, opts?: FlatMapOptions): Promise<void>;
  /** Where the map is looking (for the other views). */
  spot(): MapSpot;
  /** Draw a public-transport journey leg by leg (ui/journeysheet.ts); null clears it. */
  showJourney(journey: Journey | null): void;
  /** Look at a point (a step of the journey the owner tapped). */
  panTo(lat: number, lon: number, zoom?: number): void;
  invalidate(): void;
  destroy(): void;
}

/** Build the flat map inside `host` (an empty block that fills its parent). */
export function createFlatMap(host: HTMLElement, hooks: FlatMapHooks): FlatMap {
  const bar = h('div.fmbar');
  const styleRow = h('div.fmchips');
  const overlayRow = h('div.fmchips');
  const toolRow = h('div.fmchips');
  const search = h('input.fmsearch', { placeholder: 'Find a place or postcode…', 'aria-label': 'Find a place' });
  const mapEl = h('div.flatmap', { 'aria-label': 'Map' });
  const info = h('div.fminfo');
  const steps = h('div.fmsteps');
  steps.hidden = true;
  info.hidden = true;
  host.append(bar, mapEl, info, steps);
  bar.append(h('div.fmsearchrow', search, button('GO', () => void find())), styleRow, overlayRow, toolRow);

  let map: L.Map | null = null;
  let base: L.TileLayer | null = null;
  let styleId: StyleId = 'dark';
  let token = '';
  const overlays = new Map<OverlayId, L.Layer>();
  let pin: L.Marker | null = null;
  let extra: L.LayerGroup | null = null;
  let route: L.Polyline | null = null;
  let journeyLayer: L.LayerGroup | null = null;
  let journey: Journey | null = null;
  let measure: { on: boolean; pts: L.LatLng[]; line: L.Polyline | null; dots: L.LayerGroup | null } = { on: false, pts: [], line: null, dots: null };
  let gpsHere: { lat: number; lon: number } | null = null;
  let current: MapSpot = { lat: 0, lon: 0 };
  let moveTimer = 0;

  const chip = (label: string, on: () => void) => {
    const b = button(label, () => on());
    b.classList.add('fmchip');
    return b;
  };
  const mark = (row: HTMLElement, active: (b: HTMLButtonElement) => boolean) => {
    for (const b of row.querySelectorAll('button')) b.classList.toggle('on', active(b));
  };

  // ---------- base styles ----------
  const paintStyles = () => {
    clear(styleRow);
    for (const s of STYLES) {
      if (s.mapbox && !token) continue;
      const b = chip(s.label, () => void setStyle(s.id));
      b.dataset.style = s.id;
      styleRow.append(b);
    }
    if (!token) {
      const hint = chip('+ LIVE TRAFFIC', () => toast('Live traffic colours on this map (jams in red, like Google Maps) need a free Mapbox token: System → Keys → "Mapbox token". Everything else here works without it.', 'warn'));
      hint.classList.add('fmhint');
      styleRow.append(hint);
    }
    mark(styleRow, (b) => b.dataset.style === styleId);
  };
  const setStyle = async (id: StyleId) => {
    const s = STYLES.find((x) => x.id === id) ?? STYLES[0]!;
    if (s.mapbox && !token) return;
    styleId = s.id;
    const Lf = await loadLeaflet();
    if (!map) return;
    base?.remove();
    base = Lf.tileLayer(s.url(token), { ...s.options, referrerPolicy: 'no-referrer' }).addTo(map);
    mark(styleRow, (b) => b.dataset.style === styleId);
  };

  // ---------- overlays ----------
  const paintOverlays = () => {
    clear(overlayRow);
    for (const o of OVERLAYS) {
      const b = chip(o.label, () => void toggleOverlay(o.id));
      b.dataset.overlay = o.id;
      overlayRow.append(b);
    }
    mark(overlayRow, (b) => overlays.has(b.dataset.overlay as OverlayId));
  };
  const drawCams = async (id: 'cctv' | 'cameras', group: L.LayerGroup) => {
    const Lf = await loadLeaflet();
    if (!map) return;
    group.clearLayers();
    const b = map.getBounds().pad(0.2);
    const c = map.getCenter();
    if (id === 'cctv') {
      const list = cams.list.filter((x) => b.contains([x.lat, x.lon])).slice(0, 400);
      for (const x of list) {
        const m = Lf.circleMarker([x.lat, x.lon], { radius: 6, color: '#4fd1ff', weight: 1.5, fillColor: '#0a2a3a', fillOpacity: 0.9 }).addTo(group);
        m.bindTooltip(`${x.name} · ${x.src.toUpperCase()}`, { direction: 'top', offset: [0, -6] });
        m.on('click', () => void openCamera(x));
      }
      if (!list.length) note(cams.list.length ? 'No public live cameras in view (London, Durham, New York, California, Finland, Canada, Sydney have them).' : 'Loading the public camera lists…');
    } else {
      const radius = Math.min(60, Math.max(3, map.distance(b.getSouthWest(), b.getNorthEast()) / 2000));
      await enforce.refresh(c.lat, c.lng, radius).catch(() => undefined);
      const list = enforce.near(c.lat, c.lng, radius).filter((x) => x.kind !== 'cctv').slice(0, 600);
      for (const x of list) {
        const anpr = x.kind === 'anpr';
        const m = Lf.circleMarker([x.lat, x.lon], { radius: 5, color: anpr ? '#ff7ad9' : '#ffd84a', weight: 1.5, fillColor: '#1a1200', fillOpacity: 0.9 }).addTo(group);
        m.bindTooltip(`${ENFORCE_LABEL[x.kind]}${x.maxspeed ? ` · ${x.maxspeed}` : ''}`, { direction: 'top', offset: [0, -5] });
      }
      note(list.length ? `${list.length} mapped ANPR, speed, average-speed, red-light and bus-lane cameras in view (OpenStreetMap)` : 'No mapped enforcement cameras in view.');
    }
  };
  const toggleOverlay = async (id: OverlayId) => {
    const Lf = await loadLeaflet();
    if (!map) return;
    const had = overlays.get(id);
    if (had) {
      had.remove();
      overlays.delete(id);
    } else {
      let layer: L.Layer;
      if (id === 'rail') layer = Lf.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, opacity: 0.85, attribution: 'OpenRailwayMap (CC-BY-SA)', referrerPolicy: 'no-referrer' });
      else if (id === 'sea') layer = Lf.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, attribution: 'OpenSeaMap (CC-BY-SA)', referrerPolicy: 'no-referrer' });
      else if (id === 'rain') {
        const j = await fetchJson<{ radar?: { past?: { path: string; time: number }[] } }>('https://api.rainviewer.com/public/weather-maps.json', 300).catch(() => null);
        const last = j?.radar?.past?.at(-1);
        if (!last) return toast('The rain radar is not reachable right now', 'warn');
        layer = Lf.tileLayer(`https://tilecache.rainviewer.com${last.path}/256/{z}/{x}/{y}/2/1_1.png`, { maxZoom: 18, opacity: 0.7, attribution: 'RainViewer', referrerPolicy: 'no-referrer' });
        note(`Rain radar ${fmt.ago(last.time * 1000)}`);
      } else {
        const g = Lf.layerGroup();
        layer = g;
        void drawCams(id, g);
      }
      layer.addTo(map);
      overlays.set(id, layer);
    }
    mark(overlayRow, (b) => overlays.has(b.dataset.overlay as OverlayId));
  };

  // ---------- tools ----------
  const note = (text: string) => {
    info.textContent = text;
    info.hidden = !text;
  };
  const clearMeasure = () => {
    measure.line?.remove();
    measure.dots?.remove();
    measure = { on: measure.on, pts: [], line: null, dots: null };
    if (measure.on) note('MEASURE: tap the map to add points.');
  };
  const measureBtn = chip('MEASURE', () => {
    measure.on = !measure.on;
    measureBtn.classList.toggle('on', measure.on);
    if (measure.on) note('MEASURE: tap the map to add points.');
    else {
      clearMeasure();
      note('');
    }
  });
  const gpsBtn = chip('GPS', () => {
    if (!navigator.geolocation) return toast('No location on this device', 'warn');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        gpsHere = { lat: p.coords.latitude, lon: p.coords.longitude };
        void loadLeaflet().then((Lf) => {
          if (!map) return;
          extra?.clearLayers();
          const m = Lf.circleMarker([gpsHere!.lat, gpsHere!.lon], { radius: 8, color: '#fff', weight: 2, fillColor: '#2b8cff', fillOpacity: 1 });
          extra?.addLayer(m);
          map.setView([gpsHere!.lat, gpsHere!.lon], Math.max(map.getZoom(), 15));
          note(`You are here (±${Math.round(p.coords.accuracy)} m)`);
        });
      },
      () => toast('Location unavailable', 'warn'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
  const globeBtn = chip('GLOBE HERE', () => {
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    // The globe's zoom formula, inverted: the width of the view at this zoom, as a camera distance.
    const viewKm = (40075 * Math.max(0.05, Math.cos(c.lat * RAD)) * (window.innerHeight || 844)) / (256 * 2 ** z);
    hooks.close();
    globe.cam.flyTo({ lat: c.lat, lon: c.lng, range: Math.max(0.6, viewKm), tilt: z >= 14 ? 55 : 0 });
  });
  const routeClear = chip('CLEAR ROUTE', () => {
    route?.remove();
    route = null;
    steps.hidden = true;
    clear(steps);
    routeClear.hidden = true;
  });
  routeClear.hidden = true;
  toolRow.append(measureBtn, gpsBtn, globeBtn, routeClear);

  const find = async () => {
    const q = search.value.trim();
    if (!q) return;
    const { locatePlace } = await import('../commands/builtin');
    const w = await locatePlace(q);
    if (!w) return toast(`Nothing found for ${q}`, 'warn');
    search.value = '';
    await open({ lat: w.lat, lon: w.lon, name: w.name }, { zoom: 15 });
    void dropPin(w.lat, w.lon, w.name);
  };
  search.addEventListener('keydown', (e) => e.key === 'Enter' && void find());

  const openCamera = async (c: Camera) => {
    const { openNearestCamera } = await import('../features/eye');
    hooks.close();
    openNearestCamera?.(c.lat, c.lon, 2);
  };

  // ---------- the pin and what is there ----------
  const dropPin = async (lat: number, lon: number, name?: string) => {
    const Lf = await loadLeaflet();
    if (!map) return;
    // The pin's own spot: the buttons act on it even after the map has been moved (`current`
    // follows the view, and the popup itself pans the map to come into view).
    const here: MapSpot = { lat, lon, name };
    current = here;
    pin?.remove();
    pin = Lf.marker([lat, lon]).addTo(map);
    const body = h('div.fmpop');
    const title = h('b', name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    const status = h('div.fmaddr', name ? '' : 'Looking up the address…');
    const out = h('div.fmout');
    const row = h(
      'div.fmbtns',
      button('STREET VIEW', () => hooks.streetView({ ...here })),
      button('TRAFFIC', () => hooks.traffic({ ...here })),
      button('ROUTE HERE', () => void routeTo(current)),
      button('JOURNEY', () => void journeyTo(here)),
      button('ELEVATION', () => void elevation(lat, lon, out)),
      button('NEARBY', () => void wiki(lat, lon, out)),
      button('GLOBE', () => {
        hooks.close();
        globe.cam.flyTo({ lat, lon, range: 2, tilt: 55 });
      }),
    );
    body.append(title, status, out, row);
    pin.bindPopup(body, { maxWidth: 320, minWidth: 240, className: 'fmpopup', autoPanPadding: [16, 60] }).openPopup();
    try {
      const r = await reverseAddress(lat, lon);
      if (!name && r.name) title.textContent = r.name;
      status.textContent = [whatIs(r), r.display_name].filter(Boolean).join(' — ') || 'No address known here';
      if (r.address?.postcode) status.append(h('div.fmpc', `POSTCODE ${r.address.postcode}`));
      here.name = shortName(r) || here.name;
    } catch {
      status.textContent = 'The address service is not reachable right now.';
    }
  };
  const elevation = async (lat: number, lon: number, out: HTMLElement) => {
    try {
      const j = await fetchJson<{ elevation?: number[] }>(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`, 86400);
      const m = j.elevation?.[0];
      clear(out, m == null ? 'No elevation data here.' : `Elevation: ${Math.round(m)} m (${Math.round(m * 3.28084)} ft) above sea level — Copernicus DEM, 90 m.`);
    } catch {
      clear(out, 'The elevation service is not reachable right now.');
    }
  };
  const wiki = async (lat: number, lon: number, out: HTMLElement) => {
    clear(out, 'Looking for landmarks nearby…');
    try {
      const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${lat.toFixed(5)}|${lon.toFixed(5)}&ggsradius=800&ggslimit=6&prop=extracts|coordinates&exintro=1&explaintext=1&exsentences=2&exlimit=6`;
      const j = await fetchJson<{ query?: { pages?: Record<string, WikiPage> } }>(u, 3600);
      const pages = Object.values(j.query?.pages ?? {});
      if (!pages.length) return clear(out, 'Nothing on Wikipedia within 800 m.');
      const Lf = await loadLeaflet();
      clear(out);
      extra?.clearLayers();
      for (const p of pages) {
        const c = p.coordinates?.[0];
        const d = c && map ? ` · ${km(map.distance([lat, lon], [c.lat, c.lon]))}` : '';
        out.append(h('div.fmwiki', h('b', `${p.title}${d}`), h('span', p.extract?.slice(0, 220) || '')));
        if (c && extra) {
          const m = Lf.circleMarker([c.lat, c.lon], { radius: 6, color: '#ffd84a', weight: 1.5, fillColor: '#3a2a00', fillOpacity: 0.9 });
          m.bindTooltip(p.title, { direction: 'top', offset: [0, -6] });
          extra.addLayer(m);
        }
      }
    } catch {
      clear(out, 'Wikipedia is not reachable right now.');
    }
  };
  const routeTo = async (to: MapSpot) => {
    const from = gpsHere ?? home();
    const Lf = await loadLeaflet();
    if (!map) return;
    note(`Route from ${gpsHere ? 'where you are' : home().name}…`);
    try {
      const j = await fetchJson<OsrmRoute>(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=true`, 60);
      const r = j.routes?.[0];
      if (j.code !== 'Ok' || !r) return note('No road route between those places.');
      const path = r.geometry.coordinates.map(([x, y]) => [y, x] as [number, number]);
      route?.remove();
      route = Lf.polyline(path, { color: '#4fd1ff', weight: 5, opacity: 0.9 }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [30, 30] });
      routeClear.hidden = false;
      const list = r.legs.flatMap((l) => l.steps).filter((s) => s.maneuver.type !== 'new name' && (s.distance > 150 || s.maneuver.type === 'arrive' || s.maneuver.type === 'depart'));
      clear(steps, h('b', `${km(r.distance)} · ${dur(r.duration)} by car${gpsHere ? ' from where you are' : ` from ${home().name}`}`), ...list.slice(0, 18).map((s, i) => h('div', `${i + 1}. ${stepText(s)}${s.maneuver.type !== 'arrive' ? ` — ${km(s.distance)}` : ''}`)));
      steps.hidden = false;
      note('');
      // the same route on the globe
      const thin = path.filter((_, i) => i % Math.max(1, Math.ceil(path.length / 600)) === 0);
      if (!globe.layers.includes(routeLayer)) globe.layers.push(routeLayer);
      routeLayer.set({ path: thin, from: gpsHere ? 'You' : home().name, to: to.name ?? '', mode: 'driving', distance_m: r.distance, duration_s: r.duration });
      globe.vis = { ...globe.vis, route: true };
      ui.set({});
    } catch {
      note('The routing service is not reachable right now.');
    }
  };
  const stepText = (s: { name: string; maneuver: { type: string; modifier?: string } }) => {
    const on = s.name ? ` onto ${s.name}` : '';
    const mod = s.maneuver.modifier ?? '';
    switch (s.maneuver.type) {
      case 'depart':
        return `Set off${s.name ? ` along ${s.name}` : ''}`;
      case 'arrive':
        return 'Arrive';
      case 'roundabout':
      case 'rotary':
        return `At the roundabout, take the exit${on}`;
      case 'merge':
        return `Merge${on}`;
      case 'fork':
        return `Keep ${mod || 'ahead'}${on}`;
      case 'continue':
        return `Continue ${mod || 'ahead'}${on}`;
      default:
        return `${mod ? `Turn ${mod.replace(/^(slight|sharp) /, '$1 ')}` : s.maneuver.type}${on}`;
    }
  };

  // The GO panel with this spot as the destination (ui/journeysheet.ts): the sheet closes, the planner opens.
  const journeyTo = async (to: MapSpot) => {
    const { openJourneyPlanner } = await import('./journeysheet');
    hooks.close();
    openJourneyPlanner({ to: `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`, toName: to.name || 'the pinned spot' });
  };

  // ---------- a journey (ui/journeysheet.ts): each leg in its line's colour, its stops as dots, the ends and changes ringed ----------
  const drawJourney = () => {
    void loadLeaflet().then((Lf) => {
      if (!map || !journeyLayer) return;
      journeyLayer.clearLayers();
      const j = journey;
      if (!j) return;
      const group = journeyLayer;
      let bb: L.LatLngBounds | null = null;
      const ring = (p: { lat: number; lon: number; name: string }, fill: string, what: string) =>
        group.addLayer(Lf.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: fill, fillOpacity: 1, className: 'jend' }).bindTooltip(`${what}${p.name ? `: ${p.name}` : ''}`, { direction: 'top', offset: [0, -6] }));
      for (const [i, leg] of j.legs.entries()) {
        const path = legPath(leg);
        if (path.length < 2) continue;
        const color = legColor(leg);
        const walk = leg.mode === 'walk';
        // A dark casing under each line keeps it readable over any tiles.
        group.addLayer(Lf.polyline(path, { color: '#02070d', weight: walk ? 7 : 10, opacity: 0.75, lineCap: 'round', className: 'jcase' }));
        group.addLayer(Lf.polyline(path, { color, weight: walk ? 3 : 5, opacity: 0.95, lineCap: 'round', className: 'jleg', ...(walk ? { dashArray: '4 8' } : {}) }));
        for (const p of path) bb = bb ? bb.extend(p) : Lf.latLngBounds(p, p);
        for (const s of leg.stops) group.addLayer(Lf.circleMarker([s.lat, s.lon], { radius: 3, color, weight: 1.5, fillColor: '#02070d', fillOpacity: 1, className: 'jstop' }).bindTooltip(s.name, { direction: 'top', offset: [0, -4] }));
        if (i === 0) ring(leg.from, '#52f2b5', 'Start');
        if (i === j.legs.length - 1) ring(leg.to, '#ff4d6a', 'End');
        else {
          const next = j.legs[i + 1]!;
          const board = next.mode !== 'walk';
          ring(leg.to, board ? legColor(next) : color, board ? `Get on the ${next.line || modeWord(next)}` : 'Get off');
        }
      }
      if (bb) map.fitBounds(bb.pad(0.12), { padding: [24, 24], maxZoom: 16 });
    });
  };

  // ---------- open / move ----------
  const onClick = (e: L.LeafletMouseEvent) => {
    if (measure.on) {
      void loadLeaflet().then((Lf) => {
        if (!map) return;
        measure.pts.push(e.latlng);
        measure.dots ??= Lf.layerGroup().addTo(map);
        measure.dots.addLayer(Lf.circleMarker(e.latlng, { radius: 4, color: '#ffd84a', fillColor: '#ffd84a', fillOpacity: 1 }));
        if (measure.pts.length > 1) {
          measure.line ??= Lf.polyline([], { color: '#ffd84a', weight: 3, dashArray: '6 6' }).addTo(map);
          measure.line.setLatLngs(measure.pts);
          let total = 0;
          for (let i = 1; i < measure.pts.length; i++) total += map.distance(measure.pts[i - 1]!, measure.pts[i]!);
          note(`MEASURE: ${km(total)} · ${miles(total)} over ${measure.pts.length} points — tap to add, MEASURE again to stop`);
        }
      });
      return;
    }
    void dropPin(e.latlng.lat, e.latlng.lng);
  };
  const onMove = () => {
    if (!map) return;
    const c = map.getCenter();
    current = { ...current, lat: c.lat, lon: c.lng };
    host.dispatchEvent(new CustomEvent('flatmap:move', { detail: { lat: c.lat, lon: c.lng, zoom: map.getZoom() } }));
    clearTimeout(moveTimer);
    moveTimer = window.setTimeout(() => {
      for (const [id, layer] of overlays) if (id === 'cctv' || id === 'cameras') void drawCams(id, layer as L.LayerGroup);
    }, 400);
  };

  const open = async (spot: MapSpot, opts: FlatMapOptions = {}): Promise<void> => {
    const Lf = await loadLeaflet();
    token = (await brain.publicKeys()).mapbox ?? '';
    current = { ...spot };
    if (!map) {
      map = Lf.map(mapEl, { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 20 });
      Lf.control.scale({ metric: true, imperial: true, position: 'bottomleft' }).addTo(map);
      extra = Lf.layerGroup().addTo(map);
      journeyLayer = Lf.layerGroup().addTo(map);
      map.on('click', onClick);
      map.on('moveend', onMove);
      paintOverlays();
    }
    paintStyles();
    await setStyle(opts.style && STYLES.some((s) => s.id === opts.style && (!s.mapbox || token)) ? opts.style : styleId);
    for (const o of opts.overlays ?? []) if (!overlays.has(o)) await toggleOverlay(o);
    const pts = (opts.points ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    extra?.clearLayers();
    if (pts.length) {
      for (const p of pts) {
        const m = Lf.marker([p.lat, p.lon]);
        if (p.label) m.bindTooltip(p.label, { permanent: true, direction: 'top', offset: [0, -28], className: 'fmlabel' });
        extra?.addLayer(m);
      }
      if (opts.line && pts.length > 1) extra?.addLayer(Lf.polyline(pts.map((p) => [p.lat, p.lon] as [number, number]), { color: '#ffd84a', weight: 3, dashArray: '6 6' }));
      if (pts.length > 1) {
        let bb = Lf.latLngBounds([pts[0]!.lat, pts[0]!.lon], [pts[0]!.lat, pts[0]!.lon]);
        for (const p of pts) bb = bb.extend([p.lat, p.lon]);
        map.fitBounds(bb.pad(0.25), { padding: [30, 30], maxZoom: opts.zoom ?? 16 });
      } else map.setView([pts[0]!.lat, pts[0]!.lon], opts.zoom ?? 16);
    } else {
      const near = World.near(spot.lat, spot.lon, 2e5);
      const z = opts.zoom ?? (near && near.km < 25 ? 13 : 15);
      map.setView([spot.lat, spot.lon], z);
    }
    map.invalidateSize();
    onMove();
    if (journey) drawJourney();
  };

  return {
    open,
    spot: () => ({ ...current }),
    showJourney: (j) => {
      journey = j;
      drawJourney();
    },
    panTo: (lat, lon, zoom) => map?.setView([lat, lon], zoom ?? Math.max(map.getZoom(), 15), { animate: true }),
    invalidate: () => map?.invalidateSize(),
    destroy: () => {
      clearTimeout(moveTimer);
      map?.remove();
      map = null;
      base = null;
      journeyLayer = null;
      journey = null;
      overlays.clear();
    },
  };
}
