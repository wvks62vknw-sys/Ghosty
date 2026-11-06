/* W3 · THE EYE — the scene. The Material, as the Machine's attention: one fragment shader takes the picture of what is there
   (the wall of feeds he has, the city, the camera, a page: an SVG drawn by build.py) and shows it the way an eye that is
   paying attention would: where it is looking, the picture itself, sharp; at the edge of its attention, finer grain; everywhere
   else an ordered dither, dim — present, legible as a shape, not yet looked at. The orb is the eye, and its line of sight to
   what it is looking at is drawn. Positions are fractions of the screen, so 390 and 440 frame the same. */
window.EYE_FRAG = `
uniform sampler2D uImg;
uniform vec4 uAtt[8];       // where it is looking: x0 y0 x1 y1 as fractions of the screen
uniform float uAttK[8];     // how much: 1 the thing itself, .5 the edge of attention
uniform vec4 uOrbP;         // the eye: x, y (fractions), radius (CSS px), how awake
uniform vec4 uSight;        // its line of sight: from x y to x y (fractions); none if x1 < 0
uniform float uDim;         // how dim the unattended grain is
uniform vec3 uBoneC;
uniform vec4 uTrail[3];     // the storyboard's search: where the reticle has just been (x0 y0 x1 y1), fading

float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + .5) / 16.;
}
float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
float inRect(vec2 f, vec4 r, float soft) {
  vec2 c = (r.xy + r.zw) * .5, h = (r.zw - r.xy) * .5;
  float d = sdBox2(f - c, h);
  return smoothstep(soft, 0., d);
}
void main() {
  vec2 cp = cssPx(gl_FragCoord.xy);
  vec2 S = uRes / uDpr;                       // the screen in CSS px
  vec2 f = cp / S;                            // fraction of the screen, top-left origin
  // how much attention falls here: the strongest rect that covers it
  float att = 0.;
  for (int i = 0; i < 8; i++) { if (uAttK[i] <= 0.) continue; att = max(att, uAttK[i] * inRect(f, uAtt[i], .0015)); }
  // the picture, sampled at this pixel (attended) and at the grain's cell (not)
  vec2 uv = gl_FragCoord.xy / uRes;
  float cell = 3.;                            // the grain: one cell is 3 CSS px
  vec2 cc = (floor(cp / cell) + .5) * cell;
  vec2 uvc = vec2(cc.x / S.x, 1. - cc.y / S.y);
  float lc = lum(texture(uImg, uvc).rgb);
  float grainOn = step(bayer4(floor(cp / cell)), pow(lc, .9) * 1.15);
  vec3 col = uBoneC * grainOn * uDim;
  // the edge of attention: a finer grain
  float cell2 = 1.5; vec2 cc2 = (floor(cp / cell2) + .5) * cell2;
  float lc2 = lum(texture(uImg, vec2(cc2.x / S.x, 1. - cc2.y / S.y)).rgb);
  float fine = step(bayer4(floor(cp / cell2)), lc2 * 1.1);
  vec3 half_ = uBoneC * fine * .72;
  // the thing itself: the picture, in bone, at full resolution
  vec3 im = texture(uImg, uv).rgb;
  vec3 crisp = uBoneC * pow(lum(im), .92) * 1.05;
  col = mix(col, half_, SAT(att * 2.) * step(att, .75));
  col = mix(col, crisp, smoothstep(.75, 1., att));
  // the search, in the storyboard: the reticle's last places, fading
  for (int i = 0; i < 3; i++) {
    vec4 r = uTrail[i]; if (r.z <= r.x) continue;
    vec2 c = (r.xy + r.zw) * .5, h = (r.zw - r.xy) * .5;
    float d = abs(sdBox2(f - c, h)) * S.x;
    col += uAccent * smoothstep(1.2, 0., d) * (.25 + .2 * float(i));
  }
  // the line of sight: from the eye to what it is looking at, one hairline in the accent, dotted where it crosses grain
  if (uSight.z >= 0.) {
    vec2 a = uSight.xy * S, b = uSight.zw * S;
    float d = sdSeg2(cp, a, b);
    float along = dot(cp - a, normalize(b - a));
    float dash = step(.35, fract(along / 6.));
    col = mix(col, uAccent * 1.1, smoothstep(1.1, 0., d) * mix(dash, 1., step(.75, att)));
  }
  // the eye
  if (uOrbP.z > 0.) {
    vec2 oc = uOrbP.xy * S; float r = uOrbP.z;
    vec3 lo = vec3((cp - oc) / r * vec2(1., -1.), -3.);
    vec4 o = mindOrb(lo, vec3(0., 0., 1.), 1. / (r * uDpr) * 1.4, uOrbP.w, uAccent);
    col = col * (1. - o.a) + o.rgb;
  }
  col += grain(gl_FragCoord.xy) * .01;
  fragColor = vec4(col, 1.);
}
`;
