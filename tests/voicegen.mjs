// Synthetic voices for the voiceprint's checks (apps/edge/test/voiceknown.test.mjs, tests/voice.spec.mjs): a pulse train at a
// moving pitch through three formant resonators and a spectral tilt, with a breath of noise. A voice is a pitch, a throat
// length (the formants' scale), a tilt and a breathiness; a sentence is a vowel order and a pitch line. Seeded, so every run
// of a check hears the same voices. No recording of anyone is in the repo.
export const RATE = 16_000;

/** The three voices: A and B are the two people; C is the one nobody introduced (nearest the others a stranger plausibly is). */
export const VOICES = {
  A: { f0: 112, throat: 1.0, tilt: 0.955, breath: 0.015 },
  B: { f0: 205, throat: 1.19, tilt: 0.9, breath: 0.03 },
  C: { f0: 152, throat: 1.08, tilt: 0.935, breath: 0.02 },
};
const FORMANTS = { a: [730, 1090, 2440], i: [270, 2290, 3010], u: [300, 870, 2240], e: [530, 1840, 2480], o: [570, 840, 2410], ae: [660, 1720, 2410] };
/** Three vowel orders: the three sentences read at enrolment; others for what is said afterwards. */
export const SENTENCES = [
  ['a', 'i', 'u', 'e', 'o', 'a', 'e', 'i', 'o', 'u', 'a'],
  ['o', 'e', 'a', 'u', 'i', 'o', 'ae', 'a', 'i', 'e', 'u'],
  ['u', 'a', 'i', 'o', 'e', 'ae', 'u', 'i', 'a', 'o', 'e'],
  ['i', 'o', 'a', 'e', 'u', 'a', 'ae', 'o', 'i', 'u', 'e'],
  ['e', 'u', 'o', 'i', 'a', 'u', 'e', 'ae', 'a', 'o', 'i'],
];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One sentence in one voice, `lead` seconds of room before it and `tail` after: a Float32Array at 16 kHz. */
export function say(voice, sentence = 0, { seed = 1, secs = 0.2, lead = 0, tail = 0, level = 0.5, noise = 0.0015 } = {}) {
  const v = typeof voice === 'string' ? VOICES[voice] : voice;
  const vowels = SENTENCES[sentence % SENTENCES.length];
  const rand = rng(seed * 7919 + sentence * 104729 + Math.round(v.f0));
  const n = Math.round(vowels.length * secs * RATE);
  const out = new Float32Array(Math.round((lead + tail) * RATE) + n);
  const pad = Math.round(lead * RATE);
  const filt = [0, 0, 0].map(() => [0, 0]);
  let tiltY = 0;
  let phase = 0;
  const wander = rand() * 6;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const k = Math.min(vowels.length - 1, Math.floor(t / secs));
    const next = Math.min(vowels.length - 1, k + 1);
    const m = Math.min(1, Math.max(0, (t / secs - k - 0.6) / 0.4)); // glide in the last 40% of a vowel
    const f0 = v.f0 * (1.1 - 0.25 * (t / (n / RATE))) * (1 + 0.06 * Math.sin(2 * Math.PI * (0.9 * t + wander)) + 0.03 * Math.sin(2 * Math.PI * 3.1 * t));
    phase += f0 / RATE;
    let src = 0;
    if (phase >= 1) {
      phase -= 1;
      src = 1;
    }
    src = src * 1.0 + (rand() - 0.5) * v.breath * 2;
    // an amplitude that rises and falls with each vowel, so there are quiet frames between syllables
    const env = 0.35 + 0.65 * Math.sin((Math.PI * ((t / secs) % 1)) ** 1);
    let y = src;
    for (let f = 0; f < 3; f++) {
      const hz = (FORMANTS[vowels[k]][f] * (1 - m) + FORMANTS[vowels[next]][f] * m) * v.throat;
      const bw = 60 + 40 * f;
      const r = Math.exp((-Math.PI * bw) / RATE);
      const a1 = 2 * r * Math.cos((2 * Math.PI * hz) / RATE);
      const a2 = -r * r;
      const o = (1 - a1 - a2) * y + a1 * filt[f][0] + a2 * filt[f][1];
      filt[f][1] = filt[f][0];
      filt[f][0] = o;
      y = o;
    }
    tiltY = y + v.tilt * tiltY;
    out[pad + i] = tiltY * env;
  }
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  const g = level / (peak || 1);
  const roomRand = rng(seed + 99);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * g + (roomRand() - 0.5) * 2 * noise;
  return out;
}

/** The room alone, or noise as loud as a voice: `secs` of it. */
export function noise(secs = 2, level = 0.2, seed = 5) {
  const r = rng(seed);
  const out = new Float32Array(Math.round(secs * RATE));
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    lp = 0.6 * lp + (r() - 0.5) * 2;
    out[i] = lp * level;
  }
  return out;
}

/** 16-bit mono WAV bytes. */
export function wav(samples, rate = RATE) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}
