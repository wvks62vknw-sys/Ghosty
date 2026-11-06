/* W1 · THE SCAN — the scene. One fragment shader draws the room Ghosty keeps, as the Machine would keep it: a 3-D scan, every
   surface sampled as points, every edge drawn in one hairline, lit only by the orb that floats in it. The things he uses stand
   where they belong (the window onto Birmingham, the shelf, the desk with tonight's book, the calendar, the chess table); the
   type is laid over them by the page from the same numbers (GL.place: data-box, data-at).
   Modes: 0 the room (Home), 1 the city through the window (the Stage), 2 the Learn room (the hub), 3 the camera (the Lens).
   Units are metres; y is up; the camera looks towards −z. */
window.SCAN_FRAG = `
uniform float uMode;
uniform vec4 uOrb;            // the orb: centre, radius
uniform float uOrbLit;        // how awake it is (1 idle)
uniform vec4 uRoom;           // the room: half width, height, back wall z, front z
uniform vec4 uWin;            // the window on the back wall: x0, y0, x1, y1 (none if x1 <= x0)
uniform vec4 uBoxC[20];       // a thing: centre, kind
uniform vec4 uBoxH[20];       // its half size, and how lit (0 bone, 1 the accent: what Ghosty is attending to)
uniform float uN;             // how many things
uniform vec3 uBoneC;          // bone, from the tokens
uniform vec2 uRoute[11];      // the city: the walk (0..5) then the train (5..10), model units
uniform float uRouteOn;       // how much of the route is drawn (0..1)
uniform float uFade;          // the room fading as the camera leaves it (storyboard)
uniform sampler2D uImg;       // the camera's picture (the Lens)
uniform float uSweep;         // the Lens: where the scan's sweep is (0..1 of the screen)
uniform vec4 uClip;           // CSS px: the scan is drawn inside this rectangle only (x0, y0, x1, y1); 0 0 0 0 = everywhere

vec3 gAcc;
float gPx;                    // one device pixel at unit distance, in world units

// ---------------------------------------------------------------- the room's things
float sdThing(vec3 p, int i) {
  vec3 c = uBoxC[i].xyz, h = uBoxH[i].xyz; float k = uBoxC[i].w;
  if (k == 8.) { // the arcade cabinet: a box with its screen face leaning back
    float b = sdBox(p - c, h);
    vec3 q = p - c; float cut = dot(q - vec3(0., h.y * .35, h.z), normalize(vec3(0., .55, 1.)));
    return max(b, cut);
  }
  return sdBox(p - c, h);
}
float sdRoom(vec3 p) {
  float d = min(min(p.y, uRoom.y - p.y), min(p.x + uRoom.x, uRoom.x - p.x));
  float back = p.z - uRoom.z;
  if (uWin.z > uWin.x) {
    vec2 wc = (uWin.xy + uWin.zw) * .5, wh = (uWin.zw - uWin.xy) * .5;
    float hole = sdBox(p - vec3(wc, uRoom.z), vec3(wh, .3));
    back = max(back, -hole);
  }
  return min(d, back);
}
vec2 mapRoom(vec3 p) {
  vec2 r = vec2(sdRoom(p), -1.);
  for (int i = 0; i < 20; i++) {
    if (float(i) >= uN) break;
    float d = sdThing(p, i);
    if (d < r.x) r = vec2(d, float(i));
  }
  return r;
}
// ---------------------------------------------------------------- the city (the Stage), model units: 1 = 60 px of the old map
float street(vec2 c) {
  float s = 1e3;
  s = min(s, abs(c.y - .5));  s = min(s, abs(c.x + 1.6)); s = min(s, abs(c.x - .0));
  s = min(s, abs(c.y + 1.4)); s = min(s, abs(c.x - 1.9)); s = min(s, abs(c.y - 1.9));
  s = min(s, abs(dot(c, normalize(vec2(1., 1.25))) - .9)); s = min(s, abs(dot(c, normalize(vec2(1., -.8))) + 1.1));
  s = min(s, abs(length(c - vec2(.1, .1)) - 2.6) ); // the ring road
  return s;
}
float routeD(vec2 c, out float walk) {
  float d = 1e3; walk = 0.;
  for (int i = 0; i < 10; i++) {
    float e = sdSeg2(c, uRoute[i], uRoute[i + 1]);
    if (e < d) { d = e; walk = i < 5 ? 1. : 0.; }
  }
  return d;
}
float bH(vec2 id) {
  vec2 ctr = (id + .5) * .2;
  float st = street(ctr);
  if (st < .13) return 0.;
  float w; if (routeD(ctr, w) < .12) return 0.;
  if (length(ctr) > 3.6) return 0.;
  float nr = length(ctr - vec2(0., 0.));
  float h = .03 + .1 * pow(hash12(id), 3.) + .62 * exp(-nr * nr * .35) * pow(hash12(id + 7.), 4.) + .05 * step(.8, hash12(id + 2.));
  if (abs(ctr.x) < .5 && abs(ctr.y) < .14) h = .07; // New Street: the station's long roof
  return h;
}
vec2 mapCity(vec3 p) {
  vec2 r = vec2(p.y, 0.);
  vec2 cell = floor(p.xz / .2);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = cell + vec2(i, j);
    float h = bH(id);
    if (h <= 0.) continue;
    vec2 ctr = (id + .5) * .2;
    float d = sdBox(p - vec3(ctr.x, h * .5, ctr.y), vec3(.078, h * .5, .078));
    if (d < r.x) r = vec2(d, 1.);
  }
  return r;
}
vec2 map(vec3 p) { return uMode == 1. ? mapCity(p) : mapRoom(p); }
vec3 nrm(vec3 p) {
  vec2 e = vec2(.0006, 0.);
  return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}
float march(vec3 ro, vec3 rd, out float id, out bool outside) {
  float t = .02; id = -2.; outside = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t;
    if (uMode != 1. && p.z < uRoom.z - .08) { outside = true; return t; }
    vec2 h = map(p);
    if (h.x < .0004 * t + .0002) { id = h.y; return t; }
    t += h.x * (uMode == 1. ? .7 : .95);
    if (t > 40.) break;
  }
  return -1.;
}
// ---------------------------------------------------------------- points and edges
float dots2(vec2 q, float s, float r) { // the distance to the nearest point of a jittered lattice, minus its radius
  vec2 c = floor(q / s); float best = 9.;
  for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++) {
    vec2 id = c + vec2(i, j);
    vec2 pt = (id + .2 + .6 * hash22(id)) * s;
    best = min(best, length(q - pt));
  }
  return best - r;
}
vec2 faceUV(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > a.x && a.y > a.z) return p.xz;
  if (a.x > a.z) return p.zy;
  return p.xy;
}
float boxEdge(vec3 p, int i, float w) { // near two faces at once: an edge of the thing
  vec3 q = abs(p - uBoxC[i].xyz) - uBoxH[i].xyz;
  vec3 e = step(-w, q);
  return step(1.5, e.x + e.y + e.z);
}
// the orb's light on a point: how the scan is lit
float lightAt(vec3 p, vec3 n) {
  vec3 L = uOrb.xyz - p; float d = length(L); L /= d;
  float dif = max(dot(n, L), 0.);
  return (.16 + .84 * dif) * 1.9 / (1. + .55 * d * d);
}
// ---------------------------------------------------------------- Birmingham through the window, at night
vec3 skyline(vec3 ro, vec3 rd) {
  // Birmingham from a high window: three rows of towers far off, below the eye; each facade a grid of window points, a few lit;
  // a hairline along each roof. Nothing filled: the Machine draws a city as what it can see of it.
  vec3 col = vec3(0.);
  if (rd.z > -.05) return col;
  for (int layer = 0; layer < 3; layer++) {
    float z = -140. - float(layer) * 120.;
    float t = (z - ro.z) / rd.z; vec3 p = ro + rd * t;
    float w = 9. + 3. * float(layer);
    if (t < 0.) continue;
    float cx = floor(p.x / w + hash11(float(layer)) );
    float h = -45. + (10. + 40. * pow(hash11(cx * 1.7 + float(layer) * 31.), 2.)) ;
    if (hash11(cx + 3.1 + float(layer)) > .86) h += 45. * hash11(cx + 8.);
    float px = gPx * t;
    if (p.y < h && p.y > -120.) {
      float sx = 1.7 + float(layer) * .4, sy = 2.2 + float(layer) * .4;
      vec2 wid = vec2(floor(p.x / sx), floor(p.y / sy));
      vec2 f = vec2(fract(p.x / sx) * sx, fract(p.y / sy) * sy) - vec2(sx, sy) * .5;
      float on = step(.7, hash12(wid + float(layer) * 9.));
      float pt = smoothstep(px * 1.3 + .12, .0, length(f));
      float roof = smoothstep(px * 1.2, 0., h - p.y);
      float side = smoothstep(px * 1.2, 0., w * .5 - abs(fract(p.x / w + hash11(float(layer))) - .5) * w);
      float a = (pt * (.12 + .88 * on) + roof * .8 + side * .25) / (1. + float(layer) * .7);
      vec3 c = mix(uBoneC, gAcc, step(.9, hash12(wid + 5.)) * on);
      return c * a;
    }
  }
  // two aircraft over the city: one light each (God's eye is watching them)
  for (int k = 0; k < 2; k++) {
    vec2 a = k == 0 ? vec2(-22., 38.) : vec2(30., 52.); float ta = (-300. - ro.z) / rd.z; vec3 pa = ro + rd * ta;
    col += uBoneC * smoothstep(gPx * ta * 2. + .4, .0, length(pa.xy - a));
  }
  return col;
}
void main() {
  gAcc = uAccent;
  vec3 ro, rd; camRay(gl_FragCoord.xy, ro, rd);
  gPx = 2. * tan(uFov * .5) / uRes.y;
  vec3 col = vec3(0.);

  if (uMode == 3.) { // THE LENS: the camera's picture, quietened to the Machine's grey, the table measured by the scan's grid
    vec2 uv = gl_FragCoord.xy / uRes;
    vec3 im = texture(uImg, uv).rgb;
    float l = dot(im, vec3(.299, .587, .114));
    col = vec3(pow(l, 1.15)) * .7 * uBoneC;
    // the table's plane (y = 0), as the scan measures it: a grid of points that fades with distance
    if (rd.y < -.02) {
      float t = -ro.y / rd.y; vec3 p = ro + rd * t;
      vec2 g = p.xz / .05; vec2 f = abs(fract(g) - .5);
      float pt = smoothstep(.09, .03, length(f) * .05 / (gPx * t) * .05 * 40.);
      float dd = length(fract(g) - .5);
      float dot1 = smoothstep(gPx * t / .05 * 1.4, 0., dd - .035);
      col += uBoneC * dot1 * .55 * exp(-t * .45);
      // the sweep: a line of light crossing the table, where the scan is now
      float sw = abs(p.z - (-.15 - uSweep * 1.2));
      col += gAcc * smoothstep(gPx * t * 2.5, 0., sw) * .9 * step(abs(p.x), 1.2);
    }
    col += grain(gl_FragCoord.xy) * .03;
    fragColor = vec4(col, 1.); return;
  }

  vec2 cp = cssPx(gl_FragCoord.xy);
  bool clipped = uClip.z > uClip.x && (cp.x < uClip.x || cp.x > uClip.z || cp.y < uClip.y || cp.y > uClip.w);
  float id; bool outside = false;
  float t = clipped ? -1. : march(ro, rd, id, outside);
  vec4 ob = vec4(0.);
  vec3 lo = (ro - uOrb.xyz) / uOrb.w;
  float tOrb = 1e9;
  { vec3 oc = ro - uOrb.xyz; float b = dot(oc, rd), c = dot(oc, oc) - uOrb.w * uOrb.w * 1.9; float h = b * b - c; if (h > 0.) tOrb = -b - sqrt(h); }

  if (outside) {
    col = skyline(ro, rd) * uFade;
  } else if (t > 0.) {
    vec3 p = ro + rd * t; vec3 n = nrm(p);
    float px = gPx * t;                                       // one device pixel, here
    float li = lightAt(p, n);
    float fog = exp(-max(t - 1.5, 0.) * .08);
    if (uMode == 1.) {
      // the city: the ground sparse, the buildings denser, their edges drawn
      float walk; float rdist = routeD(p.xz, walk);
      bool ground = id < .5;
      float s = ground ? .05 : .028;
      float d = dots2(faceUV(p, n), s, px * .8 + s * .07);
      float a = smoothstep(px, -px, d) * (ground ? .35 : .8);
      if (!ground) {
        vec2 cell = floor(p.xz / .2); vec2 ctr = (cell + .5) * .2; float h = bH(cell);
        vec3 q = abs(p - vec3(ctr.x, h * .5, ctr.y)) - vec3(.078, h * .5, .078);
        vec3 e = step(-px * 1.2, q); float edge = step(1.5, e.x + e.y + e.z);
        a = max(a, edge * .95);
      }
      float shade = (.25 + .75 * max(dot(n, normalize(vec3(-.3, 1., .4))), 0.));
      col = uBoneC * a * shade * fog;
      // the way: walking dotted, the train solid, in the accent
      float drawn = uRouteOn;
      if (ground) {
        float on = smoothstep(px * 2.2 + .012, .0, rdist);
        if (walk > .5) on *= step(.5, fract(dot(p.xz, vec2(.7, .7)) * 9.));
        col = mix(col, gAcc * 1.2, on * drawn);
        col += gAcc * smoothstep(.12, 0., rdist) * .08 * drawn;
      }
      // New Street, the walk's start and the train's end: rings on the ground
      for (int k = 0; k < 3; k++) {
        vec2 c = k == 0 ? uRoute[0] : (k == 1 ? uRoute[5] : uRoute[10]);
        float rr = abs(length(p.xz - c) - (k == 1 ? .17 : .1));
        col += (k == 1 ? gAcc : uBoneC) * smoothstep(px * 1.6, 0., rr) * (ground ? 1. : 0.) * drawn;
      }
    } else {
      // the room: what each surface is
      bool wall = id < -.5;
      int i = int(id);
      float kind = wall ? -1. : uBoxC[i].w;
      float lit = wall ? 0. : uBoxH[i].w;
      float s = wall ? (p.y < .002 ? .05 : .06) : .016;
      if (kind == 1. || kind == 2. || kind == 3.) s = .009;
      vec2 uv = faceUV(p, n);
      float d = dots2(uv, s, px * .55 + s * .05);
      float a = smoothstep(px, -px, d) * (wall ? (p.y < .002 ? .5 : .32) : 1.);
      float edge = 0.;
      if (!wall) edge = boxEdge(p, i, px * 1.3);
      else {
        // where two walls meet, and the window's frame
        float w = px * 1.4;
        float near = step(p.y, w) + step(uRoom.y - p.y, w) + step(p.x + uRoom.x, w) + step(uRoom.x - p.x, w) + step(p.z - uRoom.z, w);
        edge = step(1.5, near);
        if (uWin.z > uWin.x && abs(p.z - uRoom.z) < .32) {
          vec2 q = p.xy; vec2 wc = (uWin.xy + uWin.zw) * .5, wh = (uWin.zw - uWin.xy) * .5;
          float fr = abs(sdBox2(q - wc, wh));
          edge = max(edge, step(fr, w) * step(abs(p.z - uRoom.z), .31));
        }
      }
      // the face of a thing carries what it is: a book's lines of type, a board's squares, a calendar's days, a shelf's spines
      vec3 lq = wall ? p : p - uBoxC[i].xyz; vec3 hh = wall ? vec3(1.) : uBoxH[i].xyz;
      float pat = 1.;
      if (kind == 1. && n.y > .5) { // the open book: two pages of lines
        float row = fract((lq.z + hh.z) / .016); float side = abs(lq.x);
        pat = (step(.02, side) * step(side, hh.x - .02) * step(abs(lq.z), hh.z - .02)) > .5 ? (row < .55 ? 1. : .12) : .5;
        if (side < .006) pat = 0.;
      }
      if (kind == 5. && n.y > .5) { // the chessboard
        vec2 sq = floor((lq.xz + hh.xz) / (hh.xz * 2. / 8.));
        pat = mod(sq.x + sq.y, 2.) < .5 ? 1. : .25;
      }
      if (kind == 6. && n.z > .5) { // the calendar: a month of days, one ringed
        vec2 g = (lq.xy + hh.xy) / (hh.xy * 2.) * vec2(7., 6.);
        vec2 f = abs(fract(g) - .5);
        pat = (max(f.x, f.y) > .44 ? 1. : .3);
        if (g.y > 5.) pat = .9;
        edge = max(edge, step(length((fract(g) - .5) * vec2(1., 1.)) , .5) * step(.36, length(fract(g) - .5)) * step(abs(floor(g.x) - 5.), .1) * step(abs(floor(g.y) - 3.), .1));
      }
      if (kind == 7. && n.z > .5) { // the shelf: the books standing on it
        float sh = (lq.y + hh.y) / (hh.y * 2.) * 5.;
        float fy = fract(sh); float sx = (lq.x + hh.x) / .028; float sid = floor(sx) + floor(sh) * 40.;
        float tall = .55 + .4 * hash11(sid);
        pat = fy < .06 ? 1. : (fy < tall ? (fract(sx) < .12 ? .15 : .9) : .08);
        edge = max(edge, step(fy, .06) * .7);
      }
      if (kind == 9. && n.y > .5) { // a keyboard: its keys
        float kx = fract((lq.x + hh.x) / .024);
        pat = kx < .14 ? .1 : (lq.z < 0. && fract((lq.x + hh.x) / .024 / 7. * 5.) > .4 ? .35 : 1.);
      }
      if (kind == 8. && n.z > .3) { // the arcade cabinet's screen
        pat = (abs(lq.x) < hh.x - .03 && lq.y > -.05) ? 1.3 : .8;
      }
      a *= pat;
      vec3 c = mix(uBoneC, mix(gAcc, uAccentPale, .35), lit);
      float bright = li * (wall ? .55 : 1.) * (1. + lit * .6);
      col = c * (a * bright + edge * (wall ? .5 : .95) * (.45 + .55 * li)) * fog * uFade;
    }
  }
  // the orb, in front of whatever is behind it
  vec4 o = mindOrb(lo, rd, gPx * max(length(uOrb.xyz - ro), .1) / uOrb.w, uOrbLit, gAcc);
  if (t < 0. || outside || tOrb < t) col = col * (1. - o.a) + o.rgb;
  col = pow(col, vec3(.95));
  col += grain(gl_FragCoord.xy) * .012;
  fragColor = vec4(col, 1.);
}
`;
