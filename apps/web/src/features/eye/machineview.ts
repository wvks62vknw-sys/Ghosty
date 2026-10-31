/**
 * THE MACHINE VIEW on screen (OWNER-ISSUES 61c; the pure parts and the words in machine.ts): a mode of God's Eye that
 * frames his city — his saved home, else the phone's home setting — at about 14 km and a 50° tilt, turns the moving things
 * on (aircraft, buses and trams, ships where a feed can be read, satellites dimmed, road incidents), lights his places
 * with thin white boxes (an amber ring while a warning is active there, the walk home under way), tags the three aircraft
 * nearest home and the nearest bus or tram, and says the true count in one line, refreshed every 2 s. The view is never
 * still: a slow drift (heading +2° a second, the range breathing ±4 % over 20 s) that pauses while he touches the globe
 * and comes back 6 s after; a ZOOM (or any flight he asks for) stops it until LEAVE. LEAVE — or another mode, or another
 * tab — puts back exactly the layers and the camera he had; nothing of the mode is kept in his layer choices.
 */
import { expectLines } from '../../../../../packages/shared/src/foresight';
import type { SavedPlace } from '../../../../../packages/shared/src/places';
import { h } from '../../core/dom';
import { incidents } from '../../data/incidents';
import { ships } from '../../data/intel';
import { transit, type Vehicle } from '../../data/transit';
import type { CamPose } from '../../engine/camera';
import { GEO } from '../../engine/geo';
import { gfx } from '../../engine/gfx';
import { globe, type LayerVisibility, type Pickable } from '../../engine/globe';
import { air, type Aircraft } from '../../engine/layers/air';
import { sats } from '../../engine/layers/sats';
import { transitLayer } from '../../engine/layers/transit';
import type { Vec3 } from '../../engine/math';
import { onFrame } from '../../engine/scheduler';
import { World } from '../../engine/world';
import { home as phoneHome } from '../../state/app';
import { foresight, loadForesight } from '../../state/foresight';
import { guardian, loadGuardian } from '../../state/guardian';
import { button } from '../../ui/components';
import { airTag, countLine, hubLine, inWestMidlands, MACHINE_KM, MACHINE_LAYERS, MACHINE_RANGE, MACHINE_TILT, machineState, nearBaltic, nearest, NO_HOME, overhead, placeTag, transitTag, walkTag, warningSentence, within, type MachineCounts } from './machine';

export interface MachineHost {
  /** The Eye's middle (the boxes go over the globe there), its top (search and chips), its bottom bar and its HUD. */
  mid: HTMLElement;
  top: HTMLElement;
  bot: HTMLElement;
  hud: HTMLElement;
  /** His saved places as the Eye's chips last read them; `refreshPlaces` reads them again. */
  places(): SavedPlace[];
  refreshPlaces(): Promise<void>;
  /** Close the target card (the mode starts with nothing selected). */
  select(p: Pickable | null): void;
  /** The Eye is the tab on screen. */
  active(): boolean;
}

const FLY_S = 1.8;
const DRIFT_DEG_S = 2;
const BREATHE = 0.04;
const BREATHE_MS = 20_000;
const RESUME_MS = 6_000;

/** Where the camera was and what was on: what LEAVE puts back exactly. */
interface Before {
  vis: LayerVisibility;
  cam: CamPose;
  spin: boolean;
  orbit: boolean;
  dim: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMachine(host: MachineHost): { button: HTMLButtonElement; on(): boolean; enter(): Promise<void>; leave(instant?: boolean): void; describe(): string } {
  let before: Before | null = null;
  let myFly: unknown = null;
  let touchedAt = 0;
  let base = MACHINE_RANGE;
  let t0 = 0;
  let lastSet: number | null = null;
  let pollTimer = 0;
  let homeAt: { lat: number; lon: number; label: string } | null = null;
  let tagged: { air: Aircraft[]; bus: Vehicle | null } = { air: [], bus: null };
  /** The open sky between the search and the bar (measured with each count, not each frame): boxes stay inside it. */
  let sky = { top: 0, bottom: innerHeight };
  const measure = () => void (sky = { top: host.top.getBoundingClientRect().bottom, bottom: host.bot.getBoundingClientRect().top });
  /** A label's width, measured once per wording. */
  const widths = new Map<string, number>();
  let lit: { lat: number; lon: number; tag: string; sub: string; warn: boolean }[] = [];

  // the line, above the bar (said in his voice; read out by VoiceOver as it changes) and the honest edges, once each
  const line = h('p.mchline', { role: 'status', 'aria-live': 'polite' });
  const note = h('p.mchnote', { hidden: true });
  const panel = h('div.mchview', { hidden: true, dataset: { case: 'keep' } }, note, line);
  host.bot.prepend(panel);
  // the boxes over the globe (never in the way of a tap: the globe's own picking opens the target card)
  const boxes = h('div.mchboxes', { hidden: true, 'aria-hidden': 'true' });
  host.mid.prepend(boxes);
  const pool: { el: HTMLElement; lab: HTMLElement; sub: HTMLElement }[] = [];
  const node = (i: number) => {
    if (!pool[i]) {
      const lab = h('span.mchlab');
      const sub = h('span.mchsub');
      const el = h('div.mchbox', h('i.mchring'), lab, sub);
      boxes.append(el);
      pool[i] = { el, lab, sub };
    }
    return pool[i]!;
  };

  const btn = button('MACHINE VIEW', () => (machineState.on ? leave() : void enter()), 'machinebtn');
  btn.setAttribute('aria-pressed', 'false');
  // (its words stay in capitals, as the Machine's labels are: not the sentence case of the other buttons)
  btn.dataset.case = 'keep';
  const paintButton = () => {
    btn.textContent = machineState.on ? 'LEAVE MACHINE VIEW' : 'MACHINE VIEW';
    btn.classList.toggle('on', machineState.on);
    btn.setAttribute('aria-pressed', String(machineState.on));
  };

  // his touch pauses the drift; it comes back 6 s after
  const touched = () => void (touchedAt = performance.now());
  gfx.cv.addEventListener('pointerdown', touched, { passive: true });
  gfx.cv.addEventListener('pointermove', (e) => e.buttons && touched(), { passive: true });
  gfx.cv.addEventListener('wheel', touched, { passive: true });

  /** The city the frame is over ("Birmingham"), from the globe's own list. */
  const cityOf = (c: { lat: number; lon: number }) => {
    const near = World.near(c.lat, c.lon, 2e5);
    return near && near.km < 60 ? near.city.name : '';
  };

  /** The feeds the phone already reads, asked about the frame (one poller while the mode is on: the Eye's own wait). */
  const poll = async (): Promise<void> => {
    if (!machineState.on) return;
    const T = globe.cam.target;
    await Promise.allSettled([
      air.refresh(T.lat, T.lon, MACHINE_KM),
      transit.refresh(T.lat, T.lon, MACHINE_KM),
      ships.refresh(T.lat, T.lon, MACHINE_KM),
      inWestMidlands(T) ? incidents.refresh('West Midlands') : Promise.resolve(),
    ]);
  };

  /** The count, the tags and the boxes' words, from what the phone holds now (every 2 s). */
  const count = () => {
    if (!machineState.on) return;
    measure();
    const T = globe.cam.target;
    const centre = { lat: T.lat, lon: T.lon };
    const now = Date.now();
    const at = homeAt ?? centre;
    // ships are said missing only once the brain has said it has no feed here (not before the first answer)
    const shipsRead = nearBaltic(centre) || ships.status === 'IDLE' || !/AISstream key/i.test(ships.note);
    const busNear = within(transit.list.values(), centre, MACHINE_KM, (v) => transit.pos(v, now));
    const counts: MachineCounts = {
      city: cityOf(centre) || (homeAt ? homeAt.label : ''),
      air: within(air.list.values(), centre, MACHINE_KM, (a) => air.pos(a, now)).length,
      transit: busNear.length ? busNear.length : transit.status === 'NO FEED' ? null : 0,
      ships: shipsRead ? within(ships.list.values(), centre, MACHINE_KM, (s) => ships.pos(s, now)).length : null,
      sats: overhead(sats.list, centre),
      incidents: inWestMidlands(centre) ? within(incidents.list.values(), centre, MACHINE_KM).length : null,
    };
    tagged = {
      air: nearest([...air.list.values()].filter((a) => !a.gnd), at, 3, (a) => air.pos(a, now)),
      bus: nearest(transit.list.values(), at, 1, (v) => transit.pos(v, now))[0] ?? null,
    };
    // his places, each with what is active near it (the guardian's watch), and the walk home under the home box
    const g = guardian.get().info;
    const tz = g?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const warnings: string[] = [];
    const places = host.places();
    lit = places.map((p) => {
      const act = (g?.places.find((x) => x.id === p.id)?.active ?? []).filter((w) => !(w.until && w.until <= now) && w.since <= now);
      for (const w of act) warnings.push(warningSentence(w, p.label, tz));
      return { lat: p.lat, lon: p.lon, tag: placeTag(p.label, act), sub: p.id === 'home' ? walkTag(g?.walk, tz) : '', warn: act.length > 0 };
    });
    const homeSaved = places.find((p) => p.id === 'home');
    // "Nothing active near Home." only when the watch has really looked (a feed that failed is never an all-clear)
    const watched = !!g && !!homeSaved && g.places.some((x) => x.id === 'home') && !g.failed.flood && !g.failed.weather;
    const f = foresight.get().info;
    const expect = f ? expectLines(f.items, now, f.tz)[0] : undefined;
    machineState.counts = counts;
    machineState.line = countLine(counts, { home: watched ? homeSaved!.label : undefined, warning: warnings[0], expect });
    machineState.hub = hubLine(counts);
    machineState.places = lit.map((p) => ({ label: p.tag.split(' · ')[0]!, tag: p.tag, warning: p.warn }));
    machineState.warnings = warnings;
    machineState.walk = lit.find((p) => p.sub)?.sub ?? '';
    machineState.aircraft = tagged.air.map(airTag);
    machineState.transit = tagged.bus ? transitTag(tagged.bus) : '';
    if (line.textContent !== machineState.line) line.textContent = machineState.line;
  };

  /** The boxes, where each thing is on screen now. */
  const paint = () => {
    if (!machineState.on || !host.active()) return;
    const c = globe.cam;
    if (!c.cs) return;
    const now = Date.now();
    const items: { w: Vec3; size: number; kind: string; tag: string; sub: string; warn: boolean }[] = [];
    for (const p of lit) items.push({ w: GEO.ecef(p.lat, p.lon, 0.02), size: 26, kind: 'place', tag: p.tag, sub: p.sub, warn: p.warn });
    for (const a of tagged.air) items.push({ w: air.world(a, now), size: 22, kind: 'air', tag: airTag(a), sub: '', warn: false });
    if (tagged.bus) items.push({ w: transitLayer.world(tagged.bus, now), size: 20, kind: 'transit', tag: transitTag(tagged.bus), sub: '', warn: false });
    // where each box falls on screen (only inside the open sky), then its label: above it, flipped left at the screen's
    // right edge, stepped clear of the boxes and the labels already placed (his places first, then the aircraft, the bus)
    const shown = items
      .map((it) => ({ it, p: c.project(it.w) }))
      .filter((x): x is { it: (typeof items)[number]; p: [number, number, number] } => !!x.p && c.visible(x.it.w) && x.p[0] > -20 && x.p[0] < innerWidth + 20 && x.p[1] > sky.top + 4 && x.p[1] < sky.bottom - 4);
    const placed: [number, number, number, number][] = shown.map(({ it, p }) => [p[0] - it.size / 2, p[1] - it.size / 2, it.size, it.size]);
    const clash = (r: [number, number, number, number]) => placed.some((q) => r[0] < q[0] + q[2] && r[0] + r[2] > q[0] && r[1] < q[1] + q[3] && r[1] + r[3] > q[1]);
    let i = 0;
    for (const { it, p } of shown) {
      const b = node(i++);
      const bx = p[0] - it.size / 2;
      const by = p[1] - it.size / 2;
      if (b.el.dataset.kind !== it.kind) b.el.dataset.kind = it.kind;
      b.el.classList.toggle('warn', it.warn);
      b.el.style.width = b.el.style.height = `${it.size}px`;
      b.el.style.transform = `translate(${bx.toFixed(0)}px,${by.toFixed(0)}px)`;
      b.el.hidden = false;
      if (b.lab.textContent !== it.tag) b.lab.textContent = it.tag;
      if (b.sub.textContent !== it.sub) b.sub.textContent = it.sub;
      b.sub.hidden = !it.sub;
      let lw = widths.get(it.tag);
      if (lw === undefined) widths.set(it.tag, (lw = b.lab.offsetWidth || it.tag.length * 7 + 12));
      const lh = 18;
      let x = bx - 1.5;
      if (x + lw > innerWidth - 6) x = Math.max(6, bx + it.size + 1.5 - lw);
      const tries = [by - 3 - lh, ...(it.kind === 'place' ? [] : [by + it.size + 3]), by - 5 - 2 * lh, by - 7 - 3 * lh];
      const y = tries.find((t) => t > sky.top && !clash([x, t, lw, lh])) ?? tries[0]!;
      placed.push([x, y, lw, lh]);
      b.lab.style.left = `${(x - bx).toFixed(0)}px`;
      b.lab.style.top = `${(y - by).toFixed(0)}px`;
    }
    for (; i < pool.length; i++) pool[i]!.el.hidden = true;
  };

  /** The slow drift: never still, paused by his touch, stopped by a flight he asked for. */
  const drift = (dt: number) => {
    if (!machineState.on || !host.active()) return;
    const c = globe.cam;
    if ((c.fly && c.fly !== myFly) || c.follow) machineState.drift = 'stopped';
    if (machineState.drift === 'stopped') return;
    const now = performance.now();
    // a zoom of his own (the rail, a pinch, the wheel, a key) counts as a touch
    if (lastSet !== null && Math.abs(c.target.range - lastSet) > 1e-6) touchedAt = now;
    if (c.dragging || now - touchedAt < RESUME_MS || c.fly) {
      machineState.drift = c.fly ? 'on' : 'paused';
      lastSet = null;
      return;
    }
    if (machineState.drift !== 'on' || lastSet === null) {
      base = c.target.range;
      t0 = now;
    }
    machineState.drift = 'on';
    c.target.hd += DRIFT_DEG_S * dt;
    c.target.range = base * (1 + BREATHE * Math.sin(((now - t0) / BREATHE_MS) * Math.PI * 2));
    lastSet = c.target.range;
  };

  onFrame(drift);
  onFrame(paint, 0.05);
  onFrame(count, 2);

  async function enter(): Promise<void> {
    if (machineState.on) return;
    const c = globe.cam;
    before = { vis: { ...globe.vis }, cam: { lat: c.lat, lon: c.lon, range: c.range, hd: c.hd, tilt: c.tilt }, spin: c.autoSpin, orbit: sats.showOrbit, dim: sats.dim };
    Object.assign(machineState, { on: true, ready: false, drift: 'on', notes: [], line: '', hub: '', counts: null, places: [], warnings: [], walk: '', aircraft: [], transit: '' });
    host.select(null);
    // his saved home (the Eye's chips; read again if they have not come yet), else the phone's home setting
    if (!host.places().length) await Promise.race([host.refreshPlaces().catch(() => undefined), sleep(1500)]);
    if (!machineState.on) return;
    const saved = host.places().find((p) => p.id === 'home');
    const H = saved ? { lat: saved.lat, lon: saved.lon, label: saved.label, saved: true } : { lat: phoneHome().lat, lon: phoneHome().lon, label: phoneHome().name, saved: false };
    homeAt = saved ? { lat: saved.lat, lon: saved.lon, label: saved.label } : null;
    machineState.centre = H;
    if (!saved) machineState.notes.push(NO_HOME);
    note.textContent = machineState.notes.join(' ');
    note.hidden = !machineState.notes.length;
    globe.vis = { ...globe.vis, ...MACHINE_LAYERS };
    sats.showOrbit = false;
    sats.dim = 0.4;
    c.autoSpin = false;
    c.flyTo({ lat: H.lat, lon: H.lon, range: MACHINE_RANGE, tilt: MACHINE_TILT, hd: c.hd }, FLY_S);
    myFly = c.fly;
    touchedAt = 0;
    lastSet = null;
    panel.hidden = false;
    boxes.hidden = false;
    host.hud.classList.add('machinemode');
    paintButton();
    count();
    measure();
    // the feeds about his city now, and his places' watch and today's expectations; the first line once they answer
    // (two seconds at most: what is not in by then comes with the next count)
    void loadGuardian().then(count);
    void loadForesight().then(count);
    clearInterval(pollTimer);
    pollTimer = window.setInterval(() => void poll(), 8000);
    await Promise.race([poll(), sleep(2000)]);
    if (!machineState.on) return;
    count();
    machineState.ready = true;
  }

  function leave(instant = false): void {
    if (!machineState.on) return;
    clearInterval(pollTimer);
    const c = globe.cam;
    const b = before;
    before = null;
    Object.assign(machineState, { on: false, ready: false, drift: 'off', line: '', hub: '', counts: null, places: [], warnings: [], walk: '', aircraft: [], transit: '', notes: [] });
    if (b) {
      globe.vis = b.vis;
      sats.showOrbit = b.orbit;
      sats.dim = b.dim;
      c.autoSpin = b.spin;
      c.follow = null;
      if (instant) {
        c.fly = null;
        Object.assign(c, b.cam);
        c.target = { ...b.cam };
      } else c.flyTo(b.cam, FLY_S);
    }
    panel.hidden = true;
    boxes.hidden = true;
    for (const p of pool) p.el.hidden = true;
    host.hud.classList.remove('machinemode');
    paintButton();
  }

  return {
    button: btn,
    on: () => machineState.on,
    enter,
    leave,
    describe: () => (machineState.on ? `Machine view: ${machineState.line}` : ''),
  };
}
