/**
 * WHAT A TURN BROUGHT (BRIEF-SHOW-ME-1): the small, DOM-free part of SHOW ME that assistant/session.ts calls. It keeps what the
 * phone saw of this turn (the tools the brain ran, the screen commands and cards it sent, the reply's words) and, when the stream
 * has ended, hands them to the Stage in a dynamic import that never holds the reply. A new word clears the Stage.
 *
 * SHOW ME's switch (Settings, `showMe`, on by default) is read by `mayShow`: off, no Stage ever.
 * Under a test runner the Stage waits for `window.__ghostyShow = true` (as the cards wait for `__ghostyCards`).
 */
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import type { Card } from '../../../../packages/shared/src/cards';
import { settings } from '../state/app';

interface Turn {
  ask: string;
  reply: string[];
  tools: { name: string; args: Record<string, unknown> }[];
  clients: { name: string; args: Record<string, unknown> }[];
  cards: Card[];
  /** The brain's own pick of the picture, when it sent one. */
  brain?: { kind: string; data: Record<string, unknown> };
}

let turn: Turn = { ask: '', reply: [], tools: [], clients: [], cards: [] };

/** What the checks read: what happened this turn and in what order ('sentence' when the reply's words landed, 'stage' when the Stage did). */
export const showTrace = { order: [] as string[], turns: 0 };

export const mayShow = (): boolean => typeof window !== 'undefined' && settings.get().showMe !== false && (!navigator.webdriver || (window as unknown as { __ghostyShow?: boolean }).__ghostyShow === true);

/** A new word from him: the Stage goes, and the turn starts empty. */
export function showBegin(ask: string): void {
  turn = { ask, reply: [], tools: [], clients: [], cards: [] };
  showTrace.order = [];
  showTrace.turns++;
  if (typeof document === 'undefined') return;
  // the last Stage goes with his word; and when his words already promise a picture (a room, a letter, a place, a formula), its room is
  // taken at once, so the sentence lands where it will stay and the Stage rises under it without moving it
  const wants = mayShow() && !!ask.trim();
  if (!wants && !document.getElementById('thestage')) return;
  void Promise.all([import('./stage'), wants ? import('./decide') : Promise.resolve(null)])
    .then(([s, d]) => {
      if (document.getElementById('thestage')) s.clearStage('his next word');
      if (d) s.prefetch();
      const kind = d ? d.predictKind(ask) : null;
      if (kind && turn.ask === ask) s.reserve(kind);
      else s.releaseRoom();
    })
    .catch(() => undefined);
}

/** Every stream event of the turn, as it arrives (cheap: nothing is drawn here). */
export function showNote(ev: ChatEvent): void {
  if (ev.t === 'tool') turn.tools.push({ name: ev.name, args: ev.args as Record<string, unknown> });
  else if (ev.t === 'client') turn.clients.push({ name: ev.name, args: (ev.args ?? {}) as Record<string, unknown> });
  else if (ev.t === 'cards') turn.cards.push(...ev.cards);
  else if (ev.t === 'show') turn.brain = { kind: ev.kind, data: ev.data };
  else if (ev.t === 'text') {
    // (the pieces of a reply drawn as it is spoken are not kept: the whole reply that follows is; the sentence is noted once)
    if (ev.part) {
      if (!showTrace.order.includes('sentence')) showTrace.order.push('sentence');
      return;
    }
    if (!ev.text) return; // pieces taken back
    turn.reply.push(ev.text);
    if (!showTrace.order.includes('sentence') || turn.reply.length > 1) showTrace.order.push('sentence');
  }
}

/** The stream has ended and the reply is on screen: the Stage is begun now, off to the side of it. */
export function showEnd(ask: string): void {
  if (!mayShow() || ask !== turn.ask) return;
  const facts = { ask, reply: turn.reply.join('\n\n'), tools: turn.tools, clients: turn.clients, cards: turn.cards, ...(turn.brain ? { brain: turn.brain } : {}) };
  void import('./stage').then((s) => s.present(facts)).catch(() => undefined);
}

// for the checks and the console: what the Stage did and decided (window.__ghosty.show), once the app's own handle is up
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) {
      w.__ghosty.show = {
        trace: showTrace,
        decide: async (f: unknown) => (await import('./decide')).decideShow(f as Parameters<typeof import('./decide').decideShow>[0]),
        state: async () => (await import('./stage')).stageState,
        present: async (f: unknown) => (await import('./stage')).present(f as Parameters<typeof import('./stage').present>[0]),
        clear: async () => (await import('./stage')).clearStage('check'),
        prefetch: async () => (await import('./stage')).prefetch(),
      };
    }
  }, 2800);
}
