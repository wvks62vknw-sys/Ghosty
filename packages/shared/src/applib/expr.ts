/**
 * THE APP LIBRARY's safe expression language (the calc archetype's outputs; see CalcConfig in types.ts).
 * A hand-written tokenizer and recursive-descent parser: no eval, no Function, nothing reached beyond the
 * numbers it is given. Grammar, loosest first:
 *   or  := and ('or' and)*
 *   and := not ('and' not)*
 *   not := 'not' not | cmp
 *   cmp := add (('<' | '<=' | '>' | '>=' | '==' | '!=') add)?
 *   add := mul (('+' | '-') mul)*
 *   mul := una (('*' | '/' | '%') una)*
 *   una := ('-' | '+') una | pow
 *   pow := atom ('^' una)?            (right-associative, so 2^3^2 = 512 and -2^2 = -4)
 *   atom := number | name | name '(' args ')' | '(' or ')'
 * Truth is a number: comparisons give 1 or 0, and anything non-zero is true. Angles are in degrees.
 */

export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; n: string }
  | { t: 'un'; op: '-' | 'not'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; f: string; args: Node[] };

export class ExprError extends Error {}

const RAD = Math.PI / 180;
const FNS: Record<string, { n: [number, number]; f: (...x: number[]) => number }> = {
  min: { n: [1, 99], f: (...x) => Math.min(...x) },
  max: { n: [1, 99], f: (...x) => Math.max(...x) },
  round: { n: [1, 2], f: (x, dp = 0) => { const p = 10 ** Math.round(dp); return Math.round((x + Number.EPSILON * Math.sign(x)) * p) / p; } },
  floor: { n: [1, 1], f: Math.floor },
  ceil: { n: [1, 1], f: Math.ceil },
  abs: { n: [1, 1], f: Math.abs },
  sqrt: { n: [1, 1], f: Math.sqrt },
  cbrt: { n: [1, 1], f: Math.cbrt },
  ln: { n: [1, 1], f: Math.log },
  log10: { n: [1, 1], f: Math.log10 },
  exp: { n: [1, 1], f: Math.exp },
  pow: { n: [2, 2], f: Math.pow },
  sin: { n: [1, 1], f: (x) => Math.sin(x * RAD) },
  cos: { n: [1, 1], f: (x) => Math.cos(x * RAD) },
  tan: { n: [1, 1], f: (x) => Math.tan(x * RAD) },
  asin: { n: [1, 1], f: (x) => Math.asin(x) / RAD },
  acos: { n: [1, 1], f: (x) => Math.acos(x) / RAD },
  atan: { n: [1, 1], f: (x) => Math.atan(x) / RAD },
  atan2: { n: [2, 2], f: (y, x) => Math.atan2(y, x) / RAD },
  hypot: { n: [1, 99], f: (...x) => Math.hypot(...x) },
  clamp: { n: [3, 3], f: (x, lo, hi) => Math.min(Math.max(x, lo), hi) },
  if: { n: [3, 3], f: (c, a, b) => (c ? a : b) },
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const WORDS = new Set(['and', 'or', 'not']);
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const EXPR_FUNCTIONS = Object.keys(FNS);

type Tok = { k: 'num'; v: number } | { k: 'name'; v: string } | { k: 'op'; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  if (src.length > 2000) throw new ExprError('The formula is too long.');
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { out.push({ k: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (name) { out.push({ k: 'name', v: name[0] }); i += name[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!='].includes(two)) { out.push({ k: 'op', v: two }); i += 2; continue; }
    if ('+-*/%^(),<>'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    throw new ExprError(`Unexpected “${c}” at ${i + 1}.`);
  }
  return out;
}

/** Parse a formula into a tree (throws ExprError with a plain reason). */
export function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = peek(); return !!t && t.k === 'op' && t.v === v; };
  const isWord = (v: string) => { const t = peek(); return !!t && t.k === 'name' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new ExprError(`Expected “${v}”${peek() ? ` before “${String(peek()!.v)}”` : ' at the end'}.`); p++; };
  let depth = 0;
  const deeper = <T>(fn: () => T): T => { if (++depth > 100) throw new ExprError('The formula is nested too deeply.'); try { return fn(); } finally { depth--; } };

  const or = (): Node => deeper(() => { let a = and(); while (isWord('or')) { p++; a = { t: 'bin', op: 'or', a, b: and() }; } return a; });
  const and = (): Node => { let a = not(); while (isWord('and')) { p++; a = { t: 'bin', op: 'and', a, b: not() }; } return a; };
  const not = (): Node => (isWord('not') ? (p++, { t: 'un', op: 'not', a: deeper(not) }) : cmp());
  const cmp = (): Node => {
    const a = add();
    const t = peek();
    if (t && t.k === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(t.v)) { p++; return { t: 'bin', op: t.v, a, b: add() }; }
    return a;
  };
  const add = (): Node => { let a = mul(); while (isOp('+') || isOp('-')) { const op = String(toks[p++]!.v); a = { t: 'bin', op, a, b: mul() }; } return a; };
  const mul = (): Node => { let a = una(); while (isOp('*') || isOp('/') || isOp('%')) { const op = String(toks[p++]!.v); a = { t: 'bin', op, a, b: una() }; } return a; };
  const una = (): Node => {
    if (isOp('-')) { p++; return { t: 'un', op: '-', a: deeper(una) }; }
    if (isOp('+')) { p++; return deeper(una); }
    return pow();
  };
  const pow = (): Node => { const a = atom(); if (isOp('^')) { p++; return { t: 'bin', op: '^', a, b: deeper(una) }; } return a; };
  const atom = (): Node => {
    const t = peek();
    if (!t) throw new ExprError('The formula ends too soon.');
    if (t.k === 'num') { p++; return { t: 'num', v: t.v }; }
    if (t.k === 'op' && t.v === '(') { p++; const a = or(); expect(')'); return a; }
    if (t.k === 'name' && !WORDS.has(t.v)) {
      p++;
      if (isOp('(')) {
        p++;
        const f = own(FNS, t.v) ? FNS[t.v] : undefined;
        if (!f) throw new ExprError(`Unknown function “${t.v}”.`);
        const args: Node[] = [];
        if (!isOp(')')) { args.push(or()); while (isOp(',')) { p++; args.push(or()); } }
        expect(')');
        if (args.length < f.n[0] || args.length > f.n[1]) throw new ExprError(`“${t.v}” takes ${f.n[0] === f.n[1] ? f.n[0] : `${f.n[0]} to ${f.n[1]}`} values.`);
        return { t: 'call', f: t.v, args };
      }
      return own(CONSTS, t.v) ? { t: 'num', v: CONSTS[t.v]! } : { t: 'var', n: t.v };
    }
    throw new ExprError(`Unexpected “${String(t.v)}”.`);
  };
  const tree = or();
  if (p < toks.length) throw new ExprError(`Unexpected “${String(toks[p]!.v)}”.`);
  return tree;
}

/** The names a formula reads (its inputs and earlier outputs). */
export function names(n: Node, into = new Set<string>()): Set<string> {
  if (n.t === 'var') into.add(n.n);
  else if (n.t === 'un') names(n.a, into);
  else if (n.t === 'bin') { names(n.a, into); names(n.b, into); }
  else if (n.t === 'call') for (const a of n.args) names(a, into);
  return into;
}

/** Work a tree out over the given values (an unknown name throws). */
export function evaluate(n: Node, vars: Record<string, number>): number {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': {
      if (!own(vars, n.n)) throw new ExprError(`Unknown name “${n.n}”.`);
      return Number(vars[n.n]);
    }
    case 'un': { const a = evaluate(n.a, vars); return n.op === '-' ? -a : a ? 0 : 1; }
    case 'call': return FNS[n.f]!.f(...n.args.map((a) => evaluate(a, vars)));
    case 'bin': {
      if (n.op === 'and') return evaluate(n.a, vars) && evaluate(n.b, vars) ? 1 : 0;
      if (n.op === 'or') return evaluate(n.a, vars) || evaluate(n.b, vars) ? 1 : 0;
      const a = evaluate(n.a, vars);
      const b = evaluate(n.b, vars);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '^': return a ** b;
        case '<': return a < b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
      }
    }
  }
  throw new ExprError('Could not work this out.');
}

const cache = new Map<string, Node>();
/** Parse (cached) and work out a formula in one go. */
export function evalExpr(src: string, vars: Record<string, number>): number {
  let n = cache.get(src);
  if (!n) { n = parse(src); if (cache.size > 2000) cache.clear(); cache.set(src, n); }
  return evaluate(n, vars);
}

/** A calc's outputs worked out in order over its inputs (each output can read the ones before it). NaN where one fails. */
export function runCalc(c: { inputs: { id: string; default: number }[]; outputs: { id: string; expr: string }[] }, given: Record<string, number> = {}): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const i of c.inputs) vars[i.id] = Number.isFinite(given[i.id]) ? given[i.id]! : i.default;
  const out: Record<string, number> = {};
  for (const o of c.outputs) {
    let v: number;
    try { v = evalExpr(o.expr, vars); } catch { v = NaN; }
    out[o.id] = v;
    vars[o.id] = v;
  }
  return out;
}
