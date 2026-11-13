/**
 * THE ORB SAYS WHAT IT IS (BRIEF-QUALITY-BOOT-ORB 2, THE ORB): one small line under the orb, `role="status"`, for the words the light alone
 * cannot carry: the first time he sees listening, thinking, speaking, attending; the brain gone (the orb is low, no pulses) and why; the
 * models cooling with the time; the first press on the orb; heavy mode's still frame. Each is said and then leaves (SAY_MS): a line that
 * stayed would be a label, and the orb's light is the state. It rides the orb's wrap into every Home, takes no pointer, and asks for nothing.
 */
import { fmt, h } from '../../core/dom';
import { heavy } from '../../core/heavy';
import { ui } from '../../state/app';
import { HEAVY_WORDS, PRESS_HINT, SAY_MS, STATE_WORDS, coolingWords, offlineWords, type OrbSaid } from './orbwords';

/** What the checks read (window.__ghosty.orbsay). */
export const orbSayState = { text: '', said: [] as string[] };

const SEEN = 'ghosty.orbsaid';
const PRESSES = 'ghosty.orbpresses';
const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const keep = (k: string): void => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...new Set([...read(), k])]));
  } catch {
    /* storage blocked: it is said again next time, never lost */
  }
};

/** The state he is looking at, from the one store the chat and the orb share. */
export function orbStateOf(s = ui.get()): OrbSaid | 'offline' | 'idle' {
  if (s.connected === false && s.voice === 'idle' && !s.busy) return 'offline';
  return s.voice === 'speaking' ? 'speaking' : s.voice === 'listening' ? 'listening' : s.busy ? 'thinking' : 'idle';
}

export interface OrbSay {
  el: HTMLElement;
  /** The orb was pressed (core/index.ts): the first press ever says the hint, in the worlds that have no hint of their own. */
  pressed(world: string): void;
}

export function orbSay(): OrbSay {
  const el = h('p.orbsay.g-truth', { hidden: true, role: 'status', 'aria-live': 'polite', dataset: { case: 'keep' } });
  let timer = 0;
  const say = (text: string): void => {
    el.textContent = text;
    el.hidden = false;
    orbSayState.text = text;
    orbSayState.said.push(text);
    clearTimeout(timer);
    timer = window.setTimeout(() => (el.hidden = true), SAY_MS);
  };
  let last = orbStateOf();
  let heavySaid = false;
  let coolSaid = 0;
  const check = (): void => {
    const s = ui.get();
    const now = orbStateOf(s);
    if (now !== last) {
      last = now;
      stateSaid(now);
    }
    // the models cooling: while a turn waits for one, the time it is back (the pulses slow, mind.ts)
    if (s.busy && s.coolUntil > Date.now() && coolSaid !== s.coolUntil) {
      coolSaid = s.coolUntil;
      /* state: core.orb error */
      say(coolingWords(fmt.time(new Date(s.coolUntil))));
    }
  };
  const stateSaid = (now: ReturnType<typeof orbStateOf>): void => {
    if (now === 'offline') {
      /* state: core.orb offline */
      say(offlineWords(navigator.onLine !== false));
    } else if (now !== 'idle' && !read().includes(now)) {
      /* state: core.orb loading */
      keep(now);
      say(STATE_WORDS[now]);
    }
  };
  ui.subscribe(check);
  heavy.subscribe((s) => {
    if (s.on && !heavySaid) {
      heavySaid = true;
      say(HEAVY_WORDS);
    }
  });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0): void => void (w.__ghosty ? ((w.__ghosty.orbsay ??= orbSayState), (w.__ghosty.heavy ??= heavy)) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return {
    el,
    pressed(world) {
      // (THE SCAN and ORBIT keep a hint of their own: the Scan's `scanorbhint`, ORBIT's `orbhint`)
      if (world === 'scan' || world === 'orbit') return;
      try {
        const n = Number(localStorage.getItem(PRESSES) ?? '0') + 1;
        localStorage.setItem(PRESSES, String(n));
        if (n === 1) say(PRESS_HINT);
      } catch {
        /* storage blocked: the hint is simply not said */
      }
    },
  };
}
