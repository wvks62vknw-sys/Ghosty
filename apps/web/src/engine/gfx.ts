/**
 * GHOSTY ENGINE — custom WebGL2 renderer.
 * Instanced glow lines (screen-space width), point sprites, camera-relative rendering,
 * bloom and sensor-mode post-processing. One shared instance: `gfx`.
 */
import { M4, type Mat4, type Vec3 } from './math';

export interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
interface Target {
  t: WebGLTexture;
  f: WebGLFramebuffer;
  d: WebGLRenderbuffer | null;
  w: number;
  h: number;
}

export interface PostSettings {
  /** 0 normal, 1 CRT, 2 NVG, 3 FLIR, 4 NOIR, 6 HOLO */
  mode: number;
  bloom: number;
  scan: number;
  vig: number;
  chroma: number;
  grain: number;
  flash: number;
}

export interface DrawOpts {
  /** Hide anything behind the Earth (1) or not (0). */
  occ?: number;
  /** Line width / point size multiplier. */
  px?: number;
  size?: number;
  R?: number;
}

const QUAD_VS = `in vec2 aP;out vec2 uv;void main(){uv=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}`;

export class Gfx {
  gl!: WebGL2RenderingContext;
  cv!: HTMLCanvasElement;
  w = 1;
  h = 1;
  dpr = 1;
  /** Render-resolution scale chosen by the adaptive quality governor (0.5–1). */
  scale = 1;
  time = 0;
  ready = false;
  theme = { c: [0.36, 0.88, 1] as Vec3, a: [1, 0.69, 0] as Vec3, r: [1, 0.3, 0.42] as Vec3, bg: [0.008, 0.02, 0.04] as Vec3 };
  post: PostSettings = { mode: 0, bloom: 0.9, scan: 0.2, vig: 0.5, chroma: 0.0012, grain: 0.035, flash: 0 };
  V: Mat4 = M4.id();
  P: Mat4 = M4.id();
  near = 0.01;
  camPos: Vec3 = [0, 0, 0];
  cur!: Program;
  prog: Record<string, Program> = {};
  private scene: Target | null = null;
  private b1: Target | null = null;
  private b2: Target | null = null;
  private c1: Target | null = null;
  private c2: Target | null = null;
  private quad!: WebGLVertexArrayObject;
  lineQuad!: WebGLBuffer;
  ptQuad!: WebGLBuffer;

  init(cv: HTMLCanvasElement): boolean {
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    this.cv = cv;
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    this.makeQuad();
    this.makePost();
    this.makeLines();
    this.makePoints();
    this.resize();
    this.ready = true;
    return true;
  }

  mk(name: string, vs: string, fs: string, attrs: Record<string, number>): Program {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, `#version 300 es\nprecision highp float;\n${src}`);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(`shader ${name}: ${gl.getShaderInfoLog(o)}`);
      return o;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    for (const k in attrs) gl.bindAttribLocation(p, attrs[k]!, k);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
    const u: Program['u'] = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const inf = gl.getActiveUniform(p, i)!;
      u[inf.name.replace('[0]', '')] = gl.getUniformLocation(p, inf.name);
    }
    return (this.prog[name] = { p, u });
  }

  use(pr: Program): Program {
    this.gl.useProgram(pr.p);
    this.cur = pr;
    return pr;
  }
  u1(n: string, v: number) {
    const l = this.cur.u[n];
    if (l) this.gl.uniform1f(l, v);
  }
  u2(n: string, a: number, b: number) {
    const l = this.cur.u[n];
    if (l) this.gl.uniform2f(l, a, b);
  }
  u3(n: string, v: ArrayLike<number>) {
    const l = this.cur.u[n];
    if (l) this.gl.uniform3f(l, v[0]!, v[1]!, v[2]!);
  }
  u4(n: string, v: ArrayLike<number>) {
    const l = this.cur.u[n];
    if (l) this.gl.uniform4f(l, v[0]!, v[1]!, v[2]!, v[3]!);
  }
  ui(n: string, v: number) {
    const l = this.cur.u[n];
    if (l) this.gl.uniform1i(l, v);
  }
  um(n: string, m: Mat4) {
    const l = this.cur.u[n];
    if (l) this.gl.uniformMatrix4fv(l, false, m);
  }

  resize(): void {
    if (!this.gl) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
    const w = Math.max(2, Math.floor(this.cv.clientWidth * this.dpr));
    const h = Math.max(2, Math.floor(this.cv.clientHeight * this.dpr));
    if (w === this.w && h === this.h && this.scene) return;
    this.cv.width = w;
    this.cv.height = h;
    this.w = w;
    this.h = h;
    this.makeTargets();
  }

  private tex(w: number, h: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private rt(w: number, h: number, depth = false): Target {
    const gl = this.gl;
    const t = this.tex(w, h);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let d: WebGLRenderbuffer | null = null;
    if (depth) {
      d = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, d);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    }
    return { t, f, d, w, h };
  }

  private kill(r: Target | null) {
    if (!r) return;
    const gl = this.gl;
    gl.deleteTexture(r.t);
    gl.deleteFramebuffer(r.f);
    if (r.d) gl.deleteRenderbuffer(r.d);
  }

  private makeTargets(): void {
    [this.scene, this.b1, this.b2, this.c1, this.c2].forEach((t) => this.kill(t));
    const { w, h } = this;
    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);
    const qw = Math.max(2, w >> 2);
    const qh = Math.max(2, h >> 2);
    this.scene = this.rt(w, h, true);
    this.b1 = this.rt(hw, hh);
    this.b2 = this.rt(hw, hh);
    this.c1 = this.rt(qw, qh);
    this.c2 = this.rt(qw, qh);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  private makeQuad(): void {
    const gl = this.gl;
    this.quad = gl.createVertexArray()!;
    gl.bindVertexArray(this.quad);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  drawQuad(): void {
    this.gl.bindVertexArray(this.quad);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private makePost(): void {
    this.mk('bright', QUAD_VS, `uniform sampler2D t;uniform float th;in vec2 uv;out vec4 o;void main(){vec3 c=texture(t,uv).rgb;float l=max(max(c.r,c.g),c.b);o=vec4(c*smoothstep(th,th+.5,l),1.);}`, { aP: 0 });
    this.mk(
      'blur',
      QUAD_VS,
      `uniform sampler2D t;uniform vec2 d;in vec2 uv;out vec4 o;void main(){vec3 s=texture(t,uv).rgb*.2270270270;s+=texture(t,uv+d*1.3846153846).rgb*.3162162162;s+=texture(t,uv-d*1.3846153846).rgb*.3162162162;s+=texture(t,uv+d*3.2307692308).rgb*.0702702703;s+=texture(t,uv-d*3.2307692308).rgb*.0702702703;o=vec4(s,1.);}`,
      { aP: 0 },
    );
    this.mk(
      'comp',
      QUAD_VS,
      `uniform sampler2D t,b1,b2;uniform float bl,scan,vig,chroma,grain,flash,time;uniform int mode;uniform vec3 tint;uniform vec2 res;in vec2 uv;out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 iron(float x){x=clamp(x,0.,1.);vec3 a=vec3(0.,0.,.05),b=vec3(.35,0.,.55),c=vec3(.85,.15,.25),d=vec3(1.,.65,0.),e=vec3(1.,1.,.85);
 if(x<.25)return mix(a,b,x/.25);if(x<.5)return mix(b,c,(x-.25)/.25);if(x<.75)return mix(c,d,(x-.5)/.25);return mix(d,e,(x-.75)/.25);}
void main(){vec2 p=uv;if(mode==1){vec2 q=p*2.-1.;q*=1.+dot(q,q)*.06;p=q*.5+.5;}
 vec2 ca=(p-.5)*chroma;vec3 c=vec3(texture(t,p+ca).r,texture(t,p).g,texture(t,p-ca).b);
 vec3 bg=texture(b1,p).rgb*.8+texture(b2,p).rgb*1.1;c+=bg*bl;float lum=dot(c,vec3(.299,.587,.114));
 if(mode==1){float sl=.82+.18*sin(p.y*res.y*3.14159);c*=sl;c+=(h(p*res+time)-.5)*.06;}
 else if(mode==2){float l=lum*1.6+h(p*res+time)*.12;c=vec3(.08,1.,.18)*l*1.1;vec2 q=p*2.-1.;c*=1.-smoothstep(.75,1.15,length(q*vec2(res.x/res.y,1.)*.8));}
 else if(mode==3){c=iron(lum*1.5+bg.r*.3);}
 else if(mode==4){float l=pow(lum*1.3,.9);c=vec3(l)+(h(p*res+time)-.5)*.08;}
 else if(mode==6){c=mix(vec3(lum),tint*lum*1.8,.75)+c*.25;}
 float sc=.5+.5*sin(p.y*res.y*1.2+time*2.);c*=1.-scan*(1.-sc)*.12;
 vec2 q=uv*2.-1.;c*=1.-vig*dot(q*.62,q*.62);c+=(h(uv*res+time*7.)-.5)*grain;c+=flash*tint;o=vec4(c,1.);}`,
      { aP: 0 },
    );
  }

  /** Begin a frame: render into the off-screen scene target. */
  begin(clear: Vec3 = [0.008, 0.016, 0.03]): void {
    const gl = this.gl;
    this.resize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene!.f);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Finish a frame: bloom + post-processing onto the screen. */
  present(): void {
    const gl = this.gl;
    const P = this.post;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const pass = (src: Target, dst: Target | null, prog: Program, setup: () => void) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
      gl.viewport(0, 0, dst ? dst.w : this.w, dst ? dst.h : this.h);
      this.use(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.t);
      this.ui('t', 0);
      setup();
      this.drawQuad();
    };
    const blur = (src: Target, dst: Target, dx: number, dy: number) => pass(src, dst, this.prog.blur!, () => this.u2('d', dx / src.w, dy / src.h));
    if (P.bloom > 0) {
      pass(this.scene!, this.b1!, this.prog.bright!, () => this.u1('th', 0.35));
      blur(this.b1!, this.b2!, 1.2, 0);
      blur(this.b2!, this.b1!, 0, 1.2);
      blur(this.b1!, this.c1!, 0, 0);
      blur(this.c1!, this.c2!, 2, 0);
      blur(this.c2!, this.c1!, 0, 2);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    this.use(this.prog.comp!);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene!.t);
    this.ui('t', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.b1!.t);
    this.ui('b1', 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.c1!.t);
    this.ui('b2', 2);
    this.u1('bl', P.bloom);
    this.u1('scan', P.scan);
    this.u1('vig', P.vig);
    this.u1('chroma', P.chroma);
    this.u1('grain', P.grain);
    this.u1('flash', P.flash);
    this.u1('time', this.time % 100);
    const mode = this.cur.u.mode;
    if (mode) gl.uniform1i(mode, P.mode);
    this.u3('tint', this.theme.c);
    this.u2('res', this.w, this.h);
    this.drawQuad();
    gl.activeTexture(gl.TEXTURE0);
  }

  cam(view: Mat4, proj: Mat4, near = 0.01, camPos: Vec3 = [0, 0, 0]): void {
    this.V = view;
    this.P = proj;
    this.near = near;
    this.camPos = camPos;
  }

  additive(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
  }

  private makeLines(): void {
    this.mk(
      'line',
      `in vec2 aQ;in vec3 aA;in vec3 aB;in vec4 aC;in float aW;
uniform mat4 uMV,uP;uniform vec2 uRes;uniform float uNear,uPx,uOcc;uniform vec3 uCam;uniform float uR;out vec4 vC;out float vE;
bool hidden(vec3 wp){vec3 d=wp-uCam;float L=length(d);vec3 n=d/L;float t=clamp(-dot(uCam,n),0.,L);return length(uCam+n*t)<uR*.9985;}
void main(){if(uOcc>.5&&hidden(aA)&&hidden(aB)){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec4 va=uMV*vec4(aA,1.),vb=uMV*vec4(aB,1.);float nz=-uNear;
 if(va.z>nz&&vb.z>nz){gl_Position=vec4(2.,2.,2.,1.);return;}
 if(va.z>nz)va.xyz=mix(va.xyz,vb.xyz,(nz-va.z)/(vb.z-va.z));if(vb.z>nz)vb.xyz=mix(vb.xyz,va.xyz,(nz-vb.z)/(va.z-vb.z));
 vec4 ca=uP*va,cb=uP*vb;vec2 sa=ca.xy/ca.w*uRes*.5,sb=cb.xy/cb.w*uRes*.5;vec2 d=sb-sa;float dl=length(d);d=dl>1e-4?d/dl:vec2(1.,0.);vec2 n=vec2(-d.y,d.x);
 float w=aW*uPx;vec4 pc=mix(ca,cb,aQ.x);vec2 off=n*aQ.y*w*.5+d*(aQ.x*2.-1.)*w*.5;pc.xy+=off/uRes*2.*pc.w;gl_Position=pc;vE=aQ.y;vC=aC;}`,
      `in vec4 vC;in float vE;out vec4 o;void main(){float e=abs(vE);float a=pow(1.-e,1.6);float core=smoothstep(.55,0.,e);vec3 col=vC.rgb*(.55+core*.9);o=vec4(col*vC.a*a,vC.a*a);}`,
      { aQ: 0, aA: 1, aB: 2, aC: 3, aW: 4 },
    );
    const gl = this.gl;
    this.lineQuad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.ptQuad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  private makePoints(): void {
    // Point kinds (aK): 0 glow dot, 1 ring, 2 diamond, 3 aircraft (rotated to heading), 4 satellite cross, 5 ship (rotated to heading).
    this.mk(
      'pt',
      `in vec2 aQ;in vec3 aP;in vec4 aC;in float aS;in float aK;in float aR;
uniform mat4 uMV,uP;uniform vec2 uRes;uniform float uPx,uOcc,uNear,uR,uSizeMul;uniform vec3 uCam;out vec4 vC;out vec2 vU;out float vK;
void main(){if(uOcc>.5){vec3 d=aP-uCam;float L=length(d);vec3 n=d/L;float t=clamp(-dot(uCam,n),0.,L);if(length(uCam+n*t)<uR*.9985){gl_Position=vec4(2.,2.,2.,1.);return;}}
 vec4 v=uMV*vec4(aP,1.);if(v.z>-uNear){gl_Position=vec4(2.,2.,2.,1.);return;}vec4 c=uP*v;float rot=0.;
 if((aK>=3.&&aK<3.5)||(aK>=5.&&aK<5.5)){vec3 nu=normalize(aP);vec3 east=normalize(cross(vec3(0.,0.,1.),nu));vec3 north=cross(nu,east);vec3 dir=east*sin(aR)+north*cos(aR);vec4 v2=uMV*vec4(aP+dir*50.,1.);
  if(v2.z<-uNear){vec4 c2=uP*v2;vec2 s1=c.xy/c.w*uRes,s2=c2.xy/c2.w*uRes;vec2 dd=s2-s1;rot=atan(dd.x,dd.y);}}
 float sz=aS*uPx*uSizeMul;float cr=cos(rot),sr=sin(rot);vec2 q=aQ*sz*.5;vec2 qq=vec2(q.x*cr+q.y*sr,-q.x*sr+q.y*cr);c.xy+=qq/uRes*2.*c.w;gl_Position=c;vC=aC;vU=aQ;vK=aK;}`,
      `in vec4 vC;in vec2 vU;in float vK;out vec4 o;
void main(){float r=length(vU);float a;vec3 col=vC.rgb;
 if(vK<.5){a=pow(max(1.-r,0.),2.2);col*=1.+a*1.5;}
 else if(vK<1.5){a=smoothstep(.12,0.,abs(r-.78))*step(r,1.);}
 else if(vK<2.5){float d=abs(vU.x)+abs(vU.y);a=(smoothstep(.1,0.,abs(d-.7))+smoothstep(.34,0.,d)*.6)*step(d,1.);}
 else if(vK<3.5){vec2 p=vU*1.25;float body=step(abs(p.x),.2)*step(abs(p.y),.9);float wing=smoothstep(.1,0.,abs(p.y+.1+abs(p.x)*.55)-.12)*step(abs(p.x),.82);float tail=smoothstep(.1,0.,abs(p.y+.78+abs(p.x)*.9)-.08)*step(abs(p.x),.34);a=clamp(max(max(body,wing),tail),0.,1.);}
 else if(vK<4.5){float d=abs(vU.x)+abs(vU.y);a=smoothstep(.12,0.,d-.75)*.9+(1.-smoothstep(0.,.5,r))*.4;}
 else{vec2 p=vU*1.15;float w=.36*clamp((.95-p.y)/.6,0.,1.);float hull=smoothstep(.08,0.,abs(p.x)-w)*step(-.85,p.y)*step(p.y,.95);float br=smoothstep(.06,0.,abs(p.x)-.14)*step(-.55,p.y)*step(p.y,-.25);a=clamp(hull-br*.55,0.,1.);}
 if(a<.01)discard;o=vec4(col*vC.a*a,vC.a*a);}`,
      { aQ: 0, aP: 1, aC: 2, aS: 3, aK: 4, aR: 5 },
    );
  }
}

export const gfx = new Gfx();

/** A growable batch of glow line segments drawn with one instanced call. */
export class LineSet {
  n = 0;
  private data: Float32Array;
  private dirty = true;
  private vao: WebGLVertexArrayObject | null = null;
  private buf: WebGLBuffer | null = null;
  private gpuCap = 0;
  constructor(private cap = 4096) {
    this.data = new Float32Array(cap * 11);
  }
  clear(): this {
    this.n = 0;
    this.dirty = true;
    return this;
  }
  add(a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>, w = 1): this {
    if (this.n >= this.cap) {
      const nd = new Float32Array(this.cap * 2 * 11);
      nd.set(this.data);
      this.data = nd;
      this.cap *= 2;
    }
    const d = this.data;
    const o = this.n * 11;
    d[o] = a[0]!;
    d[o + 1] = a[1]!;
    d[o + 2] = a[2]!;
    d[o + 3] = b[0]!;
    d[o + 4] = b[1]!;
    d[o + 5] = b[2]!;
    d[o + 6] = c[0]!;
    d[o + 7] = c[1]!;
    d[o + 8] = c[2]!;
    d[o + 9] = c.length > 3 ? c[3]! : 1;
    d[o + 10] = w;
    this.n++;
    this.dirty = true;
    return this;
  }
  circle(cx: number, cy: number, cz: number, r: number, n: number, c: ArrayLike<number>, w = 1, a0 = 0, a1 = Math.PI * 2): this {
    let p: number[] | null = null;
    for (let i = 0; i <= n; i++) {
      const t = a0 + ((a1 - a0) * i) / n;
      const q = [cx + Math.cos(t) * r, cy + Math.sin(t) * r, cz];
      if (p) this.add(p, q, c, w);
      p = q;
    }
    return this;
  }
  private upload(): void {
    const gl = gfx.gl;
    if (!this.vao) {
      this.vao = gl.createVertexArray()!;
      this.buf = gl.createBuffer()!;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.lineQuad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      for (const [l, s, o] of [
        [1, 3, 0],
        [2, 3, 12],
        [3, 4, 24],
        [4, 1, 40],
      ] as const) {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, s, gl.FLOAT, false, 44, o);
        gl.vertexAttribDivisor(l, 1);
      }
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    // Re-allocate only when the batch outgrows the GPU buffer; otherwise update in place.
    if (this.cap > this.gpuCap) {
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      this.gpuCap = this.cap;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 11);
    this.dirty = false;
  }
  draw(model: Mat4 = M4.id(), o: DrawOpts = {}): void {
    if (!this.n) return;
    const g = gfx;
    if (this.dirty) this.upload();
    g.use(g.prog.line!);
    g.um('uMV', M4.mul(g.V, model));
    g.um('uP', g.P);
    g.u2('uRes', g.w, g.h);
    g.u1('uNear', g.near);
    g.u1('uPx', g.dpr * (o.px ?? 1));
    g.u1('uOcc', o.occ ?? 0);
    g.u3('uCam', g.camPos);
    g.u1('uR', o.R ?? 6371);
    g.gl.bindVertexArray(this.vao);
    g.gl.drawArraysInstanced(g.gl.TRIANGLE_STRIP, 0, 4, this.n);
  }
}

/** A growable batch of point sprites (dots, rings, aircraft, satellites…). */
export class PointSet {
  n = 0;
  private data: Float32Array;
  private dirty = true;
  private vao: WebGLVertexArrayObject | null = null;
  private buf: WebGLBuffer | null = null;
  private gpuCap = 0;
  constructor(private cap = 1024) {
    this.data = new Float32Array(cap * 10);
  }
  clear(): this {
    this.n = 0;
    this.dirty = true;
    return this;
  }
  /** kind: 0 glow dot, 1 ring, 2 diamond, 3 aircraft (rot = heading in radians), 4 satellite, 5 ship (rot = heading). */
  add(p: ArrayLike<number>, c: ArrayLike<number>, size = 6, kind = 0, rot = 0): this {
    if (this.n >= this.cap) {
      const nd = new Float32Array(this.cap * 2 * 10);
      nd.set(this.data);
      this.data = nd;
      this.cap *= 2;
    }
    const d = this.data;
    const o = this.n * 10;
    d[o] = p[0]!;
    d[o + 1] = p[1]!;
    d[o + 2] = p[2]!;
    d[o + 3] = c[0]!;
    d[o + 4] = c[1]!;
    d[o + 5] = c[2]!;
    d[o + 6] = c.length > 3 ? c[3]! : 1;
    d[o + 7] = size;
    d[o + 8] = kind;
    d[o + 9] = rot;
    this.n++;
    this.dirty = true;
    return this;
  }
  private upload(): void {
    const gl = gfx.gl;
    if (!this.vao) {
      this.vao = gl.createVertexArray()!;
      this.buf = gl.createBuffer()!;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.ptQuad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      for (const [l, s, o] of [
        [1, 3, 0],
        [2, 4, 12],
        [3, 1, 28],
        [4, 1, 32],
        [5, 1, 36],
      ] as const) {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, s, gl.FLOAT, false, 40, o);
        gl.vertexAttribDivisor(l, 1);
      }
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (this.cap > this.gpuCap) {
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      this.gpuCap = this.cap;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 10);
    this.dirty = false;
  }
  draw(model: Mat4 = M4.id(), o: DrawOpts = {}): void {
    if (!this.n) return;
    const g = gfx;
    if (this.dirty) this.upload();
    g.use(g.prog.pt!);
    g.um('uMV', M4.mul(g.V, model));
    g.um('uP', g.P);
    g.u2('uRes', g.w, g.h);
    g.u1('uNear', g.near);
    g.u1('uPx', g.dpr * (o.px ?? 1));
    g.u1('uOcc', o.occ ?? 0);
    g.u3('uCam', g.camPos);
    g.u1('uR', o.R ?? 6371);
    g.u1('uSizeMul', o.size ?? 1);
    g.gl.bindVertexArray(this.vao);
    g.gl.drawArraysInstanced(g.gl.TRIANGLE_STRIP, 0, 4, this.n);
  }
}
