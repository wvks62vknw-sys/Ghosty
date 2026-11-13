/**
 * THE MARKED CHANGES (BRIEF-KERNEL-3): what the brain's tools proposed to the open editor, shown with the old words struck and the
 * new beside them (the documents' own look), ACCEPT applies one and REJECT leaves everything as it was. The bar holds the list and
 * nothing else: the editor gives each proposal the function that applies it (one undo step there), so nothing is ever applied here.
 * `ask` is the box with ASK GHOSTY: his words, the proposals back, the words said in `say`.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { sayError } from '../ui/hisWords';
import { wordDiff } from '../docs/model';
import type { WorkKind } from '../../../../packages/shared/src/openwork';
import { askWork } from './ask';

export interface Pending {
  /** What it does, in a line he reads ("Slide 3's title: shorter"). */
  line: string;
  /** The words before and after, when the change is words (shown struck and beside). */
  old?: string;
  now?: string;
  /** Applied by his tap; may be a whole editor action (it runs on his phone as he asked). */
  accept(): void | Promise<void>;
  /** What is said after ACCEPT: left out, "Accepted. UNDO takes it back."; '' when the action says its own words. */
  said?: string;
  /** Marks or unmarks what the change is about, in the editor itself. */
  mark?(on: boolean): void;
}
export interface Bar {
  el: HTMLElement;
  add(p: Pending): void;
  clear(): void;
  count(): number;
  list(): { line: string; old: string; now: string }[];
}

export function proposalBar(onChange: () => void = () => undefined, said: (words: string) => void = () => undefined): Bar {
  const el = h('div.dcsugs.gkprops', { 'aria-live': 'polite' });
  let items: Pending[] = [];
  const draw = (): void => {
    if (!items.length) clear(el);
    else {
      clear(el,
        h('div.dcsughead', h('b', `${items.length} marked change${items.length === 1 ? '' : 's'} from Ghosty`), h('small', 'Nothing changes until you accept it.')),
        ...items.map((p) => h('div.dcsug.gkprop', { dataset: { line: p.line } },
          h('small.gkline', p.line),
          p.old !== undefined && p.now !== undefined ? h('p.dcdiff', ...wordDiff(p.old, p.now).map((x) => (x.gone !== undefined ? h('del', x.gone) : x.came !== undefined ? h('ins', x.came) : document.createTextNode(x.same ?? '')))) : null,
          h('div.dcrow',
            button('ACCEPT', () => {
              items = items.filter((x) => x !== p);
              p.mark?.(false);
              draw();
              Promise.resolve()
                .then(() => p.accept())
                .then(() => (p.said === '' ? undefined : said(p.said ?? 'Accepted. UNDO takes it back.')))
                .catch((e) => said(sayError(e, 'make that change')))
                .finally(onChange);
            }, 'on'),
            button('REJECT', () => {
              items = items.filter((x) => x !== p);
              p.mark?.(false);
              draw();
              said('Left as it was.');
              onChange();
            }),
          ),
        )),
      );
      for (const p of items) p.mark?.(true);
    }
    onChange();
  };
  return {
    el,
    add(p) {
      items.push(p);
      draw();
    },
    clear() {
      for (const p of items) p.mark?.(false);
      items = [];
      draw();
    },
    count: () => items.length,
    list: () => items.map((p) => ({ line: p.line, old: p.old ?? '', now: p.now ?? '' })),
  };
}

/** The ASK GHOSTY box of an editor: `what` is the noun in its label ("the deck"), `data` the editor's reading, `propose` takes each change. */
export function askBox(kind: WorkKind, what: string, data: () => string, propose: (a: Record<string, unknown>) => string, say: (words: string) => void, before: () => void = () => undefined): HTMLElement {
  const input = h('input', { type: 'text', 'aria-label': `What Ghosty should change in ${what}`, placeholder: 'Say what to change, e.g. “make slide three’s title shorter”', autocomplete: 'off' }) as HTMLInputElement;
  const run = async (): Promise<void> => {
    const words = input.value.trim();
    if (!words) return say(`Say what to change first.`);
    before();
    say(`Asking my brain. It reads ${what} as the message’s data and can only mark a change here; nothing changes until you accept it.`);
    try {
      const r = await askWork(kind, words, data(), (a) => void propose(a));
      input.value = '';
      say(r.proposed ? `${r.proposed} change${r.proposed === 1 ? '' : 's'} marked: accept or reject ${r.proposed === 1 ? 'it' : 'each'}.${r.text ? ` ${r.text}` : ''}` : r.text || 'My brain made no change.');
    } catch (e) {
      say(sayError(e, 'ask'));
    }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void run());
  return h('div.dcasks.gkask', h('small.cvgh', 'ASK GHOSTY'), h('div.dcrow', input), h('div.dcrow', button('ASK GHOSTY', () => void run(), 'on')));
}
