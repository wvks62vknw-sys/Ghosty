/**
 * REPS BY CAMERA (BRIEF-PACKS-1 item 2): MediaPipe's pose model (vendored: /vendor/pose, run by the Lens's own runtime in
 * /vendor/mediapipe) finds his joints in each frame on the phone; packages/shared/src/body.ts counts the squats, push-ups
 * or star jumps from their angles; each one is said aloud, and DONE puts the count in the chat as a card and keeps it in my
 * brain as a workout (a number, never a picture). Nothing from the camera leaves the phone.
 * The specs stand the model in (window.__ghostyPoseEngine, honoured only under a test runner), as the face specs do.
 */
import { EXERCISES, repsCard, repStart, repStep, type Exercise, type Mark, type RepState } from '../../../../../packages/shared/src/body';
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { Camera, cameraMessage } from '../../vision/camera';
import { fetchModel, visionRuntime } from '../../vision/models';
import { speakIn } from '../../assistant/voice';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './sheet';
import { sayError } from '../../ui/hisWords';
import { phrases, stateIn, waitFor } from '../lifeui';

export const POSE_MODEL = '/vendor/pose/pose_landmarker_lite.task';

/** What finds his joints in a video frame: the pose model, or the specs' stand-in. */
export interface PoseEngine {
  detect(video: HTMLVideoElement, t: number): Mark[] | null;
  close(): void;
}
interface PoseLandmarkerLike {
  detectForVideo(v: HTMLVideoElement, t: number): { landmarks?: Mark[][] };
  close(): void;
}

let engine: Promise<PoseEngine> | null = null;
function poseEngine(progress: (s: string) => void): Promise<PoseEngine> {
  const w = window as unknown as { __ghostyPoseEngine?: PoseEngine };
  if (navigator.webdriver && w.__ghostyPoseEngine) {
    bodyState.engine = 'stand-in';
    return Promise.resolve(w.__ghostyPoseEngine);
  }
  engine ??= (async () => {
    const { ns, files } = await visionRuntime(progress);
    const PL = (ns as { PoseLandmarker?: { createFromOptions(f: unknown, o: Record<string, unknown>): Promise<PoseLandmarkerLike> } }).PoseLandmarker;
    if (!PL) throw new Error('The vision runtime has no pose model');
    const bytes = await fetchModel(POSE_MODEL, progress, 'the pose model (5.8 MB, once)');
    const make = (delegate: 'GPU' | 'CPU') => PL.createFromOptions(files, { baseOptions: { modelAssetBuffer: bytes, delegate }, runningMode: 'VIDEO', numPoses: 1 });
    const lm = await make('GPU').catch(() => make('CPU'));
    bodyState.engine = 'pose';
    return { detect: (v: HTMLVideoElement, t: number) => lm.detectForVideo(v, t).landmarks?.[0] ?? null, close: () => lm.close() };
  })().catch((e: unknown) => {
    engine = null;
    throw e;
  });
  return engine;
}

/** The camera's refusal or absence, once, in his words, with how to allow it. */
function cameraWords(e: unknown): string {
  const n = String((e as { name?: unknown })?.name ?? '');
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') return 'The phone would not give me the camera. Settings, Ghosty, Camera, then press Start.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'This phone has no camera I can use here.';
  if (n === 'NotReadableError' || n === 'TrackStartError') return 'Another app has the camera. Close it, then press Start.';
  return sayError(e, 'open the camera');
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export function repsScreen(first: string): Screen {
  let ex: Exercise = EXERCISES.some((e) => e.id === first) ? (first as Exercise) : 'squats';
  let state: RepState = repStart(ex);
  let started = 0;
  let raf = 0;
  let live = false;
  const video = h('video.pkvideo', { 'aria-label': 'Your camera, on this phone only', muted: true, playsInline: true });
  const cam = new Camera(video as HTMLVideoElement);
  const dots = h('canvas.pkdots', { 'aria-hidden': 'true' });
  const count = h('b.pkbig', { 'aria-live': 'polite', 'aria-label': 'Count' }, '0');
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Prop the phone up so it sees all of you, then press Start.');
  // the stage before the camera is on: said, never a black block
  /* state: body.reps empty */
  const off = h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', { dataset: { label: 'The camera is off' } }, 'The camera is off'), h('span', { dataset: { label: 'Press Start and I count.' } }, 'Press Start and I count.'));
  const chips = h('div.pkrow', { role: 'group', 'aria-label': 'Which exercise' });
  const paintChips = () => {
    chips.replaceChildren(
      ...EXERCISES.map((e) => {
        const b = button(e.label, () => {
          ex = e.id;
          state = repStart(ex);
          bodyState.exercise = ex;
          bodyState.reps = 0;
          count.textContent = '0';
          paintChips();
        }, e.id === ex ? 'on' : '');
        b.setAttribute('aria-pressed', String(e.id === ex));
        return b;
      }),
    );
  };
  paintChips();
  bodyState.exercise = ex;
  bodyState.reps = 0;
  bodyState.hint = '';

  const draw = (p: Mark[] | null) => {
    const c = dots as HTMLCanvasElement;
    const r = video.getBoundingClientRect();
    if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)) Object.assign(c, { width: Math.round(r.width), height: Math.round(r.height) });
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (!p) return;
    g.fillStyle = '#52f2b5';
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const m = p[i];
      if (m && (m.visibility ?? 1) > 0.5) g.fillRect(m.x * c.width - 4, m.y * c.height - 4, 8, 8);
    }
  };

  const loop = (eng: PoseEngine) => {
    const tick = () => {
      if (!live) return;
      const t = performance.now();
      let p: Mark[] | null = null;
      try {
        p = video.readyState >= 2 || bodyState.engine === 'stand-in' ? eng.detect(video as HTMLVideoElement, t) : null;
      } catch {
        p = null;
      }
      const aspect = (video as HTMLVideoElement).videoWidth && (video as HTMLVideoElement).videoHeight ? (video as HTMLVideoElement).videoWidth / (video as HTMLVideoElement).videoHeight : 0.75;
      const r = repStep(state, p, t, aspect);
      state = r.s;
      draw(p);
      if (r.rep) {
        bodyState.reps = state.n;
        count.textContent = String(state.n);
        speakIn(WORDS[state.n] ?? String(state.n), 'en');
        navigator.vibrate?.(30);
      }
      if (r.hint) {
        bodyState.hint = r.hint;
        status.textContent = r.hint;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const stopCam = () => {
    live = false;
    cancelAnimationFrame(raf);
    cam.stop();
    bodyState.camera = 'off';
    off.hidden = false;
    stop.hidden = true;
  };
  const start = button('Start', async () => {
    if (live) return;
    delete status.dataset.state;
    status.textContent = '';
    /* state: body.reps loading */
    const done = waitFor(el, 'Opening the camera…');
    try {
      await cam.start('user');
      bodyState.camera = 'on';
    } catch (e) {
      done();
      bodyState.camera = 'refused';
      /* state: body.reps error */
      stateIn(status, 'error', cameraWords(e));
      return;
    }
    done();
    status.textContent = 'Waking the pose model…';
    let eng: PoseEngine;
    try {
      eng = await poseEngine((s) => (status.textContent = s));
    } catch (e) {
      bodyState.engine = 'none';
      bodyState.error = sayError(e, 'read that');
      stateIn(status, 'error', sayError(e, 'open that'));
      stopCam();
      return;
    }
    stateIn(status, '', `Counting ${EXERCISES.find((x) => x.id === ex)!.say}: I say each one.`);
    off.hidden = true;
    stop.hidden = false;
    started = Date.now();
    live = true;
    loop(eng);
  }, 'on');
  start.setAttribute('aria-label', 'Start counting');
  const stop = button('Stop', () => {
    if (!live) return;
    stopCam();
    stateIn(status, '', state.n ? `Stopped at ${state.n}. Press Done to keep it, or Start to go on.` : 'Stopped. Nothing counted yet.');
  });
  stop.setAttribute('aria-label', 'Stop counting');
  stop.hidden = true;
  const done = button('Done', async () => {
    stopCam();
    const n = state.n;
    if (!n) {
      status.textContent = 'Nothing counted yet.';
      return;
    }
    const secs = started ? (Date.now() - started) / 1000 : 0;
    const c = repsCard(ex, n, secs);
    void import('../core/cards').then((m) => m.postCard(c)).catch(() => undefined);
    try {
      await brain.packDo('body', 'log', { exercise: ex, n });
    } catch {
      toast('Counted, but my brain didn’t answer: it isn’t kept there this time.', 'warn');
    }
    status.textContent = `${n} ${EXERCISES.find((x) => x.id === ex)!.label.toLowerCase()}: in the chat as a card.`;
  });
  done.setAttribute('aria-label', 'Done: put the count in the chat');
  // START and STOP right under the exercise chips, where the thumb is; the picture of the camera below them
  const el = h('div.pkcol', chips, h('div.pkhero', count, h('span.pklab', 'counted on this phone')), h('div.pkrow', start, stop, done), h('div.pkstage', video, dots, off), status, phrases(['count my squats', 'start a run', 'breathe']));
  return { el, stop: stopCam };
}
