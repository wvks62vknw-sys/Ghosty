/**
 * DOCUMENTS (BRIEF-REST-E part 2): the document as the phone keeps it — a title and blocks (headings, paragraphs, list
 * items, a quotation, a line set to the right for a letter's name and date), each block's words in runs that may be bold
 * or italic, a line break kept inside a paragraph (an address). Read from Markdown, plain text and HTML, written back to
 * each; the brain's reply made into a document; the editor's history, find and replace; the brain's edits as
 * SUGGESTIONS accepted or rejected one by one (never applied silently); a translation paragraph by paragraph with the
 * structure kept. Pure: apps/edge/test/reste.test.mjs.
 */

export type BlockType = 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'quote' | 'right';
export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
}
export interface Block {
  id: string;
  t: BlockType;
  runs: Run[];
}
export interface Doc {
  id: string;
  title: string;
  blocks: Block[];
  /** Last changed (ms). */
  at: number;
  kind: 'letter' | 'document' | 'read' | 'translation';
  /** The language it is in, when it was translated ("Urdu"). */
  lang?: string;
  /** Written right to left (Urdu, Arabic, Persian, Hebrew). */
  rtl?: boolean;
  /** Where it came from: the file's name, or "written with Ghosty". */
  from?: string;
}

let seq = 0;
export const blockId = (): string => `b${Date.now().toString(36)}${(++seq).toString(36)}`;
export const block = (t: BlockType, text: string | Run[]): Block => ({ id: blockId(), t, runs: typeof text === 'string' ? (text ? [{ text }] : []) : text });
export const newDoc = (title: string, blocks: Block[], kind: Doc['kind'] = 'document', from = ''): Doc => ({ id: `d${Date.now().toString(36)}${(++seq).toString(36)}`, title: title.trim() || 'Untitled', blocks, at: Date.now(), kind, ...(from ? { from } : {}) });

export const textOf = (b: Block): string => b.runs.map((r) => r.text).join('');
export const docText = (d: Doc): string => d.blocks.map(textOf).join('\n\n');
export const isHeading = (t: BlockType): boolean => t === 'h1' || t === 'h2' || t === 'h3';

/** Runs that sit next to each other with the same marks, joined; empty ones dropped. */
export function tidyRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i) last.text += r.text;
    else out.push({ text: r.text, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}) });
  }
  return out;
}

// ---------------------------------------------------------------- Markdown and plain text in

/** **bold**, *italic* or _italic_, ***both***, as runs (a lone star stays a star). */
export function inline(md: string): Run[] {
  return inlineMd(md);
}
function inlineMd(md: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*\*|___)(?=\S)([\s\S]*?\S)\1|(\*\*|__)(?=\S)([\s\S]*?\S)\3|(\*|_)(?=\S)([\s\S]*?\S)\5(?![\w*])/g;
  let at = 0;
  for (const m of md.matchAll(re)) {
    // an underscore inside a word (snake_case) is not italic
    if ((m[5] === '_' || m[3] === '__') && /\w/.test(md[m.index! - 1] ?? '')) continue;
    if (m.index! > at) out.push({ text: md.slice(at, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], b: true, i: true });
    else if (m[4] !== undefined) out.push(...inlineMd(m[4]).map((r) => ({ ...r, b: true })));
    else out.push(...inlineMd(m[6]!).map((r) => ({ ...r, i: true })));
    at = m.index! + m[0].length;
  }
  if (at < md.length) out.push({ text: md.slice(at) });
  return tidyRuns(out.map((r) => ({ ...r, text: r.text.replace(/\\([*_\\#])/g, '$1') })));
}

/** Markdown as blocks: # headings, - and 1. lists, > quotes; lines inside a paragraph keep their breaks. */
export function fromMarkdown(md: string, plain = false): Block[] {
  // plain text: the same lines and lists, but a star is a star
  const inline = plain ? (s: string): Run[] => (s ? [{ text: s }] : []) : inlineMd;
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(block('p', inline(para.join('\n'))));
    para = [];
  };
  let fence = false;
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line.trim())) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) {
      para.push(line);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    const ul = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (h) {
      flush();
      out.push(block(h[1]!.length === 1 ? 'h1' : h[1]!.length === 2 ? 'h2' : 'h3', inline(h[2]!)));
    } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) flush();
    else if (ul && !/^\s*\*\*/.test(line)) {
      flush();
      out.push(block('ul', inline(ul[1]!)));
    } else if (ol) {
      flush();
      out.push(block('ol', inline(ol[1]!)));
    } else if (q) {
      flush();
      out.push(block('quote', inline(q[1]!)));
    } else para.push(line.trim());
  }
  flush();
  return out;
}

/** Plain text as blocks: paragraphs between blank lines (their line breaks kept), bullets and numbered lines as lists. */
export function fromText(text: string): Block[] {
  return fromMarkdown(text, true);
}

// ---------------------------------------------------------------- HTML in

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', pound: '£', euro: '€', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·' };
export function entities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m));
}

/** An HTML page (or a Word file through mammoth, or an e-book chapter) as blocks: headings, paragraphs, lists, bold and italic. */
export function fromHtml(html: string): Block[] {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|noscript|svg|template|nav|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<title\b[\s\S]*?<\/title>/gi, '');
  const out: Block[] = [];
  const lists: ('ul' | 'ol')[] = [];
  let cur: { t: BlockType; runs: Run[] } | null = null;
  let bold = 0;
  let ital = 0;
  let pre = 0;
  const open = (t: BlockType) => {
    close();
    cur = { t, runs: [] };
  };
  const close = () => {
    if (cur) {
      const runs = tidyRuns(cur.runs.map((r) => ({ ...r, text: r.text })));
      // whitespace at the ends of the block and around its line breaks goes
      if (runs.length) {
        runs[0]!.text = runs[0]!.text.replace(/^[ \t]+/, '');
        runs[runs.length - 1]!.text = runs[runs.length - 1]!.text.replace(/[ \t]+$/, '');
      }
      const kept = tidyRuns(runs.map((r) => ({ ...r, text: r.text.replace(/[ \t]*\n[ \t]*/g, '\n') })));
      if (kept.some((r) => r.text.trim())) out.push({ id: blockId(), t: cur.t, runs: kept });
    }
    cur = null;
  };
  for (const m of src.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>|[^<]+/gi)) {
    const tok = m[0];
    if (tok[0] !== '<') {
      let text = entities(tok);
      if (!pre) text = text.replace(/\s+/g, ' ');
      if (!text.trim() && !cur) continue;
      cur ??= { t: 'p', runs: [] };
      (cur as { runs: Run[] }).runs.push({ text, ...(bold ? { b: true } : {}), ...(ital ? { i: true } : {}) });
      continue;
    }
    const end = tok[1] === '/';
    const tag = m[1]!.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      if (end) close();
      else open(tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3');
    } else if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'tr' || tag === 'dd' || tag === 'dt' || tag === 'figcaption' || tag === 'caption') {
      if (end) close();
      else open('p');
    } else if (tag === 'ul' || tag === 'ol') {
      close();
      if (end) lists.pop();
      else lists.push(tag);
    } else if (tag === 'li') {
      if (end) close();
      else open(lists[lists.length - 1] ?? 'ul');
    } else if (tag === 'blockquote') {
      if (end) close();
      else open('quote');
    } else if (tag === 'br') {
      cur ??= { t: 'p', runs: [] };
      (cur as { runs: Run[] }).runs.push({ text: '\n' });
    } else if (tag === 'b' || tag === 'strong') bold = Math.max(0, bold + (end ? -1 : 1));
    else if (tag === 'i' || tag === 'em') ital = Math.max(0, ital + (end ? -1 : 1));
    else if (tag === 'pre') {
      pre = Math.max(0, pre + (end ? -1 : 1));
      if (end) close();
      else open('p');
    } else if (tag === 'td' || tag === 'th') {
      if (!end && cur && (cur as { runs: Run[] }).runs.length) (cur as { runs: Run[] }).runs.push({ text: ' | ' });
    } else if (tag === 'hr' || tag === 'table' || tag === 'body') close();
  }
  close();
  return out;
}

/** An HTML page's own title, when it has one. */
export const htmlTitle = (html: string): string => entities(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- out

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const runHtml = (r: Run) => {
  let s = esc(r.text).replace(/\n/g, '<br>');
  if (r.i) s = `<em>${s}</em>`;
  if (r.b) s = `<strong>${s}</strong>`;
  return s;
};

/** The document as HTML: its blocks (lists grouped), and with `page` a whole page in the document style. */
export function toHtml(d: Doc, page = false): string {
  const parts: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  for (const b of d.blocks) {
    const inner = b.runs.map(runHtml).join('');
    if (b.t === 'ul' || b.t === 'ol') {
      if (list !== b.t) {
        if (list) parts.push(`</${list}>`);
        parts.push(`<${b.t}>`);
        list = b.t;
      }
      parts.push(`<li>${inner}</li>`);
      continue;
    }
    if (list) {
      parts.push(`</${list}>`);
      list = null;
    }
    parts.push(b.t === 'quote' ? `<blockquote>${inner}</blockquote>` : b.t === 'right' ? '<p class="right">' + inner + '</p>' : isHeading(b.t) ? `<${b.t}>${inner}</${b.t}>` : `<p>${inner}</p>`);
  }
  if (list) parts.push(`</${list}>`);
  const body = parts.join('\n');
  if (!page) return body;
  const dir = d.rtl ? ' dir="rtl"' : '';
  return `<!doctype html>\n<html lang="${d.lang ? langCode(d.lang) : 'en-GB'}"${dir}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(d.title)}</title>\n<style>body{font:17px/1.6 Georgia,'Times New Roman',serif;max-width:40em;margin:3em auto;padding:0 1.2em;color:#111}h1,h2,h3{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;line-height:1.25}h1.title{font-size:1.9em}p.right{text-align:right}blockquote{border-left:3px solid #999;margin-left:0;padding-left:1em;color:#444}</style>\n</head>\n<body>\n<h1 class="title">${esc(d.title)}</h1>\n${body}\n</body>\n</html>\n`;
}

const runMd = (r: Run) => {
  const t = r.text.replace(/([*_\\])/g, '\\$1').replace(/\n/g, '  \n');
  return r.b && r.i ? `***${t}***` : r.b ? `**${t}**` : r.i ? `*${t}*` : t;
};
/** The document as Markdown (its title first). */
export function toMarkdown(d: Doc): string {
  const lines: string[] = [`# ${d.title}`, ''];
  let n = 0;
  d.blocks.forEach((b, k) => {
    const inner = b.runs.map(runMd).join('');
    const prev = d.blocks[k - 1]?.t;
    n = b.t === 'ol' ? (prev === 'ol' ? n + 1 : 1) : 0;
    const line = b.t === 'h1' ? `## ${inner}` : b.t === 'h2' ? `### ${inner}` : b.t === 'h3' ? `#### ${inner}` : b.t === 'ul' ? `- ${inner}` : b.t === 'ol' ? `${n}. ${inner}` : b.t === 'quote' ? `> ${inner}` : inner;
    const listy = (t?: BlockType) => t === 'ul' || t === 'ol';
    if (k && !(listy(b.t) && listy(prev) && b.t === prev)) lines.push('');
    lines.push(line);
  });
  return lines.join('\n').trim() + '\n';
}

/** The document as plain text: headings on their own lines, bullets as "•", numbers counted. */
export function toText(d: Doc): string {
  const lines: string[] = [d.title, ''];
  let n = 0;
  d.blocks.forEach((b, k) => {
    const inner = textOf(b);
    const prev = d.blocks[k - 1]?.t;
    n = b.t === 'ol' ? (prev === 'ol' ? n + 1 : 1) : 0;
    const listy = (t?: BlockType) => t === 'ul' || t === 'ol';
    if (k && !(listy(b.t) && b.t === prev)) lines.push('');
    lines.push(b.t === 'ul' ? `• ${inner}` : b.t === 'ol' ? `${n}. ${inner}` : b.t === 'quote' ? `“${inner}”` : inner);
  });
  return lines.join('\n').trim() + '\n';
}

/**
 * Blocks read from a file, with their title: a first top heading is the title (and the headings under it move up a level
 * when it was the only one, as our own Markdown and Word files have it); else the file's name.
 */
export function titled(blocks: Block[], fallback: string): { title: string; blocks: Block[] } {
  const first = blocks[0];
  if (!first || first.t !== 'h1') return { title: fallback, blocks };
  const rest = blocks.slice(1);
  const lift = !rest.some((b) => b.t === 'h1');
  return { title: textOf(first).trim() || fallback, blocks: lift ? rest.map((b) => (b.t === 'h2' ? { ...b, t: 'h1' } : b.t === 'h3' ? { ...b, t: 'h2' } : b)) : rest };
}

/** The headings, for the CONTENTS list. */
export const contents = (d: Doc): { id: string; level: number; text: string }[] => d.blocks.filter((b) => isHeading(b.t)).map((b) => ({ id: b.id, level: Number(b.t[1]), text: textOf(b) }));

// ---------------------------------------------------------------- from the chat

/** "write a letter to my landlord about the damp", "draft an email to school", "write me an essay on the Romans": a document ask. */
export const WRITE_ASK = /^(?:(?:can|could|would) you |please |ghosty,? )?(?:write|draft|compose|do|make)\s+(?:me\s+|us\s+)?(?:up\s+)?(?:a|an|the|my)\s+(?:short\s+|formal\s+|polite\s+|strong\s+|quick\s+)?(letter|email|e-mail|complaint|cover letter|covering letter|essay|report|cv|speech|statement|document|note|notice|reference|application|story|poem|article|summary|proposal|appeal)\b/i;
export const writeAsked = (text: string): string | null => WRITE_ASK.exec(text.trim())?.[1]?.toLowerCase() ?? null;

/** A title from his ask: "write a letter to my landlord about the damp" → "Letter to my landlord about the damp". */
export function titleFromAsk(ask: string): string {
  const t = ask
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/^(?:(?:can|could|would) you |please |ghosty,? )?(?:write|draft|compose|do|make)\s+(?:me\s+|us\s+)?(?:up\s+)?(?:a|an|the|my)\s+/i, '')
    .replace(/\s+for me$/i, '');
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 90) || 'Document';
}

const CHATTER_START = /^(?:sure|of course|certainly|okay|ok|absolutely|here(?:'s| is| are)|below is|i(?:'ve| have) (?:written|drafted)|this (?:letter|email|draft))\b/i;
const CHATTER_END = /^(?:let me know|want me|would you like|shall i|i hope|feel free|if you(?:'d| would) like|you can|tip:|note:|remember to|good luck)/i;

/**
 * The brain's reply made into a document: the chatter before and after the writing goes ("Here's a letter:", "Want me
 * to make it shorter?"); for a letter his name and the date fill the places left for them ("[Your name]", "[Date]"), and
 * the date goes at the top on the right when the letter has none.
 */
export function docFromReply(reply: string, ask: string, me: { name?: string; date?: string } = {}): Doc {
  const kind = writeAsked(ask);
  const letter = !!kind && /letter|email|e-mail|complaint|appeal|application|reference/.test(kind);
  let text = reply.replace(/\r\n?/g, '\n').replace(/^```[a-z]*\n|\n```\s*$/g, '');
  const paras = text.split(/\n{2,}/);
  while (paras.length > 1 && CHATTER_START.test(paras[0]!.trim()) && paras[0]!.trim().length < 160) paras.shift();
  while (paras.length > 1 && CHATTER_END.test(paras[paras.length - 1]!.trim())) paras.pop();
  text = paras.join('\n\n');
  const date = me.date ?? '';
  if (me.name) text = text.replace(/\[(?:your|my) (?:full )?name\]/gi, me.name);
  if (date) text = text.replace(/\[(?:today'?s )?date\]/gi, date);
  let blocks = fromMarkdown(text);
  // a leading "Subject:" heading-like line becomes a heading of its own
  let title = titleFromAsk(ask);
  const first = blocks[0];
  if (first && isHeading(first.t) && blocks.length > 1) {
    title = textOf(first);
    blocks = blocks.slice(1);
  }
  if (letter && date && !blocks.some((b) => textOf(b).includes(date)) && !/\b\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4}\b/i.test(text)) {
    blocks.unshift(block('right', date));
    if (me.name && !text.includes(me.name)) blocks.unshift(block('right', me.name));
  }
  return { ...newDoc(title, blocks, letter ? 'letter' : 'document', 'written with Ghosty'), title };
}

// ---------------------------------------------------------------- editing

/** The editor's undo and redo: a copy of the document at each change, sixty deep. */
export class History {
  private back: string[] = [];
  private fwd: string[] = [];
  constructor(private now: Doc) {}
  get doc(): Doc {
    return this.now;
  }
  /** A change: what was before goes on the undo stack. */
  push(next: Doc): Doc {
    this.back.push(JSON.stringify(this.now));
    if (this.back.length > 60) this.back.shift();
    this.fwd = [];
    this.now = { ...next, at: Date.now() };
    return this.now;
  }
  get canUndo(): boolean {
    return this.back.length > 0;
  }
  get canRedo(): boolean {
    return this.fwd.length > 0;
  }
  undo(): Doc {
    const prev = this.back.pop();
    if (prev) {
      this.fwd.push(JSON.stringify(this.now));
      this.now = JSON.parse(prev) as Doc;
    }
    return this.now;
  }
  redo(): Doc {
    const next = this.fwd.pop();
    if (next) {
      this.back.push(JSON.stringify(this.now));
      this.now = JSON.parse(next) as Doc;
    }
    return this.now;
  }
}

export const withBlock = (d: Doc, id: string, change: (b: Block) => Block | null): Doc => ({
  ...d,
  blocks: d.blocks.flatMap((b) => (b.id === id ? (change(b) ?? []) : [b])),
});

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pattern(q: string, matchCase: boolean, whole: boolean): RegExp {
  return new RegExp(whole ? `(?<![\\p{L}\\p{N}])${escRe(q)}(?![\\p{L}\\p{N}])` : escRe(q), `gu${matchCase ? '' : 'i'}`);
}

/** Where the words are found: each block's id with how many times (FIND). */
export function findIn(d: Doc, q: string, matchCase = false, whole = false): { id: string; count: number }[] {
  if (!q) return [];
  const re = pattern(q, matchCase, whole);
  return d.blocks.map((b) => ({ id: b.id, count: [...textOf(b).matchAll(re)].length })).filter((x) => x.count);
}

/**
 * Every match replaced (FIND AND REPLACE), inside each run so bold and italic stay where they were; words that cross
 * from plain into bold are left (and counted in `skipped`).
 */
export function replaceAll(d: Doc, q: string, by: string, matchCase = false, whole = false): { doc: Doc; count: number; skipped: number } {
  if (!q) return { doc: d, count: 0, skipped: 0 };
  const re = pattern(q, matchCase, whole);
  let count = 0;
  let skipped = 0;
  const blocks = d.blocks.map((b) => {
    const total = [...textOf(b).matchAll(re)].length;
    let here = 0;
    const runs = b.runs.map((r) => ({ ...r, text: r.text.replace(re, () => (here++, by)) }));
    count += here;
    skipped += Math.max(0, total - here);
    return here ? { ...b, runs: tidyRuns(runs) } : b;
  });
  return { doc: { ...d, blocks }, count, skipped };
}

// ---------------------------------------------------------------- the brain's edits, as suggestions

export const EDITS = {
  shorter: { label: 'Make it shorter', ask: 'make it shorter: say the same in fewer words' },
  formal: { label: 'More formal', ask: 'make it more formal, as a letter to an official or a business would be' },
  grammar: { label: 'Fix the grammar', ask: 'fix the spelling, grammar and punctuation only, changing nothing else' },
  plain: { label: 'In plain English', ask: 'put it in plain English: short sentences and everyday words' },
} as const;
export type EditKind = keyof typeof EDITS;

/** The blocks the brain is asked about, numbered from 1 (those with words). */
export const numbered = (d: Doc): Block[] => d.blocks.filter((b) => textOf(b).trim());

/** The words for the brain: what to do, and the document as numbered paragraphs (the turn's data). */
export function editMessage(d: Doc, kind: EditKind | string): string {
  const what = kind in EDITS ? EDITS[kind as EditKind].ask : kind;
  const paras = numbered(d).map((b, i) => `[${i + 1}] ${textOf(b).replace(/\n/g, ' / ')}`);
  return `DOCUMENT EDIT — ${what}. Below is my document "${d.title}" as numbered paragraphs. Reply ONLY with the paragraphs you would change, each on its own line as [number] new words, with the same numbers; leave out any you would keep as they are. Keep names, dates, figures and addresses exactly; " / " is a line break.\n\n${paras.join('\n')}`;
}

/** "[3] new words" lines (also "3. " and "3) "), by number; a line with no number continues the one before it. */
export function parseNumbered(reply: string): Map<number, string> {
  const out = new Map<number, string>();
  let last = 0;
  for (const raw of reply.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const m = /^(?:\*\*)?\[(\d{1,3})\](?:\*\*)?[:.)]?\s*(.*)$/.exec(line) ?? /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (m) {
      last = Number(m[1]);
      out.set(last, m[2]!.trim());
    } else if (last && line && !/^(?:sources?|notes?):?$/i.test(line)) out.set(last, `${out.get(last)} ${line}`.trim());
  }
  for (const [k, v] of out) out.set(k, v.replace(/\s+\/\s+/g, '\n').replace(/^["“](.*)["”]$/s, '$1'));
  return out;
}

export interface Suggestion {
  id: string;
  blockId: string;
  old: string;
  new: string;
}

/** The brain's changed paragraphs as suggestions: one per paragraph whose words really changed. */
export function suggestionsFrom(d: Doc, reply: string): Suggestion[] {
  const blocks = numbered(d);
  const map = parseNumbered(reply);
  const out: Suggestion[] = [];
  for (const [n, words] of map) {
    const b = blocks[n - 1];
    if (!b || !words) continue;
    const old = textOf(b);
    if (old.replace(/\s+/g, ' ').trim() === words.replace(/\s+/g, ' ').trim()) continue;
    out.push({ id: `s${n}-${b.id}`, blockId: b.id, old, new: words });
  }
  return out;
}

/** A suggestion accepted: that paragraph's words become the new ones (its bold and italic go with the old words). */
export const accept = (d: Doc, s: Suggestion): Doc => withBlock(d, s.blockId, (b) => ({ ...b, runs: inline(s.new) }));

/** The words that differ, for showing the old struck and the new beside them: [same, gone, came] pieces. */
export function wordDiff(a: string, b: string): { same?: string; gone?: string; came?: string }[] {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const n = x.length;
  const m = y.length;
  if (n * m > 250_000) return [{ gone: a }, { came: b }];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = x[i] === y[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: { same?: string; gone?: string; came?: string }[] = [];
  const add = (k: 'same' | 'gone' | 'came', s: string) => {
    const last = out[out.length - 1];
    if (last && last[k] !== undefined && Object.keys(last).length === 1) last[k] += s;
    else out.push({ [k]: s });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      add('same', x[i++]!);
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) add('gone', x[i++]!);
    else add('came', y[j++]!);
  }
  while (i < n) add('gone', x[i++]!);
  while (j < m) add('came', y[j++]!);
  return out;
}

// ---------------------------------------------------------------- translation

/** The languages offered by name (the brain writes many more: any other name he types is asked for as it is). */
export const LANGUAGES = ['Urdu', 'Arabic', 'Punjabi', 'Bengali', 'Hindi', 'Gujarati', 'Persian', 'Pashto', 'Turkish', 'Kurdish', 'Somali', 'Polish', 'Romanian', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Greek', 'Russian', 'Ukrainian', 'Chinese', 'Japanese', 'Korean', 'Tamil', 'Swahili', 'Welsh', 'Irish', 'English'];
const RTL = /^(urdu|arabic|persian|farsi|pashto|hebrew|kurdish \(sorani\)|sorani|sindhi|yiddish|dari)$/i;
export const isRtl = (lang: string): boolean => RTL.test(lang.trim());
const CODES: Record<string, string> = { urdu: 'ur', arabic: 'ar', punjabi: 'pa', bengali: 'bn', hindi: 'hi', gujarati: 'gu', persian: 'fa', farsi: 'fa', pashto: 'ps', turkish: 'tr', kurdish: 'ku', somali: 'so', polish: 'pl', romanian: 'ro', spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt', dutch: 'nl', greek: 'el', russian: 'ru', ukrainian: 'uk', chinese: 'zh', japanese: 'ja', korean: 'ko', tamil: 'ta', swahili: 'sw', welsh: 'cy', irish: 'ga', english: 'en-GB', hebrew: 'he' };
export const langCode = (lang: string): string => CODES[lang.trim().toLowerCase()] ?? 'und';

/** "translate this into Urdu", "in Polish please": the language named, or null. */
export function languageAsked(text: string): string | null {
  const m = /\b(?:translate|translated|translation|put|say|write)\b.*?\b(?:in|into|to)\s+([a-z]+(?:\s\([a-z]+\))?)\b/i.exec(text.trim());
  const name = m?.[1] ?? '';
  if (!name || /^(?:the|a|an|my|this|that|it|english\?)$/i.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** The words for the brain: translate every numbered paragraph, keep the numbers (the structure is the phone's). */
export function translateMessage(d: Doc, language: string, from = 0, to = Infinity): string {
  const paras = numbered(d)
    .map((b, i) => ({ n: i + 1, text: textOf(b).replace(/\n/g, ' / ') }))
    .filter((p) => p.n > from && p.n <= to)
    .map((p) => `[${p.n}] ${p.text}`);
  return `DOCUMENT TRANSLATE into ${language}. Translate each numbered paragraph below into ${language}. Reply with every number, each paragraph on its own line as [number] translation, and nothing else. Keep names, numbers and addresses as they are; " / " is a line break.\n\n${paras.join('\n')}`;
}

/** The translated document: the same blocks in the same order, each with its translation (a missing one is kept and said). */
export function translatedDoc(d: Doc, replies: Map<number, string>, language: string): { doc: Doc; missing: number } {
  let missing = 0;
  let n = 0;
  const blocks = d.blocks.map((b) => {
    if (!textOf(b).trim()) return { ...b, id: blockId() };
    n++;
    const t = replies.get(n);
    if (!t) missing++;
    return { id: blockId(), t: b.t, runs: t ? [{ text: t }] : b.runs.map((r) => ({ ...r })) };
  });
  const doc: Doc = { ...newDoc(`${d.title} (${language})`, blocks, 'translation', d.title), lang: language, ...(isRtl(language) ? { rtl: true } : {}) };
  return { doc, missing };
}
