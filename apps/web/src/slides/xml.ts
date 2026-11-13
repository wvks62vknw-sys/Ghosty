/**
 * A SMALL XML READER (BRIEF-EDITOR-PRESENTATIONS): a .pptx is a zip of XML, and the reader and the checks of its parts run on the
 * phone and in node alike, so this does not lean on the browser's DOMParser. Strict on purpose: a part that is not well formed
 * (a tag left open, a tag closed twice, an attribute with no quotes, an entity it does not know, two roots) throws, which is how
 * the tests know the writer's parts are well formed. Names are kept as their local part ("p:sp" is "sp"); attributes are read by
 * their local part too (`attr(el, 'embed')` finds r:embed).
 */
export interface XEl {
  n: string;
  q: string;
  a: Record<string, string>;
  k: XEl[];
  /** The text directly inside it (not its children's), joined. */
  t: string;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescape(s: string, at: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (_, ent: string) => {
    if (ent[0] === '#') {
      const cp = ent[1] === 'x' ? parseInt(ent.slice(2), 16) : Number(ent.slice(1));
      if (!Number.isFinite(cp) || cp > 0x10ffff) throw new Error(`xml: a bad character reference near ${at}`);
      return String.fromCodePoint(cp);
    }
    if (!(ent in NAMED)) throw new Error(`xml: an entity I do not know (&${ent};) near ${at}`);
    return NAMED[ent]!;
  });
}

export function parseXml(src: string): XEl {
  const s = src.replace(/^﻿/, '');
  const stack: XEl[] = [];
  let root: XEl | null = null;
  let i = 0;
  const fail = (why: string): never => {
    throw new Error(`xml: ${why} (at ${i})`);
  };
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    const text = lt < 0 ? s.slice(i) : s.slice(i, lt);
    if (text) {
      if (/\]\]>/.test(text)) fail('a stray ]]>');
      const top = stack[stack.length - 1];
      if (top) top.t += unescape(text, s.slice(Math.max(0, i - 12), i + 12));
      else if (text.trim()) fail('words outside the root');
    }
    if (lt < 0) break;
    i = lt;
    if (s.startsWith('<?', i)) {
      const e = s.indexOf('?>', i);
      if (e < 0) fail('an unfinished <?');
      i = e + 2;
    } else if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i);
      if (e < 0) fail('an unfinished comment');
      i = e + 3;
    } else if (s.startsWith('<![CDATA[', i)) {
      const e = s.indexOf(']]>', i);
      if (e < 0) fail('an unfinished CDATA');
      const top = stack[stack.length - 1];
      if (!top) fail('CDATA outside the root');
      else top.t += s.slice(i + 9, e);
      i = e + 3;
    } else if (s.startsWith('<!', i)) {
      const e = s.indexOf('>', i);
      if (e < 0) fail('an unfinished declaration');
      i = e + 1;
    } else if (s.startsWith('</', i)) {
      const e = s.indexOf('>', i);
      if (e < 0) fail('an unfinished closing tag');
      const name = s.slice(i + 2, e).trim();
      const top = stack.pop();
      if (!top || top.q !== name) fail(`</${name}> closes ${top ? `<${top.q}>` : 'nothing'}`);
      i = e + 1;
    } else {
      // an opening tag: name, attributes, / and >
      const m = /^<([A-Za-z_][\w.:-]*)/.exec(s.slice(i, i + 200));
      if (!m) return fail('a < that opens nothing');
      const el: XEl = { n: m[1]!.includes(':') ? m[1]!.split(':').pop()! : m[1]!, q: m[1]!, a: {}, k: [], t: '' };
      let p = i + m[0].length;
      for (;;) {
        while (p < s.length && /\s/.test(s[p]!)) p++;
        if (s[p] === '>' || s.startsWith('/>', p)) break;
        const am = /^([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(s.slice(p, p + 4000));
        if (!am) return fail(`an attribute I cannot read in <${el.q}>`);
        if (am[1]! in el.a) fail(`<${el.q}> has ${am[1]} twice`);
        el.a[am[1]!] = unescape(am[2] ?? am[3] ?? '', am[1]!);
        p += am[0].length;
      }
      const top = stack[stack.length - 1];
      if (top) top.k.push(el);
      else if (root) fail('two roots');
      else root = el;
      if (s.startsWith('/>', p)) i = p + 2;
      else {
        stack.push(el);
        i = p + 1;
      }
    }
  }
  if (stack.length) fail(`<${stack[stack.length - 1]!.q}> is never closed`);
  if (!root) fail('no root');
  return root!;
}

/** An attribute by its local name ("embed" finds r:embed). */
export function attr(el: XEl | null | undefined, local: string): string {
  if (!el) return '';
  if (local in el.a) return el.a[local]!;
  for (const k of Object.keys(el.a)) if (k.endsWith(`:${local}`)) return el.a[k]!;
  return '';
}
/** The children with this local name (all children when none is named). */
export const kids = (el: XEl | null | undefined, n?: string): XEl[] => (el ? (n ? el.k.filter((c) => c.n === n) : el.k) : []);
export const first = (el: XEl | null | undefined, n: string): XEl | null => kids(el, n)[0] ?? null;
/** The first descendant with this local name, depth first. */
export function find(el: XEl | null | undefined, n: string): XEl | null {
  if (!el) return null;
  for (const c of el.k) {
    if (c.n === n) return c;
    const f = find(c, n);
    if (f) return f;
  }
  return null;
}
/** Every descendant with this local name, in document order. */
export function findAll(el: XEl | null | undefined, n: string, out: XEl[] = []): XEl[] {
  if (!el) return out;
  for (const c of el.k) {
    if (c.n === n) out.push(c);
    findAll(c, n, out);
  }
  return out;
}
/** Does anything below have this local name? */
export const has = (el: XEl | null | undefined, n: string): boolean => !!find(el, n);
