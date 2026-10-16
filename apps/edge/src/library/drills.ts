/**
 * Drills: questions Ghosty sets itself, with answers it can check without any AI. Each skill
 * is a generator: from a seed it makes a fresh question (so the bank is endless, and the same
 * seed gives the same question), the model answers in plain words, and grade() decides.
 * Numbers allow a little rounding; words are compared loosely; multiple-choice wants the letter.
 * Results go to the study log and the per-skill scores in the study state (study.ts), so the
 * owner can see where Ghosty is reliable and where it still slips.
 */

export type DrillKind = 'number' | 'text' | 'choice';
export interface Drill {
  skill: string;
  /** The domain it belongs to (a curriculum domain id, or 'maths' / 'computing' / 'general'). */
  domain: string;
  q: string;
  answer: string;
  kind: DrillKind;
  /** For numbers: accept answers within this fraction of the right one (default 1%). */
  tolerance?: number;
}

/** A small, fast seeded random source (mulberry32): the same seed gives the same questions. */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
const choice = (r: () => number, right: string, wrong: string[]): { q: string; answer: string } => {
  const opts = [right, ...wrong.slice(0, 3)];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [opts[i], opts[j]] = [opts[j]!, opts[i]!];
  }
  const letters = ['A', 'B', 'C', 'D'];
  return { q: opts.map((o, i) => `${letters[i]}) ${o}`).join('  '), answer: letters[opts.indexOf(right)]! };
};

const BIG_O: [string, string][] = [
  ['binary search on a sorted array', 'O(log n)'], ['linear search', 'O(n)'], ['merge sort', 'O(n log n)'], ['quicksort (average)', 'O(n log n)'], ['quicksort (worst case)', 'O(n²)'],
  ['bubble sort', 'O(n²)'], ['insertion sort (worst case)', 'O(n²)'], ['heap sort', 'O(n log n)'], ['counting sort (n items, k values)', 'O(n + k)'], ['hash table lookup (average)', 'O(1)'],
  ['inserting at the front of an array', 'O(n)'], ['pushing onto a stack', 'O(1)'], ['finding the minimum in an unsorted array', 'O(n)'], ['Dijkstra with a binary heap (V vertices, E edges)', 'O((V + E) log V)'], ['breadth-first search', 'O(V + E)'],
  ['building a heap from n items', 'O(n)'], ['checking all pairs in an array', 'O(n²)'], ['the naive Fibonacci recursion', 'O(2ⁿ)'], ['matrix multiplication of two n×n matrices (schoolbook)', 'O(n³)'], ['balanced binary search tree lookup', 'O(log n)'],
];
const CAPITALS: [string, string][] = [
  ['France', 'Paris'], ['Germany', 'Berlin'], ['Spain', 'Madrid'], ['Italy', 'Rome'], ['Portugal', 'Lisbon'], ['Netherlands', 'Amsterdam'], ['Belgium', 'Brussels'], ['Austria', 'Vienna'], ['Switzerland', 'Bern'], ['Poland', 'Warsaw'],
  ['Czech Republic', 'Prague'], ['Hungary', 'Budapest'], ['Greece', 'Athens'], ['Turkey', 'Ankara'], ['Egypt', 'Cairo'], ['Kenya', 'Nairobi'], ['Nigeria', 'Abuja'], ['South Africa', 'Pretoria'], ['Morocco', 'Rabat'], ['Ethiopia', 'Addis Ababa'],
  ['India', 'New Delhi'], ['Pakistan', 'Islamabad'], ['Bangladesh', 'Dhaka'], ['China', 'Beijing'], ['Japan', 'Tokyo'], ['South Korea', 'Seoul'], ['Vietnam', 'Hanoi'], ['Thailand', 'Bangkok'], ['Indonesia', 'Jakarta'], ['Australia', 'Canberra'],
  ['New Zealand', 'Wellington'], ['Canada', 'Ottawa'], ['United States', 'Washington, D.C.'], ['Mexico', 'Mexico City'], ['Brazil', 'Brasília'], ['Argentina', 'Buenos Aires'], ['Chile', 'Santiago'], ['Peru', 'Lima'], ['Colombia', 'Bogotá'], ['Saudi Arabia', 'Riyadh'],
  ['Iran', 'Tehran'], ['Iraq', 'Baghdad'], ['Israel', 'Jerusalem'], ['Norway', 'Oslo'], ['Sweden', 'Stockholm'], ['Denmark', 'Copenhagen'], ['Finland', 'Helsinki'], ['Ireland', 'Dublin'], ['Scotland', 'Edinburgh'], ['Wales', 'Cardiff'],
];
const ELEMENTS: [string, string, number][] = [['H', 'hydrogen', 1.008], ['C', 'carbon', 12.011], ['N', 'nitrogen', 14.007], ['O', 'oxygen', 15.999], ['Na', 'sodium', 22.99], ['Mg', 'magnesium', 24.305], ['S', 'sulfur', 32.06], ['Cl', 'chlorine', 35.45], ['K', 'potassium', 39.098], ['Ca', 'calcium', 40.078], ['Fe', 'iron', 55.845], ['Cu', 'copper', 63.546]];
const MOLECULES: [string, string][] = [['water', 'H2O'], ['carbon dioxide', 'CO2'], ['methane', 'CH4'], ['ammonia', 'NH3'], ['table salt', 'NaCl'], ['glucose', 'C6H12O6'], ['sulfuric acid', 'H2SO4'], ['ethanol', 'C2H6O'], ['calcium carbonate', 'CaCO3'], ['potassium chloride', 'KCl']];
const molar = (formula: string) => [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)].reduce((m, x) => m + (ELEMENTS.find((e) => e[0] === x[1])?.[2] ?? 0) * (x[2] ? Number(x[2]) : 1), 0);
const ZONES: [string, number][] = [['London (GMT, winter)', 0], ['Paris (CET, winter)', 1], ['Athens (EET, winter)', 2], ['Moscow', 3], ['Dubai', 4], ['Karachi', 5], ['Dhaka', 6], ['Bangkok', 7], ['Beijing', 8], ['Tokyo', 9], ['Sydney (AEST)', 10], ['Auckland (NZST)', 12], ['New York (EST)', -5], ['Chicago (CST)', -6], ['Denver (MST)', -7], ['Los Angeles (PST)', -8]];
const SI: [string, number][] = [['kilo', 3], ['mega', 6], ['giga', 9], ['tera', 12], ['milli', -3], ['micro', -6], ['nano', -9], ['pico', -12], ['centi', -2]];
const WORDS = ['algorithm', 'library', 'network', 'quantum', 'economy', 'syntax', 'protocol', 'theorem', 'gradient', 'binary', 'entropy', 'kernel', 'matrix', 'vector', 'ghosty', 'birmingham', 'compiler', 'database', 'latency', 'voltage'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Gen = (r: () => number) => Omit<Drill, 'skill' | 'domain'>;
const num = (q: string, answer: number, tolerance?: number): Omit<Drill, 'skill' | 'domain'> => ({ q, answer: fmt(answer), kind: 'number', ...(tolerance !== undefined ? { tolerance } : {}) });
const text = (q: string, answer: string): Omit<Drill, 'skill' | 'domain'> => ({ q, answer, kind: 'text' });
const mc = (r: () => number, q: string, right: string, wrong: string[]): Omit<Drill, 'skill' | 'domain'> => {
  const c = choice(r, right, wrong);
  return { q: `${q}\n${c.q}\nAnswer with the letter.`, answer: c.answer, kind: 'choice' };
};

/** Every skill: [id, domain, generator]. */
export const SKILLS: [string, string, Gen][] = [
  ['arithmetic', 'maths', (r) => {
    const a = int(r, 120, 999), b = int(r, 12, 99);
    const op = pick(r, ['+', '-', '×'] as const);
    return num(`Compute ${a} ${op} ${b}.`, op === '+' ? a + b : op === '-' ? a - b : a * b);
  }],
  ['percentages', 'maths', (r) => {
    const p = pick(r, [5, 10, 12.5, 15, 20, 25, 30, 40, 60, 75]), n = int(r, 40, 2400);
    return num(`What is ${p}% of ${n}?`, (p / 100) * n, 0.02);
  }],
  ['fractions', 'maths', (r) => {
    const a = int(r, 1, 9), b = int(r, 2, 12), c = int(r, 1, 9), d = int(r, 2, 12);
    const n = a * d + c * b, m = b * d, g = gcd(n, m);
    return text(`Add the fractions ${a}/${b} + ${c}/${d}. Give the answer as a fraction in lowest terms (like 7/12), or a whole number.`, m / g === 1 ? String(n / g) : `${n / g}/${m / g}`);
  }],
  ['linear-equations', 'maths', (r) => {
    const a = int(r, 2, 12), x = int(r, -9, 15), b = int(r, -20, 20);
    return num(`Solve for x: ${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${a * x + b}.`, x, 0);
  }],
  ['quadratics', 'maths', (r) => {
    const p = int(r, -6, 6), q = int(r, -6, 6);
    const b = -(p + q), c = p * q;
    const lo = Math.min(p, q);
    return num(`The equation x² ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)} = 0 has two integer roots (they may be equal). What is the smaller root?`, lo, 0);
  }],
  ['number-theory', 'maths', (r) => {
    const a = int(r, 12, 300), b = int(r, 12, 300);
    const which = pick(r, ['gcd', 'lcm'] as const);
    return num(`What is the ${which === 'gcd' ? 'greatest common divisor' : 'least common multiple'} of ${a} and ${b}?`, which === 'gcd' ? gcd(a, b) : (a * b) / gcd(a, b), 0);
  }],
  ['prime-factors', 'maths', (r) => {
    const primes = [2, 3, 5, 7, 11, 13];
    const n = pick(r, primes) * pick(r, primes) * pick(r, primes);
    const fs: number[] = [];
    let m = n;
    for (const p of primes) while (m % p === 0) { fs.push(p); m /= p; }
    return text(`Write ${n} as a product of prime factors (like 2 × 2 × 7).`, fs.join(' × '));
  }],
  ['modular', 'maths', (r) => {
    const a = int(r, 50, 999), m = int(r, 3, 17);
    return num(`What is ${a} mod ${m} (the remainder when ${a} is divided by ${m})?`, a % m, 0);
  }],
  ['statistics', 'maths', (r) => {
    const xs = Array.from({ length: int(r, 5, 7) }, () => int(r, 1, 40));
    const which = pick(r, ['mean', 'median', 'range'] as const);
    const s = [...xs].sort((a, b) => a - b);
    const v = which === 'mean' ? xs.reduce((n, x) => n + x, 0) / xs.length : which === 'median' ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : s[s.length - 1]! - s[0]!;
    return num(`What is the ${which} of these numbers: ${xs.join(', ')}?`, v, 0.01);
  }],
  ['probability', 'maths', (r) => {
    const kind = pick(r, ['dice', 'coins', 'cards'] as const);
    if (kind === 'dice') {
      const s = int(r, 2, 12);
      const ways = [1, 2, 3, 4, 5, 6].reduce((n, a) => n + [1, 2, 3, 4, 5, 6].filter((b) => a + b === s).length, 0);
      return num(`Two fair six-sided dice are rolled. What is the probability that the total is ${s}? Give a decimal to 3 places.`, ways / 36, 0.03);
    }
    if (kind === 'coins') {
      const n = int(r, 3, 6), k = int(r, 0, n);
      const C = (n: number, k: number) => { let v = 1; for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i; return v; };
      return num(`A fair coin is tossed ${n} times. What is the probability of exactly ${k} heads? Give a decimal to 3 places.`, C(n, k) / 2 ** n, 0.03);
    }
    return num('A card is drawn from a standard 52-card deck. What is the probability it is a face card (jack, queen or king)? Give a decimal to 3 places.', 12 / 52, 0.03);
  }],
  ['combinatorics', 'maths', (r) => {
    const n = int(r, 5, 10), k = int(r, 2, 4);
    const which = pick(r, ['choose', 'arrange'] as const);
    let v = 1;
    if (which === 'choose') for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i;
    else for (let i = 0; i < k; i++) v *= n - i;
    return num(which === 'choose' ? `How many ways are there to choose ${k} items from ${n} (order does not matter)?` : `How many ways are there to arrange ${k} items chosen from ${n} in order?`, v, 0);
  }],
  ['compound-interest', 'finance-investing-uk', (r) => {
    const P = int(r, 5, 60) * 100, rate = pick(r, [2, 3, 4, 5, 6, 7]), years = int(r, 2, 10);
    return num(`£${P} is invested at ${rate}% a year, compounded yearly. What is it worth after ${years} years, to the nearest pound?`, P * (1 + rate / 100) ** years, 0.01);
  }],
  ['loan-payment', 'finance-investing-uk', (r) => {
    const P = int(r, 50, 300) * 1000, rate = pick(r, [3, 4, 4.5, 5, 6]), years = pick(r, [10, 15, 20, 25]);
    const i = rate / 100 / 12, n = years * 12;
    return num(`A £${P} repayment mortgage at ${rate}% a year over ${years} years: what is the monthly payment, to the nearest pound?`, (P * i) / (1 - (1 + i) ** -n), 0.02);
  }],
  ['unit-conversion', 'physics-classical-modern', (r) => {
    const kind = pick(r, ['km', 'c', 'kg', 'mph'] as const);
    if (kind === 'km') { const v = int(r, 5, 400); return num(`Convert ${v} km to miles (1 mile = 1.609344 km).`, v / 1.609344, 0.02); }
    if (kind === 'c') { const c = int(r, -20, 45); return num(`Convert ${c}°C to °F.`, (c * 9) / 5 + 32, 0.02); }
    if (kind === 'kg') { const k = int(r, 2, 120); return num(`Convert ${k} kg to pounds (1 kg = 2.20462 lb).`, k * 2.20462, 0.02); }
    const m = int(r, 20, 120);
    return num(`A car does ${m} mph. How many metres per second is that (1 mile = 1609.344 m)?`, (m * 1609.344) / 3600, 0.02);
  }],
  ['speed-distance-time', 'physics-classical-modern', (r) => {
    const v = int(r, 30, 120), t = int(r, 1, 9) * 0.5;
    return num(`A train travels at ${v} km/h for ${t} hours. How far does it go, in km?`, v * t, 0.01);
  }],
  ['kinematics', 'physics-classical-modern', (r) => {
    const u = int(r, 0, 20), a = int(r, 1, 9), t = int(r, 2, 12);
    const which = pick(r, ['v', 's'] as const);
    return which === 'v' ? num(`An object starts at ${u} m/s and accelerates at ${a} m/s² for ${t} s. What is its final speed in m/s?`, u + a * t, 0.01) : num(`An object starts at ${u} m/s and accelerates at ${a} m/s² for ${t} s. How far does it travel in metres (s = ut + ½at²)?`, u * t + 0.5 * a * t * t, 0.01);
  }],
  ['geometry', 'maths', (r) => {
    const kind = pick(r, ['circle', 'triangle', 'rect'] as const);
    if (kind === 'circle') { const rad = int(r, 2, 30); return num(`What is the area of a circle of radius ${rad}? Give the answer to 1 decimal place.`, Math.PI * rad * rad, 0.01); }
    if (kind === 'triangle') { const [a, b] = pick(r, [[3, 4], [5, 12], [6, 8], [8, 15], [7, 24], [9, 12], [20, 21]] as const); return num(`A right-angled triangle has legs ${a} and ${b}. How long is the hypotenuse?`, Math.hypot(a, b), 0.01); }
    const w = int(r, 3, 40), h = int(r, 3, 40);
    return num(`A rectangle is ${w} by ${h}. What is its perimeter?`, 2 * (w + h), 0);
  }],
  ['sequences', 'maths', (r) => {
    const kind = pick(r, ['arith', 'geo', 'square'] as const);
    if (kind === 'arith') { const a = int(r, -10, 20), d = int(r, 2, 9); return num(`What is the next number: ${[0, 1, 2, 3, 4].map((i) => a + i * d).join(', ')}, …?`, a + 5 * d, 0); }
    if (kind === 'geo') { const a = int(r, 1, 5), q = int(r, 2, 4); return num(`What is the next number: ${[0, 1, 2, 3].map((i) => a * q ** i).join(', ')}, …?`, a * q ** 4, 0); }
    const s = int(r, 2, 8);
    return num(`What is the next number: ${[0, 1, 2, 3, 4].map((i) => (s + i) ** 2).join(', ')}, …?`, (s + 5) ** 2, 0);
  }],
  ['calculus', 'calculus-analysis', (r) => {
    const a = int(r, 2, 9), n = int(r, 2, 5), x = int(r, 1, 4);
    const which = pick(r, ['d', 'i'] as const);
    if (which === 'd') return num(`If f(x) = ${a}x^${n}, what is f′(${x})?`, a * n * x ** (n - 1), 0.01);
    return num(`What is the integral of ${a}x^${n} from 0 to ${x}? Give a decimal.`, (a * x ** (n + 1)) / (n + 1), 0.01);
  }],
  ['linear-algebra', 'linear-algebra', (r) => {
    const kind = pick(r, ['dot', 'det', 'mul'] as const);
    const a = int(r, -5, 7), b = int(r, -5, 7), c = int(r, -5, 7), d = int(r, -5, 7);
    if (kind === 'dot') return num(`What is the dot product of (${a}, ${b}, ${c}) and (${d}, ${a}, ${b})?`, a * d + b * a + c * b, 0);
    if (kind === 'det') return num(`What is the determinant of the 2×2 matrix [[${a}, ${b}], [${c}, ${d}]]?`, a * d - b * c, 0);
    return text(`Multiply the matrices [[${a}, ${b}], [${c}, ${d}]] × [[1, 0], [2, 1]]. Give the result as [[p, q], [r, s]].`, `[[${a + 2 * b}, ${b}], [${c + 2 * d}, ${d}]]`);
  }],
  ['number-bases', 'computing', (r) => {
    const n = int(r, 17, 255);
    const kind = pick(r, ['bin', 'hex', 'frombin'] as const);
    if (kind === 'bin') return text(`Write ${n} in binary.`, n.toString(2));
    if (kind === 'hex') return text(`Write ${n} in hexadecimal (like 0xA3 or A3).`, n.toString(16).toUpperCase());
    return num(`What is the binary number ${n.toString(2)} in decimal?`, n, 0);
  }],
  ['bitwise', 'computing', (r) => {
    const a = int(r, 1, 63), b = int(r, 1, 63);
    const op = pick(r, ['AND', 'OR', 'XOR', 'LEFT'] as const);
    if (op === 'LEFT') { const s = int(r, 1, 4); return num(`What is ${a} << ${s} (shift left by ${s} bits)?`, a << s, 0); }
    return num(`What is ${a} ${op} ${b} (bitwise, on the integers)?`, op === 'AND' ? a & b : op === 'OR' ? a | b : a ^ b, 0);
  }],
  ['big-o', 'algorithms-data-structures', (r) => {
    const [what, right] = pick(r, BIG_O);
    const wrong = BIG_O.map((x) => x[1]).filter((x, i, arr) => x !== right && arr.indexOf(x) === i);
    for (let i = wrong.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [wrong[i], wrong[j]] = [wrong[j]!, wrong[i]!]; }
    return mc(r, `What is the time complexity of ${what}?`, right, wrong);
  }],
  ['data-structures', 'algorithms-data-structures', (r) => {
    const ops: string[] = [];
    const stack: number[] = [];
    const queue: number[] = [];
    const which = pick(r, ['stack', 'queue'] as const);
    for (let i = 0; i < 6; i++) {
      if (r() < 0.6 || (which === 'stack' ? !stack.length : !queue.length)) { const v = int(r, 1, 9); ops.push(`push ${v}`); (which === 'stack' ? stack : queue).push(v); }
      else { ops.push('pop'); if (which === 'stack') stack.pop(); else queue.shift(); }
    }
    const left = which === 'stack' ? stack : queue;
    return text(`A ${which} starts empty. Apply in order: ${ops.join(', ')} (pop removes from the ${which === 'stack' ? 'top' : 'front'}). What is left, listed from ${which === 'stack' ? 'bottom to top' : 'front to back'}? Answer like "1 2 3", or "empty".`, left.length ? left.join(' ') : 'empty');
  }],
  ['sorting', 'algorithms-data-structures', (r) => {
    const xs = Array.from({ length: 6 }, () => int(r, 1, 50));
    const kind = pick(r, ['sort', 'kth'] as const);
    const s = [...xs].sort((a, b) => a - b);
    if (kind === 'sort') return text(`Sort these numbers ascending: ${xs.join(', ')}. Answer with the numbers separated by spaces.`, s.join(' '));
    const k = int(r, 1, 6);
    return num(`What is the ${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'} smallest of: ${xs.join(', ')}?`, s[k - 1]!, 0);
  }],
  ['strings', 'computing', (r) => {
    const w = pick(r, WORDS);
    const kind = pick(r, ['reverse', 'caesar', 'count'] as const);
    if (kind === 'reverse') return text(`Reverse the word "${w}".`, [...w].reverse().join(''));
    if (kind === 'caesar') { const k = int(r, 1, 12); return text(`Shift every letter of "${w}" forward by ${k} places in the alphabet (wrapping around). What word results?`, [...w].map((c) => String.fromCharCode(((c.charCodeAt(0) - 97 + k) % 26) + 97)).join('')); }
    const vowels = [...w].filter((c) => 'aeiou'.includes(c)).length;
    return num(`How many vowels are in the word "${w}"?`, vowels, 0);
  }],
  ['dates', 'general', (r) => {
    const kind = pick(r, ['between', 'weekday'] as const);
    const y = int(r, 2001, 2030), m = int(r, 0, 11), d = int(r, 1, 28);
    if (kind === 'between') {
      const days = int(r, 10, 400);
      const a = Date.UTC(y, m, d), b = a + days * 86_400_000;
      const bd = new Date(b);
      return num(`How many days are there from ${d} ${MONTHS[m]} ${y} to ${bd.getUTCDate()} ${MONTHS[bd.getUTCMonth()]} ${bd.getUTCFullYear()}?`, days, 0);
    }
    return text(`What day of the week was ${d} ${MONTHS[m]} ${y}?`, DAYS[new Date(Date.UTC(y, m, d)).getUTCDay()]!);
  }],
  ['time-zones', 'geography-transport-uk', (r) => {
    const [a, za] = pick(r, ZONES);
    let [b, zb] = pick(r, ZONES);
    if (b === a) [b, zb] = ZONES[(ZONES.findIndex((z) => z[0] === a) + 3) % ZONES.length]!;
    const h = int(r, 0, 23);
    return text(`When it is ${String(h).padStart(2, '0')}:00 in ${a}, what time is it in ${b} (same day or not, just the time, 24-hour)?`, `${String((((h + zb - za) % 24) + 24) % 24).padStart(2, '0')}:00`);
  }],
  ['si-prefixes', 'physics-classical-modern', (r) => {
    const [p, e] = pick(r, SI);
    return num(`A ${p}metre is 10 to what power of a metre? Give the exponent.`, e, 0);
  }],
  ['capitals', 'geography-transport-uk', (r) => {
    const [country, right] = pick(r, CAPITALS);
    const wrong = CAPITALS.filter((c) => c[1] !== right).map((c) => c[1]);
    for (let i = wrong.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [wrong[i], wrong[j]] = [wrong[j]!, wrong[i]!]; }
    return mc(r, `What is the capital of ${country}?`, right, wrong);
  }],
  ['molar-mass', 'chemistry', (r) => {
    const [name, formula] = pick(r, MOLECULES);
    return num(`What is the molar mass of ${name} (${formula}) in g/mol, using H 1.008, C 12.011, N 14.007, O 15.999, Na 22.99, S 32.06, Cl 35.45, K 39.098, Ca 40.078? One decimal place.`, molar(formula), 0.01);
  }],
  ['logic', 'discrete-logic', (r) => {
    const a = r() < 0.5, b = r() < 0.5;
    const op = pick(r, ['AND', 'OR', 'XOR', 'IMPLIES'] as const);
    const v = op === 'AND' ? a && b : op === 'OR' ? a || b : op === 'XOR' ? a !== b : !a || b;
    return text(`If P is ${a} and Q is ${b}, what is the value of P ${op} Q? Answer true or false.`, String(v));
  }],
  ['sets', 'discrete-logic', (r) => {
    const A = [...new Set(Array.from({ length: 5 }, () => int(r, 1, 12)))].sort((x, y) => x - y);
    const B = [...new Set(Array.from({ length: 5 }, () => int(r, 1, 12)))].sort((x, y) => x - y);
    const op = pick(r, ['union', 'intersection', 'difference'] as const);
    const out = op === 'union' ? [...new Set([...A, ...B])] : op === 'intersection' ? A.filter((x) => B.includes(x)) : A.filter((x) => !B.includes(x));
    out.sort((x, y) => x - y);
    return text(`A = {${A.join(', ')}} and B = {${B.join(', ')}}. What is the ${op === 'difference' ? 'set difference A \\ B' : op === 'union' ? 'union A ∪ B' : 'intersection A ∩ B'}? List the elements in ascending order separated by spaces, or say "empty".`, out.length ? out.join(' ') : 'empty');
  }],
];

/** A drill from a skill (by index) and a seed. */
export function makeDrill(skillIndex: number, seed: number): Drill {
  const [skill, domain, gen] = SKILLS[((skillIndex % SKILLS.length) + SKILLS.length) % SKILLS.length]!;
  return { skill, domain, ...gen(rng(seed * 7919 + skillIndex * 104729 + 17)) };
}

const norm = (s: string) => s.toLowerCase().replace(/[×x*]/g, '×').replace(/\s+/g, ' ').replace(/[“”"'`.,;:!?()[\]{}]/g, '').trim();
/** The numbers in a reply, last first (a reply usually ends with the answer). */
const numbers = (s: string): number[] => [...s.replace(/,(?=\d{3}\b)/g, '').matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).reverse();

/** Did the reply give the right answer? */
export function grade(d: Drill, replyRaw: string): boolean {
  const reply = replyRaw.trim();
  if (!reply) return false;
  if (d.kind === 'choice') {
    const m = reply.match(/\b([A-D])\b(?![^\n]*[A-D]\))/i) ?? reply.match(/^\s*([A-D])\b/i) ?? reply.match(/answer[^A-Za-z]*([A-D])\b/i);
    return !!m && m[1]!.toUpperCase() === d.answer;
  }
  if (d.kind === 'number') {
    const want = Number(d.answer);
    const tol = Math.max(Math.abs(want) * (d.tolerance ?? 0.01), d.tolerance === 0 ? 0 : 0.011);
    // Prefer a number after "answer"/"=" at the end; else the last number in the reply.
    const tail = reply.match(/(?:answer|=|is|≈|about)\s*:?\s*(?:£|\$)?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(?:[a-z%°²³/]+)?\s*\.?\s*$/i);
    const cands = tail ? [Number(tail[1]!.replace(/,/g, '')), ...numbers(reply)] : numbers(reply);
    return cands.slice(0, 3).some((n) => Number.isFinite(n) && Math.abs(n - want) <= tol);
  }
  const want = norm(d.answer);
  const got = norm(reply);
  if (got === want) return true;
  // The answer may sit in a sentence: the exact phrase, bounded by spaces or line ends.
  const padded = ` ${got} `;
  if (padded.includes(` ${want} `)) return true;
  // Lists compared as sets of tokens when the answer is a list (sorting, sets, stacks).
  if (/^[\d ]+$/.test(want)) {
    const tokens = got.replace(/[^\d ]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
    return tokens === want || tokens.endsWith(` ${want}`) || tokens.startsWith(`${want} `) && want.split(' ').length >= 3;
  }
  return false;
}
