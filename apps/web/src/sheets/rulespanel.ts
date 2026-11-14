/**
 * THE RULES PANEL (NEXT ROUND, editors.u2): SPREADSHEETS → RULES. Choose the cells, pick a kind of rule (MORE THAN, LESS THAN, BETWEEN, EQUAL
 * TO, CONTAINS, OVERDUE, TOP, BOTTOM, DUPLICATES, DATA BARS, COLOUR SCALE), give its number or words and its colour, ADD THE RULE. The sheet's
 * rules are listed under it, first first, each with EDIT and DELETE; every change goes through the workbook's history, so UNDO takes it back.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import type { Book } from './model';
import { RULE_KINDS, RULE_NAMES, RULE_TONE, ruleId, ruleProblem, ruleWords, setRule, shades, TONE_WORDS, type Rule, type RuleKind } from './rules';

export interface RulesHost {
  book(): Book;
  sheet(): number;
  /** The chosen cells ("B2:B20"). */
  range(): string;
  commit(next: Book): void;
  say(words: string): void;
}

export function rulesPanel(host: RulesHost): { el: HTMLElement; paint(): void } {
  let kind: RuleKind = 'over';
  let tone: 1 | 2 | 3 | 4 | 5 = RULE_TONE.over;
  let editing = '';
  const key = (label: string, run: () => void, name = '') => {
    const b = button(label, run);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  const aIn = h('input.shrulein', { type: 'text', inputMode: 'decimal', 'aria-label': 'The number', placeholder: 'a number, like 100', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const bIn = h('input.shrulein', { type: 'text', inputMode: 'decimal', 'aria-label': 'Up to', placeholder: 'up to', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const inputs = h('div.shrow', aIn, bIn);
  const kinds = RULE_KINDS.map((k) => {
    const b = key(RULE_NAMES[k], () => {
      kind = k;
      if (!editing) tone = RULE_TONE[k];
      paintForm();
    }, `Rule: ${RULE_NAMES[k].toLowerCase()}`);
    b.dataset.kind = k;
    return b;
  });
  const swatches = ([1, 2, 3, 4, 5] as const).map((n) => {
    const b = button('', () => {
      tone = n;
      paintForm();
    }, 'shsw');
    b.setAttribute('aria-label', `Colour: ${TONE_WORDS[n]}`);
    b.dataset.fill = String(n);
    return b;
  });
  const swRow = h('div.shrow.shswrow', ...swatches);
  const addKey = key('ADD THE RULE', () => save());
  addKey.classList.add('on');
  const cancelKey = key('CANCEL', () => {
    editing = '';
    paintForm();
    host.say('Left as it was.');
  });
  const list = h('div.shrules', { role: 'list', 'aria-label': 'The rules on this sheet' });
  const el = h('div.shpanel', { role: 'tabpanel', 'aria-label': 'Rules' },
    h('p.shnote', 'Choose the cells, then a rule. The first rule that fits a cell colours it; bars and the scale shade every number by its size.'),
    h('div.shrow.shkinds', ...kinds),
    inputs, swRow,
    h('div.shrow', addKey, cancelKey),
    h('small.slh', 'THE RULES ON THIS SHEET'),
    list,
  );

  const number = (s: string): number | undefined => {
    const t = s.replace(/[£,\s]/g, '').replace(/%$/, '');
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? (/%$/.test(s.trim()) ? n / 100 : n) : NaN;
  };
  function paintForm(): void {
    for (const b of kinds) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    for (const b of swatches) b.setAttribute('aria-pressed', String(Number(b.dataset.fill) === tone));
    const needsA = ['over', 'under', 'between', 'equal', 'contains', 'top', 'bottom'].includes(kind);
    aIn.hidden = !needsA;
    bIn.hidden = kind !== 'between';
    inputs.hidden = !needsA;
    aIn.inputMode = kind === 'contains' ? 'text' : kind === 'top' || kind === 'bottom' ? 'numeric' : 'decimal';
    aIn.placeholder = kind === 'contains' ? 'the words, like paid' : kind === 'top' || kind === 'bottom' ? 'how many, like 10' : kind === 'between' ? 'from' : 'a number, like 100';
    aIn.setAttribute('aria-label', kind === 'contains' ? 'The words to look for' : kind === 'top' || kind === 'bottom' ? 'How many' : kind === 'between' ? 'From' : 'The number');
    swRow.hidden = shades(kind);
    addKey.textContent = editing ? 'SAVE THE RULE' : 'ADD THE RULE';
    cancelKey.hidden = !editing;
  }
  function save(): void {
    const b = host.book();
    const s = b.sheets[host.sheet()]!;
    const old = editing ? s.rules?.find((r) => r.id === editing) : undefined;
    const r: Rule = { id: old?.id ?? ruleId(), range: old?.range ?? host.range(), kind };
    if (!shades(kind)) r.tone = tone;
    if (kind === 'contains') r.a = aIn.value.trim();
    else if (kind === 'top' || kind === 'bottom') r.n = Number(aIn.value.trim());
    else if (kind !== 'overdue' && kind !== 'dupes' && !shades(kind)) {
      const a = number(aIn.value);
      if (a !== undefined) r.a = a;
      if (kind === 'between') {
        const bb = number(bIn.value);
        if (bb !== undefined) r.b = bb;
      }
    }
    const bad = ruleProblem(r);
    if (bad) return host.say(bad);
    host.commit({ ...b, at: Date.now(), sheets: b.sheets.map((x, i) => (i === host.sheet() ? setRule(x, r) : x)) });
    host.say(`${old ? 'Changed' : 'Added'}: ${ruleWords(r)}. UNDO takes it back.`);
    editing = '';
    aIn.value = '';
    bIn.value = '';
    paint();
  }
  function paint(): void {
    const s = host.book().sheets[host.sheet()]!;
    const rules = s.rules ?? [];
    if (editing && !rules.some((r) => r.id === editing)) editing = '';
    clear(list, ...(rules.length
      ? rules.map((r, i) => h('div.shrule', { role: 'listitem', dataset: { id: r.id } },
        h('span.shruledot', { dataset: shades(r.kind) ? { shade: r.kind } : { fill: String(r.tone ?? RULE_TONE[r.kind]) }, 'aria-hidden': 'true' }),
        h('span.shrulewords', `${i + 1}. ${ruleWords(r)}`),
        h('div.shrow',
          key('EDIT', () => {
            editing = r.id;
            kind = r.kind;
            tone = r.tone ?? RULE_TONE[r.kind];
            aIn.value = r.kind === 'top' || r.kind === 'bottom' ? String(r.n ?? '') : r.a !== undefined ? String(r.a) : '';
            bIn.value = r.b !== undefined ? String(r.b) : '';
            paintForm();
            host.say(`Editing rule ${i + 1}: change it, then SAVE THE RULE.`);
          }, `Edit rule ${i + 1}`),
          key('DELETE', () => {
            const b = host.book();
            host.commit({ ...b, at: Date.now(), sheets: b.sheets.map((x, k) => (k === host.sheet() ? setRule(x, null, r.id) : x)) });
            host.say(`Rule ${i + 1} deleted. UNDO brings it back.`);
            paint();
          }, `Delete rule ${i + 1}`))))
      : [h('p.shnote', 'No rules on this sheet yet. Choose some cells and add one.')]));
    paintForm();
  }
  // (painted when the panel is shown: the workbook is not open yet when the panel is made)
  return { el, paint };
}
