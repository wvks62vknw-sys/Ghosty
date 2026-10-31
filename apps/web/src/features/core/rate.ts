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
import { h, icon } from '../../core/dom';
import { toast } from '../../ui/components';
import { replyId, withRating } from './ratelist';

export { replyId };

type Reply = Extract<Entry, { kind: 'assistant' }>;

/** The ratings given on this phone, oldest first: [reply id, 👍 1 / 👎 −1] (a list, so "the newest 300" really are). */
export const ratings = createStore({ list: [] as [number, 1 | -1][] }, { persist: 'ghosty.rated' });

export const ratedOf = (e: Reply): 1 | -1 | undefined => {
  const id = replyId(e.text.trim());
  return (Array.isArray(ratings.get().list) ? ratings.get().list : []).find(([x]) => x === id)?.[1];
};

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
// (never a reply kept on the phone: a rating sends the question and the reply to the brain's training — OWNER-ISSUES 72)
export const rateable = (e: Reply): boolean => !!e.text.trim() && !e.once && !e.private && e.text.trim() !== '…';

function setRated(id: number, v: 1 | -1 | undefined): void {
  ratings.set({ list: withRating(Array.isArray(ratings.get().list) ? ratings.get().list : [], id, v) });
}

/** 👍 as a line glyph (👎 is the same glyph turned over, styles.css .rateb .down). */
const THUMB = '<path d="M7.5 10.5v9H4.5v-9z"/><path d="M7.5 10.5l3.6-6.3a1.6 1.6 0 012.9 1.1l-.6 4.2h5a1.8 1.8 0 011.8 2.1l-1.1 6.2a2.2 2.2 0 01-2.2 1.7H7.5"/>';

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
  // line glyphs (route C's reply card), the same buttons in every look
  const up = h('button.rateb', { type: 'button', 'aria-label': 'Good reply', title: 'Good reply', 'aria-pressed': String(now === 1) }, icon(THUMB));
  const down = h('button.rateb', { type: 'button', 'aria-label': 'Bad reply', title: 'Bad reply', 'aria-pressed': String(now === -1) }, icon(THUMB, 'ic down'));
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
