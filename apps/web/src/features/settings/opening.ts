/**
 * THE OPENING (NEXT ROUND boot.u4, boot.s9, boot.u9, boot.s7): Settings → Voice & home, under the boot's score.
 *  - HOW LONG: the whole film every time, the short cut every time, or the whole film on the day's first open (shell/bootwords.ts LENGTHS).
 *  - YOUR OPENING LINE: what the opening greets him with, one a line, several taking turns; empty, the greeting by the hour.
 *  - HOW THE LAST ONE RAN: the cut, its length, its frame rate and its longest pause, as this phone measured it.
 *  - A GUEST: who the next opening greets ("Sam's turn"), with a key to cancel it.
 * All of it is kept on this phone; nothing is sent.
 */
import { h } from '../../core/dom';
import { settings } from '../../state/app';
import { button } from '../../ui/components';
import { LENGTHS, LINE_MAX, LINES_MAX, runWords, type BootLength } from '../../shell/bootwords';
import { director, lastRun } from '../../shell/boot';

export function openingControls(): { nodes: HTMLElement[]; paint: () => void } {
  const keys = LENGTHS.map((l) => {
    const b = button(l.label, () => settings.set({ bootLength: l.key }));
    b.setAttribute('role', 'radio');
    b.dataset.length = l.key;
    return b;
  });
  const row = h('div.keyrow.openlen', { role: 'radiogroup', 'aria-label': 'How long the opening is', dataset: { id: 'bootlength' } }, ...keys);
  const line = h('p.note.openline', { dataset: { case: 'keep' } });
  const lines = h('textarea.openown', { rows: 3, maxLength: LINE_MAX * LINES_MAX + LINES_MAX, placeholder: 'Leave empty for my greeting by the hour. One line each: several take turns.', 'aria-label': 'Your opening line' }) as HTMLTextAreaElement;
  const save = () => settings.set({ bootLines: lines.value });
  lines.addEventListener('change', save);
  lines.addEventListener('blur', save);
  const run = h('p.note.openrun', { dataset: { case: 'keep', id: 'bootrun' }, role: 'status' });
  const guestLine = h('p.note.openguest', { dataset: { case: 'keep' } });
  const noGuest = button('NO GUEST', () => settings.set({ bootGuest: { name: '', until: 0 } }));
  const guest = h('div.keyrow.openguestrow', guestLine, noGuest);
  const paint = () => {
    const s = settings.get();
    const now: BootLength = s.bootLength ?? 'full';
    for (const b of keys) {
      const on = b.dataset.length === now;
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('on', on);
    }
    line.textContent = LENGTHS.find((l) => l.key === now)?.line ?? '';
    if (document.activeElement !== lines) lines.value = s.bootLines ?? '';
    run.textContent = runWords(lastRun());
    const g = s.bootGuest && s.bootGuest.until > Date.now() ? s.bootGuest.name : '';
    guest.hidden = !g;
    guestLine.textContent = g ? `The next opening greets ${g}.` : '';
  };
  paint();
  settings.subscribe(paint);
  const step = button('STEP THROUGH IT', () => void director());
  step.dataset.id = 'bootdirector';
  return { nodes: [h('div.lab', 'THE OPENING'), row, line, h('div.lab', 'YOUR OPENING LINE'), lines, guest, h('div.lab', 'HOW THE LAST OPENING RAN'), run, h('div.keyrow', step)], paint };
}
