/**
 * THINK HARDER's pure helpers (offline/think.ts runs the search): reading the answer out of a reply,
 * putting answers in one form so attempts can be counted as agreeing, and the exact checks that need
 * no model — sums worked out by a small calculator (never eval), and the examples a coding question
 * gives ("add(2, 3) → 5") turned into tests for the sandbox (training/runner.ts). Pure, so
 * apps/edge/test/thinkharder.test.mjs tests it in node.
 */

/** Where a reply labels its answer: "ANSWER:", "Final answer:", "**Answer:**" (the label's start and end). */
const LABEL = /\b(final\s+)?answer\s*(?:\*\*)?\s*[:：]\s*(?:\*\*)?/gi;

/**
 * The answer a reply gives: what follows its last "Final answer:" (or, with none, its last "Answer:") to the
 * end of that line — "My answer: I think 7. Final Answer: 9" gives "9" —, else its last non-empty line
 * (what follows its last "=", when it has one).
 */
export function answerOf(text: string): string {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const marks = [...t.matchAll(LABEL)];
  const finals = marks.filter((m) => m[1]);
  const m = (finals.length ? finals : marks).at(-1);
  if (m) return t.slice(m.index! + m[0].length).split('\n')[0]!.replace(/\*\*|__|`/g, '').trim();
  const lines = t
    .split('\n')
    .map((l) => l.replace(/\*\*|__|`/g, ' ').replace(/^[#>\s-]+/, '').trim())
    .filter(Boolean);
  // No label: a last line that works something out gives what it comes to ("17 × 23 = 391" → "391").
  const last = lines.at(-1) ?? '';
  return /=/.test(last) && /\S/.test(last.split('=').at(-1)!) ? last.split('=').at(-1)!.trim() : last;
}

// ---- exact numbers -----------------------------------------------------------------------------------------

/** An exact number: a fraction of two whole numbers (`d` > 0, lowest terms). */
export interface Exact {
  n: bigint;
  d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
const frac = (n: bigint, d: bigint): Exact => {
  if (d === 0n) throw new Error('zero');
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
/** "12.50" → 25/2, exactly. */
const decimal = (s: string): Exact => {
  const [a, b = ''] = s.split('.');
  return frac(BigInt(`${a}${b}` || '0'), 10n ** BigInt(b.length));
};
const same = (a: Exact, b: Exact) => a.n === b.n && a.d === b.d;
/** As an ordinary number (for showing it, and for answers that are not exact). */
export const toNumber = (x: Exact): number => Number(x.n) / Number(x.d);
/** As words: "391", "-3", "5/6". */
export const exactText = (x: Exact): string => (x.d === 1n ? String(x.n) : `${x.n}/${x.d}`);

/** A number as written in an answer: thousands commas, a minus sign, a decimal point, or a fraction ("5/6"). */
const NUMBER = /-?(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?(?:\s*\/\s*\d+(?!\s*\/))?/g;

/**
 * The number an answer gives: the first one in it ("391 (17 × 23)" → 391); LaTeX's \boxed{} and $ signs
 * are looked through.
 */
export function answerNumber(answer: string): { value: Exact; text: string } | null {
  const t = answer.replace(/\\boxed\{([^{}]*)\}/g, '$1').replace(/\$/g, ' ').replace(/[−–]/g, '-');
  const m = t.match(new RegExp(NUMBER.source));
  if (!m) return null;
  const raw = m[0].replace(/,/g, '').replace(/\s+/g, '');
  try {
    const [a, b] = raw.split('/');
    const top = decimal(a!.replace(/^-/, ''));
    const v = b ? frac(top.n, top.d * BigInt(b)) : top;
    return { value: a!.startsWith('-') ? { n: -v.n, d: v.d } : v, text: raw };
  } catch {
    return null;
  }
}

/**
 * One form for an answer, so two attempts that say the same thing count as agreeing: lower case,
 * markdown, quotes and the trailing full stop off, "the"/"a" at the start off; yes/true and no/false are
 * one word each, also with more after a comma ("No, 12" is "no"); a short answer that is one number
 * becomes that number exactly ("It is 391." → "391"; "1/2" and "0.5" → "1/2").
 */
export function normAnswer(a: string): string {
  let t = a
    .toLowerCase()
    .replace(/\*\*|__|`|["“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!;]+$/, '')
    .trim();
  t = t.replace(/^(?:it is|it's|the answer is|answer is|that is)\s+/, '').replace(/^(?:the|a|an)\s+/, '');
  const yn = t.match(/^(yes|true|correct|no|false|incorrect)\b(?:,|$|\s+\S+$)/);
  if (yn) return /^(?:yes|true|correct)$/.test(yn[1]!) ? 'yes' : 'no';
  const bare = t.replace(/\\boxed\{([^{}]*)\}/g, '$1').replace(/\$/g, ' ').replace(/[−–]/g, '-');
  if (t.split(' ').length <= 5 && !/[a-z]\d|\d[a-z]|[+×*÷^()=]|\d\s*-\s*\d/.test(bare) && (bare.match(NUMBER) ?? []).length === 1) {
    const n = answerNumber(bare);
    if (n) return exactText(n.value);
  }
  return t;
}

// ---- a small calculator -----------------------------------------------------------------------------------

/** Words and signs a sum may be written with, as the calculator's own signs. */
function signsOf(s: string): string {
  return s
    .toLowerCase()
    .replace(/[−–]/g, '-')
    .replace(/×|\bx\b|\btimes\b|\bmultiplied by\b/g, '*')
    .replace(/÷|\bdivided by\b/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bsquared\b/g, '^2')
    .replace(/\bcubed\b/g, '^3')
    .replace(/(\d)\s*%\s*of\b/g, '$1/100*')
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
}

/**
 * Work out a sum exactly, as a fraction ("17 × 23", "(18 + 7) * 4", "1/2 + 1/3", "2^10", "15% of 80"):
 * + − × ÷ ^ (whole powers up to 64) and brackets. Null when it is not a sum, divides by zero, has no
 * operator, a fractional power, or is too long, too deep or too big to be worth it.
 */
export function calcExact(expr: string): Exact | null {
  const s = signsOf(expr).replace(/\s+/g, '');
  if (s.length > 200 || !/^[\d.+\-*/^()]+$/.test(s) || !/\d[+\-*/^]|\)[+\-*/^]|[+\-*/^][\d(]/.test(s.replace(/^-/, ''))) return null;
  let i = 0;
  let depth = 0;
  const peek = () => s[i];
  const big = (x: Exact) => {
    if (x.n.toString().length > 400 || x.d.toString().length > 400) throw new Error('too big');
    return x;
  };
  const num = (): Exact => {
    if (peek() === '(') {
      if (++depth > 40) throw new Error('too deep');
      i++;
      const v = add();
      if (peek() !== ')') throw new Error('bracket');
      i++;
      depth--;
      return v;
    }
    if (peek() === '-') {
      i++;
      const v = pow();
      return { n: -v.n, d: v.d };
    }
    const m = s.slice(i).match(/^\d+(?:\.\d+)?/);
    if (!m) throw new Error('number');
    i += m[0].length;
    return decimal(m[0]);
  };
  const pow = (): Exact => {
    const b = num();
    if (peek() !== '^') return b;
    i++;
    const e = pow();
    if (e.d !== 1n || e.n > 64n || e.n < -64n) throw new Error('power');
    const k = e.n < 0n ? -e.n : e.n;
    const r = big(frac(b.n ** k, b.d ** k));
    return e.n < 0n ? frac(r.d, r.n) : r;
  };
  const mul = (): Exact => {
    let v = pow();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = pow();
      v = big(op === '*' ? frac(v.n * r.n, v.d * r.d) : frac(v.n * r.d, v.d * r.n));
    }
    return v;
  };
  const add = (): Exact => {
    let v = mul();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = mul();
      v = big(frac(op === '+' ? v.n * r.d + r.n * v.d : v.n * r.d - r.n * v.d, v.d * r.d));
    }
    return v;
  };
  try {
    const v = add();
    return i === s.length ? v : null;
  } catch {
    return null;
  }
}

/** The sum worked out, as an ordinary number (null as calcExact). */
export function calc(expr: string): number | null {
  const v = calcExact(expr);
  return v ? toNumber(v) : null;
}

/**
 * The sum a question asks for, when the question is nothing but the sum: "What is 17 × 23?", "work out
 * (18+7)*4", "what's 17 times 23". Anything more — a comparison, rounding, a base, a time of day, a date,
 * units — and there is no check (null): the calculator would be answering a different question.
 */
export function sumIn(question: string): { expr: string; value: number; exact: Exact } | null {
  const m = question.trim().match(/^(?:what(?:'s| is)|calculate|compute|work out|how much is|evaluate)\s*:?\s*([^?=!]{1,200}?)\s*[?=.!]*$/i);
  if (!m) return null;
  const expr = m[1]!.trim();
  // A date ("25/12/2024") or a time ("3:45") is not a sum; letters left after the sum words are something else.
  if (/\d\s*\/\s*\d+\s*\/\s*\d/.test(expr) || /:/.test(expr)) return null;
  if (/[a-z]/i.test(signsOf(expr))) return null;
  const v = calcExact(expr);
  return v ? { expr, value: toNumber(v), exact: v } : null;
}

/**
 * Does an answer give this exact value? The first number in the answer is its answer. A whole-number result
 * must match exactly; one that is not whole may be the fraction itself, or a decimal rounded to two or more
 * places ("0.33" for 1/3).
 */
export function numberMatches(answer: string, value: Exact): boolean {
  const a = answerNumber(answer);
  if (!a) return false;
  if (same(a.value, value)) return true;
  if (value.d === 1n) return false;
  const places = a.text.includes('.') && !a.text.includes('/') ? a.text.split('.')[1]!.length : 0;
  if (places < 2) return false;
  // The value rounded to that many places (half away from zero), compared exactly.
  const scale = 10n ** BigInt(places);
  const neg = value.n < 0n;
  const absN = neg ? -value.n : value.n;
  const r = (absN * scale * 2n + value.d) / (value.d * 2n);
  return same(a.value, frac(neg ? -r : r, scale));
}

/** For a value worked out elsewhere as an ordinary number: exact when it is whole. */
export function sameNumber(answer: string, value: number): boolean {
  if (Number.isInteger(value)) return numberMatches(answer, { n: BigInt(value), d: 1n });
  const a = answerNumber(answer);
  return !!a && Math.abs(toNumber(a.value) - value) <= Math.max(1e-9, Math.abs(value) * 1e-9);
}

/**
 * THINK HARDER's calculator check for a question that is nothing but a sum (sumIn), else null. It judges the
 * reply's answer (the number right after "ANSWER:"), exactly.
 */
export function sumCheck(question: string): { label: string; kind: 'key'; check(reply: string, answer: string): { correct: boolean; score: number; why: string } } | null {
  const s = sumIn(question);
  if (!s) return null;
  const why = `${s.expr} = ${exactText(s.exact)}`;
  return { label: 'a calculator', kind: 'key', check: (_reply, answer) => ({ correct: numberMatches(answer, s.exact), score: numberMatches(answer, s.exact) ? 1 : 0, why }) };
}

// ---- code ------------------------------------------------------------------------------------------------

/** The JavaScript in a reply: its fenced block (the longest), else the reply itself when it looks like code. */
export function codeOf(reply: string): string | null {
  const blocks = [...reply.matchAll(/```(?:[a-z]*)\n?([\s\S]*?)```/gi)].map((m) => m[1]!.trim());
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0]!;
  return /\bfunction\s+\w+\s*\(|=>\s*[{(]?/.test(reply) ? reply.trim() : null;
}

/** The first function a piece of code defines (`function f(`, `const f = (`, `const f = function`). */
export function entryOf(code: string): string | null {
  return code.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? code.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/)?.[1] ?? null;
}

const asJson = (s: string): unknown => {
  try {
    return JSON.parse(s.trim().replace(/'/g, '"'));
  } catch {
    return undefined;
  }
};

/**
 * The examples a coding question gives, as tests: `add(2, 3) → 5`, `add(2,3) should return 5`,
 * `add(2, 3) === 5`, `add(2, 3) returns 5`. Only arguments and results written as plain JSON count.
 */
export function codeTests(question: string): { entry: string; tests: { args: unknown[]; expect: unknown }[] } | null {
  const re = /\b([A-Za-z_$][\w$]*)\(([^()]*)\)\s*(?:→|->|=>|===?|should (?:return|give|be)|returns|gives|is)\s*([^\s,;]+(?:\s*[^\s,;]+)?)/g;
  const tests: { args: unknown[]; expect: unknown }[] = [];
  let entry = '';
  for (const m of question.matchAll(re)) {
    const args = asJson(`[${m[2]}]`);
    const raw = m[3]!.replace(/[.)]+$/, '');
    const expect = asJson(raw) ?? asJson(raw.split(/\s/)[0]!);
    if (!Array.isArray(args) || expect === undefined) continue;
    if (entry && m[1] !== entry) continue;
    entry = m[1]!;
    tests.push({ args, expect });
  }
  return entry && tests.length ? { entry, tests } : null;
}

/** A question that asks for code. */
export const asksForCode = (q: string): boolean => /\b(?:write|make|code|implement|fix)\b[^.?!]*\b(?:function|javascript|js|code|program|script)\b|\bfunction\s+\w+\s*\(/i.test(q);
