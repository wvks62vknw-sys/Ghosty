/**
 * Voice: speaking and listening.
 * Speaking: Ghosty's own voice from the brain (MeloTTS through Workers AI, POST /api/tts) when
 * the owner chose it in SETTINGS and the brain can speak — sentence by sentence through one
 * audio element the first tap unlocked — otherwise, and whenever that fails, the phone's own
 * speech synthesis. Listening: the recording goes to the brain as WAV (Groq's Whisper with a
 * key, else Workers AI's Whisper) when the brain can hear, otherwise the browser's own
 * speech recognition.
 */
import { brain, speechCaps } from '../api/brain';
import { settings, ui } from '../state/app';
import { encodeWav, toMono16k } from './wav';

let voices: SpeechSynthesisVoice[] = [];
const loadVoices = () => {
  try {
    voices = speechSynthesis.getVoices() ?? [];
  } catch {
    voices = [];
  }
};
try {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
} catch {
  /* no speech synthesis */
}

export const listVoices = () => voices.filter((v) => /^en/i.test(v.lang));

/**
 * The one audio element Ghosty's own voice plays through. Started once from a tap, iPhones let
 * it play every later clip on its own; it sits in the page (hidden) so a test can watch it.
 */
let player: HTMLAudioElement | null = null;
function audioEl(): HTMLAudioElement {
  if (!player) {
    player = document.createElement('audio');
    player.id = 'gvoice';
    player.preload = 'auto';
    player.hidden = true;
    document.body.append(player);
  }
  return player;
}

/**
 * iPhones and iPads only let a page make sound once it has been started from a tap. The first
 * touch on the page plays a moment of silence through the audio element and speaks a silent
 * utterance, so Ghosty's replies (which arrive later, not from a tap) are heard either way.
 * Also wakes a synthesiser that iOS has paused.
 */
let unlocked = false;
export function unlockSpeech(): void {
  if (unlocked) return;
  unlocked = true;
  try {
    // A blob address, not a data one: the page's security policy allows blob: media only.
    const el = audioEl();
    const url = URL.createObjectURL(new Blob([encodeWav(new Float32Array(800))], { type: 'audio/wav' }));
    el.src = url;
    void el.play().catch(() => undefined).finally(() => setTimeout(() => URL.revokeObjectURL(url), 3000));
  } catch {
    /* no audio */
  }
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    speechSynthesis.resume();
  } catch {
    /* ignore */
  }
}
for (const ev of ['touchend', 'pointerup', 'keydown'] as const) addEventListener(ev, () => unlockSpeech(), { passive: true, once: true });

function bestVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices();
  const want = settings.get().voice;
  if (want !== 'auto') {
    const v = voices.find((x) => x.name === want);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    if (!/^en/i.test(v.lang)) return -1;
    let s = 20;
    if (/GB|en-gb/i.test(v.lang) || /UK|British/i.test(v.name)) s += 18;
    if (/Natural|Neural|Online/i.test(v.name)) s += 40;
    if (/Premium|Enhanced|Siri/i.test(v.name)) s += 34;
    if (/Google UK English Male/i.test(v.name)) s += 30;
    if (/Daniel|Arthur|Oliver|George|Ryan|Thomas/i.test(v.name)) s += 22;
    if (/compact/i.test(v.name)) s -= 15;
    if (/Fred|Albert|Bad News|Bells|Boing|Cellos|Jester|Organ|Trinoids|Whisper|Zarvox|Bubbles|Junior|Ralph/i.test(v.name)) s -= 60;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

const clean = (t: string) =>
  t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[*_#`>~|]+/g, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\bkm\b/g, 'kilometres')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** The sentences of a reply, none longer than `max` characters (a long one is cut at a comma, else a space). */
export function sentences(t: string, max = 300): string[] {
  const out: string[] = [];
  for (const raw of t.match(/[^.!?]+[.!?]*\s*/g) ?? [t]) {
    let s = raw.trim();
    while (s.length > max) {
      const slice = s.slice(0, max);
      let cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '), slice.lastIndexOf(': ')) + 1;
      if (cut < max / 3) cut = slice.lastIndexOf(' ');
      if (cut < max / 3) cut = max;
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

let speakToken = 0;
/** After Ghosty's voice failed (no sound, a refusal), the phone's voice speaks until this time. */
let phoneUntil = 0;

const ghostyVoice = (): boolean => settings.get().voiceEngine !== 'phone' && ui.get().connected === true && speechCaps.get().tts && Date.now() >= phoneUntil;

export function speak(text: string): Promise<void> {
  const t = clean(text);
  if (!t) return Promise.resolve();
  const token = ++speakToken;
  const parts = sentences(t);
  // A clip still playing from the last reply stops now, so its handlers never touch the next clip.
  stopClip?.();
  // Ghosty's own voice first; whatever it could not say, the phone says. The reactor shows "speaking" at
  // once: the first clip takes a moment to arrive, and a hands-free turn must not reopen the mic meanwhile.
  if (ghostyVoice()) {
    ui.set({ voice: 'speaking' });
    return speakGhosty(parts, token).then((from) => (from < parts.length ? speakPhone(parts.slice(from), token) : undefined));
  }
  return speakPhone(parts, token);
}

// Choosing a voice again in SETTINGS ends any wait on the phone's voice.
settings.subscribe((s, prev) => {
  if (s.voiceEngine !== prev.voiceEngine) phoneUntil = 0;
});

function speakPhone(parts: string[], token: number): Promise<void> {
  if (!('speechSynthesis' in window)) {
    if (token === speakToken) ui.set({ voice: 'idle' });
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const next = (i: number) => {
      if (token !== speakToken || i >= parts.length) {
        if (token === speakToken) ui.set({ voice: 'idle' });
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i]!.trim());
      const v = bestVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = 1;
      u.pitch = 0.92;
      u.onend = u.onerror = () => next(i + 1);
      ui.set({ voice: 'speaking' });
      try {
        speechSynthesis.resume(); // iOS sometimes leaves the synthesiser paused
      } catch {
        /* ignore */
      }
      speechSynthesis.speak(u);
    };
    next(0);
  });
}

/**
 * The sentences in Ghosty's own voice, in order: the first two are fetched together, the next
 * one while one plays. Resolves with how many were spoken — fewer than all means a clip failed
 * (no sound within 4 s, a refusal, the day's allowance) and the phone says the rest, and the
 * phone's voice is used for the next ten minutes.
 */
async function speakGhosty(parts: string[], token: number): Promise<number> {
  const el = audioEl();
  const clips: Promise<Blob | null>[] = [];
  // The brain saying no (no Workers AI, the day's allowance) is what sends the next ten minutes to the
  // phone's voice; a lost request, or a clip refused before the first tap unlocked the element, is not.
  let refused = false;
  const fetchClip = (i: number) => {
    if (i < parts.length && !clips[i]) {
      clips[i] = brain.tts(parts[i]!).catch((e: { status?: number }) => {
        if (e?.status === 404 || e?.status === 429) refused = true;
        return null;
      });
    }
  };
  fetchClip(0);
  fetchClip(1);
  const giveUp = (i: number) => {
    if (refused && unlocked) phoneUntil = Date.now() + 10 * 60_000;
    return i;
  };
  for (let i = 0; i < parts.length; i++) {
    fetchClip(i + 1);
    const blob = await clips[i]!;
    if (token !== speakToken) return parts.length;
    if (!blob) return giveUp(i);
    ui.set({ voice: 'speaking' });
    const ok = await playClip(el, blob);
    if (token !== speakToken) return parts.length;
    if (!ok) return giveUp(i);
  }
  ui.set({ voice: 'idle' });
  return parts.length;
}

let stopClip: (() => void) | null = null;
/** One clip through the shared element. True once it played to the end; false when it never made a sound, broke, or was stopped. */
function playClip(el: HTMLAudioElement, blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    let timer = 0;
    let done = false;
    const onEnded = () => finish(true);
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // Only this clip's own handlers and stop hook come off: a later clip may already own the element.
      if (el.onended === onEnded) el.onplaying = el.onended = el.onerror = null;
      if (stopClip === stop) stopClip = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    const stop = () => {
      if (el.onended === onEnded) el.pause();
      finish(false);
    };
    stopClip = stop;
    // Silence for 4 s means the clip was refused (autoplay, a broken file): the phone's voice takes over.
    timer = window.setTimeout(() => finish(false), 4000);
    el.onplaying = () => {
      clearTimeout(timer);
      // An end that never comes (a stalled clip) must not leave the reactor "speaking" for good.
      timer = window.setTimeout(() => finish(true), ((Number.isFinite(el.duration) ? el.duration : 30) + 2) * 1000);
    };
    el.onended = onEnded;
    el.onerror = () => finish(false);
    el.src = url;
    el.play().catch(() => finish(false));
  });
}

export function stopSpeaking(): void {
  speakToken++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  stopClip?.();
  if (ui.get().voice === 'speaking') ui.set({ voice: 'idle' });
}

// ---------- listening ----------
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const SRClass = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;

export const voiceSupport = {
  browserStt: !!SRClass,
  mic: !!navigator.mediaDevices?.getUserMedia,
};

/** Live mic level and spectrum for the reactor while listening. */
export const micLevel = { level: 0, spectrum: null as Uint8Array | null };

let abortListen: (() => void) | null = null;

function listenBrowser(onInterim: (t: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SRClass) {
      reject(new Error('This browser has no speech recognition. Add a Groq key in System to use Whisper.'));
      return;
    }
    const rc = new SRClass();
    rc.lang = navigator.language || 'en-GB';
    rc.interimResults = true;
    rc.continuous = false;
    let fin = '';
    rc.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) fin += r[0]!.transcript;
        else interim += r[0]!.transcript;
      }
      onInterim((fin + interim).trim());
    };
    rc.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') reject(new Error('Microphone blocked. Allow it in the browser address bar.'));
    };
    rc.onend = () => resolve(fin.trim());
    abortListen = () => rc.abort();
    rc.start();
  });
}

/** The recording as 16 kHz mono WAV, which every recogniser reads (iPhones record AAC, which not all of them do). */
async function toWav(ctx: AudioContext, blob: Blob): Promise<Blob> {
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
  return new Blob([encodeWav(toMono16k(channels, decoded.sampleRate))], { type: 'audio/wav' });
}

async function listenWhisper(): Promise<string> {
  // Made in the tap itself, before the microphone prompt: Safari starts a context made after that wait suspended,
  // so the level meter would read silence and never hear the end of what was said.
  const ctx = new AudioContext();
  void ctx.resume().catch(() => undefined);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch (e) {
    void ctx.close();
    throw e;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined); // (never awaited: Safari holds it until a tap)
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(an);
  const time = new Float32Array(an.fftSize);
  const freq = new Uint8Array(an.frequencyBinCount);
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(100);
  const done = new Promise<void>((resolve) => {
    let floor = 0.008;
    let speech = false;
    let speechAt = 0;
    let lastLoud = 0;
    let calib = 0;
    const t0 = performance.now();
    let stopped = false;
    abortListen = () => {
      stopped = true;
    };
    const tick = () => {
      const now = performance.now();
      an.getFloatTimeDomainData(time);
      an.getByteFrequencyData(freq);
      let s = 0;
      for (let i = 0; i < time.length; i++) s += time[i]! * time[i]!;
      const rms = Math.sqrt(s / time.length);
      micLevel.level = Math.min(1, rms * 9);
      micLevel.spectrum = freq;
      if (!speech) floor = ++calib < 20 ? Math.max(floor * 0.9 + rms * 0.1, 0.003) : floor * 0.995 + Math.min(rms, floor * 1.5) * 0.005;
      const thr = Math.max(0.018, floor * 3.2);
      if (rms > thr) {
        lastLoud = now;
        if (!speech) {
          if (!speechAt) speechAt = now;
          if (now - speechAt > 110) speech = true;
        }
      } else if (!speech) speechAt = 0;
      const silence = speech && now - lastLoud > 1000;
      const tooLong = now - t0 > (speech ? 30000 : 12000);
      if (stopped || silence || tooLong) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await done;
  await new Promise<void>((r) => {
    rec.onstop = () => r();
    rec.stop();
  });
  stream.getTracks().forEach((t) => t.stop());
  micLevel.level = 0;
  micLevel.spectrum = null;
  const blob = new Blob(chunks, { type: rec.mimeType || mime }); // iPhones record audio/mp4, others webm
  // Sent as WAV when the recording decodes; as recorded otherwise (a Groq key reads most formats).
  const wav = blob.size >= 4000 ? await toWav(ctx, blob).catch(() => null) : null;
  void ctx.close();
  if (blob.size < 4000) return '';
  const text = (await brain.stt(wav ?? blob)).trim();
  return /^(thank you|thanks for watching|you|bye)\.?$/i.test(text) ? '' : text;
}

/** Listen for one utterance. */
export async function listen(useWhisper: boolean, onInterim: (t: string) => void = () => undefined): Promise<string> {
  stopSpeaking();
  ui.set({ voice: 'listening' });
  try {
    return useWhisper && voiceSupport.mic && typeof MediaRecorder !== 'undefined' ? await listenWhisper() : await listenBrowser(onInterim);
  } finally {
    abortListen = null;
    if (ui.get().voice === 'listening') ui.set({ voice: 'idle' });
  }
}

export function stopListening(): void {
  abortListen?.();
}
