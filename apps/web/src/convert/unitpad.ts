/**
 * THE UNIT PAD (FINAL ROUND, MAKE lane): CONVERT's UNITS as a dedicated unit-converter app has it — pick the kind (length, weight,
 * temperature…), type the number, pick the two units, and the answer is there as he types (no button to press), SWAP turns it round,
 * IN EVERY UNIT shows the same number in all the units of its kind, COPY puts the answer on the clipboard, and the last conversions
 * are kept on this phone (`ghosty.convert.units`) as RECENT, one tap to bring one back. "Say it" stays under it for "5 ft 10 in cm".
 * All on the phone, with the same conversions the chat answers (convert/units.ts).
 */
import { clear, h } from '../core/dom';
import { button } from '../ui/components';
import { convertByName, everyUnit, KIND_PAIR, kindOf, nice, UNIT_KINDS, unitsOfKind, type Dim, type UnitAnswer } from './units';

const KEY = 'ghosty.convert.units';
export const PAD_WORDS = {
  empty: 'Type a number and the answer shows here.',
  bad: (t: string) => `“${t.slice(0, 16)}” isn’t a number I can read. Type it like 3.5 or -40.`,
  copied: 'Copied.',
  cantCopy: 'I can’t copy on this phone just now: hold the answer to select it.',
  recentEmpty: 'Your conversions show here, kept on this phone.',
};

interface Kept {
  dim: Dim;
  from: string;
  to: string;
  value: string;
  recent: { value: number; from: string; to: string }[];
}

function load(): Kept {
  const d: Kept = { dim: 'length', from: 'mile', to: 'km', value: '1', recent: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Kept>;
    const dim = UNIT_KINDS.some(([k]) => k === s.dim) ? (s.dim as Dim) : d.dim;
    const ok = (n: unknown) => typeof n === 'string' && kindOf(n) === dim;
    const recent = Array.isArray(s.recent) ? s.recent.filter((r) => r && Number.isFinite(r.value) && kindOf(r.from) && kindOf(r.from) === kindOf(r.to)).slice(0, 8) : [];
    return { dim, from: ok(s.from) ? s.from! : KIND_PAIR[dim][0], to: ok(s.to) ? s.to! : KIND_PAIR[dim][1], value: typeof s.value === 'string' ? s.value.slice(0, 24) : d.value, recent };
  } catch {
    return d;
  }
}
function keep(k: Kept): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    /* storage unavailable: kept for this visit only */
  }
}

/** What the pad shows now, for the spec and the console. */
export const padState = { dim: '' as string, from: '', to: '', answer: '', every: 0, recent: 0 };

/** A number as he types it: commas allowed, a leading minus or the typographic one. */
export const padNumber = (t: string): number | null => {
  const s = t.trim().replace(/,/g, '').replace(/^−/, '-');
  if (!s || !/^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function unitPad(): HTMLElement {
  const k = load();
  const kind = h('select.cvpadkind', { 'aria-label': 'What kind of measurement' }, ...UNIT_KINDS.map(([id, label]) => h('option', { value: id }, label))) as HTMLSelectElement;
  const val = h('input.cvpadval', { type: 'text', inputMode: 'decimal', autocomplete: 'off', 'aria-label': 'The number to convert', placeholder: '1', enterKeyHint: 'done' }) as HTMLInputElement;
  const from = h('select.cvpadfrom', { 'aria-label': 'From this unit' }) as HTMLSelectElement;
  const to = h('select.cvpadto', { 'aria-label': 'Into this unit' }) as HTMLSelectElement;
  const ans = h('p.cvpadans', { 'aria-live': 'polite' });
  const every = h('div.cvpadevery');
  const recent = h('div.cvpadrecent');
  let last: UnitAnswer | null = null;
  let recentTimer = 0;

  const fill = (sel: HTMLSelectElement, dim: Dim, pick: string) => {
    clear(sel, ...unitsOfKind(dim).map((u) => h('option', { value: u }, u)));
    sel.value = pick;
  };
  const save = () => keep({ dim: kind.value as Dim, from: from.value, to: to.value, value: val.value, recent: k.recent });
  const paintRecent = () => {
    padState.recent = k.recent.length;
    if (!k.recent.length) return clear(recent, h('p.cvnote', { 'data-state': 'empty' }, PAD_WORDS.recentEmpty));
    clear(recent, h('small.cvgh', 'RECENT'), h('div.cvbtns', ...k.recent.map((r) => {
      const a = convertByName(r.value, r.from, r.to);
      return button(a ? a.text : `${nice(r.value)} ${r.from} → ${r.to}`, () => {
        const d = kindOf(r.from)!;
        kind.value = d;
        fill(from, d, r.from);
        fill(to, d, r.to);
        val.value = String(r.value);
        go(false);
      }, 'cvpadrec');
    })));
  };
  const remember = (a: UnitAnswer, v: number) => {
    k.recent = [{ value: v, from: a.from, to: a.to }, ...k.recent.filter((r) => !(r.value === v && r.from === a.from && r.to === a.to))].slice(0, 8);
    save();
    paintRecent();
  };
  /** The answer, worked out as he types; `note` keeps it in RECENT once he has stopped typing for a moment. */
  const go = (note = true) => {
    const v = padNumber(val.value);
    padState.dim = kind.value;
    padState.from = from.value;
    padState.to = to.value;
    clearTimeout(recentTimer);
    if (v === null) {
      last = null;
      /* state: convert.units empty */
      /* state: convert.units error */
      ans.textContent = val.value.trim() ? PAD_WORDS.bad(val.value.trim()) : PAD_WORDS.empty;
      ans.dataset.state = val.value.trim() ? 'error' : 'empty';
      clear(every);
      padState.answer = ans.textContent;
      padState.every = 0;
      save();
      return;
    }
    const a = convertByName(v, from.value, to.value);
    last = a;
    delete ans.dataset.state;
    ans.textContent = a ? `${a.text}.` : PAD_WORDS.empty;
    const all = everyUnit(v, from.value).filter((x) => x.to !== to.value);
    clear(every, h('small.cvgh', 'IN EVERY UNIT'), ...all.map((x) => h('div.cvpadrow', h('b', nice(x.value)), h('span', x.to))));
    padState.answer = ans.textContent;
    padState.every = all.length;
    save();
    if (a && note) recentTimer = window.setTimeout(() => remember(a, v), 1200);
  };
  kind.addEventListener('change', () => {
    const d = kind.value as Dim;
    fill(from, d, KIND_PAIR[d][0]);
    fill(to, d, KIND_PAIR[d][1]);
    go();
  });
  val.addEventListener('input', () => go());
  val.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && last) {
      const v = padNumber(val.value);
      if (v !== null) remember(last, v);
    }
  });
  from.addEventListener('change', () => go());
  to.addEventListener('change', () => go());
  const swap = button('SWAP', () => {
    const f = from.value;
    from.value = to.value;
    to.value = f;
    go();
  }, 'cvpadswap');
  swap.setAttribute('aria-label', 'Swap the two units');
  const copy = button('COPY', async () => {
    if (!last) return;
    try {
      await navigator.clipboard.writeText(`${nice(last.value)} ${last.to}`);
      ans.dataset.copied = '1';
      copy.textContent = PAD_WORDS.copied.toUpperCase().replace('.', '');
      window.setTimeout(() => (copy.textContent = 'COPY'), 1500);
    } catch {
      ans.textContent = `${ans.textContent} ${PAD_WORDS.cantCopy}`;
    }
  }, 'cvpadcopy');

  kind.value = k.dim;
  fill(from, k.dim, k.from);
  fill(to, k.dim, k.to);
  val.value = k.value;
  paintRecent();
  go(false);
  return h('div.cvpad', h('div.cvrow', kind), h('div.cvrow', val, from), h('div.cvrow', swap, to), ans, h('div.cvbtns', copy), every, recent);
}
