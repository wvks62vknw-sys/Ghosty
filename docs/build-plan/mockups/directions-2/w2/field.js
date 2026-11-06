/* W2 · THE MAP — the scene. One fragment shader draws the plane everything Ghosty sees and does is plotted on: a fine grid
   with crosshairs every five squares, the six areas as territories with dashed borders, a faint point for every one of his
   abilities inside them, the square of what is at hand round the origin, and Mind standing over the origin on its altitude
   line. At its deepest the same plane is the city: the streets of Birmingham, the walk and the train (uCity 0 → 1). The camera
   is the only verb: pinch is altitude, a typed word is a flight. Map units: 1 = one square of the grid; y is up. */
window.FIELD_FRAG = `
uniform vec4 uOrb;          // the orb: centre, radius
uniform float uOrbLit;
uniform vec2 uSeed[6];      // the six areas' centres (map units)
uniform float uHere;        // which area is lit (-1 none)
uniform float uCity;        // 0 the field; 1 the city (the deepest zoom of the Journey)
uniform vec2 uCityAt;       // where the Journey's point is on the field
uniform float uCityScale;   // the city's own units per map unit
uniform vec2 uRoute[11];    // the walk then the train (city units)
uniform float uRouteOn;
uniform float uDots;        // how many ability points to draw (fade with altitude)
uniform vec3 uBoneC;
uniform vec4 uClip;         // CSS px rect (x0 y0 x1 y1) to draw in; 0 = all
uniform sampler2D uImg;     // the Lens: the camera's picture
uniform float uLens;
uniform float uField;       // the field's own layers (territories, the points, the square at hand): 0 on the Lens
uniform float uGridK;       // squares per map unit (10 on the Lens: the grid laid on his table in tenths of a metre)
uniform float uCityR;       // the dive: inside this many map units of the Journey's point the field is already the city
uniform float uFoot;        // the orb stands on the field (1) or is elsewhere on the screen (0): its foot and altitude line

vec3 gAcc;
float lineAA(float d, float w) { return smoothstep(w, 0., d); }
// the six territories: the nearest seed, and how far from the border with the next nearest
// the six districts: a rectangle round each area's centre (2.1 squares either side, 1.4 deep), streets between them
vec3 territory(vec2 p) {
  float best = 1e9; float id = -1.;
  for (int i = 0; i < 6; i++) {
    float d = sdBox2(p - uSeed[i], vec2(2.1, 1.4));
    if (d < best) { best = d; id = float(i); }
  }
  return vec3(id, best, 0.);
}
float streets(vec2 c, float px) {
  float s = 1e3;
  s = min(s, abs(c.y - .5)); s = min(s, abs(c.x + 1.6)); s = min(s, abs(c.x));
  s = min(s, abs(c.y + 1.4)); s = min(s, abs(c.x - 1.9)); s = min(s, abs(c.y - 1.9));
  s = min(s, abs(dot(c, normalize(vec2(1., 1.25))) - .9)); s = min(s, abs(dot(c, normalize(vec2(1., -.8))) + 1.1));
  float ring = abs(length(c - vec2(.1, .1)) - 2.6);
  float main = lineAA(min(s, ring), px * 1.4);
  // the minor streets: a crooked grid
  vec2 g = c * 3.2 + vec2(vnoise(c * 2.) * .25, vnoise(c * 2. + 7.) * .25);
  vec2 f = abs(fract(g) - .5);
  float minor = lineAA((.5 - max(f.x, f.y)) / 3.2, px * 1.1) * .45;
  return max(main, minor);
}
float routeD(vec2 c, out float walk) {
  float d = 1e3; walk = 0.;
  for (int i = 0; i < 10; i++) { float e = sdSeg2(c, uRoute[i], uRoute[i + 1]); if (e < d) { d = e; walk = i < 5 ? 1. : 0.; } }
  return d;
}
void main() {
  gAcc = uAccent;
  vec2 cp = cssPx(gl_FragCoord.xy);
  vec3 ro, rd; camRay(gl_FragCoord.xy, ro, rd);
  vec3 col = vec3(0.);
  bool clipped = uClip.z > uClip.x && (cp.x < uClip.x || cp.x > uClip.z || cp.y < uClip.y || cp.y > uClip.w);
  if (!clipped && rd.y < 0.) {
    float t = -ro.y / rd.y; vec2 p = (ro + rd * t).xz * uGridK;
    vec2 dp = fwidth(p); float px = max(dp.x, dp.y);          // one device pixel, in map units, here
    float fade = exp(-t * .018) * smoothstep(.55, .12, px);
    if (uLens > .5) {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec3 im = texture(uImg, uv).rgb; float l = dot(im, vec3(.299, .587, .114));
      col = uBoneC * pow(l, 1.2) * .55;
    }
    bool inCity = uCity > .5 || (uCityAt.x < 900. && length(p - uCityAt) < uCityR);
    if (!inCity) {
      // the grid: a hairline every square, a crosshair every five
      vec2 f = abs(fract(p + .5) - .5);
      float g = lineAA(min(f.x, f.y), px * .9) * .1;
      vec2 f5 = abs(fract(p / 5. + .5) - .5) * 5.;
      float cross = lineAA(f5.x, px * 1.1) * step(f5.y, .22) + lineAA(f5.y, px * 1.1) * step(f5.x, .22);
      col += uBoneC * (g + cross * .5) * fade;
      if (uField > .5) {
      // the territories: dashed borders; the lit one a little brighter
      vec3 tr = territory(p);
      bool here = abs(tr.x - uHere) < .5;
      float dash = step(.45, fract((abs(p.x) + abs(p.y)) * 2.5));
      float border = lineAA(abs(tr.y), px * 1.3) * dash;
      col += (here ? gAcc : uBoneC) * border * (here ? .9 : .5) * fade;
      // every ability as a point: a small square on a crossing of the grid, inside a district
      vec2 gc = floor(p * 2. + .5); vec2 gq = p * 2. - gc;
      float exists = step(.48, hash12(gc + 9.)) * step(tr.y, -.12) * uDots;
      float sqp = sdBox2(gq / 2., vec2(.035));
      float dotp = lineAA(abs(sqp), px * 1.1) * exists;
      col += mix(uBoneC, gAcc, here ? .6 : 0.) * dotp * .8 * fade;
      // the square of what is at hand, round the origin: a full box and its nine squares
      float sq = sdBox2(p, vec2(1.5));
      col += uBoneC * lineAA(abs(sq), px * 1.5) * .85 * fade;
      vec2 fi = abs(fract(p + .5) - .5);
      col += uBoneC * lineAA(min(fi.x, fi.y), px * 1.) * step(sq, 0.) * .14 * fade;
      // the Journey's point, when he has asked for it
      if (uCityAt.x < 900.) {
        float jd = sdBox2(p - uCityAt, vec2(.32));
        col += gAcc * lineAA(abs(jd), px * 1.6) * .95 * fade;
      }
      }
    } else {
      // the deepest zoom: the city round New Street, in the same hand: streets in hairlines, blocks as faint points
      vec2 c = (p - uCityAt) * uCityScale; float cpx = px * uCityScale;
      float st = streets(c, cpx);
      col += uBoneC * st * .42;
      vec2 b = floor(c * 9.); vec2 bq = fract(c * 9.) - .5;
      float blk = lineAA(length(bq) / 9., cpx * 1.2 + .006) * step(.35, hash12(b)) * (1. - st) * step(length(c), 4.2);
      col += uBoneC * blk * .35;
      float walk; float rdd = routeD(c, walk);
      float on = lineAA(rdd, cpx * 2.2 + .012) * uRouteOn;
      if (walk > .5) on *= step(.5, fract(dot(c, vec2(.7, .7)) * 9.));
      col = mix(col, gAcc * 1.15, on);
      for (int k = 0; k < 3; k++) {
        vec2 m = k == 0 ? uRoute[0] : (k == 1 ? uRoute[5] : uRoute[10]);
        col += (k == 1 ? gAcc : uBoneC) * lineAA(abs(length(c - m) - (k == 1 ? .17 : .1)), cpx * 1.6) * uRouteOn;
      }
    }
    // the orb's foot: where it stands over the field, a ring and the line up to it
    vec2 foot = uOrb.xz;
    float fr = abs(length(p - foot) - uOrb.w * .9);
    col += uBoneC * lineAA(fr, px * 1.4) * .7 * (1. - uCity) * uField * uFoot * fade;
  }
  // the altitude line from the foot to the orb, then the orb itself
  {
    vec3 a = vec3(uOrb.x, 0., uOrb.z), b = uOrb.xyz - vec3(0., uOrb.w, 0.);
    // the nearest approach of the ray to the segment ab, in screen terms
    vec3 ba = b - a; vec3 oa = ro - a;
    float bb = dot(ba, ba), bd = dot(ba, rd), od = dot(oa, rd), ob = dot(oa, ba);
    float den = bb - bd * bd; float s = SAT((ob - od * bd) / max(den, 1e-6) );
    vec3 q = a + ba * s; float tq = dot(q - ro, rd); float dd = length(ro + rd * tq - q);
    float pxw = 2. * tan(uFov * .5) / uRes.y * tq;
    col += uBoneC * smoothstep(pxw * 1.2, 0., dd) * .6 * (1. - uCity) * uField * uFoot;
  }
  vec3 lo = (ro - uOrb.xyz) / uOrb.w;
  vec4 o = mindOrb(lo, rd, 2. * tan(uFov * .5) / uRes.y * length(uOrb.xyz - ro) / uOrb.w, uOrbLit, gAcc);
  col = col * (1. - o.a) + o.rgb;
  col += grain(gl_FragCoord.xy) * .012;
  fragColor = vec4(col, 1.);
}
`;
