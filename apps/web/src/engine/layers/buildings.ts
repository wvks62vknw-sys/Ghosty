/**
 * 3D buildings from OpenStreetMap (Overpass API) when you zoom right in (below ~5 km).
 * Footprints are extruded to their mapped height (or levels × 3.2 m), lit, and outlined
 * in the theme colour. Areas are cached; nothing loads until the camera settles.
 */
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { gfx, LineSet } from '../gfx';
import { M4, RAD, type Vec3 } from '../math';

const CELL = 0.012; // degrees (~1.3 km) — one Overpass request covers the 3×3 cells around you
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface Area {
  key: string;
  origin: Vec3;
  vao: WebGLVertexArrayObject | null;
  vbo: WebGLBuffer | null;
  count: number;
  lines: LineSet;
  n: number;
  used: number;
}

interface OsmWay {
  type: string;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

const VS = `in vec3 aP;in vec3 aN;in float aH;uniform mat4 uV,uP;uniform vec3 uOff;out vec3 vN;out float vH;
void main(){vN=aN;vH=aH;gl_Position=uP*(uV*vec4(aP+uOff,1.));}`;
const FS = `uniform vec3 uCol,uL;in vec3 vN;in float vH;out vec4 o;
void main(){float l=.32+.68*max(dot(normalize(vN),uL),0.);vec3 base=mix(vec3(.03,.07,.1),uCol*.55,.55+.45*clamp(vH,0.,1.));o=vec4(base*l,1.);}`;

/** Height in metres from OSM tags. */
function heightOf(t: Record<string, string> = {}): { h: number; base: number } {
  const num = (s?: string) => {
    const v = s ? parseFloat(s.replace(',', '.')) : NaN;
    return Number.isFinite(v) ? v : NaN;
  };
  let h = num(t.height);
  if (!Number.isFinite(h)) h = num(t['building:levels']) * 3.2 + (t['roof:levels'] ? num(t['roof:levels']) * 2 || 0 : 0);
  if (!Number.isFinite(h)) h = /^(house|detached|semidetached_house|terrace|garage|shed|hut|bungalow)$/.test(t.building ?? '') ? 6 : 9;
  let base = num(t.min_height);
  if (!Number.isFinite(base)) base = Number.isFinite(num(t['building:min_level'])) ? num(t['building:min_level']) * 3.2 : 0;
  return { h: Math.min(Math.max(h, 2.5), 830), base: Math.max(0, Math.min(base, h - 1)) };
}

/** Triangulate a simple polygon (ear clipping). Points are [x, y]; returns index triples. */
export function earcut(pts: [number, number][]): number[] {
  const n = pts.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % n]!;
    area += x1 * y2 - x2 * y1;
  }
  const idx = [...Array(n).keys()];
  if (area < 0) idx.reverse();
  const out: number[] = [];
  const cross = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: [number, number], a: [number, number], b: [number, number], c: [number, number]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length]!;
      const ib = idx[i]!;
      const ic = idx[(i + 1) % idx.length]!;
      const a = pts[ia]!;
      const b = pts[ib]!;
      const c = pts[ic]!;
      if (cross(a, b, c) <= 0) continue;
      let ear = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inside(pts[j]!, a, b, c)) {
          ear = false;
          break;
        }
      }
      if (!ear) continue;
      out.push(ia, ib, ic);
      idx.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break; // degenerate polygon: give up on the rest of the roof
  }
  if (idx.length === 3) out.push(idx[0]!, idx[1]!, idx[2]!);
  return out;
}

export class BuildingLayer {
  private areas = new Map<string, Area>();
  private pending = new Set<string>();
  private ready = false;
  private settle = 0;
  private lastKey = '';
  status = '';
  count = 0;

  private init(): void {
    if (this.ready) return;
    gfx.mk('bld', VS, FS, { aP: 0, aN: 1, aH: 2 });
    this.ready = true;
  }

  private async fetchArea(key: string, lat0: number, lon0: number): Promise<void> {
    this.pending.add(key);
    this.status = 'LOADING';
    const s = lat0 - CELL * 1.5;
    const w = lon0 - CELL * 1.5;
    const n = lat0 + CELL * 1.5;
    const e = lon0 + CELL * 1.5;
    const q = `[out:json][timeout:25];way["building"](${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)});out geom tags 6000;`;
    let ways: OsmWay[] | null = null;
    for (const m of MIRRORS) {
      try {
        const r = await fetch(m, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!r.ok) continue;
        ways = ((await r.json()) as { elements: OsmWay[] }).elements;
        break;
      } catch {
        /* try the next mirror */
      }
    }
    this.pending.delete(key);
    if (!ways) {
      this.status = 'NO FEED';
      return;
    }
    this.areas.set(key, this.build(key, lat0, lon0, ways));
    this.status = '';
    this.evict();
  }

  private build(key: string, lat0: number, lon0: number, ways: OsmWay[]): Area {
    const gl = gfx.gl;
    const origin = GEO.ecef(lat0, lon0, 0);
    const en = GEO.enu(lat0, lon0);
    const mx = 111.32 * Math.cos(lat0 * RAD); // km per degree of longitude
    const my = 110.54;
    const P = (x: number, y: number, hKm: number): Vec3 => [en.e[0] * x + en.n[0] * y + en.u[0] * hKm, en.e[1] * x + en.n[1] * y + en.u[1] * hKm, en.e[2] * x + en.n[2] * y + en.u[2] * hKm];
    const verts: number[] = [];
    const push = (p: Vec3, nrm: Vec3, hNorm: number) => verts.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], hNorm);
    const lines = new LineSet(4000);
    const c = gfx.theme.c;
    let count = 0;
    for (const w of ways) {
      const g = w.geometry;
      if (w.type !== 'way' || !g || g.length < 4) continue;
      let pts = g.map((p) => [(p.lon - lon0) * mx, (p.lat - lat0) * my] as [number, number]);
      if (pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts = pts.slice(0, -1);
      if (pts.length < 3 || pts.length > 400) continue;
      let area2 = 0;
      for (let i = 0; i < pts.length; i++) area2 += pts[i]![0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * pts[i]![1];
      if (area2 < 0) pts.reverse(); // counter-clockwise, so wall normals face outwards
      const { h, base } = heightOf(w.tags);
      const top = h / 1000;
      const bot = base / 1000;
      const hn = Math.min(1, h / 120);
      // walls
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]!;
        const [x2, y2] = pts[(i + 1) % pts.length]!;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nrm: Vec3 = [en.e[0] * (dy / len) - en.n[0] * (dx / len), en.e[1] * (dy / len) - en.n[1] * (dx / len), en.e[2] * (dy / len) - en.n[2] * (dx / len)];
        const a = P(x1, y1, bot);
        const b = P(x2, y2, bot);
        const a2 = P(x1, y1, top);
        const b2 = P(x2, y2, top);
        push(a, nrm, 0); push(b, nrm, 0); push(a2, nrm, hn);
        push(a2, nrm, hn); push(b, nrm, 0); push(b2, nrm, hn);
      }
      // roof
      const tri = earcut(pts);
      for (const i of tri) push(P(pts[i]![0], pts[i]![1], top), en.u, hn);
      // glowing roof outline (+ corner edges on tall buildings)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const pa = P(a[0], a[1], top + 0.0004);
        const pb = P(b[0], b[1], top + 0.0004);
        lines.add([origin[0] + pa[0], origin[1] + pa[1], origin[2] + pa[2]], [origin[0] + pb[0], origin[1] + pb[1], origin[2] + pb[2]], [c[0], c[1], c[2], 0.75], 1.1);
        if (h > 40) {
          const pg = P(a[0], a[1], bot);
          lines.add([origin[0] + pg[0], origin[1] + pg[1], origin[2] + pg[2]], [origin[0] + pa[0], origin[1] + pa[1], origin[2] + pa[2]], [c[0], c[1], c[2], 0.35], 0.9);
        }
      }
      count++;
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(null);
    return { key, origin, vao, vbo, count: verts.length / 7, lines, n: count, used: performance.now() };
  }

  private evict(): void {
    if (this.areas.size <= 6) return;
    const gl = gfx.gl;
    const old = [...this.areas.values()].sort((a, b) => a.used - b.used).slice(0, this.areas.size - 6);
    for (const a of old) {
      gl.deleteBuffer(a.vbo);
      gl.deleteVertexArray(a.vao);
      this.areas.delete(a.key);
    }
  }

  /** Call every frame from the globe. `on` = layer visible and zoomed in enough. */
  draw(cs: CamState, lat: number, lon: number, on: boolean, flying: boolean): void {
    this.count = 0;
    if (!on) {
      this.settle = 0;
      return;
    }
    this.init();
    const cy = Math.round(lat / CELL) * CELL;
    const cx = Math.round(lon / CELL) * CELL;
    const key = `${cy.toFixed(3)},${cx.toFixed(3)}`;
    if (key !== this.lastKey || flying) {
      this.lastKey = key;
      this.settle = performance.now();
    }
    if (!this.areas.has(key) && !this.pending.has(key) && !flying && performance.now() - this.settle > 700) void this.fetchArea(key, cy, cx);
    const g = gfx;
    const gl = g.gl;
    g.use(g.prog.bld!);
    g.um('uV', cs.V);
    g.um('uP', cs.P);
    const en = GEO.enu(lat, lon);
    const L: Vec3 = [en.u[0] * 0.75 + en.e[0] * 0.45 + en.n[0] * 0.3, en.u[1] * 0.75 + en.e[1] * 0.45 + en.n[1] * 0.3, en.u[2] * 0.75 + en.e[2] * 0.45 + en.n[2] * 0.3];
    g.u3('uL', L);
    g.u3('uCol', g.theme.c);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    const near = [...this.areas.values()].filter((a) => GEO.hav(lat, lon, GEO.ll(a.origin).lat, GEO.ll(a.origin).lon) < 6);
    for (const a of near) {
      a.used = performance.now();
      g.u3('uOff', [a.origin[0] - cs.pos[0], a.origin[1] - cs.pos[1], a.origin[2] - cs.pos[2]]);
      gl.bindVertexArray(a.vao);
      gl.drawArrays(gl.TRIANGLES, 0, a.count);
      this.count += a.n;
    }
    gl.bindVertexArray(null);
    // outlines, additive, on top
    g.additive();
    for (const a of near) a.lines.draw(M4.trans(-cs.pos[0], -cs.pos[1], -cs.pos[2]), { occ: 0, px: 1 });
  }
}

export const buildings = new BuildingLayer();
