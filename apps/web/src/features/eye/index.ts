/**
 * GOD'S EYE tab: the live globe. Search, sensor modes, layer toggles, target card,
 * floating labels, touch/mouse gestures and the zoom rail.
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

let layersInstalled = false;
function installLayers(): void {
  if (layersInstalled) return;
  layersInstalled = true;
  sats.init();
  if (!globe.layers.includes(routeLayer)) globe.layers.push(routeLayer);
  globe.layers.push(quakeLayer, eventLayer, sats, air);
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
    case 'launch':
      return `rocket launch ${(r as unknown as Launch).name} from ${(r as unknown as Launch).pad}`;
    case 'route': {
      const rr = (r as { route: RouteInfo }).route;
      return `the route from ${rr.from} to ${rr.to} (${rr.mode}, ${(rr.distance_m / 1000).toFixed(1)} km)`;
    }
    case 'city':
      return `the city of ${(r as unknown as City).name}, ${(r as unknown as City).country}`;
    default:
      return sel.kind;
  }
}

export const eyeTab: TabDef = {
  id: 'eye',
  title: "GOD'S EYE",
  icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  scene: 'globe',
  primary: true,
  mount(root) {
    globe.init();
    installLayers();
    let selected: Pickable | null = null;
    let airTimer = 0;

    // ---------- top: search + sensor modes ----------
    const q = h('input', { placeholder: 'Search city, airport, flight, satellite…', autocomplete: 'off', 'aria-label': 'Search the globe' });
    const search = async () => {
      const s = q.value.trim();
      if (!s) return;
      const a = air.find(s);
      if (a) return select({ kind: 'air', ref: a, w: air.world(a, Date.now()) }, true);
      const sat = sats.list.find((x) => x.name.toLowerCase().includes(s.toLowerCase()));
      if (sat) return select({ kind: 'sat', ref: sat, w: sat.w }, true);
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
      ['air', 'AIRCRAFT', () => `${air.list.size} ${air.status}`],
      ['sats', 'SATELLITES', () => String(sats.list.length)],
      ['quakes', 'QUAKES', () => String(quakes.data?.length ?? 0)],
      ['events', 'EVENTS', () => String((events.data?.length ?? 0) + (launches.data?.length ?? 0))],
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
      air.selected = p?.kind === 'air' ? (p.ref as Aircraft) : null;
      sats.selected = p?.kind === 'sat' ? (p.ref as Satellite) : null;
      if (!p) globe.cam.follow = null;
      if (p && fly) {
        const ll = GEO.ll(p.w);
        globe.cam.flyTo({ lat: ll.lat, lon: ll.lon, range: p.kind === 'sat' ? Math.max(6000, ll.alt * 3) : p.kind === 'air' ? 60 : 400, tilt: p.kind === 'air' ? 50 : 0 });
      }
      paintInfo();
    }

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
    root.append(h('div.hud.eye', top, h('div.eyemid', labels, info.el, lay.el, rail), h('div.eyebot', readout, btns)));

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
      if (selected) add(selected.kind === 'air' ? air.world(selected.ref as Aircraft, Date.now()) : selected.w, '◆ TARGET', '#fff');
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
      readout.textContent = `${g.lat.toFixed(3)}° ${g.lon.toFixed(3)}°  ${near && near.km < 400 ? near.city.name.toUpperCase() : ''}\nALT ${mk(alt)} · TILT ${Math.round(c.tilt)}° · HDG ${Math.round((((c.hd % 360) + 360) % 360))}° · ${SENSOR_MODES[globe.mode]![0]}\n${air.list.size} AC · ${sats.list.length} SAT · ${quakes.data?.length ?? 0} EQ`;
      zLabel.textContent = mk(c.range);
      LAYERS.forEach(([k, , f], i) => {
        counts[i]!.textContent = f();
        boxes[i]!.checked = globe.vis[k];
      });
      lay.setStatus(air.status, air.status === 'LIVE' ? 'ok' : air.status === 'STALE' ? 'mid' : 'off');
      paintModes();
      if (selected?.kind === 'air') paintInfo();
    }, 1);

    return {
      enter() {
        quakes.start();
        events.start();
        launches.start();
        const tick = () => void air.refresh(globe.cam.lat, globe.cam.lon, globe.cam.range);
        tick();
        airTimer = window.setInterval(tick, 8000);
        paintModes();
      },
      leave() {
        clearInterval(airTimer);
      },
      describe: () => `God's Eye globe at ${globe.cam.lat.toFixed(2)}, ${globe.cam.lon.toFixed(2)}, ${Math.round(globe.cam.range)} km range, sensor ${SENSOR_MODES[globe.mode]![0]}${selected ? `, selected ${describe(selected)}` : ''}. ${air.list.size} aircraft tracked.`,
    };
  },
};
