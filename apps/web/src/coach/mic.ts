/**
 * THE PHONE'S MICROPHONE FOR THE COACH (BRIEF-REST-B part 2): a stream with none of the phone's own processing (echo
 * cancelling and noise suppression flatten the sound of a string), read block by block for the tuner, and recorded while a
 * lesson runs. A METRONOME built on the audio clock (clicks scheduled ahead, so they never drift), with a visual beat as well.
 * Nothing is sent anywhere or kept: a recording lives in memory until the lesson is scored.
 */

export interface Mic {
  sampleRate: number;
  ctx: AudioContext;
  /** Called with each block (about 4,096 samples) as it arrives. Returns the way to stop. */
  onBlock(fn: (block: Float32Array) => void): () => void;
  startRecording(): void;
  /** The samples since startRecording, joined. */
  stopRecording(): Float32Array;
  close(): void;
}

type AudioCtor = typeof AudioContext;
export const audioContext = (): AudioContext => {
  const C = (window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }).AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!C) throw new Error('this browser has no audio');
  return new C();
};

/** What to tell him when the microphone does not open (plain words, never an error code). */
export function micMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked. On iPhone: Settings, Safari, Microphone, Allow (or the aA button, Website Settings); then tap START again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'This phone has no microphone I can reach.';
  return `The microphone did not open (${(e as Error)?.message ?? 'unknown'}).`;
}

export async function openMic(): Promise<Mic> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('this browser cannot reach the microphone');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = audioContext();
  await ctx.resume().catch(() => undefined);
  const src = ctx.createMediaStreamSource(stream);
  // a script processor: deprecated, but it is what every iPhone still runs, and it needs no extra file under the app's policy
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const listeners = new Set<(b: Float32Array) => void>();
  let chunks: Float32Array[] | null = null;
  proc.onaudioprocess = (e) => {
    const block = new Float32Array(e.inputBuffer.getChannelData(0));
    for (const f of listeners) f(block);
    chunks?.push(block);
  };
  src.connect(proc);
  proc.connect(ctx.destination); // it writes silence: nothing is played back
  return {
    sampleRate: ctx.sampleRate,
    ctx,
    onBlock(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    startRecording() {
      chunks = [];
    },
    stopRecording() {
      const parts = chunks ?? [];
      chunks = null;
      const out = new Float32Array(parts.reduce((t, p) => t + p.length, 0));
      let at = 0;
      for (const p of parts) (out.set(p, at), (at += p.length));
      return out;
    },
    close() {
      listeners.clear();
      try {
        proc.disconnect();
        src.disconnect();
      } catch {
        /* already apart */
      }
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
    },
  };
}

export interface Metronome {
  /** Start: returns the audio-clock time of the first beat. */
  start(): number;
  stop(): void;
}

/** A metronome: a short click on each beat (the first of every four higher), `onBeat(n)` called as each is heard. */
export function metronome(ctx: AudioContext, bpm: number, onBeat: (n: number) => void, sound = true): Metronome {
  const beat = 60 / bpm;
  let n = 0;
  let next = 0;
  let timer = 0;
  const click = (at: number, accent: boolean) => {
    if (!sound) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1800 : 1300;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.35, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.06);
  };
  const tick = () => {
    while (next < ctx.currentTime + 0.12) {
      click(next, n % 4 === 0);
      const k = n;
      window.setTimeout(() => onBeat(k), Math.max(0, (next - ctx.currentTime) * 1000));
      next += beat;
      n++;
    }
  };
  return {
    start() {
      next = ctx.currentTime + 0.08;
      const first = next;
      timer = window.setInterval(tick, 25);
      tick();
      return first;
    },
    stop() {
      window.clearInterval(timer);
    },
  };
}

/** Play a list of notes (Hz; 0 is a rest), one per beat, as soft tones: "HEAR IT". Returns the way to stop. */
export function playNotes(ctx: AudioContext, hz: number[], bpm: number): () => void {
  const beat = 60 / bpm;
  const t0 = ctx.currentTime + 0.1;
  const nodes: OscillatorNode[] = [];
  hz.forEach((f, i) => {
    if (!f) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const a = t0 + i * beat;
    g.gain.setValueAtTime(0.0001, a);
    g.gain.exponentialRampToValueAtTime(0.25, a + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, a + beat * 0.9);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(a);
    o.stop(a + beat);
    nodes.push(o);
  });
  return () => nodes.forEach((o) => { try { o.stop(); } catch { /* done */ } });
}
