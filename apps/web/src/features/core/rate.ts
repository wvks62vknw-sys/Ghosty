/**
 * 👍 / 👎 under each of Ghosty's replies (in the LOG, and in the caption on a phone): the owner's verdict goes to
 * the brain (`POST /api/training/feedback`) and the offline brain's weekly training learns from it
 * (apps/edge/src/selftrain: a 👎 gets a better reply from an online model as the preferred answer, a 👍 is kept
 * as one). Tapping the same one again takes it back. A rating is known by the reply's own words (`replyId`):
 * the chat reloaded from the brain's history gives the same reply another time stamp, never other words. The
 * ratings are remembered on this phone (`ghosty.rated`, the last 300), so they show again after a reload.
 */
import { brain } from '../../api/brain';
import { chat, type Entry } from '../../assistant/session';
import { createStore } from '../../core/store';
import { h } from '../../core/dom';
import { toast } from '../../ui/components';

type Reply = Extract<Entry, { kind: 'assistant' }>;

/** The ratings given on this phone, by reply. */
export const ratings = createStore({ map: {} as Record<string, 1 | -1> }, { persist: 'ghosty.rated' });

/** A reply's id: a hash of its words (FNV-1a, 32 bits), the same on every load. */
export function replyId(text: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return x;
}

export const ratedOf = (e: Reply): 1 | -1 | undefined => ratings.get().map[replyId(e.text.trim())];

/** The owner's message a reply answered: the nearest one before it. */
export function questionFor(entries: Entry[], reply: Reply): string {
  const i = entries.indexOf(reply) >= 0 ? entries.indexOf(reply) : entries.findIndex((e) => e.kind === 'assistant' && e.at === reply.at);
  for (let j = i - 1; j >= 0; j--) {
    const e = entries[j]!;
    if (e.kind === 'user') return e.text;
  }
  return '';
}

/** Whether a reply can be rated: a finished, kept reply with words in it (never a vehicle record shown once). */
export const rateable = (e: Reply): boolean => !!e.text.trim() && !e.once && e.text.trim() !== '…';

function setRated(id: number, v: 1 | -1 | undefined): void {
  const map = { ...ratings.get().map };
  delete map[id];
  if (v) map[id] = v;
  const keys = Object.keys(map);
  for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete map[k];
  ratings.set({ map });
}

export function rateRow(e: Reply): HTMLElement {
  const id = replyId(e.text.trim());
  const now = ratedOf(e);
  const send = (v: 1 | -1) => {
    const was = ratedOf(e);
    const next = was === v ? undefined : v;
    setRated(id, next);
    void brain.selftrain
      .rate({ at: id, up: next === undefined ? null : next === 1, question: questionFor(chat.get().entries, e), reply: e.text, ...(e.offline ? { offline: true } : {}) })
      .then(() => {
        if (next === -1) toast('Thanks — Ghosty will learn a better answer to that in its weekly training', 'ok');
      })
      .catch(() => {
        setRated(id, was);
        toast("Couldn't send that rating (no connection to the brain). Try again later.", 'warn');
      });
  };
  const up = h('button.rateb', { type: 'button', 'aria-label': 'Good reply', 'aria-pressed': String(now === 1) }, '👍');
  const down = h('button.rateb', { type: 'button', 'aria-label': 'Bad reply', 'aria-pressed': String(now === -1) }, '👎');
  // (In the caption a tap anywhere else dismisses it: these taps are the buttons' own.)
  up.addEventListener('click', (ev) => {
    ev.stopPropagation();
    send(1);
  });
  down.addEventListener('click', (ev) => {
    ev.stopPropagation();
    send(-1);
  });
  return h(`div.rate${now ? '.done' : ''}` as 'div', up, down);
}
