/**
 * THE LENS THAT KNOWS ITS JOB (FINAL-LENS), the pure part: he points the phone and the Lens decides which job to do from what the
 * one view has understood of the frame, and finds in a read text the things he can act on. No camera, no DOM, no model, nothing
 * sent: features/lens/cards.ts draws the cards decided here, and the brain bundle tests it in Node (apps/edge/test/lens-one.test.mjs,
 * through vision/frame.ts).
 *
 *   jobOf()        the one job for what is in view: read, a letter, a document, a code, a product, a thing, a living thing, a place
 *                  or artwork, a face he knows, a stranger, or nothing yet
 *   textActs()     in a read text: dates (to the Agenda), phone numbers (to call), addresses (to the map), links, emails, sums
 *   solve()        a sum or a simple equation, worked line by line ("12 + 7 × 3" → 7 × 3 = 21, 12 + 21 = 33)
 *   sureWords()    how sure, as he says it ("82% sure")
 *   ean()          a shop barcode's digits, or null
 */
import { datesIn } from '../../../../packages/shared/src/lifeeasier';

// ---------------------------------------------------------------- the job

export type JobId = 'nothing' | 'text' | 'letter' | 'document' | 'code' | 'product' | 'thing' | 'living' | 'place' | 'known' | 'stranger';

/** What the one view has understood of the frame, as plain facts. */
export interface Seen {
  /** The words read (empty when none yet). */
  text?: string;
  /** The text's box covers this share of the picture (0–1). */
  textShare?: number;
  /** A code read: its text and the reader's format ("ean_13", "qr_code"). */
  code?: { text: string; format?: string };
  /** The thing the finder or namer sees, and how sure (0–1). */
  thing?: { label: string; score: number };
  /** A face he introduced is in view (never who, here). */
  known?: boolean;
  /** A face he did not introduce. */
  stranger?: boolean;
  /** The read words look like a letter or a bill (packages/shared/src/lifeeasier.ts letterOf). */
  letter?: boolean;
}

/** What a living thing is called by the phone's finder and namer: the species then comes from the free model that sees, on his tap. */
const LIVING = /\b(bird|cat|dog|horse|sheep|cow|elephant|bear|zebra|giraffe|potted plant|plant|flower|tree|leaf|leaves|mushroom|fungus|insect|butterfly|bee|spider|fish|squirrel|fox|deer|rabbit|duck|swan|pigeon|robin|owl|frog|snail|daisy|rose|tulip|sunflower|fern|cactus|moss|animal)s?\b/i;
/** What a place or a work of art is called by the namer: it is then named by the free model that sees, with its encyclopedia summary. */
const PLACE = /\b(tower|church|cathedral|abbey|mosque|temple|castle|palace|bridge|monument|statue|sculpture|fountain|lighthouse|skyscraper|building|landmark|ruins?|painting|portrait|artwork|mural|museum|stadium|arch)\b/i;

/** The finder's classes named after an animal that are not alive: a toy and a food. */
const NOT_ALIVE = /\b(teddy bears?|hot dogs?|toy|plush|soft toy|statue|ornament|picture of|drawing of)\b/i;
export const isLiving = (label: string): boolean => LIVING.test(label) && !NOT_ALIVE.test(label);
export const isPlace = (label: string): boolean => PLACE.test(label);

/** A page fills this much of the picture or more, with this many words or more: a document to scan flat, not a sign to read. */
export const DOC_SHARE = 0.45;
export const DOC_WORDS = 40;

/** A shop barcode's digits (EAN-13, EAN-8, UPC-A), or null for any other code. */
export function ean(code: { text: string; format?: string } | undefined): string | null {
  if (!code) return null;
  const t = code.text.trim();
  if (!/^\d{8}$|^\d{12,13}$/.test(t)) return null;
  if (code.format && !/ean|upc|product/i.test(code.format)) return null;
  return t;
}

/**
 * The one job for what is in view, best first: a face (his people are named, a stranger is said plainly and never identified), a
 * code (a shop barcode is a product), a letter, a document, text, a place or artwork, a living thing, a thing; else nothing yet.
 * Every job the frame holds is listed (the cards), the first is the one the Lens does.
 */
export function jobsOf(s: Seen): JobId[] {
  const out: JobId[] = [];
  if (s.stranger) out.push('stranger');
  if (s.known) out.push('known');
  if (s.code?.text) out.push(ean(s.code) ? 'product' : 'code');
  const words = (s.text ?? '').match(/\S+/g)?.length ?? 0;
  if (words) {
    if (s.letter) out.push('letter');
    else if ((s.textShare ?? 0) >= DOC_SHARE && words >= DOC_WORDS) out.push('document');
    else out.push('text');
  }
  if (s.thing?.label) out.push(isPlace(s.thing.label) ? 'place' : isLiving(s.thing.label) ? 'living' : 'thing');
  return out.length ? out : ['nothing'];
}
export const jobOf = (s: Seen): JobId => jobsOf(s)[0]!;

/** How sure, as he says it: whole percent, never over 99 (nothing on a phone camera is certain). */
export function sureWords(score: number): string {
  const p = Math.max(1, Math.min(99, Math.round(score * 100)));
  return `${p}% sure`;
}

// ---------------------------------------------------------------- what he can act on in a read text

export type ActKind = 'date' | 'phone' | 'address' | 'link' | 'email' | 'sum';
export interface TextAct {
  kind: ActKind;
  /** The words as they stand in the text. */
  text: string;
  /** What the act uses: an ISO day, a tel: number, a postcode line, an https address, an address, the answer. */
  value: string;
  /** A sum's working, line by line. */
  steps?: string[];
}

/** A UK number: a bracketed area code and the rest ("(020) 7946 0958"), or +44 or 0 and nine or ten more digits, one space or dash at most between digits. */
const PHONE = /\(0\d{2,4}\)\s?(?:\d[\s-]?){5,8}\b|(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g;
/**
 * A reference's label standing right before a number ("Order number 0123 456 789", "Your account number is …", "Booking
 * reference: …", "Account no. (please quote): …"): that number is the reference, never a phone. Only number nouns, a bracketed
 * aside, "is" and punctuation may stand between the label and the number, so "Customer Services 0800 …" stays a phone.
 */
const REF_LABEL = /\b(order|invoice|account|acct|customer|policy|ref|reference|membership|member|booking|tracking|serial|sort code|nhs|case|claim|meter|mpan|mprn|card|voucher|ticket|barcode|isbn|id)(?:\s*(?:no\.?|number|num|#|ref(?:erence)?|code|id))*\s*(?:\([^)\n]{0,24}\)\s*)?(?:is\s*)?[:.#-]?\s*$/i;
/** Is the number at `at` a reference (its label right before it on its line, or ending the line above when it starts its own)? */
function isReference(t: string, at: number): boolean {
  const ls = t.lastIndexOf('\n', at - 1) + 1;
  const lead = t.slice(Math.max(ls, at - 60), at);
  if (REF_LABEL.test(lead)) return true;
  if (lead.trim() || ls === 0) return false;
  const above = t.slice(t.lastIndexOf('\n', ls - 2) + 1, ls - 1);
  return REF_LABEL.test(above);
}
const URL_RE = /\b(?:https?:\/\/|www\.)(?:[^\s<>"'()]|\([^\s<>"'()]*\))*(?:[^\s<>"'().,;:!?]|\([^\s<>"'()]*\))/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** A UK postcode's shape (the address is the line it stands on, with the street line before it when there is one); any case, a space or none. */
const POSTCODE = /\b([A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?)[ \u00a0]*(\d[ABD-HJLNP-UW-Z]{2})\b/gi;
/** The postcode areas of the UK, the Isle of Man and the Channel Islands: a shape whose letters are no area is no postcode ("PS5 1TB"). */
const AREAS = new Set('AB AL B BA BB BD BH BL BN BR BS BT CA CB CF CH CM CO CR CT CV CW DA DD DE DG DH DL DN DT DY E EC EH EN EX FK FY G GL GU GY HA HD HG HP HR HS HU HX IG IM IP IV JE KA KT KW KY L LA LD LE LL LN LS LU M ME MK ML N NE NG NN NP NR NW OL OX PA PE PH PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ST SW SY TA TD TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO ZE'.split(' '));
/** Inward halves that are units of storage, not a postcode ("8GB", "1TB"). */
const NOT_INWARD = /^\d(?:GB|TB)$/;
/** A floor, a room or a unit just before the shape: a sign in a building ("Room B1 2ND"), not a postcode. */
const IN_BUILDING = /\b(floor|room|level|unit|flat|suite|lift|gate|platform|bay)\s*$/i;
/** A street word in the line before the postcode: that line is the street. */
const STREET_WORD = /\b(road|rd|street|st|lane|ln|avenue|ave|close|drive|dr|way|place|crescent|grove|gardens|terrace|court|square|hill|row|walk|mews|parade|park)\b/i;

/** A phone number as a dialler takes it: +44 or 0 and the digits, nothing else. */
export function telOf(words: string): string | null {
  const d = words.replace(/[^\d+]/g, '');
  if (/^\+44[1-9]\d{8,9}$/.test(d)) return d;
  if (/^\+440[1-9]\d{8,9}$/.test(d)) return `+44${d.slice(4)}`;
  if (/^0[1-9]\d{8,9}$/.test(d)) return d;
  return null;
}

/** The things he can act on in a read text, in the order they stand. `today` is his day (YYYY-MM-DD) for dates without a year. */
export function textActs(text: string, today: string): TextAct[] {
  const t = String(text ?? '');
  const out: (TextAct & { at: number })[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x);
  const add = (a: TextAct, at: number, len: number) => {
    if (!free(at, at + len)) return;
    taken.push([at, at + len]);
    out.push({ ...a, at });
  };
  for (const m of t.matchAll(URL_RE)) add({ kind: 'link', text: m[0], value: /^https?:/i.test(m[0]) ? m[0] : `https://${m[0]}` }, m.index ?? 0, m[0].length);
  for (const m of t.matchAll(EMAIL)) add({ kind: 'email', text: m[0], value: m[0] }, m.index ?? 0, m[0].length);
  for (const m of t.matchAll(PHONE)) {
    const tel = telOf(m[0]);
    const at = m.index ?? 0;
    if (!tel || isReference(t, at)) continue;
    add({ kind: 'phone', text: m[0].trim(), value: tel }, at, m[0].length);
  }
  const lines = t.split(/\n/);
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // the first shape on the line that is a postcode: a real area, no storage unit, not a room in a building
    const m = [...line.matchAll(POSTCODE)].find((c) => AREAS.has(c[1]!.replace(/\d.*$/, '').toUpperCase()) && !NOT_INWARD.test(c[2]!.toUpperCase()) && !IN_BUILDING.test(line.slice(0, c.index)));
    if (m) {
      const prev = i > 0 ? lines[i - 1]!.trim() : '';
      // the street line goes with it when it is one: a street word (a person's title is none: "Dr Jane Patel"), or a house number
      // first ("12", "10-12") on a line that is no opening time ("9-5", "9.00 - 17.00"); never a phone number
      const named = prev.replace(/^(?:dr|mr|mrs|ms|miss|prof|rev)\.?\s+/i, '');
      const street = STREET_WORD.test(named) || (/^\s*\d+[A-Z]?(?:\s*[-–]\s*\d+[A-Z]?)?\s+[A-Z]/i.test(prev) && !/\d{1,2}[:.]\d{2}/.test(prev));
      const before = prev && prev.length <= 40 && street && !telOf(prev) ? `${prev}, ` : '';
      const pc = `${m[1]!.toUpperCase()} ${m[2]!.toUpperCase()}`;
      const said = `${before}${line.trim()}`;
      add({ kind: 'address', text: said.slice(0, 120), value: said.replace(m[0], pc).replace(/[ \u00a0]+/g, ' ').slice(0, 120) }, pos + (m.index ?? 0), m[0].length);
    }
    pos += line.length + 1;
  }
  for (const d of datesIn(t, today)) {
    add({ kind: 'date', text: d.text, value: d.iso }, d.at, d.text.length);
  }
  for (const s of sumsIn(t)) add({ kind: 'sum', text: s.text, value: s.answer, steps: s.steps }, s.at, s.text.length);
  return out.sort((a, b) => a.at - b.at).map(({ at: _at, ...a }) => a);
}

// ---------------------------------------------------------------- sums, worked

/** A number as he writes it: no trailing zeros, at most six places, a minus sign for negatives. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return 'no answer';
  const r = Math.round(n * 1e6) / 1e6;
  return String(Object.is(r, -0) ? 0 : r);
}

type Tok = { t: 'n'; v: number; neg?: boolean } | { t: 'op'; v: string } | { t: '('; v: string } | { t: ')'; v: string };

/** The tokens of an arithmetic expression (×, x between numbers, ÷, ^, %, brackets), or null when it is not one. */
function tokens(src: string): Tok[] | null {
  const s = src.replace(/[×xX*]/g, '*').replace(/[÷:]/g, '/').replace(/[−–—]/g, '-').replace(/,(?=\d{3}\b)/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ') {
      i++;
      continue;
    }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (m) {
      out.push({ t: 'n', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if ('+-*/^'.includes(c)) out.push({ t: 'op', v: c });
    else if (c === '%') out.push({ t: 'op', v: '%' });
    else if (c === '(') out.push({ t: '(', v: c });
    else if (c === ')') out.push({ t: ')', v: c });
    else return null;
    i++;
  }
  return out;
}

const SYM: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

/**
 * An arithmetic expression worked the way it is taught: brackets first, then powers, then × and ÷ left to right, then + and −
 * left to right; one line for each step. Null when it is not a sum this can work.
 */
export function work(expr: string): { answer: number; steps: string[] } | null {
  const toks = tokens(expr);
  if (!toks || !toks.length) return null;
  // a percent after a number is that number ÷ 100 ("15% of 80" is handled before this)
  const flat: Tok[] = [];
  for (const k of toks) {
    if (k.t === 'op' && k.v === '%') {
      const last = flat[flat.length - 1];
      if (last?.t !== 'n') return null;
      last.v = last.v / 100;
    } else flat.push(k);
  }
  // a minus at the start or after an operator or a bracket is a sign
  const signed: Tok[] = [];
  for (let i = 0; i < flat.length; i++) {
    const k = flat[i]!;
    const prev = signed[signed.length - 1];
    if (k.t === 'op' && k.v === '-' && (!prev || prev.t === 'op' || prev.t === '(') && flat[i + 1]?.t === 'n') {
      const n = flat[i + 1] as { v: number };
      // a sign binds after a power, as taught: −3² is −(3²) = −9; the sign waits on the number until its power is worked
      if (flat[i + 2]?.t === 'op' && (flat[i + 2] as { v: string }).v === '^') signed.push({ t: 'n', v: n.v, neg: true });
      else signed.push({ t: 'n', v: -n.v });
      i++;
    } else signed.push(k);
  }
  const steps: string[] = [];
  let guard = 0;
  const evalFlat = (list: Tok[]): Tok[] | null => {
    for (const ops of [['^'], ['*', '/'], ['+', '-']]) {
      for (let i = 0; i < list.length; i++) {
        const k = list[i]!;
        if (k.t !== 'op' || !ops.includes(k.v)) continue;
        // a chain of powers is worked from its top (2^3^2 is 2^9): a power whose exponent is raised again waits for it
        const nx = list[i + 2];
        if (k.v === '^' && nx?.t === 'op' && nx.v === '^') continue;
        const a = list[i - 1];
        const b = list[i + 1];
        if (a?.t !== 'n' || b?.t !== 'n') return null;
        const v0 = k.v === '^' ? a.v ** b.v : k.v === '*' ? a.v * b.v : k.v === '/' ? (b.v === 0 ? NaN : a.v / b.v) : k.v === '+' ? a.v + b.v : a.v - b.v;
        // a signed base takes its sign after its power: −(3 ^ 2) = −9
        const neg = k.v === '^' && a.neg === true;
        const v = neg ? -v0 : v0;
        if (!Number.isFinite(v)) return null;
        // (a negative base is written in its brackets: (−3) ^ 2 is not −3 ^ 2)
        const base = k.v === '^' && a.v < 0 ? `(${num(a.v)})` : num(a.v);
        steps.push(neg ? `-(${num(a.v)} ^ ${num(b.v)}) = ${num(v)}` : `${base} ${SYM[k.v]} ${num(b.v)} = ${num(v)}`);
        list.splice(i - 1, 3, { t: 'n', v });
        // the next operator now stands where this one stood; after a power, look again from the start (a waiting power may be free)
        i = k.v === '^' ? -1 : i - 1;
        if (++guard > 40) return null;
      }
    }
    return list;
  };
  const list = [...signed];
  // brackets, innermost first
  for (;;) {
    const close = list.findIndex((k) => k.t === ')');
    if (close < 0) break;
    let open = close;
    while (open >= 0 && list[open]!.t !== '(') open--;
    if (open < 0) return null;
    const inner = evalFlat(list.slice(open + 1, close));
    if (!inner || inner.length !== 1 || inner[0]!.t !== 'n') return null;
    list.splice(open, close - open + 1, inner[0]!);
  }
  if (list.some((k) => k.t === '(')) return null;
  const done = evalFlat(list);
  if (!done || done.length !== 1 || done[0]!.t !== 'n') return null;
  if (!steps.length) return null;
  return { answer: done[0]!.v, steps };
}

/**
 * A simple equation in one letter, worked: "2x + 3 = 11" → 2x = 11 − 3 = 8 → x = 8 ÷ 2 = 4. Only ax + b = c and the forms it
 * stands for (b and c may be any sign; a may be left out). Null for anything else: it never guesses.
 */
export function equation(src: string): { answer: string; steps: string[] } | null {
  const s = src.replace(/[−–—]/g, '-').replace(/\s+/g, '');
  const m = /^(-?\d*(?:\.\d+)?)\*?([a-z])([+-]\d+(?:\.\d+)?)?=(-?\d+(?:\.\d+)?)$/i.exec(s);
  if (!m) return null;
  const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : parseFloat(m[1]!);
  const v = m[2]!;
  const b = m[3] ? parseFloat(m[3]) : 0;
  const c = parseFloat(m[4]!);
  if (!a) return null;
  const steps: string[] = [];
  const rhs = c - b;
  const lhs = a === 1 ? v : `${num(a)}${v}`;
  if (b) steps.push(`${lhs} = ${num(c)} ${b > 0 ? '−' : '+'} ${num(Math.abs(b))} = ${num(rhs)}`);
  const x = rhs / a;
  if (a !== 1) steps.push(`${v} = ${num(rhs)} ÷ ${num(a)} = ${num(x)}`);
  if (!steps.length) return null;
  return { answer: `${v} = ${num(x)}`, steps };
}

/** "15% of 80", worked: 15 ÷ 100 × 80 = 12. */
function percentOf(src: string): { answer: string; steps: string[] } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*of\s*£?(\d+(?:\.\d+)?)\s*$/i.exec(src);
  if (!m) return null;
  const p = parseFloat(m[1]!);
  const n = parseFloat(m[2]!);
  const r = (p / 100) * n;
  return { answer: num(r), steps: [`${num(p)}% = ${num(p)} ÷ 100 = ${num(p / 100)}`, `${num(p / 100)} × ${num(n)} = ${num(r)}`] };
}

/** A sum or an equation, worked; null when the words are not one. */
export function solve(src: string): { answer: string; steps: string[] } | null {
  const s = String(src ?? '').trim().replace(/=\s*\??\s*$/, '').trim();
  if (!s) return null;
  const pct = percentOf(s);
  if (pct) return pct;
  if (/[a-z]/i.test(s.replace(/[xX](?=\s*\d)/g, '*')) && s.includes('=')) return equation(s);
  if (s.includes('=')) return null;
  const w = work(s);
  return w ? { answer: num(w.answer), steps: w.steps } : null;
}

/** The sums in a text: each line that is a sum or an equation (at least one operator between two numbers, or "n% of m"). */
function sumsIn(text: string): { text: string; at: number; answer: string; steps: string[] }[] {
  const out: { text: string; at: number; answer: string; steps: string[] }[] = [];
  let pos = 0;
  for (const raw of text.split('\n')) {
    const whole = raw.trim();
    const at = pos + raw.indexOf(whole);
    pos += raw.length + 1;
    // a homework question's number or letter is not part of the sum ("1) 5 x 3 =", "Q2. 2x + 3 = 11", "(a) 15% of 80")
    const line = whole.replace(/^(?:q(?:uestion)?\s*)?(?:\d{1,2}|[a-h])[).:]\s+|^\((?:\d{1,2}|[a-h])\)\s+/i, '');
    if (line.length < 3 || line.length > 80) continue;
    // bare numbers joined only by a dash or a slash are a range, a span of years, opening hours or a season, not a sum
    // ("1914 - 1918", "9-5", "9.00 - 17.00", "2024/25"), unless the line asks for the answer with "="
    if (!line.includes('=') && /^[\d.,\s]+(?:[-–—/][\d.,\s]+)+$/.test(line)) continue;
    const looks = /\d\s*[-+×x*÷/^]\s*[\d(]|\d\s*%\s*of\s*\d|\d?[a-z]\s*[-+]\s*\d+\s*=\s*-?\d|^\d*[a-z]\s*=\s*-?\d/i.test(line);
    if (!looks) continue;
    // a date (12/03/2026), a phone number or a time is not a sum
    if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}:\d{2}\b/.test(line) || telOf(line)) continue;
    const r = solve(line);
    if (r) out.push({ text: whole, at, answer: r.answer, steps: r.steps });
  }
  return out;
}

// ---------------------------------------------------------------- which kind of living thing, for the species question

/** The kind NAME's LIVING THING asks about for a name the phone gave (packages/shared/src/living.ts AskedKind): a plant goes to Pl@ntNet. */
export function livingKind(label: string): 'plant' | 'bird' | 'insect' | 'other' {
  const l = String(label ?? '').toLowerCase();
  if (/\b(bird|robin|owl|duck|swan|pigeon|sparrow|blackbird|magpie|crow|gull|tit|finch|wren|heron|goose|hen|chicken|parrot|eagle|hawk)s?\b/.test(l)) return 'bird';
  if (/\b(insect|butterfly|moth|bee|wasp|beetle|ladybird|ladybug|ant|fly|dragonfly|grasshopper|caterpillar|spider)s?\b/.test(l)) return 'insect';
  if (/\b(plant|potted plant|flower|tree|leaf|leaves|daisy|rose|tulip|sunflower|fern|cactus|moss|shrub|bush|grass|weed|herb)s?\b/.test(l)) return 'plant';
  return 'other';
}
