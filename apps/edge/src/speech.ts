/**
 * Ghosty's ears and voice, with no key needed. Speech to text: Groq's Whisper when the owner
 * has a Groq key (fastest and most accurate), else Cloudflare Workers AI's Whisper (free, there
 * as soon as Ghosty runs on Cloudflare). Text to speech: Workers AI's MeloTTS, so Ghosty speaks
 * with its own voice instead of the phone's. The interface (POST /stt, POST /tts) and Telegram
 * voice notes both come through here. In tests and previews env.AI is undefined, so every path
 * says plainly what is missing instead of failing oddly.
 */
import { brainVoice, type BrainVoice } from '../../../packages/shared/src/voices';
import type { Env } from './env';
import type { Vault } from './kernel/vault';
import { cost, neurons, type NeuronLedger } from './neurons';

/** One line for the prompt (second person), for the integrator to place: Ghosty's ears and voice. */
export const SPEECH_ABOUT = 'you can hear (voice notes and the microphone are transcribed for you: Groq Whisper or Workers AI) and speak replies in your own voice (MeloTTS on Workers AI), so keep spoken answers short and plain.';

/** The longest recording a recogniser is given (bytes). */
export const MAX_AUDIO_BYTES = 8_000_000;
/** The longest sentence the voice reads at once; the phone splits replies into sentences. */
export const MAX_TTS_CHARS = 600;
/** Sentences spoken a day: Workers AI's free allowance also feeds the fallback brain, so the voice must not eat it. */
export const TTS_PER_DAY = 2000;
/** Recent sentences kept in memory, so a repeated line costs nothing. */
const TTS_CACHE = 60;
const WHISPER_TURBO = '@cf/openai/whisper-large-v3-turbo';
const WHISPER = '@cf/openai/whisper';
const MELO = '@cf/myshell-ai/melotts';

type Ai = Pick<Env, 'AI'>;
type Keys = Pick<Vault, 'get'>;

/** A refusal with the HTTP status the route answers with. */
export class SpeechError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const EXT: Record<string, string> = { wav: 'wav', 'x-wav': 'wav', wave: 'wav', 'vnd.wave': 'wav', webm: 'webm', mp4: 'mp4', 'x-m4a': 'm4a', m4a: 'm4a', aac: 'aac', ogg: 'ogg', oga: 'ogg', opus: 'ogg', mpeg: 'mp3', mp3: 'mp3', flac: 'flac' };

/** The file extension a recogniser expects for a recording's type (the type decides how it is read). */
export function audioExt(mime: string): string {
  const sub = (mime.split(';')[0] ?? '').trim().toLowerCase().replace(/^(audio|video)\//, '');
  return EXT[sub] ?? 'webm';
}

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): ArrayBuffer {
  const bin = atob(s.replace(/^data:[^,]*,/, '').replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function groqWhisper(key: string, bytes: ArrayBuffer, mime: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: mime }), `speech.${audioExt(mime)}`);
  fd.append('model', 'whisper-large-v3-turbo');
  fd.append('response_format', 'json');
  fd.append('temperature', '0');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
  if (!r.ok) throw new SpeechError(502, `whisper ${r.status}`);
  const j = (await r.json()) as { text?: string };
  return (j.text ?? '').trim();
}

/**
 * The words in a recording. Groq's Whisper with the owner's key; otherwise, or when Groq
 * fails, Workers AI: the turbo model takes the file as base64, and if it refuses (a type it
 * does not read, its allowance) the classic one takes the raw bytes. With neither a key nor
 * Workers AI there is no recogniser, and the error says so.
 */
export async function transcribe(env: Ai, vault: Keys, bytes: ArrayBuffer, mime: string, ledger: NeuronLedger = neurons()): Promise<string> {
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new SpeechError(413, 'recording too long');
  if (bytes.byteLength < 64) throw new SpeechError(400, 'empty recording');
  const key = await vault.get('groq').catch(() => null);
  const ai = env.AI;
  if (key) {
    try {
      return await groqWhisper(key, bytes, mime);
    } catch (e) {
      if (!ai) throw e instanceof SpeechError ? e : new SpeechError(502, `whisper: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
    }
  }
  if (!ai) throw new SpeechError(400, 'no speech recogniser: hearing needs Workers AI (there once Ghosty is on Cloudflare) or a Groq key');
  // Hearing comes first in the day's Workers AI allowance (neurons.ts): it is counted, never refused for the voices' sake.
  await ledger.charge('stt', cost.stt(bytes.byteLength, mime));
  try {
    const r = (await ai.run(WHISPER_TURBO, { audio: toBase64(bytes) })) as { text?: string } | null;
    return (r?.text ?? '').trim();
  } catch {
    /* the turbo model refused: the classic one reads the bytes themselves */
  }
  try {
    const r = (await ai.run(WHISPER, { audio: [...new Uint8Array(bytes)] })) as { text?: string } | null;
    return (r?.text ?? '').trim();
  } catch (e) {
    throw new SpeechError(502, `speech recognition failed: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
  }
}

/** POST /stt: the recording's bytes (audio/wav, webm, mp4 or ogg) → { text }. */
export async function sttRoute(env: Ai, vault: Keys, req: Request): Promise<Response> {
  const type = (req.headers.get('content-type') ?? 'audio/webm').split(';')[0]!.trim().toLowerCase() || 'audio/webm';
  if (!/^(audio|video)\//.test(type)) return json({ error: 'send the recording itself as audio/wav, audio/webm, audio/mp4 or audio/ogg' }, 415);
  if (Number(req.headers.get('content-length')) > MAX_AUDIO_BYTES) return json({ error: 'recording too long' }, 413);
  const audio = await req.arrayBuffer();
  try {
    return json({ text: await transcribe(env, vault, audio, type) });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, e instanceof SpeechError ? e.status : 502);
  }
}

/** Plain words for the voice: no code, links, markdown or symbols (the phone cleans the same way). */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[*_#`>~|]+/g, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Spoken sentences: the cache (memory) saves repeats; what they cost is counted in the day's
// Workers AI ledger (neurons.ts, kept in storage), which every use of Workers AI shares.
const cache = new Map<string, ArrayBuffer>();
let day = '';
let spoken = 0;
/** Tests only: a fresh day and an empty cache. */
export const _testing = {
  reset(): void {
    cache.clear();
    day = '';
    spoken = 0;
  },
  spokenToday: (): number => spoken,
};

const newDay = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    spoken = 0;
  }
};

/**
 * Why the natural voice did not speak, for the phone (`x-voice-reason`): 'share' — its share of
 * today's free allowance is used up (back at midnight UTC); 'error' / 'empty' — it failed just
 * now (worth trying again soon).
 */
export type VoiceReason = 'share' | 'error' | 'empty';

/** Bytes from whatever an Aura call hands back: a stream (the binding's usual answer), a Response, raw bytes or base64. */
async function audioBytes(r: unknown): Promise<ArrayBuffer | null> {
  if (!r) return null;
  if (r instanceof ArrayBuffer) return r;
  if (r instanceof Uint8Array) return r.slice().buffer;
  if (r instanceof Response) return r.ok ? r.arrayBuffer() : null;
  if (r instanceof ReadableStream) return new Response(r).arrayBuffer();
  const audio = (r as { audio?: unknown }).audio;
  return typeof audio === 'string' && audio ? fromBase64(audio) : null;
}

async function hash(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toBase64(d);
}

/** A sentence in Ghosty's own voice: MP3 bytes from MeloTTS (Workers AI). Telegram's voice notes use this. */
export async function synthesize(env: Ai, text: string): Promise<ArrayBuffer> {
  return (await synthesizeAs(env, text, 'melo')).audio;
}

/**
 * A sentence in the voice asked for (packages/shared/src/voices.ts: 'auto' is the most natural).
 * A natural (Aura) voice speaks while the day's share lasts and when it answers; otherwise the
 * plain voice (MeloTTS) says it, and `voice` and `note` say so. Repeats come from the cache.
 */
export async function synthesizeAs(env: Ai, text: string, want: unknown, ledger: NeuronLedger = neurons()): Promise<{ audio: ArrayBuffer; voice: BrainVoice['id']; note?: string; reason?: VoiceReason }> {
  const ai = env.AI;
  if (!ai) throw new SpeechError(404, "no voice: Ghosty's own voice needs Workers AI (there once Ghosty is on Cloudflare)");
  newDay();
  const asked = brainVoice(want);
  const melo = brainVoice('melo');
  const cached = async (v: BrainVoice) => {
    const key = await hash(`${v.id}|${text}`);
    const hit = cache.get(key);
    if (hit) {
      // Most recently used last, so the oldest is the one dropped.
      cache.delete(key);
      cache.set(key, hit);
    }
    return { key, hit };
  };
  const keep = (key: string, bytes: ArrayBuffer) => {
    cache.set(key, bytes);
    while (cache.size > TTS_CACHE) cache.delete(cache.keys().next().value!);
  };
  let note: string | undefined;
  let reason: VoiceReason | undefined;
  if (asked.cost) {
    const { key, hit } = await cached(asked);
    if (hit) return { audio: hit, voice: asked.id };
    const n = cost.aura(text.length, asked.cost);
    // The natural voice only within its share, and only while hearing, the fallback brain and the rest keep their room.
    if (!(await ledger.room('voice', n))) {
      reason = 'share';
      note = "today's share for the natural voice is used up: the plain voice speaks until midnight UTC";
    } else if (spoken < TTS_PER_DAY) {
      spoken++;
      await ledger.charge('voice', n);
      try {
        const bytes = await audioBytes(await ai.run(asked.model, { text, speaker: asked.speaker, encoding: 'mp3' }));
        if (bytes && bytes.byteLength > 0) {
          keep(key, bytes);
          return { audio: bytes, voice: asked.id };
        }
        reason = 'empty';
        note = 'the natural voice returned no audio: the plain voice spoke instead';
      } catch (e) {
        reason = 'error';
        note = `the natural voice did not answer (${String((e as Error)?.message ?? e).slice(0, 80)}): the plain voice spoke instead`;
      }
    }
  }
  const extra = { ...(note ? { note } : {}), ...(reason ? { reason } : {}) };
  const { key, hit } = await cached(melo);
  if (hit) return { audio: hit, voice: 'melo', ...extra };
  if (spoken >= TTS_PER_DAY) throw new SpeechError(429, 'voice allowance used up for today');
  const mn = cost.melo(text.length);
  if (!(await ledger.room('plain-voice', mn))) throw new SpeechError(429, "voice allowance used up for today: the rest of today's free Workers AI is kept for hearing you and for answering");
  await ledger.charge('plain-voice', mn);
  spoken++;
  let r: { audio?: string } | null;
  try {
    r = (await ai.run(MELO, { prompt: text, lang: 'en' })) as { audio?: string } | null;
  } catch (e) {
    throw new SpeechError(502, `the voice did not answer: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
  }
  if (!r?.audio || typeof r.audio !== 'string') throw new SpeechError(502, 'the voice returned no audio');
  const bytes = fromBase64(r.audio);
  keep(key, bytes);
  return { audio: bytes, voice: 'melo', ...extra };
}

/**
 * POST /tts { text, voice? } → audio/mpeg bytes (a day's cache on the phone; 404 with no Workers
 * AI, 429 past the day's allowance). `voice`: one of voices.ts, or 'auto' for the most natural;
 * left out, the plain voice (what older copies of the app expect). `x-voice` says which voice
 * spoke, `x-voice-note` why it was not the one asked for, `x-voice-reason` the same for the phone
 * (VoiceReason: only 'share' means "not again today").
 */
export async function ttsRoute(env: Ai, req: Request, ledger: NeuronLedger = neurons()): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { text?: unknown; voice?: unknown };
  const text = speakable(typeof b.text === 'string' ? b.text : '').slice(0, MAX_TTS_CHARS);
  if (!text) return json({ error: 'nothing to say' }, 400);
  try {
    const { audio, voice, note, reason } = await synthesizeAs(env, text, b.voice ?? 'melo', ledger);
    const headers: Record<string, string> = { 'content-type': 'audio/mpeg', 'content-length': String(audio.byteLength), 'cache-control': 'private, max-age=86400', 'x-voice': voice };
    if (note) headers['x-voice-note'] = note;
    if (reason) headers['x-voice-reason'] = reason;
    return new Response(audio, { headers });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, e instanceof SpeechError ? e.status : 502);
  }
}

/** The day's Workers AI ledger (neurons.ts), exported here for the tests. */
export { FREE_NEURONS, NeuronLedger, VOICE_SHARE, _resetNeurons } from './neurons';
