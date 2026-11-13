/**
 * THE MIX (BRIEF-EDITOR-VIDEO): the project's sound as WebAudio, built from math.ts's `mixPlan` for the screen's player (a live
 * context, from the playhead) and for the export (an OfflineAudioContext, from zero). Gains, fades, the crossfade's ramps and the
 * music's ducking are the plan's lines laid on each strand's gain node, so what the screen plays is what the file holds.
 */
import { mixPlan, pieceLength, type Strand } from './math';
import type { Project } from './model';

export type Buffers = Map<string, AudioBuffer>;

export interface Built {
  nodes: { strand: Strand; gain: GainNode; source: AudioBufferSourceNode }[];
  stop(): void;
}

/**
 * Lay the plan on `ctx`: each strand from timeline time `from` (ms) onwards, starting at `at` seconds of the context's clock.
 * `out` is where the sound goes (the speakers, or the offline destination).
 */
export function buildMix(ctx: BaseAudioContext, p: Project, buffers: Buffers, from: number, at: number, out: AudioNode): Built {
  const nodes: Built['nodes'] = [];
  const end = pieceLength(p);
  for (const s of mixPlan(p)) {
    const raw = buffers.get(s.src);
    if (!raw) continue;
    const buf = s.rev ? reversed(ctx, raw) : raw;
    const sEnd = Math.min(s.start + s.len, end);
    if (sEnd <= from) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = s.rate ? rateAt(s.rate, Math.max(from, s.start)) : s.speed;
    if (s.rate) for (const [t, r] of s.rate) if (t > Math.max(from, s.start)) src.playbackRate.linearRampToValueAtTime(r, Math.max(0, at + (t - from) / 1000));
    const gain = ctx.createGain();
    src.connect(gain).connect(out);
    const startMs = Math.max(s.start, from);
    // (a reversed clip reads its reversed copy: the picture's out point is where the copy starts, and a ramp's rate is automated above)
    const done = s.rate ? playedAt(s, startMs) : (startMs - s.start) * s.speed;
    const offset = ((s.rev ? buf.duration * 1000 - (s.in + s.span) : s.in) + done) / 1000;
    const when = at + (startMs - from) / 1000;
    // the plan's lines on the gain node, in the context's own time
    const rel = (t: number) => at + (Math.max(t, from) - from) / 1000;
    const pts = s.gain.filter(([t]) => t <= sEnd);
    const first = pts.find(([t]) => t >= from) ?? pts[pts.length - 1]!;
    // the value at `from` (inside a fade or a duck): start there
    const v0 = valueAt(s, Math.max(from, s.start));
    gain.gain.setValueAtTime(v0, Math.max(0, rel(Math.max(from, s.start))));
    for (const [t, v] of pts) if (t > Math.max(from, s.start)) gain.gain.linearRampToValueAtTime(v, Math.max(0, rel(t)));
    void first;
    gain.gain.setValueAtTime(0, Math.max(0, rel(sEnd)));
    const dur = Math.max(0, (sEnd - startMs) / 1000);
    // a ramp plays for the timeline length at a changing rate: the node is stopped there instead of cut by a duration
    if (s.rate) src.start(Math.max(0, when), Math.max(0, offset));
    else src.start(Math.max(0, when), Math.max(0, offset), dur * s.speed);
    if (s.rate) src.stop(Math.max(0, when) + dur);
    nodes.push({ strand: s, gain, source: src });
  }
  return {
    nodes,
    stop() {
      for (const n of nodes) {
        try {
          n.source.stop();
        } catch {
          /* it had not started or had ended */
        }
        n.source.disconnect();
        n.gain.disconnect();
      }
    },
  };
}
const valueAt = (s: Strand, t: number): number => {
  const g = s.gain;
  if (t <= g[0]![0]) return g[0]![1];
  for (let i = 0; i < g.length - 1; i++) {
    const [t0, v0] = g[i]!;
    const [t1, v1] = g[i + 1]!;
    if (t >= t0 && t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return g[g.length - 1]![1];
};

/** The sound of the whole piece, rendered offline at 48 kHz stereo (for the export, and for QUIET to listen to). */
export async function renderMix(p: Project, buffers: Buffers, rate = 48_000): Promise<AudioBuffer> {
  const secs = Math.max(0.1, pieceLength(p) / 1000);
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  buildMix(ctx, p, buffers, 0, 0, ctx.destination);
  return ctx.startRendering();
}

/** A file's sound decoded by the phone (null when the phone cannot read it, or there is none). */
export async function decodeAudio(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer | null> {
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

const revCache = new WeakMap<AudioBuffer, AudioBuffer>();
/** The sound read backwards (a copy, kept for the buffer). */
function reversed(ctx: BaseAudioContext, b: AudioBuffer): AudioBuffer {
  const got = revCache.get(b);
  if (got) return got;
  const o = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) o.copyToChannel(Float32Array.from(b.getChannelData(c)).reverse(), c);
  revCache.set(b, o);
  return o;
}
const rateAt = (rate: [number, number][], t: number): number => {
  if (t <= rate[0]![0]) return rate[0]![1];
  for (let i = 0; i < rate.length - 1; i++) {
    const [t0, v0] = rate[i]!;
    const [t1, v1] = rate[i + 1]!;
    if (t >= t0 && t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return rate[rate.length - 1]![1];
};
/** Source ms advanced from the strand's start to timeline time t at its ramp's rates (the area under the rate's line). */
function playedAt(s: Strand, t: number): number {
  const r = s.rate!;
  let acc = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [t0, v0] = r[i]!;
    const [t1, v1] = r[i + 1]!;
    if (t <= t0) break;
    const e = Math.min(t, t1);
    const ve = v0 + ((v1 - v0) * (e - t0)) / Math.max(1, t1 - t0);
    acc += ((v0 + ve) / 2) * (e - t0);
  }
  return acc;
}
