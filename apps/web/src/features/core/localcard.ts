/**
 * The buttons under a reply answered on the phone from what Ghosty knows of himself (assistant/local.ts): GO to what was
 * found (the screen, a command, or — for the brain's — DO IT, which sends his words to the brain as the request he may
 * have meant), and the offer "want me to learn it?" as YES / NO. YES makes it a learning goal; NO just closes.
 */
import { go, intoChat } from '../../abilities/registry';
import { markFor } from '../../abilities/health';
import { perform } from '../../shell/launcher';
import { abilityById, learnIt, setLearn } from '../../assistant/local';
import { send, type Entry } from '../../assistant/session';
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { speak, stopSpeaking } from '../../assistant/voice';
import { ui } from '../../state/app';
import { navTo } from '../../shell/areas';
import { promiseRows, recallRows } from '../memory/recallcard';

export function localRow(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement | null {
  const l = e.local;
  if (!l) return null;
  const row = h('div.row.wrap.localacts', { dataset: { case: 'keep' } });
  // [recall] the RECALL card: the turns or things found on this phone, each a tap into it (features/memory/recallcard.ts)
  if (l.found?.length) row.append(recallRows(l.found));
  // [keep] "what did I say I'd do?": each open promise with DONE (features/memory/keep.ts)
  if (l.promises?.length) row.append(promiseRows(l.promises));
  // [health] the mark of the ability it found, one word after its line (abilities/health.ts)
  const top = (l.kind === 'can' || l.kind === 'offer') && l.go?.[0] ? abilityById(l.go[0].id) : null;
  if (top) row.append(h('span.g-truth.hmark', { dataset: { case: 'keep', mark: markFor(top).mark } }, markFor(top).mark));
  for (const g of l.go ?? []) {
    if (g.open || g.run || g.words != null || g.send) {
      // [voice lane] `send`: the key says his answer for him (one of two meanings he was asked between)
      const b = button(g.label, () => (g.send ? void send(g.send) : g.open ? (g.panel ? perform({ open: g.open, panel: g.panel }) : navTo(g.open, 'push')) : g.run ? perform({ run: g.run, args: g.args ?? {} }) : intoChat(g.words ?? '')));
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
  // [lifeeasier] READ IT TO ME under "teach me what you learned this week": the phone's own voice reads the five sentences; a second tap stops it
  if (l.read) {
    const read = button('READ IT TO ME', (b) => {
      if (ui.get().voice === 'speaking') return void stopSpeaking();
      b.textContent = 'STOP';
      void speak(l.read!).finally(() => (b.textContent = 'READ IT TO ME'));
    }, 'on');
    read.dataset.case = 'keep';
    read.classList.add('localgo', 'localread');
    read.setAttribute('aria-label', 'Read this to me aloud');
    row.append(read);
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
  } else if (learn?.state === 'yes') row.append(h('span.note.learned', 'On my learning list, and drafted as a job: Workshop → Ideas. Nothing is built until you tap SHIP IT.'));
  return row.childElementCount ? row : null;
}
