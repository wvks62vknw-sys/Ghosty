/**
 * SEE WHAT A RESTORE BRINGS BACK (NEXT ROUND, polish3.u4): before anything is written, a sheet lists each thing in the backup and
 * what a restore would do with it (comes back, is joined with this phone's with the newer of each part winning, or is already the
 * same here), each one ticked or not by him. RESTORE puts back only what is ticked; KEEP IT changes nothing.
 */
import type { SealedBackup } from '../../api/brain';
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { previewSealed, type PreviewItem } from './backup';

export const PREVIEW_WORDS = {
  restored: 'Comes back from the backup',
  merged: 'Joined with this phone’s: the newer of each part wins',
  same: 'Already the same here',
  lead: 'Untick anything you would rather keep as it is here; nothing is deleted either way.',
  none: 'Everything in that backup is already on this phone.',
  go: (n: number) => (n ? `RESTORE ${n} ${n === 1 ? 'THING' : 'THINGS'}` : 'NOTHING TO RESTORE'),
};

/** The sheet: resolves with the keys he left unticked (left as they are here), or null when he kept everything as it is. */
export async function chooseRestore(sealed: SealedBackup, title: string): Promise<Set<string> | null> {
  const { items } = await previewSealed(sealed);
  return new Promise((resolve) => {
    const leave = new Set<string>();
    let answer: Set<string> | null = null;
    const todo = items.filter((x) => x.result !== 'same');
    const go = button(PREVIEW_WORDS.go(todo.length), () => {
      answer = leave;
      m.close();
    }, 'warn sureyes');
    go.disabled = !todo.length;
    const count = () => {
      const n = todo.filter((x) => !leave.has(x.key)).length;
      go.textContent = PREVIEW_WORDS.go(n);
      go.disabled = !n;
    };
    const rowOf = (x: PreviewItem) => {
      const said = h('small', PREVIEW_WORDS[x.result]);
      if (x.result === 'same') return h('div.rpitem.same', { dataset: { key: x.key, result: x.result, case: 'keep' } }, h('span.rpwords', h('b', x.label), said));
      const el = h('button.rpitem', { type: 'button', role: 'switch', 'aria-checked': 'true', dataset: { key: x.key, result: x.result, case: 'keep' } }, h('span.rpwords', h('b', x.label), said), h('i.setknob', { 'aria-hidden': 'true' }));
      el.addEventListener('click', () => {
        const on = leave.has(x.key);
        if (on) leave.delete(x.key);
        else leave.add(x.key);
        el.setAttribute('aria-checked', String(on));
        count();
      });
      return el;
    };
    const m = modal(title, h('div.confirm.sure.rpsheet', h('p.note', todo.length ? PREVIEW_WORDS.lead : PREVIEW_WORDS.none), h('div.rplist', ...items.map(rowOf)), h('div.row', button('KEEP IT', () => m.close()), go)), () => resolve(answer));
  });
}
