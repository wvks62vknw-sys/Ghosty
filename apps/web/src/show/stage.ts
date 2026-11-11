/**
 * THE STAGE (BRIEF-SHOW-ME-1; STARS 164: "he pulls it up immediately and I see it"): the one surface that takes the centre while
 * something is shown. A plate brought to the front in the world's own drawing (`g-plate strong`: Glass is glass, The Scan has its
 * corner marks, ONE INK is two rules), docked above the ask line so the ask line and the house stay and the conversation shrinks
 * above it. Its pictures are drawn by code from data the phone already has: a tile map, God's Eye's globe from the world pack, bars
 * or a line from the reply's own numbers, the reply as a page, a formula's path, boxes in 3-D from parameters.
 *
 * The sentence is never held for it: this is begun after the reply is on screen (show/turn.ts), and a picture with no data is not
 * shown. One at a time. It goes at his next word, on CLOSE, on Escape and when he leaves the screen. Every colour, size, line and
 * duration is a token (styles.css, THE SYSTEM: `#thestage`); a stroke is the world's line, a fill is ink at an alpha.
 */
import { docFromReply } from '../docs/model';
import { World } from '../engine/world';
import { h, svgEl } from '../core/dom';
import { key, tag, truthLine, type TruthPart } from '../ui/machine';
import { triggersIn } from '../assistant/triggers';
import { decideShow, placeAsked, type Show, type ShowFacts } from './decide';
import { figure, type Series } from './chart';
import { faces } from './iso';
import { partBoxes, roomBoxesOf, roomPlanFor, type PartKind } from './parts';
import type { Sim } from './sim';
import { showTrace } from './turn';

/** What the Stage has done, for the checks (window.__ghosty.show.state()). */
export const stageState = {
  /** What the last turn decided: kind, id and, for a thing its own screen drew, `via`. */
  last: null as null | { kind: string; id: string; via?: string; title: string },
  /** What is on the Stage now (a kind), or null. */
  shown: null as null | string,
  /** The drawing's own counts: bars, points, faces, tiles, land rings, path points. */
  drawn: {} as Record<string, number>,
  /** Presented, and why nothing was shown when nothing was. */
  presented: 0,
  why: '',
  closed: '',
};

const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';

let stop: () => void = () => undefined;

/** Take the Stage away (CLOSE, Escape, his next word, leaving the screen). */
export function clearStage(why: string): void {
  stop();
  stop = () => undefined;
  document.getElementById('thestage')?.remove();
  document.body.classList.remove('staged');
  document.body.style.removeProperty('--stageh');
  if (stageState.shown) stageState.closed = why;
  stageState.shown = null;
}

// ---------------------------------------------------------------- the pictures

const W = 360;

/** A figure's text node in the picture's own type. */
function text(x: number, y: number, s: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'start'): SVGTextElement {
  const t = svgEl('text', { x, y, class: `stg-t ${cls}`, 'text-anchor': anchor });
  t.textContent = s;
  return t;
}

/** BARS (or a LINE, when the labels run in time) from the reply's own numbers, the figures written on them. */
function chartPic(s: Series): SVGSVGElement {
  const pts = s.points;
  const hi = Math.max(...pts.map((p) => p.value));
  const lo = Math.min(0, ...pts.map((p) => p.value));
  const span = hi - lo || 1;
  if (s.kind === 'bars') {
    const row = 28;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${pts.length * row + 4}`, class: 'stg-svg', role: 'img', 'aria-label': `Bars: ${pts.map((p) => `${p.label} ${figure(p.value, s)}`).join(', ')}` });
    const x0 = 96;
    const room = W - x0 - 64;
    pts.forEach((p, i) => {
      const y = i * row + 2;
      svg.append(text(0, y + 18, (p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label).toUpperCase(), 'cap'));
      const bx = x0 + (Math.min(0, p.value) - lo) * (room / span);
      svg.append(svgEl('rect', { x: bx, y: y + 4, width: Math.max(2, Math.abs(p.value) * (room / span)), height: 16, class: 'stg-bar', 'data-bar': '1' }));
      svg.append(text(x0 + (Math.max(0, p.value) - lo) * (room / span) + 6, y + 18, figure(p.value, s), 'fig'));
    });
    svg.append(svgEl('line', { x1: x0 + (0 - lo) * (room / span), y1: 0, x2: x0 + (0 - lo) * (room / span), y2: pts.length * row + 4, class: 'stg-axis' }));
    stageState.drawn = { bars: pts.length };
    return svg;
  }
  const H = 190;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stg-svg', role: 'img', 'aria-label': `Line: ${pts.map((p) => `${p.label} ${figure(p.value, s)}`).join(', ')}` });
  const px = (i: number) => 24 + (i * (W - 48)) / Math.max(1, pts.length - 1);
  const py = (v: number) => 30 + (1 - (v - lo) / span) * (H - 76);
  for (let k = 0; k <= 3; k++) svg.append(svgEl('line', { x1: 14, y1: 30 + (k * (H - 76)) / 3, x2: W - 14, y2: 30 + (k * (H - 76)) / 3, class: 'stg-axis' }));
  svg.append(svgEl('polyline', { points: pts.map((p, i) => `${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' '), class: 'stg-line', 'data-line': '1' }));
  const top = pts.reduce((a, p, i) => (p.value > pts[a]!.value ? i : a), 0);
  pts.forEach((p, i) => {
    svg.append(svgEl('circle', { cx: px(i), cy: py(p.value), r: i === top ? 4 : 3, class: `stg-dot${i === top ? ' on' : ''}`, 'data-dot': '1' }));
    if (i === 0 || i === pts.length - 1 || i === top) svg.append(text(px(i), py(p.value) - 9, figure(p.value, s), 'fig', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'));
    if (pts.length <= 7 || i === 0 || i === pts.length - 1 || i === Math.floor(pts.length / 2)) svg.append(text(px(i), H - 8, p.label.slice(0, 7).toUpperCase(), 'cap', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'));
  });
  stageState.drawn = { points: pts.length };
  return svg;
}

/** The orthographic point of (lat, lon) seen from (lat0, lon0): x right, y up, and how far toward the eye it is (above 0: seen). */
function ortho(lat: number, lon: number, lat0: number, lon0: number): [number, number, number] {
  const r = Math.PI / 180;
  const dl = (lon - lon0) * r;
  const cl = Math.cos(lat * r);
  const x = cl * Math.sin(dl);
  const y = Math.cos(lat0 * r) * Math.sin(lat * r) - Math.sin(lat0 * r) * cl * Math.cos(dl);
  const z = Math.sin(lat0 * r) * Math.sin(lat * r) + Math.cos(lat0 * r) * cl * Math.cos(dl);
  return [x, y, z];
}

/** GOD'S EYE's globe, drawn from the world pack on this phone: land, the graticule, the big cities, the place lit at the centre. */
function eyePic(lat0: number, lon0: number, label: string): SVGSVGElement {
  const R = 132;
  const svg = svgEl('svg', { viewBox: `${-W / 2} -150 ${W} 300`, class: 'stg-svg eye', role: 'img', 'aria-label': `God's Eye, centred on ${label}` });
  svg.append(svgEl('circle', { cx: 0, cy: 0, r: R, class: 'stg-disc' }));
  // the graticule, every thirty degrees
  let grat = '';
  for (let lat = -60; lat <= 60; lat += 30) {
    let pen = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const [x, y, z] = ortho(lat, lon, lat0, lon0);
      if (z <= 0) pen = false;
      else {
        grat += `${pen ? 'L' : 'M'}${(x * R).toFixed(1)} ${(-y * R).toFixed(1)}`;
        pen = true;
      }
    }
  }
  for (let lon = -180; lon < 180; lon += 30) {
    let pen = false;
    for (let lat = -90; lat <= 90; lat += 4) {
      const [x, y, z] = ortho(lat, lon, lat0, lon0);
      if (z <= 0) pen = false;
      else {
        grat += `${pen ? 'L' : 'M'}${(x * R).toFixed(1)} ${(-y * R).toFixed(1)}`;
        pen = true;
      }
    }
  }
  svg.append(svgEl('path', { d: grat, class: 'stg-grat' }));
  // the land: each polygon's outer ring, the visible runs only, thinned to about 6,000 points
  let land = '';
  let n = 0;
  let rings = 0;
  const total = World.land.reduce((a, poly) => a + (poly[0]?.length ?? 0) / 2, 0);
  const step = Math.max(1, Math.round(total / 6000));
  for (const poly of World.land) {
    const ring = poly[0];
    if (!ring) continue;
    let pen = false;
    let any = false;
    for (let i = 0; i < ring.length / 2; i += step) {
      const [x, y, z] = ortho(ring[i * 2 + 1]!, ring[i * 2]!, lat0, lon0);
      if (z <= 0) pen = false;
      else {
        land += `${pen ? 'L' : 'M'}${(x * R).toFixed(1)} ${(-y * R).toFixed(1)}`;
        pen = true;
        any = true;
        n++;
      }
    }
    if (any) rings++;
  }
  svg.append(svgEl('path', { d: land, class: 'stg-land', 'data-land': String(rings) }));
  // the biggest cities in sight, small, and the place itself in a reticle
  let cities = 0;
  for (const c of [...World.cities].sort((a, b) => b.pop - a.pop).slice(0, 60)) {
    const [x, y, z] = ortho(c.lat, c.lon, lat0, lon0);
    if (z > 0.1 && Math.hypot(x, y) > 0.04) {
      svg.append(svgEl('circle', { cx: x * R, cy: -y * R, r: 1.6, class: 'stg-city' }));
      cities++;
    }
  }
  svg.append(svgEl('circle', { cx: 0, cy: 0, r: R, class: 'stg-rim' }));
  const g = svgEl('g', { class: 'stg-mark', 'data-centre': '1' });
  g.append(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, class: 'stg-box' }), svgEl('circle', { cx: 0, cy: 0, r: 3, class: 'stg-core' }));
  svg.append(g, text(0, R + 16, label.toUpperCase(), 'cap', 'middle'));
  stageState.drawn = { land: rings, points: n, cities };
  return svg;
}

/** The MAP: OpenStreetMap's own tiles (the card kit's source), the place in a reticle with its pin. */
function mapPic(lat: number, lon: number, z: number, label: string): HTMLElement {
  const TILE = 256;
  const n = 2 ** z;
  const wx = ((lon + 180) / 360) * n;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const wy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
  const cx = Math.floor(wx);
  const cy = Math.floor(wy);
  const layer = h('div.stgtiles');
  let tiles = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ty = cy + dy;
      if (ty < 0 || ty >= n) continue;
      const tx = (((cx + dx) % n) + n) % n;
      const img = h('img', { alt: '', decoding: 'async', draggable: false, src: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png` });
      img.style.left = `${Math.round((cx + dx - wx) * TILE)}px`;
      img.style.top = `${Math.round((cy + dy - wy) * TILE)}px`;
      img.addEventListener('error', () => img.remove());
      layer.append(img);
      tiles++;
    }
  }
  stageState.drawn = { tiles };
  const pin = svgEl('svg', { viewBox: '-20 -20 40 40', class: 'stgpin', 'aria-hidden': 'true' });
  pin.append(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, class: 'stg-box' }), svgEl('circle', { cx: 0, cy: 0, r: 4, class: 'stg-core' }));
  return h('div.stgmap', { role: 'img', 'aria-label': `Map of ${label}` }, layer, pin, h('span.stgattr', '© OpenStreetMap'));
}

/** The reply as a page: its heading, its paragraphs and list items, as the document editor will read it. */
function docPic(title: string, paras: { t: string; text: string }[]): HTMLElement {
  const page = h('div.stgpage', { role: 'img', 'aria-label': 'The document, laid out' }, h('b.stgh', title));
  let i = 0;
  for (const p of paras.filter((x, k) => !(k === 0 && x.text.trim() === title.trim()))) {
    const el = p.t === 'h1' || p.t === 'h2' || p.t === 'h3' ? h('b.stgh', p.text) : p.t === 'ul' || p.t === 'ol' ? h('span.stgli', `${p.t === 'ol' ? `${++i}.` : '–'} ${p.text}`) : h('span.stgp', p.text);
    page.append(el);
  }
  stageState.drawn = { blocks: paras.length + 1 };
  return page;
}

/** A FORMULA RUN: the solver's path drawn true to scale and run once (still with Reduce Motion), a tap runs it again. */
function simPic(sim: Sim): { el: SVGSVGElement; stop: () => void } {
  const H = 210;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stg-svg sim', role: 'img', 'aria-label': `${sim.title}: the path` });
  const xs = sim.path.map((p) => p.x);
  const ys = sim.path.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;
  const box = { l: 18, r: W - 18, t: 18, b: H - 30 };
  // true to scale (a flight and an orbit are shapes); a fall's two axes are different things and fill the box
  const eq = sim.kind !== 'fall';
  const k = eq ? Math.min((box.r - box.l) / spanX, (box.b - box.t) / spanY) : 0;
  const mx = (x: number) => box.l + (eq ? (x - x0) * k + ((box.r - box.l) - spanX * k) / 2 : ((x - x0) / spanX) * (box.r - box.l));
  const my = (y: number) => (eq ? box.b - (y - y0) * k - ((box.b - box.t) - spanY * k) / 2 : box.b - ((y - y0) / spanY) * (box.b - box.t));
  const pts = sim.path.map((p) => `${mx(p.x).toFixed(1)},${my(p.y).toFixed(1)}`);
  svg.append(svgEl('line', { x1: box.l, y1: box.b, x2: box.r, y2: box.b, class: 'stg-axis' }));
  if (sim.kind === 'orbit') svg.append(svgEl('circle', { cx: mx(0), cy: my(0), r: 3, class: 'stg-core' }));
  const path = svgEl('polyline', { points: pts.join(' '), class: 'stg-line', pathLength: 1, 'data-path': String(sim.path.length) });
  const dot = svgEl('circle', { r: 5, class: 'stg-dot on', cx: pts[0]!.split(',')[0]!, cy: pts[0]!.split(',')[1]! });
  svg.append(path, dot, text(box.l, H - 8, sim.axes.x, 'cap'), text(box.r, H - 8, sim.axes.y.toUpperCase(), 'cap', 'end'));
  let raf = 0;
  const play = () => {
    cancelAnimationFrame(raf);
    const last = sim.path.length - 1;
    const place = (f: number) => {
      const p = pts[Math.min(last, Math.round(f * last))]!.split(',');
      dot.setAttribute('cx', p[0]!);
      dot.setAttribute('cy', p[1]!);
      path.style.strokeDasharray = '1';
      path.style.strokeDashoffset = String(1 - f);
    };
    if (still()) return place(1);
    const ms = Math.max(1800, Math.min(5200, sim.seconds * 800));
    const t0 = performance.now();
    const tick = (t: number) => {
      const f = Math.max(0, Math.min(1, (t - t0) / ms));
      place(f);
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  svg.addEventListener('click', play);
  play();
  stageState.drawn = { path: sim.path.length };
  return { el: svg, stop: () => cancelAnimationFrame(raf) };
}

/** BOXES IN 3-D from parameters: turns by drag, slowly by itself (still with Reduce Motion). */
function isoPic(boxes: ReturnType<typeof partBoxes>, room: boolean, label: string): { el: SVGSVGElement; stop: () => void } {
  const svg = svgEl('svg', { viewBox: '-180 -160 360 320', class: 'stg-svg iso', role: 'img', 'aria-label': `${label}, in 3-D: drag to turn` });
  const g = svgEl('g', {});
  svg.append(g);
  let yaw = 0.7;
  let pause = 0;
  const radius = faces(boxes, 0, 0.5, room).radius;
  const scale = (room ? 150 : 128) / radius;
  const draw = () => {
    const { faces: fs } = faces(boxes, yaw, 0.5, room);
    const nodes: SVGElement[] = fs.map((f) => {
      const p = svgEl('polygon', { points: f.pts.map((q) => `${(q[0] * scale).toFixed(1)},${(q[1] * scale).toFixed(1)}`).join(' '), class: `stg-face ${f.kind}`, 'fill-opacity': (f.kind === 'floor' ? 0.06 + f.shade * 0.08 : 0.1 + f.shade * 0.34).toFixed(2) });
      return p;
    });
    g.replaceChildren(...nodes);
    stageState.drawn = { faces: fs.length, boxes: boxes.length };
  };
  draw();
  let raf = 0;
  let lastT = 0;
  const spin = (t: number) => {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (t > pause) {
      yaw += dt * 0.28;
      draw();
    }
    raf = requestAnimationFrame(spin);
  };
  if (!still()) raf = requestAnimationFrame(spin);
  let down: { x: number; yaw: number } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, yaw };
    svg.setPointerCapture?.(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!down) return;
    yaw = down.yaw + (e.clientX - down.x) * 0.012;
    pause = performance.now() + 2500;
    draw();
  });
  const up = () => (down = null);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  return { el: svg, stop: () => cancelAnimationFrame(raf) };
}

// ---------------------------------------------------------------- the Stage

/** OPEN: the full screen for what the Stage shows (the map sheet, God's Eye, the document editor, the Workbench, the Studio). */
async function open(show: Show, facts: ShowFacts): Promise<void> {
  const { run } = await import('../commands/registry');
  if (show.kind === 'map') return void (await run('show_map', { place: show.label, lat: show.lat, lon: show.lon, zoom: show.zoom }));
  if (show.kind === 'eye') {
    const { perform } = await import('../shell/launcher');
    perform({ open: 'eye' });
    const { globe } = await import('../engine/globe');
    setTimeout(() => globe.cam.flyTo({ lat: show.lat, lon: show.lon, range: 500, tilt: 0 }), 400);
    return;
  }
  if (show.kind === 'document') return void (await run('open_docs', { doc: docFromReply(facts.reply, facts.ask, { name: facts.me?.name }) }));
  if (show.kind === 'simulation') {
    const { parseProblem, PANEL_OF } = await import('../../../../packages/shared/src/workbench');
    const { openWorkbench } = await import('../features/workbench/index');
    const p = parseProblem(facts.ask);
    if (p) openWorkbench(PANEL_OF[p.kind], p);
    return;
  }
  // a room or a part opens in the 3-D engine, as a scene he can build on (BRIEF-ENGINE-3D-1)
  const { sceneFromPart, sceneFromRoom } = await import('../engine3d/ask');
  if (show.kind === 'room' && show.room) await run('open_studio', { engine: sceneFromRoom(show.room), title: show.title });
  else if (show.kind === 'part' && show.part) await run('open_studio', { engine: sceneFromPart(show.part.kind, show.part.dims, show.part.name), title: show.title });
}

/** Where the Stage sits: above the ask line (or the dock), with the conversation shrunk above it. */
function place(el: HTMLElement): void {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const bar = [...document.querySelectorAll<HTMLElement>('#cbar, #dock .houseask, #dock')].find((b) => b.getClientRects().length && b.getBoundingClientRect().height > 0);
  const top = bar ? bar.getBoundingClientRect().top : vh - 16;
  const bottom = Math.max(8, vh - top + 8);
  const head = 64;
  const hgt = Math.max(240, Math.min(560, vh * 0.6, vh - bottom - head));
  el.style.setProperty('--stage-bottom', `${Math.round(bottom)}px`);
  el.style.setProperty('--stage-h', `${Math.round(hgt)}px`);
  // (a chart or a page is as tall as it is: the conversation above it is shrunk by what it really takes)
  document.body.style.setProperty('--stageh', `${Math.round(bottom + Math.min(hgt, el.getBoundingClientRect().height || hgt) + 10)}px`);
  // (the conversation is shrunk above the Stage: its latest words stay in sight)
  setTimeout(() => document.querySelectorAll<HTMLElement>('.hud.core.logopen .log').forEach((l) => (l.scrollTop = l.scrollHeight)), 60);
}

/** The city of the world pack his words name: its own name exactly, else its start (four letters at least). */
function cityNamed(name: string): { name: string; lat: number; lon: number; country: string } | null {
  const q = name.toLowerCase().trim();
  const hit = World.cities.find((c) => c.name.toLowerCase() === q) ?? (q.length >= 4 ? World.cities.filter((c) => c.name.toLowerCase().startsWith(q)).sort((a, b) => b.pop - a.pop)[0] : undefined);
  return hit ? { name: hit.name, lat: hit.lat, lon: hit.lon, country: hit.country } : null;
}

/** Mount a decided show on the Stage. */
function mount(show: Exclude<Show, { via: 'its screen' }>, facts: ShowFacts): void {
  clearStage('replaced');
  let pic: Node;
  const stops: (() => void)[] = [];
  const truth: TruthPart[][] = [show.truth];
  switch (show.kind) {
    case 'chart':
      pic = chartPic(show.series);
      break;
    case 'eye':
      pic = eyePic(show.lat, show.lon, show.label);
      break;
    case 'map':
      pic = mapPic(show.lat, show.lon, show.zoom, show.label);
      break;
    case 'document':
      pic = docPic(show.title, show.paragraphs);
      break;
    case 'simulation': {
      const s = simPic(show.sim);
      pic = s.el;
      stops.push(s.stop);
      truth.push(show.sim.lines.slice(0, 3).map((l) => ({ text: `${l.label} ${l.value}`, tone: 'strong' as const })));
      break;
    }
    case 'room':
    case 'part': {
      let boxes;
      if (show.kind === 'room' && show.room) {
        const plan = roomPlanFor(show.room);
        boxes = roomBoxesOf(plan, plan.items!.map((i) => (i as unknown as { kind: PartKind }).kind)).boxes;
      } else boxes = partBoxes(show.part!.kind, show.part!.dims);
      const s = isoPic(boxes, show.kind === 'room', show.title);
      pic = s.el;
      stops.push(s.stop);
      if (show.kind === 'room' && show.room) truth.push([show.room.things.length ? show.room.things.map((t) => `${t.n} ${t.kind}`).join(' · ').toUpperCase() : 'AN EMPTY ROOM'].map((x) => ({ text: x, tone: 'strong' as const })));
      break;
    }
  }
  const el = h('section#thestage.g-plate.strong', { dataset: { kind: show.kind, id: show.id }, role: 'region', 'aria-label': `Shown: ${show.title}` });
  const close = () => clearStage('closed');
  const openable = show.kind !== 'chart';
  el.append(
    h('div.stghead', tag(`SHOWING · ${show.tag}`, { tone: 'on' }), h('b.stgtitle', show.title)),
    h('div.stgpic', pic),
    ...truth.map((t) => truthLine(t)),
    h('div.stgkeys', openable ? key('OPEN', () => void open(show, facts), { label: `Open ${show.title}` }) : null, key('CLOSE', close, { kind: 'ghost', label: 'Close' })),
  );
  document.body.append(el);
  document.body.classList.add('staged');
  place(el);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const onResize = () => place(el);
  const onHash = () => clearStage('left the screen');
  document.addEventListener('keydown', onKey);
  window.visualViewport?.addEventListener('resize', onResize);
  addEventListener('hashchange', onHash);
  stop = () => {
    stops.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    window.visualViewport?.removeEventListener('resize', onResize);
    removeEventListener('hashchange', onHash);
  };
  stageState.shown = show.kind;
  stageState.closed = '';
  showTrace.order.push('stage');
}

/**
 * The reply is on screen: decide the thing and put it on the Stage. Everything the phone needs that is not at hand (the world pack,
 * his saved places) is fetched here, after the sentence, so the sentence never waits.
 */
export async function present(f: Pick<ShowFacts, 'ask' | 'reply' | 'tools' | 'clients' | 'cards' | 'brain'>): Promise<Show | null> {
  const delay = (window as unknown as { __ghostyShowDelay?: number }).__ghostyShowDelay;
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const { known } = await import('../features/core/cards');
  const kn = await known(0).catch(() => ({ places: [], people: [], cars: [] }));
  const places = kn.places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => ({ label: p.label, lat: p.lat, lon: p.lon }));
  const hit = triggersIn(f.ask, kn).find((x) => x.row === 'place');
  const mentioned = hit && hit.row === 'place' && Number.isFinite(hit.place.lat) ? { label: hit.place.label, lat: hit.place.lat, lon: hit.place.lon } : undefined;
  // the world pack is read only for a place asked by name (it is the phone's own gazetteer: no request but its own file)
  if (placeAsked(f.ask) && !World.ready) await World.load();
  const { chat } = await import('../assistant/session');
  const replyAt = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant')?.at;
  const { settings } = await import('../state/app');
  const facts: ShowFacts = { ...f, places, mentioned, city: World.ready ? cityNamed : undefined, replyAt, me: { name: settings.get().name } };
  const show = decideShow(facts);
  stageState.last = show ? { kind: show.kind, id: show.id, ...('via' in show && show.via ? { via: show.via } : {}), title: show.title } : null;
  stageState.why = show ? ('via' in show && show.via ? 'its own screen drew it' : '') : 'nothing in the answer to show';
  stageState.presented++; // (counted once its verdict and its reason are both in place: a reader never sees the count moved with the last turn's reason)
  if (!show) return null;
  if ('via' in show && show.via) return show;
  mount(show as Exclude<Show, { via: 'its screen' }>, facts);
  return show;
}
