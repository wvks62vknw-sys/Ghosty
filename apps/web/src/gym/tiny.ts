/**
 * TINY: the little programming language of BUG HUNT, with its own parser and interpreter (no eval — the app's
 * security policy forbids it, and a program must never run real code). One function per program:
 *
 *   fn sum_to(n)
 *     s = 0
 *     for i = 1 to n do
 *       s = s + i
 *     end
 *     return s
 *   end
 *
 * Statements, one per line: `x = E`, `xs[E] = E`, `if E then` / `else` / `end`, `while E do` / `end`,
 * `for i = A to B do` / `end` (i = A, A+1, …, B), `return E`. Expressions: whole numbers, variables, lists
 * (`xs[i]` counts from 0, `len(xs)`), + − * / % (`/` divides and rounds down, `%` is the remainder),
 * < <= > >= == !=, and / or / not, brackets. Running is counted in steps: a program that takes too many
 * (a loop that never ends) stops with an error, as does reading past the end of a list or dividing by 0.
 */

export type Tok = string;
export type Val = number | number[];

const TOKEN = /\d+|[A-Za-z_]\w*|<=|>=|==|!=|[-+*/%()<>[\],=]/g;
export const tokens = (line: string): Tok[] => line.match(TOKEN) ?? [];

export const KEYWORDS = new Set(['fn', 'if', 'then', 'else', 'end', 'while', 'do', 'for', 'to', 'return', 'and', 'or', 'not', 'len']);
export const ARITH = ['+', '-', '*', '/', '%'];
export const COMPARE = ['<', '<=', '>', '>=', '==', '!='];

/** Tokens back to a line, spaced the usual way: `s = s + xs[i]`, `len(xs) - 1`. */
export function fmt(t: Tok[]): string {
  let out = '';
  t.forEach((x, i) => {
    const prev = t[i - 1];
    const glue = i === 0 || x === ')' || x === ']' || x === ',' || prev === '(' || prev === '[' || ((x === '(' || x === '[') && prev != null && /^[A-Za-z_]\w*$/.test(prev) && !KEYWORDS.has(prev)) || (x === '(' && prev === 'len');
    out += (glue ? '' : ' ') + x;
  });
  return out;
}

type Expr = (env: Env) => Val;
interface Env {
  vars: Map<string, Val>;
  steps: number;
}

export class TinyError extends Error {}

function parseExpr(t: Tok[], at: number, line: number): { e: Expr; at: number } {
  let i = at;
  const fail = (m: string): never => {
    throw new TinyError(`line ${line}: ${m}`);
  };
  const num = (v: Val): number => (typeof v === 'number' ? v : fail('a list where a number belongs'));
  const atom = (): Expr => {
    const x = t[i++];
    if (x == null) return fail('the line ends too early');
    if (/^\d+$/.test(x)) {
      const n = Number(x);
      return () => n;
    }
    if (x === '(') {
      const e = or();
      if (t[i++] !== ')') fail('a bracket is not closed');
      return e;
    }
    if (x === '-') {
      const e = atom();
      return (env) => -num(e(env));
    }
    if (x === 'len') {
      if (t[i++] !== '(') fail('len needs brackets');
      const e = or();
      if (t[i++] !== ')') fail('a bracket is not closed');
      return (env) => {
        const v = e(env);
        return Array.isArray(v) ? v.length : fail('len of something that is not a list');
      };
    }
    if (/^[A-Za-z_]\w*$/.test(x) && !KEYWORDS.has(x)) {
      if (t[i] === '[') {
        i++;
        const ix = or();
        if (t[i++] !== ']') fail('a [ is not closed');
        return (env) => {
          const v = env.vars.get(x);
          if (!Array.isArray(v)) return fail(`${x} is not a list`);
          const k = num(ix(env));
          if (k < 0 || k >= v.length || !Number.isInteger(k)) return fail(`${x}[${k}] is outside the list`);
          return v[k]!;
        };
      }
      return (env) => {
        const v = env.vars.get(x);
        return v === undefined ? fail(`${x} has no value yet`) : v;
      };
    }
    return fail(`unexpected "${x}"`);
  };
  const term = (): Expr => {
    let e = atom();
    while (t[i] === '*' || t[i] === '/' || t[i] === '%') {
      const op = t[i++];
      const a = e;
      const b = atom();
      e = (env) => {
        const x = num(a(env));
        const y = num(b(env));
        if (op === '*') return x * y;
        if (y === 0) return fail('division by zero');
        return op === '/' ? Math.floor(x / y) : x - y * Math.floor(x / y);
      };
    }
    return e;
  };
  const sum = (): Expr => {
    let e = term();
    while (t[i] === '+' || t[i] === '-') {
      const op = t[i++];
      const a = e;
      const b = term();
      e = (env) => (op === '+' ? num(a(env)) + num(b(env)) : num(a(env)) - num(b(env)));
    }
    return e;
  };
  const cmp = (): Expr => {
    const a = sum();
    const op = t[i];
    if (!op || !COMPARE.includes(op)) return a;
    i++;
    const b = sum();
    return (env) => {
      const x = num(a(env));
      const y = num(b(env));
      const r = op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : op === '>=' ? x >= y : op === '==' ? x === y : x !== y;
      return r ? 1 : 0;
    };
  };
  const not = (): Expr => {
    if (t[i] === 'not') {
      i++;
      const e = not();
      return (env) => (num(e(env)) ? 0 : 1);
    }
    return cmp();
  };
  const and = (): Expr => {
    let e = not();
    while (t[i] === 'and') {
      i++;
      const a = e;
      const b = not();
      e = (env) => (num(a(env)) && num(b(env)) ? 1 : 0);
    }
    return e;
  };
  const or = (): Expr => {
    let e = and();
    while (t[i] === 'or') {
      i++;
      const a = e;
      const b = and();
      e = (env) => (num(a(env)) || num(b(env)) ? 1 : 0);
    }
    return e;
  };
  return { e: or(), at: i };
}

type Stmt =
  | { k: 'set'; line: number; name: string; e: Expr }
  | { k: 'put'; line: number; name: string; ix: Expr; e: Expr }
  | { k: 'if'; line: number; c: Expr; yes: Stmt[]; no: Stmt[] }
  | { k: 'while'; line: number; c: Expr; body: Stmt[] }
  | { k: 'for'; line: number; v: string; a: Expr; b: Expr; body: Stmt[] }
  | { k: 'return'; line: number; e: Expr };

export interface Program {
  name: string;
  params: string[];
  body: Stmt[];
}

/** Parse a whole program (lines numbered from 1). Throws TinyError on a mistake. */
export function parse(lines: string[]): Program {
  let n = 0;
  const head = tokens(lines[0] ?? '');
  if (head[0] !== 'fn' || head[2] !== '(' || head[head.length - 1] !== ')') throw new TinyError('line 1: a program starts with fn name(…)');
  const params = head.slice(3, -1).filter((x) => x !== ',');
  n = 1;
  const whole = (t: Tok[], from: number, line: number, stop?: string): { e: Expr; at: number } => {
    const r = parseExpr(t, from, line);
    if (stop ? t[r.at] !== stop || r.at !== t.length - 1 : r.at !== t.length) throw new TinyError(`line ${line}: something extra at the end`);
    return r;
  };
  const block = (ends: string[]): { body: Stmt[]; end: string } => {
    const body: Stmt[] = [];
    while (n < lines.length) {
      const line = n + 1;
      const t = tokens(lines[n]!);
      n++;
      const w = t[0];
      if (!w) continue;
      if (ends.includes(w) && t.length === 1) return { body, end: w };
      if (w === 'if') {
        const c = whole(t, 1, line, 'then').e;
        const yes = block(['else', 'end']);
        const no = yes.end === 'else' ? block(['end']).body : [];
        body.push({ k: 'if', line, c, yes: yes.body, no });
      } else if (w === 'while') {
        const c = whole(t, 1, line, 'do').e;
        body.push({ k: 'while', line, c, body: block(['end']).body });
      } else if (w === 'for') {
        const v = t[1]!;
        if (!/^[A-Za-z_]\w*$/.test(v) || KEYWORDS.has(v) || t[2] !== '=') throw new TinyError(`line ${line}: for needs "for i = a to b do"`);
        const a = parseExpr(t, 3, line);
        if (t[a.at] !== 'to') throw new TinyError(`line ${line}: for needs "to"`);
        const b = whole(t, a.at + 1, line, 'do').e;
        body.push({ k: 'for', line, v, a: a.e, b, body: block(['end']).body });
      } else if (w === 'return') body.push({ k: 'return', line, e: whole(t, 1, line).e });
      else if (/^[A-Za-z_]\w*$/.test(w) && !KEYWORDS.has(w) && t[1] === '=') body.push({ k: 'set', line, name: w, e: whole(t, 2, line).e });
      else if (/^[A-Za-z_]\w*$/.test(w) && !KEYWORDS.has(w) && t[1] === '[') {
        const ix = parseExpr(t, 2, line);
        if (t[ix.at] !== ']' || t[ix.at + 1] !== '=') throw new TinyError(`line ${line}: expected "${w}[…] = …"`);
        body.push({ k: 'put', line, name: w, ix: ix.e, e: whole(t, ix.at + 2, line).e });
      } else throw new TinyError(`line ${line}: cannot read "${lines[n - 1]!.trim()}"`);
    }
    if (ends.length) throw new TinyError('a block has no end');
    return { body, end: '' };
  };
  const main = block(['end']);
  if (main.end !== 'end') throw new TinyError('the program has no final end');
  for (let k = n; k < lines.length; k++) if (lines[k]!.trim()) throw new TinyError(`line ${k + 1}: something after the final end`);
  return { name: head[1]!, params, body: main.body };
}

export interface Outcome {
  value?: Val;
  error?: string;
  /** Lines that ran. */
  lines: Set<number>;
  steps: number;
}

class Return {
  constructor(public v: Val) {}
}

/** Run a program on some inputs (lists are copied), at most `limit` steps. */
export function run(p: Program, args: Val[], limit = 1500): Outcome {
  const env: Env = { vars: new Map(), steps: 0 };
  p.params.forEach((x, i) => env.vars.set(x, Array.isArray(args[i]) ? (args[i] as number[]).slice() : (args[i] as number)));
  const lines = new Set<number>();
  const tick = (line: number) => {
    lines.add(line);
    if (++env.steps > limit) throw new TinyError('it runs too long (a loop that never ends?)');
  };
  const num = (v: Val, line: number): number => {
    if (typeof v !== 'number') throw new TinyError(`line ${line}: a list where a number belongs`);
    return v;
  };
  const exec = (body: Stmt[]): void => {
    for (const s of body) {
      tick(s.line);
      switch (s.k) {
        case 'set': {
          const v = s.e(env);
          env.vars.set(s.name, Array.isArray(v) ? v.slice() : v);
          break;
        }
        case 'put': {
          const xs = env.vars.get(s.name);
          if (!Array.isArray(xs)) throw new TinyError(`line ${s.line}: ${s.name} is not a list`);
          const k = num(s.ix(env), s.line);
          if (k < 0 || k >= xs.length) throw new TinyError(`line ${s.line}: ${s.name}[${k}] is outside the list`);
          xs[k] = num(s.e(env), s.line);
          break;
        }
        case 'if':
          exec(num(s.c(env), s.line) ? s.yes : s.no);
          break;
        case 'while':
          while (num(s.c(env), s.line)) {
            exec(s.body);
            tick(s.line);
          }
          break;
        case 'for': {
          const a = num(s.a(env), s.line);
          const b = num(s.b(env), s.line);
          for (let i = a; i <= b; i++) {
            env.vars.set(s.v, i);
            exec(s.body);
            tick(s.line);
          }
          break;
        }
        case 'return':
          throw new Return(s.e(env));
      }
    }
  };
  try {
    exec(p.body);
    return { error: 'it ends without returning anything', lines, steps: env.steps };
  } catch (e) {
    if (e instanceof Return) return { value: e.v, lines, steps: env.steps };
    if (e instanceof TinyError) return { error: e.message, lines, steps: env.steps };
    throw e;
  }
}

export const show = (v: Val | undefined) => (v === undefined ? 'nothing' : Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

/** A program's lines indented by its blocks (for reading). */
export function indent(lines: string[]): string[] {
  let depth = 0;
  return lines.map((l, i) => {
    const w = tokens(l)[0];
    if (w === 'end' || w === 'else') depth = Math.max(0, depth - 1);
    const out = `${'  '.repeat(i === 0 || i === lines.length - 1 ? 0 : depth)}${l}`;
    if (i > 0 && (w === 'if' || w === 'while' || w === 'for' || w === 'else')) depth++;
    if (i === 0) depth = 1;
    return out;
  });
}

export const RULES =
  'The language: one statement per line; `x = E` sets x; `xs[i] = E` sets an item of a list; `if C then … else … end`; `while C do … end` repeats while C holds; `for i = A to B do … end` runs with i = A, A+1, …, B (not at all if A > B); `return E` gives the answer. Lists count from 0 and `len(xs)` is the length; `/` divides and rounds down, `%` is the remainder; comparisons give 1 (true) or 0 (false).';
