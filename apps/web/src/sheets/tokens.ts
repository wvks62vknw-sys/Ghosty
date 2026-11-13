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

/**
 * The formula after rows (axis 'r') or columns (axis 'c') were put in or taken out of the sheet `target`, as Excel moves it: `n` > 0 lines
 * put in before line `at` push every reference at or past it along (the $ parts too: the cells themselves moved); `n` < 0 lines taken out
 * from `at` pull the later ones back, a range loses the lines it had there, and a reference wholly inside them becomes #REF!. `home` is the
 * sheet the formula lives on (a reference without a sheet's name means that one).
 */
export function moveLinesIn(f: string, home: string, target: string, axis: 'r' | 'c', at: number, n: number): string {
  let toks: Tok[];
  try {
    toks = tokenize(f);
  } catch {
    return f;
  }
  const mine = (sheet?: string) => (sheet ?? home).toLowerCase() === target.toLowerCase();
  const gone = n < 0 ? -n : 0;
  const max = axis === 'r' ? MAXR : MAXC;
  /** A range's two edges after the change, or null when every line it had was taken out. */
  const edges = (lo: number, hi: number): [number, number] | null => {
    if (n > 0) return [lo >= at ? lo + n : lo, hi >= at ? hi + n : hi];
    if (lo >= at && hi < at + gone) return null;
    const lo2 = lo < at ? lo : lo >= at + gone ? lo - gone : at;
    const hi2 = hi < at ? hi : hi >= at + gone ? hi - gone : at - 1;
    return [lo2, hi2];
  };
  let changed = false;
  // (a bare #REF!: "'Sheet 2'!#REF!" would not read back, and a formula that cannot be read is never moved again)
  const bad = (_t: { sheetSrc?: string }) => {
    changed = true;
    return '#REF!';
  };
  /** After an insert, a range whose end is pushed off the sheet keeps its last line (as Excel does); a single cell pushed off is gone. */
  const fit = (e: [number, number] | null, range: boolean): [number, number] | null => {
    if (!e) return null;
    if (e[1] < max) return e;
    return n > 0 && range && e[0] < max ? [e[0], max - 1] : null;
  };
  const out = toks.map((t) => {
    if (t.t === 'ref' && mine(t.sheet)) {
      const k = axis;
      const a0 = t.a[k];
      const b0 = t.b ? t.b[k] : a0;
      const e = fit(edges(Math.min(a0, b0), Math.max(a0, b0)), !!t.b);
      if (!e) return bad(t);
      const [lo, hi] = e;
      if (lo === Math.min(a0, b0) && hi === Math.max(a0, b0)) return t.src;
      changed = true;
      if (!t.b) return `${t.sheetSrc ?? ''}${refText({ ...t.a, [k]: lo })}`;
      const up = a0 <= b0;
      return `${t.sheetSrc ?? ''}${refText({ ...t.a, [k]: up ? lo : hi })}:${refText({ ...t.b, [k]: up ? hi : lo })}`;
    }
    if (t.t === 'colrange' && axis === 'c' && mine(t.sheet)) {
      const lo0 = Math.min(t.c1, t.c2);
      const hi0 = Math.max(t.c1, t.c2);
      const e = fit(edges(lo0, hi0), true);
      if (!e) return bad(t);
      if (e[0] === lo0 && e[1] === hi0) return t.src;
      changed = true;
      return `${t.sheetSrc ?? ''}${t.abs1 ? '$' : ''}${colName(e[0])}:${t.abs2 ? '$' : ''}${colName(e[1])}`;
    }
    return t.src;
  });
  return changed ? out.join('') : f;
}
