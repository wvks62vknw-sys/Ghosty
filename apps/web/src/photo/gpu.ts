/**
 * THE PIPELINE (BRIEF-EDITOR-PHOTO): WebGL2 fragment passes over the original as a texture, the app's own code, no package.
 *
 *   A  the sample: the geometry (flip, crop, straighten, perspective, lens), then the heals, then the global grade, then each mask's
 *      grade, then the layer                                        → a float picture (the stage), a halo of pixels wider than asked
 *   N  the edge-keeping denoise (only when asked)                    → a float picture
 *   H, V  the Gaussian blur the unsharp mask needs (only when asked) → float pictures
 *   F  the unsharp mask, then the effects (fade, vignette, grain)    → the canvas, or an 8-bit picture to read back
 *
 * The shader is photo/math.ts and photo/cpu.ts written again in GLSL, line for line (the bilinear sample is done by hand with texelFetch
 * so it is the same arithmetic), so the two draw the same picture within one unit per channel; `compare()` measures it and the spec holds it.
 *
 * The screen draws the part of the picture in view at the screen's size. An export draws the whole picture at its own full size in tiles
 * (a tile and its halo never wider than the phone's texture limit, read with MAX_TEXTURE_SIZE, and at most 1,536 px so the float pictures
 * stay small) and stitches them, so a 12-megapixel photo exports at 12 megapixels.
 */
import { alphaAt, alphaVersion, getAlpha, type Alpha } from './alpha';
import { geoOf, HALO, maskAt, renderCpu, type Src } from './cpu';
import { BLEND_ID, blurTaps, denoiseRange, gradeOfLight, gradeOfMask, grainCells, isIdentityGrade, perspective, unsharpSigma, type GradeP } from './math';
import { frameSize, outputSize, type Mask, type Recipe } from './recipe';

const MAXM = 4;
const MAXH = 16;

const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0., 1.); }`;

const COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
out vec4 o;
float luma(vec3 c){ return .2126*c.r + .7152*c.g + .0722*c.b; }
float sstep(float a, float b, float x){ float t = clamp((x-a)/(b-a), 0., 1.); return t*t*(3.-2.*t); }
`;

const FRAG_A = `${COMMON}
uniform sampler2D uSrc; uniform vec2 uSrcSize;
uniform vec2 uOut; uniform vec2 uOrigin;
uniform vec4 uCrop; uniform vec2 uFrame; uniform vec2 uRot; uniform float uFlipH; uniform int uQ; uniform float uK1;
uniform mat3 uH; uniform float uHasH;
uniform int uNHeal; uniform vec4 uHeal[${MAXH}]; uniform vec2 uHealOff[${MAXH}];
uniform vec4 uG0[${MAXM + 1}]; uniform vec4 uG1[${MAXM + 1}]; uniform vec4 uG2[${MAXM + 1}];
uniform float uCvX[24]; uniform float uCvY[24]; uniform float uCvM[24]; uniform int uCvN[4];
uniform float uHasHsl; uniform vec3 uHsl[8];
uniform int uNMask; uniform vec4 uMK[${MAXM + 1}]; uniform vec4 uMP[${MAXM + 1}]; uniform vec4 uMQ[${MAXM + 1}];
uniform sampler2D uAl0; uniform sampler2D uAl1; uniform sampler2D uAl2; uniform sampler2D uAl3; uniform sampler2D uAl4; uniform vec2 uAlSize[5];
uniform sampler2D uLayer; uniform vec2 uLayerSize; uniform vec4 uLy; uniform vec2 uLs;

vec3 fetchPx(sampler2D s, vec2 size, ivec2 i){ return texelFetch(s, clamp(i, ivec2(0), ivec2(size) - 1), 0).rgb; }
vec3 bilinear(sampler2D s, vec2 size, vec2 uv){
  vec2 xy = uv*size - .5; vec2 f0 = floor(xy); vec2 fr = xy - f0; ivec2 i0 = ivec2(f0);
  vec3 a = fetchPx(s, size, i0), b = fetchPx(s, size, i0 + ivec2(1,0)), c = fetchPx(s, size, i0 + ivec2(0,1)), d = fetchPx(s, size, i0 + ivec2(1,1));
  return mix(mix(a, b, fr.x), mix(c, d, fr.x), fr.y);
}
float alphaFetch(sampler2D s, vec2 size, vec2 uv){
  vec2 xy = uv*size - .5; vec2 f0 = floor(xy); vec2 fr = xy - f0; ivec2 i0 = ivec2(f0); ivec2 mx = ivec2(size) - 1;
  float a = texelFetch(s, clamp(i0, ivec2(0), mx), 0).r, b = texelFetch(s, clamp(i0 + ivec2(1,0), ivec2(0), mx), 0).r;
  float c = texelFetch(s, clamp(i0 + ivec2(0,1), ivec2(0), mx), 0).r, d = texelFetch(s, clamp(i0 + ivec2(1,1), ivec2(0), mx), 0).r;
  return mix(mix(a, b, fr.x), mix(c, d, fr.x), fr.y);
}
float alphaSlot(int i, vec2 uv){
  if (i == 0) return alphaFetch(uAl0, uAlSize[0], uv);
  if (i == 1) return alphaFetch(uAl1, uAlSize[1], uv);
  if (i == 2) return alphaFetch(uAl2, uAlSize[2], uv);
  if (i == 3) return alphaFetch(uAl3, uAlSize[3], uv);
  return alphaFetch(uAl4, uAlSize[4], uv);
}

vec2 mapOut(vec2 uv){
  float uu = uFlipH > .5 ? 1. - uv.x : uv.x;
  vec2 f = uFrame;
  vec2 p = vec2((uCrop.x + uu*uCrop.z - .5)*f.x, (uCrop.y + uv.y*uCrop.w - .5)*f.y);
  p = vec2(p.x*uRot.x - p.y*uRot.y, p.x*uRot.y + p.y*uRot.x);
  vec2 q = p/f + .5;
  if (uHasH > .5) { vec3 t = uH * vec3(q, 1.); q = t.xy / t.z; }
  if (uK1 != 0.) { vec2 d = (q - .5)*f; float r2 = dot(d, d)/((f.x*f.x + f.y*f.y)*.25); float s = 1. + uK1*r2; q = .5 + d*s/f; }
  if (uQ == 1) return vec2(q.y, 1. - q.x);
  if (uQ == 2) return vec2(1. - q.x, 1. - q.y);
  if (uQ == 3) return vec2(1. - q.y, q.x);
  return q;
}

float s2l(float c){ return c <= .04045 ? c/12.92 : pow((c + .055)/1.055, 2.4); }
float l2s(float c){ return c <= .0031308 ? c*12.92 : 1.055*pow(c, 1./2.4) - .055; }

float curveEval(int k, float x){
  int n = uCvN[k];
  int o0 = k*6;
  if (x <= uCvX[o0]) return uCvY[o0];
  if (x >= uCvX[o0 + n - 1]) return uCvY[o0 + n - 1];
  int i = 0;
  for (int j = 0; j < 5; j++) { if (i < n - 2 && x > uCvX[o0 + i + 1]) i++; }
  float x0 = uCvX[o0 + i]; float x1 = uCvX[o0 + i + 1]; float h = x1 - x0; float t = (x - x0)/h; float t2 = t*t; float t3 = t2*t;
  return (2.*t3 - 3.*t2 + 1.)*uCvY[o0 + i] + (t3 - 2.*t2 + t)*h*uCvM[o0 + i] + (-2.*t3 + 3.*t2)*uCvY[o0 + i + 1] + (t3 - t2)*h*uCvM[o0 + i + 1];
}
float curveAt(int k, float x){ return uCvN[k] < 2 ? x : clamp(curveEval(k, x), 0., 1.); }

vec3 rgb2hsl(vec3 c){
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b)); float l = (mx + mn)/2.; float d = mx - mn;
  if (d < 1e-9) return vec3(0., 0., l);
  float s = d/(1. - abs(2.*l - 1.));
  float h;
  if (mx == c.r) h = mod((c.g - c.b)/d, 6.); else if (mx == c.g) h = (c.b - c.r)/d + 2.; else h = (c.r - c.g)/d + 4.;
  h *= 60.; if (h < 0.) h += 360.;
  return vec3(h, clamp(s, 0., 1.), l);
}
vec3 hsl2rgb(vec3 c){
  float h = mod(mod(c.x, 360.) + 360., 360.); float s = c.y; float l = c.z;
  float a = s*min(l, 1. - l);
  float k0 = mod(0. + h/30., 12.); float k8 = mod(8. + h/30., 12.); float k4 = mod(4. + h/30., 12.);
  return vec3(l - a*max(-1., min(k0 - 3., min(9. - k0, 1.))), l - a*max(-1., min(k8 - 3., min(9. - k8, 1.))), l - a*max(-1., min(k4 - 3., min(9. - k4, 1.))));
}
const float BH[8] = float[8](0., 30., 60., 120., 180., 240., 270., 300.);
void hslWeights(float hue, out float w[8]){
  float h = mod(mod(hue, 360.) + 360., 360.);
  for (int i = 0; i < 8; i++) w[i] = 0.;
  for (int i = 0; i < 8; i++) {
    float a = BH[i]; float b = i == 7 ? 360. : BH[i + 1];
    if (h >= a && h < b) { float t = (h - a)/(b - a); w[i] = 1. - t; w[(i + 1) % 8] = t; break; }
  }
}
vec3 colour(vec3 g, int gi, bool global){
  float vib = uG2[gi].y; float sat = uG2[gi].z;
  bool hs = global && uHasHsl > .5;
  if (!hs && vib == 0. && sat == 0.) return g;
  vec3 hsl = rgb2hsl(g); float h = hsl.x; float s = hsl.y; float l = hsl.z;
  if (hs) {
    float w[8]; hslWeights(h, w);
    float dh = 0.; float ds = 0.; float dl = 0.;
    for (int i = 0; i < 8; i++) { dh += w[i]*uHsl[i].x; ds += w[i]*uHsl[i].y; dl += w[i]*uHsl[i].z; }
    h += dh*30.; s = clamp(s*(1. + ds), 0., 1.); l = clamp(l + dl*.25*min(1., s*2.), 0., 1.);
  }
  if (vib != 0.) s = clamp(vib > 0. ? s + vib*(1. - s)*(1. - s) : s*(1. + vib), 0., 1.);
  if (sat != 0.) s = clamp(s*(1. + sat), 0., 1.);
  return hsl2rgb(vec3(h, s, l));
}
vec3 gradeAt(vec3 c, int gi, bool global){
  vec4 a = uG0[gi]; vec4 b = uG1[gi]; vec4 d = uG2[gi];
  vec3 lin = vec3(s2l(c.r), s2l(c.g), s2l(c.b))*a.x*a.yzw;
  vec3 g = vec3(l2s(max(0., lin.r)), l2s(max(0., lin.g)), l2s(max(0., lin.b)));
  float L = luma(g);
  float ws = 1. - sstep(.05, .65, L); float wh = sstep(.35, .95, L);
  float gain = pow(2., b.z*.9*ws + b.y*.9*wh);
  float white = 1. + b.w*.25*sstep(.55, 1., L);
  float black = d.x*.15*(1. - sstep(0., .35, L));
  float cf = 1. + b.x*.8;
  vec3 v = ((g*gain*white + black) - .5)*cf + .5;
  v = clamp(v, 0., 1.);
  if (global && (uCvN[0] > 1 || uCvN[1] > 1 || uCvN[2] > 1 || uCvN[3] > 1)) {
    v = vec3(curveAt(1, curveAt(0, v.r)), curveAt(2, curveAt(0, v.g)), curveAt(3, curveAt(0, v.b)));
  }
  v = colour(v, gi, global);
  return clamp(v, 0., 1.);
}

float maskValue(int j, vec2 p){
  vec4 k = uMK[j]; vec4 q = uMP[j]; vec4 e = uMQ[j];
  float v;
  if (k.x < .5) {
    v = alphaSlot(j, p);
  } else if (k.x < 1.5) {
    vec2 a = q.xy*uSrcSize; vec2 b = q.zw*uSrcSize - a;
    float t = dot(p*uSrcSize - a, b)/max(1e-6, dot(b, b));
    v = 1. - sstep(0., 1., t);
  } else {
    float L = max(uSrcSize.x, uSrcSize.y);
    vec2 dd = p*uSrcSize - q.xy*uSrcSize; float ca = cos(e.x); float sa = sin(e.x);
    float ux = (dd.x*ca + dd.y*sa)/max(1e-6, q.z*L); float uy = (-dd.x*sa + dd.y*ca)/max(1e-6, q.w*L);
    float d = sqrt(ux*ux + uy*uy);
    v = 1. - sstep(1. - max(.02, k.z), 1., d);
  }
  return k.y > .5 ? 1. - v : v;
}

vec3 blendMode(vec3 b, vec3 s, int mode){
  if (mode == 1) return b*s;
  if (mode == 2) return 1. - (1. - b)*(1. - s);
  if (mode == 3) return vec3(b.r < .5 ? 2.*b.r*s.r : 1. - 2.*(1. - b.r)*(1. - s.r), b.g < .5 ? 2.*b.g*s.g : 1. - 2.*(1. - b.g)*(1. - s.g), b.b < .5 ? 2.*b.b*s.b : 1. - 2.*(1. - b.b)*(1. - s.b));
  if (mode == 4) return (1. - 2.*s)*b*b + 2.*s*b;
  return s;
}

void main(){
  vec2 uv = (uOrigin + gl_FragCoord.xy)/uOut;
  vec2 p = mapOut(uv);
  vec3 c = bilinear(uSrc, uSrcSize, p);
  float L0 = max(uSrcSize.x, uSrcSize.y);
  for (int i = 0; i < ${MAXH}; i++) {
    if (i >= uNHeal) break;
    vec4 h = uHeal[i];
    float d = length((p - h.xy)*uSrcSize)/max(1e-6, h.z*L0);
    if (d < 1.) {
      float wgt = 1. - clamp((d - (1. - max(.02, h.w)))/max(.02, h.w), 0., 1.);
      float wsm = wgt*wgt*(3. - 2.*wgt);
      c = mix(c, bilinear(uSrc, uSrcSize, p + uHealOff[i]), wsm);
    }
  }
  vec3 g = gradeAt(c, 0, true);
  for (int j = 0; j < ${MAXM}; j++) {
    if (j >= uNMask) break;
    float k = maskValue(j, p);
    if (k > 0.) g = mix(g, gradeAt(g, j + 1, false), k);
  }
  if (uLy.z > .5) {
    vec3 s2 = bilinear(uLayer, uLayerSize, .5 + (uv - .5)*uLs);
    float k = uLy.x;
    if (uMK[4].w > .5) k *= maskValue(4, p);
    g = mix(g, blendMode(g, s2, int(uLy.y)), k);
  }
  o = vec4(g, 1.);
}
`;

const FRAG_N = `${COMMON}
uniform sampler2D uTex; uniform vec2 uTexSize; uniform float uSr;
vec3 at(ivec2 i){ return texelFetch(uTex, clamp(i, ivec2(0), ivec2(uTexSize) - 1), 0).rgb; }
void main(){
  ivec2 c0 = ivec2(floor(gl_FragCoord.xy)); vec3 c = at(c0); vec3 sum = vec3(0.); float ws = 0.;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec3 n = at(c0 + ivec2(i, j)); vec3 d = n - c; float d2 = dot(d, d);
    float w = exp(-float(i*i + j*j)/2.)*exp(-d2/(2.*uSr*uSr));
    sum += n*w; ws += w;
  }
  o = vec4(sum/ws, 1.);
}`;

const FRAG_B = `${COMMON}
uniform sampler2D uTex; uniform vec2 uTexSize; uniform vec2 uDir; uniform int uN; uniform float uW[7];
vec3 at(ivec2 i){ return texelFetch(uTex, clamp(i, ivec2(0), ivec2(uTexSize) - 1), 0).rgb; }
void main(){
  ivec2 c0 = ivec2(floor(gl_FragCoord.xy)); vec3 acc = vec3(0.);
  for (int i = -6; i <= 6; i++) { if (i < -uN || i > uN) continue; acc += at(c0 + ivec2(uDir)*i)*uW[abs(i)]; }
  o = vec4(acc, 1.);
}`;

const FRAG_F = `${COMMON}
uniform sampler2D uBase; uniform sampler2D uBlur; uniform vec2 uStageSize; uniform ivec2 uStageOff; uniform float uHasBlur; uniform float uFlipY; uniform float uFullH;
uniform vec4 uUn; uniform vec4 uFx; uniform vec4 uFx2; uniform vec2 uOut2; uniform vec2 uCells;
vec3 at(sampler2D s, ivec2 i){ return texelFetch(s, clamp(i, ivec2(0), ivec2(uStageSize) - 1), 0).rgb; }
float hash01(int x, int y, int seed){
  uint h = uint(x)*374761393u + uint(y)*668265263u + uint(seed)*1274126177u;
  h = (h ^ (h >> 13u))*1274126177u; h = h ^ (h >> 16u);
  return float(h)/4294967295.;
}
void main(){
  ivec2 f = ivec2(floor(gl_FragCoord.xy));
  if (uFlipY > .5) f.y = int(uFullH) - 1 - f.y;
  ivec2 s = f + uStageOff;
  vec3 c = at(uBase, s);
  if (uHasBlur > .5) {
    vec3 bl = at(uBlur, s); vec3 d = c - bl; float dl = abs(luma(d)); float t = uUn.y/255.;
    float m = t > 0. ? clamp((dl - t)/(t*.5 + 1e-4), 0., 1.) : 1.;
    c = clamp(c + d*uUn.x*2.*m, 0., 1.);
  }
  // uFx = (vignette, grain, fade, seed); uOut2 = the drawn picture; uFx2.xy = the region's origin in it
  vec2 g = uFx2.xy + vec2(f);
  float fade = uFx.z; float vg = uFx.x; float grain = uFx.y;
  if (fade != 0.) c = c*(1. - fade*.6) + fade*.14;
  if (vg != 0.) {
    float d = length(g + .5 - uOut2*.5)/(length(uOut2)*.5);
    float sv = sstep(.35, 1., d);
    c = vg >= 0. ? c*(1. - vg*sv) : c + (1. - c)*(-vg)*sv;
  }
  if (grain != 0.) {
    vec2 uv = (g + .5)/uOut2;
    float n = hash01(int(floor(uv.x*uCells.x)), int(floor(uv.y*uCells.y)), int(uFx.w)) - .5;
    float L = luma(c);
    c += n*grain*.3*(1. - .5*abs(2.*L - 1.));
  }
  o = vec4(clamp(c, 0., 1.), 1.);
}`;

export interface Caps {
  maxTexture: number;
  float: 'f32' | 'f16' | 'u8';
  renderer: string;
}

/** Where WebGL2 is there to be had: false when it is missing or a canvas refuses it. */
export function webgl2Here(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** A picture the pipeline takes: a canvas or a decoded bitmap. */
export type Pic = HTMLCanvasElement | ImageBitmap;
type Prog = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };

export interface View {
  /** The drawn picture's size (the whole picture at this zoom) and the part of it on the canvas. */
  outW: number;
  outH: number;
  region: { x: number; y: number; w: number; h: number };
  /** The width the picture has at export, so the detail passes scale. */
  fullW: number;
}

export class PhotoGL {
  readonly gl: WebGL2RenderingContext;
  readonly caps: Caps;
  lost = false;
  onLost: (() => void) | null = null;
  onRestored: (() => void) | null = null;
  src: { tex: WebGLTexture; w: number; h: number; scaled: boolean } | null = null;
  layer: { tex: WebGLTexture; w: number; h: number } | null = null;
  private progs: Record<string, Prog> = {};
  private quad!: WebGLBuffer;
  private alphaTex = new Map<number, { id: string; tex: WebGLTexture; w: number; h: number }>();
  private blank!: WebGLTexture;
  private srcCanvas: Pic | null = null;
  private layerCanvas: Pic | null = null;
  private vao!: WebGLVertexArrayObject;

  private constructor(readonly canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    const f32 = !!gl.getExtension('EXT_color_buffer_float');
    const f16 = f32 || !!gl.getExtension('EXT_color_buffer_half_float');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.caps = {
      maxTexture: Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number),
      float: f32 ? 'f32' : f16 ? 'f16' : 'u8',
      renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    };
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.build();
      this.lost = false;
      this.onRestored?.();
    });
    this.build();
  }

  /** A pipeline on a canvas, or null where WebGL2 is not there. */
  static make(canvas: HTMLCanvasElement): PhotoGL | null {
    try {
      const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
      return gl ? new PhotoGL(canvas, gl) : null;
    } catch {
      return null;
    }
  }

  private build(): void {
    const gl = this.gl;
    this.progs = {};
    this.slots = [null, null, null, null, null];
    this.alphaTex.clear();
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.blank = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + 15);
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    this.nearest();
    // the pictures, if there were any, go up again
    if (this.srcCanvas) this.setSource(this.srcCanvas);
    if (this.layerCanvas) this.setLayer(this.layerCanvas);
  }

  private nearest(): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private prog(name: 'A' | 'N' | 'B' | 'F'): Prog {
    let pr = this.progs[name];
    if (pr) return pr;
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader ${name}: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, { A: FRAG_A, N: FRAG_N, B: FRAG_B, F: FRAG_F }[name]));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program ${name}: ${gl.getProgramInfoLog(p)}`);
    pr = { p, u: new Map() };
    this.progs[name] = pr;
    return pr;
  }
  private loc(pr: Prog, name: string): WebGLUniformLocation | null {
    if (!pr.u.has(name)) pr.u.set(name, this.gl.getUniformLocation(pr.p, name));
    return pr.u.get(name) ?? null;
  }

  private upload(img: CanvasImageSource, w: number, h: number): WebGLTexture {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + 15);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
    this.nearest();
    return tex;
  }

  /** The original goes up as a texture; one larger than the phone's limit is drawn smaller (said by `scaled`). */
  setSource(img: Pic): { w: number; h: number; scaled: boolean } {
    this.srcCanvas = img;
    let w = img.width;
    let h = img.height;
    let scaled = false;
    let draw: CanvasImageSource = img;
    const lim = this.caps.maxTexture;
    if (Math.max(w, h) > lim) {
      const k = lim / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = w = Math.max(1, Math.round(w * k));
      c.height = h = Math.max(1, Math.round(h * k));
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      draw = c;
      scaled = true;
    }
    if (this.src) this.gl.deleteTexture(this.src.tex);
    this.src = { tex: this.upload(draw, w, h), w, h, scaled };
    return { w, h, scaled };
  }
  setLayer(img: Pic | null): void {
    this.layerCanvas = img;
    if (this.layer) this.gl.deleteTexture(this.layer.tex);
    this.layer = null;
    if (!img) return;
    let w = img.width;
    let h = img.height;
    let draw: CanvasImageSource = img;
    // the layer never needs to be bigger than a quarter of the limit's worth
    const lim = Math.min(this.caps.maxTexture, 4096);
    if (Math.max(w, h) > lim) {
      const k = lim / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = w = Math.max(1, Math.round(w * k));
      c.height = h = Math.max(1, Math.round(h * k));
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      draw = c;
    }
    this.layer = { tex: this.upload(draw, w, h), w, h };
  }

  /** A mask's alpha picture in a slot (0..4), uploaded again only when its id changes. */
  private alphaIn(slot: number, id: string): { tex: WebGLTexture; w: number; h: number } {
    const gl = this.gl;
    const a: Alpha | null = id ? getAlpha(id) : null;
    if (!a) return { tex: this.blank, w: 1, h: 1 };
    const have = this.alphaTex.get(slot);
    const stamp = `${id}:${alphaVersion(id)}`;
    if (have && have.id === stamp) return have;
    if (have) gl.deleteTexture(have.tex);
    gl.activeTexture(gl.TEXTURE0 + 15);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, a.w, a.h, 0, gl.RED, gl.UNSIGNED_BYTE, a.data);
    this.nearest();
    const rec = { id: stamp, tex, w: a.w, h: a.h };
    this.alphaTex.set(slot, rec);
    return rec;
  }

  private slots: ({ tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; fmt: string } | null)[] = [null, null, null, null, null];
  /** A picture to draw into, kept in its own slot (the passes never share one) and made again only when its size or kind changes. */
  private target(w: number, h: number, fmt: 'f' | 'u8', slot: number): { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; fmt: string } {
    const gl = this.gl;
    const kind = fmt === 'u8' ? 'u8' : this.caps.float === 'u8' ? 'u8' : w * h > 1_200_000 || this.caps.float === 'f16' ? 'f16' : 'f32';
    const have = this.slots[slot];
    if (have && have.w === w && have.h === h && have.fmt === kind) return have;
    if (have) {
      gl.deleteTexture(have.tex);
      gl.deleteFramebuffer(have.fbo);
    }
    gl.activeTexture(gl.TEXTURE0 + 15);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (kind === 'u8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    else if (kind === 'f16') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    this.nearest();
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const t = { tex, fbo, w, h, fmt: kind };
    this.slots[slot] = t;
    return t;
  }

  private bindTex(unit: number, tex: WebGLTexture | null): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
  }
  private draw(pr: Prog, into: { fbo: WebGLFramebuffer | null; w: number; h: number }): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.fbo);
    gl.viewport(0, 0, into.w, into.h);
    gl.disable(gl.BLEND);
    gl.useProgram(pr.p);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** The grade A needs, as uniform arrays: the global one first, then each mask that changes anything. */
  private setGrades(pr: Prog, glob: GradeP, masks: { m: Mask; g: GradeP }[], r: Recipe, src: { w: number; h: number }, layerMask: Mask | null): void {
    const gl = this.gl;
    const g0 = new Float32Array((MAXM + 1) * 4);
    const g1 = new Float32Array((MAXM + 1) * 4);
    const g2 = new Float32Array((MAXM + 1) * 4);
    const put = (i: number, g: GradeP) => {
      g0.set([g.gain, g.wb[0], g.wb[1], g.wb[2]], i * 4);
      g1.set([g.contrast, g.highlights, g.shadows, g.whites], i * 4);
      g2.set([g.blacks, g.vibrance, g.saturation, 0], i * 4);
    };
    put(0, glob);
    masks.forEach((x, j) => put(j + 1, x.g));
    gl.uniform4fv(this.loc(pr, 'uG0'), g0);
    gl.uniform4fv(this.loc(pr, 'uG1'), g1);
    gl.uniform4fv(this.loc(pr, 'uG2'), g2);
    // curves
    const cx = new Float32Array(24);
    const cy = new Float32Array(24);
    const cm = new Int32Array(4);
    const cmm = new Float32Array(24);
    const c = glob.curves;
    (['l', 'r', 'g', 'b'] as const).forEach((k, i) => {
      const cv = c?.[k];
      if (!cv) return;
      cm[i] = cv.pts.length;
      cv.pts.forEach((p, j) => {
        cx[i * 6 + j] = p[0];
        cy[i * 6 + j] = p[1];
        cmm[i * 6 + j] = cv.m[j]!;
      });
    });
    gl.uniform1fv(this.loc(pr, 'uCvX'), cx);
    gl.uniform1fv(this.loc(pr, 'uCvY'), cy);
    gl.uniform1fv(this.loc(pr, 'uCvM'), cmm);
    gl.uniform1iv(this.loc(pr, 'uCvN'), cm);
    gl.uniform1f(this.loc(pr, 'uHasHsl'), glob.hsl ? 1 : 0);
    const hs = new Float32Array(24);
    if (glob.hsl) hs.set(glob.hsl);
    gl.uniform3fv(this.loc(pr, 'uHsl'), hs);
    // masks: compact, each with its alpha picture in the slot of its place
    const mk = new Float32Array((MAXM + 1) * 4);
    const mp = new Float32Array((MAXM + 1) * 4);
    const mq = new Float32Array((MAXM + 1) * 4);
    const al = new Float32Array(10);
    const shape = (i: number, m: Mask) => {
      const kind = m.kind === 'linear' ? 1 : m.kind === 'radial' ? 2 : 0;
      mk.set([kind, m.invert ? 1 : 0, m.feather, 0], i * 4);
      if (m.kind === 'linear') mp.set([m.a.x, m.a.y, m.b.x, m.b.y], i * 4);
      else mp.set([m.c.x, m.c.y, m.rx, m.ry], i * 4);
      mq.set([(m.angle * Math.PI) / 180, 0, 0, 0], i * 4);
    };
    for (let j = 0; j <= MAXM; j++) {
      const m = j < masks.length ? masks[j]!.m : j === MAXM ? layerMask : null;
      if (j === MAXM) {
        if (m) {
          shape(4, m);
          mk[4 * 4 + 3] = 1;
        }
      } else if (m) shape(j, m);
      const a = this.alphaIn(j, m && (m.kind === 'brush' || m.kind === 'subject') ? m.alpha : '');
      this.bindTex(2 + j, a.tex);
      gl.uniform1i(this.loc(pr, `uAl${j}`), 2 + j);
      al[j * 2] = a.w;
      al[j * 2 + 1] = a.h;
    }
    gl.uniform4fv(this.loc(pr, 'uMK'), mk);
    gl.uniform4fv(this.loc(pr, 'uMP'), mp);
    gl.uniform4fv(this.loc(pr, 'uMQ'), mq);
    gl.uniform2fv(this.loc(pr, 'uAlSize'), al);
    gl.uniform1i(this.loc(pr, 'uNMask'), masks.length);
    void r;
    void src;
  }

  /**
   * Run the passes for a part of the drawn picture. `into` is the canvas (flipped so the picture's top is the canvas's top) or an 8-bit
   * picture to read back. Returns the pixels when it read them back.
   */
  private run(r: Recipe, v: View, into: 'canvas' | 'read'): Uint8Array | null {
    const gl = this.gl;
    const S = this.src;
    if (!S) return null;
    const geo = geoOf(r, S.w, S.h);
    const full = v.region;
    const detail = r.detail;
    const needBlur = detail.amount > 0;
    const needDenoise = detail.noise > 0;
    const halo = needBlur || needDenoise ? HALO : 0;
    const rx0 = Math.max(0, full.x - halo);
    const ry0 = Math.max(0, full.y - halo);
    const rx1 = Math.min(v.outW, full.x + full.w + halo);
    const ry1 = Math.min(v.outH, full.y + full.h + halo);
    const aw = rx1 - rx0;
    const ah = ry1 - ry0;
    const gradeG = gradeOfLight(r.light, r.wb, r.color, r.curves);
    const masks = r.masks.map((m) => ({ m, g: gradeOfMask(m.adj) })).filter((x) => !isIdentityGrade(x.g)).slice(0, MAXM);
    const lay = r.layer && this.layer ? r.layer : null;

    // ---- A
    const A = this.prog('A');
    const t0 = this.target(aw, ah, 'f', 0);
    gl.useProgram(A.p);
    this.bindTex(0, S.tex);
    gl.uniform1i(this.loc(A, 'uSrc'), 0);
    gl.uniform2f(this.loc(A, 'uSrcSize'), S.w, S.h);
    gl.uniform2f(this.loc(A, 'uOut'), v.outW, v.outH);
    gl.uniform2f(this.loc(A, 'uOrigin'), rx0, ry0);
    const q = ((geo.crop.quarter % 4) + 4) % 4;
    const f = frameSize(S.w, S.h, q);
    gl.uniform4f(this.loc(A, 'uCrop'), geo.crop.x, geo.crop.y, geo.crop.w, geo.crop.h);
    gl.uniform2f(this.loc(A, 'uFrame'), f.w, f.h);
    const ang = (geo.crop.angle * Math.PI) / 180;
    gl.uniform2f(this.loc(A, 'uRot'), Math.cos(ang), Math.sin(ang));
    gl.uniform1f(this.loc(A, 'uFlipH'), geo.crop.flip ? 1 : 0);
    gl.uniform1i(this.loc(A, 'uQ'), q);
    gl.uniform1f(this.loc(A, 'uK1'), geo.k1);
    const hm = geo.h ?? perspective([[0, 0], [0, 0], [0, 0], [0, 0]]);
    const hh = hm ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
    gl.uniformMatrix3fv(this.loc(A, 'uH'), false, new Float32Array([hh[0]!, hh[3]!, hh[6]!, hh[1]!, hh[4]!, hh[7]!, hh[2]!, hh[5]!, hh[8]!]));
    gl.uniform1f(this.loc(A, 'uHasH'), geo.h ? 1 : 0);
    const heals = r.heals.slice(0, MAXH);
    const hv = new Float32Array(MAXH * 4);
    const ho = new Float32Array(MAXH * 2);
    heals.forEach((h, i) => {
      hv.set([h.x, h.y, h.r, h.feather], i * 4);
      ho.set([h.dx, h.dy], i * 2);
    });
    gl.uniform1i(this.loc(A, 'uNHeal'), heals.length);
    gl.uniform4fv(this.loc(A, 'uHeal'), hv);
    gl.uniform2fv(this.loc(A, 'uHealOff'), ho);
    this.setGrades(A, gradeG, masks, r, S, lay?.mask ?? null);
    // the layer
    if (lay && this.layer) {
      this.bindTex(1, this.layer.tex);
      gl.uniform1i(this.loc(A, 'uLayer'), 1);
      gl.uniform2f(this.loc(A, 'uLayerSize'), this.layer.w, this.layer.h);
      const outA = v.outW / v.outH;
      const layA = this.layer.w / this.layer.h;
      gl.uniform2f(this.loc(A, 'uLs'), layA > outA ? outA / layA : 1, layA > outA ? 1 : layA / outA);
      gl.uniform4f(this.loc(A, 'uLy'), lay.opacity / 100, BLEND_ID[lay.blend] ?? 0, 1, 0);
    } else {
      this.bindTex(1, this.blank);
      gl.uniform1i(this.loc(A, 'uLayer'), 1);
      gl.uniform2f(this.loc(A, 'uLayerSize'), 1, 1);
      gl.uniform2f(this.loc(A, 'uLs'), 1, 1);
      gl.uniform4f(this.loc(A, 'uLy'), 0, 0, 0, 0);
    }
    this.draw(A, t0);
    let cur = t0;
    const scale = v.outW / v.fullW;

    // ---- N
    if (needDenoise) {
      const N = this.prog('N');
      const t1 = this.target(aw, ah, 'f', 1);
      gl.useProgram(N.p);
      this.bindTex(0, cur.tex);
      gl.uniform1i(this.loc(N, 'uTex'), 0);
      gl.uniform2f(this.loc(N, 'uTexSize'), aw, ah);
      gl.uniform1f(this.loc(N, 'uSr'), denoiseRange(detail.noise / 100));
      this.draw(N, t1);
      cur = t1;
    }
    // ---- H, V
    let blurT: typeof t0 | null = null;
    if (needBlur) {
      const B = this.prog('B');
      const { n, w } = blurTaps(unsharpSigma(detail.radius, scale));
      const taps = new Float32Array(7);
      w.forEach((x, i) => (taps[i] = x));
      const tmp = this.target(aw, ah, 'f', 2);
      gl.useProgram(B.p);
      this.bindTex(0, cur.tex);
      gl.uniform1i(this.loc(B, 'uTex'), 0);
      gl.uniform2f(this.loc(B, 'uTexSize'), aw, ah);
      gl.uniform1i(this.loc(B, 'uN'), n);
      gl.uniform1fv(this.loc(B, 'uW'), taps);
      gl.uniform2f(this.loc(B, 'uDir'), 1, 0);
      this.draw(B, tmp);
      const out = this.target(aw, ah, 'f', 3);
      this.bindTex(0, tmp.tex);
      gl.uniform2f(this.loc(B, 'uDir'), 0, 1);
      this.draw(B, out);
      blurT = out;
    }
    // ---- F
    const F = this.prog('F');
    gl.useProgram(F.p);
    this.bindTex(0, cur.tex);
    gl.uniform1i(this.loc(F, 'uBase'), 0);
    this.bindTex(1, (blurT ?? cur).tex);
    gl.uniform1i(this.loc(F, 'uBlur'), 1);
    gl.uniform2f(this.loc(F, 'uStageSize'), aw, ah);
    gl.uniform2i(this.loc(F, 'uStageOff'), full.x - rx0, full.y - ry0);
    gl.uniform1f(this.loc(F, 'uHasBlur'), needBlur ? 1 : 0);
    gl.uniform1f(this.loc(F, 'uFlipY'), into === 'canvas' ? 1 : 0);
    gl.uniform1f(this.loc(F, 'uFullH'), full.h);
    gl.uniform4f(this.loc(F, 'uUn'), detail.amount / 100, detail.threshold, 0, 0);
    const e = r.effects;
    gl.uniform4f(this.loc(F, 'uFx'), e.vignette, e.grain, e.fade, e.seed);
    gl.uniform4f(this.loc(F, 'uFx2'), full.x, full.y, 0, 0);
    gl.uniform2f(this.loc(F, 'uOut2'), v.outW, v.outH);
    const cells = grainCells(e.grainSize, Math.max(v.outW, v.outH));
    gl.uniform2f(this.loc(F, 'uCells'), cells, cells * (v.outH / v.outW));
    if (into === 'canvas') {
      if (this.canvas.width !== full.w || this.canvas.height !== full.h) {
        this.canvas.width = full.w;
        this.canvas.height = full.h;
      }
      this.draw(F, { fbo: null, w: full.w, h: full.h });
      return null;
    }
    const tt = this.target(full.w, full.h, 'u8', 4);
    this.draw(F, tt);
    const px = new Uint8Array(full.w * full.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tt.fbo);
    gl.readPixels(0, 0, full.w, full.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }

  /** The part of the picture in `v` drawn on the canvas (the canvas takes the part's size). */
  renderToCanvas(r: Recipe, v: View): void {
    this.run(r, v, 'canvas');
  }

  /** A part of the drawn picture as RGBA pixels, the top row first. */
  renderPixels(r: Recipe, v: View): Uint8Array {
    return this.run(r, v, 'read') ?? new Uint8Array(0);
  }

  /** The tile size an export uses: at most 1,536 px, never over the phone's texture limit less the halo. */
  get tile(): number {
    return Math.max(256, Math.min(1536, this.caps.maxTexture - 2 * HALO));
  }
}

/** The picture's tiles, row by row: x, y, w, h in the output's pixels. */
export function tilesOf(w: number, h: number, tile: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) out.push({ x, y, w: Math.min(tile, w - x), h: Math.min(tile, h - y) });
  return out;
}

/** The most pixels a canvas holds on an iPhone (Safari's limit); an export larger than it is made at the largest size that fits, and said. */
export const CANVAS_PIXELS = 16_777_216;

/**
 * The whole picture at its own full size (or the largest that a canvas can hold), in tiles, stitched on a canvas. `onTile` says how far it
 * is. Returns the canvas, and its size against the size asked for.
 */
export async function exportCanvas(g: PhotoGL | null, srcData: (() => Src) | null, r: Recipe, srcSize: { w: number; h: number }, layer: (() => Src) | null, onTile?: (done: number, of: number) => void): Promise<{ canvas: HTMLCanvasElement; w: number; h: number; wanted: { w: number; h: number }; capped: boolean; slow: boolean }> {
  const want = outputSize(r, srcSize.w, srcSize.h);
  let { w, h } = want;
  let capped = false;
  if (w * h > CANVAS_PIXELS) {
    const k = Math.sqrt(CANVAS_PIXELS / (w * h));
    w = Math.floor(w * k);
    h = Math.floor(h * k);
    capped = true;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tile = g ? g.tile : 512;
  const tiles = tilesOf(w, h, tile);
  const slow = !g || g.lost;
  const fullW = want.w;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    let px: Uint8ClampedArray;
    if (g && !g.lost) px = new Uint8ClampedArray(g.renderPixels(r, { outW: w, outH: h, region: t, fullW }).buffer as ArrayBuffer);
    else px = renderCpu({ src: srcData!(), recipe: r, layer: layer?.() ?? null, outW: w, outH: h, region: t, fullW });
    ctx.putImageData(new ImageData(px as unknown as Uint8ClampedArray<ArrayBuffer>, t.w, t.h), t.x, t.y);
    onTile?.(i + 1, tiles.length);
    await new Promise((ok) => setTimeout(ok, 0));
  }
  return { canvas, w, h, wanted: want, capped, slow };
}

/** A canvas's pixels as the slow path reads them. */
export function srcOf(c: HTMLCanvasElement): Src {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  return { w: d.width, h: d.height, data: d.data };
}

/**
 * The GPU's picture against the slow path's, for a small test picture and a recipe: the largest difference in any channel of any pixel,
 * in units of 1/255. The spec and the benchmark hold it to 1.
 */
export function compare(g: PhotoGL, canvas: HTMLCanvasElement, r: Recipe, layer: HTMLCanvasElement | null, size: { w: number; h: number }): { max: number; mean: number; at: number } {
  g.setSource(canvas);
  g.setLayer(layer);
  const src = srcOf(canvas);
  const lay = layer ? srcOf(layer) : null;
  const view: View = { outW: size.w, outH: size.h, region: { x: 0, y: 0, w: size.w, h: size.h }, fullW: size.w };
  const a = g.renderPixels(r, view);
  const b = renderCpu({ src, recipe: r, layer: lay, outW: size.w, outH: size.h });
  let max = 0;
  let sum = 0;
  let at = 0;
  for (let i = 0; i < a.length; i++) {
    if (i % 4 === 3) continue;
    const d = Math.abs(a[i]! - b[i]!);
    sum += d;
    if (d > max) {
      max = d;
      at = i;
    }
  }
  return { max, mean: sum / ((a.length / 4) * 3), at };
}

export { maskAt, alphaAt };
