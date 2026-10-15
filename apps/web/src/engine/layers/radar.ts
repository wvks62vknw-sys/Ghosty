/**
 * Translucent map tiles laid over the globe: live precipitation radar (RainViewer) and live
 * road traffic (TomTom flow, through the brain so the key stays secret).
 * Works like the imagery layer — curved Web-Mercator patches around where you look,
 * a coarse ring for context plus a sharper level near the centre — but the tiles are
 * transparent PNGs fetched through the brain's proxy and drawn with alpha blending.
 * RainViewer tiles go up to zoom 7; the newest frame is refreshed every 10 minutes. Traffic
 * tiles go to zoom 16 and are re-fetched every 3 minutes.
 */
import { headers } from '../../api/brain';
import { radarFrames } from '../../data/intel';
import type { CamState } from '../camera';
import { GEO, R_EARTH } from '../geo';
import { gfx } from '../gfx';
import { RAD, type Vec3 } from '../math';

const N = 12;
const MAX_TILES = 160;
const MAX_LOADING = 6;

interface Tile {
  key: string;
  z: number;
  x: number;
  y: number;
  center: Vec3;
  vao: WebGLVertexArrayObject | null;
  vbo: WebGLBuffer | null;
  tex: WebGLTexture | null;
  state: 'new' | 'loading' | 'ready' | 'failed';
  used: number;
}

const tileLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) / RAD;
const tileLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = Math.max(-85.05, Math.min(85.05, lat)) * RAD;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

const VS = `in vec3 aP;in vec2 aUV;uniform mat4 uV,uP;uniform vec3 uOff;out vec2 vUV;out vec3 vRel;
void main(){vec3 r=aP+uOff;vRel=r;vUV=aUV;gl_Position=uP*(uV*vec4(r,1.));}`;
const FS = `uniform sampler2D uTex;uniform vec3 uCam;uniform float uR,uOpacity;in vec2 vUV;in vec3 vRel;out vec4 o;
void main(){
 vec3 e=-uCam;float t=clamp(dot(e,vRel)/max(dot(vRel,vRel),1e-6),0.,1.);
 if(t<.999&&length(e-vRel*t)<uR-.25)discard;
 vec4 c=texture(uTex,vUV);if(c.a<.02)discard;
 o=vec4(c.rgb*1.15,c.a*uOpacity);}`;

/** What to draw now: a key per frame (new key = new tiles), the tile URL and the frame time. */
export interface OverlayFrame {
  key: string;
  url: (z: number, x: number, y: number) => string;
  time: number;
}

export class TileOverlay {
  constructor(private opts: { prog: string; maxZ: number; minZ?: number; opacity: number; frame: () => OverlayFrame | null }) {}
  private tiles = new Map<string, Tile>();
  private ibo: WebGLBuffer | null = null;
  private count = 0;
  private loading = 0;
  private ready = false;
  /** Frame time shown in the readout, or 0 when nothing is drawn. */
  shownAt = 0;

  private init(): void {
    if (this.ready) return;
    const gl = gfx.gl;
    gfx.mk(this.opts.prog, VS, FS, { aP: 0, aUV: 1 });
    const idx: number[] = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        const b = a + N + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.count = idx.length;
    this.ready = true;
  }

  private build(t: Tile): void {
    const gl = gfx.gl;
    const data = new Float32Array((N + 1) * (N + 1) * 5);
    let o = 0;
    for (let j = 0; j <= N; j++) {
      const lat = tileLat(t.y + j / N, t.z);
      for (let i = 0; i <= N; i++) {
        const p = GEO.ecef(lat, tileLon(t.x + i / N, t.z), 0.4);
        data[o++] = p[0] - t.center[0];
        data[o++] = p[1] - t.center[1];
        data[o++] = p[2] - t.center[2];
        data[o++] = i / N;
        data[o++] = j / N;
      }
    }
    t.vao = gl.createVertexArray();
    gl.bindVertexArray(t.vao);
    t.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, t.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bindVertexArray(null);
  }

  private get(frame: string, z: number, x: number, y: number): Tile {
    const n = 2 ** z;
    const xx = ((x % n) + n) % n;
    const key = `${frame}/${z}/${xx}/${y}`;
    let t = this.tiles.get(key);
    if (!t) {
      t = { key, z, x: xx, y, center: GEO.ecef(tileLat(y + 0.5, z), tileLon(xx + 0.5, z), 0), vao: null, vbo: null, tex: null, state: 'new', used: 0 };
      this.tiles.set(key, t);
    }
    t.used = performance.now();
    return t;
  }

  private load(t: Tile, url: string): void {
    if (t.state !== 'new' || this.loading >= MAX_LOADING) return;
    t.state = 'loading';
    this.loading++;
    void (async () => {
      try {
        const r = await fetch(url, { headers: headers() });
        if (!r.ok) throw new Error(String(r.status));
        const bmp = await createImageBitmap(await r.blob());
        const gl = gfx.gl;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        bmp.close();
        t.tex = tex;
        this.build(t);
        t.state = 'ready';
      } catch {
        t.state = 'failed';
      } finally {
        this.loading--;
      }
    })();
  }

  private evict(): void {
    if (this.tiles.size <= MAX_TILES) return;
    const gl = gfx.gl;
    const list = [...this.tiles.values()].filter((t) => t.state !== 'loading').sort((a, b) => a.used - b.used);
    for (const t of list.slice(0, this.tiles.size - MAX_TILES)) {
      if (t.tex) gl.deleteTexture(t.tex);
      if (t.vbo) gl.deleteBuffer(t.vbo);
      if (t.vao) gl.deleteVertexArray(t.vao);
      this.tiles.delete(t.key);
    }
  }

  private select(frame: string, lat: number, lon: number, z: number, radius: number, horizonKm: number): Tile[] {
    const out: Tile[] = [];
    const n = 2 ** z;
    const cx = Math.floor(lonToX(lon, z));
    const cy = Math.floor(latToY(lat, z));
    const ring: [number, number, number][] = [];
    const rx = Math.min(radius, Math.floor(n / 2));
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -rx; dx <= rx; dx++) {
        const y = cy + dy;
        if (y >= 0 && y < n) ring.push([cx + dx, y, Math.abs(dx) + Math.abs(dy)]);
      }
    ring.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of ring) {
      const t = this.get(frame, z, x, y);
      const ll = GEO.ll(t.center);
      if (GEO.hav(lat, lon, ll.lat, ll.lon) > horizonKm + 40075 / n) continue;
      out.push(t);
    }
    return out;
  }

  draw(cs: CamState, camLat: number, camLon: number, range: number, fov: number, on: boolean): void {
    this.shownAt = 0;
    const f = on ? this.opts.frame() : null;
    if (!f) return;
    this.init();
    const g = gfx;
    const gl = g.gl;
    const viewKm = 2 * range * Math.tan((fov * RAD) / 2);
    const screen = g.h / Math.max(1, g.dpr);
    const want = Math.log2((40075 * Math.max(0.05, Math.cos(camLat * RAD)) * screen) / (256 * Math.max(0.05, viewKm)));
    const z = Math.max(1, Math.min(this.opts.maxZ, Math.round(want)));
    if (z < (this.opts.minZ ?? 0)) return;
    const horizonKm = Math.sqrt(2 * R_EARTH * cs.alt + cs.alt * cs.alt) * 1.15 + viewKm;
    const url = (t: Tile) => f.url(t.z, t.x, t.y);
    const coarse = this.select(f.key, camLat, camLon, Math.max(1, z - 2), 3, horizonKm);
    const sharp = z > 2 ? this.select(f.key, camLat, camLon, z, 2, horizonKm) : [];
    for (const t of sharp) this.load(t, url(t));
    for (const t of coarse) this.load(t, url(t));
    g.use(g.prog[this.opts.prog]!);
    g.um('uV', cs.V);
    g.um('uP', cs.P);
    g.u3('uCam', cs.pos);
    g.u1('uR', R_EARTH);
    g.u1('uOpacity', this.opts.opacity);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    g.ui('uTex', 0);
    let drawn = 0;
    for (const t of [...coarse, ...sharp]) {
      if (t.state !== 'ready') continue;
      g.u3('uOff', [t.center[0] - cs.pos[0], t.center[1] - cs.pos[1], t.center[2] - cs.pos[2]]);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.bindVertexArray(t.vao);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    if (drawn) this.shownAt = f.time;
    this.evict();
  }
}

export const radar = new TileOverlay({
  prog: 'radar',
  maxZ: 7,
  opacity: 0.8,
  frame: () => {
    const f = radarFrames.data;
    return f ? { key: f.path, time: f.time, url: (z, x, y) => `/api/proxy?ttl=900&url=${encodeURIComponent(`${f.host}${f.path}/256/${z}/${x}/${y}/2/1_1.png`)}` } : null;
  },
});

/** Live traffic: set `traffic.ready` once the brain says the TomTom key is saved. */
export const trafficState = { ready: false };
export const traffic = new TileOverlay({
  prog: 'traffic',
  maxZ: 16,
  minZ: 7,
  opacity: 0.95,
  frame: () => {
    if (!trafficState.ready) return null;
    const slot = Math.floor(Date.now() / 180_000);
    return { key: `t${slot}`, time: slot * 180_000, url: (z, x, y) => `/api/traffic/tile/${z}/${x}/${y}` };
  },
});
