/**
 * The scan's two hand-offs (NEXT ROUND, editors.s3), called from SCAN → DOCUMENT once READ ALL has read the pages
 * (features/lens/scan.ts) and from the chat ("scan this letter into a document", "scan a receipt into my spreadsheet"):
 * INTO A DOCUMENT lays the pages out as a document he can edit (docs/paper.ts) and opens it in DOCUMENTS; RECEIPT TO
 * SPREADSHEET shows the date, shop and total the reader found, for him to check, and ADD ROW puts them in the next row of
 * his RECEIPTS spreadsheet through the sheets' model (made, with its header row, the first time). Both kept on this phone.
 */
import { h, clear } from '../core/dom';
import { button, modal } from '../ui/components';
import { saveDoc } from './store';
import { paperDoc, receiptOf, RECEIPTS_HEAD, RECEIPTS_TITLE, type PaperPage } from './paper';
import { appendRow, newBook, setEntries, setFormat, setFrozen, type Book } from '../sheets/model';
import { getBook, listBooks, saveBook } from '../sheets/store';

/** What the checks read (window.__ghosty.paper): the last document made from paper, the last receipt row added. */
export const paperState = { want: '' as '' | 'doc' | 'receipt', doc: '', blocks: [] as string[], row: 0, book: '', said: '' };
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.paper = paperState;
};

/** What he asked the scan for, by voice or from DOCUMENTS: the scan's keys say it (INTO A DOCUMENT or RECEIPT TO SPREADSHEET first). */
export function wantPaper(w: '' | 'doc' | 'receipt'): void {
  paperState.want = w;
  expose();
}

/** The pages laid out as a document, kept, and opened in DOCUMENTS; null (and nothing made) when no words were read. */
export async function scanIntoDocument(pages: PaperPage[]): Promise<string> {
  expose();
  const d = paperDoc(pages);
  if (!d) return (paperState.said = 'No words were read on the pages, so there is nothing to put in a document. Try again in better light, the page flat and filling the frame.');
  saveDoc(d);
  paperState.doc = d.id;
  paperState.blocks = d.blocks.map((b) => b.t);
  paperState.want = '';
  const { openDocs } = await import('./sheet');
  await openDocs({ id: d.id });
  const heads = d.blocks.filter((b) => b.t === 'h1' || b.t === 'h2' || b.t === 'h3').length;
  const paras = d.blocks.filter((b) => b.t === 'p' || b.t === 'right').length;
  return (paperState.said = `“${d.title}” is a document now: ${heads ? `${heads} heading${heads === 1 ? '' : 's'}, ` : ''}${paras} paragraph${paras === 1 ? '' : 's'}${d.blocks.some((b) => b.t === 'ul' || b.t === 'ol') ? ' and a list' : ''}, kept on this phone. Check the words against the paper: the reader can miss a letter.`);
}

/** His RECEIPTS spreadsheet (the newest called that, with DATE in A1), or a new one with its header row. */
function receiptsBook(): Book {
  const found = listBooks().find((b) => b.title === RECEIPTS_TITLE && String(b.sheets[0]?.cells.A1?.v ?? '') === RECEIPTS_HEAD[0]);
  if (found) return found;
  let b: Book = { ...newBook(RECEIPTS_TITLE), from: 'scanned receipts' };
  b = setEntries(b, 0, RECEIPTS_HEAD.map((t, c) => [`${'ABC'[c]}1`, t] as [string, string]));
  b = setFormat(b, 0, 'A1:C1', { b: 1 });
  return setFrozen(b, 0, true);
}

/** The receipt's date, shop and total, for him to check; ADD ROW adds them to RECEIPTS (UNDO takes the row out). */
export function receiptToSheet(text: string): void {
  expose();
  const r = receiptOf(text);
  const dateIn = h('input', { type: 'date', value: r.date, 'aria-label': 'The receipt’s date' }) as HTMLInputElement;
  const shopIn = h('input', { type: 'text', value: r.shop, placeholder: 'The shop', 'aria-label': 'The shop', autocomplete: 'off' }) as HTMLInputElement;
  const totalIn = h('input', { type: 'text', inputMode: 'decimal', value: r.total, placeholder: '0.00', 'aria-label': 'The total, in pounds', autocomplete: 'off' }) as HTMLInputElement;
  const said = h('p.pprsaid', { 'aria-live': 'polite' });
  const say = (w: string) => {
    said.textContent = w;
    paperState.said = w;
  };
  const found = [r.date ? '' : 'the date', r.shop ? '' : 'the shop', r.total ? '' : 'the total'].filter(Boolean);
  say(found.length ? `I could not read ${found.join(' or ')} on it: type ${found.length === 1 ? 'it' : 'them'} in, then ADD ROW.` : 'Check these against the receipt, then ADD ROW.');
  const after = h('div.dcrow.pprafter');
  const add = button('ADD ROW', () => {
    const total = totalIn.value.replace(/[£,\s]/g, '');
    if (!shopIn.value.trim() && !total) return say('Type the shop or the total first.');
    if (total && !/^\d+(?:\.\d{1,2})?$/.test(total)) return say('The total is a number of pounds, like 12.40.');
    const before = receiptsBook();
    const was = getBook(before.id);
    const { book, row } = appendRow(before, 0, [dateIn.value, `'${shopIn.value.trim()}`, total ? `£${Number(total).toFixed(2)}` : '']);
    if (!saveBook(book)) return say('This phone is not letting me keep spreadsheets (its storage is blocked or full), so the row was not added.');
    paperState.row = row;
    paperState.book = book.id;
    add.disabled = true;
    say(`Added to ${RECEIPTS_TITLE} as row ${row}: ${dateIn.value || 'no date'}, ${shopIn.value.trim() || 'no shop'}, ${total ? `£${Number(total).toFixed(2)}` : 'no total'}. Kept on this phone.`);
    clear(after,
      button('UNDO', () => {
        if (was) saveBook(was);
        else {
          // the spreadsheet was made for this row: it goes with it
          void import('../sheets/store').then((s) => s.removeBook(book.id));
        }
        paperState.row = 0;
        add.disabled = false;
        clear(after);
        say('The row is taken out again.');
      }),
      button('OPEN THE SPREADSHEET', async () => {
        m.close();
        const { openSheets } = await import('../sheets/sheet');
        await openSheets({ id: book.id });
      }, 'on'),
    );
  }, 'on');
  const body = h('div.pprsheet',
    h('label.pprf', h('small', 'DATE'), dateIn),
    h('label.pprf', h('small', 'SHOP'), shopIn),
    h('label.pprf', h('small', 'TOTAL (£)'), totalIn),
    said,
    h('div.dcrow', add, button('CANCEL', () => m.close())),
    after,
    h('small.dcnote', `Each receipt is a row of your ${RECEIPTS_TITLE} spreadsheet: date, shop, total. Nothing is sent anywhere.`),
  );
  const m = modal('RECEIPT TO SPREADSHEET', body);
  paperState.want = '';
}
