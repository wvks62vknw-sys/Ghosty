// Recorded face-point sequences for the live-face check (BRIEF-REST-C part 1), made the way a phone's camera would see
// them: a modelled head (real proportions, in millimetres, the face mesh's own points) or a flat picture of it, moved as a
// hand and a neck move it, seen through a phone camera (640 × 480, 620 px focal length, about 42 cm away), with the face
// landmarker's own jitter (0.7 px, seeded). Shared by the unit test (apps/edge/test/restc.test.mjs) and the spec
// (tests/restc.spec.mjs, which plays them to the Lens through the face engine's stand-in, one look at a time).
//   blink         a live face, held as a hand holds a phone (a few degrees of drift), blinking twice
//   still-blink   a live face held unnaturally still, blinking twice (too little movement to tell its depth)
//   turn-lr       a live face turning to its left, then its right (about 22° each way)
//   turn-rl       the same, right first
//   photo         a printed photo of the same face, held up and waved a little: no blink, flat
//   photo-turned  the photo turned left and right by hand, about 45° each way: flat, whatever the ratio does
//   screen-blink  a phone screen playing a still with blinking eyes, held and tipped by hand: blinks, but flat
//   screen-turn   that screen turned left and right as if it were a head: flat

// The head: x towards the camera's right (the person's left), y down, z towards the camera; 0, 0, 0 between the eyes.
const HEAD = {
  eyeR: [[-45, 0, -2], [-37, -5, 4], [-27, -5, 5], [-18, 0, 3], [-27, 3, 4], [-37, 3, 3]],
  eyeL: [[18, 0, 3], [27, -5, 5], [37, -5, 4], [45, 0, -2], [37, 3, 3], [27, 3, 4]],
  nose: [0, 35, 30],
  bridge: [0, 0, 12],
  edgeR: [-72, 22, -48],
  edgeL: [72, 22, -48],
  mouthR: [-25, 62, 10],
  mouthL: [25, 62, 10],
  chin: [0, 98, 0],
  brow: [0, -42, 8],
};
/** The neck's turning point, behind the face. */
const PIVOT = [0, 30, -95];
const CAM = { f: 620, cx: 320, cy: 240, d: 420 };

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (d) => (d * Math.PI) / 180;
/** Turn a point about `c`: yaw about the vertical (positive: the face turns to its own left), then pitch, then roll. */
function turn([x, y, z], c, yawD, pitchD, rollD) {
  let px = x - c[0], py = y - c[1], pz = z - c[2];
  const [a, b, g] = [rad(yawD), rad(pitchD), rad(rollD)];
  // yaw: the nose (z > 0) goes towards +x for a positive yaw
  [px, pz] = [px * Math.cos(a) + pz * Math.sin(a), -px * Math.sin(a) + pz * Math.cos(a)];
  [py, pz] = [py * Math.cos(b) - pz * Math.sin(b), py * Math.sin(b) + pz * Math.cos(b)];
  [px, py] = [px * Math.cos(g) - py * Math.sin(g), px * Math.sin(g) + py * Math.cos(g)];
  return [px + c[0], py + c[1], pz + c[2]];
}
const project = ([x, y, z], noise, n) => {
  const depth = CAM.d - z;
  return [CAM.cx + (CAM.f * x) / depth + n() * noise, CAM.cy + (CAM.f * y) / depth + n() * noise];
};

/** Eyelids closed by `c` (0 open … 1 shut): the upper lid comes down, the lower lid up a little. */
function lids(eye, c) {
  return eye.map(([x, y, z], i) => (i === 1 || i === 2 ? [x, y + 7.2 * c, z] : i === 4 || i === 5 ? [x, y - 0.8 * c, z] : [x, y, z]));
}
/** How shut the eyes are at time t for blinks starting at `at` (s): 70 ms closing, 60 ms shut, 110 ms opening. */
function shut(t, at) {
  for (const b of at) {
    const u = t - b;
    if (u < 0 || u > 0.24) continue;
    return u < 0.07 ? u / 0.07 : u < 0.13 ? 1 : 1 - (u - 0.13) / 0.11;
  }
  return 0;
}

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** A head turn: frontal, to `first` (±deg), through the middle to the other side, back to the middle. */
function turnPath(t, first) {
  if (t < 0.5) return 0;
  if (t < 1.1) return first * smooth((t - 0.5) / 0.6);
  if (t < 2.2) return first - 2 * first * smooth((t - 1.1) / 1.1);
  return -first + first * smooth((t - 2.2) / 0.6);
}

/**
 * One sequence: [{ t (ms), p: FacePoints }] at `fps`. `kind` is one of the eight above; `seed` changes the jitter and the
 * drift; `noise` is the landmark jitter in pixels.
 */
export function faceSequence(kind, { seed = 7, fps = 30, seconds = 3, noise = 0.7 } = {}) {
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  const flat = /^(photo|screen)/.test(kind);
  const still = kind === 'still-blink';
  // a hand's drift (and a neck's): slow, a few degrees and millimetres; a picture held up drifts a little more
  const amp = still ? 0.12 : flat ? 1.4 : 1;
  const blinkAt = /blink$/.test(kind) ? [0.9, 2.0] : [];
  const out = [];
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    const t = i / fps;
    const sway = {
      yaw: amp * 5.5 * Math.sin(2 * Math.PI * 0.45 * t + ph[0]),
      pitch: amp * 3 * Math.sin(2 * Math.PI * 0.33 * t + ph[1]),
      roll: amp * 2 * Math.sin(2 * Math.PI * 0.27 * t + ph[2]),
      dx: amp * 4 * Math.sin(2 * Math.PI * 0.6 * t + ph[3]),
      dy: amp * 3 * Math.sin(2 * Math.PI * 0.5 * t + ph[0]),
    };
    let yawD = sway.yaw;
    if (kind === 'turn-lr') yawD += turnPath(t, 22);
    if (kind === 'turn-rl') yawD += turnPath(t, -22);
    if (kind === 'photo-turned') yawD += turnPath(t, 45);
    if (kind === 'screen-turn') yawD += turnPath(t, 40);
    const c = shut(t, blinkAt);
    const p = {};
    for (const [k, v] of Object.entries(HEAD)) {
      const pts = k === 'eyeR' || k === 'eyeL' ? lids(v, c) : [v];
      const moved = pts.map((pt) => {
        // a picture of the face: every point on one plane (the picture), and the picture is what turns, about its middle
        const q = flat ? turn([pt[0], pt[1], 0], [0, 30, 0], yawD, sway.pitch, sway.roll) : turn(pt, PIVOT, yawD, sway.pitch, sway.roll);
        return project([q[0] + sway.dx, q[1] + sway.dy, q[2]], noise, gauss);
      });
      p[k] = k === 'eyeR' || k === 'eyeL' ? moved : moved[0];
    }
    out.push({ t: Math.round((t * 1000) * 10) / 10, p });
  }
  return out;
}

export const KINDS = ['blink', 'still-blink', 'turn-lr', 'turn-rl', 'photo', 'photo-turned', 'screen-blink', 'screen-turn'];
