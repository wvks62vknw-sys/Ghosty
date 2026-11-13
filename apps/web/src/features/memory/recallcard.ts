/**
 * [recall] The RECALL card's rows under a reply answered from the phone's own index (features/memory/recallturn.ts), and the
 * RECALL chip under a reply that says "like you said on Tuesday": each a tap into the turn (the log, or MEMORY's quote when the
 * log no longer has it) or into the thing (its editor). A turn's FORGET takes it out of recall here and on the brain; UNDO
 * brings it back. Every key is 44 pt (the house's `button`).
 */
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { forgetTurn, KIND_WORD, turnFor, undoForgetTurn, type ThingKind } from './recall';
import { TURN_FORGOTTEN } from './words';
import { chat } from '../../assistant/session';

type Row = { key: string; kind: string; id: string; title: string; line: string; at: number; stamp: string; day: string };

/** Open what a row found: a turn in the log, a thing in its editor. */
export async function openFound(r: Pick<Row, 'kind' | 'at' | 'line'>): Promise<void> {
  if (r.kind === 'turn') return void import('./timeline').then((m) => m.openChatAt(r.at, r.line));
  if (r.kind === 'doc') return void import('../../docs/sheet').then((m) => m.openDocs({ what: 'list' }));
  if (r.kind === 'page') return void import('../../workspace/sheet').then((m) => m.openWorkspace());
  if (r.kind === 'deck') return void import('../../slides/sheet').then((m) => m.openSlides());
  if (r.kind === 'sheet') return void import('../../sheets/sheet').then((m) => m.openSheets());
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
