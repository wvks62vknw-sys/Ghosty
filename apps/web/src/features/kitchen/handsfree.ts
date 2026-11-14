/**
 * HANDS-FREE COOKING (NEXT ROUND, BODY AND KITCHEN lane, body.u12 and ci.s1): in COOK IT, STEP BY STEP, each step is read out and
 * he says "next", "back", "repeat" or "timer" with messy hands; a step that names its minutes starts its timer as it is read.
 * The words are heard by the phone's own speech recogniser (as the interpreter hears), only while cook mode is hands-free and the
 * screen is open; while a step is being read the ear is paused, so Ghosty never hears itself. Nothing is kept or sent by this.
 */
export type CookWord = 'next' | 'back' | 'repeat' | 'timer' | 'stop';

/** What he said, as a cook-mode word (null: not one). "next step please", "go back", "say that again", "start the timer". */
export function cookWord(heard: string): CookWord | null {
  const t = heard.toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 40) return null;
  if (/\b(?:stop listening|hands off|stop cooking|i'?m done|finish(?:ed)?)\b/.test(t)) return 'stop';
  if (/\b(?:timer|time it|start (?:the )?clock)\b/.test(t)) return 'timer';
  if (/\b(?:repeat|again|what was that|pardon|say that)\b/.test(t)) return 'repeat';
  if (/\b(?:back|previous|last step|go back)\b/.test(t)) return 'back';
  if (/\b(?:next|done|ok next|carry on|continue|forward|what now)\b/.test(t)) return 'next';
  return null;
}

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
export const canListen = (): boolean => !!recogniser();

/** What the specs read and drive (window.__ghosty.handsfree): what was read out, what was heard, and a stand-in ear. */
export const handsState = { on: false, said: [] as string[], heard: [] as string[], hear: (_t: string) => undefined as void, why: '' };

/**
 * The ear and the voice for one cook-mode session. `onWord` gets each word heard; `say` reads a step with the ear paused.
 * `stop` ends both. When the phone has no recogniser, the step is still read out and the keys still work.
 */
export function handsFree(onWord: (w: CookWord) => void, onWhy: (words: string) => void): { say(text: string): Promise<void>; stop(): void } {
  expose();
  const R = recogniser();
  let ear: SR | null = null;
  let alive = true;
  let talking = false;
  const heard = (text: string) => {
    handsState.heard.push(text);
    const w = cookWord(text);
    if (w) onWord(w);
  };
  handsState.hear = heard;
  handsState.on = true;
  const listen = () => {
    if (!alive || talking || !R || ear) return;
    try {
      const r = new R();
      r.lang = 'en-GB';
      r.continuous = true;
      r.interimResults = false;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) heard(e.results[i]![0].transcript);
      };
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          alive = false;
          handsState.why = 'blocked';
          onWhy('The microphone is blocked, so use the keys. On iPhone: Settings, Safari, Microphone, Allow.');
        }
      };
      r.onend = () => {
        ear = null;
        // (it stops after a quiet spell: back on while cook mode is hands-free)
        if (alive && !talking) window.setTimeout(listen, 250);
      };
      r.start();
      ear = r;
    } catch {
      ear = null;
    }
  };
  if (!R) {
    handsState.why = 'none';
    onWhy('This phone can’t hear words here, so each step is read out and the keys move on.');
  }
  listen();
  return {
    async say(text: string) {
      handsState.said.push(text);
      talking = true;
      try {
        ear?.abort();
      } catch {
        /* already off */
      }
      ear = null;
      try {
        const v = await import('../../assistant/voice');
        // (a voice that never says it has finished never holds the ear off for longer than the step takes to say)
        await Promise.race([v.speak(text, { here: true }), new Promise((r) => window.setTimeout(r, Math.min(25_000, 1500 + text.length * 80)))]);
      } catch {
        /* the step is on the screen */
      }
      talking = false;
      listen();
    },
    stop() {
      alive = false;
      handsState.on = false;
      handsState.hear = () => undefined;
      try {
        ear?.abort();
      } catch {
        /* already off */
      }
      ear = null;
      void import('../../assistant/voice').then((v) => v.stopSpeaking()).catch(() => undefined);
    },
  };
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.handsfree = handsState;
}
