/**
 * Voice: speaking and listening.
 * Speaking: Ghosty's own voice from the brain (Workers AI, POST /api/tts: Deepgram Aura's
 * natural British voices within a daily share, MeloTTS after; packages/shared/src/voices.ts)
 * when the brain can speak — sentence by sentence through one audio element the first tap
 * unlocked — otherwise, and whenever that fails, the phone's own speech synthesis (an installed
 * Enhanced or Premium British voice first). SETTINGS → VOICE picks (settings.voiceEngine,
 * brainVoice, voice).
 * Listening: the recording goes to the brain as WAV (Groq's Whisper with a key, else Workers
 * AI's Whisper) when the brain can hear, otherwise the browser's own speech recognition.
 * Barge-in: during a voice conversation the microphone stays open (echo cancellation on) and,
 * while Ghosty speaks, assistant/barge.ts listens for the owner talking over it: Ghosty stops at
 * once, the reply is marked as cut off (onCutOff) and what the owner says is heard — the
 * recording already running, so their first words are kept. A tap does the same (interrupt).
 */
import { brain, speechCaps } from '../api/brain';
import { brainVoice, naturalBritish, phoneVoiceScore } from '../../../../packages/shared/src/voices';
import { settings, ui } from '../state/app';
import { BargeDetector } from './barge';
import { mood } from '../state/mood';
import type { MoodKind } from '../../../../packages/shared/src/mood';

/**
 * His voice follows his mood (OWNER-ISSUES 63; a design pick the owner may change): the phone's voice in pitch, pace and
 * loudness — cross lower, slower, colder; subdued lower, slower, quieter; pleased a touch brighter; protective steady and
 * level. Ghosty's own voice (the brain's clips, MeloTTS or Aura) takes no pitch or speed, so only its pace and loudness
 * follow, as the clip is played (the pitch kept).
 */
export const MOOD_TONE: Partial<Record<MoodKind, { rate: number; pitch: number; volume: number }>> = {
  cross: { rate: 0.9, pitch: 0.8, volume: 1 },
  subdued: { rate: 0.92, pitch: 0.9, volume: 0.8 },
  pleased: { rate: 1.02, pitch: 1.05, volume: 1 },
  protective: { rate: 0.95, pitch: 1, volume: 1 },
};
const tone = () => MOOD_TONE[mood.get().now.kind] ?? { rate: 1, pitch: 1, volume: 1 };
import { brief, clean, quickFirst, sentences } from './spoken'; // what is read aloud, in which pieces (pure, tested in Node)
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

let lastRead = 0;
/** This phone's English voices, the most natural British ones first. */
export const listVoices = (): SpeechSynthesisVoice[] => {
  // Read again at most once a second while the list is empty: reading it can itself announce a change.
  if (!voices.length && Date.now() - lastRead > 1000) {
    lastRead = Date.now();
    loadVoices();
  }
  return voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => phoneVoiceScore(b) - phoneVoiceScore(a) || a.name.localeCompare(b.name));
};

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

/** The phone voice to use: the one picked in SETTINGS, else the most natural British one installed. */
export function bestVoice(): SpeechSynthesisVoice | null {
  const list = listVoices();
  const want = settings.get().voice;
  if (want !== 'auto') {
    const v = voices.find((x) => x.name === want);
    if (v) return v;
  }
  return list[0] ?? voices[0] ?? null;
}

/** A natural British voice installed on this phone ("Serena (Premium)", "Daniel (Enhanced)"), or null. */
export const naturalPhoneVoice = (): SpeechSynthesisVoice | null => listVoices().find(naturalBritish) ?? null;

let speakToken = 0;
/** After a natural-voice error, ask for the plain voice until this time (a short break, not the rest of the day). */
let auraBreakUntil = 0;
const AURA_BREAK_MS = 2 * 60_000;
/** After Ghosty's voice failed (no sound, a refusal) or its natural voice ran out, the phone's voice speaks until this time. */
let phoneUntil = 0;
/** Which voice is speaking now and why, for SETTINGS ("Now: …"). */
export const voiceNow = { engine: '' as '' | 'ghosty' | 'phone', name: '', note: '' };

/** What to speak with: an explicit choice (the SAMPLE button) or the settings. */
interface Choice {
  engine: 'auto' | 'ghosty' | 'phone';
  brainVoice: string;
  phoneVoice: string;
}
const chosen = (): Choice => ({ engine: settings.get().voiceEngine, brainVoice: settings.get().brainVoice, phoneVoice: settings.get().voice });

const ghostyVoice = (c: Choice): boolean => c.engine !== 'phone' && ui.get().connected === true && speechCaps.get().tts && Date.now() >= phoneUntil;

/** How far the reply being spoken has got (for the "cut off" mark). */
let progress = { parts: [] as string[], i: 0, owner: undefined as string | undefined };

/**
 * Read `text` aloud. `owner`: which chat entry this is (session.ts passes the reply's own tag), so
 * an interruption marks that reply and no other; `choice`: a voice other than the saved one (SAMPLE);
 * `brief`: a reply read out by itself — a long one stops after about half a minute, "The rest is on
 * screen." (LISTEN reads the whole of it). `here`: a reply kept on the phone (OWNER-ISSUES 72): only the
 * phone's own voice reads it, never Ghosty's (the brain makes that voice from the words).
 */
export function speak(text: string, opts: { choice?: Choice; owner?: string; brief?: boolean; here?: boolean; aside?: boolean } = {}): Promise<void> {
  const choice = opts.choice ?? chosen();
  const t = clean(text);
  if (!t) return Promise.resolve();
  // An aside still being said ("looking at the trains…") gives way to what comes next at once: never under or after it.
  if (asideToken === speakToken && ui.get().voice === 'speaking') cancelPhone();
  const token = ++speakToken;
  // [talk] `aside`: a word on what he is doing while the brain works (session.ts narration, BRIEF-TALK-1A 3): no reply is
  // marked if it is cut, and anything said after it takes its place.
  asideToken = opts.aside ? token : 0;
  // (the first piece short: the voice starts on it while the rest is still being made — BRIEF-TALK-1A 1)
  const parts = quickFirst(opts.brief ? brief(sentences(t)) : sentences(t));
  progress = { parts, i: 0, owner: opts.owner };
  // A clip still playing from the last reply stops now, so its handlers never touch the next clip.
  stopClip?.();
  // Ghosty's own voice first; whatever it could not say, the phone says. The reactor shows "speaking" at
  // once: the first clip takes a moment to arrive, and a hands-free turn must not reopen the mic meanwhile.
  if (!opts.here && ghostyVoice(choice)) {
    ui.set({ voice: 'speaking' });
    return speakGhosty(parts, token, choice).then((from) => (from < parts.length ? speakPhone(parts.slice(from), token, choice, from) : undefined));
  }
  return speakPhone(parts, token, choice);
}

/** The speech now being said is an aside (its token), or 0. */
let asideToken = 0;
/** The phone's voice stops what it is saying and forgets what it was to say next. */
function cancelPhone(): void {
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  } catch {
    /* no speech synthesis */
  }
}

/** SETTINGS → VOICE → SAMPLE: a line in the voice shown, whatever is saved. */
export function speakSample(choice: Choice): Promise<void> {
  if (choice.engine !== 'phone') phoneUntil = 0;
  return speak("Evening. This is how I'll sound. Say the word and I'll stop.", { choice });
}

// Choosing a voice again in SETTINGS ends any wait on the phone's voice; VOICE OFF also silences what is being said now.
settings.subscribe((s, prev) => {
  if (s.voiceEngine !== prev.voiceEngine || s.brainVoice !== prev.brainVoice) phoneUntil = 0;
  if (prev.speak && !s.speak) stopSpeaking();
});

/** The phone voice a reply is read in: the one picked in SETTINGS, else (automatic) a natural British one, else the best. */
const phoneVoiceFor = (choice: Choice): SpeechSynthesisVoice | null => (choice.phoneVoice !== 'auto' ? voices.find((x) => x.name === choice.phoneVoice) : null) ?? (choice.engine === 'auto' ? naturalPhoneVoice() : null) ?? bestVoice();

/** Ends the phone's reading now (stopSpeaking): its promise resolves even if the voice never says it was cut. */
let stopPhone: (() => void) | null = null;

/**
 * The sentences in the phone's own voice. Every one is handed to the voice at once, in order: it starts each the moment the
 * one before it ends (BRIEF-TALK-1A 1). One at a time from here, as it used to be, left the voice idle between sentences, and
 * an idle voice on an iPhone takes a moment to start again: a gap after every sentence. `progress` follows each one's start.
 */
function speakPhone(parts: string[], token: number, choice: Choice, offset = 0): Promise<void> {
  if (!('speechSynthesis' in window) || !parts.length) {
    if (token === speakToken) ui.set({ voice: 'idle' });
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let left = parts.length;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      audible = false;
      if (stopPhone === finish) stopPhone = null;
      if (token === speakToken) ui.set({ voice: 'idle' });
      resolve();
    };
    stopPhone = finish;
    const v = phoneVoiceFor(choice);
    Object.assign(voiceNow, { engine: 'phone', name: v?.name ?? "the phone's voice" });
    const t = tone();
    ui.set({ voice: 'speaking' });
    try {
      speechSynthesis.resume(); // iOS sometimes leaves the synthesiser paused
    } catch {
      /* ignore */
    }
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = t.rate;
      u.pitch = (v && naturalBritish(v) ? 1 : 0.92) * t.pitch;
      u.volume = t.volume;
      u.onstart = () => {
        if (token !== speakToken || over) return;
        progress.i = offset + i;
        audible = true;
        armBargeIn();
      };
      u.onend = u.onerror = () => {
        if (token !== speakToken) return finish();
        audible = false;
        if (--left <= 0) finish();
      };
      speechSynthesis.speak(u);
    });
  });
}

/**
 * The voices woken before they are needed (the mic tap, the chat box taken: BRIEF-TALK-1A 1): the phone's voice says a silent
 * "." in the voice that will read the reply, so the first real sentence is not the slow one an idle iPhone voice gives; and the
 * audio element plays a moment of silence, so Ghosty's own first clip starts at once. Nothing is heard; nothing that is
 * speaking or playing is touched.
 */
export function primeSpeech(): void {
  unlockSpeech();
  try {
    const el = audioEl();
    if (el.paused && !stopClip) {
      const url = URL.createObjectURL(new Blob([encodeWav(new Float32Array(800))], { type: 'audio/wav' }));
      el.src = url;
      void el.play().catch(() => undefined).finally(() => setTimeout(() => URL.revokeObjectURL(url), 3000));
    }
  } catch {
    /* no audio */
  }
  if (!('speechSynthesis' in window)) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) return;
    const u = new SpeechSynthesisUtterance('.');
    const v = phoneVoiceFor(chosen());
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/** The next midnight UTC, when the brain's daily share of natural voice comes back. */
const nextUtcMidnight = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

/**
 * The sentences in Ghosty's own voice, in order: the first two are fetched together, the next
 * one while one plays. Resolves with how many were spoken — fewer than all means a clip failed
 * (no sound within 4 s, a refusal, the day's allowance) and the phone says the rest, and the
 * phone's voice is used for the next ten minutes. On 'auto', when the brain's natural voice has
 * run out for the day and this phone has a natural British voice, that voice takes over until
 * the share comes back.
 */
async function speakGhosty(parts: string[], token: number, choice: Choice): Promise<number> {
  const el = audioEl();
  const clips: Promise<(Blob & { voice?: string; note?: string; reason?: string }) | null>[] = [];
  // The brain saying no (no Workers AI, the day's allowance) is what sends the next ten minutes to the
  // phone's voice; a lost request, or a clip refused before the first tap unlocked the element, is not.
  let refused = false;
  // After the natural voice failed just now, a short break from it (the plain voice answers faster than a failing one).
  const want = Date.now() < auraBreakUntil ? 'melo' : choice.engine === 'ghosty' ? choice.brainVoice : 'auto';
  const fetchClip = (i: number) => {
    if (i < parts.length && !clips[i]) {
      clips[i] = brain.tts(parts[i]!, want).catch((e: { status?: number }) => {
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
    if (blob.reason === 'error' || blob.reason === 'empty') auraBreakUntil = Date.now() + AURA_BREAK_MS;
    if (blob.reason === 'share' && choice.engine === 'auto' && naturalPhoneVoice()) {
      // Only when the natural voice's share is used up for today does a natural voice on the phone take over
      // until midnight UTC — from this reply on if nothing of it was said yet, else from the next (no clip is wasted).
      phoneUntil = nextUtcMidnight();
      voiceNow.note = blob.note ?? '';
      if (i === 0) return i;
    }
    Object.assign(voiceNow, { engine: 'ghosty', name: brainVoice(blob.voice ?? want).label.split(' — ')[0], note: blob.note ?? '' });
    progress.i = i;
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
      audible = false;
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
      audible = true;
      armBargeIn();
      // An end that never comes (a stalled clip) must not leave the reactor "speaking" for good.
      timer = window.setTimeout(() => finish(true), ((Number.isFinite(el.duration) ? el.duration : 30) + 2) * 1000);
    };
    el.onended = onEnded;
    el.onerror = () => finish(false);
    el.src = url;
    // his mood in Ghosty's own voice: its pace and loudness (the clip's pitch is kept)
    const t = tone();
    el.preservesPitch = true;
    el.playbackRate = t.rate;
    el.volume = t.volume;
    el.play().catch(() => finish(false));
  });
}

/**
 * The phone's own voice for a language (`lang` a code such as "es"), the most natural first; null when the phone
 * has none — then a translation is not read aloud in a wrong accent.
 */
export function voiceIn(lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices();
  const want = lang.toLowerCase();
  const all = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === want);
  return all.sort((a, b) => phoneVoiceScore(b) - phoneVoiceScore(a) || Number(b.localService) - Number(a.localService))[0] ?? null;
}

/**
 * READ ALOUD a translation in its own language's voice on this phone (works with no signal). False, and nothing
 * said, when the phone has no voice for that language.
 */
export function speakIn(text: string, lang: string): boolean {
  const v = voiceIn(lang);
  if (!v || !('speechSynthesis' in window)) return false;
  stopSpeaking();
  const token = speakToken;
  const u = new SpeechSynthesisUtterance(text.trim());
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  Object.assign(voiceNow, { engine: 'phone', name: v.name });
  u.onend = u.onerror = () => {
    if (token === speakToken && ui.get().voice === 'speaking') ui.set({ voice: 'idle' });
  };
  ui.set({ voice: 'speaking' });
  try {
    speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking(): void {
  speakToken++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  stopPhone?.();
  stopClip?.();
  disarmBargeIn();
  if (ui.get().voice === 'speaking') ui.set({ voice: 'idle' });
}

// ---------- interrupting ----------

export interface CutOff {
  /** The `owner` tag the interrupted speech was given (speak), if any. */
  owner?: string;
  /** What had been said when Ghosty stopped (whole sentences). */
  said: string;
  how: 'tap' | 'voice';
  /** The pieces it was saying, and which one it was in when cut (`said` is the ones before it): "go on" starts there. */
  parts: string[];
  at: number;
}
const cutListeners = new Set<(c: CutOff) => void>();
/** Called when the owner interrupts Ghosty (session.ts marks the reply as cut off). */
export function onCutOff(f: (c: CutOff) => void): () => void {
  cutListeners.add(f);
  return () => cutListeners.delete(f);
}

/** The owner cut in (a tap, or talking over Ghosty): speech stops now. False when Ghosty was not speaking. */
export function interrupt(how: 'tap' | 'voice' = 'tap'): boolean {
  if (ui.get().voice !== 'speaking') return false;
  const { parts, i: at, owner } = progress;
  const said = parts.slice(0, at).join(' ');
  stopSpeaking();
  for (const f of cutListeners) f({ said, how, owner, parts, at });
  return true;
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

let abortListen: ((drop?: boolean) => void) | null = null;

/** What the owner is told when Ghosty cannot hear (plain words, never "Failed to fetch"). */
const NO_SIGNAL = "No connection, so I can't hear you right now. Type it instead.";
const MIC_BLOCKED = 'Microphone blocked. On iPhone: Settings › Safari › Microphone › Allow (or tap aA › Website Settings), then tap the mic again.';
const NO_EARS = "I can't hear you in this browser: it has no speech recognition, and your brain can't hear until it runs on Cloudflare.";

function listenBrowser(onInterim: (t: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SRClass) {
      reject(new Error(NO_EARS));
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
    // Nothing said, or stopped: an empty answer. Anything else is said in plain words (a conversation then ends,
    // rather than starting the recogniser again and again with nothing on the screen).
    rc.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      reject(new Error(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? MIC_BLOCKED : e.error === 'network' ? NO_SIGNAL : e.error === 'audio-capture' ? 'No microphone found on this device.' : "This phone couldn't turn what you said into words. Try again, or type it."));
    };
    let dropped = false;
    rc.onend = () => resolve(dropped ? '' : fin.trim());
    abortListen = (drop) => {
      dropped = !!drop;
      rc.abort();
    };
    rc.start();
  });
}

/**
 * The open microphone: one stream and one AudioContext for a whole voice conversation (so the
 * phone asks once, and barge-in can listen while Ghosty speaks). Closed by closeMic when the
 * conversation ends or the page is hidden.
 */
interface Mic {
  ctx: AudioContext;
  stream: MediaStream;
  an: AnalyserNode;
  time: Float32Array<ArrayBuffer>;
  freq: Uint8Array<ArrayBuffer>;
}
let mic: Mic | null = null;
/** The microphone stays open after an utterance (a voice conversation is on). */
let keepMic = false;

/** Must be called from inside a tap for the first time: Safari starts an AudioContext made later suspended. */
async function openMic(): Promise<Mic> {
  if (mic && mic.stream.getAudioTracks().some((t) => t.readyState === 'live')) {
    if (mic.ctx.state !== 'running') void mic.ctx.resume().catch(() => undefined);
    return mic;
  }
  closeMic();
  // Made in the tap itself, before the microphone prompt: Safari starts a context made after that wait suspended,
  // so the level meter would read silence and never hear the end of what was said.
  const ctx = new AudioContext();
  void ctx.resume().catch(() => undefined);
  let stream: MediaStream;
  try {
    // Echo cancellation keeps Ghosty's own voice out of what the microphone hears (barge-in depends on it).
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch (e) {
    void ctx.close();
    const name = (e as Error)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new Error(MIC_BLOCKED);
    if (name === 'NotFoundError') throw new Error('No microphone found on this device.');
    throw e;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined); // (never awaited: Safari holds it until a tap)
  // Opened with no touch at all (Siri's "Ghosty listen": BRIEF-TALK-1A 6): an iPhone keeps the page's sound off until one, so
  // the ear cannot hear the room yet. It says so, and the first touch anywhere turns it on.
  if (ctx.state !== 'running') tapToHear(ctx);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(an);
  mic = { ctx, stream, an, time: new Float32Array(an.fftSize), freq: new Uint8Array(an.frequencyBinCount) };
  return mic;
}

/** One touch anywhere wakes the page's sound (an iPhone wants it), said once on the screen while it waits. */
function tapToHear(ctx: AudioContext): void {
  const go = () => {
    document.removeEventListener('pointerdown', go, true);
    void ctx.resume().catch(() => undefined);
    unlockSpeech();
    tapNote?.remove();
    tapNote = null;
  };
  setTimeout(() => {
    if (ctx.state === 'running' || ctx.state === 'closed') return;
    document.addEventListener('pointerdown', go, true);
    tapNote ??= document.body.appendChild(Object.assign(document.createElement('div'), { id: 'taptohear', role: 'status', textContent: 'Tap anywhere and I’m listening' }));
  }, 250);
}
let tapNote: HTMLElement | null = null;

/** The microphone off: the phone's mic light goes out. */
export function closeMic(): void {
  disarmBargeIn();
  if (carry?.rec.state === 'recording') carry.rec.stop();
  carry = null;
  if (!mic) return;
  mic.stream.getTracks().forEach((t) => t.stop());
  void mic.ctx.close().catch(() => undefined);
  mic = null;
}
addEventListener('pagehide', () => closeMic());
// The microphone never stays open behind the app: hidden (another app, the lock screen, the Home Screen) ends it.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  keepMic = false;
  stopListening();
  closeMic();
  for (const f of releaseListeners) f();
});
// Talking over Ghosty switched off: the microphone is no longer held between turns.
settings.subscribe((s, prev) => {
  if (prev.bargeIn && !s.bargeIn) {
    keepMic = false;
    if (ui.get().voice !== 'listening') closeMic();
  }
});
const releaseListeners = new Set<() => void>();
/** Called when the microphone was let go because the app was hidden (core/index.ts ends the voice conversation). */
export function onMicReleased(f: () => void): () => void {
  releaseListeners.add(f);
  return () => releaseListeners.delete(f);
}

/** Keep the microphone open between utterances (a voice conversation), or not. Off closes it. */
export function holdMic(on: boolean): void {
  // Held only for barge-in: without it the microphone is open only while listening.
  keepMic = on && settings.get().bargeIn;
  if (!on) closeMic();
}

/** The microphone's loudness now (RMS), and its spectrum into m.freq. */
function readLevel(m: Mic): number {
  m.an.getFloatTimeDomainData(m.time);
  m.an.getByteFrequencyData(m.freq);
  let s = 0;
  for (let i = 0; i < m.time.length; i++) s += m.time[i]! * m.time[i]!;
  return Math.sqrt(s / m.time.length);
}

const recMime = () => (typeof MediaRecorder === 'undefined' ? '' : (['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''));

/** A recording of the open microphone, from now. */
function record(m: Mic): { rec: MediaRecorder; chunks: Blob[]; mime: string; at: number } {
  const mime = recMime();
  const rec = new MediaRecorder(m.stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(100);
  return { rec, chunks, mime, at: performance.now() };
}

/** A barge-in recording handed to the next listen: it began before the owner spoke; `from` is when their voice began. */
let carry: (ReturnType<typeof record> & { from: number }) | null = null;
/** Ghosty's voice is playing right now (a clip between `playing` and its end, or an utterance between start and end). */
let audible = false;
/** The barge-in watch while Ghosty speaks. */
let watch: { stop(): void } | null = null;

/**
 * While Ghosty speaks in a voice conversation: listen for the owner talking over it. Started
 * when a clip or utterance actually starts playing (so the detector learns the echo, not the
 * silence before it); ends when Ghosty stops speaking. The recording runs from the start, so
 * the owner's first words, said before Ghosty could stop, are kept for the recogniser.
 */
function armBargeIn(): void {
  if (watch || !mic || !keepMic || !settings.get().bargeIn || typeof MediaRecorder === 'undefined') return;
  const m = mic;
  const det = new BargeDetector();
  let r: ReturnType<typeof record>;
  try {
    r = record(m);
  } catch {
    return;
  }
  // Held: the owner's voice has begun over Ghosty's and the detector is not yet sure (barge.ts hearing): Ghosty is silent
  // meanwhile — within a reading or two of his first sound, not after the 180 ms the detector needs to be sure (BRIEF-TALK-1A
  // 2: quiet within 150 ms) — and carries on from the same word if it was a cough or a click.
  let held = false;
  const hold = (on: boolean) => {
    if (on === held) return;
    held = on;
    holdSpeech(on);
  };
  const end = (keep: boolean) => {
    clearInterval(timer);
    watch = null;
    if (!keep) hold(false);
    if (!keep && r.rec.state === 'recording') r.rec.stop();
  };
  let was = true;
  const timer = window.setInterval(() => {
    if (ui.get().voice !== 'speaking' || mic !== m) return end(false);
    // Only while a clip or an utterance is actually playing: between them the detector waits (barge.ts pause).
    if (!audible) {
      if (was) det.pause();
      was = false;
      return;
    }
    was = true;
    if (det.feed(readLevel(m), performance.now())) {
      end(true);
      carry = { ...r, from: det.speechStart };
      interrupt('voice');
      return;
    }
    hold(det.hearing);
  }, 20);
  watch = { stop: () => end(false) };
}

function disarmBargeIn(): void {
  watch?.stop();
}

/** Ghosty's voice held silent (`on`) or let go on from where it was: the clip playing now, else the phone's voice. */
function holdSpeech(on: boolean): void {
  try {
    if (stopClip && player) {
      if (on) player.pause();
      else void player.play().catch(() => undefined);
    } else if ('speechSynthesis' in window) {
      if (on) speechSynthesis.pause();
      else speechSynthesis.resume();
    }
  } catch {
    /* nothing to hold */
  }
}

/**
 * How long a quiet after his voice ends what he said (BRIEF-TALK-1A 1: his last word to Ghosty's first within a second, and
 * this wait is part of it). 700 ms is a breath between sentences kept and a finished sentence heard at once; it was 1,000 ms.
 * (A design pick he may change: a longer one suits someone who pauses mid-thought.)
 */
const END_SILENCE_MS = 700;

/** The recording as 16 kHz mono WAV, which every recogniser reads (iPhones record AAC, which not all of them do); `skip` seconds off the start. */
async function toWav(ctx: AudioContext, blob: Blob, skip = 0): Promise<Blob> {
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const from = Math.max(0, Math.min(decoded.length - 1, Math.floor(skip * decoded.sampleRate)));
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i).subarray(from));
  return new Blob([encodeWav(toMono16k(channels, decoded.sampleRate))], { type: 'audio/wav' });
}

async function listenWhisper(onReady: () => void = () => undefined): Promise<string> {
  const m = await openMic();
  // After a barge-in the recording is already running and the owner already talking.
  const c = carry;
  carry = null;
  const r = c && c.rec.state === 'recording' ? c : record(m);
  // `speech`: a voice was heard (the end of it ends the recording); `voiced`: ms of anything louder than the room, so a
  // soft voice that never reached `speech` is still sent, and a recording of only the room is not; `ticks`: readings
  // taken (a meter that hardly ran — a suspended context, a busy phone — proves nothing, so then it is sent as before).
  let speech = !!c;
  let voiced = 0;
  let ticks = 0;
  let dropped = false; // stopListening(true): what was caught is not wanted
  // A barge-in recording began while Ghosty was still speaking: it is cut to a moment before the owner's voice began.
  const skip = c ? Math.max(0, (c.from - r.at - 400) / 1000) : 0;
  // EARLY EARS (BRIEF-TALK-1A 1): once he has been quiet for EARLY_MS, what he said so far goes to be written down while the
  // ear waits out the rest of END_SILENCE_MS; if he says no more, those words are already back when the quiet ends (the
  // writing down is no longer added to his wait). If he speaks again, they are set aside and the whole recording is sent.
  let early: { from: number; text: Promise<string | null> } | null = null;
  let lastLoud = c ? performance.now() : 0;
  const done = new Promise<void>((resolve) => {
    let floor = carriedFloor(m);
    let speechAt = 0;
    let calib = c || floor ? 20 : 0;
    floor ||= 0.008;
    let ready = false;
    const t0 = performance.now();
    let last = t0;
    let stopped = false;
    abortListen = (drop) => {
      stopped = true;
      dropped = !!drop;
    };
    const tick = () => {
      const now = performance.now();
      const rms = readLevel(m);
      micLevel.level = Math.min(1, rms * 9);
      micLevel.spectrum = m.freq;
      if (!speech) floor = ++calib < 20 ? Math.max(floor * 0.9 + rms * 0.1, 0.003) : floor * 0.995 + Math.min(rms, floor * 1.5) * 0.005;
      if (!ready && calib >= 20) {
        ready = true;
        onReady();
      }
      const thr = Math.max(0.018, floor * 3.2);
      if (rms > Math.max(0.008, floor * 2)) voiced += Math.min(1000, now - last);
      last = now;
      ticks++;
      if (rms > thr) {
        lastLoud = now;
        if (!speech) {
          if (!speechAt) speechAt = now;
          if (now - speechAt > 110) speech = true;
        }
      } else if (!speech) speechAt = 0;
      if (speech && !early && !stopped && now - lastLoud > EARLY_MS) early = { from: lastLoud, text: writeDownSoFar(m, r, skip) };
      const silence = speech && now - lastLoud > END_SILENCE_MS;
      const tooLong = now - t0 > (speech ? 30000 : 12000);
      if (stopped || silence || tooLong || mic !== m) {
        if (calib >= 20) floors.set(m, floor);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await done;
  // the words written down early are his whole utterance when nothing louder than the room came after them
  const sent = early as { from: number; text: Promise<string | null> } | null; // (set inside the meter's loop above)
  const earlyText = sent && sent.from === lastLoud && !dropped ? sent.text : null;
  const stopped = new Promise<void>((res) => {
    if (r.rec.state === 'inactive') return res();
    r.rec.onstop = () => res();
    r.rec.stop();
  });
  if (earlyText) {
    writing = true;
    ui.set({ voice: 'thinking', ...(ui.get().busy ? {} : { busy: true, status: 'writing down what you said…' }) });
    const said = await earlyText;
    if (said !== null) {
      void stopped.then(() => {
        afterRecording(m);
        if (mic !== m) void m.ctx.close().catch(() => undefined);
      });
      return heardWords(said, voiced);
    }
  }
  await stopped;
  afterRecording(m);
  // Let go of by the caller (stopListening(true): Ghosty began to speak while this listened): what the microphone caught is his
  // own voice and the room, so nothing goes to the brain, and the screen keeps saying what it said.
  if (dropped) {
    if (mic !== m) void m.ctx.close().catch(() => undefined);
    return '';
  }
  // Only the room was heard (12 s and no voice): nothing goes to the brain (Whisper "hears" words in silence, and each try counts).
  if (!speech && voiced < 250 && ticks >= 30 && m.ctx.state === 'running') {
    if (mic !== m) void m.ctx.close().catch(() => undefined);
    return '';
  }
  const blob = new Blob(r.chunks, { type: r.rec.mimeType || r.mime }); // iPhones record audio/mp4, others webm
  // Sent as WAV when the recording decodes; as recorded otherwise (a Groq key reads most formats).
  const wav = blob.size >= 4000 ? await toWav(m.ctx, blob, skip).catch(() => null) : null;
  if (mic !== m) void m.ctx.close().catch(() => undefined);
  if (blob.size < 4000) return '';
  // The recording is done: the screen stops saying LISTENING while the words are worked out.
  writing = true;
  ui.set({ voice: 'thinking', ...(ui.get().busy ? {} : { busy: true, status: 'writing down what you said…' }) });
  const text = await brain.stt(wav ?? blob).catch((e: unknown) => {
    throw e instanceof TypeError ? new Error(NO_SIGNAL) : e;
  });
  return heardWords(text, voiced);
}

/** After this much quiet, what he said so far is sent to be written down while the ear still listens (EARLY EARS). */
const EARLY_MS = 400;

/** The room's level each open microphone last learned: the next listen on it starts from that, so it can hear him at once. */
const floors = new WeakMap<Mic, number>();
/** The level learned on this microphone's last listen (0 when none): a conversation's ear needs no new learning between turns. */
const carriedFloor = (m: Mic): number => floors.get(m) ?? 0;

/** The recording so far, sent to be written down; null when it is too short or anything fails (then the whole one is sent). */
async function writeDownSoFar(m: Mic, r: { rec: MediaRecorder; chunks: Blob[]; mime: string }, skip: number): Promise<string | null> {
  try {
    if (typeof r.rec.requestData === 'function' && r.rec.state === 'recording') {
      await new Promise<void>((res) => {
        const t = setTimeout(res, 200);
        r.rec.addEventListener('dataavailable', () => (clearTimeout(t), res()), { once: true });
        r.rec.requestData();
      });
    }
    const blob = new Blob(r.chunks.slice(), { type: r.rec.mimeType || r.mime });
    if (blob.size < 4000) return null;
    const wav = await toWav(m.ctx, blob, skip).catch(() => null);
    return await brain.stt(wav ?? blob);
  } catch {
    return null;
  }
}

/** The microphone after a recording: the level meter rests, and outside a conversation the mic light goes out (the context stays to decode). */
function afterRecording(m: Mic): void {
  micLevel.level = 0;
  micLevel.spectrum = null;
  if (!keepMic && mic === m) {
    mic = null;
    m.stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * What the recogniser wrote, as heard: the words Whisper invents in a near-silent recording ("you", "thank you", "thanks for
 * watching", "bye") count as nothing. "Bye" said with a real voice behind it (300 ms or more) is kept: it ends a conversation.
 */
function heardWords(text: string, voiced: number): string {
  const t = text.trim();
  if (/^bye\.?$/i.test(t) && voiced >= 300) return t;
  return /^(thank you|thanks for watching|you|bye)\.?$/i.test(t) ? '' : t;
}

/** The recording is with the brain and its words are being worked out (listen shows "writing down what you said…"). */
let writing = false;

/**
 * Listen for one utterance. With no connection the brain cannot hear: the phone's own recogniser tries
 * instead when there is one, else the owner is told so before saying a word.
 */
export async function listen(useWhisper: boolean, onInterim: (t: string) => void = () => undefined, onReady: () => void = () => undefined): Promise<string> {
  stopSpeaking();
  const offline = navigator.onLine === false;
  if (offline && useWhisper && !SRClass) throw new Error(NO_SIGNAL);
  const wasBusy = ui.get().busy;
  ui.set({ voice: 'listening' });
  try {
    // `onReady`: the ear can hear him now (BRIEF-TALK-1A 4: the "your turn" tone) — the brain's ear once it knows the room,
    // the phone's own recogniser as it starts.
    if (useWhisper && !offline && voiceSupport.mic && typeof MediaRecorder !== 'undefined') return await listenWhisper(onReady);
    onReady();
    return await listenBrowser(onInterim);
  } finally {
    abortListen = null;
    if (ui.get().voice === 'listening') ui.set({ voice: 'idle' });
    if (writing) {
      writing = false;
      ui.set({ ...(ui.get().voice === 'thinking' ? { voice: 'idle' as const } : {}), ...(wasBusy ? {} : { busy: false, status: '' }) });
    }
  }
}

/** Stop listening now; what was caught so far is heard as usual, unless `drop` (a listen cut because Ghosty began to speak). */
export function stopListening(drop = false): void {
  abortListen?.(drop);
}
