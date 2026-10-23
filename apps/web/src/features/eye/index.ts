/**
 * GOD'S EYE tab: the live globe. Search, sensor modes, layer toggles, target card,
 * floating labels, touch/mouse gestures, the zoom rail, and live public CCTV: tap a camera
 * to watch it, and a grid shows the four cameras nearest the view.
 */
import { brain } from '../../api/brain';
import { send } from '../../assistant/session';
import { flyTo } from '../../commands/builtin';
import { clear, fmt, h, icon } from '../../core/dom';
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
import { openMapSheet } from '../../ui/mapsheet';
import { openStreetView } from '../../ui/streetview';
import { reverseAddress, whatIs } from '../../data/places';
import { spotLayer, type Spot } from '../../engine/layers/spot';
import { home, settings, ui } from '../../state/app';
import { button, panel, row, toast } from '../../ui/components';
import { routeLayer, type RouteInfo } from '../../engine/layers/route';
import { imagery, SOURCES } from '../../engine/layers/imagery';
import { buildings } from '../../engine/layers/buildings';
import { enforceLayer, INTEL_LAYERS, shipLayer } from '../../engine/layers/intel';
import { enforce, ENFORCE_LABEL, inWestMidlands, loadWmSafety, type EnforceCam } from '../../data/enforce';
import { crime, crimeFamily, crimeLabel, type Crime } from '../../data/crime';
import { crimeLayer } from '../../engine/layers/crime';
import { radar, trafficState } from '../../engine/layers/radar';
import {
  alerts, aurora, buoys, cables, disasters, dispatch, NAV_STATUS, radarFrames, shipKind, ships,
  type Alert, type Buoy, type Cable, type Disaster, type Dispatch, type Ship,
} from '../../data/intel';
import { camLayer } from '../../engine/layers/cams';
import { cams, camEvents, inCalifornia, loadCalifornia, loadCameras, nearestCameras, NH_CREDIT, type Camera } from '../../data/cameras';
import { transit, delayText, type Vehicle } from '../../data/transit';
import { transitLayer } from '../../engine/layers/transit';
import { delayWords, incidents, INCIDENT_CREDIT, severity, type Incident } from '../../data/incidents';
import { incidentLayer } from '../../engine/layers/incidents';
import { meLayer } from '../../engine/layers/me';
import { roadAhead, type Me } from '../../data/roadahead';
import { createRoadAhead } from './roadahead';
import { fetchImage } from '../../api/feed';

/** Set while God's Eye is mounted: open the camera nearest a place (used by the brain's show_cameras). */
/** Open the nearest public camera within `maxKm`; returns its distance (km), or null if none is that close. */
export let openNearestCamera: ((lat: number, lon: number, maxKm?: number) => number | null) | null = null;
/** ROAD AHEAD on/off (the brain's road_ahead command and the bar button). */
export let startRoadAhead: (() => void) | null = null;
export let stopRoadAhead: (() => void) | null = null;

let layersInstalled = false;
function installLayers(): void {
  if (layersInstalled) return;
  layersInstalled = true;
  sats.init();
  if (!globe.layers.includes(routeLayer)) globe.layers.push(routeLayer);
  globe.layers.push(spotLayer);
  globe.layers.push(quakeLayer, eventLayer, ...INTEL_LAYERS, crimeLayer, incidentLayer, transitLayer, sats, air, camLayer, meLayer);
  air.onEmergency = (a) => toast(`${a.call || a.hex} squawking ${a.emergency}`, 'bad');
  setInterval(() => void sats.refresh(), 6 * 3600_000);
  void sats.refresh();
}

function describe(sel: Pickable): string {
  const r = sel.ref as Record<string, unknown>;
  switch (sel.kind) {
    case 'spot': {
      const sp = r as unknown as Spot;
      return `the spot at ${sp.lat.toFixed(4)}, ${sp.lon.toFixed(4)}${sp.name ? ` near ${sp.name}` : ''}${sp.address ? `: ${sp.address}` : ''}`;
    }
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
    case 'transit': {
      const v = r as unknown as Vehicle;
      return `${v.kind} ${v.line}${v.dest ? ` to ${v.dest}` : ''}${v.operator ? ` (${v.operator})` : ''}${v.delayS != null ? `, ${delayText(v.delayS)}` : ''} (live from ${v.src})`;
    }
    case 'incident': {
      const i = r as unknown as Incident;
      return `road incident: ${i.title || `${i.road} ${i.direction}`} — ${i.reason}${i.delayS ? `, ${delayWords(i.delayS)} delay` : ''}${i.normalBy ? `; ${i.normalBy}` : ''} (National Highways)`;
    }
    case 'me':
      return `the owner's own position (ROAD AHEAD), ${(r as unknown as Me).lat.toFixed(4)}, ${(r as unknown as Me).lon.toFixed(4)}`;
    case 'crime': {
      const c = r as unknown as Crime;
      return `a reported crime (${crimeLabel(c.category).toLowerCase()}) on or near ${c.street || 'an unnamed street'} in ${c.month}${c.outcome ? `, outcome: ${c.outcome.toLowerCase()}` : ''} (police.uk open data)`;
    }
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
    const q = h('input', { placeholder: 'Search place, flight, ship, satellite…', autocomplete: 'off', enterKeyHint: 'search', 'aria-label': 'Search the globe' });
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
    // Sensor looks (night vision, thermal…) are a look, not a tool: they live in the LOOK menu below.
    const modes = h('div.modes.chips', ...SENSOR_MODES.map(([n], i) => button(n, () => {
      globe.mode = i;
      ui.set({});
    })));
    const paintModes = () => [...modes.children].forEach((b, i) => b.classList.toggle('on', i === globe.mode));

    // ---------- layers ----------
    const lay = panel('LAYERS', { grow: false });
    lay.el.classList.add('eyelay');
    const LAYERS: [keyof LayerVisibility, string, () => string][] = [
      ['imagery', 'MAP TILES', () => (imagery.credit ? `${imagery.source.toUpperCase()} Z${imagery.level}` : imagery.source.toUpperCase())],
      ['buildings', '3D BUILDINGS', () => (globe.cam.range > 6 ? 'ZOOM IN · <6 KM' : buildings.status || (buildings.count ? String(buildings.count) : ''))],
      ['air', 'AIRCRAFT', () => `${air.list.size} ${air.status}`],
      ['sats', 'SATELLITES', () => String(sats.list.length)],
      ['quakes', 'QUAKES', () => String(quakes.data?.length ?? 0)],
      ['events', 'EVENTS', () => String((events.data?.length ?? 0) + (launches.data?.length ?? 0))],
      ['enforce', 'ANPR / SPEED', () => {
        if (globe.cam.range > 250 && !enforce.list.size) return 'ZOOM IN';
        const c = enforce.counts();
        return enforce.status === 'SYNC' && !enforce.list.size ? 'SYNC' : `${c.anpr} ANPR · ${c.speed + c.average + c.redlight + c.buslane}`;
      }],
      ['crime', 'STREET CRIME', () => {
        if (!crime.list.size) return crime.status === 'SYNC' ? 'SYNC' : crime.status === 'NO FEED' ? 'NO FEED' : globe.cam.range > 45 ? 'ZOOM IN · UK' : 'UK ONLY';
        const c = crime.counts();
        return `${c.total} · ${crime.month}`;
      }],
      ['ships', 'SHIPS (AIS)', () => `${ships.list.size} ${ships.status}`],
      ['transit', 'BUSES & TRAMS', () => {
        if (!transit.list.size) return transit.status === 'SYNC' ? 'SYNC' : transit.status === 'NO FEED' ? 'NO FEED' : globe.cam.range > 120 ? 'ZOOM IN' : '';
        const c = transit.counts();
        return `${c.bus} BUS · ${c.tram} TRAM`;
      }],
      ['incidents', 'ROAD INCIDENTS', () => (incidents.list.size ? String(incidents.list.size) : incidents.status === 'SYNC' ? 'SYNC' : incidents.status === 'NO FEED' ? 'NO FEED' : 'MOTORWAYS')],
      ['traffic', 'LIVE TRAFFIC', () => (trafficState.ready ? 'TOMTOM' : 'KEY NEEDED')],
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
    // Grouped tiles (two columns) instead of one long list: on a phone the panel is a sheet
    // along the bottom that scrolls, so every layer is reachable.
    const GROUPS: [string, (keyof LayerVisibility)[]][] = [
      ['STREETS & SAFETY', ['cams', 'traffic', 'incidents', 'transit', 'enforce', 'crime', 'dispatch']],
      ['AIR, SEA & SPACE', ['air', 'ships', 'sats', 'orbits']],
      ['WEATHER & HAZARDS', ['radar', 'alerts', 'quakes', 'events', 'disasters', 'aurora', 'buoys']],
      ['MAP', ['imagery', 'buildings', 'borders', 'adm1', 'cities', 'airports', 'clouds', 'grid', 'cables']],
    ];
    const counts: HTMLElement[] = [];
    const boxes: HTMLButtonElement[] = [];
    const tileFor = new Map<keyof LayerVisibility, number>();
    LAYERS.forEach(([k], i) => tileFor.set(k, i));
    const tiles: HTMLButtonElement[] = LAYERS.map(([k, n, f]) => {
      const em = h('em', f());
      const b = h('button.ltile', { type: 'button', 'aria-pressed': String(globe.vis[k]) }, h('span', n), em);
      b.classList.toggle('on', globe.vis[k]);
      b.addEventListener('click', () => {
        globe.vis = { ...globe.vis, [k]: !globe.vis[k] };
        sats.showOrbit = globe.vis.orbits;
        b.classList.toggle('on', globe.vis[k]);
        b.setAttribute('aria-pressed', String(globe.vis[k]));
      });
      counts.push(em);
      boxes.push(b);
      return b;
    });
    const placed = new Set<number>();
    for (const [title, keys] of GROUPS) {
      const idx = keys.map((k) => tileFor.get(k)).filter((i): i is number => i !== undefined);
      idx.forEach((i) => placed.add(i));
      lay.body.append(h('div.lgroup', title), h('div.lgrid', ...idx.map((i) => tiles[i]!)));
    }
    const rest = tiles.filter((_, i) => !placed.has(i));
    if (rest.length) lay.body.append(h('div.lgroup', 'MORE'), h('div.lgrid', ...rest));
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
      if (s.kind === 'spot') {
        const sp = s.ref as Spot;
        info.title.textContent = (sp.name || 'THIS SPOT').toUpperCase();
        info.setStatus('TAPPED', 'ok');
        R('WHERE', `${sp.lat.toFixed(4)}°, ${sp.lon.toFixed(4)}°`);
        const near = World.near(sp.lat, sp.lon, 2e5);
        if (near) R('NEAR', near.city.name, `${Math.round(near.km)} km`);
        // The address arrives later (see lookupSpot) and is written into this row in place.
        const addr = row('ADDRESS', sp.address ?? 'Looking up…', null, { wrap: true });
        addr.classList.add('addr');
        info.body.append(addr);
        const spot = () => ({ lat: sp.lat, lon: sp.lon, name: sp.name, heading: globe.cam.hd });
        actions.append(
          button('STREET VIEW', () => void openStreetView(spot())),
          button('MAP', () => openMapSheet('map', spot())),
          button('3D', () => openMapSheet('3d', spot())),
          button('TRAFFIC', () => openMapSheet('traffic', spot())),
          button('ZOOM', () => globe.cam.flyTo({ lat: sp.lat, lon: sp.lon, range: 1.2, tilt: 55 })),
          button('CLEAR', () => {
            spotLayer.set(null);
            select(null);
          }),
        );
      } else if (s.kind === 'air') {
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
        if (c.src === 'National Highways') info.body.append(h('small.dim', `${NH_CREDIT} A new frame every 20–30 seconds; the time is printed on the picture.`));
        const hop = (dir: 1 | -1) => {
          const list = nearestCameras(c.lat, c.lon, 12, 50).filter((x) => x.id !== c.id);
          const next = dir === 1 ? list[0] : list[list.length - 1];
          if (next) select({ kind: 'cam', ref: next, w: GEO.ecef(next.lat, next.lon, 0.08) }, true);
          else toast('No other camera nearby', 'warn');
        };
        actions.append(button('◀ PREV', () => hop(-1)), button('NEXT ▶', () => hop(1)), button('STREET VIEW', () => void openStreetView({ lat: c.lat, lon: c.lon, name: c.name })));
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
      } else if (s.kind === 'crime') {
        const c = s.ref as Crime;
        const fam = crimeFamily(c.category);
        info.title.textContent = crimeLabel(c.category);
        info.setStatus(`POLICE.UK · ${c.month}`, fam === 'person' ? 'off' : fam === 'property' ? 'mid' : 'ok');
        R('WHERE', c.street ? `On or near ${c.street}` : 'Street not given');
        R('MONTH', c.month);
        R('OUTCOME', c.outcome || 'Not yet recorded');
        const around = crime.near(c.lat, c.lon, 0.5);
        const tally = around.reduce<Record<string, number>>((m, x) => ((m[x.category] = (m[x.category] ?? 0) + 1), m), {});
        R('WITHIN 500 M', `${around.length} reported`, Object.entries(tally).sort((p, q) => q[1] - p[1]).slice(0, 2).map(([k, n]) => `${n} ${crimeLabel(k).toLowerCase()}`).join(', ') || undefined);
        info.body.append(h('small.dim', 'Locations are approximate (snapped to a nearby point by the police). Nobody is identified.'));
      } else if (s.kind === 'enforce') {
        const e = s.ref as EnforceCam;
        const wmp = e.source === 'wmp';
        info.title.textContent = ENFORCE_LABEL[e.kind];
        info.setStatus(wmp ? 'WEST MIDLANDS POLICE' : 'OPENSTREETMAP', e.kind === 'anpr' ? 'off' : 'mid');
        if (e.name) R('NAME', e.name);
        if (e.operator) R('OPERATOR', e.operator);
        if (wmp) {
          const d = e.detail ?? {};
          R('LIMIT', d.limit ? (/^\d+$/.test(d.limit) ? `${d.limit} mph` : d.limit) : e.maxspeed || 'Not given');
          R('OFFENCES (2024)', d.offences !== undefined ? fmt.n(d.offences) : 'Not given');
          R('TOP SPEED', d.topSpeed ? `${d.topSpeed} mph` : 'Not given');
          R('LAST ENFORCED', d.lastEnforced ? new Date(`${d.lastEnforced}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No data');
          if (d.area) R('AREA', d.area);
        } else if (e.maxspeed) R('LIMIT', e.maxspeed);
        if (e.direction) R('FACING', /^\d+$/.test(e.direction) ? `${e.direction}° ${GEO.card(Number(e.direction))}` : e.direction);
        if (e.ref) R('REF', e.ref);
        if (e.tags['surveillance:zone']) R('WATCHES', e.tags['surveillance:zone']);
        R('WHERE', `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}`);
        info.body.append(h('small.dim', wmp ? 'West Midlands Police Camera Enforcement Unit site (wmsafetycameras.co.uk): enforcement data for 2024, published Jan 2025. No images.' : 'Location mapped by OpenStreetMap volunteers. No images.'));
        actions.append(wmp ? button('WMP ↗', () => window.open('https://wmsafetycameras.co.uk/camera_map/', '_blank', 'noopener')) : button('OSM ↗', () => window.open(`https://www.openstreetmap.org/${e.id}`, '_blank', 'noopener')));
        actions.append(button('ZOOM', () => globe.cam.flyTo({ lat: e.lat, lon: e.lon, range: 0.8, tilt: 50 })));
      } else if (s.kind === 'transit') {
        const v = s.ref as Vehicle;
        info.title.textContent = `${v.kind === 'tram' ? 'TRAM' : 'BUS'} ${v.line}`.toUpperCase();
        info.setStatus(`${v.src.toUpperCase()} · ${fmt.ago(v.t)}`, Date.now() - v.t < 4 * 60_000 ? 'ok' : 'mid');
        if (v.dest) R('TO', v.dest);
        if (v.operator) R('OPERATOR', v.operator);
        if (v.speedMs != null) R('SPEED', `${Math.round(v.speedMs * 2.23694)} mph`, v.bearing != null ? GEO.card(v.bearing) : undefined);
        if (v.delayS != null) R('RUNNING', delayText(v.delayS));
        if (transit.credit) info.body.append(h('small.dim', transit.credit));
        actions.append(button('FOLLOW', () => {
          const p = transit.pos(v);
          globe.cam.flyTo({ lat: p.lat, lon: p.lon, range: 4, tilt: 50 });
          setTimeout(() => (globe.cam.follow = () => transit.pos(transitLayer.selected ?? v)), 2500);
        }));
      } else if (s.kind === 'incident') {
        const i = s.ref as Incident;
        const sev = severity(i);
        info.title.textContent = `${i.road} ${i.direction}`.trim().toUpperCase() || 'ROAD INCIDENT';
        info.setStatus(sev === 3 ? 'CLOSED' : sev === 2 ? 'SERIOUS' : sev === 1 ? 'DELAYS' : 'MINOR', sev >= 2 ? 'off' : 'mid');
        R('WHERE', i.title || `${i.road} ${i.direction}`);
        R('WHAT', i.reason || 'incident');
        if (i.delayS) R('DELAY', delayWords(i.delayS));
        if (/[1-9]/.test(i.lanesClosed)) R('LANES CLOSED', i.lanesClosed.replace(/\|/g, ' / '));
        if (i.normalBy) R('CLEAR', i.normalBy, undefined);
        if (i.updated) R('UPDATED', fmt.ago(i.updated));
        info.body.append(h('small.dim', `${INCIDENT_CREDIT}. Placed at the junction it names.`));
        actions.append(button('ZOOM', () => globe.cam.flyTo({ lat: i.lat, lon: i.lon, range: 3, tilt: 50 })));
      } else if (s.kind === 'me') {
        const m = s.ref as Me;
        info.title.textContent = 'YOU';
        info.setStatus(`GPS ±${Math.round(m.accuracy)} m`, 'ok');
        R('WHERE', `${m.lat.toFixed(4)}°, ${m.lon.toFixed(4)}°`);
        if (m.speed != null) R('SPEED', `${Math.round(m.speed * 2.23694)} mph`);
        if (m.heading != null) R('HEADING', `${Math.round(m.heading)}°`, GEO.card(m.heading));
        info.body.append(h('small.dim', 'Your phone\'s own position. It stays on this device.'));
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
        const at = { lat: c.lat, lon: c.lon, name: c.name };
        actions.append(button('STREET VIEW', () => void openStreetView(at)), button('MAP', () => openMapSheet('map', at)), button('3D', () => openMapSheet('3d', at)), button('TRAFFIC', () => openMapSheet('traffic', at)));
        actions.append(button('SET HOME', () => {
          settings.set({ home: { name: c.name, lat: c.lat, lon: c.lon } });
          toast(`Home set to ${c.name}`, 'ok');
        }));
      }
      actions.append(ask, button('✕', () => select(null)));
      info.body.append(actions);
    };
    /** The address of a tapped spot, looked up once; the card (if it still shows the spot) is updated in place, nothing repaints. */
    const lookupSpot = (sp: Spot) =>
      void reverseAddress(sp.lat, sp.lon)
        .then((r) => {
          sp.address = [whatIs(r), r.display_name].filter(Boolean).join(' — ') || 'No address known here';
          if (!sp.name && r.name) sp.name = r.name;
        })
        .catch(() => {
          sp.address = 'Address service not reachable';
        })
        .finally(() => {
          if (selected?.ref !== sp) return;
          const v = info.body.querySelector('.rw.addr .v');
          if (v) v.textContent = sp.address ?? '';
          info.title.textContent = (sp.name || 'THIS SPOT').toUpperCase();
        });
    function select(p: Pickable | null, fly = false): void {
      selected = p;
      shipLayer.selected = p?.kind === 'ship' ? (p.ref as Ship) : null;
      enforceLayer.selected = p?.kind === 'enforce' ? (p.ref as EnforceCam) : null;
      crimeLayer.selected = p?.kind === 'crime' ? (p.ref as Crime) : null;
      air.selected = p?.kind === 'air' ? (p.ref as Aircraft) : null;
      sats.selected = p?.kind === 'sat' ? (p.ref as Satellite) : null;
      camLayer.selected = p?.kind === 'cam' ? (p.ref as Camera) : null;
      transitLayer.selected = p?.kind === 'transit' ? (p.ref as Vehicle) : null;
      incidentLayer.selected = p?.kind === 'incident' ? (p.ref as Incident) : null;
      if (!p && !roadAhead.on) globe.cam.follow = null;
      if (p && fly) {
        const ll = GEO.ll(p.w);
        globe.cam.flyTo({ lat: ll.lat, lon: ll.lon, range: p.kind === 'sat' ? Math.max(6000, ll.alt * 3) : p.kind === 'air' || p.kind === 'ship' || p.kind === 'dispatch' ? 60 : p.kind === 'incident' ? 12 : p.kind === 'cam' || p.kind === 'transit' ? 6 : p.kind === 'crime' || p.kind === 'enforce' || p.kind === 'me' ? 4 : 400, tilt: p.kind === 'air' || p.kind === 'ship' || p.kind === 'dispatch' || p.kind === 'incident' ? 50 : p.kind === 'cam' || p.kind === 'crime' || p.kind === 'enforce' || p.kind === 'transit' || p.kind === 'me' ? 45 : 0 });
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
          const url = await fetchImage(c.image, c.src === 'New York' ? 5 : c.src === 'National Highways' ? 20 : 30);
          if (v.url) URL.revokeObjectURL(v.url);
          v.url = url;
          img.src = url;
          stamp.textContent = `● REC  ${fmt.time(new Date())}  ${c.src.toUpperCase()}`;
          box.classList.remove('dead');
        } catch (e) {
          stamp.textContent = (e as Error)?.message === 'offline' ? 'CAMERA OFFLINE (National Highways)' : 'SIGNAL LOST — retrying';
          box.classList.add('dead');
        }
      };
      void load();
      v.timer = window.setInterval(() => void load(), c.src === 'New York' ? 4000 : c.src === 'National Highways' ? 20000 : 15000);
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
    // ---------- ROAD AHEAD: follow the phone, what lies ahead ----------
    const ra = createRoadAhead({
      cameraView: (c) => camView(c, false),
      flyTo: (lat, lon, rangeKm) => globe.cam.flyTo({ lat, lon, range: rangeKm, tilt: 50 }),
    });
    startRoadAhead = () => {
      loadCameras();
      ra.start();
      raBtn.classList.add('on');
    };
    stopRoadAhead = () => {
      ra.stop();
      raBtn.classList.remove('on');
    };
    const raBtn = button('ROAD AHEAD', () => (ra.on ? stopRoadAhead!() : startRoadAhead!()));
    openNearestCamera = (lat, lon, maxKm = 40) => {
      loadCameras();
      if (inCalifornia(lat, lon)) loadCalifornia();
      globe.vis = { ...globe.vis, cams: true };
      const c = nearestCameras(lat, lon, 1, maxKm)[0];
      if (!c) return null;
      select({ kind: 'cam', ref: c, w: GEO.ecef(c.lat, c.lon, 0.08) }, true);
      return c.km;
    };

    // ---------- bottom: readout + buttons ----------
    // The readout: where you are, the camera, the live counts, the imagery credit — four lines kept
    // in place and rewritten every frame (an empty line hides itself, styles.css: .readout span:empty).
    const readout = h('div.readout');
    const rLines = [h('span.r1'), h('span.r2'), h('span.r3'), h('span.r4')] as const;
    // line 1: the numbers, then the place in the accent (route C); one text node each, rewritten in place
    const r1n = document.createTextNode('');
    const r1p = h('b');
    rLines[0].append(r1n, r1p);
    readout.append(...rLines);
    /** The spot under the crosshair (named by the nearest city) for Street View and the live traffic map. */
    const centre = () => {
      const c = globe.cam;
      // Looking at the whole planet: the map opens at home rather than on whatever is under the crosshair.
      if (c.range > 2500) {
        const H = home();
        return { lat: H.lat, lon: H.lon, name: H.name, heading: 0 };
      }
      const g = c.pick(innerWidth / 2, innerHeight / 2) ?? { lat: c.lat, lon: c.lon };
      const near = World.near(g.lat, g.lon, 2e5);
      return { lat: g.lat, lon: g.lon, name: near && near.km < 400 ? near.city.name : undefined, heading: c.hd };
    };
    // ---------- the LOOK menu: how the globe is drawn (tiles, sensor looks, sun, spin) ----------
    const tileChips = h('div.chips');
    const paintTiles = () => {
      clear(
        tileChips,
        ...SOURCES.map((src) => {
          const b = button(src.name.toUpperCase(), () => {
            imagery.setSource(src.name);
            if (!globe.vis.imagery) globe.vis = { ...globe.vis, imagery: true };
            paintTiles();
          });
          b.dataset.src = src.name;
          b.classList.toggle('on', globe.vis.imagery && imagery.source === src.name);
          return b;
        }),
        (() => {
          const b = button('OFF', () => {
            globe.vis = { ...globe.vis, imagery: false };
            paintTiles();
          });
          b.dataset.src = 'off';
          b.classList.toggle('on', !globe.vis.imagery);
          return b;
        })(),
      );
    };
    paintTiles();
    const sunBtn = button('SUN', (b) => b.classList.toggle('on', (globe.sunLock = !globe.sunLock)));
    const spinBtn = button('SPIN', (b) => b.classList.toggle('on', (globe.cam.autoSpin = !globe.cam.autoSpin)));
    sunBtn.classList.toggle('on', globe.sunLock);
    const look = h(
      'div.lookmenu',
      { role: 'group', 'aria-label': 'How the globe looks' },
      h('div.lgroup', 'MAP TILES ON THE GLOBE'),
      tileChips,
      h('div.hint', 'Satellite photos, streets, a dark map, contours or Sentinel imagery drawn onto the globe — or off for the plain globe.'),
      h('div.lgroup', 'SENSOR'),
      modes,
      h('div.hint', 'A look for the whole view: hologram, old screen, night vision, thermal, film noir.'),
      h('div.lgroup', 'GLOBE'),
      h('div.chips', sunBtn, spinBtn),
      h('div.hint', 'SUN lights the globe as the real sun does right now. SPIN turns it slowly on its own.'),
    );
    look.hidden = true;
    const lookBtn = button('LOOK', () => {
      look.hidden = !look.hidden;
      lookBtn.classList.toggle('on', !look.hidden);
      if (!look.hidden) paintTiles();
    });
    const closeLook = () => {
      if (look.hidden) return;
      look.hidden = true;
      lookBtn.classList.remove('on');
    };
    addEventListener('keydown', (e) => e.key === 'Escape' && closeLook());

    // ---------- the bar: what to open about this spot, and how to move the view ----------
    const tiltBtn = button('TILT', () => (globe.cam.target.tilt = globe.cam.target.tilt > 5 ? 0 : 55));
    // Route C: THIS SPOT names the place under the crosshair, each button wears a glyph over its label.
    const spotName = h('em.bplace');
    const G: Record<string, string> = {
      MAP: '<path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z"/><path d="M8.5 4.5V17M15.5 7v12.5"/>',
      '3D': '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5"/>',
      'STREET VIEW': '<circle cx="12" cy="4.8" r="1.8"/><path d="M9.5 10.2a2.5 2.5 0 015 0V14h-1.3l-.7 6h-1l-.7-6H9.5z"/>',
      TRAFFIC: '<rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
      GO: '<circle cx="6.5" cy="6.5" r="2.2"/><circle cx="17.5" cy="17.5" r="2.2"/><path d="M8.7 6.5h7.3a3 3 0 010 6H8a3 3 0 000 6h7.3"/>',
      'ROAD AHEAD': '<path d="M12 3.5l7 16.5-7-4-7 4z"/>',
      LOOK: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
      HOME: '<path d="M4.5 11L12 4.5l7.5 6.5V19a1.5 1.5 0 01-1.5 1.5h-3.5V15h-5v5.5H6A1.5 1.5 0 014.5 19z"/>',
      NORTH: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5l2.6 7H9.4z"/><path d="M9.4 13.5L12 17.5l2.6-4" opacity=".5"/>',
      TILT: '<path d="M3.5 18.5h17L16 8H8z"/><path d="M9.5 13.5h5"/>',
    };
    const glyphed = (b: HTMLButtonElement) => {
      const t = (b.textContent ?? '').trim();
      if (!G[t]) return b;
      b.prepend(h('span.bic', icon(G[t]!)));
      b.dataset.label = t === '3D' ? '3D' : t === 'GO' ? 'Go' : t.charAt(0) + t.slice(1).toLowerCase().replace('view', 'View');
      return b;
    };
    const btns = h(
      'div.btns',
      h(
        'div.bgroup',
        h('small.bcap', h('span', 'THIS SPOT'), spotName),
        glyphed(button('MAP', () => openMapSheet('map', centre()))),
        glyphed(button('3D', () => openMapSheet('3d', centre()))),
        glyphed(button('STREET VIEW', () => void openStreetView(centre()))),
        glyphed(button('TRAFFIC', () => openMapSheet('traffic', centre()))),
        glyphed(button('GO', () => {
          // The journey planner; the spot under the crosshair is the destination when the view is close enough to mean one.
          const c = centre();
          const close = globe.cam.range <= 12;
          void import('../../ui/journeysheet').then((m) => m.openJourneyPlanner(close ? { to: `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`, toName: 'the spot under the crosshair' } : {}));
        })),
        glyphed(raBtn),
      ),
      h(
        'div.bgroup',
        h('small.bcap', 'VIEW'),
        glyphed(lookBtn),
        glyphed(button('HOME', () => {
          const L = home();
          globe.cam.flyTo({ lat: L.lat, lon: L.lon, range: 300, tilt: 0, hd: 0 });
        })),
        glyphed(button('NORTH', () => (globe.cam.target.hd = 0))),
        glyphed(tiltBtn),
      ),
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

    // ---------- route C: the layers button and three quick layers with their live counts ----------
    const LAYERS_GLYPH = '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12L12 16.5 20.5 12M3.5 16L12 20.5 20.5 16"/>';
    const layBtn = h('button.lchip.ico', { type: 'button', 'aria-label': 'All layers', 'aria-expanded': 'false', dataset: { case: 'keep' } }, icon(LAYERS_GLYPH));
    layBtn.addEventListener('click', () => {
      lay.el.classList.toggle('min');
      layBtn.setAttribute('aria-expanded', String(!lay.el.classList.contains('min')));
    });
    const QUICK: [keyof LayerVisibility, string, string, () => string, boolean][] = [
      ['air', 'Aircraft', '<path d="M12 3c.9 0 1.4.8 1.4 1.9v5.2l7.1 4.2v1.8l-7.1-2.1v4.4l2 1.6v1.5L12 20.6l-3.4.9V20l2-1.6V14l-7.1 2.1v-1.8l7.1-4.2V4.9C10.6 3.8 11.1 3 12 3z"/>', () => (air.list.size ? fmt.n(air.list.size) : ''), false],
      ['incidents', 'Incidents', '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.1"/>', () => (incidents.list.size ? fmt.n(incidents.list.size) : ''), true],
      ['radar', 'Radar', '<path d="M7 15.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 7.2 4.2 4.2 0 007 15.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>', () => '', false],
    ];
    const quick = QUICK.map(([k, label, glyph, count, warn]) => {
      const c = h('span.c');
      const b = h(`button.lchip${warn ? '.warn' : ''}` as 'button', { type: 'button', 'aria-pressed': 'false', dataset: { case: 'keep', layer: k } }, icon(glyph), h('span', label), c);
      // the same switch as the layer's tile in LAYERS (so both always agree)
      b.addEventListener('click', () => {
        tiles[tileFor.get(k)!]?.click();
        paintChips();
      });
      return { k, b, c, count };
    });
    const paintChips = () => {
      for (const x of quick) {
        const on = globe.vis[x.k];
        if (x.b.classList.contains('on') !== on) {
          x.b.classList.toggle('on', on);
          x.b.setAttribute('aria-pressed', String(on));
        }
        const n = on ? x.count() : '';
        if (x.c.textContent !== n) x.c.textContent = n;
      }
      layBtn.setAttribute('aria-expanded', String(!lay.el.classList.contains('min')));
    };
    const eyeChips = h('div.eyechips', layBtn, ...quick.map((x) => x.b));

    const labels = h('div.labels');
    const top = h('div.eyetop', h('div.search', q, button('GO', () => void search())), eyeChips);
    root.append(h('div.hud.eye', top, h('div.eyemid', labels, info.el, grid.el, ra.el, lay.el, rail), h('div.eyebot', look, readout, btns)));

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
      closeLook();
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
      if (hit) return select(hit);
      // Nothing there: drop a pin on the ground under the finger — the spot card opens on it.
      const g = globe.cam.pick(x, y);
      if (!g) return select(null);
      const near = World.near(g.lat, g.lon, 2e5);
      const sp: Spot = { lat: g.lat, lon: g.lon, name: near && near.km < 25 ? near.city.name : undefined };
      spotLayer.set(sp);
      select({ kind: 'spot', ref: sp, w: GEO.ecef(sp.lat, sp.lon, 0.06) });
      lookupSpot(sp);
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
          add(GEO.ecef(e.lat, e.lon, 0.03), e.kind === 'anpr' ? 'ANPR' : e.kind === 'mobile' ? 'VAN' : e.kind === 'variable' ? 'VAR' : e.maxspeed ? `${e.maxspeed.replace(/ mph/, '')}` : e.kind === 'redlight' ? 'RED LIGHT' : 'SPEED', e.kind === 'anpr' ? '#ff7ad9' : '#ffd84a');
          if (++n > 30) break;
        }
      }
      if (globe.vis.transit && alt < 60) {
        const now = Date.now();
        let n = 0;
        for (const v of transit.list.values()) {
          if (!v.line || v === transitLayer.selected) continue;
          add(transitLayer.world(v, now), v.line, v.kind === 'tram' ? '#9ef' : '#ffd27a');
          if (++n > 40) break;
        }
      }
      if (globe.vis.incidents && alt < 400) {
        let n = 0;
        for (const i of incidents.list.values()) {
          add(GEO.ecef(i.lat, i.lon, 0.05), `${i.road}${i.delayS >= 60 ? ` +${Math.round(i.delayS / 60)}m` : ''}`, severity(i) >= 2 ? '#ff6a6a' : '#ffc46a');
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
      const place = near && near.km < 400 ? near.city.name.toUpperCase() : '';
      const nums = `${g.lat.toFixed(3)}° ${g.lon.toFixed(3).replace('-', '−')}°  `;
      if (r1n.data !== nums) r1n.data = nums;
      if (r1p.textContent !== place) r1p.textContent = place;
      if (spotName.textContent !== (near && near.km < 400 ? near.city.name : '')) spotName.textContent = near && near.km < 400 ? near.city.name : '';
      paintChips();
      const lines = [
        '',
        `ALT ${mk(alt)} · TILT ${Math.round(c.tilt)}° · HDG ${Math.round(((c.hd % 360) + 360) % 360)}°${globe.mode ? ` · ${SENSOR_MODES[globe.mode]![0]}` : ''}`,
        `${air.list.size} AC · ${ships.list.size} SHIP · ${cams.list.length} CAM${transit.list.size ? ` · ${transit.list.size} BUS` : ''}${incidents.list.size ? ` · ${incidents.list.size} INC` : ''} · ${sats.list.length} SAT · ${quakes.data?.length ?? 0} EQ${radar.shownAt ? ` · RADAR ${fmt.ago(radar.shownAt)}` : ''}`,
        imagery.credit,
      ];
      rLines.forEach((el, i) => i && el.textContent !== lines[i] && (el.textContent = lines[i]!));
      tiltBtn.classList.toggle('on', c.tilt > 5);
      // Start a feed only once its layer is switched on (big downloads stay optional).
      const want: [keyof LayerVisibility, { start(): unknown }][] = [['radar', radarFrames], ['alerts', alerts], ['disasters', disasters], ['aurora', aurora], ['dispatch', dispatch], ['buoys', buoys], ['cables', cables]];
      for (const [k, f] of want) if (globe.vis[k]) f.start();
      zLabel.textContent = mk(c.range);
      LAYERS.forEach(([k, , f], i) => {
        counts[i]!.textContent = f();
        if (boxes[i]!.classList.contains('on') !== globe.vis[k]) {
          boxes[i]!.classList.toggle('on', globe.vis[k]);
          boxes[i]!.setAttribute('aria-pressed', String(globe.vis[k]));
        }
      });
      lay.setStatus(air.status, air.status === 'LIVE' ? 'ok' : air.status === 'STALE' ? 'mid' : 'off');
      paintModes();
      if (selected?.kind === 'air' || selected?.kind === 'ship' || selected?.kind === 'transit') paintInfo();
      if (ra.on) ra.paint();
      if (globe.vis.cams) {
        loadCameras();
        if (globe.cam.range < 2500 && inCalifornia(g.lat, g.lon)) loadCalifornia();
      }
      if (globe.vis.enforce && globe.cam.range < 400 && inWestMidlands(g.lat, g.lon)) void loadWmSafety();
      paintGrid();
    }, 1);

    return {
      enter() {
        // Live traffic tiles need the TomTom key in the brain (it may have been added since).
        void brain.trafficStatus().then((r) => (trafficState.ready = r.ready)).catch(() => undefined);
        quakes.start();
        events.start();
        launches.start();
        const tick = () => void air.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
        tick();
        airTimer = window.setInterval(tick, 8000);
        const shipTick = () => {
          if (globe.vis.ships) void ships.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
          if (globe.vis.transit) void transit.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
          // Motorway incidents: National Highways lists them by region; the West Midlands is the one Ghosty can place on the map.
          if (globe.vis.incidents && globe.cam.range < 600 && globe.cam.lat > 52.2 && globe.cam.lat < 52.8 && globe.cam.lon > -2.5 && globe.cam.lon < -1.2) void incidents.refresh('West Midlands');
          if (globe.vis.enforce) void enforce.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
          if (globe.vis.crime) void crime.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
        };
        shipTick();
        shipTimer = window.setInterval(shipTick, 8000);
        paintModes();
      },
      leave() {
        closeLook();
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
