/**
 * VIDEO 2's heavy arithmetic, off the main thread (video/steady.ts, best.ts, beat.ts): the motion between neighbouring grey frames
 * by block matching, a frame's sharpness and light, and a sound's beat. The frames arrive as grey bytes (transferred, not copied);
 * the worker holds only the last one. Nothing is downloaded and nothing leaves the phone.
 */
import { motionBetween, type Motion } from '../video/steadymath';
import { sayError } from '../ui/hisWords';
import { lightOf, sharpness, type Light } from '../video/bestmath';
import { beatGrid, findTempo, onsetEnvelope, type Tempo } from '../video/beatmath';

export type CrunchAsk =
  | { id: number; op: 'frame'; grey: Uint8Array; w: number; h: number; reset?: boolean; stats?: boolean }
  | { id: number; op: 'beat'; mono: Float32Array; rate: number };
export type CrunchReply = {
  id: number;
  ms: number;
  motion?: Motion;
  sharp?: number;
  light?: Light;
  tempo?: Tempo | null;
  beats?: number[];
  error?: string;
};

let prev: Uint8Array | null = null;
let pw = 0;
let ph = 0;

self.onmessage = (ev: MessageEvent<CrunchAsk>) => {
  const a = ev.data;
  const t0 = performance.now();
  try {
    if (a.op === 'frame') {
      const out: CrunchReply = { id: a.id, ms: 0 };
      if (prev && !a.reset && pw === a.w && ph === a.h) out.motion = motionBetween(prev, a.grey, a.w, a.h);
      if (a.stats) {
        out.sharp = sharpness(a.grey, a.w, a.h);
        out.light = lightOf(a.grey);
      }
      prev = a.grey;
      pw = a.w;
      ph = a.h;
      out.ms = performance.now() - t0;
      (self as unknown as Worker).postMessage(out);
    } else {
      const env = onsetEnvelope(a.mono, a.rate);
      const tempo = findTempo(env);
      const beats = tempo ? beatGrid(env, tempo, (a.mono.length / a.rate) * 1000) : [];
      (self as unknown as Worker).postMessage({ id: a.id, ms: performance.now() - t0, tempo, beats } satisfies CrunchReply);
    }
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: a.id, ms: 0, error: sayError(e, 'run that') } satisfies CrunchReply);
  }
};
