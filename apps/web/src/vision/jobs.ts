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

export const isLiving = (label: string): boolean => LIVING.test(label);
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

const PHONE = /(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+[^\s<>"').,;:!?]/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** A UK postcode (the address is the line it stands on, with the line before when that line is short). */
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/** A phone number as a dialler takes it: +44 or 0 and the digits, nothing else. */
export function telOf(words: string): string | null {
  const d = words.replace(/[^\d+]/g, '');
  if (/^\+44\d{9,10}$/.test(d)) return d;
  if (/^\+440\d{9,10}$/.test(d)) return `+44${d.slice(4)}`;
  if (/^0\d{9,10}$/.test(d)) return d;
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
    if (tel) add({ kind: 'phone', text: m[0].trim(), value: tel }, m.index ?? 0, m[0].length);
  }
  const lines = t.split(/\n/);
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = POSTCODE.exec(line);
    if (m) {
      const before = i > 0 && lines[i - 1]!.trim().length <= 40 && /\d|road|street|lane|avenue|close|drive|way|place/i.test(lines[i - 1]!) ? `${lines[i - 1]!.trim()}, ` : '';
      const pc = `${m[1]!.toUpperCase()} ${m[2]!.toUpperCase()}`;
      add({ kind: 'address', text: `${before}${line.trim()}`.slice(0, 120), value: `${before}${line.trim()}`.replace(m[0], pc).slice(0, 120) }, pos + (m.index ?? 0), m[0].length);
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

type Tok = { t: 'n'; v: number } | { t: 'op'; v: string } | { t: '('; v: string } | { t: ')'; v: string };

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
      signed.push({ t: 'n', v: -(flat[i + 1] as { v: number }).v });
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
        const a = list[i - 1];
        const b = list[i + 1];
        if (a?.t !== 'n' || b?.t !== 'n') return null;
        const v = k.v === '^' ? a.v ** b.v : k.v === '*' ? a.v * b.v : k.v === '/' ? (b.v === 0 ? NaN : a.v / b.v) : k.v === '+' ? a.v + b.v : a.v - b.v;
        if (!Number.isFinite(v)) return null;
        steps.push(`${num(a.v)} ${SYM[k.v]} ${num(b.v)} = ${num(v)}`);
        list.splice(i - 1, 3, { t: 'n', v });
        i -= 1;
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
    const line = raw.trim();
    const at = pos + raw.indexOf(line);
    pos += raw.length + 1;
    if (line.length < 3 || line.length > 80) continue;
    const looks = /\d\s*[-+×x*÷/^]\s*[\d(]|\d\s*%\s*of\s*\d|\d?[a-z]\s*[-+]\s*\d+\s*=\s*-?\d|^\d*[a-z]\s*=\s*-?\d/i.test(line);
    if (!looks) continue;
    // a date (12/03/2026), a phone number or a time is not a sum
    if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}:\d{2}\b/.test(line) || telOf(line)) continue;
    const r = solve(line);
    if (r) out.push({ text: line, at, answer: r.answer, steps: r.steps });
  }
  return out;
}
