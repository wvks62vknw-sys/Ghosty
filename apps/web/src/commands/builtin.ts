/**
 * Built-in commands. The ones named in CLIENT_COMMANDS (packages/shared/src/protocol.ts)
 * are also what Ghosty's brain calls to act on screen.
 */
import { fetchJson } from '../api/feed';
import { playStation, stopAudio } from '../assistant/media';
import { routeLayer, type RouteInfo } from '../engine/layers/route';
import { globe, SENSOR_MODES, type LayerVisibility } from '../engine/globe';
import { World } from '../engine/world';
import { go, tabs } from '../shell/tabs';
import { ui } from '../state/app';
import { applyTheme, THEMES } from '../state/theme';
import { toast } from '../ui/components';
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
  borders: 'borders', cams: 'cams', cameras: 'cams', cctv: 'cams', traffic: 'traffic', 'live traffic': 'traffic', congestion: 'traffic', webcams: 'cams', satellite: 'imagery', imagery: 'imagery', map: 'imagery', buildings: 'buildings', '3d': 'buildings', cities: 'cities', grid: 'grid', clouds: 'clouds', airports: 'airports', coast: 'coast', regions: 'adm1', orbits: 'orbits',
};

async function locate(place: string): Promise<{ lat: number; lon: number; name: string } | null> {
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

const locateAny = (place: string) => locate(place);

export async function flyTo(args: { place?: string; lat?: number; lon?: number; range_km?: number }): Promise<boolean> {
  go('eye');
  let lat = Number(args.lat);
  let lon = Number(args.lon);
  if (args.place) {
    const p = await locate(String(args.place));
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
        // accept a key ("mark3") or a label ("Mark III", "war machine")
        const want = String(a?.theme ?? 'stark').toLowerCase().replace(/[^a-z0-9]/g, '');
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
