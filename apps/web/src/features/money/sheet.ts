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

export const moneyState = { open: false, read: 0, reply: '', nudge: false, batch: [] as string[] };
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
  const box = h('textarea.pkpaste', { rows: 8, placeholder: 'Paste the statement here: its CSV, OFX or QIF, or the text copied out of its PDF.', 'aria-label': 'Your statement, pasted' }) as HTMLTextAreaElement;
  // [moneyapps] many statements at once: every big UK bank's CSV, OFX, QIF or PDF (each read here or by plain rules in my brain)
  const file = h('input', { type: 'file', multiple: true, accept: '.csv,.pdf,.ofx,.qfx,.qif,.txt,text/csv,application/pdf,application/x-ofx,application/qif', 'aria-label': 'Your statements as files (CSV, OFX, QIF or PDF)', hidden: true }) as HTMLInputElement;
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
  /** A file's text: a PDF's taken out on this phone, anything else read as text. */
  const textOf = async (f: File): Promise<string> => (/\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? (await extractPdf(new Uint8Array(await f.arrayBuffer()), f.name)).pages.join('\n') : await f.text());
  const results = h('div.pkcol.mnimports', { 'aria-live': 'polite' });
  /** Several files: each read in turn, a line for each (kept, already had, or why not), and the total. Overlaps are caught by my brain. */
  const many = async (files: File[]) => {
    const lines: HTMLElement[] = [];
    let added = 0;
    let dupes = 0;
    let failed = 0;
    moneyState.batch = [];
    const done = waitFor(body.parentElement!, `Reading ${files.length} statements…`);
    try {
      for (const [i, f] of files.entries()) {
        status.textContent = `Reading ${i + 1} of ${files.length}: ${f.name}`;
        try {
          const text = await textOf(f);
          if (!text.trim()) throw new Error('there was nothing in it I could read');
          const r = await brain.spendingImport(text, true);
          added += r.result.added;
          dupes += r.result.duplicates;
          const kind = r.result.shape === 'ofx' ? 'OFX' : r.result.shape === 'qif' ? 'QIF' : /\.pdf$/i.test(f.name) ? 'PDF' : 'CSV';
          const span = r.result.months.length ? `${r.result.months[0]}${r.result.months.length > 1 ? ` to ${r.result.months[r.result.months.length - 1]}` : ''}` : '';
          const line = `${f.name}: ${r.result.added} kept${r.result.duplicates ? `, ${r.result.duplicates} I had already` : ''} · ${kind}${r.result.bank ? ` · ${r.result.bank}` : ''}${span ? ` · ${span}` : ''}`;
          moneyState.batch.push(line);
          lines.push(h('p.pknote.mnimport', { dataset: { case: 'keep', ok: '1' } }, line));
        } catch (e) {
          failed++;
          const line = `${f.name}: ${sayError(e, 'read it')}`;
          moneyState.batch.push(line);
          lines.push(h('p.pknote.mnimport', { dataset: { case: 'keep', ok: '' } }, line));
        }
      }
    } finally {
      done();
    }
    moneyState.read += files.length - failed;
    slot.replaceChildren();
    results.replaceChildren(h('div.lab', 'JUST ADDED'), ...lines);
    stateIn(status, failed === files.length ? 'error' : '', `${added} payment${added === 1 ? '' : 's'} kept from ${files.length - failed} of ${files.length} statements${dupes ? `; ${dupes} I already had ${dupes === 1 ? 'was' : 'were'} left out` : ''}. Every amount is from your statements.`);
  };
  const takeFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > 1) return void (await many(files.slice(0, 24)));
    await one(files[0]!);
  };
  // dropped on the page (an iPad or a computer): the same as picking them
  const dropZone = (el: HTMLElement) => {
    el.addEventListener('dragover', (e) => (e.preventDefault(), el.classList.add('mndrop')));
    el.addEventListener('dragleave', () => el.classList.remove('mndrop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('mndrop');
      void takeFiles([...(e.dataTransfer?.files ?? [])]);
    });
  };
  file.addEventListener('change', async () => {
    const list = [...(file.files ?? [])];
    file.value = '';
    await takeFiles(list);
  });
  const one = async (f: File) => {
    const done = waitFor(body.parentElement!, `Opening ${f.name}, ${sizeWords(f.size)}…`);
    let text = '';
    try {
      text = await textOf(f);
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
  };
  const go = button('Read it', () => void read(box.value).then((ok) => ok && (box.value = '')), 'on');
  go.setAttribute('aria-label', 'Read the pasted statement');
  const pick = button('Pick files', () => file.click());
  pick.setAttribute('aria-label', 'Pick your statements: CSV, OFX, QIF or PDF, as many as you like');
  // [moneynext] money.u8: a reminder on the 2nd of each month to add last month's statement, only when he turns it on
  const remind = button('Remind me on the 2nd', () => void setNudge(remind.getAttribute('aria-pressed') === 'true' ? 'off' : 'on'));
  remind.setAttribute('aria-label', 'Remind me on the 2nd of each month to add a statement');
  remind.hidden = true;
  const setNudge = async (op: '' | 'on' | 'off') => {
    if (lacksSignal()) return void (op && stateIn(status, 'offline', 'No signal. Try again when the phone is back online.'));
    try {
      const r = await brain.packDo('money', 'nudge', op ? { op } : {});
      const on = (r.data as { on?: boolean } | undefined)?.on === true;
      moneyState.nudge = on;
      remind.hidden = false;
      remind.setAttribute('aria-pressed', String(on));
      remind.textContent = on ? 'Reminder on the 2nd: on' : 'Remind me on the 2nd';
      if (op) stateIn(status, '', r.text);
    } catch (e) {
      if (op) stateIn(status, 'error', sayError(e, 'set that reminder'));
    }
  };
  void setNudge('');
  const el = h('div.pkcol', slot, body, h('div.pkrow', go, pick), h('small.pklab', 'Pick several at once: CSV, OFX, QIF or PDF from any bank. Ones I already have are left out.'), h('div.pkrow', remind), status, results, phrases(['paste a statement']));
  dropZone(el);
  return { el, stop: () => undefined };
}
