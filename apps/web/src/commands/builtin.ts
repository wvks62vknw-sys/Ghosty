/**
 * Built-in commands. The ones named in CLIENT_COMMANDS (packages/shared/src/protocol.ts)
 * are also what Ghosty's brain calls to act on screen.
 */
import { fetchJson } from '../api/feed';
import { playStation, stopAudio } from '../assistant/media';
import { addLink } from '../assistant/session';
import { routeLayer, type RouteInfo } from '../engine/layers/route';
import { globe, SENSOR_MODES, type LayerVisibility } from '../engine/globe';
import { World } from '../engine/world';
import { go, tabs } from '../shell/tabs';
import { ui } from '../state/app';
import { applyTheme, THEMES } from '../state/theme';
import { keepWidget } from '../state/widgets';
import { enqueue, type NewEvent, type NewJob } from '../api/offline';
import { modal, sandboxFrame, toast } from '../ui/components';
import type { OverlayId, StyleId } from '../ui/flatmap';
import type { Style3dId } from '../ui/map3d';
import type { JourneyAnswer } from '../../../../packages/shared/src/protocol';
import { addPaletteProvider, register, type Command } from './registry';

const LAYER_ALIASES: Record<string, keyof LayerVisibility> = {
  air: 'air', aircraft: 'air', planes: 'air', flights: 'air',
  sats: 'sats', satellites: 'sats',
  quakes: 'quakes', earthquakes: 'quakes',
  events: 'events', hazards: 'events',
  'traffic cameras': 'cams',
  enforce: 'enforce', anpr: 'enforce', alpr: 'enforce', 'number plate': 'enforce', 'number plates': 'enforce', 'number plate cameras': 'enforce', 'speed cameras': 'enforce', 'speed camera': 'enforce', 'red light cameras': 'enforce', enforcement: 'enforce', 'enforcement cameras': 'enforce', surveillance: 'enforce',
  ships: 'ships', ais: 'ships', vessels: 'ships', boats: 'ships', maritime: 'ships',
  radar: 'radar', rain: 'radar', precipitation: 'radar', 'weather radar': 'radar',
  alerts: 'alerts', warnings: 'alerts', 'weather alerts': 'alerts',
  disasters: 'disasters', gdacs: 'disasters', cyclones: 'disasters', floods: 'disasters',
  buoys: 'buoys', waves: 'buoys', ocean: 'buoys',
  aurora: 'aurora', 'northern lights': 'aurora',
  cables: 'cables', 'undersea cables': 'cables', 'submarine cables': 'cables', internet: 'cables',
  dispatch: 'dispatch', '911': 'dispatch', emergency: 'dispatch',
  transit: 'transit', buses: 'transit', bus: 'transit', trams: 'transit', tram: 'transit', metro: 'transit', 'public transport': 'transit', 'live buses': 'transit',
  incidents: 'incidents', 'road incidents': 'incidents', 'motorway incidents': 'incidents', crashes: 'incidents', closures: 'incidents', 'road reports': 'incidents',
  borders: 'borders', cams: 'cams', cameras: 'cams', cctv: 'cams', traffic: 'traffic', 'live traffic': 'traffic', congestion: 'traffic', webcams: 'cams', satellite: 'imagery', imagery: 'imagery', map: 'imagery', buildings: 'buildings', '3d': 'buildings', cities: 'cities', grid: 'grid', clouds: 'clouds', airports: 'airports', coast: 'coast', regions: 'adm1', orbits: 'orbits',
};

export async function locatePlace(place: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const c = World.find(place);
  if (c) return { lat: c.lat, lon: c.lon, name: c.name };
  const a = place.length <= 4 ? World.findAirport(place) : null;
  if (a) return { lat: a.lat, lon: a.lon, name: `${a.iata} ${a.name}` };
  try {
    const j = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`, 3600);
    if (j[0]) return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name.split(',').slice(0, 2).join(',') };
  } catch {
    /* fall through */
  }
  return null;
}

const locateAny = (place: string) => locatePlace(place);

/** A place from a command's arguments: coordinates, or a name looked up. */
async function placeFrom(a: Record<string, unknown> | undefined): Promise<{ lat: number; lon: number; name: string } | null> {
  const lat = Number(a?.lat);
  const lon = Number(a?.lon);
  if (typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, name: String(a?.place ?? '') };
  if (!a?.place) return null;
  const p = await locateAny(String(a.place));
  return p ? { lat: p.lat, lon: p.lon, name: p.name ?? String(a.place) } : null;
}

/** Street View at a place: God's Eye dives down to the street and the panorama takes over (ui/streetview.ts). */
async function openStreet(a: Record<string, unknown> | undefined): Promise<void> {
  const where = await placeFrom(a);
  if (!where) return void toast(`I couldn't find ${a?.place ?? 'that place'}`, 'warn');
  const heading = Number(a?.heading);
  const { openStreetView } = await import('../ui/streetview');
  await openStreetView({ ...where, ...(Number.isFinite(heading) ? { heading } : {}) });
}

/** The live traffic map at a place: fly God's Eye there and open the sheet (ui/mapsheet.ts). */
async function openTraffic(a: Record<string, unknown> | undefined): Promise<void> {
  const where = await placeFrom(a);
  if (!where) return void toast(`I couldn't find ${a?.place ?? 'that place'}`, 'warn');
  go('eye');
  globe.cam.flyTo({ lat: where.lat, lon: where.lon, range: 25, tilt: 0 });
  globe.vis = { ...globe.vis, traffic: true };
  ui.set({});
  const { openMapSheet } = await import('../ui/mapsheet');
  openMapSheet('traffic', where);
}

export async function flyTo(args: { place?: string; lat?: number; lon?: number; range_km?: number }): Promise<boolean> {
  go('eye');
  let lat = Number(args.lat);
  let lon = Number(args.lon);
  if (args.place) {
    const p = await locatePlace(String(args.place));
    if (!p) {
      toast(`I couldn't find ${args.place}`, 'warn');
      return false;
    }
    ({ lat, lon } = p);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  globe.cam.flyTo({ lat, lon, range: Number(args.range_km) || 500, tilt: Number(args.range_km) < 200 ? 45 : 0 });
  return true;
}

export function registerBuiltins(): void {
  register(
    { id: 'open_tab', title: 'Open tab', hidden: true, run: (a) => void (go(String(a?.tab ?? 'core')) || toast(`No tab called ${a?.tab}`, 'warn')) },
    { id: 'fly_to', title: 'Fly to', hidden: true, run: (a) => void flyTo(a ?? {}) },
    {
      id: 'show_cameras',
      title: 'Show live cameras',
      hidden: true,
      run: async (a) => {
        go('eye');
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);
        const where = typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name: String(a?.place ?? '') } : a?.place ? await locateAny(String(a.place)) : null;
        if (!where) return void toast(`I couldn't find ${a?.place ?? 'that place'}`, 'warn');
        const { openNearestCamera } = await import('../features/eye');
        globe.cam.flyTo({ lat: where.lat, lon: where.lon, range: 25, tilt: 0 });
        // camera lists load in the background; try a few times
        for (let i = 0; i < 12; i++) {
          if (openNearestCamera?.(where.lat, where.lon, 40) != null) return;
          await new Promise((r) => setTimeout(r, 1500));
        }
        // No open live picture feed there (e.g. Birmingham: council and National Highways cameras
        // aren't published) — show live traffic and the mapped ANPR / speed / red-light cameras instead.
        const { nearestCameras } = await import('../data/cameras');
        const near = nearestCameras(where.lat, where.lon, 1, 20000)[0];
        const { enforce } = await import('../data/enforce');
        await enforce.refresh(where.lat, where.lon, 40).catch(() => undefined);
        globe.vis = { ...globe.vis, traffic: true, enforce: true };
        ui.set({});
        const n = enforce.near(where.lat, where.lon, 40).filter((c) => c.kind !== 'cctv').length;
        toast(`No public live cameras in ${where.name || 'that area'}${near ? ` — the nearest is ${Math.round(near.km)} km away (${near.src})` : ''}. Showing live traffic${n ? ` and ${n} mapped ANPR, speed and red-light cameras` : ''} instead.`, 'warn');
      },
    },
    {
      // Ghosty remembered something / set a reminder or event while its database was paused:
      // keep it on this device (shows at once) and send it to the brain when it's back.
      id: 'offline_save',
      title: 'Save on this device',
      hidden: true,
      run: (a) => {
        const op = a?.op;
        if (op === 'addMemory' && a?.text) enqueue({ kind: 'addMemory', text: String(a.text) });
        else if (op === 'addJob' && a?.job) enqueue({ kind: 'addJob', job: a.job as NewJob });
        else if (op === 'addEvent' && a?.event) enqueue({ kind: 'addEvent', event: a.event as NewEvent });
      },
    },
    { id: 'street_view', title: 'Street View', hidden: true, run: (a) => void openStreet(a) },
    {
      // The flat map (ui/flatmap.ts) at a place, with a style, overlays and pins from the brain.
      id: 'show_map',
      title: 'Show map',
      hidden: true,
      run: async (a) => {
        const where = await placeFrom(a);
        if (!where) return void toast(`I couldn't find ${a?.place ?? 'that place'}`, 'warn');
        go('eye');
        const { openMapSheet } = await import('../ui/mapsheet');
        const style = typeof a?.style === 'string' ? (a.style as StyleId) : undefined;
        const overlays = Array.isArray(a?.overlays) ? (a.overlays as unknown[]).map(String).filter((o): o is OverlayId => ['rail', 'sea', 'rain', 'cctv', 'cameras'].includes(o)) : undefined;
        const points = Array.isArray(a?.points)
          ? (a.points as unknown[])
              .filter((p): p is { lat: number; lon: number; label?: unknown } => !!p && typeof p === 'object' && Number.isFinite((p as { lat: unknown }).lat) && Number.isFinite((p as { lon: unknown }).lon))
              .slice(0, 50)
              .map((p) => ({ lat: Number(p.lat), lon: Number(p.lon), ...(p.label ? { label: String(p.label).slice(0, 60) } : {}) }))
          : undefined;
        const zoom = Number(a?.zoom);
        // The 3D view (MapLibre + OpenFreeMap) has its own style names; the shared ones map across.
        const three = a?.view === '3d';
        const STYLE3D: Record<string, Style3dId> = { dark: 'dark', liberty: 'liberty', bright: 'bright', positron: 'positron', fiord: 'fiord', traffic: 'mbtraffic', mapbox: 'mbsat', night: 'mbnight', streets: 'liberty', satellite: 'mbsat' };
        const pitch = Number(a?.pitch);
        openMapSheet(three ? '3d' : 'map', where, {
          style: style && !three ? style : undefined,
          overlays,
          points,
          line: !!a?.line,
          zoom: Number.isFinite(zoom) && zoom >= 2 && zoom <= 19 ? zoom : undefined,
          map3d: three ? { style: style ? STYLE3D[style] : undefined, pitch: Number.isFinite(pitch) ? Math.max(0, Math.min(70, pitch)) : undefined, buildings: a?.buildings !== false, overlays: overlays?.filter((o): o is 'rail' | 'rain' => o === 'rail' || o === 'rain') } : undefined,
        });
      },
    },
    { id: 'traffic_map', title: 'Live traffic map', hidden: true, run: (a) => void openTraffic(a) },
    {
      // A page Ghosty published (publish_site): a tappable card in the chat.
      id: 'show_link',
      title: 'Show link',
      hidden: true,
      run: (a) => {
        const raw = String(a?.url ?? '');
        let url: URL;
        try {
          url = new URL(raw, location.origin);
        } catch {
          return;
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
        addLink(url.toString(), String(a?.title ?? url.hostname).slice(0, 120));
      },
    },
    {
      id: 'open_widget',
      title: 'Open widget',
      hidden: true,
      run: (a) => {
        const html = String(a?.html ?? '');
        if (!html) return;
        // Kept on this device too (and saved to the brain later if its database was paused).
        keepWidget({ name: String(a?.name ?? 'widget'), title: String(a?.title ?? 'Widget'), html, at: Date.now() }, a?.saved !== false);
        const f = sandboxFrame(html);
        modal(String(a?.title ?? 'Widget'), f);
      },
    },
    {
      id: 'show_traffic',
      title: 'Show live traffic',
      hidden: true,
      run: async (a) => {
        go('eye');
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);
        const where = typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : a?.place ? await locateAny(String(a.place)) : null;
        globe.vis = { ...globe.vis, traffic: true, cams: true, enforce: true };
        if (where) {
          globe.cam.flyTo({ lat: where.lat, lon: where.lon, range: Number(a?.range_km) || 14, tilt: 0 });
          const { enforce } = await import('../data/enforce');
          void enforce.refresh(where.lat, where.lon, 40).catch(() => undefined);
        }
        const { trafficState } = await import('../engine/layers/radar');
        const { brain } = await import('../api/brain');
        trafficState.ready = (await brain.trafficStatus().catch(() => ({ ready: false }))).ready;
        if (!trafficState.ready) toast('Live traffic needs the free TomTom key — Links → Live traffic', 'warn');
        ui.set({});
      },
    },
    {
      id: 'show_crime',
      title: 'Show street crime',
      hidden: true,
      run: async (a) => {
        go('eye');
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);
        const where = typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : a?.place ? await locateAny(String(a.place)) : null;
        globe.vis = { ...globe.vis, crime: true };
        if (where) {
          globe.cam.flyTo({ lat: where.lat, lon: where.lon, range: Number(a?.range_km) || 6, tilt: 30 });
          const { crime } = await import('../data/crime');
          void crime.refresh(where.lat, where.lon, 12).catch(() => undefined);
        }
        ui.set({});
      },
    },
    {
      // Live buses and trams around a place (the brain's transit_now tool, or "show me the buses").
      id: 'show_transit',
      title: 'Show live buses & trams',
      hidden: true,
      run: async (a) => {
        go('eye');
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);
        const where = typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : a?.place ? await locateAny(String(a.place)) : null;
        globe.vis = { ...globe.vis, transit: true };
        if (where) {
          globe.cam.flyTo({ lat: where.lat, lon: where.lon, range: Number(a?.range_km) || 5, tilt: 40 });
          const { transit } = await import('../data/transit');
          void transit.refresh(where.lat, where.lon, Number(a?.range_km) || 5).catch(() => undefined);
        }
        ui.set({});
      },
    },
    {
      // Live road incidents the brain found (motorway_now): shown at the junctions they name.
      id: 'show_incidents',
      title: 'Show road incidents',
      hidden: true,
      run: async (a) => {
        go('eye');
        const { incidents } = await import('../data/incidents');
        const n = Array.isArray(a?.events) ? incidents.seed(a?.events) : 0;
        globe.vis = { ...globe.vis, incidents: true };
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);
        if (typeof a?.lat === 'number' && typeof a?.lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) globe.cam.flyTo({ lat, lon, range: Number(a?.range_km) || 40, tilt: 20 });
        if (!n) void incidents.refresh(String(a?.region ?? 'West Midlands'), true).catch(() => undefined);
        ui.set({});
      },
    },
    {
      // ROAD AHEAD: follow the owner's own position on the globe with what lies ahead (their phone's GPS; nothing leaves the device).
      id: 'road_ahead',
      title: 'Road ahead (follow me)',
      hidden: true,
      run: async (a) => {
        go('eye');
        const { startRoadAhead, stopRoadAhead } = await import('../features/eye');
        if (a?.on === false) stopRoadAhead?.();
        else startRoadAhead?.();
        ui.set({});
      },
    },
    {
      // The Lens (the phone's camera): SEE, READ, HANDS or ASK — "read this document" → open_lens read.
      // This is also the brain's auto-approved tool, so it only picks the tab and mode: the camera
      // itself opens from the owner's own tap (the START button), never from here.
      id: 'open_lens',
      title: 'Open the Lens',
      hidden: true,
      run: async (a) => {
        const { openLens } = await import('../features/lens');
        openLens(typeof a?.mode === 'string' ? a.mode : undefined, typeof a?.question === 'string' ? a.question.slice(0, 500) : undefined);
      },
    },
    {
      // The SPACE PLANNER (features/space): a room to scale, furniture to drag, MAKE SPACE; the brain may pass the room's size.
      id: 'open_space',
      title: 'Space planner',
      group: 'GO',
      run: async (a) => {
        const { openSpace } = await import('../features/space');
        openSpace(Number(a?.width_cm) || undefined, Number(a?.depth_cm) || undefined);
      },
    },
    {
      // The LEARN tab (the tutor): a course, a lesson, a quiz the brain wrote, or REVISE.
      id: 'open_learn',
      title: 'Learn something',
      group: 'GO',
      run: async (a) => {
        const { openLearn } = await import('../features/learn');
        openLearn(a && typeof a === 'object' ? (a as Record<string, unknown>) : {});
      },
    },
    {
      // The GYM tab: Ghosty's self-play games; optionally open on one game (maze, codebreaker, colony, trust, tictactoe, connect4, tiles, sudoku, countdown, words).
      id: 'open_gym',
      title: 'Gym: Ghosty trains himself',
      group: 'GO',
      run: async (a) => {
        const { openGym } = await import('../features/gym');
        openGym(typeof a?.game === 'string' ? a.game : undefined);
      },
    },
    {
      // DESIGN REVIEW (brain tools/design.ts): up to three changes to the owner's plan, each a whole Room JSON;
      // SPACE checks each against the plan the owner has and shows BEFORE and AFTER to APPLY or not.
      id: 'design_changes',
      title: 'Design changes',
      hidden: true,
      run: async (a) => {
        const { receiveDesignChanges } = await import('../features/space');
        receiveDesignChanges(a);
      },
    },
    {
      // The 3D STUDIO: a sample, a model made from a picture (make_3d), words to make (catalogue first), a catalogue model, a room in cm, or a Spline link.
      id: 'open_studio',
      title: 'Open the 3D Studio',
      hidden: true,
      run: async (a) => {
        const { openStudio } = await import('../features/studio');
        openStudio({
          sample: typeof a?.sample === 'string' ? a.sample : undefined,
          model: typeof a?.model === 'string' ? a.model : undefined,
          make: typeof a?.make === 'string' ? a.make.slice(0, 200) : undefined,
          catalog: typeof a?.catalog === 'string' && /^(?:ov:[0-9a-f]{32}|ph:[A-Za-z0-9_-]{1,80})$/.test(a.catalog) ? a.catalog : undefined,
          title: typeof a?.title === 'string' ? a.title.slice(0, 80) : undefined,
          room: a?.room && typeof a.room === 'object' ? a.room : undefined,
          spline: typeof a?.spline === 'string' ? a.spline : undefined,
        });
      },
    },
    {
      id: 'set_layer',
      title: 'Set globe layer',
      hidden: true,
      run: (a) => {
        const k = LAYER_ALIASES[String(a?.layer ?? '').toLowerCase()];
        if (k) globe.vis = { ...globe.vis, [k]: a?.on !== false };
        ui.set({});
      },
    },
    {
      id: 'set_theme',
      title: 'Set theme',
      hidden: true,
      run: (a) => {
        // accept a key ("graphite") or a label ("Reactor"); any other name (an old look's) gives Reactor
        const want = String(a?.theme ?? 'reactor').toLowerCase().replace(/[^a-z0-9]/g, '');
        const hit = Object.entries(THEMES).find(([k, t]) => k === want || t.label.toLowerCase().replace(/[^a-z0-9]/g, '') === want);
        applyTheme(hit ? hit[0] : want);
      },
    },
    {
      id: 'set_sensor_mode',
      title: 'Set sensor mode',
      hidden: true,
      run: (a) => {
        const m = String(a?.mode ?? '').toLowerCase();
        const i = SENSOR_MODES.findIndex(([n]) => n.toLowerCase() === m || (m === 'thermal' && n === 'FLIR') || (m.startsWith('night') && n === 'NVG'));
        if (i >= 0) {
          go('eye');
          globe.mode = i;
          ui.set({});
        }
      },
    },
    { id: 'notify', title: 'Notify', hidden: true, run: (a) => toast(String(a?.text ?? '')) },
    {
      id: 'show_route',
      title: 'Show route',
      hidden: true,
      run: (a) => {
        const r = a as unknown as RouteInfo;
        const path = Array.isArray(r?.path) ? r.path.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 2000) : [];
        if (path.length < 2) return;
        go('eye');
        if (!globe.layers.includes(routeLayer)) globe.layers.push(routeLayer);
        routeLayer.set({ path: path as [number, number][], from: String(r.from ?? ''), to: String(r.to ?? ''), mode: String(r.mode ?? 'driving'), distance_m: Number(r.distance_m) || 0, duration_s: Number(r.duration_s) || 0 });
        globe.vis = { ...globe.vis, route: true };
        // Frame the whole route: centre between the ends, distance from its length.
        let la = 0;
        let lo = 0;
        for (const [y, x] of path) {
          la += y;
          lo += x;
        }
        const km = Math.max(...path.map(([y, x]) => Math.hypot(y - path[0]![0], (x - path[0]![1]) * Math.cos((y * Math.PI) / 180)) * 111));
        globe.cam.flyTo({ lat: la / path.length, lon: lo / path.length, range: Math.max(2.5, Math.min(9000, km * 2.4)), tilt: km < 60 ? 35 : 0 });
      },
    },
    { id: 'clear_route', title: 'Clear route from globe', group: 'EYE', run: () => routeLayer.set(null) },
    {
      // A journey the brain planned (plan_journey): drawn on the map leg by leg, with its steps (ui/journeysheet.ts).
      id: 'show_journey',
      title: 'Show journey',
      hidden: true,
      run: async (a) => {
        if (!Array.isArray(a?.itineraries) || !a.itineraries.length) return;
        go('eye');
        const { showJourney } = await import('../ui/journeysheet');
        showJourney(a as unknown as JourneyAnswer, 0);
      },
    },
    {
      // The GO panel: a journey by bus, tram, train, metro or ferry (ui/journeysheet.ts).
      id: 'journey_planner',
      title: 'Journey planner: buses, trams, trains',
      group: 'GO',
      run: async () => {
        go('eye');
        const { openJourneyPlanner } = await import('../ui/journeysheet');
        openJourneyPlanner();
      },
    },
    {
      id: 'play_radio',
      title: 'Play radio',
      hidden: true,
      run: (a) => {
        const url = String(a?.url ?? '');
        if (!/^https:\/\//i.test(url)) return;
        void playStation({ name: String(a?.name ?? 'Radio').slice(0, 80), url, info: a?.info ? String(a.info).slice(0, 120) : undefined }).then((ok) => {
          if (!ok) toast('Tap anywhere, then say "play" again — the browser blocked the audio, or the stream is down.', 'warn');
        });
      },
    },
    { id: 'stop_audio', title: 'Stop radio', group: 'MEDIA', run: () => stopAudio() },
    {
      // VEHICLE CHECK (ui/vehiclecheck.ts): one UK plate → its MOT record, looked up once, not saved.
      id: 'vehicle_check',
      title: 'Vehicle check: MOT history of one car',
      group: 'TOOLS',
      run: async (a) => {
        const { openVehicleCheck } = await import('../ui/vehiclecheck');
        openVehicleCheck(typeof a?.plate === 'string' ? a.plate : '');
      },
    },
    {
      id: 'offline_brain',
      title: 'Offline brain',
      group: 'SYSTEM',
      // SETTINGS → OFFLINE BRAIN: download, test, and when the phone's own model answers.
      run: () => {
        go('settings');
        setTimeout(() => document.querySelector('#pg-settings .offbrain')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      },
    },
    { id: 'reload_interface', title: 'Reload interface', group: 'SYSTEM', run: () => location.reload() },
    { id: 'fullscreen', title: 'Toggle fullscreen', group: 'SYSTEM', keys: 'f', run: () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) },
    {
      id: 'next_tab',
      title: 'Next tab',
      group: 'GO',
      keys: ']',
      run: () => {
        const t = tabs();
        const i = t.findIndex((x) => x.id === ui.get().tab);
        go(t[(i + 1) % t.length]!.id);
      },
    },
    {
      id: 'prev_tab',
      title: 'Previous tab',
      group: 'GO',
      keys: '[',
      run: () => {
        const t = tabs();
        const i = t.findIndex((x) => x.id === ui.get().tab);
        go(t[(i - 1 + t.length) % t.length]!.id);
      },
    },
  );
  for (const t of tabs()) register({ id: `tab_${t.id}`, title: t.title, group: 'GO', run: () => void go(t.id) });
  for (const [k, t] of Object.entries(THEMES)) register({ id: `theme_${k}`, title: `Theme: ${t.label}`, group: 'THEME', run: () => applyTheme(k) });
  SENSOR_MODES.forEach(([n], i) =>
    register({
      id: `sensor_${n.toLowerCase()}`,
      title: `Sensor: ${n}`,
      group: 'EYE',
      run: () => {
        go('eye');
        globe.mode = i;
        ui.set({});
      },
    }),
  );
  addPaletteProvider((q): Command[] => {
    const out: Command[] = [];
    const c = World.find(q);
    if (c) out.push({ id: 'fly', title: `Fly to ${c.name}`, group: 'FLY', run: () => void flyTo({ lat: c.lat, lon: c.lon, range_km: 400 }) });
    out.push({ id: 'ask', title: `Ask Ghosty: ${q}`, group: 'ASK', run: async () => { go('core'); const { send } = await import('../assistant/session'); void send(q); } });
    return out;
  });
}
