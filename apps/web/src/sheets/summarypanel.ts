/**
 * THE SUMMARY PANEL (NEXT ROUND, editors.u3): SPREADSHEETS → SUMMARY. Choose a table (or a cell in it), then BY (each month of a date column,
 * or each value of any column) and OF (the total, count or average of a column of numbers), and MAKE THE SUMMARY: a sheet of its own whose
 * figures are formulas over the table and whose rows are made again when the table gains a shop or a month (pivot.ts). One more tap,
 * MAKE A CHART OF IT, draws it as bars that follow it. Every change goes through the workbook's history, so UNDO takes it back.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import type { Book, Chart, Val } from './model';
import { addPivot, headersOf, pivotChart, pivotWords, tableOf, type PivotHow } from './pivot';

export interface SummaryHost {
  book(): Book;
  sheet(): number;
  range(): string;
  value(sheet: string, a: string): Val;
  commit(next: Book): void;
  say(words: string): void;
  addChart(c: Omit<Chart, 'id'>): void;
}

export function summaryPanel(host: SummaryHost): { el: HTMLElement; paint(): void } {
  let by = -1;
  let month = false;
  let of = -1;
  let how: PivotHow = 'sum';
  const byRow = h('div.shrow', { role: 'group', 'aria-label': 'Summed by' });
  const ofRow = h('div.shrow', { role: 'group', 'aria-label': 'Summed of' });
  const howRow = h('div.shrow', { role: 'group', 'aria-label': 'Total, count or average' });
  const tableSaid = h('p.shnote');
  const pivotSaid = h('p.shnote');
  const makeKey = button('MAKE THE SUMMARY', () => make(), 'on');
  const chartKey = button('MAKE A CHART OF IT', () => chart());
  const el = h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Summary' },
    h('p.shnote', 'Choose the table, its header row and the rows under it, or one cell in it. Then BY and OF: a summary on its own sheet that follows the table.'),
    tableSaid,
    h('small.slh', 'BY'), byRow,
    h('small.slh', 'OF'), ofRow, howRow,
    h('div.shrow', makeKey, chartKey),
    pivotSaid,
  );
  const pick = (b: HTMLButtonElement, on: boolean) => b.setAttribute('aria-pressed', String(on));

  function current() {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    const pivot = b.pivots?.find((p) => p.sheet === s.name) ?? null;
    return { b, s, pivot, table: pivot ? null : tableOf(s, host.range()) };
  }
  function paint(): void {
    const { b, s, pivot, table } = current();
    clear(byRow);
    clear(ofRow);
    clear(howRow);
    chartKey.hidden = !pivot;
    if (pivot) {
      tableSaid.textContent = '';
      pivotSaid.textContent = `This sheet is the summary: ${pivotWords(b, pivot, host.value)}, from ${pivot.src}. It follows the table as it changes.`;
      for (const r of [byRow, ofRow, howRow]) r.hidden = true;
      makeKey.hidden = true;
      return;
    }
    pivotSaid.textContent = '';
    for (const r of [byRow, ofRow, howRow]) r.hidden = false;
    makeKey.hidden = false;
    if (!table) {
      tableSaid.textContent = 'No table here yet: a header row with rows of words and numbers under it.';
      makeKey.disabled = true;
      return;
    }
    makeKey.disabled = false;
    const heads = headersOf(s, table, host.value);
    if (!heads.some((x) => x.c === by)) {
      const first = heads.find((x) => x.dates) ?? heads.find((x) => !x.numbers) ?? heads[0]!;
      by = first.c;
      month = first.dates;
    }
    const nums = heads.filter((x) => x.numbers && !x.dates);
    if (!nums.some((x) => x.c === of)) of = nums[nums.length - 1]?.c ?? -1;
    if (of < 0 && how !== 'count') how = 'count';
    tableSaid.textContent = `The table: ${heads.length} column${heads.length === 1 ? '' : 's'}, ${heads.map((x) => x.name).join(', ')}.`;
    for (const x of heads) {
      const bb = button(x.dates ? `${x.name.toUpperCase()} BY MONTH` : x.name.toUpperCase(), () => {
        by = x.c;
        month = x.dates;
        paint();
      });
      bb.setAttribute('aria-label', `By ${x.dates ? 'month of ' : ''}${x.name}`);
      pick(bb, by === x.c);
      byRow.append(bb);
    }
    for (const x of nums) {
      const bb = button(x.name.toUpperCase(), () => {
        of = x.c;
        if (how === 'count') how = 'sum';
        paint();
      });
      bb.setAttribute('aria-label', `Of ${x.name}`);
      pick(bb, of === x.c && how !== 'count');
      ofRow.append(bb);
    }
    if (!nums.length) ofRow.append(h('p.shnote', 'No column of numbers: it can count the rows.'));
    for (const [w, label] of [['sum', 'TOTAL'], ['count', 'COUNT'], ['average', 'AVERAGE']] as const) {
      const bb = button(label, () => {
        how = w;
        paint();
      });
      bb.disabled = w !== 'count' && of < 0;
      pick(bb, how === w);
      howRow.append(bb);
    }
  }
  function make(): void {
    const { b, s, table } = current();
    if (!table) return host.say('Choose a table first: a header row and the rows under it.');
    if (by < 0) return host.say('Pick what it is summed BY.');
    const r = addPivot(b, { src: s.name, head: table.head, c1: table.c1, c2: table.c2, by, month, of: how === 'count' ? null : of, how }, host.value);
    host.commit(r.book);
    host.say(`${pivotWords(r.book, r.pivot, host.value)}: ${r.rows} row${r.rows === 1 ? '' : 's'} on the sheet ${r.pivot.sheet}. It follows the table. MAKE A CHART OF IT draws it; UNDO takes it away.`);
    paint();
  }
  function chart(): void {
    const { b, pivot } = current();
    if (!pivot) return;
    const rows = Object.keys(b.sheets[host.sheet()]!.cells).filter((k) => /^A\d+$/.test(k)).length - 2;
    if (rows < 1) return host.say('There is nothing in the summary to draw yet.');
    host.addChart(pivotChart(pivot, rows, pivotWords(b, pivot, host.value)));
    host.say('A bar chart of the summary, under the sheet. It follows the summary.');
  }
  return { el, paint };
}
