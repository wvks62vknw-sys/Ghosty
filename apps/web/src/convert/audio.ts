/**
 * AUDIO (BRIEF-REST-E part 1): a recording as a WAV, a WAV read back, a stretch of it cut out, and MP3 made by LAME
 * compiled to JavaScript (vendor/lamejs, LGPL-3.0, 156 KB: under the brief's 300 KB). Decoding an M4A, an MP3 or an Ogg
 * is the phone's own decoder (convert/run.ts), so what reads depends on the phone, and is said. Pure.
 */

export interface Sound {
  rate: number;
  /** One array a channel, samples from -1 to 1. */
  channels: Float32Array[];
}

/** A WAV file (16-bit PCM, every channel kept). */
export function encodeWav(s: Sound): Uint8Array {
  const n = s.channels[0]?.length ?? 0;
  const ch = s.channels.length;
  const out = new Uint8Array(44 + n * ch * 2);
  const dv = new DataView(out.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, s.rate, true);
  dv.setUint32(28, s.rate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, s.channels[c]![i]!));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return out;
}

/** A WAV file's samples: 8, 16, 24 or 32-bit PCM, or 32-bit float. Null when it is not a WAV this can read. */
export function decodeWav(b: Uint8Array): Sound | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (b.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let p = 12;
  let fmt: { format: number; ch: number; rate: number; bits: number } | null = null;
  while (p + 8 <= b.length) {
    const id = tag(p);
    const len = dv.getUint32(p + 4, true);
    if (id === 'fmt ') {
      let format = dv.getUint16(p + 8, true);
      if (format === 0xfffe && len >= 26) format = dv.getUint16(p + 32, true); // WAVE_FORMAT_EXTENSIBLE: its sub-format
      fmt = { format, ch: dv.getUint16(p + 10, true), rate: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) };
    } else if (id === 'data' && fmt) {
      const bytes = Math.min(len, b.length - p - 8);
      const step = fmt.bits / 8;
      const n = Math.floor(bytes / (step * fmt.ch));
      const channels = Array.from({ length: fmt.ch }, () => new Float32Array(n));
      let o = p + 8;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < fmt.ch; c++) {
          let v = 0;
          if (fmt.format === 3 && fmt.bits === 32) v = dv.getFloat32(o, true);
          else if (fmt.bits === 8) v = (b[o]! - 128) / 128;
          else if (fmt.bits === 16) v = dv.getInt16(o, true) / 0x8000;
          else if (fmt.bits === 24) v = (((b[o + 2]! << 24) | (b[o + 1]! << 16) | (b[o]! << 8)) >> 8) / 0x800000;
          else if (fmt.bits === 32) v = dv.getInt32(o, true) / 0x80000000;
          else return null;
          channels[c]![i] = v;
          o += step;
        }
      return { rate: fmt.rate, channels };
    }
    p += 8 + len + (len & 1);
  }
  return null;
}

/** A stretch of a sound, from and to in seconds (clamped to its length). */
export function trimSound(s: Sound, from: number, to: number): Sound {
  const n = s.channels[0]?.length ?? 0;
  const a = Math.max(0, Math.min(n, Math.round(from * s.rate)));
  const z = Math.max(a, Math.min(n, Math.round(to * s.rate)));
  return { rate: s.rate, channels: s.channels.map((c) => c.slice(a, z)) };
}

/** How long a sound lasts, in words ("1 min 05 s", "12.3 s"). */
export function lengthWords(s: Sound): string {
  const t = (s.channels[0]?.length ?? 0) / s.rate;
  return t >= 60 ? `${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, '0')} s` : `${Math.round(t * 10) / 10} s`;
}

/** "0:12 to 1:05", "12-65", "from 5 s to 20 s": a range in seconds, or null. */
export function rangeOf(words: string): { from: number; to: number } | null {
  const secs = (w: string) => {
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?$/.exec(w.trim());
    return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : NaN;
  };
  const m = /^(?:from\s+)?(.+?)\s*(?:-|–|to)\s*(.+)$/i.exec(words.trim());
  if (!m) return null;
  const a = secs(m[1]!);
  const z = secs(m[2]!);
  return Number.isFinite(a) && Number.isFinite(z) && z > a ? { from: a, to: z } : null;
}

/** What the converter needs of lamejs (its global `lamejs`). */
export interface Lame {
  Mp3Encoder: new (channels: number, rate: number, kbps: number) => { encodeBuffer(l: Int16Array, r?: Int16Array): Int8Array | Uint8Array; flush(): Int8Array | Uint8Array };
}

/** The sound as an MP3 (mono or stereo, at this bit rate). LAME takes 32, 44.1 or 48 kHz best; others are said by it. */
export function encodeMp3(L: Lame, s: Sound, kbps = 128): Uint8Array {
  const ch = Math.min(2, s.channels.length);
  const enc = new L.Mp3Encoder(ch, s.rate, kbps);
  const pcm = s.channels.slice(0, ch).map((c) => {
    const o = new Int16Array(c.length);
    for (let i = 0; i < c.length; i++) {
      const v = Math.max(-1, Math.min(1, c[i]!));
      o[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return o;
  });
  const parts: Uint8Array[] = [];
  const keep = (x: Int8Array | Uint8Array) => x.length && parts.push(new Uint8Array(x.buffer, x.byteOffset, x.length).slice());
  const BLOCK = 1152;
  for (let i = 0; i < pcm[0]!.length; i += BLOCK) keep(ch === 2 ? enc.encodeBuffer(pcm[0]!.subarray(i, i + BLOCK), pcm[1]!.subarray(i, i + BLOCK)) : enc.encodeBuffer(pcm[0]!.subarray(i, i + BLOCK)));
  keep(enc.flush());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
