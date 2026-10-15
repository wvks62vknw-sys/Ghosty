/**
 * GOD'S EYE globe scene: procedural Earth (land, biomes, ocean, ice, clouds, city lights,
 * day/night terminator), atmosphere, stars, sun, and the vector base layers.
 * Live data layers (aircraft, satellites, hazards) plug in through `GlobeLayer`.
 */
import { GeoCam, type CamState } from './camera';
import { GEO, R_EARTH } from './geo';
import { gfx, LineSet, PointSet, type DrawOpts } from './gfx';
import { M4, RAD, V3, rng, type Mat4, type Vec3 } from './math';
import { buildTextures, type TextureSet } from './textures';
import { World } from './world';

const NOISE = `
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}`;

const GLOBE_FS = `uniform sampler2D uGeo,uBio,uLights;uniform float uTime,uClouds,uAlt;uniform vec3 uSun,uCam,uTheme;uniform float uR;
in vec3 vN;in vec3 vW;out vec4 o;${NOISE}
void main(){
 vec3 n=normalize(vN);vec3 V=normalize(uCam-vW);
 vec2 uv=vec2(atan(n.y,n.x)/6.2831853+.5,.5-asin(clamp(n.z,-1.,1.))/3.14159265);
 vec2 dx=dFdx(uv),dy=dFdy(uv);dx.x-=round(dx.x);dy.x-=round(dy.x);
 vec4 G=textureGrad(uGeo,uv,dx,dy),B=textureGrad(uBio,uv,dx,dy);
 float land=G.r,inl=G.g,shelf=G.b,ice=G.a;float lat=asin(clamp(n.z,-1.,1.));float alat=abs(lat)/1.5708;
 float nd=dot(n,uSun);float nz=fbm(n*6.),nz2=fbm(n*34.+4.),nz3=fbm3(n*150.);float ocnoise=fbm3(n*480.+uTime*.01);
 float elev=B.r*(.5+.7*nz2)+(nz-.5)*.2*land+inl*.1+nz3*.12*B.r;
 float arid=clamp(B.g*1.15+(nz-.5)*.7+inl*.16-B.b*.85,0.,1.);
 float lush=clamp(B.b*1.2+.35-alat*.4+(nz-.5)*.4-B.g*.6,0.,1.);
 vec3 desert=mix(vec3(.76,.62,.38),vec3(.58,.40,.24),fbm3(n*60.));vec3 grass=mix(vec3(.36,.44,.21),vec3(.17,.33,.11),lush);
 vec3 col=mix(grass,desert,smoothstep(.3,.7,arid));col=mix(col,vec3(.06,.18,.07),smoothstep(.55,.95,lush)*(1.-arid)*.75);
 col=mix(col,vec3(.35,.39,.32),smoothstep(.6,.82,alat)*.75);col=mix(col,vec3(.43,.38,.33),smoothstep(.22,.55,elev));
 col=mix(col,vec3(.92,.94,.97),smoothstep(.6,.82,elev+alat*.12));col*=.88+.24*nz3;
 col=mix(col,vec3(.92,.96,1.),max(ice,smoothstep(.9,.96,alat+(nz-.5)*.05)));
 vec3 oc=mix(vec3(.004,.028,.095),vec3(.008,.115,.27),smoothstep(0.,.38,shelf));oc=mix(oc,vec3(.03,.36,.50),smoothstep(.5,1.,shelf));
 float seaIce=smoothstep(.88,.94,alat+(nz-.5)*.07);oc=mix(oc,vec3(.85,.92,.98),seaIce);oc+=vec3(.2,.5,.55)*smoothstep(.55,1.,shelf)*(1.-land)*.19;
 vec3 alb=mix(oc,col,land);
 float hgt=elev*land*9.;vec3 sx=dFdx(vW),sy=dFdy(vW);vec3 r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);
 vec3 grad=sign(det)*(dFdx(hgt)*r1+dFdy(hgt)*r2);float wv=ocnoise*(1.-land);vec3 gw=sign(det)*(dFdx(wv)*r1+dFdy(wv)*r2);
 vec3 Nw=normalize(abs(det)*n-gw*.9*(1.-land)-grad*14.*land*mix(.12,1.,smoothstep(200.,6000.,uAlt)));
 float diff=max(dot(Nw,uSun),0.);float day=smoothstep(-.10,.22,nd);float lowA=1.-smoothstep(800.,5000.,uAlt);
 vec3 L=alb*(diff*(1.05+.5*lowA)+.025+.12*lowA)*day;
 vec3 H=normalize(uSun+V);L+=vec3(1.,.95,.8)*pow(max(dot(Nw,H),0.),2200.)*(1.-land)*(1.-seaIce)*day*.16;
 float nt=1.-smoothstep(-.06,.16,nd);vec3 NL=textureGrad(uLights,uv,dx,dy).rgb;
 L+=vec3(1.,.72,.38)*NL.r*.75*nt*mix(.16,1.,smoothstep(250.,6000.,uAlt))*(1.-ice*.6);
 L+=alb*vec3(.02,.03,.06)*nt*.8+vec3(.004,.008,.02)*nt;
 if(uClouds>.5){vec3 cp=n*2.6+vec3(0.,0.,uTime*.0016);float f=fbm(cp*1.8+fbm(cp*3.)*.9);float cl=smoothstep(.52,.82,f)*(.55+.45*fbm3(n*90.));
  L=mix(L,vec3(.94,.97,1.)*(diff*.62*day+.02)+vec3(.01,.015,.03)*nt,cl*.74);}
 float rim=pow(1.-max(dot(n,V),0.),3.);float term=exp(-pow(nd/.14,2.));
 L+=mix(vec3(.18,.45,1.),vec3(1.,.5,.22),term*.9)*rim*(smoothstep(-.3,.4,nd)*.95+.04)*mix(.1,1.,smoothstep(40.,1800.,uAlt));
 L+=vec3(1.,.55,.25)*term*.05*(1.-land*.4);L+=uTheme*.012*sin(vW.z*.04-uTime*.5);
 o=vec4(L,1.);}`;

const ATMO_FS = `uniform vec3 uCam,uF,uRt,uUp,uSun;uniform float uR,uH,uTy,uAsp;in vec2 uv;out vec4 o;
void main(){vec3 d=normalize(uF+uRt*uv.x*uTy*uAsp+uUp*uv.y*uTy);float t0=-dot(uCam,d);if(t0<0.){o=vec4(0);return;}vec3 c=uCam+d*t0;float b=length(c);
 float h=(b-uR)/uH;if(h<0.||h>1.){o=vec4(0);return;}float g=pow(1.-h,3.4);float sd=dot(normalize(c),uSun);float day=smoothstep(-.35,.5,sd);float term=exp(-pow(sd/.18,2.));
 o=vec4(mix(vec3(.15,.42,1.),vec3(1.,.55,.25),term*.8)*g*(day*1.2+.05)*1.15,1.);}`;

/** Sensor modes for the globe post-processing. [label, post mode] */
export const SENSOR_MODES: [string, number][] = [
  ['NORMAL', 0],
  ['HOLO', 6],
  ['CRT', 1],
  ['NVG', 2],
  ['FLIR', 3],
  ['NOIR', 4],
];

export interface LayerVisibility {
  coast: boolean;
  borders: boolean;
  adm1: boolean;
  grid: boolean;
  cities: boolean;
  airports: boolean;
  clouds: boolean;
  air: boolean;
  sats: boolean;
  quakes: boolean;
  events: boolean;
  orbits: boolean;
  route: boolean;
}

export interface Pickable {
  kind: string;
  ref: unknown;
  w: Vec3;
}

/** A live data layer drawn on the globe. */
export interface GlobeLayer {
  id: keyof LayerVisibility;
  update?(dt: number): void;
  draw(cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void;
  /** Points that can be tapped/clicked. */
  pickables?(now: number): Iterable<Pickable>;
}

export class GlobeScene {
  cam = new GeoCam();
  mode = 0;
  sunLock = false;
  vis: LayerVisibility = { coast: true, borders: true, adm1: true, grid: true, cities: true, airports: true, clouds: true, air: true, sats: true, quakes: true, events: true, orbits: true, route: true };
  layers: GlobeLayer[] = [];
  sunDir: Vec3 = [1, 0, 0];
  private ready = false;
  private texReady = false;
  private sphereVao!: WebGLVertexArrayObject;
  private sphereCount = 0;
  private tex: { geo: WebGLTexture | null; bio: WebGLTexture | null; lights: WebGLTexture | null } = { geo: null, bio: null, lights: null };
  private blank!: WebGLTexture;
  private stars = new PointSet(2600);
  private sun = new PointSet(4);
  private base: Record<string, LineSet> = {};
  private cityPts = new PointSet(1400);
  private airPts = new PointSet(1000);

  init(): void {
    if (this.ready) return;
    const g = gfx;
    const gl = g.gl;
    g.mk('globe', `in vec3 aD;uniform mat4 uV,uP;uniform vec3 uCam;uniform float uR;out vec3 vN;out vec3 vW;void main(){vec3 w=aD*uR;vN=aD;vW=w;gl_Position=uP*(uV*vec4(w-uCam,1.));}`, GLOBE_FS, { aD: 0 });
    g.mk('atmo', `in vec2 aP;out vec2 uv;void main(){uv=aP;gl_Position=vec4(aP,.9999,1.);}`, ATMO_FS, { aP: 0 });
    const NA = 256;
    const NB = 128;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= NB; j++) {
      const la = Math.PI / 2 - (Math.PI * j) / NB;
      for (let i = 0; i <= NA; i++) {
        const lo = ((Math.PI * 2 * i) / NA) - Math.PI;
        pos.push(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
      }
    }
    for (let j = 0; j < NB; j++)
      for (let i = 0; i < NA; i++) {
        const a = j * (NA + 1) + i;
        const b = a + NA + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    this.sphereVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.sphereVao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    this.sphereCount = idx.length;
    gl.bindVertexArray(null);
    this.blank = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    const r = rng(21);
    for (let i = 0; i < 2600; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const tn = r();
      this.stars.add([420 * s * Math.cos(t), 420 * u, 420 * s * Math.sin(t)], [0.6 + tn * 0.4, 0.8 + tn * 0.2, 1, (0.25 + r() * 0.75) * 0.8], 1 + r() * r() * 3.2, 0);
    }
    this.buildBase();
    this.loadTextures();
    this.ready = true;
  }

  /** Rebuild vector layers (call after a theme change). */
  buildBase(): void {
    const c = gfx.theme.c;
    const a = gfx.theme.a;
    const lines = (arr: Float32Array[], lift: number, col: number[], w: number) => {
      const ls = new LineSet(arr.length * 20);
      for (const ring of arr) {
        let p: Vec3 | null = null;
        for (let i = 0; i < ring.length; i += 2) {
          const q = GEO.ecef(ring[i + 1]!, ring[i]!, lift);
          if (p && Math.abs(ring[i]! - ring[i - 2]!) < 40) ls.add(p, q, col, w);
          p = q;
        }
      }
      return ls;
    };
    this.base.coast = lines(World.land.flat(), 1.2, [c[0], c[1], c[2], 0.55], 1.1);
    this.base.border = lines(World.borders, 1.0, [a[0], a[1], a[2], 0.38], 1.0);
    this.base.adm1 = lines(World.adm1, 0.9, [c[0], c[1], c[2], 0.16], 0.8);
    this.base.river = lines(World.rivers, 0.8, [0.4, 0.7, 1, 0.18], 0.8);
    const grid = new LineSet(4000);
    for (let la = -75; la <= 75; la += 15) {
      let p: Vec3 | null = null;
      for (let lo = -180; lo <= 180; lo += 3) {
        const q = GEO.ecef(la, lo, 1.4);
        if (p) grid.add(p, q, [c[0], c[1], c[2], 0.12], la === 0 ? 1.4 : 0.8);
        p = q;
      }
    }
    for (let lo = -180; lo < 180; lo += 15) {
      let p: Vec3 | null = null;
      for (let la = -90; la <= 90; la += 3) {
        const q = GEO.ecef(la, lo, 1.4);
        if (p) grid.add(p, q, [c[0], c[1], c[2], 0.12], lo === 0 ? 1.4 : 0.8);
        p = q;
      }
    }
    this.base.grid = grid;
    this.cityPts.clear();
    for (const ct of World.cities) this.cityPts.add(GEO.ecef(ct.lat, ct.lon, 2), [1, 0.82, 0.5, 0.85], ct.pop > 5e6 ? 7 : ct.pop > 1e6 ? 5 : ct.pop > 3e5 ? 3.5 : 2.5, 0);
    this.airPts.clear();
    for (const ap of World.airports) if (ap.rank <= 7 || ap.type === 'major') this.airPts.add(GEO.ecef(ap.lat, ap.lon, 1.5), [0.7, 1, 0.9, 0.8], ap.type === 'major' ? 5 : 3.2, 2);
  }

  private upload(src: TexImageSource | Uint8Array, W: number, H: number): WebGLTexture {
    const gl = gfx.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (src instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }

  private loadTextures(): void {
    const apply = (t: { W: number; H: number; geo: Uint8Array; bio: TexImageSource; lights: TexImageSource }) => {
      this.tex.geo = this.upload(t.geo, t.W, t.H);
      this.tex.bio = this.upload(t.bio, 1024, 512);
      this.tex.lights = this.upload(t.lights, t.W, t.H);
      this.texReady = true;
    };
    const fallback = () => {
      if (!World.pack) return;
      const t: TextureSet = buildTextures(World.pack, (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
      apply(t as { W: number; H: number; geo: Uint8Array; bio: HTMLCanvasElement; lights: HTMLCanvasElement });
    };
    try {
      const w = new Worker('/textures.worker.js');
      w.onmessage = (e: MessageEvent) => {
        w.terminate();
        if (e.data?.ok) apply(e.data);
        else fallback();
      };
      w.onerror = () => {
        w.terminate();
        fallback();
      };
      w.postMessage('build');
    } catch {
      fallback();
    }
  }

  update(dt: number): void {
    this.cam.update(dt);
    for (const l of this.layers) l.update?.(dt);
  }

  draw(): void {
    const g = gfx;
    const gl = g.gl;
    const c = this.cam;
    const cs = c.state();
    const t = g.time;
    if (this.sunLock) {
      const en = GEO.enu(c.lat, c.lon);
      this.sunDir = V3.norm(V3.add(V3.add(V3.mul(en.u, 0.8), V3.mul(en.e, -0.35)), V3.mul(en.n, 0.25)));
    } else {
      const s = GEO.sun(Date.now());
      this.sunDir = V3.norm(GEO.ecef(s.lat, s.lon, 0));
    }
    const sun = this.sunDir;
    g.begin([0.003, 0.006, 0.014]);
    g.cam(cs.V, M4.persp(c.fov * RAD, g.w / g.h, 1, 2000), 1, [0, 0, 0]);
    g.additive();
    this.stars.draw(M4.rotZ(t * 0.0003), { px: 1 });
    this.sun.clear().add(V3.mul(sun, 900), [1, 0.93, 0.78, 1], 160, 0).add(V3.mul(sun, 900), [1, 0.8, 0.5, 0.16], 420, 0);
    this.sun.draw(M4.id(), { px: Math.max(0.6, g.h / 900) });
    const d = V3.len(cs.pos);
    g.use(g.prog.atmo!);
    g.u3('uCam', cs.pos);
    g.u3('uF', cs.f);
    g.u3('uRt', cs.r);
    g.u3('uUp', cs.u);
    g.u3('uSun', sun);
    g.u1('uR', R_EARTH);
    g.u1('uH', Math.max(90, Math.min(420, d * 0.04)));
    g.u1('uTy', Math.tan((c.fov * RAD) / 2));
    g.u1('uAsp', g.w / g.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    g.drawQuad();
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    g.use(g.prog.globe!);
    g.um('uV', cs.V);
    g.um('uP', cs.P);
    g.u3('uCam', cs.pos);
    g.u1('uR', R_EARTH);
    g.u3('uSun', sun);
    g.u3('uTheme', g.theme.c);
    g.u1('uTime', t);
    g.u1('uClouds', this.vis.clouds && cs.alt > 6 ? 1 : 0);
    g.u1('uAlt', cs.alt);
    const bind = (u: string, tex: WebGLTexture | null, n: number) => {
      gl.activeTexture(gl.TEXTURE0 + n);
      gl.bindTexture(gl.TEXTURE_2D, this.texReady && tex ? tex : this.blank);
      g.ui(u, n);
    };
    bind('uGeo', this.tex.geo, 0);
    bind('uBio', this.tex.bio, 1);
    bind('uLights', this.tex.lights, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.sphereVao);
    gl.drawElements(gl.TRIANGLES, this.sphereCount, gl.UNSIGNED_INT, 0);

    g.cam(cs.V, cs.P, cs.near, cs.pos);
    g.additive();
    const rel = M4.trans(-cs.pos[0], -cs.pos[1], -cs.pos[2]);
    const oc: DrawOpts = { occ: 1, R: R_EARTH };
    const alt = cs.alt;
    const v = this.vis;
    if (v.grid && this.mode !== 5) this.base.grid?.draw(rel, { ...oc, px: 1 });
    if (v.coast) this.base.coast?.draw(rel, { ...oc, px: 1.05 });
    if (v.borders) this.base.border?.draw(rel, { ...oc, px: 1 });
    if (v.adm1 && alt < 5000) this.base.adm1?.draw(rel, { ...oc, px: 0.9 });
    if (v.adm1 && alt < 2500) this.base.river?.draw(rel, { ...oc, px: 0.9 });
    if (v.cities) this.cityPts.draw(rel, { ...oc, px: 1 });
    if (v.airports && alt < 3500) this.airPts.draw(rel, { ...oc, px: 1 });
    const sizeMul = Math.max(0.55, Math.min(1.4, 1.2 - Math.log10(Math.max(50, alt)) * 0.14));
    const now = Date.now();
    for (const l of this.layers) if (v[l.id]) l.draw(cs, rel, oc, sizeMul, now);
    g.post.mode = SENSOR_MODES[this.mode]?.[1] ?? 0;
    g.post.bloom = this.mode === 0 ? 0.85 : 1.1;
    g.post.scan = this.mode === 0 ? 0.15 : 0.5;
    g.present();
  }

  /** Nearest pickable thing to a screen point, within `radius` pixels. */
  pickAt(px: number, py: number, radius = 28): Pickable | null {
    const now = Date.now();
    let best: Pickable | null = null;
    let bd = radius * radius;
    for (const l of this.layers) {
      if (!this.vis[l.id] || !l.pickables) continue;
      for (const it of l.pickables(now)) {
        const p = this.cam.project(it.w);
        if (!p) continue;
        const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
        if (d < bd && this.cam.visible(it.w)) {
          bd = d;
          best = it;
        }
      }
    }
    if (!best && this.vis.cities) {
      for (const c of World.cities) {
        if (c.pop < 2e5) continue;
        const w = GEO.ecef(c.lat, c.lon, 2);
        const p = this.cam.project(w);
        if (!p) continue;
        const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
        if (d < bd && this.cam.visible(w)) {
          bd = d;
          best = { kind: 'city', ref: c, w };
        }
      }
    }
    return best;
  }
}

export const globe = new GlobeScene();
