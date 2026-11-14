/**
 * COLOUR CELLS BY RULES (NEXT ROUND, editors.u2; Excel's and Numbers' conditional formatting): each sheet keeps a list of rules, each over a
 * range: more than, less than, between, equal to, text that contains, a date that is overdue (before today, London's today), the top or
 * bottom N, duplicates, and two that shade every cell by its size (data bars, a colour scale from red to green). The first colour rule that
 * fits a cell colours it, in one of the house's five fills; bars and the scale draw beside it. Worked out from the values the formula engine
 * gives, so a rule follows the numbers. Written into an .xlsx as Excel's own conditionalFormatting and read back from one (xlsx.ts and
 * xlsxread.ts). Pure.
 */
import { parseRange, type Rect } from './tokens';
import { addr, isErr, type Sheet, type Val } from './model';
import { serialOf } from './numfmt';

export type RuleKind = 'over' | 'under' | 'between' | 'equal' | 'contains' | 'overdue' | 'top' | 'bottom' | 'dupes' | 'bars' | 'scale';
export interface Rule {
  id: string;
  /** The cells it looks at ("B2:B20"), on its own sheet. */
  range: string;
  kind: RuleKind;
  /** The number it compares with (more than, less than, equal, the low end of between), or the words (contains). */
  a?: number | string;
  /** The high end of between. */
  b?: number;
  /** How many (top, bottom). */
  n?: number;
  /** One of the house's five fills (a colour rule). */
  tone?: 1 | 2 | 3 | 4 | 5;
}
/** What the rules make of one cell: a fill, a bar's length (0 to 1), a place on the scale (0 red to 1 green). */
export interface Mark {
  tone?: 1 | 2 | 3 | 4 | 5;
  bar?: number;
  scale?: number;
}

export const RULE_KINDS: RuleKind[] = ['over', 'under', 'between', 'equal', 'contains', 'overdue', 'top', 'bottom', 'dupes', 'bars', 'scale'];
/** What each is called on its key, and the colour it starts with. */
export const RULE_NAMES: Record<RuleKind, string> = { over: 'MORE THAN', under: 'LESS THAN', between: 'BETWEEN', equal: 'EQUAL TO', contains: 'CONTAINS', overdue: 'OVERDUE', top: 'TOP', bottom: 'BOTTOM', dupes: 'DUPLICATES', bars: 'DATA BARS', scale: 'COLOUR SCALE' };
export const RULE_TONE: Record<RuleKind, 1 | 2 | 3 | 4 | 5> = { over: 3, under: 4, between: 2, equal: 1, contains: 1, overdue: 4, top: 3, bottom: 4, dupes: 2, bars: 1, scale: 3 };
export const TONE_WORDS = ['', 'blue', 'amber', 'green', 'red', 'grey'] as const;
export const shades = (k: RuleKind): boolean => k === 'bars' || k === 'scale';

let seq = 0;
export const ruleId = (): string => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Today in London as a date serial (the day Excel would count), from a time in ms. */
export function londonToday(now = Date.now()): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(now));
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return serialOf(n('year'), n('month'), n('day'));
}

/** The rule in his words ("B2:B20: more than 100, green"). */
export function ruleWords(r: Rule): string {
  const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-GB') : String(v ?? ''));
  const what: Record<RuleKind, string> = {
    over: `more than ${num(r.a)}`,
    under: `less than ${num(r.a)}`,
    between: `between ${num(r.a)} and ${num(r.b)}`,
    equal: `equal to ${num(r.a)}`,
    contains: `contains “${r.a ?? ''}”`,
    overdue: 'a date before today',
    top: `the top ${r.n ?? 10}`,
    bottom: `the bottom ${r.n ?? 10}`,
    dupes: 'the same as another',
    bars: 'data bars by size',
    scale: 'a colour scale, red low to green high',
  };
  return `${r.range}: ${what[r.kind]}${shades(r.kind) ? '' : `, ${TONE_WORDS[r.tone ?? RULE_TONE[r.kind]]}`}`;
}

/** What is wrong with a rule before it is added, in his words ('' when nothing). */
export function ruleProblem(r: Rule): string {
  const g = parseRange(r.range);
  if (!g) return 'Choose the cells the rule looks at first.';
  if ((r.kind === 'over' || r.kind === 'under' || r.kind === 'equal' || r.kind === 'between') && (typeof r.a !== 'number' || !Number.isFinite(r.a))) return 'Type the number to compare with.';
  if (r.kind === 'between' && (typeof r.b !== 'number' || !Number.isFinite(r.b))) return 'Type both ends: from, then to.';
  if (r.kind === 'contains' && !String(r.a ?? '').trim()) return 'Type the words to look for.';
  if ((r.kind === 'top' || r.kind === 'bottom') && (!r.n || r.n < 1 || !Number.isInteger(r.n))) return 'Say how many: a whole number, 1 or more.';
  return '';
}

const cellsOf = (g: Rect, cap = 20000): string[] => {
  const out: string[] = [];
  for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (out.push(addr(r, c)) >= cap) return out;
  return out;
};
const keyOf = (v: Val): string | null => (v === null || v === undefined || v === '' || isErr(v) ? null : typeof v === 'string' ? `s:${v.trim().toLowerCase()}` : `${typeof v}:${v}`);

/**
 * Every mark the sheet's rules make, by cell address. `value` gives a cell's worked-out value; `today` is London's today as a serial.
 * A range is capped (20,000 cells a rule) so a rule over a whole column stays quick.
 */
export function ruleMarks(s: Sheet, value: (a: string) => Val, today: number): Map<string, Mark> {
  const out = new Map<string, Mark>();
  const mark = (a: string): Mark => out.get(a) ?? (out.set(a, {}), out.get(a)!);
  for (const r of s.rules ?? []) {
    const g = parseRange(r.range);
    if (!g) continue;
    const cells = cellsOf(g);
    const vals = cells.map((a) => value(a));
    const nums = vals.map((v) => (typeof v === 'number' ? v : null));
    const tone = r.tone ?? RULE_TONE[r.kind];
    const paint = (i: number) => {
      const m = mark(cells[i]!);
      if (m.tone === undefined) m.tone = tone;
    };
    if (r.kind === 'bars' || r.kind === 'scale') {
      const live = nums.filter((x): x is number => x !== null);
      if (!live.length) continue;
      const lo = r.kind === 'bars' ? Math.min(0, ...live) : Math.min(...live);
      const hi = Math.max(...live);
      nums.forEach((x, i) => {
        if (x === null) return;
        const k = hi === lo ? 1 : (x - lo) / (hi - lo);
        const m = mark(cells[i]!);
        if (r.kind === 'bars') m.bar ??= Math.max(0, Math.min(1, k));
        else m.scale ??= Math.max(0, Math.min(1, k));
      });
      continue;
    }
    if (r.kind === 'top' || r.kind === 'bottom') {
      const live = nums.map((x, i) => [x, i] as const).filter((p): p is readonly [number, number] => p[0] !== null);
      live.sort((p, q) => (r.kind === 'top' ? q[0] - p[0] : p[0] - q[0]));
      const n = Math.max(1, r.n ?? 10);
      // ties at the edge come in too, as Excel's do
      const edge = live[Math.min(n, live.length) - 1]?.[0];
      for (const [x, i] of live) if (r.kind === 'top' ? x >= edge! : x <= edge!) paint(i);
      continue;
    }
    if (r.kind === 'dupes') {
      const count = new Map<string, number>();
      for (const v of vals) {
        const k = keyOf(v);
        if (k) count.set(k, (count.get(k) ?? 0) + 1);
      }
      vals.forEach((v, i) => {
        const k = keyOf(v);
        if (k && count.get(k)! > 1) paint(i);
      });
      continue;
    }
    vals.forEach((v, i) => {
      const x = nums[i] ?? null;
      const a = typeof r.a === 'number' ? r.a : Number(r.a);
      let fits = false;
      if (r.kind === 'over') fits = x !== null && x > a;
      else if (r.kind === 'under') fits = x !== null && x < a;
      else if (r.kind === 'equal') fits = x !== null ? x === a : typeof v === 'string' && v.trim().toLowerCase() === String(r.a ?? '').trim().toLowerCase();
      else if (r.kind === 'between') {
        const [lo, hi] = [Math.min(a, r.b ?? a), Math.max(a, r.b ?? a)];
        fits = x !== null && x >= lo && x <= hi;
      } else if (r.kind === 'contains') fits = v !== null && v !== undefined && !isErr(v) && String(v).toLowerCase().includes(String(r.a ?? '').toLowerCase());
      else if (r.kind === 'overdue') fits = x !== null && x >= 1 && Math.floor(x) < today;
      if (fits) paint(i);
    });
  }
  return out;
}

/** The sheet with one rule added, changed (same id) or taken away (null). */
export function setRule(s: Sheet, r: Rule | null, removeId?: string): Sheet {
  const list = s.rules ?? [];
  if (!r) return { ...s, rules: list.filter((x) => x.id !== removeId) };
  const at = list.findIndex((x) => x.id === r.id);
  return { ...s, rules: at < 0 ? [...list, r] : list.map((x, i) => (i === at ? r : x)) };
}
