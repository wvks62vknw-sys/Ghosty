/**
 * Satellite imagery on the globe when you zoom in. Web-Mercator tiles are laid on the
 * sphere as small curved patches around the point you are looking at: a sharp level
 * where you look, and a coarser level underneath for the surroundings. Tiles load
 * straight from the imagery service (allowed in the security policy) and are cached.
 */
import type { CamState } from '../camera';
import { GEO, R_EARTH } from '../geo';
import { gfx } from '../gfx';
import { RAD, type Vec3 } from '../math';

interface Source {
  name: string;
  url: (z: number, x: number, y: number) => string;
  maxZ: number;
  credit: string;
  /** Invert and hue-rotate the tiles in the shader (a dark map from light tiles). */
  dark?: boolean;
}

/** Tile sources, free and keyless (every host is allowed as an image source in public/_headers). */
export const SOURCES: Source[] = [
  {
    name: 'satellite',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    maxZ: 19,
    credit: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  {
    name: 'streets',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxZ: 19,
    credit: '© OpenStreetMap contributors',
  },
  {
    // OpenStreetMap's tiles, inverted and hue-rotated in the shader: a dark map, same free source.
    name: 'dark',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxZ: 19,
    credit: '© OpenStreetMap contributors (dark)',
    dark: true,
  },
  {
    name: 'topo',
    url: (z, x, y) => `https://${'abc'[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png`,
    maxZ: 17,
    credit: '© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)',
  },
  {
    name: 'sentinel',
    url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`,
    maxZ: 15,
    credit: 'Sentinel-2 cloudless by EOX (Copernicus data)',
  },
];

const N = 16; // grid cells per tile edge
const MAX_TILES = 240;
const MAX_LOADING = 8;

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
const FS = `uniform sampler2D uTex;uniform vec3 uCam,uSun;uniform float uR,uFade,uHaze,uDark;in vec2 vUV;in vec3 vRel;out vec4 o;
void main(){
 vec3 e=-uCam;float t=clamp(dot(e,vRel)/max(dot(vRel,vRel),1e-6),0.,1.);
 if(t<.999&&length(e-vRel*t)<uR-.25)discard;
 vec3 c=texture(uTex,vUV).rgb;
 if(uDark>.5){c=1.-c;c=clamp(mat3(-.574,.426,.426,1.43,.43,1.43,.144,.144,-.856)*c,0.,1.)*.85;}
 vec3 n=normalize(vRel+uCam);float day=smoothstep(-.12,.25,dot(n,uSun));
 c*=mix(.45,1.05,day);
 float d=length(vRel);float fog=1.-exp(-d/uHaze);c=mix(c,vec3(.32,.5,.75)*mix(.15,.6,day),fog*.55);
 o=vec4(c,uFade);}`;

export class ImageryLayer {
  private tiles = new Map<string, Tile>();
  private ibo: WebGLBuffer | null = null;
  private count = 0;
  private loading = 0;
  private ready = false;
  private src = 0;
  private fails = 0;
  /** Credit line for the readout, or '' when no imagery is on screen. */
  credit = '';
  /** Last zoom level drawn (for the readout). */
  level = 0;

  /** The tile source on the globe ('satellite', 'streets', 'dark', 'topo', 'sentinel'). */
  get source(): string {
    return SOURCES[this.src]!.name;
  }
  setSource(name: string): void {
    const i = SOURCES.findIndex((s) => s.name === name);
    if (i >= 0) {
      this.src = i;
      this.fails = 0;
    }
  }
  /** The next source round the list; returns its name. */
  cycle(): string {
    this.src = (this.src + 1) % SOURCES.length;
    this.fails = 0;
    return this.source;
  }

  private init(): void {
    if (this.ready) return;
    const gl = gfx.gl;
    gfx.mk('imagery', VS, FS, { aP: 0, aUV: 1 });
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
        const lon = tileLon(t.x + i / N, t.z);
        const p = GEO.ecef(lat, lon, 0.002);
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

  private get(z: number, x: number, y: number): Tile {
    const n = 2 ** z;
    const xx = ((x % n) + n) % n;
    const key = `${this.src}/${z}/${xx}/${y}`;
    let t = this.tiles.get(key);
    if (!t) {
      const c = GEO.ecef(tileLat(y + 0.5, z), tileLon(xx + 0.5, z), 0);
      t = { key, z, x: xx, y, center: c, vao: null, vbo: null, tex: null, state: 'new', used: 0 };
      this.tiles.set(key, t);
    }
    t.used = performance.now();
    return t;
  }

  private load(t: Tile): void {
    if (t.state !== 'new' || this.loading >= MAX_LOADING) return;
    t.state = 'loading';
    this.loading++;
    const src = SOURCES[this.src]!;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const done = (ok: boolean) => {
      this.loading--;
      if (!ok) {
        t.state = 'failed';
        // A source that keeps failing (blocked, down, no CORS) is swapped for the next one.
        if (++this.fails > 12 && this.src < SOURCES.length - 1) {
          this.src++;
          this.fails = 0;
        }
        return;
      }
      const gl = gfx.gl;
      try {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        t.tex = tex;
        this.build(t);
        t.state = 'ready';
        this.fails = Math.max(0, this.fails - 1);
      } catch {
        t.state = 'failed';
        this.fails++;
      }
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src.url(t.z, t.x, t.y);
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

  /** Tiles to draw this frame: coarse level first, sharp level on top (painter's order). */
  private select(lat: number, lon: number, z: number, radius: number, horizonKm: number): Tile[] {
    const out: Tile[] = [];
    const n = 2 ** z;
    const cx = Math.floor(lonToX(lon, z));
    const cy = Math.floor(latToY(lat, z));
    const ring: [number, number, number][] = [];
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const y = cy + dy;
        if (y < 0 || y >= n) continue;
        ring.push([cx + dx, y, Math.abs(dx) + Math.abs(dy)]);
      }
    ring.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of ring) {
      const t = this.get(z, x, y);
      const ll = GEO.ll(t.center);
      if (GEO.hav(lat, lon, ll.lat, ll.lon) > horizonKm + 40075 / n) continue;
      out.push(t);
    }
    return out;
  }

  draw(cs: CamState, camLat: number, camLon: number, range: number, fov: number, sun: Vec3, fadeIn: number): void {
    this.credit = '';
    if (fadeIn <= 0.01) return;
    this.init();
    const g = gfx;
    const gl = g.gl;
    const src = SOURCES[this.src]!;
    const viewKm = 2 * range * Math.tan((fov * RAD) / 2);
    const screen = g.h / Math.max(1, g.dpr);
    const want = Math.log2((40075 * Math.max(0.05, Math.cos(camLat * RAD)) * screen) / (256 * Math.max(0.05, viewKm)));
    const z = Math.max(3, Math.min(src.maxZ, Math.round(want + 0.3)));
    this.level = z;
    const horizonKm = Math.sqrt(2 * R_EARTH * cs.alt + cs.alt * cs.alt) * 1.15 + viewKm;
    const coarse = this.select(camLat, camLon, Math.max(2, z - 3), 3, horizonKm);
    const sharp = this.select(camLat, camLon, z, 3, horizonKm);
    for (const t of sharp) this.load(t);
    for (const t of coarse) this.load(t);
    g.use(g.prog.imagery!);
    g.um('uV', cs.V);
    g.um('uP', cs.P);
    g.u3('uCam', cs.pos);
    g.u3('uSun', sun);
    g.u1('uR', R_EARTH);
    g.u1('uFade', fadeIn);
    g.u1('uHaze', Math.max(60, cs.alt * 40));
    g.u1('uDark', src.dark ? 1 : 0);
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
    if (drawn) this.credit = src.credit;
    this.evict();
  }
}

export const imagery = new ImageryLayer();
