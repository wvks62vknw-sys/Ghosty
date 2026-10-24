/**
 * The Iron Man instruments (BRIEF-IRON-BUILD step 1; the owner's pick, OWNER-ISSUES 41 and 43: A's
 * instruments with C's restraint). Ported from the hand-drawn mock-ups (docs/build-plan/mockups/iron/build.mjs),
 * built here with svgEl / h() (never markup strings), each one taking real state and drawing nothing it does not
 * know: a count it has not got is left out, never made up.
 *
 *   globeInst       God's eye: the planet turned to face his home, his home marked, the aircraft seen where they are
 *   viewfinderInst  the Lens at rest (the camera is off until he taps): brackets, the reticle, the scan line
 *   gymRingInst     the GYM's games round a ring: mastered lit, the one training live
 *   schoolRingInst  SCHOOL's subjects at this stage: passed lit, the one being sat live
 *   mindInst        the library as MIND: a sphere of light, its constellation lit as far as he has studied
 *   courseSegs      a course's lessons as segments: done, the next one live
 *   traceInst       the uplink: the last round trips to the brain, in ms
 *   countdownInst   the time to the next thing in the diary, as a ring of the hour
 *   levelInst       a level out of a few (the threat level): its segments lit
 *   sparkInst       a price's last week as a trace (Markets)
 *   dayArcInst      the Brief's day: sunrise to sunset, the sun where it is now
 *   voiceInst, dialInst   Voice's waveform and Radio's tuning dial (lit while listening or playing)
 *   cubeInst, draftInst, layersInst, planInst   MAKE's tools as drawings (pictures of what they do, no readings)
 *   claimsInst      a cited reply's claims found in the sources
 *   mindGlyph       Ghosty's glyph in a reply's who-line (MIND in small)
 *   masteryMeter    a game's mastery with the pass mark's tick
 *
 * The shared glow and gradients live once per page (`ensureDefs`); every colour is the theme's (--c, --cr, --c2 in
 * styles.css "Iron Man"), so Graphite draws the same shapes in steel. Each instrument is a few hundred elements at
 * most (the globe's aircraft are capped), well under a few KB of DOM each.
 */
import { h, svgEl } from '../core/dom';

const D = Math.PI / 180;
const f = (n: number) => +n.toFixed(2);
/** A seeded random number generator (the same picture every time for the same seed). */
const rng = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const num = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : x);

type Kid = SVGElement | null | false | undefined;
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...kids: Kid[]): SVGElementTagNameMap[K] {
  const e = svgEl(tag, attrs);
  for (const k of kids) if (k) e.append(k);
  return e;
}
const p = (cls: string, d: string) => s('path', { class: cls, d });
const circ = (cls: string, cx: number, cy: number, r: number) => s('circle', { class: cls, cx: f(cx), cy: f(cy), r: f(r) });
function root(w: number, hh: number, cls: string, ...kids: Kid[]): SVGSVGElement {
  return s('svg', { viewBox: `0 0 ${w} ${hh}`, class: `inst ${cls}`, 'aria-hidden': 'true', focusable: 'false' }, ...kids);
}

/* ------------------------------------------------------------------ geometry (from the mock-ups) */
/** Orthographic projection on a tilted sphere: [x, y, how far round the front (> 0 is visible)]. */
function sphere(cx: number, cy: number, R: number, lat0: number, lon0: number) {
  return (lat: number, lon: number): [number, number, number] => {
    const ph = lat * D, l = (lon - lon0) * D, p0 = lat0 * D;
    const cosc = Math.sin(p0) * Math.sin(ph) + Math.cos(p0) * Math.cos(ph) * Math.cos(l);
    return [cx + R * Math.cos(ph) * Math.sin(l), cy - R * (Math.cos(p0) * Math.sin(ph) - Math.sin(p0) * Math.cos(ph) * Math.cos(l)), cosc];
  };
}
/** A path through projected points, broken where it goes round the back. */
function visPath(pts: [number, number, number][]): string {
  let d = '';
  let pen = false;
  for (const [x, y, c] of pts) {
    if (c > 0) {
      d += `${pen ? 'L' : 'M'}${f(x)} ${f(y)}`;
      pen = true;
    } else pen = false;
  }
  return d;
}
/** A tick scale round an ellipse (MIND's equator ring). */
function ellTicks(cx: number, cy: number, rx: number, ry: number, n: number, len: number, every = 0): string {
  let d = '';
  for (let k = 0; k < n; k++) {
    const t = (k / n) * 2 * Math.PI, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
    const L = every && k % every === 0 ? len * 2 : len;
    d += `M${f(x)} ${f(y)}l${f(Math.cos(t) * L)} ${f(Math.sin(t) * L * (ry / rx) + (Math.sin(t) > 0 ? L * 0.35 : -L * 0.35))}`;
  }
  return d;
}
/** Ticks round a circle. */
function ringTicks(cx: number, cy: number, r: number, n: number, len: number, every = 0, long = 2): string {
  let d = '';
  for (let k = 0; k < n; k++) {
    const t = (k / n) * 2 * Math.PI - Math.PI / 2, L = every && k % every === 0 ? len * long : len;
    d += `M${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}L${f(cx + (r + L) * Math.cos(t))} ${f(cy + (r + L) * Math.sin(t))}`;
  }
  return d;
}
/** An arc from a0 to a1 degrees, clockwise from twelve o'clock. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const pt = (a: number) => [cx + r * Math.cos((a - 90) * D), cy + r * Math.sin((a - 90) * D)] as const;
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}
/** n segments round a ring, a small gap between them; each gets its class from `cls(k)`. */
function segments(cx: number, cy: number, r: number, n: number, gap: number, cls: (k: number) => string): SVGGElement {
  const g = s('g', { class: 'i-seg' });
  for (let k = 0; k < n; k++) g.append(p(cls(k), arc(cx, cy, r, (k * 360) / n + gap, ((k + 1) * 360) / n - gap)));
  return g;
}

/* ------------------------------------------------------------------ the shared glow, once per page */
/** The glow filters and the sphere's gradients the instruments use (url(#ig-…)); added to the page once. */
export function ensureDefs(): void {
  if (typeof document === 'undefined' || document.getElementById('igdefs')) return;
  const stop = (offset: number, style: string) => s('stop', { offset, style });
  const blur = (id: string, dev: number, twice: boolean, pad: string) =>
    s('filter', { id, x: `-${pad}`, y: `-${pad}`, width: `${100 + 2 * parseInt(pad)}%`, height: `${100 + 2 * parseInt(pad)}%` },
      s('feGaussianBlur', { stdDeviation: dev, result: 'b' }),
      s('feMerge', {}, s('feMergeNode', { in: 'b' }), twice ? s('feMergeNode', { in: 'b' }) : null, s('feMergeNode', { in: 'SourceGraphic' })));
  const defs = s('defs', {},
    blur('ig-glow', 1.6, false, '50%'),
    blur('ig-glow2', 3.2, true, '80%'),
    s('radialGradient', { id: 'ig-sph', cx: 0.42, cy: 0.36, r: 0.7 }, stop(0, 'stop-color:var(--c);stop-opacity:.26'), stop(0.7, 'stop-color:var(--c);stop-opacity:.07'), stop(1, 'stop-color:var(--c);stop-opacity:.16')),
    s('linearGradient', { id: 'ig-scan', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'stop-color:var(--c);stop-opacity:0'), stop(1, 'stop-color:var(--c);stop-opacity:.3')),
    s('radialGradient', { id: 'ig-glass', cx: 0.35, cy: 0.25, r: 0.8 }, stop(0, 'stop-color:#fff;stop-opacity:.16'), stop(0.5, 'stop-color:#fff;stop-opacity:.02'), stop(1, 'stop-color:#fff;stop-opacity:0')),
  );
  const box = s('svg', { id: 'igdefs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false', style: 'position:absolute;width:0;height:0;overflow:hidden' }, defs);
  document.body.append(box);
}

/* ------------------------------------------------------------------ God's eye */
export interface GlobeState {
  /** His home (the settings' home): the globe turns to face it and marks it. */
  home: { lat: number; lon: number };
  /** Aircraft positions the phone has now ([lat, lon]); none drawn when it has none. */
  planes: [number, number][];
  /** Satellites tracked (only whether there are any: a mark on the orbit for each of up to three). */
  sats: number;
}
/** The planet, live: meridians and parallels, the aircraft where they are, the orbit, "you" on his home. */
export function globeInst(st: GlobeState): SVGSVGElement {
  const cx = 60, cy = 60, R = 40;
  const lat0 = clamp(st.home.lat - 22, -60, 60), lon0 = st.home.lon - 12;
  const P = sphere(cx, cy, R, lat0, lon0);
  let mer = '';
  for (let lon = -180; lon < 180; lon += 30) {
    const pts: [number, number, number][] = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(P(lat, lon));
    mer += visPath(pts);
  }
  for (const lat of [-60, -30, 30, 60]) {
    const pts: [number, number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 3) pts.push(P(lat, lon));
    mer += visPath(pts);
  }
  const eq: [number, number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 3) eq.push(P(0, lon));
  // the aircraft: the ones on the near side, at most 240 (a dot each)
  const dots = s('g', { class: 'g-dots' });
  let n = 0;
  for (const [la, lo] of st.planes) {
    if (n >= 240) break;
    const [x, y, c] = P(la, lo);
    if (c <= 0.08) continue;
    dots.append(circ('g-dot', x, y, 0.7));
    n++;
  }
  const tilt = -24;
  const orbit = s('g', { class: 'g-orbit', transform: `rotate(${tilt} ${cx} ${cy})` }, s('ellipse', { cx, cy, rx: R + 9, ry: 11 }), p('', ellTicks(cx, cy, R + 9, 11, 64, 1.3, 8)));
  const satG = s('g', { transform: `rotate(${tilt} ${cx} ${cy})` });
  for (const [k, t] of [1.0, 3.6, 5.2].entries()) if (k < Math.min(3, st.sats)) satG.append(circ('g-sat', cx + (R + 9) * Math.cos(t), cy + 11 * Math.sin(t), k ? 1.5 : 1.8));
  const [bx, by] = P(st.home.lat, st.home.lon);
  return root(120, 120, 'i-globe',
    s('g', { class: 'g-ring' }, circ('ln2', cx, cy, R + 11), p('ln2', ringTicks(cx, cy, R + 11, 72, 2, 6, 2.2)), p('lit', arc(cx, cy, R + 16, 300, 352)), p('ln', arc(cx, cy, R + 16, 20, 74)), s('path', { class: 'ln2', d: arc(cx, cy, R + 16, 110, 250), 'stroke-dasharray': '1 3' })),
    circ('g-sph', cx, cy, R),
    p('g-mer', mer),
    p('g-eq', visPath(eq)),
    orbit,
    dots,
    satG,
    circ('g-rim', cx, cy, R),
    s('g', { class: 'g-you' }, circ('', bx, by, 4.2), circ('fl', bx, by, 1.4)),
    s('ellipse', { class: 'gl', cx: cx - 12, cy: cy - 18, rx: 22, ry: 12, fill: 'url(#ig-glass)' }),
  );
}

/* ------------------------------------------------------------------ the Lens */
/** The viewfinder at rest: the camera is off until he taps (so nothing is in it). */
export function viewfinderInst(): SVGSVGElement {
  const cx = 62, cy = 60;
  const br = (x: number, y: number, sx: number, sy: number) => `M${x} ${y + sy * 14}V${y}H${x + sx * 14}`;
  return root(124, 124, 'i-vf',
    p('vf-brk', `${br(8, 8, 1, 1)}${br(116, 8, -1, 1)}${br(8, 116, 1, -1)}${br(116, 116, -1, -1)}`),
    s('g', { class: 'vf-scan' }, s('rect', { x: 8, y: 30, width: 108, height: 22, fill: 'url(#ig-scan)' }), p('lit', 'M8 52H116')),
    s('g', { class: 'vf-ret' }, circ('ln', cx, cy, 12), p('ln', `M${cx} ${cy - 20}v6M${cx} ${cy + 14}v6M${cx - 20} ${cy}h6M${cx + 14} ${cy}h6`), circ('fl', cx, cy, 1.6)),
    circ('ln2', cx, cy, 33),
  );
}

/* ------------------------------------------------------------------ the GYM and SCHOOL */
/** The games round a ring: `mastered` lit, the one at `live` (training now; -1 none) dashed and bright. */
export function gymRingInst(o: { games: number; mastered: number; live: number }): SVGSVGElement {
  const cx = 80, cy = 46, R = 38, n = Math.max(1, o.games);
  return root(160, 92, 'i-ring',
    s('g', { class: 'g-ring' }, circ('ln2', cx, cy, R + 6), p('ln2', ringTicks(cx, cy, R + 6, 88, 1.4, 4, 2))),
    segments(cx, cy, R, n, 2.2, (k) => (k < o.mastered ? 'sg on' : k === o.live ? 'sg live' : 'sg')),
  );
}
/** A stage's subjects round a ring: `passed` lit (top grades), the one being sat live (-1 none). */
export function schoolRingInst(o: { subjects: number; passed: number; live: number }): SVGSVGElement {
  const cx = 80, cy = 46, R = 34, n = Math.max(1, o.subjects);
  return root(160, 92, 'i-ring',
    s('g', { class: 'g-ring' }, p('ln2', ringTicks(cx, cy, R + 6, 48, 1.5, 12, 2.4)), s('circle', { class: 'ln2', cx, cy, r: R - 7, 'stroke-dasharray': '1 2.5' })),
    segments(cx, cy, R, n, n > 8 ? 2.5 : 5, (k) => (k < o.passed ? 'sg on' : k === o.live ? 'sg live' : 'sg')),
  );
}

/* ------------------------------------------------------------------ MIND */
/**
 * The library as MIND: a sphere of light and its constellation (60 nodes in five fields, the same every time),
 * lit as far as he has studied: `frac` of the nodes and the arc round it. null: not known yet (nothing lit, no arc).
 */
export function mindInst(o: { frac: number | null }, w = 120, hh = 92): SVGSVGElement {
  const R = 38, cx = w / 2, cy = hh / 2, r = rng(11), n = 60;
  const centres = [[-0.4, -0.3, 0.2], [0.45, -0.1, -0.1], [0.05, 0.45, 0.25], [-0.2, 0.15, -0.5], [0.3, -0.45, 0.4]] as const;
  const pts: { x: number; y: number; fl: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = centres[i % centres.length]!;
    let x = c[0] + (r() - 0.5) * 0.55, y = c[1] + (r() - 0.5) * 0.55, z = c[2] + (r() - 0.5) * 0.55;
    const L = Math.hypot(x, y, z);
    if (L > 0.92) [x, y, z] = [(x * 0.92) / L, (y * 0.92) / L, (z * 0.92) / L];
    pts.push({ x: cx + x * R, y: cy + y * R * 0.96 + z * 4, fl: i % centres.length });
  }
  const frac = num(o.frac);
  const lit = frac == null ? 0 : Math.round(n * clamp(frac, 0, 1));
  let links = '', litLinks = '';
  pts.forEach((a, i) => {
    const near = pts.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y), j] as const).filter(([, j]) => j !== i && pts[j]!.fl === a.fl).sort((x, y) => x[0] - y[0]).slice(0, 2);
    for (const [, j] of near) {
      if (j <= i) continue;
      const seg = `M${f(a.x)} ${f(a.y)}L${f(pts[j]!.x)} ${f(pts[j]!.y)}`;
      if (i < lit && j < lit) litLinks += seg;
      else links += seg;
    }
  });
  const nodes = s('g', {});
  pts.forEach((q, i) => nodes.append(circ(i < lit ? 'm-n on' : 'm-n', q.x, q.y, i < lit ? 1.25 : 0.85)));
  const mer = s('g', { class: 'g-mer' });
  for (const k of [0.25, 0.55, 0.85]) mer.append(s('ellipse', { cx, cy, rx: f(R * k), ry: R }));
  const deg = frac == null ? 0 : Math.round(360 * clamp(frac, 0, 1));
  return root(w, hh, 'i-mind',
    s('g', { class: 'g-ring' }, p('ln2', ringTicks(cx, cy, R + 6, 60, 1.6, 5, 2.2)), deg >= 4 ? p('lit', arc(cx, cy, R + 9, 0, Math.min(deg, 359.5))) : null, frac != null && deg < 348 ? p('ln2', arc(cx, cy, R + 9, deg + 6, 354)) : null),
    circ('g-sph', cx, cy, R),
    mer,
    s('g', { class: 'g-orbit' }, s('ellipse', { cx, cy, rx: R + 6, ry: 8 }), p('', ellTicks(cx, cy, R + 6, 8, 56, 1.1, 7))),
    p('m-l', links),
    litLinks ? p('m-l lit', litLinks) : null,
    nodes,
    circ('m-core', cx, cy + 1, 2.6),
    circ('g-rim', cx, cy, R),
    s('ellipse', { class: 'gl', cx: cx - 10, cy: cy - 16, rx: 18, ry: 10, fill: 'url(#ig-glass)' }),
  );
}

/** Ghosty's glyph over a reply: MIND in small (a sphere, its ring, a bright core). */
export function mindGlyph(): SVGSVGElement {
  return s('svg', { viewBox: '0 0 20 20', class: 'inst glyph', 'aria-hidden': 'true', focusable: 'false' },
    circ('gy-rim', 10, 10, 7), s('ellipse', { class: 'gy-eq', cx: 10, cy: 10, rx: 9.5, ry: 2.6 }), circ('gy-core', 10, 10, 2.4));
}

/* ------------------------------------------------------------------ small ones */
/** A course's lessons as segments: `done` lit, the next one live. At most 12 drawn (a long course in twelfths). */
export function courseSegs(o: { lessons: number; done: number }): HTMLElement {
  const n = Math.max(1, Math.min(12, o.lessons));
  const per = Math.max(1, o.lessons) / n;
  const lit = Math.floor(o.done / per);
  const out = h('span.segs', { style: { gridTemplateColumns: `repeat(${n}, 1fr)` } });
  for (let k = 0; k < n; k++) out.append(h(`i${k < lit ? '.on' : k === lit && o.done < o.lessons ? '.live' : ''}` as 'i'));
  return out;
}

/** The uplink: the last round trips to the brain (ms, oldest first) as a trace, the newest as a bright dot. */
export function traceInst(ms: number[]): SVGSVGElement {
  const v = ms.slice(-12);
  const w = 78, hh = 28;
  const g = root(w, hh, 'i-trace', p('ln2', `M0 ${hh - 1}H${w}`));
  if (v.length < 2) return g;
  const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(1, hi - lo);
  const step = (w - 4) / (v.length - 1);
  const pts = v.map((x, i) => [2 + i * step, hh - 3 - ((x - lo) / span) * (hh - 8)] as const);
  g.append(s('polyline', { class: 'lit', fill: 'none', points: pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ') }));
  const [lx, ly] = pts[pts.length - 1]!;
  g.append(circ('fl', lx, ly, 1.8));
  return g;
}

/** A price's last days as a trace (Markets): up in the accent, down in the warning colour. */
export function sparkInst(values: number[], up: boolean): SVGSVGElement {
  const v = values.filter((x) => Number.isFinite(x));
  const w = 78, hh = 28;
  const g = root(w, hh, `i-trace${up ? '' : ' dn'}`, p('ln2', `M0 ${hh - 1}H${w}`));
  if (v.length < 2) return g;
  const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(1e-9, hi - lo);
  const step = (w - 4) / (v.length - 1);
  const pts = v.map((x, i) => [2 + i * step, hh - 3 - ((x - lo) / span) * (hh - 8)] as const);
  g.append(s('polyline', { class: 'lit', fill: 'none', points: pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ') }));
  const [lx, ly] = pts[pts.length - 1]!;
  g.append(circ('fl', lx, ly, 1.8));
  return g;
}

/** The time to the next thing in the diary: the ring is the hour, lit for what is left of it (`frac` 0–1). */
export function countdownInst(frac: number | null): SVGSVGElement {
  const g = root(34, 34, 'i-count', circ('ln2', 17, 17, 14), p('ln2', ringTicks(17, 17, 14, 12, -2.5)));
  const x = num(frac);
  if (x != null && x > 0.005) g.append(p('lit', arc(17, 17, 14, 0, Math.min(359.5, 360 * clamp(x, 0, 1)))));
  return g;
}

/** A level out of `of` (the threat level): that many segments lit round a small ring; null draws none lit. */
export function levelInst(level: number | null, of: number): SVGSVGElement {
  const g = root(34, 34, 'i-count', circ('ln2', 17, 17, 9));
  g.append(segments(17, 17, 14, of, 7, (k) => (level != null && k < level ? 'sg on' : 'sg')));
  return g;
}

/** A cited reply's claims: one segment per claim (at most 12 drawn), the found ones lit; the count in the middle. */
export function claimsInst(found: number, total: number): SVGSVGElement {
  const n = Math.max(1, Math.min(12, total));
  const lit = total ? Math.round((found / total) * n) : 0;
  const g = root(30, 30, 'i-claims', segments(15, 15, 11, n, n > 1 ? 8 : 0, (k) => (k < lit ? 'sg on' : 'sg')));
  const t = s('text', { x: 15, y: 18.5, class: 'ctx' });
  t.textContent = String(found);
  g.append(t);
  return g;
}

/**
 * The day so far (the Brief): sunrise to sunset as an arc over the horizon, the sun where it is now (times in ms;
 * null when the weather has not come in, which draws the horizon alone).
 */
export function dayArcInst(rise: number | null, set: number | null, now = Date.now()): SVGSVGElement {
  const cx = 40, cy = 30, R = 24;
  const g = root(80, 36, 'i-day', p('ln2', `M4 ${cy}H76`), p('ln2', `M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}`));
  if (rise == null || set == null || !(set > rise)) return g;
  const t = clamp((now - rise) / (set - rise), 0, 1);
  const a = Math.PI * (1 - t);
  if (t > 0) g.append(p('lit', `M${cx - R} ${cy}A${R} ${R} 0 0 1 ${f(cx + R * Math.cos(a))} ${f(cy - R * Math.sin(a))}`));
  g.append(circ(now > rise && now < set ? 'fl' : 'ln', cx + R * Math.cos(a), cy - R * Math.sin(a), 2.6));
  return g;
}

/** Voice: his words as a waveform round the microphone; lit while he is listening or speaking (`on`). */
export function voiceInst(on: boolean): SVGSVGElement {
  const g = root(160, 92, 'i-art', s('rect', { class: 'ln', x: 74, y: 22, width: 12, height: 30, rx: 6 }), p('ln2', 'M66 44a14 14 0 0028 0M80 58v10M72 68h16'));
  const bars = [6, 11, 17, 9, 14, 20, 12, 7];
  let d = '';
  bars.forEach((hh, i) => {
    const x = 18 + i * 5.5, x2 = 142 - i * 5.5;
    d += `M${f(x)} ${46 - hh / 2}v${hh}M${f(x2)} ${46 - hh / 2}v${hh}`;
  });
  g.append(p(on ? 'lit' : 'ln2', d));
  return g;
}
/** Radio: the tuning scale and its needle; the needle and the signal lit while a station is playing. */
export function dialInst(playing: boolean): SVGSVGElement {
  let ticks = '';
  for (let k = 0; k <= 24; k++) ticks += `M${f(28 + k * 4.33)} ${k % 4 ? 52 : 48}V56`;
  return root(160, 92, 'i-art',
    s('rect', { class: 'ln', x: 22, y: 36, width: 116, height: 28, rx: 5, fill: 'none' }), p('ln2', ticks),
    p(playing ? 'lit' : 'ln', 'M92 40V60'),
    p(playing ? 'lit' : 'ln2', 'M68 22a17 17 0 0124 0M73 27a10 10 0 0114 0'), circ(playing ? 'fl' : 'ln2', 80, 31, 1.6),
  );
}

/* ------------------------------------------------------------------ MAKE's pictures (drawings, not readings) */
/** 3D studio: a model in wireframe on its turntable. */
export function cubeInst(): SVGSVGElement {
  const A = [80, 18], B = [108, 32], C = [80, 46], E = [52, 32];
  const dn = (q: number[]) => [q[0]!, q[1]! + 30];
  const L = (a: number[], b: number[]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  return root(160, 92, 'i-art',
    s('ellipse', { class: 'ln2', cx: 80, cy: 80, rx: 46, ry: 8 }),
    p('ln2', L(dn(A), dn(B)) + L(dn(A), dn(E)) + L(A, dn(A))),
    p('ln', L(A, B) + L(B, C) + L(C, E) + L(E, A) + L(E, dn(E)) + L(B, dn(B)) + L(dn(E), dn(C)) + L(dn(C), dn(B))),
    p('lit', L(C, dn(C))),
    circ('fl', C[0]!, C[1]!, 1.6),
  );
}
/** Workshop: a page of his own code, the line being changed lit. */
export function draftInst(): SVGSVGElement {
  return root(160, 92, 'i-art',
    s('rect', { class: 'ln', x: 44, y: 8, width: 72, height: 76, rx: 5, fill: 'none' }),
    p('ln2', 'M44 20H116'), circ('fl', 51, 14, 1.4),
    p('ln2', 'M54 30h30M60 38h40M60 46h26M54 62h34M60 70h44'),
    s('rect', { class: 'lit', x: 56, y: 51, width: 52, height: 6, rx: 1.5, fill: 'none' }),
  );
}
/** Reverse: an app taken apart into its layers. */
export function layersInst(): SVGSVGElement {
  const layer = (y: number, cls: string) => p(cls, `M80 ${y}l34 12-34 12-34-12z`);
  return root(160, 92, 'i-art', layer(54, 'ln2'), layer(38, 'ln'), layer(22, 'ln'), p('lit', 'M80 22l34 12'), p('ln2', 'M46 34v20M114 34v20M80 46v32'));
}
/** Space: a room to scale, with its measured wall. */
export function planInst(): SVGSVGElement {
  return root(160, 92, 'i-art',
    p('ln', 'M42 14H118V78H42Z'), p('ln', 'M42 50H74V78'), p('ln2', 'M74 60a18 18 0 0118 18'),
    s('rect', { class: 'ln2', x: 92, y: 20, width: 20, height: 30, rx: 2, fill: 'none' }),
    p('lit', 'M42 8H118M42 5v6M118 5v6'),
  );
}

/** A game's mastery (0–1) with the pass mark's tick (null: no mark, e.g. mastered). */
export function masteryMeter(m: number, bar: number | null): HTMLElement {
  const fill = h('i', { style: { width: `${Math.round(clamp(m, 0, 1) * 100)}%` } });
  const tick = bar == null ? null : h('u', { style: { left: `${Math.round(clamp(bar, 0, 1) * 100)}%` } });
  return h('span.meter', { role: 'img', 'aria-label': `${Math.round(clamp(m, 0, 1) * 100)}%${bar == null ? '' : `, passes at ${Math.round(bar * 100)}%`}` }, fill, tick);
}
