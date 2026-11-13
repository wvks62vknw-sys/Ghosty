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
import { type Series } from './chart';
import { chartPic } from './chartpic';
import { faces, type Pt } from './iso';
import { countryPic, mapPic } from './mappic';
import { lengthIn, partBoxes, roomBoxesOf, roomPlanFor, type PartKind, type Shown } from './parts';
import { dialsOf, simWith, type Sim } from './sim';
import { showTrace } from './turn';
import { waiting } from '../ui/wait';

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
  /** ms from the data arriving (present) to the picture's first paint, and what came after it: mounted, painted, pointed. */
  paintMs: 0,
  marks: [] as string[],
  /** How many times "offline map" was said on the Stage (once, or none). */
  offlineSaid: 0,
  /** The waiting line the map said before its first paint. */
  waitLine: '',
  /** Where the sentence stood when the room was reserved and after the Stage rose (its top), for the check that it did not move. */
  reserved: '',
};

const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';

let stop: () => void = () => undefined;

/** The room the Stage takes at the foot of the conversation: where it sits and how tall it is (the same numbers reserve it and place it). */
function stageBox(): { bottom: number; hgt: number } {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const bar = [...document.querySelectorAll<HTMLElement>('#cbar, #dock .houseask, #dock')].find((b) => b.getClientRects().length && b.getBoundingClientRect().height > 0);
  const top = bar ? bar.getBoundingClientRect().top : vh - 16;
  const bottom = Math.max(8, vh - top + 8);
  const head = 64;
  return { bottom, hgt: Math.max(240, Math.min(560, vh * 0.6, vh - bottom - head)) };
}

let reservedFor = 0;

/**
 * His words promise a picture (a room, a desk, a letter, a place, a formula): its room is taken from the conversation at once, so
 * the sentence lands where it will stay and the Stage rises under it without moving it. A wrong promise hands the room back.
 */
export function reserve(kind: string): void {
  if (document.querySelector('#thestage:not(.leaving)') || !document.querySelector('.hud.core.logopen')) return;
  const b = stageBox();
  document.body.classList.add('staged');
  document.body.style.setProperty('--stageh', `${Math.round(b.bottom + b.hgt + 10)}px`);
  stageState.reserved = kind;
  // the conversation keeps to its end at its new size, so the reply that follows is followed and lands in sight, in the place it will stay
  for (const log of document.querySelectorAll<HTMLElement>('.hud.core.logopen .log')) log.scrollTop = log.scrollHeight;
  const mine = ++reservedFor;
  // (a reply that never comes: the room is handed back, quietly)
  setTimeout(() => mine === reservedFor && !document.querySelector('#thestage:not(.leaving)') && releaseRoom(), 25000);
}

/** Hand the reserved room back to the conversation (it eases open: the Stage's own easing). */
export function releaseRoom(): void {
  if (document.querySelector('#thestage:not(.leaving)')) return;
  document.body.classList.remove('staged');
  document.body.style.removeProperty('--stageh');
  stageState.reserved = '';
}

/** Take the Stage away (CLOSE, Escape, his next word, leaving the screen): it leaves as quietly as it came. */
export function clearStage(why: string): void {
  stop();
  stop = () => undefined;
  const el = document.getElementById('thestage');
  if (el) {
    if (why === 'replaced' || why === 'check' || still()) el.remove();
    else if (!el.classList.contains('leaving')) {
      // (it keeps its place for the length of its leaving; a newer Stage takes it away at once. ORBIT: giving the Stage back is the orb
      // shrinking again, the same slow tide run backwards, so it stays for the tide's length)
      const orbit = document.documentElement.dataset.world === 'orbit';
      el.classList.add('leaving');
      if (orbit) {
        el.dataset.leaving = 'true';
        el.setAttribute('aria-hidden', 'true');
      }
      setTimeout(() => el.remove(), orbit ? 960 : 360);
    }
  }
  if (why !== 'replaced') {
    document.body.classList.remove('staged');
    document.body.style.removeProperty('--stageh');
    stageState.reserved = '';
  }
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

/** The reply as a page: its heading, its paragraphs and list items, set as a page with margins in the system's reading type. */
function docPic(title: string, paras: { t: string; text: string }[]): HTMLElement {
  const page = h('div.stgpage.paper', { role: 'img', 'aria-label': 'The document, laid out as a page' }, h('b.stgh', title));
  let i = 0;
  for (const p of paras.filter((x, k) => !(k === 0 && x.text.trim() === title.trim()))) {
    const el = p.t === 'h1' || p.t === 'h2' || p.t === 'h3' ? h('b.stgh', p.text) : p.t === 'ul' || p.t === 'ol' ? h('span.stgli', `${p.t === 'ol' ? `${++i}.` : '–'} ${p.text}`) : p.t === 'right' ? h('span.stgp.right', p.text) : p.t === 'quote' ? h('span.stgp.quote', p.text) : h('span.stgp', p.text);
    page.append(el);
  }
  stageState.drawn = { blocks: paras.length + 1 };
  return page;
}

/** A FORMULA RUN: the solver's path drawn true to scale and run once (still with Reduce Motion), a tap runs it again; `set` draws it again for a new answer. */
function simPic(first: Sim): { el: SVGSVGElement; stop: () => void; set: (s: Sim) => void } {
  const H = 210;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stg-svg sim', role: 'img', 'aria-label': `${first.title}: the path` });
  let sim = first;
  const box = { l: 18, r: W - 18, t: 18, b: H - 30 };
  const path = svgEl('polyline', { class: 'stg-line', pathLength: 1 });
  const dot = svgEl('circle', { r: 5, class: 'stg-dot on' });
  const base = svgEl('line', { x1: box.l, y1: box.b, x2: box.r, y2: box.b, class: 'stg-axis' });
  const core = svgEl('circle', { r: 3, class: 'stg-core' });
  const capX = text(box.l, H - 8, '', 'cap');
  const capY = text(box.r, H - 8, '', 'cap', 'end');
  svg.append(base, core, path, dot, capX, capY);
  let pts: string[] = [];
  let raf = 0;
  const lay = () => {
    const xs = sim.path.map((p) => p.x);
    const ys = sim.path.map((p) => p.y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const spanX = x1 - x0 || 1;
    const spanY = y1 - y0 || 1;
    // true to scale (a flight and an orbit are shapes); a fall's two axes are different things and fill the box
    const eq = sim.kind !== 'fall';
    const k = eq ? Math.min((box.r - box.l) / spanX, (box.b - box.t) / spanY) : 0;
    const mx = (x: number) => box.l + (eq ? (x - x0) * k + ((box.r - box.l) - spanX * k) / 2 : ((x - x0) / spanX) * (box.r - box.l));
    const my = (y: number) => (eq ? box.b - (y - y0) * k - ((box.b - box.t) - spanY * k) / 2 : box.b - ((y - y0) / spanY) * (box.b - box.t));
    pts = sim.path.map((p) => `${mx(p.x).toFixed(1)},${my(p.y).toFixed(1)}`);
    path.setAttribute('points', pts.join(' '));
    path.setAttribute('data-path', String(sim.path.length));
    core.setAttribute('cx', String(mx(0)));
    core.setAttribute('cy', String(my(0)));
    core.style.display = sim.kind === 'orbit' ? '' : 'none';
    capX.textContent = sim.axes.x;
    capY.textContent = sim.axes.y.toUpperCase();
    svg.setAttribute('aria-label', `${sim.title}: the path`);
    stageState.drawn = { path: sim.path.length };
  };
  const place = (f: number) => {
    const last = sim.path.length - 1;
    const p = pts[Math.min(last, Math.round(f * last))]!.split(',');
    dot.setAttribute('cx', p[0]!);
    dot.setAttribute('cy', p[1]!);
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = String(1 - f);
  };
  const play = () => {
    cancelAnimationFrame(raf);
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
  lay();
  play();
  return {
    el: svg,
    stop: () => cancelAnimationFrame(raf),
    set: (s2) => {
      // a dial moved: the new path is drawn whole at once (the answer is the point, not the show)
      cancelAnimationFrame(raf);
      sim = s2;
      lay();
      place(1);
    },
  };
}

/** The sizes written on the edges, in the unit he used, and the part named where it is: placed again on every turn. */
interface Sizes {
  unit: Shown;
  /** Width, depth and height in cm. */
  w: number;
  d: number;
  h: number;
  /** What stands in it, named at the top of each: world metres. */
  names: { name: string; at: [number, number, number] }[];
}

/** BOXES IN 3-D from parameters: lit from above and to the left with a soft shadow on its ground, its sizes on its edges, turning slowly until he touches it. */
function isoPic(boxes: ReturnType<typeof partBoxes>, room: boolean, label: string, sizes: Sizes): { el: SVGSVGElement; stop: () => void } {
  const svg = svgEl('svg', { viewBox: '-180 -180 360 360', class: 'stg-svg iso', role: 'img', 'aria-label': `${label}, in 3-D: drag to turn` });
  const defs = svgEl('defs', {});
  const blur = svgEl('filter', { id: 'stgsoft', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  blur.append(svgEl('feGaussianBlur', { stdDeviation: '4' }));
  defs.append(blur);
  const g = svgEl('g', {});
  svg.append(defs, g);
  let yaw = 0.7;
  let touched = false;
  // the picture fills the Stage at every turn: the scale is the one at which the widest and tallest of a whole turn (ground, walls, shadow) still fit
  let fitX = 1;
  let fitY = 1;
  for (let k = 0; k < 16; k++) {
    const sw = faces(boxes, (k * Math.PI) / 8, 0.5, room);
    for (const q of [...sw.scene.ground, ...(sw.scene.shadow ?? []), ...sw.faces.flatMap((f) => f.pts)]) {
      fitX = Math.max(fitX, Math.abs(q[0]));
      fitY = Math.max(fitY, Math.abs(q[1]));
    }
  }
  const scale = Math.min(196 / fitX, 170 / fitY);
  const sc = (p: Pt): Pt => [p[0] * scale, p[1] * scale];
  const poly = (pts: Pt[], cls: string, extra: Record<string, string | number> = {}) => svgEl('polygon', { points: pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '), class: cls, ...extra });
  const clampP = (p: Pt): Pt => [Math.max(-168, Math.min(168, p[0])), Math.max(-166, Math.min(170, p[1]))];
  const draw = () => {
    const { faces: fs, scene } = faces(boxes, yaw, 0.5, room);
    const nodes: SVGElement[] = [];
    // the ground it stands on, then its shadow (soft, thrown away from the light), then the faces
    nodes.push(poly(scene.ground.map(sc), 'stg-ground'));
    if (scene.shadow) nodes.push(poly(scene.shadow.map(sc), 'stg-shadow', { filter: 'url(#stgsoft)' }));
    for (const f of fs) nodes.push(poly(f.pts.map(sc), `stg-face ${f.kind}`, { 'fill-opacity': (f.kind === 'floor' ? 0.06 + f.shade * 0.08 : 0.1 + f.shade * 0.34).toFixed(2) }));
    // the sizes, written on the three edges nearest the eye: the front's width, the side's depth, the corner's height
    const { x0, x1, z0, z1, y0, y1 } = scene.foot;
    const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const depth = corners.map(([x, z]) => scene.depthOf([x, y0, z]));
    const near = depth.indexOf(Math.max(...depth));
    const centre = sc(scene.project([(x0 + x1) / 2, y0, (z0 + z1) / 2]));
    const tag = (a: [number, number], b: [number, number], v: number, cls: string) => {
      const m = sc(scene.project([(a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2]));
      let dx = m[0] - centre[0];
      let dy = m[1] - centre[1];
      const n = Math.hypot(dx, dy) || 1;
      dx /= n;
      dy /= n;
      const at = clampP([m[0] + dx * 18, m[1] + dy * 18 + 4]);
      const t = text(at[0], at[1], lengthIn(v, sizes.unit), `cap dim ${cls}`, at[0] > m[0] + 4 ? 'start' : at[0] < m[0] - 4 ? 'end' : 'middle');
      nodes.push(t);
    };
    for (const j of [(near + 1) % 4, (near + 3) % 4]) {
      const a = corners[near]!;
      const b = corners[j]!;
      // the edge along x is as wide as the thing, the other as deep
      tag(a, b, a[1] === b[1] ? sizes.w : sizes.d, 'edge');
    }
    const base = sc(scene.project([corners[near]![0], y0, corners[near]![1]]));
    const top = sc(scene.project([corners[near]![0], y1, corners[near]![1]]));
    const hm: Pt = [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2];
    const side = hm[0] >= centre[0] ? 1 : -1;
    const hp = clampP([hm[0] + side * 16, hm[1] + 4]);
    nodes.push(text(hp[0], hp[1], lengthIn(sizes.h, sizes.unit), 'cap dim edge', side > 0 ? 'start' : 'end'));
    // a part named where it is (two names that would touch stand a line apart)
    const placed: Pt[] = [];
    for (const n of [...sizes.names].sort((a, b) => scene.project(a.at)[1] - scene.project(b.at)[1])) {
      const p = clampP(sc(scene.project(n.at)));
      let y = p[1] - 6;
      for (const q of placed) if (Math.abs(q[0] - p[0]) < 64 && Math.abs(q[1] - y) < 13) y = q[1] + 13;
      placed.push([p[0], y]);
      nodes.push(text(p[0], y, n.name.toUpperCase(), 'cap partname', 'middle'));
    }
    g.replaceChildren(...nodes);
    svg.dataset.yaw = yaw.toFixed(4);
    stageState.drawn = { faces: fs.length, boxes: boxes.length };
  };
  draw();
  let raf = 0;
  let lastT = 0;
  const spin = (t: number) => {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (!touched) {
      yaw += dt * 0.28;
      draw();
    }
    raf = requestAnimationFrame(spin);
  };
  if (!still()) raf = requestAnimationFrame(spin);
  let down: { x: number; yaw: number } | null = null;
  // a touch stops the turn and it stays stopped: he has the room in his hand now
  svg.addEventListener('pointerdown', (e) => {
    touched = true;
    down = { x: e.clientX, yaw };
    svg.setPointerCapture?.(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!down) return;
    yaw = down.yaw + (e.clientX - down.x) * 0.012;
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
  const { bottom, hgt } = stageBox();
  el.style.setProperty('--stage-bottom', `${Math.round(bottom)}px`);
  el.style.setProperty('--stage-h', `${Math.round(hgt)}px`);
  // ORBIT: it grows from where the orb is (Home's, at the centre of its sky, or the line's at the foot of the screen)
  if (document.documentElement.dataset.world === 'orbit') {
    const orb = [...document.querySelectorAll<HTMLElement>('body.orbithome .orbhost, #dock .orbbtn')].find((o) => o.getClientRects().length);
    const r = orb?.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (r && r.width) {
      el.style.setProperty('--orb-x', `${Math.round(r.left + r.width / 2 - e.left)}px`);
      el.style.setProperty('--orb-y', `${Math.round(r.top + r.height / 2 - e.top)}px`);
    }
  }
  // (a chart is as tall as it is: the conversation above it is shrunk by what it really takes)
  document.body.style.setProperty('--stageh', `${Math.round(bottom + Math.min(hgt, el.getBoundingClientRect().height || hgt) + 10)}px`);
  // (the conversation is shrunk above the Stage: its latest words stay in sight; the sentence moves only when it would be covered)
  setTimeout(() => keepSentence(), 60);
}

/** The reply's last sentence stays above the Stage: the log scrolls by what it must, and not at all when it is already clear. */
function keepSentence(): void {
  const stage = document.getElementById('thestage');
  if (!stage) return;
  const top = stage.getBoundingClientRect().top;
  for (const log of document.querySelectorAll<HTMLElement>('.hud.core.logopen .log')) {
    const last = [...log.querySelectorAll<HTMLElement>('.msg:not(.me)')].pop();
    if (!last) continue;
    const over = last.getBoundingClientRect().bottom - (top - 8);
    if (over > 0) log.scrollTop += over;
  }
}

/** The city of the world pack his words name: its own name exactly, else its start (four letters at least). */
function cityNamed(name: string): { name: string; lat: number; lon: number; country: string } | null {
  const q = name.toLowerCase().trim();
  const hit = World.cities.find((c) => c.name.toLowerCase() === q) ?? (q.length >= 4 ? World.cities.filter((c) => c.name.toLowerCase().startsWith(q)).sort((a, b) => b.pop - a.pop)[0] : undefined);
  return hit ? { name: hit.name, lat: hit.lat, lon: hit.lon, country: hit.country } : null;
}

/** Mount a decided show on the Stage. `t0` is when the data arrived: the first paint is measured from it. */
function mount(show: Exclude<Show, { via: 'its screen' }>, facts: ShowFacts, t0: number): void {
  clearStage('replaced');
  let pic: Node;
  const stops: (() => void)[] = [];
  const truth: TruthPart[][] = [show.truth];
  let relayout: (() => void) | null = null;
  let answerEl: HTMLElement | null = null;
  const marks = (stageState.marks = ['mounted']);
  // (the picture's first paint, said once; the pointing line is set a frame after it and never before)
  let el: HTMLElement | null = null;
  const painted = () => {
    if (marks.includes('painted')) return;
    marks.push('painted');
    stageState.paintMs = Math.round(performance.now() - t0);
    requestAnimationFrame(() => {
      if (!el || !el.isConnected) return;
      el.dataset.pointed = '1';
      marks.push('pointed');
    });
  };
  const count = (n: Record<string, number>) => (stageState.drawn = { ...(stageState.drawn.offline ? stageState.drawn : {}), ...n });
  switch (show.kind) {
    case 'chart': {
      const c = chartPic(show.series, (n) => (stageState.drawn = n), () => Math.max(200, stageBox().hgt - 204));
      pic = c.el;
      relayout = c.relayout;
      break;
    }
    case 'eye': {
      // a city of a country is that country's outline with the city lit; a place with no country is the globe, as before
      const known = show.country && World.ready && World.cities.some((c) => c.country === show.country);
      pic = known ? countryPic(show.lat, show.lon, show.label, show.country!, (n) => (stageState.drawn = n)) : eyePic(show.lat, show.lon, show.label);
      break;
    }
    case 'map':
      pic = mapPic(show.lat, show.lon, show.zoom, show.label, { painted, count, offlineSaid: () => stageState.offlineSaid++ });
      stageState.waitLine = (pic as HTMLElement).querySelector('.stgwait')?.textContent ?? '';
      break;
    case 'document':
      pic = docPic(show.title, show.paragraphs);
      break;
    case 'simulation': {
      const s = simPic(show.sim);
      const answer = h('div.stganswer', { dataset: { answer: '1' } });
      const said = (sim: Sim) => answer.replaceChildren(truthLine(sim.lines.slice(0, 3).map((l) => ({ text: `${l.label} ${l.value}`, tone: 'strong' as const }))));
      said(show.sim);
      // the variables as dials, with their units; the answer line is said again as one moves
      const dials = h('div.stgdials');
      let sim = show.sim;
      for (const d of dialsOf(show.sim)) {
        const out = h('output.stgdial-v', `${d.value} ${d.unit}`);
        const input = h('input', { type: 'range', min: d.min, max: d.max, step: d.step, value: String(d.value), 'aria-label': `${d.label}, ${d.unit}`, dataset: { dial: d.key } });
        input.addEventListener('input', () => {
          const v = Number(input.value);
          out.textContent = `${v} ${d.unit}`;
          const next = simWith(sim, d.key, v);
          if (!next) {
            answer.replaceChildren(truthLine([{ text: 'No answer for that one', tone: 'warn' as const }]));
            return;
          }
          sim = next;
          s.set(next);
          said(next);
          const t = el?.querySelector('.stgtitle');
          if (t) t.textContent = next.title;
        });
        dials.append(h('label.stgdial', h('span.stgdial-k', d.label), input, out));
      }
      pic = h('div.stgsim', s.el, dials);
      answerEl = answer;
      stops.push(s.stop);
      break;
    }
    case 'room':
    case 'part': {
      let boxes;
      let sizes: Sizes;
      if (show.kind === 'room' && show.room) {
        const plan = roomPlanFor(show.room);
        const kinds = plan.items!.map((i) => (i as unknown as { kind: PartKind }).kind);
        boxes = roomBoxesOf(plan, kinds).boxes;
        const W2 = plan.room.w / 100;
        const D2 = plan.room.d / 100;
        sizes = {
          unit: show.room.unit,
          w: show.room.w,
          d: show.room.d,
          h: plan.room.h ?? 240,
          names: plan.items!.map((it) => ({ name: it.name, at: [it.x / 100 + it.w / 200 - W2 / 2, (it.h ?? 75) / 100, it.y / 100 + it.d / 200 - D2 / 2] as [number, number, number] })),
        };
      } else {
        boxes = partBoxes(show.part!.kind, show.part!.dims);
        sizes = { unit: show.part!.unit, w: show.part!.dims.w, d: show.part!.dims.d, h: show.part!.dims.h, names: [{ name: show.part!.name, at: [0, show.part!.dims.h / 100, 0] }] };
      }
      const s = isoPic(boxes, show.kind === 'room', show.title, sizes);
      pic = s.el;
      stops.push(s.stop);
      if (show.kind === 'room' && show.room) truth.push([show.room.things.length ? show.room.things.map((t) => `${t.n} ${t.kind}`).join(' · ').toUpperCase() : 'AN EMPTY ROOM'].map((x) => ({ text: x, tone: 'strong' as const })));
      break;
    }
  }
  // (ORBIT: a map, a globe, a chart or a simulation is a sphere grown from the orb; a document, a room or a part is a rounded page with the same lit rim)
  const shape = show.kind === 'map' || show.kind === 'eye' || show.kind === 'chart' || show.kind === 'simulation' ? 'sphere' : 'page';
  el = h('section#thestage.g-plate.strong', { dataset: { kind: show.kind, id: show.id, shape }, role: 'region', 'aria-label': `Shown: ${show.title}` });
  const close = () => clearStage('closed');
  const openable = show.kind !== 'chart';
  el.append(
    h('div.stghead', tag(`SHOWING · ${show.tag}`, { tone: 'on' }), h('b.stgtitle', show.title)),
    h('div.stgpic', pic),
    ...truth.map((t) => truthLine(t)),
    ...(answerEl ? [answerEl] : []),
    h('div.stgkeys', openable ? key('OPEN', () => void open(show, facts), { label: `Open ${show.title}` }) : null, key('CLOSE', close, { kind: 'ghost', label: 'Close' })),
  );
  document.body.append(el);
  document.body.classList.add('staged');
  place(el);
  relayout?.();
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const onResize = () => {
    place(el!);
    relayout?.();
  };
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
  stageState.offlineSaid = 0;
  showTrace.order.push('stage');
  // every kind but the map paints at once (a frame after it is in); the map paints at its first tile or its offline drawing
  if (show.kind !== 'map') requestAnimationFrame(() => requestAnimationFrame(painted));
}

type Known = Awaited<ReturnType<typeof import('../features/core/cards').known>>;
/** His saved places and people, asked for when his word is sent (the answer takes seconds; this is ready long before it): the picture then waits for nothing of its own. */
let early: Promise<Known | null> | null = null;
export function prefetch(): void {
  early = import('../features/core/cards').then((c) => c.known(0)).catch(() => null);
}

/**
 * The reply is on screen: decide the thing and put it on the Stage. Everything the phone needs that is not at hand (the world pack,
 * his saved places) is fetched here, after the sentence, so the sentence never waits.
 */
export async function present(f: Pick<ShowFacts, 'ask' | 'reply' | 'tools' | 'clients' | 'cards' | 'brain'>): Promise<Show | null> {
  // Drawing it…: said under the sentence while the picture is on its way (the world pack, his places), gone when it lands or there is none
  const logHost = document.querySelector<HTMLElement>('.hud.core .log') ?? document.querySelector<HTMLElement>('#log') ?? document.body;
  const drawn = waiting(logHost, 'Drawing it…');
  try {
    return await presentNow(f);
  } finally {
    drawn();
  }
}

async function presentNow(f: Pick<ShowFacts, 'ask' | 'reply' | 'tools' | 'clients' | 'cards' | 'brain'>): Promise<Show | null> {
  const t0 = performance.now();
  const delay = (window as unknown as { __ghostyShowDelay?: number }).__ghostyShowDelay;
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const asked = early ?? import('../features/core/cards').then((c) => c.known(0)).catch(() => null);
  early = null;
  const kn = (await asked) ?? { places: [], people: [], cars: [] };
  const places = kn.places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => ({ label: p.label, lat: p.lat, lon: p.lon }));
  const hit = triggersIn(f.ask, kn).find((x) => x.row === 'place');
  const mentioned = hit && hit.row === 'place' && Number.isFinite(hit.place.lat) ? { label: hit.place.label, lat: hit.place.lat, lon: hit.place.lon } : undefined;
  // the world pack is read only for a place asked by name that is not one of his own (it is the phone's own gazetteer: no request but its own file)
  const pa = placeAsked(f.ask);
  const own = pa && places.some((p) => p.label.toLowerCase() === pa.name || pa.name === `${p.label.toLowerCase()}'s`);
  if (pa && !own && !World.ready) await World.load();
  const { chat } = await import('../assistant/session');
  const replyAt = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant')?.at;
  const { settings } = await import('../state/app');
  const facts: ShowFacts = { ...f, places, mentioned, city: World.ready ? cityNamed : undefined, replyAt, me: { name: settings.get().name } };
  const show = decideShow(facts);
  stageState.last = show ? { kind: show.kind, id: show.id, ...('via' in show && show.via ? { via: show.via } : {}), title: show.title } : null;
  stageState.why = show ? ('via' in show && show.via ? 'its own screen drew it' : '') : 'nothing in the answer to show';
  stageState.presented++; // (counted once its verdict and its reason are both in place: a reader never sees the count moved with the last turn's reason)
  if (!show || ('via' in show && show.via)) {
    // a wrong promise: the room reserved for it goes back to the conversation, the way the Stage would have left
    releaseRoom();
    return show;
  }
  // (the country's outline needs the world pack: for a city asked by name it is already here)
  mount(show as Exclude<Show, { via: 'its screen' }>, facts, t0);
  return show;
}
