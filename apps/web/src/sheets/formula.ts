/**
 * THE FORMULA ENGINE (BRIEF-EDITOR-SPREADSHEETS): Excel's grammar read and worked out by the app's own code, no package. A tokeniser and parser
 * (numbers, text, true and false, references A1 and $A$1 and A1:B9 and whole columns, other sheets' references, named ranges, + - * / ^ & = <> < >
 * <= >=, unary minus, percent, brackets, function calls, array constants), a table of the functions a budget needs, each worked the way Excel
 * works it, and the Engine: a dependency graph that works out again only what a change touches, a cycle said as #CIRCULAR! (in his words, not a
 * silent zero), and arrays that spill (UNIQUE, SORT, FILTER). Errors are Excel's own, each with his one line. Pure.
 */
import { addr, isErr, err, sheetIndex, type Book, type ErrCode, type Val } from './model';
import { formatValue } from './model';
import { applyCode, dateOf, general, nowSerial, plain, roundHalf, serialOf } from './numfmt';
import { colIndex, MAXC, MAXR, parseRange, tokenize, type Tok } from './tokens';

type Matrix = Val[][] & { ref?: boolean; org?: { si: number; r: number; c: number } };
type Res = Val | Matrix | undefined;
const isMat = (x: unknown): x is Matrix => Array.isArray(x);

class XlError extends Error {
  constructor(public code: ErrCode) {
    super(code);
  }
}
const bad = (c: ErrCode): never => {
  throw new XlError(c);
};

// ---------------------------------------------------------------- the syntax tree
type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: ErrCode }
  | { k: 'miss' }
  | { k: 'ref'; sheet?: string; r1: number; c1: number; r2: number; c2: number; whole?: boolean }
  | { k: 'name'; name: string }
  | { k: 'un'; op: '-' | '+'; a: Node }
  | { k: 'pct'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'arr'; rows: Node[][] };

class Parser {
  private i = 0;
  private toks: Tok[];
  constructor(f: string) {
    this.toks = tokenize(f).filter((t) => t.t !== 'ws');
  }
  parse(): Node {
    const n = this.cmp();
    if (this.i < this.toks.length) throw new Error('something left over');
    return n;
  }
  private peek = (): Tok | undefined => this.toks[this.i];
  private isOp(...ops: string[]): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && ops.includes(t.src);
  }
  private cmp(): Node {
    let a = this.cat();
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) a = { k: 'bin', op: this.toks[this.i++]!.src, a, b: this.cat() };
    return a;
  }
  private cat(): Node {
    let a = this.add();
    while (this.isOp('&')) {
      this.i++;
      a = { k: 'bin', op: '&', a, b: this.add() };
    }
    return a;
  }
  private add(): Node {
    let a = this.mul();
    while (this.isOp('+', '-')) a = { k: 'bin', op: this.toks[this.i++]!.src, a, b: this.mul() };
    return a;
  }
  private mul(): Node {
    let a = this.pow();
    while (this.isOp('*', '/')) a = { k: 'bin', op: this.toks[this.i++]!.src, a, b: this.pow() };
    return a;
  }
  private pow(): Node {
    let a = this.unary();
    while (this.isOp('^')) {
      this.i++;
      a = { k: 'bin', op: '^', a, b: this.unary() };
    }
    return a;
  }
  private unary(): Node {
    if (this.isOp('-', '+')) {
      const op = this.toks[this.i++]!.src as '-' | '+';
      return { k: 'un', op, a: this.unary() };
    }
    let a = this.primary();
    while (this.isOp('%')) {
      this.i++;
      a = { k: 'pct', a };
    }
    return a;
  }
  private primary(): Node {
    const t = this.toks[this.i++];
    if (!t) throw new Error('it stops too soon');
    switch (t.t) {
      case 'num':
        return { k: 'num', v: t.v };
      case 'str':
        return { k: 'str', v: t.v };
      case 'err':
        return { k: 'err', v: t.v as ErrCode };
      case 'ref': {
        const b = t.b ?? t.a;
        return { k: 'ref', ...(t.sheet !== undefined ? { sheet: t.sheet } : {}), r1: Math.min(t.a.r, b.r), c1: Math.min(t.a.c, b.c), r2: Math.max(t.a.r, b.r), c2: Math.max(t.a.c, b.c) };
      }
      case 'colrange':
        return { k: 'ref', ...(t.sheet !== undefined ? { sheet: t.sheet } : {}), r1: 0, r2: MAXR - 1, c1: Math.min(t.c1, t.c2), c2: Math.max(t.c1, t.c2), whole: true };
      case '(': {
        const n = this.cmp();
        if (this.toks[this.i++]?.t !== ')') throw new Error('a bracket is not closed');
        return n;
      }
      case '{': {
        const rows: Node[][] = [[]];
        for (;;) {
          rows[rows.length - 1]!.push(this.cmp());
          const s = this.toks[this.i++];
          if (s?.t === ',') continue;
          if (s?.t === ';') rows.push([]);
          else if (s?.t === '}') break;
          else throw new Error('an array is not closed');
        }
        return { k: 'arr', rows };
      }
      case 'name': {
        if (this.peek()?.t === '(') {
          this.i++;
          const args: Node[] = [];
          if (this.peek()?.t === ')') {
            this.i++;
            return { k: 'call', name: t.src.toUpperCase(), args };
          }
          for (;;) {
            if (this.peek()?.t === ',' || this.peek()?.t === ')') args.push({ k: 'miss' });
            else args.push(this.cmp());
            const s = this.toks[this.i++];
            if (s?.t === ',') continue;
            if (s?.t === ')') break;
            throw new Error('a bracket is not closed');
          }
          return { k: 'call', name: t.src.toUpperCase(), args };
        }
        if (/^true$/i.test(t.src)) return { k: 'bool', v: true };
        if (/^false$/i.test(t.src)) return { k: 'bool', v: false };
        return { k: 'name', name: t.src };
      }
      default:
        throw new Error(`${t.src} where a value should be`);
    }
  }
}

// ---------------------------------------------------------------- his words for the errors
const EXPLAIN: Record<ErrCode, string> = {
  '#DIV/0!': 'This divides by zero, or by an empty cell, and nothing can be divided by nothing.',
  '#REF!': 'This points at a cell or a sheet that isn’t there any more.',
  '#NAME?': 'I don’t know a function or a name spelt like that: check the spelling, or that the name exists.',
  '#VALUE!': 'This does sums with something that isn’t a number, like words in a cell it adds up.',
  '#N/A': 'What it looks for isn’t there, so there is no answer to give.',
  '#NUM!': 'The sum has no answer as an ordinary number, like the square root of a minus.',
  '#CALC!': 'This filter found nothing that matches, so it has nothing to show.',
  '#SPILL!': 'This wants to fill the cells below or beside it, but something is already in the way.',
  '#CIRCULAR!': 'These cells point at each other in a loop, so none of them can settle on a number: change one so the loop breaks.',
};

// ---------------------------------------------------------------- values
const rank = (v: Val): number => (typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3);
const approx = (a: number, b: number): boolean => a === b || Number(a.toPrecision(15)) === Number(b.toPrecision(15));
function cmp(a: Val, b: Val): number {
  if (isErr(a)) return bad(a.e);
  if (isErr(b)) return bad(b.e);
  if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number') return approx(a, b as number) ? 0 : a < (b as number) ? -1 : 1;
  if (typeof a === 'string') {
    const x = a.toLowerCase();
    const y = (b as string).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b as boolean);
}
/** Text that stands for a number: 1,234.5, 12%, £5, 5/3/2024, 2024-03-05. */
function numericText(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)) return Number(t);
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  let m: RegExpExecArray | null;
  if ((m = /^([+-]?)(\d+(?:\.\d+)?)%$/.exec(t))) return Number(`${m[1]}${m[2]}`) / 100;
  if ((m = /^([+-]?)[£$€]\s?([\d,]+(?:\.\d+)?)$/.exec(t))) return Number(`${m[1]}${m[2]!.replace(/,/g, '')}`);
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return serialOf(Number(m[1]), Number(m[2]), Number(m[3]));
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) return serialOf(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}
function toNum(v: Val | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isErr(v)) return bad(v.e);
  const n = numericText(v);
  return n === null ? bad('#VALUE!') : n;
}
function toStr(v: Val | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (isErr(v)) return bad(v.e);
  return plain(v);
}
function toBool(v: Val | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (isErr(v)) return bad(v.e);
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  return bad('#VALUE!');
}
const mat = (x: Res): Val[][] => (isMat(x) ? x : [[x === undefined ? null : x]]);
const flatten = (x: Res): Val[] => mat(x).flat();

/** A criterion as COUNTIF reads it: ">5", "<=3", "<>x", "=x", "ab*", a number, a word. */
function criterion(c: Val): (v: Val) => boolean {
  if (typeof c === 'number') return (v) => (typeof v === 'number' ? approx(v, c) : typeof v === 'string' && numericText(v) === c);
  if (typeof c === 'boolean') return (v) => v === c;
  if (isErr(c)) return (v) => isErr(v) && v.e === c.e;
  if (c === null) return (v) => v === 0;
  const m = /^(>=|<=|<>|>|<|=)?([\s\S]*)$/.exec(c)!;
  const op = m[1] ?? '=';
  const rest = m[2]!;
  const n = rest === '' ? null : numericText(rest);
  if (n !== null) {
    const eq = (v: Val) => (typeof v === 'number' ? approx(v, n) : typeof v === 'string' && numericText(v) === n);
    if (op === '=') return eq;
    if (op === '<>') return (v) => !eq(v);
    return (v) => typeof v === 'number' && (op === '>' ? v > n : op === '<' ? v < n : op === '>=' ? v >= n : v <= n);
  }
  if (rest === '' && (op === '=' || op === '<>')) return (v) => (v === null || v === '') === (op === '=');
  const re = new RegExp(`^${rest.replace(/~([*?])|([.+^${}()|[\]\\])|(\*)|(\?)/g, (_, esc: string, sp: string, star: string, q: string) => (esc ? `\\${esc}` : sp ? `\\${sp}` : star ? '[\\s\\S]*' : '[\\s\\S]')) }$`, 'i');
  if (op === '=') return (v) => typeof v === 'string' && re.test(v);
  if (op === '<>') return (v) => !(typeof v === 'string' && re.test(v));
  const low = rest.toLowerCase();
  return (v) => typeof v === 'string' && (op === '>' ? v.toLowerCase() > low : op === '<' ? v.toLowerCase() < low : op === '>=' ? v.toLowerCase() >= low : v.toLowerCase() <= low);
}
/** An exact match (text with * and ? as wildcards) used by the lookups. */
function exact(look: Val): (v: Val) => boolean {
  if (typeof look === 'string' && /[*?]/.test(look)) return criterion(`=${look}`);
  return (v) => v !== null && !isErr(v) && rank(v) === rank(look) && cmp(v, look) === 0;
}

// ---------------------------------------------------------------- the functions
interface Ctx {
  eng: Engine;
  si: number;
  r: number;
  c: number;
}
type Fn = (a: Res[], x: Ctx) => Res;
const scalar = (m: Res, x: Ctx): Val => {
  if (!isMat(m)) return m === undefined ? null : m;
  if (m.length === 1 && m[0]!.length === 1) return m[0]![0]!;
  if (m.org) {
    if (m[0]!.length === 1 && x.r >= m.org.r && x.r < m.org.r + m.length) return m[x.r - m.org.r]![0]!;
    if (m.length === 1 && x.c >= m.org.c && x.c < m.org.c + m[0]!.length) return m[0]![x.c - m.org.c]!;
  }
  return bad('#VALUE!');
};
const num = (a: Res, x: Ctx, d = 0): number => (a === undefined ? d : toNum(scalar(a, x)));
const str = (a: Res, x: Ctx, d = ''): string => (a === undefined ? d : toStr(scalar(a, x)));
const has = (a: Res): boolean => a !== undefined;

/** The numbers an aggregate reads: in a range only numbers, among the arguments the numbers, true and false and text that is one. */
function numbers(args: Res[], x: Ctx, direct = true): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a === undefined) continue;
    if (isMat(a)) {
      for (const v of a.flat()) {
        if (isErr(v)) bad(v.e);
        if (typeof v === 'number') out.push(v);
        else if (a.ref !== true && typeof v === 'boolean') out.push(v ? 1 : 0);
      }
    } else if (isErr(a)) bad(a.e);
    else if (direct && a !== null) out.push(toNum(a));
  }
  return out;
}
const sumOf = (xs: number[]): number => xs.reduce((s, v) => s + v, 0);

function* eachCell(m: Val[][]): Generator<[number, number, Val]> {
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i]!.length; j++) yield [i, j, m[i]![j]!];
}
/** The cells where every (range, criterion) pair holds, as [row, column]. */
function matching(pairs: Res[], x: Ctx): [number, number][] {
  if (pairs.length < 2 || pairs.length % 2) return bad('#VALUE!');
  const ranges = [] as Val[][][];
  const tests = [] as ((v: Val) => boolean)[];
  for (let i = 0; i < pairs.length; i += 2) {
    ranges.push(mat(pairs[i]));
    tests.push(criterion(scalar(pairs[i + 1], x)));
  }
  const h = ranges[0]!.length;
  const w = ranges[0]![0]!.length;
  if (ranges.some((g) => g.length !== h || g[0]!.length !== w)) bad('#VALUE!');
  const out: [number, number][] = [];
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (tests.every((t, k) => t(ranges[k]![i]![j]!))) out.push([i, j]);
  return out;
}

const monthsBetween = (a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number => (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

function pmt(rate: number, n: number, pv: number, fv: number, type: number): number {
  if (rate === 0) return -(pv + fv) / n;
  const g = (1 + rate) ** n;
  return (-(pv * g + fv) * rate) / ((1 + rate * type) * (g - 1));
}
function fvOf(rate: number, n: number, p: number, pv: number, type: number): number {
  if (rate === 0) return -(pv + p * n);
  const g = (1 + rate) ** n;
  return -(pv * g + (p * (1 + rate * type) * (g - 1)) / rate);
}
function pvOf(rate: number, n: number, p: number, fv: number, type: number): number {
  if (rate === 0) return -(fv + p * n);
  const g = (1 + rate) ** n;
  return -(fv + (p * (1 + rate * type) * (g - 1)) / rate) / g;
}

const text2 = (s: string, f: (t: string) => string): string => f(s);
const properCase = (s: string): string => s.toLowerCase().replace(/(^|[^A-Za-z])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

const F: Record<string, Fn> = {
  SUM: (a, x) => sumOf(numbers(a, x)),
  AVERAGE: (a, x) => {
    const n = numbers(a, x);
    return n.length ? sumOf(n) / n.length : bad('#DIV/0!');
  },
  MIN: (a, x) => {
    const n = numbers(a, x);
    return n.length ? n.reduce((m, v) => Math.min(m, v)) : 0;
  },
  MAX: (a, x) => {
    const n = numbers(a, x);
    return n.length ? n.reduce((m, v) => Math.max(m, v)) : 0;
  },
  COUNT: (a) => {
    let n = 0;
    for (const v of a) {
      if (v === undefined) continue;
      if (isMat(v)) n += v.flat().filter((e) => typeof e === 'number').length;
      else if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && numericText(v) !== null)) n++;
    }
    return n;
  },
  COUNTA: (a) => a.reduce<number>((n, v) => n + (v === undefined ? 0 : isMat(v) ? v.flat().filter((e) => e !== null).length : v === null ? 0 : 1), 0),
  COUNTBLANK: (a) => flatten(a[0]).filter((v) => v === null || v === '').length,
  COUNTIF: (a, x) => matching([a[0], a[1]], x).length,
  COUNTIFS: (a, x) => matching(a, x).length,
  SUMIF: (a, x) => {
    const hit = matching([a[0], a[1]], x);
    const g = mat(has(a[2]) ? a[2] : a[0]);
    return sumOf(hit.map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number'));
  },
  SUMIFS: (a, x) => {
    const hit = matching(a.slice(1), x);
    const g = mat(a[0]);
    return sumOf(hit.map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number'));
  },
  AVERAGEIF: (a, x) => {
    const hit = matching([a[0], a[1]], x);
    const g = mat(has(a[2]) ? a[2] : a[0]);
    const n = hit.map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number');
    return n.length ? sumOf(n) / n.length : bad('#DIV/0!');
  },
  AVERAGEIFS: (a, x) => {
    const g = mat(a[0]);
    const n = matching(a.slice(1), x).map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number');
    return n.length ? sumOf(n) / n.length : bad('#DIV/0!');
  },
  MAXIFS: (a, x) => {
    const g = mat(a[0]);
    const n = matching(a.slice(1), x).map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number');
    return n.length ? Math.max(...n) : 0;
  },
  MINIFS: (a, x) => {
    const g = mat(a[0]);
    const n = matching(a.slice(1), x).map(([i, j]) => g[i]?.[j]).filter((v): v is number => typeof v === 'number');
    return n.length ? Math.min(...n) : 0;
  },
  NOT: (a, x) => !toBool(scalar(a[0], x)),
  AND: (a) => {
    const vs = a.flatMap((v) => (isMat(v) ? v.flat().filter((e) => typeof e === 'boolean' || typeof e === 'number' || isErr(e)) : [v === undefined ? null : v])).filter((v) => v !== null);
    if (!vs.length) return bad('#VALUE!');
    return vs.every((v) => toBool(v));
  },
  OR: (a) => {
    const vs = a.flatMap((v) => (isMat(v) ? v.flat().filter((e) => typeof e === 'boolean' || typeof e === 'number' || isErr(e)) : [v === undefined ? null : v])).filter((v) => v !== null);
    if (!vs.length) return bad('#VALUE!');
    return vs.some((v) => toBool(v));
  },
  TRUE: () => true,
  FALSE: () => false,
  ROUND: (a, x) => roundHalf(num(a[0], x), Math.trunc(num(a[1], x))),
  ROUNDUP: (a, x) => {
    const v = num(a[0], x);
    const d = Math.trunc(num(a[1], x));
    const k = 10 ** d;
    return Math.sign(v) * Math.ceil(Number((Math.abs(v) * k).toPrecision(15))) / k;
  },
  ROUNDDOWN: (a, x) => {
    const v = num(a[0], x);
    const d = Math.trunc(num(a[1], x));
    const k = 10 ** d;
    return Math.sign(v) * Math.floor(Number((Math.abs(v) * k).toPrecision(15))) / k;
  },
  TRUNC: (a, x) => F.ROUNDDOWN!([a[0], a[1] === undefined ? 0 : a[1]], x),
  INT: (a, x) => Math.floor(num(a[0], x)),
  MOD: (a, x) => {
    const n = num(a[0], x);
    const d = num(a[1], x);
    if (d === 0) return bad('#DIV/0!');
    return n - d * Math.floor(n / d);
  },
  ABS: (a, x) => Math.abs(num(a[0], x)),
  SIGN: (a, x) => Math.sign(num(a[0], x)),
  SQRT: (a, x) => {
    const v = num(a[0], x);
    return v < 0 ? bad('#NUM!') : Math.sqrt(v);
  },
  POWER: (a, x) => {
    const r = num(a[0], x) ** num(a[1], x);
    return Number.isNaN(r) || !Number.isFinite(r) ? bad('#NUM!') : r;
  },
  EXP: (a, x) => Math.exp(num(a[0], x)),
  LN: (a, x) => (num(a[0], x) <= 0 ? bad('#NUM!') : Math.log(num(a[0], x))),
  LOG10: (a, x) => (num(a[0], x) <= 0 ? bad('#NUM!') : Math.log10(num(a[0], x))),
  LOG: (a, x) => (num(a[0], x) <= 0 ? bad('#NUM!') : Math.log(num(a[0], x)) / Math.log(num(a[1], x, 10))),
  PI: () => Math.PI,
  CEILING: (a, x) => {
    const s = num(a[1], x, 1);
    return s === 0 ? 0 : Math.ceil(Number((num(a[0], x) / s).toPrecision(15))) * s;
  },
  FLOOR: (a, x) => {
    const s = num(a[1], x, 1);
    return s === 0 ? 0 : Math.floor(Number((num(a[0], x) / s).toPrecision(15))) * s;
  },
  ISBLANK: (a) => a[0] === undefined || scalarOf(a[0]) === null,
  ISNUMBER: (a) => typeof scalarOf(a[0]) === 'number',
  ISTEXT: (a) => typeof scalarOf(a[0]) === 'string',
  ISLOGICAL: (a) => typeof scalarOf(a[0]) === 'boolean',
  ISERROR: (a) => isErr(scalarOf(a[0])),
  ISERR: (a) => {
    const v = scalarOf(a[0]);
    return isErr(v) && v.e !== '#N/A';
  },
  ISNA: (a) => {
    const v = scalarOf(a[0]);
    return isErr(v) && v.e === '#N/A';
  },
  NA: () => err('#N/A'),
  N: (a) => {
    const v = scalarOf(a[0]);
    return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : 0;
  },
  // lookups
  VLOOKUP: (a, x) => lookup(a, x, false),
  HLOOKUP: (a, x) => lookup(a, x, true),
  XLOOKUP: (a, x) => {
    const look = scalar(a[0], x);
    const la = mat(a[1]);
    const ra = mat(a[2]);
    const vertical = la[0]!.length === 1;
    const items = vertical ? la.map((r) => r[0]!) : la[0]!;
    const mode = Math.trunc(num(a[4], x, 0));
    const from = Math.trunc(num(a[5], x, 1));
    const idxs = items.map((_, i) => i);
    if (from < 0) idxs.reverse();
    let hit = -1;
    if (mode === 0 || mode === 2) {
      const t = mode === 2 ? criterion(typeof look === 'string' ? `=${look}` : look) : exact(typeof look === 'string' ? look.replace(/[*?]/g, '~$&') : look);
      hit = idxs.find((i) => t(items[i]!)) ?? -1;
    } else {
      let best = -1;
      for (const i of idxs) {
        const v = items[i]!;
        if (v === null || isErr(v) || rank(v) !== rank(look)) continue;
        const d = cmp(v, look);
        if (d === 0) {
          best = i;
          break;
        }
        if ((mode < 0 && d < 0) || (mode > 0 && d > 0)) if (best < 0 || (mode < 0 ? cmp(v, items[best]!) > 0 : cmp(v, items[best]!) < 0)) best = i;
      }
      hit = best;
    }
    if (hit < 0) return has(a[3]) ? scalar(a[3], x) : bad('#N/A');
    if (vertical) return ra.length === la.length ? (ra[hit]!.length === 1 ? ra[hit]![0]! : [ra[hit]!]) : bad('#VALUE!');
    return ra[0]!.length === la[0]!.length ? (ra.length === 1 ? ra[0]![hit]! : ra.map((r) => [r[hit]!])) : bad('#VALUE!');
  },
  INDEX: (a, x) => {
    const g = mat(a[0]);
    const h = g.length;
    const w = g[0]!.length;
    let r = Math.trunc(num(a[1], x));
    let c = has(a[2]) ? Math.trunc(num(a[2], x)) : -1;
    if (c < 0) {
      if (w === 1) {
        c = 1;
      } else if (h === 1) {
        c = r;
        r = 1;
      } else c = 0;
    }
    if (r < 0 || c < 0 || r > h || c > w) return bad('#REF!');
    if (r === 0 && c === 0) return g;
    if (r === 0) return g.map((row) => [row[c - 1]!]);
    if (c === 0) return [g[r - 1]!];
    return g[r - 1]![c - 1]!;
  },
  MATCH: (a, x) => {
    const look = scalar(a[0], x);
    const items = flatten(a[1]);
    const type = Math.trunc(num(a[2], x, 1));
    if (type === 0) {
      const t = exact(look);
      const i = items.findIndex((v) => t(v));
      return i < 0 ? bad('#N/A') : i + 1;
    }
    let best = -1;
    for (let i = 0; i < items.length; i++) {
      const v = items[i]!;
      if (v === null || isErr(v) || rank(v) !== rank(look)) continue;
      const d = cmp(v, look);
      if (type > 0 ? d <= 0 : d >= 0) best = i;
      else break;
    }
    return best < 0 ? bad('#N/A') : best + 1;
  },
  ROWS: (a) => mat(a[0]).length,
  COLUMNS: (a) => mat(a[0])[0]!.length,
  CHOOSE: (a, x) => {
    const i = Math.trunc(num(a[0], x));
    return i < 1 || i >= a.length ? bad('#VALUE!') : a[i];
  },
  // dates
  TODAY: () => Math.floor(nowSerial()),
  NOW: () => nowSerial(),
  DATE: (a, x) => {
    let y = Math.trunc(num(a[0], x));
    const m = Math.trunc(num(a[1], x));
    const d = Math.trunc(num(a[2], x));
    if (y < 0 || y > 9999) return bad('#NUM!');
    if (y < 1900) y += 1900;
    const s = serialOf(y, m, d);
    return s < 0 ? bad('#NUM!') : s;
  },
  YEAR: (a, x) => dateOf(num(a[0], x)).y,
  MONTH: (a, x) => dateOf(num(a[0], x)).m,
  DAY: (a, x) => dateOf(num(a[0], x)).d,
  WEEKDAY: (a, x) => {
    const dow = dateOf(num(a[0], x)).dow;
    const t = Math.trunc(num(a[1], x, 1));
    return t === 2 ? ((dow + 6) % 7) + 1 : t === 3 ? (dow + 6) % 7 : dow + 1;
  },
  EOMONTH: (a, x) => {
    const d = dateOf(num(a[0], x));
    const mo = Math.trunc(num(a[1], x));
    return serialOf(d.y, d.m + mo + 1, 0);
  },
  DATEDIF: (a, x) => {
    const s = num(a[0], x);
    const e = num(a[1], x);
    if (s > e) return bad('#NUM!');
    const A = dateOf(s);
    const B = dateOf(e);
    const unit = str(a[2], x).toUpperCase();
    const months = monthsBetween(A, B);
    switch (unit) {
      case 'Y':
        return Math.floor(months / 12);
      case 'M':
        return months;
      case 'D':
        return Math.floor(e) - Math.floor(s);
      case 'YM':
        return months % 12;
      case 'MD':
        return B.d >= A.d ? B.d - A.d : daysIn(B.m === 1 ? B.y - 1 : B.y, B.m === 1 ? 12 : B.m - 1) - A.d + B.d;
      case 'YD': {
        let y = B.y;
        let st = serialOf(y, A.m, A.d);
        if (st > Math.floor(e)) st = serialOf(--y, A.m, A.d);
        return Math.floor(e) - st;
      }
      default:
        return bad('#NUM!');
    }
  },
  NETWORKDAYS: (a, x) => {
    let s = Math.floor(num(a[0], x));
    let e = Math.floor(num(a[1], x));
    const holidays = new Set(has(a[2]) ? flatten(a[2]).filter((v) => typeof v === 'number').map((v) => Math.floor(v as number)) : []);
    const sign = s > e ? -1 : 1;
    if (sign < 0) [s, e] = [e, s];
    let n = 0;
    for (let d = s; d <= e; d++) {
      const dow = dateOf(d).dow;
      if (dow !== 0 && dow !== 6 && !holidays.has(d)) n++;
    }
    return n * sign;
  },
  // text
  LEN: (a, x) => [...str(a[0], x)].length,
  LEFT: (a, x) => [...str(a[0], x)].slice(0, Math.max(0, Math.trunc(num(a[1], x, 1)))).join(''),
  RIGHT: (a, x) => {
    const s = [...str(a[0], x)];
    const n = Math.max(0, Math.trunc(num(a[1], x, 1)));
    return n === 0 ? '' : s.slice(-n).join('');
  },
  MID: (a, x) => {
    const start = Math.trunc(num(a[1], x));
    const n = Math.trunc(num(a[2], x));
    return start < 1 || n < 0 ? bad('#VALUE!') : [...str(a[0], x)].slice(start - 1, start - 1 + n).join('');
  },
  TRIM: (a, x) => text2(str(a[0], x), (s) => s.replace(/ +/g, ' ').trim()),
  UPPER: (a, x) => str(a[0], x).toUpperCase(),
  LOWER: (a, x) => str(a[0], x).toLowerCase(),
  PROPER: (a, x) => properCase(str(a[0], x)),
  CONCAT: (a) => a.map((v) => flatten(v).map((e) => toStr(e)).join('')).join(''),
  CONCATENATE: (a, x) => F.CONCAT!(a, x),
  TEXTJOIN: (a, x) => {
    const d = str(a[0], x);
    const skip = toBool(scalar(a[1], x));
    return a
      .slice(2)
      .flatMap((v) => flatten(v))
      .map((v) => toStr(v))
      .filter((s) => !skip || s !== '')
      .join(d);
  },
  REPT: (a, x) => str(a[0], x).repeat(Math.max(0, Math.trunc(num(a[1], x)))),
  EXACT: (a, x) => str(a[0], x) === str(a[1], x),
  SUBSTITUTE: (a, x) => {
    const s = str(a[0], x);
    const old = str(a[1], x);
    const neu = str(a[2], x);
    if (!old) return s;
    if (!has(a[3])) return s.split(old).join(neu);
    const n = Math.trunc(num(a[3], x));
    let at = -1;
    for (let k = 0; k < n; k++) {
      at = s.indexOf(old, at + 1);
      if (at < 0) return s;
    }
    return s.slice(0, at) + neu + s.slice(at + old.length);
  },
  FIND: (a, x) => {
    const at = str(a[1], x).indexOf(str(a[0], x), Math.trunc(num(a[2], x, 1)) - 1);
    return at < 0 ? bad('#VALUE!') : at + 1;
  },
  SEARCH: (a, x) => {
    const at = str(a[1], x).toLowerCase().indexOf(str(a[0], x).toLowerCase(), Math.trunc(num(a[2], x, 1)) - 1);
    return at < 0 ? bad('#VALUE!') : at + 1;
  },
  VALUE: (a, x) => {
    const v = scalar(a[0], x);
    if (typeof v === 'number') return v;
    const n = typeof v === 'string' ? numericText(v) : null;
    return n === null ? bad('#VALUE!') : n;
  },
  TEXT: (a, x) => {
    const v = scalar(a[0], x);
    if (typeof v === 'string') {
      const n = numericText(v);
      return n === null ? v : applyCode(n, str(a[1], x));
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return applyCode(toNum(v), str(a[1], x));
  },
  // money
  PMT: (a, x) => pmt(num(a[0], x), num(a[1], x), num(a[2], x), num(a[3], x), num(a[4], x)),
  FV: (a, x) => fvOf(num(a[0], x), num(a[1], x), num(a[2], x), num(a[3], x), num(a[4], x)),
  PV: (a, x) => pvOf(num(a[0], x), num(a[1], x), num(a[2], x), num(a[3], x), num(a[4], x)),
  NPV: (a, x) => {
    const r = num(a[0], x);
    return numbers(a.slice(1), x).reduce((s, v, i) => s + v / (1 + r) ** (i + 1), 0);
  },
  // statistics
  MEDIAN: (a, x) => {
    const n = numbers(a, x).sort((p, q) => p - q);
    if (!n.length) return bad('#NUM!');
    const m = n.length >> 1;
    return n.length % 2 ? n[m]! : (n[m - 1]! + n[m]!) / 2;
  },
  LARGE: (a, x) => {
    const n = numbers([a[0]], x).sort((p, q) => q - p);
    const k = Math.trunc(num(a[1], x));
    return k < 1 || k > n.length ? bad('#NUM!') : n[k - 1]!;
  },
  SMALL: (a, x) => {
    const n = numbers([a[0]], x).sort((p, q) => p - q);
    const k = Math.trunc(num(a[1], x));
    return k < 1 || k > n.length ? bad('#NUM!') : n[k - 1]!;
  },
  RANK: (a, x) => {
    const v = num(a[0], x);
    const n = numbers([a[1]], x);
    if (!n.some((q) => approx(q, v))) return bad('#N/A');
    const asc = num(a[2], x, 0) !== 0;
    return 1 + n.filter((q) => (asc ? q < v : q > v) && !approx(q, v)).length;
  },
  STDEV: (a, x) => {
    const n = numbers(a, x);
    if (n.length < 2) return bad('#DIV/0!');
    const m = sumOf(n) / n.length;
    return Math.sqrt(n.reduce((s, v) => s + (v - m) ** 2, 0) / (n.length - 1));
  },
  STDEVP: (a, x) => {
    const n = numbers(a, x);
    if (!n.length) return bad('#DIV/0!');
    const m = sumOf(n) / n.length;
    return Math.sqrt(n.reduce((s, v) => s + (v - m) ** 2, 0) / n.length);
  },
  SUMPRODUCT: (a) => {
    const ms = a.map((v) => mat(v));
    const h = ms[0]!.length;
    const w = ms[0]![0]!.length;
    if (ms.some((m) => m.length !== h || m[0]!.length !== w)) return bad('#VALUE!');
    let s = 0;
    for (let i = 0; i < h; i++)
      for (let j = 0; j < w; j++) {
        let p = 1;
        for (const m of ms) {
          const v = m[i]![j]!;
          if (isErr(v)) bad(v.e);
          p *= typeof v === 'number' ? v : 0;
        }
        s += p;
      }
    return s;
  },
  // arrays that spill
  UNIQUE: (a) => {
    const g = mat(a[0]);
    const byCol = has(a[1]) && toBool(scalarOf(a[1]));
    const items = byCol ? g[0]!.map((_, j) => g.map((r) => r[j]!)) : g;
    const key = (r: Val[]) => JSON.stringify(r.map((v) => (typeof v === 'string' ? v.toLowerCase() : v)));
    const count = new Map<string, number>();
    for (const r of items) count.set(key(r), (count.get(key(r)) ?? 0) + 1);
    const once = has(a[2]) && toBool(scalarOf(a[2]));
    const seen = new Set<string>();
    const out = items.filter((r) => {
      const k = key(r);
      if (seen.has(k) || (once && count.get(k)! > 1)) return false;
      seen.add(k);
      return true;
    });
    if (!out.length) return bad('#CALC!');
    return byCol ? out[0]!.map((_, j) => out.map((r) => r[j]!)) : out;
  },
  SORT: (a, x) => {
    const g = mat(a[0]);
    const byCol = has(a[3]) && toBool(scalar(a[3], x));
    const idx = Math.trunc(num(a[1], x, 1)) - 1;
    const dir = num(a[2], x, 1) < 0 ? -1 : 1;
    const items = byCol ? g[0]!.map((_, j) => g.map((r) => r[j]!)) : g.map((r) => [...r]);
    if (idx < 0 || idx >= items[0]!.length) return bad('#VALUE!');
    const sorted = items.map((r, i) => ({ r, i })).sort((p, q) => {
      const u = p.r[idx]!;
      const v = q.r[idx]!;
      if (u === null && v === null) return p.i - q.i;
      if (u === null) return 1;
      if (v === null) return -1;
      return dir * cmp(u, v) || p.i - q.i;
    }).map((o) => o.r);
    return byCol ? sorted[0]!.map((_, j) => sorted.map((r) => r[j]!)) : sorted;
  },
  FILTER: (a, x) => {
    const g = mat(a[0]);
    const inc = mat(a[1]);
    const rows = inc.length === g.length && inc[0]!.length === 1;
    const cols = inc.length === 1 && inc[0]!.length === g[0]!.length;
    if (!rows && !cols) return bad('#VALUE!');
    const keep = (v: Val) => toBool(v);
    let out: Val[][];
    if (rows) out = g.filter((_, i) => keep(inc[i]![0]!));
    else {
      const ks = inc[0]!.map((v, j) => (keep(v) ? j : -1)).filter((j) => j >= 0);
      out = ks.length ? g.map((r) => ks.map((j) => r[j]!)) : [];
    }
    if (!out.length) return has(a[2]) ? scalar(a[2], x) : bad('#CALC!');
    return out;
  },
  SEQUENCE: (a, x) => {
    const h = Math.trunc(num(a[0], x, 1));
    const w = Math.trunc(num(a[1], x, 1));
    const s = num(a[2], x, 1);
    const st = num(a[3], x, 1);
    if (h < 1 || w < 1 || h * w > 100_000) return bad('#VALUE!');
    return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => s + (i * w + j) * st));
  },
  TRANSPOSE: (a) => {
    const g = mat(a[0]);
    return g[0]!.map((_, j) => g.map((r) => r[j]!));
  },
};
function scalarOf(a: Res): Val {
  return isMat(a) ? (a.length === 1 && a[0]!.length === 1 ? a[0]![0]! : bad('#VALUE!')) : a === undefined ? null : a;
}
function lookup(a: Res[], x: Ctx, horizontal: boolean): Res {
  const look = scalar(a[0], x);
  let g = mat(a[1]);
  if (horizontal) g = g[0]!.map((_, j) => g.map((r) => r[j]!));
  const col = Math.trunc(num(a[2], x));
  const approxMatch = has(a[3]) ? toBool(scalar(a[3], x)) : true;
  if (col < 1) return bad('#VALUE!');
  if (col > g[0]!.length) return bad('#REF!');
  let hit = -1;
  if (!approxMatch) {
    const t = exact(look);
    hit = g.findIndex((r) => t(r[0]!));
  } else {
    for (let i = 0; i < g.length; i++) {
      const v = g[i]![0]!;
      if (v === null || isErr(v) || rank(v) !== rank(look)) continue;
      if (cmp(v, look) <= 0) hit = i;
      else break;
    }
  }
  if (hit < 0) return bad('#N/A');
  const v = g[hit]![col - 1]!;
  return v === null ? 0 : v;
}

const ALIASES: Record<string, string> = { 'STDEV.S': 'STDEV', 'STDEV.P': 'STDEVP', 'RANK.EQ': 'RANK', 'CEILING.MATH': 'CEILING', 'FLOOR.MATH': 'FLOOR', 'CONCATENATE': 'CONCAT' };
/** The names of the functions this engine has, for the formula line's offer as he types. */
export const FUNCTION_NAMES: string[] = [...Object.keys(F), 'IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH'].filter((n) => !['TRUE', 'FALSE', 'CONCATENATE'].includes(n)).sort();
/** Whether a function name (as a file writes it, `_xlfn.` and all) is one this engine works out. */
export const hasFunction = (n: string): boolean => {
  const s = cleanName(n.toUpperCase());
  return s in F || ['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH'].includes(s);
};
const cleanName = (n: string): string => {
  const s = n.replace(/^_XLFN\./, '').replace(/^_XLWS\./, '');
  return ALIASES[s] ?? s;
};

// ---------------------------------------------------------------- the working out
function elementwise(a: Res, b: Res, f: (p: Val, q: Val) => Val): Matrix {
  const A = mat(a);
  const B = mat(b);
  const h = Math.max(A.length, B.length);
  const w = Math.max(A[0]!.length, B[0]!.length);
  if ((A.length > 1 && B.length > 1 && A.length !== B.length) || (A[0]!.length > 1 && B[0]!.length > 1 && A[0]!.length !== B[0]!.length)) {
    return Array.from({ length: h }, () => Array.from({ length: w }, () => err('#N/A')));
  }
  const at = (g: Val[][], i: number, j: number): Val => g[g.length === 1 ? 0 : i]![g[0]!.length === 1 ? 0 : j]!;
  return Array.from({ length: h }, (_, i) =>
    Array.from({ length: w }, (_, j) => {
      try {
        return f(at(A, i, j), at(B, i, j));
      } catch (e) {
        if (e instanceof XlError) return err(e.code);
        throw e;
      }
    }),
  );
}
const big = (x: Res): boolean => isMat(x) && (x.length > 1 || x[0]!.length > 1);
function arith(op: string, p: Val, q: Val): Val {
  if (op === '&') return toStr(p) + toStr(q);
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const d = cmp(p, q);
    return op === '=' ? d === 0 : op === '<>' ? d !== 0 : op === '<' ? d < 0 : op === '>' ? d > 0 : op === '<=' ? d <= 0 : d >= 0;
  }
  const u = toNum(p);
  const v = toNum(q);
  switch (op) {
    case '+':
      return u + v;
    case '-':
      return u - v;
    case '*':
      return u * v;
    case '/':
      return v === 0 ? bad('#DIV/0!') : u / v;
    default: {
      if (u === 0 && v === 0) return bad('#NUM!');
      const r = u ** v;
      return Number.isNaN(r) || !Number.isFinite(r) ? bad('#NUM!') : r;
    }
  }
}

export class Engine {
  book!: Book;
  stats = { evaluated: 0 };
  private cache: Map<number, Val>[] = [];
  private visiting = new Set<string>();
  private asts = new Map<string, Node | null>();
  private depsOf = new Map<string, { si: number; r1: number; c1: number; r2: number; c2: number }[]>();
  private spill = new Map<string, Val>();
  private regions = new Map<string, { si: number; r: number; c: number; h: number; w: number }>();
  private spillers = new Set<string>();

  constructor(book: Book) {
    this.setBook(book);
  }
  static explain(code: ErrCode | string): string {
    return EXPLAIN[code as ErrCode] ?? 'I couldn’t work this one out.';
  }
  private setBook(book: Book): void {
    this.book = book;
    while (this.cache.length < book.sheets.length) this.cache.push(new Map());
    this.cache.length = book.sheets.length;
    this.spillers.clear();
    book.sheets.forEach((s, si) => {
      for (const [a, c] of Object.entries(s.cells)) {
        if (c.f !== undefined && /\b(?:UNIQUE|SORT|SORTBY|FILTER|SEQUENCE|TRANSPOSE)\s*\(/i.test(c.f)) {
          const p = parseCellKey(a);
          if (p) this.spillers.add(`${si}:${p.r * 128 + p.c}`);
        }
      }
    });
  }

  /** The value a cell has (empty is null). */
  value(sheet: string, a: string): Val {
    const si = sheetIndex(this.book, sheet);
    const p = parseCellKey(a);
    if (si < 0 || !p) return err('#REF!');
    return this.get(si, p.r, p.c);
  }
  /** The arrays that spilled (for the .xlsx's array formulas): where each begins and how far it runs, on its sheet. */
  spills(): { sheet: string; r: number; c: number; h: number; w: number }[] {
    return [...this.regions.values()].map((g) => ({ sheet: this.book.sheets[g.si]!.name, r: g.r, c: g.c, h: g.h, w: g.w }));
  }
  /** The text a cell shows: its value by its own format. */
  text(sheet: string, a: string): string {
    const si = sheetIndex(this.book, sheet);
    const v = this.value(sheet, a);
    const cell = si >= 0 ? this.book.sheets[si]!.cells[a.toUpperCase()] : undefined;
    return formatValue(v, cell?.x);
  }

  /** The workbook changed: take the new one, and forget what the changed cells (and what leans on them) had worked out. How many formulas must be worked out again. */
  update(book: Book, changed?: string[]): number {
    const oldNames = this.book.sheets.map((s) => s.name).join('\u0000');
    this.setBook(book);
    const formulaKeys: { si: number; r: number; c: number; text: string }[] = [];
    book.sheets.forEach((s, si) => {
      for (const [a, c] of Object.entries(s.cells)) {
        if (c.f === undefined) continue;
        const p = parseCellKey(a);
        if (p) formulaKeys.push({ si, r: p.r, c: p.c, text: c.f });
      }
    });
    if (!changed || oldNames !== book.sheets.map((s) => s.name).join('\u0000')) {
      for (const m of this.cache) m.clear();
      this.spill.clear();
      this.regions.clear();
      return formulaKeys.length;
    }
    const dirty = new Set<string>();
    const dirtyList: { si: number; r: number; c: number }[] = [];
    const mark = (si: number, r: number, c: number): boolean => {
      const k = `${si}:${r * 128 + c}`;
      if (dirty.has(k)) return false;
      dirty.add(k);
      dirtyList.push({ si, r, c });
      return true;
    };
    for (const ch of changed) {
      const [sn, a] = ch.split('!');
      const si = sheetIndex(book, sn ?? '');
      const p = a ? parseCellKey(a) : null;
      if (si >= 0 && p) mark(si, p.r, p.c);
    }
    // an owner whose spill a changed cell is inside of is dirty too, and so are the cells it fills
    let grew = true;
    const inRect = (d: { si: number; r: number; c: number }, g: { si: number; r1: number; c1: number; r2: number; c2: number }) => d.si === g.si && d.r >= g.r1 && d.r <= g.r2 && d.c >= g.c1 && d.c <= g.c2;
    const formulaDirty = new Set<string>();
    const volatile = /\b(?:TODAY|NOW|RAND|RANDBETWEEN)\s*\(/i;
    while (grew) {
      grew = false;
      for (const [ok, rg] of this.regions) {
        if (dirty.has(ok)) continue;
        if (dirtyList.some((d) => inRect(d, { si: rg.si, r1: rg.r, c1: rg.c, r2: rg.r + rg.h - 1, c2: rg.c + rg.w - 1 }))) {
          const [si, n] = ok.split(':').map(Number) as [number, number];
          mark(si, Math.floor(n / 128), n % 128);
          grew = true;
        }
      }
      for (const [ok, rg] of this.regions) {
        if (!dirty.has(ok)) continue;
        for (let i = 0; i < rg.h; i++) for (let j = 0; j < rg.w; j++) if (mark(rg.si, rg.r + i, rg.c + j)) grew = true;
      }
      for (const f of formulaKeys) {
        const k = `${f.si}:${f.r * 128 + f.c}`;
        if (dirty.has(k)) continue;
        if (volatile.test(f.text) || this.deps(f.si, f.text).some((g) => dirtyList.some((d) => inRect(d, g)))) {
          mark(f.si, f.r, f.c);
          grew = true;
        }
      }
    }
    for (const f of formulaKeys) if (dirty.has(`${f.si}:${f.r * 128 + f.c}`)) formulaDirty.add(`${f.si}:${f.r * 128 + f.c}`);
    for (const d of dirtyList) {
      this.cache[d.si]?.delete(d.r * 128 + d.c);
      this.spill.delete(`${d.si}:${d.r * 128 + d.c}`);
    }
    for (const [ok] of this.regions) if (!formulaKeys.some((f) => `${f.si}:${f.r * 128 + f.c}` === ok)) this.regions.delete(ok);
    return formulaDirty.size;
  }

  private parse(f: string): Node | null {
    let n = this.asts.get(f);
    if (n === undefined) {
      try {
        n = new Parser(f).parse();
      } catch {
        n = null;
      }
      this.asts.set(f, n);
    }
    return n;
  }
  /** What a formula reads: its ranges (names opened up). */
  private deps(si: number, f: string): { si: number; r1: number; c1: number; r2: number; c2: number }[] {
    const key = `${si}|${f}`;
    let out = this.depsOf.get(key);
    if (out) return out;
    out = [];
    const walk = (n: Node) => {
      switch (n.k) {
        case 'ref': {
          const s = n.sheet === undefined ? si : sheetIndex(this.book, n.sheet);
          if (s >= 0) out!.push({ si: s, r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2 });
          break;
        }
        case 'name': {
          const target = Object.entries(this.book.names).find(([k]) => k.toLowerCase() === n.name.toLowerCase())?.[1];
          const g = target ? this.nameRange(target, si) : null;
          if (g) out!.push(g);
          break;
        }
        case 'un':
        case 'pct':
          walk(n.a);
          break;
        case 'bin':
          walk(n.a);
          walk(n.b);
          break;
        case 'call':
          n.args.forEach(walk);
          break;
        case 'arr':
          n.rows.flat().forEach(walk);
          break;
        default:
      }
    };
    const ast = this.parse(f);
    if (ast) walk(ast);
    this.depsOf.set(key, out);
    return out;
  }
  private nameRange(target: string, si: number): { si: number; r1: number; c1: number; r2: number; c2: number } | null {
    const bang = target.lastIndexOf('!');
    const sheetName = bang >= 0 ? target.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'") : '';
    const s = bang >= 0 ? sheetIndex(this.book, sheetName) : si;
    const g = parseRange(target.replace(/\$/g, ''));
    return s >= 0 && g ? { si: s, ...g } : null;
  }

  private get(si: number, r: number, c: number): Val {
    const sheet = this.book.sheets[si];
    if (!sheet || r < 0 || c < 0 || r >= MAXR || c >= MAXC) return err('#REF!');
    const cell = sheet.cells[addr(r, c)];
    if (cell?.f !== undefined) return this.compute(si, r, c, cell.f);
    if (cell?.v !== undefined) return cell.v;
    return this.fromSpill(si, r, c);
  }
  private isComputed(k: string): boolean {
    const [si, n] = k.split(':').map(Number) as [number, number];
    return this.cache[si]?.has(n) === true;
  }
  private fromSpill(si: number, r: number, c: number): Val {
    const k = `${si}:${r * 128 + c}`;
    const v = this.spill.get(k);
    if (v !== undefined) return v;
    for (const [ok, g] of this.regions) if (g.si === si && r >= g.r && r < g.r + g.h && c >= g.c && c < g.c + g.w && !this.isComputed(ok)) this.computeKey(ok);
    for (const s of this.spillers) if (!this.isComputed(s)) this.computeKey(s);
    return this.spill.get(k) ?? null;
  }
  private computeKey(k: string): void {
    const [si, n] = k.split(':').map(Number) as [number, number];
    const cell = this.book.sheets[si]?.cells[addr(Math.floor(n / 128), n % 128)];
    if (cell?.f !== undefined) this.compute(si, Math.floor(n / 128), n % 128, cell.f);
  }
  private compute(si: number, r: number, c: number, f: string): Val {
    const cache = this.cache[si]!;
    const n = r * 128 + c;
    const hit = cache.get(n);
    if (hit !== undefined) return hit;
    const vk = `${si}:${n}`;
    if (this.visiting.has(vk)) return err('#CIRCULAR!');
    this.visiting.add(vk);
    this.stats.evaluated++;
    let out: Val;
    try {
      const ast = this.parse(f);
      if (!ast) out = err('#NAME?');
      else {
        let res: Res = this.run(ast, { eng: this, si, r, c });
        if (isMat(res) && (res.length > 1 || res[0]!.length > 1)) out = this.place(si, r, c, res as Val[][]);
        else {
          this.clearRegion(vk);
          res = scalarOf(res);
          out = res === undefined ? null : res;
        }
      }
    } catch (e) {
      if (e instanceof XlError) {
        this.clearRegion(vk);
        out = err(e.code);
      } else throw e;
    } finally {
      this.visiting.delete(vk);
    }
    cache.set(n, out === null ? 0 : out);
    return out === null ? 0 : out;
  }
  private clearRegion(vk: string): void {
    const g = this.regions.get(vk);
    if (!g) return;
    for (let i = 0; i < g.h; i++) for (let j = 0; j < g.w; j++) this.spill.delete(`${g.si}:${(g.r + i) * 128 + g.c + j}`);
    this.regions.delete(vk);
  }
  private place(si: number, r: number, c: number, m: Val[][]): Val {
    const vk = `${si}:${r * 128 + c}`;
    this.clearRegion(vk);
    const h = m.length;
    const w = m[0]!.length;
    if (r + h > MAXR || c + w > MAXC) return err('#SPILL!');
    const sheet = this.book.sheets[si]!;
    for (let i = 0; i < h; i++)
      for (let j = 0; j < w; j++) {
        if (!i && !j) continue;
        const cell = sheet.cells[addr(r + i, c + j)];
        if (cell && (cell.f !== undefined || cell.v !== undefined)) return err('#SPILL!');
        for (const [ok, g] of this.regions) if (ok !== vk && g.si === si && r + i >= g.r && r + i < g.r + g.h && c + j >= g.c && c + j < g.c + g.w) return err('#SPILL!');
      }
    this.regions.set(vk, { si, r, c, h, w });
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (i || j) this.spill.set(`${si}:${(r + i) * 128 + c + j}`, m[i]![j]!);
    return m[0]![0]!;
  }

  private readRange(si: number, g: { r1: number; c1: number; r2: number; c2: number }, whole = false): Matrix {
    let r2 = g.r2;
    if (whole) {
      const used = usedRowsOf(this.book.sheets[si]!);
      r2 = Math.max(0, Math.min(r2, used - 1));
    }
    const rows: Val[][] = [];
    for (let r = g.r1; r <= r2; r++) {
      const row: Val[] = [];
      for (let c = g.c1; c <= Math.min(g.c2, MAXC - 1); c++) row.push(this.get(si, r, c));
      rows.push(row);
    }
    const m = rows as Matrix;
    m.ref = true;
    m.org = { si, r: g.r1, c: g.c1 };
    return m;
  }

  private run(n: Node, x: Ctx): Res {
    switch (n.k) {
      case 'num':
      case 'str':
      case 'bool':
        return n.v;
      case 'err':
        return err(n.v);
      case 'miss':
        return undefined;
      case 'ref': {
        const si = n.sheet === undefined ? x.si : sheetIndex(this.book, n.sheet);
        if (si < 0) return bad('#REF!');
        return this.readRange(si, n, n.whole);
      }
      case 'name': {
        const target = Object.entries(this.book.names).find(([k]) => k.toLowerCase() === n.name.toLowerCase())?.[1];
        if (!target) return bad('#NAME?');
        const g = this.nameRange(target, x.si);
        return g ? this.readRange(g.si, g) : bad('#REF!');
      }
      case 'un': {
        const a = this.run(n.a, x);
        if (big(a)) return elementwise(a, 0, (p) => (n.op === '-' ? -toNum(p) : toNum(p)));
        const v = scalar(a, x);
        return n.op === '-' ? -toNum(v) : v;
      }
      case 'pct': {
        const a = this.run(n.a, x);
        return big(a) ? elementwise(a, 0, (p) => toNum(p) / 100) : toNum(scalar(a, x)) / 100;
      }
      case 'bin': {
        const a = this.run(n.a, x);
        const b = this.run(n.b, x);
        if (big(a) || big(b)) return elementwise(a, b, (p, q) => arith(n.op, p, q));
        return arith(n.op, scalar(a, x), scalar(b, x));
      }
      case 'arr':
        return n.rows.map((row) => row.map((e) => scalar(this.run(e, x), x)));
      case 'call':
        return this.call(n, x);
    }
  }
  private call(n: Extract<Node, { k: 'call' }>, x: Ctx): Res {
    const name = cleanName(n.name);
    switch (name) {
      case 'IF': {
        if (n.args.length < 2 || n.args.length > 3) return bad('#VALUE!');
        const cond = this.run(n.args[0]!, x);
        if (big(cond)) {
          const yes = n.args[1] ? this.run(n.args[1], x) : true;
          const no = n.args[2] ? this.run(n.args[2], x) : false;
          return elementwise(cond, elementwise(yes, no, (p, q) => [p, q] as unknown as Val), (p, pair) => {
            const [y, z] = pair as unknown as [Val, Val];
            return toBool(p) ? y : z;
          });
        }
        if (toBool(scalar(cond, x))) return n.args[1]!.k === 'miss' ? 0 : this.run(n.args[1]!, x);
        return n.args[2] ? (n.args[2].k === 'miss' ? 0 : this.run(n.args[2], x)) : false;
      }
      case 'IFS': {
        if (n.args.length < 2 || n.args.length % 2) return bad('#VALUE!');
        for (let i = 0; i < n.args.length; i += 2) if (toBool(scalar(this.run(n.args[i]!, x), x))) return this.run(n.args[i + 1]!, x);
        return bad('#N/A');
      }
      case 'SWITCH': {
        const v = scalar(this.run(n.args[0]!, x), x);
        let i = 1;
        for (; i + 1 < n.args.length; i += 2) if (cmp(v, scalar(this.run(n.args[i]!, x), x)) === 0) return this.run(n.args[i + 1]!, x);
        return i < n.args.length ? this.run(n.args[i]!, x) : bad('#N/A');
      }
      case 'IFERROR':
      case 'IFNA': {
        if (n.args.length !== 2) return bad('#VALUE!');
        try {
          const v = this.run(n.args[0]!, x);
          const s = big(v) ? v : scalar(v, x);
          if (isErr(s) && (name === 'IFERROR' || s.e === '#N/A')) return this.run(n.args[1]!, x);
          return s;
        } catch (e) {
          if (e instanceof XlError && (name === 'IFERROR' || e.code === '#N/A')) return this.run(n.args[1]!, x);
          throw e;
        }
      }
      default:
    }
    const fn = F[name];
    if (!fn) return bad('#NAME?');
    const catching = /^IS(?:ERR|ERROR|NA|NUMBER|TEXT|BLANK|LOGICAL)$/.test(name);
    const args = n.args.map((a) => {
      try {
        return this.run(a, x);
      } catch (e) {
        if (catching && e instanceof XlError) return err(e.code);
        throw e;
      }
    });
    return fn(args, x);
  }
}

function parseCellKey(a: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]{1,3})(\d{1,6})$/.exec(a);
  if (!m) return null;
  const c = colIndex(m[1]!);
  const r = Number(m[2]) - 1;
  return c < 0 || r < 0 || c >= 128 ? null : { r, c };
}
const usedCache = new WeakMap<object, number>();
function usedRowsOf(s: { cells: Record<string, unknown> }): number {
  let u = usedCache.get(s.cells);
  if (u === undefined) {
    u = 0;
    for (const k of Object.keys(s.cells)) {
      const p = parseCellKey(k);
      if (p && p.r + 1 > u) u = p.r + 1;
    }
    usedCache.set(s.cells, u);
  }
  return u;
}
export { general };
