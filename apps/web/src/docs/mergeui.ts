/**
 * MAIL MERGE, the panel (NEXT ROUND, editors.s2; a document's MAIL MERGE key): choose one of his spreadsheets, put its columns into the
 * letter as {{fields}} where the caret is, step through the copies to see each one filled, and make ONE PDF, ONE WORD FILE or SEPARATE
 * FILES (a zip of a PDF for each row). A field the spreadsheet has no column for is said. Nothing is sent anywhere (docs/merge.ts).
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { listBooks, getBook } from '../sheets/store';
import { zipStore } from '../convert/zip';
import { docxFrom } from './docx';
import { imageBytes, loadImages } from './images';
import { pdfOfDocAnyScript } from './read';
import { myName } from './ask';
import { copyName, mergeAll, mergeFields, mergeOne, missingFields, tableOf, type MergeTable } from './merge';
import { textOf, type Doc } from './model';
import { sayError } from '../ui/hisWords';
import { MIME, sizeWords } from '../convert/bytes';
import { saveBlob, shareBlob } from '../convert/run';

export interface MergeHost {
  doc(): Doc;
  flush(): void;
  say(w: string): void;
  insertText(t: string): boolean;
}
/** What the checks read (window.__ghosty.merge). */
export const mergeState = { book: '', columns: [] as string[], rows: 0, fields: [] as string[], missing: [] as string[], at: 0, preview: '' };
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.merge = mergeState;
};

export function mergePanel(host: MergeHost): { el: HTMLElement; refresh(): void } {
  expose();
  const el = h('div.dcmerge');
  const pick = h('select', { 'aria-label': 'The spreadsheet of names and addresses' }) as HTMLSelectElement;
  const cols = h('div.dcrow.dcmergecols');
  const said = h('p.dcnote', { 'aria-live': 'polite' });
  const preview = h('div.dcmergeprev', { 'aria-live': 'polite' });
  const step = h('div.dcrow');
  let table: MergeTable | null = null;
  let at = 0;
  const out = h('div.dcouts');
  const made = (blob: Blob, name: string) => {
    clear(out, h('div.cvout', h('div.cvoutt', h('b', name), h('small', sizeWords(blob.size))), h('div.cvbtns', button('SAVE', () => saveBlob(blob, name)), button('SHARE', async () => {
      if (!(await shareBlob(blob, name))) saveBlob(blob, name);
    }))));
    host.say(`Made on this phone: ${name}, ${sizeWords(blob.size)}. Nothing was sent anywhere.`);
  };

  const paintPreview = () => {
    const d = host.doc();
    const fields = mergeFields(d);
    mergeState.fields = fields;
    mergeState.missing = table ? missingFields(fields, table.head) : [];
    if (!table) return clear(preview), clear(step);
    if (!table.rows.length) {
      clear(step);
      clear(preview, h('p.dcnote', 'That spreadsheet has no rows under its header yet: put a name on each row, then come back.'));
      return;
    }
    at = Math.max(0, Math.min(table.rows.length - 1, at));
    mergeState.at = at;
    const copy = mergeOne(d, table, table.rows[at]!);
    const words = copy.blocks.map(textOf).filter((t) => t.trim());
    mergeState.preview = words.join('\n');
    clear(step,
      button('‹ PREVIOUS', () => {
        at = (at + table!.rows.length - 1) % table!.rows.length;
        paintPreview();
      }, '', ),
      h('b.dcnum', `${at + 1} of ${table.rows.length}`),
      button('NEXT ›', () => {
        at = (at + 1) % table!.rows.length;
        paintPreview();
      }),
    );
    step.querySelectorAll('button')[0]?.setAttribute('aria-label', 'The copy before');
    step.querySelectorAll('button')[1]?.setAttribute('aria-label', 'The next copy');
    clear(preview, h('small.cvgh', `COPY ${at + 1}: ${table.rows[at]!.find((x) => x) ?? ''}`), ...words.slice(0, 12).map((w) => h('p', w)), ...(words.length > 12 ? [h('small.dcnote', '…and the rest of the letter.')] : []));
    said.textContent = !fields.length
      ? 'Your letter has no fields yet: tap where a name goes, then a column’s key below.'
      : mergeState.missing.length
        ? `${mergeState.missing.map((f) => `{{${f}}}`).join(', ')} ${mergeState.missing.length === 1 ? 'is' : 'are'} not a column of this spreadsheet, so ${mergeState.missing.length === 1 ? 'it stays' : 'they stay'} as written.`
        : `${table.rows.length} cop${table.rows.length === 1 ? 'y' : 'ies'}, one for each row, ${fields.length} field${fields.length === 1 ? '' : 's'} filled in each.`;
  };
  const choose = () => {
    const b = pick.value ? getBook(pick.value) : null;
    table = b ? tableOf(b) : null;
    mergeState.book = b?.title ?? '';
    mergeState.columns = table?.head.filter(Boolean) ?? [];
    mergeState.rows = table?.rows.length ?? 0;
    at = 0;
    clear(cols, ...(table?.head.filter(Boolean).map((c) => button(`{{${c}}}`, () => {
      if (host.insertText(`{{${c}}}`)) {
        host.say(`{{${c}}} put in the letter: each copy gets that row’s ${c}.`);
        paintPreview();
      }
    }, 'dcfield')) ?? []));
    cols.querySelectorAll('button').forEach((x) => (x as HTMLButtonElement).dataset.label = x.textContent ?? '');
    paintPreview();
  };
  pick.addEventListener('change', choose);

  const make = async (how: 'pdf' | 'word' | 'files') => {
    host.flush();
    if (!table) return host.say('Choose the spreadsheet of names first.');
    if (!table.rows.length) return host.say('That spreadsheet has no rows to make copies from.');
    if (table.rows.length > 500) return host.say(`That is ${table.rows.length} rows: I make up to 500 copies at a time. Filter the spreadsheet into a smaller one first.`);
    const d = host.doc();
    if (!mergeFields(d).length) return host.say('Put at least one field in the letter first, or every copy would be the same.');
    await loadImages(d.blocks.flatMap((b) => (b.img ? [b.img] : [])));
    const n = table.rows.length;
    const safe = d.title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 70) || 'Letter';
    try {
      if (how === 'word') {
        host.say(`Making one Word file of ${n} copies on this phone…`);
        made(new Blob([docxFrom(mergeAll(d, table), myName(), imageBytes) as BlobPart], { type: MIME.docx }), `${safe} (${n} copies).docx`);
      } else if (how === 'pdf') {
        host.say(`Making one PDF of ${n} copies on this phone…`);
        made(new Blob([(await pdfOfDocAnyScript(mergeAll(d, table), host.say)) as BlobPart], { type: 'application/pdf' }), `${safe} (${n} copies).pdf`);
      } else {
        const used = new Set<string>();
        const files: { name: string; data: Uint8Array }[] = [];
        for (let k = 0; k < n; k++) {
          host.say(`Making copy ${k + 1} of ${n} on this phone…`);
          files.push({ name: copyName(d, table.rows[k]!, k, 'pdf', used), data: await pdfOfDocAnyScript(mergeOne(d, table, table.rows[k]!)) });
        }
        made(new Blob([zipStore(files) as BlobPart], { type: 'application/zip' }), `${safe} (${n} files).zip`);
      }
    } catch (e) {
      host.say(sayError(e, 'make the copies'));
    }
  };

  const refresh = () => {
    const books = listBooks();
    const was = pick.value;
    clear(pick, h('option', { value: '' }, books.length ? 'Choose a spreadsheet…' : 'No spreadsheets on this phone yet'), ...books.map((b) => h('option', { value: b.id }, b.title)));
    pick.value = books.some((b) => b.id === was) ? was : '';
    clear(el,
      h('small.cvgh', 'MAIL MERGE'),
      h('p.dcnote', books.length ? 'One letter, a copy for every row of a spreadsheet: its first row names the columns (Name, Address…). Nothing is sent anywhere.' : 'Make a spreadsheet first (SPREADSHEETS → NEW) with a header row, like Name, Address, then a person on each row.'),
      h('div.dcrow', pick),
      cols,
      said,
      step,
      preview,
      h('div.cvbtns', button('ONE PDF', () => void make('pdf'), 'on'), button('ONE WORD FILE', () => void make('word')), button('SEPARATE FILES', () => void make('files'))),
      out,
    );
    choose();
  };
  refresh();
  return { el, refresh };
}
