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

export type JobId = 'nothing' | 'text' | 'receipt' | 'contact' | 'stop' | 'medicine' | 'rating' | 'letter' | 'document' | 'code' | 'product' | 'thing' | 'living' | 'place' | 'known' | 'stranger';

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
  /** The read words look like a till receipt (looksLikeReceipt). */
  receipt?: boolean;
  /** The read words are a business card's (readBusinessCard). */
  contact?: boolean;
  /** The read words are a bus stop sign's (readBusStop). */
  stop?: boolean;
  /** The read words are a medicine box's (readMedicine). */
  medicine?: boolean;
  /** The read words are an appliance's rating plate (readRating). */
  rating?: boolean;
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
    if (s.receipt) out.push('receipt');
    else if (s.contact) out.push('contact');
    else if (s.stop) out.push('stop');
    else if (s.medicine) out.push('medicine');
    else if (s.rating) out.push('rating');
    else if (s.letter) out.push('letter');
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

export type ActKind = 'date' | 'phone' | 'address' | 'link' | 'email' | 'sum' | 'parcel' | 'unit' | 'price';
export interface TextAct {
  kind: ActKind;
  /** The words as they stand in the text. */
  text: string;
  /** What the act uses: an ISO day, a tel: number, a postcode line, an https address, an address, the answer. */
  value: string;
  /** A sum's working, line by line. */
  steps?: string[];
  /** A price's amount and its currency (ISO, lower case), for IN POUNDS. */
  amount?: number;
  cur?: string;
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
  // (the sweep, as Live Text does) a parcel's tracking number, before anything reads its digits as a phone number
  for (const m of t.matchAll(PARCEL_RE)) add({ kind: 'parcel', text: m[0], value: `https://www.royalmail.com/track-your-item#/tracking-results/${m[0]}` }, m.index ?? 0, m[0].length);
  for (const p of pricesIn(t)) add({ kind: 'price', text: p.text, value: p.cur, amount: p.amount, cur: p.cur }, p.at, p.text.length);
  for (const u of unitsIn(t)) add({ kind: 'unit', text: u.text, value: u.said }, u.at, u.text.length);
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

// ---------------------------------------------------------------- a receipt (lens.c1: into this month's spending)

/** Does the read text look like a till receipt: two prices or more, a total, and a till's words (card, change, VAT…)? */
export function looksLikeReceipt(text: string): boolean {
  const t = String(text ?? '');
  const prices = (t.match(/£?\s?\d{1,5}\.\d{2}\b/g) ?? []).length;
  const total = /\b(?:total|sub-?total|balance due|amount due|to pay|amount paid)\b/i.test(t);
  const till = /\b(?:card|visa|mastercard|amex|contactless|chip|cash|change|vat|receipt|till|cashier|thank you|items?|qty|auth(?:orisation)? code)\b/i.test(t);
  return prices >= 2 && total && till;
}

/** One spend as the statement importer reads it (date, description, signed amount: money out is negative), never a formula. */
export function receiptCsv(r: { store: string; date: string; total: number }, today: string): string {
  const name = (r.store || 'Receipt').replace(/[",\r\n]/g, ' ').replace(/^[=+\-@]+/, '').trim() || 'Receipt';
  return `Date,Description,Amount\n${r.date || today},${name},-${r.total.toFixed(2)}\n`;
}

// ---------------------------------------------------------------- what he avoids (lens.u7: kept on his phone only)

/** The fourteen allergens UK food law names, with the words an ingredients list uses for each. */
export const ALLERGENS: { id: string; say: string; words: RegExp }[] = [
  { id: 'gluten', say: 'gluten', words: /\b(?:gluten|wheat|barley|rye|oats?|spelt|kamut|semolina|couscous)\b/i },
  { id: 'milk', say: 'milk', words: /\b(?:milk|lactose|dairy|cheese|butter|cream|whey|casein|yoghurt|yogurt)\b/i },
  { id: 'eggs', say: 'eggs', words: /\beggs?\b/i },
  { id: 'peanuts', say: 'peanuts', words: /\b(?:peanuts?|groundnuts?|arachis)\b/i },
  { id: 'nuts', say: 'tree nuts', words: /\b(?:nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i },
  { id: 'soya', say: 'soya', words: /\b(?:soy|soya|soybeans?|soja|edamame|tofu)\b/i },
  { id: 'fish', say: 'fish', words: /\b(?:fish|anchov(?:y|ies)|salmon|tuna|cod|haddock|sardines?|mackerel|pollock)\b/i },
  { id: 'crustaceans', say: 'crustaceans', words: /\b(?:crustaceans?|prawns?|shrimps?|crabs?|lobsters?|langoustines?|crayfish)\b/i },
  { id: 'molluscs', say: 'molluscs', words: /\b(?:molluscs?|mussels?|oysters?|squid|clams?|scallops?|octopus|snails?)\b/i },
  { id: 'sesame', say: 'sesame', words: /\bsesame\b/i },
  { id: 'celery', say: 'celery', words: /\b(?:celery|celeriac)\b/i },
  { id: 'mustard', say: 'mustard', words: /\bmustard\b/i },
  { id: 'sulphites', say: 'sulphites', words: /\b(?:sulphites?|sulfites?|sulphur dioxide|sulfur dioxide|e22[0-8])\b/i },
  { id: 'lupin', say: 'lupin', words: /\blupin[es]?\b/i },
];
/** The ways of eating he can set, each checked against the packet's own figures (the UK front-of-pack bands, per 100 g). */
export const DIETS: { id: string; say: string }[] = [
  { id: 'vegan', say: 'vegan' },
  { id: 'vegetarian', say: 'vegetarian' },
  { id: 'low sugar', say: 'low sugar' },
  { id: 'low salt', say: 'low salt' },
  { id: 'low fat', say: 'low fat' },
];
const MEAT = /\b(?:beef|pork|chicken|lamb|mutton|turkey|duck|ham|bacon|gelatine|gelatin|lard|suet|anchov(?:y|ies)|meat|fish|prawns?|carmine|cochineal|rennet)\b/i;
const NOT_VEGAN = /\b(?:honey|milk|cheese|butter|cream|whey|casein|eggs?|lactose|yoghurt|yogurt|beeswax|shellac)\b/i;

export interface AvoidProduct {
  allergens?: string[];
  ingredients?: string;
  nutrition?: Partial<Record<'sugars' | 'salt' | 'fat', number>>;
}
export type Tone = 'red' | 'amber' | 'green';
export interface Verdict {
  tone: Tone | 'none';
  /** One line for the card, in his words. */
  line: string;
  /** What he avoids that it holds (red) or that cannot be told (amber). */
  hits: string[];
  unsure: string[];
}

const listWords = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * A packet against what he avoids: RED when it holds one (its allergens, or its ingredients' words), or a figure is over the high
 * band; AMBER when it cannot be told (no ingredients listed, no figure) or a figure is in the middle band; GREEN when every one is
 * checked and clear. Never a health claim: what the open database says, against the list he set.
 */
export function avoidVerdict(avoid: string[], p: AvoidProduct): Verdict {
  const list = [...new Set(avoid.map((a) => a.toLowerCase().trim()).filter(Boolean))];
  if (!list.length) return { tone: 'none', line: '', hits: [], unsure: [] };
  const tags = (p.allergens ?? []).map((t) => t.toLowerCase());
  const ing = String(p.ingredients ?? '');
  const hits: string[] = [];
  const unsure: string[] = [];
  const amberFigures: string[] = [];
  for (const id of list) {
    const al = ALLERGENS.find((a) => a.id === id);
    if (al) {
      if (tags.some((t) => al.words.test(t) || t.includes(al.id)) || (ing && al.words.test(ing))) hits.push(al.say);
      else if (!ing && !tags.length) unsure.push(`whether it has ${al.say}`);
      continue;
    }
    const n = p.nutrition ?? {};
    const band = (v: number | undefined, high: number, low: number, word: string) => {
      if (v == null) unsure.push(`its ${word} figure`);
      else if (v > high) hits.push(`high ${word}`);
      else if (v > low) amberFigures.push(`medium ${word}`);
    };
    if (id === 'low sugar') band(n.sugars, 22.5, 5, 'sugar');
    else if (id === 'low salt') band(n.salt, 1.5, 0.3, 'salt');
    else if (id === 'low fat') band(n.fat, 17.5, 3, 'fat');
    else if (id === 'vegan') {
      if ((ing && (MEAT.test(ing) || NOT_VEGAN.test(ing))) || tags.some((t) => /milk|egg|fish|crustacean|mollusc/.test(t))) hits.push('animal products');
      else if (!ing) unsure.push('whether it is vegan');
    } else if (id === 'vegetarian') {
      if ((ing && MEAT.test(ing)) || tags.some((t) => /fish|crustacean|mollusc/.test(t))) hits.push('meat or fish');
      else if (!ing) unsure.push('whether it is vegetarian');
    }
  }
  if (hits.length) return { tone: 'red', line: `Not for you: it has ${listWords(hits)}.`, hits, unsure };
  if (unsure.length) return { tone: 'amber', line: `Check the pack: the open database does not say ${listWords(unsure)}.`, hits, unsure };
  if (amberFigures.length) return { tone: 'amber', line: `Go easy: ${listWords(amberFigures)} for you.`, hits, unsure };
  return { tone: 'green', line: `Fine for you: nothing you avoid, by its ingredients and figures.`, hits, unsure };
}

/** What he says he avoids, in his words ("I'm allergic to peanuts and milk", "I'm vegan", "I avoid gluten"): the list's ids. */
export function avoidFromWords(text: string): string[] {
  const t = String(text ?? '').toLowerCase();
  const out = new Set<string>();
  // (whole words only: "peanuts" is not tree nuts)
  for (const a of ALLERGENS) if (a.words.test(t) || new RegExp(`\\b${a.id}\\b`).test(t) || new RegExp(`\\b${a.say}\\b`).test(t)) out.add(a.id);
  if (out.has('peanuts') && !/\b(?:tree nuts?|nuts?)\b/.test(t.replace(/\bpeanuts?\b/g, ''))) out.delete('nuts');
  if (/\b(?:coeliac|celiac)\b/.test(t)) out.add('gluten');
  if (/\blactose\b/.test(t)) out.add('milk');
  if (/\bvegan\b/.test(t)) out.add('vegan');
  else if (/\bvegetarian\b/.test(t)) out.add('vegetarian');
  const less = '(?:low|less|no|cut(?:ting)?(?: down)?(?: on)?|avoid(?:ing)?)\\s+';
  if (new RegExp(`\\b${less}sugar\\b`).test(t)) out.add('low sugar');
  if (new RegExp(`\\b${less}salt\\b`).test(t)) out.add('low salt');
  if (new RegExp(`\\b${less}fat\\b`).test(t)) out.add('low fat');
  return [...out];
}

// ---------------------------------------------------------------- a menu, line by line (lens.u1)

/** A menu or a page: four lines or more of a few words each. A short sign is translated whole, as before. */
export const isMenuLike = (text: string): boolean => String(text ?? '').split('\n').filter((l) => /\p{L}{2}/u.test(l)).length >= 4;

/** The English for each line, in order, when the answer has exactly one line for each line read; null when it does not line up. */
export function pairLines(lines: string[], english: string): string[] | null {
  const en = String(english ?? '').split('\n').map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, '').trim()).filter(Boolean);
  return en.length === lines.length && lines.length ? en : null;
}

// ---------------------------------------------------------------- a business card (lens.s1: into his contacts, on the phone)

/** A business card's details, only as the card prints them: nothing is looked up about the person. */
export interface CardContact {
  name: string;
  title: string;
  org: string;
  phones: string[];
  emails: string[];
  web: string;
  address: string;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_RE = /(?:\+|\b0)[\d\s().-]{8,16}\d/g;
const ORG_WORDS = /\b(?:ltd|limited|plc|llp|inc|gmbh|group|services|solutions|company|consulting|partners|associates|studio|agency|council|trust|university|college|nhs)\b|&/i;
const TITLE_WORDS = /\b(?:manager|director|engineer|officer|consultant|head|lead|founder|co-founder|ceo|cto|cfo|coo|partner|sales|developer|designer|assistant|associate|specialist|executive|advisor|adviser|architect|analyst|president|owner|accountant|solicitor|surveyor|agent|nurse|doctor|dr|teacher|coordinator|administrator|technician|electrician|plumber|builder|chef|photographer|editor|producer|representative|secretary)\b/i;
const POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i;

/** Is this line a person's name as cards print it: two to four words, each capitalised, letters only. */
const nameLike = (l: string): boolean => {
  const w = l.split(/\s+/);
  return w.length >= 2 && w.length <= 4 && w.every((x) => /^(?:[A-Z][a-z'’-]+|[A-Z][A-Z'’-]+|[A-Z]\.)$/.test(x)) && !ORG_WORDS.test(l) && !TITLE_WORDS.test(l) && !/\b(?:street|road|lane|avenue|close|way|house|floor|unit|park|hall|centre|center|church|school|station|market|night|day|club|shop|cafe|bar|hotel|the|and|of|for|at)\b/i.test(l);
};

/**
 * The read words of a business card → its details; null when the words are not a card's (more than 45 words, nothing to
 * reach anyone by, or no name). Phone numbers are kept with their digits only (and a leading +).
 */
export function readBusinessCard(text: string): CardContact | null {
  const t = String(text ?? '');
  const words = t.match(/\S+/g)?.length ?? 0;
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (words < 3 || words > 45 || lines.length < 2 || lines.length > 14) return null;
  const emails = [...new Set(t.match(EMAIL_RE) ?? [])].slice(0, 3);
  const phones = [...new Set((t.replace(EMAIL_RE, ' ').match(PHONE_RE) ?? []).map((p) => p.replace(/[^\d+]/g, '')).filter((p) => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13))].slice(0, 3);
  if (!emails.length && !phones.length) return null;
  // the name stands near the top of a card
  const nameLine = lines.slice(0, 3).find(nameLike);
  if (!nameLine) return null;
  const webM = t.replace(EMAIL_RE, ' ').match(/\b(?:https?:\/\/)?(?:www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?|\bhttps?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/i);
  const strip = (l: string) => l.replace(/^(?:t|tel|telephone|m|mob|mobile|e|email|w|web|p|phone)\s*[:.]\s*/i, '').trim();
  const titleLine = lines.find((l) => l !== nameLine && TITLE_WORDS.test(l) && !EMAIL_RE.test(l) && !/\d{4}/.test(l));
  EMAIL_RE.lastIndex = 0;
  const orgLine = lines.find((l) => l !== nameLine && l !== titleLine && ORG_WORDS.test(l) && !/@/.test(l) && !/\d{5}/.test(l));
  const at = lines.findIndex((l) => POSTCODE_RE.test(l));
  const address = at < 0 ? '' : [at > 0 && /\d/.test(lines[at - 1]!) && !/@|\d{6}/.test(lines[at - 1]!) ? lines[at - 1]! : '', lines[at]!].filter(Boolean).map(strip).join(', ');
  return { name: nameLine, title: titleLine ? strip(titleLine) : '', org: orgLine ? strip(orgLine) : '', phones, emails, web: webM ? webM[0] : '', address };
}

/** One vCard field's value, escaped as the format needs. */
const vEsc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** A contact as a vCard (3.0), for the phone's own contacts: made on the phone, and nothing else is told. */
export function vcardOf(c: Pick<CardContact, 'name'> & Partial<CardContact>): string {
  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1]! : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc(c.name.trim())}`];
  if (c.org) lines.push(`ORG:${vEsc(c.org)}`);
  if (c.title) lines.push(`TITLE:${vEsc(c.title)}`);
  for (const p of c.phones ?? []) lines.push(`TEL;TYPE=${/^(?:\+44)?0?7/.test(p) ? 'CELL' : 'WORK'}:${p}`);
  for (const e of c.emails ?? []) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(e)}`);
  if (c.web) lines.push(`URL:${vEsc(/^https?:/i.test(c.web) ? c.web : `https://${c.web}`)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${vEsc(c.address)};;;;`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- a bus stop sign (lens.s7: its next buses)

/** What a bus stop's sign says: its name, its letter, the buses that stop, where they go, and its text-message code. */
export interface BusStop {
  name: string;
  letter: string;
  routes: string[];
  towards: string;
  sms: string;
}

const ROUTE_TOKEN = /^(?:[A-Z]{1,2}\d{1,3}[A-Z]?|\d{1,3}[A-Z]?)$/;

/** The read words of a bus stop sign → what it says; null when the words are not a stop's. */
export function readBusStop(text: string): BusStop | null {
  const t = String(text ?? '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length || lines.length > 16) return null;
  const sms = /\btext\s+['"‘’]?([a-z0-9]{5,8})['"‘’]?\s+to\s+\d{5}\b/i.exec(t)?.[1] ?? '';
  const letter = /\b(?:stop|Stop|STOP)\s+([A-Z]{1,2})\b(?![a-z])/.exec(t)?.[1] ?? '';
  const towardsM = /\btowards\s+([^\n]+)/i.exec(t);
  const towards = towardsM ? towardsM[1]!.trim().replace(/[.,;]+$/, '') : '';
  const cue = /\bbus\s*stop\b|\bbus\s*station\b|\bbuses\b/i.test(t) || !!letter || !!sms || !!towards;
  const routes: string[] = [];
  const isRouteLine = (l: string) => {
    const tok = l.replace(/[,·•|/]/g, ' ').split(/\s+/).filter(Boolean);
    return tok.length >= 1 && tok.length <= 14 && tok.filter((x) => ROUTE_TOKEN.test(x)).length / tok.length >= 0.7 && !/\b(?:19|20)\d{2}\b/.test(l) && !/\d{1,2}:\d{2}/.test(l);
  };
  for (const l of lines) if (isRouteLine(l)) for (const x of l.replace(/[,·•|/]/g, ' ').split(/\s+/)) if (ROUTE_TOKEN.test(x) && !routes.includes(x)) routes.push(x);
  if (!cue || (!routes.length && !towards && !sms && !/\bbus\s*stop\b/i.test(t))) return null;
  const nameLine = lines.find((l) => !/^(?:bus\s*stop|buses|bus\s*station)$/i.test(l) && !/\btowards\b|\btext\s+\S+\s+to\b|\bfor\s+(?:live|next)\b/i.test(l) && !isRouteLine(l) && /\p{L}{3}/u.test(l) && !/^(?:stop|Stop|STOP)\s+[A-Z]{1,2}$/.test(l) && !/^(?:request|compulsory|fare\s*stage)\b/i.test(l));
  const name = (nameLine ?? '').replace(/\b(?:stop|Stop|STOP)\s+[A-Z]{1,2}\b/, '').replace(/\bbus\s*stop\b/i, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  if (!name && !sms) return null;
  return { name, letter, routes: routes.slice(0, 12), towards, sms };
}

// ---------------------------------------------------------------- a medicine box (lens.s2: its public NHS page, on his tap; never advice)

/** A medicine box: the medicine's name as printed, its strength and its form. */
export interface MedicineBox {
  name: string;
  strength: string;
  form: string;
}

const FORM_RE = /\b(tablets?|caplets?|capsules?|soft capsules|oral suspension|oral solution|syrup|liquid|cream|ointment|gel|eye drops|ear drops|nasal spray|drops|inhaler|lozenges?|patch(?:es)?|suppositor(?:y|ies)|sachets?|granules|powder)\b/i;
const STRENGTH_RE = /\b(\d+(?:\.\d+)?\s?(?:mg|micrograms?|mcg|µg|g|ml|%|iu|units?)(?:\s?\/\s?\d+(?:\.\d+)?\s?(?:mg|ml|g|micrograms?|mcg))?)\b/i;

/**
 * The read words of a medicine's box → its name, strength and form; null when the words are not a medicine box's (a form of
 * medicine and either a strength, a UK product licence number or the box's own warnings).
 */
export function readMedicine(text: string): MedicineBox | null {
  const t = String(text ?? '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length || (t.match(/\S+/g)?.length ?? 0) > 120) return null;
  const formLine = lines.find((l) => FORM_RE.test(l));
  if (!formLine) return null;
  const licence = /\bPL\s?\d{4,5}\s?\/\s?\d{4}\b/.test(t);
  const warning = /\b(?:keep (?:all medicines )?out of the (?:sight and )?reach|read the (?:enclosed )?(?:package )?leaflet|do not take more than|do not exceed|pharmacy medicine|prescription only medicine|for oral use)\b/i.test(t);
  const strengthM = STRENGTH_RE.exec(formLine) ?? STRENGTH_RE.exec(t);
  if (!licence && !warning && !strengthM) return null;
  const form = FORM_RE.exec(formLine)![1]!.toLowerCase();
  // the name: the words before the strength or the form on its line, else the line above it
  let name = formLine.replace(STRENGTH_RE, ' ').replace(FORM_RE, ' ').replace(/\b(?:film[- ]coated|effervescent|soluble|dispersible|extra|max(?:imum)? strength|for adults|for children|\d+\s*(?:x|pack)|pack of \d+)\b/gi, ' ').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!/\p{L}{4}/u.test(name)) {
    const i = lines.indexOf(formLine);
    name = (i > 0 ? lines[i - 1]! : '').replace(STRENGTH_RE, ' ').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  if (!/\p{L}{4}/u.test(name)) return null;
  const words = name.split(' ').slice(0, 4).join(' ');
  return { name: words.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).replace(/\B\p{Lu}+/gu, (c) => c.toLowerCase()), strength: strengthM ? strengthM[1]!.replace(/\s+/g, '') : '', form };
}

/** The public NHS search for a medicine by its name: opened only on his tap, and nothing else about him goes with it. */
export const nhsSearch = (name: string): string => `https://www.nhs.uk/search/results?q=${encodeURIComponent(name.trim())}`;

// ---------------------------------------------------------------- an appliance's rating plate (lens.s3: what an hour costs, a first estimate)

/** An appliance's rating plate: its most power in watts, and its volts when printed. */
export interface RatingPlate {
  watts: number;
  volts: string;
}

/** The read words of a rating plate → its power; null when the words are not a plate's (watts and volts or hertz). */
export function readRating(text: string): RatingPlate | null {
  const t = String(text ?? '').replace(/,(?=\d{3}\b)/g, '');
  if (!/\b\d{2,3}(?:\s?-\s?\d{2,3})?\s?V\b|\bV\s?~|\b50\s?Hz\b|\b60\s?Hz\b/i.test(t)) return null;
  let watts = 0;
  for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)(?:\s?-\s?(\d+(?:\.\d+)?))?\s?(kW|W)\b(?!h)/g)) {
    const k = m[3] === 'kW' ? 1000 : 1;
    watts = Math.max(watts, Number(m[2] ?? m[1]) * k);
  }
  if (!(watts >= 1 && watts <= 15000)) return null;
  const volts = /\b(\d{2,3}(?:\s?-\s?\d{2,3})?)\s?V\b/.exec(t)?.[1]?.replace(/\s/g, '') ?? '';
  return { watts: Math.round(watts), volts };
}

/** What an hour at full power costs at his price (pence a kWh), in his words, always a first estimate. */
export function runningCost(watts: number, pencePerKwh: number): { pence: number; line: string } {
  const pence = (watts / 1000) * pencePerKwh;
  const say = (p: number) => (p >= 100 ? `£${(p / 100).toFixed(2)}` : `${p < 10 ? p.toFixed(1) : Math.round(p)}p`);
  return { pence, line: `About ${say(pence)} an hour at full power, at ${pencePerKwh}p a unit (kWh): ${say(pence * 5)} for five hours. A first estimate: a thermostat or a lower setting uses less.` };
}

// ---------------------------------------------------------------- two packets side by side (lens.u8)

/** One packet as the open databases give it: its name, score and figures per 100 g. */
export interface PacketFacts {
  title: string;
  nutriscore?: string;
  nutrition?: Partial<Record<'kcal' | 'fat' | 'saturates' | 'sugars' | 'salt' | 'protein' | 'carbs', number>>;
}
export interface CompareRow {
  what: string;
  a: string;
  b: string;
  /** Which is better for him on this row (less sugar, salt, fat, saturates and energy; more protein; the better Nutri-Score), or '' when one is not known. */
  better: 'a' | 'b' | 'same' | '';
}

/**
 * Two packets side by side, per 100 g, from the open databases' own figures: each row says which is better, and one line says it
 * all. Nothing is guessed: a figure the database does not have is "not given", and that row picks neither.
 */
export function comparePackets(a: PacketFacts, b: PacketFacts): { rows: CompareRow[]; line: string } {
  const rows: CompareRow[] = [];
  const fmt = (v: number | undefined, unit: string) => (v == null ? 'not given' : `${v < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10}${unit}`);
  const less = (x?: number, y?: number): CompareRow['better'] => (x == null || y == null ? '' : Math.abs(x - y) < 0.05 ? 'same' : x < y ? 'a' : 'b');
  const ns = (s?: string) => (s && /^[a-e]$/i.test(s) ? s.toLowerCase().charCodeAt(0) : undefined);
  rows.push({ what: 'Nutri-Score', a: a.nutriscore ? a.nutriscore.toUpperCase() : 'not given', b: b.nutriscore ? b.nutriscore.toUpperCase() : 'not given', better: less(ns(a.nutriscore), ns(b.nutriscore)) });
  const na = a.nutrition ?? {}, nb = b.nutrition ?? {};
  const fig: [keyof NonNullable<PacketFacts['nutrition']>, string, string][] = [['kcal', 'Energy', ' kcal'], ['sugars', 'Sugars', ' g'], ['fat', 'Fat', ' g'], ['saturates', 'Saturates', ' g'], ['salt', 'Salt', ' g'], ['protein', 'Protein', ' g']];
  for (const [k, what, unit] of fig) {
    if (na[k] == null && nb[k] == null) continue;
    const better = k === 'protein' ? less(nb[k], na[k]) : less(na[k], nb[k]);
    rows.push({ what, a: fmt(na[k], unit), b: fmt(nb[k], unit), better: k === 'protein' ? (better === 'a' ? 'a' : better === 'b' ? 'b' : better) : better });
  }
  const wins = (w: 'a' | 'b') => rows.filter((r) => r.better === w && r.what !== 'Energy' && r.what !== 'Protein' && r.what !== 'Nutri-Score').map((r) => (r.what === 'Sugars' ? 'sugar' : r.what === 'Saturates' ? 'saturated fat' : r.what.toLowerCase()));
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const wa = wins('a'), wb = wins('b');
  const known = rows.filter((r) => r.better !== '').length;
  const line = !known
    ? 'The open databases don’t give enough figures to compare these two.'
    : wa.length && !wb.length ? `${a.title} has less ${list(wa)} per 100 g.`
    : wb.length && !wa.length ? `${b.title} has less ${list(wb)} per 100 g.`
    : wa.length && wb.length ? `${a.title} has less ${list(wa)}; ${b.title} has less ${list(wb)} (per 100 g).`
    : 'Much the same per 100 g, by the figures the databases give.';
  return { rows, line };
}

// ---------------------------------------------------------------- the UK traffic lights on a packet (the sweep: as UK packs and the best food apps show them)

export type Band = 'high' | 'medium' | 'low';
/** The UK front-of-pack bands per 100 g of food (FSA): above the first is HIGH, at or under the second is LOW. */
const BANDS: Record<'fat' | 'saturates' | 'sugars' | 'salt', [number, number]> = { fat: [17.5, 3], saturates: [5, 1.5], sugars: [22.5, 5], salt: [1.5, 0.3] };
/** A figure per 100 g in its UK band; '' for a nutrient with no band (energy, protein) or no figure. */
export function bandOf(what: string, per100g: number | undefined): Band | '' {
  const b = BANDS[what as keyof typeof BANDS];
  if (!b || per100g == null || !Number.isFinite(per100g)) return '';
  return per100g > b[0] ? 'high' : per100g <= b[1] ? 'low' : 'medium';
}

// ---------------------------------------------------------------- parcels, units and prices in print (the sweep: what Live Text finds)

/** A Royal Mail (and every postal service's) tracking number: two letters, nine digits, two letters ("AB123456789GB"). */
const PARCEL_RE = /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g;

/** A number as he would say it: at most one decimal place for big numbers, two for small. */
const say1 = (n: number): string => (Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

/** Imperial and US measures in print, each in the units he uses (Celsius, kilograms, grams, millilitres, centimetres, metres; kilometres in miles). */
export function unitsIn(text: string): { text: string; at: number; said: string }[] {
  const t = String(text ?? '');
  const out: { text: string; at: number; said: string }[] = [];
  const rules: [RegExp, (n: number) => string][] = [
    [/(-?\d+(?:\.\d+)?)\s?°\s?F\b/g, (n) => `about ${say1(((n - 32) * 5) / 9)} °C`],
    [/(\d+(?:\.\d+)?)\s?fl\.?\s?oz\b/gi, (n) => `about ${say1(n * 29.5735)} ml`],
    [/(\d+(?:\.\d+)?)\s?(?:lbs?)\b/gi, (n) => `about ${say1(n * 0.453592)} kg`],
    [/(\d+(?:\.\d+)?)\s?oz\b/gi, (n) => `about ${say1(n * 28.3495)} g`],
    [/(\d+(?:\.\d+)?)\s?(?:inches|inch|″)(?![a-z])/gi, (n) => `about ${say1(n * 2.54)} cm`],
    [/(\d+(?:\.\d+)?)\s?(?:ft|feet|foot)\b/gi, (n) => `about ${say1(n * 0.3048)} m`],
    [/(\d+(?:\.\d+)?)\s?(?:km|kilometres|kilometers)\b/gi, (n) => `about ${say1(n * 0.621371)} miles`],
  ];
  const taken: [number, number][] = [];
  for (const [re, conv] of rules) {
    for (const m of t.matchAll(re)) {
      const at = m.index ?? 0;
      if (taken.some(([a, b]) => at < b && at + m[0].length > a)) continue;
      // "fl oz" is the fluid ounce, never also the ounce
      if (/oz$/i.test(m[0]) && !/fl/i.test(m[0]) && /fl\.?\s?$/i.test(t.slice(Math.max(0, at - 4), at))) continue;
      taken.push([at, at + m[0].length]);
      out.push({ text: m[0], at, said: conv(Number(m[1])) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const CUR_SIGN: Record<string, string> = { '€': 'eur', $: 'usd', 'US$': 'usd', '¥': 'jpy', '₺': 'try', 'zł': 'pln', 'Kč': 'czk', CHF: 'chf' };
const CUR_CODE = /\b(EUR|USD|CHF|PLN|JPY|TRY|SEK|NOK|DKK|CZK|HUF|AUD|CAD)\b/;
const AMOUNT = '(\\d{1,3}(?:[ .,]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';

/** "14,50", "1.234,50", "1,234.50" → the amount (a comma or a point with two digits after it is the decimal mark). */
function amountOf(s: string): number {
  const t = s.replace(/\s/g, '');
  const m = /^(.*)[.,](\d{1,2})$/.exec(t);
  return m ? Number(`${m[1]!.replace(/[.,]/g, '')}.${m[2]}`) : Number(t.replace(/[.,]/g, ''));
}

/** Prices in another currency in print ("€14,50", "14.50 €", "US$20", "CHF 12", "120 SEK"); never pounds (he reads those already). */
export function pricesIn(text: string): { text: string; at: number; amount: number; cur: string }[] {
  const t = String(text ?? '');
  const out: { text: string; at: number; amount: number; cur: string }[] = [];
  const signs = '(US\\$|€|\\$|¥|₺|CHF)';
  const before = new RegExp(`${signs}\\s?${AMOUNT}`, 'g');
  const after = new RegExp(`${AMOUNT}\\s?(€|zł|Kč|₺)`, 'g');
  const code = new RegExp(`(?:${CUR_CODE.source})\\s?${AMOUNT}|${AMOUNT}\\s?(?:${CUR_CODE.source})`, 'g');
  const push = (whole: string, at: number, amt: string, cur: string) => {
    const amount = amountOf(amt);
    if (!(amount > 0) || out.some((o) => at < o.at + o.text.length && at + whole.length > o.at)) return;
    out.push({ text: whole.trim(), at, amount, cur });
  };
  for (const m of t.matchAll(before)) push(m[0], m.index ?? 0, m[2]!, CUR_SIGN[m[1]!]!);
  for (const m of t.matchAll(after)) push(m[0], m.index ?? 0, m[1]!, CUR_SIGN[m[2]!]!);
  for (const m of t.matchAll(code)) {
    const c = (m[1] ?? m[4] ?? '').toLowerCase();
    const amt = m[2] ?? m[3] ?? '';
    if (c && amt) push(m[0], m.index ?? 0, amt, c);
  }
  return out.sort((a, b) => a.at - b.at);
}
