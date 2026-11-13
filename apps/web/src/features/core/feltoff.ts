/**
 * "THAT FELT OFF" (BRIEF-RELIABILITY 5; SMALL-GAPS section 3): one key, on any reply (beside 👍 and 👎), in the WHY sheet and, on
 * any other screen, a long press on the house line. One tap files a moment: the screen, what he had just done (his last three
 * moves, in words), what was on the screen (the visible words, trimmed to 600 characters; never a picture, never the camera, never a
 * face, never another person's message), the health marks at that moment and the hour, with one line of his own if he adds it.
 * It goes to the brain (POST /guardian/feltoff, kept: the last 300; listed at SYSTEM → HEALTH → FELT OFF; counted in the Sunday
 * note) and, tapped on a reply, counts as a 👎 for it through rate.ts's own path. With no brain to reach it is kept on this phone
 * and sent when the brain is back, said once.
 */
import { FELT_TEXT, type FeltMoment } from '../../../../../packages/shared/src/health';
import { allMarked } from '../../abilities/health';
import { screenName } from '../../abilities/registry';
import { brain } from '../../api/brain';
import { chat, type Entry } from '../../assistant/session';
import { h } from '../../core/dom';
import { ui } from '../../state/app';
import { button, modal, toast } from '../../ui/components';
import { trail } from '../../ui/hisWords';
import { ratedOf, rateReply } from './rate';

type Reply = Extract<Entry, { kind: 'assistant' }>;

// ---------------------------------------------------------------- what he had just done

/** His last three moves, in words (a screen opened, a thing asked): kept in memory, newest last. */
const did: string[] = [];
const note = (words: string) => {
  if (did[did.length - 1] === words) return;
  did.push(words);
  if (did.length > 3) did.shift();
};
let lastTab = ui.get().tab;
ui.subscribe((s) => {
  if (s.tab === lastTab) return;
  lastTab = s.tab;
  note(`opened ${screenName(s.tab)}`);
});
let seenUsers = chat.get().entries.filter((e) => e.kind === 'user').length;
chat.subscribe((s) => {
  const users = s.entries.filter((e): e is Extract<Entry, { kind: 'user' }> => e.kind === 'user');
  if (users.length > seenUsers) {
    // his own words only, and only if they were not private
    const last = users[users.length - 1]!;
    if (!last.private) note(`asked “${last.text.replace(/\s+/g, ' ').slice(0, 60)}”`);
  }
  seenUsers = users.length;
});

// ---------------------------------------------------------------- what is on the screen

/** Screens whose words are other people's (an email, a post, a person): their words are never taken, only that he was there. */
const OTHERS = new Set(['links', 'social', 'people']);

/** The visible words of the screen he is on, trimmed to 600 characters. Nothing but text: no picture, no canvas, no camera, no face. */
export function visibleWords(max = FELT_TEXT): string {
  const tab = ui.get().tab;
  if (OTHERS.has(tab)) return '';
  const core = tab === 'core';
  const roots = core ? [...document.querySelectorAll<HTMLElement>('.hud.core .log .msg, .hud.core #ccap')] : [document.querySelector<HTMLElement>(`#pg-${tab}`) ?? document.body];
  const out: string[] = [];
  const vh = innerHeight;
  const vw = innerWidth;
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const text = (t.textContent ?? '').replace(/\s+/g, ' ').trim();
      const el = t.parentElement;
      if (!text || !el || el.closest('.modal, script, style, textarea, input, canvas, [hidden]')) continue;
      // the chat's words are the whole conversation on screen (it scrolls); any other screen, only what the glass shows
      if (!core) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      }
      out.push(text);
    }
  }
  // the newest words are the ones he means
  return out.join(' ').slice(-max);
}

// ---------------------------------------------------------------- filing it

const QUEUE = 'ghosty.feltoff.queue';
const readQ = (): Record<string, unknown>[] => {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
};
const writeQ = (q: Record<string, unknown>[]) => {
  try {
    localStorage.setItem(QUEUE, JSON.stringify(q.slice(-40)));
  } catch {
    /* storage unavailable: it was sent, or it is lost */
  }
};
let said = false;

/** Send what waited on the phone (when the brain is back). Returns how many went. */
export async function flushFelt(): Promise<number> {
  const q = readQ();
  let sent = 0;
  for (const m of q) {
    try {
      await brain.feltOff(m);
      sent++;
    } catch (e) {
      trail(e, 'send a moment');
      break;
    }
  }
  if (sent) writeQ(q.slice(sent));
  return sent;
}
if (typeof addEventListener === 'function') addEventListener('online', () => void flushFelt());

/** The moment as the brain keeps it (words only). */
export function momentNow(words: string, reply?: Reply): Omit<FeltMoment, 'id' | 'at'> {
  return {
    screen: ui.get().tab,
    did: [...did],
    text: visibleWords(),
    marks: Object.fromEntries(allMarked().map((x) => [x.a.id, x.m.mark])),
    hour: new Date().getHours(),
    ...(words ? { words } : {}),
    ...(reply ? { reply: reply.text.replace(/\s+/g, ' ').slice(0, 120) } : {}),
  };
}

/** File it. Kept on the phone and said once when the brain cannot be reached. */
export async function fileMoment(m: Omit<FeltMoment, 'id' | 'at'>): Promise<'sent' | 'kept'> {
  try {
    await brain.feltOff(m);
    void flushFelt();
    return 'sent';
  } catch (e) {
    trail(e, 'send a moment');
    writeQ([...readQ(), m as unknown as Record<string, unknown>]);
    if (!said) {
      said = true;
      toast('Kept on your phone. I will send it when I can reach my brain.', 'ok');
    }
    return 'kept';
  }
}

/** The sheet: what will be kept, one line of his own words, SEND. `captured`: the moment taken when he tapped, before the sheet covered the screen. */
export function feltSheet(o: { reply?: Reply; screen?: string; words?: string } = {}): void {
  const captured = { ...momentNow('', o.reply), ...(o.screen ? { screen: o.screen } : {}) };
  const box = h('textarea.feltwords', { rows: 3, placeholder: 'What felt off? A few words, if you like.', 'aria-label': 'What felt off, in your own words (optional)', maxlength: '300' });
  box.value = o.words ?? '';
  const body = h('div.feltbody', { dataset: { case: 'keep' } },
    h('p.note', 'I keep which screen this was, your last three moves, the words on the screen, how my abilities were doing and the hour. No picture, no camera, no faces, and nothing anyone else wrote to you.'),
    box);
  let m: { close(): void };
  const send = button('SEND', (b) => {
    b.disabled = true;
    const moment = { ...captured, ...(box.value.trim() ? { words: box.value.trim().slice(0, 300) } : {}) };
    // it counts as a 👎 for the reply it was tapped on, through the one path (rate.ts), once
    if (o.reply && ratedOf(o.reply) !== -1) rateReply(o.reply, -1);
    void fileMoment(moment).then((r) => {
      if (r === 'sent') toast('Kept. Thank you: I will look at it.', 'ok');
      m.close();
    });
  }, 'on feltsend');
  body.append(h('div.row.feltrow', send, button('NOT NOW', () => m.close())));
  m = modal('That felt off', body);
  const title = [...document.querySelectorAll<HTMLElement>('.modal .mhead b')].at(-1);
  if (title) title.dataset.case = 'keep';
}

/** The key. On a reply it counts as a 👎 for it as well. */
export function feltKey(o: { reply?: Reply } = {}): HTMLButtonElement {
  const b = h('button.feltb', { type: 'button', 'aria-label': 'That felt off: tell me what', title: 'That felt off', dataset: { case: 'keep' } }, 'THAT FELT OFF');
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    feltSheet(o);
  });
  return b;
}

/** A long press on `el` (the house line) opens the sheet; the lift that ends it is not a tap. */
export function holdForFelt(el: HTMLElement, ms = 600): void {
  let timer = 0;
  let from = { x: 0, y: 0 };
  let fired = false;
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    from = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      fired = true;
      feltSheet();
    }, ms);
  });
  el.addEventListener('pointermove', (e) => Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10 && clearTimeout(timer));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(timer));
  el.addEventListener('click', (e) => {
    if (!fired) return;
    fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
}
