/**
 * Built-in commands. The ones named in CLIENT_COMMANDS (packages/shared/src/protocol.ts)
 * are also what Ghosty's brain calls to act on screen.
 */
import { fetchJson } from '../api/feed';
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
  borders: 'borders', cities: 'cities', grid: 'grid', clouds: 'clouds', airports: 'airports', coast: 'coast', regions: 'adm1', orbits: 'orbits',
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
      id: 'set_layer',
      title: 'Set globe layer',
      hidden: true,
      run: (a) => {
        const k = LAYER_ALIASES[String(a?.layer ?? '').toLowerCase()];
        if (k) globe.vis = { ...globe.vis, [k]: a?.on !== false };
        ui.set({});
      },
    },
    { id: 'set_theme', title: 'Set theme', hidden: true, run: (a) => applyTheme(String(a?.theme ?? 'stark')) },
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
