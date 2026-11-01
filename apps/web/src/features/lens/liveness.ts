/**
 * CHECK IT'S LIVE (BRIEF-REST-C part 1): before a face is SAVED — ENROL ME / RE-ENROL, or "this is Sam" — the phone makes
 * sure it is looking at a live face, not a photo held up to the camera. On the phone, from the Lens's live camera only,
 * with no model call and nothing sent anywhere: a few seconds of face points from MediaPipe's Face Landmarker
 * (public/vendor/facemesh, Apache-2.0, loaded only when a check runs), judged here by plain geometry.
 *
 *  1. A CHALLENGE, picked at random each time so a recording cannot know it: BLINK TWICE, or TURN LEFT THEN RIGHT (or
 *     right then left). Blinks: the eye aspect ratio (each eye's lid-to-lid over corner-to-corner, from six points round
 *     each eye) dipping to under 62% of its open value and back within 0.7 s, both eyes at once; corrected by the face's
 *     own height over its width, so a photo tipped forwards and back (which squashes the eyes and the face alike) is not
 *     a blink. Turning: the nose-to-cheek ratio (where the nose tip sits between the two cheeks by the ears, -1…1),
 *     past ±0.2 one way and then the other — a real head turned about 12°.
 *  2. A FLATNESS CHECK on the same points: a printed photo or a screen is flat, and every point of a flat thing moves
 *     together as one plane does (one homography, perspective included, maps the first look onto every later one). A real
 *     head is not flat: as it turns, the nose tip and the cheeks shift against the eyes (motion parallax). So the check
 *     fits that plane between the most frontal look and every other, and measures what the plane cannot explain
 *     (`parallax`, as a share of the face's width). Clear parallax → DEEP; a face that turned or tipped enough to tell
 *     and stayed flat → FLAT; too little movement to tell → UNSURE, and the check asks for a small turn to finish.
 *  Live = the challenge done AND deep. Anything else: "I can't be sure that's a live face", and no name is saved.
 *
 * WHAT IT CATCHES: a printed photo, held still, waved, tilted or bent a little; a phone or a screen showing a photo, or a
 * simple animation of one (blinking eyes on a still face), held still or moved — they cannot blink on cue, or they stay
 * flat when they "turn". WHAT IT CANNOT CATCH: a video of a real head (or a convincingly animated one) that happens to
 * blink or turn the right way at the right time (the random challenge makes a replay unlikely, not impossible); a 3-D
 * mask; a lookalike or a twin; someone who is really there. It is a quick check, not a bank's.
 *
 * WHEN IT RUNS (LIVE_USES): never for the harmless uses — the white ADMIN box, a name on a box, "It's you.", "who's
 * this?", "who am I?", the PERSON card a recognised face brings up: those only greet. Always, while the setting is on,
 * before anything saves, unlocks or acts: ENROL ME and RE-ENROL (his face becomes ADMIN), "this is Sam" (a person is
 * saved), and `confirmLive('unlock', …)` for anything later that unlocks or acts on a face. SETTINGS → PRIVACY → FACES →
 * CHECK IT'S LIVE turns it off (on by default).
 *
 * Its only input is the live camera (vision/faces.ts isLive, the same test as the face module), like everything of the
 * faces; the points live in memory for the seconds of the check and are dropped. The specs stand the model in through
 * window.__ghostyFaceEngine.points (honoured only under a test runner), as the face models are.
 */
import { createStore } from '../../core/store';
import { drawScaled } from '../../vision/camera';
import { isLive, type LiveCamera } from '../../vision/faces';
import { fetchModel, nextStamp, simdSupported, visionRuntime, type Progress } from '../../vision/models';

export type Pt = [number, number];

/** The face points the check reads, in frame pixels: six round each eye (outer corner, upper lid ×2, inner corner, lower lid ×2), and the rest. */
export interface FacePoints {
  eyeR: Pt[];
  eyeL: Pt[];
  nose: Pt;
  bridge: Pt;
  /** The cheeks by the ears: R is the person's right (on the left of the camera's own picture). */
  edgeR: Pt;
  edgeL: Pt;
  mouthR: Pt;
  mouthL: Pt;
  chin: Pt;
  brow: Pt;
}
export interface LiveSample {
  t: number;
  p: FacePoints;
}

/** The Face Landmarker's points for each (MediaPipe's 478-point face mesh). */
export const MESH = { eyeR: [33, 160, 158, 133, 153, 144], eyeL: [362, 385, 387, 263, 373, 380], nose: 1, bridge: 168, edgeR: 234, edgeL: 454, mouthR: 61, mouthL: 291, chin: 152, brow: 10 } as const;

/** One face of the mesh (0–1 coordinates) as FacePoints in pixels of a w × h frame; null when the mesh is short. */
export function fromMesh(lm: readonly { x: number; y: number }[], w: number, h: number): FacePoints | null {
  if (!lm || lm.length < 468) return null;
  const at = (i: number): Pt => [lm[i]!.x * w, lm[i]!.y * h];
  return {
    eyeR: MESH.eyeR.map(at),
    eyeL: MESH.eyeL.map(at),
    nose: at(MESH.nose),
    bridge: at(MESH.bridge),
    edgeR: at(MESH.edgeR),
    edgeL: at(MESH.edgeL),
    mouthR: at(MESH.mouthR),
    mouthL: at(MESH.mouthL),
    chin: at(MESH.chin),
    brow: at(MESH.brow),
  };
}

// ---------------------------------------------------------------- the judges (pure)

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]! : 0;
};

/** The eye aspect ratio: lid to lid (twice) over corner to corner — about 0.3 open, under 0.1 shut. */
export function ear(eye: Pt[]): number {
  const [p1, p2, p3, p4, p5, p6] = eye as [Pt, Pt, Pt, Pt, Pt, Pt];
  const w = dist(p1, p4);
  return w > 0 ? (dist(p2, p6) + dist(p3, p5)) / (2 * w) : 0;
}

/** The face's height over its width (brow to chin over cheek to cheek): a photo tipped back squashes this as much as its eyes. */
export const faceAspect = (p: FacePoints): number => dist(p.brow, p.chin) / Math.max(1e-6, dist(p.edgeR, p.edgeL));

/** How open the eyes are: both eyes' aspect ratio, corrected by the face's own squash against its usual (`aspect0`). */
export function openness(p: FacePoints, aspect0: number): number {
  return ((ear(p.eyeR) + ear(p.eyeL)) / 2) * (aspect0 / Math.max(1e-6, faceAspect(p)));
}

/** The nose-to-cheek ratio, -1…1: 0 facing the camera, above 0 turned to the person's own left, below 0 to their right. */
export function yaw(p: FacePoints): number {
  const ux = p.edgeL[0] - p.edgeR[0];
  const uy = p.edgeL[1] - p.edgeR[1];
  const n = Math.hypot(ux, uy) || 1;
  const sR = ((p.nose[0] - p.edgeR[0]) * ux + (p.nose[1] - p.edgeR[1]) * uy) / n;
  const sL = ((p.edgeL[0] - p.nose[0]) * ux + (p.edgeL[1] - p.nose[1]) * uy) / n;
  return sR + sL > 0 ? (sR - sL) / (sR + sL) : 0;
}

/** A blink: shut is under 62% of the open eye, open again over 85%, all within 0.7 s. */
export const BLINK = { shut: 0.62, open: 0.85, maxMs: 700 } as const;

/** The blinks in a run of samples (both eyes together), with when each closed. */
export function blinks(samples: LiveSample[]): { count: number; at: number[]; base: number } {
  if (samples.length < 4) return { count: 0, at: [], base: 0 };
  const a0 = median(samples.map((s) => faceAspect(s.p)));
  const o = samples.map((s) => openness(s.p, a0));
  // the open eye: most samples are open, so the upper part of the spread
  const base = quantile(o, 0.75);
  const at: number[] = [];
  let shutAt = -1;
  for (let i = 0; i < o.length; i++) {
    const t = samples[i]!.t;
    if (shutAt < 0) {
      if (o[i]! < BLINK.shut * base) shutAt = t;
    } else if (o[i]! > BLINK.open * base) {
      if (t - shutAt <= BLINK.maxMs) at.push(shutAt);
      shutAt = -1;
    }
  }
  return { count: at.length, at, base };
}

/** A turn: the nose-to-cheek ratio past this either way (a real head turned about 12°). */
export const TURN = 0.2;

/** The turns in order, each side once at a time: ['left', 'right'] for left then right (the person's own left). */
export function turns(samples: LiveSample[]): ('left' | 'right')[] {
  const out: ('left' | 'right')[] = [];
  for (const s of samples) {
    const r = yaw(s.p);
    const side = r > TURN ? 'left' : r < -TURN ? 'right' : null;
    if (side && out[out.length - 1] !== side) out.push(side);
  }
  return out;
}

/** The points of a face that move with the skull (no eyelids, no mouth or jaw): the ones a flat picture would keep in one plane. */
const rigid = (p: FacePoints): Pt[] => [p.eyeR[0]!, p.eyeR[3]!, p.eyeL[0]!, p.eyeL[3]!, p.nose, p.bridge, p.edgeR, p.edgeL, p.brow];

/** Points moved so their middle is 0, 0 and their mean distance from it √2 (Hartley's normalisation), and the move. */
function normalise(ps: Pt[]): { q: Pt[]; T: [number, number, number] } {
  const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
  const cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
  const md = ps.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / ps.length || 1;
  const k = Math.SQRT2 / md;
  return { q: ps.map(([x, y]) => [(x - cx) * k, (y - cy) * k] as Pt), T: [k, cx, cy] };
}

/** Solve A x = b (n × n, row-major) by elimination with pivoting; null when it is singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (Math.abs(M[piv]![c]!) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      if (f) for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((r, i) => r[n]! / r[i]!);
}

/**
 * The plane's map from one look to another: the homography (perspective included) that best carries `src` onto `dst`
 * (least squares over every point, h33 = 1, on normalised points), as a function from a point to a point; null if the
 * points cannot carry one (too few, or all in a line).
 */
export function homography(src: Pt[], dst: Pt[]): ((p: Pt) => Pt) | null {
  if (src.length < 5 || src.length !== dst.length) return null;
  const a = normalise(src);
  const b = normalise(dst);
  const AtA = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const Atb = new Array<number>(8).fill(0);
  const add = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      Atb[i]! += row[i]! * rhs;
      for (let j = 0; j < 8; j++) AtA[i]![j]! += row[i]! * row[j]!;
    }
  };
  for (let i = 0; i < a.q.length; i++) {
    const [x, y] = a.q[i]!;
    const [u, v] = b.q[i]!;
    add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = solve(AtA, Atb);
  if (!h) return null;
  const [ka, ax, ay] = a.T;
  const [kb, bx, by] = b.T;
  return ([x0, y0]) => {
    const x = (x0 - ax) * ka;
    const y = (y0 - ay) * ka;
    const w = h[6]! * x + h[7]! * y + 1;
    const u = (h[0]! * x + h[1]! * y + h[2]!) / w;
    const v = (h[3]! * x + h[4]! * y + h[5]!) / w;
    return [u / kb + bx, v / kb + by];
  };
}

/** Clear parallax: what one plane cannot explain, as a share of the face's width, above this is a real head. */
export const DEEP = 0.012;
/** Movement enough to tell a flat thing from a head: the nose-to-cheek ratio or the plane's own squash changed this much. */
export const MOVED = 0.08;

/**
 * The flatness check: per look, the homography from the most frontal look and what it leaves over (RMS of the rigid
 * points, over the face's width); `parallax` and `moved` are the means of each one's top fifth (a stray frame counts
 * for little). DEEP when parallax is clear; FLAT when it moved enough to tell and stayed a plane; else UNSURE.
 */
export function depth(samples: LiveSample[]): { verdict: 'deep' | 'flat' | 'unsure'; parallax: number; moved: number } {
  if (samples.length < 6) return { verdict: 'unsure', parallax: 0, moved: 0 };
  // each look's rigid points averaged with its two neighbours either side: the landmarker's jitter (frame to frame, at
  // random) shrinks by about half, the head's own movement (smooth over a tenth of a second) stays
  const raw = samples.map((s) => rigid(s.p));
  const pts = raw.map((_, i) => {
    const win = raw.slice(Math.max(0, i - 2), i + 3);
    return win[0]!.map((_, k) => [win.reduce((a, w) => a + w[k]![0], 0) / win.length, win.reduce((a, w) => a + w[k]![1], 0) / win.length] as Pt);
  });
  const yaws = samples.map((s) => yaw(s.p));
  const aspects = samples.map((s) => faceAspect(s.p));
  const r = yaws.reduce((b, y, i) => (Math.abs(y) < Math.abs(yaws[b]!) ? i : b), 0);
  const src = pts[r]!;
  const width = Math.max(1e-6, dist(samples[r]!.p.edgeR, samples[r]!.p.edgeL));
  const res: number[] = [];
  const mov: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (i === r) continue;
    const dst = pts[i]!;
    const H = homography(src, dst);
    if (!H) continue;
    const rms = Math.sqrt(src.reduce((acc, p, k) => {
      const q = H(p);
      return acc + (q[0] - dst[k]![0]) ** 2 + (q[1] - dst[k]![1]) ** 2;
    }, 0) / src.length);
    // how far it moved out of its own plane: its turn (the ratio), or its squash (a picture turned or tipped is narrower
    // or shorter for it: height over width changes; moving it nearer, further or round in its own plane does not)
    const squash = Math.abs(Math.log(Math.max(1e-6, aspects[i]!) / Math.max(1e-6, aspects[r]!)));
    res.push(rms / Math.max(width * 0.2, dist(samples[i]!.p.edgeR, samples[i]!.p.edgeL)));
    mov.push(Math.max(Math.abs(yaws[i]! - yaws[r]!), squash));
  }
  const top = (xs: number[]) => {
    const s = [...xs].sort((a, b) => b - a).slice(0, Math.max(3, Math.ceil(xs.length / 5)));
    return s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  };
  const parallax = top(res);
  const moved = top(mov);
  return { verdict: parallax >= DEEP ? 'deep' : moved >= MOVED ? 'flat' : 'unsure', parallax, moved };
}

export type Challenge = 'blink' | 'turn-lr' | 'turn-rl';
export interface LiveVerdict {
  live: boolean;
  /** What was asked, and whether it was done. */
  challenge: Challenge;
  done: boolean;
  blinks: number;
  turns: ('left' | 'right')[];
  depth: 'deep' | 'flat' | 'unsure';
  parallax: number;
  moved: number;
  /** Why not, in a word: 'face' (too few looks at a face), 'challenge' (not done), 'flat', 'unsure' (moved too little to tell). */
  why: '' | 'face' | 'challenge' | 'flat' | 'unsure';
}

/** The judge: the challenge done, and a real head (deep), from at least a second of looks at one face. */
export function judge(samples: LiveSample[], challenge: Challenge): LiveVerdict {
  const b = blinks(samples);
  const tr = turns(samples);
  const dp = depth(samples);
  const want = challenge === 'turn-lr' ? ['left', 'right'] : challenge === 'turn-rl' ? ['right', 'left'] : null;
  const done = want ? tr.some((s, i) => s === want[0] && tr.slice(i + 1).includes(want[1] as 'left' | 'right')) : b.count >= 2;
  const span = samples.length ? samples[samples.length - 1]!.t - samples[0]!.t : 0;
  const why = samples.length < 6 || span < 600 ? 'face' : !done ? 'challenge' : dp.verdict === 'flat' ? 'flat' : dp.verdict === 'unsure' ? 'unsure' : '';
  return { live: why === '', challenge, done, blinks: b.count, turns: tr, depth: dp.verdict, parallax: dp.parallax, moved: dp.moved, why };
}

// ---------------------------------------------------------------- the words

/** The line when it fails (the one the owner sees and hears): no name follows it. */
export const NOT_SURE = 'I can’t be sure that’s a live face';
export const ASK: Record<Challenge, { me: string; them: string }> = {
  blink: { me: 'Quick check that you’re really here: blink twice.', them: 'Quick check that they’re really here: ask them to blink twice.' },
  'turn-lr': { me: 'Quick check that you’re really here: turn your head to your left, then to your right.', them: 'Quick check that they’re really here: ask them to turn their head to their left, then their right.' },
  'turn-rl': { me: 'Quick check that you’re really here: turn your head to your right, then to your left.', them: 'Quick check that they’re really here: ask them to turn their head to their right, then their left.' },
};
export const ASK_TURN = { me: 'Now turn your head a little to one side.', them: 'Now ask them to turn their head a little to one side.' };

/** Which uses of a face need the check (true) and which only greet (false). */
export const LIVE_USES = { hello: false, label: false, who: false, whoami: false, card: false, enrol: true, introduce: true, unlock: true } as const;
export type LiveUse = keyof typeof LIVE_USES;

/** SETTINGS → PRIVACY → FACES → CHECK IT'S LIVE (on by default), kept on this phone. */
export const liveSetting = createStore({ on: true }, { persist: 'ghosty.livecheck' });
export const liveCheckOn = (): boolean => liveSetting.get().on !== false;
/** Does this use need the check now? */
export const needsLive = (use: LiveUse): boolean => LIVE_USES[use] && liveCheckOn();

/** A random challenge (the phone's own random numbers: a recording cannot know which). */
export function pickChallenge(rand: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32): Challenge {
  const r = rand();
  return r < 0.5 ? 'blink' : r < 0.75 ? 'turn-lr' : 'turn-rl';
}

// ---------------------------------------------------------------- the eye that follows the face (the live camera only)

const LIVE_FILE = '/vendor/facemesh/face_landmarker.task';
/** What the first check costs, in words. */
export const LIVE_SIZE = '3.8 MB';
const NOT_LIVE = 'I only look at faces through the live camera, never at a picture';

interface LandmarkerLike {
  detectForVideo(frame: HTMLCanvasElement, ts: number): { faceLandmarks?: { x: number; y: number }[][] };
  close(): void;
}
/** The specs' stand-in for the landmarker (only under a test runner): the frame's size in, this look's faces (and its time) out. */
interface PointsStandIn {
  points(frame: { w: number; h: number }): { t?: number; faces: FacePoints[] } | FacePoints[];
}
function standIn(): PointsStandIn | null {
  const w = window as unknown as { __ghostyFaceEngine?: Partial<PointsStandIn> };
  const s = w.__ghostyFaceEngine;
  return navigator.webdriver && s && typeof s.points === 'function' ? (s as PointsStandIn) : null;
}
/** A spec may say which challenge comes (its recording is of one), only under a test runner. */
function challengeStandIn(): Challenge | null {
  const c = (window as unknown as { __ghostyFaceEngine?: { challenge?: Challenge } }).__ghostyFaceEngine?.challenge;
  return navigator.webdriver && standIn() && c && c in ASK ? c : null;
}

class LiveEye {
  private task: LandmarkerLike | null = null;
  private loading: Promise<void> | null = null;

  load(progress: Progress = () => undefined): Promise<void> {
    if (standIn()) return Promise.resolve();
    this.loading ??= (async () => {
      if (!simdSupported()) throw new Error('This device cannot run the live-face check: it needs iOS 16.4 or newer (or a current Chrome or Firefox)');
      const { ns, files } = await visionRuntime(progress);
      const FL = (ns as { FaceLandmarker?: { createFromOptions(f: unknown, o: Record<string, unknown>): Promise<LandmarkerLike> } }).FaceLandmarker;
      if (!FL) throw new Error('The vision runtime has no face landmarker');
      const bytes = await fetchModel(LIVE_FILE, progress, `live-face check (${LIVE_SIZE}, once)`);
      const make = (delegate: 'GPU' | 'CPU') => FL.createFromOptions(files, { baseOptions: { modelAssetBuffer: bytes, delegate }, runningMode: 'VIDEO', numFaces: 3, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
      this.task = await make('GPU').catch(() => make('CPU'));
    })().catch((e: unknown) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  /** One look through the live camera: every face's points, in camera pixels. Refuses anything that is not the live camera. */
  async look(cam: LiveCamera): Promise<{ t: number; faces: FacePoints[] }> {
    if (!isLive(cam)) throw new Error(NOT_LIVE);
    const size = { w: cam.video.videoWidth, h: cam.video.videoHeight };
    const now = performance.now();
    const fake = standIn();
    if (fake) {
      const r = fake.points(size);
      return Array.isArray(r) ? { t: now, faces: r } : { t: r.t ?? now, faces: r.faces };
    }
    if (!this.task) await this.load();
    const frame = drawScaled(cam.video, size, 640);
    const res = this.task!.detectForVideo(frame, nextStamp(now));
    // the mesh's 0–1 coordinates straight onto the camera's own pixels
    const faces = (res.faceLandmarks ?? []).map((lm) => fromMesh(lm, size.w, size.h)).filter((p): p is FacePoints => !!p);
    return { t: now, faces };
  }

  release(): void {
    try {
      this.task?.close();
    } catch {
      /* already closed */
    }
    this.task = null;
    this.loading = null;
  }
}
/** The one live-face eye (let go with PEOPLE). */
export const liveEye = new LiveEye();

/** The middle of a face's points (to follow the same face from look to look). */
const middle = (p: FacePoints): Pt => [(p.edgeR[0] + p.edgeL[0] + p.brow[0] + p.chin[0]) / 4, (p.edgeR[1] + p.edgeL[1] + p.brow[1] + p.chin[1]) / 4];

export interface CheckOpts {
  /** 'me': he is checking himself (front camera); 'them': someone he is introducing. */
  who: 'me' | 'them';
  /** Where the face to check is, in camera pixels (the box PEOPLE follows); the nearest face to it is the one judged. */
  near?: () => { x: number; y: number } | null;
  /** Say a line (shown, and spoken as PEOPLE speaks). */
  say(text: string): void;
  /** Still wanted (PEOPLE still open, this same visit). */
  alive(): boolean;
  status?(text: string): void;
  challenge?: Challenge;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What the last check found (window.__ghosty.people.live, for the specs; numbers only, no face). */
export const liveState = { running: false, challenge: '' as '' | Challenge, verdict: null as LiveVerdict | null };

/**
 * One check, start to end: the challenge said, looks taken for up to 6 s (and up to 4 s more for a small turn when the
 * head moved too little to tell), the verdict. Points stay in this function and are gone when it returns.
 */
export async function runCheck(cam: LiveCamera, o: CheckOpts): Promise<LiveVerdict> {
  const challenge = o.challenge ?? challengeStandIn() ?? pickChallenge();
  liveState.running = true;
  liveState.challenge = challenge;
  liveState.verdict = null;
  try {
    await liveEye.load((t) => o.status?.(t));
    o.say(ASK[challenge][o.who]);
    const samples: LiveSample[] = [];
    let missing = 0;
    const take = async (ms: number, stop: () => boolean) => {
      const end = performance.now() + ms;
      while (performance.now() < end && o.alive()) {
        const look = await liveEye.look(cam);
        const at = o.near?.() ?? null;
        const face = at ? look.faces.reduce<FacePoints | null>((b, f) => (!b || dist(middle(f), [at.x, at.y]) < dist(middle(b), [at.x, at.y]) ? f : b), null) : look.faces.length === 1 ? look.faces[0]! : null;
        if (face) samples.push({ t: look.t, p: face });
        else if (++missing > 90) break;
        if (samples.length >= 12 && stop()) break;
        await pause(25);
      }
    };
    await take(6000, () => judge(samples, challenge).live);
    let v = judge(samples, challenge);
    if (!v.live && v.done && v.why === 'unsure' && o.alive()) {
      o.say(ASK_TURN[o.who]);
      await take(4000, () => judge(samples, challenge).depth !== 'unsure');
      v = judge(samples, challenge);
    }
    liveState.verdict = v;
    return v;
  } finally {
    liveState.running = false;
  }
}

/**
 * The gate for anything that unlocks or acts on a face (LIVE_USES): true when the check is off for this use, or a check
 * just passed. Says the not-sure line itself when it fails.
 */
export async function confirmLive(use: LiveUse, cam: LiveCamera, o: CheckOpts): Promise<boolean> {
  if (!needsLive(use)) return true;
  const v = await runCheck(cam, o);
  if (!v.live && o.alive()) o.say(`${NOT_SURE}.`);
  return v.live;
}
