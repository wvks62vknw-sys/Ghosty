/**
 * SPREADSHEETS, PRO EDITION, ON SCREEN (APPS ROUND, editors): the CHART panel (nine kinds, a title, the words along the bottom and up the side,
 * the key on or off, the colour from the house's five; MAKE THE CHART from the chosen cells, or EDIT a chart under the sheet and SAVE THE CHART;
 * in-cell SPARKLINES), the CELLS panel (borders, merge and unmerge, wrap, more number formats, table styles with a header row and banded rows;
 * input checks: a drop-down list, a tick box, a date), and the picker under the formula line for a checked cell. Every change goes through
 * the workbook's history, so UNDO takes it back; every state is said in his words.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { CHART_KINDS, CHART_WORDS, updateChart, addChart, type Book, type Chart, type ChartKind, type Fmt, type NumMore, type Val } from './model';
import type { Engine } from './formula';
import { chartFrom, chartWords } from './charts';
import { chartOf } from './ops';
import { addCheck, addSparks, addTable, checkAt, listItems, mergeRange, removeChecks, removeSparks, removeTables, setBorders, unmergeRange } from './pro';

export interface ProHost {
  book(): Book;
  sheet(): number;
  range(): string;
  /** The chosen cell (the first corner). */
  at(): string;
  eng(): Engine;
  commit(next: Book): void;
  say(words: string): void;
}
type Tone = 1 | 2 | 3 | 4 | 5;
const TONES: Tone[] = [1, 2, 3, 4, 5];
const TONE_NAME = ['blue', 'amber', 'green', 'red', 'grey'];
const KIND_KEY: Record<ChartKind, string> = { bars: 'BARS', line: 'LINE', column: 'COLUMNS', area: 'AREA', pie: 'PIE', scatter: 'SCATTER', stackedcol: 'STACKED COLUMNS', stackedbar: 'STACKED BARS', combo: 'LINE + COLUMNS' };
const KIND_ORDER: ChartKind[] = ['bars', 'line', ...CHART_KINDS.filter((k) => k !== 'bars' && k !== 'line')];

const key = (label: string, run: () => void, name = '', cls = '') => {
  const b = button(label, run, cls);
  if (name) b.setAttribute('aria-label', name);
  return b;
};
const pressed = (b: HTMLElement, on: boolean) => b.setAttribute('aria-pressed', String(on));
const field = (label: string, input: HTMLInputElement) => h('label', label, input);

/** The CHART panel. `edit(id)` opens a chart under the sheet in it. */
export function chartPanel(host: ProHost): { el: HTMLElement; paint(): void; edit(id: string): void; editing(): string } {
  let kind: ChartKind = 'bars';
  let tone: Tone = 1;
  let legend = true;
  let editing = '';
  const titleIn = h('input', { type: 'text', 'aria-label': 'The chart’s title', placeholder: 'its title (or I name it)', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const xIn = h('input', { type: 'text', 'aria-label': 'The words along the bottom', placeholder: 'like Month', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const yIn = h('input', { type: 'text', 'aria-label': 'The words up the side', placeholder: 'like Pounds', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const kinds = KIND_ORDER.map((k) => {
    const b = key(KIND_KEY[k], () => {
      kind = k;
      paint();
    }, `A ${CHART_WORDS[k]} chart`);
    b.dataset.kind = k;
    return b;
  });
  const legendKey = key('KEY', () => {
    legend = !legend;
    paint();
  }, 'Show the key that names each series');
  const swatches = TONES.map((t) => {
    const b = key('', () => {
      tone = t;
      paint();
    }, `Colour: ${TONE_NAME[t - 1]}`, 'shsw');
    b.dataset.fill = String(t);
    return b;
  });
  const note = h('p.shnote');
  const makeKey = key('MAKE THE CHART', () => make(), '', 'on');
  const saveKey = key('SAVE THE CHART', () => save(), '', 'on');
  const cancelKey = key('CANCEL', () => {
    editing = '';
    host.say('The chart is as it was.');
    paint();
  });
  const sparkTone = (): Tone => tone;
  const sparkKey = (k: 'line' | 'column') => key(k === 'line' ? 'SPARKLINE' : 'SPARK COLUMNS', () => {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    const r = addSparks(b, host.sheet(), host.range(), k, sparkTone(), (a) => host.eng().value(s.name, a));
    if ('why' in r) return host.say(r.why);
    host.commit(r.book);
    host.say(`A ${k === 'line' ? 'line' : 'column'} sparkline in ${r.at.length === 1 ? r.at[0] : `${r.at[0]} to ${r.at[r.at.length - 1]}`}, drawn from its numbers. UNDO takes it out.`);
  }, k === 'line' ? 'A line sparkline in the cell after the chosen numbers' : 'A column sparkline in the cell after the chosen numbers');
  const sparkOff = key('NO SPARKLINE', () => {
    const r = removeSparks(host.book(), host.sheet(), host.range());
    if (!r.n) return host.say('There is no sparkline in the chosen cells.');
    host.commit(r.book);
    host.say(`${r.n} sparkline${r.n === 1 ? '' : 's'} taken out. UNDO brings ${r.n === 1 ? 'it' : 'them'} back.`);
  }, 'Take the sparkline out of the chosen cells');
  const el = h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Chart' },
    note,
    h('div.shkinds', ...kinds),
    h('div.shchedit', h('div.shrow', field('TITLE', titleIn)), h('div.shrow', field('ALONG THE BOTTOM', xIn), field('UP THE SIDE', yIn)), h('div.shrow.shswrow', legendKey, ...swatches)),
    h('div.shrow', makeKey, saveKey, cancelKey),
    h('p.shsub', 'IN A CELL'),
    h('p.shnote', 'Choose a row of numbers (or a block, one sparkline a row): the sparkline goes in the cell after them.'),
    h('div.shrow', sparkKey('line'), sparkKey('column'), sparkOff),
  );
  const patch = (): Partial<Chart> => ({
    kind,
    tone,
    legend,
    xTitle: xIn.value.trim() || undefined,
    yTitle: yIn.value.trim() || undefined,
  });
  function make(): void {
    const b = host.book();
    const name = b.sheets[host.sheet()]!.name;
    // BARS and LINE are the quick charts of one column (the last chosen); the others take every column of numbers chosen
    const c = kind === 'bars' || kind === 'line' ? chartOf(b, host.eng(), name, host.range(), kind) : chartFrom(b, host.eng(), name, host.range(), kind);
    if (!c) return host.say(kind === 'combo' ? 'A line and columns chart needs two columns of numbers: choose the labels and two or more columns.' : 'I need at least two numbers in the last column of what you chose.');
    const full: Omit<Chart, 'id'> = { ...c, ...patch(), title: titleIn.value.trim() || c.title, xTitle: xIn.value.trim() || c.xTitle, yTitle: yIn.value.trim() || c.yTitle };
    if (full.tone === 1) delete full.tone;
    if (full.legend) delete full.legend;
    for (const k of ['xTitle', 'yTitle'] as const) if (!full[k]) delete full[k];
    host.commit(addChart(b, full));
    host.say(`${chartWords(full, CHART_WORDS[kind])}, under the sheet. It follows the numbers.`);
    titleIn.value = '';
    xIn.value = '';
    yIn.value = '';
  }
  function save(): void {
    const b = host.book();
    const c = b.charts.find((x) => x.id === editing);
    if (!c) {
      editing = '';
      paint();
      return host.say('That chart is gone (UNDO may bring it back).');
    }
    if (kind === 'combo' && !c.more?.length) return host.say('A line and columns chart needs two columns of numbers. Make a new chart from the labels and two columns.');
    const next = { ...patch(), title: titleIn.value.trim() || c.title };
    host.commit(updateChart(b, c.id, next));
    editing = '';
    host.say(`Saved: ${next.title}, now a ${CHART_WORDS[kind]} chart. UNDO takes the change back.`);
    paint();
  }
  function paint(): void {
    const c = editing ? host.book().charts.find((x) => x.id === editing) : undefined;
    if (editing && !c) editing = '';
    for (const b of kinds) pressed(b, b.dataset.kind === kind);
    for (const b of swatches) pressed(b, b.dataset.fill === String(tone));
    pressed(legendKey, legend);
    makeKey.hidden = !!editing;
    saveKey.hidden = !editing;
    cancelKey.hidden = !editing;
    note.textContent = editing
      ? `Editing “${c?.title ?? ''}”: change its kind, title, words, key or colour, then SAVE THE CHART.`
      : 'Choose the cells first: the first column names each point, the columns after it are the numbers, and a first row of words names them.';
  }
  return {
    el,
    paint,
    editing: () => editing,
    edit(id: string) {
      const c = host.book().charts.find((x) => x.id === id);
      if (!c) return;
      editing = id;
      kind = c.kind;
      tone = c.tone ?? 1;
      legend = c.legend !== false;
      titleIn.value = c.title;
      xIn.value = c.xTitle ?? '';
      yIn.value = c.yTitle ?? '';
      paint();
      host.say(`Editing “${c.title}”. SAVE THE CHART keeps the change; CANCEL leaves it as it was.`);
    },
  };
}

const MORE_KEYS: [NumMore, string, string][] = [['time', 'TIME', 'A time, like 14:30'], ['datetime', 'DATE + TIME', 'A date and a time'], ['longdate', 'LONG DATE', 'A long date, like Saturday 14 November 2026'], ['usd', '$', 'Dollars'], ['eur', '€', 'Euros'], ['accounting', 'ACCOUNTING', 'Pounds, as an accountant lines them up']];

/** The CELLS panel: borders, merge, wrap, more number formats, table styles, input checks. */
export function cellsPanel(host: ProHost & { fmt(patch: Partial<Fmt> | null): void; fmtOf(): Fmt | undefined }): { el: HTMLElement; paint(): void } {
  let tableTone: Tone = 1;
  let header = true;
  let banded = true;
  const listIn = h('input', { type: 'text', 'aria-label': 'The choices of the list, with commas between', placeholder: 'Paid, Owed, Later', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const border = (k: 'all' | 'outer' | 'bottom' | 'none', label: string, name: string) => key(label, () => {
    host.commit(setBorders(host.book(), host.sheet(), host.range(), k));
    host.say(k === 'none' ? `No borders on ${host.range()}. UNDO puts them back.` : `${k === 'all' ? 'Every line' : k === 'outer' ? 'An outline' : 'A line under'} on ${host.range()}. UNDO takes it off.`);
  }, name);
  const wrapKey = key('WRAP', () => {
    const on = !host.fmtOf()?.w;
    host.fmt({ w: on ? 1 : undefined });
    host.say(on ? 'The words wrap onto more lines in the cell.' : 'The words stay on one line.');
  }, 'Wrap the words onto more lines');
  const headKey = key('HEADER ROW', () => {
    header = !header;
    paint();
  }, 'The table’s first row is its header');
  const bandKey = key('BANDED ROWS', () => {
    banded = !banded;
    paint();
  }, 'Every other row shaded');
  const tones = TONES.map((t) => {
    const b = key('', () => {
      tableTone = t;
      paint();
    }, `Table colour: ${TONE_NAME[t - 1]}`, 'shsw');
    b.dataset.fill = String(t);
    return b;
  });
  const el = h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Cells' },
    h('p.shsub', 'BORDERS'),
    h('div.shrow', border('all', 'ALL LINES', 'Borders: every line'), border('outer', 'OUTLINE', 'Borders: an outline'), border('bottom', 'LINE UNDER', 'Borders: a line under'), border('none', 'NO BORDERS', 'No borders')),
    h('p.shsub', 'MERGE AND WRAP'),
    h('div.shrow', key('MERGE', () => {
      const next = mergeRange(host.book(), host.sheet(), host.range());
      if (!next) return host.say('Choose two or more cells to merge.');
      host.commit(next);
      host.say(`${host.range()} merged: its top-left cell shows across them all; what is under stays and comes back when you unmerge. UNDO takes it back.`);
    }, 'Merge the chosen cells'), key('UNMERGE', () => {
      const r = unmergeRange(host.book(), host.sheet(), host.range());
      if (!r.n) return host.say('There are no merged cells there.');
      host.commit(r.book);
      host.say(`Unmerged. UNDO merges ${r.n === 1 ? 'it' : 'them'} again.`);
    }, 'Unmerge the chosen cells'), wrapKey),
    h('p.shsub', 'MORE NUMBER FORMATS'),
    h('div.shrow', ...MORE_KEYS.map(([nx, label, name]) => key(label, () => {
      host.fmt({ nx, n: undefined });
      host.say(`${name} on ${host.range()}. PLAIN on FORMAT takes it off.`);
    }, name))),
    h('p.shsub', 'TABLE STYLE'),
    h('div.shrow', headKey, bandKey),
    h('div.shrow.shswrow', ...tones),
    h('div.shrow', key('MAKE IT A TABLE', () => {
      const next = addTable(host.book(), host.sheet(), host.range(), { tone: tableTone, header, banded });
      if (!next) return host.say('Choose the table’s cells first: two rows or more.');
      host.commit(next);
      host.say(`${host.range()} is a ${TONE_NAME[tableTone - 1]} table${header ? ' with a header row' : ''}${banded ? ' and banded rows' : ''}. UNDO takes the style off.`);
    }, '', 'on'), key('NO TABLE', () => {
      const r = removeTables(host.book(), host.sheet(), host.range());
      if (!r.n) return host.say('The chosen cells are in no table.');
      host.commit(r.book);
      host.say('The table style is off; the cells stay. UNDO puts it back.');
    }, 'Take the table style off')),
    h('p.shsub', 'INPUT CHECKS'),
    h('p.shnote', 'A check keeps a cell to a list, a tick box or a date; anything else he types there is refused and said.'),
    h('div.shrow', listIn, key('DROP-DOWN LIST', () => {
      const items = listItems(listIn.value);
      if (items.length < 2) return host.say('Type two or more choices for the list, with commas between (Paid, Owed, Later).');
      host.commit(addCheck(host.book(), host.sheet(), host.range(), { kind: 'list', items }));
      host.say(`${host.range()} takes one of: ${items.join(', ')}. Choose a cell and pick under the formula line. UNDO takes the check off.`);
      listIn.value = '';
    }, 'Make the chosen cells a drop-down list')),
    h('div.shrow', key('TICK BOXES', () => {
      host.commit(addCheck(host.book(), host.sheet(), host.range(), { kind: 'tick' }));
      host.say(`${host.range()} are tick boxes: choose one and tap TICK. UNDO takes them off.`);
    }, 'Make the chosen cells tick boxes'), key('DATES', () => {
      host.commit(addCheck(host.book(), host.sheet(), host.range(), { kind: 'date' }));
      host.say(`${host.range()} take a date: choose one and pick the date under the formula line. UNDO takes the check off.`);
    }, 'Make the chosen cells take a date'), key('NO CHECK', () => {
      const r = removeChecks(host.book(), host.sheet(), host.range());
      if (!r.n) return host.say('There is no check on the chosen cells.');
      host.commit(r.book);
      host.say('The check is off; what is in the cells stays. UNDO puts it back.');
    }, 'Take the check off the chosen cells')),
  );
  function paint(): void {
    pressed(wrapKey, !!host.fmtOf()?.w);
    pressed(headKey, header);
    pressed(bandKey, banded);
    for (const b of tones) pressed(b, b.dataset.fill === String(tableTone));
  }
  return { el, paint };
}

/** The picker under the formula line for a checked cell: the list's choices, TICK and UNTICK, or a date. Hidden for any other cell. */
export function checkPicker(host: ProHost & { put(a: string, text: string): void }): { el: HTMLElement; paint(): void } {
  const el = h('div.shvbox', { 'aria-label': 'The choices for this cell' });
  el.hidden = true;
  const dateIn = h('input', { type: 'date', 'aria-label': 'The date for this cell' }) as HTMLInputElement;
  function paint(): void {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    const a = host.at();
    const single = !host.range().includes(':');
    const k = single ? checkAt(s, a) : null;
    el.hidden = !k;
    if (!k) return clear(el);
    const v: Val = host.eng().value(s.name, a);
    if (k.kind === 'list') {
      clear(el, h('p.shvtitle', `${a}: CHOOSE ONE`), h('div.shvopts', ...(k.items ?? []).map((t) => {
        const btn = key(t, () => host.put(a, t), `Choose ${t}`);
        pressed(btn, typeof v === 'string' && v.toLowerCase() === t.toLowerCase());
        return btn;
      }), key('CLEAR', () => host.put(a, ''), `Clear ${a}`)));
    } else if (k.kind === 'tick') {
      const on = v === true;
      clear(el, h('p.shvtitle', `${a}: ${on ? 'TICKED' : 'NOT TICKED'}`), h('div.shvopts', key(on ? 'UNTICK' : 'TICK', () => host.put(a, on ? 'FALSE' : 'TRUE'), on ? `Untick ${a}` : `Tick ${a}`, 'on')));
    } else {
      if (typeof v === 'number' && v > 0) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
        dateIn.value = d.toISOString().slice(0, 10);
      } else dateIn.value = '';
      clear(el, h('p.shvtitle', `${a}: PICK A DATE`), h('div.shvopts', dateIn, key('SET THE DATE', () => {
        if (!dateIn.value) return host.say('Pick a date first.');
        const [y, m, d] = dateIn.value.split('-');
        host.put(a, `${d}/${m}/${y}`);
      }, `Set ${a} to the date picked`, 'on'), key('TODAY', () => {
        const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
        host.put(a, t);
      }, `Set ${a} to today`)));
    }
  }
  return { el, paint };
}
