/**
 * ROAD AHEAD: a panel on God's Eye for when the owner is on the move. Their phone's GPS drives
 * the globe (heading up, following them); the panel shows speed and heading, the nearest
 * motorway junction, and what lies in the cone ahead — live road incidents, safety-camera sites,
 * public motorway cameras to tap (opened only when tapped: the pictures are for private viewing,
 * never streamed as a driving service), and buses nearby. Nothing about the position leaves the
 * phone; the brain only ever knows the saved home.
 */
import { cams, nearestCameras, type Camera } from '../../data/cameras';
import { enforce, ENFORCE_LABEL, type EnforceCam } from '../../data/enforce';
import { delayWords, incidents, severity, type Incident } from '../../data/incidents';
import { cardinal, mph, roadAhead } from '../../data/roadahead';
import { transit } from '../../data/transit';
import { WM_JUNCTIONS } from '../../data/wm/junctions';
import { clear, fmt, h } from '../../core/dom';
import { globe } from '../../engine/globe';
import { button, panel, row, toast, type Panel } from '../../ui/components';

export interface RoadAheadDeps {
  /** Show a camera's live picture (the eye tab's camView), returned as an element to put in the panel. */
  cameraView(c: Camera): HTMLElement;
  /** Fly to and select something on the globe. */
  flyTo(lat: number, lon: number, rangeKm: number): void;
}

/** The nearest motorway junction within `km`, as "M6 J6 Spaghetti Junction". */
export function nearestJunction(lat: number, lon: number, km = 2.5): { road: string; ref: string; name: string; km: number } | null {
  let best: { road: string; ref: string; name: string; km: number } | null = null;
  for (const [road, js] of Object.entries(WM_JUNCTIONS)) {
    for (const [ref, [jlat, jlon, name]] of Object.entries(js)) {
      const d = hav(lat, lon, jlat, jlon);
      if (d <= km && (!best || d < best.km)) best = { road, ref, name, km: d };
    }
  }
  return best;
}

function hav(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export function createRoadAhead(deps: RoadAheadDeps): { el: HTMLElement; panel: Panel; start(): void; stop(): void; paint(): void; readonly on: boolean } {
  const p = panel('ROAD AHEAD', { grow: false, cls: 'roadahead' });
  p.el.hidden = true;
  let detached = false;
  let headingUp = true;
  let openCam: Camera | null = null;
  let camBox: HTMLElement | null = null;

  const follow = () => {
    if (!roadAhead.on || detached) return;
    globe.cam.follow = () => roadAhead.me;
  };
  const onChange = () => {
    const m = roadAhead.me;
    if (m && roadAhead.on && !detached) {
      follow();
      if (headingUp && m.heading != null && (m.speed ?? 0) > 1) globe.cam.target.hd = m.heading;
    }
    paint();
  };
  roadAhead.events.on('change', onChange); // for the panel's lifetime: the eye tab is mounted once

  const paint = () => {
    p.el.hidden = !roadAhead.on;
    if (!roadAhead.on) return;
    const m = roadAhead.me;
    // The globe forgot to follow (the owner panned): offer to re-centre instead of fighting them.
    if (m && !detached && globe.cam.follow === null && !globe.cam.fly) detached = true;
    clear(p.body);
    if (!m) {
      p.setStatus(roadAhead.error ? 'NO FIX' : 'WAITING FOR GPS', roadAhead.error ? 'off' : 'mid');
      p.body.append(h('div.note', roadAhead.error || 'Waiting for your position… allow location when the phone asks.'));
      p.body.append(h('div.row.wrap', button('STOP', stop)));
      return;
    }
    p.setStatus(`GPS ±${Math.round(m.accuracy)} m · ${fmt.ago(m.t)}`, m.accuracy > 100 ? 'mid' : 'ok');
    const hd = m.heading;
    p.body.append(h('div.big', mph(m.speed), h('small', hd == null ? 'STILL' : `${cardinal(hd)} ${Math.round(hd)}°`)));
    const j = nearestJunction(m.lat, m.lon, 3);
    if (j) p.body.append(row('NEAR', `${j.road} J${j.ref}${j.name ? ` ${j.name}` : ''}`, km(j.km)));
    // Ahead: incidents (15 km), safety sites (3 km), public cameras (8 km), buses (1 km).
    const inc = roadAhead.ahead(incidents.list.values(), 15, 70);
    p.body.append(h('div.lab', inc.length ? `${inc.length} ROAD REPORT${inc.length === 1 ? '' : 'S'} AHEAD` : 'ROAD REPORTS AHEAD: NONE'));
    for (const i of inc.slice(0, 4) as (Incident & { km: number })[]) {
      p.body.append(row(i.road, `${i.direction ? `${i.direction} · ` : ''}${i.reason || i.title}${i.delayS ? ` · ${delayWords(i.delayS)}` : ''}`, km(i.km), { wrap: true, sev: severity(i), onClick: () => deps.flyTo(i.lat, i.lon, 6) }));
    }
    const safe = roadAhead.ahead([...enforce.list.values()].filter((c) => c.kind !== 'cctv'), 3, 50);
    if (safe.length) {
      p.body.append(h('div.lab', `SAFETY CAMERAS AHEAD · ${safe.length}`));
      for (const c of safe.slice(0, 3) as (EnforceCam & { km: number })[]) p.body.append(row(c.kind === 'mobile' ? 'VAN SITE' : c.kind === 'average' ? 'AVERAGE' : c.kind === 'variable' ? 'VARIABLE' : c.kind.toUpperCase(), `${ENFORCE_LABEL[c.kind].toLowerCase()}${c.maxspeed ? ` · ${c.maxspeed}` : ''}`, km(c.km), { wrap: true }));
    }
    const cs = roadAhead.ahead(nearestCameras(m.lat, m.lon, 40, 8).filter((c) => c.src === 'National Highways'), 8, 60);
    if (cs.length) {
      p.body.append(h('div.lab', `MOTORWAY CAMERAS AHEAD · ${cs.length} (tap to view)`));
      const list = h('div.camlist');
      for (const c of cs.slice(0, 3) as (Camera & { km: number })[]) {
        const r = row(c.road ?? 'CAM', c.name.replace(/^[A-Z0-9()]+ /, ''), km(c.km), { onClick: () => showCam(c), wrap: true });
        list.append(r);
        if (openCam?.id === c.id && camBox) list.append(camBox);
      }
      p.body.append(list);
    }
    const buses = transit.near(m.lat, m.lon, 1).length;
    if (buses) p.body.append(row('BUSES & TRAMS', `${buses} within 1 km`));
    const acts = h('div.row.wrap');
    if (detached) acts.append(button('RE-CENTRE', () => { detached = false; globe.cam.flyTo({ lat: m.lat, lon: m.lon, range: 3, tilt: 55, hd: hd ?? globe.cam.hd }); setTimeout(follow, 2200); }, 'on'));
    acts.append(button(headingUp ? 'NORTH UP' : 'HEADING UP', () => { headingUp = !headingUp; if (!headingUp) globe.cam.target.hd = 0; paint(); }));
    acts.append(button('STOP', stop, 'warn'));
    p.body.append(acts, h('small.dim', 'Your position stays on this phone. Motorway pictures open only when you tap them.'));
  };

  const showCam = (c: Camera) => {
    if (openCam?.id === c.id) {
      openCam = null;
      camBox = null;
    } else {
      openCam = c;
      camBox = deps.cameraView(c);
    }
    paint();
  };

  const start = () => {
    if (!roadAhead.start()) {
      toast(roadAhead.error || 'No location service on this device', 'warn');
      return;
    }
    detached = false;
    globe.vis = { ...globe.vis, me: true, incidents: true, cams: true, enforce: true };
    const m = roadAhead.me;
    if (m) globe.cam.flyTo({ lat: m.lat, lon: m.lon, range: 3, tilt: 55, hd: m.heading ?? 0 });
    setTimeout(follow, 2200);
    paint();
  };
  const stop = () => {
    roadAhead.stop();
    globe.cam.follow = null;
    openCam = null;
    camBox = null;
    paint();
  };
  const el = p.el;
  return {
    el,
    panel: p,
    start,
    stop,
    paint,
    get on() {
      return roadAhead.on;
    },
  };
}

export { cams };
