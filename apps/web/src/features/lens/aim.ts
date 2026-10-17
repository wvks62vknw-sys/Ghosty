/**
 * AIM: point the phone at anything. The camera, the compass and GPS together put labels over
 * what is out there — aircraft overhead, ships, buses and trams, hilltops, towers and other
 * places, the space station — each with its distance and height, a compass ribbon along the top
 * and the horizon across the picture. Tap a label for its card (a place's card has a few lines
 * from Wikipedia); WHAT'S THAT? asks Ghosty about the thing nearest the cross in the middle,
 * sending what the phone knows about it as `seen` (data, never the owner's words).
 *
 * Sensors open from the owner's own tap (iPhones ask for motion access then). With no compass
 * (a laptop) AIM pans by dragging the picture or with a heading slider instead. ALIGN fixes the
 * compass: tap a marker for something you can see for real, put the cross on it, press ALIGN.
 * All data comes through the brain: aircraft (adsb.lol, airplanes.live) through its proxy,
 * ships and transport from the globe's routes, places and the station from /api/aim/*.
 */
import { fetchJson } from '../../api/feed';
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { onFrame } from '../../engine/scheduler';
import { createStore } from '../../core/store';
import { home } from '../../state/app';
import { button, toast } from '../../ui/components';
import { askWithImage } from '../../vision/ask';
import { compassPoint, declutter, distanceText, focalFor, groundDistance, headingOf, horizonLine, poseFrom, poseFromOrientation, project, rotatePose, turn, wrap360, type Pose, type Projected, type Viewport } from '../../aim/project';
import { AIM_KINDS, KIND_GLYPH, KIND_LABEL, describeTarget, issFrom, labelLine, locate, placesFrom, planesFrom, shipsFrom, transitFrom, type AimKind, type Seen, type Target } from '../../aim/targets';
import type { LensContext, Mode } from './index';

/** Saved on this phone: the compass correction, which kinds show, the manual heading. */
const prefs = createStore(
  { offset: 0, kinds: { plane: true, ship: true, transit: true, place: true, space: true } as Record<AimKind, boolean>, heading: 0, pitch: 5 },
  { persist: 'ghosty.aim' },
);

const COLORS: Record<AimKind, string> = { plane: '#62e4ff', ship: '#6fa8ff', transit: '#ffb23e', place: '#4fe3a8', space: '#e7a6ff' };
/** How often each feed is asked again (ms); places when the owner has moved a kilometre. */
const EVERY: Record<AimKind, number> = { plane: 10_000, ship: 30_000, transit: 30_000, place: 10 * 60_000, space: 10_000 };
const MAX_LABELS = 25;
const MAX_ARROWS = 8;

/** What AIM is doing, readable by a test at window.__ghosty.aim. */
export interface AimState {
  sensors: 'off' | 'waiting' | 'compass' | 'relative' | 'manual';
  heading: number;
  pitch: number;
  offset: number;
  pos: { lat: number; lon: number; alt: number; from: 'gps' | 'home' } | null;
  counts: Record<AimKind, number>;
  feeds: Record<AimKind, string>;
  markers: { id: string; kind: AimKind; title: string; x: number; y: number; on: boolean; angle: number; labelled: boolean }[];
  aimed: string;
  selected: string;
  reply: string;
}

export const aimState: AimState = {
  sensors: 'off',
  heading: 0,
  pitch: 0,
  offset: 0,
  pos: null,
  counts: { plane: 0, ship: 0, transit: 0, place: 0, space: 0 },
  feeds: { plane: '', ship: '', transit: '', place: '', space: '' },
  markers: [],
  aimed: '',
  selected: '',
  reply: '',
};

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.aim = aimState;
}

type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number };

export function createAimMode(L: LensContext): Mode {
  const S = L.state;
  const A = aimState;
  const targets: Record<AimKind, Target[]> = { plane: [], ship: [], transit: [], place: [], space: [] };
  let seen: Seen[] = [];
  let seenDirty = true;
  let sensorPose: Pose | null = null;
  let lastAbsoluteAt = 0;
  let lastEventAt = 0;
  let watchId = -1;
  let stopFrame: (() => void) | null = null;
  let timer = 0;
  let waitTimer = 0;
  const lastFetch: Record<AimKind, number> = { plane: 0, ship: 0, transit: 0, place: 0, space: 0 };
  const busy: Record<AimKind, boolean> = { plane: false, ship: false, transit: false, place: false, space: false };
  let placesAt: { lat: number; lon: number } | null = null;
  let drawn: { t: Seen; p: Projected; box?: { x: number; y: number; w: number; h: number } }[] = [];
  let entered = false;

  // ---- the panel
  const startBtn = button('START AIM', () => startSensors(true), 'on');
  const alignBtn = button('ALIGN', () => align());
  const resetBtn = button('RESET ALIGN', () => {
    prefs.set({ offset: 0 });
    A.offset = 0;
    resetBtn.hidden = true;
    toast('Compass correction cleared', 'ok');
  });
  resetBtn.hidden = !prefs.get().offset;
  const whatBtn = button("WHAT'S THAT?", () => void whatsThat(), 'warn');
  const chipBtns = new Map<AimKind, HTMLButtonElement>();
  const chips = h('div.lenschips.aimchips');
  for (const k of AIM_KINDS) {
    const b = button(KIND_LABEL[k], () => {
      const kinds = { ...prefs.get().kinds, [k]: !prefs.get().kinds[k] };
      prefs.set({ kinds });
      b.classList.toggle('on', kinds[k]);
      seenDirty = true;
      if (kinds[k]) void refresh(k, true);
    });
    b.classList.toggle('on', prefs.get().kinds[k]);
    b.setAttribute('aria-pressed', String(prefs.get().kinds[k]));
    chipBtns.set(k, b);
    chips.append(b);
  }
  const slider = h('input.aimslider', { type: 'range', min: '0', max: '359', step: '1', value: String(Math.round(prefs.get().heading)), 'aria-label': 'Heading (degrees from north)' });
  const sliderVal = h('span.aimval');
  slider.addEventListener('input', () => {
    prefs.set({ heading: Number(slider.value) });
    sliderVal.textContent = `${slider.value}° ${compassPoint(Number(slider.value))}`;
  });
  sliderVal.textContent = `${slider.value}° ${compassPoint(Number(slider.value))}`;
  const manual = h('div.aimmanual', h('b', 'NO COMPASS · DRAG THE PICTURE OR SLIDE'), h('div.row', slider, sliderVal));
  manual.hidden = true;
  const card = h('div.lenssel.aimcard');
  card.hidden = true;
  const replyModel = h('small');
  const replyText = h('div');
  const reply = h('div.lensreply', replyModel, replyText);
  reply.hidden = true;
  const feedsLine = h('div.note.aimfeeds');
  const note = h('div.note', 'Hold the phone up and look through it: labels sit over planes, ships, buses, places and the space station. Tap one for its card. Compass off? Tap a marker for something you can see, put the cross on it, ALIGN. Your position stays on the phone except to ask for what is near it.');
  const credit = h('div.note.aimcredit', 'Places: Wikipedia, OpenStreetMap · aircraft: adsb.lol / airplanes.live · station: wheretheiss.at');
  const root = h('div.stackf', h('div.row.wrap', startBtn, whatBtn, alignBtn, resetBtn), chips, manual, card, reply, feedsLine, note, credit);

  // ---- the phone's position
  const setPos = (lat: number, lon: number, alt: number, from: 'gps' | 'home') => {
    const old = A.pos;
    A.pos = { lat, lon, alt, from };
    if (!old || groundDistance(old, A.pos) > 25 || Math.abs(old.alt - alt) > 10) seenDirty = true;
    if (!placesAt || groundDistance(placesAt, A.pos) > 1000) void refresh('place', true);
  };
  const startGps = () => {
    if (watchId >= 0) return;
    if (!navigator.geolocation) {
      useHome('this browser has no location');
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (p) => setPos(p.coords.latitude, p.coords.longitude, p.coords.altitude ?? A.pos?.alt ?? 0, 'gps'),
      (e) => {
        if (!A.pos || A.pos.from === 'home') useHome(e.code === 1 ? 'location access was refused' : 'no location fix');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
  };
  const useHome = (why: string) => {
    const p = home();
    if (!A.pos) setPos(p.lat, p.lon, 0, 'home');
    toast(`AIM is using ${p.name} as your position: ${why}`, 'warn');
  };

  // ---- the compass
  const onOrientation = (e: Event) => {
    const o = e as OrientationEvt;
    if (o.alpha == null && o.webkitCompassHeading == null) return;
    const now = performance.now();
    const absolute = e.type === 'deviceorientationabsolute' || o.absolute === true;
    const compass = typeof o.webkitCompassHeading === 'number' && o.webkitCompassHeading >= 0 ? o.webkitCompassHeading : null;
    // a relative reading is ignored while true-north ones are coming in
    if (!absolute && compass == null && now - lastAbsoluteAt < 2000) return;
    if (absolute || compass != null) lastAbsoluteAt = now;
    lastEventAt = now;
    const angle = (screen.orientation?.angle ?? 0) || 0;
    // An iPhone's alpha starts wherever the phone was; its compass heading is the same angle measured from north the other way.
    const alpha = compass != null ? 360 - compass : o.alpha ?? 0;
    const next = poseFromOrientation(alpha, o.beta ?? 90, o.gamma ?? 0, angle);
    sensorPose = sensorPose ? smooth(sensorPose, next, 0.35) : next;
    A.sensors = absolute || compass != null ? 'compass' : 'relative';
    if (!manual.hidden) manual.hidden = true;
    view.classList.remove('aimpan');
  };

  const startSensors = (tapped: boolean) => {
    if (A.sensors !== 'off' && A.sensors !== 'manual') return;
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> } }).DeviceOrientationEvent;
    const listen = () => {
      addEventListener('deviceorientationabsolute', onOrientation, { passive: true });
      addEventListener('deviceorientation', onOrientation, { passive: true });
      A.sensors = 'waiting';
      clearTimeout(waitTimer);
      // nothing from the sensor in two seconds: a laptop, or motion access refused
      waitTimer = window.setTimeout(() => {
        if (!lastEventAt) goManual('no compass on this device');
      }, 2000);
    };
    // iOS asks for motion access, and only from a tap: this must be the first thing the tap does
    if (D && typeof D.requestPermission === 'function') {
      if (!tapped) {
        L.status('tap START AIM to use the compass', 'mid');
        return;
      }
      D.requestPermission()
        .then((r) => (r === 'granted' ? listen() : goManual('motion access was refused (Settings › Safari › Motion & Orientation Access)')))
        .catch(() => goManual('motion access needs a tap on START AIM'));
    } else if (D) listen();
    else goManual('no compass on this device');
    startGps();
    if (tapped && S.camera === 'off') void L.startCamera();
    startBtn.hidden = true;
  };

  const goManual = (why: string) => {
    A.sensors = 'manual';
    manual.hidden = false;
    // A finger drag must reach onMove: left to the browser it becomes a page pan and is cancelled.
    view.classList.add('aimpan');
    startBtn.hidden = false;
    startBtn.textContent = 'TRY THE COMPASS';
    L.status(`${why} · drag the picture to look around`, 'mid');
  };

  const stopSensors = () => {
    removeEventListener('deviceorientationabsolute', onOrientation);
    removeEventListener('deviceorientation', onOrientation);
    if (watchId >= 0) navigator.geolocation?.clearWatch(watchId);
    watchId = -1;
    clearTimeout(waitTimer);
    sensorPose = null;
    lastEventAt = 0;
    lastAbsoluteAt = 0;
    A.sensors = 'off';
    view.classList.remove('aimpan');
  };

  /** Where the camera points now: the sensor (corrected by ALIGN) or the manual heading. */
  const pose = (): Pose => {
    if (sensorPose && A.sensors !== 'manual') return rotatePose(sensorPose, prefs.get().offset);
    const p = prefs.get();
    return poseFrom(p.heading, p.pitch);
  };

  // ---- the feeds
  const refresh = async (k: AimKind, force = false) => {
    const pos = A.pos;
    if (!pos || busy[k] || !prefs.get().kinds[k]) return;
    if (!force && Date.now() - lastFetch[k] < EVERY[k]) return;
    busy[k] = true;
    lastFetch[k] = Date.now();
    try {
      targets[k] = await load(k, pos.lat, pos.lon);
      if (k === 'place') placesAt = { lat: pos.lat, lon: pos.lon };
      A.feeds[k] = A.feeds[k].startsWith('note:') ? A.feeds[k] : 'live';
    } catch (e) {
      A.feeds[k] = `problem: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
    } finally {
      busy[k] = false;
      seenDirty = true;
      showFeeds();
    }
  };

  const brainJson = async (path: string): Promise<unknown> => {
    const r = await fetch(path, { headers: headers() });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j;
  };

  const box = (lat: number, lon: number, d: number) => {
    const dl = d / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    return [lon - dl, lat - d, lon + dl, lat + d].map((x) => x.toFixed(3)).join(',');
  };

  const load = async (k: AimKind, lat: number, lon: number): Promise<Target[]> => {
    if (k === 'plane') {
      const q = `${lat.toFixed(3)}/${lon.toFixed(3)}/40`;
      const j = await fetchJson(`https://api.adsb.lol/v2/point/${q}`, 5, 12000).catch(() => fetchJson(`https://api.airplanes.live/v2/point/${q}`, 5, 12000));
      return planesFrom(j);
    }
    if (k === 'ship') {
      const j = (await brainJson(`/api/ships?bbox=${box(lat, lon, 0.35)}`)) as { note?: string };
      A.feeds.ship = j.note ? `note: ${j.note}` : 'live';
      return shipsFrom(j);
    }
    if (k === 'transit') {
      const j = (await brainJson(`/api/transit?bbox=${box(lat, lon, 0.04)}`)) as { note?: string };
      A.feeds.transit = j.note ? `note: ${j.note}` : 'live';
      return transitFrom(j);
    }
    if (k === 'place') {
      // About a kilometre is all the brain needs (it answers per square kilometre); bearings are worked out here.
      const j = (await brainJson(`/api/aim/places?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&r=15000`)) as { note?: string };
      A.feeds.place = j.note ? `note: ${j.note}` : 'live';
      return placesFrom(j);
    }
    return issFrom(await brainJson('/api/aim/iss'));
  };

  const showFeeds = () => {
    const bits: string[] = [];
    for (const k of AIM_KINDS) {
      if (!prefs.get().kinds[k]) continue;
      const f = A.feeds[k];
      if (f.startsWith('problem') || f.startsWith('note')) bits.push(`${KIND_LABEL[k]}: ${f.replace(/^note: /, '')}`);
    }
    feedsLine.textContent = bits.join(' · ');
    feedsLine.hidden = !bits.length;
  };

  /** Due feeds, once a second. */
  const poll = () => {
    if (!L.active() || S.mode !== 'aim') return;
    for (const k of AIM_KINDS) if (k !== 'place') void refresh(k);
  };

  // ---- drawing
  const viewport = (): Viewport => {
    const { frame, size, t } = L.view();
    return { w: size.w, h: size.h, focal: focalFor(S.camera === 'on' ? frame : { w: 0, h: 0 }, t.scale, size) };
  };

  const draw = () => {
    if (!L.active() || S.mode !== 'aim') return;
    const c = L.overlay();
    const vp = viewport();
    if (!c || !vp.w) return;
    const ps = pose();
    const hp = headingOf(ps);
    A.heading = hp.heading;
    A.pitch = hp.pitch;
    A.offset = prefs.get().offset;
    if (seenDirty && A.pos) {
      const kinds = prefs.get().kinds;
      const all: Target[] = [];
      for (const k of AIM_KINDS) if (kinds[k]) all.push(...targets[k]);
      // the station only when it is above the horizon
      seen = locate(all, A.pos).filter((t) => t.kind !== 'space' || t.elevation > 0);
      for (const k of AIM_KINDS) A.counts[k] = seen.filter((t) => t.kind === k).length;
      seenDirty = false;
    }

    // the horizon
    const hz = horizonLine(ps, vp);
    if (hz) {
      c.save();
      c.strokeStyle = 'rgba(98, 228, 255, .45)';
      c.setLineDash([6, 6]);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hz.x1, hz.y1);
      c.lineTo(hz.x2, hz.y2);
      c.stroke();
      c.restore();
    }

    // every target projected; the nearest get labels, the rest of the on-screen ones a dot
    const proj = seen.map((t) => ({ t, p: project(t.dir, ps, vp, 30) }));
    const on = proj.filter((x) => x.p.on);
    const cx = vp.w / 2;
    const cy = vp.h / 2;
    let aimed: (typeof on)[number] | null = null;
    let best = 70;
    for (const x of on) {
      const d = Math.hypot(x.p.x - cx, x.p.y - cy);
      if (d < best) {
        best = d;
        aimed = x;
      }
    }
    c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
    const lines = new Map<string, [string, string]>();
    const ins = on.map((x) => {
      const l1 = `${KIND_GLYPH[x.t.kind]} ${x.t.title}`;
      const l2 = labelLine(x.t);
      lines.set(x.t.id, [l1, l2]);
      const w = Math.min(170, Math.max(c.measureText(l1).width, c.measureText(l2).width * 0.9) + 12);
      // the aimed and the selected one go first
      const pri = x.t.id === A.selected || x === aimed ? -1 : x.t.kind === 'plane' || x.t.kind === 'space' ? x.t.range / 4 : x.t.ground;
      return { id: x.t.id, x: x.p.x, y: x.p.y, w, h: 28, dist: pri };
    });
    const placed = new Map(declutter(ins, MAX_LABELS, { w: vp.w, h: vp.h }).map((l) => [l.id, l]));
    drawn = [];
    A.markers = [];
    for (const x of on) {
      const col = COLORS[x.t.kind];
      const sel = x.t.id === A.selected;
      const isAimed = x === aimed;
      c.strokeStyle = sel || isAimed ? '#ffb23e' : col;
      c.fillStyle = 'rgba(2, 7, 13, .55)';
      c.lineWidth = sel || isAimed ? 2 : 1.4;
      c.beginPath();
      c.moveTo(x.p.x, x.p.y - 6);
      c.lineTo(x.p.x + 6, x.p.y);
      c.lineTo(x.p.x, x.p.y + 6);
      c.lineTo(x.p.x - 6, x.p.y);
      c.closePath();
      c.fill();
      c.stroke();
      const l = placed.get(x.t.id);
      let boxRect: { x: number; y: number; w: number; h: number } | undefined;
      if (l) {
        const [l1, l2] = lines.get(x.t.id)!;
        c.strokeStyle = sel || isAimed ? '#ffb23e' : col;
        c.globalAlpha = 0.6;
        c.beginPath();
        c.moveTo(x.p.x, x.p.y + (l.ly < x.p.y ? -6 : 6));
        c.lineTo(x.p.x, l.ly < x.p.y ? l.ly + l.h : l.ly);
        c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(2, 7, 13, .78)';
        c.fillRect(l.lx, l.ly, l.w, l.h);
        c.fillStyle = sel || isAimed ? '#ffb23e' : col;
        c.fillRect(l.lx, l.ly, 2, l.h);
        c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        c.fillText(clip(c, l1, l.w - 10), l.lx + 6, l.ly + 12);
        c.fillStyle = 'rgba(255, 255, 255, .78)';
        c.font = '400 9.5px "IBM Plex Mono", ui-monospace, monospace';
        c.fillText(clip(c, l2, l.w - 10), l.lx + 6, l.ly + 24);
        boxRect = { x: l.lx, y: l.ly, w: l.w, h: l.h };
      }
      drawn.push({ t: x.t, p: x.p, box: boxRect });
      A.markers.push({ id: x.t.id, kind: x.t.kind, title: x.t.title, x: Math.round(x.p.x), y: Math.round(x.p.y), on: true, angle: x.p.angle, labelled: !!l });
    }

    // edge arrows for the nearest things out of view (and the selected one)
    const off = proj
      .filter((x) => !x.p.on)
      .sort((a, b) => (a.t.id === A.selected ? -1 : b.t.id === A.selected ? 1 : a.t.ground - b.t.ground))
      .slice(0, MAX_ARROWS);
    for (const x of off) {
      const sel = x.t.id === A.selected;
      c.save();
      c.translate(x.p.x, x.p.y);
      c.rotate(x.p.angle);
      c.fillStyle = sel ? '#ffb23e' : COLORS[x.t.kind];
      c.globalAlpha = sel ? 1 : 0.75;
      c.beginPath();
      c.moveTo(10, 0);
      c.lineTo(-6, -7);
      c.lineTo(-3, 0);
      c.lineTo(-6, 7);
      c.closePath();
      c.fill();
      c.restore();
      c.fillStyle = sel ? '#ffb23e' : 'rgba(255, 255, 255, .8)';
      c.font = '400 9px "IBM Plex Mono", ui-monospace, monospace';
      const tag = `${KIND_GLYPH[x.t.kind]} ${x.t.title.slice(0, 12)}`;
      const tw = c.measureText(tag).width;
      const tx = Math.max(2, Math.min(vp.w - tw - 2, x.p.x - tw / 2 - Math.cos(x.p.angle) * 18));
      const ty = Math.max(54, Math.min(vp.h - 24, x.p.y - Math.sin(x.p.angle) * 16 + 3));
      c.fillText(tag, tx, ty);
      drawn.push({ t: x.t, p: x.p, box: { x: x.p.x - 16, y: x.p.y - 16, w: 32, h: 32 } });
      A.markers.push({ id: x.t.id, kind: x.t.kind, title: x.t.title, x: Math.round(x.p.x), y: Math.round(x.p.y), on: false, angle: x.p.angle, labelled: false });
    }

    // the cross in the middle
    c.strokeStyle = aimed ? '#ffb23e' : 'rgba(255, 255, 255, .7)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 14, cy);
    c.lineTo(cx - 5, cy);
    c.moveTo(cx + 5, cy);
    c.lineTo(cx + 14, cy);
    c.moveTo(cx, cy - 14);
    c.lineTo(cx, cy - 5);
    c.moveTo(cx, cy + 5);
    c.lineTo(cx, cy + 14);
    c.stroke();

    ribbon(c, vp, hp.heading);
    c.fillStyle = 'rgba(255, 255, 255, .55)';
    c.font = '400 8.5px "IBM Plex Mono", ui-monospace, monospace';
    c.fillText('Places: Wikipedia, OpenStreetMap', 8, vp.h - 22);

    A.aimed = aimed?.t.id ?? '';
    const n = seen.length;
    const aimedText = aimed ? `${KIND_GLYPH[aimed.t.kind]} ${aimed.t.title} · ${labelLine(aimed.t)}` : '';
    S.counts = aimed ? `aimed at ${aimed.t.title} (${labelLine(aimed.t)})` : `${n} labelled around`;
    const left = `${String(Math.round(hp.heading) % 360).padStart(3, '0')}° ${compassPoint(hp.heading)} · ${hp.pitch >= 0 ? '+' : ''}${Math.round(hp.pitch)}°${A.pos?.from === 'home' ? ' · home position' : ''}`;
    const right = aimedText || `${A.counts.plane} ✈ · ${A.counts.ship} ⛴ · ${A.counts.transit} ▣ · ${A.counts.place} ⌖${A.counts.space ? ' · ✦' : ''}`;
    if (left + right !== shownLines) {
      shownLines = left + right;
      L.lines(left, right);
    }
  };
  let shownLines = '';

  /** The compass ribbon along the top: ticks every 5°, the points every 45°, the heading in a box. */
  const ribbon = (c: CanvasRenderingContext2D, vp: Viewport, heading: number) => {
    const y = 22;
    // the scale of the picture at its centre, so a tick sits over what is at that bearing
    const pxPerDeg = (vp.focal * Math.PI) / 180;
    c.fillStyle = 'rgba(2, 7, 13, .5)';
    c.fillRect(0, y, vp.w, 22);
    c.strokeStyle = 'rgba(98, 228, 255, .55)';
    c.fillStyle = '#62e4ff';
    c.font = '500 9.5px "IBM Plex Mono", ui-monospace, monospace';
    c.textAlign = 'center';
    const half = vp.w / 2 / pxPerDeg;
    const start = Math.ceil((heading - half) / 5) * 5;
    for (let d = start; d <= heading + half; d += 5) {
      const x = vp.w / 2 + turn(heading, d) * pxPerDeg;
      const major = wrap360(d) % 45 === 0;
      c.beginPath();
      c.moveTo(x, y + 22);
      c.lineTo(x, y + 22 - (major ? 8 : 4));
      c.stroke();
      if (major) c.fillText(compassPoint(d), x, y + 11);
      else if (wrap360(d) % 15 === 0) {
        c.globalAlpha = 0.6;
        c.fillText(String(wrap360(d)), x, y + 11);
        c.globalAlpha = 1;
      }
    }
    const label = `${String(Math.round(heading) % 360).padStart(3, '0')}°`;
    c.fillStyle = 'rgba(2, 7, 13, .9)';
    c.fillRect(vp.w / 2 - 20, y + 22, 40, 14);
    c.strokeStyle = '#ffb23e';
    c.strokeRect(vp.w / 2 - 20, y + 22, 40, 14);
    c.fillStyle = '#ffb23e';
    c.fillText(label, vp.w / 2, y + 33);
    c.textAlign = 'start';
  };

  // ---- taps and drags on the viewfinder (AIM's own: it works with the camera off too)
  const view = L.video.parentElement as HTMLElement;
  let down: { x: number; y: number; heading: number; pitch: number; id: number } | null = null;
  const onDown = (e: PointerEvent) => {
    const p = prefs.get();
    down = { x: e.clientX, y: e.clientY, heading: p.heading, pitch: p.pitch, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    // dragging pans only when there is no compass to follow
    if (!down || e.pointerId !== down.id || sensorPose) return;
    const vp = viewport();
    const degPx = (2 * Math.atan(vp.w / 2 / vp.focal) * (180 / Math.PI)) / Math.max(1, vp.w);
    const heading = wrap360(down.heading - (e.clientX - down.x) * degPx);
    const pitch = Math.max(-30, Math.min(85, down.pitch + (e.clientY - down.y) * degPx));
    prefs.set({ heading, pitch });
    slider.value = String(Math.round(heading));
    sliderVal.textContent = `${Math.round(heading)}° ${compassPoint(heading)}`;
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 10) return;
    const r = view.getBoundingClientRect();
    tapAt(e.clientX - r.left, e.clientY - r.top);
  };
  const onCancel = () => (down = null);

  const tapAt = (x: number, y: number) => {
    let hit: (typeof drawn)[number] | null = null;
    let best = 26;
    for (const d of drawn) {
      if (d.box && x >= d.box.x && x <= d.box.x + d.box.w && y >= d.box.y && y <= d.box.y + d.box.h) {
        hit = d;
        break;
      }
      const dist = Math.hypot(d.p.x - x, d.p.y - y);
      if (dist < best) {
        best = dist;
        hit = d;
      }
    }
    if (hit) select(hit.t.id);
    else if (A.selected) select('');
  };

  // ---- the card
  const current = (id: string): Seen | null => seen.find((t) => t.id === id) ?? null;
  let cardGen = 0;
  const select = (id: string) => {
    A.selected = id;
    const t = current(id);
    const gen = ++cardGen;
    if (!t) {
      card.hidden = true;
      clear(card);
      return;
    }
    S.lastAction = `selected ${t.title}`;
    const extract = h('div.aimextract');
    const rows = h('div.lenshow');
    rows.append(h('b', 'WHERE'), h('span', `${Math.round(t.bearing)}° ${compassPoint(t.bearing)} · ${t.elevation >= 0 ? `${t.elevation.toFixed(1)}° up` : `${(-t.elevation).toFixed(1)}° down`} · ${distanceText(t.kind === 'plane' || t.kind === 'space' ? t.range : t.ground)}`));
    for (const [k, v] of t.facts) rows.append(h('b', k.toUpperCase()), h('span', v));
    clear(
      card,
      h('b', `${KIND_GLYPH[t.kind]} ${t.title}`),
      rows,
      extract,
      h('div.row.wrap', button('ASK GHOSTY', () => void askAbout(t, `Tell me about this ${t.kind === 'transit' ? 'bus' : t.kind === 'space' ? 'satellite' : t.kind}.`), 'warn'), button('CLOSE', () => select(''))),
    );
    card.hidden = false;
    if (t.wiki) {
      extract.textContent = 'Looking it up on Wikipedia…';
      void brainJson(`/api/aim/about?title=${encodeURIComponent(t.wiki)}`)
        .then((j) => {
          if (gen !== cardGen) return;
          const a = j as { extract?: string; title?: string };
          extract.textContent = a.extract ? `${a.extract} (Wikipedia)` : '';
          wikiText.set(t.id, a.extract ?? '');
        })
        .catch(() => gen === cardGen && (extract.textContent = ''));
    }
  };
  const wikiText = new Map<string, string>();

  // ---- asking Ghosty
  const askAbout = async (t: Seen, question: string) => {
    const extra = wikiText.get(t.id);
    const seenNote = `${describeTarget(t)}${extra ? `; Wikipedia: ${extra.slice(0, 500)}` : ''}; the owner is at ${A.pos ? `${A.pos.lat.toFixed(3)}, ${A.pos.lon.toFixed(3)}` : 'an unknown place'} pointing the phone ${Math.round(A.heading)}° ${compassPoint(A.heading)}`;
    L.status('asking Ghosty…', 'mid');
    whatBtn.disabled = true;
    try {
      const r = await askWithImage(question, null, (ev) => ev.t === 'tool' && L.status(`Ghosty: ${ev.name.replace(/_/g, ' ')}…`, 'mid'), { seen: seenNote });
      const text = r.text || r.error || 'No answer';
      reply.hidden = false;
      replyModel.textContent = r.text ? r.model || 'GHOSTY' : 'PROBLEM';
      replyText.textContent = text;
      A.reply = text;
      S.reply = text;
      L.status(r.text ? 'answered' : 'no answer', r.text ? 'ok' : 'off');
    } finally {
      whatBtn.disabled = false;
    }
  };

  const whatsThat = async () => {
    const t = current(A.aimed) ?? current(A.selected);
    if (!t) return void toast('Nothing under the cross: aim at a label, or tap one', 'warn');
    select(t.id);
    await askAbout(t, "What's that?");
  };

  const align = () => {
    const t = current(A.selected);
    if (!t) return void toast('First tap the marker of something you can see for real (a tower, a hill), then put the cross on the real thing and press ALIGN', 'warn');
    if (A.sensors !== 'compass' && A.sensors !== 'relative') {
      // manual: just face it
      prefs.set({ heading: t.bearing });
      slider.value = String(Math.round(t.bearing));
      return;
    }
    // the camera's heading without the old correction, and the turn that puts the target in the middle
    const raw = sensorPose ? headingOf(sensorPose).heading : A.heading;
    const offset = turn(raw, t.bearing);
    prefs.set({ offset });
    A.offset = offset;
    resetBtn.hidden = !offset;
    toast(`Compass corrected by ${offset > 0 ? '+' : ''}${offset.toFixed(1)}°`, 'ok');
  };

  return {
    id: 'aim',
    enter() {
      expose();
      clear(L.panel);
      L.panel.append(root);
      if (!entered) {
        entered = true;
        view.addEventListener('pointerdown', onDown);
        view.addEventListener('pointermove', onMove);
        view.addEventListener('pointerup', onUp);
        view.addEventListener('pointercancel', onCancel);
        stopFrame = onFrame(() => draw());
        timer = window.setInterval(poll, 1000);
      }
      // a tap brought AIM up: the sensors (and the camera) start from it
      if (A.sensors === 'off') {
        if (navigator.userActivation?.isActive) startSensors(true);
        else L.status('tap START AIM: camera, compass and location', 'mid');
      }
      showFeeds();
    },
    leave() {
      if (entered) {
        view.removeEventListener('pointerdown', onDown);
        view.removeEventListener('pointermove', onMove);
        view.removeEventListener('pointerup', onUp);
        view.removeEventListener('pointercancel', onCancel);
        stopFrame?.();
        stopFrame = null;
        clearInterval(timer);
        entered = false;
      }
      stopSensors();
      startBtn.hidden = false;
      startBtn.textContent = 'START AIM';
      manual.hidden = true;
      A.markers = [];
      A.aimed = '';
      S.counts = '';
      shownLines = '';
      L.clearOverlay();
    },
  };
}

/** Pose smoothing: a step of `k` towards the new reading, axes kept unit length. A big jump (over 60°) is taken at once: averaging opposite directions goes nowhere. */
function smooth(a: Pose, b: Pose, k: number): Pose {
  const close = (x: [number, number, number], y: [number, number, number]) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2] > 0.5;
  if (!close(a.f, b.f) || !close(a.u, b.u)) return b;
  const mix = (x: [number, number, number], y: [number, number, number]): [number, number, number] => {
    const v: [number, number, number] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  return { f: mix(a.f, b.f), r: mix(a.r, b.r), u: mix(a.u, b.u) };
}

function clip(c: CanvasRenderingContext2D, s: string, w: number): string {
  if (c.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && c.measureText(`${t}…`).width > w) t = t.slice(0, -1);
  return `${t}…`;
}
