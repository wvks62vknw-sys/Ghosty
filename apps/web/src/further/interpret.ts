/**
 * INTERPRETER MODE's working (BRIEF-OCT-IDEAS-3 item 1): hearing one language and giving it back in the other, both ways.
 *
 *  - HEAR: the phone's own speech recognition, started by a held key and stopped by letting go (the language of that half).
 *  - TRANSLATE: the brain's translator when there is a signal (POST /api/translate, the Lens's route), the offline brain on this
 *    phone when there is none (offline/brain.ts translateOffline, the Lens's fallback), said plainly when neither can.
 *  - SAY: the phone's own voice for the receiving language (assistant/voice.ts speakIn); when it has none, the screen says so.
 *
 * Nothing is recorded and nothing of the other person is kept: no audio is stored, the lines live in memory on this screen and go
 * when it is left. Only the pair of languages is remembered.
 */
import { trail, inHisWords } from '../ui/hisWords';
import { headers } from '../api/brain';
import { offlineReady, translateOffline } from '../offline/brain';
import { shouldFallBack } from '../offline/prompt';
import { settings } from '../state/app';
import { LANGUAGES } from '../../../../packages/shared/src/scan';

export const PAIR_KEY = 'ghosty.interpreter.pair';
export interface Pair {
  /** The language he speaks, and the language of the other person (codes). */
  a: string;
  b: string;
}
const FIRST: Pair = { a: 'en', b: 'fr' };

/** The last pair, or English and French. */
export function loadPair(): Pair {
  try {
    const v = JSON.parse(localStorage.getItem(PAIR_KEY) ?? 'null') as Partial<Pair> | null;
    const ok = (c?: string) => !!c && LANGUAGES.some((l) => l.code === c);
    if (v && ok(v.a) && ok(v.b) && v.a !== v.b) return { a: v.a!, b: v.b! };
  } catch {
    /* the first pair */
  }
  return { ...FIRST };
}
export function savePair(p: Pair): void {
  try {
    localStorage.setItem(PAIR_KEY, JSON.stringify(p));
  } catch {
    /* remembered for this visit only */
  }
}

/** What a speech recogniser is asked in: the language's code is enough for the phone's recogniser. */
export type Ear = { stop(): Promise<string>; abort(): void };
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const recogniser = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const canHear = (): boolean => !!recogniser();

/** Why hearing failed, in his words (never the browser's own string). */
export const hearWhy = (error: string): string =>
  error === 'not-allowed' || error === 'service-not-allowed'
    ? 'The microphone is blocked. On iPhone: Settings, Safari, Microphone, Allow.'
    : error === 'network'
      ? 'I can’t hear without a signal in this browser. Type it instead.'
      : error === 'audio-capture'
        ? 'I can’t find a microphone on this phone.'
        : 'I couldn’t hear that. Hold the key and try again.';

/**
 * Start hearing `lang` now (inside the press). The returned ear's `stop()` ends it and gives what was heard (''
 * when nothing was); an error is thrown from `stop()` as its plain words.
 */
export function hear(lang: string, onInterim?: (t: string) => void): Ear {
  const SRc = recogniser();
  if (!SRc) {
    return { stop: () => Promise.reject(new Error('This browser has no speech recognition, so I can’t hear. Type it instead.')), abort: () => undefined };
  }
  const rc = new SRc();
  rc.lang = lang;
  rc.interimResults = true;
  rc.continuous = true;
  let fin = '';
  let failed = '';
  let done: () => void = () => undefined;
  const ended = new Promise<void>((r) => {
    done = r;
  });
  rc.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) fin += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    onInterim?.(`${fin}${interim}`.trim());
  };
  rc.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') failed = e.error;
  };
  rc.onend = () => done();
  try {
    rc.start();
  } catch {
    failed = 'audio-capture';
    done();
  }
  return {
    async stop() {
      try {
        rc.stop();
      } catch {
        /* already over */
      }
      // a recogniser that never ends must not hold the key down for good
      await Promise.race([ended, new Promise<void>((r) => setTimeout(r, 4000))]);
      if (failed) throw new Error(hearWhy(failed));
      return fin.trim();
    },
    abort() {
      try {
        rc.abort();
      } catch {
        /* already over */
      }
    },
  };
}

export interface Translated {
  text: string;
  /** 'brain' (the free translator or the chat model), 'offline' (this phone's own model, rough) or 'same' (already in that language). */
  how: 'brain' | 'offline' | 'same';
}

/**
 * `text` into `to`. The brain first; with no signal (or the brain down) the offline brain on this phone when it is there. Throws
 * a plain sentence when neither can (the Lens says the same).
 */
export async function translate(text: string, to: string, from = ''): Promise<Translated> {
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ text, to, ...(from ? { from } : {}) }), credentials: 'same-origin' });
    const j = (await r.json().catch(() => ({}))) as { text?: string; engine?: string; error?: string };
    if (!r.ok || typeof j.text !== 'string') throw Object.assign(new Error(j.error ?? `HTTP ${r.status}`), { status: r.status });
    return { text: j.text, how: j.engine === 'same' || j.engine === 'none' ? 'same' : 'brain' };
  } catch (e) {
    if (!shouldFallBack(e)) { trail(e, 'the interpreter'); throw inHisWords('I couldn’t translate that. Try again in a moment.'); }
    if (settings.get().offlineBrain === 'off') throw inHisWords('I can’t reach my brain to translate, and the offline brain is off. Settings, Offline brain turns it on.');
    if (!(await offlineReady().catch(() => false))) throw inHisWords('No signal, and the offline brain isn’t on this phone yet. Settings, Offline brain, DOWNLOAD, on Wi-Fi, and I can translate without a signal.');
    const r = await translateOffline(text, to);
    if (!r.text) throw inHisWords('The offline brain gave me no translation. Try a shorter sentence.');
    return { text: r.text, how: 'offline' };
  }
}
