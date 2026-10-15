// Training ground exercise bank: self-contained JavaScript coding tasks with hidden tests.
// The model sees only `prompt`; it must define `entry` and keep going until every test passes.
// `reference` is a known-good solution used only by test/exercises.test.mjs to validate the tests.

export interface Exercise {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  topic: string;
  prompt: string;
  entry: string;
  tests: { args: unknown[]; expect: unknown; note?: string }[];
  reference: string;
}

export const EXERCISES: Exercise[] = [
  // ---------------------------------------------------------------- strings
  {
    id: 'run-length-encode',
    title: 'Run-length encoding',
    level: 1,
    topic: 'strings',
    entry: 'rleEncode',
    prompt: `Write a JavaScript function \`rleEncode(s)\` that run-length encodes the string \`s\`.
Every maximal run of the same character is written as the run length in decimal followed by the character itself.
The count is always written, even when it is 1. Comparison is case-sensitive and every character (spaces, digits, punctuation) is encoded the same way.
Examples: rleEncode('aaabccdddd') returns '3a1b2c4d'; rleEncode('aaaaaaaaaaaa') returns '12a'.
An empty string returns ''. Return a string.`,
    tests: [
      { args: ['aaabccdddd'], expect: '3a1b2c4d' },
      { args: [''], expect: '', note: 'empty input' },
      { args: ['a'], expect: '1a' },
      { args: ['AAAbbA'], expect: '3A2b1A', note: 'case-sensitive, run can recur' },
      { args: ['aaaaaaaaaaaa'], expect: '12a', note: 'multi-digit count' },
      { args: ['  x'], expect: '2 1x', note: 'spaces are characters too' },
      { args: ['112'], expect: '2112', note: 'digits are encoded like any character' },
      { args: ['abc'], expect: '1a1b1c' },
    ],
    reference: String.raw`function rleEncode(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += (j - i) + s[i];
    i = j;
  }
  return out;
}`,
  },
  {
    id: 'roman-numerals',
    title: 'Roman numerals both ways',
    level: 2,
    topic: 'strings',
    entry: 'roman',
    prompt: `Write a JavaScript function \`roman(value)\` that converts in both directions between integers and Roman numerals.
- If \`value\` is a number: it must be an integer from 1 to 3999 inclusive. Return its canonical uppercase Roman numeral using I=1, V=5, X=10, L=50, C=100, D=500, M=1000 and the subtractive pairs IV=4, IX=9, XL=40, XC=90, CD=400, CM=900 (e.g. 1994 -> 'MCMXCIV', 4 -> 'IV', never 'IIII'). Any other number (0, negative, > 3999, non-integer) returns null.
- If \`value\` is a string: it must be exactly the canonical uppercase numeral that roman(n) would produce for some integer n in 1..3999; return that integer n. Anything else returns null: the empty string, lowercase letters, other characters, and non-canonical forms such as 'IIII', 'IC', 'VX' or 'MMMM'.
- Any other type returns null.`,
    tests: [
      { args: [1994], expect: 'MCMXCIV' },
      { args: [3999], expect: 'MMMCMXCIX', note: 'upper bound' },
      { args: [4], expect: 'IV' },
      { args: ['MCMXCIV'], expect: 1994 },
      { args: ['XLII'], expect: 42 },
      { args: ['IIII'], expect: null, note: 'non-canonical' },
      { args: ['IC'], expect: null, note: 'invalid subtractive pair' },
      { args: [0], expect: null, note: 'below range' },
      { args: [4000], expect: null, note: 'above range' },
      { args: [2.5], expect: null, note: 'non-integer' },
      { args: ['mcm'], expect: null, note: 'lowercase rejected' },
      { args: [''], expect: null, note: 'empty string' },
    ],
    reference: String.raw`function roman(value) {
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const toRoman = (n) => {
    let s = '';
    for (const [v, r] of table) while (n >= v) { s += r; n -= v; }
    return s;
  };
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || value > 3999) return null;
    return toRoman(value);
  }
  if (typeof value === 'string') {
    if (!/^[MDCLXVI]+$/.test(value)) return null;
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let n = 0;
    for (let i = 0; i < value.length; i++) {
      const c = map[value[i]];
      const next = i + 1 < value.length ? map[value[i + 1]] : 0;
      n += c < next ? -c : c;
    }
    if (n < 1 || n > 3999) return null;
    return toRoman(n) === value ? n : null;
  }
  return null;
}`,
  },
  {
    id: 'word-wrap',
    title: 'Greedy word wrap',
    level: 2,
    topic: 'strings',
    entry: 'wordWrap',
    prompt: `Write a JavaScript function \`wordWrap(text, width)\` that wraps text into lines no longer than \`width\` characters (width is an integer >= 1).
1. Split \`text\` into words on any run of whitespace (spaces, tabs, newlines); ignore leading/trailing whitespace.
2. A word longer than \`width\` is first cut into pieces of exactly \`width\` characters (the last piece may be shorter); each piece is then treated as a separate word.
3. Fill lines greedily: words on a line are joined by a single space; a word is appended to the current line if the line's length after appending (including the joining space) is <= width, otherwise it starts a new line.
Return an array of lines (strings). If the text contains no words, return [].
Example: wordWrap('The quick brown fox', 10) returns ['The quick', 'brown fox'].`,
    tests: [
      { args: ['The quick brown fox jumps over the lazy dog', 10], expect: ['The quick', 'brown fox', 'jumps over', 'the lazy', 'dog'] },
      { args: ['', 5], expect: [], note: 'empty text' },
      { args: ['   \n\t ', 5], expect: [], note: 'whitespace only' },
      { args: ['hello', 5], expect: ['hello'], note: 'exact fit' },
      { args: ['abcdefghij', 4], expect: ['abcd', 'efgh', 'ij'], note: 'long word is split' },
      { args: ['ab abcdefgh c', 4], expect: ['ab', 'abcd', 'efgh', 'c'] },
      { args: ['abcdef g', 4], expect: ['abcd', 'ef g'], note: 'last piece shares a line' },
      { args: ['a  b\n\nc', 3], expect: ['a b', 'c'], note: 'mixed whitespace collapses' },
      { args: ['one two', 7], expect: ['one two'] },
      { args: ['one two', 6], expect: ['one', 'two'] },
    ],
    reference: String.raw`function wordWrap(text, width) {
  const words = [];
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    for (let i = 0; i < w.length; i += width) words.push(w.slice(i, i + width));
  }
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line === '') line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line !== '') lines.push(line);
  return lines;
}`,
  },
  {
    id: 'slugify',
    title: 'Slugify with accents removed',
    level: 1,
    topic: 'strings',
    entry: 'slugify',
    prompt: `Write a JavaScript function \`slugify(s)\` that turns a string into a URL slug, applying these steps in order:
1. Unicode-normalise with s.normalize('NFD').
2. Remove every combining mark in the range U+0300 to U+036F (this strips accents: 'é' -> 'e', 'Å' -> 'A').
3. Lowercase with toLowerCase().
4. Replace every maximal run of characters that are NOT in [a-z0-9] with a single '-' (so letters such as 'ß', 'ω' or 'æ' that survive step 2 count as separators).
5. Remove leading and trailing '-'.
Return the resulting string ('' if nothing is left).
Example: slugify('Crème Brûlée!') returns 'creme-brulee'.`,
    tests: [
      { args: ['Hello, World!'], expect: 'hello-world' },
      { args: ['Crème Brûlée'], expect: 'creme-brulee', note: 'accents removed' },
      { args: ['  Ünïcödé  ëxämplé  '], expect: 'unicode-example' },
      { args: [''], expect: '', note: 'empty input' },
      { args: ['---'], expect: '', note: 'only separators' },
      { args: ['Straße 12'], expect: 'stra-e-12', note: 'ß has no decomposition, becomes a separator' },
      { args: ['São Paulo & Niño'], expect: 'sao-paulo-nino' },
      { args: ['already-a-slug'], expect: 'already-a-slug' },
      { args: ['Ωmega 2024'], expect: 'mega-2024', note: 'non-Latin letter becomes a separator, then trimmed' },
      { args: ['ÅNGSTRÖM'], expect: 'angstrom' },
    ],
    reference: String.raw`function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}`,
  },
  {
    id: 'anagram-groups',
    title: 'Group anagrams',
    level: 2,
    topic: 'strings',
    entry: 'anagramGroups',
    prompt: `Write a JavaScript function \`anagramGroups(words)\` that groups an array of strings into anagram groups.
- Two words belong to the same group exactly when they contain the same characters with the same counts (case-sensitive: 'A' and 'a' differ). The empty string is a valid word.
- Duplicates are kept (['abc', 'abc'] is one group containing both).
- Sort the words inside each group ascending using plain code-unit order (what Array.prototype.sort() does with no comparator; uppercase sorts before lowercase).
- Sort the groups by their first (smallest) word, using the same order.
Return an array of arrays of strings. An empty input returns [].
Example: anagramGroups(['eat','tea','tan','ate','nat','bat']) returns [['ate','eat','tea'],['bat'],['nat','tan']].`,
    tests: [
      { args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expect: [['ate', 'eat', 'tea'], ['bat'], ['nat', 'tan']] },
      { args: [[]], expect: [], note: 'empty input' },
      { args: [['a']], expect: [['a']] },
      { args: [['abc', 'cab', 'abc']], expect: [['abc', 'abc', 'cab']], note: 'duplicates kept' },
      { args: [['Listen', 'Silent', 'listen', 'silent', 'enlist']], expect: [['Listen'], ['Silent'], ['enlist', 'listen', 'silent']], note: 'case-sensitive' },
      { args: [['', '']], expect: [['', '']], note: 'empty-string words' },
      { args: [['ab', 'ba', 'c', 'b', 'a']], expect: [['a'], ['ab', 'ba'], ['b'], ['c']] },
      { args: [['dog', 'god', 'odg', 'cat']], expect: [['cat'], ['dog', 'god', 'odg']] },
    ],
    reference: String.raw`function anagramGroups(words) {
  const groups = new Map();
  for (const w of words) {
    const key = w.split('').sort().join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  const out = [...groups.values()].map((g) => g.slice().sort());
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}`,
  },

  // ---------------------------------------------------------------- parsing
  {
    id: 'parse-duration',
    title: 'Parse a duration string',
    level: 2,
    topic: 'parsing',
    entry: 'parseDuration',
    prompt: `Write a JavaScript function \`parseDuration(s)\` that parses a duration such as '1h 30m 15s' and returns the total number of seconds.
Grammar:
- Leading and trailing whitespace is ignored.
- The rest is one or more components. A component is one or more ASCII digits immediately followed (no space) by a lowercase unit: d (86400 s), h (3600 s), m (60 s) or s (1 s).
- Components may be separated by zero or more whitespace characters ('1h30m' and '1h 30m' are both valid).
- Units must appear in the order d, h, m, s; each unit at most once; any unit may be omitted.
- Values are not range-limited: '90m' is 5400.
Return the total seconds as a number. Return null for anything invalid: an empty or whitespace-only string, an unknown unit, a number without a unit, a space between number and unit, decimals, signs, repeated units or out-of-order units, or a non-string argument.`,
    tests: [
      { args: ['1h 30m 15s'], expect: 5415 },
      { args: ['90m'], expect: 5400, note: 'values are not range-limited' },
      { args: ['2d'], expect: 172800 },
      { args: ['1d2h3m4s'], expect: 93784, note: 'no separators' },
      { args: ['  45s  '], expect: 45, note: 'surrounding whitespace' },
      { args: ['0s'], expect: 0 },
      { args: [''], expect: null, note: 'empty' },
      { args: ['15s 1h'], expect: null, note: 'out of order' },
      { args: ['1h 1h'], expect: null, note: 'repeated unit' },
      { args: ['1.5h'], expect: null, note: 'decimal' },
      { args: ['10'], expect: null, note: 'missing unit' },
      { args: ['1 h'], expect: null, note: 'space between number and unit' },
    ],
    reference: String.raw`function parseDuration(s) {
  if (typeof s !== 'string') return null;
  const m = /^\s*(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined && m[4] === undefined)) return null;
  const n = (x) => (x === undefined ? 0 : Number(x));
  return n(m[1]) * 86400 + n(m[2]) * 3600 + n(m[3]) * 60 + n(m[4]);
}`,
  },
  {
    id: 'csv-line',
    title: 'Parse one CSV line',
    level: 2,
    topic: 'parsing',
    entry: 'parseCsvLine',
    prompt: `Write a JavaScript function \`parseCsvLine(line)\` that splits one CSV record into fields and returns them as an array of strings.
Rules:
- Fields are separated by commas. An empty line is one empty field ([""]); a trailing comma produces a final empty field.
- A field whose FIRST character is a double quote (") is a quoted field: it ends at the next quote that is not part of a doubled pair; inside it, commas and newlines are literal and "" stands for one literal quote. The surrounding quotes are not part of the value. After the closing quote the next character must be a comma or the end of the line.
- Any other field is unquoted: it runs up to the next comma and is taken verbatim — no trimming of spaces, and quote characters inside it are literal (ab"c stays ab"c).
Return null if a quoted field is never closed, or if anything other than a comma follows a closing quote.
Example: parseCsvLine('"she said ""hi""",2') returns ['she said "hi"', '2'].`,
    tests: [
      { args: ['a,b,c'], expect: ['a', 'b', 'c'] },
      { args: [''], expect: [''], note: 'empty line is one empty field' },
      { args: ['a,,c,'], expect: ['a', '', 'c', ''], note: 'empty and trailing fields' },
      { args: ['"hello, world",x'], expect: ['hello, world', 'x'], note: 'comma inside quotes' },
      { args: ['"she said ""hi""",2'], expect: ['she said "hi"', '2'], note: 'escaped quotes' },
      { args: ['""'], expect: [''], note: 'empty quoted field' },
      { args: [' a , b '], expect: [' a ', ' b '], note: 'no trimming' },
      { args: ['ab"c,d'], expect: ['ab"c', 'd'], note: 'quote inside unquoted field is literal' },
      { args: ['"abc'], expect: null, note: 'unterminated quote' },
      { args: ['"abc"d,e'], expect: null, note: 'junk after closing quote' },
      { args: ['x,"",y'], expect: ['x', '', 'y'] },
      { args: ['"a\nb",c'], expect: ['a\nb', 'c'], note: 'newline inside quotes' },
    ],
    reference: String.raw`function parseCsvLine(line) {
  const out = [];
  const n = line.length;
  let i = 0;
  for (;;) {
    let f = '';
    if (line[i] === '"') {
      i++;
      for (;;) {
        if (i >= n) return null;
        if (line[i] === '"') {
          if (line[i + 1] === '"') { f += '"'; i += 2; } else { i++; break; }
        } else { f += line[i]; i++; }
      }
      if (i < n && line[i] !== ',') return null;
    } else {
      while (i < n && line[i] !== ',') { f += line[i]; i++; }
    }
    out.push(f);
    if (i >= n) return out;
    i++;
  }
}`,
  },
  {
    id: 'semver-compare',
    title: 'Compare semantic versions',
    level: 3,
    topic: 'parsing',
    entry: 'compareSemver',
    prompt: `Write a JavaScript function \`compareSemver(a, b)\` that compares two Semantic Versioning 2.0.0 strings and returns -1 if a < b, 0 if they have equal precedence, 1 if a > b.
Valid version: MAJOR.MINOR.PATCH, optionally followed by '-' and a pre-release, optionally followed by '+' and build metadata.
- MAJOR, MINOR, PATCH are non-negative integers without leading zeros ('0' is fine, '01' is not).
- Pre-release: one or more dot-separated identifiers, each non-empty and made of [0-9A-Za-z-]; a purely numeric identifier must not have leading zeros.
- Build metadata: one or more dot-separated non-empty identifiers of [0-9A-Za-z-]. It is IGNORED for comparison.
- Nothing else is allowed: no leading 'v', no whitespace, no missing parts ('1.0' is invalid).
Precedence: compare MAJOR, MINOR, PATCH numerically. If equal, a version WITH a pre-release is lower than one without. Two pre-releases are compared identifier by identifier from left to right: numeric identifiers compare numerically; alphanumeric identifiers compare by ASCII code order (so 'Beta' < 'beta'); a numeric identifier is always lower than an alphanumeric one; if all shared identifiers are equal, the one with fewer identifiers is lower.
If either argument is not a valid version string, return null.`,
    tests: [
      { args: ['1.0.0', '2.0.0'], expect: -1 },
      { args: ['2.1.0', '2.0.9'], expect: 1 },
      { args: ['1.2.3', '1.2.3'], expect: 0 },
      { args: ['1.10.0', '1.9.0'], expect: 1, note: 'numeric, not lexical' },
      { args: ['1.0.0-alpha', '1.0.0'], expect: -1, note: 'pre-release is lower' },
      { args: ['1.0.0-alpha', '1.0.0-alpha.1'], expect: -1, note: 'fewer identifiers is lower' },
      { args: ['1.0.0-alpha.beta', '1.0.0-alpha.1'], expect: 1, note: 'numeric < alphanumeric' },
      { args: ['1.0.0-rc.11', '1.0.0-rc.2'], expect: 1, note: 'numeric identifiers compare numerically' },
      { args: ['1.0.0+build.5', '1.0.0+build.9'], expect: 0, note: 'build metadata ignored' },
      { args: ['1.0.0-beta', '1.0.0-Beta'], expect: 1, note: 'ASCII order' },
      { args: ['01.0.0', '1.0.0'], expect: null, note: 'leading zero' },
      { args: ['v1.0.0', '1.0.0'], expect: null, note: 'leading v' },
    ],
    reference: String.raw`function compareSemver(a, b) {
  const re = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (typeof a !== 'string' || typeof b !== 'string') return null;
  const ma = re.exec(a);
  const mb = re.exec(b);
  if (!ma || !mb) return null;
  for (let i = 1; i <= 3; i++) {
    const x = Number(ma[i]);
    const y = Number(mb[i]);
    if (x !== y) return x < y ? -1 : 1;
  }
  const pa = ma[4];
  const pb = mb[4];
  if (pa === undefined && pb === undefined) return 0;
  if (pa === undefined) return 1;
  if (pb === undefined) return -1;
  const xs = pa.split('.');
  const ys = pb.split('.');
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    } else if (xn) return -1;
    else if (yn) return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return xs.length === ys.length ? 0 : xs.length < ys.length ? -1 : 1;
}`,
  },
  {
    id: 'expression-calculator',
    title: 'Arithmetic expression calculator',
    level: 3,
    topic: 'parsing',
    entry: 'calc',
    prompt: `Write a JavaScript function \`calc(expr)\` that evaluates an arithmetic expression string WITHOUT using eval, Function or similar.
Grammar (usual precedence, binary operators left-associative):
  expr   := term (('+' | '-') term)*
  term   := factor (('*' | '/') factor)*
  factor := ('+' | '-') factor | number | '(' expr ')'
  number := one or more digits, optionally followed by '.' and one or more digits (so '.5' and '3.' are invalid)
Spaces and tabs may appear between tokens but never inside a number ('3 4' is two numbers in a row, which is invalid). Unary minus/plus may be repeated and applies to the following factor: '2 * -3' is -6, '-(2 + 3)' is -5.
Return the result rounded to 10 decimal places as Math.round(result * 1e10) / 1e10 (so '0.1 + 0.2' gives 0.3 and '1 / 3' gives 0.3333333333).
Return null if the input is not a string, is empty, contains any other character, does not match the grammar (missing operand, unbalanced parentheses, trailing tokens), or if any division has a divisor equal to zero.`,
    tests: [
      { args: ['1 + 2 * 3'], expect: 7, note: 'precedence' },
      { args: ['(1 + 2) * 3'], expect: 9, note: 'parentheses' },
      { args: ['10 / 4'], expect: 2.5 },
      { args: ['2 - 3 - 4'], expect: -5, note: 'left associative' },
      { args: ['-(2 + 3) * 2'], expect: -10, note: 'unary minus before parenthesis' },
      { args: ['2 * -3'], expect: -6, note: 'unary minus after operator' },
      { args: ['0.1 + 0.2'], expect: 0.3, note: 'rounded to 10 places' },
      { args: ['1 / 3'], expect: 0.3333333333 },
      { args: ['1 / (2 - 2)'], expect: null, note: 'division by zero' },
      { args: ['2 + '], expect: null, note: 'missing operand' },
      { args: ['3 4'], expect: null, note: 'adjacent numbers' },
      { args: [''], expect: null, note: 'empty' },
    ],
    reference: String.raw`function calc(expr) {
  if (typeof expr !== 'string') return null;
  const toks = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if ('+-*/()'.includes(c)) { toks.push(c); i++; continue; }
    const m = /^\d+(?:\.\d+)?/.exec(expr.slice(i));
    if (!m) return null;
    toks.push(Number(m[0]));
    i += m[0].length;
  }
  let p = 0;
  const fail = () => { throw new Error('bad'); };
  function parseExpr() {
    let v = parseTerm();
    while (toks[p] === '+' || toks[p] === '-') {
      const op = toks[p++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (toks[p] === '*' || toks[p] === '/') {
      const op = toks[p++];
      const r = parseFactor();
      if (op === '/') { if (r === 0) fail(); v /= r; } else v *= r;
    }
    return v;
  }
  function parseFactor() {
    const t = toks[p];
    if (t === '+' || t === '-') { p++; const v = parseFactor(); return t === '-' ? -v : v; }
    if (typeof t === 'number') { p++; return t; }
    if (t === '(') {
      p++;
      const v = parseExpr();
      if (toks[p] !== ')') fail();
      p++;
      return v;
    }
    return fail();
  }
  try {
    const v = parseExpr();
    if (p !== toks.length) return null;
    return Math.round(v * 1e10) / 1e10;
  } catch {
    return null;
  }
}`,
  },
  {
    id: 'parse-ini',
    title: 'Parse INI-style config',
    level: 2,
    topic: 'parsing',
    entry: 'parseIni',
    prompt: `Write a JavaScript function \`parseIni(text)\` that parses an INI-style config into an object of sections.
- Split \`text\` on '\\n'. Trim each line with String.prototype.trim() (this also removes a trailing '\\r').
- Skip empty lines and lines whose first character (after trimming) is ';' or '#'.
- A line starting with '[' is a section header: it must end with ']' and the name between the brackets, trimmed, must be non-empty. Following keys belong to that section. A section that appears again is merged into the existing one.
- Any other line is 'key = value': split at the FIRST '='; the key is the trimmed text before it and must be non-empty; the value is the trimmed text after it (may be empty, and may itself contain '=', ';' or '#' — no inline comments). Values stay strings. A repeated key overwrites the earlier value.
- Keys before the first header go into the section named '' (empty string).
Return an object mapping section name -> object of key -> value. It contains every section header seen (even ones with no keys), and contains '' only if at least one key appeared before the first header. Empty input returns {}.
Return null for an invalid line: a non-comment line without '=', an empty key, or a malformed header (missing ']' or empty name).`,
    tests: [
      { args: ['[server]\nhost = example.com\nport=8080'], expect: { server: { host: 'example.com', port: '8080' } } },
      { args: [''], expect: {}, note: 'empty input' },
      { args: ['name = ghosty\n[db]\nuser = root'], expect: { '': { name: 'ghosty' }, db: { user: 'root' } }, note: 'keys before first header' },
      { args: ['; comment\n# also\n\n[a]\n'], expect: { a: {} }, note: 'comments and empty section' },
      { args: ['[a]\nx=1\n[b]\ny=2\n[a]\nz=3\nx=4'], expect: { a: { x: '4', z: '3' }, b: { y: '2' } }, note: 'merged section, later key wins' },
      { args: ['[a]\nurl = http://x.io/?q=1'], expect: { a: { url: 'http://x.io/?q=1' } }, note: 'split at first =' },
      { args: ['[a]\nempty =\n'], expect: { a: { empty: '' } }, note: 'empty value' },
      { args: ['  [ spaced name ]  \r\n  key  =  value ; not a comment \r\n'], expect: { 'spaced name': { key: 'value ; not a comment' } }, note: 'trimming and CRLF' },
      { args: ['[a]\njust text'], expect: null, note: 'line without =' },
      { args: ['[]\nk=v'], expect: null, note: 'empty section name' },
      { args: ['[a\nk=v'], expect: null, note: 'unclosed header' },
      { args: ['[a]\n = v'], expect: null, note: 'empty key' },
    ],
    reference: String.raw`function parseIni(text) {
  const out = {};
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line[0] === ';' || line[0] === '#') continue;
    if (line[0] === '[') {
      if (line[line.length - 1] !== ']') return null;
      const name = line.slice(1, -1).trim();
      if (!name) return null;
      section = name;
      if (!Object.prototype.hasOwnProperty.call(out, section)) out[section] = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) return null;
    const key = line.slice(0, eq).trim();
    if (!key) return null;
    if (!Object.prototype.hasOwnProperty.call(out, section)) out[section] = {};
    out[section][key] = line.slice(eq + 1).trim();
  }
  return out;
}`,
  },

  // ---------------------------------------------------------------- data structures
  {
    id: 'lru-cache',
    title: 'LRU cache',
    level: 2,
    topic: 'data structures',
    entry: 'lruCacheRun',
    prompt: `Write a JavaScript function \`lruCacheRun(capacity, ops)\` that simulates a least-recently-used cache of the given capacity (an integer >= 0) and returns one result per operation, in order.
Each op is an array:
- ['get', key]: if the key is present, return its value and mark it most recently used; otherwise return -1.
- ['put', key, value]: insert or update the key with the value and mark it most recently used. If this makes the cache hold more than \`capacity\` keys, evict the least recently used key. The result for a put is null. With capacity 0 nothing is ever stored.
Keys are strings or numbers compared with strict equality (1 and '1' are different keys). Values are never -1.
Return the array of results (one entry per op; [] for no ops).`,
    tests: [
      { args: [2, [['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]]], expect: [null, null, 1, null, -1, null, -1, 3, 4] },
      { args: [1, [['put', 'a', 1], ['put', 'b', 2], ['get', 'a'], ['get', 'b']]], expect: [null, null, -1, 2] },
      { args: [0, [['put', 1, 1], ['get', 1]]], expect: [null, -1], note: 'capacity 0' },
      { args: [2, [['put', 1, 1], ['put', 2, 2], ['put', 1, 10], ['put', 3, 3], ['get', 1], ['get', 2], ['get', 3]]], expect: [null, null, null, null, 10, -1, 3], note: 'update refreshes recency' },
      { args: [2, []], expect: [], note: 'no ops' },
      { args: [2, [['get', 5]]], expect: [-1], note: 'miss on empty cache' },
      { args: [3, [['put', 1, 'x'], ['put', 2, 'y'], ['put', 3, 'z'], ['get', 1], ['put', 4, 'w'], ['get', 2], ['get', 3], ['get', 1], ['get', 4]]], expect: [null, null, null, 'x', null, -1, 'z', 'x', 'w'], note: 'get refreshes recency' },
      { args: [2, [['put', 1, 1], ['put', '1', 2], ['put', 3, 3], ['get', 1], ['get', '1']]], expect: [null, null, null, -1, 2], note: '1 and "1" are different keys' },
    ],
    reference: String.raw`function lruCacheRun(capacity, ops) {
  const m = new Map();
  const out = [];
  for (const op of ops) {
    if (op[0] === 'get') {
      if (m.has(op[1])) {
        const v = m.get(op[1]);
        m.delete(op[1]);
        m.set(op[1], v);
        out.push(v);
      } else out.push(-1);
    } else {
      m.delete(op[1]);
      m.set(op[1], op[2]);
      while (m.size > capacity) m.delete(m.keys().next().value);
      out.push(null);
    }
  }
  return out;
}`,
  },
  {
    id: 'min-heap',
    title: 'Min-heap operations',
    level: 2,
    topic: 'data structures',
    entry: 'minHeapRun',
    prompt: `Write a JavaScript function \`minHeapRun(ops)\` that simulates a priority queue of numbers where the smallest number has the highest priority, and returns one result per operation, in order.
Each op is an array:
- ['push', n]: add the number n (duplicates allowed). Result: null.
- ['pop']: remove and return the smallest number, or null if empty.
- ['peek']: return the smallest number without removing it, or null if empty.
- ['size']: return how many numbers are stored.
Implementing a binary heap is encouraged but only the results are checked. Return the array of results ([] for no ops).`,
    tests: [
      { args: [[['push', 5], ['push', 3], ['push', 8], ['peek'], ['pop'], ['pop'], ['size'], ['pop'], ['pop']]], expect: [null, null, null, 3, 3, 5, 1, 8, null] },
      { args: [[]], expect: [], note: 'no ops' },
      { args: [[['pop'], ['peek'], ['size']]], expect: [null, null, 0], note: 'empty heap' },
      { args: [[['push', 2], ['push', 2], ['push', 1], ['pop'], ['pop'], ['pop'], ['size']]], expect: [null, null, null, 1, 2, 2, 0], note: 'duplicates' },
      { args: [[['push', -1], ['push', -10], ['push', 0], ['peek'], ['size']]], expect: [null, null, null, -10, 3], note: 'negatives' },
      { args: [[['push', 4], ['pop'], ['push', 7], ['push', 6], ['pop'], ['peek']]], expect: [null, 4, null, null, 6, 7] },
      { args: [[['push', 1.5], ['push', 1.25], ['pop']]], expect: [null, null, 1.25], note: 'fractions' },
      { args: [[['push', 9], ['push', 8], ['push', 7], ['push', 6], ['push', 5], ['pop'], ['pop'], ['pop'], ['pop'], ['pop'], ['pop']]], expect: [null, null, null, null, null, 5, 6, 7, 8, 9, null] },
    ],
    reference: String.raw`function minHeapRun(ops) {
  const h = [];
  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let s = i;
      if (l < h.length && h[l] < h[s]) s = l;
      if (r < h.length && h[r] < h[s]) s = r;
      if (s === i) return;
      [h[s], h[i]] = [h[i], h[s]];
      i = s;
    }
  };
  const out = [];
  for (const op of ops) {
    if (op[0] === 'push') { h.push(op[1]); up(h.length - 1); out.push(null); }
    else if (op[0] === 'peek') out.push(h.length ? h[0] : null);
    else if (op[0] === 'size') out.push(h.length);
    else {
      if (!h.length) { out.push(null); continue; }
      const top = h[0];
      const last = h.pop();
      if (h.length) { h[0] = last; down(0); }
      out.push(top);
    }
  }
  return out;
}`,
  },
  {
    id: 'trie-prefix-search',
    title: 'Trie prefix search',
    level: 2,
    topic: 'data structures',
    entry: 'triePrefixSearch',
    prompt: `Write a JavaScript function \`triePrefixSearch(words, prefixes)\` (a trie is the intended approach).
\`words\` is an array of strings to index; \`prefixes\` is an array of query strings.
For each prefix, in order, return the array of DISTINCT indexed words that start with that prefix (case-sensitive), sorted ascending in plain code-unit order (Array.prototype.sort() with no comparator). The empty prefix matches every word; the empty string is itself a valid word. A prefix that matches nothing gives [].
Return an array with one such array per prefix ([] if there are no prefixes).`,
    tests: [
      { args: [['apple', 'app', 'application', 'apt', 'banana'], ['app', 'ap', 'b', 'c']], expect: [['app', 'apple', 'application'], ['app', 'apple', 'application', 'apt'], ['banana'], []] },
      { args: [[], ['a']], expect: [[]], note: 'no words' },
      { args: [['a', 'b'], []], expect: [], note: 'no queries' },
      { args: [['a', 'a', 'ab'], ['a']], expect: [['a', 'ab']], note: 'duplicates removed' },
      { args: [['car', 'Card', 'care'], ['car', 'Car', '']], expect: [['car', 'care'], ['Card'], ['Card', 'car', 'care']], note: 'case-sensitive; empty prefix' },
      { args: [['hello'], ['hello', 'helloo']], expect: [['hello'], []], note: 'prefix longer than word' },
      { args: [['', 'x'], ['']], expect: [['', 'x']], note: 'empty word' },
    ],
    reference: String.raw`function triePrefixSearch(words, prefixes) {
  const root = { kids: new Map(), end: false };
  for (const w of words) {
    let n = root;
    for (const c of w) {
      if (!n.kids.has(c)) n.kids.set(c, { kids: new Map(), end: false });
      n = n.kids.get(c);
    }
    n.end = true;
  }
  const collect = (n, acc, out) => {
    if (n.end) out.push(acc);
    for (const [c, k] of n.kids) collect(k, acc + c, out);
  };
  return prefixes.map((p) => {
    let n = root;
    for (const c of p) {
      n = n.kids.get(c);
      if (!n) return [];
    }
    const out = [];
    collect(n, p, out);
    return out.sort();
  });
}`,
  },
  {
    id: 'merge-intervals',
    title: 'Merge intervals',
    level: 1,
    topic: 'data structures',
    entry: 'mergeIntervals',
    prompt: `Write a JavaScript function \`mergeIntervals(intervals)\` where \`intervals\` is an array of [start, end] number pairs with start <= end, in any order.
Merge every set of intervals that overlap OR touch (an interval ending at 4 and one starting at 4 merge into one). Return a new array of [start, end] pairs sorted by start, with no two returned intervals overlapping or touching. An empty input returns [].
Example: mergeIntervals([[1,3],[2,6],[8,10]]) returns [[1,6],[8,10]].`,
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expect: [[1, 6], [8, 10], [15, 18]] },
      { args: [[]], expect: [], note: 'empty' },
      { args: [[[1, 4], [4, 5]]], expect: [[1, 5]], note: 'touching intervals merge' },
      { args: [[[5, 6], [1, 2]]], expect: [[1, 2], [5, 6]], note: 'unsorted input' },
      { args: [[[1, 10], [2, 3], [4, 5]]], expect: [[1, 10]], note: 'containment' },
      { args: [[[3, 3]]], expect: [[3, 3]], note: 'zero-length interval' },
      { args: [[[1, 2], [3, 4]]], expect: [[1, 2], [3, 4]], note: 'gap of 1 does not merge' },
      { args: [[[-5, -1], [-2, 0], [0, 0]]], expect: [[-5, 0]], note: 'negatives' },
    ],
    reference: String.raw`function mergeIntervals(intervals) {
  const s = intervals.map((x) => [x[0], x[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}`,
  },
  {
    id: 'ring-buffer',
    title: 'Ring buffer',
    level: 2,
    topic: 'data structures',
    entry: 'ringBufferRun',
    prompt: `Write a JavaScript function \`ringBufferRun(capacity, ops)\` that simulates a fixed-size circular buffer (FIFO) holding at most \`capacity\` items (an integer >= 1) and returns one result per operation, in order.
Each op is an array:
- ['write', value]: append value as the newest item. If the buffer is already full, the oldest item is discarded first. Result: null.
- ['read']: remove and return the oldest item, or null if empty.
- ['peek']: return the oldest item without removing it, or null if empty.
- ['size']: return the number of stored items.
- ['toArray']: return an array of the stored items from oldest to newest ([] if empty).
Values can be any JSON value, including 0, false and ''. Return the array of results ([] for no ops).`,
    tests: [
      { args: [3, [['write', 1], ['write', 2], ['write', 3], ['write', 4], ['toArray'], ['read'], ['size']]], expect: [null, null, null, null, [2, 3, 4], 2, 2], note: 'overwrite oldest when full' },
      { args: [1, [['write', 'a'], ['write', 'b'], ['peek'], ['read'], ['read']]], expect: [null, null, 'b', 'b', null], note: 'capacity 1' },
      { args: [2, []], expect: [], note: 'no ops' },
      { args: [2, [['read'], ['peek'], ['size'], ['toArray']]], expect: [null, null, 0, []], note: 'empty buffer' },
      { args: [3, [['write', 1], ['read'], ['write', 2], ['write', 3], ['write', 4], ['write', 5], ['toArray']]], expect: [null, 1, null, null, null, null, [3, 4, 5]], note: 'wrap-around' },
      { args: [2, [['write', 0], ['write', false], ['toArray'], ['read'], ['peek']]], expect: [null, null, [0, false], 0, false], note: 'falsy values' },
      { args: [4, [['write', 1], ['write', 2], ['read'], ['write', 3], ['size'], ['toArray']]], expect: [null, null, 1, null, 2, [2, 3]] },
    ],
    reference: String.raw`function ringBufferRun(capacity, ops) {
  const buf = new Array(capacity);
  let head = 0;
  let size = 0;
  const out = [];
  for (const op of ops) {
    if (op[0] === 'write') {
      if (size === capacity) { head = (head + 1) % capacity; size--; }
      buf[(head + size) % capacity] = op[1];
      size++;
      out.push(null);
    } else if (op[0] === 'read') {
      if (!size) { out.push(null); continue; }
      out.push(buf[head]);
      head = (head + 1) % capacity;
      size--;
    } else if (op[0] === 'peek') out.push(size ? buf[head] : null);
    else if (op[0] === 'size') out.push(size);
    else {
      const arr = [];
      for (let i = 0; i < size; i++) arr.push(buf[(head + i) % capacity]);
      out.push(arr);
    }
  }
  return out;
}`,
  },

  // ---------------------------------------------------------------- algorithms
  {
    id: 'lower-bound',
    title: 'Binary search: first index >= target',
    level: 1,
    topic: 'algorithms',
    entry: 'lowerBound',
    prompt: `Write a JavaScript function \`lowerBound(arr, target)\` where \`arr\` is an array of numbers sorted ascending (duplicates possible).
Return the smallest index i such that arr[i] >= target. If no element is >= target (including when arr is empty), return arr.length.
Use binary search (O(log n)); only the returned index is checked.`,
    tests: [
      { args: [[1, 3, 5, 7], 5], expect: 2, note: 'exact match' },
      { args: [[1, 3, 5, 7], 4], expect: 2, note: 'between elements' },
      { args: [[1, 3, 5, 7], 0], expect: 0, note: 'before all' },
      { args: [[1, 3, 5, 7], 8], expect: 4, note: 'after all' },
      { args: [[], 3], expect: 0, note: 'empty array' },
      { args: [[2, 2, 2, 2], 2], expect: 0, note: 'all equal' },
      { args: [[1, 2, 2, 2, 3], 2], expect: 1, note: 'first of duplicates' },
      { args: [[1, 2, 2, 2, 3], 2.5], expect: 4 },
      { args: [[-10, -5, 0], -5], expect: 1, note: 'negatives' },
    ],
    reference: String.raw`function lowerBound(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1; else hi = mid;
  }
  return lo;
}`,
  },
  {
    id: 'two-sum',
    title: 'Two sum',
    level: 1,
    topic: 'algorithms',
    entry: 'twoSum',
    prompt: `Write a JavaScript function \`twoSum(nums, target)\` that finds two DIFFERENT indices i < j with nums[i] + nums[j] === target.
If several pairs exist, return the pair with the smallest j; among pairs with that j, the smallest i.
Return [i, j], or null if no such pair exists (including empty or single-element arrays).`,
    tests: [
      { args: [[2, 7, 11, 15], 9], expect: [0, 1] },
      { args: [[3, 2, 4], 6], expect: [1, 2], note: 'cannot reuse index 0' },
      { args: [[3, 3], 6], expect: [0, 1], note: 'equal values' },
      { args: [[1, 2, 3], 7], expect: null, note: 'no pair' },
      { args: [[], 0], expect: null, note: 'empty' },
      { args: [[5], 10], expect: null, note: 'same element twice is not allowed' },
      { args: [[1, 4, 3, 2, 5], 5], expect: [0, 1], note: 'smallest j wins' },
      { args: [[1, 1, 2], 3], expect: [0, 2], note: 'smallest i for that j' },
      { args: [[-1, -2, -3, -4], -7], expect: [2, 3], note: 'negatives' },
      { args: [[0, 4, 0], 0], expect: [0, 2], note: 'zeros' },
    ],
    reference: String.raw`function twoSum(nums, target) {
  const first = new Map();
  for (let j = 0; j < nums.length; j++) {
    const need = target - nums[j];
    if (first.has(need)) return [first.get(need), j];
    if (!first.has(nums[j])) first.set(nums[j], j);
  }
  return null;
}`,
  },
  {
    id: 'longest-unique-substring',
    title: 'Longest substring without repeating characters',
    level: 2,
    topic: 'algorithms',
    entry: 'longestUniqueSubstring',
    prompt: `Write a JavaScript function \`longestUniqueSubstring(s)\` that returns the longest contiguous substring of \`s\` in which no character appears twice (case-sensitive).
If several substrings share the maximum length, return the one that starts earliest. For an empty string return ''. Return the substring itself (a string), not its length.
Example: longestUniqueSubstring('pwwkew') returns 'wke'.`,
    tests: [
      { args: ['abcabcbb'], expect: 'abc', note: 'earliest of several' },
      { args: ['bbbbb'], expect: 'b' },
      { args: ['pwwkew'], expect: 'wke' },
      { args: [''], expect: '', note: 'empty' },
      { args: ['abcdef'], expect: 'abcdef', note: 'whole string' },
      { args: ['abba'], expect: 'ab', note: 'window must not move backwards' },
      { args: ['dvdf'], expect: 'vdf' },
      { args: ['aA'], expect: 'aA', note: 'case-sensitive' },
      { args: ['tmmzuxt'], expect: 'mzuxt' },
    ],
    reference: String.raw`function longestUniqueSubstring(s) {
  const last = new Map();
  let start = 0;
  let bestStart = 0;
  let bestLen = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (last.has(c) && last.get(c) >= start) start = last.get(c) + 1;
    last.set(c, i);
    if (i - start + 1 > bestLen) { bestLen = i - start + 1; bestStart = start; }
  }
  return s.slice(bestStart, bestStart + bestLen);
}`,
  },
  {
    id: 'top-k-frequent-words',
    title: 'Top-k frequent words',
    level: 2,
    topic: 'algorithms',
    entry: 'topKFrequent',
    prompt: `Write a JavaScript function \`topKFrequent(words, k)\` that returns the \`k\` most frequent distinct strings in the array \`words\` (case-sensitive: 'Apple' and 'apple' are different words).
Order the result by frequency, highest first; words with equal frequency are ordered ascending in plain code-unit order (so 'Apple' comes before 'apple', 'a' before 'b').
If k is larger than the number of distinct words, return all of them. If k <= 0 or words is empty, return [].
Return an array of strings.`,
    tests: [
      { args: [['i', 'love', 'leetcode', 'i', 'love', 'coding'], 2], expect: ['i', 'love'] },
      { args: [['the', 'day', 'is', 'sunny', 'the', 'the', 'the', 'sunny', 'is', 'is'], 4], expect: ['the', 'is', 'sunny', 'day'] },
      { args: [['b', 'a', 'c'], 2], expect: ['a', 'b'], note: 'all tied: alphabetical' },
      { args: [[], 3], expect: [], note: 'empty' },
      { args: [['x', 'y'], 0], expect: [], note: 'k = 0' },
      { args: [['a', 'b', 'a'], 10], expect: ['a', 'b'], note: 'k larger than distinct count' },
      { args: [['Apple', 'apple', 'apple', 'Apple', 'banana'], 2], expect: ['Apple', 'apple'], note: 'case-sensitive tie' },
      { args: [['z', 'z', 'y', 'y', 'x'], 1], expect: ['y'], note: 'tie at the cut-off' },
    ],
    reference: String.raw`function topKFrequent(words, k) {
  if (k <= 0) return [];
  const c = new Map();
  for (const w of words) c.set(w, (c.get(w) || 0) + 1);
  return [...c.keys()]
    .sort((a, b) => c.get(b) - c.get(a) || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, k);
}`,
  },
  {
    id: 'topological-sort',
    title: 'Topological sort',
    level: 2,
    topic: 'graphs',
    entry: 'topoSort',
    prompt: `Write a JavaScript function \`topoSort(n, edges)\` for a directed graph with nodes 0..n-1 (n >= 0). Each edge [u, v] means u must come before v. Edges may repeat; a self-loop [u, u] is a cycle.
Return an array containing every node exactly once in an order that respects all edges. When several nodes are available at the same time, always take the SMALLEST available node number next (this makes the answer unique: the lexicographically smallest valid order).
If the graph has a cycle, return null.`,
    tests: [
      { args: [4, [[0, 1], [0, 2], [1, 3], [2, 3]]], expect: [0, 1, 2, 3] },
      { args: [3, []], expect: [0, 1, 2], note: 'no edges' },
      { args: [0, []], expect: [], note: 'empty graph' },
      { args: [3, [[0, 1], [1, 2], [2, 0]]], expect: null, note: 'cycle' },
      { args: [3, [[2, 1], [1, 0]]], expect: [2, 1, 0] },
      { args: [5, [[3, 1], [4, 1], [1, 0]]], expect: [2, 3, 4, 1, 0], note: 'smallest available first' },
      { args: [2, [[0, 0]]], expect: null, note: 'self-loop' },
      { args: [3, [[0, 1], [0, 1], [1, 2]]], expect: [0, 1, 2], note: 'duplicate edges' },
      { args: [4, [[1, 0], [3, 2]]], expect: [1, 0, 3, 2], note: 'newly freed smaller node is taken next' },
    ],
    reference: String.raw`function topoSort(n, edges) {
  const indeg = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) { adj[u].push(v); indeg[v]++; }
  const ready = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) ready.push(i);
  const out = [];
  while (ready.length) {
    ready.sort((a, b) => a - b);
    const u = ready.shift();
    out.push(u);
    for (const v of adj[u]) if (--indeg[v] === 0) ready.push(v);
  }
  return out.length === n ? out : null;
}`,
  },
  {
    id: 'dijkstra-distances',
    title: 'Dijkstra shortest distances',
    level: 3,
    topic: 'graphs',
    entry: 'dijkstra',
    prompt: `Write a JavaScript function \`dijkstra(graph, source)\` that computes shortest-path distances in a DIRECTED weighted graph.
\`graph\` is an object mapping a node name (string) to an array of [neighbour, weight] pairs, meaning an edge node -> neighbour with that non-negative number weight. Parallel edges may appear. A node may appear only as a neighbour (never as a key). \`source\` is always a key of graph.
Return an object with one property for EVERY node that appears anywhere in the graph (as a key or as a neighbour): its value is the length of the shortest path from source, or null if the node is unreachable. The source maps to 0.`,
    tests: [
      { args: [{ A: [['B', 1], ['C', 4]], B: [['C', 2], ['D', 5]], C: [['D', 1]], D: [] }, 'A'], expect: { A: 0, B: 1, C: 3, D: 4 } },
      { args: [{ A: [] }, 'A'], expect: { A: 0 }, note: 'single node' },
      { args: [{ A: [['B', 2]], B: [], C: [['A', 1]] }, 'A'], expect: { A: 0, B: 2, C: null }, note: 'unreachable node is null' },
      { args: [{ A: [['B', 5]], B: [['A', 1]] }, 'B'], expect: { A: 1, B: 0 }, note: 'directed' },
      { args: [{ A: [['B', 0]], B: [['C', 0]] }, 'A'], expect: { A: 0, B: 0, C: 0 }, note: 'zero weights; neighbour-only node' },
      { args: [{ S: [['A', 7], ['B', 2]], B: [['A', 3], ['C', 8]], A: [['C', 1]] }, 'S'], expect: { S: 0, A: 5, B: 2, C: 6 }, note: 'longer path is shorter' },
      { args: [{ A: [['B', 3], ['B', 1]] }, 'A'], expect: { A: 0, B: 1 }, note: 'parallel edges' },
      { args: [{ X: [['Y', 1]], Y: [['Z', 1]], Z: [['X', 1]] }, 'Y'], expect: { X: 2, Y: 0, Z: 1 }, note: 'cycle' },
    ],
    reference: String.raw`function dijkstra(graph, source) {
  const dist = {};
  for (const [u, es] of Object.entries(graph)) {
    dist[u] = Infinity;
    for (const [v] of es) dist[v] = Infinity;
  }
  dist[source] = 0;
  const done = new Set();
  for (;;) {
    let u = null;
    for (const k of Object.keys(dist)) {
      if (!done.has(k) && dist[k] !== Infinity && (u === null || dist[k] < dist[u])) u = k;
    }
    if (u === null) break;
    done.add(u);
    for (const [v, w] of graph[u] || []) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  }
  for (const k of Object.keys(dist)) if (dist[k] === Infinity) dist[k] = null;
  return dist;
}`,
  },
  {
    id: 'grid-shortest-path',
    title: 'Shortest path on a grid',
    level: 2,
    topic: 'graphs',
    entry: 'gridShortestPath',
    prompt: `Write a JavaScript function \`gridShortestPath(grid)\` where \`grid\` is an array of equal-length strings. Characters: 'S' start, 'E' end, '#' wall, '.' open floor. 'S' and 'E' are walkable; only '#' blocks. Each appears at most once.
Moves are one cell up, down, left or right (no diagonals) and may not leave the grid.
Return the minimum number of moves from S to E, or -1 if E is unreachable or if the grid has no 'S' or no 'E'.`,
    tests: [
      { args: [['S.#', '..#', '#.E']], expect: 4 },
      { args: [['S#E']], expect: -1, note: 'blocked' },
      { args: [['SE']], expect: 1, note: 'adjacent' },
      { args: [['S...', '###.', 'E...']], expect: 8, note: 'detour' },
      { args: [['....']], expect: -1, note: 'no S or E' },
      { args: [['S']], expect: -1, note: 'no E' },
      { args: [['S.', '.E']], expect: 2, note: 'no diagonal moves' },
      { args: [['S.....', '.####.', '.#E..#', '.#.#.#', '...#..']], expect: 8, note: 'maze' },
    ],
    reference: String.raw`function gridShortestPath(grid) {
  let s = null;
  let e = null;
  grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'S') s = [r, c];
      if (row[c] === 'E') e = [r, c];
    }
  });
  if (!s || !e) return -1;
  const seen = new Set([s.join(',')]);
  let frontier = [s];
  let steps = 0;
  while (frontier.length) {
    const next = [];
    for (const [r, c] of frontier) {
      if (r === e[0] && c === e[1]) return steps;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[nr].length) continue;
        if (grid[nr][nc] === '#' || seen.has(nr + ',' + nc)) continue;
        seen.add(nr + ',' + nc);
        next.push([nr, nc]);
      }
    }
    frontier = next;
    steps++;
  }
  return -1;
}`,
  },
  {
    id: 'count-islands',
    title: 'Count islands (flood fill)',
    level: 1,
    topic: 'graphs',
    entry: 'countIslands',
    prompt: `Write a JavaScript function \`countIslands(grid)\` where \`grid\` is an array of equal-length strings made of '1' (land) and '0' (water).
An island is a maximal group of land cells connected horizontally or vertically (diagonal contact does NOT connect). Cells outside the grid are water.
Return the number of islands (0 for an empty grid).`,
    tests: [
      { args: [['11110', '11010', '11000', '00000']], expect: 1 },
      { args: [['11000', '11000', '00100', '00011']], expect: 3 },
      { args: [[]], expect: 0, note: 'empty grid' },
      { args: [['0']], expect: 0 },
      { args: [['1']], expect: 1 },
      { args: [['101', '010', '101']], expect: 5, note: 'diagonals do not connect' },
      { args: [['111', '101', '111']], expect: 1, note: 'ring around a lake' },
      { args: [['1', '0', '1', '1']], expect: 2, note: 'single column' },
    ],
    reference: String.raw`function countIslands(grid) {
  const seen = grid.map((row) => new Array(row.length).fill(false));
  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== '1' || seen[r][c]) continue;
      count++;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[ny].length) continue;
          if (grid[ny][nx] === '1' && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([ny, nx]); }
        }
      }
    }
  }
  return count;
}`,
  },

  // ---------------------------------------------------------------- dynamic programming
  {
    id: 'edit-distance',
    title: 'Edit distance',
    level: 3,
    topic: 'dp',
    entry: 'editDistance',
    prompt: `Write a JavaScript function \`editDistance(a, b)\` that returns the Levenshtein distance between strings a and b: the minimum number of single-character insertions, deletions and substitutions needed to turn a into b (each costs 1; no transpositions). Comparison is case-sensitive. Return a number.`,
    tests: [
      { args: ['kitten', 'sitting'], expect: 3 },
      { args: ['', ''], expect: 0, note: 'both empty' },
      { args: ['abc', ''], expect: 3, note: 'all deletions' },
      { args: ['', 'ab'], expect: 2, note: 'all insertions' },
      { args: ['horse', 'ros'], expect: 3 },
      { args: ['intention', 'execution'], expect: 5 },
      { args: ['same', 'same'], expect: 0 },
      { args: ['ab', 'ba'], expect: 2, note: 'no transpositions' },
      { args: ['a', 'A'], expect: 1, note: 'case-sensitive' },
    ],
    reference: String.raw`function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}`,
  },
  {
    id: 'coin-change',
    title: 'Coin change: fewest coins',
    level: 2,
    topic: 'dp',
    entry: 'coinChange',
    prompt: `Write a JavaScript function \`coinChange(coins, amount)\` where \`coins\` is an array of distinct positive integer denominations (possibly empty) and \`amount\` is a non-negative integer.
Each denomination may be used any number of times. Return the fewest coins whose values sum exactly to amount, or -1 if that is impossible. An amount of 0 needs 0 coins (even with no coins).
Note that greedy (always taking the largest coin) is not always optimal.`,
    tests: [
      { args: [[1, 2, 5], 11], expect: 3 },
      { args: [[2], 3], expect: -1, note: 'impossible' },
      { args: [[1], 0], expect: 0, note: 'zero amount' },
      { args: [[], 0], expect: 0, note: 'no coins, zero amount' },
      { args: [[], 5], expect: -1, note: 'no coins' },
      { args: [[186, 419, 83, 408], 6249], expect: 20 },
      { args: [[3, 7], 5], expect: -1 },
      { args: [[5, 3], 9], expect: 3, note: 'unsorted coins' },
      { args: [[1, 3, 4], 6], expect: 2, note: 'greedy would give 3' },
    ],
    reference: String.raw`function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}`,
  },
  {
    id: 'lis-length',
    title: 'Longest increasing subsequence',
    level: 2,
    topic: 'dp',
    entry: 'lisLength',
    prompt: `Write a JavaScript function \`lisLength(nums)\` that returns the length of the longest STRICTLY increasing subsequence of the number array nums (elements need not be contiguous, but must keep their order). Equal values do not count as increasing. An empty array returns 0.`,
    tests: [
      { args: [[10, 9, 2, 5, 3, 7, 101, 18]], expect: 4 },
      { args: [[]], expect: 0, note: 'empty' },
      { args: [[7]], expect: 1 },
      { args: [[0, 1, 0, 3, 2, 3]], expect: 4 },
      { args: [[7, 7, 7, 7]], expect: 1, note: 'strictly increasing only' },
      { args: [[5, 4, 3, 2, 1]], expect: 1, note: 'decreasing' },
      { args: [[1, 2, 3, 4, 5]], expect: 5 },
      { args: [[3, 10, 2, 1, 20]], expect: 3 },
      { args: [[-2, -1, -3, 0]], expect: 3, note: 'negatives' },
    ],
    reference: String.raw`function lisLength(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1; else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}`,
  },
  {
    id: 'knapsack-01',
    title: '0/1 knapsack',
    level: 3,
    topic: 'dp',
    entry: 'knapsack',
    prompt: `Write a JavaScript function \`knapsack(items, capacity)\` where \`items\` is an array of [weight, value] pairs (non-negative integer weights, non-negative values) and \`capacity\` is a non-negative integer.
Each item may be taken at most once. Return the maximum total value of a selection whose total weight is <= capacity (0 if nothing fits or there are no items). Items of weight 0 always fit.`,
    tests: [
      { args: [[[1, 1], [3, 4], [4, 5], [5, 7]], 7], expect: 9 },
      { args: [[], 10], expect: 0, note: 'no items' },
      { args: [[[5, 10]], 4], expect: 0, note: 'nothing fits' },
      { args: [[[5, 10]], 5], expect: 10, note: 'exact fit' },
      { args: [[[1, 6], [2, 10], [3, 12]], 5], expect: 22 },
      { args: [[[0, 5], [2, 3]], 0], expect: 5, note: 'zero-weight item with zero capacity' },
      { args: [[[2, 3], [2, 3], [2, 3]], 5], expect: 6, note: 'each item once' },
      { args: [[[10, 60], [20, 100], [30, 120]], 50], expect: 220, note: 'greedy by ratio fails' },
    ],
    reference: String.raw`function knapsack(items, capacity) {
  const dp = new Array(capacity + 1).fill(0);
  for (const [w, v] of items) {
    for (let c = capacity; c >= w; c--) dp[c] = Math.max(dp[c], dp[c - w] + v);
  }
  return dp[capacity];
}`,
  },

  // ---------------------------------------------------------------- dates and time
  {
    id: 'add-business-days',
    title: 'Add business days',
    level: 2,
    topic: 'dates',
    entry: 'addBusinessDays',
    prompt: `Write a JavaScript function \`addBusinessDays(date, n)\` where \`date\` is a calendar date string 'YYYY-MM-DD' and \`n\` is an integer (may be negative or zero). Ignore time zones (treat dates as plain calendar dates, e.g. via UTC).
Business days are Monday to Friday (no holidays).
- If n is 0, return the input date unchanged (even if it is a weekend).
- Otherwise step one calendar day at a time forwards (n > 0) or backwards (n < 0), counting only the days you land on that are business days, until |n| business days have been counted; return the date reached.
So from a Saturday, +1 gives the following Monday and -1 gives the previous Friday.
Return the result as 'YYYY-MM-DD'. Return null if date is not exactly 4-digit year, 2-digit month, 2-digit day separated by '-', or is not a real calendar date (e.g. '2024-02-30'), or if n is not an integer.`,
    tests: [
      { args: ['2024-01-05', 1], expect: '2024-01-08', note: 'Friday + 1 -> Monday' },
      { args: ['2024-01-01', 5], expect: '2024-01-08' },
      { args: ['2024-01-06', 1], expect: '2024-01-08', note: 'from Saturday' },
      { args: ['2024-01-08', -1], expect: '2024-01-05', note: 'backwards over weekend' },
      { args: ['2024-01-06', 0], expect: '2024-01-06', note: 'n = 0 returns input' },
      { args: ['2024-02-28', 2], expect: '2024-03-01', note: 'leap year' },
      { args: ['2023-12-29', 1], expect: '2024-01-01', note: 'year boundary' },
      { args: ['2024-01-01', 10], expect: '2024-01-15' },
      { args: ['2024-02-30', 1], expect: null, note: 'not a real date' },
      { args: ['2024-1-5', 1], expect: null, note: 'wrong format' },
      { args: ['2024-01-07', -1], expect: '2024-01-05', note: 'Sunday - 1 -> Friday' },
    ],
    reference: String.raw`function addBusinessDays(date, n) {
  if (typeof date !== 'string' || !Number.isInteger(n)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  const step = n > 0 ? 1 : -1;
  let left = Math.abs(n);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}`,
  },
  {
    id: 'iso-week',
    title: 'ISO week number',
    level: 3,
    topic: 'dates',
    entry: 'isoWeek',
    prompt: `Write a JavaScript function \`isoWeek(date)\` where \`date\` is a calendar date string 'YYYY-MM-DD'. Ignore time zones (treat it as a plain calendar date, e.g. via UTC).
Return its ISO-8601 week as the string 'YYYY-Www': the ISO week-numbering year, '-W', and the week number zero-padded to 2 digits (e.g. '2024-W01', '2020-W53').
ISO rules: weeks start on Monday; week 1 is the week containing the year's first Thursday (equivalently, the week containing 4 January). The ISO year can differ from the calendar year near 1 January (e.g. 2021-01-03 is in '2020-W53'; 2019-12-30 is in '2020-W01').
Return null if the string is not exactly 4-digit year, 2-digit month, 2-digit day separated by '-', or is not a real calendar date.`,
    tests: [
      { args: ['2024-01-01'], expect: '2024-W01' },
      { args: ['2021-01-03'], expect: '2020-W53', note: 'belongs to previous ISO year' },
      { args: ['2020-12-31'], expect: '2020-W53', note: '53-week year' },
      { args: ['2019-12-30'], expect: '2020-W01', note: 'belongs to next ISO year' },
      { args: ['2026-10-15'], expect: '2026-W42' },
      { args: ['2027-01-01'], expect: '2026-W53' },
      { args: ['2024-12-30'], expect: '2025-W01' },
      { args: ['2023-13-01'], expect: null, note: 'invalid month' },
      { args: ['not a date'], expect: null, note: 'garbage' },
    ],
    reference: String.raw`function isoWeek(date) {
  if (typeof date !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  const dow = (d.getUTCDay() + 6) % 7;
  const thu = new Date(d.getTime());
  thu.setUTCDate(d.getUTCDate() - dow + 3);
  const year = thu.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thu.getTime() - jan1) / 86400000 / 7) + 1;
  return year + '-W' + String(week).padStart(2, '0');
}`,
  },
  {
    id: 'minutes-between',
    title: 'Minutes between two clock times',
    level: 1,
    topic: 'dates',
    entry: 'minutesBetween',
    prompt: `Write a JavaScript function \`minutesBetween(start, end)\` where both arguments are 24-hour clock times 'HH:MM' (exactly two digits each, hours 00-23, minutes 00-59).
Return the number of minutes from start forward to end. If end is earlier than start, the interval crosses midnight (e.g. '23:00' to '01:00' is 120). Equal times give 0.
Return null if either argument does not match the format or is out of range (e.g. '24:00', '9:00', '12:60').`,
    tests: [
      { args: ['09:00', '17:30'], expect: 510 },
      { args: ['23:00', '01:00'], expect: 120, note: 'crosses midnight' },
      { args: ['12:00', '12:00'], expect: 0, note: 'equal' },
      { args: ['00:00', '23:59'], expect: 1439 },
      { args: ['23:59', '00:00'], expect: 1 },
      { args: ['18:45', '06:15'], expect: 690 },
      { args: ['24:00', '01:00'], expect: null, note: 'hour out of range' },
      { args: ['9:00', '10:00'], expect: null, note: 'single-digit hour' },
      { args: ['12:60', '13:00'], expect: null, note: 'minute out of range' },
    ],
    reference: String.raw`function minutesBetween(start, end) {
  const p = (t) => {
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return +m[1] * 60 + +m[2];
  };
  const a = p(start);
  const b = p(end);
  if (a === null || b === null) return null;
  return (b - a + 1440) % 1440;
}`,
  },

  // ---------------------------------------------------------------- geometry and maths
  {
    id: 'haversine-distance',
    title: 'Great-circle distance',
    level: 1,
    topic: 'geometry',
    entry: 'haversine',
    prompt: `Write a JavaScript function \`haversine(lat1, lon1, lat2, lon2)\` that returns the great-circle distance in kilometres between two points given in decimal degrees, using the haversine formula with an Earth radius of exactly 6371 km:
  a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2),  c = 2 · atan2(√a, √(1−a)),  d = 6371 · c
(φ = latitude, λ = longitude, converted to radians).
Round the result to one decimal place with Math.round(d * 10) / 10 and return it as a number.`,
    tests: [
      { args: [0, 0, 0, 0], expect: 0, note: 'same point' },
      { args: [0, 0, 0, 1], expect: 111.2, note: 'one degree on the equator' },
      { args: [51.5074, -0.1278, 48.8566, 2.3522], expect: 343.6, note: 'London to Paris' },
      { args: [40.7128, -74.006, 34.0522, -118.2437], expect: 3935.7, note: 'New York to Los Angeles' },
      { args: [0, 0, 0, 180], expect: 20015.1, note: 'antipodes' },
      { args: [90, 0, -90, 0], expect: 20015.1, note: 'pole to pole' },
      { args: [-33.8688, 151.2093, 35.6762, 139.6503], expect: 7825.8, note: 'Sydney to Tokyo' },
      { args: [0, 179.5, 0, -179.5], expect: 111.2, note: 'across the antimeridian' },
    ],
    reference: String.raw`function haversine(lat1, lon1, lat2, lon2) {
  const r = (x) => (x * Math.PI) / 180;
  const p1 = r(lat1);
  const p2 = r(lat2);
  const dp = r(lat2 - lat1);
  const dl = r(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const d = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(d * 10) / 10;
}`,
  },
  {
    id: 'point-in-polygon',
    title: 'Point in polygon',
    level: 2,
    topic: 'geometry',
    entry: 'pointInPolygon',
    prompt: `Write a JavaScript function \`pointInPolygon(point, polygon)\` where \`point\` is [x, y] and \`polygon\` is an array of [x, y] vertices of a simple polygon (not self-intersecting, possibly concave, vertices in either winding order, closed implicitly from the last vertex back to the first).
Return true if the point lies strictly inside the polygon, false if outside. Use the ray-casting (even-odd) method. A polygon with fewer than 3 vertices contains nothing: return false.
Points exactly on an edge or vertex are never tested.`,
    tests: [
      { args: [[2, 2], [[0, 0], [4, 0], [4, 4], [0, 4]]], expect: true },
      { args: [[5, 2], [[0, 0], [4, 0], [4, 4], [0, 4]]], expect: false, note: 'right of square' },
      { args: [[-1, -1], [[0, 0], [4, 0], [4, 4], [0, 4]]], expect: false },
      { args: [[1, 1], [[0, 0], [2, 0]]], expect: false, note: 'degenerate polygon' },
      { args: [[3, 4], [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]], expect: false, note: 'inside the notch of a U shape' },
      { args: [[1, 4], [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]], expect: true, note: 'left arm of U' },
      { args: [[5, 5], [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]], expect: true, note: 'right arm of U' },
      { args: [[3, 1], [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]], expect: true, note: 'base of U' },
      { args: [[5, 5], [[0, 0], [10, 0], [5, 10]]], expect: true, note: 'triangle' },
      { args: [[9, 9], [[5, 10], [10, 0], [0, 0]]], expect: false, note: 'triangle, clockwise order' },
    ],
    reference: String.raw`function pointInPolygon(point, polygon) {
  if (polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}`,
  },
  {
    id: 'gcd-lcm',
    title: 'GCD and LCM of a list',
    level: 1,
    topic: 'maths',
    entry: 'gcdLcm',
    prompt: `Write a JavaScript function \`gcdLcm(nums)\` that returns the greatest common divisor and least common multiple of an array of positive integers, as an object { gcd, lcm }.
For a single number n the result is { gcd: n, lcm: n }. Results always fit in safe integers in the tests.
Return null if the array is empty or any element is not a positive integer (0, negatives and non-integers are invalid).`,
    tests: [
      { args: [[12, 18]], expect: { gcd: 6, lcm: 36 } },
      { args: [[5]], expect: { gcd: 5, lcm: 5 }, note: 'single element' },
      { args: [[]], expect: null, note: 'empty' },
      { args: [[2, 3, 4]], expect: { gcd: 1, lcm: 12 } },
      { args: [[7, 13]], expect: { gcd: 1, lcm: 91 }, note: 'coprime' },
      { args: [[8, 0]], expect: null, note: 'zero is invalid' },
      { args: [[4, -2]], expect: null, note: 'negative is invalid' },
      { args: [[1.5, 3]], expect: null, note: 'non-integer is invalid' },
      { args: [[100, 75, 50]], expect: { gcd: 25, lcm: 300 } },
      { args: [[1, 1, 1]], expect: { gcd: 1, lcm: 1 } },
    ],
    reference: String.raw`function gcdLcm(nums) {
  if (!nums.length || nums.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  let g = nums[0];
  let l = nums[0];
  for (const n of nums.slice(1)) {
    g = gcd(g, n);
    l = (l / gcd(l, n)) * n;
  }
  return { gcd: g, lcm: l };
}`,
  },

  // ---------------------------------------------------------------- games
  {
    id: 'tic-tac-toe-winner',
    title: 'Tic-tac-toe result',
    level: 3,
    topic: 'games',
    entry: 'ticTacToeWinner',
    prompt: `Write a JavaScript function \`ticTacToeWinner(board)\` where \`board\` is a 9-character string listing the cells row by row, top-left to bottom-right, each 'X', 'O' or '.' (empty). X always moves first and players alternate.
A player "has a line" if they own all three cells of any row, column or diagonal.
Return 'invalid' if ANY of these hold: the length is not 9; a character is not 'X', 'O' or '.'; the number of X's is not equal to or exactly one more than the number of O's; both players have a line; X has a line but X's count is not O's count + 1; O has a line but the counts are not equal.
Otherwise return 'X' or 'O' if that player has a line (one player may have two lines at once), else 'draw' if there are no empty cells, else 'pending'.`,
    tests: [
      { args: ['XXXOO....'], expect: 'X', note: 'X wins top row' },
      { args: ['XX.OOOX..'], expect: 'O', note: 'O wins middle row' },
      { args: ['.........'], expect: 'pending', note: 'empty board' },
      { args: ['XOXXOOOXX'], expect: 'draw', note: 'full board, no line' },
      { args: ['XOX......'], expect: 'pending' },
      { args: ['XXX......'], expect: 'invalid', note: 'X has too many moves' },
      { args: ['OOOXX.XX.'], expect: 'invalid', note: 'O won but X moved after' },
      { args: ['XXXOOO...'], expect: 'invalid', note: 'both have a line' },
      { args: ['xxxoo....'], expect: 'invalid', note: 'lowercase is not allowed' },
      { args: ['XO'], expect: 'invalid', note: 'wrong length' },
      { args: ['X.O.X.O.X'], expect: 'X', note: 'diagonal' },
      { args: ['XXXOXOOOX'], expect: 'X', note: 'two lines at once on the last move' },
    ],
    reference: String.raw`function ticTacToeWinner(board) {
  if (typeof board !== 'string' || board.length !== 9 || !/^[XO.]{9}$/.test(board)) return 'invalid';
  const count = (ch) => board.split('').filter((c) => c === ch).length;
  const x = count('X');
  const o = count('O');
  if (x !== o && x !== o + 1) return 'invalid';
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const has = (p) => lines.some((l) => l.every((i) => board[i] === p));
  const xw = has('X');
  const ow = has('O');
  if (xw && ow) return 'invalid';
  if (xw && x !== o + 1) return 'invalid';
  if (ow && x !== o) return 'invalid';
  if (xw) return 'X';
  if (ow) return 'O';
  return board.includes('.') ? 'pending' : 'draw';
}`,
  },
  {
    id: 'merge-2048-row',
    title: '2048 row merge',
    level: 1,
    topic: 'games',
    entry: 'merge2048Row',
    prompt: `Write a JavaScript function \`merge2048Row(row)\` that performs a 2048 'move left' on one row. \`row\` is an array of numbers where 0 is an empty cell and other values are tiles.
Slide all tiles to the left, then, scanning from left to right, merge each pair of adjacent equal tiles into one tile of double value. A tile produced by a merge cannot merge again in the same move ([2,2,2,2] -> [4,4,0,0], not [8,0,0,0]; [2,2,2,0] -> [4,2,0,0]). Pad with 0 on the right so the row keeps its length.
Return { row, score } where row is the new array and score is the sum of the values of all tiles created by merges in this move (0 if none).`,
    tests: [
      { args: [[2, 2, 2, 2]], expect: { row: [4, 4, 0, 0], score: 8 }, note: 'each tile merges once' },
      { args: [[2, 2, 2, 0]], expect: { row: [4, 2, 0, 0], score: 4 }, note: 'leftmost pair first' },
      { args: [[0, 0, 0, 0]], expect: { row: [0, 0, 0, 0], score: 0 }, note: 'empty row' },
      { args: [[2, 0, 2, 4]], expect: { row: [4, 4, 0, 0], score: 4 }, note: 'merge across a gap, no chain' },
      { args: [[4, 4, 8, 8]], expect: { row: [8, 16, 0, 0], score: 24 } },
      { args: [[2, 4, 8, 16]], expect: { row: [2, 4, 8, 16], score: 0 }, note: 'nothing moves' },
      { args: [[0, 0, 0, 2]], expect: { row: [2, 0, 0, 0], score: 0 }, note: 'slide only' },
      { args: [[8, 8, 8]], expect: { row: [16, 8, 0], score: 16 }, note: 'any length' },
      { args: [[]], expect: { row: [], score: 0 }, note: 'zero-length row' },
    ],
    reference: String.raw`function merge2048Row(row) {
  const tiles = row.filter((x) => x !== 0);
  const out = [];
  let score = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      score += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < row.length) out.push(0);
  return { row: out, score };
}`,
  },
  {
    id: 'snake-step',
    title: 'Snake: one step',
    level: 2,
    topic: 'games',
    entry: 'snakeStep',
    prompt: `Write a JavaScript function \`snakeStep(width, height, snake, dir, food)\` that advances a game of Snake by one step.
- The board has columns x = 0..width-1 and rows y = 0..height-1. \`snake\` is a non-empty array of [x, y] cells, head first. \`dir\` is 'U' (y - 1), 'D' (y + 1), 'L' (x - 1) or 'R' (x + 1). \`food\` is an [x, y] cell or null.
- Compute the new head by moving the current head one cell in \`dir\`.
- If the new head is outside the board, return { status: 'wall', snake } with the snake unchanged.
- The snake eats if food is not null and the new head equals food. When eating, the tail stays (the snake grows by one); otherwise the last cell is removed. Call the cells that remain occupied (the whole snake when eating, otherwise the snake without its last cell) the body.
- If the new head is on a body cell, return { status: 'self', snake } with the snake unchanged. (Moving into the cell the tail is just leaving is therefore allowed when not eating.)
- Otherwise return { status: 'ate' or 'ok', snake: [newHead, ...body] }.
Do not mutate the inputs.`,
    tests: [
      { args: [5, 5, [[2, 2], [1, 2], [0, 2]], 'R', null], expect: { status: 'ok', snake: [[3, 2], [2, 2], [1, 2]] } },
      { args: [5, 5, [[2, 2], [1, 2]], 'R', [3, 2]], expect: { status: 'ate', snake: [[3, 2], [2, 2], [1, 2]] }, note: 'grows' },
      { args: [5, 5, [[4, 0], [3, 0]], 'R', null], expect: { status: 'wall', snake: [[4, 0], [3, 0]] }, note: 'right wall' },
      { args: [5, 5, [[0, 0]], 'U', null], expect: { status: 'wall', snake: [[0, 0]] }, note: 'top wall' },
      { args: [5, 5, [[2, 2], [1, 2]], 'L', null], expect: { status: 'ok', snake: [[1, 2], [2, 2]] }, note: 'length-2 snake may move into its vacating tail' },
      { args: [5, 5, [[2, 2], [1, 2], [0, 2]], 'L', null], expect: { status: 'self', snake: [[2, 2], [1, 2], [0, 2]] }, note: 'reversing into the neck' },
      { args: [5, 5, [[1, 1], [1, 2], [2, 2], [2, 1]], 'R', null], expect: { status: 'ok', snake: [[2, 1], [1, 1], [1, 2], [2, 2]] }, note: 'chasing the tail' },
      { args: [3, 3, [[1, 1]], 'D', [1, 2]], expect: { status: 'ate', snake: [[1, 2], [1, 1]] } },
      { args: [3, 3, [[1, 2], [1, 1]], 'D', null], expect: { status: 'wall', snake: [[1, 2], [1, 1]] }, note: 'bottom wall' },
      { args: [5, 5, [[2, 2], [2, 3]], 'U', [0, 0]], expect: { status: 'ok', snake: [[2, 1], [2, 2]] }, note: 'food elsewhere' },
    ],
    reference: String.raw`function snakeStep(width, height, snake, dir, food) {
  const d = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[dir];
  const head = [snake[0][0] + d[0], snake[0][1] + d[1]];
  const same = () => snake.map((c) => [c[0], c[1]]);
  if (head[0] < 0 || head[0] >= width || head[1] < 0 || head[1] >= height) return { status: 'wall', snake: same() };
  const eating = food !== null && food[0] === head[0] && food[1] === head[1];
  const body = (eating ? snake : snake.slice(0, -1)).map((c) => [c[0], c[1]]);
  if (body.some((c) => c[0] === head[0] && c[1] === head[1])) return { status: 'self', snake: same() };
  return { status: eating ? 'ate' : 'ok', snake: [head, ...body] };
}`,
  },
  {
    id: 'game-of-life',
    title: 'Game of Life: next generation',
    level: 2,
    topic: 'games',
    entry: 'gameOfLife',
    prompt: `Write a JavaScript function \`gameOfLife(grid)\` that computes the next generation of Conway's Game of Life.
\`grid\` is an array of equal-length strings; '#' is a live cell and '.' a dead cell. The grid does NOT wrap: cells outside it are permanently dead. Each cell has up to 8 neighbours (including diagonals).
Rules, applied to all cells simultaneously: a live cell with 2 or 3 live neighbours stays alive, otherwise it dies; a dead cell with exactly 3 live neighbours becomes alive.
Return the new grid in the same format and size (an empty array returns []).`,
    tests: [
      { args: [['.....', '..#..', '..#..', '..#..', '.....']], expect: ['.....', '.....', '.###.', '.....', '.....'], note: 'blinker' },
      { args: [['....', '.##.', '.##.', '....']], expect: ['....', '.##.', '.##.', '....'], note: 'block is stable' },
      { args: [[]], expect: [], note: 'empty grid' },
      { args: [['#']], expect: ['.'], note: 'lonely cell dies' },
      { args: [['###']], expect: ['.#.'], note: 'no wrap-around' },
      { args: [['.#...', '..#..', '###..', '.....', '.....']], expect: ['.....', '#.#..', '.##..', '.#...', '.....'], note: 'glider' },
      { args: [['##', '##']], expect: ['##', '##'], note: 'block touching the edges' },
      { args: [['#.#', '...', '#.#']], expect: ['...', '...', '...'], note: '4 neighbours: no birth' },
      { args: [['.#.', '###', '.#.']], expect: ['###', '#.#', '###'], note: 'overcrowding and births' },
    ],
    reference: String.raw`function gameOfLife(grid) {
  const h = grid.length;
  return grid.map((row, r) => {
    let out = '';
    for (let c = 0; c < row.length; c++) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < h && cc >= 0 && cc < grid[rr].length && grid[rr][cc] === '#') n++;
        }
      }
      out += (row[c] === '#' ? n === 2 || n === 3 : n === 3) ? '#' : '.';
    }
    return out;
  });
}`,
  },

  // ---------------------------------------------------------------- utilities
  {
    id: 'debounce-simulation',
    title: 'Debounce simulation',
    level: 2,
    topic: 'utilities',
    entry: 'debounceTimes',
    prompt: `Write a JavaScript function \`debounceTimes(timestamps, wait)\` that simulates a trailing-edge debounce and returns the times at which the debounced function fires.
\`timestamps\` is an array of event times in milliseconds, sorted ascending (equal times possible); \`wait\` is a non-negative number.
Each event (re)starts a timer that fires at eventTime + wait. If the next event arrives STRICTLY before the pending timer's fire time, the timer is cancelled and restarted from that new event. Otherwise (next event at or after the fire time, or no more events) the timer fires at its fire time and the next event starts a new timer.
Return the array of fire times in ascending order ([] if there are no events).
Example: debounceTimes([0, 40, 80, 300], 50) returns [130, 350].`,
    tests: [
      { args: [[0, 100, 200], 150], expect: [350], note: 'one burst' },
      { args: [[0, 200], 150], expect: [150, 350], note: 'two separate events' },
      { args: [[], 100], expect: [], note: 'no events' },
      { args: [[0, 100], 100], expect: [100, 200], note: 'event exactly at fire time does not cancel' },
      { args: [[10], 0], expect: [10], note: 'zero wait' },
      { args: [[0, 0, 0], 50], expect: [50], note: 'simultaneous events' },
      { args: [[0, 40, 80, 300, 310, 1000], 50], expect: [130, 360, 1050] },
      { args: [[1, 2, 3], 1], expect: [2, 3, 4] },
    ],
    reference: String.raw`function debounceTimes(timestamps, wait) {
  const out = [];
  let fire = null;
  for (const t of timestamps) {
    if (fire !== null && t >= fire) out.push(fire);
    fire = t + wait;
  }
  if (fire !== null) out.push(fire);
  return out;
}`,
  },
  {
    id: 'token-bucket',
    title: 'Token-bucket rate limiter',
    level: 2,
    topic: 'utilities',
    entry: 'tokenBucket',
    prompt: `Write a JavaScript function \`tokenBucket(capacity, ratePerSec, times)\` that simulates a token-bucket rate limiter and returns, for each request, whether it was allowed.
- \`capacity\` (>= 0) is the maximum number of tokens; \`ratePerSec\` (>= 0) is how many tokens are added per second, continuously (fractional tokens accumulate); \`times\` is an array of request times in milliseconds, sorted ascending (equal times possible).
- The bucket is full (capacity tokens) at the time of the first request.
- For each request at time t: first refill with tokens = Math.min(capacity, tokens + (t - lastTime) * ratePerSec / 1000), then set lastTime = t (for the first request lastTime is its own time). If tokens >= 1, the request is allowed and tokens decreases by 1; otherwise it is denied and nothing is consumed.
Return an array of booleans (true = allowed), one per request ([] for no requests).`,
    tests: [
      { args: [2, 1, [0, 0, 0, 1000, 1000]], expect: [true, true, false, true, false], note: 'burst then refill' },
      { args: [1, 2, [0, 100, 500, 600, 1100]], expect: [true, false, true, false, true], note: 'fractional refill' },
      { args: [3, 0, [0, 1, 2, 3]], expect: [true, true, true, false], note: 'no refill' },
      { args: [5, 10, []], expect: [], note: 'no requests' },
      { args: [0, 100, [0, 1000]], expect: [false, false], note: 'zero capacity' },
      { args: [1, 1, [0, 500, 1000]], expect: [true, false, true], note: 'denied request consumes nothing' },
      { args: [2, 1, [0, 0, 5000, 5000, 5000]], expect: [true, true, true, true, false], note: 'refill is capped at capacity' },
      { args: [1, 4, [0, 250, 250, 500]], expect: [true, true, false, true] },
    ],
    reference: String.raw`function tokenBucket(capacity, ratePerSec, times) {
  const out = [];
  let tokens = capacity;
  let last = times.length ? times[0] : 0;
  for (const t of times) {
    tokens = Math.min(capacity, tokens + ((t - last) * ratePerSec) / 1000);
    last = t;
    if (tokens >= 1) { tokens -= 1; out.push(true); } else out.push(false);
  }
  return out;
}`,
  },
  {
    id: 'deep-equal',
    title: 'Deep equality of JSON values',
    level: 1,
    topic: 'utilities',
    entry: 'deepEqual',
    prompt: `Write a JavaScript function \`deepEqual(a, b)\` that compares two JSON values (null, booleans, numbers, strings, arrays and plain objects, nested arbitrarily) and returns true or false.
- Primitives are equal only if a === b (so 1 and '1' differ, 0 and false differ).
- null equals only null.
- Arrays are equal if they have the same length and equal elements in the same order.
- Plain objects are equal if they have exactly the same set of keys (order irrelevant) and equal values for each key.
- An array never equals a plain object (even [] vs {}).`,
    tests: [
      { args: [{ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }], expect: true, note: 'key order irrelevant' },
      { args: [[1, 2, 3], [1, 2]], expect: false, note: 'length differs' },
      { args: [[], {}], expect: false, note: 'array vs object' },
      { args: [null, null], expect: true },
      { args: [null, {}], expect: false, note: 'null vs object' },
      { args: [1, '1'], expect: false, note: 'no coercion' },
      { args: [{ a: { b: { c: [1, { d: 'x' }] } } }, { a: { b: { c: [1, { d: 'x' }] } } }], expect: true, note: 'deep nesting' },
      { args: [{ a: 1 }, { a: 1, b: 2 }], expect: false, note: 'extra key' },
      { args: [[1, [2, [3]]], [1, [2, [4]]]], expect: false, note: 'deep difference' },
      { args: ['', ''], expect: true },
      { args: [0, false], expect: false },
    ],
    reference: String.raw`function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}`,
  },
];
