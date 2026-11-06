/* The one shared canvas of the round-two worlds (BRIEF-DIRECTIONS-2): a single full-screen fragment shader per screen,
   drawn once into one WebGL2 canvas behind the page's type. On the phone the same shader would run every frame on one
   shared canvas; here it is drawn once, in horizontal bands, so a software renderer never stalls on one long draw, and
   `window.__ready` tells the renderer (tools/render.mjs) when the picture is complete.

   What it does for a page:
   - GL.scene({ frag, uniforms, colors, camera }) compiles the page's shader with the common library below, reads the theme's
     colours from the page's CSS tokens (so a theme swap on <html data-theme> recolours the 3-D too), sets the uniforms and
     draws.
   - GL.place() puts every overlay element that carries data-at="x y z" (a point in the 3-D world) or data-px="x y" (CSS px)
     where that point lands on screen, aligned by data-align, and keeps it inside the side gutter.
   No libraries, no network: plain WebGL2. */
(function () {
  'use strict';

  const LIB = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform vec2 uRes;      // the canvas in device pixels
uniform float uDpr;     // device pixels per CSS px
uniform vec3 uCamPos, uCamTgt;
uniform float uFov;     // vertical field of view, radians
uniform vec3 uAccent, uAccentPale;
#define PI 3.14159265
#define SAT(x) clamp(x, 0., 1.)
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float vnoise3(vec3 p) { vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3. - 2. * f);
  float a = hash13(i), b = hash13(i + vec3(1,0,0)), c = hash13(i + vec3(0,1,0)), d = hash13(i + vec3(1,1,0));
  float e = hash13(i + vec3(0,0,1)), g = hash13(i + vec3(1,0,1)), h = hash13(i + vec3(0,1,1)), k = hash13(i + vec3(1,1,1));
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z); }
vec3 aces(vec3 x) { return SAT((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14)); }
float smin(float a, float b, float k) { float h = SAT(.5 + .5 * (b - a) / k); return mix(b, a, h) - k * h * (1. - h); }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdRBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdBox2(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
float sdRBox2(vec2 p, vec2 b, float r) { return sdBox2(p, b - r) - r; }
float sdSeg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = SAT(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h); }
// the camera ray for this pixel (the same maths as GL.project in JS)
void camRay(vec2 fc, out vec3 ro, out vec3 rd) {
  vec2 uv = (fc - .5 * uRes) / uRes.y;
  vec3 fw = normalize(uCamTgt - uCamPos), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  float f = .5 / tan(uFov * .5);
  ro = uCamPos; rd = normalize(fw * f + uv.x * rt + uv.y * up);
}
// this pixel in CSS px, top-left origin (for 2-D worlds and for matching the page's layout)
vec2 cssPx(vec2 fc) { return vec2(fc.x, uRes.y - fc.y) / uDpr; }
// light scattered toward the eye by a point light in thin haze along the ray (closed form), for glows that are real light
float airlight(vec3 ro, vec3 rd, vec3 lp, float tmax) {
  vec3 q = ro - lp; float b = dot(rd, q), c = dot(q, q); float h = sqrt(max(c - b * b, 1e-4));
  return (atan((tmax + b) / h) - atan(b / h)) / h;
}
float grain(vec2 fc) { return hash12(fc + 7.31) - .5; }

// MIND, the orb, as the Machine draws it: a sphere of points (its surface sampled on rings, the far side fainter), the
// constellation of what Ghosty knows inside it (a node lit in the accent where that part has been studied), a small hard core,
// and one thin equator ring with a scale on it. No fog: a tight light round the core only. In the orb's own space: centre 0,
// radius 1. ro/rd are the ray there; px is one device pixel in those units (for edges that stay crisp); lit is how awake it is
// (1 idle, more when it answers). Returns premultiplied colour and coverage.
vec3 gBone = vec3(.92, .9, .86);
mat3 orbFrame() { float a = .5, b = .42; // the orb is turned a little so its rings are seen at an angle
  mat3 ry = mat3(cos(a), 0., -sin(a), 0., 1., 0., sin(a), 0., cos(a));
  mat3 rx = mat3(1., 0., 0., 0., cos(b), sin(b), 0., -sin(b), cos(b));
  return rx * ry; }
float sphereDots(vec3 q, float px) { // q on the unit sphere: the distance to the nearest sampled point, in units
  float th = acos(clamp(q.y, -1., 1.)), ph = atan(q.z, q.x);
  float rings = 40., dth = PI / rings; float best = 9.;
  float i0 = floor(th / dth + .5);
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k); if (i < 0. || i > rings) continue;
    float t = i * dth; float n = max(1., floor(2. * PI * sin(t) / dth + .5));
    float j = floor(ph / (2. * PI / n) + .5 + .5 * mod(i, 2.)) - .5 * mod(i, 2.);
    float pp = j * 2. * PI / n;
    vec3 s = vec3(sin(t) * cos(pp), cos(t), sin(t) * sin(pp));
    best = min(best, length(s - q));
  }
  return best;
}
vec4 mindOrb(vec3 ro, vec3 rd, float px, float lit, vec3 accent) {
  mat3 F = orbFrame(); vec3 o = F * ro, d = F * rd;
  vec3 col = vec3(0.); float cov = 0.;
  float b = dot(o, d), c = dot(o, o) - 1.; float h = b * b - c;
  // the silhouette: one hairline, so the orb has an edge where its points thin out
  float miss = sqrt(max(c - b * b + 1., 0.)); // the ray's nearest distance to the centre
  float sil = smoothstep(px * 1.3, 0., abs(miss - 1.)) * .55;
  col += gBone * sil; cov = max(cov, sil);
  if (h > 0.) {
    float t0 = -b - sqrt(h), t1 = -b + sqrt(h);
    vec3 pf = o + d * t0, pb = o + d * t1;
    float rr = px * 1.05 + .008;
    float df = sphereDots(normalize(pf), px), db = sphereDots(normalize(pb), px);
    float edge = pow(1. - abs(dot(normalize(pf), d)), 2.);
    float front = smoothstep(rr, rr - px * 1.5, df) * (.55 + .45 * edge);
    float back = smoothstep(rr * .8, rr * .8 - px * 1.5, db) * .22;
    vec3 inner = vec3(0.);
    // the constellation: nodes in cells of the ball, a few lit in the accent (what has been studied)
    for (int i = 0; i < 22; i++) {
      float t = mix(t0, t1, (float(i) + .5) / 22.);
      vec3 q = o + d * t; vec3 g = q * 3.2; vec3 id = floor(g); vec3 f = fract(g) - .5;
      float hsh = hash13(id + 4.);
      if (hsh > .55 && length(q) < .92) {
        vec3 off = (vec3(hash13(id + 1.), hash13(id + 2.), hash13(id + 3.)) - .5) * .55;
        float dd = length((f - off) - d * dot(f - off, d)) / 3.2;
        float node = smoothstep(px * 1.8 + .012, .0, dd);
        vec3 nc = hsh > .8 ? accent * 1.6 : gBone * .9;
        inner += nc * node * .5;
      }
    }
    // the core: small and hard, the accent with a white middle, its light kept tight
    float dc = length(o - d * dot(o, d));
    float core = exp(-dc * dc * 120.) * 1.4 + exp(-dc * dc * 18.) * .35;
    inner += mix(accent, vec3(1.), .55) * core * lit;
    col += gBone * (front + back) + inner;
    cov = max(cov, max(max(front, back), SAT(length(inner))));
  }
  // outside the sphere: only a faint, tight halo (light, not fog)
  float dl = length(o - d * dot(o, d));
  float halo = exp(-max(dl - 1., 0.) * 9.) * .06 * lit;
  col += accent * halo;
  return vec4(col, SAT(cov + halo));
}
`;

  const rgb = (name) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return [1, 0, 1];
    return v.split(',').map((x) => parseFloat(x) / 255);
  };

  let CAM = null; // { pos, tgt, fov }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

  /** A world point to CSS px on this screen (null behind the eye). */
  function project(p, W, H) {
    const fw = norm(sub(CAM.tgt, CAM.pos));
    const rt = norm(cross(fw, [0, 1, 0]));
    const up = cross(rt, fw);
    const d = sub(p, CAM.pos);
    const z = dot(d, fw);
    if (z <= 0.01) return null;
    const f = 0.5 / Math.tan(CAM.fov / 2);
    const u = (dot(d, rt) / z) * f, v = (dot(d, up) / z) * f;
    return [W / 2 + u * H, H / 2 - v * H, z];
  }

  /** Place the overlays: data-at (world) or data-px (CSS px), data-align = c | t | b | l | r | tl | tr | bl | br (the point is that
   *  part of the element), data-dx / data-dy nudge in CSS px; then keep each inside the screen less --gutter. */
  function place() {
    const scr = document.querySelector('.screen');
    const W = scr.clientWidth, H = scr.clientHeight;
    const gut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 16;
    for (const el of scr.querySelectorAll('[data-at],[data-px]')) {
      let p;
      if (el.dataset.at) {
        if (!CAM) continue;
        p = project(el.dataset.at.split(/[ ,]+/).map(Number), W, H);
        if (!p) { el.style.display = 'none'; continue; }
      } else {
        const v = el.dataset.px.split(/[ ,]+/);
        p = v.map((s, i) => (s.endsWith('%') ? (parseFloat(s) / 100) * (i ? H : W) : parseFloat(s)));
      }
      const x = p[0] + (parseFloat(el.dataset.dx) || 0), y = p[1] + (parseFloat(el.dataset.dy) || 0);
      const a = el.dataset.align || 'c';
      const r = el.getBoundingClientRect();
      let left = x - r.width / 2, top = y - r.height / 2;
      if (a.includes('l')) left = x;
      if (a.includes('r')) left = x - r.width;
      if (a.includes('t')) top = y;
      if (a.includes('b')) top = y - r.height;
      if (el.dataset.free === undefined) {
        left = Math.max(gut, Math.min(W - gut - r.width, left));
      }
      el.style.position = 'absolute';
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.margin = '0';
    }
    // a reticle round a thing in the world: data-box="x0 y0 z0 x1 y1 z1" (its bounds) → the box of its 8 corners on screen,
    // grown by data-pad px; kept inside the screen
    for (const el of scr.querySelectorAll('[data-box]')) {
      if (!CAM) continue;
      const v = el.dataset.box.split(/[ ,]+/).map(Number);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        const p = project([i & 1 ? v[3] : v[0], i & 2 ? v[4] : v[1], i & 4 ? v[5] : v[2]], W, H);
        if (!p) continue;
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
      }
      const pad = parseFloat(el.dataset.pad) || 0;
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      const min = parseFloat(el.dataset.min) || 0; // a reticle he can press is never under 44 pt
      if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
      if (y1 - y0 < min) { const c = (y0 + y1) / 2; y0 = c - min / 2; y1 = c + min / 2; }
      x0 = Math.max(2, x0); y0 = Math.max(2, y0); x1 = Math.min(W - 2, x1); y1 = Math.min(H - 2, y1);
      Object.assign(el.style, { position: 'absolute', left: `${Math.round(x0)}px`, top: `${Math.round(y0)}px`, width: `${Math.round(x1 - x0)}px`, height: `${Math.round(y1 - y0)}px` });
    }
    // a callout's leader: data-lead="#callout|#reticle" — out of the callout's side, a short level run, then straight to the
    // reticle's nearest corner; a dot where it lands
    for (const ln of scr.querySelectorAll('svg[data-lead]')) {
      const [sa, sb] = ln.dataset.lead.split('|');
      const A = scr.querySelector(sa), B = scr.querySelector(sb);
      if (!A || !B) continue;
      const sr = scr.getBoundingClientRect();
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      const R = (r) => [r.left - sr.left, r.top - sr.top, r.right - sr.left, r.bottom - sr.top];
      const ra = R(a), rb = R(b);
      const cl = (r, x, y) => [Math.max(r[0], Math.min(r[2], x)), Math.max(r[1], Math.min(r[3], y))];
      // the nearest points of the two boxes: from the callout's edge to the reticle's edge, one straight hairline
      let pb = cl(rb, (ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2);
      let pa = cl(ra, pb[0], pb[1]);
      pb = cl(rb, pa[0], pa[1]);
      ln.setAttribute('width', W); ln.setAttribute('height', H); ln.setAttribute('viewBox', `0 0 ${W} ${H}`);
      ln.innerHTML = `<path d="M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}"/><circle cx="${pb[0].toFixed(1)}" cy="${pb[1].toFixed(1)}" r="2"/>`;
    }
  }

  function setU(gl, prog, name, v) {
    const loc = gl.getUniformLocation(prog, name);
    if (loc === null) return;
    if (typeof v === 'number') return gl.uniform1f(loc, v);
    if (Array.isArray(v) && typeof v[0] === 'number') return gl[`uniform${v.length}f`](loc, ...v);
    if (Array.isArray(v) && Array.isArray(v[0])) {
      const n = v[0].length;
      return gl[`uniform${n}fv`](loc, new Float32Array(v.flat()));
    }
  }

  async function scene(opt) {
    try { await draw(opt); } catch (e) { window.__glError = String(e && e.message || e); window.__ready = true; console.error(window.__glError); }
  }

  async function draw(opt) {
    const canvas = document.querySelector('canvas.gl');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr * (opt.scale || 1));
    canvas.height = Math.round(H * dpr * (opt.scale || 1));
    if (opt.camera) CAM = { pos: opt.camera.pos, tgt: opt.camera.tgt, fov: opt.camera.fov };
    // the orb where the screen needs it: orbAt = [x px, y px, depth m, radius px] → its centre and radius in the world
    if (opt.orbAt && CAM) {
      const [sx, sy, dd, rp] = opt.orbAt;
      const fw = norm(sub(CAM.tgt, CAM.pos)), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
      const f = 0.5 / Math.tan(CAM.fov / 2);
      const u = (sx - W / 2) / H, v = (H / 2 - sy) / H;
      const dir = norm([fw[0] * f + rt[0] * u + up[0] * v, fw[1] * f + rt[1] * u + up[1] * v, fw[2] * f + rt[2] * u + up[2] * v]);
      const along = dd / dot(dir, fw);
      const c = [CAM.pos[0] + dir[0] * along, CAM.pos[1] + dir[1] * along, CAM.pos[2] + dir[2] * along];
      opt.uniforms = Object.assign({}, opt.uniforms, { uOrb: [c[0], c[1], c[2], (rp / H) * dd / f] });
    }
    place();
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: !!opt.alpha });
    const fail = (msg) => { window.__glError = msg; window.__ready = true; console.error(msg); };
    if (!gl) return fail('no webgl2');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const lines = src.split('\n');
        const m = /0:(\d+)/.exec(log || '');
        const at = m ? `\n> ${lines[Number(m[1]) - 1]}` : '';
        throw new Error(log + at);
      }
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, LIB + opt.frag));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { return fail(String(e.message || e)); }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    setU(gl, prog, 'uRes', [canvas.width, canvas.height]);
    setU(gl, prog, 'uDpr', dpr * (opt.scale || 1));
    if (CAM) { setU(gl, prog, 'uCamPos', CAM.pos); setU(gl, prog, 'uCamTgt', CAM.tgt); setU(gl, prog, 'uFov', CAM.fov); }
    setU(gl, prog, 'uAccent', rgb('--accent-rgb'));
    setU(gl, prog, 'uAccentPale', rgb('--accent-pale-rgb'));
    for (const [k, v] of Object.entries(opt.colors || {})) setU(gl, prog, k, rgb(v));
    for (const [k, v] of Object.entries(opt.uniforms || {})) setU(gl, prog, k, v);
    // a picture for the shader (uImg): an SVG or PNG drawn at the canvas's own size, so a feed can be scanned or dithered
    if (opt.image) {
      const img = new Image();
      img.src = opt.image;
      await img.decode();
      const c2 = document.createElement('canvas');
      c2.width = canvas.width; c2.height = canvas.height;
      const g2 = c2.getContext('2d');
      // cover the canvas, centred (as preserveAspectRatio slice would)
      const s = Math.max(c2.width / img.width, c2.height / img.height);
      const iw = img.width * s, ih = img.height * s;
      g2.fillStyle = '#000'; g2.fillRect(0, 0, c2.width, c2.height);
      g2.drawImage(img, (c2.width - iw) / 2, (c2.height - ih) * (opt.imageY ?? 0.5), iw, ih);
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c2);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const lu = gl.getUniformLocation(prog, 'uImg');
      if (lu !== null) gl.uniform1i(lu, 0);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.SCISSOR_TEST);
    const band = opt.band || 40;
    const px = new Uint8Array(4);
    const t0 = performance.now();
    for (let y = 0; y < canvas.height; y += band) {
      gl.scissor(0, y, canvas.width, Math.min(band, canvas.height - y));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for this band before the next is queued
      await new Promise((r) => setTimeout(r, 0));
    }
    window.__glMs = Math.round(performance.now() - t0);
    place();
    window.__ready = true;
  }

  window.GL = { scene, place, project: (p) => { const s = document.querySelector('.screen'); return project(p, s.clientWidth, s.clientHeight); } };
})();
