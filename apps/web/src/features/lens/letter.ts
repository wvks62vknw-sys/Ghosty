/**
 * THE PHOTOGRAPHED LETTER (BRIEF-OCT-IDEAS-2 6), in THE ONE LENS (no mode key): when the words the Lens just read look like a letter
 * or a bill (a date still to come, an amount, "by", "due", "appointment", "reference": packages/shared/src/lifeeasier.ts
 * `letterOf`), the WHAT IT SAYS plate offers two keys under its words:
 *   REMIND  makes a reminder in the agenda for the morning of the date found: he confirms the date in one tap first, and can change it;
 *   FILE    keeps the read text in the library, titled with the sender's name and the day it was filed.
 * Both happen on the phone and the brain that already keeps his agenda and library; the picture never leaves the phone, and the
 * text is read by the Lens's own reader exactly as before.
 */
import { letterOf, longDay, type LetterRead } from '../../../../../packages/shared/src/lifeeasier';
import { brain } from '../../api/brain';
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { isoDay } from '../brief/day';

/** What a spec reads: window.__ghosty.letter. */
export const letterState = { offered: false, kind: '', date: '', sender: '', amount: '', reminded: '', filed: '' };

/** When a reminder for `date` (YYYY-MM-DD) goes off: nine in his morning, or two minutes on when today's nine has gone. */
export function remindAt(date: string, now = Date.now()): number {
  const at = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 9, 0).getTime();
  return at > now ? at : now + 2 * 60_000;
}

/** The one line a letter's reminder says: who it is from, what it asks, the reference when it has one. */
export function remindWords(l: LetterRead): string {
  const what = l.kind === 'bill' ? `a bill${l.amount ? ` for ${l.amount}` : ''}` : `a letter${l.amount ? ` about ${l.amount}` : ''}`;
  return `${l.sender}: ${what}${l.dateText ? ` (${l.dateText})` : ''}${l.reference ? `, reference ${l.reference}` : ''}. Read by the Lens.`;
}

/** The keys under the plate's words, or null when the words are no letter. `file`: the Lens's own saveNote. */
export function letterKeys(text: string, file: (title: string, text: string) => Promise<boolean>, now = Date.now()): HTMLElement | null {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.letter = letterState;
  const today = isoDay(new Date(now));
  const l = letterOf(text, today);
  letterState.offered = !!l;
  letterState.kind = l?.kind ?? '';
  letterState.date = l?.date ?? '';
  letterState.sender = l?.sender ?? '';
  letterState.amount = l?.amount ?? '';
  if (!l) return null;
  const keys: HTMLElement[] = [];
  if (l.date) {
    const b = button('REMIND', () => confirmDate(l), 'lp-act');
    b.setAttribute('aria-label', `Remind me about this on ${longDay(l.date)}`);
    b.dataset.label = 'Remind';
    keys.push(b);
  }
  const f = button('FILE', async (btn) => {
    btn.disabled = true;
    const title = `${l.sender} · ${longDay(isoDay(new Date()))}`;
    if (await file(title, text)) {
      letterState.filed = title;
      btn.textContent = 'FILED';
    } else btn.disabled = false;
  }, 'lp-act');
  f.setAttribute('aria-label', `File this ${l.kind} in the library under ${l.sender}`);
  f.dataset.label = 'File';
  keys.push(f);
  const said = `${l.kind === 'bill' ? 'A BILL' : 'A LETTER'} · ${l.sender.toUpperCase().slice(0, 24)}${l.amount ? ` · ${l.amount}` : ''}${l.date ? ` · BY ${longDay(l.date).toUpperCase()}` : ''}`;
  return h('div.lp-offer', { dataset: { case: 'keep' } }, h('p.lp-small', said), h('div.lp-acts', ...keys));
}

/** REMIND's one tap: the date found, in a field he can change, and one key to confirm it. */
function confirmDate(l: LetterRead): void {
  const field = h('input.lp-date', { type: 'date', 'aria-label': 'The day to remind you' }) as HTMLInputElement;
  field.value = l.date ?? '';
  const msg = h('small.note', { role: 'status', 'aria-live': 'polite' }, `I found ${l.dateText || 'this date'} in it. I’ll remind you at nine that morning.`);
  const ok = button('REMIND ME', async (b) => {
    if (!field.value) {
      msg.textContent = 'Pick the day first.';
      return;
    }
    b.disabled = true;
    msg.textContent = 'Putting it in your agenda…';
    try {
      await brain.addJob({ kind: 'reminder', title: l.sender.slice(0, 60), text: remindWords(l), at: remindAt(field.value), repeat: 'none' });
      letterState.reminded = field.value;
      toast(`I’ll remind you on ${longDay(field.value)}, at nine.`, 'ok');
      sheet.close();
    } catch {
      b.disabled = false;
      msg.textContent = 'I couldn’t reach my brain to set it. Your words are still here: tap REMIND ME to try again.';
    }
  }, 'on');
  const no = button('CANCEL', () => sheet.close());
  const sheet = modal('Remind you about this?', h('div.lpsheet', h('p.lp-sheetwho', `${l.sender}${l.amount ? ` · ${l.amount}` : ''}`), field, msg, h('div.row', ok, no)));
}
