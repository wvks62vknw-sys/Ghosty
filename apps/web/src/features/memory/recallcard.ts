/**
 * [recall] The RECALL card's rows under a reply answered from the phone's own index (features/memory/recallturn.ts), and the
 * RECALL chip under a reply that says "like you said on Tuesday": each a tap into the turn (the log, or MEMORY's quote when the
 * log no longer has it) or into the thing (its editor). A turn's FORGET takes it out of recall here and on the brain; UNDO
 * brings it back. Every key is 44 pt (the house's `button`).
 */
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { forgetTurn, foundState, KIND_WORD, turnFor, undoForgetTurn, type ThingKind } from './recall';
import { TURN_FORGOTTEN } from './words';
import { chat } from '../../assistant/session';

type Row = { key: string; kind: string; id: string; title: string; line: string; at: number; stamp: string; day: string; bid?: string };



/** The block a tap landed on: brought to the middle of the screen and lit a moment (the editors draw their blocks with data-id). */
function land(bid: string): void {
  let tries = 0;
  const look = () => {
    const el = document.querySelector<HTMLElement>(`.dcb[data-id="${CSS.escape(bid)}"], .wsblock[data-id="${CSS.escape(bid)}"]`);
    if (!el) return void (++tries < 30 && setTimeout(look, 100));
    el.scrollIntoView({ block: 'center' });
    el.classList.add('found');
    setTimeout(() => el.classList.remove('found'), 2600);
    foundState.landed = true;
  };
  look();
}

/** Open what a row found: a turn in the log, a thing in its own editor at its line. */
export async function openFound(r: Pick<Row, 'kind' | 'at' | 'line' | 'id'> & { bid?: string }): Promise<void> {
  Object.assign(foundState, { kind: r.kind, id: r.id, bid: r.bid ?? '', landed: false });
  if (r.kind === 'turn') return void import('./timeline').then((m) => m.openChatAt(r.at, r.line));
  if (r.kind === 'doc') await import('../../docs/sheet').then((m) => m.openDocs({ id: r.id }));
  else if (r.kind === 'page') await import('../../workspace/sheet').then((m) => m.openWorkspace({ id: r.id }));
  else if (r.kind === 'deck') await import('../../slides/sheet').then((m) => m.openSlides({ id: r.id }));
  else if (r.kind === 'sheet') await import('../../sheets/sheet').then((m) => m.openSheets({ id: r.id }));
  if (r.bid) land(r.bid);
}

export function recallRows(rows: Row[]): HTMLElement {
  const box = h('div.recallcard', { dataset: { case: 'keep' } });
  for (const r of rows) {
    const what = r.kind === 'turn' ? `${r.stamp}` : `${KIND_WORD[r.kind as ThingKind] ?? 'Thing'} · ${r.title}`;
    const open = button(`${what} — ${r.line.slice(0, 90)}`, () => void openFound(r), 'recallgo');
    open.dataset.case = 'keep';
    open.dataset.key = r.key;
    open.setAttribute('aria-label', `Open ${r.kind === 'turn' ? `the chat of ${r.day}` : r.title}`);
    const row = h('div.row.recallrow', { dataset: { key: r.key, kind: r.kind } }, open);
    if (r.kind === 'turn') {
      const forget = button('FORGET', async (b) => {
        b.disabled = true;
        await forgetTurn(r);
        open.disabled = true;
        open.classList.add('struck');
        toast(TURN_FORGOTTEN, 'ok');
        const undo = button('UNDO', async (u) => {
          u.disabled = true;
          await undoForgetTurn(r);
          open.disabled = false;
          open.classList.remove('struck');
          u.replaceWith(forget);
          forget.disabled = false;
        }, 'recallundo');
        undo.dataset.case = 'keep';
        b.replaceWith(undo);
      }, 'recallforget');
      forget.dataset.case = 'keep';
      forget.setAttribute('aria-label', `Forget the turn of ${r.day}`);
      row.append(forget);
    }
    box.append(row);
  }
  return box;
}

/** The RECALL chip under a reply that says "like you said on Tuesday": filled in once the turn it means is found on this phone. */
export function recallChip(reply: string, at: number): HTMLElement | null {
  if (!/\b(?:like|as) you (?:said|asked|mentioned|told me)\b|\byou (?:said|asked|mentioned|told me)\b.*\b(?:yesterday|last week|on (?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i.test(reply)) return null;
  const slot = h('div.row.recallchip', { dataset: { case: 'keep' } });
  // the question this reply answered: his message just before it
  const mine = [...chat.get().entries].reverse().find((x): x is Extract<typeof x, { kind: 'user' }> => x.kind === 'user' && x.at <= at);
  const question = mine?.text ?? '';
  void turnFor(reply, question).then((t) => {
    if (!t) return slot.remove();
    const b = button(`RECALL · ${t.day[0]!.toUpperCase()}${t.day.slice(1)}`, () => void openFound(t), 'on');
    b.dataset.case = 'keep';
    b.classList.add('recallchipkey');
    b.setAttribute('aria-label', `Open what you said ${t.day}`);
    slot.append(b);
  }).catch(() => slot.remove());
  return slot;
}

/** [keep] The open promises under "what did I say I'd do?": a 44 pt DONE each, with UNDO (the brain keeps them: features/memory/keep.ts). */
export function promiseRows(list: { id: string; what: string; due: string }[]): HTMLElement {
  const box = h('div.recallcard.keepcard', { dataset: { case: 'keep' } });
  for (const p of list) {
    const done = button('DONE', async (b) => {
      b.disabled = true;
      const k = await import('./keep');
      if (await k.changeKeep('done', p.id)) {
        row.classList.add('kept');
        b.replaceWith(h('span.note', 'Done.'));
        toast(`Done: ${p.what}.`, 'ok');
      } else b.disabled = false;
    }, 'on recallforget');
    done.dataset.case = 'keep';
    done.setAttribute('aria-label', `Done: ${p.what}`);
    const row = h('div.row.recallrow', { dataset: { id: p.id, kind: 'promise' } }, h('span.recallgo.keepline', `${p.what}${p.due ? ` · ${p.due}` : ''}`), done);
    box.append(row);
  }
  return box;
}
