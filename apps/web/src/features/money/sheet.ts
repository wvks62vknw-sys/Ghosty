/**
 * THE MONEY PACK on the phone (BRIEF-PACKS-1 item 1): PASTE A STATEMENT — a box that keeps a statement's lines (the chat box
 * is one line, so a paste there loses them; packages/shared/src/money.ts `unflatten` puts them back when it can), or a file:
 * the CSV a bank gives, or its PDF (the text taken out on this phone, packages/shared/src/pdf.ts). Either way it goes to my
 * brain's SPENDING read by the rule table only — no model sees it — and comes back as the month's card in the chat: the top
 * five categories and what changed. The rest of the money pack is the brain's (tools/money.ts), in the chat.
 */
import { extractPdf } from '../../../../../packages/shared/src/pdf';
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { statementTurn } from '../../assistant/packs';
import { brain } from '../../api/brain';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, phrases, sizeWords, stateIn, stateLine, waitFor } from '../lifeui';

export const moneyState = { open: false, read: 0, reply: '' };
/** The sheet's one page, by name (its title, and its panel on the MONEY screen: features/money/index.ts). */
export const STATEMENT_TITLE = 'PASTE A STATEMENT';

export function openMoney(): void {
  const s = statementScreen();
  moneyState.open = true;
  modal(STATEMENT_TITLE, h('div.pk', { dataset: { pack: 'money', screen: 'statement' } }, s.el), () => (moneyState.open = false));
}

/** PASTE A STATEMENT's page (the sheet's, and the MONEY screen's: features/money/index.ts). */
export function statementScreen(): { el: HTMLElement; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.money = moneyState;
  const box = h('textarea.pkpaste', { rows: 8, placeholder: 'Paste the statement here: its CSV, or the text copied out of its PDF.', 'aria-label': 'Your statement, pasted' }) as HTMLTextAreaElement;
  const file = h('input', { type: 'file', accept: '.csv,.pdf,text/csv,application/pdf', 'aria-label': 'Your statement as a file (CSV or PDF)', hidden: true }) as HTMLInputElement;
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Read here by plain rules, then kept in my brain. No model sees it. No bank access, ever.');
  const slot = h('div.pkcol');
  const body = h('div.pkcol', box, file);
  // nothing kept yet (or no signal): said at the top, with the one next thing
  const top = async () => {
    if (lacksSignal()) {
      /* state: money.statement offline */
      slot.replaceChildren(stateLine('offline', 'No signal: you can paste now, and I read it when the phone is back online.'));
      return;
    }
    try {
      const kept = (await brain.spending()).kept;
      /* state: money.statement empty */
      if (!kept && !moneyState.read) slot.replaceChildren(emptyState('Nothing kept yet', 'Paste one below, or pick its CSV or PDF, and I show your month.'));
    } catch {
      /* the brain's silence is said when he reads: nothing to say here */
    }
  };
  void top();
  /** Read a statement's text. False when it could not be read (what he pasted then stays where it is). */
  const read = async (text: string): Promise<boolean> => {
    if (!text.trim()) {
      stateIn(status, '', 'Paste a statement first, or pick its file.');
      return false;
    }
    status.textContent = '';
    delete status.dataset.state;
    /* state: money.statement loading */
    const done = waitFor(body.parentElement!, 'Reading your statement…');
    try {
      const r = await statementTurn(text);
      moneyState.reply = r.reply;
      if (r.failed) {
        /* state: money.statement error */
        stateIn(status, 'error', r.reply);
        return false;
      }
      moneyState.read++;
      slot.replaceChildren();
      // the amounts are to the penny and from his statement, said so
      stateIn(status, '', `${r.reply} Every amount is from your statement.`);
      if (r.cards?.length) void import('../core/cards').then((m) => r.cards!.forEach((c) => m.postCard(c))).catch(() => undefined);
      return true;
    } finally {
      done();
    }
  };
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    const done = waitFor(body.parentElement!, `Opening ${f.name}, ${sizeWords(f.size)}…`);
    let text = '';
    try {
      text = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? (await extractPdf(new Uint8Array(await f.arrayBuffer()), f.name)).pages.join('\n') : await f.text();
    } catch (e) {
      done();
      /* state: money.statement error */
      stateIn(status, 'error', sayError(e, 'read that file'));
      return;
    }
    done();
    if (!text.trim()) {
      stateIn(status, 'error', 'There was nothing in that file I could read. Try the CSV from your bank.');
      return;
    }
    box.value = '';
    await read(text);
  });
  const go = button('Read it', () => void read(box.value).then((ok) => ok && (box.value = '')), 'on');
  go.setAttribute('aria-label', 'Read the pasted statement');
  const pick = button('Pick a file', () => file.click());
  pick.setAttribute('aria-label', 'Pick the statement as a CSV or PDF file');
  const el = h('div.pkcol', slot, body, h('div.pkrow', go, pick), status, phrases(['paste a statement']));
  return { el, stop: () => undefined };
}
