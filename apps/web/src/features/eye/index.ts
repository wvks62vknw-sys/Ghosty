/**
 * GOD'S EYE tab: the live globe. Search, sensor modes, layer toggles, target card,
 * floating labels, touch/mouse gestures, the zoom rail, and live public CCTV: tap a camera
 * to watch it, and a grid shows the four cameras nearest the view.
 */
import { send } from '../../assistant/session';
import { flyTo } from '../../commands/builtin';
import { clear, fmt, h } from '../../core/dom';
import { events, launches, quakes, type Launch, type NaturalEvent, type Quake } from '../../data/hazards';
import { GEO } from '../../engine/geo';
import { gfx } from '../../engine/gfx';
import { globe, SENSOR_MODES, type LayerVisibility, type Pickable } from '../../engine/globe';
import { air, type Aircraft } from '../../engine/layers/air';
import { eventLayer, quakeLayer } from '../../engine/layers/hazards';
import { sats, type Satellite } from '../../engine/layers/sats';
import { DEG, RAD, clamp } from '../../engine/math';
import { onFrame } from '../../engine/scheduler';
import { World, type City } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings, ui } from '../../state/app';
import { button, panel, row, toast } from '../../ui/components';
import { routeLayer, type RouteInfo } from '../../engine/layers/route';
import { imagery } from '../../engine/layers/imagery';
import { buildings } from '../../engine/layers/buildings';
import { enforceLayer, INTEL_LAYERS, shipLayer } from '../../engine/layers/intel';
import { enforce, ENFORCE_LABEL, type EnforceCam } from '../../data/enforce';
import { radar } from '../../engine/layers/radar';
import {
  alerts, aurora, buoys, cables, disasters, dispatch, NAV_STATUS, radarFrames, shipKind, ships,
  type Alert, type Buoy, type Cable, type Disaster, type Dispatch, type Ship,
} from '../../data/intel';
import { camLayer } from '../../engine/layers/cams';
import { cams, camEvents, inCalifornia, loadCalifornia, loadCameras, nearestCameras, type Camera } from '../../data/cameras';
import { fetchImage } from '../../api/feed';

/** Set while God's Eye is mounted: open the camera nearest a place (used by the brain's show_cameras). */
export let openNearestCamera: ((lat: number, lon: number) => boolean) | null = null;

let layersInstalled = false;
function installLayers(): void {
  if (layersInstalled) return;
  layersInstalled = true;
  sats.init();
  if (!globe.layers.includes(routeLayer)) globe.layers.push(routeLayer);
  globe.layers.push(quakeLayer, eventLayer, ...INTEL_LAYERS, sats, air, camLayer);
  air.onEmergency = (a) => toast(`${a.call || a.hex} squawking ${a.emergency}`, 'bad');
  setInterval(() => void sats.refresh(), 6 * 3600_000);
  void sats.refresh();
}

function describe(sel: Pickable): string {
  const r = sel.ref as Record<string, unknown>;
  switch (sel.kind) {
    case 'air': {
      const a = r as unknown as Aircraft;
      return `aircraft ${a.call || a.hex} ${a.type} ${a.reg} at ${Math.round(a.altft)} ft, ${Math.round(a.gs)} knots, heading ${Math.round(a.trk)}°`;
    }
    case 'sat':
      return `satellite ${(r as unknown as Satellite).name} at ${Math.round((r as unknown as Satellite).alt)} km`;
    case 'quake':
      return `magnitude ${(r as unknown as Quake).mag} earthquake ${(r as unknown as Quake).place}`;
    case 'event':
      return `natural event: ${(r as unknown as NaturalEvent).title}`;
    case 'cam':
      return `live public traffic camera "${(r as unknown as Camera).name}" in ${(r as unknown as Camera).src}`;
    case 'launch':
      return `rocket launch ${(r as unknown as Launch).name} from ${(r as unknown as Launch).pad}`;
    case 'route': {
      const rr = (r as { route: RouteInfo }).route;
      return `the route from ${rr.from} to ${rr.to} (${rr.mode}, ${(rr.distance_m / 1000).toFixed(1)} km)`;
    }
    case 'city':
      return `the city of ${(r as unknown as City).name}, ${(r as unknown as City).country}`;
    case 'ship': {
      const v = r as unknown as Ship;
      return `${shipKind(v.type).toLowerCase()} vessel ${v.name || `MMSI ${v.mmsi}`} at ${v.sog.toFixed(1)} knots, course ${Math.round(v.cog)}°${v.dest ? `, bound for ${v.dest}` : ''}`;
    }
    case 'alert':
      return `${(r as unknown as Alert).severity} weather alert: ${(r as unknown as Alert).headline || (r as unknown as Alert).event} (${(r as unknown as Alert).area})`;
    case 'disaster':
      return `GDACS ${(r as unknown as Disaster).level} alert: ${(r as unknown as Disaster).kind.toLowerCase()} ${(r as unknown as Disaster).name} ${(r as unknown as Disaster).country}`;
    case 'buoy':
      return `NOAA buoy ${(r as unknown as Buoy).id}${(r as unknown as Buoy).wvht !== undefined ? ` with ${(r as unknown as Buoy).wvht} m waves` : ''}`;
    case 'cable':
      return `the ${(r as unknown as Cable).name} undersea cable`;
    case 'enforce': {
      const e = r as unknown as EnforceCam;
      return `${ENFORCE_LABEL[e.kind].toLowerCase()}${e.name ? ` "${e.name}"` : ''}${e.operator ? ` run by ${e.operator}` : ''}${e.maxspeed ? `, limit ${e.maxspeed}` : ''} (mapped on OpenStreetMap)`;
    }
    case 'dispatch':
      return `Seattle 911 call: ${(r as unknown as Dispatch).type} at ${(r as unknown as Dispatch).addr}`;
    default:
      return sel.kind;
  }
}

export const eyeTab: TabDef = {
  id: 'eye',
  title: "GOD'S EYE",
  icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  scene: 'globe',
  blurb: 'live globe · aircraft · satellites · CCTV',
  primary: true,
  mount(root) {
    globe.init();
    installLayers();
    let selected: Pickable | null = null;
    let airTimer = 0;
    let shipTimer = 0;

    // ---------- top: search + sensor modes ----------
    const q = h('input', { placeholder: 'Search place, flight, ship, satellite…', autocomplete: 'off', 'aria-label': 'Search the globe' });
    const search = async () => {
      const s = q.value.trim();
      if (!s) return;
      const a = air.find(s);
      if (a) return select({ kind: 'air', ref: a, w: air.world(a, Date.now()) }, true);
      const sat = sats.list.find((x) => x.name.toLowerCase().includes(s.toLowerCase()));
      if (sat) return select({ kind: 'sat', ref: sat, w: sat.w }, true);
      const ship = ships.find(s);
      if (ship) return select({ kind: 'ship', ref: ship, w: shipLayer.world(ship, Date.now()) }, true);
      if (!(await flyTo({ place: s, range_km: 300 }))) toast(`Nothing found for ${s}`, 'warn');
    };
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void search();
    });
    const modes = h('div.modes', ...SENSOR_MODES.map(([n], i) => button(n, () => {
      globe.mode = i;
      ui.set({});
    })));
    const paintModes = () => [...modes.children].forEach((b, i) => b.classList.toggle('on', i === globe.mode));

    // ---------- layers ----------
    const lay = panel('LAYERS', { grow: false });
    lay.el.classList.add('eyelay');
    const LAYERS: [keyof LayerVisibility, string, () => string][] = [
      ['imagery', 'SATELLITE MAP', () => (imagery.credit ? `Z${imagery.level}` : '')],
      ['buildings', '3D BUILDINGS', () => (buildings.status || (buildings.count ? String(buildings.count) : ''))],
      ['air', 'AIRCRAFT', () => `${air.list.size} ${air.status}`],
      ['sats', 'SATELLITES', () => String(sats.list.length)],
      ['quakes', 'QUAKES', () => String(quakes.data?.length ?? 0)],
      ['events', 'EVENTS', () => String((events.data?.length ?? 0) + (launches.data?.length ?? 0))],
      ['enforce', 'ANPR / SPEED', () => {
        if (globe.cam.range > 250 && !enforce.list.size) return 'ZOOM IN';
        const c = enforce.counts();
        return enforce.status === 'SYNC' && !enforce.list.size ? 'SYNC' : `${c.anpr} ANPR · ${c.speed + c.average + c.redlight + c.buslane}`;
      }],
      ['ships', 'SHIPS (AIS)', () => `${ships.list.size} ${ships.status}`],
      ['radar', 'RAIN RADAR', () => (radarFrames.data ? fmt.ago(radarFrames.data.time) : radarFrames.status)],
      ['alerts', 'WEATHER ALERTS', () => String(alerts.data?.length ?? alerts.status)],
      ['disasters', 'DISASTERS', () => String(disasters.data?.length ?? disasters.status)],
      ['aurora', 'AURORA', () => (aurora.data ? `${Math.max(0, ...aurora.data.cells.map((c) => c[2]))}%` : aurora.status)],
      ['dispatch', '911 SEATTLE', () => String(dispatch.data?.length ?? dispatch.status)],
      ['buoys', 'OCEAN BUOYS', () => (buoys.data ? String(buoys.data.length) : '')],
      ['cables', 'UNDERSEA CABLES', () => (cables.data ? String(cables.data.length) : '')],
      ['cams', 'CCTV CAMERAS', () => (cams.status === 'SYNC' && !cams.list.length ? 'SYNC' : String(cams.list.length))],
      ['borders', 'BORDERS', () => ''],
      ['adm1', 'REGIONS', () => ''],
      ['cities', 'CITIES', () => ''],
      ['airports', 'AIRPORTS', () => ''],
      ['clouds', 'CLOUDS', () => ''],
      ['grid', 'GRID', () => ''],
      ['orbits', 'ORBITS', () => ''],
    ];
    const counts: HTMLElement[] = [];
    const boxes: HTMLInputElement[] = [];
    for (const [k, n, f] of LAYERS) {
      const cb = h('input', { type: 'checkbox', checked: globe.vis[k] });
      cb.addEventListener('change', () => {
        globe.vis = { ...globe.vis, [k]: cb.checked };
        sats.showOrbit = globe.vis.orbits;
      });
      const em = h('em', f());
      boxes.push(cb);
      counts.push(em);
      lay.body.append(h('label', cb, h('span', n), em));
    }
    if (innerWidth < 700) lay.el.classList.add('min');

    // ---------- target card ----------
    const info = panel('TARGET', { grow: false });
    info.el.classList.add('eyeinfo');
    info.el.hidden = true;
    const paintInfo = () => {
      if (!selected) {
        info.el.hidden = true;
        return;
      }
      info.el.hidden = false;
      clear(info.body);
      const R = (k: string, v: string, n?: string) => info.body.append(row(k, v, n ?? null));
      const actions = h('div.row.wrap');
      const ask = button('ASK GHOSTY', () => void send(`Tell me about this: ${describe(selected!)}`), 'warn');
      const s = selected;
      if (s.kind === 'air') {
        const a = s.ref as Aircraft;
        info.title.textContent = (a.call || a.hex).toUpperCase();
        info.setStatus(a.emergency ? `EMERGENCY ${a.emergency}` : a.mil ? 'MILITARY' : 'LIVE', a.emergency ? 'off' : 'ok');
        R('TYPE', `${a.type || '?'}${a.reg ? ` · ${a.reg}` : ''}`);
        R('ALT', a.gnd ? 'ON GROUND' : `${fmt.n(a.altft)} ft`, `FL${String(Math.round(a.altft / 100)).padStart(3, '0')}`);
        R('SPEED', `${Math.round(a.gs)} kt`, `${Math.round(a.gs * 1.852)} km/h`);
        R('HEADING', `${Math.round(a.trk)}°`, GEO.card(a.trk));
        if (a.squawk) R('SQUAWK', a.squawk);
        actions.append(button('FOLLOW', () => {
          globe.cam.flyTo({ lat: a.lat, lon: a.lon, range: 60, tilt: 55 });
          setTimeout(() => (globe.cam.follow = () => air.pos(air.selected ?? a)), 2500);
        }));
      } else if (s.kind === 'sat') {
        const st = s.ref as Satellite;
        const ll = GEO.ll(st.w);
        const v = Math.sqrt(398600.4418 * (2 / Math.hypot(...st.w) - 1 / st.a));
        const L = home();
        const pass = sats.nextPass(st, L.lat, L.lon);
        info.title.textContent = st.name;
        info.setStatus(st.group.toUpperCase(), 'ok');
        R('NORAD', String(st.id));
        R('ALT', `${Math.round(ll.alt)} km`);
        R('SPEED', `${v.toFixed(2)} km/s`);
        R('PERIOD', `${(st.period / 60).toFixed(1)} min`);
        R('INCL', `${(st.inc * DEG).toFixed(1)}°`);
        R('NEXT PASS', pass ? `${fmt.time(new Date(pass.rise))} · ${Math.round(pass.max)}° max` : 'none in 24h');
      } else if (s.kind === 'quake') {
        const qk = s.ref as Quake;
        info.title.textContent = `M${qk.mag.toFixed(1)} EARTHQUAKE`;
        info.setStatus(fmt.ago(qk.t), qk.mag >= 6 ? 'off' : 'mid');
        R('PLACE', qk.place);
        R('DEPTH', `${qk.depth.toFixed(0)} km`);
        R('TSUNAMI', qk.tsunami ? 'ADVISORY' : 'none');
        actions.append(button('USGS ↗', () => window.open(qk.url, '_blank', 'noopener')));
      } else if (s.kind === 'event') {
        const e = s.ref as NaturalEvent;
        info.title.textContent = e.catName.toUpperCase();
        info.setStatus(fmt.ago(e.t), 'mid');
        R('EVENT', e.title);
        if (e.url) actions.append(button('SOURCE ↗', () => window.open(e.url, '_blank', 'noopener')));
      } else if (s.kind === 'launch') {
        const l = s.ref as Launch;
        info.title.textContent = 'LAUNCH';
        info.setStatus(l.status, 'mid');
        R('MISSION', l.name);
        R('PROVIDER', l.provider);
        R('PAD', l.pad);
        R('T-', `${Math.max(0, Math.round((l.net - Date.now()) / 36e5))} h`);
      } else if (s.kind === 'route') {
        const rr = (s.ref as { route: RouteInfo }).route;
        info.title.textContent = 'ROUTE';
        info.setStatus(rr.mode.toUpperCase(), 'ok');
        R('FROM', rr.from);
        R('TO', rr.to);
        R('DISTANCE', `${(rr.distance_m / 1000).toFixed(1)} km`, `${(rr.distance_m / 1609.34).toFixed(1)} mi`);
        R('TIME', `${Math.floor(rr.duration_s / 3600) ? `${Math.floor(rr.duration_s / 3600)} h ` : ''}${Math.round((rr.duration_s % 3600) / 60)} min`);
        actions.append(button('CLEAR ROUTE', () => {
          routeLayer.set(null);
          select(null);
        }));
      } else if (s.kind === 'cam') {
        const c = s.ref as Camera;
        info.title.textContent = 'CCTV';
        info.setStatus(`${c.src.toUpperCase()} · LIVE`, 'ok');
        info.body.append(camView(c, true));
        R('CAMERA', c.name);
        if (c.view) R('FACING', c.view.toUpperCase());
        R('POSITION', `${c.lat.toFixed(4)}°, ${c.lon.toFixed(4)}°`);
        const hop = (dir: 1 | -1) => {
          const list = nearestCameras(c.lat, c.lon, 12, 50).filter((x) => x.id !== c.id);
          const next = dir === 1 ? list[0] : list[list.length - 1];
          if (next) select({ kind: 'cam', ref: next, w: GEO.ecef(next.lat, next.lon, 0.08) }, true);
          else toast('No other camera nearby', 'warn');
        };
        actions.append(button('◀ PREV', () => hop(-1)), button('NEXT ▶', () => hop(1)), button('STREET VIEW', () => globe.cam.flyTo({ lat: c.lat, lon: c.lon, range: 1.2, tilt: 60 })));
      } else if (s.kind === 'ship') {
        const v = s.ref as Ship;
        info.title.textContent = (v.name || `MMSI ${v.mmsi}`).toUpperCase();
        info.setStatus(shipKind(v.type), shipKind(v.type) === 'MILITARY' ? 'off' : 'ok');
        R('MMSI', String(v.mmsi));
        R('SPEED', `${v.sog.toFixed(1)} kt`, `${(v.sog * 1.852).toFixed(0)} km/h`);
        R('COURSE', `${Math.round(v.cog)}°`, GEO.card(v.cog));
        if (v.dest) R('DEST', v.dest);
        if (v.nav < NAV_STATUS.length) R('STATUS', NAV_STATUS[v.nav]!);
        R('SEEN', fmt.ago(v.t), v.src);
        actions.append(button('FOLLOW', () => {
          const p = ships.pos(v);
          globe.cam.flyTo({ lat: p.lat, lon: p.lon, range: 25, tilt: 50 });
          setTimeout(() => (globe.cam.follow = () => ships.pos(shipLayer.selected ?? v)), 2500);
        }));
      } else if (s.kind === 'alert') {
        const a = s.ref as Alert;
        info.title.textContent = a.event.toUpperCase();
        info.setStatus(a.severity.toUpperCase(), a.severity === 'Extreme' || a.severity === 'Severe' ? 'off' : 'mid');
        if (a.headline) R('ALERT', a.headline);
        R('AREA', a.area.length > 140 ? `${a.area.slice(0, 140)}…` : a.area);
        R('UNTIL', fmt.time(new Date(a.expires)));
      } else if (s.kind === 'disaster') {
        const d = s.ref as Disaster;
        info.title.textContent = d.kind;
        info.setStatus(`${d.level.toUpperCase()} ALERT`, d.level === 'Red' ? 'off' : d.level === 'Orange' ? 'mid' : 'ok');
        R('EVENT', d.name || d.kind);
        if (d.country) R('WHERE', d.country);
        if (d.severity) R('SEVERITY', d.severity);
        if (d.from) R('SINCE', fmt.ago(d.from));
        if (d.url) actions.append(button('GDACS ↗', () => window.open(d.url, '_blank', 'noopener')));
      } else if (s.kind === 'buoy') {
        const b = s.ref as Buoy;
        info.title.textContent = `BUOY ${b.id}`;
        info.setStatus(fmt.ago(b.t), 'ok');
        if (b.wvht !== undefined) R('WAVES', `${b.wvht} m`, b.dpd ? `${b.dpd} s period` : undefined);
        if (b.wspd !== undefined) R('WIND', `${Math.round(b.wspd * 1.944)} kt${b.wdir !== undefined ? ` from ${GEO.card(b.wdir)}` : ''}`, b.gst !== undefined ? `gust ${Math.round(b.gst * 1.944)} kt` : undefined);
        if (b.wtmp !== undefined) R('WATER', `${b.wtmp} °C`);
        if (b.atmp !== undefined) R('AIR', `${b.atmp} °C`);
        if (b.pres !== undefined) R('PRESSURE', `${b.pres} hPa`);
        actions.append(button('NOAA ↗', () => window.open(`https://www.ndbc.noaa.gov/station_page.php?station=${encodeURIComponent(b.id)}`, '_blank', 'noopener')));
      } else if (s.kind === 'cable') {
        const c = s.ref as Cable;
        info.title.textContent = 'UNDERSEA CABLE';
        info.setStatus('TELEGEOGRAPHY', 'ok');
        R('NAME', c.name);
        R('SEGMENTS', String(c.lines.length));
      } else if (s.kind === 'enforce') {
        const e = s.ref as EnforceCam;
        info.title.textContent = ENFORCE_LABEL[e.kind];
        info.setStatus('OPENSTREETMAP', e.kind === 'anpr' ? 'off' : 'mid');
        if (e.name) R('NAME', e.name);
        if (e.operator) R('OPERATOR', e.operator);
        if (e.maxspeed) R('LIMIT', e.maxspeed);
        if (e.direction) R('FACING', /^\d+$/.test(e.direction) ? `${e.direction}° ${GEO.card(Number(e.direction))}` : e.direction);
        if (e.ref) R('REF', e.ref);
        if (e.tags['surveillance:zone']) R('WATCHES', e.tags['surveillance:zone']);
        R('WHERE', `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}`);
        info.body.append(h('small.dim', 'Location mapped by OpenStreetMap volunteers. No images.'));
        actions.append(button('OSM ↗', () => window.open(`https://www.openstreetmap.org/${e.id}`, '_blank', 'noopener')));
        actions.append(button('ZOOM', () => globe.cam.flyTo({ lat: e.lat, lon: e.lon, range: 0.8, tilt: 50 })));
      } else if (s.kind === 'dispatch') {
        const d = s.ref as Dispatch;
        info.title.textContent = '911 CALL';
        info.setStatus(fmt.ago(d.t), /fire/i.test(d.type) ? 'off' : 'mid');
        R('TYPE', d.type);
        R('ADDRESS', d.addr);
        R('INCIDENT', d.id);
      } else if (s.kind === 'city') {
        const c = s.ref as City;
        info.title.textContent = c.name.toUpperCase();
        info.setStatus(c.country, 'ok');
        R('POPULATION', fmt.n(c.pop));
        R('AIRCRAFT', `${air.nearby(c.lat, c.lon, 100).length} within 100 km`);
        actions.append(button('SET HOME', () => {
          settings.set({ home: { name: c.name, lat: c.lat, lon: c.lon } });
          toast(`Home set to ${c.name}`, 'ok');
        }));
      }
      actions.append(ask, button('✕', () => select(null)));
      info.body.append(actions);
    };
    function select(p: Pickable | null, fly = false): void {
      selected = p;
      shipLayer.selected = p?.kind === 'ship' ? (p.ref as Ship) : null;
      enforceLayer.selected = p?.kind === 'enforce' ? (p.ref as EnforceCam) : null;
      air.selected = p?.kind === 'air' ? (p.ref as Aircraft) : null;
      sats.selected = p?.kind === 'sat' ? (p.ref as Satellite) : null;
      camLayer.selected = p?.kind === 'cam' ? (p.ref as Camera) : null;
      if (!p) globe.cam.follow = null;
      if (p && fly) {
        const ll = GEO.ll(p.w);
        globe.cam.flyTo({ lat: ll.lat, lon: ll.lon, range: p.kind === 'sat' ? Math.max(6000, ll.alt * 3) : p.kind === 'air' || p.kind === 'ship' || p.kind === 'dispatch' ? 60 : p.kind === 'cam' ? 6 : 400, tilt: p.kind === 'air' || p.kind === 'ship' || p.kind === 'dispatch' ? 50 : p.kind === 'cam' ? 45 : 0 });
      }
      stopCamViews(p?.kind === 'cam' ? (p.ref as Camera).id : null);
      gridKey = '';
      paintInfo();
    }

    // ---------- live camera views ----------
    /** Live views currently on screen, refreshed every few seconds; stopped when hidden. */
    const views = new Map<HTMLElement, { cam: Camera; timer: number; url: string }>();
    const stopCamViews = (keep: string | null = null) => {
      for (const [el, v] of views) {
        if (v.cam.id === keep && el.isConnected) continue;
        clearInterval(v.timer);
        if (v.url) URL.revokeObjectURL(v.url);
        views.delete(el);
      }
    };
    /** A live picture of one camera: still images refreshed every few seconds, plus video where the camera offers it. */
    function camView(c: Camera, big: boolean): HTMLElement {
      const img = h('img', { alt: `Live view: ${c.name}` });
      const stamp = h('small.camstamp', 'CONNECTING…');
      const box = h(`div.camview${big ? '.big' : ''}` as 'div', img, stamp, h('i.camrec'));
      const v = { cam: c, timer: 0, url: '' };
      const load = async () => {
        if (!box.isConnected && v.url) return;
        try {
          const url = await fetchImage(c.image, c.src === 'New York' ? 5 : 30);
          if (v.url) URL.revokeObjectURL(v.url);
          v.url = url;
          img.src = url;
          stamp.textContent = `● REC  ${fmt.time(new Date())}  ${c.src.toUpperCase()}`;
          box.classList.remove('dead');
        } catch {
          stamp.textContent = 'SIGNAL LOST — retrying';
          box.classList.add('dead');
        }
      };
      void load();
      v.timer = window.setInterval(() => void load(), c.src === 'New York' ? 4000 : 15000);
      views.set(box, v);
      if (big) {
        const actions = h('div.row.wrap');
        if (c.video) {
          actions.append(button('▶ PLAY CLIP', () => {
            const vid = h('video', { src: c.video, autoplay: true, muted: true, playsInline: true, loop: true, controls: true });
            vid.addEventListener('error', () => toast('That clip is not available right now', 'warn'));
            box.replaceChildren(vid, stamp, h('i.camrec'));
          }));
        }
        if (c.hls && document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
          actions.append(button('▶ LIVE VIDEO', () => {
            const vid = h('video', { src: c.hls, autoplay: true, muted: true, playsInline: true, controls: true });
            vid.addEventListener('error', () => toast('The live stream is not available right now', 'warn'));
            box.replaceChildren(vid, stamp, h('i.camrec'));
          }));
        }
        return h('div', box, actions);
      }
      return box;
    }

    // ---------- CCTV grid: the four cameras nearest the view ----------
    const grid = panel('CCTV · NEAREST', { grow: false });
    grid.el.classList.add('camgrid');
    grid.el.hidden = true;
    let gridKey = '';
    const paintGrid = () => {
      // where the view is going (not where a fly-to animation happens to be right now)
      const T = globe.cam.target;
      const show = globe.vis.cams && T.range < 1500 && cams.list.length > 0 && selected?.kind !== 'cam';
      const near = show ? nearestCameras(T.lat, T.lon, 4, Math.max(30, T.range)) : [];
      grid.el.hidden = !near.length;
      const key = near.map((c) => c.id).join();
      if (key === gridKey) return;
      gridKey = key;
      for (const el of [...grid.body.children]) {
        const v = views.get(el as HTMLElement);
        if (v) {
          clearInterval(v.timer);
          if (v.url) URL.revokeObjectURL(v.url);
          views.delete(el as HTMLElement);
        }
      }
      clear(grid.body);
      grid.setStatus(near.length ? `${near[0]!.src.toUpperCase()} · ${near.length} LIVE` : '', 'ok');
      for (const c of near) {
        const tile = camView(c, false);
        tile.title = c.name;
        tile.append(h('span.camname', c.name));
        tile.addEventListener('click', () => select({ kind: 'cam', ref: c, w: GEO.ecef(c.lat, c.lon, 0.08) }, true));
        grid.body.append(tile);
      }
    };
    camEvents.on('change', () => {
      gridKey = '';
    });
    openNearestCamera = (lat, lon) => {
      loadCameras();
      if (inCalifornia(lat, lon)) loadCalifornia();
      globe.vis = { ...globe.vis, cams: true };
      const c = nearestCameras(lat, lon, 1, 80)[0];
      if (!c) return false;
      select({ kind: 'cam', ref: c, w: GEO.ecef(c.lat, c.lon, 0.08) }, true);
      return true;
    };

    // ---------- bottom: readout + buttons ----------
    const readout = h('div.readout');
    const btns = h(
      'div.btns',
      button('YOU', () => {
        const L = home();
        globe.cam.flyTo({ lat: L.lat, lon: L.lon, range: 300, tilt: 0, hd: 0 });
      }),
      button('NORTH', () => (globe.cam.target.hd = 0)),
      button('TILT', () => (globe.cam.target.tilt = globe.cam.target.tilt > 5 ? 0 : 55)),
      button('SUN', (b) => b.classList.toggle('on', (globe.sunLock = !globe.sunLock))),
      button('SPIN', (b) => b.classList.toggle('on', (globe.cam.autoSpin = !globe.cam.autoSpin))),
    );

    // ---------- zoom rail ----------
    let hold = 0;
    const zIn = button('+', () => undefined);
    const zOut = button('−', () => undefined);
    for (const [b, dir] of [[zIn, -1], [zOut, 1]] as const) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold = dir;
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => (hold = 0));
    }
    const zLabel = h('small');
    const rail = h('div.zoomrail', zIn, zLabel, zOut);

    const labels = h('div.labels');
    const top = h('div.eyetop', h('div.search', q, button('GO', () => void search())), modes);
    root.append(h('div.hud.eye', top, h('div.eyemid', labels, info.el, grid.el, lay.el, rail), h('div.eyebot', readout, btns)));

    // ---------- gestures on the 3D canvas ----------
    const cv = gfx.cv;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; a: number; my: number } | null = null;
    let moved = 0;
    let t0 = 0;
    let lastTap = 0;
    const vel = { x: 0, y: 0 };
    const active = () => ui.get().tab === 'eye';
    const pan = (dx: number, dy: number) => {
      const c = globe.cam;
      const T = c.target;
      const k = c.kmPerPx();
      const hd = c.hd * RAD;
      const tl = Math.max(0.35, Math.cos(c.tilt * RAD));
      const E = -dx * k * Math.cos(hd) + (dy * k * Math.sin(hd)) / tl;
      const N = dx * k * Math.sin(hd) + (dy * k * Math.cos(hd)) / tl;
      T.lat = clamp(T.lat + N / 111.19, -84, 84);
      T.lon += E / (111.19 * Math.max(0.05, Math.cos(T.lat * RAD)));
      c.fly = null;
      c.follow = null;
      c.autoSpin = false;
    };
    cv.addEventListener('pointerdown', (e) => {
      if (!active()) return;
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      t0 = performance.now();
      moved = 0;
      globe.cam.dragging = true;
      vel.x = vel.y = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!active()) return;
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 1) {
        if (e.buttons === 2 || e.shiftKey) {
          globe.cam.target.hd += dx * 0.35;
          globe.cam.target.tilt = clamp(globe.cam.target.tilt - dy * 0.3, 0, 86);
        } else {
          pan(dx, dy);
          vel.x = dx;
          vel.y = dy;
        }
      } else if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const my = (a.y + b.y) / 2;
        const r = cv.getBoundingClientRect();
        globe.cam.zoom(clamp(pinch.d / Math.max(10, d), 0.6, 1.7), (a.x + b.x) / 2 - r.left, my - r.top);
        let da = ang - pinch.a;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        globe.cam.target.hd -= da * DEG;
        globe.cam.target.tilt = clamp(globe.cam.target.tilt - (my - pinch.my) * 0.3, 0, 86);
        pinch = { d, a: ang, my };
      }
    });
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size < 2) pinch = null;
      if (pts.size) return;
      globe.cam.dragging = false;
      if (!active() || moved >= 8 || performance.now() - t0 > 350) return;
      vel.x = vel.y = 0;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const now = performance.now();
      if (now - lastTap < 320) {
        const g = globe.cam.pick(x, y);
        if (g) globe.cam.flyTo({ lat: g.lat, lon: g.lon, range: Math.max(1, globe.cam.target.range * 0.4) });
        lastTap = 0;
        return;
      }
      lastTap = now;
      const hit = globe.pickAt(x, y, innerWidth < 700 ? 34 : 26);
      if (hit) select(hit);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      if (!active()) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 420 : e.deltaY;
      const r = cv.getBoundingClientRect();
      globe.cam.zoom(clamp(Math.exp(dy * (e.ctrlKey ? 0.014 : 0.0021)), 0.55, 1.8), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => active() && e.preventDefault());
    addEventListener('keydown', (e) => {
      if (!active() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) return;
      if (e.key === '+' || e.key === '=') globe.cam.zoom(0.7);
      else if (e.key === '-') globe.cam.zoom(1.43);
      else if (e.key === 'Escape') select(null);
      else if (e.key.startsWith('Arrow')) {
        const s = 60;
        pan(e.key === 'ArrowLeft' ? s : e.key === 'ArrowRight' ? -s : 0, e.key === 'ArrowUp' ? s : e.key === 'ArrowDown' ? -s : 0);
      }
    });

    // ---------- per-frame + periodic UI ----------
    const pool: HTMLElement[] = [];
    const paintLabels = () => {
      const c = globe.cam;
      const cs = c.cs;
      if (!cs) return;
      const items: [number, number, string, string][] = [];
      const add = (w: [number, number, number], txt: string, col: string) => {
        const p = c.project(w);
        if (!p || !c.visible(w) || p[0] < -20 || p[1] < -20 || p[0] > innerWidth + 20 || p[1] > innerHeight + 20) return;
        items.push([p[0], p[1], txt, col]);
      };
      const alt = cs.alt;
      if (globe.vis.cities && alt < 14000) {
        const minPop = alt > 6000 ? 3e6 : alt > 3000 ? 1e6 : alt > 1200 ? 4e5 : alt > 400 ? 1.5e5 : 0;
        let n = 0;
        for (const ct of World.cities) {
          if (ct.pop < minPop) continue;
          add(GEO.ecef(ct.lat, ct.lon, 2), ct.name, '#ffd9a0');
          if (++n > 50) break;
        }
      }
      if (globe.vis.air && alt < 900) {
        const now = Date.now();
        const near = [...air.list.values()]
          .map((a) => ({ a, w: air.world(a, now) }))
          .map((o) => ({ ...o, p: c.project(o.w) }))
          .filter((o) => o.p)
          .sort((u, v) => Math.hypot(u.p![0] - innerWidth / 2, u.p![1] - innerHeight / 2) - Math.hypot(v.p![0] - innerWidth / 2, v.p![1] - innerHeight / 2))
          .slice(0, alt < 200 ? 30 : 16);
        for (const o of near) add(o.w, `${o.a.call || o.a.hex}${o.a.gnd ? '' : ` ${Math.round(o.a.altft / 100)}`}`, o.a.mil ? '#ff8a8a' : '#bff');
      }
      if (globe.vis.sats && alt > 1500) for (const s of sats.list.filter((x) => x.group === 'stations').slice(0, 12)) add(s.w, s.name.replace(/ \(.*/, ''), '#ffe08a');
      if (globe.vis.enforce && alt < 25) {
        let n = 0;
        for (const e of enforce.list.values()) {
          if (e.kind === 'cctv') continue;
          add(GEO.ecef(e.lat, e.lon, 0.03), e.kind === 'anpr' ? 'ANPR' : e.maxspeed ? `${e.maxspeed.replace(/ mph/, '')}` : e.kind === 'redlight' ? 'RED LIGHT' : 'SPEED', e.kind === 'anpr' ? '#ff7ad9' : '#ffd84a');
          if (++n > 30) break;
        }
      }
      if (globe.vis.ships && alt < 250) {
        const now = Date.now();
        let n = 0;
        for (const v of ships.list.values()) {
          if (!v.name || v.sog < 0.5 || v === shipLayer.selected) continue;
          add(shipLayer.world(v, now), v.name, '#9fe8b0');
          if (++n > 24) break;
        }
      }
      if (selected) add(selected.kind === 'air' ? air.world(selected.ref as Aircraft, Date.now()) : selected.kind === 'ship' ? shipLayer.world(selected.ref as Ship, Date.now()) : selected.w, '◆ TARGET', '#fff');
      items.slice(0, 90).forEach((it, i) => {
        let e = pool[i];
        if (!e) {
          e = h('div.lb');
          labels.append(e);
          pool[i] = e;
        }
        e.style.display = 'block';
        e.style.transform = `translate(${it[0].toFixed(0)}px,${it[1].toFixed(0)}px)`;
        if (e.textContent !== it[2]) e.textContent = it[2];
        e.style.color = it[3];
      });
      for (let i = items.length; i < pool.length; i++) pool[i]!.style.display = 'none';
    };
    onFrame((dt) => {
      if (!active()) return;
      if (hold) globe.cam.zoom(Math.exp(hold * 1.7 * dt), innerWidth / 2, innerHeight / 2);
      if (!globe.cam.dragging && (Math.abs(vel.x) > 0.05 || Math.abs(vel.y) > 0.05) && !globe.cam.fly) {
        pan(vel.x, vel.y);
        vel.x *= 0.92;
        vel.y *= 0.92;
      }
      if (!globe.cam.fly && !globe.cam.dragging) {
        const want = globe.cam.target.range < 3200 ? clamp((3200 - globe.cam.target.range) / 3200, 0, 1) * 58 : 0;
        if (globe.cam.target.tilt < want) globe.cam.target.tilt += (want - globe.cam.target.tilt) * Math.min(1, dt * 1.2);
      }
    });
    onFrame(() => active() && paintLabels(), 0.1);
    onFrame(() => {
      if (!active()) return;
      const c = globe.cam;
      const g = c.pick(innerWidth / 2, innerHeight / 2) ?? { lat: c.lat, lon: c.lon };
      const near = World.near(g.lat, g.lon, 2e5);
      const alt = c.cs?.alt ?? c.range;
      const mk = (n: number) => (n < 1 ? `${(n * 1000).toFixed(0)} m` : n < 100 ? `${n.toFixed(1)} km` : `${fmt.n(n)} km`);
      readout.textContent = `${g.lat.toFixed(3)}° ${g.lon.toFixed(3)}°  ${near && near.km < 400 ? near.city.name.toUpperCase() : ''}\nALT ${mk(alt)} · TILT ${Math.round(c.tilt)}° · HDG ${Math.round((((c.hd % 360) + 360) % 360))}° · ${SENSOR_MODES[globe.mode]![0]}\n${air.list.size} AC · ${ships.list.size} SHIP · ${cams.list.length} CAM · ${sats.list.length} SAT · ${quakes.data?.length ?? 0} EQ${radar.shownAt ? ` · RADAR ${fmt.ago(radar.shownAt)}` : ''}${imagery.credit ? `\n${imagery.credit}` : ''}`;
      // Start a feed only once its layer is switched on (big downloads stay optional).
      const want: [keyof LayerVisibility, { start(): unknown }][] = [['radar', radarFrames], ['alerts', alerts], ['disasters', disasters], ['aurora', aurora], ['dispatch', dispatch], ['buoys', buoys], ['cables', cables]];
      for (const [k, f] of want) if (globe.vis[k]) f.start();
      zLabel.textContent = mk(c.range);
      LAYERS.forEach(([k, , f], i) => {
        counts[i]!.textContent = f();
        boxes[i]!.checked = globe.vis[k];
      });
      lay.setStatus(air.status, air.status === 'LIVE' ? 'ok' : air.status === 'STALE' ? 'mid' : 'off');
      paintModes();
      if (selected?.kind === 'air' || selected?.kind === 'ship') paintInfo();
      if (globe.vis.cams) {
        loadCameras();
        if (globe.cam.range < 2500 && inCalifornia(g.lat, g.lon)) loadCalifornia();
      }
      paintGrid();
    }, 1);

    return {
      enter() {
        quakes.start();
        events.start();
        launches.start();
        const tick = () => void air.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
        tick();
        airTimer = window.setInterval(tick, 8000);
        const shipTick = () => {
          if (globe.vis.ships) void ships.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
          if (globe.vis.enforce) void enforce.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
        };
        shipTick();
        shipTimer = window.setInterval(shipTick, 8000);
        paintModes();
      },
      leave() {
        clearInterval(airTimer);
        clearInterval(shipTimer);
        stopCamViews();
        gridKey = '';
        clear(grid.body);
      },
      describe: () => `${cams.list.length ? `${cams.list.length} public cameras on the globe (${[...cams.sources].join(', ')}). ` : ''}God's Eye globe at ${globe.cam.lat.toFixed(2)}, ${globe.cam.lon.toFixed(2)}, ${Math.round(globe.cam.range)} km range, sensor ${SENSOR_MODES[globe.mode]![0]}${selected ? `, selected ${describe(selected)}` : ''}. ${air.list.size} aircraft, ${ships.list.size} ships, ${disasters.data?.length ?? 0} GDACS disasters, ${alerts.data?.length ?? 0} US weather alerts loaded.`,
    };
  },
};
