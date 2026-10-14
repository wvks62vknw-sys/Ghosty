/**
 * Voice: speaking (browser speech synthesis, sentence by sentence) and listening.
 * Listening uses Groq Whisper through the brain when a Groq key is set (best accuracy, works
 * in every browser), otherwise the browser's own speech recognition.
 */
import { brain } from '../api/brain';
import { settings, ui } from '../state/app';

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

let speakToken = 0;

export function speak(text: string): Promise<void> {
  const t = clean(text);
  if (!t || !('speechSynthesis' in window)) return Promise.resolve();
  const token = ++speakToken;
  const parts = t.match(/[^.!?]+[.!?]*\s*/g) ?? [t];
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
      speechSynthesis.speak(u);
    };
    next(0);
  });
}

export function stopSpeaking(): void {
  speakToken++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
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

async function listenWhisper(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const ctx = new AudioContext();
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
  void ctx.close();
  micLevel.level = 0;
  micLevel.spectrum = null;
  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
  if (blob.size < 4000) return '';
  const text = (await brain.stt(blob)).trim();
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
