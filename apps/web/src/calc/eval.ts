/**
 * THE CALCULATOR's sums (APPS ROUND): what he types worked out on the phone, with no eval and no request. Numbers with a
 * decimal point, + − × ÷, brackets, a percent (50% is 0.5; 200 + 10% is 220, as a shop calculator does), powers (^) and a
 * minus in front. Pure: the words in, the answer out, or why not in plain words.
 */

export type Sum = { ok: true; value: number } | { ok: false; why: string };

/** Why a sum cannot be worked out, in his words (thrown inside the parser, caught at its top). */
class SumError {
  constructor(readonly why: string) {}
}

type Tok = { k: 'n'; v: number } | { k: 'op'; v: string } | { k: '('; v: '(' } | { k: ')'; v: ')' } | { k: '%'; v: '%' };

/** His symbols to the parser's: × and x and * multiply, ÷ and / divide, − and – subtract. */
export const normalise = (s: string): string => s.replace(/[×xX*]/g, '*').replace(/[÷/]/g, '/').replace(/[−–—]/g, '-').replace(/,/g, '').replace(/\s+/g, '');

function tokens(s: string): Tok[] | null {
  const out: Tok[] = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i]!;
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) {
      out.push({ k: 'n', v: Number(num[0]) });
      i += num[0].length;
    } else if ('+-*/^'.includes(c)) (out.push({ k: 'op', v: c }), i++);
    else if (c === '(') (out.push({ k: '(', v: '(' }), i++);
    else if (c === ')') (out.push({ k: ')', v: ')' }), i++);
    else if (c === '%') (out.push({ k: '%', v: '%' }), i++);
    else return null;
  }
  return out;
}

/** Work a sum out. */
export function calc(raw: string): Sum {
  const s = normalise(raw);
  if (!s) return { ok: false, why: 'Type a sum first.' };
  const t = tokens(s);
  if (!t) return { ok: false, why: 'That has something I can’t work out: use numbers, + − × ÷, brackets and %.' };
  let i = 0;
  const peek = () => t[i];
  // expr := term (('+'|'-') term)* ; a percent after a term in + or − is that share of the left side
  const expr = (): number => {
    let v = term();
    for (let p = peek(); p && p.k === 'op' && (p.v === '+' || p.v === '-'); p = peek()) {
      i++;
      const from = i;
      let r = term();
      // "200 + 10%": a bare percent added or taken away is that share of what came before, as a shop calculator does
      if (i === from + 2 && t[from]?.k === 'n' && t[from + 1]?.k === '%') r *= v;
      v = p.v === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = power();
    for (let p = peek(); p && p.k === 'op' && (p.v === '*' || p.v === '/'); p = peek()) {
      i++;
      const r = power();
      if (p.v === '/' && r === 0) throw new SumError('You can’t divide by nothing.');
      v = p.v === '*' ? v * r : v / r;
    }
    return v;
  };
  const power = (): number => {
    const b = unary();
    const p = peek();
    if (p && p.k === 'op' && p.v === '^') {
      i++;
      return b ** power();
    }
    return b;
  };
  const unary = (): number => {
    const p = peek();
    if (p && p.k === 'op' && (p.v === '-' || p.v === '+')) {
      i++;
      const v = unary();
      return p.v === '-' ? -v : v;
    }
    return postfix();
  };
  const postfix = (): number => {
    let v = atom();
    while (peek()?.k === '%') {
      i++;
      v /= 100;
    }
    return v;
  };
  const atom = (): number => {
    const p = peek();
    if (!p) throw new SumError('The sum stops short: finish it first.');
    if (p.k === 'n') {
      i++;
      return p.v;
    }
    if (p.k === '(') {
      i++;
      const v = expr();
      if (peek()?.k !== ')') throw new SumError('A bracket is open: close it first.');
      i++;
      return v;
    }
    throw new SumError('Two signs are side by side: put a number between them.');
  };
  try {
    const v = expr();
    if (i < t.length) return { ok: false, why: t[i]?.k === ')' ? 'There is a closing bracket with no opening one.' : 'Two numbers are side by side: put a sign between them.' };
    if (!Number.isFinite(v)) return { ok: false, why: 'That number is too big for me.' };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, why: e instanceof SumError ? e.why : 'I can’t work that out.' };
  }
}

/** An answer as he reads it: up to ten significant figures, no stray zeros, thousands with commas, "−" for minus. */
export function show(v: number): string {
  if (Object.is(v, -0)) v = 0;
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return v.toExponential(6).replace('-', '−').replace(/\.?0+e/, 'e');
  const r = Number(v.toPrecision(10));
  const [int, dec] = Math.abs(r).toString().split('.');
  const withCommas = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${r < 0 ? '−' : ''}${withCommas}${dec ? `.${dec}` : ''}`;
}

/** The sum written back with his symbols ("12×7"). */
export const pretty = (s: string): string => normalise(s).replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/(?<=[\d)%])-/g, ' − ').replace(/(?<=[\d)%])\+/g, ' + ').replace(/\s+/g, ' ').trim();
