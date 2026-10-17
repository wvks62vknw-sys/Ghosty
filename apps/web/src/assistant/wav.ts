/**
 * WAV for the ears. The phone records whatever its browser offers (AAC in MP4 on iPhones,
 * Opus in WebM elsewhere), which not every speech recogniser reads; the decoded samples as
 * 16 kHz mono 16-bit PCM in a WAV container are read by every Whisper. Pure functions, so
 * they are tested in Node (apps/edge/test/speech.test.mjs).
 */
export const WAV_RATE = 16_000;

/**
 * Channels mixed down to one and resampled to `rate`. Going down, each output sample is the
 * mean of the input samples it covers (which also keeps aliasing down); going up (rare: an
 * 8 kHz source) samples are interpolated in a straight line.
 */
export function toMono16k(channels: Float32Array[], sampleRate: number, rate = WAV_RATE): Float32Array {
  const n = channels[0]?.length ?? 0;
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0) / channels.length;
  if (!n || sampleRate === rate) return mono;
  if (sampleRate < rate) {
    const out = new Float32Array(Math.round((n * rate) / sampleRate));
    for (let i = 0; i < out.length; i++) {
      const p = (i * sampleRate) / rate;
      const j = Math.floor(p);
      const t = p - j;
      out[i] = (mono[j] ?? 0) * (1 - t) + (mono[j + 1] ?? mono[j] ?? 0) * t;
    }
    return out;
  }
  const ratio = sampleRate / rate;
  const out = new Float32Array(Math.floor(n / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(n, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = from; j < to; j++) s += mono[j] ?? 0;
    out[i] = to > from ? s / (to - from) : 0;
  }
  return out;
}

/** 16-bit PCM mono WAV bytes: the 44-byte header, then the samples, little-endian. */
export function encodeWav(samples: Float32Array, rate = WAV_RATE): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true); // the fmt chunk's size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // channels
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // bytes a second
  v.setUint16(32, 2, true); // bytes a sample frame
  v.setUint16(34, 16, true); // bits a sample
  tag(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (const s of samples) {
    const c = Math.max(-1, Math.min(1, s));
    v.setInt16(o, c < 0 ? c * 0x8000 : c * 0x7fff, true);
    o += 2;
  }
  return buf;
}

/** The header of a WAV file, or null when the bytes are not one. */
export function readWavHeader(buf: ArrayBuffer): { channels: number; rate: number; bits: number; dataBytes: number } | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data') return null;
  return { channels: v.getUint16(22, true), rate: v.getUint32(24, true), bits: v.getUint16(34, true), dataBytes: v.getUint32(40, true) };
}
