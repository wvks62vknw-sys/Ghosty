/**
 * The engines' sound output: one WebAudio context a game, made in the tap that started it (a phone lets a page make
 * sound only from a tap) and kept for the whole game, so SOUND can go off and on again later; going off is a gain of 0.
 */

export interface EngineAudio {
  ctx: AudioContext;
  /** Everything the game plays goes here. */
  out: GainNode;
  setOn(on: boolean): void;
  suspend(): void;
  resume(): void;
  close(): void;
}

/** Make the game's sound output (null where the browser has no WebAudio: the game plays silent). */
export function openAudio(on: boolean): EngineAudio | null {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctx) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  const out = ctx.createGain();
  out.gain.value = on ? 1 : 0;
  out.connect(ctx.destination);
  void ctx.resume().catch(() => undefined);
  let closed = false;
  return {
    ctx,
    out,
    setOn(v) {
      out.gain.value = v ? 1 : 0;
    },
    suspend() {
      if (!closed) void ctx.suspend().catch(() => undefined);
    },
    resume() {
      if (!closed) void ctx.resume().catch(() => undefined);
    },
    close() {
      if (closed) return;
      closed = true;
      void ctx.close().catch(() => undefined);
    },
  };
}

/** 8-bit unsigned samples at `rate` → floats at `outRate` (linear), the way both engines' sounds reach WebAudio. */
export function pcm8(u8: Uint8Array, rate: number, outRate: number): Float32Array {
  if (!(rate > 0) || !(outRate > 0) || u8.length === 0) return new Float32Array(0);
  const n = Math.max(1, Math.round((u8.length * outRate) / rate));
  const out = new Float32Array(n);
  const step = rate / outRate;
  const last = u8.length - 1;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const j = Math.min(last, Math.floor(x));
    const f = x - j;
    const a = u8[j]!;
    const b = u8[Math.min(last, j + 1)]!;
    out[i] = (a + (b - a) * f - 128) / 128;
  }
  return out;
}

/** 16-bit signed little-endian samples (one channel) → floats at `outRate`. */
export function pcm16(bytes: Uint8Array, rate: number, outRate: number): Float32Array {
  const count = bytes.length >> 1;
  if (!(rate > 0) || !(outRate > 0) || count === 0) return new Float32Array(0);
  const v = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  const n = Math.max(1, Math.round((count * outRate) / rate));
  const out = new Float32Array(n);
  const step = rate / outRate;
  const last = count - 1;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const j = Math.min(last, Math.floor(x));
    const f = x - j;
    const a = v.getInt16(j * 2, true);
    const b = v.getInt16(Math.min(last, j + 1) * 2, true);
    out[i] = (a + (b - a) * f) / 32768;
  }
  return out;
}

/** Floats → an AudioBuffer of the context's own rate (one channel). */
export function monoBuffer(ctx: BaseAudioContext, samples: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, samples.length), ctx.sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
}
