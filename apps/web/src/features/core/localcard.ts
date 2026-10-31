/**
 * The buttons under a reply answered on the phone from what Ghosty knows of himself (assistant/local.ts): GO to what was
 * found (the screen, a command, or — for the brain's — DO IT, which sends his words to the brain as the request he may
 * have meant), and the offer "want me to learn it?" as YES / NO. YES makes it a learning goal; NO just closes.
 */
import { go } from '../../abilities/registry';
import { abilityById, learnIt, setLearn } from '../../assistant/local';
import { send, type Entry } from '../../assistant/session';
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { navTo } from '../../shell/areas';

export function localRow(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement | null {
  const l = e.local;
  if (!l) return null;
  const row = h('div.row.wrap.localacts', { dataset: { case: 'keep' } });
  for (const g of l.go ?? []) {
    if (g.open) {
      const b = button(g.label, () => navTo(g.open!, 'push'));
      b.dataset.case = 'keep';
      b.classList.add('localgo');
      row.append(b);
      continue;
    }
    const a = abilityById(g.id);
    if (!a) continue;
    const doIt = a.from === 'brain' && !a.off;
    const b = button(g.label, () => (doIt && l.doIt ? void send(l.doIt, { plain: true }) : go(a, g.ask)), doIt ? 'on' : '');
    b.dataset.case = 'keep';
    b.dataset.id = a.id;
    b.classList.add('localgo');
    row.append(b);
  }
  const learn = l.learn;
  if (learn?.state === 'open') {
    const yes = button('Yes, learn it', async (b) => {
      b.disabled = true;
      if (!(await learnIt(e.at))) {
        b.disabled = false;
        toast('I couldn’t reach my brain to note it. Try again when you’re back online.', 'warn');
      }
    }, 'on');
    yes.dataset.case = 'keep';
    yes.classList.add('learnyes');
    const no = button('No', () => setLearn(e.at, 'no'));
    no.dataset.case = 'keep';
    no.classList.add('learnno');
    row.append(yes, no);
  } else if (learn?.state === 'yes') row.append(h('span.note.learned', 'On my learning list. I’ll work on it: Abilities → Learning.'));
  return row.childElementCount ? row : null;
}
