/**
 * GOD'S EYE tab: the live globe. Search, sensor modes, layer toggles, target card,
 * floating labels, touch/mouse gestures, the zoom rail, and live public CCTV: tap a camera
 * to watch it, and while no card is open a grid shows the four cameras nearest the view.
 */
import { openSafe } from '../../core/safeurl';
import type { ScreenContext } from '../../../../../packages/shared/src/awareness';
import { brain } from '../../api/brain';
import { send } from '../../assistant/session';
import { flyTo } from '../../commands/builtin';
import { clear, fmt, h, icon } from '../../core/dom';
import { events, launches, quakes, type Launch, type NaturalEvent, type Quake } from '../../data/hazards';
import { GEO } from '../../engine/geo';
import { gfx } from '../../engine/gfx';

/** The crosshair: the centre of the globe's own picture (in The Scan the canvas ends where the house begins, so it is not the screen's centre). */
const crosshair = (): [number, number] => [gfx.cv.clientWidth / 2, gfx.cv.clientHeight / 2];
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
import { myPlaces } from './places';
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
import { machineState } from './machine';
import { createMachine } from './machineview';
import { fetchImage } from '../../api/feed';
import { waiting } from '../../ui/wait';
import { phrases } from '../lifeui';
import { cardWords, noCamerasWords, noFindWords, noSignalFindWords, CAM_DOWN, CAM_CONNECTING, CLIP_DOWN, STREAM_DOWN } from './words';

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
      // (his own position stays on the phone: the brain never gets live GPS, so neither ASK GHOSTY nor the screen's context carries it)
      return `the owner's own position (ROAD AHEAD; it stays on the phone, so no coordinates here)`;
    case 'crime': {
      const c = r as unknown as Crime;
      return `a reported crime (${crimeLabel(c.category).toLowerCase()}) on or near ${c.street || 'an unnamed street'} in ${c.month}${c.outcome ? `, outcome: ${c.outcome.toLowerCase()}` : ''} (police.uk open data)`;
    }
    default:
      return sel.kind;
  }
}

/** The sensor looks' names on screen (the engine and the brain keep the short ones: NVG, FLIR, CRT…). */
const LOOK_NAMES: Record<string, string> = { HOLO: 'HOLOGRAM', CRT: 'OLD SCREEN', NVG: 'NIGHT VISION', FLIR: 'THERMAL', NOIR: 'FILM NOIR' };
const lookName = (n: string) => LOOK_NAMES[n] ?? n;

export const eyeTab: TabDef = {
  id: 'eye',
  title: "GOD'S EYE",
  icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  scene: 'globe',
  blurb: 'live globe · aircraft · satellites · CCTV',
  now: () => (air.list.size || sats.list.length ? `${fmt.n(air.list.size)} aircraft · ${fmt.n(sats.list.length)} satellites` : ''),
  primary: true,
  mount(root) {
    globe.init();
    installLayers();
    let selected: Pickable | null = null;
    let airTimer = 0;
    let shipTimer = 0;
    let machine: ReturnType<typeof createMachine> | null = null;

    // ---------- top: search + sensor modes ----------
    const q = h('input', { placeholder: 'Search place, flight, ship, satellite…', autocomplete: 'off', enterKeyHint: 'search', 'aria-label': 'Search the globe' });
    // His saved places (places.ts): chips to fly to, and names the search knows ("home").
    const flyToPlace = (p: { lat: number; lon: number; label: string; address: string }) => {
      const sp: Spot = { lat: p.lat, lon: p.lon, name: p.label, address: p.address };
      spotLayer.set(sp);
      select({ kind: 'spot', ref: sp, w: GEO.ecef(sp.lat, sp.lon, 0.06) });
      globe.cam.flyTo({ lat: p.lat, lon: p.lon, range: 1.2, tilt: 45 });
    };
    const mine = myPlaces(flyToPlace);
    // what the search found, said under the box (a toast is gone before he has read what to try)
    const found = h('p.searchnote', { role: 'status', hidden: true, dataset: { case: 'keep' } });
    const sayFind = (words: string, kind: 'empty' | 'offline' | ''): void => {
      found.textContent = words;
      found.hidden = !words;
      if (kind) found.dataset.state = kind;
      else delete found.dataset.state;
    };
    q.addEventListener('input', () => sayFind('', ''));
    const search = async () => {
      const s = q.value.trim();
      sayFind('', '');
      if (!s) return;
      const saved = mine.find(s);
      if (saved) return flyToPlace(saved);
      const a = air.find(s);
      if (a) return select({ kind: 'air', ref: a, w: air.world(a, Date.now()) }, true);
      const sat = sats.list.find((x) => x.name.toLowerCase().includes(s.toLowerCase()));
      if (sat) return select({ kind: 'sat', ref: sat, w: sat.w }, true);
      const ship = ships.find(s);
      if (ship) return select({ kind: 'ship', ref: ship, w: shipLayer.world(ship, Date.now()) }, true);
      // Offline, a place that is not one of the globe's own cities cannot be looked up: say that, not "couldn't find".
      /* state: eye.search offline */
      if (!navigator.onLine && !World.find(s) && !(s.length <= 4 && World.findAirport(s))) return void sayFind(noSignalFindWords(s), 'offline');
      /* state: eye.search empty */
      if (!(await flyTo({ place: s, range_km: 300, quiet: true }))) sayFind(noFindWords(s), 'empty');
    };
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void search();
    });
    // Sensor looks (night vision, thermal…) are a look, not a tool: they live in the LOOK menu below, named in plain words.
    const modes = h('div.modes.chips', ...SENSOR_MODES.map(([n], i) => button(lookName(n), () => {
      globe.mode = i;
      ui.set({});
    })));
    const paintModes = () => [...modes.children].forEach((b, i) => b.classList.toggle('on', i === globe.mode));

    // ---------- layers ----------
    const lay = panel('WHAT TO SHOW', { grow: false });
    lay.el.classList.add('eyelay');
    /** A feed's state in plain words (SYNC, STALE, NO FEED and IDLE are the code's own). */
    const said = (st: string) => (st === 'SYNC' ? 'LOADING' : st === 'STALE' ? 'NOT UPDATING' : st === 'NO FEED' ? 'NOT REACHABLE' : st === 'IDLE' ? '' : st);
    const LAYERS: [keyof LayerVisibility, string, () => string][] = [
      ['imagery', 'MAP TILES', () => (imagery.credit ? `${imagery.source.toUpperCase()} Z${imagery.level}` : imagery.source.toUpperCase())],
      ['buildings', '3D BUILDINGS', () => (globe.cam.range > 6 ? 'ZOOM IN · <6 KM' : said(buildings.status) || (buildings.count ? fmt.n(buildings.count) : ''))],
      ['air', 'AIRCRAFT', () => (air.list.size ? `${fmt.n(air.list.size)}${air.status === 'STALE' ? ' · NOT UPDATING' : ''}` : said(air.status) || 'LOADING')],
      ['sats', 'SATELLITES', () => fmt.n(sats.list.length)],
      ['quakes', 'QUAKES', () => fmt.n(quakes.data?.length ?? 0)],
      ['events', 'EVENTS', () => fmt.n((events.data?.length ?? 0) + (launches.data?.length ?? 0))],
      ['enforce', 'ANPR / SPEED', () => {
        if (globe.cam.range > 250 && !enforce.list.size) return 'ZOOM IN';
        const c = enforce.counts();
        return enforce.status === 'SYNC' && !enforce.list.size ? 'LOADING' : `${c.anpr} ANPR · ${c.speed + c.average + c.redlight + c.buslane}`;
      }],
      ['crime', 'STREET CRIME', () => {
        if (!crime.list.size) return crime.status === 'SYNC' || crime.status === 'NO FEED' ? said(crime.status) : globe.cam.range > 45 ? 'ZOOM IN · UK' : 'UK ONLY';
        const c = crime.counts();
        return `${fmt.n(c.total)} · ${crime.month}`;
      }],
      ['ships', 'SHIPS (AIS)', () => {
        if (ships.list.size) return `${fmt.n(ships.list.size)}${ships.status === 'STALE' ? ' · NOT UPDATING' : ''}`;
        // nothing asked for out here (no free AIS key, outside the Baltic, zoomed out), the key missing, or nothing in view
        return ships.status === 'IDLE' ? 'ZOOM IN' : /AISstream key/.test(ships.note) ? 'NEEDS FREE KEY' : ships.status === 'NO FEED' ? 'NONE FOUND' : '0';
      }],
      ['transit', 'BUSES & TRAMS', () => {
        if (!transit.list.size) return transit.status === 'SYNC' || transit.status === 'NO FEED' ? said(transit.status) : globe.cam.range > 120 ? 'ZOOM IN' : '';
        const c = transit.counts();
        return `${c.bus} BUS · ${c.tram} TRAM`;
      }],
      ['incidents', 'ROAD INCIDENTS', () => (incidents.list.size ? fmt.n(incidents.list.size) : incidents.status === 'SYNC' || incidents.status === 'NO FEED' ? said(incidents.status) : 'MOTORWAYS')],
      ['traffic', 'LIVE TRAFFIC', () => (trafficState.ready ? 'TOMTOM' : 'NEEDS FREE KEY')],
      ['radar', 'RAIN RADAR', () => (radarFrames.data ? fmt.ago(radarFrames.data.time) : said(radarFrames.status))],
      ['alerts', 'WEATHER ALERTS', () => (alerts.data ? fmt.n(alerts.data.length) : said(alerts.status))],
      ['disasters', 'DISASTERS', () => (disasters.data ? fmt.n(disasters.data.length) : said(disasters.status))],
      ['aurora', 'AURORA', () => (aurora.data ? `${Math.max(0, ...aurora.data.cells.map((c) => c[2]))}%` : said(aurora.status))],
      ['dispatch', '911 SEATTLE', () => (dispatch.data ? fmt.n(dispatch.data.length) : said(dispatch.status))],
      ['buoys', 'OCEAN BUOYS', () => (buoys.data ? String(buoys.data.length) : '')],
      ['cables', 'UNDERSEA CABLES', () => (cables.data ? String(cables.data.length) : '')],
      ['cams', 'CCTV CAMERAS', () => (cams.status === 'SYNC' && !cams.list.length ? 'LOADING' : fmt.n(cams.list.length))],
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
    // His layer choices are kept on this phone (only the switches in LAYERS; nothing else): Radar turned off stays off.
    const LAYER_KEY = 'ghosty.eye.layers';
    try {
      const kept = JSON.parse(localStorage.getItem(LAYER_KEY) ?? 'null') as Record<string, unknown> | null;
      if (kept) {
        const vis = { ...globe.vis };
        for (const [k] of LAYERS) {
          const v = kept[k];
          if (typeof v === 'boolean') vis[k] = v;
        }
        globe.vis = vis;
        sats.showOrbit = vis.orbits;
      }
    } catch {
      /* private browsing or a bad value: the defaults */
    }
    const layerJson = () => JSON.stringify(Object.fromEntries(LAYERS.map(([k]) => [k, globe.vis[k]])));
    let keptVis = layerJson();
    const keepLayers = () => {
      // (the Machine view's own layers are its own: what he chose is kept, and put back when it ends)
      if (machineState.on) return;
      const now = layerJson();
      if (now === keptVis) return;
      keptVis = now;
      try {
        localStorage.setItem(LAYER_KEY, now);
      } catch {
        /* not kept: nothing else changes */
      }
    };
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
        keepLayers();
        // Switched on with nothing to draw: say what it needs and what works without it.
        if (k === 'traffic' && globe.vis.traffic && !trafficState.ready) toast('Live traffic on the globe needs the free TomTom key: SYSTEM → KEYS → TomTom traffic. Without it, TRAFFIC under THIS SPOT opens the Waze live map.', 'warn');
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
          // the spot to send on: the phone's own share sheet (a message, a note), else copied; a public map link, nothing else
          button('SHARE', () => {
            const url = `https://www.openstreetmap.org/?mlat=${sp.lat.toFixed(5)}&mlon=${sp.lon.toFixed(5)}#map=17/${sp.lat.toFixed(5)}/${sp.lon.toFixed(5)}`;
            const text = `${sp.name ? `${sp.name}: ` : ''}${sp.lat.toFixed(5)}, ${sp.lon.toFixed(5)}`;
            if (navigator.share) return void navigator.share({ title: sp.name || 'A spot', text, url }).catch(() => undefined);
            void navigator.clipboard?.writeText(`${text} ${url}`).then(() => toast('Copied: the spot and its map link.', 'ok'), () => toast('I couldn’t copy it on this phone.', 'warn'));
          }),
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
        R('ALT', a.gnd ? 'ON GROUND' : cardWords.altitude(a.altft), a.gnd ? 'from the feed' : cardWords.altitudeNote);
        R('SPEED', cardWords.knots(a.gs), `${Math.round(a.gs * 1.852)} km/h`);
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
        R('ALT', `${Math.round(ll.alt)} km`, 'worked out from its orbit');
        R('SPEED', `${v.toFixed(2)} km/s`, 'worked out from its orbit');
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
        actions.append(button('USGS ↗', () => openSafe(qk.url)));
      } else if (s.kind === 'event') {
        const e = s.ref as NaturalEvent;
        info.title.textContent = e.catName.toUpperCase();
        info.setStatus(fmt.ago(e.t), 'mid');
        R('EVENT', e.title);
        if (e.url) actions.append(button('SOURCE ↗', () => openSafe(e.url)));
      } else if (s.kind === 'launch') {
        const l = s.ref as Launch;
        info.title.textContent = 'LAUNCH';
        info.setStatus(l.status, 'mid');
        R('MISSION', l.name);
        R('PROVIDER', l.provider);
        R('PAD', l.pad);
        R('STARTS IN', cardWords.hours(l.net - Date.now()), 'from the launch schedule');
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
        R('SPEED', cardWords.knots(v.sog, 1), `${(v.sog * 1.852).toFixed(0)} km/h`);
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
        if (d.url) actions.append(button('GDACS ↗', () => openSafe(d.url)));
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
          sp.address = [whatIs(r), r.display_name].filter(Boolean).join(' — ') || 'I don’t know an address for this spot.';
          if (!sp.name && r.name) sp.name = r.name;
        })
        .catch(() => {
          sp.address = 'I can’t look up an address without a signal.';
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
      // one corner, one thing: the newest wins. A card opening folds the layers sheet and closes the LOOK menu (each comes back at a tap)
      if (p) {
        closeLook();
        if (!lay.el.classList.contains('min')) lay.el.classList.add('min');
      }
      paintInfo();
      paintGrid();
      measureSky();
      requestAnimationFrame(() => reach());
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
      /* state: eye.cam loading */
      const stamp = h('small.camstamp', { dataset: { state: 'loading', case: 'keep' } }, CAM_CONNECTING);
      // the card's way out of a picture that will not come: the next camera along (the grid's tiles are taps of their own)
      const another = button('TRY ANOTHER', () => {
        const next = nearestCameras(c.lat, c.lon, 12, 50).filter((x) => x.id !== c.id)[0];
        if (next) select({ kind: 'cam', ref: next, w: GEO.ecef(next.lat, next.lon, 0.08) }, true);
        else toast('No other camera nearby', 'warn');
      }, 'on');
      another.hidden = true;
      another.dataset.act = 'another';
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
          delete stamp.dataset.state;
          another.hidden = true;
          box.classList.remove('dead');
        } catch (e) {
          /* state: eye.cam error */
          stamp.textContent = CAM_DOWN;
          stamp.dataset.state = 'error';
          another.hidden = false;
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
            vid.addEventListener('error', () => {
              stamp.textContent = CLIP_DOWN;
              stamp.dataset.state = 'error';
              another.hidden = false;
            });
            box.replaceChildren(vid, stamp, h('i.camrec'));
          }));
        }
        if (c.hls && document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
          actions.append(button('▶ LIVE VIDEO', () => {
            const vid = h('video', { src: c.hls, autoplay: true, muted: true, playsInline: true, controls: true });
            vid.addEventListener('error', () => {
              stamp.textContent = STREAM_DOWN;
              stamp.dataset.state = 'error';
              another.hidden = false;
            });
            box.replaceChildren(vid, stamp, h('i.camrec'));
          }));
        }
        actions.append(another);
        return h('div', box, actions);
      }
      return box;
    }

    // ---------- CCTV grid: the four cameras nearest the view ----------
    const grid = panel('CCTV · NEAREST', { grow: false });
    grid.el.classList.add('camgrid');
    grid.el.hidden = true;
    let gridKey = '';
    let gridMax = 4;
    let gridRoom = 0;
    const paintGrid = () => {
      // where the view is going (not where a fly-to animation happens to be right now)
      const T = globe.cam.target;
      // Only while no card is open: on a phone the grid and a card share the same corner (the card's ASK GHOSTY and ✕ went under it).
      const show = globe.vis.cams && T.range < 1500 && cams.list.length > 0 && !selected;
      // as many as the band holds: four, else one row of two, else none (the cameras stay on the globe as dots)
      const near = show && gridMax ? nearestCameras(T.lat, T.lon, gridMax, Math.max(30, T.range)) : [];
      // cameras on, close enough to look, and none near: one line instead of nothing (the panel is there only while that is so)
      const none = show && gridMax > 0 && !near.length;
      grid.el.hidden = !near.length && !none;
      const key = none ? 'none' : `${gridMax}:${near.map((c) => c.id).join()}`;
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
      if (none) {
        /* state: eye.cams empty */
        grid.setStatus('NONE NEAR', 'mid');
        grid.body.append(h('p.note.camnone', { dataset: { state: 'empty', case: 'keep' } }, noCamerasWords));
        return;
      }
      grid.setStatus(near.length ? `${near[0]!.src.toUpperCase()} · ${near.length} LIVE` : '', 'ok');
      for (const c of near) {
        const tile = camView(c, false);
        tile.title = c.name;
        tile.append(h('span.camname', c.name));
        tile.addEventListener('click', () => select({ kind: 'cam', ref: c, w: GEO.ecef(c.lat, c.lon, 0.08) }, true));
        grid.body.append(tile);
      }
      // measured: taller than the room between the chips and the readout, it gives up a row (and the next band change tries four again)
      const room = mid.getBoundingClientRect().height - band.top;
      if (room > 0 && grid.el.getBoundingClientRect().height > room + 1 && gridMax > 0) {
        gridMax = gridMax > 2 ? 2 : 0;
        gridKey = '';
        paintGrid();
      }
    };
    camEvents.on('change', () => {
      gridKey = '';
    });
    // ---------- ROAD AHEAD: follow the phone, what lies ahead ----------
    const ra = createRoadAhead({
      cameraView: (c) => camView(c, false),
      flyTo: (lat, lon, rangeKm) => globe.cam.flyTo({ lat, lon, range: rangeKm, tilt: 50 }),
      search: () => q.focus(),
    });
    startRoadAhead = () => {
      machine?.leave();
      // (the newest wins: ROAD AHEAD has the corner a card would share, so an open card closes; a tap on the globe brings one back)
      if (selected) select(null);
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
      const g = c.pick(...crosshair()) ?? { lat: c.lat, lon: c.lon };
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
      h('div.lgroup', 'HOW IT SEES'),
      modes,
      h('div.hint', 'How the whole view is drawn, from the normal globe to night vision and thermal.'),
      h('div.lgroup', 'GLOBE'),
      h('div.chips', sunBtn, spinBtn),
      h('div.hint', 'SUN lights the globe as the real sun does right now. SPIN turns it slowly on its own.'),
    );
    look.hidden = true;
    const lookBtn = button('LOOK', () => {
      look.hidden = !look.hidden;
      lookBtn.classList.toggle('on', !look.hidden);
      if (!look.hidden) {
        paintTiles();
        // it grows upwards from the bar: never past the search bar (with Safari's bars it ran off the top), it scrolls
        const under = root.querySelector('.eyetop')?.getBoundingClientRect().bottom ?? 0;
        look.style.maxHeight = `${Math.max(96, Math.floor(look.getBoundingClientRect().bottom - under - 8))}px`;
      }
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
    // held, it zooms smoothly; a tap (or VoiceOver's activate, or a key) is one step in or out
    let hold = 0;
    let pressedAt = 0;
    const step = (dir: -1 | 1) => () => {
      if (pressedAt && performance.now() - pressedAt > 300) return;
      globe.cam.zoom(dir < 0 ? 0.6 : 1.67, ...crosshair());
    };
    const zIn = button('+', step(-1));
    const zOut = button('−', step(1));
    zIn.setAttribute('aria-label', 'Zoom in');
    zOut.setAttribute('aria-label', 'Zoom out');
    for (const [b, dir] of [[zIn, -1], [zOut, 1]] as const) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold = dir;
        pressedAt = performance.now();
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => (hold = 0));
      b.addEventListener('click', () => (pressedAt = 0));
    }
    const zLabel = h('small');
    const rail = h('div.zoomrail', zIn, zLabel, zOut);

    // ---------- route C: the layers button and three quick layers with their live counts ----------
    const LAYERS_GLYPH = '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12L12 16.5 20.5 12M3.5 16L12 20.5 20.5 16"/>';
    const layBtn = h('button.lchip.ico', { type: 'button', 'aria-label': 'Everything I can show', 'aria-expanded': 'false', dataset: { case: 'keep' } }, icon(LAYERS_GLYPH));
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
    // the words that open this screen from the chat, in one line (they are the chat's own, answered on the phone)
    lay.body.append(phrases(['machine view', 'what are you watching?']));
    const eyeChips = h('div.eyechips', layBtn, ...quick.map((x) => x.b));

    const labels = h('div.labels');
    const top = h('div.eyetop', h('div.search', q, button('GO', () => void search())), found, eyeChips, mine.el);
    const bot = h('div.eyebot', look, readout, btns);
    const mid = h('div.eyemid', labels, info.el, grid.el, ra.el, lay.el, rail);
    const hud = h('div.hud.eye', top, mid, bot);
    root.append(hud);
    // a tapped thing's card may lie over the top of the sheet below it (styles.css, the house): never over the sheet's keys, so LEAVE
    // MACHINE VIEW and the rest stay pressable under it. Its reach is the gap down to the keys' top, measured as the screen's parts change size
    // THE BAND (lane SEE, 13 Nov): every floating thing over the globe (the card, the CCTV grid, the layers sheet, ROAD AHEAD, the zoom
    // rail) lives in one measured band: from the foot of whatever the top shows (the search, its note, the chips, his places) down to
    // the top of the sheet's keys (or the Machine view's line over them). Measured as the house measures, never a fixed offset, so
    // nothing lies over the chips or the keys in any look, with the house on or off, at 440 or 390.
    const band = { top: 0, bottom: 0 };
    const seen = (e: Element | null): e is HTMLElement => !!e && e instanceof HTMLElement && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const reach = () => {
      const m = mid.getBoundingClientRect();
      const k = btns.getBoundingClientRect();
      if (!m.height || !k.height) return;
      let foot = m.top;
      for (const e of top.querySelectorAll(':scope > *, :scope .eyechips > .lchip:not(.ico)')) if (seen(e)) foot = Math.max(foot, e.getBoundingClientRect().bottom);
      let floor = k.top;
      const mv = bot.querySelector('.mchview');
      if (seen(mv)) floor = Math.min(floor, mv.getBoundingClientRect().top);
      band.top = Math.max(0, Math.ceil(foot - m.top + 4));
      band.bottom = Math.max(band.top + 44, Math.floor(floor - m.top - 8));
      const hs = hud.style;
      const set = (n: string, v: number) => hs.getPropertyValue(n) !== `${v}px` && hs.setProperty(n, `${v}px`);
      set('--eye-band-top', band.top);
      set('--eye-band-h', band.bottom - band.top);
      set('--eye-grid-h', Math.max(0, Math.round(m.height) - band.top));
      set('--eye-reach', Math.max(0, band.bottom - band.top));
      // the room for the grid changed: it tries four again (and steps down, measured, if they do not fit)
      const room = Math.round(m.height) - band.top;
      if (Math.abs(room - gridRoom) > 2) {
        gridRoom = room;
        gridMax = 4;
        gridKey = '';
      }
      fitAfter();
    };
    /** After the band: the card may reach past the readout down to the keys; then the readout steps aside (it never shows through it). */
    const fitAfter = () => {
      const r = readout.getBoundingClientRect();
      const covered = r.height > 0 && [info.el, lay.el].some((i) => seen(i) && !i.classList.contains('min') && i.getBoundingClientRect().bottom > r.top + 1);
      if (hud.classList.contains('eyecovered') !== covered) hud.classList.toggle('eyecovered', covered);
    };
    const reachObs = new ResizeObserver(reach);
    for (const n of [mid, bot, btns, top, info.el, lay.el]) reachObs.observe(n);
    // THE MACHINE VIEW (machineview.ts): a mode of this globe — his city, everything moving, his things lit, the true count.
    // Its button comes first in the bar.
    machine = createMachine({ mid, top, bot, hud, places: () => mine.list(), refreshPlaces: () => mine.refresh(), select: (p) => select(p), active: () => ui.get().tab === 'eye' });
    btns.prepend(machine.button);

    // ---------- gestures on the 3D canvas ----------
    const cv = gfx.cv;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; a: number; my: number } | null = null;
    let moved = 0;
    let t0 = 0;
    let lastTap = 0;
    const vel = { x: 0, y: 0 };
    const active = () => ui.get().tab === 'eye';
    let drawing: (() => void) | null = null;
    let drewOnce = false;
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

    // ---------- the readout's live counts, in words ----------
    /** "2,117 planes · 4,433 cameras · 867 satellites · 68 quakes · rain radar 2m ago"; nothing said of what is not there; offline, said so. */
    const counted = () => {
      const n = (x: number, one: string, many: string) => (x > 0 ? `${fmt.n(x)} ${x === 1 ? one : many}` : '');
      const line = [
        n(air.list.size, 'plane', 'planes'),
        n(ships.list.size, 'ship', 'ships'),
        n(cams.list.length, 'camera', 'cameras'),
        n(transit.list.size, 'bus or tram', 'buses and trams'),
        n(incidents.list.size, 'road incident', 'road incidents'),
        n(sats.list.length, 'satellite', 'satellites'),
        n(quakes.data?.length ?? 0, 'quake', 'quakes'),
        radar.shownAt ? `rain radar ${fmt.ago(radar.shownAt)}` : '',
      ].filter(Boolean).join(' · ');
      return navigator.onLine ? line : `Offline · last seen: ${line || 'nothing yet'}`;
    };

    // ---------- per-frame + periodic UI ----------
    const pool: HTMLElement[] = [];
    // Names only where the globe is open to view: below the search and its chips, above the bar (the tab bar is
    // under it), and off any card or menu that is open — never drawn through the glass. Measured once a second
    // (the slow loop below), not with every label paint.
    let sky = { top: 0, bottom: innerHeight, covers: [] as DOMRect[] };
    const measureSky = () => {
      sky = {
        top: top.getBoundingClientRect().bottom,
        bottom: bot.getBoundingClientRect().top,
        covers: [info.el, grid.el, ra.el, lay.el, look, rail].filter((el) => !el.hidden && el.offsetParent).map((el) => el.getBoundingClientRect()),
      };
    };
    const paintLabels = () => {
      const c = globe.cam;
      const cs = c.cs;
      if (!cs) return;
      const items: [number, number, string, string][] = [];
      const { top: skyTop, bottom: skyBottom, covers } = sky;
      const add = (w: [number, number, number], txt: string, col: string) => {
        const p = c.project(w);
        if (!p || !c.visible(w) || p[0] < -20 || p[0] > innerWidth + 20 || p[1] < skyTop || p[1] > skyBottom) return;
        if (covers.some((r) => p[0] >= r.left - 4 && p[0] <= r.right + 4 && p[1] >= r.top - 4 && p[1] <= r.bottom + 4)) return;
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
        const [cx, cy] = crosshair();
        const near = [...air.list.values()]
          .map((a) => ({ a, w: air.world(a, now) }))
          .map((o) => ({ ...o, p: c.project(o.w) }))
          .filter((o) => o.p)
          .sort((u, v) => Math.hypot(u.p![0] - cx, u.p![1] - cy) - Math.hypot(v.p![0] - cx, v.p![1] - cy))
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
      // the globe has drawn: the first-draw line goes
      if (drawing) {
        drawing();
        drawing = null;
      }
      if (hold) globe.cam.zoom(Math.exp(hold * 1.7 * dt), ...crosshair());
      if (!globe.cam.dragging && (Math.abs(vel.x) > 0.05 || Math.abs(vel.y) > 0.05) && !globe.cam.fly) {
        pan(vel.x, vel.y);
        vel.x *= 0.92;
        vel.y *= 0.92;
      }
      if (!globe.cam.fly && !globe.cam.dragging && !machineState.on) {
        const want = globe.cam.target.range < 3200 ? clamp((3200 - globe.cam.target.range) / 3200, 0, 1) * 58 : 0;
        if (globe.cam.target.tilt < want) globe.cam.target.tilt += (want - globe.cam.target.tilt) * Math.min(1, dt * 1.2);
      }
    });
    onFrame(() => active() && paintLabels(), 0.1);
    onFrame(() => {
      if (!active()) return;
      const c = globe.cam;
      const g = c.pick(...crosshair()) ?? { lat: c.lat, lon: c.lon };
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
        `ALT ${mk(alt)} · TILT ${Math.round(c.tilt)}° · HDG ${Math.round(((c.hd % 360) + 360) % 360)}°${globe.mode ? ` · ${lookName(SENSOR_MODES[globe.mode]![0])}` : ''}`,
        counted(),
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
      keepLayers();
      // the sheet's own line: how many layers are on (it used to be the aircraft feed's state alone)
      lay.setStatus(`${LAYERS.filter(([k]) => globe.vis[k]).length} ON`, 'ok');
      paintModes();
      if (selected?.kind === 'air' || selected?.kind === 'ship' || selected?.kind === 'transit') paintInfo();
      if (ra.on) ra.paint();
      // (the bar's ROAD AHEAD is lit only while it runs: the panel's own STOP, or no position, puts it out)
      if (raBtn.classList.contains('on') !== ra.on) raBtn.classList.toggle('on', ra.on);
      if (globe.vis.cams) {
        loadCameras();
        if (globe.cam.range < 2500 && inCalifornia(g.lat, g.lon)) loadCalifornia();
      }
      if (globe.vis.enforce && globe.cam.range < 400 && inWestMidlands(g.lat, g.lon)) void loadWmSafety();
      paintGrid();
      measureSky();
    }, 1);

    return {
      enter() {
        // the first draw of the globe can take a moment on a phone: said once, where it happens, gone with the first frame
        if (!drewOnce) {
          drewOnce = true;
          /* state: eye.globe loading */
          drawing = waiting(mid, 'Drawing the world…', { as: 'tag' });
        }
        void mine.refresh();
        // (what the Machine view shows, for the specs: window.__ghosty.machine, as the Brief and the Lens do)
        const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
        if (g) g.machine = machineState;
        // (and the chat's own way in, with the globe still open, as the Lens gives it: what he types or says in the chat)
        if (g && !g.send) g.send = (t: string, voice = false) => send(t, { voice });
        // Live traffic tiles need the TomTom key in the brain (it may have been added since).
        void brain.trafficStatus().then((r) => (trafficState.ready = r.ready)).catch(() => undefined);
        quakes.start();
        events.start();
        launches.start();
        // (while the Machine view is on it asks the feeds about the frame itself: one poller)
        // while ROAD AHEAD follows the phone the view's centre is where he is: the feeds are asked about the square around it (0.02°,
        // about two kilometres), never the point (the brain never gets live GPS)
        const at = (): [number, number] => (roadAhead.on ? [Math.round(globe.cam.lat * 50) / 50, Math.round(globe.cam.lon * 50) / 50] : [globe.cam.lat, globe.cam.lon]);
        const tick = () => void (machineState.on || air.refresh(...at(), globe.cam.range));
        tick();
        airTimer = window.setInterval(tick, 8000);
        const shipTick = () => {
          if (machineState.on) return;
          if (globe.vis.ships) void ships.refresh(...at(), globe.cam.range);
          if (globe.vis.transit) void transit.refresh(...at(), globe.cam.range);
          // Motorway incidents: National Highways lists them by region; the West Midlands is the one Ghosty can place on the map.
          if (globe.vis.incidents && globe.cam.range < 600 && globe.cam.lat > 52.2 && globe.cam.lat < 52.8 && globe.cam.lon > -2.5 && globe.cam.lon < -1.2) void incidents.refresh('West Midlands');
          if (globe.vis.enforce) void enforce.refresh(...at(), globe.cam.range);
          if (globe.vis.crime) void crime.refresh(...at(), globe.cam.range);
        };
        shipTick();
        shipTimer = window.setInterval(shipTick, 8000);
        paintModes();
      },
      leave() {
        machine?.leave(true);
        keepLayers();
        closeLook();
        clearInterval(airTimer);
        clearInterval(shipTimer);
        stopCamViews();
        gridKey = '';
        clear(grid.body);
      },
      open(arg: string) {
        if (arg === 'machine') void machine?.enter();
      },
      describe: () => `${machine?.describe() ? `${machine.describe()} ` : ''}${cams.list.length ? `${cams.list.length} public cameras on the globe (${[...cams.sources].join(', ')}). ` : ''}God's Eye globe ${roadAhead.on ? 'following the phone (ROAD AHEAD; where he is stays on the phone)' : `at ${globe.cam.lat.toFixed(2)}, ${globe.cam.lon.toFixed(2)}`}, ${Math.round(globe.cam.range)} km range, sensor ${SENSOR_MODES[globe.mode]![0]}${selected ? `, selected ${describe(selected)}` : ''}. ${air.list.size} aircraft, ${ships.list.size} ships, ${disasters.data?.length ?? 0} GDACS disasters, ${alerts.data?.length ?? 0} US weather alerts loaded.`,
      // what is open and picked (BRIEF-AWARENESS): the globe or the machine view, and the thing he tapped, said as describe() says it
      context: (): ScreenContext => {
        const said = selected ? describe(selected) : '';
        return {
          screen: 'eye',
          title: 'God’s Eye',
          line: machine?.describe() ? `God’s Eye in the machine view, ${air.list.size} aircraft, ${ships.list.size} ships` : `God’s Eye, the globe ${Math.round(globe.cam.range)} km up, ${air.list.size} aircraft, ${ships.list.size} ships`,
          ...(selected ? { selected: { kind: 'thing', id: selected.kind, label: said.slice(0, 60), ...(said.length > 60 ? { detail: said.slice(60, 140) } : {}) } } : {}),
          at: Date.now(),
        };
      },
    };
  },
};
