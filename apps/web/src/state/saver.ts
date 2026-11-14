/**
 * THE SAVER (NEXT ROUND, polish3.s1, reshaped): one switch that pauses heavy work until he turns it off. An iPhone web app cannot
 * read the battery or tell mobile data from Wi-Fi, so it is a switch he flips, never a guess. While it is on: no big download starts
 * (the offline packs, the offline brain, search by meaning), and the background feeds stop refreshing on their own (a tap on
 * RETRY still reads one). It says what it paused, each time something is held back.
 */
import { createStore } from '../core/store';

export const saver = createStore({ on: false, paused: [] as string[] }, { persist: 'ghosty.saver', keys: ['on'] });

/** Why a download did not start, in his words. */
export const SAVER_HELD = 'Saver is on, so big downloads wait; turn it off in Settings, Saver, to get this.';

/** True (and noted) when the saver holds `what` back. */
export function held(what: string): boolean {
  const s = saver.get();
  if (!s.on) return false;
  if (!s.paused.includes(what)) saver.set({ paused: [...s.paused, what].slice(-12) });
  return true;
}

/** Turn it on or off; off forgets what it paused. */
export function setSaver(on: boolean): void {
  saver.set({ on, paused: on ? saver.get().paused : [] });
}

/** His ways of saying it: "turn on the saver", "saver off", "pause big downloads", "resume downloads". */
export const SAVER_ASK = /^(?:(?:hey )?ghosty,? )?(?:(?:turn|switch|put) (on|off) (?:the )?saver|(?:turn|switch|put) (?:the )?saver (on|off)|(?:the )?saver (on|off)|(pause) (?:the )?(?:big )?downloads(?: and (?:the )?feeds)?|(resume|unpause) (?:the )?(?:big )?downloads)\s*(?:please)?\s*[?.!]*$/i;

/** What he asked for: on or off, or null when the words are not about the saver. */
export function saverAsked(t: string): boolean | null {
  const m = SAVER_ASK.exec(t.trim());
  if (!m) return null;
  const w = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').toLowerCase();
  return w === 'on' || w === 'pause';
}

/** Done, and said. */
export function saverTurn(t: string): string {
  const on = saverAsked(t) ?? true;
  setSaver(on);
  return on ? 'Saver is on: big downloads and the background feeds wait until you turn it off.' : 'Saver is off: downloads and the feeds run as usual.';
}
