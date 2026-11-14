/**
 * His PRINCIPLES (OWNER-ISSUES 64 RAISING HIM, 69b): the lines the owner writes in his own words, which Ghosty reads before he
 * acts and holds to even when pushed (the brain keeps them: GET/POST /api/profile/principles, profile.ts; prompt.ts HIS
 * PRINCIPLES). One editor, in SETTINGS → CHARACTER and in MEMORY: each line with its ✕, and a field to add one.
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, row, toast } from '../../ui/components';
import { waiting } from '../../ui/wait';
import { PRINCIPLES_EMPTY, PRINCIPLES_ERROR, PRINCIPLES_LOADING } from './words';

export function principlesEditor(): { el: HTMLElement; refresh(): void } {
  let lines: string[] = [];
  let max = 8;
  let loaded = false;
  let failed = false;
  const list = h('div.princlist');
  let host: HTMLElement;
  const input = h('input', { type: 'text', maxLength: 160, placeholder: 'A line I hold to, in your words', 'aria-label': 'A new principle', enterKeyHint: 'done' });
  const add = button('ADD', () => void save([...lines, input.value]).then((ok) => ok && (input.value = '')));
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add.click());

  const paint = () => {
    clear(
      list,
      ...(lines.length
        ? lines.map((l, i) => {
            const r = row(null, l, null, { wrap: true });
            const x = h('button.princdel', { type: 'button', 'aria-label': `Remove the line: ${l}`, title: 'Remove this line' }, '✕');
            x.addEventListener('click', () => void save(lines.filter((_, j) => j !== i)));
            r.append(x);
            return r;
          })
        : [failed ? /* state: settings.principles error */ h('p.note.bad.princerr', PRINCIPLES_ERROR) : h('p.note.princempty', /* state: settings.principles empty */ PRINCIPLES_EMPTY)]),
    );
    add.disabled = lines.length >= max;
    input.disabled = lines.length >= max;
  };

  /** The whole list, saved by the brain; this phone shows what the brain kept. In his words if it can't be saved. */
  const save = async (next: string[]): Promise<boolean> => {
    const clean = next.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (clean.join('\n') === lines.join('\n')) return false;
    try {
      const r = await brain.setPrinciples(clean);
      lines = Array.isArray(r.lines) ? r.lines : [];
      max = r.max || max;
      paint();
      return true;
    } catch (e) {
      const said = (e as { status?: number })?.status === 400 ? "I won't keep that: it looks like a password, key or card number." : "Not saved: I can't reach my brain right now; try again in a moment.";
      toast(said, 'bad');
      return false;
    }
  };

  const refresh = () => {
    // a first read says what it is doing; later reads are quiet
    /* state: settings.principles loading */
    const done = loaded ? () => undefined : waiting(host, PRINCIPLES_LOADING);
    void brain
      .principles()
      .then((r) => {
        lines = Array.isArray(r.lines) ? r.lines : lines;
        max = r.max || max;
        loaded = true;
        failed = false;
        done();
        paint();
      })
      .catch(() => {
        // offline: what is on screen stays, and with nothing on screen the line says why
        done();
        failed = !lines.length;
        paint();
      });
  };
  paint();
  host = h('div.princ', list, h('div.keyrow.wrapit', input, add));
  return { el: host, refresh };
}
