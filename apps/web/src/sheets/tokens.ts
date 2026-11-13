/**
 * THE FORMULA'S WORDS (BRIEF-EDITOR-SPREADSHEETS): a formula cut into its tokens, each keeping the text it came from, so the formula can be
 * parsed (formula.ts) and also rewritten without disturbing a character it does not mean to change: slid by a fill or a sort (`shiftFormula`),
 * or following a sheet that was renamed (`renameSheetIn`). Addresses, A1 style, columns A to AZ and rows 1 to 10,000. Pure.
 */
export const MAXC = 52;
export const MAXR = 10_000;

/** A column's letters: 0 → A, 25 → Z, 26 → AA, 51 → AZ. */
export function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
/** A column's number from its letters (A → 0), or -1. */
export function colIndex(s: string): number {
  let n = 0;
  for (const ch of s.toUpperCase()) {
    const k = ch.charCodeAt(0) - 64;
    if (k < 1 || k > 26) return -1;
    n = n * 26 + k;
  }
  return n - 1;
}
export interface Pos {
  r: number;
  c: number;
}
/** B2 → { r: 1, c: 1 } (both counted from 0), or null. */
export function parseAddr(a: string): Pos | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,6})$/.exec(a.trim());
  if (!m) return null;
  const c = colIndex(m[1]!);
  const r = Number(m[2]) - 1;
  return c < 0 || r < 0 ? null : { r, c };
}
export const addr = (r: number, c: number): string => `${colName(c)}${r + 1}`;
export interface Rect {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}
/** "B2" or "B2:D9" (in either order) as a rectangle. */
export function parseRange(s: string): Rect | null {
  const [a, b] = s.replace(/^.*!/, '').split(':');
  const p = parseAddr(a ?? '');
  const q = b === undefined ? p : parseAddr(b);
  if (!p || !q) return null;
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}
export const rangeText = (g: Rect): string => (g.r1 === g.r2 && g.c1 === g.c2 ? addr(g.r1, g.c1) : `${addr(g.r1, g.c1)}:${addr(g.r2, g.c2)}`);

export type Tok =
  | { t: 'num'; src: string; v: number }
  | { t: 'str'; src: string; v: string }
  | { t: 'err'; src: string; v: string }
  | { t: 'ref'; src: string; sheet?: string; sheetSrc?: string; a: RefPart; b?: RefPart }
  | { t: 'colrange'; src: string; sheet?: string; sheetSrc?: string; c1: number; c2: number; abs1: boolean; abs2: boolean }
  | { t: 'name'; src: string }
  | { t: 'op'; src: string }
  | { t: '(' | ')' | ',' | ';' | '{' | '}' | 'ws'; src: string };
export interface RefPart {
  r: number;
  c: number;
  absR: boolean;
  absC: boolean;
}

const ERRS = ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#N/A', '#NUM!', '#CALC!', '#SPILL!', '#CIRCULAR!', '#NULL!'];
const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})/;
const COLS = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(])/;
const IDENT = /^[A-Za-z_\\][A-Za-z0-9_.\\]*/;

function refPart(m: RegExpExecArray, o = 0): RefPart {
  return { absC: m[1 + o] === '$', c: colIndex(m[2 + o]!), absR: m[3 + o] === '$', r: Number(m[4 + o]) - 1 };
}

/** The tokens of a formula (without its leading "="). Throws a plain Error on a character it has no word for. */
export function tokenize(f: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < f.length) {
    const rest = f.slice(i);
    const ch = rest[0]!;
    let m: RegExpExecArray | null;
    if (/\s/.test(ch)) {
      const w = /^\s+/.exec(rest)![0];
      out.push({ t: 'ws', src: w });
      i += w.length;
      continue;
    }
    if (ch === '"') {
      let j = 1;
      let v = '';
      for (;;) {
        if (j >= rest.length) throw new Error('an unfinished piece of text');
        if (rest[j] === '"') {
          if (rest[j + 1] === '"') {
            v += '"';
            j += 2;
            continue;
          }
          break;
        }
        v += rest[j++];
      }
      out.push({ t: 'str', src: rest.slice(0, j + 1), v });
      i += j + 1;
      continue;
    }
    if (ch === '#') {
      const e = ERRS.find((x) => rest.toUpperCase().startsWith(x));
      if (!e) throw new Error('a # I do not know');
      out.push({ t: 'err', src: rest.slice(0, e.length), v: e });
      i += e.length;
      continue;
    }
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest)) && !/^[A-Za-z_]/.test(rest.slice(m[0].length))) {
      out.push({ t: 'num', src: m[0], v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    // a sheet's name and its bang: 'My Sheet'! or Sheet2!
    let sheet: string | undefined;
    let sheetSrc: string | undefined;
    let body = rest;
    let lead = 0;
    if ((m = /^'((?:[^']|'')+)'!/.exec(rest))) {
      sheet = m[1]!.replace(/''/g, "'");
      sheetSrc = m[0];
      lead = m[0].length;
    } else if ((m = /^([A-Za-z_\\][A-Za-z0-9_.\\]*)!/.exec(rest))) {
      sheet = m[1];
      sheetSrc = m[0];
      lead = m[0].length;
    }
    if (sheet !== undefined) body = rest.slice(lead);
    if ((m = COLS.exec(body))) {
      out.push({ t: 'colrange', src: rest.slice(0, lead + m[0].length), sheet, sheetSrc, c1: colIndex(m[2]!), c2: colIndex(m[4]!), abs1: m[1] === '$', abs2: m[3] === '$' });
      i += lead + m[0].length;
      continue;
    }
    if ((m = CELL.exec(body)) && body[m[0].length] !== '(' && !/^[A-Za-z0-9_.]/.test(body.slice(m[0].length))) {
      const a = refPart(m);
      let len = m[0].length;
      let b: RefPart | undefined;
      const m2 = /^:(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})/.exec(body.slice(len));
      if (m2) {
        b = refPart(m2);
        len += m2[0].length;
      }
      out.push({ t: 'ref', src: rest.slice(0, lead + len), sheet, sheetSrc, a, ...(b ? { b } : {}) });
      i += lead + len;
      continue;
    }
    if (sheet !== undefined) throw new Error('a sheet’s name with nothing after it');
    if ((m = IDENT.exec(rest))) {
      out.push({ t: 'name', src: m[0] });
      i += m[0].length;
      continue;
    }
    const two = rest.slice(0, 2);
    if (['<=', '>=', '<>'].includes(two)) {
      out.push({ t: 'op', src: two });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%:'.includes(ch)) out.push({ t: 'op', src: ch });
    else if ('(),;{}'.includes(ch)) out.push({ t: ch as '(', src: ch });
    else throw new Error(`the character ${ch}`);
    i++;
  }
  return out;
}

const refText = (p: RefPart): string => `${p.absC ? '$' : ''}${colName(p.c)}${p.absR ? '$' : ''}${p.r + 1}`;
export const quoteSheet = (n: string): string => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n) && !CELL.test(n) ? `${n}!` : `'${n.replace(/'/g, "''")}'!`);

/** The formula slid by `dr` rows and `dc` columns as a fill or a copy does: the relative parts move, the $ parts stay. A part pushed off the sheet becomes #REF!. */
export function shiftFormula(f: string, dr: number, dc: number): string {
  let toks: Tok[];
  try {
    toks = tokenize(f);
  } catch {
    return f;
  }
  return toks
    .map((t) => {
      if (t.t === 'ref') {
        const sh = (p: RefPart): RefPart => ({ ...p, r: p.absR ? p.r : p.r + dr, c: p.absC ? p.c : p.c + dc });
        const a = sh(t.a);
        const b = t.b && sh(t.b);
        if (a.r < 0 || a.c < 0 || a.r >= MAXR || a.c >= MAXC || (b && (b.r < 0 || b.c < 0 || b.r >= MAXR || b.c >= MAXC))) return `${t.sheetSrc ?? ''}#REF!`;
        return `${t.sheetSrc ?? ''}${refText(a)}${b ? `:${refText(b)}` : ''}`;
      }
      if (t.t === 'colrange') {
        const c1 = t.abs1 ? t.c1 : t.c1 + dc;
        const c2 = t.abs2 ? t.c2 : t.c2 + dc;
        if (c1 < 0 || c2 < 0 || c1 >= MAXC || c2 >= MAXC) return `${t.sheetSrc ?? ''}#REF!`;
        return `${t.sheetSrc ?? ''}${t.abs1 ? '$' : ''}${colName(c1)}:${t.abs2 ? '$' : ''}${colName(c2)}`;
      }
      return t.src;
    })
    .join('');
}

/** The formula with every reference to the sheet `from` now naming `to` (`to` empty: the sheet is gone, so each is #REF!). */
export function renameSheetIn(f: string, from: string, to: string): string {
  let toks: Tok[];
  try {
    toks = tokenize(f);
  } catch {
    return f;
  }
  const same = (n?: string) => n !== undefined && n.toLowerCase() === from.toLowerCase();
  return toks
    .map((t) => {
      if ((t.t === 'ref' || t.t === 'colrange') && same(t.sheet)) return to ? t.src.replace(t.sheetSrc!, quoteSheet(to)) : '#REF!';
      return t.src;
    })
    .join('');
}
