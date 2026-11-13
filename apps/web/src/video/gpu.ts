/**
 * THE PICTURE (BRIEF-EDITOR-VIDEO): the app's own WebGL2 pipeline. One layer program draws a frame of a clip with its transform,
 * crop, grade, LUT (a 3-D texture), chroma key, mask and opacity; a transition program blends the two main layers; overlays,
 * the title and the subtitle go on top. The screen draws at the screen's size for speed and the export draws the same code at the
 * export's size. The grade is grade.ts line for line (the brain test proves that file on numbers).
 */
import type { Chroma, Grade, Mask } from './model';
import { flatGrade, isFlat } from './model';
import { monotoneCurve } from './grade';

export interface Layer {
  /** The frame: a video element, a bitmap or a canvas. */
  el: CanvasImageSource;
  /** Its size in pixels. */
  w: number;
  h: number;
  crop: { x: number; y: number; w: number; h: number };
  fit: 'fit' | 'fill';
  x: number;
  y: number;
  scale: number;
  rot: number;
  opacity: number;
  grade?: Grade;
  lut?: string;
  mask?: Mask;
  chroma?: Chroma;
}
export interface FrameSpec {
  main: Layer | null;
  mainB?: Layer | null;
  tr?: { kind: 'crossfade' | 'dip' | 'wipe' | 'slide'; p: number } | null;
  overlays: Layer[];
  text?: CanvasImageSource | null;
}

const VERT = `#version 300 es
in vec2 aPos;
uniform vec2 uCanvas; uniform vec2 uSize; uniform vec2 uCenter; uniform float uRot;
uniform vec4 uCrop;
out vec2 vUV; out vec2 vUnit;
void main() {
  vec2 p = (aPos - 0.5) * uSize;
  float c = cos(uRot), s = sin(uRot);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + uCenter;
  gl_Position = vec4(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0, 0.0, 1.0);
  vUnit = aPos;
  vUV = uCrop.xy + aPos * uCrop.zw;
}`;

const LAYER = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vUV; in vec2 vUnit; out vec4 o;
uniform sampler2D uTex; uniform sampler3D uLut; uniform sampler2D uCurve;
uniform float uOpacity;
uniform bool uGrade; uniform float uExp; uniform vec3 uWB; uniform vec4 uToneA; uniform vec2 uToneB; uniform float uSat; uniform float uVib; uniform bool uUseCurve;
uniform bool uUseLut; uniform float uLutN;
uniform bool uChroma; uniform vec3 uKey; uniform float uTol; uniform float uSoft;
uniform int uMask; uniform vec4 uMaskR; uniform float uMaskF; uniform bool uMaskInv;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec2 chroma(vec3 c) { return vec2(-0.168736*c.r - 0.331264*c.g + 0.5*c.b, 0.5*c.r - 0.418688*c.g - 0.081312*c.b); }
float curve1(float v) { return texture(uCurve, vec2((clamp(v, 0.0, 1.0) * 255.0 + 0.5) / 256.0, 0.5)).r; }
void main() {
  vec4 t = texture(uTex, vUV);
  vec3 c = t.rgb;
  if (uGrade) {
    c = pow(clamp(pow(clamp(c, 0.0, 1.0), vec3(2.2)) * exp2(uExp) * uWB, 0.0, 1.0), vec3(1.0 / 2.2));
    float l = dot(c, LUMA);
    float lift = 0.25 * (uToneA.z * (1.0 - l) * (1.0 - l) + uToneA.y * l * l);
    float lo = -0.1 * uToneB.y; float hi = 1.0 - 0.1 * uToneB.x;
    c = ((c - 0.5) * (1.0 + uToneA.x) + 0.5 + lift - lo) / (hi - lo);
    c = clamp(c, 0.0, 1.0);
    if (uUseCurve) c = vec3(curve1(c.r), curve1(c.g), curve1(c.b));
    float g = dot(c, LUMA);
    c = clamp(vec3(g) + (c - g) * (1.0 + uSat), 0.0, 1.0);
    g = dot(c, LUMA);
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = clamp(vec3(g) + (c - g) * (1.0 + uVib * (1.0 - sat)), 0.0, 1.0);
  }
  if (uUseLut) c = texture(uLut, clamp(c, 0.0, 1.0) * ((uLutN - 1.0) / uLutN) + 0.5 / uLutN).rgb;
  float a = uOpacity * t.a;
  if (uChroma) { float d = distance(chroma(c), chroma(uKey)); a *= uSoft <= 0.0 ? step(uTol, d) : smoothstep(0.0, 1.0, clamp((d - uTol) / uSoft, 0.0, 1.0)); }
  if (uMask > 0) {
    vec2 q = (vUnit - uMaskR.xy) / (uMaskR.zw * 0.5);
    float d = uMask == 1 ? max(abs(q.x), abs(q.y)) : length(q);
    float m = 1.0 - smoothstep(1.0 - max(uMaskF, 0.002), 1.0, d);
    a *= uMaskInv ? 1.0 - m : m;
  }
  o = vec4(c * a, a);
}`;

const BLEND = `#version 300 es
precision highp float;
in vec2 vUnit; out vec4 o;
uniform sampler2D uA; uniform sampler2D uB;
uniform int uKind; uniform float uP;
void main() {
  vec2 uv = vec2(vUnit.x, 1.0 - vUnit.y);
  vec4 a = texture(uA, uv); vec4 b = texture(uB, uv);
  if (uKind == 0) o = mix(a, b, uP);
  else if (uKind == 1) { o = uP < 0.5 ? a * (1.0 - uP * 2.0) : b * ((uP - 0.5) * 2.0); o.a = 1.0; }
  else if (uKind == 2) { float e = smoothstep(uP - 0.015, uP + 0.015, vUnit.x); o = mix(b, a, e); }
  else { o = vUnit.x < 1.0 - uP ? texture(uA, vec2(vUnit.x + uP, uv.y)) : texture(uB, vec2(vUnit.x - (1.0 - uP), uv.y)); }
}`;

const BLIT = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uTex;
void main() { vec4 t = texture(uTex, vUV); o = vec4(t.rgb * t.a, t.a); }`;

export class Gpu {
  readonly gl: WebGL2RenderingContext;
  private prog: Record<'layer' | 'blend' | 'blit', WebGLProgram>;
  private u = new Map<string, WebGLUniformLocation | null>();
  private buf: WebGLBuffer;
  private slots: WebGLTexture[] = [];
  private fbo: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = [];
  private fboSize = '';
  private luts = new Map<string, WebGLTexture>();
  private curves = new Map<string, WebGLTexture>();
  private ident: WebGLTexture;
  private ident3: WebGLTexture;
  lost = false;
  onLost?: () => void;
  /** The context's texture limit, said in the report. */
  readonly maxTexture: number;

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: true }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('no WebGL2');
    this.gl = gl;
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    (canvas as HTMLCanvasElement).addEventListener?.('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLost?.();
    });
    const mk = (fs: string, vs = VERT) => {
      const p = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
      return p;
    };
    this.prog = { layer: mk(LAYER), blend: mk(BLEND), blit: mk(BLIT) };
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.ident = this.tex2d();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.ident3 = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, this.ident3);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  private tex2d(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  private loc(p: WebGLProgram, n: string): WebGLUniformLocation | null {
    const k = `${(p as unknown as { __n?: number }).__n ??= Math.random()}|${n}`;
    if (!this.u.has(k)) this.u.set(k, this.gl.getUniformLocation(p, n));
    return this.u.get(k)!;
  }
  private use(p: WebGLProgram) {
    const gl = this.gl;
    gl.useProgram(p);
    const a = gl.getAttribLocation(p, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  }

  /** A LUT kept for this id (the 3-D texture from RGBA bytes). */
  setLut(id: string, size: number, bytes: Uint8Array): void {
    if (this.luts.has(id)) return;
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    this.luts.set(id, t);
    (t as unknown as { __n: number }).__n = size;
  }

  private curveTex(g: Grade): WebGLTexture | null {
    if (JSON.stringify(g.curve) === JSON.stringify(flatGrade().curve)) return null;
    const k = JSON.stringify(g.curve);
    let t = this.curves.get(k);
    if (!t) {
      const gl = this.gl;
      const tab = monotoneCurve(g.curve);
      const bytes = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++) bytes.set([Math.round(tab[i]! * 255), 0, 0, 255], i * 4);
      t = this.tex2d();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      this.curves.set(k, t);
    }
    return t;
  }

  private target(w: number, h: number) {
    const gl = this.gl;
    const key = `${w}x${h}`;
    if (this.fboSize === key) return;
    for (const f of this.fbo) {
      gl.deleteFramebuffer(f.fb);
      gl.deleteTexture(f.tex);
    }
    this.fbo = [0, 1].map(() => {
      const tex = this.tex2d();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { fb, tex };
    });
    this.fboSize = key;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** The rectangle a layer covers, in canvas pixels: its fitted size, scale, position and turn. */
  static rect(cw: number, ch: number, l: Pick<Layer, 'w' | 'h' | 'crop' | 'fit' | 'x' | 'y' | 'scale'>): { w: number; h: number; cx: number; cy: number } {
    const ca = (l.crop.w * l.w) / Math.max(1, l.crop.h * l.h);
    const A = cw / ch;
    const wide = l.fit === 'fit' ? ca > A : ca <= A;
    const fw = wide ? 1 : ca / A;
    const fh = wide ? A / ca : 1;
    return { w: fw * cw * l.scale, h: fh * ch * l.scale, cx: cw / 2 + l.x * cw, cy: ch / 2 + l.y * ch };
  }

  private drawLayer(l: Layer, slot: number, cw: number, ch: number): void {
    const gl = this.gl;
    const p = this.prog.layer;
    this.use(p);
    while (this.slots.length <= slot) this.slots.push(this.tex2d());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.slots[slot]!);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l.el as TexImageSource);
    gl.uniform1i(this.loc(p, 'uTex'), 0);
    const r = Gpu.rect(cw, ch, l);
    gl.uniform2f(this.loc(p, 'uCanvas'), cw, ch);
    gl.uniform2f(this.loc(p, 'uSize'), r.w, r.h);
    gl.uniform2f(this.loc(p, 'uCenter'), r.cx, r.cy);
    gl.uniform1f(this.loc(p, 'uRot'), (l.rot * Math.PI) / 180);
    gl.uniform4f(this.loc(p, 'uCrop'), l.crop.x, l.crop.y, l.crop.w, l.crop.h);
    gl.uniform1f(this.loc(p, 'uOpacity'), l.opacity);
    const g = l.grade && !isFlat(l.grade) ? l.grade : null;
    gl.uniform1i(this.loc(p, 'uGrade'), g ? 1 : 0);
    const flat = flatGrade();
    const gg = g ?? flat;
    const wb: [number, number, number] = [1 + 0.3 * gg.temp, 1 - 0.2 * gg.tint, 1 - 0.3 * gg.temp];
    gl.uniform1f(this.loc(p, 'uExp'), gg.exposure);
    gl.uniform3f(this.loc(p, 'uWB'), ...wb);
    gl.uniform4f(this.loc(p, 'uToneA'), gg.contrast, gg.highlights, gg.shadows, 0);
    gl.uniform2f(this.loc(p, 'uToneB'), gg.whites, gg.blacks);
    gl.uniform1f(this.loc(p, 'uSat'), gg.saturation);
    gl.uniform1f(this.loc(p, 'uVib'), gg.vibrance);
    const ct = g ? this.curveTex(g) : null;
    gl.uniform1i(this.loc(p, 'uUseCurve'), ct ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ct ?? this.ident);
    gl.uniform1i(this.loc(p, 'uCurve'), 1);
    const lut = l.lut ? this.luts.get(l.lut) : null;
    gl.uniform1i(this.loc(p, 'uUseLut'), lut ? 1 : 0);
    gl.uniform1f(this.loc(p, 'uLutN'), lut ? (lut as unknown as { __n: number }).__n : 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, lut ?? this.ident3);
    gl.uniform1i(this.loc(p, 'uLut'), 2);
    gl.uniform1i(this.loc(p, 'uChroma'), l.chroma ? 1 : 0);
    if (l.chroma) {
      gl.uniform3f(this.loc(p, 'uKey'), ...l.chroma.color);
      gl.uniform1f(this.loc(p, 'uTol'), l.chroma.tol);
      gl.uniform1f(this.loc(p, 'uSoft'), l.chroma.soft);
    }
    gl.uniform1i(this.loc(p, 'uMask'), l.mask ? (l.mask.kind === 'rect' ? 1 : 2) : 0);
    if (l.mask) {
      gl.uniform4f(this.loc(p, 'uMaskR'), 0.5 + l.mask.x, 0.5 + l.mask.y, l.mask.w, l.mask.h);
      gl.uniform1f(this.loc(p, 'uMaskF'), l.mask.feather);
      gl.uniform1i(this.loc(p, 'uMaskInv'), l.mask.invert ? 1 : 0);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawText(el: CanvasImageSource, cw: number, ch: number, slot: number): void {
    const gl = this.gl;
    const p = this.prog.blit;
    this.use(p);
    while (this.slots.length <= slot) this.slots.push(this.tex2d());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.slots[slot]!);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el as TexImageSource);
    gl.uniform1i(this.loc(p, 'uTex'), 0);
    gl.uniform2f(this.loc(p, 'uCanvas'), cw, ch);
    gl.uniform2f(this.loc(p, 'uSize'), cw, ch);
    gl.uniform2f(this.loc(p, 'uCenter'), cw / 2, ch / 2);
    gl.uniform1f(this.loc(p, 'uRot'), 0);
    gl.uniform4f(this.loc(p, 'uCrop'), 0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Draw one frame of the project. */
  draw(f: FrameSpec): void {
    const gl = this.gl;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    gl.viewport(0, 0, cw, ch);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const clearTo = (fb: WebGLFramebuffer | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    if (f.tr && f.main && f.mainB) {
      this.target(cw, ch);
      clearTo(this.fbo[0]!.fb);
      this.drawLayer(f.main, 0, cw, ch);
      clearTo(this.fbo[1]!.fb);
      this.drawLayer(f.mainB, 1, cw, ch);
      clearTo(null);
      gl.disable(gl.BLEND);
      const p = this.prog.blend;
      this.use(p);
      gl.uniform2f(this.loc(p, 'uCanvas'), cw, ch);
      gl.uniform2f(this.loc(p, 'uSize'), cw, ch);
      gl.uniform2f(this.loc(p, 'uCenter'), cw / 2, ch / 2);
      gl.uniform1f(this.loc(p, 'uRot'), 0);
      gl.uniform4f(this.loc(p, 'uCrop'), 0, 0, 1, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fbo[0]!.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.fbo[1]!.tex);
      gl.uniform1i(this.loc(p, 'uA'), 0);
      gl.uniform1i(this.loc(p, 'uB'), 1);
      gl.uniform1i(this.loc(p, 'uKind'), { crossfade: 0, dip: 1, wipe: 2, slide: 3 }[f.tr.kind]);
      gl.uniform1f(this.loc(p, 'uP'), f.tr.p);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.BLEND);
    } else {
      clearTo(null);
      if (f.main) this.drawLayer(f.main, 0, cw, ch);
    }
    f.overlays.forEach((o, i) => this.drawLayer(o, 2 + i, cw, ch));
    if (f.text) this.drawText(f.text, cw, ch, 5);
  }

  /** One pixel of the picture as drawn (x and y as fractions from the top left), 0..255 each. */
  pixel(fx: number, fy: number): [number, number, number, number] {
    const gl = this.gl;
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(Math.min(this.canvas.width - 1, Math.round(fx * this.canvas.width)), Math.max(0, this.canvas.height - 1 - Math.round(fy * this.canvas.height)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0]!, px[1]!, px[2]!, px[3]!];
  }

  /** How many pixels in the rows from y0 to y1 (fractions from the top) are near white: how much text is drawn there. */
  whiteCount(y0: number, y1: number): number {
    const gl = this.gl;
    const W = this.canvas.width;
    const top = Math.round(y0 * this.canvas.height);
    const rows = Math.max(1, Math.round((y1 - y0) * this.canvas.height));
    const px = new Uint8Array(W * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, this.canvas.height - top - rows, W, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i]! > 235 && px[i + 1]! > 235 && px[i + 2]! > 235) n++;
    return n;
  }

  /** The centre (fractions from the top left) and size of the near-white pixels on the whole picture: where a bright mark sits as drawn. */
  whiteCentre(): { cx: number; cy: number; n: number } | null {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i]! > 225 && px[i + 1]! > 225 && px[i + 2]! > 225) {
        n++;
        sx += x;
        sy += H - 1 - y;
      }
    }
    return n ? { cx: sx / n / W, cy: sy / n / H, n } : null;
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
