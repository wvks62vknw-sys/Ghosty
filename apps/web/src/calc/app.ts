/**
 * THE CALCULATOR (APPS ROUND, polish3.n2), an app of its own built on the App Kit (ui/appkit.ts): a display and a keypad of
 * 44 pt keys (and a hardware keyboard: digits, + − * /, Enter, Backspace, Escape), sums worked out on the phone with no
 * request (calc/eval.ts), and the TAPE: every answer kept as a row he can tap to use again, search, delete with UNDO, and
 * share as CSV. Opened from the chat ("calculator", "open the calculator") and from System.
 */
import { h } from '../core/dom';
import { modal } from '../ui/components';
import { app, type KitApp } from '../ui/appkit';
import { key } from '../ui/machine';
import { calc, pretty, show } from './eval';

export const CALC_GLYPH = '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>';

export const calcState = { open: false, shown: '0', sum: '', tape: 0, why: '' };

/** The keypad, row by row: what each key shows and what it types ('' for the keys that act). */
const PAD: [string, string][][] = [
  [['C', ''], ['(', '('], [')', ')'], ['÷', '÷']],
  [['7', '7'], ['8', '8'], ['9', '9'], ['×', '×']],
  [['4', '4'], ['5', '5'], ['6', '6'], ['−', '−']],
  [['1', '1'], ['2', '2'], ['3', '3'], ['+', '+']],
  [['%', '%'], ['0', '0'], ['.', '.'], ['=', '']],
];

export function openCalculator(start = ''): KitApp {
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.calcApp = calcState;
  calcState.open = true;
  const host = h('div.calchost', { dataset: { case: 'keep' } });
  const onKey = (ev: KeyboardEvent) => {
    if ((ev.target as HTMLElement | null)?.closest('input, textarea')) return;
    const map: Record<string, string> = { '*': '×', x: '×', '/': '÷', '-': '−' };
    if (/^[0-9.+()%^]$/.test(ev.key) || ev.key in map) type(map[ev.key] ?? ev.key);
    else if (ev.key === 'Enter' || ev.key === '=') equals();
    else if (ev.key === 'Backspace') back();
    else return;
    ev.preventDefault();
    ev.stopPropagation(); // ("/" is also the app's own search key: while the calculator is open, it divides)
  };
  modal('CALCULATOR', host, () => {
    calcState.open = false;
    removeEventListener('keydown', onKey, true);
  });
  addEventListener('keydown', onKey, true);

  let sum = start;
  let fresh = false; // the last key was =: a digit starts a new sum, a sign carries the answer on
  const line = h('p.calcsum', { 'aria-live': 'polite' });
  const big = h('p.calcbig', { role: 'status', 'aria-live': 'polite' });
  // the answer tapped: copied, to paste anywhere (the phone's clipboard; nothing leaves the phone)
  const copyKey = key('Copy', async () => {
    const v = live();
    if (!v) return k.notice('Nothing to copy yet.');
    try {
      await navigator.clipboard.writeText(v.replace(/,/g, '').replace('−', '-'));
      k.notice(`Copied ${v}.`, { tone: 'ok' });
    } catch {
      k.notice('This phone did not allow copying here.');
    }
  }, { kind: 'ghost', label: 'Copy the answer' });
  const backKey = key('', () => back(), { kind: 'ghost', label: 'Delete the last key', glyph: '<path d="M9 6h11v12H9l-5-6z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>' });
  const pad = h('div.calcpad', { role: 'group', 'aria-label': 'Keypad' });
  for (const row of PAD) for (const [label, types] of row) {
    const b = key(label, () => (label === 'C' ? clearAll() : label === '=' ? equals() : type(types)), { kind: label === '=' ? 'fill' : /[0-9.]/.test(label) ? 'line' : 'ghost', label: { '÷': 'divide', '×': 'times', '−': 'minus', '+': 'plus', '%': 'percent', C: 'clear', '=': 'equals' }[label] ?? label });
    b.dataset.calc = label;
    pad.append(b);
  }
  const stage = h('div.calcstage', h('div.calcdisplay', h('div.calcread', line, big), h('div.calcside', copyKey, backKey)), pad);

  const k = app(host, {
    id: 'calculator',
    name: 'Calculator',
    glyph: CALC_GLYPH,
    noun: ['sum', 'sums'],
    sample: [
      { id: 'k-1', title: '1,250 × 12', meta: '15,000', sum: '1250×12' },
      { id: 'k-2', title: '64.80 + 15%', meta: '74.52', sum: '64.80+15%' },
    ],
    tour: ['The tape keeps every answer, newest first. Tap one to use it again.', 'Tap ✕ to delete one: Undo puts it back.', 'Settings shares the tape as a spreadsheet file.'],
    open: (item) => {
      sum = typeof item.sum === 'string' ? item.sum : '';
      fresh = false;
      paint();
    },
  });
  k.el.insertBefore(stage, k.body);

  const live = () => {
    const r = calc(sum);
    return r.ok ? show(r.value) : '';
  };
  const paint = (why = '') => {
    line.textContent = sum ? pretty(sum) : ' ';
    big.textContent = why || live() || (sum ? '…' : '0');
    big.dataset.state = why ? 'error' : '';
    Object.assign(calcState, { shown: big.textContent, sum, tape: k.items().length, why });
  };
  const type = (t: string) => {
    if (fresh) {
      fresh = false;
      const last = calc(sum);
      sum = /[0-9.(]/.test(t) || !last.ok ? '' : String(last.value);
    }
    if (sum.length >= 80) return k.notice('That sum is long enough. Press = first.');
    sum += t;
    paint();
  };
  const back = () => {
    fresh = false;
    sum = sum.slice(0, -1);
    paint();
  };
  const clearAll = () => {
    sum = '';
    fresh = false;
    paint();
  };
  const equals = () => {
    const r = calc(sum);
    if (!r.ok) return paint(r.why);
    k.add({ id: `k${Date.now()}`, title: pretty(sum), meta: show(r.value), sum });
    sum = String(Number(r.value.toPrecision(12)));
    fresh = true;
    line.textContent = '';
    paint();
    line.textContent = k.items()[0]?.title ?? '';
  };
  paint();
  return k;
}
