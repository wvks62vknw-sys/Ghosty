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

export const moneyState = { open: false, read: 0, reply: '' };

export function openMoney(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.money = moneyState;
  const box = h('textarea.pkpaste', { rows: 8, placeholder: 'Paste the statement here: its CSV, or the text copied out of its PDF.', 'aria-label': 'Your statement, pasted' }) as HTMLTextAreaElement;
  const file = h('input', { type: 'file', accept: '.csv,.pdf,text/csv,application/pdf', 'aria-label': 'Your statement as a file (CSV or PDF)', hidden: true }) as HTMLInputElement;
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Read by code on its way to my brain, sorted by a table of rules. No AI sees it, not even the shop names. No bank access, ever.');
  const read = async (text: string) => {
    if (!text.trim()) return;
    status.textContent = 'Reading…';
    const r = await statementTurn(text);
    moneyState.reply = r.reply;
    moneyState.read++;
    status.textContent = r.reply;
    if (r.cards?.length) void import('../core/cards').then((m) => r.cards!.forEach((c) => m.postCard(c))).catch(() => undefined);
  };
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const text = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? (await extractPdf(new Uint8Array(await f.arrayBuffer()), f.name)).pages.join('\n') : await f.text();
      box.value = '';
      await read(text);
    } catch (e) {
      status.textContent = `I couldn’t read that file: ${(e as Error).message}.`;
    }
  });
  const go = button('Read it', () => void read(box.value).then(() => (box.value = '')), 'on');
  go.setAttribute('aria-label', 'Read the pasted statement');
  const pick = button('Pick a file', () => file.click());
  pick.setAttribute('aria-label', 'Pick the statement as a CSV or PDF file');
  moneyState.open = true;
  modal('PASTE A STATEMENT', h('div.pk', { dataset: { pack: 'money', screen: 'statement' } }, h('div.pkcol', box, file, h('div.pkrow', go, pick), status)), () => (moneyState.open = false));
}
