/**
 * THINK HARDER's pure helpers (offline/think.ts runs the search): reading the answer out of a reply,
 * putting answers in one form so attempts can be counted as agreeing, and the exact checks that need
 * no model — sums worked out by a small calculator (never eval), and the examples a coding question
 * gives ("add(2, 3) → 5") turned into tests for the sandbox (training/runner.ts). Pure, so
 * apps/edge/test/thinkharder.test.mjs tests it in node.
 */

/** The answer a reply gives: what follows its last "ANSWER:", else its last non-empty line (markdown off). */
export function answerOf(text: string): string {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const tagged = [...t.matchAll(/\b(?:final\s+)?answer\s*(?:\*\*)?\s*[:：]\s*(?:\*\*)?([^\n]+)/gi)].pop();
  if (tagged) return tagged[1]!.replace(/\*\*|__|`/g, '').trim();
  const lines = t
    .split('\n')
    .map((l) => l.replace(/\*\*|__|`/g, ' ').replace(/^[#>\s-]+/, '').trim())
    .filter(Boolean);
  return lines.at(-1) ?? '';
}

/** A plain number in words like "1,250", "-3", "4.50" (null if the text is not one number). */
function plainNumber(s: string): number | null {
  const m = s.replace(/[−–]/g, '-').match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!m || m.length !== 1) return null;
  const n = Number(m[0].replace(/,(?=\d{3}\b)/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * One form for an answer, so two attempts that say the same thing count as agreeing: lower case,
 * markdown, quotes and the trailing full stop off, "the"/"a" at the start off; a short answer that is
 * one number becomes that number ("It is 391." → "391"); yes/true and no/false are one word each.
 */
export function normAnswer(a: string): string {
  let t = a
    .toLowerCase()
    .replace(/\*\*|__|`|["“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!;]+$/, '')
    .trim();
  const words = t.split(' ');
  const n = words.length <= 5 && !/[a-z]\d|\d[a-z]|[+×*÷/^()=]/.test(t) ? plainNumber(t) : null;
  if (n !== null) return String(Math.round(n * 1e6) / 1e6);
  t = t.replace(/^(?:it is|it's|the answer is|answer is|that is)\s+/, '').replace(/^(?:the|a|an)\s+/, '');
  if (/^(?:yes|true|correct)\b/.test(t) && t.split(' ').length <= 2) return 'yes';
  if (/^(?:no|false|incorrect)\b/.test(t) && t.split(' ').length <= 2) return 'no';
  return t;
}

// ---- a small calculator -----------------------------------------------------------------------------------

/** Words and signs a sum may be written with, as the calculator's own signs. */
function signsOf(s: string): string {
  return s
    .toLowerCase()
    .replace(/[−–]/g, '-')
    .replace(/×|\bx\b|\btimes\b|\bmultiplied by\b/g, '*')
    .replace(/÷|\bdivided by\b|\bover\b/g, '/')
    .replace(/\bplus\b|\badd\b/g, '+')
    .replace(/\bminus\b|\btake away\b/g, '-')
    .replace(/\bsquared\b/g, '^2')
    .replace(/\bcubed\b/g, '^3')
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
}

/**
 * Work out a sum ("17 × 23", "(18 + 7) * 4", "144 ÷ 12 + 7", "2^10", "15% of 80"): + − × ÷ ^,
 * brackets and "n% of m". Null when it is not a sum, divides by zero or has no operator at all.
 */
export function calc(expr: string): number | null {
  let s = signsOf(expr).replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/g, '$1/100*');
  s = s.replace(/\s+/g, '');
  if (!/^[\d.+\-*/^()]+$/.test(s) || !/\d[+\-*/^]|\)[+\-*/^]|[+\-*/^][\d(]/.test(s.replace(/^-/, ''))) return null;
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    if (peek() === '(') {
      i++;
      const v = add();
      if (peek() !== ')') throw new Error('bracket');
      i++;
      return v;
    }
    if (peek() === '-') {
      i++;
      return -pow();
    }
    const m = s.slice(i).match(/^\d+(?:\.\d+)?/);
    if (!m) throw new Error('number');
    i += m[0].length;
    return Number(m[0]);
  };
  const pow = (): number => {
    const b = num();
    if (peek() === '^') {
      i++;
      return b ** pow();
    }
    return b;
  };
  const mul = (): number => {
    let v = pow();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = pow();
      if (op === '/' && r === 0) throw new Error('zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const add = (): number => {
    let v = mul();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = mul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = add();
    return i === s.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** The sum a question asks for ("What is 17 × 23?", "work out (18+7)*4", "17 times 23"), worked out; else null. */
export function sumIn(question: string): { expr: string; value: number } | null {
  const q = question.replace(/[?=]+\s*$/, '').trim();
  const asked = q.match(/(?:what(?:'s| is)|calculate|compute|work out|how much is|evaluate|solve)\s*:?\s*(.+)$/i)?.[1] ?? q;
  // The longest stretch made only of numbers, signs, brackets and the words a sum is said with.
  const stretches = asked.match(/[-−(]*\d[\d.,\s+\-−–*/×÷^()%]*(?:\s*(?:x|times|multiplied by|divided by|over|plus|minus|take away|squared|cubed|of)\s*[-−(]*\d*[\d.,\s+\-−–*/×÷^()%]*)*/gi) ?? [];
  for (const st of stretches.sort((a, b) => b.length - a.length)) {
    const v = calc(st.trim());
    if (v !== null) return { expr: st.trim(), value: v };
  }
  return null;
}

/** The numbers an answer gives agree with a worked-out value (to 6 significant figures, or to the cent). */
export function sameNumber(answer: string, value: number): boolean {
  const nums = (answer.replace(/[−–]/g, '-').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (!nums.length) return false;
  // The last number given is the answer ("17 × 23 = 391": 391).
  const n = nums.at(-1)!;
  if (n === value) return true;
  const tol = Math.max(1e-9, Math.abs(value) * 1e-6);
  return Math.abs(n - value) <= tol || Math.abs(n - Math.round(value * 100) / 100) < 1e-9;
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
